import { useCallback, useState, useMemo, useEffect } from 'react';
import React from 'react';
import { Button, Input, Select, DatePicker } from 'antd';
import moment from 'moment';
import { post, get } from '../lib/request';
import { caculateDate, validateCons, validateTotal, workdays } from './alarm';
import { groupBy, orderBy } from 'lodash';
import ReactEcharts from 'echarts-for-react';

const dapanOption = (data) => {
  const yData = Object.keys(data)?.map((i) => data[i]?.length);
  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['Count'],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    xAxis: {
      type: 'category',
      data: Object.keys(data),
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'TotalPct',
        type: 'line',
        data: yData,
        itemStyle: {
          normal: {
            color: '#444',
          },
        },
        label: {
          position: 'top',
        },
      },
    ],
  };
};

export const pullWorkDaysArray = (date, days) => {
  const endIndex = workdays.indexOf(caculateDate(date, 0));
  const workDaysArray = workdays.slice(endIndex - days + 1, endIndex + 1);
  console.log(endIndex, endIndex - days, workDaysArray);
  return workDaysArray;
};

export const DataAnalysisCom = () => {
  const [selectDays, setSelectDays] = useState('40');
  const [selectConsAllDays, setSelectConsAllDays] = useState('10');
  const [isLoading, setIsLoading] = useState(false);

  const [selectConsUpDown, setSelectConsUpDown] = useState('up');
  const [selectConsDays, setSelectConsDays] = useState(5);
  const [selectConsTotal, setSelectConsTotal] = useState('CONS');
  const curDate = new Date();
  const year = curDate.getFullYear();
  const month = curDate.getMonth() + 1;
  const day = curDate.getDate();
  const dateFormat = 'YYYY-MM-DD';
  const [selectDate, setSelectDate] = useState(
    moment(`${year}-${month}-${day}`).format(dateFormat)
  );
  const [selectPriceMargin, setSelectPriceMargin] = useState(3);
  const [option, setOption] = useState<any>({});

  const runAnalysis = useCallback(() => {
    const days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
    get(
      `/api/all_alarm_data?date_str=${caculateDate(
        selectDate,
        days
      )}&end_date_str=${selectDate}&from100=${false}`,
      { method: 'GET' }
    ).then((res) => {
      // console.log(res);
      const dateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
      const stockDataByDate = {};
      const allSelectStocks: any = [];
      dateArr?.forEach((date) => {
        const allStockDataByDate = res?.filter(
          (e) =>
            e?.datestr <= caculateDate(date, 0) &&
            e?.datestr > caculateDate(date, parseInt(selectConsAllDays, 10))
        );
        const data = groupBy(allStockDataByDate, 'symbol');
        const selectedStocks: any = [];
        Object.keys(data).forEach((k) => {
          const item = data[k];
          if (selectConsTotal === 'CONS') {
            const { isTrue, start, end } = validateCons(
              item,
              selectConsUpDown,
              selectConsDays
            );
            if (isTrue) {
              const startPrice = item[start].finalprice;
              const endPrice = item[end].finalprice;

              selectedStocks.push(item.find((d) => d.datestr === date));
            }
          }
          if (selectConsTotal === 'TOTAL') {
            const { isTrue } = validateTotal(
              item,
              selectConsUpDown,
              selectConsDays
            );
            if (isTrue) {
              selectedStocks.push(item.find((d) => d.datestr === date));
            }
          }
        });
        stockDataByDate[date] = selectedStocks;
        allSelectStocks.push(...selectedStocks);
      });
      const allStocksGroupBySymbol = groupBy(allSelectStocks, 'symbol');
      const upDownStocks = orderBy(
        Object.keys(allStocksGroupBySymbol)?.map((i) => ({
          ...allStocksGroupBySymbol[i][0],
          dupCount: allStocksGroupBySymbol[i]?.length,
        })),
        ['dupCount'],
        ['desc']
      );
      console.log(upDownStocks);
      setOption(dapanOption(stockDataByDate));
    });
  }, [selectDate, selectDays, selectConsAllDays, selectConsDays]);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginTop: '20px' }}>
        Advanced Filter:
        <Select
          style={{ width: '180px' }}
          value={selectConsTotal}
          onChange={(v) => {
            setSelectConsTotal(v);
          }}
          size="small"
        >
          <Select.Option value="CONS">Continuously Appear</Select.Option>
          <Select.Option value="TOTAL">Total Appear</Select.Option>
        </Select>
        <Select
          style={{ width: '80px' }}
          value={selectConsUpDown}
          onChange={(v) => {
            setSelectConsUpDown(v);
          }}
          size="small"
        >
          <Select.Option value="up">Up</Select.Option>
          <Select.Option value="down">Down</Select.Option>
        </Select>
        {' for '}
        <Input
          style={{ width: '50px', height: '32px' }}
          size="small"
          placeholder="Input Days"
          value={selectConsDays}
          onChange={(e) => {
            setSelectConsDays(parseInt(e.target.value, 10));
          }}
        />
        days{' '}
        {/* <Select
          style={{ width: '80px' }}
          value={selectPriceMargin}
          onChange={(v) => {
            setSelectPriceMargin(v);
          }}
          size="small"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <Select.Option key={i} value={i}>
              {i}
            </Select.Option>
          ))}
        </Select>
        % price margin in */}
        in
        <Input
          style={{ width: '50px', height: '32px' }}
          size="small"
          placeholder="Input Days"
          value={selectConsAllDays}
          onChange={(e) => {
            setSelectConsAllDays(e.target.value);
          }}
        />
        days
        <Select
          style={{ width: '80px' }}
          value={selectDays}
          onChange={(v) => {
            setSelectDays(v);
          }}
          size="small"
        >
          {[40, 50, 60].map((i) => (
            <Select.Option key={i} value={i}>
              {i}
            </Select.Option>
          ))}
        </Select>
        Days Till
        <DatePicker
          defaultValue={moment(selectDate, dateFormat)}
          format={dateFormat}
          onChange={(v: any) => setSelectDate(v.format(dateFormat))}
        />
        <Button
          type="primary"
          onClick={() => {
            if (selectConsDays && !isNaN(selectConsDays)) {
              setIsLoading(true);
              runAnalysis();
            }
          }}
        >
          {' '}
          Run
        </Button>
        <ReactEcharts
          style={{ height: 350, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={option}
        />
      </div>
    </div>
  );
};
