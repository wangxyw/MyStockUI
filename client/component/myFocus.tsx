import { Table, Form, Input, Popconfirm } from 'antd';
import React, { useEffect, useState, useRef, useContext } from 'react';
import { FormInstance } from 'antd/lib/form';
import { get, post } from '../lib';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

interface Item {
  key: string;
  name: string;
  age: string;
  address: string;
}
interface EditableRowProps {
  index: number;
}

const EditableContext = React.createContext<FormInstance<any> | null>(null);

const EditableRow: React.FC<EditableRowProps> = ({ index, ...props }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

interface EditableCellProps {
  title: React.ReactNode;
  editable: boolean;
  children: React.ReactNode;
  dataIndex: keyof Item;
  record: Item;
  handleSave: (record: Item) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<Input>(null);
  const form = useContext(EditableContext)!;

  useEffect(() => {
    if (editing) {
      inputRef.current!.focus();
    }
  }, [editing]);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({ [dataIndex]: record[dataIndex] });
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      toggleEdit();
      handleSave({ ...record, ...values });
    } catch (errInfo) {
      console.log('Save failed:', errInfo);
    }
  };

  let childNode = children;

  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{ margin: 0 }}
        name={dataIndex}
        rules={[
          {
            required: true,
            message: `${title} is required.`,
          },
        ]}
      >
        <Input ref={inputRef} onPressEnter={save} onBlur={save} />
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap"
        style={{ paddingRight: 24 }}
        onClick={toggleEdit}
      >
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};

async function getAllFocusedStocks() {
  const stockData = await get('/api/all_focus_stock');
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

export const MyFocusListComponent = () => {
  const [data, setData] = useState([]);
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
      sorter: (a: any, b: any): any => a.predict - b.predict,
      render: (txt: any): any => {
        if (txt === 'Up') {
          return '看涨';
        }
        if (txt === 'Down') {
          return '看跌';
        }
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
      editable: true,
    },
    {
      title: 'Date',
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
            post('/api/delete_focus', {
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

  const handleSave = (row: any) => {
    post('/api/edit_focus', {
      body: JSON.stringify({ symbol: row?.symbol, comments: row?.comments }),
    }).then(() => {
      fetch('/api/all_focus_stock')
        .then((res) => res.json())
        .then((data) => {
          setData(data);
        });
    });
  };
  const components = {
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  };
  const mergedColumns = columns.map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record) => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave: handleSave,
      }),
    };
  });
  return (
    <div style={{ padding: '20px' }}>
      My Focus Stocks
      <Table
        columns={mergedColumns}
        dataSource={data}
        components={components}
      />
    </div>
  );
};
