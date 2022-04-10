import DATE from '../client/component/date.json';
const getBeforeOneDate = (date, n) => {
  //const n = n;
  let d = new Date(date);
  let year = d.getFullYear();
  let mon = d.getMonth() + 1;
  let day = d.getDate();
  if (day <= n) {
    if (mon > 1) {
      mon = mon - 1;
    } else {
      year = year - 1;
      mon = 12;
    }
  }
  d.setDate(d.getDate() - n);
  year = d.getFullYear();
  mon = d.getMonth() + 1;
  day = d.getDate();
  const s =
    year +
    '-' +
    (mon < 10 ? '0' + mon : mon) +
    '-' +
    (day < 10 ? '0' + day : day);
  return s;
};
export const workdays = DATE.workday;
export const caculateDate = (startDatestr, days) => {
  const startDateStrIndex = workdays.indexOf(startDatestr);
  if (startDateStrIndex !== -1) {
    const endDateStr = workdays[startDateStrIndex - days];
    return endDateStr;
  } else {
    let i = 1;
    while (workdays.indexOf(startDatestr) === -1) {
      startDatestr = getBeforeOneDate(startDatestr, i);
    }
    const endDateStr = workdays[workdays.indexOf(startDatestr) - days];
    return endDateStr;
  }
};

export const caculateAfterDate = (startDatestr, days) => {
  const startDateStrIndex = workdays.indexOf(startDatestr);
  if (startDateStrIndex !== -1) {
    const endDateStr = workdays[startDateStrIndex + days];
    return endDateStr;
  } else {
    let i = 1;
    while (workdays.indexOf(startDatestr) === -1) {
      startDatestr = getBeforeOneDate(startDatestr, i);
    }
    const endDateStr = workdays[workdays.indexOf(startDatestr) + days];
    return endDateStr;
  }
};

export const getBeforeDate = (n) => {
  //const n = n;
  let d = new Date();
  let year = d.getFullYear();
  let mon = d.getMonth() + 1;
  let day = d.getDate();
  if (day <= n) {
    if (mon > 1) {
      mon = mon - 1;
    } else {
      year = year - 1;
      mon = 12;
    }
  }
  d.setDate(d.getDate() - n);
  year = d.getFullYear();
  mon = d.getMonth() + 1;
  day = d.getDate();
  const s =
    year +
    '-' +
    (mon < 10 ? '0' + mon : mon) +
    '-' +
    (day < 10 ? '0' + day : day);
  return s;
};

export const validateCons = (data, selectConsUpDown, selectConsDays) => {
  let consNum = 0;
  let end = 0;
  let j = 0;
  let typeA = false;
  let typeB = false;
  let typeC = false;
  data &&
    data.forEach((i, k) => {
      if (i?.alarmtype === 'A1' && i?.status === selectConsUpDown) {
        typeA = true;
      }
      if (i?.alarmtype === 'A2' && i?.status === selectConsUpDown) {
        typeB = true;
      }
      if (i?.alarmtype === 'A3' && i?.status === selectConsUpDown) {
        typeC = true;
      }
      if (i.status === selectConsUpDown) {
        j++;
      } else {
        if (j > consNum) {
          consNum = j;
          end = k;
        }
        j = 0;
      }
    });
  if (j > consNum) {
    (consNum = j), (end = data.length);
  }
  if (consNum >= +selectConsDays) {
    return {
      isTrue: true,
      start: end - selectConsDays,
      end: end - 1,
      typeA,
      typeB,
      typeC,
    };
  } else {
    return { isTrue: false };
  }
};

export const validateTotal = (data, selectConsUpDown, selectConsDays) => {
  let typeA = false;
  let typeB = false;
  let typeC = false;
  data.forEach((i, k) => {
    if (i?.alarmtype === 'A1' && i?.status === selectConsUpDown) {
      typeA = true;
    }
    if (i?.alarmtype === 'A2' && i?.status === selectConsUpDown) {
      typeB = true;
    }
    if (i?.alarmtype === 'A3' && i?.status === selectConsUpDown) {
      typeC = true;
    }
  });
  return {
    isTrue:
      data &&
      data.filter((i) => i.status === selectConsUpDown).length >=
        +selectConsDays,
    typeA,
    typeB,
    typeC,
  };
};

export const isAverageDistribution = (item, selectPriceMargin) => {
  const averagePrice =
    item.map((i) => i.finalprice).reduce((p, c) => p + c) / item.length;
  let isAverage = item.every((i) => {
    return (
      Math.abs(i.finalprice - averagePrice) / averagePrice <=
      selectPriceMargin / 100
    );
  });
  return isAverage;
};

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
