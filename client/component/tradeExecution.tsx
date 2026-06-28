/**
 * 交易执行层 — Core A + Short E 策略执行工作台
 *
 * 数据来源: /api/trade_execution
 * 策略依据: trade_execution_strategy_v1_1_2026_06_27.md
 */
import { Tag } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { get } from '../lib';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

interface TradeCandidate {
  id: number;
  symbol: string;
  name: string;
  datestr: string;
  alert_date: string;
  days_since_alert: number | null;
  final_price: number;
  alert_price: number | null;
  execution_price: number | null;
  execution_price_date: string | null;
  tp_price: number | null;
  sl_price: number | null;
  move_since_alert_pct: number | null;
  entry_risk_state: string | null;
  execution_note: string | null;
  alert_decision: string;
  max_240_pct: number | null;
  min_240_pct: number | null;
  post_alert_decision: string;
  trade_action: string;
  strategy_layer: 'core_a' | 'short_e' | string;
  strategy_code: string;
  strategy_name: string;
  entry_window_days: number;
  tp_pct: number;
  sl_pct: number;
  max_hold_days: number;
  hist_win_pct: number;
  hist_avg_ret_pct: number;
  hist_avg_hold_days: number;
  efficiency_20d: number;
  market_regime: string;
  current_market_regime: string;
  signal_market_regime: string;
  trade_reason: string;
}

const REGIME_LABELS: Record<string, string> = {
  hot_expand: '热市 · 报扩',
  neutral: '中性',
  weak_contract: '弱市 · 收缩',
};

const REGIME_COLORS: Record<string, string> = {
  hot_expand: 'red',
  neutral: 'blue',
  weak_contract: 'green',
};

const LAYER_META: Record<string, { label: string; title: string; color: string; desc: string }> = {
  short_e: {
    label: 'Short E',
    title: '短周期效率',
    color: 'volcano',
    desc: '资金空闲时优先看，按短 TP/H 快速轮转',
  },
  core_a: {
    label: 'Core A',
    title: '核心弹性',
    color: 'gold',
    desc: '高质量报警后的中期弹性，按 TP30/H90 执行',
  },
};

const STRATEGY_ORDER: Record<string, number> = {
  E1_TP5H5: 1,
  E4_TP10H20: 2,
  CORE_A_TP30H90: 10,
};

function sortCandidates(list: TradeCandidate[]): TradeCandidate[] {
  return [...list].sort((a, b) => {
    const pa = STRATEGY_ORDER[a.strategy_code] ?? 99;
    const pb = STRATEGY_ORDER[b.strategy_code] ?? 99;
    if (pa !== pb) return pa - pb;
    const da = a.days_since_alert ?? 99;
    const db = b.days_since_alert ?? 99;
    if (da !== db) return da - db;
    return (b.efficiency_20d || 0) - (a.efficiency_20d || 0);
  });
}

function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(digits);
}

function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

const TradeExecutionView: React.FC<{ recordType?: string }> = ({
  recordType = 'record1',
}) => {
  const [candidates, setCandidates] = useState<TradeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketEnv, setMarketEnv] = useState<any>({});

  useEffect(() => {
    setLoading(true);
    const safeRecordType = recordType === 'record2' ? 'record2' : 'record1';
    get(`/api/trade_execution?record_type=${safeRecordType}`)
      .then((data: any) => {
        setCandidates(sortCandidates(data.candidates || []));
        setMarketEnv(data.market_env || {});
        setLoading(false);
      })
      .catch((err: any) => {
        console.error('trade_execution failed', err);
        setLoading(false);
      });
  }, [recordType]);

  const stats = useMemo(() => {
    const core = candidates.filter((c) => c.strategy_layer === 'core_a');
    const short = candidates.filter((c) => c.strategy_layer === 'short_e');
    return {
      total: candidates.length,
      core: core.length,
      short: short.length,
      avgEfficiency: candidates.length
        ? candidates.reduce((sum, c) => sum + (Number(c.efficiency_20d) || 0), 0) / candidates.length
        : 0,
    };
  }, [candidates]);

  const grouped = useMemo(() => {
    const layers = ['short_e', 'core_a'];
    return layers
      .map((layer) => ({
        layer,
        rows: candidates.filter((c) => c.strategy_layer === layer),
      }))
      .filter((g) => g.rows.length > 0);
  }, [candidates]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        加载交易执行候选...
      </div>
    );
  }

  const actualRegime = marketEnv.regime || 'hot_expand';

  if (!candidates.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <ThunderboltOutlined style={{ fontSize: 34, color: '#ccc', marginBottom: 12 }} />
        <div style={{ color: '#666', fontSize: 16, fontWeight: 600 }}>
          当前无可执行交易策略候选
        </div>
        <div style={{ marginTop: 12 }}>
          <Tag color={REGIME_COLORS[actualRegime] || 'default'} style={{ fontWeight: 600 }}>
            {REGIME_LABELS[actualRegime] || actualRegime}
          </Tag>
          <div style={{ fontSize: 13, color: '#bbb', marginTop: 4 }}>
            M温度: {marketEnv.temp || '—'}
            {marketEnv.vol_med != null ? `  vol10中位 ${marketEnv.vol_med}` : ''}
            {marketEnv.alarm_dir ? `  ${marketEnv.alarm_dir}` : ''}
          </div>
        </div>
        <div style={{ color: '#999', fontSize: 14, marginTop: 8 }}>
          {recordType === 'record2'
            ? 'R2 暂未纳入交易执行 v1.1，需独立短周期验证'
            : '当前没有满足 Core A / Short E 入场窗口的候选'}
        </div>
        <div style={{ color: '#999', fontSize: 14, marginTop: 4 }}>
          机会池完整候选请查看 MF1 / MF2 视图
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: '10px 14px', minWidth: 92 }}>
          <div style={{ fontSize: 13, color: '#999' }}>执行候选</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fa541c' }}>{stats.total}</div>
          <div style={{ fontSize: 13, color: '#999' }}>短效 {stats.short} · 核心 {stats.core}</div>
        </div>
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: '10px 14px', minWidth: 120 }}>
          <div style={{ fontSize: 13, color: '#999' }}>平均效率</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#cf1322' }}>
            {fmtNum(stats.avgEfficiency, 2)}
          </div>
          <div style={{ fontSize: 13, color: '#999' }}>20天折算</div>
        </div>
        <Tag color={REGIME_COLORS[actualRegime] || 'default'} style={{ fontWeight: 600 }}>
          当前市场: {REGIME_LABELS[actualRegime] || actualRegime}
        </Tag>
        <div style={{ fontSize: 15, color: '#666' }}>
          M温度: {marketEnv.temp || '—'}
          {marketEnv.vol_med != null ? `  vol10中位 ${marketEnv.vol_med}` : ''}
          {marketEnv.alarm_dir ? `  ${marketEnv.alarm_dir}` : ''}
        </div>
        <div style={{ fontSize: 14, color: '#aaa', marginLeft: 'auto' }}>
          主策略唯一：Short E 优先于 Core A
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {grouped.map(({ layer, rows }) => {
          const meta = LAYER_META[layer] || LAYER_META.core_a;
          return (
            <section key={layer}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <Tag color={meta.color} style={{ fontWeight: 700 }}>{meta.label}</Tag>
                <span style={{ fontSize: 17, fontWeight: 700 }}>{meta.title}</span>
                <span style={{ fontSize: 14, color: '#999' }}>{meta.desc}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((c, i) => {
                  const key = `${c.strategy_code}-${c.id}`;
                  const layerMeta = LAYER_META[c.strategy_layer] || LAYER_META.core_a;
                  return (
                    <div
                      key={key}
                      style={{
                        background: '#fff',
                        borderRadius: 8,
                        border: '1px solid #d0d7de',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        padding: 14,
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 17, fontWeight: 700 }}>{c.symbol}</span>
                            <span style={{ fontSize: 15, color: '#666' }}>{c.name}</span>
                            <Tag color={layerMeta.color} style={{ fontWeight: 700, fontSize: 13 }}>
                              {c.strategy_name}
                            </Tag>
                            <Tag color={c.trade_action === '可买' ? 'red' : 'orange'} style={{ fontSize: 13 }}>
                              {c.trade_action}
                            </Tag>
                            <span style={{ fontSize: 13, color: '#bbb' }}>#{i + 1}</span>
                          </div>
                          <div style={{ marginTop: 5, fontSize: 14, color: '#999' }}>
                            {c.alert_decision} · 报警 {c.alert_date}
                            {c.days_since_alert != null && (
                              <span style={{ marginLeft: 6, color: c.days_since_alert <= c.entry_window_days ? '#cf1322' : '#999' }}>
                                第 {c.days_since_alert} 天 / 窗口 {c.entry_window_days} 天
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 12, color: '#999' }}>执行价</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>¥{fmtNum(c.execution_price ?? c.final_price, 2)}</div>
                          <Tag color={REGIME_COLORS[c.signal_market_regime] || 'default'} style={{ marginTop: 4 }}>
                            {REGIME_LABELS[c.signal_market_regime] || c.signal_market_regime}
                          </Tag>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))',
                          gap: 8,
                          marginTop: 12,
                          fontSize: 14,
                        }}
                      >
                        <Metric label="止盈" value={`+${fmtPct(c.tp_pct, 0)}`} color="#cf1322" icon={<ArrowUpOutlined />} />
                        <Metric label="止盈价" value={`¥${fmtNum(c.tp_price, 2)}`} color="#cf1322" />
                        <Metric label="止损" value={fmtPct(c.sl_pct, 0)} color="#389e0d" icon={<ArrowDownOutlined />} />
                        <Metric label="止损价" value={`¥${fmtNum(c.sl_price, 2)}`} color="#389e0d" />
                        <Metric label="最大持有" value={`${c.max_hold_days}天`} />
                        <Metric label="历史胜率" value={fmtPct(c.hist_win_pct, 1)} color="#cf1322" />
                        <Metric label="平均收益" value={fmtPct(c.hist_avg_ret_pct, 2)} />
                        <Metric label="平均持有" value={`${fmtNum(c.hist_avg_hold_days, 2)}天`} />
                        <Metric label="20天效率" value={fmtNum(c.efficiency_20d, 2)} color="#fa541c" />
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 10,
                          borderTop: '1px solid #d9d9d9',
                          fontSize: 14,
                          color: '#666',
                        }}
                      >
                        <div style={{ marginBottom: 6 }}>{c.trade_reason}</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                          <span>策略: {c.strategy_code}</span>
                          <span>报警价: ¥{fmtNum(c.alert_price, 2)}</span>
                          <span>执行价日期: {c.execution_price_date || '—'}</span>
                          <span>较报警日: {fmtPct(c.move_since_alert_pct, 2)}</span>
                          <span>风险状态: {c.entry_risk_state || '—'}</span>
                          {c.execution_note && <span>{c.execution_note}</span>}
                          <span>报警环境: {REGIME_LABELS[c.signal_market_regime] || c.signal_market_regime}</span>
                          <span>当前市场: {REGIME_LABELS[c.current_market_regime] || c.current_market_regime}</span>
                          {c.post_alert_decision && (
                            <span>后市: {c.post_alert_decision.replace('后', '').substring(0, 24)}</span>
                          )}
                          {c.max_240_pct != null && (
                            <span>
                              长期验证参考: max240 {fmtPct(c.max_240_pct, 0)}
                              {c.min_240_pct != null ? ` / min240 ${fmtPct(c.min_240_pct, 0)}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

const Metric: React.FC<{
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}> = ({ label, value, color, icon }) => (
  <div>
    <span style={{ color: '#999', fontSize: 12 }}>{label}</span>
    <br />
    <span style={{ color: color || '#333', fontWeight: 600 }}>
      {icon ? <>{icon} </> : null}
      {value}
    </span>
  </div>
);

export default TradeExecutionView;
