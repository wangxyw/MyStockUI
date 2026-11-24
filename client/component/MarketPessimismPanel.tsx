import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, DatePicker, Empty, Row, Select, Space, Spin, Statistic, Tag } from 'antd';
import { LineChartOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';

type Group = 'ALL' | 'LARGE' | 'MID' | 'SMALL';
type Point = {
  score: number | null; raw: number | null; n: number; denominator: number; coverage: number | null;
  weak: number | null; depth: number | null; pressure: number | null;
  meanDrawdown: number | null; saturated: number | null;
};
type DailyPoint = { date: string; rebalance: boolean; groups: Record<Group, Point> };
type Payload = {
  version: string; size_version: string; data_through: string; first_available: string | null;
  generated_at: string; complete_before: string; rows: DailyPoint[];
};
const GROUPS: Group[] = ['ALL', 'LARGE', 'MID', 'SMALL'];
const LABELS: Record<Group, string> = { ALL: '全市场', LARGE: '大盘组', MID: '中盘组', SMALL: '小盘组' };
const COLORS: Record<Group, string> = { ALL: '#7a8592', LARGE: '#235789', MID: '#b47e22', SMALL: '#c84545' };
const format = (value: number | null | undefined, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

const MarketPessimismPanel: React.FC = () => {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('6m');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  const load = useCallback(async (refresh = false) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/market_pessimism_trend' + (refresh ? '?refresh=1' : ''), { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.rows) || !payload.data_through) {
        throw new Error(payload.error || '曲线数据格式异常');
      }
      if (activeRequest.current !== controller) return;
      setData(payload);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setData(null);
      setError((caught as Error).message || '曲线加载失败');
    } finally {
      if (activeRequest.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => activeRequest.current?.abort();
  }, [load]);

  const end = customRange?.[1] || data?.data_through || moment().subtract(1, 'day').format('YYYY-MM-DD');
  const start = customRange?.[0] || (period === 'all' ? data?.rows[0]?.date || '2024-01-02' :
    moment(end).subtract(period === '1y' ? 12 : 6, 'months').format('YYYY-MM-DD'));
  const rows = (data?.rows || []).filter(row => row.date >= start && row.date <= end);
  const latest = rows[rows.length - 1];
  const hasScores = rows.some(row => GROUPS.some(group => row.groups[group].score !== null));
  const series = GROUPS.map(group => ({
    name: LABELS[group], type: 'line', data: rows.map(row => row.groups[group].score),
    showSymbol: false, connectNulls: false, lineStyle: { width: group === 'ALL' ? 1.5 : 2, type: group === 'ALL' ? 'dashed' : 'solid' },
    itemStyle: { color: COLORS[group] }, emphasis: { focus: 'series' },
  }));
  const option: any = {
    animation: false,
    legend: { top: 8, data: GROUPS.map(group => LABELS[group]) },
    grid: { left: 55, right: 25, top: 48, bottom: 75 },
    xAxis: { type: 'category', boundaryGap: false, data: rows.map(row => row.date), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', min: 0, max: 100, name: '悲观值', splitLine: { lineStyle: { color: '#edf0f3' } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 12, height: 24 }],
    tooltip: {
      trigger: 'axis', confine: true,
      formatter: (items: any[]) => {
        const row = rows[items[0]?.dataIndex];
        if (!row) return '';
        return '<strong>' + row.date + '</strong>' + (row.rebalance ? ' · 月初分组更新' : '') + '<br/>' +
          GROUPS.map(group => {
            const point = row.groups[group];
            return '<span style="color:' + COLORS[group] + '">●</span> ' + LABELS[group] +
              ' <strong>' + format(point.score) + '</strong> · 原始 ' + format(point.raw) +
              '<br/><span style="color:#777">样本 ' + point.n + '/' + point.denominator +
              ' · 覆盖 ' + format(point.coverage === null ? null : point.coverage * 100) + '%' +
              ' · 平均回撤 ' + format(point.meanDrawdown) + '%' +
              ' · 截顶占比 ' + format(point.saturated) + '%</span>';
          }).join('<br/>');
      },
    },
    series: showRaw ? [
      ...series,
      ...GROUPS.map(group => ({
        name: LABELS[group], type: 'line', data: rows.map(row => row.groups[group].raw),
        showSymbol: false, connectNulls: false, silent: true,
        lineStyle: { width: 1, opacity: .25 }, itemStyle: { color: COLORS[group] },
      })),
    ] : series,
  };

  return (
    <Card
      title={<span><LineChartOutlined style={{ marginRight: 8, color: '#c84545' }} />市场悲观值 · 全市场与大中小盘</span>}
      size="small"
      style={{ marginTop: 20 }}
      extra={<Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => load(true)}>刷新曲线</Button>}
      data-testid="market-pessimism-panel"
    >
      <Space wrap size="middle" style={{ marginBottom: 12 }}>
        <Select aria-label="悲观曲线时间范围" value={period} style={{ width: 115 }} onChange={value => {
          setPeriod(value); setCustomRange(null);
        }} options={[{ value: '6m', label: '最近半年' }, { value: '1y', label: '最近一年' }, { value: 'all', label: '全部历史' }]} />
        <DatePicker.RangePicker
          aria-label="悲观曲线自定义日期"
          allowClear
          value={[moment(start), moment(end)]}
          onChange={range => setCustomRange(range?.[0] && range?.[1] ?
            [range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')] : null)}
        />
        <Checkbox checked={showRaw} onChange={event => setShowRaw(event.target.checked)}>叠加原始日值</Checkbox>
        {data && <span style={{ color: '#8c8c8c', fontSize: 13 }}>行情截止 {data.data_through} · 曲线始于 {data.first_available || '预热不足'}</span>}
      </Space>
      <div style={{ color: '#595959', fontSize: 13, marginBottom: 12 }}>
        数值越高表示价格压力越大。三项等权计算弱势范围、回撤深度和近五日下跌压力，实线采用5日EMA平滑。
        按上月末总市值分组，大盘前300只，中盘301—1000只，小盘其余，每月更新。
      </div>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Spin spinning={loading} tip="正在读取本地行情并计算曲线，首次加载可能需要一些时间">
        {data && (
          <>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 8 }}>所选区间末日 {latest?.date || '无行情'}</div>
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              {GROUPS.map(group => {
                const point = latest?.groups[group];
                return (
                  <Col xs={12} md={6} key={group}>
                    <div style={{ background: '#fafbfc', border: '1px solid #edf0f3', borderRadius: 6, padding: '12px 14px' }}>
                      <Statistic title={LABELS[group]} value={point?.score == null ? '—' : Number(point.score.toFixed(1))} precision={1} valueStyle={{ color: COLORS[group], fontSize: 25 }} />
                      <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                        样本 {point?.n ?? 0}/{point?.denominator ?? 0} · 覆盖 {format(point?.coverage == null ? null : point.coverage * 100)}%
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
            {hasScores ? (
              <ReactEcharts option={option} notMerge style={{ height: 370, width: '100%' }} opts={{ renderer: 'canvas' }} />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="所选区间缺少足够历史行情或样本覆盖，分值保持未知" />}
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>
              <Tag>本地行情重建</Tag><Tag>V1</Tag>
              收盘后纳入当日已落库行情，盘中截至上一交易日。月初换组会影响分值；20%回撤截顶，悬停可查看未截顶平均回撤和样本覆盖。曲线用于描述同期市场压力。
            </div>
          </>
        )}
        {!data && !error && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loading ? '正在计算曲线' : '暂无曲线数据'} />}
      </Spin>
    </Card>
  );
};
export default MarketPessimismPanel;
