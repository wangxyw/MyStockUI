import React from 'react';
import { Menu } from 'antd';
import { AlarmComponent } from './component/alarm';
import { MyFocusListComponent } from './component/myFocus';
import { Selected } from './component/selected';
import { BrowserRouter, Switch, Route, Link } from 'react-router-dom';

const MENU_ALARM = 'alarm';
const MENU_FOCUSED = 'my_focus';
const MENU_SELECTED = 'selected';

function getInitPath() {
  if (window) {
    const path = window.location.pathname;

    if (
      [MENU_ALARM, MENU_FOCUSED, MENU_SELECTED].find((p) =>
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
