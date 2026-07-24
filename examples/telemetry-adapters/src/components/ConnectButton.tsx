/**
 * Minimal connect control. Opens the wallet picker; the connect itself flows through
 * the client, so its lifecycle events reach the telemetry adapters like every other
 * event. Kept intentionally small: this is a reference, not a product.
 */
import { useState } from 'react';
import { WalletModal, useConnect } from '@partylayer/react';

export function ConnectButton() {
  const { isConnecting } = useConnect();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <WalletModal isOpen={isOpen} onClose={() => setIsOpen(false)} onConnect={() => setIsOpen(false)} />
      <button className="button primary" onClick={() => setIsOpen(true)} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    </div>
  );
}

export default ConnectButton;
