/**
 * Wallet selection modal component
 */

import { useState, useEffect } from 'react';
import { useWallets, useConnect, useRegistryStatus } from './hooks';
import type { WalletId } from '@cantonconnect/sdk';

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
  // This is a simplified check - in production, would use adapter registry
  if (typeof window === 'undefined') {
    return false;
  }

  if (walletId === 'console') {
    return typeof (window as unknown as { consoleWallet?: unknown }).consoleWallet !== 'undefined';
  }

  if (walletId === 'loop') {
    // Check if Loop SDK is loaded
    return typeof (window as unknown as { loop?: unknown }).loop !== 'undefined';
  }

  return false;
}

export function WalletModal({
  isOpen,
  onClose,
  onConnect,
}: WalletModalProps) {
  const { wallets, isLoading } = useWallets();
  const { connect, isConnecting, error } = useConnect();
  const { status: registryStatus } = useRegistryStatus();
  const [selectedWallet, setSelectedWallet] = useState<WalletId | null>(null);
  const [installedWallets, setInstalledWallets] = useState<Set<WalletId>>(
    new Set()
  );

  // Check installed status for all wallets
  useEffect(() => {
    if (!isOpen) return;

    const checkInstalled = async () => {
      const installed = new Set<WalletId>();
      for (const wallet of wallets) {
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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Select a Wallet</h2>

        {/* Registry Status Indicators */}
        {registryStatus && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: registryStatus.verified ? '#e8f5e9' : '#fff3e0',
              borderRadius: '4px',
              marginBottom: '12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span>
              <strong>Registry:</strong> {registryStatus.channel}
            </span>
            {registryStatus.verified && (
              <span style={{ color: '#2e7d32' }}>✓ Verified</span>
            )}
            {registryStatus.source === 'cache' && (
              <span style={{ color: '#f57c00' }}>
                {registryStatus.stale ? '⚠ Stale (offline)' : '📦 Cached'}
              </span>
            )}
            {registryStatus.error && (
              <span style={{ color: '#d32f2f' }}>
                ⚠ {registryStatus.error.code}
              </span>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fee',
              borderRadius: '4px',
              marginBottom: '16px',
              color: '#c33',
            }}
          >
            <strong>Error:</strong> {getErrorMessage(error)}
            {error instanceof Error && 'code' in error && (
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Code: {(error as { code: string }).code}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div>Loading wallets...</div>
        ) : wallets.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            <p>No wallets found.</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              Registry Status: {registryStatus ? (registryStatus.verified ? 'Verified' : 'Not Verified') : 'Unknown'}
            </p>
            <p style={{ fontSize: '12px' }}>
              Source: {registryStatus?.source || 'Unknown'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {wallets.map((wallet) => {
              const isInstalled = installedWallets.has(wallet.walletId);
              const isSelected = selectedWallet === wallet.walletId;

              return (
                <button
                  key={wallet.walletId}
                  onClick={() => handleWalletClick(wallet.walletId)}
                  disabled={isConnecting && isSelected}
                  style={{
                    padding: '16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: isConnecting && isSelected ? 'wait' : 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    opacity: isConnecting && isSelected ? 0.6 : 1,
                    position: 'relative',
                  }}
                >
                  {wallet.icons?.sm && (
                    <img
                      src={wallet.icons.sm}
                      alt={wallet.name}
                      style={{ width: '32px', height: '32px' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold' }}>{wallet.name}</span>
                      {isInstalled && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: '#4caf50',
                            color: 'white',
                            borderRadius: '4px',
                          }}
                        >
                          Installed
                        </span>
                      )}
                      {wallet.channel === 'beta' && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: '#ff9800',
                            color: 'white',
                            borderRadius: '4px',
                          }}
                        >
                          Beta
                        </span>
                      )}
                      {wallet.channel === 'stable' && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            backgroundColor: '#2196f3',
                            color: 'white',
                            borderRadius: '4px',
                          }}
                        >
                          Stable
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                      {wallet.website && (
                        <a
                          href={wallet.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: '#0066cc' }}
                        >
                          Learn more
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                      Capabilities: {wallet.capabilities.join(', ')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
