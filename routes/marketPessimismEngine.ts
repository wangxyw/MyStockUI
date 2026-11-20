export const PESSIMISM_VERSION = 'PRICE_PRESSURE_PESSIMISM_V1';
export const SIZE_VERSION = 'PREVIOUS_MONTH_CAP_300_1000_V1';
export const GROUPS = ['ALL', 'LARGE', 'MID', 'SMALL'] as const;
export type Group = typeof GROUPS[number];
export type Quote = { symbol: string; date: string; close: unknown; pct: unknown; amount: unknown };
export type Anchor = { symbol: string; date: string; cap: unknown };
type Cell = { level: number; logReturn: number; down: number; absolute: number };
type Total = { n: number; weak: number; depth: number; down: number; absolute: number; drawdown: number; saturated: number };
export type Point = {
  raw: number | null; score: number | null; n: number; denominator: number; coverage: number | null;
  weak: number | null; depth: number | null; pressure: number | null;
  meanDrawdown: number | null; saturated: number | null;
};
export type DailyPoint = { date: string; rebalance: boolean; groups: Record<Group, Point> };

const finite = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const empty = (): Total => ({ n: 0, weak: 0, depth: 0, down: 0, absolute: 0, drawdown: 0, saturated: 0 });
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const compareSymbols = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function buildCohorts(calendar: string[], anchors: Anchor[]) {
  const byDate = new Map<string, Array<{ symbol: string; cap: number }>>();
  const seen = new Set<string>();
  anchors.forEach(row => {
    const cap = finite(row.cap);
    if (cap === null || cap <= 0) return;
    const key = row.date + '|' + row.symbol;
    if (seen.has(key)) throw new Error('Duplicate cap anchor');
    seen.add(key);
    const list = byDate.get(row.date) || [];
    list.push({ symbol: row.symbol, cap });
    byDate.set(row.date, list);
  });
  const cohorts = new Map<string, { members: Map<string, Group>; counts: Record<Group, number> }>();
  calendar.forEach((day, i) => {
    const month = day.slice(0, 7);
    if (i === 0 || month === calendar[i - 1].slice(0, 7)) return;
    const source = byDate.get(calendar[i - 1]);
    if (!source) return;
    const ranked = source.slice().sort((a, b) => b.cap - a.cap || compareSymbols(a.symbol, b.symbol));
    const members = new Map<string, Group>();
    const counts: Record<Group, number> = { ALL: 0, LARGE: 0, MID: 0, SMALL: 0 };
    ranked.forEach((row, rank) => {
      const group: Group = rank < 300 ? 'LARGE' : rank < 1000 ? 'MID' : 'SMALL';
      members.set(row.symbol, group);
      counts[group]++;
    });
    cohorts.set(month, { members, counts });
  });
  return cohorts;
}

export class PessimismAccumulator {
  private positions: Map<string, number>;
  private totals: Record<Group, Total>[];
  private valid: number[];
  private symbol = '';
  private lastIndex = -1;
  private window: Cell[] = [];
  private level = 0;
  private cohorts: ReturnType<typeof buildCohorts>;
  public quoteCount = 0;

  constructor(private calendar: string[], anchors: Anchor[]) {
    if (!calendar.length || calendar.some((d, i) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || (i > 0 && d <= calendar[i - 1]))) {
      throw new Error('Invalid market calendar');
    }
    this.positions = new Map(calendar.map((d, i) => [d, i]));
    this.totals = calendar.map(() => ({ ALL: empty(), LARGE: empty(), MID: empty(), SMALL: empty() }));
    this.valid = calendar.map(() => 0);
    this.cohorts = buildCohorts(calendar, anchors);
  }

  consume(row: Quote) {
    this.quoteCount++;
    const index = this.positions.get(row.date);
    if (index === undefined) throw new Error('Quote outside market calendar');
    if (row.symbol !== this.symbol) {
      if (this.symbol && row.symbol < this.symbol) throw new Error('Unsorted quotes');
      this.symbol = row.symbol;
      this.lastIndex = -1;
      this.window = [];
      this.level = 0;
    }
    if (index <= this.lastIndex) throw new Error('Duplicate or unsorted stock date');
    if (index !== this.lastIndex + 1) {
      this.window = [];
      this.level = 0;
    }
    this.lastIndex = index;
    const close = finite(row.close), amount = finite(row.amount), pct = finite(row.pct);
    if (close === null || close <= 0 || amount === null || amount <= 0 || pct === null || pct <= -100 || pct > 100) {
      this.window = [];
      this.level = 0;
      return;
    }
    this.valid[index]++;
    const logReturn = Math.log1p(pct / 100);
    this.level += logReturn;
    this.window.push({ level: this.level, logReturn, down: Math.max(-pct, 0), absolute: Math.abs(pct) });
    if (this.window.length > 63) this.window.shift();
    if (this.window.length < 63) return;

    let peak = -Infinity, sum20 = 0, compensation = 0, down = 0, absolute = 0;
    this.window.forEach((cell, i) => {
      peak = Math.max(peak, cell.level);
      if (i >= 43) {
        const value = cell.logReturn - compensation;
        const next = sum20 + value;
        compensation = (next - sum20) - value;
        sum20 = next;
      }
      if (i >= 58) {
        down += cell.down;
        absolute += cell.absolute;
      }
    });
    const drawdown = Math.max(0, 1 - Math.exp(this.level - peak));
    const weak = sum20 <= 0 ? 100 : 0;
    const depth = Math.min(drawdown / .2, 1) * 100;
    const cohort = this.cohorts.get(row.date.slice(0, 7));
    const group = cohort?.members.get(row.symbol);
    const targets: Group[] = group ? ['ALL', group] : ['ALL'];
    targets.forEach(target => {
      const total = this.totals[index][target];
      total.n++;
      total.weak += weak;
      total.depth += depth;
      total.down += down;
      total.absolute += absolute;
      total.drawdown += drawdown * 100;
      total.saturated += drawdown >= .2 - 1e-12 ? 100 : 0;
    });
  }

  finish(): DailyPoint[] {
    const states: Record<Group, { value: number; count: number }> = {
      ALL: { value: 0, count: 0 }, LARGE: { value: 0, count: 0 },
      MID: { value: 0, count: 0 }, SMALL: { value: 0, count: 0 },
    };
    return this.calendar.map((date, i) => {
      const groups = {} as Record<Group, Point>;
      GROUPS.forEach(group => {
        const t = this.totals[i][group];
        const denominator = group === 'ALL' ? this.valid[i] : this.cohorts.get(date.slice(0, 7))?.counts[group] || 0;
        const coverage = denominator ? t.n / denominator : null;
        const enough = t.n >= (group === 'ALL' ? 1000 : 100) && coverage !== null && coverage >= .8;
        const weak = enough ? t.weak / t.n : null;
        const depth = enough ? t.depth / t.n : null;
        const pressure = enough ? (t.absolute === 0 ? 50 : 100 * t.down / t.absolute) : null;
        const raw = enough ? clamp(((weak as number) + (depth as number) + (pressure as number)) / 3) : null;
        const state = states[group];
        if (raw === null) {
          state.value = 0;
          state.count = 0;
        } else {
          state.value = state.count === 0 ? raw : state.value * (2 / 3) + raw / 3;
          state.count++;
        }
        groups[group] = {
          raw, score: state.count >= 5 ? clamp(state.value) : null, n: t.n, denominator, coverage,
          weak, depth, pressure,
          meanDrawdown: enough ? t.drawdown / t.n : null,
          saturated: enough ? t.saturated / t.n : null,
        };
      });
      return { date, rebalance: i > 0 && date.slice(0, 7) !== this.calendar[i - 1].slice(0, 7), groups };
    });
  }
}
