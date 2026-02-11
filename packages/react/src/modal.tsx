/**
 * Wallet selection modal component
 *
 * Priority: CIP-0103 native wallets first, registry wallets second.
 * Theme-aware: picks up PartyLayerTheme from ThemeProvider context.
 */

import { useState, useEffect } from 'react';
import { useWallets, useConnect, useRegistryStatus } from './hooks';
import { useTheme } from './theme';
import type { WalletId, WalletInfo } from '@partylayer/sdk';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (sessionId: string) => void;
}

/**
 * Get user-friendly error message based on error code
 */
function getErrorMessage(error: Error): string {
  const code = 'code' in error ? (error as { code: string }).code : '';
  const message = error.message;

  switch (code) {
    case 'WALLET_NOT_INSTALLED':
      if (message.includes('Console Wallet')) {
        return 'Console Wallet not detected. Please ensure the extension is installed and your wallet is set up.';
      }
      if (message.includes('Loop')) {
        return 'Unable to connect to Loop Wallet. Please try scanning the QR code with the Loop mobile app.';
      }
      return message;

    case 'TIMEOUT':
      return 'Connection timed out. Please try again and complete the wallet connection promptly.';

    case 'USER_REJECTED':
      return 'Connection was cancelled. Please try again when ready.';

    case 'ORIGIN_NOT_ALLOWED':
      return 'This website is not authorized to connect to this wallet.';

    default:
      return message;
  }
}

/**
 * Check if wallet is installed (for badge display)
 */
async function checkWalletInstalled(
  walletId: WalletId
): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  if (walletId === 'console') {
    return typeof (window as unknown as { consoleWallet?: unknown }).consoleWallet !== 'undefined';
  }

  if (walletId === 'loop') {
    return typeof (window as unknown as { loop?: unknown }).loop !== 'undefined';
  }

  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isNativeWallet(wallet: WalletInfo): boolean {
  return wallet.metadata?.source === 'native-cip0103';
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WalletModal({
  isOpen,
  onClose,
  onConnect,
}: WalletModalProps) {
  const { wallets, isLoading } = useWallets();
  const { connect, isConnecting, error } = useConnect();
  const { status: registryStatus } = useRegistryStatus();
  const theme = useTheme();
  const [selectedWallet, setSelectedWallet] = useState<WalletId | null>(null);
  const [installedWallets, setInstalledWallets] = useState<Set<WalletId>>(
    new Set()
  );

  // Check installed status for registry wallets
  useEffect(() => {
    if (!isOpen) return;

    const checkInstalled = async () => {
      const installed = new Set<WalletId>();
      for (const wallet of wallets) {
        if (isNativeWallet(wallet)) continue; // native wallets are always "installed"
        const isInstalled = await checkWalletInstalled(wallet.walletId);
        if (isInstalled) {
          installed.add(wallet.walletId);
        }
      }
      setInstalledWallets(installed);
    };

    checkInstalled();
  }, [wallets, isOpen]);

  if (!isOpen) {
    return null;
  }

  // Split wallets into CIP-0103 native vs registry
  const nativeWallets = wallets.filter(isNativeWallet);
  const registryWallets = wallets.filter((w) => !isNativeWallet(w));

  const handleWalletClick = async (walletId: WalletId) => {
    setSelectedWallet(walletId);
    const session = await connect({
      walletId,
      preferInstalled: true,
    });
    if (session) {
      onConnect(session.sessionId);
      onClose();
    }
    setSelectedWallet(null);
  };

  // ─── Wallet Card Renderer ─────────────────────────────────────────

  const renderWalletCard = (wallet: WalletInfo) => {
    const isNative = isNativeWallet(wallet);
    const isInstalled = installedWallets.has(wallet.walletId);
    const isSelected = selectedWallet === wallet.walletId;

    return (
      <button
        key={wallet.walletId}
        onClick={() => handleWalletClick(wallet.walletId)}
        disabled={isConnecting && isSelected}
        style={{
          padding: '14px 16px',
          border: isNative
            ? '1.5px solid #6366f1'
            : `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius,
          cursor: isConnecting && isSelected ? 'wait' : 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          opacity: isConnecting && isSelected ? 0.6 : 1,
          backgroundColor: isNative
            ? (theme.mode === 'dark' ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)')
            : theme.colors.surface,
          color: theme.colors.text,
          fontFamily: theme.fontFamily,
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
        }}
      >
        {/* Icon */}
        {wallet.icons?.sm ? (
          <img
            src={wallet.icons.sm}
            alt={wallet.name}
            style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0 }}
          />
        ) : (
          <span
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isNative ? '#6366f1' : theme.colors.border,
              borderRadius: '8px',
              color: 'white',
              fontSize: '15px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {wallet.name.charAt(0).toUpperCase()}
          </span>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{wallet.name}</span>

            {/* CIP-0103 badge for native wallets */}
            {isNative && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  borderRadius: '4px',
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                }}
              >
                CIP-0103
              </span>
            )}

            {/* Registry badge for non-native wallets */}
            {!isNative && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}
              >
                Registry
              </span>
            )}

            {/* Installed badge for registry wallets */}
            {!isNative && isInstalled && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: theme.colors.success,
                  color: 'white',
                  borderRadius: '4px',
                }}
              >
                Installed
              </span>
            )}

            {/* Beta badge */}
            {wallet.channel === 'beta' && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: theme.colors.warning,
                  color: 'white',
                  borderRadius: '4px',
                }}
              >
                Beta
              </span>
            )}
          </div>

          {/* Capabilities */}
          <div style={{ fontSize: '11px', color: theme.colors.textSecondary, marginTop: '3px', opacity: 0.8 }}>
            {wallet.capabilities.join(', ')}
          </div>

          {/* Website link for registry wallets */}
          {!isNative && wallet.website && (
            <div style={{ marginTop: '2px' }}>
              <a
                href={wallet.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ color: theme.colors.primary, fontSize: '11px' }}
              >
                Learn more
              </a>
            </div>
          )}
        </div>

        {/* Connecting indicator */}
        {isConnecting && isSelected && (
          <span
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(0,0,0,0.1)',
              borderTop: `2px solid ${theme.colors.primary}`,
              borderRadius: '50%',
              animation: 'partylayer-spin 0.8s linear infinite',
              flexShrink: 0,
            }}
          />
        )}
      </button>
    );
  };

  // ─── Section Header ───────────────────────────────────────────────

  const renderSectionHeader = (title: string, count: number, color: string) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        marginTop: '4px',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '12px', fontWeight: 600, color: theme.colors.text, letterSpacing: '0.3px' }}>
        {title}
      </span>
      <span style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
        ({count})
      </span>
      <div style={{ flex: 1, height: '1px', backgroundColor: theme.colors.border, marginLeft: '4px' }} />
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: theme.borderRadius,
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          fontFamily: theme.fontFamily,
          color: theme.colors.text,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '16px', color: theme.colors.text, fontSize: '18px' }}>
          Select a Wallet
        </h2>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: theme.colors.errorBg,
              borderRadius: '4px',
              marginBottom: '16px',
              color: theme.colors.error,
              fontSize: '13px',
            }}
          >
            <strong>Error:</strong> {getErrorMessage(error)}
            {error instanceof Error && 'code' in error && (
              <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                Code: {(error as { code: string }).code}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div style={{ color: theme.colors.textSecondary, padding: '20px 0', textAlign: 'center' }}>
            Discovering wallets...
          </div>
        ) : wallets.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: theme.colors.textSecondary }}>
            <p style={{ margin: '0 0 8px' }}>No wallets found.</p>
            <p style={{ fontSize: '12px', margin: 0, opacity: 0.7 }}>
              Install a CIP-0103 compatible Canton wallet or check the registry connection.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {/* CIP-0103 Native Wallets — Priority Section */}
            {nativeWallets.length > 0 && (
              <>
                {renderSectionHeader('CIP-0103 Native', nativeWallets.length, '#6366f1')}
                {nativeWallets.map(renderWalletCard)}
              </>
            )}

            {/* Registry Wallets — Fallback Section */}
            {registryWallets.length > 0 && (
              <>
                {renderSectionHeader(
                  nativeWallets.length > 0 ? 'Registry' : 'Available Wallets',
                  registryWallets.length,
                  theme.colors.primary,
                )}
                {registryWallets.map(renderWalletCard)}
              </>
            )}
          </div>
        )}

        {/* Registry Status — subtle footer */}
        {registryStatus && (
          <div
            style={{
              marginTop: '12px',
              padding: '6px 10px',
              fontSize: '10px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              borderTop: `1px solid ${theme.colors.border}`,
              paddingTop: '10px',
            }}
          >
            <span>Registry: {registryStatus.channel}</span>
            {registryStatus.verified && (
              <span style={{ color: theme.colors.success }}>Verified</span>
            )}
            {registryStatus.source === 'cache' && (
              <span style={{ color: theme.colors.warning }}>
                {registryStatus.stale ? 'Stale' : 'Cached'}
              </span>
            )}
            {registryStatus.error && (
              <span style={{ color: theme.colors.error }}>
                {registryStatus.error.code}
              </span>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius,
            cursor: 'pointer',
            width: '100%',
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            fontFamily: theme.fontFamily,
            fontSize: '13px',
          }}
        >
          Cancel
        </button>

        {/* Spinner keyframes */}
        <style>{`@keyframes partylayer-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
