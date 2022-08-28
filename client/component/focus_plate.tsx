import { Table, Button, Tag, Select } from 'antd';
import React, { useEffect, useState } from 'react';
import { get, post } from '../lib';

async function getAllFocusedPlates() {
  const plateData = await get('/api/all_industry');
  return plateData;
}

async function getAllIndustries(select) {
  const plateData = await get(`/api/all_industry_by_type?type=${select}`);
  return plateData;
}

async function getAllStocks(select) {
  const plateData = await get(`/api/all_stocks_by_industry?code=${select}`);
  return plateData;
}

export const PlateComponent = () => {
  const [selectType, setSelectType] = useState('');
  const [typeMap, setTypeMap] = useState<any>([]);
  const [selectIndustry, setSelectIndustry] = useState<any>();
  const [industryMap, setIndustryMap] = useState<any>([]);
  const [stocks, setStocks] = useState<any>([]);
  // const columns = [
  //   {
  //     title: 'Plate',
  //     dataIndex: 'name',
  //     key: 'name',
  //   },
  //   {
  //     title: 'Focused',
  //     dataIndex: 'focus',
  //     key: 'focus',
  //     render: (text) => {
  //       if (text) {
  //         return <Tag color="#87d068">Focused</Tag>;
  //       }
  //       return <Tag color="#f50">0</Tag>;
  //     },
  //     sorter: (a: any, b: any): any => a.focus - b.focus,
  //   },
  //   {
  //     title: 'Action',
  //     key: 'action',
  //     render: (text, record) => (
  //       <div>
  //         <Button
  //           type="primary"
  //           onClick={() =>
  //             post('/api/edit_focus_plate', {
  //               body: JSON.stringify({
  //                 isAdd: true,
  //                 code: record?.code,
  //               }),
  //             }).then(() => {
  //               async function handleAllStockData() {
  //                 const data = await getAllFocusedPlates();
  //                 setData(data);
  //               }
  //               handleAllStockData();
  //             })
  //           }
  //         >
  //           Focus
  //         </Button>

  //         <Button
  //           style={{ marginLeft: '20px' }}
  //           onClick={() =>
  //             post('/api/edit_focus_plate', {
  //               body: JSON.stringify({
  //                 isAdd: false,
  //                 code: record?.code,
  //               }),
  //             }).then(() => {
  //               async function handleAllStockData() {
  //                 const data = await getAllFocusedPlates();
  //                 setData(data);
  //               }
  //               handleAllStockData();
  //             })
  //           }
  //         >
  //           UnFocus
  //         </Button>
  //       </div>
  //     ),
  //   },
  // ];

  useEffect(() => {
    async function handleAllStockData() {
      const data = await getAllFocusedPlates();
      setTypeMap(data);
    }
    handleAllStockData();
  }, []);

  useEffect(() => {
    async function handleAllStockData() {
      const data = await getAllIndustries(selectType);
      setIndustryMap(data);
    }
    handleAllStockData();
  }, [selectType]);

  useEffect(() => {
    async function handleAllStockData() {
      const data = await getAllStocks(selectIndustry);
      setStocks(data);
    }
    handleAllStockData();
  }, [selectIndustry]);

  return (
    <div style={{ padding: '20px' }}>
      选择类别:
      <Select
        style={{ width: '180px' }}
        value={selectType}
        onChange={(v) => {
          setSelectType(v);
        }}
        size="small"
      >
        {typeMap.map((i) => (
          <Select.Option key={i.business_type} value={i.business_type}>
            {i.business_name}
          </Select.Option>
        ))}
      </Select>
      选择行业：
      <Select
        style={{ width: '180px' }}
        value={selectIndustry}
        onChange={(v) => {
          setSelectIndustry(v);
        }}
        size="small"
      >
        {industryMap.map((i) => (
          <Select.Option key={i.code} value={i.code}>
            {i.name}
          </Select.Option>
        ))}
      </Select>
      <div>
        {stocks &&
          stocks?.map((i) => (
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
      </div>
      {/* <Table columns={mergedColumns} dataSource={data} /> */}
    </div>
  );
};
