'use client';

import { useDocs } from '../layout';

export default function WalletsPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PropsTable, Callout, PrevNext, Strong } = useDocs();

  return (
    <>
      <H1>Wallets & Adapters</H1>
      <P>
        PartyLayer includes 5 built-in wallet adapters and supports custom adapters for any Canton wallet.
        Wallets are discovered through the registry and CIP-0103 native provider detection.
      </P>

      <H2 id="built-in-wallets">Built-in Wallets</H2>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 14,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Wallet', 'Transport', 'Detection', 'Auto-registered'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Console Wallet', transport: 'PostMessage / QR / Deep Link', detection: 'Extension + mobile', auto: 'Yes' },
              { name: '5N Loop', transport: 'QR Code / Popup', detection: 'Mobile / Web app', auto: 'Yes' },
              { name: 'Cantor8 (C8)', transport: 'Deep Link', detection: 'Browser extension', auto: 'Yes' },
              { name: 'Nightly', transport: 'Injected', detection: 'window.nightly.canton', auto: 'Yes' },
              { name: 'Bron', transport: 'OAuth', detection: 'Enterprise config', auto: 'No' },
            ].map(w => (
              <tr key={w.name} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0B0F1A' }}>{w.name}</td>
                <td style={{ padding: '10px 14px', color: '#64748B' }}>{w.transport}</td>
                <td style={{ padding: '10px 14px', color: '#64748B', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}>{w.detection}</td>
                <td style={{ padding: '10px 14px', color: w.auto === 'Yes' ? '#166534' : '#92400E', fontWeight: 500 }}>{w.auto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout type="note">
        All wallets except <Strong>Bron</Strong> are auto-registered when using <Code>{'PartyLayerKit'}</Code>.
        Bron requires explicit configuration because it needs an OAuth client ID.
      </Callout>

      <H2 id="adding-bron">Adding Bron (Enterprise)</H2>
      <CodeBlock language="tsx">{`import { PartyLayerKit } from '@partylayer/react';
import { getBuiltinAdapters } from '@partylayer/sdk';
import { BronAdapter } from '@partylayer/adapter-bron';

<PartyLayerKit
  network="mainnet"
  appName="My dApp"
  adapters={[
    ...getBuiltinAdapters(),
    new BronAdapter({
      clientId: 'your-oauth-client-id',
      // Optional: custom OAuth redirect URI
      // redirectUri: 'https://my-app.com/callback',
    }),
  ]}
>`}</CodeBlock>

      <H2 id="discovery">Wallet Discovery</H2>
      <P>
        PartyLayer discovers wallets through two mechanisms:
      </P>

      <H3>1. Registry Discovery</H3>
      <P>
        On initialization, the SDK fetches the wallet registry from <Code>{'registry.partylayer.xyz'}</Code>.
        The registry contains verified wallet metadata — names, icons, capabilities, install hints,
        and supported networks. Registry entries are cryptographically signed.
      </P>
      <P>
        If the registry is unreachable, the SDK gracefully falls back to adapter-only discovery,
        ensuring your dApp still works offline.
      </P>

      <H3>2. CIP-0103 Native Detection</H3>
      <P>
        The SDK scans <Code>{'window.canton.*'}</Code> for CIP-0103 compliant providers injected by
        wallet extensions. Native wallets appear first in the wallet list with a "Native" badge.
      </P>
      <CodeBlock language="typescript">{`// What the SDK does internally:
import { discoverInjectedProviders } from '@partylayer/provider';

const providers = discoverInjectedProviders();
// → [{ id: 'console', provider: CIP0103Provider }, ...]`}</CodeBlock>

      <H2 id="builtin-adapters-function">getBuiltinAdapters</H2>
      <P>
        Returns all auto-registered adapters (Console, Loop, Cantor8, Nightly):
      </P>
      <CodeBlock language="typescript">{`import { getBuiltinAdapters } from '@partylayer/sdk';

const adapters = getBuiltinAdapters();
// → [ConsoleAdapter, LoopAdapter, Cantor8Adapter, NightlyAdapter]`}</CodeBlock>

      <H2 id="custom-adapter">Creating a Custom Adapter</H2>
      <P>
        To support a new wallet, implement the <Code>{'WalletAdapter'}</Code> interface:
      </P>
      <CodeBlock language="typescript">{`import type {
  WalletAdapter, AdapterContext, AdapterDetectResult,
  AdapterConnectResult, Session, SignMessageParams,
  SignTransactionParams, SubmitTransactionParams,
} from '@partylayer/core';

class MyWalletAdapter implements WalletAdapter {
  readonly walletId = 'my-wallet' as WalletId;
  readonly name = 'My Custom Wallet';

  getCapabilities() {
    return ['connect', 'disconnect', 'signMessage', 'signTransaction'];
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    const installed = typeof window !== 'undefined' && !!window.myWallet;
    return { installed, reason: installed ? undefined : 'Extension not found' };
  }

  async connect(ctx: AdapterContext, opts?: { timeoutMs?: number }): Promise<AdapterConnectResult> {
    const result = await window.myWallet.connect({
      appName: ctx.appName,
      network: ctx.network,
    });
    return {
      partyId: result.partyId,
      session: { metadata: result.metadata },
      capabilities: this.getCapabilities(),
    };
  }

  async disconnect(ctx: AdapterContext, session: Session): Promise<void> {
    await window.myWallet.disconnect();
  }

  async signMessage(ctx: AdapterContext, session: Session, params: SignMessageParams) {
    const sig = await window.myWallet.sign(params.message);
    return {
      signature: sig,
      partyId: session.partyId,
      message: params.message,
    };
  }

  async signTransaction(ctx: AdapterContext, session: Session, params: SignTransactionParams) {
    const result = await window.myWallet.signTx(params.tx);
    return {
      signedTx: result.signedPayload,
      transactionHash: result.txHash,
      partyId: session.partyId,
    };
  }
}`}</CodeBlock>

      <H2 id="register-adapter">Registering at Runtime</H2>
      <P>
        Register adapters at runtime using the client{"'"}s <Code>{'registerAdapter'}</Code> method:
      </P>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'mainnet', app: { name: 'My dApp' } });

// Register your custom adapter
client.registerAdapter(new MyWalletAdapter());

// Now it appears in listWallets()
const wallets = await client.listWallets();`}</CodeBlock>

      <H2 id="adapter-interface">WalletAdapter Interface</H2>
      <PropsTable data={[
        { prop: 'walletId', type: 'readonly WalletId', description: 'Unique wallet identifier.' },
        { prop: 'name', type: 'readonly string', description: 'Human-readable wallet name.' },
        { prop: 'getCapabilities()', type: '() => CapabilityKey[]', description: 'Return supported capabilities.' },
        { prop: 'detectInstalled()', type: '() => Promise<AdapterDetectResult>', description: 'Check if wallet is installed. Returns { installed, reason? }.' },
        { prop: 'connect()', type: '(ctx, opts?) => Promise<AdapterConnectResult>', description: 'Establish wallet connection. Returns { partyId, session, capabilities }.' },
        { prop: 'disconnect()', type: '(ctx, session) => Promise<void>', description: 'Close connection. Required.' },
        { prop: 'restore?()', type: '(ctx, persisted) => Promise<Session | null>', default: 'optional', description: 'Restore a persisted session.' },
        { prop: 'signMessage?()', type: '(ctx, session, params) => Promise<SignedMessage>', default: 'optional', description: 'Sign arbitrary message.' },
        { prop: 'signTransaction?()', type: '(ctx, session, params) => Promise<SignedTransaction>', default: 'optional', description: 'Sign transaction.' },
        { prop: 'submitTransaction?()', type: '(ctx, session, params) => Promise<TxReceipt>', default: 'optional', description: 'Sign and submit transaction.' },
        { prop: 'ledgerApi?()', type: '(ctx, session, params) => Promise<LedgerApiResult>', default: 'optional', description: 'Proxy a JSON Ledger API request.' },
      ]} />

      <PrevNext />
    </>
  );
}
