import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import './alarm.css';
import DATE from './date.json';
import React from 'react';
import { isEmpty } from 'lodash';
import {
  Button,
  Input,
  Select,
  DatePicker,
  Spin,
  Space,
  message,
  Switch,
  Card,
  Statistic,
  Row,
  Col,
  Tooltip,
  Progress,
  Radio,
} from 'antd';
import moment from 'moment';
import { get } from '../lib/request';
import {
  caculateDate,
  today,
  validateCons,
  validateTotal,
  workdays,
} from './alarm';
import { groupBy } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import { caculatePriceData } from './myFocus';
import { getBeforeOneDate } from './new_alarm';

// 格式化日期标签 - 显示完整日期
const formatDateLabel = (date: string, index: number, total: number, density: 'high' | 'medium' | 'low') => {
  if (density === 'high') {
    return date.slice(5);
  } else if (density === 'medium') {
    if (index % 2 === 0 || index === total - 1) {
      return date.slice(5);
    }
    return '';
  } else {
    const interval = Math.max(1, Math.floor(total / 30));
    if (index % interval === 0 || index === total - 1) {
      return date.slice(5);
    }
    return '';
  }
};

// 图表配置函数
const dapanOptionWithBoth = (
  upData: any, 
  downData: any, 
  isSimpleMode: boolean = false,
  labelDensity: 'high' | 'medium' | 'low' = 'high',
  rotateAngle: number = 0,
  showValues: boolean = true,  // 新增：是否显示数值标签
) => {
  const dates = Object.keys(upData || {});
  
  if (dates.length === 0) return null;
  
  const upYData = dates?.map((i) => upData[i]?.length || 0);
  const downYData = dates?.map((i) => downData[i]?.length || 0);
  const diffYData = dates?.map((i) => (upData[i]?.length || 0) - (downData[i]?.length || 0));

  const dataCount = dates.length;
  const isLargeDataset = dataCount > 80;
  
  let labelInterval = 0;
  let intervalCalculation = 0;
  
  if (labelDensity === 'high') {
    labelInterval = 0;
    intervalCalculation = 1;
  } else if (labelDensity === 'medium') {
    labelInterval = 2;
    intervalCalculation = 2;
  } else {
    if (dataCount <= 60) {
      labelInterval = 2;
      intervalCalculation = 2;
    } else if (dataCount <= 100) {
      labelInterval = 3;
      intervalCalculation = 3;
    } else {
      labelInterval = 5;
      intervalCalculation = 5;
    }
  }
  
  const axisLabels = dates.map((date, idx) => {
    let shouldShow = false;
    
    if (labelDensity === 'high') {
      shouldShow = true;
    } else if (labelDensity === 'medium') {
      shouldShow = idx % 2 === 0 || idx === dates.length - 1;
    } else {
      shouldShow = idx % intervalCalculation === 0 || idx === dates.length - 1;
    }
    
    let label = '';
    if (shouldShow) {
      label = formatDateLabel(date, idx, dates.length, labelDensity);
    }
    
    const isWeekendOrHoliday = DATE.workday.indexOf(getBeforeOneDate(date, 1)) === -1;
    
    return {
      value: label,
      textStyle: { 
        color: isWeekendOrHoliday ? '#ff4d4f' : '#333',
        fontSize: isLargeDataset ? 10 : 11,
      }
    };
  });
  
  let finalRotateAngle = rotateAngle;
  let bottomMargin = '8%';
  
  if (labelDensity === 'high') {
    if (dataCount > 40) {
      finalRotateAngle = 45;
      bottomMargin = '12%';
    } else if (dataCount > 25) {
      finalRotateAngle = 30;
      bottomMargin = '10%';
    } else {
      finalRotateAngle = 0;
      bottomMargin = '8%';
    }
  } else if (labelDensity === 'medium') {
    if (dataCount > 60) {
      finalRotateAngle = 30;
      bottomMargin = '10%';
    } else {
      finalRotateAngle = 0;
      bottomMargin = '8%';
    }
  }
  
  // 判断是否显示数值标签
  const shouldShowLabels = showValues && !isLargeDataset && !isSimpleMode && dataCount <= 60;
  
  return {
    title: { text: '', left: 0 },
    legend: {
      data: ['Up Count', 'Down Count', 'Difference (Up - Down)'],
      top: 0,
      right: 0,
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!params || params.length === 0) return '';
        const fullDate = dates[params[0].dataIndex];
        let result = `<strong>${fullDate}</strong><br/>`;
        params.forEach((p: any) => {
          result += `${p.marker} ${p.seriesName}: ${p.value}<br/>`;
        });
        return result;
      },
    },
    grid: {
      containLabel: true,
      left: '3%',
      right: '4%',
      bottom: bottomMargin,
      top: '10%',
      backgroundColor: '#fafafa',
    },
    xAxis: {
      type: 'category',
      data: axisLabels,
      axisLabel: { 
        show: true,
        rotate: finalRotateAngle,
        fontSize: isLargeDataset ? 10 : 11,
        interval: 0,
        margin: 12,
        overflow: 'break',
        hideOverlap: labelDensity !== 'high',
      },
      axisLine: {
        lineStyle: { color: '#ccc' }
      },
      axisTick: {
        show: true,
        alignWithLabel: true,
        length: 3,
      },
    },
    yAxis: { 
      type: 'value', 
      name: '数量 / 差值',
      nameLocation: 'middle',
      nameGap: 45,
      splitLine: {
        lineStyle: { type: 'dashed', color: '#e0e0e0' }
      }
    },
    series: [
      {
        name: 'Up Count',
        type: 'line',
        data: upYData,
        itemStyle: { color: '#ff4d4f' },
        symbol: isSimpleMode ? 'none' : 'circle',
        symbolSize: isLargeDataset ? 3 : 5,
        label: { 
          show: shouldShowLabels,
          position: 'top', 
          fontSize: 10,
          fontWeight: 'bold',
          formatter: (params: any) => params.value > 0 ? params.value : '',
          offset: [0, 5],
        },
        smooth: !isSimpleMode && dataCount <= 60,
        step: isSimpleMode || dataCount > 80,
        lineStyle: { width: isLargeDataset ? 1.5 : 2 },
        connectNulls: true,
      },
      {
        name: 'Down Count',
        type: 'line',
        data: downYData,
        itemStyle: { color: '#52c41a' },
        symbol: isSimpleMode ? 'none' : 'diamond',
        symbolSize: isLargeDataset ? 3 : 5,
        label: { 
          show: shouldShowLabels,
          position: 'bottom', 
          fontSize: 10,
          fontWeight: 'bold',
          formatter: (params: any) => params.value > 0 ? params.value : '',
          offset: [0, -5],
        },
        smooth: !isSimpleMode && dataCount <= 60,
        step: isSimpleMode || dataCount > 80,
        lineStyle: { width: isLargeDataset ? 1.5 : 2 },
        connectNulls: true,
      },
      {
        name: 'Difference (Up - Down)',
        type: 'line',
        data: diffYData,
        itemStyle: { color: '#faad14' },
        lineStyle: { type: 'dashed', width: isLargeDataset ? 1 : 2 },
        symbol: isSimpleMode ? 'none' : 'triangle',
        symbolSize: isLargeDataset ? 3 : 5,
        label: { 
          show: shouldShowLabels,
          position: 'right', 
          fontSize: 10,
          fontWeight: 'bold',
          formatter: (params: any) => params.value !== 0 ? params.value : '',
          offset: [10, 0],
        },
        smooth: !isSimpleMode && dataCount <= 60,
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
      {
        type: 'inside',
        start: 0,
        end: 100,
      }
    ] : [],
  };
};

export const pullWorkDaysArray = (date, days) => {
  const endIndex = workdays.indexOf(caculateDate(date, 0));
  const startIndex = Math.max(0, endIndex - days + 1);
  return workdays.slice(startIndex, endIndex + 1);
};

// 分块计算函数
const calculateStockDataByDateChunked = async (
  res: any[],
  dateArr: string[],
  selectConsAllDays: string,
  selectConsTotal: string,
  selectConsDays: number,
  onProgress?: (progress: number, currentDate?: string) => void
): Promise<{ upDataByDate: any; downDataByDate: any }> => {
  const upDataByDate: any = {};
  const downDataByDate: any = {};
  
  const dataByDateRange = new Map<string, Map<string, any[]>>();
  
  for (const date of dateArr) {
    const startDate = caculateDate(date, parseInt(selectConsAllDays, 10));
    const filteredData = res.filter(e => e.datestr <= date && e.datestr > startDate);
    
    const groupedBySymbol = new Map<string, any[]>();
    for (const item of filteredData) {
      if (!groupedBySymbol.has(item.symbol)) {
        groupedBySymbol.set(item.symbol, []);
      }
      groupedBySymbol.get(item.symbol)!.push(item);
    }
    dataByDateRange.set(date, groupedBySymbol);
  }
  
  const chunkSize = 5;
  let processedCount = 0;
  
  for (let i = 0; i < dateArr.length; i += chunkSize) {
    const chunk = dateArr.slice(i, i + chunkSize);
    
    for (const date of chunk) {
      const groupedBySymbol = dataByDateRange.get(date);
      if (!groupedBySymbol) continue;
      
      const upStocks: any[] = [];
      const downStocks: any[] = [];
      
      for (const [symbol, items] of groupedBySymbol) {
        if (!items || items.length === 0) continue;
        const lastStock = items[items.length - 1];
        
        if (selectConsTotal === 'CONS') {
          const { isTrue: isUp } = validateCons(items, 'up', selectConsDays);
          const { isTrue: isDown } = validateCons(items, 'down', selectConsDays);
          if (isUp) upStocks.push(lastStock);
          if (isDown) downStocks.push(lastStock);
        } else {
          const { isTrue: isUp } = validateTotal(items, 'up', selectConsDays);
          const { isTrue: isDown } = validateTotal(items, 'down', selectConsDays);
          if (isUp) upStocks.push(lastStock);
          if (isDown) downStocks.push(lastStock);
        }
      }
      
      upDataByDate[date] = upStocks.map(s => ({ symbol: s.symbol, name: s.name, datestr: s.datestr }));
      downDataByDate[date] = downStocks.map(s => ({ symbol: s.symbol, name: s.name, datestr: s.datestr }));
      
      processedCount++;
      if (onProgress) {
        onProgress((processedCount / dateArr.length) * 100, date);
      }
    }
    
    if (i + chunkSize < dateArr.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return { upDataByDate, downDataByDate };
};

export const TotalDataComNew = (props) => {
  const { isDR } = props;
  const [selectDays, setSelectDays] = useState('60');
  const [selectConsAllDays, setSelectConsAllDays] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [from100, setFrom100] = useState('400s');
  const [selectConsDays, setSelectConsDays] = useState(5);
  const [selectConsTotal, setSelectConsTotal] = useState('CONS');
  const [simpleMode, setSimpleMode] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProcessingDate, setCurrentProcessingDate] = useState('');
  const [labelDensity, setLabelDensity] = useState<'high' | 'medium' | 'low'>('high');
  const [labelRotate, setLabelRotate] = useState(0);
  const [showDataZoom, setShowDataZoom] = useState(true);
  
  // 新增：是否显示数值标签
  const [showValues, setShowValues] = useState(true);
  
  // 开关：false（默认）= 同步模式，true = 独立模式
  const [independentMode, setIndependentMode] = useState(false);
  
  const [chartDataCache, setChartDataCache] = useState<{
    [key: string]: { upData: any; downData: any; timestamp: number } | null;
  }>({});
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const chartRef = useRef<any>(null);

  const [selectDate, setSelectDate] = useState(moment().format('YYYY-MM-DD'));

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getParamsKey = useCallback(() => {
    return `${selectDate}_${selectDays}_${selectConsAllDays}_${selectConsDays}_${selectConsTotal}_${from100}`;
  }, [selectDate, selectDays, selectConsAllDays, selectConsDays, selectConsTotal, from100]);

  const getFrom100Param = (type: string): string => {
    if (type === '100w' || type === 'DR_100w') {
      return 'true';
    }
    return '400s';
  };

  // 处理 selectConsDays 变化
  const handleConsDaysChange = useCallback((value: number) => {
    const newValue = value || 0;
    setSelectConsDays(newValue);
    
    // 如果不是独立模式（即同步模式），同步更新 selectConsAllDays
    if (!independentMode) {
      setSelectConsAllDays(String(newValue));
    }
  }, [independentMode]);

  // 处理 selectConsAllDays 变化
  const handleConsAllDaysChange = useCallback((value: string) => {
    const numValue = parseInt(value, 10) || 0;
    setSelectConsAllDays(value);
    
    // 如果不是独立模式（即同步模式），同步更新 selectConsDays
    if (!independentMode) {
      setSelectConsDays(numValue);
    }
  }, [independentMode]);

  // 切换模式时，如果是切换到同步模式，同步两个值
  const handleModeChange = useCallback((checked: boolean) => {
    setIndependentMode(checked);
    
    // 如果切换到同步模式（开关关闭），同步两个值
    if (!checked) {
      const currentValue = selectConsDays;
      setSelectConsAllDays(String(currentValue));
    }
  }, [selectConsDays]);

  const fetchData = useCallback(async () => {
    const paramsKey = getParamsKey();
    const currentType = from100;
    
    const cached = chartDataCache[currentType];
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log('使用缓存数据');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setProgress(0);
    setCurrentProcessingDate('');
    
    try {
      const days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
      const dateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
      
      console.log(`日期数量: ${dateArr.length}`);
      console.log(`参数: selectConsDays=${selectConsDays}, selectConsAllDays=${selectConsAllDays}`);
      console.log(`模式: ${independentMode ? '独立模式' : '同步模式'}`);
      
      const from100Param = getFrom100Param(currentType);
      const apiUrl = `/api/all_alarm_data?date_str=${caculateDate(selectDate, days)}&end_date_str=${today}&from100=${from100Param}`;
      
      console.log('请求API:', apiUrl);
      
      const res = await get(apiUrl, { method: 'GET', signal: abortController.signal });
      
      if (!isMountedRef.current) return;
      
      if (!res || res.length === 0) {
        message.warning('未获取到数据');
        setIsLoading(false);
        return;
      }
      
      console.log(`获取到 ${res.length} 条原始数据，开始计算...`);
      
      const { upDataByDate, downDataByDate } = await calculateStockDataByDateChunked(
        res,
        dateArr,
        selectConsAllDays,
        selectConsTotal,
        selectConsDays,
        (prog, date) => {
          if (isMountedRef.current) {
            setProgress(prog);
            if (date) setCurrentProcessingDate(date);
          }
        }
      );
      
      if (!isMountedRef.current) return;
      
      setChartDataCache(prev => ({
        ...prev,
        [currentType]: { 
          upData: upDataByDate, 
          downData: downDataByDate,
          timestamp: Date.now()
        }
      }));
      
      message.success(`${currentType} 数据加载成功，共 ${dateArr.length} 个时间点`);
    } catch (error: any) {
      if (isMountedRef.current && error.name !== 'AbortError') {
        console.error('请求失败:', error);
        message.error('数据加载失败：' + (error.message || '未知错误'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setProgress(0);
        setCurrentProcessingDate('');
      }
      abortControllerRef.current = null;
    }
  }, [selectDate, selectDays, selectConsAllDays, selectConsDays, selectConsTotal, from100, chartDataCache, getParamsKey, independentMode]);

  const runAnalysis = useCallback(() => {
    setChartDataCache(prev => ({
      ...prev,
      [from100]: null
    }));
    fetchData();
  }, [from100, fetchData]);

  const handleFrom100Change = useCallback((value: string) => {
    setFrom100(value);
  }, []);

  const currentChartOption = useMemo(() => {
    const currentData = chartDataCache[from100];
    if (!currentData) return null;
    return dapanOptionWithBoth(
      currentData.upData, 
      currentData.downData, 
      simpleMode, 
      labelDensity,
      labelRotate,
      showValues,  // 传递显示数值开关状态
    );
  }, [chartDataCache, from100, simpleMode, labelDensity, labelRotate, showValues]);

  const statistics = useMemo(() => {
    const currentData = chartDataCache[from100];
    if (!currentData) return null;
    
    const upData = currentData.upData;
    const downData = currentData.downData;
    const dates = Object.keys(upData || {});
    
    if (dates.length === 0) return null;
    
    const totalUp = dates.reduce((sum, date) => sum + (upData[date]?.length || 0), 0);
    const totalDown = dates.reduce((sum, date) => sum + (downData[date]?.length || 0), 0);
    const avgUp = (totalUp / dates.length).toFixed(0);
    const avgDown = (totalDown / dates.length).toFixed(0);
    
    return { totalUp, totalDown, avgUp, avgDown, datesCount: dates.length };
  }, [chartDataCache, from100]);

  const resetZoom = useCallback(() => {
    if (chartRef.current) {
      const chart = chartRef.current.getEchartsInstance();
      chart.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: 100,
      });
    }
  }, []);

  return (
    <div style={{ padding: '2px' }}>
      <div style={{ marginTop: '20px' }}>
        <div style={{ padding: '5px 10px', background: '#f6f6f6' }}>
          <Space wrap>
            <Select
              style={{ width: '150px' }}
              value={selectConsTotal}
              onChange={setSelectConsTotal}
              size="small"
            >
              <Select.Option value="CONS">Continuously Appear</Select.Option>
              <Select.Option value="TOTAL">Total Appear</Select.Option>
            </Select>
            
            <span>连续出现</span>
            <Input
              style={{ width: '60px' }}
              size="small"
              value={selectConsDays}
              onChange={(e) => handleConsDaysChange(parseInt(e.target.value, 10) || 0)}
            />
            
            <span>天，在</span>
            <Input
              style={{ width: '60px' }}
              size="small"
              value={selectConsAllDays}
              onChange={(e) => handleConsAllDaysChange(e.target.value)}
            />
            
            <span>天内</span>
            
            {/* 独立模式开关：关闭=同步，开启=独立 */}
            <Tooltip title={independentMode ? "独立模式：两个值可分别设置" : "同步模式：两个值自动同步"}>
              <span>
                独立模式
                <Switch
                  size="small"
                  checked={independentMode}
                  onChange={handleModeChange}
                  style={{ marginLeft: '8px' }}
                  checkedChildren="开"
                  unCheckedChildren="关"
                />
              </span>
            </Tooltip>
            
            {!independentMode && (
              <span style={{ fontSize: '12px', color: '#52c41a' }}>
                ✓ 同步模式
              </span>
            )}
            
            <Select
              style={{ width: '80px' }}
              value={selectDays}
              onChange={setSelectDays}
              size="small"
            >
              {[60, 80, 100, 120, 150, 180, 360].map(i => (
                <Select.Option key={i} value={i}>{i}</Select.Option>
              ))}
            </Select>
            
            <span>Days Till</span>
            
            <DatePicker
              value={moment(selectDate)}
              onChange={(v) => v && setSelectDate(v.format('YYYY-MM-DD'))}
            />
            
            <Select
              style={{ width: '100px' }}
              value={from100}
              onChange={handleFrom100Change}
              size="small"
            >
              {['400s', '100w', 'DR_400s', 'DR_100w'].map(i => (
                <Select.Option key={i} value={i}>{i}</Select.Option>
              ))}
            </Select>
            
            <Button type="primary" onClick={runAnalysis} loading={isLoading}>
              RUN
            </Button>
          </Space>
        </div>
        
        {/* 图表显示选项 */}
        <div style={{ padding: '10px', background: '#fff', borderBottom: '1px solid #eee' }}>
          <Space wrap style={{ width: '100%' }}>
            <Tooltip title="简化曲线，提升大数据量性能">
              <span>
                简化模式
                <Switch size="small" checked={simpleMode} onChange={setSimpleMode} style={{ marginLeft: '8px' }} />
              </span>
            </Tooltip>
            
            <Tooltip title="在图表上显示具体数值">
              <span>
                显示数值
                <Switch 
                  size="small" 
                  checked={showValues} 
                  onChange={setShowValues} 
                  style={{ marginLeft: '8px' }} 
                  checkedChildren="开"
                  unCheckedChildren="关"
                />
              </span>
            </Tooltip>
            
            <Tooltip title="控制X轴日期显示密度">
              <span>
                日期密度：
                <Radio.Group 
                  size="small" 
                  value={labelDensity} 
                  onChange={(e) => setLabelDensity(e.target.value)}
                  style={{ marginLeft: '8px' }}
                >
                  <Radio.Button value="high">高密度</Radio.Button>
                  <Radio.Button value="medium">中密度</Radio.Button>
                  <Radio.Button value="low">低密度</Radio.Button>
                </Radio.Group>
              </span>
            </Tooltip>
            
            <Tooltip title="X轴标签旋转角度">
              <span>
                标签旋转：
                <Radio.Group 
                  size="small" 
                  value={labelRotate} 
                  onChange={(e) => setLabelRotate(e.target.value)}
                  style={{ marginLeft: '8px' }}
                >
                  <Radio.Button value={0}>0°</Radio.Button>
                  <Radio.Button value={30}>30°</Radio.Button>
                  <Radio.Button value={45}>45°</Radio.Button>
                  <Radio.Button value={60}>60°</Radio.Button>
                </Radio.Group>
              </span>
            </Tooltip>
            
            <Button size="small" onClick={resetZoom}>重置缩放</Button>
          </Space>
        </div>
        
        {/* 进度条 */}
        {isLoading && progress > 0 && (
          <div style={{ marginTop: '16px', padding: '0 16px' }}>
            <Progress 
              percent={Math.round(progress)} 
              status="active"
              size="small"
              format={(percent) => `${percent}% - ${currentProcessingDate || '处理中...'}`}
            />
          </div>
        )}
        
        <Spin spinning={isLoading} tip={isLoading ? `正在计算... ${progress > 0 ? `${Math.round(progress)}%` : ''}` : ''}>
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>{from100} - Up/Down 趋势对比</h3>
              {currentChartOption && statistics && (
                <span style={{ fontSize: '12px', color: '#999' }}>
                  {statistics.datesCount} 个时间点 | 
                  <Tooltip title="鼠标拖拽图表可缩放查看细节，双击恢复">
                    <span style={{ marginLeft: '8px', cursor: 'help' }}>💡 可拖拽缩放</span>
                  </Tooltip>
                </span>
              )}
            </div>
            {currentChartOption && (
              <ReactEcharts
                ref={chartRef}
                style={{ height: 500, width: '100%' }}
                notMerge={false}
                lazyUpdate={true}
                option={currentChartOption}
                opts={{ renderer: 'canvas' }}
                theme="light"
              />
            )}
            {!currentChartOption && !isLoading && (
              <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                暂无数据，请点击 RUN 按钮加载数据
              </div>
            )}
          </div>
        </Spin>
      </div>
    </div>
  );
};