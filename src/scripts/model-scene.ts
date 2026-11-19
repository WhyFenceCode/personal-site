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
        frame(); ok();
      }, undefined, fail);
    }),
    setSize: (w, h) => { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); frame(); },
    render: () => renderer.render(scene, cam),
    dispose: () => { pmrem.dispose(); renderer.dispose(); if (!canvas) renderer.domElement.remove(); },
  };
  return stage;
}
