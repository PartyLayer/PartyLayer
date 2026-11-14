/** Public Cloudflare Web Analytics site identifier, never an API credential. */
export const websiteAnalyticsToken = '95c384a210c948ea846e65c466fe539f';

/** Keep development, preview deployments and lookalike hostnames out of site metrics. */
export function websiteAnalyticsEnabled(token: string | undefined, hostname: string, environment: string | undefined): boolean {
  return environment === 'production' && typeof token === 'string' && /^[a-f0-9]{32}$/i.test(token) &&
    (hostname === 'partylayer.xyz' || hostname === 'www.partylayer.xyz');
}
