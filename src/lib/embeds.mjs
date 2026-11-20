/**
 * Embeds you can place anywhere in Markdown (blog posts, project case studies), written as directives, the way
 * Starlight does it. Each sits exactly where you write it, as many as you like, between text and images.
 *
 *   ::site{url="https://example.com"}                         a website in a browser frame
 *   ::site[Caption under it]{url="…" image="./shot.jpg"}       with your own screenshot (next to the file) and a caption
 *   ::site{url="…" live="false"}                               never load the real site, just the screenshot
 *   ::repo{name="owner/name"}                                  a GitHub repository: files, README, code
 *   ::repo[owner/name]                                         the same, shorter
 *
 * The site frame works like the one on project pages: an outside website only loads after the visitor presses
 * Continue on a card that explains what that means. Without image="…" it uses the screenshot from `pnpm shots`
 * (src/assets/screenshots/sites/), if there is one. See docs/writing/embeds.md.
 *
 * Needs remark-directive before it in the plugin list (astro.config.mjs).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { parse } from 'yaml';
import { frameHtml, canFrame } from './frame.mjs';
import { viewerHtml } from './repos.mjs';

const site = (() => { try { return parse(readFileSync(join(process.cwd(), 'src', 'config', 'site.yaml'), 'utf8')); } catch { return {}; } })();
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const textOf = (n) => (n.value ?? '') + (n.children ?? []).map(textOf).join('');

export const SHOTS_DIR = join('src', 'assets', 'screenshots', 'sites');
/** The file name `pnpm shots` saves a ::site screenshot under, e.g. https://shaders.properties/docs → shaders-properties-docs.jpg */
export const siteShotName = (url) => {
  const u = new URL(url);
  return `${(u.host + u.pathname).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.jpg`;
};

/** Every ::site in the content: [{ url, image?, live }], for `pnpm shots` and the privacy policy's list. */
export function sitesInContent(root = join(process.cwd(), 'src', 'content')) {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.mdx?$/.test(e.name)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/^::site(?:\[[^\]]*\])?\{([^}]*)\}/gm)) {
          const attrs = Object.fromEntries([...m[1].matchAll(/([\w-]+)=["']([^"']*)["']/g)].map((a) => [a[1], a[2]]));
          if (attrs.url) out.push({ url: attrs.url, image: attrs.image, live: attrs.live !== 'false' });
        }
      }
    }
  };
  walk(root);
  return out;
}

/** Put a directive that wasn't meant as one back as the text it was written as (e.g. "TODO:fix" in a sentence). */
function asText(node) {
  const label = node.children?.length ? `[${node.children.map(textOf).join('')}]` : '';
  const attrs = Object.keys(node.attributes ?? {}).length ? `{${Object.entries(node.attributes).map(([k, v]) => `${k}="${v}"`).join(' ')}}` : '';
  const marks = node.type === 'textDirective' ? ':' : node.type === 'leafDirective' ? '::' : ':::';
  return { type: 'text', value: `${marks}${node.name}${label}${attrs}` };
}

export function remarkEmbeds() {
  return async (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    const lang = path.replace(/\\/g, '/').match(/\/src\/content\/[^/]+\/([a-z]{2})\//)?.[1] ?? site.languages?.[0] ?? 'en';
    const jobs = [];
    const walk = (parent) => {
      const kids = parent.children ?? [];
      for (let i = 0; i < kids.length; i++) {
        const node = kids[i];
        const at = i;
        if (node.type === 'code' && node.lang === 'repo') {
          jobs.push(viewerHtml(node.value.trim().split(/\s+/)[0]).then((html) => { parent.children[at] = { type: 'html', value: html }; }));
        } else if (node.type === 'leafDirective' && node.name === 'repo') {
          const spec = node.attributes?.name || node.attributes?.repo || node.children?.map(textOf).join('').trim();
          jobs.push(viewerHtml(spec).then((html) => { parent.children[at] = { type: 'html', value: html }; }));
        } else if (node.type === 'leafDirective' && node.name === 'site') {
          jobs.push(siteNodes(node, path, lang).then((nodes) => { parent.children[at] = { type: 'embedGroup', children: nodes }; }));
        } else if (node.type === 'textDirective' || node.type === 'leafDirective' || node.type === 'containerDirective') {
          parent.children[at] = node.type === 'textDirective' ? asText(node) : { type: 'paragraph', children: [asText(node)] };
          if (node.type === 'containerDirective') parent.children.splice(at + 1, 0, ...(node.children ?? []));
        } else walk(node);
      }
    };
    walk(tree);
    await Promise.all(jobs);
    // Flatten the groups (a frame is several nodes: its HTML around an image Astro optimises).
    const flat = (parent) => {
      if (!parent.children) return;
      parent.children = parent.children.flatMap((c) => (c.type === 'embedGroup' ? c.children : [c]));
      parent.children.forEach(flat);
    };
    flat(tree);
  };
}

/** A ::site directive → the frame's HTML, split around an image node so Astro resizes the screenshot like any other. */
async function siteNodes(node, mdPath, lang) {
  const a = node.attributes ?? {};
  const caption = node.children?.map(textOf).join('').trim();
  let url;
  try { url = new URL(a.url).href; } catch { return [{ type: 'paragraph', children: [{ type: 'text', value: `::site needs a url="https://…" (got "${a.url ?? ''}")` }] }]; }
  const interactive = a.live !== 'false' && (await canFrame(url, site.url ?? 'https://example.com'));
  // The screenshot: image="…" (next to the Markdown file), else the one `pnpm shots` saved for this address.
  let src = a.image;
  if (!src) {
    const shot = join(process.cwd(), SHOTS_DIR, siteShotName(url));
    if (existsSync(shot) && mdPath) src = relative(dirname(mdPath), shot).split('\\').join('/').replace(/^(?!\.)/, './');
  }
  const host = new URL(url).host;
  const marker = '<!--bf-image-->';
  const html = frameHtml({ url, title: a.title || caption || host, siteUrl: site.url ?? 'https://example.com', interactive, image: src ? marker : '', lang });
  const [before, after] = html.split(marker);
  const open = `<div class="bf-embed">`, close = `${caption ? `<p class="bf-caption">${esc(caption)}</p>` : ''}</div>`;
  if (!src) return [{ type: 'html', value: open + html + close }];
  return [
    { type: 'html', value: open + before },
    { type: 'image', url: src, alt: a.alt ?? `Screenshot of ${host}`, title: null },
    { type: 'html', value: after + close },
  ];
}
