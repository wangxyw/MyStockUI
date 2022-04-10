import request from 'axios';
import {
  chooseResults,
  daCalculate,
  filterByCondition2,
  filterByCondition5,
} from './biz';
import { caculateDate } from './utils';
var express = require('express');
var router = express.Router();
const YAML = require('yamljs');
const fs = require('fs');
// import { json } from 'express';
// file为文件所在路径
// import http from 'http';
var mysql = require('mysql');
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

router.get('/update_stock_status', function (req, res, next) {
  const symbol = req.query.stock_id;
  const datestr = req.query.datestr;
  const sql = `INSERT INTO viewd_stocks (symbol, datestr) VALUES ('${symbol}', '${datestr}');`;
  pool.query(sql, function (err, rows, fields) {
    if (err) {
      res.json(err);
    } else {
      res.json(rows);
    }
  });
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

router.get('/all_focus_stock', function (req, res, next) {
  const sql = `SELECT * FROM focus_stocks a join stock_big_data b on a.symbol = b.symbol where a.datestr=b.datestr;`;
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

router.get('/get_focus_stock_price', function (req, res, next) {
  const symbols = req.query.stocks;
  const endDate = req.query.datestr;
  const startDate = req.query.start_date;
  let sql = `SELECT * FROM stock_big_data where symbol in (${symbols})`;
  if (startDate && endDate) {
    sql = `SELECT * FROM stock_big_data where symbol in (${symbols}) and datestr <= '${endDate}' and datestr > '${startDate}'`;
  }
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
  const commonDataSQL = `SELECT finalprice, turnoverrate, datestr FROM stock_day_common_data where symbol='${symbol}' and datestr >= '${afterDate}';`;
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
  let table = 'stock_big_data';
  if (from100 === 'true') table = 'stock_big_data_100';
  let sql = `select * from ${table} a where a.datestr > '${datestr}' and a.datestr <= '${endDateStr}' and a.name not like "%ST%"`;
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

router.get('/qt_realtime', async function (req, res) {
  const q = req.query.q;
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

/* GET home page. */
router.get('*', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

export default router;
