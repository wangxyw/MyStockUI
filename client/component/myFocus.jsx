import { Table } from 'antd';
import React, { useEffect, useState } from 'react';

const columns = [
  {
    title: 'Symbol',
    dataIndex: 'symbol',
    key: 'symbol',
    render: (text) => {
      return (
        <a
          target="_blank"
          href={`https://finance.sina.com.cn/realstock/company/${text}/nc.shtml`}
        >
          {text}
        </a>
      );
    },
  },
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Predict',
    dataIndex: 'predict',
    key: 'predict',
    sorter: (a, b) => a.predict - b.predict,
    render: (txt) => {
      if (txt === 'Up') {
        return '看涨';
      }
      if (txt === 'Down') {
        return '看跌';
      }
    },
  },
  {
    title: 'Final Price',
    dataIndex: 'finalprice',
    key: 'finalprice',
  },
  {
    title: 'Price Change Pct',
    dataIndex: 'pricechangepct',
    key: 'pricechangepct',
    sorter: (a, b) => a.pricechangepct - b.pricechangepct,
    // render: txt => (<>{(+txt < 0? <ArrowDownOutlined twoToneColor={"green"}/> : <ArrowUpOutlined twoToneColor={"red"}/>)}</>)
  },
  {
    title: 'Turnover Rate',
    dataIndex: 'turnoverrate',
    key: 'turnoverrate',
    sorter: (a, b) => a.turnoverrate - b.turnoverrate,
  },
  {
    title: 'Comments',
    dataIndex: 'comments',
    key: 'comments',
  },
  {
    title: 'Date',
    dataIndex: 'datestr',
    key: 'datestr',
  },
];

export const MyFocusListComponent = () => {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch('/api/all_focus_stock')
      .then((res) => res.json())
      .then((data) => {
        setData(data);
      });
  }, []);
  return (
    <div>
      My Focus Stocks
      <Table columns={columns} dataSource={data} />
    </div>
  );
};
