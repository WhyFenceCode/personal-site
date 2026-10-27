/**
 * Fills {{placeholders}} in Markdown (legal pages, mainly) from site.yaml at build time, so contact
 * details and facts about the site can never drift out of date.
 *
 *   {{owner}} {{email}} {{url}} {{city}} {{region}} {{country}} {{updated}} {{hosting}} {{analytics}}
 *   {{embeds}}   the other websites that project pages show in a live frame (from projects' `live:`), as a list
 *   {{address}}  replaced by the address; when site.yaml has no address, the whole paragraph containing it
 *                is dropped (so a line like "Postal address: {{address}}" disappears cleanly).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Hosts of every project with a `live:` site that may be shown in a frame (not `preview: false`, not this site). */
function embedHosts(siteUrl) {
  const root = 'src/content/projects';
  if (!existsSync(root)) return [];
  const own = siteUrl ? new URL(siteUrl).host : '';
  const hosts = new Set();
  for (const lang of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(join(root, lang.name)).filter((n) => n.endsWith('.md'))) {
      const fm = readFileSync(join(root, lang.name, f), 'utf8').split(/^---\s*$/m)[1] ?? '';
      const live = fm.match(/^live:\s*["']?([^"'\s]+)/m)?.[1];
      if (!live || /^preview:\s*false\b/m.test(fm)) continue;
      try { const h = new URL(live).host; if (h !== own) hosts.add(h); } catch {}
    }
  }
  return [...hosts].sort();
}

export function remarkSiteTokens(site) {
  const legal = site.legal ?? {};
  const address = (legal.address ?? []).map(String).map((s) => s.trim()).filter(Boolean);
  const updated = legal.updated
    ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(legal.updated))
    : '';
  const provider = site.analytics?.provider ?? 'none';
  const analyticsNames = { cloudflare: 'Cloudflare Web Analytics', plausible: 'Plausible Analytics', umami: 'Umami', goatcounter: 'GoatCounter' };
  const analytics = provider === 'none'
    ? 'This site does not use any analytics or visitor statistics.'
    : `This site uses ${analyticsNames[provider] ?? provider}, a cookieless statistics service that counts visits without identifying you or following you across sites.${site.analytics?.consent ? ' It only loads after you allow it.' : ''}`;
  const tokens = {
    owner: legal.owner ?? site.name ?? '',
    email: site.email ?? '',
    url: site.url ?? '',
    city: site.location?.city ?? '',
    region: site.location?.region ?? '',
    country: site.location?.country ?? '',
    updated,
    hosting: legal.hosting || 'the hosting provider',
    analytics,
    address: address.join(', '),
    embeds: embedHosts(site.url).join(', ') || 'none at the moment',
  };
  const fill = (s) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));

  return () => (tree) => {
    const walk = (node, parent) => {
      if (node.type === 'paragraph' && parent && !address.length) {
        const text = (node.children ?? []).map((c) => c.value ?? '').join('').trim();
        if (/\{\{\s*address\s*\}\}/.test(text)) { parent.children.splice(parent.children.indexOf(node), 1); return true; }
      }
      if (typeof node.value === 'string' && (node.type === 'text' || node.type === 'inlineCode')) node.value = fill(node.value);
      if (node.type === 'link' && typeof node.url === 'string') node.url = fill(node.url);
      if (node.children) for (let i = 0; i < node.children.length; i++) if (walk(node.children[i], node)) i--;
      return false;
    };
    walk(tree, null);
  };
}
