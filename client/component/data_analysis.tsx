import { useCallback, useState, useMemo, useEffect } from 'react';
import './alarm.css';
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
  Space,
  Switch,
  Checkbox,
  InputNumber,
} from 'antd';
import moment from 'moment';
import { post, get } from '../lib/request';
import {
  caculateDate,
  isAverageDistribution,
  today,
  validateCons,
  validateTotal,
  workdays,
} from './alarm';
import { groupBy, orderBy, uniqBy } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import { caculatePriceData } from './myFocus';
import { minOrAverageMap, SELECT_COLOR } from './new_alarm';

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
        <>
          <a
            target="_blank"
            href={`https://finance.sina.com.cn/realstock/company/${text}/nc.shtml`}
          >
            {text}
          </a>
          <Tag>
            <a
              target="_blank"
              href={`http://${location.host}/alarm?symbol=${text}&datestr=${record.datestr}`}
            >
              {'Show alarm'}
            </a>
          </Tag>
        </>
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

const composeCompareData = (stockData) => {
  const more100 = stockData?.filter((i) => i.maxPriceDiff > 100)?.length;
  const form20to100 = stockData?.filter(
    (i) => i.maxPriceDiff <= 100 && i.maxPriceDiff > 20
  )?.length;
  const from0to20 = stockData?.filter(
    (i) => i.maxPriceDiff <= 20 && i.maxPriceDiff > 0
  )?.length;
  const less0 = stockData?.filter((i) => i.maxPriceDiff <= 0)?.length;
  return {
    more100,
    form20to100,
    from0to20,
    less0,
  };
};
const composeData = (stockData) => {
  const total = stockData?.length;
  const up = stockData?.filter((i) => i.maxPriceDay > 0)?.length;
  const down = stockData?.filter((i) => i.maxPriceDay === 0)?.length;
  return {
    total,
    up,
    down,
  };
};
const composeConditionData = (
  eachDayData,
  hasCondition1,
  hasCondition2,
  hasCondition3,
  hasCondition4
) => {
  let condition1Data = eachDayData;
  let condition2Data = eachDayData;
  let condition3Data = eachDayData;
  let condition4Data = eachDayData;
  if (hasCondition1) {
    condition1Data = eachDayData?.filter((i) => i.Condition1);
  }
  if (hasCondition2) {
    condition2Data = eachDayData?.filter((i) => i.Condition2);
  }
  if (hasCondition3) {
    condition3Data = eachDayData?.filter((i) => i.Condition3);
  }
  if (hasCondition4) {
    condition4Data = eachDayData?.filter((i) => i.Condition4);
  }
  eachDayData = [
    condition1Data,
    condition2Data,
    condition3Data,
    condition4Data,
  ].reduce((a, b) => a.filter((c) => b.includes(c)));
  const more100 = eachDayData?.filter((i) => i.maxPriceDiff > 100)?.length;
  const form20to100 = eachDayData?.filter(
    (i) => i.maxPriceDiff <= 100 && i.maxPriceDiff > 20
  )?.length;
  const from0to20 = eachDayData?.filter(
    (i) => i.maxPriceDiff <= 20 && i.maxPriceDiff > 0
  )?.length;
  const less0 = eachDayData?.filter((i) => i.maxPriceDiff <= 0)?.length;
  return {
    more100,
    form20to100,
    from0to20,
    less0,
  };
};
export const DataAnalysisCom = () => {
  const [selectDays, setSelectDays] = useState('40');
  const [selectConsAllDays, setSelectConsAllDays] = useState('5');
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
  const [hasCondition1, setHasCondition1] = useState(false);
  const [hasCondition2, setHasCondition2] = useState(false);
  const [hasCondition3, setHasCondition3] = useState(false);
  const [hasCondition4, setHasCondition4] = useState(false);
  const [minOrAverage, setMinOrAverage] = useState('min');
  const [givenPrice, setGivenPrice] = useState(10);
  const [givenCirculation, setGivenCirculation] = useState(10);
  const [selectPriceMargin, setSelectPriceMargin] = useState(4);
  const [selectMinPriceMargin, setSelectMinPriceMargin] = useState(10);
  const [selectMinPriceDays, setSelectMinPriceDays] = useState(30);
  const [caculatePriceBy, setCaculatePriceBy] = useState(false);
  const [option, setOption] = useState<any>({});
  const [baseResult, setBaseResult] = useState<any>({});
  const [conditionResult, setConditionResult] = useState<any>({});
  const [compareData, setCompareData] = useState<any>([]);
  const [from100, setFrom100] = useState<boolean>(false);

  const runAnalysis = () => {
    setIsLoading(true);
    let days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
    if (hasCondition2 && selectMinPriceDays > days) {
      days = selectMinPriceDays;
    }
    get(
      `/api/all_alarm_data?date_str=${caculateDate(
        selectDate,
        days
      )}&end_date_str=${today}&from100=${from100}`,
      { method: 'GET' }
    ).then((res) => {
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
          const lastStock = item?.[item?.length - 1];
          if (selectConsTotal === 'CONS') {
            const { isTrue, start, end } = validateCons(
              item,
              selectConsUpDown,
              selectConsDays
            );
            if (isTrue) {
              if (caculatePriceBy) {
                if (isAverageDistribution(item, selectPriceMargin))
                  lastStock.Condition1 = true;
              } else {
                const startPrice = item[start].finalprice;
                const endPrice = item[end].finalprice;
                if (
                  Math.abs((endPrice - startPrice) / startPrice) <
                  selectPriceMargin / 100
                ) {
                  lastStock.Condition1 = true;
                }
              }
              if (lastStock.finalprice < givenPrice) {
                lastStock.Condition3 = true;
              }
              if (
                lastStock.marketvalue / lastStock.finalprice <
                givenCirculation
              ) {
                lastStock.Condition4 = true;
              }
              selectedStocks.push(lastStock);
            }
          }
          if (selectConsTotal === 'TOTAL') {
            const { isTrue } = validateTotal(
              item,
              selectConsUpDown,
              selectConsDays
            );
            if (isTrue) {
              if (caculatePriceBy) {
                if (isAverageDistribution(item, selectPriceMargin))
                  lastStock.Condition1 = true;
              }
              if (lastStock.finalprice < givenPrice) {
                lastStock.Condition3 = true;
              }
              if (
                lastStock.marketvalue / lastStock.finalprice <
                givenCirculation
              ) {
                lastStock.Condition4 = true;
              }
              selectedStocks.push(lastStock);
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
      setDateArray(dateArr);
      setStockData(stockDataByDate);
      setOption(dapanOption(stockDataByDate));
      setSelectDateTab(dateArr[0]);
      setIsLoading(false);
    });
  };
  useEffect(() => {
    if (stockData && selectDateTab) {
      setData(stockData[selectDateTab]);
      setDataTotal(stockData[selectDateTab]?.length);
      setDataUp(
        stockData[selectDateTab]?.filter((i) => i.maxPriceDay > 0)?.length
      );
      setDataDown(
        stockData[selectDateTab]?.filter((i) => i.maxPriceDay === 0)?.length
      );
      const more100 = stockData[selectDateTab]?.filter(
        (i) => i.maxPriceDiff > 100
      )?.length;
      const form80to100 = stockData[selectDateTab]?.filter(
        (i) => i.maxPriceDiff <= 100 && i.maxPriceDiff > 80
      )?.length;
      const from60to80 = stockData[selectDateTab]?.filter(
        (i) => i.maxPriceDiff <= 80 && i.maxPriceDiff > 60
      )?.length;
      const from40to60 = stockData[selectDateTab]?.filter(
        (i) => i.maxPriceDiff <= 60 && i.maxPriceDiff > 40
      )?.length;
      const from20to40 = stockData[selectDateTab]?.filter(
        (i) => i.maxPriceDiff <= 40 && i.maxPriceDiff > 20
      )?.length;
      setBaseResult({
        more100,
        form80to100,
        from60to80,
        from40to60,
        from20to40,
      });

      const compareData = {};
      const totalData = {};
      dateArray?.forEach((i) => {
        compareData[i] = composeCompareData(stockData[i]);
        totalData[i] = composeData(stockData[i]);
      });
      setCompareData([compareData]);
    }

    if (
      stockData &&
      selectDateTab &&
      (hasCondition1 || hasCondition2 || hasCondition3 || hasCondition4)
    ) {
      let eachDayData = stockData?.[selectDateTab];
      let condition1Data = stockData?.[selectDateTab];
      let condition2Data = stockData?.[selectDateTab];
      let condition3Data = stockData?.[selectDateTab];
      let condition4Data = stockData?.[selectDateTab];
      if (hasCondition1) {
        condition1Data = eachDayData?.filter((i) => i.Condition1);
      }
      if (hasCondition2) {
        condition2Data = eachDayData?.filter((i) => i.Condition2);
      }
      if (hasCondition3) {
        condition3Data = eachDayData?.filter((i) => i.Condition3);
      }
      if (hasCondition4) {
        condition4Data = eachDayData?.filter((i) => i.Condition4);
      }
      eachDayData = [
        condition1Data,
        condition2Data,
        condition3Data,
        condition4Data,
      ].reduce((a, b) => a.filter((c) => b.includes(c)));

      const more100 = eachDayData?.filter((i) => i.maxPriceDiff > 100)?.length;
      const form80to100 = eachDayData?.filter(
        (i) => i.maxPriceDiff <= 100 && i.maxPriceDiff > 80
      )?.length;
      const from60to80 = eachDayData?.filter(
        (i) => i.maxPriceDiff <= 80 && i.maxPriceDiff > 60
      )?.length;
      const from40to60 = eachDayData?.filter(
        (i) => i.maxPriceDiff <= 60 && i.maxPriceDiff > 40
      )?.length;
      const from20to40 = eachDayData?.filter(
        (i) => i.maxPriceDiff <= 40 && i.maxPriceDiff > 20
      )?.length;
      setConditionResult({
        more100,
        form80to100,
        from60to80,
        from40to60,
        from20to40,
      });
      const eachDayDataSymbols = eachDayData?.map((i) => i.symbol);
      stockData[selectDateTab]?.forEach((e) => {
        if (eachDayDataSymbols.includes(e.symbol)) {
          e.chosen = true;
        } else {
          e.chosen = false;
        }
      });
      setData(stockData[selectDateTab]);
      const compareData = {};
      // const totalData = {};
      const conditionData = {};
      dateArray?.forEach((i) => {
        compareData[i] = composeCompareData(stockData[i]);
        // totalData[i] = composeData(stockData[i]);
        conditionData[i] = composeConditionData(
          stockData[i],
          hasCondition1,
          hasCondition2,
          hasCondition3,
          hasCondition4
        );
      });
      setCompareData([compareData, conditionData]);
    }
  }, [
    stockData,
    selectDateTab,
    hasCondition4,
    hasCondition1,
    hasCondition2,
    hasCondition3,
  ]);

  return (
    <div style={{ padding: '2px' }}>
      <div style={{ marginTop: '20px' }}>
        <div style={{ padding: '5px 10px', background: '#f6f6f6' }}>
          <div>
            <Space>
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
              days in
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
              <Switch
                unCheckedChildren="Not100"
                checkedChildren="From100"
                style={{ margin: '0 10px' }}
                // defaultChecked
                checked={from100}
                onChange={setFrom100}
              ></Switch>
            </Space>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Space
              style={{
                padding: '10px',
                boxShadow: '1px 1px 3px #ccc',
                background: `${hasCondition1 ? SELECT_COLOR : '#fff'}`,
              }}
            >
              <Checkbox
                checked={hasCondition1}
                onChange={() => setHasCondition1(!hasCondition1)}
              />
              Condition 1
              <Select
                style={{ width: '80px' }}
                value={selectPriceMargin}
                onChange={(v) => {
                  setSelectPriceMargin(v);
                }}
                size="small"
              >
                {[
                  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
                  19, 20,
                ].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>
              % price margin
              <Switch
                unCheckedChildren="Former"
                checkedChildren="Latter"
                style={{ margin: '0 10px' }}
                // defaultChecked
                checked={caculatePriceBy}
                onChange={setCaculatePriceBy}
              />
            </Space>
            <Space
              style={{
                padding: '10px',
                boxShadow: '1px 1px 3px #ccc',
                marginLeft: '10px',
                background: `${hasCondition2 ? SELECT_COLOR : '#fff'}`,
              }}
            >
              <Checkbox
                disabled //todo Condition2
                checked={hasCondition2}
                onChange={() => setHasCondition2(!hasCondition2)}
              />
              Condition 2
              <Select
                style={{ width: '80px' }}
                value={minOrAverage}
                onChange={(v) => {
                  setMinOrAverage(v);
                }}
                size="small"
              >
                {minOrAverageMap.map((i) => (
                  <Select.Option key={i.key} value={i.key}>
                    {i.value}
                  </Select.Option>
                ))}
              </Select>
              <Select
                style={{ width: '80px' }}
                value={selectMinPriceMargin}
                onChange={(v) => {
                  setSelectMinPriceMargin(v);
                }}
                size="small"
              >
                {[5, 10, 15, 20].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>
              %price in
              <Select
                style={{ width: '80px' }}
                value={selectMinPriceDays}
                onChange={(v) => {
                  setSelectMinPriceDays(v);
                }}
                size="small"
              >
                {[20, 30, 40, 50, 60, 90].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>{' '}
              days
            </Space>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Space
              style={{
                padding: '10px',
                boxShadow: '1px 1px 3px #ccc',
                background: `${hasCondition3 ? SELECT_COLOR : '#fff'}`,
              }}
            >
              <Checkbox
                checked={hasCondition3}
                onChange={() => setHasCondition3(!hasCondition3)}
              />
              Condition 3<span>{'Final Price <'}</span>
              <InputNumber
                min={1}
                max={500}
                value={givenPrice}
                onChange={setGivenPrice}
              />
              元
            </Space>
            <Space
              style={{
                padding: '10px',
                boxShadow: '1px 1px 3px #ccc',
                marginLeft: '10px',
                background: `${hasCondition4 ? SELECT_COLOR : '#fff'}`,
              }}
            >
              <Checkbox
                checked={hasCondition4}
                onChange={() => setHasCondition4(!hasCondition4)}
              />
              Condition 4<span>{'流通股本 <'}</span>
              <InputNumber
                min={1}
                max={500}
                value={givenCirculation}
                onChange={setGivenCirculation}
              />
              亿
            </Space>
            <Space style={{ marginLeft: '10px' }}>
              <Button
                type="primary"
                size="large"
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
            </Space>
          </div>

          {/* <div style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              disabled={!stockData}
              onClick={() => {
                if (selectConsDays && !isNaN(selectConsDays)) {
                  setIsLoading(true);
                  runToCompare();
                }
              }}
            >
              {' '}
              Add To Compare
            </Button>
          </div> */}
        </div>
        <Spin spinning={isLoading} tip="Loading and caculating...">
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={option}
          />
          {dateArray?.length > 0 && (
            <>
              <Table
                columns={dateArray?.map((i) => ({
                  title: i,
                  dataIndex: i,
                  key: i,
                  render: (text, record) => {
                    return (
                      <>
                        <p>
                          <Tag>
                            100+: <b>{text?.more100}</b>
                          </Tag>
                        </p>
                        <p>
                          <Tag>
                            20-100: <b>{text?.form20to100}</b>
                          </Tag>
                        </p>
                        <p>
                          <Tag>
                            0-20: <b>{text?.from0to20}</b>
                          </Tag>
                        </p>
                        <p>
                          <Tag>
                            0-: <b>{text?.less0}</b>
                          </Tag>
                        </p>
                        <p>
                          <Tag>
                            Total:{' '}
                            <b>
                              {Number(text?.more100) +
                                Number(text?.form20to100) +
                                Number(text?.from0to20) +
                                Number(text?.less0)}
                            </b>
                          </Tag>
                        </p>
                        <p>
                          <Tag>
                            Up:{' '}
                            <b>
                              {text?.more100 +
                                text?.form20to100 +
                                text?.from0to20}
                            </b>
                          </Tag>
                        </p>
                        <p>
                          <Tag>
                            Down: <b>{text?.less0}</b>
                          </Tag>
                        </p>
                      </>
                    );
                  },
                }))}
                style={{ width: '100%' }}
                scroll={{ x: true }}
                dataSource={compareData}
                pagination={false}
              />
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
                    <p>
                      <Space>
                        BaseResult:
                        <Tag>100+: {baseResult?.more100}</Tag>
                        <Tag>80-100: {baseResult?.form80to100}</Tag>
                        <Tag>60-80: {baseResult?.from60to80}</Tag>
                        <Tag>40-60: {baseResult?.from40to60}</Tag>
                        <Tag>20-40: {baseResult?.from20to40}</Tag>
                      </Space>
                    </p>
                    <p>
                      <Space>
                        {hasCondition1 && 'Condition1'}{' '}
                        {hasCondition2 && 'Condition2'}
                        {hasCondition3 && 'Condition3'}
                        {hasCondition4 && 'Condition4'}Result:
                        <Tag>100+: {conditionResult?.more100}</Tag>
                        <Tag>80-100: {conditionResult?.form80to100}</Tag>
                        <Tag>60-80: {conditionResult?.from60to80}</Tag>
                        <Tag>40-60: {conditionResult?.from40to60}</Tag>
                        <Tag>20-40: {conditionResult?.from20to40}</Tag>
                      </Space>
                    </p>
                    {/* <p>Up 表示选出来的中 近60天有过上涨的数量</p>
                  <p>Down 表示选出来的中 近60天从未有过上涨的数量</p> */}
                  </Tabs.TabPane>
                ))}
              </Tabs>
            </>
          )}
          {data && (
            <Table
              pagination={{ defaultPageSize: 100 }}
              columns={columns}
              dataSource={data}
              rowClassName={(record: any) => {
                if (record?.chosen) {
                  return 'red-row';
                }
                return 'grey-row';
              }}
            />
          )}
        </Spin>
      </div>
    </div>
  );
};
