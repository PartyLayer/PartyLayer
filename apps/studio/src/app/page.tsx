// PartyLayer Studio — shell placeholder (S8.1).
// The left rail is where the scenario list will live; the main area is where
// S8.2 slots the Sandpack/Monaco runnable patterns. No scenarios/editor yet.
export default function StudioHome() {
  return (
    <div className="studio">
      <header className="studio-header">
        <div className="studio-brand">
          <span className="studio-logo" aria-hidden="true">◆</span>
          <span className="studio-title">PartyLayer Studio</span>
        </div>
        <p className="studio-subtitle">
          Live, runnable PartyLayer patterns — coming together
        </p>
      </header>

      <div className="studio-body">
        <nav className="studio-rail" aria-label="Scenarios">
          <p className="studio-rail-heading">Scenarios</p>
          <ul className="studio-rail-list">
            <li className="studio-rail-item studio-rail-item--placeholder">
              Connect a wallet
            </li>
            <li className="studio-rail-item studio-rail-item--placeholder">
              Sign a message
            </li>
            <li className="studio-rail-item studio-rail-item--placeholder">
              Submit a transaction
            </li>
          </ul>
          <p className="studio-rail-note">Patterns arrive in the next step.</p>
        </nav>

        <main className="studio-main">
          <div className="studio-placeholder">
            <h1 className="studio-placeholder-title">Pick a pattern to run it live</h1>
            <p className="studio-placeholder-text">
              This is where each PartyLayer pattern becomes an editable, runnable
              example. The interactive workbench lands in the next step.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
