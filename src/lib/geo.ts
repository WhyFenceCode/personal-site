/**
 * Build-time place lookup (OpenStreetMap Nominatim) with an on-disk cache, so each place is
 * looked up once, ever. Commit src/data/places.cache.json. Nothing here runs in the browser.
 * Nominatim's usage policy: at most one request per second and an identifying User-Agent.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import tzlookup from 'tz-lookup';
import { site } from './config';

export type Point = { lat: number; lng: number; country?: string };
const CACHE = 'src/data/places.cache.json';
let cache: Record<string, Point | null> | null = null;
let last = 0;

function load() {
  if (cache) return cache;
  try { cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}; } catch { cache = {}; }
  return cache!;
}
function save() { try { writeFileSync(CACHE, JSON.stringify(cache, null, 2) + '\n'); } catch {} }

export async function geocode(query: string): Promise<Point | null> {
  const c = load(), key = query.trim().toLowerCase();
  if (key in c) return c[key];
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(query)}`;
    const r = await fetch(url, { headers: { 'User-Agent': `personal-site-build (${site.url})` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const [hit] = await r.json();
    c[key] = hit ? { lat: +hit.lat, lng: +hit.lon, country: hit.address?.country } : null;
    save();
    return c[key];
  } catch (e) {
    console.warn(`[geo] lookup failed for "${query}" (${(e as Error).message}); it will be retried next build`);
    return null;
  }
}

/** Time zone for the hero clock: the configured one, or looked up from the city. */
export async function siteTimezone(): Promise<string> {
  const { timezone, city, region, country } = site.location;
  if (timezone && timezone !== 'auto') return timezone;
  const p = await geocode([city, region, country].filter(Boolean).join(', '));
  if (p) { try { return tzlookup(p.lat, p.lng); } catch {} }
  console.warn('[geo] could not work out a time zone from location.city; using UTC. Set location.timezone to override.');
  return 'UTC';
}
