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

export const filterByCondition25 = (
  priceData,
  stocks,
  price,
  hasCondition2,
  hasCondition5
) => {
  const newStocks = stocks?.map((item) => {
    const pData = priceData?.filter((i) => i.symbol === item.symbol);

    if (hasCondition2 && pData?.length > 0) {
      const { minPrice } = caculateMinPrice(pData);
      let curPrice = item?.finalprice;
      if (!curPrice) {
        curPrice = priceData[priceData?.length - 2]?.finalprice;
      }
      if ((curPrice - minPrice) / minPrice < price / 100) {
        item.Condition2 = true;
      }
    }
    if (hasCondition5 && pData?.length > 0) {
      const { minPrice } = caculateMinPrice(pData);
      const { maxPrice } = caculateMaxPrice(pData);
      if ((maxPrice - minPrice) / minPrice < price / 100) {
        item.Condition5 = true;
      }
    }
    return { ...item };
  });
  return newStocks;
};

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
  return workDaysArray;
};

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
  hasCondition6,
  hasCondition4,
  hasCondition5
) => {
  let condition1Data = eachDayData;
  let condition2Data = eachDayData;
  let condition3Data = eachDayData;
  let condition4Data = eachDayData;
  let condition5Data = eachDayData;
  let condition6Data = eachDayData;
  if (hasCondition1) {
    condition1Data = eachDayData?.filter((i) => i.Condition1);
  }
  if (hasCondition2) {
    condition2Data = eachDayData?.filter((i) => i.Condition2);
  }
  if (hasCondition3) {
    condition3Data = eachDayData?.filter((i) => i.Condition3);
  }
  if (hasCondition6) {
    condition6Data = eachDayData?.filter((i) => i.Condition6);
  }
  if (hasCondition4) {
    condition4Data = eachDayData?.filter((i) => i.Condition4);
  }
  if (hasCondition5) {
    condition5Data = eachDayData?.filter((i) => i.Condition5);
  }
  eachDayData = [
    condition1Data,
    condition2Data,
    condition3Data,
    condition6Data,
    condition4Data,
    condition5Data,
  ].reduce((a, b) => a?.filter((c) => b.includes(c)));
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
const removeBeforeData = (stockData, selectDateTab, dateArray, beforeDays) => {
  const beforeDaySymbols: any = [];
  const curDaySymbols = stockData[selectDateTab];
  const symbolDayMap = {};
  dateArray?.forEach((i) => {
    if (i < selectDateTab && i > caculateDate(selectDateTab, beforeDays)) {
      beforeDaySymbols.push(...stockData[i]);
    }
  });
  const bMap = groupBy(beforeDaySymbols, 'symbol');
  const beforeSymbols = uniq(beforeDaySymbols?.map((i) => i.symbol));
  const curDay = curDaySymbols?.map((i) => {
    if (beforeSymbols?.includes(i.symbol)) {
      i.beforeDays = bMap[i.symbol]?.map((i) => i.datestr).join(', ');
      i.isNotFirst = true;
    } else {
      i.isNotFirst = false;
    }
    //如果之前只出现过一次 也认为是第一次出现。
    if (bMap[i.symbol]?.map((i) => i.datestr)?.length === 1) {
      i.isNotFirst = false;
    }
    return i;
  });
  return curDay;
};

export const DataAnalysisCom = (props) => {
  const { isDR } = props;
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
  const [hasCondition2, setHasCondition2] = useState(false);
  const [hasCondition3, setHasCondition3] = useState(false);
  const [hasCondition6, setHasCondition6] = useState(false);
  const [hasCondition4, setHasCondition4] = useState(false);
  const [hasCondition5, setHasCondition5] = useState(false);
  const [givenPrice, setGivenPrice] = useState(10);
  const [givenMinPrice, setGivenMinPrice] = useState(10);
  const [givenCirculation, setGivenCirculation] = useState(10);
  const [givenMinCirculation, setGivenMinCirculation] = useState(0);
  const [selectPriceMargin, setSelectPriceMargin] = useState(4);
  const [selectMinPriceMargin, setSelectMinPriceMargin] = useState(10);
  const [selectMinPriceDays, setSelectMinPriceDays] = useState(30);
  const [selectHorPriceMargin, setSelectHorPriceMargin] = useState(10);
  const [selectHorPriceDays, setSelectHorPriceDays] = useState(30);
  const [caculatePriceBy, setCaculatePriceBy] = useState(false);
  const [option, setOption] = useState<any>({});
  const [baseResult, setBaseResult] = useState<any>({});
  const [conditionResult, setConditionResult] = useState<any>({});
  const [compareData, setCompareData] = useState<any>([]);
  const [from100, setFrom100] = useState<any>(isDR ? '100s' : false);
  const [selectTimeWindow, setSelectTimeWindow] = useState<any>(60);
  const [conditionData, setConditionData] = useState<any>();
  const [allDayStocks, setAllDayStocks] = useState<any>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [inputStock, setInputStock] = useState('');
  const [beforeDays, setBeforeDays] = useState('30');
  const [isBeforeDatesModalVisible, setIsBeforeDatesModalVisible] =
    useState(false);

  const isSetCondition = useMemo(() => {
    return (
      hasCondition1 ||
      hasCondition2 ||
      hasCondition3 ||
      hasCondition4 ||
      hasCondition5 ||
      hasCondition6
    );
  }, [
    hasCondition1,
    hasCondition2,
    hasCondition3,
    hasCondition4,
    hasCondition5,
    hasCondition6,
  ]);

  const runAnalysis = () => {
    setIsLoading(true);
    let days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
    if (hasCondition2 && selectMinPriceDays > days) {
      days = selectMinPriceDays;
    }
    if (hasCondition2 && selectHorPriceDays > days) {
      days = selectHorPriceDays + selectConsDays;
    }
    // +30 to remove duplicated
    days = days + +beforeDays;
    const dateArr = pullWorkDaysArray(
      selectDate,
      parseInt(selectDays, 10) + +beforeDays
    );
    const showDateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
    get(
      `/api/all_alarm_data${isDR ? '_dr' : ''}?date_str=${caculateDate(
        selectDate,
        days
      )}&end_date_str=${today}&from100=${from100}&stock=${inputStock}`,
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
              if (lastStock.finalprice > givenMinPrice) {
                lastStock.Condition6 = true;
              }
              if (
                givenMinCirculation
                  ? lastStock.marketvalue / lastStock.finalprice <
                      givenCirculation &&
                    lastStock.marketvalue / lastStock.finalprice <
                      givenMinCirculation
                  : lastStock.marketvalue / lastStock.finalprice <
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
              if (lastStock.finalprice > givenMinPrice) {
                lastStock.Condition6 = true;
              }
              if (
                givenMinCirculation
                  ? lastStock.marketvalue / lastStock.finalprice <
                      givenCirculation &&
                    lastStock.marketvalue / lastStock.finalprice <
                      givenMinCirculation
                  : lastStock.marketvalue / lastStock.finalprice <
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

        if (hasCondition2 && selectedStocks?.length > 0) {
          const priceData = priceSymbolData?.filter(
            (i) =>
              i?.datestr > caculateDate(selectDate, selectMinPriceDays) &&
              i?.datestr <= selectDate
          );
          selectedStocks = filterByCondition25(
            priceData,
            selectedStocks,
            selectMinPriceMargin,
            hasCondition2,
            hasCondition5
          );
        }

        if (hasCondition5 && selectedStocks?.length > 0) {
          const priceData = priceSymbolData?.filter(
            (i) =>
              i?.datestr > caculateDate(selectDate, selectHorPriceDays) &&
              i?.datestr <= caculateDate(selectDate, selectConsDays)
          );
          selectedStocks = filterByCondition25(
            priceData,
            selectedStocks,
            selectMinPriceMargin,
            hasCondition2,
            hasCondition5
          );
        }
        stockDataByDate[date] = caculatePriceData(
          selectedStocks,
          priceSymbolData,
          selectTimeWindow
        );
        //allSelectStocks.push(...selectedStocks);
      });
      setDateArray(dateArr);
      setShowDateArray(showDateArr);
      setStockData(stockDataByDate);
      setOption(dapanOption(stockDataByDate));
      setSelectDateTab(showDateArr[0]);
      setIsLoading(false);
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

  const [oneStockConsAllDays, setOneStockConsAllDays] = useState('5');
  const [oneStockSelectConsDays, setOneStockSelectConsDays] = useState('5');
  const [oneStockSelectDays, setOneStockSelectDays] = useState('30');
  const [oneStockData, setOneStockData] = useState({});
  const runOneAnalysis = () => {
    let days =
      parseInt(oneStockSelectDays, 10) + parseInt(oneStockConsAllDays, 10);
    const dateArr = pullWorkDaysArray(today, parseInt(oneStockSelectDays, 10));
    get(
      `/api/all_alarm_data${isDR ? '_dr' : ''}?date_str=${caculateDate(
        today,
        days
      )}&end_date_str=${today}&from100=${from100}&stock=${inputStock}`,
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
        data: Object.keys(oneStockData),
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

  useEffect(() => {
    const isDRPath = location.pathname === '/da_dr';
    setFrom100(isDRPath ? '100s' : false);
  }, [location.pathname]);

  useEffect(() => {
    if (stockData && selectDateTab) {
      stockData[selectDateTab] = removeBeforeData(
        stockData,
        selectDateTab,
        dateArray,
        beforeDays
      );
    }
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
      showDateArray?.forEach((i) => {
        compareData[i] = composeCompareData(
          removeBeforeData(stockData, i, dateArray, beforeDays)
        );
        totalData[i] = composeData(
          removeBeforeData(stockData, i, dateArray, beforeDays)
        );
      });
      setCompareData([compareData]);
    }

    if (stockData && selectDateTab && isSetCondition) {
      let eachDayData = stockData?.[selectDateTab];
      let condition1Data = stockData?.[selectDateTab];
      let condition2Data = stockData?.[selectDateTab];
      let condition3Data = stockData?.[selectDateTab];
      let condition6Data = stockData?.[selectDateTab];
      let condition4Data = stockData?.[selectDateTab];
      let condition5Data = stockData?.[selectDateTab];
      if (hasCondition1) {
        condition1Data = eachDayData?.filter((i) => i.Condition1);
      }
      if (hasCondition2) {
        condition2Data = eachDayData?.filter((i) => i.Condition2);
      }
      if (hasCondition3) {
        condition3Data = eachDayData?.filter((i) => i.Condition3);
      }
      if (hasCondition6) {
        condition6Data = eachDayData?.filter((i) => i.Condition6);
      }
      if (hasCondition4) {
        condition4Data = eachDayData?.filter((i) => i.Condition4);
      }
      if (hasCondition5) {
        condition5Data = eachDayData?.filter((i) => i.Condition5);
      }
      eachDayData = [
        condition1Data,
        condition2Data,
        condition3Data,
        condition4Data,
        condition5Data,
        condition6Data,
      ].reduce((a, b) => a?.filter((c) => b.includes(c)));

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
      stockData[selectDateTab]?.length > 0 &&
        get(
          `/api/get_stock_plate?ids=${stockData[selectDateTab]
            ?.map((i) => `'${i.symbol}'`)
            ?.join(',')}`
        ).then((res) => {
          const resbySymbols = res.symbols;
          const resbyPlates = res.plates;
          setPlates(resbyPlates);
        });
      setData(stockData[selectDateTab]);
      setConditionData(
        stockData[selectDateTab]?.filter((i) => i.chosen === true)
      );
      const compareData = {};
      const conditionData = {};
      const allDayStocks = {};
      showDateArray?.forEach((i) => {
        const removeBefore = removeBeforeData(
          stockData,
          i,
          dateArray,
          beforeDays
        );
        compareData[i] = composeCompareData(removeBefore);
        allDayStocks[i] = removeBefore?.filter((i) => {
          let a = true;
          if (hasCondition1) {
            a = a && i.Condition1;
          }
          if (hasCondition2) {
            a = a && i.Condition2;
          }
          if (hasCondition3) {
            a = a && i.Condition3;
          }
          if (hasCondition4) {
            a = a && i.Condition4;
          }
          if (hasCondition5) {
            a = a && i.Condition5;
          }
          if (hasCondition6) {
            a = a && i.Condition6;
          }
          return a;
        });
        conditionData[i] = composeConditionData(
          removeBefore,
          hasCondition1,
          hasCondition2,
          hasCondition3,
          hasCondition6,
          hasCondition4,
          hasCondition5
        );
      });
      const allDaysStocksArray: any = [];
      Object.keys(allDayStocks)?.forEach((a) => {
        allDaysStocksArray.push(...allDayStocks[a]);
      });
      setAllDayStocks(uniqBy(allDaysStocksArray, 'symbol'));
      setCompareData([compareData, conditionData]);
    }
  }, [
    stockData,
    selectDateTab,
    hasCondition4,
    hasCondition1,
    hasCondition2,
    hasCondition3,
    hasCondition6,
    hasCondition5,
    beforeDays,
  ]);

  const addDAFocus = useCallback((record, isAdded) => {
    fetch(
      `/api/add_da_focus?stock_id=${record.symbol}&updated_at=${caculateDate(
        today,
        0
      )}&datestr=${record.datestr}&added=${isAdded}`,
      { method: 'GET' }
    ).then((res) => res.json());
  }, []);

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
              href={`https://quote.eastmoney.com/${text}.html`}
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
    {
      title: 'BeforeDates',
      width: '20%',
      dataIndex: 'beforeDays',
      key: 'beforeDays',
      render: (text, record) => (
        <Space size="middle">
          <Button
            className="button"
            onClick={() => {
              setIsBeforeDatesModalVisible(true);
              setInputStock(record?.symbol);
            }}
          >
            Check Before Dates
          </Button>
        </Space>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (text, record) => (
        <Space size="middle">
          <Button className="button" onClick={() => addDAFocus(record, 0)}>
            Add Focus
          </Button>
          <Button className="button" onClick={() => addDAFocus(record, 1)}>
            加到自选股
          </Button>
        </Space>
      ),
    },
  ];

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
              {isDR ? (
                <Select
                  style={{ width: '80px' }}
                  value={from100}
                  onChange={(v) => {
                    setFrom100(v);
                  }}
                  size="small"
                >
                  {['100s', '400s', '100w'].map((i) => (
                    <Select.Option key={i} value={i}>
                      {i}
                    </Select.Option>
                  ))}
                </Select>
              ) : (
                <Switch
                  unCheckedChildren="Not100"
                  checkedChildren="From100"
                  style={{ margin: '0 10px' }}
                  // defaultChecked
                  checked={from100}
                  onChange={setFrom100}
                ></Switch>
              )}
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
                checked={hasCondition2}
                onChange={() => setHasCondition2(!hasCondition2)}
              />
              Condition 2{'MinPrice <'}
              <Select
                style={{ width: '80px' }}
                value={selectMinPriceMargin}
                onChange={(v) => {
                  setSelectMinPriceMargin(v);
                }}
                size="small"
              >
                {[5, 10, 20, 30, 40, 50].map((i) => (
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
                {[5, 10, 20, 30, 40, 50, 60, 90, 120].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>{' '}
              days
            </Space>
            <Space
              style={{
                padding: '10px',
                boxShadow: '1px 1px 3px #ccc',
                marginLeft: '10px',
                background: `${hasCondition5 ? SELECT_COLOR : '#fff'}`,
              }}
            >
              <Checkbox
                checked={hasCondition5}
                onChange={() => setHasCondition5(!hasCondition5)}
              />
              Condition 5{'横盘<'}
              <Select
                style={{ width: '80px' }}
                value={selectHorPriceMargin}
                onChange={(v) => {
                  setSelectHorPriceMargin(v);
                }}
                size="small"
              >
                {[5, 10, 15, 20].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>
              % in
              <Select
                style={{ width: '80px' }}
                value={selectHorPriceDays}
                onChange={(v) => {
                  setSelectHorPriceDays(v);
                }}
                size="small"
              >
                {[5, 10, 20, 30, 40, 50, 60, 90].map((i) => (
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
                background: `${hasCondition6 ? SELECT_COLOR : '#fff'}`,
              }}
            >
              <Checkbox
                checked={hasCondition6}
                onChange={() => setHasCondition6(!hasCondition6)}
              />
              Condition 6
              <InputNumber
                min={1}
                max={500}
                value={givenMinPrice}
                onChange={setGivenMinPrice}
              />
              元<span>{'< Final Price'}</span>
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
              Condition 4
              <InputNumber
                min={0}
                max={500}
                value={givenMinCirculation}
                onChange={setGivenMinCirculation}
              />
              亿<span>{'<流通股本<'}</span>
              <InputNumber
                min={1}
                max={500}
                value={givenCirculation}
                onChange={setGivenCirculation}
              />
              亿
            </Space>
            <Space>
              {'时间窗口'}
              <Select
                style={{ width: '80px' }}
                value={selectTimeWindow}
                onChange={(v) => {
                  setSelectTimeWindow(v);
                }}
                size="small"
              >
                {[30, 40, 50, 60, '不限'].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>
              {'之前多少天出现过'}
              <Select
                style={{ width: '80px' }}
                value={beforeDays}
                onChange={(v) => {
                  setBeforeDays(v);
                }}
                size="small"
              >
                {[20, 30, 40, 50, 60, 80].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>
            </Space>
            <FormItem label="查看一只(leaving empty is search all)">
              <Input
                value={inputStock}
                onChange={(e) => {
                  setInputStock(e.target.value);
                }}
              />
            </FormItem>
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
        </div>
        <Spin spinning={isLoading} tip="Loading and caculating...">
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={option}
          />
          {showDateArray?.length > 0 && (
            <>
              <Table
                columns={showDateArray?.map((i) => ({
                  title: (
                    <div style={{ color: dateArrWithRed[i] ? 'red' : 'black' }}>
                      {i}
                    </div>
                  ),
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
                {showDateArray?.map((i) => (
                  <Tabs.TabPane
                    tab={
                      <div
                        style={{
                          color: dateArrWithRed[i] ? 'red' : '#000000d9',
                        }}
                      >
                        {i}
                      </div>
                    }
                    key={i}
                  >
                    <div>
                      Total:{dataTotal}{' '}
                      <span style={{ color: 'red' }}>Up:{dataUp}</span>{' '}
                      <span style={{ color: 'green' }}>Down:{dataDown}</span>
                    </div>
                    <div>
                      <Space>
                        BaseResult:
                        <Tag>100+: {baseResult?.more100}</Tag>
                        <Tag>80-100: {baseResult?.form80to100}</Tag>
                        <Tag>60-80: {baseResult?.from60to80}</Tag>
                        <Tag>40-60: {baseResult?.from40to60}</Tag>
                        <Tag>20-40: {baseResult?.from20to40}</Tag>
                      </Space>
                    </div>
                    <div>
                      <Space>
                        {hasCondition1 && 'Condition1'}{' '}
                        {hasCondition2 && 'Condition2'}
                        {hasCondition3 && 'Condition3'}
                        {hasCondition6 && 'Condition6'}
                        {hasCondition4 && 'Condition4'}
                        {hasCondition5 && 'Condition5'}Result:
                        <Tag>100+: {conditionResult?.more100}</Tag>
                        <Tag>80-100: {conditionResult?.form80to100}</Tag>
                        <Tag>60-80: {conditionResult?.from60to80}</Tag>
                        <Tag>40-60: {conditionResult?.from40to60}</Tag>
                        <Tag>20-40: {conditionResult?.from20to40}</Tag>
                      </Space>
                    </div>
                  </Tabs.TabPane>
                ))}
              </Tabs>
            </>
          )}
          {isSetCondition && data && (
            <div>
              <div>
                {plates?.length > 0 &&
                  plates?.map((i) => (
                    <Tooltip title={i['group_concat(a.symbol)']}>
                      <Tag>{`${i.name}(${i.count})`}</Tag>
                    </Tooltip>
                  ))}
              </div>
              <Button type="primary" onClick={() => setIsModalVisible(true)}>
                Export
              </Button>
              <Table
                pagination={{ defaultPageSize: 100 }}
                columns={columns}
                dataSource={conditionData}
                rowClassName={(record: any) => {
                  if (record?.chosen) {
                    if (record?.isNotFirst) {
                      return 'da-row red-row-first';
                    }
                    return 'da-row red-row';
                  } else {
                    if (record?.isNotFirst) {
                      return 'da-row grey-row-first';
                    }
                    return 'da-row grey-row';
                  }
                }}
              />
            </div>
          )}
          {data && (
            <Table
              pagination={{ defaultPageSize: 100 }}
              columns={columns}
              dataSource={data}
              rowClassName={(record: any) => {
                if (record?.chosen) {
                  if (record?.isNotFirst) {
                    return 'da-row red-row-first';
                  }
                  return 'da-row red-row';
                } else {
                  if (record?.isNotFirst) {
                    return 'da-row grey-row-first';
                  }
                  return 'da-row grey-row';
                }
              }}
            />
          )}
        </Spin>
      </div>
      <Modal
        title="Export Modal"
        visible={isModalVisible}
        onOk={() => setIsModalVisible(false)}
        onCancel={() => setIsModalVisible(false)}
        width={1200}
      >
        <Typography.Paragraph
          copyable={{
            text: `${allDayStocks?.map((i) =>
              i?.beforeDays
                ? `${i.symbol}_${i.beforeDays?.replaceAll(', ', '_')}`
                : `${i.symbol}_${i.datestr}`
            )}`,
          }}
          style={{ maxHeight: '500px', overflow: 'auto' }}
        >
          {allDayStocks?.length > 0 &&
            allDayStocks?.map((i) => (
              <p>
                {i?.beforeDays
                  ? `${i.symbol}_${i.beforeDays?.replaceAll(', ', '_')}`
                  : `${i.symbol}_${i.datestr}`}
              </p>
            ))}
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="Check Before Dates Modal"
        visible={isBeforeDatesModalVisible}
        onOk={() => setIsBeforeDatesModalVisible(false)}
        onCancel={() => setIsBeforeDatesModalVisible(false)}
        width={1500}
      >
        <>
          <Input
            style={{ width: '50px', height: '32px' }}
            size="small"
            placeholder="Input Days"
            value={oneStockSelectConsDays}
            onChange={(e) => {
              setOneStockSelectConsDays(e.target.value);
            }}
          />
          days in
          <Input
            style={{ width: '50px', height: '32px' }}
            size="small"
            placeholder="Input Days"
            value={oneStockConsAllDays}
            onChange={(e) => {
              setOneStockConsAllDays(e.target.value);
            }}
          />
          days
          <Select
            style={{ width: '80px' }}
            value={oneStockSelectDays}
            onChange={(v) => {
              setOneStockSelectDays(v);
            }}
            size="small"
          >
            {[5, 10, 20, 30, 40, 50, 60].map((i) => (
              <Select.Option key={i} value={i}>
                {i}
              </Select.Option>
            ))}
          </Select>
          Days Till Today
        </>
        <Button
          type="primary"
          onClick={() => {
            runOneAnalysis();
          }}
        >
          RUN
        </Button>
        <ReactEcharts
          style={{ height: 350, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={oneStockChartOption}
        />
      </Modal>
    </div>
  );
};
