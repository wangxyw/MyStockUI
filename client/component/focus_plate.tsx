import { Table, Button, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import { get, post } from '../lib';


async function getAllFocusedPlates() {
  const plateData = await get('/api/focus_plate');
  return plateData;
}

export const PlateComponent = () => {
  const [data, setData] = useState([]);
  const columns = [
    {
      title: 'Plate',
      dataIndex: 'name',
      key: 'name'
    },
    {
        title: 'Focused',
        dataIndex: 'focus',
        key: 'focus',
        render: (text) => {
          if (text) {
              return  <Tag color="#87d068">Focused</Tag>
          }
          return (
            <Tag color="#f50">0</Tag>
          );
        },
        sorter: (a: any, b: any): any => a.focus - b.focus,
      },
    {
      title: 'Action',
      key: 'action',
      render: (text, record) => (
        <div>
            <Button type="primary" onClick={
                  () =>
                    post('/api/edit_focus_plate', {
                      body: JSON.stringify({
                        isAdd: true,
                        code: record?.code,
                      }),
                    }).then(() => {
                      async function handleAllStockData() {
                        const data = await getAllFocusedPlates();
                        setData(data);
                      }
                      handleAllStockData();
                    })
                  
            }>Focus</Button>

            <Button style ={{marginLeft: '20px'}} onClick={
                  () =>
                    post('/api/edit_focus_plate', {
                      body: JSON.stringify({
                        isAdd: false,
                        code: record?.code,
                      }),
                    }).then(() => {
                      async function handleAllStockData() {
                        const data = await getAllFocusedPlates();
                        setData(data);
                      }
                      handleAllStockData();
                    })
                  
            }>UnFocus</Button>
        </div>
        
      ),
    },
  ];
  
  useEffect(() => {
    async function handleAllStockData() {
      const data = await getAllFocusedPlates();
      setData(data);
    }

    handleAllStockData();
  }, []);

  const mergedColumns = columns.map((col) => {
    return {
      ...col,
    };
  });
  return (
    <div style={{ padding: '20px' }}>
      My Focus Plates
      <Table
        columns={mergedColumns}
        dataSource={data}
      />
    </div>
  );
};
