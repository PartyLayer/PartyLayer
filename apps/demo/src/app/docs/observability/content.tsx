'use client';

import { useDocs } from '../layout';

const GH = 'https://github.com/PartyLayer/PartyLayer/blob/main';

export default function ObservabilityPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PrevNext, UL, LI, HR, A } = useDocs();

  return (
    <>
      <H1>Observability</H1>
      <P>PartyLayer is vendor neutral about telemetry. It defines a small adapter interface, ships one reference implementation, and forwards every event it emits to whatever adapter you plug in. It never talks to a specific backend, so you choose the vendor and keep the privacy guarantees. This guide covers what exists, how to write an adapter for your vendor, what stays private, how a dApp instruments its own token standard reads and writes, and the current limits stated honestly.</P>

      <HR />

      <H2 id="what-exists">What exists</H2>
      <UL>
        <LI><Code>{'TelemetryAdapter'}</Code> (from <Code>{'@partylayer/core'}</Code>): the vendor-neutral interface every adapter implements.</LI>
        <LI><Code>{'MetricsTelemetryAdapter'}</Code> (from <Code>{'@partylayer/sdk'}</Code>, with <Code>{'createTelemetryAdapter'}</Code>): a privacy-safe reference adapter that buffers canonical metric counters and can post them to a backend.</LI>
        <LI>The canonical metric counters (connect attempts and successes, sessions created and restored, restore attempts, registry fetch and cache and stale, error by code).</LI>
        <LI>The event to track bridge: since it landed, every emitted <Code>{'PartyLayerEvent'}</Code> reaches the adapter{"'"}s <Code>{'track()'}</Code> once, named by its type string, with privacy-safe properties, from one central path in the client.</LI>
      </UL>
      <P>The contracts live in two documents, and this guide does not restate their tables. See <A href="/docs/events">EVENT_SPEC.md</A> for the event payloads, the event to metric mapping, and the Event telemetry bridge property table; see <A href={`${GH}/docs/METRICS.md`}>METRICS.md</A> for the canonical metric names and the Event Track Counters section.</P>

      <HR />

      <H2 id="how-to-write-a-vendor-adapter">How to write a vendor adapter</H2>
      <P>An adapter is an object with two required methods and four optional ones:</P>
      <UL>
        <LI><Code>{'track(event, properties?)'}</Code> (required): a named event with optional properties.</LI>
        <LI><Code>{'error(error, properties?)'}</Code> (required): an error occurrence.</LI>
        <LI><Code>{'increment(metric, value?)'}</Code> (optional): a counter.</LI>
        <LI><Code>{'gauge(metric, value)'}</Code> (optional): a point-in-time value.</LI>
        <LI><Code>{'flush()'}</Code> (optional): push buffered data to the backend.</LI>
        <LI><Code>{'isEnabled()'}</Code> (optional): whether collection is on.</LI>
      </UL>
      <P>The client feature-detects the optional methods, so an adapter that implements only <Code>{'track'}</Code> and <Code>{'error'}</Code> is complete. Map each method onto your vendor{"'"}s primitives. The rows below are a starting point; consult each vendor{"'"}s current API for exact calls.</P>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Method', 'OpenTelemetry', 'Sentry', 'Datadog'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { method: 'track', otel: 'counter add, or span event on the active span', sentry: 'breadcrumb, or a captured message', datadog: 'increment a metric, or submit an event' },
              { method: 'error', otel: 'record the exception on the active span, or an error counter', sentry: 'capture the exception', datadog: 'increment an error metric, or submit an event' },
              { method: 'increment', otel: 'counter add', sentry: 'a metric increment', datadog: 'increment' },
              { method: 'gauge', otel: 'observable gauge', sentry: 'a metric gauge', datadog: 'gauge' },
              { method: 'flush', otel: 'force flush on the SDK provider (the API alone is a no-op)', sentry: 'flush the client', datadog: 'flush the buffer' },
              { method: 'isEnabled', otel: 'whether a provider is registered', sentry: 'whether the client is initialized', datadog: 'whether the agent is configured' },
            ].map(r => (
              <tr key={r.method} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{r.method}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{r.otel}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{r.sentry}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{r.datadog}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <P>For working code, see the <A href="https://github.com/PartyLayer/PartyLayer/tree/main/examples/telemetry-adapters">telemetry adapters example</A>: a zero-dependency console adapter that renders records live, and an OpenTelemetry bridge built on <Code>{'@opentelemetry/api'}</Code> only. The OpenTelemetry adapter is a no-op until the host application registers an OpenTelemetry SDK, which is the point of depending on the API package alone: the kit stays vendor neutral and the host owns the backend.</P>

      <HR />

      <H2 id="privacy">Privacy</H2>
      <P>The adapter surface carries only privacy-safe values. The bridge never sends raw party ids, session ids, transaction hashes, or origins; where an event{"'"}s only distinguishing field is such an identifier, the property set is empty and the event count is the signal. The full per-event property set is the table in EVENT_SPEC.md.</P>
      <P>Telemetry is opt in. When no adapter is configured the client uses a default no-op telemetry and the bridge is skipped, so an unconfigured app behaves exactly as before with no overhead. Your own adapter should honor the same rule: keep it disabled by default and gate sending behind explicit configuration.</P>
      <P>Where an identifier is genuinely needed for correlation, hash it with core{"'"}s <Code>{'hashForPrivacy'}</Code> rather than sending it raw. Today the bridge sends none, so this matters mainly for properties you add yourself in your own instrumentation.</P>

      <HR />

      <H2 id="instrumenting-the-token-standard-path">Instrumenting the token standard path</H2>
      <P>The CIP-0056 hooks (<Code>{'useTokenHoldings'}</Code>, <Code>{'useTransferInstructions'}</Code>, <Code>{'useTokenAllocations'}</Code>, <Code>{'useAllocationRequests'}</Code>, and the write hooks) are Model 2: they import only TanStack Query and the query keys, and they deliberately hold no client. They wrap a read or submit fetcher that the dApp supplies. Because they have no client, they cannot and should not emit telemetry themselves. Instrumenting the ledger read and write path is the dApp{"'"}s concern, by design, not a gap in the kit.</P>
      <P>The natural place to measure duration and outcome is the fetcher the dApp already passes in. Wrap it once and record through your own adapter:</P>
      <CodeBlock language="ts">{`import type { TelemetryAdapter } from '@partylayer/core';

function instrumented<T>(
  name: string,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  telemetry: TelemetryAdapter,
) {
  return async (signal?: AbortSignal): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fetcher(signal);
      telemetry.gauge?.(\`\${name}_ms\`, Date.now() - start);
      telemetry.track(\`\${name}:ok\`, {});
      return result;
    } catch (err) {
      telemetry.error(err as Error, { op: name });
      throw err;
    }
  };
}

// Then pass the wrapped fetcher to the hook:
//   useTokenHoldings({ read: instrumented('holdings', myReadFetcher, telemetry), ... })`}</CodeBlock>
      <P>The same wrap applies to a submit fetcher passed to <Code>{'useChoice'}</Code> or the typed write hooks. Keep the recorded properties non-identifying, exactly as the bridge does.</P>

      <HR />

      <H2 id="logging">Logging</H2>
      <P>Logging follows the same convention as telemetry: the kit is silent unless the application opts in. The default logger is a no-op, so with no logger configured the client prints nothing and never writes to a dApp{"'"}s console uninvited.</P>
      <P>To restore console output, pass the standard <Code>{'console'}</Code>, which satisfies the <Code>{'LoggerAdapter'}</Code> shape:</P>
      <CodeBlock language="ts">{`import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
  logger: console,      // opt in to output
  logLevel: 'info',     // debug | info | warn | error | silent (default info)
});`}</CodeBlock>
      <P><Code>{'logLevel'}</Code> sets verbosity. Filtering happens centrally in the client before the adapter is called, so an adapter never filters itself. <Code>{'silent'}</Code> suppresses everything.</P>
      <P>Every log line carries a machine readable payload as its second argument, so logs are structured, not just free text:</P>
      <CodeBlock language="ts">{`{ event: 'session:connected', correlationId: 'a1b2c3d4e5f6', walletId: 'console', network: 'devnet' }`}</CodeBlock>
      <P><Code>{'event'}</Code> is a stable machine readable name. Each emitted event produces exactly one structured line, at the level below. The safe fields are the same ones telemetry sends, reused rather than duplicated.</P>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Event', 'Level'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { event: 'error', level: 'error' },
              { event: 'session:networkMismatch', level: 'warn' },
              { event: 'session:connected, session:disconnected', level: 'info' },
              { event: 'registry:status, registry:updated, session:expired, tx:status, wallets:changed', level: 'debug' },
            ].map(r => (
              <tr key={r.event} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{r.event}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>{r.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <P>Failures at the internal call sites (registry fetch failed, session persist or restore failed) log at warn.</P>

      <H3>Correlation ids</H3>
      <P>A short, non identifying correlation id is generated at the start of each multi step public operation (at minimum connect, session restore, signTransaction, and submitTransaction) and threaded through every log line and event during that operation, so a multi step wallet flow can be traced end to end. The id is random, never derived from party or session data, and browser safe (no node only mechanism), so two concurrent operations never share one.</P>

      <H3>Privacy</H3>
      <P>Log payloads follow the telemetry rules exactly: no raw party ids, session ids, transaction hashes, or origins ever appear. Where an event{"'"}s only distinguishing field is such an identifier, the payload carries only the <Code>{'event'}</Code> and the correlation id.</P>

      <HR />

      <H2 id="known-limits">Known limits</H2>
      <P>Stated honestly, so nobody mistakes these for solved:</P>
      <UL>
        <LI>The client emits <Code>{'tx:status'}</Code> for <Code>{'pending'}</Code> and <Code>{'submitted'}</Code> only. It reports these from its own request path and does not subscribe to the wallet{"'"}s transaction status stream (the CIP-0103 <Code>{'txChanged'}</Code> event), so <Code>{'committed'}</Code>, <Code>{'rejected'}</Code>, and <Code>{'failed'}</Code> do not reach telemetry yet.</LI>
        <LI>The internal status mapping never produces <Code>{'rejected'}</Code>; it yields pending, submitted, committed, or failed. So even once a subscription is wired, <Code>{'rejected'}</Code> needs its own handling.</LI>
      </UL>
      <P>Both are tracked as separate work. Until then, treat transaction lifecycle telemetry as covering initiation, not settlement.</P>

      <HR />

      <H2 id="see-also">See also</H2>
      <UL>
        <LI><A href="/docs/events">Event Specification</A></LI>
        <LI><A href={`${GH}/docs/METRICS.md`}>Metrics and Telemetry</A></LI>
        <LI><A href="/docs/privacy-and-reads">Privacy-aware reads on Canton</A></LI>
        <LI><A href="https://github.com/PartyLayer/PartyLayer/tree/main/examples/telemetry-adapters">Telemetry adapters example</A></LI>
      </UL>

      <PrevNext />
    </>
  );
}
