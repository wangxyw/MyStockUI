import { groupBy } from 'lodash';
import {
  caculateMaxPrice,
  caculateMinPrice,
  isAverageDistribution,
  validateCons,
  validateTotal,
} from './utils';

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
  const { rows1, minOrAverage, selectMinPriceMargin } = props;
  const groupStocks = groupBy(rows1, 'symbol');
  const matchStocks: any = [];
  Object.keys(groupStocks)?.forEach((key) => {
    const stockArr = groupStocks[key];
    let curItem = stockArr[stockArr?.length - 1];
    if (minOrAverage === 'min') {
      const { minPrice } = caculateMinPrice(stockArr);
      let curPrice = curItem?.finalprice;
      if (!curPrice) {
        curPrice = stockArr[stockArr?.length - 2]?.finalprice;
        curItem = stockArr[stockArr?.length - 2];
      }
      if ((curPrice - minPrice) / minPrice < selectMinPriceMargin / 100) {
        matchStocks.push(curItem);
      }
    }
    if (minOrAverage === 'average') {
      const { maxPrice } = caculateMaxPrice(stockArr);
      const { minPrice } = caculateMinPrice(stockArr);
      if ((maxPrice - minPrice) / minPrice < selectMinPriceMargin / 100) {
        matchStocks.push(curItem);
      }
    }
  });
  return matchStocks;
};
