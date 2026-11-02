/**
 * Interactive extras, each switched on in site.yaml → interactive (listed in <body data-ix>).
 * Everything that moves also stops when motion is off (footer toggle, or reduced motion on the device).
 *
 *   tiltCards  cards tilt toward the pointer, an accent outline drifting behind them
 *   record     drag the Listening record to spin it, with momentum
 *   magnetic   main buttons lean toward the pointer
 *   depth      headings and big numbers drift at different speeds on scroll
 *   sheen      a faint light follows the pointer
 *   pageTilt   pages tilt in 3D as they change
 *   wind       marquee words lean with scroll speed
 */
import { motionOn, onMotion } from './motion';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const on = (k: string) => (document.body.dataset.ix ?? '').split(' ').includes(k);
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} } };

let mx = -1, my = -1;
addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

/* ---------- Tilting cards ---------- */
const TILT = '.tile, [data-grid] .card, .resume-cta';
function initTilt() {
  if (!on('tiltCards') || !fine.matches) return;
  $$(TILT).forEach((el) => {
    if (el.dataset.tilt) return; el.dataset.tilt = '1'; el.classList.add('tilt');
    el.addEventListener('pointermove', (e) => {
      if (!motionOn()) return;
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`); el.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
      el.style.setProperty('--ox', `${(-x * 14).toFixed(1)}px`); el.style.setProperty('--oy', `${(-y * 14).toFixed(1)}px`);
      el.classList.add('tilt-on');
    });
    el.addEventListener('pointerleave', () => { el.classList.remove('tilt-on'); ['--rx', '--ry', '--ox', '--oy'].forEach((p) => el.style.removeProperty(p)); });
  });
}

/* ---------- Magnetic buttons ---------- */
const MAGNET = '.cbtn, .btn, .visit, .hero-resume, .hnav-link.is-contact';
let magRaf = 0;
addEventListener('pointermove', () => {
  if (!on('magnetic') || !fine.matches || magRaf) return;
  magRaf = requestAnimationFrame(() => {
    magRaf = 0;
    for (const el of $$(MAGNET)) {
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = mx - cx, dy = my - cy;
      const reach = Math.max(r.width, r.height) / 2 + 60, d = Math.hypot(dx, dy);
      // A small lean toward the pointer (at most ~3px) and a slight swell, not a jump.
      const near = motionOn() && d < reach, pull = near ? 1 - d / reach : 0;
      el.style.translate = near ? `${clamp(dx * 0.05, -3, 3).toFixed(1)}px ${clamp(dy * 0.07, -2, 2).toFixed(1)}px` : '';
      el.style.scale = near ? (1 + pull * 0.03).toFixed(3) : '';
    }
  });
}, { passive: true });

/* ---------- Scroll depth ---------- */
// How far each kind of element drifts, as a share of its distance from the middle of the screen.
const DEPTH: [string, number][] = [['.h2', 0.14], ['.eyebrow', 0.24], ['.stat', -0.1], ['.big', 0.16], ['.sec-cta', 0.1], ['.globe-stage', -0.05]];
let depthRaf = 0;
function depth() {
  depthRaf = 0;
  const live = on('depth') && motionOn() && !document.documentElement.classList.contains('building');
  for (const [sel, k] of DEPTH) for (const el of $$(sel)) {
    // Not inside cards (they tilt, and their contents would slide over each other) or the loader.
    if (el.closest('#loader, .resume-cta, .tile, .card')) { el.style.translate = ''; continue; }
    const r = el.getBoundingClientRect();
    if (!live) { el.style.translate = ''; continue; }
    if (r.bottom < -200 || r.top > innerHeight + 200) continue;
    el.style.translate = `0 ${((r.top + r.height / 2 - innerHeight / 2) * k).toFixed(1)}px`;
  }
}
addEventListener('scroll', () => { if (!depthRaf) depthRaf = requestAnimationFrame(depth); }, { passive: true });

/* ---------- Pointer sheen ---------- */
addEventListener('pointermove', (e) => {
  const s = $('#sheen'); if (!s) return;
  const live = on('sheen') && fine.matches && motionOn() && e.pointerType === 'mouse';
  s.classList.toggle('on', live);
  if (live) { s.style.setProperty('--sx', `${e.clientX}px`); s.style.setProperty('--sy', `${e.clientY}px`); }
}, { passive: true });

/* ---------- 3D page tilt ---------- */
const transitionsOn = () => document.body.dataset.transitions === 'true' && motionOn() && on('pageTilt');
document.addEventListener('astro:before-preparation', () => {
  if (!transitionsOn()) return;
  $('#main')?.animate([{ transform: 'none' }, { transform: 'perspective(1400px) rotateX(-5deg) translateY(-30px) scale(.97)', opacity: 0.6 }],
    { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
});
document.addEventListener('astro:after-swap', () => {
  if (!transitionsOn()) return;
  $('#main')?.animate([{ transform: 'perspective(1400px) rotateX(7deg) translateY(60px) scale(.97)', opacity: 0.4, transformOrigin: '50% 0' }, { transform: 'none', opacity: 1, transformOrigin: '50% 0' }],
    { duration: 950, easing: 'cubic-bezier(.2,.7,.1,1)' });
});

/* ---------- Wind in the marquee ---------- */
let lastY = scrollY, lean = 0, windRaf = 0, windT = 0;
function wind(now: number) {
  windRaf = 0; windT = now;
  const v = scrollY - lastY; lastY = scrollY;
  lean = clamp(lean * 0.9 + v * 0.35, -16, 16);
  const flutter = Math.sin(now / 70) * Math.min(3, Math.abs(lean) * 0.25);
  $$('.marquee').forEach((m) => m.style.setProperty('--lean', `${(-lean + flutter).toFixed(2)}deg`));
  if (Math.abs(lean) > 0.05 || Math.abs(v) > 0) windRaf = requestAnimationFrame(wind);
  else $$('.marquee').forEach((m) => m.style.removeProperty('--lean'));
}
addEventListener('scroll', () => { if (on('wind') && motionOn() && !windRaf) { lastY = lastY || scrollY; windRaf = requestAnimationFrame(wind); } }, { passive: true });
void windT;

/* ---------- Draggable record ---------- */
function initRecord() {
  if (!on('record')) return;
  $$('.record').forEach((rec) => {
    if (rec.dataset.spin) return; rec.dataset.spin = '1'; rec.classList.add('js-spin');
    const BASE = 0.15; // degrees per ms, the normal 2.4s per turn
    let angle = 0, vel = BASE, drag = false, hover = false, last = performance.now(), prevA = 0, prevT = 0, raf = 0, inView = true;
    const centre = () => { const r = rec.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const at = (e: PointerEvent) => { const [cx, cy] = centre(); return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI; };
    const tick = (now: number) => {
      raf = 0; const dt = Math.min(50, now - last); last = now;
      if (!drag) {
        const target = hover || !motionOn() ? 0 : BASE;
        vel += (target - vel) * Math.min(1, dt * 0.004);
        angle += vel * dt;
      }
      rec.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      if (inView && (drag || Math.abs(vel) > 0.001 || (motionOn() && !hover))) raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    rec.addEventListener('pointerdown', (e) => { drag = true; prevA = at(e); prevT = performance.now(); rec.setPointerCapture(e.pointerId); kick(); });
    rec.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const a = at(e), now = performance.now(); let d = a - prevA; if (d > 180) d -= 360; if (d < -180) d += 360;
      angle += d; vel = d / Math.max(1, now - prevT); prevA = a; prevT = now;
    });
    const release = () => { drag = false; kick(); };
    rec.addEventListener('pointerup', release); rec.addEventListener('pointercancel', release);
    rec.addEventListener('pointerenter', () => { hover = true; kick(); });
    rec.addEventListener('pointerleave', () => { hover = false; kick(); });
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) kick(); }).observe(rec);
    onMotion(kick); kick();
  });
}

/* ---------- Signature ---------- */
function initSignature() {
  const sig = $$('[data-signature]');
  if (!('IntersectionObserver' in window)) { sig.forEach((s) => s.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.6 });
  sig.forEach((s) => io.observe(s));
}

/* ---------- Wiring ---------- */
document.addEventListener('astro:page-load', () => { initTilt(); initRecord(); initSignature(); depth(); });
onMotion(() => depth());
