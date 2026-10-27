/**
 * Running and cycling totals, fetched at BUILD time only.
 *
 * Security model:
 * - Credentials live only in the build environment (STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
 *   STRAVA_REFRESH_TOKEN). They are never imported into client code or written to the output.
 * - Authorise the app with the `activity:read` scope only (not `activity:read_all`), so private
 *   activities and hidden ones are never returned.
 * - Only distance and the date (no time) are used. Routes, maps, start/end points, names,
 *   heart rate and device data are never read or published.
 * Without credentials, or if Strava fails, the static numbers in activities.yaml are used.
 */
import { activities } from './config';

export type Sport = 'running' | 'cycling';
export type Stats = { weeks: number[]; total: number; longest?: { km: number; date?: string; name?: string }; lastActivity?: string; goal?: number; unit: string; source: 'strava' | 'static' };

const SPORT_TYPES: Record<Sport, string[]> = {
  running: ['Run', 'TrailRun', 'VirtualRun'],
  cycling: ['Ride', 'GravelRide', 'MountainBikeRide', 'VirtualRide', 'EBikeRide', 'EMountainBikeRide'],
};
const WEEKS = 26;

let cache: Promise<Record<Sport, Stats> | null> | null = null;

async function fromStrava(): Promise<Record<Sport, Stats> | null> {
  // Read each variable by name (never spread the env object, which could copy every variable into a bundle).
  // These are server-only: no PUBLIC_ prefix, and this module is only imported by build-time .astro code.
  const id = process.env.STRAVA_CLIENT_ID ?? import.meta.env.STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET ?? import.meta.env.STRAVA_CLIENT_SECRET;
  const refresh = process.env.STRAVA_REFRESH_TOKEN ?? import.meta.env.STRAVA_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return null;
  try {
    const tok = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ client_id: id, client_secret: secret, grant_type: 'refresh_token', refresh_token: refresh }),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`token ${r.status}`))));
    const after = Math.floor(Date.now() / 1000) - WEEKS * 7 * 86400;
    const list: any[] = [];
    for (let page = 1; page <= 5; page++) {
      const batch = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`, {
        headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(8000),
      }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`activities ${r.status}`))));
      list.push(...batch.filter((a: any) => !a.private && a.visibility !== 'only_me').map((a: any) => ({ type: a.sport_type ?? a.type, km: a.distance / 1000, date: String(a.start_date_local).slice(0, 10) })));
      if (batch.length < 200) break;
    }
    const now = Date.now(), out = {} as Record<Sport, Stats>;
    for (const sport of Object.keys(SPORT_TYPES) as Sport[]) {
      const acts = list.filter((a) => SPORT_TYPES[sport].includes(a.type));
      const weeks = Array(WEEKS).fill(0);
      for (const a of acts) { const w = Math.floor((now - +new Date(a.date)) / (7 * 864e5)); if (w >= 0 && w < WEEKS) weeks[WEEKS - 1 - w] += a.km; }
      const longest = acts.reduce<any>((m, a) => (!m || a.km > m.km ? a : m), null);
      const cfg = activities.training?.[sport] ?? {};
      out[sport] = {
        weeks: weeks.map((k) => Math.round(k)), total: Math.round(acts.reduce((s, a) => s + a.km, 0)),
        longest: longest ? { km: Math.round(longest.km * 10) / 10, date: longest.date } : undefined,
        lastActivity: acts.map((a) => a.date).sort().at(-1), goal: cfg.goal, unit: 'km', source: 'strava',
      };
    }
    return out;
  } catch (e) {
    console.warn('[strava] falling back to activities.yaml:', (e as Error).message);
    return null;
  }
}

function fromYaml(): Record<Sport, Stats> {
  const tr = activities.training ?? {}, out = {} as Record<Sport, Stats>;
  for (const sport of ['running', 'cycling'] as Sport[]) {
    const c = tr[sport] ?? {};
    const weeks: number[] = c.weeks ?? [];
    out[sport] = { weeks, total: weeks.reduce((s, v) => s + v, 0), longest: c.longest, lastActivity: c.lastActivity ? String(c.lastActivity) : undefined, goal: c.goal, unit: tr.unit ?? 'km', source: 'static' };
  }
  return out;
}

export async function training(): Promise<Record<Sport, Stats>> {
  if ((activities.training?.source ?? 'static') === 'strava') cache ??= fromStrava();
  return (cache && (await cache)) || fromYaml();
}

/** Blocks only show when something was logged within `activeWithinDays`. */
export function isRecent(s: Stats): boolean {
  const days = activities.training?.activeWithinDays ?? 30;
  if (!s.lastActivity || !s.weeks.some((w) => w > 0)) return false;
  return (Date.now() - +new Date(s.lastActivity)) / 864e5 <= days;
}
