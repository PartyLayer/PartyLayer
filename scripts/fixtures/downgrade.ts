#!/usr/bin/env tsx
/**
 * Create downgrade registry fixture
 * 
 * Creates a registry with lower sequence number to test downgrade protection.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const inputFile = process.argv[2];
const outputFile = process.argv[3];
const targetSequence = parseInt(process.argv[4] || '1', 10);

if (!inputFile || !outputFile) {
  console.error('Usage: tsx scripts/fixtures/downgrade.ts <input.json> <output.json> [sequence]');
  process.exit(1);
}

const content = readFileSync(inputFile, 'utf-8');
const json = JSON.parse(content);

// Set lower sequence
if (json.metadata) {
  json.metadata.sequence = targetSequence;
} else {
  json.metadata = { sequence: targetSequence };
}

// Ensure output directory exists
mkdirSync(dirname(outputFile), { recursive: true });

writeFileSync(outputFile, JSON.stringify(json, null, 2));
console.log(`Created downgrade registry (sequence=${targetSequence}): ${outputFile}`);
