import { Button, Popconfirm, Table, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import { get, post } from '../lib';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { caculateAfterDate, caculateDate, today } from './alarm';
import { groupBy } from 'lodash';
import { caculateMaxPrice, caculateMinPrice } from './myFocus';

async function getAllFocusedStocks() {
  const stockData = await get('/api/all_da_focus');
  const symbols = stockData.map((d) => d.symbol);
  const realtimeData = await get(`/api/qt_realtime?q=${symbols.join(',')}`);

  return stockData.map((s) => {
    const { currentPrice } = realtimeData.find((r) => r.symbol === s.symbol);

    return {
      ...s,
      currentPrice,
    };
  });
}

async function getAllStocksPrice(symbols) {
  const stockData = await get(`/api/get_focus_stock_price?stocks=${symbols}`);

  return stockData;
}

export const DAFocusListComponent = () => {
  const [data, setData] = useState<any>([]);
  const [alarmType1, setAlarmType1] = useState<any>([]);
  const [alarmType2, setAlarmType2] = useState<any>([]);
  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (text, record) => {
        return (
          <div>
            <a
              target="_blank"
              href={`https://quote.eastmoney.com/${text}.html`}
            >
              {text}
              {caculateAfterDate(record.datestr, 60) < caculateDate(today, 0) &&
                '*'}
            </a>
            <Tag>
              <a
                target="_blank"
                href={`http://${location.host}/alarm?symbol=${text}&datestr=${record.datestr}`}
              >
                {'Show alarm'}
              </a>
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        return (
          <span>
            {text}
            {caculateAfterDate(record.datestr, 60) < caculateDate(today, 0) &&
              '*'}
          </span>
        );
      },
    },
    {
      title: 'Current Price',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
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
    {
      title: 'Add Price',
      dataIndex: 'finalprice',
      key: 'finalprice',
    },
    {
      title: 'Add Date',
      dataIndex: 'datestr',
      key: 'datestr',
    },
    {
      title: 'Action',
      key: 'action',
      render: (text, record) => (
        <Popconfirm
          title="Sure to delete?"
          onConfirm={() =>
            post('/api/delete_da_focus', {
              body: JSON.stringify({
                symbol: record?.symbol,
                datestr: record?.datestr,
              }),
            }).then(() => {
              async function handleAllStockData() {
                const data = await getAllFocusedStocks();
                setData(data);
              }
              handleAllStockData();
            })
          }
        >
          <a>Delete</a>
        </Popconfirm>
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
      const symbols = data?.map((i) => `'${i.symbol}'`).join(',');
      const priceData = await getAllStocksPrice(symbols);
      const priceDataGroupByStock = groupBy(priceData, 'symbol');
      const alarmType1: any = [];
      const alarmType2: any = [];
      console.log(priceDataGroupByStock);
      Object.keys(priceDataGroupByStock)?.forEach((i) => {
        const recordData = data?.find((e) => e.symbol === i);
        const recordDate = recordData?.datestr;
        const recordDatePrice = recordData?.finalprice;
        const stock = priceDataGroupByStock[i]?.filter(
          (e) => e.datestr >= recordDate
        );
        const { minPrice } = caculateMinPrice(stock);
        const { maxPrice } = caculateMaxPrice(stock);
        const currentPrice = data?.find((e) => e.symbol === i)?.currentPrice;
        console.log(recordDatePrice, minPrice, currentPrice);
        if (currentPrice > minPrice) {
          alarmType1.push(recordData);
        }
        if ((maxPrice - recordDatePrice) / recordDatePrice > 0.01) {
          alarmType2.push(recordData);
        }
      });
      setAlarmType1(alarmType1);
      setAlarmType2(alarmType2);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <Button type="primary" onClick={() => alarm()}>
        Alarm
      </Button>
      {(alarmType1?.length > 0 || alarmType2?.length > 0) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            maxHeight: '200px',
            overflow: 'auto',
          }}
        >
          <div style={{ border: '2px solid #f33875', padding: '10px' }}>
            推荐关注：
            <br />
            {alarmType1?.map((i) => (
              <Tag>{`${i.symbol}_${i.name}`}</Tag>
            ))}
          </div>
          <div style={{ border: '2px solid #46a865', padding: '10px' }}>
            推荐删除：
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
                    async function handleAllStockData() {
                      const data = await getAllFocusedStocks();
                      setData(data);
                    }
                    handleAllStockData();
                  })
                }
              >
                <Tag
                  style={{ cursor: 'pointer' }}
                >{`${i.symbol}_${i.name}`}</Tag>
              </Popconfirm>
            ))}
          </div>
          <div>
            占比：
            <br />
            推荐关注： {`${alarmType1?.length}/${data?.length}`}
            推荐删除： {`${alarmType2?.length}/${data?.length}`}
          </div>
        </div>
      )}

      <Table
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={data}
      />
    </div>
  );
};
