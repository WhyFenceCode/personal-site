/**
 * "Watch it build" (site.yaml interactive.build).
 *
 * - Shift+B or Cmd/Ctrl+B anywhere opens /<lang>/build/ as a fresh load, so the loader plays; the home page also
 *   shows a small hint (bottom left) until you scroll.
 * - On /build, accent cursors circle the loader's ink blob. When it opens, one cursor swipes across the name (diving
 *   it to the next layer) while the others build the page: each piece is first drawn as a wireframe box (a cursor
 *   drags it corner to corner), then text pieces are typed in letter by letter by a text cursor, and other pieces
 *   fade in. The page scrolls down on its own as they work. Anything already built can be used.
 * - Scroll yourself (wheel, touch, keys, scrollbar) and the rest swipes in, the cursors fly off, and the address
 *   becomes the home page's. The same happens when they finish.
 * - With motion off, /build is just the home page.
 *
 * The work goes top down, in waves: everything in the upper two thirds of the screen is built, then the page glides
 * (one eased move) to the next piece. A full ring of cursors circles the loader; after that there are only as many
 * as there is work for: idle ones leave by the nearest edge, and new ones fly in when more is waiting.
 *
 * Kept light for slower devices: fewer cursors on small or low-core screens, block positions measured once (and on
 * resize) instead of every frame, transforms only, no filters, and the caret only measured when text changes.
 */
import { motionOn } from './motion';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const on = () => (document.body.dataset.ix ?? '').split(' ').includes('build');
const lang = () => document.documentElement.lang || 'en';
const home = () => `/${lang()}/`;
const root = document.documentElement;

/* ---------- Shortcut and home hint ---------- */
addEventListener('keydown', (e) => {
  if (!on() || e.key.toLowerCase() !== 'b' || e.altKey || e.repeat || !(e.shiftKey || e.metaKey || e.ctrlKey)) return;
  if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
  location.assign(`/${lang()}/build/`);
});
addEventListener('scroll', () => { if (scrollY > 40) $('[data-build-hint]')?.classList.add('gone'); }, { passive: true });
// During the loader, desktop visitors (with a mouse) get a callout to try the build instead.
if (on() && root.classList.contains('intro') && root.dataset.page !== 'build' && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  $('[data-ld-build]')?.removeAttribute('hidden');
  root.classList.add('ld-callout');
}

/* ---------- The build ---------- */
type Typed = { node: Text; full: string };
type Block = { el: HTMLElement; top: number; h: number; text: Typed[] | null; wire?: HTMLElement; done: boolean; busy: boolean };
type Job =
  | { kind: 'block'; b: Block; phase: 'fly' | 'drag' | 'type'; t0: number; dur: number; x0: number; y0: number; w: number; h: number; ti: number; tc: number; rate: number; caret: number; cx: number; cy: number }
  | { kind: 'sweep'; phase: 'fly' | 'swipe'; t0: number; x0: number; x1: number; y: number; host: HTMLElement };
type Cur = { el: HTMLElement; x: number; y: number; vx: number; vy: number; tx: number; ty: number; job: Job | null; idle: number; out: boolean; i: number };

// How many cursors: a full ring around the loader, then as many as there is work for, up to a cap.
const cores = navigator.hardwareConcurrency || 4;
const small = innerWidth < 700, mid = innerWidth < 1100 || cores <= 4;
const RING = small ? 6 : mid ? 10 : 14;
const CAP = small ? 3 : mid ? 5 : 8;
const ZONE = 0.66;      // pieces are only built in the upper two thirds of the screen
const CURSOR = '<b></b>';

/** The text inside a piece, to be typed in (skipping decorative copies and screen-reader-only text). */
function textOf(el: HTMLElement): Typed[] | null {
  if (el.querySelector('.globe, .gh-cal, .tl, [data-frame]')) return null;
  const out: Typed[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('[aria-hidden="true"], script, style, .sr-only, svg') || !n.textContent?.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push({ node: n as Text, full: (n as Text).data });
  const len = out.reduce((s, t) => s + t.full.length, 0);
  return len > 0 && len <= 2400 ? out : null;
}

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

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function start() {
  const list: Block[] = blocks().map((el) => { el.classList.add('bld'); return { el, top: 0, h: 0, text: textOf(el), done: false, busy: false }; });
  const measure = () => list.forEach((b) => { const r = b.el.getBoundingClientRect(); b.top = r.top + scrollY; b.h = r.height; });
  measure(); addEventListener('resize', measure);
  root.classList.add('bld-ready');

  const wires = document.createElement('div'); wires.className = 'bld-wires'; document.body.appendChild(wires);
  const crowd = document.createElement('div'); crowd.className = 'bld-crowd'; crowd.setAttribute('aria-hidden', 'true'); document.body.appendChild(crowd);
  let curs: Cur[] = [];
  let made = 0;
  /** A new cursor, starting at (x, y): the ring on load, or just off a screen edge when one joins later. */
  function spawn(x: number, y: number) {
    const el = document.createElement('i'); el.innerHTML = CURSOR; crowd.appendChild(el);
    const c: Cur = { el, x, y, vx: 0, vy: 0, tx: x, ty: y, job: null, idle: 0, out: false, i: made++ };
    curs.push(c); return c;
  }
  const offEdge = (): [number, number] => {
    const side = Math.floor(Math.random() * 4), r = Math.random();
    return side === 0 ? [-30, innerHeight * r] : side === 1 ? [innerWidth + 30, innerHeight * r] : side === 2 ? [innerWidth * r, -30] : [innerWidth * r, innerHeight + 30];
  };
  for (let i = 0; i < RING; i++) spawn(innerWidth / 2, innerHeight / 2);

  const t0 = performance.now();
  let phase: 'intro' | 'build' | 'leave' = root.classList.contains('intro') ? 'intro' : 'build';
  let swept = false, wantsOut = false;
  // A scroll during the loader is remembered: the page then appears whole as soon as the loader opens.
  addEventListener('site:intro-done', () => { crowd.classList.add('calm'); if (phase === 'intro') { phase = 'build'; if (wantsOut) leave(); } }, { once: true });
  if (phase === 'build') crowd.classList.add('calm');

  // Scrolling: one eased glide at a time, and only between waves of work (never while a piece is being made).
  let glide: { from: number; to: number; t0: number; dur: number } | null = null;
  let progScroll = Math.round(scrollY), lastFrame = performance.now(), raf = 0;
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  const name = (el: HTMLElement) => (typeof el.className === 'string' && el.className.split(' ')[0]) || el.tagName.toLowerCase();

  /** The next piece in reading order, if it's inside the build zone (upper two thirds of the screen). */
  function nextPiece(): Block | null {
    const b = list.find((x) => !x.done && !x.busy);
    if (!b) return null;
    return b.top < scrollY + innerHeight * ZONE && b.top + Math.min(b.h, 60) > scrollY - 40 ? b : null;
  }

  function startBlock(c: Cur, b: Block) {
    const r = b.el.getBoundingClientRect();
    const wire = document.createElement('div'); wire.className = 'bld-wire';
    Object.assign(wire.style, { left: `${r.left}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
    wire.innerHTML = `<div class="bw-frame"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span class="bw-name mono">${name(b.el)}</span><span class="bw-size mono">0 × 0</span></div>`;
    wires.appendChild(wire); b.wire = wire; b.busy = true;
    const chars = b.text?.reduce((s, t) => s + t.full.length, 0) ?? 0;
    c.job = { kind: 'block', b, phase: 'fly', t0: 0, dur: Math.max(700, Math.min(1500, 550 + Math.sqrt(r.width * r.height) * 1.4)),
      x0: r.left, y0: r.top + scrollY, w: r.width, h: r.height, ti: 0, tc: 0, rate: Math.max(40, chars / 2.2), caret: -1, cx: r.left, cy: r.top + scrollY };
    c.idle = 0;
  }

  /** Shows a block for good: its text back in full, its hidden decorations shown, its wire faded. */
  function finishBlock(b: Block, delay = 0) {
    b.done = true; b.busy = false;
    b.text?.forEach((t) => { t.node.data = t.full; });
    setTimeout(() => { b.el.classList.add('built'); b.el.classList.remove('typing'); b.wire?.classList.add('fade'); setTimeout(() => b.wire?.remove(), 700); }, delay);
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(40, now - lastFrame) / 16.67; lastFrame = now;

    if (phase === 'intro') {
      const p = Math.min(1, (now - t0) / 2100), e = 1 - Math.pow(1 - p, 3), base = Math.min(innerWidth, innerHeight) * 0.26;
      curs.forEach((c, k) => {
        const a = now / 900 + (k / curs.length) * Math.PI * 2, r = base * Math.max(0.15, e) + 46 + Math.sin(now / 300 + k) * 6;
        c.tx = innerWidth / 2 + Math.cos(a) * r; c.ty = innerHeight / 2 + Math.sin(a) * r;
      });
    } else if (phase === 'build') {
      // 1. Glide the page, if a glide is running.
      if (glide) {
        const k = Math.min(1, (now - glide.t0) / glide.dur);
        scrollTo({ top: glide.from + (glide.to - glide.from) * ease(k), behavior: 'instant' }); progScroll = Math.round(scrollY);
        if (k >= 1) glide = null;
      }
      // 2. Hand out work: the first free cursor swipes the name; then pieces in order, inside the zone.
      const working = curs.filter((c) => c.job && !c.out).length;
      if (!glide) {
        for (const c of curs) {
          if (c.out || c.job) continue;
          const hero = $<HTMLElement>('[data-hero]'), title = hero && $<HTMLElement>('h1', hero);
          if (!swept && hero && title) {
            swept = true;
            const r = title.getBoundingClientRect(), W = hero.getBoundingClientRect().width, mid = r.left + r.width / 2, span = W * 0.55;
            c.job = { kind: 'sweep', phase: 'fly', t0: 0, x0: mid - span / 2, x1: mid + span / 2, y: r.top + r.height / 2 + scrollY, host: hero };
            continue;
          }
          const b = nextPiece(); if (!b) break;
          startBlock(c, b);
        }
        // More work in the zone than hands: bring a cursor in from an edge.
        if (nextPiece() && curs.filter((c) => !c.out).length < CAP) { const [x, y] = offEdge(); startBlock(spawn(x, y), nextPiece()!); }
      }
      // 3. Nothing left in the zone and everyone's finished: glide down to the next piece (or wrap up).
      const pending = list.find((b) => !b.done);
      if (!pending && curs.every((c) => !c.job)) leave();
      else if (pending && !glide && working === 0 && !nextPiece() && !pending.busy) {
        const to = Math.max(0, Math.min(maxScroll(), pending.top - innerHeight * 0.16));
        if (to > scrollY + 2) glide = { from: scrollY, to, t0: now, dur: Math.max(500, Math.min(1100, 380 + (to - scrollY) * 0.7)) };
      }
      // 4. Move each cursor along its job.
      for (const c of curs) {
        const j = c.job;
        c.el.classList.toggle('typing', j?.kind === 'block' && j.phase === 'type');
        if (!j) {
          // Idle: drift for a moment, then leave by the nearest edge if nothing comes up (none hang about).
          c.idle += dt;
          if (c.idle > 40 && !glide && !c.out) { c.out = true; const [x, y] = offEdge(); c.tx = x; c.ty = y; }
          if (!c.out) { c.tx = c.x + Math.sin(now / 500 + c.i) * 2; c.ty = c.y + Math.cos(now / 600 + c.i) * 2; }
          continue;
        }
        if (j.kind === 'sweep') {
          if (j.phase === 'fly') { c.tx = j.x0; c.ty = j.y - scrollY; if (Math.hypot(c.x - c.tx, c.y - c.ty) < 16) { j.phase = 'swipe'; j.t0 = now; } }
          else {
            const k = Math.min(1, (now - j.t0) / 1300), e = ease(k);
            c.tx = c.x = j.x0 + (j.x1 - j.x0) * e; c.ty = c.y = j.y - scrollY - Math.sin(e * Math.PI) * 18; c.vx = c.vy = 0;
            // The hero reads this like a real pointer: the ink follows and the swipe dives a layer.
            j.host.dispatchEvent(new PointerEvent('pointermove', { clientX: c.x, clientY: c.y, pointerType: 'pen', bubbles: true }));
            if (k >= 1) {
              for (const type of ['pointerup', 'pointerleave']) j.host.dispatchEvent(new PointerEvent(type, { clientX: c.x, clientY: c.y, pointerType: 'pen' }));
              c.job = null;
            }
          }
          continue;
        }
        if (j.phase === 'fly') {
          c.tx = j.x0; c.ty = j.y0 - scrollY;
          if (Math.hypot(c.x - c.tx, c.y - c.ty) < 10) { j.phase = 'drag'; j.t0 = now; }
        } else if (j.phase === 'drag') {
          // The cursor sits exactly on the frame's growing corner, and the size label counts up underneath.
          const k = Math.min(1, (now - j.t0) / j.dur), e = ease(k);
          c.tx = c.x = j.x0 + j.w * e; c.ty = c.y = j.y0 - scrollY + j.h * e; c.vx = c.vy = 0;
          j.b.wire?.style.setProperty('--k', e.toFixed(4));
          const size = j.b.wire?.querySelector('.bw-size'); if (size) size.textContent = `${Math.round(j.w * e)} × ${Math.round(j.h * e)}`;
          if (k >= 1) {
            if (j.b.text) {
              // Empty the text, show the piece, and switch to the text cursor.
              j.b.text.forEach((t) => { t.node.data = ''; });
              j.b.el.classList.add('built', 'typing');
              j.phase = 'type'; j.t0 = now;
            } else { finishBlock(j.b); c.job = null; }
          }
        } else {
          // Type a few letters per frame, then put the text cursor at the end of what's typed.
          const text = j.b.text!;
          let budget = j.rate * (dt / 60) + j.tc; j.tc = budget % 1; budget = Math.floor(budget);
          while (budget > 0 && j.ti < text.length) {
            const t = text[j.ti], n = Math.min(t.full.length - t.node.data.length, budget);
            t.node.data = t.full.slice(0, t.node.data.length + n); budget -= n;
            if (t.node.data.length >= t.full.length) j.ti++;
          }
          const t = text[Math.min(j.ti, text.length - 1)];
          // Measuring the caret forces layout, so only do it when the typed text actually changed.
          const key = j.ti * 100000 + t.node.data.length;
          if (t.node.data.length && key !== j.caret) {
            j.caret = key;
            const range = document.createRange(); range.setStart(t.node, t.node.data.length - 1); range.setEnd(t.node, t.node.data.length);
            const rect = range.getBoundingClientRect();
            if (rect.height) { j.cx = rect.right + 2; j.cy = rect.top + rect.height / 2 + scrollY; }
          }
          c.tx = j.cx; c.ty = j.cy - scrollY; // kept in page coordinates, so it stays put if the page moves
          if (j.ti >= text.length) { finishBlock(j.b); c.job = null; }
        }
      }
    } else {
      curs.forEach((c) => { if (!c.out) { c.out = true; const a = Math.atan2(c.y - innerHeight / 2, c.x - innerWidth / 2) || c.i; c.tx = c.x + Math.cos(a) * innerWidth; c.ty = c.y + Math.sin(a) * innerWidth; } });
    }

    // Springy movement (except where a job places a cursor exactly), and remove cursors once they're off screen.
    for (const c of curs) {
      const typing = c.el.classList.contains('typing');
      const stiff = c.out ? 0.05 : phase === 'intro' ? 0.18 : typing ? 0.24 : 0.07;
      c.vx = (c.vx + (c.tx - c.x) * stiff * dt) * 0.74; c.vy = (c.vy + (c.ty - c.y) * stiff * dt) * 0.74;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
    }
    const gone = curs.filter((c) => c.out && (c.x < -20 || c.y < -20 || c.x > innerWidth + 20 || c.y > innerHeight + 20));
    if (gone.length) { gone.forEach((c) => c.el.remove()); curs = curs.filter((c) => !gone.includes(c)); }
    if (phase !== 'leave' || crowd.isConnected) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // The visitor takes over: anything they do to scroll ends the build.
  let left = false;
  function leave() {
    if (left) return; left = true; phase = 'leave'; glide = null;
    let n = 0;
    for (const b of list) if (!b.done || b.el.classList.contains('typing')) finishBlock(b, Math.min(900, n++ * 35));
    crowd.classList.add('leaving');
    goHome();
    setTimeout(() => {
      cancelAnimationFrame(raf); crowd.remove(); wires.remove(); removeEventListener('resize', measure);
      $$('.bld').forEach((el) => el.classList.remove('bld', 'built', 'typing'));
      root.classList.remove('building', 'bld-ready');
      goHome();
    }, 1400);
  }
  const userScroll = () => { if (phase === 'intro') wantsOut = true; else leave(); };
  addEventListener('wheel', userScroll, { passive: true });
  addEventListener('touchmove', userScroll, { passive: true });
  addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'End', 'Home'].includes(e.key)) userScroll(); });
  addEventListener('scroll', () => { if (phase === 'build' && Math.abs(Math.round(scrollY) - progScroll) > 8) leave(); }, { passive: true });
}

/** Swap the address to the home page without reloading (keeping the router's own history state). */
function goHome() {
  if (location.pathname !== home()) history.replaceState(history.state, '', home() + location.search + location.hash);
  if (document.body.dataset.homeTitle) document.title = document.body.dataset.homeTitle;
}

document.addEventListener('astro:page-load', () => {
  if (root.dataset.page !== 'build') return;
  if (!on() || !motionOn()) { root.classList.remove('building'); goHome(); return; }
  root.classList.add('building');
  scrollTo({ top: 0, behavior: 'instant' });
  start();
}, { once: true });
