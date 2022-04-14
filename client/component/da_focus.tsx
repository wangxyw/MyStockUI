import { Button, Popconfirm, Table, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import { get, post } from '../lib';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { caculateAfterDate, caculateDate, today } from './alarm';

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

export const DAFocusListComponent = () => {
  const [data, setData] = useState([]);
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
              href={`https://finance.sina.com.cn/realstock/company/${text}/nc.shtml`}
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

  return (
    <div style={{ padding: '20px' }}>
      <Button type="primary">Alarm //todo</Button>
      <Table
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={data}
      />
    </div>
  );
};
