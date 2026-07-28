/**
 * Docs drift guard (gate:docs-drift).
 *
 * Four topics are documented in two independent places that no codegen keeps in
 * sync: a markdown file under `docs/<slug>.md` (read on GitHub) and a hand-authored
 * site page under `apps/demo/src/app/docs/<slug>/content.tsx` (served at
 * partylayer.xyz/docs/<slug>). Because the site page is written by hand rather than
 * rendered from the markdown, the two can drift silently, and they have: the
 * generic-bridge guide was rewritten in markdown while the published page kept the
 * old announce-only version, so an external reader saw stale docs.
 *
 * This test is the thing that stops that recurring. For every slug that exists in
 * BOTH places it compares the set of section headings (the `##` / `###` skeleton of
 * the markdown against the `<H2>` / `<H3>` skeleton of the page) and fails naming the
 * pair and exactly which side is missing which heading. Headings are the right signal
 * here: they are the structural contract a reader navigates by (and the in-page anchor
 * targets), they are cheap to keep aligned, and a section added or removed on one side
 * but not the other is precisely the drift we got burned by. Prose wording is
 * deliberately not compared: the two renderings legitimately differ in phrasing, and
 * gating on that would be noise, not signal.
 *
 * The pair list is DERIVED, not hardcoded (see `discoverPairs`): a new doc added in
 * both places is caught automatically and must be classified here, so the guard cannot
 * silently miss a fifth pair.
 *
 * Not every shared slug is two copies of one document. `quick-start` is a documented
 * exception: `docs/quick-start.md` is a full multi-framework reference (Zero Config,
 * Custom UI with Hooks, Vanilla JavaScript, Manual Client Setup) while the site page is
 * a three-step getting-started tutorial. They share a slug but are different documents,
 * so heading agreement is not a meaningful signal for them. Rather than pretend parity
 * (the framework-consistency guard makes the same honest call about the three framework
 * packages), this test records that divergence explicitly and asserts it still holds,
 * so if someone later reconciles the two the guard fails and tells them to promote the
 * pair to `enforce`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS_DIR = join(ROOT, 'docs');
const PAGES_DIR = join(ROOT, 'apps', 'demo', 'src', 'app', 'docs');

const mdPath = (slug) => join(DOCS_DIR, `${slug}.md`);
const pagePath = (slug) => join(PAGES_DIR, slug, 'content.tsx');

/**
 * How each shared-slug pair is treated. `enforce` pairs must have identical heading
 * sets. A `known-divergence` pair is two different documents that share a slug; its
 * `reason` explains why, and the guard asserts the divergence persists rather than
 * silently skipping it.
 */
const CLASSIFICATION = {
  'generic-bridge': { mode: 'enforce' },
  'partylayer-and-canton-topology': { mode: 'enforce' },
  'dev-and-staging': { mode: 'enforce' },
  'quick-start': {
    mode: 'known-divergence',
    reason:
      'docs/quick-start.md is a full multi-framework reference (Zero Config, Custom UI with ' +
      'Hooks, Vanilla JavaScript, Manual Client Setup); the site page is a three-step ' +
      'getting-started tutorial. They share a slug but are different documents, not two copies ' +
      'of one doc. Decide the canonical form (reconcile them, delete the stale markdown, or keep ' +
      'them intentionally separate) before promoting this pair to enforce.',
  },
};

const FIX = (slug) =>
  `Bring docs/${slug}.md and apps/demo/src/app/docs/${slug}/content.tsx back into agreement ` +
  `(the markdown is the source of truth), or, if they are meant to differ, classify the pair in ` +
  `scripts/gate/docs-drift.test.mjs.`;

/** Every slug that has both a markdown file and a site page. Derived, not hardcoded. */
function discoverPairs() {
  const mdSlugs = new Set(
    readdirSync(DOCS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.slice(0, -3)),
  );
  return readdirSync(PAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(pagePath(d.name)) && mdSlugs.has(d.name))
    .map((d) => d.name)
    .sort();
}

/** Collapse the trivia that differs between markdown and JSX but carries no meaning. */
function normalizeHeading(raw) {
  return raw
    .replace(/`/g, '') // markdown inline-code ticks
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The `##` and `###` headings of a markdown doc (the H1 title is intentionally excluded). */
function markdownHeadings(slug) {
  const text = readFileSync(mdPath(slug), 'utf8');
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (m) out.push(normalizeHeading(m[2]));
  }
  return out;
}

/** The `<H2>` and `<H3>` heading text of a site page (matching markdownHeadings' levels). */
function pageHeadings(slug) {
  const text = readFileSync(pagePath(slug), 'utf8');
  const out = [];
  for (const m of text.matchAll(/<H([23])[^>]*>([\s\S]*?)<\/H\1>/g)) {
    const inner = m[2]
      .replace(/<[^>]+>/g, '') // strip nested JSX tags (e.g. <Code>, <Strong>)
      .replace(/\{'([^']*)'\}/g, '$1') // unwrap {'literal'} expressions, including {' '} spacers
      .replace(/\{`([^`]*)`\}/g, '$1');
    out.push(normalizeHeading(inner));
  }
  return out;
}

/** Set difference a \ b, preserving order and duplicates from a. */
function missingFrom(a, b) {
  const bset = new Set(b);
  return a.filter((x) => !bset.has(x));
}

const PAIRS = discoverPairs();

test('every doc that lives in two places is classified in this guard', () => {
  const unclassified = PAIRS.filter((slug) => !CLASSIFICATION[slug]);
  assert.deepEqual(
    unclassified,
    [],
    `New docs exist as both docs/<slug>.md and a site page but are not classified in ` +
      `scripts/gate/docs-drift.test.mjs: ${unclassified.join(', ')}. Add each as 'enforce' ` +
      `(the site page must track the markdown) or 'known-divergence' (they are different documents).`,
  );
  // And no classification names a pair that no longer exists in both places.
  const stale = Object.keys(CLASSIFICATION).filter((slug) => !PAIRS.includes(slug));
  assert.deepEqual(stale, [], `Classified pairs no longer exist in both places: ${stale.join(', ')}.`);
});

for (const slug of PAIRS) {
  const { mode, reason } = CLASSIFICATION[slug] ?? {};

  if (mode === 'enforce') {
    test(`${slug}: markdown and site page have the same section headings`, () => {
      const md = markdownHeadings(slug);
      const page = pageHeadings(slug);
      const onlyInMarkdown = missingFrom(md, page);
      const onlyInPage = missingFrom(page, md);
      const parts = [];
      if (onlyInMarkdown.length) {
        parts.push(
          `the site page is missing ${onlyInMarkdown.length} heading(s) that docs/${slug}.md has: ` +
            onlyInMarkdown.map((h) => `"${h}"`).join(', '),
        );
      }
      if (onlyInPage.length) {
        parts.push(
          `docs/${slug}.md is missing ${onlyInPage.length} heading(s) that the site page has: ` +
            onlyInPage.map((h) => `"${h}"`).join(', '),
        );
      }
      assert.ok(
        onlyInMarkdown.length === 0 && onlyInPage.length === 0,
        `Docs drift in "${slug}": ${parts.join('; ')}. ${FIX(slug)}`,
      );
    });
  }

  if (mode === 'known-divergence') {
    test(`${slug}: documented divergence still holds (not silently reconciled)`, () => {
      const md = new Set(markdownHeadings(slug));
      const page = new Set(pageHeadings(slug));
      const shared = [...md].filter((h) => page.has(h));
      // If the two ever converge on the same headings, the exception is stale: promote to enforce.
      assert.ok(
        shared.length < md.size || shared.length < page.size,
        `"${slug}" is classified as a known divergence, but docs/${slug}.md and the site page now ` +
          `share the same section headings. Promote it to 'enforce' in ` +
          `scripts/gate/docs-drift.test.mjs and remove the divergence note. Reason on record: ${reason}`,
      );
    });
  }
}
