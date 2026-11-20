// Captures a desktop screenshot of every project that has `live:` set in its frontmatter, and saves it to
// src/assets/screenshots/:
//   <slug>.jpg         desktop, 1440×900 (16:10), in the browser frame on the project page
//   <slug>-card.jpg    1200×900 (4:3, the card's shape), on the project cards and the home page hover peek
//   <slug>-tablet.jpg  768×1024, in the browser frame on phones
// They become the project's cover when it has no `cover:` of its own.
//
//   pnpm shots            capture missing screenshots
//   pnpm shots --all      re-capture every live project
//   pnpm shots orbit      re-capture one project by its file name
//
// Commit the images. This runs on your machine (not during the hosted build), so builds stay fast.
import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from 'yaml';
import { chromium } from 'playwright';

const ROOT = 'src/content/projects';
const OUT = 'src/assets/screenshots';
const args = process.argv.slice(2);
const all = args.includes('--all');
const only = args.filter((a) => !a.startsWith('--'));

const projects = new Map();
for (const lang of readdirSync(ROOT)) {
  for (const file of readdirSync(join(ROOT, lang)).filter((f) => f.endsWith('.md'))) {
    const fm = readFileSync(join(ROOT, lang, file), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const data = fm ? parse(fm[1]) : {};
    const slug = basename(file, '.md');
    if (data?.live && !projects.has(slug)) projects.set(slug, data.live);
  }
}

const missing = (slug) => ['', '-card', '-tablet'].some((s) => !existsSync(join(OUT, `${slug}${s}.jpg`)));
const todo = [...projects].filter(([slug]) => (only.length ? only.includes(slug) : all || missing(slug)));
if (!todo.length) { console.log('[shots] nothing to do (use --all to re-capture)'); process.exit(0); }

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
// Card-shaped: the project cards are 4:3, so the site is rendered in a 4:3 window (responsive sites lay out to it)
// rather than cropping a widescreen capture.
const CARD = { width: 1200, height: 900 };
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const cardPage = await browser.newPage({ viewport: CARD, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const tabletPage = await browser.newPage({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
let failed = 0;
for (const [slug, url] of todo) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500); // let fonts, images and intro animations settle
    await page.screenshot({ path: join(OUT, `${slug}.jpg`), type: 'jpeg', quality: 82 });
    // 4:3 version for the project cards.
    await cardPage.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await cardPage.waitForTimeout(1500);
    await cardPage.screenshot({ path: join(OUT, `${slug}-card.jpg`), type: 'jpeg', quality: 82 });
    // Portrait tablet version for the project window on phones.
    await tabletPage.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await tabletPage.waitForTimeout(1500);
    await tabletPage.screenshot({ path: join(OUT, `${slug}-tablet.jpg`), type: 'jpeg', quality: 82 });
    console.log(`[shots] ${slug} ← ${url}`);
  } catch (e) {
    failed++;
    console.warn(`[shots] ${slug} failed: ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
