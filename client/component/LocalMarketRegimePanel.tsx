import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Select, Space, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { MarketAnomalyItem } from './data_trends_semantics';
import { MTrendDateAxis, MTrendDateGuide, M_TREND_PLOT_INSETS, onMTrendDateKey } from './MTrendInteraction';
import { getMarketRegimeReadout } from './market_regime_readout';
import './LocalMarketRegimePanel.css';

type Direction = -1 | 0 | 1 | null;
type State = { background: Direction; swing: Direction };
type Size = 'LARGE' | 'MID' | 'SMALL';
type Group = { n: number; day: number | null; r5: number | null; r20: number | null; backgroundReturn: number | null };
type Anomaly = 'new' | 'active' | 'cleared' | 'quiet' | 'unknown';
type ForecastKind = 'up' | 'down' | 'background' | 'none';
type Forecast = Record<ForecastKind, number> & {
  basis: 'state_age' | 'state'; n: number; through: string; destinations?: { target: State; n: number }[];
};
type Actual = { kind: ForecastKind; date: string | null; target: State | null };
type Day = State & {
  date: string; n: number; raw: Direction; pending: number; age: number; change: State | null;
  advance: number | null; down: number | null; deep: number | null; anomaly: Anomaly;
  groups: Record<Size, Group>; forecast: Forecast | null; actual: Actual | null;
  validation: {
    state: { n: number; baselineF1: number | null; responsiveF1: number | null; events: number;
      baselineMatched: number; responsiveMatched: number };
    forecast: { n: number; brier: number | null; baselineBrier: number | null };
  };
};
type Payload = {
  version: string; source: 'LOCAL_DATABASE'; evidence_scope: 'RECONSTRUCTED';
  data_through: string; generated_at: string; rows: Day[];
};

const STATE_NAMES = [
  ['下行延续', '弱势盘整', '下跌中修复'],
  ['盘整转弱', '中性盘整', '盘整走强'],
  ['上涨转弱', '高位盘整', '上涨延续'],
];
const BACKGROUNDS = ['下行背景', '中性背景', '上行背景'];
const SWINGS = ['波段下行', '波段盘整', '波段上行'];
const ANOMALIES: Record<Anomaly, string> = {
  new: '个股普跌 · 新出现', active: '个股普跌 · 持续', cleared: '个股普跌 · 解除',
  quiet: '个股普跌 · 未触发', unknown: '个股普跌 · 数据不足',
};
const SIZE_GROUPS: { key: Size; name: string }[] = [
  { key: 'LARGE', name: '大盘' }, { key: 'MID', name: '中盘' }, { key: 'SMALL', name: '小盘' },
];
const OUTCOMES: { key: ForecastKind; label: string }[] = [
  { key: 'up', label: '波段转强' }, { key: 'down', label: '波段转弱' },
  { key: 'background', label: '只改背景' }, { key: 'none', label: '维持状态' },
];

const showNumber = (x: number | null | undefined, decimals: number) => (
  typeof x === 'number' && Number.isFinite(x) ? x.toFixed(decimals) : '—'
);
const percent = (x: number | null | undefined, digits = 1) => (
  typeof x === 'number' && Number.isFinite(x) ? `${x.toFixed(digits)}%` : '—'
);
const rate = (x: number | null) => percent(x === null ? null : x * 100);
const stateName = ({ background, swing }: State) => (
  background === null || swing === null ? '状态未定' : STATE_NAMES[background + 1][swing + 1]
);
const backgroundName = (d: Direction) => d === null ? '背景未定' : BACKGROUNDS[d + 1];
const swingName = (d: Direction) => d === null ? '波段未定' : SWINGS[d + 1];
const tone = (d: Direction) => d === 1 ? 'is-up' : d === -1 ? 'is-down' : d === 0 ? 'is-flat' : 'is-unknown';

function ForecastReadout({ forecast, anomaly }: { forecast: Forecast | null; anomaly: Anomaly }) {
  if (!forecast) return <div className="local-regime-forecast-missing">{anomaly === 'new' || anomaly === 'active'
    ? '个股普跌期间，常规转换频率暂停显示' : '历史支持不足，暂无频率读数'}</div>;
  return (
    <>
      <div className="local-regime-probability" aria-hidden="true">
        {OUTCOMES.map(({ key }) => <i key={key} className={`local-regime-prob-${key}`} style={{ flexGrow: forecast[key] }} />)}
      </div>
      <dl className="local-regime-probability-values">
        {OUTCOMES.map(({ key, label }) => (
          <div key={key}>
            <dt><i className={`local-regime-prob-${key}`} />{label}</dt>
            <dd>{rate(forecast[key])}</dd>
          </div>
        ))}
      </dl>
      <div className="local-regime-fineprint">
        {forecast.basis === 'state_age' ? '同状态及持续时间' : '同状态'}历史样本 {forecast.n} 日 · 样本截至 {forecast.through}
      </div>
      {!!forecast.destinations?.length && <div className="local-regime-fineprint">
        历史转入 {forecast.destinations.slice(0, 2).map(item => `${stateName(item.target)} ${item.n} 例`).join(' · ')}
      </div>}
    </>
  );
}

function actualText(actual: Actual | null) {
  if (!actual) return '结果尚未成熟或数据缺失';
  if (actual.kind === 'none') return '事后参照五日内无新转换';
  const direction = OUTCOMES.find(row => row.key === actual.kind)?.label;
  return [actual.date, direction, actual.target ? stateName(actual.target) : null].filter(Boolean).join(' · ');
}

function Validation({ row }: { row: Day }) {
  const { state, forecast } = row.validation;
  return (
    <details className="local-regime-review">
      <summary>方法与历史核验</summary>
      <div className="local-regime-review-grid">
        <div><strong>状态识别 · 截至 {row.date}</strong>
          <div>有效 {state.n} 日 · 宏 F1　快慢组合 {rate(state.responsiveF1)} / 20 日基线 {rate(state.baselineF1)}</div>
          <div>转换匹配　快慢组合 {state.responsiveMatched} / {state.events}，20 日基线 {state.baselineMatched} / {state.events}</div>
        </div>
        <div><strong>提前观察 · 截至 {row.date}</strong>
          <div>成熟 {forecast.n} 日 · Brier　同状态频率 {showNumber(forecast.brier, 3)} / 全体历史基线 {showNumber(forecast.baselineBrier, 3)}（越低越好）</div>
          <div>状态评分按不同半组股票交叉核验。波段连续三日同向后确认。</div>
        </div>
      </div>
      <div className="local-regime-review-outcome"><strong>选中日期的事后结果</strong> · {actualText(row.actual)}</div>
    </details>
  );
}

function Evidence({ row }: { row: Day }) {
  return (
    <div className="local-regime-evidence">
      <div className="local-regime-evidence-head">
        <strong>当日证据</strong>
        <div>合格股票 {row.n.toLocaleString()} 只 · 上涨 {percent(row.advance)} · 下跌 {percent(row.down)} · 跌至少 3% {percent(row.deep)}</div>
      </div>
      <div className="local-regime-table-wrap">
        <table className="local-regime-table">
          <thead><tr><th scope="col">等权分组</th><th scope="col">样本</th><th scope="col">当日</th><th scope="col">近 5 日</th><th scope="col">近 20 日</th><th scope="col">中期收益</th></tr></thead>
          <tbody>
            {SIZE_GROUPS.map(({ key, name }) => {
              const g = row.groups[key];
              return <tr key={key}><th scope="row">{name}</th><td>{g.n.toLocaleString()}</td>
                <td>{percent(g.day)}</td><td>{percent(g.r5)}</td><td>{percent(g.r20)}</td><td>{percent(g.backgroundReturn)}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function useLocalMarketRegime() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const reply = await fetch(`/api/market_regime_trend${refresh ? '?refresh=1' : ''}`, { signal: controller.signal });
      if (!reply.ok) throw new Error('Market regime request failed');
      const value: Payload = await reply.json();
      if (value.source !== 'LOCAL_DATABASE' || !value.data_through || !Array.isArray(value.rows)) {
        throw new Error('Unexpected market regime payload');
      }
      if (request.current === controller) setPayload(value);
    } catch {
      if (request.current === controller && !controller.signal.aborted) setError('全市场窗口数据加载失败');
    } finally {
      if (request.current === controller && !controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => request.current?.abort();
  }, [load]);
  return { payload, loading, error, load };
}

const LocalMarketRegimePanel: React.FC<{
  source: ReturnType<typeof useLocalMarketRegime>;
  daysTill: string;
  visibleDates: string[];
  ticks: React.ComponentProps<typeof MTrendDateAxis>['ticks'];
  selectedDate?: string;
  dailyState?: MarketAnomalyItem['state'];
  onSelectDate: (date: string) => void;
}> = ({ source, daysTill, visibleDates, ticks, selectedDate, dailyState, onSelectDate }) => {
  const { payload, loading, error, load } = source;
  const rows = (payload?.rows || []).filter(row => row.date <= daysTill);
  const latest = rows[rows.length - 1];
  const byDate = new Map(rows.map(row => [row.date, row]));
  const displayedDate = selectedDate ?? latest?.date;
  const day = displayedDate ? byDate.get(displayedDate) : undefined;
  const readout = getMarketRegimeReadout(day, dailyState);
  const choiceDates = [...new Set([...rows.map(row => row.date), ...(displayedDate ? [displayedDate] : [])])].sort().reverse();

  return (
    <section aria-label="全市场窗口与转换" className="local-regime-shell" data-testid="local-market-regime-panel">
      <div className="local-regime-history" data-testid="m-regime-timeline">
        <div className="local-regime-history-head">
          <strong>全市场窗口与转换 · 逐日状态</strong>
          <div className="local-regime-key">
            <span><i className="is-up" />上行</span><span><i className="is-flat" />中性</span><span><i className="is-down" />下行</span><span><i className="is-unknown" />未定</span>
          </div>
        </div>
        {!!visibleDates.length && <>
          <div className="local-regime-timeline m-trend-date-lane" data-m-date-area style={M_TREND_PLOT_INSETS}>
            <div className="local-regime-lanes" aria-hidden="true"><span>中期背景</span><span>确认波段</span><span>当日读数</span><span>异常</span></div>
            <div className="local-regime-days" role="group" aria-label="选择交易日查看详情">
              {visibleDates.map((date, pos) => {
                const row = byDate.get(date);
                const anomaly = row?.anomaly ?? 'unknown';
                const title = `${date} · ${row ? stateName(row) : '状态未定'} · 当日读数：${swingName(row?.raw ?? null)}${row?.pending ? `（确认 ${row.pending}/3 日）` : ''} · ${ANOMALIES[anomaly]}`;
                return <button key={date} data-date={date} type="button" title={title} aria-label={title}
                  aria-pressed={date === displayedDate} tabIndex={date === displayedDate ? 0 : -1}
                  onClick={() => onSelectDate(date)} onKeyDown={event => onMTrendDateKey(event, visibleDates, pos, onSelectDate)}>
                  <i className={tone(row?.background ?? null)} /><i className={tone(row?.swing ?? null)} />
                  <i className={tone(row?.raw ?? null)} />
                  <i className={`local-regime-anomaly-track anomaly-${anomaly}`} />
                </button>;
              })}
            </div>
            <MTrendDateGuide />
          </div>
          <MTrendDateAxis ticks={ticks} />
        </>}
      </div>
      {displayedDate && <div className="local-regime-action" data-kind={readout.kind} data-date={displayedDate}
        data-testid="m-regime-action-readout" aria-live="polite" aria-atomic="true">
        <div className="local-regime-action-heading">
          <span>操作解读 · {displayedDate} 收盘后</span>
          <span>研究参考 · 正式准入以各池当日正式 M 快照和各自策略为准</span>
        </div>
        <div className="local-regime-action-title">{readout.title}</div>
        <div className="local-regime-action-notes">
          {day && day.advance !== null && <p><strong>当日上涨</strong> {Math.round(day.n * day.advance / 100).toLocaleString()} / {day.n.toLocaleString()} 只（{percent(day.advance)}）</p>}
          <p><strong>主导依据</strong> {readout.reason}</p>
          <p><strong>复核条件</strong> {readout.next}</p>
        </div>
      </div>}
      <div className="local-regime" data-testid="m-regime-details">
      <div className="local-regime-heading">
        <div>
          <h3>全市场窗口与转换 · 详情</h3>
          <p>全市场等权日线 · 本地数据库 · 历史逐日复算{daysTill ? ` · 页面截至 ${daysTill}` : ''}</p>
        </div>
        <Space size="small" wrap>
          <Select<string> aria-label="研究日期" size="small" value={displayedDate} showSearch optionFilterProp="label"
            placeholder="研究日期" onChange={onSelectDate} disabled={!choiceDates.length}
            options={choiceDates.map(date => ({ value: date, label: date }))} />
          {latest && displayedDate !== latest.date && <Button size="small" onClick={() => onSelectDate(latest.date)}>返回最新</Button>}
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => load(true)}>刷新研究</Button>
        </Space>
      </div>
      {error && <div role="status" className="local-regime-error">{error}{payload ? '，当前保留上一份结果。' : '，请重试。'}</div>}
      {loading && !payload && <div className="local-regime-empty"><Spin size="small" /> 正在汇总本地行情…</div>}
      {!day && !loading && !error && <div className="local-regime-empty">{displayedDate ? `${displayedDate} 没有本地窗口读数` : '所选日期范围内没有本地行情'}</div>}
      {day && (
        <>
          <div className="local-regime-highlights">
            <div className="local-regime-current">
              <div className="local-regime-kicker">{day.date} · 已确认的中期背景与波段</div>
              <div className={`local-regime-current-title ${tone(day.swing)}`} data-testid="local-regime-selected-state">{stateName(day)}</div>
              <div className="local-regime-state-evidence">{backgroundName(day.background)} · {swingName(day.swing)}{day.age > 0 ? ` · 持续 ${day.age} 日` : ''}</div>
              {day.change && <div className="local-regime-change">{stateName(day.change)} → {stateName(day)}</div>}
              {day.raw !== null && day.raw !== day.swing && day.pending > 0 && (
                <div className="local-regime-change">{swingName(day.raw)}读数 · 连续确认 {day.pending}/3 日</div>
              )}
              <div className={`local-regime-anomaly anomaly-${day.anomaly}`}>{ANOMALIES[day.anomaly]}</div>
            </div>
            <div className="local-regime-forecast">
              <div className="local-regime-kicker">未来 1–5 个交易日 · 研究性历史频率</div>
              <ForecastReadout forecast={day.forecast} anomaly={day.anomaly} />
            </div>
          </div>
          <Evidence row={day} />
          <Validation row={day} />
          <div className="local-regime-fineprint local-regime-version">
            选定范围内最近交易日 {latest?.date} · 本地行情截至 {payload?.data_through} · {payload?.version}
          </div>
        </>
      )}
      </div>
    </section>
  );
};

export default LocalMarketRegimePanel;
