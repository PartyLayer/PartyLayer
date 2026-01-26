import { useRegistryStatus } from '@cantonconnect/react';
import './RegistryStatus.css';

function RegistryStatus() {
  const { status } = useRegistryStatus();

  if (!status) {
    return (
      <div className="panel">
        <h2>Registry Status</h2>
        <div className="info-item">
          <div className="info-value">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Registry Status</h2>
      
      <div className="info-item">
        <div className="info-label">Channel</div>
        <div className="info-value">
          {status.channel}
          <span className={`badge ${status.channel === 'stable' ? 'success' : 'info'}`}>
            {status.channel}
          </span>
        </div>
      </div>

      <div className="info-item">
        <div className="info-label">Verified</div>
        <div className="info-value">
          {status.verified ? (
            <span className="badge success">✓ Verified</span>
          ) : (
            <span className="badge error">✗ Not Verified</span>
          )}
        </div>
      </div>

      <div className="info-item">
        <div className="info-label">Source</div>
        <div className="info-value">
          {status.source === 'network' ? (
            <span className="badge success">Network</span>
          ) : (
            <span className="badge warning">Cache</span>
          )}
        </div>
      </div>

      <div className="info-item">
        <div className="info-label">Sequence</div>
        <div className="info-value">{status.sequence}</div>
      </div>

      <div className="info-item">
        <div className="info-label">Stale</div>
        <div className="info-value">
          {status.stale ? (
            <span className="badge warning">Yes</span>
          ) : (
            <span className="badge success">No</span>
          )}
        </div>
      </div>

      {status.fetchedAt && (
        <div className="info-item">
          <div className="info-label">Fetched At</div>
          <div className="info-value">
            {new Date(status.fetchedAt).toLocaleString()}
          </div>
        </div>
      )}

      {status.error && (
        <div className="info-item">
          <div className="info-label">Error</div>
          <div className="info-value">
            <span className="badge error">{status.error.code}</span>
            <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
              {status.error.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RegistryStatus;
