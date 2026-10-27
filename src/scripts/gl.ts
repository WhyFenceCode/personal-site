/**
 * Shared pieces for the ink effect: GLSL noise, the blob mask, a soft "ink field" painted on a
 * small 2D canvas that trails a moving agent, and a tiny raw-WebGL helper for simple passes.
 */
import { motionOn, onMotion } from './motion';

export const NOISE = /* glsl */ `
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.03; a *= .5; } return s; }`;

/** Turns the soft field into a crisp blob with a wobbly, slowly drifting edge. */
export const MASK_GLSL = /* glsl */ `
  float inkMask(sampler2D field, vec2 uv, vec2 res, float t){
    vec2 q = uv * res / 240. + vec2(t * .07, -t * .05);
    vec2 warp = vec2(fbm(q), fbm(q + 5.2)) - .5;
    float f = texture2D(field, uv + warp * 90. / res).a;
    f += (fbm(q * 1.7 + 3.1) - .5) * .18 * smoothstep(.05, .5, f);
    return smoothstep(.48, .52, f);
  }`;

export interface InkField {
  field: HTMLCanvasElement;
  W: number; H: number; R: number;
  ax: number; ay: number; tx: number; ty: number;
  t: number; inside: boolean; lastMove: number;
  resize(): void;
  step(now: number, dt: number): void;
  still(x?: number, y?: number): void;
  clear(): void;
  /** When set, the agent follows this instead of wandering (used by autoplay). */
  driver: ((now: number) => [number, number] | null) | null;
  destroy(): void;
}

/** A soft trail: the agent follows the pointer with a lag, droplets fly off fast moves, the field fades. */
export function inkField(host: HTMLElement, opts: { wander?: boolean } = {}): InkField {
  const field = document.createElement('canvas');
  const fx = field.getContext('2d')!;
  const S = 0.25;
  let mvx = 0, mvy = 0, touching = false;
  const drops: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
  const f: InkField = {
    field, W: 1, H: 1, R: 100, ax: 0, ay: 0, tx: 0, ty: 0, t: 0, inside: false, lastMove: -1e9, driver: null,
    resize() {
      const r = host.getBoundingClientRect();
      f.W = Math.max(1, r.width); f.H = Math.max(1, r.height);
      field.width = Math.ceil(f.W * S); field.height = Math.ceil(f.H * S);
      f.R = Math.max(56, Math.min(190, Math.min(f.W, f.H) * 0.2));
    },
    still(x = 0.68, y = 0.55) { f.clear(); fx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) stamp(f.W * x, f.H * y, f.R * 1.15); },
    clear() { fx.clearRect(0, 0, field.width, field.height); drops.length = 0; },
    step(now, dt) {
      f.t += dt;
      const drive = f.driver?.(now);
      if (drive) { [f.tx, f.ty] = drive; }
      else if (!f.inside && opts.wander !== false && now - f.lastMove > 2200) {
        f.tx = f.W * (0.5 + 0.36 * Math.sin(f.t * 0.33)); f.ty = f.H * (0.55 + 0.16 * Math.sin(f.t * 0.61 + 1.3));
      }
      const px = f.ax, py = f.ay;
      // A finger drags the ink almost directly; a mouse leaves a slower, smoother trail.
      const follow = touching ? 0.4 : 0.09;
      f.ax += (f.tx - f.ax) * follow; f.ay += (f.ty - f.ay) * follow;
      fx.globalCompositeOperation = 'destination-out'; fx.fillStyle = 'rgba(0,0,0,0.045)'; fx.fillRect(0, 0, field.width, field.height);
      fx.globalCompositeOperation = 'lighter';
      // Without a pointer, a driver or wandering, stop painting so the ink fades away.
      const painting = f.inside || !!drive || opts.wander !== false || now - f.lastMove < 600;
      const d = Math.hypot(f.ax - px, f.ay - py), n = Math.max(1, Math.ceil(d / (f.R * 0.25)));
      if (painting) for (let i = 1; i <= n; i++) stamp(px + ((f.ax - px) * i) / n, py + ((f.ay - py) * i) / n, f.R);
      if (Math.hypot(mvx, mvy) > 22 && drops.length < 40) {
        const k = Math.random() < 0.5 ? 1 : -1;
        drops.push({ x: f.ax, y: f.ay, vx: mvx * 0.32 - mvy * 0.12 * k + (Math.random() - 0.5) * 4, vy: mvy * 0.32 + mvx * 0.12 * k + (Math.random() - 0.5) * 4, r: f.R * (0.18 + Math.random() * 0.22) });
      }
      mvx *= 0.6; mvy *= 0.6;
      for (let i = drops.length - 1; i >= 0; i--) {
        const p = drops[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9; p.r *= 0.965; stamp(p.x, p.y, p.r);
        if (p.r < 6) drops.splice(i, 1);
      }
    },
    destroy() { host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave); host.removeEventListener('pointerdown', down); host.removeEventListener('pointerup', leave); host.removeEventListener('pointercancel', leave); },
  };
  function stamp(x: number, y: number, r: number) {
    const g = fx.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * S);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    fx.fillStyle = g; fx.beginPath(); fx.arc(x * S, y * S, r * S, 0, 7); fx.fill();
  }
  function move(e: PointerEvent) {
    const r = host.getBoundingClientRect(), nx = e.clientX - r.left, ny = e.clientY - r.top;
    touching = e.pointerType !== 'mouse';
    mvx = nx - f.tx; mvy = ny - f.ty; f.tx = nx; f.ty = ny; f.inside = true; f.lastMove = performance.now();
  }
  // On touch, the ink jumps to where the finger lands instead of sliding over from wherever it was.
  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    const r = host.getBoundingClientRect();
    f.tx = f.ax = e.clientX - r.left; f.ty = f.ay = e.clientY - r.top;
    touching = true; f.inside = true; f.lastMove = performance.now(); mvx = mvy = 0;
  }
  const leave = () => { f.inside = false; touching = false; };
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerdown', down);
  host.addEventListener('pointerleave', leave);
  host.addEventListener('pointerup', leave);
  host.addEventListener('pointercancel', leave);
  f.resize(); f.ax = f.tx = f.W * 0.62; f.ay = f.ty = f.H * 0.55;
  return f;
}

/** Minimal full-screen-quad WebGL program (used by the flood and the footer ink). */
export function makeGL(cv: HTMLCanvasElement, frag: string) {
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const o = gl.createShader(type)!; gl.shaderSource(o, src); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) ?? 'shader');
    return o;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision highp float; varying vec2 vUv;' + NOISE + frag));
  gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U: Record<string, WebGLUniformLocation | null> = {};
  const u = (n: string) => (U[n] ??= gl.getUniformLocation(pr, n));
  return {
    gl,
    set1: (n: string, v: number) => gl.uniform1f(u(n), v),
    set2: (n: string, a: number, b: number) => gl.uniform2f(u(n), a, b),
    draw() { gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); },
  };
}

/** Run `frame` only while `host` is on screen, the tab is visible and motion is allowed. */
export function loopOn(host: Element, frame: (now: number, dt: number) => void, still: () => void) {
  let running = false, visible = false, last = 0, alive = true;
  const tick = (now: number) => {
    if (!running || !alive) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    frame(now, dt); requestAnimationFrame(tick);
  };
  const kick = () => {
    const want = alive && visible && motionOn() && !document.hidden;
    if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    else if (!want) { running = false; if (!motionOn()) still(); }
  };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); });
  io.observe(host);
  document.addEventListener('visibilitychange', kick);
  const off = onMotion(kick);
  return () => { alive = false; running = false; io.disconnect(); document.removeEventListener('visibilitychange', kick); off(); };
}

/** Footer (and fallback) ink: a white blob in difference mode that inverts what it covers. */
export function differenceInk(host: HTMLElement, opts: { wander?: boolean } = {}) {
  const cv = document.createElement('canvas');
  cv.className = 'ink-canvas'; cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'difference', zIndex: '3' });
  host.appendChild(cv);
  let G: ReturnType<typeof makeGL> = null;
  try { G = makeGL(cv, MASK_GLSL + 'uniform sampler2D uField; uniform vec2 uRes; uniform float uT; void main(){ float m = inkMask(uField, vUv, uRes, uT); gl_FragColor = vec4(vec3(m), m); }'); } catch { G = null; }
  if (!G) { cv.remove(); return () => {}; }
  const { gl } = G, F = inkField(host, opts);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((p) => gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR));
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((p) => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE));
  const render = () => { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, F.field); G!.set2('uRes', F.W, F.H); G!.set1('uT', F.t); G!.draw(); };
  const size = () => { F.resize(); const d = Math.min(devicePixelRatio || 1, 1.5); cv.width = Math.round(F.W * d); cv.height = Math.round(F.H * d); if (!motionOn()) { F.still(); render(); } };
  const ro = new ResizeObserver(size); ro.observe(host);
  const stop = loopOn(host, (now, dt) => { F.step(now, dt); render(); }, () => { F.still(); render(); });
  return () => { stop(); ro.disconnect(); F.destroy(); cv.remove(); };
}
