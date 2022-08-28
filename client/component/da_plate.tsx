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
  Checkbox,
  Tag,
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
import { basename } from 'path';

const hangyeMap = [
  { value: 'sinahy', name: '新浪行业' },
  { value: 'swhy', name: '申万行业' },
  { value: 'sw1_hy', name: '申万一级' },
  { value: 'sw2_hy', name: '申万二级' },
  { value: 'sw3_hy', name: '申万三级' },
  { value: 'ch_gn', name: '热门概念' },
  { value: 'gainianbankuai', name: '概念板块' },
  { value: 'diyu', name: '地域板块' },
];


export const pullWorkDaysArray = (date, days) => {
  const endIndex = workdays.indexOf(caculateDate(date, 0));
  const workDaysArray = workdays.slice(endIndex - days + 1, endIndex + 1);
  return workDaysArray;
};
const pName = (p, seriesIndex) => {
  if (seriesIndex === 0) {
    return p.firstLabel;
  }
  if (seriesIndex === 1) {
    return p.secondLabel;
  }
  if (seriesIndex === 2) {
    return p.thirdLabel;
  }
};
const pStocks = (p, seriesIndex) => {
  if (seriesIndex === 0) {
    return p.firstStocks;
  }
  if (seriesIndex === 1) {
    return p.secondStocks;
  }
  if (seriesIndex === 2) {
    return p.thirdStocks;
  }
};
const dapanOption = (data) => {
  const xData = data?.map((i) => i?.datestr);
  const labelOption = {
    show: true,
    position: 'insideBottom',
    distance: 15,
    align: 'left',
    verticalAlign: 'middle',
    rotate: 90,
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
    fontSize: 12,
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
const dateOptions = (data) => {
  const xData = data?.map((i) => i?.datestr);
  const labelOption = {
    show: true,
    position: 'insideBottom',
    distance: 15,
    align: 'left',
    verticalAlign: 'middle',
    rotate: 90,
    formatter: (params) => {
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
    fontSize: 12,
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
    // legend: {
    //   data: ['First', 'Second', 'Third'],
    // },
    // toolbox: {
    //   show: true,
    //   orient: 'vertical',
    //   left: 'right',
    //   top: 'center',
    //   feature: {
    //     mark: { show: true },
    //     dataView: { show: true, readOnly: false },
    //     magicType: { show: true, type: ['line', 'bar', 'stack'] },
    //     restore: { show: true },
    //     saveAsImage: { show: true },
    //   },
    // },
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
        data: data?.map((i) => i.count),
      },
    ],
  };
};

const weighingOptions = (data) => {
  const sortData = Object.entries(data).sort((x: any, y: any) => y[1] - x[1]);
  return {
    title: { text: '加权图' },
    xAxis: {
      type: 'category',
      data: sortData.map((i) => i[0]),
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: sortData.map((i) => i[1]),
        type: 'bar',
        showBackground: true,
        backgroundStyle: {
          color: 'rgba(180, 180, 180, 0.2)',
        },
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
  const [stockData, setStockData] = useState<any>();
  const [tableData, setTableData] = useState<any>([]);
  const [isPercent, setIsPercent] = useState<any>(false);
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
  const [selectPriceMargin, setSelectPriceMargin] = useState(4);
  const [caculatePriceBy, setCaculatePriceBy] = useState(false);
  const [option, setOption] = useState<any>({});
  const [from100, setFrom100] = useState<boolean>(false);
  const [curPlate, setCurPlate] = useState<any>('');
  const [curStocks, setCurStocks] = useState<any>([]);
  const [curStockDate, setCurStockDate] = useState<any>('');
  const [curPlateByDate, setCurPlateByDate] = useState<any>({});
  const [weighingOption, setWeighingOption] = useState<any>({});
  const [selectHangye, setSelectHangye] = useState<any>('sw1_hy');
  const [plateCount, setPlateCount] = useState<any>([]);
  const composeData = (data) => {
    return Object.keys(data).map((date) => {
      const stocks = data[date];
      let allPlates: any = [];
      stocks?.forEach((stock) => {
        const plates = stock.platecode?.split(',');
        allPlates.push(...(plates ?? []));
      });
      //caculate duplicate in one array//
      const count = allPlates?.reduce((prev, next) => {
        prev[next] = prev[next] + 1 || 1;
        return prev;
      }, {});
      let result: any[] = [];
      if (isPercent) {
        const percentMap = {};
        Object.keys(count).forEach((c) => {
          percentMap[c] = (
            count[c] / plateCount?.find((p) => c === p.business_code)?.count
          )?.toFixed(2);
        });
        result = Object.entries(percentMap).sort(
          (x: any, y: any) => y[1] - x[1]
        );
      } else {
        result = Object.entries(count).sort((x: any, y: any) => y[1] - x[1]);
      }
      const resultWithStocks = result?.map((i) => {
        return [
          plateCount?.find((p) => i[0] === p.business_code)?.name,
          i[1],
          stocks?.filter((s) => s?.platecode?.split(',')?.includes(i[0])),
        ];
      });

      return {
        datestr: date,
        firstCount: resultWithStocks[0]?.[1],
        secondCount: resultWithStocks[1]?.[1],
        thirdCount: resultWithStocks[2]?.[1],
        forthCount: resultWithStocks[3]?.[1],
        fifthCount: resultWithStocks[4]?.[1],
        sixthCount: resultWithStocks[5]?.[1],
        firstLabel: resultWithStocks[0]?.[0],
        secondLabel: resultWithStocks[1]?.[0],
        thirdLabel: resultWithStocks[2]?.[0],
        forthLabel: resultWithStocks[3]?.[0],
        fifthLabel: resultWithStocks[4]?.[0],
        sixthLabel: resultWithStocks[5]?.[0],
        firstStocks: resultWithStocks[0]?.[2],
        secondStocks: resultWithStocks[1]?.[2],
        thirdStocks: resultWithStocks[2]?.[2],
        forthStocks: resultWithStocks[3]?.[2],
        fifthStocks: resultWithStocks[4]?.[2],
        sixthStocks: resultWithStocks[5]?.[2],
      };
    });
  };

  useEffect(() => {
    get(`/api/all_plates_count`, { method: 'GET' }).then((res) => {
      setPlateCount(res);
    });
  }, []);

  const runAnalysis = () => {
    setIsLoading(true);
    let days = parseInt(selectDays, 10) + parseInt(selectConsAllDays, 10);
    const dateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
    const showDateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10));
    get(
      `/api/all_alarm_data_with_plates?date_str=${caculateDate(
        selectDate,
        days
      )}&end_date_str=${today}&from100=${from100}&bz_type=${selectHangye}`,
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
      });
      let tableD: any = [];
      if (stockDataByDate) {
        tableD = composeData(stockDataByDate);
      }
      console.log('====', tableD);
      const weighing = tableD.map((t, k) => ({
        [t.firstLabel]: 6,
        [t.secondLabel]: 5,
        [t.thirdLabel]: 4,
        [t.forthLabel]: 3,
        [t.fifthLabel]: 2,
        [t.sixthLabel]: 1,
      }));
      console.log(weighing);

      const weighingMap: any = {};
      weighing.forEach((i) => {
        for (var key in i) {
          var value = i[key];
          key in weighingMap
            ? (weighingMap[key] += value)
            : (weighingMap[key] = value);
        }
      });
      setWeighingOption(weighingOptions(weighingMap));
      setDateArray(dateArr);
      setShowDateArray(showDateArr);
      setStockData(stockDataByDate);
      setOption(dapanOption(tableD));
      setTableData(tableD);
      setIsLoading(false);
    });
  };

  const onClickCharts = {
    click: (e) => {
      const sts: any = [];
      tableData?.forEach((d) => {
        console.log('=====', d);
        ['first', 'second', 'third', 'forth', 'fifth', 'sixth'].forEach((l) => {
          if (d?.[`${l}Label`] === e.name) {
            sts.push(...(d?.[`${l}Stocks`] ?? []));
          }
        });
      });
      //const plate = tableData?.find((i) => i.datestr === e.name);
      //const stocks = pStocks(plate, e?.seriesIndex);
      //const name = pName(plate, e?.seriesIndex);
      // const plateByDate = tableData?.map((i) => {
      //   return {
      //     datestr: i.datestr,
      //     count: stockData?.[i?.datestr].filter((s) =>
      //       s.platename?.split(',')?.includes(name)
      //     )?.length,
      //   };
      // });
      setCurPlate(e?.name);
      setCurStocks(uniqBy(sts, 'symbol'));
      //setCurStockDate(plate?.datestr);
      //setCurPlateByDate(dateOptions(plateByDate));
    },
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
      sorter: (a: any, b: any): any => {
        return (
          Number(a.datestr.replaceAll('-', '')) -
          Number(b.datestr.replaceAll('-', ''))
        );
      },
      //@ts-ignore
      defaultSortOrder: 'descend',
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
    {
      title: 'Forth',
      dataIndex: 'forth',
      key: 'forth',
      render: (v, i) => (
        <>
          {i.forthLabel}:{i.forthCount}
        </>
      ),
    },
    {
      title: 'Fifth',
      dataIndex: 'fifth',
      key: 'fifth',
      render: (v, i) => (
        <>
          {i.fifthLabel}:{i.fifthCount}
        </>
      ),
    },
    {
      title: 'Sixth',
      dataIndex: 'sixth',
      key: 'sixth',
      render: (v, i) => (
        <>
          {i.sixthLabel}:{i.sixthCount}
        </>
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
        <div>
          {' '}
          <Space
            style={{
              padding: '10px',
              boxShadow: '1px 1px 3px #ccc',
            }}
          >
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
        </div>
        <Space>
          选择行业:
          <Select
            style={{ width: '180px' }}
            value={selectHangye}
            onChange={(v) => {
              setSelectHangye(v);
            }}
            size="small"
          >
            {hangyeMap.map((i) => (
              <Select.Option key={i.value} value={i.value}>
                {i.name}
              </Select.Option>
            ))}
          </Select>
          <Switch
            unCheckedChildren="绝对值"
            checkedChildren="百分比"
            style={{ margin: '0 10px' }}
            // defaultChecked
            checked={isPercent}
            onChange={setIsPercent}
          />
        </Space>

        <Button type="primary" onClick={() => runAnalysis()}>
          Run
        </Button>
        <Spin spinning={isLoading} tip="Loading and caculating...">
          {/* <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={option}
            onEvents={onClickCharts}
          /> */}
          <ReactEcharts
            style={{ height: 350, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={weighingOption}
            onEvents={onClickCharts}
          />
          {curPlate && (
            <>
              所选板块： <Tag color="red">{curPlate}</Tag>, 所选日期：
              {curStockDate} 所有股票： {curStocks?.length}
              {curStocks &&
                curStocks?.map((i) => (
                  <Tag color="blue">
                    <a
                      target="_blank"
                      href={`https://quote.eastmoney.com/${i.symbol}.html`}
                    >
                      {' '}
                      {i?.symbol}
                      {i?.name}
                    </a>
                  </Tag>
                ))}
            </>
          )}
          {/* {curPlateByDate && (
            <ReactEcharts
              style={{ height: 350, width: 1450 }}
              notMerge={true}
              lazyUpdate={true}
              option={curPlateByDate}
            />
          )} */}

          <Table
            //@ts-ignore
            columns={columns}
            dataSource={tableData}
            pagination={{ defaultPageSize: 100 }}
          />
        </Spin>
      </div>
    </div>
  );
};
