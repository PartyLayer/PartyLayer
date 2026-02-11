'use client';

import { useState } from 'react';
import {
  PartyLayerKit,
  ConnectButton,
  useSession,
  useWallets,
  useSignMessage,
  usePartyLayer,
} from '@partylayer/react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ─── Inner Content (uses hooks inside Kit context) ───────────────────────────

function DemoContent() {
  const session = useSession();
  const { wallets, isLoading } = useWallets();
  const { signMessage, isSigning, error: signError } = useSignMessage();
  const client = usePartyLayer();
  const [signResult, setSignResult] = useState<string | null>(null);

  // Split wallets by source
  const nativeWallets = wallets.filter((w) => w.metadata?.source === 'native-cip0103');
  const registryWallets = wallets.filter((w) => !w.metadata?.source);

  const handleSign = async () => {
    const result = await signMessage({ message: 'Hello Canton from PartyLayerKit!' });
    if (result) {
      setSignResult(String(result.signature));
    }
  };

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Session Info */}
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          marginBottom: '24px',
          backgroundColor: session ? '#e8f5e9' : '#f5f5f5',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Session Status</h3>
        {session ? (
          <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>
            <div><strong>Session ID:</strong> {String(session.sessionId)}</div>
            <div><strong>Party ID:</strong> {String(session.partyId)}</div>
            <div><strong>Wallet:</strong> {String(session.walletId)}</div>
            <div><strong>Network:</strong> {session.network}</div>
          </div>
        ) : (
          <div style={{ color: '#999', fontSize: '13px' }}>
            Not connected. Click &quot;Connect Wallet&quot; above to start.
          </div>
        )}
      </div>

      {/* Wallet Discovery Status */}
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
          Wallet Discovery ({isLoading ? '...' : wallets.length} total)
        </h3>

        {/* CIP-0103 Native Section */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>CIP-0103 Native ({nativeWallets.length})</span>
          </div>
          {nativeWallets.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#999', paddingLeft: '14px' }}>
              No native CIP-0103 wallets detected. Install a CIP-0103 compatible wallet extension.
            </div>
          ) : (
            nativeWallets.map((w) => (
              <div key={w.walletId} style={{ fontSize: '13px', padding: '4px 0 4px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', borderRadius: '4px', color: 'white', fontSize: '10px', fontWeight: 700 }}>
                  {w.name.charAt(0).toUpperCase()}
                </span>
                <strong>{w.name}</strong>
                <span style={{ fontSize: '9px', padding: '1px 5px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', borderRadius: '3px', fontWeight: 600 }}>
                  CIP-0103
                </span>
                <span style={{ color: '#888', fontSize: '11px' }}>{w.capabilities.join(', ')}</span>
              </div>
            ))
          )}
        </div>

        {/* Registry Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2196f3' }} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Registry ({registryWallets.length})</span>
          </div>
          {registryWallets.map((w) => (
            <div key={w.walletId} style={{ fontSize: '13px', padding: '4px 0 4px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {w.icons?.sm && (
                <img src={w.icons.sm} alt="" style={{ width: '20px', height: '20px' }} />
              )}
              <strong>{w.name}</strong>
              <span style={{ fontSize: '9px', padding: '1px 5px', backgroundColor: '#2196f3', color: 'white', borderRadius: '3px' }}>
                Registry
              </span>
              <span style={{ color: '#888', fontSize: '11px' }}>{w.capabilities.join(', ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sign Message Test */}
      {session && (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Sign Message Test</h3>
          <button
            onClick={handleSign}
            disabled={isSigning}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSigning ? 'wait' : 'pointer',
              opacity: isSigning ? 0.7 : 1,
            }}
          >
            {isSigning ? 'Signing...' : 'Sign "Hello Canton"'}
          </button>
          {signResult && (
            <div style={{ marginTop: '8px', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              Signature: {signResult}
            </div>
          )}
          {signError && (
            <div style={{ marginTop: '8px', color: '#d32f2f', fontSize: '12px' }}>
              Error: {signError.message}
            </div>
          )}
        </div>
      )}

      {/* CIP-0103 Bridge Test */}
      {session && (
        <CIP0103BridgeTest client={client} />
      )}
    </div>
  );
}

// ─── CIP-0103 Bridge Test Panel ──────────────────────────────────────────────

function CIP0103BridgeTest({ client }: { client: ReturnType<typeof usePartyLayer> }) {
  const [bridgeStatus, setBridgeStatus] = useState<string | null>(null);

  const testBridge = async () => {
    try {
      const provider = (client as unknown as { asProvider: () => { request: (args: { method: string }) => Promise<unknown> } }).asProvider();
      const status = await provider.request({ method: 'status' });
      setBridgeStatus(JSON.stringify(status, null, 2));
    } catch (err) {
      setBridgeStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        marginBottom: '24px',
      }}
    >
      <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>CIP-0103 Bridge Test</h3>
      <button
        onClick={testBridge}
        style={{
          padding: '8px 16px',
          backgroundColor: '#ff9800',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Test client.asProvider().request(status)
      </button>
      {bridgeStatus && (
        <pre style={{ marginTop: '8px', fontSize: '11px', overflow: 'auto', maxHeight: '200px' }}>
          {bridgeStatus}
        </pre>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function KitDemoPage() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme === 'dark' ? '#121212' : '#ffffff' }}>
      <PartyLayerKit
        network="devnet"
        appName="PartyLayer Kit Demo"
        theme={theme}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '32px 24px',
            color: theme === 'dark' ? '#e0e0e0' : '#1a1a2e',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px' }}>PartyLayer Kit Demo</h1>
              <p style={{ margin: '4px 0 0', fontSize: '14px', opacity: 0.7 }}>
                CIP-0103 native wallets first, registry wallets as fallback
              </p>
            </div>
            <ConnectButton />
          </div>

          {/* Theme Switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {(['light', 'dark', 'auto'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  padding: '6px 14px',
                  border: theme === t ? '2px solid #2196f3' : '1px solid #ccc',
                  borderRadius: '6px',
                  backgroundColor: theme === t ? '#e3f2fd' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: theme === t ? 600 : 400,
                  color: theme === 'dark' ? '#e0e0e0' : '#333',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Code Example */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: theme === 'dark' ? '#1e1e2e' : '#f5f5f5',
              marginBottom: '24px',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: '#999', marginBottom: '8px' }}>// CIP-0103 native wallets auto-discovered:</div>
            <div>
              <span style={{ color: '#c678dd' }}>import</span>{' '}
              {'{ PartyLayerKit, ConnectButton }'}{' '}
              <span style={{ color: '#c678dd' }}>from</span>{' '}
              <span style={{ color: '#98c379' }}>&apos;@partylayer/react&apos;</span>;
            </div>
            <div style={{ marginTop: '8px' }}>
              <span style={{ color: '#e06c75' }}>&lt;PartyLayerKit</span>{' '}
              <span style={{ color: '#d19a66' }}>network</span>=<span style={{ color: '#98c379' }}>&quot;devnet&quot;</span>{' '}
              <span style={{ color: '#d19a66' }}>appName</span>=<span style={{ color: '#98c379' }}>&quot;My dApp&quot;</span>
              <span style={{ color: '#e06c75' }}>&gt;</span>
            </div>
            <div style={{ paddingLeft: '20px' }}>
              <span style={{ color: '#e06c75' }}>&lt;ConnectButton /&gt;</span>
              <span style={{ color: '#999' }}> {/* CIP-0103 wallets appear first */}</span>
            </div>
            <div>
              <span style={{ color: '#e06c75' }}>&lt;/PartyLayerKit&gt;</span>
            </div>
          </div>

          {/* Content that uses hooks */}
          <DemoContent />
        </div>
      </PartyLayerKit>
    </div>
  );
}
