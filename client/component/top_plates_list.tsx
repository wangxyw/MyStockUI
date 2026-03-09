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
  Tag  // 添加 Tag 导入
} from 'antd';
import moment from 'moment';
import { get } from '../lib/request';
import ReactEcharts from 'echarts-for-react';
import { groupBy, isEmpty } from 'lodash';
import './alarm.css';

const { TabPane } = Tabs;

// 定义数据类型
interface BusinessStatsData {
  end_date: string;
  business_code: string;
  name: string;
  count: number;
}

// 图表配置函数
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
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: '数量',
    },
    yAxis: {
      type: 'category',
      data: codes.map(code => {
        const item = groupedByCode[code][0];
        return item.name;
      }),
      axisLabel: { interval: 0 },
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
        },
      },
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
  chartColor = '#1890ff'
}: { 
  title: string;
  businessData: BusinessStatsData[];
  isLoading: boolean;
  analyzeDate: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  status?: string;
  chartColor?: string;
}) => {
  const [activeTab, setActiveTab] = useState('table');
  const dateFormat = 'YYYY-MM-DD';

  // 表格列定义
  const columns = [
    {
      title: '日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
    },
    // {
    //   title: '业务代码',
    //   dataIndex: 'business_code',
    //   key: 'business_code',
    //   width: 150,
    // },
    {
      title: '业务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      sorter: (a: BusinessStatsData, b: BusinessStatsData) => a.count - b.count,
      defaultSortOrder: 'descend',
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
    <div style={{ marginBottom: '40px', padding: '20px', background: status === 'down' ? '#fff1f0' : '#f6ffed', borderRadius: '8px' }}>
      <h3>{title} <Tag color={status === 'up' ? 'green' : 'red'}>{status === 'up' ? '上涨' : '下跌'}</Tag></h3>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
        <DatePicker
          value={moment(analyzeDate, dateFormat)}
          format={dateFormat}
          onChange={(date) => date && onDateChange(date.format(dateFormat))}
          allowClear={false}
          style={{ marginRight: '10px', width: '150px' }}
        />
        <Button type="primary" onClick={onRefresh} loading={isLoading}>
          查询
        </Button>
      </div>

      {statistics && (
        <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic 
                title="总股票数" 
                value={statistics.totalCount} 
                suffix="只"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic 
                title="业务板块数" 
                value={statistics.businessCount} 
                suffix="个"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic 
                title="前三名合计" 
                value={statistics.top3Total} 
                suffix={`/ ${((statistics.top3Total / statistics.totalCount) * 100).toFixed(1)}%`}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" bodyStyle={{ padding: '12px' }}>
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

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="表格视图" key="table">
          <Spin spinning={isLoading}>
            {businessData.length > 0 ? (
              <Table
                columns={columns}
                dataSource={businessData}
                rowKey={(record) => `${record.end_date}_${record.business_code}`}
                pagination={{
                  pageSize: 50,
                  showSizeChanger: false,
                  pageSizeOptions: ['10', '20', '50'],
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
                scroll={{ x: 'max-content', y: 500 }}
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px', background: '#f5f5f5', borderRadius: '4px' }}>
                {isLoading ? '加载中...' : '暂无数据，请点击查询按钮'}
              </div>
            )}
          </Spin>
        </TabPane>
        <TabPane tab="图表视图" key="chart">
          <Spin spinning={isLoading}>
            {!isEmpty(businessData) ? (
              <ReactEcharts
                style={{ height: 500, width: '100%' }}
                notMerge={true}
                lazyUpdate={true}
                option={businessChartOption(businessData, `${analyzeDate} ${status === 'up' ? '上涨' : '下跌'}业务分布统计`, chartColor)}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px', background: '#f5f5f5', borderRadius: '4px' }}>
                {isLoading ? '加载中...' : '暂无数据，请点击查询按钮'}
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

  // 获取上涨业务统计数据
  const fetchUpBusinessStats = () => {
    setIsLoading1(true);
    
    get(`/api/business_type_summary?analyze_date=${analyzeDate1}&status=up`)
      .then((res: any) => {
        console.log('上涨数据API返回:', res);
        
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
        console.log('下跌数据API返回:', res);
        
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
      <ContentSection 
        title="业务板块统计 - 第一部分"
        businessData={businessData1}
        isLoading={isLoading1}
        analyzeDate={analyzeDate1}
        onDateChange={handleDateChange1}
        onRefresh={fetchUpBusinessStats}
        status="up"
        chartColor="#1890ff"
      />
      
      <div style={{ margin: '40px 0', borderTop: '2px dashed #ccc' }}></div>
      
      <ContentSection 
        title="业务板块统计 - 第二部分"
        businessData={businessData2}
        isLoading={isLoading2}
        analyzeDate={analyzeDate2}
        onDateChange={handleDateChange2}
        onRefresh={fetchDownBusinessStats}
        status="down"
        chartColor="#ff4d4f"
      />
    </div>
  );
};