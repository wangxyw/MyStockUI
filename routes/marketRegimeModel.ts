import type { RegimeTape } from './marketRegimeTape';

const SIZES = ['LARGE', 'MID', 'SMALL'] as const;
const DIRECTIONS = [-1, 0, 1] as const;
const KINDS = ['up', 'down', 'background', 'none'] as const;
const STATE_CONFIRMATION = 12;
const FORECAST_CONFIRMATION = 17;
const TRAINING_LENGTH = 756;
const AHEAD = 5;

type Size = typeof SIZES[number];
type Direction = typeof DIRECTIONS[number];
type Kind = typeof KINDS[number];
type State = { background: Direction; swing: Direction };
type Outcome = { kind: Kind; date: string | null; target: State | null };
type Rates = Record<Kind, number>;
type Forecast = Rates & {
  basis: 'state_age' | 'state';
  n: number;
  through: string;
  destinations: Array<{ target: State; n: number }>;
};
type GroupEvidence = RegimeTape['groups'][Size] & {
  r5: number | null;
  r20: number | null;
  backgroundReturn: number | null;
};
type Anomaly = 'new' | 'active' | 'cleared' | 'quiet' | 'unknown';
type StateValidation = {
  n: number;
  baselineF1: number | null;
  responsiveF1: number | null;
  events: number;
  baselineMatched: number;
  responsiveMatched: number;
};
type ForecastValidation = { n: number; brier: number | null; baselineBrier: number | null };

export type MarketRegimeRow = {
  date: string;
  n: number;
  background: Direction | null;
  swing: Direction | null;
  raw: Direction | null;
  pending: number;
  age: number;
  change: State | null;
  advance: number | null;
  down: number | null;
  deep: number | null;
  anomaly: Anomaly;
  groups: Record<Size, GroupEvidence>;
  forecast: Forecast | null;
  actual: Outcome | null;
  validation: { state: StateValidation; forecast: ForecastValidation };
};

type GroupReturns = Record<Size, {
  short: number | null;
  medium: number | null;
  background: number | null;
  centered: number | null;
}>;

function dailyWindows(groups: RegimeTape['groups'][]): GroupReturns[] {
  const logs = SIZES.map(size => groups.map(row => {
    const day = row[size].day;
    return day !== null && Number.isFinite(day) && day > -100 ? Math.log1p(day / 100) : null;
  }));
  return groups.map((_row, i) => {
    const output = {} as GroupReturns;
    for (const [j, size] of SIZES.entries()) {
      const sum = (from: number, through: number) => {
        if (from < 0 || through >= groups.length) return null;
        let total = 0;
        for (let k = from; k <= through; k++) {
          const value = logs[j][k];
          if (value === null) return null;
          total += value;
        }
        return total;
      };
      output[size] = {
        short: sum(i - 4, i), medium: sum(i - 19, i),
        background: sum(i - 59, i - 10), centered: sum(i - 9, i + 10),
      };
    }
    return output;
  });
}

function vote(values: (number | null)[], threshold: number): Direction | null {
  let up = 0, down = 0;
  for (const value of values) {
    if (value === null) return null;
    if (value > Math.log1p(threshold)) up++;
    if (value < Math.log1p(-threshold)) down++;
  }
  return up >= 2 ? 1 : down >= 2 ? -1 : 0;
}

function combine(background: Direction | null, swing: Direction | null): State | null {
  return background === null || swing === null ? null : { background, swing };
}

function key(state: State) {
  return `${state.background}/${state.swing}`;
}

function changeKind(from: State, into: State): Exclude<Kind, 'none'> {
  if (into.swing > from.swing) return 'up';
  if (into.swing < from.swing) return 'down';
  return 'background';
}

function readings(series: GroupReturns[], responsive: boolean) {
  let swing: Direction | null = null;
  let candidate: Direction | null = null;
  let pending = 0;
  let age = 0;
  let previous: State | null = null;
  return series.map(groups => {
    const background = vote(SIZES.map(size => groups[size].background), .05);
    const raw = vote(SIZES.map(size => {
      const { short, medium } = groups[size];
      if (!responsive) return medium;
      return short === null || medium === null ? null : .5 * medium + 2 * short;
    }), .03);
    if (raw === null) {
      swing = candidate = null;
      pending = 0;
    } else if (raw === swing) {
      candidate = null;
      pending = 0;
    } else {
      pending = raw === candidate ? pending + 1 : 1;
      candidate = raw;
      if (pending >= 3) {
        swing = raw;
        candidate = null;
        pending = 0;
      }
    }
    const state = combine(background, swing);
    const changed = state !== null && previous !== null && key(state) !== key(previous);
    const change = changed ? previous : null;
    age = state === null ? 0 : previous === null || changed ? 1 : age + 1;
    previous = state;
    return { background, swing, raw, pending, age, change, state };
  });
}

function anomalyReadings(tape: RegimeTape[]): Anomaly[] {
  let previous: boolean | null = null;
  return tape.map(({ down, deep }) => {
    if (down === null || deep === null) {
      previous = null;
      return 'unknown';
    }
    const high = down >= 75 && deep >= 40;
    const state = high ? previous === true ? 'active' : 'new' : previous === true ? 'cleared' : 'quiet';
    previous = high;
    return state;
  });
}

function hindsight(series: GroupReturns[], regular: boolean[]) {
  const raw = series.map(groups => combine(
    vote(SIZES.map(size => groups[size].background), .05),
    vote(SIZES.map(size => groups[size].centered), .03),
  ));
  const stable: (State | null)[] = raw.map(() => null);
  for (let start = 0; start < raw.length;) {
    const initial = raw[start];
    if (initial === null) {
      start++;
      continue;
    }
    let end = start + 1;
    while (end < raw.length) {
      const next = raw[end];
      if (next === null || key(next) !== key(initial)) break;
      end++;
    }
    if (end - start >= 3) stable.fill(initial, start, end);
    start = end;
  }
  let previous: State | null = null;
  let previousIndex = -1;
  const changes = stable.map((current, i): Exclude<Kind, 'none'> | null => {
    if (!regular[i] || raw[i] === null) {
      previous = null;
      return null;
    }
    if (current === null) return null;
    const kind = previous !== null && i - previousIndex <= 6 && key(current) !== key(previous)
      ? changeKind(previous, current) : null;
    previous = current;
    previousIndex = i;
    return kind;
  });
  return { raw, stable, changes };
}

function retrospectiveOutcomes(tape: RegimeTape[], history: ReturnType<typeof hindsight>, regular: boolean[],
  market: ReturnType<typeof readings>): (Outcome | null)[] {
  return tape.map((_row, i) => {
    if (i + FORECAST_CONFIRMATION >= tape.length || market[i].state === null) return null;
    for (let d = i; d <= i + AHEAD; d++) {
      if (!regular[d] || history.raw[d] === null) return null;
    }
    for (let d = i + 1; d <= i + AHEAD; d++) {
      const kind = history.changes[d];
      if (kind !== null) return { kind, date: tape[d].date, target: history.stable[d] };
    }
    if (history.stable.slice(i, i + AHEAD + 1).some(state => state === null)) return null;
    return { kind: 'none', date: null, target: null };
  });
}

function ageKey(age: number) {
  return age <= 5 ? '1-5' : age <= 15 ? '6-15' : '16+';
}

function newBucket() {
  return {
    n: 0, through: '', counts: { up: 0, down: 0, background: 0, none: 0 },
    destinations: new Map<string, { target: State; n: number }>(),
  };
}

type Bucket = ReturnType<typeof newBucket>;

function addOutcome(bucket: Bucket, outcome: Outcome, date: string) {
  bucket.n++;
  bucket.through = date;
  bucket.counts[outcome.kind]++;
  if (outcome.target !== null) {
    const name = key(outcome.target);
    const existing = bucket.destinations.get(name);
    if (existing) existing.n++;
    else bucket.destinations.set(name, { target: outcome.target, n: 1 });
  }
}

function rates(bucket: Bucket): Rates {
  const denominator = bucket.n + KINDS.length;
  const { up, down, background, none } = bucket.counts;
  return { up: (up + 1) / denominator, down: (down + 1) / denominator,
    background: (background + 1) / denominator, none: (none + 1) / denominator };
}

function removeOutcome(bucket: Bucket, outcome: Outcome) {
  bucket.n--;
  bucket.counts[outcome.kind]--;
  if (outcome.target !== null) {
    const name = key(outcome.target);
    const existing = bucket.destinations.get(name);
    if (!existing) throw new Error('Missing historical transition count');
    if (--existing.n === 0) bucket.destinations.delete(name);
  }
}

function brier(prediction: Rates, actual: Kind) {
  return KINDS.reduce((sum, kind) => sum + (prediction[kind] - (kind === actual ? 1 : 0)) ** 2, 0) / KINDS.length;
}

function macroF1(confusion: number[][]) {
  return DIRECTIONS.reduce<number>((total, _value, i) => {
    const supports = confusion[i].reduce((a, b) => a + b, 0) + confusion.reduce((sum, row) => sum + row[i], 0);
    return total + (supports === 0 ? 0 : 2 * confusion[i][i] / supports);
  }, 0) / DIRECTIONS.length;
}

function observedChange(readout: ReturnType<typeof readings>[number]) {
  const { state, change } = readout;
  return state !== null && change !== null ? changeKind(change, state) : null;
}

function matchEvent(index: number, kind: Kind, readingsA: ReturnType<typeof readings>,
  used: Set<number>, regular: boolean[]) {
  for (let i = Math.max(index - 5, 1); i <= Math.min(index + 5, readingsA.length - 1); i++) {
    if (used.has(i) || observedChange(readingsA[i]) !== kind) continue;
    if (!regular.slice(Math.min(index, i - 1), Math.max(index, i) + 1).every(Boolean)) continue;
    used.add(i);
    return 1;
  }
  return 0;
}

function percent(value: number | null) {
  return value === null ? null : 100 * Math.expm1(value);
}

export function buildMarketRegimeRows(tape: RegimeTape[]): MarketRegimeRow[] {
  if (tape.some((row, i) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || i > 0 && row.date <= tape[i - 1].date)) {
    throw new Error('Market regime dates must be unique and chronological');
  }
  const full = dailyWindows(tape.map(row => row.groups));
  const splitA = dailyWindows(tape.map(row => row.halves.A));
  const splitB = dailyWindows(tape.map(row => row.halves.B));
  const market = readings(full, true);
  const baselineA = readings(splitA, false);
  const responsiveA = readings(splitA, true);
  const anomalies = anomalyReadings(tape);
  const regular = anomalies.map(anomaly => anomaly === 'quiet' || anomaly === 'cleared');
  const history = hindsight(splitB, regular);
  const outcomes = retrospectiveOutcomes(tape, history, regular, market);
  const all = newBucket();
  const buckets = new Map<string, Bucket>();
  const forecasts: Array<{ value: Forecast; unconditional: Rates } | null> = [];
  const baselineMatrix = DIRECTIONS.map(() => [0, 0, 0]);
  const responsiveMatrix = DIRECTIONS.map(() => [0, 0, 0]);
  const baselineUsed = new Set<number>();
  const responsiveUsed = new Set<number>();
  let stateN = 0, events = 0, baselineMatched = 0, responsiveMatched = 0;
  let forecastN = 0, loss = 0, baselineLoss = 0;

  return tape.map((row, i) => {
    const matureState = i - STATE_CONFIRMATION - 1;
    if (matureState >= 0 && regular[matureState]) {
      const actualState = history.stable[matureState];
      const a = baselineA[matureState].state;
      const b = responsiveA[matureState].state;
      if (actualState && a && b) {
        stateN++;
        baselineMatrix[actualState.swing + 1][a.swing + 1]++;
        responsiveMatrix[actualState.swing + 1][b.swing + 1]++;
        const kind = history.changes[matureState];
        if (kind !== null) {
          events++;
          baselineMatched += matchEvent(matureState, kind, baselineA, baselineUsed, regular);
          responsiveMatched += matchEvent(matureState, kind, responsiveA, responsiveUsed, regular);
        }
      }
    }

    const matureForecast = i - FORECAST_CONFIRMATION - 1;
    const expired = i - TRAINING_LENGTH - 1;
    if (expired >= 0) {
      const observation = outcomes[expired];
      const entry = market[expired];
      if (observation !== null && entry.state !== null) {
        const name = key(entry.state);
        removeOutcome(all, observation);
        for (const bucketKey of [name, `${name}/${ageKey(entry.age)}`]) {
          const bucket = buckets.get(bucketKey);
          if (!bucket) throw new Error('Missing historical state count');
          removeOutcome(bucket, observation);
        }
      }
    }
    if (matureForecast >= 0) {
      const observed = outcomes[matureForecast];
      const entry = market[matureForecast];
      if (observed !== null && entry.state !== null) {
        const date = tape[matureForecast].date;
        const name = key(entry.state);
        addOutcome(all, observed, date);
        for (const bucketKey of [name, `${name}/${ageKey(entry.age)}`]) {
          if (!buckets.has(bucketKey)) buckets.set(bucketKey, newBucket());
          addOutcome(buckets.get(bucketKey) as Bucket, observed, date);
        }
        const pastPrediction = forecasts[matureForecast];
        if (pastPrediction !== null) {
          forecastN++;
          loss += brier(pastPrediction.value, observed.kind);
          baselineLoss += brier(pastPrediction.unconditional, observed.kind);
        }
      }
    }

    const current = market[i];
    let forecast: Forecast | null = null;
    if (regular[i] && current.state !== null) {
      const name = key(current.state);
      const grouped = buckets.get(`${name}/${ageKey(current.age)}`);
      const state = buckets.get(name);
      const common = grouped && grouped.n >= 25 ? grouped : state && state.n >= 35 ? state : null;
      if (common) {
        const destinations = Array.from(common.destinations.values())
          .sort((a, b) => b.n - a.n || key(a.target).localeCompare(key(b.target)))
          .slice(0, 3).map(value => ({ ...value }));
        forecast = { basis: common === grouped ? 'state_age' : 'state', n: common.n,
          through: common.through, ...rates(common), destinations };
      }
    }
    forecasts.push(forecast === null ? null : { value: forecast, unconditional: rates(all) });

    const groups = {} as MarketRegimeRow['groups'];
    for (const size of SIZES) {
      const { short, medium, background } = full[i][size];
      groups[size] = { ...row.groups[size], r5: percent(short), r20: percent(medium), backgroundReturn: percent(background) };
    }
    return { date: row.date, n: row.n, background: current.background, swing: current.swing, raw: current.raw,
      pending: current.pending, age: current.age, change: current.change, advance: row.advance, down: row.down,
      deep: row.deep, anomaly: anomalies[i], groups, forecast, actual: outcomes[i],
      validation: {
        state: { n: stateN, baselineF1: stateN ? macroF1(baselineMatrix) : null,
          responsiveF1: stateN ? macroF1(responsiveMatrix) : null, events, baselineMatched, responsiveMatched },
        forecast: { n: forecastN, brier: forecastN ? loss / forecastN : null, baselineBrier: forecastN ? baselineLoss / forecastN : null },
      },
    };
  });
}
