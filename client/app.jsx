import React from 'react';
import { Menu } from 'antd';
import { AlarmComponent } from './component/alarm';
import { MyFocusListComponent } from './component/myFocus';
import { Selected } from './component/selected';
import { BrowserRouter, Switch, Route, Link } from 'react-router-dom';

const MENU_ALARM = 'alarm';
const MENU_FOCUSED = 'focused';
const MENU_SELECTED = 'selected';

const App = () => {
  const [current, setCurrent] = React.useState(MENU_ALARM);

  const handleMenuClick = (evt) => {
    console.log(evt);
    setCurrent(evt.key);
  };

  return (
    <BrowserRouter>
      <Menu
        onClick={handleMenuClick}
        selectedKeys={[current]}
        mode="horizontal"
      >
        <Menu.Item key={MENU_ALARM}>
          <Link to="/">Alarm</Link>
        </Menu.Item>
        <Menu.Item key={MENU_FOCUSED}>
          <Link to="/my_focus">My Focus</Link>
        </Menu.Item>
        <Menu.Item key={MENU_SELECTED}>
          <Link to="/selected">Selected</Link>
        </Menu.Item>
      </Menu>
      <Switch>
        <Route path="/my_focus" component={MyFocusListComponent}>
          <MyFocusListComponent />
        </Route>
        <Route path="/selected" component={Selected}>
          <Selected />
        </Route>
        <Route path="/" component={AlarmComponent}>
          <AlarmComponent />
        </Route>
      </Switch>
    </BrowserRouter>
  );
};

export default App;
