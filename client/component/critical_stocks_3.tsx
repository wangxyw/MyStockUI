import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import ReactEcharts from 'echarts-for-react';

import React, { useEffect, useState } from 'react';
import { get, post } from '../lib';
import { caculateDate, caculateDaysTwoDate } from './alarm';
import moment from 'moment';
import './alarm.css';
import DATA from './date.json';
import { uniqBy, isEmpty, orderBy } from 'lodash';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

const options = (data) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const xAxis = orderedData?.map((i) => i.datestr);
  const maxT = orderedData?.map((i) =>
    i?.turnoverrates_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b))
  );
  const averageT = orderedData?.map((i) =>
    (
      i?.turnoverrates_str
        ?.split('|')
        ?.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) /
      i?.turnoverrates_str?.split('|')?.length
    )?.toFixed(2)
  );
  const minT = orderedData?.map((i) =>
    i?.turnoverrates_str
      ?.split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a))
  );
  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['MaxOverRate', 'MinOverRate', 'AverageOverRate'],
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
      data: xAxis,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'MaxOverRate',
        type: 'line',
        data: maxT,
        // itemStyle: {
        //   normal: {
        //     color: '#444',
        //   },
        // },
        label: {
          position: 'top',
        },
      },
      {
        name: 'MinOverRate',
        type: 'line',
        data: minT,
        // itemStyle: {
        //   normal: {
        //     color: function (params) {
        //       var colorList;
        //       if (statusArr[params.dataIndex] == 'up') {
        //         colorList = '#ef232a';
        //       } else if (statusArr[params.dataIndex] == 'down') {
        //         colorList = '#14b143';
        //       }
        //       return colorList;
        //     },
        //   },
        // },
      },
      {
        name: 'AverageOverRate',
        type: 'line',
        data: averageT,
        // itemStyle: {
        //   normal: {
        //     color: 'blue',
        //   },
        // },
      },
    ],
  };
};

const MergeOptions = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');

  const allData = orderBy([...orderedData, ...orderedDownData], 'datestr')?.map(
    (i) => i.datestr
  );

  const xAxis = orderedData?.map((i) => i.datestr);
  const maxT = orderedData?.map((i) => ({
    value: i?.turnoverrates_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)),
    datestr: i.datestr,
  }));

  const minT = orderedData?.map((i) => ({
    value: i?.turnoverrates_str
      ?.split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a)),
    datestr: i.datestr,
  }));
  const maxDownT = orderedDownData?.map((i) => ({
    value: i?.turnoverrates_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)),
    datestr: i.datestr,
  }));

  const minDownT = orderedDownData?.map((i) => ({
    value: i?.turnoverrates_str
      ?.split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a)),
    datestr: i.datestr,
  }));

  const maxTValues = allData?.map((i) =>
    maxT?.find((m) => m.datestr === i)
      ? maxT?.find((m) => m.datestr === i).value
      : '-'
  );
  const minTValues = allData?.map((i) =>
    minT?.find((m) => m.datestr === i)
      ? minT?.find((m) => m.datestr === i).value
      : '-'
  );
  const maxDownValues = allData?.map((i) =>
    maxDownT?.find((m) => m.datestr === i)
      ? maxDownT?.find((m) => m.datestr === i).value
      : '-'
  );
  const minDownValues = allData?.map((i) =>
    minDownT?.find((m) => m.datestr === i)
      ? minDownT?.find((m) => m.datestr === i).value
      : '-'
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: [
        'MaxOverRate',
        'MinOverRate',
        'DownMaxOverRate',
        'DownMinOverRate',
      ],
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
      data: allData,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'MaxOverRate',
        type: 'line',
        data: maxTValues,
        symbol: 'diamond',
        symbolSize: 10,
        itemStyle: {
          normal: {
            color: '#d50937',
          },
        },
        label: {
          position: 'top',
        },
      },
      {
        name: 'MinOverRate',
        type: 'line',
        symbol: 'diamond',
        symbolSize: 10,

        itemStyle: {
          normal: {
            color: '#e07b7b',
          },
        },
        data: minTValues,
        // itemStyle: {
        //   normal: {
        //     color: function (params) {
        //       var colorList;
        //       if (statusArr[params.dataIndex] == 'up') {
        //         colorList = '#ef232a';
        //       } else if (statusArr[params.dataIndex] == 'down') {
        //         colorList = '#14b143';
        //       }
        //       return colorList;
        //     },
        //   },
        // },
      },
      {
        name: 'DownMaxOverRate',
        type: 'line',
        symbol: 'diamond',
        symbolSize: 10,

        data: maxDownValues,
        itemStyle: {
          normal: {
            color: '#338e06',
          },
        },
      },
      {
        name: 'DownMinOverRate',
        type: 'line',
        symbol: 'diamond',
        symbolSize: 10,

        data: minDownValues,
        itemStyle: {
          normal: {
            color: '#8bac7b',
          },
        },
      },
    ],
  };
};
const curDate = new Date();
const year = curDate.getFullYear();
const month = curDate.getMonth() + 1;
const day = curDate.getDate();
const dateFormat = 'YYYY-MM-DD';
const today = moment(`${year}-${month}-${day}`).format(dateFormat);
const workDays = DATA.workday;
async function getAllCriStocks(
  startDate: any = null,
  endDate: any = 0,
  from: any = false,
  stock,
  isFocused,
  isDown = false
) {
  const stockData = await get(
    `/api/critical_data3?start_date=${startDate}&end_date=${endDate}&from=${from}&stock=${stock}&isFocused=${isFocused}&isDown=${isDown}`
  );
  // const stockPriceByDay =
  //   stockData?.length > 0
  //     ? await post(`/api/get_price_from_common_data`, {
  //         body: JSON.stringify({
  //           stocks: stockData.map((i) => `'${i.symbol}'`).join(','),
  //           today: caculateDate(endDate, 0),
  //         }),
  //       })
  //     : stockData;
  // const stockEachDayPriceData =
  //   stockData?.length > 0
  //     ? await post(`/api/get_price_from_common_data`, {
  //         body: JSON.stringify({
  //           stocks: stockData.map((i) => `'${i.symbol}'`).join(','),
  //           simulateDate: caculateDate(today, 0),
  //           startDate: '2023-01-01',
  //         }),
  //       })
  //     : stockData;
  return stockData;
  // .map((i) => ({
  //   ...i,
  //   todayPrice: stockPriceByDay?.find((s) => s.symbol === i.symbol)?.finalprice,
  //   todayProfit: stockPriceByDay?.find((s) => s.symbol === i.symbol)
  //     ?.profit_chip,
  //   // daysProfit: stockEachDayPriceData
  //   //   ?.filter((s) => s.symbol === i.symbol)
  //   //   ?.map((e) => ({ datestr: e.datestr, profit: e.profit_chip })),
  // }));
}

export const CriticalStocks3Component = () => {
  const [data, setData] = useState<any>([]);
  const [downData, setDownData] = useState<any>();
  const [startDate, setStartDate] = useState(caculateDate(today, 10));
  const [endDate, setEndDate] = useState(today);
  const [from, setFrom] = useState('400s');
  const [searchStock, setSearchStock] = useState<string>();
  const [givenPrice, setGivenPrice] = useState(10);
  const [givenMinPrice, setGivenMinPrice] = useState(0);
  const [givenCirculation, setGivenCirculation] = useState(20);
  const [givenMinCirculation, setGivenMinCirculation] = useState(0);
  const [givenPreIncreaseLimitation, setGivenPreIncreaseLimitation] = useState(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const [upOptions, setUpOptions] = useState({});
  const [downOptions, setDownOptions] = useState({});
  const [mergeOptions, setMergeOptions] = useState({});

  console.log('data', data);
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
              <br />
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
          </>
        );
      },
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      //defaultSortOrder: 'descend',
      sorter: (a: any, b: any): any => {
        return (
          Number(a.end_date.replaceAll('-', '')) -
          Number(b.end_date.replaceAll('-', ''))
        );
      },
      render: (c, record) => {
        return (
          <>
            <span>{c}</span>
          </>
        );
      },
    },
    {
      title: 'Days',
      dataIndex: 'days',
      key: 'days',
      render: (c, record) => {
        return (
          <>
            <span>{c}</span>
          </>
        );
      },
    },
    {
      title: 'Days Str',
      dataIndex: 'days_str',
      key: 'days_str',
      width: '40%',
      render: (c, record) => {
        return (
          <>
            <span>{c}</span>
          </>
        );
      },
    },
    {
      title: 'Profit Chips Str',
      dataIndex: 'profit_chips_str',
      key: 'profit_chips_str',
      //width: '10%',
      render: (c, record) => {
        return (
          <>
            <div>
              <span>
                <b>Max:</b>
              </span>
              <span>
                {c
                  ?.split('|')
                  .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b))}
              </span>
            </div>
            <div>
              <span>
                <b>Min:</b>
              </span>
              <span>
                {c
                  ?.split('|')
                  .reduce((a, b) => (parseFloat(a) < parseFloat(b) ? a : b))}
              </span>
            </div>
            <div>
              <b>T_D:</b> {record?.latest_profit_chips}
            </div>
          </>
        );
      },
    },
    // {
    //   title: 'To Date Profit Chip',
    //   dataIndex: 'todayProfit',
    //   key: 'todayProfit',
    //   sorter: (a: any, b: any): any => {
    //     return Number(a.todayProfit) - Number(b.todayProfit);
    //   },
    //   render: (c, record) => {
    //     return (
    //       <>
    //         <span>{c}</span>
    //       </>
    //     );
    //   },
    // },
    {
      title: 'Max Profit - To Date Profit Chip',
      dataIndex: 'latest_profit_chips',
      key: 'latest_profit_chips',
      sorter: (a: any, b: any): any => {
        const sorter = (sortBy) =>
          (
            sortBy?.profit_chips_str
              ?.split('|')
              .reduce((e, f) => (parseFloat(e) > parseFloat(f) ? e : f)) -
            sortBy.latest_profit_chips
          ).toFixed(2);
        return Number(sorter(a)) - Number(sorter(b));
      },
      render: (c, record) => {
        return (
          <>
            <div>
              <span>
                {(
                  record?.profit_chips_str
                    ?.split('|')
                    .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)) -
                  c
                ).toFixed(2)}{' '}
              </span>
            </div>
          </>
        );
      },
    },
    {
      title: 'Max TurnOverRate',
      dataIndex: 'turnoverrates_str',
      key: 'turnoverrates_str',
      sorter: (a: any, b: any): any => {
        const sorter = (sortBy) =>
          sortBy?.turnoverrates_str
            ?.split('|')
            .reduce((e, f) => (parseFloat(e) > parseFloat(f) ? e : f));
        return Number(sorter(a)) - Number(sorter(b));
      },
      render: (c, record) => {
        const maxRate = c
          ?.split('|')
          .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b));
        const averageRate = (
          c?.split('|')?.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) /
          c?.split('|')?.length
        )?.toFixed(2);
        const minRate = c
          ?.split('|')
          .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a));
        return (
          <>
            <div>
              <span style={{ color: 'red' }}>
                <b>Max:</b> {maxRate}
              </span>
            </div>
            <div>
              <b>Average:</b> {averageRate}
            </div>
            <div>
              <b>Min:</b> {minRate}
            </div>
          </>
        );
      },
    },
    {
      title: '90 Max Min Price',
      dataIndex: 'day90_max_min',
      key: 'day90_max_min',
      sorter: (a: any, b: any): any => {
        const sorter = (sortBy) =>
          sortBy?.turnoverrates_str
            ?.split('|')
            .reduce((e, f) => (parseFloat(e) > parseFloat(f) ? e : f));
        return Number(sorter(a)) - Number(sorter(b));
      },
      render: (c, record) => {
        const maxPrice = parseFloat(c?.split(',')?.[0]);
        const minPrice = parseFloat(c?.split(',')?.[1]);
        const currentPrice = parseFloat(record?.latest_finalprice);
        return (
          <>
            <div>
              <b>Max:</b> {maxPrice}
            </div>
            <div>T_D: {currentPrice}</div>
            <div>
              <b>Min:</b> {minPrice}
            </div>
            <div>
              <span style={{ color: 'red' }}>
                <b>Ma - Mi:</b>{' '}
                {(((maxPrice - minPrice) / minPrice) * 100)?.toFixed(2) + '%'}
              </span>
            </div>
            <div>
              Ma - Td:{' '}
              {(((maxPrice - currentPrice) / currentPrice) * 100)?.toFixed(2) +
                '%'}
            </div>
          </>
        );
      },
    },
    // {
    //   title: 'Profit K',
    //   dataIndex: 'todayProfit',
    //   key: 'todayProfit',
    //   sorter: (a: any, b: any): any => {
    //     const sort = (by) => {
    //       const maxProfit = by?.profit_chips_str
    //         ?.split('|')
    //         .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b));
    //       const maxProfitIndex = by?.profit_chips_str
    //         ?.split('|')
    //         ?.indexOf(maxProfit);
    //       const maxProfitDay = by?.days_str?.split('|')?.[maxProfitIndex];
    //       const maxToOneDay = by?.daysProfit?.filter(
    //         (e) => e?.datestr > maxProfitDay
    //       );
    //       const minProfitMap =
    //         maxToOneDay?.length > 0 &&
    //         maxToOneDay?.reduce((a, b) => (a.profit < b.profit ? a : b));
    //       const minProfit = minProfitMap?.profit;
    //       const minProfitDay = minProfitMap?.datestr;
    //       const days = caculateDaysTwoDate(maxProfitDay, minProfitDay);
    //       return ((maxProfit - minProfit) / days)?.toFixed(2);
    //     };
    //     return Number(sort(a)) - Number(sort(b));
    //   },
    //   render: (c, record) => {
    //     const maxProfit = record?.profit_chips_str
    //       ?.split('|')
    //       .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b));
    //     const maxProfitIndex = record?.profit_chips_str
    //       ?.split('|')
    //       ?.indexOf(maxProfit);
    //     const maxProfitDay = record?.days_str?.split('|')?.[maxProfitIndex];
    //     const maxToOneDay = record?.daysProfit?.filter(
    //       (e) => e?.datestr >= maxProfitDay
    //     );
    //     const minProfitMap =
    //       maxToOneDay?.length > 0 &&
    //       maxToOneDay?.reduce((a, b) => (a.profit < b.profit ? a : b));
    //     const minProfit = minProfitMap?.profit;
    //     const minProfitDay = minProfitMap?.datestr;
    //     const days = caculateDaysTwoDate(maxProfitDay, minProfitDay) || 1;
    //     const K = ((maxProfit - minProfit) / days)?.toFixed(2);

    //     return (
    //       <>
    //         <div>
    //           <div>K: {K}</div>
    //           <div style={{ color: '#c7c1c1' }}>
    //             <p>
    //               MaxProfit:{maxProfit}/{maxProfitDay}
    //             </p>
    //             <p>
    //               MinProFit: {minProfit}/{minProfitDay}
    //             </p>
    //           </div>
    //         </div>
    //       </>
    //     );
    //   },
    // },
    // {
    //   title: 'To Date Final Price',
    //   dataIndex: 'todayPrice',
    //   key: 'todayPrice',
    //   sorter: (a: any, b: any): any => {
    //     const aDiff = (a.todayPrice - a.finalprice) / a.finalprice;
    //     const bDiff = (b.todayPrice - b.finalprice) / b.finalprice;
    //     return Number(aDiff) - Number(bDiff);
    //   },
    //   render: (c, record) => {
    //     const isUp = c - record.finalprice > 0;
    //     const arrow = !isUp ? (
    //       <ArrowDownOutlined style={{ color: 'green' }} />
    //     ) : (
    //       <ArrowUpOutlined style={{ color: 'red' }} />
    //     );
    //     const diff = (c - record.finalprice) / record.finalprice;
    //     return (
    //       <>
    //         <div>
    //           <Tag color={diff > 0 ? 'red' : 'green'}>
    //             {arrow}
    //             {c}/{(diff * 100).toFixed(2) + '%'}
    //           </Tag>
    //         </div>
    //         <div>
    //           <Tag>
    //             {endDate} <br /> {c}
    //           </Tag>
    //         </div>
    //       </>
    //     );
    //   },
    // },
    {
      title: 'End Date Final Price',
      dataIndex: 'finalprice',
      key: 'finalprice',
      render: (c, record) => {
        return (
          <>
            <span>{c}</span>
          </>
        );
      },
    },
    // {
    //   title: 'Big Order Pcts Str',
    //   dataIndex: 'big_order_pcts_str',
    //   key: 'big_order_pcts_str',
    //   //width: '10%',
    //   render: (c, record) => {
    //     return (
    //       <>
    //         <div>
    //           <span>Max:</span>
    //           <span>
    //             {c
    //               ?.split('|')
    //               .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b))}
    //           </span>
    //         </div>
    //         <div>
    //           <span>Min:</span>
    //           <span>
    //             {c
    //               ?.split('|')
    //               .reduce((a, b) => (parseFloat(a) < parseFloat(b) ? a : b))}
    //           </span>
    //         </div>
    //       </>
    //     );
    //   },
    // },
    {
      title: 'MixMaxTORChange',
      dataIndex: 'mix_turnoverrates_changes',
      key: 'mix_turnoverrates_changes',
      render: (c, record) => {
        return (
          <>
            <span style={{ color: 'red' }}>
              <b>{c?.split(',')?.[0]}</b>
            </span>
            <br />
            <span>{c?.split(',')?.[1]}</span>
            <br />
            <span>{c?.split(',')?.[2]}</span>
          </>
        );
      },
    },
    {
      title: 'MaxTORChange',
      dataIndex: 'turnoverrates_changes',
      key: 'turnoverrates_changes',
      render: (c, record) => {
        return (
          <>
            <span style={{ color: 'red' }}>
              <b>{c?.split(',')?.[0]}</b>
            </span>
            <br />
            <span>{c?.split(',')?.[1]}</span>
            <br />
            <span>{c?.split(',')?.[2]}</span>
          </>
        );
      },
    },
    // {
    //   title: 'MarketValue',
    //   dataIndex: 'marketvalue',
    //   key: 'marketvalue',
    //   render: (c, record) => {
    //     return (
    //       <>
    //         <span>{(c / record.finalprice).toFixed(2)}</span>
    //         <br />
    //         <span>
    //           <b>P_D:</b> {record?.per_dynamic}
    //         </span>
    //         <br />
    //         <span>
    //           <b>P_S:</b> {record?.per_static}
    //         </span>
    //       </>
    //     );
    //   },
    // },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (c, record) => {
        return (
          <>
            <span>{c}</span>
          </>
        );
      },
    },
  ];

  useEffect(() => {
    async function handleAllStockData() {
      setIsLoading(true);
      const data = await getAllCriStocks(
        startDate,
        endDate,
        from,
        searchStock,
        isFocused
      );
      const downData = await getAllCriStocks(
        startDate,
        endDate,
        from,
        searchStock,
        isFocused,
        true
      );
      setData(data);
      setDownData(downData);
      setIsLoading(false);
    }
    handleAllStockData();
  }, [startDate, endDate, from, isFocused]);

  return (
    <div style={{ padding: '20px' }}>
      <div>
        From:
        <DatePicker
          defaultValue={moment(startDate, dateFormat)}
          format={dateFormat}
          onChange={(v: any) => setStartDate(v.format(dateFormat))}
        />
        To:
        <DatePicker
          defaultValue={moment(endDate, dateFormat)}
          format={dateFormat}
          onChange={(v: any) => setEndDate(v.format(dateFormat))}
        />
        <Select
          style={{ width: '80px' }}
          value={from}
          onChange={(v) => {
            setFrom(v);
          }}
          size="small"
        >
          {['400s', '100w', 'dr_100s', 'dr_400s', 'dr_100w'].map((i) => (
            <Select.Option key={i} value={i}>
              {i}
            </Select.Option>
          ))}
        </Select>
        Symbol:
        <Input
          style={{ width: '100px' }}
          value={searchStock}
          onChange={(e) => setSearchStock(e.target.value)}
        />
        IsFocused:
        <Checkbox
          checked={isFocused}
          onChange={() => setIsFocused(!isFocused)}
        />
      </div>
      <div>
        <Space
          style={{
            padding: '10px',
            boxShadow: '1px 1px 3px #ccc',
            //background: `${hasCondition3 ? SELECT_COLOR : '#fff'}`,
          }}
        >
          <Space
            style={{
              padding: '10px',
              boxShadow: '1px 1px 3px #ccc',
              //background: `${hasCondition6 ? SELECT_COLOR : '#fff'}`,
            }}
          >
            <InputNumber
              min={1}
              max={500}
              value={givenMinPrice}
              onChange={setGivenMinPrice}
            />
            元<span>{'< Final Price<'}</span>{' '}
            <InputNumber
              min={1}
              max={500}
              value={givenPrice}
              onChange={setGivenPrice}
            />
            元
          </Space>
        </Space>
        <Space
          style={{
            padding: '10px',
            boxShadow: '1px 1px 3px #ccc',
            marginLeft: '10px',
            // background: `${hasCondition4 ? SELECT_COLOR : '#fff'}`,
          }}
        >
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
        <Space
          style={{
            padding: '10px',
            boxShadow: '1px 1px 3px #ccc',
            marginLeft: '10px',
            // background: `${hasCondition4 ? SELECT_COLOR : '#fff'}`,
          }}
        >
          <span>{'前期涨幅<'}</span>
          <InputNumber
            min={0}
            max={500}
            value={givenPreIncreaseLimitation}
            onChange={setGivenPreIncreaseLimitation}
          />%
        </Space>
        <Button
          onClick={() => {
            async function handleAllStockData() {
              setIsLoading(true);
              const data = await getAllCriStocks(
                startDate,
                endDate,
                from,
                searchStock,
                isFocused
              );
              const downData = await getAllCriStocks(
                startDate,
                endDate,
                from,
                searchStock,
                isFocused,
                true
              );
              if (searchStock) {
                setUpOptions(options(data));
                setDownOptions(options(downData));
                setMergeOptions(MergeOptions(data, downData));
              }
              setData(
                searchStock && searchStock.substr(0, 6) != 'xywang'
                  ? data
                  : data?.filter((s) => {
                      // console.log(
                      //   s.marketvalue / s.finalprice < givenCirculation &&
                      //     s.marketvalue / s.finalprice > givenMinCirculation
                      // );
                      let circulationCondition = false;
                      if (givenMinCirculation) {
                        circulationCondition =
                          s.marketvalue / s.finalprice < givenCirculation &&
                          s.marketvalue / s.finalprice > givenMinCirculation;
                      } else {
                        circulationCondition =
                          s.marketvalue / s.finalprice < givenCirculation;
                      }
                      let priceCondition = false;
                      if (givenMinPrice) {
                        priceCondition =
                          s.finalprice < givenPrice &&
                          s.finalprice > givenMinPrice;
                      } else {
                        priceCondition = s.finalprice < givenPrice;
                      }
                      let maxMinLimitCondition = false;
                      if (givenPreIncreaseLimitation) {
                        let maxPrice = parseFloat(s.day90_max_min?.split(',')?.[0]);
                        let minPrice = parseFloat(s.day90_max_min?.split(',')?.[1]);
                        if ((((maxPrice - minPrice) / minPrice) * 100)?.toFixed(2) < givenPreIncreaseLimitation) {
                          maxMinLimitCondition = true
                        } else {
                          maxMinLimitCondition = false
                        }
                      } else {
                        maxMinLimitCondition = true
                      }
                      return circulationCondition && priceCondition && maxMinLimitCondition;
                    })
              );
              setDownData(
                searchStock && searchStock.substr(0, 6) != 'xywang'
                  ? downData
                  : downData?.filter((s) => {
                      // console.log(
                      //   s.marketvalue / s.finalprice < givenCirculation &&
                      //     s.marketvalue / s.finalprice > givenMinCirculation
                      // );
                      let circulationCondition = false;
                      if (givenMinCirculation) {
                        circulationCondition =
                          s.marketvalue / s.finalprice < givenCirculation &&
                          s.marketvalue / s.finalprice > givenMinCirculation;
                      } else {
                        circulationCondition =
                          s.marketvalue / s.finalprice < givenCirculation;
                      }
                      let priceCondition = false;
                      if (givenMinPrice) {
                        priceCondition =
                          s.finalprice < givenPrice &&
                          s.finalprice > givenMinPrice;
                      } else {
                        priceCondition = s.finalprice < givenPrice;
                      }
                      let maxMinLimitCondition = false;
                      if (givenPreIncreaseLimitation) {
                        let maxPrice = parseFloat(s.day90_max_min?.split(',')?.[0]);
                        let minPrice = parseFloat(s.day90_max_min?.split(',')?.[1]);
                        if ((((maxPrice - minPrice) / minPrice) * 100)?.toFixed(2) < givenPreIncreaseLimitation) {
                          maxMinLimitCondition = true
                        } else {
                          maxMinLimitCondition = false
                        }
                      } else {
                        maxMinLimitCondition = true
                      }
                      return circulationCondition && priceCondition && maxMinLimitCondition;
                    })
              );
              setIsLoading(false);
            }
            handleAllStockData();
          }}
        >
          Search
        </Button>
      </div>
      UPUP:
      {!isEmpty(upOptions) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={upOptions}
        />
      )}
      DownDown:
      {!isEmpty(downOptions) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={downOptions}
        />
      )}
      UPDown:
      {!isEmpty(mergeOptions) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeOptions}
        />
      )}
      UPList:
      <Table
        loading={isLoading}
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={data}
      />
      DownList:
      <Table
        loading={isLoading}
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={downData}
      />
    </div>
  );
};
