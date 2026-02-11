/**
 * ConnectButton — RainbowKit-style wallet connection button for Canton dApps.
 *
 * Manages the full lifecycle: disconnect → connect (via WalletModal) → connected state.
 * Uses existing hooks (useSession, useConnect, useDisconnect) under the hood.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, useConnect, useDisconnect } from './hooks';
import { useTheme } from './theme';
import { WalletModal } from './modal';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConnectButtonProps {
  /** Button label when disconnected (default: "Connect Wallet") */
  label?: string;
  /** What to show when connected: partyId address, wallet name, or custom */
  connectedLabel?: 'address' | 'wallet' | 'custom';
  /** Custom formatter for connected display (requires connectedLabel='custom') */
  formatAddress?: (partyId: string) => string;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Show disconnect option in dropdown (default: true) */
  showDisconnect?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Truncate a partyId for display: "party-abc123def456" → "party-abc...456"
 */
export function truncatePartyId(id: string, chars = 6): string {
  if (id.length <= chars * 2 + 3) return id;
  return `${id.slice(0, chars)}...${id.slice(-chars)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConnectButton({
  label = 'Connect Wallet',
  connectedLabel = 'address',
  formatAddress,
  className,
  style,
  showDisconnect = true,
}: ConnectButtonProps) {
  const session = useSession();
  const { isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const theme = useTheme();

  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleDisconnect = useCallback(async () => {
    setDropdownOpen(false);
    try {
      await disconnect();
    } catch {
      // useDisconnect stores error state internally
    }
  }, [disconnect]);

  // ─── Connected Label ──────────────────────────────────────────────

  const getConnectedText = (): string => {
    if (!session) return '';
    const partyId = String(session.partyId);

    switch (connectedLabel) {
      case 'wallet':
        return String(session.walletId);
      case 'custom':
        return formatAddress ? formatAddress(partyId) : truncatePartyId(partyId);
      case 'address':
      default:
        return truncatePartyId(partyId);
    }
  };

  // ─── Styles ───────────────────────────────────────────────────────

  const baseButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: theme.fontFamily,
    transition: 'background-color 0.15s ease, opacity 0.15s ease',
    ...style,
  };

  // ─── Disconnected State ───────────────────────────────────────────

  if (!session && !isConnecting) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className={className}
          style={{
            ...baseButtonStyle,
            backgroundColor: theme.colors.primary,
            color: '#ffffff',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.primaryHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.primary;
          }}
        >
          {label}
        </button>
        <WalletModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onConnect={() => setModalOpen(false)}
        />
      </>
    );
  }

  // ─── Connecting State ─────────────────────────────────────────────

  if (isConnecting) {
    return (
      <button
        disabled
        className={className}
        style={{
          ...baseButtonStyle,
          backgroundColor: theme.colors.primary,
          color: '#ffffff',
          opacity: 0.7,
          cursor: 'wait',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid #ffffff',
            borderRadius: '50%',
            animation: 'partylayer-spin 0.8s linear infinite',
            marginRight: '8px',
            verticalAlign: 'middle',
          }}
        />
        Connecting...
        <style>{`@keyframes partylayer-spin { to { transform: rotate(360deg); } }`}</style>
      </button>
    );
  }

  // ─── Connected State ──────────────────────────────────────────────

  // session is guaranteed non-null here (guarded by early returns above)
  const connectedPartyId = String(session!.partyId);
  const connectedWalletId = String(session!.walletId);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={className}
        style={{
          ...baseButtonStyle,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Green dot indicator */}
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: theme.colors.success,
            flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {getConnectedText()}
        </span>
        {showDisconnect && (
          <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.5 }}>
            ▼
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && showDisconnect && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            minWidth: '180px',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Session Info */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${theme.colors.border}`,
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            <div style={{ fontWeight: 600, color: theme.colors.text, marginBottom: '4px' }}>
              Connected
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
              {truncatePartyId(connectedPartyId, 10)}
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px' }}>
              Wallet: {connectedWalletId}
            </div>
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.colors.error,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '13px',
              fontFamily: theme.fontFamily,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.errorBg;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
