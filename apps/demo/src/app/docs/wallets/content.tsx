'use client';

import { useDocs } from '../layout';

export default function WalletsPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PropsTable, Callout, PrevNext, Strong, UL, LI } = useDocs();

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

      <H2 id="capability-matrix">Capability Matrix</H2>
      <P>
        Not every wallet supports every operation. Check this matrix before building features
        that depend on specific capabilities.
      </P>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 14,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Wallet', 'connect', 'signMessage', 'signTransaction', 'submitTransaction', 'ledgerApi', 'restore'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Console', connect: true, signMessage: true, signTransaction: true, submitTransaction: true, ledgerApi: 'full', restore: true },
              { name: '5N Loop', connect: true, signMessage: true, signTransaction: false, submitTransaction: true, ledgerApi: 'limited', restore: true },
              { name: 'Cantor8', connect: true, signMessage: true, signTransaction: true, submitTransaction: false, ledgerApi: 'none', restore: true },
              { name: 'Nightly', connect: true, signMessage: true, signTransaction: true, submitTransaction: true, ledgerApi: 'full', restore: true },
              { name: 'Bron', connect: true, signMessage: true, signTransaction: true, submitTransaction: true, ledgerApi: 'full', restore: true },
            ].map(w => (
              <tr key={w.name} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0B0F1A' }}>{w.name}</td>
                {['connect', 'signMessage', 'signTransaction', 'submitTransaction'].map(cap => {
                  const val = w[cap as keyof typeof w] as boolean;
                  return (
                    <td key={cap} style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {val ? <span title="Supported" style={{ color: '#166534' }}>{'supported'}</span> : <span title="Not supported" style={{ color: '#991B1B' }}>{'none'}</span>}
                    </td>
                  );
                })}
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  {w.ledgerApi === 'full' && <span style={{ color: '#166534' }}>{'full'}</span>}
                  {w.ledgerApi === 'limited' && <span style={{ color: '#92400E' }}>{'limited'}</span>}
                  {w.ledgerApi === 'none' && <span style={{ color: '#991B1B' }}>{'none'}</span>}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  {w.restore ? <span style={{ color: '#166534' }}>{'supported'}</span> : <span style={{ color: '#991B1B' }}>{'none'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H3 id="capability-notes">Capability Notes</H3>
      <UL>
        <LI><Strong>Loop — signTransaction:</Strong> Loop SDK combines signing and submission into a single step.
          Use <Code>{'submitTransaction'}</Code> directly instead of the separate sign-then-submit pattern.</LI>
        <LI><Strong>Loop — ledgerApi (limited):</Strong> Supports <Code>{'POST /v2/state/acs'}</Code>,{' '}
          <Code>{'GET /v2/state/acs/active-contracts'}</Code>, <Code>{'POST /v2/commands/submit'}</Code>,{' '}
          and <Code>{'POST /v2/commands/submit-and-wait'}</Code>. Other endpoints are not available —
          for full Ledger API access, use Console, Nightly, or Bron.</LI>
        <LI><Strong>Cantor8:</Strong> Mobile-only deep link transport. Supports <Code>{'signMessage'}</Code>{' '}
          and <Code>{'signTransaction'}</Code> via the deep link flow, but does not expose{' '}
          <Code>{'submitTransaction'}</Code> or <Code>{'ledgerApi'}</Code>.</LI>
        <LI><Strong>Bron:</Strong> Enterprise wallet with full capabilities. Requires explicit OAuth configuration
          via <Code>{'BronAdapter'}</Code> with a <Code>{'clientId'}</Code>.</LI>
        <LI><Strong>Session restore (all five wallets):</Strong> every adapter declares the{' '}
          <Code>{'restore'}</Code> capability and implements a matching{' '}
          <Code>{'restore()'}</Code> method. On page reload, the SDK decrypts the persisted
          session and hands it to the adapter, which re-establishes the provider if it can.
          See <a href="/docs/advanced#session-persistence" style={{ color: '#E6B800' }}>
            Advanced → Session Persistence
          </a> for per-wallet behavior and edge cases.</LI>
      </UL>

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
