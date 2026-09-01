// Bundle budgets for realistic consumer import scenarios. See docs/performance.md.
//
// Peer dependencies (React, React Query, React Native, react-native-svg, AsyncStorage) are
// treated as external because the consuming app already ships them, so each number is
// PartyLayer's marginal contribution, not the shared framework.
//
// Binary assets imported transitively by wallet SDKs (icons, fonts) are mapped to esbuild's
// empty loader: a web bundler emits those as separate files, so they are not part of the
// JavaScript a dApp downloads for these entrypoints. This keeps the numbers a JS budget.

const ASSET_EXTS = ['.png', '.svg', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.css'];

function assetsAsEmpty(config) {
  config.loader = config.loader || {};
  for (const ext of ASSET_EXTS) config.loader[ext] = 'empty';
  return config;
}

const REACT_PEERS = ['react', 'react-dom', '@tanstack/react-query'];
const RN_PEERS = ['react', 'react-native', 'react-native-svg', '@react-native-async-storage/async-storage'];

// Wallet SDKs that PartyLayer only ever loads through a dynamic import() (code-split):
// a web bundler emits these as a separate chunk that is NOT downloaded on the initial
// createPartyLayer path, so they are excluded here to keep each number the marginal
// INITIAL-bundle contribution (the same reason assets and peers are excluded above).
// @cantor8/wallet-connect-sdk is lazily imported by the Cantor8 adapter, loaded only
// when a user selects Cantor8.
const LAZY_WALLET_SDKS = ['@cantor8/wallet-connect-sdk'];

// Numbers are minified plus gzipped, the size a dApp downloads over the wire.
module.exports = [
  {
    name: 'react: connect surface (PartyLayerProvider + ConnectButton)',
    path: 'packages/react/dist/index.mjs',
    import: '{ PartyLayerProvider, ConnectButton }',
    ignore: REACT_PEERS,
    modifyEsbuildConfig: assetsAsEmpty,
    gzip: true,
    limit: '30 kB',
  },
  {
    name: 'react/query: useTokenHoldings',
    path: 'packages/react/dist/query.mjs',
    import: '{ useTokenHoldings }',
    ignore: REACT_PEERS,
    modifyEsbuildConfig: assetsAsEmpty,
    gzip: true,
    limit: '700 B',
  },
  {
    name: 'react/query: tokenDecimalEquals',
    path: 'packages/react/dist/query.mjs',
    import: '{ tokenDecimalEquals }',
    ignore: REACT_PEERS,
    modifyEsbuildConfig: assetsAsEmpty,
    gzip: true,
    limit: '500 B',
  },
  {
    name: 'react-native: headless client',
    path: 'packages/react-native/dist/index.mjs',
    import: '{ createReactNativeClient }',
    ignore: [...RN_PEERS, ...LAZY_WALLET_SDKS],
    modifyEsbuildConfig: assetsAsEmpty,
    gzip: true,
    // Raised from 43 kB when the client gained requestTransfer: the method plus
    // toTransferIntent, which narrows a caller's intent to the allowlisted fields
    // before any adapter sees it. That narrowing is reachable from the client, so
    // it is in every consumer's bundle by design — it is the guarantee that a
    // caller-supplied option cannot reach a wallet, and making it optional would
    // make the guarantee optional. First measured at 43.12 kB and compacted to
    // 43.06 kB (one shared throw helper instead of a construction site per check,
    // without shortening the messages a developer actually reads). 43.5 kB leaves
    // ~440 B of headroom: enough not to hide the next regression, not so much
    // that it stops being a budget.
    limit: '43.5 kB',
  },
  {
    name: 'react-native: ui (ConnectButton)',
    path: 'packages/react-native/dist/ui.mjs',
    import: '{ ConnectButton }',
    ignore: RN_PEERS,
    modifyEsbuildConfig: assetsAsEmpty,
    gzip: true,
    // Raised from 3.5 kB when ConnectButton's modal gained the accessibility and motion
    // work: the screen reader affordances, the live region, the reduce-motion subscription,
    // the safe area inset, and resolving the client and theme from context instead of
    // props. Measured 5.07 kB, so this leaves headroom without hiding a regression.
    limit: '5.5 kB',
  },
  {
    name: 'sdk: createPartyLayer client',
    path: 'packages/sdk/dist/index.mjs',
    import: '{ createPartyLayer }',
    ignore: LAZY_WALLET_SDKS,
    modifyEsbuildConfig: assetsAsEmpty,
    gzip: true,
    limit: '43 kB',
  },
];
