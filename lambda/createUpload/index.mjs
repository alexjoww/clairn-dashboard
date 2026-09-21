import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const { BUCKET_NAME, TABLE_NAME } = process.env;
const MAX_BYTES = Number(process.env.MAX_BYTES);
if (!Number.isInteger(MAX_BYTES) || MAX_BYTES < 1) {
  // Fail at init rather than issuing presigned POSTs with a broken size limit.
  throw new Error("MAX_BYTES must be a positive integer");
}

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const PRESIGN_EXPIRES_SECONDS = 300;
const PENDING_TTL_SECONDS = 60 * 60;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function sanitizeFilename(name) {
  // Basename only: drop everything through the last "/" or "\".
  const base = name.slice(Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1);
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "");
  // cleaned can no longer start with ".", so any dot found is a real extension separator.
  const dot = cleaned.lastIndexOf(".");
  const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  const ext = dot > 0 ? cleaned.slice(dot) : "";
  return (stem.slice(0, 100) + ext) || "file";
}

export const handler = async (event) => {
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return json(401, { message: "Unauthorized" });

  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf8")
      : (event.body ?? "");
    body = JSON.parse(raw);
  } catch {
    return json(400, { message: "body must be valid JSON" });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json(400, { message: "body must be a JSON object" });
  }

  const { filename, contentType, sizeBytes } = body;
  if (typeof filename !== "string" || filename.trim().length === 0) {
    return json(400, { message: "filename is required and must be a non-empty string" });
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return json(400, { message: "contentType is missing or not allowed" });
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_BYTES) {
    return json(400, { message: `sizeBytes must be an integer between 1 and ${MAX_BYTES}` });
  }

  const docId = randomUUID();
  const key = `users/${sub}/${docId}/${sanitizeFilename(filename)}`;

  const { url, fields } = await createPresignedPost(s3, {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: PRESIGN_EXPIRES_SECONDS,
    Conditions: [
      ["content-length-range", 1, MAX_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
  });

  const now = new Date();
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `USER#${sub}`,
        sk: `DOC#${docId}`,
        docId,
        filename, // original name for display; the sanitized name lives only in s3Key
        contentType,
        sizeBytes,
        s3Key: key,
        status: "pending",
        createdAt: now.toISOString(),
        expiresAt: Math.floor(now.getTime() / 1000) + PENDING_TTL_SECONDS,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );

  return json(200, { docId, key, url, fields });
};
