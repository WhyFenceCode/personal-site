/**
 * Work cards for projects with a 3D model (`model:` in frontmatter and no cover).
 * The card shows a dithered still of the model; on hover (or keyboard focus) the same view fades in, rendered
 * smooth. It doesn't move. Nothing loads until the card is near the screen.
 */
import { createStage } from './model-scene';
import { ditherCtx } from './art';

// Leading edge towards the viewer, three-quarter view from a little above (the mast's pointed trailing edge is +X).
const YAW = 0.95, TILT = 0.45;

export function initModelCards(root: ParentNode = document): () => void {
  const cleanups: (() => void)[] = [];
  root.querySelectorAll<HTMLElement>('[data-model-card]').forEach((thumb) => {
    const still = thumb.querySelector<HTMLCanvasElement>('canvas.dith')!;
    let started = false, alive = true, cleanup = () => {};
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && !started) { started = true; io.disconnect(); start(); } }, { rootMargin: '300px' });
    io.observe(thumb);
    cleanups.push(() => { alive = false; io.disconnect(); cleanup(); });

    async function start() {
      const cv = thumb.querySelector<HTMLCanvasElement>('canvas.smooth')!, stage = createStage(thumb, 'fit', cv);
      try { await stage.load(thumb.dataset.modelCard!); } catch { stage.dispose(); return; }
      if (!alive) { stage.dispose(); return; }

      const size = () => { const w = thumb.clientWidth, h = thumb.clientHeight; if (w && h) stage.setSize(w, h); };
      const draw = () => { stage.pivot.rotation.set(TILT, YAW, 0); stage.render(); };
      // The still: render at the resting angle, shrink it to the dither canvas and dither it like the placeholder art.
      const paintStill = () => {
        const c = still.getContext('2d', { willReadFrequently: true }); if (!c) return;
        const w = still.width, h = still.height;
        draw();
        c.clearRect(0, 0, w, h);
        const s = cv.width / cv.height > w / h ? h / cv.height : w / cv.width; // cover, like object-fit
        const dw = cv.width * s, dh = cv.height * s;
        c.drawImage(cv, (w - dw) / 2, (h - dh) / 2, dw, dh);
        // Set the model on the same grey as the placeholder art.
        const img = c.getImageData(0, 0, w, h), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3] / 255, l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const v = a * l + (1 - a) * 214; // 214 = #D6D6D6, the placeholder art's ground: dithers to the soft dot pattern
          d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
        }
        c.putImageData(img, 0, 0);
        ditherCtx(c, w, h);
      };
      size(); paintStill();
      thumb.dataset.modelReady = '';

      // The live layer is the same view, rendered smooth; CSS fades it in on hover. It only redraws on resize.
      const ro = new ResizeObserver(() => { size(); draw(); }); ro.observe(thumb);

      cleanup = () => {
        ro.disconnect(); stage.dispose();
      };
    }
  });
  return () => cleanups.forEach((f) => f());
}
