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

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useClientSession, useConnect, useDisconnect, useWallets } from './hooks';
import { useTheme } from './theme';
import { WalletModal } from './modal';
import { useWalletIcons, resolveWalletIcon } from './kit';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConnectButtonProps {
  /** Button label when disconnected (default: "Connect Wallet") */
  label?: string;
  /** What to show when connected: partyId address, wallet name, or custom */
  connectedLabel?: 'address' | 'wallet' | 'custom';
  /**
   * What the connected button shows (RainbowKit-style): 'full' = avatar + id
   * (default), 'avatar' = just the avatar (compact), 'address' = just the id
   * (no avatar). The dropdown always shows the avatar for identity.
   */
  accountStatus?: 'avatar' | 'address' | 'full';
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

/** Normalize a wallet id for matching against the registry (same rule as the modal). */
function normalizeWalletId(id: string): string {
  return id.replace(/^cip0103:/, '').toLowerCase();
}

/** A clean display name from a wallet id when the registry has no entry for it. */
function prettifyWalletId(id: string): string {
  return id
    .replace(/^cip0103:/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Deterministic avatar ──────────────────────────────────────────────────────

/** FNV-1a hash of a string; stable across runs (deterministic avatar seed). */
function hashPartyId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A deterministic two-color gradient derived purely from the party id. The same
 * id always yields the same gradient (Canton has no ENS, so we generate from the
 * id, like RainbowKit's fallback avatar). Mid lightness so it reads on light and
 * dark. Identity-only: it does NOT tint with the theme accent, so each party is
 * visually distinct and consistent everywhere it appears.
 */
function partyGradient(id: string): string {
  const h = hashPartyId(id);
  const hue1 = h % 360;
  const hue2 = (hue1 + 70 + (h % 130)) % 360;
  const angle = (h >>> 3) % 360;
  return `linear-gradient(${angle}deg, hsl(${hue1} 70% 57%), hsl(${hue2} 68% 47%))`;
}

export interface PartyAvatarProps {
  /** The party id the avatar is generated from. */
  id: string;
  /** Diameter in px (default 20). */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A small deterministic identity avatar for a Canton party: a clean gradient
 * derived from the party id. Reused in the ConnectButton and its dropdown so the
 * identity reads consistently. Purely presentational.
 */
export function PartyAvatar({ id, size = 20, className, style }: PartyAvatarProps) {
  const background = useMemo(() => partyGradient(id), [id]);
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background,
        display: 'inline-block',
        flexShrink: 0,
        ...style,
      }}
    />
  );
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

function CopyIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckSmallIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * The connected wallet's logo (from the registry, the same source the modal
 * uses), with a clean letter fallback when no icon resolves. Used as a small
 * badge overlaid on the identity avatar so the user sees WHICH wallet they are
 * connected through, like Reown/Privy.
 */
function ConnectedWalletIcon({
  name,
  iconUrl,
  size,
  ringColor,
}: {
  name: string;
  iconUrl: string | null;
  size: number;
  ringColor: string;
}) {
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const radius = `${Math.max(4, Math.round(size * 0.3))}px`;
  const frame: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    boxShadow: `0 0 0 2px ${ringColor}`,
  };

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{ ...frame, objectFit: 'cover', display: 'block' }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        ...frame,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        color: theme.colors.textSecondary,
        fontSize: `${Math.round(size * 0.5)}px`,
        fontWeight: 700,
        fontFamily: theme.fontFamily,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConnectButton({
  label = 'Connect Wallet',
  connectedLabel = 'address',
  accountStatus = 'full',
  formatAddress,
  className,
  style,
  showDisconnect = true,
}: ConnectButtonProps) {
  const session = useClientSession();
  const { isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { wallets } = useWallets();
  const walletIcons = useWalletIcons();
  const theme = useTheme();

  // Match the connected session's wallet to its registry entry (name + icon),
  // the same source the modal uses. Falls back gracefully when the wallet has no
  // registry entry (e.g. a dev fixture): a clean name and a letter badge.
  const walletIdStr = session ? String(session.walletId) : '';
  const connectedWallet = useMemo(() => {
    if (!walletIdStr || !wallets) return undefined;
    const target = normalizeWalletId(walletIdStr);
    return wallets.find((w) => normalizeWalletId(String(w.walletId)) === target);
  }, [wallets, walletIdStr]);

  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the copied-feedback timer on unmount.
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

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

  // Copy the FULL party id (not the truncated display) with brief feedback.
  const handleCopy = useCallback(async (partyId: string) => {
    try {
      await navigator.clipboard.writeText(partyId);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (permissions/insecure context): fail silently.
    }
  }, []);

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
  const textOnBrand = theme.colors.primaryForeground ?? '#0B0F1A';

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
  const walletName = connectedWallet?.name ?? prettifyWalletId(connectedWalletId);
  const walletIconUrl = resolveWalletIcon(
    connectedWallet?.walletId ?? connectedWalletId,
    walletIcons,
    connectedWallet?.icons?.sm,
  );

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
        {/* Identity: the deterministic avatar (with a small green presence dot),
            or, in address-only mode, the classic green status dot. */}
        {accountStatus === 'address' ? (
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: theme.colors.success,
            flexShrink: 0,
            boxShadow: `0 0 0 2px ${theme.colors.surface}`,
          }} />
        ) : (
          <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <PartyAvatar id={connectedPartyId} size={20} />
            <span style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: theme.colors.success,
              border: `2px solid ${theme.colors.surface}`,
            }} />
          </span>
        )}

        {accountStatus !== 'avatar' && (
          <span style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '13px',
            color: theme.colors.text,
          }}>
            {getConnectedText()}
          </span>
        )}

        {showDisconnect && (
          <span
            className="pl-account-chevron"
            style={{
              display: 'inline-flex',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <ChevronIcon size={12} color={theme.colors.textSecondary} />
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && showDisconnect && (
        <div
          className="pl-account-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius,
            boxShadow: isDark
              ? '0 4px 16px rgba(0,0,0,0.3), 0 16px 48px rgba(0,0,0,0.2)'
              : '0 4px 16px rgba(15,23,42,0.08), 0 16px 48px rgba(15,23,42,0.12)',
            minWidth: '250px',
            zIndex: 1000,
            overflow: 'hidden',
            transformOrigin: 'top right',
          }}
        >
          {/* Identity header: the party avatar (identity) with the connected
              wallet's logo as a corner badge, then a composed identity block:
              a subtle Connected label, the party id (primary), the wallet (secondary). */}
          <div style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              <PartyAvatar id={connectedPartyId} size={44} />
              <span style={{ position: 'absolute', right: '-3px', bottom: '-3px', display: 'inline-flex' }}>
                <ConnectedWalletIcon
                  name={walletName}
                  iconUrl={walletIconUrl}
                  size={20}
                  ringColor={theme.colors.background}
                />
              </span>
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '3px',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.success,
                }} />
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: theme.colors.success,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                }}>
                  Connected
                </span>
              </div>
              <div
                title={connectedPartyId}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {truncatePartyId(connectedPartyId, 10)}
              </div>
              <div style={{
                marginTop: '2px',
                fontSize: '12px',
                color: theme.colors.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {walletName}
              </div>
            </div>
          </div>

          {/* Action rows: icon-led, aligned, comfortable spacing. */}
          <div style={{ padding: '6px' }}>
            {/* Copy address (the FULL party id; brief "Copied" feedback) */}
            <button
              className="pl-account-row"
              onClick={() => handleCopy(connectedPartyId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                borderRadius: `calc(${theme.borderRadius} - 4px)`,
                backgroundColor: 'transparent',
                color: copied ? theme.colors.success : theme.colors.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: theme.fontFamily,
                transition: 'background-color 150ms, color 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = theme.colors.surface;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ display: 'inline-flex', width: '16px', justifyContent: 'center', flexShrink: 0 }}>
                {copied
                  ? <CheckSmallIcon size={15} color={theme.colors.success} />
                  : <CopyIcon size={15} color={theme.colors.textSecondary} />}
              </span>
              {copied ? 'Copied' : 'Copy address'}
            </button>

            {/* Divider before the terminal action. */}
            <div style={{ height: '1px', backgroundColor: theme.colors.border, margin: '6px 8px' }} />

            {/* Disconnect: the terminal action, in the danger color. */}
            <button
              className="pl-account-row"
              onClick={handleDisconnect}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                borderRadius: `calc(${theme.borderRadius} - 4px)`,
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
              <span style={{ display: 'inline-flex', width: '16px', justifyContent: 'center', flexShrink: 0 }}>
                <PowerIcon size={15} color={theme.colors.error} />
              </span>
              Disconnect
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes partylayer-dropdown {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .pl-account-menu {
          animation: partylayer-dropdown 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .pl-account-menu { animation: none; }
          .pl-account-chevron { transition: none; }
        }
      `}</style>
    </div>
  );
}
