import React, { createContext, useContext, useEffect, useState } from 'react';
import { M_TREND_GRID } from './data_trends_semantics';
import './MTrendInteraction.css';

export const M_TREND_PLOT_INSETS = { marginLeft: M_TREND_GRID.left, marginRight: M_TREND_GRID.right };
export const M_TREND_PLOT_TOP = 42;
export const getMTrendPlotBottom = (hasSlider: boolean) => hasSlider ? 60 : 40;

type DatePosition = { date: string; left: number };
type Cursor = DatePosition & { preview: boolean };
const CursorContext = createContext<Cursor | null>(null);

const dayCenter = (index: number, count: number) => 100 * (index + 0.5) / count;

export function getMTrendTicks(dates: string[], width: number): DatePosition[] {
  const plotWidth = width - M_TREND_GRID.left - M_TREND_GRID.right;
  const count = Math.min(dates.length, 15, Math.max(2, Math.floor(plotWidth / 76) + 1));
  return Array.from({ length: count }, (_, i) => {
    const index = count === 1 ? 0 : Math.round(i * (dates.length - 1) / (count - 1));
    return { date: dates[index], left: dayCenter(index, dates.length) };
  });
}

export function MTrendDateAxis({ ticks }: { ticks: DatePosition[] }) {
  return <div className="m-trend-date-axis" style={M_TREND_PLOT_INSETS}>
    {ticks.map(tick => <span key={tick.date} style={{ left: `${tick.left}%` }}>{tick.date}</span>)}
  </div>;
}

export function MTrendDateGuide({ showDate = false }: { showDate?: boolean }) {
  const cursor = useContext(CursorContext);
  if (!cursor) return null;
  return <span className={`m-trend-date-guide${cursor.preview ? ' is-preview' : ''}`}
    style={{ left: `${cursor.left}%` }} data-m-guide-date={cursor.date} aria-hidden="true">
    {showDate && <span>{cursor.date}</span>}
  </span>;
}

function pointerDate(event: React.MouseEvent<HTMLDivElement>, dates: string[], chartOnly = false) {
  const target = event.target as Element;
  const chart = target.closest('[data-m-date-chart]');
  if (chartOnly && !chart) return null;
  const area = chart?.querySelector('[data-m-date-area]') ?? target.closest('[data-m-date-area]');
  if (!area) return null;
  const box = area.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  if (box.width <= 0 || x < box.left || x >= box.right || y < box.top || y > box.bottom + (chart ? 24 : 0)) return null;
  return dates[Math.floor((x - box.left) / box.width * dates.length)] ?? null;
}

export function MTrendInteraction({ dates, selectedDate, onSelect, children }: React.PropsWithChildren<{
  dates: string[];
  selectedDate?: string;
  onSelect: (date: string) => void;
}>) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  useEffect(() => { setHoveredDate(null); }, [selectedDate]);
  const hover = hoveredDate && dates.includes(hoveredDate) ? hoveredDate : null;
  const date = hover ?? selectedDate;
  const index = date ? dates.indexOf(date) : -1;
  const cursor = date && index >= 0
    ? { date, left: dayCenter(index, dates.length), preview: !!hover && hover !== selectedDate } : null;
  return <CursorContext.Provider value={cursor}>
    <div onPointerMove={event => {
      if (event.pointerType !== 'touch') setHoveredDate(pointerDate(event, dates));
    }} onPointerLeave={() => setHoveredDate(null)} onClick={event => {
      const clicked = pointerDate(event, dates, true);
      if (clicked) onSelect(clicked);
    }}>
      {children}
    </div>
  </CursorContext.Provider>;
}

export function onMTrendDateKey(event: React.KeyboardEvent<HTMLButtonElement>, dates: string[], index: number,
  onSelect: (date: string) => void) {
  const destinations: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: dates.length - 1 };
  if (destinations[event.key] === undefined) return;
  event.preventDefault();
  const date = dates[Math.max(0, Math.min(destinations[event.key], dates.length - 1))];
  if (!date) return;
  onSelect(date);
  event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)?.focus();
}
