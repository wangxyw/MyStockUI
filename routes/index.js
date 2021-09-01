var express = require('express');
var router = express.Router();
const YAML = require('yamljs');
const fs = require("fs");
import { json } from 'express';
// file为文件所在路径
import http from 'http';
var mysql = require('mysql');
var mysqlConfig = YAML.parse(fs.readFileSync('./config/database.yml').toString())
var pool  = mysql.createPool({
    connectionLimit : 100,//最多处理多少连接次数
    host     : mysqlConfig.dbsql.host,
    port     : mysqlConfig.dbsql.port,
    user     : mysqlConfig.dbsql.user,
    password : mysqlConfig.dbsql.pwd,
    database : mysqlConfig.dbsql.database
});

router.get('/stock_info', function(req, res, next) {
      const symbol = req.query.stock_id;
      const minvol  = req.query.minvol;
      // where 'symbol' = ${symbol} and 'minvol' = ${minvol};
      const sql = `SELECT * FROM select_stocks where symbol='${symbol}' and minvol='${minvol}'`
      pool.query(sql, function (err, rows, fields) {
          if (err) throw err;
          res.json(
              rows
          )
  
      })
  });

  router.get('/stock_list', function(req, res, next) {
    const sql = `SELECT * FROM select_stocks group by symbol;`
    pool.query(sql, function (err, rows, fields) {
        if (err) throw err;
        res.json(
            rows
        )
    })
  });

  router.get('/update_stock_status', function(req, res, next) {
    const symbol = req.query.stock_id;
    const datestr  = req.query.datestr;
    const sql = `INSERT INTO viewd_stocks (symbol, datestr) VALUES ('${symbol}', '${datestr}');`
    pool.query(sql, function (err, rows, fields) {
        if (err) { 
            res.json(err)
        } else {
            res.json(
            rows
           )
        }
        
    })
  });

  router.get('/add_focus', function(req, res, next) {
    const symbol = req.query.stock_id;
    const datestr  = req.query.datestr;
    const comments = req.query.comments;
    const predict = req.query.predict;
    const sql = `INSERT INTO focus_stocks (symbol, datestr, comments, predict) VALUES ('${symbol}', '${datestr}', '${comments}', '${predict}');`
    pool.query(sql, function (err, rows, fields) {
        if (err) {
            res.json(err)
        } else {
            res.json(
            rows
           )
        }
        
    })
  });

  router.get('/get_viewed_stock', function(req, res, next) {
    const datestr  = req.query.datestr;
    const sql = `SELECT * FROM viewd_stocks WHERE datestr = '${datestr}';`
    pool.query(sql, function (err, rows, fields) {
        if (err) throw err
        res.json(
            rows
        )
    })
  });

  router.get('/all_focus_stock', function(req, res, next) {
    const sql = `SELECT * FROM focus_stocks a join stock_daily b on a.symbol = b.symbol where a.datestr=b.datestr;`
    pool.query(sql, function (err, rows, fields) {
        if (err) throw err
        res.json(
            rows
        )
    })
  });
  
  router.get('/stock_alarm', function(req, res, next) {
    const symbol = req.query.stock_id;
    const alarm_type  = req.query.alarm_type;
    let sql = `SELECT a.symbol,  status,  totalvolpct, dvaluepct, a.datestr, b.turnoverrate, b.finalprice FROM stock_alarms a join stock_daily b on a.symbol = b.symbol where a.symbol='${symbol}' and a.datestr=b.datestr and a.datestr < '2021-06-02'
    union SELECT a.symbol,  status,  totalvolpct, dvaluepct, a.datestr, b.turnoverrate, b.finalprice FROM all_stock_big_orders a left join stock_daily b on a.symbol = b.symbol and a.datestr=b.datestr where a.symbol='${symbol}' and a.datestr > '2021-06-01';`
    const datestr = req.query.date_str;
    if (datestr) {
        sql = `SELECT a.symbol,  status,  totalvolpct, dvaluepct, a.datestr FROM stock_alarms a where a.symbol='${symbol}' and a.datestr > '${datestr}';`
    }
    // let sql = `SELECT * FROM stock_alarms a join stock_daily b on a.symbol = b.symbol where a.alarmtype = '${alarm_type}' and a.symbol='${symbol}' and a.datestr=b.datestr;`
    // if (alarm_type === 'All') {
    //   sql = `SELECT * FROM stock_alarms a join stock_daily b on a.symbol = b.symbol where a.symbol='${symbol}' and a.datestr=b.datestr;`
    // }
    // if (alarm_type === 'A1A2') {
    //   sql = `SELECT * FROM stock_alarms a join stock_daily b on a.symbol = b.symbol where a.symbol='${symbol}' and alarmtype !='A3' and a.datestr=b.datestr;`  
    //   //sql = `SELECT * FROM stock_alarms where symbol='${symbol}' and alarmtype !='A3'` 
    // }
    // if (alarm_type === 'A1Today') {
    //   sql = `SELECT * FROM stock_alarms a join stock_daily b on a.symbol = b.symbol where a.alarmtype = 'A1' and a.symbol='${symbol}' and a.datestr=b.datestr;`
    // }
    pool.query(sql, function (err, rows, fields) {
        //if (err) throw err;
        res.json(
            rows
        )
    })
  });

  router.get('/all_alarm_data', function(req, res, next) {
    const datestr = req.query.date_str;

    let sql = `select * from all_stock_big_orders a left join stock_daily b on a.symbol=b.symbol and a.datestr=b.datestr where a.datestr > '${datestr}';`
    pool.query(sql, function (err, rows, fields) {
        //if (err) throw err;
        res.json(
            rows
        )
    })
  });

  router.get('/all_stock_alarm', function(req, res, next) {
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const alarmType = req.query.alarm_type;
    const date = req.query.date;

    let sql = '';
    if (alarmType === 'All') {
       sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from stock_alarms group by symbol order by COUNT(*) desc, avgtotalpct desc;`
    } else if (alarmType === 'A1A2') {
       sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from stock_alarms where alarmType != 'A3' group by symbol order by COUNT(*) desc, avgtotalpct desc;`
    } else if (alarmType === 'A1Today') { 
       sql = `select *, avg(a.totalvolpct) as avgtotalpct, count(*) from stock_alarms a join stocks b on a.symbol = b.symbol where a.alarmType = 'A1' and a.datestr = '${date}' and a.status = 'up' and b.name not like "%ST%" group by a.symbol order by COUNT(*) desc, avgtotalpct desc;`
    } else {
       sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from stock_alarms where alarmType = '${alarmType}' group by symbol order by COUNT(*) desc, avgtotalpct desc;`
    } 

    if (startDate && endDate) {
        if (alarmType === 'All') {
            sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from stock_alarms where datestr >= '${startDate}' and datestr <= '${endDate}' group by symbol order by COUNT(*) desc, avgtotalpct desc;`
         } else if (alarmType === 'A1A2') {
            sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from stock_alarms where alarmType != 'A3' and datestr > '${startDate}' and datestr < '${endDate}' group by symbol order by COUNT(*) desc, avgtotalpct desc;`
         } else if (alarmType === 'A1Today') {
            sql = `select *, avg(a.totalvolpct) as avgtotalpct, count(*) from stock_alarms a join stocks b on a.symbol = b.symbol where a.alarmType = 'A1' and a.datestr = '${date}' and a.status = 'up' and b.name not like "%ST%" group by a.symbol order by COUNT(*) desc, avgtotalpct desc;`
         } else {
            sql = `select *, avg(totalvolpct) as avgtotalpct, count(*) from stock_alarms where alarmType = '${alarmType}' and datestr >= '${startDate}' and datestr <= '${endDate}' group by symbol order by COUNT(*) desc, avgtotalpct desc;`
         } 
    }
    
    pool.query(sql, function (err, rows, fields) {
        if (err) throw err;
        res.json(
            rows
        )
    })
  });

  /* GET home page. */
router.get('*', function(req, res, next) {
    res.render('index', { title: 'Express' });
  });

module.exports = router;
