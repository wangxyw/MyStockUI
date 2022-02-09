import { useCallback, useState, useMemo, useEffect } from 'react';
import React from 'react';
import {
  Button,
  Input,
  Select,
  DatePicker,
  Tag,
  Table,
  Tabs,
  Spin,
} from 'antd';
import moment from 'moment';
import { post, get } from '../lib/request';
import { caculateDate, validateCons, validateTotal, workdays } from './alarm';
import { groupBy, orderBy } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import { caculatePriceData } from './myFocus';

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

const columns: any = [
  {
    title: 'Symbol',
    dataIndex: 'symbol',
    key: 'symbol',
    render: (text, record) => {
      return (
        <a
          target="_blank"
          href={`https://finance.sina.com.cn/realstock/company/${text}/nc.shtml`}
        >
          {text}
        </a>
      );
    },
  },
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    render: (text, record) => {
      return <span>{text}</span>;
    },
  },
  {
    title: 'Add Price',
    dataIndex: 'finalprice',
    key: 'finalprice',
  },
  {
    title: 'Date',
    dataIndex: 'datestr',
    key: 'datestr',
    defaultSortOrder: 'descend',
    sorter: (a: any, b: any): any => {
      return (
        Number(a.datestr.replaceAll('-', '')) -
        Number(b.datestr.replaceAll('-', ''))
      );
    },
  },
  {
    title: '流通股本',
    dataIndex: 'circulation_stock',
    key: 'circulation_stock',
    render: (c, record) => {
      const re = (record.marketvalue / record.finalprice).toFixed(3);
      return <>{re}</>;
    },
  },
  {
    title: 'MaxPrice',
    dataIndex: 'maxPrice',
    key: 'maxPrice',
    sorter: (a: any, b: any): any => {
      return Number(a.maxPriceDiff) - Number(b.maxPriceDiff);
    },
    render: (c, record) => {
      const diff = record.maxPriceDiff;
      return (
        <Tag color={diff > 0 ? 'red' : 'green'}>
          {c}/ {diff + '%'}
        </Tag>
      );
    },
  },
  {
    title: 'MaxPriceDay',
    dataIndex: 'maxPriceDay',
    key: 'maxPriceDay',
  },
  {
    title: 'MinPrice',
    dataIndex: 'minPrice',
    key: 'minPrice',
    render: (c, record) => {
      const diff = record.minPriceDiff;
      return (
        <Tag color={diff > 0 ? 'red' : 'green'}>
          {c}/ {diff + '%'}
        </Tag>
      );
    },
  },
  {
    title: 'MinPriceDay',
    dataIndex: 'minPriceDay',
    key: 'minPriceDay',
  },
];
export const DataAnalysisCom = () => {
  const [selectDays, setSelectDays] = useState('40');
  const [selectConsAllDays, setSelectConsAllDays] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState([]);
  const [dateArray, setDateArray] = useState<any>([]);
  const [selectDateTab, setSelectDateTab] = useState<any>();
  const [stockData, setStockData] = useState<any>();
  const [dataTotal, setDataTotal] = useState<any>();
  const [dataUp, setDataUp] = useState<any>();
  const [dataDown, setDataDown] = useState<any>();

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
    setIsLoading(true);
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

              selectedStocks.push(item[item?.length - 1]);
            }
          }
          if (selectConsTotal === 'TOTAL') {
            const { isTrue } = validateTotal(
              item,
              selectConsUpDown,
              selectConsDays
            );
            if (isTrue) {
              selectedStocks.push(item[item?.length - 1]);
            }
          }
        });
        const selectSymbols = selectedStocks?.map((i) => i.symbol);
        const priceSymbolData = res?.filter((i) =>
          selectSymbols?.includes(i.symbol)
        );
        stockDataByDate[date] = caculatePriceData(
          selectedStocks,
          priceSymbolData
        );
        allSelectStocks.push(...selectedStocks);
      });

      // console.log('===', stockDataByDate);
      // const allStocksGroupBySymbol = groupBy(allSelectStocks, 'symbol');
      // const upDownStocks = orderBy(
      //   Object.keys(allStocksGroupBySymbol)?.map((i) => ({
      //     ...allStocksGroupBySymbol[i][0],
      //     dupCount: allStocksGroupBySymbol[i]?.length,
      //   })),
      //   ['dupCount'],
      //   ['desc']
      // );
      // console.log(upDownStocks);
      setDateArray(dateArr);
      setStockData(stockDataByDate);
      setOption(dapanOption(stockDataByDate));
      setSelectDateTab(dateArr[0]);
      setIsLoading(false);
    });
  }, [selectDate, selectDays, selectConsAllDays, selectConsDays]);

  useEffect(() => {
    console.log(stockData, selectDateTab);
    if (stockData && selectDateTab) {
      console.log(stockData[selectDateTab]?.filter((i) => i.maxPriceDay > 0));
      setData(stockData[selectDateTab]);
      setDataTotal(stockData[selectDateTab]?.length);
      setDataUp(
        stockData[selectDateTab]?.filter((i) => i.maxPriceDay > 0)?.length
      );
      setDataDown(
        stockData[selectDateTab]?.filter((i) => i.maxPriceDay === 0)?.length
      );
    }
  }, [stockData, selectDateTab]);

  return (
    <div style={{ padding: '20px' }}>
      Todo: list all condition as alarm page
      <div style={{ marginTop: '20px' }}>
        Condition:
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
        <Spin spinning={isLoading} tip="Loading and caculating...">
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={option}
          />
          {dateArray?.length > 0 && (
            <Tabs
              defaultActiveKey="1"
              tabPosition={'top'}
              style={{ height: 220 }}
              onChange={(v) => setSelectDateTab(v)}
            >
              {dateArray?.map((i) => (
                <Tabs.TabPane tab={i} key={i}>
                  <p>
                    Total:{dataTotal}{' '}
                    <span style={{ color: 'red' }}>Up:{dataUp}</span>{' '}
                    <span style={{ color: 'green' }}>Down:{dataDown}</span>
                  </p>
                  <p>Total 表示当天选出来一共有多少</p>
                  <p>Up 表示选出来的中 近60天有过上涨的数量</p>
                  <p>Down 表示选出来的中 近60天从未有过上涨的数量</p>
                </Tabs.TabPane>
              ))}
            </Tabs>
          )}
          {data && (
            <Table
              pagination={{ defaultPageSize: 100 }}
              columns={columns}
              dataSource={data}
            />
          )}
        </Spin>
      </div>
    </div>
  );
};
