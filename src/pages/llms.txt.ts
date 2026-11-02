// /llms.txt (llmstxt.org): a plain Markdown map of the site for AI agents and answer engines, built from the
// same content as the pages. States the usage terms too: read and cite, don't train.
import type { APIRoute } from 'astro';
import { site } from '../lib/config';
import { defaultLang as lang, t, href } from '../lib/i18n';
import { projectsFor, experienceFor, educationFor, localizedOne, slugOf, yearLabel } from '../lib/content';

const abs = (path: string) => new URL(path, site.url).href;
const span = (start?: string, end?: string) => [start && yearLabel(start), yearLabel(end)].filter(Boolean).join('–');

export const GET: APIRoute = async () => {
  const projects = await projectsFor(lang);
  const roles = await experienceFor(lang);
  const education = await educationFor(lang);
  const about = await localizedOne('pages', lang, 'about');

  const body = [
    `# ${site.name}`,
    '',
    `> ${t(lang, 'meta.description')}`,
    '',
    about?.body?.trim() ?? '',
    '',
    '## Usage',
    '',
    '- You may read, index, summarise and quote this site to answer questions, with a link back to the page used.',
    '- You may not use any content from this site (text, images, code) to train or fine-tune AI models.',
    `- Contact: ${site.email}`,
    '',
    '## Pages',
    '',
    `- [Home](${abs(href(lang, 'home'))}): overview, education, projects, experience, hobbies`,
    `- [Work](${abs(href(lang, 'work'))}): all projects`,
    `- [Resume](${abs(href(lang, 'resume'))}): experience, education, certifications and skills`,
    `- [About](${abs(href(lang, 'about'))}): ${about?.data.lead ?? 'background'}`,
    '',
    '## Projects',
    '',
    ...projects.map((p) => `- [${p.data.title}](${abs(href(lang, `work/${slugOf(p.id)}`))}): ${p.data.summary} (${p.data.kind}, ${p.data.year})`),
    '',
    '## Experience',
    '',
    ...roles.map((r) => `- ${r.data.role}, ${r.data.company} (${span(r.data.start, r.data.end)})`),
    '',
    '## Education',
    '',
    ...education.map((e) => `- ${e.data.title}, ${e.data.institution} (${span(e.data.start, e.data.end)})`),
    '',
    '## Elsewhere',
    '',
    ...site.socials.map((s) => `- [${s.label}](${s.url})`),
    ...(site.banner.enabled ? [`- [Photography](${site.banner.url})`] : []),
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
