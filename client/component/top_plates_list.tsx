import React, { useState, useEffect } from 'react';
import { 
  Button,
  DatePicker, 
  Table, 
  Spin, 
  message, 
  Tabs, 
  Card, 
  Statistic, 
  Row, 
  Col,
  Tag,
  Modal,
  Select,
  Space,
  Tooltip
} from 'antd';
import moment from 'moment';
import { get } from '../lib/request';
import ReactEcharts from 'echarts-for-react';
import { groupBy, isEmpty, orderBy } from 'lodash';
import './alarm.css';

const { TabPane } = Tabs;
const { Option } = Select;

// 定义数据类型
interface BusinessStatsData {
  end_date: string;
  business_code: string;
  name: string;
  count: number;
}

// 定义历史数据类型
interface BusinessHistoryData {
  end_date: string;
  business_code: string;
  name: string;
  count: number;
}

// 定义报警股票数据类型
interface AlertStockData {
  symbol: string;
  name: string;
  stock_name?: string;
  alert_date: string;
  comments: string;
  continuance_BYG: string;
  source?: string;
}

// 图表配置函数（柱状图）
const businessChartOption = (data: BusinessStatsData[], title: string, color: string = '#1890ff') => {
  const groupedByCode = groupBy(data, 'business_code');
  const codes = Object.keys(groupedByCode);
  const counts = codes.map(code => 
    groupedByCode[code].reduce((sum, item) => sum + item.count, 0)
  );

  return {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 14
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: '数量',
      nameTextStyle: {
        fontSize: 11
      }
    },
    yAxis: {
      type: 'category',
      data: codes.map(code => {
        const item = groupedByCode[code][0];
        return item.name;
      }),
      axisLabel: { 
        interval: 0,
        fontSize: 11,
        width: 100,
        overflow: 'truncate'
      },
    },
    series: [
      {
        name: '数量',
        type: 'bar',
        data: counts,
        itemStyle: {
          color: color,
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 11
        },
        barWidth: 15,
      },
    ],
  };
};

// 合并历史数据曲线图配置函数
const combinedHistoryChartOption = (
  upData: BusinessHistoryData[], 
  downData: BusinessHistoryData[], 
  businessName: string, 
  days: number
) => {
  const orderedUpData = orderBy(upData, 'end_date', 'asc');
  const orderedDownData = orderBy(downData, 'end_date', 'asc');
  
  // 合并所有日期用于x轴
  const allDates = orderBy(Array.from(new Set([
    ...orderedUpData.map(item => item.end_date),
    ...orderedDownData.map(item => item.end_date)
  ])), undefined, 'asc');
  
  // 创建按日期索引的数据映射
  const upMap = new Map(orderedUpData.map(item => [item.end_date, item.count]));
  const downMap = new Map(orderedDownData.map(item => [item.end_date, item.count]));
  
  // 填充数据，缺失的日期用null表示
  const upCounts = allDates.map(date => upMap.get(date) || null);
  const downCounts = allDates.map(date => downMap.get(date) || null);

  return {
    title: {
      text: `${businessName} - 涨跌对比趋势 (${days}天)`,
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: function(params: any) {
        let result = params[0].name + '<br/>';
        params.forEach((param: any) => {
          if (param.value !== null) {
            result += `${param.marker} ${param.seriesName}: ${param.value}只<br/>`;
          }
        });
        return result;
      }
    },
    legend: {
      data: ['上涨股票数', '下跌股票数'],
      orient: 'horizontal',
      left: 'center',
      top: 50,
      itemWidth: 20,
      itemHeight: 10
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '8%',
      top: '20%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: allDates,
      axisLabel: { 
        interval: Math.floor(allDates.length / 15),
        rotate: 45,
        fontSize: 11,
        margin: 10
      },
      axisLine: {
        lineStyle: {
          color: '#999'
        }
      },
      axisTick: {
        alignWithLabel: true
      }
    },
    yAxis: {
      type: 'value',
      name: '股票数量 (只)',
      nameTextStyle: {
        fontSize: 13,
        fontWeight: 'normal'
      },
      axisLabel: {
        fontSize: 11
      },
      splitLine: {
        lineStyle: {
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name: '上涨股票数',
        type: 'line',
        data: upCounts,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 3,
          color: '#ff4d4f',
        },
        areaStyle: {
          color: 'rgba(255, 77, 79, 0.1)',
        },
        itemStyle: {
          color: '#ff4d4f',
        },
        connectNulls: true,
        markPoint: {
          data: [
            { type: 'max', name: '最大值', symbolSize: 60 },
            { type: 'min', name: '最小值', symbolSize: 60 }
          ],
          label: {
            formatter: '{b}: {c}只',
            fontSize: 11
          }
        }
      },
      {
        name: '下跌股票数',
        type: 'line',
        data: downCounts,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 3,
          color: '#52c41a',
        },
        areaStyle: {
          color: 'rgba(82, 196, 26, 0.1)',
        },
        itemStyle: {
          color: '#52c41a',
        },
        connectNulls: true,
        markPoint: {
          data: [
            { type: 'max', name: '最大值', symbolSize: 60 },
            { type: 'min', name: '最小值', symbolSize: 60 }
          ],
          label: {
            formatter: '{b}: {c}只',
            fontSize: 11
          }
        }
      }
    ],
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        bottom: 0,
        height: 20,
        borderColor: 'transparent',
        backgroundColor: '#e2e2e2',
        fillerColor: 'rgba(24, 144, 255, 0.2)',
        handleStyle: {
          color: '#1890ff'
        }
      },
      {
        type: 'inside',
        start: 0,
        end: 100
      }
    ],
  };
};

// 提取主要内容为单独组件
const ContentSection = ({ 
  title,
  businessData, 
  isLoading, 
  analyzeDate, 
  onDateChange, 
  onRefresh,
  status = 'up',
  chartColor = '#1890ff',
  onShowCombinedChart,
  onShowAlertStocks,
  selectedBusinessForChart
}: { 
  title: string;
  businessData: BusinessStatsData[];
  isLoading: boolean;
  analyzeDate: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  status?: string;
  chartColor?: string;
  onShowCombinedChart?: (businessCode: string, businessName: string) => void;
  onShowAlertStocks?: (businessCode: string, businessName: string, analyzeDate: string, status: string) => void;
  selectedBusinessForChart?: {name: string, code: string} | null;
}) => {
  const [activeTab, setActiveTab] = useState('table');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  const dateFormat = 'YYYY-MM-DD';

  // 处理查看趋势按钮点击
  const handleViewTrend = (businessCode: string, businessName: string) => {
    if (onShowCombinedChart) {
      onShowCombinedChart(businessCode, businessName);
    }
  };

  // 处理查看报警股票按钮点击
  const handleViewAlertStocks = (businessCode: string, businessName: string) => {
    if (onShowAlertStocks) {
      onShowAlertStocks(businessCode, businessName, analyzeDate, status);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 100,
    },
    {
      title: '业务名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      sorter: (a: BusinessStatsData, b: BusinessStatsData) => a.count - b.count,
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (text: any, record: BusinessStatsData) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            onClick={() => handleViewTrend(record.business_code, record.name)}
            loading={isHistoryLoading && selectedBusinessForChart?.code === record.business_code}
          >
            涨跌对比
          </Button>
          <Button 
            type="link" 
            size="small"
            onClick={() => handleViewAlertStocks(record.business_code, record.name)}
            style={{ color: '#52c41a' }}
          >
            报警股票
          </Button>
        </Space>
      ),
    },
  ];

  // 统计数据
  const statistics = (() => {
    if (businessData.length === 0) return null;
    
    const totalCount = businessData.reduce((sum, item) => sum + item.count, 0);
    const top3 = businessData.slice(0, 3);
    
    return {
      totalCount,
      businessCount: businessData.length,
      top1: top3[0],
      top2: top3[1],
      top3: top3[2],
      top3Total: top3.reduce((sum, item) => sum + item.count, 0),
    };
  })();

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: status === 'down' ? '#f6ffed' : '#fff1f0', 
      borderRadius: '8px',
      padding: '16px'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, display: 'inline-block', marginRight: '8px' }}>{title}</h3>
        <Tag color={status === 'up' ? 'red' : 'green'}>{status === 'up' ? '上涨' : '下跌'}</Tag>
      </div>
      
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <DatePicker
          value={moment(analyzeDate, dateFormat)}
          format={dateFormat}
          onChange={(date) => date && onDateChange(date.format(dateFormat))}
          allowClear={false}
          style={{ width: '130px' }}
          size="small"
        />
        <Button type="primary" onClick={onRefresh} loading={isLoading} size="small">
          查询
        </Button>
      </div>

      {statistics && (
        <Row gutter={[8, 8]} style={{ marginBottom: '16px' }}>
          <Col span={12}>
            <Card size="small" bodyStyle={{ padding: '8px' }}>
              <Statistic 
                title="总股票数" 
                value={statistics.totalCount} 
                suffix="只"
                valueStyle={{ fontSize: '12px' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" bodyStyle={{ padding: '8px' }}>
              <Statistic 
                title="板块数" 
                value={statistics.businessCount} 
                suffix="个"
                valueStyle={{ fontSize: '16px' }}
              />
            </Card>
          </Col>
          <Col span={24}>
            <Card size="small" bodyStyle={{ padding: '8px' }}>
              <div style={{ fontSize: '12px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#ff4d4f' }}>🥇</span> {statistics.top1?.name}: {statistics.top1?.count}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#faad14' }}>🥈</span> {statistics.top2?.name}: {statistics.top2?.count}
                </div>
                <div>
                  <span style={{ color: '#52c41a' }}>🥉</span> {statistics.top3?.name}: {statistics.top3?.count}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        size="small"
        style={{ flex: 1 }}
      >
        <TabPane tab="表格" key="table">
          <Spin spinning={isLoading}>
            {businessData.length > 0 ? (
              <Table
                columns={columns}
                dataSource={businessData}
                rowKey={(record) => `${record.end_date}_${record.business_code}`}
                pagination={{
                  pageSize: 50,
                  showSizeChanger: false,
                  size: 'small'
                }}
                scroll={{ y: 1500 }}
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', background: '#f5f5f5', borderRadius: '4px' }}>
                {isLoading ? '加载中...' : '暂无数据'}
              </div>
            )}
          </Spin>
        </TabPane>
        <TabPane tab="图表" key="chart">
          <Spin spinning={isLoading}>
            {!isEmpty(businessData) ? (
              <ReactEcharts
                style={{ height: 450, width: '100%' }}
                notMerge={true}
                lazyUpdate={true}
                option={businessChartOption(businessData, `${analyzeDate}`, chartColor)}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', background: '#f5f5f5', borderRadius: '4px' }}>
                {isLoading ? '加载中...' : '暂无数据'}
              </div>
            )}
          </Spin>
        </TabPane>
      </Tabs>
    </div>
  );
};

export const TopPlatesListComponent = () => {
  const [isLoading1, setIsLoading1] = useState(false);
  const [isLoading2, setIsLoading2] = useState(false);
  const [businessData1, setBusinessData1] = useState<BusinessStatsData[]>([]);
  const [businessData2, setBusinessData2] = useState<BusinessStatsData[]>([]);
  const [analyzeDate1, setAnalyzeDate1] = useState(moment().format('YYYY-MM-DD'));
  const [analyzeDate2, setAnalyzeDate2] = useState(moment().format('YYYY-MM-DD'));

  // 合并图表相关状态
  const [isCombinedModalVisible, setIsCombinedModalVisible] = useState(false);
  const [combinedHistoryData, setCombinedHistoryData] = useState<{
    upData: BusinessHistoryData[];
    downData: BusinessHistoryData[];
  }>({ upData: [], downData: [] });
  const [selectedBusiness, setSelectedBusiness] = useState<{name: string, code: string} | null>(null);
  const [isCombinedLoading, setIsCombinedLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number>(360);

  // 报警股票相关状态
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [alertStockData, setAlertStockData] = useState<AlertStockData[]>([]);
  const [selectedAlertBusiness, setSelectedAlertBusiness] = useState<{name: string, code: string, date: string, status: string} | null>(null);
  const [isAlertLoading, setIsAlertLoading] = useState(false);

  // 天数选项
  const dayOptions = [90, 180, 360, 720];

  // 报警股票表格列定义
  const alertColumns = [
    {
      title: '股票代码',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
      render: (text: string) => (
        <a href={`https://quote.eastmoney.com/${text}.html`} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      ),
    },
    {
      title: '股票名称',
      dataIndex: 'stock_name',
      key: 'stock_name',
      width: 100,
      render: (text: string, record: AlertStockData) => {
        const displayName = text || record.name || '-';
        return <span>{displayName}</span>;
      },
    },
    {
      title: '业务名称',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 80,
      render: (text: string) => {
        if (!text) return '-';
        let color = 'blue';
        let displayText = text;
        
        if (text.includes('400s')) {
          color = 'purple';
          displayText = '400s';
        } else if (text.includes('100w')) {
          color = 'orange';
          displayText = '100w';
        } else if (text.includes('dr_')) {
          color = 'cyan';
          displayText = text.replace('dr_', '');
        }
        
        return <Tag color={color}>{displayText}</Tag>;
      },
    },
    {
      title: '报警日期',
      dataIndex: 'alert_date',
      key: 'alert_date',
      width: 100,
      sorter: (a: AlertStockData, b: AlertStockData) => b.alert_date.localeCompare(a.alert_date),
      defaultSortOrder: 'descend',
    },
    {
      title: '持续BYG',
      dataIndex: 'continuance_BYG',
      key: 'continuance_BYG',
      width: 160,
      render: (text: string) => {
        const parts = text.split('|').map(p => p.trim());
        const percent = parts[0];
        const isPositive = !percent.startsWith('-');
        return (
          <Tag color={isPositive ? 'red' : 'green'}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: '备注',
      dataIndex: 'comments',
      key: 'comments',
      width: 150,
      render: (text: string) => text || '-',
    },
  ];

  // 获取上涨业务统计数据
  const fetchUpBusinessStats = () => {
    setIsLoading1(true);
    
    get(`/api/business_type_summary?analyze_date=${analyzeDate1}&status=up`)
      .then((res: any) => {
        // console.log('上涨数据API返回:', res);
        
        if (Array.isArray(res)) {
          setBusinessData1(res);
          if (res.length === 0) {
            message.info('所选日期没有上涨数据');
          } else {
            message.success(`成功加载上涨数据 ${res.length} 条记录`);
          }
        } else if (res?.code === 200) {
          setBusinessData1(res.data || []);
          if (res.data.length === 0) {
            message.info('所选日期没有上涨数据');
          } else {
            message.success(`成功加载上涨数据 ${res.data.length} 条记录`);
          }
        } else {
          console.error('未知的数据格式:', res);
          message.error('数据格式错误');
          setBusinessData1([]);
        }
      })
      .catch((error) => {
        console.error('获取上涨业务统计数据失败:', error);
        message.error('网络错误，请检查后端服务是否正常运行');
        setBusinessData1([]);
      })
      .finally(() => {
        setIsLoading1(false);
      });
  };

  // 获取下跌业务统计数据
  const fetchDownBusinessStats = () => {
    setIsLoading2(true);
    
    get(`/api/business_type_summary?analyze_date=${analyzeDate2}&status=down`)
      .then((res: any) => {
        // console.log('下跌数据API返回:', res);
        
        if (Array.isArray(res)) {
          setBusinessData2(res);
          if (res.length === 0) {
            message.info('所选日期没有下跌数据');
          } else {
            message.success(`成功加载下跌数据 ${res.length} 条记录`);
          }
        } else if (res?.code === 200) {
          setBusinessData2(res.data || []);
          if (res.data.length === 0) {
            message.info('所选日期没有下跌数据');
          } else {
            message.success(`成功加载下跌数据 ${res.data.length} 条记录`);
          }
        } else {
          console.error('未知的数据格式:', res);
          message.error('数据格式错误');
          setBusinessData2([]);
        }
      })
      .catch((error) => {
        console.error('获取下跌业务统计数据失败:', error);
        message.error('网络错误，请检查后端服务是否正常运行');
        setBusinessData2([]);
      })
      .finally(() => {
        setIsLoading2(false);
      });
  };

  // 获取合并的涨跌历史数据
  const fetchCombinedHistoryData = (businessCode: string, businessName: string) => {
    setIsCombinedLoading(true);
    setSelectedBusiness({ name: businessName, code: businessCode });
    
    const endDate = moment().format('YYYY-MM-DD');
    const startDate = moment().subtract(selectedDays, 'days').format('YYYY-MM-DD');
    
    // 同时获取上涨和下跌数据
    Promise.all([
      get(`/api/business_trend?business_code=${businessCode}&start_date=${startDate}&end_date=${endDate}&status=up`),
      get(`/api/business_trend?business_code=${businessCode}&start_date=${startDate}&end_date=${endDate}&status=down`)
    ])
      .then(([upRes, downRes]) => {
        // console.log('上涨历史数据:', upRes);
        // console.log('下跌历史数据:', downRes);
        
        const processResponse = (res: any): BusinessHistoryData[] => {
          if (Array.isArray(res)) {
            return res;
          } else if (res?.code === 200) {
            return res.data || [];
          }
          return [];
        };
        
        const upData = processResponse(upRes);
        const downData = processResponse(downRes);
        
        setCombinedHistoryData({ upData, downData });
        
        if (upData.length === 0 && downData.length === 0) {
          message.info('该业务没有历史数据');
        } else {
          setIsCombinedModalVisible(true);
        }
      })
      .catch((error) => {
        console.error('获取合并历史数据失败:', error);
        message.error('网络错误，请检查后端服务');
        setCombinedHistoryData({ upData: [], downData: [] });
      })
      .finally(() => {
        setIsCombinedLoading(false);
      });
  };

  // 获取报警股票数据
  const fetchAlertStocks = (businessCode: string, businessName: string, analyzeDate: string, status: string) => {
    setIsAlertLoading(true);
    setSelectedAlertBusiness({ name: businessName, code: businessCode, date: analyzeDate, status });
    
    get(`/api/business_trend_focus_stocks?business_code=${businessCode}`)
      .then((res: any) => {
        // console.log('报警股票数据API返回:', res);
        
        if (Array.isArray(res)) {
          setAlertStockData(res);
          if (res.length === 0) {
            message.info('该业务没有报警股票数据');
          } else {
            setIsAlertModalVisible(true);
          }
        } else if (res?.code === 200) {
          setAlertStockData(res.data || []);
          if (res.data.length === 0) {
            message.info('该业务没有报警股票数据');
          } else {
            setIsAlertModalVisible(true);
          }
        } else {
          console.error('未知的数据格式:', res);
          message.error('获取报警股票数据失败');
          setAlertStockData([]);
        }
      })
      .catch((error) => {
        console.error('获取报警股票数据失败:', error);
        message.error('网络错误，请检查后端服务');
        setAlertStockData([]);
      })
      .finally(() => {
        setIsAlertLoading(false);
      });
  };

  // 处理日期变更
  const handleDateChange1 = (date: string) => {
    setAnalyzeDate1(date);
  };

  const handleDateChange2 = (date: string) => {
    setAnalyzeDate2(date);
  };

  // 组件加载时自动查询
  useEffect(() => {
    fetchUpBusinessStats();
    fetchDownBusinessStats();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        <span style={{ fontWeight: 'bold' }}>趋势周期选择:</span>
        <Select 
          value={selectedDays} 
          onChange={setSelectedDays}
          style={{ width: 120 }}
          size="small"
        >
          {dayOptions.map(day => (
            <Option key={day} value={day}>{day}天</Option>
          ))}
        </Select>
        <span style={{ color: '#666', marginLeft: '10px', fontSize: '12px' }}>（点击"涨跌对比"按钮查看趋势）</span>
      </div>

      <Row gutter={16}>
        <Col span={12}>
          <ContentSection 
            title="上涨板块"
            businessData={businessData1}
            isLoading={isLoading1}
            analyzeDate={analyzeDate1}
            onDateChange={handleDateChange1}
            onRefresh={fetchUpBusinessStats}
            status="up"
            chartColor="#ff4d4f"
            onShowCombinedChart={fetchCombinedHistoryData}
            onShowAlertStocks={fetchAlertStocks}
            selectedBusinessForChart={selectedBusiness}
          />
        </Col>
        
        <Col span={12}>
          <ContentSection 
            title="下跌板块"
            businessData={businessData2}
            isLoading={isLoading2}
            analyzeDate={analyzeDate2}
            onDateChange={handleDateChange2}
            onRefresh={fetchDownBusinessStats}
            status="down"
            chartColor="#52c41a"
            onShowCombinedChart={fetchCombinedHistoryData}
            onShowAlertStocks={fetchAlertStocks}
            selectedBusinessForChart={selectedBusiness}
          />
        </Col>
      </Row>

      {/* 合并历史趋势弹窗 */}
      <Modal
        title={null}
        visible={isCombinedModalVisible}
        onCancel={() => setIsCombinedModalVisible(false)}
        footer={[
          <Space key="footer" size="middle">
            <span style={{ color: '#666' }}>
              当前周期: {selectedDays}天 | 
              上涨数据: {combinedHistoryData.upData.length}条 | 
              下跌数据: {combinedHistoryData.downData.length}条
            </span>
            <Button key="close" type="primary" onClick={() => setIsCombinedModalVisible(false)} size="large">
              关闭
            </Button>
          </Space>
        ]}
        width={1500}
        style={{ top: 20 }}
        bodyStyle={{ height: 750, padding: '20px 20px 10px 20px' }}
      >
        <Spin spinning={isCombinedLoading}>
          {!isEmpty(combinedHistoryData.upData) || !isEmpty(combinedHistoryData.downData) ? (
            <div style={{ height: '100%', width: '100%' }}>
              <ReactEcharts
                style={{ height: 670, width: '100%' }}
                notMerge={true}
                lazyUpdate={true}
                option={combinedHistoryChartOption(
                  combinedHistoryData.upData, 
                  combinedHistoryData.downData, 
                  selectedBusiness?.name || '', 
                  selectedDays
                )}
                opts={{ renderer: 'canvas' }}
              />
              <div style={{ textAlign: 'center', marginTop: '10px', color: '#999', fontSize: '12px' }}>
                红色线: 上涨股票数 | 绿色线: 下跌股票数 | 可拖动下方滑块查看特定时间段
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '100px' }}>
              暂无历史数据
            </div>
          )}
        </Spin>
      </Modal>

      {/* 报警股票列表弹窗 */}
      <Modal
        title={
          <div>
            <span>报警股票列表 - {selectedAlertBusiness?.name}</span>
            <Tag color={selectedAlertBusiness?.status === 'up' ? 'red' : 'green'} style={{ marginLeft: '10px' }}>
              {selectedAlertBusiness?.status === 'up' ? '上涨' : '下跌'}
            </Tag>
            <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
              {selectedAlertBusiness?.date}
            </span>
          </div>
        }
        visible={isAlertModalVisible}
        onCancel={() => setIsAlertModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsAlertModalVisible(false)} size="large">
            关闭
          </Button>
        ]}
        width={1400}
        style={{ top: 20 }}
        bodyStyle={{ height: 600, padding: '20px' }}
      >
        <Spin spinning={isAlertLoading}>
          {alertStockData.length > 0 ? (
            <Table
              columns={alertColumns}
              dataSource={alertStockData}
              rowKey={(record) => `${record.symbol}_${record.alert_date}`}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              scroll={{ x: 'max-content', y: 450 }}
              size="small"
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '100px' }}>
              暂无报警股票数据
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};