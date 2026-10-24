import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Aggregate public data only. No SDK telemetry or end-user identifiers.
export const PACKAGES = ['@partylayer/react', '@partylayer/sdk', 'create-partylayer-app'];

async function json(fetcher, url) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function readDownloads(data, name) {
  if (data.package !== name || !Number.isSafeInteger(data.downloads) || data.downloads < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.start ?? '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.end ?? '') || data.start > data.end) {
    throw new Error('Invalid download response');
  }
  return { downloads: data.downloads, start: data.start, end: data.end };
}

export async function snapshot({ fetcher = fetch, now = new Date() } = {}) {
  const failures = [];
  const capture = async (label, task) => {
    try { return await task(); }
    catch (error) { failures.push({ source: label, error: error.message }); return null; }
  };
  const packages = [];
  // Bound external requests to three at a time; preserve each API's reported window.
  for (const name of PACKAGES) {
    const id = encodeURIComponent(name);
    const [week, month, latest] = await Promise.all([
      capture(`${name}:week`, async () => readDownloads(await json(fetcher, `https://api.npmjs.org/downloads/point/last-week/${id}`), name)),
      capture(`${name}:month`, async () => readDownloads(await json(fetcher, `https://api.npmjs.org/downloads/point/last-month/${id}`), name)),
      capture(`${name}:latest`, async () => {
        const data = await json(fetcher, `https://registry.npmjs.org/${id}/latest`);
        if (data.name !== name || typeof data.version !== 'string') throw new Error('Invalid package manifest');
        return { version: data.version, description: data.description, keywords: data.keywords ?? [] };
      }),
    ]);
    packages.push({ name, week, month, latest });
  }
  const github = await capture('github:repository', async () => {
    const data = await json(fetcher, 'https://api.github.com/repos/PartyLayer/PartyLayer');
    const fields = ['stargazers_count', 'forks_count', 'open_issues_count'];
    if (data.full_name !== 'PartyLayer/PartyLayer' || fields.some(key => !Number.isSafeInteger(data[key]) || data[key] < 0)) throw new Error('Invalid repository response');
    return Object.fromEntries(fields.map(key => [key, data[key]]));
  });
  return {
    schemaVersion: 1, collectedAt: now.toISOString(), complete: failures.length === 0,
    packages, github, failures,
    interpretation: 'Downloads include dependency installs, CI and other automated traffic. Do not sum package counts into unique users or integrations. Missing data is null, never zero. Search Console and verified production applications require separate evidence.',
  };
}

export function markdown(report) {
  const rows = report.packages.map(p => `| ${p.name} | ${p.latest?.version ?? 'unavailable'} | ${p.week ? `${p.week.downloads} (${p.week.start}–${p.week.end})` : 'unavailable'} | ${p.month ? `${p.month.downloads} (${p.month.start}–${p.month.end})` : 'unavailable'} |`);
  return `# PartyLayer public growth snapshot\n\nCollected: ${report.collectedAt}. Status: ${report.complete ? 'complete' : 'partial — inspect failures'}.\n\n| Package | npm latest | Weekly downloads (reported window) | Monthly downloads (reported window) |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\nGitHub: ${report.github ? `${report.github.stargazers_count} stars; ${report.github.forks_count} forks; ${report.github.open_issues_count} open issues including pull requests.` : 'unavailable'}\n\n${report.interpretation}\n\n${report.failures.length ? `Failures: ${report.failures.map(f => `${f.source}: ${f.error}`).join('; ')}\n` : ''}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = resolve(process.argv[2] ?? 'artifacts/growth');
  const report = await snapshot();
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'snapshot.json'), JSON.stringify(report, null, 2) + '\n');
  const text = markdown(report);
  await writeFile(join(output, 'summary.md'), text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
  console.log(text);
  if (!report.complete) process.exitCode = 1;
}
