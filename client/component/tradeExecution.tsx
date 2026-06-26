/**
 * 交易执行层 — A 层可执行候选视图
 *
 * 数据来源: /api/trade_execution  (routes/index.ts)
 * 策略依据: mechanical_trading_strategy.md + trade_execution_layer_design_2026_06_26.md
 *
 * 集成方式: 在现有的 focus 页面上新增一个 tab，例如 myFocus.tsx 中增加 TabPane
 *    <TabPane tab="交易执行" key="trade">
 *      <TradeExecutionView recordType="record1" />
 *    </TabPane>
 */
import { Tag } from 'antd';
import React, { useEffect, useState, useMemo } from 'react';
import { get } from '../lib';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

// ============== Types ==============
interface TradeCandidate {
  id: number;
  symbol: string;
  name: string;
  datestr: string;
  alert_date: string;
  days_since_alert: number | null;
  final_price: number;
  alert_decision: string;
  comments: string;
  max_240_pct: number;
  min_240_pct: number;
  post_alert_observe_date: string;
  post_alert_decision: string;
  trade_tier: string;
  trade_action: string;
  tp_pct: number;
  sl_pct: number;
  max_hold_days: number;
  market_regime: string;
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

const REGIME_TIPS: Record<string, string> = {
  hot_expand: 'A 层优先 · 当前适宜执行',
  neutral: 'A 层保留 · 谨慎执行',
  weak_contract: '弱市降频 · 优先急跌修复/低分修复',
};

// ============== 排序优先级 ==============
const PRIORITY_ORDER: Record<string, number> = {
  '试｜急跌修复': 1,
  '试｜低分修复': 2,
  '试｜承接修复': 2,
  '买｜低位修复': 3,
  '买｜高弹强主': 3,
  '跟踪｜集中修复': 4,
};

function sortCandidates(list: TradeCandidate[]): TradeCandidate[] {
  return [...list].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.alert_decision] ?? 99;
    const pb = PRIORITY_ORDER[b.alert_decision] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.max_240_pct || 0) - (a.max_240_pct || 0);
  });
}

// ============== Component ==============
const TradeExecutionView: React.FC<{ recordType?: 'record1' | 'record2' }> = ({
  recordType = 'record1',
}) => {
  const [candidates, setCandidates] = useState<TradeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [marketEnv, setMarketEnv] = useState<any>({});

  useEffect(() => {
    setLoading(true);
    get(`/api/trade_execution?record_type=${recordType}`)
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
    if (!candidates.length) return null;
    const regime = candidates[0].market_regime || 'hot_expand';
    const ts = candidates.filter((c) => c.alert_decision.startsWith('试')).length;
    const ms = candidates.filter((c) => c.alert_decision.startsWith('买')).length;
    return { count: candidates.length, ts, ms, regime };
  }, [candidates]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        加载交易执行候选...
      </div>
    );
  }

  if (!candidates.length) {
    const actualRegime = marketEnv.regime || 'hot_expand';
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <ThunderboltOutlined style={{ fontSize: 32, color: '#ccc', marginBottom: 12 }} />
        <div style={{ color: '#666', fontSize: 14, fontWeight: 500 }}>
          当前无可执行 A 层候选
        </div>
        <div style={{ marginTop: 12 }}>
          <Tag color={REGIME_COLORS[actualRegime]} style={{ fontWeight: 600 }}>
            {REGIME_LABELS[actualRegime]}
          </Tag>
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
            M温度: {marketEnv.temp || '—'}
            {marketEnv.vol_med != null ? `  vol10中位 ${marketEnv.vol_med}` : ''}
            {marketEnv.alarm_dir ? `  ${marketEnv.alarm_dir}` : ''}
          </div>
        </div>
        <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
          {recordType === 'record2'
            ? 'R2 交易执行候选待后市确认后自动进入'
            : '最近 7 天内未触发买/试级别的强信号'}
        </div>
        <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
          机会池完整候选请查看 MF1 / MF2 视图
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 0' }}>
      {/* ===== 头部统计 ===== */}
      {stats && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: '10px 16px',
              border: '1px solid #f0f0f0',
              minWidth: 100,
            }}
          >
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>A 层候选</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#faad14' }}>
              {stats.count}
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>
              试 {stats.ts} · 买 {stats.ms}
            </div>
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: '10px 16px',
              border: '1px solid #f0f0f0',
              minWidth: 100,
            }}
          >
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>执行参数</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#cf1322' }}>
              TP30 / SL-5
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>最大持有 90 天</div>
          </div>

          <Tag
            color={REGIME_COLORS[stats.regime] || 'default'}
            style={{ fontWeight: 600 }}
          >
            {REGIME_LABELS[stats.regime] || stats.regime}
          </Tag>

          <div style={{ fontSize: 14, color: '#666' }}>
            M温度: {marketEnv.temp || '—'}
            {marketEnv.vol_med != null ? `  vol10中位 ${marketEnv.vol_med}` : ''}
            {marketEnv.alarm_dir ? `  ${marketEnv.alarm_dir}` : ''}
          </div>

          <div style={{ fontSize: 14, color: '#666' }}>
            {REGIME_TIPS[stats.regime] || ''}
          </div>

          <div style={{ fontSize: 12, color: '#bbb', flex: 1, textAlign: 'right' }}>
            排序：试｜急跌修复 → 试｜低分修复 → 买｜低位修复
          </div>
        </div>
      )}

      {/* ===== 候选列表 ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map((c, i) => {
          const open = expanded.has(c.id);
          return (
            <div
              key={c.id}
              style={{
                background: '#fff',
                borderRadius: 8,
                border: open ? '1px solid #faad14' : '1px solid #f0f0f0',
                padding: 14,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onClick={() => toggleExpand(c.id)}
            >
              {/* 顶行: symbol + 价格 + 层级 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{c.symbol}</span>
                  <span style={{ fontSize: 13, color: '#666' }}>{c.name}</span>
                  <Tag color="gold" style={{ fontWeight: 700, fontSize: 11 }}>
                    A 层
                  </Tag>
                  <span style={{ fontSize: 11, color: '#bbb' }}>#{i + 1}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    ¥{c.final_price?.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: '#bbb' }}>
                    {c.alert_date}
                    {c.days_since_alert != null && c.days_since_alert >= 0 && (
                      <span style={{ marginLeft: 4, color: c.days_since_alert <= 2 ? '#cf1322' : '#999' }}>
                        ({c.days_since_alert}天前)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* TP/SL/持有/收益 一行 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                  marginTop: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: '#999', fontSize: 10 }}>止盈</span>
                  <br />
                  <span style={{ color: '#cf1322', fontWeight: 600 }}>
                    <ArrowUpOutlined /> +{c.tp_pct}%
                  </span>
                </div>
                <div>
                  <span style={{ color: '#999', fontSize: 10 }}>止损</span>
                  <br />
                  <span style={{ color: '#389e0d', fontWeight: 600 }}>
                    <ArrowDownOutlined /> {c.sl_pct}%
                  </span>
                </div>
                <div>
                  <span style={{ color: '#999', fontSize: 10 }}>最大持有</span>
                  <br />
                  <span style={{ fontWeight: 500 }}>{c.max_hold_days} 天</span>
                </div>
                <div>
                  <span style={{ color: '#999', fontSize: 10 }}>成熟度</span>
                  <br />
                  <span
                    style={{
                      fontWeight: 600,
                      color: (c.max_240_pct || 0) > 50 ? '#cf1322' : '#999',
                    }}
                  >
                    {c.max_240_pct != null ? `${c.max_240_pct.toFixed(0)}%` : '暂无'}
                  </span>
                </div>
              </div>

              {/* 规则标签 */}
              <Tag
                color="blue"
                style={{ marginTop: 8, fontWeight: 500 }}
              >
                {c.alert_decision}
              </Tag>

              {/* 展开详情 */}
              {open && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid #f0f0f0',
                    fontSize: 12,
                    color: '#666',
                  }}
                >
                  <div style={{ marginBottom: 6 }}>{c.trade_reason}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                    <span>入场日: {c.alert_date}</span>
                    <span>{REGIME_LABELS[c.market_regime]}</span>
                    {c.post_alert_decision && (
                      <span>
                        后市: {c.post_alert_decision.replace('后', '').substring(0, 20)}
                      </span>
                    )}
                    {c.max_240_pct != null && (
                      <span>
                        历史验证 avg: {c.max_240_pct.toFixed(0)}%
                        {c.min_240_pct != null ? ` / min: ${c.min_240_pct.toFixed(0)}%` : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TradeExecutionView;
