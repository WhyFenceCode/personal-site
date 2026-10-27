/**
 * Scrubbable resume timeline. A native range input drives it, so it works with the keyboard
 * (arrow keys, Home/End) and screen readers; dragging across the bars works too.
 * Short histories step by quarter or half-year instead of by year, so the scrubber still has room to move.
 */
import { useMemo, useRef, useState } from 'react';

type Item = { label: string; sub: string; from: number; to: number; edu: boolean; detail: string };
type Props = { items: Item[]; range: { from: number; to: number }; labels: { year: string }; lang: string };

export default function Timeline({ items, range, labels, lang }: Props) {
  const span = range.to + 1 - range.from;
  // Up to 4 years: quarters. Up to 8: half-years. Longer: whole years.
  const months = span <= 4 ? 3 : span <= 8 ? 6 : 12;
  const n = Math.round((span * 12) / months);
  const stepStart = (i: number) => range.from + (i * months) / 12;
  const monthName = useMemo(() => {
    const f = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' });
    return (m: number) => f.format(Date.UTC(2000, m, 1));
  }, [lang]);

  const now = new Date();
  const nowValue = now.getFullYear() + now.getMonth() / 12;
  const [idx, setIdx] = useState(Math.max(0, Math.min(n - 1, Math.floor(((nowValue - range.from) * 12) / months))));
  const tracks = useRef<HTMLDivElement>(null);
  const pct = (v: number) => ((v - range.from) / span) * 100;
  const centre = (i: number) => (stepStart(i) + stepStart(i + 1)) / 2;
  // Bars sit at their real months. The scrubber picks the middle of each period, so an entry too short to
  // contain any middle is stretched to the nearest one; otherwise no position could ever select it.
  const spans = useMemo(() => items.map((it) => {
    let { from, to } = it;
    const first = Math.max(0, Math.ceil(((from - range.from) * 12) / months - 0.5)); // first middle at or after the start
    if (first >= 0 && first < n && centre(first) < to) return { from, to };
    if (to <= range.from || from >= range.to + 1) return { from, to }; // outside the timeline entirely
    const below = Math.max(0, Math.min(n - 1, first - 1)), above = Math.max(0, Math.min(n - 1, first));
    const c = Math.abs(centre(below) - (from + to) / 2) <= Math.abs(centre(above) - (from + to) / 2) ? centre(below) : centre(above);
    return { from: Math.min(from, c - 1 / 48), to: Math.max(to, c + 1 / 48) };
  }), [items, range.from, range.to, months, n]);
  const clamp = (p: number) => Math.max(0, Math.min(100, p)); // entries running past the range end at its edge

  const start = stepStart(idx), end = stepStart(idx + 1);
  const year = Math.floor(start + 1e-6);
  const month = Math.round((start - year) * 12);
  // e.g. "Jul – Sep 2025" for a quarter; just "2025" for a whole year.
  const period = months === 12 ? String(year) : `${monthName(month)} – ${monthName(month + months - 1)} ${year}`;
  // An entry is active when it runs through the middle of the selected period.
  const mid = (start + end) / 2;
  const active = useMemo(() => spans.map((s) => s.from <= mid && mid < s.to), [spans, mid]);
  const lead = items.find((it, i) => active[i] && !it.edu) ?? items.find((_, i) => active[i]);

  const scrub = (clientX: number) => {
    const r = tracks.current!.getBoundingClientRect();
    setIdx(Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n))));
  };
  const onDown = (e: React.PointerEvent) => {
    scrub(e.clientX);
    const move = (ev: PointerEvent) => scrub(ev.clientX);
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };

  // Year labels at each year start; month labels in between when there's room; otherwise a plain tick.
  const ticks = Array.from({ length: n }, (_, i) => {
    const s = stepStart(i), y = Math.floor(s + 1e-6), m = Math.round((s - y) * 12);
    if (m === 0) return { text: `'${String(y).slice(2)}`, major: true, show: months !== 12 || n <= 8 || i % 2 === 0 };
    return { text: n <= 16 ? monthName(m) : '·', major: false, show: true };
  });

  return (
    <div className="tl">
      <div className="tl-top">
        <div className="tl-year num" aria-hidden="true">{year}{months !== 12 && <span className="tl-month mono">{monthName(month)}–{monthName(month + months - 1)}</span>}</div>
        <div className="tl-now" aria-live="polite">
          <span className="mono muted">{period}</span>
          {lead ? <><b>{lead.sub}, {lead.label}</b><span className="muted">{lead.detail}</span></> : <b>—</b>}
        </div>
      </div>
      {/* Each label and its bar share one grid row, so a label that wraps makes its row taller instead of
          pushing the rows below out of line. One layer over the bar column handles dragging and the period line. */}
      <div className="tl-chart">
        {items.map((it, i) => (
          <div key={`l${i}`} className={`tl-label${active[i] ? ' on' : ''}`} style={{ gridRow: i + 1 }}>{it.label}<small>{it.sub}</small></div>
        ))}
        {items.map((it, i) => (
          <div key={`t${i}`} className="tl-track" style={{ gridRow: i + 1 }}>
            <span className={`tl-bar${it.edu ? ' edu' : ''}${active[i] ? ' on' : ''}`} style={{ left: `${clamp(pct(spans[i].from))}%`, width: `${clamp(pct(spans[i].to)) - clamp(pct(spans[i].from))}%` }} />
          </div>
        ))}
        <div className="tl-tracks" ref={tracks} onPointerDown={onDown} data-ring style={{ gridRow: `1 / ${items.length + 1}` }}>
          <span className="tl-cursor" style={{ left: `${pct(mid)}%` }} />
        </div>
        <div className="tl-scrub" style={{ gridRow: items.length + 1 }}>
          <label className="sr-only" htmlFor="tl-range">{labels.year}</label>
          <input id="tl-range" type="range" min={0} max={n - 1} step={1} value={idx}
            aria-valuetext={lead ? `${period}: ${lead.sub}, ${lead.label}` : period}
            onChange={(e) => setIdx(Number(e.target.value))} />
          <div className="tl-ticks mono" aria-hidden="true">
            {ticks.map((t, i) => <span key={i} className={t.major ? 'major' : undefined} style={{ visibility: t.show ? 'visible' : 'hidden' }}>{t.text}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
