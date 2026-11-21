import type { MarketAnomalyItem } from './data_trends_semantics';

type Direction = -1 | 0 | 1 | null;
type RegimeEvidence = {
  background: Direction;
  swing: Direction;
  raw: Direction;
  pending: number;
  anomaly: 'new' | 'active' | 'cleared' | 'quiet' | 'unknown';
};

type Readout = {
  kind: 'screen' | 'slow' | 'pause' | 'observe' | 'exception';
  title: string;
  reason: string;
  next: string;
};

const observe = (title: string, reason: string, next: string): Readout => ({
  kind: 'observe', title: `观察 · ${title}`, reason, next,
});

// This is a display interpretation of same-date evidence. It has no execution consumer.
export function getMarketRegimeReadout(row?: RegimeEvidence, daily?: MarketAnomalyItem['state']): Readout {
  if (!row) return observe('数据待齐', '该日缺少本地全市场窗口读数。', '窗口数据更新后重新核对。');

  const { background, swing, raw, pending, anomaly } = row;
  if (anomaly === 'new' || anomaly === 'active') return {
    kind: 'exception', title: '异常观察 · 暂缓常规入场评估',
    reason: anomaly === 'new' ? '个股普跌新出现，当日先复核异常冲击。' : '个股普跌仍在持续，当日先复核异常冲击。',
    next: '等普跌解除，再检查波段方向及确认进度。',
  };
  if (anomaly === 'cleared') return {
    kind: 'exception', title: '异常观察 · 解除后复核',
    reason: '个股普跌刚解除，当前重点是确认修复能否持续。',
    next: '复核普跌是否再次触发，并等待波段方向确认。',
  };
  if (background === null || swing === null || anomaly === 'unknown' || !daily) {
    const missing = [background === null && '中期背景', swing === null && '波段', anomaly === 'unknown' && '普跌检测', !daily && '全市场当日状态'].filter(Boolean);
    return observe('数据待齐', `${missing.join('、')}缺少可用读数。`, '补齐所选交易日的读数后重新核对。');
  }
  if (raw !== null && raw !== swing && pending > 0) return observe('转换待确认',
    `波段出现新方向，连续确认进度为 ${pending}/3 日。`, '复核下一交易日的方向及连续确认进度。');
  if (daily === 'OVERLAP' || (daily === 'WEAK' && swing === 1) || (daily === 'HOT' && swing === -1)) {
    const reason = daily === 'OVERLAP' ? '当日同时出现偏热与偏弱，短期信号分化。'
      : daily === 'WEAK' ? '波段上行与全市场当日偏弱并存。' : '波段下行与全市场当日短期偏热并存。';
    return observe('信号分化', reason, '复核当日分化是否缓解，以及波段方向是否延续。');
  }
  if (background === 1 && swing === 1) return {
    kind: 'screen', title: '出手 · 可筛选候选',
    reason: daily === 'HOT' ? '中期与波段同向上行，当日另有短期偏热提示。' : '中期与波段同向上行，异常未触发。',
    next: '按现有候选条件筛选，并复核波段是否继续确认。',
  };
  if (background === -1 && swing === -1) return {
    kind: 'pause', title: '停手 · 暂停新增评估',
    reason: '中期背景与波段同时下行，弱势仍在延续。',
    next: '等波段出现确认的修复，再评估恢复筛选。',
  };
  if (background === 1 || swing === -1) return {
    kind: 'slow', title: '收手 · 暂缓加码',
    reason: background === 1
      ? `中期仍向上，波段已${swing === 0 ? '进入盘整' : '转为下行'}，当前以波段变化为主。`
      : '中期背景中性，波段已经下行，当前以波段走弱为主。',
    next: '观察波段重新上行的确认进度，再评估操作节奏。',
  };
  if (background === -1 && swing === 1) return observe('修复待验证',
    '波段已经上行，中期背景仍偏弱。', '继续观察修复的持续性及中期背景是否改善。');
  if (swing === 1) return observe('转强待跟踪',
    '中期背景中性，波段已经上行。', '跟踪波段持续性和中期背景是否同向。');
  return observe('盘整等待', background === -1 ? '中期仍偏弱，波段进入盘整。' : '中期与波段方向均为中性。',
    '等波段给出清晰方向并完成确认。');
}
