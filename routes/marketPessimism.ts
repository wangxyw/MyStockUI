import { Router } from 'express';
import { Anchor, PessimismAccumulator, PESSIMISM_VERSION, SIZE_VERSION } from './marketPessimismEngine';
import { MarketRegimeTapeAccumulator } from './marketRegimeTape';
import { buildMarketRegimeRows } from './marketRegimeModel';

const CACHE_MS = 5 * 60 * 1000;
const START_DATE = '2024-01-02';
const REGIME_VERSION = 'LOCAL_MARKET_REGIME_V1';
type Snapshot = { pessimism: object; regime: object | null };
const select = (connection: any, sql: string, args: any[] = []): Promise<any[]> =>
  new Promise((resolve, reject) => connection.query(sql, args, (error: any, rows: any[]) =>
    error ? reject(error) : resolve(rows)));
const connectionFrom = (pool: any): Promise<any> =>
  new Promise((resolve, reject) => pool.getConnection((error: any, connection: any) =>
    error ? reject(error) : resolve(connection)));
const shanghaiClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23',
});

export function marketSnapshotCutoff(now = new Date()): string {
  const { year, month, day, hour } = Object.fromEntries(
    shanghaiClock.formatToParts(now).map(part => [part.type, part.value]));
  // The SQL upper bound is exclusive. Include today's daily quotes after the Shanghai close.
  if (Number(hour) < 15) return `${year}-${month}-${day}`;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1)).toISOString().slice(0, 10);
}

export function createMarketPessimismRouter(pool: any) {
  const router = Router();
  let cached: { at: number; cutoff: string; payload: Snapshot } | null = null;
  let running: { cutoff: string; promise: Promise<Snapshot> } | null = null;

  const calculate = async (cutoff: string) => {
    const connection = await connectionFrom(pool);
    try {
      await select(connection, 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
      const calendarRows = await select(connection,
        "SELECT DATE_FORMAT(datestr,'%Y-%m-%d') day, COUNT(*) n, COUNT(DISTINCT symbol) stocks " +
        'FROM stock_day_common_data WHERE datestr >= ? AND datestr < ? GROUP BY day ORDER BY day',
        [START_DATE, cutoff]);
      if (!calendarRows.length || calendarRows.some(r => Number(r.n) !== Number(r.stocks))) {
        throw new Error('Incomplete or duplicate market calendar');
      }
      const calendar = calendarRows.map(r => String(r.day));
      const anchors: Anchor[] = await select(connection,
        "SELECT s.symbol, DATE_FORMAT(s.datestr,'%Y-%m-%d') date, s.marketvalue cap " +
        'FROM stock_day_common_data s JOIN (' +
        "SELECT MAX(DATE_FORMAT(datestr,'%Y-%m-%d')) anchor FROM stock_day_common_data " +
        "WHERE datestr >= ? AND datestr < ? GROUP BY DATE_FORMAT(datestr,'%Y-%m')" +
        ') a ON s.datestr >= a.anchor AND s.datestr < DATE_ADD(a.anchor, INTERVAL 1 DAY) ' +
        'WHERE s.marketvalue > 0 ORDER BY s.datestr, s.symbol', [START_DATE, cutoff]);
      const accumulator = new PessimismAccumulator(calendar, anchors);
      let regimeTape: MarketRegimeTapeAccumulator | null = null;
      try {
        regimeTape = new MarketRegimeTapeAccumulator(calendar, anchors);
      } catch {
        console.error('market_regime_trend initialization failed');
      }
      await new Promise<void>((resolve, reject) => {
        let problem: Error | null = null;
        const query = connection.query(
          "SELECT symbol, DATE_FORMAT(datestr,'%Y-%m-%d') date, finalprice close, " +
          'pricechangepct pct, totaltradevalue amount FROM stock_day_common_data ' +
          'WHERE datestr >= ? AND datestr < ? ORDER BY symbol, datestr', [START_DATE, cutoff]);
        query.on('result', (row: any) => {
          if (problem) return;
          try { accumulator.consume(row); } catch (error) { problem = error as Error; }
          if (regimeTape) {
            try { regimeTape.consume(row); } catch {
              regimeTape = null;
              console.error('market_regime_trend row aggregation failed');
            }
          }
        });
        query.on('error', reject);
        query.on('end', () => problem ? reject(problem) : resolve());
      });
      const expected = calendarRows.reduce((sum, row) => sum + Number(row.n), 0);
      if (accumulator.quoteCount !== expected) throw new Error('Market row count mismatch');
      const rows = accumulator.finish();
      await select(connection, 'COMMIT');
      const metadata = {
        evidence_scope: 'RECONSTRUCTED', source: 'LOCAL_DATABASE', data_through: calendar[calendar.length - 1],
        generated_at: new Date().toISOString(), complete_before: cutoff,
      };
      let regime: Snapshot['regime'] = null;
      if (regimeTape) {
        try {
          regime = { ...metadata, version: REGIME_VERSION, rows: buildMarketRegimeRows(regimeTape.finish()) };
        } catch {
          console.error('market_regime_trend calculation failed');
        }
      }
      const payload = {
        pessimism: { ...metadata, version: PESSIMISM_VERSION, size_version: SIZE_VERSION,
          first_available: rows.find(row => row.groups.ALL.score !== null)?.date || null, rows },
        regime,
      };
      cached = { at: Date.now(), cutoff, payload };
      return payload;
    } catch (error) {
      await select(connection, 'ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  };

  const readSnapshot = async (force: boolean): Promise<Snapshot> => {
    const cutoff = marketSnapshotCutoff();
    if (!force && cached && cached.cutoff === cutoff && Date.now() - cached.at < CACHE_MS) {
      return Promise.resolve(cached.payload);
    }
    if (running) {
      if (running.cutoff === cutoff) return running.promise;
      await running.promise.catch(() => undefined);
      return readSnapshot(force);
    }
    const promise = calculate(cutoff).finally(() => { running = null; });
    running = { cutoff, promise };
    return promise;
  };

  router.get('/market_pessimism_trend', async (req, res) => {
    try {
      const snapshot = await readSnapshot(req.query.refresh === '1');
      return res.json(snapshot.pessimism);
    } catch (error) {
      console.error('market_pessimism_trend failed', (error as any)?.code || 'CALCULATION_ERROR');
      return res.status(503).json({ error: '本地行情读取或悲观值计算失败，请稍后刷新。', rows: [] });
    }
  });
  router.get('/market_regime_trend', async (req, res) => {
    try {
      const snapshot = await readSnapshot(req.query.refresh === '1');
      if (snapshot.regime) return res.json(snapshot.regime);
    } catch (error) {
      console.error('market_regime_trend failed', (error as any)?.code || 'CALCULATION_ERROR');
    }
    return res.status(503).json({ error: '本地市场状态计算暂不可用，请稍后刷新。', rows: [] });
  });
  return router;
}
