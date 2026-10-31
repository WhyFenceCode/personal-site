/**
 * The GitHub calendar in 3D: every day's tile lifted into a small cube (busier days a little taller, the busiest
 * in the accent colour), seen from almost straight above and tilted back just enough to show the cubes' fronts.
 * It sits flat in the page like the 2D calendar, doesn't move, and is drawn only when something changes.
 * Shown by default; the "3D" button switches back to the flat calendar (it dispatches `gh-city` on the window).
 * If WebGL isn't available, the flat calendar simply stays.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Day = { date: string; count: number; level: number };
type Props = { weeks: Day[][]; label: string };

const TILT = THREE.MathUtils.degToRad(20); // how far the view leans back from straight down
const TURN = THREE.MathUtils.degToRad(6);  // a slight turn to the side, so the cubes' side faces show too

export default function GitHubCity({ weeks, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const onToggle = (e: Event) => setShown((e as CustomEvent<boolean>).detail);
    addEventListener('gh-city', onToggle);
    return () => removeEventListener('gh-city', onToggle);
  }, []);

  useEffect(() => {
    const el = host.current!; const cal = el.closest<HTMLElement>('[data-gh-cal]');
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    cal?.classList.add('city-on');
    cal?.querySelector('[data-gh-3d]')?.setAttribute('aria-pressed', 'true');

    const scene = new THREE.Scene();
    const css = getComputedStyle(el);
    const fg = new THREE.Color(css.color), accent = new THREE.Color(css.getPropertyValue('--accent').trim() || '#5B4CFF');
    const bg = new THREE.Color(getComputedStyle(el.closest('.home-section') ?? document.body).backgroundColor);
    const days = weeks.flatMap((w, x) => w.map((d, y) => ({ ...d, x, y }))).filter((d) => d.level >= 0);
    const max = Math.max(1, ...days.map((d) => d.count));
    const cols = weeks.length, rows = 7, S = 0.62;   // cube size in a 1-unit cell; the gap leaves room to see each front
    const heightOf = (d: Day) => S * (1 + (d.count / max) * 0.7);
    const hMax = Math.max(...days.map(heightOf));

    const geo = new THREE.BoxGeometry(S, 1, S); geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, days.length);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const tone = (d: Day) => (d.level >= 4 ? accent : c.copy(bg).lerp(fg, [0.14, 0.32, 0.56, 0.8][d.level] ?? 0.14));
    days.forEach((d, i) => {
      m.makeScale(1, heightOf(d), 1); m.setPosition(d.x - (cols - 1) / 2, 0, d.y - (rows - 1) / 2);
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, tone(d));
    });
    scene.add(mesh);
    // Light mostly from straight above (a touch from behind and the left): tops bright, fronts clearly darker,
    // which is what makes each tile read as a cube.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 20, -6); scene.add(key);

    // Orthographic, so the grid lines up with the page like the flat calendar does.
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    // The turn skews the grid a little, so leave a bit more room around it.
    const spanW = cols + 1.4, spanH = rows * Math.cos(TILT) + hMax * Math.sin(TILT) + cols * Math.sin(TURN) * Math.sin(TILT) + 1;
    cam.position.set(Math.sin(TURN) * Math.sin(TILT) * 60, Math.cos(TILT) * 60, Math.cos(TURN) * Math.sin(TILT) * 60); cam.lookAt(0, hMax * 0.25, 0);
    const size = () => {
      const w = el.clientWidth, h = Math.round((w * spanH) / spanW);
      renderer.setSize(w, h);
      cam.left = -spanW / 2; cam.right = spanW / 2; cam.top = spanH / 2; cam.bottom = -spanH / 2; cam.updateProjectionMatrix();
      draw();
    };
    const draw = () => renderer.render(scene, cam);

    // Hover a cube to read its day, like the flat calendar; it lifts in the accent colour.
    const read = cal?.querySelector<HTMLElement>('[data-gh-read]');
    const fmt = new Intl.DateTimeFormat(document.documentElement.lang, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    const ray = new THREE.Raycaster(), p = new THREE.Vector2();
    let lit = -1;
    const cv = renderer.domElement;
    const move = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, cam);
      const hit = ray.intersectObject(mesh)[0]?.instanceId ?? -1;
      if (hit === lit) return;
      if (lit >= 0) mesh.setColorAt(lit, tone(days[lit]));
      lit = hit;
      if (hit >= 0) {
        mesh.setColorAt(hit, accent);
        const d = days[hit];
        if (read) read.textContent = `${d.count} contribution${d.count === 1 ? '' : 's'} · ${fmt.format(new Date(d.date + 'T12:00:00Z'))}`;
      }
      mesh.instanceColor!.needsUpdate = true; draw();
    };
    const leave = () => { if (lit >= 0) { mesh.setColorAt(lit, tone(days[lit])); mesh.instanceColor!.needsUpdate = true; lit = -1; draw(); } };
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerleave', leave);
    const ro = new ResizeObserver(size); ro.observe(el);
    size();
    return () => { ro.disconnect(); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerleave', leave); geo.dispose(); mat.dispose(); mesh.dispose(); renderer.dispose(); cv.remove(); cal?.classList.remove('city-on'); };
  }, []);

  return <div ref={host} className="gh-city" role="img" aria-label={label} hidden={!shown} />;
}
