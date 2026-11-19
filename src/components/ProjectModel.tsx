/**
 * A 3D model on a project page (frontmatter `model: /models/<name>.glb`, file in public/models/).
 * Drag to spin it; it also turns gently as the page scrolls. Lit like the hero's chrome, with an accent rim light.
 * See docs/guides/3d-models.md for exporting a model from Fusion.
 */
import { useEffect, useRef, useState } from 'react';
import { createStage } from '../scripts/model-scene';
import { motionOn } from '../scripts/motion';

/** fill: take the height of the parent (e.g. a pinned side panel) instead of a fixed 16:9-ish box. */
/** angle: where the model starts, in degrees (the project's `modelAngle`, same as its work card). */
type Props = { src: string; title: string; hint: string; fill?: boolean; angle?: { turn: number; tilt: number } };

export default function ProjectModel({ src, title, hint, fill = false, angle = { turn: 54, tilt: 26 } }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const el = host.current!; let alive = true, raf = 0;
    const stage = createStage(el, fill ? 'fit' : 'side'), { renderer, pivot } = stage;
    el.appendChild(renderer.domElement);

    const size = () => { const w = el.clientWidth, h = fill ? el.clientHeight : Math.round(w * 0.56); if (w && h) stage.setSize(w, h); };
    size();

    stage.load(src).then(() => { if (alive) { setState('ready'); kick(); } }, () => alive && setState('error'));

    // Drag sideways to spin, up and down to tip it a little towards or away from you (pitch is clamped).
    let yaw = angle.turn * Math.PI / 180, vel = 0, pitch = angle.tilt * Math.PI / 180, drag = false, lx = 0, ly = 0;
    const PITCH = 0.7, P0 = pitch; // up to ~40° either way from the starting tilt
    const loop = () => {
      raf = 0; if (!alive) return;
      if (!drag) { vel *= 0.95; yaw += vel + (motionOn() ? 0.002 : 0); }
      // A pinned model never moves on screen, so it turns with the page's scroll instead of its own position.
      const scroll = !motionOn() ? 0 : fill ? (scrollY / innerHeight) * 0.5 : (el.getBoundingClientRect().top / innerHeight - 0.5) * 0.6;
      pivot.rotation.set(pitch + (fill ? 0 : scroll * 0.4), yaw + scroll, 0);
      stage.render();
      raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const cv = renderer.domElement;
    cv.style.touchAction = 'pan-y'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      vel = (e.clientX - lx) * 0.008; yaw += vel; lx = e.clientX;
      pitch = Math.max(P0 - PITCH, Math.min(P0 + PITCH, pitch + (e.clientY - ly) * 0.006)); ly = e.clientY;
    });
    const up = () => { drag = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(size); ro.observe(el);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); stage.dispose(); };
  }, [src, fill, angle.turn, angle.tilt]);

  return (
    <figure className="model" aria-label={`3D model: ${title}`}>
      <div ref={host} className="model-stage" />
      <figcaption className="mono muted">{state === 'error' ? `Couldn't load ${src}` : state === 'loading' ? 'Loading model…' : hint}</figcaption>
    </figure>
  );
}
