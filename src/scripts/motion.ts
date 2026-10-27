/**
 * One switch for all motion: the OS "reduce motion" setting, overridden by the footer toggle
 * (stored in localStorage as site.motion = on | off).
 */
const reduce = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

function stored(): string | null {
  try { return localStorage.getItem('site.motion'); } catch { return null; }
}

export function motionOn(): boolean {
  const s = stored();
  if (s === 'off') return false;
  if (s === 'on') return true;
  return !reduce?.matches;
}

export function setMotion(on: boolean) {
  try { localStorage.setItem('site.motion', on ? 'on' : 'off'); } catch {}
  document.documentElement.classList.toggle('no-motion', !on);
  window.dispatchEvent(new CustomEvent('site:motion'));
}

export function onMotion(fn: () => void) {
  window.addEventListener('site:motion', fn);
  reduce?.addEventListener('change', fn);
  return () => { window.removeEventListener('site:motion', fn); reduce?.removeEventListener('change', fn); };
}

export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: none), (pointer: coarse)').matches;
