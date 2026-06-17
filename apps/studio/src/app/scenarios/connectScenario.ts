// S8.2 — the first runnable scenario: connect-only, via the inlined CIP-0103
// mock wallet. Runs published @partylayer/react + @partylayer/sdk inside the
// Sandpack iframe; the mock injects window.canton.demoWallet before React mounts
// so connect() resolves deterministically with no real extension.
import { MOCK_WALLET } from './mockWallet';

/** The visible, read-only example (what the code view shows). */
export const CONNECT_APP_CODE = `import {
  PartyLayerKit,
  useWallets,
  useConnect,
  useClientSession,
} from '@partylayer/react';

function Demo() {
  const { wallets } = useWallets();
  const { connect, isConnecting } = useConnect();
  const session = useClientSession();

  // The injected mock "Canton Demo Wallet" shows up in the live wallet list.
  const demo =
    wallets.find((w) => w.name.toLowerCase().includes('demo')) ?? wallets[0];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, lineHeight: 1.5 }}>
      <h2 style={{ margin: '0 0 12px' }}>Connect a wallet</h2>

      {session ? (
        <p>
          ✅ Connected — partyId:{' '}
          <code style={{ background: '#f1f1f4', padding: '2px 6px', borderRadius: 6 }}>
            {String(session.partyId)}
          </code>
        </p>
      ) : (
        <button
          onClick={() => demo && connect({ walletId: demo.walletId })}
          disabled={isConnecting || !demo}
          style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          {isConnecting ? 'Connecting…' : 'Connect ' + (demo ? demo.name : '…')}
        </button>
      )}

      <p style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>Discovered wallets:</p>
      <ul style={{ fontSize: 13, color: '#374151' }}>
        {wallets.map((w) => (
          <li key={String(w.walletId)}>{w.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <PartyLayerKit network="devnet" appName="PartyLayer Studio">
      <Demo />
    </PartyLayerKit>
  );
}
`;

/** Sandpack index.html — injects the mock wallet BEFORE the React bundle mounts. */
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PartyLayer Studio — Connect</title>
    <!-- CIP-0103 mock wallet, injected before React hydrates (mirrors a real
         extension's content-script timing) → window.canton.demoWallet. -->
    <script src="/mock-cip0103-wallet.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

/** Published versions Sandpack's bundler resolves (Send-on-generic-path migration shipped). */
export const connectScenario = {
  title: 'Connect a wallet',
  files: {
    '/App.tsx': { code: CONNECT_APP_CODE, active: true },
    '/public/index.html': { code: INDEX_HTML, hidden: true },
    '/public/mock-cip0103-wallet.js': { code: MOCK_WALLET, hidden: true },
  },
  dependencies: {
    '@partylayer/react': '0.9.4',
    '@partylayer/sdk': '0.13.2',
  },
} as const;
