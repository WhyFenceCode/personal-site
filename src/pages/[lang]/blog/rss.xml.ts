// /<lang>/blog/rss.xml: the blog as an RSS feed, so people can follow it in a feed reader (Feedly, NetNewsWire…).
// Each item carries the whole post, with its links and images made absolute so they work outside the site.
// /rss.xml and /feed redirect here (public/_redirects); every page links to it in its <head> for auto-discovery.
import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { site } from '../../../lib/config';
import { postsFor, slugOf } from '../../../lib/content';
import { languages, t, href } from '../../../lib/i18n';

export const getStaticPaths = () => languages.map((lang) => ({ params: { lang } }));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as string;
  const abs = (path: string) => new URL(path, site.url).href;
  const posts = (await postsFor(lang)).slice(0, 30);
  const container = await AstroContainer.create();

  const items = await Promise.all(posts.map(async (p) => {
    const url = abs(href(lang, `blog/${slugOf(p.id)}`));
    let html = '';
    try {
      const { Content } = await render(p);
      html = (await container.renderToString(Content))
        // Site-relative links and images ("/_astro/…", "/en/…", "#section") → full addresses.
        .replace(/(href|src)="(\/[^"]*)"/g, (_, a, v) => `${a}="${abs(v)}"`)
        .replace(/href="#([^"]*)"/g, (_, h) => `href="${url}#${h}"`)
        .replace(/srcset="([^"]*)"/g, (_, v) => `srcset="${v.replace(/(^|,\s*)(\/[^\s,]+)/g, (_m: string, sep: string, u: string) => sep + abs(u))}"`)
        .replace(/<a [^>]*class="h-anchor"[^>]*>#<\/a>/g, ''); // the hover "#" links mean nothing in a reader
    } catch { html = ''; }
    return [
      '    <item>',
      `      <title>${esc(p.data.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${p.data.date.toUTCString()}</pubDate>`,
      `      <description>${esc(p.data.summary)}</description>`,
      ...p.data.tags.map((tag) => `      <category>${esc(tag)}</category>`),
      html ? `      <content:encoded>${cdata(html)}</content:encoded>` : '',
      '    </item>',
    ].filter(Boolean).join('\n');
  }));

  const self = abs(`/${lang}/blog/rss.xml`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${esc(`${site.name} · ${t(lang, 'nav.blog')}`)}</title>
    <link>${abs(href(lang, 'blog'))}</link>
    <atom:link href="${self}" rel="self" type="application/rss+xml" />
    <description>${esc(t(lang, 'blog.lead'))}</description>
    <language>${lang}</language>
    ${posts[0] ? `<lastBuildDate>${posts[0].data.date.toUTCString()}</lastBuildDate>` : ''}
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
