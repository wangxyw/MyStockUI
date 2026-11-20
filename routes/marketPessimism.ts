import { Router } from 'express';
import { Anchor, PessimismAccumulator, PESSIMISM_VERSION, SIZE_VERSION } from './marketPessimismEngine';

const CACHE_MS = 5 * 60 * 1000;
const START_DATE = '2024-01-02';
const select = (connection: any, sql: string, args: any[] = []): Promise<any[]> =>
  new Promise((resolve, reject) => connection.query(sql, args, (error: any, rows: any[]) =>
    error ? reject(error) : resolve(rows)));
const connectionFrom = (pool: any): Promise<any> =>
  new Promise((resolve, reject) => pool.getConnection((error: any, connection: any) =>
    error ? reject(error) : resolve(connection)));
const todayShanghai = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export function createMarketPessimismRouter(pool: any) {
  const router = Router();
  let cached: { at: number; cutoff: string; payload: any } | null = null;
  let running: Promise<any> | null = null;

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
      await new Promise<void>((resolve, reject) => {
        let problem: Error | null = null;
        const query = connection.query(
          "SELECT symbol, DATE_FORMAT(datestr,'%Y-%m-%d') date, finalprice close, " +
          'pricechangepct pct, totaltradevalue amount FROM stock_day_common_data ' +
          'WHERE datestr >= ? AND datestr < ? ORDER BY symbol, datestr', [START_DATE, cutoff]);
        query.on('result', (row: any) => {
          if (problem) return;
          try { accumulator.consume(row); } catch (error) { problem = error as Error; }
        });
        query.on('error', reject);
        query.on('end', () => problem ? reject(problem) : resolve());
      });
      const expected = calendarRows.reduce((sum, row) => sum + Number(row.n), 0);
      if (accumulator.quoteCount !== expected) throw new Error('Market row count mismatch');
      const rows = accumulator.finish();
      await select(connection, 'COMMIT');
      const payload = {
        version: PESSIMISM_VERSION, size_version: SIZE_VERSION, evidence_scope: 'RECONSTRUCTED',
        source: 'LOCAL_DATABASE', data_through: calendar[calendar.length - 1],
        first_available: rows.find(row => row.groups.ALL.score !== null)?.date || null,
        generated_at: new Date().toISOString(), complete_before: cutoff, rows,
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

  router.get('/market_pessimism_trend', async (req, res) => {
    const cutoff = todayShanghai();
    try {
      if (req.query.refresh !== '1' && cached && cached.cutoff === cutoff && Date.now() - cached.at < CACHE_MS) {
        return res.json(cached.payload);
      }
      if (!running) {
        running = calculate(cutoff).finally(() => { running = null; });
      }
      return res.json(await running);
    } catch (error) {
      console.error('market_pessimism_trend failed', (error as any)?.code || 'CALCULATION_ERROR');
      return res.status(503).json({ error: '本地行情读取或悲观值计算失败，请稍后刷新。', rows: [] });
    }
  });
  return router;
}
