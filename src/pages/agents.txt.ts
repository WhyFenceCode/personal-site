// /agents.txt (also at /.well-known/agents.txt): the same policy as robots.txt, for AI agents that look here.
// agents.txt is still only a draft (no agreed format, no major crawler reads it yet), so it repeats robots.txt
// word for word in robots syntax. robots.txt remains the file that is actually enforced.
import type { APIRoute } from 'astro';
import { crawlPolicy, textResponse } from '../lib/crawl-policy';

export const agentsTxt = () => crawlPolicy([
  'agents.txt: what AI agents may do on this site.',
  'Reading, searching, answering questions and citing with a link: yes.',
  'Using any of this content to train AI models: no.',
  'Same rules as /robots.txt. A map of the site for agents: /llms.txt.',
]);

export const GET: APIRoute = () => textResponse(agentsTxt());
