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
      FL = makeGL(el, `uniform vec2 uRes, uO; uniform float uR, uT, uMode, uRim; uniform vec3 uAccent;
        void main(){ vec2 frag = vUv * uRes; float d = distance(frag, uO);
        #ifdef INK_BLOTCH
          float n = inkWob(frag / uRes.y, uT);
          float edge = uR * (1. + .22 * (n - .5)) + (n - .5) * 40.;
        #else
          // Smooth: the bulge depends only on the direction from the centre, so the edge is one clean rolling curve
          // that can't fold back on itself into notches.
          float n = inkWob(normalize(frag - uO + vec2(1e-4)) * .95, uT);
          // The fixed part of the wobble grows in with the radius, so a small blob is never cut by straight lines.
          float edge = uR * (1. + .4 * (n - .5)) + (n - .5) * 56. * smoothstep(0., 160., uR);
        #endif
          float a = 1. - smoothstep(edge - 1.5, edge + 1.5, d); if (uMode > .5) a = 1. - a;
          // A thin accent rim along the ink's edge as it spreads.
          float rim = (1. - smoothstep(0., 7., abs(d - edge))) * step(.5, 1. - uMode) * uRim;
          vec3 col = mix(vec3(.086), uAccent, rim);
          float al = max(a, rim);
          gl_FragColor = vec4(col * al, al); }`);
    } catch { FL = null; }
  }
  return FL;
}

function size() {
  if (!cv) return;
  const d = Math.min(devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.round(innerWidth * d)), h = Math.max(1, Math.round(innerHeight * d));
  // Setting a canvas's size wipes it, even to the size it already has. Between a cover and the reveal that follows
  // it, that left one blank frame: the page flashed through, and the reveal then looked like it played twice.
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
}

let accent: [number, number, number] | null = null;
/** The site accent (--accent) as 0–1 RGB for the shader. */
function accentRGB(): [number, number, number] {
  if (!accent) {
    const h = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7E76D0';
    accent = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  }
  return accent;
}

export function floodDraw(mode: 'cover' | 'reveal', r: number, ox: number, oy: number) {
  const G = ensure(); if (!G || !cv) return;
  if (cv.width < 2) size();
  const d = cv.width / Math.max(1, innerWidth);
  G.set2('uRes', cv.width, cv.height); G.set2('uO', ox * d, (innerHeight - oy) * d);
  // The clock is kept small (wrapped every 10 minutes): big numbers lose precision on the GPU and tear the edge.
  G.set1('uR', r * d); G.set1('uT', (performance.now() / 1000) % 600); G.set1('uMode', mode === 'reveal' ? 1 : 0);
  G.set3('uAccent', ...accentRGB()); G.set1('uRim', document.documentElement.dataset.page === 'build' ? 0 : 1); G.draw();
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
