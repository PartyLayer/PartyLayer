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
      
      // Clone response and add CORS headers
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      // If asset not found, return 404 with CORS headers
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
};
