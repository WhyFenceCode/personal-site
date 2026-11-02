/**
 * "Watch it build" (site.yaml interactive.build).
 *
 * - Shift+B or Cmd/Ctrl+B anywhere opens /<lang>/interact/ as a fresh load, so the loader plays; the home page also
 *   shows a small hint (bottom left) until you scroll.
 * - On /interact, accent cursors circle the loader's ink blob. When it opens, they build the page: each piece is
 *   drawn as a wireframe box (a cursor drags it from corner to corner), then its content appears. The page scrolls
 *   down on its own as they work. Anything already built can be used.
 * - Scroll yourself (wheel, touch, keys, scrollbar) and the rest swipes in, the cursors fly off, and the address
 *   becomes the home page's. The same happens when they finish.
 * - With motion off, /interact is just the home page.
 */
import { motionOn } from './motion';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const on = () => (document.body.dataset.ix ?? '').split(' ').includes('build');
const lang = () => document.documentElement.lang || 'en';
const root = document.documentElement;

/* ---------- Shortcut and home hint ---------- */
addEventListener('keydown', (e) => {
  if (!on() || e.key.toLowerCase() !== 'b' || e.altKey || e.repeat || !(e.shiftKey || e.metaKey || e.ctrlKey)) return;
  if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
  location.assign(`/${lang()}/interact/`);
});
addEventListener('scroll', () => { if (scrollY > 40) $('[data-build-hint]')?.classList.add('gone'); }, { passive: true });

/* ---------- The build ---------- */
type Block = { el: HTMLElement; wire?: HTMLElement; done: boolean; busy: boolean };
type Cur = { el: HTMLElement; x: number; y: number; vx: number; vy: number; tx: number; ty: number; job: Job | null; i: number; wob: number };
type Job = { b: Block; phase: 'fly' | 'drag'; t0: number; dur: number; x0: number; y0: number; w: number; h: number };

const N = 9;
const ARROW = '<svg width="20" height="24" viewBox="0 0 20 24"><path d="M2 2v17l5-4.6 3.4 7.4 3.2-1.5-3.4-7.2H17z" fill="var(--accent)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';

/** The pieces the cursors build, top to bottom: header parts, the name block's rows, each section's heading,
 *  its contents (a grid's items one by one) and its link, then the footer's parts. */
function blocks(): HTMLElement[] {
  const out: HTMLElement[] = [];
  const add = (el: Element | null) => { if (el instanceof HTMLElement && el.offsetHeight > 4) out.push(el); };
  const spread = (el: Element) => {
    const d = getComputedStyle(el).display;
    if ((d.includes('grid') || d.includes('flex')) && el.children.length >= 2 && el.children.length <= 24) [...el.children].forEach(add);
    else add(el);
  };
  $$('.site-header > *').forEach(add);
  $$('.hero > *').forEach((el) => { if (getComputedStyle(el).position !== 'absolute') add(el); });
  for (const sec of $$('main > *')) {
    if (sec.classList.contains('hero')) continue;
    const inner = $('.section', sec) ?? $('.contact', sec);
    if (!inner) { add(sec); continue; }
    for (const child of [...inner.children]) child.classList.contains('sec-head') || child.classList.contains('sec-cta') ? add(child) : spread(child);
  }
  $$('#footer > *').forEach(spread);
  return out;
}

function start() {
  const els = blocks();
  const list: Block[] = els.map((el) => { el.classList.add('bld'); return { el, done: false, busy: false }; });
  root.classList.add('bld-ready');

  const wires = document.createElement('div'); wires.className = 'bld-wires'; document.body.appendChild(wires);
  const crowd = document.createElement('div'); crowd.className = 'bld-crowd'; crowd.setAttribute('aria-hidden', 'true'); document.body.appendChild(crowd);
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const curs: Cur[] = Array.from({ length: N }, (_, i) => {
    const el = document.createElement('i'); el.innerHTML = ARROW; crowd.appendChild(el);
    return { el, x: cx, y: cy, vx: 0, vy: 0, tx: cx, ty: cy, job: null, i, wob: Math.random() * 6 };
  });

  // While the loader runs, the cursors circle the ink blob (its radius follows the loader's own timing).
  const t0 = performance.now();
  let phase: 'intro' | 'build' | 'leave' = root.classList.contains('intro') ? 'intro' : 'build';
  addEventListener('site:intro-done', () => { if (phase === 'intro') phase = 'build'; }, { once: true });

  let progScroll = scrollY, lastFrame = performance.now(), raf = 0;
  const label = (el: HTMLElement) => (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName.toLowerCase()).replace(/^astro-.*/, el.tagName.toLowerCase());

  function nextFor(c: Cur) {
    const limit = scrollY + innerHeight * 1.05;
    const b = list.find((x) => !x.done && !x.busy && x.el.getBoundingClientRect().top + scrollY < limit);
    if (!b) return;
    const r = b.el.getBoundingClientRect();
    const wire = document.createElement('div'); wire.className = 'bld-wire';
    Object.assign(wire.style, { left: `${r.left}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
    wire.innerHTML = `<span class="mono">${label(b.el)} · ${Math.round(r.width)}×${Math.round(r.height)}</span>`;
    wires.appendChild(wire); b.wire = wire; b.busy = true;
    c.job = { b, phase: 'fly', t0: 0, dur: Math.min(1100, 380 + Math.sqrt(r.width * r.height) * 1.1), x0: r.left, y0: r.top + scrollY, w: r.width, h: r.height };
  }

  function finishBlock(b: Block, delay = 0) {
    b.done = true; b.busy = false;
    setTimeout(() => { b.el.classList.add('built'); b.wire?.classList.add('fade'); setTimeout(() => b.wire?.remove(), 700); }, delay);
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(40, now - lastFrame) / 16.67; lastFrame = now;
    if (phase === 'intro') {
      const p = Math.min(1, (now - t0) / 2100), e = 1 - Math.pow(1 - p, 3), base = Math.min(innerWidth, innerHeight) * 0.26;
      curs.forEach((c) => {
        const a = now / 900 + (c.i / N) * Math.PI * 2, r = base * Math.max(0.15, e) + 46 + Math.sin(now / 300 + c.i) * 6;
        c.tx = innerWidth / 2 + Math.cos(a) * r; c.ty = innerHeight / 2 + Math.sin(a) * r;
      });
    } else if (phase === 'build') {
      for (const c of curs) {
        if (!c.job) { nextFor(c); if (!c.job) { c.tx = innerWidth * (0.15 + 0.7 * ((c.i * 0.37) % 1)); c.ty = innerHeight * 0.75 + Math.sin(now / 500 + c.i) * 30; continue; } }
        const j = c.job;
        if (j.phase === 'fly') {
          c.tx = j.x0; c.ty = j.y0 - scrollY;
          if (Math.hypot(c.x - c.tx, c.y - c.ty) < 14) { j.phase = 'drag'; j.t0 = now; }
        } else {
          const k = Math.min(1, (now - j.t0) / j.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          c.tx = j.x0 + j.w * e; c.ty = j.y0 - scrollY + j.h * e;
          j.b.wire?.style.setProperty('--k', String(e));
          if (k >= 1) { finishBlock(j.b); c.job = null; }
        }
      }
      // Scroll down after the work, keeping the next unbuilt piece in the lower part of the screen.
      const next = list.find((b) => !b.done);
      if (next) {
        const top = next.el.getBoundingClientRect().top + scrollY, want = Math.max(0, top - innerHeight * 0.6);
        if (want > scrollY + 1) { const y = scrollY + Math.min(14, (want - scrollY) * 0.06) * dt; scrollTo({ top: y, behavior: 'instant' }); progScroll = scrollY; }
      } else if (curs.every((c) => !c.job)) leave();
    } else {
      // Leaving: fly outward, away from the middle of the screen.
      curs.forEach((c) => { const a = Math.atan2(c.y - innerHeight / 2, c.x - innerWidth / 2) || c.i; c.tx = c.x + Math.cos(a) * 160; c.ty = c.y + Math.sin(a) * 160; });
    }
    // Springy movement with a little wobble, so they read as hands, not machines.
    for (const c of curs) {
      const stiff = phase === 'leave' ? 0.12 : phase === 'intro' ? 0.2 : 0.09;
      c.vx = (c.vx + (c.tx - c.x) * stiff * dt) * 0.72; c.vy = (c.vy + (c.ty - c.y) * stiff * dt) * 0.72;
      c.x += c.vx * dt; c.y += c.vy * dt;
      const tilt = Math.max(-18, Math.min(18, c.vx * 1.2)) + Math.sin(now / 400 + c.wob) * 3;
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) rotate(${tilt.toFixed(1)}deg)`;
    }
    if (phase !== 'leave' || crowd.isConnected) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // The visitor takes over: anything they do to scroll ends the build.
  let left = false;
  function leave() {
    if (left) return; left = true; phase = 'leave';
    let n = 0;
    for (const b of list) if (!b.done) finishBlock(b, Math.min(900, n++ * 35));
    crowd.classList.add('leaving');
    history.replaceState(history.state, '', `/${lang()}/`);
    if (document.body.dataset.homeTitle) document.title = document.body.dataset.homeTitle;
    setTimeout(() => {
      cancelAnimationFrame(raf); crowd.remove(); wires.remove();
      $$('.bld').forEach((el) => el.classList.remove('bld', 'built'));
      root.classList.remove('building', 'bld-ready');
    }, 1400);
  }
  const userScroll = () => { if (phase !== 'intro') leave(); };
  addEventListener('wheel', userScroll, { passive: true, once: true });
  addEventListener('touchmove', userScroll, { passive: true, once: true });
  addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'End', 'Home'].includes(e.key)) userScroll(); });
  addEventListener('scroll', () => { if (phase === 'build' && Math.abs(scrollY - progScroll) > 6) leave(); }, { passive: true });
}

document.addEventListener('astro:page-load', () => {
  if (root.dataset.page !== 'interact') return;
  if (!on() || !motionOn()) { root.classList.remove('building'); history.replaceState(history.state, '', `/${lang()}/`); return; }
  root.classList.add('building');
  scrollTo({ top: 0, behavior: 'instant' });
  start();
}, { once: true });
