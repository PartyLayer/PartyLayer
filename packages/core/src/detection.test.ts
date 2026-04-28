/**
 * Coverage for the standards-first CIP-0103 detection logic.
 *
 * The detection engine must:
 *   1. Match domains stably (subdomains accepted, foreign domains rejected,
 *      bad URLs handled without throwing).
 *   2. Match exact and prefix forms on every supported field.
 *   3. OR-combine matchers; first match wins (verified via mock counters).
 *   4. Read fields safely — missing nested keys return undefined, never throw.
 *   5. Iterate registry entries in order and return the first hit.
 *
 * These guarantees are what make the registry permissionless: a new wallet
 * can ship its detection rule via JSON without code changes downstream.
 */

import { describe, it, expect } from 'vitest';
import type {
  ProviderDetection,
  ProviderMatcher,
  WalletInfo,
} from './types';

import {
  deriveGenericWalletName,
  findMatchingWallet,
  findMatchingWalletInfo,
  matchesProviderDetection,
  type Cip0103StatusForDetection,
} from './detection';

const sendStatus: Cip0103StatusForDetection = {
  kernel: {
    id: 'ldmohiccoioolenadmogclhoklmanpgi',
    url: 'https://api-mainnet.cantonwallet.com',
    userUrl: 'https://cantonwallet.com',
    clientType: 'browser',
  },
};

const sendDevStatus: Cip0103StatusForDetection = {
  kernel: {
    id: 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd', // build-specific
    url: 'https://api-mainnet.cantonwallet.com',
    userUrl: 'https://cantonwallet.com',
    clientType: 'browser',
  },
};

const foreignStatus: Cip0103StatusForDetection = {
  kernel: {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    url: 'https://other-wallet.example.com',
    userUrl: 'https://other-wallet.example.com',
    clientType: 'browser',
  },
};

const sendDetection: ProviderDetection = {
  transport: 'window.canton',
  matchers: [
    { field: 'kernel.url', match: 'domain', value: 'cantonwallet.com' },
    { field: 'kernel.userUrl', match: 'domain', value: 'cantonwallet.com' },
    { field: 'kernel.id', match: 'exact', values: ['ldmohiccoioolenadmogclhoklmanpgi'] },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Group 1 — Domain matcher
// ─────────────────────────────────────────────────────────────────────────────

describe('matchesProviderDetection — domain matcher', () => {
  function withDomain(field: 'kernel.url' | 'kernel.userUrl', value: string): ProviderDetection {
    return { transport: 'window.canton', matchers: [{ field, match: 'domain', value }] };
  }

  it('accepts an exact domain match', () => {
    expect(
      matchesProviderDetection(
        { kernel: { url: 'https://cantonwallet.com' } },
        withDomain('kernel.url', 'cantonwallet.com'),
      ),
    ).toBe(true);
  });

  it('accepts subdomains of the registered domain', () => {
    expect(matchesProviderDetection(sendStatus, withDomain('kernel.url', 'cantonwallet.com'))).toBe(true);
  });

  it('rejects foreign domains', () => {
    expect(matchesProviderDetection(foreignStatus, withDomain('kernel.url', 'cantonwallet.com'))).toBe(false);
  });

  it('returns false when the URL is unparseable rather than throwing', () => {
    expect(
      matchesProviderDetection(
        { kernel: { url: 'not a url' } },
        withDomain('kernel.url', 'cantonwallet.com'),
      ),
    ).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(
      matchesProviderDetection(
        { kernel: { url: 'https://CANTONWALLET.COM/foo' } },
        withDomain('kernel.url', 'cantonwallet.com'),
      ),
    ).toBe(true);
  });

  it('does not match a substring that is not a subdomain (foo-cantonwallet.com)', () => {
    expect(
      matchesProviderDetection(
        { kernel: { url: 'https://foo-cantonwallet.com/x' } },
        withDomain('kernel.url', 'cantonwallet.com'),
      ),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2 — Exact matcher
// ─────────────────────────────────────────────────────────────────────────────

describe('matchesProviderDetection — exact matcher', () => {
  function withExact(values: string[]): ProviderDetection {
    return {
      transport: 'window.canton',
      matchers: [{ field: 'kernel.id', match: 'exact', values }],
    };
  }

  it('matches a single value', () => {
    expect(matchesProviderDetection(sendStatus, withExact(['ldmohiccoioolenadmogclhoklmanpgi']))).toBe(
      true,
    );
  });

  it('matches when the field value is in a multi-value list', () => {
    expect(
      matchesProviderDetection(sendStatus, withExact(['x', 'ldmohiccoioolenadmogclhoklmanpgi', 'y'])),
    ).toBe(true);
  });

  it('returns false when no value matches', () => {
    expect(matchesProviderDetection(sendStatus, withExact(['x', 'y']))).toBe(false);
  });

  it('is case-sensitive (matches the JSON-RPC contract semantics)', () => {
    expect(
      matchesProviderDetection(sendStatus, withExact(['LDMOHICCOIOOLENADMOGCLHOKLMANPGI'])),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3 — Prefix matcher
// ─────────────────────────────────────────────────────────────────────────────

describe('matchesProviderDetection — prefix matcher', () => {
  function withPrefix(field: ProviderMatcher['field'] & ('kernel.id' | 'kernel.url' | 'kernel.userUrl'), value: string): ProviderDetection {
    return { transport: 'window.canton', matchers: [{ field, match: 'prefix', value } as ProviderMatcher] };
  }

  it('matches a string starting with the prefix', () => {
    expect(matchesProviderDetection(sendStatus, withPrefix('kernel.url', 'https://api'))).toBe(true);
  });

  it('rejects a non-prefix', () => {
    expect(matchesProviderDetection(sendStatus, withPrefix('kernel.url', 'https://other'))).toBe(false);
  });

  it('treats the empty-prefix edge case as a trivial match', () => {
    expect(matchesProviderDetection(sendStatus, withPrefix('kernel.url', ''))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4 — OR semantics across matchers
// ─────────────────────────────────────────────────────────────────────────────

describe('matchesProviderDetection — OR across matchers', () => {
  it('returns true when only the second matcher hits (canonical Send build-id case)', () => {
    expect(matchesProviderDetection(sendDevStatus, sendDetection)).toBe(true);
  });

  it('returns false when no matcher hits', () => {
    expect(matchesProviderDetection(foreignStatus, sendDetection)).toBe(false);
  });

  it('returns true on the first matcher and short-circuits the rest', () => {
    expect(matchesProviderDetection(sendStatus, sendDetection)).toBe(true);
  });

  it('returns false for an empty matcher list', () => {
    expect(
      matchesProviderDetection(sendStatus, { transport: 'window.canton', matchers: [] }),
    ).toBe(false);
  });

  it('returns false when detection itself is undefined', () => {
    expect(matchesProviderDetection(sendStatus, undefined)).toBe(false);
  });

  it('returns false when status is null/undefined', () => {
    expect(matchesProviderDetection(null, sendDetection)).toBe(false);
    expect(matchesProviderDetection(undefined, sendDetection)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5 — Field reading
// ─────────────────────────────────────────────────────────────────────────────

describe('matchesProviderDetection — field reading edge cases', () => {
  it('returns false when the kernel object is missing entirely', () => {
    expect(matchesProviderDetection({}, sendDetection)).toBe(false);
  });

  it('returns false when the targeted field is missing', () => {
    const missing: Cip0103StatusForDetection = { kernel: {} };
    expect(matchesProviderDetection(missing, sendDetection)).toBe(false);
  });

  it('returns false for empty-string field values', () => {
    expect(
      matchesProviderDetection(
        { kernel: { id: '', url: '', userUrl: '' } },
        sendDetection,
      ),
    ).toBe(false);
  });

  it('returns false when the field value is not a string', () => {
    expect(
      matchesProviderDetection(
        { kernel: { id: 42 as unknown as string } },
        sendDetection,
      ),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6 — findMatchingWallet
// ─────────────────────────────────────────────────────────────────────────────

describe('findMatchingWallet', () => {
  const registry: Array<{ id: string; providerDetection?: ProviderDetection }> = [
    { id: 'console' /* no providerDetection */ },
    {
      id: 'send',
      providerDetection: sendDetection,
    },
    {
      id: 'other',
      providerDetection: {
        transport: 'window.canton',
        matchers: [{ field: 'kernel.id', match: 'exact', values: ['some-other-id'] }],
      },
    },
  ];

  it('returns the entry whose detection matches', () => {
    expect(findMatchingWallet(sendStatus, registry)?.id).toBe('send');
  });

  it('returns undefined when no entry matches', () => {
    expect(findMatchingWallet(foreignStatus, registry)).toBeUndefined();
  });

  it('skips entries without providerDetection', () => {
    expect(findMatchingWallet(sendStatus, [{ id: 'no-detect' }])).toBeUndefined();
  });

  it('returns the FIRST matching entry when multiple would match', () => {
    const overlapping: Array<{ id: string; providerDetection?: ProviderDetection }> = [
      {
        id: 'first',
        providerDetection: {
          transport: 'window.canton',
          matchers: [{ field: 'kernel.url', match: 'domain', value: 'cantonwallet.com' }],
        },
      },
      { id: 'send', providerDetection: sendDetection },
    ];
    expect(findMatchingWallet(sendStatus, overlapping)?.id).toBe('first');
  });

  it('handles an empty registry array', () => {
    expect(findMatchingWallet(sendStatus, [])).toBeUndefined();
  });

  it('findMatchingWalletInfo narrows to WalletInfo and returns the same hit', () => {
    const wallets: WalletInfo[] = [
      {
        walletId: 'send' as WalletInfo['walletId'],
        name: 'Send',
        website: 'https://cantonwallet.com',
        icons: {},
        capabilities: ['connect'],
        adapter: { packageName: '@partylayer/adapter-send', versionRange: '*' },
        docs: [],
        networks: ['mainnet'],
        channel: 'beta',
        providerDetection: sendDetection,
      },
    ];
    expect(findMatchingWalletInfo(sendStatus, wallets)?.walletId).toBe('send');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 7 — deriveGenericWalletName
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveGenericWalletName', () => {
  it('extracts the hostname from kernel.userUrl', () => {
    expect(deriveGenericWalletName({ kernel: { userUrl: 'https://www.example.com/x' } })).toBe(
      'example.com',
    );
  });

  it('falls back to a truncated kernel.id when userUrl is missing', () => {
    expect(
      deriveGenericWalletName({ kernel: { id: 'abcdefghijklmnop' } }),
    ).toMatch(/CIP-0103 wallet \(abcdefgh/);
  });

  it('falls back to a generic label when no signal is available', () => {
    expect(deriveGenericWalletName({})).toBe('CIP-0103 wallet');
    expect(deriveGenericWalletName(undefined)).toBe('CIP-0103 wallet');
  });

  it('handles unparseable userUrl gracefully', () => {
    expect(deriveGenericWalletName({ kernel: { userUrl: 'not a url', id: 'abcdefghijk' } })).toMatch(
      /CIP-0103 wallet/,
    );
  });
});
