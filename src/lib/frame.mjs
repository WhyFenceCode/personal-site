/**
 * The browser frame: a window around a website. Used at the top of project pages (components/BrowserFrame.astro) and
 * anywhere in Markdown with ::site{url="…"} (lib/embeds.mjs). One HTML generator, so both look and behave the same;
 * styles in src/styles/frame.css, behaviour in src/scripts/frame.ts.
 *
 * When the website allows being framed (checked at build time from its headers), the real site loads into the window,
 * but for any other website only after the visitor presses Continue on a card that says what loading it means. Until
 * then nothing from it loads. Otherwise a screenshot (or nothing but a link) is shown.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- Can it be framed? ---------- */
const frameCache = new Map();
/** True when `url` can be embedded in an <iframe> on `siteUrl`. Checked once per build from the response headers. */
export function canFrame(url, siteUrl) {
  const key = `${url} ${siteUrl}`;
  if (!frameCache.has(key)) frameCache.set(key, check(url, siteUrl));
  return frameCache.get(key);
}
async function check(url, siteUrl) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'personal-site-build' } });
    const xfo = (r.headers.get('x-frame-options') ?? '').toLowerCase();
    if (xfo.includes('deny') || xfo.includes('sameorigin')) return false;
    const csp = r.headers.get('content-security-policy') ?? '';
    const fa = csp.split(';').map((d) => d.trim()).find((d) => d.toLowerCase().startsWith('frame-ancestors'));
    if (fa) {
      const sources = fa.split(/\s+/).slice(1);
      const origin = new URL(siteUrl).origin, host = new URL(siteUrl).host;
      // 'self' allows pages from the framed site's own origin, e.g. this site's own project page.
      const self = sources.includes("'self'") && new URL(r.url).origin === origin;
      return self || sources.some((s) => s === '*' || s.replace(/\/$/, '') === origin || s === host || (s.startsWith('https://*.') && host.endsWith(s.slice(9))));
    }
    return true;
  } catch (e) {
    console.warn(`[frame] could not check ${url} for framing (${e.message}); showing the screenshot only`);
    return false;
  }
}

/* ---------- Interface text ---------- */
const i18nCache = new Map();
const readYaml = (p) => { try { return parse(readFileSync(p, 'utf8')); } catch { return null; } };
/** The frame's strings (src/i18n/<lang>.yaml → projects.preview), falling back to the default language. */
export function frameStrings(lang) {
  if (!i18nCache.has(lang)) {
    const dir = join(process.cwd(), 'src', 'i18n');
    const site = readYaml(join(process.cwd(), 'src', 'config', 'site.yaml')) ?? {};
    const def = site.languages?.[0] ?? 'en';
    const pick = (l) => (existsSync(join(dir, `${l}.yaml`)) ? readYaml(join(dir, `${l}.yaml`))?.projects?.preview : null) ?? {};
    i18nCache.set(lang, { ...pick(def), ...pick(lang) });
  }
  return i18nCache.get(lang);
}
const fill = (s, vars) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/**
 * The frame's HTML.
 *   url          the website (optional: without it the frame only shows the image)
 *   title        what it is, for the iframe's accessible name
 *   siteUrl      this site's address (to tell outside websites from this one)
 *   interactive  load the real site (only when canFrame() said yes)
 *   image        HTML of the screenshot (an <img> or <picture>), or '' for none
 *   art          placeholder art name when there's no image (project pages)
 *   devNote      HTML of a note shown in `pnpm dev` only
 *   lang
 */
export function frameHtml({ url = '', title = '', siteUrl, interactive = false, image = '', art = '', devNote = '', lang = 'en' }) {
  const s = frameStrings(lang);
  const host = url ? new URL(url).host : '';
  const outside = !!url && new URL(url).origin !== new URL(siteUrl).origin;
  const embed = !!url && interactive;
  const id = `bf-${Math.random().toString(36).slice(2, 8)}`;
  const view = embed
    ? `${image ? `<div class="bf-under" aria-hidden="true">${image}</div>` : ''}
       <iframe class="bf-live" data-src="${esc(url)}"${outside ? '' : ' data-self'} title="${esc(`${title || host}: ${s.live ?? 'live preview'}`)}"
         sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
         referrerpolicy="strict-origin-when-cross-origin" tabindex="-1" data-live></iframe>
       ${devNote}
       <div class="bf-shield${image ? ' bf-over-shot' : ''}" data-shield${outside ? '' : ' hidden'}>
         ${outside ? `<div class="bf-card" role="group" aria-labelledby="${id}" data-card>
           <p class="bf-card-title mono" id="${id}">${esc(s.title)}</p>
           <p class="bf-card-note">${esc(fill(s.outside, { host }))}</p>
           <button type="button" class="cbtn bf-go" data-go>
             <span class="cbtn-label"><span>${esc(s.continue)}</span><span aria-hidden="true">${esc(s.continue)}</span></span>
             <span class="cbtn-disc" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7h11M8 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></span>
           </button>
         </div>` : ''}
         <div class="bf-card" role="note" data-nested hidden>
           <p class="bf-card-title mono">${esc(s.nestedTitle)}</p>
           <p class="bf-card-note">${esc(fill(s.nested, { host }))}</p>
         </div>
       </div>`
    : image
      ? image
      : art
        ? `<canvas width="1280" height="800" data-art="${esc(art)}" aria-hidden="true"></canvas>`
        : `<a class="bf-open mono" href="${esc(url)}" rel="noopener">${esc(host)} ↗</a>`;
  return `<figure class="bf" data-frame>
  <div class="bf-bar"${url ? '' : ' aria-hidden="true"'}>
    <span class="bf-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    ${url ? `<a class="bf-url mono" href="${esc(url)}" rel="noopener"><i aria-hidden="true"></i>${esc(host)}</a>` : ''}
    <span class="bf-end">${embed ? `<span class="mono muted bf-state" data-state data-on="${esc(s.interactive)}"><i aria-hidden="true"></i>${esc(s.on)}</span>` : ''}</span>
  </div>
  <div class="bf-view" data-view>${view}</div>
</figure>`;
}
