import React, { useState, useCallback, useEffect } from 'react';
import { Button, DatePicker, Select, Space, Card, Row, Col, Spin, message, Statistic, Divider, Tabs, Table, Tag, Tooltip, Modal, List, Badge, Empty } from 'antd';
import { 
  LineChartOutlined, 
  BarChartOutlined, 
  HistoryOutlined,
  RiseOutlined,
  FallOutlined,
  EyeOutlined,
  CalendarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// 类型定义
interface BoardScore {
  board: string;
  total_score: number;
  article_count: number;
  avg_score: number;
}

interface DailyData {
  date: string;
  boards: BoardScore[];
  total_score: number;
  total_articles: number;
}

interface TrendData {
  date: string;
  score: number;
  count: number;
}

interface Article {
  article_id: string;
  title: string;
  score: number;
  publish_time: string;
}

const BoardHistory: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [rangeData, setRangeData] = useState<DailyData[]>([]);
  const [trendData, setTrendData] = useState<Record<string, TrendData[]>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  
  // 文章详情弹窗
  const [articlesModalVisible, setArticlesModalVisible] = useState<boolean>(false);
  const [currentBoard, setCurrentBoard] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState<boolean>(false);
  
  // 查询参数
  const [queryType, setQueryType] = useState<string>('single');
  const [selectedDate, setSelectedDate] = useState<string>(moment().format('YYYY-MM-DD'));
  const [dateRange, setDateRange] = useState<[string, string]>([
    moment().subtract(7, 'days').format('YYYY-MM-DD'),
    moment().format('YYYY-MM-DD')
  ]);
  const [selectedBoard, setSelectedBoard] = useState<string>('AI算力');

  // 获取所有可用日期
  const fetchAvailableDates = useCallback(async () => {
    try {
      const response = await fetch('/api/board/available_dates');
      const data = await response.json();
      if (response.ok) {
        setAvailableDates(data.dates || []);
      }
    } catch (error) {
      console.error('Failed to fetch available dates:', error);
    }
  }, []);

  // 获取单日数据
  const fetchSingleDayData = useCallback(async () => {
    if (!selectedDate) {
      message.warning('请选择日期');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/board/daily?date=${selectedDate}`);
      const data = await response.json();
      
      if (response.ok && data) {
        setDailyData(data);
        message.success(`成功加载 ${selectedDate} 的数据`);
      } else {
        message.error(data?.error || '数据加载失败');
        setDailyData(null);
      }
    } catch (error) {
      console.error('Failed to fetch daily data:', error);
      message.error('数据加载失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // 获取日期范围数据
  const fetchRangeData = useCallback(async () => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('请选择日期范围');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/board/range?start=${dateRange[0]}&end=${dateRange[1]}`);
      const data = await response.json();
      
      if (response.ok && data) {
        setRangeData(data.daily_data || []);
        message.success(`成功加载 ${data.daily_data?.length || 0} 天的数据`);
      } else {
        message.error(data?.error || '数据加载失败');
        setRangeData([]);
      }
    } catch (error) {
      console.error('Failed to fetch range data:', error);
      message.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // 获取板块趋势
  const fetchBoardTrend = useCallback(async () => {
    if (!selectedBoard) {
      message.warning('请选择板块');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/board/trend?board=${encodeURIComponent(selectedBoard)}&days=30`);
      const data = await response.json();
      
      if (response.ok && data) {
        setTrendData(prev => ({ ...prev, [selectedBoard]: data.trend || [] }));
        message.success(`成功加载 ${selectedBoard} 的趋势数据`);
      } else {
        message.error(data?.error || '数据加载失败');
      }
    } catch (error) {
      console.error('Failed to fetch trend data:', error);
      message.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [selectedBoard]);

  // 获取板块文章详情
  const fetchBoardArticles = async (date: string, board: string) => {
    console.log('Fetching articles for:', { date, board });
    
    if (!date || !board) {
      message.error('日期或板块信息无效');
      return;
    }
    
    setArticlesModalVisible(true);
    setCurrentBoard(board);
    setCurrentDate(date);
    setArticlesLoading(true);
    setArticles([]);
    
    try {
      const response = await fetch(`/api/board/articles?date=${date}&board=${encodeURIComponent(board)}`);
      const data = await response.json();
      console.log('API response:', data);
      
      if (response.ok && data) {
        setArticles(data.articles || []);
        if (data.articles?.length === 0) {
          message.info(`暂无 ${board} 板块的文章详情`);
        } else {
          message.success(`获取到 ${data.articles.length} 篇文章`);
        }
      } else {
        message.error(data?.error || '获取文章详情失败');
        setArticles([]);
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      message.error('获取文章详情失败');
      setArticles([]);
    } finally {
      setArticlesLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchAvailableDates();
    fetchSingleDayData();
  }, []);

  // 单日查询表格列定义
  const boardColumnsWithDetail = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => {
        const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        const color = index < 3 ? medalColors[index] : '#999';
        return (
          <span style={{ fontWeight: 600, color }}>
            {index + 1}
          </span>
        );
      },
    },
    {
      title: '板块',
      dataIndex: 'board',
      key: 'board',
      width: 120,
      render: (board: string) => (
        <Tag color="blue" style={{ fontSize: 14, fontWeight: 500 }}>
          {board}
        </Tag>
      ),
    },
    {
      title: '综合得分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 120,
      sorter: (a: BoardScore, b: BoardScore) => a.total_score - b.total_score,
      render: (score: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          {score.toFixed(2)}
        </span>
      ),
    },
    {
      title: '文章数量',
      dataIndex: 'article_count',
      key: 'article_count',
      width: 100,
      render: (count: number) => `${count} 篇`,
    },
    {
      title: '平均得分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      width: 100,
      render: (score: number) => score.toFixed(2),
    },
    {
      title: '热度',
      key: 'heat',
      width: 150,
      render: (_: any, record: BoardScore) => {
        const heatLevel = Math.min(Math.floor(record.total_score / 20) + 1, 5);
        const stars = '⭐'.repeat(heatLevel);
        return <Tooltip title={`热度等级 ${heatLevel}/5`}>{stars}</Tooltip>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: BoardScore) => (
        <Button 
          type="link" 
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => {
            if (dailyData?.date) {
              fetchBoardArticles(dailyData.date, record.board);
            } else {
              message.error('无法获取当前日期');
            }
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  // 范围查询表格列定义
  const getRangeBoardColumns = (date: string) => [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => {
        const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        const color = index < 3 ? medalColors[index] : '#999';
        return (
          <span style={{ fontWeight: 600, color }}>
            {index + 1}
          </span>
        );
      },
    },
    {
      title: '板块',
      dataIndex: 'board',
      key: 'board',
      width: 120,
      render: (board: string) => (
        <Tag color="blue" style={{ fontSize: 14, fontWeight: 500 }}>
          {board}
        </Tag>
      ),
    },
    {
      title: '综合得分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 120,
      render: (score: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          {score.toFixed(2)}
        </span>
      ),
    },
    {
      title: '文章数量',
      dataIndex: 'article_count',
      key: 'article_count',
      width: 100,
      render: (count: number) => `${count} 篇`,
    },
    {
      title: '平均得分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      width: 100,
      render: (score: number) => score.toFixed(2),
    },
    {
      title: '热度',
      key: 'heat',
      width: 150,
      render: (_: any, record: BoardScore) => {
        const heatLevel = Math.min(Math.floor(record.total_score / 20) + 1, 5);
        const stars = '⭐'.repeat(heatLevel);
        return <Tooltip title={`热度等级 ${heatLevel}/5`}>{stars}</Tooltip>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: BoardScore) => (
        <Button 
          type="link" 
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => fetchBoardArticles(date, record.board)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  // 趋势表格列定义（简化版，移除有问题的趋势列）
  const trendColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
    },
    {
      title: '综合得分',
      dataIndex: 'score',
      key: 'score',
      width: 120,
      render: (score: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          {score?.toFixed(2) || '0.00'}
        </span>
      ),
    },
    {
      title: '文章数量',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (count: number) => `${count || 0} 篇`,
    },
  ];

  // 生成单日图表配置
  const getDailyChartOption = (data: DailyData) => {
    if (!data || !data.boards) return null;
    
    const boards = data.boards.slice(0, 10);
    const scores = boards.map(b => b.total_score);
    const names = boards.map(b => b.board);
    
    return {
      title: {
        text: `${data.date} 板块热度分布`,
        left: 'center',
        top: 0,
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          return `${params[0].name}<br/>得分: ${params[0].value.toFixed(2)}`;
        }
      },
      grid: {
        top: 50,
        bottom: 30,
        left: 80,
        right: 30,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: { rotate: 45, fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        name: '得分',
        nameLocation: 'middle',
        nameGap: 45
      },
      series: [
        {
          name: '得分',
          type: 'bar',
          data: scores,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#1890ff' },
                { offset: 1, color: '#69c0ff' }
              ]
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            fontSize: 11
          }
        }
      ]
    };
  };

  // 生成趋势图表配置
  const getTrendChartOption = (board: string, trend: TrendData[]) => {
    if (!trend || trend.length === 0) return null;
    
    const dates = trend.map(t => t.date);
    const scores = trend.map(t => t.score);
    const counts = trend.map(t => t.count);
    
    const isLargeDataset = dates.length > 60;
    
    return {
      title: {
        text: `${board} 板块趋势分析`,
        left: 'center',
        top: 0,
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: {
        data: ['综合得分', '文章数量'],
        top: 30,
        left: 'center'
      },
      grid: {
        top: 80,
        bottom: 40,
        left: 60,
        right: 60,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: 45,
          interval: isLargeDataset ? Math.floor(dates.length / 15) : 0,
          fontSize: isLargeDataset ? 10 : 11
        }
      },
      yAxis: [
        {
          type: 'value',
          name: '综合得分',
          nameLocation: 'middle',
          nameGap: 45
        },
        {
          type: 'value',
          name: '文章数量',
          nameLocation: 'middle',
          nameGap: 45
        }
      ],
      series: [
        {
          name: '综合得分',
          type: 'line',
          data: scores,
          lineStyle: { color: '#1890ff', width: 2 },
          symbol: 'circle',
          symbolSize: isLargeDataset ? 4 : 6,
          smooth: !isLargeDataset,
          areaStyle: { opacity: 0.2, color: '#1890ff' },
          yAxisIndex: 0
        },
        {
          name: '文章数量',
          type: 'bar',
          data: counts,
          itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
          yAxisIndex: 1,
          barWidth: isLargeDataset ? '40%' : '60%'
        }
      ],
      dataZoom: dates.length > 50 ? [
        { type: 'slider', start: 0, end: 100, bottom: 0, height: 20 }
      ] : []
    };
  };

  // 生成热力图矩阵配置
  const getHeatmapOption = (data: DailyData[]) => {
    if (!data || data.length === 0) return null;
    
    const allBoards = new Set<string>();
    data.forEach(day => {
      day.boards.forEach(board => allBoards.add(board.board));
    });
    
    const boards = Array.from(allBoards).slice(0, 15);
    const dates = data.map(d => d.date);
    
    const matrixData: number[][] = [];
    boards.forEach(board => {
      const row: number[] = [];
      dates.forEach(date => {
        const dayData = data.find(d => d.date === date);
        const boardData = dayData?.boards.find(b => b.board === board);
        row.push(boardData?.total_score || 0);
      });
      matrixData.push(row);
    });
    
    return {
      title: {
        text: '板块热度矩阵',
        left: 'center',
        top: 0,
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `${params.value[1]}<br/>${params.value[0]}: ${params.value[2].toFixed(2)}分`;
        }
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { rotate: 45, fontSize: 10 }
      },
      yAxis: {
        type: 'category',
        data: boards,
        axisLabel: { fontSize: 11 }
      },
      visualMap: {
        min: 0,
        max: Math.max(...matrixData.flat()),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#e6f7ff', '#69c0ff', '#1890ff', '#0050b3']
        }
      },
      series: [
        {
          name: '得分',
          type: 'heatmap',
          data: matrixData.flatMap((row, i) => 
            row.map((value, j) => [j, i, value])
          ),
          label: {
            show: data.length <= 10 && boards.length <= 10,
            formatter: (params: any) => params.data[2].toFixed(0)
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 查询面板 */}
      <Card 
        title={
          <span>
            <HistoryOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            板块历史数据查询
          </span>
        }
        bordered={false}
      >
        <Tabs activeKey={queryType} onChange={setQueryType} type="card">
          <TabPane tab="单日查询" key="single">
            <Space size="large" wrap>
              <div>
                <span style={{ marginRight: 8 }}>选择日期：</span>
                <DatePicker
                  value={moment(selectedDate)}
                  onChange={(date) => setSelectedDate(date?.format('YYYY-MM-DD') || moment().format('YYYY-MM-DD'))}
                  format="YYYY-MM-DD"
                  style={{ width: 150 }}
                  disabledDate={(current) => {
                    return current && current > moment().endOf('day');
                  }}
                />
              </div>
              <Button 
                type="primary" 
                icon={<EyeOutlined />}
                onClick={fetchSingleDayData}
                loading={loading}
              >
                查询
              </Button>
            </Space>
          </TabPane>
          
          <TabPane tab="日期范围" key="range">
            <Space size="large" wrap>
              <div>
                <span style={{ marginRight: 8 }}>日期范围：</span>
                <RangePicker
                  value={[moment(dateRange[0]), moment(dateRange[1])]}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setDateRange([
                        dates[0].format('YYYY-MM-DD'),
                        dates[1].format('YYYY-MM-DD')
                      ]);
                    }
                  }}
                  style={{ width: 260 }}
                />
              </div>
              <Button 
                type="primary" 
                icon={<BarChartOutlined />}
                onClick={fetchRangeData}
                loading={loading}
              >
                分析范围
              </Button>
            </Space>
          </TabPane>
          
          <TabPane tab="板块趋势" key="trend">
            <Space size="large" wrap>
              <div>
                <span style={{ marginRight: 8 }}>选择板块：</span>
                <Select
                  style={{ width: 120 }}
                  value={selectedBoard}
                  onChange={setSelectedBoard}
                  options={[
                    { value: 'AI算力', label: 'AI算力' },
                    { value: '银行', label: '银行' },
                    { value: '券商', label: '券商' },
                    { value: '新能源', label: '新能源' },
                    { value: '半导体', label: '半导体' },
                    { value: '消费', label: '消费' },
                    { value: '创新药', label: '创新药' },
                    { value: '房地产', label: '房地产' },
                    { value: '黄金', label: '黄金' },
                  ]}
                />
              </div>
              <Button 
                type="primary" 
                icon={<LineChartOutlined />}
                onClick={fetchBoardTrend}
                loading={loading}
              >
                查看趋势
              </Button>
            </Space>
          </TabPane>
        </Tabs>
      </Card>

      <Spin spinning={loading} tip="正在加载数据...">
        {/* 单日数据展示 */}
        {queryType === 'single' && dailyData && (
          <Card 
            style={{ marginTop: 20 }}
            title={
              <span>
                <CalendarOutlined style={{ marginRight: 8 }} />
                {dailyData.date} 板块分析报告
              </span>
            }
            extra={
              <Space>
                <Statistic 
                  title="总文章数" 
                  value={dailyData.total_articles} 
                  suffix="篇"
                  valueStyle={{ color: '#1890ff', fontSize: 14 }}
                />
                <Statistic 
                  title="板块总数" 
                  value={dailyData.boards.length} 
                  suffix="个"
                  valueStyle={{ fontSize: 14 }}
                />
              </Space>
            }
          >
            <Row gutter={16}>
              <Col span={12}>
                <ReactEcharts
                  option={getDailyChartOption(dailyData)}
                  style={{ height: 450 }}
                  opts={{ renderer: 'canvas' }}
                />
              </Col>
              <Col span={12}>
                <Table
                  dataSource={dailyData.boards}
                  columns={boardColumnsWithDetail}
                  rowKey="board"
                  size="small"
                  pagination={false}
                  scroll={{ y: 400 }}
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* 日期范围数据展示 */}
        {queryType === 'range' && rangeData.length > 0 && (
          <>
            <Card 
              style={{ marginTop: 20 }}
              title={
                <span>
                  <BarChartOutlined style={{ marginRight: 8 }} />
                  {dateRange[0]} 至 {dateRange[1]} 板块热度矩阵
                </span>
              }
              extra={
                <Statistic 
                  title="统计天数" 
                  value={rangeData.length} 
                  suffix="天"
                  valueStyle={{ fontSize: 14 }}
                />
              }
            >
              <ReactEcharts
                option={getHeatmapOption(rangeData)}
                style={{ height: 500 }}
                opts={{ renderer: 'canvas' }}
              />
            </Card>

            {/* 每日详情折叠面板 */}
            <Card title="每日详情" style={{ marginTop: 20 }}>
              {rangeData.map((day, idx) => (
                <details key={idx} style={{ marginBottom: 16, borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16, padding: '8px 0' }}>
                    📅 {day.date} - 共 {day.total_articles} 篇文章，{day.boards.length} 个板块
                  </summary>
                  <div style={{ marginTop: 12 }}>
                    <Table
                      dataSource={day.boards}
                      columns={getRangeBoardColumns(day.date)}
                      rowKey="board"
                      size="small"
                      pagination={false}
                    />
                  </div>
                </details>
              ))}
            </Card>
          </>
        )}

        {/* 板块趋势展示 */}
        {queryType === 'trend' && trendData[selectedBoard] && trendData[selectedBoard].length > 0 && (
          <Card style={{ marginTop: 20 }}>
            <ReactEcharts
              option={getTrendChartOption(selectedBoard, trendData[selectedBoard])}
              style={{ height: 450 }}
              opts={{ renderer: 'canvas' }}
            />
            
            {/* 趋势统计 */}
            <Divider />
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small">
                  <Statistic 
                    title="最高得分" 
                    value={Math.max(...trendData[selectedBoard].map(t => t.score)).toFixed(2)}
                    prefix={<RiseOutlined style={{ color: '#ff4d4f' }} />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic 
                    title="平均得分" 
                    value={(trendData[selectedBoard].reduce((a, b) => a + b.score, 0) / trendData[selectedBoard].length).toFixed(2)}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic 
                    title="总文章数" 
                    value={trendData[selectedBoard].reduce((a, b) => a + b.count, 0)}
                    suffix="篇"
                  />
                </Card>
              </Col>
            </Row>

            {/* 趋势数据表格 */}
            <Divider orientation="left">详细数据</Divider>
            <Table
              dataSource={trendData[selectedBoard].map((item, idx) => ({ ...item, key: idx }))}
              columns={trendColumns}
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        )}

        {/* 无数据提示 */}
        {queryType === 'single' && !dailyData && !loading && (
          <Card style={{ marginTop: 20, textAlign: 'center', padding: 50 }}>
            <HistoryOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <div style={{ marginTop: 16, color: '#999' }}>
              暂无 {selectedDate} 的数据，请尝试其他日期
            </div>
          </Card>
        )}
      </Spin>

      {/* 文章详情弹窗 */}
      <Modal
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            {currentBoard} 板块 - {currentDate} 文章详情
          </span>
        }
        visible={articlesModalVisible}
        onCancel={() => setArticlesModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Spin spinning={articlesLoading}>
          {articles.length > 0 ? (
            <List
              dataSource={articles}
              renderItem={(item: Article, index: number) => (
                <List.Item key={item.article_id || index}>
                  <List.Item.Meta
                    avatar={
                      <Badge 
                        count={item.score} 
                        style={{ 
                          backgroundColor: item.score >= 3 ? '#ff4d4f' : item.score >= 2 ? '#faad14' : '#1890ff',
                          borderRadius: 12,
                          padding: '0 8px'
                        }}
                      />
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{item.title}</span>
                        <Tag color="blue">{item.publish_time}</Tag>
                      </div>
                    }
                    description={
                      <div>
                        <span style={{ color: '#999', fontSize: 12 }}>文章ID: {item.article_id}</span>
                        <span style={{ marginLeft: 16, color: '#faad14', fontSize: 12 }}>
                          得分: {item.score} 分
                        </span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            !articlesLoading && <Empty description="暂无文章数据" />
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default BoardHistory;