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

router.get('/all_focus_stock2', function (req, res, next) {
  const sql = `SELECT a.*, b.*, a.updated_at as last_updated_at  FROM focus_stocks2 a join stock_day_common_data b on a.symbol = b.symbol and a.datestr=b.datestr;`;
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

// 8. 获取增强版板块详情（从 daily_board_details）
router.get('/board/enhanced_details', (req: Request, res: Response) => {
  const date = req.query.date as string;
  
  if (!date) {
    res.status(400).json({ error: 'Missing required parameter: date' });
    return;
  }
  
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  
  db.all(`
    SELECT board, rank, news_score, fund_score, total_score, 
           fund_inflow, article_count, insight
    FROM daily_board_details
    WHERE date = ?
    ORDER BY rank ASC
  `, [date], (err: Error | null, rows: any[]) => {
    db.close();
    
    if (err) {
      console.error('查询增强版详情失败:', err);
      res.status(500).json({ error: 'Query failed' });
      return;
    }
    
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: `No enhanced data found for date: ${date}` });
      return;
    }
    
    // 计算汇总统计
    let totalScore = 0;
    let totalArticles = 0;
    for (const row of rows) {
      totalScore += row.total_score;
      totalArticles += row.article_count;
    }
    
    res.json({ 
      date, 
      boards: rows,
      total_score: totalScore,
      total_articles: totalArticles
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
    
    // 第二步：查询股票，并且只返回在映射 business_code 中的业务板块名称
    // 使用子查询或 INNER JOIN 确保只返回匹配的业务板块
    const stocksSql = `
      SELECT DISTINCT 
        sbs.symbol, 
        COALESCE(st.name, st_stocks.name, sbs.symbol) as stock_name,
        b.name as business_display_name,
        b.code as business_code
      FROM sw_stock_business sbs
      INNER JOIN business b ON sbs.business_code = b.code
      LEFT JOIN stocks st ON sbs.symbol = st.symbol
      LEFT JOIN st_stocks ON sbs.symbol = st_stocks.symbol
      WHERE sbs.business_code IN (${placeholders})
      GROUP BY sbs.symbol
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
            business_display_name: s.business_display_name,  // 这是与映射匹配的业务板块名称
            business_code: s.business_code
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

/* GET home page. */
router.get('*', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

export default router;
