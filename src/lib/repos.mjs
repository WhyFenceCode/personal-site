/**
 * GitHub repository viewer: a file tree, the README and every file, like opening the repo on GitHub.
 *
 * Everything is fetched from GitHub when the site BUILDS, never by a visitor's browser (the privacy policy promises
 * that pages contact no other company). The README and the tree go into the page; each file becomes its own small
 * page on this site (/repos/<owner>/<name>/<path>.html, made by src/pages/repos/), fetched only when it's opened.
 *
 * Use it two ways (see docs/guides/repos.md):
 *   - a project's frontmatter:  repo: owner/name
 *   - anywhere in Markdown (projects, blog posts), a fenced block:
 *       ```repo
 *       owner/name
 *       ```
 *
 * Public repos only. Without a token GitHub allows 60 API calls an hour; each repo takes two, and results are cached
 * in node_modules/.cache/site-repos for 10 minutes (file contents for good, by their hash). Set GITHUB_TOKEN as a
 * build variable to raise the limit. If GitHub can't be reached, the last cached copy is used, or a plain link.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';

const API = 'https://api.github.com', RAW = 'https://raw.githubusercontent.com';
const CACHE = join(process.cwd(), 'node_modules', '.cache', 'site-repos');
const FRESH_MS = 10 * 60 * 1000;
export const LIMITS = { files: 300, textBytes: 100_000, imageBytes: 400_000 };
// Machine-written files nobody reads (they also balloon once highlighted): listed, but not shown.
const GENERATED = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|[^/]+\.min\.(js|css)|[^/]+\.map)$/i;

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i;
const BINARY = /\.(pdf|zip|gz|tgz|7z|rar|glb|gltf|bin|exe|dll|so|dylib|woff2?|ttf|otf|eot|mp3|wav|ogg|mp4|mov|webm|psd|ai|sketch|fig|blend|stl|step|stp|f3d|jar|class|pyc|db|sqlite|xlsx?|docx?|pptx?)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon' };
const LANG = {
  ts: 'ts', tsx: 'tsx', js: 'js', mjs: 'js', cjs: 'js', jsx: 'jsx', json: 'json', jsonc: 'jsonc', md: 'md', mdx: 'mdx', astro: 'astro',
  html: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less', yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml', svg: 'xml',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp',
  hpp: 'cpp', cs: 'csharp', php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', sql: 'sql', lua: 'lua', r: 'r',
  vue: 'vue', svelte: 'svelte', glsl: 'glsl', frag: 'glsl', vert: 'glsl', ini: 'ini', dockerfile: 'docker', makefile: 'make', tex: 'latex', diff: 'diff',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ext = (p) => (p.match(/\.([^./]+)$/)?.[1] ?? posix.basename(p)).toLowerCase();

/** "owner/name", "owner/name@branch" or a github.com address → { owner, name, branch? }, or null. */
export function parseSpec(spec) {
  const s = String(spec ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');
  const m = s.match(/^([\w.-]+)\/([\w.-]+)(?:(?:@|\/tree\/)([\w./-]+))?$/);
  return m ? { owner: m[1], name: m[2], branch: m[3] } : null;
}
const keyOf = (o, n) => `${o}/${n}`.toLowerCase();

/* ---------- Fetching, with a small disk cache ---------- */
async function get(url, as = 'json') {
  const headers = { 'User-Agent': 'personal-site-build', Accept: as === 'json' ? 'application/vnd.github+json' : '*/*' };
  if (process.env.GITHUB_TOKEN && url.startsWith(API)) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController(); const id = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return as === 'json' ? await r.json() : as === 'text' ? await r.text() : Buffer.from(await r.arrayBuffer());
    } catch (e) { if (attempt) throw e; } finally { clearTimeout(id); }
  }
}
const cacheFile = (name) => join(CACHE, name.replace(/[^\w.-]+/g, '_'));
const readCache = (name) => { try { return JSON.parse(readFileSync(cacheFile(name), 'utf8')); } catch { return null; } };
const writeCache = (name, data) => { try { mkdirSync(CACHE, { recursive: true }); writeFileSync(cacheFile(name), JSON.stringify(data)); } catch {} };

const repoMemo = new Map();
/** The repo's details and file list, or null when it can't be loaded (private, missing, or offline with no cache). */
export function getRepo(spec) {
  const p = parseSpec(spec); if (!p) return Promise.resolve(null);
  const key = keyOf(p.owner, p.name) + (p.branch ? `@${p.branch}` : '');
  if (!repoMemo.has(key)) repoMemo.set(key, loadRepo(p, key));
  return repoMemo.get(key);
}
async function loadRepo(p, key) {
  const cached = readCache(`${key}.json`);
  if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached.repo;
  try {
    const meta = await get(`${API}/repos/${p.owner}/${p.name}`);
    if (!meta || meta.private) { console.warn(`[repos] ${key}: not found or not public`); return cached?.repo ?? null; }
    const branch = p.branch || meta.default_branch;
    const tree = await get(`${API}/repos/${p.owner}/${p.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const repo = {
      owner: meta.owner.login, name: meta.name, branch, url: meta.html_url, description: meta.description ?? '',
      homepage: meta.homepage || '', stars: meta.stargazers_count, forks: meta.forks_count, language: meta.language,
      license: meta.license?.spdx_id && meta.license.spdx_id !== 'NOASSERTION' ? meta.license.spdx_id : '', pushedAt: meta.pushed_at,
      truncated: !!tree?.truncated,
      files: (tree?.tree ?? []).filter((e) => e.type === 'blob' || e.type === 'tree').map((e) => ({ path: e.path, dir: e.type === 'tree', size: e.size ?? 0, sha: e.sha })),
    };
    writeCache(`${key}.json`, { fetchedAt: Date.now(), repo });
    return repo;
  } catch (e) {
    console.warn(`[repos] ${key}: ${e.message}${cached ? ' (using the cached copy)' : ''}`);
    return cached?.repo ?? null;
  }
}

/** A file's bytes, cached on disk by its content hash (so unchanged files are never fetched twice). */
async function fileBytes(repo, f) {
  const name = `blob-${f.sha}`;
  if (existsSync(cacheFile(name))) return readFileSync(cacheFile(name));
  const path = f.path.split('/').map(encodeURIComponent).join('/');
  const buf = await get(`${RAW}/${repo.owner}/${repo.name}/${encodeURIComponent(repo.branch)}/${path}`, 'buffer');
  if (buf) { try { mkdirSync(CACHE, { recursive: true }); writeFileSync(cacheFile(name), buf); } catch {} }
  return buf;
}

/* ---------- What can be shown ---------- */
/** How the viewer treats a file: md (rendered), text (highlighted), img, or not shown here (big, bin, more). */
export function kindOf(f, index) {
  if (IMAGE.test(f.path)) return f.size <= LIMITS.imageBytes && !/\.ico$/i.test(f.path) ? 'img' : 'bin';
  if (BINARY.test(f.path)) return 'bin';
  if (f.size > LIMITS.textBytes || GENERATED.test(f.path)) return 'big';
  if (index >= LIMITS.files) return 'more';
  return /\.(md|markdown)$/i.test(f.path) ? 'md' : 'text';
}
/** The files that get their own page: every file the viewer can show, up to LIMITS.files. */
export function viewable(repo) {
  const m = kinds(repo);
  return repo.files.filter((f) => ['md', 'text', 'img'].includes(m.get(f.path)));
}
/** Every file's kind. Text files are counted in order, so only the first LIMITS.files get pages. */
function kinds(repo) {
  let n = 0; const m = new Map();
  for (const f of repo.files) if (!f.dir) { const k = kindOf(f, 0); m.set(f.path, k === 'md' || k === 'text' ? kindOf(f, n++) : k); }
  return m;
}

/* ---------- Rendering ---------- */
let mdProc;
const md = () => (mdProc ??= createMarkdownProcessor({}));

const blobUrl = (repo, path) => `${repo.url}/blob/${encodeURIComponent(repo.branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
const treeUrl = (repo, path) => `${repo.url}/tree/${encodeURIComponent(repo.branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
const idPrefix = (repo) => `rv-${repo.owner}-${repo.name}-`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

/** Rendered Markdown from the repo, made safe and self-contained: links between files open in the viewer, the repo's own
 *  images are embedded, images from other websites are left out (their alt text stays), and scripts are removed. */
async function renderMarkdown(repo, text, filePath) {
  const { code } = await (await md()).render(text);
  const dir = posix.dirname(filePath) === '.' ? '' : posix.dirname(filePath);
  const byPath = new Map(repo.files.map((f) => [f.path, f]));
  const resolve = (u) => {
    const clean = decodeURIComponent(u.split(/[?#]/)[0]);
    const p = clean.startsWith('/') ? clean.slice(1) : posix.normalize(posix.join(dir, clean));
    return p.replace(/\/$/, '');
  };
  const pre = idPrefix(repo);
  let html = code
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<(iframe|object|embed)[\s\S]*?(<\/\1>|\/?>)/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '').replace(/<source\b[^>]*>/gi, '')
    .replace(/\sid="([^"]+)"/g, (_, id) => ` id="${pre}${id}"`);
  // Images: embed the repo's own (small enough) ones, drop the rest.
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
  for (const [tag] of imgs) {
    const src = tag.match(/\ssrc="([^"]*)"/i)?.[1] ?? '', alt = tag.match(/\salt="([^"]*)"/i)?.[1] ?? '';
    let out = alt ? `<span class="rv-alt">${alt}</span>` : '';
    if (src && !/^([a-z]+:|\/\/)/i.test(src)) {
      const f = byPath.get(resolve(src));
      if (f && IMAGE.test(f.path) && f.size <= LIMITS.imageBytes) {
        const buf = await fileBytes(repo, f).catch(() => null);
        if (buf) out = tag.replace(/\ssrc="[^"]*"/i, ` src="data:${MIME[ext(f.path)] ?? 'application/octet-stream'};base64,${buf.toString('base64')}"`).replace(/\ssrcset="[^"]*"/i, '').replace(/^<img/i, '<img loading="lazy"');
      }
    }
    html = html.replace(tag, out);
  }
  // Links: in-page anchors keep working, files open in the viewer, folders and everything else go to GitHub.
  html = html.replace(/<a\b([^>]*?)\shref="([^"]*)"([^>]*)>/gi, (all, a, href, b) => {
    if (href.startsWith('#')) return `<a${a} href="#${pre}${href.slice(1)}"${b}>`;
    if (/^([a-z]+:|\/\/)/i.test(href)) return `<a${a} href="${href}" rel="noopener"${b}>`;
    const p = resolve(href), f = byPath.get(p);
    if (f && !f.dir) return `<a${a} href="${esc(blobUrl(repo, p))}" data-repo-open="${esc(p)}"${b}>`;
    return `<a${a} href="${esc(f?.dir ? treeUrl(repo, p) : blobUrl(repo, p))}" rel="noopener"${b}>`;
  });
  return html;
}

/** One file, ready to show: rendered Markdown, highlighted code, or an image. Null when it can't be shown here. */
export async function fileHtml(repo, path) {
  const f = repo.files.find((x) => x.path === path && !x.dir); if (!f) return null;
  const kind = kinds(repo).get(path);
  const buf = await fileBytes(repo, f).catch(() => null); if (!buf) return null;
  if (kind === 'img') return `<div class="rv-image"><img src="data:${MIME[ext(path)] ?? 'application/octet-stream'};base64,${buf.toString('base64')}" alt="${esc(posix.basename(path))}"></div>`;
  if (kind !== 'md' && kind !== 'text') return null;
  const text = buf.toString('utf8');
  if (text.includes('\u0000')) return null; // binary after all
  if (kind === 'md') return `<div class="rv-md">${await renderMarkdown(repo, text, path)}</div>`;
  const lang = LANG[ext(path)] ?? 'plaintext';
  const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((m) => m[0].length + 1)));
  const { code } = await (await md()).render(`${fence}${lang}\n${text.replace(/\n$/, '')}\n${fence}\n`);
  const lines = text.replace(/\n$/, '').split('\n').length;
  return `<div class="rv-code" style="--digits:${String(lines).length}">${code}</div>`;
}

/** Folders first, then files, alphabetically, as nested lists. */
function treeHtml(repo, kindMap) {
  const root = { dirs: new Map(), files: [] };
  for (const f of repo.files) {
    const parts = f.path.split('/'); let node = root;
    for (const part of parts.slice(0, f.dir ? undefined : -1)) { if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] }); node = node.dirs.get(part); }
    if (!f.dir) node.files.push(f);
  }
  const cmp = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
  const list = (node, prefix) => `<ul>${[...node.dirs.keys()].sort(cmp).map((d) =>
      `<li><details><summary><span>${esc(d)}/</span></summary>${list(node.dirs.get(d), `${prefix}${d}/`)}</details></li>`).join('')
    }${node.files.sort((a, b) => cmp(a.path, b.path)).map((f) =>
      `<li><button type="button" class="rv-file" data-path="${esc(f.path)}" data-kind="${kindMap.get(f.path)}">${esc(posix.basename(f.path))}</button></li>`).join('')}</ul>`;
  return list(root, '');
}

const fmtNum = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const GH = '<svg class="rv-mark" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

/** The whole viewer, as HTML (src/scripts/repo.ts makes it work; styles in src/styles/repo.css). */
export async function viewerHtml(spec) {
  const p = parseSpec(spec);
  if (!p) return `<p class="rv-missing">Not a GitHub repository: <code>${esc(spec)}</code>. Write it as owner/name.</p>`;
  const repo = await getRepo(spec);
  const fallbackUrl = `https://github.com/${p.owner}/${p.name}`;
  if (!repo) return `<p class="rv-missing">${GH} <a href="${esc(fallbackUrl)}" rel="noopener">${esc(p.owner)}/${esc(p.name)} on GitHub ↗</a></p>`;
  const kindMap = kinds(repo);
  const readme = repo.files.filter((f) => !f.dir && /^readme(\.(md|markdown|txt))?$/i.test(f.path)).sort((a, b) => Number(/\.md$/i.test(b.path)) - Number(/\.md$/i.test(a.path)))[0];
  let readmeHtml = '';
  if (readme) {
    const buf = await fileBytes(repo, readme).catch(() => null);
    if (buf) readmeHtml = /\.(md|markdown)$/i.test(readme.path)
      ? `<div class="rv-md">${await renderMarkdown(repo, buf.toString('utf8'), readme.path)}</div>`
      : `<div class="rv-code"><pre class="rv-plain">${esc(buf.toString('utf8'))}</pre></div>`;
  }
  if (!readmeHtml) readmeHtml = `<p class="rv-note">This repository has no README. Pick a file on the left.</p>`;
  const count = repo.files.filter((f) => !f.dir).length;
  const meta = [
    repo.language && `<li><i class="rv-dot" aria-hidden="true"></i>${esc(repo.language)}</li>`,
    `<li>★ ${fmtNum(repo.stars)}</li>`,
    repo.forks ? `<li>${fmtNum(repo.forks)} fork${repo.forks === 1 ? '' : 's'}</li>` : '',
    repo.license && `<li>${esc(repo.license)}</li>`,
    `<li>${count} files</li>`,
  ].filter(Boolean).join('');
  const base = `/repos/${repo.owner}/${repo.name}/`;
  return `<figure class="rv not-prose" data-repo-viewer data-base="${esc(base)}" data-gh="${esc(repo.url)}" data-branch="${esc(repo.branch)}" data-readme="${esc(readme?.path ?? '')}">
<header class="rv-head">
  <div class="rv-title">${GH}<a href="${esc(repo.url)}" rel="noopener"><span>${esc(repo.owner)}</span> / <b>${esc(repo.name)}</b></a></div>
  ${repo.description ? `<p class="rv-desc">${esc(repo.description)}</p>` : ''}
  <div class="rv-sub"><ul class="rv-meta mono">${meta}</ul><a class="rv-open mono" href="${esc(repo.url)}" rel="noopener">GitHub ↗</a></div>
</header>
<div class="rv-body">
  <nav class="rv-tree" aria-label="Files in ${esc(repo.owner)}/${esc(repo.name)}">
    <button type="button" class="rv-toggle mono" aria-expanded="false" data-rv-toggle hidden>Files <span>${count}</span></button>
    <div class="rv-tree-in" data-rv-tree>
      ${readme ? `<button type="button" class="rv-file rv-readme" data-path="" aria-current="true">README</button>` : ''}
      ${treeHtml(repo, kindMap)}
      ${repo.truncated ? `<p class="rv-note">Only part of this repository is listed. <a href="${esc(repo.url)}" rel="noopener">See all of it on GitHub</a>.</p>` : ''}
    </div>
  </nav>
  <section class="rv-view" aria-label="File">
    <div class="rv-bar mono"><span class="rv-path" data-rv-path aria-live="polite">${esc(readme?.path ?? repo.name)}</span><a class="rv-file-gh" data-rv-gh href="${esc(readme ? blobUrl(repo, readme.path) : repo.url)}" rel="noopener">View on GitHub ↗</a></div>
    <div class="rv-content" data-rv-content tabindex="-1">${readmeHtml}</div>
    <template data-rv-readme>${readmeHtml}</template>
  </section>
</div>
<figcaption class="sr-only">The ${esc(repo.name)} repository: its files on the left, the open file on the right.</figcaption>
</figure>`;
}

/* ---------- Which repos the site uses ---------- */
/** Every repo named in the content (project `repo:` fields and ```repo blocks), so their file pages can be built. */
export function reposInContent(root = join(process.cwd(), 'src', 'content')) {
  const found = new Set();
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (/\.mdx?$/.test(e.name)) {
        const s = readFileSync(join(d, e.name), 'utf8');
        const fm = s.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
        const r = fm.match(/^repo:\s*["']?([^"'\s#]+)/m)?.[1]; if (r) found.add(r);
        for (const m of s.matchAll(/^(`{3,}|~{3,})repo[ \t]*\r?\n[ \t]*([^\s`~]+)/gm)) found.add(m[2]);
      }
    }
  };
  walk(root);
  return [...found].filter((s) => parseSpec(s));
}

/* ---------- Markdown: ```repo blocks ---------- */
/** remark plugin: a fenced code block in the language "repo" holding owner/name becomes the viewer. */
export function remarkRepoBlocks() {
  return async (tree) => {
    const jobs = [];
    const visit = (node) => {
      for (const [i, c] of (node.children ?? []).entries()) {
        if (c.type === 'code' && c.lang === 'repo') jobs.push(viewerHtml(c.value.trim().split(/\s+/)[0]).then((html) => { node.children[i] = { type: 'html', value: html }; }));
        else visit(c);
      }
    };
    visit(tree);
    await Promise.all(jobs);
  };
}
