/**
 * Helpers that return collection entries for one language, falling back to the default
 * language for any entry that hasn't been translated yet.
 */
import { getCollection, type CollectionEntry, type DataEntryMap } from 'astro:content';
import { defaultLang, type Lang } from './i18n';

type Name = keyof DataEntryMap;
export const slugOf = (id: string) => id.split('/').slice(1).join('/');
export const langOf = (id: string) => id.split('/')[0];

export async function localized<C extends Name>(collection: C, lang: Lang): Promise<CollectionEntry<C>[]> {
  const all = (await getCollection(collection)) as CollectionEntry<C>[];
  const bySlug = new Map<string, CollectionEntry<C>>();
  for (const e of all) if (langOf(e.id) === defaultLang) bySlug.set(slugOf(e.id), e);
  for (const e of all) if (langOf(e.id) === lang) bySlug.set(slugOf(e.id), e);
  return [...bySlug.values()];
}

export async function localizedOne<C extends Name>(collection: C, lang: Lang, slug: string) {
  return (await localized(collection, lang)).find((e) => slugOf(e.id) === slug);
}

/** "2023-04" → 2023.25 for the timeline; missing end = now. */
export function yearValue(v?: string): number {
  if (!v) return new Date().getFullYear() + new Date().getMonth() / 12;
  const [y, m] = v.split('-').map(Number);
  return y + (m ? (m - 1) / 12 : 0);
}
/** The moment an entry ends, exclusive: "2026-06" runs to the end of June, "2026" to the end of the year,
 *  and no end means it's ongoing (now). Pair with yearValue(start) for a [start, end) span in years. */
export function endValue(v?: string): number {
  if (!v) return yearValue();
  const [y, m] = v.split('-').map(Number);
  return m ? y + m / 12 : y + 1;
}
/** "Feb 2024" for "2024-02", "2024" for "2024". */
export function monthYear(v: string, lang: string): string {
  const [y, m] = v.split('-').map(Number);
  return m ? new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1)) : String(y);
}
/** Certificate dates: when it was attained, and when it expires (or expired). */
export function certDates(d: { end: string; expires?: string }, lang: string) {
  return {
    attained: monthYear(d.end, lang),
    expires: d.expires ? monthYear(d.expires, lang) : undefined,
    expired: d.expires ? endValue(d.expires) <= yearValue() : false,
  };
}
/** A credential link only when it's a real web address (not a leftover placeholder like "https://…"). */
export function credentialUrl(u?: string): string | undefined {
  try { const url = new URL(u ?? ''); return /^https?:$/.test(url.protocol) && /\.[a-z]{2,}$/i.test(url.hostname) ? url.href : undefined; } catch { return undefined; }
}
export const yearLabel = (v?: string, now = 'Now') => (v ? v.split('-')[0] : now);

export async function projectsFor(lang: Lang) {
  return (await localized('projects', lang)).sort((a, b) => Number(b.data.featured) - Number(a.data.featured) || a.data.order - b.data.order || b.data.year - a.data.year);
}
export async function experienceFor(lang: Lang) {
  return (await localized('experience', lang)).sort((a, b) => yearValue(b.data.start) - yearValue(a.data.start));
}
/** Degrees and exchanges count as education; certificates and courses are listed as certifications. */
export const isCertification = (kind: string) => kind === 'certificate' || kind === 'course';

export async function educationFor(lang: Lang) {
  return (await localized('education', lang)).sort((a, b) => a.data.order - b.data.order || yearValue(b.data.end) - yearValue(a.data.end));
}
