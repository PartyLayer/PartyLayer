import { useState } from 'react';
import { WalletModal, useConnect } from '@cantonconnect/react';
import './ConnectButton.css';

function ConnectButton() {
  const { isConnecting } = useConnect();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConnect = () => {
    setIsModalOpen(true);
  };

  const handleWalletConnected = (sessionId: string) => {
    // Wallet connected successfully - modal will close automatically
    console.log('Wallet connected:', sessionId);
  };

  return (
    <div className="connect-button-container">
      <WalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleWalletConnected}
      />
      <button
        className="button primary"
        onClick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    </div>
  );
}

export default ConnectButton;
