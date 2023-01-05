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

import React, { useEffect, useState } from 'react';
import { get, post } from '../lib';
import { caculateDate } from './alarm';
import moment from 'moment';
import './alarm.css';
import DATA from './date.json';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ConsoleSqlOutlined,
} from '@ant-design/icons';

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
    `/api/critical_data?start_date=${startDate}&end_date=${endDate}&from=${from}&stock=${stock}&isFocused=${isFocused}&isDown=${isDown}`
  );
  const stockPriceByDay =
    stockData?.length > 0
      ? await post(`/api/get_price_from_common_data`, {
          body: JSON.stringify({
            stocks: stockData.map((i) => `'${i.symbol}'`).join(','),
            today: caculateDate(endDate, 0),
          }),
        })
      :
    stockData;
  return stockData.map((i) => ({
    ...i,
    todayPrice: stockPriceByDay?.find((s) => s.symbol === i.symbol)?.finalprice,
  }));
}

export const CriticalStocksComponent = () => {
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
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
    {
      title: 'To Date Final Price',
      dataIndex: 'todayPrice',
      key: 'todayPrice',
      sorter: (a: any, b: any): any => {
        const aDiff = (a.todayPrice - a.finalprice) / a.finalprice;
        const bDiff = (b.todayPrice - b.finalprice) / b.finalprice;
        return Number(aDiff) - Number(bDiff);
      },
      render: (c, record) => {
        const isUp = c - record.finalprice > 0;
        const arrow = !isUp ? (
          <ArrowDownOutlined style={{ color: 'green' }} />
        ) : (
          <ArrowUpOutlined style={{ color: 'red' }} />
        );
        const diff = (c - record.finalprice) / record.finalprice;
        return (
          <>
            <div>
              <Tag color={diff > 0 ? 'red' : 'green'}>
                {arrow}
                {c}/{(diff * 100).toFixed(2) + '%'}
              </Tag>
            </div>
            <div>
              <Tag>
                {endDate} <br /> {c}
              </Tag>
            </div>
          </>
        );
      },
    },
    {
      title: 'MarketValue',
      dataIndex: 'marketvalue',
      key: 'marketvalue',
      render: (c, record) => {
        return (
          <>
            <span>{(c / record.finalprice).toFixed(2)}</span>
          </>
        );
      },
    },
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
                      return circulationCondition && priceCondition;
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
                      return circulationCondition && priceCondition;
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
      <Table
        loading={isLoading}
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={data}
      />
      DownDown:
      <Table
        loading={isLoading}
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={downData}
      />
    </div>
  );
};
