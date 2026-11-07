// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { remarkSiteTokens } from './src/lib/remark-site-tokens.mjs';

const site = parse(readFileSync(new URL('./src/config/site.yaml', import.meta.url), 'utf8'));

export default defineConfig({
  site: site.url,
  integrations: [
    react(),
    // /sitemap-index.xml, linked from robots.txt. The root language redirect and the 404 aren't real pages.
    // The brand kit (/<lang>/brand/) is an internal reference page, so it stays out too.
    sitemap({
      filter: (page) => { const p = new URL(page).pathname; return p !== '/' && !p.startsWith('/404') && !/^\/[a-z]{2}\/brand\//.test(p); },
      i18n: site.languages.length > 1
        ? { defaultLocale: site.languages[0], locales: Object.fromEntries(site.languages.map((/** @type {string} */ l) => [l, l])) }
        : undefined,
    }),
  ],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
  // {{email}}, {{owner}}, {{address}}… in Markdown are filled from site.yaml at build time.
  markdown: { remarkPlugins: [remarkSiteTokens(site)] },
  vite: { plugins: [tailwindcss()] },
});
