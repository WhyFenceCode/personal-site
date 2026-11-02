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
 * The work goes top down: the whole first screen is built at once, one cursor swipes the finished name, and then
 * the page scrolls steadily, each piece starting when it reaches the upper two thirds of the screen. Typing is paced
 * to finish as the next row arrives: a person's pace (uneven speed, typos fixed with backspace, a word selected and
 * retyped) when there's time, quicker when there isn't. Pieces with a background are typed on the bare page and then
 * filled. Each piece's size (and each line's, with its untyped text invisible) is held while it's typed, so nothing
 * moves under the boxes. A box appears when its cursor clicks. The scroll takes a breath after each section, a longer
 * one after a showpiece, and when the build finishes the page glides back to the top. A full ring of
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
// Listened for while capturing, so no other handler can swallow it; matched by key or physical key (any layout).
// Pressed inside the site's own embed (a project preview), it opens the build in the page around it.
document.addEventListener('keydown', (e) => {
  if (!on() || (e.key.toLowerCase() !== 'b' && e.code !== 'KeyB') || e.altKey || e.repeat || !(e.shiftKey || e.metaKey || e.ctrlKey)) return;
  if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
  const url = `/${lang()}/build/`;
  try { (window.top ?? window).location.assign(url); } catch { location.assign(url); }
}, true);
addEventListener('scroll', () => { if (scrollY > 40) $('[data-build-hint]')?.classList.add('gone'); }, { passive: true });
// During the loader, desktop visitors (with a mouse) get a callout to try the build instead.
if (on() && root.classList.contains('intro') && root.dataset.page !== 'build' && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  $('[data-ld-build]')?.removeAttribute('hidden');
  root.classList.add('ld-callout');
}

/* ---------- The build ---------- */
/** A text node to type. While it's typed it sits in a <bld-t> wrapper with the rest of its text in an invisible
 *  <bld-g>, so every line keeps its space and wraps where it will end up. `draft` is typed first, then replaced. */
type Typed = { node: Text; full: string; draft?: string; wrap?: HTMLElement; ghost?: Text };
type Block = {
  el: HTMLElement; top: number; text: Typed[] | null; wire?: HTMLElement; done: boolean; busy: boolean;
  css: string | null;          // the element's own inline style, put back when it's finished
  fill: string | null;         // its background colour, if it has one (typed on the bare page first, then filled)
  color: string;               // its text colour (it borrows the page's while bare)
  bare?: boolean;
  zone: number;                // how far down the screen it starts: around two thirds, give or take
  sec: Element | null;         // its section, for a short pause when the section's done
  key: boolean;                // a showpiece (globe, calendar, timeline…), worth a longer pause
};
/** A typist's state: which text node, how far into it, any wrong letters on the end, a word it has selected to redo. */
type Typer = { ti: number; pos: number; junk: string; typo: number; sel: number; since: number; pool?: string[]; drafted: number; draftLeft: string; mul: number; acc: number; rate: number; box?: HTMLElement; caret: number; cx: number; cy: number };
type Job =
  | { kind: 'block'; b: Block; phase: 'fly' | 'drag' | 'type'; t0: number; dur: number; x0: number; y0: number; w: number; h: number; due: number; t1: number; top: boolean; ty: Typer }
  | { kind: 'sweep'; phase: 'fly' | 'swipe'; t0: number; x0: number; x1: number; y: number; host: HTMLElement };
type Cur = { el: HTMLElement; x: number; y: number; vx: number; vy: number; tx: number; ty: number; job: Job | null; idle: number; out: boolean; used: boolean; i: number };

// How many cursors: a full ring around the loader (which all build the top of the page), then as many as there is
// work for, up to a cap.
const cores = navigator.hardwareConcurrency || 4;
const small = innerWidth < 700, mid = innerWidth < 1100 || cores <= 4;
const RING = small ? 6 : mid ? 10 : 14;
const CAP = small ? 3 : mid ? 5 : 8;
const ZONE = 0.66;      // below the top, pieces start around the upper two thirds of the screen (it sets the pace)
const STEP = 1.4;       // scroll speed while building, in px per 60th of a second (about 84px/s)
const CURSOR = '<b></b>';
const SHOW = '.globe, .gh-cal, .tl, [data-frame], astro-island, canvas'; // showpieces: the scroll pauses after them

/** The text inside a piece, to be typed in: all of it, around any pictures and embeds, skipping decorative copies and
 *  screen-reader-only text (except decorative text marked `data-bld-type`, like the marquee's words). React islands
 *  are never typed into (their text must match what they hydrate with), nor are the calendar and timeline, which
 *  lay themselves out from their text. */
function textOf(el: HTMLElement): Typed[] | null {
  if (el.matches('astro-island') || el.parentElement?.tagName === 'ASTRO-ISLAND') return null;
  const out: Typed[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement;
      if (!p || p.closest('[aria-hidden="true"]:not([data-bld-type]), script, style, .sr-only, svg, astro-island, .gh-cal, .tl') || !n.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const cs = getComputedStyle(p);
      return cs.visibility === 'hidden' || +cs.opacity < 0.1 || !p.getClientRects().length ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push({ node: n as Text, full: (n as Text).data, draft: n.parentElement?.dataset.bldDraft || undefined });
  const len = out.reduce((s, t) => s + t.full.length, 0);
  return len > 0 && len <= 4000 ? out : null;
}

/** A piece's own background colour, if it has a solid one. */
function fillOf(el: HTMLElement): string | null {
  const c = getComputedStyle(el).backgroundColor, m = c.match(/[\d.]+/g);
  return m && (m.length < 4 || +m[3] > 0.5) ? c : null;
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
    const kids = [...el.children], alike = kids.length >= 2 && kids.every((k) => k.tagName === kids[0].tagName && (k as HTMLElement).offsetHeight > 20);
    if (((d.includes('grid') || d.includes('flex')) || alike) && kids.length >= 2 && kids.length <= 24) kids.forEach(add);
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

const SPARE = ['simple', 'quick', 'really', 'better', 'great', 'first', 'small', 'about', 'little', 'together'];
/** A different word to type by mistake in place of `word`, in its case: another word from the same piece if there is
 *  one, otherwise a stock one. Never the word itself. */
function wrongWord(word: string, pool: string[]) {
  const lo = word.toLowerCase(), ok = (w: string) => w.toLowerCase() !== lo && !lo.startsWith(w.toLowerCase().slice(0, 3));
  const own = pool.filter(ok), from = own.length >= 3 ? own : SPARE.filter(ok);
  const w = from[Math.floor(Math.random() * from.length)].toLowerCase();
  return word === word.toUpperCase() ? w.toUpperCase() : word[0] === word[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w;
}

const typer = (): Typer => ({ ti: 0, pos: 0, junk: '', typo: 0, sel: -1, since: 0, drafted: -1, draftLeft: '', mul: 1, acc: 0, rate: 20, caret: -1, cx: 0, cy: 0 });

/** Highlights characters [from, to) of a text node, like a drag-selection. */
function select(ty: Typer, node: Text, from: number, to: number, layer: HTMLElement) {
  const range = document.createRange(); range.setStart(node, from); range.setEnd(node, to);
  const r = range.getBoundingClientRect();
  if (!r.width) return false;
  if (!ty.box) { ty.box = document.createElement('div'); ty.box.className = 'bld-sel'; layer.appendChild(ty.box); }
  Object.assign(ty.box.style, { left: `${r.left}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
  ty.box.classList.add('on');
  return true;
}

/** One keystroke (a letter, a backspace, a selection…); returns how long until the next, in ms.
 *  At a person's pace there are typos and second thoughts; when it has to hurry, it just types. */
function stroke(ty: Typer, text: Typed[], layer: HTMLElement): number {
  const t = text[ty.ti], human = ty.rate < 45;
  const put = () => { t.node.data = t.full.slice(0, ty.pos) + ty.junk; if (t.ghost) t.ghost.data = t.full.slice(ty.pos); };
  const per = 1000 / ty.rate, jitter = () => (per * (0.55 + Math.random() * 0.9)) / ty.mul;
  // A selection is deleted in one stroke (after a moment with it highlighted), then the text is typed again.
  if (ty.sel >= 0) { ty.pos = ty.sel; ty.sel = -1; ty.junk = ''; put(); ty.box?.classList.remove('on'); return 160 + Math.random() * 160; }
  // A first draft: type it, select it, think, delete it, then type the real text (the old city, then the new one;
  // the wrong word, then the right one).
  if (t.draft && ty.drafted !== ty.ti && ty.pos === 0 && !ty.junk) { ty.drafted = ty.ti; ty.draftLeft = t.draft; }
  if (ty.draftLeft) {
    ty.junk += ty.draftLeft[0]; ty.draftLeft = ty.draftLeft.slice(1); put();
    if (ty.draftLeft) return Math.max(70, jitter());
    if (select(ty, t.node, ty.pos, ty.pos + ty.junk.length, layer)) ty.sel = ty.pos;
    return 900 + Math.random() * 400;
  }
  // Typing a typo: a neighbouring key, then carrying on for a letter or two before noticing.
  if (ty.typo > 0) {
    ty.junk += ty.junk ? (t.full[ty.pos + ty.junk.length] ?? '') : near(t.full[ty.pos]);
    put();
    return --ty.typo ? jitter() : 220 + Math.random() * 320;
  }
  if (ty.junk) { ty.junk = ty.junk.slice(0, -1); put(); return ty.junk ? 40 + Math.random() * 40 : 110 + Math.random() * 120; }
  if (ty.pos >= t.full.length) { ty.ti++; return 0; }
  const ch = t.full[ty.pos];
  if (human) {
    // Second thoughts: at the start of a word, now and then type a different one first (then select it and fix it).
    const word = (ty.pos === 0 || /[\s(\-/]/.test(t.full[ty.pos - 1])) && t.full.slice(ty.pos).match(/^[A-Za-z']{4,}/)?.[0];
    if (word && ty.since > 22 && Math.random() < 0.14) {
      ty.pool ??= text.flatMap((x) => x.full.match(/[A-Za-z]{4,}/g) ?? []);
      ty.since = 0; ty.draftLeft = wrongWord(word, ty.pool);
      return 0;
    }
    if (/[a-z]/i.test(ch) && Math.random() < 0.016) { ty.typo = 1 + Math.floor(Math.random() * 3); return 0; }
    if (ch === ' ' && Math.random() < 0.3) ty.mul = 0.6 + Math.random() * 0.9; // speed drifts from word to word
  }
  ty.pos++; ty.since++; put();
  let wait = jitter();
  if (human && /[.,;:!?]/.test(ch)) wait += 80 + Math.random() * 200;
  if (human && ch === ' ' && Math.random() < 0.06) wait += 200 + Math.random() * 450; // a pause to think
  return wait;
}

/** Letters still to type. */
function left(ty: Typer, text: Typed[]) {
  let n = 0;
  for (let i = ty.ti; i < text.length; i++) n += text[i].full.length - (i === ty.ti ? ty.pos : 0);
  return n;
}

/* ---------- Backgrounds: bare while typing, then filled ---------- */
function bare(b: Block) {
  if (!b.fill || b.bare) return;
  b.bare = true;
  const st = b.el.style;
  st.backgroundColor = 'transparent';
  st.backgroundImage = `linear-gradient(${b.fill}, ${b.fill})`;
  st.backgroundRepeat = 'no-repeat';
  st.backgroundSize = '0% 100%';
  st.color = getComputedStyle(b.el.parentElement ?? document.body).color;
}
/** Sweeps the background in from the left and turns the text back to its own colour, then tidies the inline styles. */
function fillIn(b: Block) {
  bare(b);
  void b.el.offsetWidth; // let the bare state render first, so it transitions
  const st = b.el.style;
  st.transition = 'background-size .9s cubic-bezier(.6, 0, .2, 1), color .5s .35s, opacity .6s';
  st.backgroundSize = '100% 100%'; st.color = b.color;
  setTimeout(() => restore(b), 1200);
}
function restore(b: Block) { if (b.css === null) b.el.removeAttribute('style'); else b.el.setAttribute('style', b.css); }

function start() {
  const list: Block[] = blocks().map((el) => {
    el.classList.add('bld');
    const key = !!(el.matches(SHOW) || el.querySelector(SHOW) || el.parentElement?.tagName === 'ASTRO-ISLAND');
    return { el, top: 0, text: textOf(el), done: false, busy: false, css: el.getAttribute('style'), fill: fillOf(el), color: getComputedStyle(el).color,
      zone: ZONE + (Math.random() - 0.5) * 0.24, sec: el.closest('main > *, #footer'), key };
  });
  const measure = () => list.forEach((b) => { if (!b.busy) b.top = b.el.getBoundingClientRect().top + scrollY; });
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
    const c: Cur = { el, x, y, vx: 0, vy: 0, tx: x, ty: y, job: null, idle: 0, out: false, used: false, i: made++ };
    curs.push(c); return c;
  }
  /** Just off the screen edge nearest a piece, so a new cursor doesn't have far to come. */
  const nearEdge = (r: { left: number; top: number; width: number }): [number, number] =>
    [r.left + r.width / 2 < innerWidth / 2 ? -30 : innerWidth + 30, Math.max(20, Math.min(innerHeight - 20, r.top + (Math.random() - 0.5) * 240))];
  const offEdge = (): [number, number] => {
    const side = Math.floor(Math.random() * 4), r = Math.random();
    return side === 0 ? [-30, innerHeight * r] : side === 1 ? [innerWidth + 30, innerHeight * r] : side === 2 ? [innerWidth * r, -30] : [innerWidth * r, innerHeight + 30];
  };
  for (let i = 0; i < RING; i++) spawn(innerWidth / 2, innerHeight / 2);

  const t0 = performance.now();
  let phase: 'intro' | 'build' | 'leave' = root.classList.contains('intro') ? 'intro' : 'build';
  let wantsOut = false;
  // The name swipe comes once the top is built, in a pause before the page starts moving.
  let swipe: 'wait' | 'busy' | number = 'wait';
  // A scroll during the loader is remembered: the page then appears whole as soon as the loader opens.
  addEventListener('site:intro-done', () => { crowd.classList.add('calm'); if (phase === 'intro') { phase = 'build'; if (wantsOut) leave(); } }, { once: true });
  if (phase === 'build') crowd.classList.add('calm');

  // Scrolling: whole pixels per frame (even steps), easing off only if the work falls behind.
  let pos = scrollY, vel = 0, avgMs = 16.7, lastFrame = performance.now(), raf = 0;
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  const topDone = () => [...top].every((b) => b.done);
  const moving = (now: number) => typeof swipe === 'number' && now - swipe > 450;
  const name = (el: HTMLElement) => (typeof el.className === 'string' && el.className.split(' ')[0]) || el.tagName.toLowerCase();

  /** The next piece in reading order, if it can be started: on the top, anything; below, inside the zone. */
  function nextPiece(now: number): Block | null {
    const b = list.find((x) => !x.done && !x.busy);
    if (!b) return null;
    if (top.has(b)) return b;
    return moving(now) && (b.top < scrollY + innerHeight * b.zone || scrollY >= maxScroll() - 2) ? b : null;
  }

  /** Where the page will have scrolled to when this piece should be done: when the next row of pieces starts
   *  (or, for a short gap, when this one's top has risen a little way up the screen). */
  function dueAt(b: Block) {
    const after = list.find((x) => x.top > b.top + 8);
    const next = after ? after.top - innerHeight * ZONE : maxScroll();
    return Math.min(maxScroll(), Math.max(next, b.top - innerHeight * 0.42));
  }
  /** Milliseconds until the page gets there, at the building pace. */
  const msUntil = (y: number) => Math.max(700, ((y - scrollY) / STEP) * 16.67);

  function startBlock(c: Cur, b: Block, now: number) {
    const r = b.el.getBoundingClientRect();
    // Hold its size while its text is emptied and retyped, so nothing around it moves (and every box stays true).
    b.el.style.minWidth = `${r.width}px`; b.el.style.minHeight = `${r.height}px`;
    b.busy = true;
    const isTop = top.has(b), due = dueAt(b), budget = isTop ? 3800 : msUntil(due);
    c.job = { kind: 'block', b, phase: 'fly', t0: now, dur: Math.max(600, Math.min(1400, budget * 0.25)), x0: r.left, y0: r.top + scrollY, w: r.width, h: r.height, due, t1: 0, top: isTop, ty: typer() };
    c.idle = 0; c.used = true;
  }

  /** The box appears where the cursor clicks: its top-left corner, then it's dragged out. */
  function wire(b: Block) {
    const w = document.createElement('div'); w.className = 'bld-wire';
    w.innerHTML = `<div class="bw-frame"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span class="bw-name mono">${name(b.el)}</span><span class="bw-size mono">0 × 0</span></div>`;
    wires.appendChild(w); b.wire = w;
  }
  let hold = 0; // the scroll rests until then: a breath after each section, a longer one after a showpiece

  /** Shows a block for good: its text back in full, its background filled, its wire faded. */
  function finishBlock(b: Block, delay = 0) {
    b.done = true; b.busy = false;
    b.text?.forEach((t) => { t.node.data = t.full; if (t.wrap) { t.wrap.replaceWith(t.node); t.wrap = t.ghost = undefined; } });
    if (phase === 'build' && !top.has(b)) {
      const now = performance.now();
      if (b.key) hold = Math.max(hold, now + 1400);
      if (b.sec && list.every((x) => x.sec !== b.sec || x.done)) hold = Math.max(hold, now + 650);
    }
    setTimeout(() => {
      // The name is drawn by the hero's canvas, so it fades in rather than being typed.
      if (b.el.classList.contains('hero-name')) b.el.closest('[data-hero]')?.classList.add('name-in');
      if (b.fill) fillIn(b); else restore(b);
      b.el.classList.add('built'); b.el.classList.remove('typing'); b.wire?.classList.add('fade'); setTimeout(() => b.wire?.remove(), 700);
      // Pieces that put themselves together (the globe's dots) start now.
      [b.el, ...b.el.querySelectorAll('[data-assemble]')].forEach((el) => { if (el.matches('[data-assemble]')) el.dispatchEvent(new Event('bld:assemble')); });
    }, delay);
  }

  function frame(now: number) {
    raf = 0;
    const ms = Math.min(40, now - lastFrame), dt = ms / 16.67; lastFrame = now;
    avgMs += (ms - avgMs) * 0.05;

    if (phase === 'intro') {
      const p = Math.min(1, (now - t0) / 2100), e = 1 - Math.pow(1 - p, 3), base = Math.min(innerWidth, innerHeight) * 0.26;
      curs.forEach((c, k) => {
        const a = now / 900 + (k / curs.length) * Math.PI * 2, r = base * Math.max(0.15, e) + 46 + Math.sin(now / 300 + k) * 6;
        c.tx = innerWidth / 2 + Math.cos(a) * r; c.ty = innerHeight / 2 + Math.sin(a) * r;
      });
    } else if (phase === 'build') {
      // 1. Read first (all layout reads together, before anything is written): where each piece being built
      //    actually is now, and where the typed text ends.
      for (const c of curs) {
        const j = c.job;
        if (j?.kind !== 'block') continue;
        const r = j.b.el.getBoundingClientRect();
        j.x0 = r.left; j.y0 = r.top + scrollY; j.w = r.width; j.h = r.height;
        if (j.phase !== 'type') continue;
        const text = j.b.text!, ty = j.ty, t = text[Math.min(ty.ti, text.length - 1)];
        const key = ty.ti * 100000 + t.node.data.length;
        if (t.node.data.length && key !== ty.caret) {
          ty.caret = key;
          const range = document.createRange(); range.setStart(t.node, t.node.data.length - 1); range.setEnd(t.node, t.node.data.length);
          const rect = range.getBoundingClientRect();
          if (rect.height) { ty.cx = rect.right + 2; ty.cy = rect.top + rect.height / 2 + scrollY; }
        }
      }

      // 2. Hand out work, pieces in order: free cursors first, then new ones in from the nearest edge.
      const onTop = !topDone();
      for (const c of curs) {
        if (c.out || c.job) continue;
        const b = nextPiece(now); if (!b) break;
        startBlock(c, b, now);
      }
      for (let b = nextPiece(now); b && curs.filter((c) => !c.out).length < (onTop ? Math.max(CAP, RING) : CAP); b = nextPiece(now)) {
        const [x, y] = nearEdge(b.el.getBoundingClientRect()); startBlock(spawn(x, y), b, now);
      }
      // The top's done: one cursor swipes the finished name (the ink follows it and it dives a layer).
      const hero = $<HTMLElement>('[data-hero]'), title = hero && $<HTMLElement>('h1', hero);
      if (swipe === 'wait' && !onTop) {
        if (hero && title) {
          const r = title.getBoundingClientRect(), W = hero.getBoundingClientRect().width, mid = r.left + r.width / 2, span = W * 0.55;
          const free = curs.filter((c) => !c.out && !c.job).sort((a, b) => Math.hypot(a.x - mid, a.y - r.top) - Math.hypot(b.x - mid, b.y - r.top))[0] ?? spawn(...nearEdge(r));
          free.job = { kind: 'sweep', phase: 'fly', t0: now, x0: mid - span / 2, x1: mid + span / 2, y: r.top + r.height / 2 + scrollY, host: hero };
          swipe = 'busy';
        } else swipe = now;
      }

      // 3. Scroll, once the swipe is done: a steady STEP, slowing only if the oldest unfinished piece nears the top
      //    of the screen, and quicker over stretches with nothing to build.
      const lag = list.find((b) => !b.done);
      if (!lag && curs.every((c) => !c.job)) leave(true);
      else if (moving(now)) {
        let want = STEP;
        if (lag) {
          const rel = (lag.top - scrollY) / innerHeight;
          if (rel > lag.zone && !lag.busy) want = STEP * 4;
          else if (rel < 0.35) want = STEP * Math.max(0, (rel - 0.08) / 0.27);
        }
        if (now < hold) want = 0;
        vel += (want - vel) * Math.min(1, (now < hold ? 0.08 : 0.03) * dt);
        pos = Math.min(pos, maxScroll());
        if (pos < maxScroll()) {
          pos = Math.min(maxScroll(), pos + vel * dt);
          const dpr = devicePixelRatio || 1;
          scrollTo({ top: Math.round(pos * dpr) / dpr, behavior: 'instant' }); // whole device pixels: even steps
        }
      }

      // 4. Move each cursor along its job.
      for (const c of curs) {
        const j = c.job;
        c.el.classList.toggle('typing', j?.kind === 'block' && j.phase === 'type');
        if (!j) {
          // Idle: drift for a moment, then leave by the nearest edge if nothing comes up (none hang about).
          c.idle += dt;
          if ((c.idle > 24 || !c.used) && !c.out) { c.out = true; const [x, y] = offEdge(); c.tx = x; c.ty = y; }
          if (!c.out) { c.tx = c.x + Math.sin(now / 500 + c.i) * 2; c.ty = c.y + Math.cos(now / 600 + c.i) * 2; }
          continue;
        }
        if (j.kind === 'sweep') {
          if (j.phase === 'fly') { c.tx = j.x0; c.ty = j.y - scrollY; if (Math.hypot(c.x - c.tx, c.y - c.ty) < 16) { j.phase = 'swipe'; j.t0 = now; } }
          else {
            const k = Math.min(1, (now - j.t0) / 1500), e = ease(k);
            c.tx = c.x = j.x0 + (j.x1 - j.x0) * e; c.ty = c.y = j.y - scrollY - Math.sin(e * Math.PI) * 18; c.vx = c.vy = 0;
            j.host.dispatchEvent(new PointerEvent('pointermove', { clientX: c.x, clientY: c.y, pointerType: 'pen', bubbles: true }));
            if (k >= 1) {
              for (const type of ['pointerup', 'pointerleave']) j.host.dispatchEvent(new PointerEvent(type, { clientX: c.x, clientY: c.y, pointerType: 'pen' }));
              c.job = null; c.idle = 0; swipe = now;
            }
          }
          continue;
        }
        // The box follows its piece wherever it is now.
        if (j.b.wire) { const ws = j.b.wire.style; ws.left = `${j.x0}px`; ws.top = `${j.y0}px`; ws.width = `${j.w}px`; ws.height = `${j.h}px`; }
        if (j.phase === 'fly') {
          c.tx = j.x0; c.ty = j.y0 - scrollY;
          if (Math.hypot(c.x - c.tx, c.y - c.ty) < 12) {
            // Click: the box starts here.
            j.phase = 'drag'; j.t0 = now; wire(j.b);
            c.el.classList.add('click'); setTimeout(() => c.el.classList.remove('click'), 180);
          }
        } else if (j.phase === 'drag') {
          // The cursor sits exactly on the frame's growing corner, and the size label counts up underneath.
          const k = Math.min(1, (now - j.t0) / j.dur), e = ease(k);
          c.tx = c.x = j.x0 + j.w * e; c.ty = c.y = j.y0 - scrollY + j.h * e; c.vx = c.vy = 0;
          j.b.wire?.style.setProperty('--k', e.toFixed(4));
          const size = j.b.wire?.querySelector('.bw-size'); if (size) size.textContent = `${Math.round(j.w * e)} × ${Math.round(j.h * e)}`;
          if (k >= 1) {
            if (j.b.text) {
              // Empty the text (keeping its space), show the piece (bare, if it has a background), switch to the text cursor.
              for (const t of j.b.text) {
                const w = document.createElement('bld-t'), g = document.createElement('bld-g');
                g.textContent = t.full; t.node.replaceWith(w); w.append(t.node, g);
                t.node.data = ''; t.wrap = w; t.ghost = g.firstChild as Text;
              }
              bare(j.b);
              j.b.el.classList.add('built', 'typing');
              j.phase = 'type'; j.ty.cx = j.x0; j.ty.cy = j.y0 + 12;
              j.t1 = now + Math.max(1500, Math.min(5000, left(j.ty, j.b.text) * 45));
            } else { finishBlock(j.b); c.job = null; }
          }
        } else {
          // Paced to finish on time: as slow as a person when there's time, quicker (and tidier) when there isn't.
          const text = j.b.text!, ty = j.ty, rest = j.top ? Math.max(500, j.t1 - now) : Math.max(msUntil(j.due), Math.min(3500, left(ty, text) * 45));
          ty.rate = Math.max(9, Math.min(600, (left(ty, text) / (rest / 1000)) * 1.35));
          ty.acc += ms;
          for (let n = 0; ty.acc > 0 && ty.ti < text.length && n < 400; n++) ty.acc -= stroke(ty, text, wires);
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
      const sp = Math.hypot(c.vx, c.vy), lim = phase === 'intro' ? 40 : c.out ? 26 : 13; // leaving: quick, so none linger
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
  let ended = false, stayPut = false;
  /** Ends the build: on the home page's address, and (when it finished by itself) glides back to the top. */
  function leave(finished = false) {
    if (ended) return; ended = true; phase = 'leave';
    if (finished) setTimeout(() => {
      const from = scrollY, t1 = performance.now(), dur = Math.min(2600, 900 + from * 0.15);
      const glide = (now: number) => {
        if (stayPut) return;
        const k = Math.min(1, (now - t1) / dur);
        scrollTo({ top: from * (1 - ease(k)), behavior: 'instant' });
        if (k < 1) requestAnimationFrame(glide);
      };
      requestAnimationFrame(glide);
    }, 900);
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
    }, 2200);
  }
  const userScroll = () => { stayPut = true; if (phase === 'intro') wantsOut = true; else leave(); };
  addEventListener('wheel', userScroll, { passive: true });
  addEventListener('touchmove', userScroll, { passive: true });
  addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'End', 'Home'].includes(e.key)) userScroll(); });
  // Our own scrolling keeps `pos`; a scroll that lands somewhere else came from the visitor (scrollbar, find, …).
  // (The page can get shorter as pieces let go of their held size, which pulls the scroll up: that's not the visitor.)
  addEventListener('scroll', () => { if (phase === 'build' && Math.abs(scrollY - Math.min(pos, maxScroll())) > 8) leave(); }, { passive: true });
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
