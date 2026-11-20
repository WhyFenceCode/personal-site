/**
 * Small jumps: moving between pages of the same sidebar section (one docs page to another, the brand kit, the GitHub
 * preview; one legal page to another). Those swap straight away, without the ink flood or the page tilt, so reading
 * through a section stays quick. Anything else (home to a project, projects to the blog…) keeps the transitions.
 *
 * site.ts (ink) and extras.ts (tilt) both ask isSmallJump() as a navigation starts, and wasSmallJump() once the new
 * page is in.
 */
const SECTIONS = new Set(['docs', 'legal']);

/** "/en/docs/writing/blog/" → "docs" (the part after the language). */
const sectionOf = (u: URL) => u.pathname.split('/').filter(Boolean)[1] ?? '';

let last = false;
export function isSmallJump(from?: URL, to?: URL): boolean {
  last = !!from && !!to && from.origin === to.origin && SECTIONS.has(sectionOf(from)) && sectionOf(from) === sectionOf(to);
  return last;
}
/** Whether the navigation that just happened was a small jump (for the after-swap step, which isn't told). */
export const wasSmallJump = () => last;
