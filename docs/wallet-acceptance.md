# Wallet acceptance evidence and test environments

Review date: 2026-10-24. This page distinguishes automated code evidence, actual
wallet approvals and independently confirmed ledger outcomes. The candidate is
not a certification of every wallet deployment or complete WCAG conformance.

## Accessibility

`apps/demo/e2e/accessibility.spec.ts` runs axe-core's WCAG 2 A/AA, 2.1 A/AA and
2.2 AA rule tags against the kit UI, without disabling rules or excluding a
reported violation. It runs in the PR browser suite and attaches JSON reports.

The four Chromium scenarios pass:

- Light picker, empty search and wallet education.
- Dark picker, empty search and wallet education.
- 320 × 720 Turkish/RTL picker, labels and page reflow.
- Connected account menu labels, roles and contrast with a controlled demo wallet.

The initial scan found faded attribution text at 3.06:1 in light mode and 4.39:1
in dark mode. Removing its opacity restores the theme's readable foreground.
Native Chrome accessibility inspection also found duplicate wallet names from
icons plus adjacent text; picker icons are now decorative. Existing keyboard
specs cover modal focus containment, Escape and trigger focus restoration.

These tests use a development-only wallet. They do not prove vendor approval,
cryptographic verification or live transaction execution. They do not cover every
possible custom theme, browser/assistive technology or dynamic application state.

### VoiceOver acceptance remains open

The maintainer authorized temporary VoiceOver activation. Its initial system
setting was off. Activation through System Settings showed on, but the application
inventory continued to show VoiceOver not running, direct launch timed out, and
VoiceOver navigation produced no observed speech/caption or cursor response.
The setting was returned to off and verified. VoiceOver Utility alone is not the
screen reader, and inspecting Chrome's accessibility tree is not a VoiceOver pass.

Resume with a functioning VoiceOver session and record the spoken dialog name,
search and wallet labels, connection progress/error announcements, focus
containment, Escape/return focus, help/back navigation and connected account menu.
Also cover equivalent mobile assistive-technology behavior before claiming broad
screen-reader acceptance.

Reproduce automated acceptance locally:

```bash
pnpm --filter @partylayer/react build
pnpm --filter partylayer-demo exec playwright test accessibility.spec.ts connection-keyboard.spec.ts
```

Do not run multiple Next dev/build processes against the same app output directory.

## Wallet code checks

The [integration matrix](./wallet-cip0103-matrix.md) records the actual default
paths, registry networks, installed versions and upgrade decisions. All registry
entries are exercised by catalog/capability/network tests. Packed npm consumers
load the real default factories rather than requiring per-wallet imports.

`prepare-execute.test.ts` and `native-session.test.ts` check that a contradictory
returned command ID cannot become a successful normalized or raw-provider result.
`vendor-receipt-contract.test.ts` exercises Vala's installed published runtime with
controlled HTTP/popups: matching command accepted, unrelated executed event
rejected, no second write. It does not contact the live Vala service.

A server-side authentication verifier must still validate the exact message and
independently authorized party key. Shape/echo validation is not cryptographic
verification. See [authentication](./authentication.md).

## Available transaction test environments

| Environment | Verified purpose | Requirements and limits |
| --- | --- | --- |
| [OneSwap Devnet](https://devnet.oneswap.cc) | Public Devnet application; launch reaches its login. Official docs explicitly support Devnet swaps. | A test account, supported pair/liquidity, test balance and a valid deposit/command flow. Integrator API uses a server-only key and explicit `environment: 'devnet'`; its default is Mainnet. No swap or deposit was submitted in this review. |
| [Loop Devnet](https://wallet.devnet.looptech.io) | Official wallet testing environment. | Separate Devnet account and balance. Loop documents no public Devnet/Testnet faucet: request funding from Loop with the network and party ID. The observed key-unlock problem remains wallet-side acceptance work. |
| [Vala Devnet](https://dev.vala-wallet.cc) | Existing beta wallet integration and maintainer test account. | Deployment must enable the dApp API, plus test balance and a vendor-valid `prepareExecute` example. Those remain prerequisites to actual ledger acceptance. |
| [PartyLayer tokenization](https://tokenization.partylayer.xyz) and [DvP](https://dvp.partylayer.xyz) | Repository documents live Devnet demo backends. | Gateway submits as participant-local demo parties, independently of the connected wallet. Useful for token hooks/ledger behavior, **not** proof of wallet signing. Devnet resets require re-onboarding; current remote health was not established in this review. |
| [Canton dAppBooster](https://github.com/BootNodeDev/canton-dappbooster) | Open-source local Canton development stack. | Node, Docker and Daml SDK setup. Suitable for reproducible local contract/ledger tests; local success does not establish compatibility with a vendor's hosted Devnet wallet. Not installed or provisioned in this review. |

[OneSwap quickstart](https://docs.oneswap.cc/quickstart) documents Devnet selection
and server-only credentials. Its [swap lifecycle](https://docs.oneswap.cc/guides/swaps)
also provides a deposit-party flow: sending the input token initiates the swap,
and the protocol later returns output or a refund. Reconcile that protocol's final
outcome as well as the wallet's input transfer; a deposit alone is not swap success.
[Loop's official integration guide](https://support.looptech.io/en/articles/16925385-how-to-integrate-your-app-with-loop)
provides its test URLs and funding instructions.

Send is Mainnet-only in the catalog. Do not attempt to manufacture a Devnet Send
result or use a real-value Mainnet swap as an implicit test. Nightly's published
CantonSwap docs identify a Mainnet RPC; they are not evidence of a Devnet faucet.

## Final live acceptance procedure

For each supported wallet/network, record wallet/runtime version, origin, time,
party and effective network; then test connect approval/rejection, message
signing/rejection, restoration and disconnect. Confirm unsupported operations are
not offered. Do not repeat account login tests already accepted solely because
another code test ran.

For send, obtain a funded test party, a controlled receiver, exact instrument ID
including issuer/admin, decimal-string amount, expiry and a valid command payload.
Preview what will be approved, submit once, then independently read the actual
ledger update and verify the intended sender, receiver, instrument and amount.
A command ID, a hash-shaped string or a resolved Promise is not proof.

For swap, additionally validate the protocol's quote, expiry/slippage, input and
output instruments, disclosures/approvals and final settlement or refund. Confirm
both ledger legs (or the documented protocol lifecycle), not just wallet approval.
Keep uncertain outcomes unknown and reconcile read-only before any explicit retry.

The live results remain in
[release validation](./releasing.md#default-wallet-release-validation). Final
screen-reader and vendor/ledger acceptance are still open; public npm publication
requires a separate final review of the tested package set.
