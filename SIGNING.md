# Registry signing — hardening debt (post-M1)

**Status: tracked, NOT yet implemented. The production wallet registry is currently UNSIGNED, by design, at the dev stage.**

## Why this exists

The wallet registry (`registry/v1/<channel>/registry.json`) supports Ed25519
signature verification end-to-end, but verification is **gated entirely on the
consumer configuring `registryPublicKeys`** — and no shipping consumer does:

- `RegistryClient.verifyRegistrySignature()` returns `true` (skips) when
  `publicKeys.length === 0` — see `packages/registry-client/src/client.ts:181-184`.
- `requireSignature = this.publicKeys.length > 0` (`client.ts:213`); when false,
  the `.sig` is **not even fetched** (`client.ts:286-314`).
- `this.publicKeys = options.registryPublicKeys || []` defaults empty
  (`client.ts:100`); `PartyLayerClient` only forwards `config.registryPublicKeys`
  (`packages/sdk/src/client.ts:181`).
- No shipping consumer sets `registryPublicKeys` (the demo passes `registryUrl`
  but no keys; `examples/` set none) — so the sole rejection path,
  `RegistryVerificationFailedError` (`client.ts:305-310`), is unreachable in
  production today.

Consequently the committed `registry/v1/*/registry.sig` files are empty and
CI's "Verify Registry Signatures" step (`.github/workflows/ci.yml:57-66`) is
conditional on a committed `.sig` + `registry/keys/dev.pub`, both absent, so it
no-ops. `gate:registry` validates shape + the CIP-0103 footgun guard +
provider.id disjointness — deliberately **not** the signature.

Adding/updating registry entries while unsigned therefore breaks no consumer.
This is acceptable at the current stage; making signatures **real** end-to-end
is the hardening slice below.

## The proper-signing slice (STEP-0 this separately before building)

1. **Key generation** — mint the production Ed25519 keypair
   (`pnpm registry:sign --generate-key` produces `registry/keys/dev-<ts>.{pub,key}`;
   the production key must NOT reuse a dev key).
2. **Secure key storage** — the **private** key lives out-of-repo (gitignored,
   like the npm token); never committed. Decide the custody mechanism (CI
   secret / external secret manager) before generating the real key.
3. **Sign on release** — wire `pnpm registry:sign --channel <c> --key <path>`
   into the registry release flow so every registry change reproduces a fresh
   `registry.sig`. (Re-sign on every content change — the signature is over the
   exact JSON bytes.)
4. **Activate CI verification** — commit the **public** key (`registry/keys/dev.pub`)
   and a real `registry.sig`; the existing conditional verify step in
   `ci.yml` then runs for real (`pnpm registry:verify --channel <c> --pubkey …`).
5. **Consumer-side distribution** — define how `registryPublicKeys` reaches
   consumers (SDK-bundled default? documented opt-in?) so verification is
   actually enforced end-to-end, not just available. Until this step, signing is
   produced-but-unverified.

## Scope note

This is its OWN hardening slice — explicitly NOT folded into Walley go-live or
any single registry-entry change. Entries ship unsigned until step 5 lands.

---

# The key ceremony

## Current status: NO PRODUCTION KEY EXISTS

Read this first, because the rest of this section is written in the present
tense and describes a procedure, not a thing that has happened.

- **No production signing key has been generated.** Not by anyone, not
  anywhere. `registry/keys/` does not exist in this repository, and its absence
  is not evidence that a key is being kept somewhere else.
- **Nothing is signed.** Neither channel has a `registry.sig`. The registry is
  served unsigned, exactly as the top of this document says.
- **The holder and backup-holder fields below are deliberately blank.** They are
  not an oversight and not a redaction. There is nobody to name yet.
- **Generating the key is a separate decision that has not been taken.** The
  guardrails and this procedure landed first, on purpose, so that the decision
  can be made later without also having to invent the process under time
  pressure. Custody in particular is open: the arrangement described below is
  the proposal, not a settled choice.

If you are reading this in three months and want to know whether a key exists,
the answer is in this section and in `git log`, not in anyone's memory. If a key
has since been generated, this block should have been replaced with the holder
names and the fingerprint. If it still says what it says now, no key exists.

## Why it was written early

A ceremony invented at the moment it is needed gets skipped under pressure, and
the transition it was supposed to protect is the thing that gets dropped.

**This repository is public.** The public key, the `.sig` files, `sign.ts`,
`verify.ts` and this document all belong in it: publishing them is what lets
anyone verify the registry independently. The private key must never be in it,
and never in CI.

## Where the private key lives

- **On one operator's machine, outside the repository working tree**, at a path
  they choose, mode `0600`. The suggested location is
  `~/.partylayer-keys/registry-prod.key`.
- **Not in CI.** Registry changes are infrequent and already go through PR
  review, so a manual signing step is cheaper than a workflow that holds a
  production signing key and can commit to `main`.
- **Not in the repository**, enforced three ways rather than trusted:
  1. `.gitignore` covers `*.key`, `*.pem`, `*.p8`, `*.p12`, `*.pfx`, the
     `id_*` names, and everything under `registry/keys/` except `*.pub`.
  2. `scripts/registry/sign.ts` **refuses** to write a private key to any path
     inside the working tree, and requires an explicit `--private-key-out`.
  3. `pnpm gate:no-private-keys` fails the build if key-shaped material is
     tracked, by filename and by content, and runs first in the gate chain.

## Who can use it

One named holder at a time, plus one named backup who holds a copy under the
same conditions. The holder signs; nobody else needs the key, because
verification only ever needs the public half.

    Holder:  (none, no key exists)
    Backup:  (none, no key exists)

Both fields are filled in **in the same change that generates the key**, never
after. A key whose holder is not written down is a key nobody can be asked
about, and the backup holder is the only thing between a lost machine and an
emergency rotation.

The single-holder arrangement is a proposal and is the open question in this
document: it puts one person in the path of every registry publish. Settle it
before generating, not after.

## Generating it

```
pnpm registry:sign --generate-key \
  --private-key-out ~/.partylayer-keys/registry-prod.key
```

Writes the private key to that path at mode `0600` and the public key to
`registry/keys/<fingerprint>.pub`, which **is** committed. The command fails if
`--private-key-out` is missing or points anywhere inside the repository.

Then, before committing anything: `pnpm gate:no-private-keys`.

## Signing a registry change

```
pnpm registry:sign --channel stable --key ~/.partylayer-keys/registry-prod.key
pnpm registry:sign --channel beta   --key ~/.partylayer-keys/registry-prod.key
```

The signature covers the **exact UTF-8 bytes** of `registry.json`. Any
reformatting, key reordering or whitespace change invalidates it, so re-sign on
every content change and never hand-edit a signed file afterwards.

## Rotation

Written now, not when it is first needed.

`registryPublicKeys` is an array and `verifyRegistrySignature` tries each key in
turn, which is what makes a rotation possible without a flag day. The procedure:

1. Generate the new pair. Do not touch the old one yet.
2. Commit the new `.pub` **alongside** the old one.
3. Ship an SDK release whose bundled default array contains **both** keys, old
   first. Nothing breaks: registries signed by the old key still verify.
4. Wait for that release to reach consumers. This is the slow step and it
   cannot be rushed; a consumer pinned to an older SDK only knows the old key.
5. Re-sign both channels with the new key. Consumers on the new release verify
   against the second entry; consumers on the old release now fail, which is
   why step 4 gates this one.
6. Ship a later release that drops the old key from the array, and delete the
   old `.pub`.

Never skip step 3. Rotating by replacing the key in one move breaks every
consumer that has not yet upgraded, and the pressure will then be to disable
verification rather than to finish the rotation.

## If a private key is exposed

Treat any of these as exposure: the key appears in a commit on any branch, in a
fork, in CI logs, in a shell history shared in a screenshot, in a launch
command, or in a chat message. **This project has already lost one key through a
launch command**, so this is a known failure mode rather than a theoretical one.

A private key that reaches public git history is compromised **permanently**.
Deleting the file does not undo it: the object stays in history, in every clone,
in every fork, and in GitHub's own caches of the pre-rewrite objects. Do not
treat a revert as remediation.

What to do, in order:

1. **Assume it is used.** Do not wait for evidence of misuse.
2. **Rotate immediately**, following the procedure above, but compressed: it is
   better to break unupgraded consumers than to keep trusting a key someone
   else may hold.
3. **Delete the old `.pub`** and re-sign both channels with the new key.
4. **Do not rewrite history to hide it.** Rewriting breaks every fork and clone
   and does not remove the object from GitHub. Record what happened instead.
5. **Write down how it escaped**, in this file, in the same spirit as the rest
   of the guardrails here. The launch-command exposure is why `sign.ts` now
   refuses to write to the working tree at all; each incident should leave a
   control behind it.

## What is deliberately public

`registry/keys/*.pub`, both `registry.sig` files, `sign.ts`, `verify.ts`, this
document, and the fingerprint of the active key. None of it weakens the scheme.
A verification scheme whose public half is secret is not verifiable by anyone,
which defeats the purpose of signing the registry in the first place.
