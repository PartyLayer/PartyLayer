/**
 * Coverage for `SEND_BUILTIN_DETECTION` and the new extension-ID exports.
 *
 * The shape of this constant is also pinned by a parity-guard test in
 * `send-adapter.test.ts` against the registry JSON. These tests cover
 * the semantic claims (which fields, which IDs, ordering, deprecated
 * alias resolution) independent of registry shape.
 */

import { describe, it, expect } from 'vitest';
import {
  SEND_BUILTIN_DETECTION,
  SEND_KERNEL_ID,
  SEND_KNOWN_EXTENSION_IDS,
  SEND_LEGACY_EXTENSION_ID,
  SEND_PRODUCTION_EXTENSION_ID,
} from './constants';

describe('SEND_BUILTIN_DETECTION', () => {
  it('uses window.canton transport', () => {
    expect(SEND_BUILTIN_DETECTION.transport).toBe('window.canton');
  });

  it('includes the production extension ID on provider.id matcher', () => {
    const providerIdMatcher = SEND_BUILTIN_DETECTION.matchers.find(
      (m) => m.field === 'provider.id',
    );
    expect(providerIdMatcher).toBeDefined();
    expect(providerIdMatcher && 'values' in providerIdMatcher ? providerIdMatcher.values : []).toContain(
      SEND_PRODUCTION_EXTENSION_ID,
    );
  });

  it('retains the legacy extension ID for backward compat', () => {
    const providerIdMatcher = SEND_BUILTIN_DETECTION.matchers.find(
      (m) => m.field === 'provider.id',
    );
    expect(providerIdMatcher && 'values' in providerIdMatcher ? providerIdMatcher.values : []).toContain(
      SEND_LEGACY_EXTENSION_ID,
    );
  });

  it('keeps kernel.* matchers as a defensive fallback', () => {
    const fields = SEND_BUILTIN_DETECTION.matchers.map((m) => m.field);
    expect(fields).toContain('kernel.id');
    expect(fields).toContain('kernel.url');
    expect(fields).toContain('kernel.userUrl');
  });

  it('provider.id matcher comes before kernel.* (current production wins)', () => {
    const firstMatcher = SEND_BUILTIN_DETECTION.matchers[0];
    expect(firstMatcher.field).toBe('provider.id');
  });
});

describe('Send extension ID exports', () => {
  // A2 incident correction: live diagnostics + Console Wallet's own extension
  // source proved `lpnf…` is CONSOLE's id, not Send's. Send's real id is `ldmo…`.
  const CONSOLE_EXTENSION_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';

  it('SEND_KERNEL_ID still resolves to the (deprecated) alias', () => {
    expect(SEND_KERNEL_ID).toBe(SEND_LEGACY_EXTENSION_ID);
  });

  it('SEND_KNOWN_EXTENSION_IDS is Send\'s id only (Console\'s id removed)', () => {
    expect(SEND_KNOWN_EXTENSION_IDS).toEqual([SEND_PRODUCTION_EXTENSION_ID]);
  });

  it('production ID is the verified Send extension id', () => {
    expect(SEND_PRODUCTION_EXTENSION_ID).toBe('ldmohiccoioolenadmogclhoklmanpgi');
  });

  it('legacy alias now equals production (no distinct legacy Send build exists)', () => {
    expect(SEND_LEGACY_EXTENSION_ID).toBe(SEND_PRODUCTION_EXTENSION_ID);
  });

  // ── Cross-wallet guard (the original-swap regression) ─────────────────────
  it('NO Send constant or matcher contains Console\'s extension id', () => {
    expect(SEND_KNOWN_EXTENSION_IDS as readonly string[]).not.toContain(CONSOLE_EXTENSION_ID);
    expect(SEND_PRODUCTION_EXTENSION_ID).not.toBe(CONSOLE_EXTENSION_ID);
    expect(SEND_LEGACY_EXTENSION_ID).not.toBe(CONSOLE_EXTENSION_ID);
    expect(SEND_KERNEL_ID).not.toBe(CONSOLE_EXTENSION_ID);
    for (const m of SEND_BUILTIN_DETECTION.matchers) {
      if ('values' in m) expect(m.values).not.toContain(CONSOLE_EXTENSION_ID);
      if ('value' in m) expect(m.value).not.toBe(CONSOLE_EXTENSION_ID);
    }
  });
});
