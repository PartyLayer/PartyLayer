# Contributing to PartyLayer

Thank you for your interest in contributing to PartyLayer! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Adding a wallet](#adding-a-wallet)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Secrets and Infrastructure Hygiene](#secrets-and-infrastructure-hygiene)
- [Testing](#testing)
- [Documentation](#documentation)
- [Reproducible Builds](#reproducible-builds)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and constructive in discussions
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **pnpm 9+** - Install with `npm install -g pnpm`
- **Git** - [Download](https://git-scm.com/)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/PartyLayer.git
cd PartyLayer
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/PartyLayer/PartyLayer.git
```

---

## Development Setup

### Install Dependencies

```bash
pnpm install
```

### Enable Git Hooks

Point git at the repository's hooks directory so the `pre-commit` check runs
before every commit. It blocks commits made with a local-hostname email like
`user@MacBook-Pro.local`, which would leak machine names on public commits.

```bash
git config core.hooksPath .githooks
```

You only need to do this once per clone.

### Build All Packages

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Start Development

```bash
# Start the demo app
pnpm dev

# In another terminal, start the registry server
pnpm --filter registry-server dev
```

### Verify Everything Works

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Run all tests
pnpm test
```

---

## Making Changes

### 1. Create a Branch

Always create a branch for your changes:

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code patterns
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build to ensure everything compiles
pnpm build
```

**A change is not ready until `pnpm gate` passes**, not just the individual commands above.
The gate builds every package and then diffs its type surface and packaging against the
committed snapshots in `tooling/api-snapshots/` (`gate:api`). A package's own tests and
`pnpm typecheck` do not do that, so they can be green while a renamed method or a changed
public type leaves a snapshot stale. When `gate:api` flags a change, regenerate with
`pnpm gate:api:update`, review the diff to confirm only your change moved, and commit the
snapshot.

### 4. Commit Your Changes

Use conventional commit messages (see [Commit Messages](#commit-messages)).

```bash
git add .
git commit -m "feat: add wallet connection retry logic"
```

---

## Adding a wallet

A new wallet does **not** need a PartyLayer-specific adapter package. The packages under
`packages/adapters` predate the generic bridge and are kept for compatibility; that
directory is closed to new wallets, and a gate enforces it. See
[packages/adapters/README.md](packages/adapters/README.md).

Integrate through one of the two generic paths, shipping no PartyLayer-specific code:

**If the wallet lives in the page, Path A. If it is a remote service or opens a popup,
Path B.**

- **Path A, announce.** The wallet announces itself over `canton:announceProvider` and
  PartyLayer drives it with no adapter object. A browser extension is the usual case.
- **Path B, discovery adapter.** The wallet ships its own package exporting an object
  satisfying the official `ProviderAdapter` shape, and the dApp hands that object to
  PartyLayer. A gateway, a hosted wallet, or a popup is the usual case.

A deep link is how a wallet is opened, not a third path. Both paths carry equal weight.
The full guide, including the CIP-0103 methods each path implements, is the
[generic bridge guide](https://partylayer.xyz/docs/generic-bridge).

### Registry entries: beta first, then promotion

A Path A wallet works with no registry presence at all. An entry is additive: it puts the
wallet's name and icon in the picker and can opt into optional capabilities
declaratively, still with no code.

New entries land in the `beta` channel first so they can be exercised without affecting
dApps on `stable`, and are promoted to `stable` once verified. The process, the schema,
and the signing steps are in
[docs/registry-onboarding.md](docs/registry-onboarding.md).

### Declare capabilities truthfully

dApps read the capability snapshot at runtime to decide what to offer a user: a wallet
that claims `signMessage` or `events` will be asked for it, and an entry that overstates
what a wallet implements breaks that wallet's own users at the moment they try to use it.
That is true whether or not the file is signed, and the registry is not signed today (see
`SIGNING.md`). Claim only what the wallet actually implements. An honest, smaller entry is always better than an
aspirational one, and a capability can be added by a later entry once it ships.

In particular, set `capabilities.signMessage: false` if the wallet cannot sign an arbitrary
message, for example a custodial wallet. On the announce path that declaration is
authoritative: the reported capability set then omits `signMessage`, so a dApp never offers
a sign action the wallet would reject.

---

## Pull Request Process

### 1. Update Your Branch

Before submitting, sync with upstream:

```bash
git fetch upstream
git rebase upstream/main
```

### 2. Push Your Branch

```bash
git push origin feature/my-feature
```

### 3. Create Pull Request

1. Go to GitHub and create a Pull Request
2. Fill in the PR template
3. Link any related issues
4. Request review from maintainers

### 4. PR Requirements

- [ ] Full gate passes (`pnpm gate`), which runs the api and packaging snapshot checks the commands below do not
- [ ] Tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Documentation updated (if needed)
- [ ] Changeset added (for package changes)

### 5. Adding a Changeset

For changes that affect published packages:

```bash
pnpm changeset
```

Follow the prompts to describe your changes.

---

## Coding Standards

### TypeScript

- Use strict mode
- Prefer `const` over `let`
- Use explicit return types for public functions
- Avoid `any` - use `unknown` if type is truly unknown

```typescript
// Good
export function connect(options: ConnectOptions): Promise<Session> {
  // ...
}

// Avoid
export function connect(options: any): any {
  // ...
}
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `wallet-adapter.ts`)
- **Classes**: `PascalCase` (e.g., `ConsoleAdapter`)
- **Functions**: `camelCase` (e.g., `createPartyLayer`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TIMEOUT`)
- **Types/Interfaces**: `PascalCase` (e.g., `WalletMetadata`)

### Code Organization

```typescript
// 1. Imports (external, then internal)
import { useState } from 'react';
import type { Session } from '@partylayer/core';

// 2. Types/Interfaces
interface MyComponentProps {
  session: Session;
}

// 3. Constants
const DEFAULT_TIMEOUT = 30000;

// 4. Main code
export function MyComponent({ session }: MyComponentProps) {
  // ...
}

// 5. Helper functions (if not exported)
function helperFunction() {
  // ...
}
```

### Error Handling

- Use typed error classes from `@partylayer/core`
- Provide meaningful error messages
- Include error codes for debugging

```typescript
import { WalletNotInstalledError } from '@partylayer/core';

throw new WalletNotInstalledError(
  this.walletId,
  'Console Wallet extension not detected. Please install it from the Chrome Web Store.'
);
```

---

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons, etc. |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

### Examples

```bash
# Feature
git commit -m "feat(sdk): add session timeout configuration"

# Bug fix
git commit -m "fix(react): prevent memory leak in useSession hook"

# Documentation
git commit -m "docs: update installation instructions"

# Breaking change
git commit -m "feat(core)!: rename Session to WalletSession

BREAKING CHANGE: Session type has been renamed to WalletSession"
```

---

## Secrets and Infrastructure Hygiene

Public text must never leak infrastructure details. This rule covers every public surface of
the project: commit messages, pull request titles and descriptions, and all issue, pull
request, and review comments.

Do not include, in any of those places:

- host addresses (IP addresses or DNS names of servers we operate),
- login usernames (for example a `user@host` style login), or
- other infrastructure identifiers (server hostnames, internal service names, or ports tied
  to a specific host).

Refer to the production validator host by its SSH alias `partylayer-prod`. The alias keeps the
real host, user, and key in the private ops notes, which are not committed to this repo. In
documentation examples use a placeholder such as `<validator>` rather than a real address.

Verification evidence that contains concrete host values (command output, logs, or scan
results) belongs in the private session report, never in any public text.

---

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @partylayer/core test

# Watch mode
pnpm --filter @partylayer/core test --watch

# With coverage
pnpm test -- --coverage
```

### Writing Tests

We use [Vitest](https://vitest.dev/) for testing.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createSession } from './session';

describe('createSession', () => {
  it('should create a valid session', () => {
    const session = createSession({
      walletId: 'console',
      partyId: 'party::alice',
      network: 'devnet',
    });

    expect(session.walletId).toBe('console');
    expect(session.partyId).toBe('party::alice');
  });

  it('should throw on invalid partyId', () => {
    expect(() => {
      createSession({
        walletId: 'console',
        partyId: 'invalid',
        network: 'devnet',
      });
    }).toThrow();
  });
});
```

### Test Guidelines

- Test behavior, not implementation
- Use descriptive test names
- One assertion per test when possible
- Mock external dependencies

#### A required field with no honest value is a defect factory

Before adding a required field to a type an adapter must return, ask what an
implementation does when it has no value for it. If the answer is "there is no
sensible answer", the field must be optional. Otherwise every implementation
that lacks the value invents one, because the type leaves it nowhere to put
nothing.

This is not hypothetical here. `TxReceipt.transactionHash` and
`SignedTransaction.transactionHash` were required, and nine sites across five
adapters manufactured a value to satisfy them: `tx_<now>_<random>`, `tx_<now>`,
`'pending'` three times, `''`, a command id, and a signature. **Not one was a
fallback anybody designed.** Each was written by someone with a working adapter,
a wallet that reported no hash, and a compiler demanding a string.

The failure mode is worse than an obviously wrong value. `''` is present,
well-typed and falsy, so it passes a null check while carrying nothing. A command
id in a field named `transactionHash` is a real value under a wrong name, which
for anyone reading the field by its name is the same error as a fabricated one.

#### Searching finds the shapes you already know

Two of those nine sites were found only when the field was made optional. A
survey looking for exactly that problem, with the patterns fresh in mind, had
already been over the same adapter and declared it clean — it missed them because
they were ternaries rather than `??` chains. The count in the report was seven.
It was nine.

Nothing about the search was careless. It was a search, and a search enumerates
what you thought to look for. What found the last two was not a better pattern:
it was making the field optional, so every write site had to be revisited because
it no longer compiled.

**Where a defect class can be expressed as a type constraint, change the type and
let the compiler enumerate.** A grep enumerates what you thought of; a type
enumerates what exists. The same holds for anything else the toolchain can be
made to check for you — a lint rule, a schema, a gate script. Prefer the check
that fails on instances nobody has imagined yet.

This is worth stating as a rule because it keeps recurring, and the instances
look nothing alike. Four in two days. The first three happened in a sibling
repository rather than this one, but the shape is identical and they are more
useful named than summarised:

1. **An object prop.** A link check searched the source for `href="/app/..."`.
   Two primary calls to action were written as
   `primary={{ href: '/app/observe' }}` — the href inside an object prop rather
   than an attribute — so the check never saw them. They shipped as 404s on a
   live product page.

2. **A bare filename.** A citation guard searched for full paths of the form
   `packages/sdk/src/...`. Four citations written as bare adapter filenames were
   never checked.

3. **A gerund.** A claim sweep searched for the string `"closes itself"` and
   missed `"each one closing itself"` — inside the very commit that was
   correcting the claim.

4. **A ternary.** The two Bron sites above, written as `cond ? a : b` rather than
   the `??` chains the sweep had been shaped around.

What these share is not carelessness, and reading them as carelessness is the way
to keep repeating them. In every case the person searching knew exactly what they
were looking for, and **each search returned everything it was capable of
returning.** The pattern was the limit, not the effort. A fifth instance is
already written, somewhere, in a form nobody has pictured yet — which is the
argument for handing the enumeration to something that does not have to picture
it.

#### A citation that cannot be followed reads as verified

A comment pointing at a file, test or scenario that does not exist is worse than
no comment: it carries the authority of a reference while proving nothing. One
was found claiming a dev-only guard was "verified in
packages/react/src/native-readiness.test.ts (scenario K)". There is no scenario
K, and nothing in that file mentions the guard.

An audit of 659 source files found **166 in-repo path citations inside comments,
40 of which pointed at nothing.** Three kinds, handled differently:

- **Dead pointers to scratch files** — four comments cited a `/tmp/` markdown
  file that existed only on one machine. Removed; the explanations above them
  stood on their own without the pointer.
- **Provenance to deleted code** — twelve section dividers cited paths in a
  marketing app that no longer exists. Reworded to past tense with the paths
  dropped, plus one note explaining what happened to it. The attribution is
  worth keeping; the unfollowable path is not.
- **Near-misses** — roughly two dozen write `core/adapters.ts` for
  `packages/core/src/adapters.ts`, or `provider/bridge.ts`. **Left alone
  deliberately.** A reader resolves them in seconds, they are unambiguous in
  context, and rewriting two dozen paths by hand is churn with a real chance of
  introducing a path that is wrong rather than merely short.

**On measuring this: the first scanner reported 21, and it could not see the
case that prompted the audit.** It filtered to lines starting with `//` or `*`,
which misses JSX `{/* … */}` blocks entirely — continuation lines inside them
carry no marker, and that is exactly where the phantom citation lived. Rewritten
with a real block-comment parser, the count went from 21 to 40. If you audit
comments, parse comments; do not pattern-match the lines you expect them to
start with.

#### A run that ends without a verdict is not a pass

Check for the verdict line, not for the absence of red. A command that was
killed, timed out, or died mid-suite prints no failure — and a log with no
failures in it looks exactly like a log from a run that passed. `pnpm gate`
was observed stopping at step 20 of 22, inside `verify-e2e`, having printed no
`ELIFECYCLE` and no `not ok`. Scrolling it would have read as clean.

So: assert on the thing that only a completed run produces — the exit code, the
`# pass N / # fail 0` tally, the `Tests N passed` summary, the final gate step.
If it is absent, the result is UNKNOWN and must be reported as unknown. Do not
merge on it, and do not report it as green.

This is the same failure as a test that passes for a reason unrelated to its
name: both produce a signal that reads as success while carrying no evidence.
The habit that catches both is asking what this output would look like if the
thing had gone wrong, and checking that it would look different.

#### A test that chooses at runtime whether to assert is not a test

`packages/adapters/console` had 33 tests written as `it.skipIf(!isBrowser)`
with `isBrowser = typeof window !== 'undefined'`, under `environment: 'node'`.
The condition was always false. None of the 33 ran, for as long as they had
existed, and the suite reported `55 tests | 33 skipped` — green, with 60% of the
adapter's coverage absent. Among the missing were the `detectInstalled` contract
tests, which pass once run; their absence let an unrelated defect through.

Running them found two that were themselves broken in ways only running could
reveal: one asserted a `target` value the adapter had deliberately stopped
sending, and one could never reach the code it named because the shared mock
always defined the method whose absence it was testing — it "passed" by
resolving where it claimed to reject. Both had been green for as long as they
had been skipped.

The weaker form is the same defect: an assertion inside `if (!isBrowser) { ... }`
runs, but only covers the guard branch, so the path that actually ships has no
coverage while the test's name says otherwise.

**Declare the environment, do not branch on it.** A test needing a different
environment puts `// @vitest-environment node` as the first line of its own
file; vitest honours that over the package config. The environment becomes a
fixture instead of a runtime branch that can silently decide to assert nothing.
`gate:test-skips` fails the build on any environment conditional in a test file,
and prints per-package skip counts on every run so a skip has somewhere to be
noticed. It enforces the shape rather than policing a number, because policing a
number invites the 34th `skipIf`.

#### A fix can introduce the defect it removes

When you do make such a field optional, sweep for `String(x)` on it. That pattern
compiles and renders the literal text `"undefined"`.

Three of those appeared in the change that removed the placeholders — the same
defect wearing the fix's clothes, and harder to spot than the originals, because
a fabricated `tx_<now>` at least looks wrong on sight while `"undefined"` arrives
looking like ordinary output. The compiler is no help here: `String(undefined)`
is valid and total.

So after a change of this kind, ask the question the change itself invites: what
new way of producing nothing-shaped-as-something did I just create? For
optionality specifically that is `String(x)`, template interpolation, and string
concatenation. Each renders `undefined` without complaint.

#### A document citing no source outside itself is not evidence

The three rules above are about checks that could not see what was there. This
one is the same failure pointing the other way: a document that could not be
checked.

A value that arrives in conversation — a route, a host, a version, a field name —
and gets written into a document stops looking like a guess on the next read. It
is now prose in the repository, in the same typeface as everything that was
verified, and the person reading it has no way to tell which it is. That person is
usually you, later.

This happened here. A runbook stated the ledger route for looking up a
transaction as `GET /v2/updates/{updateId}`. Rewriting the runbook, the author
went to confirm it and found **exactly one occurrence in the entire repository:
the earlier sentence they had written themselves**. Nothing had corroborated it;
the grep had simply found the claim again. It was removed rather than copied
forward, because this codebase never reads an update by id and the JSON Ledger
API differs across versions, so there was no verified route to give.

It happened again the next day, pointing outward, and that instance is the one
worth remembering. A wallet-support document stated that a third-party wallet
"signs; it does not submit", and told that vendor what to add to their service.
The only source for either claim was **this repository's own adapter for them** —
a hand-written client with no dependency on anything the vendor publishes. An
adapter that implements no submit path is evidence about the adapter. What their
service can actually do had never been established, because we had never
integrated it.

Note what the rule cost by being late: it was written one day earlier, from the
first instance, and did not prevent the second. Rules of this kind are not
self-executing — the question has to be asked at the moment of writing the
sentence, which is exactly when the sentence feels obviously true.

And note which instance did more damage. An unsourced claim about your own
system wastes your own time. An unsourced claim about someone else's is published
as a judgement of their work, under your name, where they can read it.

**One hit, in prose we wrote, is an echo and not a source.** Corroboration comes
from outside: a dependency's published types, an upstream specification, a
generated client, a live system that answers. In this same work the CIP-0103
method set was established that way — read off
`@canton-network/core-wallet-dapp-rpc-client`'s own type declarations, which
nobody here wrote and which the standard's authors ship. That is what the
difference looks like in practice.

So when a document asserts something specific and load-bearing — a route, an
endpoint, a limit, a guarantee — ask where it would be checked. If the answer is
"another sentence in this repository", it has not been checked. Either trace it to
something external, or say plainly what is unknown and what it would take to find
out. An honest gap is usable; a confident sentence with nothing behind it is worse
than silence, because it stops the next person looking.

#### Assert what the call returned, not that it was reached

A test that checks a dependency was *called* passes whether the answer was right
or wrong. It is a verification that cannot fail on the thing its name implies it
covers, and it will sit green through exactly the defect it looks like it guards.

This has cost us twice, both found while fixing the same bug:

- `discovery-adapter.test.ts` asserted `submitTransaction` reached the provider
  as `prepareExecute`, and nothing about the receipt. The receipt was a cast of a
  `Null` — every field `undefined` — and the test could never have said so.
- `loop-adapter.test.ts` had a case named "succeeds with full
  `{ command_id, submission_id }` shape" whose body asserted
  `receipt.updateId === 'sub-42'`. A submission id is not an update id, so the
  test pinned the defect in place rather than the contract.

So: when the point of a call is the value it produces, assert the value. Reserve
"was it called, and with what" for cases where the *call itself* is the
behaviour — a params-forwarding check, a called-once guarantee, a "does not
forward this option" guard.

A useful check on a new test: if the code under it returned a plausible-looking
wrong answer, would this test fail? If not, it is testing the wiring, and the
value still needs a test.

Related: a mock that is more generous than the real dependency hides the same
class of bug. Both of the cases above also had a fixture returning a receipt from
a call the standard defines as returning null, so the mock, not the wallet, was
supplying the value the assertion relied on.

#### A test can also never reach the code it names

The rule above is about a test that asserts the wrong thing. This one is about a
test that asserts the right thing and never gets there. Both go green, or go red,
for reasons unrelated to the behaviour in the title, and neither is visible from
reading the test.

Three instances turned up in one session, which is what makes it a pattern rather
than bad luck:

- **Failed for the wrong reason.** A test proving a null dereference in
  `getActiveSession` died with `TransportError: fetch failed` inside `connect()`,
  from the registry client reaching a placeholder URL. It never reached the line
  under test. Reported as "the defect is proven" it would have been evidence of
  nothing. Fixed by the `vi.mock` stubs the neighbouring test file already had.
- **Passed for the wrong reason.** Registry signature tests seeded a cache and
  asserted against it; the SWR path returned that seed before the network call
  resolved, so two tests never executed the code they named. They only surfaced
  because they failed *after* the fix, which is the wrong direction to learn it.
- **Silently unreachable.** A test for the `listWallets` re-probe passed its
  preconditions, ran the call, and saw zero events. The cause was
  `announceEnabled` returning false when `typeof window === 'undefined'`, so in a
  Node runner the entire announce path does not exist. Without
  `vi.stubGlobal('window', {})` the result reads as "this site never fires"
  rather than "my harness never got there".

The third is the worst of the three, because absence of a signal looks like a
finding. A test that cannot reach its subject will happily report that the
subject does nothing.

**The check that catches all three: break the thing on purpose and watch the test
notice.** Delete the emit, swap the guarded local for the field it guards
against, return the wrong value. If the test still passes, it is not testing what
its name says, and no amount of reading it will reveal that. If it fails, the
failure message also tells you *which* assertion carries the weight.

That mutation is worth keeping in the commit message rather than only in the
session, because it is the evidence, not the test's existence. Two examples from
this codebase: `session-expired-reprobe.test.ts` records that swapping `active`
for `this.activeSession` makes it fail, which is what makes "this site is
guarded" a claim rather than an observation about code shape; and the
`CIP0103_MANDATORY_METHODS` guard records that restoring `Object.values(...)`
fails two of its five cases.

A useful corollary: prefer a fixture written out independently of the thing it
checks. A fixture derived from the code under test passes whatever that code
does.

##### The fourth shape: right observation, wrong machine

The three above are all "the test observed the wrong thing". This one is "the
test observed the right thing, on this machine, this time", and mutation does not
catch it, because the code is fine and the harness is not.

It cost a red CI on the very branch that added the rule above. A test drove the
`listWallets` re-probe and waited for the constructor's fire-and-forget
`restoreSession()` (`client.ts:283`) with one macrotask tick:

```ts
await new Promise((r) => setTimeout(r, 0));   // enough here, not on CI
```

Locally the session was revived in time. On a CI runner it was not, and the test
failed at its precondition. Reproduced afterwards by delaying `storage.get` by
120ms, which fails the fixed-sleep version and passes the polled one, so the fix
was verified against the actual cause rather than against a green run.

**Never gate a test on a fixed sleep for work you did not start.** If you did not
create the promise, you cannot know when it settles. Poll for the condition with
a bound:

```ts
async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
}
```

Note what it does NOT do: assert or throw on timeout. It returns either way, so
the caller's own assertion runs and reports the state actually observed, instead
of a generic "timed out" that hides it. A longer sleep is not a fix; it is the
same bug with a better hit rate, and it fails later and on someone else's branch.

**Assert the setup happened before asserting the behaviour.** The failure above
was legible only because the test checked its own preconditions:

```ts
expect(internals.activeSession).not.toBeNull();      // setup
expect(internals.activeSessionNeedsProbe).toBe(true);
...
expect(seen.length).toBeGreaterThanOrEqual(1);       // behaviour
```

Without the first two it would have failed at the last one, reporting zero
events, which reads as *"the emit site never fires"* rather than *"the session
was never restored"*. A missing precondition and a missing behaviour are
indistinguishable at the assertion that matters, and the first is a harness bug
while the second is a product bug. Checking the setup separately is what tells
them apart, and it is cheap.



---

## Documentation

### Updating Documentation

- Update relevant docs in `/docs` folder
- Update JSDoc comments for API changes
- Update README if needed

### Docs that live in two places

A few topics are documented twice: a markdown file under `docs/<slug>.md` (read on
GitHub) and a hand-authored page under `apps/demo/src/app/docs/<slug>/content.tsx`
(served at `partylayer.xyz/docs/<slug>`). The site page is written by hand, not
generated from the markdown, so the two can drift apart if you edit only one.

If you change one of these, change the other in the same PR. The markdown is the
source of truth. `pnpm gate:docs-drift` (part of `pnpm gate`) enforces this: for every
slug that exists in both places it compares the two sets of section headings and fails
naming the pair and which side is missing which heading. The current pairs are
`generic-bridge`, `partylayer-and-canton-topology`, and `dev-and-staging`.
`quick-start` is a documented exception, because `docs/quick-start.md` (a full
reference) and its site page (a short getting-started tutorial) are intentionally
different documents rather than two copies of one; see the header of
`scripts/gate/docs-drift.test.mjs`.

### JSDoc Comments

```typescript
/**
 * Creates a new PartyLayer client instance.
 *
 * @param config - Client configuration options
 * @returns A configured PartyLayer client
 *
 * @example
 * ```typescript
 * const client = createPartyLayer({
 *   registryUrl: 'https://registry.partylayer.xyz',
 *   network: 'devnet',
 *   app: { name: 'My dApp' },
 * });
 * ```
 */
export function createPartyLayer(config: PartyLayerConfig): PartyLayerClient {
  // ...
}
```

---

## Reproducible Builds

Every published package can be rebuilt from source and matched against what is on
npm. Each release is tagged on GitHub (for example `@partylayer/core@0.10.0`,
`@partylayer/react@2.0.0`, `@partylayer/vue@1.0.0`), and the tag points to the exact
commit the artifact was built from.

### Toolchain

- Node: `>=18` (the repo is built and tested on the active LTS line).
- pnpm: `9.15.9` (pinned in the root `package.json` `packageManager` field). With
  Corepack enabled (`corepack enable`), the correct pnpm is selected automatically.

### Steps

```bash
# 1. Clone and check out the exact release tag (or its commit).
git clone https://github.com/PartyLayer/PartyLayer.git
cd PartyLayer
git checkout "@partylayer/react@2.0.0"   # any published tag, or its commit SHA

# 2. Install with the committed lockfile (no resolution drift).
pnpm install --frozen-lockfile

# 3. Build every package exactly as CI and the release did.
pnpm -r --workspace-concurrency=1 build
```

The build script (`pnpm -r --workspace-concurrency=1 build`) is the same one the
release ran, so the `dist/` output matches the published artifacts.

### Verifying against npm

To confirm a local build matches what was published, pack the package and inspect the
tarball (the manifest and `dist/` contents):

```bash
cd packages/react
pnpm pack            # produces partylayer-react-2.0.0.tgz
tar -tzf partylayer-react-2.0.0.tgz   # list the files that would publish
```

`pnpm pack` resolves the workspace dependency ranges to concrete versions exactly as
publishing does (for example `@partylayer/core` resolves to `^0.10.0`), so the packed
manifest is what a consumer installs. You can also run the full verification gate
(`pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`) to reproduce the checks that
gate every release.

### Note on the version commit

The M2 coordinated release (core `0.10.0`, react `2.0.0`, vue `1.0.0`, plus the
dependency cascade) was built from the version-record commit on `main`; each package's
GitHub tag points to that commit, where its `package.json` already carries the published
version. Checking out a tag therefore gives you the precise source state behind that
version on npm.

---

## Questions?

- Open a [Discussion](https://github.com/PartyLayer/PartyLayer/discussions) for questions
- Check existing [Issues](https://github.com/PartyLayer/PartyLayer/issues) before opening new ones
- Join our community channels for real-time help

---

Thank you for contributing to PartyLayer!
