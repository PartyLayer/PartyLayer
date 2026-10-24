# Wallet integration and verification matrix

Reviewed on 2026-10-24 against this candidate branch, the registry and installed
published wallet runtimes. This is an integration inventory, not a certification
that every deployed wallet can sign or settle every transaction.

The stable registry contains ten entries; beta adds Vala on Devnet. The runtime
catalog filters by network, credentials and actual implemented capabilities.
Use `client.listWallets()` and the connected session capability snapshot rather
than interpreting registry metadata as a guarantee that a method is available.

## Connection paths

| Wallet | Default runtime path | Registry networks | Important boundary |
| --- | --- | --- | --- |
| Console | CIP-0103 announce through official discovery | Devnet, Testnet, Mainnet | Native account/network responses; declared base64 message encoding. The old SDK wrapper is an explicit compatibility path. |
| Send | CIP-0103 announce through official discovery | Mainnet | Mainnet-only; never offer it as a Devnet test wallet. |
| Cauri | Official `cauriAdapterFactory` through shared discovery | Devnet, Mainnet | Hosted approval. Native provider events can be forwarded; the generic adapter does not promise normalized transaction-status events. |
| OneSwap V2 | Official provider adapter through shared discovery | Devnet, Mainnet | `prepareExecuteAndWait` is unsupported; negotiate once, then use `prepareExecute`. Fresh explicit connection is required after reload. |
| Walley | Official `WalleyAdapter` through shared discovery | Devnet, Testnet, Mainnet | Hosted popup and its declared network host; official SDK requires the older compatible Canton SDK peer. |
| Vala | Official `valaAdapterFactory` through shared discovery | Devnet, beta only | Deployment signing API must be enabled. Live transaction acceptance remains open. No transaction-status event guarantee. |
| Loop | Existing compatibility integration with official Loop SDK | Devnet, Mainnet | Popup/QR transport. Message signing, ledger submission and intent-level transfer are separate operations. |
| Cantor8 | Existing compatibility integration with official C8 SDK | Devnet, Mainnet | Real hosted popup, not a deep-link stub. The shipped 0.4 runtime has no message signing; submit acknowledgement contains a command ID, not a ledger update ID. |
| Nightly | Existing compatibility integration with injected Canton API | Devnet, Testnet, Mainnet | Callback API, not a generic CIP provider. Wallet network must be checked in the wallet where it cannot be read independently. |
| WalletConnect | Existing integration with official Canton SDK | Devnet, Testnet, Mainnet | Requires an application project ID and an actual compatible wallet/approved session. |
| Bron | Existing OAuth/remote signer integration | Devnet, Testnet, Mainnet | Requires enterprise credentials. Submission is not implemented by this integration. |

Network entries above describe the PartyLayer catalog, not live acceptance on all
networks. New wallets use the generic announce or official ProviderAdapter path;
**do not add a new per-wallet PartyLayer package**. See
[protocol ownership](./protocol-ownership.md) and [provider guide](./wallet-provider-guide.md).

## Installed versions and upgrade policy

The following versions were resolved in the lockfile and compared with npm metadata
on the review date. Latest means an upstream release exists, not that its API has
passed PartyLayer's compatibility and live acceptance checks.

| Published runtime | Installed | Latest reviewed | Decision |
| --- | --- | --- | --- |
| `@canton-network/core-wallet-discovery` | 1.15.0 | 1.15.0 | Official native discovery owner. |
| `@fivenorth/loop-sdk` | 0.15.1 | 0.15.1 | Current; the observed private-key unlock failure is not evidence of an outdated SDK. |
| `@console-wallet/dapp-sdk` | 2.2.8 | 3.0.0 | Retained for the explicit legacy wrapper. Default native announce does not depend on this wrapper. Review 3.x separately before replacing its contract. |
| `@cantor8/wallet-connect-sdk` | 0.4.0 | 0.9.0 | Retained compatibility version. 0.9 adds signing and changes account/session handling; those features are not advertised by the shipped 0.4 integration. |
| `@k2flabs/walley-dapp-sdk` | 1.2.0 | 1.2.0 | Current; preserve its `@canton-network/dapp-sdk ^0.24.0` peer. |
| `@lithiumdigital/cauri-dapp-sdk` | 0.2.0 | 0.2.0 | Current. |
| `@oneswap/wallet-cip0103-adapter` | 0.2.0 | 0.2.0 | Current; its older PartyLayer core peer is tested through a normal packed npm install, without forcing peer resolution. |
| `@vala-wallet/dapp-sdk` | 0.1.0 | 0.1.0 | Current; contradictory command IDs are rejected at the shared SDK/provider boundary. |

Daily dependency PRs and release gates review upgrades. Do not automatically ship
an unreviewed upstream runtime, or rewrite the version table without checking the
lockfile and current upstream metadata. See [release maintenance](./releasing.md).

## Submission and signature guarantees

- A native provider keeps its real account list, key metadata, ledger response and
  events. Compatibility projections do not invent those values.
- Message signature shape, party/echo consistency and post-approval live identity
  checks are separate from cryptographic verification. Authentication backends must
  verify the exact challenge with independently authorized party keys.
- Prefer `prepareExecuteAndWait`; fall back only on an explicit unsupported-method
  response (4200 or -32601). Rejection, timeout and an incomplete accepted receipt
  never trigger a second submission.
- When a request supplies `commandId`, a contradictory returned command ID is an
  unknown outcome, not success. This applies to normalized submissions and native
  `asProvider()` execution calls. Missing IDs still require independent correlation.
- A plain acknowledgement or command ID is not ledger confirmation. Read the real
  ledger update and reconcile the expected parties, instrument, amount and outcome.
- A successful signature does not validate token transfer or swap commands. An app
  or protocol must construct those commands and provide its authorized read sources.

### Vala upstream correlation limitation

The published 0.1.0 provider's `prepareAndWait` assigns the polled event's
`commandId` before comparing it, so a different ID can pass its local filter.
PartyLayer's installed-runtime contract test feeds an unrelated completed event
through the public provider and verifies it is rejected without another write.
A matching event remains accepted. This is controlled evidence, not a claim that
an unrelated live event was observed. Vala should correlate polling with the
created request; PartyLayer cannot repair its server or prove omitted identifiers.

## Evidence and remaining acceptance

Automated default-catalog tests cover every registry wallet across all three
network filters, optional credentials, capabilities and beta restrictions.
Generic/native tests cover lifecycle, identity, origin, network and submission
boundaries. Packed consumers exercise the real installed default factories.
The Vala receipt contract test uses the published runtime with controlled HTTP and
popup boundaries. None of these substitutes for wallet approvals and real ledger
acceptance.

The current live results are in
[release validation](./releasing.md#default-wallet-release-validation).
[Acceptance evidence and test environments](./wallet-acceptance.md) records the
accessibility checks, Devnet options and remaining prerequisites.
[Typed transfer support](./typed-transfer-support.md) describes the optional
intent-level API separately from generic command submission.

## Primary references

- [Canton CIP-0103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)
- [Official Canton wallet SDK](https://github.com/canton-network/wallet)
- [Loop integration and test funding](https://support.looptech.io/en/articles/16925385-how-to-integrate-your-app-with-loop), [API reference](https://github.com/fivenorth-io/loop-sdk/blob/main/docs/api-reference.md)
- [Cauri SDK](https://github.com/lithiumdigital/cauri-dapp-sdk)
- [OneSwap SDK quickstart](https://docs.oneswap.cc/quickstart), [swap lifecycle](https://docs.oneswap.cc/guides/swaps)
- [Walley SDK](https://www.npmjs.com/package/@k2flabs/walley-dapp-sdk)
- [Cantor8 documentation](https://cantor8.mintlify.app/), published 0.4.0 and 0.9.0 package types/README
- [Console SDK](https://www.npmjs.com/package/@console-wallet/dapp-sdk), published 2.2.8 and 3.0.0 package types/README
- [Nightly Canton commands](https://docs.nightly.app/docs/canton/canton/transaction_commands/)
- [Vala SDK](https://www.npmjs.com/package/@vala-wallet/dapp-sdk), published 0.1.0 provider source/types
