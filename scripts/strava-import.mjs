// Turns Strava's free data export into the small, sanitised summary the site shows.
//
//   pnpm strava:import <path>
//
// <path> is the export .zip Strava emails you, the unzipped folder, or its activities.csv.
// (Strava → Settings → My Account → Download or Delete Your Account → Request your archive.)
//
// Only this ends up in src/data/training.json, which the site reads at build time:
//   - kilometres per week (weeks start Monday, UTC), all activities with a distance added together
//   - the single longest activity in the last 26 weeks: its distance, date and type such as "Run" (no name, no time)
//   - the date of the most recent activity
// Activity names, descriptions, IDs, times of day, routes and GPS files, heart rate, gear and photos are
// read past and dropped. The export itself is never copied into the project: keep it outside, or delete it.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const OUT = 'src/data/training.json';

const arg = process.argv[2];
if (!arg || !existsSync(arg)) {
  console.error('Usage: pnpm strava:import <export.zip | export folder | activities.csv>');
  process.exit(1);
}

/* ---------- Read activities.csv from wherever it is ---------- */
function readCsv(p) {
  if (statSync(p).isDirectory()) return readFileSync(join(p, 'activities.csv'), 'utf8');
  if (p.toLowerCase().endsWith('.csv')) return readFileSync(p, 'utf8');
  // A zip: pull out just activities.csv, to memory. `tar` reads zips on Windows and macOS; `unzip` on Linux.
  for (const [cmd, args] of [['tar', ['-xOf', p, 'activities.csv']], ['unzip', ['-p', p, 'activities.csv']]]) {
    try { return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}
  }
  console.error('Couldn\'t read activities.csv from that zip. Unzip it and pass the folder instead.');
  process.exit(1);
}

/** RFC 4180 CSV: quoted fields may contain commas, quotes ("") and line breaks (descriptions often do). */
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const rows = parseCsv(readCsv(arg).replace(/^﻿/, ''));
const head = rows.shift() ?? [];
const col = (name) => head.findIndex((h) => h.trim().toLowerCase() === name);
const iDate = col('activity date'), iType = col('activity type');
// Exports have two "Distance" columns: the first in your display units (km or miles), a later one in metres.
const distCols = head.map((h, i) => (h.trim().toLowerCase() === 'distance' ? i : -1)).filter((i) => i >= 0);
if (iDate < 0 || iType < 0 || !distCols.length) { console.error('This doesn\'t look like Strava\'s activities.csv (missing Activity Date, Activity Type or Distance).'); process.exit(1); }
const miles = process.argv.includes('--miles');

const num = (s) => { const n = parseFloat(String(s ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };
function km(r) {
  if (distCols.length > 1) { const m = num(r[distCols.at(-1)]); if (m > 0) return m / 1000; }
  const d = num(r[distCols[0]]);
  return d > 0 ? (miles ? d * 1.609344 : d) : 0;
}
// "Oct 24, 2026, 7:12:33 AM" (UTC) in current exports; "2019-03-01 12:00:00" in older ones.
function date(s) {
  const t = String(s).trim();
  const d = new Date(/^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.replace(' ', 'T')}Z` : `${t.replace(/, (\d{1,2}:\d{2})/, ' $1')} UTC`);
  return Number.isNaN(+d) ? null : d;
}
const weekStart = (d) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };
const day = (d) => d.toISOString().slice(0, 10);
// "Virtual Ride" → "VirtualRide": the type is the only label kept, and only for the longest effort.
const typeName = (t) => String(t).trim().replace(/[\s-]+(.)/g, (_, c) => c.toUpperCase()) || 'Activity';

/* ---------- Sanitise: keep only date, distance and type, then add everything up ---------- */
// The site's graph covers the last 26 weeks, and "Longest" is the single longest activity inside that window.
const since = day(weekStart(new Date(Date.now() - 25 * 7 * 864e5)));
const weeks = {}; let longest, lastActivity, count = 0, skipped = 0;
for (const r of rows) {
  const d = date(r[iDate]), k = km(r);
  if (!d) { skipped++; continue; }
  if (!(k > 0)) continue; // strength sessions, yoga…: no distance, nothing to add
  const w = day(weekStart(d));
  weeks[w] = Math.round(((weeks[w] ?? 0) + k) * 10) / 10;
  if (w >= since && (!longest || k > longest.km)) longest = { km: Math.round(k * 10) / 10, date: day(d), type: typeName(r[iType]) };
  if (!lastActivity || day(d) > lastActivity) lastActivity = day(d);
  count++;
}
// Only the last year of weeks is kept; the site shows 26.
const cutoff = day(new Date(Date.now() - 371 * 864e5));
const recent = Object.fromEntries(Object.entries(weeks).filter(([w]) => w >= cutoff).sort(([a], [b]) => (a < b ? -1 : 1)));

const out = { importedAt: day(new Date()), weeks: recent, longest, lastActivity };
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

console.log(`Wrote ${OUT} (imported ${out.importedAt}):`);
console.log(count ? `  ${count} activities with a distance · last ${lastActivity}${longest ? ` · longest in the last 26 weeks ${longest.km} km ${longest.type} (${longest.date})` : ''}` : '  no activities with a distance found');
if (skipped) console.log(`  ${skipped} rows skipped (no readable date)`);
console.log(`
Only weekly totals, the longest activity of the last 26 weeks and the last date were kept. Check training.source is "import" in
src/config/activities.yaml, then commit ${OUT} and push to publish. You can delete the export now.`);
