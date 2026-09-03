#!/usr/bin/env node
/**
 * Registry signing script
 * 
 * Signs a registry JSON file using Ed25519.
 * Outputs a separate .sig file.
 * 
 * Usage:
 *   tsx scripts/registry/sign.ts --channel stable --key registry/keys/dev.key
 *   tsx scripts/registry/sign.ts --channel beta --key registry/keys/dev.key
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, resolve, relative, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { program } from 'commander';

// For Node.js 18+, we can use Web Crypto API
import { webcrypto } from 'crypto';
const crypto = webcrypto as Crypto;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

/**
 * Generate Ed25519 key pair (dev only)
 */
async function generateKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return await crypto.subtle.generateKey(
    {
      name: 'Ed25519',
      namedCurve: 'Ed25519',
    },
    true, // extractable
    ['sign', 'verify']
  );
}

/**
 * Export public key to base64
 */
async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', publicKey);
  return Buffer.from(exported).toString('base64');
}

/**
 * Export private key to base64 (dev only)
 */
async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  return Buffer.from(exported).toString('base64');
}

/**
 * Import private key from base64
 */
async function importPrivateKey(keyBase64: string): Promise<CryptoKey> {
  const keyBuffer = Buffer.from(keyBase64, 'base64');
  return await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'Ed25519',
      namedCurve: 'Ed25519',
    },
    true,
    ['sign']
  );
}

/**
 * Import public key from base64
 */
async function importPublicKey(keyBase64: string): Promise<CryptoKey> {
  const keyBuffer = Buffer.from(keyBase64, 'base64');
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: 'Ed25519',
      namedCurve: 'Ed25519',
    },
    true,
    ['verify']
  );
}

/**
 * Compute key fingerprint (SHA-256 of public key)
 */
async function computeKeyFingerprint(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', publicKey);
  const hash = createHash('sha256').update(Buffer.from(exported)).digest('hex');
  return hash.substring(0, 16); // First 16 chars for readability
}

/**
 * Sign registry JSON
 */
async function signRegistry(
  registryJson: string,
  privateKey: CryptoKey
): Promise<{ signature: string; fingerprint: string }> {
  // Sign the exact bytes of the JSON (UTF-8)
  const data = new TextEncoder().encode(registryJson);
  const signature = await crypto.subtle.sign('Ed25519', privateKey, data);
  const signatureBase64 = Buffer.from(signature).toString('base64');

  // Get public key for fingerprint
  const publicKey = await crypto.subtle.importKey(
    'raw',
    await crypto.subtle.exportKey('raw', privateKey),
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    true,
    ['verify']
  );
  const fingerprint = await computeKeyFingerprint(publicKey);

  return { signature: signatureBase64, fingerprint };
}

async function main() {
  program
    .option('--channel <channel>', 'Registry channel (stable or beta)', 'stable')
    .option('--key <path>', 'Path to private key file (base64)')
    .option('--generate-key', 'Generate a new key pair')
    .option('--private-key-out <path>', 'Where to write the private key. MUST be outside this repository.')
    .option('--output-dir <dir>', 'Output directory', join(ROOT_DIR, 'registry/v1'))
    .parse();

  const options = program.opts();

  if (options.generateKey) {
    // This repository is PUBLIC. A private key written inside the working tree
    // is one `git add -A` away from being published, and a private key that
    // reaches public git history is compromised permanently: rotating is the
    // only remedy, and deleting the file does not undo it. So refuse outright
    // rather than printing a warning and writing it anyway, which is what this
    // script used to do (into registry/keys/, tracked, with no ignore rule).
    if (!options.privateKeyOut) {
      console.error(
        'Error: --private-key-out <path> is required with --generate-key.\n' +
          '\n' +
          'The private key must be written OUTSIDE this repository. Pass an\n' +
          'absolute path somewhere private, for example:\n' +
          '\n' +
          '  pnpm registry:sign --generate-key \\\n' +
          '    --private-key-out ~/.partylayer-keys/registry-prod.key\n' +
          '\n' +
          'The PUBLIC key is written into registry/keys/ and is meant to be\n' +
          'committed. See SIGNING.md for the full key ceremony.',
      );
      process.exit(1);
    }

    const privateOut = resolve(options.privateKeyOut);
    const rel = relative(ROOT_DIR, privateOut);
    const insideRepo = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
    if (insideRepo) {
      console.error(
        `Error: refusing to write a private key inside the repository.\n` +
          `\n` +
          `  requested: ${privateOut}\n` +
          `  repo root: ${ROOT_DIR}\n` +
          `\n` +
          `This repository is public. Choose a path outside it, for example\n` +
          `~/.partylayer-keys/registry-prod.key. See SIGNING.md.`,
      );
      process.exit(1);
    }

    console.log('Generating Ed25519 key pair...');
    const { publicKey, privateKey } = await generateKeyPair();
    const pubKeyBase64 = await exportPublicKey(publicKey);
    const privKeyBase64 = await exportPrivateKey(privateKey);

    const fingerprint = await computeKeyFingerprint(publicKey);
    const keysDir = join(ROOT_DIR, 'registry/keys');
    if (!existsSync(keysDir)) mkdirSync(keysDir, { recursive: true });
    const pubPath = join(keysDir, `${fingerprint}.pub`);

    mkdirSync(dirname(privateOut), { recursive: true });
    // Owner-read-only. The public key keeps default permissions on purpose.
    writeFileSync(privateOut, privKeyBase64, { mode: 0o600 });
    writeFileSync(pubPath, pubKeyBase64);

    console.log(`\n✅ Key pair generated:`);
    console.log(`   Fingerprint: ${fingerprint}`);
    console.log(`   Public key:  registry/keys/${fingerprint}.pub  (commit this)`);
    console.log(`   Private key: ${privateOut}  (mode 0600, never commit, never in CI)`);
    console.log(`\nNext: run \`pnpm gate:no-private-keys\` before committing.`);
    return;
  }

  const channel = options.channel as 'stable' | 'beta';
  if (channel !== 'stable' && channel !== 'beta') {
    console.error('Error: channel must be "stable" or "beta"');
    process.exit(1);
  }

  if (!options.key) {
    console.error('Error: --key is required (or use --generate-key to create one)');
    process.exit(1);
  }

  const registryPath = join(options.outputDir, channel, 'registry.json');
  const sigPath = join(options.outputDir, channel, 'registry.sig');

  // Read registry JSON
  let registryJson: string;
  try {
    registryJson = readFileSync(registryPath, 'utf-8');
  } catch (err) {
    console.error(`Error: Could not read ${registryPath}`);
    process.exit(1);
  }

  // Read private key
  let privateKeyBase64: string;
  try {
    privateKeyBase64 = readFileSync(options.key, 'utf-8').trim();
  } catch (err) {
    console.error(`Error: Could not read private key from ${options.key}`);
    process.exit(1);
  }

  // Import and sign
  const privateKey = await importPrivateKey(privateKeyBase64);
  const { signature, fingerprint } = await signRegistry(registryJson, privateKey);

  // Write signature file
  const sigData = {
    algorithm: 'ed25519',
    signature,
    keyFingerprint: fingerprint,
    signedAt: new Date().toISOString(),
  };

  writeFileSync(sigPath, JSON.stringify(sigData, null, 2) + '\n');

  console.log(`✅ Signed registry:`);
  console.log(`   Channel: ${channel}`);
  console.log(`   Registry: ${registryPath}`);
  console.log(`   Signature: ${sigPath}`);
  console.log(`   Key fingerprint: ${fingerprint}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
