/**
 * Conformance Report Generation
 */

import type { TestResult } from './tests';

/**
 * Conformance report
 */
export interface ConformanceReport {
  adapter: {
    walletId: string;
    name: string;
    version?: string;
  };
  environment: {
    nodeVersion: string;
    platform: string;
    timestamp: string;
  };
  results: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
  tests: TestResult[];
}

/**
 * Generate conformance report
 */
export function generateReport(
  adapter: { walletId: string; name: string; version?: string },
  tests: TestResult[],
  startTime: number
): ConformanceReport {
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;

  return {
    adapter,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
    },
    results: {
      total: tests.length,
      passed,
      failed,
      duration: Date.now() - startTime,
    },
    tests,
  };
}

/**
 * Format report as human-readable text
 */
export function formatReportText(report: ConformanceReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('PartyLayer Adapter Conformance Report');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Adapter: ${report.adapter.name} (${report.adapter.walletId})`);
  if (report.adapter.version) {
    lines.push(`Version: ${report.adapter.version}`);
  }
  lines.push(`Environment: Node ${report.environment.nodeVersion} on ${report.environment.platform}`);
  lines.push(`Timestamp: ${report.environment.timestamp}`);
  lines.push('');
  lines.push('Summary:');
  lines.push(`  Total Tests: ${report.results.total}`);
  lines.push(`  Passed: ${report.results.passed}`);
  lines.push(`  Failed: ${report.results.failed}`);
  lines.push(`  Duration: ${report.results.duration}ms`);
  lines.push('');
  lines.push('Test Results:');
  lines.push('-'.repeat(60));

  report.tests.forEach((test, index) => {
    const status = test.passed ? '✓' : '✗';
    lines.push(`${index + 1}. ${status} ${test.name}`);
    if (test.details) {
      Object.entries(test.details).forEach(([key, value]) => {
        lines.push(`   ${key}: ${JSON.stringify(value)}`);
      });
    }
    if (test.error) {
      lines.push(`   Error: ${test.error}`);
    }
  });

  lines.push('-'.repeat(60));
  lines.push('');

  if (report.results.failed === 0) {
    lines.push('✓ All tests passed!');
  } else {
    lines.push(`✗ ${report.results.failed} test(s) failed`);
  }

  return lines.join('\n');
}
