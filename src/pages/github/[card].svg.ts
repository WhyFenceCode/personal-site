/**
 * /github/<repo>-light.svg and /github/<repo>-dark.svg: link cards for the GitHub profile README
 * (github.com/WhyFenceCode/WhyFenceCode), one per repo in site.yaml → github.cards, drawn in this site's style.
 *
 * Like the banner (../github-banner-[theme].svg.ts), each is one self-contained SVG with the fonts embedded, so GitHub
 * can show it as an image. The README wraps each in a link to the repo and picks light or dark to match the viewer's
 * GitHub theme. The repo's language, stars and last push come from GitHub when the site builds. After changing them,
 * rebuild and copy the files into the profile repo's assets/ (docs/home-page/programming.md).
 */
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { site } from '../../lib/config';
import { getRepo } from '../../lib/repos.mjs';

const THEMES = {
  light: { bg: '#E6E6E6', fg: '#0B0B0B', muted: '#555555', line: '#CBCBCB' },
  dark: { bg: '#161616', fg: '#FFFFFF', muted: '#A0A0A0', line: '#2E2E2E' },
} as const;
type Theme = keyof typeof THEMES;

export function getStaticPaths() {
  return site.github.cards.flatMap((c) => (['light', 'dark'] as Theme[]).map((theme) => ({ params: { card: `${c.repo}-${theme}` }, props: { card: c, theme } })));
}

const require = createRequire(import.meta.url);
const b64 = (pkgFile: string) => readFileSync(require.resolve(pkgFile)).toString('base64');
const display = b64('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2');
const mono = b64('@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2');
const ACCENT = site.theme.accent;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Break text into lines of about `max` characters (two at most, the last cut with an ellipsis). */
function lines(text: string, max: number, count = 2) {
  const out: string[] = []; let cur = '';
  for (const word of text.split(/\s+/)) {
    if ((cur + ' ' + word).trim().length > max) { out.push(cur.trim()); cur = word; } else cur += ' ' + word;
  }
  if (cur.trim()) out.push(cur.trim());
  if (out.length > count) { out.length = count; out[count - 1] = out[count - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}

const W = 600, H = 210, PAD = 28;

export const GET: APIRoute = async ({ props }) => {
  const { card, theme } = props as { card: (typeof site.github.cards)[number]; theme: Theme };
  const c = THEMES[theme];
  const owner = site.github.username;
  const repo = await getRepo(`${owner}/${card.repo}`);
  const title = card.title ?? repo?.name ?? card.repo;
  const description = card.description ?? repo?.description ?? '';
  const updated = repo?.pushedAt ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(repo.pushedAt)) : '';
  const meta = [repo?.language, repo ? `★ ${repo.stars}` : '', updated && `Updated ${updated}`].filter(Boolean) as string[];
  // The title fills the width when it's long, keeping its condensed look; short titles keep their natural size.
  const titleSize = 46, titleMax = W - PAD * 2;
  const fitTitle = title.length * titleSize * 0.5 > titleMax;
  const desc = lines(description, 58);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${title}: ${description}`)}">
<title>${esc(title)}</title>
<style>
@font-face { font-family: "Bricolage"; src: url(data:font/woff2;base64,${display}) format("woff2"); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: "DM Mono"; src: url(data:font/woff2;base64,${mono}) format("woff2"); font-weight: 500; }
.mono { font-family: "DM Mono", ui-monospace, monospace; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; fill: ${c.muted}; }
.mono.fg { fill: ${c.fg}; }
.title { font-family: "Bricolage", "Arial Narrow", sans-serif; font-weight: 800; font-stretch: 80%; font-size: ${titleSize}px; letter-spacing: -.02em; text-transform: uppercase; fill: ${c.fg}; }
.desc { font-family: "Bricolage", sans-serif; font-weight: 500; font-size: 17px; fill: ${c.muted}; }
.card { opacity: 0; animation: in .7s cubic-bezier(.2,.8,.2,1) .1s forwards; }
@keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .card { animation: none; opacity: 1; } }
</style>
<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="10" fill="${c.bg}" stroke="${c.line}" stroke-width="1.5"/>
<g class="card">
  <rect x="${PAD}" y="${PAD + 1}" width="8" height="8" fill="${ACCENT}"/>
  <text class="mono" x="${PAD + 16}" y="${PAD + 9}">${esc(owner)} / ${esc(card.repo)}</text>
  <text class="mono fg" x="${W - PAD}" y="${PAD + 9}" text-anchor="end">GitHub ↗</text>
  <text class="title" x="${PAD}" y="${PAD + 62}"${fitTitle ? ` textLength="${titleMax}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(title)}</text>
  ${desc.map((l, i) => `<text class="desc" x="${PAD}" y="${PAD + 96 + i * 22}">${esc(l)}</text>`).join('\n  ')}
  <line x1="${PAD}" y1="${H - PAD - 18}" x2="${W - PAD}" y2="${H - PAD - 18}" stroke="${c.line}" stroke-width="1"/>
  <text class="mono" x="${PAD}" y="${H - PAD + 2}">${meta.map(esc).join('  ·  ')}</text>
</g>
</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
};
