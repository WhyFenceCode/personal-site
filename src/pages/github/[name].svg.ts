/**
 * Images for the GitHub profile README (github.com/WhyFenceCode/WhyFenceCode), drawn in this site's style, each in a
 * light and a dark version (the README picks one to match the viewer's GitHub theme). Set in site.yaml → github:
 *
 *   /github/link-<label>-light.svg   one pill per link (links), a row of them under the banner. Each is its own image,
 *                                    because GitHub can only make a whole image a link.
 *   /github/intro-light.svg          the intro sentence, then the section heading over the cards (intro, heading)
 *   /github/<repo>-light.svg         a card per repo (cards): name, description, language, stars, last update
 *
 * Like the banner (../github-banner-[theme].svg.ts), each is one self-contained SVG with the fonts embedded. After
 * changing them, rebuild and copy dist/github/ into the profile repo's assets/ (docs/home-page/programming.md).
 */
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { site } from '../../lib/config';
import { getRepo } from '../../lib/repos.mjs';

const THEMES = {
  light: { bg: '#E6E6E6', fg: '#0B0B0B', muted: '#555555', line: '#CBCBCB', inv: '#FFFFFF' },
  dark: { bg: '#161616', fg: '#FFFFFF', muted: '#A0A0A0', line: '#2E2E2E', inv: '#0B0B0B' },
} as const;
type Theme = keyof typeof THEMES;
type Card = (typeof site.github.cards)[number];
type Link = (typeof site.github.links)[number];
type Props = { kind: 'card'; card: Card; theme: Theme } | { kind: 'intro'; theme: Theme } | { kind: 'link'; link: Link; first: boolean; theme: Theme };

const slugOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function getStaticPaths() {
  const themes: Theme[] = ['light', 'dark'];
  const gh = site.github;
  return themes.flatMap((theme) => [
    ...gh.cards.map((card) => ({ params: { name: `${card.repo}-${theme}` }, props: { kind: 'card', card, theme } })),
    ...(gh.intro || gh.heading ? [{ params: { name: `intro-${theme}` }, props: { kind: 'intro', theme } }] : []),
    ...gh.links.map((link, i) => ({ params: { name: `link-${slugOf(link.label)}-${theme}` }, props: { kind: 'link', link, first: i === 0, theme } })),
  ]);
}

const require = createRequire(import.meta.url);
const b64 = (pkgFile: string) => readFileSync(require.resolve(pkgFile)).toString('base64');
const display = b64('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2');
const mono = b64('@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2');
const FONTS = `@font-face { font-family: "Bricolage"; src: url(data:font/woff2;base64,${display}) format("woff2"); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: "DM Mono"; src: url(data:font/woff2;base64,${mono}) format("woff2"); font-weight: 500; }`;
const MOTION = `.in { opacity: 0; animation: in .7s cubic-bezier(.2,.8,.2,1) .1s forwards; }
@keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .in { animation: none; opacity: 1; } }`;
const ACCENT = site.theme.accent;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svgOpen = (w: number, h: number, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">\n<title>${esc(label)}</title>`;

/** Break text into lines of about `max` characters (at most `count`, the last cut with an ellipsis). */
function lines(text: string, max: number, count = 2) {
  const out: string[] = []; let cur = '';
  for (const word of text.split(/\s+/)) {
    if ((cur + ' ' + word).trim().length > max) { out.push(cur.trim()); cur = word; } else cur += ' ' + word;
  }
  if (cur.trim()) out.push(cur.trim());
  if (out.length > count) { out.length = count; out[count - 1] = out[count - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}

/* ---------- A repo card ---------- */
async function card(cardCfg: Card, theme: Theme) {
  const c = THEMES[theme], W = 600, H = 210, PAD = 28;
  const owner = site.github.username;
  const repo = await getRepo(`${owner}/${cardCfg.repo}`);
  const title = cardCfg.title ?? repo?.name ?? cardCfg.repo;
  const description = cardCfg.description ?? repo?.description ?? '';
  const updated = repo?.pushedAt ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(repo.pushedAt)) : '';
  const meta = [repo?.language, repo ? `★ ${repo.stars}` : '', updated && `Updated ${updated}`].filter(Boolean) as string[];
  // The title fills the width when it's long, keeping its condensed look; short titles keep their natural size.
  const titleSize = 46, titleMax = W - PAD * 2;
  const fitTitle = title.length * titleSize * 0.5 > titleMax;
  return `${svgOpen(W, H, `${title}: ${description}`)}
<style>
${FONTS}
.mono { font-family: "DM Mono", ui-monospace, monospace; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; fill: ${c.muted}; }
.mono.fg { fill: ${c.fg}; }
.title { font-family: "Bricolage", "Arial Narrow", sans-serif; font-weight: 800; font-stretch: 80%; font-size: ${titleSize}px; letter-spacing: -.02em; text-transform: uppercase; fill: ${c.fg}; }
.desc { font-family: "Bricolage", sans-serif; font-weight: 500; font-size: 17px; fill: ${c.muted}; }
${MOTION}
</style>
<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="10" fill="${c.bg}" stroke="${c.line}" stroke-width="1.5"/>
<g class="in">
  <rect x="${PAD}" y="${PAD + 1}" width="8" height="8" fill="${ACCENT}"/>
  <text class="mono" x="${PAD + 16}" y="${PAD + 9}">${esc(owner)} / ${esc(cardCfg.repo)}</text>
  <text class="mono fg" x="${W - PAD}" y="${PAD + 9}" text-anchor="end">GitHub ↗</text>
  <text class="title" x="${PAD}" y="${PAD + 62}"${fitTitle ? ` textLength="${titleMax}" lengthAdjust="spacingAndGlyphs"` : ''}>${esc(title)}</text>
  ${lines(description, 58).map((l, i) => `<text class="desc" x="${PAD}" y="${PAD + 96 + i * 22}">${esc(l)}</text>`).join('\n  ')}
  <line x1="${PAD}" y1="${H - PAD - 18}" x2="${W - PAD}" y2="${H - PAD - 18}" stroke="${c.line}" stroke-width="1"/>
  <text class="mono" x="${PAD}" y="${H - PAD + 2}">${meta.map(esc).join('  ·  ')}</text>
</g>
</svg>`;
}

/* ---------- The intro and the heading over the cards ----------
   Transparent, so it sits on GitHub's own page like the README's text would. The heading is the site's section heading:
   an eyebrow with the accent square, the title in condensed display capitals, and the count. */
function intro(theme: Theme) {
  const c = THEMES[theme], W = 1280;
  const gh = site.github;
  const text = lines(gh.intro, 64, 3);
  const top = 44, lead = 46;
  const eyebrowY = top + (text.length - 1) * lead + 96, headY = eyebrowY + 104;
  const H = gh.heading ? headY + 28 : top + (text.length - 1) * lead + 28;
  const count = String(gh.cards.length).padStart(2, '0');
  return `${svgOpen(W, H, [gh.intro, gh.heading].filter(Boolean).join(' '))}
<style>
${FONTS}
.lead { font-family: "Bricolage", sans-serif; font-weight: 500; font-size: 36px; letter-spacing: -.02em; fill: ${c.fg}; }
.mono { font-family: "DM Mono", ui-monospace, monospace; font-size: 15px; letter-spacing: .14em; text-transform: uppercase; fill: ${c.muted}; }
.h2 { font-family: "Bricolage", "Arial Narrow", sans-serif; font-weight: 800; font-stretch: 80%; font-size: 112px; letter-spacing: -.02em; text-transform: uppercase; fill: ${c.fg}; }
.count { font-family: "Bricolage", sans-serif; font-weight: 700; font-stretch: 85%; font-size: 30px; fill: ${c.muted}; }
${MOTION}
</style>
<g class="in">
  ${text.map((l, i) => `<text class="lead" x="0" y="${top + i * lead}">${esc(l)}</text>`).join('\n  ')}
  ${gh.heading ? `<rect x="0" y="${eyebrowY - 10}" width="9" height="9" fill="${ACCENT}"/>
  <text class="mono" x="20" y="${eyebrowY}">Repositories</text>
  <text class="h2" x="0" y="${headY}">${esc(gh.heading)}<tspan class="count" dx="14" dy="-62">(${count})</tspan></text>` : ''}
</g>
</svg>`;
}

/* ---------- A link pill ----------
   The site's nav pills: mono capitals in a full pill with a 1.5px line; the first one filled, like Contact. */
function link(l: Link, first: boolean, theme: Theme) {
  const c = THEMES[theme], H = 44, FS = 13;
  const label = l.label.toUpperCase();
  const textW = label.length * FS * 0.74; // DM Mono: 0.6em a character, plus the 0.14em letter spacing
  const arrow = first ? 22 : 0;
  const W = Math.ceil(textW + 40 + arrow + 2);
  return `${svgOpen(W, H, l.label)}
<style>
${FONTS}
.t { font-family: "DM Mono", ui-monospace, monospace; font-size: ${FS}px; letter-spacing: .14em; fill: ${first ? c.inv : c.fg}; }
</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${(H - 2) / 2}" fill="${first ? c.fg : 'none'}" stroke="${c.fg}" stroke-width="1.5"/>
<text class="t" x="21" y="${H / 2 + FS * 0.36}">${esc(label)}</text>
${first ? `<path d="M${W - 34} ${H / 2 + 5}l8-8M${W - 32} ${H / 2 - 3}h6v6" fill="none" stroke="${c.inv}" stroke-width="1.5"/>` : ''}
</svg>`;
}

export const GET: APIRoute = async ({ props }) => {
  const p = props as Props;
  const svg = p.kind === 'card' ? await card(p.card, p.theme) : p.kind === 'intro' ? intro(p.theme) : link(p.link, p.first, p.theme);
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
};
