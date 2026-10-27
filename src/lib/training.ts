/**
 * Distance moved: one weekly total across every activity with a distance (runs, rides, walks, hikes, swims…).
 *
 * Two sources (activities.yaml → training.source):
 * - import: src/data/training.json, written by `pnpm strava:import` from Strava's free "Download your data"
 *   export. That file only holds weekly distance totals, the longest effort and the date of the last
 *   activity. Names, times of day, routes, GPS and heart rate never reach it, and no single activity is
 *   listed: only totals (the export doesn't mark private activities, so they count towards them).
 * - static: the numbers typed into activities.yaml.
 * If the import file is missing, the static numbers are used.
 */
import { existsSync, readFileSync } from 'node:fs';
import { activities } from './config';

export type Stats = { weeks: number[]; total: number; longest?: { km: number; date?: string; type?: string; name?: string }; lastActivity?: string; unit: string; source: 'import' | 'static'; updated?: string };

/** What `pnpm strava:import` writes: weekly km keyed by the Monday that starts the week (UTC), and the single
 *  longest activity within the 26 weeks before the import. */
export type TrainingImport = { importedAt: string; weeks: Record<string, number>; longest?: { km: number; date: string; type: string }; lastActivity?: string };

const WEEKS = 26;
const FILE = 'src/data/training.json';

/** Monday 00:00 UTC of the week containing `d`. */
function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

function fromImport(): Stats | null {
  if (!existsSync(FILE)) { console.warn(`[training] ${FILE} not found; using the numbers in activities.yaml`); return null; }
  try {
    const data: TrainingImport = JSON.parse(readFileSync(FILE, 'utf8'));
    const now = weekStart(new Date());
    // The last 26 weeks, oldest first, ending with the current week.
    const keys = Array.from({ length: WEEKS }, (_, i) => {
      const d = new Date(now); d.setUTCDate(d.getUTCDate() - (WEEKS - 1 - i) * 7);
      return d.toISOString().slice(0, 10);
    });
    const weeks = keys.map((k) => Math.round(data.weeks?.[k] ?? 0));
    // The window moves with each build: once the longest activity is older than the graph, stop showing it.
    const longest = data.longest && data.longest.date >= keys[0] ? data.longest : undefined;
    return { weeks, total: weeks.reduce((a, b) => a + b, 0), longest, lastActivity: data.lastActivity, unit: 'km', source: 'import', updated: data.importedAt };
  } catch (e) {
    console.warn(`[training] couldn't read ${FILE} (${(e as Error).message}); using the numbers in activities.yaml`);
    return null;
  }
}

function fromYaml(): Stats {
  const tr = activities.training ?? {};
  const weeks: number[] = tr.weeks ?? [];
  return { weeks, total: weeks.reduce((s, v) => s + v, 0), longest: tr.longest, lastActivity: tr.lastActivity ? String(tr.lastActivity) : undefined, unit: tr.unit ?? 'km', source: 'static' };
}

// Read once per build; in dev, on every request, so a fresh import shows without restarting the server.
let cache: Stats | null = null;
export function training(): Stats {
  if (!cache || import.meta.env.DEV) cache = ((activities.training?.source ?? 'static') === 'import' && fromImport()) || fromYaml();
  return cache;
}

/** The block only shows when something was logged within `activeWithinDays`. */
export function isRecent(s: Stats): boolean {
  const days = activities.training?.activeWithinDays ?? 30;
  if (!s.lastActivity || !s.weeks.some((w) => w > 0)) return false;
  return (Date.now() - +new Date(s.lastActivity)) / 864e5 <= days;
}
