# Contributing to PartyLayer

Thank you for your interest in contributing to PartyLayer! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
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
git clone https://github.com/YOUR_USERNAME/wallet-sdk.git
cd wallet-sdk
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

### 4. Commit Your Changes

Use conventional commit messages (see [Commit Messages](#commit-messages)).

```bash
git add .
git commit -m "feat: add wallet connection retry logic"
```

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

---

## Documentation

### Updating Documentation

- Update relevant docs in `/docs` folder
- Update JSDoc comments for API changes
- Update README if needed

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
