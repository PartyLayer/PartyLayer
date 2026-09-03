/**
 * Hand-written integration notes, one per wallet. This module IS the content
 * gate for /wallets/<id>: a wallet with an entry here gets an indexable page in
 * the sitemap, a wallet without one gets a generated page marked noindex.
 *
 * HOW THESE ARE WRITTEN, and it is not a style preference.
 *
 * CONTRIBUTING.md, "A document citing no source outside itself is not evidence",
 * records a failure that happened on these exact pages' subject matter: a
 * document stated that a third-party wallet "signs; it does not submit", sourced
 * only from this repository's own adapter for it. An adapter that implements no
 * submit path is evidence about the adapter, not about the vendor's service.
 *
 * So every sentence here is a claim about OUR integration, sourced from our
 * adapter code and our registry entry, and is written that way:
 *
 *   yes  "ConsoleAdapter exposes no switchNetwork path."
 *   no   "Console Wallet cannot switch networks."
 *
 * Where something is not available, `notAvailable` names the reason without
 * telling the vendor what to build. Anything about what a wallet's own service
 * does belongs to that wallet's documentation, which `homepage` links to.
 */

export interface NotAvailable {
  /** The capability a reader might reasonably expect. */
  what: string;
  /** Why it is not available through this adapter. About our code, not theirs. */
  why: string;
}

export interface Gotcha {
  title: string;
  body: string;
}

export interface Trouble {
  /** What the developer sees. Verbatim message text where the adapter has one. */
  symptom: string;
  /** Why it happens, sourced from the adapter. */
  cause: string;
  /** What to do about it. */
  fix: string;
}

export interface WalletNote {
  /** One paragraph: what this integration is and who it suits. */
  summary: string;
  /** Extra package to install beyond @partylayer/react, if any. */
  installPackage: string;
  /** Real construction, mirroring apps/shared-adapters/src/index.ts. */
  construct: string;
  /** Whether construction needs configuration the app must supply. */
  requiresConfig: boolean;
  /** What the connect call actually does, in order. */
  connectionFlow: string;
  /** What this wallet's transport class means for the app building against it. */
  transportImplication: string;
  notAvailable: NotAvailable[];
  gotchas: Gotcha[];
  troubleshooting: Trouble[];
}


export const WALLET_NOTES: Record<string, WalletNote> = {
  console: {
    summary:
      'ConsoleAdapter is the reference integration in this repository and the one with the widest surface. It is the only adapter here whose registry entry declares an announce transport, so an installed wallet is discovered through the CIP-0103 announcement rather than by probing a window property. It reaches all three networks, and it is the only one in this set that serves desktop and mobile from a single entry.',
    installPackage: '@partylayer/adapter-console',
    construct: `import { ConsoleAdapter } from '@partylayer/adapter-console';

// No configuration required. The default target is 'combined': the adapter
// tries the extension first and falls back to the QR and deep-link flow.
const console = new ConsoleAdapter();

// Pin a single path when you do not want the fallback:
//   new ConsoleAdapter({ target: 'local' })   extension only
//   new ConsoleAdapter({ target: 'remote' })  QR and deep link only`,
    requiresConfig: false,
    connectionFlow:
      "With the default 'combined' target the adapter resolves its transport at connect time rather than up front, so until connect succeeds there is no transport to report. That is why diagnostics show no transport for a combined-mode adapter that has not connected yet. In 'local' mode it calls checkExtensionAvailability() first and refuses to start a flow that cannot finish.",
    transportImplication:
      "Because one adapter covers both the extension and the QR path, a single picker entry serves a desktop user with the extension installed and a phone user without it. The cost is that you cannot tell in advance which path a given user will take, so any copy you write around the connect button has to make sense for both. If you need to know, pin the target and register two entries rather than reading the transport before connect.",
    notAvailable: [
      {
        what: 'switchNetwork',
        why: 'The registry entry declares switchNetwork: false, and ConsoleAdapter exposes no switchNetwork path. Configure the network on PartyLayerKit instead.',
      },
      {
        what: 'multi-party flows',
        why: 'The registry entry declares multiParty: false. Nothing in ConsoleAdapter implements a multi-party path.',
      },
    ],
    gotchas: [
      {
        title: 'signMessage sends base64, not raw text',
        body: "ConsoleAdapter base64-encodes the message's UTF-8 bytes before sending. The registry entry records this as adapter config signMessageBase64: true. If you compare a signature against one produced by signing raw bytes elsewhere, they will not match.",
      },
      {
        title: 'transfer requires an explicit deadline',
        body: 'ConsoleAdapter refuses a transfer intent with no executeBefore, throwing CapabilityNotSupportedError rather than choosing a deadline for you. Always set intent.executeBefore as an ISO 8601 timestamp.',
      },
      {
        title: 'connect throws rather than inventing a party id',
        body: "Earlier versions returned a generated party id of the form party-<timestamp> when the wallet returned none. That value never came from the wallet, and a session carrying it failed later, far from the cause. ConsoleAdapter.connect now throws instead. This was our defect, not the wallet's.",
      },
    ],
    troubleshooting: [
      {
        symptom: 'WalletNotInstalledError: "Console Wallet extension not detected. Install from https://consolewallet.io"',
        cause: "The adapter is running in 'local' target, or resolved to the local path, and checkExtensionAvailability() reported a status other than installed.",
        fix: "Leave target at the default 'combined' so the QR and deep-link path stays available, or gate the wallet behind an install call to action when you deliberately pin 'local'.",
      },
      {
        symptom: '"Console Wallet returned no party id from getPrimaryAccount, so there is no account to connect."',
        cause: 'The connect handshake completed but getPrimaryAccount came back without a partyId, so there is no account to build a session from.',
        fix: 'Treat it as a failed connect and let the user retry. Do not synthesise an id: this is the exact case where the adapter used to fabricate one and fail later instead.',
      },
      {
        symptom: 'CapabilityNotSupportedError mentioning "ledgerApi"',
        cause: 'The connected extension build does not expose the CIP-0103 ledgerApi method, so the adapter has nothing to proxy the request to.',
        fix: 'Feature-detect before offering ledger reads in your UI, and handle the rejection rather than assuming ledgerApi is always present.',
      },
      {
        symptom: 'Connect rejects with the wallet\'s own reason text',
        cause: 'The connect result came back with isConnected false; the adapter surfaces the reason the wallet gave rather than replacing it.',
        fix: 'Show that reason to the user. It is the wallet\'s message, not ours, and it is usually more specific than anything generic we could substitute.',
      },
    ],
  },

  loop: {
    summary:
      'LoopAdapter connects through a script-loaded SDK rather than a browser extension, so there is nothing for a user to install first. The registry classifies its transport as a QR or popup flow opened by the wallet SDK. It is available on devnet and mainnet, and it is one of two adapters in this set that can restore a session without a fresh scan.',
    installPackage: '@partylayer/adapter-loop',
    construct: `import { LoopAdapter } from '@partylayer/adapter-loop';

// No configuration required.
const loop = new LoopAdapter();`,
    requiresConfig: false,
    connectionFlow:
      'Detection returns true in any browser because the SDK is script-loaded rather than injected, so there is no installed-or-not signal to read before the user starts. The wallet SDK opens its own window. On a return visit the adapter tries an auto-connect restore first and falls back to a fresh flow if that times out.',
    transportImplication:
      'There is no install state to render, which changes the shape of your picker: selecting this wallet always opens a flow, and a user with no Loop account discovers that only after the window appears. Budget for a visible cancel path and a retry, because a QR flow that the user abandons is a normal outcome here rather than an error condition.',
    notAvailable: [
      {
        what: 'signTransaction',
        why: 'The registry entry declares signTransaction: false. LoopAdapter offers submit but no detached sign-only path.',
      },
      {
        what: 'testnet',
        why: 'The registry entry lists devnet and mainnet only.',
      },
    ],
    gotchas: [
      {
        title: 'updateId is the ledger update id, and is omitted when absent',
        body: "LoopAdapter previously reported the SDK's submission_id under updateId. A submission id identifies the request, not the committed update. It now reads the SDK's own update_id and omits the field entirely when there is none, so a caller can tell \"no update id\" apart from a substituted one. This was our defect, not the wallet's.",
      },
    ],
    troubleshooting: [
      {
        symptom: '"Connection timeout, user did not complete QR scan"',
        cause: 'The connect flow opened and no scan completed inside the adapter\'s window.',
        fix: 'This is a user outcome, not a fault. Keep the modal open, offer a retry, and do not log it as an error.',
      },
      {
        symptom: '"Loop Wallet auto-connect timed out, session not restorable"',
        cause: 'The restore path ran on a return visit and did not complete in time.',
        fix: 'Fall back to a fresh connect. Treat restore as an optimisation that may not land, not as a step that must succeed.',
      },
      {
        symptom: '"Browser environment required"',
        cause: 'A connect or restore call ran where there is no window, typically during server-side rendering.',
        fix: 'Guard the call behind a client-side effect. The wallet UI in this repository already does this; a custom picker has to do it too.',
      },
      {
        symptom: '"Not connected to Loop Wallet"',
        cause: 'signMessage, submitTransaction or a ledger read was called before connect resolved.',
        fix: 'Gate those calls on session state rather than firing them optimistically after opening the modal.',
      },
    ],
  },

  cantor8: {
    summary:
      'Cantor8Adapter is the narrowest integration in this set: through it a dApp can submit transactions and read their status, and nothing else. If your app gates anything on a signed message, this adapter is not the path. It is also the one adapter here whose submit call takes a wallet-SDK-shaped payload rather than the shape the other adapters accept, which is the detail most likely to cost you an afternoon.',
    installPackage: '@partylayer/adapter-cantor8',
    construct: `import { Cantor8Adapter } from '@partylayer/adapter-cantor8';

// dappUrl defaults to the page origin, which is what you want in a browser app.
const cantor8 = new Cantor8Adapter();

// Override only when the origin the wallet should see differs from the page's:
//   new Cantor8Adapter({ dappUrl: 'https://app.example.com' })`,
    requiresConfig: false,
    connectionFlow:
      'The adapter passes a dApp URL into the wallet SDK popup handshake, defaulting to the page origin. The wallet SDK owns the popup and the postMessage channel back to your page.',
    transportImplication:
      'The origin your page runs on is part of the handshake, so a deployment whose public origin differs from the one the browser sees, behind a proxy or on a preview URL, is the case to check first when a handshake never completes. Overriding dappUrl exists for exactly that, and is not something a normal browser app needs to set.',
    notAvailable: [
      {
        what: 'signMessage',
        why: 'The registry entry declares signMessage: false and Cantor8Adapter implements no signMessage path. useSignMessage() will not work through this adapter.',
      },
      {
        what: 'signTransaction',
        why: 'The registry entry declares signTransaction: false.',
      },
    ],
    gotchas: [
      {
        title: 'submitTransaction takes the wallet SDK\'s signAndExecute input',
        body: 'This adapter does not accept the same signedTx shape as the others. It requires the object the wallet SDK\'s signAndExecute expects: { note?, partyId, commandId, commandsJson, disclosedContracts? }. Passing a signed payload built for another adapter fails here.',
      },
      {
        title: 'Plan the connect UI around submit-only',
        body: 'Because this integration supports neither signMessage nor signTransaction, an app that gates login on a signed message has no path through this adapter. Decide that before you offer the wallet in your picker, not after a user selects it.',
      },
    ],
    troubleshooting: [
      {
        symptom: '"Cantor8 returned no account after connect"',
        cause: 'The popup handshake resolved but carried no account for the adapter to build a session from.',
        fix: 'Treat it as a failed connect and retry. Check that the origin in the handshake matches the origin the browser is actually on.',
      },
      {
        symptom: 'submitTransaction rejects with a message about signedTx shape',
        cause: 'The payload was not the wallet SDK signAndExecute input this adapter forwards.',
        fix: 'Build { partyId, commandId, commandsJson } and pass disclosedContracts and note when you have them. The rejection names the required keys.',
      },
      {
        symptom: '"Browser environment required"',
        cause: 'A connect call ran with no window available, typically during server-side rendering.',
        fix: 'Move the call into a client-side effect.',
      },
    ],
  },

  nightly: {
    summary:
      'NightlyAdapter is a browser-extension integration, discovered through the window property the registry entry names. It supports message signing and transaction submission across all three networks, and unlike the popup and QR wallets it can tell you whether the extension is present before the user commits to a flow.',
    installPackage: '@partylayer/adapter-nightly',
    construct: `import { NightlyAdapter } from '@partylayer/adapter-nightly';

// No configuration required.
const nightly = new NightlyAdapter();`,
    requiresConfig: false,
    connectionFlow:
      'Detection reads the window property declared in the registry entry, so the adapter can distinguish an installed extension from a missing one before the user picks the wallet. A return visit attempts a session restore before opening a fresh prompt.',
    transportImplication:
      'Because detection is real here, your picker can show an install call to action instead of a connect button when the extension is absent, which is the single biggest usability difference between an extension wallet and a QR one. Extensions also inject on page load, so a wallet selected immediately after a hard refresh can occasionally be probed before injection lands; treat a first-attempt miss as retryable rather than final.',
    notAvailable: [
      {
        what: 'signTransaction',
        why: 'The registry entry declares signTransaction: false. Submission is available; a detached sign-only path is not.',
      },
      {
        what: 'transaction status',
        why: 'The registry entry declares transactionStatus: false, so this integration does not report a committed status back to the app.',
      },
    ],
    gotchas: [
      {
        title: 'submitTransaction throws rather than returning a synthetic hash',
        body: "When neither an updateId nor a signature comes back, NightlyAdapter.submitTransaction throws instead of returning a generated tx_<timestamp>_<random> value. Handle the rejection; do not expect a placeholder. This was our defect, not the wallet's.",
      },
      {
        title: 'No committed status to poll',
        body: 'With transactionStatus false, a successful submit tells you the wallet accepted and forwarded the command, not that it committed. If your UI needs a settled state, read it from the ledger yourself rather than waiting on this adapter.',
      },
    ],
    troubleshooting: [
      {
        symptom: 'WalletNotInstalledError: "Nightly wallet not detected. Install from https://nightly.app/download"',
        cause: 'The window property the registry entry names was not present when the adapter probed for it.',
        fix: 'Render an install link rather than a connect button. If it fires immediately after a page load, retry once before showing it, in case the extension had not injected yet.',
      },
      {
        symptom: '"Failed to restore Nightly wallet session"',
        cause: 'The restore attempt on a return visit did not produce a usable session.',
        fix: 'Fall back to a fresh connect. Restore is an optimisation here, not a guarantee.',
      },
      {
        symptom: '"Browser environment required"',
        cause: 'Detection or connect ran with no window, typically during server-side rendering.',
        fix: 'Guard the call behind a client-side effect.',
      },
    ],
  },

  bron: {
    summary:
      'BronAdapter is the only integration here that authenticates with OAuth2 against an API rather than talking to something in the browser. The registry classifies its transport as an enterprise API. It is also the only adapter in this set whose constructor requires configuration, and the only one that expects your application to own part of the auth flow rather than handling all of it internally.',
    installPackage: '@partylayer/adapter-bron',
    construct: `import { BronAdapter } from '@partylayer/adapter-bron';

// requiresConfig: true in the registry entry. Both blocks are mandatory.
const bron = new BronAdapter({
  auth: {
    authorizationUrl: process.env.NEXT_PUBLIC_BRON_AUTH_URL!,
    tokenUrl: process.env.NEXT_PUBLIC_BRON_TOKEN_URL!,
    clientId: process.env.NEXT_PUBLIC_BRON_CLIENT_ID!,
    redirectUri: \`\${window.location.origin}/callback\`,
    usePKCE: true, // recommended for a browser client
  },
  api: { baseUrl: process.env.NEXT_PUBLIC_BRON_API_URL! },
});`,
    requiresConfig: true,
    connectionFlow:
      'The adapter holds an auth client and an API client. It opens the authorization URL in a popup, and access tokens are kept in memory by default rather than written to storage. There is no URL-inferred or NODE_ENV-inferred mock: a test that wants one constructs it explicitly.',
    transportImplication:
      'Nothing about this adapter runs in the user\'s browser extension or a wallet popup you do not control, which means the failure modes are the ones you already know from OAuth rather than wallet ones: popup blockers, redirect URI mismatches, and token lifetime. It also means the wallet is only available to users your OAuth client already recognises, so it belongs behind a different entry point in most apps than the self-custody wallets.',
    notAvailable: [
      {
        what: 'submitTransaction',
        why: 'The registry entry declares submitTransaction: false, and BronAdapter implements no submit path. What the Bron service itself offers is a question for Bron, not something this repository has established.',
      },
      {
        what: 'transaction status',
        why: 'The registry entry declares transactionStatus: false.',
      },
    ],
    gotchas: [
      {
        title: 'Your application handles the OAuth callback, not the adapter',
        body: 'The adapter does not implement the redirect handler. It says so directly: an unimplemented callback path raises "OAuth callback not implemented in adapter, handle in app". You must serve the route named by redirectUri, read the authorization code from the query string, and complete the exchange yourself. This is the step most likely to be missed on first integration.',
      },
      {
        title: 'Use PKCE in the browser',
        body: 'BronAuthConfig accepts an optional clientSecret for server-side flows. Do not put one in a browser bundle. Set usePKCE: true instead, which is what the config documents as the browser recommendation.',
      },
      {
        title: 'It will not appear in a picker without config',
        body: 'Because the constructor requires config, the shared adapter builder in this repository returns null for Bron when none is supplied, and the wallet is simply absent from the list. If it is missing from your picker, check your configuration before looking at the registry.',
      },
    ],
    troubleshooting: [
      {
        symptom: '"OAuth callback not implemented in adapter, handle in app"',
        cause: 'The adapter deliberately stops at the point where your application must take over the redirect.',
        fix: 'Implement the route at redirectUri. Read the code parameter, complete the token exchange, and hand the result back to your session layer.',
      },
      {
        symptom: '"Failed to open auth popup"',
        cause: 'The browser blocked the popup, usually because the call did not originate from a user gesture.',
        fix: 'Trigger connect directly from a click handler. Do not start it from an effect, a timer, or after an await that breaks the gesture chain.',
      },
      {
        symptom: '"No authorization code in callback"',
        cause: 'The redirect landed on your callback route without a code parameter, typically a redirect URI that does not match the one registered with the authorization server.',
        fix: 'Check that redirectUri matches the registered value exactly, including scheme, host, port and trailing path.',
      },
      {
        symptom: '"OAuth flow requires browser environment"',
        cause: 'connect ran with no window available.',
        fix: 'Call it from the client. This adapter cannot complete an interactive OAuth flow during server rendering.',
      },
      {
        symptom: '"Transaction signing denied"',
        cause: 'The signing request was refused upstream.',
        fix: 'Surface it as a rejection rather than a retry loop, and check that the access token still covers the scopes the request needs.',
      },
    ],
  },

  walletconnect: {
    summary:
      'WalletConnectAdapter reaches wallets over a relay rather than through anything installed in the page. It is the one entry in the stable registry whose cip0103 block declares native: false, so it is driven through this adapter rather than treated as a CIP-0103 provider. It needs a WalletConnect Cloud project id, and it is the only adapter in this set where your application renders the pairing QR itself.',
    installPackage: '@partylayer/adapter-walletconnect',
    construct: `import { WalletConnectAdapter } from '@partylayer/adapter-walletconnect';

// requiresConfig: true in the registry entry. projectId is mandatory.
const walletconnect = new WalletConnectAdapter({
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  metadata: {
    name: 'Your dApp',
    description: 'What the wallet shows the user during pairing',
    url: 'https://app.example.com',
    icons: ['https://app.example.com/icon.png'],
  },
  // Wire the pairing URI to your own QR UI:
  onUri: (uri) => setPairingUri(uri),
});`,
    requiresConfig: true,
    connectionFlow:
      'The adapter fires onUri once the session proposal is created; that URI is what your QR component renders. The CAIP-2 chain is derived from the network configured on PartyLayerKit, so the two cannot drift. Set chainId only to pin a chain regardless of the configured network.',
    transportImplication:
      'The pairing URI is yours to display, so unlike every other adapter here there is no wallet-owned window that appears on its own: if you do not implement onUri, the user sees nothing happen. In exchange the same integration reaches any wallet on the relay rather than one vendor, and the metadata block you pass is what those wallets show the user, so it is worth filling in properly rather than leaving placeholder text.',
    notAvailable: [
      {
        what: 'signTransaction',
        why: 'The registry entry declares signTransaction: false. Through this adapter the sign and submit steps are one call, so there is no detached signature to return; use submitTransaction.',
      },
      {
        what: 'transaction status',
        why: 'The registry entry declares transactionStatus: false.',
      },
    ],
    gotchas: [
      {
        title: 'Sign and submit are a single step',
        body: 'Calling signTransaction rejects with a message pointing you at submitTransaction, because on this path the two are fused and there is no intermediate signed payload to hand back. Structure your flow around one approval, not two.',
      },
      {
        title: 'submitTransaction throws rather than returning "pending"',
        body: "This adapter previously returned the literal string pending as a transactionHash when it had no real value. It now throws, matching the Send adapter. Handle the rejection. This was our defect, not the relay's.",
      },
      {
        title: 'The project id is not optional',
        body: 'Without a WalletConnect Cloud project id there is no pairing to establish, so the constructor rejects rather than failing later. Supply it from your own environment rather than hardcoding one.',
      },
    ],
    troubleshooting: [
      {
        symptom: '"WalletConnectAdapter requires a `projectId`."',
        cause: 'The adapter was constructed with no project id, usually an environment variable that did not reach the browser bundle.',
        fix: 'Check the variable is exposed to client code. In Next.js that means a NEXT_PUBLIC_ prefix; a bare name is undefined in the browser.',
      },
      {
        symptom: 'Nothing visible happens after the user picks the wallet',
        cause: 'onUri was not wired, so the pairing URI was produced and discarded with no QR rendered.',
        fix: 'Pass onUri and render the URI as a QR code. This adapter has no window of its own to open.',
      },
      {
        symptom: 'signTransaction rejects pointing at submitTransaction',
        cause: 'There is no detached signing step on this path.',
        fix: 'Call submitTransaction and treat the single approval as both steps.',
      },
      {
        symptom: '"Failed to restore WalletConnect session"',
        cause: 'A stored session could not be re-established against the relay, for example after it expired.',
        fix: 'Fall back to a fresh pairing. Clear any UI that assumed a live session first.',
      },
    ],
  },
};
