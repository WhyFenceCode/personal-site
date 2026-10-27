/**
 * Project covers and live previews.
 * - Cover: the project's own `cover:`, else a screenshot from `pnpm shots` (src/assets/screenshots/<slug>.jpg),
 *   else generated placeholder art.
 * - Live preview: only offered when the live site allows being shown in a frame on another site. That's checked
 *   once at build time from the site's X-Frame-Options and Content-Security-Policy headers.
 */
import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { slugOf } from './content';

const shots = import.meta.glob<{ default: ImageMetadata }>('../assets/screenshots/*.{jpg,jpeg,png,webp}', { eager: true });
const byslug = new Map(Object.entries(shots).map(([path, mod]) => [path.split('/').pop()!.replace(/\.\w+$/, ''), mod.default]));

export function coverFor(p: CollectionEntry<'projects'>): ImageMetadata | undefined {
  return p.data.cover ?? byslug.get(slugOf(p.id));
}

const frameCache = new Map<string, Promise<boolean>>();
/** True when `url` can be embedded in an <iframe> on another site. */
export function canFrame(url: string, siteUrl: string): Promise<boolean> {
  const key = `${url} ${siteUrl}`;
  if (!frameCache.has(key)) frameCache.set(key, check(url, siteUrl));
  return frameCache.get(key)!;
}

async function check(url: string, siteUrl: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'personal-site-build' } });
    const xfo = (r.headers.get('x-frame-options') ?? '').toLowerCase();
    if (xfo.includes('deny') || xfo.includes('sameorigin')) return false;
    const csp = r.headers.get('content-security-policy') ?? '';
    const fa = csp.split(';').map((d) => d.trim()).find((d) => d.toLowerCase().startsWith('frame-ancestors'));
    if (fa) {
      const sources = fa.split(/\s+/).slice(1);
      const origin = new URL(siteUrl).origin;
      const host = new URL(siteUrl).host;
      return sources.some((s) => s === '*' || s.replace(/\/$/, '') === origin || s === host || (s.startsWith('https://*.') && host.endsWith(s.slice(9))));
    }
    return true;
  } catch (e) {
    console.warn(`[projects] could not check ${url} for framing (${(e as Error).message}); showing the screenshot only`);
    return false;
  }
}
