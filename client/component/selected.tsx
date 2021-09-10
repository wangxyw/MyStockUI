import React, { useEffect, useState } from 'react';
import ReactEcharts from 'echarts-for-react';
import { Select } from 'antd';

export const Selected = () => {
    const [stocks, setStocks] = useState<any[]>([]);
    const [selectStockId, setSelectStockId] = useState<any>('');
    const [selectVom, setSelectVom] = useState<number>(40000);
    const [option, setOption] = useState<any>({});
    const reDrawChart = (stock_id, minvol = 40000) => {
      fetch(`/api/stock_info?stock_id=${stock_id}&minvol=${minvol}`, {
        method: 'GET',
      })
        .then((res) => res.json())
        .then((data) => {
          console.log(data);
          setOption(
            {
              title: {
                text: '',
                left: 0,
              },
              legend: {
                data: ['TotalPct', 'DPct'],
              },
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
              grid: [
                {
                  left: '10%',
                  right: '1%',
                  // height: '70%'
                },
              ],
              xAxis: {
                type: 'category',
                data: data.map((i) => i.datestr),
                axisLabel: { show: true, interval: 0, rotate: 45 },
              },
              yAxis: {
                type: 'value',
              },
              series: [
                {
                  name: 'TotalPct',
                  type: 'bar',
                  data: data.map((i) => i.totalvolpct * 100),
                  itemStyle: {
                    normal: {
                      color: '#333',
                    },
                  },
                },
                {
                  name: 'DPct',
                  type: 'bar',
                  data: data.map((i) => i.dvaluepct * 100),
                  itemStyle: {
                    normal: {
                      color: function (params) {
                        var colorList;
                        const status = data.map((i) => i.status);
                        if (status[params.dataIndex] == 'up') {
                          colorList = '#ef232a';
                        } else {
                          colorList = '#14b143';
                        }
                        return colorList;
                      },
                    },
                  },
                },
              ],
            },
          );
        })
        .catch((error) => {
          alert(error);
        }); 
    };
    useEffect(() => {
      fetch('/api/stock_list', { method: 'GET' })
      .then((res) => res.json())
      .then((data) => {
        setStocks( data );
      })
      .catch((error) => {
        alert(error);
      });
    }, []);
    var vols = [40000, 50000, 60000, 70000, 80000, 90000, 100000];
    const { Option } = Select;
    return (
      <section className="pageContentInner">
        <div className="head-section">
          <h1>Stock ID: {selectStockId}</h1>
        </div>
        <p style={{ display: 'inline-block', marginRight: '10px' }}>
          Select Stocks:{' '}
        </p>
        <Select
          //title="Select Stock"
          style={{ width: '200px' }}
          onChange={(v) => {
            setSelectStockId(v);
            reDrawChart(v, selectVom);
          }}
        >
          {stocks.map((i) => (
            <Option key={i.symbol} value={i.symbol}>
              {i.symbol}
            </Option>
          ))}
        </Select>
        <p style={{ display: 'inline-block', marginRight: '10px' }}>
          Select Vol:{' '}
        </p>
        <Select
          // title="Select MinVOL"
          style={{ width: '100px', marginBottom: '20px' }}
          defaultValue={40000}
          onChange={(v) => {
            setSelectVom( v );
            reDrawChart(selectStockId, v);
          }}
        >
          {vols.map((i) => (
            <Option key={i} value={i}>
              {i}
            </Option>
          ))}
        </Select>
        <ReactEcharts
          style={{ height: 250, width: 1350 }}
          notMerge={true}
          lazyUpdate={true}
          option={option}
        />
      </section>
    );
  }

