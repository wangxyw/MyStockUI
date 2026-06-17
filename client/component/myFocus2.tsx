import {
  Table,
  Form,
  Input,
  Popconfirm,
  Tag,
  Dropdown,
  Menu,
  Button,
  Modal,
} from 'antd';
import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import { FormInstance } from 'antd/lib/form';
import { get, post } from '../lib';
import img from './mark.jpg';
import { uniqBy, isEmpty, orderBy, includes } from 'lodash';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';
import { caculateAfterDate, caculateDate, today } from './alarm';

export const focusStatusMap = {
  '1': { name: '下跌中-1', color: 'blue' },
  '2': { name: '未到买点-2', color: 'yellow' },
  '3': { name: '已到买点-3', color: 'green' },
  '4': { name: '买点已过-4', color: 'grey' },
};

const strongMainCommentTags = [
  '筹码热度回落动能',
  '高集中低盈扩散',
  '高集中趋势型',
  '宽筹码动能型',
  '低中集中反转型',
  '强信号弹性:高换手高弹',
  '强信号弹性:回撤后放量修复',
  '强信号弹性:普通',
];

const watchMainCommentTags = [
  '优选带观察',
  '核心集中区',
  '低位紧凑-需确认',
  '普通筹码区',
  '核心承接型',
  '备选:核心承接待确认',
  '观察组合',
  '强信号弹性:核心承接低弹',
];

const highRiskCommentTags = [
  '高换手低盈利承接弱',
  '低盈利未修复+观察高分',
  '低盈利+中等筹码带回撤',
  '低盈利+收盘承接弱',
  '近高位低盈利背离',
  '趋势空头+均换不足+筹码无修复',
  '低位低换弹性不足',
];

const mediumRiskCommentTags = [
  '低分+盈利无修复+短均走弱',
  '低换滞涨',
  '技术风险叠加',
  '均线全空弱势',
  '低流动弱趋势',
  '低位无承接空头',
];

const getRiskTagLevel = (tagText: string) => {
  if (!tagText.includes('风险')) return null;
  if (highRiskCommentTags.some((tag) => tagText.includes(tag))) return '高';
  if (mediumRiskCommentTags.some((tag) => tagText.includes(tag))) return '中';
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

const getPostAlertTagColor = (tagText: string) => {
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

const getCommentTagColor = (tag: string) => {
  if (tag.includes('后市')) return getPostAlertTagColor(tag);
  if (/^首次(D4D7|D60|D30|放弃|降权):/.test(tag)) return getPostAlertTagColor(tag);
  if (tag.includes('序列确认:')) return 'red';
  if (tag.includes('序列警戒:')) return 'gold';
  if (tag.includes('低分修复:')) return 'geekblue';
  if (tag.includes('备选:')) return 'blue';
  if (tag.includes('短线观察:')) return 'orange';
  if (tag.includes('短线:')) return 'volcano';
  if (tag.includes('警戒:')) return 'gold';
  if (tag.includes('风险:')) return 'green';
  if (tag === '强信号') return 'red';
  if (tag === '观察') return 'blue';
  if (strongMainCommentTags.some(i => tag.includes(i))) return 'red';
  if (watchMainCommentTags.some(i => tag.includes(i))) return 'blue';
  return undefined;
};

const formatCommentTagText = (tagText: string) => {
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
  if (tagText.includes('序列确认:')) return `序确｜${tagText}`;
  if (tagText.includes('序列警戒:')) return `序警｜${tagText}`;
  if (tagText.includes('低分修复:')) return `修｜${tagText}`;
  if (tagText.includes('备选:')) return `候｜${tagText}`;
  if (tagText.includes('短线观察:')) return `短观｜${tagText}`;
  if (tagText.includes('短线:')) return `短｜${tagText}`;
  if (tagText.includes('警戒:')) return `警｜${tagText}`;
  const color = getCommentTagColor(tagText);
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

const renderCommentTag = (
  tagText: string,
  key: string,
  options: { color?: string; fontWeight?: number; fontSize?: number } = {}
) => {
  const displayText = formatCommentTagText(tagText);
  return (
    <Tag
      key={key}
      color={options.color || getCommentTagColor(tagText)}
      title={tagText}
      style={{
        marginBottom: 4,
        fontWeight: options.fontWeight,
        fontSize: options.fontSize,
        lineHeight: options.fontSize ? '22px' : undefined,
      }}
    >
      {displayText}
    </Tag>
  );
};

const renderComments = (comments?: string) => {
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
    /^(C|T|P|D|R|E|M|DMI|MA|PA):/.test(tag)
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
    <div style={{ lineHeight: 1.6 }}>
      {(bestPickTag || scoreTag || statusTag) && (
        <div>
        {bestPickTag &&
          renderCommentTag(bestPickTag, 'best-pick', {
            color: getBestPickTagColor(bestPickTag),
            fontWeight: 700,
          })}
        {scoreTag && (
          <span
            style={{
              color: '#222',
              fontWeight: 700,
              fontSize: 15,
              marginRight: 6,
            }}
          >
            {scoreTag}
          </span>
        )}
        {statusTag && renderCommentTag(statusTag, 'status', { fontWeight: 600 })}
        </div>
      )}
      {riskTags.length > 0 && (
        <div>{sortedRiskTags.map((tag, index) => renderCommentTag(tag, `risk-${index}`))}</div>
      )}
      {signalTags.length > 0 && (
        <div>
          {signalTags.map((tag, index) =>
            renderCommentTag(tag, `signal-${index}`)
          )}
        </div>
      )}
      {factorTags.length > 0 && (
        <div style={{ color: '#666', fontSize: 14, lineHeight: 1.7 }}>
          {factorTags.map((tag) => tag.replace(':', ' ')).join(' · ')}
        </div>
      )}
    </div>
  );
};

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
  const profitChip = orderedData.map(i => i.tencent_profit_chip);
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

// ======================= 价格计算辅助函数 =======================
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

export const caculatePriceData = (
  stockData,
  stockPriceByDay,
  timeWindow: any = 120,
  simulateDate: any = today
) => {
  const yesterday = caculateDate(simulateDate ?? today, 1);
  const priceData = stockData.map((i) => {
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

// ======================= 可编辑表格组件 =======================
const EditableContext = React.createContext<FormInstance<any> | null>(null);
const EditableRow: React.FC<{ index: number }> = ({ index, ...props }) => {
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
  dataIndex: string;
  record: any;
  handleSave: (record: any) => void;
}
const EditableCell: React.FC<EditableCellProps> = ({ title, editable, children, dataIndex, record, handleSave, ...restProps }) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<Input>(null);
  const form = useContext(EditableContext)!;
  useEffect(() => { if (editing) inputRef.current!.focus(); }, [editing]);
  const toggleEdit = () => { setEditing(!editing); form.setFieldsValue({ [dataIndex]: record[dataIndex] }); };
  const save = async () => { try { const values = await form.validateFields(); toggleEdit(); handleSave({ ...record, ...values }); } catch (errInfo) { console.log('Save failed:', errInfo); } };
  let childNode = children;
  if (editable) {
    childNode = editing ? (
      <Form.Item style={{ margin: 0 }} name={dataIndex} rules={[{ required: true, message: `${title} is required.` }]}>
        <Input ref={inputRef} onPressEnter={save} onBlur={save} />
      </Form.Item>
    ) : (
      <div className="editable-cell-value-wrap" style={{ paddingRight: 24 }} onClick={toggleEdit}>
        {children}
      </div>
    );
  }
  return <td {...restProps}>{childNode}</td>;
};

// ======================= 批量行业信息获取 =======================
async function fetchBatchIndustry(symbols: string[]): Promise<Map<string, string>> {
  if (!symbols.length) return new Map();
  try {
    const stocksParam = symbols.map(s => `'${s}'`).join(',');
    const response = await post(`/api/boards_of_stock?stocks=${stocksParam}`, {});
    const industryMap = new Map<string, string>();
    (response as any[]).forEach(item => {
      if ((item.business_type === 'sw1_hy' || item.business_type === 'swhy') && item.symbol) {
        if (!industryMap.has(item.symbol)) industryMap.set(item.symbol, item.name);
      }
    });
    return industryMap;
  } catch (error) {
    console.error('批量获取行业信息失败', error);
    return new Map();
  }
}

const IndustryContext = React.createContext<{ industryMap: Map<string, string> }>({ industryMap: new Map() });
const StockIndustry: React.FC<{ symbol: string }> = ({ symbol }) => {
  const { industryMap } = useContext(IndustryContext);
  const industry = industryMap.get(symbol);
  return <span>{industry || '--'}</span>;
};

// ======================= 主组件 =======================
export const MyFocus2ListComponent = () => {
  const [data, setData] = useState([]);
  const [rateByCur, setRateByCur] = useState<string>();
  const [rateByMax, setRateByMax] = useState<string>();

  // 分页和排序
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const pageSize = 100;
  const [sortByDate, setSortByDate] = useState(true);
  const [dateSortOrder, setDateSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // 行业信息
  const [industryMap, setIndustryMap] = useState<Map<string, string>>(new Map());

  // 图表相关状态
  const [mergeOptionsInModal, setMergeOptionsInModal] = useState({});
  const [mergeOptions3InModal, setMergeOptions3InModal] = useState({});
  const [mergeProfitChips3InModal, setMergeProfitChips3InModal] = useState({});
  const [mergeQuantityRelativeRatiosInModal, setMergeQuantityRelativeRatiosInModal] = useState({});
  const [bigOrderPctInModal, setBigOrderPctInModal] = useState({});
  const [mergeFluidityInModal, setMergeFluidityInModal] = useState({});
  const [mergeKDJInModal, setMergeKDJInModal] = useState({});
  const [mergeDMIInModal, setMergeDMIInModal] = useState({});
  const [mergeContinuousProfitChipsInModal, setContinuousMergeProfitChipsInModal] = useState({});
  const [curText, setCurText] = useState('');
  const [curSymbol, setCurSymbol] = useState('');
  const [mergeMAInModal, setMergeMAInModal] = useState({});
  const [mergeDSInModal, setMergeDSInModal] = useState({});
  const [mergeTotalTradeVolInModal, setMergeTotalTradeVolInModal] = useState({});
  const [mergeSCRInModal, setMergeSCRInModal] = useState({});
  const [mergeSCRD1InModal, setMergeSCRD1InModal] = useState({});
  const [mergeSCRD2InModal, setMergeSCRD2InModal] = useState({});
  const [mergeAllSCRD1InModal, setMergeAllSCRD1InModal] = useState({});
  const [mergeAllSCRD2InModal, setMergeAllSCRD2InModal] = useState({});
  const [anomalyWindows, setAnomalyWindows] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectStatus, setSelectStatus] = useState<any>(null);
  const [curAnaMap, setAnaMap] = useState();

  const curDateObj = new Date();
  const year = curDateObj.getFullYear();
  const lastYear = curDateObj.getFullYear() - 2;
  const month = curDateObj.getMonth() + 1;
  const day = curDateObj.getDate();
  const endDate = moment(`${year}-${month}-${day}`).format('YYYY-MM-DD');
  const startDate = moment(`${lastYear}-${month}-${day}`).format('YYYY-MM-DD');
  const mainChartRef = useRef<any>();

  // 数据获取（含价格计算补充）
  const handleAllStockData = useCallback(async (page = 1, sortDate?: boolean, order?: 'ASC' | 'DESC') => {
    setTableLoading(true);
    try {
      const shouldSortByDate = sortDate !== undefined ? sortDate : sortByDate;
      const currentOrder = order !== undefined ? order : dateSortOrder;
      let response = await getAllFocusedStocks2(page, pageSize, shouldSortByDate, currentOrder);
      let stockData = response.data || [];
      let totalRecords = response.total || 0;

      // 前端兜底排序
      if (shouldSortByDate && stockData.length) {
        stockData = [...stockData].sort((a, b) => {
          const dateA = new Date(a.datestr).getTime();
          const dateB = new Date(b.datestr).getTime();
          return currentOrder === 'ASC' ? dateA - dateB : dateB - dateA;
        });
      }

      // 补充价格计算（如果后端未返回 maxPriceDiff 等字段）
      if (stockData.length > 0 && stockData[0].maxPriceDiff === undefined) {
        const symbols = stockData.map(d => d.symbol);
        const stockPriceByDay = await post(`/api/get_price_from_common_data`, {
          body: JSON.stringify({ stocks: symbols.map(i => `'${i}'`).join(',') }),
        });
        const calculatedData = caculatePriceData(stockData, stockPriceByDay, '不限');
        // 合并 recentTen（因为 caculatePriceData 不会保留 recentTen）
        const dataWithRecentTen = calculatedData.map((item, index) => ({
          ...item,
          recentTen: stockData[index]?.recentTen || []
        }));
        stockData = dataWithRecentTen;
      }

      // 计算准确率
      const rateByCurVal = stockData.filter(i =>
        (i.currentPrice >= i.finalprice && i.predict === 'Up') ||
        (i.currentPrice < i.finalprice && i.predict === 'Down')
      ).length;
      const rateByMaxVal = stockData.filter(i =>
        (i.maxPriceDiff > 0 && i.predict === 'Up') ||
        (i.maxPriceDiff === 0 && i.predict === 'Down')
      ).length;
      setRateByCur(`${rateByCurVal}/${stockData.length}`);
      setRateByMax(`${rateByMaxVal}/${stockData.length}`);

      // 状态过滤
      const filteredData = selectStatus
        ? stockData.filter(i => i.focus_status === (selectStatus === '0' ? null : selectStatus))
        : stockData;
      setData(filteredData);
      setTotal(totalRecords);

      // 批量获取行业信息
      const symbols = stockData.map((item: any) => item.symbol);
      if (symbols.length) {
        const map = await fetchBatchIndustry(symbols);
        setIndustryMap(prev => new Map([...prev, ...map]));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setTableLoading(false);
    }
  }, [selectStatus, sortByDate, dateSortOrder, pageSize]);

  const handleDateSort = useCallback((order: 'ascend' | 'descend' | null) => {
    setCurrentPage(1);
    if (order === null) {
      setSortByDate(false);
      handleAllStockData(1, false, 'DESC');
    } else {
      const newOrder = order === 'ascend' ? 'ASC' : 'DESC';
      setSortByDate(true);
      setDateSortOrder(newOrder);
      handleAllStockData(1, true, newOrder);
    }
  }, [handleAllStockData]);

  const handleSave = useCallback(async (row: any) => {
    await post('/api/edit_focus2', { body: JSON.stringify({ symbol: row.symbol, comments: row.comments }) });
    handleAllStockData(currentPage);
  }, [currentPage, handleAllStockData]);

  const handleDelete = useCallback(async (symbol: string, datestr: string) => {
    await post('/api/delete_focus2', { body: JSON.stringify({ symbol, datestr }) });
    handleAllStockData(currentPage);
  }, [currentPage, handleAllStockData]);

  const onClickMenu = useCallback((item: any, symbol: string, datestr: string) => {
    post('/api/edit_focus2_status', { body: JSON.stringify({ symbol, status: item.key, datestr }) }).then(() => {
      if (item.key === '3') {
        post('/api/edit_focus2_datestr', { body: JSON.stringify({ symbol, status: item.key, datestr, newDatestr: caculateDate(today, 0) }) }).then((i) => {
          if (i.code) alert(i.sqlMessage);
          handleAllStockData(currentPage);
        });
      } else {
        handleAllStockData(currentPage);
      }
    });
  }, [currentPage, handleAllStockData]);

  useEffect(() => { handleAllStockData(1); }, []);

  const columns = useMemo(() => [
    {
      title: 'Symbol', dataIndex: 'symbol', key: 'symbol',
      render: (text: string, record: any) => {
        const predict = record?.predict;
        return (
          <div>
            <a target="_blank" href={`https://quote.eastmoney.com/${text}.html`}>
              {text}{caculateAfterDate(record.datestr, 60) < caculateDate(today, 0) && '*'}
            </a>
            <br />
            <Tag><a target="_blank" href={`http://${location.host}/alarm?symbol=${text}&datestr=${record.datestr}`}>Show alarm</a></Tag>
            <br />
            <Button onClick={async () => {
              const data = await getAllCriStocks(record.datestr, record.datestr, false, text, false);
              const downData = await getAllCriStocks(record.datestr, record.datestr, false, text, false, true);
              const data3 = await getAllCriStocks3(startDate, endDate, false, text, false);
              const downData3 = await getAllCriStocks3(startDate, endDate, false, text, false, true);
              const kdjData = await getKDJ(text, startDate, endDate);
              const dmiData = await getDMI(text, startDate, endDate);
              const profitChipsData = await getContinuousProfitChips(text, startDate, endDate);
              const maData = await getMA(text, startDate, endDate);
              const dsData = await getDS(text, startDate, endDate);
              const totalTradeVolData = await getTotalTradeVol(text, startDate, endDate);
              const scrData = await getSCR(text, startDate, endDate);
              const allSCRData = await getAllSCR(text, startDate, endDate);
              const windows = await getAnomalyWindows(text);
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
              setMergeSCRInModal(MergeSCR(scrData));
              setMergeSCRD1InModal(MergeSCRDetails1(scrData));
              setMergeSCRD2InModal(MergeSCRDetails2(scrData));
              setMergeAllSCRD1InModal(MergeSCRDetails1(allSCRData));
              setMergeAllSCRD2InModal(MergeSCRDetails2(allSCRData));
              setCurText(`${text} - ${record?.name}`);
              setCurSymbol(record?.symbol);
            }}>Show Charts</Button>
            <br />
            <span style={{ color: 'red' }}>{predict === 'Up' ? 'UP' : ''}</span>
          </div>
        );
      },
    },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 100, render: (text, record) => <span>{text}{caculateAfterDate(record.datestr,60)<caculateDate(today,0)&&'*'}</span> },
    // { title: 'PCA', dataIndex: 'profit_chip_analyze', key: 'profit_chip_analyze', render: (text) => { if (!text) return <div>--</div>; try {const val = JSON.parse(text); if (!val || typeof val !== 'object') return <div>--</div>; return (<div>{Object.keys(val).map(i => (<p key={i}>{i}: {val[i]}</p>))}</div>);} catch (e) {return <div>无效数据</div>;}}},    
    { title: 'Continuance BYG', dataIndex: 'continuance_BYG', key: 'continuance_BYG', render: (c) => { const num = c.split('|')[0]?.match(/-?\d+(\.\d+)?/); if(!num) return false; const isUp=parseFloat(num[0])>0; return <span style={{color:isUp?'red':'green'}}>{c}</span>; } },
    { title: 'Comments', dataIndex: 'comments', key: 'comments', width: 1000, editable: false, render: renderComments },
    {
      title: '后市画像',
      dataIndex: 'post_alert_comments',
      key: 'post_alert_comments',
      width: 620,
      editable: false,
      render: (text, record) => (
        <div>
          {record?.post_alert_decision ? renderComments(`【${record.post_alert_decision}】`) : null}
          {renderComments(text)}
        </div>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'datestr',
      key: 'datestr',
      width: 120,
      sorter: true,
      sortOrder: sortByDate ? (dateSortOrder === 'ASC' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: () => {
          if (!sortByDate || dateSortOrder === 'DESC') {
            handleDateSort('ascend');
          } else if (dateSortOrder === 'ASC') {
            handleDateSort('descend');
          } else {
            handleDateSort(null);
          }
        },
      }),
    },
    { title: 'last_updated_at', dataIndex: 'last_updated_at', key: 'last_updated_at', render: (c) => <p>{c?.split('T')?.[0]}</p> },
    {
      title: 'Recent 10 days',
      dataIndex: 'recentTen',
      key: 'recentTen',
      render: (c) => {
        if (!Array.isArray(c)) return null;
        const upA1 = c.filter(i => i.status === 'up' && i.alarmtype === 'A1').length;
        const upA2 = c.filter(i => i.status === 'up' && i.alarmtype === 'A2').length;
        const upA3 = c.filter(i => i.status === 'up' && i.alarmtype === 'A3').length;
        const upNA = c.filter(i => i.status === 'up' && (!i.alarmtype || i.alarmtype === '')).length;
        const downA1 = c.filter(i => i.status === 'down' && i.alarmtype === 'A1').length;
        const downA2 = c.filter(i => i.status === 'down' && i.alarmtype === 'A2').length;
        const downA3 = c.filter(i => i.status === 'down' && i.alarmtype === 'A3').length;
        const downNA = c.filter(i => i.status === 'down' && (!i.alarmtype || i.alarmtype === '')).length;
        return (
          <table border={1}>
            <thead>
              <tr>
                <th>A1</th>
                <th>A2</th>
                <th>A3</th>
                <th>NA</th>
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
        );
      },
    },
    { title: '流通股本', dataIndex: 'circulation_stock', key: 'circulation_stock', render: (_, record) => <>{ (record.marketvalue / record.finalprice).toFixed(3) }</> },
    { title: 'Industry', dataIndex: 'symbol', key: 'industry', render: (symbol:string) => <StockIndustry symbol={symbol} /> },
    { title: 'MaxPrice', dataIndex: 'maxPrice', key: 'maxPrice', render: (c, record) => <Tag color={Number(record.maxPriceDiff)>0?'red':'green'}>{c}/ {record.maxPriceDiff}%</Tag> },
    { title: 'MaxPriceDay', dataIndex: 'maxPriceDay', key: 'maxPriceDay' },
    { title: 'MinPrice', dataIndex: 'minPrice', key: 'minPrice', render: (c, record) => <Tag color={Number(record.minPriceDiff)>0?'red':'green'}>{c}/ {record.minPriceDiff}%</Tag> },
    { title: 'MinPriceDay', dataIndex: 'minPriceDay', key: 'minPriceDay' },
    // { title: 'Action', key: 'action', render: (_, record) => <Popconfirm title="Sure to delete?" onConfirm={()=>handleDelete(record.symbol, record.datestr)}><a>Delete</a></Popconfirm> },
  ], [sortByDate, dateSortOrder, handleDateSort, handleDelete]);

  const mergedColumns = useMemo(() => columns.map(col => col.editable ? { ...col, onCell: (record) => ({ record, editable: col.editable, dataIndex: col.dataIndex, title: col.title, handleSave }) } : col), [columns, handleSave]);
  const components = useMemo(() => ({ body: { row: EditableRow, cell: EditableCell } }), []);

  return (
    <IndustryContext.Provider value={{ industryMap }}>
      <div style={{ padding: '20px' }}>
        Filter By Status:
        <Dropdown overlay={<Menu onClick={(ob)=>{ setSelectStatus(ob.key); setCurrentPage(1); handleAllStockData(1); }}>{Object.keys(focusStatusMap).map(i=><Menu.Item key={i}>{focusStatusMap[i]?.name}</Menu.Item>).concat(<Menu.Item key="0">未标注</Menu.Item>)}</Menu>}>
          <Tag color={focusStatusMap[selectStatus]?.color}>{selectStatus==='0'?'未标注':focusStatusMap[selectStatus]?.name||'All'}</Tag>
        </Dropdown>
        <Table
          loading={tableLoading}
          pagination={{ current: currentPage, total: total, pageSize: pageSize, onChange: (page)=>{ setCurrentPage(page); handleAllStockData(page); }, showSizeChanger: false, showQuickJumper: true, showTotal: (total)=>`共 ${total} 条记录` }}
          columns={mergedColumns}
          dataSource={data}
          components={components}
          rowKey={(record: any) => `${record.symbol}-${record.datestr}`}
        />
        <Modal title={`Charts: ${curText}`} visible={isModalVisible} onCancel={()=>setIsModalVisible(false)} footer={[<Button onClick={()=>setIsModalVisible(false)} type="primary">OK</Button>]} width={1500}>
          5 DAYs: <img src={img} style={{ width: '200px' }} />
          {!isEmpty(mergeOptionsInModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeOptionsInModal} />}
          3 DAYs {!isEmpty(mergeOptions3InModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeOptions3InModal} />}
          3 DAYs ProfitChips: {!isEmpty(mergeProfitChips3InModal) && <ReactEcharts style={{ height: 250, width: 1450 }} notMerge lazyUpdate option={mergeProfitChips3InModal} ref={mainChartRef} onEvents={{ click: async (info) => { const res = await post(`/api/get_price_from_common_data`, { body: JSON.stringify({ stocks: [`'${curSymbol}'`], today: info.name }) }); setAnaMap(JSON.parse(res?.[0].turnoverrates_analysis ?? '')); } }} />}
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
      </div>
    </IndustryContext.Provider>
  );
};
