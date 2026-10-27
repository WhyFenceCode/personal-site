/**
 * The name block's WebGL layer stack.
 *
 * Every layer in hero.yaml becomes a full-size texture: flat layers are drawn with the 2D
 * canvas, chrome layers are inflated 3D letters rendered with Three.js into a render target.
 * The visible image is the current layer, with the next layer showing through the ink blob.
 * When the ink crosses the name from one side to the other, the next layer floods the whole
 * block and becomes the new surface. Touch devices (and idle desktops) get a self-playing sweep.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { inkField, loopOn, differenceInk, NOISE, MASK_GLSL, type InkField } from '../../scripts/gl';
import { motionOn, onMotion, isTouch } from '../../scripts/motion';

type Layer = {
  id: string; label: string; kind: 'flat' | 'chrome' | 'rope' | 'blocks'; font: 'display' | 'serif' | 'pixel' | 'mono' | 'text';
  weight: number; stretch: number; italic: boolean; case: 'upper' | 'none'; ink: string; paper: string; outline: boolean; text?: string;
};
type Props = {
  layers: Layer[];
  autoplay: { mobile: boolean; desktop: boolean; intervalSeconds: number; selfDive: 'touch' | 'always' | 'never'; firstDiveAfter: number };
  dive: number;
  labels: { layer: string };
};

const FAMILY: Record<Layer['font'], string> = {
  display: '"Bricolage Grotesque Variable"',
  serif: '"Instrument Serif"',
  pixel: '"Pixelify Sans Variable"',
  mono: '"DM Mono"',
  text: '"Instrument Sans Variable"',
};
const stretchKw = (s: number) => (s <= 75 ? 'condensed' : s <= 90 ? 'semi-condensed' : 'normal');
// The stretch keyword goes inside the shorthand: assigning ctx.font resets ctx.fontStretch.
const fontCss = (L: Layer, px: number) => `${L.italic ? 'italic ' : ''}${L.weight} ${stretchKw(L.stretch)} ${px}px ${FAMILY[L.font]}, sans-serif`;
function setFont(ctx: CanvasRenderingContext2D, L: Layer, px: number) {
  ctx.font = fontCss(L, px);
  const c = ctx as any;
  try { c.fontStretch = stretchKw(L.stretch); c.letterSpacing = L.font === 'display' ? `${-0.02 * px}px` : '0px'; } catch {}
}

type Line = { text: string; x: number; y: number; w: number; h: number };
type Box = { l: number; t: number; r: number; b: number };

/** Draw the name lines for a layer into a 2D context, each line fitted to its DOM box. */
function drawLines(ctx: CanvasRenderingContext2D, L: Layer, lines: Line[], scale: number, color: string, outline: boolean) {
  for (const line of lines) {
    const text = L.case === 'upper' ? line.text.toUpperCase() : line.text;
    setFont(ctx, L, 100);
    const m = ctx.measureText(text);
    const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
    let size = (100 * line.w) / Math.max(1, m.width);
    const inkH = ((asc + desc) * size) / 100;
    if (inkH > line.h * 1.12) size *= (line.h * 1.12) / inkH;
    const px = size * scale;
    setFont(ctx, L, px);
    const m2 = ctx.measureText(text);
    const x = (line.x + line.w / 2) * scale - m2.width / 2;
    const y = (line.y + line.h / 2) * scale + (m2.actualBoundingBoxAscent - m2.actualBoundingBoxDescent) / 2;
    if (outline) { ctx.lineWidth = Math.max(1.5 * scale, px * 0.018); ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); }
    else { ctx.fillStyle = color; ctx.fillText(text, x, y); }
  }
}

/* ---------- Stroke tracing for the rope layer ---------- */
type Pt = [number, number];
/** Zhang–Suen thinning: reduces each letter stroke in a white-on-black mask to a 1-pixel centre line. */
function thin(md: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const img = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) img[i] = md[i * 4] > 127 ? 1 : 0;
  const del: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!img[i]) continue;
        const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1], p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let a = 0; for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) a++;
        if (a !== 1) continue;
        if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        del.push(i);
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
  }
  return img;
}
/** Splits a 1-pixel skeleton into polylines between ends and junctions (closed loops for O, D, etc.). */
function strokes(sk: Uint8Array, w: number, h: number): Pt[][] {
  const N = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  const nb = (i: number) => N.map((d) => i + d).filter((j) => j >= 0 && j < w * h && sk[j] && Math.abs((j % w) - (i % w)) <= 1);
  const deg = (i: number) => nb(i).length;
  const node = (i: number) => deg(i) !== 2;
  const used = new Set<string>(), seen = new Set<number>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const xy = (i: number): Pt => [i % w, Math.floor(i / w)];
  const walk = (from: number, to: number) => {
    const path = [from]; let prev = from, cur = to;
    used.add(key(prev, cur));
    for (;;) {
      path.push(cur);
      if (node(cur) || seen.has(cur)) break;
      seen.add(cur);
      const next = nb(cur).find((j) => j !== prev && !used.has(key(cur, j)));
      if (next === undefined) break;
      used.add(key(cur, next)); prev = cur; cur = next;
    }
    return path;
  };
  const out: Pt[][] = [];
  for (let i = 0; i < w * h; i++) if (sk[i] && node(i)) for (const j of nb(i)) if (!used.has(key(i, j))) out.push(walk(i, j).map(xy));
  for (let i = 0; i < w * h; i++) if (sk[i] && !node(i) && !seen.has(i)) { const j = nb(i)[0]; if (j !== undefined) out.push(walk(i, j).map(xy)); }
  return out;
}
const pathLength = (l: Pt[]) => l.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);
/** Moving-average smoothing that keeps the end points in place. */
function smoothOpen(l: Pt[], passes: number): Pt[] {
  let out = l;
  for (let k = 0; k < passes; k++) out = out.map((p, i) => {
    if (i === 0 || i === out.length - 1) return p;
    const a = out[i - 1], b = out[i + 1];
    return [(a[0] + p[0] * 2 + b[0]) / 4, (a[1] + p[1] * 2 + b[1]) / 4] as Pt;
  });
  return out;
}
/** Even spacing along an open path. */
function resampleOpen(l: Pt[], step: number): Pt[] {
  const out: Pt[] = [l[0]]; let carry = 0;
  for (let i = 0; i < l.length - 1; i++) {
    const a = l[i], b = l[i + 1], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= seg) { const t = d / seg; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d += step; }
    carry = seg - (d - step);
  }
  out.push(l[l.length - 1]);
  return out;
}

function start(cv: HTMLCanvasElement, { layers, autoplay, dive, labels }: Props): () => void {
  const host = cv.closest<HTMLElement>('[data-hero]')!;
  const labelEl = host.querySelector<HTMLElement>('[data-layer-label]');
  const nextBtn = host.querySelector<HTMLButtonElement>('[data-layer-next]');
  const touch = isTouch();

  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: false, powerPreference: 'high-performance' }); }
  catch { cv.remove(); return differenceInk(host); }
  const dpr = Math.min(devicePixelRatio || 1, touch ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(30, 1, 1, 50000);
  const F: InkField = inkField(host, { wander: false });
  const fieldTex = new THREE.CanvasTexture(F.field);
  fieldTex.minFilter = THREE.LinearFilter; fieldTex.generateMipmaps = false;

  const uniforms = {
    tBase: { value: null as THREE.Texture | null }, tTop: { value: null as THREE.Texture | null }, tField: { value: fieldTex },
    uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 }, uCommit: { value: new THREE.Vector3(0, 0, 0) },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tBase, tTop, tField; uniform vec2 uRes; uniform float uT; uniform vec3 uCommit;` + NOISE + MASK_GLSL + `
      void main(){
        float m = inkMask(tField, vUv, uRes, uT);
        vec2 p = vUv * uRes;
        float n = fbm(p / uRes.y * 2.6 + vec2(uT * .5, uT * .3));
        float cr = uCommit.z * (1. + .22 * (n - .5));
        float c = 1. - smoothstep(cr - 1.5, cr + 1.5, distance(p, uCommit.xy));
        m = max(m, step(.5, uCommit.z) * c);
        gl_FragColor = vec4(mix(texture2D(tBase, vUv).rgb, texture2D(tTop, vUv).rgb, m), 1.);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  }));
  const pScene = new THREE.Scene(); pScene.add(quad);
  const pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let W = 1, H = 1, lines: Line[] = [], box: Box = { l: 0, t: 0, r: 0, b: 0 }, fontPx = 100;

  function measure() {
    const hr = host.getBoundingClientRect();
    W = Math.max(1, hr.width); H = Math.max(1, hr.height);
    lines = [...host.querySelectorAll<HTMLElement>('.hero-line')].filter((el) => el.offsetParent).map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent?.trim() ?? '', x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height };
    });
    box = lines.reduce((b, l) => ({ l: Math.min(b.l, l.x), t: Math.min(b.t, l.y), r: Math.max(b.r, l.x + l.w), b: Math.max(b.b, l.y + l.h) }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
    fontPx = lines[0]?.h ?? 100;
  }

  /* ---------- Layer builders ---------- */
  type Built = { tex: THREE.Texture; render?: () => void; dispose: () => void };
  const built = new Map<number, Built>();

  function buildFlat(L: Layer): Built {
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = L.paper; ctx.fillRect(0, 0, c.width, c.height);
    drawLines(ctx, L, lines, dpr, L.ink, L.outline);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    return { tex, dispose: () => tex.dispose() };
  }

  /** The name lines drawn white-on-black into a small canvas around the text box (shared by the 3D layers). */
  function textMask(L: Layer, S: number) {
    const pad = fontPx * 0.12;
    const bl = Math.max(0, box.l - pad), bt = Math.max(0, box.t - pad), bw = Math.min(W, box.r + pad) - bl, bh = Math.min(H, box.b + pad) - bt;
    const cw = Math.max(8, Math.ceil(bw * S)), ch = Math.max(8, Math.ceil(bh * S));
    const mask = document.createElement('canvas'); mask.width = cw; mask.height = ch;
    const mc = mask.getContext('2d', { willReadFrequently: true })!;
    mc.fillStyle = '#000'; mc.fillRect(0, 0, cw, ch);
    mc.translate(-bl * S, -bt * S);
    drawLines(mc, L, lines, S, '#fff', false);
    mc.setTransform(1, 0, 0, 1, 0, 0);
    return { mask, md: mc.getImageData(0, 0, cw, ch).data, bl, bt, bw, bh, cw, ch, S };
  }

  /** A 3D scene for one layer: background in the layer's paper colour, the studio environment,
      a key light that follows the ink, a gentle tilt toward the pointer, rendered into a texture. */
  function stage(L: Layer) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(L.paper); scene.environment = env;
    const key = new THREE.PointLight(0xffffff, 4, 0, 0);
    const group = new THREE.Group();
    scene.add(key, group);
    const rt = new THREE.WebGLRenderTarget(Math.round(W * dpr), Math.round(H * dpr), { samples: touch ? 0 : 4 });
    const draw = (animate?: () => void) => {
      key.position.set(F.ax - W / 2, H / 2 - F.ay, fontPx * 1.4);
      group.rotation.y += ((F.ax / W - 0.5) * 0.22 - group.rotation.y) * 0.05;
      group.rotation.x += ((F.ay / H - 0.5) * 0.3 - group.rotation.x) * 0.05;
      animate?.();
      renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    };
    return { scene, group, rt, draw };
  }
  const toScene = (x: number, y: number) => new THREE.Vector3(x - W / 2, H / 2 - y, 0);

  /** Inflated metal letters. */
  function buildChrome(L: Layer): Built {
    const { mask, md, bl, bt, bw, bh, cw, ch, S } = textMask(L, touch ? 0.4 : 0.5);
    const blur = document.createElement('canvas'); blur.width = cw; blur.height = ch;
    const bc = blur.getContext('2d', { willReadFrequently: true })!;
    bc.filter = `blur(${Math.max(2, fontPx * S * (L.font === 'serif' ? 0.035 : 0.055))}px)`;
    bc.drawImage(mask, 0, 0);
    const bd = bc.getImageData(0, 0, cw, ch).data;
    const segX = Math.min(touch ? 260 : 480, Math.round(cw * 0.8)), segY = Math.max(8, Math.round((segX * ch) / cw));
    const geo = new THREE.PlaneGeometry(bw, bh, segX, segY);
    const pos = geo.attributes.position, uv = geo.attributes.uv, depth = fontPx * 0.12;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.min(cw - 1, Math.round(uv.getX(i) * (cw - 1))), y = Math.min(ch - 1, Math.round((1 - uv.getY(i)) * (ch - 1)));
      const k = (y * cw + x) * 4, inside = md[k] > 127, b = bd[k] / 255;
      pos.setZ(i, inside ? Math.sqrt(Math.max(0, Math.min(1, (b - 0.45) * 2))) * depth : 0);
    }
    geo.computeVertexNormals();
    const alpha = new THREE.CanvasTexture(mask);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.16, envMapIntensity: 1.3, alphaMap: alpha, alphaTest: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(toScene(bl + bw / 2, bt + bh / 2));
    const st = stage(L); st.group.add(mesh); st.draw();
    return { tex: st.rt.texture, render: () => st.draw(), dispose: () => { geo.dispose(); mat.dispose(); alpha.dispose(); st.rt.dispose(); } };
  }

  /** Soft shadows: a light from the upper left casts the 3D object onto an invisible plane behind it. */
  function addShadow(scene: THREE.Scene, depth: number, opacity = 0.22) {
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-W * 0.25, H * 0.45, fontPx * 5);
    sun.castShadow = true;
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -W / 1.6; sc.right = W / 1.6; sc.top = H / 1.6; sc.bottom = -H / 1.6; sc.near = 1; sc.far = fontPx * 14;
    sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
    sun.shadow.radius = 6; sun.shadow.bias = -0.0005;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, H * 2), new THREE.ShadowMaterial({ opacity }));
    plane.position.z = -depth; plane.receiveShadow = true;
    scene.add(sun, sun.target, plane);
    return () => { plane.geometry.dispose(); (plane.material as THREE.Material).dispose(); sun.dispose(); };
  }

  /** A glossy ribbed tube folded along the centre line of every letter stroke, labels running along it. */
  function buildRope(L: Layer): Built {
    const target = touch ? 56 : 72;                          // mask text height in pixels for tracing
    const { md, bl, bt, cw, ch, S } = textMask(L, Math.min(0.6, target / Math.max(1, fontPx)));
    const r = Math.max(3, fontPx * (L.font === 'serif' ? 0.035 : 0.065));   // tube radius ≈ half a stroke
    const paths = strokes(thin(md, cw, ch), cw, ch)
      .map((pth) => pth.map(([x, y]) => [bl + x / S, bt + y / S] as Pt))
      .filter((pth) => pathLength(pth) > r * 1.2)
      .map((pth) => resampleOpen(smoothOpen(pth, 4), r * 0.5));

    // Texture along the tube: one rib per tile with a white label pill on it.
    const period = r * 2.6, text = (L.text ?? 'HELLO').toUpperCase();
    const tile = document.createElement('canvas'); tile.width = 256; tile.height = 128;
    const tc = tile.getContext('2d')!;
    const rib = tc.createLinearGradient(0, 0, 256, 0);
    rib.addColorStop(0, '#000'); rib.addColorStop(0.18, '#1c1c1c'); rib.addColorStop(0.5, '#0e0e0e'); rib.addColorStop(0.82, '#1c1c1c'); rib.addColorStop(1, '#000');
    tc.fillStyle = rib; tc.fillRect(0, 0, 256, 128);
    tc.font = '600 20px "DM Mono", monospace'; tc.textAlign = 'center'; tc.textBaseline = 'middle';
    for (const cy of [32, 96]) {
      tc.fillStyle = '#F4F4F2'; tc.beginPath(); tc.roundRect(58, cy - 15, 140, 30, 15); tc.fill();
      tc.fillStyle = '#0B0B0B'; tc.fillText(text.slice(0, 7), 128, cy + 1);
    }
    const bump = document.createElement('canvas'); bump.width = 256; bump.height = 8;
    const bctx = bump.getContext('2d')!;
    const bg = bctx.createLinearGradient(0, 0, 256, 0);
    bg.addColorStop(0, '#000'); bg.addColorStop(0.2, '#fff'); bg.addColorStop(0.8, '#fff'); bg.addColorStop(1, '#000');
    bctx.fillStyle = bg; bctx.fillRect(0, 0, 256, 8);
    const baseMap = new THREE.CanvasTexture(tile); baseMap.colorSpace = THREE.SRGBColorSpace; baseMap.anisotropy = 4;
    const baseBump = new THREE.CanvasTexture(bump);
    for (const t of [baseMap, baseBump]) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }

    const st = stage(L);
    const disposers: (() => void)[] = [addShadow(st.scene, r * 4, 0.2)];
    const capGeo = new THREE.SphereGeometry(r * 0.9, 24, 16);
    const capMat = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.45 });
    disposers.push(() => { capGeo.dispose(); capMat.dispose(); baseMap.dispose(); baseBump.dispose(); });
    for (const pth of paths) {
      let arc = 0;
      const pts = pth.map((p, i) => {
        if (i) arc += Math.hypot(p[0] - pth[i - 1][0], p[1] - pth[i - 1][1]);
        const v = toScene(p[0], p[1]);
        v.z = r * 1.5 + Math.sin(arc / (fontPx * 0.45) + p[0] * 0.01) * r * 0.9;   // a slow rise and fall, like a folded hose
        return v;
      });
      if (pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      const len = curve.getLength();
      const ribs = Math.max(1, Math.round(len / period));
      const geo = new THREE.TubeGeometry(curve, ribs * (touch ? 6 : 10), r, touch ? 10 : 16, false);
      const pos = geo.attributes.position, uv = geo.attributes.uv, centre = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i), frac = (u * ribs) % 1;
        const k = 0.8 + 0.2 * Math.sqrt(Math.sin(Math.PI * frac));   // 0.8 at the seams, 1.0 mid-rib
        curve.getPointAt(Math.min(1, u), centre);
        v.fromBufferAttribute(pos, i).sub(centre).multiplyScalar(k).add(centre);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const map = baseMap.clone(), bumpMap = baseBump.clone();
      map.repeat.set(ribs, 1); bumpMap.repeat.copy(map.repeat);
      map.needsUpdate = true; bumpMap.needsUpdate = true;
      const mat = new THREE.MeshPhysicalMaterial({ map, bumpMap, bumpScale: 1.5, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.45 });
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
      st.group.add(mesh);
      for (const end of [pts[0], pts[pts.length - 1]]) { const cap = new THREE.Mesh(capGeo, capMat); cap.position.copy(end); cap.castShadow = true; st.group.add(cap); }
      disposers.push(() => { geo.dispose(); mat.dispose(); map.dispose(); bumpMap.dispose(); });
    }
    st.draw();
    return { tex: st.rt.texture, render: () => st.draw(), dispose: () => { disposers.forEach((d) => d()); st.rt.dispose(); } };
  }

  /** One slightly rounded block per letter, floating at small angles; blocks near the ink lift and turn toward it. */
  function buildBlocks(L: Layer): Built {
    const st = stage(L);
    const light = new THREE.Color(L.paper).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;
    const body = light ? '#FBFBFA' : '#1B1B1B';
    const sideTone = light ? '#E4E3E0' : '#121212';   // sides a shade off the face so each block's edges read
    const blocks: { mesh: THREE.Mesh; x: number; y: number; size: number; rx: number; ry: number; rz: number; ph: number }[] = [];
    const disposers: (() => void)[] = [];
    const side = new THREE.MeshPhysicalMaterial({ color: sideTone, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.7 });
    disposers.push(() => side.dispose());
    let maxSize = 0;
    for (const line of lines) {
      const chars = [...(L.case === 'upper' ? line.text.toUpperCase() : line.text)];
      // A compact row centred on the name: blocks sit close together with a small gap (a wider one for spaces),
      // and the whole row stays within ~80% of the name's width so it never reaches the screen edges.
      const letters = chars.filter((c) => c.trim()).length, spaces = chars.length - letters;
      const gapK = 0.24, spaceK = 0.5;
      const units = letters + (letters - 1) * gapK + spaces * spaceK;
      const size = Math.min(line.h * 0.7, (line.w * 0.8) / Math.max(1, units));
      let cursor = line.x + line.w / 2 - (units * size) / 2;
      const centres = chars.map((c) => {
        if (!c.trim()) { cursor += size * spaceK; return 0; }
        const x = cursor + size / 2; cursor += size * (1 + gapK); return x;
      });
      maxSize = Math.max(maxSize, size);
      chars.forEach((c, i) => {
        if (!c.trim()) return;
        const face = document.createElement('canvas'); face.width = face.height = 256;
        const fc = face.getContext('2d')!;
        fc.fillStyle = body; fc.fillRect(0, 0, 256, 256);
        setFont(fc, L, 180); fc.fillStyle = L.ink; fc.textAlign = 'center'; fc.textBaseline = 'alphabetic';
        const m = fc.measureText(c);
        fc.fillText(c, 128, 128 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
        const map = new THREE.CanvasTexture(face); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
        // Matte faces so the letter never washes out in a highlight; a little sheen on the sides.
        // Fully matte, with little reflected light, so the printed letter stays deep black.
        const front = new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: 1, metalness: 0, envMapIntensity: 0.2 });
        const geo = new RoundedBoxGeometry(size, size, size, 4, size * 0.12);
        // Box material order: +x, -x, +y, -y, +z (front, facing the viewer), -z
        const mesh = new THREE.Mesh(geo, [side, side, side, side, front, side]);
        mesh.castShadow = true;
        st.group.add(mesh);
        const ph = Math.random() * Math.PI * 2;
        blocks.push({ mesh, x: centres[i], y: line.y + line.h / 2, size, ph,
          rx: (Math.random() - 0.5) * 0.4, ry: (Math.random() - 0.5) * 0.36, rz: (Math.random() - 0.5) * 0.26 });
        disposers.push(() => { geo.dispose(); front.dispose(); map.dispose(); });
      });
    }
    disposers.push(addShadow(st.scene, maxSize * 0.9, 0.24));
    const place = (t: number) => {
      for (const b of blocks) {
        const dx = F.ax - b.x, dy = F.ay - b.y, d = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - d / (F.R * 1.8)) ** 2;
        const p = toScene(b.x, b.y);
        p.y += Math.sin(t * 0.8 + b.ph) * b.size * 0.05;
        p.z = Math.sin(t * 0.6 + b.ph) * b.size * 0.12 + f * b.size * 0.5;
        b.mesh.position.copy(p);
        b.mesh.rotation.set(
          b.rx + Math.sin(t * 0.5 + b.ph) * 0.06 - (dy / d) * f * 0.35,
          b.ry + Math.cos(t * 0.45 + b.ph) * 0.06 + (dx / d) * f * 0.35,
          b.rz + Math.sin(t * 0.35 + b.ph) * 0.04,
        );
      }
    };
    st.draw(() => place(0));
    return {
      tex: st.rt.texture,
      render: () => st.draw(() => place(motionOn() ? performance.now() / 1000 : 0)),
      dispose: () => { disposers.forEach((d) => d()); st.rt.dispose(); },
    };
  }

  const BUILDERS: Record<Layer['kind'], (L: Layer) => Built> = { flat: buildFlat, chrome: buildChrome, rope: buildRope, blocks: buildBlocks };

  const n = layers.length;
  let k = 0;
  const idx = (i: number) => ((i % n) + n) % n;
  function get(i: number): Built {
    i = idx(i);
    let b = built.get(i);
    if (!b) { b = BUILDERS[layers[i].kind](layers[i]); built.set(i, b); }
    return b;
  }
  function prune() { for (const [i, b] of built) if (![idx(k), idx(k + 1), idx(k + 2)].includes(i)) { b.dispose(); built.delete(i); } }
  function rebuildAll() { for (const b of built.values()) b.dispose(); built.clear(); bind(); }
  function bind() { uniforms.tBase.value = get(k).tex; uniforms.tTop.value = get(k + 1).tex; }
  const pad2 = (v: number) => String(v).padStart(2, '0');
  function label() { if (labelEl) labelEl.textContent = `${labels.layer} ${pad2(k + 1)}/${pad2(n)} · ${layers[k].label}`; host.dataset.layer = layers[k].id; host.style.setProperty('--hero-paper', layers[k].paper); }

  /* ---------- Diving a layer deeper ---------- */
  // Swipes and autoplay respect a short cooldown; the "Next layer" button (forced) never gets swallowed:
  // it skips the cooldown, and a press during a running dive is queued for right after it.
  let commitT0 = 0, commitFrom: [number, number] | null = null, cooldownUntil = 0, queued = 0;
  function commit(x: number, y: number, forced = false) {
    if (commitFrom) { if (forced) queued++; return; }
    if (!forced && performance.now() < cooldownUntil) return;
    if (!motionOn()) return; // motion off: the name stays on the serif layer
    commitFrom = [x, y]; commitT0 = performance.now();
    // If animation frames stall (background tab, slow device), complete the dive anyway.
    const started = commitT0;
    setTimeout(() => { if (commitFrom && commitT0 === started) { finish(); draw(); } }, 1100);
    get(k + 2);
  }
  function finish() {
    k = idx(k + 1); commitFrom = null; charge = 0; uniforms.uCommit.value.set(0, 0, 0);
    F.clear(); cooldownUntil = performance.now() + 600;
    if (queued > 0 && motionOn()) { queued--; setTimeout(() => commit((box.l + box.r) / 2, (box.t + box.b) / 2, true), 0); }
    bind(); prune(); label();
  }

  /* ---------- Swipe detection ----------
     Movement near the name charges a meter; any direction counts, back-and-forth included.
     When the travelled distance reaches `dive` × the screen width, the page dives a layer.
     The charge drains slowly when you stop, instead of resetting. Uses the real pointer, not the
     lagging ink, so it responds as soon as you move. */
  let charge = 0, lastCharge = 0, lastX = NaN, lastY = NaN;
  const nearName = (x: number, y: number) => {
    const h = box.b - box.t;
    return y > box.t - h * 0.6 && y < box.b + h * 0.6 && x > box.l - F.R * 0.5 && x < box.r + F.R * 0.5;
  };
  function travel(x: number, y: number, now: number) {
    if (commitFrom) { lastX = x; lastY = y; return; }
    if (nearName(x, y) && Number.isFinite(lastX)) { charge += Math.hypot(x - lastX, (y - lastY) * 0.6); lastCharge = now; }
    lastX = x; lastY = y;
    if (charge >= W * dive) { charge = 0; commit(x, y); }
  }
  const onPointer = (e: PointerEvent) => { const r = host.getBoundingClientRect(); travel(e.clientX - r.left, e.clientY - r.top, performance.now()); };
  const onLeave = () => { lastX = NaN; lastY = NaN; };
  host.addEventListener('pointermove', onPointer);
  host.addEventListener('pointerleave', onLeave);
  function track(now: number) {
    if (autoplaying(now) && selfDives(now)) travel(F.ax, F.ay, now);
    else if (autoplaying(now)) { lastX = NaN; lastY = NaN; }
    if (now - lastCharge > 250) charge *= 0.93;
    host.style.setProperty('--dive', String(Math.min(1, charge / Math.max(1, W * dive)).toFixed(3)));
  }

  /* ---------- Self-playing sweep (touch, or idle desktop) ---------- */
  const idleAfter = touch ? 2500 : 3500;
  const period = Math.max(2.5, autoplay.intervalSeconds) * 1000;
  // The ink only starts moving by itself after a quiet spell (never right on load), and only dives
  // layers by itself where selfDive allows it (touch screens by default), after firstDiveAfter seconds.
  const loadedAt = performance.now();
  const autoplaying = (now: number) => (touch ? autoplay.mobile : autoplay.desktop) && now - F.lastMove >= idleAfter && now - loadedAt >= idleAfter;
  const selfDives = (now: number) => (autoplay.selfDive === 'always' || (autoplay.selfDive === 'touch' && touch)) && now - loadedAt >= autoplay.firstDiveAfter * 1000;
  F.driver = (now) => {
    if (!autoplaying(now)) return null;
    const cyc = Math.floor(now / period), p = (now % period) / period, dir = cyc % 2 ? -1 : 1;
    const run = Math.min(1, p / 0.55), e = run < 0.5 ? 2 * run * run : 1 - Math.pow(-2 * run + 2, 2) / 2;
    const reach = F.R * 1.6, from = dir > 0 ? box.l - reach : box.r + reach, to = dir > 0 ? box.r + reach : box.l - reach;
    const cy = (box.t + box.b) / 2;
    return [from + (to - from) * e, cy + Math.sin(run * Math.PI * 2) * (box.b - box.t) * 0.22];
  };

  /* ---------- Frame ---------- */
  const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  function draw() {
    fieldTex.needsUpdate = true;
    uniforms.uT.value = F.t;
    get(k).render?.(); get(k + 1).render?.();
    renderer.setRenderTarget(null); renderer.render(pScene, pCam);
  }
  function frame(now: number, dt: number) {
    F.step(now, dt);
    if (!commitFrom) track(now);
    else {
      const p = Math.min(1, (now - commitT0) / 750), far = Math.hypot(W, H) * 1.2;
      uniforms.uCommit.value.set(commitFrom[0], H - commitFrom[1], Math.max(0.6, easeInOut(p) * far));
      if (p >= 1) finish();
    }
    draw();
  }
  // With motion off the hero rests on the serif layer (or the first one, if there's no serif layer): no ink, no diving.
  const restIndex = Math.max(0, layers.findIndex((L) => L.id === 'serif'));
  function still() {
    if (k !== restIndex || commitFrom) {
      k = restIndex; commitFrom = null; queued = 0; charge = 0; uniforms.uCommit.value.set(0, 0, 0);
      prune(); bind(); label();
    }
    F.clear(); draw();
  }

  function resize() {
    measure();
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.position.set(0, 0, H / 2 / Math.tan(THREE.MathUtils.degToRad(15)));
    cam.near = cam.position.z / 20; cam.far = cam.position.z * 4; cam.updateProjectionMatrix();
    uniforms.uRes.value.set(W, H);
    F.resize(); rebuildAll();
    if (!motionOn()) still(); else draw();
  }

  let stop = () => {}, ro: ResizeObserver | null = null, alive = true;
  const onFit = () => alive && resize();
  const onNext = () => commit((box.l + box.r) / 2, (box.t + box.b) / 2, true);
  (async () => {
    await Promise.all(layers.map((L) => document.fonts.load(fontCss(L, 100), 'Aa').catch(() => null)));
    if (!alive) return;
    measure(); F.resize(); resize(); label();
    host.classList.add('gl-ready');
    ro = new ResizeObserver(() => resize()); ro.observe(host);
    window.addEventListener('site:fit', onFit);
    nextBtn?.addEventListener('click', onNext);
    stop = loopOn(host, frame, still);
  })();
  const offMotion = onMotion(() => alive && (motionOn() ? draw() : still()));

  return () => {
    alive = false; stop(); offMotion(); ro?.disconnect();
    window.removeEventListener('site:fit', onFit); nextBtn?.removeEventListener('click', onNext);
    host.removeEventListener('pointermove', onPointer); host.removeEventListener('pointerleave', onLeave);
    for (const b of built.values()) b.dispose();
    env.dispose(); pmrem.dispose(); fieldTex.dispose(); F.destroy(); renderer.dispose();
    host.classList.remove('gl-ready');
  };
}

export default function HeroLayers(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? start(ref.current, props) : undefined), []);
  return <canvas ref={ref} className="hero-gl" aria-hidden="true" />;
}
