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
