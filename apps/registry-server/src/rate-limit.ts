import { rateLimit } from 'express-rate-limit';

/** Bound public file-serving work. Forwarded IPs are trusted only when the operator configures a known proxy. */
export function createRegistryRateLimit(limit = 600) {
  return rateLimit({ windowMs: 60_000, limit, standardHeaders: 'draft-8', legacyHeaders: false });
}
