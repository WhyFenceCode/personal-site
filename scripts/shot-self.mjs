// Screenshot of this site for its own project card, with motion on: waits for the intro, then drags across
// the name almost far enough to dive, and captures the ink revealing the next layer just before it takes over.
//
//   pnpm shots:self                 the live site (url in site.yaml)
//   pnpm shots:self --local         a running `pnpm dev` (http://localhost:4321)
//   pnpm shots:self --slug=name     save as src/assets/screenshots/<name>.jpg (default: personalsite)
import { readFileSync, mkdirSync } from 'node:fs';
import { parse } from 'yaml';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const site = parse(readFileSync('src/config/site.yaml', 'utf8'));
const url = args.includes('--local') ? 'http://localhost:4321/en/' : `${site.url.replace(/\/$/, '')}/en/`;
const slug = args.find((a) => a.startsWith('--slug='))?.slice(7) ?? 'personalsite';
const hero = parse(readFileSync('src/config/hero.yaml', 'utf8'));
const OUT = 'src/assets/screenshots';

// WebGL in headless Chromium needs the software renderer.
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  // The intro loader runs on every fresh open; wait for it to finish and for the hero's layers to be ready.
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro'), null, { timeout: 20000 });
  await page.waitForSelector('.gl-ready', { timeout: 20000 });
  await page.waitForTimeout(600);

  const box = await page.locator('.gl-ready').boundingBox();
  if (!box) throw new Error('hero not found');
  const label = () => page.locator('[data-layer-label]').textContent();
  const before = await label();

  // One long stroke from right to left with a gentle downward curve, starting left of centre. It covers 90% of the
  // swipe distance that commits a dive (hero.yaml `dive` × width): the ink spreads wide, the layer doesn't flip.
  // (Catching the flood itself doesn't work: it's over in ~0.75s, faster than a headless screenshot.)
  const budget = box.width * (hero.dive ?? 0.45) * 0.9;
  const cx = box.x + box.width * 0.42, cy = box.y + box.height * 0.5;
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    pts.push([cx + budget * 0.5 - budget * t, cy - box.height * 0.06 + Math.sin(t * Math.PI) * box.height * 0.12]);
  }
  await page.mouse.move(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) { await page.mouse.move(x, y); await page.waitForTimeout(16); }
  await page.waitForTimeout(450); // let the ink catch up with the pointer
  if ((await label()) !== before) console.warn('[shots:self] the layer flipped during the swipe; run it again');
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${slug}.jpg`, type: 'jpeg', quality: 85 });
  console.log(`[shots:self] ${slug} ← ${url}`);
} catch (e) {
  console.error(`[shots:self] failed: ${e.message.split('\n')[0]}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
