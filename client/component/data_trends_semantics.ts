export interface TrendData {
  datestr: string;
  count: number;
}

export interface MTempItem {
  datestr: string;
  vol10_med: number | null;
  temp_label: string | null;
  alarm_dir: string | null;
  legacy_vol10_med?: number | null;
  m_vol_med?: number | null;
  m_vol_metric?: 'vol10' | 'vol20' | 'legacy_vol10';
  m_temp_label?: string | null;
  m_alarm_dir?: string | null;
  m_source?: 'comments_m' | 'legacy_fallback' | 'legacy_conflict' | 'no_alert_sample' | 'missing_data';
  alarm_count: number | null;
  window_signal?: string;
  window_title?: string;
  window_desc?: string;
  trail_data_complete?: boolean;
  trail_source_start_date?: string | null;
  trail_required_start_date?: string | null;
  trail_days?: number;
  trail_signal_n?: number;
  trail_negative_pct?: number;
  trail_low_pos_pct?: number;
  trail_hot_expand_pct?: number;
  trail_m_expand_pct?: number;
  trail_avg_me_hotish60?: number | null;
  short_days?: number;
  short_signal_n?: number;
  short_window_signal?: string;
  short_window_title?: string;
  short_window_desc?: string;
  short_data_complete?: boolean;
  short_required_start_date?: string | null;
  short_negative_pct?: number;
  short_low_pos_pct?: number;
  short_m_expand_pct?: number;
  window_detector_version?: string;
  window_interpretation_version?: string;
  window_snapshot_scope?: string;
  window_snapshot_captured_at?: string | null;
  window_snapshot_input_hash?: string | null;
  window_source_snapshot?: string;
  window_snapshot_frozen?: boolean;
  window_sequence?: string;
  window_interpretation_title?: string;
  window_evidence_level?: string;
  window_action_hint?: string;
  window_interpretation_desc?: string;
}

export interface MarketAnomalyItem {
  datestr: string;
  state: 'NORMAL' | 'WEAK' | 'HOT' | 'OVERLAP';
  weak: boolean;
  hot: boolean;
  evidence_scope: 'RECONSTRUCTED' | 'POINT_IN_TIME';
}

export interface MarketAnomalyResponse {
  model_version: string;
  data_through: string | null;
  timing: string;
  rows: MarketAnomalyItem[];
}

export const getSharedTrendDates = (...sources: Array<Array<{ datestr: string }>>) =>
  Array.from(new Set(sources.flatMap(rows => rows.map(row => row.datestr)))).sort();

export const alignMTrendRows = (data: MTempItem[], dates: string[]): MTempItem[] => {
  const byDate = new Map(data.map(row => [row.datestr, row]));
  return dates.map(datestr => byDate.get(datestr) || {
    datestr, vol10_med: null, temp_label: null, alarm_dir: null,
    m_vol_med: null, m_source: 'missing_data', alarm_count: null,
    trail_data_complete: false, short_data_complete: false,
    window_signal: 'DATA_INSUFFICIENT', short_window_signal: 'DATA_INSUFFICIENT',
  });
};

export const getMVolMed = (item?: MTempItem) => {
  if (item?.m_source === 'missing_data' || item?.m_source === 'no_alert_sample') return null;
  const value = item?.m_vol_med ?? item?.vol10_med;
  if (value === null || value === undefined) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};
export const getMVolMetric = (item?: MTempItem) => item?.m_vol_metric || 'legacy_vol10';
export const getMMetricLabel = (metric: string) => metric === 'legacy_vol10' ? 'vol10（历史回退）' : metric;
export const getMSampleState = (item?: MTempItem) => {
  if (!item || item.m_source === 'missing_data') return 'MISSING';
  if (item.m_source === 'no_alert_sample' || (item.alarm_count === 0 && getMVolMed(item) === null)) return 'NO_ALERTS';
  return getMVolMed(item) === null ? 'MISSING_M' : 'AVAILABLE';
};
export const getMUnavailableText = (item?: MTempItem) => {
  const state = getMSampleState(item);
  return state === 'NO_ALERTS' ? '当日无报警，M无定义' : state === 'MISSING_M' ? 'M数据缺失' : '数据缺失/待更新';
};

export const buildMMetricSegments = (data: MTempItem[]) => {
  const segments: Array<{ metric: string; startDate: string; values: Array<number | null> }> = [];
  let current: typeof segments[number] | undefined;
  data.forEach((row, index) => {
    if (getMSampleState(row) === 'MISSING') {
      current = undefined;
      return;
    }
    const metric = getMVolMetric(row);
    if (!current || current.metric !== metric) {
      current = { metric, startDate: row.datestr, values: Array(data.length).fill(null) };
      segments.push(current);
    }
    current.values[index] = getMVolMed(row);
  });
  return segments.filter(segment => segment.values.some(value => value !== null));
};

export const getMarketAnomalyStatus = (item?: MarketAnomalyItem) => {
  switch (item?.state) {
    case 'HOT': return { title: '短期偏热', background: '#cf1322' };
    case 'WEAK': return { title: '明显偏弱', background: '#389e0d' };
    case 'OVERLAP': return { title: '偏热与偏弱同时出现', background: 'linear-gradient(to bottom,#cf1322 0 50%,#389e0d 50% 100%)' };
    case 'NORMAL': return { title: '未触发偏热/偏弱', background: '#f0f0f0' };
    default: return { title: '数据缺失/待更新', background: 'repeating-linear-gradient(135deg,#bfbfbf 0 2px,#fafafa 2px 4px)' };
  }
};

export const getUDTrendSummary = (up: TrendData[], down: TrendData[]) => {
  const upByDate = new Map(up.map(row => [row.datestr, row.count]));
  const downByDate = new Map(down.map(row => [row.datestr, row.count]));
  const count = (value?: number) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const rows = getSharedTrendDates(up, down).map(datestr => {
    const upCount = count(upByDate.get(datestr)), downCount = count(downByDate.get(datestr));
    return { datestr, up: upCount, down: downCount, diff: upCount === null || downCount === null ? null : upCount - downCount };
  });
  return {
    rows, startDate: rows[0]?.datestr || null, endDate: rows[rows.length - 1]?.datestr || null,
    total: rows.length && rows.every(row => row.diff !== null) ? rows.reduce((sum, row) => sum + (row.diff as number), 0) : null,
    latest: rows[rows.length - 1] || null,
  };
};

export const fetchTrendSource = async <T>(url: string, valid: (data: any) => boolean, fetcher: typeof fetch = fetch): Promise<{ data: T | null; error: string | null }> => {
  try {
    const response = await fetcher(url);
    if (!response.ok) return { data: null, error: `接口不可用（HTTP ${response.status}）` };
    const data = await response.json();
    if (!valid(data)) return { data: null, error: '返回数据格式异常' };
    return { data: data as T, error: null };
  } catch {
    return { data: null, error: '网络或数据解析失败，请重试' };
  }
};
