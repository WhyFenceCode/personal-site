/**
 * Placeholder art for projects and photos that don't have an image yet: grayscale studio
 * stills drawn on a canvas. `dither` turns it into a fine 1-bit ordered dither, which the
 * project cards show until hover. Replace with real images by setting `cover` in Markdown.
 */
type Ctx = CanvasRenderingContext2D;

function floor(c: Ctx, w: number, h: number, y0 = 0.62) { const g = c.createLinearGradient(0, h * y0, 0, h); g.addColorStop(0, '#e6e6e6'); g.addColorStop(1, '#bdbdbd'); c.fillStyle = g; c.fillRect(0, h * y0, w, h); }
function ball(c: Ctx, x: number, y: number, r: number, dark = false) {
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + r * 0.4, y + r * 0.96, r * 1.1, r * 0.2, 0, 0, 7); c.fill();
  const g = c.createRadialGradient(x - r * 0.42, y - r * 0.45, r * 0.08, x, y, r * 1.05);
  g.addColorStop(0, dark ? '#777' : '#fafafa'); g.addColorStop(0.55, dark ? '#2c2c2c' : '#a0a0a0'); g.addColorStop(1, '#141414');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
function box(c: Ctx, x: number, y: number, bw: number, bh: number, d: number) {
  c.fillStyle = '#f2f2f2'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + d, y - d * 0.5); c.lineTo(x + bw + d, y - d * 0.5); c.lineTo(x + bw, y); c.fill();
  const g = c.createLinearGradient(x, 0, x + bw, 0); g.addColorStop(0, '#c8c8c8'); g.addColorStop(1, '#7a7a7a'); c.fillStyle = g; c.fillRect(x, y, bw, bh);
  c.fillStyle = '#444'; c.beginPath(); c.moveTo(x + bw, y); c.lineTo(x + bw + d, y - d * 0.5); c.lineTo(x + bw + d, y + bh - d * 0.5); c.lineTo(x + bw, y + bh); c.fill();
}

const ART: Record<string, (c: Ctx, w: number, h: number) => void> = {
  orbit(c, w, h) { floor(c, w, h); box(c, w * 0.36, h * 0.6, w * 0.26, h * 0.4, w * 0.06); ball(c, w * 0.5, h * 0.42, h * 0.2); ball(c, w * 0.78, h * 0.74, h * 0.07, true); },
  strata(c, w, h) { floor(c, w, h, 0.7); for (let i = 0; i < 5; i++) box(c, w * (0.24 + i * 0.035), h * (0.78 - i * 0.12), w * 0.42, h * 0.08, w * 0.08); },
  tidal(c, w, h) { c.lineWidth = Math.max(1, h / 90); for (let i = 0; i < 22; i++) { const v = 30 + i * 9; c.strokeStyle = `rgb(${v},${v},${v})`; c.beginPath(); for (let x = 0; x <= w; x += 3) { const y = h * (0.16 + i * 0.034) + Math.sin((x / w) * 7 + i * 0.45) * h * 0.06; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } },
  ledger(c, w, h) { floor(c, w, h, 0.8); for (let i = 0; i < 9; i++) { const bh = h * (0.18 + 0.5 * Math.abs(Math.sin(i * 1.7 + 1))), x = w * (0.14 + i * 0.08), g = c.createLinearGradient(0, h * 0.84 - bh, 0, h * 0.84); g.addColorStop(0, '#e2e2e2'); g.addColorStop(1, '#333'); c.fillStyle = g; c.fillRect(x, h * 0.84 - bh, w * 0.05, bh); } },
  arc(c, w, h) { floor(c, w, h, 0.72); c.lineCap = 'round'; const g = c.createLinearGradient(w * 0.2, 0, w * 0.8, 0); g.addColorStop(0, '#f4f4f4'); g.addColorStop(1, '#262626'); c.strokeStyle = g; c.lineWidth = h * 0.09; c.beginPath(); c.arc(w * 0.5, h * 0.72, h * 0.42, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); ball(c, w * 0.5, h * 0.62, h * 0.08, true); },
  meridian(c, w, h) { const g = c.createRadialGradient(w * 0.42, h * 0.45, 2, w * 0.5, h * 0.62, h * 0.5); g.addColorStop(0, '#f6f6f6'); g.addColorStop(1, '#333'); c.fillStyle = g; c.beginPath(); c.arc(w * 0.5, h * 0.62, h * 0.42, Math.PI, 0); c.fill(); for (let i = 0; i < 9; i++) { const v = 50 + i * 18; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(w * 0.08, h * (0.66 + i * 0.036), w * 0.84, Math.max(1, h * (0.016 - i * 0.0012))); } },
  portrait(c, w, h) {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#f0f0f0'); bg.addColorStop(1, '#bdbdbd'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const sh = c.createRadialGradient(w * 0.35, h * 0.7, 4, w * 0.5, h * 0.95, w * 0.6); sh.addColorStop(0, '#8a8a8a'); sh.addColorStop(1, '#151515'); c.fillStyle = sh; c.beginPath(); c.ellipse(w * 0.5, h * 1.02, w * 0.48, h * 0.3, 0, 0, 7); c.fill();
    c.fillStyle = '#666'; c.fillRect(w * 0.43, h * 0.52, w * 0.14, h * 0.2);
    const hd = c.createRadialGradient(w * 0.4, h * 0.34, 2, w * 0.5, h * 0.4, w * 0.26); hd.addColorStop(0, '#f5f5f5'); hd.addColorStop(0.6, '#a2a2a2'); hd.addColorStop(1, '#333'); c.fillStyle = hd; c.beginPath(); c.ellipse(w * 0.5, h * 0.39, w * 0.19, h * 0.18, 0, 0, 7); c.fill();
    c.fillStyle = '#1e1e1e'; c.beginPath(); c.ellipse(w * 0.5, h * 0.27, w * 0.2, h * 0.09, 0, Math.PI, 0); c.fill();
  },
  harbour(c, w, h) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fafafa'); g.addColorStop(0.55, '#9a9a9a'); g.addColorStop(1, '#2a2a2a'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; for (let i = 0; i < 6; i++) c.fillRect(w * (0.08 + i * 0.15), h * (0.38 - (i % 3) * 0.05), w * 0.02, h * 0.3); c.fillRect(0, h * 0.66, w, h * 0.04); },
};

const B8 = (() => {
  const bayer = (n: number): number[][] => { if (n === 1) return [[0]]; const k = n / 2, p = bayer(k), o = [[0, 2], [3, 1]], m: number[][] = []; for (let y = 0; y < n; y++) { m[y] = []; for (let x = 0; x < n; x++) m[y][x] = 4 * p[y % k][x % k] + o[(y / k) | 0][(x / k) | 0]; } return m; };
  return bayer(8).flat().map((v) => (v + 0.5) / 64);
})();

export const artNames = Object.keys(ART);

export function paintArt(cv: HTMLCanvasElement, name: string, dither = false) {
  const c = cv.getContext('2d', { willReadFrequently: dither }); if (!c) return;
  const w = cv.width, h = cv.height;
  c.fillStyle = '#EDEDED'; c.fillRect(0, 0, w, h);
  (ART[name] ?? ART.orbit)(c, w, h);
  if (!dither) return;
  const img = c.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // Stretch the tones so near-white becomes clean paper instead of a grid of stray dots.
    const i = (y * w + x) * 4, l = Math.min(1, Math.max(0, ((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255 - 0.06) / 0.84));
    const v = l > B8[(y & 7) * 8 + (x & 7)] ? 237 : 10; d[i] = d[i + 1] = d[i + 2] = v;
  }
  c.putImageData(img, 0, 0);
}
