'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ACCEPT,
  MAX_BYTES,
  formatBytes,
  requestUpload,
  uploadToS3,
  validateFile,
} from '@/lib/api';

export default function DocumentUpload() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Only what was uploaded in this browser tab. Lost on reload.
  const [uploads, setUploads] = useState([]);

  const uploading = status === 'uploading';

  // Shared by the file picker and drag-and-drop.
  function chooseFile(picked) {
    if (!picked || uploading) return;
    setSignedOut(false);
    const problem = validateFile(picked);
    if (problem) {
      setFile(null);
      setStatus('error');
      setMessage(problem);
      return;
    }
    setFile(picked);
    setStatus('idle');
    setMessage('');
  }

  function clearInput() {
    // Reset the input so picking the same file again still fires onChange.
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleInputChange(event) {
    chooseFile(event.target.files?.[0]);
    clearInput();
  }

  function handleDragOver(event) {
    // Without preventDefault the browser won't allow a drop here and will
    // open the file in the tab instead.
    event.preventDefault();
    if (!uploading) setDragging(true);
  }

  function handleDragLeave(event) {
    // dragleave also fires when moving onto a child element; ignore those.
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function handleUpload() {
    if (!file || uploading) return;
    setStatus('uploading');
    setMessage(`Uploading ${file.name}…`);
    setSignedOut(false);
    try {
      // Presigned POSTs expire after 5 minutes, so request one only now.
      const presigned = await requestUpload(file);
      await uploadToS3(presigned, file);
      setUploads((current) => [
        {
          docId: presigned.docId,
          filename: file.name,
          sizeBytes: file.size,
          uploadedAt: new Date(),
        },
        ...current,
      ]);
      setStatus('success');
      setMessage(`${file.name} uploaded.`);
      setFile(null);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'The upload failed. Try again.');
      setSignedOut(Boolean(err.signedOut));
    }
  }

  return (
    <section className="documents" aria-labelledby="documents-heading">
      <h1 id="documents-heading">Documents</h1>
      <p className="documentsIntro">
        Upload your security documentation: policies, past questionnaires, SOC
        2 reports, architecture docs.
      </p>

      {/* The label is the drop zone. Clicking it opens the file picker because
          it wraps the input, and the input stays keyboard-focusable. */}
      <label
        className={`dropzone${dragging ? ' dropzoneActive' : ''}${uploading ? ' dropzoneDisabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="srOnly"
          accept={ACCEPT}
          onChange={handleInputChange}
          disabled={uploading}
        />
        <span className="dropzoneTitle">
          {file ? file.name : 'Drop a file here or click to choose one'}
        </span>
        <span className="dropzoneHint">
          {file
            ? formatBytes(file.size)
            : `PDF, DOCX, XLSX, TXT or Markdown, up to ${formatBytes(MAX_BYTES)}`}
        </span>
      </label>

      <div className="uploadActions">
        <button
          type="button"
          className="button"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {status === 'uploading' && (
        <p className="uploadStatus" role="status">
          {message}
        </p>
      )}
      {status === 'success' && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {status === 'error' && (
        <p className="error" role="alert">
          {message}
          {signedOut && (
            <>
              {' '}
              <Link href="/signin">Sign in</Link>
            </>
          )}
        </p>
      )}

      <h2 className="uploadListHeading">Uploaded this session</h2>
      {uploads.length === 0 ? (
        <p className="uploadListEmpty">Nothing uploaded yet.</p>
      ) : (
        <ul className="uploadList">
          {uploads.map((upload) => (
            <li key={upload.docId} className="uploadListItem">
              <span className="uploadListName">{upload.filename}</span>
              <span className="uploadListMeta">
                {formatBytes(upload.sizeBytes)} ·{' '}
                {upload.uploadedAt.toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
