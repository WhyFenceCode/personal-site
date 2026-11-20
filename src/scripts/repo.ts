export {}; // a module, so its names stay its own
/**
 * Repo viewers (src/lib/repos.mjs): click a file in the tree to open it. Files are small HTML pages on this site,
 * made at build time, fetched the first time they're opened and kept for the rest of the visit. Links inside a README
 * that point at another file in the repo open it here too. On phones the tree folds away behind a "Files" button.
 */
const cache = new Map<string, Promise<string>>();
const NOTES: Record<string, string> = {
  big: 'This file is too large to show here.',
  bin: 'This file can’t be shown here.',
  more: 'This repository has more files than are shown here.',
};
const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');

function setup(rv: HTMLElement) {
  if (rv.dataset.ready) return; rv.dataset.ready = '1';
  const base = rv.dataset.base!, gh = rv.dataset.gh!, branch = rv.dataset.branch!;
  const content = rv.querySelector<HTMLElement>('[data-rv-content]')!, pathEl = rv.querySelector<HTMLElement>('[data-rv-path]')!;
  const ghLink = rv.querySelector<HTMLAnchorElement>('[data-rv-gh]')!, readme = rv.querySelector<HTMLTemplateElement>('[data-rv-readme]');
  const tree = rv.querySelector<HTMLElement>('[data-rv-tree]')!, toggle = rv.querySelector<HTMLButtonElement>('[data-rv-toggle]')!;
  let seq = 0;

  const mark = (path: string) => rv.querySelectorAll<HTMLButtonElement>('.rv-file').forEach((b) => b.toggleAttribute('aria-current', b.dataset.path === path));
  const reveal = (path: string) => {
    const btn = rv.querySelector<HTMLButtonElement>(`.rv-file[data-path="${CSS.escape(path)}"]`);
    for (let d = btn?.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
    return btn;
  };

  async function open(path: string, kind?: string) {
    const n = ++seq;
    mark(path);
    const showing = path || rv.dataset.readme || '';
    pathEl.textContent = showing;
    ghLink.href = path ? `${gh}/blob/${encodeURIComponent(branch)}/${enc(path)}` : rv.dataset.readme ? `${gh}/blob/${encodeURIComponent(branch)}/${enc(rv.dataset.readme)}` : gh;
    if (!path) { content.innerHTML = readme?.innerHTML ?? ''; content.scrollTop = 0; return; }
    kind ??= reveal(path)?.dataset.kind;
    if (kind && NOTES[kind]) { content.innerHTML = `<p class="rv-note">${NOTES[kind]} <a href="${ghLink.href}" rel="noopener">Open it on GitHub ↗</a></p>`; return; }
    rv.classList.add('rv-loading');
    if (!cache.has(path + base)) cache.set(path + base, fetch(`${base}${enc(path)}.html`).then((r) => (r.ok ? r.text() : Promise.reject(r.status))));
    try {
      const html = await cache.get(path + base)!;
      if (n !== seq) return; // another file was picked meanwhile
      content.innerHTML = html; content.scrollTop = 0;
    } catch {
      cache.delete(path + base);
      if (n === seq) content.innerHTML = `<p class="rv-note">Couldn’t load this file. <a href="${ghLink.href}" rel="noopener">Open it on GitHub ↗</a></p>`;
    } finally { if (n === seq) rv.classList.remove('rv-loading'); }
  }

  tree.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.rv-file'); if (!b) return;
    open(b.dataset.path ?? '', b.dataset.kind);
    if (rv.classList.contains('rv-narrow')) setOpen(false);
  });
  content.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-repo-open]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); open(a.dataset.repoOpen!); content.focus({ preventScroll: true });
  });

  // Narrow: the tree folds behind a button. Wide: always shown.
  const setOpen = (on: boolean) => { toggle.setAttribute('aria-expanded', String(on)); rv.classList.toggle('rv-tree-open', on); };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  const fit = () => { const narrow = rv.clientWidth < 720; rv.classList.toggle('rv-narrow', narrow); toggle.hidden = !narrow; if (!narrow) setOpen(false); };
  new ResizeObserver(fit).observe(rv); fit();
}

document.addEventListener('astro:page-load', () => document.querySelectorAll<HTMLElement>('[data-repo-viewer]').forEach(setup));
