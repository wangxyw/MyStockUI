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

// 图表配置函数
const dapanOptionWithBoth = (upData: any, downData: any) => {
  const dates = Object.keys(upData || {});
  const upYData = dates?.map((i) => upData[i]?.length || 0);
  const downYData = dates?.map((i) => downData[i]?.length || 0);
  const diffYData = dates?.map((i) => (upData[i]?.length || 0) - (downData[i]?.length || 0));

  return {
    title: { text: '', left: 0 },
    legend: {
      data: ['Up Count', 'Down Count', 'Difference (Up - Down)'],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let result = params[0].axisValue + '<br/>';
        params.forEach((p: any) => {
          result += `${p.marker} ${p.seriesName}: ${p.value}<br/>`;
        });
        return result;
      },
    },
    xAxis: {
      type: 'category',
      data: dates?.map((i) => {
        if (DATE.workday.indexOf(getBeforeOneDate(i, 1)) === -1) {
          return { value: i, textStyle: { color: 'red' } };
        }
        return i;
      }),
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: { type: 'value', name: '数量 / 差值' },
    series: [
      {
        name: 'Up Count',
        type: 'line',
        data: upYData,
        itemStyle: { color: '#ff4d4f' },
        symbol: 'circle',
        label: { show: true, position: 'top' },
      },
      {
        name: 'Down Count',
        type: 'line',
        data: downYData,
        itemStyle: { color: '#52c41a' },
        symbol: 'diamond',
        label: { show: true, position: 'bottom' },
      },
      {
        name: 'Difference (Up - Down)',
        type: 'line',
        data: diffYData,
        itemStyle: { color: '#faad14' },
        lineStyle: { type: 'dashed' },
        symbol: 'triangle',
        label: { show: true, position: 'right' },
      },
    ],
  };
};

export const pullWorkDaysArray = (date, days) => {
  const endIndex = workdays.indexOf(caculateDate(date, 0));
  return workdays.slice(endIndex - days + 1, endIndex + 1);
};

// 优化：使用 Web Worker 进行大数据计算（可选）
const calculateStockDataByDate = (res: any[], dateArr: string[], selectConsAllDays: string, selectConsTotal: string, selectConsDays: number) => {
  const upDataByDate: any = {};
  const downDataByDate: any = {};

  dateArr?.forEach((date) => {
    const allStockDataByDate = res?.filter(
      (e) =>
        e?.datestr <= caculateDate(date, 0) &&
        e?.datestr > caculateDate(date, parseInt(selectConsAllDays, 10))
    );
    const data = groupBy(allStockDataByDate, 'symbol');
    
    let upStocks: any = [];
    let downStocks: any = [];

    // 优化：使用 for...of 替代 forEach，性能更好
    for (const [_, items] of Object.entries(data)) {
      const itemArray = items as any[];
      const lastStock = itemArray[itemArray.length - 1];
      
      if (selectConsTotal === 'CONS') {
        const { isTrue: isUp } = validateCons(itemArray, 'up', selectConsDays);
        const { isTrue: isDown } = validateCons(itemArray, 'down', selectConsDays);
        if (isUp) upStocks.push(lastStock);
        if (isDown) downStocks.push(lastStock);
      } else {
        const { isTrue: isUp } = validateTotal(itemArray, 'up', selectConsDays);
        const { isTrue: isDown } = validateTotal(itemArray, 'down', selectConsDays);
        if (isUp) upStocks.push(lastStock);
        if (isDown) downStocks.push(lastStock);
      }
    }

    const upSymbols = upStocks?.map((i) => i.symbol);
    const downSymbols = downStocks?.map((i) => i.symbol);
    const upPriceData = res?.filter((i) => upSymbols?.includes(i.symbol));
    const downPriceData = res?.filter((i) => downSymbols?.includes(i.symbol));
    
    upDataByDate[date] = caculatePriceData(upStocks, upPriceData);
    downDataByDate[date] = caculatePriceData(downStocks, downPriceData);
  });
  
  return { upDataByDate, downDataByDate };
};

export const TotalDataCom = (props) => {
  const { isDR } = props;
  const [selectDays, setSelectDays] = useState('80');
  const [selectConsAllDays, setSelectConsAllDays] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [from100, setFrom100] = useState('400s');
  const [selectConsDays, setSelectConsDays] = useState(5);
  const [selectConsTotal, setSelectConsTotal] = useState('CONS');
  
  // 缓存计算结果
  const [chartDataCache, setChartDataCache] = useState<{
    [key: string]: { upData: any; downData: any } | null;
  }>({});
  
  // 缓存请求参数，避免重复计算
  const lastParamsRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectDate, setSelectDate] = useState(moment().format('YYYY-MM-DD'));

  // 生成参数缓存key
  const getParamsKey = useCallback(() => {
    return `${selectDate}_${selectDays}_${selectConsAllDays}_${selectConsDays}_${selectConsTotal}_${from100}`;
  }, [selectDate, selectDays, selectConsAllDays, selectConsDays, selectConsTotal, from100]);

  // 获取 from100 参数值
  const getFrom100Param = (type: string): string => {
    if (type === '100w' || type === 'DR_100w') {
      return 'true';
    }
    return '400s';
  };

  // 获取数据（只请求当前选中的类型）
  const fetchData = useCallback(async () => {
    const paramsKey = getParamsKey();
    const currentType = from100;
    
    // 检查缓存
    if (chartDataCache[currentType]) {
      console.log('使用缓存数据');
      return;
    }

    // 取消正在进行的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    
    try {
      const days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
      const dateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
      
      const from100Param = getFrom100Param(currentType);
      const apiUrl = `/api/all_alarm_data?date_str=${caculateDate(selectDate, days)}&end_date_str=${today}&from100=${from100Param}`;
      
      console.log('请求API:', apiUrl);
      
      const res = await get(apiUrl, { method: 'GET', signal: abortController.signal });
      
      // 使用 requestIdleCallback 进行非阻塞计算
      const calculateData = () => {
        return new Promise((resolve) => {
          const task = () => {
            const result = calculateStockDataByDate(
              res,
              dateArr,
              selectConsAllDays,
              selectConsTotal,
              selectConsDays
            );
            resolve(result);
          };
          
          if ('requestIdleCallback' in window) {
            requestIdleCallback(task, { timeout: 2000 });
          } else {
            setTimeout(task, 0);
          }
        });
      };
      
      const { upDataByDate, downDataByDate } = await calculateData() as any;
      
      setChartDataCache(prev => ({
        ...prev,
        [currentType]: { upData: upDataByDate, downData: downDataByDate }
      }));
      
      message.success(`${currentType} 数据加载成功`);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('请求失败:', error);
        message.error('数据加载失败');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [selectDate, selectDays, selectConsAllDays, selectConsDays, selectConsTotal, from100, chartDataCache, getParamsKey]);

  // 点击 RUN
  const runAnalysis = useCallback(() => {
    // 清空当前类型的缓存，强制刷新
    setChartDataCache(prev => ({
      ...prev,
      [from100]: null
    }));
    fetchData();
  }, [from100, fetchData]);

  // 切换类型时，如果有缓存就显示，没有就显示空白（不自动请求）
  const handleFrom100Change = useCallback((value: string) => {
    setFrom100(value);
  }, []);

  const currentChartOption = useMemo(() => {
    const currentData = chartDataCache[from100];
    if (!currentData) return null;
    return dapanOptionWithBoth(currentData.upData, currentData.downData);
  }, [chartDataCache, from100]);

  return (
    <div style={{ padding: '2px' }}>
      <div style={{ marginTop: '20px' }}>
        <div style={{ padding: '5px 10px', background: '#f6f6f6' }}>
          <Space wrap>
            <Select
              style={{ width: '180px' }}
              value={selectConsTotal}
              onChange={setSelectConsTotal}
              size="small"
            >
              <Select.Option value="CONS">Continuously Appear</Select.Option>
              <Select.Option value="TOTAL">Total Appear</Select.Option>
            </Select>
            
            <span>for</span>
            <Input
              style={{ width: '50px' }}
              size="small"
              value={selectConsDays}
              onChange={(e) => setSelectConsDays(parseInt(e.target.value, 10) || 0)}
            />
            
            <span>days in</span>
            <Input
              style={{ width: '50px' }}
              size="small"
              value={selectConsAllDays}
              onChange={(e) => setSelectConsAllDays(e.target.value)}
            />
            
            <span>days</span>
            
            <Select
              style={{ width: '80px' }}
              value={selectDays}
              onChange={setSelectDays}
              size="small"
            >
              {[60, 80, 100, 120].map(i => (
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
        
        <Spin spinning={isLoading} tip="Loading and calculating...">
          <div style={{ marginTop: '20px' }}>
            <h3>{from100} - Up/Down 趋势对比</h3>
            {currentChartOption && (
              <ReactEcharts
                style={{ height: 400, width: '100%' }}
                notMerge={true}
                lazyUpdate={true}
                option={currentChartOption}
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