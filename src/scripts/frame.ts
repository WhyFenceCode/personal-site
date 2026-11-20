export {}; // a module, so its names stay its own
/**
 * Browser frames (src/lib/frame.mjs), on project pages and in Markdown. An outside website loads only once Continue
 * is pressed; this site's own preview loads straight away. The site renders at desktop width (tablet width in the
 * portrait phone window) and is scaled to fit, so it shows its real layout for that screen.
 */
function setup(frame: HTMLElement) {
  if (frame.dataset.ready) return; frame.dataset.ready = '1';
  const iframe = frame.querySelector<HTMLIFrameElement>('[data-live]'); if (!iframe) return;
  const view = frame.querySelector<HTMLElement>('[data-view]')!, shield = frame.querySelector<HTMLElement>('[data-shield]');
  const state = frame.querySelector<HTMLElement>('[data-state]');
  // Already inside a preview of this site? Then loading the site again would nest it forever, so it stops with a note.
  let framed = true;
  try { framed = window.self !== window.top; } catch {}
  if (framed && iframe.hasAttribute('data-self')) {
    frame.classList.add('is-nested');
    shield?.removeAttribute('hidden');
    frame.querySelector('[data-nested]')?.removeAttribute('hidden');
    return;
  }
  const start = () => {
    iframe.loading = 'lazy';
    iframe.src = iframe.dataset.src!;
    iframe.removeAttribute('tabindex');
    frame.classList.add('is-live');
    if (state) state.lastChild!.textContent = state.dataset.on ?? '';
  };
  const fit = () => {
    const W = view.clientHeight > view.clientWidth ? 768 : 1440;
    const k = view.clientWidth / W;
    iframe.style.width = `${W}px`; iframe.style.height = `${view.clientHeight / k}px`; iframe.style.transform = `scale(${k})`;
  };
  fit(); new ResizeObserver(fit).observe(view);
  if (iframe.hasAttribute('data-self')) { start(); return; }
  frame.querySelector('[data-go]')?.addEventListener('click', () => { start(); shield?.remove(); iframe.focus(); });
}

document.addEventListener('astro:page-load', () => document.querySelectorAll<HTMLElement>('[data-frame]').forEach(setup));
