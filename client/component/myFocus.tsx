import { Table, Form, Input, Popconfirm, Tag, Dropdown, Menu, Button, Modal } from 'antd';
import React, { useEffect, useState, useRef, useContext } from 'react';
import { FormInstance } from 'antd/lib/form';
import { get, post } from '../lib';
import img from './mark.jpg';
import { uniqBy, isEmpty, orderBy } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ConsoleSqlOutlined,
} from '@ant-design/icons';
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

const MergeOptions = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');

  const allData = orderBy([...orderedData, ...orderedDownData], 'datestr')?.map(
    (i) => i.datestr
  );

  const xAxis = orderedData?.map((i) => i.datestr);
  const maxT = orderedData?.map((i) => ({
    value: i?.turnoverrates_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)),
    datestr: i.datestr,
    haveLimit: i?.have_limit,
  }));

  const minT = orderedData?.map((i) => ({
    value: i?.turnoverrates_str
      ?.split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a)),
    datestr: i.datestr,
    haveLimit: i?.have_limit,
  }));
  const maxDownT = orderedDownData?.map((i) => ({
    value: i?.turnoverrates_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)),
    datestr: i.datestr,
    haveLimit: i?.have_limit,
  }));

  const minDownT = orderedDownData?.map((i) => ({
    value: i?.turnoverrates_str
      ?.split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a)),
    datestr: i.datestr,
    haveLimit: i?.have_limit,
  }));

  const maxTValues = allData?.map((i) =>
    maxT?.find((m) => m.datestr === i)
      ? maxT?.find((m) => m.datestr === i).value
      : '-'
  );
  const maxTValuesMap = allData?.map((i) =>
    maxT?.find((m) => m.datestr === i)
      ? {
          value: maxT?.find((m) => m.datestr === i).value,
          haveLimit: maxT?.find((m) => m.datestr === i).haveLimit,
        }
      : '-'
  );

  const minTValues = allData?.map((i) =>
    minT?.find((m) => m.datestr === i)
      ? minT?.find((m) => m.datestr === i).value
      : '-'
  );
  const minTValuesMap = allData?.map((i) =>
    minT?.find((m) => m.datestr === i)
      ? {
          value: minT?.find((m) => m.datestr === i).value,
          haveLimit: minT?.find((m) => m.datestr === i).haveLimit,
        }
      : '-'
  );

  const maxDownValues = allData?.map((i) =>
    maxDownT?.find((m) => m.datestr === i)
      ? maxDownT?.find((m) => m.datestr === i).value
      : '-'
  );
  const maxDownValuesMap = allData?.map((i) =>
    maxDownT?.find((m) => m.datestr === i)
      ? {
          value: maxDownT?.find((m) => m.datestr === i).value,
          haveLimit: maxDownT?.find((m) => m.datestr === i).haveLimit,
        }
      : '-'
  );
  const minDownValues = allData?.map((i) =>
    minDownT?.find((m) => m.datestr === i)
      ? minDownT?.find((m) => m.datestr === i).value
      : '-'
  );
  const minDownValuesMap = allData?.map((i) =>
    minDownT?.find((m) => m.datestr === i)
      ? {
          value: minDownT?.find((m) => m.datestr === i).value,
          haveLimit: minDownT?.find((m) => m.datestr === i).haveLimit,
        }
      : '-'
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: [
        'MaxOverRate',
        'MinOverRate',
        'DownMaxOverRate',
        'DownMinOverRate',
      ],
    },
    // grid: [{
    //     left: '10%',
    //     right: '1%',
    //     top: '1%',
    //     height: '70%'
    // }],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    toolbox: {
      show: true,
      orient: 'vertical',
      left: 'right',
      top: 'center',
      feature: {
        mark: { show: true },
        magicType: {
          show: true,
          type: ['line', 'bar', 'stack', 'tiled'],
        },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    xAxis: {
      type: 'category',
      data: allData,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'MaxOverRate',
        type: 'line',
        data: maxTValues,
        symbol: (v, params) => {
          var colorList;
          if (maxTValuesMap[params.dataIndex]?.haveLimit == '1') {
            colorList = 'arrow';
          } else if (maxTValuesMap[params.dataIndex]?.haveLimit == '-1') {
            colorList = 'circle';
          } else if (maxTValuesMap[params.dataIndex]?.haveLimit == '2') {
            colorList = 'pin';
          } else {
            colorList = 'diamond';
          }

          return colorList;
        },
        symbolSize: 10,
        itemStyle: {
          normal: {
            color: '#d50937',
            // color: function (params) {
            //   console.log('======', maxTValues, maxTValuesMap, params);
            //   var colorList;
            //   if (maxTValuesMap[params.dataIndex]?.haveLimit == '1') {
            //     colorList = '#3c0202';
            //   } else if (maxTValuesMap[params.dataIndex]?.haveLimit == '-1') {
            //     colorList = '#023c1f';
            //   } else if (maxTValuesMap[params.dataIndex]?.haveLimit == '2') {
            //     colorList = '#3f09d5';
            //   } else {
            //     colorList = '#d50937';
            //   }
            //   console.log('colorList', colorList);
            //   return colorList;
            // },
          },
        },

        label: {
          position: 'top',
        },
      },
      {
        name: 'MinOverRate',
        type: 'line',
        // symbol: 'diamond',
        symbolSize: 10,
        symbol: (v, params) => {
          var colorList;
          if (minTValuesMap[params.dataIndex]?.haveLimit == '1') {
            colorList = 'arrow';
          } else if (minTValuesMap[params.dataIndex]?.haveLimit == '-1') {
            colorList = 'circle';
          } else if (minTValuesMap[params.dataIndex]?.haveLimit == '2') {
            colorList = 'pin';
          } else {
            colorList = 'diamond';
          }

          return colorList;
        },
        itemStyle: {
          normal: {
            color: '#e07b7b',
          },
        },
        data: minTValues,
        // itemStyle: {
        //   normal: {
        //     color: function (params) {
        //       var colorList;
        //       if (statusArr[params.dataIndex] == 'up') {
        //         colorList = '#ef232a';
        //       } else if (statusArr[params.dataIndex] == 'down') {
        //         colorList = '#14b143';
        //       }
        //       return colorList;
        //     },
        //   },
        // },
      },
      {
        name: 'DownMaxOverRate',
        type: 'line',
        // symbol: 'diamond',
        symbol: (v, params) => {
          var colorList;
          if (maxDownValuesMap[params.dataIndex]?.haveLimit == '1') {
            colorList = 'arrow';
          } else if (maxDownValuesMap[params.dataIndex]?.haveLimit == '-1') {
            colorList = 'circle';
          } else if (maxDownValuesMap[params.dataIndex]?.haveLimit == '2') {
            colorList = 'pin';
          } else {
            colorList = 'diamond';
          }

          return colorList;
        },
        symbolSize: 10,

        data: maxDownValues,
        itemStyle: {
          normal: {
            color: '#338e06',
          },
        },
      },
      {
        name: 'DownMinOverRate',
        type: 'line',
        // symbol: 'diamond',
        symbol: (v, params) => {
          var colorList;
          if (minDownValuesMap[params.dataIndex]?.haveLimit == '1') {
            colorList = 'arrow';
          } else if (minDownValuesMap[params.dataIndex]?.haveLimit == '-1') {
            colorList = 'circle';
          } else if (minDownValuesMap[params.dataIndex]?.haveLimit == '2') {
            colorList = 'pin';
          } else {
            colorList = 'diamond';
          }

          return colorList;
        },
        symbolSize: 10,

        data: minDownValues,
        itemStyle: {
          normal: {
            color: '#8bac7b',
          },
        },
      },
    ],
  };
};

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
  return stockData;
}

async function getAllCriStocks3(
  startDate: any = null,
  endDate: any = 0,
  from: any = false,
  stock,
  isFocused,
  isDown = false
) {
  const stockData = await get(
    `/api/critical_data3?start_date=${startDate}&end_date=${endDate}&from=${from}&stock=${stock}&isFocused=${isFocused}&isDown=${isDown}`
  );
  return stockData;
}

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
  let maxPriceDate = priceByDayData[0]?.datestr;
  priceByDayData.forEach((i, k) => {
    if (i.finalprice && i.finalprice > maxPrice) {
      maxPrice = i.finalprice;
      maxPriceDay = k;
      maxPriceDate = i.datestr;
    }
  });
  return { maxPrice, maxPriceDay, maxPriceDate };
};
export const caculateMinVol = (priceByDayData) => {
  let minVol = priceByDayData[0]?.totaltradevol;
  let minVolDate = priceByDayData[0]?.datestr;
  let minVolDay = 0;
  priceByDayData.forEach((i, k) => {
    if (i.totaltradevol && i.totaltradevol < minVol) {
      minVol = i.totaltradevol;
      minVolDay = k;
      minVolDate = i.datestr;
    }
  });
  return { minVol, minVolDay, minVolDate };
};
export const caculateMaxVol = (priceByDayData) => {
  let maxVol = priceByDayData[0]?.totaltradevol;
  let maxVolDay = 0;
  let maxVolDate = priceByDayData[0]?.datestr;
  priceByDayData.forEach((i, k) => {
    if (i.totaltradevol && i.totaltradevol > maxVol) {
      maxVol = i.totaltradevol;
      maxVolDay = k;
      maxVolDate = i.datestr;
    }
  });
  return { maxVol, maxVolDay, maxVolDate };
};

export const caculateMinPrice = (priceByDayData) => {
  let minPrice = priceByDayData[0]?.finalprice;
  let minPriceDay = 0;
  let minPriceDate = priceByDayData[0]?.datestr;
  priceByDayData.forEach((i, k) => {
    if (i.finalprice && i.finalprice < minPrice) {
      minPrice = i.finalprice;
      minPriceDay = k;
      minPriceDate = i.datestr;
    }
  });
  return { minPrice, minPriceDay, minPriceDate };
};

export const caculatePriceData = (
  stockData,
  stockPriceByDay,
  timeWindow: any = 120,
  simulateDate: any = today
) => {
  const yesterday = caculateDate(simulateDate ?? today, 1);
  const priceData = stockData.map((i) => {
    //i.datestr is addDate
    const todayData =
      stockPriceByDay?.find(
        (e) => e.symbol === i.symbol && e.datestr === simulateDate
      ) ??
      stockPriceByDay?.find(
        (e) => e.symbol === i.symbol && e.datestr === yesterday
      );
    const priceByDayData = stockPriceByDay?.filter((e) => {
      let a = e.symbol === i.symbol && e.datestr >= i.datestr;
      if (timeWindow !== '不限') {
        a = a && e.datestr <= caculateAfterDate(i.datestr, timeWindow);
      }
      return a;
    });
    const before40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= i.datestr &&
        e.datestr > caculateDate(i.datestr, 60);
      return a;
    });
    const before20Cur = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= i.datestr &&
        e.datestr > caculateDate(i.datestr, 20);
      return a;
    });
    const { minPrice: minPrice40, minPriceDate: minPriceDate40 } =
      caculateMinPrice(before40);
    const before10inBefore40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= minPriceDate40 &&
        e.datestr > caculateDate(minPriceDate40, 10);
      return a;
    });
    const before20inBefore40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= minPriceDate40 &&
        e.datestr > caculateDate(minPriceDate40, 20);
      return a;
    });

    const { maxPrice: maxPrice40, maxPriceDate: maxPriceDate40 } =
      caculateMaxPrice(before10inBefore40);

    const { maxPrice: max20Price40, maxPriceDate: max20PriceDate40 } =
      caculateMaxPrice(before20inBefore40);

    const kBefore40 = ((maxPrice40 - minPrice40) / maxPrice40).toFixed(2);
    const k20Before40 = ((max20Price40 - minPrice40) / max20Price40).toFixed(2);

    const After40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr >= i.datestr &&
        e.datestr < caculateAfterDate(i.datestr, 40);
      return a;
    });
    const { maxPrice: maxPriceAfter40, maxPriceDate: maxPriceDateK1After40 } =
      caculateMaxPrice(After40);
    const before10inAfter40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr >= maxPriceDateK1After40 &&
        e.datestr < caculateAfterDate(maxPriceDateK1After40, 10);
      return a;
    });
    const before20inAfter40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr >= maxPriceDateK1After40 &&
        e.datestr < caculateAfterDate(maxPriceDateK1After40, 20);
      return a;
    });
    const { minPrice: minPriceAfter40, minPriceDate: minPriceDateK1After40 } =
      caculateMinPrice(before10inAfter40);
    const {
      minPrice: minPrice20After40,
      minPriceDate: minPrice20DateK1After40,
    } = caculateMinPrice(before20inAfter40);
    const k1After40 = (
      (maxPriceAfter40 - minPriceAfter40) /
      maxPriceAfter40
    ).toFixed(2);
    const k120After40 = (
      (minPrice20After40 - minPriceAfter40) /
      minPrice20After40
    ).toFixed(2);

    const { minPrice: minPriceK2After40, minPriceDate: minPriceDateK2After40 } =
      caculateMinPrice(After40);
    const before10inK2After40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= minPriceDateK2After40 &&
        e.datestr > caculateDate(minPriceDateK2After40, 10);
      return a;
    });
    const before20inK2After40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= minPriceDateK2After40 &&
        e.datestr > caculateDate(minPriceDateK2After40, 20);
      return a;
    });
    const { maxPrice: maxPriceK2After40, maxPriceDate: maxPriceDateK2After40 } =
      caculateMaxPrice(before10inK2After40);
    const {
      maxPrice: maxPrice20K2After40,
      maxPriceDate: maxPrice20DateK2After40,
    } = caculateMaxPrice(before20inK2After40);
    const k2After40 = (
      (maxPriceK2After40 - minPriceK2After40) /
      maxPriceK2After40
    ).toFixed(2);
    const k220After40 = (
      (maxPrice20K2After40 - minPriceK2After40) /
      maxPrice20K2After40
    ).toFixed(2);

    let kAfter40: any = k1After40 > k2After40 ? k1After40 : k2After40;
    let k20After40: any = k120After40 > k220After40 ? k120After40 : k220After40;
    let maxPriceDateAfter40 =
      k1After40 > k2After40 ? maxPriceDateK1After40 : maxPriceDateK2After40;
    const minPriceDateAfter40 =
      k1After40 > k2After40 ? minPriceDateK1After40 : minPriceDateK2After40;

    let maxPrice20DateAfter40 =
      k120After40 > k220After40
        ? minPrice20DateK1After40
        : maxPrice20DateK2After40;
    const minPrice20DateAfter40 =
      k120After40 > k220After40
        ? minPrice20DateK1After40
        : minPriceDateK2After40;

    if (maxPriceDateAfter40 <= i.datestr) {
      kAfter40 = null;
      maxPriceDateAfter40 = null;
    }
    const { maxPrice, maxPriceDay, maxPriceDate } =
      caculateMaxPrice(priceByDayData);
    const { minPrice, minPriceDay, minPriceDate } =
      caculateMinPrice(priceByDayData);
    const { minVol, minVolDay, minVolDate } = caculateMinVol(priceByDayData);
    const { minVol: minVolIn20, minVolDate: minVolDateIn20 } =
      caculateMinVol(before20Cur);
    const { maxVol: maxVolIn20, maxVolDate: maxVolDateIn20 } =
      caculateMaxVol(before20Cur);
    const oneStock = i;
    const maxPriceDiff = ((maxPrice - i.finalprice) / i.finalprice) * 100;
    const minPriceDiff = ((minPrice - i.finalprice) / i.finalprice) * 100;
    oneStock.firstMaxPrice = 1;
    oneStock.maxPrice = maxPrice;
    oneStock.minPrice = minPrice;
    oneStock.firstMaxPriceDay = 1;
    oneStock.maxPriceDay = maxPriceDay;
    oneStock.maxPriceDiff = maxPriceDiff.toFixed(2);
    oneStock.maxPriceDate = maxPriceDate;
    oneStock.minPriceDay = minPriceDay;
    oneStock.minPriceDiff = minPriceDiff.toFixed(2);
    oneStock.minPriceDate = minPriceDate;
    oneStock.minVolDay = minVolDay;
    oneStock.minVol = minVol;
    oneStock.minVolDate = minVolDate;

    oneStock.minVol20 = minVolIn20;
    oneStock.minVolDate20 = minVolDateIn20;
    oneStock.maxVol20 = maxVolIn20;
    oneStock.maxVolDate20 = maxVolDateIn20;

    oneStock.kBefore40 = kBefore40;
    oneStock.kBeforeMinDate = minPriceDate40;
    oneStock.kBeforeMaxDate = maxPriceDate40;
    oneStock.kAfter40 = kAfter40;
    oneStock.kAfterMinDate = minPriceDateAfter40;
    oneStock.kAfterMaxDate = maxPriceDateAfter40;

    oneStock.k20Before40 = k20Before40;
    oneStock.k20BeforeMinDate = minPriceDate40;
    oneStock.k20BeforeMaxDate = max20PriceDate40;
    oneStock.k20After40 = k20After40;
    oneStock.k20AfterMinDate = minPrice20DateAfter40;
    oneStock.k20AfterMaxDate = maxPrice20DateAfter40;

    oneStock.todayMgsy = JSON.parse(todayData?.var_props ?? '{}')?.zyzb?.mgsy;
    oneStock.todayPrice = todayData?.finalprice;

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
  const realtimeData = await post(`/api/qt_realtime`, {
    body: JSON.stringify({ q: symbols.join(',') }),
  });

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

  const [mergeOptions, setMergeOptions] = useState({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [mergeOptionsInModal, setMergeOptionsInModal] = useState({});
  const [mergeOptions3InModal, setMergeOptions3InModal] = useState({});

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
        const end_date = record?.datestr;
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
            <br />
            <Tag>
              <a
                target="_blank"
                href={`http://${location.host}/alarm?symbol=${text}&datestr=${record.datestr}`}
              >
                {'Show alarm'}
              </a>
            </Tag>
            <br />
            <Button
                onClick={async () => {
                  setIsLoading(true);
                  const data = await getAllCriStocks(
                    end_date,
                    end_date,
                    false,
                    text,
                    false
                  );
                  const downData = await getAllCriStocks(
                    end_date,
                    end_date,
                    false,
                    text,
                    false,
                    true
                  );
                  const data3 = await getAllCriStocks3(
                    end_date,
                    end_date,
                    false,
                    text,
                    false
                  );
                  const downData3 = await getAllCriStocks3(
                    end_date,
                    end_date,
                    false,
                    text,
                    false,
                    true
                  );

                  setIsModalVisible(true);
                  setMergeOptionsInModal(MergeOptions(data, downData));
                  setMergeOptions3InModal(MergeOptions(data3, downData3));

                  setIsLoading(false);
                }}
            >
              Show Charts
            </Button>
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
      <Modal
        title="Charts"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button onClick={() => setIsModalVisible(false)} type="primary">
            OK
          </Button>,
        ]}
        width={1500}
      >
        5 DAYs:
        <img src={img} style={{ width: '200px' }} />
        {!isEmpty(mergeOptionsInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeOptionsInModal}
          />
        )}
        3 DAYs
        {!isEmpty(mergeOptions3InModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeOptions3InModal}
          />
        )}
      </Modal>
    </div>
  );
};
