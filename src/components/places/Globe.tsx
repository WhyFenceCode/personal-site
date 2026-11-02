/**
 * A globe of small dots. Drag to spin (it keeps turning slowly when left alone, unless motion is off).
 * - Land dots are a light grey; countries you've been to are darker, and hovering one shows a card.
 * - Each place is a larger dot in a lighter shade; clicking one (on the globe or in the list) turns it accent
 *   and turns the globe to face it.
 * - On the build page the dots fly in from around it once the cursors have finished its box (the `bld:assemble` event).
 */
import { useEffect, useRef, useState } from 'react';
import { geoOrthographic, geoDistance } from 'd3-geo';
import { motionOn, onMotion } from '../../scripts/motion';

type Pin = { city: string; name: string; year: string; note: string; lng: number; lat: number; country: number };
type Props = { dots: [number, number, number][]; visited: number[]; names: string[]; pins: Pin[]; labels: { hint: string; places: string } };
type Hover = { x: number; y: number; title: string; lines: string[] } | null;

const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v * t + b[i] * (1 - t))).join(',')})`;
const rgb = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);

export default function Globe({ dots, visited, names, pins, labels }: Props) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [sel, setSel] = useState<number | null>(null);
  const api = useRef<{ face: (i: number) => void; redraw: () => void } | null>(null);
  const selRef = useRef<number | null>(null);
  selRef.current = sel;

  useEffect(() => {
    const canvas = cv.current!, host = wrap.current!, ctx = canvas.getContext('2d')!;
    const isVisited = new Set(visited);
    const proj = geoOrthographic().clipAngle(90);
    let rot: [number, number] = [-pins[0]?.lng || 75, -(pins[0]?.lat ?? 30) * 0.6];
    let vel = 0, dragging = false, last = performance.now(), raf = 0, alive = true, inView = true, target: [number, number] | null = null;
    // Build page: wait (drawing nothing) until the cursors finish this piece, then fly the dots in.
    let asm: number | null = document.documentElement.classList.contains('building') && !host.closest('.built') ? -1 : null;
    const seeds = dots.map(() => [Math.random() * Math.PI * 2, 1.15 + Math.random() * 0.9, Math.random() * 800]);
    const assemble = () => { if (asm === -1) { asm = performance.now(); kick(); } };
    host.addEventListener('bld:assemble', assemble);
    let W = 0, H = 0, R = 0, colors = { land: '', visited: '', pin: '', accent: '', halo: '' };

    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      W = host.clientWidth; H = Math.min(W, 560); R = Math.min(W, H) / 2 - 8;
      canvas.width = W * d; canvas.height = H * d; canvas.style.height = `${H}px`;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const cs = getComputedStyle(host), fg = rgb(cs.color), bg = rgb(getComputedStyle(host.closest('.home-section') ?? document.body).backgroundColor);
      colors = { land: mix(fg, bg, 0.3), visited: mix(fg, bg, 0.88), pin: mix(fg, bg, 0.55), accent: cs.getPropertyValue('--accent').trim() || '#7E76D0', halo: `rgb(${bg.join(',')})` };
      draw();
    };

    const visible = (lng: number, lat: number) => geoDistance([lng, lat], [-rot[0], -rot[1]]) < Math.PI / 2 - 0.02;
    function draw() {
      proj.scale(R).translate([W / 2, H / 2]).rotate([rot[0], rot[1], 0]);
      ctx.clearRect(0, 0, W, H);
      if (asm === -1) return;
      const since = asm === null ? Infinity : performance.now() - asm;
      if (since > 1900) asm = null;
      const ease = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
      // A faint outline of the sphere.
      ctx.globalAlpha = ease(since / 1200);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2); ctx.strokeStyle = colors.land; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;
      const r = Math.max(1.2, R / 175);
      dots.forEach(([lng, lat, c], i) => {
        if (!visible(lng, lat)) return;
        let p = proj([lng, lat]); if (!p) return;
        if (since < 1900) {
          // Flying in: from a scattered spot around the globe to its place, each dot a little after the last.
          const [a, d, delay] = seeds[i], e = ease((since - delay) / 1000);
          if (e <= 0) return;
          const sx = W / 2 + Math.cos(a) * R * d, sy = H / 2 + Math.sin(a) * R * d;
          p = [sx + (p[0] - sx) * e, sy + (p[1] - sy) * e];
        }
        ctx.fillStyle = isVisited.has(c) ? colors.visited : colors.land;
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
      });
      if (since < 1700) return; // the places land last
      pins.forEach((pin, i) => {
        if (!visible(pin.lng, pin.lat)) return;
        const p = proj([pin.lng, pin.lat]); if (!p) return;
        const on = selRef.current === i;
        ctx.fillStyle = colors.halo; ctx.beginPath(); ctx.arc(p[0], p[1], r * (on ? 6 : 4.6), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = on ? colors.accent : colors.pin; ctx.beginPath(); ctx.arc(p[0], p[1], r * (on ? 4.4 : 3.2), 0, Math.PI * 2); ctx.fill();
      });
    }

    const loop = (now: number) => {
      raf = 0; if (!alive) return;
      // Also start if the cue was missed: the build ended, or our piece is already finished.
      if (asm === -1 && (!document.documentElement.classList.contains('building') || !host.closest('.bld:not(.built)'))) assemble();
      const dt = Math.min(50, now - last); last = now;
      if (target) {
        rot[0] += ((target[0] - rot[0] + 540) % 360 - 180) * 0.12; rot[1] += (target[1] - rot[1]) * 0.12;
        if (Math.abs(((target[0] - rot[0] + 540) % 360) - 180) < 0.2 && Math.abs(target[1] - rot[1]) < 0.2) target = null;
      } else if (!dragging) {
        vel *= 0.94;
        rot[0] += vel + (motionOn() && Math.abs(vel) < 0.02 ? dt * 0.004 : 0);
      }
      draw();
      if (inView && (motionOn() || asm !== null || target || Math.abs(vel) > 0.01 || dragging)) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

    // Drag to spin: horizontal turns the globe, vertical tilts it a little.
    let lx = 0, ly = 0, moved = 0;
    const down = (e: PointerEvent) => { dragging = true; target = null; lx = e.clientX; ly = e.clientY; moved = 0; canvas.setPointerCapture(e.pointerId); kick(); };
    const move = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      if (dragging) {
        const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        const k = 90 / R; rot[0] += dx * k; rot[1] = Math.max(-60, Math.min(60, rot[1] - dy * k)); vel = dx * k;
        setHover(null); draw(); return;
      }
      setHover(hit(x, y));
    };
    const up = (e: PointerEvent) => {
      dragging = false; kick();
      if (moved < 6) { const b = canvas.getBoundingClientRect(); const h = pick(e.clientX - b.left, e.clientY - b.top); if (h !== null) choose(h); }
    };
    // What's under the pointer: a place (nearest within 12px) or a visited country (nearest dot within 7px).
    function pick(x: number, y: number): number | null {
      let best: number | null = null, bd = 12;
      pins.forEach((pin, i) => { if (!visible(pin.lng, pin.lat)) return; const p = proj([pin.lng, pin.lat]); if (!p) return; const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    function hit(x: number, y: number): Hover {
      const i = pick(x, y);
      if (i !== null) { const p = pins[i]; return { x, y, title: p.city, lines: [names[p.country] ?? '', [p.year, p.note].filter(Boolean).join(' · ')].filter(Boolean) }; }
      let best = -1, bd = 7;
      for (const [lng, lat, c] of dots) {
        if (!isVisited.has(c) || !visible(lng, lat)) continue;
        const p = proj([lng, lat]); if (!p) continue;
        const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = c; }
      }
      if (best < 0) return null;
      const here = pins.filter((p) => p.country === best).map((p) => p.city + (p.year ? ` (${p.year})` : ''));
      return { x, y, title: names[best], lines: [here.join(', ')] };
    }
    const choose = (i: number) => { setSel((s) => (s === i ? null : i)); face(i); };
    const face = (i: number) => { const p = pins[i]; target = [-p.lng, Math.max(-60, Math.min(60, -p.lat))]; kick(); };
    api.current = { face, redraw: draw };

    const leave = () => setHover(null);
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up); canvas.addEventListener('pointerleave', leave);
    const ro = new ResizeObserver(size); ro.observe(host);
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) kick(); }); io.observe(host);
    const off = onMotion(kick);
    size(); kick();
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); host.removeEventListener('bld:assemble', assemble); io.disconnect(); off();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('pointerleave', leave);
    };
  }, []);

  useEffect(() => { api.current?.redraw(); }, [sel]);

  return (
    <div className="globe" ref={wrap} data-assemble>
      <div className="globe-stage">
        <canvas ref={cv} className="globe-cv" role="img" aria-label={`Globe of ${pins.length} places`} />
        {hover && (
          <div className="globe-card" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
            <b>{hover.title}</b>{hover.lines.map((l, i) => <span key={i} className="muted">{l}</span>)}
          </div>
        )}
        <span className="globe-hint mono muted" aria-hidden="true">{labels.hint}</span>
      </div>
      <ul className="globe-list" aria-label={labels.places}>
        {pins.map((p, i) => (
          <li key={i}>
            <button type="button" aria-pressed={sel === i} onClick={() => { setSel((s) => (s === i ? null : i)); api.current?.face(i); }}>
              <span>{p.city}</span>{p.year && <span className="num muted">{p.year}</span>}
            </button>
          </li>
        ))}
      </ul>
      {sel !== null && (
        <p className="globe-sel" aria-live="polite">
          <b>{pins[sel].city}</b> <span className="muted">{[names[pins[sel].country], pins[sel].year, pins[sel].note].filter(Boolean).join(' · ')}</span>
        </p>
      )}
    </div>
  );
}
