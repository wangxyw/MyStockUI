import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import React from 'react';
import {
  Button,
  Input,
  Select,
  DatePicker,
  Radio,
  Tag,
  Switch,
  Space,
  Checkbox,
  InputNumber,
  Modal,
  Typography,
} from 'antd';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';
import { groupBy } from 'lodash';
import DATE from './date.json';
import { get } from '../lib/request';
import { cloneDeep, orderBy } from 'lodash';
import './alarm.css';
import { focusStatusMap } from './myFocus';

export const SELECT_COLOR = '#e7f1fa';

const curDate = new Date();
const year = curDate.getFullYear();
const month = curDate.getMonth() + 1;
const day = curDate.getDate();
const dateFormat = 'YYYY-MM-DD';
export const today = moment(`${year}-${month}-${day}`).format(dateFormat);

export const getBeforeOneDate = (date, n) => {
  //const n = n;
  let d = new Date(date);
  let year = d.getFullYear();
  let mon = d.getMonth() + 1;
  let day = d.getDate();
  if (day <= n) {
    if (mon > 1) {
      mon = mon - 1;
    } else {
      year = year - 1;
      mon = 12;
    }
  }
  d.setDate(d.getDate() - n);
  year = d.getFullYear();
  mon = d.getMonth() + 1;
  day = d.getDate();
  const s =
    year +
    '-' +
    (mon < 10 ? '0' + mon : mon) +
    '-' +
    (day < 10 ? '0' + day : day);
  return s;
};
export const workdays = DATE.workday;
export const caculateDate = (startDatestr, days) => {
  const startDateStrIndex = workdays.indexOf(startDatestr);
  if (startDateStrIndex !== -1) {
    const endDateStr = workdays[startDateStrIndex - days];
    return endDateStr;
  } else {
    let i = 1;
    while (workdays.indexOf(startDatestr) === -1) {
      startDatestr = getBeforeOneDate(startDatestr, i);
    }
    const endDateStr = workdays[workdays.indexOf(startDatestr) - days];
    return endDateStr;
  }
};

export const caculateAfterDate = (startDatestr, days) => {
  const startDateStrIndex = workdays.indexOf(startDatestr);
  if (startDateStrIndex !== -1) {
    const endDateStr = workdays[startDateStrIndex + days];
    return endDateStr;
  } else {
    let i = 1;
    while (workdays.indexOf(startDatestr) === -1) {
      startDatestr = getBeforeOneDate(startDatestr, i);
    }
    const endDateStr = workdays[workdays.indexOf(startDatestr) + days];
    return endDateStr;
  }
};

const validateStock = (stock) => {
  if (stock.length < 8) {
    return false;
  }
  const stockPre = stock.slice(0, 2);
  if (stockPre != 'sh' && stockPre != 'sz') {
    return false;
  }
  const stockRemovePre = stock.slice(2);
  if (isNaN(parseInt(stockRemovePre, 10))) {
    return false;
  }
  return true;
};

const matchType = (dpct, totalpct) => {
  if (totalpct > 50 && dpct >= 25) {
    return 'A1';
  } else if (totalpct > 50 && dpct < 25) {
    return 'A2';
  } else if (totalpct < 50 && totalpct > 10 && dpct >= 25) {
    return 'A3';
  } else {
    return 'NA';
  }
};

const matchColor = (type) => {
  if (type === 'A1') {
    return 'red';
  } else if (type === 'A2') {
    return 'yellow';
  } else if (type === 'A3') {
    return 'purple';
  } else {
    return 'pink';
  }
};

const caculatefiveAverage = (data: any[], key = 'kuvolume', days) => {
  const newData = data.reduce((prev, cur) => {
    const newCur = cloneDeep(cur);
    if (prev.length > 0) {
      if (prev.length < days) {
        const sum = prev.map((p) => p[key]).reduce((p, c) => p + c);
        newCur[`five_${key}`] = (sum + cur[key]) / (prev.length + 1);
      } else {
        const sum = prev
          .slice(prev.length - days + 1, prev.length)
          .map((p) => p[key])
          .reduce((p, c) => p + c);
        const avg = (sum + cur[key]) / days;
        newCur[`five_${key}`] = avg;
      }
    } else {
      newCur[`five_${key}`] = cur[key];
    }
    prev.push(newCur);
    return prev;
  }, []);
  return newData;
};

export const minOrAverageMap = [
  { key: 'min', value: '最低价' },
  { key: 'average', value: '横盘' },
];

export const AlarmComponent = (props) => {
  const { from100 } = props;
  const [selectStock, setSelectStock] = useState<any>('');
  const [selectAlarmType, setSelectAlarmType] = useState('All');
  const [option, setOption] = useState({});
  const [priceOption, setPriceOption] = useState({});
  const [volOption, setVolOption] = useState({});
  const [averageOption, setAverageOption] = useState({});
  const [turnOverRateOption, setTurnOverRateOption] = useState({});
  const [selectDays, setSelectDays] = useState('30');
  const [selectConsAllDays, setSelectConsAllDays] = useState(5);
  const [stockOptions, setStockOptions] = useState<any[]>([]);
  const [focusPlateOptions, setFocusPlateOptions] = useState<any[]>([]);
  const [totalNum, setTotalNum] = useState<number>(null as unknown as number);
  const [isLoading, setIsLoading] = useState(false);
  const [selectConsUpDown, setSelectConsUpDown] = useState('up');
  const [selectConsDays, setSelectConsDays] = useState(5);
  const [stockPlate, setStockPlate] = useState('');
  const [selectConsTotal, setSelectConsTotal] = useState('CONS');
  const [hasCondition1, setHasCondition1] = useState(true);
  const [hasCondition2, setHasCondition2] = useState(false);
  const [hasCondition3, setHasCondition3] = useState(false);
  const [hasCondition4, setHasCondition4] = useState(false);
  const [hasCondition5, setHasCondition5] = useState(false);
  const [hasCondition6, setHasCondition6] = useState(false);
  const [minOrAverage, setMinOrAverage] = useState('min');
  const [isSearchByDay, setIsSearchByDay] = useState(false);
  const [isSearchByWeek, setIsSearchByWeek] = useState(false);
  const [givenPrice, setGivenPrice] = useState(10);
  const [givenMinPrice, setGivenMinPrice] = useState(10);
  const [givenCirculation, setGivenCirculation] = useState(10);
  const [selectDate, setSelectDate] = useState(
    moment(`${year}-${month}-${day}`).format(dateFormat)
  );
  const [comments, setComments] = useState('');
  const [predict, setPredict] = useState('up');
  const [selectPriceMargin, setSelectPriceMargin] = useState(4);
  const [eachVolOption, setEachVolOption] = useState({});
  const [udSumOption, setUdSumOption] = useState({});
  const [udVolOption, setUDVolOption] = useState({});
  const [selectedFocusPlate, setSelectedFocusPlate] = useState('');
  const [advancedSearchR, setAdvancedSearchR] = useState<any[]>();
  const [caculatePriceBy, setCaculatePriceBy] = useState(false);
  const [viewedDate, setViewedDate] = useState(
    moment(`${year}-${month}-${day}`).format(dateFormat)
  );
  const [showLines, setShowLines] = React.useState(false);
  const [selectFocusStatus, setSelectFocusStatus] = useState<any>(null);
  const [selectMinPriceMargin, setSelectMinPriceMargin] = useState(10);
  const [selectMinPriceDays, setSelectMinPriceDays] = useState(20);
  const [selectHorPriceMargin, setSelectHorPriceMargin] = useState(10);
  const [selectHorPriceDays, setSelectHorPriceDays] = useState(30);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const listPlate = useCallback((results) => {
    const ids = results?.map((i) => `'${i.symbol}'`).join(',');
    ids?.length > 0 &&
      get(`/api/get_stock_plate?ids=${ids}`).then((res) => {
        const resbySymbols = res.symbols;
        const resbyPlates = res.plates;
        const newstocks = results.map((i) => ({
          ...i,
          platename: resbySymbols?.find((e) => e.symbol === i.symbol)
            ?.platename,
        }));
        setFocusPlateOptions(resbyPlates);
        setStockOptions([...newstocks]);
        setAdvancedSearchR([...newstocks]);
      });
  }, []);

  const setStockOptionsByPlate = useCallback(
    (v) => {
      const focusPlateStocks: any = advancedSearchR?.filter((i) =>
        i.platename?.split(',')?.includes(v)
      );
      setSelectedFocusPlate(v);
      setStockOptions(focusPlateStocks);
      setTotalNum(focusPlateStocks?.length);
    },
    [advancedSearchR]
  );
  const composedQuery = (url, array) => {
    let URI = url;
    array.forEach((i, k) => {
      if (k === 0) {
        URI += `?${i.key}=${i.value}`;
      } else {
        URI += `&${i.key}=${i.value}`;
      }
    });
    return URI;
  };

  const advancedSearchParams = (i) => [
    { key: 'datestr', value: caculateDate(selectDate, i) },
    { key: 'selectConsTotal', value: selectConsTotal },
    { key: 'selectConsUpDown', value: selectConsUpDown },
    { key: 'selectConsDays', value: selectConsDays },
    { key: 'selectConsAllDays', value: selectConsAllDays },
    { key: 'hasCondition1', value: hasCondition1 },
    { key: 'selectPriceMargin', value: selectPriceMargin },
    { key: 'caculatePriceBy', value: caculatePriceBy },
    { key: 'hasCondition2', value: hasCondition2 },
    { key: 'minOrAverage', value: minOrAverage },
    { key: 'selectMinPriceMargin', value: selectMinPriceMargin },
    { key: 'selectMinPriceDays', value: selectMinPriceDays },
    { key: 'hasCondition3', value: hasCondition3 },
    { key: 'hasCondition4', value: hasCondition4 },
    { key: 'selectHorPriceMargin', value: selectHorPriceMargin },
    { key: 'selectHorPriceDays', value: selectHorPriceDays },
    { key: 'hasCondition5', value: hasCondition5 },
    { key: 'hasCondition6', value: hasCondition6 },
    { key: 'givenPrice', value: givenPrice },
    { key: 'givenMinPrice', value: givenMinPrice },
    { key: 'givenCirculation', value: givenCirculation },
    { key: 'from100', value: from100 },
  ];

  const advancedSearch = () => {
    setIsLoading(true);
    get(composedQuery('api/searchByDay', advancedSearchParams(0))).then(
      (res) => {
        get(`/api/get_viewed_stock?datestr=${viewedDate}`).then((viewed) => {
          const result = res.map((i) => {
            if (viewed.find((e) => e.symbol === i.symbol)) {
              i.viewed = true;
              return i;
            } else {
              return i;
            }
          });
          setIsSearchByDay(true);
          setIsSearchByWeek(false);
          setStockOptions(result);
          setIsLoading(false);
          listPlate(result);
          setTotalNum(result.length);
        });
      }
    );
  };
  const advancedSearchByWeek = () => {
    setIsLoading(true);
    const promise = [0, 1, 2, 3, 4].map((i) => {
      return new Promise((resolve, reject) => {
        get(composedQuery('api/searchByDay', advancedSearchParams(i))).then(
          (res) => {
            resolve(res);
          }
        );
      });
    });
    Promise.all(promise).then((d: any) => {
      get(`/api/get_viewed_stock?datestr=${viewedDate}`).then((viewed) => {
        const allStocks: any = [];
        d?.forEach((i) => {
          allStocks.push(...i);
        });
        const allStocksGroupBySymbol = groupBy(allStocks, 'symbol');
        const upDownStocksR = orderBy(
          Object.keys(allStocksGroupBySymbol)?.map((i) => ({
            ...allStocksGroupBySymbol[i][0],
            dupCount: allStocksGroupBySymbol[i]?.length,
          })),
          ['dupCount'],
          ['desc']
        );
        const upDownStocks = upDownStocksR.map((i) => {
          if (viewed.find((e) => e.symbol === i.symbol)) {
            i.viewed = true;
            return i;
          } else {
            return i;
          }
        });
        setIsSearchByDay(false);
        setIsSearchByWeek(true);
        setIsLoading(false);
        setStockOptions([...upDownStocks]);
        listPlate(upDownStocks);
        setTotalNum(upDownStocks.length);
      });
    });
  };

  useEffect(() => {
    setIsLoading(true);
    fetch(
      `/api/all_stock_alarm?alarm_type=${selectAlarmType}&date=${selectDate}&from100=${from100}`
    )
      .then((res) => res.json())
      .then((data) => {
        fetch(`/api/get_viewed_stock?datestr=${viewedDate}`)
          .then((result) => result.json())
          .then((viewedStocks) => {
            const addViewed =
              data &&
              data.map((i) => {
                if (viewedStocks.find((e) => e.symbol === i.symbol)) {
                  i.viewed = true;
                  return i;
                } else {
                  return i;
                }
              });
            setIsLoading(false);
            // setSavedStockOptions(addViewed);
            setStockOptions(addViewed);
            setTotalNum(addViewed && addViewed.length);

            const jumpParam = location?.href?.split('?')?.[1]?.split('&');
            const jumpSymbol = jumpParam?.[0]?.split('=')?.[1];
            const jumpDate = jumpParam?.[1]?.split('=')?.[1];
            if (jumpSymbol && jumpDate) {
              setSelectStock(jumpSymbol);
              setSelectDate(jumpDate);
              getStockAlarm(jumpSymbol, jumpDate);
            }
          });
      });
  }, [selectAlarmType, viewedDate, from100]);

  const reLoadAllAlarms = useCallback(
    (applyTimeFilter) => {
      setIsLoading(true);
      fetch(`/api/get_viewed_stock?datestr=${viewedDate}`)
        .then((result) => result.json())
        .then((viewedStocks) => {
          const addViewed =
            stockOptions &&
            stockOptions.map((i) => {
              if (viewedStocks.find((e) => e.symbol === i.symbol)) {
                i.viewed = true;
                return i;
              } else {
                return i;
              }
            });
          setIsLoading(false);
          // setSavedStockOptions(addViewed);
          setIsSearchByWeek(false);
          setIsSearchByDay(false);
          setStockOptions(addViewed);
          setTotalNum(addViewed && addViewed.length);
        });
      // })
    },
    [selectAlarmType, selectDate, stockOptions, viewedDate]
  );

  const clearAdvanced = useCallback(() => {
    let url = `/api/all_stock_alarm?alarm_type=${selectAlarmType}&date=${selectDate}&from100=${from100}`;
    setIsLoading(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        fetch(`/api/get_viewed_stock?datestr=${viewedDate}`)
          .then((result) => result.json())
          .then((viewedStocks) => {
            const addViewed =
              data &&
              data.map((i) => {
                if (viewedStocks.find((e) => e.symbol === i.symbol)) {
                  i.viewed = true;
                  return i;
                } else {
                  return i;
                }
              });
            setIsLoading(false);
            setIsSearchByWeek(false);
            setIsSearchByDay(false);
            //setSavedStockOptions(addViewed);
            setStockOptions(addViewed);
            setTotalNum(addViewed && addViewed.length);
          });
      });
  }, [selectAlarmType, selectDate, stockOptions, from100, viewedDate]);

  const getStockAlarm = (selectStock, selectDate) => {
    const dateArrNew = () => {
      const curIndex = DATE.workday.indexOf(
        caculateDate(getBeforeOneDate(selectDate, 0), 0)
      );
      const newDates = DATE.workday.slice(
        curIndex - parseInt(selectDays, 10),
        curIndex + 1
      );
      const datesIsFirstWorkday = {};
      newDates?.forEach((i, k) => {
        if (DATE.workday.indexOf(getBeforeOneDate(i, 1)) === -1) {
          datesIsFirstWorkday[i] = true;
        } else {
          datesIsFirstWorkday[i] = false;
        }
      });
      return datesIsFirstWorkday;
    };
    const dateArr = Object.keys(dateArrNew());

    validateStock(selectStock) &&
      fetch(
        `/api/stock_alarm?stock_id=${selectStock}&afterDate=${dateArr[0]}&from100=${from100}`,
        { method: 'GET' }
      )
        .then((res) => res.json())
        .then((data) => {
          setStockPlate(data?.[0]?.plates);
          const fiveAverageKT = caculatefiveAverage(data, 'totalvol', 5);
          const tenAverageKT = caculatefiveAverage(data, 'totalvol', 10);
          const twentyAverageKT = caculatefiveAverage(data, 'totalvol', 20);
          const fiveABigVdata = dateArr.map((i) => {
            if (fiveAverageKT.find((d) => d.datestr === i)) {
              return fiveAverageKT.find((d) => d.datestr === i).five_totalvol;
            } else {
              return '-';
            }
          });
          const twentyABigVdata = dateArr.map((i) => {
            if (twentyAverageKT.find((d) => d.datestr === i)) {
              return twentyAverageKT.find((d) => d.datestr === i).five_totalvol;
            } else {
              return '-';
            }
          });
          const tenABigVdata = dateArr.map((i) => {
            if (tenAverageKT.find((d) => d.datestr === i)) {
              return tenAverageKT.find((d) => d.datestr === i).five_totalvol;
            } else {
              return '-';
            }
          });
          const dataArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).dvaluepct * 100;
            } else {
              return 0;
            }
          });
          const overRateArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).turnoverrate;
            } else {
              return '-';
            }
          });
          const priceArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).finalprice;
            } else {
              return '-';
            }
          });
          const totalDataArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).totalvolpct * 100;
            } else {
              return '-';
            }
          });
          const allVolArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).stockvol;
            } else {
              return '-';
            }
          });
          const bigVolArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).totalvol;
            } else {
              return '-';
            }
          });

          const kuvolumeArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).kuvolume;
            } else {
              return '-';
            }
          });

          const kdvolumeArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).kdvolume;
            } else {
              return '-';
            }
          });

          const kevolumeArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).kevolume;
            } else {
              return '-';
            }
          });

          const u_dvolumeArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return (
                data.find((d) => d.datestr === i).kuvolume -
                data.find((d) => d.datestr === i).kdvolume
              );
            } else {
              return '-';
            }
          });
          const udSumData = data?.map((item) => {
            const ud = item.kuvolume - item.kdvolume;
            item.ud = ud;
            return item;
          });
          const udSum = udSumData?.map((item, key) => {
            const total = udSumData
              ?.map?.((i) => i.ud)
              .reduce((pre, cur, index) => {
                if (index > key) {
                  return pre + 0;
                }
                return pre + cur;
              });
            item.udSum = total;
            return item;
          });
          const udSumArr = dateArr.map((i) => {
            if (udSum.find((d) => d.datestr === i)) {
              return udSum.find((d) => d.datestr === i).udSum;
            } else {
              return '-';
            }
          });

          const statusArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return data.find((d) => d.datestr === i).status;
            } else {
              return '';
            }
          });
          const markPointArr = dateArr.map((i) => {
            if (data.find((d) => d.datestr === i)) {
              return {
                value: matchType(
                  data.find((d) => d.datestr === i).dvaluepct * 100,
                  data.find((d) => d.datestr === i).totalvolpct * 100
                ),
                xAxis: i,
                yAxis: data.find((d) => d.datestr === i).totalvolpct * 100,
                itemStyle: {
                  color: matchColor(
                    matchType(
                      data.find((d) => d.datestr === i).dvaluepct * 100,
                      data.find((d) => d.datestr === i).totalvolpct * 100
                    )
                  ),
                },
              };
            } else {
              return {};
            }
          });
          //const dataArr =  data.map(i => i.dvaluepct);
          setOption({
            title: {
              text: '',
              left: 0,
            },
            legend: {
              data: ['TotalPct', 'DPct', 'OverRate'],
            },
            // grid: [{
            //     left: '10%',
            //     right: '1%',
            //     top: '1%',
            //     height: '70%'
            // }],
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
              },
            },
            toolbox: {
              show: true,
              orient: 'vertical',
              left: 'right',
              top: 'center',
              feature: {
                mark: { show: true },
                magicType: {
                  show: true,
                  type: ['line', 'bar', 'stack', 'tiled'],
                },
                restore: { show: true },
                saveAsImage: { show: true },
              },
            },
            xAxis: {
              type: 'category',
              data: dateArr,
              axisLine: {
                lineStyle: {
                  color: function (params) {
                    var colorList;
                    if (dateArrNew()[params]) {
                      colorList = 'red';
                    } else {
                      colorList = 'black';
                    }
                    return colorList;
                  },
                },
              },
              axisLabel: { show: true, interval: 0, rotate: 45 },
            },
            yAxis: {
              type: 'value',
            },
            series: [
              {
                name: 'TotalPct',
                type: 'bar',
                data: totalDataArr,
                itemStyle: {
                  normal: {
                    color: '#444',
                  },
                },
                label: {
                  position: 'top',
                },
                markPoint: {
                  data: markPointArr,
                },
                markLine: {
                  symbol: ['none', 'arrow'], //['none']表示是一条横线；['arrow', 'none']表示线的左边是箭头，右边没右箭头；['none','arrow']表示线的左边没有箭头，右边有箭头
                  label: {
                    position: 'start', //将警示值放在哪个位置，三个值“start”,"middle","end" 开始 中点 结束
                  },
                  data: [
                    {
                      silent: false, //鼠标悬停事件 true没有，false有
                      lineStyle: {
                        //警戒线的样式 ，虚实 颜色
                        type: 'dotted', //样式  ‘solid’和'dotted'
                        color: '#FA3934',
                        width: 3, //宽度
                      },
                      label: { show: true, position: 'end' },
                      yAxis: 25, // 警戒线的标注值，可以有多个yAxis,多条警示线 或者采用 {type : 'average', name: '平均值'}，type值有 max min average，分为最大，最小，平均值
                    },
                    {
                      silent: false, //鼠标悬停事件 true没有，false有
                      lineStyle: {
                        //警戒线的样式 ，虚实 颜色
                        type: 'dotted', //样式  ‘solid’和'dotted'
                        color: '#FA3934',
                        width: 3, //宽度
                      },
                      label: { show: true, position: 'end' },
                      yAxis: 50, // 警戒线的标注值，可以有多个yAxis,多条警示线 或者采用 {type : 'average', name: '平均值'}，type值有 max min average，分为最大，最小，平均值
                    },
                    {
                      silent: false, //鼠标悬停事件 true没有，false有
                      lineStyle: {
                        //警戒线的样式 ，虚实 颜色
                        type: 'dotted', //样式  ‘solid’和'dotted'
                        color: '#FA3934',
                        width: 3, //宽度
                      },
                      label: { show: true, position: 'end' },
                      yAxis: 75, // 警戒线的标注值，可以有多个yAxis,多条警示线 或者采用 {type : 'average', name: '平均值'}，type值有 max min average，分为最大，最小，平均值
                    },
                  ],
                },
              },
              {
                name: 'DPct',
                type: 'bar',
                data: dataArr,
                itemStyle: {
                  normal: {
                    color: function (params) {
                      var colorList;
                      if (statusArr[params.dataIndex] == 'up') {
                        colorList = '#ef232a';
                      } else if (statusArr[params.dataIndex] == 'down') {
                        colorList = '#14b143';
                      }
                      return colorList;
                    },
                  },
                },
              },
              {
                name: 'OverRate',
                type: 'line',
                data: overRateArr,
                itemStyle: {
                  normal: {
                    color: 'blue',
                  },
                },
              },
              // {
              //     name: 'FinalPrice',
              //     type: 'line',
              //     data: priceArr,
              //     itemStyle: {
              //         normal: {
              //             color: 'yellow'
              //         }
              //     }
              // }
            ],
          });
          setAverageOption({
            title: {
              text: '',
              left: 0,
            },
            legend: {
              data: ['Average5', 'Average10', 'Average20'],
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
              },
            },
            toolbox: {
              show: true,
              orient: 'vertical',
              left: 'right',
              top: 'center',
              feature: {
                mark: { show: true },
                magicType: {
                  show: true,
                  type: ['line', 'bar', 'stack', 'tiled'],
                },
                restore: { show: true },
                saveAsImage: { show: true },
              },
            },
            xAxis: {
              type: 'category',
              data: dateArr,
              axisLabel: { show: true, interval: 0, rotate: 45 },
            },
            yAxis: {
              type: 'value',
            },
            series: [
              {
                name: 'Average10',
                type: 'line',
                data: tenABigVdata,
                symbol: 'none',
                smooth: true,
                connectNulls: true,
                itemStyle: {
                  normal: {
                    color: 'green',
                  },
                },
                lineStyle: { width: 1 },
              },
              {
                name: 'Average20',
                type: 'line',
                data: twentyABigVdata,
                symbol: 'none',
                smooth: true,
                connectNulls: true,
                itemStyle: {
                  normal: {
                    color: '#ccc',
                  },
                },
                lineStyle: { width: 1 },
              },
              {
                name: 'Average5',
                type: 'line',
                symbol: 'none',
                connectNulls: true,
                smooth: true,
                data: fiveABigVdata,
                itemStyle: {
                  normal: {
                    color: 'red',
                  },
                },
                lineStyle: { width: 1 },
              },
            ],
          });
          setTurnOverRateOption({
            title: {
              text: '',
              left: 0,
            },
            legend: {
              data: ['OverRate'],
            },
            // grid: [{
            //     left: '10%',
            //     right: '1%',
            //     top: '1%',
            //     height: '70%'
            // }],
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
              },
            },
            xAxis: {
              type: 'category',
              data: dateArr,
              axisLine: {
                lineStyle: {
                  color: function (params) {
                    var colorList;
                    if (dateArrNew()[params]) {
                      colorList = 'red';
                    } else {
                      colorList = 'black';
                    }
                    return colorList;
                  },
                },
              },
              axisLabel: { show: true, interval: 0, rotate: 45 },
            },
            yAxis: {
              type: 'value',
            },
            series: [
              {
                name: 'OverRate',
                type: 'line',
                data: overRateArr,
                itemStyle: {
                  normal: {
                    color: 'blue',
                  },
                },
              },
            ],
          });
          setVolOption({
            title: {
              text: '',
              left: 0,
            },
            legend: {
              data: ['allVol', 'bigVol', 'AverageBigVol'],
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
              },
            },
            toolbox: {
              show: true,
              orient: 'vertical',
              left: 'right',
              top: 'center',
              feature: {
                mark: { show: true },
                magicType: {
                  show: true,
                  type: ['line', 'bar', 'stack', 'tiled'],
                },
                restore: { show: true },
                saveAsImage: { show: true },
              },
            },
            xAxis: {
              type: 'category',
              data: dateArr,
              axisLabel: { show: true, interval: 0, rotate: 45 },
            },
            yAxis: {
              type: 'value',
            },
            series: [
              {
                name: 'TotalVol',
                type: 'bar',
                data: allVolArr,
                itemStyle: {
                  normal: {
                    color: '#444',
                  },
                },
              },
              {
                name: 'Average10Pct',
                type: 'line',
                data: tenABigVdata,
                symbol: 'none',
                smooth: true,
                connectNulls: true,
                itemStyle: {
                  normal: {
                    color: 'green',
                  },
                },
              },

              {
                name: 'AveragePct',
                type: 'line',
                symbol: 'none',
                connectNulls: true,
                smooth: true,
                data: fiveABigVdata,
                itemStyle: {
                  normal: {
                    color: 'blue',
                  },
                },
              },
              {
                name: 'BigVol',
                type: 'bar',
                data: bigVolArr,
                itemStyle: {
                  normal: {
                    color: function (params) {
                      var colorList;
                      if (statusArr[params.dataIndex] == 'up') {
                        colorList = '#ef232a';
                      } else if (statusArr[params.dataIndex] == 'down') {
                        colorList = '#14b143';
                      }
                      return colorList;
                    },
                  },
                },
              },
            ],
          });
          setPriceOption({
            title: {
              text: 'Final Price',
              left: 0,
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
              },
            },
            toolbox: {
              show: true,
              orient: 'vertical',
              left: 'right',
              top: 'center',
              feature: {
                mark: { show: true },
                magicType: {
                  show: true,
                  type: ['line', 'bar', 'stack', 'tiled'],
                },
                restore: { show: true },
                saveAsImage: { show: true },
              },
            },
            xAxis: {
              type: 'category',
              data: dateArr,
              axisLabel: { show: true, interval: 0, rotate: 45 },
            },
            yAxis: {
              type: 'value',
              min: function (value) {
                return value.min;
              },
            },
            series: [
              {
                name: 'Final Price',
                type: 'line',
                data: priceArr.map((item, idx) => ({
                  value: item,
                  name: `item_${idx}`,
                })),
                itemStyle: {
                  normal: {
                    color: 'blue',
                  },
                },
              },
            ],
          });

          setEachVolOption({
            title: {
              text: 'K U Volume',
              left: 0,
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
              },
            },
            toolbox: {
              show: true,
              orient: 'vertical',
              left: 'right',
              top: 'center',
              feature: {
                mark: { show: true },
                magicType: {
                  show: true,
                  type: ['line', 'bar', 'stack', 'tiled'],
                },
                restore: { show: true },
                saveAsImage: { show: true },
              },
            },
            xAxis: {
              type: 'category',
              data: dateArr,
              axisLabel: { show: true, interval: 0, rotate: 45 },
            },
            yAxis: {
              type: 'value',
              // min: function (value) {
              //   return value.min;
              // },
            },
            series: [
              {
                name: 'KUvolume',
                type: 'line',
                data: kuvolumeArr,
                itemStyle: {
                  normal: {
                    color: 'red',
                  },
                },
              },
              {
                name: 'KDvolume',
                type: 'line',
                data: kdvolumeArr,
                itemStyle: {
                  normal: {
                    color: 'green',
                  },
                },
              },
              {
                name: 'KEvolume',
                type: 'line',
                data: kevolumeArr,
                itemStyle: {
                  normal: {
                    color: 'blue',
                  },
                },
              },
            ],
          });
          setUDVolOption({
            title: {
              text: 'K U Volume',
              left: 0,
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
              },
            },
            toolbox: {
              show: true,
              orient: 'vertical',
              left: 'right',
              top: 'center',
              feature: {
                mark: { show: true },
                magicType: {
                  show: true,
                  type: ['line', 'bar', 'stack', 'tiled'],
                },
                restore: { show: true },
                saveAsImage: { show: true },
              },
            },
            xAxis: {
              type: 'category',
              data: dateArr,
              axisLabel: { show: true, interval: 0, rotate: 45 },
            },
            yAxis: {
              type: 'value',
              // min: function (value) {
              //   return value.min;
              // },
            },
            series: [
              {
                name: 'U-D volume',
                type: 'line',
                data: u_dvolumeArr,
                itemStyle: {
                  normal: {
                    color: 'black',
                  },
                },
              },
            ],
          });
          setUdSumOption({
            title: {
              text: 'K U Volume',
              left: 0,
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'cross',
              },
            },
            toolbox: {
              show: true,
              orient: 'vertical',
              left: 'right',
              top: 'center',
              feature: {
                mark: { show: true },
                magicType: {
                  show: true,
                  type: ['line', 'bar', 'stack', 'tiled'],
                },
                restore: { show: true },
                saveAsImage: { show: true },
              },
            },
            xAxis: {
              type: 'category',
              data: dateArr,
              axisLabel: { show: true, interval: 0, rotate: 45 },
            },
            yAxis: {
              type: 'value',
            },
            series: [
              {
                name: 'U-D SUM volume',
                type: 'line',
                data: udSumArr,
                itemStyle: {
                  normal: {
                    color: '#f5cd3a',
                  },
                },
              },
            ],
          });
        })
        .catch((error) => {
          throw error;
        });

    fetch(
      `/api/update_stock_status?stock_id=${selectStock}&datestr=${viewedDate}`,
      { method: 'GET' }
    )
      .then((res) => res.json())
      .then(() => {
        reLoadAllAlarms(false);
      });
  };

  const addtoFocus = useCallback(() => {
    fetch(
      `/api/add_focus?stock_id=${selectStock}&datestr=${caculateDate(
        selectDate,
        0
      )}&comments=${comments}&predict=${predict}&focus_status=${selectFocusStatus}`,
      { method: 'GET' }
    ).then((res) => res.json());
  }, [comments, selectStock, predict, selectFocusStatus]);

  const priceChartRef = useRef<any>();
  const mainChartRef = useRef<any>();
  const showMarkPoint = useCallback(() => {
    const mainChartInstance = mainChartRef?.current?.getEchartsInstance();
    mainChartInstance.setOption({
      series: [
        {
          markPoint: {
            data: null,
          },
        },
      ],
    });
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Alarm</h2>
      <div>
        <Button
          type="link"
          target="_blank"
          href={`https://finance.sina.com.cn/realstock/company/${selectStock}/nc.shtml`}
        >
          Go to Stock Page
        </Button>
      </div>
      {/* <Input style={{width: '200px', height:'32px'}} size="small" placeholder="Input Stock" value={selectStock} onChange={(e) => {setSelectStock(e.target.value)}}/> */}
      <Select
        showSearch
        style={{ width: '280px' }}
        onChange={(v) => {
          setSelectStock(v);
        }}
        value={selectStock}
        loading={isLoading}
      >
        {stockOptions.map((i) => (
          <Select.Option
            key={i.symbol}
            value={i.symbol}
            style={{ color: `${i.viewed ? 'red' : '#222'}` }}
          >{`${i.name} ${i.symbol} ${i['count(*)'] ? `(${i['count(*)']})` : ''}
            ${i.dupCount ? `(${i.dupCount})` : ''}
            ${i.typeA1 ? 'A1' : ''}
            ${i.typeA2 ? 'A2' : ''}
            ${i.typeA3 ? 'A3' : ''}
            `}</Select.Option>
        ))}
      </Select>
      <span>Total: {totalNum}</span>
      {/* <Select
        style={{ width: '100px' }}
        value={selectAlarmType}
        onChange={(v) => {
          setSelectAlarmType(v);
        }}
        size="middle"
      >
        <Select.Option value="All" style={{ color: 'red' }}>
          All
        </Select.Option>
        <Select.Option value="A1A2">A1A2</Select.Option>
        <Select.Option value="A1Today">A1 Today UP</Select.Option>
        <Select.Option value="A1">A1</Select.Option>
        <Select.Option value="A2">A2</Select.Option>
        <Select.Option value="A3">A3</Select.Option>
      </Select> */}
      <Button
        style={{ marginLeft: '10px' }}
        type="primary"
        onClick={() => getStockAlarm(selectStock, selectDate)}
      >
        Show Alarm
      </Button>
      <div style={{ display: 'inline-block', marginLeft: '10px' }}>
        {' '}
        Show{' '}
        <Input
          style={{ width: '100px', height: '32px' }}
          size="small"
          placeholder="You can select the number of days to view"
          value={selectDays}
          onChange={(e) => {
            if (e.target.value !== '' && isNaN(parseInt(e.target.value))) {
              alert('Input number');
            } else {
              setSelectDays(e.target.value);
            }
          }}
        />{' '}
        days Data till
      </div>
      <DatePicker
        value={moment(selectDate, dateFormat)}
        format={dateFormat}
        onChange={(v: any) => {
          setSelectDate(v.format(dateFormat));
        }}
      />
      Viewed Date
      <DatePicker
        defaultValue={moment(viewedDate, dateFormat)}
        format={dateFormat}
        onChange={(v: any) => setViewedDate(v.format(dateFormat))}
      />
      <Select
        style={{ width: '200px' }}
        onChange={(v) => setStockOptionsByPlate(v as string)}
      >
        {focusPlateOptions?.map((i) => (
          <Select.Option key={i.code} value={i.name}>
            {i.name}({i.count})
          </Select.Option>
        ))}
      </Select>
      <Button type="primary" onClick={() => setIsModalVisible(true)}>
        Export
      </Button>
      <div>
        {stockPlate?.split(',')?.map((i) => (
          <Tag>{i}</Tag>
        ))}
        <Tag color="blue">
          流通股本:
          {(
            stockOptions?.find((i) => i.symbol === selectStock)?.marketvalue /
            stockOptions?.find((i) => i.symbol === selectStock)?.finalprice
          ).toFixed(3)}
          亿
        </Tag>
      </div>
      <div style={{ padding: '5px 10px', background: '#f6f6f6' }}>
        <div style={{ marginTop: '10px' }}>
          <Space
            style={{
              padding: '10px',
              boxShadow: '1px 1px 4px #ccc',
              background: SELECT_COLOR,
            }}
          >
            <Checkbox disabled={true} checked={true} />
            Main Condition
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
            <InputNumber
              min={1}
              max={100}
              value={selectConsDays}
              onChange={setSelectConsDays}
            />
            days in
            <InputNumber
              min={1}
              max={100}
              value={selectConsAllDays}
              onChange={setSelectConsAllDays}
            />
            days
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
              {[5, 10, 30, 40, 50, 60, 90, 120].map((i) => (
                <Select.Option key={i} value={i}>
                  {i}
                </Select.Option>
              ))}
            </Select>
            % in
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
            Condition 4<span>{'流通股本 <'}</span>
            <InputNumber
              min={1}
              max={500}
              value={givenCirculation}
              onChange={setGivenCirculation}
            />
            亿
          </Space>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Button
            type="primary"
            style={{
              boxShadow: `${
                isSearchByDay
                  ? 'inset 0px 0px 6px 3px #08437a'
                  : '0px 0px 0px #fff'
              }`,
            }}
            onClick={() => {
              if (selectConsDays && !isNaN(selectConsDays)) {
                setIsLoading(true);
                advancedSearch();
              }
            }}
          >
            {' '}
            Search By Day
          </Button>
          <Button
            style={{
              marginLeft: '10px',
              boxShadow: `${
                isSearchByWeek
                  ? 'inset 0px 0px 6px 3px #08437a'
                  : '0px 0px 0px #fff'
              }`,
            }}
            type="primary"
            onClick={() => {
              advancedSearchByWeek();
            }}
          >
            {' '}
            Search By Week
          </Button>
          <Button
            style={{ marginLeft: '10px' }}
            type="default"
            onClick={() => {
              clearAdvanced();
            }}
          >
            {' '}
            Clear Advanced Search
          </Button>
        </div>
      </div>
      {/* <div style={{ margin: '10px 0' }}>
        <Button type="primary" onClick={searchByPrice}>
          Search(Need Click After Set Advanced Search)
        </Button>
      </div> */}
      <div>
        Comments
        <Input
          style={{ width: '250px', height: '32px' }}
          size="small"
          placeholder=""
          value={comments}
          onChange={(e) => {
            setComments(e.target.value);
          }}
        />
        <Radio.Group
          onChange={(e) => setPredict(e.target.value)}
          value={predict}
        >
          <Radio value={'up'}>看涨</Radio>
          <Radio value={'down'}>看跌</Radio>
        </Radio.Group>
        <Select
          style={{ width: '80px' }}
          value={selectFocusStatus}
          onChange={(v) => {
            setSelectFocusStatus(v);
          }}
          size="small"
        >
          {Object.keys(focusStatusMap)
            .map((i) => (
              <Select.Option key={i} value={i}>
                {focusStatusMap[i]?.name || '未标注'}
              </Select.Option>
            ))
            .concat(
              <Select.Option key={null as any} value={null as any}>
                {'未标注'}
              </Select.Option>
            )}
        </Select>
        <Button
          type="primary"
          onClick={() => {
            addtoFocus();
          }}
        >
          Add to My Focus
        </Button>
      </div>
      <div style={{ position: 'relative', maxWidth: '1450px' }}>
        <div style={{ textAlign: 'right' }}>
          <Button
            type="dashed"
            onClick={() => {
              setShowLines(!showLines);
            }}
            style={{ zIndex: 1 }}
          >
            Toggle Lines
          </Button>
          <Button onClick={showMarkPoint}>Hide Mark</Button>
        </div>
        {showLines && <GridLines />}
        <ReactEcharts
          style={{ height: 350, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={option}
          ref={mainChartRef}
        />
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={priceOption}
          ref={priceChartRef}
        />
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={turnOverRateOption}
        />
        <ReactEcharts
          style={{ height: 350, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={averageOption}
        />
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={udSumOption}
        />{' '}
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={volOption}
        />
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={udVolOption}
        />
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={eachVolOption}
        />
      </div>
      <Modal
        title="Basic Modal"
        visible={isModalVisible}
        onOk={() => setIsModalVisible(false)}
        onCancel={() => setIsModalVisible(false)}
      >
        <Typography.Paragraph copyable>
          {stockOptions?.map((i) => i.symbol)?.join(',')}
        </Typography.Paragraph>
      </Modal>
    </div>
  );
};

function GridLines() {
  return (
    <div className="alm-grid-lines">
      {Array(36)
        .fill(0)
        .map((_, i) => (
          <div key={i} className="alm-grid-line" />
        ))}
    </div>
  );
}
