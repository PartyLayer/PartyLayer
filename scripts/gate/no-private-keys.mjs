#!/usr/bin/env node
/**
 * Regression gate: no private key material in the working tree.
 *
 * This repository is PUBLIC. The registry signing public key, the .sig files,
 * sign.ts, verify.ts and SIGNING.md all belong in it, because that is what lets
 * anyone verify the registry. The PRIVATE key must never be here.
 *
 * Why a gate and not just .gitignore: an ignore rule stops an accidental
 * `git add`, but it does nothing about a key that is force-added, added before
 * the rule existed, or written by a tool into a path the rule does not cover.
 * A private key that reaches public git history is compromised permanently.
 * Rotation is the only remedy and deleting the file does not undo the exposure.
 * This project has already had one key exposed, so the cost of being late here
 * is known rather than hypothetical.
 *
 * Two independent checks:
 *
 *   1. PATH SHAPE, over files git actually tracks. A tracked file whose name
 *      looks like private key material fails, regardless of content.
 *   2. CONTENT, over tracked text files. A PEM private key header or a
 *      base64 blob sitting in a file named like a key fails, because the real
 *      exposures do not always have an obvious extension.
 *
 * Scanning `git ls-files` rather than the filesystem is deliberate: an ignored
 * key sitting in a developer's working tree is exactly what the ignore rule is
 * for, and failing on it would make the gate unrunnable for the one person who
 * legitimately holds the key.
 *
 * Run via `pnpm gate:no-private-keys`.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Filenames that are private key material by shape. `.pub` is never a match. */
const KEY_PATH = [
  /\.key$/i,
  /\.pem$/i,
  /\.p8$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,
  /(^|\/)registry\/keys\/(?!.*\.pub$)(?!README\.md$).+/i,
];

/** Content markers that are unambiguously private key material. */
const KEY_CONTENT = [
  /-----BEGIN (RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/,
  /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
];

/** Paths whose job is to TALK about keys rather than contain one. */
const DOC_ALLOWLIST = [
  /^SIGNING\.md$/,
  /^\.gitignore$/,
  /^scripts\/gate\/no-private-keys\.mjs$/,
  /^scripts\/registry\/(sign|verify)\.ts$/,
  /^docs\//,
  /^CONTRIBUTING\.md$/,
  /\.test\.(ts|mjs|js)$/,
];

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const failures = [];

for (const rel of tracked) {
  if (KEY_PATH.some((re) => re.test(rel))) {
    failures.push({ rel, why: 'filename is private key material by shape' });
    continue;
  }
  if (DOC_ALLOWLIST.some((re) => re.test(rel))) continue;

  let full;
  try {
    full = join(ROOT, rel);
    // Skip anything large or binary; key material is small and textual.
    if (statSync(full).size > 512 * 1024) continue;
  } catch {
    continue;
  }

  let text;
  try {
    text = readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\0')) continue;

  for (const re of KEY_CONTENT) {
    if (re.test(text)) {
      failures.push({ rel, why: `contains ${re.source.slice(0, 40)}` });
      break;
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL no-private-keys: private key material is tracked in this repository.\n');
  for (const f of failures) {
    console.error(`  ${f.rel}\n      ${f.why}`);
  }
  console.error(
    '\nThis repository is public. Remove the file, and treat the key as\n' +
      'COMPROMISED: rotate it. Deleting it from the tree does not undo the\n' +
      'exposure, because it stays in git history and in every clone and fork.\n' +
      'See SIGNING.md, "If a private key is exposed".\n',
  );
  process.exit(1);
}

console.log(
  `OK no-private-keys: ${tracked.length} tracked files scanned, no private key material found.`,
);
