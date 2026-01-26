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

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
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
    .option('--generate-key', 'Generate a new key pair (dev only)')
    .option('--output-dir <dir>', 'Output directory', join(ROOT_DIR, 'registry/v1'))
    .parse();

  const options = program.opts();

  if (options.generateKey) {
    console.log('Generating Ed25519 key pair...');
    const { publicKey, privateKey } = await generateKeyPair();
    const pubKeyBase64 = await exportPublicKey(publicKey);
    const privKeyBase64 = await exportPrivateKey(privateKey);

    const keysDir = join(ROOT_DIR, 'registry/keys');
    const keyName = `dev-${Date.now()}`;

    writeFileSync(join(keysDir, `${keyName}.pub`), pubKeyBase64);
    writeFileSync(join(keysDir, `${keyName}.key`), privKeyBase64);

    const fingerprint = await computeKeyFingerprint(publicKey);
    console.log(`\n✅ Key pair generated:`);
    console.log(`   Public key: registry/keys/${keyName}.pub`);
    console.log(`   Private key: registry/keys/${keyName}.key`);
    console.log(`   Fingerprint: ${fingerprint}`);
    console.log(`\n⚠️  Keep private key secure! Do NOT commit to git.`);
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
