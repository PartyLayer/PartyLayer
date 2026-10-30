import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** No severity suppression: inspect the actual clean consumer graph, not workspace dev peers. */
export function inspectConsumerAudit(report) {
  const counts = report?.metadata?.vulnerabilities;
  if (report?.error || report?.auditReportVersion !== 2 || !counts || !report.vulnerabilities ||
    typeof report.vulnerabilities !== 'object' || Array.isArray(report.vulnerabilities) ||
    !['info', 'low', 'moderate', 'high', 'critical'].every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)) {
    throw new Error('npm audit returned an invalid report; dependency security was not verified');
  }
  const entries = Object.values(report.vulnerabilities);
  if (entries.some(entry => !['info', 'low', 'moderate', 'high', 'critical'].includes(entry?.severity))) throw new Error('Unknown audit severity');
  if (counts.high || counts.critical || entries.some(entry => ['high', 'critical'].includes(entry.severity))) {
    throw new Error('The clean consumer has high/critical dependency findings; inspect its saved audit report');
  }
  return counts;
}

export async function auditConsumer(directory, reportPath) {
  let result; let failure;
  try {
    result = await promisify(execFile)('npm', ['audit', '--omit=dev', '--audit-level=high', '--json', '--registry=https://registry.npmjs.org'],
      { cwd: directory, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) { result = error; failure = error; }
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, result.stdout ?? JSON.stringify({ error: 'npm audit did not produce a report' }));
  const counts = inspectConsumerAudit(JSON.parse(result.stdout ?? '{}'));
  if (failure) throw new Error('npm audit command failed; dependency security was not verified');
  console.log(`Clean consumer audit: ${counts.critical} critical, ${counts.high} high, ${counts.moderate} moderate. Full report: ${reportPath}`);
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node audit-consumer.mjs <consumer-directory> <report-path>');
  await auditConsumer(resolve(process.argv[2]), resolve(process.argv[3]));
}
