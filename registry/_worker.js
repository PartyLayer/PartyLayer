/**
 * Cloudflare Pages Worker for CORS handling
 * 
 * This worker handles OPTIONS preflight requests and adds CORS headers
 * to all responses from the registry.
 */

/**
 * Whether a response body begins with the HTML document that Pages serves as its
 * SPA fallback. Reads only the FIRST chunk from a clone, then cancels, so a real
 * asset (an icon, a manifest) is never buffered in full and its body stream reaches
 * the client untouched.
 */
async function startsWithHtml(response) {
  try {
    const body = response.clone().body;
    if (!body) return false;
    const reader = body.getReader();
    const { value } = await reader.read();
    reader.cancel();
    const head = new TextDecoder()
      .decode(value ?? new Uint8Array())
      .slice(0, 64)
      .trimStart()
      .toLowerCase();
    return head.startsWith('<!doctype html') || head.startsWith('<html');
  } catch {
    // Unreadable body: fall back to treating it as a real asset rather than
    // turning a served file into a 404.
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, If-None-Match, Content-Type, Cache-Control',
      'Access-Control-Expose-Headers': 'ETag, Last-Modified, Cache-Control',
      'Access-Control-Max-Age': '86400',
    };
    
    // Handle CORS preflight (OPTIONS) requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }
    
    // Serve static files from Pages assets.
    //
    // A HEAD request is fetched as GET so the not-found guard below has a body to
    // inspect; a HEAD response carries no body, which would let a missing file pass
    // the guard and answer 200 to exactly the probe a cache or a health check uses.
    // The body is dropped again before returning, so HEAD stays bodyless.
    const isHead = request.method === 'HEAD';
    try {
      const response = await env.ASSETS.fetch(
        isHead ? new Request(url.toString(), { method: 'GET', headers: request.headers }) : request,
      );

      // Not-found guard. Pages serves the SPA index fallback as a 200 for any
      // unmatched path. Without this, a request for a concrete file that does not
      // exist (a path with a non-HTML extension) returns that HTML as a success AND
      // inherits the /wallets/* long cache, so a not-found gets cached as a 200 for
      // a day. That once made a present, valid mark look missing on production, with
      // no way to tell a stale cache from a real 404.
      //
      // Identify the fallback by its BODY, not its Content-Type. _headers forces
      // `Content-Type: application/json` onto /*.json and /*.sig, so for exactly the
      // paths this guard protects the header says json while the body is the HTML
      // fallback, and a content-type test never fires. Sniffing the first chunk is
      // authoritative regardless of what _headers rewrote. The header test is kept
      // as well, so an unmatched path that _headers does not touch is caught without
      // reading its body at all.
      const isFileRequest =
        /\.[a-z0-9]+$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname);
      const servedHtml =
        (response.headers.get('content-type') || '').includes('text/html') ||
        (isFileRequest && response.status === 200 && (await startsWithHtml(response)));
      if (isFileRequest && response.status === 200 && servedHtml) {
        return new Response(
          isHead ? null : JSON.stringify({ error: 'Not Found', path: url.pathname }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              ...corsHeaders,
            },
          },
        );
      }

      // Clone response and add CORS headers
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      // Cache policy for .json and .sig is set HERE rather than in _headers, for two
      // reasons. First, Pages combines Cache-Control across every matching _headers
      // rule, so a manifest rule there would concatenate with /*.json into an
      // ambiguous "max-age=300, max-age=60". Second, a _headers rule also stamps the
      // not-found response above, which would make a 404 cacheable for five minutes;
      // keeping the policy on the pass-through path leaves that 404 uncacheable.
      // The values below reproduce exactly what _headers used to serve.
      if (/^\/v1\/[^/]+\/registry\.json$/.test(url.pathname)) {
        // A new entry or an icon correction propagates in about a minute.
        newHeaders.set('Cache-Control', 'public, max-age=60');
      } else if (url.pathname === '/health.json') {
        newHeaders.set('Cache-Control', 'no-cache');
      } else if (/\.(json|sig)$/i.test(url.pathname)) {
        newHeaders.set('Cache-Control', 'public, max-age=300');
      }

      return new Response(isHead ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      // Asset lookup threw: return an uncacheable 404 with CORS headers.
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...corsHeaders,
        },
      });
    }
  },
};
