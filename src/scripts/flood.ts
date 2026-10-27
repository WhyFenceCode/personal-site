/** The organic ink circle used by the intro and by page transitions. */
import { makeGL } from './gl';

let FL: ReturnType<typeof makeGL> = null;
let cv: HTMLCanvasElement | null = null;

function ensure() {
  const el = document.getElementById('flood') as HTMLCanvasElement | null;
  if (!el) return null;
  if (el !== cv) {
    cv = el;
    try {
      FL = makeGL(el, `uniform vec2 uRes, uO; uniform float uR, uT, uMode;
        void main(){ vec2 frag = vUv * uRes; float d = distance(frag, uO);
          float n = fbm(frag / uRes.y * 2.6 + vec2(uT * .5, uT * .3));
          float edge = uR * (1. + .22 * (n - .5)) + (n - .5) * 40.;
          float a = 1. - smoothstep(edge - 1.5, edge + 1.5, d); if (uMode > .5) a = 1. - a;
          gl_FragColor = vec4(vec3(.043) * a, a); }`);
    } catch { FL = null; }
  }
  return FL;
}

function size() {
  if (!cv) return;
  const d = Math.min(devicePixelRatio || 1, 1.5);
  cv.width = Math.max(1, Math.round(innerWidth * d)); cv.height = Math.max(1, Math.round(innerHeight * d));
}

export function floodDraw(mode: 'cover' | 'reveal', r: number, ox: number, oy: number) {
  const G = ensure(); if (!G || !cv) return;
  if (cv.width < 2) size();
  const d = cv.width / Math.max(1, innerWidth);
  G.set2('uRes', cv.width, cv.height); G.set2('uO', ox * d, (innerHeight - oy) * d);
  G.set1('uR', r * d); G.set1('uT', performance.now() / 1000); G.set1('uMode', mode === 'reveal' ? 1 : 0); G.draw();
}

export function floodClear() { const G = ensure(); if (G) { G.gl.clearColor(0, 0, 0, 0); G.gl.clear(G.gl.COLOR_BUFFER_BIT); } }

export function flood(mode: 'cover' | 'reveal', ox: number, oy: number, ms = 650, from = 0): Promise<void> {
  if (!ensure()) return Promise.resolve();
  size();
  const far = Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy)) * 1.35;
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      floodDraw(mode, from + (far - from) * e, ox, oy);
      p < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}

export function floodPrepare() { ensure(); size(); }
