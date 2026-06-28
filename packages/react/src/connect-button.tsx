'use client';

/**
 * ConnectButton: Premium wallet connection button for Canton dApps.
 *
 * Manages the full lifecycle: disconnect → connect (via WalletModal) → connected state.
 * Uses existing hooks (useSession, useConnect, useDisconnect) under the hood.
 *
 * Designed for dApp developers to embed directly: brand-aligned, accessible,
 * and polished across light/dark themes.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useClientSession, useConnect, useDisconnect } from './hooks';
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

// ─── Icons ───────────────────────────────────────────────────────────────────

function WalletIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  );
}

function PowerIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

function ChevronIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
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
  const session = useClientSession();
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

  const isDark = theme.mode === 'dark';
  const brandYellow = theme.colors.primary;      // #FFCC00
  const brandHover = theme.colors.primaryHover;   // #E6B800
  const textOnBrand = '#0B0F1A';

  // ─── Disconnected State ───────────────────────────────────────────

  if (!session && !isConnecting) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className={className}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: 'none',
            borderRadius: theme.borderRadius,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: theme.fontFamily,
            backgroundColor: brandYellow,
            color: textOnBrand,
            boxShadow: `0 1px 2px rgba(15, 23, 42, 0.05), 0 0 0 0 ${brandYellow}00`,
            transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            ...style,
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.backgroundColor = brandHover;
            btn.style.boxShadow = `0 2px 8px rgba(15, 23, 42, 0.08), 0 0 0 3px ${brandYellow}33`;
            btn.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.backgroundColor = brandYellow;
            btn.style.boxShadow = `0 1px 2px rgba(15, 23, 42, 0.05), 0 0 0 0 ${brandYellow}00`;
            btn.style.transform = 'translateY(0)';
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0) scale(0.98)';
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px) scale(1)';
          }}
        >
          <WalletIcon size={16} color={textOnBrand} />
          {label}
        </button>
        <WalletModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onConnect={() => setModalOpen(false)}
        />
        <style>{`@keyframes partylayer-spin { to { transform: rotate(360deg); } }`}</style>
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
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          border: 'none',
          borderRadius: theme.borderRadius,
          cursor: 'wait',
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: theme.fontFamily,
          backgroundColor: brandYellow,
          color: textOnBrand,
          opacity: 0.85,
          boxShadow: `0 0 0 3px ${brandYellow}22`,
          animation: 'partylayer-btn-pulse 1.5s ease-in-out infinite',
          ...style,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: `2px solid ${textOnBrand}33`,
            borderTop: `2px solid ${textOnBrand}`,
            borderRadius: '50%',
            animation: 'partylayer-spin 0.7s linear infinite',
            flexShrink: 0,
          }}
        />
        Connecting...
        <style>{`
          @keyframes partylayer-spin { to { transform: rotate(360deg); } }
          @keyframes partylayer-btn-pulse {
            0%, 100% { box-shadow: 0 0 0 3px ${brandYellow}22; }
            50% { box-shadow: 0 0 0 6px ${brandYellow}15; }
          }
        `}</style>
      </button>
    );
  }

  // ─── Connected State ──────────────────────────────────────────────

  const connectedPartyId = String(session!.partyId);
  const connectedWalletId = String(session!.walletId);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius,
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          fontFamily: theme.fontFamily,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
          transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          ...style,
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.18)';
          btn.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.08)';
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.borderColor = theme.colors.border;
          btn.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.05)';
        }}
      >
        {/* Green status dot */}
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: theme.colors.success,
          flexShrink: 0,
          boxShadow: `0 0 0 2px ${theme.colors.surface}`,
        }} />

        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '13px',
          color: theme.colors.text,
        }}>
          {getConnectedText()}
        </span>

        {showDisconnect && (
          <ChevronIcon
            size={12}
            color={theme.colors.textSecondary}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && showDisconnect && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius,
            boxShadow: isDark
              ? '0 4px 16px rgba(0,0,0,0.3), 0 16px 48px rgba(0,0,0,0.2)'
              : '0 4px 16px rgba(15,23,42,0.08), 0 16px 48px rgba(15,23,42,0.12)',
            minWidth: '220px',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'partylayer-dropdown 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          {/* Session Info */}
          <div style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: theme.colors.success,
              }} />
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: theme.colors.success,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Connected
              </span>
            </div>
            <div style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '12px',
              color: theme.colors.text,
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}>
              {truncatePartyId(connectedPartyId, 10)}
            </div>
            <div style={{
              marginTop: '6px',
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}>
              {connectedWalletId}
            </div>
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.colors.error,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: theme.fontFamily,
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = theme.colors.errorBg;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <PowerIcon size={14} color={theme.colors.error} />
            Disconnect
          </button>
        </div>
      )}

      <style>{`
        @keyframes partylayer-dropdown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
