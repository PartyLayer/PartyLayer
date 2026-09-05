/**
 * Nightly Assurance failure sink.
 *
 * Keeps exactly ONE tracking issue for the nightly workflow, so a scheduled run
 * — which has no PR to report on and whose check-run lands on a sha nobody
 * revisits — still leaves a mark somewhere people look.
 *
 * Behaviour, and the reasoning for each choice:
 *
 *   - One issue, found by MARKER in the body rather than by title or label
 *     alone. A title can be edited and a label can be removed by hand; the
 *     marker survives both, so the sink cannot be tricked into opening a second
 *     issue and splitting the history.
 *   - Opened on the first failure. Issue creation notifies; that is the point.
 *   - Body rewritten on every subsequent failure. Body edits do NOT notify, so a
 *     long outage updates the facts without sending 38 identical pings — the
 *     surest way to get the whole thing muted.
 *   - A comment is posted only when the SET of failing jobs changes. A new job
 *     failing is new information and deserves a notification; the same job
 *     failing again does not.
 *   - Closed automatically when every job succeeds, with a comment recording how
 *     long it was broken.
 *   - A `cancelled` run is inconclusive and is ignored entirely: it must not
 *     open an issue, and it must not close one that is legitimately open.
 *
 * The consecutive-night counter is deliberate. "Nightly is failing" is easy to
 * skim past; "failing for 38 nights" is not, and the absence of that number is
 * exactly what let the last outage run as long as it did.
 */

const MARKER = '<!-- nightly-assurance-failure-sink -->';
const LABEL = 'nightly-failure';
const TITLE = 'Nightly Assurance is failing';

/** Parse `<!-- key: value -->` out of a body, so state survives between runs. */
function readState(body, key) {
  const m = new RegExp(`<!--\\s*${key}:\\s*(.*?)\\s*-->`).exec(body || '');
  return m ? m[1] : null;
}

function buildBody({ failing, streak, firstSha, firstDate, runUrl, sha }) {
  const failingKeys = failing.map((j) => j.key).join(',');
  const rows = failing.map((j) => `| ${j.name} | \`${j.result}\` |`).join('\n');
  const nights = streak === 1 ? '1 night' : `${streak} consecutive nights`;
  return [
    MARKER,
    `<!-- failing: ${failingKeys} -->`,
    `<!-- streak: ${streak} -->`,
    `<!-- first-sha: ${firstSha} -->`,
    `<!-- first-date: ${firstDate} -->`,
    '',
    `**Failing for ${nights}.**`,
    '',
    '| Job | Result |',
    '| --- | --- |',
    rows,
    '',
    `First seen: \`${firstSha}\` on ${firstDate}`,
    `Most recent: \`${sha}\` — [run log](${runUrl})`,
    '',
    '---',
    '',
    'This issue is maintained automatically by the `failure-sink` job in',
    '`.github/workflows/nightly.yml`. It is updated in place each night (edits do',
    'not notify) and a comment is added only when the set of failing jobs changes.',
    'It closes itself when a nightly run is fully green.',
    '',
    'Closing it by hand does not fix anything: the next failing run reopens the',
    'record as a new issue. Fix the failure, or delete the job that produces it.',
  ].join('\n');
}

/**
 * Run a write against the issues API, converting a permissions refusal into a
 * named, actionable failure.
 *
 * This matters more than it looks. The repository's default workflow token is
 * read-only, and this job elevates itself with a job-scoped `permissions:` block.
 * If an organisation policy forbids that elevation, every write here returns 403
 * — and the sink would quietly do nothing, on exactly the night it was needed.
 * A silent no-op is the bug this whole job exists to prevent, so refuse to fail
 * quietly: say what was denied and which setting to change.
 */
async function guarded(core, what, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err && (err.status === 403 || err.status === 404)) {
      core.setFailed(
        `The failure sink could not ${what}: the workflow token was denied (HTTP ${err.status}).\n` +
          'This job requests `issues: write` at job scope, but the repository default is read-only ' +
          'and an organisation policy can forbid elevating it. Fix it in Settings > Actions > General > ' +
          'Workflow permissions, or grant the org policy that allows a workflow to request write scopes. ' +
          'Until then the nightly has no failure sink and a red run surfaces nowhere.',
      );
      return null;
    }
    throw err;
  }
}

module.exports = async function failureSink({ github, context, core }) {
  const jobs = [
    { key: 'gate-main', name: 'Gate (main, drift detection)', result: process.env.R_GATE },
    { key: 'npm-consumer-canary', name: 'npm consumer canary (published packages)', result: process.env.R_CANARY },
    { key: 'session-persistence-e2e', name: 'Session persistence e2e (real browser)', result: process.env.R_SESSION },
    { key: 'mock-e2e', name: 'Mock E2E + security (full demo suite)', result: process.env.R_MOCK },
  ];

  // A cancelled run tells us nothing about the health of main. Do not open, do
  // not close, do not touch the streak.
  if (jobs.some((j) => j.result === 'cancelled')) {
    core.info('A job was cancelled; the run is inconclusive. Leaving the tracking issue untouched.');
    return;
  }

  const { owner, repo } = context.repo;
  const failing = jobs.filter((j) => j.result === 'failure');
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const sha = (context.sha || '').slice(0, 8);
  const today = new Date().toISOString().slice(0, 10);

  // Find the existing tracker. Listing by label is the cheap filter; the MARKER
  // is what actually identifies it.
  const open = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, state: 'open', labels: LABEL, per_page: 100,
  });
  const existing = open.find((i) => (i.body || '').includes(MARKER));

  if (failing.length === 0) {
    if (!existing) {
      core.info('Nightly is green and no tracking issue is open. Nothing to do.');
      return;
    }
    const streak = readState(existing.body, 'streak') || '?';
    const firstDate = readState(existing.body, 'first-date') || 'unknown';
    const ok = await guarded(core, 'comment on the tracking issue', () =>
      github.rest.issues.createComment({
        owner, repo, issue_number: existing.number,
        body: `Nightly Assurance is green again as of \`${sha}\` ([run log](${runUrl})).\n\nIt had been failing for ${streak} night(s), first seen ${firstDate}. Closing automatically.`,
      }));
    if (ok === null) return;
    await guarded(core, 'close the tracking issue', () =>
      github.rest.issues.update({ owner, repo, issue_number: existing.number, state: 'closed' }));
    core.info(`Closed #${existing.number}: nightly is green again.`);
    return;
  }

  const failingKeys = failing.map((j) => j.key).join(',');

  if (!existing) {
    const body = buildBody({ failing, streak: 1, firstSha: sha, firstDate: today, runUrl, sha });
    const created = await guarded(core, 'open the tracking issue', () =>
      github.rest.issues.create({ owner, repo, title: TITLE, body, labels: [LABEL] }));
    if (created === null) return;
    core.info(`Opened #${created.data.number} for: ${failingKeys}`);
    return;
  }

  const prevKeys = readState(existing.body, 'failing') || '';
  const streak = Number(readState(existing.body, 'streak') || '0') + 1;
  const firstSha = readState(existing.body, 'first-sha') || sha;
  const firstDate = readState(existing.body, 'first-date') || today;

  const updated = await guarded(core, 'update the tracking issue', () =>
    github.rest.issues.update({
      owner, repo, issue_number: existing.number,
      body: buildBody({ failing, streak, firstSha, firstDate, runUrl, sha }),
    }));
  if (updated === null) return;

  // Only a CHANGE in what is broken is worth a notification.
  if (prevKeys !== failingKeys) {
    await guarded(core, 'comment on the tracking issue', () =>
      github.rest.issues.createComment({
        owner, repo, issue_number: existing.number,
        body: `The set of failing jobs changed.\n\nWas: \`${prevKeys || '(none recorded)'}\`\nNow: \`${failingKeys}\`\n\nAt \`${sha}\` — [run log](${runUrl}).`,
      }));
    core.info(`Updated #${existing.number} and commented: failing set changed to ${failingKeys}`);
  } else {
    core.info(`Updated #${existing.number} in place (night ${streak}, same failing set).`);
  }
};
