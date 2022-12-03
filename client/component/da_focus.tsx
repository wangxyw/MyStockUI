import {
  Button,
  DatePicker,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import Icon, {
  CheckCircleOutlined,
  ConsoleSqlOutlined,
} from '@ant-design/icons';

import { CheckCircleTwoTone } from '@ant-design/icons';
import React, { useEffect, useMemo, useState } from 'react';
import { get, post } from '../lib';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { caculateAfterDate, caculateDate, validateCons } from './alarm';
import { groupBy, orderBy, cloneDeep } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import {
  caculateMaxPrice,
  caculateMinPrice,
  caculatePriceData,
} from './myFocus';
import moment from 'moment';
import { getBeforeOneDate, validateStock } from './new_alarm';
import './alarm.css';
import DATA from './date.json';
import { pullWorkDaysArray, pullWorkDaysArrayAfter } from './data_analysis';

const curDate = new Date();
const year = curDate.getFullYear();
const month = curDate.getMonth() + 1;
const day = curDate.getDate();
const dateFormat = 'YYYY-MM-DD';
const today = moment(`${year}-${month}-${day}`).format(dateFormat);
const workDays = DATA.workday;
async function getAllFocusedStocks(
  simulateDate: any = null,
  toToday: any = 0,
  isFilter: any = false
) {
  const stockData1 = await get(
    `/api/all_da_focus?simulateDate=${simulateDate}`
  );
  const stockData = isFilter
    ? stockData1?.filter((i) => {
        return !(
          i.viewed === 1 &&
          i?.viewedDate >= getBeforeOneDate(today, toToday ?? 0)
        );
      })
    : stockData1;
  const symbols = stockData.map((d) => d.symbol);
  // const realtimeData = await post(`/api/qt_realtime`, {
  //   body: JSON.stringify({
  //     q: `${symbols.join(',')}`,
  //   }),
  // });
  const stockPriceByDay = await post(`/api/get_price_from_common_data`, {
    body: JSON.stringify({
      stocks: symbols.map((i) => `'${i}'`).join(','),
      simulateDate: simulateDate,
    }),
  });
  //caculate stock price
  const stockPriceData = caculatePriceData(
    stockData,
    stockPriceByDay,
    '不限',
    simulateDate
  );

  return stockPriceData;
}

async function getAllStocksPrice(symbols, simulateDate: any = null) {
  const stockData = await post(`/api/get_price_from_common_data`, {
    body: JSON.stringify({
      stocks: symbols,
      simulateDate: simulateDate,
    }),
  });

  return stockData;
}

const meetDataFunc = (
  dateArr,
  res,
  oneStockConsAllDays,
  oneStockSelectConsDays
) => {
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
      const { isTrue, start, end } = validateCons(
        item,
        'up',
        oneStockSelectConsDays
      );
      if (isTrue) {
        selectedStocks.push(lastStock);
      }
    });
    stockDataByDate[date] = selectedStocks;
  });
  return stockDataByDate;
};

export const DAFocusListComponent = () => {
  const [data, setData] = useState<any>([]);
  const [selectConsAllDays, setSelectConsAllDays] = useState('5');
  const [selectConsUpDown, setSelectConsUpDown] = useState('up');
  const [selectConsDays, setSelectConsDays] = useState(5);
  const [alarmType1, setAlarmType1] = useState<any>([]);
  const [alarmType2, setAlarmType2] = useState<any>([]);
  const [alarmType3, setAlarmType3] = useState<any>([]);
  const [alarmType4, setAlarmType4] = useState<any>([]);
  const [moretimeStocks, setMoretimeStocks] = useState<any>([]);
  // const [alarmType5, setAlarmType5] = useState<any>([]);
  const [selectHorPriceMargin, setSelectHorPriceMargin] = useState(10);
  const [selectHorPriceDays, setSelectHorPriceDays] = useState(30);
  // const [selectMinPriceDays, setSelectMinPriceDays] = useState(30);
  const [priceMargin, setPriceMargin] = useState<number>(10);
  const [inputStock, setInputStock] = useState<string>('');
  const [selectDate, setSelectDate] = useState<string>(caculateDate(today, 0));
  const [selectOverDay, setSelectOverDay] = useState(60);
  const [simulateDate, setSimulateDate] = useState(caculateDate(today, 0));
  const [isLoading, setIsLoading] = useState(false);
  const [viewedToToday, setViewedToToday] = useState<number>(0);
  const [isFilterd, setIsFilterd] = useState(false);
  const [currentAlarmList, setCurrentAlarmList] = useState<any>(null);
  const [startDate, setStartDate] = useState<any>('');
  const [endDate, setEndDate] = useState<any>('');

  const [isBeforeDatesModalVisible, setIsBeforeDatesModalVisible] =
    useState(false);
  const [oneStockConsAllDays, setOneStockConsAllDays] = useState('5');
  const [oneStockSelectConsDays, setOneStockSelectConsDays] = useState('5');
  const [oneStockSelectDays, setOneStockSelectDays] = useState('60');
  const [oneStockData, setOneStockData] = useState({});
  const [oneStockAfterData, setOneStockAfterData] = useState({});
  const [oneStockDate, setOneStockDate] = useState(today);
  const [from100, setFrom100] = useState('400s');
  const [selectType1Price, setType1Price] = useState(20);

  const runOneAnalysis = () => {
    let days =
      parseInt(oneStockSelectDays, 10) + parseInt(oneStockConsAllDays, 10);
    const dateArr = pullWorkDaysArray(
      oneStockDate,
      parseInt(oneStockSelectDays, 10)
    );
    const afterDateArr = pullWorkDaysArrayAfter(oneStockDate, today);
    const fromOld100 = from100 === '400s' ? false : true;
    const isDR = !!from100.match('DR');
    get(
      `/api/all_alarm_data${isDR ? '_dr' : ''}?date_str=${caculateDate(
        oneStockDate,
        days
      )}&end_date_str=${today}&from100=${
        isDR ? from100.slice(3) : fromOld100
      }&stock=${inputStock}`,
      { method: 'GET' }
    ).then((res) => {
      const stockDataByDate = meetDataFunc(
        dateArr,
        res,
        oneStockConsAllDays,
        oneStockSelectConsDays
      );
      const stockDataAfterDate = meetDataFunc(
        afterDateArr,
        res,
        oneStockConsAllDays,
        oneStockSelectConsDays
      );

      setOneStockData(stockDataByDate);
      setOneStockAfterData(stockDataAfterDate);
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

  const oneStockAfterChartOption = useMemo(() => {
    const yData = Object.keys(oneStockAfterData)?.map(
      (i) => oneStockAfterData[i]?.length
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
        data: Object.keys(oneStockAfterData)?.map((i, k) => {
          if (k === Object.keys(oneStockAfterData)?.length / 2) {
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
  }, [oneStockAfterData]);

  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      sorter: (a: any, b: any): any => {
        return (
          Number(a.symbol.replaceAll('sh', '').replaceAll('sz', '')) -
          Number(b.symbol.replaceAll('sh', '').replaceAll('sz', ''))
        );
      },
      render: (text, record) => {
        return (
          <>
            <div>
              <a
                target="_blank"
                href={`https://quote.eastmoney.com/${text}.html`}
              >
                {text}
              </a>
              {record.name}
              <Tag>
                <a
                  target="_blank"
                  href={`http://${
                    location.host
                  }/alarm?symbol=${text}&datestr=${caculateDate(today, 0)}`}
                >
                  {'Show alarm'}
                </a>
              </Tag>
            </div>
            <div>
              addDate每股收益:{JSON.parse(record.var_props)?.zyzb?.mgsy}
            </div>
            <div>today每股收益:{record?.todayMgsy}</div>
            <div>
              流通股本: {(record.marketvalue / record.finalprice).toFixed(3)}
            </div>
          </>
        );
      },
    },
    {
      title: 'Current Price',
      dataIndex: 'todayPrice',
      key: 'todayPrice',
      render: (c, record) => {
        const isUp = c - record.finalprice > 0;
        const arrow = !isUp ? (
          <ArrowDownOutlined style={{ color: 'green' }} />
        ) : (
          <ArrowUpOutlined style={{ color: 'red' }} />
        );
        return (
          <>
            <span style={{ color: isUp ? 'red' : 'green' }}>{c}</span>
            {arrow}
          </>
        );
      },
    },
    // {
    //   title: 'Add Price',
    //   dataIndex: 'finalprice',
    //   key: 'finalprice',
    // },
    {
      title: 'Add Price/Add Date',
      dataIndex: 'datestr',
      key: 'datestr',
      sorter: (a: any, b: any): any => {
        return (
          Number(a.datestr.replaceAll('-', '')) -
          Number(b.datestr.replaceAll('-', ''))
        );
      },
      render: (c, record) => {
        const index1 = workDays.indexOf(caculateDate(simulateDate, 0));
        const index2 = workDays.indexOf(record.datestr);
        return (
          <>
            <div>
              <Tag>{record.finalprice}</Tag>
            </div>
            <div>
              <Tag color={'blue'}>
                {c} <br />
                {index1 - index2}
              </Tag>
            </div>
          </>
        );
      },
    },
    // {
    //   title: '流通股本',
    //   dataIndex: 'circulation_stock',
    //   key: 'circulation_stock',
    //   render: (c, record) => {
    //     const re = (record.marketvalue / record.finalprice).toFixed(3);
    //     return <>{re}</>;
    //   },
    // },
    {
      title: '量最小',
      dataIndex: 'minVol',
      key: 'minVol',
      sorter: (a: any, b: any): any => {
        return (
          Number(a.minVolDate.replaceAll('-', '')) -
          Number(b.minVolDate.replaceAll('-', ''))
        );
      },
      render: (c, record) => {
        //const index1 = workDays.indexOf(caculateDate(simulateDate, 0));
        const index2 = workDays.indexOf(record.minVolDate);
        const index1 = workDays.indexOf(record.datestr);
        return (
          <Tag color={'purple'}>
            {record.minVolDate}
            <br /> {index2 - index1}
          </Tag>
        );
      },
    },
    // {
    //   title: 'MaxPrice',
    //   dataIndex: 'maxPrice',
    //   key: 'maxPrice',
    //   sorter: (a: any, b: any): any => {
    //     return Number(a.maxPriceDiff) - Number(b.maxPriceDiff);
    //   },
    //   render: (c, record) => {
    //     const diff = record.maxPriceDiff;
    //     return (
    //       <Tag color={diff > 0 ? 'red' : 'green'}>
    //         {c}/{diff + '%'}
    //       </Tag>
    //     );
    //   },
    // },
    {
      title: 'MaxPrice/MaxPriceDay',
      dataIndex: 'maxPriceDay',
      key: 'maxPriceDay',
      // sorter: (a: any, b: any): any => {
      //   return Number(a.maxPriceDay) - Number(b.maxPriceDay);
      // },
      sorter: (a: any, b: any): any => {
        return Number(a.maxPriceDiff) - Number(b.maxPriceDiff);
      },
      render: (c, record) => {
        const diff = record.maxPriceDiff;
        return (
          <>
            <div>
              <Tag color={diff > 0 ? 'red' : 'green'}>
                {record.maxPrice}/{diff + '%'}
              </Tag>
            </div>
            <div>
              <Tag>
                {record.maxPriceDate} <br /> {c}
              </Tag>
            </div>
          </>
        );
      },
    },
    // {
    //   title: 'MinPrice',
    //   dataIndex: 'minPrice',
    //   key: 'minPrice',
    //   sorter: (a: any, b: any): any => {
    //     return Number(a.minPriceDiff) - Number(b.minPriceDiff);
    //   },
    //   render: (c, record) => {
    //     const diff = record.minPriceDiff;
    //     return (
    //       <Tag color={diff > 0 ? 'red' : 'green'}>
    //         {c}/ {diff + '%'}
    //       </Tag>
    //     );
    //   },
    // },
    {
      title: 'MinPrice/MinPriceDay',
      dataIndex: 'minPriceDay',
      key: 'minPriceDay',
      // sorter: (a: any, b: any): any => {
      //   return Number(a.minPriceDay) - Number(b.minPriceDay);
      // },
      sorter: (a: any, b: any): any => {
        return Number(a.minPriceDiff) - Number(b.minPriceDiff);
      },
      render: (c, record) => {
        const diff = record.minPriceDiff;
        return (
          <>
            <div>
              <Tag color={diff > 0 ? 'red' : 'green'}>
                {record.minPrice}/ {diff + '%'}
              </Tag>
            </div>
            <div>
              <Tag>
                {record.minPriceDate}
                <br /> {c}
              </Tag>
            </div>
          </>
        );
      },
    },
    {
      title: 'CurPrice - AddPrice',
      dataIndex: 'finalprice',
      key: 'finalprice',
      sorter: (a: any, b: any): any => {
        const aPrice = Math.abs(
          ((a.todayPrice - a.finalprice) / a.finalprice) * 100 - a.minPriceDiff
        );
        const bPrice = Math.abs(
          ((b.todayPrice - b.finalprice) / b.finalprice) * 100 - b.minPriceDiff
        );
        return Number(aPrice) - Number(bPrice);
      },
      render: (c, record) => {
        const isUp = record.todayPrice - record.finalprice > 0;
        const arrow = !isUp ? (
          <ArrowDownOutlined style={{ color: 'green' }} />
        ) : (
          <ArrowUpOutlined style={{ color: 'red' }} />
        );

        const diff = (
          ((record.todayPrice - record.finalprice) / record.finalprice) *
          100
        ).toFixed(2);
        const minDiff = record.minPriceDiff;
        const d = Math.abs(+diff - minDiff);
        return (
          <div>
            <div>
              <Tag>
                {arrow}
                {diff}%
              </Tag>
            </div>
            <div>
              <Tag>{d}%</Tag>
            </div>
          </div>
        );
      },
    },
    // {
    //   title: 'Min-Today Day',
    //   dataIndex: 'minPriceDay',
    //   key: 'minPriceDay',
    //   sorter: (a: any, b: any): any => {
    //     const indexToday = workDays.indexOf(caculateDate(simulateDate, 0));
    //     const indexa = workDays.indexOf(a.datestr);
    //     const indexb = workDays.indexOf(b.datestr);
    //     const aN = indexToday - indexa - a.minPriceDay;
    //     const bN = indexToday - indexb - b.minPriceDay;
    //     return Number(aN) - Number(bN);
    //   },
    //   render: (c, record) => {
    //     const index1 = workDays.indexOf(caculateDate(simulateDate, 0));
    //     const index2 = workDays.indexOf(record.datestr);
    //     return <Tag>{index1 - index2 - record.minPriceDay}</Tag>;
    //   },
    // },
    {
      title: '左斜率',
      dataIndex: 'kBefore40',
      key: 'kBefore40',
      sorter: (a: any, b: any): any => {
        return Number(a.kBefore40) - Number(b.kBefore40);
      },
      render: (c, record) => {
        return (
          <>
            <Tag>10日: {c}</Tag>
            <br />
            <Tag>10-minDate:{record.kBeforeMinDate}</Tag>
            <br />
            <Tag>10-maxDate:{record.kBeforeMaxDate}</Tag>
            <br />
            <Tag>20日: {record.k20Before40}</Tag>
            <br />
            <Tag>20-minDate:{record.k20BeforeMinDate}</Tag>
            <br />
            <Tag>20-maxDate:{record.k20BeforeMaxDate}</Tag>
          </>
        );
      },
    },
    {
      title: '右斜率',
      dataIndex: 'kAfter40',
      key: 'kAfter40',
      sorter: (a: any, b: any): any => {
        return Number(a.kAfter40) - Number(b.kAfter40);
      },
      render: (c, record) => {
        return (
          <>
            <Tag>10日: {c}</Tag>
            <br />
            <Tag>10-minDate:{record.kAfterMinDate}</Tag>
            <br />
            <Tag>10-maxDate:{record.kAfterMaxDate}</Tag>
            <br />
            <Tag>20日: {record.k20After40}</Tag>
            <br />
            <Tag>20-minDate:{record.k20AfterMinDate}</Tag>
            <br />
            <Tag>20-maxDate:{record.k20AfterMaxDate}</Tag>
          </>
        );
      },
    },
    {
      title: 'BeforeDates',
      width: '10%',
      dataIndex: 'beforeDays',
      key: 'beforeDays',
      render: (text, record) => (
        <div>
          <Button
            className="button"
            onClick={() => {
              setIsBeforeDatesModalVisible(true);
              setOneStockData({});
              setOneStockAfterData({});
              setOneStockDate(record.datestr);
              setInputStock(record?.symbol);
            }}
          >
            Before Dates
          </Button>
          <div>
            <Button
              onClick={() => displayCondition(record.symbol, record.datestr)}
            >
              Condition
            </Button>
            {record?.finished && (
              <>
                {
                  <Tag
                    icon={<CheckCircleOutlined />}
                    color={record?.is60First_400s ? 'success' : 'default'}
                  >
                    400s
                  </Tag>
                }
                {
                  <Tag
                    icon={<CheckCircleOutlined />}
                    color={record?.is60First_dr_100w ? 'success' : 'default'}
                  >
                    DR 100w
                  </Tag>
                }
                {
                  <Tag
                    icon={<CheckCircleOutlined />}
                    color={record?.is60First_100w ? 'success' : 'default'}
                  >
                    100w
                  </Tag>
                }
                {
                  <Tag
                    icon={<CheckCircleOutlined />}
                    color={record?.is60First_dr_400s ? 'success' : 'default'}
                  >
                    DR 400s
                  </Tag>
                }
                {
                  <Tag
                    icon={<CheckCircleOutlined />}
                    color={record?.is60First_dr_100s ? 'success' : 'default'}
                  >
                    DR 100s
                  </Tag>
                }
                {(record?.is60First_400s ||
                  record?.is60First_dr_100s ||
                  record?.is60First_dr_100w ||
                  record?.is60First_100w ||
                  record?.is60First_dr_400s) && (
                  <div>Condition: {record.condition}</div>
                )}
              </>
            )}
          </div>
        </div>
      ),
    },
    // {
    //   title: '60天内从没出现过',
    //   width: '10%',
    //   dataIndex: 'is60First',
    //   key: 'is60First',
    //   render: (text, record) => {
    //     return (
    //       <div>
    //         <Button
    //           onClick={() => displayCondition(record.symbol, record.datestr)}
    //         >
    //           Display Condition
    //         </Button>
    //         {record?.is60First_400s && (
    //           <Tag icon={<CheckCircleOutlined />} color="success">
    //             400s
    //           </Tag>
    //         )}
    //         {record?.is60First_dr_100w && (
    //           <Tag icon={<CheckCircleOutlined />} color="success">
    //             DR 100w
    //           </Tag>
    //         )}
    //         {record?.is60First_100w && (
    //           <Tag icon={<CheckCircleOutlined />} color="success">
    //             100w
    //           </Tag>
    //         )}
    //         {record?.is60First_dr_400s && (
    //           <Tag icon={<CheckCircleOutlined />} color="success">
    //             DR 400s
    //           </Tag>
    //         )}
    //         {record?.is60First_dr_100s && (
    //           <Tag icon={<CheckCircleOutlined />} color="success">
    //             DR 100s
    //           </Tag>
    //         )}
    //         {(record?.is60First_400s ||
    //           record?.is60First_dr_100s ||
    //           record?.is60First_dr_100w ||
    //           record?.is60First_100w ||
    //           record?.is60First_dr_400s) && (
    //           <div>
    //             Condition: {selectConsDays}/{selectConsAllDays}
    //           </div>
    //         )}
    //       </div>
    //     );
    //   },
    // },
    // {
    //   title: 'Viewed',
    //   key: 'viewed',
    //   render: (text, record) => (
    //     <>
    //       <Switch
    //         unCheckedChildren="Not Viewed"
    //         checkedChildren="Viewed"
    //         checked={
    //           record.viewedDate >= getBeforeOneDate(today, viewedToToday) &&
    //           record.viewed == 1
    //         }
    //         onChange={(value) => {
    //           setIsLoading(true);
    //           fetch(
    //             `/api/update_stock_status?stock_id=${
    //               record.symbol
    //             }&datestr=${today}&viewed=${value ? '1' : '0'}`
    //           ).then(() => {
    //             setData((data) =>
    //               data?.map((i) => {
    //                 if (i.symbol === record.symbol) {
    //                   return {
    //                     ...i,
    //                     viewedDate: today,
    //                     viewed: value ? '1' : '0',
    //                   };
    //                 }
    //                 return i;
    //               })
    //             );
    //             setIsLoading(false);
    //           });
    //         }}
    //       />
    //     </>
    //   ),
    // },

    {
      title: 'Action',
      key: 'action',
      render: (text, record) => (
        <>
          <Switch
            unCheckedChildren="NA"
            checkedChildren="Added"
            style={{ margin: '0 10px' }}
            // defaultChecked
            checked={record.added}
            onChange={(value) => {
              setIsLoading(true);
              fetch(
                `/api/edit_da_focus?symbol=${record.symbol}&datestr=${
                  record.datestr
                }&added=${record.added ? '0' : '1'}`
              ).then(() => {
                async function handleAllStockData() {
                  // const data = await getAllFocusedStocks();
                  setData((data) =>
                    data?.map((i) => {
                      if (i.symbol === record.symbol) {
                        return { ...i, added: value ? '1' : '0' };
                      }
                      return i;
                    })
                  );
                  setIsLoading(false);
                }
                handleAllStockData();
              });
            }}
          />
          <Popconfirm
            title="Sure to delete?"
            onConfirm={() =>
              post('/api/delete_da_focus', {
                body: JSON.stringify({
                  symbol: record?.symbol,
                  datestr: record?.datestr,
                }),
              }).then(() => {
                // async function handleAllStockData() {
                //   const data = await getAllFocusedStocks();

                // }
                // handleAllStockData();
                setData((data) =>
                  data?.filter((i) => i.symbol !== record.symbol)
                );
              })
            }
          >
            <a>Delete</a>
          </Popconfirm>
        </>
      ),
    },
  ];

  useEffect(() => {
    async function handleAllStockData() {
      const data = await getAllFocusedStocks();
      setData(data);
    }

    handleAllStockData();
  }, []);

  const alarm = async () => {
    if (data?.length > 0) {
      const symbols = data
        // ?.filter((i) => !i.added)
        ?.map((i) => `'${i.symbol}'`)
        .join(',');

      const priceData = await getAllStocksPrice(symbols, simulateDate);
      const priceDataGroupByStock = groupBy(priceData, 'symbol');
      let alarmType1: any = [];
      let alarmType3: any = [];
      let alarmType2: any = [];
      let alarmType4: any = [];
      let alarmType5: any = [];
      let moretimesStocks: any = [];

      const groupByData = groupBy(data, 'symbol');
      Object.keys(groupByData).forEach((g) => {
        if (groupByData[g].length > 1) {
          moretimesStocks.push(groupByData[g][0]);
        }
      });
      console.log('====', moretimesStocks);
      // Object.keys(priceDataGroupByStock)?.forEach((i) => {
      //   const recordData = data?.find((e) => e.symbol === i);
      //   const recordDate = recordData?.datestr;
      //   const recordDatePrice = recordData?.finalprice;
      //   const stock = priceDataGroupByStock[i]?.filter(
      //     (e) => e.datestr >= recordDate
      //   );
      //   const daysStock = priceDataGroupByStock[i]?.filter(
      //     (e) => e.datestr >= caculateDate(today, selectHorPriceDays)
      //   );
      //   const minDaysStock = priceDataGroupByStock[i]?.filter(
      //     (e) => e.datestr >= caculateDate(today, selectMinPriceDays)
      //   );
      //   const currentPrice =
      //     stock?.find((i) => i.datestr === caculateDate(today, 0))
      //       ?.finalprice ??
      //     stock?.find((i) => i.datestr === caculateDate(today, 1))?.finalprice;
      //   const { minPrice } = caculateMinPrice(stock);
      //   const { maxPrice } = caculateMaxPrice(stock);
      //   const minDaysPrice = caculateMinPrice(minDaysStock);
      //   //const currentPrice = data?.find((e) => e.symbol === i)?.currentPrice;
      //   if (currentPrice > minPrice && currentPrice < recordDatePrice) {
      //     alarmType1.push(recordData);
      //   }
      //   if (currentPrice == minPrice && currentPrice < recordDatePrice) {
      //     alarmType3.push(recordData);
      //   }
      //   if (
      //     (maxPrice - recordDatePrice) / recordDatePrice >
      //     priceMargin / 100
      //   ) {
      //     alarmType2.push(recordData);
      //   }
      //   const daysMinPrice = caculateMinPrice(daysStock);
      //   const daysMaxPrice = caculateMaxPrice(daysStock);
      //   if (
      //     (daysMaxPrice.maxPrice - daysMinPrice.minPrice) /
      //       daysMinPrice.minPrice <
      //     selectHorPriceMargin / 100
      //   ) {
      //     alarmType4.push(recordData);
      //   }
      //   if (
      //     currentPrice == minDaysPrice.minPrice &&
      //     currentPrice < recordDatePrice
      //   ) {
      //     alarmType5.push(recordData);
      //   }
      // });

      data?.forEach((d) => {
        const recordData = d;
        const recordDate = recordData?.datestr;
        const recordDatePrice = recordData?.finalprice;
        const stock = priceDataGroupByStock?.[d?.symbol]?.filter(
          (e) => e.datestr >= recordDate
        );
        const daysStock = priceDataGroupByStock?.[d?.symbol]?.filter(
          (e) => e.datestr >= caculateDate(today, selectHorPriceDays)
        );

        // const minDaysStock = priceDataGroupByStock[d.symbol]?.filter(
        //   (e) => e.datestr >= caculateDate(today, selectMinPriceDays)
        // );
        const currentPrice =
          stock?.find((i) => i.datestr === caculateDate(today, 0))
            ?.finalprice ??
          stock?.find((i) => i.datestr === caculateDate(today, 1))?.finalprice;
        const { minPrice } = caculateMinPrice(stock);
        const { maxPrice } = caculateMaxPrice(stock);
        //const minDaysPrice = caculateMinPrice(minDaysStock);
        //const currentPrice = data?.find((e) => e.symbol === i)?.currentPrice;
        if (
          (currentPrice - minPrice) / minPrice > selectType1Price / 100 &&
          currentPrice < recordDatePrice
        ) {
          alarmType1.push(recordData);
        }
        if (currentPrice == minPrice && currentPrice < recordDatePrice) {
          alarmType3.push(recordData);
        }
        if (
          (maxPrice - recordDatePrice) / recordDatePrice >
          priceMargin / 100
        ) {
          alarmType2.push(recordData);
        }
        const daysMinPrice = caculateMinPrice(daysStock);
        const daysMaxPrice = caculateMaxPrice(daysStock);
        if (
          (daysMaxPrice.maxPrice - daysMinPrice.minPrice) /
            daysMinPrice.minPrice <
          selectHorPriceMargin / 100
        ) {
          alarmType4.push(recordData);
        }
        // if (
        //   currentPrice == minDaysPrice.minPrice &&
        //   currentPrice < recordDatePrice
        // ) {
        //   alarmType5.push(recordData);
        // }
      });

      if (startDate || endDate) {
        const condition = (item) =>
          (startDate ? item?.datestr > startDate : true) &&
          (endDate ? item?.datestr < endDate : true);
        alarmType1 = alarmType1?.filter((i) => condition(i));
        alarmType2 = alarmType2?.filter((i) => condition(i));
        alarmType3 = alarmType3?.filter((i) => condition(i));
        alarmType4 = alarmType4?.filter((i) => condition(i));
        alarmType5 = alarmType5?.filter((i) => condition(i));
      }

      setAlarmType1(alarmType1);
      setAlarmType2(alarmType2);
      setAlarmType3(alarmType3);
      setAlarmType4(alarmType4);
      setMoretimeStocks(moretimesStocks);
      //setAlarmType5(alarmType5);
    }
  };

  const addFocus = () => {
    if (!validateStock(inputStock)) {
      message.error('invalid stock');
      return;
    }
    fetch(
      `/api/add_da_focus?stock_id=${inputStock}&updated_at=${caculateDate(
        today,
        0
      )}&datestr=${caculateDate(selectDate, 0)}`,
      { method: 'GET' }
    ).then(() => {
      message.success('Add Successfully');
      async function handleAllStockData() {
        const data = await getAllFocusedStocks();
        setData(data);
      }
      handleAllStockData();
    });
  };

  const listMap: Record<any, any> = {
    a: '极力推荐关注- 出现拐点（当前值大于最小值）',
    b: ' 推荐关注-横盘',
    c: '推荐删除',
    d: ' 推荐关注 （当前值 = 最小值）从加入那天起',
    e: '推荐关注 （当前值 = 最小值）从多少天以前起：',
    f: '出现多次',
  };

  const filterInAlarm = (ids) => {
    async function handleAllStockData() {
      const data = await getAllFocusedStocks(simulateDate);
      setData(() => data?.filter((i) => ids?.includes(i?.symbol)));
    }

    handleAllStockData();
  };

  const filterListByAddDate = () => {
    async function handleAllStockData() {
      const data = await getAllFocusedStocks(simulateDate);
      setData(() =>
        data?.filter(
          (i) =>
            (startDate ? i?.datestr > startDate : true) &&
            (endDate ? i?.datestr < endDate : true)
        )
      );
    }
    handleAllStockData();
  };

  const displayCondition = (symbol, addDate) => {
    setIsLoading(true);
    symbol &&
      get(
        `/api/all_alarm_data_view?date_str=${caculateDate(
          addDate,
          70
        )}&end_date_str=${today}&symbols='${symbol}'`,
        { method: 'GET' }
      ).then((res) => {
        const fromCondition = {};
        // data?.forEach((stock) => {
        const dateArr = pullWorkDaysArray(addDate, 60);
        ['400s', '100w', 'dr_100s', 'dr_400s', 'dr_100w'].forEach((from) => {
          const dateStockArr: any[] = [];
          dateArr?.forEach((date) => {
            const oneStockDataByDate = res?.filter(
              (e) =>
                e?.datestr <= caculateDate(date, 0) &&
                e?.datestr > caculateDate(date, selectConsAllDays) &&
                e.symbol === symbol
            );
            const item = oneStockDataByDate;
            const lastStock = item?.[item?.length - 1];
            const { isTrue, start, end } = validateCons(
              item,
              selectConsUpDown,
              selectConsDays,
              from
            );
            if (isTrue) {
              dateStockArr.push(lastStock);
            }
          });
          if (dateStockArr?.length === 1) {
            fromCondition[`is60First_${from}`] = true;
            // newData.find(
            //   (n) => n.symbol === stock.symbol && n.datestr === stock.datestr
            // )[`is60First_${from}`] = true;
            //return { ...stock, [`is60First_${from}`]: true };
          } else {
            fromCondition[`is60First_${from}`] = false;
            // newData.find(
            //   (n) => n.symbol === stock.symbol && n.datestr === stock.datestr
            // )[`is60First_${from}`] = false;
            //return { ...stock, [`is60First_${from}`]: false };
          }
        });
        // });
        //return fromCondition;
        setData((data) => {
          const newData = cloneDeep(data);
          Object.keys(fromCondition)?.forEach((key) => {
            newData.find((i) => i.symbol === symbol && i.datestr === addDate)[
              key
            ] = fromCondition[key];
          });
          newData.find(
            (i) => i.symbol === symbol && i.datestr === addDate
          ).finished = true;
          newData.find(
            (i) => i.symbol === symbol && i.datestr === addDate
          ).condition = `${selectConsDays}/${selectConsAllDays}`;
          return newData;
        });
        setIsLoading(false);
      });
  };

  const alldisplayCondition = (symbol, addDate) => {
    setIsLoading(true);
    symbol &&
      get(
        `/api/all_alarm_data_view?date_str=${caculateDate(
          addDate,
          70
        )}&end_date_str=${today}&symbols='${symbol}'`,
        { method: 'GET' }
      ).then((res) => {
        const fromCondition = {};
        // data?.forEach((stock) => {
        const dateArr = pullWorkDaysArray(addDate, 60);
        ['400s', '100w', 'dr_100s', 'dr_400s', 'dr_100w'].forEach((from) => {
          const dateStockArr: any[] = [];
          dateArr?.forEach((date) => {
            const oneStockDataByDate = res?.filter(
              (e) =>
                e?.datestr <= caculateDate(date, 0) &&
                e?.datestr > caculateDate(date, selectConsAllDays) &&
                e.symbol === symbol
            );
            const item = oneStockDataByDate;
            const lastStock = item?.[item?.length - 1];
            const { isTrue, start, end } = validateCons(
              item,
              selectConsUpDown,
              selectConsDays,
              from
            );
            if (isTrue) {
              dateStockArr.push(lastStock);
            }
          });
          if (dateStockArr?.length === 1) {
            fromCondition[`is60First_${from}`] = true;
            // newData.find(
            //   (n) => n.symbol === stock.symbol && n.datestr === stock.datestr
            // )[`is60First_${from}`] = true;
            //return { ...stock, [`is60First_${from}`]: true };
          } else {
            fromCondition[`is60First_${from}`] = false;
            // newData.find(
            //   (n) => n.symbol === stock.symbol && n.datestr === stock.datestr
            // )[`is60First_${from}`] = false;
            //return { ...stock, [`is60First_${from}`]: false };
          }
        });
        // });
        //return fromCondition;
        setData((data) => {
          const newData = cloneDeep(data);
          Object.keys(fromCondition)?.forEach((key) => {
            newData.find((i) => i.symbol === symbol && i.datestr === addDate)[
              key
            ] = fromCondition[key];
          });
          return newData;
        });
        setIsLoading(false);
      });
  };

  return (
    <div style={{ padding: '20px' }}>
      <div>
        <div>
          <Space>
            推荐删除用：已经涨超
            <Select
              style={{ width: '80px' }}
              value={priceMargin}
              onChange={(v) => {
                setPriceMargin(v);
              }}
              size="small"
            >
              {[5, 10, 20, 30, 40, 50].map((i) => (
                <Select.Option key={i} value={i}>
                  {i}
                </Select.Option>
              ))}
            </Select>
            {'右侧用 涨幅小于'}
            <Select
              style={{ width: '80px' }}
              value={selectType1Price}
              onChange={(v) => {
                setType1Price(v);
              }}
              size="small"
            >
              {[5, 10, 20, 30, 40, 50].map((i) => (
                <Select.Option key={i} value={i}>
                  {i}
                </Select.Option>
              ))}
            </Select>
            {/* <Space>
              
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
            </Space> */}
            {/* <Space>
              {'当前值=最小值用 往前'}
              <Select
                style={{ width: '80px' }}
                value={selectMinPriceDays}
                onChange={(v) => {
                  setSelectMinPriceDays(v);
                }}
                size="small"
              >
                {[5, 10, 20, 30, 40, 50, 60, 90].map((i) => (
                  <Select.Option key={i} value={i}>
                    {i}
                  </Select.Option>
                ))}
              </Select>{' '}
              天
            </Space> */}
            <Button type="primary" onClick={() => alarm()}>
              Alarm
            </Button>
          </Space>
        </div>
        <div>
          <Space>
            Stock:
            <Input
              style={{ width: '100px', height: '32px' }}
              size="small"
              value={inputStock}
              onChange={(e) => setInputStock(e.target.value)}
            />
            Date:
            <DatePicker
              value={moment(selectDate, dateFormat)}
              format={dateFormat}
              onChange={(v: any) => {
                setSelectDate(v.format(dateFormat) ?? null);
              }}
            />
            <Button type="primary" onClick={() => addFocus()}>
              Add
            </Button>
          </Space>
        </div>
        {/* <div>
          <Space>
            关注超过
            <Select
              style={{ width: '80px' }}
              value={selectOverDay}
              onChange={(v) => {
                setSelectOverDay(v);
              }}
              size="small"
            >
              {[0, 60, 70, 80, 90, 100, 120, 150, 180].map((i) => (
                <Select.Option key={i} value={i}>
                  {i}
                </Select.Option>
              ))}
            </Select>
            <Button
              onClick={() => {
                async function handleAllStockData() {
                  const data = await getAllFocusedStocks();
                  setData(
                    data?.filter(
                      (i) => i.datestr < caculateDate(today, selectOverDay)
                    )
                  );
                }
                handleAllStockData();
              }}
            >
              Filter
            </Button>
          </Space>
        </div>{' '} */}
        <div>
          模拟今天是:
          <DatePicker
            value={moment(simulateDate, dateFormat)}
            format={dateFormat}
            onChange={(v: any) => {
              setSimulateDate(v.format(dateFormat));
              async function handleAllStockData() {
                const data = await getAllFocusedStocks(v.format(dateFormat));
                setData(data);
              }
              handleAllStockData();
            }}
          />
        </div>
        <div>
          {/* <Space>
            筛选没看过的，view_date距离今天有
            <Input
              type="number"
              value={viewedToToday}
              onChange={(e) => setViewedToToday(e?.target?.value as any)}
            />
            个自然日
          </Space> */}
          {/* <Button
            type={isFilterd ? 'primary' : 'default'}
            onClick={() => {
              async function handleAllStockData() {
                const data = await getAllFocusedStocks(
                  simulateDate,
                  viewedToToday,
                  !isFilterd
                );
                setIsFilterd(!isFilterd);
                setData(data);
              }
              handleAllStockData();
            }}
          ></Button> */}
        </div>
        <div>
          StartDate:
          <DatePicker
            format={dateFormat}
            onChange={(v: any) => {
              setStartDate(v?.format(dateFormat) ?? null);
            }}
          />
          {' < AddDate < EndDate:'}
          <DatePicker
            format={dateFormat}
            onChange={(v: any) => {
              setEndDate(v?.format(dateFormat) ?? null);
            }}
          />
          <Button onClick={filterListByAddDate}>Filter in list</Button>
        </div>
        <div>
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
        </div>
      </div>

      {(alarmType1?.length > 0 ||
        alarmType2?.length > 0 ||
        alarmType3?.length > 0 ||
        alarmType4?.length > 0 ||
        moretimeStocks?.length > 0) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexDirection: 'column',
          }}
        >
          {/*<div
            style={{
              border: '2px solid #f33875',
              padding: '10px',
              marginBottom: '10px',
            }}
          >
            推荐关注-横盘：
            <Button
              onClick={() => {
                filterInAlarm(alarmType4?.map((i) => i.symbol));
                setCurrentAlarmList('d');
              }}
            >
              Filter in List
            </Button>
            <br />
            {orderBy(alarmType4, 'datestr', 'desc')?.map((i) => (
              <Tag className="stock-tag">
                <a
                  target="_blank"
                  href={`https://quote.eastmoney.com/${i.symbol}.html`}
                >
                  {`${i.symbol}_${i.name}`}
                </a>
              </Tag>
            ))}
          </div>*/}
          <div
            style={{
              border: '2px solid #46a865',
              padding: '10px',
              marginBottom: '10px',
            }}
          >
            推荐删除：
            <Button
              onClick={() => {
                filterInAlarm(alarmType2?.map((i) => i.symbol));
                setCurrentAlarmList('b');
              }}
            >
              Filter in List
            </Button>
            <br />
            {alarmType2?.map((i) => (
              <Popconfirm
                title="Sure to delete?"
                onConfirm={() =>
                  post('/api/delete_da_focus', {
                    body: JSON.stringify({
                      symbol: i?.symbol,
                      datestr: i?.datestr,
                    }),
                  }).then(() => {
                    setData((data) =>
                      data?.filter((e) => e?.symbol !== i?.symbol)
                    );
                  })
                }
              >
                <Tag
                  className="stock-tag"
                  style={{ cursor: 'pointer' }}
                >{`${i.symbol}_${i.name}`}</Tag>
              </Popconfirm>
            ))}
          </div>
          <div
            style={{
              border: '2px solid #f33875',
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: '#f4f469',
            }}
          >
            极力推荐关注- 出现拐点（当前值大于最小值）：
            <Button
              onClick={() => {
                filterInAlarm(alarmType1?.map((i) => i.symbol));
                setCurrentAlarmList('a');
              }}
            >
              Filter in List
            </Button>
            <br />
            {orderBy(alarmType1, 'datestr', 'desc')?.map((i) => (
              <Tag className="stock-tag" color={i.added && 'red'}>
                <a
                  target="_blank"
                  href={`https://quote.eastmoney.com/${i.symbol}.html`}
                >
                  {`${i.symbol}_${i.name}_${i.datestr}`}
                </a>
              </Tag>
            ))}
          </div>
          <div
            style={{
              border: '2px solid #f33875',
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: '#f4f469',
            }}
          >
            推荐关注 （当前值 = 最小值）从加入那天起：
            <Button
              onClick={() => {
                filterInAlarm(alarmType3?.map((i) => i.symbol));
                setCurrentAlarmList('c');
              }}
            >
              Filter in List
            </Button>
            <br />
            {orderBy(alarmType3, 'datestr', 'desc')?.map((i) => (
              <Tag className="stock-tag">
                <a
                  target="_blank"
                  href={`https://quote.eastmoney.com/${i.symbol}.html`}
                >
                  {`${i.symbol}_${i.name}_${i.datestr}`}
                </a>
              </Tag>
            ))}
          </div>
          <div
            style={{
              border: '2px solid #f33875',
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: '#f4f469',
            }}
          >
            加入多次：
            <Button
              onClick={() => {
                filterInAlarm(moretimeStocks?.map((i) => i.symbol));
                setCurrentAlarmList('f');
              }}
            >
              Filter in List
            </Button>
            <br />
            {orderBy(moretimeStocks, 'datestr', 'desc')?.map((i) => (
              <Tag className="stock-tag">
                <a
                  target="_blank"
                  href={`https://quote.eastmoney.com/${i.symbol}.html`}
                >
                  {`${i.symbol}_${i.name}_${i.datestr}`}
                </a>
              </Tag>
            ))}
          </div>
          {/*<div
            style={{
              border: '2px solid #f33875',
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: '#f4f469',
            }}
          >
            推荐关注 （当前值 = 最小值）从多少天以前起：
            <Button
              onClick={() => {
                filterInAlarm(alarmType5?.map((i) => i.symbol));
                setCurrentAlarmList('e');
              }}
            >
              Filter in List
            </Button>
            <br />
            {orderBy(alarmType5, 'datestr', 'desc')?.map((i) => (
              <Tag className="stock-tag">
                <a
                  target="_blank"
                  href={`https://quote.eastmoney.com/${i.symbol}.html`}
                >
                  {`${i.symbol}_${i.name}_${i.datestr}`}
                </a>
              </Tag>
            ))}
          </div>*/}
          <div
            style={{
              border: '2px solid #46a865',
              padding: '10px',
              marginBottom: '10px',
            }}
          >
            占比：
            <br />
            极力推荐关注:{`${alarmType1?.length}/${data?.length}  `}
            推荐关注:{`${alarmType3?.length}/${data?.length}  `}
            横盘:{`${alarmType4?.length}/${data?.length}  `}
            推荐删除:{`${alarmType2?.length}/${data?.length}`}
          </div>
        </div>
      )}
      <div>当前列表是: {listMap?.[currentAlarmList]}</div>
      <Table
        loading={isLoading}
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={data}
      />
      <Modal
        title="Check Before Dates Modal"
        visible={isBeforeDatesModalVisible}
        onCancel={() => setIsBeforeDatesModalVisible(false)}
        footer={[
          <Button
            onClick={() => setIsBeforeDatesModalVisible(false)}
            type="primary"
          >
            OK
          </Button>,
        ]}
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
          Days Till{' '}
          <DatePicker
            defaultValue={moment(oneStockDate, dateFormat)}
            format={dateFormat}
            value={moment(oneStockDate, dateFormat)}
            onChange={(v: any) => setOneStockDate(v.format(dateFormat))}
          />
          <Select
            style={{ width: '180px' }}
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
        <ReactEcharts
          style={{ height: 350, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={oneStockAfterChartOption}
        />
      </Modal>
    </div>
  );
};
