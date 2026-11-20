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
/** The 4:3 card screenshot (<slug>-card.jpg), rendered at the cards' shape; falls back to the desktop cover. */
export function cardCoverFor(p: CollectionEntry<'projects'>): ImageMetadata | undefined {
  return p.data.cover ?? byslug.get(`${slugOf(p.id)}-card`) ?? byslug.get(slugOf(p.id));
}
/** The portrait tablet screenshot (<slug>-tablet.jpg), used in the project window on phones. */
export function tabletFor(p: CollectionEntry<'projects'>): ImageMetadata | undefined {
  return p.data.cover ? undefined : byslug.get(`${slugOf(p.id)}-tablet`);
}

// Whether a live site can be shown in a frame: shared with ::site{…} embeds in Markdown (src/lib/frame.mjs).
export { canFrame } from './frame.mjs';
