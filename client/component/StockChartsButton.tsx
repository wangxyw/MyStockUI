import { Button, Modal } from 'antd';
import React, { useRef, useState } from 'react';
import { get, post } from '../lib';
import { includes, isEmpty, orderBy, uniqBy } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';

// ======================= 通用工具函数 =======================
const addMarkAreaToOption = (option, anomalyWindows) => {
  if (!anomalyWindows || anomalyWindows.length === 0 || !option) return option;
  const markAreaData = anomalyWindows.map(window => [
    {
      name: '异常窗口',
      xAxis: window.start_date,
      itemStyle: { color: 'rgba(255, 99, 132, 0.25)', borderColor: '#ff4444', borderWidth: 1, borderType: 'dashed' },
      label: { show: true, position: 'insideTop', formatter: `⚠️ ${window.start_date} ~ ${window.end_date}`, color: '#ff4444', fontWeight: 'bold', fontSize: 10, rotate: 0 },
      tooltip: { show: true, formatter: () => `异常时间窗口<br/>${window.start_date} 至 ${window.end_date}` },
    },
    { xAxis: window.end_date },
  ]);
  const markAreaConfig = { silent: false, label: { show: true }, data: markAreaData, animation: false };
  if (option.series) {
    option.series = option.series.map(series => ({ ...series, markArea: markAreaConfig }));
  }
  return option;
};

const MergeOptions = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');
  const allData = orderBy([...orderedData, ...orderedDownData], 'datestr')?.map(i => i.datestr);
  const maxT = orderedData?.map(i => ({ value: i.turnoverrates_str.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?a:b), datestr: i.datestr, haveLimit: i.have_limit }));
  const minT = orderedData?.map(i => ({ value: i.turnoverrates_str?.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?b:a), datestr: i.datestr, haveLimit: i.have_limit }));
  const maxDownT = orderedDownData?.map(i => ({ value: i.turnoverrates_str.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?a:b), datestr: i.datestr, haveLimit: i.have_limit }));
  const minDownT = orderedDownData?.map(i => ({ value: i.turnoverrates_str?.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?b:a), datestr: i.datestr, haveLimit: i.have_limit }));
  const avgT = orderedData?.map(i => ({ value: i.turnoverrates_str?.split('|')?.reduce((a,b)=>parseFloat(a)+parseFloat(b)) / i.turnoverrates_str?.split('|')?.length, datestr: i.datestr, haveLimit: i.have_limit }));
  const avgDownT = orderedDownData?.map(i => ({ value: i.turnoverrates_str?.split('|')?.reduce((a,b)=>parseFloat(a)+parseFloat(b)) / i.turnoverrates_str?.split('|')?.length, datestr: i.datestr, haveLimit: i.have_limit }));
  const maxTValues = allData?.map(i => maxT?.find(m=>m.datestr===i)?.value ?? '-');
  const maxTValuesMap = allData?.map(i => maxT?.find(m=>m.datestr===i) ? { value: maxT.find(m=>m.datestr===i).value, haveLimit: maxT.find(m=>m.datestr===i).haveLimit } : '-');
  const minTValues = allData?.map(i => minT?.find(m=>m.datestr===i)?.value ?? '-');
  const minTValuesMap = allData?.map(i => minT?.find(m=>m.datestr===i) ? { value: minT.find(m=>m.datestr===i).value, haveLimit: minT.find(m=>m.datestr===i).haveLimit } : '-');
  const maxDownValues = allData?.map(i => maxDownT?.find(m=>m.datestr===i)?.value ?? '-');
  const maxDownValuesMap = allData?.map(i => maxDownT?.find(m=>m.datestr===i) ? { value: maxDownT.find(m=>m.datestr===i).value, haveLimit: maxDownT.find(m=>m.datestr===i).haveLimit } : '-');
  const minDownValues = allData?.map(i => minDownT?.find(m=>m.datestr===i)?.value ?? '-');
  const minDownValuesMap = allData?.map(i => minDownT?.find(m=>m.datestr===i) ? { value: minDownT.find(m=>m.datestr===i).value, haveLimit: minDownT.find(m=>m.datestr===i).haveLimit } : '-');
  const avgValues = allData?.map(i => avgT?.find(m=>m.datestr===i)?.value ?? '-');
  const avgValuesMap = allData?.map(i => avgT?.find(m=>m.datestr===i) ? { value: avgT.find(m=>m.datestr===i).value, haveLimit: avgT.find(m=>m.datestr===i).haveLimit } : '-');
  const avgDownValues = allData?.map(i => avgDownT?.find(m=>m.datestr===i)?.value ?? '-');
  const avgDownValuesMap = allData?.map(i => avgDownT?.find(m=>m.datestr===i) ? { value: avgDownT.find(m=>m.datestr===i).value, haveLimit: avgDownT.find(m=>m.datestr===i).haveLimit } : '-');
  return {
    title: { text: '', left: 0 },
    legend: { data: ['MaxOverRate','MinOverRate','DownMaxOverRate','DownMinOverRate','AVGOverRate','AVGDownOverRate'], selected: { 'MaxOverRate':false, 'MinOverRate':false, 'DownMaxOverRate':false, 'DownMinOverRate':false, 'AVGOverRate':true, 'AVGDownOverRate':true } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allData, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'MaxOverRate', type: 'line', data: maxTValues, symbol: (v,params)=> { if(maxTValuesMap[params.dataIndex]?.haveLimit=='1') return 'arrow'; if(maxTValuesMap[params.dataIndex]?.haveLimit=='-1') return 'circle'; if(maxTValuesMap[params.dataIndex]?.haveLimit=='2') return 'pin'; return 'diamond'; }, symbolSize: 10, itemStyle: { normal: { color: '#FF0000' } }, label: { position: 'top' } },
      { name: 'MinOverRate', type: 'line', symbolSize: 10, symbol: (v,params)=> { if(minTValuesMap[params.dataIndex]?.haveLimit=='1') return 'arrow'; if(minTValuesMap[params.dataIndex]?.haveLimit=='-1') return 'circle'; if(minTValuesMap[params.dataIndex]?.haveLimit=='2') return 'pin'; return 'diamond'; }, itemStyle: { normal: { color: '#FFC0CB' } }, data: minTValues },
      { name: 'DownMaxOverRate', type: 'line', symbol: (v,params)=> { if(maxDownValuesMap[params.dataIndex]?.haveLimit=='1') return 'arrow'; if(maxDownValuesMap[params.dataIndex]?.haveLimit=='-1') return 'circle'; if(maxDownValuesMap[params.dataIndex]?.haveLimit=='2') return 'pin'; return 'diamond'; }, symbolSize: 10, data: maxDownValues, itemStyle: { normal: { color: '#00FF00' } } },
      { name: 'DownMinOverRate', type: 'line', symbol: (v,params)=> { if(minDownValuesMap[params.dataIndex]?.haveLimit=='1') return 'arrow'; if(minDownValuesMap[params.dataIndex]?.haveLimit=='-1') return 'circle'; if(minDownValuesMap[params.dataIndex]?.haveLimit=='2') return 'pin'; return 'diamond'; }, symbolSize: 10, data: minDownValues, itemStyle: { normal: { color: '#7CFC00' } } },
      { name: 'AVGOverRate', type: 'line', symbol: (v,params)=> { if(avgValuesMap[params.dataIndex]?.haveLimit=='1') return 'arrow'; if(avgValuesMap[params.dataIndex]?.haveLimit=='-1') return 'circle'; if(avgValuesMap[params.dataIndex]?.haveLimit=='2') return 'pin'; return 'diamond'; }, symbolSize: 10, data: avgValues, itemStyle: { normal: { color: '#FFFF00' } } },
      { name: 'AVGDownOverRate', type: 'line', symbol: (v,params)=> { if(avgDownValuesMap[params.dataIndex]?.haveLimit=='1') return 'arrow'; if(avgValuesMap[params.dataIndex]?.haveLimit=='-1') return 'circle'; if(avgValuesMap[params.dataIndex]?.haveLimit=='2') return 'pin'; return 'diamond'; }, symbolSize: 10, data: avgDownValues, itemStyle: { normal: { color: '#A020F0' } } },
    ],
  };
};

const MergeQuantityRelativeRatios = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');
  const allData = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr');
  const allDataDate = allData?.map(i => i.datestr);
  const quantityRelativeRatios = allData?.map(i => i?.quantity_relative_ratio);
  return {
    title: { text: '', left: 0 },
    legend: { data: ['QuantityRelativeRatios'] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [ { name: 'QuantityRelativeRatios', type: 'line', data: quantityRelativeRatios, label: { position: 'top' } } ],
  };
};

const MergeBigOrderPct = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const allUpDataDate = orderedData.map(i => i.datestr);
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');
  const allDownDataDate = orderedDownData.map(i => i.datestr);
  const allData = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr');
  const allDataDate = allData?.map(i => i.datestr);
  const maxBigOrderPct = allData?.map(i => ({ value: i.big_order_pcts_str.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?a:b), datestr: i.datestr }));
  const minBigOrderPct = allData?.map(i => ({ value: i.big_order_pcts_str.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?a:b), datestr: i.datestr }));
  const avgBigOrderPct = allData?.map(i => ({ value: i.big_order_pcts_str?.split('|')?.reduce((a,b)=>parseFloat(a)+parseFloat(b)) / i.big_order_pcts_str?.split('|')?.length, datestr: i.datestr }));
  const avgUpBigOrderPct = allData?.map(i => ({ value: includes(allUpDataDate, i.datestr) ? i.big_order_pcts_str?.split('|')?.reduce((a,b)=>parseFloat(a)+parseFloat(b)) / i.big_order_pcts_str?.split('|')?.length : null, datestr: i.datestr }));
  const avgDownBigOrderPct = allData?.map(i => ({ value: includes(allDownDataDate, i.datestr) ? i.big_order_pcts_str?.split('|')?.reduce((a,b)=>parseFloat(a)+parseFloat(b)) / i.big_order_pcts_str?.split('|')?.length : null, datestr: i.datestr }));
  const sourcesMap = allData?.map(i => i?.source);
  const statusMap = allData?.map(i => i?.status);
  return {
    title: { text: '', left: 0 },
    legend: { data: ['MaxBigOrderPct','MinBigOrderPct','AvgBigOrderPct','AvgUpBigOrderPct','AvgDownBigOrderPct'], selected: { 'MaxBigOrderPct':false, 'MinBigOrderPct':false, 'AvgBigOrderPct':true, 'AvgUpBigOrderPct':true, 'AvgDownBigOrderPct':true } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 }, onclick: (e) => console.log(e) },
    yAxis: { type: 'value' },
    series: [
      { name: 'MaxBigOrderPct', type: 'line', data: maxBigOrderPct },
      { name: 'MinBigOrderPct', type: 'line', data: minBigOrderPct },
      { name: 'AvgBigOrderPct', type: 'line', data: avgBigOrderPct },
      { name: 'AvgUpBigOrderPct', type: 'scatter', color: 'red', data: avgUpBigOrderPct, label: { show: true, position: 'top', fontSize: 14, fontWeight: 'bold', formatter: function(d) { let sourceLabel = (sourcesMap[d.dataIndex]=='400s'||sourcesMap[d.dataIndex]=='dr_400s')?'4s':((sourcesMap[d.dataIndex]=='100w'||sourcesMap[d.dataIndex]=='dr_100w')?'1w':(sourcesMap[d.dataIndex]=='dr_100s'?'1s':'nil')); return statusMap[d.dataIndex]=='up' ? `{up|${sourceLabel}}` : `{down|${sourceLabel}}`; }, rich: { up: { color: 'red' }, down: { color: 'green' } } } },
      { name: 'AvgDownBigOrderPct', type: 'scatter', color: 'green', data: avgDownBigOrderPct, label: { show: true, position: 'top', fontSize: 14, fontWeight: 'bold', formatter: function(d) { let sourceLabel = (sourcesMap[d.dataIndex]=='400s'||sourcesMap[d.dataIndex]=='dr_400s')?'4s':((sourcesMap[d.dataIndex]=='100w'||sourcesMap[d.dataIndex]=='dr_100w')?'1w':(sourcesMap[d.dataIndex]=='dr_100s'?'1s':'nil')); return statusMap[d.dataIndex]=='up' ? `{up|${sourceLabel}}` : `{down|${sourceLabel}}`; }, rich: { up: { color: 'red' }, down: { color: 'green' } } } },
    ],
  };
};

const MergeProfitChips = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');
  const allData = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr');
  const allDataDate = allData?.map(i => i.datestr);
  const maxProfitChips = allData?.map(i => i.profit_chips_str.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?a:b));
  const minProfitChips = allData?.map(i => i.profit_chips_str?.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?b:a));
  const dProfitChips = allData?.map(i => i.profit_chips_str.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?a:b) - i.profit_chips_str?.split('|').reduce((a,b)=>parseFloat(a)>parseFloat(b)?b:a));
  const sourcesMap = allData?.map(i => i?.source);
  const statusMap = allData?.map(i => i?.status);
  const continueDays = allData?.map(i => i?.days + "days");
  return {
    title: { text: '', left: 0 },
    legend: { data: ['MaxProfitChips','MinProfitChips','DProfitChips'] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 }, onclick: (e) => console.log(e) },
    yAxis: { type: 'value' },
    series: [
      { name: 'MaxProfitChips', type: 'line', data: maxProfitChips, label: { show: true, position: 'top', fontSize: 12, formatter: function(d) { let sourceLabel = (sourcesMap[d.dataIndex]=='400s'||sourcesMap[d.dataIndex]=='dr_400s')?'4s':((sourcesMap[d.dataIndex]=='100w'||sourcesMap[d.dataIndex]=='dr_100w')?'1w':(sourcesMap[d.dataIndex]=='dr_100s'?'1s':'nil')); return statusMap[d.dataIndex]=='up' ? `{up|${sourceLabel}}` : `{down|${sourceLabel}}`; }, rich: { up: { color: 'red' }, down: { color: 'green' } } } },
      { name: 'MinProfitChips', type: 'line', data: minProfitChips },
      { name: 'DProfitChips', type: 'line', data: dProfitChips },
      { name: 'ContinueDays', type: 'line', data: continueDays },
    ],
  };
};

const MergeFluidity = (data, downData) => {
  const orderedData = orderBy(uniqBy(data, 'datestr'), 'datestr');
  const orderedDownData = orderBy(uniqBy(downData, 'datestr'), 'datestr');
  const allData = orderBy(uniqBy([...orderedData, ...orderedDownData], 'datestr'), 'datestr');
  const allDataDate = allData?.map(i => i.datestr);
  const fluidity = allData?.map(i => i.totaltradevol / (i.marketvalue / i.finalprice * 1000000));
  return {
    title: { text: '', left: 0 },
    legend: { data: ['Fluidity'] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [ { name: 'Fluidity', type: 'line', data: fluidity, label: { position: 'top' } } ],
  };
};

const MergeKDJ = (kdjData) => {
  const orderedData = orderBy(kdjData, 'datestr');
  const allDataDate = orderedData?.map(i => i.datestr);
  const k = orderedData?.map(i => i?.k);
  const d = orderedData?.map(i => i?.d);
  const j = orderedData?.map(i => i?.j);
  return {
    title: { text: '', left: 0 },
    legend: { data: ['k','d','j'] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'k', type: 'line', data: k, label: { position: 'top' } },
      { name: 'd', type: 'line', data: d, label: { position: 'top' } },
      { name: 'j', type: 'line', data: j, label: { position: 'top' } },
    ],
  };
};

const MergeDMI = (dmiData) => {
  const orderedData = orderBy(dmiData, 'datestr');
  const allDataDate = orderedData?.map(i => i.datestr);
  const pdi = orderedData?.map(i => i?.pdi);
  const mdi = orderedData?.map(i => i?.mdi);
  const adx = orderedData?.map(i => i?.adx);
  return {
    title: { text: '', left: 0 },
    legend: { data: ['pdi','mdi','adx'] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'pdi', type: 'line', data: pdi, label: { position: 'top' }, itemStyle: { normal: { color: '#FF0000' } } },
      { name: 'mdi', type: 'line', data: mdi, label: { position: 'top' }, itemStyle: { normal: { color: '#00FF00' } } },
      { name: 'adx', type: 'line', data: adx, label: { position: 'top' }, itemStyle: { normal: { color: '#800080' } } },
    ],
  };
};

const MergeContinuousProfitChips = (profitChipsData, anomalyWindows = []) => {
  const orderedData = orderBy(profitChipsData, 'datestr');
  const allDataDate = orderedData?.map(i => i.datestr);
  const pc = orderedData?.map(i => i?.profit_chip);
  const tr = orderedData?.map(i => (i?.turnoverrate < 0 || i?.turnoverrate > 100) ? 0 : i?.turnoverrate);
  const option = {
    title: { text: '', left: 0 },
    legend: { data: ['profit_chip','turnoverrate'] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: false, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'profit_chip', type: 'line', data: pc, label: { position: 'top' } },
      { name: 'turnoverrate', type: 'line', data: tr, label: { position: 'top' }, itemStyle: { color: '#ff0000' } },
    ],
  };
  return addMarkAreaToOption(option, anomalyWindows);
};

const MergeMA = (maData) => {
  const orderedData = orderBy(maData, 'datestr');
  const allDataDate = orderedData?.map(i => i.datestr);
  const ma5 = orderedData?.map(i => i?.ma5);
  const ma10 = orderedData?.map(i => i?.ma10);
  const ma20 = orderedData?.map(i => i?.ma20);
  const ma60 = orderedData?.map(i => i?.ma60);
  return {
    title: { text: '', left: 0 },
    legend: { data: ['ma5','ma10','ma20','ma60'], selected: { 'ma5':true, 'ma10':false, 'ma20':false, 'ma60':true } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'ma5', type: 'line', data: ma5, label: { position: 'top' }, itemStyle: { normal: { color: '#800080' } } },
      { name: 'ma10', type: 'line', data: ma10, label: { position: 'top' }, itemStyle: { normal: { color: '#FFFF00' } } },
      { name: 'ma20', type: 'line', data: ma20, label: { position: 'top' }, itemStyle: { normal: { color: '#0000FF' } } },
      { name: 'ma60', type: 'line', data: ma60, label: { position: 'top' }, itemStyle: { normal: { color: '#ff0000' } } },
    ],
  };
};

const MergeDS = (dsData) => {
  const orderedData = orderBy(dsData, 'datestr');
  const allDataDate = orderedData?.map(i => i.datestr);
  const perDynamic = orderedData?.map(i => i?.per_dynamic);
  const perStatic = orderedData?.map(i => i?.per_static);
  const differences = orderedData?.map(i => Math.abs((i?.per_dynamic||0) - (i?.per_static||0)));
  return {
    title: { text: '', left: 0 },
    legend: { data: ['dynamic','static','difference'], selected: { 'dynamic':true, 'static':true, 'difference':true } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [
      { name: 'dynamic', type: 'line', data: perDynamic, label: { position: 'top' }, itemStyle: { normal: { color: '#800080' } } },
      { name: 'static', type: 'line', data: perStatic, label: { position: 'top' }, itemStyle: { normal: { color: '#ff0000' } } },
      { name: 'difference', type: 'line', data: differences, label: { position: 'top' }, itemStyle: { normal: { color: '#000000' } } },
    ],
  };
};

const MergeTotalTradeVol = (totaltradevolData) => {
  const orderedData = orderBy(totaltradevolData, 'datestr');
  const allDataDate = orderedData?.map(i => i.datestr);
  const totaltradevol = orderedData?.map(i => i?.totaltradevol);
  return {
    title: { text: '', left: 0 },
    legend: { data: ['totaltradevol'] },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar','stack','tiled'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value' },
    series: [ { name: 'totaltradevol', type: 'bar', data: totaltradevol, label: { position: 'top', show: false }, itemStyle: { color: '#800080' }, barWidth: '60%' } ],
  };
};

const MergeSCR = (scrData) => {
  const orderedData = orderBy(scrData, 'datestr').map(item => ({ ...item, datestr: moment(item.datestr).format('YYYY-MM-DD') }));
  const allDataDate = orderedData.map(i => i.datestr);
  const profitChip = orderedData.map(i => i.profit_chip ?? i.tencent_profit_chip);
  return {
    title: { text: '腾讯筹码分布趋势', left: 'center' },
    legend: { data: ['获利盘比例(%)'], left: 'left', selected: { '获利盘比例(%)': true, '90%成本集中度(%)': true, '90%成本区间下沿': false, '90%成本区间上沿': false } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    toolbox: { show: true, orient: 'vertical', left: 'right', top: 'center', feature: { mark: { show: true }, magicType: { show: true, type: ['line','bar'] }, restore: { show: true }, saveAsImage: { show: true } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { show: true, interval: 0, rotate: 45 } },
    yAxis: { type: 'value', name: '数值 (%)' },
    series: [ { name: '获利盘比例(%)', type: 'line', data: profitChip, smooth: true, lineStyle: { color: '#5470c6', width: 2 }, symbol: 'circle', symbolSize: 6, label: { show: true, position: 'top', formatter: '{c}' } } ],
  };
};

const MergeSCRDetails1 = (scrData) => {
  const orderedData = orderBy(scrData, 'datestr').map(item => ({ ...item, datestr: moment(item.datestr).format('YYYY-MM-DD') }));
  const allDataDate = orderedData.map(i => i.datestr);
  const priceRangeLow90 = orderedData.map(i => { const parts = i.tencent_price_range_90?.split(','); return parts ? parseFloat(parts[0]) : null; });
  const priceRangeHigh90 = orderedData.map(i => { const parts = i.tencent_price_range_90?.split(','); return parts ? parseFloat(parts[1]) : null; });
  const priceRangeLow70 = orderedData.map(i => { const parts = i.tencent_price_range_70?.split(','); return parts ? parseFloat(parts[0]) : null; });
  const priceRangeHigh70 = orderedData.map(i => { const parts = i.tencent_price_range_70?.split(','); return parts ? parseFloat(parts[1]) : null; });
  const rangeWidth90 = priceRangeHigh90.map((high,idx) => high && priceRangeLow90[idx] ? high - priceRangeLow90[idx] : null);
  const rangeWidth70 = priceRangeHigh70.map((high,idx) => high && priceRangeLow70[idx] ? high - priceRangeLow70[idx] : null);
  return {
    title: { text: '筹码成本分布区间', left: 'center' },
    legend: { data: ['90%成本区间','70%成本区间'], left: 'left' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function(params) {
      let res = params[0].axisValue + '<br/>';
      params.forEach(p => {
        if(p.seriesName === '90%成本区间') {
          const low = priceRangeLow90[p.dataIndex], high = priceRangeHigh90[p.dataIndex], width = rangeWidth90[p.dataIndex];
          res += `${p.marker} 90%成本区间: ${low?.toFixed(2)} ~ ${high?.toFixed(2)} 元 (宽度 ${width?.toFixed(2)} 元)<br/>`;
        } else if(p.seriesName === '70%成本区间') {
          const low = priceRangeLow70[p.dataIndex], high = priceRangeHigh70[p.dataIndex], width = rangeWidth70[p.dataIndex];
          res += `${p.marker} 70%成本区间: ${low?.toFixed(2)} ~ ${high?.toFixed(2)} 元 (宽度 ${width?.toFixed(2)} 元)<br/>`;
        }
      });
      return res;
    } },
    toolbox: { show: true, feature: { saveAsImage: { show: true }, magicType: { show: true, type: ['line','bar'] } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { rotate: 45, interval: 10, fontSize: 10 } },
    yAxis: { type: 'value', name: '价格 (元)' },
    series: [
      { name: '90%成本区间', type: 'line', data: priceRangeHigh90, lineStyle: { color: '#ee6666', width: 2, type: 'solid' }, symbol: 'circle', symbolSize: 6, areaStyle: { color: 'rgba(238,102,102,0.1)', origin: 'start' }, connectNulls: false, step: false, label: { show: false } },
      { name: '90%成本区间', type: 'line', data: priceRangeLow90, lineStyle: { color: '#ee6666', width: 2, type: 'solid' }, symbol: 'circle', symbolSize: 6, connectNulls: false, step: false, label: { show: false }, tooltip: { show: false } },
      { name: '70%成本区间', type: 'line', data: priceRangeHigh70, lineStyle: { color: '#3ba272', width: 2, type: 'solid' }, symbol: 'diamond', symbolSize: 6, areaStyle: { color: 'rgba(59,162,114,0.1)', origin: 'start' }, connectNulls: false, label: { show: false } },
      { name: '70%成本区间', type: 'line', data: priceRangeLow70, lineStyle: { color: '#3ba272', width: 2, type: 'solid' }, symbol: 'diamond', symbolSize: 6, connectNulls: false, tooltip: { show: false } },
    ],
  };
};

const MergeSCRDetails2 = (scrData) => {
  const orderedData = orderBy(scrData, 'datestr').map(item => ({ ...item, datestr: moment(item.datestr).format('YYYY-MM-DD') }));
  const allDataDate = orderedData.map(i => i.datestr);
  const concentration90 = orderedData.map(i => i.tencent_concentration_90);
  const concentration70 = orderedData.map(i => i.tencent_concentration_70);
  return {
    title: { text: '筹码成本集中度趋势', left: 'center' },
    legend: { data: ['90%成本集中度(%)','70%成本集中度(%)'], left: 'left' },
    tooltip: { trigger: 'axis' },
    toolbox: { show: true, feature: { saveAsImage: { show: true }, magicType: { show: true, type: ['line','bar'] } } },
    xAxis: { type: 'category', data: allDataDate, axisLabel: { rotate: 45, interval: 10, fontSize: 10 } },
    yAxis: { type: 'value', name: '集中度 (%)', min: 0 },
    series: [
      { name: '90%成本集中度(%)', type: 'line', data: concentration90, smooth: true, lineStyle: { color: '#fac858', width: 3, type: 'solid' }, symbol: 'circle', symbolSize: 8, label: { show: true, position: 'top', formatter: '{c}', fontSize: 10, offset: [0,-5] }, areaStyle: { opacity: 0.1, color: '#fac858' } },
      { name: '70%成本集中度(%)', type: 'line', data: concentration70, smooth: true, lineStyle: { color: '#73c0de', width: 3, type: 'solid' }, symbol: 'diamond', symbolSize: 8, label: { show: true, position: 'bottom', formatter: '{c}', fontSize: 10, offset: [0,5] }, areaStyle: { opacity: 0.1, color: '#73c0de' } },
    ],
  };
};

// ======================= API 调用函数 =======================
async function getAllFocusedStocks2(page = 1, pageSize = 50, sortByDate = false, dateSortOrder: 'ASC' | 'DESC' = 'DESC') {
  let url = `/api/all_focus_stock2?page=${page}&pageSize=${pageSize}`;
  if (sortByDate) {
    url += `&sortByDate=true&dateSortOrder=${dateSortOrder}`;
  }
  const response = await get(url);
  return response; // { data, total }
}

async function getAllCriStocks(startDate, endDate, from, stock, isFocused, isDown = false) {
  return await get(`/api/critical_data?start_date=${startDate}&end_date=${endDate}&from=${from}&stock=${stock}&isFocused=${isFocused}&isDown=${isDown}`);
}
async function getAllCriStocks3(startDate, endDate, from, stock, isFocused, isDown = false) {
  return await get(`/api/critical_data3?start_date=${startDate}&end_date=${endDate}&from=${from}&stock=${stock}&isFocused=${isFocused}&isDown=${isDown}`);
}
async function getKDJ(stock, startDate, endDate) {
  return await get(`/api/kdj?stock=${stock}&start_date=${startDate}&end_date=${endDate}`);
}
async function getDMI(stock, startDate, endDate) {
  return await get(`/api/dmi?stock=${stock}&start_date=${startDate}&end_date=${endDate}`);
}
async function getContinuousProfitChips(stock, startDate, endDate) {
  return await get(`/api/profit_chips?stock=${stock}&start_date=${startDate}&end_date=${endDate}`);
}
async function getMA(stock, startDate, endDate) {
  return await get(`/api/ma?stock=${stock}&start_date=${startDate}&end_date=${endDate}`);
}
async function getDS(stock, startDate, endDate) {
  return await get(`/api/ds?stock=${stock}&start_date=${startDate}&end_date=${endDate}`);
}
async function getTotalTradeVol(stock, startDate, endDate) {
  return await get(`/api/totaltradevol?stock=${stock}&start_date=${startDate}&end_date=${endDate}`);
}
async function getSCR(stock, startDate, endDate) {
  return await get(`/api/stock_chip_result?stock=${stock}&start_date=${startDate}&end_date=${endDate}`);
}
async function getAllSCR(stock, startDate, endDate) {
  return await get(`/api/all_stock_chip_result?stock=${stock}&start_date=${startDate}&end_date=${endDate}`);
}
async function getAnomalyWindows(stock) {
  try {
    const response = await get(`/api/stock_anomaly_windows?stock=${stock}`);
    if (response && Array.isArray(response) && response.length > 0) {
      const firstItem = response[0];
      if (firstItem && firstItem.anomaly_window) {
        return JSON.parse(firstItem.anomaly_window) || [];
      }
    }
    if (response && Array.isArray(response) && response.length > 0 && response[0].start_date) return response;
    return [];
  } catch (error) {
    console.error('获取异常窗口失败:', error);
    return [];
  }
}


export const StockChartsButton: React.FC<{
  symbol: string;
  name?: string;
  datestr: string;
  size?: 'small' | 'middle' | 'large';
}> = ({ symbol, name, datestr, size }) => {
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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [curAnaMap, setAnaMap] = useState<any>();
  const mainChartRef = useRef<any>();

  const curDateObj = new Date();
  const endDate = moment(`${curDateObj.getFullYear()}-${curDateObj.getMonth() + 1}-${curDateObj.getDate()}`).format('YYYY-MM-DD');
  const startDate = moment(`${curDateObj.getFullYear() - 2}-${curDateObj.getMonth() + 1}-${curDateObj.getDate()}`).format('YYYY-MM-DD');
  const curText = `${symbol}${name ? ` - ${name}` : ''}`;

  const showCharts = async () => {
    setIsLoading(true);
    try {
      const data = await getAllCriStocks(datestr, datestr, false, symbol, false);
      const downData = await getAllCriStocks(datestr, datestr, false, symbol, false, true);
      const data3 = await getAllCriStocks3(startDate, endDate, false, symbol, false);
      const downData3 = await getAllCriStocks3(startDate, endDate, false, symbol, false, true);
      const kdjData = await getKDJ(symbol, startDate, endDate);
      const dmiData = await getDMI(symbol, startDate, endDate);
      const profitChipsData = await getContinuousProfitChips(symbol, startDate, endDate);
      const maData = await getMA(symbol, startDate, endDate);
      const dsData = await getDS(symbol, startDate, endDate);
      const totalTradeVolData = await getTotalTradeVol(symbol, startDate, endDate);
      const scrData = await getSCR(symbol, startDate, endDate);
      const allSCRData = await getAllSCR(symbol, startDate, endDate);
      const windows = await getAnomalyWindows(symbol);
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
      setMergeSCRInModal(MergeSCR(scrData));
      setMergeSCRD1InModal(MergeSCRDetails1(scrData));
      setMergeSCRD2InModal(MergeSCRDetails2(scrData));
      setMergeAllSCRD1InModal(MergeSCRDetails1(allSCRData));
      setMergeAllSCRD2InModal(MergeSCRDetails2(allSCRData));
      setAnaMap(undefined);
      setIsModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button size={size} loading={isLoading} onClick={showCharts}>Show Charts</Button>
      <Modal title={`Charts: ${curText}`} visible={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={[<Button onClick={() => setIsModalVisible(false)} type="primary">OK</Button>]} width={1500}>
        5 DAYs:
        {!isEmpty(mergeOptionsInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeOptionsInModal} />}
        3 DAYs {!isEmpty(mergeOptions3InModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeOptions3InModal} />}
        3 DAYs ProfitChips: {!isEmpty(mergeProfitChips3InModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeProfitChips3InModal} ref={mainChartRef} onEvents={{ click: async (info) => { const res = await post(`/api/get_price_from_common_data`, { body: JSON.stringify({ stocks: [`'${symbol}'`], today: info.name }) }); setAnaMap(JSON.parse(res?.[0].turnoverrates_analysis ?? '')); } }} />}
        SCR: {!isEmpty(mergeSCRInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeSCRInModal} />}
        SCR Details1: {!isEmpty(mergeSCRD1InModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeSCRD1InModal} />}
        SCR Details2: {!isEmpty(mergeSCRD2InModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeSCRD2InModal} />}
        MA: {!isEmpty(mergeMAInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeMAInModal} />}
        TotalTradeVol: {!isEmpty(mergeTotalTradeVolInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeTotalTradeVolInModal} />}
        ProfitChips: {!isEmpty(mergeContinuousProfitChipsInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeContinuousProfitChipsInModal} />}
        All SCR Details1: {!isEmpty(mergeAllSCRD1InModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeAllSCRD1InModal} />}
        All SCR Details2: {!isEmpty(mergeAllSCRD2InModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeAllSCRD2InModal} />}
        3 DAYs BigOrderPct: {!isEmpty(bigOrderPctInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={bigOrderPctInModal} />}
        Fluidity(流动性): {!isEmpty(mergeFluidityInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeFluidityInModal} />}
        3 DAYs QuantityRelativeRatios: {!isEmpty(mergeQuantityRelativeRatiosInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeQuantityRelativeRatiosInModal} />}
        KDJ: {!isEmpty(mergeKDJInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeKDJInModal} />}
        DMI: {!isEmpty(mergeDMIInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeDMIInModal} />}
        DS: {!isEmpty(mergeDSInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeDSInModal} />}
        {!isEmpty(curAnaMap) && <div className="table"><div className="col"><p>Before</p>{Object.keys(curAnaMap?.before).map(i=>(i==='7-days'||i==='15-days')?<p key={i}>{curAnaMap.before[i]?.replaceAll(',',',  ')}({i})</p>:<p key={i}><b>{curAnaMap.before[i]?.replaceAll(',',',  ')}</b>({i})</p>)}</div><div className="col"><p>After</p>{Object.keys(curAnaMap?.after).map(i=><p key={i}>{curAnaMap.after[i]?.replaceAll(',',',  ')}({i})</p>)}</div></div>}
      </Modal>
    </>
  );
};
