import React from 'react';
import { Menu } from 'antd';
import { AlarmComponent } from './component/alarm';
import { MyFocusListComponent } from './component/myFocus';
import { Selected } from './component/selected';
import { BrowserRouter, Switch, Route, Link } from 'react-router-dom';
import { AdvancedSearchCom } from './component/advanced_search_result';
import { Alarm100Component } from './component/alarm100';
import { PlateComponent } from './component/focus_plate';
const MENU_ALARM = 'alarm';
const MENU_FOCUSED = 'my_focus';
const MENU_SELECTED = 'selected';
const MENU_ALARM_100 = 'alarm100';
const MENU_AD = 'advanced_search_result';
const MENU_PLATE = 'plate';

function getInitPath() {
  if (window) {
    const path = window.location.pathname;

    if (
      [MENU_ALARM, MENU_FOCUSED, MENU_SELECTED, MENU_ALARM_100, MENU_AD, MENU_PLATE].find((p) =>
        path.startsWith(`/${p}`)
      )
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
    console.log(evt);
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
        <Menu.Item key={MENU_SELECTED}>
          <Link to="/selected">Selected</Link>
        </Menu.Item>
        <Menu.Item key={MENU_AD}>
          <Link to="/advanced_search_result">Advanced Search Result</Link>
        </Menu.Item>
        <Menu.Item key={MENU_PLATE}>
          <Link to="/plate">Plate List</Link>
        </Menu.Item>
      </Menu>
      <Switch>
        <Route path="/my_focus" component={MyFocusListComponent}>
          <MyFocusListComponent />
        </Route>
        <Route path="/selected" component={Selected}>
          <Selected />
        </Route>
        <Route path="/advanced_search_result" component={AdvancedSearchCom}>
          <AdvancedSearchCom />
        </Route>
        <Route path="/alarm100" component={Alarm100Component}>
          <Alarm100Component />
        </Route>
        <Route path="/plate" component={PlateComponent}>
          <PlateComponent />
        </Route>
        <Route path="/" component={AlarmComponent}>
          <AlarmComponent />
        </Route>
      </Switch>
    </BrowserRouter>
  );
};

export default App;
