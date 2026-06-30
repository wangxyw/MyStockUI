import React, { useState, useCallback, useEffect } from 'react';
import { Button, DatePicker, Select, Space, Card, Row, Col, Spin, message, Statistic, Divider, Tag } from 'antd';
import { FireOutlined, LineChartOutlined, ReloadOutlined, RobotOutlined } from '@ant-design/icons';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';

interface TrendData {
  datestr: string;
  count: number;
}

interface AllTrendsData {
  '400s_up': TrendData[];
  '400s_down': TrendData[];
  '100w_up': TrendData[];
  '100w_down': TrendData[];
}

interface AiFocusData {
  datestr: string;
  symbol_count: number;
}

interface HotAlphaSectorItem {
  datestr?: string;
  daily_rank?: number;
  sector_type: string;
  sector_code: string;
  sector_name: string;
  emerging_score: number;
  hot_score: number;
  sector_rank: number;
  alert20: number;
  alert60: number;
  feature_hits?: number;
  ha_hits?: number;
  primary_ha_hits?: number;
}

interface HotAlphaStageItem {
  stage_key: string;
  start_date: string | null;
  end_date: string | null;
  sectors: Array<{
    sector_type: string;
    sector_code: string;
    sector_name: string;
    peak_emerging_score: number;
    avg_emerging_score: number;
    peak_hot_score: number;
    best_rank: number;
    avg_rank: number;
    max_alert20: number;
    active_days: number;
  }>;
}

interface HotAlphaSectorTrendData {
  latestDate: string | null;
  startDate?: string | null;
  mode?: string;
  latest: HotAlphaSectorItem[];
  trends: HotAlphaSectorItem[];
  stages?: HotAlphaStageItem[];
}

interface MTempItem {
  datestr: string;
  vol10_med: number;
  temp_label: string;
  alarm_dir: string;
  alarm_count: number;
  window_signal?: string;
  window_title?: string;
  window_desc?: string;
  trail_days?: number;
  trail_signal_n?: number;
  trail_negative_pct?: number;
  trail_low_pos_pct?: number;
  trail_hot_expand_pct?: number;
  trail_m_expand_pct?: number;
  trail_avg_me_hotish60?: number | null;
}

const SimpleAlarmTrend: React.FC = () => {
  const [days, setDays] = useState<number>(120);
  const [daysTill, setDaysTill] = useState<string>(moment().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState<boolean>(false);
  const [trendData, setTrendData] = useState<AllTrendsData | null>(null);
  
  // AI Focus Stocks 数据状态
  const [aiFocusData, setAiFocusData] = useState<AiFocusData[]>([]);
  const [aiFocusLoading, setAiFocusLoading] = useState<boolean>(false);

  // Hot Alpha 热点板块趋势
  const [hotAlphaData, setHotAlphaData] = useState<HotAlphaSectorTrendData | null>(null);
  const [hotAlphaLoading, setHotAlphaLoading] = useState<boolean>(false);
  const [hotAlphaStartMonth, setHotAlphaStartMonth] = useState<string>(moment().subtract(5, 'months').format('YYYY-MM'));
  const [hotAlphaEndMonth, setHotAlphaEndMonth] = useState<string>(moment().format('YYYY-MM'));
  const [hotAlphaTop, setHotAlphaTop] = useState<number>(5);
  const [hotAlphaMode, setHotAlphaMode] = useState<string>('stage');

  // M 市场温度数据
  const [mTempR1, setMTempR1] = useState<MTempItem[]>([]);
  const [mTempR2, setMTempR2] = useState<MTempItem[]>([]);
  const [mTempLoading, setMTempLoading] = useState<boolean>(false);

  // 天数选项
  const daysOptions = [
    { value: 30, label: '30天' },
    { value: 60, label: '60天' },
    { value: 90, label: '90天' },
    { value: 120, label: '120天' },
    { value: 150, label: '150天' },
    { value: 180, label: '180天' },
    { value: 360, label: '360天' }
  ];

  const hotAlphaTopOptions = [
    { value: 3, label: 'Top3' },
    { value: 5, label: 'Top5' },
    { value: 8, label: 'Top8' },
    { value: 10, label: 'Top10' },
  ];

  const hotAlphaModeOptions = [
    { value: 'stage', label: '阶段热点' },
    { value: 'daily_top3', label: '每日Top3' },
    { value: 'watchlist', label: '产业主线' },
    { value: 'peak', label: '区间峰值' },
    { value: 'latest', label: '结束日Top' },
  ];

  const shiftHotAlphaWindow = (months: number) => {
    setHotAlphaStartMonth(moment(hotAlphaStartMonth, 'YYYY-MM').add(months, 'months').format('YYYY-MM'));
    setHotAlphaEndMonth(moment(hotAlphaEndMonth, 'YYYY-MM').add(months, 'months').format('YYYY-MM'));
  };

  const setHotAlphaWindowEnd = (month: moment.Moment | null) => {
    const end = month || moment();
    setHotAlphaEndMonth(end.format('YYYY-MM'));
    setHotAlphaStartMonth(end.clone().subtract(5, 'months').format('YYYY-MM'));
  };

  // 获取趋势数据
  const fetchTrendData = useCallback(async () => {
    if (!days || !daysTill) {
      message.warning('请填写完整参数');
      return;
    }

    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        days: days.toString(),
        daysTill: daysTill
      }).toString();
      
      const url = `/api/alarm_trends?${queryParams}`;
      console.log('Fetching data from:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Received data:', data);
      
      if (response.ok && data) {
        setTrendData(data);
        message.success('数据加载成功');
      } else {
        message.error(data?.error || '数据加载失败');
      }
    } catch (error) {
      console.error('Failed to fetch trend data:', error);
      message.error('数据加载失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [days, daysTill]);

  // 获取 M 市场温度数据
  const fetchMTempData = useCallback(async () => {
    setMTempLoading(true);
    try {
      const [r1Res, r2Res] = await Promise.all([
        fetch('/api/m_trend?record_type=record1'),
        fetch('/api/m_trend?record_type=record2'),
      ]);
      const r1Data = await r1Res.json();
      const r2Data = await r2Res.json();
      console.log('M Temp R1:', r1Data?.length, 'rows, R2:', r2Data?.length, 'rows');
      if (r1Res.ok && Array.isArray(r1Data)) setMTempR1(r1Data);
      if (r2Res.ok && Array.isArray(r2Data)) setMTempR2(r2Data);
    } catch (error) {
      console.error('Failed to fetch M temp data:', error);
    } finally {
      setMTempLoading(false);
    }
  }, []);

  // 获取 AI Focus Stocks 数据（独立，不需要参数）
  const fetchAiFocusData = useCallback(async () => {
    setAiFocusLoading(true);
    try {
      const response = await fetch('/api/ai_focus_stocks_trend');
      const data = await response.json();
      
      console.log('AI Focus data:', data);
      
      if (response.ok && data) {
        setAiFocusData(data);
      } else {
        console.error('AI Focus data fetch failed:', data);
      }
    } catch (error) {
      console.error('Failed to fetch AI Focus data:', error);
    } finally {
      setAiFocusLoading(false);
    }
  }, []);

  const fetchHotAlphaSectorData = useCallback(async () => {
    if (!hotAlphaStartMonth || !hotAlphaEndMonth) {
      message.warning('请选择 Hot Alpha 起止月份');
      return;
    }
    setHotAlphaLoading(true);
    try {
      const startDate = moment(hotAlphaStartMonth, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
      const endDate = moment(hotAlphaEndMonth, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');
      const queryParams = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        top: hotAlphaTop.toString(),
        mode: hotAlphaMode,
      }).toString();
      const response = await fetch(`/api/hot_alpha_sector_trend?${queryParams}`);
      const data = await response.json();
      if (response.ok && data) {
        setHotAlphaData(data);
      } else {
        console.error('Hot Alpha sector trend fetch failed:', data);
      }
    } catch (error) {
      console.error('Failed to fetch Hot Alpha sector trend:', error);
    } finally {
      setHotAlphaLoading(false);
    }
  }, [hotAlphaStartMonth, hotAlphaEndMonth, hotAlphaTop, hotAlphaMode]);

  // 初始加载
  useEffect(() => {
    fetchTrendData();
    fetchAiFocusData();
    fetchMTempData();
    fetchHotAlphaSectorData();
  }, []);

  const refreshMainTrends = () => {
    fetchTrendData();
    fetchHotAlphaSectorData();
  };

  const getMTempChartOption = (data: MTempItem[], title: string) => {
    if (!data || data.length === 0) return null;
    const dates = data.map(d => d.datestr);
    const counts = data.map(d => d.alarm_count);
    const values = data.map(d => d.vol10_med);
    const dataCount = dates.length;
    const tc: Record<string, string> = { '热':'#e74c3c','热偏弱':'#ee8a7d','温':'#f39c12','冷偏暖':'#3498db','极冷':'#95a5a6' };
    const ranges = getMWindowRanges(data);

    // 构建合并后的 markArea data
    const allMarkData: any[] = [];
    if (ranges.attack.length) ranges.attack.forEach((r: any) => {
      allMarkData.push([{ xAxis: r[0].xAxis, itemStyle: { color: 'rgba(255,77,79,0.09)' } }, { xAxis: r[1].xAxis, itemStyle: { color: 'rgba(255,77,79,0.09)' } }]);
    });
    if (ranges.cautious.length) ranges.cautious.forEach((r: any) => {
      allMarkData.push([{ xAxis: r[0].xAxis, itemStyle: { color: 'rgba(22,119,255,0.07)' } }, { xAxis: r[1].xAxis, itemStyle: { color: 'rgba(22,119,255,0.07)' } }]);
    });
    if (ranges.diverge.length) ranges.diverge.forEach((r: any) => {
      allMarkData.push([{ xAxis: r[0].xAxis, itemStyle: { color: 'rgba(212,107,8,0.08)' } }, { xAxis: r[1].xAxis, itemStyle: { color: 'rgba(212,107,8,0.08)' } }]);
    });
    if (ranges.defend.length) ranges.defend.forEach((r: any) => {
      allMarkData.push([{ xAxis: r[0].xAxis, itemStyle: { color: 'rgba(140,140,140,0.05)' } }, { xAxis: r[1].xAxis, itemStyle: { color: 'rgba(140,140,140,0.05)' } }]);
    });
    const hasMarkData = allMarkData.length > 0;

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const i = params[0]?.dataIndex ?? 0;
          const d = data[i]; if (!d) return '';
          const c = tc[d.temp_label]||'#666';
          const windowStatus = getMWindowStatus(d);
          const detectorStatus = getWindowDetectorStatus(d);
          return `<b>${d.datestr}</b><br/>vol10_med: <b>${d.vol10_med?.toFixed(1)}</b><br/><span style="color:${c}">●</span> ${d.temp_label} ${d.alarm_dir}<br/>报警: ${d.alarm_count}条<br/>市场窗口: <b style="color:${windowStatus.color}">${windowStatus.title}</b><br/>策略窗口: <b style="color:${detectorStatus.color}">${detectorStatus.title}</b><br/><span style="color:#666">${detectorStatus.desc}</span><br/><span style="color:#999">近${d.trail_days || 20}天样本 ${d.trail_signal_n ?? '-'} ｜ 低位 ${fmtPct(d.trail_low_pos_pct)} ｜ 负面 ${fmtPct(d.trail_negative_pct)} ｜ 报扩 ${fmtPct(d.trail_m_expand_pct)}</span>`;
        }
      },
      grid: { top: 28, bottom: dataCount>50?35:10, left: 52, right: 15 },
      xAxis: { type:'category', data:dates, axisLabel:{rotate:45,fontSize:10,color:'#aaa',interval:Math.floor(dataCount/15)}, axisTick:{show:false}, axisLine:{lineStyle:{color:'#e8e8e8'}} },
      yAxis: [
        { type:'value', name:'vol10_med', nameTextStyle:{fontSize:10,color:'#aaa'}, min:0, max:80, axisTick:{show:false}, axisLine:{show:false}, splitLine:{lineStyle:{type:'dashed',color:'#f0f0f0'}} },
        { type:'value', name:'报警', nameTextStyle:{fontSize:10,color:'#aaa'}, axisTick:{show:false}, axisLine:{show:false}, splitLine:{show:false} }
      ],
      series: [
        { name:'报警数', type:'bar', yAxisIndex:1, data:counts, itemStyle:{color:(params: any) => isMAttackWindow(data[params.dataIndex]) ? 'rgba(255,77,79,0.38)' : 'rgba(24,144,255,0.25)', borderRadius:[3,3,0,0]}, barWidth:'80%', barGap:'0%', z:1, emphasis:{itemStyle:{color:'rgba(24,144,255,0.45)'}} },
        { name:'vol10_med', type:'line', yAxisIndex:0, data:values,
          lineStyle:{color:'#9b59b6',width:1.5}, itemStyle:{color:'#e74c3c'},
          symbol:'circle', symbolSize: dataCount>100?3:5, smooth:false,
          areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(231,76,60,0.10)'},{offset:1,color:'rgba(231,76,60,0)'}]}},
          markArea: hasMarkData ? {
            silent: true,
            data: allMarkData,
          } : undefined,
          markLine:{silent:true,symbol:'none',lineStyle:{type:'dashed',width:1},
            data:[
              {yAxis:35,label:{formatter:'热 35',position:'start',fontSize:12,color:'#e74c3c'},lineStyle:{color:'#e74c3c'}},
              {yAxis:25,label:{formatter:'温 25',position:'start',fontSize:12,color:'#f39c12'},lineStyle:{color:'#f39c12'}}
            ]
          }
        },
        { name:'策略窗口', type:'scatter', yAxisIndex:0,
          data: data.map(d => d.window_signal === 'BAD_GUARD' ? 78 : (d.window_signal === 'GOOD_ALLOW' ? 72 : null)),
          symbolSize: dataCount>100?6:8,
          itemStyle:{color:(params: any) => getWindowDetectorStatus(data[params.dataIndex]).color},
          tooltip:{show:false},
          z:5,
        }
      ],
      dataZoom: dataCount>50?[{type:'slider',start:0,end:100,bottom:0,height:20}]:[],
    };
  };

  const getMTempStats = (data: MTempItem[]) => {
    if (!data || data.length === 0) return { latest: 0, hotDays: 0, attackDays: 0, badDays: 0, goodDays: 0, latestLabel: '--', latestDir: '--' };
    const latest = data[data.length - 1];
    return {
      latest: latest.vol10_med,
      latestLabel: latest.temp_label,
      latestDir: latest.alarm_dir,
      hotDays: data.filter(d => d.temp_label === '热').length,
      attackDays: data.filter(isMAttackWindow).length,
      badDays: data.filter(d => d.window_signal === 'BAD_GUARD').length,
      goodDays: data.filter(d => d.window_signal === 'GOOD_ALLOW').length,
    };
  };
  const fmtPct = (value?: number | null) => value === null || value === undefined ? '-' : `${Number(value).toFixed(1)}%`;
  const isMAttackWindow = (item?: MTempItem) => item?.temp_label === '热' && item?.alarm_dir === '报扩';
  const isMCautiousWindow = (item?: MTempItem) => !!item?.temp_label?.startsWith('热') && item?.alarm_dir === '报缩';
  const isMDivergeWindow = (item?: MTempItem) => item?.temp_label !== '热' && !item?.temp_label?.startsWith('热') && item?.alarm_dir === '报扩';
  const isMDefendWindow = (item?: MTempItem) => {
    if (!item) return false;
    if (item.temp_label === '热' || item.temp_label?.startsWith('热')) return false;
    return item.alarm_dir === '报缩';
  };
  const getMWindowStatus = (item?: MTempItem) => {
    if (!item) return { title: '暂无数据', color: '#8c8c8c', bg: '#fafafa', border: '#d9d9d9', desc: '等待 M 市场温度数据加载。' };
    if (isMAttackWindow(item)) return { title: '允许进攻窗口', color: '#cf1322', bg: '#fff1f0', border: '#ffa39e', desc: 'M=热 且 报警扩散，历史样本中弹性和回撤表现最佳。' };
    if (item.temp_label?.startsWith('热') && item.alarm_dir === '报缩') return { title: '谨慎进攻窗口', color: '#1677ff', bg: '#e6f4ff', border: '#91caff', desc: '热度仍在，但报警扩散减弱，适合降低追高冲动。' };
    if (item.alarm_dir === '报扩') return { title: '分化扩散窗口', color: '#d46b08', bg: '#fff7e6', border: '#ffd591', desc: '报警在扩散，但 M 未到真正热区，需更依赖个股强确认。' };
    return { title: '观察防守窗口', color: '#595959', bg: '#fafafa', border: '#d9d9d9', desc: '未进入强进攻环境，适合观察或控制仓位。' };
  };
  const getWindowDetectorStatus = (item?: MTempItem) => {
    if (!item) return { title: '暂无窗口', color: '#8c8c8c', bg: '#fafafa', border: '#d9d9d9', desc: '等待窗口识别数据加载。' };
    if (item.window_signal === 'BAD_GUARD') return { title: item.window_title || '坏窗口暂缓', color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f', desc: item.window_desc || '低位拥挤或负面标签密集，策略执行应暂缓。' };
    if (item.window_signal === 'GOOD_ALLOW') return { title: item.window_title || '好窗口观察', color: '#cf1322', bg: '#fff1f0', border: '#ffa39e', desc: item.window_desc || '可作为策略族放行观察，不单独生成买入。' };
    return { title: item.window_title || '中性观察', color: '#595959', bg: '#fafafa', border: '#d9d9d9', desc: item.window_desc || '未触发明确窗口信号。' };
  };
  const getMWindowRanges = (data: MTempItem[]) => {
    const attack: any[] = [], cautious: any[] = [], diverge: any[] = [], defend: any[] = [];
    const build = (ranges: any[], checkFn: (item: MTempItem) => boolean) => {
      let start: string | null = null;
      data.forEach((item, index) => {
        if (checkFn(item) && !start) { start = item.datestr; }
        const isLast = index === data.length - 1;
        const nextIn = !isLast && checkFn(data[index + 1]);
        if (start && (isLast || !nextIn)) {
          ranges.push([{ xAxis: start }, { xAxis: item.datestr }]);
          start = null;
        }
      });
    };
    build(attack, isMAttackWindow);
    build(cautious, isMCautiousWindow);
    build(diverge, isMDivergeWindow);
    build(defend, isMDefendWindow);
    return { attack, cautious, diverge, defend };
  };
  const renderMMarketStatus = (label: string, data: MTempItem[], stats: ReturnType<typeof getMTempStats>) => {
    const latest = data[data.length - 1];
    const status = getMWindowStatus(latest);
    const detectorStatus = getWindowDetectorStatus(latest);
    const isBadWindow = latest?.window_signal === 'BAD_GUARD';
    return (
      <div style={{ flex: 1, minWidth: 280, border: `1px solid ${isBadWindow ? detectorStatus.border : status.border}`, background: isBadWindow ? detectorStatus.bg : status.bg, borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{ color: status.color, fontWeight: 700 }}>{status.title}</span>
            <span style={{ color: detectorStatus.color, fontWeight: 700 }}>{detectorStatus.title}</span>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#595959' }}>
          当前 {stats.latest.toFixed(1)} {stats.latestLabel} {stats.latestDir} ｜ 热 days: {stats.hotDays} ｜ 允许进攻 days: {stats.attackDays} ｜ 坏窗口 days: {stats.badDays}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>{detectorStatus.desc}</div>
      </div>
    );
  };
  const r1Stats = getMTempStats(mTempR1);
  const r2Stats = getMTempStats(mTempR2);
  const getAiFocusChartOption = (data: AiFocusData[], showValues: boolean = true) => {
    if (!data || data.length === 0) return null;
    
    // 按日期升序排列
    const sortedData = [...data].sort((a, b) => a.datestr.localeCompare(b.datestr));
    const dates = sortedData.map(item => item.datestr);
    const counts = sortedData.map(item => item.symbol_count);
    
    const dataCount = dates.length;
    const isLargeDataset = dataCount > 80;
    
    return {
      title: {
        text: 'AI Focus Stocks 趋势',
        left: 'center',
        top: 0,
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          return `<strong>${params[0].axisValue}</strong><br/>股票数量: ${params[0].value}`;
        }
      },
      legend: {
        data: ['AI Focus Stock Count'],
        top: 25,
        left: 'center'
      },
      grid: {
        top: 70,
        bottom: 30,
        left: 50,
        right: 50,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: isLargeDataset ? 45 : 0,
          interval: isLargeDataset ? Math.floor(dataCount / 15) : 0,
          fontSize: isLargeDataset ? 10 : 11
        }
      },
      yAxis: {
        type: 'value',
        name: '股票数量',
        nameLocation: 'middle',
        nameGap: 40
      },
      series: [
        {
          name: 'AI Focus Stock Count',
          type: 'line',
          data: counts,
          lineStyle: {
            color: '#1890ff',
            width: 2
          },
          itemStyle: {
            color: '#1890ff',
            borderRadius: 10
          },
          symbol: 'circle',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: dataCount <= 60,
          areaStyle: {
            opacity: 0.2,
            color: '#1890ff'
          },
          label: {
            show: showValues && !isLargeDataset,
            position: 'top',
            formatter: '{c}',
            fontSize: 10
          },
          connectNulls: true,
        },
      ],
      dataZoom: dataCount > 50 ? [
        {
          type: 'slider',
          start: 0,
          end: 100,
          bottom: 0,
          height: 20,
        },
        // 注释掉 inside 类型即可禁用鼠标滚轮
        // {
        //   type: 'inside',
        //   start: 0,
        //   end: 100,
        // }
      ] : [],
    };
  };

  const getHotAlphaSectorChartOption = (data?: HotAlphaSectorTrendData | null) => {
    const trends = data?.trends || [];
    const latest = data?.latest || [];
    if (trends.length === 0 || latest.length === 0) return null;

    const dates = Array.from(new Set(trends.map(item => item.datestr || '').filter(Boolean))).sort();
    if (data?.mode === 'daily_top3') {
      const rankMap = trends.reduce((acc, item) => {
        const rank = Number(item.daily_rank || 0);
        if (!rank) return acc;
        acc[`${item.datestr}|${rank}`] = item;
        return acc;
      }, {} as Record<string, HotAlphaSectorItem>);
      const primaryHitsByDate = dates.map(date => trends
        .filter(item => item.datestr === date)
        .reduce((sum, item) => sum + Number(item.primary_ha_hits || 0), 0)
      );
      const rankColors = ['#cf1322', '#1677ff', '#389e0d'];

      return {
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            const date = params?.[0]?.axisValue;
            const lines = [`<b>${date}</b>`];
            params.forEach((p: any) => {
              if (p.seriesName === 'HA主线报警数') {
                lines.push(`${p.marker} ${p.seriesName}: ${p.value ?? 0}`);
                return;
              }
              const rank = Number(String(p.seriesName).replace('Top', ''));
              const item = rankMap[`${date}|${rank}`];
              if (item) {
                lines.push(`${p.marker} ${p.seriesName}: ${item.sector_name} ｜ em ${Number(item.emerging_score).toFixed(1)} ｜ hot ${Number(item.hot_score).toFixed(1)} ｜ A20 ${item.alert20}`);
              }
            });
            return lines.join('<br/>');
          },
        },
        legend: { top: 8, data: ['HA主线报警数', 'Top1', 'Top2', 'Top3'] },
        grid: { top: 58, bottom: dates.length > 50 ? 42 : 18, left: 52, right: 56, containLabel: true },
        xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45, interval: dates.length > 80 ? Math.floor(dates.length / 15) : 0, fontSize: 10 } },
        yAxis: [
          { type: 'value', name: 'emerging', min: 0, axisLine: { show: false }, splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
          { type: 'value', name: 'HA报警', axisLine: { show: false }, splitLine: { show: false } },
        ],
        series: [
          {
            name: 'HA主线报警数',
            type: 'bar',
            yAxisIndex: 1,
            data: primaryHitsByDate,
            itemStyle: { color: 'rgba(250, 140, 22, 0.24)', borderRadius: [3, 3, 0, 0] },
            barWidth: '60%',
          },
          ...[1, 2, 3].map((rank, index) => ({
            name: `Top${rank}`,
            type: 'line',
            yAxisIndex: 0,
            data: dates.map(date => rankMap[`${date}|${rank}`]?.emerging_score ?? null),
            connectNulls: true,
            smooth: false,
            symbol: 'circle',
            symbolSize: dates.length > 90 ? 3 : 5,
            lineStyle: { width: 2, color: rankColors[index] },
            itemStyle: { color: rankColors[index] },
          })),
        ],
        dataZoom: dates.length > 50 ? [{ type: 'slider', start: 0, end: 100, bottom: 0, height: 20 }] : [],
      };
    }

    const sectorOrder = latest.map(item => `${item.sector_type}:${item.sector_code}`);
    const sectorLabels = latest.reduce((acc, item) => {
      acc[`${item.sector_type}:${item.sector_code}`] = item.sector_name || item.sector_code;
      return acc;
    }, {} as Record<string, string>);
    const trendMap = trends.reduce((acc, item) => {
      const key = `${item.sector_type}:${item.sector_code}`;
      acc[`${item.datestr}|${key}`] = item;
      return acc;
    }, {} as Record<string, HotAlphaSectorItem>);
    const primaryHitsByDate = dates.map(date => trends
      .filter(item => item.datestr === date)
      .reduce((sum, item) => sum + Number(item.primary_ha_hits || 0), 0)
    );
    const colors = ['#cf1322', '#1677ff', '#389e0d', '#d46b08', '#531dab', '#08979c', '#c41d7f', '#597ef7', '#7cb305', '#fa8c16'];

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const date = params?.[0]?.axisValue;
          const lines = [`<b>${date}</b>`];
          params.forEach((p: any) => {
            lines.push(`${p.marker} ${p.seriesName}: ${p.value ?? '-'}`);
          });
          return lines.join('<br/>');
        },
      },
      legend: { top: 8, type: 'scroll' },
      grid: { top: 58, bottom: dates.length > 50 ? 42 : 18, left: 52, right: 56, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45, interval: dates.length > 80 ? Math.floor(dates.length / 15) : 0, fontSize: 10 } },
      yAxis: [
        { type: 'value', name: 'emerging', min: 0, axisLine: { show: false }, splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
        { type: 'value', name: 'HA报警', axisLine: { show: false }, splitLine: { show: false } },
      ],
      series: [
        {
          name: 'HA主线报警数',
          type: 'bar',
          yAxisIndex: 1,
          data: primaryHitsByDate,
          itemStyle: { color: 'rgba(250, 140, 22, 0.28)', borderRadius: [3, 3, 0, 0] },
          barWidth: '60%',
        },
        ...sectorOrder.map((key, index) => ({
          name: sectorLabels[key] || key,
          type: 'line',
          yAxisIndex: 0,
          data: dates.map(date => trendMap[`${date}|${key}`]?.emerging_score ?? null),
          connectNulls: true,
          smooth: false,
          symbol: 'circle',
          symbolSize: dates.length > 90 ? 3 : 5,
          lineStyle: { width: index < 5 ? 2 : 1.2, color: colors[index % colors.length] },
          itemStyle: { color: colors[index % colors.length] },
        })),
      ],
      dataZoom: dates.length > 50 ? [{ type: 'slider', start: 0, end: 100, bottom: 0, height: 20 }] : [],
    };
  };

  const renderHotAlphaStages = (stages?: HotAlphaStageItem[]) => {
    if (!stages || stages.length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
        {stages.map((stage) => (
          <div key={stage.stage_key} style={{ flex: '0 0 285px', border: '1px solid #e5e5e5', borderRadius: 8, padding: '10px 12px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: '#262626' }}>{stage.stage_key}</span>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>{stage.start_date} 至 {stage.end_date}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stage.sectors.slice(0, hotAlphaTop).map((sector, index) => (
                <div key={`${stage.stage_key}-${sector.sector_type}-${sector.sector_code}`} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '6px 8px', background: index < 3 ? '#fff7f0' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Tag color={index < 3 ? 'volcano' : 'blue'} style={{ marginRight: 0 }}>#{index + 1}</Tag>
                    <span style={{ fontWeight: 700, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sector.sector_name}</span>
                  </div>
                  <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 12, whiteSpace: 'nowrap' }}>
                    峰rank {sector.best_rank} ｜ em {Number(sector.peak_emerging_score).toFixed(1)} ｜ {sector.active_days}天
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };
  // 生成图表配置
  const getChartOption = (upData: TrendData[], downData: TrendData[], title: string, colorUp: string, colorDown: string) => {
    const dates = upData?.map(item => item.datestr) || [];
    const upCounts = upData?.map(item => item.count) || [];
    const downCounts = downData?.map(item => item.count) || [];
    const diffCounts = dates.map((date, index) => {
      const upCount = upCounts[index] || 0;
      const downCount = downCounts[index] || 0;
      return upCount - downCount;
    });

    const dataCount = dates.length;
    const isLargeDataset = dataCount > 80;

    return {
      title: {
        text: title,
        left: 'center',
        top: 0,
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params: any) {
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => {
            result += `${p.marker} ${p.seriesName}: ${p.value}<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: ['上涨数量', '下跌数量', '净差值（涨-跌）'],
        top: 25,
        left: 'center'
      },
      grid: {
        top: 70,
        bottom: 30,
        left: 50,
        right: 50,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: 45,
          interval: isLargeDataset ? Math.floor(dataCount / 15) : 0,
          fontSize: isLargeDataset ? 10 : 11
        }
      },
      yAxis: {
        type: 'value',
        name: '数量 / 差值',
        nameLocation: 'middle',
        nameGap: 40
      },
      series: [
        {
          name: '上涨数量',
          type: 'line',
          data: upCounts,
          lineStyle: {
            color: colorUp,
            width: 2
          },
          itemStyle: {
            color: colorUp,
            borderRadius: 10
          },
          symbol: 'circle',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: dataCount <= 60,
          areaStyle: {
            opacity: 0.1,
            color: colorUp
          },
          label: {
            show: !isLargeDataset && upCounts.length <= 30,
            position: 'top',
            formatter: '{c}',
            fontSize: 10
          }
        },
        {
          name: '下跌数量',
          type: 'line',
          data: downCounts,
          lineStyle: {
            color: colorDown,
            width: 2
          },
          itemStyle: {
            color: colorDown,
            borderRadius: 10
          },
          symbol: 'diamond',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: dataCount <= 60,
          areaStyle: {
            opacity: 0.1,
            color: colorDown
          },
          label: {
            show: !isLargeDataset && downCounts.length <= 30,
            position: 'bottom',
            formatter: '{c}',
            fontSize: 10
          }
        },
        {
          name: '净差值（涨-跌）',
          type: 'line',
          data: diffCounts,
          lineStyle: {
            color: '#faad14',
            width: 2,
            type: 'dashed'
          },
          itemStyle: {
            color: '#faad14'
          },
          symbol: 'triangle',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: dataCount <= 60,
          label: {
            show: !isLargeDataset && diffCounts.length <= 30,
            position: 'right',
            formatter: '{c}',
            fontSize: 10
          }
        }
      ],
      dataZoom: dataCount > 50 ? [
        {
          type: 'slider',
          start: 0,
          end: 100,
          bottom: 0,
          height: 20,
        },
        // 注释掉 inside 类型即可禁用鼠标滚轮
        // {
        //   type: 'inside',
        //   start: 0,
        //   end: 100,
        // }
      ] : [],
    };
  };

  // 计算统计数据
  const getStatistics = (data: TrendData[]) => {
    if (!data || data.length === 0) return { avg: 0, max: 0, total: 0 };
    const counts = data.map(item => item.count);
    return {
      avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      max: Math.max(...counts),
      total: counts.reduce((a, b) => a + b, 0)
    };
  };

  // 计算 AI Focus 统计数据
  const getAiFocusStatistics = () => {
    if (!aiFocusData || aiFocusData.length === 0) return { avg: 0, max: 0, total: 0, latest: 0 };
    const counts = aiFocusData.map(item => item.symbol_count);
    return {
      avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      max: Math.max(...counts),
      total: counts.reduce((a, b) => a + b, 0),
      latest: counts[counts.length - 1] || 0
    };
  };

  const aiFocusStats = getAiFocusStatistics();

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Card 
        title="股票预警趋势分析" 
        bordered={false}
        extra={
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={refreshMainTrends}
            loading={loading || hotAlphaLoading}
          >
            刷新数据
          </Button>
        }
      >
        <Space size="large" wrap>
          <div>
            <span style={{ marginRight: 8 }}>统计天数：</span>
            <Select
              style={{ width: 120 }}
              value={days}
              onChange={(value) => setDays(value)}
              options={daysOptions}
              size="middle"
            />
            <span style={{ marginLeft: 8, color: '#999' }}>天</span>
          </div>
          
          <div>
            <span style={{ marginRight: 8 }}>截止日期：</span>
            <DatePicker
              value={moment(daysTill)}
              onChange={(date) => setDaysTill(date?.format('YYYY-MM-DD') || moment().format('YYYY-MM-DD'))}
              format="YYYY-MM-DD"
              style={{ width: 150 }}
            />
          </div>
          
          <Button 
            type="primary" 
            icon={<LineChartOutlined />}
            onClick={refreshMainTrends}
            loading={loading || hotAlphaLoading}
          >
            开始分析
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading || aiFocusLoading || hotAlphaLoading} tip="正在加载数据...">
        {/* M 市场温度趋势 */}
        <Card
          title={<span>🌡 M 市场温度趋势</span>}
          size="small"
          style={{ marginTop: 20 }}
          extra={
            <Space>
              <Button size="small" icon={<ReloadOutlined />} onClick={fetchMTempData} loading={mTempLoading}>刷新温度</Button>
            </Space>
          }
        >
          <div style={{ marginBottom: 16 }}>
            {(mTempR1.length > 0 || mTempR2.length > 0) && (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  {mTempR1.length > 0 && renderMMarketStatus('中小盘 Record1', mTempR1, r1Stats)}
                  {mTempR2.length > 0 && renderMMarketStatus('中大盘 Record2', mTempR2, r2Stats)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: '#595959' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#fff1f0', color: '#cf1322', border: '1px solid #ffa39e' }}>热 + 报扩：允许进攻</span>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#e6f4ff', color: '#1677ff', border: '1px solid #91caff' }}>热 + 报缩：谨慎进攻</span>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591' }}>非热 + 报扩：分化扩散</span>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#fafafa', color: '#595959', border: '1px solid #d9d9d9' }}>非热 + 报缩：观察防守</span>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f' }}>坏窗口：策略暂缓</span>
                  <span style={{ padding: '3px 8px', borderRadius: 12, background: '#fff1f0', color: '#cf1322', border: '1px solid #ffa39e' }}>好窗口：放行观察</span>
                </div>
              </>
            )}
            {mTempR1.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 6, fontSize: 13, color: '#595959', fontWeight: 600 }}>
                  中小盘(Record1) M 趋势：红色背景为“允许进攻窗口”
                </div>
                <ReactEcharts option={getMTempChartOption(mTempR1, '')} style={{ height: 280, width: '100%' }} opts={{ renderer: 'canvas' }} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: '#ccc' }}>
                {mTempLoading ? '加载中...' : '暂无 Record1 温度数据'}
              </div>
            )}
            {mTempR2.length > 0 ? (
              <div>
                <div style={{ marginBottom: 6, fontSize: 13, color: '#595959', fontWeight: 600 }}>
                  中大盘(Record2) M 趋势：红色背景为“允许进攻窗口”
                </div>
                <ReactEcharts option={getMTempChartOption(mTempR2, '')} style={{ height: 280, width: '100%' }} opts={{ renderer: 'canvas' }} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: '#ccc' }}>
                {mTempLoading ? '加载中...' : '暂无 Record2 温度数据'}
              </div>
            )}
          </div>
        </Card>

        <Divider />

        {/* Hot Alpha 热点板块趋势 */}
        <Card
          title={<span><FireOutlined style={{ marginRight: 8, color: '#fa541c' }} />Hot Alpha 热点板块趋势</span>}
          size="small"
          style={{ marginTop: 20 }}
          extra={<Button size="small" icon={<ReloadOutlined />} onClick={fetchHotAlphaSectorData} loading={hotAlphaLoading}>刷新热点</Button>}
        >
          <Space size="middle" wrap style={{ marginBottom: 12 }}>
            <div>
              <span style={{ marginRight: 8 }}>6个月窗口：</span>
              <Button size="small" onClick={() => shiftHotAlphaWindow(-1)}>前移</Button>
              <span style={{ margin: '0 8px', color: '#595959' }}>{hotAlphaStartMonth} 至 {hotAlphaEndMonth}</span>
              <Button size="small" onClick={() => shiftHotAlphaWindow(1)}>后移</Button>
            </div>
            <div>
              <span style={{ marginRight: 8 }}>结束月份：</span>
              <DatePicker
                picker="month"
                value={moment(hotAlphaEndMonth, 'YYYY-MM')}
                onChange={setHotAlphaWindowEnd}
                format="YYYY-MM"
                style={{ width: 120 }}
              />
            </div>
            <div>
              <span style={{ marginRight: 8 }}>展示：</span>
              <Select
                style={{ width: 100 }}
                value={hotAlphaTop}
                onChange={(value) => setHotAlphaTop(value)}
                options={hotAlphaTopOptions}
                size="middle"
              />
            </div>
            <div>
              <span style={{ marginRight: 8 }}>模式：</span>
              <Select
                style={{ width: 120 }}
                value={hotAlphaMode}
                onChange={(value) => setHotAlphaMode(value)}
                options={hotAlphaModeOptions}
                size="middle"
              />
            </div>
            <Button size="small" type="primary" icon={<LineChartOutlined />} onClick={fetchHotAlphaSectorData} loading={hotAlphaLoading}>查看区间</Button>
            {hotAlphaData?.latestDate && (
              <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                {hotAlphaModeOptions.find((item) => item.value === (hotAlphaData.mode || hotAlphaMode))?.label || '阶段热点'} ｜ 当前截面 {hotAlphaData.latestDate} ｜ 区间 {hotAlphaStartMonth} 至 {hotAlphaEndMonth}
              </span>
            )}
          </Space>
          {hotAlphaData && (hotAlphaData.latest.length > 0 || (hotAlphaData.stages || []).length > 0) ? (
            <>
              {hotAlphaData.mode === 'stage' ? renderHotAlphaStages(hotAlphaData.stages) : (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {hotAlphaData.latest.slice(0, hotAlphaTop).map((item, index) => (
                      <Tag key={`${item.sector_type}-${item.sector_code}`} color={index < 3 ? 'volcano' : 'blue'} style={{ marginRight: 0, padding: '3px 8px' }}>
                        #{item.sector_rank} {item.sector_name} ｜ em {Number(item.emerging_score).toFixed(1)} ｜ hot {Number(item.hot_score).toFixed(1)} ｜ A20 {item.alert20}
                      </Tag>
                    ))}
                  </div>
                  <ReactEcharts
                    option={getHotAlphaSectorChartOption(hotAlphaData)}
                    style={{ height: 360, width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                  />
                </>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
              {hotAlphaLoading ? '加载中...' : '暂无 Hot Alpha 热点板块数据'}
            </div>
          )}
        </Card>

        <Divider />

        {/* AI Focus Stocks 趋势图 */}
        {aiFocusData && aiFocusData.length > 0 && (
          <Card 
            title={
              <span>
                <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                AI Focus Stocks 趋势
              </span>
            }
            style={{ marginTop: 20 }}
            extra={
              <Space>
                <Statistic 
                  title="最新数量" 
                  value={aiFocusStats.latest} 
                  suffix="只"
                  valueStyle={{ color: '#1890ff', fontSize: 14 }}
                />
                <Statistic 
                  title="平均数量" 
                  value={aiFocusStats.avg} 
                  suffix="只"
                  valueStyle={{ fontSize: 14 }}
                />
                <Statistic 
                  title="最大数量" 
                  value={aiFocusStats.max} 
                  suffix="只"
                  valueStyle={{ color: '#52c41a', fontSize: 14 }}
                />
              </Space>
            }
          >
            <ReactEcharts
              option={getAiFocusChartOption(aiFocusData, true)}
              style={{ height: 400 }}
              opts={{ renderer: 'canvas' }}
            />
          </Card>
        )}

        {(!aiFocusData || aiFocusData.length === 0) && !aiFocusLoading && (
          <Card style={{ marginTop: 20, textAlign: 'center', padding: 30 }}>
            <RobotOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <div style={{ marginTop: 16, color: '#999' }}>
              暂无 AI Focus Stocks 数据
            </div>
          </Card>
        )}

        <Divider />

        {/* 原有的趋势图 */}
        {trendData && (
          <>
            {/* 400s 趋势图 */}
            <Card 
              title="400s 股票趋势" 
              style={{ marginTop: 20 }}
              extra={
                <Space>
                  <Statistic 
                    title="平均上涨" 
                    value={getStatistics(trendData['400s_up']).avg} 
                    suffix="只"
                    valueStyle={{ color: '#ff4d4f', fontSize: 14 }}
                  />
                  <Statistic 
                    title="平均下跌" 
                    value={getStatistics(trendData['400s_down']).avg} 
                    suffix="只"
                    valueStyle={{ color: '#52c41a', fontSize: 14 }}
                  />
                </Space>
              }
            >
              <ReactEcharts
                option={getChartOption(
                  trendData['400s_up'],
                  trendData['400s_down'],
                  '400s 涨跌趋势对比',
                  '#ff4d4f',
                  '#52c41a'
                )}
                style={{ height: 450 }}
                opts={{ renderer: 'canvas' }}
              />
            </Card>

            {/* 100w 趋势图 */}
            <Card 
              title="100w 股票趋势" 
              style={{ marginTop: 20 }}
              extra={
                <Space>
                  <Statistic 
                    title="平均上涨" 
                    value={getStatistics(trendData['100w_up']).avg} 
                    suffix="只"
                    valueStyle={{ color: '#ff4d4f', fontSize: 14 }}
                  />
                  <Statistic 
                    title="平均下跌" 
                    value={getStatistics(trendData['100w_down']).avg} 
                    suffix="只"
                    valueStyle={{ color: '#52c41a', fontSize: 14 }}
                  />
                </Space>
              }
            >
              <ReactEcharts
                option={getChartOption(
                  trendData['100w_up'],
                  trendData['100w_down'],
                  '100w 涨跌趋势对比',
                  '#ff4d4f',
                  '#52c41a'
                )}
                style={{ height: 450 }}
                opts={{ renderer: 'canvas' }}
              />
            </Card>

            {/* 对比分析卡片 */}
            <Row gutter={16} style={{ marginTop: 20 }}>
              <Col span={12}>
                <Card title="400s 市场情绪">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: trendData['400s_up'].reduce((a, b, idx) => 
                      a + (b.count - (trendData['400s_down'][idx]?.count || 0)), 0) >= 0 ? '#ff4d4f' : '#52c41a' 
                    }}>
                      {trendData['400s_up'].reduce((a, b, idx) => 
                        a + (b.count - (trendData['400s_down'][idx]?.count || 0)), 0) >= 0 ? '偏乐观' : '偏悲观'
                      }
                    </div>
                    <div style={{ marginTop: 10 }}>
                      总净差值: {trendData['400s_up'].reduce((a, b, idx) => 
                        a + (b.count - (trendData['400s_down'][idx]?.count || 0)), 0)
                      }
                    </div>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="100w 市场情绪">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: trendData['100w_up'].reduce((a, b, idx) => 
                      a + (b.count - (trendData['100w_down'][idx]?.count || 0)), 0) >= 0 ? '#ff4d4f' : '#52c41a' 
                    }}>
                      {trendData['100w_up'].reduce((a, b, idx) => 
                        a + (b.count - (trendData['100w_down'][idx]?.count || 0)), 0) >= 0 ? '偏乐观' : '偏悲观'
                      }
                    </div>
                    <div style={{ marginTop: 10 }}>
                      总净差值: {trendData['100w_up'].reduce((a, b, idx) => 
                        a + (b.count - (trendData['100w_down'][idx]?.count || 0)), 0)
                      }
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}

        {!trendData && !loading && !aiFocusData.length && (
          <Card style={{ marginTop: 20, textAlign: 'center', padding: 50 }}>
            <LineChartOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <div style={{ marginTop: 16, color: '#999' }}>
              请选择参数并点击"开始分析"查看趋势图
            </div>
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default SimpleAlarmTrend;
