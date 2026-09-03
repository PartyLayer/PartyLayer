/**
 * CIP-0103 Conformance Test Suite
 *
 * Validates that a Provider implementation conforms to CIP-0103:
 * - Interface shape (request, on, emit, removeListener)
 * - All 10 mandatory methods are handled
 *
 * "Mandatory" means the specification's synchronous method table, and nothing
 * else. It iterates CIP0103_MANDATORY_METHODS, which is written out explicitly
 * rather than derived from CIP0103_METHODS: this SDK speaks one method the
 * standard does not define (prepareExecuteAndWait, from the upstream client),
 * and that method is DELIBERATELY EXCLUDED here. A vendor running this suite
 * reads its output as a list of their obligations, so an extension of ours
 * appearing in it would tell them the standard requires something it does not.
 * See the comment on CIP0103_MANDATORY_METHODS in @partylayer/core.
 * - Event subscription returns Provider for chaining
 * - Error responses use ProviderRpcError with numeric codes
 *
 * This suite can be run against:
 * - PartyLayerProvider (native path)
 * - createProviderBridge() (bridge path)
 * - Any third-party CIP-0103 Provider
 */

import type { CIP0103Provider } from '@partylayer/core';
import { CIP0103_MANDATORY_METHODS, CIP0103_EVENTS } from '@partylayer/core';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CIP0103TestResult {
  name: string;
  category: 'interface' | 'method' | 'event' | 'error' | 'lifecycle';
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export interface CIP0103ConformanceReport {
  total: number;
  passed: number;
  failed: number;
  results: CIP0103TestResult[];
}

// ─── Runner ─────────────────────────────────────────────────────────────────

export async function runCIP0103ConformanceTests(
  provider: CIP0103Provider,
): Promise<CIP0103ConformanceReport> {
  const results: CIP0103TestResult[] = [];

  // ── Interface shape tests ─────────────────────────────────────────────

  results.push({
    name: 'Provider has request() method',
    category: 'interface',
    passed: typeof provider.request === 'function',
  });

  results.push({
    name: 'Provider has on() method',
    category: 'interface',
    passed: typeof provider.on === 'function',
  });

  results.push({
    name: 'Provider has emit() method',
    category: 'interface',
    passed: typeof provider.emit === 'function',
  });

  results.push({
    name: 'Provider has removeListener() method',
    category: 'interface',
    passed: typeof provider.removeListener === 'function',
  });

  // ── Method presence tests ─────────────────────────────────────────────

  for (const method of CIP0103_MANDATORY_METHODS) {
    try {
      await provider.request({ method, params: {} });
      results.push({
        name: `Method "${method}" is handled`,
        category: 'method',
        passed: true,
      });
    } catch (err: unknown) {
      // A valid ProviderRpcError means the method IS handled
      // (it just may not be authorized / connected yet)
      const isValidError = isNumericCodeError(err);
      results.push({
        name: `Method "${method}" is handled`,
        category: 'method',
        passed: isValidError,
        error: isValidError
          ? undefined
          : `Expected ProviderRpcError with numeric code, got: ${String(err)}`,
        details: isValidError
          ? { code: (err as { code: number }).code }
          : undefined,
      });
    }
  }

  // ── Event chaining tests ──────────────────────────────────────────────

  const noopHandler = () => {};

  const onResult = provider.on('statusChanged', noopHandler);
  results.push({
    name: 'on() returns Provider for chaining',
    category: 'event',
    passed: onResult === provider,
    error:
      onResult === provider
        ? undefined
        : 'on() did not return the Provider instance',
  });

  const removeResult = provider.removeListener('statusChanged', noopHandler);
  results.push({
    name: 'removeListener() returns Provider for chaining',
    category: 'event',
    passed: removeResult === provider,
    error:
      removeResult === provider
        ? undefined
        : 'removeListener() did not return the Provider instance',
  });

  // ── Error code validation ─────────────────────────────────────────────

  try {
    await provider.request({ method: '__cip0103_conformance_nonexistent__' });
    results.push({
      name: 'Unsupported method returns ProviderRpcError',
      category: 'error',
      passed: false,
      error: 'Expected error for unsupported method, got success',
    });
  } catch (err: unknown) {
    const hasNumericCode = isNumericCodeError(err);
    results.push({
      name: 'Unsupported method returns error with numeric code',
      category: 'error',
      passed: hasNumericCode,
      error: hasNumericCode
        ? undefined
        : `Expected numeric code, got: ${String(err)}`,
      details: hasNumericCode
        ? { code: (err as { code: number }).code }
        : undefined,
    });

    if (hasNumericCode) {
      const code = (err as { code: number }).code;
      // Should be 4200 (UNSUPPORTED_METHOD) or -32601 (METHOD_NOT_FOUND)
      const isCorrectCode = code === 4200 || code === -32601;
      results.push({
        name: 'Unsupported method uses code 4200 or -32601',
        category: 'error',
        passed: isCorrectCode,
        error: isCorrectCode
          ? undefined
          : `Expected code 4200 or -32601, got ${code}`,
        details: { code },
      });
    }
  }

  // ── emit() returns boolean ────────────────────────────────────────────

  const emitResult = provider.emit('__cip0103_conformance_test__');
  results.push({
    name: 'emit() returns boolean',
    category: 'interface',
    passed: typeof emitResult === 'boolean',
    error:
      typeof emitResult === 'boolean'
        ? undefined
        : `emit() returned ${typeof emitResult}`,
  });

  // ── Transaction lifecycle tests ─────────────────────────────────────

  {
    const txEvents: unknown[] = [];
    const txHandler = (...args: unknown[]) => txEvents.push(...args);
    provider.on(CIP0103_EVENTS.TX_CHANGED, txHandler);

    try {
      await provider.request({
        method: 'prepareExecute',
        params: { tx: { _conformance: true } },
      });

      // Check that 'pending' was emitted
      results.push({
        name: 'prepareExecute emits txChanged with "pending"',
        category: 'lifecycle',
        passed: txEvents.some(
          (e) => typeof e === 'object' && e !== null && (e as Record<string, unknown>).status === 'pending',
        ),
        error: txEvents.length === 0 ? 'No txChanged events emitted' : undefined,
      });

      // Check that 'signed' was emitted
      const signedEvent = txEvents.find(
        (e) => typeof e === 'object' && e !== null && (e as Record<string, unknown>).status === 'signed',
      ) as Record<string, unknown> | undefined;
      results.push({
        name: 'prepareExecute emits txChanged with "signed"',
        category: 'lifecycle',
        passed: !!signedEvent,
      });

      // Validate 'signed' payload shape
      if (signedEvent) {
        const payload = signedEvent.payload as Record<string, unknown> | undefined;
        results.push({
          name: 'signed event has payload.signature (string)',
          category: 'lifecycle',
          passed: typeof payload?.signature === 'string',
        });
        results.push({
          name: 'signed event has payload.signedBy (string)',
          category: 'lifecycle',
          passed: typeof payload?.signedBy === 'string',
        });
        results.push({
          name: 'signed event has payload.party (string)',
          category: 'lifecycle',
          passed: typeof payload?.party === 'string',
        });
      }

      // Check that a terminal state was reached
      const hasTerminal = txEvents.some(
        (e) =>
          typeof e === 'object' &&
          e !== null &&
          ((e as Record<string, unknown>).status === 'executed' ||
            (e as Record<string, unknown>).status === 'failed'),
      );
      results.push({
        name: 'prepareExecute reaches terminal tx state (executed or failed)',
        category: 'lifecycle',
        passed: hasTerminal,
      });

      // Validate 'executed' payload shape
      const executedEvent = txEvents.find(
        (e) => typeof e === 'object' && e !== null && (e as Record<string, unknown>).status === 'executed',
      ) as Record<string, unknown> | undefined;
      if (executedEvent) {
        const payload = executedEvent.payload as Record<string, unknown> | undefined;
        results.push({
          name: 'executed event has payload.updateId (string)',
          category: 'lifecycle',
          passed: typeof payload?.updateId === 'string',
        });
        results.push({
          name: 'executed event has payload.completionOffset (number)',
          category: 'lifecycle',
          passed: typeof payload?.completionOffset === 'number',
        });
      }
    } catch {
      // prepareExecute may throw — still check if events were emitted
      results.push({
        name: 'prepareExecute emits txChanged events (despite error)',
        category: 'lifecycle',
        passed: txEvents.length > 0,
        error: txEvents.length === 0 ? 'No txChanged events emitted before error' : undefined,
      });
    } finally {
      provider.removeListener(CIP0103_EVENTS.TX_CHANGED, txHandler);
    }
  }

  // ── ledgerApi handling test ────────────────────────────────────────

  try {
    await provider.request({
      method: 'ledgerApi',
      params: { requestMethod: 'GET', resource: '/v1/state/acs' },
    });
    results.push({
      name: 'ledgerApi returns result (supported)',
      category: 'method',
      passed: true,
    });
  } catch (err: unknown) {
    // ProviderRpcError with numeric code = method is recognized
    const isHandled = isNumericCodeError(err);
    results.push({
      name: 'ledgerApi is handled (returns result or ProviderRpcError)',
      category: 'method',
      passed: isHandled,
      error: isHandled ? undefined : `Unexpected error type: ${String(err)}`,
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isNumericCodeError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  return typeof (err as Record<string, unknown>).code === 'number';
}

// ─── Formatting ─────────────────────────────────────────────────────────────

export function formatCIP0103Report(report: CIP0103ConformanceReport): string {
  const lines: string[] = [
    '═══ CIP-0103 Conformance Report ═══',
    '',
    `Total: ${report.total}  Passed: ${report.passed}  Failed: ${report.failed}`,
    '',
  ];

  const categories = ['interface', 'method', 'event', 'error', 'lifecycle'] as const;
  for (const cat of categories) {
    const catResults = report.results.filter((r) => r.category === cat);
    if (catResults.length === 0) continue;
    lines.push(`── ${cat.toUpperCase()} ──`);
    for (const r of catResults) {
      const icon = r.passed ? '✓' : '✗';
      lines.push(`  ${icon} ${r.name}`);
      if (r.error) {
        lines.push(`    → ${r.error}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
