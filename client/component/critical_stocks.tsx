import {
  Button,
  DatePicker,
  Input,
  InputNumber,
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
import { start } from 'repl';

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
  stock
) {
  const stockData = await get(
    `/api/critical_data?start_date=${startDate}&end_date=${endDate}&from=${from}&stock=${stock}`
  );

  return stockData;
}

export const CriticalStocksComponent = () => {
  const [data, setData] = useState<any>([]);
  const [startDate, setStartDate] = useState(caculateDate(today, 60));
  const [endDate, setEndDate] = useState(today);
  const [from, setFrom] = useState('400s');
  const [searchStock, setSearchStock] = useState<string>();
  const [givenPrice, setGivenPrice] = useState(20);
  const [givenMinPrice, setGivenMinPrice] = useState(10);
  const [givenCirculation, setGivenCirculation] = useState(20);
  const [givenMinCirculation, setGivenMinCirculation] = useState(10);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (c, record) => {
        return (
          <>
            <span>{c}</span>
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
      const data = await getAllCriStocks(startDate, endDate, from, searchStock);
      setData(data);
      setIsLoading(false);
    }
    handleAllStockData();
  }, []);

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
                searchStock
              );
              setData(
                data?.filter((s) => {
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
                      s.finalprice < givenPrice && s.finalprice > givenMinPrice;
                  } else {
                    priceCondition = s.finalprice < givenPrice;
                  }
                  return circulationCondition && priceCondition;
                  // givenMinCirculation
                  //   ? s.marketvalue / s.finalprice < givenCirculation &&
                  //     s.marketvalue / s.finalprice > givenMinCirculation
                  //   : s.marketvalue / s.finalprice < givenCirculation;
                  //  &&
                  // givenMinPrice &&
                  // s.finalprice > givenMinPrice &&
                  // givenPrice &&
                  // s.finalprice < givenPrice;
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
      <Table
        loading={isLoading}
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={data}
      />
    </div>
  );
};
