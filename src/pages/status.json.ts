// /status.json: when the site was built and how fresh the hand-updated data is. Read by the weekly
// reminder worker (workers/reminders) to say what's out of date. Only dates, nothing that isn't already public.
import type { APIRoute } from 'astro';
import { activities } from '../lib/config';
import { training } from '../lib/training';
import { reading } from '../lib/lists';

export const GET: APIRoute = () => {
  const t = training();
  const r = reading();
  return new Response(JSON.stringify({
    built: new Date().toISOString(),
    // The configured source, so a missing import shows up as one (the data itself falls back to activities.yaml).
    training: { source: activities.training?.source ?? 'static', updated: t.updated ?? null, lastActivity: t.lastActivity ?? null },
    listening: { updated: activities.listening?.updated ? String(activities.listening.updated) : null },
    reading: { current: r.current?.title ?? null, lastFinished: r.finished[0]?.finished ?? null },
  }, null, 2), { headers: { 'Content-Type': 'application/json' } });
};
