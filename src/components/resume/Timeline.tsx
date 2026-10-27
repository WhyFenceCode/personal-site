/**
 * Scrubbable resume timeline. A native range input drives it, so it works with the keyboard
 * (arrow keys, Home/End) and screen readers; dragging across the bars works too.
 */
import { useMemo, useRef, useState } from 'react';

type Item = { label: string; sub: string; from: number; to: number; edu: boolean; detail: string };
type Props = { items: Item[]; range: { from: number; to: number }; labels: { year: string } };

export default function Timeline({ items, range, labels }: Props) {
  const [year, setYear] = useState(Math.min(range.to, new Date().getFullYear()));
  const tracks = useRef<HTMLDivElement>(null);
  const span = range.to + 1 - range.from;
  const pct = (v: number) => ((v - range.from) / span) * 100;
  const v = year + 0.5;
  const active = useMemo(() => items.map((it) => v >= it.from && v < it.to + 0.5), [items, v]);
  const lead = items.find((it, i) => active[i] && !it.edu) ?? items.find((_, i) => active[i]);
  const years = Array.from({ length: span }, (_, i) => range.from + i);

  const scrub = (clientX: number) => {
    const r = tracks.current!.getBoundingClientRect();
    const y = Math.round(range.from + ((clientX - r.left) / r.width) * span - 0.5);
    setYear(Math.max(range.from, Math.min(range.to, y)));
  };
  const onDown = (e: React.PointerEvent) => {
    scrub(e.clientX);
    const move = (ev: PointerEvent) => scrub(ev.clientX);
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };

  return (
    <div className="tl">
      <div className="tl-top">
        <div className="tl-year num" aria-hidden="true">{year}</div>
        <div className="tl-now" aria-live="polite">
          <span className="mono muted">{year}</span>
          {lead ? <><b>{lead.sub}, {lead.label}</b><span className="muted">{lead.detail}</span></> : <b>—</b>}
        </div>
      </div>
      <div className="tl-chart">
        <div className="tl-labels">
          {items.map((it, i) => <div key={i} className={`tl-label${active[i] ? ' on' : ''}`}>{it.label}<small>{it.sub}</small></div>)}
        </div>
        <div className="tl-tracks" ref={tracks} onPointerDown={onDown} data-ring>
          {items.map((it, i) => (
            <div key={i} className="tl-track">
              <span className={`tl-bar${it.edu ? ' edu' : ''}${active[i] ? ' on' : ''}`} style={{ left: `${pct(it.from)}%`, width: `${pct(it.to) - pct(it.from)}%` }} />
            </div>
          ))}
          <span className="tl-cursor" style={{ left: `${pct(v)}%` }} />
        </div>
        <div className="tl-scrub">
          <label className="sr-only" htmlFor="tl-range">{labels.year}</label>
          <input id="tl-range" type="range" min={range.from} max={range.to} step={1} value={year}
            aria-valuetext={lead ? `${year}: ${lead.sub}, ${lead.label}` : String(year)}
            onChange={(e) => setYear(Number(e.target.value))} />
          <div className="tl-ticks mono" aria-hidden="true">{years.map((y, i) => <span key={y} style={{ visibility: i % 2 ? 'hidden' : 'visible' }}>{String(y).slice(2)}</span>)}</div>
        </div>
      </div>
    </div>
  );
}
