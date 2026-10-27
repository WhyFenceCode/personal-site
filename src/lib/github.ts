/**
 * GitHub activity, fetched once at build time (no tokens or requests in the visitor's browser).
 * Public data only, no token: the contribution calendar comes from the public
 * github-contributions-api.jogruber.de mirror of your profile graph, repos and pushes from the
 * public REST API. Without a username (or offline), deterministic sample data is shown.
 * Rebuild the site on a schedule (e.g. a daily GitHub Action) to keep it fresh.
 */
export type Day = { date: string; count: number; level: number };
export type Repo = { name: string; url: string; description: string; language: string | null; stars: number; pushedAt: string };
export type Push = { repo: string; message: string; date: string; url: string };
export type GithubData = { weeks: Day[][]; total: number; streak: number; longest: number; repos: Repo[]; pushes: Push[]; sample: boolean; username: string };

const TIMEOUT = 15000;
/** Fetch JSON, trying a second time if the first attempt times out or fails. */
async function getJSON(url: string, init: RequestInit = {}) {
  try { return await getOnce(url, init); } catch { return await getOnce(url, init); }
}
async function getOnce(url: string, init: RequestInit) {
  const ctrl = new AbortController(); const id = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': 'personal-site-build', ...(init.headers || {}) } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return await r.json();
  } finally { clearTimeout(id); }
}

const level = (c: number, max: number) => (c === 0 ? 0 : Math.min(4, 1 + Math.floor((c / Math.max(1, max)) * 3.999)));

function toWeeks(days: { date: string; count: number }[], weeks: number): Day[][] {
  const recent = days.slice(-weeks * 7);
  const max = Math.max(...recent.map((d) => d.count), 1);
  const out: Day[][] = [];
  // Align so the last column ends today and each column starts on Sunday.
  const firstDow = new Date(recent[0].date + 'T00:00:00Z').getUTCDay();
  const padded = [...Array(firstDow).fill(null), ...recent];
  for (let i = 0; i < padded.length; i += 7) out.push(padded.slice(i, i + 7).map((d) => (d ? { ...d, level: level(d.count, max) } : { date: '', count: -1, level: -1 })));
  return out;
}

function streaks(days: { count: number }[]) {
  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (days[i].count > 0) current++; else if (i === days.length - 1) continue; else break; }
  return { current, longest };
}

function sampleDays(): { date: string; count: number }[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const today = new Date(); const out = [];
  for (let i = 370; i >= 0; i--) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() - i);
    const dow = d.getUTCDay(), weekend = dow === 0 || dow === 6;
    const burst = Math.sin(i / 23) > 0.3 ? 2 : 1;
    const c = rand() < (weekend ? 0.35 : 0.78) ? Math.floor(rand() * 7 * burst) : 0;
    out.push({ date: d.toISOString().slice(0, 10), count: c });
  }
  return out;
}
const SAMPLE_REPOS: Repo[] = [
  { name: 'personal-site', url: '#', description: 'This website. Astro, React and Three.js.', language: 'TypeScript', stars: 12, pushedAt: new Date().toISOString() },
  { name: 'orbit', url: '#', description: 'Habit tracker with a 3D core.', language: 'TypeScript', stars: 48, pushedAt: new Date(Date.now() - 3 * 864e5).toISOString() },
  { name: 'ledger', url: '#', description: 'Plain-text bookkeeping in the terminal.', language: 'Rust', stars: 31, pushedAt: new Date(Date.now() - 9 * 864e5).toISOString() },
];
const SAMPLE_PUSHES: Push[] = [
  { repo: 'personal-site', message: 'Add layered hero name', date: new Date().toISOString(), url: '#' },
  { repo: 'orbit', message: 'Smooth ring thickness between days', date: new Date(Date.now() - 864e5).toISOString(), url: '#' },
  { repo: 'ledger', message: 'Monthly report: group by category', date: new Date(Date.now() - 2 * 864e5).toISOString(), url: '#' },
  { repo: 'personal-site', message: 'Activity blocks read from YAML', date: new Date(Date.now() - 3 * 864e5).toISOString(), url: '#' },
];

/** Public contributions only: no token, so private work is never counted or exposed. */
async function calendar(username: string): Promise<{ date: string; count: number }[] | null> {
  try {
    const j = await getJSON(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`);
    return j.contributions.map((d: any) => ({ date: d.date, count: d.count }));
  } catch (e) { console.warn('[github] public calendar failed:', (e as Error).message); }
  return null;
}

// Kept on globalThis so the dev server's reloads reuse one fetch instead of hitting the APIs on every edit.
const g = globalThis as { __github?: Promise<GithubData> };
export function getGithub(username: string, weeks = 53): Promise<GithubData> {
  return (g.__github ??= load(username, weeks));
}

async function load(username: string, weeks: number): Promise<GithubData> {
  let days = username ? await calendar(username) : null;
  const sample = !days;
  if (!days) days = sampleDays();
  // Sample repos and pushes only when no username is set. With a real account, a failed request shows
  // nothing rather than made-up entries.
  let repos = username ? [] : SAMPLE_REPOS, pushes = username ? [] : SAMPLE_PUSHES;
  if (username) {
    try {
      const r = await getJSON(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=6&type=owner`);
      repos = r.filter((x: any) => !x.fork).slice(0, 3).map((x: any) => ({ name: x.name, url: x.html_url, description: x.description ?? '', language: x.language, stars: x.stargazers_count, pushedAt: x.pushed_at }));
    } catch (e) { console.warn('[github] repos failed:', (e as Error).message); }
    try {
      // Push events only carry the commit SHA now (no messages), so look up the newest commit of each push.
      const ev = await getJSON(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=40`);
      const recent = ev.filter((e: any) => e.type === 'PushEvent' && e.payload?.head).slice(0, 4);
      const found = await Promise.all(recent.map(async (e: any): Promise<Push | null> => {
        try {
          const c = await getJSON(`https://api.github.com/repos/${e.repo.name}/commits/${e.payload.head}`);
          return { repo: e.repo.name.split('/')[1], message: String(c.commit?.message ?? '').split('\n')[0], date: e.created_at, url: c.html_url ?? `https://github.com/${e.repo.name}/commit/${e.payload.head}` };
        } catch { return null; }
      }));
      pushes = found.filter((p): p is Push => !!p && !!p.message);
    } catch (e) { console.warn('[github] events failed:', (e as Error).message); }
  }
  const recent = days.slice(-weeks * 7);
  const { current, longest } = streaks(recent);
  return { weeks: toWeeks(days, weeks), total: recent.reduce((s, d) => s + d.count, 0), streak: current, longest, repos, pushes, sample, username };
}
