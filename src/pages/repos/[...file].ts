// /repos/<owner>/<name>/<path>.html: one file of a repository shown in a repo viewer (src/lib/repos.mjs), as a fragment
// of HTML the viewer fetches when the file is opened. Made at build time for every repo the content uses, so a visitor's
// browser only ever talks to this site. Not pages in their own right: kept out of search (public/_headers).
import type { APIRoute } from 'astro';
import { getRepo, viewable, fileHtml, reposInContent } from '../../lib/repos.mjs';

export async function getStaticPaths() {
  const paths = [];
  for (const spec of reposInContent()) {
    const repo = await getRepo(spec);
    if (!repo) continue;
    for (const f of viewable(repo)) paths.push({ params: { file: `${repo.owner}/${repo.name}/${f.path}.html` }, props: { spec, path: f.path } });
  }
  return paths;
}

export const GET: APIRoute = async ({ props }) => {
  const repo = await getRepo(props.spec);
  const html = repo ? await fileHtml(repo, props.path) : null;
  return new Response(html ?? '<p class="rv-note">This file can\'t be shown here.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
