import type { Request, Response, NextFunction } from 'express';

/**
 * A dependency-free per-client rate limiter, keyed on `req.ip`.
 *
 * Behind a reverse proxy the app MUST set Express `trust proxy` so that `req.ip` is the
 * forwarded client address rather than the proxy's own socket address. Without it every
 * forwarded request shares a single bucket (the proxy's ip), which turns a per-client
 * limit into a global one. See index.ts, where trust proxy is set to a single hop.
 */
export function rateLimiter(windowMs: number, max: number) {
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
