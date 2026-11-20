/**
 * Markdown tweaks for blog posts (files under src/content/blog/ only; other Markdown is left alone).
 *
 * remarkBlogLinks   A link to another post's Markdown file works like it does on GitHub:
 *                   [text](./other-post.md), [text](../other-post/index.md#a-heading) → /<lang>/blog/other-post/#a-heading
 * rehypeBlogHeadings
 *   - The page already has the title as its <h1>, so if a post uses `#` headings, every heading moves down
 *     one level (# → h2, ## → h3 …). Posts written with `##` sections stay as they are.
 *   - Every h2–h4 gets a small "#" link to itself, so any section can be linked to.
 *   Ids come from Astro's rehypeHeadingIds, which runs between the two steps (see astro.config.mjs).
 *
 * Images need nothing special: ![alt](./photo.jpg) next to the post is optimised by Astro, /photo.jpg comes from
 * public/, and full https:// addresses are used as they are.
 */
import { posix } from 'node:path';

const BLOG = '/src/content/blog/';
const blogFile = (file) => {
  const p = String(file?.path ?? file?.history?.[0] ?? '').replace(/\\/g, '/');
  const i = p.indexOf(BLOG);
  return i < 0 ? null : p.slice(i + BLOG.length); // "en/my-post.md" or "en/my-post/index.md"
};

const visit = (node, fn, parent = null) => {
  fn(node, parent);
  if (node.children) for (const c of node.children) visit(c, fn, node);
};

export function remarkBlogLinks() {
  return (tree, file) => {
    const rel = blogFile(file); if (!rel) return;
    const lang = rel.split('/')[0];
    visit(tree, (node) => {
      if (node.type !== 'link' || typeof node.url !== 'string') return;
      const m = node.url.match(/^([^:#?]+\.md)(#.*)?$/i); // relative path to a .md file, optional #hash
      if (!m || m[1].startsWith('/')) return;
      const target = posix.normalize(posix.join(posix.dirname(rel), m[1])); // "en/other.md"
      if (target.startsWith('..')) return;
      const parts = target.replace(/\.md$/i, '').replace(/\/index$/i, '').split('/');
      const slug = parts.slice(1).join('/').toLowerCase();
      node.url = `/${parts[0] || lang}/blog/${slug}/${m[2] ?? ''}`;
    });
  };
}

/** Step 1, before ids are assigned: shift headings down a level when the post uses `#`. */
export function rehypeBlogDemote() {
  return (tree, file) => {
    if (!blogFile(file)) return;
    let hasH1 = false;
    visit(tree, (n) => { if (n.type === 'element' && n.tagName === 'h1') hasH1 = true; });
    if (!hasH1) return;
    visit(tree, (n) => {
      const m = n.type === 'element' && n.tagName.match(/^h([1-6])$/);
      if (m) n.tagName = `h${Math.min(6, +m[1] + 1)}`;
    });
  };
}

/** Step 2, after ids are assigned: a self-link on every h2–h4. */
export function rehypeBlogAnchors() {
  return (tree, file) => {
    if (!blogFile(file)) return;
    visit(tree, (n) => {
      if (n.type !== 'element' || !/^h[2-4]$/.test(n.tagName) || !n.properties?.id) return;
      n.properties.className = [...(n.properties.className ?? []), 'has-anchor'];
      n.children.push({
        type: 'element', tagName: 'a',
        properties: { href: `#${n.properties.id}`, className: ['h-anchor'], ariaHidden: 'true', tabIndex: -1 },
        children: [{ type: 'text', value: '#' }],
      });
    });
  };
}
