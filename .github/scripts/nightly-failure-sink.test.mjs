/**
 * Tests for the Nightly Assurance failure sink.
 *
 * The sink exists because a red signal nobody reads is worth nothing. A test
 * that never runs is the same bug one level up, so this file is wired into the
 * gate (`gate:workflow-scripts`) rather than left to be run by hand.
 *
 * Each case asserts what the sink DID — the API calls it made and their
 * arguments — not merely that it returned without throwing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const failureSink = require('./nightly-failure-sink.cjs');

const ALL = ['R_GATE', 'R_CANARY', 'R_SESSION', 'R_MOCK', 'R_MANUAL'];

/** A fake Octokit that records every call instead of performing it. */
function harness({ openIssues = [] } = {}) {
  const calls = { create: [], update: [], comment: [] };
  const github = {
    paginate: async () => openIssues,
    rest: {
      issues: {
        listForRepo: () => {},
        create: async (a) => { calls.create.push(a); return { data: { number: 42 } }; },
        update: async (a) => { calls.update.push(a); },
        createComment: async (a) => { calls.comment.push(a); },
      },
    },
  };
  const context = {
    repo: { owner: 'o', repo: 'r' },
    serverUrl: 'https://example.invalid',
    runId: 7,
    sha: 'abcdef1234567890',
  };
  const core = { info: () => {} };
  return { github, context, core, calls };
}

function setResults(results) {
  ALL.forEach((k, i) => { process.env[k] = results[i]; });
}

test('first failure opens one labelled issue with a streak of 1', async () => {
  setResults(['success', 'success', 'success', 'failure', 'success']);
  const h = harness();
  await failureSink(h);

  assert.equal(h.calls.create.length, 1, 'should create exactly one issue');
  const body = h.calls.create[0].body;
  assert.match(body, /<!-- nightly-assurance-failure-sink -->/);
  assert.match(body, /<!-- failing: mock-e2e -->/);
  assert.match(body, /<!-- streak: 1 -->/);
  assert.match(body, /\*\*Failing for 1 night\.\*\*/);
  assert.deepEqual(h.calls.create[0].labels, ['nightly-failure']);
  assert.equal(h.calls.comment.length, 0, 'creation notifies; no extra comment');
});

test('a repeat of the SAME failure updates in place and does not comment', async () => {
  setResults(['success', 'success', 'success', 'failure', 'success']);
  const h = harness({
    openIssues: [{
      number: 5,
      body: '<!-- nightly-assurance-failure-sink -->\n<!-- failing: mock-e2e -->\n<!-- streak: 37 -->\n<!-- first-sha: 5bed981a -->\n<!-- first-date: 2026-07-30 -->',
    }],
  });
  await failureSink(h);

  assert.equal(h.calls.create.length, 0, 'must reuse the existing tracker');
  assert.equal(h.calls.update.length, 1);
  assert.match(h.calls.update[0].body, /<!-- streak: 38 -->/, 'streak increments');
  assert.match(h.calls.update[0].body, /38 consecutive nights/);
  assert.match(h.calls.update[0].body, /first-sha: 5bed981a/, 'first-seen is preserved');
  assert.equal(h.calls.comment.length, 0, 'same failure must not notify again');
});

test('a CHANGE in the failing set posts a comment', async () => {
  setResults(['failure', 'success', 'success', 'failure', 'success']);
  const h = harness({
    openIssues: [{
      number: 5,
      body: '<!-- nightly-assurance-failure-sink -->\n<!-- failing: mock-e2e -->\n<!-- streak: 3 -->\n<!-- first-sha: aaaaaaaa -->\n<!-- first-date: 2026-09-01 -->',
    }],
  });
  await failureSink(h);

  assert.equal(h.calls.comment.length, 1, 'new information must notify');
  assert.match(h.calls.comment[0].body, /Was: `mock-e2e`/);
  assert.match(h.calls.comment[0].body, /Now: `gate-main,mock-e2e`/);
});

test('a fully green run closes the open tracker', async () => {
  setResults(['success', 'success', 'success', 'success', 'success']);
  const h = harness({
    openIssues: [{
      number: 5,
      body: '<!-- nightly-assurance-failure-sink -->\n<!-- failing: mock-e2e -->\n<!-- streak: 38 -->\n<!-- first-sha: 5bed981a -->\n<!-- first-date: 2026-07-30 -->',
    }],
  });
  await failureSink(h);

  assert.equal(h.calls.comment.length, 1);
  assert.match(h.calls.comment[0].body, /green again/);
  assert.match(h.calls.comment[0].body, /38 night/);
  assert.equal(h.calls.update.length, 1);
  assert.equal(h.calls.update[0].state, 'closed');
});

test('a green run with no tracker open does nothing', async () => {
  setResults(['success', 'success', 'success', 'success', 'success']);
  const h = harness();
  await failureSink(h);
  assert.deepEqual([h.calls.create, h.calls.update, h.calls.comment], [[], [], []]);
});

test('a cancelled run is inconclusive: it neither opens nor closes', async () => {
  setResults(['cancelled', 'success', 'success', 'failure', 'success']);
  const h = harness({
    openIssues: [{ number: 5, body: '<!-- nightly-assurance-failure-sink -->\n<!-- streak: 2 -->' }],
  });
  await failureSink(h);
  assert.deepEqual([h.calls.create, h.calls.update, h.calls.comment], [[], [], []]);
});

test('an unrelated open issue carrying the label is not mistaken for the tracker', async () => {
  setResults(['success', 'success', 'success', 'failure', 'success']);
  const h = harness({ openIssues: [{ number: 9, body: 'someone filed this by hand' }] });
  await failureSink(h);
  assert.equal(h.calls.create.length, 1, 'the MARKER identifies the tracker, not the label');
});

test('a permissions refusal fails the job loudly instead of doing nothing', async () => {
  setResults(['success', 'success', 'success', 'failure', 'success']);
  const h = harness();
  const denied = Object.assign(new Error('Resource not accessible by integration'), { status: 403 });
  h.github.rest.issues.create = async () => { throw denied; };
  let failure = null;
  h.core.setFailed = (m) => { failure = m; };

  await failureSink(h);

  assert.ok(failure, 'a denied write must call core.setFailed, not return quietly');
  assert.match(failure, /HTTP 403/);
  assert.match(failure, /Workflow permissions/, 'the message must name the setting to change');
});

test('an unexpected API error is not swallowed', async () => {
  setResults(['success', 'success', 'success', 'failure', 'success']);
  const h = harness();
  h.github.rest.issues.create = async () => {
    throw Object.assign(new Error('boom'), { status: 500 });
  };
  await assert.rejects(() => failureSink(h), /boom/);
});

test('a stale manual-coverage ledger is reported by name, not folded into another job', async () => {
  // The a2 specs cannot run in CI, so their only signal is the by-hand ledger
  // going stale. That has to arrive as its own failing job: routed through
  // gate-main it would read as dependency drift, which is a different problem
  // with a different fix.
  setResults(['success', 'success', 'success', 'success', 'failure']);
  const h = harness();
  await failureSink(h);

  assert.equal(h.calls.create.length, 1);
  const body = h.calls.create[0].body;
  assert.match(body, /<!-- failing: manual-coverage -->/);
  assert.match(body, /Manual coverage \(by-hand specs still current\)/);
});
