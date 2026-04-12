import React, { useState, useCallback, useEffect } from 'react';
import { Button, DatePicker, Select, Space, Card, Row, Col, Spin, message, Statistic, Divider } from 'antd';
import { LineChartOutlined, ReloadOutlined, RobotOutlined } from '@ant-design/icons';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';

interface TrendData {
  datestr: string;
  count: number;
}

interface AllTrendsData {
  '400s_up': TrendData[];
  '400s_down': TrendData[];
  '100w_up': TrendData[];
  '100w_down': TrendData[];
}

interface AiFocusData {
  datestr: string;
  symbol_count: number;
}

const SimpleAlarmTrend: React.FC = () => {
  const [days, setDays] = useState<number>(120);
  const [daysTill, setDaysTill] = useState<string>(moment().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState<boolean>(false);
  const [trendData, setTrendData] = useState<AllTrendsData | null>(null);
  
  // AI Focus Stocks 数据状态
  const [aiFocusData, setAiFocusData] = useState<AiFocusData[]>([]);
  const [aiFocusLoading, setAiFocusLoading] = useState<boolean>(false);

  // 天数选项
  const daysOptions = [
    { value: 30, label: '30天' },
    { value: 60, label: '60天' },
    { value: 90, label: '90天' },
    { value: 120, label: '120天' },
    { value: 150, label: '150天' },
    { value: 180, label: '180天' },
    { value: 360, label: '360天' }
  ];

  // 获取趋势数据
  const fetchTrendData = useCallback(async () => {
    if (!days || !daysTill) {
      message.warning('请填写完整参数');
      return;
    }

    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        days: days.toString(),
        daysTill: daysTill
      }).toString();
      
      const url = `/api/alarm_trends?${queryParams}`;
      console.log('Fetching data from:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Received data:', data);
      
      if (response.ok && data) {
        setTrendData(data);
        message.success('数据加载成功');
      } else {
        message.error(data?.error || '数据加载失败');
      }
    } catch (error) {
      console.error('Failed to fetch trend data:', error);
      message.error('数据加载失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [days, daysTill]);

  // 获取 AI Focus Stocks 数据（独立，不需要参数）
  const fetchAiFocusData = useCallback(async () => {
    setAiFocusLoading(true);
    try {
      const response = await fetch('/api/ai_focus_stocks_trend');
      const data = await response.json();
      
      console.log('AI Focus data:', data);
      
      if (response.ok && data) {
        setAiFocusData(data);
      } else {
        console.error('AI Focus data fetch failed:', data);
      }
    } catch (error) {
      console.error('Failed to fetch AI Focus data:', error);
    } finally {
      setAiFocusLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchTrendData();
    fetchAiFocusData();
  }, []);

  // 生成图表配置 - AI Focus Stocks
  const getAiFocusChartOption = (data: AiFocusData[], showValues: boolean = true) => {
    if (!data || data.length === 0) return null;
    
    // 按日期升序排列
    const sortedData = [...data].sort((a, b) => a.datestr.localeCompare(b.datestr));
    const dates = sortedData.map(item => item.datestr);
    const counts = sortedData.map(item => item.symbol_count);
    
    const dataCount = dates.length;
    const isLargeDataset = dataCount > 80;
    
    return {
      title: {
        text: 'AI Focus Stocks 趋势',
        left: 'center',
        top: 0,
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          return `<strong>${params[0].axisValue}</strong><br/>股票数量: ${params[0].value}`;
        }
      },
      legend: {
        data: ['AI Focus Stock Count'],
        top: 25,
        left: 'center'
      },
      grid: {
        top: 70,
        bottom: 30,
        left: 50,
        right: 50,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: isLargeDataset ? 45 : 0,
          interval: isLargeDataset ? Math.floor(dataCount / 15) : 0,
          fontSize: isLargeDataset ? 10 : 11
        }
      },
      yAxis: {
        type: 'value',
        name: '股票数量',
        nameLocation: 'middle',
        nameGap: 40
      },
      series: [
        {
          name: 'AI Focus Stock Count',
          type: 'line',
          data: counts,
          lineStyle: {
            color: '#1890ff',
            width: 2
          },
          itemStyle: {
            color: '#1890ff',
            borderRadius: 10
          },
          symbol: 'circle',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: dataCount <= 60,
          areaStyle: {
            opacity: 0.2,
            color: '#1890ff'
          },
          label: {
            show: showValues && !isLargeDataset,
            position: 'top',
            formatter: '{c}',
            fontSize: 10
          },
          connectNulls: true,
        },
      ],
      dataZoom: dataCount > 50 ? [
        {
          type: 'slider',
          start: 0,
          end: 100,
          bottom: 0,
          height: 20,
        },
        // 注释掉 inside 类型即可禁用鼠标滚轮
        // {
        //   type: 'inside',
        //   start: 0,
        //   end: 100,
        // }
      ] : [],
    };
  };

  // 生成图表配置
  const getChartOption = (upData: TrendData[], downData: TrendData[], title: string, colorUp: string, colorDown: string) => {
    const dates = upData?.map(item => item.datestr) || [];
    const upCounts = upData?.map(item => item.count) || [];
    const downCounts = downData?.map(item => item.count) || [];
    const diffCounts = dates.map((date, index) => {
      const upCount = upCounts[index] || 0;
      const downCount = downCounts[index] || 0;
      return upCount - downCount;
    });

    const dataCount = dates.length;
    const isLargeDataset = dataCount > 80;

    return {
      title: {
        text: title,
        left: 'center',
        top: 0,
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params: any) {
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => {
            result += `${p.marker} ${p.seriesName}: ${p.value}<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: ['上涨数量', '下跌数量', '净差值（涨-跌）'],
        top: 25,
        left: 'center'
      },
      grid: {
        top: 70,
        bottom: 30,
        left: 50,
        right: 50,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: 45,
          interval: isLargeDataset ? Math.floor(dataCount / 15) : 0,
          fontSize: isLargeDataset ? 10 : 11
        }
      },
      yAxis: {
        type: 'value',
        name: '数量 / 差值',
        nameLocation: 'middle',
        nameGap: 40
      },
      series: [
        {
          name: '上涨数量',
          type: 'line',
          data: upCounts,
          lineStyle: {
            color: colorUp,
            width: 2
          },
          itemStyle: {
            color: colorUp,
            borderRadius: 10
          },
          symbol: 'circle',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: dataCount <= 60,
          areaStyle: {
            opacity: 0.1,
            color: colorUp
          },
          label: {
            show: !isLargeDataset && upCounts.length <= 30,
            position: 'top',
            formatter: '{c}',
            fontSize: 10
          }
        },
        {
          name: '下跌数量',
          type: 'line',
          data: downCounts,
          lineStyle: {
            color: colorDown,
            width: 2
          },
          itemStyle: {
            color: colorDown,
            borderRadius: 10
          },
          symbol: 'diamond',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: dataCount <= 60,
          areaStyle: {
            opacity: 0.1,
            color: colorDown
          },
          label: {
            show: !isLargeDataset && downCounts.length <= 30,
            position: 'bottom',
            formatter: '{c}',
            fontSize: 10
          }
        },
        {
          name: '净差值（涨-跌）',
          type: 'line',
          data: diffCounts,
          lineStyle: {
            color: '#faad14',
            width: 2,
            type: 'dashed'
          },
          itemStyle: {
            color: '#faad14'
          },
          symbol: 'triangle',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: dataCount <= 60,
          label: {
            show: !isLargeDataset && diffCounts.length <= 30,
            position: 'right',
            formatter: '{c}',
            fontSize: 10
          }
        }
      ],
      dataZoom: dataCount > 50 ? [
        {
          type: 'slider',
          start: 0,
          end: 100,
          bottom: 0,
          height: 20,
        },
        // 注释掉 inside 类型即可禁用鼠标滚轮
        // {
        //   type: 'inside',
        //   start: 0,
        //   end: 100,
        // }
      ] : [],
    };
  };

  // 计算统计数据
  const getStatistics = (data: TrendData[]) => {
    if (!data || data.length === 0) return { avg: 0, max: 0, total: 0 };
    const counts = data.map(item => item.count);
    return {
      avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      max: Math.max(...counts),
      total: counts.reduce((a, b) => a + b, 0)
    };
  };

  // 计算 AI Focus 统计数据
  const getAiFocusStatistics = () => {
    if (!aiFocusData || aiFocusData.length === 0) return { avg: 0, max: 0, total: 0, latest: 0 };
    const counts = aiFocusData.map(item => item.symbol_count);
    return {
      avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      max: Math.max(...counts),
      total: counts.reduce((a, b) => a + b, 0),
      latest: counts[counts.length - 1] || 0
    };
  };

  const aiFocusStats = getAiFocusStatistics();

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Card 
        title="股票预警趋势分析" 
        bordered={false}
        extra={
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={fetchTrendData}
            loading={loading}
          >
            刷新数据
          </Button>
        }
      >
        <Space size="large" wrap>
          <div>
            <span style={{ marginRight: 8 }}>统计天数：</span>
            <Select
              style={{ width: 120 }}
              value={days}
              onChange={(value) => setDays(value)}
              options={daysOptions}
              size="middle"
            />
            <span style={{ marginLeft: 8, color: '#999' }}>天</span>
          </div>
          
          <div>
            <span style={{ marginRight: 8 }}>截止日期：</span>
            <DatePicker
              value={moment(daysTill)}
              onChange={(date) => setDaysTill(date?.format('YYYY-MM-DD') || moment().format('YYYY-MM-DD'))}
              format="YYYY-MM-DD"
              style={{ width: 150 }}
            />
          </div>
          
          <Button 
            type="primary" 
            icon={<LineChartOutlined />}
            onClick={fetchTrendData}
            loading={loading}
          >
            开始分析
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading || aiFocusLoading} tip="正在加载数据...">
        {/* AI Focus Stocks 趋势图 */}
        {aiFocusData && aiFocusData.length > 0 && (
          <Card 
            title={
              <span>
                <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                AI Focus Stocks 趋势
              </span>
            }
            style={{ marginTop: 20 }}
            extra={
              <Space>
                <Statistic 
                  title="最新数量" 
                  value={aiFocusStats.latest} 
                  suffix="只"
                  valueStyle={{ color: '#1890ff', fontSize: 14 }}
                />
                <Statistic 
                  title="平均数量" 
                  value={aiFocusStats.avg} 
                  suffix="只"
                  valueStyle={{ fontSize: 14 }}
                />
                <Statistic 
                  title="最大数量" 
                  value={aiFocusStats.max} 
                  suffix="只"
                  valueStyle={{ color: '#52c41a', fontSize: 14 }}
                />
              </Space>
            }
          >
            <ReactEcharts
              option={getAiFocusChartOption(aiFocusData, true)}
              style={{ height: 400 }}
              opts={{ renderer: 'canvas' }}
            />
          </Card>
        )}

        {/* 如果没有 AI Focus 数据，显示提示 */}
        {(!aiFocusData || aiFocusData.length === 0) && !aiFocusLoading && (
          <Card style={{ marginTop: 20, textAlign: 'center', padding: 30 }}>
            <RobotOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <div style={{ marginTop: 16, color: '#999' }}>
              暂无 AI Focus Stocks 数据
            </div>
          </Card>
        )}

        <Divider />

        {/* 原有的趋势图 */}
        {trendData && (
          <>
            {/* 400s 趋势图 */}
            <Card 
              title="400s 股票趋势" 
              style={{ marginTop: 20 }}
              extra={
                <Space>
                  <Statistic 
                    title="平均上涨" 
                    value={getStatistics(trendData['400s_up']).avg} 
                    suffix="只"
                    valueStyle={{ color: '#ff4d4f', fontSize: 14 }}
                  />
                  <Statistic 
                    title="平均下跌" 
                    value={getStatistics(trendData['400s_down']).avg} 
                    suffix="只"
                    valueStyle={{ color: '#52c41a', fontSize: 14 }}
                  />
                </Space>
              }
            >
              <ReactEcharts
                option={getChartOption(
                  trendData['400s_up'],
                  trendData['400s_down'],
                  '400s 涨跌趋势对比',
                  '#ff4d4f',
                  '#52c41a'
                )}
                style={{ height: 450 }}
                opts={{ renderer: 'canvas' }}
              />
            </Card>

            {/* 100w 趋势图 */}
            <Card 
              title="100w 股票趋势" 
              style={{ marginTop: 20 }}
              extra={
                <Space>
                  <Statistic 
                    title="平均上涨" 
                    value={getStatistics(trendData['100w_up']).avg} 
                    suffix="只"
                    valueStyle={{ color: '#ff4d4f', fontSize: 14 }}
                  />
                  <Statistic 
                    title="平均下跌" 
                    value={getStatistics(trendData['100w_down']).avg} 
                    suffix="只"
                    valueStyle={{ color: '#52c41a', fontSize: 14 }}
                  />
                </Space>
              }
            >
              <ReactEcharts
                option={getChartOption(
                  trendData['100w_up'],
                  trendData['100w_down'],
                  '100w 涨跌趋势对比',
                  '#ff4d4f',
                  '#52c41a'
                )}
                style={{ height: 450 }}
                opts={{ renderer: 'canvas' }}
              />
            </Card>

            {/* 对比分析卡片 */}
            <Row gutter={16} style={{ marginTop: 20 }}>
              <Col span={12}>
                <Card title="400s 市场情绪">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: trendData['400s_up'].reduce((a, b, idx) => 
                      a + (b.count - (trendData['400s_down'][idx]?.count || 0)), 0) >= 0 ? '#ff4d4f' : '#52c41a' 
                    }}>
                      {trendData['400s_up'].reduce((a, b, idx) => 
                        a + (b.count - (trendData['400s_down'][idx]?.count || 0)), 0) >= 0 ? '偏乐观' : '偏悲观'
                      }
                    </div>
                    <div style={{ marginTop: 10 }}>
                      总净差值: {trendData['400s_up'].reduce((a, b, idx) => 
                        a + (b.count - (trendData['400s_down'][idx]?.count || 0)), 0)
                      }
                    </div>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="100w 市场情绪">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: trendData['100w_up'].reduce((a, b, idx) => 
                      a + (b.count - (trendData['100w_down'][idx]?.count || 0)), 0) >= 0 ? '#ff4d4f' : '#52c41a' 
                    }}>
                      {trendData['100w_up'].reduce((a, b, idx) => 
                        a + (b.count - (trendData['100w_down'][idx]?.count || 0)), 0) >= 0 ? '偏乐观' : '偏悲观'
                      }
                    </div>
                    <div style={{ marginTop: 10 }}>
                      总净差值: {trendData['100w_up'].reduce((a, b, idx) => 
                        a + (b.count - (trendData['100w_down'][idx]?.count || 0)), 0)
                      }
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}

        {!trendData && !loading && !aiFocusData.length && (
          <Card style={{ marginTop: 20, textAlign: 'center', padding: 50 }}>
            <LineChartOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <div style={{ marginTop: 16, color: '#999' }}>
              请选择参数并点击"开始分析"查看趋势图
            </div>
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default SimpleAlarmTrend;