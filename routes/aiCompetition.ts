import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router } from 'express';

export type Row = Record<string, string>;
export interface Bar { symbol: string; date: string; open: number | null; close: number; high: number | null; low: number | null }
export interface Outcome {
  status: string; entryDate: string | null; entryPrice: number | null;
  exitDate: string | null; exitPrice: number | null; holdDays: number | null;
  calendarDays: number | null; netReturnPct: number | null; markReturnPct: number | null;
  reason: string; tpPrice: number | null; slPrice: number | null;
}
export interface Candidate {
  id: string; team: string; symbol: string; name: string; decisionDate: string;
  alertDate: string | null; alertPrice: number | null; decisionPrice: number | null;
  industry: string; industryScope: string; industryAsOf: string | null;
  ruleId: string; family: string; strategyVersion: string; executionModel: string;
  captureScope: string; capturedAt: string | null; status: string; reason: string;
  marketWindow: string; limitPrice: number | null; tp: number | null; sl: number | null;
  horizon: number | null; orderId: string; sourceKey: string; rank: number;
  selectionReason: string; alertId: string; recordType: string; factors: Row | null;
}
export const TEAM_DEFS = [
  { id: 'Codex', label: 'changhong · Codex', color: '#2563eb' },
  { id: 'Deepseek', label: 'facai · Deepseek', color: '#d97706' },
  { id: 'Kimi', label: 'AlwaysWin · Kimi', color: '#0f766e' },
];
export const COMPETITION_START = '2026-07-20';
export const BENCHMARK = { id: 'NEXT_OPEN_TP15_SL8_H60_V1', tp: 15, sl: 8, horizon: 60, notional: 100000 };
export const DATA_CONTRACT_VERSION = '1';
export class CompetitionDataError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'CompetitionDataError'; }
}
export const REQUIRED_COLUMNS = {
  orders: ['order_id', 'event_date', 'decision_date', 'status', 'priority_rank', 'symbol', 'name', 'record_type', 'alert_id', 'rule_id', 'family', 'strategy_version', 'execution_model', 'decision_price', 'limit_price', 'tp_pct', 'sl_pct', 'horizon_days', 'reason', 'source_key'],
  views: ['order_id', 'status'],
  equity: ['trade_date', 'cash', 'equity', 'positions'],
  trades: ['trade_date', 'action', 'symbol', 'amount', 'fee', 'pnl', 'source_key'],
  selections: ['candidate_id', 'decision_date', 'symbol', 'name', 'rule_id', 'family', 'strategy_version', 'execution_model', 'decision_price', 'limit_price', 'tp_pct', 'sl_pct', 'horizon_days', 'capture_scope', 'captured_at', 'execution_status', 'execution_reason', 'formal_order_id', 'selection_rank'],
  summary: ['decision_date', 'candidate_count', 'capture_scope', 'captured_at'],
};
export const resolveSimulationRoot = (env: NodeJS.ProcessEnv = process.env) => path.resolve(env.AI_SIMULATION_ROOT?.trim() || '/Users/xywang/Documents/AI_Simulation');
export const finite = (v: any): number | null => v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
const positive = (v: any) => { const n = finite(v); return n !== null && n > 0 ? n : null; };
export const validDate = (v: any): boolean => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export const dateDays = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const shiftDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const pct = (a: number | null, b: number | null) => a !== null && a > 0 && b !== null ? (b / a - 1) * 100 : null;
const round = (n: number | null) => n === null ? null : Math.round(n * 10000) / 10000;

// RFC 4180, including quoted commas/newlines and escaped double quotes.
export function parseCsv(text: string, required: string[] = [], sourceLabel = 'CSV'): Row[] {
  const records: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) quoted = false;
      else { if (cell) throw new Error('CSV 引号格式错误'); quoted = true; }
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v !== '')) records.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV 尚未写完');
  if (cell || row.length) { row.push(cell); records.push(row); }
  if (!records.length) throw new Error('CSV 缺少表头');
  const headers = records.shift()!;
  if (new Set(headers).size !== headers.length || headers.some(h => !h)) throw new Error('CSV 表头异常');
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) throw new CompetitionDataError('SCHEMA_MISMATCH', `${sourceLabel} 数据格式不兼容，缺少必需字段：${missing.join('、')}；请先恢复输出协议或升级适配器`);
  return records.map(values => {
    if (values.length !== headers.length) throw new Error('CSV 行字段数异常，可能正在更新');
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}
const readCsv = (p: string, required: string[] = [], source = 'CSV') => parseCsv(fs.readFileSync(p, 'utf8'), required, source);
const statusRank = (s: string) => s === 'QUALIFIED' ? 10 : ['ARMED', 'PLACED', 'PENDING'].includes(s) ? 20 : s.startsWith('NOT_ARMED_') ? 30 : s === 'FILLED' || s.startsWith('EXPIRED_') || s.startsWith('CANCELED_') ? 40 : 0;
export function normalizeCandidates(team: string, orders: Row[], selections: Row[] = [], includeUnordered = true): Candidate[] {
  const groups = new Map<string, { first: Row; latest: Row; index: number }>();
  orders.forEach((r, index) => {
    if (!r.order_id || !validDate(r.decision_date) || !/^(sh|sz|bj)\d{6}$/.test(r.symbol)) throw new Error(`${team} 候选标识或日期异常`);
    const previous = groups.get(r.order_id);
    if (!previous) groups.set(r.order_id, { first: r, latest: r, index });
    else if (r.event_date > previous.latest.event_date || (r.event_date === previous.latest.event_date && statusRank(r.status) >= statusRank(previous.latest.status))) { previous.latest = r; previous.index = index; }
  });
  if (new Set(selections.map(r => r.candidate_id)).size !== selections.length) throw new Error(`${team} 候选快照重复`);
  const snapshots = new Map(selections.map(r => [r.candidate_id, r]));
  if (includeUnordered) {
    const knownIds = new Set([...groups.values()].map(g => g.latest.candidate_id || crypto.createHash('sha256').update(`${team}|${g.latest.order_id}`).digest('hex')));
    selections.forEach(r => {
      if (knownIds.has(r.candidate_id)) return;
      if (r.formal_order_id) throw new Error(`${team} 候选关联订单尚未对齐`);
      if (!r.candidate_id || !validDate(r.decision_date) || !/^(sh|sz|bj)\d{6}$/.test(r.symbol)) throw new Error(`${team} 候选快照标识异常`);
      const row = { ...r, order_id: `CANDIDATE:${r.candidate_id}`, event_date: r.decision_date, status: r.execution_status, reason: r.execution_reason, priority_rank: r.selection_rank };
      groups.set(row.order_id, { first: row, latest: row, index: groups.size });
    });
  }
  const result = [...groups.values()].map(g => {
    const r = g.latest, first = g.first;
    const id = r.candidate_id || crypto.createHash('sha256').update(`${team}|${r.order_id}`).digest('hex');
    const snapshot = snapshots.get(id);
    if (snapshot && (snapshot.symbol !== r.symbol || snapshot.decision_date !== r.decision_date || snapshot.rule_id !== r.rule_id)) throw new Error(`${team} 候选快照身份不匹配`);
    const metadata = snapshot || r;
    return {
      id,
      team, symbol: r.symbol, name: r.name, decisionDate: r.decision_date,
      alertDate: validDate(metadata.alert_date) ? metadata.alert_date : null,
      alertPrice: positive(metadata.alert_price), decisionPrice: positive(first.decision_price),
      industry: metadata.industry || '', industryScope: metadata.industry_scope || 'CURRENT_MAPPING', industryAsOf: metadata.industry_as_of || null,
      ruleId: r.rule_id, family: r.family, strategyVersion: r.strategy_version || '未记录版本', executionModel: r.execution_model || '未记录执行模型',
      captureScope: metadata.capture_scope || 'RECORDED_LEDGER', capturedAt: metadata.captured_at || null,
      status: r.status, reason: r.reason, marketWindow: metadata.market_window || (r.reason?.startsWith('WINDOW_') ? r.reason.replace(/^WINDOW_/, '') : '未记录'),
      limitPrice: positive(first.limit_price), tp: positive(first.tp_pct), sl: positive(first.sl_pct), horizon: positive(first.horizon_days),
      orderId: r.order_id, sourceKey: r.source_key, rank: finite(first.priority_rank) || 0,
      selectionReason: metadata.selection_reason || r.family, alertId: r.alert_id, recordType: r.record_type, factors: snapshot || null,
    };
  });
  if (new Set(result.map(r => r.id)).size !== result.length) throw new Error(`${team} 存在重复候选`);
  return result;
}
export function normalizeBars(rows: any[]): Record<string, Bar[]> {
  const result: Record<string, Bar[]> = {};
  rows.forEach(r => {
    const date = String(r.date).slice(0, 10); const close = positive(r.close);
    if (!validDate(date) || close === null) return;
    let open = positive(r.open);
    if (open === null && r.var_props) { try { open = positive(JSON.parse(r.var_props)?.day_prices?.start_price); } catch (_) { /* missing source stays null */ } }
    const high = positive(r.high), low = positive(r.low);
    const rangeValid = high !== null && low !== null && high >= low && close >= low - 0.011 && close <= high + 0.011;
    if (open !== null && rangeValid && (open > high! + 0.011 || open < low! - 0.011)) open = null;
    (result[r.symbol] ||= []).push({ symbol: r.symbol, date, close, open, high: rangeValid ? high : null, low: rangeValid ? low : null });
  });
  Object.values(result).forEach(series => { series.sort((a, b) => a.date.localeCompare(b.date)); if (new Set(series.map(b => b.date)).size !== series.length) throw new Error('同一个股同日行情重复'); });
  return result;
}
const emptyOutcome = (status: string, reason: string): Outcome => ({ status, reason, entryDate: null, entryPrice: null, exitDate: null, exitPrice: null, holdDays: null, calendarDays: null, netReturnPct: null, markReturnPct: null, tpPrice: null, slPrice: null });
function netReturn(entry: number, exit: number): number {
  const shares = Math.floor(BENCHMARK.notional / entry / 100) * 100;
  if (!shares) return NaN;
  const buy = shares * entry, sell = shares * exit;
  return (sell - Math.max(5, sell * .0003) - sell * .0005 - buy - Math.max(5, buy * .0003)) / (buy + Math.max(5, buy * .0003)) * 100;
}
export function evaluate(candidate: Candidate, series: Bar[], marketDates: string[], asOf: string, mode: 'own' | 'benchmark'): Outcome {
  if (mode === 'own' && !['MANUAL_CONDITION_ORDER_V2_ATR025_CAP1', 'DS_COND_ORDER_V1_GATE_ATR025_CAP1', 'AW_COND_ORDER_V2_ATR025_CAP1'].includes(candidate.executionModel)) return emptyOutcome('UNSUPPORTED_MODEL', '执行模型尚未接入，未套用其他模型');
  const nextDate = marketDates.find(d => d > candidate.decisionDate);
  if (!nextDate || nextDate > asOf) return emptyOutcome('PENDING_ENTRY', '等待选股后的下一市场交易日');
  const entryIndex = series.findIndex(b => b.date === nextDate);
  if (entryIndex < 0) return emptyOutcome(mode === 'own' ? 'EXPIRED_NO_PRICE' : 'NO_ENTRY_PRICE', '下一市场交易日无有效个股行情；不顺延买入');
  const first = series[entryIndex]; let entry: number;
  const tp = mode === 'benchmark' ? BENCHMARK.tp : candidate.tp;
  const sl = mode === 'benchmark' ? BENCHMARK.sl : candidate.sl;
  const horizon = mode === 'benchmark' ? BENCHMARK.horizon : candidate.horizon;
  if (tp === null || sl === null || sl >= 100 || horizon === null || !Number.isInteger(horizon)) return emptyOutcome('MISSING_TERMS', '缺少冻结的TP/SL/H参数');
  if (mode === 'benchmark') {
    if (first.open === null) return emptyOutcome('NO_OPEN_PRICE', '缺少真实开盘价，未使用收盘价替代');
    entry = first.open;
  } else {
    if (candidate.limitPrice === null || first.high === null || first.low === null) return emptyOutcome('MISSING_TERMS', '缺少冻结限价或当日高低价');
    if (first.low > candidate.limitPrice) return emptyOutcome('EXPIRED_UNFILLED', 'D+1 DAY限价未触及；有效期1日');
    entry = Math.min(first.high, candidate.limitPrice);
  }
  const tpPrice = entry * (1 + tp / 100), slPrice = entry * (1 - sl / 100);
  let held = 0, last = first, trigger = false;
  const base: Outcome = { ...emptyOutcome('OPEN', '尚未触发退出'), entryDate: first.date, entryPrice: entry, tpPrice, slPrice, holdDays: 0, calendarDays: 0 };
  if (!Number.isFinite(netReturn(entry, entry))) return { ...base, status: 'UNSIZABLE', reason: '10万元研究名义资金不足以买入一手' };
  for (let i = entryIndex + 1; i < series.length && series[i].date <= asOf; i++) {
    const b = series[i]; held = i - entryIndex; last = b;
    if (b.high === null || b.low === null) return { ...base, status: 'INCOMPLETE_OHLC', holdDays: held, reason: '路径缺少高低价，无法判定先前是否退出' };
    let exit: number | null = null, status = '', reason = '';
    if (mode === 'benchmark') {
      if (b.open === null) return { ...base, status: 'NO_OPEN_PRICE', holdDays: held, reason: '退出路径缺少开盘价，无法评估跳空' };
      if (b.open <= slPrice) { exit = b.open; status = 'SL'; reason = '开盘跳空至SL以下'; }
      else if (b.open >= tpPrice) { exit = b.open; status = 'TP'; reason = '开盘跳空至TP以上'; }
      else if (b.low <= slPrice) { exit = slPrice; status = 'SL'; reason = b.high >= tpPrice ? '同日TP/SL均触及，SL优先' : '触发SL'; }
      else if (b.high >= tpPrice) { exit = tpPrice; status = 'TP'; reason = '触发TP'; }
    } else {
      if (b.low <= slPrice) { exit = candidate.team === 'Deepseek' ? slPrice : b.high < slPrice ? b.low : slPrice; status = 'SL'; reason = b.high >= tpPrice ? '同日TP/SL均触及，SL优先' : '触发SL'; }
      else if (b.high >= tpPrice) { exit = candidate.team === 'Deepseek' ? tpPrice : b.low > tpPrice ? b.low : tpPrice; status = 'TP'; reason = '触发TP'; }
    }
    if (exit === null && ((mode === 'benchmark' || candidate.team === 'Deepseek') ? held >= horizon : trigger)) { exit = b.close; status = 'TIME'; reason = mode === 'own' && candidate.team !== 'Deepseek' ? 'H到期后的下一有效行情日收盘退出' : 'H到期收盘退出'; }
    if (exit !== null) return { ...base, status, reason, exitDate: b.date, exitPrice: exit, holdDays: held, calendarDays: dateDays(b.date, first.date), netReturnPct: round(netReturn(entry, exit)), markReturnPct: null };
    if (held >= horizon) trigger = true;
  }
  return { ...base, holdDays: held, calendarDays: dateDays(last.date, first.date), markReturnPct: round(netReturn(entry, last.close)), reason: trigger ? 'H已触发，等待下一有效行情日收盘' : '截至行情日尚未退出（浮动收益不计胜率）' };
}
export function periodStart(asOf: string, period: string): string {
  if (period === 'day') return asOf;
  if (period === 'month') return `${asOf.slice(0, 7)}-01`;
  if (period === 'quarter') return `${asOf.slice(0, 4)}-${String(Math.floor((Number(asOf.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
  if (period === 'year') return `${asOf.slice(0, 4)}-01-01`;
  return COMPETITION_START;
}
export function aggregateOutcomes(rows: any[], mode: 'own' | 'benchmark') {
  const outcomes: Outcome[] = rows.map(r => r[mode]);
  const closed = outcomes.filter(r => ['TP', 'SL', 'TIME'].includes(r.status) && r.netReturnPct !== null);
  const entered = outcomes.filter(r => r.entryPrice !== null && !['UNSIZABLE', 'INCOMPLETE_OHLC', 'NO_OPEN_PRICE'].includes(r.status));
  const open = outcomes.filter(r => r.status === 'OPEN');
  const evaluatedReturns = [...closed.map(r => r.netReturnPct!), ...open.map(r => r.markReturnPct!).filter(Number.isFinite)];
  return { candidates: rows.length, uniqueStocks: new Set(rows.map(r => r.symbol)).size, entered: entered.length, completed: closed.length, open: open.length,
    tp: closed.filter(r => r.status === 'TP').length, sl: closed.filter(r => r.status === 'SL').length, time: closed.filter(r => r.status === 'TIME').length,
    expired: outcomes.filter(r => r.status.startsWith('EXPIRED')).length,
    missing: outcomes.filter(r => ['NO_OPEN_PRICE', 'NO_ENTRY_PRICE', 'INCOMPLETE_OHLC', 'MISSING_TERMS', 'UNSIZABLE', 'UNSUPPORTED_MODEL'].includes(r.status)).length,
    pending: outcomes.filter(r => r.status === 'PENDING_ENTRY').length,
    avgNetReturnPct: closed.length ? round(closed.reduce((s, r) => s + r.netReturnPct!, 0) / closed.length) : null,
    avgEvaluatedReturnPct: evaluatedReturns.length ? round(evaluatedReturns.reduce((a, b) => a + b, 0) / evaluatedReturns.length) : null,
    avgOpenReturnPct: open.length ? round(open.reduce((s, r) => s + r.markReturnPct!, 0) / open.length) : null,
    winPct: closed.length ? round(closed.filter(r => r.netReturnPct! > 0).length / closed.length * 100) : null,
    avgHoldDays: closed.length ? round(closed.reduce((s, r) => s + r.holdDays!, 0) / closed.length) : null,
    maturityPct: entered.length ? round(closed.length / entered.length * 100) : null };
}
export function accountPeriod(equity: Row[], trades: Row[], initial: number, start: string, end: string) {
  const eligible = equity.filter(r => validDate(r.trade_date) && r.trade_date >= COMPETITION_START && r.trade_date <= end).sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  const current = [...eligible].reverse().find(r => r.trade_date <= end);
  if (!current || current.trade_date < start || !positive(current.equity)) return { available: false, returnPct: null, pnl: null, buyCount: 0, sellCount: 0, completed: 0, winPct: null, latestDate: current?.trade_date || null };
  const prior = [...eligible].reverse().find(r => r.trade_date < start);
  const base = prior ? positive(prior.equity) : positive(initial);
  const periodTrades = trades.filter(r => r.trade_date >= start && r.trade_date <= current.trade_date && r.trade_date >= COMPETITION_START);
  const sells = periodTrades.filter(r => r.action === 'SELL');
  return { available: base !== null, returnPct: round(pct(base, positive(current.equity))), pnl: base === null ? null : round(Number(current.equity) - base), buyCount: periodTrades.filter(r => r.action === 'BUY').length, sellCount: sells.length, completed: sells.length, winPct: sells.length ? round(sells.filter(r => finite(r.pnl)! > 0).length / sells.length * 100) : null, latestDate: current.trade_date, equity: positive(current.equity), startEquity: base };
}
export function rankRows(rows: any[], value: string) {
  const sorted = [...rows].sort((a, b) => (b[value] ?? -Infinity) - (a[value] ?? -Infinity));
  let prior: number | null = null, rank = 0;
  return sorted.map((r, index) => { const v = r[value]; if (v === null || v === undefined) return { ...r, rank: null }; if (prior === null || Math.abs(v - prior) > .00001) rank = index + 1; prior = v; return { ...r, rank }; });
}
interface TeamData { id: string; label: string; candidates: Candidate[]; equity: Row[]; trades: Row[]; state: any; latestDate: string; warnings: string[] }
const FILE_NAMES = ['condition_orders.csv', 'condition_orders_user_view.csv', 'equity_curve.csv', 'trades.csv', 'portfolio_state.json'];
export function readTeams(root: string): TeamData[] {
  if (!fs.existsSync(root)) throw new CompetitionDataError('DATA_ROOT_MISSING', '服务器未部署竞赛候选数据目录；请同步完整团队数据并配置 AI_SIMULATION_ROOT');
  return TEAM_DEFS.map(def => {
    const dir = path.join(root, def.id, 'state');
    if (fs.existsSync(path.join(dir, '.paper_trading_transaction.json'))) throw new Error(`${def.label} 账本正在更新，请稍后刷新`);
    const files = FILE_NAMES.map(f => path.join(dir, f));
    const missing = FILE_NAMES.filter((_, i) => !fs.existsSync(files[i]));
    if (missing.length) throw new CompetitionDataError('TEAM_FILES_MISSING', `${def.label} 服务端缺少数据文件：state/${missing.join('、state/')}；请同步完整账本，不能按零候选统计`);
    const exportPath = path.join(root, def.id, '07_data_exports/selection_candidates.csv');
    const summaryPath = path.join(root, def.id, '07_data_exports/selection_candidate_daily_summary.csv');
    if (fs.existsSync(exportPath) !== fs.existsSync(summaryPath)) throw new CompetitionDataError('DATA_INCOMPLETE', `${def.label} 候选快照与每日覆盖表缺少配套文件，请同步完整数据`);
    if (fs.existsSync(exportPath)) files.push(exportPath, summaryPath);
    const stamp = () => files.map(p => { const s = fs.statSync(p); return `${p}:${s.size}:${s.mtimeMs}`; }).join('|');
    const before = stamp();
    const orders = readCsv(files[0], REQUIRED_COLUMNS.orders, `${def.label} condition_orders.csv`), views = readCsv(files[1], REQUIRED_COLUMNS.views, `${def.label} condition_orders_user_view.csv`), equity = readCsv(files[2], REQUIRED_COLUMNS.equity, `${def.label} equity_curve.csv`), trades = readCsv(files[3], REQUIRED_COLUMNS.trades, `${def.label} trades.csv`);
    let state: any;
    try { state = JSON.parse(fs.readFileSync(files[4], 'utf8')); } catch (_) { throw new CompetitionDataError('SCHEMA_MISMATCH', `${def.label} portfolio_state.json 数据格式不兼容`); }
    if (!state || positive(state.initial_capital) === null || finite(state.cash) === null || !Array.isArray(state.positions)) throw new CompetitionDataError('SCHEMA_MISMATCH', `${def.label} portfolio_state.json 缺少有效 initial_capital、cash 或 positions，请核对账户输出协议`);
    const selectionColumns = def.id === 'Codex' ? [...REQUIRED_COLUMNS.selections, 'schema_version'] : REQUIRED_COLUMNS.selections;
    const selections = fs.existsSync(exportPath) ? readCsv(exportPath, selectionColumns, `${def.label} selection_candidates.csv`) : [];
    selections.forEach(r => {
      if (r.schema_version !== undefined && r.schema_version !== DATA_CONTRACT_VERSION) throw new CompetitionDataError('UNSUPPORTED_SCHEMA_VERSION', `${def.label} 候选快照格式版本 ${/^\d{1,8}$/.test(r.schema_version) ? r.schema_version : '异常'} 尚未接入，请先升级适配器`);
      const teamName = { Codex: 'changhong', Deepseek: 'facai', Kimi: 'AlwaysWin' }[def.id];
      if (r.team && ![def.id, teamName].includes(r.team) || r.ai && r.ai !== def.id) throw new CompetitionDataError('SCHEMA_MISMATCH', `${def.label} 候选快照团队身份不一致`);
    });
    const canonical = normalizeCandidates(def.id, orders, selections, false);
    const candidates = normalizeCandidates(def.id, orders, selections);
    if (new Set(views.map(r => r.order_id)).size !== views.length || views.length !== canonical.length || canonical.some(c => !views.some(v => v.order_id === c.orderId && v.status === c.status))) throw new Error(`${def.label} 流水与用户视图尚未对齐，请稍后刷新`);
    const latestDate = equity.map(r => r.trade_date).filter(validDate).sort().pop();
    if (!latestDate) throw new Error(`${def.label} 缺少权益记录`);
    const lastEquity = equity.find(r => r.trade_date === latestDate)!;
    if (new Set(equity.map(r => r.trade_date)).size !== equity.length || positive(state.initial_capital) === null || finite(state.cash) === null || finite(lastEquity.cash) === null || Math.abs(Number(state.cash) - Number(lastEquity.cash)) > .02 || Number(lastEquity.positions) !== (state.positions || []).length) throw new Error(`${def.label} 账户与权益尚未对齐`);
    if (state.last_trade_date && state.last_trade_date !== latestDate) throw new Error(`${def.label} 账户与权益日期尚未对齐`);
    if (before !== stamp() || fs.existsSync(path.join(dir, '.paper_trading_transaction.json'))) throw new Error(`${def.label} 数据正在更新，请稍后刷新`);
    if (fs.existsSync(summaryPath)) {
      const summary = readCsv(summaryPath, REQUIRED_COLUMNS.summary, `${def.label} selection_candidate_daily_summary.csv`);
      if (new Set(summary.map(r => r.decision_date)).size !== summary.length || summary.map(r => r.decision_date).sort().pop() !== latestDate || summary.some(r => !validDate(r.decision_date) || finite(r.candidate_count) !== selections.filter(s => s.decision_date === r.decision_date).length)) throw new Error(`${def.label} 候选覆盖表尚未对齐最新账本`);
    }
    if (candidates.some(c => c.decisionDate > latestDate)) throw new Error(`${def.label} 候选与权益日期尚未对齐`);
    const warnings: string[] = [];
    if (def.id === 'Deepseek' && candidates.some(c => c.captureScope === 'RECORDED_LEDGER')) warnings.push('早期候选来自旧流水；2026-10-12起新日结另存完整门控前观察快照，不追认历史缺失项。');
    if (candidates.some(c => c.captureScope === 'RECORDED_LEDGER')) warnings.push('旧账本未记录候选捕获时刻；报警日/行业缺失项按当前源查询，并标注来源。');
    return { ...def, candidates, equity, trades, state, latestDate, warnings };
  });
}
export const candidateActual = (candidate: Candidate, trades: Row[], asOf: string, expectedEntryDate: string | undefined) => {
  const relevant = trades.filter(t => t.trade_date <= asOf && (t.order_id ? t.order_id === candidate.orderId : t.source_key === candidate.sourceKey && t.symbol === candidate.symbol));
  const buy = relevant.find(t => t.action === 'BUY' && (t.order_id ? t.order_id === candidate.orderId : t.trade_date === expectedEntryDate));
  if (!buy) return { status: 'NOT_BOUGHT', returnPct: null, pnl: null, buyDate: null, sellDate: null, reason: candidate.reason };
  const sell = relevant.find(t => t.action === 'SELL' && t.trade_date > buy.trade_date && (!t.buy_date || t.buy_date === buy.trade_date));
  return { status: sell ? 'CLOSED' : 'OPEN', returnPct: sell && positive(buy.amount) !== null && finite(sell.pnl) !== null ? round(Number(sell.pnl) / (Number(buy.amount) + (finite(buy.fee) || 0)) * 100) : null, pnl: sell ? finite(sell.pnl) : null, buyDate: buy.trade_date, sellDate: sell?.trade_date || null, reason: sell?.reason || '实际持仓未退出' };
};
export function buildDashboard(teams: TeamData[], bars: Record<string, Bar[]>, marketDates: string[], industries: Record<string, string>, alerts: any[], options: any, policy: any) {
  const availableDate = marketDates[marketDates.length - 1];
  if (!availableDate) throw new Error('行情日期缺失');
  const asOf = options.asOf && validDate(options.asOf) ? options.asOf < availableDate ? options.asOf : availableDate : availableDate;
  const period = options.period || 'month', scope = options.scope || 'competition';
  const anchor = options.periodDate && validDate(options.periodDate) ? options.periodDate < asOf ? options.periodDate : asOf : asOf;
  const start = periodStart(anchor, period);
  const end = period === 'day' ? anchor : period === 'all' ? asOf : (() => {
    const year = Number(anchor.slice(0, 4)), month = Number(anchor.slice(5, 7));
    const nextMonth = period === 'year' ? 12 : period === 'quarter' ? Math.floor((month - 1) / 3) * 3 + 3 : month;
    return new Date(Date.UTC(year, nextMonth, 0)).toISOString().slice(0, 10);
  })();
  const rawCohortEnd = end < asOf ? end : asOf;
  const cohortEnd = scope === "research" && rawCohortEnd >= COMPETITION_START ? shiftDays(COMPETITION_START, -1) : rawCohortEnd;
  const cohortStart = scope === 'research' && period === 'all' ? '1900-01-01' : scope === 'competition' && start < COMPETITION_START ? COMPETITION_START : start;
  const duration = options.days || policy.defaultDays;
  const visibleSince = shiftDays(asOf, -duration);
  const alertMap = new Map(alerts.map(r => [`${r.record_type}:${r.id}`, r]));
  const evaluated = teams.map(team => {
    const selected = team.candidates.filter(c => c.decisionDate <= asOf && (scope === 'competition' ? c.decisionDate >= COMPETITION_START : c.decisionDate < COMPETITION_START));
    const rows = selected.map(original => {
      const c = { ...original }; const series = bars[c.symbol] || [], prices = series.filter(b => b.date <= asOf);
      const sourceAlert: any = alertMap.get(`${c.recordType}:${c.alertId}`);
      // An alert ID may be reused after rebuilding source tables. Never attach a future or unrelated alert.
      if (!c.alertDate && sourceAlert?.symbol === c.symbol && validDate(sourceAlert.alert_date) && sourceAlert.alert_date <= c.decisionDate) {
        const clockMatches = c.team === 'Deepseek' ? sourceAlert.alert_date === c.decisionDate : series.find(b => b.date > sourceAlert.alert_date)?.date === c.decisionDate;
        if (clockMatches) c.alertDate = sourceAlert.alert_date;
      }
      if (c.alertPrice === null && c.alertDate) c.alertPrice = prices.find(b => b.date === c.alertDate)?.close || null;
      if (!c.industry) { c.industry = industries[c.symbol] || '未映射'; c.industryScope = 'CURRENT_MAPPING'; c.industryAsOf = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
      const current = prices[prices.length - 1];
      return { ...c, currentPrice: current?.close || null, currentPriceDate: current?.date || null,
        alertDateScope: original.alertDate ? 'RECORDED' : c.alertDate ? 'CURRENT_SOURCE_LOOKUP' : 'MISSING',
        moveSinceAlertPct: round(pct(c.alertPrice, current?.close || null)), moveSinceSelectionPct: round(pct(c.decisionPrice, current?.close || null)),
        ageDays: dateDays(asOf, c.decisionDate), visible: c.decisionDate >= visibleSince,
        own: evaluate(c, series, marketDates, asOf, 'own'), benchmark: evaluate(c, series, marketDates, asOf, 'benchmark'), actual: candidateActual(c, team.trades, asOf, marketDates.find(d => d > c.decisionDate)) };
    });
    const ruleHistory = new Map<string, any>();
    [...new Set(rows.map(r => `${r.strategyVersion}|${r.ruleId}`))].forEach(key => ruleHistory.set(key, aggregateOutcomes(rows.filter(r => `${r.strategyVersion}|${r.ruleId}` === key), 'own')));
    rows.forEach(r => { Object.assign(r, { ruleHistory: ruleHistory.get(`${r.strategyVersion}|${r.ruleId}`) }); });
    const cohort = rows.filter(r => r.decisionDate >= cohortStart && r.decisionDate <= cohortEnd);
    return { id: team.id, label: team.label, latestDate: team.latestDate, warnings: team.warnings, allCount: rows.length, hiddenOlder: rows.filter(r => !r.visible).length,
      candidates: rows.sort((a, b) => b.decisionDate.localeCompare(a.decisionDate) || a.rank - b.rank || a.symbol.localeCompare(b.symbol)), own: aggregateOutcomes(cohort, 'own'), benchmark: aggregateOutcomes(cohort, 'benchmark') };
  });
  const commonAccountDate = teams.map(t => t.latestDate < cohortEnd ? t.latestDate : cohortEnd).sort()[0];
  const accountStart = start < COMPETITION_START ? COMPETITION_START : start;
  const actual = scope === 'competition' ? rankRows(teams.map(team => ({ id: team.id, label: team.label, ...accountPeriod(team.equity, team.trades, Number(team.state.initial_capital), accountStart, commonAccountDate) })), 'returnPct') : [];
  return { meta: { asOf, marketLastDate: availableDate, commonAccountDate, period, scope, periodDate: anchor, cohortStart, cohortEnd, visibleSince, displayDays: duration, benchmark: BENCHMARK, dataContractVersion: DATA_CONTRACT_VERSION,
      rankingBasis: '候选按选股日期归属所选日/月/季/年，跟踪至行情日；排名为已完结候选等权平均净收益，未完结不计胜率。',
      ownBasis: '忽略窗口/资金/仓位门控；沿用冻结D+1 DAY限价及每队TP/SL/H和退出模型。',
      feeBasis: '每候选按10万元名义买入金额折算100股整手，另计费用；双向佣金0.03%且最低5元，卖出印花税0.05%；不累乘为账户收益。',
      provenance: '重建候选与已记录候选分开标注；当前源补查的报警日/行业不是历史PIT快照。', policy },
    teams: evaluated, rankings: { actual, own: rankRows(evaluated.map(t => ({ id: t.id, label: t.label, ...t.own })), 'avgNetReturnPct'), benchmark: rankRows(evaluated.map(t => ({ id: t.id, label: t.label, ...t.benchmark })), 'avgNetReturnPct') } };
}
export function createCompetitionRouter(queryDB: (sql: string) => Promise<any>, root = resolveSimulationRoot()) {
  const router = Router();
  let cache: { key: string; at: number; payload: any } | null = null;
  router.get('/ai_competition', async (req, res) => {
    try {
      const period = String(req.query.period || 'month'), scope = String(req.query.scope || 'competition');
      const requestedDate = req.query.as_of === undefined ? '' : String(req.query.as_of);
      const periodDate = req.query.period_date === undefined ? '' : String(req.query.period_date);
      const requestedDays = req.query.days === undefined ? 0 : Number(req.query.days);
      if (!['day', 'month', 'quarter', 'year', 'all'].includes(period) || !['competition', 'research'].includes(scope) || (requestedDate && !validDate(requestedDate)) || (periodDate && !validDate(periodDate)) || (req.query.days !== undefined && ![90, 180, 365].includes(requestedDays))) { res.status(400).json({ error: '筛选参数无效' }); return; }
      const signatureOf = () => TEAM_DEFS.map(t => [...FILE_NAMES.map(f => path.join(root, t.id, 'state', f)), path.join(root, t.id, '07_data_exports/selection_candidates.csv'), path.join(root, t.id, '07_data_exports/selection_candidate_daily_summary.csv')].filter(p => fs.existsSync(p)).map(p => { const s = fs.statSync(p); return `${p}:${s.mtimeMs}:${s.size}`; }).join(':')).join('|');
      const signature = signatureOf();
      const teams = readTeams(root);
      if (signature !== signatureOf()) throw new Error('读取期间团队数据更新，请刷新');
      const policy = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'config/ai_competition_display.json'), 'utf8'));
      const key = JSON.stringify([signature, requestedDate, periodDate, period, scope, requestedDays, policy]);
      if (cache && cache.key === key && Date.now() - cache.at < 60000) { res.json(cache.payload); return; }
      const latest: any = await queryDB('SELECT MAX(LEFT(datestr,10)) AS date FROM stock_day_common_data');
      const lastDate = latest[0]?.date;
      if (!validDate(lastDate)) throw new Error('行情日期无效');
      const symbols = [...new Set(teams.flatMap(t => t.candidates.map(c => c.symbol)))];
      const priceRows: any[] = [], alertRows: any[] = [], industries: Record<string, string> = {};
      const firstDate = shiftDays(teams.flatMap(t => t.candidates.map(c => c.alertDate || c.decisionDate)).sort()[0] || COMPETITION_START, -30);
      for (let i = 0; i < symbols.length; i += 200) {
        const quoted = symbols.slice(i, i + 200).map(s => `'${s}'`).join(',');
        priceRows.push(...await queryDB(`SELECT symbol,LEFT(datestr,10) AS date,finalprice AS close,day_max_price AS high,day_min_price AS low,var_props FROM stock_day_common_data WHERE symbol IN (${quoted}) AND datestr >= '${firstDate}' AND datestr <= '${lastDate} 23:59:59' ORDER BY symbol,datestr`));
        const industryRows: any = await queryDB(`SELECT ssb.symbol,b.name FROM sw_stock_business ssb JOIN business b ON ssb.business_code=b.code WHERE ssb.symbol IN (${quoted}) AND b.business_type IN ('sw1_hy','swhy') ORDER BY ssb.symbol,CASE WHEN b.business_type='sw1_hy' THEN 0 ELSE 1 END,b.code`);
        industryRows.forEach((r: any) => { industries[r.symbol] ||= r.name; });
        for (const [table, record] of [['focus_stocks_ai', 'record1'], ['focus_stocks2_ai', 'record2']]) {
          const records: any = await queryDB(`SELECT id,symbol,LEFT(datestr,10) AS alert_date FROM ${table} WHERE symbol IN (${quoted}) AND datestr <= '${lastDate} 23:59:59'`);
          alertRows.push(...records.map((r: any) => ({ ...r, record_type: record })));
        }
      }
      const marketRows: any = await queryDB(`SELECT DISTINCT LEFT(datestr,10) AS date FROM stock_day_common_data WHERE datestr >= '${firstDate}' AND datestr <= '${lastDate} 23:59:59' ORDER BY date`);
      const payload = buildDashboard(teams, normalizeBars(priceRows), marketRows.map((r: any) => r.date), industries, alertRows, { period, scope, asOf: requestedDate, periodDate, days: requestedDays }, policy);
      readTeams(root);
      if (signature !== signatureOf()) throw new Error('查询期间团队数据更新，请刷新');
      cache = { key, at: Date.now(), payload }; res.json(payload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '数据暂不可用';
      const safe = error instanceof CompetitionDataError ? msg : /账本|流水|视图|候选|权益|行情|数据|CSV|日期/.test(msg) && !/SQL|SELECT|password|connect|ENOENT/i.test(msg) ? msg : '竞赛数据暂不可用，请检查服务端数据源';
      res.status(503).json({ error: safe, code: error instanceof CompetitionDataError ? error.code : 'DATA_UNAVAILABLE' });
    }
  });
  return router;
}
