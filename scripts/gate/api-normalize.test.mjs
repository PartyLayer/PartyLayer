/**
 * Unit tests for the AST-normalized snapshot canonical (api-normalize.mjs).
 *
 * Run: node --test scripts/gate/api-normalize.test.mjs  (wired into `pnpm gate:api`)
 *
 * Proves the canonical is IMMUNE to noise (comments, formatting, declaration
 * order) yet still FLAGS every real public-API change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { astCanonical, snapshotBody, buildHeader } from './api-normalize.mjs';

const BASE = `
export interface Session { id: string; party: string; }
export declare class Client {
  connect(opts: { walletId: string }): Promise<Session>;
  private warmPlans;
  private gateExisting(): void;
}
export declare function createClient(cfg: { network: string }): Client;
export type WalletId = string;
`;

// ── Noise immunity (must NOT flag) ───────────────────────────────────────────

test('immune to comments (JSDoc, block, line)', () => {
  const withComments = `
/** The active session. */
export interface Session { id: string; /* the id */ party: string; }
// a stray line comment
export declare class Client {
  /** connect to a wallet */ connect(opts: { walletId: string }): Promise<Session>;
  private warmPlans;
  private gateExisting(): void;
}
export declare function createClient(cfg: { network: string }): Client;
export type WalletId = string;
`;
  assert.equal(astCanonical(withComments), astCanonical(BASE));
});

test('immune to indentation / whitespace (the observed false-drift cause)', () => {
  const reindented = `
        export interface Session {
                id:    string;
                party: string;
        }
        export declare class Client {
                    connect(opts: {   walletId: string }):     Promise<Session>;
                    private warmPlans;
                    private gateExisting(): void;
        }
        export declare function createClient(cfg: { network: string }): Client;
        export type WalletId = string;
`;
  assert.equal(astCanonical(reindented), astCanonical(BASE));
});

test('immune to a `declare module {…}` wrapper (flattened)', () => {
  const wrapped = `
declare module "@partylayer/sdk" {
  export interface Session { id: string; party: string; }
  export declare class Client {
    connect(opts: { walletId: string }): Promise<Session>;
    private warmPlans;
    private gateExisting(): void;
  }
  export declare function createClient(cfg: { network: string }): Client;
  export type WalletId = string;
}
`;
  assert.equal(astCanonical(wrapped), astCanonical(BASE));
});

test('immune to top-level declaration ORDER (sorted)', () => {
  const reordered = `
export type WalletId = string;
export declare function createClient(cfg: { network: string }): Client;
export interface Session { id: string; party: string; }
export declare class Client {
  connect(opts: { walletId: string }): Promise<Session>;
  private warmPlans;
  private gateExisting(): void;
}
`;
  assert.equal(astCanonical(reordered), astCanonical(BASE));
});

// ── Real-change detection (MUST flag) ────────────────────────────────────────

test('FLAGS a new private method (the gateDiscoveryAdapterEntries case)', () => {
  const added = BASE.replace(
    'private gateExisting(): void;',
    'private gateExisting(): void;\n  private gateDiscoveryAdapterEntries(wallets: WalletInfo[]): Promise<WalletInfo[]>;',
  );
  assert.notEqual(astCanonical(added), astCanonical(BASE));
});

test('FLAGS a return-type change', () => {
  const changed = BASE.replace('connect(opts: { walletId: string }): Promise<Session>', 'connect(opts: { walletId: string }): Promise<void>');
  assert.notEqual(astCanonical(changed), astCanonical(BASE));
});

test('FLAGS a param-type change', () => {
  const changed = BASE.replace('connect(opts: { walletId: string })', 'connect(opts: { walletId: number })');
  assert.notEqual(astCanonical(changed), astCanonical(BASE));
});

test('FLAGS an added symbol', () => {
  const added = BASE + '\nexport declare function destroyClient(): void;\n';
  assert.notEqual(astCanonical(added), astCanonical(BASE));
});

test('FLAGS a removed symbol', () => {
  const removed = BASE.replace('export type WalletId = string;', '');
  assert.notEqual(astCanonical(removed), astCanonical(BASE));
});

test('FLAGS a renamed symbol', () => {
  const renamed = BASE.replace('createClient', 'makeClient');
  assert.notEqual(astCanonical(renamed), astCanonical(BASE));
});

// ── Header / body split ──────────────────────────────────────────────────────

test('snapshotBody strips the (version-stamped) header from comparison', () => {
  const full = buildHeader('@partylayer/sdk') + astCanonical(BASE);
  assert.equal(snapshotBody(full), astCanonical(BASE));
  // The TS version lives only in the header → not in the compared body.
  assert.ok(buildHeader('@x').includes('TypeScript '));
  assert.ok(!snapshotBody(full).includes('TypeScript '));
});

test('canonical is idempotent (determinism within an environment)', () => {
  assert.equal(astCanonical(BASE), astCanonical(BASE));
});
