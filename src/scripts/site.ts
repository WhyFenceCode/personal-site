/**
 * Site-wide behaviour. Things that live across page swaps (cursor circle, page transitions)
 * are set up once; things tied to the page's DOM run again on every `astro:page-load`.
 */
import { navigate } from 'astro:transitions/client';
import { flood, floodClear, floodDraw, floodPrepare } from './flood';
import { motionOn, setMotion, onMotion } from './motion';
import { differenceInk } from './gl';
import { paintArt } from './art';
import { initCards } from './cards';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const announce = (msg: string) => { const a = $('#announcer'); if (!a) return; a.textContent = ''; requestAnimationFrame(() => (a.textContent = msg)); };

/* ---------- Fit wordmarks to their container width ---------- */
export function fitAll() {
  $$('.fit').forEach((el) => {
    if (!el.offsetParent) return;
    const box = el.parentElement!.clientWidth; if (!box) return;
    el.style.fontSize = '100px';
    const w = el.getBoundingClientRect().width; if (!w) return;
    el.style.fontSize = `${Math.floor(((100 * box) / w) * 1000) / 1000}px`;
  });
  window.dispatchEvent(new CustomEvent('site:fit'));
}
let fitTimer = 0;
addEventListener('resize', () => { cancelAnimationFrame(fitTimer); fitTimer = requestAnimationFrame(fitAll); });
document.fonts?.ready.then(fitAll);

/* ---------- Cursor dot (persists across pages) ----------
   Sits exactly on the pointer (no lag, so pointing stays precise) and grows over anything clickable.
   The system cursor is only hidden once the dot is tracking a real mouse (class ring-live), and CSS keeps it
   in high-contrast modes. Over an embedded site (iframe) the dot hides and that page's own cursor shows. */
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const ring = $('#ring')!;
let mx = -100, my = -100, rs = 0.3, rsT = 0.3;
if (document.body.dataset.ring === 'true') {
  const root = document.documentElement;
  root.classList.toggle('has-ring', fine.matches);
  const hide = () => { ring.classList.remove('on'); root.classList.remove('ring-live'); };
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; mx = e.clientX; my = e.clientY; ring.classList.add('on'); root.classList.add('ring-live'); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const el = e.target as Element;
    if (el.closest?.('iframe')) { hide(); return; }
    rsT = el.closest?.('a, button, select, label, [role="tab"], input, [data-ring]') ? 1 : 0.3;
  });
  root.addEventListener('pointerleave', hide);
  addEventListener('blur', hide);
  const loop = () => {
    rs += (rsT - rs) * (motionOn() ? 0.25 : 1);
    ring.style.transform = `translate3d(${mx}px, ${my}px, 0) scale(${rs})`;
    requestAnimationFrame(loop);
  };
  loop();
}

/* ---------- Scroll progress ring (persists across pages) ---------- */
const progress = $<HTMLButtonElement>('#progress');
if (progress) {
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    progress.style.setProperty('--p', p.toFixed(4));
    progress.classList.toggle('on', max > innerHeight * 0.25 && scrollY > 8);
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  document.addEventListener('astro:page-load', queue);
  new ResizeObserver(queue).observe(document.body);
  progress.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: motionOn() ? 'smooth' : 'auto' });
    $('#main')?.focus({ preventScroll: true });
  });
}

/* ---------- Page transitions: ink covers from the click, opens from the centre ---------- */
let lastClick: [number, number] = [innerWidth / 2, innerHeight / 2];
let covered = false;
addEventListener('pointerdown', (e) => (lastClick = [e.clientX, e.clientY]), true);
const transitionsOn = () => document.body.dataset.transitions === 'true' && motionOn();
document.addEventListener('astro:before-preparation', (ev: any) => {
  closeMenu(false);
  if (!transitionsOn()) return;
  const load = ev.loader;
  ev.loader = async () => { covered = true; await Promise.all([flood('cover', lastClick[0], lastClick[1], 560), load()]); };
});
document.addEventListener('astro:after-swap', () => {
  // A closed banner stays closed while moving between pages, and comes back on the next fresh open.
  if ((window as { __bannerClosed?: boolean }).__bannerClosed) document.documentElement.classList.add('banner-hidden');
  if (!covered) return;
  floodDraw('cover', 1e5, innerWidth / 2, innerHeight / 2);
  requestAnimationFrame(() => flood('reveal', innerWidth / 2, innerHeight / 2, 720).then(() => { floodClear(); covered = false; }));
});

/* ---------- Intro (every fresh open of the site; see the inline script in Base.astro) ---------- */
async function runIntro() {
  const root = document.documentElement;
  if (!root.classList.contains('intro')) return;
  const num = $('#ld-num'), log = $('#ld-log'), ui = $('#ld-ui');
  if (!num || !ui) { root.classList.remove('intro'); return; }
  const steps: string[] = JSON.parse(ui.dataset.steps || '[]');
  let skip = false;
  $('#ld-skip')?.addEventListener('click', () => (skip = true), { once: true });
  floodPrepare();
  const cx = innerWidth / 2, cy = innerHeight / 2, base = Math.min(innerWidth, innerHeight) * 0.26, t0 = performance.now(), dur = 2100;
  while (true) {
    const p = skip ? 1 : Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    num!.textContent = String(Math.round(e * 100));
    if (log && steps.length) log.textContent = steps[Math.min(steps.length - 1, Math.floor(e * (steps.length - 1) + 0.001))];
    floodDraw('cover', base * e, cx, cy);
    if (p >= 1) break;
    await new Promise((r) => requestAnimationFrame(r));
  }
  try { await flood('cover', cx, cy, 480, base); root.classList.remove('intro'); await flood('reveal', cx, cy, 800); }
  finally { root.classList.remove('intro'); floodClear(); }
  window.dispatchEvent(new CustomEvent('site:intro-done'));
}

/* ---------- Menu ---------- */
function openMenu() {
  const menu = $('#menu'), btn = $('#menu-btn'); if (!menu || !btn) return;
  const r = btn.getBoundingClientRect();
  menu.style.setProperty('--mx', `${r.left + r.width / 2}px`); menu.style.setProperty('--my', `${r.top + r.height / 2}px`);
  menu.hidden = false; void menu.offsetWidth; menu.classList.add('open');
  btn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden';
  $('#menu-close')?.focus();
}
function closeMenu(refocus = true) {
  const menu = $('#menu'); if (!menu || menu.hidden) return;
  menu.classList.remove('open'); $('#menu-btn')?.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
  setTimeout(() => { menu.hidden = true; if (refocus) $('#menu-btn')?.focus(); }, motionOn() ? 600 : 0);
}

/* ---------- Delegated handlers (survive page swaps) ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target as Element;
  const row = t.closest<HTMLButtonElement>('.row-btn');
  if (row) { const open = row.getAttribute('aria-expanded') !== 'true'; row.setAttribute('aria-expanded', String(open)); row.closest('.row')?.classList.toggle('open', open); return; }
  if (t.closest('#menu-btn')) return openMenu();
  if (t.closest('#menu-close')) return closeMenu();
  const langLink = t.closest<HTMLAnchorElement>('[data-lang-link]');
  if (langLink) { try { localStorage.setItem('site.lang', langLink.dataset.langLink!); } catch {} }
  const copy = t.closest<HTMLButtonElement>('[data-copy]');
  if (copy) {
    const label = copy.querySelector('[data-copy-label]') ?? copy, original = label.textContent, done = copy.dataset.copied || 'Copied';
    try { await navigator.clipboard.writeText(copy.dataset.copy!); label.textContent = done; announce(done); }
    catch { const target = document.getElementById(copy.dataset.copyTarget || ''); if (target) { const r = document.createRange(); r.selectNodeContents(target); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); } }
    setTimeout(() => (label.textContent = original), 2000);
    return;
  }
  if (t.closest('[data-motion-toggle]')) { setMotion(!motionOn()); syncMotionLabels(); announce(motionOn() ? 'Motion on' : 'Motion off'); return; }
  const pause = t.closest<HTMLButtonElement>('[data-marquee-pause]');
  if (pause) { const m = pause.closest('.marquee')!; const p = m.classList.toggle('paused'); pause.setAttribute('aria-pressed', String(p)); pause.textContent = p ? pause.dataset.play! : pause.dataset.pause!; return; }
  const bannerClose = t.closest('[data-banner-close]');
  if (bannerClose) { (window as { __bannerClosed?: boolean }).__bannerClosed = true; document.documentElement.classList.add('banner-hidden'); return; }
  if (t.closest('[data-open-cookies]')) { const c = $('#cookies'); if (c) { c.hidden = false; c.querySelector('button')?.focus(); } return; }
  const ck = t.closest<HTMLElement>('[data-ck]');
  if (ck) { try { localStorage.setItem('site.consent', ck.dataset.ck!); } catch {} $('#cookies')!.hidden = true; if (ck.dataset.ck === 'accept') loadAnalytics(); }
});
document.addEventListener('change', (e) => {
  const sel = (e.target as Element).closest<HTMLSelectElement>('[data-lang-select]');
  if (sel) navigate(sel.value);
});
document.addEventListener('keydown', (e) => {
  const menu = $('#menu');
  if (!menu || menu.hidden) return;
  if (e.key === 'Escape') closeMenu();
  if (e.key === 'Tab') {
    const f = $$<HTMLElement>('a, button, select', menu), first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

function syncMotionLabels() { $$('[data-motion-toggle]').forEach((b) => (b.textContent = `Motion: ${motionOn() ? 'on' : 'off'}`)); }
onMotion(syncMotionLabels);

/* ---------- Analytics only after consent ---------- */
function loadAnalytics() {
  const c = $('#cookies'); if (!c || document.getElementById('analytics')) return;
  const cfg = JSON.parse(c.dataset.analytics || 'null') as { src: string; attrs: Record<string, string> } | null;
  if (!cfg) return;
  const s = document.createElement('script');
  s.id = 'analytics'; s.defer = true; s.src = cfg.src;
  for (const [k, v] of Object.entries(cfg.attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
}
function initConsent() {
  const c = $('#cookies'); if (!c) return;
  let v: string | null = null; try { v = localStorage.getItem('site.consent'); } catch {}
  if (v === 'accept') loadAnalytics(); else if (!v) c.hidden = false;
}

/* ---------- Live clock ---------- */
let clockTimer = 0;
function initClock() {
  clearInterval(clockTimer);
  const els = $$('[data-clock]'); if (!els.length) return;
  const tick = () => els.forEach((el) => (el.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: el.dataset.clock || undefined }).format(new Date())));
  tick(); clockTimer = window.setInterval(tick, 20000);
}

/* ---------- Project index: a preview follows the pointer ----------
   pointerleave alone can miss: clicking a project swaps the page under the pointer, and scrolling moves a row
   away without the mouse moving. So the preview also hides whenever the pointer isn't over a project row,
   on scroll, on click, when the page changes and when the window loses focus. */
let peekLoop = 0, tx = 0, ty = 0;
const hidePeek = () => $('#peek')?.classList.remove('on');
addEventListener('pointermove', (e) => {
  tx = e.clientX + 28; ty = e.clientY - 110;
  if (!(e.target as Element).closest?.('[data-peek]')) hidePeek();
}, { passive: true });
addEventListener('scroll', hidePeek, { passive: true });
addEventListener('pointerdown', hidePeek, true);
addEventListener('blur', hidePeek);
document.addEventListener('astro:before-preparation', hidePeek);
document.addEventListener('astro:after-swap', hidePeek);
document.documentElement.addEventListener('pointerleave', hidePeek);
function initPeek() {
  const peek = $('#peek'); if (!peek || !fine.matches) return;
  const cv = $<HTMLCanvasElement>('canvas', peek)!, img = $<HTMLImageElement>('img', peek)!;
  let x = tx, y = ty;
  $$('[data-peek]').forEach((a) => {
    a.addEventListener('pointerenter', () => {
      // Screenshots keep their own proportions at the fixed preview height; placeholder art stays 4:3.
      if (a.dataset.peekSrc) { img.src = a.dataset.peekSrc; img.hidden = false; cv.hidden = true; peek.style.width = `${Math.round(225 * (Number(a.dataset.peekRatio) || 4 / 3))}px`; }
      else { paintArt(cv, a.dataset.peek!); img.hidden = true; cv.hidden = false; peek.style.width = ''; }
      peek.classList.add('on');
    });
    a.addEventListener('pointerleave', hidePeek);
  });
  cancelAnimationFrame(peekLoop);
  const loop = () => { const k = motionOn() ? 0.14 : 1; x += (tx - x) * k; y += (ty - y) * k; peek.style.transform = `translate3d(${x}px, ${y}px, 0)`; peekLoop = requestAnimationFrame(loop); };
  loop();
}

/* ---------- Links to other sites open in a new tab (and say so to screen readers) ---------- */
function initExternalLinks() {
  $$<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
    let url: URL;
    try { url = new URL(a.href); } catch { return; }
    if (url.origin === location.origin || a.dataset.ext) return;
    a.dataset.ext = '1';
    a.target = '_blank';
    a.rel = [...new Set([...(a.rel || '').split(/\s+/).filter(Boolean), 'noopener', 'noreferrer'])].join(' ');
    const note = document.createElement('span');
    note.className = 'sr-only'; note.textContent = ' (opens in a new tab)';
    a.appendChild(note);
  });
}

/* ---------- Per-page setup ---------- */
let stopFooterInk: () => void = () => {};
document.addEventListener('astro:page-load', () => {
  fitAll();
  document.fonts?.ready.then(fitAll);
  syncMotionLabels();
  initClock();
  initConsent();
  initPeek();
  initCards();
  initExternalLinks();
  $$<HTMLCanvasElement>('canvas[data-art]').forEach((cv) => paintArt(cv, cv.dataset.art!, cv.hasAttribute('data-dither')));
  stopFooterInk();
  // Ink only over the big footer name: never over the legal, contact or navigation links.
  const mark = $('#footer [data-ink="footer"]'); if (mark) stopFooterInk = differenceInk(mark, { wander: false });
  try { const l = document.documentElement.lang; if (!localStorage.getItem('site.lang')) localStorage.setItem('site.lang', l); } catch {}
});
document.addEventListener('astro:before-swap', () => { stopFooterInk(); stopFooterInk = () => {}; });

runIntro();
