const ORIGIN = 'https://partylayer.xyz';
const LIMIT = 100;
export const REQUIRED_PATHS = ['', '/docs', '/docs/installation', '/docs/quick-start', '/docs/rainbowkit-for-canton', '/docs/integration-support', '/wallets', '/kit-demo'];

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return result;
}

function decode(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt);/g, entity => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[entity]));
}

export function inspectPage(html, url, headers = new Headers()) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0]));
  const meta = [...head.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  const canonicals = links.filter(link => link.rel?.toLowerCase() === 'canonical').map(link => decode(link.href ?? ''));
  const noindex = meta.some(tag => ['robots','googlebot'].includes(tag.name?.toLowerCase()) && /\b(?:noindex|none)\b/i.test(tag.content ?? '')) || /\b(?:noindex|none)\b/i.test(headers.get('x-robots-tag') ?? '');
  const title = decode(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '');
  const body = html.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,'');
  const h1Count = [...body.matchAll(/<h1\b/gi)].length;
  const failures = [];
  if (!title) failures.push('Missing server-rendered title');
  if (canonicals.length !== 1 || canonicals[0].replace(/\/$/,'') !== url.replace(/\/$/,'')) failures.push('Canonical does not identify this URL');
  if (noindex) failures.push('Indexing excluded by robots metadata/header');
  return { url, title, canonicals, noindex, h1Count, failures, warnings: h1Count === 1 ? [] : ['Review server-rendered heading structure'] };
}

export async function siteHealth({fetcher = fetch, now = new Date()} = {}) {
  const failures = [];
  const request = async url => {
    const response = await fetcher(url, {redirect:'manual',signal:AbortSignal.timeout(6000),headers:{'user-agent':'PartyLayer-SiteHealth/1.0'}});
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    return response;
  };
  const read = async (url, type) => {
    try {
      const response = await request(url);
      if (!response.headers.get('content-type')?.includes(type)) throw new Error(`Unexpected content type for ${type}`);
      return await response.text();
    } catch (error) { failures.push({url,error:error.message}); return null; }
  };
  const [robots, sitemap] = await Promise.all([read(`${ORIGIN}/robots.txt`,'text/plain'),read(`${ORIGIN}/sitemap.xml`,'xml')]);
  // This monitors our deliberate public allow-all policy, not Google's full robots parser.
  if (robots !== null && (!/^User-agent:\s*\*\s*$/im.test(robots) || /^Disallow:[ \t]*[^\s#]/im.test(robots) || !robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`))) {
    failures.push({url:`${ORIGIN}/robots.txt`,error:'Public crawl policy changed; review robots rules and sitemap declaration'});
  }
  let urls = [];
  if (sitemap !== null) {
    if (!/<urlset\b[^>]*xmlns=["']http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9["']/i.test(sitemap) || /<!DOCTYPE|<!ENTITY/i.test(sitemap)) {
      failures.push({url:`${ORIGIN}/sitemap.xml`,error:'Unexpected sitemap format'});
    } else {
      const entries = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match => decode(match[1]));
      if (!entries.length || entries.length > LIMIT || new Set(entries).size !== entries.length) {
        failures.push({url:`${ORIGIN}/sitemap.xml`,error:'Sitemap is empty, duplicated or exceeds the bounded 100-URL audit; review before increasing limits'});
      } else {
        for (const value of entries) {
          try {
            const url = new URL(value);
            if (url.origin !== ORIGIN || url.username || url.password || url.hash || url.search) throw new Error('Unexpected origin or URL components');
            urls.push(value);
          } catch { failures.push({url:`${ORIGIN}/sitemap.xml`,error:'Rejected a noncanonical or external sitemap URL'}); }
        }
      }
    }
  }
  const normalized = new Set(urls.map(url => url.replace(/\/$/,'')));
  for (const path of REQUIRED_PATHS) if (!normalized.has(ORIGIN + path)) {
    failures.push({url:`${ORIGIN}/sitemap.xml`,error:`Critical entry point missing: ${path || '/'}`});
  }
  const pages = [];
  for (let start = 0; start < urls.length; start += 4) {
    const batch = await Promise.all(urls.slice(start,start+4).map(async url => {
      try {
        const response = await request(url);
        if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Expected HTML');
        return {...inspectPage(await response.text(),url,response.headers),status:200};
      } catch(error) { return {url,status:null,failures:[error.message],warnings:[]}; }
    }));
    pages.push(...batch);
  }
  for (const page of pages) for (const error of page.failures) failures.push({url:page.url,error});
  return {schemaVersion:1,collectedAt:now.toISOString(),passed:failures.length===0 && pages.length>0,pageCount:pages.length,pages,failures,
    interpretation:'HTTP, title, canonical and public crawl-policy checks only. This is not Googlebot verification, Search Console data, indexing confirmation or a search-ranking measurement. H1 observations are separate content warnings.'};
}

export function healthMarkdown(report) {
  const failures = report.failures.map(item => `- ${item.url}: ${item.error.replace(/[\r\n|]/g,' ')}`).join('\n');
  const warnings = report.pages.filter(page => page.warnings?.length).map(page => `- ${page.url}: ${page.warnings.join('; ')}`).join('\n');
  return `# Website technical health\n\nCollected: ${report.collectedAt}. Status: ${report.passed ? 'passed' : 'needs review'}. Audited ${report.pageCount} sitemap URLs.\n\n${report.interpretation}\n\n${failures || 'No technical availability/indexability failures observed.'}\n${warnings ? `\nContent observations:\n${warnings}\n` : ''}`;
}
