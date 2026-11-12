// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { remarkSiteTokens } from './src/lib/remark-site-tokens.mjs';

const site = parse(readFileSync(new URL('./src/config/site.yaml', import.meta.url), 'utf8'));

// @astrojs/sitemap always writes sitemap-index.xml plus sitemap-0.xml, sitemap-1.xml…
// This merges them into one plain /sitemap.xml (fine up to 50,000 pages) and removes the rest.
// /sitemap-index.xml redirects to it (public/_redirects) for anything that still asks for the old address.
/** @type {import('astro').AstroIntegration} */
const singleSitemap = {
  name: 'single-sitemap',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const out = fileURLToPath(dir);
      const parts = readdirSync(out).filter((f) => /^sitemap-\d+\.xml$/.test(f)).sort();
      if (!parts.length) return;
      const xml = parts.map((f) => readFileSync(out + f, 'utf8'));
      const open = xml[0].match(/^[\s\S]*?<urlset[^>]*>/)?.[0];
      if (!open) return;
      const urls = xml.map((x) => x.replace(/^[\s\S]*?<urlset[^>]*>/, '').replace(/<\/urlset>\s*$/, '')).join('');
      writeFileSync(out + 'sitemap.xml', `${open}${urls}</urlset>`);
      for (const f of [...parts, 'sitemap-index.xml']) rmSync(out + f, { force: true });
    },
  },
};

export default defineConfig({
  site: site.url,
  integrations: [
    react(),
    // /sitemap.xml (merged by singleSitemap below), linked from robots.txt. The root language redirect and the 404 aren't real pages.
    // The brand kit (/<lang>/brand/) is an internal reference page, so it stays out too.
    sitemap({
      filter: (page) => { const p = new URL(page).pathname; return p !== '/' && !p.startsWith('/404') && !/^\/[a-z]{2}\/brand\//.test(p); },
      i18n: site.languages.length > 1
        ? { defaultLocale: site.languages[0], locales: Object.fromEntries(site.languages.map((/** @type {string} */ l) => [l, l])) }
        : undefined,
    }),
    singleSitemap, // must come after sitemap()
  ],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
  // {{email}}, {{owner}}, {{address}}… in Markdown are filled from site.yaml at build time.
  markdown: { remarkPlugins: [remarkSiteTokens(site)] },
  vite: { plugins: [tailwindcss()] },
});
