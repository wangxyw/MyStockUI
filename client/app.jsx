
var React = require('react');
var ReactDOM = require('react-dom');
import ReactEcharts from 'echarts-for-react';
import { Select } from 'antd';
import { AlarmComponent } from './component/alarm';
import { MyFocusListComponent } from './component/myFocus';
import { BrowserRouter, Switch, Route, Link } from 'react-router-dom';

class MessageList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
           stockList: [],
           option: {},
           selectStockId: '',
           selectVom: 40000
        };
        
    }

    componentDidMount() {
       this.getStockData();
    }
 
    render() {
        var self = this;
        var stocks = self.state.stockList;
        var vols = [40000, 50000, 60000, 70000, 80000, 90000, 100000];
        const { Option } = Select;
        return (<section className="pageContentInner">
            <div className="head-section"><h1>Stock ID: {this.state.selectStockId}</h1></div>
            <p style={{display:'inline-block', marginRight: '10px'}}>Select Stocks: </p>
            <Select title="Select Stock" style={{width: '200px'}} onChange={
                (v) => {self.setState({selectStockId: v}); self.reDrawChart(v, this.selectVom)}
            }>
                {
                stocks.map(i => <Option value={i.symbol}>{i.symbol}</Option>)
                }
            </Select>
            <p style={{display:'inline-block', marginRight: '10px'}}>Select Vol: </p>
            <Select title="Select MinVOL" style={{width: '100px', marginBottom: '20px'}} 
              defaultValue={40000}
              onChange={
                (v) => {self.setState({selectVom: v}); self.reDrawChart(this.state.selectStockId, v)}
            }>
                {
                vols.map(i => <Option value={i}>{i}</Option>)
                }
            </Select>
            <ReactEcharts
             style={{ height: 250, width: 1350 }}
             notMerge={true}
             lazyUpdate={true}
             option={this.state.option} />
             <AlarmComponent />
             {/* <MyFocusListComponent/> */}
        </section>);
    }
 
    reDrawChart(stock_id, minvol = 40000 ) {
        var self = this;
        fetch(`/stock_info?stock_id=${stock_id}&minvol=${minvol}`, {method: 'GET'})
        .then(
          res =>res.json()
        ).then(data => {
            console.log(data);
            self.setState({'option': {
                title: {
                    text: '',
                    left: 0
                },
                legend: {
                    data: ['TotalPct', 'DPct']
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
                grid: [{
                    left: '10%',
                    right: '1%',
                   // height: '70%'
                }],
                xAxis: {
                    type: 'category',
                    data: data.map(i => i.datestr),
                    axisLabel: {show: true, interval:0, rotate:45}
                },
                yAxis: {
                    type: 'value'
                },
                series: [{
                    name: 'TotalPct',
                    type: 'bar',
                    data: data.map(i => i.totalvolpct * 100),
                    itemStyle: {
                        normal: {
                            color: '#333'
                        }
                    }
                },
                {
                        name: 'DPct',
                        type: 'bar',
                        data: data.map(i => i.dvaluepct * 100),
                        itemStyle: {
                            normal: {
                                color: function(params) {
                                    var colorList;
                                    const status = data.map(i => i.status);
                                    if (status[params.dataIndex] == 'up') {
                                        colorList = '#ef232a';
                                    } else {
                                        colorList = '#14b143';
                                    }
                                    return colorList;
                                },
                            }
                        }
                    }
                ]
              }})
        }
        ).catch((error) => {  
            alert(error)  
        });
    }

    getStockData() {
        var self = this;
        fetch('/stock_list', {method: 'GET'})
        .then(
          res =>res.json()
        ).then(data => {
            console.log(data);
            self.setState({'stockList': data})
        }
        ).catch((error) => {  
            alert(error)  
        });
    }
}
 
ReactDOM.render(
  <BrowserRouter>
   <div>
      <nav>
      <ul>
            <li>
              <Link to="/">Select and Alarm</Link>
            </li>
            <li>
              <Link to="/my_focus">My Focus</Link>
            </li>
          </ul>
      </nav>
    <Switch>
    <Route path="/my_focus" component={MyFocusListComponent}><MyFocusListComponent/></Route>
    <Route path="/" component={MessageList}><MessageList/></Route>
    </Switch>
    </div>
  </BrowserRouter>,
  document.getElementById('main-container')
);