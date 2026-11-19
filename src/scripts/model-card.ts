/**
 * Work cards for projects with a 3D model (`model:` in frontmatter and no cover).
 * The card shows a dithered still of the model; on hover (or keyboard focus) the same view fades in, rendered
 * smooth. It doesn't move. Nothing loads until the card is near the screen.
 */
import { createStage } from './model-scene';
import { ditherCtx } from './art';

const rad = Math.PI / 180;

export function initModelCards(root: ParentNode = document): () => void {
  const cleanups: (() => void)[] = [];
  root.querySelectorAll<HTMLElement>('[data-model-card]').forEach((thumb) => {
    const still = thumb.querySelector<HTMLCanvasElement>('canvas.dith')!;
    let started = false, alive = true, cleanup = () => {};
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && !started) { started = true; io.disconnect(); start(); } }, { rootMargin: '300px' });
    io.observe(thumb);
    cleanups.push(() => { alive = false; io.disconnect(); cleanup(); });

    // The pose comes from the project's `modelAngle` (degrees); defaults suit a model exported front-on.
    const YAW = (+(thumb.dataset.modelTurn ?? 54)) * rad, TILT = (+(thumb.dataset.modelTilt ?? 26)) * rad;

    async function start() {
      const cv = thumb.querySelector<HTMLCanvasElement>('canvas.smooth')!, stage = createStage(thumb, 'fit', cv);
      try { await stage.load(thumb.dataset.modelCard!); } catch { stage.dispose(); return; }
      if (!alive) { stage.dispose(); return; }

      // Pose it, then frame what the camera actually sees, so any model sits in the visual centre of the card.
      const size = () => { const w = thumb.clientWidth, h = thumb.clientHeight; if (!w || !h) return; stage.setSize(w, h); stage.pivot.rotation.set(TILT, YAW, 0); stage.frameToView(1.25); };
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
