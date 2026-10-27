// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const site = parse(readFileSync(new URL('./src/config/site.yaml', import.meta.url), 'utf8'));

export default defineConfig({
  site: site.url,
  integrations: [react()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
  vite: { plugins: [tailwindcss()] },
});
