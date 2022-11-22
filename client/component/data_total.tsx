import { useCallback, useState, useMemo, useEffect } from 'react';
import './alarm.css';
import DATE from './date.json';
import React from 'react';
import {
  Button,
  Tooltip,
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
  Modal,
  Typography,
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
import { groupBy, uniq, uniqBy } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import {
  caculateMaxPrice,
  caculateMinPrice,
  caculatePriceData,
} from './myFocus';
import { composedQuery, getBeforeOneDate, SELECT_COLOR } from './new_alarm';
import FormItem from 'antd/lib/form/FormItem';

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
      data: Object.keys(data)?.map((i) => {
        if (DATE.workday.indexOf(getBeforeOneDate(i, 1)) === -1) {
          return {
            value: i,
            textStyle: {
              color: 'red',
            },
          };
        } else {
          return i;
        }
      }),
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
  return workDaysArray;
};

export const TotalDataCom = (props) => {
  const { isDR } = props;
  const [selectDays, setSelectDays] = useState('80');
  const [selectConsAllDays, setSelectConsAllDays] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [dateArray, setDateArray] = useState<any>([]);
  const [showDateArray, setShowDateArray] = useState<any>([]);

  const [from100, setFrom100] = useState('400s');
  const [selectConsUpDown, setSelectConsUpDown] = useState('up');
  const [selectConsDays, setSelectConsDays] = useState(5);
  const [selectConsTotal, setSelectConsTotal] = useState('CONS');
  const [option, setOption] = useState({});
  const [dr100option, setDr100option] = useState({});
  const [dr400option, setDr400option] = useState({});
  const [option100, setOption100] = useState({});
  const curDate = new Date();
  const year = curDate.getFullYear();
  const month = curDate.getMonth() + 1;
  const day = curDate.getDate();
  const dateFormat = 'YYYY-MM-DD';

  const [selectDate, setSelectDate] = useState(
    moment(`${year}-${month}-${day}`).format(dateFormat)
  );

  const runAnalysis = () => {
    setIsLoading(true);
    let days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
    const fromOld100 = from100 === '400s' ? false : true;
    const isDR = !!from100.match('DR');
    const dateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
    const showDateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
    const realFrom = isDR ? from100.slice(3) : fromOld100;

    get(
      `/api/all_alarm_data${isDR ? '_dr' : ''}?date_str=${caculateDate(
        selectDate,
        days
      )}&end_date_str=${today}&from100=${realFrom}`,
      { method: 'GET' }
    ).then((res) => {
      const stockDataByDate = {};
      //const allSelectStocks: any = [];
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
        //allSelectStocks.push(...selectedStocks);
      });
      setDateArray(dateArr);
      setShowDateArray(showDateArr);
      ['400s', '100w', 'DR_100s', 'DR_400s', 'DR_100w'];
      if (from100 === '400s') {
        setOption(dapanOption(stockDataByDate));
      }
      if (from100 === '100w') {
        setOption100(dapanOption(stockDataByDate));
      }
      if (from100 === 'DR_400s') {
        setDr400option(dapanOption(stockDataByDate));
      }
      if (from100 === 'DR_100w') {
        setDr100option(dapanOption(stockDataByDate));
      }
      setIsLoading(false);
    });

    // get(
    //   `/api/all_alarm_data?date_str=${caculateDate(
    //     selectDate,
    //     days
    //   )}&end_date_str=${today}&from100=true`,
    //   { method: 'GET' }
    // ).then((res) => {
    //   const stockDataByDate = {};
    //   //const allSelectStocks: any = [];
    //   dateArr?.forEach((date) => {
    //     const allStockDataByDate = res?.filter(
    //       (e) =>
    //         e?.datestr <= caculateDate(date, 0) &&
    //         e?.datestr > caculateDate(date, parseInt(selectConsAllDays, 10))
    //     );
    //     const data = groupBy(allStockDataByDate, 'symbol');
    //     let selectedStocks: any = [];
    //     Object.keys(data).forEach((k) => {
    //       const item = data[k];
    //       const lastStock = item?.[item?.length - 1];
    //       if (selectConsTotal === 'CONS') {
    //         const { isTrue, start, end } = validateCons(
    //           item,
    //           selectConsUpDown,
    //           selectConsDays
    //         );
    //         if (isTrue) {
    //           selectedStocks.push(lastStock);
    //         }
    //       }
    //       if (selectConsTotal === 'TOTAL') {
    //         const { isTrue } = validateTotal(
    //           item,
    //           selectConsUpDown,
    //           selectConsDays
    //         );
    //         if (isTrue) {
    //           selectedStocks.push(lastStock);
    //         }
    //       }
    //     });
    //     const selectSymbols = selectedStocks?.map((i) => i.symbol);
    //     const priceSymbolData = res?.filter((i) =>
    //       selectSymbols?.includes(i.symbol)
    //     );
    //     stockDataByDate[date] = caculatePriceData(
    //       selectedStocks,
    //       priceSymbolData
    //     );
    //     //allSelectStocks.push(...selectedStocks);
    //   });
    //   setDateArray(dateArr);
    //   setShowDateArray(showDateArr);
    //   setOption100(dapanOption(stockDataByDate));
    //   setIsLoading(false);
    // });

    // get(
    //   `/api/all_alarm_data_dr?date_str=${caculateDate(
    //     selectDate,
    //     days
    //   )}&end_date_str=${today}&from100=400s`,
    //   { method: 'GET' }
    // ).then((res) => {
    //   const stockDataByDate = {};
    //   //const allSelectStocks: any = [];
    //   dateArr?.forEach((date) => {
    //     const allStockDataByDate = res?.filter(
    //       (e) =>
    //         e?.datestr <= caculateDate(date, 0) &&
    //         e?.datestr > caculateDate(date, parseInt(selectConsAllDays, 10))
    //     );
    //     const data = groupBy(allStockDataByDate, 'symbol');
    //     let selectedStocks: any = [];
    //     Object.keys(data).forEach((k) => {
    //       const item = data[k];
    //       const lastStock = item?.[item?.length - 1];
    //       if (selectConsTotal === 'CONS') {
    //         const { isTrue, start, end } = validateCons(
    //           item,
    //           selectConsUpDown,
    //           selectConsDays
    //         );
    //         if (isTrue) {
    //           selectedStocks.push(lastStock);
    //         }
    //       }
    //       if (selectConsTotal === 'TOTAL') {
    //         const { isTrue } = validateTotal(
    //           item,
    //           selectConsUpDown,
    //           selectConsDays
    //         );
    //         if (isTrue) {
    //           selectedStocks.push(lastStock);
    //         }
    //       }
    //     });
    //     const selectSymbols = selectedStocks?.map((i) => i.symbol);
    //     const priceSymbolData = res?.filter((i) =>
    //       selectSymbols?.includes(i.symbol)
    //     );
    //     stockDataByDate[date] = caculatePriceData(
    //       selectedStocks,
    //       priceSymbolData
    //     );
    //     //allSelectStocks.push(...selectedStocks);
    //   });
    //   setDateArray(dateArr);
    //   setShowDateArray(showDateArr);

    //   setDr400option(dapanOption(stockDataByDate));

    //   setIsLoading(false);
    // });

    // get(
    //   `/api/all_alarm_data_dr?date_str=${caculateDate(
    //     selectDate,
    //     days
    //   )}&end_date_str=${today}&from100=100w`,
    //   { method: 'GET' }
    // ).then((res) => {
    //   const stockDataByDate = {};
    //   //const allSelectStocks: any = [];
    //   dateArr?.forEach((date) => {
    //     const allStockDataByDate = res?.filter(
    //       (e) =>
    //         e?.datestr <= caculateDate(date, 0) &&
    //         e?.datestr > caculateDate(date, parseInt(selectConsAllDays, 10))
    //     );
    //     const data = groupBy(allStockDataByDate, 'symbol');
    //     let selectedStocks: any = [];
    //     Object.keys(data).forEach((k) => {
    //       const item = data[k];
    //       const lastStock = item?.[item?.length - 1];
    //       if (selectConsTotal === 'CONS') {
    //         const { isTrue, start, end } = validateCons(
    //           item,
    //           selectConsUpDown,
    //           selectConsDays
    //         );
    //         if (isTrue) {
    //           selectedStocks.push(lastStock);
    //         }
    //       }
    //       if (selectConsTotal === 'TOTAL') {
    //         const { isTrue } = validateTotal(
    //           item,
    //           selectConsUpDown,
    //           selectConsDays
    //         );
    //         if (isTrue) {
    //           selectedStocks.push(lastStock);
    //         }
    //       }
    //     });
    //     const selectSymbols = selectedStocks?.map((i) => i.symbol);
    //     const priceSymbolData = res?.filter((i) =>
    //       selectSymbols?.includes(i.symbol)
    //     );
    //     stockDataByDate[date] = caculatePriceData(
    //       selectedStocks,
    //       priceSymbolData
    //     );
    //     //allSelectStocks.push(...selectedStocks);
    //   });
    //   setDateArray(dateArr);
    //   setShowDateArray(showDateArr);

    //   setDr100option(dapanOption(stockDataByDate));

    //   setIsLoading(false);
    // });
  };

  const [oneStockConsAllDays, setOneStockConsAllDays] = useState('5');
  const [oneStockSelectConsDays, setOneStockSelectConsDays] = useState('5');
  const [oneStockSelectDays, setOneStockSelectDays] = useState('60');
  const [oneStockData, setOneStockData] = useState({});
  const [oneStockDate, setOneStockDate] = useState(today);
  const runOneAnalysis = () => {
    let days =
      parseInt(oneStockSelectDays, 10) + parseInt(oneStockConsAllDays, 10);
    const dateArr = pullWorkDaysArray(
      oneStockDate,
      parseInt(oneStockSelectDays, 10)
    );
    get(
      `/api/all_alarm_data${isDR ? '_dr' : ''}?date_str=${caculateDate(
        oneStockDate,
        days
      )}&end_date_str=${today}&from100=${from100}`,
      { method: 'GET' }
    ).then((res) => {
      const stockDataByDate = {};
      dateArr?.forEach((date) => {
        const allStockDataByDate = res?.filter(
          (e) =>
            e?.datestr <= caculateDate(date, 0) &&
            e?.datestr > caculateDate(date, parseInt(oneStockConsAllDays, 10))
        );
        const data = groupBy(allStockDataByDate, 'symbol');
        let selectedStocks: any = [];
        Object.keys(data).forEach((k) => {
          const item = data[k];
          const lastStock = item?.[item?.length - 1];
          if (selectConsTotal === 'CONS') {
            const { isTrue, start, end } = validateCons(
              item,
              'up',
              oneStockSelectConsDays
            );
            if (isTrue) {
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
              selectedStocks.push(lastStock);
            }
          }
        });
        stockDataByDate[date] = selectedStocks;
      });
      setOneStockData(stockDataByDate);
    });

    // ============= ************ use backend to calulate ********** =====================
    // const advancedSearchParams = [
    //   { key: 'dateStr', value: caculateDate(selectDate, days) },
    //   { key: 'endDateStr', value: today },
    //   { key: 'selectDate', value: selectDate },
    //   { key: 'selectDays', value: selectDays },
    //   { key: 'selectConsTotal', value: selectConsTotal },
    //   { key: 'selectConsUpDown', value: selectConsUpDown },
    //   { key: 'selectConsDays', value: selectConsDays },
    //   { key: 'selectConsAllDays', value: selectConsAllDays },
    //   { key: 'hasCondition1', value: hasCondition1 },
    //   { key: 'selectPriceMargin', value: selectPriceMargin },
    //   { key: 'caculatePriceBy', value: caculatePriceBy },
    //   { key: 'hasCondition2', value: hasCondition2 },
    //   { key: 'selectMinPriceMargin', value: selectMinPriceMargin },
    //   { key: 'selectMinPriceDays', value: selectMinPriceDays },
    //   { key: 'hasCondition3', value: hasCondition3 },
    //   { key: 'hasCondition4', value: hasCondition4 },
    //   { key: 'selectHorPriceMargin', value: selectHorPriceMargin },
    //   { key: 'selectHorPriceDays', value: selectHorPriceDays },
    //   { key: 'hasCondition5', value: hasCondition5 },
    //   { key: 'hasCondition6', value: hasCondition6 },
    //   { key: 'givenPrice', value: givenPrice },
    //   { key: 'givenMinPrice', value: givenMinPrice },
    //   { key: 'givenCirculation', value: givenCirculation },
    //   { key: 'from100', value: from100 },
    //   { key: 'selectTimeWindow', value: selectTimeWindow },
    // ];
    // get(composedQuery(`/api/da_data`, advancedSearchParams), {
    //   method: 'GET',
    // }).then((res) => {
    //   setDateArray(dateArr);
    //   setShowDateArray(showDateArr);
    //   setStockData(res);
    //   setOption(dapanOption(res));
    //   setSelectDateTab(showDateArr[0]);
    //   setIsLoading(false);
    // });
    // ============= ************ use backend to calulate ********** =====================
  };
  const oneStockChartOption = useMemo(() => {
    const yData = Object.keys(oneStockData)?.map(
      (i) => oneStockData[i]?.length
    );
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
        data: Object.keys(oneStockData)?.map((i, k) => {
          if (k === Object.keys(oneStockData)?.length / 2) {
            return {
              value: i,
              textStyle: {
                color: 'red',
              },
            };
          } else {
            return i;
          }
        }),
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
  }, [oneStockData]);
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
                {[60, 80, 100, 120].map((i) => (
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
              <Select
                style={{ width: '80px' }}
                value={from100}
                onChange={(v) => {
                  setFrom100(v);
                }}
                size="small"
              >
                {['400s', '100w', 'DR_100s', 'DR_400s', 'DR_100w'].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>
            </Space>
            <Button
              type="primary"
              onClick={() => {
                runAnalysis();
              }}
            >
              RUN
            </Button>
          </div>
        </div>
        <Spin spinning={isLoading} tip="Loading and caculating...">
          400s:
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={option}
          />
          100w:
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={option100}
          />
          DR 400s:
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={dr400option}
          />
          DR 100w:
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={dr100option}
          />
        </Spin>
      </div>
    </div>
  );
};
