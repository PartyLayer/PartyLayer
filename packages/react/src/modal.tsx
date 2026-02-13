/**
 * WalletModal — Premium wallet selection modal for Canton dApps.
 *
 * Inspired by RainbowKit / WalletConnect quality:
 *   - Multi-state flow: idle -> connecting -> success -> error
 *   - Smooth backdrop blur + scale animations
 *   - Dynamic wallet icons with graceful fallback
 *   - CIP-0103 native wallet priority display
 *   - Full dark/light theme support
 *
 * Uses existing hooks (useWallets, useConnect, useRegistryStatus) under the hood.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallets, useConnect, useRegistryStatus } from './hooks';
import { useTheme } from './theme';
import { useWalletIcons, resolveWalletIcon } from './kit';
import type { WalletInfo } from '@partylayer/sdk';
import type { WalletIconMap } from './kit';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (sessionId: string) => void;
  /** Custom wallet icon URLs (merged with PartyLayerKit context) */
  walletIcons?: WalletIconMap;
}

type ModalView = 'list' | 'connecting' | 'success' | 'error' | 'not-installed';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isNativeWallet(wallet: WalletInfo): boolean {
  return wallet.metadata?.source === 'native-cip0103';
}

function getErrorMessage(error: Error): string {
  const code = 'code' in error ? (error as { code: string }).code : '';
  switch (code) {
    case 'WALLET_NOT_INSTALLED':
      return 'Wallet not detected. Please ensure it is installed and set up.';
    case 'TIMEOUT':
      return 'Connection timed out. Please try again.';
    case 'USER_REJECTED':
      return 'Connection was cancelled.';
    case 'ORIGIN_NOT_ALLOWED':
      return 'This website is not authorized to connect.';
    default:
      return error.message;
  }
}

/** Generate a stable gradient from wallet name for avatar fallback */
function nameToGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 65%, 55%), hsl(${h2}, 65%, 45%))`;
}

/** Known wallet install/website URLs as fallback */
const KNOWN_WALLET_URLS: Record<string, string> = {
  console: 'https://console.digitalasset.com',
  loop: 'https://loop.5n.app',
  cantor8: 'https://cantor8.io',
  bron: 'https://bron.dev',
  nightly: 'https://nightly.app',
};

function getWalletUrl(wallet: WalletInfo): string | null {
  if (wallet.website) return wallet.website;
  const id = String(wallet.walletId).replace(/^cip0103:/, '');
  for (const [key, url] of Object.entries(KNOWN_WALLET_URLS)) {
    if (id.toLowerCase().includes(key)) return url;
  }
  if (wallet.docs?.length > 0) return wallet.docs[0];
  return null;
}

function getWalletTransportLabel(wallet: WalletInfo): string {
  if (isNativeWallet(wallet)) return 'Ready';
  if (wallet.capabilities.includes('injected')) return 'Browser Extension';
  if (wallet.capabilities.includes('popup')) return 'Scan to connect';
  if (wallet.capabilities.includes('deeplink')) return 'Mobile wallet';
  if (wallet.capabilities.includes('remoteSigner')) return 'Enterprise';
  return wallet.capabilities.slice(0, 3).join(', ');
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function CloseIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function BackIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function CheckIcon({ size = 32, color = '#10B981' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ErrorXIcon({ size = 32, color = '#EF4444' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ShieldIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function DownloadIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ─── Wallet Icon Component ───────────────────────────────────────────────────

function ModalWalletIcon({
  wallet,
  size = 48,
  iconUrl,
}: {
  wallet: WalletInfo;
  size?: number;
  iconUrl: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const radius = size >= 44 ? '12px' : '10px';

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={wallet.name}
        onError={() => setImgError(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: radius,
          flexShrink: 0,
          objectFit: 'cover',
        }}
      />
    );
  }

  // Gradient avatar fallback
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        background: nameToGradient(wallet.name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: `${Math.round(size * 0.38)}px`,
        fontWeight: 700,
        flexShrink: 0,
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}
    >
      {wallet.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WalletModal({
  isOpen,
  onClose,
  onConnect,
  walletIcons: propIcons,
}: WalletModalProps) {
  const { wallets, isLoading } = useWallets();
  const { connect, error, reset: resetConnect } = useConnect();
  const { status: registryStatus } = useRegistryStatus();
  const theme = useTheme();

  let contextIcons: WalletIconMap = {};
  try { contextIcons = useWalletIcons(); } catch { /* no Kit context */ }

  // Merge prop icons over context icons
  const walletIcons: WalletIconMap = { ...contextIcons, ...propIcons };

  const [view, setView] = useState<ModalView>('list');
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [closing, setClosing] = useState(false);
  const [connectError, setConnectError] = useState<Error | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setView('list');
      setSelectedWallet(null);
      setClosing(false);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Transition to error/not-installed view when connect fails
  useEffect(() => {
    if (error && view === 'connecting') {
      setConnectError(error);
      const code = 'code' in error ? (error as { code: string }).code : '';
      if (code === 'WALLET_NOT_INSTALLED') {
        setView('not-installed');
      } else {
        setView('error');
      }
    }
  }, [error, view]);

  const handleClose = useCallback(() => {
    // Reset connecting state so cursor/button don't stay in loading mode
    resetConnect();
    setView('list');
    setSelectedWallet(null);
    setConnectError(null);
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 150);
  }, [onClose, resetConnect]);

  const handleWalletClick = useCallback(async (wallet: WalletInfo) => {
    setSelectedWallet(wallet);
    setConnectError(null);
    setView('connecting');

    const session = await connect({
      walletId: wallet.walletId,
      preferInstalled: true,
    });

    if (session) {
      setView('success');
      setTimeout(() => {
        onConnect(session.sessionId);
        onClose();
      }, 800);
    }
    // If session is null, the useConnect hook's error state will trigger
    // the useEffect above to route to the appropriate error view
  }, [connect, onConnect, onClose]);

  const handleRetry = useCallback(() => {
    if (selectedWallet) {
      handleWalletClick(selectedWallet);
    }
  }, [selectedWallet, handleWalletClick]);

  const handleBackToList = useCallback(() => {
    setView('list');
    setSelectedWallet(null);
  }, []);

  if (!isOpen && !closing) return null;

  // Split wallets
  const nativeWallets = wallets.filter(isNativeWallet);
  const registryWallets = wallets.filter((w) => !isNativeWallet(w));

  const isDark = theme.mode === 'dark';

  // ─── Styles ──────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    opacity: closing ? 0 : 1,
    transition: 'opacity 150ms',
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: theme.colors.background,
    borderRadius: '16px',
    width: '480px',
    maxWidth: '94vw',
    maxHeight: '85vh',
    overflow: 'hidden',
    fontFamily: theme.fontFamily,
    color: theme.colors.text,
    boxShadow: isDark
      ? '0 8px 32px rgba(0,0,0,0.5), 0 24px 80px rgba(0,0,0,0.4)'
      : '0 8px 32px rgba(15,23,42,0.12), 0 24px 80px rgba(15,23,42,0.08)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'}`,
    animation: !closing ? 'pl-panel-enter 250ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards' : undefined,
    transform: closing ? 'scale(0.95)' : undefined,
    opacity: closing ? 0 : undefined,
    transition: closing ? 'transform 150ms, opacity 150ms' : undefined,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
  };

  const closeBtnBase: React.CSSProperties = {
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: theme.colors.surface,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 150ms',
    flexShrink: 0,
  };

  const closeBtnStyle: React.CSSProperties = { ...closeBtnBase, width: '32px' };
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';

  // ─── Wallet Card Renderer ──────────────────────────────────────────

  const renderWalletItem = (wallet: WalletInfo) => {
    const isNative = isNativeWallet(wallet);
    const iconUrl = resolveWalletIcon(wallet.walletId, walletIcons, wallet.icons?.sm);

    return (
      <button
        key={wallet.walletId}
        onClick={() => handleWalletClick(wallet)}
        disabled={view === 'connecting'}
        style={{
          width: '100%',
          padding: '14px 18px',
          border: `1px solid ${isNative
            ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)')
            : theme.colors.border}`,
          borderRadius: '12px',
          cursor: view === 'connecting' ? 'wait' : 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          backgroundColor: isNative
            ? (isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)')
            : theme.colors.surface,
          color: theme.colors.text,
          fontFamily: theme.fontFamily,
          transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.transform = 'translateY(-1px)';
          el.style.boxShadow = isDark
            ? '0 4px 12px rgba(0,0,0,0.3)'
            : '0 4px 12px rgba(15,23,42,0.08)';
          el.style.borderColor = isNative
            ? (isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)')
            : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.15)');
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = 'none';
          el.style.borderColor = isNative
            ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)')
            : theme.colors.border;
        }}
      >
        <ModalWalletIcon wallet={wallet} size={48} iconUrl={iconUrl} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '15px', color: theme.colors.text }}>
              {wallet.name}
            </span>
            {isNative && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#FFFFFF',
                borderRadius: '5px',
                fontWeight: 600,
                letterSpacing: '0.3px',
                lineHeight: '14px',
              }}>
                CIP-0103
              </span>
            )}
          </div>
          <div style={{
            fontSize: '12px',
            color: isNative ? theme.colors.success : theme.colors.textSecondary,
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {isNative && (
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: theme.colors.success,
                flexShrink: 0,
              }} />
            )}
            {getWalletTransportLabel(wallet)}
          </div>
        </div>

        <ArrowIcon size={16} color={theme.colors.textSecondary} />
      </button>
    );
  };

  // ─── Section Header ────────────────────────────────────────────────

  const renderSectionHeader = (title: string, count: number, dotColor: string) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 0 8px',
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: dotColor,
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {title}
      </span>
      <span style={{
        fontSize: '11px',
        color: theme.colors.textSecondary,
        opacity: 0.6,
      }}>
        {count}
      </span>
      <div style={{
        flex: 1,
        height: '1px',
        backgroundColor: theme.colors.border,
      }} />
    </div>
  );

  // ─── Views ─────────────────────────────────────────────────────────

  const renderListView = () => (
    <>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 700,
          color: theme.colors.text,
          letterSpacing: '-0.01em',
        }}>
          Connect Wallet
        </h2>
        <button
          onClick={handleClose}
          style={closeBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
          aria-label="Close"
        >
          <CloseIcon size={16} color={theme.colors.textSecondary} />
        </button>
      </div>

      {/* Content */}
      <div style={{
        padding: '0 24px 20px',
        maxHeight: 'calc(85vh - 140px)',
        overflowY: 'auto',
      }}>
        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: `3px solid ${theme.colors.border}`,
              borderTop: `3px solid ${theme.colors.primary}`,
              borderRadius: '50%',
              animation: 'partylayer-spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
              Discovering wallets...
            </div>
          </div>
        ) : wallets.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: theme.colors.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <ShieldIcon size={24} color={theme.colors.textSecondary} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: theme.colors.text, marginBottom: '8px' }}>
              No wallets found
            </div>
            <div style={{ fontSize: '13px', color: theme.colors.textSecondary, lineHeight: 1.5 }}>
              Install a CIP-0103 compatible Canton wallet to get started.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* CIP-0103 Native */}
            {nativeWallets.length > 0 && (
              <>
                {renderSectionHeader('CIP-0103 Native', nativeWallets.length, '#6366f1')}
                {nativeWallets.map(renderWalletItem)}
              </>
            )}

            {/* Registry */}
            {registryWallets.length > 0 && (
              <>
                {nativeWallets.length > 0 && <div style={{ height: '8px' }} />}
                {renderSectionHeader(
                  nativeWallets.length > 0 ? 'Available' : 'Wallets',
                  registryWallets.length,
                  theme.colors.primary,
                )}
                {registryWallets.map(renderWalletItem)}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 24px 18px',
        borderTop: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      }}>
        <ShieldIcon size={12} color={theme.colors.textSecondary} />
        <span style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
          CIP-0103 compliant
        </span>
        {registryStatus?.verified && (
          <>
            <span style={{ fontSize: '11px', color: theme.colors.textSecondary }}>·</span>
            <span style={{ fontSize: '11px', color: theme.colors.success }}>Verified</span>
          </>
        )}
      </div>
    </>
  );

  const renderConnectingView = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);

    return (
      <>
        <div style={headerStyle}>
          <button
            onClick={handleBackToList}
            style={{ ...closeBtnBase, width: 'auto', padding: '0 10px', gap: '4px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
          >
            <BackIcon size={14} color={theme.colors.textSecondary} />
            <span style={{ fontSize: '12px', color: theme.colors.textSecondary, fontWeight: 500 }}>Back</span>
          </button>
          <button
            onClick={handleClose}
            style={closeBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
            aria-label="Close"
          >
            <CloseIcon size={16} color={theme.colors.textSecondary} />
          </button>
        </div>

        <div style={{ padding: '24px 32px 40px', textAlign: 'center' }}>
          {/* Animated ring around icon */}
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
          }}>
            <div style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '18px',
              border: `3px solid ${theme.colors.border}`,
              borderTopColor: theme.colors.primary,
              animation: 'partylayer-spin 1.2s linear infinite',
            }} />
            <div style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <ModalWalletIcon wallet={selectedWallet} size={80} iconUrl={iconUrl} />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '8px',
          }}>
            Opening {selectedWallet.name}
          </div>
          <div style={{
            fontSize: '14px',
            color: theme.colors.textSecondary,
            lineHeight: 1.5,
            marginBottom: '32px',
          }}>
            Confirm the connection in your wallet
          </div>

          <button
            onClick={handleBackToList}
            style={{
              padding: '10px 24px',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '10px',
              backgroundColor: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: theme.fontFamily,
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Cancel
          </button>
        </div>
      </>
    );
  };

  const renderSuccessView = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);

    return (
      <>
        <div style={headerStyle}>
          <div />
          <button onClick={handleClose} style={closeBtnStyle} aria-label="Close">
            <CloseIcon size={16} color={theme.colors.textSecondary} />
          </button>
        </div>

        <div style={{
          padding: '24px 32px 40px',
          textAlign: 'center',
          animation: 'pl-success-pop 300ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}>
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <ModalWalletIcon wallet={selectedWallet} size={80} iconUrl={iconUrl} />
            </div>
            {/* Success badge */}
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: theme.colors.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.colors.background}`,
            }}>
              <CheckIcon size={14} color="#FFFFFF" />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '6px',
          }}>
            Connected
          </div>
          <div style={{ fontSize: '14px', color: theme.colors.success }}>
            {selectedWallet.name} is ready
          </div>
        </div>
      </>
    );
  };

  const renderErrorView = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);

    return (
      <>
        <div style={headerStyle}>
          <button
            onClick={handleBackToList}
            style={{ ...closeBtnBase, width: 'auto', padding: '0 10px', gap: '4px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
          >
            <BackIcon size={14} color={theme.colors.textSecondary} />
            <span style={{ fontSize: '12px', color: theme.colors.textSecondary, fontWeight: 500 }}>Back</span>
          </button>
          <button onClick={handleClose} style={closeBtnStyle} aria-label="Close">
            <CloseIcon size={16} color={theme.colors.textSecondary} />
          </button>
        </div>

        <div style={{ padding: '16px 32px 32px', textAlign: 'center' }}>
          <div style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            margin: '0 auto 20px',
            opacity: 0.7,
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '14px', overflow: 'hidden' }}>
              <ModalWalletIcon wallet={selectedWallet} size={64} iconUrl={iconUrl} />
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: theme.colors.error,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.colors.background}`,
            }}>
              <ErrorXIcon size={12} color="#FFFFFF" />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '8px',
          }}>
            Connection Failed
          </div>

          {(connectError || error) && (
            <div style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
              lineHeight: 1.5,
              maxWidth: '280px',
              margin: '0 auto 24px',
            }}>
              {getErrorMessage(connectError || error!)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleRetry}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '10px',
                backgroundColor: theme.colors.primary,
                color: '#0B0F1A',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: theme.fontFamily,
                transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primary;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Try Again
            </button>
            <button
              onClick={handleBackToList}
              style={{
                padding: '10px 20px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '10px',
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: theme.fontFamily,
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              All Wallets
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderNotInstalledView = () => {
    if (!selectedWallet) return null;
    const iconUrl = resolveWalletIcon(selectedWallet.walletId, walletIcons, selectedWallet.icons?.sm);
    const installUrl = getWalletUrl(selectedWallet);

    return (
      <>
        <div style={headerStyle}>
          <button
            onClick={handleBackToList}
            style={{ ...closeBtnBase, width: 'auto', padding: '0 10px', gap: '4px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
          >
            <BackIcon size={14} color={theme.colors.textSecondary} />
            <span style={{ fontSize: '12px', color: theme.colors.textSecondary, fontWeight: 500 }}>Back</span>
          </button>
          <button onClick={handleClose} style={closeBtnStyle} aria-label="Close">
            <CloseIcon size={16} color={theme.colors.textSecondary} />
          </button>
        </div>

        <div style={{ padding: '16px 32px 36px', textAlign: 'center' }}>
          {/* Wallet icon with download badge */}
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              overflow: 'hidden',
              opacity: 0.85,
            }}>
              <ModalWalletIcon wallet={selectedWallet} size={80} iconUrl={iconUrl} />
            </div>
            <div style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: theme.colors.warning,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `3px solid ${theme.colors.background}`,
            }}>
              <DownloadIcon size={13} color="#FFFFFF" />
            </div>
          </div>

          <div style={{
            fontSize: '17px',
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: '8px',
          }}>
            {selectedWallet.name} not found
          </div>

          <div style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
            maxWidth: '300px',
            margin: '0 auto 28px',
          }}>
            {selectedWallet.name} doesn&apos;t appear to be installed. Install it and refresh this page to connect.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            {installUrl && (
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 28px',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: theme.colors.primary,
                  color: '#0B0F1A',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: theme.fontFamily,
                  textDecoration: 'none',
                  transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = theme.colors.primaryHover;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = theme.colors.primary;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                <DownloadIcon size={15} color="#0B0F1A" />
                Install {selectedWallet.name}
                <ExternalLinkIcon size={11} color="#0B0F1A" />
              </a>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleRetry}
                style={{
                  padding: '10px 20px',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: theme.fontFamily,
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Try Again
              </button>
              <button
                onClick={handleBackToList}
                style={{
                  padding: '10px 20px',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: theme.fontFamily,
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                All Wallets
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div
      style={overlayStyle}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Connect Wallet"
    >
      <div
        ref={modalRef}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'list' && renderListView()}
        {view === 'connecting' && renderConnectingView()}
        {view === 'success' && renderSuccessView()}
        {view === 'error' && renderErrorView()}
        {view === 'not-installed' && renderNotInstalledView()}
      </div>

      <style>{`
        @keyframes partylayer-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pl-panel-enter {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pl-success-pop {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
