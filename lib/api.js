import { getIdToken } from '@/lib/auth';

// Must match MAX_BYTES on the createUpload Lambda. The Lambda and S3 both
// enforce it; checking here too just gives a friendlier message, sooner.
export const MAX_BYTES = 25_000_000;

// Extension -> MIME type. The values are exactly the Lambda's allow-list.
const TYPE_BY_EXTENSION = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const ALLOWED_TYPES = new Set(Object.values(TYPE_BY_EXTENSION));

// For the file input's `accept` attribute. It only filters the picker dialog;
// drag-and-drop ignores it, which is why validateFile() exists.
export const ACCEPT = Object.keys(TYPE_BY_EXTENSION)
  .map((ext) => `.${ext}`)
  .join(',');

// file.type is the browser's guess from the extension, and it is often empty
// (or "text/x-markdown") for .md files. Use it when the Lambda accepts it;
// otherwise infer from the extension. Returns null for unsupported files.
export function getContentType(file) {
  if (ALLOWED_TYPES.has(file.type)) return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  return TYPE_BY_EXTENSION[ext] ?? null;
}

// Returns an error message, or null if the file is OK to upload.
export function validateFile(file) {
  if (!getContentType(file)) {
    return `${file.name} isn't a supported file type. Upload a PDF, DOCX, XLSX, TXT or Markdown file.`;
  }
  if (file.size < 1) {
    return `${file.name} is empty.`;
  }
  if (file.size > MAX_BYTES) {
    // Don't echo the file's size: a file a few KB over would round to "25 MB".
    return `${file.name} is larger than the ${formatBytes(MAX_BYTES)} limit.`;
  }
  return null;
}

// Decimal units (1 MB = 1,000,000 bytes) so the limit reads as "25 MB".
// Number(...toFixed(1)) rounds to one decimal and drops a trailing ".0".
export function formatBytes(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Number((bytes / 1000).toFixed(1))} KB`;
  return `${Number((bytes / 1_000_000).toFixed(1))} MB`;
}

// Errors carry `signedOut: true` when the fix is to sign in again, so the UI
// can offer a link.
function signedOutError() {
  const error = new Error('Your session has expired. Sign in again to upload.');
  error.signedOut = true;
  return error;
}

// Step 1: ask our API for a presigned POST. The Lambda records the document
// as "pending" and returns { docId, key, url, fields }.
// The presigned POST expires after 5 minutes, so call this right before
// uploadToS3(), not when the file is picked.
export async function requestUpload(file) {
  // Must be written out in full: Next.js inlines NEXT_PUBLIC_* at build time
  // by text replacement, so destructuring process.env would come back empty.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not set, so the app cannot reach the API.');
  }

  const token = await getIdToken();
  if (!token) throw signedOutError();

  let response;
  try {
    response = await fetch(`${apiUrl.replace(/\/+$/, '')}/documents`, {
      method: 'POST',
      headers: {
        // The ID token, not the access token: the API's Cognito authorizer
        // reads the user's `sub` claim from it.
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: getContentType(file),
        sizeBytes: file.size,
      }),
    });
  } catch {
    // fetch() only rejects when no response arrives at all: offline, DNS, or
    // a CORS rejection from API Gateway.
    throw new Error("Couldn't reach the Clairn API. Check your connection and try again.");
  }

  // Error bodies are { message }, but don't assume the body is JSON.
  const body = await response.json().catch(() => null);

  if (response.status === 401) throw signedOutError();
  if (!response.ok) {
    throw new Error(body?.message || `The upload request failed (HTTP ${response.status}).`);
  }
  if (!body?.url || !body?.fields) {
    throw new Error('The API returned an unexpected response.');
  }
  return body;
}

// Step 2: send the file straight to S3 using the presigned POST.
export async function uploadToS3(presigned, file) {
  // A presigned POST is an HTML-form-style upload. `fields` holds the key, the
  // Content-Type, a base64 "policy" listing the rules the upload must follow
  // (size range, exact Content-Type, expiry), and a signature over that policy.
  // S3 checks the signature, so the fields must be sent exactly as returned.
  const form = new FormData();
  for (const [name, value] of Object.entries(presigned.fields)) {
    form.append(name, value);
  }
  // The file must be the LAST field. S3 ignores every field that comes after
  // the file, so a field appended later (say, the policy or the key) would
  // count as missing and S3 would reject the upload.
  form.append('file', file);

  let response;
  try {
    // No Content-Type header here on purpose. For a FormData body the browser
    // sets "multipart/form-data; boundary=..." itself; setting it by hand drops
    // the boundary and S3 can't parse the body.
    response = await fetch(presigned.url, { method: 'POST', body: form });
  } catch {
    throw new Error(
      "Couldn't reach file storage. Check your connection. If it keeps happening, the S3 bucket's CORS rules may be blocking this site."
    );
  }

  // S3 answers 204 No Content on success.
  if (response.ok) return;

  // S3 errors are XML: <Error><Code>...</Code><Message>...</Message></Error>.
  const xml = await response.text().catch(() => '');
  const code = xml.match(/<Code>([^<]*)<\/Code>/)?.[1];
  const message = xml.match(/<Message>([^<]*)<\/Message>/)?.[1] ?? '';

  if (code === 'AccessDenied' && /expired/i.test(message)) {
    throw new Error('The upload link expired before the upload started. Try again.');
  }
  if (code === 'EntityTooLarge' || code === 'EntityTooSmall') {
    throw new Error(`S3 rejected the file size. Files must be 1 byte to ${formatBytes(MAX_BYTES)}.`);
  }
  throw new Error(
    `S3 rejected the upload${code ? ` (${code})` : ` (HTTP ${response.status})`}${message ? `: ${message}` : '.'}`
  );
}
