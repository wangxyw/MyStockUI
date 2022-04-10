import {
  caculateAfterDate,
  caculateDate,
  caculateMaxPrice,
  caculateMinPrice,
  isAverageDistribution,
  validateCons,
  validateTotal,
  workdays,
} from './utils';
import { groupBy } from 'lodash';

export const chooseResults = (props) => {
  const {
    rows,
    caculatePriceBy,
    selectPriceMargin,
    selectConsUpDown,
    selectConsDays,
    selectConsTotal,
    hasCondition1,
  } = props;
  const upDownStocks: any[] = [];
  const data = groupBy(rows, 'symbol');
  Object.keys(data).forEach((k) => {
    const item = data[k];
    const lastStock = item?.[item?.length - 1];
    if (selectConsTotal === 'CONS') {
      const { isTrue, start, end, typeA, typeB, typeC } = validateCons(
        item,
        selectConsUpDown,
        selectConsDays
      );
      if (typeA) lastStock.typeA1 = true;
      if (typeB) lastStock.typeA2 = true;
      if (typeC) lastStock.typeA3 = true;
      if (isTrue) {
        if (hasCondition1 === 'true') {
          if (caculatePriceBy === 'true') {
            isAverageDistribution(item, selectPriceMargin) &&
              upDownStocks.push(lastStock);
          } else {
            const startPrice = item[start].finalprice;
            const endPrice = item[end].finalprice;
            if (
              Math.abs((endPrice - startPrice) / startPrice) <
              selectPriceMargin / 100
            ) {
              upDownStocks.push(lastStock);
            }
          }
        } else {
          upDownStocks.push(lastStock);
        }
      }
    }
    if (selectConsTotal === 'TOTAL') {
      const { isTrue, typeA, typeB, typeC } = validateTotal(
        item,
        selectConsUpDown,
        selectConsDays
      );
      if (typeA) lastStock.typeA1 = true;
      if (typeB) lastStock.typeA2 = true;
      if (typeC) lastStock.typeA3 = true;
      if (isTrue) {
        if (hasCondition1 === 'true' && caculatePriceBy === 'true') {
          isAverageDistribution(item, selectPriceMargin) &&
            upDownStocks.push(lastStock);
        } else {
          upDownStocks.push(lastStock);
        }
      }
    }
  });
  return upDownStocks;
};

export const filterByCondition2 = (props) => {
  const { rows1, selectMinPriceMargin } = props;
  const groupStocks = groupBy(rows1, 'symbol');
  const matchStocks: any = [];
  Object.keys(groupStocks)?.forEach((key) => {
    const stockArr = groupStocks[key];
    let curItem = stockArr[stockArr?.length - 1];
    const { minPrice } = caculateMinPrice(stockArr);
    let curPrice = curItem?.finalprice;
    if (!curPrice) {
      curPrice = stockArr[stockArr?.length - 2]?.finalprice;
      curItem = stockArr[stockArr?.length - 2];
    }
    if ((curPrice - minPrice) / minPrice < selectMinPriceMargin / 100) {
      matchStocks.push(curItem);
    }
  });
  return matchStocks;
};

export const filterByCondition5 = (props) => {
  const { rows1, selectHorPriceMargin } = props;
  const groupStocks = groupBy(rows1, 'symbol');
  const matchStocks: any = [];
  Object.keys(groupStocks)?.forEach((key) => {
    const stockArr = groupStocks[key];
    let curItem = stockArr[stockArr?.length - 1];
    const { maxPrice } = caculateMaxPrice(stockArr);
    const { minPrice } = caculateMinPrice(stockArr);
    if ((maxPrice - minPrice) / minPrice < selectHorPriceMargin / 100) {
      matchStocks.push(curItem);
    }
  });
  return matchStocks;
};
export const pullWorkDaysArray = (date, days) => {
  const endIndex = workdays.indexOf(caculateDate(date, 0));
  const workDaysArray = workdays.slice(endIndex - days + 1, endIndex + 1);
  return workDaysArray;
};
export const daCalculate = (
  res,
  {
    selectDays,
    selectDate,
    selectConsTotal,
    selectConsUpDown,
    selectConsDays,
    selectConsAllDays,
    selectTimeWindow,
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
  }
) => {
  const stockDataByDate = {};
  const dateArr = pullWorkDaysArray(selectDate, parseInt(selectDays, 10) + 30);
  //const allSelectStocks: any = [];
  dateArr?.forEach((date) => {
    const allStockDataByDate = res?.filter(
      (e) =>
        e?.datestr <= caculateDate(date, 0) &&
        e?.datestr > caculateDate(date, parseInt(selectConsAllDays, 10))
    );
    const data = groupBy(allStockDataByDate, 'symbol');
    let selectedStocks: any = [];

    Object.keys(data).forEach((k) => {
      const item = data[k];
      const lastStock = item?.[item?.length - 1];
      if (selectConsTotal === 'CONS') {
        const { isTrue, start, end } = validateCons(
          item,
          selectConsUpDown,
          selectConsDays
        );
        if (isTrue) {
          if (caculatePriceBy) {
            if (isAverageDistribution(item, selectPriceMargin))
              lastStock.Condition1 = true;
          } else {
            const startPrice = item[start].finalprice;
            const endPrice = item[end].finalprice;
            if (
              Math.abs((endPrice - startPrice) / startPrice) <
              selectPriceMargin / 100
            ) {
              lastStock.Condition1 = true;
            }
          }
          if (lastStock.finalprice < givenPrice) {
            lastStock.Condition3 = true;
          }
          if (lastStock.finalprice > givenMinPrice) {
            lastStock.Condition6 = true;
          }
          if (lastStock.marketvalue / lastStock.finalprice < givenCirculation) {
            lastStock.Condition4 = true;
          }
          selectedStocks.push(lastStock);
        }
      }
      if (selectConsTotal === 'TOTAL') {
        const { isTrue } = validateTotal(
          item,
          selectConsUpDown,
          selectConsDays
        );
        if (isTrue) {
          if (caculatePriceBy) {
            if (isAverageDistribution(item, selectPriceMargin))
              lastStock.Condition1 = true;
          }
          if (lastStock.finalprice < givenPrice) {
            lastStock.Condition3 = true;
          }
          if (lastStock.finalprice > givenMinPrice) {
            lastStock.Condition6 = true;
          }
          if (lastStock.marketvalue / lastStock.finalprice < givenCirculation) {
            lastStock.Condition4 = true;
          }
          selectedStocks.push(lastStock);
        }
      }
    });
    const selectSymbols = selectedStocks?.map((i) => i.symbol);
    const priceSymbolData = res?.filter((i) =>
      selectSymbols?.includes(i.symbol)
    );

    if (hasCondition2 && selectedStocks?.length > 0) {
      const priceData = priceSymbolData?.filter(
        (i) =>
          i?.datestr > caculateDate(selectDate, selectMinPriceDays) &&
          i?.datestr <= selectDate
      );
      selectedStocks = filterByCondition25(
        priceData,
        selectedStocks,
        selectMinPriceMargin,
        hasCondition2,
        hasCondition5
      );
    }

    if (hasCondition5 && selectedStocks?.length > 0) {
      const priceData = priceSymbolData?.filter(
        (i) =>
          i?.datestr > caculateDate(selectDate, selectHorPriceDays) &&
          i?.datestr <= caculateDate(selectDate, selectConsDays)
      );
      selectedStocks = filterByCondition25(
        priceData,
        selectedStocks,
        selectMinPriceMargin,
        hasCondition2,
        hasCondition5
      );
    }
    stockDataByDate[date] = caculatePriceData(
      selectedStocks,
      priceSymbolData,
      selectTimeWindow
    );
  });
  return stockDataByDate;
};

export const filterByCondition25 = (
  priceData,
  stocks,
  price,
  hasCondition2,
  hasCondition5
) => {
  const newStocks = stocks?.map((item) => {
    const pData = priceData?.filter((i) => i.symbol === item.symbol);

    if (hasCondition2 && pData?.length > 0) {
      const { minPrice } = caculateMinPrice(pData);
      let curPrice = item?.finalprice;
      if (!curPrice) {
        curPrice = priceData[priceData?.length - 2]?.finalprice;
      }
      if ((curPrice - minPrice) / minPrice < price / 100) {
        item.Condition2 = true;
      }
    }
    if (hasCondition5 && pData?.length > 0) {
      const { minPrice } = caculateMinPrice(pData);
      const { maxPrice } = caculateMaxPrice(pData);
      if ((maxPrice - minPrice) / minPrice < price / 100) {
        item.Condition5 = true;
      }
    }
    return { ...item };
  });
  return newStocks;
};

export const caculatePriceData = (
  stockData,
  stockPriceByDay,
  timeWindow: any = 60
) => {
  const priceData = stockData.map((i) => {
    const priceByDayData = stockPriceByDay?.filter((e) => {
      let a = e.symbol === i.symbol && e.datestr >= i.datestr;
      if (timeWindow !== '不限') {
        a = a && e.datestr <= caculateAfterDate(i.datestr, timeWindow);
      }
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
