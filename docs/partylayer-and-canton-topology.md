# PartyLayer and Canton Topology: Where Your DARs Go

A question comes up often when a team first wires up PartyLayer with their own DAML
templates: "Do I publish my DAR to the wallets' validators, or do I publish it to
PartyLayer's validator, which then bridges it to the wallets?"

The honest answer is neither. PartyLayer has no validator and is not a bridge in that
sense, so there is nothing on PartyLayer's side to publish a DAR to. Where your DARs go
is a pure Canton topology question, and it is the same answer whether or not you use
PartyLayer. This guide clears up the boundary so you can reason about it correctly.

---

## What PartyLayer is, and what it is not

PartyLayer is a CIP-0103 wallet connection SDK. It connects the user's wallet, requests
signatures, and relays a prepared transaction to the wallet, which submits it through the
wallet's own validator.

It is not any of these:

- It is not a validator. There is no PartyLayer participant node, and no PartyLayer DAR
  store. You cannot upload a DAR "to PartyLayer" because there is nothing there to upload
  it to.
- It is not a ledger bridge. PartyLayer does not sit on the ledger data path, does not
  forward your contracts between participants, and does not synchronize transactions.
- It is not a participant and does not host parties. Parties are hosted by Canton
  participants (validators), not by PartyLayer.

A note on the word "bridge", because PartyLayer uses it in one specific and unrelated
place. The [generic bridge](./generic-bridge.md) is the wallet discovery handshake: the
CIP-0103 announce mechanism (the Canton analog of EIP-6963) by which wallets announce
themselves to the dApp. That is a front-end discovery bridge between a dApp and browser
wallets. It is not a ledger bridge, and it has nothing to do with where DARs live or how
transactions synchronize. Do not let the two senses of the word collide.

---

## Where your DAML packages (DARs) must live

This is governed by Canton, independent of PartyLayer. The rules that matter here:

- There is no global DAR repository. Canton has no central place that all participants
  read packages from. Participants cannot read each other's packages.
- For two participants to synchronize a transaction that uses your templates, both must
  have uploaded and vetted the same DAR before submission. If a participant involved in
  the transaction has not vetted your package, the transaction is rejected (for example
  with a package-not-vetted error, or `NO_DOMAIN_FOR_SUBMISSION` when no synchronizer can
  route it because of the missing vetting).

So the rule of thumb is: your package must be vetted on every participant that hosts a
party that is a stakeholder (a signatory or observer) on your contracts. In practice that
means:

- Your application's own validator, which hosts your app's parties and submits your
  transactions. Your DAR is uploaded and vetted there.
- The validator of any wallet whose user's party is a stakeholder on your templates. If a
  user's party is a signatory or observer on one of your contracts, the participant
  hosting that party must have your package vetted in order to validate the transaction.

And the important narrowing: a wallet whose user only connects and signs, where that
user's party is not a stakeholder on your contracts, does not need your DAR. The DAR
requirement follows stakeholder participation, not connection. A party that merely
authenticates and signs something, without being a signatory or observer on your
templates, does not pull your package onto its hosting participant.

This is a Canton property. PartyLayer does not change it, relax it, or work around it.

---

## Where PartyLayer fits in this picture

Once your packages are vetted on the participants that need them, PartyLayer handles the
front-end connection and signing flow. Its role, in Model 2 terms (the data model where
the dApp owns ledger transport):

- Connect the user's wallet over CIP-0103.
- Read your contracts through your own Ledger API or JSON API. PartyLayer's query hooks,
  `useDamlContract` and `useChoice` in the `/query` entrypoint, are schema-agnostic
  wrappers around a fetcher that you supply. They wrap your read and exercise calls in
  TanStack Query for caching and state, but the actual ledger read goes through your
  transport, not through PartyLayer. PartyLayer is not a ledger client.
- Relay the prepared transaction to the wallet for signing and submission. The wallet
  submits through its own validator.

PartyLayer never changes where DARs live or who vets them. It is the connection and relay
layer in front of a topology you have already set up correctly.

---

## The picture

```
   Your dApp                         PartyLayer                    User's wallet
   (your validator,                  (connection + relay,          (its own validator;
    your DAR vetted)                  not a validator,              your DAR vetted there
        |                             not on the data path)         only if the user's
        |                                   |                        party is a stakeholder)
        |   read your contracts via         |                                |
        |   YOUR Ledger API / JSON API      |                                |
        |   (Model 2: you supply the        |                                |
        |    fetcher; hooks wrap it)        |                                |
        |                                   |   connect / sign / relay        |
        |  <------------- PartyLayer connection -------------------------->   |
        |                                   |   prepared tx                   |
        |                                   |                                 v
        |                                   |                          submit via the
        |                                   |                          wallet's validator
        v                                   |                                 |
   ------------------------------ Canton ledger / synchronizer ------------------------------
        (a transaction synchronizes only if every stakeholder's hosting participant
         has your DAR vetted; PartyLayer is the connection, never the data path)
```

The data path for reading contracts is your dApp to your Ledger API. PartyLayer is the
connection and signing relay alongside it, not in the middle of it.

---

## Common misconceptions

- "PartyLayer bridges my DAML to the wallets." No. Whether two participants can transact
  on your templates is governed by Canton topology and DAR vetting. PartyLayer connects
  the wallet and relays a prepared transaction; it does not move your packages or your
  contract data between participants.
- "I upload my DAR to PartyLayer." There is no PartyLayer validator to upload to. DARs go
  to Canton participants (your validator, and any stakeholder party's hosting
  participant).
- "The generic bridge bridges my ledger." The generic bridge is wallet discovery (the
  CIP-0103 announce handshake), not a ledger bridge.
- "PartyLayer reads my contracts for me." PartyLayer's hooks wrap a fetcher you supply.
  The read goes through your Ledger API or JSON API. PartyLayer is not a ledger client.

---

## See also

- [Architecture](./architecture.md)
- [Generic Bridge (wallet discovery)](./generic-bridge.md)
- [Dev and Staging guide](./dev-and-staging.md)
- [Quick Start Guide](./quick-start.md)
