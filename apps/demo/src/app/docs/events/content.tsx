'use client';

import { useDocs } from '../layout';

export default function EventsPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PrevNext, UL, OL, LI, Strong, HR } = useDocs();

  return (
    <>
      <H1>Event Spec</H1>
      <P>This document defines the event payloads emitted by PartyLayer SDK.</P>

      <H2 id="event-system-overview">Event System Overview</H2>
      <P>PartyLayer uses a typed event system for state changes:</P>
      <CodeBlock language="ts">{`client.on('session:connected', (event) => {
  console.log('Connected:', event.session.partyId);
});

// Unsubscribe
const unsubscribe = client.on('error', handler);
unsubscribe();`}</CodeBlock>

      <HR />

      <H2 id="event-types">Event Types</H2>

      <H3>session:connected</H3>
      <P>Emitted when a wallet connection is established (new or restored).</P>
      <CodeBlock language="ts">{`interface SessionConnectedEvent {
  type: 'session:connected';
  session: Session;
}

interface Session {
  sessionId: SessionId;
  walletId: WalletId;
  partyId: PartyId;
  network: NetworkId;
  createdAt: number;          // Unix timestamp (ms)
  expiresAt?: number;         // Unix timestamp (ms), optional
  origin: string;             // Origin that created session
  capabilitiesSnapshot: CapabilityKey[];
  metadata?: Record<string, string>;
}`}</CodeBlock>
      <P><Strong>Triggered by:</Strong></P>
      <UL>
        <LI><Code>{'client.connect()'}</Code> success</LI>
        <LI>Session restore on SDK initialization</LI>
      </UL>
      <P><Strong>Metrics mapping:</Strong></P>
      <UL>
        <LI><Code>{'wallet_connect_success'}</Code> +1</LI>
        <LI><Code>{'sessions_created'}</Code> +1 (new connection only)</LI>
        <LI><Code>{'sessions_restored'}</Code> +1 (restore only)</LI>
      </UL>

      <HR />

      <H3>session:disconnected</H3>
      <P>Emitted when a wallet is disconnected.</P>
      <CodeBlock language="ts">{`interface SessionDisconnectedEvent {
  type: 'session:disconnected';
  sessionId: SessionId;
}`}</CodeBlock>
      <P><Strong>Triggered by:</Strong></P>
      <UL>
        <LI><Code>{'client.disconnect()'}</Code> call</LI>
      </UL>
      <P><Strong>Metrics mapping:</Strong></P>
      <UL>
        <LI>No direct metric (tracked as session lifecycle)</LI>
      </UL>

      <HR />

      <H3>session:expired</H3>
      <P>Emitted when a session expires.</P>
      <CodeBlock language="ts">{`interface SessionExpiredEvent {
  type: 'session:expired';
  sessionId: SessionId;
}`}</CodeBlock>
      <P><Strong>Triggered by:</Strong></P>
      <UL>
        <LI>Session expiration check in <Code>{'getActiveSession()'}</Code></LI>
        <LI>Failed session restore</LI>
      </UL>
      <P><Strong>Metrics mapping:</Strong></P>
      <UL>
        <LI>No direct metric (tracked as session lifecycle)</LI>
      </UL>

      <HR />

      <H3>tx:status</H3>
      <P>Emitted when transaction status changes.</P>
      <CodeBlock language="ts">{`interface TxStatusEvent {
  type: 'tx:status';
  sessionId: SessionId;
  txId: TransactionHash;
  status: TransactionStatus;
  raw?: unknown;
}

type TransactionStatus = 'pending' | 'submitted' | 'committed' | 'rejected' | 'failed';`}</CodeBlock>
      <P><Strong>Triggered by:</Strong></P>
      <UL>
        <LI><Code>{'client.signTransaction()'}</Code> → status: {"'"}pending{"'"}</LI>
        <LI><Code>{'client.submitTransaction()'}</Code> → status: {"'"}submitted{"'"}</LI>
      </UL>
      <P><Strong>Metrics mapping:</Strong></P>
      <UL>
        <LI>No direct metric (transaction counts not tracked for privacy)</LI>
      </UL>

      <HR />

      <H3>registry:status</H3>
      <P>Emitted when registry status changes.</P>
      <CodeBlock language="ts">{`interface RegistryStatusEvent {
  type: 'registry:status';
  status: RegistryStatus;
}

interface RegistryStatus {
  source: 'network' | 'cache';
  verified: boolean;
  channel: 'stable' | 'beta';
  sequence: number;
  stale: boolean;
  fetchedAt: number;
  etag?: string;
  error?: PartyLayerError;
}`}</CodeBlock>
      <P><Strong>Triggered by:</Strong></P>
      <UL>
        <LI>SDK initialization</LI>
        <LI><Code>{'client.listWallets()'}</Code> call</LI>
        <LI>Registry fetch success/failure</LI>
      </UL>
      <P><Strong>Metrics mapping:</Strong></P>
      <UL>
        <LI><Code>{'registry_fetch'}</Code> +1 (when source: {"'"}network{"'"})</LI>
        <LI><Code>{'registry_cache_hit'}</Code> +1 (when source: {"'"}cache{"'"})</LI>
        <LI><Code>{'registry_stale'}</Code> +1 (when stale: true)</LI>
      </UL>

      <HR />

      <H3>error</H3>
      <P>Emitted when an error occurs during any operation.</P>
      <CodeBlock language="ts">{`interface ErrorEvent {
  type: 'error';
  error: PartyLayerError;
}

interface PartyLayerError extends Error {
  code: ErrorCode;
  cause?: unknown;
  details?: Record<string, unknown>;
  isOperational: boolean;
}`}</CodeBlock>
      <P><Strong>Triggered by:</Strong></P>
      <UL>
        <LI>Any SDK operation failure</LI>
      </UL>
      <P><Strong>Metrics mapping:</Strong></P>
      <UL>
        <LI><Code>{'error_<code>'}</Code> +1 (e.g., <Code>{'error_USER_REJECTED'}</Code>)</LI>
      </UL>

      <HR />

      <H3>session:networkMismatch</H3>
      <P>
        Emitted when the connected wallet{"'"}s effective network differs from the dApp{"'"}s configured
        network. Emitted under all policies (informational); <Code>{'enforced'}</Code> is true when the
        active policy (<Code>{'guard'}</Code> or <Code>{'strict'}</Code>) will block.
      </P>
      <CodeBlock language="ts">{`interface SessionNetworkMismatchEvent {
  type: 'session:networkMismatch';
  sessionId: SessionId;
  expected: string; // dApp-configured network, CAIP-2 normalized
  actual: string;   // wallet-reported network, CAIP-2 normalized
  enforced: boolean; // true under guard|strict, false under off
}`}</CodeBlock>
      <P><Strong>Triggered by:</Strong></P>
      <UL>
        <LI>A network mismatch detected at connect or restore time</LI>
      </UL>
      <P><Strong>Metrics mapping:</Strong></P>
      <UL>
        <LI>No direct metric</LI>
      </UL>

      <HR />

      <H3>wallets:changed</H3>
      <P>
        Emitted when the available wallet list changes, currently only from late or inject-time
        announce discovery.
      </P>
      <CodeBlock language="ts">{`interface WalletsChangedEvent {
  type: 'wallets:changed';
  reason: 'announced';
}`}</CodeBlock>
      <P><Strong>Triggered by:</Strong></P>
      <UL>
        <LI>A <Code>{'canton:announceProvider'}</Code> wallet appearing after the initial list was built</LI>
      </UL>
      <P><Strong>Metrics mapping:</Strong></P>
      <UL>
        <LI>No direct metric</LI>
      </UL>

      <HR />

      <H2 id="event-metric-mapping-table">Event → Metric Mapping Table</H2>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Event', 'Condition', 'Metric'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { event: 'session:connected', condition: 'Always', metric: 'wallet_connect_success' },
              { event: 'session:connected', condition: 'New connection', metric: 'sessions_created' },
              { event: 'session:connected', condition: 'Restore', metric: 'sessions_restored' },
              { event: 'registry:status', condition: "source='network'", metric: 'registry_fetch' },
              { event: 'registry:status', condition: "source='cache'", metric: 'registry_cache_hit' },
              { event: 'registry:status', condition: 'stale=true', metric: 'registry_stale' },
              { event: 'error', condition: 'Always', metric: 'error_<code>' },
              { event: 'connect() call', condition: 'Always', metric: 'wallet_connect_attempts' },
              { event: 'restore() call', condition: 'Always', metric: 'restore_attempts' },
            ].map(r => (
              <tr key={r.metric} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{r.event}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{r.condition}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.metric}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HR />

      <H2 id="event-telemetry-bridge">Event telemetry bridge</H2>
      <P>
        Separately from the increment-based metrics above, every emitted event is forwarded once
        to the configured telemetry adapter through <Code>{'track(name, properties)'}</Code>, from
        a single central path in the client. The telemetry name is the event{"'"}s own{' '}
        <Code>{'type'}</Code> string. This is additive: the increment metrics are unchanged, and
        when no telemetry adapter is configured the bridge is a no-op.
      </P>
      <P>
        Only privacy-safe, non-identifying properties are sent. Session ids, party ids, transaction
        hashes, origins, and raw wallet payloads are never included; where an event{"'"}s only
        distinguishing field is such an identifier, the property set is empty and the event count
        itself is the signal.
      </P>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Event', 'Telemetry properties'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { event: 'session:connected', props: <><Code>{'walletId'}</Code>, <Code>{'network'}</Code></> },
              { event: 'session:disconnected', props: '(none)' },
              { event: 'session:expired', props: '(none)' },
              { event: 'session:networkMismatch', props: <><Code>{'expected'}</Code>, <Code>{'actual'}</Code>, <Code>{'enforced'}</Code></> },
              { event: 'tx:status', props: <Code>{'status'}</Code> },
              { event: 'registry:status', props: <><Code>{'source'}</Code>, <Code>{'channel'}</Code>, <Code>{'verified'}</Code>, <Code>{'stale'}</Code>, <Code>{'sequence'}</Code></> },
              { event: 'registry:updated', props: <><Code>{'channel'}</Code>, <Code>{'version'}</Code></> },
              { event: 'error', props: <><Code>{'code'}</Code> (when the error carries one)</> },
              { event: 'wallets:changed', props: <Code>{'reason'}</Code> },
            ].map(r => (
              <tr key={r.event} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{r.event}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{r.props}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HR />

      <H2 id="privacy-guarantees">Privacy Guarantees</H2>
      <P>Event payloads are designed to be privacy-safe:</P>

      <H3>Never Included in Events</H3>
      <UL>
        <LI>Wallet addresses</LI>
        <LI>Raw party IDs in external payloads</LI>
        <LI>Transaction payloads</LI>
        <LI>Signed message content</LI>
        <LI>User identifiers</LI>
      </UL>

      <H3>Included (Safe)</H3>
      <UL>
        <LI>Session IDs (random, not user-identifiable)</LI>
        <LI>Wallet IDs (e.g., {"'"}console{"'"}, {"'"}loop{"'"})</LI>
        <LI>Network names (e.g., {"'"}devnet{"'"}, {"'"}mainnet{"'"})</LI>
        <LI>Error codes (generic categories)</LI>
        <LI>Timestamps</LI>
      </UL>

      <H3>Opt-in (Hashed)</H3>
      <UL>
        <LI>App identifier (SHA-256 hashed)</LI>
        <LI>Origin (SHA-256 hashed, if enabled)</LI>
      </UL>

      <HR />

      <H2 id="subscribing-to-events">Subscribing to Events</H2>

      <H3>Basic Usage</H3>
      <CodeBlock language="ts">{`// Subscribe
client.on('session:connected', (event) => {
  console.log('Connected:', event.session.partyId);
});

// Subscribe with unsubscribe
const unsubscribe = client.on('error', (event) => {
  console.error('Error:', event.error.code);
});

// Later: unsubscribe
unsubscribe();`}</CodeBlock>

      <H3>React Integration</H3>
      <CodeBlock language="ts">{`function MyComponent() {
  const client = usePartyLayer();

  useEffect(() => {
    const unsubscribe = client.on('session:expired', () => {
      // Handle expiration
    });
    return unsubscribe;
  }, [client]);
}`}</CodeBlock>

      <H3>Multiple Event Types</H3>
      <CodeBlock language="ts">{`// Each event type has its own handler
client.on('session:connected', handleConnect);
client.on('session:disconnected', handleDisconnect);
client.on('error', handleError);`}</CodeBlock>

      <HR />

      <H2 id="event-handler-best-practices">Event Handler Best Practices</H2>
      <OL>
        <LI><Strong>Keep handlers fast</Strong>, Don{"'"}t block on async operations</LI>
        <LI><Strong>Handle errors</Strong>, Wrap handlers in try-catch</LI>
        <LI><Strong>Clean up</Strong>, Always unsubscribe when component unmounts</LI>
        <LI><Strong>Type safety</Strong>, Use TypeScript for event payload types</LI>
      </OL>
      <CodeBlock language="ts">{`// Good
client.on('error', (event) => {
  try {
    logError(event.error);
  } catch (e) {
    console.error('Handler failed:', e);
  }
});

// Bad - blocks event loop
client.on('session:connected', async (event) => {
  await longRunningOperation(); // Don't do this
});`}</CodeBlock>

      <HR />

      <H2 id="event-phase-mapping">Event to lifecycle phase mapping</H2>
      <P>
        The observability deliverable names six lifecycle phases: connect, authorize, prepare,
        submit, confirm, and error. The shipped SDK does not emit six phase named events. It emits
        the nine domain events above on the <Code>{'PartyLayerEvent'}</Code> union, and the phases
        are a reading of those events, not a separate event set. This table is the mapping, so an
        operator instrumenting by phase knows which event to watch.
      </P>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Shipped event', 'Lifecycle phase', 'Mapping'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { event: 'session:connected', phase: 'connect', mapping: 'The terminal event of a connect: a wallet session is established.' },
              { event: 'session:disconnected', phase: 'connect', mapping: 'The connect teardown, the inverse of a connect.' },
              { event: 'wallets:changed', phase: 'connect', mapping: 'A pre connect discovery signal: the listable wallet set changed, so the picker re reads before a connect.' },
              { event: 'registry:updated', phase: 'connect', mapping: 'Setup within connect: a new registry channel or version loaded before wallets are listed.' },
              { event: 'registry:status', phase: 'connect', mapping: 'Setup and health within connect: fetch source, verification, and staleness. Its error field feeds the error phase when set.' },
              { event: 'tx:status', phase: 'prepare, submit, confirm', mapping: 'The single transaction lifecycle event. Its status field is the phase: pending or prepared is prepare, submitted is submit, committed is confirm.' },
              { event: 'session:expired', phase: 'error', mapping: 'An error class condition: the session is no longer valid and the dApp must reconnect.' },
              { event: 'session:networkMismatch', phase: 'error', mapping: 'An error class condition: the wallet is on the wrong network, enforced under the guard or strict policy.' },
              { event: 'error', phase: 'error', mapping: 'The dedicated error phase event.' },
            ].map(r => (
              <tr key={r.event + r.phase} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{r.event}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{r.phase}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{r.mapping}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>
        <Strong>Phases with no dedicated event.</Strong> Three of the six phases have no event of
        their own. They are covered by an existing event, by design.
      </P>
      <UL>
        <LI><Strong>authorize</Strong> is covered by <Code>{'session:connected'}</Code>. CIP-0103 folds authorization into the connect grant: the wallet{"'"}s approval to connect is the authorization, so there is no separate authorize step or event.</LI>
        <LI><Strong>prepare</Strong>, <Strong>submit</Strong>, and <Strong>confirm</Strong> are covered by <Code>{'tx:status'}</Code>. The kit models the transaction lifecycle as one event whose <Code>{'status'}</Code> field moves through prepared, submitted, and committed, rather than three separately named events.</LI>
      </UL>

      <PrevNext />
    </>
  );
}
