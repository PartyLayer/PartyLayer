'use client';

import { useState } from 'react';
import {
  useWallets,
  useSession,
  useConnect,
  useDisconnect,
  useSignMessage,
  WalletModal,
} from '@cantonconnect/react';
import type { WalletInfo } from '@cantonconnect/sdk';

export function DemoApp() {
  const { wallets, isLoading: walletsLoading } = useWallets();
  const session = useSession();
  const { isConnecting, error: connectError } = useConnect();
  const { disconnect, isDisconnecting } = useDisconnect();
  const { signMessage, isSigning, error: signError } = useSignMessage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState('Hello, Canton!');
  const [signature, setSignature] = useState<string | null>(null);

  const handleSignMessage = async () => {
    if (!session) return;

    const result = await signMessage({
      message,
    });

    if (result) {
      setSignature(result.signature);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setSignature(null);
  };

  const displayError = connectError || signError;

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>CantonConnect Demo</h1>

      {displayError && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fee',
            borderRadius: '4px',
            marginBottom: '16px',
            color: '#c33',
          }}
        >
          <strong>Error:</strong> {displayError.message}
          {'code' in displayError && (
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Code: {(displayError as { code: string }).code}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <h2>Available Wallets</h2>
        {walletsLoading ? (
          <div>Loading wallets...</div>
        ) : (
          <div>
            {wallets.length === 0 ? (
              <div>No wallets available</div>
            ) : (
              <ul>
                {wallets.map((wallet: WalletInfo) => {
                  const walletId = String(wallet.walletId);
                  const walletName = String(wallet.name);
                  const walletWebsite = wallet.website ? String(wallet.website) : undefined;
                  const walletCapabilities = Array.isArray(wallet.capabilities) ? wallet.capabilities.map(String) : [];
                  return (
                    <li key={walletId}>
                      <strong>{walletName}</strong> - {walletWebsite || 'N/A'}
                      <div style={{ fontSize: '12px', color: '#666', marginLeft: '20px' }}>
                        Capabilities: {walletCapabilities.join(', ')}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: '24px' }}>
        <h2>Connection</h2>
        {session ? (
          <div>
            <p>
              <strong>Connected:</strong> {session.walletId}
            </p>
            <p>
              <strong>Party ID:</strong> {session.partyId}
            </p>
            <p>
              <strong>Network:</strong> {session.network}
            </p>
            <p>
              <strong>Capabilities:</strong> {session.capabilitiesSnapshot.join(', ')}
            </p>
            {session.expiresAt && (
              <p>
                <strong>Expires:</strong>{' '}
                {new Date(session.expiresAt).toLocaleString()}
              </p>
            )}
            <button
              onClick={() => {
                void handleDisconnect();
              }}
              disabled={isDisconnecting}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div>
            <p>Not connected. Click below to connect to a wallet.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={isConnecting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        )}
      </div>

      {session && (
        <div style={{ marginTop: '24px' }}>
          <h2>Sign Message</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message to sign"
              style={{
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
            <button
              onClick={() => {
                void handleSignMessage();
              }}
              disabled={isSigning || !session.capabilitiesSnapshot.includes('signMessage')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: session.capabilitiesSnapshot.includes('signMessage') ? 1 : 0.5,
              }}
            >
              {isSigning ? 'Signing...' : 'Sign Message'}
            </button>
            {!session.capabilitiesSnapshot.includes('signMessage') && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                This wallet does not support message signing
              </div>
            )}
            {signature && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  wordBreak: 'break-all',
                }}
              >
                <strong>Signature:</strong> {signature}
              </div>
            )}
          </div>
        </div>
      )}

      <WalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={(sessionId) => {
          console.log('Connected:', sessionId);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
