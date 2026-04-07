import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Button, Input, Select, DatePicker, Spin, Space, message } from 'antd';
import moment from 'moment';
import { get } from '../lib/request';
import ReactEcharts from 'echarts-for-react';
import { debounce } from 'lodash';
import { pullWorkDaysArray } from './data_total';
import {
  caculateDate,
  today,
  validateCons,
  validateTotal,
  workdays,
} from './alarm';
import { caculatePriceData } from './myFocus';
import DATE from './date.json';
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
        if (DATE.workday?.indexOf(getBeforeOneDate?.(i, 1) || '') === -1) {
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

// 计算函数
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

    const upSymbols = upStocks?.map((i: any) => i.symbol);
    const downSymbols = downStocks?.map((i: any) => i.symbol);
    const upPriceData = res?.filter((i: any) => upSymbols?.includes(i.symbol));
    const downPriceData = res?.filter((i: any) => downSymbols?.includes(i.symbol));
    
    upDataByDate[date] = caculatePriceData(upStocks, upPriceData);
    downDataByDate[date] = caculatePriceData(downStocks, downPriceData);
  });
  
  return { upDataByDate, downDataByDate };
};

// groupBy 辅助函数
const groupBy = (array: any[], key: string) => {
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) result[groupKey] = [];
    result[groupKey].push(item);
    return result;
  }, {});
};

export const TotalDataComNew = (props: any) => {
  const { isDR } = props;
  const [selectDays, setSelectDays] = useState('80');
  const [selectConsAllDays, setSelectConsAllDays] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [from100, setFrom100] = useState('400s');
  const [selectConsDays, setSelectConsDays] = useState(5);
  const [selectConsTotal, setSelectConsTotal] = useState('CONS');
  const [selectDate, setSelectDate] = useState(moment().format('YYYY-MM-DD'));
  
  // 修复：添加缺失的 chartDataCache 状态
  const [chartDataCache, setChartDataCache] = useState<{
    [key: string]: { upData: any; downData: any } | null;
  }>({});
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // 生成参数缓存key
  const getParamsKey = useCallback(() => {
    return `${selectDate}_${selectDays}_${selectConsAllDays}_${selectConsDays}_${selectConsTotal}_${from100}`;
  }, [selectDate, selectDays, selectConsAllDays, selectConsDays, selectConsTotal, from100]);

  // 获取数据
  const fetchData = useCallback(async () => {
    const currentType = from100;
    
    if (chartDataCache[currentType]) {
      console.log('使用缓存数据');
      return;
    }

    setIsLoading(true);
    
    try {
      const days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
      const dateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
      
      console.log('=== 调试信息 ===');
      console.log('selectDate:', selectDate);
      console.log('selectDays:', selectDays);
      console.log('selectConsAllDays:', selectConsAllDays);
      console.log('days参数:', days);
      console.log('dateArr (需要展示的日期):', dateArr);
      console.log('dateArr长度:', dateArr.length);
      console.log('第一个日期:', dateArr[0]);
      console.log('最后一个日期:', dateArr[dateArr.length - 1]);
      
      const from100Param = from100 === '100w' || from100 === 'DR_100w' ? 'true' : '400s';
      const startDate = caculateDate(selectDate, days);
      const apiUrl = `/api/all_alarm_data_new?date_str=${startDate}&end_date_str=${today}&from100=${from100Param}`;
      
      console.log('API请求参数:');
      console.log('startDate (date_str):', startDate);
      console.log('endDate (end_date_str):', today);
      console.log('完整API URL:', apiUrl);
      
      const res = await get(apiUrl, { method: 'GET' });
      
      console.log('API返回数据量:', res?.length || 0);
      if (res && res.length > 0) {
        console.log('API返回数据日期范围:');
        const dates = [...new Set(res.map((item: any) => item.datestr))];
        console.log('可用日期:', dates.sort());
        console.log('最小日期:', dates.sort()[0]);
        console.log('最大日期:', dates.sort()[dates.length - 1]);
      }
      
      const data = Array.isArray(res) ? res : [];
      
      const { upDataByDate, downDataByDate } = calculateStockDataByDate(
        data,
        dateArr,
        selectConsAllDays,
        selectConsTotal,
        selectConsDays
      );
      
      console.log('计算结果:');
      console.log('upDataByDate的日期:', Object.keys(upDataByDate));
      console.log('downDataByDate的日期:', Object.keys(downDataByDate));
      
      // 检查每个日期的数据
      dateArr.forEach(date => {
        const upCount = upDataByDate[date]?.length || 0;
        const downCount = downDataByDate[date]?.length || 0;
        console.log(`日期 ${date}: Up=${upCount}, Down=${downCount}`);
      });
      
      setChartDataCache(prev => ({
        ...prev,
        [currentType]: { upData: upDataByDate, downData: downDataByDate }
      }));
      
      message.success(`${currentType} 数据加载成功`);
    } catch (error: any) {
      console.error('请求失败:', error);
      message.error(`数据加载失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectDate, selectDays, selectConsAllDays, selectConsDays, selectConsTotal, from100, chartDataCache]);

  // 点击 RUN
  const runAnalysis = useCallback(() => {
    setChartDataCache(prev => ({
      ...prev,
      [from100]: null
    }));
    fetchData();
  }, [from100, fetchData]);

  // 切换类型
  const handleFrom100Change = useCallback((value: string) => {
    setFrom100(value);
  }, []);

  // 图表配置
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
            <Select style={{ width: '180px' }} value={selectConsTotal} onChange={setSelectConsTotal} size="small">
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
            
            <Select style={{ width: '80px' }} value={selectDays} onChange={setSelectDays} size="small">
              {[60, 80, 100, 120].map(i => (
                <Select.Option key={i} value={i.toString()}>{i}</Select.Option>
              ))}
            </Select>
            
            <span>Days Till</span>
            
            <DatePicker
              value={moment(selectDate)}
              onChange={(v) => v && setSelectDate(v.format('YYYY-MM-DD'))}
            />
            
            <Select style={{ width: '100px' }} value={from100} onChange={handleFrom100Change} size="small">
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