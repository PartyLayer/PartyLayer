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
    //
    // Raised again from 43.5 kB when the registry client stopped reporting
    // verification it had not performed. The cost is the signature path itself:
    // fetching the manifest and its signature as a unit and verifying the bytes
    // that call received, separating a missing signature from an unreachable
    // one so an outage cannot be mistaken for tampering, and letting a failed
    // verification propagate instead of being absorbed by the cache fallback.
    // None of it is code-splittable: it sits on the registry fetch path that
    // every client runs at startup, and making it optional would make the
    // guarantee optional.
    //
    // First measured at 43.74 kB and compacted in three passes to 43.71 kB:
    // shortened the runtime strings (not the messages a developer reads in a
    // stack trace), one construction site for the unavailable outcome instead
    // of three literals, and inlined a single-use exported helper. 43.75 kB
    // left ~40 B, deliberately tight.
    //
    // MOVED A THIRD TIME, for the error classifier. This one is a correctness
    // fix, not a feature, and that distinction is the whole reason it was
    // allowed to move: the alternative was leaving a classifier that told a
    // dApp the user had clicked cancel when no prompt was ever drawn. Nightly
    // refusing because the tab was unfocused ("Connect request rejected - tab
    // is not active") was reported as USER_REJECTED, because classification was
    // a substring scan over prose.
    //
    // What the bytes bought:
    //   - WalletRefusedError as a REAL class, not just a code, so a dApp can
    //     `instanceof` a wallet's own refusal and tell it apart from a user
    //     cancellation. Dropping the class was measured (below) and rejected.
    //   - Structured-signal classification: `err.name` and EIP-1193 4001 first,
    //     then phrasing that actually names the user, then a refusal that is
    //     explicitly NOT the user's.
    //
    // The AbortSignal that makes a connect timeout actually cancel measured at
    // ZERO bytes here — reverting client.ts entirely moved neither budget. The
    // cost is all in the classifier and the class.
    //
    // Four compactions measured, 49 B recovered, two more REJECTED — recorded
    // so the next person does not re-run them:
    //   - merging the two user-detection regexes and the duplicate return
    //     path: -26 B, KEPT.
    //   - slimming WalletRefusedError's constructor to take one details object
    //     instead of a separate originalMessage argument: -6 B, KEPT.
    //   - dropping the class entirely for `new PartyLayerError(..., 'WALLET_REFUSED')`:
    //     -17 B, REJECTED. It buys almost nothing and costs consumers
    //     `instanceof`, and it still would not have cleared the gate.
    //   - replacing the regex with `message.includes('user') && /reject|.../`:
    //     -35 B, REJECTED. It matches "rejected by the wallet, contact user
    //     support", which is the exact class of false positive being fixed.
    //
    // If a FUTURE increase is for a feature rather than a correctness fix, it
    // should be held to a harder standard than this one was.
    //
    // Measured 43.97 kB after the four passes above. 44 kB left ~30 B.
    //
    // MOVED A FOURTH TIME — but the THIRD move for this entry point, and all
    // three have been correctness fixes, not features. This one is the
    // `availability` contract: `detectInstalled()` now answers what a wallet's
    // presence actually is, because `installed` could only say yes or no and
    // eight of twelve adapters had no honest way to answer it.
    //
    // The bytes ARE the honest answers: the `availability: { kind: ... }`
    // literals the adapters return. Two candidate savings were measured and
    // both came back at ZERO:
    //   - removing the `needs-config` variant (which turned out to be
    //     unreachable anyway — Bron and WalletConnect both require their config
    //     in the constructor, so neither adapter can exist unconfigured): 0 B,
    //     type-only plus a branch the minifier already dropped;
    //   - rewriting installGuard to read `availability`: 0 B ON THIS ENTRY
    //     POINT. It is NOT free everywhere — it costs ~26 B on
    //     `sdk: createPartyLayer client`, and compacting it to a single
    //     ternary recovered 8 B of that and 10 B here. A saving measured on
    //     one bundle is not a saving; check each budget the code reaches.
    //
    // Finding the remaining 19 B elsewhere in this entry point would pay for a
    // correctness fix with an unrelated optimisation hunt — the same trade that
    // was considered and rejected on the error-classifier change above.
    //
    // IF A FOURTH INCREASE IS EVER PROPOSED FOR A FEATURE, the bar is higher
    // than any of these three cleared, and this comment is where that is
    // recorded. Three moves for correctness does not establish a precedent for
    // a move for convenience.
    //
    //
    // TWO BUDGETS MOVED TOGETHER FOR THIS ONE CHANGE — this entry point and the
    // other one below/above. That is a fact worth seeing rather than splitting
    // across two commits: the `availability` contract reaches both bundles, so
    // both paid. If a single change ever needs a third budget, that is a signal
    // about the change, not about the budgets.
    //
    // AND AN ATTRIBUTION ERROR WORTH MORE THAN THE BYTE COUNT: the installGuard
    // rewrite was reported as "0 B". It was measured on ONE bundle
    // (react-native), where it genuinely was free, and it cost ~26 B on the
    // other. `pnpm gate` caught that, not the person who measured it. A saving
    // is only a saving on the budgets you actually measured it against — check
    // EVERY budget the changed code reaches, not the first one that looked fine.
    // Compacting the guard to a single ternary then recovered 8 B on the sdk
    // entry and 10 B here.
    //
    // Measured 44.04 kB after that compaction. 44.05 kB left ~10 B.
    //
    // MOVED ONCE FOR TWO CHANGES, DELIBERATELY. This raise covers BOTH the
    // identity-bridge fix (D5) and the connect/capabilities schema work (D6).
    //
    // D5 was finished, green and ready to ship on its own. It was HELD and
    // folded in here specifically to avoid a fourth isolated move on these
    // budgets: D6 opens the registry schema and was going to move them anyway,
    // so one raise with one argument beats two of each in adjacent pull
    // requests. That restraint is recorded because the record otherwise shows
    // only that the budget moved again, which is the opposite of what happened.
    //
    // What the bytes are, in both cases identity and schema plumbing rather than
    // features:
    //   - D5: `matchKnownByIdentity`, a `.find` matching a resolved provider id
    //     against a wallet id and its declared injection global, so a known
    //     wallet is not minted a SECOND picker row. Observed twice — Nightly
    //     against the real extension, and the demo's own wallet, whose twin
    //     connected to the same provider when clicked.
    //   - D6: the `connect` field read at the top of the transport classifier,
    //     and four capabilities (`transfer`, `ledgerApi`, `popup`, `restore`)
    //     the registry previously could not express at all — which is why
    //     `requiredCapabilities: ['transfer']` matched zero wallets while every
    //     adapter implemented it.
    //
    // Compactions measured and kept: the D5 helper reduced to one expression
    // (-5 B), and the four capability branches replaced by a table (-8 B here,
    // -4 B on the sdk entry). No unrelated hunt: paying for a correctness fix
    // with an optimisation elsewhere is the trade rejected on the error
    // classifier, and it stays rejected.
    //
    // Measured 44.18 kB. 44.25 kB leaves ~70 B.
    limit: '44.25 kB',
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
    // Raised from 43 kB when the generic adapters stopped casting a void
    // prepareExecute response to a TxReceipt. The cost is the negotiation that
    // replaced the cast: preferring prepareExecuteAndWait, validating its
    // executed-transaction response, and falling back for a wallet that does not
    // implement it (OneSwap). It cannot be code-split — it is on the submit path
    // itself. Measured 43.20 kB, trimmed to 43.15 kB by dropping a completionOffset
    // that TxReceipt has no field for and shortening the log strings without
    // losing the wallet name or the missing method. 43.5 kB leaves ~350 B of
    // headroom, matching the react-native entry above, whose own headroom
    // absorbed this same change without needing a raise.
    //
    // Raised again from 43.5 kB when CIP0103_MANDATORY_METHODS stopped being
    // Object.values(CIP0103_METHODS) and became an explicit list of the
    // specification's ten. The cost IS the explicitness: ten string literals
    // that used to be derived for free. It buys a guarantee worth paying for,
    // that the yardstick we hold other people's wallets to cannot silently
    // widen when this SDK learns a method the standard does not define, so it
    // cannot be optimised away without giving the property back.
    //
    // Measured 43.53 kB. The obvious compaction, referencing
    // CIP0103_METHODS.CONNECT and friends rather than repeating the strings,
    // was tried and is WORSE: it keeps that object alive in every consumer's
    // bundle, came out at 43.55 kB, and pushed react-native 15 B over as well.
    // The raw strings minify well beside their own copies in the object
    // literal. 43.6 kB left ~70 B, deliberately tight.
    //
    // RAISED for the `availability` contract — the same correctness fix that
    // moved the react-native budget above, in the same pull request. The bytes
    // here are `availability` reaching the connect path through installGuard:
    // `detectInstalled()` now reports what a wallet's presence actually IS,
    // because `installed` could only say yes or no and eight of twelve adapters
    // had no honest way to answer it.
    //
    // The false `true` was load-bearing: installGuard read `installed` and threw
    // on false, so returning the truth blocked connect for every wallet with
    // nothing to install (19 sdk failures, all WalletNotInstalledError). The
    // guard now asks its real question — "do we already know this cannot work",
    // which only `not-installed` answers yes to.
    //
    // TWO BUDGETS MOVED TOGETHER FOR THIS ONE CHANGE — this entry point and the
    // other one below/above. That is a fact worth seeing rather than splitting
    // across two commits: the `availability` contract reaches both bundles, so
    // both paid. If a single change ever needs a third budget, that is a signal
    // about the change, not about the budgets.
    //
    // AND AN ATTRIBUTION ERROR WORTH MORE THAN THE BYTE COUNT: the installGuard
    // rewrite was reported as "0 B". It was measured on ONE bundle
    // (react-native), where it genuinely was free, and it cost ~26 B on the
    // other. `pnpm gate` caught that, not the person who measured it. A saving
    // is only a saving on the budgets you actually measured it against — check
    // EVERY budget the changed code reaches, not the first one that looked fine.
    // Compacting the guard to a single ternary then recovered 8 B on the sdk
    // entry and 10 B here.
    //
    // Measured 43.82 kB. 43.85 kB left ~30 B.
    //
    // MOVED ONCE FOR TWO CHANGES, DELIBERATELY. This raise covers BOTH the
    // identity-bridge fix (D5) and the connect/capabilities schema work (D6).
    //
    // D5 was finished, green and ready to ship on its own. It was HELD and
    // folded in here specifically to avoid a fourth isolated move on these
    // budgets: D6 opens the registry schema and was going to move them anyway,
    // so one raise with one argument beats two of each in adjacent pull
    // requests. That restraint is recorded because the record otherwise shows
    // only that the budget moved again, which is the opposite of what happened.
    //
    // What the bytes are, in both cases identity and schema plumbing rather than
    // features:
    //   - D5: `matchKnownByIdentity`, a `.find` matching a resolved provider id
    //     against a wallet id and its declared injection global, so a known
    //     wallet is not minted a SECOND picker row. Observed twice — Nightly
    //     against the real extension, and the demo's own wallet, whose twin
    //     connected to the same provider when clicked.
    //   - D6: the `connect` field read at the top of the transport classifier,
    //     and four capabilities (`transfer`, `ledgerApi`, `popup`, `restore`)
    //     the registry previously could not express at all — which is why
    //     `requiredCapabilities: ['transfer']` matched zero wallets while every
    //     adapter implemented it.
    //
    // Compactions measured and kept: the D5 helper reduced to one expression
    // (-5 B), and the four capability branches replaced by a table (-8 B here,
    // -4 B on the sdk entry). No unrelated hunt: paying for a correctness fix
    // with an optimisation elsewhere is the trade rejected on the error
    // classifier, and it stays rejected.
    //
    // Measured 43.96 kB. 44 kB leaves ~40 B.
    //
    // MOVED A THIRD TIME, for the error classifier. This one is a correctness
    // fix, not a feature, and that distinction is the whole reason it was
    // allowed to move: the alternative was leaving a classifier that told a
    // dApp the user had clicked cancel when no prompt was ever drawn. Nightly
    // refusing because the tab was unfocused ("Connect request rejected - tab
    // is not active") was reported as USER_REJECTED, because classification was
    // a substring scan over prose.
    //
    // What the bytes bought:
    //   - WalletRefusedError as a REAL class, not just a code, so a dApp can
    //     `instanceof` a wallet's own refusal and tell it apart from a user
    //     cancellation. Dropping the class was measured (below) and rejected.
    //   - Structured-signal classification: `err.name` and EIP-1193 4001 first,
    //     then phrasing that actually names the user, then a refusal that is
    //     explicitly NOT the user's.
    //
    // The AbortSignal that makes a connect timeout actually cancel measured at
    // ZERO bytes here — reverting client.ts entirely moved neither budget. The
    // cost is all in the classifier and the class.
    //
    // Four compactions measured, 49 B recovered, two more REJECTED — recorded
    // so the next person does not re-run them:
    //   - merging the two user-detection regexes and the duplicate return
    //     path: -26 B, KEPT.
    //   - slimming WalletRefusedError's constructor to take one details object
    //     instead of a separate originalMessage argument: -6 B, KEPT.
    //   - dropping the class entirely for `new PartyLayerError(..., 'WALLET_REFUSED')`:
    //     -17 B, REJECTED. It buys almost nothing and costs consumers
    //     `instanceof`, and it still would not have cleared the gate.
    //   - replacing the regex with `message.includes('user') && /reject|.../`:
    //     -35 B, REJECTED. It matches "rejected by the wallet, contact user
    //     support", which is the exact class of false positive being fixed.
    //
    // If a FUTURE increase is for a feature rather than a correctness fix, it
    // should be held to a harder standard than this one was.
    //
    // Measured 43.75 kB after the four passes above. 43.8 kB leaves ~50 B.
    limit: '44 kB',
  },
];
