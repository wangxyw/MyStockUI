import { Table, Form, Input, Popconfirm, Tag, Dropdown, Menu } from 'antd';
import React, { useEffect, useState, useRef, useContext } from 'react';
import { FormInstance } from 'antd/lib/form';
import { get, post } from '../lib';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { caculateAfterDate, caculateDate, today } from './alarm';
export const focusStatusMap = {
  '1': {
    name: '测试中',
    color: 'blue',
  },
  '2': {
    name: '未到买点',
    color: 'yellow',
  },
  '3': {
    name: '已到买点',
    color: 'green',
  },
  '4': {
    name: '买点已过',
    color: 'grey',
  },
};

interface Item {
  key: string;
  name: string;
  age: string;
  address: string;
}
interface EditableRowProps {
  index: number;
}
export const caculateMaxPrice = (priceByDayData) => {
  let maxPrice = priceByDayData[0]?.finalprice;
  let maxPriceDay = 0;
  priceByDayData.forEach((i, k) => {
    if (i.finalprice && i.finalprice > maxPrice) {
      maxPrice = i.finalprice;
      maxPriceDay = k;
    }
  });
  return { maxPrice, maxPriceDay };
};

export const caculateMinPrice = (priceByDayData) => {
  let minPrice = priceByDayData[0]?.finalprice;
  let minPriceDay = 0;
  priceByDayData.forEach((i, k) => {
    if (i.finalprice && i.finalprice < minPrice) {
      minPrice = i.finalprice;
      minPriceDay = k;
    }
  });
  return { minPrice, minPriceDay };
};

export const caculatePriceData = (stockData, stockPriceByDay) => {
  const priceData = stockData.map((i) => {
    const priceByDayData = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr >= i.datestr &&
        e.datestr <= caculateAfterDate(i.datestr, 60);
      return a;
    });
    const { maxPrice, maxPriceDay } = caculateMaxPrice(priceByDayData);
    const { minPrice, minPriceDay } = caculateMinPrice(priceByDayData);
    const oneStock = i;
    const maxPriceDiff = ((maxPrice - i.finalprice) / i.finalprice) * 100;
    const minPriceDiff = ((minPrice - i.finalprice) / i.finalprice) * 100;
    oneStock.firstMaxPrice = 1;
    oneStock.maxPrice = maxPrice;
    oneStock.minPrice = minPrice;
    oneStock.firstMaxPriceDay = 1;
    oneStock.maxPriceDay = maxPriceDay;
    oneStock.maxPriceDiff = maxPriceDiff.toFixed(2);
    oneStock.minPriceDay = minPriceDay;
    oneStock.minPriceDiff = minPriceDiff.toFixed(2);
    return oneStock;
  });
  return priceData;
};

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

  const stockPriceByDay = await get(
    `/api/get_focus_stock_price?stocks=${symbols
      .map((i) => `'${i}'`)
      .join(',')}`
  );
  //caculate stock price
  const stockPriceData = caculatePriceData(stockData, stockPriceByDay);

  return stockPriceData.map((s) => {
    const { currentPrice } = realtimeData.find((r) => r.symbol === s.symbol);

    return {
      ...s,
      currentPrice,
    };
  });
}

export const MyFocusListComponent = () => {
  const [data, setData] = useState([]);
  const [rateByCur, setRateByCur] = useState();
  const [rateByMax, setRateByMax] = useState();
  const onClickMenu = (item, tableIndex, datestr) => {
    post('/api/edit_focus_status', {
      body: JSON.stringify({
        symbol: tableIndex,
        status: item.key,
        datestr: datestr,
      }),
    }).then(() => {
      if (item.key === '3') {
        post('/api/edit_focus_datestr', {
          body: JSON.stringify({
            symbol: tableIndex,
            status: item.key,
            datestr: datestr,
            newDatestr: caculateDate(today, 0),
          }),
        }).then((i) => {
          if (i.code) {
            alert(i.sqlMessage);
          }
        });
      }
      async function handleAllStockData() {
        const data = await getAllFocusedStocks();
        setData(
          selectStatus
            ? data.filter(
                (i) =>
                  i.focus_status ===
                  (selectStatus === '0' ? null : selectStatus)
              )
            : data
        );
      }
      handleAllStockData();
    });
  };

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
      title: 'Status',
      dataIndex: 'focus_status',
      key: 'focus_status',
      render: (txt, row) => {
        return (
          <Dropdown
            overlay={
              <Menu
                onClick={(item) => onClickMenu(item, row.symbol, row.datestr)}
              >
                {Object.keys(focusStatusMap).map((i) => (
                  <Menu.Item key={i}>{focusStatusMap[i]?.name}</Menu.Item>
                ))}
              </Menu>
            }
          >
            <Tag color={focusStatusMap[txt]?.color}>
              {focusStatusMap[txt]?.name || '未标注'}
            </Tag>
          </Dropdown>
        );
      },
      sorter: (a, b) =>
        parseInt(a.focus_status || 0, 10) - parseInt(b.focus_status || 0, 10),
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
      defaultSortOrder: 'descend',
      sorter: (a: any, b: any): any => {
        return (
          Number(a.datestr.replaceAll('-', '')) -
          Number(b.datestr.replaceAll('-', ''))
        );
      },
    },
    {
      title: 'Recent 10 days',
      dataIndex: 'recentTen',
      key: 'recentTen',
      render: (c, record) => {
        const upA1 = c.filter(
          (i) => i.status === 'up' && i.alarmtype === 'A1'
        ).length;
        const upA2 = c.filter(
          (i) => i.status === 'up' && i.alarmtype === 'A2'
        ).length;
        const upA3 = c.filter(
          (i) => i.status === 'up' && i.alarmtype === 'A3'
        ).length;
        const upNA = c.filter(
          (i) =>
            i.status === 'up' && (i.alarmtype === '' || i.alarmtype === null)
        ).length;
        const downA1 = c.filter(
          (i) => i.status === 'down' && i.alarmtype === 'A1'
        ).length;
        const downA2 = c.filter(
          (i) => i.status === 'down' && i.alarmtype === 'A2'
        ).length;
        const downA3 = c.filter(
          (i) => i.status === 'down' && i.alarmtype === 'A3'
        ).length;
        const downNA = c.filter(
          (i) =>
            i.status === 'down' && (i.alarmtype === '' || i.alarmtype === null)
        ).length;
        return (
          <div>
            <table>
              <thead>
                <tr>
                  <td>A1</td>
                  <td>A2</td>
                  <td>A3</td>
                  <td>NA</td>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f1b4b0' }}>
                  <td>{upA1}</td>
                  <td>{upA2}</td>
                  <td>{upA3}</td>
                  <td>{upNA}</td>
                </tr>
                <tr style={{ background: '#cbeba8' }}>
                  <td>{downA1}</td>
                  <td>{downA2}</td>
                  <td>{downA3}</td>
                  <td>{downNA}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      },
    },
    {
      title: '流通股本',
      dataIndex: 'circulation_stock',
      key: 'circulation_stock',
      render: (c, record) => {
        const re = (record.marketvalue / record.finalprice).toFixed(3);
        return <>{re}</>;
      },
    },
    {
      title: 'MaxPrice',
      dataIndex: 'maxPrice',
      key: 'maxPrice',
      sorter: (a: any, b: any): any => {
        return Number(a.maxPriceDiff) - Number(b.maxPriceDiff);
      },
      render: (c, record) => {
        const diff = record.maxPriceDiff;
        return (
          <Tag color={diff > 0 ? 'red' : 'green'}>
            {c}/ {diff + '%'}
          </Tag>
        );
      },
    },
    {
      title: 'MaxPriceDay',
      dataIndex: 'maxPriceDay',
      key: 'maxPriceDay',
    },
    {
      title: 'MinPrice',
      dataIndex: 'minPrice',
      key: 'minPrice',
      render: (c, record) => {
        const diff = record.minPriceDiff;
        return (
          <Tag color={diff > 0 ? 'red' : 'green'}>
            {c}/ {diff + '%'}
          </Tag>
        );
      },
    },
    {
      title: 'MinPriceDay',
      dataIndex: 'minPriceDay',
      key: 'minPriceDay',
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
                setData(
                  selectStatus
                    ? data.filter(
                        (i) =>
                          i.focus_status ===
                          (selectStatus === '0' ? null : selectStatus)
                      )
                    : data
                );
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
  const [selectStatus, setSelectStatus] = useState<any>(null);

  useEffect(() => {
    async function handleAllStockData() {
      const data = await getAllFocusedStocks();
      const rateByCur = data?.filter(
        (i) =>
          (i.currentPrice >= i.finalprice && i.predict === 'Up') ||
          (i.currentPrice < i.finalprice && i.predict === 'Down')
      ).length;
      const rateByMax = data?.filter(
        (i) =>
          (i.maxPriceDiff > 0 && i.predict === 'Up') ||
          (i.maxPriceDiff === 0 && i.predict === 'Down')
      )?.length;
      setRateByCur(`${rateByCur}/${data.length}` as any);
      setRateByMax(`${rateByMax}/${data.length}` as any);
      setData(
        selectStatus
          ? data.filter(
              (i) =>
                i.focus_status === (selectStatus === '0' ? null : selectStatus)
            )
          : data
      );
    }

    handleAllStockData();
  }, [selectStatus]);

  const handleSave = (row: any) => {
    post('/api/edit_focus', {
      body: JSON.stringify({ symbol: row?.symbol, comments: row?.comments }),
    }).then(() => {
      async function handleAllStockData() {
        const data = await getAllFocusedStocks();
        setData(
          selectStatus
            ? data.filter(
                (i) =>
                  i.focus_status ===
                  (selectStatus === '0' ? null : selectStatus)
              )
            : data
        );
      }
      handleAllStockData();
    });
  };
  const components = {
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  };
  const mergedColumns: any = columns.map((col) => {
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
      Filter By Status:
      <Dropdown
        overlay={
          <Menu onClick={(ob) => setSelectStatus(ob.key)}>
            {Object.keys(focusStatusMap)
              .map((i) => (
                <Menu.Item key={i}>{focusStatusMap[i]?.name}</Menu.Item>
              ))
              .concat(<Menu.Item key={'0'}>{'未标注'}</Menu.Item>)}
          </Menu>
        }
      >
        <Tag color={focusStatusMap[selectStatus]?.color}>
          {selectStatus === '0'
            ? '未标注'
            : focusStatusMap[selectStatus]?.name || 'All'}
        </Tag>
      </Dropdown>
      <Table
        pagination={{ defaultPageSize: 100 }}
        columns={mergedColumns}
        dataSource={data}
        components={components}
      />
    </div>
  );
};
