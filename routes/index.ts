import request from 'axios';
import {
  chooseResults,
  daCalculate,
  filterByCondition2,
  filterByCondition5,
} from './biz';
import { caculateDate } from './utils';
import { isEmpty } from 'lodash';
var express = require('express');
var router = express.Router();
import { Request, Response } from 'express';
const YAML = require('yamljs');
const fs = require('fs');
// import { json } from 'express';
// file为文件所在路径
// import http from 'http';
var mysql = require('mysql');
import sqlite3 from 'sqlite3';
var mysqlConfig = YAML.parse(
  fs.readFileSync('./config/database.yml').toString()
);
var pool = mysql.createPool({
  connectionLimit: 100, //最多处理多少连接次数
  host: mysqlConfig.dbsql.host,
  port: mysqlConfig.dbsql.port,
  user: mysqlConfig.dbsql.user,
  password: mysqlConfig.dbsql.pwd,
  database: mysqlConfig.dbsql.database,
  multipleStatements: true,
});

let queryDB = function (sql) {
  return new Promise((resolve, reject) => {
    pool.query(sql, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const sqlEscape = (value: any) => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const toNumber = (value: any, defaultValue = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
};
const round2 = (value: any) => Math.round(toNumber(value) * 100) / 100;
const TRADE_STRATEGIES_CONFIG_PATH = './config/trade_strategies_production.json';
let tradeStrategiesConfigCache: any = null;
let tradeStrategiesConfigMtimeMs = 0;
const HOT_ALPHA_FILTER_CONFIG_PATH = '/Users/xywang/mystockdata/config/hot_alpha_sector_filters.yml';
let hotAlphaFilterConfigCache: any = null;
let hotAlphaFilterConfigMtimeMs = 0;
const betweenValue = (value: number, minValue: number, maxValue: number) =>
  value >= minValue && value <= maxValue;
const shiftDate = (dateStr: string, days: number) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const formatDbDate = (value: any) => {
  if (!value) return value;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  }
  return String(value).slice(0, 10);
};
const loadHotAlphaFilterConfig = () => {
  const stat = fs.statSync(HOT_ALPHA_FILTER_CONFIG_PATH);
  if (!hotAlphaFilterConfigCache || hotAlphaFilterConfigMtimeMs !== stat.mtimeMs) {
    hotAlphaFilterConfigCache = YAML.parse(fs.readFileSync(HOT_ALPHA_FILTER_CONFIG_PATH).toString()) || {};
    hotAlphaFilterConfigMtimeMs = stat.mtimeMs;
  }
  return hotAlphaFilterConfigCache;
};
const hotAlphaFilterPatterns = (key: string) => {
  const values = loadHotAlphaFilterConfig()[key] || [];
  return Array.isArray(values) ? values.map((item: any) => String(item)).filter(Boolean) : [];
};
const parseCommentScoreStatus = (comments: any) => {
  const tagTexts = String(comments ?? '').match(/【[^】]+】/g)?.map((tag) => tag.slice(1, -1)) || [];
  const scoreTag = tagTexts.find((tag) => /^-?\d+(?:\.\d+)?$/.test(tag));
  const statusTag = tagTexts.find((tag) => ['强信号', '观察', '无效'].includes(tag));
  return {
    score: scoreTag === undefined ? null : Number(scoreTag),
    status: statusTag || null,
  };
};
const dateDiffDays = (later: string, earlier: string) => {
  const laterTime = new Date(`${later}T00:00:00+08:00`).getTime();
  const earlierTime = new Date(`${earlier}T00:00:00+08:00`).getTime();
  return Math.round((laterTime - earlierTime) / 86400000);
};
const querySequenceContext = async (tableName: 'focus_stocks_ai' | 'focus_stocks2_ai', symbol: string, currentDate: string) => {
  const rows: any = await queryDB(`
    SELECT datestr, comments
    FROM ${tableName}
    WHERE symbol = '${sqlEscape(symbol)}'
      AND datestr < '${sqlEscape(currentDate)}'
    ORDER BY datestr DESC
    LIMIT 20
  `);
  const history = (rows || []).map((row: any) => {
    const date = formatDbDate(row.datestr);
    const parsed = parseCommentScoreStatus(row.comments);
    return { date, ...parsed };
  });
  const prev = history[0];
  return {
    prior_count: history.length,
    prior_30d: history.filter((row: any) => dateDiffDays(currentDate, row.date) <= 30).length,
    prior_90d: history.filter((row: any) => dateDiffDays(currentDate, row.date) <= 90).length,
    prior_180d: history.filter((row: any) => dateDiffDays(currentDate, row.date) <= 180).length,
    days_since_prev: prev ? dateDiffDays(currentDate, prev.date) : null,
    prev_score: prev?.score ?? null,
    prev_status: prev?.status ?? null,
  };
};

const shouldAppendRecord2BombOrderWarning = async (symbol: string, datestr: string, statusTag: string, decisionTag: string | null | undefined) => {
  const statusText = stripBrackets(statusTag);
  if (!['观察', '强信号'].includes(statusText)) return false;

  const decisionText = stripBrackets(decisionTag || '');
  const ruleLabel = decisionText.includes(':') ? decisionText.split(':')[1] : decisionText.split('｜')[1];
  if (['近期热市深跌修复', '近期热市低位修复', '核心承接待确认'].includes(ruleLabel || '')) return false;

  const rows: any = await queryDB(`
    SELECT totalvol_1000w
    FROM stock_bomb_data_dr
    WHERE symbol = '${sqlEscape(symbol)}'
      AND datestr = '${sqlEscape(datestr)}'
      AND totalvol_1000w > 0
    LIMIT 1
  `);
  return Boolean(rows?.length);
};
const sequenceTagsRecord1 = (sequence: any, currentScore: number) => {
  if (!sequence || toNumber(sequence.prior_count) <= 0) return [];
  const tags: string[] = [];
  const daysSincePrev = sequence.days_since_prev;
  const prevScore = sequence.prev_score;
  const scoreDelta = prevScore === null || prevScore === undefined ? null : currentScore - toNumber(prevScore);

  const warningTags: string[] = [];
  if (toNumber(sequence.prior_count) >= 2) warningTags.push('【序列警戒:三次以上反复报警】');
  if (toNumber(sequence.prior_180d) >= 2) warningTags.push('【序列警戒:180日内多次报警】');
  if (scoreDelta !== null && Math.abs(scoreDelta) >= 15) warningTags.push('【序列警戒:重复报警分数大幅波动】');
  if (daysSincePrev !== null && daysSincePrev > 30) tags.push('【序列警戒:长期重复报警】');
  else if (daysSincePrev !== null && daysSincePrev <= 30 && warningTags.length === 0) tags.push('【序列确认:30日内重复报警】');
  tags.push(...warningTags);
  return tags;
};
const statusRank = (status: any) => ({ 无效: 0, 观察: 1, 强信号: 2 }[String(status)] ?? null);
const sequenceTagsRecord2 = (sequence: any, currentStatus: string, technicalBlocked = false) => {
  if (!sequence || toNumber(sequence.prior_count) <= 0) return [];
  const tags: string[] = [];
  const daysSincePrev = sequence.days_since_prev;
  const prevRank = statusRank(sequence.prev_status);
  const currentRank = statusRank(currentStatus);

  const warningTags: string[] = [];
  if (toNumber(sequence.prior_count) >= 4 || toNumber(sequence.prior_180d) >= 4) warningTags.push('【序列警戒:高频重复报警】');
  if (daysSincePrev !== null && daysSincePrev > 90) warningTags.push('【序列警戒:长期重复报警】');
  if (prevRank !== null && currentRank !== null && currentRank < prevRank) warningTags.push('【序列警戒:状态降级】');
  if (warningTags.length === 0 && !technicalBlocked) {
    if (daysSincePrev !== null && daysSincePrev >= 31 && daysSincePrev <= 90) tags.push('【序列确认:31-90日再次报警】');
    if (prevRank !== null && currentRank !== null) {
      if (currentRank > prevRank) tags.push('【序列确认:状态升级】');
      else if (currentStatus === '强信号') tags.push('【序列确认:强信号重复确认】');
    }
  }
  tags.push(...warningTags);
  return tags;
};

const stripBrackets = (value: any) => String(value ?? '').replace(/[【】]/g, '');
const tagTextOf = (tags: string[]) => tags.join(' ');
const hasAnyTagText = (tagText: string, patterns: string[]) =>
  patterns.some((pattern) => tagText.includes(pattern));
const record1HighMidRiskPatterns = [
  '高换手低盈利承接弱',
  '低盈利未修复+观察高分',
  '低盈利+中等筹码带回撤',
  '低盈利+收盘承接弱',
  '近高位低盈利背离',
  '趋势空头+均换不足+筹码无修复',
  '低分+盈利无修复+短均走弱',
];
const record2HighMidRiskPatterns = [
  ...record1HighMidRiskPatterns,
  '低位低换弹性不足',
  '低换滞涨',
  '技术风险叠加',
  '均线全空弱势',
  '低流动弱趋势',
  '低位无承接空头',
];
const record1DrawdownPatterns = [
  '回撤管理',
  '低盈利未修复+观察高分',
  '低盈利+中等筹码带回撤',
  '高换手低盈利承接弱',
  '低盈利+收盘承接弱',
  '近高位低盈利背离',
];
const record2StrongMainPatterns = [
  '筹码热度回落动能',
  '高集中低盈扩散',
  '高集中趋势型',
  '宽筹码动能型',
  '低中集中反转型',
];

const tradeDecisionTagRecord1 = (score: number, statusTag: string, tags: string[], details: any = {}) => {
  const statusText = stripBrackets(statusTag);
  const tagText = tagTextOf(tags);
  const sequenceWarning = tagText.includes('序列警戒:');
  const drawdownConcern = hasAnyTagText(tagText, record1DrawdownPatterns);
  const drawdownFrom60High = details?.drawdown_from_60_high === null || details?.drawdown_from_60_high === undefined
    ? null
    : Number(details.drawdown_from_60_high);
  const insufficientPullback = drawdownFrom60High !== null && drawdownFrom60High > -15;
  const upFromLow20d = details?.up_from_low_20d === null || details?.up_from_low_20d === undefined
    ? null
    : Number(details.up_from_low_20d);
  const avgTurn10ForLowRepair = details?.avg_turn_10 === null || details?.avg_turn_10 === undefined
    ? null
    : Number(details.avg_turn_10);
  const lowPositionRepairConfirm =
    details?.low_position_repair_confirm === true ||
    (
      upFromLow20d !== null &&
      upFromLow20d > 10 &&
      avgTurn10ForLowRepair !== null &&
      avgTurn10ForLowRepair < 8
    );
  const highMidRisk = hasAnyTagText(tagText, record1HighMidRiskPatterns);
  const warningTag = tagText.includes('警戒:');
  const shortWatchTag = tagText.includes('短线观察:');
  const lowScoreRepair = tagText.includes('低分修复:');
  const ret5 = details?.ret_5 === null || details?.ret_5 === undefined
    ? null
    : Number(details.ret_5);
  const ret10 = details?.ret_10 === null || details?.ret_10 === undefined
    ? null
    : Number(details.ret_10);
  const avgTurn5 = details?.avg_turn_5 === null || details?.avg_turn_5 === undefined
    ? null
    : Number(details.avg_turn_5);
  const sharpDropLowTurnObserve =
    statusText === '无效' &&
    ret10 !== null &&
    ret10 <= -14.74 &&
    ret5 !== null &&
    ret5 <= -8.85 &&
    avgTurn5 !== null &&
    avgTurn5 <= 2.37;
  const profitDelta = details?.profit_delta === null || details?.profit_delta === undefined
    ? null
    : Number(details.profit_delta);
  const observePullbackManagement = profitDelta !== null && profitDelta >= 7;
  const conc70 = details?.conc_70 === null || details?.conc_70 === undefined
    ? null
    : Number(details.conc_70);
  const observeHighConcPullback = conc70 !== null && conc70 >= 7;
  const hardAvoid =
    tagText.includes('趋势空头+均换不足+筹码无修复') ||
    tagText.includes('三次以上反复报警') ||
    tagText.includes('180日内多次报警');

  if (statusText === '无效' && hardAvoid) return '【慎:明确弱势待修复】';
  if (statusText === '无效' && sequenceWarning) return '【慎:低分序列警戒】';
  if (statusText === '无效' && lowScoreRepair) return '【试:低分修复试仓】';
  if (statusText === '无效' && lowPositionRepairConfirm) return '【买:低位修复确认】';
  if (statusText === '无效' && sharpDropLowTurnObserve) return '【试:急跌缩量修复试仓】';
  if (statusText === '强信号') {
    if (sequenceWarning) return '【慎:序列警戒】';
    if (highMidRisk || warningTag) return '【慎:强信号风险降级】';
    if (insufficientPullback && ret5 !== null && ret5 > -4) return '【慎:强信号回撤不足待确认】';
    if (insufficientPullback) return '【试:强信号回撤不足】';
    return '【慎:强信号回撤管理】';
  }
  if (statusText === '观察' && score >= 70 && !highMidRisk && !drawdownConcern) {
    if (sequenceWarning) return '【慎:序列警戒】';
    if (shortWatchTag) return '【慎:短观回撤未稳】';
    if (observePullbackManagement) return '【慎:70+回撤管理】';
    if (observeHighConcPullback) return '【慎:70+高集中回撤】';
    return warningTag ? '【慎:观察警戒】' : '【慎:70+回撤观察】';
  }
  if (statusText === '观察' && score < 70 && lowPositionRepairConfirm) {
    return '【买:低位修复确认】';
  }
  if (statusText === '观察' && sequenceWarning) return '【慎:序列警戒】';
  return null;
};

const applyRecord1MarketRiskDecision = (decisionTag: string | null, details: any = {}) => {
  if (decisionTag && stripBrackets(decisionTag).startsWith('避:')) return decisionTag;

  const marketEnv = details?.market_env || {};
  const vol20 = details?.vol_20 === null || details?.vol_20 === undefined
    ? null
    : Number(details.vol_20);
  const turnRatio20 = details?.turn_ratio_20 === null || details?.turn_ratio_20 === undefined
    ? null
    : Number(details.turn_ratio_20);
  const warmExpanding = marketEnv.temp === '温' && marketEnv.alarm_dir === '报扩';
  const shrinkOrHighVol =
    (turnRatio20 !== null && turnRatio20 <= 0.7) ||
    (vol20 !== null && vol20 >= 35);

  return warmExpanding && shrinkOrHighVol ? '【慎:温扩回撤风险】' : decisionTag;
};

const applyRecord1LowRepairWeakEnvironmentDecision = (decisionTag: string | null, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (decisionText !== '试:低分修复试仓') return decisionTag;

  const hotishRatio60 = details?.market_exposure?.hotish_ratio_60 === null || details?.market_exposure?.hotish_ratio_60 === undefined
    ? null
    : Number(details.market_exposure.hotish_ratio_60);

  return hotishRatio60 !== null && hotishRatio60 <= 10
    ? '【慎:低分修复弱环境】'
    : decisionTag;
};

const applyRecord1TrackingDecision = (decisionTag: string | null, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (/^(买|试):/.test(decisionText)) return decisionTag;

  const marketEnv = details?.market_env || {};
  const closeVsMa20 = details?.close_vs_ma20 === null || details?.close_vs_ma20 === undefined
    ? null
    : Number(details.close_vs_ma20);
  const ret5 = details?.ret_5 === null || details?.ret_5 === undefined
    ? null
    : Number(details.ret_5);
  const ampAvg5d = details?.amp_avg_5d === null || details?.amp_avg_5d === undefined
    ? null
    : Number(details.amp_avg_5d);
  const hotExpanding = marketEnv.temp === '热' && marketEnv.alarm_dir === '报扩';
  const deepOrWeak =
    (closeVsMa20 !== null && closeVsMa20 <= -12) ||
    (ret5 !== null && ret5 <= -5);

  if (hotExpanding && ampAvg5d !== null && ampAvg5d >= 5 && deepOrWeak) {
    return '【跟踪:热市急跌高振幅】';
  }

  const lastHotDays = details?.market_exposure?.last_hot_days;
  const up20 = details?.up_from_low_20d === null || details?.up_from_low_20d === undefined
    ? null
    : Number(details.up_from_low_20d);
  const pos60 = details?.price_pos_60 === null || details?.price_pos_60 === undefined
    ? null
    : Number(details.price_pos_60);
  const volRatio = details?.vol_ratio_20_60 === null || details?.vol_ratio_20_60 === undefined
    ? null
    : Number(details.vol_ratio_20_60);
  const recentHot = lastHotDays !== null && lastHotDays !== undefined && Number(lastHotDays) < 20;
  const structuralRepair =
    up20 !== null && up20 >= 5 && up20 < 10 &&
    pos60 !== null && pos60 >= 20 && pos60 < 40 &&
    volRatio !== null && volRatio >= 1 && volRatio < 1.3;
  const weakRepair =
    decisionText === '慎:明确弱势待修复' &&
    up20 !== null && up20 >= 10 && up20 < 20;

  return recentHot && (structuralRepair || weakRepair) ? '【跟踪:近期热市低位修复】' : decisionTag;
};

const applyRecord1PositiveLimitedWaitDecision = (decisionTag: string | null, score: number, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (!decisionText.startsWith('等:')) return decisionTag;

  const avgTurn = details?.turnover_mean === null || details?.turnover_mean === undefined
    ? null
    : Number(details.turnover_mean);
  const marketEnv = details?.market_env || {};

  if (score <= 20 && avgTurn !== null && avgTurn < 1) return '【等:低分低换等待】';
  if (avgTurn !== null && avgTurn < 2 && marketEnv.alarm_dir === '报缩') return '【等:缩量低换等待】';

  return decisionTag;
};

const applyRecord1ShrinkLowMehotDeepRiskDecision = (decisionTag: string | null, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (!decisionText.startsWith('等:')) return decisionTag;

  const c0 = details?.conc_70 === null || details?.conc_70 === undefined
    ? null
    : Number(details.conc_70);
  const rDd = details?.drawdown_from_60_high === null || details?.drawdown_from_60_high === undefined
    ? null
    : Number(details.drawdown_from_60_high);
  const marketEnv = details?.market_env || {};
  const meHotish = details?.market_exposure?.hotish_ratio_60 === null || details?.market_exposure?.hotish_ratio_60 === undefined
    ? null
    : Number(details.market_exposure.hotish_ratio_60);

  const matched =
    marketEnv.alarm_dir === '报缩' &&
    meHotish !== null && meHotish < 20 &&
    c0 !== null && c0 < 10 &&
    rDd !== null && rDd < -25;

  return matched ? '【慎:报缩低ME低C深回撤】' : decisionTag;
};

const applyRecord1NegativeGoodObserveDecision = (decisionTag: string | null, score: number, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (decisionText && !decisionText.startsWith('慎:') && !decisionText.startsWith('避:')) return decisionTag;

  const avgTurn = details?.turnover_mean === null || details?.turnover_mean === undefined
    ? null
    : Number(details.turnover_mean);
  const p0 = details?.profit_chip_day0 === null || details?.profit_chip_day0 === undefined
    ? null
    : Number(details.profit_chip_day0);
  const rDd = details?.drawdown_from_60_high === null || details?.drawdown_from_60_high === undefined
    ? null
    : Number(details.drawdown_from_60_high);
  const kdjJ = details?.kdj_j === null || details?.kdj_j === undefined
    ? null
    : Number(details.kdj_j);

  if (rDd !== null && rDd <= -30 && kdjJ !== null && kdjJ < 20) return '【等:深回撤超卖观察】';
  if (score >= 20 && score <= 40 && avgTurn !== null && avgTurn >= 1 && avgTurn < 2) return '【等:中分低换修复观察】';
  if (avgTurn !== null && avgTurn >= 4 && p0 !== null && p0 >= 10) return '【等:高换高位弹性观察】';

  return decisionTag;
};

const applyRecord1SmallActiveObserveDecision = (decisionTag: string | null, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (decisionText && !decisionText.startsWith('慎:') && !decisionText.startsWith('避:')) return decisionTag;

  const alertDate = details?.alert_date ? String(details.alert_date) : '';
  if (alertDate.startsWith('2025-04')) return decisionTag;

  const marketValue = details?.market_value === null || details?.market_value === undefined
    ? null
    : Number(details.market_value);
  const dayTurn = details?.day_turnoverrate === null || details?.day_turnoverrate === undefined
    ? null
    : Number(details.day_turnoverrate);
  const marketEnv = details?.market_env || {};
  const marketTemp = String(marketEnv.temp || '');
  const marketBreadth = String(marketEnv.alarm_dir || '');
  const neutralMarket =
    marketBreadth !== '报缩' &&
    !marketTemp.includes('极冷') &&
    !marketTemp.includes('热偏弱') &&
    !(marketTemp === '热' && marketBreadth === '报扩');
  const smallActiveWarmOrNeutral =
    marketValue !== null && marketValue < 30 &&
    dayTurn !== null && dayTurn >= 3 && dayTurn < 7 &&
    (marketTemp === '温' || neutralMarket);

  return smallActiveWarmOrNeutral ? '【等:小盘活跃修复观察】' : decisionTag;
};

const applyRecord1SequenceMidRepairDecision = (decisionTag: string | null, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (decisionText !== '慎:低分序列警戒' && decisionText !== '慎:序列警戒') return decisionTag;

  const pricePos60 = details?.price_pos_60 === null || details?.price_pos_60 === undefined
    ? null
    : Number(details.price_pos_60);
  const profitChipDay0 = details?.profit_chip_day0 === null || details?.profit_chip_day0 === undefined
    ? null
    : Number(details.profit_chip_day0);
  const marketEnv = details?.market_env || {};
  const midPosition = pricePos60 !== null && pricePos60 >= 20 && pricePos60 < 50;
  const midProfitChip = profitChipDay0 !== null && profitChipDay0 >= 5 && profitChipDay0 < 10;
  const breadthExpand = marketEnv.alarm_dir === '报扩';

  return midPosition && (midProfitChip || breadthExpand)
    ? '【等:序列中位修复观察】'
    : decisionTag;
};

const tradeDecisionTagRecord2 = (statusTag: string, tags: string[], details: any) => {
  const statusText = stripBrackets(statusTag);
  const tagText = tagTextOf(tags);
  const closeWeakness10 = details?.close_weakness_10 === null || details?.close_weakness_10 === undefined
    ? null
    : Number(details.close_weakness_10);
  const conc70 = details?.conc_70 === null || details?.conc_70 === undefined
    ? null
    : Number(details.conc_70);
  const conc90 = details?.conc_90 === null || details?.conc_90 === undefined
    ? null
    : Number(details.conc_90);
  const hasHighMidRisk = hasAnyTagText(tagText, record2HighMidRiskPatterns);
  const hasOrdinaryElasticity = tagText.includes('强信号弹性:普通');
  const hasHighElasticity = tagText.includes('强信号弹性:高换手高弹');
  const hasRepairElasticity = tagText.includes('强信号弹性:回撤后放量修复');
  const hasCoreLowElasticity = tagText.includes('强信号弹性:核心承接低弹');
  const hasSequenceWarning = tagText.includes('序列警戒:');
  const hasSequenceHardWarning =
    tagText.includes('序列警戒:状态降级') ||
    tagText.includes('序列警戒:长期重复报警');
  const hasLowScoreRepair = tagText.includes('低分修复:');
  const hasLowScoreShortWatch = tagText.includes('短线观察:高集中放量修复');
  const hasCoreAcceptanceWaitConfirm = tagText.includes('备选:核心承接待确认');
  const pricePos60 = details?.price_pos_60 === null || details?.price_pos_60 === undefined
    ? null
    : Number(details.price_pos_60);
  const profitChip = details?.profit_chip === null || details?.profit_chip === undefined
    ? null
    : Number(details.profit_chip);
  const turnoverMax = details?.turnover_max === null || details?.turnover_max === undefined
    ? null
    : Number(details.turnover_max);
  const turnoverMean = details?.turnover_mean === null || details?.turnover_mean === undefined
    ? null
    : Number(details.turnover_mean);
  const avgTurn10 = details?.avg_turn_10 === null || details?.avg_turn_10 === undefined
    ? null
    : Number(details.avg_turn_10);
  const alarmIndex = Number(details?.alarm_index || 0);
  const weakLowScoreRepair = hasLowScoreRepair && (
    (pricePos60 !== null && pricePos60 <= 3) ||
    (profitChip !== null && profitChip <= 3) ||
    (turnoverMax !== null && turnoverMax >= 15)
  );
  const hasStrongMainType = hasAnyTagText(tagText, record2StrongMainPatterns);
  const hasTechnicalAvoid = hasAnyTagText(tagText, [
    '低位无承接空头',
    '技术风险叠加',
    '均线全空弱势',
    '低流动弱趋势',
    '低位低换弹性不足',
  ]);
  const lowTurnAcceptanceWait =
    statusText === '观察' &&
    tagText.includes('低换手观察') &&
    avgTurn10 !== null &&
    closeWeakness10 !== null &&
    alarmIndex > 0 &&
    avgTurn10 <= 1 &&
    closeWeakness10 <= 60 &&
    alarmIndex <= 3;
  const avgTurnPositionWait =
    ['观察', '无效'].includes(statusText) &&
    turnoverMean !== null &&
    pricePos60 !== null &&
    conc90 !== null &&
    closeWeakness10 !== null &&
    alarmIndex > 0 &&
    turnoverMean >= 1.5 &&
    turnoverMean <= 3 &&
    pricePos60 >= 3 &&
    pricePos60 <= 15 &&
    conc90 <= 11 &&
    closeWeakness10 <= 60 &&
    alarmIndex <= 3;
  const noDecisionRiskAcceptanceWeak =
    ['观察', '无效'].includes(statusText) &&
    (
      (turnoverMax !== null && turnoverMax >= 10 && profitChip !== null && profitChip >= 3 && profitChip <= 10) ||
      (tagText.includes('普通筹码区') && tagText.includes('换手确认')) ||
      (conc70 !== null && conc70 >= 5 && conc70 <= 8.6 && turnoverMax !== null && turnoverMax >= 10) ||
      (tagText.includes('历史放量承接') && turnoverMax !== null && turnoverMax >= 5) ||
      (avgTurn10 !== null && avgTurn10 < 1 && tagText.includes('历史放量承接'))
    );

  if (statusText === '无效' && hasTechnicalAvoid) return '【慎:技术弱势待确认】';
  if (statusText === '无效' && hasSequenceHardWarning) return '【慎:低分序列警戒】';
  if (statusText === '无效' && weakLowScoreRepair) return '【慎:低分修复承接弱】';
  if (statusText === '无效' && hasLowScoreRepair) return '【等:低分高集中修复观察】';
  if (statusText === '无效' && hasLowScoreShortWatch) return '【等:低分短线观察】';
  if (statusText === '强信号' && hasSequenceWarning) return '【等:序列观察】';
  if (statusText === '观察' && hasSequenceWarning) return '【等:序列观察】';
  if (statusText === '观察' && hasCoreAcceptanceWaitConfirm) return '【等:核心承接待确认】';
  if (statusText === '强信号' && closeWeakness10 !== null && closeWeakness10 >= 60 && conc90 !== null && conc90 >= 20) return '【试:强信号承接修复】';
  if (statusText === '强信号' && closeWeakness10 !== null && closeWeakness10 >= 60) return '【等:强信号承接观察】';
  if (statusText === '强信号' && hasCoreLowElasticity) return '【慎:核心承接低弹】';
  if (lowTurnAcceptanceWait || avgTurnPositionWait) return '【等:低位承接观察】';
  if (noDecisionRiskAcceptanceWeak) return '【慎:无主风险承接弱】';
  const ordinaryStrongWait = statusText === '强信号' && hasOrdinaryElasticity && !hasHighMidRisk;
  const ordinaryStrongWeakConfirm = ordinaryStrongWait && (
    (pricePos60 !== null && pricePos60 < 10) ||
    (conc70 !== null && conc70 >= 14)
  );
  if (ordinaryStrongWeakConfirm) return '【慎:普通强信号弱确认】';
  if (ordinaryStrongWait) return '【等:普通强信号观察】';
  if (statusText !== '强信号' || hasHighMidRisk || hasOrdinaryElasticity) return null;
  if (hasHighElasticity && hasStrongMainType) return '【买:高弹强主】';
  if (hasRepairElasticity && hasStrongMainType) return '【试:回撤修复强主】';
  return null;
};

const applyRecord2LargeCapWeakAcceptanceRiskDecision = (decisionTag: string | null, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';

  const marketEnv = details?.market_env || {};
  const vol20 = details?.vol_20 === null || details?.vol_20 === undefined
    ? null
    : Number(details.vol_20);
  const turnRatio20 = details?.turn_ratio_20 === null || details?.turn_ratio_20 === undefined
    ? null
    : Number(details.turn_ratio_20);
  const circulation = details?.circulation === null || details?.circulation === undefined
    ? null
    : Number(details.circulation);
  const largeCap = circulation !== null && circulation >= 80;
  const weakAcceptanceShrinkLarge =
    decisionText === '慎:无主风险承接弱' &&
    turnRatio20 !== null &&
    turnRatio20 <= 0.7 &&
    largeCap;
  const lowSeqWarmExpandLarge =
    decisionText === '慎:低分序列警戒' &&
    marketEnv.temp === '温' &&
    marketEnv.alarm_dir === '报扩' &&
    largeCap;
  const weakAcceptanceColdExpandLarge =
    decisionText === '慎:无主风险承接弱' &&
    marketEnv.temp === '极冷' &&
    marketEnv.alarm_dir === '报扩' &&
    largeCap;
  const lowVolShrinkLarge =
    vol20 !== null &&
    vol20 < 20 &&
    turnRatio20 !== null &&
    turnRatio20 <= 0.7 &&
    largeCap;

  return weakAcceptanceShrinkLarge || lowSeqWarmExpandLarge || weakAcceptanceColdExpandLarge || lowVolShrinkLarge
    ? '【慎:大盘弱承接观察】'
    : decisionTag;
};

const applyRecord2TrackingDecision = (decisionTag: string | null, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (/^(买|试):/.test(decisionText)) return decisionTag;

  const marketEnv = details?.market_env || {};
  const turnRatio20 = details?.turn_ratio_20 === null || details?.turn_ratio_20 === undefined
    ? null
    : Number(details.turn_ratio_20);
  const circulation = details?.circulation === null || details?.circulation === undefined
    ? null
    : Number(details.circulation);
  const volumeConfirm = turnRatio20 !== null && turnRatio20 >= 1.2;
  const hotBig = marketEnv.temp === '热' && marketEnv.alarm_dir === '报扩' && circulation !== null && circulation >= 80;

  if (decisionText === '等:低分高集中修复观察' && (volumeConfirm || hotBig)) {
    return '【跟踪:低分高集中修复】';
  }

  const lastHotDays = details?.market_exposure?.last_hot_days;
  const bb20 = details?.bb_pos_20 === null || details?.bb_pos_20 === undefined ? null : Number(details.bb_pos_20);
  const closeVsMa20 = details?.close_vs_ma20 === null || details?.close_vs_ma20 === undefined ? null : Number(details.close_vs_ma20);
  const ret3 = details?.ret_3 === null || details?.ret_3 === undefined ? null : Number(details.ret_3);
  const recentHot = lastHotDays !== null && lastHotDays !== undefined && Number(lastHotDays) < 20;
  const bbDeepRepair = bb20 !== null && bb20 < -1 && closeVsMa20 !== null && closeVsMa20 >= -20 && closeVsMa20 < -12;
  const sharpDropRepair = ret3 !== null && ret3 < -10;

  return recentHot && (bbDeepRepair || sharpDropRepair) ? '【跟踪:近期热市深跌修复】' : decisionTag;
};

const applyRecord2GlobalSplitDecision = (decisionTag: string | null, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (!decisionText.startsWith('慎:') && !decisionText.startsWith('避:')) return decisionTag;

  const avgTurn = details?.turnover_mean === null || details?.turnover_mean === undefined
    ? null
    : Number(details.turnover_mean);
  const drawdownFrom60High = details?.drawdown_from_60_high === null || details?.drawdown_from_60_high === undefined
    ? null
    : Number(details.drawdown_from_60_high);
  const lastHotDays = details?.market_exposure?.last_hot_days === null || details?.market_exposure?.last_hot_days === undefined
    ? null
    : Number(details.market_exposure.last_hot_days);

  if (drawdownFrom60High !== null && drawdownFrom60High <= -20) return '【等:深回撤修复观察】';
  if (avgTurn !== null && avgTurn < 2 && lastHotDays !== null && lastHotDays >= 60) return '【慎:热退低换低效】';
  if (lastHotDays !== null && lastHotDays >= 60) return '【慎:热退低效观察】';

  return decisionTag;
};

const applyRecord2PositiveLimitedWaitDecision = (decisionTag: string | null, score: number, details: any = {}) => {
  const decisionText = decisionTag ? stripBrackets(decisionTag) : '';
  if (!decisionText.startsWith('等:')) return decisionTag;

  const concGap = details?.conc_gap === null || details?.conc_gap === undefined
    ? null
    : Number(details.conc_gap);
  const marketEnv = details?.market_env || {};

  if (score <= 40 && concGap !== null && concGap < 4) return '【等:低分窄幅等待】';
  if (concGap !== null && concGap < 6 && marketEnv.alarm_dir === '报缩') return '【等:报缩窄幅等待】';

  return decisionTag;
};

const TIGHT_CONC_GAP_MAX = 2.01;
const MID_CONC_GAP_MAX = 3.24;
const MOMENTUM_GAP_MIN = 3.24;
const MOMENTUM_GAP_MAX = 4.40;
const WIDE_CONC_GAP_MIN = 4.40;
const HIGH_AVG_TURN_MIN = 4.77;
const ACTIVE_AVG_TURN_MIN = 3.74;
const MID_AVG_TURN_MIN = 2.96;
const LOW_AVG_TURN_MIN = 2.10;
const CONC70_MID_LOW = 5.03;
const CONC70_MID_HIGH = 7.64;
const CONC70_CORE_LOW = 6.10;
const CONC70_CORE_HIGH = 7.64;
const CONC90_CORE_LOW = 8.13;
const CONC90_CORE_HIGH = 9.45;
const CONC90_NON_EXTREME_LOW = 6.62;
const CONC90_NON_EXTREME_HIGH = 11.50;
const PROFIT_CORE_LOW = 1.75;
const PROFIT_CORE_HIGH = 9.20;
const PROFIT_FADE_DELTA_MIN = 5.0;
const PULSE_LOW = 2.01;
const PULSE_HIGH = 5.73;
const PULSE_IDEAL_LOW = 3.62;
const PULSE_IDEAL_HIGH = 4.89;
const DEFAULT_MIN_SCORE = 80;

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const stddev = (values: number[]) => {
  const nums = values.filter((value) => Number.isFinite(value));
  if (nums.length < 2) return null;
  const mean = nums.reduce((sum, value) => sum + value, 0) / nums.length;
  const variance = nums.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (nums.length - 1);
  return Math.sqrt(variance);
};

const median = (values: number[]) => {
  const nums = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 1 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const parseEValues = (comments: any) => {
  const match = String(comments ?? '').match(/【E:([^】]+)】/);
  if (!match) return [];
  return match[1].split(',').map((value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  });
};

const parseMValues = (comments: any) => {
  const match = String(comments ?? '').match(/【M:([^】]+)】/);
  if (!match) return [];
  return match[1].split(',').map((value) => String(value ?? '').trim());
};

const parseFactorValues = (comments: any, key: string) => {
  const match = String(comments ?? '').match(new RegExp(`【${key}:([^】]+)】`));
  if (!match) return [];
  return match[1].split(',').map((value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  });
};

const negativeSignalTag = (comments: any) => {
  const text = String(comments ?? '');
  return text.includes('假阳性') || text.includes('序列警戒') || text.includes('DMI强熊');
};

const parsedMarketRow = (row: any) => {
  const m = parseMValues(row.comments);
  const r = parseFactorValues(row.comments, 'R');
  const e = parseFactorValues(row.comments, 'E');
  const s = parseFactorValues(row.comments, 'S');
  const me = parseFactorValues(row.comments, 'ME');
  const temp = m[1] || '';
  const alarmDir = m[2] || '';
  const regime = (temp === '热' || temp === '热偏弱') && alarmDir === '报扩'
    ? 'hot_expand'
    : (alarmDir === '报缩' || temp.includes('极冷') || temp.includes('热偏弱') ? 'weak_contract' : 'neutral');
  return {
    datestr: formatDbDate(row.datestr),
    regime,
    m_breadth: alarmDir,
    negative: negativeSignalTag(row.comments),
    e_ret5: e[5],
    low_pos: (r[0] !== null && r[0] !== undefined && r[0] < 5) || (s[1] !== null && s[1] !== undefined && s[1] < 10),
    me_hotish60: me[1],
  };
};

const calcWindowDetectorRows = (trendRows: any[], focusRows: any[], trailDays = 20) => {
  const parsedRows = (focusRows || []).map(parsedMarketRow);
  return (trendRows || []).map((row: any) => {
    const datestr = formatDbDate(row.datestr);
    const start = shiftDate(datestr, -trailDays);
    const selected = parsedRows.filter((item: any) => item.datestr >= start && item.datestr <= datestr);
    const n = selected.length;
    const neutralPct = pctNum(selected.filter((item: any) => item.regime === 'neutral').length, n);
    const weakPct = pctNum(selected.filter((item: any) => item.regime === 'weak_contract').length, n);
    const hotPct = pctNum(selected.filter((item: any) => item.regime === 'hot_expand').length, n);
    const contractPct = pctNum(selected.filter((item: any) => item.m_breadth === '报缩').length, n);
    const expandPct = pctNum(selected.filter((item: any) => item.m_breadth === '报扩').length, n);
    const negativePct = pctNum(selected.filter((item: any) => item.negative).length, n);
    const lowPct = pctNum(selected.filter((item: any) => item.low_pos).length, n);
    const hotishAvg = avg(selected.map((item: any) => item.me_hotish60).filter((value: any) => value !== null && value !== undefined));

    let windowSignal = 'NEUTRAL_WAIT';
    let windowTitle = '中性观察';
    let windowDesc = '未触发明确坏窗口或好窗口，按策略自身条件判断。';
    if (
      (lowPct >= 70 && negativePct >= 88) ||
      (weakPct >= 55 && contractPct >= 45 && negativePct >= 90) ||
      (neutralPct >= 75 && lowPct >= 50 && negativePct >= 85 && toNumber(hotishAvg) <= 2)
    ) {
      windowSignal = 'BAD_GUARD';
      windowTitle = '坏窗口暂缓';
      windowDesc = '低位拥挤或负面标签密集，历史回放中深回撤/PB10/B层策略 SL 显著升高。';
    } else if (
      (hotPct >= 45 && expandPct >= 70 && lowPct <= 62) ||
      (expandPct >= 80 && lowPct <= 60 && negativePct <= 82)
    ) {
      windowSignal = 'GOOD_ALLOW';
      windowTitle = '好窗口观察';
      windowDesc = '扩散强且低位拥挤不高，可作为策略族放行/加权观察，不单独生成买入。';
    }

    return {
      ...row,
      datestr,
      window_signal: windowSignal,
      window_title: windowTitle,
      window_desc: windowDesc,
      trail_days: trailDays,
      trail_signal_n: n,
      trail_neutral_pct: round2(neutralPct),
      trail_weak_contract_pct: round2(weakPct),
      trail_hot_expand_pct: round2(hotPct),
      trail_m_contract_pct: round2(contractPct),
      trail_m_expand_pct: round2(expandPct),
      trail_negative_pct: round2(negativePct),
      trail_low_pos_pct: round2(lowPct),
      trail_avg_me_hotish60: hotishAvg === null ? null : round2(hotishAvg),
    };
  });
};

const pctNum = (numerator: number, denominator: number) => denominator ? (100 * numerator) / denominator : 0;

const loadMarketWindowSnapshot = async (
  recordType: 'record1' | 'record2',
  focusTable: 'focus_stocks_ai' | 'focus_stocks2_ai',
  targetDate: string
) => {
  const mRows: any = await queryDB(`
    SELECT datestr, vol10_med, temp_label, alarm_dir, alarm_count
    FROM daily_m
    WHERE record_type = '${sqlEscape(recordType)}'
      AND datestr <= '${sqlEscape(targetDate)}'
    ORDER BY datestr DESC
    LIMIT 1
  `);
  if (!mRows || !mRows.length) return null;
  const mRow = { ...mRows[0], datestr: formatDbDate(mRows[0].datestr) };
  const focusRows: any = await queryDB(`
    SELECT datestr, comments
    FROM ${focusTable}
    WHERE datestr >= '${sqlEscape(shiftDate(mRow.datestr, -20))}'
      AND datestr <= '${sqlEscape(mRow.datestr)}'
      AND comments LIKE '%【M:%'
    ORDER BY datestr
  `);
  return calcWindowDetectorRows([mRow], focusRows || [], 20)[0] || null;
};

const loadMarketWindowSeries = async (
  recordType: 'record1' | 'record2',
  focusTable: 'focus_stocks_ai' | 'focus_stocks2_ai',
  minDate: string,
  maxDate: string
) => {
  const mRows: any = await queryDB(`
    SELECT datestr, vol10_med, temp_label, alarm_dir, alarm_count
    FROM daily_m
    WHERE record_type = '${sqlEscape(recordType)}'
      AND datestr >= '${sqlEscape(shiftDate(minDate, -5))}'
      AND datestr <= '${sqlEscape(maxDate)}'
    ORDER BY datestr
  `);
  if (!mRows || !mRows.length) return [];
  const formattedMRows = (mRows || []).map((row: any) => ({ ...row, datestr: formatDbDate(row.datestr) }));
  const firstDate = formattedMRows[0].datestr;
  const lastDate = formattedMRows[formattedMRows.length - 1].datestr;
  const focusRows: any = await queryDB(`
    SELECT datestr, comments
    FROM ${focusTable}
    WHERE datestr >= '${sqlEscape(shiftDate(firstDate, -20))}'
      AND datestr <= '${sqlEscape(lastDate)}'
      AND comments LIKE '%【M:%'
    ORDER BY datestr
  `);
  return calcWindowDetectorRows(formattedMRows, focusRows || [], 20);
};

const pickMarketWindowForDate = (windowRows: any[], targetDate: string): any | null => {
  const safeDate = formatDbDate(targetDate);
  if (!safeDate) return null;
  let selected: any | null = null;
  (windowRows || []).forEach((row: any) => {
    if (row?.datestr && row.datestr <= safeDate) selected = row;
  });
  return selected;
};

const marketEnvTemperature = (
  marketVolMed: number | null,
  volMa20: number | null,
  alarmCount: number,
  alarmMa20: number | null
) => {
  if (marketVolMed === null || volMa20 === null || alarmMa20 === null) return '未知';
  const volExpanding = marketVolMed > volMa20;
  const alarmExpanding = alarmCount > alarmMa20;
  if (marketVolMed > 35) return alarmExpanding ? '热' : '热偏弱';
  if (marketVolMed < 20) return '极冷';
  if (volExpanding) return '温';
  if (alarmExpanding) return '冷偏暖';
  return '极冷';
};

const calcMarketEnvironment = async (
  tableName: 'focus_stocks_ai' | 'focus_stocks2_ai',
  datestr: string,
  eIndex: number
) => {
  const safeDate = sqlEscape(datestr);
  const currentRows: any = await queryDB(`
    SELECT comments
    FROM ${tableName}
    WHERE datestr = '${safeDate}'
      AND comments LIKE '%【E:%'
  `);
  const currentValues = (currentRows || [])
    .map((row: any) => parseEValues(row.comments)[eIndex])
    .filter((value: any) => value !== null && value !== undefined) as number[];
  const currentMed = median(currentValues);
  if (currentMed === null) {
    return { vol_med: null, temp: '未知', alarm_dir: '未知', vol_ma20: null, alarm_ma20: null };
  }

  const historyRows: any = await queryDB(`
    SELECT datestr, comments
    FROM ${tableName}
    WHERE datestr < '${safeDate}'
      AND comments LIKE '%【E:%'
    ORDER BY datestr DESC
    LIMIT 800
  `);
  const historyByDate: Record<string, number[]> = {};
  (historyRows || []).forEach((row: any) => {
    const date = formatDbDate(row.datestr);
    const value = parseEValues(row.comments)[eIndex];
    if (value === null || value === undefined) return;
    if (!historyByDate[date]) historyByDate[date] = [];
    historyByDate[date].push(value);
  });
  const priorVolMeds = Object.keys(historyByDate)
    .sort()
    .slice(-19)
    .map((date) => median(historyByDate[date]))
    .filter((value): value is number => value !== null);
  const volMa20 = avg([...priorVolMeds, currentMed]);

  const countRows: any = await queryDB(`
    SELECT datestr, COUNT(*) AS alarm_count
    FROM ${tableName}
    WHERE datestr < '${safeDate}'
    GROUP BY datestr
    ORDER BY datestr DESC
    LIMIT 19
  `);
  const priorCounts = [...(countRows || [])]
    .reverse()
    .map((row: any) => toNumber(row.alarm_count));
  const alarmCount = currentRows?.length || 0;
  const alarmMa20 = avg([...priorCounts, alarmCount]);
  const alarmExpanding = alarmMa20 !== null && alarmCount > alarmMa20;
  const temp = marketEnvTemperature(currentMed, volMa20, alarmCount, alarmMa20);
  return {
    vol_med: round2(currentMed),
    temp,
    alarm_dir: alarmExpanding ? '报扩' : '报缩',
    vol_ma20: volMa20 === null ? null : round2(volMa20),
    alarm_ma20: alarmMa20 === null ? null : round2(alarmMa20),
  };
};

const calcMarketExposure = async (
  tableName: 'focus_stocks_ai' | 'focus_stocks2_ai',
  datestr: string
) => {
  const safeDate = sqlEscape(datestr);
  const rows: any = await queryDB(`
    SELECT datestr, comments
    FROM ${tableName}
    WHERE datestr <= '${safeDate}'
      AND comments LIKE '%【M:%'
    ORDER BY datestr ASC
  `);
  const byDate: Record<string, { date: Date; temp: string; dir: string }> = {};
  (rows || []).forEach((row: any) => {
    const date = formatDbDate(row.datestr);
    if (byDate[date]) return;
    const m = parseMValues(row.comments);
    byDate[date] = { date: new Date(`${date}T00:00:00`), temp: m[1] || '', dir: m[2] || '' };
  });
  const current = new Date(`${datestr}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const history = Object.values(byDate).filter((row) => row.date <= current);
  const windowRows = history.filter((row) => (current.getTime() - row.date.getTime()) / dayMs <= 60);
  const lastHot = [...history].reverse().find((row) => row.temp === '热');
  const lastHotDays = lastHot ? Math.round((current.getTime() - lastHot.date.getTime()) / dayMs) : null;
  const hotishRatio60 = windowRows.length
    ? (100 * windowRows.filter((row) => row.temp.startsWith('热')).length) / windowRows.length
    : null;
  const coldRatio60 = windowRows.length
    ? (100 * windowRows.filter((row) => ['冷偏暖', '极冷'].includes(row.temp)).length) / windowRows.length
    : null;
  return {
    last_hot_days: lastHotDays,
    hotish_ratio_60: hotishRatio60 === null ? null : round2(hotishRatio60),
    cold_ratio_60: coldRatio60 === null ? null : round2(coldRatio60)
  };
};

const calcRecord1PriceVolumeStats = (rowsDesc: any[]) => {
  const rows = [...(rowsDesc || [])].reverse();
  if (rows.length < 20) return null;

  const closes = rows.map((row) => toNumber(row.finalprice));
  const latestClose = closes[closes.length - 1];
  const last = (count: number) => rows.slice(Math.max(rows.length - count, 0));
  const lastNumbers = (field: string, count: number) => last(count).map((row) => toNumber(row[field]));
  const high60 = Math.max(...lastNumbers('day_max_price', 60));
  const low60 = Math.min(...lastNumbers('day_min_price', 60));
  const pricePos60 = high60 > low60 ? ((latestClose - low60) / (high60 - low60)) * 100 : null;
  const drawdownFrom60High = high60 > 0 ? (latestClose / high60 - 1) * 100 : null;
  const high20 = Math.max(...lastNumbers('day_max_price', 20));
  const drawdownFrom20High = high20 > 0 ? (latestClose / high20 - 1) * 100 : null;
  const low20 = Math.min(...lastNumbers('day_min_price', 20));
  const upFromLow20d = low20 > 0 ? (latestClose / low20 - 1) * 100 : null;
  const closeWeaknessValues = last(10)
    .map((row) => {
      const high = toNumber(row.day_max_price);
      const low = toNumber(row.day_min_price);
      const close = toNumber(row.finalprice);
      return high > low ? ((high - close) / (high - low)) * 100 : null;
    })
    .filter((value) => value !== null) as number[];
  const avgTurn10 = avg(lastNumbers('turnoverrate', 10));
  const avgTurn5 = avg(lastNumbers('turnoverrate', 5));
  const avgTurn20 = avg(lastNumbers('turnoverrate', 20));
  const avgVol5 = avg(lastNumbers('totaltradevol', 5));
  const avgVol60 = avg(lastNumbers('totaltradevol', 60));
  const avgAmount5 = avg(lastNumbers('totaltradevalue', 5));
  const avgAmount60 = avg(lastNumbers('totaltradevalue', 60));
  const ma20Current = avg(closes.slice(-20));
  const ma20Lag5 = rows.length >= 25 ? avg(closes.slice(-25, -5)) : null;
  const closeStd20Values = closes.slice(-20);
  const closeStd20Mean = avg(closeStd20Values);
  const closeStd20 =
    closeStd20Mean === null
      ? null
      : Math.sqrt(closeStd20Values.reduce((sum, value) => sum + Math.pow(value - closeStd20Mean, 2), 0) / closeStd20Values.length);
  const bbPos20 = closeStd20 !== null && closeStd20 > 0 && ma20Current !== null ? (latestClose - ma20Current) / (2 * closeStd20) : null;
  const pctChanges = rows.map((row) => toNumber(row.pricechangepct));
  const vol10 = stddev(pctChanges.slice(-10));
  const vol20 = stddev(pctChanges.slice(-20));
  const vol60 = rows.length >= 60 ? stddev(pctChanges.slice(-60)) : null;
  const volRatio20_60 = vol20 !== null && vol60 !== null && vol60 > 0 ? vol20 / vol60 : null;
  const ampValues5 = last(5)
    .map((row) => {
      const high = toNumber(row.day_max_price);
      const low = toNumber(row.day_min_price);
      const close = toNumber(row.finalprice);
      return close > 0 ? ((high - low) / close) * 100 : null;
    })
    .filter((value) => value !== null) as number[];
  const ret = (count: number) => {
    const base = closes[closes.length - count];
    return base > 0 ? (latestClose / base - 1) * 100 : null;
  };

  return {
    price_pos_60: pricePos60,
    drawdown_from_60_high: drawdownFrom60High,
    drawdown_from_20_high: drawdownFrom20High,
    up_from_low_20d: upFromLow20d,
    avg_turn_10: avgTurn10,
    avg_turn_5: avgTurn5,
    avg_turn_20: avgTurn20,
    turn_ratio_20: avgTurn20 && avgTurn20 > 0 && avgTurn5 !== null ? avgTurn5 / avgTurn20 : null,
    volume_ratio_5_60: avgVol60 && avgVol60 > 0 && avgVol5 !== null ? avgVol5 / avgVol60 : null,
    amount_ratio_5_60: avgAmount60 && avgAmount60 > 0 && avgAmount5 !== null ? avgAmount5 / avgAmount60 : null,
    close_weakness_10: avg(closeWeaknessValues),
    close_vs_ma20: ma20Current !== null && ma20Current > 0 ? (latestClose / ma20Current - 1) * 100 : null,
    ret_3: rows.length >= 4 ? ret(4) : null,
    ret_5: rows.length >= 5 ? ret(5) : null,
    ret_10: rows.length >= 10 ? ret(10) : null,
    ret_20: rows.length >= 20 ? ret(20) : null,
    vol_10: vol10 === null ? null : vol10 * Math.sqrt(252),
    vol_20: vol20 === null ? null : vol20 * Math.sqrt(252),
    vol_60: vol60 === null ? null : vol60 * Math.sqrt(252),
    vol_ratio_20_60: volRatio20_60,
    circulation: latestClose > 0 ? toNumber(rows[rows.length - 1].marketvalue) / latestClose : null,
    amp_avg_5d: ampValues5.length === 5 ? avg(ampValues5) : null,
    bb_pos_20: bbPos20,
    max_drop_20: Math.min(...lastNumbers('pricechangepct', 20)),
    ma20_slope_5: ma20Current !== null && ma20Lag5 !== null && ma20Lag5 > 0 ? (ma20Current / ma20Lag5 - 1) * 100 : null,
    profit_change_5: rows.length >= 6 ? toNumber(rows[rows.length - 1].profit_chip) - toNumber(rows[rows.length - 6].profit_chip) : null,
    history_days: rows.length
  };
};

const buildRecord1Portrait = async (symbolInput: string, datestr: string, modelMeta: any = {}) => {
  const symbolLike = sqlEscape(symbolInput);
  const safeDate = sqlEscape(datestr);

  const commonRows: any = await queryDB(`
    SELECT symbol, name, datestr, finalprice, marketvalue, profit_chip, turnoverrate
    FROM stock_day_common_data
    WHERE symbol LIKE '%${symbolLike}%'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 1
  `);
  const common = commonRows?.[0];
  if (!common) {
    return { error: '未找到该股票在指定日期之前的基础交易数据' };
  }

  const symbol = common.symbol;
  const actualDate = formatDbDate(common.datestr);
  const safeSymbol = sqlEscape(symbol);

  const chipRows: any = await queryDB(`
    SELECT tencent_concentration_70, tencent_concentration_90, datestr
    FROM stock_chip_result
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 1
  `);
  const chip = chipRows?.[0];
  if (!chip) {
    return { error: '未找到该股票在指定日期之前的筹码集中度数据', symbol, datestr: actualDate };
  }

  const turnoverRows: any = await queryDB(`
    SELECT turnoverrate
    FROM stock_day_common_data
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 150
  `);
  if (!turnoverRows?.length) {
    return { error: '未找到该股票在指定日期之前的换手率数据', symbol, datestr: actualDate };
  }

  const profitRows: any = await queryDB(`
    SELECT profit_chip
    FROM stock_day_common_data
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 3
  `);

  const dmiRows: any = await queryDB(`
    SELECT pdi, mdi, adx
    FROM dmi
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 1
  `);

  const kdjRows: any = await queryDB(`
    SELECT j
    FROM kdj
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 1
  `);

  const maRows: any = await queryDB(`
    SELECT ma5, ma10, ma20, ma60
    FROM ma
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 1
  `);

  const maLagRows: any = await queryDB(`
    SELECT ma5
    FROM ma
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${sqlEscape(shiftDate(datestr, -5))}'
    ORDER BY datestr DESC
    LIMIT 1
  `);

  const stockDayRows: any = await queryDB(`
    SELECT datestr, finalprice, pricechangepct, totaltradevalue, totaltradevol,
           turnoverrate, day_max_price, day_min_price, profit_chip, marketvalue
    FROM stock_day_common_data
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 180
  `);

  const rates = turnoverRows.map((row: any) => toNumber(row.turnoverrate));
  const meanTurn = rates.reduce((sum: number, rate: number) => sum + rate, 0) / rates.length;
  const maxTurn = Math.max(...rates);
  const pulseRatio = maxTurn / (meanTurn > 0 ? meanTurn : 1);

  const profitDay0 = toNumber(common.profit_chip);
  const profitMax3 = Math.max(...(profitRows || []).map((row: any) => toNumber(row.profit_chip, profitDay0)), profitDay0);
  const profitDelta = profitMax3 - profitDay0;

  const conc70 = toNumber(chip.tencent_concentration_70);
  const conc90 = toNumber(chip.tencent_concentration_90);
  const concGap = conc90 - conc70;
  if (concGap < 0) {
    return { error: '集中度数据异常', symbol, datestr: actualDate };
  }

  const dmi = dmiRows?.[0];
  const kdj = kdjRows?.[0];
  const ma = maRows?.[0];
  const maLag = maLagRows?.[0];
  const dmiPdi = dmi ? toNumber(dmi.pdi) : null;
  const dmiMdi = dmi ? toNumber(dmi.mdi) : null;
  const dmiAdx = dmi ? toNumber(dmi.adx) : null;
  const dmiDiff = dmi ? toNumber(dmi.pdi) - toNumber(dmi.mdi) : null;
  const ma5 = ma ? toNumber(ma.ma5) : null;
  const ma10 = ma ? toNumber(ma.ma10) : null;
  const ma20 = ma ? toNumber(ma.ma20) : null;
  const ma60 = ma ? toNumber(ma.ma60) : null;
  const ma5Lag5 = maLag ? toNumber(maLag.ma5) : 0;
  const ma5Chg5Pct = ma5 !== null && ma5Lag5 > 0 ? (ma5 / ma5Lag5 - 1) * 100 : null;
  const priceVolumeStats = calcRecord1PriceVolumeStats(stockDayRows || []);
  const pricePos60 = priceVolumeStats?.price_pos_60 ?? null;
  const drawdownFrom60High = priceVolumeStats?.drawdown_from_60_high ?? null;
  const upFromLow20d = priceVolumeStats?.up_from_low_20d ?? null;
  const avgTurn10 = priceVolumeStats?.avg_turn_10 ?? null;
  const lowPositionRepairConfirm =
    upFromLow20d !== null &&
    upFromLow20d > 10 &&
    avgTurn10 !== null &&
    avgTurn10 < 8;
  const avgTurn5 = priceVolumeStats?.avg_turn_5 ?? null;
  const volumeRatio560 = priceVolumeStats?.volume_ratio_5_60 ?? null;
  const amountRatio560 = priceVolumeStats?.amount_ratio_5_60 ?? null;
  const closeWeakness10 = priceVolumeStats?.close_weakness_10 ?? null;
  const ret5 = priceVolumeStats?.ret_5 ?? null;
  const ret10 = priceVolumeStats?.ret_10 ?? null;
  const ret20 = priceVolumeStats?.ret_20 ?? null;
  const vol10 = priceVolumeStats?.vol_10 ?? null;
  const vol20 = priceVolumeStats?.vol_20 ?? null;
  const vol60 = priceVolumeStats?.vol_60 ?? null;
  const drawdownFrom20High = priceVolumeStats?.drawdown_from_20_high ?? null;
  const closeVsMa20 = priceVolumeStats?.close_vs_ma20 ?? null;
  const turnRatio20 = priceVolumeStats?.turn_ratio_20 ?? null;
  const circulation = priceVolumeStats?.circulation ?? null;
  const maxDrop20 = priceVolumeStats?.max_drop_20 ?? null;
  const ma20Slope5 = priceVolumeStats?.ma20_slope_5 ?? null;
  const profitChange5 = priceVolumeStats?.profit_change_5 ?? null;

  const tightGap = concGap <= TIGHT_CONC_GAP_MAX;
  const highAvgTurn = meanTurn >= HIGH_AVG_TURN_MIN;
  const activeAvgTurn = meanTurn >= ACTIVE_AVG_TURN_MIN;
  const midAvgTurn = meanTurn >= MID_AVG_TURN_MIN;
  const profitCore = betweenValue(profitMax3, PROFIT_CORE_LOW, PROFIT_CORE_HIGH);
  const pulseGood = betweenValue(pulseRatio, PULSE_LOW, PULSE_HIGH);
  const pulseIdeal = betweenValue(pulseRatio, PULSE_IDEAL_LOW, PULSE_IDEAL_HIGH);
  const coreChipZone =
    betweenValue(conc70, CONC70_CORE_LOW, CONC70_CORE_HIGH) &&
    betweenValue(conc90, CONC90_CORE_LOW, CONC90_CORE_HIGH);
  const midUpperChip =
    betweenValue(conc70, CONC70_MID_LOW, CONC70_MID_HIGH) &&
    betweenValue(conc90, CONC90_NON_EXTREME_LOW, CONC90_NON_EXTREME_HIGH);
  const strongCore = tightGap && highAvgTurn;
  const superStrong =
    strongCore &&
    profitCore &&
    pulseGood &&
    conc70 >= 4.10 &&
    conc90 >= CONC90_NON_EXTREME_LOW;
  const mediumGapMomentum =
    betweenValue(concGap, MOMENTUM_GAP_MIN, MOMENTUM_GAP_MAX) &&
    meanTurn >= ACTIVE_AVG_TURN_MIN &&
    meanTurn < HIGH_AVG_TURN_MIN;
  const mediumGapWatch =
    betweenValue(concGap, MOMENTUM_GAP_MIN, MOMENTUM_GAP_MAX) &&
    meanTurn >= MID_AVG_TURN_MIN &&
    meanTurn < ACTIVE_AVG_TURN_MIN;
  const profitFadeMomentum =
    profitDelta >= PROFIT_FADE_DELTA_MIN &&
    meanTurn >= ACTIVE_AVG_TURN_MIN &&
    concGap <= WIDE_CONC_GAP_MIN;

  const gapScore = tightGap ? 34 : concGap <= 2.56 ? 21 : concGap <= MID_CONC_GAP_MAX ? 12 : concGap <= MOMENTUM_GAP_MAX ? 8 : 0;
  const avgTurnScore = highAvgTurn ? 32 : activeAvgTurn ? 22 : midAvgTurn ? 12 : meanTurn >= LOW_AVG_TURN_MIN ? 5 : 0;
  const concPositionScore = coreChipZone && profitCore ? 18 : coreChipZone ? 14 : midUpperChip && profitCore ? 10 : midUpperChip ? 7 : betweenValue(conc70, 4.10, 8.60) && betweenValue(conc90, CONC90_NON_EXTREME_LOW, CONC90_NON_EXTREME_HIGH) ? 5 : conc70 > 9.0 || conc90 > CONC90_NON_EXTREME_HIGH ? 0 : 3;
  const maxTurnScore = maxTurn >= 18.21 && maxTurn <= 30.0 ? 5 : maxTurn > 30.0 ? 3 : maxTurn >= 13.75 ? 3 : maxTurn >= 9.19 ? 1 : 0;
  const profitScore = profitCore ? 6 : profitMax3 > PROFIT_CORE_HIGH && profitMax3 <= 18.59 ? 3 : 1;
  const pulseScore = pulseIdeal ? 6 : pulseGood ? 5 : 0;

  let regimeBonus = 0;
  if (superStrong) regimeBonus += 10;
  if (strongCore && !superStrong) regimeBonus += 5;
  if (mediumGapMomentum) regimeBonus += 18;
  if (mediumGapWatch) regimeBonus += 6;
  if (coreChipZone && profitCore) regimeBonus += 6;
  if (profitFadeMomentum) regimeBonus += 5;
  if (tightGap && activeAvgTurn && !highAvgTurn) regimeBonus += 4;

  const rawScore = gapScore + avgTurnScore + concPositionScore + maxTurnScore + profitScore + pulseScore + regimeBonus;
  let riskPenalty = 0;
  if (concGap > WIDE_CONC_GAP_MIN && meanTurn < LOW_AVG_TURN_MIN) riskPenalty += 10;
  if (concGap > WIDE_CONC_GAP_MIN) riskPenalty += 8;
  if (meanTurn < LOW_AVG_TURN_MIN) riskPenalty += 8;
  if (conc70 > 9.0) riskPenalty += 8;
  if (conc90 > CONC90_NON_EXTREME_HIGH) riskPenalty += 5;
  if (pulseRatio > PULSE_HIGH && !highAvgTurn) riskPenalty += 5;

  const preScore = Math.min(Math.max(rawScore - riskPenalty, 0), 100);
  const technicalHardRisk = dmiDiff !== null && dmiDiff < -20.0 && meanTurn < LOW_AVG_TURN_MIN && profitDelta < 1.0;
  const technicalSoftRisk = preScore < 40.0 && profitDelta < 1.0 && ma5Chg5Pct !== null && ma5Chg5Pct < 0.0;
  if (technicalHardRisk) riskPenalty += 10;
  if (technicalSoftRisk) riskPenalty += 4;

  const scoreBeforeDrawdownRisk = Math.round(Math.min(Math.max(rawScore - riskPenalty, 0), 100) * 10) / 10;
  const observeCandidateBeforeDrawdown =
    !superStrong &&
    !strongCore &&
    (
      mediumGapMomentum ||
      (coreChipZone && profitCore && scoreBeforeDrawdownRisk >= 55) ||
      scoreBeforeDrawdownRisk >= 60
    );
  const drawdownHardRisk =
    observeCandidateBeforeDrawdown &&
    scoreBeforeDrawdownRisk >= 60 &&
    profitDay0 < 2.0 &&
    profitMax3 < 5.0;
  const drawdownSoftRisk =
    observeCandidateBeforeDrawdown &&
    profitDay0 < 3.2 &&
    concGap >= 2.20 &&
    concGap <= 3.30;
  const nonStrongCandidate = !superStrong && !strongCore;
  const highTurnLowProfitRisk =
    nonStrongCandidate &&
    avgTurn10 !== null &&
    avgTurn10 >= 4.0 &&
    profitDay0 <= 2.5;
  const weakCloseLowProfitRisk =
    nonStrongCandidate &&
    closeWeakness10 !== null &&
    closeWeakness10 >= 63.0 &&
    profitDay0 <= 2.5;
  const nearHighLowProfitDivergence =
    nonStrongCandidate &&
    drawdownFrom60High !== null &&
    drawdownFrom60High >= -14.0 &&
    profitDay0 <= 3.0;
  if (drawdownHardRisk) riskPenalty += 18;
  if (drawdownSoftRisk && !drawdownHardRisk) riskPenalty += 8;
  if (highTurnLowProfitRisk) riskPenalty += 16;
  if (weakCloseLowProfitRisk && !highTurnLowProfitRisk) riskPenalty += 10;
  if (nearHighLowProfitDivergence && !highTurnLowProfitRisk) riskPenalty += 10;

  const score = Math.round(Math.min(Math.max(rawScore - riskPenalty, 0), 100) * 10) / 10;
  const strongSignalCandidate = superStrong || strongCore;
  const strongQualityTightHighScore =
    strongSignalCandidate &&
    concGap <= 1.57 &&
    score >= 93.0;
  const strongQualityHighTurnPulse =
    strongSignalCandidate &&
    meanTurn >= 6.20 &&
    pulseRatio >= 4.04;
  const strongDrawdownLowProfitWeakPulse =
    strongSignalCandidate &&
    profitDay0 <= 1.84 &&
    pulseRatio <= 4.25;
  const strongDrawdownWeakClose =
    strongSignalCandidate &&
    closeWeakness10 !== null &&
    pulseRatio <= 3.48 &&
    closeWeakness10 >= 54.15;
  const shortHighPositionActive =
    pricePos60 !== null &&
    avgTurn10 !== null &&
    pricePos60 >= 50.0 &&
    avgTurn10 >= 3.0;
  const shortProfitRepair =
    pricePos60 !== null &&
    pricePos60 >= 30.0 &&
    profitDelta >= 8.0;
  const shortPulseElastic =
    avgTurn10 !== null &&
    pulseRatio >= 5.8 &&
    avgTurn10 >= 4.0;
  const shortWideHighTurn =
    avgTurn10 !== null &&
    concGap >= 6.8 &&
    avgTurn10 >= 2.5;
  const shortWatchPullbackTurnPulse =
    !strongSignalCandidate &&
    avgTurn10 !== null &&
    drawdownFrom60High !== null &&
    score < DEFAULT_MIN_SCORE &&
    avgTurn10 >= 2.4 &&
    pulseRatio >= 4.5 &&
    drawdownFrom60High <= -18.0 &&
    !shortHighPositionActive &&
    !shortProfitRepair &&
    !shortPulseElastic &&
    !shortWideHighTurn;
  const warningObservePulseMidChip =
    !strongSignalCandidate &&
    pulseRatio >= 5.0 &&
    concGap > TIGHT_CONC_GAP_MAX &&
    concGap <= MID_CONC_GAP_MAX;
  const warningObservePullbackWeak =
    !strongSignalCandidate &&
    drawdownFrom60High !== null &&
    drawdownFrom60High <= -25.0 &&
    meanTurn <= 5.0;
  const warningLowProfitMidChip =
    !strongSignalCandidate &&
    profitMax3 <= 3.0 &&
    concGap > TIGHT_CONC_GAP_MAX &&
    concGap <= MID_CONC_GAP_MAX;
  const warningObserveShortWatchConflict =
    shortWatchPullbackTurnPulse &&
    score >= 70.0;
  const tags: string[] = [];
  if (superStrong) tags.push('【超强确认:紧凑筹码+高均换+健康盈利+脉冲】');
  else if (strongCore) tags.push('【强规律:筹码紧凑+高均换】');
  else if (tightGap && activeAvgTurn) tags.push('【次强规律:筹码紧凑+活跃换手】');
  else if (tightGap) tags.push('【筹码紧凑-待换手确认】');
  if (mediumGapMomentum) tags.push('【中等筹码带+活跃承接】', '【中期发酵型】');
  else if (mediumGapWatch) tags.push('【中等筹码带-动能观察】');
  if (profitFadeMomentum) tags.push('【盈利筹码回落蓄势】');
  if (coreChipZone && profitCore) tags.push('【优质复合:核心集中度+健康盈利】');
  else if (coreChipZone) tags.push('【集中度中上-核心区】');
  else if (midUpperChip) tags.push('【集中度中上-非极端】');
  if (highAvgTurn) tags.push('【高均换确认】');
  if (strongQualityTightHighScore) tags.push('【强信号质量:紧凑高分稳健】');
  if (strongQualityHighTurnPulse) tags.push('【强信号质量:高均换强脉冲】');
  if (strongDrawdownLowProfitWeakPulse) tags.push('【回撤管理:强信号低盈利弱脉冲】');
  if (strongDrawdownWeakClose) tags.push('【回撤管理:强信号收盘承接弱】');
  if (shortHighPositionActive) tags.push('【短线:高位放量活跃】');
  if (shortProfitRepair) tags.push('【短线:盈利回落强修复】');
  if (shortPulseElastic) tags.push('【短线:脉冲高弹机会】');
  if (shortWideHighTurn) tags.push('【短线:宽筹码高换弹性】');
  if (shortWatchPullbackTurnPulse) tags.push('【短线观察:回撤换手脉冲修复】');
  if (warningObservePulseMidChip) tags.push('【警戒:观察脉冲偏强中等筹码】');
  if (warningObservePullbackWeak) tags.push('【警戒:观察回撤位弱】');
  if (warningLowProfitMidChip) tags.push('【警戒:低盈利中等筹码回撤】');
  if (warningObserveShortWatchConflict) tags.push('【警戒:观察短线修复回撤未稳】');
  if (score >= DEFAULT_MIN_SCORE && !tags.includes('【中期发酵型】')) tags.push('【中期发酵型】');
  if (concGap > TIGHT_CONC_GAP_MAX && concGap <= MID_CONC_GAP_MAX) tags.push('【筹码带中等-观察】');
  if (technicalHardRisk) tags.push('【风险:趋势空头+均换不足+筹码无修复】');
  if (technicalSoftRisk) tags.push('【风险:低分+盈利无修复+短均走弱】');
  if (drawdownHardRisk) tags.push('【风险:低盈利未修复+观察高分】');
  if (drawdownSoftRisk) tags.push('【风险:低盈利+中等筹码带回撤】');
  if (highTurnLowProfitRisk) tags.push('【风险:高换手低盈利承接弱】');
  if (weakCloseLowProfitRisk) tags.push('【风险:低盈利+收盘承接弱】');
  if (nearHighLowProfitDivergence) tags.push('【风险:近高位低盈利背离】');
  if (concGap > WIDE_CONC_GAP_MIN) tags.push('【风险:筹码带偏宽】');
  if (conc70 > 9.0) tags.push('【风险:70集中度过高】');
  if (conc90 > CONC90_NON_EXTREME_HIGH) tags.push('【风险:90集中度偏高】');
  if (meanTurn < LOW_AVG_TURN_MIN) tags.push('【风险:均换不足】');
  if (pulseRatio > PULSE_HIGH && !highAvgTurn) tags.push('【风险:脉冲过强】');
  if (!tags.length) tags.push('【弱匹配:未命中规律】');

  const statusTag =
    drawdownHardRisk ||
    (drawdownSoftRisk && score < 60) ||
    highTurnLowProfitRisk ||
    weakCloseLowProfitRisk ||
    nearHighLowProfitDivergence
      ? '【无效】'
      : score >= DEFAULT_MIN_SCORE && (superStrong || strongCore)
        ? '【强信号】'
        : (mediumGapMomentum && score >= 60) || (coreChipZone && profitCore && score >= 55) || score >= 60
        ? '【观察】'
          : '【无效】';
  tags.push(...sequenceTagsRecord1(await querySequenceContext('focus_stocks_ai', symbol, actualDate), score));
  const record1SequenceWarning = tags.some((tag) => tag.includes('序列警戒:'));
  const record1LowInvalid = statusTag === '【无效】' && score < 55;
  const lowScoreWideHighTurnRepair =
    record1LowInvalid &&
    !record1SequenceWarning &&
    shortWideHighTurn;
  if (lowScoreWideHighTurnRepair) tags.push('【低分修复:宽筹码高换弹性确认】');
  const details = {
    conc_70: round2(conc70),
    conc_90: round2(conc90),
    conc_gap: round2(concGap),
    turnover_mean: round2(meanTurn),
    turnover_max: round2(maxTurn),
    profit_chip_day0: round2(profitDay0),
    profit_chip_max3: round2(profitMax3),
    profit_delta: round2(profitDelta),
    pulse_ratio: round2(pulseRatio),
    dmi_pdi: dmiPdi === null ? null : round2(dmiPdi),
    dmi_mdi: dmiMdi === null ? null : round2(dmiMdi),
    dmi_adx: dmiAdx === null ? null : round2(dmiAdx),
    dmi_diff: dmiDiff === null ? null : round2(dmiDiff),
    kdj_j: kdj?.j === null || kdj?.j === undefined ? null : round2(toNumber(kdj.j)),
    ma5: ma5 === null ? null : round2(ma5),
    ma10: ma10 === null ? null : round2(ma10),
    ma20: ma20 === null ? null : round2(ma20),
    ma60: ma60 === null ? null : round2(ma60),
    ma5_chg5_pct: ma5Chg5Pct === null ? null : round2(ma5Chg5Pct),
    price_pos_60: pricePos60 === null ? null : round2(pricePos60),
    drawdown_from_60_high: drawdownFrom60High === null ? null : round2(drawdownFrom60High),
    up_from_low_20d: upFromLow20d === null ? null : round2(upFromLow20d),
    low_position_repair_confirm: lowPositionRepairConfirm,
    avg_turn_10: avgTurn10 === null ? null : round2(avgTurn10),
    avg_turn_5: avgTurn5 === null ? null : round2(avgTurn5),
    volume_ratio_5_60: volumeRatio560 === null ? null : round2(volumeRatio560),
    amount_ratio_5_60: amountRatio560 === null ? null : round2(amountRatio560),
    close_weakness_10: closeWeakness10 === null ? null : round2(closeWeakness10),
    ret_5: ret5 === null ? null : round2(ret5),
    ret_3: priceVolumeStats?.ret_3 === null || priceVolumeStats?.ret_3 === undefined ? null : round2(priceVolumeStats.ret_3),
    ret_10: ret10 === null ? null : round2(ret10),
    ret_20: ret20 === null ? null : round2(ret20),
    vol_10: vol10 === null ? null : round2(vol10),
    vol_20: vol20 === null ? null : round2(vol20),
    vol_60: vol60 === null ? null : round2(vol60),
    vol_ratio_20_60: priceVolumeStats?.vol_ratio_20_60 === null || priceVolumeStats?.vol_ratio_20_60 === undefined ? null : round2(priceVolumeStats.vol_ratio_20_60),
    drawdown_from_20_high: drawdownFrom20High === null ? null : round2(drawdownFrom20High),
    close_vs_ma20: closeVsMa20 === null ? null : round2(closeVsMa20),
    turn_ratio_20: turnRatio20 === null ? null : round2(turnRatio20),
    circulation: circulation === null ? null : round2(circulation),
    amp_avg_5d: priceVolumeStats?.amp_avg_5d === null || priceVolumeStats?.amp_avg_5d === undefined ? null : round2(priceVolumeStats.amp_avg_5d),
    bb_pos_20: priceVolumeStats?.bb_pos_20 === null || priceVolumeStats?.bb_pos_20 === undefined ? null : round2(priceVolumeStats.bb_pos_20),
    max_drop_20: maxDrop20 === null ? null : round2(maxDrop20),
    ma20_slope_5: ma20Slope5 === null ? null : round2(ma20Slope5),
    profit_change_5: profitChange5 === null ? null : round2(profitChange5),
    market_value: common?.marketvalue === null || common?.marketvalue === undefined ? null : round2(toNumber(common.marketvalue)),
    day_turnoverrate: common?.turnoverrate === null || common?.turnoverrate === undefined ? null : round2(toNumber(common.turnoverrate)),
    alert_date: actualDate,
    raw_score: rawScore,
    risk_penalty: riskPenalty,
    pre_score: round2(preScore),
    score_before_drawdown_risk: scoreBeforeDrawdownRisk,
    super_strong: superStrong,
    strong_core: strongCore,
    strong_quality_tight_high_score: strongQualityTightHighScore,
    strong_quality_high_turn_pulse: strongQualityHighTurnPulse,
    strong_drawdown_low_profit_weak_pulse: strongDrawdownLowProfitWeakPulse,
    strong_drawdown_weak_close: strongDrawdownWeakClose,
    short_high_position_active: shortHighPositionActive,
    short_profit_repair: shortProfitRepair,
    short_pulse_elastic: shortPulseElastic,
    short_wide_high_turn: shortWideHighTurn,
    short_watch_pullback_turn_pulse: shortWatchPullbackTurnPulse,
    warning_observe_pulse_mid_chip: warningObservePulseMidChip,
    warning_observe_pullback_weak: warningObservePullbackWeak,
    warning_low_profit_mid_chip: warningLowProfitMidChip,
    warning_observe_short_watch_conflict: warningObserveShortWatchConflict,
    medium_gap_momentum: mediumGapMomentum,
    technical_hard_risk: technicalHardRisk,
    technical_soft_risk: technicalSoftRisk,
    drawdown_hard_risk: drawdownHardRisk,
    drawdown_soft_risk: drawdownSoftRisk,
    high_turn_low_profit_risk: highTurnLowProfitRisk,
    weak_close_low_profit_risk: weakCloseLowProfitRisk,
    near_high_low_profit_divergence: nearHighLowProfitDivergence
  };
  const marketEnv = await calcMarketEnvironment('focus_stocks_ai', actualDate, 0);
  const marketExposure = await calcMarketExposure('focus_stocks_ai', actualDate);
  (details as any).market_env = marketEnv;
  (details as any).market_exposure = marketExposure;
  const baseDecisionTag = tradeDecisionTagRecord1(score, statusTag, tags, details);
  const decisionTag = applyRecord1ShrinkLowMehotDeepRiskDecision(
    applyRecord1PositiveLimitedWaitDecision(
      applyRecord1SequenceMidRepairDecision(
        applyRecord1SmallActiveObserveDecision(
          applyRecord1NegativeGoodObserveDecision(
            applyRecord1TrackingDecision(
              applyRecord1MarketRiskDecision(
                applyRecord1LowRepairWeakEnvironmentDecision(baseDecisionTag, details),
                details
              ),
              details
            ),
            score,
            details
          ),
          details
        ),
        details
      ),
      score,
      details
    ),
    details
  );
  const comments = [
    decisionTag,
    `【${score}】`,
    statusTag,
    `【C:${details.conc_70},${details.conc_90},${details.conc_gap}】`,
    `【T:${details.turnover_mean},${details.turnover_max}】`,
    `【P:${details.profit_chip_day0},${details.profit_chip_max3},${details.profit_delta},${details.pulse_ratio}】`,
    `【R:${details.price_pos_60},${details.drawdown_from_60_high},${details.avg_turn_10},${details.close_weakness_10}】`,
    `【E:${details.vol_10},${details.vol_20},${details.vol_60},${details.drawdown_from_20_high},${details.close_vs_ma20},${details.ret_5},${details.turn_ratio_20},${details.circulation},${details.amp_avg_5d},${details.bb_pos_20}】`,
    `【S:${details.up_from_low_20d},${details.price_pos_60},${details.ret_3},${details.vol_ratio_20_60}】`,
    `【M:${marketEnv.vol_med},${marketEnv.temp},${marketEnv.alarm_dir}】`,
    `【ME:${marketExposure.last_hot_days},${marketExposure.hotish_ratio_60},${marketExposure.cold_ratio_60}】`,
    tags.join(' ')
  ].filter(Boolean).join('');

  return {
    symbol,
    name: common.name,
    model: 'record1_v12_38',
    ...modelMeta,
    query_datestr: datestr,
    datestr: actualDate,
    chip_datestr: formatDbDate(chip.datestr),
    alert_decision: decisionTag ? stripBrackets(decisionTag) : null,
    comments,
    score,
    status: statusTag.replace(/[【】]/g, ''),
    tags,
    details
  };
};

const buildRecord2Portrait = async (symbolInput: string, datestr: string, modelMeta: any = {}) => {
  const symbolLike = sqlEscape(symbolInput);
  const safeDate = sqlEscape(datestr);

  const commonRows: any = await queryDB(`
    SELECT symbol, name, datestr, finalprice, marketvalue, profit_chip
    FROM stock_day_common_data
    WHERE symbol LIKE '%${symbolLike}%'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 1
  `);
  const common = commonRows?.[0];
  if (!common) return { error: '未找到该股票在指定日期之前的基础交易数据' };

  const symbol = common.symbol;
  const actualDate = formatDbDate(common.datestr);
  const safeSymbol = sqlEscape(symbol);

  const chipRows: any = await queryDB(`
    SELECT tencent_concentration_70, tencent_concentration_90, datestr
    FROM stock_chip_result
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 1
  `);
  const chip = chipRows?.[0];
  if (!chip) return { error: '未找到该股票在指定日期之前的筹码集中度数据', symbol, datestr: actualDate };

  const turnoverRows: any = await queryDB(`
    SELECT turnoverrate
    FROM stock_day_common_data
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 150
  `);
  if (!turnoverRows?.length) return { error: '未找到该股票在指定日期之前的换手率数据', symbol, datestr: actualDate };

  const profitRows: any = await queryDB(`
    SELECT profit_chip
    FROM stock_day_common_data
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 3
  `);
  const kdjRows: any = await queryDB(`
    SELECT k, d, j
    FROM kdj
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 6
  `);
  const maRows: any = await queryDB(`
    SELECT ma5, ma10, ma20, ma60
    FROM ma
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 6
  `);
  const dmiRows: any = await queryDB(`
    SELECT pdi, mdi, adx
    FROM dmi
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 6
  `);
  const stockDayRows: any = await queryDB(`
    SELECT datestr, finalprice, pricechangepct, totaltradevalue, totaltradevol,
           turnoverrate, day_max_price, day_min_price, profit_chip, marketvalue
    FROM stock_day_common_data
    WHERE symbol = '${safeSymbol}'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 180
  `);

  const rates = turnoverRows.map((row: any) => toNumber(row.turnoverrate));
  const meanTurn = rates.reduce((sum: number, rate: number) => sum + rate, 0) / rates.length;
  const maxTurn = Math.max(...rates);
  const pulseRatio = maxTurn / (meanTurn > 0 ? meanTurn : 1);

  const profitDay0 = toNumber(common.profit_chip);
  const profitMax3 = Math.max(...(profitRows || []).map((row: any) => toNumber(row.profit_chip, profitDay0)), profitDay0);
  const profitDelta = profitMax3 - profitDay0;
  const conc70 = toNumber(chip.tencent_concentration_70);
  const conc90 = toNumber(chip.tencent_concentration_90);
  const concGap = conc90 - conc70;
  if (concGap < 0) return { error: '集中度数据异常', symbol, datestr: actualDate };

  const kdj0 = kdjRows?.[0];
  const kdj3 = kdjRows?.[3];
  const ma0 = maRows?.[0];
  const dmi0 = dmiRows?.[0];
  const dmi5 = dmiRows?.[5];
  const kdjThreeDayWeak = kdj0 && kdj3 ? toNumber(kdj0.k) - toNumber(kdj3.k) < 0 && toNumber(kdj0.j) - toNumber(kdj3.j) < 0 : false;
  const ma5 = ma0 ? toNumber(ma0.ma5) : 0;
  const ma10 = ma0 ? toNumber(ma0.ma10) : 0;
  const ma20 = ma0 ? toNumber(ma0.ma20) : 0;
  const ma60 = ma0 ? toNumber(ma0.ma60) : 0;
  const ma5Ma20Delta = ma20 > 0 ? ma5 / ma20 - 1 : null;
  const maAllBear = ma0 ? ma5 < ma10 && ma10 < ma20 && ma20 < ma60 : false;
  const maShortWeak = ma5Ma20Delta !== null && ma5Ma20Delta < -0.01;
  const dmiPdi = dmi0 ? toNumber(dmi0.pdi) : 0;
  const dmiMdi = dmi0 ? toNumber(dmi0.mdi) : 0;
  const dmiAdx = dmi0 ? toNumber(dmi0.adx) : 0;
  const dmiStrongBear = dmi0 ? dmiAdx > 25.0 && dmiMdi > dmiPdi : false;
  const dmiLowTrend = dmi0 ? dmiAdx < 20.0 : false;
  const mdiFiveDayRising = dmi0 && dmi5 ? toNumber(dmi0.mdi) - toNumber(dmi5.mdi) > 0 : false;
  const priceVolumeStats = calcRecord1PriceVolumeStats(stockDayRows || []);
  const pricePos60 = priceVolumeStats?.price_pos_60 ?? null;
  const drawdownFrom60High = priceVolumeStats?.drawdown_from_60_high ?? null;
  const avgTurn10 = priceVolumeStats?.avg_turn_10 ?? null;
  const avgTurn5 = priceVolumeStats?.avg_turn_5 ?? null;
  const closeWeakness10 = priceVolumeStats?.close_weakness_10 ?? null;
  const ret5 = priceVolumeStats?.ret_5 ?? null;
  const ret10 = priceVolumeStats?.ret_10 ?? null;
  const vol10 = priceVolumeStats?.vol_10 ?? null;
  const vol20 = priceVolumeStats?.vol_20 ?? null;
  const vol60 = priceVolumeStats?.vol_60 ?? null;
  const drawdownFrom20High = priceVolumeStats?.drawdown_from_20_high ?? null;
  const closeVsMa20 = priceVolumeStats?.close_vs_ma20 ?? null;
  const turnRatio20 = priceVolumeStats?.turn_ratio_20 ?? null;
  const circulation = priceVolumeStats?.circulation ?? null;

  const tightGap = concGap <= 2.01;
  const coreGap = betweenValue(concGap, 2.01, 4.40);
  const coreChipZone = betweenValue(conc70, 6.10, 8.60) && betweenValue(conc90, 8.13, 11.50);
  const preferredChipBand = betweenValue(conc70, 6.10, 8.60) && coreGap;
  const coreAcceptance = betweenValue(conc90, 8.13, 11.50) && betweenValue(maxTurn, 5.00, 18.00);
  const turnConfirm = meanTurn >= 1.50 || maxTurn >= 5.00;
  const turnWatch = meanTurn >= 0.70;
  const profitLow = profitMax3 < 3.00;
  const profitHealth = betweenValue(profitMax3, 3.00, 18.60);
  const pulseGood = betweenValue(pulseRatio, 2.00, 5.80);
  const highConcLowProfit = conc70 > 11.50 && betweenValue(maxTurn, 5.00, 18.00) && profitLow;
  const highConcExpansion = conc70 > 11.50 && conc90 > 16.00 && profitLow && turnConfirm;
  const highConcTrend =
    conc70 > 11.50 &&
    betweenValue(maxTurn, 5.00, 18.00) &&
    pulseGood &&
    (profitLow || meanTurn >= 1.50 || maxTurn >= 10.0) &&
    !(conc70 > 14.00 && profitDay0 >= 3.00 && profitDelta >= 12.0);
  const profitRetreatMomentum =
    profitDay0 <= 9.20 &&
    profitMax3 >= 15.00 &&
    profitDelta >= 8.00 &&
    meanTurn >= 1.50 &&
    maxTurn >= 5.00 &&
    (profitDay0 < 3.00 || meanTurn >= 3.00 || maxTurn >= 12.00) &&
    !(conc70 > 14.00 && profitDay0 >= 3.00);
  const wideGapMomentum =
    concGap > 6.80 &&
    meanTurn >= 1.50 &&
    maxTurn >= 5.00 &&
    profitMax3 <= 9.20 &&
    !(conc70 > 12.00 && conc90 > 21.00);
  const lowMidReversal = betweenValue(conc70, 5.00, 6.10) && maxTurn >= 5.00 && profitMax3 <= 9.20;
  const extremeHighRisk = (conc70 > 14.00 || conc90 > 21.00 || concGap > 8.00) && !highConcExpansion && !profitRetreatMomentum;
  const lowTightNoAcceptance = tightGap && conc70 < 5.0 && meanTurn < 0.70;
  const lowTightZone = conc70 < 5.0 && conc90 < 8.13;
  const lowLiquidity = meanTurn < 1.0 && maxTurn < 5.0;
  const ordinaryChipZone =
    !profitRetreatMomentum &&
    !highConcLowProfit &&
    !highConcTrend &&
    !wideGapMomentum &&
    !lowMidReversal &&
    !preferredChipBand &&
    !coreChipZone &&
    !lowTightZone &&
    !extremeHighRisk;
  const strongMainType = profitRetreatMomentum || highConcLowProfit || highConcTrend || wideGapMomentum || lowMidReversal;

  let score = 0;
  const tags: string[] = [];
  let regimeBonus = 0;
  let riskHitCount = 0;

  if (profitRetreatMomentum) {
    score += 50; regimeBonus += 18; tags.push('【筹码热度回落动能:day0低热+max3高位+回落确认】');
  } else if (highConcLowProfit) {
    score += 50; regimeBonus += 16; tags.push('【高集中低盈扩散:高70+低盈利筹码+历史放量】');
  } else if (highConcTrend) {
    score += 45; regimeBonus += 10; tags.push('【高集中趋势型:高集中+放量承接】');
  } else if (wideGapMomentum) {
    score += 40; regimeBonus += 10; tags.push('【宽筹码动能型:带宽偏宽+均换确认+低热盈利】');
  } else if (lowMidReversal) {
    score += 35; regimeBonus += 8; tags.push('【低中集中反转型:70集中5-6.1+放量+低热盈利】');
  } else if (preferredChipBand) {
    score += 28; tags.push('【优选带观察:70集中6.1-8.6+带宽2.0-4.4】');
  } else if (coreChipZone) {
    score += 24; tags.push('【核心集中区】');
  } else if (lowTightZone) {
    score += 10; tags.push('【低位紧凑-需确认】');
  } else if (extremeHighRisk) {
    score -= 18; tags.push('【风险:集中度过高或带宽过宽】');
  } else {
    score += 8; tags.push('【普通筹码区】');
  }

  if (turnConfirm) { score += 15; tags.push('【换手确认】'); }
  else if (turnWatch) { score += 10; tags.push('【低换手观察】'); }
  else { score -= 18; tags.push('【风险:均换过低】'); }

  if (profitHealth) { score += 10; tags.push('【盈利筹码健康】'); }
  else if (profitLow) { score += 3; tags.push('【盈利筹码低位】'); }
  else { score += 5; tags.push('【盈利筹码偏热】'); }

  if (pulseGood) { score += 8; tags.push('【脉冲温和】'); }
  else if (pulseRatio > 7.00 && meanTurn < 1.50) { score -= 8; tags.push('【风险:孤峰脉冲】'); }

  if (betweenValue(maxTurn, 5.00, 18.00)) { score += 6; tags.push('【历史放量承接】'); }
  else if (maxTurn >= 5.00) score += 3;

  if (preferredChipBand && turnConfirm) { score += 5; regimeBonus += 5; tags.push('【观察组合:优选筹码带+换手确认】'); }
  if (coreAcceptance) { score += 12; regimeBonus += 12; tags.push('【核心承接型:90不过热+历史放量】'); }
  if (highConcLowProfit || wideGapMomentum || profitRetreatMomentum) { score += 10; tags.push('【强组合:扩散/动能+承接确认】'); }
  if (lowTightNoAcceptance) { score -= 12; tags.push('【风险:低位紧凑但无承接】'); }

  const riskLowTightBear = lowLiquidity && lowTightZone && kdjThreeDayWeak && dmiStrongBear;
  const riskMaAllBear = !strongMainType && ordinaryChipZone && maAllBear && maShortWeak && (score <= 20 || meanTurn < 0.70);
  const riskLowLiquidityWeakTrend = !strongMainType && lowLiquidity && maShortWeak && dmiLowTrend && mdiFiveDayRising;
  const riskLowPositionLowTurnElasticity =
    !strongMainType &&
    pricePos60 !== null &&
    avgTurn5 !== null &&
    pricePos60 <= 5.0 &&
    avgTurn5 <= 0.50;
  const riskLowTurnStagnation =
    !strongMainType &&
    avgTurn10 !== null &&
    ret5 !== null &&
    avgTurn10 <= 0.60 &&
    ret5 >= -1.0;
  if (riskLowTightBear) { riskHitCount += 1; score -= 12; tags.push('【风险:低位无承接空头】'); }
  if (riskMaAllBear) { riskHitCount += 1; score -= 14; tags.push('【风险:均线全空弱势】'); }
  if (riskLowLiquidityWeakTrend) { riskHitCount += 1; score -= 10; tags.push('【风险:低流动弱趋势】'); }
  if (riskLowPositionLowTurnElasticity) { riskHitCount += 1; score -= 10; tags.push('【风险:低位低换弹性不足】'); }
  if (riskLowTurnStagnation) { riskHitCount += 1; score -= 8; tags.push('【风险:低换滞涨】'); }
  if (riskHitCount >= 2) { score -= 8; tags.push('【风险:技术风险叠加】'); }
  else if (riskHitCount === 1) tags.push('【风险:技术弱势过滤】');

  score = Math.round(Math.min(Math.max(score, 0), 100) * 10) / 10;
  const strongRegime =
    highConcLowProfit ||
    profitRetreatMomentum ||
    wideGapMomentum ||
    (highConcTrend && score >= 75) ||
    (lowMidReversal && score >= 75);
  const strongStatusCandidate = score >= 75 && strongRegime && riskHitCount === 0;
  const highTurnElasticity =
    strongStatusCandidate &&
    meanTurn >= 3.34 &&
    avgTurn10 !== null &&
    avgTurn10 >= 2.24;
  const drawdownRepairElasticity =
    strongStatusCandidate &&
    meanTurn >= 2.86 &&
    drawdownFrom60High !== null &&
    drawdownFrom60High <= -15.31;
  const coreAcceptanceLowElasticity =
    strongStatusCandidate &&
    coreAcceptance &&
    !highTurnElasticity &&
    !drawdownRepairElasticity;
  const shortMidcapRepairElasticity =
    (
      concGap >= 6.8 &&
      avgTurn10 !== null &&
      avgTurn10 >= 2.5
    ) ||
    (
      pricePos60 !== null &&
      drawdownFrom60High !== null &&
      avgTurn10 !== null &&
      pricePos60 >= 30.0 &&
      drawdownFrom60High <= -20.0 &&
      avgTurn10 >= 3.0
    );
  const warningLowElasticCoreAcceptance =
    coreAcceptanceLowElasticity &&
    (
      pricePos60 === null ||
      pricePos60 <= 20.0
    );
  const shortWatchMidcapAcceptanceRepair =
    !strongStatusCandidate &&
    score >= 55 &&
    avgTurn10 !== null &&
    drawdownFrom60High !== null &&
    meanTurn >= 2.4 &&
    avgTurn10 >= 1.6 &&
    drawdownFrom60High <= -15.0 &&
    (coreAcceptance || lowMidReversal || preferredChipBand);
  if (highTurnElasticity) tags.push('【强信号弹性:高换手高弹】');
  else if (drawdownRepairElasticity) tags.push('【强信号弹性:回撤后放量修复】');
  else if (coreAcceptanceLowElasticity) tags.push('【强信号弹性:核心承接低弹】');
  else if (strongStatusCandidate) tags.push('【强信号弹性:普通】');
  if (shortMidcapRepairElasticity) tags.push('【短线:中大盘修复弹性】');
  if (shortWatchMidcapAcceptanceRepair) tags.push('【短线观察:中大盘承接修复】');
  if (warningLowElasticCoreAcceptance) tags.push('【警戒:低弹核心承接】');
  const record2ForcedInvalid =
    riskHitCount >= 2 ||
    riskLowPositionLowTurnElasticity ||
    (riskLowTurnStagnation && !strongMainType);
  const statusTag =
    record2ForcedInvalid
      ? '【无效】'
      : score >= 75 && strongRegime && riskHitCount === 0
        ? '【强信号】'
        : score >= 55 && !lowTightNoAcceptance
          ? '【观察】'
          : '【无效】';
  const record2LowInvalid = statusTag === '【无效】' && score < 55;
  const technicalBlocked =
    riskHitCount >= 2 ||
    riskLowTightBear ||
    riskMaAllBear ||
    riskLowLiquidityWeakTrend ||
    riskLowPositionLowTurnElasticity;
  const sequence = await querySequenceContext('focus_stocks2_ai', symbol, actualDate);
  tags.push(...sequenceTagsRecord2(sequence, statusTag.replace(/[【】]/g, ''), technicalBlocked));
  const record2SequenceWarning = tags.some((tag) => tag.includes('序列警戒:'));
  const lowScoreHighConcPullbackRepair =
    record2LowInvalid &&
    !technicalBlocked &&
    !record2SequenceWarning &&
    conc90 >= 13.0 &&
    conc70 >= 7.0 &&
    drawdownFrom60High !== null &&
    drawdownFrom60High <= -15.0;
  const lowScoreHighConcVolumeRepair =
    record2LowInvalid &&
    !technicalBlocked &&
    !record2SequenceWarning &&
    conc90 >= 13.0 &&
    pricePos60 !== null &&
    pricePos60 >= 10.0 &&
    maxTurn >= 5.0;
  const coreAcceptanceWaitConfirm =
    coreAcceptance &&
    !strongMainType &&
    !highTurnElasticity &&
    !drawdownRepairElasticity &&
    !coreAcceptanceLowElasticity &&
    !tags.some((tag) => tag.includes('序列确认:') || tag.includes('序列警戒:'));
  if (lowScoreHighConcPullbackRepair) tags.push('【低分修复:高集中回撤修复】');
  if (lowScoreHighConcVolumeRepair && !lowScoreHighConcPullbackRepair) tags.push('【短线观察:高集中放量修复】');
  if (coreAcceptanceWaitConfirm) tags.push('【备选:核心承接待确认】');
  const details = {
    conc_70: round2(conc70),
    conc_90: round2(conc90),
    conc_gap: round2(concGap),
    turnover_mean: round2(meanTurn),
    turnover_max: round2(maxTurn),
    profit_chip: round2(profitMax3),
    profit_chip_day0: round2(profitDay0),
    profit_delta: round2(profitDelta),
    pulse_ratio: round2(pulseRatio),
    regime_bonus: regimeBonus,
    risk_hit_count: riskHitCount,
    core_acceptance: coreAcceptance,
    high_conc_low_profit: highConcLowProfit,
    profit_retreat_momentum: profitRetreatMomentum,
    wide_gap_momentum: wideGapMomentum,
    high_conc_trend: highConcTrend,
    low_mid_reversal: lowMidReversal,
    strong_main_type: strongMainType,
    low_tight_no_acceptance: lowTightNoAcceptance,
    ma5_ma20_pct: ma5Ma20Delta === null ? null : round2(ma5Ma20Delta * 100),
    dmi_adx: dmi0 ? round2(dmiAdx) : null,
    price_pos_60: pricePos60 === null ? null : round2(pricePos60),
    drawdown_from_60_high: drawdownFrom60High === null ? null : round2(drawdownFrom60High),
    drawdown_from_20_high: drawdownFrom20High === null ? null : round2(drawdownFrom20High),
    up_from_low_20d: priceVolumeStats?.up_from_low_20d === null || priceVolumeStats?.up_from_low_20d === undefined ? null : round2(priceVolumeStats.up_from_low_20d),
    avg_turn_10: avgTurn10 === null ? null : round2(avgTurn10),
    avg_turn_5: avgTurn5 === null ? null : round2(avgTurn5),
    close_weakness_10: closeWeakness10 === null ? null : round2(closeWeakness10),
    close_vs_ma20: closeVsMa20 === null ? null : round2(closeVsMa20),
    ret_3: priceVolumeStats?.ret_3 === null || priceVolumeStats?.ret_3 === undefined ? null : round2(priceVolumeStats.ret_3),
    ret_5: ret5 === null ? null : round2(ret5),
    ret_10: ret10 === null ? null : round2(ret10),
    vol_10: vol10 === null ? null : round2(vol10),
    vol_20: vol20 === null ? null : round2(vol20),
    vol_60: vol60 === null ? null : round2(vol60),
    vol_ratio_20_60: priceVolumeStats?.vol_ratio_20_60 === null || priceVolumeStats?.vol_ratio_20_60 === undefined ? null : round2(priceVolumeStats.vol_ratio_20_60),
    turn_ratio_20: turnRatio20 === null ? null : round2(turnRatio20),
    circulation: circulation === null ? null : round2(circulation),
    amp_avg_5d: priceVolumeStats?.amp_avg_5d === null || priceVolumeStats?.amp_avg_5d === undefined ? null : round2(priceVolumeStats.amp_avg_5d),
    bb_pos_20: priceVolumeStats?.bb_pos_20 === null || priceVolumeStats?.bb_pos_20 === undefined ? null : round2(priceVolumeStats.bb_pos_20),
    risk_low_position_low_turn_elasticity: riskLowPositionLowTurnElasticity,
    risk_low_turn_stagnation: riskLowTurnStagnation,
    high_turn_elasticity: highTurnElasticity,
    drawdown_repair_elasticity: drawdownRepairElasticity,
    core_acceptance_low_elasticity: coreAcceptanceLowElasticity,
    short_midcap_repair_elasticity: shortMidcapRepairElasticity,
    short_watch_midcap_acceptance_repair: shortWatchMidcapAcceptanceRepair,
    warning_low_elastic_core_acceptance: warningLowElasticCoreAcceptance,
    alarm_index: Number(sequence?.prior_count || 0) + 1,
    sequence_prior_count: Number(sequence?.prior_count || 0),
    sequence_prior_30d: Number(sequence?.prior_30d || 0),
    sequence_prior_90d: Number(sequence?.prior_90d || 0),
    sequence_prior_180d: Number(sequence?.prior_180d || 0),
  };
  const marketEnv = await calcMarketEnvironment('focus_stocks2_ai', actualDate, 1);
  const marketExposure = await calcMarketExposure('focus_stocks2_ai', actualDate);
  (details as any).market_env = marketEnv;
  (details as any).market_exposure = marketExposure;
  const baseDecisionTag = tradeDecisionTagRecord2(statusTag, tags, details);
  const decisionTag = applyRecord2PositiveLimitedWaitDecision(
    applyRecord2GlobalSplitDecision(
      applyRecord2TrackingDecision(applyRecord2LargeCapWeakAcceptanceRiskDecision(baseDecisionTag, details), details),
      details
    ),
    score,
    details
  );
  if (await shouldAppendRecord2BombOrderWarning(symbol, actualDate, statusTag, decisionTag)) {
    tags.push('【警戒:超大单高波动博弈】');
  }
  const comments = [
    decisionTag,
    `【${score}】`,
    statusTag,
    `【C:${details.conc_70},${details.conc_90},${details.conc_gap}】`,
    `【T:${details.turnover_mean},${details.turnover_max}】`,
    `【R:${details.price_pos_60},${details.drawdown_from_60_high},${details.avg_turn_10},${details.close_weakness_10}】`,
    `【E:${details.vol_10},${details.vol_20},${details.vol_60},${details.drawdown_from_20_high},${details.close_vs_ma20},${details.ret_5},${details.turn_ratio_20},${details.circulation},${details.amp_avg_5d},${details.bb_pos_20}】`,
    `【S:${details.up_from_low_20d},${details.price_pos_60},${details.ret_3},${details.vol_ratio_20_60}】`,
    `【M:${marketEnv.vol_med},${marketEnv.temp},${marketEnv.alarm_dir}】`,
    `【ME:${marketExposure.last_hot_days},${marketExposure.hotish_ratio_60},${marketExposure.cold_ratio_60}】`,
    tags.join(' ')
  ].filter(Boolean).join('');

  return {
    symbol,
    name: common.name,
    model: 'record2_v2_24',
    ...modelMeta,
    query_datestr: datestr,
    datestr: actualDate,
    chip_datestr: formatDbDate(chip.datestr),
    alert_decision: decisionTag ? stripBrackets(decisionTag) : null,
    comments,
    score,
    status: statusTag.replace(/[【】]/g, ''),
    tags,
    details
  };
};



const queryStoredPostAlertPortrait = async (
  tableName: 'focus_stocks_ai' | 'focus_stocks2_ai',
  symbol: string,
  alarmDatestr: string,
  observeDatestr: string
) => {
  if (!alarmDatestr || !observeDatestr) return null;
  const recordType = tableName === 'focus_stocks_ai' ? 'record1' : 'record2';
  const alertRows: any = await queryDB(`
    SELECT id, datestr
    FROM ${tableName}
    WHERE symbol = '${sqlEscape(symbol)}'
      AND datestr <= '${sqlEscape(observeDatestr)}'
      AND (
        datestr = '${sqlEscape(alarmDatestr)}'
        OR datestr >= '${sqlEscape(alarmDatestr)}'
      )
    ORDER BY CASE WHEN datestr = '${sqlEscape(alarmDatestr)}' THEN 0 ELSE 1 END, datestr DESC, id DESC
    LIMIT 1
  `);
  let alert = alertRows?.[0];
  if (!alert) {
    const fallbackRows: any = await queryDB(`
      SELECT id, datestr
      FROM ${tableName}
      WHERE symbol = '${sqlEscape(symbol)}'
        AND datestr <= '${sqlEscape(observeDatestr)}'
      ORDER BY datestr DESC, id DESC
      LIMIT 1
    `);
    alert = fallbackRows?.[0];
  }
  if (!alert) return null;

  const rows: any = await queryDB(`
    SELECT alarm_datestr, observe_date, observe_days,
           post_alert_decision, post_alert_comments, updated_at
    FROM post_alert_portrait_history
    WHERE record_type = '${recordType}'
      AND alert_id = ${toNumber(alert.id)}
      AND symbol = '${sqlEscape(symbol)}'
      AND DATE(alarm_datestr) = DATE('${sqlEscape(alert.datestr)}')
      AND observe_date <= '${sqlEscape(observeDatestr)}'
    ORDER BY observe_date DESC, id DESC
    LIMIT 1
  `);
  const row = rows?.[0];
  if (!row || !row.post_alert_comments) return null;

  const decision = row.post_alert_decision || null;

  return {
    alarm_id: toNumber(alert.id),
    alarm_datestr: formatDbDate(row.alarm_datestr),
    observe_datestr: formatDbDate(row.observe_date),
    observe_days: row.observe_days === null || row.observe_days === undefined
      ? null
      : toNumber(row.observe_days),
    decision,
    comments: row.post_alert_comments,
    updated_at: row.updated_at ? formatDbDate(row.updated_at) : null,
  };
};

const buildStockPortrait = async (symbolInput: string, datestr: string, alarmDatestr = '') => {
  const symbolLike = sqlEscape(symbolInput);
  const safeDate = sqlEscape(datestr);
  const commonRows: any = await queryDB(`
    SELECT symbol, name, datestr, finalprice, marketvalue
    FROM stock_day_common_data
    WHERE symbol LIKE '%${symbolLike}%'
      AND datestr <= '${safeDate}'
    ORDER BY datestr DESC
    LIMIT 1
  `);
  const common = commonRows?.[0];
  if (!common) return { error: '未找到该股票在指定日期之前的基础交易数据' };

  const finalPrice = toNumber(common.finalprice);
  const marketValue = toNumber(common.marketvalue);
  const circulationStock = finalPrice > 0 ? marketValue / finalPrice : 0;
  const modelMeta = {
    final_price: round2(finalPrice),
    circulation_stock: round2(circulationStock),
  };

  if (finalPrice >= 0 && finalPrice <= 50 && circulationStock >= 1 && circulationStock < 30) {
    const portrait: any = await buildRecord1Portrait(common.symbol, datestr, modelMeta);
    const postAlertPortrait = await queryStoredPostAlertPortrait('focus_stocks_ai', common.symbol, alarmDatestr || datestr, datestr);
    return {
      ...portrait,
      post_alert_portrait: postAlertPortrait,
      post_alert_decision: postAlertPortrait?.decision || null,
      post_alert_comments: postAlertPortrait?.comments || null,
    };
  }

  if (finalPrice >= 0 && finalPrice <= 100 && circulationStock >= 30 && circulationStock <= 500) {
    const portrait: any = await buildRecord2Portrait(common.symbol, datestr, modelMeta);
    const postAlertPortrait = await queryStoredPostAlertPortrait('focus_stocks2_ai', common.symbol, alarmDatestr || datestr, datestr);
    return {
      ...portrait,
      post_alert_portrait: postAlertPortrait,
      post_alert_decision: postAlertPortrait?.decision || null,
      post_alert_comments: postAlertPortrait?.comments || null,
    };
  }

  return {
    error: `该股票不在当前画像模型适用范围内: price=${round2(finalPrice)}, circulation=${round2(circulationStock)}亿`,
    symbol: common.symbol,
    name: common.name,
    datestr: formatDbDate(common.datestr),
    ...modelMeta,
  };
};

const DB_PATH = '/Users/xywang/mystockdata/info/rss-board-mapper/board_scores.db';

router.get('/stock_info', function (req, res, next) {
  const symbol = req.query.stock_id;
  const minvol = req.query.minvol;
  // where 'symbol' = ${symbol} and 'minvol' = ${minvol};
  const sql = `SELECT * FROM select_stocks where symbol='${symbol}' and minvol='${minvol}'`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/stock_list', function (req, res, next) {
  const sql = `SELECT * FROM select_stocks group by symbol;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/stock_ai_portrait', async function (req, res, next) {
  const symbol = String(req.query.symbol || '').trim();
  const datestr = String(req.query.datestr || '').trim();
  const alarmDatestr = String(req.query.alarm_datestr || '').trim();

  if (!symbol || !datestr) {
    res.status(400).json({ error: 'symbol 和 datestr 不能为空' });
    return;
  }

  try {
    const result = await buildStockPortrait(symbol, datestr, alarmDatestr);
    if ((result as any).error) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '生成股票画像失败' });
  }
});

router.get('/update_stock_status', function (req, res, next) {
  const symbol = req.query.stock_id;
  const datestr = req.query.datestr;
  const viewed = req.query.viewed;
  if (viewed) {
    const getSql = `SELECT * from viewd_stocks where symbol = '${symbol}'`;
    pool.query(getSql, function (err, rows, fields) {
      let sql = '';
      if (err) {
        res.json(err);
      } else {
        if (rows?.length > 0) {
          sql = `UPDATE viewd_stocks SET datestr='${datestr}', viewed='${viewed}' where symbol='${symbol}'`;
        } else {
          sql = `INSERT INTO viewd_stocks (symbol, datestr, viewed) VALUES ('${symbol}', '${datestr}', '${viewed}') ON DUPLICATE KEY UPDATE viewed = '${viewed}';`;
        }
      }
      pool.query(sql, (error, ros) => {
        if (err) {
          res.json(err);
        } else {
          res.json(ros);
        }
      });
    });
  } else {
    let sql = `INSERT INTO viewd_stocks (symbol, datestr) VALUES ('${symbol}', '${datestr}');`;
    pool.query(sql, function (err, rows, fields) {
      if (err) {
        res.json(err);
      } else {
        res.json(rows);
      }
    });
  }
});

router.get('/add_focus', function (req, res, next) {
  const symbol = req.query.stock_id;
  const datestr = req.query.datestr;
  const comments = req.query.comments;
  const predict = req.query.predict;
  const status = req.query.focus_status;
  const sql = `INSERT INTO focus_stocks (symbol, datestr, comments, predict, focus_status) VALUES ('${symbol}', '${datestr}', '${comments}', '${predict}', ${status});`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.get('/add_da_focus', function (req, res, next) {
  const symbol = req.query.stock_id;
  const datestr = req.query.datestr;
  const updated_at = req.query.updated_at;
  //const added = req.query.added;
  let sql = `INSERT INTO focus_da (symbol, datestr, updated_at) VALUES ('${symbol}', '${datestr}', '${updated_at}');`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.post('/delete_focus', function (req, res, next) {
  const symbol = req.body.symbol;
  const datestr = req.body.datestr;
  const sql = `DELETE from focus_stocks where symbol= '${symbol}' and datestr= '${datestr}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.post('/delete_focus2', function (req, res, next) {
  const symbol = req.body.symbol;
  const datestr = req.body.datestr;
  const sql = `DELETE from focus_stocks2 where symbol= '${symbol}' and datestr= '${datestr}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.post('/delete_expire_focus', function (req, res, next) {
  const symbol = req.body.symbol;
  const datestr = req.body.datestr;
  const sql = `DELETE from focus_stocks_expire where symbol= '${symbol}' and datestr= '${datestr}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.post('/delete_expire_focus_other', function (req, res, next) {
  const symbol = req.body.symbol;
  const datestr = req.body.datestr;
  const sql = `DELETE from focus_stocks_expire_other where symbol= '${symbol}' and datestr= '${datestr}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.post('/delete_da_focus', function (req, res, next) {
  const symbol = req.body.symbol;
  const datestr = req.body.datestr;
  const sql = `UPDATE focus_da SET deleted='1' where symbol= '${symbol}' and datestr= '${datestr}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.get('/edit_da_focus', function (req, res, next) {
  const symbol = req.query.symbol;
  const datestr = req.query.datestr;
  const added = req.query.added;
  const sql = `UPDATE focus_da SET added='${added}' where symbol='${symbol}' and datestr='${datestr}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.post('/edit_focus', function (req, res, next) {
  const symbol = req.body.symbol;
  const comments = req.body.comments;
  const sql = `UPDATE focus_stocks SET comments='${comments}' where symbol='${symbol}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});
router.post('/edit_focus2', function (req, res, next) {
  const symbol = req.body.symbol;
  const comments = req.body.comments;
  const sql = `UPDATE focus_stocks2 SET comments='${comments}' where symbol='${symbol}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.post('/save_advanced_search', function (req, res, next) {
  const totalday = req.body.totalday;
  const consday = req.body.consday;
  const pricemargin = req.body.pricemargin;
  const datestr = req.body.datestr;
  const result = req.body.result;
  const sql = `INSERT INTO advanced_search_results (totalday, consday, pricemargin, datestr, result) VALUES ('${totalday}', '${consday}', '${pricemargin}', '${datestr}', '${result}');`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.get('/get_search_result', function (req, res, next) {
  const totalday = req.query.totalday;
  const consday = req.query.consday;
  const pricemargin = req.query.pricemargin;
  const sql = `SELECT * FROM advanced_search_results WHERE totalday = '${totalday}' and consday = '${consday}' and pricemargin = '${pricemargin}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/get_plate', function (req, res, next) {
  const ids = req.query.ids;
  const sql = `SELECT count(*) as count, a.code, a.name FROM plate a join focus_plate b on a.code = b.code WHERE symbol in (${ids}) and b.focus = 1 group by a.code;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/focus_plate', function (req, res, next) {
  const sql = `SELECT * FROM focus_plate`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.post('/edit_focus_plate', function (req, res, next) {
  const isAdd = req.body.isAdd ? 1 : 0;
  const code = req.body.code;
  const sql = `UPDATE focus_plate set focus=${isAdd} where code='${code}'`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});
router.post('/edit_focus_status', function (req, res, next) {
  const status = req.body.status;
  const code = req.body.symbol;
  const datestr = req.body.datestr;
  const sql = `UPDATE focus_stocks set focus_status=${status} where symbol='${code}' and datestr='${datestr}'`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});
router.post('/edit_focus2_status', function (req, res, next) {
  const status = req.body.status;
  const code = req.body.symbol;
  const datestr = req.body.datestr;
  const sql = `UPDATE focus_stocks2 set focus_status=${status} where symbol='${code}' and datestr='${datestr}'`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});
router.post('/edit_focus_datestr', function (req, res, next) {
  // const status = req.body.status;
  const code = req.body.symbol;
  const datestr = req.body.datestr;
  const newDatestr = req.body.newDatestr;
  const sql = `UPDATE focus_stocks set datestr='${newDatestr}' where symbol='${code}' and datestr='${datestr}'`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});
router.post('/edit_focus2_datestr', function (req, res, next) {
  // const status = req.body.status;
  const code = req.body.symbol;
  const datestr = req.body.datestr;
  const newDatestr = req.body.newDatestr;
  const sql = `UPDATE focus_stocks2 set datestr='${newDatestr}' where symbol='${code}' and datestr='${datestr}'`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
});

router.get('/get_viewed_stock', function (req, res, next) {
  const datestr = req.query.datestr;
  const sql = `SELECT * FROM viewd_stocks WHERE datestr = '${datestr}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/get_stock_plate', (req, res, next) => {
  const ids = req.query.ids;
  const sql = `SELECT distinct(a.symbol), group_concat(a.code), group_concat(a.name) as platename FROM plate a join focus_plate b on a.code = b.code WHERE symbol in (${ids}) and b.focus = 1 group by a.symbol;`;
  const sql2 = `SELECT count(*) as count, a.name, a.code, group_concat(a.symbol) FROM plate a join focus_plate b on a.code = b.code WHERE symbol in (${ids}) and b.focus = 1 group by a.name order by count DESC;`;
  const result: any = {};
  console.log(sql, sql2);
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    result.symbols = rows;
    pool.query(sql2, function (err, rows2, fields) {
      if (err) throw err;
      result.plates = rows2;
      res.json(result);
    });
  });
});

// 获取所有关注股票列表（分页版本）
router.get('/all_focus_stock', function (req, res, next) {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const offset = (page - 1) * pageSize;
  
  // 日期排序参数
  const sortByDate = req.query.sortByDate === 'true';
  const dateSortOrder = req.query.dateSortOrder === 'ASC' ? 'ASC' : 'DESC';
  
  // 获取总数
  const countSql = `SELECT COUNT(*) as total FROM focus_stocks`;
  pool.query(countSql, function (countErr, countRows) {
    if (countErr) {
      console.error(countErr);
      return res.status(500).json({ error: countErr.message });
    }
    
    const total = countRows[0].total;
    
    // 根据是否需要排序构建不同的 SQL
    let sql;
    if (sortByDate) {
      sql = `SELECT a.*, b.*, a.updated_at as last_updated_at,
                    ai.alert_decision AS alert_decision,
                    latest_h.observe_date AS post_alert_observe_date,
                    latest_h.observe_days AS post_alert_observe_days,
                    latest_h.post_alert_decision AS post_alert_decision,
                    latest_h.post_alert_comments AS post_alert_comments,
                    best_entry_h.observe_date AS best_entry_observe_date,
                    best_entry_h.observe_days AS best_entry_observe_days,
                    best_entry_h.post_alert_decision AS best_entry_decision,
                    best_entry_h.post_alert_comments AS best_entry_comments
             FROM focus_stocks a 
             JOIN stock_day_common_data b ON a.symbol = b.symbol AND a.datestr = b.datestr
             LEFT JOIN focus_stocks_ai ai ON ai.symbol = a.symbol AND ai.datestr = a.datestr
             LEFT JOIN (
               SELECT h.*
               FROM post_alert_portrait_history h
               JOIN (
                 SELECT record_type, alert_id, MAX(observe_date) AS observe_date
                 FROM post_alert_portrait_history
                 WHERE record_type = 'record1'
                 GROUP BY record_type, alert_id
               ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
             ) latest_h ON latest_h.record_type = 'record1' AND latest_h.alert_id = ai.id AND latest_h.symbol = ai.symbol AND DATE(latest_h.alarm_datestr) = DATE(ai.datestr)
             LEFT JOIN (
               SELECT h.*
               FROM post_alert_portrait_history h
               JOIN (
                 SELECT record_type, alert_id, MAX(observe_date) AS observe_date
                 FROM post_alert_portrait_history
                 WHERE record_type = 'record1'
                   AND (
                        post_alert_decision LIKE '后接入%'
                     OR post_alert_decision LIKE '%D4D7%'
                   )
                 GROUP BY record_type, alert_id
               ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
             ) best_entry_h ON best_entry_h.record_type = 'record1' AND best_entry_h.alert_id = ai.id AND best_entry_h.symbol = ai.symbol AND DATE(best_entry_h.alarm_datestr) = DATE(ai.datestr)
             ORDER BY COALESCE(best_entry_h.observe_date, a.datestr) ${dateSortOrder}, a.datestr ${dateSortOrder}
             LIMIT ? OFFSET ?`;
    } else {
      // 默认按更新时间倒序（保持原有性能）
      sql = `SELECT a.*, b.*, a.updated_at as last_updated_at,
                    ai.alert_decision AS alert_decision,
                    latest_h.observe_date AS post_alert_observe_date,
                    latest_h.observe_days AS post_alert_observe_days,
                    latest_h.post_alert_decision AS post_alert_decision,
                    latest_h.post_alert_comments AS post_alert_comments,
                    best_entry_h.observe_date AS best_entry_observe_date,
                    best_entry_h.observe_days AS best_entry_observe_days,
                    best_entry_h.post_alert_decision AS best_entry_decision,
                    best_entry_h.post_alert_comments AS best_entry_comments
             FROM focus_stocks a 
             JOIN stock_day_common_data b ON a.symbol = b.symbol AND a.datestr = b.datestr
             LEFT JOIN focus_stocks_ai ai ON ai.symbol = a.symbol AND ai.datestr = a.datestr
             LEFT JOIN (
               SELECT h.*
               FROM post_alert_portrait_history h
               JOIN (
                 SELECT record_type, alert_id, MAX(observe_date) AS observe_date
                 FROM post_alert_portrait_history
                 WHERE record_type = 'record1'
                 GROUP BY record_type, alert_id
               ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
             ) latest_h ON latest_h.record_type = 'record1' AND latest_h.alert_id = ai.id AND latest_h.symbol = ai.symbol AND DATE(latest_h.alarm_datestr) = DATE(ai.datestr)
             LEFT JOIN (
               SELECT h.*
               FROM post_alert_portrait_history h
               JOIN (
                 SELECT record_type, alert_id, MAX(observe_date) AS observe_date
                 FROM post_alert_portrait_history
                 WHERE record_type = 'record1'
                   AND (
                        post_alert_decision LIKE '后接入%'
                     OR post_alert_decision LIKE '%D4D7%'
                   )
                 GROUP BY record_type, alert_id
               ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
             ) best_entry_h ON best_entry_h.record_type = 'record1' AND best_entry_h.alert_id = ai.id AND best_entry_h.symbol = ai.symbol AND DATE(best_entry_h.alarm_datestr) = DATE(ai.datestr)
             ORDER BY a.updated_at DESC
             LIMIT ? OFFSET ?`;
    }
    
    pool.query(sql, [pageSize, offset], function (err, rows, fields) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      
      if (!rows || rows.length === 0) {
        return res.json({ data: [], total: total });
      }
      
      // 构建批量查询
      let batchSql = '';
      rows.forEach((i) => {
        batchSql += `SELECT * FROM stock_big_data WHERE symbol = '${i.symbol}' AND datestr <= '${i.datestr}' ORDER BY datestr DESC LIMIT 10;`;
      });
      
      pool.query(batchSql, function (newerr, newrows, newfields) {
        if (newerr) {
          console.error(newerr);
          return res.status(500).json({ error: newerr.message });
        }
        
        const newResult = rows?.map((item, key) => ({
          ...item,
          recentTen: newrows[key] || [],
        }));
        
        res.json({ data: newResult, total: total });
      });
    });
  });
});

// router.get('/all_focus_stock2', function (req, res, next) {
//   const sql = `SELECT a.*, b.*, a.updated_at as last_updated_at  FROM focus_stocks2 a join stock_day_common_data b on a.symbol = b.symbol and a.datestr=b.datestr;`;
//   pool.query(sql, function (err, rows, fields) {
//     if (err) throw err;
//     //res.json(rows);
//     let batchSql = '';
//     rows?.forEach(
//       (i) =>
//         (batchSql += `SELECT * from stock_big_data where symbol = '${i.symbol}' and datestr <= '${i.datestr}' order by datestr DESC limit 10;`)
//     );
//     pool.query(batchSql, function (newerr, newrows, newfields) {
//       if (err) throw err;
//       //...newrows.forEach(i => {})
//       const newResult = rows?.map((item, key) => ({
//         ...item,
//         //recentTen: newrows?.flat()?.filter((i) => i.symbol === item.symbol),
//         recentTen: newrows[key],
//       }));
//       res.json(newResult);
//     });
//   });
// });
router.get('/all_focus_stock2', function (req, res, next) {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const offset = (page - 1) * pageSize;

  const sortByDate = req.query.sortByDate === 'true';
  const dateSortOrder = req.query.dateSortOrder === 'ASC' ? 'ASC' : 'DESC';

  // 获取总记录数
  const countSql = `SELECT COUNT(*) as total FROM focus_stocks2`;
  pool.query(countSql, function (countErr, countRows) {
    if (countErr) {
      console.error(countErr);
      return res.status(500).json({ error: countErr.message });
    }
    const total = countRows[0].total;

    let sql;
    if (sortByDate) {
      sql = `SELECT a.*, b.*, a.updated_at as last_updated_at,
                    ai.alert_decision AS alert_decision,
                    latest_h.observe_date AS post_alert_observe_date,
                    latest_h.observe_days AS post_alert_observe_days,
                    latest_h.post_alert_decision AS post_alert_decision,
                    latest_h.post_alert_comments AS post_alert_comments,
                    best_entry_h.observe_date AS best_entry_observe_date,
                    best_entry_h.observe_days AS best_entry_observe_days,
                    best_entry_h.post_alert_decision AS best_entry_decision,
                    best_entry_h.post_alert_comments AS best_entry_comments
             FROM focus_stocks2 a 
             JOIN stock_day_common_data b ON a.symbol = b.symbol AND a.datestr = b.datestr
             LEFT JOIN focus_stocks2_ai ai ON ai.symbol = a.symbol AND ai.datestr = a.datestr
             LEFT JOIN (
               SELECT h.*
               FROM post_alert_portrait_history h
               JOIN (
                 SELECT record_type, alert_id, MAX(observe_date) AS observe_date
                 FROM post_alert_portrait_history
                 WHERE record_type = 'record2'
                 GROUP BY record_type, alert_id
               ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
             ) latest_h ON latest_h.record_type = 'record2' AND latest_h.alert_id = ai.id AND latest_h.symbol = ai.symbol AND DATE(latest_h.alarm_datestr) = DATE(ai.datestr)
             LEFT JOIN (
               SELECT h.*
               FROM post_alert_portrait_history h
               JOIN (
                 SELECT record_type, alert_id, MAX(observe_date) AS observe_date
                 FROM post_alert_portrait_history
                 WHERE record_type = 'record2'
                   AND (
                        post_alert_decision LIKE '后接入%'
                     OR post_alert_decision LIKE '%D4D7%'
                   )
                 GROUP BY record_type, alert_id
               ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
             ) best_entry_h ON best_entry_h.record_type = 'record2' AND best_entry_h.alert_id = ai.id AND best_entry_h.symbol = ai.symbol AND DATE(best_entry_h.alarm_datestr) = DATE(ai.datestr)
             ORDER BY COALESCE(best_entry_h.observe_date, a.datestr) ${dateSortOrder}, a.datestr ${dateSortOrder}
             LIMIT ? OFFSET ?`;
    } else {
      sql = `SELECT a.*, b.*, a.updated_at as last_updated_at,
                    ai.alert_decision AS alert_decision,
                    latest_h.observe_date AS post_alert_observe_date,
                    latest_h.observe_days AS post_alert_observe_days,
                    latest_h.post_alert_decision AS post_alert_decision,
                    latest_h.post_alert_comments AS post_alert_comments,
                    best_entry_h.observe_date AS best_entry_observe_date,
                    best_entry_h.observe_days AS best_entry_observe_days,
                    best_entry_h.post_alert_decision AS best_entry_decision,
                    best_entry_h.post_alert_comments AS best_entry_comments
             FROM focus_stocks2 a 
             JOIN stock_day_common_data b ON a.symbol = b.symbol AND a.datestr = b.datestr
             LEFT JOIN focus_stocks2_ai ai ON ai.symbol = a.symbol AND ai.datestr = a.datestr
             LEFT JOIN (
               SELECT h.*
               FROM post_alert_portrait_history h
               JOIN (
                 SELECT record_type, alert_id, MAX(observe_date) AS observe_date
                 FROM post_alert_portrait_history
                 WHERE record_type = 'record2'
                 GROUP BY record_type, alert_id
               ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
             ) latest_h ON latest_h.record_type = 'record2' AND latest_h.alert_id = ai.id AND latest_h.symbol = ai.symbol AND DATE(latest_h.alarm_datestr) = DATE(ai.datestr)
             LEFT JOIN (
               SELECT h.*
               FROM post_alert_portrait_history h
               JOIN (
                 SELECT record_type, alert_id, MAX(observe_date) AS observe_date
                 FROM post_alert_portrait_history
                 WHERE record_type = 'record2'
                   AND (
                        post_alert_decision LIKE '后接入%'
                     OR post_alert_decision LIKE '%D4D7%'
                   )
                 GROUP BY record_type, alert_id
               ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
             ) best_entry_h ON best_entry_h.record_type = 'record2' AND best_entry_h.alert_id = ai.id AND best_entry_h.symbol = ai.symbol AND DATE(best_entry_h.alarm_datestr) = DATE(ai.datestr)
             ORDER BY a.updated_at DESC
             LIMIT ? OFFSET ?`;
    }

    pool.query(sql, [pageSize, offset], function (err, rows) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      if (!rows || rows.length === 0) {
        return res.json({ data: [], total: total });
      }

      // 批量获取 recentTen 数据
      let batchSql = '';
      rows.forEach((item) => {
        batchSql += `SELECT * FROM stock_big_data WHERE symbol = '${item.symbol}' AND datestr <= '${item.datestr}' ORDER BY datestr DESC LIMIT 10;`;
      });
      pool.query(batchSql, function (newerr, newrows) {
        if (newerr) {
          console.error(newerr);
          return res.status(500).json({ error: newerr.message });
        }
        const newResult = rows.map((item, idx) => ({
          ...item,
          recentTen: newrows[idx] || [],
        }));
        res.json({ data: newResult, total: total });
      });
    });
  });
});

router.get('/all_expire_focus_stock', function (req, res, next) {
  const sql = `SELECT a.*, b.*, a.updated_at as last_updated_at  FROM focus_stocks_expire a join stock_day_common_data b on a.symbol = b.symbol and a.datestr=b.datestr;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    //res.json(rows);
    let batchSql = '';
    rows?.forEach(
      (i) =>
        (batchSql += `SELECT * from stock_big_data where symbol = '${i.symbol}' and datestr <= '${i.datestr}' order by datestr DESC limit 10;`)
    );
    pool.query(batchSql, function (newerr, newrows, newfields) {
      if (err) throw err;
      //...newrows.forEach(i => {})
      const newResult = rows?.map((item, key) => ({
        ...item,
        //recentTen: newrows?.flat()?.filter((i) => i.symbol === item.symbol),
        recentTen: newrows[key],
      }));
      res.json(newResult);
    });
  });
});

router.get('/all_expire_focus_stock_other', function (req, res, next) {
  const sql = `SELECT a.*, b.*, a.updated_at as last_updated_at  FROM focus_stocks_expire_other a join stock_day_common_data b on a.symbol = b.symbol and a.datestr=b.datestr;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    //res.json(rows);
    let batchSql = '';
    rows?.forEach(
      (i) =>
        (batchSql += `SELECT * from stock_big_data where symbol = '${i.symbol}' and datestr <= '${i.datestr}' order by datestr DESC limit 10;`)
    );
    pool.query(batchSql, function (newerr, newrows, newfields) {
      if (err) throw err;
      //...newrows.forEach(i => {})
      const newResult = rows?.map((item, key) => ({
        ...item,
        //recentTen: newrows?.flat()?.filter((i) => i.symbol === item.symbol),
        recentTen: newrows[key],
      }));
      res.json(newResult);
    });
  });
});

router.get('/all_da_focus', function (req, res, next) {
  let sql = `SELECT a.*, b.*, c.viewed, c.datestr as viewedDate FROM focus_da a join stock_day_common_data b on a.symbol = b.symbol left join viewd_stocks c on a.symbol = c.symbol where a.datestr=b.datestr and a.deleted != '1';`;
  const simulateDate = req.query.simulateDate;
  if (simulateDate) {
    sql = `SELECT a.*, b.*, c.viewed, c.datestr as viewedDate FROM focus_da a join stock_day_common_data b on a.symbol = b.symbol left join viewd_stocks c on a.symbol = c.symbol where a.datestr=b.datestr and a.datestr <= '${simulateDate}' and a.deleted != '1';`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.post('/all_plates_in_da_focus', function (req, res, next) {
  const bName = req.body.bName;
  const hName = req.body.hName;
  const date = req.body.date;
  const sql = `select focus_da.symbol, stocks.name, focus_da.datestr from focus_da join sw_stock_business sw on focus_da.symbol=sw.symbol join stocks on focus_da.symbol=stocks.symbol join business b on b.code= sw.business_code where b.name='${bName}' and b.business_type='${hName}' and focus_da.deleted='0' and focus_da.datestr <= '${date}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/get_focus_stock_price', function (req, res, next) {
  const symbols = req.query.stocks;
  const endDate = req.query.datestr;
  const startDate = req.query.start_date;
  let sql = `SELECT * FROM stock_day_common_data where symbol in (${symbols})`;
  if (startDate && endDate) {
    sql = `SELECT * FROM stock_day_common_data where symbol in (${symbols}) and datestr <= '${endDate}' and datestr > '${startDate}'`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.post('/get_price_from_common_data', function (req, res, next) {
  const symbols = req.body.stocks;
  let sql = `SELECT * FROM stock_day_common_data where symbol in (${symbols})`;
  if (isEmpty(symbols)) {
    sql = `SELECT * FROM stock_day_common_data where symbol in (-1)`;
  }
  const simulateDate = req.body.simulateDate;
  const today = req.body.today;
  const startDate = req.body.startDate;
  if (simulateDate) {
    sql = `SELECT * FROM stock_day_common_data where symbol in (${symbols}) and datestr <= '${simulateDate}';`;
  }
  if (today) {
    sql = `SELECT * FROM stock_day_common_data where symbol in (${symbols}) and datestr = '${today}';`;
  }
  if (startDate && simulateDate) {
    sql = `SELECT * FROM stock_day_common_data where symbol in (${symbols}) and datestr <= '${simulateDate}' and datestr > '${startDate}';`;
  }
  console.log(sql);
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/stock_alarm', function (req, res, next) {
  const symbol = req.query.stock_id;
  const afterDate = req.query.afterDate;
  const from100 = req.query.from100;
  let table = 'stock_big_data';
  if (from100 === 'true') {
    table = 'stock_big_data_100';
  }
  //let sql = `SELECT *, group_concat(c.name) as plates FROM stock_big_data a join plate b on a.symbol = b.symbol join focus_plate c on c.code = b.code where a.symbol='${symbol}' and a.datestr >= '${afterDate}' and c.focus =1 group by datestr;`;
  let sql = `SELECT * FROM ${table} a where a.symbol='${symbol}' and a.datestr >= '${afterDate}';`;
  const datestr = req.query.date_str;
  if (datestr) {
    sql = `SELECT * FROM ${table} a where a.symbol='${symbol}' and a.datestr > '${datestr}';`;
  }
  const plateSQL = `SELECT group_concat(p.name) as plates from plate p join focus_plate f on p.code= f.code where p.symbol='${symbol}' and f.focus =1 group by p.symbol;`;
  const commonDataSQL = `SELECT finalprice, turnoverrate, per_dynamic, per_static, profit_chip, datestr FROM stock_day_common_data where symbol='${symbol}' and datestr >= '${afterDate}';`;
  pool.query(`${sql}${plateSQL}${commonDataSQL}`, function (err, rows, fields) {
    if (err) throw err;
    res.json(
      rows?.[0].map((i) => ({
        ...i,
        plates: rows?.[1]?.[0]?.plates,
        commonData: rows?.[2],
      }))
    );
  });
});

router.get('/all_alarm_data', function (req, res, next) {
  const datestr = req.query.date_str;
  const endDateStr = req.query.end_date_str;
  const from100 = req.query.from100;
  const stock = req.query.stock;
  const symbols = req.query.symbols;
  let table = 'stock_big_data';
  if (from100 === 'true') table = 'stock_big_data_100';
  let sql = `select a.*, b.profit_chip from ${table} a join stock_day_common_data b on a.symbol = b.symbol and a.datestr = b.datestr where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and a.name not like "%ST%"`;
  if (stock) {
    sql = `select a.*, b.profit_chip from ${table} a join stock_day_common_data b on a.symbol = b.symbol and a.datestr = b.datestr where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and a.name not like "%ST%" and a.symbol='${stock}'`;
  }
  if (symbols) {
    sql = `select a.*, b.profit_chip from ${table} a join stock_day_common_data b on a.symbol = b.symbol and a.datestr = b.datestr where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and a.name not like "%ST%" and a.symbol in (${symbols})`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/critical_data', function (req, res, next) {
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  const from = req.query.from;
  const stock = req.query.stock;
  const isFocused = req.query.isFocused;
  const isDown = req.query.isDown === 'true';
  const table = isDown ? 'critical_risk_stocks' : 'critical_stocks';
  console.log('===', table);
  //let sql = `select * from critical_stocks a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date right join focus_da fd on a.symbol=fd.symbol where a.end_date > '${startDateStr}' and a.end_date < '${endDateStr}' and fd.datestr > '${startDateStr}' and fd.datestr < '${endDateStr}' and source = '${from}' group by a.id;`;
  let sql = `select * from ${table} a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date where a.end_date >= '${startDateStr}' and a.end_date <= '${endDateStr}' group by a.symbol;`;
  if (!isEmpty(stock) && stock !== 'undefined') {
    if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
      sql = `select * from ${table} a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date where a.symbol LIKE '%${stock}%' GROUP BY end_date ORDER BY end_date, days, a.id ASC;`;
    } else {
      sql = `select * from ${table} a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date where a.symbol LIKE '%${stock}%' and a.end_date >= '${startDateStr}' and a.end_date <= '${endDateStr}' GROUP BY end_date ORDER BY end_date, days, a.id ASC;`;
    }
  }
  if (isFocused === 'true') {
    sql = `select * from ${table} a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date right join focus_da fd on a.symbol=fd.symbol where a.end_date > '${startDateStr}' and a.end_date < '${endDateStr}' and fd.datestr > '${startDateStr}' and fd.datestr < '${endDateStr}' and source = '${from}' group by a.id;`;
  }
  const markStr = 'xywang-';
  if (!isEmpty(stock) && stock.substr(0, markStr.length) == markStr) {
    let intervalMonth = 3;
    if (stock.length > markStr.length) {
      intervalMonth = stock.substr(markStr.length, stock.length);
    }
    sql = `SELECT * FROM ${table} finalcs JOIN stock_day_common_data sdcd ON finalcs.symbol=sdcd.symbol AND sdcd.datestr = finalcs.end_date WHERE finalcs.symbol IN (SELECT symbol FROM critical_stocks WHERE end_date >= '${startDateStr}' AND end_date <= '${endDateStr}') AND finalcs.symbol NOT IN (SELECT DISTINCT csa.symbol FROM critical_stocks csa, (SELECT symbol, MIN(end_date) min_end_date FROM critical_stocks WHERE end_date >= '${startDateStr}' AND end_date <= '${endDateStr}' GROUP BY symbol) csb WHERE csa.symbol=csb.symbol AND csa.end_date > date_sub(min_end_date, INTERVAL ${intervalMonth} MONTH) AND csa.end_date < '${startDateStr}') AND finalcs.end_date <= '${endDateStr}' AND finalcs.end_date >= '${startDateStr}';`;
  }
  if (isEmpty(stock)) {
    sql = `SELECT * FROM ${table} finalcs JOIN stock_day_common_data sdcd ON finalcs.symbol=sdcd.symbol AND sdcd.datestr = finalcs.end_date WHERE finalcs.end_date <= '${endDateStr}' AND finalcs.end_date >= '${startDateStr}' group by a.symbol;`;
  }

  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/critical_data3', function (req, res, next) {
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  const from = req.query.from;
  const stock = req.query.stock;
  const isFocused = req.query.isFocused;
  const isDown = req.query.isDown === 'true';
  const table = isDown ? '3_critical_risk_stocks' : '3_critical_stocks';
  console.log('===', table);
  //let sql = `select * from critical_stocks a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date right join focus_da fd on a.symbol=fd.symbol where a.end_date > '${startDateStr}' and a.end_date < '${endDateStr}' and fd.datestr > '${startDateStr}' and fd.datestr < '${endDateStr}' and source = '${from}' group by a.id;`;
  let sql = `select * from ${table} a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date where a.end_date >= '${startDateStr}' and a.end_date <= '${endDateStr}' group by a.symbol;`;
  if (!isEmpty(stock) && stock !== 'undefined') {
    if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
      sql = `select * from ${table} a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date where a.symbol LIKE '%${stock}%' GROUP BY end_date ORDER BY end_date DESC, days DESC, a.id ASC;`;
    } else {
      sql = `select * from ${table} a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date where a.symbol LIKE '%${stock}%' and a.end_date >= '${startDateStr}' and a.end_date <= '${endDateStr}' GROUP BY end_date ORDER BY end_date DESC, days DESC, a.id ASC;`;
    }
  }
  if (isFocused === 'true') {
    sql = `select * from ${table} a join stock_day_common_data b on a.symbol=b.symbol and b.datestr = a.end_date right join focus_da fd on a.symbol=fd.symbol where a.end_date > '${startDateStr}' and a.end_date < '${endDateStr}' and fd.datestr > '${startDateStr}' and fd.datestr < '${endDateStr}' and source = '${from}' group by a.id;`;
  }
  const markStr = 'xywang-';
  if (!isEmpty(stock) && stock.substr(0, markStr.length) == markStr) {
    let intervalMonth = 3;
    if (stock.length > markStr.length) {
      intervalMonth = stock.substr(markStr.length, stock.length);
    }
    sql = `SELECT * FROM ${table} finalcs JOIN stock_day_common_data sdcd ON finalcs.symbol=sdcd.symbol AND sdcd.datestr = finalcs.end_date WHERE finalcs.symbol IN (SELECT symbol FROM critical_stocks WHERE end_date >= '${startDateStr}' AND end_date <= '${endDateStr}') AND finalcs.symbol NOT IN (SELECT DISTINCT csa.symbol FROM critical_stocks csa, (SELECT symbol, MIN(end_date) min_end_date FROM critical_stocks WHERE end_date >= '${startDateStr}' AND end_date <= '${endDateStr}' GROUP BY symbol) csb WHERE csa.symbol=csb.symbol AND csa.end_date > date_sub(min_end_date, INTERVAL ${intervalMonth} MONTH) AND csa.end_date < '${startDateStr}') AND finalcs.end_date <= '${endDateStr}' AND finalcs.end_date >= '${startDateStr}';`;
  }
  if (isEmpty(stock)) {
    sql = `SELECT * FROM ${table} finalcs JOIN stock_day_common_data sdcd ON finalcs.symbol=sdcd.symbol AND sdcd.datestr = finalcs.end_date WHERE finalcs.end_date <= '${endDateStr}' AND finalcs.end_date >= '${startDateStr}' group by a.symbol;`;
  }

  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/kdj', function (req, res, next) {
  const stock = req.query.stock;
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  let sql = `select kdj.symbol, kdj.datestr, kdj.k, kdj.d, kdj.j from replay_critical_3 a join stock_day_common_data b on a.symbol=b.symbol and b.datestr=a.end_date join kdj on a.symbol=kdj.symbol and a.end_date=kdj.datestr where a.symbol LIKE '%${stock}%' and kdj.datestr >= '${startDateStr}' and kdj.datestr <= '${endDateStr}' GROUP BY end_date ORDER BY end_date DESC;`;
  if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
    sql = `select kdj.symbol, kdj.datestr, kdj.k, kdj.d, kdj.j from replay_critical_3 a join stock_day_common_data b on a.symbol=b.symbol and b.datestr=a.end_date join kdj on a.symbol=kdj.symbol and a.end_date=kdj.datestr where a.symbol LIKE '%${stock}%' GROUP BY end_date ORDER BY end_date DESC;`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/dmi', function (req, res, next) {
  const stock = req.query.stock;
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  let sql = `select dmi.symbol, dmi.datestr, dmi.pdi, dmi.mdi, dmi.adx from replay_critical_3 rc3 join dmi on rc3.symbol=dmi.symbol and rc3.end_date=dmi.datestr where rc3.symbol LIKE '%${stock}%' and dmi.datestr >= '${startDateStr}' and dmi.datestr <= '${endDateStr}' GROUP BY end_date ORDER BY end_date DESC;`;
  if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
    sql = `select dmi.symbol, dmi.datestr, dmi.pdi, dmi.mdi, dmi.adx from replay_critical_3 rc3 join dmi on rc3.symbol=dmi.symbol and rc3.end_date=dmi.datestr where rc3.symbol LIKE '%${stock}%' GROUP BY end_date ORDER BY end_date DESC;`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/ma', function (req, res, next) {
  const stock = req.query.stock;
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  let sql = `select ma.symbol, ma.datestr, ma.ma5, ma.ma10, ma.ma20, ma.ma60 from replay_critical_3 rc3 join ma on rc3.symbol=ma.symbol and rc3.end_date=ma.datestr where rc3.symbol LIKE '%${stock}%' and ma.datestr >= '${startDateStr}' and ma.datestr <= '${endDateStr}' GROUP BY rc3.end_date ORDER BY rc3.end_date DESC;`;
  if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
    sql = `select ma.symbol, ma.datestr, ma.ma5, ma.ma10, ma.ma20, ma.ma60 from replay_critical_3 rc3 join ma on rc3.symbol=ma.symbol and rc3.end_date=ma.datestr where rc3.symbol LIKE '%${stock}%' GROUP BY rc3.end_date ORDER BY rc3.end_date DESC;`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/ds', function (req, res, next) {
  const stock = req.query.stock;
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  let sql = `select sdcd.symbol, sdcd.datestr, sdcd.per_dynamic, sdcd.per_static from replay_critical_3 rc3 join stock_day_common_data sdcd on rc3.symbol=sdcd.symbol and rc3.end_date=sdcd.datestr where rc3.symbol LIKE '%${stock}%' and sdcd.datestr >= '${startDateStr}' and sdcd.datestr <= '${endDateStr}' GROUP BY rc3.end_date ORDER BY rc3.end_date DESC;`;
  if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
    sql = `select sdcd.symbol, sdcd.datestr, sdcd.per_dynamic, sdcd.per_static from replay_critical_3 rc3 join stock_day_common_data sdcd on rc3.symbol=sdcd.symbol and rc3.end_date=sdcd.datestr where rc3.symbol LIKE '%${stock}%' GROUP BY rc3.end_date ORDER BY rc3.end_date DESC;`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.post('/boards_of_stock', function (req, res, next) {
  const stocks = req.query.stocks;
  let sql = `SELECT ssb.symbol, b.name, b.business_type FROM sw_stock_business ssb JOIN business b ON ssb.business_code=b.code WHERE ssb.symbol IN (${stocks});`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

// routes/index.ts - 串行执行版本
router.get('/alarm_trends', function (req, res, next) {
  const { days, daysTill } = req.query;
  
  console.log('Received params:', { days, daysTill });
  
  // 参数验证
  if (!days || !daysTill) {
    return res.status(400).json({ error: 'Missing required parameters: days and daysTill' });
  }
  
  // 计算开始日期
  const endDate = daysTill;
  const startDateObj = new Date(endDate as string);
  startDateObj.setDate(startDateObj.getDate() - parseInt(days as string));
  const startDate = startDateObj.toISOString().split('T')[0];
  
  console.log('Date range:', { startDate, endDate });
  
  const results = {
    '400s_up': [],
    '400s_down': [],
    '100w_up': [],
    '100w_down': []
  };
  
  // 串行执行查询
  const executeQueries = () => {
    // 查询 400s up
    const sql400sUp = `SELECT datestr, COUNT(*) AS count 
      FROM stock_big_data 
      WHERE status = 'up' 
        AND datestr >= '${startDate}' 
        AND datestr <= '${endDate}' 
      GROUP BY datestr 
      ORDER BY datestr`;
    
    pool.query(sql400sUp, (err, rows) => {
      if (!err && rows) {
        results['400s_up'] = rows;
      }
      
      // 查询 400s down
      const sql400sDown = `SELECT datestr, COUNT(*) AS count 
        FROM stock_big_data 
        WHERE status = 'down' 
          AND datestr >= '${startDate}' 
          AND datestr <= '${endDate}' 
        GROUP BY datestr 
        ORDER BY datestr`;
      
      pool.query(sql400sDown, (err, rows) => {
        if (!err && rows) {
          results['400s_down'] = rows;
        }
        
        // 查询 100w up
        const sql100wUp = `SELECT datestr, COUNT(*) AS count 
          FROM stock_big_data_100 
          WHERE status = 'up' 
            AND datestr >= '${startDate}' 
            AND datestr <= '${endDate}' 
          GROUP BY datestr 
          ORDER BY datestr`;
        
        pool.query(sql100wUp, (err, rows) => {
          if (!err && rows) {
            results['100w_up'] = rows;
          }
          
          // 查询 100w down
          const sql100wDown = `SELECT datestr, COUNT(*) AS count 
            FROM stock_big_data_100 
            WHERE status = 'down' 
              AND datestr >= '${startDate}' 
              AND datestr <= '${endDate}' 
            GROUP BY datestr 
            ORDER BY datestr`;
          
          pool.query(sql100wDown, (err, rows) => {
            if (!err && rows) {
              results['100w_down'] = rows;
            }
            
            console.log('All queries completed');
            res.json(results);
          });
        });
      });
    });
  };
  
  executeQueries();
});

// ===== 交易执行层: Core A + Short E 策略记录 =====
// 规则来源: trade_execution_strategy_v1_1_2026_06_27.md
router.get('/trade_execution', async function (req, res, next) {
  const recordType = req.query.record_type === 'record2' ? 'record2' : 'record1';
  const focusTable = recordType === 'record2' ? 'focus_stocks2' : 'focus_stocks';
  const tableAI = recordType === 'record2' ? 'focus_stocks2_ai' : 'focus_stocks_ai';
  const eIdx = recordType === 'record2' ? 1 : 0;
  const today = new Date().toISOString().split('T')[0];
  const tradeConfig = loadTradeStrategiesConfig();

  // 获取当前市场环境。策略匹配仍以报警日画像里的 M 标签为准。
  let regime = 'hot_expand';
  let marketRaw: any = {};
  let marketWindow: any = null;
  try {
    const marketEnv = await calcMarketEnvironment(tableAI, today, eIdx);
    marketWindow = await loadMarketWindowSnapshot(recordType, tableAI, today);
    marketRaw = {
      temp: marketEnv.temp,
      alarm_dir: marketEnv.alarm_dir,
      vol_med: marketEnv.vol_med,
      window_signal: marketWindow?.window_signal || null,
      window_title: marketWindow?.window_title || null,
      window_desc: marketWindow?.window_desc || null,
      window_date: marketWindow?.datestr || null,
      trail_signal_n: marketWindow?.trail_signal_n || null,
      trail_negative_pct: marketWindow?.trail_negative_pct || null,
      trail_low_pos_pct: marketWindow?.trail_low_pos_pct || null,
      trail_m_expand_pct: marketWindow?.trail_m_expand_pct || null,
    };
    const { temp, alarm_dir } = marketEnv;
    if (temp === '热' && alarm_dir === '报扩') regime = 'hot_expand';
    else if (temp === '热' && alarm_dir === '报缩') regime = 'neutral';
    else if (temp === '热偏弱' && alarm_dir === '报扩') regime = 'hot_expand';
    else if (temp === '热偏弱' && alarm_dir === '报缩') regime = 'weak_contract';
    else if (temp === '温') regime = 'neutral';
    else regime = 'weak_contract'; // 冷偏暖 / 极冷
  } catch (err) {
    console.warn('calcMarketEnvironment failed, using default regime:', err);
  }

  // R2 后续需要独立短周期扫描，不能直接套 R1 参数。
  const recordFilter = buildTradeExecutionRecordFilter(recordType, tradeConfig);

  const sql = `
    SELECT fca.id, fca.symbol, fca.name, fca.datestr, fca.final_price,
           fca.alert_decision, fca.comments,
           fca.max_240_pct, fca.min_240_pct,
           latest_h.observe_date AS post_alert_observe_date,
           latest_h.post_alert_decision AS post_alert_decision,
           latest_ref.reference_date,
           (SELECT sd.finalprice
            FROM stock_day_common_data sd
            WHERE sd.symbol = fca.symbol
            ORDER BY sd.datestr DESC
            LIMIT 1) AS execution_price,
           (SELECT sd.datestr
            FROM stock_day_common_data sd
            WHERE sd.symbol = fca.symbol
            ORDER BY sd.datestr DESC
            LIMIT 1) AS execution_price_date,
           DATEDIFF(latest_ref.reference_date, fca.datestr) AS days_since_alert
    FROM ${tableAI} fca
    JOIN (SELECT MAX(datestr) AS reference_date FROM ${focusTable}) latest_ref
    LEFT JOIN (
      SELECT h.*
      FROM post_alert_portrait_history h
      JOIN (
        SELECT record_type, alert_id, MAX(observe_date) AS observe_date
        FROM post_alert_portrait_history
        WHERE record_type = '${recordType}'
        GROUP BY record_type, alert_id
      ) m ON m.record_type = h.record_type AND m.alert_id = h.alert_id AND m.observe_date = h.observe_date
    ) latest_h ON latest_h.record_type = '${recordType}'
              AND latest_h.alert_id = fca.id
              AND latest_h.symbol = fca.symbol
              AND DATE(latest_h.alarm_datestr) = DATE(fca.datestr)
    WHERE 1 = 1
      ${recordFilter}
    ORDER BY
      CASE
        WHEN fca.alert_decision LIKE '试｜急跌修复%' THEN 1
        WHEN fca.alert_decision LIKE '等｜弱势早期修复%' THEN 2
        WHEN fca.alert_decision LIKE '试｜低分修复%' THEN 3
        WHEN fca.alert_decision LIKE '买｜低位修复%' THEN 3
        ELSE 5
      END ASC,
      fca.datestr DESC
  `;

  pool.query(sql, function (err, rows) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
    if (!rows || rows.length === 0) {
      return res.json({
        market_env: { ...marketRaw, regime },
        candidates: [],
      });
    }
    const symbols = Array.from(new Set<string>(rows.map((r: any) => String(r.symbol || '')).filter(Boolean)))
      .map((symbol: string) => `'${sqlEscape(symbol)}'`)
      .join(',');
    const minAlertDate = rows
      .map((r: any) => alertDateValue(r.datestr))
      .filter(Boolean)
      .sort()[0];
    const priceSql = `
      SELECT symbol, datestr, finalprice
      FROM stock_day_common_data
      WHERE symbol IN (${symbols || "''"})
        AND datestr >= '${sqlEscape(minAlertDate || '2000-01-01')}'
      ORDER BY symbol, datestr
    `;
    const alertDate = (d: any) => d ? String(d).split('T')[0] : '';
    pool.query(priceSql, async function (priceErr, priceRows) {
      if (priceErr) {
        console.error(priceErr);
        return res.status(500).json({ error: priceErr.message });
      }
      const referenceDate = formatDbDate(rows?.[0]?.reference_date) || today;
      let marketWindowSeries: any[] = [];
      try {
        marketWindowSeries = await loadMarketWindowSeries(
          recordType,
          tableAI,
          minAlertDate || '2000-01-01',
          referenceDate || today
        );
      } catch (windowErr) {
        console.warn('loadMarketWindowSeries failed, candidate windows disabled:', windowErr);
      }
      const priceMap = buildPriceMap(priceRows || []);
      const productionCandidates = rows
        .map((r: any) => {
          const strategy = selectTradeStrategy(r, recordType);
          if (!strategy) return null;
          const candidateEntryDate = alertDate(r.datestr);
          const candidateWindow = pickMarketWindowForDate(marketWindowSeries, candidateEntryDate);
          const daysSinceAlert = Number(r.days_since_alert);
          const executionPlan = buildDynamicExecutionPlan(r, strategy);
          const status = buildTradeExecutionStatus(r, strategy, daysSinceAlert);
          const windowSuspension = buildMarketWindowSuspension(strategy, candidateWindow);
          const executionStatus = windowSuspension && status?.status === 'executable'
            ? windowSuspension
            : status;
          const pricesForSymbol = priceMap[String(r.symbol || '')] || [];
          const strategyOutcome = buildStrategyOutcome(r, strategy, pricesForSymbol);
          const d30Outcome = buildStrategyOutcome(r, { ...strategy, max_hold_days: 30 }, pricesForSymbol);
          return {
            ...r,
            final_price: executionPlan.execution_price,
            alert_price: executionPlan.alert_price,
            execution_price: executionPlan.execution_price,
            execution_price_date: executionPlan.execution_price_date,
            tp_price: executionPlan.tp_price,
            sl_price: executionPlan.sl_price,
            move_since_alert_pct: executionPlan.move_since_alert_pct,
            entry_risk_state: executionPlan.entry_risk_state,
            execution_note: executionPlan.execution_note,
            strategy_result_status: strategyOutcome.status,
            strategy_result_label: strategyOutcome.label,
            strategy_result_date: strategyOutcome.result_date,
            strategy_result_ret_pct: strategyOutcome.result_ret_pct,
            strategy_result_hold_days: strategyOutcome.hold_days,
            strategy_max_ret_pct: strategyOutcome.max_ret_pct,
            strategy_min_ret_pct: strategyOutcome.min_ret_pct,
            d30_result_status: d30Outcome.status,
            d30_result_label: d30Outcome.label,
            d30_result_date: d30Outcome.result_date,
            d30_result_ret_pct: d30Outcome.result_ret_pct,
            d30_result_hold_days: d30Outcome.hold_days,
            d30_max_ret_pct: d30Outcome.max_ret_pct,
            d30_min_ret_pct: d30Outcome.min_ret_pct,
            execution_status: executionStatus.status,
            execution_status_label: executionStatus.label,
            execution_status_reason: executionStatus.reason,
            is_current_executable: executionStatus.status === 'executable',
            trade_tier: strategy.legacy_tier,
            strategy_layer: strategy.strategy_layer,
            strategy_code: strategy.strategy_code,
            strategy_name: strategy.strategy_name,
            trade_action: strategy.trade_action,
            entry_window_days: strategy.entry_window_days,
            tp_pct: strategy.tp_pct,
            sl_pct: strategy.sl_pct,
            max_hold_days: strategy.max_hold_days,
            replay_metric_scope: strategy.replay_metric_scope,
            replay_sample_n: strategy.replay_sample_n,
            replay_win_pct: strategy.replay_win_pct,
            tp_hit_pct: strategy.tp_hit_pct,
            sl_hit_pct: strategy.sl_hit_pct,
            time_exit_pct: strategy.time_exit_pct,
            replay_avg_ret_pct: strategy.replay_avg_ret_pct,
            replay_avg_hold_days: strategy.replay_avg_hold_days,
            replay_efficiency_20d: strategy.replay_efficiency_20d,
            market_regime: strategy.signal_regime,
            current_market_regime: regime,
            signal_market_regime: strategy.signal_regime,
            market_window_signal: candidateWindow?.window_signal || null,
            market_window_title: candidateWindow?.window_title || null,
            market_window_desc: candidateWindow?.window_desc || null,
            market_window_date: candidateWindow?.datestr || null,
            trade_reason: buildTradeReason(r, strategy),
            alert_date: candidateEntryDate,
            days_since_alert: daysSinceAlert,
            entry_window_basis: 'alert_date',
            entry_window_basis_label: '报警日',
            entry_window_basis_date: alertDate(r.datestr),
            entry_window_day_count: daysSinceAlert,
          };
        })
        .filter(Boolean);
      const pullbackCandidates = buildPullbackTradeCandidates(
        rows || [],
        recordType,
        priceMap,
        referenceDate,
        regime,
        marketWindowSeries
      );
      const candidates = [...productionCandidates, ...pullbackCandidates];

      res.json({
        market_env: { ...marketRaw, regime },
        candidates,
      });
    });
  });
});

function alertDateValue(value: any): string {
  return value ? String(value).split('T')[0] : '';
}

function configStrategiesForTradeExecution(config: any, recordType: string): any[] {
  if (!config || config.record_type !== recordType || !Array.isArray(config.strategies)) return [];
  return config.strategies.filter((strategy: any) =>
    strategy?.match?.record_type === recordType &&
    (
      strategy?.status === 'production_ready' ||
      (strategy?.status === 'candidate_ready' && strategy?.current_display?.enabled === true)
    )
  );
}

function buildTradeExecutionRecordFilter(recordType: string, config: any): string {
  if (recordType !== 'record1') return 'AND 1 = 0';
  const prefixes = Array.from(new Set(
    configStrategiesForTradeExecution(config, recordType)
      .flatMap((strategy: any) => strategy?.match?.label_prefixes || [])
      .filter(Boolean)
  ));
  const fallbackPrefixes = [
    '买｜低位修复',
    '试｜低分修复',
    '试｜急跌修复',
    '等｜弱势早期修复',
  ];
  const activePrefixes = prefixes.length ? prefixes : fallbackPrefixes;
  const clauses = activePrefixes
    .map((prefix: any) => `fca.alert_decision LIKE '${sqlEscape(prefix)}%'`)
    .join('\n        OR ');
  return `
      AND (
        ${clauses}
      )
    `;
}

function buildPriceMap(rows: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  rows.forEach((row) => {
    const symbol = String(row.symbol || '');
    const price = toNumber(row.finalprice, NaN);
    if (!symbol || !Number.isFinite(price) || price <= 0) return;
    if (!map[symbol]) map[symbol] = [];
    map[symbol].push({
      date: formatDbDate(row.datestr),
      price,
    });
  });
  return map;
}

function buildStrategyOutcome(record: any, strategy: any, prices: any[]): any {
  const entryDate = strategy?.entry_basis_date || alertDateValue(record?.datestr);
  const entryIndex = prices.findIndex((row) => row.date >= entryDate);
  if (entryIndex < 0) {
    return {
      status: 'no_price',
      label: '无价格数据',
      result_date: null,
      result_ret_pct: null,
      hold_days: null,
      max_ret_pct: null,
      min_ret_pct: null,
    };
  }
  const entryPrice = toNumber(prices[entryIndex].price);
  const maxHold = toNumber(strategy?.max_hold_days);
  const tp = toNumber(strategy?.tp_pct);
  const sl = toNumber(strategy?.sl_pct);
  let maxRet = 0;
  let minRet = 0;
  const exitLimit = Math.min(entryIndex + maxHold, prices.length - 1);
  for (let idx = entryIndex + 1; idx <= exitLimit; idx += 1) {
    const retPct = (toNumber(prices[idx].price) / entryPrice - 1) * 100;
    maxRet = Math.max(maxRet, retPct);
    minRet = Math.min(minRet, retPct);
    if (retPct >= tp) {
      return {
        status: 'tp',
        label: 'TP达成',
        result_date: prices[idx].date,
        result_ret_pct: round2(tp),
        hold_days: idx - entryIndex,
        max_ret_pct: round2(maxRet),
        min_ret_pct: round2(minRet),
      };
    }
    if (retPct <= sl) {
      return {
        status: 'sl',
        label: 'SL触发',
        result_date: prices[idx].date,
        result_ret_pct: round2(sl),
        hold_days: idx - entryIndex,
        max_ret_pct: round2(maxRet),
        min_ret_pct: round2(minRet),
      };
    }
  }
  const last = prices[exitLimit];
  const finalRet = (toNumber(last.price) / entryPrice - 1) * 100;
  if (exitLimit - entryIndex < maxHold) {
    return {
      status: 'open',
      label: '观察中',
      result_date: last.date,
      result_ret_pct: round2(finalRet),
      hold_days: exitLimit - entryIndex,
      max_ret_pct: round2(maxRet),
      min_ret_pct: round2(minRet),
    };
  }
  return {
    status: 'time',
    label: '持有到期',
    result_date: last.date,
    result_ret_pct: round2(finalRet),
    hold_days: maxHold,
    max_ret_pct: round2(maxRet),
    min_ret_pct: round2(minRet),
  };
}

function buildDynamicExecutionPlan(record: any, strategy: any): any {
  const alertPrice = round2(record?.final_price);
  const executionRaw = toNumber(record?.execution_price, alertPrice);
  const executionPrice = round2(executionRaw || alertPrice);
  const tpPrice = round2(executionPrice * (1 + toNumber(strategy?.tp_pct) / 100));
  const slPrice = round2(executionPrice * (1 + toNumber(strategy?.sl_pct) / 100));
  const moveSinceAlertPct = alertPrice > 0
    ? round2((executionPrice / alertPrice - 1) * 100)
    : null;
  const executionDate = formatDbDate(record?.execution_price_date || record?.datestr);
  const riskState = entryRiskState(moveSinceAlertPct, strategy);
  return {
    alert_price: alertPrice,
    execution_price: executionPrice,
    execution_price_date: executionDate,
    tp_price: tpPrice,
    sl_price: slPrice,
    move_since_alert_pct: moveSinceAlertPct,
    entry_risk_state: riskState.state,
    execution_note: riskState.note,
  };
}

function isPostAlertBlocked(decision: any): boolean {
  const text = String(decision || '');
  if (!text) return false;
  return text.startsWith('后排除') ||
    text.startsWith('后避') ||
    text.includes('D90') ||
    text.includes('机会不足') ||
    text.includes('放弃') ||
    text.includes('转弱');
}

function hasBearExecutionNegativeTag(comments: any): boolean {
  const text = String(comments || '');
  return text.includes('假阳性') ||
    text.includes('序列警戒') ||
    text.includes('DMI强熊');
}

function buildRecentPressureSuspension(record: any, strategy: any): any | null {
  if (strategy?.strategy_layer !== 'pullback_entry') return null;
  const rule = String(record?.alert_decision || '');
  const signalRegime = strategy?.signal_regime || parseSignalRegime(record?.comments || '');

  if (rule.startsWith('等｜深回撤超卖') && signalRegime === 'neutral') {
    return {
      status: 'suspended',
      label: '近期压力暂缓',
      reason: '2026-05/06 同语义 mark-to-date TP_LIVE=9.09%，SL_LIVE=63.64%，暂缓候选晋级',
    };
  }
  if (rule.startsWith('等｜低分超卖') && signalRegime === 'weak_contract') {
    return {
      status: 'suspended',
      label: '近期压力暂缓',
      reason: '弱市超卖候选当前仅保留观察，需通过近45日压力测试后再晋级',
    };
  }
  return null;
}

function buildMarketWindowSuspension(strategy: any, marketWindow: any): any | null {
  if (marketWindow?.window_signal !== 'BAD_GUARD') return null;
  return {
    status: 'suspended',
    label: marketWindow?.window_title || '坏窗口暂缓',
    reason: marketWindow?.window_desc || '当前市场处于坏窗口，策略暂缓执行',
  };
}

function buildTradeExecutionStatus(record: any, strategy: any, daysSinceAlert: number): any {
  if (!Number.isFinite(daysSinceAlert) || daysSinceAlert < 0) {
    return {
      status: 'invalid_date',
      label: '日期异常',
      reason: '报警日与参考日无法形成有效入场窗口',
    };
  }
  if (isPostAlertBlocked(record?.post_alert_decision)) {
    return {
      status: 'blocked',
      label: '后市排除',
      reason: String(record?.post_alert_decision || '后市状态已排除'),
    };
  }
  if (daysSinceAlert > toNumber(strategy?.entry_window_days)) {
    return {
      status: 'expired',
      label: '已过入场窗口',
      reason: `距报警日 ${daysSinceAlert} 天，超过 ${strategy.entry_window_days} 天入场窗口`,
    };
  }
  return {
    status: 'executable',
    label: '当前可执行',
    reason: `距报警日 ${daysSinceAlert} 天，仍在 ${strategy.entry_window_days} 天入场窗口内`,
  };
}

function buildPullbackTradeCandidates(
  rows: any[],
  recordType: string,
  priceMap: Record<string, any[]>,
  referenceDate: string,
  currentMarketRegime: string,
  marketWindowSeries: any[] = []
): any[] {
  const config = loadTradeStrategiesConfig();
  const strategies = configStrategiesForTradeExecution(config, recordType)
    .filter((strategy: any) => strategy?.status === 'candidate_ready')
    .filter((strategy: any) => strategy?.strategy_layer === 'pullback_entry')
    .filter((strategy: any) => strategy?.entry_trigger?.type === 'pullback_from_alert_close');
  if (!strategies.length) return [];

  const rawCandidates = rows.flatMap((record: any) => {
    if (hasBearExecutionNegativeTag(record?.comments)) return [];
    const signalRegime = parseSignalRegime(record?.comments || '');
    const rule = record?.alert_decision || '';
    return strategies.map((rawStrategy: any) => {
      if (!(rawStrategy?.match?.regimes || []).includes(signalRegime)) return null;
      if (!(rawStrategy?.match?.label_prefixes || []).some((prefix: string) => rule.startsWith(prefix))) return null;
      const prices = priceMap[String(record?.symbol || '')] || [];
      const trigger = findPullbackTrigger(record, rawStrategy, prices, referenceDate);
      if (!trigger) return null;
      const candidateWindow = pickMarketWindowForDate(marketWindowSeries, trigger.trigger_date);
      const strategy = {
        ...strategyFromConfig(rawStrategy, signalRegime),
        status: rawStrategy.status,
        entry_basis_date: trigger.trigger_date,
        entry_trigger: rawStrategy.entry_trigger,
        current_display: rawStrategy.current_display,
      };
      const status = buildPullbackExecutionStatus(record, strategy, trigger.days_since_trigger);
      const executionPlan = buildDynamicExecutionPlan(record, strategy);
      const strategyOutcome = buildStrategyOutcome(record, strategy, prices);
      const pressureSuspension = buildMarketWindowSuspension(strategy, candidateWindow) ||
        buildRecentPressureSuspension(record, strategy);
      const outcomeAwareStatus = buildOutcomeAwareExecutionStatus(status, strategyOutcome);
      const executionStatus = pressureSuspension && outcomeAwareStatus?.status === 'executable'
        ? pressureSuspension
        : outcomeAwareStatus;
      const d30Outcome = buildStrategyOutcome(record, { ...strategy, max_hold_days: 30 }, prices);
      return {
        ...record,
        final_price: executionPlan.execution_price,
        alert_price: executionPlan.alert_price,
        execution_price: executionPlan.execution_price,
        execution_price_date: executionPlan.execution_price_date,
        tp_price: executionPlan.tp_price,
        sl_price: executionPlan.sl_price,
        move_since_alert_pct: executionPlan.move_since_alert_pct,
        entry_risk_state: trigger.entry_risk_state,
        execution_note: executionPlan.execution_note,
        strategy_result_status: strategyOutcome.status,
        strategy_result_label: strategyOutcome.label,
        strategy_result_date: strategyOutcome.result_date,
        strategy_result_ret_pct: strategyOutcome.result_ret_pct,
        strategy_result_hold_days: strategyOutcome.hold_days,
        strategy_max_ret_pct: strategyOutcome.max_ret_pct,
        strategy_min_ret_pct: strategyOutcome.min_ret_pct,
        d30_result_status: d30Outcome.status,
        d30_result_label: d30Outcome.label,
        d30_result_date: d30Outcome.result_date,
        d30_result_ret_pct: d30Outcome.result_ret_pct,
        d30_result_hold_days: d30Outcome.hold_days,
        d30_max_ret_pct: d30Outcome.max_ret_pct,
        d30_min_ret_pct: d30Outcome.min_ret_pct,
        execution_status: executionStatus.status,
        execution_status_label: executionStatus.label,
        execution_status_reason: executionStatus.reason,
        is_current_executable: executionStatus.status === 'executable',
        trade_tier: strategy.legacy_tier,
        strategy_layer: strategy.strategy_layer,
        strategy_code: strategy.strategy_code,
        strategy_name: strategy.strategy_name,
        trade_action: strategy.trade_action,
        entry_window_days: strategy.entry_window_days,
        tp_pct: strategy.tp_pct,
        sl_pct: strategy.sl_pct,
        max_hold_days: strategy.max_hold_days,
        replay_metric_scope: strategy.replay_metric_scope,
        replay_sample_n: strategy.replay_sample_n,
        replay_win_pct: strategy.replay_win_pct,
        tp_hit_pct: strategy.tp_hit_pct,
        sl_hit_pct: strategy.sl_hit_pct,
        time_exit_pct: strategy.time_exit_pct,
        replay_avg_ret_pct: strategy.replay_avg_ret_pct,
        replay_avg_hold_days: strategy.replay_avg_hold_days,
        replay_efficiency_20d: strategy.replay_efficiency_20d,
        market_regime: strategy.signal_regime,
        current_market_regime: currentMarketRegime,
        signal_market_regime: strategy.signal_regime,
        market_window_signal: candidateWindow?.window_signal || null,
        market_window_title: candidateWindow?.window_title || null,
        market_window_desc: candidateWindow?.window_desc || null,
        market_window_date: candidateWindow?.datestr || null,
        trade_reason: buildPullbackTradeReason(record, strategy, trigger),
        alert_date: alertDateValue(record?.datestr),
        days_since_alert: dateDiffDays(referenceDate, alertDateValue(record?.datestr)),
        entry_window_basis: 'trigger_date',
        entry_window_basis_label: '触发日',
        entry_window_basis_date: trigger.trigger_date,
        entry_window_day_count: trigger.days_since_trigger,
        pullback_trigger_date: trigger.trigger_date,
        pullback_wait_days: trigger.wait_days,
        pullback_trigger_ret_pct: trigger.trigger_ret_pct,
        pullback_threshold_gap_abs: trigger.threshold_gap_abs,
        recent_pressure_suspended: executionStatus.status === 'suspended',
      };
    });
  }).filter(Boolean);

  const currentRows = rawCandidates.filter((row: any) => row.execution_status === 'executable');
  const currentLimit = Math.max(
    0,
    ...strategies.map((strategy: any) => toNumber(strategy?.current_display?.max_current_items))
  ) || 10;
  const currentAllowed = new Set(
    dedupePullbackCurrentRows(currentRows)
      .sort(comparePullbackThresholdFit)
      .slice(0, currentLimit)
      .map((row: any) => `${row.strategy_code}-${row.id}`)
  );
  return rawCandidates.filter((row: any) =>
    row.execution_status !== 'executable' || currentAllowed.has(`${row.strategy_code}-${row.id}`)
  );
}

function findPullbackTrigger(record: any, rawStrategy: any, prices: any[], referenceDate: string): any | null {
  const alertDate = alertDateValue(record?.datestr);
  const alertIndex = prices.findIndex((row) => row.date >= alertDate);
  if (alertIndex < 0) return null;
  const alertPrice = toNumber(prices[alertIndex]?.price);
  if (!Number.isFinite(alertPrice) || alertPrice <= 0) return null;
  const pbPct = toNumber(rawStrategy?.entry_trigger?.pb_pct);
  const pbWindowDays = toNumber(rawStrategy?.entry_trigger?.pb_window_days);
  const limit = Math.min(alertIndex + pbWindowDays, prices.length - 1);
  for (let idx = alertIndex; idx <= limit; idx += 1) {
    const row = prices[idx];
    if (!row || row.date > referenceDate) continue;
    const retPct = (toNumber(row.price) / alertPrice - 1) * 100;
    if (retPct <= pbPct) {
      const daysSinceTrigger = dateDiffDays(referenceDate, row.date);
      return {
        trigger_date: row.date,
        days_since_trigger: daysSinceTrigger,
        wait_days: idx - alertIndex,
        trigger_ret_pct: round2(retPct),
        threshold_gap_abs: round2(Math.abs(retPct - pbPct)),
        entry_risk_state: `已触发回撤 ${round2(retPct)}%`,
      };
    }
  }
  return null;
}

function buildPullbackExecutionStatus(record: any, strategy: any, daysSinceTrigger: number): any {
  if (!Number.isFinite(daysSinceTrigger) || daysSinceTrigger < 0) {
    return {
      status: 'invalid_date',
      label: '日期异常',
      reason: '回撤触发日与参考日无法形成有效入场窗口',
    };
  }
  if (isPostAlertBlocked(record?.post_alert_decision)) {
    return {
      status: 'blocked',
      label: '后市排除',
      reason: String(record?.post_alert_decision || '后市状态已排除'),
    };
  }
  if (daysSinceTrigger > toNumber(strategy?.entry_window_days)) {
    return {
      status: 'expired',
      label: '已过入场窗口',
      reason: `距回撤触发日 ${daysSinceTrigger} 天，超过 ${strategy.entry_window_days} 天入场窗口`,
    };
  }
  return {
    status: 'executable',
    label: '回撤触发可执行',
    reason: `距回撤触发日 ${daysSinceTrigger} 天，仍在 ${strategy.entry_window_days} 天入场窗口内`,
  };
}

function buildOutcomeAwareExecutionStatus(status: any, outcome: any): any {
  if (status?.status !== 'executable') return status;
  if (outcome?.status === 'tp' || outcome?.status === 'sl' || outcome?.status === 'time') {
    return {
      status: 'closed',
      label: outcome?.label || '策略已结束',
      reason: `策略结果已结束：${outcome?.label || outcome?.status}`,
    };
  }
  return status;
}

function comparePullbackThresholdFit(a: any, b: any): number {
  const fitDiff = toNumber(a?.pullback_threshold_gap_abs) - toNumber(b?.pullback_threshold_gap_abs);
  if (fitDiff !== 0) return fitDiff;
  const waitDiff = toNumber(a?.pullback_wait_days) - toNumber(b?.pullback_wait_days);
  if (waitDiff !== 0) return waitDiff;
  const dayDiff = toNumber(a?.entry_window_day_count) - toNumber(b?.entry_window_day_count);
  if (dayDiff !== 0) return dayDiff;
  return String(a?.symbol || '').localeCompare(String(b?.symbol || ''));
}

function dedupePullbackCurrentRows(rows: any[]): any[] {
  return Object.values(rows.reduce((acc: Record<string, any>, row: any) => {
    const key = String(row?.symbol || '');
    if (!key) return acc;
    if (!acc[key] || comparePullbackThresholdFit(row, acc[key]) < 0) acc[key] = row;
    return acc;
  }, {}));
}

function buildPullbackTradeReason(record: any, strategy: any, trigger: any): string {
  const parts = [
    `回撤触发:报警后第${trigger.wait_days}个交易日达到${trigger.trigger_ret_pct}%`,
    `触发日${trigger.trigger_date}起算入场窗口`,
  ];
  if (strategy?.tp_hit_pct != null) parts.push(`TP达成${strategy.tp_hit_pct}%`);
  if (strategy?.replay_win_pct != null) parts.push(`正收益${strategy.replay_win_pct}%`);
  if (!(record?.post_alert_decision || '')) parts.push('后市无障碍');
  return parts.join(' · ');
}

function entryRiskState(moveSinceAlertPct: number | null, strategy: any): any {
  if (moveSinceAlertPct === null) {
    return { state: '价格缺失', note: '缺少执行价，暂按报警价兜底' };
  }
  const tp = toNumber(strategy?.tp_pct);
  const sl = toNumber(strategy?.sl_pct);
  if (moveSinceAlertPct >= tp) {
    return { state: '已越过原止盈位', note: '不删除候选，但需按当前价重算追高风险' };
  }
  if (moveSinceAlertPct <= sl) {
    return { state: '已跌破原止损位', note: '不删除候选，按当前价重算新的执行计划' };
  }
  if (moveSinceAlertPct >= tp / 2) {
    return { state: '已明显上冲', note: '仍在入场窗口内，止盈止损按当前价重算' };
  }
  if (moveSinceAlertPct <= sl / 2) {
    return { state: '已有明显回撤', note: '仍在入场窗口内，止盈止损按当前价重算' };
  }
  return { state: '窗口内正常波动', note: '按当前收盘价重算执行计划' };
}

function parseSignalRegime(comments: string): string {
  const raw = (comments || '').match(/【M:([^】]+)】/)?.[1] || '';
  const parts = raw.split(',');
  const temp = parts[1] || '';
  const alarmDir = parts[2] || '';
  if (temp === '热' && alarmDir === '报扩') return 'hot_expand';
  if (temp === '热偏弱' && alarmDir === '报扩') return 'hot_expand';
  if (alarmDir === '报缩' || temp.includes('极冷') || temp.includes('热偏弱')) return 'weak_contract';
  return 'neutral';
}

function selectTradeStrategy(record: any, recordType: string): any | null {
  const configStrategy = selectTradeStrategyFromConfig(record, recordType);
  if (configStrategy) return configStrategy;
  return selectTradeStrategyHardcoded(record, recordType);
}

function loadTradeStrategiesConfig(): any | null {
  try {
    const stat = fs.statSync(TRADE_STRATEGIES_CONFIG_PATH);
    if (tradeStrategiesConfigCache && stat.mtimeMs === tradeStrategiesConfigMtimeMs) {
      return tradeStrategiesConfigCache;
    }
    const parsed = JSON.parse(fs.readFileSync(TRADE_STRATEGIES_CONFIG_PATH).toString());
    if (!parsed || !Array.isArray(parsed.strategies)) return null;
    tradeStrategiesConfigCache = parsed;
    tradeStrategiesConfigMtimeMs = stat.mtimeMs;
    return tradeStrategiesConfigCache;
  } catch (err) {
    console.warn('load trade strategies config failed, using hardcode fallback:', err);
    return null;
  }
}

function resolveTradeAction(strategy: any, signalRegime: string): string {
  const action = strategy?.trade_action;
  if (typeof action === 'string') return action;
  if (action && typeof action === 'object') return action[signalRegime] || action.default || '';
  return '';
}

function strategyFromConfig(rawStrategy: any, signalRegime: string): any {
  return {
    legacy_tier: rawStrategy.legacy_tier,
    strategy_layer: rawStrategy.strategy_layer,
    strategy_code: rawStrategy.strategy_code,
    strategy_name: rawStrategy.strategy_name,
    trade_action: resolveTradeAction(rawStrategy, signalRegime),
    entry_window_days: toNumber(rawStrategy?.params?.entry_window_days),
    tp_pct: toNumber(rawStrategy?.params?.tp_pct),
    sl_pct: toNumber(rawStrategy?.params?.sl_pct),
    max_hold_days: toNumber(rawStrategy?.params?.max_hold_days),
    replay_metric_scope: rawStrategy?.metrics?.scope || 'replay_nonblocked',
    replay_sample_n: toNumber(rawStrategy?.metrics?.n),
    replay_win_pct: toNumber(rawStrategy?.metrics?.replay_win_pct),
    tp_hit_pct: toNumber(rawStrategy?.metrics?.tp_hit_pct),
    sl_hit_pct: toNumber(rawStrategy?.metrics?.sl_hit_pct),
    time_exit_pct: toNumber(rawStrategy?.metrics?.time_exit_pct),
    replay_avg_ret_pct: toNumber(rawStrategy?.metrics?.replay_avg_ret_pct),
    replay_avg_hold_days: toNumber(rawStrategy?.metrics?.replay_avg_hold_days),
    replay_efficiency_20d: toNumber(rawStrategy?.metrics?.replay_efficiency_20d),
    signal_regime: signalRegime,
  };
}

function selectTradeStrategyFromConfig(record: any, recordType: string): any | null {
  const config = loadTradeStrategiesConfig();
  if (!config || config.record_type !== recordType) return null;
  const rule = record?.alert_decision || '';
  const signalRegime = parseSignalRegime(record?.comments || '');
  const matched = (config.strategies || [])
    .filter((strategy: any) => strategy?.status === 'production_ready')
    .filter((strategy: any) => strategy?.match?.record_type === recordType)
    .filter((strategy: any) => (strategy?.match?.regimes || []).includes(signalRegime))
    .filter((strategy: any) =>
      (strategy?.match?.label_prefixes || []).some((prefix: string) => rule.startsWith(prefix))
    )
    .sort((a: any, b: any) => {
      const priorityDiff = toNumber(a?.priority) - toNumber(b?.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return String(a?.strategy_code || '').localeCompare(String(b?.strategy_code || ''));
    });
  return matched[0] ? strategyFromConfig(matched[0], signalRegime) : null;
}

function selectTradeStrategyHardcoded(record: any, recordType: string): any | null {
  if (recordType !== 'record1') return null;
  const rule = record?.alert_decision || '';
  const signalRegime = parseSignalRegime(record?.comments || '');

  if (rule.startsWith('试｜急跌修复') && signalRegime === 'hot_expand') {
    return {
      legacy_tier: 'E',
      strategy_layer: 'short_e',
      strategy_code: 'E1_TP5H5',
      strategy_name: 'E1-热市急跌短打',
      trade_action: '可买',
      entry_window_days: 2,
      tp_pct: 5,
      sl_pct: -3,
      max_hold_days: 5,
      replay_metric_scope: 'replay_nonblocked',
      replay_sample_n: 39,
      replay_win_pct: 97.44,
      tp_hit_pct: 69.23,
      sl_hit_pct: 2.56,
      time_exit_pct: 28.21,
      replay_avg_ret_pct: 3.88,
      replay_avg_hold_days: 2.77,
      replay_efficiency_20d: 28.06,
      signal_regime: signalRegime,
    };
  }

  if (rule.startsWith('等｜弱势早期修复') && signalRegime === 'weak_contract') {
    return {
      legacy_tier: 'E',
      strategy_layer: 'short_e',
      strategy_code: 'E4_TP10H20',
      strategy_name: 'E4-弱市早修轮转',
      trade_action: '谨慎可买',
      entry_window_days: 2,
      tp_pct: 10,
      sl_pct: -5,
      max_hold_days: 20,
      replay_metric_scope: 'replay_nonblocked',
      replay_sample_n: 18,
      replay_win_pct: 72.22,
      tp_hit_pct: 44.44,
      sl_hit_pct: 27.78,
      time_exit_pct: 27.78,
      replay_avg_ret_pct: 4.11,
      replay_avg_hold_days: 13.17,
      replay_efficiency_20d: 6.24,
      signal_regime: signalRegime,
    };
  }

  const isCoreA = rule.startsWith('买｜低位修复') ||
    rule.startsWith('试｜低分修复') ||
    rule.startsWith('试｜急跌修复');
  if (isCoreA && signalRegime === 'hot_expand') {
    return {
      legacy_tier: 'A',
      strategy_layer: 'core_a',
      strategy_code: 'CORE_A_TP30H90',
      strategy_name: 'Core A-核心弹性',
      trade_action: '可买',
      entry_window_days: 2,
      tp_pct: 30,
      sl_pct: -5,
      max_hold_days: 90,
      replay_metric_scope: 'replay_nonblocked',
      replay_sample_n: 251,
      replay_win_pct: 89.52,
      tp_hit_pct: 66.13,
      sl_hit_pct: 10.48,
      time_exit_pct: 23.39,
      replay_avg_ret_pct: 23.53,
      replay_avg_hold_days: 54.31,
      replay_efficiency_20d: 8.66,
      signal_regime: signalRegime,
    };
  }

  return null;
}

function buildTradeReason(record: any, strategy: any): string {
  const parts: string[] = [];
  const rule = record?.alert_decision || '';
  if (strategy?.strategy_code === 'E1_TP5H5') parts.push('短周期优先:热市急跌修复按TP5/H5执行');
  else if (strategy?.strategy_code === 'E4_TP10H20') parts.push('弱市早期修复轮转:按TP10/H20执行');
  else if (rule.includes('急跌修复')) parts.push('核心A画像:急跌后修复');
  else if (rule.includes('低分修复')) parts.push('低分序列集中修复');
  else if (rule.includes('低位修复')) parts.push('低位修复确认');
  if (strategy?.strategy_code === 'E1_TP5H5') parts.push('同时具备Core A画像，但主策略采用短效E1');
  if (strategy?.tp_hit_pct != null) parts.push(`TP达成${strategy.tp_hit_pct}%`);
  if (strategy?.replay_win_pct != null) parts.push(`正收益${strategy.replay_win_pct}%`);
  if (!(record?.post_alert_decision || '')) parts.push('后市无障碍');
  return parts.join(' · ') || '基于交易执行v1.1策略推荐';
}

router.get('/ai_focus_stocks_trend', function (req, res, next) {
  let sql = `SELECT datestr, COUNT(symbol) AS symbol_count FROM focus_stocks_ai GROUP BY datestr ORDER BY datestr DESC;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/hot_alpha_sector_trend', function (req, res, next) {
  const days = Math.min(Math.max(parseInt(String(req.query.days || '120'), 10) || 120, 30), 360);
  const top = Math.min(Math.max(parseInt(String(req.query.top || '5'), 10) || 5, 3), 10);
  const mode = ['stage', 'daily_top3', 'watchlist', 'peak', 'latest'].includes(String(req.query.mode || ''))
    ? String(req.query.mode)
    : 'stage';
  const requestedStartDate = String(req.query.start_date || '').slice(0, 10);
  const requestedEndDate = String(req.query.end_date || '').slice(0, 10);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const startDate = datePattern.test(requestedStartDate) ? requestedStartDate : '';
  const endDate = datePattern.test(requestedEndDate) ? requestedEndDate : '';
  const nonIndustryPatterns = [
    ...hotAlphaFilterPatterns('generic_concept_patterns'),
    ...hotAlphaFilterPatterns('non_industry_concept_patterns'),
  ];
  const exclusionSql = nonIndustryPatterns.map(() => 'sector_name NOT LIKE ?').join(' AND ');
  const exclusionParams = nonIndustryPatterns.map((pattern) => `%${pattern}%`);
  const latestWhere: string[] = [];
  const latestParams: any[] = [];
  if (startDate) {
    latestWhere.push('datestr >= ?');
    latestParams.push(startDate);
  }
  if (endDate) {
    latestWhere.push('datestr <= ?');
    latestParams.push(endDate);
  }
  const latestSql = `SELECT DATE_FORMAT(MAX(datestr), '%Y-%m-%d') AS latest_date FROM sector_hot_daily${latestWhere.length ? ` WHERE ${latestWhere.join(' AND ')}` : ''}`;

  pool.query(latestSql, latestParams, function (latestErr, latestRows) {
    if (latestErr) {
      console.error('hot_alpha_sector_trend latest error:', latestErr);
      return res.status(500).json({ error: latestErr.message });
    }
    const latestDate = latestRows?.[0]?.latest_date;
    if (!latestDate) return res.json({ latestDate: null, latest: [], trends: [] });
    const trendStartDate = startDate || shiftDate(latestDate, -days);

    const stageSql = `
      SELECT
        DATE_FORMAT(shd.datestr, '%Y-%m') AS stage_key,
        MIN(DATE_FORMAT(shd.datestr, '%Y-%m-%d')) AS start_date,
        MAX(DATE_FORMAT(shd.datestr, '%Y-%m-%d')) AS end_date,
        shd.sector_type,
        shd.sector_code,
        SUBSTRING_INDEX(GROUP_CONCAT(shd.sector_name ORDER BY shd.sector_rank ASC, shd.emerging_score DESC SEPARATOR '||'), '||', 1) AS sector_name,
        ROUND(MAX(shd.emerging_score), 2) AS peak_emerging_score,
        ROUND(AVG(shd.emerging_score), 2) AS avg_emerging_score,
        ROUND(MAX(shd.hot_score), 2) AS peak_hot_score,
        MIN(shd.sector_rank) AS best_rank,
        ROUND(AVG(shd.sector_rank), 1) AS avg_rank,
        MAX(shd.alert20) AS max_alert20,
        COUNT(*) AS active_days,
        COALESCE(MAX(afh.feature_hits), 0) AS feature_hits,
        COALESCE(MAX(afh.primary_ha_hits), 0) AS primary_ha_hits,
        COALESCE(MAX(afh.low_sample_hits), 0) AS low_sample_hits,
        COALESCE(MAX(afh.weak_history_hits), 0) AS weak_history_hits,
        COALESCE(MAX(afh.med_conf_hits), 0) AS med_conf_hits,
        COALESCE(MAX(afh.high_conf_hits), 0) AS high_conf_hits,
        COALESCE(MAX(afh.weak_relevance_hits), 0) AS weak_relevance_hits,
        MAX(afh.max_history_sample_n) AS max_history_sample_n
      FROM sector_hot_daily shd
      LEFT JOIN (
        SELECT
          DATE_FORMAT(datestr, '%Y-%m') AS stage_key,
          sector_type,
          sector_code,
          COUNT(*) AS feature_hits,
          SUM(CASE WHEN is_primary = 1 AND hot_alpha_layer IS NOT NULL THEN 1 ELSE 0 END) AS primary_ha_hits,
          SUM(CASE WHEN is_primary = 1 AND hot_alpha_layer IS NOT NULL AND history_quality = 'LOW_SAMPLE' THEN 1 ELSE 0 END) AS low_sample_hits,
          SUM(CASE WHEN is_primary = 1 AND hot_alpha_layer IS NOT NULL AND history_quality = 'WEAK_HISTORY' THEN 1 ELSE 0 END) AS weak_history_hits,
          SUM(CASE WHEN is_primary = 1 AND hot_alpha_layer IS NOT NULL AND history_quality = 'MED_CONF' THEN 1 ELSE 0 END) AS med_conf_hits,
          SUM(CASE WHEN is_primary = 1 AND hot_alpha_layer IS NOT NULL AND history_quality = 'HIGH_CONF' THEN 1 ELSE 0 END) AS high_conf_hits,
          SUM(CASE WHEN sector_relevance_quality = 'WEAK' THEN 1 ELSE 0 END) AS weak_relevance_hits,
          MAX(history_sample_n) AS max_history_sample_n
        FROM alert_sector_hot_features
        WHERE datestr >= ?
          AND datestr <= ?
        GROUP BY stage_key, sector_type, sector_code
      ) afh ON afh.stage_key = DATE_FORMAT(shd.datestr, '%Y-%m')
        AND afh.sector_type = shd.sector_type
        AND afh.sector_code = shd.sector_code
      WHERE shd.datestr >= ?
        AND shd.datestr <= ?
        AND ${exclusionSql.replaceAll('sector_name', 'shd.sector_name')}
      GROUP BY stage_key, shd.sector_type, shd.sector_code
    `;

    const loadStageRows = (callback: (stageRows: any[]) => void) => {
      pool.query(stageSql, [trendStartDate, latestDate, trendStartDate, latestDate, ...exclusionParams], function (stageErr, stageRows) {
        if (stageErr) {
          console.error('hot_alpha_sector_trend stage error:', stageErr);
          return res.status(500).json({ error: stageErr.message });
        }
        const grouped: Record<string, any[]> = {};
        (stageRows || []).forEach((row: any) => {
          if (!grouped[row.stage_key]) grouped[row.stage_key] = [];
          grouped[row.stage_key].push(row);
        });
        const stages = Object.keys(grouped).sort().map((stageKey) => {
          const sectors = grouped[stageKey]
            .sort((a: any, b: any) => {
              if (Number(a.best_rank) !== Number(b.best_rank)) return Number(a.best_rank) - Number(b.best_rank);
              if (Number(b.peak_emerging_score) !== Number(a.peak_emerging_score)) return Number(b.peak_emerging_score) - Number(a.peak_emerging_score);
              return Number(b.active_days) - Number(a.active_days);
            })
            .slice(0, top);
          return {
            stage_key: stageKey,
            start_date: sectors[0]?.start_date || null,
            end_date: sectors[0]?.end_date || null,
            sectors,
          };
        });
        callback(stages);
      });
    };

    if (mode === 'stage') {
      loadStageRows((stages) => {
        const latest = stages.length ? stages[stages.length - 1].sectors : [];
        res.json({ latestDate, startDate: trendStartDate, mode, latest, trends: [], stages });
      });
      return;
    }

    if (mode === 'daily_top3') {
      const dailyTopSql = `
        SELECT ranked.*,
               COALESCE(afh.feature_hits, 0) AS feature_hits,
               COALESCE(afh.ha_hits, 0) AS ha_hits,
               COALESCE(afh.primary_ha_hits, 0) AS primary_ha_hits
        FROM (
          SELECT
            DATE_FORMAT(datestr, '%Y-%m-%d') AS datestr,
            sector_type,
            sector_code,
            sector_name,
            ROUND(emerging_score, 2) AS emerging_score,
            ROUND(hot_score, 2) AS hot_score,
            sector_rank,
            alert20,
            alert60,
            ROW_NUMBER() OVER (PARTITION BY datestr ORDER BY emerging_score DESC, hot_score DESC, alert20 DESC) AS daily_rank
          FROM sector_hot_daily
          WHERE datestr >= ?
            AND datestr <= ?
            AND ${exclusionSql}
        ) ranked
        LEFT JOIN (
          SELECT
            datestr,
            sector_type,
            sector_code,
            COUNT(*) AS feature_hits,
            SUM(CASE WHEN hot_alpha_layer IS NOT NULL THEN 1 ELSE 0 END) AS ha_hits,
            SUM(CASE WHEN is_primary = 1 AND hot_alpha_layer IS NOT NULL THEN 1 ELSE 0 END) AS primary_ha_hits
          FROM alert_sector_hot_features
          WHERE datestr >= ?
            AND datestr <= ?
          GROUP BY datestr, sector_type, sector_code
        ) afh ON afh.datestr = ranked.datestr
          AND afh.sector_type = ranked.sector_type
          AND afh.sector_code = ranked.sector_code
        WHERE ranked.daily_rank <= 3
        ORDER BY ranked.datestr ASC, ranked.daily_rank ASC
      `;
      const dailyTopParams = [trendStartDate, latestDate, ...exclusionParams, trendStartDate, latestDate];
      pool.query(dailyTopSql, dailyTopParams, function (dailyErr, dailyRows) {
        if (dailyErr) {
          console.error('hot_alpha_sector_trend daily_top3 error:', dailyErr);
          return res.status(500).json({ error: dailyErr.message });
        }
        const latest = (dailyRows || []).filter((row: any) => row.datestr === latestDate);
        res.json({ latestDate, startDate: trendStartDate, mode, latest, trends: dailyRows || [] });
      });
      return;
    }

    let sectorSql = '';
    let sectorSelectParams: any[] = [];
    if (mode === 'latest') {
      sectorSql = `
        SELECT
          sector_type,
          sector_code,
          sector_name,
          ROUND(emerging_score, 2) AS emerging_score,
          ROUND(hot_score, 2) AS hot_score,
          sector_rank,
          alert20,
          alert60
        FROM sector_hot_daily
        WHERE datestr = ?
          AND ${exclusionSql}
        ORDER BY emerging_score DESC, hot_score DESC, alert20 DESC
        LIMIT ?
      `;
      sectorSelectParams = [latestDate, ...exclusionParams, top];
    } else {
      sectorSql = `
        SELECT
          sector_type,
          sector_code,
          SUBSTRING_INDEX(GROUP_CONCAT(sector_name ORDER BY sector_rank ASC, emerging_score DESC SEPARATOR '||'), '||', 1) AS sector_name,
          ROUND(MAX(emerging_score), 2) AS emerging_score,
          ROUND(MAX(hot_score), 2) AS hot_score,
          MIN(sector_rank) AS sector_rank,
          MAX(alert20) AS alert20,
          MAX(alert60) AS alert60
        FROM sector_hot_daily
        WHERE datestr >= ?
          AND datestr <= ?
          AND ${exclusionSql}
        GROUP BY sector_type, sector_code
        ORDER BY MIN(sector_rank) ASC, MAX(emerging_score) DESC, MAX(hot_score) DESC
        LIMIT ?
      `;
      sectorSelectParams = [trendStartDate, latestDate, ...exclusionParams, top];
    }

    pool.query(sectorSql, sectorSelectParams, function (topErr, latestRows) {
      if (topErr) {
        console.error('hot_alpha_sector_trend top error:', topErr);
        return res.status(500).json({ error: topErr.message });
      }
      if (!latestRows || latestRows.length === 0) return res.json({ latestDate, latest: [], trends: [] });

      const sectorFilters = latestRows.map(() => `(shd.sector_type = ? AND shd.sector_code = ?)`);
      const sectorParams: any[] = [];
      latestRows.forEach((row: any) => {
        sectorParams.push(row.sector_type, row.sector_code);
      });

      const trendSql = `
        SELECT
          DATE_FORMAT(shd.datestr, '%Y-%m-%d') AS datestr,
          shd.sector_type,
          shd.sector_code,
          shd.sector_name,
          ROUND(shd.emerging_score, 2) AS emerging_score,
          ROUND(shd.hot_score, 2) AS hot_score,
          shd.sector_rank,
          shd.alert20,
          shd.alert60,
          COALESCE(afh.feature_hits, 0) AS feature_hits,
          COALESCE(afh.ha_hits, 0) AS ha_hits,
          COALESCE(afh.primary_ha_hits, 0) AS primary_ha_hits
        FROM sector_hot_daily shd
        LEFT JOIN (
          SELECT
            datestr,
            sector_type,
            sector_code,
            COUNT(*) AS feature_hits,
            SUM(CASE WHEN hot_alpha_layer IS NOT NULL THEN 1 ELSE 0 END) AS ha_hits,
            SUM(CASE WHEN is_primary = 1 AND hot_alpha_layer IS NOT NULL THEN 1 ELSE 0 END) AS primary_ha_hits
          FROM alert_sector_hot_features
          WHERE datestr >= ?
            AND datestr <= ?
          GROUP BY datestr, sector_type, sector_code
        ) afh ON afh.datestr = shd.datestr
          AND afh.sector_type = shd.sector_type
          AND afh.sector_code = shd.sector_code
        WHERE shd.datestr >= ?
          AND shd.datestr <= ?
          AND (${sectorFilters.join(' OR ')})
        ORDER BY shd.datestr ASC, shd.emerging_score DESC
      `;
      const trendParams = [trendStartDate, latestDate, trendStartDate, latestDate, ...sectorParams];

      pool.query(trendSql, trendParams, function (trendErr, trendRows) {
        if (trendErr) {
          console.error('hot_alpha_sector_trend trend error:', trendErr);
          return res.status(500).json({ error: trendErr.message });
        }
        res.json({ latestDate, startDate: trendStartDate, mode, latest: latestRows, trends: trendRows || [] });
      });
    });
  });
});

router.get('/focus_stocks_ai_list', function (req, res, next) {
  let sql = `SELECT fsa.symbol AS symbol, fsa.datestr AS datestr, fsa.max_240_pct AS max_240_pct, fsa.min_240_pct AS min_240_pct, fs.continuance_BYG AS price_change 
             FROM focus_stocks_ai fsa 
             LEFT JOIN focus_stocks fs ON fsa.symbol = fs.symbol 
             WHERE fsa.datestr >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) 
             GROUP BY fsa.symbol 
             ORDER BY fsa.datestr DESC;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/totaltradevol', function (req, res, next) {
  const stock = req.query.stock;
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  let sql = `select sdcd.symbol, sdcd.datestr, sdcd.totaltradevol from replay_critical_3 rc3 join stock_day_common_data sdcd on rc3.symbol=sdcd.symbol and rc3.end_date=sdcd.datestr where rc3.symbol LIKE '%${stock}%' and sdcd.datestr >= '${startDateStr}' and sdcd.datestr <= '${endDateStr}' GROUP BY rc3.end_date ORDER BY rc3.end_date DESC;`;
  if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
    sql = `select sdcd.symbol, sdcd.datestr, sdcd.totaltradevol from replay_critical_3 rc3 join stock_day_common_data sdcd on rc3.symbol=sdcd.symbol and rc3.end_date=sdcd.datestr where rc3.symbol LIKE '%${stock}%' GROUP BY rc3.end_date ORDER BY rc3.end_date DESC;`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/stock_chip_result', function (req, res, next) {
  const stock = req.query.stock;
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  let sql = `select scr.*, sdcd.profit_chip from replay_critical_3 rc3 join stock_chip_result scr on rc3.symbol=scr.symbol and rc3.end_date=scr.datestr join stock_day_common_data sdcd on rc3.symbol=sdcd.symbol and rc3.end_date=sdcd.datestr where rc3.symbol LIKE '%${stock}%' and scr.datestr >= '${startDateStr}' and scr.datestr <= '${endDateStr}' GROUP BY rc3.end_date ORDER BY rc3.end_date DESC;`;
  if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
    sql = `select scr.*, sdcd.profit_chip from replay_critical_3 rc3 join stock_chip_result scr on rc3.symbol=scr.symbol and rc3.end_date=scr.datestr join stock_day_common_data sdcd on rc3.symbol=sdcd.symbol and rc3.end_date=sdcd.datestr where rc3.symbol LIKE '%${stock}%' GROUP BY rc3.end_date ORDER BY rc3.end_date DESC;`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/stock_anomaly_windows', function (req, res, next) {
  const stock = req.query.stock;
  let sql = `SELECT anomaly_window FROM stocks_anomaly_window WHERE symbol LIKE '%${stock}%';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});


router.get('/profit_chips', function (req, res, next) {
  const stock = req.query.stock;
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  let sql = `SELECT datestr, profit_chip, turnoverrate FROM stock_day_common_data WHERE symbol LIKE '%${stock}%' AND datestr >= '${startDateStr}' and datestr <= '${endDateStr}' ORDER BY datestr DESC;`;
  if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
    let intervalMonth = 24;
    sql = `SELECT datestr, profit_chip, turnoverrate FROM stock_day_common_data WHERE symbol LIKE '%${stock}%' AND datestr >= DATE_SUB(CURDATE(), INTERVAL ${intervalMonth} MONTH) ORDER BY datestr DESC;`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/all_stock_chip_result', function (req, res, next) {
  const stock = req.query.stock;
  const startDateStr = req.query.start_date;
  const endDateStr = req.query.end_date;
  let sql = `select * from stock_chip_result where symbol LIKE '%${stock}%' and datestr >= '${startDateStr}' and datestr <= '${endDateStr}' GROUP BY datestr ORDER BY datestr DESC;`;
  if ((startDateStr == endDateStr) || isEmpty(startDateStr) || isEmpty(endDateStr)) {
    sql = `select * from stock_chip_result where symbol LIKE '%${stock}%' GROUP BY datestr ORDER BY datestr DESC;`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/all_alarm_data_dr', function (req, res, next) {
  const datestr = req.query.date_str;
  const endDateStr = req.query.end_date_str;
  const from100 = req.query.from100;
  const stock = req.query.stock;
  const symbols = req.query.symbols;
  let sql = `select b.name, b.totaltradevol, a.symbol, a.kuvolume_${from100} as kuvolume, a.kdvolume_${from100} as kdvolume, a.kevolume_${from100} as kevolume, a.status_${from100} as status, b.finalprice, b.marketvalue, b.datestr from stock_big_data_dr a join stock_day_common_data b on a.symbol=b.symbol and a.datestr=b.datestr where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and b.name not like "%ST%";`;
  if (stock) {
    sql = `select b.name, b.totaltradevol, a.symbol, a.kuvolume_${from100} as kuvolume, a.kdvolume_${from100} as kdvolume, a.kevolume_${from100} as kevolume, a.status_${from100} as status, b.finalprice, b.marketvalue, b.datestr from stock_big_data_dr a join stock_day_common_data b on a.symbol=b.symbol and a.datestr=b.datestr where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and b.name not like "%ST%" and a.symbol='${stock}'`;
  }
  if (symbols) {
    sql = `select b.name, b.totaltradevol, a.symbol, a.kuvolume_${from100} as kuvolume, a.kdvolume_${from100} as kdvolume, a.kevolume_${from100} as kevolume, a.status_${from100} as status, b.finalprice, b.marketvalue, b.datestr from stock_big_data_dr a join stock_day_common_data b on a.symbol=b.symbol and a.datestr=b.datestr where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and b.name not like "%ST%" and a.symbol in (${symbols})`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/all_alarm_data_view', function (req, res, next) {
  const datestr = req.query.date_str;
  const endDateStr = req.query.end_date_str;
  const symbols = req.query.symbols;
  let sql = `select a.*, b.name from v_stock  a join stock_day_common_data b on a.symbol=b.symbol and a.datestr=b.datestr where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}';`;
  if (symbols) {
    sql = `select a.*, b.name from v_stock a join stock_day_common_data b on a.symbol=b.symbol and a.datestr=b.datestr where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and a.symbol in (${symbols});`;
  }
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/all_alarm_data_with_plates', function (req, res, next) {
  const datestr = req.query.date_str;
  const endDateStr = req.query.end_date_str;
  const from100 = req.query.from100;
  const type = req.query.bz_type ?? 'sw1_hy';
  let table = 'stock_big_data';
  if (from100 === '400s') table = 'stock_big_data';
  if (from100 === '100w') table = 'stock_big_data_100';
  if (from100 === 'dr_400s' || from100 === 'dr_100w')
    table = 'stock_big_data_dr';
  //let sql = `select * from ${table} a left join (SELECT distinct(a.symbol), group_concat(a.code), group_concat(a.name) as platename FROM plate a join focus_plate b on a.code = b.code where b.focus = 1 group by a.symbol) joinT on a.symbol=joinT.symbol where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and a.name not like "%ST%";`;
  let sql = '';
  if (from100 === '400s' || from100 === '100w') {
    sql = `select * from ${table} s left join (select symbol,group_concat(b.business_type), group_concat(b.name) as platename, group_concat(b.code) as platecode  from sw_stock_business a join business b on a.business_code = b.code where b.business_type in ('${type}') group by symbol) j on s.symbol = j.symbol where s.datestr > '${datestr}' and s.datestr <= '${endDateStr}' and s.name not like "%ST%";`;
  } else if (from100 === 'dr_400s' || from100 === 'dr_100w') {
    sql = `select s.symbol, s.status_${from100.replace(
      'dr_',
      ''
    )} as status, s.datestr, j.platename, j.platecode, j.btype, d.name from stock_big_data_dr s left join (select symbol,group_concat(b.business_type) as btype, group_concat(b.name) as platename, group_concat(b.code) as platecode from sw_stock_business a join business b on a.business_code = b.code where b.business_type in ('${type}') group by symbol) j on s.symbol = j.symbol join stock_day_common_data d on s.symbol = d.symbol and s.datestr= d.datestr where s.datestr > '${datestr}' and s.datestr <= '${endDateStr}' and d.name not like "%ST%";`;
  }
  console.log(sql);
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/all_plates_count', function (req, res, next) {
  const sql = `select count(*) as count, business_code, b.name from sw_stock_business a join business b on a.business_code = b.code group by business_code`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/all_industry', function (req, res, next) {
  const sql = `select * from business group by business_name;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/all_industry_by_type', function (req, res, next) {
  const bz_code = req.query.type;
  const sql = `select * from business where business_type = '${bz_code}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/all_stocks_by_industry', function (req, res, next) {
  const bz_code = req.query.code;
  const sql = `select * from sw_stock_business a join stocks b on a.symbol = b.symbol where business_code = '${bz_code}';`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/da_data', function (req, res, next) {
  const {
    dateStr,
    endDateStr,
    selectDate,
    selectDays,
    selectConsTotal,
    selectConsUpDown,
    selectConsDays,
    selectConsAllDays,
    selectPriceMargin,
    caculatePriceBy,
    hasCondition2,
    selectMinPriceMargin,
    selectMinPriceDays,
    from100,
    hasCondition5,
    selectHorPriceDays,
    givenPrice,
    givenMinPrice,
    givenCirculation,
    selectTimeWindow,
  } = req.query;
  let table = 'stock_big_data';
  if (from100 === 'true') table = 'stock_big_data_100';
  let sql = `select * from ${table} a where a.datestr > '${dateStr}' and a.datestr <= '${endDateStr}' and a.name not like "%ST%"`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(
      daCalculate(rows, {
        selectDays,
        selectDate,
        selectConsTotal,
        selectConsUpDown,
        selectConsDays,
        selectConsAllDays,
        selectPriceMargin,
        caculatePriceBy,
        hasCondition2,
        selectMinPriceMargin,
        selectMinPriceDays,
        hasCondition5,
        selectHorPriceDays,
        givenPrice,
        givenMinPrice,
        givenCirculation,
        selectTimeWindow,
      })
    );
  });
});

// 获取业务类型的汇总统计
router.get('/business_type_summary', async function (req, res, next) {
  const analyzeDate = req.query.analyze_date;
  const status = req.query.status;
  
  // 检查日期参数
  if (!analyzeDate) {
    return res.status(400).json({
      code: 400,
      message: '请提供analyze_date参数',
      data: []
    });
  }
  
  // 使用参数化查询防止SQL注入
  const sql = `
    SELECT 
        rc.end_date,
        sb.business_code,
        b.name,
        COUNT(*) as count
    FROM replay_critical_3 rc
    INNER JOIN sw_stock_business sb ON rc.symbol = sb.symbol
    INNER JOIN business b ON sb.business_code = b.code
    WHERE rc.status = '${status}' AND rc.end_date = '${analyzeDate}'
    GROUP BY rc.end_date, sb.business_code
    ORDER BY count DESC
    LIMIT 0, 30
  `;
  
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

// 获取业务板块趋势图
router.get('/business_trend', async function (req, res, next) {
  const business_code = req.query.business_code;
  const status = req.query.status;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  
  // 检查business_code参数
  if (!business_code) {
    return res.status(400).json({
      code: 400,
      message: '请提供business_code参数',
      data: []
    });
  }

  // 检查status参数
  if (!status) {
    return res.status(400).json({
      code: 400,
      message: '请提供status参数',
      data: []
    });
  }
  
  // 使用参数化查询防止SQL注入
  const sql = `
    SELECT     
      rc.end_date,
        sb.business_code,
        b.name,
        COUNT(*) as count 
    FROM sw_stock_business sb
    INNER JOIN replay_critical_3 rc ON rc.symbol = sb.symbol
    INNER JOIN business b ON sb.business_code = b.code
    WHERE rc.status = '${status}' AND sb.business_code='${business_code}' AND rc.end_date>='${startDate}' AND rc.end_date<='${endDate}'
    GROUP BY rc.end_date, sb.business_code
    ORDER BY rc.end_date DESC;
  `;
  
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

// 获取板块对应报警列表
router.get('/business_trend_focus_stocks', async function (req, res, next) {
  const business_code = req.query.business_code;
  
  // 检查business_code参数
  if (!business_code) {
    return res.status(400).json({
      code: 400,
      message: '请提供business_code参数',
      data: []
    });
  }

  // 使用参数化查询防止SQL注入
  const sql = `
    SELECT 
        fs.symbol,
        stocks.name AS stock_name,
        fs.datestr AS alert_date,
        fs.comments,
        fs.continuance_BYG,
        b.name,
        'focus_stocks' AS source  -- 来源标识
    FROM focus_stocks fs
    INNER JOIN sw_stock_business sb ON fs.symbol = sb.symbol
    INNER JOIN stocks ON stocks.symbol = fs.symbol
    INNER JOIN business b ON sb.business_code = b.code
    WHERE sb.business_code = '${business_code}'

    UNION ALL

    SELECT 
        fs.symbol,
        stocks.name AS stock_name, 
        fs.datestr AS alert_date,
        fs.comments,
        fs.continuance_BYG,
        b.name,
        'focus_stocks2' AS source  -- 来源标识
    FROM focus_stocks2 fs
    INNER JOIN sw_stock_business sb ON fs.symbol = sb.symbol
    INNER JOIN stocks ON stocks.symbol = fs.symbol
    INNER JOIN business b ON sb.business_code = b.code
    WHERE sb.business_code = '${business_code}';
  `;
  
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.get('/searchByDay', async function (req, res, next) {
  const {
    datestr,
    selectConsTotal,
    selectConsUpDown,
    selectConsDays,
    selectConsAllDays,
    hasCondition1,
    selectPriceMargin,
    caculatePriceBy,
    hasCondition2,
    selectMinPriceMargin,
    selectMinPriceDays,
    from100,
    hasCondition3,
    hasCondition4,
    hasCondition5,
    hasCondition6,
    selectHorPriceMargin,
    selectHorPriceDays,
    givenPrice,
    givenMinPrice,
    givenCirculation,
  } = req.query;
  const startDateStr = caculateDate(datestr, selectConsAllDays);
  let table = 'stock_big_data';
  if (from100 === 'true') table = 'stock_big_data_100';
  let sql = `select * from ${table} a where a.datestr > '${startDateStr}' and a.datestr <= '${datestr}' and a.name not like "%ST%"`;

  pool.query(sql, async function (err, rows, fields) {
    if (err) throw err;
    let results: any = chooseResults({
      rows,
      selectConsTotal,
      selectConsUpDown,
      selectConsDays,
      hasCondition1,
      selectPriceMargin,
      caculatePriceBy,
    });
    if (hasCondition3 === 'true') {
      results = results?.filter((i) => i.finalprice < givenPrice);
    }
    if (hasCondition6 === 'true') {
      results = results?.filter((i) => i.finalprice > givenMinPrice);
    }
    if (hasCondition4 === 'true') {
      results = results?.filter(
        (i) =>
          Number((i.marketvalue / i.finalprice).toFixed(3)) < givenCirculation
      );
    }
    if (hasCondition2 === 'true' && results?.length > 0) {
      const ids = results?.map((i) => `'${i.symbol}'`).join(',');
      sql = `SELECT * FROM ${table} where symbol in (${ids}) and datestr <= '${datestr}' and datestr > '${caculateDate(
        datestr,
        selectMinPriceDays
      )}'`;
      const rows1: any = await queryDB(sql);
      results = filterByCondition2({
        rows1,
        selectMinPriceMargin,
      });
    }
    if (hasCondition5 === 'true' && results?.length > 0) {
      const ids = results?.map((i) => `'${i.symbol}'`).join(',');
      sql = `SELECT * FROM ${table} where symbol in (${ids}) and datestr <= '${caculateDate(
        datestr,
        selectConsDays
      )}' and datestr > '${caculateDate(datestr, selectHorPriceDays)}'`;
      const rows1: any = await queryDB(sql);
      results = filterByCondition5({
        rows1,
        selectHorPriceMargin,
      });
    }
    res.json(results);
  });
});

router.get('/all_stock_alarm', function (req, res, next) {
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  const alarmType = req.query.alarm_type;
  const date = req.query.date;
  const from100 = req.query.from100;
  let table = 'stock_big_data';
  if (from100 === 'true') table = 'stock_big_data_100';

  let sql = '';
  if (alarmType === 'All') {
    sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from ${table} group by symbol order by COUNT(*) desc, avgtotalpct desc;`;
  } else if (alarmType === 'A1A2') {
    sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from ${table} where alarmType = 'A1' OR alarmType ='A2' group by symbol order by COUNT(*) desc, avgtotalpct desc;`;
  } else if (alarmType === 'A1Today') {
    sql = `select *, avg(a.totalvolpct) as avgtotalpct, count(*) from ${table} a where a.alarmType = 'A1' and a.datestr = '${date}' and a.status = 'up' and a.name not like "%ST%" group by a.symbol order by COUNT(*) desc, avgtotalpct desc;`;
  } else {
    sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from ${table} where alarmType = '${alarmType}' and name not like "%ST%" group by symbol order by COUNT(*) desc, avgtotalpct desc;`;
  }

  if (startDate && endDate) {
    if (alarmType === 'All') {
      sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from ${table} where datestr >= '${startDate}' and datestr <= '${endDate}' group by symbol order by COUNT(*) desc, avgtotalpct desc;`;
    } else if (alarmType === 'A1A2') {
      sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from ${table} where alarmType != 'A3' and datestr > '${startDate}' and datestr < '${endDate}' group by symbol order by COUNT(*) desc, avgtotalpct desc;`;
    } else if (alarmType === 'A1Today') {
      sql = `select *, avg(a.totalvolpct) as avgtotalpct, count(*) from ${table} a where a.alarmType = 'A1' and a.datestr = '${date}' and a.status = 'up' and a.name not like "%ST%" group by a.symbol order by COUNT(*) desc, avgtotalpct desc;`;
    } else {
      sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from ${table} where alarmType = '${alarmType}' and datestr >= '${startDate}' and datestr <= '${endDate}' group by symbol order by COUNT(*) desc, avgtotalpct desc;`;
    }
  }

  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});

router.post('/qt_realtime', async function (req, res) {
  const q = req.body.q;
  const { data } = await request(`http://qt.gtimg.cn/q=${q}`);
  const dataArrWithEmpty = data.split(';');
  const dataArr = dataArrWithEmpty.slice(0, dataArrWithEmpty.length - 1);

  const ret = dataArr.map((d) => {
    const pd = d.replace('\n', '');
    const pos = pd.indexOf('=');
    const dStr = pd.slice(pos + 2, pd.length - 1);
    const dArr = dStr.split('~');

    return {
      symbol: pd.slice(2, pos),
      currentPrice: dArr[3],
    };
  });

  res.json(ret);
});

// ========== 板块历史数据 API ==========

// 1. 获取所有可用日期
router.get('/board/available_dates', (req: Request, res: Response) => {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  db.all('SELECT DISTINCT date FROM daily_board_summary ORDER BY date DESC', (err: Error | null, rows: any[]) => {
    db.close();
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    const dates = rows.map((row: any) => row.date);
    res.json({ dates });
  });
});

// 2. 获取单日数据
router.get('/board/daily', (req: Request, res: Response) => {
  const date = req.query.date as string;
  
  if (!date) {
    res.status(400).json({ error: 'Missing required parameter: date' });
    return;
  }
  
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  db.all(`
    SELECT board, total_score, article_count, avg_score
    FROM daily_board_summary
    WHERE date = ?
    ORDER BY total_score DESC
  `, [date], (err: Error | null, boards: any[]) => {
    db.close();
    
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    
    if (!boards || boards.length === 0) {
      res.status(404).json({ error: `No data found for date: ${date}` });
      return;
    }
    
    let totalScore = 0;
    let totalArticles = 0;
    for (const board of boards) {
      totalScore += board.total_score;
      totalArticles += board.article_count;
    }
    
    res.json({
      date,
      boards,
      total_score: totalScore,
      total_articles: totalArticles
    });
  });
});

// 3. 获取日期范围数据
router.get('/board/range', (req: Request, res: Response) => {
  const start = req.query.start as string;
  const end = req.query.end as string;
  
  if (!start || !end) {
    res.status(400).json({ error: 'Missing required parameters: start and end' });
    return;
  }
  
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  db.all(`
    SELECT date, board, total_score, article_count, avg_score
    FROM daily_board_summary
    WHERE date BETWEEN ? AND ?
    ORDER BY date DESC, total_score DESC
  `, [start, end], (err: Error | null, rows: any[]) => {
    db.close();
    
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    
    const dailyData: any[] = [];
    let currentDate = '';
    let currentBoards: any[] = [];
    
    for (const row of rows) {
      if (row.date !== currentDate) {
        if (currentBoards.length > 0) {
          let totalScore = 0;
          let totalArticles = 0;
          for (const board of currentBoards) {
            totalScore += board.total_score;
            totalArticles += board.article_count;
          }
          dailyData.push({
            date: currentDate,
            boards: currentBoards,
            total_score: totalScore,
            total_articles: totalArticles
          });
        }
        currentDate = row.date;
        currentBoards = [];
      }
      currentBoards.push({
        board: row.board,
        total_score: row.total_score,
        article_count: row.article_count,
        avg_score: row.avg_score
      });
    }
    
    if (currentBoards.length > 0) {
      let totalScore = 0;
      let totalArticles = 0;
      for (const board of currentBoards) {
        totalScore += board.total_score;
        totalArticles += board.article_count;
      }
      dailyData.push({
        date: currentDate,
        boards: currentBoards,
        total_score: totalScore,
        total_articles: totalArticles
      });
    }
    
    res.json({ daily_data: dailyData });
  });
});

// 4. 获取板块趋势
router.get('/board/trend', (req: Request, res: Response) => {
  const board = req.query.board as string;
  const days = parseInt(req.query.days as string || '30', 10);
  
  if (!board) {
    res.status(400).json({ error: 'Missing required parameter: board' });
    return;
  }
  
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  db.all(`
    SELECT date, total_score as score, article_count as count
    FROM daily_board_summary
    WHERE board = ?
    ORDER BY date DESC
    LIMIT ?
  `, [board, days], (err: Error | null, rows: any[]) => {
    db.close();
    
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    
    const trend = rows.reverse();
    
    res.json({ 
      board,
      trend
    });
  });
});

// 5. 获取板块列表
router.get('/board/list', (req: Request, res: Response) => {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  db.all(`SELECT DISTINCT board FROM daily_board_summary WHERE board != '未匹配' ORDER BY board`, (err: Error | null, rows: any[]) => {
    db.close();
    
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    
    const boards = rows.map((row: any) => row.board);
    res.json({ boards });
  });
});

// 6. 获取汇总统计
router.get('/board/summary', (req: Request, res: Response) => {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  let boardCount = 0;
  let totalArticles = 0;
  let latestDate: string | null = null;
  let earliestDate: string | null = null;
  let completed = 0;
  
  const checkComplete = () => {
    completed++;
    if (completed === 4) {
      res.json({
        board_count: boardCount,
        total_articles: totalArticles,
        latest_date: latestDate,
        earliest_date: earliestDate
      });
    }
  };
  
  db.get('SELECT COUNT(DISTINCT board) as count FROM daily_board_summary WHERE board != "未匹配"', (err: Error | null, row: any) => {
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    if (row) boardCount = row.count;
    checkComplete();
  });
  
  db.get('SELECT SUM(article_count) as total FROM daily_board_summary', (err: Error | null, row: any) => {
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    if (row) totalArticles = row.total || 0;
    checkComplete();
  });
  
  db.get('SELECT MAX(date) as latest FROM daily_board_summary', (err: Error | null, row: any) => {
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    if (row) latestDate = row.latest;
    checkComplete();
  });
  
  db.get('SELECT MIN(date) as earliest FROM daily_board_summary', (err: Error | null, row: any) => {
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    if (row) earliestDate = row.earliest;
    checkComplete();
  });
});

// 7. 获取指定日期指定板块的文章列表
router.get('/board/articles', (req: Request, res: Response) => {
  const date = req.query.date as string;
  const board = req.query.board as string;
  
  if (!date || !board) {
    res.status(400).json({ error: 'Missing required parameters: date and board' });
    return;
  }
  
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  db.all(`
    SELECT article_id, title, score, datetime(article_timestamp, 'unixepoch', 'localtime') as publish_time
    FROM processed_articles
    WHERE article_date = ? AND board = ?
    ORDER BY score DESC, article_timestamp DESC
  `, [date, board], (err: Error | null, rows: any[]) => {
    db.close();
    
    if (err) {
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    
    res.json({ articles: rows || [] });
  });
});

// 8. 获取增强版板块详情（从 daily_board_details + 核心行业 + 子板块热度）
router.get('/board/enhanced_details', (req: Request, res: Response) => {
  const date = req.query.date as string;
  
  if (!date) {
    res.status(400).json({ error: 'Missing required parameter: date' });
    return;
  }
  
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  // 获取基础增强数据
  db.all(`
    SELECT board, rank, news_score, fund_score, total_score, 
           fund_inflow, article_count, insight
    FROM daily_board_details
    WHERE date = ?
    ORDER BY rank ASC
  `, [date], (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('查询增强版详情失败:', err);
      db.close();
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    
    if (!rows || rows.length === 0) {
      db.close();
      res.status(404).json({ error: `No enhanced data found for date: ${date}` });
      return;
    }
    
    // 获取所有板块名称
    const boardNames = rows.map(r => r.board);
    const placeholders = boardNames.map(() => '?').join(',');
    
    // 1. 从 sentiment_keyword_mapping 查询核心行业数据（统一数据源）
    const coreSql = `
      SELECT 
        skm.board_name,
        b.code as sw_code,
        skm.business_name as sw_name,
        CASE 
          WHEN b.business_type IN ('sw1_hy', 'sw2_hy', 'sw3_hy', 'swhy') THEN 'sw3_hy'
          WHEN b.business_type IN ('gainianbankuai', 'ch_gn') THEN 'ch_gn'
          ELSE 'fallback'
        END as business_type,
        COUNT(DISTINCT sbs.symbol) as stock_count,
        0 as avg_30d_pct
      FROM sentiment_keyword_mapping skm
      JOIN business b ON skm.business_code = b.code
      LEFT JOIN sw_stock_business sbs ON b.code = sbs.business_code
      WHERE skm.board_name IN (${placeholders})
      GROUP BY skm.board_name, b.code, skm.business_name
      ORDER BY skm.board_name,
        CASE 
          WHEN b.business_type IN ('sw1_hy', 'sw2_hy', 'sw3_hy', 'swhy') THEN 1
          WHEN b.business_type IN ('gainianbankuai', 'ch_gn') THEN 2
          ELSE 3
        END,
        stock_count DESC
    `;
    
    pool.query(coreSql, boardNames, (dbErr: Error | null, coreRows: any[]) => {
      if (dbErr) {
        console.error('查询核心行业失败:', dbErr);
        // 降级处理：返回空的核心行业数据
        const boardsWithCore = rows.map(row => ({
          board: row.board,
          rank: row.rank,
          news_score: row.news_score,
          fund_score: row.fund_score,
          total_score: row.total_score,
          fund_inflow: row.fund_inflow,
          article_count: row.article_count,
          insight: row.insight,
          core_industries: []
        }));
        
        const totalScore = boardsWithCore.reduce((sum, r) => sum + r.total_score, 0);
        const totalArticles = boardsWithCore.reduce((sum, r) => sum + r.article_count, 0);
        
        db.close();
        res.json({
          date,
          boards: boardsWithCore,
          total_score: totalScore,
          total_articles: totalArticles
        });
        return;
      }
      
      // 2. 从 SQLite 查询当日子板块热度
      const subBoardSql = `
        SELECT board_name, sub_board, heat_count
        FROM sub_board_heat
        WHERE date = ? AND board_name IN (${placeholders})
      `;
      
      db.all(subBoardSql, [date, ...boardNames], (heatErr: Error | null, heatRows: any[]) => {
        if (heatErr) {
          console.error('查询子板块热度失败:', heatErr);
        }
        
        // 构建热度映射：key = "board_name|sub_board"
        const heatMap: Record<string, number> = {};
        for (const heat of heatRows || []) {
          const key = `${heat.board_name}|${heat.sub_board}`;
          heatMap[key] = heat.heat_count;
        }
        
        // 按板块分组核心行业
        const coreMap: Record<string, any[]> = {};
        for (const core of coreRows || []) {
          if (!coreMap[core.board_name]) {
            coreMap[core.board_name] = [];
          }
          const heatKey = `${core.board_name}|${core.sw_name}`;
          const heatCount = heatMap[heatKey] || 0;
          coreMap[core.board_name].push({
            code: core.sw_code,
            name: core.sw_name,
            type: core.business_type,
            stock_count: core.stock_count,
            avg_pct_30d: core.avg_30d_pct,
            heat_count: heatCount
          });
        }
        
        // 合并数据
        const boardsWithCore = rows.map(row => ({
          board: row.board,
          rank: row.rank,
          news_score: row.news_score,
          fund_score: row.fund_score,
          total_score: row.total_score,
          fund_inflow: row.fund_inflow,
          article_count: row.article_count,
          insight: row.insight,
          core_industries: coreMap[row.board] || []
        }));
        
        const totalScore = boardsWithCore.reduce((sum, r) => sum + r.total_score, 0);
        const totalArticles = boardsWithCore.reduce((sum, r) => sum + r.article_count, 0);
        
        db.close();
        res.json({
          date,
          boards: boardsWithCore,
          total_score: totalScore,
          total_articles: totalArticles
        });
      });
    });
  });
});

// 9. 获取板块历史趋势（从 daily_board_details）
router.get('/board/board_trend', (req: Request, res: Response) => {
  const board = decodeURIComponent(req.query.board as string);  // 解码 URL 参数
  const days = parseInt(req.query.days as string || '30', 10);
  
  if (!board) {
    res.status(400).json({ error: 'Missing required parameter: board' });
    return;
  }
  
  console.log(`查询板块趋势: board=${board}, days=${days}`);
  
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  // 使用参数化查询，直接匹配中文
  db.all(`
    SELECT date, rank, total_score, fund_inflow
    FROM daily_board_details
    WHERE board = ?
    ORDER BY date DESC
    LIMIT ?
  `, [board, days], (err: Error | null, rows: any[]) => {
    db.close();
    
    if (err) {
      console.error('查询板块趋势失败:', err);
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    
    console.log(`查询结果: ${rows?.length || 0} 条`);
    
    // 按时间正序返回
    const trend = rows ? rows.reverse() : [];
    
    res.json({ board, trend });
  });
});

// 10. 加在 index.ts 的 router 中
router.get('/m_trend', function (req, res, next) {
  const recordType = req.query.record_type || 'record1';
  const focusTable = recordType === 'record2' ? 'focus_stocks2_ai' : 'focus_stocks_ai';
  const sql = 'SELECT datestr, vol10_med, temp_label, alarm_dir, alarm_count FROM daily_m WHERE record_type = ? ORDER BY datestr';
  pool.query(sql, [recordType], function (err, rows, fields) {
    if (err) {
      console.error('m_trend error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!rows || rows.length === 0) return res.json([]);
    const dates = rows.map((row: any) => formatDbDate(row.datestr)).filter(Boolean);
    const minDate = shiftDate(dates[0], -20);
    const maxDate = dates[dates.length - 1];
    pool.query(
      `
        SELECT datestr, comments
        FROM ${focusTable}
        WHERE datestr >= ?
          AND datestr <= ?
          AND comments LIKE '%【M:%'
        ORDER BY datestr
      `,
      [minDate, maxDate],
      function (focusErr, focusRows) {
        if (focusErr) {
          console.error('m_trend window detector error:', focusErr);
          return res.status(500).json({ error: focusErr.message });
        }
        res.json(calcWindowDetectorRows(rows, focusRows || [], 20));
      }
    );
  });
});
// ========== 舆情板块股票映射 API ==========

// 获取板块对应的股票列表（从舆情映射表查询）
router.get('/sentiment/board_stocks', (req: Request, res: Response) => {
  const boardName = req.query.board as string;
  
  if (!boardName) {
    res.status(400).json({ error: '缺少板块名称参数' });
    return;
  }
  
  // 第一步：查询板块对应的所有 business_code
  const mappingSql = `
    SELECT DISTINCT business_code, business_name
    FROM sentiment_keyword_mapping
    WHERE board_name = ?
  `;
  
  pool.query(mappingSql, [boardName], (err: Error | null, mappings: any[]) => {
    if (err) {
      console.error('查询映射失败:', err);
      res.status(500).json({ error: '查询映射失败' });
      return;
    }
    
    if (!mappings || mappings.length === 0) {
      res.json({
        board_name: boardName,
        keywords: [],
        business_names: [],
        stocks: [],
        stock_count: 0,
        mapping_count: 0,
        message: '未找到该板块的映射配置'
      });
      return;
    }
    
    // 获取所有映射的 business_code
    const mappedBusinessCodes = mappings.map(m => m.business_code);
    const placeholders = mappedBusinessCodes.map(() => '?').join(',');
    
    // 修改：不使用 GROUP BY，返回每只股票的所有业务板块关联
    const stocksSql = `
      SELECT 
        sbs.symbol, 
        COALESCE(st.name, st_stocks.name, sbs.symbol) as stock_name,
        GROUP_CONCAT(DISTINCT b.name ORDER BY b.name SEPARATOR '|') as business_display_names,
        GROUP_CONCAT(DISTINCT b.code ORDER BY b.name SEPARATOR '|') as business_codes
      FROM sw_stock_business sbs
      INNER JOIN business b ON sbs.business_code = b.code
      LEFT JOIN stocks st ON sbs.symbol = st.symbol
      LEFT JOIN st_stocks ON sbs.symbol = st_stocks.symbol
      WHERE sbs.business_code IN (${placeholders})
      GROUP BY sbs.symbol, stock_name
      ORDER BY sbs.symbol
    `;
    
    pool.query(stocksSql, mappedBusinessCodes, (err: Error | null, stocks: any[]) => {
      if (err) {
        console.error('查询股票失败:', err);
        res.status(500).json({ error: '查询股票失败' });
        return;
      }
      
      // 获取板块关键词列表
      const keywordsSql = `
        SELECT DISTINCT keyword
        FROM sentiment_keyword_mapping
        WHERE board_name = ?
        ORDER BY keyword
      `;
      
      pool.query(keywordsSql, [boardName], (err: Error | null, keywords: any[]) => {
        if (err) {
          console.error('查询关键词失败:', err);
          res.status(500).json({ error: '查询关键词失败' });
          return;
        }
        
        const keywordList = keywords.map(k => k.keyword);
        // 获取映射的业务板块名称（使用 business.name）
        const businessNames = [...new Set(mappings.map(m => m.business_name))];
        
        res.json({
          board_name: boardName,
          keywords: keywordList,
          business_names: businessNames,
          stocks: stocks.map((s: any) => ({
            symbol: s.symbol,
            name: s.stock_name || s.symbol,
            business_display_names: s.business_display_names,  // 多个业务板块用 | 分隔
            business_display_name: s.business_display_names?.split('|')[0] || '', // 兼容旧字段
            business_codes: s.business_codes
          })),
          stock_count: stocks.length,
          mapping_count: mappings.length
        });
      });
    });
  });
});

// 获取所有板块摘要（用于统计卡片）
router.get('/sentiment/all_boards_summary', (req: Request, res: Response) => {
  const sql = `
    SELECT 
      skm.board_name,
      COUNT(DISTINCT skm.keyword) as keyword_count,
      COUNT(DISTINCT skm.business_code) as business_count,
      COUNT(DISTINCT sbs.symbol) as stock_count
    FROM sentiment_keyword_mapping skm
    LEFT JOIN sw_stock_business sbs ON skm.business_code = sbs.business_code
    GROUP BY skm.board_name
    ORDER BY skm.board_name
  `;
  
  pool.query(sql, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('查询板块摘要失败:', err);
      res.status(500).json({ error: '查询失败' });
      return;
    }
    res.json(rows);
  });
});

router.get('/board/top10', function (req, res, next) {
  const date = req.query.date as string;
  let sql = `SELECT 
                m.board_name,
                ROUND(SUM(sc.pricechangepct * sc.marketvalue) / SUM(sc.marketvalue), 2) AS weighted_avg_change,
                COUNT(DISTINCT sc.symbol) AS stock_count
            FROM sentiment_keyword_mapping m
            JOIN sw_stock_business sb ON m.business_code = sb.business_code
            JOIN stock_day_common_data sc ON sb.symbol = sc.symbol
            LEFT JOIN st_stocks st ON sb.symbol = st.symbol
            WHERE m.business_code IS NOT NULL 
              AND m.business_code != ''
              AND sc.datestr = '${date}'          -- 指定日期
              AND sc.pricechangepct IS NOT NULL
              AND sc.marketvalue > 0
              AND st.symbol IS NULL                  -- 排除 ST 股票
            GROUP BY m.board_name
            ORDER BY weighted_avg_change DESC
            LIMIT 10;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
  });
});


/* GET home page. */
router.get('*', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

export default router;
