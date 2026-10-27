// Sends one plain-text email every Monday: this week's reminders, plus anything the live site reports as
// stale (from /status.json). Runs only on its cron schedule; it has no public URL.
import { EmailMessage } from 'cloudflare:email';
import { REMINDERS, STALE_AFTER } from './reminders.js';

const DAY = 864e5;
const daysSince = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / DAY) : Infinity);

/** ISO week number, for "every other week". */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
}

function due(now) {
  const firstMonday = now.getUTCDate() <= 7, evenWeek = isoWeek(now) % 2 === 0;
  return REMINDERS.filter((r) => r.every === 'week' || (r.every === '2weeks' && evenWeek) || (r.every === 'month' && firstMonday));
}

async function staleNotes(site) {
  const notes = [];
  try {
    const res = await fetch(`${site}/status.json`, { cf: { cacheTtl: 0 } });
    if (!res.ok) return [`Couldn't read ${site}/status.json (HTTP ${res.status}). Is the site up?`];
    const s = await res.json();
    const built = daysSince(s.built);
    if (built > STALE_AFTER.build) notes.push(`The site hasn't rebuilt in ${built} days. Check the "Daily rebuild" GitHub Action and Cloudflare deploys.`);
    if (s.training?.source === 'import') {
      const age = daysSince(s.training.updated);
      if (age > STALE_AFTER.training) notes.push(Number.isFinite(age) ? `The Strava import is ${age} days old.` : 'No Strava import yet: the site is showing sample numbers.');
    }
    const listened = daysSince(s.listening?.updated && `${s.listening.updated}-01`);
    if (listened > STALE_AFTER.listening) notes.push(`Listening was last updated ${s.listening?.updated ?? 'never'}.`);
  } catch (e) {
    notes.push(`Couldn't reach ${site}/status.json (${e.message}).`);
  }
  return notes;
}

function compose(env, now, items, notes) {
  const week = now.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', timeZone: 'America/Toronto' });
  const lines = [
    `Site check for the week of ${week}.`,
    '',
    ...(notes.length ? ['Needs attention:', ...notes.map((n) => `  ! ${n}`), ''] : []),
    'This week:',
    ...items.map((r) => `  - ${r.text}\n      ${r.where}`),
    '',
    `${env.SITE}`,
    '(Sent by the site-reminders worker. Edit workers/reminders/src/reminders.js to change these.)',
  ];
  const id = `<${now.getTime()}.${Math.random().toString(36).slice(2)}@${env.FROM.split('@')[1]}>`;
  const raw = [
    `From: Site reminders <${env.FROM}>`,
    `To: ${env.REMIND_TO}`,
    `Subject: Site check: week of ${week}${notes.length ? ` (${notes.length} to fix)` : ''}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    lines.join('\r\n'),
  ].join('\r\n');
  return new EmailMessage(env.FROM, env.REMIND_TO, raw);
}

export default {
  async scheduled(event, env, ctx) {
    if (!env.REMIND_TO) throw new Error('REMIND_TO is not set: run `wrangler secret put REMIND_TO`');
    const now = new Date(event.scheduledTime);
    const items = due(now), notes = await staleNotes(env.SITE);
    await env.MAIL.send(compose(env, now, items, notes));
  },
  // No web access: the worker has no public URL, and this answers anything that reaches it anyway.
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
