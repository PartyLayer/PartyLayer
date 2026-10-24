'use client';

import { useDocs } from '../layout';
// Generated from the wallet registry (registry/v1/stable/registry.json) by
// scripts/gen-readme.mjs, `pnpm gate:readme` keeps this in sync. Table 1 below
// renders from it so the built-in wallet list can never drift from the registry.
import { GENERATED_WALLETS } from './wallets.generated';

export default function WalletsPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PropsTable, Callout, PrevNext, Strong, UL, LI, A } = useDocs();

  return (
    <>
      <H1>Wallets & Adapters</H1>
      <P>
        PartyLayer includes built-in wallet adapters and supports custom adapters for any Canton wallet.
        Wallets are discovered through the registry and CIP-0103 native provider detection.
      </P>
      <P>
        The default catalog is included with the kit; no per-wallet installation is required.
        Custom adapters are an advanced extension point. For transports and a page per integration, see the{' '}
        <A href="/wallets">Canton wallet directory</A>.
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
              {['Wallet', 'Networks', 'Opt-in', 'Additional setup'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GENERATED_WALLETS.map(w => (
              <tr key={w.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0B0F1A' }}>{w.name}</td>
                <td style={{ padding: '10px 14px', color: '#64748B' }}>{w.networks.join(', ')}</td>
                <td style={{ padding: '10px 14px', color: w.optIn ? '#92400E' : '#166534', fontWeight: 500 }}>{w.optIn ? 'Yes' : 'No'}</td>
                <td style={{ padding: '10px 14px', color: '#64748B', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}>{w.id === 'walletconnect' ? 'Your project ID' : w.id === 'bron' ? 'Your OAuth/API configuration' : 'Included'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout type="note">
        Wallets marked <Strong>Opt-in</Strong> (<Strong>Bron</Strong>, <Strong>WalletConnect</Strong>) require explicit
        configuration: pass <Code>{'bron'}</Code> for OAuth/API access and <Code>{'walletConnect'}</Code>
        with your Cloud project id. Their runtime dependencies are included. The default catalog
        supplies the other supported wallets for the configured network and channel.
      </Callout>

      <H2 id="capability-matrix">Capability Matrix</H2>
      <P>
        Not every wallet supports every operation. This matrix is generated from the active SDK integrations. Check it before building features
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
            {GENERATED_WALLETS.map(entry => ({ name: entry.name, connect: true, ...entry.capabilities })).map(w => (
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
                  {w.ledgerApi ? <span style={{ color: '#166534' }}>supported</span> : <span style={{ color: '#991B1B' }}>none</span>}
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
        <LI><Strong>Loop / Nightly / Send, signTransaction:</Strong> these wallets combine signing
          and submission into a single step. Use <Code>{'submitTransaction'}</Code> directly instead
          of the separate sign-then-submit pattern. Calling <Code>{'signTransaction'}</Code> on any of
          them throws <Code>{'CapabilityNotSupportedError'}</Code> pointing you at this fix.</LI>
        <LI><Strong>Send:</Strong> the default catalog uses the native announce path.
          It is Mainnet-only in the catalog and requires the wallet&apos;s own login/passkey approval.
          The standalone compatibility adapter has its own provider identity guard; it is not required
          for the default kit. See <A href="/docs/wallets/send">the Send guide</A>.</LI>
        <LI><Strong>Loop, ledgerApi (limited):</Strong> Supports <Code>{'POST /v2/state/acs'}</Code>,{' '}
          <Code>{'GET /v2/state/acs/active-contracts'}</Code>, <Code>{'POST /v2/commands/submit'}</Code>,{' '}
          and <Code>{'POST /v2/commands/submit-and-wait'}</Code>. Other endpoints are not available,
          for broader Ledger API access, check the active capabilities of Nightly or Bron.</LI>
        <LI><Strong>Cantor8:</Strong> hosted popup integration. Use <Code>{'submitTransaction'}</Code>
          for its combined sign-and-execute flow. Separate message signing, transaction signing and
          Ledger API access are not exposed by this integration.</LI>
        <LI><Strong>Bron, submitTransaction:</Strong> Bron is a remote signer (OAuth), it signs commands
          but does not submit them directly to the ledger. Pair{' '}
          <Code>{'signTransaction'}</Code> with your own participant submission, or call{' '}
          <Code>{'ledgerApi'}</Code> against <Code>{'/v2/commands/submit-and-wait'}</Code> and let Bron sign
          the pre-built command. Requires the <Code>{'bron'}</Code> configuration with <Code>{'auth'}</Code> and <Code>{'api'}</Code>.</LI>
        <LI><Strong>Session restore:</Strong> support depends on the wallet and its live authentication.
          A stored PartyLayer session alone does not establish a wallet connection. Official popup
          providers are probed before restoration; OneSwap requires a fresh explicit connection.
          See <a href="/docs/advanced#session-persistence" style={{ color: '#E6B800' }}>
            Advanced → Session Persistence
          </a> for per-wallet behavior.</LI>
      </UL>

      <H2 id="adding-bron">Adding Bron (Enterprise)</H2>
      <CodeBlock language="tsx">{`import { PartyLayerKit, ConnectButton } from '@partylayer/react';

const walletConnect = { projectId: 'your-walletconnect-project-id' };
const bron = {
  auth: {
    clientId: 'your-client-id',
    redirectUri: 'https://your-app.com/auth/callback',
    authorizationUrl: 'https://auth.bron.example/authorize',
    tokenUrl: 'https://auth.bron.example/token',
  },
  api: { baseUrl: 'https://api.bron.example' },
};

<PartyLayerKit network="mainnet" appName="My dApp" walletConnect={walletConnect} bron={bron}>
  <ConnectButton />
</PartyLayerKit>`}</CodeBlock>

      <H2 id="discovery">Wallet Discovery</H2>
      <P>
        PartyLayer discovers wallets through two mechanisms:
      </P>

      <H3>1. Registry Discovery</H3>
      <P>
        On initialization, the SDK fetches the wallet registry from <Code>{'registry.partylayer.xyz'}</Code>.
        The registry contains wallet metadata, names, icons, capabilities, install hints,
        and supported networks. Entries are validated against the registry schema on every build;
        they are not signed today.
      </P>
      <P>
        If the registry is unreachable, the SDK gracefully falls back to adapter-only discovery,
        which can preserve known wallet entries. Hosted-wallet login and ledger access still require their services.
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
        Returns the synchronous legacy subset (Loop, Cantor8, Nightly), not the complete default catalog:
      </P>
      <CodeBlock language="typescript">{`import { getBuiltinAdapters } from '@partylayer/sdk';

const adapters = getBuiltinAdapters();
// → [LoopAdapter, Cantor8Adapter, NightlyAdapter]`}</CodeBlock>

      <H2 id="custom-adapter">Creating a Custom Adapter</H2>
      <P>
        New wallets should follow <A href="/docs/generic-bridge">CIP-0103 Path A or B</A>.
        The following advanced example documents the existing <Code>{'WalletAdapter'}</Code> contract
        for application-owned integrations and test fixtures:
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
