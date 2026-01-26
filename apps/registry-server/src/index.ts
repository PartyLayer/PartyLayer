#!/usr/bin/env node
/**
 * CantonConnect Registry Server
 * 
 * Minimal production-ready server for serving wallet registry files.
 * 
 * Environment variables:
 * - PORT: Server port (default: 3001)
 * - REGISTRY_DIR: Path to registry directory (default: ../../registry)
 * - DEPLOY_MODE: If "static", prints file locations and exits
 */

import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect if running from src/ (tsx dev) or dist/ (compiled)
// From src/index.ts: src -> registry-server -> apps -> wallet-sdk (3 levels)
// From dist/index.js: dist -> registry-server -> apps -> wallet-sdk (3 levels, same)
const ROOT_DIR = resolve(__dirname, '../../..');

const PORT = parseInt(process.env.PORT || '3001', 10);
// Use environment variable if set, otherwise calculate from ROOT_DIR
const REGISTRY_DIR = process.env.REGISTRY_DIR 
  ? resolve(process.env.REGISTRY_DIR)
  : resolve(ROOT_DIR, 'registry');

console.log('[registry-server] __dirname:', __dirname);
console.log('[registry-server] ROOT_DIR:', ROOT_DIR);
console.log('[registry-server] REGISTRY_DIR:', REGISTRY_DIR);
const DEPLOY_MODE = process.env.DEPLOY_MODE || 'server';

// Static mode: just print file locations
if (DEPLOY_MODE === 'static') {
  console.log('Static hosting mode - serve these files:');
  console.log(`  ${join(REGISTRY_DIR, 'v1/stable/registry.json')}`);
  console.log(`  ${join(REGISTRY_DIR, 'v1/stable/registry.sig')}`);
  console.log(`  ${join(REGISTRY_DIR, 'v1/beta/registry.json')}`);
  console.log(`  ${join(REGISTRY_DIR, 'v1/beta/registry.sig')}`);
  console.log('\nConfigure your CDN/hosting to serve these with:');
  console.log('  - Content-Type: application/json (for .json)');
  console.log('  - Content-Type: application/json (for .sig)');
  console.log('  - ETag headers enabled');
  console.log('  - Cache-Control: public, max-age=300');
  process.exit(0);
}

const app = express();

// Enable CORS for all origins (development-friendly, restrict in production)
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Accept', 'If-None-Match', 'Content-Type'],
  exposedHeaders: ['ETag', 'Last-Modified', 'Cache-Control'],
  credentials: false,
}));

// Security: disable directory listing, no eval/templating
app.disable('x-powered-by');

/**
 * Compute ETag from file content
 */
function computeETag(content: string): string {
  const hash = createHash('sha256').update(content).digest('hex');
  return `"${hash.substring(0, 16)}"`;
}

/**
 * Serve registry file with proper headers
 */
function serveRegistryFile(
  req: express.Request,
  res: express.Response,
  filePath: string,
  contentType: string
): void {
  if (!existsSync(filePath)) {
    console.error(`Registry file not found: ${filePath}`);
    console.error(`REGISTRY_DIR: ${REGISTRY_DIR}`);
    res.status(404).json({ error: 'Not found', path: filePath });
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const etag = computeETag(content);
    const stats = statSync(filePath);

    // Check If-None-Match
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.setHeader('Last-Modified', stats.mtime.toUTCString());

    res.send(content);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    version: '1.0.0',
    registryDir: REGISTRY_DIR,
  });
});

/**
 * Serve registry.json for channel
 */
app.get('/v1/:channel/registry.json', (req, res) => {
  const channel = req.params.channel;
  if (channel !== 'stable' && channel !== 'beta') {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  const filePath = join(REGISTRY_DIR, 'v1', channel, 'registry.json');
  serveRegistryFile(req, res, filePath, 'application/json');
});

/**
 * Serve registry.sig for channel
 */
app.get('/v1/:channel/registry.sig', (req, res) => {
  const channel = req.params.channel;
  if (channel !== 'stable' && channel !== 'beta') {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  const filePath = join(REGISTRY_DIR, 'v1', channel, 'registry.sig');
  serveRegistryFile(req, res, filePath, 'application/json');
});

// Start server
app.listen(PORT, () => {
  console.log(`CantonConnect Registry Server`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Registry directory: ${REGISTRY_DIR}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Stable: http://localhost:${PORT}/v1/stable/registry.json`);
  console.log(`  Beta: http://localhost:${PORT}/v1/beta/registry.json`);
  // Debug: check if files exist
  const stablePath = join(REGISTRY_DIR, 'v1', 'stable', 'registry.json');
  console.log(`  Stable file exists: ${existsSync(stablePath)}`);
  console.log(`  Stable file path: ${stablePath}`);
});
