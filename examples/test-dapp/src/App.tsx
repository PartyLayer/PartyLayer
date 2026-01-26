import { useEffect, useState } from 'react';
import { CantonConnectProvider } from '@cantonconnect/react';
import { createClient } from './cantonconnect';
import type { CantonConnectClient } from '@cantonconnect/sdk';
import ConnectButton from './components/ConnectButton';
import SessionInfo from './components/SessionInfo';
import RegistryStatus from './components/RegistryStatus';
import ErrorPanel from './components/ErrorPanel';
import EventLog from './components/EventLog';
import './App.css';

function App() {
  const [client, setClient] = useState<CantonConnectClient | null>(null);

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
        <div className="loading">Initializing CantonConnect...</div>
      </div>
    );
  }

  return (
    <CantonConnectProvider client={client}>
      <div className="app">
        <header className="app-header">
          <h1>CantonConnect Test DApp</h1>
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
    </CantonConnectProvider>
  );
}

export default App;
