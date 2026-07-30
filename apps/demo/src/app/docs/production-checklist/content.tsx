'use client';

import { useDocs } from '../layout';

export default function ProductionChecklistPage() {
  const { H1, H2, P, Code, CodeBlock, Callout, PrevNext, UL, LI, A, Strong } = useDocs();

  return (
    <>
      <H1>Production Migration Checklist</H1>
      <P><Strong>Checks to run before taking a PartyLayer dApp to production.</Strong></P>
      <P>
        This checklist links to the docs that already cover each topic and writes only what is
        missing. For each item it states what the kit provides, what the dApp owns, and the
        concrete checks to run. Where a topic is documented elsewhere, follow the link rather
        than copying the detail here.
      </P>

      <H2 id="network-promotion-devnet-to-testnet-to-mainnet">Network Promotion (DevNet to TestNet to MainNet)</H2>
      <Callout type="warning" title="Required">{''}</Callout>
      <P>
        The kit provides one integration surface across networks. The network is a configuration
        value, not a code change: <Code>{'network="devnet"'}</Code> on <Code>{'PartyLayerProvider'}</Code>, or the{' '}
        <Code>{'network'}</Code> field of <Code>{'createPartyLayer({ ... })'}</Code>, taking <Code>{'"devnet"'}</Code>,{' '}
        <Code>{'"testnet"'}</Code>, or <Code>{'"mainnet"'}</Code>. See{' '}
        <A href="/docs/dev-and-staging">dev-and-staging.md</A> for the ladder from Studio to a live network.
      </P>
      <P>
        The dApp owns the values the repo cannot know: the Canton endpoints and any per-network
        operator configuration come from your operator, not from PartyLayer. Where your DAML
        packages live is a Canton topology question covered by{' '}
        <A href="/docs/partylayer-and-canton-topology">partylayer-and-canton-topology.md</A>. The registry
        ships a <Code>{'stable'}</Code> and a <Code>{'beta'}</Code> channel (<Code>{'registry/v1/stable'}</Code>,{' '}
        <Code>{'registry/v1/beta'}</Code>); choosing a channel and its URL is operator and registry
        configuration, covered by{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/registry-ops.md">registry-ops.md</A> and{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/registry-onboarding.md">registry-onboarding.md</A>.
      </P>
      <P>What actually changes between networks:</P>
      <UL>
        <LI>The network id (<Code>{'devnet'}</Code>, <Code>{'testnet'}</Code>, <Code>{'mainnet'}</Code>).</LI>
        <LI>
          The wallet set available on that network. Confirm each wallet you rely on in the{' '}
          <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/wallet-cip0103-matrix.md">wallet-cip0103-matrix.md</A>{' '}
          before promoting.
        </LI>
        <LI>The registry channel and URL (operator configuration).</LI>
      </UL>
      <P>Session and storage isolation, so a devnet session cannot leak into a mainnet app:</P>
      <UL>
        <LI>
          A session carries its network. On startup the kit calls <Code>{'restore()'}</Code>, which revalidates
          against the live provider, and a wrong-network session surfaces as <Code>{'NETWORK_MISMATCH'}</Code>{' '}
          (<Code>{'NetworkMismatchError'}</Code>), not a silent connect. See{' '}
          <A href="/docs/error-handling">errors.md</A>.
        </LI>
        <LI>
          Session storage is origin scoped, so two deployments on different origins never share a
          persisted session.
        </LI>
      </UL>
      <P>Checks before promotion:</P>
      <UL>
        <LI>Confirm every wallet you use is supported on the target network in the matrix.</LI>
        <LI>Confirm the operator supplied endpoints and the registry channel for the target network.</LI>
        <LI>
          Confirm a session persisted on one network does not restore into an app configured for
          another (expect <Code>{'NETWORK_MISMATCH'}</Code>).
        </LI>
      </UL>

      <H2 id="bundle-regression">Bundle Regression</H2>
      <Callout type="warning" title="Required">{''}</Callout>
      <P>
        Bundle cost and its enforcement are covered by <A href="/docs/performance">performance.md</A>: the
        measured baseline, the per scenario budgets, and the <Code>{'gate:size'}</Code> stage. Do not restate
        those numbers here; read them there.
      </P>
      <P>Pre-release checks:</P>
      <UL>
        <LI>Budgets green: <Code>{'pnpm gate:size'}</Code> (also runs inside <Code>{'pnpm gate'}</Code>).</LI>
        <LI>
          Tree shaking preserved: consumers import named exports from the narrowest subpath (for
          example <Code>{'@partylayer/react/query'}</Code>), use ESM, and never use namespace imports such as{' '}
          <Code>{"import * as PartyLayer from '@partylayer/react'"}</Code>.
        </LI>
        <LI>No new runtime dependency added to a published package.</LI>
      </UL>

      <H2 id="production-cache-configuration">Production Cache Configuration</H2>
      <Callout type="tip" title="Recommended">{''}</Callout>
      <P>
        The kit exposes <Code>{'partyLayerKeys'}</Code>, a TanStack Query key factory with 22 keys: a root{' '}
        <Code>{'all'}</Code> scope, eight parameterized read keys, three parameterless state keys, and ten
        write keys used as mutation keys.
      </P>
      <P>
        <Code>{'staleTime'}</Code>, <Code>{'gcTime'}</Code>, and <Code>{'refetchOnWindowFocus'}</Code> apply only to the
        read keys. They are meaningless for the mutation keys (<Code>{'connect'}</Code>, <Code>{'disconnect'}</Code>,{' '}
        <Code>{'signMessage'}</Code>, <Code>{'submitTransaction'}</Code>, <Code>{'exerciseChoice'}</Code>,{' '}
        <Code>{'transferInstruction'}</Code>, <Code>{'transferInstructionAction'}</Code>,{' '}
        <Code>{'allocationInstruction'}</Code>, <Code>{'allocationAction'}</Code>, <Code>{'allocationRequestAction'}</Code>),
        which have no cached result to age, so do not set them there.
      </P>
      <P>Group the read keys by data class and tune each class for how its data changes:</P>
      <UL>
        <LI>
          Registry data, changes rarely: <Code>{'wallets'}</Code>, <Code>{'registryStatus'}</Code>. Use a long{' '}
          <Code>{'staleTime'}</Code>. The registry client already caches with its own TTL (see Caching in{' '}
          <A href="/docs/performance">performance.md</A>).
        </LI>
        <LI>
          Ledger activity data, changes on ledger writes: <Code>{'tokenHoldings'}</Code>, <Code>{'tokenAllocations'}</Code>,{' '}
          <Code>{'transferInstructions'}</Code>, <Code>{'allocationRequests'}</Code>, <Code>{'damlContract'}</Code>. Use a
          moderate <Code>{'staleTime'}</Code> and invalidate after a related mutation rather than polling.
        </LI>
        <LI>
          Cost estimates, go stale quickly: <Code>{'transactionCostEstimate'}</Code>, <Code>{'paidTrafficCost'}</Code>. Use
          a short <Code>{'staleTime'}</Code> so a stale price is not shown.
        </LI>
        <LI>
          Session and account state, event driven not polled: <Code>{'session'}</Code>, <Code>{'account'}</Code>. These
          update from session events, so keep <Code>{'refetchOnWindowFocus'}</Code> off and rely on invalidation.
        </LI>
      </UL>
      <P>
        Invalidate through <Code>{'partyLayerKeys'}</Code>, never the raw <Code>{'key'}</Code> you passed a hook. The
        raw <Code>{'key'}</Code> is namespaced into the query key, so prefix invalidating with it matches nothing.
        The rule and its rationale live in the JSDoc of <Code>{'packages/react/src/query-keys.ts'}</Code>.
      </P>
      <CodeBlock language="ts">{`// Clears every wallet-holdings instance:
queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenHoldings() });`}</CodeBlock>

      <H2 id="error-boundaries-and-vendor-error-reporting">Error Boundaries and Vendor Error Reporting</H2>
      <Callout type="warning" title="Required">{''}</Callout>
      <P>
        The kit provides the error taxonomy in <A href="/docs/error-handling">errors.md</A> and the vendor
        telemetry mapping in <A href="/docs/observability">observability.md</A>, with working adapters under{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/tree/main/examples/telemetry-adapters">../examples/telemetry-adapters</A>.
        What is missing is the boundary pattern.
      </P>
      <P>
        Expected operational errors arrive as values in a hook{"'"}s <Code>{'error'}</Code> field, not as thrown
        exceptions, and should be handled in the UI rather than caught by a boundary. Map the error{' '}
        <Code>{'code'}</Code> to a message using the UX Message column in{' '}
        <A href="/docs/error-handling">errors.md</A>:
      </P>
      <UL>
        <LI><Code>{'USER_REJECTED'}</Code> (<Code>{'UserRejectedError'}</Code>)</LI>
        <LI><Code>{'SESSION_EXPIRED'}</Code> (<Code>{'SessionExpiredError'}</Code>)</LI>
        <LI><Code>{'NETWORK_MISMATCH'}</Code> (<Code>{'NetworkMismatchError'}</Code>)</LI>
        <LI><Code>{'INSUFFICIENT_TRAFFIC'}</Code> (<Code>{'InsufficientTrafficError'}</Code>)</LI>
      </UL>
      <CodeBlock language="tsx">{`const { error } = useSubmitTransaction();
// PartyLayerError carries a stable \`code\`; render the mapped message, do not rethrow.
if (error instanceof PartyLayerError) return <Notice>{messageFor(error.code)}</Notice>;`}</CodeBlock>
      <P>
        A React error boundary is for the genuinely exceptional: a render time throw from a bug, not the
        operational cases above. Place the boundary as a parent of the subtree that renders PartyLayer
        components, inside <Code>{'PartyLayerProvider'}</Code> so the provider stays mounted while the boundary
        reports the throw to your telemetry adapter.
      </P>
      <P>Checks:</P>
      <UL>
        <LI>Confirm the four operational codes are handled in the UI and do not reach the boundary.</LI>
        <LI>Confirm the boundary reports to your vendor adapter (see the telemetry adapters example).</LI>
      </UL>

      <H2 id="observability-in-production-sampling-and-pii">Observability in Production (Sampling and PII)</H2>
      <Callout type="tip" title="Recommended">{''}</Callout>
      <P>
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/METRICS.md">METRICS.md</A> states the
        privacy guarantees and enumerates the only properties the event to telemetry bridge sends (SDK
        version, network name, metric counts, timestamps, and generic error codes; app identifier and
        origin are opt in and hashed). It never sends wallet addresses, raw party ids, transaction
        payloads, signed content, user identifiers, or IP addresses. Sampling has a knob today:{' '}
        <Code>{'TelemetryConfig.sampleRate'}</Code> (0.0 to 1.0).
      </P>
      <P>
        What is missing is the production sampling strategy. Lifecycle and error events are low volume and
        worth sending always (<Code>{'session:connected'}</Code>, <Code>{'session:disconnected'}</Code>, and error
        counters). High frequency reads, such as repeated cost estimates, warrant sampling below 1.0 at
        scale. Set the rate with <Code>{'sampleRate'}</Code>.
      </P>
      <P>Verification the operator can run, given the bridge sends only the safe properties:</P>
      <UL>
        <LI>
          Point the telemetry adapter at a capture you control (the console adapter in the example, or a
          proxy) and drive a full connect, read, and submit flow.
        </LI>
        <LI>Assert none of the never collected values appear in the captured payloads.</LI>
        <LI>
          Confirm origin is either absent or hashed (it is opt in through <Code>{'includeOrigin'}</Code>), so a
          raw origin does not reach the vendor.
        </LI>
      </UL>
      <P>
        See <A href="/docs/events">EVENT_SPEC.md</A> for the per event property set.
      </P>

      <H2 id="synchronizer-failover">Synchronizer Failover</H2>
      <Callout type="warning" title="Required">{''}</Callout>
      <P>
        Be clear about the boundary: there is no synchronizer selection or failover logic in the sdk.{' '}
        <Code>{'SynchronizerSwitcher'}</Code> is a presentational component. It takes a <Code>{'networkId'}</Code>, an{' '}
        <Code>{'options'}</Code> array the consumer supplies, and an <Code>{'onSwitch(networkId)'}</Code> callback the
        consumer implements; it renders nothing when there are no options. The dApp owns routing.
      </P>
      <P>What the dApp owns:</P>
      <UL>
        <LI>Where the list of synchronizers comes from (the consumer supplies <Code>{'options'}</Code>).</LI>
        <LI>What to do when the active synchronizer is unavailable, including retry and backoff.</LI>
        <LI>
          What to re invalidate after a switch: the party scoped query keys, through <Code>{'partyLayerKeys'}</Code>,
          so reads refetch against the new synchronizer.
        </LI>
        <LI>
          The token standard constraint that a submission{"'"}s disclosed contracts must all share one
          synchronizer. Enforce it with <Code>{'assertSingleSynchronizer'}</Code> from{' '}
          <Code>{'@partylayer/react/query'}</Code> before submitting.
        </LI>
      </UL>
      <P>
        Routing failures surface in the dApp{"'"}s own ledger and registry calls, not in the kit{"'"}s error
        taxonomy. The kit adds one kit level code, <Code>{'SYNCHRONIZER_ERROR'}</Code>, for the synchronizer
        conditions it raises itself, with no CIP-0103 wire mapping. Routing failures the dApp observes through
        its own calls still get no code, and <Code>{'assertSingleSynchronizer'}</Code> throws a plain{' '}
        <Code>{'Error'}</Code>, not a <Code>{'PartyLayerError'}</Code>. See the synchronizer note in{' '}
        <A href="/docs/error-handling">errors.md</A>.
      </P>
      <P>Checks:</P>
      <UL>
        <LI>After a synchronizer switch, invalidate the party scoped keys.</LI>
        <LI>Call <Code>{'assertSingleSynchronizer'}</Code> before any submission that spans disclosed contracts.</LI>
      </UL>

      <H2 id="cost-accuracy-monitoring">Cost Accuracy Monitoring</H2>
      <Callout type="tip" title="Recommended">{''}</Callout>
      <P>
        The kit exposes <Code>{'CostEstimation'}</Code>, <Code>{'PaidTrafficCost'}</Code>, <Code>{'toTrafficCost'}</Code>, and{' '}
        <Code>{'trafficCostToBigInt'}</Code> in <Code>{'@partylayer/core'}</Code>, with <Code>{'usePaidTrafficCost'}</Code> and{' '}
        <Code>{'useTransactionCostEstimate'}</Code> in <Code>{'@partylayer/react'}</Code> and the same two in{' '}
        <Code>{'@partylayer/vue'}</Code>.
      </P>
      <P>Monitor drift between the estimate shown to a user and the cost actually paid:</P>
      <UL>
        <LI>
          Record the estimate (<Code>{'CostEstimation.totalTrafficCostEstimation'}</Code>) shown before submit and
          the <Code>{'PaidTrafficCost'}</Code> observed after execution.
        </LI>
        <LI>
          Compare with <Code>{'trafficCostToBigInt'}</Code>, not float math. Traffic costs are integer quantities,
          and float subtraction loses precision.
        </LI>
        <LI>
          The drift magnitude worth alerting on is the operator{"'"}s call, not ours, because it depends on
          your traffic economics and how conservative your estimates are.
        </LI>
      </UL>
      <P>
        This ties to the insufficient traffic path: a persistent under estimate leaves users short and they
        hit <Code>{'INSUFFICIENT_TRAFFIC'}</Code> (<Code>{'InsufficientTrafficError'}</Code>) at submit. See{' '}
        <A href="/docs/error-handling">errors.md</A>.
      </P>
      <CodeBlock language="ts">{`const drift = trafficCostToBigInt(paid) - trafficCostToBigInt(estimate.totalTrafficCostEstimation);`}</CodeBlock>

      <H2 id="ssr-and-rsc-in-production">SSR and RSC in Production</H2>
      <Callout type="tip" title="Recommended">{''}</Callout>
      <P>
        The mechanics are covered:{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/react-cookie-ssr.md">react-cookie-ssr.md</A>{' '}
        for the cookie backed session (<Code>{'createCookieStorage'}</Code>, <Code>{'decodeSessionEnvelope'}</Code>,{' '}
        <Code>{'next/headers'}</Code>), and{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/vue-nuxt-ssr.md">vue-nuxt-ssr.md</A>{' '}
        for the Nuxt disconnected snapshot plus query hydration. What is missing is the production concerns.
      </P>
      <P>
        Cache headers: a page that carries session state is per user. Do not cache it at a shared CDN. Mark
        session bearing responses private or no-store so one user{"'"}s connected HTML is never served to
        another.
      </P>
      <P>Edge runtime constraints, verified from the session package source, not assumed:</P>
      <UL>
        <LI><Code>{'createMemoryStorage'}</Code>: edge safe (pure in memory, no DOM).</LI>
        <LI>
          <Code>{'createCookieStorage'}</Code>: edge safe when given a server cookie adapter (for example{' '}
          <Code>{'next/headers'}</Code> <Code>{'cookies()'}</Code>); the default adapter uses{' '}
          <Code>{'document.cookie'}</Code> and is inert on the server.
        </LI>
        <LI><Code>{'createEncryptedIndexedDBStorage'}</Code>: not edge safe. It requires IndexedDB and WebCrypto.</LI>
        <LI>
          <Code>{'createEncryptedLocalStorage'}</Code>: not edge safe. It requires localStorage, and the key is
          still held in IndexedDB.
        </LI>
      </UL>
      <P>
        So on an edge runtime, use <Code>{'createMemoryStorage'}</Code> or a server backed{' '}
        <Code>{'createCookieStorage'}</Code>; the two encrypted browser backends cannot run there.
      </P>
      <P>
        Hydration expectation: with cookie storage the connected party appears in the initial HTML and the
        first client paint matches, so there is no disconnected to connected flash. A client only adapter
        (for example <Code>{'createLocalStorage'}</Code> from <Code>{'@partylayer/react'}</Code>) paints disconnected
        first and then flips after hydration.
      </P>
      <P>Checks:</P>
      <UL>
        <LI>Confirm session bearing pages set private cache headers.</LI>
        <LI>Confirm only the edge safe adapters run on an edge runtime.</LI>
        <LI>Confirm the connected party is in the server HTML with no hydration flash.</LI>
      </UL>

      <H2 id="multi-framework-consistency">Multi Framework Consistency</H2>
      <Callout type="tip" title="Recommended">{''}</Callout>
      <P>
        The frameworks are not at parity, and choosing one means choosing what you get today. Measured from
        the api snapshots: <Code>{'@partylayer/react'}</Code> exposes 34 hook names (33 distinct;{' '}
        <Code>{'useCantonConnect'}</Code> is an alias of <Code>{'usePartyLayer'}</Code>), <Code>{'@partylayer/vue'}</Code>{' '}
        exposes 8, and <Code>{'@partylayer/react-native'}</Code> exposes 2. Vue exposes nothing react lacks.
      </P>
      <P>Parity matrix, as measured:</P>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Capability', 'react', 'vue', 'react-native'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>Connect</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useConnect'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useSession().connect'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useConnect'}</Code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>Disconnect</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useDisconnect'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useSession().disconnect'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useConnect().disconnect'}</Code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>Wallet list</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useWallets'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>no</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useWallets'}</Code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>Session state</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useSession'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useSession'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>via <Code>{'useConnect().session'}</Code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>Sign message</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useSignMessage'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>no</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>no</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>Submit transaction</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useSubmitTransaction'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>no</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>no</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>Cost</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'usePaidTrafficCost'}</Code>, <Code>{'useTransactionCostEstimate'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>same two</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>no</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>CIP-0056 token surface</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>typed hooks (<Code>{'useTokenHoldings'}</Code>, <Code>{'useTokenAllocations'}</Code>, and the transfer and allocation hooks) plus generic <Code>{'useDamlContract'}</Code> and <Code>{'useChoice'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>generic only (<Code>{'useDamlContract'}</Code>, <Code>{'useChoice'}</Code>)</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>no</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
              <td style={{ padding: '10px 14px', color: '#0B0F1A', fontWeight: 500, fontSize: 13 }}>Theme</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'useTheme'}</Code>, <Code>{'themes'}</Code>, <Code>{'ThemeProvider'}</Code></td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>no</td>
              <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}><Code>{'themes'}</Code>, <Code>{'toReactNativeTheme'}</Code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <P>
        The shared surface all three genuinely expose is connecting and disconnecting a session. A
        consistency guard locks that surface so it does not drift apart:{' '}
        <Code>{'scripts/gate/framework-consistency.test.mjs'}</Code>, run as the <Code>{'gate:consistency'}</Code> stage
        of <Code>{'pnpm gate'}</Code>. It reads the committed api snapshots and asserts that react, vue, and
        react-native each expose a <Code>{'connect'}</Code> and a <Code>{'disconnect'}</Code> operation, that{' '}
        <Code>{'disconnect'}</Code> has the same shape in all three (no arguments, returns{' '}
        <Code>{'Promise<void>'}</Code>), and that react and react-native keep their shared <Code>{'useConnect'}</Code>{' '}
        and <Code>{'useWallets'}</Code> hooks. It does not assert parity that does not exist.
      </P>
      <P>Checks:</P>
      <UL>
        <LI>Pick the framework whose row covers the capabilities you need.</LI>
        <LI>If you extend the shared connect surface, extend it in all three so the guard stays green.</LI>
      </UL>

      <PrevNext />
    </>
  );
}
