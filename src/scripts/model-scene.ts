/**
 * The shared 3D stage for project models (the project page viewer and the hover preview on work cards):
 * lit like the hero's chrome letters, with an accent rim light, and centred whatever units Fusion exported in.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type ModelStage = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; pivot: THREE.Group;
  /** Size of the loaded model's bounding box (largest side), 0 until loaded. */
  radius: number;
  load(src: string): Promise<void>;
  setSize(w: number, h: number): void;
  /**
   * Frame the model as it looks right now (pivot's current rotation): centres its silhouette on screen and sizes it
   * to fill the view, with `margin` breathing room. For still poses (the cards); a spinning model keeps `fit`.
   */
  frameToView(margin?: number): void;
  render(): void;
  dispose(): void;
};

/**
 * fit 'side': the original wide project-page framing. 'fit': frames the model as large as its box allows (cards,
 * the pinned side panel); `margin` is the breathing room around it (1 = touching the edges).
 */
export function createStage(accentFrom: Element, fit: 'side' | 'fit' = 'side', canvas?: HTMLCanvasElement, margin = 1.15): ModelStage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
  const rim = new THREE.PointLight(new THREE.Color(getComputedStyle(accentFrom).getPropertyValue('--accent').trim() || '#7E76D0'), 40, 0, 1.5);
  scene.add(rim);
  const pivot = new THREE.Group(); scene.add(pivot);

  const size = new THREE.Vector3();
  let points: THREE.Vector3[] = []; // a sample of the model's vertices, in the pivot's space

  const frameToView = (m = margin) => {
    if (!points.length) return;
    pivot.updateMatrixWorld(true);
    const world = points.map((p) => p.clone().applyMatrix4(pivot.matrixWorld));
    const target = new THREE.Vector3(), back = cam.position.clone().normalize(); // keep the current viewing direction
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
    const up = new THREE.Vector3().crossVectors(back, right);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // First guess, ignoring perspective: centre and size from the silhouette as seen straight on.
    let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity, near = -Infinity;
    for (const p of world) { const r = p.dot(right), u = p.dot(up); r0 = Math.min(r0, r); r1 = Math.max(r1, r); u0 = Math.min(u0, u); u1 = Math.max(u1, u); near = Math.max(near, p.dot(back)); }
    target.addScaledVector(right, (r0 + r1) / 2).addScaledVector(up, (u0 + u1) / 2);
    let dist = Math.max((u1 - u0) / 2 / tanV, (r1 - r0) / 2 / (tanV * cam.aspect)) * m + Math.max(0, near);
    // Then correct for perspective with what the camera really sees, a few times until it settles.
    const ndc = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      cam.position.copy(target).addScaledVector(back, dist); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of world) { ndc.copy(p).project(cam); x0 = Math.min(x0, ndc.x); x1 = Math.max(x1, ndc.x); y0 = Math.min(y0, ndc.y); y1 = Math.max(y1, ndc.y); }
      const h = dist * tanV, w = h * cam.aspect;
      target.addScaledVector(right, ((x0 + x1) / 2) * w).addScaledVector(up, ((y0 + y1) / 2) * h);
      dist *= Math.max((x1 - x0) / 2, (y1 - y0) / 2) * m;
    }
    cam.position.copy(target).addScaledVector(back, dist); cam.lookAt(target); cam.updateProjectionMatrix();
  };
  const frame = () => {
    const r = stage.radius; if (!r) return;
    cam.near = r / 100; cam.far = r * 20;
    if (fit === 'side') {
      // The project page's original wide framing.
      cam.position.set(0, r * 0.35, r * 2.1);
    } else {
      // 'fit': as close as the model allows in this box's shape, with room for it to turn: its height must fit
      // the view's height, and its footprint (the widest it gets as it spins) the view's width.
      const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), foot = Math.hypot(size.x, size.z) / 2;
      const dist = Math.max(size.y / 2 / tanV, foot / (tanV * cam.aspect)) * margin + foot * 0.5;
      cam.position.set(0, dist * 0.18, dist);
    }
    cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    rim.position.set(-r * 1.5, r, -r);
  };

  const stage: ModelStage = {
    renderer, scene, cam, pivot, radius: 0,
    load: (src) => new Promise((ok, fail) => {
      const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(src, (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
        model.position.sub(c); pivot.add(model);
        stage.radius = Math.max(s.x, s.y, s.z); size.copy(s);
        // Keep up to ~20k vertices for frameToView: plenty to find the silhouette, cheap to project.
        model.updateMatrixWorld(true); points = [];
        let total = 0; model.traverse((o) => { if ((o as THREE.Mesh).isMesh) total += (o as THREE.Mesh).geometry.attributes.position.count; });
        const step = Math.max(1, Math.floor(total / 20000));
        model.traverse((o) => {
          const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
          const pos = mesh.geometry.attributes.position;
          for (let i = 0; i < pos.count; i += step) points.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
        });
        frame(); ok();
      }, undefined, fail);
    }),
    setSize: (w, h) => { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); frame(); },
    frameToView,
    render: () => renderer.render(scene, cam),
    dispose: () => { pmrem.dispose(); renderer.dispose(); if (!canvas) renderer.domElement.remove(); },
  };
  return stage;
}
