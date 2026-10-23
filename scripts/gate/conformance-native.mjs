#!/usr/bin/env node
/**
 * Regression gate — CIP-0103 native-path conformance check.
 *
 * Checks the NATIVE provider path (`PartyLayerProvider`) against the local
 * reference contract. This does not certify external wallet deployments.
 * The native provider is a router/normalizer;
 * it has no wallet of its own, so we wrap an in-repo REFERENCE wallet
 * (`createProviderBridge(mockClient)` — the same construction used by the
 * provider package's own conformance-gate test) and run the published
 * conformance suite (`runCIP0103ConformanceTests`) against the wrapper.
 *
 * This exercises the real native code path end-to-end:
 *   dApp → PartyLayerProvider (router + event forwarding) → reference wallet
 *
 * No live wallet is required. The gate fails (exit 1) on ANY conformance
 * failure.
 *
 * Run via `pnpm gate:conformance` (requires a fresh `pnpm build` first, so
 * the dist artifacts below exist — `pnpm gate` builds before calling this).
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const providerDist = resolve(repoRoot, 'packages/provider/dist/index.mjs');
const runnerDist = resolve(
  repoRoot,
  'packages/conformance-runner/dist/cip0103-tests.js',
);

for (const [label, p] of [
  ['@partylayer/provider', providerDist],
  ['@partylayer/conformance-runner', runnerDist],
]) {
  if (!existsSync(p)) {
    console.error(
      `✗ Missing build artifact for ${label}:\n    ${p}\n` +
        `  Run \`pnpm build\` first (\`pnpm gate\` does this automatically).`,
    );
    process.exit(1);
  }
}

const { createProviderBridge, PartyLayerProvider } = await import(providerDist);
const { runCIP0103ConformanceTests, formatCIP0103Report } = await import(
  runnerDist
);

// ─── In-repo reference wallet ────────────────────────────────────────────────
// A minimal, fully-functional CIP-0103 wallet client. Mirrors the mock used in
// packages/provider/src/__tests__/cip0103-conformance-gate.test.ts so the
// reference behaviour stays aligned with the package's own gate test.

function createReferenceClient() {
  const session = {
    sessionId: 'sess-ref-1',
    walletId: 'console',
    partyId: 'party-ref-abc',
    network: 'devnet',
    expiresAt: Number.MAX_SAFE_INTEGER,
    capabilitiesSnapshot: [
      'connect',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'ledgerApi',
    ],
  };
  let connected = false;

  return {
    connect: async () => { connected = true; return session; },
    disconnect: async () => { connected = false; },
    getActiveSession: async () => connected ? session : null,
    signMessage: async () => ({ signature: 'sig-ref-xyz' }),
    signTransaction: async () => ({
      signature: 'sig-reference-only',
      signedBy: 'key-reference-only',
      transactionHash: 'tx-ref-hash',
      signedTx: { data: 'signed-payload' },
      partyId: session.partyId,
    }),
    submitTransaction: async () => ({
      transactionHash: 'tx-ref-hash',
      submittedAt: 0,
      commandId: 'cmd-ref-1',
      updateId: 'update-ref-1',
      completionOffset: 42,
    }),
    ledgerApi: async (params) => ({
      response: JSON.stringify({
        method: params?.requestMethod,
        resource: params?.resource,
      }),
    }),
    getRegistryStatus: () => null,
    on: () => () => {},
  };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const referenceWallet = createProviderBridge(createReferenceClient());

// Wrap the reference wallet in the NATIVE provider — this is the path under test.
const provider = new PartyLayerProvider({
  walletProvider: {
    id: 'reference',
    provider: referenceWallet,
    source: 'injected',
  },
});

const report = await runCIP0103ConformanceTests(provider);

console.log(formatCIP0103Report(report));

if (report.failed > 0) {
  console.error(
    `✗ CIP-0103 native-path conformance FAILED: ${report.failed}/${report.total} checks failed.`,
  );
  process.exit(1);
}

console.log(
  `✓ CIP-0103 native-path conformance PASSED: ${report.passed}/${report.total} checks green.`,
);
