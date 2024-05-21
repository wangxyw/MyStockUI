import React from 'react';
import { Menu } from 'antd';
import { AlarmComponent } from './component/new_alarm';
import { MyFocusListComponent } from './component/myFocus';
import { MyFocusExpireListComponent } from './component/myFocusExpire';
import { BrowserRouter, Switch, Route, Link } from 'react-router-dom';
import { PlateComponent } from './component/focus_plate';
import { DataAnalysisCom } from './component/data_analysis';
import { DAFocusListComponent } from './component/da_focus';
import { DAPlatesCom } from './component/da_plate';
import { TotalDataCom } from './component/data_total';
import { DataAlarmCom } from './component/data_analysis_alarm';
import { CriticalStocksComponent } from './component/critical_stocks';
import { CriticalStocks3Component } from './component/critical_stocks_3';
import { MyFocus2ListComponent } from './component/myFocus2';
import { MyFocusExpire2ListComponent } from './component/myFocusExpire2';
const MENU_ALARM = 'alarm';
const MENU_FOCUSED = 'my_focus';
const MENU_FOCUSED_EXPIRE = 'expire_my_focus';
const MENU_ALARM_100 = 'alarm100';
const MENU_PLATE = 'plate';
const MENU_DATA_ANA = 'data_analysis';
const MENU_OLD_ALARM = 'old_alarm';
const MENU_DA_FOCUS = 'da_focus';
const MENU_DA_PLATE = 'da_plate';
const MENU_DA_TOTAL = 'da_total';
const MENU_DA_ALARM = 'da_alarm';
const MENU_CRI_STOCK = 'cri_stocks';
const MENU_CRI_STOCK_3 = 'cri_stocks_3';
export const MENU_DA_DR = 'da_dr';
const MENU_FOCUSED2 = 'my_focus2';
const MENU_FOCUSED_EXPIRE2 = 'expire_my_focus2';

function getInitPath() {
  if (window) {
    const path = window.location.pathname;

    if (
      [
        MENU_ALARM,
        MENU_FOCUSED,
        MENU_FOCUSED_EXPIRE,
        MENU_ALARM_100,
        MENU_DATA_ANA,
        MENU_PLATE,
        MENU_OLD_ALARM,
        MENU_DA_FOCUS,
        MENU_DA_PLATE,
        MENU_DA_DR,
        MENU_DA_TOTAL,
        MENU_DA_ALARM,
        MENU_CRI_STOCK,
        MENU_CRI_STOCK_3,
        MENU_FOCUSED2,
        MENU_FOCUSED_EXPIRE2,
      ].find((p) => path.startsWith(`/${p}`))
    ) {
      return path.slice(1);
    } else {
      return null;
    }
  } else {
    return null;
  }
}

const App = (): JSX.Element => {
  const [current, setCurrent] = React.useState(getInitPath() || MENU_ALARM);

  const handleMenuClick = (evt) => {
    setCurrent(evt.key);
  };

  return (
    <BrowserRouter forceRefresh={false}>
      <Menu
        onClick={handleMenuClick}
        selectedKeys={[current]}
        mode="horizontal"
      >
        <Menu.Item key={MENU_ALARM}>
          <Link to="/">Alarm</Link>
        </Menu.Item>
        <Menu.Item key={MENU_ALARM_100}>
          <Link to="/alarm100">Alarm100</Link>
        </Menu.Item>
        <Menu.Item key={MENU_DATA_ANA}>
          <Link to="/data_analysis">Data Analysis</Link>
        </Menu.Item>
        <Menu.Item key={MENU_DA_ALARM}>
          <Link to="/da_alarm">DA Tody Alarm</Link>
        </Menu.Item>
        <Menu.Item key={MENU_DA_FOCUS}>
          <Link to="/da_focus">DA Focus</Link>
        </Menu.Item>
        <Menu.Item key={MENU_PLATE}>
          <Link to="/plate">Plate List</Link>
        </Menu.Item>
        <Menu.Item key={MENU_DA_PLATE}>
          <Link to="/da_plate">DA Plate</Link>
        </Menu.Item>
        <Menu.Item key={MENU_DA_DR}>
          <Link to="/da_dr">DA DR</Link>
        </Menu.Item>
        <Menu.Item key={MENU_DA_TOTAL}>
          <Link to="/da_total">DA Total</Link>
        </Menu.Item>
        <Menu.Item key={MENU_CRI_STOCK}>
          <Link to="/cri_stocks">Critical Stocks</Link>
        </Menu.Item>
        <Menu.Item key={MENU_CRI_STOCK_3}>
          <Link to="/cri_stocks_3">Critical Stocks 3</Link>
        </Menu.Item>
        <Menu.Item key={MENU_FOCUSED}>
          <Link to="/my_focus">MF1</Link>
        </Menu.Item>
        <Menu.Item key={MENU_FOCUSED_EXPIRE}>
          <Link to="/expire_my_focus">MF1 Expire</Link>
        </Menu.Item>
        <Menu.Item key={MENU_FOCUSED2}>
          <Link to="/my_focus2">MF2</Link>
        </Menu.Item>
        <Menu.Item key={MENU_FOCUSED_EXPIRE2}>
          <Link to="/expire_my_focus2">MF2 Expire</Link>
        </Menu.Item>
      </Menu>
      <Switch>
        <Route path="/data_analysis" component={DataAnalysisCom}>
          <DataAnalysisCom />
        </Route>
        <Route path="/alarm100" component={AlarmComponent}>
          <AlarmComponent from100={true} />
        </Route>
        <Route path="/plate" component={PlateComponent}>
          <PlateComponent />
        </Route>
        <Route path="/da_focus" component={DAFocusListComponent}>
          <DAFocusListComponent />
        </Route>
        <Route path="/da_plate" component={DAPlatesCom}>
          <DAPlatesCom />
        </Route>
        <Route path="/da_dr">
          <DataAnalysisCom isDR={true} />
        </Route>
        <Route path="/da_total">
          <TotalDataCom isDR={true} />
        </Route>
        <Route path="/da_alarm">
          <DataAlarmCom isDR={false} />
        </Route>
        <Route path="/cri_stocks">
          <CriticalStocksComponent />
        </Route>
        <Route path="/cri_stocks_3">
          <CriticalStocks3Component />
        </Route>
        <Route path="/my_focus" component={MyFocusListComponent}>
          <MyFocusListComponent />
        </Route>
        <Route path="/expire_my_focus" component={MyFocusExpireListComponent}>
          <MyFocusExpireListComponent />
        </Route>
        <Route path="/my_focus2" component={MyFocus2ListComponent}>
          <MyFocus2ListComponent />
        </Route>
        <Route path="/expire_my_focus2" component={MyFocusExpire2ListComponent}>
          <MyFocusExpire2ListComponent />
        </Route>    
        <Route path="/" component={AlarmComponent}>
          <AlarmComponent from100={false} />
        </Route>
      </Switch>
    </BrowserRouter>
  );
};

export default App;
