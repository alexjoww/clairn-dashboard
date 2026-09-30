// The default view after sign-in. Both panels are placeholders until
// questionnaire completion is tracked in the backend.
export default function DashboardHome() {
  return (
    <section className="view" aria-labelledby="dashboard-heading">
      <h1 id="dashboard-heading">Dashboard</h1>

      <div className="dashboardGrid">
        <section className="panel" aria-labelledby="time-saved-heading">
          <h2 id="time-saved-heading" className="panelTitle">
            Time Saved
          </h2>
          {/* TODO: replace the dash with the hours saved across completed
              questionnaires once that data exists. */}
          <p className="heroFigure">
            <span aria-hidden="true">—</span>
            <span className="srOnly">Not available yet</span>
          </p>
          <p className="panelHint">
            Calculated once questionnaires are completed.
          </p>
        </section>

        <section className="panel" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="panelTitle">
            Recently Completed Questionnaires
          </h2>
          {/* TODO: render a list of links to completed questionnaires here. */}
          <p className="emptyState">No completed questionnaires yet.</p>
        </section>
      </div>
    </section>
  );
}
