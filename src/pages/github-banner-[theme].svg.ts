/**
 * /github-banner-light.svg and /github-banner-dark.svg: the banner on my GitHub profile README
 * (github.com/WhyFenceCode/WhyFenceCode), drawn in this site's style.
 *
 * A README can only show images, so this is one self-contained SVG: the fonts are embedded, the signature is
 * real outlines (like components/ui/Signature.astro) so it can write itself in, and the animation is CSS inside
 * the SVG, which still plays when GitHub shows it as an image. The README picks the light or dark file to match
 * the viewer's GitHub theme. After changing this, rebuild and copy both files into the profile repo.
 */
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';
import { site } from '../lib/config';
import { t } from '../lib/i18n';

export const getStaticPaths = () => [{ params: { theme: 'light' } }, { params: { theme: 'dark' } }];

const require = createRequire(import.meta.url);
const b64 = (pkgFile: string) => readFileSync(require.resolve(pkgFile)).toString('base64');
const display = b64('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2');
const mono = b64('@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2');

const THEMES = {
  light: { bg: '#E6E6E6', fg: '#0B0B0B', muted: '#555555', line: '#CBCBCB' },
  dark: { bg: '#161616', fg: '#FFFFFF', muted: '#A0A0A0', line: '#2E2E2E' },
} as const;
const ACCENT = '#7E76D0';

const W = 1280, H = 450, PAD = 48;

// The signature, letter by letter, scaled to sit in the bottom-right corner.
function signature(height: number, right: number, baseline: number) {
  const file = require.resolve('@fontsource/mrs-saint-delafield/files/mrs-saint-delafield-latin-400-normal.woff');
  const buf = readFileSync(file);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const FS = 200;
  const bb = font.getPath(site.name, 0, FS, FS).getBoundingBox();
  const s = height / (bb.y2 - bb.y1), w = (bb.x2 - bb.x1) * s;
  const x = right - w - bb.x1 * s, y = baseline - bb.y2 * s;
  const paths = font.getPaths(site.name, 0, FS, FS).map((p) => p.toPathData(2)).filter((d) => d.length > 0);
  return { paths, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(4)})`, left: right - w, width: w };
}

export const GET: APIRoute = ({ params }) => {
  const c = THEMES[params.theme as keyof typeof THEMES] ?? THEMES.light;
  const tagline = t('en', 'hero.tagline').replace(/<br\s*\/?>/g, ' · ');
  const host = new URL(site.url).host;
  const sig = signature(80, W - PAD, H - 56);
  const STEP = 0.2, n = sig.paths.length;

  // The wordmark: one line across the full width, condensed display type with the site's accent ring.
  const WM = { x: PAD, y: 270, size: 222, width: W - PAD * 2 }; // size: measured so the name fills the width at its natural spacing
  const word = (cls: string) =>
    `<text class="wm ${cls}" x="${WM.x}" y="${WM.y}" textLength="${WM.width}" lengthAdjust="spacing">${site.name.toUpperCase()}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${site.name}: ${tagline}">
<title>${site.name}</title>
<style>
@font-face { font-family: "Bricolage"; src: url(data:font/woff2;base64,${display}) format("woff2"); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: "DM Mono"; src: url(data:font/woff2;base64,${mono}) format("woff2"); font-weight: 500; }
.mono { font-family: "DM Mono", ui-monospace, monospace; font-size: 15px; letter-spacing: .14em; text-transform: uppercase; fill: ${c.muted}; }
.mono.fg { fill: ${c.fg}; }
.wm { font-family: "Bricolage", "Arial Narrow", sans-serif; font-weight: 800; font-stretch: 80%; font-size: ${WM.size}px; letter-spacing: -.02em; }
.wm.ring { fill: ${ACCENT}; stroke: ${ACCENT}; stroke-width: 19px; stroke-linejoin: round; }
.wm.gap { fill: ${c.bg}; stroke: ${c.bg}; stroke-width: 12px; stroke-linejoin: round; }
.wm.ink { fill: ${c.fg}; }
.rule { stroke: ${c.fg}; stroke-width: 1.5; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.1s cubic-bezier(.6,.1,.3,1) .1s forwards; }
.wmg { opacity: 0; transform: translateY(18px); animation: rise .9s cubic-bezier(.2,.8,.2,1) .25s forwards; }
.sig path { fill: ${c.fg}; fill-opacity: 0; stroke: ${c.fg}; stroke-width: 1.4; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: draw .55s cubic-bezier(.5,.1,.3,1) forwards, fill .35s ease forwards; }
${sig.paths.map((_, i) => `.sig path:nth-child(${i + 1}) { animation-delay: ${(1 + i * STEP).toFixed(2)}s, ${(1.4 + i * STEP).toFixed(2)}s; }`).join('\n')}
.flourish { fill: none; stroke: ${ACCENT}; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: draw .9s cubic-bezier(.6,.1,.3,1) ${(1.5 + n * STEP).toFixed(2)}s forwards; }
.dot { fill: ${ACCENT}; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes fill { to { fill-opacity: 1; stroke-opacity: 0; } }
@keyframes rise { to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .rule, .flourish { animation: none; stroke-dashoffset: 0; }
  .wmg { animation: none; opacity: 1; transform: none; }
  .sig path { animation: none; stroke-dashoffset: 0; fill-opacity: 1; stroke-opacity: 0; }
}
</style>
<rect width="${W}" height="${H}" fill="${c.bg}"/>
<text class="mono fg" x="${PAD}" y="${PAD + 10}">${site.name}<tspan class="dot" dx="2">.</tspan></text>
<text class="mono" x="${W - PAD}" y="${PAD + 10}" text-anchor="end">${t('en', 'hero.role')} · ${site.location.city}, ${site.location.region}</text>
<line class="rule" x1="${PAD}" y1="${PAD + 30}" x2="${W - PAD}" y2="${PAD + 30}" pathLength="1"/>
<g class="wmg">${word('ring')}${word('gap')}${word('ink')}</g>
<text class="mono" x="${PAD}" y="${H - 58}">${tagline}</text>
<text class="mono fg" x="${PAD}" y="${H - 34}">${host}</text>
<g class="sig" transform="${sig.transform}">${sig.paths.map((d) => `<path d="${d}" pathLength="1"/>`).join('')}</g>
<path class="flourish" pathLength="1" d="M${(sig.left + 8).toFixed(1)} ${H - 40} C ${(sig.left + sig.width * .25).toFixed(1)} ${H - 50}, ${(sig.left + sig.width * .5).toFixed(1)} ${H - 32}, ${(sig.left + sig.width * .72).toFixed(1)} ${H - 41} S ${(W - PAD - 4).toFixed(1)} ${H - 46}, ${(W - PAD).toFixed(1)} ${H - 44}"/>
</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
};
