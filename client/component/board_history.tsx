import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  FileSearchOutlined,
  FilterOutlined,
  CloseOutlined
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
    type: string;
    stock_count: number;
    avg_pct_30d?: number;
    heat_count?: number;
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
  business_display_names?: string;  // 新增：多个业务板块，用 | 分隔
  business_codes?: string;          // 新增：多个业务代码
  all_business_display_names?: string;
  ai_focus?: {
    is_focused: boolean;
    datestr?: string;
    max_240_pct?: number;
    min_240_pct?: number;
    price_change?: string;
    latest_alert?: {
      record_type: 'Record1' | 'Record2';
      datestr: string;
      alert_decision?: string;
      alert_price?: number | null;
      as_of_date: string;
      as_of_price?: number | null;
      price_change_pct?: number | null;
    } | null;
  };
}

interface BoardStocksData {
  board_name: string;
  keywords: string[];
  business_names: string[];
  business_names_with_stats?: Array<{
    name: string;
    stock_count: number;
    heat_count: number;
    type: string;
    source: 'core' | 'mapping';
  }>;
  stocks: StockInfo[];
  stock_count: number;
  mapping_count: number;
  requested_date?: string;
  as_of_date?: string;
  history_alert_count?: number;
  latest_record1_count?: number;
  latest_record2_count?: number;
  no_history_alert_count?: number;
}

interface BoardSummary {
  board_name: string;
  keyword_count: number;
  business_count: number;
  stock_count: number;
  business_names?: string[];
}

interface SectorFundFlowItem {
  sector_code: string;
  sector_name: string;
  main_inflow_yi: number;
}

interface SectorFundFlowPeriodRankItem {
  sector_code: string;
  sector_name: string;
  period_inflow_yi: number;
  period_outflow_yi: number;
  period_net_inflow_yi: number;
  period_net_outflow_yi: number;
  covered_days: number;
}

interface SectorFundFlowData {
  requested_date: string;
  as_of_date: string;
  sector_count: number;
  inflow_count: number;
  outflow_count: number;
  total_net_inflow_yi: number;
  top_inflows: SectorFundFlowItem[];
  top_outflows: SectorFundFlowItem[];
  sectors: SectorFundFlowItem[];
  selected_sector: string | null;
  requested_days: number;
  ranking_covered_days: number;
  period_top_inflows: SectorFundFlowPeriodRankItem[];
  period_top_outflows: SectorFundFlowPeriodRankItem[];
  covered_days: number;
  period_inflow_yi: number;
  period_outflow_yi: number;
  period_net_inflow_yi: number;
  trend: Array<{ date: string; main_inflow_yi: number }>;
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
  const [showAllBoards, setShowAllBoards] = useState<boolean>(false);

  // 固定显示的板块（按优先级排序）
  const FIXED_BOARDS = [
    'AI算力', '新能源', '半导体', '黄金', '券商', '消费', 
    '创新药', '银行', '房地产', '汽车零部件', '化工', '军工'
  ];

  // 计算当天有数据的板块（合并新闻板块 + 资金板块）
  const hotBoardsSummary = useMemo(() => {
    // 1. 优先从增强版数据获取（包含新闻分和资金分）
    let allBoards: (BoardSummary & { fund_inflow?: number; fund_score?: number })[] = [];
    
    if (enhancedData && enhancedData.boards && enhancedData.boards.length > 0) {
      // 按总分排序
      const sortedBoards = [...enhancedData.boards].sort((a, b) => b.total_score - a.total_score);
      
      for (const board of sortedBoards) {
        const summary = boardsSummary.find(b => b.board_name === board.board);
        if (summary) {
          allBoards.push({
            ...summary,
            fund_inflow: board.fund_inflow,
            fund_score: board.fund_score
          });
        } else {
          allBoards.push({
            board_name: board.board,
            keyword_count: 0,
            business_count: 0,
            stock_count: 0,
            fund_inflow: board.fund_inflow,
            fund_score: board.fund_score
          });
        }
      }
    } 
    // 2. 降级：从纯新闻版数据获取
    else if (dailyData && dailyData.boards && dailyData.boards.length > 0) {
      for (const board of dailyData.boards) {
        const summary = boardsSummary.find(b => b.board_name === board.board);
        if (summary) {
          allBoards.push({
            ...summary,
            fund_inflow: 0,
            fund_score: 0
          });
        }
      }
    }
    // 3. 最后降级：显示所有板块
    else {
      for (const summary of boardsSummary) {
        allBoards.push({
          ...summary,
          fund_inflow: undefined,
          fund_score: undefined
        });
      }
    }
    
    return allBoards;
  }, [boardsSummary, enhancedData, dailyData]);

  // 分离核心板块和其他板块
  const { coreBoards, otherBoards } = useMemo(() => {
    const core = hotBoardsSummary.filter(board => FIXED_BOARDS.includes(board.board_name));
    const other = hotBoardsSummary.filter(board => !FIXED_BOARDS.includes(board.board_name));
    return { coreBoards: core, otherBoards: other };
  }, [hotBoardsSummary]);
  
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
  const [stocksModalSource, setStocksModalSource] = useState<'sentiment' | 'sw2'>('sentiment');
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState<string | null>(null); // 新增：业务板块过滤
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

  const [actualTop10, setActualTop10] = useState<any[]>([]);
  const [actualTop10Loading, setActualTop10Loading] = useState<boolean>(false);
  const [sectorFundFlow, setSectorFundFlow] = useState<SectorFundFlowData | null>(null);
  const [sectorFundFlowLoading, setSectorFundFlowLoading] = useState<boolean>(false);
  const [selectedFlowSector, setSelectedFlowSector] = useState<string>('');
  const [sectorFlowPeriod, setSectorFlowPeriod] = useState<number>(30);
  const [sectorFlowDate, setSectorFlowDate] = useState<string>(moment().format('YYYY-MM-DD'));

  // ========== 过滤后的股票列表 ==========
  const filteredStocks = useMemo(() => {
    if (!selectedBusinessFilter) {
      return stocksData.stocks;
    }
    return stocksData.stocks.filter(stock => {
      // 检查是否匹配选中的业务板块
      if (stock.business_display_names && stock.business_display_names.includes('|')) {
        const businesses = stock.business_display_names.split('|');
        return businesses.includes(selectedBusinessFilter);
      }
      return stock.business_display_name === selectedBusinessFilter;
    });
  }, [stocksData.stocks, selectedBusinessFilter]);

  // 获取业务板块的热度计数（用于显示）
  const getBusinessHeatCount = (businessName: string) => {
    return stocksData.stocks.filter(s => {
      if (s.business_display_names && s.business_display_names.includes('|')) {
        const businesses = s.business_display_names.split('|');
        return businesses.includes(businessName);
      }
      return s.business_display_name === businessName;
    }).length;
  };

  // 清除业务板块过滤
  const clearBusinessFilter = () => {
    setSelectedBusinessFilter(null);
  };

  // ========== API 调用 ==========

  // 获取所有板块摘
  const fetchBoardsSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const response = await fetch('/api/sentiment/all_boards_summary');
      const data = await response.json();
      if (response.ok && !data.error) {
        const boardsWithNames = await Promise.all(
          data.map(async (board: BoardSummary) => {
            try {
              const stocksRes = await fetch(`/api/sentiment/board_stocks?board=${encodeURIComponent(board.board_name)}`);
              const stocksData = await stocksRes.json();
              return {
                ...board,
                business_names: stocksData.business_names || []
              };
            } catch {
              return { ...board, business_names: [] };
            }
          })
        );
        setBoardsSummary(boardsWithNames);
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

  const fetchSectorFundFlow = useCallback(async (sectorName?: string, periodDays?: number) => {
    if (!sectorFlowDate) return;
    setSectorFundFlowLoading(true);
    try {
      const targetDays = periodDays || sectorFlowPeriod;
      const params = new URLSearchParams({ date: sectorFlowDate, days: String(targetDays) });
      const targetSector = sectorName || selectedFlowSector;
      if (targetSector) params.set('sector', targetSector);
      const response = await fetch(`/api/board/sector_fund_flow?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '板块资金流数据加载失败');
      setSectorFundFlow(data);
      setSelectedFlowSector(data.selected_sector || '');
      setSectorFlowPeriod(data.requested_days || targetDays);
    } catch (error) {
      console.error('Failed to fetch sector fund flow:', error);
      setSectorFundFlow(null);
    } finally {
      setSectorFundFlowLoading(false);
    }
  }, [sectorFlowDate, selectedFlowSector, sectorFlowPeriod]);

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
    setActualTop10Loading(true);
    try {
      const cacheBuster = Date.now();
      const [enhancedRes, top10Res] = await Promise.all([
        fetch(`/api/board/enhanced_details?date=${selectedDate}&_=${cacheBuster}`, {
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
        }),
        fetch(`/api/board/top10?date=${selectedDate}`)
      ]);

      // 处理增强数据
      const enhancedData = await enhancedRes.json();
      if (enhancedRes.ok && enhancedData) {
        if (enhancedData.boards && Array.isArray(enhancedData.boards)) {
          let filteredBoards = enhancedData.boards.filter((board: EnhancedBoardScore) => board.total_score > 0);
          filteredBoards.sort((a: EnhancedBoardScore, b: EnhancedBoardScore) => b.total_score - a.total_score);
          filteredBoards.forEach((board: EnhancedBoardScore, idx: number) => { board.rank = idx + 1; });
          enhancedData.boards = filteredBoards;
        }
        setEnhancedData(enhancedData);
        message.success(`成功加载 ${selectedDate} 的增强版数据，共 ${enhancedData.boards.length} 个热点板块`);
      } else {
        message.error(enhancedData?.error || '数据加载失败');
        setEnhancedData(null);
      }

      // 处理top10数据
      if (top10Res.ok) {
        const top10Data = await top10Res.json();
        setActualTop10(top10Data);
      } else {
        console.error('获取实际涨幅top10失败');
        setActualTop10([]);
      }
    } catch (error) {
      console.error('Failed to fetch enhanced data:', error);
      message.error('数据加载失败，请检查网络连接');
      setEnhancedData(null);
      setActualTop10([]);
    } finally {
      setLoading(false);
      setActualTop10Loading(false);
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
    
    setStocksModalSource('sentiment');
    setStocksModalVisible(true);
    setCurrentBoard(board);
    setStocksLoading(true);
    setSelectedBusinessFilter(null);
    
    try {
      // 并行请求两个数据源：1.股票映射数据 2.增强版数据（包含核心板块）
      const [stocksRes, enhancedRes] = await Promise.all([
        fetch(`/api/sentiment/board_stocks?board=${encodeURIComponent(board)}`),
        fetch(`/api/board/enhanced_details?date=${selectedDate}`)
      ]);
      
      const stocksData = await stocksRes.json();
      const enhancedData = await enhancedRes.json();
      
      if (stocksRes.ok && !stocksData.error) {
        // 从增强版数据中获取当前板块的核心行业信息
        const currentBoardData = enhancedData.boards?.find((b: any) => b.board === board);
        const coreIndustries = currentBoardData?.core_industries || [];
        
        // 构建核心行业映射
        const coreMap = new Map();
        coreIndustries.forEach((ind: any) => {
          coreMap.set(ind.name, {
            name: ind.name,
            stock_count: ind.stock_count,
            heat_count: ind.heat_count,
            type: ind.type,
            source: 'core'
          });
        });
        
        // 获取映射表中的业务板块列表
        const mappedBusinessNames = stocksData.business_names || [];
        
        // 合并：先添加核心行业数据，再补充映射表中独有的
        const mergedBusinessMap = new Map(coreMap);
        
        // 添加映射表中独有的业务板块（不在核心行业中的）
        mappedBusinessNames.forEach((name: string) => {
          if (!mergedBusinessMap.has(name)) {
            const stockCount = stocksData.stocks?.filter((s: any) => s.business_display_name === name).length || 0;
            mergedBusinessMap.set(name, {
              name: name,
              stock_count: stockCount,
              heat_count: 0,
              type: 'fallback',
              source: 'mapping'
            });
          }
        });
        
        // 转换为数组并按 stock_count 降序排序
        const businessNamesWithStats = Array.from(mergedBusinessMap.values())
          .sort((a, b) => b.stock_count - a.stock_count);
        
        // 添加 AI 关注信息并保持排序
        const stocksWithAiInfo = (stocksData.stocks || []).map((stock: any) => ({
          ...stock,
          business_display_name: stock.business_display_name,
          business_display_names: stock.business_display_names,  // 新增
          business_codes: stock.business_codes,                  // 新增
          ai_focus: aiFocusStocks[stock.symbol] ? {
            is_focused: true,
            datestr: aiFocusStocks[stock.symbol].datestr,
            max_240_pct: aiFocusStocks[stock.symbol].max_240_pct,
            min_240_pct: aiFocusStocks[stock.symbol].min_240_pct,
            price_change: aiFocusStocks[stock.symbol].price_change
          } : { is_focused: false }
        }));
        
        // 保持原有排序：AI关注股票排前面，有价格变化的优先
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
          board_name: stocksData.board_name,
          keywords: stocksData.keywords || [],
          business_names: stocksData.business_names || [],
          business_names_with_stats: businessNamesWithStats,
          stocks: sortedStocks,
          stock_count: stocksData.stock_count || 0,
          mapping_count: stocksData.mapping_count || 0
        });
        
        message.success(`获取到 ${stocksData.stock_count || 0} 只相关股票`);
      } else {
        message.error(stocksData?.error || '获取股票信息失败');
      }
    } catch (error) {
      console.error('Failed to fetch stocks:', error);
      message.error('获取股票信息失败');
    } finally {
      setStocksLoading(false);
    }
  };

  // 获取申万二级板块成分股及截至资金实际日期的最近历史报警
  const fetchSectorFundFlowStocks = async (sectorName: string) => {
    if (!sectorName || !sectorFlowDate) {
      message.error('板块或资金日期无效');
      return;
    }

    setStocksModalSource('sw2');
    setStocksModalVisible(true);
    setCurrentBoard(sectorName);
    setStocksLoading(true);
    setSelectedBusinessFilter(null);
    setStocksData({
      board_name: sectorName,
      keywords: [],
      business_names: [],
      stocks: [],
      stock_count: 0,
      mapping_count: 0,
      requested_date: sectorFlowDate,
    });

    try {
      const params = new URLSearchParams({ sector: sectorName, date: sectorFlowDate });
      const response = await fetch(`/api/board/sector_fund_flow_stocks?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data?.error || '获取申万二级成分股失败');

      setStocksData({
        board_name: data.sector_name,
        keywords: [],
        business_names: data.business_names || [],
        stocks: data.stocks || [],
        stock_count: data.stock_count || 0,
        mapping_count: (data.business_names || []).length,
        requested_date: data.requested_date,
        as_of_date: data.as_of_date,
        history_alert_count: data.history_alert_count || 0,
        latest_record1_count: data.latest_record1_count || 0,
        latest_record2_count: data.latest_record2_count || 0,
        no_history_alert_count: data.no_history_alert_count || 0,
      });
    } catch (error) {
      console.error('Failed to fetch sector fund flow stocks:', error);
      message.error(error instanceof Error ? error.message : '获取申万二级成分股失败');
    } finally {
      setStocksLoading(false);
    }
  };

  const handleSectorFundFlowRankClick = (params: any, periodDays?: number) => {
    const sectorName = String(params?.name || '').trim();
    if (!sectorName) return;
    fetchSectorFundFlow(sectorName, periodDays);
    fetchSectorFundFlowStocks(sectorName);
  };

  // ========== 初始加载 ==========
  useEffect(() => {
    fetchAvailableDates();
    fetchSingleDayData();
    fetchEnhancedSingleDayData();
    fetchBoardsSummary();
    fetchAiFocusStocks();
  }, []);

  useEffect(() => {
    fetchSectorFundFlow();
  }, [sectorFlowDate]);

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

  const getStockFundTopRelations = (stock: StockInfo) => {
    if (!sectorFundFlow) return [];
    const businessNames = new Set(
      String(stock.all_business_display_names || stock.business_display_names || stock.business_display_name || '')
        .split('|')
        .filter(Boolean)
    );
    const relations: Array<{
      key: string;
      sectorName: string;
      scopeLabel: string;
      direction: 'inflow' | 'outflow';
      directionLabel: string;
    }> = [];
    const appendRelations = (
      rows: Array<{ sector_name: string }>,
      scopeLabel: string,
      direction: 'inflow' | 'outflow'
    ) => {
      rows.forEach((row) => {
        if (!businessNames.has(row.sector_name) || row.sector_name === stocksData.board_name) return;
        relations.push({
          key: `${scopeLabel}-${direction}-${row.sector_name}`,
          sectorName: row.sector_name,
          scopeLabel,
          direction,
          directionLabel: direction === 'inflow' ? 'TOP流入' : 'TOP流出',
        });
      });
    };

    appendRelations(sectorFundFlow.top_inflows, '当日', 'inflow');
    appendRelations(sectorFundFlow.top_outflows, '当日', 'outflow');
    appendRelations(sectorFundFlow.period_top_inflows, `${sectorFundFlow.requested_days}日`, 'inflow');
    appendRelations(sectorFundFlow.period_top_outflows, `${sectorFundFlow.requested_days}日`, 'outflow');
    return relations;
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
    // {
    //   title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>所属业务板块</span>,
    //   dataIndex: 'business_display_name',
    //   key: 'business_display_name',
    //   width: 200,
    //   render: (name: string) => (
    //     <Tag color="cyan" style={{ fontSize: 13, padding: '4px 10px' }}>{name || '-'}</Tag>
    //   ),
    // },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>{stocksModalSource === 'sw2' ? '其他资金TOP关联' : '所属业务板块'}</span>,
      dataIndex: 'business_display_name',
      key: 'business_display_name',
      width: stocksModalSource === 'sw2' ? 300 : 200,
      render: (_: any, record: StockInfo) => {
        if (stocksModalSource === 'sw2') {
          const topRelations = getStockFundTopRelations(record);
          if (topRelations.length === 0) {
            return <span style={{ color: '#bfbfbf', fontSize: 13 }}>暂无其他TOP关联</span>;
          }
          return (
            <Space wrap size={4}>
              {topRelations.map((relation) => (
                <Tooltip key={relation.key} title={`${relation.scopeLabel}${relation.directionLabel}：${relation.sectorName}`}>
                  <Tag
                    color={relation.direction === 'inflow' ? 'red' : 'green'}
                    style={{ fontSize: 12, padding: '2px 8px', margin: 0 }}
                  >
                    {relation.scopeLabel}·{relation.sectorName}
                  </Tag>
                </Tooltip>
              ))}
            </Space>
          );
        }

        // 如果有多个业务板块，显示多个 Tag
        if (record.business_display_names && record.business_display_names.includes('|')) {
          const businesses = record.business_display_names.split('|');
          return (
            <Space wrap size={4}>
              {businesses.slice(0, 3).map((biz, idx) => (
                <Tag key={idx} color="cyan" style={{ fontSize: 12, padding: '2px 8px' }}>
                  {biz}
                </Tag>
              ))}
              {businesses.length > 3 && (
                <Tooltip title={businesses.slice(3).join(', ')}>
                  <Tag color="default" style={{ fontSize: 12 }}>+{businesses.length - 3}</Tag>
                </Tooltip>
              )}
            </Space>
          );
        }
        return <Tag color="cyan" style={{ fontSize: 13, padding: '4px 10px' }}>{record.business_display_name || '-'}</Tag>;
      },
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>AI关注信息</span>,
      key: 'ai_info',
      width: 320,
      render: (_: any, record: StockInfo) => {
        if (stocksModalSource === 'sw2') {
          const latestAlert = record.ai_focus?.latest_alert;
          if (!record.ai_focus?.is_focused || !latestAlert) {
            return <Tag color="default" style={{ fontSize: 13, padding: '4px 10px' }}>历史无报警</Tag>;
          }

          const hasPriceChange = typeof latestAlert.price_change_pct === 'number';
          const priceChange = latestAlert.price_change_pct || 0;
          const priceColor = priceChange > 0 ? '#ff4d4f' : priceChange < 0 ? '#52c41a' : '#8c8c8c';
          const priceText = hasPriceChange ? `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%` : '涨跌幅暂无';
          const recordTagColor = latestAlert.record_type === 'Record1' ? 'orange' : 'purple';

          return (
            <div>
              <Space wrap size={4}>
                <Tooltip
                  title={
                    <div>
                      <div>报警价：{latestAlert.alert_price == null ? '暂无' : latestAlert.alert_price.toFixed(2)}</div>
                      <div>{latestAlert.as_of_date}价格：{latestAlert.as_of_price == null ? '暂无' : latestAlert.as_of_price.toFixed(2)}</div>
                    </div>
                  }
                >
                  <Tag color={recordTagColor} style={{ fontSize: 13, padding: '4px 10px' }}><RobotOutlined /> {latestAlert.record_type} 最近报警</Tag>
                </Tooltip>
                <Tag style={{ fontSize: 13, padding: '4px 10px', color: priceColor, borderColor: priceColor }}>{priceText}</Tag>
              </Space>
              <div style={{ marginTop: 4, fontSize: 12, color: '#595959' }}>报警日期：{latestAlert.datestr}</div>
              {latestAlert.alert_decision && <div style={{ marginTop: 2, fontSize: 12, color: latestAlert.record_type === 'Record1' ? '#ad6800' : '#531dab' }}>{latestAlert.alert_decision}</div>}
            </div>
          );
        }

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
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>排名</span>,
      key: 'rank',
      width: 70,
      render: (_: any, __: any, index: number) => {
        const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        const color = index < 3 ? medalColors[index] : '#999';
        return <span style={{ fontWeight: 700, fontSize: 16, color }}>{index + 1}</span>;
      },
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>板块</span>,
      dataIndex: 'board',
      key: 'board',
      width: 100,
      render: (board: string, record: EnhancedBoardScore) => (
        <Tooltip title={record.insight}>
          <Tag color={record.rank <= 3 ? 'gold' : 'blue'} style={{ fontSize: 14, fontWeight: 600, padding: '4px 12px', cursor: 'pointer' }}>
            {board}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>总分</span>,
      dataIndex: 'total_score',
      key: 'total_score',
      width: 90,
      sorter: (a: EnhancedBoardScore, b: EnhancedBoardScore) => a.total_score - b.total_score,
      render: (score: number) => <span style={{ fontWeight: 'bold', fontSize: 15, color: '#1890ff' }}>{score.toFixed(2)}</span>,
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>新闻分</span>,
      dataIndex: 'news_score',
      key: 'news_score',
      width: 90,
      render: (score: number) => <span style={{ fontSize: 14, color: '#52c41a', fontWeight: 500 }}>{score.toFixed(2)}</span>,
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>资金分</span>,
      dataIndex: 'fund_score',
      key: 'fund_score',
      width: 90,
      render: (score: number) => <span style={{ fontSize: 14, color: '#faad14', fontWeight: 500 }}>{score.toFixed(2)}</span>,
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>资金流向</span>,
      dataIndex: 'fund_inflow',
      key: 'fund_inflow',
      width: 120,
      render: (inflow: number) => {
        const isPositive = inflow > 0;
        const color = isPositive ? '#ff4d4f' : '#52c41a';
        const prefix = isPositive ? '↑' : '↓';
        return (
          <span style={{ color, fontWeight: 600, fontSize: 14 }}>
            {prefix} {Math.abs(inflow).toFixed(1)}亿
          </span>
        );
      },
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>🎯 核心板块</span>,
      key: 'core_industries',
      width: 400,
      render: (_: any, record: EnhancedBoardScore) => {
        let industries = (record as any).core_industries || [];
        
        if (industries.length === 0 && boardsSummary.length > 0) {
          const boardSummary = boardsSummary.find(b => b.board_name === record.board);
          if (boardSummary && boardSummary.business_names && boardSummary.business_names.length > 0) {
            industries = boardSummary.business_names.slice(0, 8).map((name, idx) => ({
              code: `fallback_${idx}`,
              name: name,
              type: 'fallback',
              stock_count: 0,
              avg_pct_30d: 0,
              heat_count: 0
            }));
          }
        }
        
        if (industries.length === 0) {
          return <span style={{ color: '#999', fontSize: 13 }}>-</span>;
        }
        
        const sw3Industries = industries.filter((i: any) => i.type === 'sw3_hy');
        const chgnIndustries = industries.filter((i: any) => i.type === 'ch_gn');
        const fallbackIndustries = industries.filter((i: any) => i.type === 'fallback');
        
        const getHeatIcon = (heatCount: number) => {
          if (heatCount >= 10) return '🔥🔥';
          if (heatCount >= 5) return '🔥';
          if (heatCount >= 1) return '📈';
          return null;
        };
        
        return (
          <div>
            {sw3Industries.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#666', marginRight: 8, fontWeight: 500 }}>📊 申万三级</span>
                <Space wrap size={6}>
                  {sw3Industries.map((ind: any) => {
                    const heatIcon = getHeatIcon(ind.heat_count);
                    return (
                      <Tooltip key={ind.code} title={`${ind.stock_count} 只股票 | 30日涨幅: ${ind.avg_pct_30d || 0}% | 热度: ${ind.heat_count || 0}`}>
                        <Tag color="gold" style={{ fontSize: 12, padding: '4px 10px', margin: '2px' }}>
                          {heatIcon && <span style={{ marginRight: 6 }}>{heatIcon}</span>}
                          <span style={{ fontWeight: 500 }}>{ind.name}</span>
                          <span style={{ fontSize: 11, marginLeft: 4, color: '#666' }}>({ind.stock_count})</span>
                          {ind.heat_count > 0 && (
                            <span style={{ color: '#faad14', marginLeft: 6, fontWeight: 'bold', fontSize: 12 }}>
                              +{ind.heat_count}
                            </span>
                          )}
                        </Tag>
                      </Tooltip>
                    );
                  })}
                </Space>
              </div>
            )}
            {chgnIndustries.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#666', marginRight: 8, fontWeight: 500 }}>🏷️ 同花顺概念</span>
                <Space wrap size={6}>
                  {chgnIndustries.map((ind: any) => {
                    const heatIcon = getHeatIcon(ind.heat_count);
                    return (
                      <Tooltip key={ind.code} title={`${ind.stock_count} 只股票 | 30日涨幅: ${ind.avg_pct_30d || 0}% | 热度: ${ind.heat_count || 0}`}>
                        <Tag color="blue" style={{ fontSize: 12, padding: '4px 10px', margin: '2px' }}>
                          {heatIcon && <span style={{ marginRight: 6 }}>{heatIcon}</span>}
                          <span style={{ fontWeight: 500 }}>{ind.name}</span>
                          <span style={{ fontSize: 11, marginLeft: 4, color: '#666' }}>({ind.stock_count})</span>
                          {ind.heat_count > 0 && (
                            <span style={{ color: '#faad14', marginLeft: 6, fontWeight: 'bold', fontSize: 12 }}>
                              +{ind.heat_count}
                            </span>
                          )}
                        </Tag>
                      </Tooltip>
                    );
                  })}
                </Space>
              </div>
            )}
            {fallbackIndustries.length > 0 && (
              <div>
                <span style={{ fontSize: 12, color: '#666', marginRight: 8, fontWeight: 500 }}>📋 业务板块</span>
                <Space wrap size={6}>
                  {fallbackIndustries.map((ind: any) => (
                    <Tag key={ind.code} color="purple" style={{ fontSize: 12, padding: '4px 10px', margin: '2px' }}>
                      {ind.name}
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
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>文章数</span>,
      dataIndex: 'article_count',
      key: 'article_count',
      width: 80,
      render: (count: number) => <span style={{ fontSize: 14 }}>{count}篇</span>,
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>解读</span>,
      dataIndex: 'insight',
      key: 'insight',
      width: 300,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ fontSize: 13, color: '#555' }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: <span style={{ fontSize: 14, fontWeight: 'bold' }}>操作</span>,
      key: 'action',
      width: 160,
      render: (_: any, record: EnhancedBoardScore) => (
        <Space size="small">
          <Button 
            type="link" 
            size="middle"
            icon={<FileTextOutlined />}
            style={{ fontSize: 13 }}
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
            size="middle"
            icon={<StockOutlined />}
            style={{ fontSize: 13 }}
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
    const isLargeDataset = names.length > 8;
    
    return {
      title: { 
        text: `${data.date} 增强版板块热度分布`, 
        left: 'center', 
        top: 0, 
        textStyle: { fontSize: 16, fontWeight: 'bold' } 
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['新闻分', '资金分'], top: 30, left: 'center', textStyle: { fontSize: 13 } },
      grid: { top: 80, bottom: 40, left: 80, right: 30, containLabel: true },
      xAxis: { 
        type: 'category', 
        data: names, 
        axisLabel: { 
          rotate: isLargeDataset ? 35 : 0,
          fontSize: 12, 
          fontWeight: 500,
          interval: isLargeDataset ? 0 : 0
        }
      },
      yAxis: { type: 'value', name: '得分', nameLocation: 'middle', nameGap: 45, nameTextStyle: { fontSize: 13 } },
      series: [
        { 
          name: '新闻分', 
          type: 'bar', 
          data: newsScores, 
          itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] }, 
          label: { show: true, position: 'top', fontSize: 12, fontWeight: 'bold' } 
        },
        { 
          name: '资金分', 
          type: 'bar', 
          data: fundScores, 
          itemStyle: { color: '#faad14', borderRadius: [4, 4, 0, 0] }, 
          label: { show: true, position: 'top', fontSize: 12, fontWeight: 'bold' } 
        }
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

  const getSectorFlowRankOption = (items: SectorFundFlowItem[], direction: 'inflow' | 'outflow') => {
    const rows = [...items].reverse();
    const color = direction === 'inflow' ? '#ff4d4f' : '#52c41a';
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => `${params[0].name}<br/>主力净${direction === 'inflow' ? '流入' : '流出'}：${Math.abs(params[0].value).toFixed(2)} 亿元`,
      },
      grid: { top: 8, bottom: 16, left: 90, right: 45, containLabel: true },
      xAxis: { type: 'value', axisLabel: { formatter: (value: number) => `${Math.abs(value)}亿` }, splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
      yAxis: { type: 'category', data: rows.map(row => row.sector_name), axisLabel: { fontSize: 13 }, axisTick: { show: false } },
      series: [{
        type: 'bar',
        data: rows.map(row => row.main_inflow_yi),
        itemStyle: { color, borderRadius: direction === 'inflow' ? [0, 4, 4, 0] : [4, 0, 0, 4] },
        label: { show: true, position: direction === 'inflow' ? 'right' : 'left', formatter: (params: any) => Math.abs(params.value).toFixed(1), fontSize: 12, color },
      }],
    };
  };

  const getSectorFlowPeriodRankOption = (items: SectorFundFlowPeriodRankItem[], direction: 'inflow' | 'outflow') => {
    const rows = [...items].reverse();
    const color = direction === 'inflow' ? '#ff4d4f' : '#52c41a';
    const valueKey = direction === 'inflow' ? 'period_net_inflow_yi' : 'period_net_outflow_yi';
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const row = rows.find(item => item.sector_name === params[0].name);
          if (!row) return params[0].name;
          return `${row.sector_name}<br/>累计流入：${row.period_inflow_yi.toFixed(2)} 亿元<br/>累计流出：${row.period_outflow_yi.toFixed(2)} 亿元<br/>${direction === 'inflow' ? '流入－流出' : '流出－流入'}：${row[valueKey].toFixed(2)} 亿元`;
        },
      },
      grid: { top: 8, bottom: 16, left: 90, right: 45, containLabel: true },
      xAxis: { type: 'value', min: 0, axisLabel: { formatter: (value: number) => `${value}亿` }, splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
      yAxis: { type: 'category', data: rows.map(row => row.sector_name), axisLabel: { fontSize: 13 }, axisTick: { show: false } },
      series: [{
        type: 'bar',
        data: rows.map(row => row[valueKey]),
        itemStyle: { color, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: (params: any) => Number(params.value).toFixed(1), fontSize: 12, color },
      }],
    };
  };

  const getSectorFlowTrendOption = (data: SectorFundFlowData) => ({
    tooltip: { trigger: 'axis', formatter: (params: any[]) => `${params[0].axisValue}<br/>主力净流向：${params[0].value > 0 ? '+' : ''}${Number(params[0].value).toFixed(2)} 亿元` },
    grid: { top: 20, bottom: 48, left: 65, right: 25, containLabel: true },
    xAxis: { type: 'category', data: data.trend.map(row => row.date), axisLabel: { rotate: 35, fontSize: 12 } },
    yAxis: { type: 'value', name: '亿元', splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } } },
    visualMap: { show: false, pieces: [{ gt: 0, color: '#ff4d4f' }, { lte: 0, color: '#52c41a' }] },
    series: [{
      type: 'bar',
      data: data.trend.map(row => row.main_inflow_yi),
      barMaxWidth: 24,
      markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#bfbfbf' }, label: { show: false } },
    }],
  });

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

  const currentDailyData = viewMode === 'enhanced' ? enhancedData : dailyData;

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 板块股票统计卡片 - 带资金流向标识 */}
      <Card 
        title={
          <Space>
            <StockOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            <span>板块股票统计（舆情映射）</span>
            <Tag color="red" style={{ fontSize: 11 }}>↑ 资金流入</Tag>
            <Tag color="green" style={{ fontSize: 11 }}>↓ 资金流出</Tag>
            <Tag color="blue" style={{ fontSize: 11 }}>● 无资金异动</Tag>
          </Space>
        }
        style={{ marginBottom: 20 }}
        extra={
          <Space>
            {otherBoards.length > 0 && (
              <Button 
                size="small" 
                onClick={() => setShowAllBoards(!showAllBoards)}
              >
                {showAllBoards ? '收起' : `展开全部 (${otherBoards.length}个)`}
              </Button>
            )}
            <Button icon={<ReloadOutlined />} size="small" onClick={fetchBoardsSummary} loading={summaryLoading}>刷新</Button>
          </Space>
        }
      >
        <Spin spinning={summaryLoading}>
          {/* 核心板块 */}
          <div style={{ marginBottom: showAllBoards && otherBoards.length > 0 ? 24 : 0 }}>
            <div style={{ marginBottom: 12, fontSize: 13, color: '#666', fontWeight: 500 }}>
              📌 核心板块 ({coreBoards.length})
            </div>
            <Row gutter={[16, 16]}>
              {coreBoards.map((board) => {
                const fundInflow = board.fund_inflow;
                const hasFundData = fundInflow !== undefined && fundInflow !== null;
                
                let borderColor = '#f0f0f0';
                let borderWidth = '1px';
                let headerBg = '#fff';
                let flowIcon = '●';
                let flowColor = '#999';
                let flowText = '0.0亿';
                
                if (hasFundData) {
                  if (fundInflow > 0) {
                    borderColor = '#ff4d4f';
                    borderWidth = '2px';
                    headerBg = '#fff1f0';
                    flowIcon = '↑';
                    flowColor = '#ff4d4f';
                    flowText = `${fundInflow.toFixed(1)}亿`;
                  } else if (fundInflow < 0) {
                    borderColor = '#52c41a';
                    borderWidth = '2px';
                    headerBg = '#f6ffed';
                    flowIcon = '↓';
                    flowColor = '#52c41a';
                    flowText = `${Math.abs(fundInflow).toFixed(1)}亿`;
                  }
                }
                
                return (
                  <Col xs={24} sm={12} md={8} lg={6} xl={4} key={board.board_name} style={{ marginBottom: 16 }}>
                    <Card 
                      size="small" 
                      hoverable 
                      onClick={() => fetchBoardStocks(board.board_name)} 
                      style={{ 
                        cursor: 'pointer',
                        borderColor: borderColor,
                        borderWidth: borderWidth,
                        borderStyle: 'solid',
                        transition: 'all 0.3s'
                      }}
                      bodyStyle={{ padding: '12px' }}
                    >
                      <div style={{ 
                        background: headerBg, 
                        margin: '-12px -12px 8px -12px', 
                        padding: '8px 12px',
                        borderRadius: '6px 6px 0 0'
                      }}>
                        <Tag color={hasFundData && fundInflow > 0 ? 'red' : (hasFundData && fundInflow < 0 ? 'green' : 'blue')} style={{ fontSize: 14, fontWeight: 600, padding: '4px 12px' }}>
                          {board.board_name}
                        </Tag>
                        <span style={{ float: 'right', color: flowColor, fontWeight: 600, fontSize: 13 }}>
                          {flowIcon} {flowText}
                        </span>
                      </div>
                      <Statistic 
                        value={board.stock_count} 
                        suffix="只股票" 
                        valueStyle={{ color: '#52c41a', fontSize: 20, fontWeight: 'bold' }} 
                      />
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                        关键词: {board.keyword_count}个 | 业务板块: {board.business_count}个
                      </div>
                      <Progress 
                        percent={Math.min((board.stock_count / 2000) * 100, 100)} 
                        size="small" 
                        showInfo={false} 
                        strokeColor={hasFundData && fundInflow > 0 ? '#ff4d4f' : (hasFundData && fundInflow < 0 ? '#52c41a' : '#1890ff')} 
                      />
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>

          {/* 其他板块（可折叠） */}
          {showAllBoards && otherBoards.length > 0 && (
            <div>
              <Divider style={{ margin: '8px 0 16px 0' }} />
              <div style={{ marginBottom: 12, fontSize: 13, color: '#666', fontWeight: 500 }}>
                📂 其他板块 ({otherBoards.length})
              </div>
              <Row gutter={[16, 16]}>
                {otherBoards.map((board) => {
                  const fundInflow = board.fund_inflow;
                  const hasFundData = fundInflow !== undefined && fundInflow !== null;
                  
                  let borderColor = '#f0f0f0';
                  let borderWidth = '1px';
                  let headerBg = '#fff';
                  let flowIcon = '●';
                  let flowColor = '#999';
                  let flowText = '0.0亿';
                  
                  if (hasFundData) {
                    if (fundInflow > 0) {
                      borderColor = '#ff4d4f';
                      borderWidth = '2px';
                      headerBg = '#fff1f0';
                      flowIcon = '↑';
                      flowColor = '#ff4d4f';
                      flowText = `${fundInflow.toFixed(1)}亿`;
                    } else if (fundInflow < 0) {
                      borderColor = '#52c41a';
                      borderWidth = '2px';
                      headerBg = '#f6ffed';
                      flowIcon = '↓';
                      flowColor = '#52c41a';
                      flowText = `${Math.abs(fundInflow).toFixed(1)}亿`;
                    }
                  }
                  
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} xl={4} key={board.board_name} style={{ marginBottom: 16 }}>
                      <Card 
                        size="small" 
                        hoverable 
                        onClick={() => fetchBoardStocks(board.board_name)} 
                        style={{ 
                          cursor: 'pointer',
                          borderColor: borderColor,
                          borderWidth: borderWidth,
                          borderStyle: 'solid',
                          transition: 'all 0.3s'
                        }}
                        bodyStyle={{ padding: '12px' }}
                      >
                        <div style={{ 
                          background: headerBg, 
                          margin: '-12px -12px 8px -12px', 
                          padding: '8px 12px',
                          borderRadius: '6px 6px 0 0'
                        }}>
                          <Tag color={hasFundData && fundInflow > 0 ? 'red' : (hasFundData && fundInflow < 0 ? 'green' : 'blue')} style={{ fontSize: 14, fontWeight: 600, padding: '4px 12px' }}>
                            {board.board_name}
                          </Tag>
                          <span style={{ float: 'right', color: flowColor, fontWeight: 600, fontSize: 13 }}>
                            {flowIcon} {flowText}
                          </span>
                        </div>
                        <Statistic 
                          value={board.stock_count} 
                          suffix="只股票" 
                          valueStyle={{ color: '#52c41a', fontSize: 20, fontWeight: 'bold' }} 
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                          关键词: {board.keyword_count}个 | 业务板块: {board.business_count}个
                        </div>
                        <Progress 
                          percent={Math.min((board.stock_count / 2000) * 100, 100)} 
                          size="small" 
                          showInfo={false} 
                          strokeColor={hasFundData && fundInflow > 0 ? '#ff4d4f' : (hasFundData && fundInflow < 0 ? '#52c41a' : '#1890ff')} 
                        />
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </div>
          )}
        </Spin>
      </Card>

      <Card
        title={<span><FundOutlined style={{ marginRight: 8, color: '#1890ff' }} />板块资金流向（申万二级）</span>}
        style={{ marginBottom: 20 }}
        extra={<Button icon={<ReloadOutlined />} size="small" onClick={() => fetchSectorFundFlow()} loading={sectorFundFlowLoading}>刷新</Button>}
      >
        <Space style={{ marginBottom: 12 }} wrap>
          <CalendarOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 600 }}>资金日期：</span>
          <DatePicker
            value={moment(sectorFlowDate)}
            format="YYYY-MM-DD"
            allowClear={false}
            disabledDate={(current) => current && current > moment().endOf('day')}
            onChange={(date) => {
              if (date) setSectorFlowDate(date.format('YYYY-MM-DD'));
            }}
          />
          <span style={{ color: '#8c8c8c' }}>下方三个部分共用该日期</span>
        </Space>
        <Spin spinning={sectorFundFlowLoading}>
          {sectorFundFlow ? (
            <>
              <div style={{ marginBottom: 14, color: '#595959' }}>
                查询日期 {sectorFundFlow.requested_date} ｜ 数据截至 <strong>{sectorFundFlow.as_of_date}</strong>
                {sectorFundFlow.as_of_date === moment().format('YYYY-MM-DD') && <Tag color="orange" style={{ marginLeft: 8 }}>当日数据可能随盘中更新</Tag>}
                <span style={{ marginLeft: 12, color: '#8c8c8c' }}>资金状态观察，不代表涨跌预测或交易建议</span>
              </div>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} md={6}><Statistic title="覆盖板块" value={sectorFundFlow.sector_count} suffix="个" /></Col>
                <Col xs={12} md={6}><Statistic title="净流入板块" value={sectorFundFlow.inflow_count} suffix="个" valueStyle={{ color: '#ff4d4f' }} /></Col>
                <Col xs={12} md={6}><Statistic title="净流出板块" value={sectorFundFlow.outflow_count} suffix="个" valueStyle={{ color: '#52c41a' }} /></Col>
                <Col xs={12} md={6}><Statistic title="全行业合计净流向" value={sectorFundFlow.total_net_inflow_yi} precision={2} suffix="亿元" valueStyle={{ color: sectorFundFlow.total_net_inflow_yi >= 0 ? '#ff4d4f' : '#52c41a' }} /></Col>
              </Row>
              <Row gutter={[20, 16]}>
                <Col xs={24} lg={12}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#cf1322' }}>主力净流入 TOP10</div>
                  <ReactEcharts option={getSectorFlowRankOption(sectorFundFlow.top_inflows, 'inflow')} style={{ height: 350 }} opts={{ renderer: 'canvas' }} onEvents={{ click: (params: any) => handleSectorFundFlowRankClick(params) }} />
                </Col>
                <Col xs={24} lg={12}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#389e0d' }}>主力净流出 TOP10</div>
                  <ReactEcharts option={getSectorFlowRankOption(sectorFundFlow.top_outflows, 'outflow')} style={{ height: 350 }} opts={{ renderer: 'canvas' }} onEvents={{ click: (params: any) => handleSectorFundFlowRankClick(params) }} />
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0 16px' }} />
              <Space style={{ marginBottom: 8 }} wrap>
                <span style={{ fontSize: 15, fontWeight: 600 }}>区间资金净流向 TOP5：</span>
                <Button.Group>
                  {[7, 14, 30, 60, 90].map(days => (
                    <Button
                      key={days}
                      type={sectorFlowPeriod === days ? 'primary' : 'default'}
                      onClick={() => fetchSectorFundFlow(selectedFlowSector, days)}
                      loading={sectorFundFlowLoading && sectorFlowPeriod === days}
                    >
                      {days}日
                    </Button>
                  ))}
                </Button.Group>
                <span style={{ color: '#8c8c8c' }}>
                  实际覆盖 {sectorFundFlow.ranking_covered_days} / {sectorFundFlow.requested_days} 个有效交易日
                </span>
              </Space>
              <Row gutter={[20, 16]}>
                <Col xs={24} lg={12}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#cf1322' }}>{sectorFundFlow.requested_days}日 流入－流出 TOP5</div>
                  {sectorFundFlow.period_top_inflows.length > 0 ? (
                    <ReactEcharts option={getSectorFlowPeriodRankOption(sectorFundFlow.period_top_inflows, 'inflow')} style={{ height: 250 }} opts={{ renderer: 'canvas' }} onEvents={{ click: (params: any) => handleSectorFundFlowRankClick(params, sectorFlowPeriod) }} />
                  ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="区间内暂无净流入板块" />}
                </Col>
                <Col xs={24} lg={12}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#389e0d' }}>{sectorFundFlow.requested_days}日 流出－流入 TOP5</div>
                  {sectorFundFlow.period_top_outflows.length > 0 ? (
                    <ReactEcharts option={getSectorFlowPeriodRankOption(sectorFundFlow.period_top_outflows, 'outflow')} style={{ height: 250 }} opts={{ renderer: 'canvas' }} onEvents={{ click: (params: any) => handleSectorFundFlowRankClick(params, sectorFlowPeriod) }} />
                  ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="区间内暂无净流出板块" />}
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0 16px' }} />
              <Space style={{ marginBottom: 8 }} wrap>
                <span style={{ fontSize: 15, fontWeight: 600 }}>板块近期资金趋势：</span>
                <Select
                  showSearch
                  value={selectedFlowSector || undefined}
                  style={{ width: 220 }}
                  optionFilterProp="label"
                  options={sectorFundFlow.sectors.map(row => ({ value: row.sector_name, label: row.sector_name }))}
                  onChange={(value) => fetchSectorFundFlow(value)}
                />
                <span style={{ color: '#8c8c8c' }}>跟随上方 {sectorFundFlow.requested_days} 日区间；点击任一排名柱形可查看成分股，并同步切换趋势板块</span>
              </Space>
              <Row gutter={[16, 12]} style={{ marginTop: 8, marginBottom: 4 }}>
                <Col xs={12} md={6}><Statistic title="实际覆盖" value={sectorFundFlow.covered_days} suffix={`/ ${sectorFundFlow.requested_days} 个交易日`} /></Col>
                <Col xs={12} md={6}><Statistic title="区间累计流入" value={sectorFundFlow.period_inflow_yi} precision={2} suffix="亿元" valueStyle={{ color: '#ff4d4f' }} /></Col>
                <Col xs={12} md={6}><Statistic title="区间累计流出" value={sectorFundFlow.period_outflow_yi} precision={2} suffix="亿元" valueStyle={{ color: '#52c41a' }} /></Col>
                <Col xs={12} md={6}><Statistic title="区间净流向" value={sectorFundFlow.period_net_inflow_yi} precision={2} suffix="亿元" valueStyle={{ color: sectorFundFlow.period_net_inflow_yi >= 0 ? '#ff4d4f' : '#52c41a' }} /></Col>
              </Row>
              <ReactEcharts option={getSectorFlowTrendOption(sectorFundFlow)} style={{ height: 280 }} opts={{ renderer: 'canvas' }} />
            </>
          ) : (
            !sectorFundFlowLoading && <Empty description="所选日期之前暂无板块资金流数据" />
          )}
        </Spin>
      </Card>

      {/* 查询面板 */}
      <Card title={<span><HistoryOutlined style={{ marginRight: 8, color: '#1890ff' }} />板块历史数据查询</span>} bordered={false}>
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
                {viewMode === 'enhanced' && (
                  <Card
                    title={<span><RiseOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />实际涨幅 TOP10（市值加权）</span>}
                    size="small"
                    style={{ marginTop: 16 }}
                    loading={actualTop10Loading}
                  >
                    {actualTop10.length > 0 ? (
                      <Table
                        dataSource={actualTop10}
                        rowKey="board_name"
                        size="small"
                        pagination={false}
                        columns={[
                          { 
                            title: '排名', 
                            key: 'rank', 
                            width: 60,
                            render: (_: any, __: any, idx: number) => {
                              const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
                              return <span style={{ fontWeight: 'bold', color: idx < 3 ? colors[idx] : '#999' }}>{idx + 1}</span>;
                            }
                          },
                          { title: '板块', dataIndex: 'board_name', key: 'board_name', width: 120 },
                          { 
                            title: '涨跌幅', 
                            dataIndex: 'weighted_avg_change', 
                            key: 'weighted_avg_change', 
                            width: 100,
                            render: (val: number) => (
                              <span style={{ color: val >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>
                                {val > 0 ? `+${val.toFixed(2)}%` : `${val.toFixed(2)}%`}
                              </span>
                            )
                          },
                          { title: '成分股数', dataIndex: 'stock_count', key: 'stock_count', width: 80 }
                        ]}
                        scroll={{ x: 400 }}
                      />
                    ) : (
                      !actualTop10Loading && <Empty description="暂无实际涨幅数据" />
                    )}
                  </Card>
                )}
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

        {queryType === 'single' && !currentDailyData && !loading && (
          <Card style={{ marginTop: 20, textAlign: 'center', padding: 50 }}>
            <HistoryOutlined style={{ fontSize: 48, color: '#ccc' }} />
            <div style={{ marginTop: 16, color: '#999' }}>暂无 {selectedDate} 的数据，请尝试其他日期</div>
          </Card>
        )}
      </Spin>

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

      {/* 优化后的股票列表弹窗 */}
      <Modal
        title={
          <span style={{ fontSize: 18 }}>
            <StockOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            {stocksData.board_name} 板块 - {stocksModalSource === 'sw2' ? '申万二级成分股' : '相关股票（舆情映射）'}
          </span>
        }
        visible={stocksModalVisible}
        onCancel={() => {
          setStocksModalVisible(false);
          setSelectedBusinessFilter(null);
        }}
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
                    {stocksModalSource === 'sw2' ? (
                      <Row gutter={[16, 12]}>
                        <Col xs={12} md={4}><Statistic title="板块名称" value={stocksData.board_name} valueStyle={{ fontSize: 17, fontWeight: 'bold', color: '#1890ff' }} /></Col>
                        <Col xs={12} md={4}><Statistic title="资金实际日期" value={stocksData.as_of_date || '-'} valueStyle={{ fontSize: 17, fontWeight: 'bold' }} /></Col>
                        <Col xs={12} md={4}><Statistic title="股票总数" value={stocksData.stock_count} valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }} /></Col>
                        <Col xs={12} md={4}><Statistic title="历史曾报警" value={stocksData.history_alert_count || 0} valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#fa541c' }} prefix={<RobotOutlined style={{ fontSize: 18 }} />} /></Col>
                        <Col xs={12} md={4}><Statistic title="最近报警 R1 / R2" value={`${stocksData.latest_record1_count || 0} / ${stocksData.latest_record2_count || 0}`} valueStyle={{ fontSize: 18, fontWeight: 'bold', color: '#722ed1' }} /></Col>
                        <Col xs={12} md={4}><Statistic title="历史无报警" value={stocksData.no_history_alert_count || 0} valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#8c8c8c' }} /></Col>
                      </Row>
                    ) : (
                      <Row gutter={16}>
                        <Col span={6}><Statistic title="板块名称" value={stocksData.board_name} valueStyle={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }} /></Col>
                        <Col span={6}><Statistic title="股票总数" value={stocksData.stock_count} valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }} /></Col>
                        <Col span={6}><Statistic title="AI关注股票" value={stocksData.stocks.filter(s => s.ai_focus?.is_focused).length} valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }} prefix={<RobotOutlined style={{ fontSize: 18 }} />} /></Col>
                        <Col span={6}><Statistic title="映射业务板块数" value={stocksData.business_names.length} valueStyle={{ fontSize: 18 }} /></Col>
                      </Row>
                    )}
                  </Card>
                </Col>
              </Row>
              
              {stocksModalSource === 'sentiment' && (
                <>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <Card size="small" title="相关关键词">
                        <div style={{ maxHeight: 80, overflowY: 'auto' }}>
                          {stocksData.keywords.map(kw => <Tag key={kw} color="cyan" style={{ marginBottom: 4, fontSize: 13, padding: '4px 10px' }}>{kw}</Tag>)}
                        </div>
                      </Card>
                    </Col>
                    <Col span={12}>
                    </Col>
                  </Row>

                  <Card
                    size="small"
                    title={
                      <Space>
                        🎯 核心业务板块
                        <Tag color="purple">点击可过滤股票</Tag>
                        {selectedBusinessFilter && (
                          <Tag 
                            color="blue" 
                            closable 
                            onClose={clearBusinessFilter}
                            icon={<FilterOutlined />}
                          >
                            当前过滤: {selectedBusinessFilter} ({filteredStocks.length})
                          </Tag>
                        )}
                      </Space>
                    }
                  >
                    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                      {(stocksData as any).business_names_with_stats?.map((item: any) => {
                        const stockCount = stocksData.stocks.filter(s => s.business_display_name === item.name).length;
                        const isActive = selectedBusinessFilter === item.name;
                        
                        const getHeatIcon = (heatCount: number) => {
                          if (heatCount >= 10) return '🔥🔥';
                          if (heatCount >= 5) return '🔥';
                          if (heatCount >= 1) return '📈';
                          return null;
                        };
                        
                        const heatIcon = getHeatIcon(item.heat_count);
                        
                        // 根据类型选择颜色
                        let tagColor = 'purple';
                        if (item.type === 'sw3_hy') tagColor = 'gold';
                        else if (item.type === 'ch_gn') tagColor = 'blue';
                        else if (item.type === 'fallback') tagColor = 'purple';
                        
                        return (
                          <Tooltip 
                            key={item.name} 
                            title={`${item.name} - ${item.stock_count} 只股票${item.heat_count > 0 ? ` | 热度: +${item.heat_count}` : ''}`}
                          >
                            <Tag 
                              color={isActive ? 'gold' : tagColor} 
                              style={{ 
                                fontSize: 12, 
                                padding: '4px 10px', 
                                margin: '2px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                opacity: selectedBusinessFilter && !isActive ? 0.5 : 1,
                                border: isActive ? '2px solid #faad14' : 'none',
                                fontWeight: isActive ? 'bold' : 'normal'
                              }}
                              onClick={() => {
                                if (selectedBusinessFilter === item.name) {
                                  setSelectedBusinessFilter(null);
                                } else {
                                  setSelectedBusinessFilter(item.name);
                                }
                              }}
                            >
                              {heatIcon && <span style={{ marginRight: 4 }}>{heatIcon}</span>}
                              <span>{item.name}</span>
                              <span style={{ fontSize: 11, marginLeft: 4, color: '#666' }}>({item.stock_count})</span>
                              {item.heat_count > 0 && (
                                <span style={{ color: '#faad14', marginLeft: 6, fontWeight: 'bold', fontSize: 12 }}>
                                  +{item.heat_count}
                                </span>
                              )}
                            </Tag>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </Card>
                </>
              )}
        
              <Divider orientation="left" style={{ margin: '8px 0', fontSize: 15 }}>
                <Space>
                  <span style={{ fontSize: 15, fontWeight: 'bold' }}>股票列表</span>
                  <Tag color="blue">总股票: {filteredStocks.length}</Tag>
                  {selectedBusinessFilter && (
                    <Tag color="gold" icon={<FilterOutlined />} closable onClose={clearBusinessFilter}>
                      筛选: {selectedBusinessFilter}
                    </Tag>
                  )}
                  <Tag color="cyan"><RobotOutlined /> {stocksModalSource === 'sw2' ? '历史曾报警' : 'AI关注'}: {filteredStocks.filter(s => s.ai_focus?.is_focused).length}</Tag>
                </Space>
              </Divider>
              
              <Table
                dataSource={filteredStocks}
                columns={stockColumns}
                rowKey="symbol"
                size="middle"
                pagination={{ 
                  pageSize: 100, 
                  showSizeChanger: true, 
                  showTotal: (total) => <span>共 {total} 只股票</span>, 
                  pageSizeOptions: ['50', '100', '200', '500'] 
                }}
                scroll={{ y: 'calc(100vh - 500px)' }}
              />
            </>
          ) : (!stocksLoading && (
            <Empty
              description={
                stocksModalSource === 'sw2'
                  ? `暂无 ${stocksData.board_name} 板块的申万二级成分股数据`
                  : <span>暂无 {stocksData.board_name} 板块的相关股票数据<br /><span style={{ fontSize: 12, color: '#999' }}>请确认舆情映射配置是否正确</span></span>
              }
            />
          ))}
        </Spin>
      </Modal>
    </div>
  );
};

export default BoardHistory;
