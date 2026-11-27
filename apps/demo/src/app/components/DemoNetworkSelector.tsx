'use client';

import { useEffect, useState, type CSSProperties } from 'react';

const networks = {
  devnet: 'Devnet',
  testnet: 'Testnet',
  mainnet: 'Mainnet',
} as const;

export type DemoNetwork = keyof typeof networks;

function isDemoNetwork(value: string | null): value is DemoNetwork {
  return value !== null && Object.hasOwn(networks, value);
}

export function useDemoNetwork() {
  const [network, setNetwork] = useState<DemoNetwork>('devnet');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('network');
    if (isDemoNetwork(requested)) setNetwork(requested);
  }, []);

  function selectNetwork(next: DemoNetwork) {
    setNetwork(next);
    const url = new URL(window.location.href);
    url.searchParams.set('network', next);
    window.history.replaceState(window.history.state, '', url);
  }

  return [network, selectNetwork] as const;
}

export function DemoNetworkSelector({
  network,
  onChange,
  style,
}: {
  network: DemoNetwork;
  onChange: (network: DemoNetwork) => void;
  style?: CSSProperties;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Network</span>
      <select
        aria-label="Canton network"
        value={network}
        onChange={(event) => {
          const requested = event.currentTarget.value;
          if (isDemoNetwork(requested)) onChange(requested);
        }}
        style={{
          color: 'inherit', background: '#fff', border: '1px solid rgba(15,23,42,0.18)',
          borderRadius: 8, minHeight: 36, padding: '4px 8px', font: 'inherit', fontSize: 14,
          ...style,
        }}
      >
        {Object.entries(networks).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select>
    </label>
  );
}
