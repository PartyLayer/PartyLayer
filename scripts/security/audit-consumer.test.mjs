import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectConsumerAudit } from './audit-consumer.mjs';

const report = () => ({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 0 } } });
test('permits documented moderate findings without pretending they are zero', () => {
  assert.equal(inspectConsumerAudit(report()).moderate, 1);
});
test('blocks high/critical findings even if aggregate counts disagree with advisory entries', () => {
  for (const severity of ['high', 'critical']) {
    const a = report(); a.metadata.vulnerabilities[severity] = 1; assert.throws(() => inspectConsumerAudit(a), /high\/critical/);
    const b = report(); b.vulnerabilities.affected = { severity }; assert.throws(() => inspectConsumerAudit(b), /high\/critical/);
  }
});
test('fails closed on network/authentication errors, missing counts, unknown formats and severities', () => {
  for (const value of [{}, { ...report(), error: { code: 'E401' } }, { ...report(), auditReportVersion: 3 },
    { ...report(), vulnerabilities: { module: { severity: 'unrecognized' } } },
    { ...report(), metadata: { vulnerabilities: { ...report().metadata.vulnerabilities, high: -1 } } }]) {
    assert.throws(() => inspectConsumerAudit(value));
  }
});
