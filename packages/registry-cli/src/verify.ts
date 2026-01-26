/**
 * Verification utilities (reuses scripts/registry/verify.ts logic)
 */

import { readFileSync, existsSync } from 'fs';
import { webcrypto } from 'crypto';
import type { RegistrySignature } from '@cantonconnect/registry-client';
import { getRegistryPath, getSignaturePath } from './registry';

const crypto = webcrypto as Crypto;

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

/**
 * Verify registry signature
 */
export async function verifyRegistry(
  channel: 'stable' | 'beta',
  pubkeyPath: string
): Promise<boolean> {
  const registryPath = getRegistryPath(channel);
  const sigPath = getSignaturePath(channel);

  if (!existsSync(registryPath)) {
    throw new Error(`Registry file not found: ${registryPath}`);
  }

  if (!existsSync(sigPath)) {
    throw new Error(`Signature file not found: ${sigPath}`);
  }

  const registryJson = readFileSync(registryPath, 'utf-8');
  const sigData = JSON.parse(readFileSync(sigPath, 'utf-8')) as RegistrySignature;

  if (sigData.algorithm !== 'ed25519') {
    throw new Error(`Unsupported algorithm: ${sigData.algorithm}`);
  }

  const pubkeyBase64 = readFileSync(pubkeyPath, 'utf-8').trim();
  const publicKey = await importPublicKey(pubkeyBase64);

  return await verifySignature(registryJson, sigData.signature, publicKey);
}
