# Canton wallet platform roadmap

PartyLayer's target is a ready-made Canton wallet experience comparable to
RainbowKit's developer and user experience. This is a product target, not a claim
of completed feature parity. The default wallet catalog release is the foundation;
the remaining milestones below require their own implementation and evidence.

## Developer contract

An existing React application installs `@partylayer/react` and its React Query peer
in one npm command, configures `PartyLayerKit`, and renders `ConnectButton`.
Supported wallet runtimes come with that integration. Developers do not install or
register a PartyLayer package for each wallet. WalletConnect project IDs, enterprise
credentials, network selection and beta opt-in remain explicit application settings.

Starters use the ready-made button and show **Powered by PartyLayer** by default.
Custom interfaces and attribution configuration remain available. English is the
canonical language for repository, website and API documentation; product UI
translations are a separate feature.

## Milestones and completion evidence

| Milestone                              | Current evidence                                                                                                                   | Required before completion                                                                                                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default installation and discovery     | Candidate SDK includes approved official runtimes lazily; clean npm, packed CLI, Next.js, Vite, ESM, CommonJS and SSR checks exist | Publish the tested package set, verify public-registry installation, and keep starter/docs versions aligned                                                                                                                                    |
| Branded connection experience          | `ConnectButton`, wallet modal, themes, avatars and default attribution exist                                                       | Verify the full mobile/desktop connection journey, retry, rejection, popup/extension availability, custom UI and styling behavior                                                                                                              |
| Accounts, parties and networks         | Session hooks, persistence and network filtering exist                                                                             | Complete supported account/party selection and change handling; prevent stale account or network state; explain unsupported wallet actions and required wallet-side changes                                                                    |
| Authentication                         | Message signing exists; it is not an authenticated server session                                                                  | Provide a Canton authentication integration with server-issued single-use nonces, domain/origin binding, expiry, signature verification and logout/session invalidation examples; test replay and account-change rejection                     |
| Transactions and holdings              | Native action/query hooks, cost UI and transaction toast primitives exist                                                          | Integrate account holdings and recent transaction UX; distinguish awaiting approval, submitted, confirmed, rejected, failed and unknown; reconcile actual ledger outcomes without inventing IDs or retrying accepted submissions               |
| Internationalization and accessibility | English/Turkish connection and operation UI, explicit RTL direction, and dialog/account keyboard navigation are implemented; full accessibility review remains open                                            | Complete screen reader, contrast and responsive acceptance against WCAG 2.2 AA; record manual evidence alongside the automated locale/keyboard checks                                                                     |
| Protocol ownership and compatibility   | Generic CIP-0103 provider integration and existing compatibility adapters coexist                                                  | Review official Canton dApp SDK ownership of discovery/transports/session state, record the architecture decision, and provide versioned migration guidance before any breaking replacement; add no new per-wallet PartyLayer adapter packages |
| Dependency and release maintenance     | Candidate daily Dependabot configuration and existing release gates                                                                | Confirm update PRs run after merge, review API changes and pinned loader metadata, publish changesets, verify package provenance and document rollback; a new vendor release is not automatically production-approved                          |
| Final wallet acceptance                | Per-wallet live results and unresolved issues are recorded in `releasing.md`                                                       | Resume deferred live tests, including Loop and Vala; test connect/reject/sign/restore/disconnect and valid ledger submissions on supported networks, record versions/results, and resolve or accurately constrain unavailable features         |

Each milestone needs implementation, consumer-facing documentation and appropriate
automated checks. A primitive or a passing mocked transport test alone does not
complete its user journey. Remaining live tests are intentionally scheduled after
the code and product milestones, at the maintainer's request.

## What carries over from RainbowKit

The comparison baseline includes ready-made wallet management and theming,
[authentication](https://rainbowkit.com/docs/authentication),
[localization](https://rainbowkit.com/docs/localization), custom wallet lists,
custom interfaces and recent transaction UX. See the official
[RainbowKit introduction](https://rainbowkit.com/docs/introduction).

Ethereum-specific facilities such as ENS resolution, Sign-In with Ethereum and
EVM chain/provider methods are not copied into Canton APIs. PartyLayer needs
appropriate Canton account/party identity, authentication and CIP-0103 behavior.
Wallet support varies: the UI must disclose actual capabilities, never imply that
every wallet supports every operation.

Neither a connection kit nor a successful message signature proves a swap or a
transfer works. A dApp/protocol constructs the valid commands and any token-standard
flow; PartyLayer connects the wallet, exposes supported actions and reports their
actual results. Final acceptance must include valid transfers and protocol-specific
swap outcomes on the ledger, with test funding and user approvals where required.

The release status and current wallet evidence are maintained in
[Release Process](./releasing.md#default-wallet-release-validation). Do not describe
the entire roadmap or all wallets as verified while these criteria remain open.
