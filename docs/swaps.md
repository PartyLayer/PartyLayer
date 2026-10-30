# Canton swap integration and settlement

PartyLayer is the connection, approval and transaction lifecycle layer. It is not
a liquidity venue or a universal swap router. A real swap additionally needs a
chosen protocol, supported token pair/network, current quote, explicit user intent
and proof of output or refund. A successful message signature or deposit transaction
does not complete that journey.

## Keep wallet and protocol responsibilities explicit

1. Authenticate the application user and bind the intended wallet party/network.
2. Obtain a protocol quote on the server. Resolve both instruments by issuer and id,
   not symbol alone. Present amount, fees, price impact, minimum output and deadline.
3. Create/store a durable business intent with a unique id and the accepted quote.
   Derive its owner from the server session, not a client-supplied user id.
4. Prepare the protocol's exact transfer/allocation commands and fresh disclosures.
   Recheck party, network, quote expiry and parameters immediately before approval.
5. Request the supported wallet action once. Track submission separately from its
   correlated ledger result. An unknown response must be reconciled, not replayed.
6. Track the protocol outcome separately until output, refund or an authoritative
   terminal failure is known. Refresh holdings from an authorized complete snapshot.

For a DvP protocol, the app coordinates allocations and final atomic settlement;
allocation approval is not proof that settlement already happened. CIP-0056
defines the token workflows, while the venue defines its execution rules. See
[CIP-0056](https://github.com/canton-foundation/cips/blob/main/cip-0056/cip-0056.md),
[multi-party patterns](./multi-party-patterns.md) and
[transaction lifecycle](./transaction-lifecycle.md).

## Concrete example: OneSwap's deposit workflow

The [official OneSwap quickstart](https://docs.oneswap.cc/quickstart) and
[swap lifecycle](https://docs.oneswap.cc/guides/swaps) describe a deposit-based
protocol rather than a wallet signing a DvP swap. Its server-only SDK is a
**protocol dependency**, distinct from the OneSwap wallet provider already in
PartyLayer's catalog. It is not required by the standard Connect Wallet setup.

Use the vendor SDK's explicit Devnet environment for testing. Keep its integrator
API key on the application server. The server requests a quote, creates a swap
bound to its authenticated user and the quoted pool, and stores the returned swap
id, deposit party, amounts, minimum output and deadline. The wallet then approves
the precise input-token transfer through PartyLayer. Resolve protocol symbols to
trusted issuer/id metadata before constructing that transfer; never guess an issuer.

Monitor the stored swap id through an owner-authorized server endpoint. The vendor's
`returned` outcome means output was returned to the funding party; `refunded` is a
different result. Recovery/review states remain pending. A local polling timeout
does not make a protocol swap failed. Before a new attempt, recover the user's
existing open swap and original deposit rather than creating/funding a duplicate.
See the vendor's current guides for supported pairs, quote limits, tolerance,
deadlines and cancellation rules; do not hardcode those commercial parameters
as permanent PartyLayer guarantees.

## Acceptance evidence

Use funded test accounts and a documented valid protocol transaction. Record:

| Stage | Required evidence |
| --- | --- |
| Quote | Network, issuer/id of both instruments, amounts, minimum output, expiry and protocol intent id |
| Approval | The wallet displays the intended operation; rejection sends nothing |
| Submission | Exactly one wallet write; keep the original command id and real update id if returned |
| Ledger | Authenticated lookup correlates the original command with the actual ledger update |
| Business settlement | Protocol output/refund plus corresponding authorized ledger/holding evidence |
| Recovery | Reload, account/network change and lost response never create a second deposit |

Do not expose a generic participant-admin forwarding endpoint to make a demo pass.
An app-local participant demo is not proof of connected-wallet signing. Automated
fixtures and this recipe are preparation; live protocol acceptance requires the
vendor configuration, test funding and user approval, which are tracked separately.
