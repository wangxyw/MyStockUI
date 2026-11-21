import { createHash } from 'crypto';
import { Anchor, buildCohorts, Quote } from './marketPessimismEngine';

export const SIZES = ['LARGE', 'MID', 'SMALL'] as const;
export type Size = typeof SIZES[number];
type Half = 'A' | 'B';
type GroupPoint = { n: number; day: number | null };
type StockCounts = { n: number; sum: number; advance: number; down: number; deep: number };
type SizeCounts = Record<Size, StockCounts>;
export type RegimeTape = {
  date: string; n: number; advance: number | null; down: number | null; deep: number | null;
  groups: Record<Size, GroupPoint>; halves: Record<Half, Record<Size, GroupPoint>>;
};

const empty = (): StockCounts => ({ n: 0, sum: 0, advance: 0, down: 0, deep: 0 });
const sizeCounts = (): SizeCounts => ({ LARGE: empty(), MID: empty(), SMALL: empty() });
const hashHalf = (symbol: string): Half => createHash('sha256').update(symbol).digest()[31] % 2 === 0 ? 'A' : 'B';

function add(tape: StockCounts, pct: number) {
  tape.n++;
  tape.sum += pct;
  tape.advance += Number(pct > 0);
  tape.down += Number(pct < 0);
  tape.deep += Number(pct <= -3);
}

export class MarketRegimeTapeAccumulator {
  private byDate: Map<string, number>;
  private cohorts: ReturnType<typeof buildCohorts>;
  private totals: Array<{ all: StockCounts; entire: SizeCounts; A: SizeCounts; B: SizeCounts }>;
  private expected = new Map<string, Record<Half, Record<Size, number>>>();
  private symbol = '';
  private half: Half = 'A';
  private last = -2;
  private consecutive = 0;

  constructor(private calendar: string[], anchors: Anchor[]) {
    this.byDate = new Map(calendar.map((date, i) => [date, i]));
    this.cohorts = buildCohorts(calendar, anchors);
    const cachedHalves = new Map<string, Half>();
    this.cohorts.forEach(({ members }, month) => {
      const denominator = { A: { LARGE: 0, MID: 0, SMALL: 0 }, B: { LARGE: 0, MID: 0, SMALL: 0 } };
      members.forEach((size, symbol) => {
        if (size === 'ALL') return;
        let half = cachedHalves.get(symbol);
        if (!half) {
          half = hashHalf(symbol);
          cachedHalves.set(symbol, half);
        }
        denominator[half][size]++;
      });
      this.expected.set(month, denominator);
    });
    this.totals = calendar.map(() => ({ all: empty(), entire: sizeCounts(), A: sizeCounts(), B: sizeCounts() }));
  }

  consume(row: Quote) {
    const i = this.byDate.get(row.date);
    if (i === undefined) throw new Error('Quote outside market regime calendar');
    if (row.symbol !== this.symbol) {
      this.symbol = row.symbol;
      this.last = -2;
      this.half = hashHalf(row.symbol);
    }
    if (i !== this.last + 1) this.consecutive = 0;
    this.last = i;
    const pct = Number(row.pct);
    if (!/^(sh|sz|bj)\d{6}$/.test(row.symbol) || !Number.isFinite(pct) || row.pct === null || row.pct === undefined || row.pct === '' ||
      !(Number(row.close) > 0) || !(Number(row.amount) > 0) || pct <= -100 || pct > 100) {
      this.consecutive = 0;
      return;
    }
    this.consecutive++;
    if (this.consecutive < 21) return;
    const totals = this.totals[i];
    add(totals.all, pct);
    const size = this.cohorts.get(row.date.slice(0, 7))?.members.get(row.symbol);
    if (size && size !== 'ALL') {
      add(totals.entire[size], pct);
      add(totals[this.half][size], pct);
    }
  }

  finish(): RegimeTape[] {
    return this.calendar.map((date, i) => {
      const totals = this.totals[i];
      const month = date.slice(0, 7);
      const known = totals.all.n >= 4000;
      const point = (counts: StockCounts, expected: number, minimum: number): GroupPoint => ({
        n: counts.n,
        day: known && expected > 0 && counts.n >= minimum && counts.n >= 0.8 * expected ? counts.sum / counts.n : null,
      });
      const sizePoints = (counts: SizeCounts, expected: Record<Size, number> | undefined, minimum: number): Record<Size, GroupPoint> => ({
        LARGE: point(counts.LARGE, expected?.LARGE || 0, minimum),
        MID: point(counts.MID, expected?.MID || 0, minimum),
        SMALL: point(counts.SMALL, expected?.SMALL || 0, minimum),
      });
      const fraction = (v: number) => known ? 100 * v / totals.all.n : null;
      return {
        date, n: totals.all.n, advance: fraction(totals.all.advance), down: fraction(totals.all.down), deep: fraction(totals.all.deep),
        groups: sizePoints(totals.entire, this.cohorts.get(month)?.counts, 100),
        halves: {
          A: sizePoints(totals.A, this.expected.get(month)?.A, 40),
          B: sizePoints(totals.B, this.expected.get(month)?.B, 40),
        },
      };
    });
  }
}
