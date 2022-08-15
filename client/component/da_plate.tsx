import { useState, useMemo, useEffect } from 'react';
import './alarm.css';
import DATE from './date.json';
import React from 'react';
import {
  Input,
  Select,
  DatePicker,
  Spin,
  Space,
  Switch,
  Button,
  Table,
} from 'antd';
import moment from 'moment';
import { get } from '../lib/request';
import {
  caculateDate,
  isAverageDistribution,
  today,
  validateCons,
  validateTotal,
  workdays,
} from './alarm';
import { groupBy, uniqBy } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import { getBeforeOneDate } from './new_alarm';

export const pullWorkDaysArray = (date, days) => {
  const endIndex = workdays.indexOf(caculateDate(date, 0));
  const workDaysArray = workdays.slice(endIndex - days + 1, endIndex + 1);
  return workDaysArray;
};

const dapanOption = (data) => {
  const xData = data?.map((i) => i?.datestr);
  const labelOption = {
    show: true,
    formatter: (params) => {
      // console.log(params);
      const p = data?.find((i) => i.datestr === params.name);
      const pName = () => {
        if (params.seriesIndex === 0) {
          return p.firstLabel;
        }
        if (params.seriesIndex === 1) {
          return p.secondLabel;
        }
        if (params.seriesIndex === 2) {
          return p.thirdLabel;
        }
      };
      return pName();
    },
    fontSize: 16,
    rich: {
      name: {},
    },
  };
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      data: ['First', 'Second', 'Third'],
    },
    toolbox: {
      show: true,
      orient: 'vertical',
      left: 'right',
      top: 'center',
      feature: {
        mark: { show: true },
        dataView: { show: true, readOnly: false },
        magicType: { show: true, type: ['line', 'bar', 'stack'] },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    xAxis: [
      {
        type: 'category',
        axisTick: { show: false },
        data: xData,
      },
    ],
    yAxis: [
      {
        type: 'value',
      },
    ],
    series: [
      {
        name: 'First',
        type: 'bar',
        barGap: 0,
        label: labelOption,
        emphasis: {
          focus: 'series',
        },
        data: data?.map((i) => i.firstCount),
      },
      {
        name: 'Second',
        type: 'bar',
        label: labelOption,
        emphasis: {
          focus: 'series',
        },
        data: data?.map((i) => i.secondCount),
      },
      {
        name: 'Third',
        type: 'bar',
        label: labelOption,
        emphasis: {
          focus: 'series',
        },
        data: data?.map((i) => i.thirdCount),
      },
    ],
  };
};

export const DAPlatesCom = () => {
  const [selectDays, setSelectDays] = useState('20');
  const [selectConsAllDays, setSelectConsAllDays] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState([]);
  const [dateArray, setDateArray] = useState<any>([]);
  const [showDateArray, setShowDateArray] = useState<any>([]);
  const [selectDateTab, setSelectDateTab] = useState<any>();
  const [stockData, setStockData] = useState<any>();
  const [dataTotal, setDataTotal] = useState<any>();
  const [dataUp, setDataUp] = useState<any>();
  const [dataDown, setDataDown] = useState<any>();
  const [plates, setPlates] = useState<any>([]);

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

  const [selectPriceMargin, setSelectPriceMargin] = useState(4);
  const [caculatePriceBy, setCaculatePriceBy] = useState(false);
  const [option, setOption] = useState<any>({});
  const [baseResult, setBaseResult] = useState<any>({});
  const [conditionResult, setConditionResult] = useState<any>({});
  const [compareData, setCompareData] = useState<any>([]);
  const [from100, setFrom100] = useState<boolean>(false);
  const [conditionData, setConditionData] = useState<any>();
  const [allDayStocks, setAllDayStocks] = useState<any>([]);

  const tableData = useMemo(() => {
    if (stockData) {
      return Object.keys(stockData).map((date) => {
        const stocks = stockData[date];
        let allPlates: any = [];
        stocks?.forEach((stock) => {
          const plates = stock.platename?.split(',');
          allPlates.push(...plates);
        });
        //caculate duplicate in one array//
        const count = allPlates?.reduce((prev, next) => {
          prev[next] = prev[next] + 1 || 1;
          return prev;
        }, {});
        const result = Object.entries(count).sort(
          (x: any, y: any) => y[1] - x[1]
        );
        return {
          datestr: date,
          firstCount: result[0]?.[1],
          secondCount: result[1]?.[1],
          thirdCount: result[2]?.[1],
          firstLabel: result[0]?.[0],
          secondLabel: result[1]?.[0],
          thirdLabel: result[2]?.[0],
        };
      });
    }
    return [];
  }, [stockData]);

  const runAnalysis = () => {
    setIsLoading(true);
    let days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
    const dateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
    const showDateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
    get(
      `/api/all_alarm_data_with_plates?date_str=${caculateDate(
        selectDate,
        days
      )}&end_date_str=${today}&from100=${from100}`,
      { method: 'GET' }
    ).then((res) => {
      const stockDataByDate = {};
      dateArr?.forEach((date) => {
        const allStockDataByDate = res?.filter(
          (e) =>
            e?.datestr <= caculateDate(date, 0) &&
            e?.datestr > caculateDate(date, parseInt(selectConsAllDays, 10))
        );
        const data = groupBy(allStockDataByDate, 'symbol');
        let selectedStocks: any = [];
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
                  selectedStocks.push(lastStock);
              } else {
                const startPrice = item[start].finalprice;
                const endPrice = item[end].finalprice;
                if (
                  Math.abs((endPrice - startPrice) / startPrice) <
                  selectPriceMargin / 100
                ) {
                  selectedStocks.push(lastStock);
                }
              }
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
                  selectedStocks.push(lastStock);
              } else {
                selectedStocks.push(lastStock);
              }
            }
          }
        });
        stockDataByDate[date] = selectedStocks;
        //allSelectStocks.push(...selectedStocks);
      });
      let tableD: any = [];
      if (stockDataByDate) {
        tableD = Object.keys(stockDataByDate).map((date) => {
          const stocks = stockDataByDate[date];
          let allPlates: any = [];
          stocks?.forEach((stock) => {
            const plates = stock.platename?.split(',');
            allPlates.push(...plates);
          });
          //caculate duplicate in one array//
          const count = allPlates?.reduce((prev, next) => {
            prev[next] = prev[next] + 1 || 1;
            return prev;
          }, {});
          const result = Object.entries(count).sort(
            (x: any, y: any) => y[1] - x[1]
          );

          return {
            datestr: date,
            firstCount: result[0]?.[1],
            secondCount: result[1]?.[1],
            thirdCount: result[2]?.[1],
            firstLabel: result[0]?.[0],
            secondLabel: result[1]?.[0],
            thirdLabel: result[2]?.[0],
          };
        });
      }
      setDateArray(dateArr);
      setShowDateArray(showDateArr);
      setStockData(stockDataByDate);
      setOption(dapanOption(tableD));
      // setSelectDateTab(showDateArr[0]);
      setIsLoading(false);
    });
  };
  const dateArrWithRed = useMemo(() => {
    if (showDateArray?.length > 0) {
      const newDates = showDateArray;
      const datesIsFirstWorkday = {};
      newDates?.forEach((i, k) => {
        if (DATE.workday.indexOf(getBeforeOneDate(i, 1)) === -1) {
          datesIsFirstWorkday[i] = true;
        } else {
          datesIsFirstWorkday[i] = false;
        }
      });
      return datesIsFirstWorkday;
    }
    return [];
  }, [showDateArray]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'datestr',
      key: 'datestr',
    },
    {
      title: 'First',
      dataIndex: 'first',
      key: 'first',
      render: (v, i) => (
        <>
          {i.firstLabel}:{i.firstCount}
        </>
      ),
    },
    {
      title: 'Second',
      dataIndex: 'second',
      key: 'second',
      render: (v, i) => (
        <>
          {i.secondLabel}:{i.secondCount}
        </>
      ),
    },
    {
      title: 'Third',
      dataIndex: 'third',
      key: 'third',
      render: (v, i) => (
        <>
          {i.thirdLabel}:{i.thirdCount}
        </>
      ),
    },
  ];

  // useEffect(() => {
  //   if (stockData && selectDateTab) {
  //     stockData[selectDateTab]?.length > 0 &&
  //       get(
  //         `/api/get_stock_plate?ids=${stockData[selectDateTab]
  //           ?.map((i) => `'${i.symbol}'`)
  //           ?.join(',')}`
  //       ).then((res) => {
  //         const resbySymbols = res.symbols;
  //         const resbyPlates = res.plates;
  //         setPlates(resbyPlates);
  //       });
  //     setData(stockData[selectDateTab]);
  //     setConditionData(
  //       stockData[selectDateTab]?.filter((i) => i.chosen === true)
  //     );

  //     const allDaysStocksArray: any = [];
  //     Object.keys(allDayStocks)?.forEach((a) => {
  //       allDaysStocksArray.push(...allDayStocks[a]);
  //     });
  //     setAllDayStocks(uniqBy(allDaysStocksArray, 'symbol'));
  //     setCompareData([compareData, conditionData]);
  //   }
  // }, [stockData, hasCondition1]);

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
                {[5, 10, 20, 30, 40, 50, 60].map((i) => (
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
        </div>
        <Button type="primary" onClick={() => runAnalysis()}>
          Run
        </Button>
        <Spin spinning={isLoading} tip="Loading and caculating...">
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={option}
          />
          <Table columns={columns} dataSource={tableData} />
        </Spin>
      </div>
    </div>
  );
};
