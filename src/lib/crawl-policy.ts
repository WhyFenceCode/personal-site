// The site's one crawl policy: search engines and AI search/answer agents may read everything; crawlers that
// only collect training data are turned away. robots.txt and agents.txt both print it, so they can't disagree.
// Content-Signal (contentsignals.org) says the same thing for crawlers that read it.
import { site } from './config';

// User agents whose only job is gathering model-training data. Their search/assistant siblings
// (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Googlebot, Applebot…) stay allowed.
export const trainingBots = [
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

/** The rules, in robots.txt syntax. `header` lines go first, as comments. */
export function crawlPolicy(header: string[]): string {
  return [
    ...header.map((l) => (l ? `# ${l}` : '')),
    '',
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no',
    'Allow: /',
    '',
    ...trainingBots.map((b) => `User-agent: ${b}`),
    'Disallow: /',
    '',
    `Sitemap: ${new URL('/sitemap.xml', site.url).href}`,
    '',
  ].join('\n');
}

export const textResponse = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
