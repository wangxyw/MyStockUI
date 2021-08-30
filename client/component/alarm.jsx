import { useCallback, useState, useMemo, useEffect } from 'react';
import React from 'react';
import { Button, Input, Select, DatePicker, Radio } from 'antd';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';
import {groupBy} from 'lodash';

const validateStock = (stock) => {
  if (stock.length < 8) {
    return false;
  }  
  const stockPre = stock.slice(0, 2);
  if (stockPre != 'sh' && stockPre != 'sz') {
    return false;
  }
  const stockRemovePre = stock.slice(2);
  if (isNaN(parseInt(stockRemovePre, 10))) {
    return false;
  }
  return true;
}

const getBeforeDate = (n) => {
    //const n = n;
    let d = new Date();
    let year = d.getFullYear();
    let mon = d.getMonth() + 1;
    let day = d.getDate();
    if(day <= n) {
        if(mon > 1) {
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
    const s = year + "-" + (mon < 10 ? ('0' + mon) : mon) + "-" + (day < 10 ? ('0' + day) : day);
    return s;
}

const validateCons = (data, selectConsUpDown, selectConsDays ) => {
    let consNum = 0;
    let j = 0
    data && data.forEach((i)=>{
        if (i.status === selectConsUpDown) {
           j ++;
        } else {
           if (j > consNum) {
            consNum = j;
           }
           j = 0;
        }
    });
    if (j > consNum) {consNum = j};
    if (consNum === +selectConsDays) {
        return true;
    } else {
        return false;
    }
}

const validateTotal = (data, selectConsUpDown, selectConsDays ) => {
    return data && data.filter(i=>i.status === selectConsUpDown).length === +selectConsDays
}

const matchType = (dpct, totalpct) => {
    if (totalpct > 50 && dpct >= 25) {
        return 'A1';
    } else if (totalpct > 50 && dpct < 25) {
        return 'A2';
    } else if (totalpct < 50 && dpct >= 25) {
        return 'A3'
    } else {
        return 'NA';
    }
}

const matchColor = (type) => {
    if (type === 'A1') {
        return 'red';
    } else if (type === 'A2') {
        return 'yellow';
    } else if (type==='A3') {
        return 'purple'
    } else {
        return 'pink';
    }
}

export const AlarmComponent = () => {
    const [selectStock, setSelectStock] = useState('');
    const [selectAlarmType, setSelectAlarmType] = useState('All');
    const [option, setOption] = useState({});
    const [priceOption, setPriceOption] = useState({});
    const [selectDays, setSelectDays] = useState('30');
    const [stockOptions, setStockOptions] = useState([]);
    const [totalNum, setTotalNum] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const [selectConsUpDown, setSelectConsUpDown] = useState('up');
    const [selectConsDays, setSelectConsDays] = useState(null);
    const [selectConsTotal, setSelectConsTotal] = useState('CONS');
    const [savedStockOptions, setSavedStockOptions] = useState([]);
    const curDate = new Date();
    const year = curDate.getFullYear();
    const month = curDate.getMonth() + 1;
    const day = curDate.getDate();
    const dateFormat = 'YYYY-MM-DD';
    const [selectDate, setSelectDate] = useState(moment(`${year}-${month}-${day}`).format(dateFormat));
    const [selectStartDate, setSelectStartDate] = useState(moment(`${year}-${month}-${day}`).format(dateFormat));
    const [selectEndDate, setSelectEndDate] = useState(moment(`${year}-${month}-${day}`).format(dateFormat));
    const [comments, setComments] = useState('');
    const [predict, setPredict] = useState('up');

    const filterData = useCallback((data, selectConsDays, selectConsTotal, selectConsUpDown) => {
        if (selectAlarmType=== 'All') {return};
        const upDownStocks = [];
        data && data.forEach(i => {
           const symbol = i.symbol;
            fetch(`/stock_alarm?stock_id=${symbol}&alarm_type=${selectAlarmType}&date_str=${getBeforeDate(selectDays)}`, {method: 'GET'})
            .then(
            res =>res.json()
            ).then(result => {
                setIsLoading(false);
                if (selectConsTotal === 'CONS') {
                    if(validateCons(result, selectConsUpDown, selectConsDays)) {
                        upDownStocks.push(i);
                        //setUpdownStocks([...upDownStocks]);
                        
                    }
                }
                if (selectConsTotal === 'TOTAL') {
                    if(validateTotal(result, selectConsUpDown, selectConsDays)) {
                        upDownStocks.push(i);
                        //setUpdownStocks([...upDownStocks]);
                        //setStockOptions([...upDownStocks]);
                        //setTotalNum(upDownStocks.length);
                    }
                }
                setStockOptions([...upDownStocks]);
                setTotalNum(upDownStocks.length);  
            })
        
        });
    }, [setStockOptions, selectAlarmType, stockOptions]);

    const advancedSearch = useCallback((selectConsDays, selectConsTotal, selectConsUpDown) => {
        const upDownStocks = [];
        fetch(`/all_alarm_data?date_str=${getBeforeDate(selectDays)}`, {method: 'GET'})
            .then(
            res =>res.json()
            ).then(result => {
               const data = groupBy(result, 'symbol') ;
               for (var k in data) {
                if (selectConsTotal === 'CONS') {
                    if(validateCons(data[k], selectConsUpDown, selectConsDays)) {
                        upDownStocks.push(data[k][0]);
                        //setUpdownStocks([...upDownStocks]);
                        
                    }
                }
                if (selectConsTotal === 'TOTAL') {
                    if(validateTotal(result, selectConsUpDown, selectConsDays)) {
                        upDownStocks.push(data[k][0]);
                        //setUpdownStocks([...upDownStocks]);
                        //setStockOptions([...upDownStocks]);
                        //setTotalNum(upDownStocks.length);
                    }
                }
                setIsLoading(false); 
                setStockOptions([...upDownStocks]);
                setTotalNum(upDownStocks.length);  
               }
        });
    }, [setStockOptions, selectAlarmType, stockOptions, selectDays]);

    useEffect(() => {
        setIsLoading(true);
        fetch(`/all_stock_alarm?alarm_type=${selectAlarmType}&date=${selectDate}`)
        .then(
          res =>res.json()
        ).then(data => {
            fetch(`/get_viewed_stock?datestr=${moment(new Date()).format(dateFormat)}`)
              .then(
                result =>result.json()
              ).then(viewedStocks => {
                  const addViewed = data && data.map(i => {
                      if (viewedStocks.find(e => e.symbol === i.symbol)) {
                          i.viewed = true;
                          return i
                      } else {
                          return i
                      }
                  })
                  setIsLoading(false);
                  setSavedStockOptions(addViewed);
                  setStockOptions(addViewed)
                  setTotalNum(addViewed && addViewed.length) 
              })

             
        })
    }, [selectAlarmType, selectDate])


    const reLoadAllAlarms = useCallback((applyTimeFilter) => {
        let url = `/all_stock_alarm?alarm_type=${selectAlarmType}&date=${selectDate}`;
        if (applyTimeFilter) url = `/all_stock_alarm?alarm_type=${selectAlarmType}&date=${selectDate}&start_date=${selectStartDate}&end_date=${selectEndDate}`;
        setIsLoading(true);
        fetch(url)
        .then(
          res =>res.json()
        ).then(data => {
            fetch(`/get_viewed_stock?datestr=${moment(new Date()).format(dateFormat)}`)
              .then(
                result =>result.json()
              ).then(viewedStocks => {
                  const addViewed = data && data.map(i => {
                      if (viewedStocks.find(e => e.symbol === i.symbol)) {
                          i.viewed = true;
                          return i
                      } else {
                          return i
                      }
                  })
                  setIsLoading(false);
                  setSavedStockOptions(addViewed);
                  setStockOptions(addViewed)
                  setTotalNum(addViewed && addViewed.length) 
              }) 
        })
    }, [selectAlarmType, selectDate, selectStartDate, selectEndDate])

    const dateArr = useMemo(()=> {
        const dateArray = [];
        for (var i=parseInt(selectDays, 10);i>=0;i--) {
            dateArray.push(getBeforeDate(i));
         }
         return dateArray;
    }, [selectDays]);

    const getStockAlarm = useCallback(() => {
    validateStock(selectStock) &&
    fetch(`/stock_alarm?stock_id=${selectStock}&alarm_type=${selectAlarmType}`, {method: 'GET'})
        .then(
          res =>res.json()
        ).then(data => {
            const dataArr = dateArr.map(
                i => {
                  if (data.find(d => d.datestr === i)) {
                      return data.find(d => d.datestr === i).dvaluepct * 100;
                  } else {
                      return 0;
                  }
                }
            )
            const overRateArr = dateArr.map(
                i => {
                  if (data.find(d => d.datestr === i)) {
                      return data.find(d => d.datestr === i).turnoverrate;
                  } else {
                      return '-';
                  }
                }
            )
            const priceArr = dateArr.map(
                i => {
                  if (data.find(d => d.datestr === i)) {
                      return data.find(d => d.datestr === i).finalprice;
                  } else {
                      return '-';
                  }
                }
            )
            const totalDataArr = dateArr.map(
                i => {
                  if (data.find(d => d.datestr === i)) {
                      return data.find(d => d.datestr === i).totalvolpct * 100;
                  } else {
                      return '-';
                  }
                }
            )
            const statusArr = dateArr.map(
                i => {
                  if (data.find(d => d.datestr === i)) {
                      return data.find(d => d.datestr === i).status;
                  } else {
                      return '';
                  }
                }
            )
            const markPointArr = dateArr.map(
                i => {
                    if (data.find(d => d.datestr === i)) {
                        return {
                          value: matchType(data.find(d => d.datestr === i).dvaluepct * 100, data.find(d => d.datestr === i).totalvolpct * 100 ),
                          xAxis: i,
                          yAxis: data.find(d => d.datestr === i).totalvolpct * 100,
                          itemStyle: {
                              color: matchColor(matchType(data.find(d => d.datestr === i).dvaluepct * 100, data.find(d => d.datestr === i).totalvolpct * 100 ))
                          }
                        }
                    } else {
                        return {};
                    }
                  }

            )
            //const dataArr =  data.map(i => i.dvaluepct);
            setOption({
                title: {
                    text: '',
                    left: 0
                },
                legend: {
                    data: ['TotalPct', 'DPct', 'OverRate']
                },
                // grid: [{
                //     left: '10%',
                //     right: '1%',
                //     top: '1%',
                //     height: '70%'
                // }],
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    }
                },
                toolbox: {
                    show: true,
                    orient: 'vertical',
                    left: 'right',
                    top: 'center',
                    feature: {
                        mark: {show: true},
                        magicType: {show: true, type: ['line', 'bar', 'stack', 'tiled']},
                        restore: {show: true},
                        saveAsImage: {show: true}
                    }
                },
                xAxis: {
                    type: 'category',
                    data: dateArr,
                    axisLabel: {show: true,interval:0,
                        rotate:45}
                },
                yAxis: {
                    type: 'value'
                },
                series: [{
                        name: 'TotalPct',
                        type: 'bar',
                        data: totalDataArr,
                        itemStyle: {
                            normal: {
                                color: '#444',
                            }
                        },
                        label: {
                            position: 'top'
                        },
                        markPoint: {
                            data: markPointArr, 
                        },
                        markLine : {
                            symbol: ['none','arrow'], //['none']表示是一条横线；['arrow', 'none']表示线的左边是箭头，右边没右箭头；['none','arrow']表示线的左边没有箭头，右边有箭头
                            label:{
                                  position:"start" //将警示值放在哪个位置，三个值“start”,"middle","end" 开始 中点 结束
                            },
                            data : [{
                                  silent:false, //鼠标悬停事件 true没有，false有
                                  lineStyle:{ //警戒线的样式 ，虚实 颜色
                                        type:"dotted", //样式  ‘solid’和'dotted'
                                        color:"#FA3934",
                                        width: 3   //宽度
                                   },
                                  label: { show: true, position:'end' },
                                  yAxis: 25 // 警戒线的标注值，可以有多个yAxis,多条警示线 或者采用 {type : 'average', name: '平均值'}，type值有 max min average，分为最大，最小，平均值
                            },{
                                silent:false, //鼠标悬停事件 true没有，false有
                                lineStyle:{ //警戒线的样式 ，虚实 颜色
                                      type:"dotted", //样式  ‘solid’和'dotted'
                                      color:"#FA3934",
                                      width: 3   //宽度
                                 },
                                label: { show: true, position:'end' },
                                yAxis: 50 // 警戒线的标注值，可以有多个yAxis,多条警示线 或者采用 {type : 'average', name: '平均值'}，type值有 max min average，分为最大，最小，平均值
                          },
                          {
                            silent:false, //鼠标悬停事件 true没有，false有
                            lineStyle:{ //警戒线的样式 ，虚实 颜色
                                  type:"dotted", //样式  ‘solid’和'dotted'
                                  color:"#FA3934",
                                  width: 3   //宽度
                             },
                            label: { show: true, position:'end' },
                            yAxis: 75 // 警戒线的标注值，可以有多个yAxis,多条警示线 或者采用 {type : 'average', name: '平均值'}，type值有 max min average，分为最大，最小，平均值
                      }]
                        },
                    },
                    {
                        name: 'DPct',
                        type: 'bar',
                        data: dataArr,
                        itemStyle: {
                            normal: {
                                color: function(params) {
                                    var colorList;
                                    if (statusArr[params.dataIndex] == 'up') {
                                        colorList = '#ef232a';
                                    } else if (statusArr[params.dataIndex] == 'down') {
                                        colorList = '#14b143';
                                    }
                                    return colorList;
                                },
                            }
                        }
                    },
                    {
                        name: 'OverRate',
                        type: 'line',
                        data: overRateArr,
                        itemStyle: {
                            normal: {
                                color: 'blue'
                            }
                        }
                    },
                    // {
                    //     name: 'FinalPrice',
                    //     type: 'line',
                    //     data: priceArr,
                    //     itemStyle: {
                    //         normal: {
                    //             color: 'yellow'
                    //         }
                    //     }
                    // }
                ]
              });

              setPriceOption({
                title: {
                    text: 'Final Price',
                    left: 0
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    }
                },
                toolbox: {
                    show: true,
                    orient: 'vertical',
                    left: 'right',
                    top: 'center',
                    feature: {
                        mark: {show: true},
                        magicType: {show: true, type: ['line', 'bar', 'stack', 'tiled']},
                        restore: {show: true},
                        saveAsImage: {show: true}
                    }
                },
                xAxis: {
                    type: 'category',
                    data: dateArr,
                    axisLabel: {show: true,interval:0,
                        rotate:45}
                },
                yAxis: {
                    type: 'value' ,
                    min:function(value){
                        return value.min;
                    }            
                },
                series: [
                    {
                        name: 'Final Price',
                        type: 'line',
                        data: priceArr,
                        itemStyle: {
                            normal: {
                                color: 'blue'
                            }
                        }
                    }
                ]
              })  
        }
        ).catch((error) => {  
            alert(error)  
        });

        fetch(`/update_stock_status?stock_id=${selectStock}&datestr=${moment(new Date()).format(dateFormat)}`, {method: 'GET'})
        .then(res =>res.json()).then(()=>{
            //reLoadAllAlarms(false);
        })

       // reLoadAllAlarms();

    }, [selectStock, selectAlarmType, selectDays]);


    const addtoFocus = useCallback(() => {
        fetch(`/add_focus?stock_id=${selectStock}&datestr=${selectDate}&comments=${comments}&predict=${predict}`, {method: 'GET'})
        .then(res =>res.json())

    }, [comments, selectStock, predict]);


    return (
        <div>
           <h2>Alarm</h2>
           <div><Button type="link" target="_blank" href={`https://finance.sina.com.cn/realstock/company/${selectStock}/nc.shtml`}>Go to Stock Page</Button></div>
           {/* <Input style={{width: '200px', height:'32px'}} size="small" placeholder="Input Stock" value={selectStock} onChange={(e) => {setSelectStock(e.target.value)}}/> */}
           <Select showSearch style={{width: '200px'}} onChange={(v) => {setSelectStock(v)}} loading={isLoading}>
               {stockOptions.map(i => <Select.Option value={i.symbol} style={{color: `${i.viewed ? 'red' : '#222'}`}}>{`${i.symbol} (${i['count(*)']})`}</Select.Option>)}
           </Select>
           <span>Total: {totalNum}</span>
           <Select style={{width: '100px'}} value={selectAlarmType} onChange={(v) => {setSelectAlarmType(v)}} size="middle">
               <Select.Option value='All' style={{color:'red'}}>All</Select.Option>
               <Select.Option value='A1A2'>A1A2</Select.Option>
               <Select.Option value='A1Today'>A1 Today UP</Select.Option>
               <Select.Option value='A1'>A1</Select.Option>
               <Select.Option value='A2'>A2</Select.Option>
               <Select.Option value='A3'>A3</Select.Option>
           </Select>
           <Button type="primary" onClick={() => getStockAlarm()}>Show Alarm</Button>

           <div style={{ display: 'inline-block', marginLeft: '10px'}}> Show <Input style={{width: '100px', height:'32px'}} size="small" placeholder="You can select the number of days to view" value={selectDays} onChange={(e) => {
               if (isNaN(parseInt(e.target.value))) {
                alert('F*ck u');
               } else {
                setSelectDays(e.target.value)
               }
            }}/> days Data</div>
            <DatePicker defaultValue={moment(selectDate, dateFormat)} format={dateFormat} onChange={(v) =>setSelectDate(v.format(dateFormat))}/>
            <span style={{display:'inline-block', marginLeft:'100px'}}>From</span>
            <DatePicker defaultValue={moment(selectStartDate, dateFormat)} format={dateFormat} onChange={(v) =>setSelectStartDate(v.format(dateFormat))}/> {'  TO  '}
            <DatePicker defaultValue={moment(selectEndDate, dateFormat)} format={dateFormat} onChange={(v) =>setSelectEndDate(v.format(dateFormat))}/>
            <Button onClick={() => {reLoadAllAlarms(true)}}>Load</Button>
            <Button onClick={() => {reLoadAllAlarms(false)}}>Remove Time Filter</Button>
            <div style={{marginTop: '20px'}}>
                Advanced Filter:
                <Select style={{width: '180px'}} value={selectConsTotal} onChange={(v) => {setSelectConsTotal(v)}} size="small">
                  <Select.Option value='CONS'>Continuously Appear</Select.Option>
                  <Select.Option value='TOTAL'>Total Appear</Select.Option>
                </Select>
                <Select style={{width: '80px'}} value={selectConsUpDown} onChange={(v) => {setSelectConsUpDown(v)}} size="small">
                  <Select.Option value='up'>Up</Select.Option>
                  <Select.Option value='down'>Down</Select.Option>
                </Select>
                {' for '}
                <Input style={{width: '50px', height:'32px'}} size="small" placeholder="Input Days" value={selectConsDays} onChange={(e) => {setSelectConsDays(e.target.value)}}/>
                days
                <Button type="primary" onClick={() => {if (selectConsDays && !isNaN(selectConsDays)) {
                   setIsLoading(true); 
                   advancedSearch(selectConsDays, selectConsTotal, selectConsUpDown);
                } }}> Set Advanced Search</Button>
                <Button type="primary" onClick={() => {reLoadAllAlarms(false) }}> Clear Advanced Search</Button>
            </div>
            <div>
              Comments
              <Input style={{width: '250px', height:'32px'}} size="small" placeholder="" value={comments} onChange={(e) => {setComments(e.target.value)}}/>
              <Radio.Group onChange={(e)=>setPredict(e.target.value)} value={predict}>
                <Radio value={'up'}>看涨</Radio>
                <Radio value={'down'}>看跌</Radio>
              </Radio.Group>
              <Button type="primary" onClick={() => {addtoFocus()}}>Add to My Focus</Button>
            </div>
           <ReactEcharts
             style={{ height: 350, width: 1450 }}
             notMerge={true}
             lazyUpdate={true}
             option={option} />
           <ReactEcharts
             style={{ height: 350, width: 1450 }}
             notMerge={true}
             lazyUpdate={true}
             option={priceOption} />  
        </div>
        
    )
}