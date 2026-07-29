/**
 * Cloudflare Pages Worker for CORS handling
 * 
 * This worker handles OPTIONS preflight requests and adds CORS headers
 * to all responses from the registry.
 */

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
    
    // Serve static files from Pages assets
    try {
      const response = await env.ASSETS.fetch(request);

      // Not-found guard. Pages serves the SPA index fallback as a 200 text/html
      // for any unmatched path. Without this, a request for a concrete file that
      // does not exist (a path with a non-HTML extension) returns that HTML as a
      // success AND inherits the /wallets/* long cache, so a not-found gets cached
      // as a 200 for a day. That once made a present, valid mark look missing on
      // production, with no way to tell a stale cache from a real 404. When a file
      // request comes back as the HTML fallback, return an uncacheable 404.
      const isFileRequest =
        /\.[a-z0-9]+$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname);
      const servedHtml = (response.headers.get('content-type') || '').includes('text/html');
      if (isFileRequest && response.status === 200 && servedHtml) {
        return new Response(JSON.stringify({ error: 'Not Found', path: url.pathname }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            ...corsHeaders,
          },
        });
      }

      // Clone response and add CORS headers
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      // Manifest freshness. Set here rather than in _headers because Pages
      // combines Cache-Control across every matching rule, so a _headers manifest
      // rule would concatenate with /*.json into an ambiguous "max-age=300,
      // max-age=60". Setting it on the worker response replaces that with one
      // value, so a new entry or an icon correction propagates in about a minute.
      if (/^\/v1\/[^/]+\/registry\.json$/.test(url.pathname)) {
        newHeaders.set('Cache-Control', 'public, max-age=60');
      }

      return new Response(response.body, {
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
