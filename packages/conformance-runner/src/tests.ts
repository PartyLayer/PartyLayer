/**
 * Adapter Conformance Tests
 * 
 * Standard contract tests that all adapters must pass.
 */

import type {
  WalletAdapter,
  AdapterContext,
  CapabilityKey,
} from '@partylayer/core';
import {
  CapabilityNotSupportedError,
} from '@partylayer/core';

/**
 * Test result
 */
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Conformance test suite
 */
export interface ConformanceSuite {
  adapter: WalletAdapter;
  context: AdapterContext;
  results: TestResult[];
}

/**
 * Create mock adapter context
 */
export function createMockContext(): AdapterContext {
  return {
    appName: 'Conformance Test',
    origin: 'https://test.example.com',
    network: 'devnet',
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    telemetry: undefined,
    registry: {
      getWallet: async () => ({}),
    },
    crypto: {
      encrypt: async (data: string) => data,
      decrypt: async (data: string) => data,
      generateKey: async () => 'test-key',
    },
    storage: {
      get: async () => null,
      set: async () => {},
      remove: async () => {},
      clear: async () => {},
    },
    timeout: async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      throw new Error('Timeout');
    },
  };
}

/**
 * Run conformance tests
 */
export async function runConformanceTests(
  adapter: WalletAdapter,
  context: AdapterContext
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: Adapter has required properties
  results.push({
    name: 'Adapter has walletId',
    passed: typeof adapter.walletId === 'string' && adapter.walletId.length > 0,
    details: { walletId: adapter.walletId },
  });

  results.push({
    name: 'Adapter has name',
    passed: typeof adapter.name === 'string' && adapter.name.length > 0,
    details: { name: adapter.name },
  });

  // Test 2: getCapabilities returns valid array
  let capabilities: CapabilityKey[];
  try {
    capabilities = adapter.getCapabilities();
    results.push({
      name: 'getCapabilities returns array',
      passed: Array.isArray(capabilities),
      details: { capabilities },
    });

    // Check for required capabilities
    const hasConnect = capabilities.includes('connect');
    results.push({
      name: 'Capabilities include "connect"',
      passed: hasConnect,
      details: { capabilities },
    });
  } catch (err) {
    results.push({
      name: 'getCapabilities throws error',
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return results; // Can't continue without capabilities
  }

  // Test 3: detectInstalled returns valid result
  try {
    const detect = await adapter.detectInstalled();
    results.push({
      name: 'detectInstalled returns valid result',
      passed:
        typeof detect === 'object' &&
        typeof detect.installed === 'boolean' &&
        (detect.installed || typeof detect.reason === 'string'),
      details: { detect },
    });
  } catch (err) {
    results.push({
      name: 'detectInstalled throws error',
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Test 4: If detectInstalled returns false, connect should throw WalletNotInstalledError
  // (This test requires mocking detectInstalled - skip for now or use mock adapter)

  // Test 5: Capability checks
  if (capabilities.includes('signMessage')) {
    if (typeof adapter.signMessage !== 'function') {
      results.push({
        name: 'signMessage capability declared but method missing',
        passed: false,
        error: 'signMessage capability declared but method not implemented',
      });
    }
  } else {
    // If signMessage not in capabilities, calling it should throw CapabilityNotSupportedError
    if (typeof adapter.signMessage === 'function') {
      try {
        await adapter.signMessage(context, {} as any, { message: 'test' });
        results.push({
          name: 'signMessage throws CapabilityNotSupportedError when not supported',
          passed: false,
          error: 'signMessage did not throw error',
        });
      } catch (err) {
        const passed = err instanceof CapabilityNotSupportedError;
        results.push({
          name: 'signMessage throws CapabilityNotSupportedError when not supported',
          passed,
          error: passed ? undefined : err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Similar tests for signTransaction and submitTransaction
  if (capabilities.includes('signTransaction')) {
    if (typeof adapter.signTransaction !== 'function') {
      results.push({
        name: 'signTransaction capability declared but method missing',
        passed: false,
        error: 'signTransaction capability declared but method not implemented',
      });
    }
  }

  if (capabilities.includes('submitTransaction')) {
    if (typeof adapter.submitTransaction !== 'function') {
      results.push({
        name: 'submitTransaction capability declared but method missing',
        passed: false,
        error: 'submitTransaction capability declared but method not implemented',
      });
    }
  }

  // Test 6: Error mapping
  // Verify adapter uses mapUnknownErrorToPartyLayerError
  // (This is a code inspection test - hard to test at runtime)

  return results;
}
