# Contributing to CantonConnect

Thank you for your interest in contributing to CantonConnect! This document provides guidelines and instructions for contributing.

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
- **pnpm 8+** - Install with `npm install -g pnpm`
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
git remote add upstream https://github.com/cayvox/CantonConnect.git
```

---

## Development Setup

### Install Dependencies

```bash
pnpm install
```

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
- **Functions**: `camelCase` (e.g., `createCantonConnect`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TIMEOUT`)
- **Types/Interfaces**: `PascalCase` (e.g., `WalletMetadata`)

### Code Organization

```typescript
// 1. Imports (external, then internal)
import { useState } from 'react';
import type { Session } from '@cantonconnect/core';

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

- Use typed error classes from `@cantonconnect/core`
- Provide meaningful error messages
- Include error codes for debugging

```typescript
import { WalletNotInstalledError } from '@cantonconnect/core';

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
pnpm --filter @cantonconnect/core test

# Watch mode
pnpm --filter @cantonconnect/core test --watch

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
 * Creates a new CantonConnect client instance.
 *
 * @param config - Client configuration options
 * @returns A configured CantonConnect client
 *
 * @example
 * ```typescript
 * const client = createCantonConnect({
 *   registryUrl: 'https://registry.cantonconnect.io',
 *   network: 'devnet',
 *   app: { name: 'My dApp' },
 * });
 * ```
 */
export function createCantonConnect(config: CantonConnectConfig): CantonConnectClient {
  // ...
}
```

---

## Questions?

- Open a [Discussion](https://github.com/cayvox/CantonConnect/discussions) for questions
- Check existing [Issues](https://github.com/cayvox/CantonConnect/issues) before opening new ones
- Join our community channels for real-time help

---

Thank you for contributing to CantonConnect!
