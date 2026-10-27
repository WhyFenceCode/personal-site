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
import { inkField, loopOn, differenceInk, NOISE, MASK_GLSL, type InkField } from '../../scripts/gl';
import { motionOn, onMotion, isTouch } from '../../scripts/motion';

type Layer = {
  id: string; label: string; kind: 'flat' | 'chrome' | 'rope' | 'blocks'; font: 'display' | 'serif' | 'pixel' | 'mono' | 'text';
  weight: number; stretch: number; italic: boolean; case: 'upper' | 'none'; ink: string; paper: string; outline: boolean;
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

/* ---------- Outline tracing for the rope layer ---------- */
type Pt = [number, number];
/** Marching squares over a white-on-black mask: closed outline loops, in mask pixels. */
function contours(md: Uint8ClampedArray, w: number, h: number): Pt[][] {
  const inside = (x: number, y: number) => md[(y * w + x) * 4] > 127;
  const hEdge = (x: number, y: number) => (y * (w + 1) + x) * 2, vEdge = (x: number, y: number) => (y * (w + 1) + x) * 2 + 1;
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); };
  // Corner bits: top-left 8, top-right 4, bottom-right 2, bottom-left 1. Edges: 0 top, 1 right, 2 bottom, 3 left.
  const TABLE = [[], [3, 2], [2, 1], [3, 1], [0, 1], [3, 0, 2, 1], [0, 2], [3, 0], [3, 0], [0, 2], [0, 1, 3, 2], [0, 1], [3, 1], [2, 1], [3, 2], []];
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const c = (inside(x, y) ? 8 : 0) | (inside(x + 1, y) ? 4 : 0) | (inside(x + 1, y + 1) ? 2 : 0) | (inside(x, y + 1) ? 1 : 0);
    const e = [hEdge(x, y), vEdge(x + 1, y), hEdge(x, y + 1), vEdge(x, y)], t = TABLE[c];
    for (let i = 0; i < t.length; i += 2) link(e[t[i]], e[t[i + 1]]);
  }
  const pos = (id: number): Pt => { const b = id >> 1, x = b % (w + 1), y = Math.floor(b / (w + 1)); return id & 1 ? [x, y + 0.5] : [x + 0.5, y]; };
  const seen = new Set<number>(), loops: Pt[][] = [];
  for (const first of adj.keys()) {
    if (seen.has(first)) continue;
    const loop: Pt[] = []; let prev = -1, cur = first;
    while (!seen.has(cur)) {
      seen.add(cur); loop.push(pos(cur));
      const next = (adj.get(cur) ?? []).find((n) => n !== prev && !seen.has(n));
      if (next === undefined) break;
      prev = cur; cur = next;
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}
const perimeter = (l: Pt[]) => l.reduce((s, p, i) => s + Math.hypot(p[0] - l[(i + 1) % l.length][0], p[1] - l[(i + 1) % l.length][1]), 0);
/** Moving-average smoothing on a closed loop (removes the pixel staircase). */
function smooth(l: Pt[], passes: number): Pt[] {
  let out = l;
  for (let k = 0; k < passes; k++) out = out.map((_, i) => {
    let sx = 0, sy = 0;
    for (let j = -2; j <= 2; j++) { const q = out[(i + j + out.length) % out.length]; sx += q[0]; sy += q[1]; }
    return [sx / 5, sy / 5] as Pt;
  });
  return out;
}
/** Even spacing along a closed loop. */
function resample(l: Pt[], step: number): Pt[] {
  const out: Pt[] = [l[0]]; let carry = 0;
  for (let i = 0; i < l.length; i++) {
    const a = l[i], b = l[(i + 1) % l.length], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= seg) { const t = d / seg; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); d += step; }
    carry = seg - (d - step);
  }
  return out.length > 3 ? out.slice(0, -1) : out;
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

  /** A braided rope laid along every letter outline. */
  function buildRope(L: Layer): Built {
    const { md, bl, bt, cw, ch, S } = textMask(L, touch ? 0.3 : 0.4);
    const r = Math.max(2.5, fontPx * 0.04);
    const loops = contours(md, cw, ch)
      .map((loop) => smooth(loop.map(([x, y]) => [bl + x / S, bt + y / S] as Pt), 3))
      .filter((loop) => perimeter(loop) > fontPx * 0.2)
      .map((loop) => resample(loop, r * 0.8));
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(L.ink), roughness: 0.8, metalness: 0, envMapIntensity: 0.9 });
    const st = stage(L);
    const geos: THREE.BufferGeometry[] = [];
    const pitch = r * 7, strands = 3;
    for (const loop of loops) {
      let arc = 0;
      const arcs = loop.map((p, i) => (i ? (arc += Math.hypot(p[0] - loop[i - 1][0], p[1] - loop[i - 1][1])) : 0));
      for (let s = 0; s < strands; s++) {
        const pts = loop.map((p, i) => {
          const a = loop[(i + 1) % loop.length], b = loop[(i - 1 + loop.length) % loop.length];
          let tx = a[0] - b[0], ty = a[1] - b[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          const th = (arcs[i] / pitch) * Math.PI * 2 + (s * Math.PI * 2) / strands;
          const v = toScene(p[0], p[1]);
          // Each strand winds around the centre line (in-plane normal and depth); the whole rope rises and falls slowly.
          v.x += -ty * Math.cos(th) * r * 0.5; v.y -= tx * Math.cos(th) * r * 0.5;
          v.z += Math.sin(th) * r * 0.5 + Math.sin(arcs[i] / (fontPx * 0.5)) * r * 1.2;
          return v;
        });
        const curve = new THREE.CatmullRomCurve3(pts, true);
        const geo = new THREE.TubeGeometry(curve, Math.min(4000, pts.length * 2), r * 0.55, touch ? 5 : 7, true);
        geos.push(geo);
        st.group.add(new THREE.Mesh(geo, mat));
      }
    }
    st.draw();
    return { tex: st.rt.texture, render: () => st.draw(), dispose: () => { geos.forEach((g) => g.dispose()); mat.dispose(); st.rt.dispose(); } };
  }

  /** The name rebuilt from small cubes that float, and scatter away from the ink. */
  function buildBlocks(L: Layer): Built {
    const { md, bl, bt, bw, bh, cw, ch, S } = textMask(L, 0.5);
    const cell = Math.max(5, fontPx * 0.07);
    const cells: { x: number; y: number; ph: number }[] = [];
    for (let y = bt + cell / 2; y < bt + bh; y += cell) for (let x = bl + cell / 2; x < bl + bw; x += cell) {
      const mx = Math.min(cw - 1, Math.round((x - bl) * S)), my = Math.min(ch - 1, Math.round((y - bt) * S));
      if (md[(my * cw + mx) * 4] > 127) cells.push({ x, y, ph: Math.random() * Math.PI * 2 });
    }
    const geo = new THREE.BoxGeometry(cell * 0.86, cell * 0.86, cell * 0.86);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(L.ink), roughness: 0.38, metalness: 0.15, envMapIntensity: 1.1 });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, cells.length));
    const st = stage(L); st.group.add(mesh);
    const o = new THREE.Object3D();
    const place = (t: number) => {
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const dx = c.x - F.ax, dy = c.y - F.ay, d = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - d / (F.R * 1.4)) ** 2; // 0..1, strongest under the ink
        const push = f * cell * 3;
        o.position.copy(toScene(c.x + (dx / d) * push, c.y + (dy / d) * push));
        o.position.z = Math.sin(t * 0.9 + c.ph) * cell * 0.45 + f * cell * 6;
        o.rotation.set(Math.sin(t * 0.6 + c.ph) * 0.3 + f * 1.4, Math.cos(t * 0.5 + c.ph) * 0.3 + f * 1.4, 0);
        o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    st.draw(() => place(0));
    return {
      tex: st.rt.texture,
      render: () => st.draw(() => place(motionOn() ? performance.now() / 1000 : 0)),
      dispose: () => { geo.dispose(); mat.dispose(); mesh.dispose(); st.rt.dispose(); },
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
    if (!motionOn()) { finish(); draw(); return; }
    commitFrom = [x, y]; commitT0 = performance.now();
    // If animation frames stall (background tab, slow device), complete the dive anyway.
    const started = commitT0;
    setTimeout(() => { if (commitFrom && commitT0 === started) { finish(); draw(); } }, 1100);
    get(k + 2);
  }
  function finish() {
    k = idx(k + 1); commitFrom = null; charge = 0; uniforms.uCommit.value.set(0, 0, 0);
    F.clear(); cooldownUntil = performance.now() + 600;
    if (queued > 0 && motionOn()) { queued--; requestAnimationFrame(() => commit((box.l + box.r) / 2, (box.t + box.b) / 2, true)); }
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
  function still() { F.clear(); draw(); }

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
