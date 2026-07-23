#!/usr/bin/env node
/**
 * The DevNet gateway. All ledger and registry access is server side, built on the
 * official Canton wallet sdk (live mode). The browser never receives a ledger JWT.
 *
 * Endpoints mirror the two verticals' backend interfaces one to one, plus GET /health
 * and GET /config. GATEWAY_MODE=mock serves the same endpoints from fixtures so the
 * whole stack is verifiable without DevNet.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { loadConfig, publicConfig, type GatewayConfig } from './config.js';
import { createBackends, type Backends } from './backends.js';

// ---- Per IP rate limiter (no external dependency) ----
function rateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || 'unknown';
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    next();
  };
}

// ---- Mutation serialization: concurrency one, to protect validator traffic ----
function makeSerializer() {
  let chain: Promise<unknown> = Promise.resolve();
  return function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

async function main(): Promise<void> {
  const cfg: GatewayConfig = loadConfig();
  const backends: Backends = await createBackends(cfg);
  const serialize = makeSerializer();
  const app = express();

  app.use(express.json({ limit: '256kb' }));
  app.use(
    cors({
      origin: cfg.allowedOrigins.length > 0 ? cfg.allowedOrigins : false,
      methods: ['GET', 'POST'],
    }),
  );
  app.use(rateLimiter(60_000, 240));

  // Read handler: run and JSON respond, 500 on error (never leak internals verbatim).
  const read =
    (fn: (body: Record<string, unknown>) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        res.json(await fn((req.body ?? {}) as Record<string, unknown>));
      } catch (err) {
        res.status(500).json({ error: message(err) });
      }
    };
  // Mutation handler: serialized (concurrency one), returns { ok: true } or a 400 error.
  const write =
    (fn: (body: Record<string, unknown>) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        res.json(await serialize(() => fn((req.body ?? {}) as Record<string, unknown>)));
      } catch (err) {
        res.status(400).json({ error: message(err) });
      }
    };

  app.get('/health', (_req, res) => res.json({ ok: true, mode: cfg.mode }));
  app.get('/config', (_req, res) => res.json(publicConfig(cfg)));

  // ---- Tokenization ----
  const t = backends.tokenization;
  app.post('/tokenization/holdings', read((b) => t.readHoldings(String(b.party))));
  app.post('/tokenization/incoming', read((b) => t.readIncoming(String(b.party))));
  app.post('/tokenization/holdingRefs', read((b) => t.readHoldingRefs(String(b.party))));
  app.post('/tokenization/instrument', read(() => t.readInstrument()));
  app.post('/tokenization/supply', read(() => t.readSupply()));
  app.post('/tokenization/allocations', read(() => t.readAllocations()));
  app.post('/tokenization/transfer', write((b) => t.submitTransfer(b.transfer as never)));
  app.post('/tokenization/transferAction', write((b) => t.submitTransferAction(b.request as never)));
  app.post('/tokenization/issuerChoice', write((b) => t.submitIssuerChoice(b.choice as never)));
  app.post('/tokenization/allocation', write((b) => t.submitAllocation(b.request as never)));
  app.post('/tokenization/allocationAction', write((b) => t.submitAllocationAction(b.request as never)));

  // ---- DvP ----
  const d = backends.dvp;
  app.post('/dvp/holdings', read((b) => d.readHoldings(String(b.party))));
  app.post('/dvp/trades', read(() => d.readTrades()));
  app.post('/dvp/allocations', read((b) => d.readAllocations(String(b.party))));
  app.post('/dvp/matchedLegs', read((b) => d.readMatchedLegs(String(b.requestCid))));
  app.post('/dvp/allocation', write((b) => d.submitAllocation(b.request as never)));
  app.post('/dvp/allocationAction', write((b) => d.submitAllocationAction(b.request as never)));
  app.post('/dvp/requestAction', write((b) => d.submitRequestAction(b.request as never)));
  app.post('/dvp/settle', write((b) => d.submitSettle(b.vars as never)));
  app.post('/dvp/createTrade', write((b) => d.submitCreateTrade(b.vars as never)));

  const server = app.listen(cfg.port, () => {
    // Startup line carries no secrets.
    console.log('[devnet-proxy] mode=' + cfg.mode + ' port=' + cfg.port + ' origins=' + (cfg.allowedOrigins.join(',') || '(none)'));
  });

  const shutdown = () => {
    server.close(() => {
      backends.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main().catch((err) => {
  console.error('[devnet-proxy] fatal:', message(err));
  process.exit(1);
});
