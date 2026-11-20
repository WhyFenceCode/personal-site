// /github/README.md: the GitHub profile README, ready to copy into the profile repo (with dist/github/*.svg in its
// assets/). Built from site.yaml → github by src/lib/github-profile.ts; previewed at /<lang>/docs/github-preview/.
import type { APIRoute } from 'astro';
import { readmeHtml } from '../../lib/github-profile';

export const GET: APIRoute = () =>
  new Response(readmeHtml({ src: 'assets/' }), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
