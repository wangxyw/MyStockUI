import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Modal,
} from 'antd';
import ReactEcharts from 'echarts-for-react';
import img from './mark.jpg';
import React, { useEffect, useState } from 'react';
import { get, post } from '../lib';
import { caculateDate, caculateDaysTwoDate } from './alarm';
import moment from 'moment';
import './alarm.css';
import DATA from './date.json';
import { uniqBy, isEmpty, orderBy, includes } from 'lodash';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

function average(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += parseFloat(arr[i]);
  }
  return sum / arr.length;
}

const options = (data) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const xAxis = orderedData?.map((i) => i.datestr);
  const maxT = orderedData?.map((i) =>
    i?.turnoverrates_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b))
  );
  const averageT = orderedData?.map((i) =>
    (
      i?.turnoverrates_str
        ?.split('|')
        ?.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) /
      i?.turnoverrates_str?.split('|')?.length
    )?.toFixed(2)
  );
  const minT = orderedData?.map((i) =>
    i?.turnoverrates_str
      ?.split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a))
  );
  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['MaxOverRate', 'MinOverRate', 'AverageOverRate'],
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
      data: xAxis,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'MaxOverRate',
        type: 'line',
        data: maxT,
        // itemStyle: {
        //   normal: {
        //     color: '#444',
        //   },
        // },
        label: {
          position: 'top',
        },
      },
      {
        name: 'MinOverRate',
        type: 'line',
        data: minT,
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
        name: 'AverageOverRate',
        type: 'line',
        data: averageT,
        // itemStyle: {
        //   normal: {
        //     color: 'blue',
        //   },
        // },
      },
    ],
  };
};

// 通用工具函数：为图表添加异常时间窗口标记
const addMarkAreaToOption = (option, anomalyWindows) => {
  // 如果没有异常窗口数据，直接返回原配置
  if (!anomalyWindows || anomalyWindows.length === 0 || !option) return option;
  
  const markAreaData = anomalyWindows.map(window => [
    {
      name: '异常窗口',
      xAxis: window.start_date,
      itemStyle: {
        color: 'rgba(255, 99, 132, 0.25)',
        borderColor: '#ff4444',
        borderWidth: 1,
        borderType: 'dashed',
      },
      label: {
        show: true,
        position: 'insideTop',
        formatter: `⚠️ ${window.start_date} ~ ${window.end_date}`,
        color: '#ff4444',
        fontWeight: 'bold',
        fontSize: 10,
        rotate: 0,
      },
      tooltip: {
        show: true,
        formatter: () => `异常时间窗口<br/>${window.start_date} 至 ${window.end_date}`,
      },
    },
    {
      xAxis: window.end_date,
    },
  ]);

  const markAreaConfig = {
    silent: false,
    label: { show: true },
    data: markAreaData,
    animation: false,
  };

  // 给所有系列添加
  if (option.series) {
    option.series = option.series.map(series => ({
      ...series,
      markArea: markAreaConfig,
    }));
  }
  
  return option;
};

const MergeQuantityRelativeRatios = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');

  const allData = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr');
  const allDataDate = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr')?.map(
    (i) => i.datestr
  );

  const quantityRelativeRatios = allData?.map((i) =>
    i?.quantity_relative_ratio
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['QuantityRelativeRatios'],
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
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'QuantityRelativeRatios',
        type: 'line',
        data: quantityRelativeRatios,
        label: {
          position: 'top',
        },
      },
    ],
  };
};

const MergeBigOrderPct = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const allUpDataDate = orderedData.map((i) => i.datestr);
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');
  const allDownDataDate = orderedDownData.map((i) => i.datestr);

  const allData = orderBy(
    uniqBy([...orderedData, ...orderedDownData], 'datestr'),
    'datestr'
  );
  const allDataDate = orderBy(
    uniqBy([...orderedData, ...orderedDownData], 'datestr'),
    'datestr'
  )?.map((i) => i.datestr);

  const maxBigOrderPct = allData?.map((i) => ({
    value: i?.big_order_pcts_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)),
    datestr: i.datestr,
  }));
  const minBigOrderPct = allData?.map((i) => ({
    value: i?.big_order_pcts_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)),
    datestr: i.datestr,
  }));
  const avgBigOrderPct = allData?.map((i) => ({
    value: i?.big_order_pcts_str
      ?.split('|')
      ?.reduce((a, b) => (parseFloat(a) + parseFloat(b))) / i?.big_order_pcts_str?.split('|')?.length?.toFixed(2),
    datestr: i.datestr,
  }));

  const avgUpBigOrderPct = allData?.map((i) => ({
    value: includes(allUpDataDate, i.datestr)? i?.big_order_pcts_str?.split('|')
      ?.reduce((a, b) => (parseFloat(a) + parseFloat(b))) / i?.big_order_pcts_str?.split('|')?.length?.toFixed(2) : null,
    datestr: i.datestr,
  }));

  const avgDownBigOrderPct = allData?.map((i) => ({
    value: includes(allDownDataDate, i.datestr)? i?.big_order_pcts_str?.split('|')
      ?.reduce((a, b) => (parseFloat(a) + parseFloat(b))) / i?.big_order_pcts_str?.split('|')?.length?.toFixed(2) : null,
    datestr: i.datestr,
  }));

  const sourcesMap = allData?.map(
    (i) => i?.source
  );  
  const statusMap = allData?.map(
    (i) => i?.status
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['MaxBigOrderPct', 'MinBigOrderPct', 'AvgBigOrderPct', 'AvgUpBigOrderPct', 'AvgDownBigOrderPct'],
      selected:{
        'MaxBigOrderPct': false,
        'MinBigOrderPct': false,
        'AvgBigOrderPct': true,
        'AvgUpBigOrderPct': true,
        'AvgDownBigOrderPct': true,
      },
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
          type: ['line'],
        },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
      onclick: (e) => {
        console.log(e);
      },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'MaxBigOrderPct',
        type: 'line',
        data: maxBigOrderPct,
      },
      {
        name: 'MinBigOrderPct',
        type: 'line',
        data: minBigOrderPct,
      },
      {
        name: 'AvgBigOrderPct',
        type: 'line',
        data: avgBigOrderPct,
      },
      {
        name: 'AvgUpBigOrderPct',
        type: 'scatter',
        color: 'red',
        data: avgUpBigOrderPct,
        label: {
          show: true,
          position: 'top',
          fontSize: 14,
          fontWeight: 'bold',
          formatter: function(d) {
            var sourceLabel;
            if (sourcesMap[d.dataIndex] == '400s' || sourcesMap[d.dataIndex] == 'dr_400s') {
              sourceLabel = '4s';
            } else if (sourcesMap[d.dataIndex] == '100w' || sourcesMap[d.dataIndex] == 'dr_100w') {
              sourceLabel = '1w';
            } else if (sourcesMap[d.dataIndex] == 'dr_100s') {
              sourceLabel = '1s';
            } else {
              sourceLabel = 'nil';
            }

            var udstatus;
            if (statusMap[d.dataIndex] == 'up') {
               return '{up|' + sourceLabel + '}';
            } else {
               return '{down|' + sourceLabel + '}';
            }
          },
          rich: {
            up: {
              color: 'red',
            },
            down: {
              color: 'green',
            },
          },
        },
      },
      {
        name: 'AvgDownBigOrderPct',
        type: 'scatter',
        color: 'green',
        data: avgDownBigOrderPct,
        label: {
          show: true,
          position: 'top',
          fontSize: 14,
          fontWeight: 'bold',
          formatter: function(d) {
            var sourceLabel;
            if (sourcesMap[d.dataIndex] == '400s' || sourcesMap[d.dataIndex] == 'dr_400s') {
              sourceLabel = '4s';
            } else if (sourcesMap[d.dataIndex] == '100w' || sourcesMap[d.dataIndex] == 'dr_100w') {
              sourceLabel = '1w';
            } else if (sourcesMap[d.dataIndex] == 'dr_100s') {
              sourceLabel = '1s';
            } else {
              sourceLabel = 'nil';
            }

            var udstatus;
            if (statusMap[d.dataIndex] == 'up') {
               return '{up|' + sourceLabel + '}';
            } else {
               return '{down|' + sourceLabel + '}';
            }
          },
          rich: {
            up: {
              color: 'red',
            },
            down: {
              color: 'green',
            },
          },
        },
      },
    ],
  };
};

const MergeProfitChips = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');

  const allData = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr');
  const allDataDate = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr')?.map(
    (i) => i.datestr
  );

  const maxProfitChips = allData?.map((i) =>
    i?.profit_chips_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b))
  );
  const minProfitChips = allData?.map((i) =>
    i?.profit_chips_str
      ?.split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a))
  );
  const dProfitChips = allData?.map((i) =>
    i?.profit_chips_str
      .split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)) - 
    i?.profit_chips_str
      ?.split('|')
      .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a))
  );
  const sourcesMap = allData?.map(
    (i) => i?.source
  );  
  const statusMap = allData?.map(
    (i) => i?.status
  );  
  const continueDays= allData?.map(
    (i) => i?.days + "days"
  ); 

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['MaxProfitChips', 'MinProfitChips', 'DProfitChips'],
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
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'MaxProfitChips',
        type: 'line',
        data: maxProfitChips,
        label: {
          show: true,
          position: 'top',
          // color: "black",
          fontSize: 12,
          formatter: function(d) {
            var sourceLabel;
            if (sourcesMap[d.dataIndex] == '400s' || sourcesMap[d.dataIndex] == 'dr_400s') {
              sourceLabel = '4s';
            } else if (sourcesMap[d.dataIndex] == '100w' || sourcesMap[d.dataIndex] == 'dr_100w') {
              sourceLabel = '1w';
            } else if (sourcesMap[d.dataIndex] == 'dr_100s') {
              sourceLabel = '1s';
            } else {
              sourceLabel = 'nil';
            }

            var udstatus;
            if (statusMap[d.dataIndex] == 'up') {
               return '{up|' + sourceLabel + '}';
            } else {
               return '{down|' + sourceLabel + '}';
            }
          },
          rich: {
            up: {
              color: 'red',
            },
            down: {
              color: 'green',
            },
          },
        },
      },
      {
        name: 'MinProfitChips',
        type: 'line',
        data: minProfitChips,
      },
      {
        name: 'DProfitChips',
        type: 'line',
        data: dProfitChips,
      },
      {
        name: 'ContinueDays',
        type: 'line',
        data: continueDays,
      },
    ],
  };
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

  const avgT = orderedData?.map((i) => ({
    value: i?.turnoverrates_str
      ?.split('|')
      ?.reduce((a, b) => (parseFloat(a) + parseFloat(b))) / i?.turnoverrates_str?.split('|')?.length?.toFixed(2),
    datestr: i.datestr,
    haveLimit: i?.have_limit,
  }));

  const avgDownT = orderedDownData?.map((i) => ({
    value: i?.turnoverrates_str
      ?.split('|')
      ?.reduce((a, b) => (parseFloat(a) + parseFloat(b))) / i?.turnoverrates_str?.split('|')?.length?.toFixed(2),
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

  const avgValues = allData?.map((i) =>
    avgT?.find((m) => m.datestr === i)
      ? avgT?.find((m) => m.datestr === i).value
      : '-'
  );
  const avgValuesMap = allData?.map((i) =>
    avgT?.find((m) => m.datestr === i)
      ? {
          value: avgT?.find((m) => m.datestr === i).value,
          haveLimit: avgT?.find((m) => m.datestr === i).haveLimit,
        }
      : '-'
  );

  const avgDownValues = allData?.map((i) =>
    avgDownT?.find((m) => m.datestr === i)
      ? avgDownT?.find((m) => m.datestr === i).value
      : '-'
  );
  const avgDownValuesMap = allData?.map((i) =>
    avgDownT?.find((m) => m.datestr === i)
      ? {
          value: avgDownT?.find((m) => m.datestr === i).value,
          haveLimit: avgDownT?.find((m) => m.datestr === i).haveLimit,
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
        'AVGOverRate',
        'AVGDownOverRate',
      ],
      selected:{
        'MaxOverRate': false,
        'MinOverRate': false,
        'DownMaxOverRate': false,
        'DownMinOverRate': false,
        'AVGOverRate': true,
        'AVGDownOverRate': true,
      },
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
            color: '#FF0000',
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
            color: '#FFC0CB',
          },
        },
        data: minTValues,
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
            color: '#00FF00',
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
            color: '#7CFC00',
          },
        },
      },
      {
        name: 'AVGOverRate',
        type: 'line',
        // symbol: 'diamond',
        symbol: (v, params) => {
          var colorList;
          if (avgValuesMap[params.dataIndex]?.haveLimit == '1') {
            colorList = 'arrow';
          } else if (avgValuesMap[params.dataIndex]?.haveLimit == '-1') {
            colorList = 'circle';
          } else if (avgValuesMap[params.dataIndex]?.haveLimit == '2') {
            colorList = 'pin';
          } else {
            colorList = 'diamond';
          }
          return colorList;
        },
        symbolSize: 10,
        data: avgValues,
        itemStyle: {
          normal: {
            color: '#FFFF00',
          },
        },
      },
      {
        name: 'AVGDownOverRate',
        type: 'line',
        // symbol: 'diamond',
        symbol: (v, params) => {
          var colorList;
          if (avgDownValuesMap[params.dataIndex]?.haveLimit == '1') {
            colorList = 'arrow';
          } else if (avgValuesMap[params.dataIndex]?.haveLimit == '-1') {
            colorList = 'circle';
          } else if (avgValuesMap[params.dataIndex]?.haveLimit == '2') {
            colorList = 'pin';
          } else {
            colorList = 'diamond';
          }
          return colorList;
        },
        symbolSize: 10,
        data: avgDownValues,
        itemStyle: {
          normal: {
            color: '#A020F0',
          },
        },
      },
    ],
  };
};

const MergeFluidity = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');

  const allData = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr');
  const allDataDate = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr')?.map(
    (i) => i.datestr
  );

  const fluidity = allData?.map((i) =>
    i?.totaltradevol / (i?.marketvalue / i?.finalprice * 1000000)
  );


  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['Fluidity'],
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
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'Fluidity',
        type: 'line',
        data: fluidity,
        label: {
          position: 'top',
        },
      },
    ],
  };
};

const MergeKDJ = (kdjData) => {
  const orderedData = orderBy(kdjData, 'datestr');
  const allDataDate = orderedData?.map(
    (i) => i.datestr
  );
  const k = orderedData?.map((i) =>
    i?.k
  );
  const d = orderedData?.map((i) =>
    i?.d
  );
  const j = orderedData?.map((i) =>
    i?.j
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['k', 'd', 'j'],
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
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'k',
        type: 'line',
        data: k,
        label: {
          position: 'top',
        },
      },
      {
        name: 'd',
        type: 'line',
        data: d,
        label: {
          position: 'top',
        },
      },
      {
        name: 'j',
        type: 'line',
        data: j,
        label: {
          position: 'top',
        },
      },
    ],
  };
};

const MergeDMI = (dmiData) => {
  const orderedData = orderBy(dmiData, 'datestr');
  const allDataDate = orderedData?.map(
    (i) => i.datestr
  );
  const pdi = orderedData?.map((i) =>
    i?.pdi
  );
  const mdi = orderedData?.map((i) =>
    i?.mdi
  );
  const adx = orderedData?.map((i) =>
    i?.adx
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['pdi', 'mdi', 'adx'],
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
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'pdi',
        type: 'line',
        data: pdi,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#FF0000', // 修改为红色
          },
        },        
      },
      {
        name: 'mdi',
        type: 'line',
        data: mdi,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#00FF00', // 纯绿色
          },
        },
      },
      {
        name: 'adx',
        type: 'line',
        data: adx,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#800080', // 纯绿色
          },
        },
      },
    ],
  };
};

// 修改 MergeContinuousProfitChips 函数，添加异常窗口参数
const MergeContinuousProfitChips = (profitChipsData, anomalyWindows = []) => {
  const orderedData = orderBy(profitChipsData, 'datestr');
  const allDataDate = orderedData?.map(
    (i) => i.datestr
  );
  const pc = orderedData?.map((i) =>
    i?.profit_chip
  );
  const tr = orderedData?.map((i) =>
    (i?.turnoverrate < 0 || i?.turnoverrate > 100) ? 0 : i?.turnoverrate
  );

  const option = {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['profit_chip', 'turnoverrate'],
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
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: false, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'profit_chip',
        type: 'line',
        data: pc,
        label: {
          position: 'top',
        },
      },
      {
        name: 'turnoverrate',
        type: 'line',
        data: tr,
        label: {
          position: 'top',
        },
        itemStyle: {
          color: '#ff0000'
        },
      },
    ],
  };
  
  // 添加异常窗口标记
  return addMarkAreaToOption(option, anomalyWindows);
};

const MergeMA = (maData) => {
  const orderedData = orderBy(maData, 'datestr');
  const allDataDate = orderedData?.map(
    (i) => i.datestr
  );
  const ma5 = orderedData?.map((i) =>
    i?.ma5
  );
  const ma10 = orderedData?.map((i) =>
    i?.ma10
  );
  const ma20 = orderedData?.map((i) =>
    i?.ma20
  );
  const ma60 = orderedData?.map((i) =>
    i?.ma60
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['ma5', 'ma10', 'ma20', 'ma60'],
      selected:{
        'ma5': true,
        'ma10': false,
        'ma20': false,
        'ma60': true,
      },
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
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'ma5',
        type: 'line',
        data: ma5,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#800080', // 修改为红色
          },
        },        
      },
      {
        name: 'ma10',
        type: 'line',
        data: ma10,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#FFFF00', // 纯绿色
          },
        },
      },
      {
        name: 'ma20',
        type: 'line',
        data: ma20,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#0000FF', // 纯蓝色
          },
        },
      },
      {
        name: 'ma60',
        type: 'line',
        data: ma60,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#ff0000', // 纯红色
          },
        },
      },
    ],
  };
};

const MergeDS = (dsData) => {
  const orderedData = orderBy(dsData, 'datestr');
  const allDataDate = orderedData?.map(
    (i) => i.datestr
  );
  const perDynamic = orderedData?.map((i) =>
    i?.per_dynamic
  );
  const perStatic = orderedData?.map((i) =>
    i?.per_static
  );
  const differences = orderedData?.map((i) => 
    Math.abs((i?.per_dynamic || 0) - (i?.per_static || 0))
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['dynamic', 'static', 'difference'],
      selected:{
        'dynamic': true,
        'static': true,
        'difference': true,
      },
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
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'dynamic',
        type: 'line',
        data: perDynamic,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#800080', // 修改为红色
          },
        },        
      },
      {
        name: 'static',
        type: 'line',
        data: perStatic,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#ff0000', // 纯红色
          },
        },
      },
      {
        name: 'difference',
        type: 'line',
        data: differences,
        label: {
          position: 'top',
        },
        itemStyle: {
          normal: {
            color: '#000000', // 黑色
          },
        },
      },
    ],
  };
};

const MergeTotalTradeVol = (totaltradevolData) => {
  const orderedData = orderBy(totaltradevolData, 'datestr'); // 注意：这里应该是 totaltradevolData，不是 maData
  const allDataDate = orderedData?.map(
    (i) => i.datestr
  );
  const totaltradevol = orderedData?.map((i) =>
    i?.totaltradevol
  );

  return {
    title: {
      text: '',
      left: 0,
    },
    legend: {
      data: ['totaltradevol'],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow', // 柱状图适合用shadow类型
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
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'totaltradevol',
        type: 'bar', // 主要修改：将 'line' 改为 'bar'
        data: totaltradevol,
        label: {
          position: 'top',
          show: false, // 添加show属性确保标签显示
        },
        itemStyle: {
          color: '#800080', // 简化颜色设置
        },
        // 可选：添加柱状图特定配置
        barWidth: '60%', // 控制柱状图宽度
      },
    ],
  };
};

const MergeSCR = (scrData) => {
  // 按日期升序排列，并将 datestr 转换为 YYYY-MM-DD 格式
  const orderedData = orderBy(scrData, 'datestr').map((item) => ({
    ...item,
    datestr: moment(item.datestr).format('YYYY-MM-DD'),
  }));
  const allDataDate = orderedData.map((i) => i.datestr);

  // 获利盘比例（%）
  const profitChip = orderedData.map((i) => i.profit_chip);

  return {
    title: {
      text: '腾讯筹码分布趋势',
      left: 'center',
    },
    legend: {
      data: [
        '获利盘比例(%)',
      ],
      left: 'left',
      selected: {
        '获利盘比例(%)': true,
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    toolbox: {
      show: true,
      orient: 'vertical',
      left: 'right',
      top: 'center',
      feature: {
        mark: { show: true },
        magicType: { show: true, type: ['line', 'bar'] },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { show: true, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
      name: '数值 (%)',
    },
    series: [
      {
        name: '获利盘比例(%)',
        type: 'line',
        data: profitChip,
        smooth: true,
        lineStyle: { color: '#5470c6', width: 2 },
        symbol: 'circle',
        symbolSize: 6,
        label: { show: true, position: 'top', formatter: '{c}' },
      },
    ],
  };
};

const MergeSCRDetails1 = (scrData) => {
  const orderedData = orderBy(scrData, 'datestr').map((item) => ({
    ...item,
    datestr: moment(item.datestr).format('YYYY-MM-DD'),
  }));
  const allDataDate = orderedData.map((i) => i.datestr);

  const priceRangeLow90 = orderedData.map((i) => {
    const parts = i.tencent_price_range_90?.split(',');
    return parts ? parseFloat(parts[0]) : null;
  });
  const priceRangeHigh90 = orderedData.map((i) => {
    const parts = i.tencent_price_range_90?.split(',');
    return parts ? parseFloat(parts[1]) : null;
  });
  const priceRangeLow70 = orderedData.map((i) => {
    const parts = i.tencent_price_range_70?.split(',');
    return parts ? parseFloat(parts[0]) : null;
  });
  const priceRangeHigh70 = orderedData.map((i) => {
    const parts = i.tencent_price_range_70?.split(',');
    return parts ? parseFloat(parts[1]) : null;
  });

  const rangeWidth90 = priceRangeHigh90.map((high, idx) => 
    high && priceRangeLow90[idx] ? high - priceRangeLow90[idx] : null
  );
  const rangeWidth70 = priceRangeHigh70.map((high, idx) => 
    high && priceRangeLow70[idx] ? high - priceRangeLow70[idx] : null
  );

  return {
    title: { text: '筹码成本分布区间', left: 'center' },
    legend: {
      data: ['90%成本区间', '70%成本区间'],  // 图例只显示两个
      left: 'left',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function(params) {
        let res = params[0].axisValue + '<br/>';
        params.forEach(p => {
          if (p.seriesName === '90%成本区间') {
            const low = priceRangeLow90[p.dataIndex];
            const high = priceRangeHigh90[p.dataIndex];
            const width = rangeWidth90[p.dataIndex];
            res += `${p.marker} 90%成本区间: ${low?.toFixed(2)} ~ ${high?.toFixed(2)} 元 (宽度 ${width?.toFixed(2)} 元)<br/>`;
          } else if (p.seriesName === '70%成本区间') {
            const low = priceRangeLow70[p.dataIndex];
            const high = priceRangeHigh70[p.dataIndex];
            const width = rangeWidth70[p.dataIndex];
            res += `${p.marker} 70%成本区间: ${low?.toFixed(2)} ~ ${high?.toFixed(2)} 元 (宽度 ${width?.toFixed(2)} 元)<br/>`;
          }
        });
        return res;
      },
    },
    toolbox: {
      show: true,
      feature: { saveAsImage: { show: true }, magicType: { show: true, type: ['line', 'bar'] } },
    },
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { rotate: 45, interval: 10, fontSize: 10 },
    },
    yAxis: { type: 'value', name: '价格 (元)' },
    series: [
      {
        name: '90%成本区间',       // 上沿同名
        type: 'line',
        data: priceRangeHigh90,
        lineStyle: { color: '#ee6666', width: 2, type: 'solid' },
        symbol: 'circle',
        symbolSize: 6,
        areaStyle: { color: 'rgba(238, 102, 102, 0.1)', origin: 'start' },
        connectNulls: false,
        step: false,
        label: { show: false },
      },
      {
        name: '90%成本区间',       // 下沿同名 → 图例合并
        type: 'line',
        data: priceRangeLow90,
        lineStyle: { color: '#ee6666', width: 2, type: 'solid' },
        symbol: 'circle',
        symbolSize: 6,
        connectNulls: false,
        step: false,
        label: { show: false },
        tooltip: { show: false },   // 避免重复提示
      },
      {
        name: '70%成本区间',
        type: 'line',
        data: priceRangeHigh70,
        lineStyle: { color: '#3ba272', width: 2, type: 'solid' },
        symbol: 'diamond',
        symbolSize: 6,
        areaStyle: { color: 'rgba(59, 162, 114, 0.1)', origin: 'start' },
        connectNulls: false,
        label: { show: false },
      },
      {
        name: '70%成本区间',
        type: 'line',
        data: priceRangeLow70,
        lineStyle: { color: '#3ba272', width: 2, type: 'solid' },
        symbol: 'diamond',
        symbolSize: 6,
        connectNulls: false,
        tooltip: { show: false },
      },
    ],
  };
};

const MergeSCRDetails2 = (scrData) => {
  const orderedData = orderBy(scrData, 'datestr').map((item) => ({
    ...item,
    datestr: moment(item.datestr).format('YYYY-MM-DD'),
  }));
  const allDataDate = orderedData.map((i) => i.datestr);
  const concentration90 = orderedData.map((i) => i.tencent_concentration_90);
  const concentration70 = orderedData.map((i) => i.tencent_concentration_70);

  return {
    title: { text: '筹码成本集中度趋势', left: 'center' },
    legend: {
      data: ['90%成本集中度(%)', '70%成本集中度(%)'],
      left: 'left',
    },
    tooltip: { trigger: 'axis' },
    toolbox: {
      show: true,
      feature: { saveAsImage: { show: true }, magicType: { show: true, type: ['line', 'bar'] } },
    },
    xAxis: {
      type: 'category',
      data: allDataDate,
      axisLabel: { rotate: 45, interval: 10, fontSize: 10 },
    },
    yAxis: { type: 'value', name: '集中度 (%)', min: 0 },
    series: [
      {
        name: '90%成本集中度(%)',
        type: 'line',
        data: concentration90,
        smooth: true,
        lineStyle: { color: '#fac858', width: 3, type: 'solid' }, // 加粗线宽
        symbol: 'circle',
        symbolSize: 8,
        label: {
          show: true,
          position: 'top',
          formatter: '{c}',
          fontSize: 10,
          offset: [0, -5],
        },
        areaStyle: { opacity: 0.1, color: '#fac858' }, // 添加轻微填充
      },
      {
        name: '70%成本集中度(%)',
        type: 'line',
        data: concentration70,
        smooth: true,
        lineStyle: { color: '#73c0de', width: 3, type: 'solid' },
        symbol: 'diamond',
        symbolSize: 8,
        label: {
          show: true,
          position: 'bottom',
          formatter: '{c}',
          fontSize: 10,
          offset: [0, 5],
        },
        areaStyle: { opacity: 0.1, color: '#73c0de' },
      },
    ],
  };
};

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
  stock,
  isFocused,
  isDown = false
) {
  const stockData = await get(
    `/api/critical_data3?start_date=${startDate}&end_date=${endDate}&from=${from}&stock=${stock}&isFocused=${isFocused}&isDown=${isDown}`
  );
  // const stockPriceByDay =
  //   stockData?.length > 0
  //     ? await post(`/api/get_price_from_common_data`, {
  //         body: JSON.stringify({
  //           stocks: stockData.map((i) => `'${i.symbol}'`).join(','),
  //           today: caculateDate(endDate, 0),
  //         }),
  //       })
  //     : stockData;
  // const stockEachDayPriceData =
  //   stockData?.length > 0
  //     ? await post(`/api/get_price_from_common_data`, {
  //         body: JSON.stringify({
  //           stocks: stockData.map((i) => `'${i.symbol}'`).join(','),
  //           simulateDate: caculateDate(today, 0),
  //           startDate: '2023-01-01',
  //         }),
  //       })
  //     : stockData;
  return stockData;
  // .map((i) => ({
  //   ...i,
  //   todayPrice: stockPriceByDay?.find((s) => s.symbol === i.symbol)?.finalprice,
  //   todayProfit: stockPriceByDay?.find((s) => s.symbol === i.symbol)
  //     ?.profit_chip,
  //   // daysProfit: stockEachDayPriceData
  //   //   ?.filter((s) => s.symbol === i.symbol)
  //   //   ?.map((e) => ({ datestr: e.datestr, profit: e.profit_chip })),
  // }));
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
  // const stockPriceByDay =
  //   stockData?.length > 0
  //     ? await post(`/api/get_price_from_common_data`, {
  //         body: JSON.stringify({
  //           stocks: stockData.map((i) => `'${i.symbol}'`).join(','),
  //           today: caculateDate(endDate, 0),
  //         }),
  //       })
  //     : stockData;
  // const stockEachDayPriceData =
  //   stockData?.length > 0
  //     ? await post(`/api/get_price_from_common_data`, {
  //         body: JSON.stringify({
  //           stocks: stockData.map((i) => `'${i.symbol}'`).join(','),
  //           simulateDate: caculateDate(today, 0),
  //           startDate: '2023-01-01',
  //         }),
  //       })
  //     : stockData;
  return stockData;
  // .map((i) => ({
  //   ...i,
  //   todayPrice: stockPriceByDay?.find((s) => s.symbol === i.symbol)?.finalprice,
  //   todayProfit: stockPriceByDay?.find((s) => s.symbol === i.symbol)
  //     ?.profit_chip,
  //   // daysProfit: stockEachDayPriceData
  //   //   ?.filter((s) => s.symbol === i.symbol)
  //   //   ?.map((e) => ({ datestr: e.datestr, profit: e.profit_chip })),
  // }));
}

async function getContinuousProfitChips(
  stock,
  startDate: any = null,
  endDate: any = 0
) {
  const profitChipsData = await get(
    `/api/profit_chips?stock=${stock}&start_date=${startDate}&end_date=${endDate}`
  );
  return profitChipsData;
}

async function getKDJ(
  stock,
  startDate: any = null,
  endDate: any = 0
) {
  const stockData = await get(
    `/api/kdj?stock=${stock}&start_date=${startDate}&end_date=${endDate}`
  );
  return stockData;
}

async function getDMI(
  stock,
  startDate: any = null,
  endDate: any = 0
) {
  const stockData = await get(
    `/api/dmi?stock=${stock}&start_date=${startDate}&end_date=${endDate}`
  );
  return stockData;
}

async function getMA(
  stock,
  startDate: any = null,
  endDate: any = 0
) {
  const stockData = await get(
    `/api/ma?stock=${stock}&start_date=${startDate}&end_date=${endDate}`
  );
  return stockData;
}

async function getDS(
  stock,
  startDate: any = null,
  endDate: any = 0
) {
  const stockData = await get(
    `/api/ds?stock=${stock}&start_date=${startDate}&end_date=${endDate}`
  );
  return stockData;
}

async function getTotalTradeVol(
  stock,
  startDate: any = null,
  endDate: any = 0
) {
  const stockData = await get(
    `/api/totaltradevol?stock=${stock}&start_date=${startDate}&end_date=${endDate}`
  );
  return stockData;
}

async function getSCR(
  stock,
  startDate: any = null,
  endDate: any = 0
) {
  const stockData = await get(
    `/api/stock_chip_result?stock=${stock}&start_date=${startDate}&end_date=${endDate}`
  );
  return stockData;
}

async function getAllSCR(
  stock,
  startDate: any = null,
  endDate: any = 0
) {
  const stockData = await get(
    `/api/all_stock_chip_result?stock=${stock}&start_date=${startDate}&end_date=${endDate}`
  );
  return stockData;
}

async function getStockPortrait(stock, endDate: any = 0, alarmDate: any = null) {
  if (!stock || !endDate) return null;
  const alarmDateParam = alarmDate
    ? `&alarm_datestr=${encodeURIComponent(alarmDate)}`
    : '';
  return get(
    `/api/stock_ai_portrait?symbol=${encodeURIComponent(stock)}&datestr=${encodeURIComponent(endDate)}${alarmDateParam}`
  );
}

const highRiskPortraitTags = [
  '高换手低盈利承接弱',
  '低盈利未修复+观察高分',
  '低盈利+中等筹码带回撤',
  '低盈利+收盘承接弱',
  '近高位低盈利背离',
  '趋势空头+均换不足+筹码无修复',
  '低位低换弹性不足',
];

const mediumRiskPortraitTags = [
  '低分+盈利无修复+短均走弱',
  '低换滞涨',
  '技术风险叠加',
  '均线全空弱势',
  '低流动弱趋势',
  '低位无承接空头',
];

const getRiskTagLevel = (tagText: string) => {
  if (!tagText.includes('风险')) return null;
  if (highRiskPortraitTags.some((tag) => tagText.includes(tag))) return '高';
  if (mediumRiskPortraitTags.some((tag) => tagText.includes(tag))) return '中';
  return '低';
};

const getRiskTagRank = (tagText: string) => {
  const level = getRiskTagLevel(tagText);
  if (level === '高') return 0;
  if (level === '中') return 1;
  if (level === '低') return 2;
  return 3;
};

const formatRiskTagText = (tagText: string) => {
  const level = getRiskTagLevel(tagText);
  return level ? `${level}｜${tagText}` : tagText;
};

const getPostAlertPortraitTagColor = (tagText: string) => {
  if (tagText.includes('后市层级:高质修复候选')) return 'volcano';
  if (tagText.includes('后市层级:高质修复')) return 'red';
  if (tagText.includes('后市层级:普通确认')) return 'red';
  if (tagText.includes('后市层级:谨慎跟踪')) return 'blue';
  if (tagText.startsWith('后市试:')) return 'red';
  if (tagText.startsWith('后市等:')) return 'blue';
  if (tagText.startsWith('后市慎:')) return 'orange';
  if (tagText.startsWith('后市避:')) return 'green';
  if (tagText.includes('D4D7热扩确认') || tagText.includes('曾D4D7热扩确认') || tagText.includes('早期热扩确认')) return 'red';
  if (tagText.includes('D60强确认') || tagText.includes('曾D60强确认') || tagText.includes('后市:确认')) return 'red';
  if (tagText.includes('D30早期确认') || tagText.includes('曾D30早期确认')) return 'volcano';
  if (tagText.includes('D60降权') || tagText.includes('首次降权')) return 'gold';
  if (tagText.includes('D90放弃') || tagText.includes('从未确认已放弃') || tagText.includes('首次放弃') || tagText.includes('后市:放弃')) return 'green';
  if (tagText.includes('已大幅兑现') || tagText.includes('确认涨幅偏高') || tagText.includes('当前涨幅>') || tagText.includes('首次兑现')) return 'orange';
  if (tagText.includes('确认后转弱')) return 'gold';
  if (tagText.includes('继续观察') || tagText.includes('尚未确认') || tagText.includes('等待确认') || tagText.includes('后市:观察')) return 'blue';
  if (tagText.includes('后市变化') || tagText.includes('后市样本')) return 'geekblue';
  return undefined;
};

const getPortraitTagColor = (tagText: string) => {
  if (tagText.includes('后市')) return getPostAlertPortraitTagColor(tagText);
  if (/^首次(D4D7|D60|D30|放弃|降权):/.test(tagText)) return getPostAlertPortraitTagColor(tagText);
  if (tagText.includes('序列确认:')) return 'red';
  if (tagText.includes('序列警戒:')) return 'gold';
  if (tagText.includes('低分修复:')) return 'geekblue';
  if (tagText.includes('低分观察:')) return 'blue';
  if (tagText.includes('备选:')) return 'blue';
  if (tagText.includes('短线观察:')) return 'orange';
  if (tagText.includes('短线:')) return 'volcano';
  if (tagText.includes('警戒:')) return 'gold';
  if (tagText.includes('风险')) return 'green';
  if (tagText.includes('回撤管理')) return 'green';
  if (
    ['强信号', '强核心', '超强信号', '强信号质量', '强信号弹性:高换手高弹', '强信号弹性:回撤后放量修复', '强信号弹性:普通'].some((tag) =>
      tagText.includes(tag)
    )
  ) {
    return 'red';
  }
  if (
    ['观察', '中等筹码带+活跃承接', '盈利筹码回落蓄势', '强信号弹性:核心承接低弹'].some((tag) =>
      tagText.includes(tag)
    )
  ) {
    return 'blue';
  }
  return undefined;
};

const formatPortraitTagText = (tagText: string) => {
  if (tagText.includes('后市画像:')) return tagText.replace('后市画像:', '后｜');
  if (tagText.startsWith('后市试:')) return tagText.replace('后市试:', '后试｜');
  if (tagText.startsWith('后市等:')) return tagText.replace('后市等:', '后等｜');
  if (tagText.startsWith('后市慎:')) return tagText.replace('后市慎:', '后慎｜');
  if (tagText.startsWith('后市避:')) return tagText.replace('后市避:', '后避｜');
  if (tagText.includes('后市层级:')) return tagText.replace('后市层级:', '层｜');
  if (tagText.includes('后市路径:')) return tagText.replace('后市路径:', '路｜');
  if (tagText.includes('后市:')) return tagText.replace('后市:', '后｜');
  if (/^首次(D60|D30|放弃|降权):/.test(tagText)) return tagText.replace(/^首次/, '首｜');
  if (tagText.includes('后市变化:')) return tagText.replace('后市变化:', '变｜');
  if (tagText.includes('后市样本:')) return tagText.replace('后市样本:', '样｜');
  if (/^(买|试|等|慎|避|跟踪)[:｜]/.test(tagText)) return tagText.replace(/^([买试等慎避]|跟踪):/, '$1｜');
  if (['强信号', '观察', '无效'].includes(tagText)) return tagText;
  const riskText = formatRiskTagText(tagText);
  if (riskText !== tagText) return riskText;
  if (tagText.includes('回撤管理')) return `管｜${tagText}`;
  if (tagText.includes('序列确认:')) return `序确｜${tagText}`;
  if (tagText.includes('序列警戒:')) return `序警｜${tagText}`;
  if (tagText.includes('低分修复:')) return `修｜${tagText}`;
  if (tagText.includes('低分观察:')) return `低观｜${tagText}`;
  if (tagText.includes('备选:')) return `候｜${tagText}`;
  if (tagText.includes('短线观察:')) return `短观｜${tagText}`;
  if (tagText.includes('短线:')) return `短｜${tagText}`;
  if (tagText.includes('警戒:')) return `警｜${tagText}`;
  const color = getPortraitTagColor(tagText);
  if (color === 'red') return `强｜${tagText}`;
  if (color === 'blue') return `观｜${tagText}`;
  if (tagText.includes('弱匹配')) return `弱｜${tagText}`;
  return tagText;
};

const getBestPickTagColor = (tagText: string) => {
  if (/^买[:｜]/.test(tagText)) return 'red';
  if (/^试[:｜]/.test(tagText)) return 'volcano';
  if (/^等[:｜]/.test(tagText)) return 'geekblue';
  if (/^跟踪[:｜]/.test(tagText)) return 'blue';
  if (/^慎[:｜]/.test(tagText)) return 'gold';
  if (/^避[:｜]/.test(tagText)) return 'green';
  return undefined;
};

const renderPortraitTag = (
  tagText: string,
  key: string,
  options: { color?: string; fontWeight?: number; fontSize?: number } = {}
) => (
  <Tag
    key={key}
    color={options.color || getPortraitTagColor(tagText)}
    title={tagText}
    style={{
      marginBottom: 4,
      fontSize: options.fontSize || 15,
      lineHeight: '24px',
      fontWeight: options.fontWeight,
    }}
  >
    {formatPortraitTagText(tagText)}
  </Tag>
);

const renderPortraitComments = (comments?: string) => {
  if (!comments) return null;

  const tagTexts = (comments.match(/【[^】]+】/g) || []).map((tag) =>
    tag.slice(1, -1)
  );
  const scoreTag = tagTexts.find((tag) => /^-?\d+(?:\.\d+)?$/.test(tag));
  const statusTag = tagTexts.find((tag) =>
    ['强信号', '观察', '无效'].includes(tag)
  );
  const decisionTag = tagTexts.find((tag) => /^(买|试|等|慎|避|跟踪)[:｜]/.test(tag));
  const factorTags = tagTexts.filter((tag) =>
    /^(C|T|P|R|E|M|DMI|MA|PA):/.test(tag)
  );
  const riskTags = tagTexts.filter((tag) => tag.includes('风险'));
  const sortedRiskTags = [...riskTags].sort(
    (a, b) => getRiskTagRank(a) - getRiskTagRank(b)
  );
  const signalTags = tagTexts.filter(
    (tag) =>
      tag !== scoreTag &&
      tag !== statusTag &&
      tag !== decisionTag &&
      !factorTags.includes(tag) &&
      !riskTags.includes(tag)
  );
  const bestPickTag = decisionTag;

  return (
    <div style={{ lineHeight: 1.9, fontSize: 15 }}>
      {(bestPickTag || scoreTag || statusTag) && (
        <div>
        {bestPickTag &&
          renderPortraitTag(bestPickTag, 'best-pick', {
            color: getBestPickTagColor(bestPickTag),
            fontWeight: 700,
            fontSize: 15,
          })}
        {scoreTag && (
          <span
            style={{
              color: '#222',
              fontWeight: 700,
              fontSize: 18,
              marginRight: 8,
            }}
          >
            {scoreTag}
          </span>
        )}
        {statusTag &&
          renderPortraitTag(statusTag, 'status', {
            fontWeight: 600,
            fontSize: 15,
          })}
        </div>
      )}
      {riskTags.length > 0 && (
        <div>
          {sortedRiskTags.map((tag, index) => renderPortraitTag(tag, `risk-${index}`))}
        </div>
      )}
      {signalTags.length > 0 && (
        <div>
          {signalTags.map((tag, index) =>
            renderPortraitTag(tag, `signal-${index}`)
          )}
        </div>
      )}
      {factorTags.length > 0 && (
        <div style={{ color: '#666', fontSize: 15, lineHeight: 1.8 }}>
          {factorTags.map((tag) => tag.replace(':', ' ')).join(' · ')}
        </div>
      )}
    </div>
  );
};

const getCriticalStockRowKey = (record: any) =>
  [
    record?.symbol || 'unknown',
    record?.end_date || record?.datestr || 'no-date',
    record?.status || 'unknown',
    record?.source || 'no-source',
    record?.alarmtype || 'no-alarmtype',
    record?.days || 'no-days',
    record?.finalprice || 'no-price',
  ].join('-');

// 获取异常时间窗口数据
async function getAnomalyWindows(stock) {
  try {
    const response = await get(`/api/stock_anomaly_windows?stock=${stock}`);

    // 处理返回的数据格式: [{ anomaly_window: "[{...},{...}]" }]
    if (response && Array.isArray(response) && response.length > 0) {
      const firstItem = response[0];
      if (firstItem && firstItem.anomaly_window) {
        const anomalyWindowStr = firstItem.anomaly_window;
        // 解析 JSON 字符串
        const parsedWindows = JSON.parse(anomalyWindowStr);
        // console.log('Parsed anomaly windows:', parsedWindows);
        return parsedWindows || [];
      }
    }
    
    // 如果响应直接是数组格式（没有嵌套 anomaly_window 字段）
    if (response && Array.isArray(response) && response.length > 0 && response[0].start_date) {
      return response;
    }
    
    return [];
  } catch (error) {
    console.error('获取异常窗口失败:', error);
    return [];
  }
}

export const CriticalStocks3Component = () => {
  const [data, setData] = useState<any>([]);
  const [downData, setDownData] = useState<any>();
  const [startDate, setStartDate] = useState(today);     //caculateDate(today, 10)
  const [endDate, setEndDate] = useState(today);
  const [from, setFrom] = useState('400s');
  const [searchStock, setSearchStock] = useState<string>();
  const [givenPrice, setGivenPrice] = useState(10);
  const [givenMinPrice, setGivenMinPrice] = useState(0);
  const [givenCirculation, setGivenCirculation] = useState(20);
  const [givenMinCirculation, setGivenMinCirculation] = useState(0);
  const [givenPreIncreaseLimitation, setGivenPreIncreaseLimitation] =
    useState(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [stockPortrait, setStockPortrait] = useState<any>(null);
  const [stockPortraitError, setStockPortraitError] = useState<string>('');

  // 新增：存储异常窗口数据（仅用于 ProfitChips）
  const [anomalyWindows, setAnomalyWindows] = useState<any[]>([]);

  const [upOptions, setUpOptions] = useState({});
  const [downOptions, setDownOptions] = useState({});
  const [mergeOptions, setMergeOptions] = useState({});
  const [mergeProfitChips, setMergeProfitChips] = useState({});

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [mergeOptionsInModal, setMergeOptionsInModal] = useState({});
  const [mergeOptions3InModal, setMergeOptions3InModal] = useState({});
  const [mergeProfitChips3InModal, setMergeProfitChips3InModal] = useState({});
  const [mergeQuantityRelativeRatiosInModal, setMergeQuantityRelativeRatiosInModal] = useState({});
  const [bigOrderPctInModal, setBigOrderPctInModal] = useState({});
  const [mergeFluidityInModal, setMergeFluidityInModal] = useState({});
  const [mergeKDJInModal, setMergeKDJInModal] = useState({});
  const [mergeDMIInModal, setMergeDMIInModal] = useState({});
  const [mergeContinuousProfitChipsInModal, setContinuousMergeProfitChipsInModal] = useState({});
  const [mergeMAInModal, setMergeMAInModal] = useState({});
  const [mergeDSInModal, setMergeDSInModal] = useState({});
  const [mergeTotalTradeVolInModal, setMergeTotalTradeVolInModal] = useState({});
  const [mergeSCRInModal, setMergeSCRInModal] = useState({});
  const [mergeSCRD1InModal, setMergeSCRD1InModal] = useState({});
  const [mergeSCRD2InModal, setMergeSCRD2InModal] = useState({});
  const [mergeAllSCRD1InModal, setMergeAllSCRD1InModal] = useState({});
  const [mergeAllSCRD2InModal, setMergeAllSCRD2InModal] = useState({});

  // console.log('data', mergeOptions);
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
        const end_date = record?.end_date;
        return (
          <>
            <div>
              <a
                target="_blank"
                href={`https://quote.eastmoney.com/${text}.html`}
              >
                {text}
              </a>
              <br />
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
              <Button
                onClick={async () => {
                  setIsLoading(true);
                  const data = await getAllCriStocks(
                    end_date,
                    end_date,
                    record?.source,
                    text,
                    isFocused
                  );
                  const downData = await getAllCriStocks(
                    end_date,
                    end_date,
                    record?.source,
                    text,
                    isFocused,
                    true
                  );
                  const data3 = await getAllCriStocks3(
                    end_date,
                    end_date,
                    record?.source,
                    text,
                    isFocused
                  );
                  const downData3 = await getAllCriStocks3(
                    end_date,
                    end_date,
                    record?.source,
                    text,
                    isFocused,
                    true
                  );
                  const kdjData = await getKDJ(
                    text,
                    startDate,
                    endDate
                  );
                  const dmiData = await getDMI(
                    text,
                    startDate,
                    endDate
                  );
                  const profitChipsData = await getContinuousProfitChips(
                    text,
                    startDate,
                    endDate
                  );
                  const maData = await getMA(
                    text,
                    startDate,
                    endDate
                  );
                  const dsData = await getDS(
                    text,
                    startDate,
                    endDate
                  );
                  const totalTradeVolData = await getTotalTradeVol(
                    text,
                    startDate,
                    endDate
                  );
                  const scrData = await getSCR(
                    text,
                    startDate,
                    endDate
                  );
                  const allSCRData = await getAllSCR(
                    text,
                    startDate,
                    endDate
                  );
                  const windows = await getAnomalyWindows(text);

                  // setUpOptions(options(data));
                  // setDownOptions(options(downData));
                  setAnomalyWindows(windows);
                  setIsModalVisible(true);
                  setMergeOptionsInModal(MergeOptions(data, downData));
                  setMergeOptions3InModal(MergeOptions(data3, downData3));
                  setMergeProfitChips3InModal(MergeProfitChips(data3, downData3));
                  setMergeQuantityRelativeRatiosInModal(MergeQuantityRelativeRatios(data3, downData3));
                  setBigOrderPctInModal(MergeBigOrderPct(data3, downData3));
                  setMergeFluidityInModal(MergeFluidity(data3, downData3));
                  setMergeKDJInModal(MergeKDJ(kdjData));
                  setMergeDMIInModal(MergeDMI(dmiData));
                  setContinuousMergeProfitChipsInModal(MergeContinuousProfitChips(profitChipsData, windows));
                  setMergeMAInModal(MergeMA(maData));
                  setMergeDSInModal(MergeDS(dsData));
                  setMergeTotalTradeVolInModal(MergeTotalTradeVol(totalTradeVolData));
                  setMergeSCRInModal(MergeSCR(scrData))
                  setMergeSCRD1InModal(MergeSCRDetails1(scrData))
                  setMergeSCRD2InModal(MergeSCRDetails2(scrData))
                  setMergeAllSCRD1InModal(MergeSCRDetails1(allSCRData))
                  setMergeAllSCRD2InModal(MergeSCRDetails2(allSCRData))
                  setIsLoading(false);
                }}
              >
                Show Charts
              </Button>
            </div>
          </>
        );
      },
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      //defaultSortOrder: 'descend',
      sorter: (a: any, b: any): any => {
        return (
          Number(a.end_date.replaceAll('-', '')) -
          Number(b.end_date.replaceAll('-', ''))
        );
      },
      render: (c, record) => {
        return (
          <>
            <span>{c}</span>
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
      title: 'Profit Chips Str',
      dataIndex: 'profit_chips_str',
      key: 'profit_chips_str',
      //width: '10%',
      render: (c, record) => {
        return (
          <>
            <div>
              <span>
                <b>Max:</b>
              </span>
              <span>
                {c
                  ?.split('|')
                  .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b))}
              </span>
            </div>
            <div>
              <span>
                <b>Min:</b>
              </span>
              <span>
                {c
                  ?.split('|')
                  .reduce((a, b) => (parseFloat(a) < parseFloat(b) ? a : b))}
              </span>
            </div>
            <div>
              <b>T_D:</b> {record?.latest_profit_chips}
            </div>
          </>
        );
      },
    },
    // {
    //   title: 'Latest D-value of Profit Chips',
    //   dataIndex: 'latest_dvalue_profit_chips',
    //   key: 'latest_dvalue_profit_chips',
    //   sorter: (a, b) => a.latest_dvalue_profit_chips - b.latest_dvalue_profit_chips,
    // },    
    // {
    //   title: 'Max Profit - To Date Profit Chip',
    //   dataIndex: 'latest_profit_chips',
    //   key: 'latest_profit_chips',
    //   sorter: (a: any, b: any): any => {
    //     const sorter = (sortBy) =>
    //       (
    //         sortBy?.profit_chips_str
    //           ?.split('|')
    //           .reduce((e, f) => (parseFloat(e) > parseFloat(f) ? e : f)) -
    //         sortBy.latest_profit_chips
    //       ).toFixed(2);
    //     return Number(sorter(a)) - Number(sorter(b));
    //   },
    //   render: (c, record) => {
    //     return (
    //       <>
    //         <div>
    //           <span>
    //             {(
    //               record?.profit_chips_str
    //                 ?.split('|')
    //                 .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)) -
    //               c
    //             ).toFixed(2)}{' '}
    //           </span>
    //         </div>
    //       </>
    //     );
    //   },
    // },
    {
      title: 'Max TurnOverRate',
      dataIndex: 'turnoverrates_str',
      key: 'turnoverrates_str',
      sorter: (a: any, b: any): any => {
        const sorter = (sortBy) =>
          sortBy?.turnoverrates_str
            ?.split('|')
            .reduce((e, f) => (parseFloat(e) > parseFloat(f) ? e : f));
        return Number(sorter(a)) - Number(sorter(b));
      },
      render: (c, record) => {
        const maxRate = c
          ?.split('|')
          .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b));
        const averageRate = (
          c?.split('|')?.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) /
          c?.split('|')?.length
        )?.toFixed(2);
        const minRate = c
          ?.split('|')
          .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? b : a));
        return (
          <>
            <div>
              <span style={{ color: 'red' }}>
                <b>Max:</b> {maxRate}
              </span>
            </div>
            <div>
              <b>Average:</b> {averageRate}
            </div>
            <div>
              <b>Min:</b> {minRate}
            </div>
          </>
        );
      },
    },
    {
      title: '60 Max Min Price',
      dataIndex: 'day60_max_min',
      key: 'day60_max_min',
      sorter: (a: any, b: any): any => {
        const sorter = (sortBy) =>
          sortBy?.turnoverrates_str
            ?.split('|')
            .reduce((e, f) => (parseFloat(e) > parseFloat(f) ? e : f));
        return Number(sorter(a)) - Number(sorter(b));
      },
      render: (c, record) => {
        const maxPrice = parseFloat(c?.split(',')?.[0]);
        const minPrice = parseFloat(c?.split(',')?.[1]);
        const currentPrice = parseFloat(record?.latest_finalprice);
        return (
          <>
            <div>
              <b>Max:</b> {maxPrice}
            </div>
            <div>T_D: {currentPrice}</div>
            <div>
              <b>Min:</b> {minPrice}
            </div>
            <div>
              <span style={{ color: 'red' }}>
                <b>Ma - Mi:</b>{' '}
                {(((maxPrice - minPrice) / minPrice) * 100)?.toFixed(2) + '%'}
              </span>
            </div>
            <div>
              Ma - Td:{' '}
              {(((maxPrice - currentPrice) / currentPrice) * 100)?.toFixed(2) +
                '%'}
            </div>
          </>
        );
      },
    },
    // {
    //   title: 'Profit K',
    //   dataIndex: 'todayProfit',
    //   key: 'todayProfit',
    //   sorter: (a: any, b: any): any => {
    //     const sort = (by) => {
    //       const maxProfit = by?.profit_chips_str
    //         ?.split('|')
    //         .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b));
    //       const maxProfitIndex = by?.profit_chips_str
    //         ?.split('|')
    //         ?.indexOf(maxProfit);
    //       const maxProfitDay = by?.days_str?.split('|')?.[maxProfitIndex];
    //       const maxToOneDay = by?.daysProfit?.filter(
    //         (e) => e?.datestr > maxProfitDay
    //       );
    //       const minProfitMap =
    //         maxToOneDay?.length > 0 &&
    //         maxToOneDay?.reduce((a, b) => (a.profit < b.profit ? a : b));
    //       const minProfit = minProfitMap?.profit;
    //       const minProfitDay = minProfitMap?.datestr;
    //       const days = caculateDaysTwoDate(maxProfitDay, minProfitDay);
    //       return ((maxProfit - minProfit) / days)?.toFixed(2);
    //     };
    //     return Number(sort(a)) - Number(sort(b));
    //   },
    //   render: (c, record) => {
    //     const maxProfit = record?.profit_chips_str
    //       ?.split('|')
    //       .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b));
    //     const maxProfitIndex = record?.profit_chips_str
    //       ?.split('|')
    //       ?.indexOf(maxProfit);
    //     const maxProfitDay = record?.days_str?.split('|')?.[maxProfitIndex];
    //     const maxToOneDay = record?.daysProfit?.filter(
    //       (e) => e?.datestr >= maxProfitDay
    //     );
    //     const minProfitMap =
    //       maxToOneDay?.length > 0 &&
    //       maxToOneDay?.reduce((a, b) => (a.profit < b.profit ? a : b));
    //     const minProfit = minProfitMap?.profit;
    //     const minProfitDay = minProfitMap?.datestr;
    //     const days = caculateDaysTwoDate(maxProfitDay, minProfitDay) || 1;
    //     const K = ((maxProfit - minProfit) / days)?.toFixed(2);

    //     return (
    //       <>
    //         <div>
    //           <div>K: {K}</div>
    //           <div style={{ color: '#c7c1c1' }}>
    //             <p>
    //               MaxProfit:{maxProfit}/{maxProfitDay}
    //             </p>
    //             <p>
    //               MinProFit: {minProfit}/{minProfitDay}
    //             </p>
    //           </div>
    //         </div>
    //       </>
    //     );
    //   },
    // },
    // {
    //   title: 'To Date Final Price',
    //   dataIndex: 'todayPrice',
    //   key: 'todayPrice',
    //   sorter: (a: any, b: any): any => {
    //     const aDiff = (a.todayPrice - a.finalprice) / a.finalprice;
    //     const bDiff = (b.todayPrice - b.finalprice) / b.finalprice;
    //     return Number(aDiff) - Number(bDiff);
    //   },
    //   render: (c, record) => {
    //     const isUp = c - record.finalprice > 0;
    //     const arrow = !isUp ? (
    //       <ArrowDownOutlined style={{ color: 'green' }} />
    //     ) : (
    //       <ArrowUpOutlined style={{ color: 'red' }} />
    //     );
    //     const diff = (c - record.finalprice) / record.finalprice;
    //     return (
    //       <>
    //         <div>
    //           <Tag color={diff > 0 ? 'red' : 'green'}>
    //             {arrow}
    //             {c}/{(diff * 100).toFixed(2) + '%'}
    //           </Tag>
    //         </div>
    //         <div>
    //           <Tag>
    //             {endDate} <br /> {c}
    //           </Tag>
    //         </div>
    //       </>
    //     );
    //   },
    // },
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
    // {
    //   title: 'Big Order Pcts Str',
    //   dataIndex: 'big_order_pcts_str',
    //   key: 'big_order_pcts_str',
    //   //width: '10%',
    //   render: (c, record) => {
    //     return (
    //       <>
    //         <div>
    //           <span>Max:</span>
    //           <span>
    //             {c
    //               ?.split('|')
    //               .reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b))}
    //           </span>
    //         </div>
    //         <div>
    //           <span>Min:</span>
    //           <span>
    //             {c
    //               ?.split('|')
    //               .reduce((a, b) => (parseFloat(a) < parseFloat(b) ? a : b))}
    //           </span>
    //         </div>
    //       </>
    //     );
    //   },
    // },
    // {
    //   title: 'MixMaxTORChange',
    //   dataIndex: 'mix_turnoverrates_changes',
    //   key: 'mix_turnoverrates_changes',
    //   render: (c, record) => {
    //     if (record?.turnoverrates_changes == c) {
    //       return (
    //         <>
    //           <span style={{ color: 'red' }}>
    //             <b>{c?.split(',')?.[0]}</b>
    //           </span>
    //           <br />
    //           <span>{c?.split(',')?.[1]}</span>
    //           <br />
    //           <span>{c?.split(',')?.[2]}</span>
    //         </>
    //       );
    //     } else {
    //       return (
    //         <>
    //           <span>
    //             <b>{c?.split(',')?.[0]}</b>
    //           </span>
    //           <br />
    //           <span>{c?.split(',')?.[1]}</span>
    //           <br />
    //           <span>{c?.split(',')?.[2]}</span>
    //         </>
    //       );
    //     }
    //   },
    // },
    // {
    //   title: 'MaxTORChange',
    //   dataIndex: 'turnoverrates_changes',
    //   key: 'turnoverrates_changes',
    //   render: (c, record) => {
    //     return (
    //       <>
    //         <span style={{ color: 'red' }}>
    //           <b>{c?.split(',')?.[0]}</b>
    //         </span>
    //         <br />
    //         <span>{c?.split(',')?.[1]}</span>
    //         <br />
    //         <span>{c?.split(',')?.[2]}</span>
    //       </>
    //     );
    //   },
    // },
    // {
    //   title: 'MarketValue',
    //   dataIndex: 'marketvalue',
    //   key: 'marketvalue',
    //   render: (c, record) => {
    //     return (
    //       <>
    //         <span>{(c / record.finalprice).toFixed(2)}</span>
    //         <br />
    //         <span>
    //           <b>P_D:</b> {record?.per_dynamic}
    //         </span>
    //         <br />
    //         <span>
    //           <b>P_S:</b> {record?.per_static}
    //         </span>
    //       </>
    //     );
    //   },
    // },
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
      const data = await getAllCriStocks(
        startDate,
        endDate,
        from,
        searchStock,
        isFocused
      );
      const downData = await getAllCriStocks(
        startDate,
        endDate,
        from,
        searchStock,
        isFocused,
        true
      );
      setData(data);
      setDownData(downData);
      setIsLoading(false);
    }
    handleAllStockData();
  }, [startDate, endDate, from, isFocused]);

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
        IsFocused:
        <Checkbox
          checked={isFocused}
          onChange={() => setIsFocused(!isFocused)}
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
        <Space
          style={{
            padding: '10px',
            boxShadow: '1px 1px 3px #ccc',
            marginLeft: '10px',
            // background: `${hasCondition4 ? SELECT_COLOR : '#fff'}`,
          }}
        >
          <span>{'前期涨幅<'}</span>
          <InputNumber
            min={0}
            max={500}
            value={givenPreIncreaseLimitation}
            onChange={setGivenPreIncreaseLimitation}
          />
          %
        </Space>
        <Button
          onClick={() => {
            async function handleAllStockData() {
              setIsLoading(true);
              const data = await getAllCriStocks(
                startDate,
                endDate,
                from,
                searchStock,
                isFocused
              );
              const downData = await getAllCriStocks(
                startDate,
                endDate,
                from,
                searchStock,
                isFocused,
                true
              );
              const kdjData = await getKDJ(
                searchStock,
                startDate,
                endDate
              );
              const dmiData = await getDMI(
                searchStock,
                startDate,
                endDate
              );
              const profitChipsData = await getContinuousProfitChips(
                searchStock,
                startDate,
                endDate
              );
              const maData = await getMA(
                searchStock,
                startDate,
                endDate
              );
              const dsData = await getDS(
                searchStock,
                startDate,
                endDate
              );
              const totalTradeVolData = await getTotalTradeVol(
                searchStock,
                startDate,
                endDate
              );
              const scrData = await getSCR(
                searchStock,
                startDate,
                endDate
              );
              const allSCRData = await getAllSCR(
                searchStock,
                startDate,
                endDate
              );
              const windows = await getAnomalyWindows(searchStock);

              if (searchStock) {
                try {
                  const portrait = await getStockPortrait(searchStock, endDate, startDate);
                  setStockPortrait(portrait);
                  setStockPortraitError('');
                } catch (error: any) {
                  setStockPortrait(null);
                  setStockPortraitError(error?.message || '生成股票画像失败');
                }
              } else {
                setStockPortrait(null);
                setStockPortraitError('');
              }

              if (searchStock) {
                setAnomalyWindows(windows);
                setUpOptions(options(data));
                setDownOptions(options(downData));
                setMergeOptions(MergeOptions(data, downData));
                setMergeProfitChips(MergeProfitChips(data, downData));
                setMergeQuantityRelativeRatiosInModal(MergeQuantityRelativeRatios(data, downData));
                setBigOrderPctInModal(MergeBigOrderPct(data, downData));
                setMergeFluidityInModal(MergeFluidity(data, downData));
                setMergeKDJInModal(MergeKDJ(kdjData));
                setMergeDMIInModal(MergeDMI(dmiData));
                setContinuousMergeProfitChipsInModal(MergeContinuousProfitChips(profitChipsData, windows));
                setMergeMAInModal(MergeMA(maData));
                setMergeDSInModal(MergeDS(dsData));
                setMergeTotalTradeVolInModal(MergeTotalTradeVol(totalTradeVolData));
                setMergeSCRInModal(MergeSCR(scrData));
                setMergeSCRD1InModal(MergeSCRDetails1(scrData))
                setMergeSCRD2InModal(MergeSCRDetails2(scrData))
                setMergeAllSCRD1InModal(MergeSCRDetails1(allSCRData))
                setMergeAllSCRD2InModal(MergeSCRDetails2(allSCRData))
              }
              setData(
                searchStock && searchStock.substr(0, 6) != 'xywang'
                  ? data
                  : data?.filter((s) => {
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
                          s.finalprice < givenPrice &&
                          s.finalprice > givenMinPrice;
                      } else {
                        priceCondition = s.finalprice < givenPrice;
                      }
                      let maxMinLimitCondition = false;
                      if (givenPreIncreaseLimitation) {
                        let maxPrice = parseFloat(
                          s.day60_max_min?.split(',')?.[0]
                        );
                        let minPrice = parseFloat(
                          s.day60_max_min?.split(',')?.[1]
                        );
                        if (
                          +(((maxPrice - minPrice) / minPrice) * 100)?.toFixed(
                            2
                          ) < givenPreIncreaseLimitation
                        ) {
                          maxMinLimitCondition = true;
                        } else {
                          maxMinLimitCondition = false;
                        }
                      } else {
                        maxMinLimitCondition = true;
                      }
                      return (
                        circulationCondition &&
                        priceCondition &&
                        maxMinLimitCondition
                      );
                    })
              );
              setDownData(
                searchStock && searchStock.substr(0, 6) != 'xywang'
                  ? downData
                  : downData?.filter((s) => {
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
                          s.finalprice < givenPrice &&
                          s.finalprice > givenMinPrice;
                      } else {
                        priceCondition = s.finalprice < givenPrice;
                      }
                      let maxMinLimitCondition = false;
                      if (givenPreIncreaseLimitation) {
                        let maxPrice = parseFloat(
                          s.day60_max_min?.split(',')?.[0]
                        );
                        let minPrice = parseFloat(
                          s.day60_max_min?.split(',')?.[1]
                        );
                        if (
                          +(((maxPrice - minPrice) / minPrice) * 100)?.toFixed(
                            2
                          ) < givenPreIncreaseLimitation
                        ) {
                          maxMinLimitCondition = true;
                        } else {
                          maxMinLimitCondition = false;
                        }
                      } else {
                        maxMinLimitCondition = true;
                      }
                      return (
                        circulationCondition &&
                        priceCondition &&
                        maxMinLimitCondition
                      );
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
      {(stockPortrait || stockPortraitError) && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 12,
            padding: 12,
            border: '1px solid #e8e8e8',
            borderRadius: 4,
            background: '#fff',
            fontSize: 15,
          }}
        >
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 16 }}>
            AI画像
            {stockPortrait && (
              <span style={{ marginLeft: 8, color: '#666', fontWeight: 400, fontSize: 15 }}>
                {stockPortrait.symbol} {stockPortrait.name || ''} / 画像日期:
                {stockPortrait.datestr}
                {stockPortrait.model && ` / 模型:${stockPortrait.model}`}
                {stockPortrait.final_price && ` / 价格:${stockPortrait.final_price}`}
                {stockPortrait.circulation_stock &&
                  ` / 流通:${stockPortrait.circulation_stock}亿`}
                {stockPortrait.chip_datestr &&
                  stockPortrait.chip_datestr !== stockPortrait.datestr &&
                  ` / 筹码日期:${stockPortrait.chip_datestr}`}
              </span>
            )}
          </div>
          {stockPortraitError ? (
            <Tag color="orange">{stockPortraitError}</Tag>
          ) : (
            <>
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: '#666', fontWeight: 600, marginRight: 8 }}>报警画像</span>
                {renderPortraitComments(stockPortrait?.comments)}
              </div>
              {stockPortrait?.post_alert_comments && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: '#666', fontWeight: 600, marginRight: 8 }}>后市画像</span>
                  {stockPortrait?.post_alert_portrait?.alarm_datestr && (
                    <span style={{ color: '#888', marginRight: 8 }}>
                      报警日:{stockPortrait.post_alert_portrait.alarm_datestr}
                    </span>
                  )}
                  {stockPortrait?.post_alert_portrait?.observe_datestr && (
                    <span style={{ color: '#888', marginRight: 8 }}>
                      观察日:{stockPortrait.post_alert_portrait.observe_datestr}
                    </span>
                  )}
                  {stockPortrait?.post_alert_decision ? renderPortraitComments(`【${stockPortrait.post_alert_decision}】`) : null}
                  {renderPortraitComments(stockPortrait.post_alert_comments)}
                </div>
              )}
            </>
          )}
        </div>
      )}
      UPDown:
      <img src={img} style={{ width: '200px' }} />
      {!isEmpty(mergeOptions) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeOptions}
        />
      )}
      UPDownProfitChips:
      {!isEmpty(mergeProfitChips) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeProfitChips}
        />
      )}
      SCR:
      {!isEmpty(mergeSCRInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeSCRInModal}
        />
      )}
      SCR Details1:
      {!isEmpty(mergeSCRD1InModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeSCRD1InModal}
        />
      )}
      SCR Details2:
      {!isEmpty(mergeSCRD2InModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeSCRD2InModal}
        />
      )}
      MA:
      {!isEmpty(mergeMAInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeMAInModal}
        />
      )}   
      TotalTradeVol:
      {!isEmpty(mergeTotalTradeVolInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeTotalTradeVolInModal}
        />
      )}  
      ProfitChips:
      {!isEmpty(mergeContinuousProfitChipsInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeContinuousProfitChipsInModal}
        />
      )} 
      All SCR Details1:
      {!isEmpty(mergeAllSCRD1InModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeAllSCRD1InModal}
        />
      )}
      All SCR Details2:
      {!isEmpty(mergeAllSCRD2InModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeAllSCRD2InModal}
        />
      )}
      BigOrderPct:
      {!isEmpty(bigOrderPctInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={bigOrderPctInModal}
        />
      )}  
      Fluidity(流动性):
      {!isEmpty(mergeFluidityInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeFluidityInModal}
        />
      )}   
      QuantityRelativeRatios:
      {!isEmpty(mergeQuantityRelativeRatiosInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeQuantityRelativeRatiosInModal}
        />
      )}  
      KDJ:
      {!isEmpty(mergeKDJInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeKDJInModal}
        />
      )} 
      DMI:
      {!isEmpty(mergeDMIInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeDMIInModal}
        />
      )}
      DS:
      {!isEmpty(mergeDSInModal) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={mergeDSInModal}
        />
      )}
{/*      UPUP:
      {!isEmpty(upOptions) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={upOptions}
        />
      )}
      DownDown:
      {!isEmpty(downOptions) && (
        <ReactEcharts
          style={{ height: 250, width: 1450 }}
          notMerge={true}
          lazyUpdate={true}
          option={downOptions}
        />
      )}*/}
      UPList:
      <Table
        loading={isLoading}
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={data}
        rowKey={getCriticalStockRowKey}
      />
      DownList:
      <Table
        loading={isLoading}
        pagination={{ defaultPageSize: 100 }}
        columns={columns}
        dataSource={downData}
        rowKey={getCriticalStockRowKey}
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
        3 DAYs ProfitChips:
        {!isEmpty(mergeProfitChips3InModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeProfitChips3InModal}
          />
        )}
        SCR:
        {!isEmpty(mergeSCRInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeSCRInModal}
          />
        )}
        SCR Details1:
        {!isEmpty(mergeSCRD1InModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeSCRD1InModal}
          />
        )}
        SCR Details2:
        {!isEmpty(mergeSCRD2InModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeSCRD2InModal}
          />
        )}
        MA:
        {!isEmpty(mergeMAInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeMAInModal}
          />
        )}  
        TotalTradeVol:
        {!isEmpty(mergeTotalTradeVolInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeTotalTradeVolInModal}
          />
        )}  
        ProfitChips:
        {!isEmpty(mergeContinuousProfitChipsInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeContinuousProfitChipsInModal}
          />
        )} 
        All SCR Details1:
        {!isEmpty(mergeAllSCRD1InModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeAllSCRD1InModal}
          />
        )}
        All SCR Details2:
        {!isEmpty(mergeAllSCRD2InModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeAllSCRD2InModal}
          />
        )}
        3 DAYs BigOrderPct:
        {!isEmpty(bigOrderPctInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={bigOrderPctInModal}
          />
        )}  
        Fluidity(流动性):
        {!isEmpty(mergeFluidityInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeFluidityInModal}
          />
        )}  
        3 DAYs QuantityRelativeRatios:
        {!isEmpty(mergeQuantityRelativeRatiosInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeQuantityRelativeRatiosInModal}
          />
        )}   
        KDJ:
        {!isEmpty(mergeKDJInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeKDJInModal}
          />
        )} 
        DMI:
        {!isEmpty(mergeDMIInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeDMIInModal}
          />
        )}
        DS:
        {!isEmpty(mergeDSInModal) && (
          <ReactEcharts
            style={{ height: 250, width: 1450 }}
            notMerge={true}
            lazyUpdate={true}
            option={mergeDSInModal}
          />
        )}  
      </Modal>
    </div>
  );
};
