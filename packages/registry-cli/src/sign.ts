/**
 * Signing utilities (reuses scripts/registry/sign.ts logic)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { webcrypto } from 'crypto';
import type { RegistrySignature } from '@cantonconnect/registry-client';
import { getSignaturePath } from './registry';

const crypto = webcrypto as Crypto;

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
 * Compute key fingerprint
 */
async function computeKeyFingerprint(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', publicKey);
  const hash = createHash('sha256').update(Buffer.from(exported)).digest('hex');
  return hash.substring(0, 16);
}


/**
 * Sign registry
 */
export async function signRegistry(
  registryJson: string,
  privateKeyPath: string,
  publicKeyPath?: string
): Promise<{ signature: string; fingerprint: string }> {
  // Read private key
  const privateKeyBase64 = readFileSync(privateKeyPath, 'utf-8').trim();
  const privateKey = await importPrivateKey(privateKeyBase64);

  // Sign
  const data = new TextEncoder().encode(registryJson);
  const signature = await crypto.subtle.sign('Ed25519', privateKey, data);
  const signatureBase64 = Buffer.from(signature).toString('base64');

  // Get fingerprint from public key if provided
  let fingerprint = 'dev-key';
  if (publicKeyPath && existsSync(publicKeyPath)) {
    const pubkeyBase64 = readFileSync(publicKeyPath, 'utf-8').trim();
    const publicKey = await importPublicKey(pubkeyBase64);
    fingerprint = await computeKeyFingerprint(publicKey);
  }

  return { signature: signatureBase64, fingerprint };
}

/**
 * Write signature file
 */
export function writeSignature(
  channel: 'stable' | 'beta',
  signature: string,
  fingerprint: string
): void {
  const sigPath = getSignaturePath(channel);
  const sigData: RegistrySignature = {
    algorithm: 'ed25519',
    signature,
    keyFingerprint: fingerprint,
    signedAt: new Date().toISOString(),
  };

  writeFileSync(sigPath, JSON.stringify(sigData, null, 2) + '\n', 'utf-8');
}
