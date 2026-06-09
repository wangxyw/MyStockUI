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
const sequenceTagsRecord2 = (sequence: any, currentStatus: string) => {
  if (!sequence || toNumber(sequence.prior_count) <= 0) return [];
  const tags: string[] = [];
  const daysSincePrev = sequence.days_since_prev;
  const prevRank = statusRank(sequence.prev_status);
  const currentRank = statusRank(currentStatus);

  const warningTags: string[] = [];
  if (daysSincePrev !== null && daysSincePrev > 90) warningTags.push('【序列警戒:长期重复报警】');
  if (prevRank !== null && currentRank !== null && currentRank < prevRank) warningTags.push('【序列警戒:状态降级】');
  if (warningTags.length === 0) {
    if (daysSincePrev !== null && daysSincePrev >= 31 && daysSincePrev <= 90) tags.push('【序列确认:31-90日再次报警】');
    if (prevRank !== null && currentRank !== null) {
      if (currentRank > prevRank) tags.push('【序列确认:状态升级】');
      else if (currentStatus === '强信号') tags.push('【序列确认:强信号重复确认】');
    }
  }
  tags.push(...warningTags);
  return tags;
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
  const avgVol5 = avg(lastNumbers('totaltradevol', 5));
  const avgVol60 = avg(lastNumbers('totaltradevol', 60));
  const avgAmount5 = avg(lastNumbers('totaltradevalue', 5));
  const avgAmount60 = avg(lastNumbers('totaltradevalue', 60));
  const ma20Current = avg(closes.slice(-20));
  const ma20Lag5 = rows.length >= 25 ? avg(closes.slice(-25, -5)) : null;
  const ret = (count: number) => {
    const base = closes[closes.length - count];
    return base > 0 ? (latestClose / base - 1) * 100 : null;
  };

  return {
    price_pos_60: pricePos60,
    drawdown_from_60_high: drawdownFrom60High,
    avg_turn_10: avgTurn10,
    avg_turn_5: avgTurn5,
    volume_ratio_5_60: avgVol60 && avgVol60 > 0 && avgVol5 !== null ? avgVol5 / avgVol60 : null,
    amount_ratio_5_60: avgAmount60 && avgAmount60 > 0 && avgAmount5 !== null ? avgAmount5 / avgAmount60 : null,
    close_weakness_10: avg(closeWeaknessValues),
    ret_5: rows.length >= 5 ? ret(5) : null,
    ret_10: rows.length >= 10 ? ret(10) : null,
    ret_20: rows.length >= 20 ? ret(20) : null,
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
    SELECT symbol, name, datestr, finalprice, marketvalue, profit_chip
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
           turnoverrate, day_max_price, day_min_price, profit_chip
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
  const avgTurn10 = priceVolumeStats?.avg_turn_10 ?? null;
  const avgTurn5 = priceVolumeStats?.avg_turn_5 ?? null;
  const volumeRatio560 = priceVolumeStats?.volume_ratio_5_60 ?? null;
  const amountRatio560 = priceVolumeStats?.amount_ratio_5_60 ?? null;
  const closeWeakness10 = priceVolumeStats?.close_weakness_10 ?? null;
  const ret5 = priceVolumeStats?.ret_5 ?? null;
  const ret10 = priceVolumeStats?.ret_10 ?? null;
  const ret20 = priceVolumeStats?.ret_20 ?? null;
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
    ma5: ma5 === null ? null : round2(ma5),
    ma10: ma10 === null ? null : round2(ma10),
    ma20: ma20 === null ? null : round2(ma20),
    ma60: ma60 === null ? null : round2(ma60),
    ma5_chg5_pct: ma5Chg5Pct === null ? null : round2(ma5Chg5Pct),
    price_pos_60: pricePos60 === null ? null : round2(pricePos60),
    drawdown_from_60_high: drawdownFrom60High === null ? null : round2(drawdownFrom60High),
    avg_turn_10: avgTurn10 === null ? null : round2(avgTurn10),
    avg_turn_5: avgTurn5 === null ? null : round2(avgTurn5),
    volume_ratio_5_60: volumeRatio560 === null ? null : round2(volumeRatio560),
    amount_ratio_5_60: amountRatio560 === null ? null : round2(amountRatio560),
    close_weakness_10: closeWeakness10 === null ? null : round2(closeWeakness10),
    ret_5: ret5 === null ? null : round2(ret5),
    ret_10: ret10 === null ? null : round2(ret10),
    ret_20: ret20 === null ? null : round2(ret20),
    max_drop_20: maxDrop20 === null ? null : round2(maxDrop20),
    ma20_slope_5: ma20Slope5 === null ? null : round2(ma20Slope5),
    profit_change_5: profitChange5 === null ? null : round2(profitChange5),
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
  const comments = [
    `【${score}】`,
    statusTag,
    `【C:${details.conc_70},${details.conc_90},${details.conc_gap}】`,
    `【T:${details.turnover_mean},${details.turnover_max}】`,
    `【P:${details.profit_chip_day0},${details.profit_chip_max3},${details.profit_delta},${details.pulse_ratio}】`,
    `【R:${details.price_pos_60},${details.drawdown_from_60_high},${details.avg_turn_10},${details.close_weakness_10}】`,
    tags.join(' ')
  ].join('');

  return {
    symbol,
    name: common.name,
    model: 'record1_v12_9_1',
    ...modelMeta,
    query_datestr: datestr,
    datestr: actualDate,
    chip_datestr: formatDbDate(chip.datestr),
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
           turnoverrate, day_max_price, day_min_price, profit_chip
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
  tags.push(...sequenceTagsRecord2(await querySequenceContext('focus_stocks2_ai', symbol, actualDate), statusTag.replace(/[【】]/g, '')));
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
    avg_turn_10: avgTurn10 === null ? null : round2(avgTurn10),
    avg_turn_5: avgTurn5 === null ? null : round2(avgTurn5),
    close_weakness_10: closeWeakness10 === null ? null : round2(closeWeakness10),
    ret_5: ret5 === null ? null : round2(ret5),
    ret_10: ret10 === null ? null : round2(ret10),
    risk_low_position_low_turn_elasticity: riskLowPositionLowTurnElasticity,
    risk_low_turn_stagnation: riskLowTurnStagnation,
    high_turn_elasticity: highTurnElasticity,
    drawdown_repair_elasticity: drawdownRepairElasticity,
    core_acceptance_low_elasticity: coreAcceptanceLowElasticity,
    short_midcap_repair_elasticity: shortMidcapRepairElasticity,
    short_watch_midcap_acceptance_repair: shortWatchMidcapAcceptanceRepair,
    warning_low_elastic_core_acceptance: warningLowElasticCoreAcceptance,
  };
  const comments = [
    `【${score}】`,
    statusTag,
    `【C:${details.conc_70},${details.conc_90},${details.conc_gap}】`,
    `【T:${details.turnover_mean},${details.turnover_max}】`,
    `【R:${details.price_pos_60},${details.drawdown_from_60_high},${details.avg_turn_10},${details.close_weakness_10}】`,
    tags.join(' ')
  ].filter(Boolean).join('');

  return {
    symbol,
    name: common.name,
    model: 'record2_v2_0_1',
    ...modelMeta,
    query_datestr: datestr,
    datestr: actualDate,
    chip_datestr: formatDbDate(chip.datestr),
    comments,
    score,
    status: statusTag.replace(/[【】]/g, ''),
    tags,
    details
  };
};

const buildStockPortrait = async (symbolInput: string, datestr: string) => {
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
    return buildRecord1Portrait(common.symbol, datestr, modelMeta);
  }

  if (finalPrice >= 0 && finalPrice <= 100 && circulationStock >= 30 && circulationStock <= 500) {
    return buildRecord2Portrait(common.symbol, datestr, modelMeta);
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

  if (!symbol || !datestr) {
    res.status(400).json({ error: 'symbol 和 datestr 不能为空' });
    return;
  }

  try {
    const result = await buildStockPortrait(symbol, datestr);
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
      sql = `SELECT a.*, b.*, a.updated_at as last_updated_at 
             FROM focus_stocks a 
             JOIN stock_day_common_data b ON a.symbol = b.symbol AND a.datestr = b.datestr
             ORDER BY a.datestr ${dateSortOrder}
             LIMIT ? OFFSET ?`;
    } else {
      // 默认按更新时间倒序（保持原有性能）
      sql = `SELECT a.*, b.*, a.updated_at as last_updated_at 
             FROM focus_stocks a 
             JOIN stock_day_common_data b ON a.symbol = b.symbol AND a.datestr = b.datestr
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
      sql = `SELECT a.*, b.*, a.updated_at as last_updated_at 
             FROM focus_stocks2 a 
             JOIN stock_day_common_data b ON a.symbol = b.symbol AND a.datestr = b.datestr
             ORDER BY a.datestr ${dateSortOrder}
             LIMIT ? OFFSET ?`;
    } else {
      sql = `SELECT a.*, b.*, a.updated_at as last_updated_at 
             FROM focus_stocks2 a 
             JOIN stock_day_common_data b ON a.symbol = b.symbol AND a.datestr = b.datestr
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

router.get('/ai_focus_stocks_trend', function (req, res, next) {
  let sql = `SELECT datestr, COUNT(symbol) AS symbol_count FROM focus_stocks_ai GROUP BY datestr ORDER BY datestr DESC;`;
  pool.query(sql, function (err, rows, fields) {
    if (err) throw err;
    res.json(rows);
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
