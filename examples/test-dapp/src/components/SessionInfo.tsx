import { useSession, useDisconnect } from '@cantonconnect/react';
import './SessionInfo.css';

function SessionInfo() {
  const session = useSession();
  const { disconnect, isDisconnecting } = useDisconnect();

  if (!session) {
    return (
      <div className="panel">
        <h2>Session Info</h2>
        <div className="info-item">
          <div className="info-value">Not connected</div>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="panel">
      <h2>Session Info</h2>
      
      <div className="info-item">
        <div className="info-label">Wallet ID</div>
        <div className="info-value">{session.walletId}</div>
      </div>

      <div className="info-item">
        <div className="info-label">Party ID</div>
        <div className="info-value">{session.partyId}</div>
      </div>

      <div className="info-item">
        <div className="info-label">Network</div>
        <div className="info-value">{session.network}</div>
      </div>

      <div className="info-item">
        <div className="info-label">Capabilities</div>
        <div className="info-value">
          {session.capabilitiesSnapshot.length > 0
            ? session.capabilitiesSnapshot.join(', ')
            : 'None'}
        </div>
      </div>

      <div className="info-item">
        <div className="info-label">Created At</div>
        <div className="info-value">{formatDate(session.createdAt)}</div>
      </div>

      {session.expiresAt && (
        <div className="info-item">
          <div className="info-label">Expires At</div>
          <div className="info-value">{formatDate(session.expiresAt)}</div>
        </div>
      )}

      {'restoreReason' in session && (session as { restoreReason?: string }).restoreReason && (
        <div className="info-item">
          <div className="info-label">Restore Reason</div>
          <div className="info-value">
            <span className="badge info">{(session as { restoreReason?: string }).restoreReason}</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <button
          className="button danger"
          onClick={disconnect}
          disabled={isDisconnecting}
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>
    </div>
  );
}

export default SessionInfo;
