'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { deleteDocument, formatBytes, listDocuments } from '@/lib/api';

// API status -> what the user sees. Anything else is shown as-is.
const STATUS_LABELS = {
  pending: 'Processing',
  uploaded: 'Uploaded',
};

// Loads when it mounts (when the Documents tab opens) and again whenever
// refreshKey changes, which DocumentUpload bumps after each upload.
export default function DocumentList({ refreshKey }) {
  const [documents, setDocuments] = useState(null); // null until the first load succeeds
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  // docIds with a delete in flight.
  const [deleting, setDeleting] = useState(() => new Set());
  // Counts loads, so a slow response can't overwrite a newer one.
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const id = ++latestLoad.current;
    setLoading(true);
    setError('');
    setSignedOut(false);
    try {
      const docs = await listDocuments();
      if (id === latestLoad.current) setDocuments(docs);
    } catch (err) {
      if (id !== latestLoad.current) return;
      setError(err.message || "Couldn't load your documents. Try again.");
      setSignedOut(Boolean(err.signedOut));
    } finally {
      if (id === latestLoad.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function handleDelete(doc) {
    if (!window.confirm(`Delete ${doc.filename}? This can't be undone.`)) return;
    setDeleting((current) => new Set(current).add(doc.docId));
    setError('');
    setSignedOut(false);
    try {
      await deleteDocument(doc.docId);
      setDocuments((current) => current.filter((d) => d.docId !== doc.docId));
    } catch (err) {
      setError(`Couldn't delete ${doc.filename}: ${err.message || 'Try again.'}`);
      setSignedOut(Boolean(err.signedOut));
    } finally {
      setDeleting((current) => {
        const next = new Set(current);
        next.delete(doc.docId);
        return next;
      });
    }
  }

  return (
    <>
      <div className="documentListHeader">
        <h2 className="documentListHeading">Your documents</h2>
        {/* New uploads show as Processing until the S3 event marks them
            uploaded, usually within seconds. Refresh rather than polling. */}
        <button
          type="button"
          className="button buttonSecondary buttonSmall"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="error documentListError" role="alert">
          {error}
          {signedOut && (
            <>
              {' '}
              <Link href="/">Sign in</Link>
            </>
          )}
        </p>
      )}

      {documents === null ? (
        loading && (
          <p className="documentListMessage" role="status">
            Loading documents…
          </p>
        )
      ) : documents.length === 0 ? (
        <p className="documentListMessage">No documents yet.</p>
      ) : (
        <ul className="documentList">
          {documents.map((doc) => {
            const isDeleting = deleting.has(doc.docId);
            return (
              <li key={doc.docId} className="documentListItem">
                <div className="documentListInfo">
                  <span className="documentListName">{doc.filename}</span>
                  <span className="documentListMeta">
                    {formatBytes(doc.sizeBytes)} ·{' '}
                    <time dateTime={doc.createdAt}>
                      {new Date(doc.createdAt).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </span>
                </div>
                <div className="documentListActions">
                  <span
                    className={`documentListStatus${doc.status === 'pending' ? ' documentListStatusPending' : ''}`}
                  >
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                  <button
                    type="button"
                    className="button buttonSecondary buttonSmall"
                    onClick={() => handleDelete(doc)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                    <span className="srOnly"> {doc.filename}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
