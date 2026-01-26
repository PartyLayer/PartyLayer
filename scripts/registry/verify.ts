#!/usr/bin/env node
/**
 * Registry verification script
 * 
 * Verifies a registry JSON file against its signature.
 * 
 * Usage:
 *   tsx scripts/registry/verify.ts --channel stable --pubkey registry/keys/dev.pub
 *   tsx scripts/registry/verify.ts --channel beta --pubkey registry/keys/dev.pub
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';

import { webcrypto } from 'crypto';
const crypto = webcrypto as Crypto;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

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
 * Verify signature
 */
async function verifySignature(
  registryJson: string,
  signatureBase64: string,
  publicKey: CryptoKey
): Promise<boolean> {
  const data = new TextEncoder().encode(registryJson);
  const signature = Buffer.from(signatureBase64, 'base64');
  return await crypto.subtle.verify('Ed25519', publicKey, signature, data);
}

async function main() {
  program
    .option('--channel <channel>', 'Registry channel (stable or beta)', 'stable')
    .option('--pubkey <path>', 'Path to public key file (base64)')
    .option('--pubkeys <paths>', 'Comma-separated paths to multiple public keys')
    .option('--registry-dir <dir>', 'Registry directory', join(ROOT_DIR, 'registry/v1'))
    .parse();

  const options = program.opts();

  const channel = options.channel as 'stable' | 'beta';
  if (channel !== 'stable' && channel !== 'beta') {
    console.error('Error: channel must be "stable" or "beta"');
    process.exit(1);
  }

  const registryPath = join(options.registryDir, channel, 'registry.json');
  const sigPath = join(options.registryDir, channel, 'registry.sig');

  // Read registry JSON
  let registryJson: string;
  try {
    registryJson = readFileSync(registryPath, 'utf-8');
  } catch (err) {
    console.error(`Error: Could not read ${registryPath}`);
    process.exit(1);
  }

  // Read signature file
  let sigData: { algorithm: string; signature: string; keyFingerprint: string };
  try {
    sigData = JSON.parse(readFileSync(sigPath, 'utf-8'));
  } catch (err) {
    console.error(`Error: Could not read signature file ${sigPath}`);
    process.exit(1);
  }

  if (sigData.algorithm !== 'ed25519') {
    console.error(`Error: Unsupported algorithm: ${sigData.algorithm}`);
    process.exit(1);
  }

  // Get public keys to try
  const pubkeyPaths: string[] = [];
  if (options.pubkey) {
    pubkeyPaths.push(options.pubkey);
  }
  if (options.pubkeys) {
    pubkeyPaths.push(...options.pubkeys.split(',').map((p: string) => p.trim()));
  }

  if (pubkeyPaths.length === 0) {
    console.error('Error: At least one --pubkey or --pubkeys required');
    process.exit(1);
  }

  // Try each public key
  let verified = false;
  let usedKeyPath = '';

  for (const pubkeyPath of pubkeyPaths) {
    try {
      const pubkeyBase64 = readFileSync(pubkeyPath, 'utf-8').trim();
      const publicKey = await importPublicKey(pubkeyBase64);
      const isValid = await verifySignature(registryJson, sigData.signature, publicKey);

      if (isValid) {
        verified = true;
        usedKeyPath = pubkeyPath;
        break;
      }
    } catch (err) {
      // Try next key
      continue;
    }
  }

  if (verified) {
    console.log(`✅ Registry signature verified:`);
    console.log(`   Channel: ${channel}`);
    console.log(`   Registry: ${registryPath}`);
    console.log(`   Signature: ${sigPath}`);
    console.log(`   Key fingerprint: ${sigData.keyFingerprint}`);
    console.log(`   Verified with: ${usedKeyPath}`);
    process.exit(0);
  } else {
    console.error(`❌ Registry signature verification FAILED`);
    console.error(`   Channel: ${channel}`);
    console.error(`   Tried ${pubkeyPaths.length} public key(s)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
