// /.well-known/agents.txt: the location the IETF agents.txt draft proposes. Same file as /agents.txt.
import type { APIRoute } from 'astro';
import { agentsTxt } from '../agents.txt';
import { textResponse } from '../../lib/crawl-policy';

export const GET: APIRoute = () => textResponse(agentsTxt());
