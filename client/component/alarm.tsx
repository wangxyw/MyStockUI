import { useCallback, useState, useMemo, useEffect } from 'react';
import React from 'react';
import { Button, Input, Select, DatePicker, Radio } from 'antd';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';
import { groupBy } from 'lodash';
import DATE from './date.json';
import { get, post } from '../lib/request';
import {uniq} from 'lodash';

const getBeforeOneDate = (date, n) => {
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

const caculateDate = (startDatestr, days) => {
  const workdays = DATE.workday;
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

const getBeforeDate = (n) => {
  //const n = n;
  let d = new Date();
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

const validateCons = (data, selectConsUpDown, selectConsDays) => {
  let consNum = 0;
  let end = 0;
  let j = 0;
  let typeA = false;
  let typeB = false;
  let typeC = false;
  data &&
    data.forEach((i, k) => {
      if (i?.alarmtype === 'A1' && i?.status === selectConsUpDown) {
        typeA = true;
      }
      if (i?.alarmtype === 'A2' && i?.status === selectConsUpDown) {
        typeB = true;
      }
      if (i?.alarmtype === 'A3' && i?.status === selectConsUpDown) {
        typeC = true;
      }
      if (i.status === selectConsUpDown) {
        j++;
      } else {
        if (j > consNum) {
          consNum = j;
          end = k;
        }
        j = 0;
      }
    });
  if (j > consNum) {
    (consNum = j), (end = data.length);
  }
  if (consNum >= +selectConsDays) {
    return {
      isTrue: true,
      start: end - selectConsDays,
      end: end - 1,
      typeA,
      typeB,
      typeC,
    };
  } else {
    return { isTrue: false };
  }
};

const validateTotal = (data, selectConsUpDown, selectConsDays) => {
  return (
    data &&
    data.filter((i) => i.status === selectConsUpDown).length >= +selectConsDays
  );
};

const matchType = (dpct, totalpct) => {
  if (totalpct > 50 && dpct >= 25) {
    return 'A1';
  } else if (totalpct > 50 && dpct < 25) {
    return 'A2';
  } else if (totalpct < 50 && dpct >= 25) {
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

export const AlarmComponent = () => {
  const [selectStock, setSelectStock] = useState<any>('');
  const [selectAlarmType, setSelectAlarmType] = useState('All');
  const [option, setOption] = useState({});
  const [priceOption, setPriceOption] = useState({});
  const [volOption, setVolOption] = useState({});
  const [selectDays, setSelectDays] = useState('30');
  const [selectConsAllDays, setSelectConsAllDays] = useState('10');
  const [stockOptions, setStockOptions] = useState<any[]>([]);
  const [focusPlateOptions, setFocusPlateOptions] = useState<any[]>([]);
  const [totalNum, setTotalNum] = useState<number>(null as unknown as number);
  const [isLoading, setIsLoading] = useState(false);

  const [selectConsUpDown, setSelectConsUpDown] = useState('up');
  const [selectConsDays, setSelectConsDays] = useState(5);
  const [selectConsTotal, setSelectConsTotal] = useState('CONS');
  // const [savedStockOptions, setSavedStockOptions] = useState<any[]>([]);
  const curDate = new Date();
  const year = curDate.getFullYear();
  const month = curDate.getMonth() + 1;
  const day = curDate.getDate();
  const dateFormat = 'YYYY-MM-DD';
  const [selectDate, setSelectDate] = useState(
    moment(`${year}-${month}-${day}`).format(dateFormat)
  );
  // const [selectStartDate, setSelectStartDate] = useState(
  //   moment(`${year}-${month}-${day}`).format(dateFormat)
  // );
  // const [selectEndDate, setSelectEndDate] = useState(
  //   moment(`${year}-${month}-${day}`).format(dateFormat)
  // );
  const [comments, setComments] = useState('');
  const [predict, setPredict] = useState('up');
  const [selectPriceMargin, setSelectPriceMargin] = useState(3);
  const [eachVolOption, setEachVolOption] = useState({});
  const [udSumOption, setUdSumOption] = useState({});
  const [udVolOption, setUDVolOption] = useState({});
  const [selectedFocusPlate, setSelectedFocusPlate] = useState('');
  const [advancedSearchR, setAdvancedSearchR] = useState<any[]>();


  const saveSearchResult = ({
    consday,
    totalday,
    pricemargin,
    datestr,
    result,
  }) => {
    post('/api/save_advanced_search', {
      body: JSON.stringify({
        consday,
        totalday,
        pricemargin,
        datestr,
        result,
      }),
    })
  };

  const listPlate = useCallback((results) => {
    const ids = results?.map((i) => `'${i.symbol}'`).join(',');
    ids?.length > 0 && get(`/api/get_stock_plate?ids=${ids}`).then((res) => {
      const resbySymbols = res.symbols;
      const resbyPlates = res.plates;
      console.log(resbyPlates);
      const newstocks = results.map(i => ({
        ...i,
        platename: resbySymbols?.find(e => e.symbol === i.symbol)?.platename
      }))
      setFocusPlateOptions(resbyPlates);
      setStockOptions([...newstocks]);
      setAdvancedSearchR([...newstocks]);
    });
  }, []);

  const setStockOptionsByPlate = useCallback((v) => {
     const focusPlateStocks: any = advancedSearchR?.filter(i => i.platename?.split(",")?.includes(v));
     console.log(focusPlateStocks);
     setSelectedFocusPlate(v);
     setStockOptions(focusPlateStocks);
     setTotalNum(focusPlateStocks?.length);
  }, [advancedSearchR]);

  const advancedSearch = useCallback(
    (selectConsDays, selectConsTotal, selectConsUpDown) => {
      const upDownStocks: any[] = [];
      fetch(
        `/api/all_alarm_data?date_str=${caculateDate(
          selectDate,
          selectConsAllDays
        )}&end_date_str=${selectDate}`,
        { method: 'GET' }
      )
        .then((res) => res.json())
        .then((result) => {
          const data = groupBy(result, 'symbol');
          Object.keys(data).forEach((k) => {
            const item = data[k];
            if (selectConsTotal === 'CONS') {
              const { isTrue, start, end, typeA, typeB, typeC } = validateCons(
                item,
                selectConsUpDown,
                selectConsDays
              );
              if (typeA) item[0].typeA1 = true;
              if (typeB) item[0].typeA2 = true;
              if (typeC) item[0].typeA3 = true;
              if (isTrue) {
                const startPrice = item[start].finalprice;
                const endPrice = item[end].finalprice;
                if (
                  Math.abs((endPrice - startPrice) / startPrice) <
                  selectPriceMargin / 100
                ) {
                  upDownStocks.push(item[0]);
                }
              }
            }
            if (selectConsTotal === 'TOTAL') {
              if (validateTotal(item, selectConsUpDown, selectConsDays)) {
                upDownStocks.push(data[k][0]);
              }
            }
          });
          setIsLoading(false);
          setStockOptions([...upDownStocks]);
          listPlate(upDownStocks);
          setTotalNum(upDownStocks.length);
          saveSearchResult({
            consday: selectConsDays,
            totalday: selectConsAllDays,
            datestr: caculateDate(selectDate, 0),
            pricemargin: selectPriceMargin,
            result: upDownStocks.length,
          });
        });
    },
    [
      setStockOptions,
      selectAlarmType,
      selectConsDays,
      stockOptions,
      selectConsAllDays,
      selectDate,
      selectPriceMargin,
    ]
  );

  useEffect(() => {
    setIsLoading(true);
    fetch(
      `/api/all_stock_alarm?alarm_type=${selectAlarmType}&date=${selectDate}`
    )
      .then((res) => res.json())
      .then((data) => {
        fetch(
          `/api/get_viewed_stock?datestr=${moment(new Date()).format(
            dateFormat
          )}`
        )
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
          });
      }); 
  }, [selectAlarmType, selectDate]);

  const reLoadAllAlarms = useCallback(
    (applyTimeFilter) => {
      setIsLoading(true);
      fetch(
        `/api/get_viewed_stock?datestr=${moment(new Date()).format(dateFormat)}`
      )
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
          setStockOptions(addViewed);
          setTotalNum(addViewed && addViewed.length);
        });
      // })
    },
    [selectAlarmType, selectDate, stockOptions]
  );

  const clearAdvanced = useCallback(() => {
    let url = `/api/all_stock_alarm?alarm_type=${selectAlarmType}&date=${selectDate}`;
    setIsLoading(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        fetch(
          `/api/get_viewed_stock?datestr=${moment(new Date()).format(
            dateFormat
          )}`
        )
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
            //setSavedStockOptions(addViewed);
            setStockOptions(addViewed);
            setTotalNum(addViewed && addViewed.length);
          });
      });
  }, [selectAlarmType, selectDate, stockOptions]);

  const dateArr = useMemo(() => {
    const dateArray: any[] = [];
    for (var i = parseInt(selectDays, 10); i >= 0; i--) {
      dateArray.push(getBeforeDate(i));
    }
    return dateArray;
  }, [selectDays]);

  const getStockAlarm = useCallback(() => {
    validateStock(selectStock) &&
      fetch(
        `/api/stock_alarm?stock_id=${selectStock}&afterDate=${getBeforeDate(selectDays)}`,
        { method: 'GET' }
      )
        .then((res) => res.json())
        .then((data) => {
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
            const total = udSumData?.map?.(i => i.ud).reduce((pre, cur, index) => {
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
                type: 'shadow',
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

          setVolOption({
            title: {
              text: '',
              left: 0,
            },
            legend: {
              data: ['allVol', 'bigVol'],
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'shadow',
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
                name: 'TotalPct',
                type: 'bar',
                data: allVolArr,
                itemStyle: {
                  normal: {
                    color: '#444',
                  },
                },
              },
              {
                name: 'DPct',
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
                type: 'shadow',
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
                data: priceArr,
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
                type: 'shadow',
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
              }
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
                type: 'shadow',
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
              }
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
                type: 'shadow',
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
          alert(error);
        });

    fetch(
      `/api/update_stock_status?stock_id=${selectStock}&datestr=${moment(
        new Date()
      ).format(dateFormat)}`,
      { method: 'GET' }
    )
      .then((res) => res.json())
      .then(() => {
        reLoadAllAlarms(false);
      });
  }, [selectStock, selectAlarmType, selectDays]);

  const addtoFocus = useCallback(() => {
    fetch(
      `/api/add_focus?stock_id=${selectStock}&datestr=${caculateDate(
        selectDate,
        0
      )}&comments=${comments}&predict=${predict}`,
      { method: 'GET' }
    ).then((res) => res.json());
  }, [comments, selectStock, predict]);

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
        loading={isLoading}
      >
        {stockOptions.map((i) => (
          <Select.Option
            key={i.symbol}
            value={i.symbol}
            style={{ color: `${i.viewed ? 'red' : '#222'}` }}
          >{`${i.name} ${i.symbol} ${i['count(*)'] ? `(${i['count(*)']})` : ''}
            ${i.typeA1 ? 'A1' : ''}
            ${i.typeA2 ? 'A2' : ''}
            ${i.typeA3 ? 'A3' : ''}
            `}</Select.Option>
        ))}
      </Select>
      <span>Total: {totalNum}</span>
      <Select
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
      </Select>
      <Button type="primary" onClick={() => getStockAlarm()}>
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
        defaultValue={moment(selectDate, dateFormat)}
        format={dateFormat}
        onChange={(v: any) => setSelectDate(v.format(dateFormat))}
      />
      <Select style={{width: '200px'}} onChange={(v) => setStockOptionsByPlate(v as string)}>
      {focusPlateOptions?.map((i) => (
          <Select.Option
            key={i.code}
            value={i.name}
          >{i.name}({i.count})</Select.Option>
        ))}
      </Select>
      {/* <span style={{display:'inline-block', marginLeft:'100px'}}>From</span>
            <DatePicker defaultValue={moment(selectStartDate, dateFormat)} format={dateFormat} onChange={(v) =>setSelectStartDate(v.format(dateFormat))}/> {'  TO  '}
            <DatePicker defaultValue={moment(selectEndDate, dateFormat)} format={dateFormat} onChange={(v) =>setSelectEndDate(v.format(dateFormat))}/>
            <Button onClick={() => {reLoadAllAlarms(true)}}>Load</Button>
            <Button onClick={() => {reLoadAllAlarms(false)}}>Remove Time Filter</Button> */}
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
        days
        <Select
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
        % price margin in
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
        <Button
          type="primary"
          onClick={() => {
            if (selectConsDays && !isNaN(selectConsDays)) {
              setIsLoading(true);
              advancedSearch(selectConsDays, selectConsTotal, selectConsUpDown);
            }
          }}
        >
          {' '}
          Set Advanced Search
        </Button>
        <Button
          style={{ marginLeft: '10px' }}
          type="primary"
          onClick={() => {
            clearAdvanced();
          }}
        >
          {' '}
          Clear Advanced Search
        </Button>
      </div>
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
        <Button
          type="primary"
          onClick={() => {
            addtoFocus();
          }}
        >
          Add to My Focus
        </Button>
      </div>
      <ReactEcharts
        style={{ height: 350, width: 1450 }}
        notMerge={true}
        lazyUpdate={true}
        option={option}
      />
      <ReactEcharts
        style={{ height: 250, width: 1450 }}
        notMerge={true}
        lazyUpdate={true}
        option={priceOption}
      />
      <ReactEcharts
        style={{ height: 250, width: 1450 }}
        notMerge={true}
        lazyUpdate={true}
        option={udSumOption}
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
      <ReactEcharts
        style={{ height: 250, width: 1450 }}
        notMerge={true}
        lazyUpdate={true}
        option={volOption}
      />
    </div>
  );
};
