#!/usr/bin/env node
/**
 * PartyLayer Conformance Runner CLI
 * 
 * Runs adapter conformance tests and generates reports.
 */

import { program } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { loadAdapter } from './loader';
import { runConformanceTests, createMockContext } from './tests';
import { generateReport, formatReportText, type ConformanceReport } from './report';

program
  .name('partylayer-conformance')
  .description('Run conformance tests for PartyLayer wallet adapters')
  .version('0.1.0');

program
  .command('run')
  .description('Run conformance tests for an adapter')
  .requiredOption('--adapter <packageOrPath>', 'Adapter package name or path')
  .option('--network <network>', 'Network to use', 'devnet')
  .option('--registryUrl <url>', 'Registry URL (optional)')
  .option('--output <path>', 'Output JSON report path', 'conformance-report.json')
  .action(async (options) => {
    try {
      console.log(`Loading adapter: ${options.adapter}`);
      const adapter = await loadAdapter(options.adapter);

      console.log(`Running conformance tests for: ${adapter.name} (${adapter.walletId})`);
      const context = createMockContext();
      context.network = options.network as 'devnet' | 'testnet' | 'mainnet';

      const startTime = Date.now();
      const testResults = await runConformanceTests(adapter, context);

      const report = generateReport(
        {
          walletId: adapter.walletId,
          name: adapter.name,
        },
        testResults,
        startTime
      );

      // Write JSON report
      writeFileSync(options.output, JSON.stringify(report, null, 2));
      console.log(`\nReport written to: ${options.output}`);

      // Print human-readable summary
      console.log('\n' + formatReportText(report));

      // Exit with error code if tests failed
      if (report.results.failed > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error('Error running conformance tests:', err);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Format and display a conformance report')
  .requiredOption('--input <path>', 'Input JSON report path')
  .action((options) => {
    try {
      if (!existsSync(options.input)) {
        console.error(`Report file not found: ${options.input}`);
        process.exit(1);
      }

      const reportJson = readFileSync(options.input, 'utf-8');
      const report = JSON.parse(reportJson) as ConformanceReport;

      console.log(formatReportText(report));

      if (report.results.failed > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error('Error reading report:', err);
      process.exit(1);
    }
  });

program.parse();
