/**
 * Telemetry adapters example.
 *
 * Wires a PartyLayer client with two reference telemetry adapters fanned together,
 * then shows the console adapter's records flowing in a live table. On load it reads
 * the wallet list once, which produces a registry event, so the table populates even
 * before a wallet connects.
 */
import { useEffect, useMemo, useState } from 'react';
import { PartyLayerProvider } from '@partylayer/react';
import type { PartyLayerClient } from '@partylayer/sdk';
import { createClient } from './partylayer';
import { createConsoleAdapter } from './adapters/consoleAdapter';
import ConnectButton from './components/ConnectButton';
import EventTable from './components/EventTable';
import './App.css';

function App() {
  const adapter = useMemo(() => createConsoleAdapter(), []);
  const [client, setClient] = useState<PartyLayerClient | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const created = createClient(adapter);
    setClient(created);
    // Read the wallet list once so a registry event flows on load.
    created.listWallets().catch(() => {
      // Offline or no registry: the failure still surfaces as a telemetry record.
    });
    return () => created.destroy();
  }, [adapter]);

  if (!client) {
    return (
      <div className="app">
        <div className="muted">Initializing PartyLayer...</div>
      </div>
    );
  }

  return (
    <PartyLayerProvider client={client}>
      <div className="app">
        <header className="app-header">
          <h1>Telemetry adapters</h1>
          <p className="muted">
            Every PartyLayer event reaches the telemetry adapter through one central bridge, with
            privacy-safe properties. The same records also reach the OpenTelemetry adapter, which is a
            no-op until a host registers an OpenTelemetry SDK.
          </p>
        </header>

        <main className="app-main">
          <div className="panel">
            <h2>Connect</h2>
            <ConnectButton />
          </div>

          <EventTable adapter={adapter} />
        </main>
      </div>
    </PartyLayerProvider>
  );
}

export default App;
