'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { Wordmark } from '@/components/Brand';
import DashboardHome from '@/components/DashboardHome';
import DocumentUpload from '@/components/DocumentUpload';
import { logout } from '@/lib/auth';

const PANEL_ID = 'dashboard-nav';

// Sidebar tabs, in display order. The first one is what shows after sign-in.
const VIEWS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'documents', label: 'Documents' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(VIEWS[0].id);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      await logout();
      // Sign-in lives at /. replace() so Back doesn't return to the dashboard.
      router.replace('/');
    } catch (err) {
      // Stay put: redirecting would look signed out while tokens may remain.
      setSignOutError(err.message || "Couldn't sign out. Try again.");
      setSigningOut(false);
    }
  }

  return (
    <RequireAuth>
      <header className="topbar">
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
        <Wordmark />
      </header>

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
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`dashboardNavItem${view === id ? ' dashboardNavItemActive' : ''}`}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                setView(id);
                setOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="dashboardPanelFooter">
          <button
            type="button"
            className="dashboardSignOut"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          {signOutError && (
            <p className="error" role="alert">
              {signOutError}
            </p>
          )}
        </div>
      </aside>

      <main className="dashboardMain">
        {view === 'dashboard' && <DashboardHome />}
        {view === 'documents' && <DocumentUpload />}
      </main>
    </RequireAuth>
  );
}
