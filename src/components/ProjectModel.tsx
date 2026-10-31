/**
 * A 3D model on a project page (frontmatter `model: /models/<name>.glb`, file in public/models/).
 * Drag to spin it; it also turns gently as the page scrolls. Lit like the hero's chrome, with an accent rim light.
 * See docs/guides/3d-models.md for exporting a model from Fusion.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { motionOn } from '../scripts/motion';

type Props = { src: string; title: string; hint: string };

export default function ProjectModel({ src, title, hint }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const el = host.current!; let alive = true, raf = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
    const rim = new THREE.PointLight(new THREE.Color(getComputedStyle(el).getPropertyValue('--accent').trim() || '#5B4CFF'), 40, 0, 1.5);
    scene.add(rim);
    const pivot = new THREE.Group(); scene.add(pivot);

    const size = () => { const w = el.clientWidth, h = Math.round(w * 0.56); renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    size();

    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(src, (gltf) => {
      if (!alive) return;
      const model = gltf.scene;
      // Centre it and frame it, whatever units Fusion exported in.
      const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      model.position.sub(c); pivot.add(model);
      const r = Math.max(s.x, s.y, s.z);
      cam.near = r / 100; cam.far = r * 20; cam.position.set(0, r * 0.35, r * 2.1); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
      rim.position.set(-r * 1.5, r, -r); rim.distance = 0;
      setState('ready'); kick();
    }, undefined, () => alive && setState('error'));

    let yaw = 0.6, vel = 0, drag = false, lx = 0;
    const loop = () => {
      raf = 0; if (!alive) return;
      if (!drag) { vel *= 0.95; yaw += vel + (motionOn() ? 0.002 : 0); }
      const scroll = motionOn() ? (el.getBoundingClientRect().top / innerHeight - 0.5) * 0.6 : 0;
      pivot.rotation.set(scroll * 0.4, yaw + scroll, 0);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const cv = renderer.domElement;
    cv.style.touchAction = 'pan-y'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; vel = (e.clientX - lx) * 0.008; yaw += vel; lx = e.clientX; });
    const up = () => { drag = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(size); ro.observe(el);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); pmrem.dispose(); renderer.dispose(); cv.remove(); };
  }, [src]);

  return (
    <figure className="model" aria-label={`3D model: ${title}`}>
      <div ref={host} className="model-stage" />
      <figcaption className="mono muted">{state === 'error' ? `Couldn't load ${src}` : state === 'loading' ? 'Loading model…' : hint}</figcaption>
    </figure>
  );
}
