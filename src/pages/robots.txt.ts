// /robots.txt: search engines and AI search/answer agents may crawl everything; crawlers that only collect
// training data are turned away. The rules live in src/lib/crawl-policy.ts (shared with /agents.txt).
import type { APIRoute } from 'astro';
import { crawlPolicy, textResponse } from '../lib/crawl-policy';

export const GET: APIRoute = () => textResponse(crawlPolicy([
  'Search indexing and AI search/answers: yes. AI model training: no.',
  'See also /llms.txt and /agents.txt.',
]));
