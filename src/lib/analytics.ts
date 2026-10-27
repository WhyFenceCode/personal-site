/** Script tag for the analytics provider chosen in site.yaml (or null for none). */
import { site } from './config';

export type AnalyticsScript = { src: string; attrs: Record<string, string> };

export function analyticsScript(): AnalyticsScript | null {
  const a = site.analytics;
  switch (a.provider) {
    case 'cloudflare':
      return { src: a.src || 'https://static.cloudflareinsights.com/beacon.min.js', attrs: { 'data-cf-beacon': JSON.stringify({ token: a.token, spa: true }) } };
    case 'plausible':
      return { src: a.src || 'https://plausible.io/js/script.js', attrs: { 'data-domain': a.domain } };
    case 'umami':
      return { src: a.src || 'https://cloud.umami.is/script.js', attrs: { 'data-website-id': a.token } };
    case 'goatcounter':
      return { src: a.src || 'https://gc.zgo.at/count.js', attrs: { 'data-goatcounter': `https://${a.token}.goatcounter.com/count` } };
    default:
      return null;
  }
}
