import React, { useState, useEffect } from 'react';
import { Menu, Button, Drawer, Checkbox, Space, message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { AlarmComponent } from './component/new_alarm';
import { MyFocusListComponent } from './component/myFocus';
import { BrowserRouter, Switch, Route, Link, useHistory, useLocation } from 'react-router-dom';
import { PlateComponent } from './component/focus_plate';
import { DataAnalysisCom } from './component/data_analysis';
import { DAFocusListComponent } from './component/da_focus';
import { DAPlatesCom } from './component/da_plate';
import { TotalDataCom } from './component/data_total';
import { TotalDataComNew } from './component/data_total_new';
import SimpleAlarmTrend from './component/data_trends'; 
import { DataAlarmCom } from './component/data_analysis_alarm';
import { CriticalStocksComponent } from './component/critical_stocks';
import { CriticalStocks3Component } from './component/critical_stocks_3';
import { MyFocus2ListComponent } from './component/myFocus2';
import { VlogComponent } from './component/vlog';
import { TopPlatesListComponent } from './component/top_plates_list';
import BoardHistory from './component/board_history';

const MENU_ALARM = 'alarm';
const MENU_FOCUSED1 = 'my_focus1';
const MENU_ALARM_100 = 'alarm100';
const MENU_PLATE = 'plate';
const MENU_DATA_ANA = 'data_analysis';
const MENU_OLD_ALARM = 'old_alarm';
const MENU_DA_FOCUS = 'da_focus';
const MENU_DA_PLATE = 'da_plate';
const MENU_DA_TOTAL = 'da_total';
const MENU_DA_TOTAL_NEW = 'da_total_new';
const MENU_DA_TRENDS = 'da_trends';
const MENU_DA_ALARM = 'da_alarm';
const MENU_CRI_STOCK = 'cri_stocks';
const MENU_CRI_STOCK_3 = 'cri_stocks_3';
export const MENU_DA_DR = 'da_dr';
const MENU_FOCUSED2 = 'my_focus2';
const MENU_VLOG = 'vlog';
const MENU_TOP_PLATES = 'tops';
const MENU_BOARD_HISTORY = 'board_history';

// 定义所有菜单项 - 注意顺序很重要，更具体的路径应该放在前面
const ALL_MENU_ITEMS = [
  { key: MENU_DA_TRENDS, path: '/da_trends', label: 'DA Trends', component: SimpleAlarmTrend, props: {} },
  { key: MENU_ALARM, path: '/', label: 'Alarm', component: AlarmComponent, props: { from100: false }, exact: true },
  { key: MENU_ALARM_100, path: '/alarm100', label: 'Alarm100', component: AlarmComponent, props: { from100: true } },
  { key: MENU_DA_TOTAL_NEW, path: '/da_total_new', label: 'DA Total New', component: TotalDataComNew, props: { isDR: true } },
  { key: MENU_DA_TOTAL, path: '/da_total', label: 'DA Total', component: TotalDataCom, props: { isDR: true } },
  { key: MENU_DA_DR, path: '/da_dr', label: 'DA DR', component: DataAnalysisCom, props: { isDR: true } },
  { key: MENU_DA_ALARM, path: '/da_alarm', label: 'DA Tody Alarm', component: DataAlarmCom, props: { isDR: false } },
  { key: MENU_DA_FOCUS, path: '/da_focus', label: 'DA Focus', component: DAFocusListComponent, props: {} },
  { key: MENU_DATA_ANA, path: '/data_analysis', label: 'Data Analysis', component: DataAnalysisCom, props: {} },
  { key: MENU_CRI_STOCK_3, path: '/cri_stocks_3', label: 'Critical Stocks 3', component: CriticalStocks3Component, props: {} },
  { key: MENU_CRI_STOCK, path: '/cri_stocks', label: 'Critical Stocks', component: CriticalStocksComponent, props: {} },
  { key: MENU_FOCUSED1, path: '/my_focus1', label: 'MF1', component: MyFocusListComponent, props: {} },
  { key: MENU_FOCUSED2, path: '/my_focus2', label: 'MF2', component: MyFocus2ListComponent, props: {} },
  { key: MENU_VLOG, path: '/vlog', label: 'VLOG', component: VlogComponent, props: {} },
  { key: MENU_TOP_PLATES, path: '/tops', label: 'TOPS', component: TopPlatesListComponent, props: {} },
  { key: MENU_DA_PLATE, path: '/da_plate', label: 'DA Plate', component: DAPlatesCom, props: {} },
  { key: MENU_PLATE, path: '/plate', label: 'Plate List', component: PlateComponent, props: {} },
  { key: MENU_BOARD_HISTORY, path: '/board_history', label: 'Board History', component: BoardHistory, props: {} },
];

// 获取默认显示的菜单
const DEFAULT_VISIBLE_MENUS = [
  MENU_DA_TOTAL_NEW,
  MENU_PLATE,
  MENU_DA_PLATE,
  MENU_DA_TRENDS,
  MENU_CRI_STOCK_3,
  MENU_FOCUSED1,
  MENU_FOCUSED2,
  MENU_TOP_PLATES,
  MENU_VLOG,  
  MENU_BOARD_HISTORY,  // 添加新菜单到默认显示
];

const STORAGE_KEY = 'visible_menus';

// 根据路径获取菜单key - 修复匹配逻辑，优先匹配更具体的路径
function getMenuKeyFromPath(pathname: string): string | null {
  if (pathname === '/') {
    return MENU_ALARM;
  }
  
  // 按路径长度降序排序，优先匹配更具体的路径（如 /da_total_new 优先于 /da_total）
  const sortedItems = [...ALL_MENU_ITEMS].sort((a, b) => b.path.length - a.path.length);
  
  const found = sortedItems.find((item) => {
    if (item.key === MENU_ALARM) return false;
    return pathname.startsWith(item.path);
  });
  
  return found ? found.key : null;
}

function getSavedVisibleMenus(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load menu settings:', e);
  }
  return DEFAULT_VISIBLE_MENUS;
}

function saveVisibleMenus(menus: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
}

// 内部组件，用于访问路由相关hooks
const AppContent = (): JSX.Element => {
  const history = useHistory();
  const location = useLocation();
  const [current, setCurrent] = useState<string>(MENU_ALARM);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [visibleMenus, setVisibleMenus] = useState<string[]>(() => getSavedVisibleMenus());

  // 检查当前路径是否在可见菜单中，如果不在则跳转到第一个可见菜单
  useEffect(() => {
    const currentMenuKey = getMenuKeyFromPath(location.pathname);
    console.log('Path check - pathname:', location.pathname, 'currentMenuKey:', currentMenuKey);
    
    if (currentMenuKey) {
      setCurrent(currentMenuKey);
      if (!visibleMenus.includes(currentMenuKey)) {
        // 当前页面被隐藏，跳转到第一个可见菜单
        const firstVisibleMenu = ALL_MENU_ITEMS.find(item => visibleMenus.includes(item.key));
        if (firstVisibleMenu) {
          console.log('Current page hidden, redirecting to:', firstVisibleMenu.path);
          history.replace(firstVisibleMenu.path);
          setCurrent(firstVisibleMenu.key);
        }
      }
    }
  }, [location.pathname, visibleMenus, history]);

  const handleMenuClick = (evt) => {
    console.log('Menu clicked:', evt.key);
    setCurrent(evt.key);
  };

  const openDrawer = () => {
    console.log('=== Button clicked - Opening drawer ===');
    message.info('打开菜单设置');
    setDrawerVisible(true);
  };

  const closeDrawer = () => {
    console.log('Closing drawer');
    setDrawerVisible(false);
  };

  const resetToDefault = () => {
    console.log('Resetting to default menus');
    setVisibleMenus(DEFAULT_VISIBLE_MENUS);
    saveVisibleMenus(DEFAULT_VISIBLE_MENUS);
    
    // 检查当前页面是否在默认菜单中
    const currentMenuKey = getMenuKeyFromPath(location.pathname);
    if (currentMenuKey && !DEFAULT_VISIBLE_MENUS.includes(currentMenuKey)) {
      const firstVisibleMenu = ALL_MENU_ITEMS.find(item => DEFAULT_VISIBLE_MENUS.includes(item.key));
      if (firstVisibleMenu) {
        history.replace(firstVisibleMenu.path);
        setCurrent(firstVisibleMenu.key);
      }
    }
    message.success('已恢复默认菜单');
  };

  const showAll = () => {
    console.log('Showing all menus');
    const allKeys = ALL_MENU_ITEMS.map(item => item.key);
    setVisibleMenus(allKeys);
    saveVisibleMenus(allKeys);
    message.success('已显示全部菜单');
  };

  const handleCheckboxChange = (checkedValues: any[]) => {
    console.log('Checkbox changed:', checkedValues);
    setVisibleMenus(checkedValues as string[]);
    saveVisibleMenus(checkedValues as string[]);
    
    // 检查当前页面是否被隐藏
    const currentMenuKey = getMenuKeyFromPath(location.pathname);
    if (currentMenuKey && !checkedValues.includes(currentMenuKey)) {
      const firstVisibleMenu = ALL_MENU_ITEMS.find(item => checkedValues.includes(item.key));
      if (firstVisibleMenu) {
        console.log('Current page hidden due to checkbox change, redirecting to:', firstVisibleMenu.path);
        history.replace(firstVisibleMenu.path);
        setCurrent(firstVisibleMenu.key);
      }
    }
  };

  const visibleMenuItems = ALL_MENU_ITEMS.filter(item => visibleMenus.includes(item.key));

  return (
    <div style={{ position: 'relative' }}>
      <Menu
        onClick={handleMenuClick}
        selectedKeys={[current]}
        mode="horizontal"
        style={{ paddingRight: 60 }}
      >
        {visibleMenuItems.map((item) => (
          <Menu.Item key={item.key}>
            <Link to={item.path}>{item.label}</Link>
          </Menu.Item>
        ))}
      </Menu>
      <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 999 }}>
        <Button
          type="primary"
          icon={<SettingOutlined />}
          onClick={openDrawer}
          size="middle"
        >
          菜单设置
        </Button>
      </div>

      <Drawer
        title="菜单设置"
        placement="right"
        onClose={closeDrawer}
        visible={drawerVisible}
        width={300}
        closable={true}
        maskClosable={true}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Button onClick={resetToDefault} style={{ marginRight: 8 }}>
              恢复默认
            </Button>
            <Button onClick={showAll}>
              显示全部
            </Button>
          </div>
          <div style={{ marginTop: 16 }}>
            <h4>选择要显示的菜单：</h4>
            <Checkbox.Group
              value={visibleMenus}
              onChange={handleCheckboxChange}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {ALL_MENU_ITEMS.map((item) => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox value={item.key}>{item.label}</Checkbox>
                  </div>
                ))}
              </Space>
            </Checkbox.Group>
          </div>
        </Space>
      </Drawer>

      <Switch>
        {ALL_MENU_ITEMS.map((item) => {
          const Component = item.component;
          const routeProps: any = {
            key: item.key,
            path: item.path,
            exact: item.exact || false,
          };
          
          return (
            <Route {...routeProps}>
              <Component {...item.props} />
            </Route>
          );
        })}
      </Switch>
    </div>
  );
};

const App = (): JSX.Element => {
  return (
    <BrowserRouter forceRefresh={false}>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;