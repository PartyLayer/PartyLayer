'use client';

import { useDocs } from '../layout';

export default function PerformancePage() {
  const { H1, H2, H3, P, Code, PrevNext, UL, LI } = useDocs();

  return (
    <>
      <H1>Performance</H1>
      <P>
        This document is anchored to measurements, not advice. Every number here is reproducible with{' '}
        <Code>{'pnpm gate:size'}</Code> (the bundle scenarios) or the commands noted in each section.
      </P>

      <H2 id="measured-baseline-raw-dist-per-package">Measured baseline: raw dist per package</H2>
      <P>
        Total JavaScript shipped in each package{"'"}s <Code>{'dist'}</Code> (CommonJS <Code>{'.js'}</Code> plus
        ESM <Code>{'.mjs'}</Code>), measured at the versions released on 2026-07-26. This is the whole package,
        not what a consumer bundles.
      </P>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Package', 'dist JS (js + mjs)', 'index.js alone'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { pkg: '@partylayer/react', dist: '335 KB', index: '142 KB' },
              { pkg: '@partylayer/sdk', dist: '137 KB', index: '71 KB' },
              { pkg: '@partylayer/provider', dist: '74 KB', index: '37 KB' },
              { pkg: '@partylayer/core', dist: '71 KB', index: '36 KB' },
              { pkg: '@partylayer/react-native', dist: '60 KB', index: '12 KB' },
              { pkg: '@partylayer/session', dist: '52 KB', index: '26 KB' },
              { pkg: '@partylayer/registry-client', dist: '36 KB', index: '18 KB' },
            ].map(r => (
              <tr key={r.pkg} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{r.pkg}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.dist}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.index}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <P>
        Package size is not what a dApp ships. What a dApp ships is the tree shaken, minified, and gzipped cost
        of the exports it actually imports. That is measured below.
      </P>

      <H2 id="what-each-import-scenario-costs">What each import scenario costs</H2>
      <P>
        Measured with <Code>{'size-limit'}</Code> (esbuild bundler, gzip). Peer dependencies (React, React
        Query, React Native, react-native-svg, AsyncStorage) are treated as external because the consuming app
        already ships them, so each number is PartyLayer{"'"}s marginal contribution. Binary assets imported
        transitively by wallet SDKs (icons, fonts) are mapped to esbuild{"'"}s empty loader, because a web
        bundler emits those as separate files rather than inlining them into the JavaScript bundle.
      </P>
      <P>
        The {'"before"'} column is the same measurement with no <Code>{'sideEffects'}</Code> field declared.
        The{' '}{'"after"'} column is with <Code>{'"sideEffects": false'}</Code> declared on the library
        packages.
      </P>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Scenario', 'Import', 'Before', 'After', 'Change'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { scenario: 'Connect surface', imp: '{ PartyLayerProvider, ConnectButton }', from: '@partylayer/react', before: '47,152 B', after: '29,220 B', change: '-38.0%' },
              { scenario: 'One token hook', imp: '{ useTokenHoldings }', from: '@partylayer/react/query', before: '1,004 B', after: '455 B', change: '-54.7%' },
              { scenario: 'Matching helper', imp: '{ tokenDecimalEquals }', from: '@partylayer/react/query', before: '849 B', after: '283 B', change: '-66.7%' },
              { scenario: 'RN headless', imp: '{ createReactNativeClient }', from: '@partylayer/react-native', before: '42,324 B', after: '42,217 B', change: '-0.25%' },
              { scenario: 'RN ui', imp: '{ ConnectButton }', from: '@partylayer/react-native/ui', before: '2,970 B', after: '2,970 B', change: '0%' },
              { scenario: 'SDK client', imp: '{ createPartyLayer }', from: '@partylayer/sdk', before: '42,130 B', after: '42,022 B', change: '-0.26%' },
            ].map(r => (
              <tr key={r.scenario} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', color: '#0B0F1A', fontSize: 13, fontWeight: 500 }}>{r.scenario}</td>
                <td style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>
                  <Code>{r.imp}</Code> from <Code>{r.from}</Code>
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.before}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.after}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{r.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <P>Reading of the numbers:</P>
      <UL>
        <LI>
          The <Code>{'@partylayer/react'}</Code> package holds many independent hooks and components, so
          declaring it free of load time side effects is what lets a bundler drop the exports a scenario does
          not touch. The connect surface drops 38 percent, and a single token hook or the matching helper drop
          by half or more.
        </LI>
        <LI>
          <Code>{'tokenDecimalEquals'}</Code> reaches 283 B because its module imports nothing. It is now close
          to free, which is the expected result for a pure string comparison helper.
        </LI>
        <LI>
          The React Native and SDK entrypoints barely move. <Code>{'createReactNativeClient'}</Code> and the ui
          {' '}<Code>{'ConnectButton'}</Code> are already single purpose, and <Code>{'createPartyLayer'}</Code>{' '}
          statically wires the built in wallet adapters, which is a deliberate design choice rather than unused
          code a bundler could remove. Their <Code>{'sideEffects'}</Code> declaration is still correct and
          guards against future regressions, but there was little unused code to drop today.
        </LI>
      </UL>

      <H3>The react-native ui scenario and its measurement caveat</H3>
      <P>
        The ui entrypoint imports <Code>{'react-native'}</Code> and <Code>{'react-native-svg'}</Code>, which
        only resolve inside a React Native bundler (Metro), not a web bundler. The size-limit config marks those
        and the other React Native peers as external, so the 2,970 B figure is the cost of PartyLayer{"'"}s own
        ui code, not a runnable React Native bundle. The genuine on device runtime is verified separately by the
        Expo demo web smoke described in <Code>{'demos/expo-connect/README.md'}</Code> and in{' '}
        <Code>{'docs/releasing.md'}</Code>.
      </P>

      <H2 id="budgets-and-where-they-are-enforced">Budgets and where they are enforced</H2>
      <P>
        Budgets are set slightly above the current measurement so they act as regression guards rather than
        aspirations that fail on day one. They live in <Code>{'.size-limit.js'}</Code> at the repo root and run
        as the <Code>{'gate:size'}</Code> stage of <Code>{'pnpm gate'}</Code>, right after{' '}
        <Code>{'gate:build'}</Code> (the stage needs the built <Code>{'dist'}</Code>). A change that inflates a
        bundle past its budget fails locally and in CI rather than reaching a consumer.
      </P>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Scenario', 'Measured', 'Budget', 'Headroom'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { scenario: 'Connect surface', measured: '29.22 KB', budget: '30 KB', headroom: '~5%' },
              { scenario: 'One token hook', measured: '455 B', budget: '700 B', headroom: '~54%' },
              { scenario: 'Matching helper', measured: '283 B', budget: '500 B', headroom: '~77%' },
              { scenario: 'RN headless', measured: '42.22 KB', budget: '43 KB', headroom: '~4%' },
              { scenario: 'RN ui', measured: '2.97 KB', budget: '3.5 KB', headroom: '~18%' },
              { scenario: 'SDK client', measured: '42.02 KB', budget: '43 KB', headroom: '~5%' },
            ].map(r => (
              <tr key={r.scenario} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', color: '#0B0F1A', fontSize: 13, fontWeight: 500 }}>{r.scenario}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.measured}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.budget}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.headroom}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <P>
        The large entrypoints carry roughly 5 percent headroom, tight enough to catch a real regression. The
        tiny helper entrypoints carry more relative headroom because a few hundred bytes of normal churn swing
        their percentage sharply.
      </P>
      <P>
        Run the check on its own with <Code>{'pnpm gate:size'}</Code>, or <Code>{'pnpm size'}</Code> during
        development.
      </P>

      <H2 id="tree-shaking-requirements-for-consumers">Tree shaking requirements for consumers</H2>
      <P>
        The budgets above are only achievable if the consuming app lets the bundler shake the tree.
      </P>
      <UL>
        <LI>
          Import named exports from the package or its subpath, for example{' '}
          <Code>{"import { useTokenHoldings } from '@partylayer/react/query'"}</Code>. Every publishable library
          package declares <Code>{'"sideEffects": false'}</Code>, so a bundler may drop any module whose exports
          you do not use.
        </LI>
        <LI>
          Do not use namespace imports such as <Code>{"import * as PartyLayer from '@partylayer/react'"}</Code>.
          A namespace import references the whole module object and prevents the bundler from dropping unused
          exports.
        </LI>
        <LI>
          Use the ESM build. The packages ship both CommonJS and ESM through the <Code>{'exports'}</Code> map,
          and bundlers pick ESM automatically. A CommonJS <Code>{'require'}</Code> cannot be tree shaken.
        </LI>
        <LI>
          Prefer the narrowest subpath. <Code>{'@partylayer/react/query'}</Code> carries the data hooks without
          the connect UI, and <Code>{'@partylayer/react-native'}</Code> (headless) carries no SVG renderer,
          which lives behind <Code>{'@partylayer/react-native/ui'}</Code>.
        </LI>
        <LI>
          The three command line packages (<Code>{'create-partylayer-app'}</Code>,{' '}
          <Code>{'@partylayer/registry-cli'}</Code>, <Code>{'@partylayer/conformance-runner'}</Code>) do not
          declare <Code>{'sideEffects'}</Code> because their entry runs on load by design. They are run as
          commands, not imported, so tree shaking does not apply.
        </LI>
      </UL>

      <H2 id="caching-already-provided-by-the-registry-client">Caching already provided by the registry client</H2>
      <P>
        <Code>{'@partylayer/registry-client'}</Code> implements stale while revalidate caching, so an app does
        not refetch the wallet registry on every call. It is configurable through{' '}
        <Code>{'RegistryClientOptions'}</Code>:
      </P>
      <UL>
        <LI>
          <Code>{'cacheTtl'}</Code> (default 1 hour): while the cached registry is younger than this, it is
          served directly with no network request.
        </LI>
        <LI>
          <Code>{'staleTtl'}</Code> (default 24 hours): once older than <Code>{'cacheTtl'}</Code> but younger
          than <Code>{'staleTtl'}</Code>, the cached copy is served and marked stale while a refresh happens.
        </LI>
        <LI>
          <Code>{'storage'}</Code>: a pluggable adapter, so the cache can persist across sessions rather than
          living only in memory.
        </LI>
      </UL>
      <P>
        These are knobs on the existing client, not something an app has to build.
      </P>

      <H2 id="lazy-loading-already-in-place">Lazy loading already in place</H2>
      <P>
        Heavy or rarely needed modules are loaded on demand with dynamic <Code>{'import'}</Code>, so they never
        enter the initial bundle:
      </P>
      <UL>
        <LI>
          <Code>{'packages/react/src/modal.tsx'}</Code> imports <Code>{'qrcode'}</Code> only when a QR code is
          about to render.
        </LI>
        <LI>
          <Code>{'packages/sdk/src/client.ts'}</Code> imports the <Code>{'OriginNotAllowedError'}</Code> class
          from <Code>{'@partylayer/core'}</Code> only on the error path.
        </LI>
        <LI>
          <Code>{'packages/conformance-runner'}</Code> loads <Code>{'@partylayer/provider'}</Code> and the
          modules under test dynamically at run time.
        </LI>
      </UL>

      <PrevNext />
    </>
  );
}
