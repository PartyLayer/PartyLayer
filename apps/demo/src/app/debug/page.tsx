'use client';

import { useState, useEffect } from 'react';
import { CantonConnectProvider, useCantonConnect, useRegistryStatus } from '@cantonconnect/react';
import { createCantonConnect } from '@cantonconnect/sdk';
import type { CantonConnectClient, CantonConnectEvent } from '@cantonconnect/sdk';
import { ConsoleAdapter } from '@cantonconnect/adapter-console';
import { LoopAdapter } from '@cantonconnect/adapter-loop';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function DebugPageContent() {
  const client = useCantonConnect();
  const { status: registryStatus, refresh: refreshRegistry } = useRegistryStatus();
  const [events, setEvents] = useState<CantonConnectEvent[]>([]);

  useEffect(() => {
    // Subscribe to all events
    const unsubscribeConnect = client.on('session:connected', (event) => {
      setEvents((prev) => [...prev, event]);
    });

    const unsubscribeDisconnect = client.on('session:disconnected', (event) => {
      setEvents((prev) => [...prev, event]);
    });

    const unsubscribeExpired = client.on('session:expired', (event) => {
      setEvents((prev) => [...prev, event]);
    });

    const unsubscribeTxStatus = client.on('tx:status', (event) => {
      setEvents((prev) => [...prev, event]);
    });

    const unsubscribeError = client.on('error', (event) => {
      setEvents((prev) => [...prev, event]);
    });

    const unsubscribeRegistry = client.on('registry:status', (event) => {
      setEvents((prev) => [...prev, event]);
    });

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeExpired();
      unsubscribeTxStatus();
      unsubscribeError();
      unsubscribeRegistry();
    };
  }, [client]);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Debug Page</h1>

      <div style={{ marginTop: '24px' }}>
        <h2>Registry Status</h2>
        <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => {
            void refreshRegistry();
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Refresh Registry
        </button>
        </div>
        {registryStatus ? (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}
          >
            <pre>{JSON.stringify(registryStatus, null, 2)}</pre>
            {registryStatus.error && (
              <div style={{ marginTop: '8px', color: '#d32f2f' }}>
                <strong>Error:</strong> {registryStatus.error.code} - {registryStatus.error.message}
              </div>
            )}
          </div>
        ) : (
          <div>No registry status available</div>
        )}
      </div>

      <div style={{ marginTop: '24px' }}>
        <h2>Event Log</h2>
        <div
          style={{
            maxHeight: '400px',
            overflow: 'auto',
            border: '1px solid #ccc',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          {events.length === 0 ? (
            <div>No events yet</div>
          ) : (
            events.map((event, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>
                <strong>[{new Date().toLocaleTimeString()}]</strong> {event.type}
                <pre style={{ margin: '4px 0', fontSize: '11px' }}>
                  {JSON.stringify(event, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
        <button
          onClick={() => setEvents([])}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Clear Events
        </button>
      </div>
    </div>
  );
}

function DebugPageWrapper() {
  const [client, setClient] = useState<CantonConnectClient | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cantonClient = createCantonConnect({
      registryUrl: process.env.NEXT_PUBLIC_REGISTRY_URL || 'http://localhost:3001',
      channel: (process.env.NEXT_PUBLIC_REGISTRY_CHANNEL as 'stable' | 'beta') || 'stable',
      network: (process.env.NEXT_PUBLIC_NETWORK as 'devnet' | 'testnet' | 'mainnet') || 'devnet',
      app: {
        name: 'CantonConnect Demo Debug',
        origin: window.location.origin,
      },
    });

    const clientInternal = cantonClient as unknown as {
      registerAdapter: (adapter: unknown) => void;
    };
    clientInternal.registerAdapter(new ConsoleAdapter());
    clientInternal.registerAdapter(new LoopAdapter());

    setClient(cantonClient);

    return () => {
      cantonClient.destroy();
    };
  }, []);

  if (!client) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>Debug Page</h1>
        <p>Initializing...</p>
      </div>
    );
  }

  return (
    <CantonConnectProvider client={client}>
      <DebugPageContent />
    </CantonConnectProvider>
  );
}

export default function DebugPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>Debug Page</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return <DebugPageWrapper />;
}
