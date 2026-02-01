import { useEffect, useState } from 'react';
import { PartyLayerProvider } from '@partylayer/react';
import { createClient } from './partylayer';
import type { PartyLayerClient } from '@partylayer/sdk';
import ConnectButton from './components/ConnectButton';
import SessionInfo from './components/SessionInfo';
import RegistryStatus from './components/RegistryStatus';
import ErrorPanel from './components/ErrorPanel';
import EventLog from './components/EventLog';
import './App.css';

function App() {
  const [client, setClient] = useState<PartyLayerClient | null>(null);

  useEffect(() => {
    // Initialize client only on client side
    if (typeof window !== 'undefined') {
      const cantonClient = createClient();
      setClient(cantonClient);

      // Cleanup on unmount
      return () => {
        cantonClient.destroy();
      };
    }
  }, []);

  if (!client) {
    return (
      <div className="app">
        <div className="loading">Initializing PartyLayer...</div>
      </div>
    );
  }

  return (
    <PartyLayerProvider client={client}>
      <div className="app">
        <header className="app-header">
          <h1>PartyLayer Test DApp</h1>
          <p>Minimal integration example using public API</p>
        </header>

        <main className="app-main">
          <div className="panel">
            <h2>Connect Wallet</h2>
            <ConnectButton />
          </div>

          <SessionInfo />

          <RegistryStatus />

          <ErrorPanel />

          <EventLog />
        </main>
      </div>
    </PartyLayerProvider>
  );
}

export default App;
