# Devnet run: verifying `requestTransfer`

Follow this top to bottom. You should not need to open any source file.

Three things are being checked, in this order of importance:

1. the returned `updateId` is a **real ledger update id**, not something the
   adapter made up;
2. the wallet **showed you what you were authorising**, and you could decline;
3. a malformed intent is refused **before** the wallet opens.

Nothing else in this document matters as much as (1), because an adapter's own
value cannot be trusted by looking at it.

---

## What you need before starting

| Wallet | Install | Point it at devnet |
|---|---|---|
| **Nightly** | Extension from <https://nightly.app/download> | In the extension's own network setting. **PartyLayer cannot detect a wrong network for Nightly** — the wallet does not report which network it is on, so nothing will warn you. Check it yourself. |
| **Loop** | Nothing to install — QR code / popup | Automatic. The page runs on `devnet`, and Loop is told `devnet`. |
| **Console** | Extension from <https://consolewallet.io> | In the extension. Console does report its network, so a mismatch is detected. |

You also need:

- **Node 18+ and pnpm**, and `pnpm install` already run at the repo root.
- **A second party id to receive the transfer.** Your own second wallet is fine —
  it does not need to be a different person. Any devnet party that exists works.
  You are sending a real (tiny) amount, so use something you control.
- **A small balance** in the sending wallet.

---

## 1. Start the page

```bash
cd examples/test-dapp
VITE_NETWORK=devnet VITE_REGISTRY_URL=https://registry.partylayer.xyz pnpm dev
```

Open **<http://localhost:5173>**.

This app resolves PartyLayer from source, so there is no build step and no
publishing involved.

## 2. Add the transfer panel

Nothing in this repository calls `requestTransfer` yet, so you need one file.
Create **`examples/test-dapp/src/components/TransferPanel.tsx`** and paste this
whole thing:

```tsx
import { useState } from 'react';
import { usePartyLayer } from '@partylayer/react';

export default function TransferPanel() {
  const client = usePartyLayer();
  const [receiver, setReceiver] = useState('');
  const [admin, setAdmin] = useState('');
  const [instrument, setInstrument] = useState('Amulet');
  const [amount, setAmount] = useState('0.01');
  const [out, setOut] = useState('');

  const intent = () => ({
    receiver,
    amount,
    instrumentId: { admin, id: instrument },
    meta: { memo: 'devnet check' },
    executeBefore: new Date(Date.now() + 3600_000).toISOString(),
  });

  async function check() {
    const s = await client.getActiveSession();
    setOut(
      s
        ? `wallet: ${s.walletId}\nparty:  ${s.partyId}\nnetwork: ${s.network}\n` +
          `transfer supported: ${s.capabilitiesSnapshot.includes('transfer')}`
        : 'not connected',
    );
  }

  async function run(bad = false) {
    setOut('approve in your wallet…');
    try {
      const payload = bad
        ? { ...intent(), amount: Number(amount) as unknown as string }
        : intent();
      const result = await client.requestTransfer(payload);
      console.log('requestTransfer OK', result);
      setOut(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('requestTransfer FAILED', err);
      setOut('ERROR\n' + (err instanceof Error ? err.message : String(err)));
    }
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label style={{ display: 'block', margin: '6px 0' }}>
      {label}
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        style={{ width: '100%', fontFamily: 'monospace' }}
      />
    </label>
  );

  return (
    <div className="panel">
      <h2>Typed transfer</h2>
      {field('receiver party id', receiver, setReceiver)}
      {field('instrument admin (DSO party)', admin, setAdmin)}
      {field('instrument id', instrument, setInstrument)}
      {field('amount (string!)', amount, setAmount)}
      <button onClick={check}>check capability</button>{' '}
      <button onClick={() => run(false)}>send transfer</button>{' '}
      <button onClick={() => run(true)}>send amount as a number (must fail)</button>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{out}</pre>
    </div>
  );
}
```

Then add two lines to **`examples/test-dapp/src/App.tsx`** — an import at the top
with the others, and the component inside `<main className="app-main">`:

```tsx
import TransferPanel from './components/TransferPanel';
```
```tsx
<TransferPanel />
```

**For Console only**, also open `examples/test-dapp/src/partylayer.ts` and add
the import and one config line:

```ts
import { ConsoleAdapter } from '@partylayer/adapter-console';
```
```ts
    adapters: [new ConsoleAdapter()],
```

Console's registry entry routes it through the generic path, which does **not**
have `requestTransfer`. Passing the adapter explicitly overrides that. Leaving
this line in does not affect Nightly or Loop, so you can add it once and leave it.

## 3. Connect and check

Connect the wallet, then press **check capability**. You should see
`transfer supported: true`. If it says `false`, stop — the rest cannot work, and
that is itself the finding.

## 4. Fill in the intent

| Field | What to put |
|---|---|
| `receiver party id` | Your second wallet's party id. Copy it from that wallet. |
| `instrument admin` | The **DSO party id** for devnet — see below. |
| `instrument id` | `Amulet` |
| `amount` | `0.01` — as a **string**, which the text box gives you |

For Amulet, the instrument is `{ admin: <DSO party>, id: "Amulet" }`.

**The DSO party id is a live network value and is not in this repository.** It is
a long party id, not the word "DSO". Get it from whichever of these is easiest:
your wallet's own holdings or token detail screen, which usually shows the
instrument's admin; or the Canton Scan API for devnet; or whoever runs the
validator. If you get this wrong the wallet will reject the transfer rather than
send the wrong thing.

Filled in, the call is:

```jsonc
{
  "receiver":     "<your second party id>",
  "amount":       "0.01",
  "instrumentId": { "admin": "<DSO party id>", "id": "Amulet" },
  "meta":         { "memo": "devnet check" },
  "executeBefore": "<one hour from now, ISO 8601>"
}
```

`executeBefore` is filled in automatically. Console **requires** it; the other two
accept it.

## 5. Run it, and read the result

Press **send transfer**. Approve in the wallet.

The result is printed in the panel and also logged to the browser console
(`requestTransfer OK`). It looks like:

```json
{
  "updateId": "0a1b2c…",
  "commandId": "…",
  "partyId": "…"
}
```

You do not need to add any logging. If it fails you get `ERROR` and the message,
which is the correct outcome for a decline.

---

## 6. Verify the update id — the whole point

### 6a. Shape check (do this first, it takes five seconds)

**A Canton update id is a 64-character hexadecimal string.** Anything else is not
an update id.

This one check catches every fake value this codebase has ever produced:
`tx_1735…`, `pending`, an empty string, a UUID-shaped command id, a base64
signature. If `updateId` is not 64 hex characters, stop and report it.

### 6b. Ledger lookup

Then confirm the ledger actually has it, rather than trusting the wallet.

**I could not determine the exact endpoint from this repository, and I am not
going to guess it.** This repo talks to the JSON Ledger API at
`/v2/state/active-contracts`, `/v2/state/ledger-end`, `/v2/commands/…` and
`/v2/interactive-submission/prepare` — it never reads an update by id, so there is
no verified route here to copy. An earlier note of mine cited
`GET /v2/updates/{updateId}`; that was not sourced from anything and should not be
relied on.

What you need to find out, from whoever runs the validator or from its own
OpenAPI/docs page:

1. **the route** for fetching one update by id on the JSON Ledger API version
   your validator exposes (it differs between versions — some expose a `GET` by
   id, others a `POST` "update-by-id" style lookup);
2. **the host** — deliberately not written here, since infrastructure addresses
   do not go in public docs; it is in the private ops notes, referred to as
   `<validator>`;
3. **whether auth is needed**, and if so what token — validators differ, and the
   one you are pointed at may want a bearer token or nothing at all.

The call then looks like:

```bash
curl -s "<validator>/<the route you confirmed>" \
  -H "authorization: Bearer <token, only if your validator wants one>"
```

**Success** returns a transaction/update body containing that same update id and
the events of your transfer. **Missing** returns 404, or an empty result, or an
error saying no such update — any of which means the value the adapter handed you
does not exist on the ledger, which is exactly the failure this method was built
to prevent.

If you cannot get the lookup working, a weaker but still independent check is to
find the transfer in your wallet's own transaction history and confirm the id
matches — weaker because it is the same vendor on both sides.

---

## 7. What to look at on the approval screen

Approve slowly and read the screen before pressing the button.

**All three wallets — a problem if:** nothing appears at all; the amount or payee
differs from what you typed; or declining does not produce an error in the panel
(it must say `ERROR`, not sit there or quietly succeed).

| Wallet | Should show | Watch for |
|---|---|---|
| **Nightly** | payee, amount, instrument **including its admin**, memo, expiry | It is the only one of the three that receives the admin, so it is the one place the issuer could be shown. Record what it actually shows. |
| **Loop** | recipient, amount, instrument, memo, in the popup | Approving without the popup appearing at all. |
| **Console** | payee, amount, token, memo | Console's send request has no admin field (`@console-wallet/dapp-sdk@2.2.8`), so PartyLayer does not pass one. Record whether the screen names the issuer anyway — the wallet may resolve it from its own registry. |

**The Console question is the one worth answering carefully**, because it decides
whether the Console mapping is safe: if two different admins can issue an
instrument with the same id, a screen showing only the symbol does not tell you
which one you are sending. Record what it actually displays.

---

## 8. What to write down

For each of the three wallets:

- the `updateId` returned, and whether it was 64 hex characters;
- whether it resolved on the ledger;
- a screenshot of the approval screen;
- what happened when you declined;
- what the **number amount** button did — it must fail with a message about a
  decimal string **without the wallet ever opening**. If the wallet opens, the
  intent allowlist is not doing its job and that is a serious finding.

Three open questions this run would settle, beyond the above:

1. **Console** — does its confirmation name the issuing admin (§7)?
2. **Console** — with two transfers in flight at once, does it still return the
   right update id, or refuse? The adapter matches the wallet's signature to
   correlate; if that mismatches it refuses rather than guessing.
3. **Loop** — does it always return a real `update_id` on success? The SDK types
   it optional. The adapter throws when it is absent, so a failure here is safe,
   but frequent absence would mean the mapping needs revisiting.
