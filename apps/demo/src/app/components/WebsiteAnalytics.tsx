'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { websiteAnalyticsEnabled, websiteAnalyticsToken } from '../../lib/site-analytics';

/** Website page measurements only. No SDK event, wallet identity or custom payload. */
export function WebsiteAnalytics() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(websiteAnalyticsEnabled(websiteAnalyticsToken, window.location.hostname, process.env.NODE_ENV));
  }, []);
  return enabled ? <Script id="partylayer-website-analytics" type="module" strategy="afterInteractive"
    crossOrigin="anonymous"
    src="https://static.cloudflareinsights.com/beacon.min.js"
    data-cf-beacon={JSON.stringify({ token: websiteAnalyticsToken, spa: true })} /> : null;
}
