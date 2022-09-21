import React from 'react';
import { Menu } from 'antd';
import { AlarmComponent } from './component/new_alarm';
import { MyFocusListComponent } from './component/myFocus';
import { BrowserRouter, Switch, Route, Link } from 'react-router-dom';
import { PlateComponent } from './component/focus_plate';
import { DataAnalysisCom } from './component/data_analysis';
import { DAFocusListComponent } from './component/da_focus';
import { DAPlatesCom } from './component/da_plate';
import { DataAnalysisDRCom } from './component/data_analysis_dr';
const MENU_ALARM = 'alarm';
const MENU_FOCUSED = 'my_focus';
const MENU_ALARM_100 = 'alarm100';
const MENU_PLATE = 'plate';
const MENU_DATA_ANA = 'data_analysis';
const MENU_OLD_ALARM = 'old_alarm';
const MENU_DA_FOCUS = 'da_focus';
const MENU_DA_PLATE = 'da_plate';
export const MENU_DA_DR = 'da_dr';

function getInitPath() {
  if (window) {
    const path = window.location.pathname;

    if (
      [
        MENU_ALARM,
        MENU_FOCUSED,
        MENU_ALARM_100,
        MENU_DATA_ANA,
        MENU_PLATE,
        MENU_OLD_ALARM,
        MENU_DA_FOCUS,
        MENU_DA_PLATE,
        MENU_DA_DR,
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
        <Menu.Item key={MENU_FOCUSED}>
          <Link to="/my_focus">My Focus</Link>
        </Menu.Item>
        <Menu.Item key={MENU_DATA_ANA}>
          <Link to="/data_analysis">Data Analysis</Link>
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
      </Menu>
      <Switch>
        <Route path="/my_focus" component={MyFocusListComponent}>
          <MyFocusListComponent />
        </Route>
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
        <Route path="/" component={AlarmComponent}>
          <AlarmComponent from100={false} />
        </Route>
      </Switch>
    </BrowserRouter>
  );
};

export default App;
