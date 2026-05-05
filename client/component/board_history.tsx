import React, { useState, useCallback, useEffect } from 'react';
import { Button, DatePicker, Select, Space, Card, Row, Col, Spin, message, Statistic, Divider, Tabs, Table, Tag, Tooltip, Modal, List, Badge, Empty, Descriptions, Progress, Switch } from 'antd';
import { 
  LineChartOutlined, 
  BarChartOutlined, 
  HistoryOutlined,
  RiseOutlined,
  FallOutlined,
  EyeOutlined,
  CalendarOutlined,
  FileTextOutlined,
  StockOutlined,
  ReloadOutlined,
  RobotOutlined,
  FundOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import ReactEcharts from 'echarts-for-react';
import moment from 'moment';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// ========== 类型定义 ==========
interface BoardScore {
  board: string;
  total_score: number;
  article_count: number;
  avg_score: number;
}

// 增强版板块数据
interface EnhancedBoardScore {
  board: string;
  rank: number;
  news_score: number;
  fund_score: number;
  total_score: number;
  fund_inflow: number;
  article_count: number;
  insight: string;
  core_industries?: Array<{
    code: string;
    name: string;
    type: string;  // 'sw3_hy' 或 'ch_gn'
    stock_count: number;
    avg_pct_30d?: number;
  }>;
}

interface DailyData {
  date: string;
  boards: BoardScore[];
  total_score: number;
  total_articles: number;
}

interface EnhancedDailyData {
  date: string;
  boards: EnhancedBoardScore[];
  total_score: number;
  total_articles: number;
}

interface TrendData {
  date: string;
  score: number;
  count: number;
}

interface EnhancedTrendData {
  date: string;
  rank: number;
  total_score: number;
  fund_inflow: number;
}

interface Article {
  article_id: string;
  title: string;
  score: number;
  publish_time: string;
}

interface StockInfo {
  symbol: string;
  name: string;
  business_display_name: string;
  ai_focus?: {
    is_focused: boolean;
    datestr?: string;
    max_240_pct?: number;
    min_240_pct?: number;
    price_change?: string;
  };
}

interface BoardStocksData {
  board_name: string;
  keywords: string[];
  business_names: string[];
  stocks: StockInfo[];
  stock_count: number;
  mapping_count: number;
}

interface BoardSummary {
  board_name: string;
  keyword_count: number;
  business_count: number;
  stock_count: number;
}

const BoardHistory: React.FC = () => {
  // ========== 状态管理 ==========
  const [loading, setLoading] = useState<boolean>(false);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [enhancedData, setEnhancedData] = useState<EnhancedDailyData | null>(null);
  const [rangeData, setRangeData] = useState<DailyData[]>([]);
  const [trendData, setTrendData] = useState<Record<string, TrendData[]>>({});
  const [enhancedTrendData, setEnhancedTrendData] = useState<Record<string, EnhancedTrendData[]>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  
  // 视图模式：'news' 纯新闻版 | 'enhanced' 增强版
  const [viewMode, setViewMode] = useState<'news' | 'enhanced'>('enhanced');
  
  // 板块统计摘要
  const [boardsSummary, setBoardsSummary] = useState<BoardSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  
  // AI关注股票
  const [aiFocusStocks, setAiFocusStocks] = useState<Record<string, any>>({});
  const [aiFocusLoading, setAiFocusLoading] = useState<boolean>(false);
  
  // 文章详情弹窗
  const [articlesModalVisible, setArticlesModalVisible] = useState<boolean>(false);
  const [currentBoard, setCurrentBoard] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState<boolean>(false);
  
  // 股票信息弹窗
  const [stocksModalVisible, setStocksModalVisible] = useState<boolean>(false);
  const [stocksLoading, setStocksLoading] = useState<boolean>(false);
  const [stocksData, setStocksData] = useState<BoardStocksData>({
    board_name: '',
    keywords: [],
    business_names: [],
    stocks: [],
    stock_count: 0,
    mapping_count: 0
  });
  
  // 查询参数
  const [queryType, setQueryType] = useState<string>('single');
  const [selectedDate, setSelectedDate] = useState<string>(moment().format('YYYY-MM-DD'));
  const [dateRange, setDateRange] = useState<[string, string]>([
    moment().subtract(7, 'days').format('YYYY-MM-DD'),
    moment().format('YYYY-MM-DD')
  ]);
  const [selectedBoard, setSelectedBoard] = useState<string>('AI算力');

  // ========== API 调用 ==========
  
  // 获取所有板块摘要
  const fetchBoardsSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const response = await fetch('/api/sentiment/all_boards_summary');
      const data = await response.json();
      if (response.ok && !data.error) {
        setBoardsSummary(data);
      } else {
        console.error('获取板块摘要失败:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch boards summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // 获取 AI 关注的股票列表
  const fetchAiFocusStocks = useCallback(async () => {
    setAiFocusLoading(true);
    try {
      const response = await fetch('/api/focus_stocks_ai_list');
      const data = await response.json();
      if (response.ok && data) {
        const focusMap: Record<string, any> = {};
        data.forEach((item: any) => {
          focusMap[item.symbol] = {
            datestr: item.datestr,
            max_240_pct: item.max_240_pct,
            min_240_pct: item.min_240_pct,
            price_change: item.price_change
          };
        });
        setAiFocusStocks(focusMap);
        console.log('AI关注股票加载完成，共', Object.keys(focusMap).length, '只');
      }
    } catch (error) {
      console.error('Failed to fetch AI focus stocks:', error);
    } finally {
      setAiFocusLoading(false);
    }
  }, []);

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

  // 获取单日数据（纯新闻版）
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
        message.success(`成功加载 ${selectedDate} 的新闻版数据`);
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

  // 获取增强版单日数据
  const fetchEnhancedSingleDayData = useCallback(async () => {
    if (!selectedDate) {
      message.warning('请选择日期');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/board/enhanced_details?date=${selectedDate}`);
      const data = await response.json();
      
      if (response.ok && data) {
        setEnhancedData(data);
        message.success(`成功加载 ${selectedDate} 的增强版数据`);
      } else {
        message.error(data?.error || '数据加载失败');
        setEnhancedData(null);
      }
    } catch (error) {
      console.error('Failed to fetch enhanced data:', error);
      message.error('数据加载失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // 获取日期范围数据（纯新闻版）
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

  // 获取板块趋势（纯新闻版）
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

  // 获取增强版板块趋势
  const fetchEnhancedBoardTrend = useCallback(async () => {
    if (!selectedBoard) {
      message.warning('请选择板块');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/board/board_trend?board=${encodeURIComponent(selectedBoard)}&days=30`);
      const data = await response.json();
      
      if (response.ok && data) {
        setEnhancedTrendData(prev => ({ ...prev, [selectedBoard]: data.trend || [] }));
        message.success(`成功加载 ${selectedBoard} 的增强版趋势数据`);
      } else {
        message.error(data?.error || '数据加载失败');
      }
    } catch (error) {
      console.error('Failed to fetch enhanced trend data:', error);
      message.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [selectedBoard]);

  // 获取板块文章详情
  const fetchBoardArticles = async (date: string, board: string) => {
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

  // 获取板块股票信息
  const fetchBoardStocks = async (board: string) => {
    if (!board) {
      message.error('板块信息无效');
      return;
    }
    
    setStocksModalVisible(true);
    setCurrentBoard(board);
    setStocksLoading(true);
    
    try {
      const response = await fetch(`/api/sentiment/board_stocks?board=${encodeURIComponent(board)}`);
      const data = await response.json();
      
      if (response.ok && !data.error) {
        const stocksWithAiInfo = (data.stocks || []).map((stock: any) => ({
          ...stock,
          business_display_name: stock.business_display_name,
          ai_focus: aiFocusStocks[stock.symbol] ? {
            is_focused: true,
            datestr: aiFocusStocks[stock.symbol].datestr,
            max_240_pct: aiFocusStocks[stock.symbol].max_240_pct,
            min_240_pct: aiFocusStocks[stock.symbol].min_240_pct,
            price_change: aiFocusStocks[stock.symbol].price_change
          } : {
            is_focused: false
          }
        }));
        
        const sortedStocks = stocksWithAiInfo.sort((a: StockInfo, b: StockInfo) => {
          const aFocused = a.ai_focus?.is_focused;
          const bFocused = b.ai_focus?.is_focused;
          const aHasPriceChange = aFocused && a.ai_focus?.price_change;
          const bHasPriceChange = bFocused && b.ai_focus?.price_change;
          
          if (aFocused && !bFocused) return -1;
          if (!aFocused && bFocused) return 1;
          if (aFocused && bFocused) {
            if (aHasPriceChange && !bHasPriceChange) return -1;
            if (!aHasPriceChange && bHasPriceChange) return 1;
            return 0;
          }
          return 0;
        });
        
        setStocksData({
          board_name: data.board_name,
          keywords: data.keywords || [],
          business_names: data.business_names || [],
          stocks: sortedStocks,
          stock_count: data.stock_count || 0,
          mapping_count: data.mapping_count || 0
        });
        message.success(`获取到 ${data.stock_count || 0} 只相关股票`);
      } else {
        message.error(data?.error || '获取股票信息失败');
      }
    } catch (error) {
      console.error('Failed to fetch stocks:', error);
      message.error('获取股票信息失败');
    } finally {
      setStocksLoading(false);
    }
  };

  // ========== 初始加载 ==========
  useEffect(() => {
    fetchAvailableDates();
    fetchSingleDayData();
    fetchEnhancedSingleDayData();
    fetchBoardsSummary();
    fetchAiFocusStocks();
  }, []);

  // 视图模式切换时重新获取数据
  const handleViewModeChange = (checked: boolean) => {
    const newMode = checked ? 'enhanced' : 'news';
    setViewMode(newMode);
    
    // 重新加载当前查询类型的数据
    if (queryType === 'single') {
      if (newMode === 'enhanced') {
        fetchEnhancedSingleDayData();
      } else {
        fetchSingleDayData();
      }
    } else if (queryType === 'trend') {
      if (newMode === 'enhanced') {
        fetchEnhancedBoardTrend();
      } else {
        fetchBoardTrend();
      }
    }
  };

  // ========== 股票表格列定义 ==========
  const stockColumns = [
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>序号</span>,
      key: 'index',
      width: 70,
      render: (_: any, __: any, index: number) => <span style={{ fontSize: 13 }}>{index + 1}</span>,
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>股票代码</span>,
      dataIndex: 'symbol',
      key: 'symbol',
      width: 140,
      render: (symbol: string, record: StockInfo) => (
        <Space>
          <Tag color="green" style={{ fontFamily: 'monospace', fontWeight: 500, fontSize: 13, padding: '4px 8px' }}>
            {symbol}
          </Tag>
          {record.ai_focus?.is_focused && (
            <Tooltip title="AI算法推荐关注">
              <RobotOutlined style={{ color: '#1890ff', fontSize: 16 }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>股票名称</span>,
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (name: string, record: StockInfo) => (
        <span style={{ 
          fontWeight: record.ai_focus?.is_focused ? 600 : 'normal',
          color: record.ai_focus?.is_focused ? '#1890ff' : 'inherit',
          fontSize: 14
        }}>
          {name || record.symbol}
        </span>
      ),
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>所属业务板块</span>,
      dataIndex: 'business_display_name',
      key: 'business_display_name',
      width: 200,
      render: (name: string) => (
        <Tag color="cyan" style={{ fontSize: 13, padding: '4px 10px' }}>{name || '-'}</Tag>
      ),
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>AI关注信息</span>,
      key: 'ai_info',
      width: 320,
      render: (_: any, record: StockInfo) => {
        if (record.ai_focus?.is_focused) {
          const { datestr, max_240_pct, min_240_pct, price_change } = record.ai_focus;
          
          let priceChangeDisplay = null;
          if (price_change) {
            const changePercent = price_change.split('|')[0]?.trim() || '';
            const isPositive = changePercent.startsWith('+') || (!changePercent.startsWith('-') && changePercent !== '0.0%');
            const isNegative = changePercent.startsWith('-');
            
            priceChangeDisplay = (
              <div style={{ marginTop: 4, fontSize: 12, lineHeight: '1.4' }}>
                <span style={{ 
                  color: isPositive ? '#ff4d4f' : (isNegative ? '#52c41a' : '#999'),
                  fontFamily: 'monospace'
                }}>
                  {price_change}
                </span>
              </div>
            );
          }
          
          return (
            <div>
              <Tooltip 
                title={
                  <div style={{ fontSize: 13 }}>
                    <div>关注日期: {datestr}</div>
                    <div>最大涨幅: {max_240_pct !== undefined ? `${max_240_pct}%` : '无数据'}</div>
                    <div>最大跌幅: {min_240_pct !== undefined ? `${Math.abs(min_240_pct)}%` : '无数据'}</div>
                  </div>
                }
              >
                <Tag color="blue" style={{ cursor: 'pointer', fontSize: 13, padding: '4px 10px' }}>
                  <RobotOutlined /> AI关注
                  {max_240_pct > 0 && <span style={{ color: '#ff4d4f', marginLeft: 6, fontSize: 13 }}>↑{max_240_pct}%</span>}
                  {min_240_pct < 0 && <span style={{ color: '#52c41a', marginLeft: 6, fontSize: 13 }}>↓{Math.abs(min_240_pct)}%</span>}
                </Tag>
              </Tooltip>
              {priceChangeDisplay}
            </div>
          );
        }
        return <span style={{ color: '#999', fontSize: 13 }}>-</span>;
      },
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>操作</span>,
      key: 'action',
      width: 160,
      render: (_: any, record: StockInfo) => (
        <Space>
          <Button 
            type="link" 
            size="middle"
            style={{ fontSize: 13 }}
            onClick={() => window.open(`https://xueqiu.com/S/${record.symbol}`, '_blank')}
          >
            雪球
          </Button>
          <Button 
            type="link" 
            size="middle"
            style={{ fontSize: 13 }}
            onClick={() => window.open(`https://quote.eastmoney.com/${record.symbol}.html`, '_blank')}
          >
            东方财富
          </Button>
        </Space>
      ),
    },
  ];

  // ========== 纯新闻版表格列定义 ==========
  const boardColumnsWithDetail = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => {
        const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        const color = index < 3 ? medalColors[index] : '#999';
        return <span style={{ fontWeight: 600, color }}>{index + 1}</span>;
      },
    },
    {
      title: '板块',
      dataIndex: 'board',
      key: 'board',
      width: 100,
      render: (board: string) => <Tag color="blue" style={{ fontSize: 14, fontWeight: 500 }}>{board}</Tag>,
    },
    {
      title: '综合得分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 100,
      sorter: (a: BoardScore, b: BoardScore) => a.total_score - b.total_score,
      render: (score: number) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{score.toFixed(2)}</span>,
    },
    {
      title: '文章数量',
      dataIndex: 'article_count',
      key: 'article_count',
      width: 90,
      render: (count: number) => `${count} 篇`,
    },
    {
      title: '平均得分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      width: 90,
      render: (score: number) => score.toFixed(2),
    },
    {
      title: '热度',
      key: 'heat',
      width: 120,
      render: (_: any, record: BoardScore) => {
        const heatLevel = Math.min(Math.floor(record.total_score / 20) + 1, 5);
        const stars = '⭐'.repeat(heatLevel);
        return <Tooltip title={`热度等级 ${heatLevel}/5`}>{stars}</Tooltip>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: BoardScore) => (
        <Space size="small">
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
            文章
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={<StockOutlined />}
            onClick={() => fetchBoardStocks(record.board)}
          >
            股票
          </Button>
        </Space>
      ),
    },
  ];

  // ========== 增强版表格列定义 ==========
  const enhancedBoardColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => {
        const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        const color = index < 3 ? medalColors[index] : '#999';
        return <span style={{ fontWeight: 600, color }}>{index + 1}</span>;
      },
    },
    {
      title: '板块',
      dataIndex: 'board',
      key: 'board',
      width: 100,
      render: (board: string, record: EnhancedBoardScore) => (
        <Tooltip title={record.insight}>
          <Tag color={record.rank <= 3 ? 'gold' : 'blue'} style={{ fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {board}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 90,
      sorter: (a: EnhancedBoardScore, b: EnhancedBoardScore) => a.total_score - b.total_score,
      render: (score: number) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{score.toFixed(2)}</span>,
    },
    {
      title: '新闻分',
      dataIndex: 'news_score',
      key: 'news_score',
      width: 90,
      render: (score: number) => <span style={{ color: '#52c41a' }}>{score.toFixed(2)}</span>,
    },
    {
      title: '资金分',
      dataIndex: 'fund_score',
      key: 'fund_score',
      width: 90,
      render: (score: number) => <span style={{ color: '#faad14' }}>{score.toFixed(2)}</span>,
    },
    {
      title: '资金流向',
      dataIndex: 'fund_inflow',
      key: 'fund_inflow',
      width: 120,
      render: (inflow: number) => {
        const isPositive = inflow > 0;
        const color = isPositive ? '#ff4d4f' : '#52c41a';
        const prefix = isPositive ? '↑' : '↓';
        return (
          <span style={{ color, fontWeight: 500 }}>
            {prefix} {Math.abs(inflow).toFixed(1)}亿
          </span>
        );
      },
    },
    {
      title: '🎯 核心板块',
      key: 'core_industries',
      width: 350,
      render: (_: any, record: EnhancedBoardScore) => {
        const industries = (record as any).core_industries || [];
        if (industries.length === 0) {
          return <span style={{ color: '#999', fontSize: 12 }}>-</span>;
        }
        
        // 分离申万三级和同花顺概念
        const sw3Industries = industries.filter((i: any) => i.type === 'sw3_hy');
        const chgnIndustries = industries.filter((i: any) => i.type === 'ch_gn');
        
        return (
          <div>
            {sw3Industries.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#666', marginRight: 8 }}>📊 申万三级</span>
                <Space wrap size={4}>
                  {sw3Industries.map((ind: any) => (
                    <Tag key={ind.code} color="gold" style={{ fontSize: 11, margin: '1px' }}>
                      {ind.name} ({ind.stock_count})
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
            {chgnIndustries.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: '#666', marginRight: 8 }}>🏷️ 同花顺概念</span>
                <Space wrap size={4}>
                  {chgnIndustries.map((ind: any) => (
                    <Tag key={ind.code} color="blue" style={{ fontSize: 11, margin: '1px' }}>
                      {ind.name} ({ind.stock_count})
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '文章数',
      dataIndex: 'article_count',
      key: 'article_count',
      width: 80,
      render: (count: number) => `${count}篇`,
    },
    {
      title: '解读',
      dataIndex: 'insight',
      key: 'insight',
      width: 280,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ fontSize: 12, color: '#666' }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: EnhancedBoardScore) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => {
              if (enhancedData?.date) {
                fetchBoardArticles(enhancedData.date, record.board);
              } else {
                message.error('无法获取当前日期');
              }
            }}
          >
            文章
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={<StockOutlined />}
            onClick={() => fetchBoardStocks(record.board)}
          >
            股票
          </Button>
        </Space>
      ),
    },
  ];

  // ========== 范围查询表格列定义 ==========
  const getRangeBoardColumns = (date: string) => [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => {
        const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        const color = index < 3 ? medalColors[index] : '#999';
        return <span style={{ fontWeight: 600, color }}>{index + 1}</span>;
      },
    },
    {
      title: '板块',
      dataIndex: 'board',
      key: 'board',
      width: 100,
      render: (board: string) => <Tag color="blue" style={{ fontSize: 14, fontWeight: 500 }}>{board}</Tag>,
    },
    {
      title: '综合得分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 100,
      render: (score: number) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{score.toFixed(2)}</span>,
    },
    {
      title: '文章数量',
      dataIndex: 'article_count',
      key: 'article_count',
      width: 90,
      render: (count: number) => `${count} 篇`,
    },
    {
      title: '平均得分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      width: 90,
      render: (score: number) => score.toFixed(2),
    },
    {
      title: '热度',
      key: 'heat',
      width: 120,
      render: (_: any, record: BoardScore) => {
        const heatLevel = Math.min(Math.floor(record.total_score / 20) + 1, 5);
        const stars = '⭐'.repeat(heatLevel);
        return <Tooltip title={`热度等级 ${heatLevel}/5`}>{stars}</Tooltip>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: BoardScore) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => fetchBoardArticles(date, record.board)}
          >
            文章
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={<StockOutlined />}
            onClick={() => fetchBoardStocks(record.board)}
          >
            股票
          </Button>
        </Space>
      ),
    },
  ];

  // ========== 趋势表格列定义 ==========
  const trendColumns = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
    {
      title: '综合得分',
      dataIndex: 'score',
      key: 'score',
      width: 120,
      render: (score: number) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{score?.toFixed(2) || '0.00'}</span>,
    },
    { title: '文章数量', dataIndex: 'count', key: 'count', width: 100, render: (count: number) => `${count || 0} 篇` },
  ];

  // 增强版趋势表格列定义
  const enhancedTrendColumns = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => <Tag color={rank <= 3 ? 'gold' : 'default'}>{rank}</Tag>,
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 100,
      render: (score: number) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{score.toFixed(2)}</span>,
    },
    {
      title: '资金流向',
      dataIndex: 'fund_inflow',
      key: 'fund_inflow',
      width: 100,
      render: (inflow: number) => {
        const isPositive = inflow > 0;
        const color = isPositive ? '#ff4d4f' : '#52c41a';
        const prefix = isPositive ? '↑' : '↓';
        return <span style={{ color, fontWeight: 500 }}>{prefix} {Math.abs(inflow).toFixed(1)}亿</span>;
      },
    },
  ];

  // ========== 图表配置 ==========
  
  // 纯新闻版单日图表
  const getDailyChartOption = (data: DailyData) => {
    if (!data || !data.boards) return null;
    
    const boards = data.boards.slice(0, 10);
    const scores = boards.map(b => b.total_score);
    const names = boards.map(b => b.board);
    
    return {
      title: { text: `${data.date} 板块热度分布`, left: 'center', top: 0, textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 50, bottom: 30, left: 80, right: 30, containLabel: true },
      xAxis: { type: 'category', data: names, axisLabel: { rotate: 45, fontSize: 11 } },
      yAxis: { type: 'value', name: '得分', nameLocation: 'middle', nameGap: 45 },
      series: [{
        name: '得分', type: 'bar', data: scores,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#1890ff' }, { offset: 1, color: '#69c0ff' }] } },
        label: { show: true, position: 'top', formatter: '{c}', fontSize: 11 }
      }]
    };
  };

  // 增强版单日图表
  const getEnhancedChartOption = (data: EnhancedDailyData) => {
    if (!data || !data.boards) return null;
    
    const boards = data.boards.slice(0, 10);
    const scores = boards.map(b => b.total_score);
    const newsScores = boards.map(b => b.news_score);
    const fundScores = boards.map(b => b.fund_score);
    const names = boards.map(b => b.board);
    
    return {
      title: { text: `${data.date} 增强版板块热度分布`, left: 'center', top: 0, textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['新闻分', '资金分'], top: 30, left: 'center' },
      grid: { top: 80, bottom: 30, left: 80, right: 30, containLabel: true },
      xAxis: { type: 'category', data: names, axisLabel: { rotate: 45, fontSize: 11 } },
      yAxis: { type: 'value', name: '得分', nameLocation: 'middle', nameGap: 45 },
      series: [
        { name: '新闻分', type: 'bar', data: newsScores, itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', fontSize: 10 } },
        { name: '资金分', type: 'bar', data: fundScores, itemStyle: { color: '#faad14', borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', fontSize: 10 } }
      ]
    };
  };

  // 纯新闻版趋势图表
  const getTrendChartOption = (board: string, trend: TrendData[]) => {
    if (!trend || trend.length === 0) return null;
    
    const dates = trend.map(t => t.date);
    const scores = trend.map(t => t.score);
    const counts = trend.map(t => t.count);
    const isLargeDataset = dates.length > 60;
    
    return {
      title: { text: `${board} 板块趋势分析`, left: 'center', top: 0, textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['综合得分', '文章数量'], top: 30, left: 'center' },
      grid: { top: 80, bottom: 40, left: 60, right: 60, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45, interval: isLargeDataset ? Math.floor(dates.length / 15) : 0, fontSize: isLargeDataset ? 10 : 11 } },
      yAxis: [{ type: 'value', name: '综合得分', nameLocation: 'middle', nameGap: 45 }, { type: 'value', name: '文章数量', nameLocation: 'middle', nameGap: 45 }],
      series: [
        { name: '综合得分', type: 'line', data: scores, lineStyle: { color: '#1890ff', width: 2 }, symbol: 'circle', symbolSize: isLargeDataset ? 4 : 6, smooth: !isLargeDataset, areaStyle: { opacity: 0.2, color: '#1890ff' }, yAxisIndex: 0 },
        { name: '文章数量', type: 'bar', data: counts, itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] }, yAxisIndex: 1, barWidth: isLargeDataset ? '40%' : '60%' }
      ],
      dataZoom: dates.length > 50 ? [{ type: 'slider', start: 0, end: 100, bottom: 0, height: 20 }] : []
    };
  };

  // 增强版趋势图表
  const getEnhancedTrendChartOption = (board: string, trend: EnhancedTrendData[]) => {
    if (!trend || trend.length === 0) return null;
    
    const dates = trend.map(t => t.date);
    const scores = trend.map(t => t.total_score);
    const ranks = trend.map(t => t.rank);
    const inflows = trend.map(t => t.fund_inflow);
    const isLargeDataset = dates.length > 60;
    
    return {
      title: { text: `${board} 增强版趋势分析`, left: 'center', top: 0, textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['总分', '排名(逆序)', '资金流向'], top: 30, left: 'center' },
      grid: { top: 80, bottom: 40, left: 60, right: 60, containLabel: true },
      xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45, interval: isLargeDataset ? Math.floor(dates.length / 15) : 0, fontSize: isLargeDataset ? 10 : 11 } },
      yAxis: [
        { type: 'value', name: '总分', nameLocation: 'middle', nameGap: 45 },
        { type: 'value', name: '排名(逆序)', nameLocation: 'middle', nameGap: 45, inverse: true },
        { type: 'value', name: '资金流向(亿)', nameLocation: 'middle', nameGap: 45 }
      ],
      series: [
        { name: '总分', type: 'line', data: scores, lineStyle: { color: '#1890ff', width: 2 }, symbol: 'circle', symbolSize: isLargeDataset ? 4 : 6, smooth: !isLargeDataset, areaStyle: { opacity: 0.2, color: '#1890ff' }, yAxisIndex: 0 },
        { name: '排名(逆序)', type: 'line', data: ranks.map(r => r), lineStyle: { color: '#faad14', width: 2, type: 'dashed' }, symbol: 'diamond', symbolSize: isLargeDataset ? 4 : 6, yAxisIndex: 1 },
        { name: '资金流向', type: 'bar', data: inflows, itemStyle: { color: '#ff4d4f', borderRadius: [4, 4, 0, 0] }, yAxisIndex: 2, barWidth: isLargeDataset ? '30%' : '40%' }
      ],
      dataZoom: dates.length > 50 ? [{ type: 'slider', start: 0, end: 100, bottom: 0, height: 20 }] : []
    };
  };

  // 热力图矩阵配置（纯新闻版）
  const getHeatmapOption = (data: DailyData[]) => {
    if (!data || data.length === 0) return null;
    
    const allBoards = new Set<string>();
    data.forEach(day => { day.boards.forEach(board => allBoards.add(board.board)); });
    
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
      title: { text: '板块热度矩阵', left: 'center', top: 0, textStyle: { fontSize: 14, fontWeight: 'bold' } },
      tooltip: { trigger: 'item', formatter: (params: any) => `${params.value[1]}<br/>${params.value[0]}: ${params.value[2].toFixed(2)}分` },
      xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45, fontSize: 10 } },
      yAxis: { type: 'category', data: boards, axisLabel: { fontSize: 11 } },
      visualMap: { min: 0, max: Math.max(...matrixData.flat()), calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#e6f7ff', '#69c0ff', '#1890ff', '#0050b3'] } },
      series: [{ name: '得分', type: 'heatmap', data: matrixData.flatMap((row, i) => row.map((value, j) => [j, i, value])), label: { show: data.length <= 10 && boards.length <= 10, formatter: (params: any) => params.data[2].toFixed(0) }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } } }]
    };
  };

  // 当前使用的数据
  const currentDailyData = viewMode === 'enhanced' ? enhancedData : dailyData;

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 板块股票统计卡片 */}
      <Card 
        title={<span><StockOutlined style={{ marginRight: 8, color: '#1890ff' }} />板块股票统计（舆情映射）</span>}
        style={{ marginBottom: 20 }}
        extra={<Button icon={<ReloadOutlined />} size="small" onClick={fetchBoardsSummary} loading={summaryLoading}>刷新</Button>}
      >
        <Spin spinning={summaryLoading}>
          <Row gutter={16}>
            {boardsSummary.map((board) => (
              <Col xs={24} sm={12} md={8} lg={6} xl={4} key={board.board_name} style={{ marginBottom: 16 }}>
                <Card size="small" hoverable onClick={() => fetchBoardStocks(board.board_name)} style={{ cursor: 'pointer' }}>
                  <Statistic title={<Tag color="blue">{board.board_name}</Tag>} value={board.stock_count} suffix="只股票" valueStyle={{ color: '#52c41a', fontSize: 20 }} />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>关键词: {board.keyword_count}个 | 业务板块: {board.business_count}个</div>
                  <Progress percent={Math.min((board.stock_count / 2000) * 100, 100)} size="small" showInfo={false} strokeColor="#52c41a" />
                </Card>
              </Col>
            ))}
          </Row>
        </Spin>
      </Card>

      {/* 查询面板 */}
      <Card title={<span><HistoryOutlined style={{ marginRight: 8, color: '#1890ff' }} />板块历史数据查询</span>} bordered={false}>
        {/* 视图模式切换 */}
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Space>
            <span>视图模式：</span>
            <Switch
              checkedChildren="增强版"
              unCheckedChildren="纯新闻版"
              checked={viewMode === 'enhanced'}
              onChange={handleViewModeChange}
            />
            {viewMode === 'enhanced' && (
              <Tag color="purple" icon={<FundOutlined />}>新闻50% + 资金50%</Tag>
            )}
          </Space>
        </div>

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
                  disabledDate={(current) => current && current > moment().endOf('day')}
                />
              </div>
              <Button 
                type="primary" 
                icon={<EyeOutlined />}
                onClick={viewMode === 'enhanced' ? fetchEnhancedSingleDayData : fetchSingleDayData}
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
                      setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                    }
                  }}
                  style={{ width: 260 }}
                />
              </div>
              <Button type="primary" icon={<BarChartOutlined />} onClick={fetchRangeData} loading={loading}>分析范围</Button>
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
                    { value: 'AI算力', label: 'AI算力' }, { value: '银行', label: '银行' }, { value: '券商', label: '券商' },
                    { value: '新能源', label: '新能源' }, { value: '半导体', label: '半导体' }, { value: '消费', label: '消费' },
                    { value: '创新药', label: '创新药' }, { value: '房地产', label: '房地产' }, { value: '黄金', label: '黄金' },
                  ]}
                />
              </div>
              <Button 
                type="primary" 
                icon={<LineChartOutlined />}
                onClick={viewMode === 'enhanced' ? fetchEnhancedBoardTrend : fetchBoardTrend}
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
        {queryType === 'single' && currentDailyData && (
          <Card 
            style={{ marginTop: 20 }}
            title={<span><CalendarOutlined style={{ marginRight: 8 }} />{currentDailyData.date} 板块分析报告{viewMode === 'enhanced' && '（增强版）'}</span>}
            extra={
              <Space>
                <Statistic title="总文章数" value={currentDailyData.total_articles} suffix="篇" valueStyle={{ color: '#1890ff', fontSize: 14 }} />
                <Statistic title="板块总数" value={currentDailyData.boards.length} suffix="个" valueStyle={{ fontSize: 14 }} />
              </Space>
            }
          >
            <Row gutter={16}>
              <Col span={8}>
                <ReactEcharts
                  option={viewMode === 'enhanced' ? getEnhancedChartOption(enhancedData!) : getDailyChartOption(dailyData!)}
                  style={{ height: 520 }}
                  opts={{ renderer: 'canvas' }}
                />
              </Col>
              <Col span={16}>
                <Table
                  dataSource={currentDailyData.boards}
                  columns={viewMode === 'enhanced' ? enhancedBoardColumns : boardColumnsWithDetail}
                  rowKey="board"
                  size="small"
                  pagination={false}
                  scroll={{ x: 900 }}
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* 日期范围数据展示 */}
        {queryType === 'range' && rangeData.length > 0 && (
          <>
            <Card style={{ marginTop: 20 }} title={<span><BarChartOutlined style={{ marginRight: 8 }} />{dateRange[0]} 至 {dateRange[1]} 板块热度矩阵</span>} extra={<Statistic title="统计天数" value={rangeData.length} suffix="天" valueStyle={{ fontSize: 14 }} />}>
              <ReactEcharts option={getHeatmapOption(rangeData)} style={{ height: 500 }} opts={{ renderer: 'canvas' }} />
            </Card>

            <Card title="每日详情" style={{ marginTop: 20 }}>
              {rangeData.map((day, idx) => (
                <details key={idx} style={{ marginBottom: 16, borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16, padding: '8px 0' }}>📅 {day.date} - 共 {day.total_articles} 篇文章，{day.boards.length} 个板块</summary>
                  <div style={{ marginTop: 12 }}>
                    <Table dataSource={day.boards} columns={getRangeBoardColumns(day.date)} rowKey="board" size="small" pagination={false} />
                  </div>
                </details>
              ))}
            </Card>
          </>
        )}

        {/* 板块趋势展示 - 纯新闻版 */}
        {queryType === 'trend' && viewMode === 'news' && trendData[selectedBoard] && trendData[selectedBoard].length > 0 && (
          <Card style={{ marginTop: 20 }}>
            <ReactEcharts option={getTrendChartOption(selectedBoard, trendData[selectedBoard])} style={{ height: 450 }} opts={{ renderer: 'canvas' }} />
            <Divider />
            <Row gutter={16}>
              <Col span={8}><Card size="small"><Statistic title="最高得分" value={Math.max(...trendData[selectedBoard].map(t => t.score)).toFixed(2)} prefix={<RiseOutlined style={{ color: '#ff4d4f' }} />} /></Card></Col>
              <Col span={8}><Card size="small"><Statistic title="平均得分" value={(trendData[selectedBoard].reduce((a, b) => a + b.score, 0) / trendData[selectedBoard].length).toFixed(2)} /></Card></Col>
              <Col span={8}><Card size="small"><Statistic title="总文章数" value={trendData[selectedBoard].reduce((a, b) => a + b.count, 0)} suffix="篇" /></Card></Col>
            </Row>
            <Divider orientation="left">详细数据</Divider>
            <Table dataSource={trendData[selectedBoard].map((item, idx) => ({ ...item, key: idx }))} columns={trendColumns} size="small" pagination={{ pageSize: 10 }} />
          </Card>
        )}

        {/* 板块趋势展示 - 增强版 */}
        {queryType === 'trend' && viewMode === 'enhanced' && enhancedTrendData[selectedBoard] && enhancedTrendData[selectedBoard].length > 0 && (
          <Card style={{ marginTop: 20 }}>
            <ReactEcharts option={getEnhancedTrendChartOption(selectedBoard, enhancedTrendData[selectedBoard])} style={{ height: 450 }} opts={{ renderer: 'canvas' }} />
            <Divider />
            <Row gutter={16}>
              <Col span={6}><Card size="small"><Statistic title="最高总分" value={Math.max(...enhancedTrendData[selectedBoard].map(t => t.total_score)).toFixed(2)} prefix={<RiseOutlined style={{ color: '#ff4d4f' }} />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="最佳排名" value={Math.min(...enhancedTrendData[selectedBoard].map(t => t.rank))} prefix={<RiseOutlined style={{ color: '#52c41a' }} />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="累计资金流入" value={enhancedTrendData[selectedBoard].reduce((a, b) => a + b.fund_inflow, 0).toFixed(1)} suffix="亿" /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="平均总分" value={(enhancedTrendData[selectedBoard].reduce((a, b) => a + b.total_score, 0) / enhancedTrendData[selectedBoard].length).toFixed(2)} /></Card></Col>
            </Row>
            <Divider orientation="left">详细数据</Divider>
            <Table dataSource={enhancedTrendData[selectedBoard].map((item, idx) => ({ ...item, key: idx }))} columns={enhancedTrendColumns} size="small" pagination={{ pageSize: 10 }} />
          </Card>
        )}

        {/* 无数据提示 */}
        {queryType === 'single' && !currentDailyData && !loading && (
          <Card style={{ marginTop: 20, textAlign: 'center', padding: 50 }}>
            <HistoryOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <div style={{ marginTop: 16, color: '#999' }}>暂无 {selectedDate} 的数据，请尝试其他日期</div>
          </Card>
        )}
      </Spin>

      {/* 文章详情弹窗 */}
      <Modal
        title={<span><FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />{currentBoard} 板块 - {currentDate} 文章详情</span>}
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
                    avatar={<Badge count={item.score} style={{ backgroundColor: item.score >= 3 ? '#ff4d4f' : item.score >= 2 ? '#faad14' : '#1890ff', borderRadius: 12, padding: '0 8px' }} />}
                    title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}><span style={{ fontWeight: 500 }}>{item.title}</span><Tag color="blue">{item.publish_time}</Tag></div>}
                    description={<div><span style={{ color: '#999', fontSize: 12 }}>文章ID: {item.article_id}</span><span style={{ marginLeft: 16, color: '#faad14', fontSize: 12 }}>得分: {item.score} 分</span></div>}
                  />
                </List.Item>
              )}
            />
          ) : (!articlesLoading && <Empty description="暂无文章数据" />)}
        </Spin>
      </Modal>

      {/* 股票列表弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}><StockOutlined style={{ marginRight: 8, color: '#52c41a' }} />{stocksData.board_name} 板块 - 相关股票（舆情映射）</span>}
        visible={stocksModalVisible}
        onCancel={() => setStocksModalVisible(false)}
        footer={null}
        width="90%"
        style={{ top: 20 }}
        bodyStyle={{ height: 'calc(100vh - 150px)', overflowY: 'auto', padding: '20px' }}
        destroyOnClose
      >
        <Spin spinning={stocksLoading}>
          {stocksData.stock_count > 0 ? (
            <>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={24}>
                  <Card size="small">
                    <Row gutter={16}>
                      <Col span={6}><Statistic title="板块名称" value={stocksData.board_name} valueStyle={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }} /></Col>
                      <Col span={6}><Statistic title="股票总数" value={stocksData.stock_count} valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }} /></Col>
                      <Col span={6}><Statistic title="AI关注股票" value={stocksData.stocks.filter(s => s.ai_focus?.is_focused).length} valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }} prefix={<RobotOutlined style={{ fontSize: 18 }} />} /></Col>
                      <Col span={6}><Statistic title="映射业务板块数" value={stocksData.business_names.length} valueStyle={{ fontSize: 18 }} /></Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}><Card size="small" title="相关关键词"><div style={{ maxHeight: 80, overflowY: 'auto' }}>{stocksData.keywords.map(kw => <Tag key={kw} color="cyan" style={{ marginBottom: 4, fontSize: 13, padding: '4px 10px' }}>{kw}</Tag>)}</div></Card></Col>
                <Col span={12}><Card size="small" title="映射业务板块"><div style={{ maxHeight: 80, overflowY: 'auto' }}>{stocksData.business_names.map(bn => <Tag key={bn} color="purple" style={{ marginBottom: 4, fontSize: 13, padding: '4px 10px' }}>{bn}</Tag>)}</div></Card></Col>
              </Row>
              <Divider orientation="left" style={{ margin: '8px 0', fontSize: 15 }}>
                <Space><span style={{ fontSize: 15, fontWeight: 'bold' }}>股票列表</span><Tag color="blue">总股票: {stocksData.stock_count}</Tag><Tag color="cyan"><RobotOutlined /> AI关注: {stocksData.stocks.filter(s => s.ai_focus?.is_focused).length}</Tag></Space>
              </Divider>
              <Table
                dataSource={stocksData.stocks}
                columns={stockColumns}
                rowKey="symbol"
                size="middle"
                pagination={{ pageSize: 100, showSizeChanger: true, showTotal: (total) => <span>共 {total} 只股票</span>, pageSizeOptions: ['50', '100', '200', '500'] }}
                scroll={{ y: 'calc(100vh - 420px)' }}
              />
            </>
          ) : (!stocksLoading && <Empty description={<span>暂无 {stocksData.board_name} 板块的相关股票数据<br /><span style={{ fontSize: 12, color: '#999' }}>请确认舆情映射配置是否正确</span></span>} />)}
        </Spin>
      </Modal>
    </div>
  );
};

export default BoardHistory;