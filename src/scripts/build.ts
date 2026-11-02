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
 * The work goes top down: the whole first screen is built at once, then the page scrolls continuously, building
 * each piece once it's in the upper two thirds of the screen and slowing when the work falls behind. Text is typed
 * like a person would (uneven speed, typos fixed with backspace, a word selected and retyped). A full ring of
 * cursors circles the loader; after the top there are only as many as there is work for: idle ones leave by the
 * nearest edge, and new ones fly in when more is waiting.
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
/** A typist's state: which text node, how far into it, any wrong letters on the end, a word it has selected to redo. */
type Typer = { ti: number; pos: number; junk: string; typo: number; sel: number; lastSel: number; mul: number; acc: number; human: boolean; rate: number; box?: HTMLElement; caret: number; cx: number; cy: number };
type Job =
  | { kind: 'block'; b: Block; phase: 'fly' | 'drag' | 'type'; t0: number; dur: number; x0: number; y0: number; w: number; h: number; ty: Typer }
  | { kind: 'sweep'; phase: 'fly' | 'swipe'; t0: number; x0: number; x1: number; y: number; host: HTMLElement };
type Cur = { el: HTMLElement; x: number; y: number; vx: number; vy: number; tx: number; ty: number; job: Job | null; idle: number; out: boolean; i: number };

// How many cursors: a full ring around the loader (which all build the top of the page), then as many as there is
// work for, up to a cap.
const cores = navigator.hardwareConcurrency || 4;
const small = innerWidth < 700, mid = innerWidth < 1100 || cores <= 4;
const RING = small ? 6 : mid ? 10 : 14;
const CAP = small ? 3 : mid ? 5 : 8;
const ZONE = 0.66;      // below the top, pieces are only built in the upper two thirds of the screen
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
  // React islands are wrapped in a box-less <astro-island>, so the piece is what's inside it.
  const unwrap = (el: Element | null) => (el?.tagName === 'ASTRO-ISLAND' ? el.firstElementChild : el);
  const add = (el: Element | null) => { el = unwrap(el); if (el instanceof HTMLElement && el.offsetHeight > 4) out.push(el); };
  const spread = (el: Element) => {
    if (el.tagName === 'ASTRO-ISLAND') return add(el);
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

/* ---------- Typing like a person ---------- */
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
/** A key next to this one (for typos), keeping the case. */
function near(ch: string) {
  const lo = ch.toLowerCase();
  for (const r of ROWS) {
    const i = r.indexOf(lo);
    if (i >= 0) { const n = r[Math.max(0, Math.min(r.length - 1, i + (Math.random() < 0.5 ? -1 : 1)))]; return ch === lo ? n : n.toUpperCase(); }
  }
  return ch;
}

function typer(text: Typed[]): Typer {
  const chars = text.reduce((s, t) => s + t.full.length, 0);
  // Short text is typed like a person (uneven speed, typos, second thoughts); long text just goes quickly.
  return { ti: 0, pos: 0, junk: '', typo: 0, sel: -1, lastSel: -99, mul: 1, acc: 0, human: chars < 700, rate: Math.max(34, chars / 2.4), caret: -1, cx: 0, cy: 0 };
}

/** One keystroke (a letter, a backspace, a selection…); returns how long until the next, in ms. */
function stroke(ty: Typer, text: Typed[], layer: HTMLElement): number {
  const t = text[ty.ti];
  const put = () => { t.node.data = t.full.slice(0, ty.pos) + ty.junk; };
  const per = 1000 / ty.rate, jitter = () => (per * (0.55 + Math.random() * 0.9)) / ty.mul;
  // A selected word goes in one stroke, then gets typed again.
  if (ty.sel >= 0) { ty.pos = ty.sel; ty.sel = -1; put(); ty.box?.classList.remove('on'); return 120 + Math.random() * 120; }
  // Typing a typo: a neighbouring key, then carrying on for a letter or two before noticing.
  if (ty.typo > 0) {
    ty.junk += ty.junk ? (t.full[ty.pos + ty.junk.length] ?? '') : near(t.full[ty.pos]);
    put();
    return --ty.typo ? jitter() : 220 + Math.random() * 320;
  }
  if (ty.junk) { ty.junk = ty.junk.slice(0, -1); put(); return ty.junk ? 40 + Math.random() * 40 : 110 + Math.random() * 120; }
  if (ty.pos >= t.full.length) { ty.ti++; return 0; }
  const ch = t.full[ty.pos];
  if (ty.human) {
    if (/[a-z]/i.test(ch) && Math.random() < 0.016) { ty.typo = 1 + Math.floor(Math.random() * 3); return 0; }
    // Second thoughts: select the word just typed, then retype it.
    if (ch === ' ' && ty.pos > ty.lastSel + 24 && Math.random() < 0.07) {
      const from = t.full.lastIndexOf(' ', ty.pos - 1) + 1;
      if (ty.pos - from >= 4) {
        const range = document.createRange(); range.setStart(t.node, from); range.setEnd(t.node, ty.pos);
        const r = range.getBoundingClientRect();
        if (r.width) {
          if (!ty.box) { ty.box = document.createElement('div'); ty.box.className = 'bld-sel'; layer.appendChild(ty.box); }
          Object.assign(ty.box.style, { left: `${r.left}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
          ty.box.classList.add('on'); ty.sel = from; ty.lastSel = ty.pos;
          return 380 + Math.random() * 420;
        }
      }
    }
    if (ch === ' ' && Math.random() < 0.3) ty.mul = 0.5 + Math.random() * 1.1; // speed drifts from word to word
  }
  ty.pos++; put();
  let wait = jitter();
  if (ty.human && /[.,;:!?]/.test(ch)) wait += 80 + Math.random() * 200;
  if (ty.human && ch === ' ' && Math.random() < 0.06) wait += 200 + Math.random() * 450; // a pause to think
  return wait;
}

function start() {
  const list: Block[] = blocks().map((el) => { el.classList.add('bld'); return { el, top: 0, h: 0, text: textOf(el), done: false, busy: false }; });
  const measure = () => list.forEach((b) => { const r = b.el.getBoundingClientRect(); b.top = r.top + scrollY; b.h = r.height; });
  measure(); addEventListener('resize', measure);
  // The top: everything on the first screen, built all at once before the page starts moving.
  const top = new Set(list.filter((b) => b.top < innerHeight * 0.95));
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
  /** Just off the screen edge nearest a piece, so a new cursor doesn't have far to come. */
  const nearEdge = (b: Block): [number, number] => {
    const r = b.el.getBoundingClientRect(), y = Math.max(20, Math.min(innerHeight - 20, r.top + (Math.random() - 0.5) * 240));
    return [r.left + r.width / 2 < innerWidth / 2 ? -30 : innerWidth + 30, y];
  };
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

  // Scrolling: once the top is built the page moves continuously, easing off when the work falls behind.
  let pos = scrollY, vel = 0, lastFrame = performance.now(), raf = 0;
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  const topDone = () => [...top].every((b) => b.done);
  const name = (el: HTMLElement) => (typeof el.className === 'string' && el.className.split(' ')[0]) || el.tagName.toLowerCase();

  /** The next piece in reading order, if it can be started: on the top, anything; below, inside the zone. */
  function nextPiece(): Block | null {
    const b = list.find((x) => !x.done && !x.busy);
    if (!b) return null;
    if (top.has(b)) return b;
    return topDone() && (b.top < scrollY + innerHeight * ZONE || scrollY >= maxScroll() - 2) ? b : null;
  }

  function startBlock(c: Cur, b: Block) {
    const r = b.el.getBoundingClientRect();
    const wire = document.createElement('div'); wire.className = 'bld-wire';
    Object.assign(wire.style, { left: `${r.left}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
    wire.innerHTML = `<div class="bw-frame"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span class="bw-name mono">${name(b.el)}</span><span class="bw-size mono">0 × 0</span></div>`;
    wires.appendChild(wire); b.wire = wire; b.busy = true;
    c.job = { kind: 'block', b, phase: 'fly', t0: 0, dur: Math.max(800, Math.min(1600, 600 + Math.sqrt(r.width * r.height) * 1.4)),
      x0: r.left, y0: r.top + scrollY, w: r.width, h: r.height, ty: typer(b.text ?? []) };
    c.idle = 0;
  }

  /** Shows a block for good: its text back in full, its hidden decorations shown, its wire faded. */
  function finishBlock(b: Block, delay = 0) {
    b.done = true; b.busy = false;
    b.text?.forEach((t) => { t.node.data = t.full; });
    setTimeout(() => {
      b.el.classList.add('built'); b.el.classList.remove('typing'); b.wire?.classList.add('fade'); setTimeout(() => b.wire?.remove(), 700);
      // Pieces that put themselves together (the globe's dots) start now.
      [b.el, ...b.el.querySelectorAll('[data-assemble]')].forEach((el) => { if (el.matches('[data-assemble]')) el.dispatchEvent(new Event('bld:assemble')); });
    }, delay);
  }

  function frame(now: number) {
    raf = 0;
    const ms = Math.min(40, now - lastFrame), dt = ms / 16.67; lastFrame = now;

    if (phase === 'intro') {
      const p = Math.min(1, (now - t0) / 2100), e = 1 - Math.pow(1 - p, 3), base = Math.min(innerWidth, innerHeight) * 0.26;
      curs.forEach((c, k) => {
        const a = now / 900 + (k / curs.length) * Math.PI * 2, r = base * Math.max(0.15, e) + 46 + Math.sin(now / 300 + k) * 6;
        c.tx = innerWidth / 2 + Math.cos(a) * r; c.ty = innerHeight / 2 + Math.sin(a) * r;
      });
    } else if (phase === 'build') {
      const onTop = !topDone();
      // 1. Hand out work: the first free cursor swipes the name; then pieces in order.
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
      // More work than hands: bring cursors in from the edges (the whole ring may build the top).
      for (let b = nextPiece(); b && curs.filter((c) => !c.out).length < (onTop ? Math.max(CAP, RING) : CAP); b = nextPiece()) { const [x, y] = nearEdge(b); startBlock(spawn(x, y), b); }

      // 2. Scroll: after the top, keep gliding down, slowing as the oldest unfinished piece nears the top of the screen.
      const lag = list.find((b) => !b.done);
      if (!lag && curs.every((c) => !c.job)) leave();
      else if (!onTop) {
        let want = 0;
        if (lag) { const rel = (lag.top - scrollY) / innerHeight; want = rel > ZONE ? 240 : rel < 0.1 ? 0 : 90 * Math.min(1, (rel - 0.1) / 0.3); }
        vel += (want - vel) * Math.min(1, 0.035 * dt);
        if (vel > 0.3 && pos < maxScroll()) { pos = Math.min(maxScroll(), pos + (vel * ms) / 1000); scrollTo({ top: pos, behavior: 'instant' }); }
      }

      // 3. Move each cursor along its job.
      for (const c of curs) {
        const j = c.job;
        c.el.classList.toggle('typing', j?.kind === 'block' && j.phase === 'type');
        if (!j) {
          // Idle: drift for a moment, then leave by the nearest edge if nothing comes up (none hang about).
          c.idle += dt;
          if (c.idle > 110 && !c.out) { c.out = true; const [x, y] = offEdge(); c.tx = x; c.ty = y; }
          if (!c.out) { c.tx = c.x + Math.sin(now / 500 + c.i) * 2; c.ty = c.y + Math.cos(now / 600 + c.i) * 2; }
          continue;
        }
        if (j.kind === 'sweep') {
          if (j.phase === 'fly') { c.tx = j.x0; c.ty = j.y - scrollY; if (Math.hypot(c.x - c.tx, c.y - c.ty) < 16) { j.phase = 'swipe'; j.t0 = now; } }
          else {
            const k = Math.min(1, (now - j.t0) / 1400), e = ease(k);
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
          if (Math.hypot(c.x - c.tx, c.y - c.ty) < 12) { j.phase = 'drag'; j.t0 = now; }
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
              j.phase = 'type'; j.ty.cx = j.x0; j.ty.cy = j.y0 + 12;
            } else { finishBlock(j.b); c.job = null; }
          }
        } else {
          const text = j.b.text!, ty = j.ty;
          ty.acc += ms;
          for (let n = 0; ty.acc > 0 && ty.ti < text.length && n < 400; n++) ty.acc -= stroke(ty, text, wires);
          // Put the text cursor after the last letter, measuring only when the text changed (it forces layout).
          const t = text[Math.min(ty.ti, text.length - 1)];
          const key = ty.ti * 100000 + t.node.data.length;
          if (t.node.data.length && key !== ty.caret) {
            ty.caret = key;
            const range = document.createRange(); range.setStart(t.node, t.node.data.length - 1); range.setEnd(t.node, t.node.data.length);
            const rect = range.getBoundingClientRect();
            if (rect.height) { ty.cx = rect.right + 2; ty.cy = rect.top + rect.height / 2 + scrollY; }
          }
          c.tx = ty.cx; c.ty = ty.cy - scrollY; // kept in page coordinates, so it stays put while the page moves
          if (ty.ti >= text.length) { ty.box?.remove(); finishBlock(j.b); c.job = null; }
        }
      }
    } else {
      curs.forEach((c) => { if (!c.out) { c.out = true; const a = Math.atan2(c.y - innerHeight / 2, c.x - innerWidth / 2) || c.i; c.tx = c.x + Math.cos(a) * innerWidth; c.ty = c.y + Math.sin(a) * innerWidth; } });
    }

    // Unhurried, springy movement (except where a job places a cursor exactly); cursors are removed once off screen.
    for (const c of curs) {
      const typing = c.el.classList.contains('typing');
      const stiff = phase === 'intro' ? 0.18 : typing ? 0.22 : 0.04;
      const damp = phase === 'intro' || typing ? 0.74 : 0.82;
      c.vx = (c.vx + (c.tx - c.x) * stiff * dt) * damp; c.vy = (c.vy + (c.ty - c.y) * stiff * dt) * damp;
      // A speed limit, so long trips are a glide rather than a dart.
      const sp = Math.hypot(c.vx, c.vy), lim = phase === 'intro' ? 40 : 13;
      if (sp > lim) { c.vx *= lim / sp; c.vy *= lim / sp; }
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
    if (left) return; left = true; phase = 'leave';
    let n = 0;
    for (const b of list) if (!b.done || b.el.classList.contains('typing')) finishBlock(b, Math.min(900, n++ * 35));
    wires.querySelectorAll('.bld-sel').forEach((el) => el.remove());
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
  // Our own scrolling keeps `pos`; a scroll that lands somewhere else came from the visitor (scrollbar, find, …).
  addEventListener('scroll', () => { if (phase === 'build' && Math.abs(scrollY - pos) > 8) leave(); }, { passive: true });
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
