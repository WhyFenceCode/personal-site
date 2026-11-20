/**
 * Markdown tweaks for blog posts (src/content/blog/) and the documentation pages (README.md and docs/,
 * shown at /<lang>/docs/). Other Markdown (projects, legal…) is left alone.
 *
 * remarkSiteLinks
 *   Blog: a link to another post's Markdown file works like it does on GitHub:
 *     [text](./other-post.md), [text](../other-post/index.md#a-heading) → /<lang>/blog/other-post/#a-heading
 *   Docs: links between guides go to their docs pages; links to other files in the repo go to GitHub.
 * rehypeBlogDemote (blog)
 *   The page already has the title as its <h1>, so if a post uses `#` headings, every heading moves down
 *   one level (# → h2, ## → h3 …). Docs: the file's own `# Title` is dropped, since the page shows it.
 * rehypeBlogAnchors (blog and docs)
 *   Every h2–h4 gets a small "#" link to itself, so any section can be linked to.
 *   Ids come from Astro's rehypeHeadingIds, which runs between the two steps (see astro.config.mjs).
 *
 * Images: ![alt](./photo.jpg) next to the post is optimised by Astro and /photo.jpg comes from public/. Images from other
 * websites stop the build (remarkSiteLinks), so reading a post never contacts another company.
 */
import { posix, relative } from 'node:path';

const BLOG = '/src/content/blog/';
const norm = (file) => String(file?.path ?? file?.history?.[0] ?? '').replace(/\\/g, '/');
const blogFile = (file) => {
  const p = norm(file);
  const i = p.indexOf(BLOG);
  return i < 0 ? null : p.slice(i + BLOG.length); // "en/my-post.md" or "en/my-post/index.md"
};
/** Repo-relative path of a docs file ("README.md", "docs/writing/blog.md"), or null. */
const docsFile = (file) => {
  const p = norm(file); if (!p) return null;
  const rel = relative(process.cwd(), p).replace(/\\/g, '/');
  return rel === 'README.md' || /^docs\/.+\.md$/.test(rel) ? rel : null;
};
/** The docs page path for a repo-relative Markdown path ('' for the docs home), or null when it isn't one of the docs. */
export const docsSlug = (rel) =>
  rel === 'README.md' ? 'overview' : rel === 'docs/README.md' ? '' : (rel.match(/^docs\/(.+)\.md$/)?.[1]?.toLowerCase() ?? null);

const visit = (node, fn, parent = null) => {
  fn(node, parent);
  if (node.children) for (const c of node.children) visit(c, fn, node);
};

export function remarkSiteLinks({ lang = 'en', repo = '' } = {}) {
  return () => (tree, file) => {
    const blog = blogFile(file), doc = blog ? null : docsFile(file);
    if (!blog && !doc) return;
    visit(tree, (node) => {
      // The privacy policy promises that reading a page contacts no other company, so posts can't load images from
      // other sites. Save the image next to the post instead.
      if (blog && (node.type === 'image' || node.type === 'html') && /(^|src=["'])(https?:)?\/\//i.test(node.url ?? node.value ?? '')) {
        throw new Error(`[blog] ${blog}: images from other websites aren't allowed (${(node.url ?? '').slice(0, 80) || 'an <img> tag'}). Download the image, put it next to the post and use ./name.jpg. See docs/writing/blog.md.`);
      }
      if (node.type !== 'link' || typeof node.url !== 'string') return;
      if (/^([a-z]+:|#|\/)/i.test(node.url)) return; // absolute, mailto, in-page or site-root links stay
      const [path, hash = ''] = node.url.split(/(?=#)/);
      if (blog) {
        if (!/\.md$/i.test(path)) return;
        const target = posix.normalize(posix.join(posix.dirname(blog), path)); // "en/other.md"
        if (target.startsWith('..')) return;
        const parts = target.replace(/\.md$/i, '').replace(/\/index$/i, '').split('/');
        node.url = `/${parts[0] || lang}/blog/${parts.slice(1).join('/').toLowerCase()}/${hash}`;
        return;
      }
      const target = posix.normalize(posix.join(posix.dirname(doc), path)).replace(/\/$/, '');
      if (target.startsWith('..')) return;
      const slug = docsSlug(target);
      if (slug !== null) node.url = `/${lang}/docs/${slug ? `${slug}/` : ''}${hash}`;
      else if (repo) node.url = `${repo}/blob/main/${target}${hash}`;
    });
  };
}

/** Step 1, before ids are assigned. Blog: shift headings down a level when the post uses `#`. Docs: drop the title. */
export function rehypeBlogDemote() {
  return (tree, file) => {
    if (docsFile(file) && !blogFile(file)) {
      const i = tree.children.findIndex((n) => n.type === 'element' && n.tagName === 'h1');
      if (i > -1) tree.children.splice(i, 1);
      return;
    }
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
    if (!blogFile(file) && !docsFile(file)) return;
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
