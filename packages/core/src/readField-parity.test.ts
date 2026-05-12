/**
 * Behavior parity test (Protection Layer 1).
 *
 * Captures the exact behavior of the previous (kernel.*-only) readField
 * for the input shapes existing adapters depend on, then asserts the
 * current generalized readField produces identical results.
 *
 * If any of these cases diverge, an existing wallet's detection logic
 * has been silently regressed. STOP and investigate.
 *
 * Background:
 *   The old readField rejected any non-`kernel.*` field path and returned
 *   the (untyped) nested value otherwise. The new readField generalises
 *   to any top-level object key. For every kernel.* path, behavior must
 *   be identical pre/post change. This file is the load-bearing proof.
 */

import { describe, it, expect } from 'vitest';
import type { ProviderDetection } from './types';
import { matchesProviderDetection } from './detection';

/**
 * Reference implementation of the OLD readField behavior, inlined.
 * Used only as an oracle for parity testing — not exported.
 */
function legacyReadField(status: unknown, field: string): unknown {
  const dot = field.indexOf('.');
  if (dot < 0) return undefined;
  const root = field.slice(0, dot);
  const key = field.slice(dot + 1);
  const s = status as { kernel?: Record<string, unknown> } | null | undefined;
  if (root !== 'kernel' || !s?.kernel) return undefined;
  return s.kernel[key];
}

/**
 * All `kernel.*` field paths existing wallet adapters or registry
 * entries can encounter. Drawn from S1.1 audit: only the Send adapter
 * uses these in production today, but the type contract permits all of
 * them, so all must remain compatible.
 */
const EXISTING_ADAPTER_FIELDS = [
  'kernel.id',
  'kernel.url',
  'kernel.userUrl',
  'kernel.clientType',
] as const;

/**
 * Status shapes existing adapters' matchers can run against. Cover:
 *   - happy paths (kernel populated)
 *   - missing-kernel paths
 *   - malformed kernel values (wrong types, null/undefined)
 *   - status itself missing/null
 *   - real-world Send shape (no kernel — must still produce identical
 *     "not matched" result for every kernel.* matcher)
 *   - other-wallet-shaped status (kernel + extra top-level keys —
 *     must still produce identical "matched" result for kernel.* paths)
 */
const PARITY_CASES: { label: string; status: unknown }[] = [
  // happy-path kernel objects
  { label: 'kernel with id only', status: { kernel: { id: 'abc123' } } },
  { label: 'kernel with url only', status: { kernel: { url: 'https://x.cantonwallet.com' } } },
  { label: 'kernel with userUrl only', status: { kernel: { userUrl: 'https://wallet.example' } } },
  {
    label: 'kernel with all four',
    status: {
      kernel: {
        id: 'x',
        url: 'https://a.b',
        userUrl: 'https://c.d',
        clientType: 'browser',
      },
    },
  },

  // missing-kernel cases
  { label: 'no kernel field', status: { connection: { isConnected: false } } },
  { label: 'kernel is null', status: { kernel: null } },
  { label: 'kernel is undefined', status: { kernel: undefined } },
  { label: 'kernel is a string (malformed)', status: { kernel: 'oops' } },
  { label: 'status itself empty', status: {} },
  { label: 'status is null', status: null },
  { label: 'status is undefined', status: undefined },

  // wrong-type field values
  { label: 'kernel.id is a number', status: { kernel: { id: 12345 } } },
  { label: 'kernel.url is null', status: { kernel: { url: null } } },
  { label: 'kernel.userUrl is undefined', status: { kernel: { userUrl: undefined } } },
  { label: 'kernel.clientType is a boolean', status: { kernel: { clientType: true } } },

  // real-world Send shape (no kernel at all)
  {
    label: 'Send-shaped (provider not kernel)',
    status: {
      connection: { isConnected: false, reason: "Not added to extension's whitelist" },
      provider: {
        id: 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd',
        version: '2.1.7',
        providerType: 'browser',
      },
    },
  },

  // other-wallet-shaped (kernel present, additional top-level keys must be ignored)
  {
    label: 'Console-shaped (kernel + extra keys)',
    status: {
      kernel: { id: 'console-kernel', url: 'https://console.network/x' },
      connection: { isConnected: true },
      metadata: { name: 'Console Wallet' },
    },
  },
];

describe('readField behavior parity — kernel.* paths produce identical results pre/post change', () => {
  for (const { label, status } of PARITY_CASES) {
    for (const field of EXISTING_ADAPTER_FIELDS) {
      it(`${label} | field=${field}`, () => {
        // Oracle: does the OLD readField return a non-empty string?
        // (matchesSingle requires `typeof fieldValue === 'string' &&
        // fieldValue.length > 0` for any matcher to fire.)
        const oracleValue = legacyReadField(status, field);
        const oracleMatches =
          typeof oracleValue === 'string' && (oracleValue as string).length > 0;

        // System under test: the new readField via the public matcher.
        // Use a prefix-with-empty-value matcher so it fires iff readField
        // returns a non-empty string — same precondition the old matcher
        // would have required.
        // Note: prefix matchers permit id/url/userUrl but not clientType,
        // so use exact for clientType.
        const detection: ProviderDetection =
          field === 'kernel.clientType'
            ? {
                transport: 'window.canton',
                matchers: [
                  {
                    field: 'kernel.clientType',
                    match: 'exact',
                    values: typeof oracleValue === 'string' ? [oracleValue] : ['__never__'],
                  },
                ],
              }
            : {
                transport: 'window.canton',
                matchers: [{ field, match: 'prefix', value: '' }],
              };

        const actualMatches = matchesProviderDetection(
          status as Parameters<typeof matchesProviderDetection>[0],
          detection,
        );

        expect(actualMatches).toBe(oracleMatches);
      });
    }
  }
});

describe('readField behavior parity — exact-match equivalence', () => {
  for (const { label, status } of PARITY_CASES) {
    for (const field of EXISTING_ADAPTER_FIELDS) {
      const oracleValue = legacyReadField(status, field);
      if (typeof oracleValue !== 'string' || oracleValue.length === 0) continue;

      it(`${label} | field=${field} | exact match returns same string`, () => {
        const detection: ProviderDetection = {
          transport: 'window.canton',
          matchers: [{ field, match: 'exact', values: [oracleValue] }],
        };
        expect(
          matchesProviderDetection(
            status as Parameters<typeof matchesProviderDetection>[0],
            detection,
          ),
        ).toBe(true);
      });
    }
  }
});

describe('readField behavior parity — domain match equivalence on kernel.url/userUrl', () => {
  for (const { label, status } of PARITY_CASES) {
    for (const field of ['kernel.url', 'kernel.userUrl'] as const) {
      const oracleValue = legacyReadField(status, field);
      if (typeof oracleValue !== 'string' || oracleValue.length === 0) continue;
      // Only test domain matching for parseable URLs
      try {
        new URL(oracleValue);
      } catch {
        continue;
      }

      it(`${label} | field=${field} | domain match identical`, () => {
        const detection: ProviderDetection = {
          transport: 'window.canton',
          matchers: [{ field, match: 'domain', value: new URL(oracleValue).hostname }],
        };
        expect(
          matchesProviderDetection(
            status as Parameters<typeof matchesProviderDetection>[0],
            detection,
          ),
        ).toBe(true);
      });
    }
  }
});
