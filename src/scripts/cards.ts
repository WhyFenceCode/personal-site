/**
 * Small info cards for books and map pins.
 *
 * Inside any [data-cards] container, elements with data-card-title (and optional -sub / -meta) get a card:
 * - mouse: shows on hover; a click pins it in place (click again, press Esc or click elsewhere to release)
 * - touch: tap to open, tap again or elsewhere to close (no hover on phones)
 * - keyboard: shows on focus, Enter/Space pins it
 * The card is visual only (aria-hidden); every trigger carries the same text in its aria-label.
 */
const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function initCards(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-cards]').forEach((box) => {
    if (box.dataset.cardsReady) return;
    box.dataset.cardsReady = '1';
    const pop = box.querySelector<HTMLElement>('.card-pop');
    if (!pop) return;
    const tEl = pop.querySelector<HTMLElement>('[data-card-t]')!, sEl = pop.querySelector<HTMLElement>('[data-card-s]')!, mEl = pop.querySelector<HTMLElement>('[data-card-m]')!;
    let pinned: HTMLElement | null = null;

    const place = (el: Element) => {
      const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
      pop.hidden = false;
      const w = pop.offsetWidth, h = pop.offsetHeight;
      let x = r.left - b.left + r.width / 2 - w / 2;
      x = Math.max(0, Math.min(b.width - w, x));
      let y = r.top - b.top - h - 10;
      if (y < -b.top + 8) y = r.bottom - b.top + 10; // no room above: show below
      pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };
    const show = (el: HTMLElement) => {
      tEl.textContent = el.dataset.cardTitle ?? '';
      sEl.textContent = el.dataset.cardSub ?? ''; sEl.hidden = !el.dataset.cardSub;
      mEl.textContent = el.dataset.cardMeta ?? ''; mEl.hidden = !el.dataset.cardMeta;
      place(el);
    };
    const hide = () => { if (!pinned) pop.hidden = true; };
    const unpin = () => { pinned?.setAttribute('aria-pressed', 'false'); pinned = null; pop.hidden = true; };
    const pin = (el: HTMLElement) => { if (pinned && pinned !== el) pinned.setAttribute('aria-pressed', 'false'); pinned = el; el.setAttribute('aria-pressed', 'true'); show(el); };
    const trigger = (e: Event) => (e.target as Element).closest<HTMLElement>('[data-card-title]');

    box.addEventListener('pointerover', (e) => { if (e.pointerType !== 'mouse' || pinned) return; const el = trigger(e); if (el) show(el); });
    box.addEventListener('pointerout', (e) => { if (e.pointerType !== 'mouse') return; const el = trigger(e); if (el && !el.contains(e.relatedTarget as Node)) hide(); });
    box.addEventListener('click', (e) => { const el = trigger(e); if (!el) return; e.stopPropagation(); pinned === el ? unpin() : pin(el); });
    box.addEventListener('focusin', (e) => { if (pinned) return; const el = trigger(e); if (el && !fine()) return; if (el) show(el); });
    box.addEventListener('focusout', () => setTimeout(() => { if (!box.contains(document.activeElement)) { unpin(); hide(); } }));
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { unpin(); hide(); } });
    document.addEventListener('click', (e) => { if (pinned && !box.contains(e.target as Node)) unpin(); });
    addEventListener('resize', () => { if (pinned) place(pinned); else pop.hidden = true; });
  });
}
