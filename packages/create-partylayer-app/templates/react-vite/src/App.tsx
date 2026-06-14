import { PartyLayerKit, ConnectButton, useAccount, truncatePartyId } from '@partylayer/react';
import './App.css';

/**
 * <PartyLayerKit> is the zero-config wrapper: pass `network` + `appName` and it
 * creates the PartyLayer client, registers all built-in wallet adapters, and
 * provides the session context. <ConnectButton> renders the full connect flow
 * (wallet modal → connected state) on its own.
 */
export default function App() {
  return (
    <PartyLayerKit network="devnet" appName="{{PROJECT_NAME}}">
      <main className="app">
        <h1>{{PROJECT_NAME}}</h1>
        <p className="subtitle">A PartyLayer dApp on Canton — connect any verified wallet.</p>
        <ConnectButton />
        <SessionPanel />
      </main>
    </PartyLayerKit>
  );
}

/** Reads the active session and shows the connected party id. */
function SessionPanel() {
  const { address, isConnected } = useAccount();
  if (!isConnected || !address) return null;
  return (
    <p className="session">
      Connected as <code>{truncatePartyId(address)}</code>
    </p>
  );
}
