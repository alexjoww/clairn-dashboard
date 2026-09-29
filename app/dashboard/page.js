'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '@/components/RequireAuth';
import DocumentUpload from '@/components/DocumentUpload';

const PANEL_ID = 'dashboard-nav';

export default function DashboardPage() {
  const [open, setOpen] = useState(false);
  // Which tab is showing. Documents is the only one so far.
  const [view, setView] = useState('documents');

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <RequireAuth>
      <button
        type="button"
        className="dashboardToggle"
        aria-label="Toggle navigation"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="dashboardToggleBar" />
        <span className="dashboardToggleBar" />
        <span className="dashboardToggleBar" />
      </button>

      <button
        type="button"
        className={`dashboardBackdrop${open ? ' dashboardBackdropOpen' : ''}`}
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <aside
        id={PANEL_ID}
        className={`dashboardPanel${open ? ' dashboardPanelOpen' : ''}`}
        inert={!open}
      >
        <nav className="dashboardNav">
          <button
            type="button"
            className={`dashboardNavItem${view === 'documents' ? ' dashboardNavItemActive' : ''}`}
            aria-current={view === 'documents' ? 'page' : undefined}
            onClick={() => {
              setView('documents');
              setOpen(false);
            }}
          >
            Documents
          </button>
        </nav>
      </aside>

      <main className="dashboardMain">
        {view === 'documents' && <DocumentUpload />}
      </main>
    </RequireAuth>
  );
}
