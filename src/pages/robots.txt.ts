// /robots.txt: search engines and AI search/answer agents may crawl everything; crawlers that only collect
// training data are turned away. Content-Signal (contentsignals.org) says the same thing for crawlers that read it.
import type { APIRoute } from 'astro';
import { site } from '../lib/config';

// User agents whose only job is gathering model-training data. Their search/assistant siblings
// (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Googlebot, Applebot…) stay allowed.
const trainingBots = [
  'GPTBot',                        // OpenAI
  'ClaudeBot', 'anthropic-ai',     // Anthropic
  'Google-Extended',               // Gemini training (doesn't affect Google Search)
  'Applebot-Extended',             // Apple Intelligence training (doesn't affect Applebot search)
  'CCBot',                         // Common Crawl
  'Meta-ExternalAgent', 'FacebookBot',
  'Bytespider',                    // ByteDance
  'cohere-training-data-crawler',
  'Diffbot', 'Omgilibot', 'Timpibot', 'ImagesiftBot', 'PanguBot', 'AI2Bot',
];

export const GET: APIRoute = () => {
  const body = [
    '# Search indexing and AI search/answers: yes. AI model training: no.',
    '# See also /llms.txt.',
    '',
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no',
    'Allow: /',
    '',
    ...trainingBots.map((b) => `User-agent: ${b}`),
    'Disallow: /',
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', site.url).href}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
