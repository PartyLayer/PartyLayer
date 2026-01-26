#!/usr/bin/env tsx
/**
 * Create tampered registry fixture
 * 
 * Modifies 1 byte in registry.json to test tamper detection.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: tsx scripts/fixtures/tamper.ts <input.json> <output.json>');
  process.exit(1);
}

const content = readFileSync(inputFile, 'utf-8');
const json = JSON.parse(content);

// Tamper: modify sequence number
if (json.metadata?.sequence) {
  json.metadata.sequence = json.metadata.sequence - 1;
} else {
  // If no sequence, modify a wallet entry
  if (json.wallets && json.wallets.length > 0) {
    json.wallets[0].id = json.wallets[0].id + 'X'; // Add character
  }
}

// Ensure output directory exists
mkdirSync(dirname(outputFile), { recursive: true });

writeFileSync(outputFile, JSON.stringify(json, null, 2));
console.log(`Created tampered registry: ${outputFile}`);
