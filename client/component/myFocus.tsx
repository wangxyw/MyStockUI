import {
  Table,
  Form,
  Input,
  Popconfirm,
  Tag,
  Dropdown,
  Menu,
  Button,
} from 'antd';
import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import { FormInstance } from 'antd/lib/form';
import { get, post } from '../lib';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ConsoleSqlOutlined,
} from '@ant-design/icons';
import { caculateAfterDate, caculateDate, today } from './alarm';
import { StockChartsButton } from './StockChartsButton';

export const focusStatusMap = {
  '1': {
    name: '下跌中-1',
    color: 'blue',
  },
  '2': {
    name: '未到买点-2',
    color: 'yellow',
  },
  '3': {
    name: '已到买点-3',
    color: 'green',
  },
  '4': {
    name: '买点已过-4',
    color: 'grey',
  },
};

async function getAllFocusedStocks(page = 1, pageSize = 50, sortByDate = false, dateSortOrder = 'DESC') {
  let url = `/api/all_focus_stock?page=${page}&pageSize=${pageSize}`;
  if (sortByDate) {
    url += `&sortByDate=true&dateSortOrder=${dateSortOrder}`;
  }
  const response = await get(url);

  if (response.data && response.data.length > 0 && response.data[0].maxPriceDiff === undefined) {
    const symbols = response.data.map(d => d.symbol);
    const stockPriceByDay = await post(`/api/get_price_from_common_data`, {
      body: JSON.stringify({
        stocks: symbols.map(i => `'${i}'`).join(',')
      }),
    });
    const calculatedData = caculatePriceData(
      response.data,
      stockPriceByDay,
      '不限'
    );
    const dataWithRecentTen = calculatedData.map((item, index) => ({
      ...item,
      recentTen: response.data[index]?.recentTen || []
    }));
    return { data: dataWithRecentTen, total: response.total };
  }

  return response;
}

interface Item {
  key: string;
  name: string;
  age: string;
  address: string;
}
interface EditableRowProps {
  index: number;
}
export const caculateMaxPrice = (priceByDayData) => {
  let maxPrice = priceByDayData[0]?.finalprice;
  let maxPriceDay = 0;
  let maxPriceDate = priceByDayData[0]?.datestr;
  priceByDayData.forEach((i, k) => {
    if (i.finalprice && i.finalprice > maxPrice) {
      maxPrice = i.finalprice;
      maxPriceDay = k;
      maxPriceDate = i.datestr;
    }
  });
  return { maxPrice, maxPriceDay, maxPriceDate };
};
export const caculateMinVol = (priceByDayData) => {
  let minVol = priceByDayData[0]?.totaltradevol;
  let minVolDate = priceByDayData[0]?.datestr;
  let minVolDay = 0;
  priceByDayData.forEach((i, k) => {
    if (i.totaltradevol && i.totaltradevol < minVol) {
      minVol = i.totaltradevol;
      minVolDay = k;
      minVolDate = i.datestr;
    }
  });
  return { minVol, minVolDay, minVolDate };
};
export const caculateMaxVol = (priceByDayData) => {
  let maxVol = priceByDayData[0]?.totaltradevol;
  let maxVolDay = 0;
  let maxVolDate = priceByDayData[0]?.datestr;
  priceByDayData.forEach((i, k) => {
    if (i.totaltradevol && i.totaltradevol > maxVol) {
      maxVol = i.totaltradevol;
      maxVolDay = k;
      maxVolDate = i.datestr;
    }
  });
  return { maxVol, maxVolDay, maxVolDate };
};

export const caculateMinPrice = (priceByDayData) => {
  let minPrice = priceByDayData[0]?.finalprice;
  let minPriceDay = 0;
  let minPriceDate = priceByDayData[0]?.datestr;
  priceByDayData.forEach((i, k) => {
    if (i.finalprice && i.finalprice < minPrice) {
      minPrice = i.finalprice;
      minPriceDay = k;
      minPriceDate = i.datestr;
    }
  });
  return { minPrice, minPriceDay, minPriceDate };
};

export const caculatePriceData = (
  stockData,
  stockPriceByDay,
  timeWindow: any = 120,
  simulateDate: any = today
) => {
  const yesterday = caculateDate(simulateDate ?? today, 1);
  const priceData = stockData.map((i) => {
    const todayData =
      stockPriceByDay?.find(
        (e) => e.symbol === i.symbol && e.datestr === simulateDate
      ) ??
      stockPriceByDay?.find(
        (e) => e.symbol === i.symbol && e.datestr === yesterday
      );
    const priceByDayData = stockPriceByDay?.filter((e) => {
      let a = e.symbol === i.symbol && e.datestr >= i.datestr;
      if (timeWindow !== '不限') {
        a = a && e.datestr <= caculateAfterDate(i.datestr, timeWindow);
      }
      return a;
    });
    const before40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= i.datestr &&
        e.datestr > caculateDate(i.datestr, 60);
      return a;
    });
    const before20Cur = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= i.datestr &&
        e.datestr > caculateDate(i.datestr, 20);
      return a;
    });
    const { minPrice: minPrice40, minPriceDate: minPriceDate40 } =
      caculateMinPrice(before40);
    const before10inBefore40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= minPriceDate40 &&
        e.datestr > caculateDate(minPriceDate40, 10);
      return a;
    });
    const before20inBefore40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= minPriceDate40 &&
        e.datestr > caculateDate(minPriceDate40, 20);
      return a;
    });

    const { maxPrice: maxPrice40, maxPriceDate: maxPriceDate40 } =
      caculateMaxPrice(before10inBefore40);

    const { maxPrice: max20Price40, maxPriceDate: max20PriceDate40 } =
      caculateMaxPrice(before20inBefore40);

    const kBefore40 = ((maxPrice40 - minPrice40) / maxPrice40).toFixed(2);
    const k20Before40 = ((max20Price40 - minPrice40) / max20Price40).toFixed(2);

    const After40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr >= i.datestr &&
        e.datestr < caculateAfterDate(i.datestr, 40);
      return a;
    });
    const { maxPrice: maxPriceAfter40, maxPriceDate: maxPriceDateK1After40 } =
      caculateMaxPrice(After40);
    const before10inAfter40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr >= maxPriceDateK1After40 &&
        e.datestr < caculateAfterDate(maxPriceDateK1After40, 10);
      return a;
    });
    const before20inAfter40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr >= maxPriceDateK1After40 &&
        e.datestr < caculateAfterDate(maxPriceDateK1After40, 20);
      return a;
    });
    const { minPrice: minPriceAfter40, minPriceDate: minPriceDateK1After40 } =
      caculateMinPrice(before10inAfter40);
    const {
      minPrice: minPrice20After40,
      minPriceDate: minPrice20DateK1After40,
    } = caculateMinPrice(before20inAfter40);
    const k1After40 = (
      (maxPriceAfter40 - minPriceAfter40) /
      maxPriceAfter40
    ).toFixed(2);
    const k120After40 = (
      (minPrice20After40 - minPriceAfter40) /
      minPrice20After40
    ).toFixed(2);

    const { minPrice: minPriceK2After40, minPriceDate: minPriceDateK2After40 } =
      caculateMinPrice(After40);
    const before10inK2After40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= minPriceDateK2After40 &&
        e.datestr > caculateDate(minPriceDateK2After40, 10);
      return a;
    });
    const before20inK2After40 = stockPriceByDay?.filter((e) => {
      let a =
        e.symbol === i.symbol &&
        e.datestr <= minPriceDateK2After40 &&
        e.datestr > caculateDate(minPriceDateK2After40, 20);
      return a;
    });
    const { maxPrice: maxPriceK2After40, maxPriceDate: maxPriceDateK2After40 } =
      caculateMaxPrice(before10inK2After40);
    const {
      maxPrice: maxPrice20K2After40,
      maxPriceDate: maxPrice20DateK2After40,
    } = caculateMaxPrice(before20inK2After40);
    const k2After40 = (
      (maxPriceK2After40 - minPriceK2After40) /
      maxPriceK2After40
    ).toFixed(2);
    const k220After40 = (
      (maxPrice20K2After40 - minPriceK2After40) /
      maxPrice20K2After40
    ).toFixed(2);

    let kAfter40: any = k1After40 > k2After40 ? k1After40 : k2After40;
    let k20After40: any = k120After40 > k220After40 ? k120After40 : k220After40;
    let maxPriceDateAfter40 =
      k1After40 > k2After40 ? maxPriceDateK1After40 : maxPriceDateK2After40;
    const minPriceDateAfter40 =
      k1After40 > k2After40 ? minPriceDateK1After40 : minPriceDateK2After40;

    let maxPrice20DateAfter40 =
      k120After40 > k220After40
        ? minPrice20DateK1After40
        : maxPrice20DateK2After40;
    const minPrice20DateAfter40 =
      k120After40 > k220After40
        ? minPrice20DateK1After40
        : minPriceDateK2After40;

    if (maxPriceDateAfter40 <= i.datestr) {
      kAfter40 = null;
      maxPriceDateAfter40 = null;
    }
    const { maxPrice, maxPriceDay, maxPriceDate } =
      caculateMaxPrice(priceByDayData);
    const { minPrice, minPriceDay, minPriceDate } =
      caculateMinPrice(priceByDayData);
    const { minVol, minVolDay, minVolDate } = caculateMinVol(priceByDayData);
    const { minVol: minVolIn20, minVolDate: minVolDateIn20 } =
      caculateMinVol(before20Cur);
    const { maxVol: maxVolIn20, maxVolDate: maxVolDateIn20 } =
      caculateMaxVol(before20Cur);
    const oneStock = i;
    const maxPriceDiff = ((maxPrice - i.finalprice) / i.finalprice) * 100;
    const minPriceDiff = ((minPrice - i.finalprice) / i.finalprice) * 100;
    oneStock.firstMaxPrice = 1;
    oneStock.maxPrice = maxPrice;
    oneStock.minPrice = minPrice;
    oneStock.firstMaxPriceDay = 1;
    oneStock.maxPriceDay = maxPriceDay;
    oneStock.maxPriceDiff = maxPriceDiff.toFixed(2);
    oneStock.maxPriceDate = maxPriceDate;
    oneStock.minPriceDay = minPriceDay;
    oneStock.minPriceDiff = minPriceDiff.toFixed(2);
    oneStock.minPriceDate = minPriceDate;
    oneStock.minVolDay = minVolDay;
    oneStock.minVol = minVol;
    oneStock.minVolDate = minVolDate;

    oneStock.minVol20 = minVolIn20;
    oneStock.minVolDate20 = minVolDateIn20;
    oneStock.maxVol20 = maxVolIn20;
    oneStock.maxVolDate20 = maxVolDateIn20;

    oneStock.kBefore40 = kBefore40;
    oneStock.kBeforeMinDate = minPriceDate40;
    oneStock.kBeforeMaxDate = maxPriceDate40;
    oneStock.kAfter40 = kAfter40;
    oneStock.kAfterMinDate = minPriceDateAfter40;
    oneStock.kAfterMaxDate = maxPriceDateAfter40;

    oneStock.k20Before40 = k20Before40;
    oneStock.k20BeforeMinDate = minPriceDate40;
    oneStock.k20BeforeMaxDate = max20PriceDate40;
    oneStock.k20After40 = k20After40;
    oneStock.k20AfterMinDate = minPrice20DateAfter40;
    oneStock.k20AfterMaxDate = maxPrice20DateAfter40;

    oneStock.todayMgsy = JSON.parse(todayData?.var_props ?? '{}')?.zyzb?.mgsy;
    oneStock.todayPrice = todayData?.finalprice;

    return oneStock;
  });
  return priceData;
};

const EditableContext = React.createContext<FormInstance<any> | null>(null);

const EditableRow: React.FC<EditableRowProps> = ({ index, ...props }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

interface EditableCellProps {
  title: React.ReactNode;
  editable: boolean;
  children: React.ReactNode;
  dataIndex: keyof Item;
  record: Item;
  handleSave: (record: Item) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<Input>(null);
  const form = useContext(EditableContext)!;

  useEffect(() => {
    if (editing) {
      inputRef.current!.focus();
    }
  }, [editing]);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({ [dataIndex]: record[dataIndex] });
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      toggleEdit();
      handleSave({ ...record, ...values });
    } catch (errInfo) {
      console.log('Save failed:', errInfo);
    }
  };

  let childNode = children;

  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{ margin: 0 }}
        name={dataIndex}
        rules={[
          {
            required: true,
            message: `${title} is required.`,
          },
        ]}
      >
        <Input ref={inputRef} onPressEnter={save} onBlur={save} />
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap"
        style={{ paddingRight: 24 }}
        onClick={toggleEdit}
      >
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};

// ========== 批量行业信息 ==========
async function fetchBatchIndustry(symbols: string[]): Promise<Map<string, string>> {
  if (!symbols.length) return new Map();
  try {
    const stocksParam = symbols.map(s => `'${s}'`).join(',');
    const response = await post(`/api/boards_of_stock?stocks=${stocksParam}`, {});
    const industryMap = new Map<string, string>();
    (response as any[]).forEach(item => {
      if ((item.business_type === 'sw1_hy' || item.business_type === 'swhy') && item.symbol) {
        if (!industryMap.has(item.symbol)) {
          industryMap.set(item.symbol, item.name);
        }
      }
    });
    return industryMap;
  } catch (error) {
    console.error('批量获取行业信息失败', error);
    return new Map();
  }
}

const IndustryContext = React.createContext<{ industryMap: Map<string, string> }>({ industryMap: new Map() });

const StockIndustry: React.FC<{ symbol: string }> = ({ symbol }) => {
  const { industryMap } = useContext(IndustryContext);
  const industry = industryMap.get(symbol);
  if (industry) return <span>{industry}</span>;
  return <span>--</span>;
};

const strongCommentTags = [
  '超强信号',
  '强核心',
  '强信号',
  '强信号质量',
];

const observeCommentTags = [
  '中等筹码带+活跃承接',
  '盈利筹码回落蓄势',
  '次级观察',
  '观察',
];

const highRiskCommentTags = [
  '高换手低盈利承接弱',
  '低盈利未修复+观察高分',
  '低盈利+中等筹码带回撤',
  '低盈利+收盘承接弱',
  '近高位低盈利背离',
  '趋势空头+均换不足+筹码无修复',
  '低位低换弹性不足',
];

const mediumRiskCommentTags = [
  '低分+盈利无修复+短均走弱',
  '低换滞涨',
  '技术风险叠加',
  '均线全空弱势',
  '低流动弱趋势',
  '低位无承接空头',
];

const getRiskTagLevel = (tagText: string) => {
  if (!tagText.includes('风险')) return null;
  if (highRiskCommentTags.some((tag) => tagText.includes(tag))) return '高';
  if (mediumRiskCommentTags.some((tag) => tagText.includes(tag))) return '中';
  return '低';
};

const getRiskTagRank = (tagText: string) => {
  const level = getRiskTagLevel(tagText);
  if (level === '高') return 0;
  if (level === '中') return 1;
  if (level === '低') return 2;
  return 3;
};

const formatRiskTagText = (tagText: string) => {
  const level = getRiskTagLevel(tagText);
  return level ? `${level}｜${tagText}` : tagText;
};

const getPostAlertTagColor = (tagText: string) => {
  if (tagText.includes('后市层级:高质修复候选')) return 'volcano';
  if (tagText.includes('后市层级:高质修复')) return 'red';
  if (tagText.includes('后市层级:普通确认')) return 'red';
  if (tagText.includes('后市层级:谨慎跟踪')) return 'blue';
  if (tagText.startsWith('后市试:')) return 'red';
  if (tagText.startsWith('后市等:')) return 'blue';
  if (tagText.startsWith('后市慎:')) return 'orange';
  if (tagText.startsWith('后市避:')) return 'green';
  if (tagText.startsWith('后市接入:')) return 'red';
  if (tagText.startsWith('后市兑现:')) return 'orange';
  if (tagText.startsWith('后市排除:')) return 'green';
  if (tagText.startsWith('后市降权:')) return 'gold';
  if (tagText.includes('D4D7热扩确认') || tagText.includes('曾D4D7热扩确认') || tagText.includes('早期热扩确认')) return 'red';
  if (tagText.includes('D60强确认') || tagText.includes('曾D60强确认') || tagText.includes('后市:确认')) return 'red';
  if (tagText.includes('D30早期确认') || tagText.includes('曾D30早期确认')) return 'volcano';
  if (tagText.includes('D60降权') || tagText.includes('首次降权')) return 'gold';
  if (tagText.includes('D90放弃') || tagText.includes('从未确认已放弃') || tagText.includes('首次放弃') || tagText.includes('后市:放弃')) return 'green';
  if (tagText.includes('已大幅兑现') || tagText.includes('确认涨幅偏高') || tagText.includes('当前涨幅>') || tagText.includes('首次兑现')) return 'orange';
  if (tagText.includes('确认后转弱')) return 'gold';
  if (tagText.includes('继续观察') || tagText.includes('尚未确认') || tagText.includes('等待确认') || tagText.includes('后市:观察')) return 'blue';
  if (tagText.includes('后市变化') || tagText.includes('后市样本')) return 'geekblue';
  return undefined;
};

const parseHotAlphaTag = (tagText: string) => {
  if (!tagText.startsWith('HA:')) return null;
  const [layer = '', sector = '', score = '', rank = ''] = tagText.slice(3).split(',');
  return {
    layer,
    sector: sector || '热点板块',
    score,
    rank,
  };
};

const getHotAlphaTagsFromComments = (comments?: string) =>
  ((comments || '').match(/【HA:[^】]+】/g) || []).map((tag) => tag.slice(1, -1));

const parseProfitChipTag = (tagText: string) => {
  if (!tagText.startsWith('PC:')) return null;
  const [level = '', reason = '', code = ''] = tagText.slice(3).split(',');
  return {
    level,
    reason: reason || '筹码异动',
    code,
  };
};

const getProfitChipTagsFromComments = (comments?: string) =>
  ((comments || '').match(/【PC:[^】]+】/g) || []).map((tag) => tag.slice(1, -1));

const getCommentTagColor = (tagText: string) => {
  if (tagText.startsWith('HA:em80')) return 'magenta';
  if (tagText.startsWith('HA:em70q')) return 'purple';
  if (tagText.startsWith('HA:')) return 'geekblue';
  if (tagText.startsWith('PC:strong')) return 'volcano';
  if (tagText.startsWith('PC:moderate')) return 'cyan';
  if (tagText.startsWith('PC:')) return 'blue';
  if (tagText.includes('后市')) return getPostAlertTagColor(tagText);
  if (/^首次(D4D7|D60|D30|放弃|降权):/.test(tagText)) return getPostAlertTagColor(tagText);
  if (tagText.includes('序列确认:')) return 'red';
  if (tagText.includes('序列警戒:')) return 'gold';
  if (tagText.includes('低分修复:')) return 'geekblue';
  if (tagText.includes('低分观察:')) return 'blue';
  if (tagText.includes('短线观察:')) return 'orange';
  if (tagText.includes('短线:')) return 'volcano';
  if (tagText.includes('警戒:')) return 'gold';
  if (tagText.includes('风险')) return 'green';
  if (tagText.includes('回撤管理')) return 'green';
  if (strongCommentTags.some((tag) => tagText.includes(tag))) return 'red';
  if (observeCommentTags.some((tag) => tagText.includes(tag))) return 'blue';
  return undefined;
};

const formatCommentTagText = (tagText: string) => {
  const hotAlpha = parseHotAlphaTag(tagText);
  if (hotAlpha) {
    const scoreText = hotAlpha.score ? `｜${hotAlpha.score}` : '';
    const rankText = hotAlpha.rank ? `｜#${hotAlpha.rank}` : '';
    return `热｜${hotAlpha.layer}｜${hotAlpha.sector}${scoreText}${rankText}`;
  }
  const profitChip = parseProfitChipTag(tagText);
  if (profitChip) {
    const levelText = profitChip.level === 'strong' ? '强' : profitChip.level === 'moderate' ? '稳' : profitChip.level;
    const codeText = profitChip.code ? `｜${profitChip.code}` : '';
    return `筹｜${levelText}｜${profitChip.reason}${codeText}`;
  }
  if (tagText.includes('后市画像:')) return tagText.replace('后市画像:', '后｜');
  if (tagText.startsWith('后市试:')) return tagText.replace('后市试:', '后试｜');
  if (tagText.startsWith('后市等:')) return tagText.replace('后市等:', '后等｜');
  if (tagText.startsWith('后市慎:')) return tagText.replace('后市慎:', '后慎｜');
  if (tagText.startsWith('后市避:')) return tagText.replace('后市避:', '后避｜');
  if (tagText.startsWith('后市接入:')) return tagText.replace('后市接入:', '后接入｜');
  if (tagText.startsWith('后市兑现:')) return tagText.replace('后市兑现:', '后兑现｜');
  if (tagText.startsWith('后市排除:')) return tagText.replace('后市排除:', '后排除｜');
  if (tagText.startsWith('后市降权:')) return tagText.replace('后市降权:', '后降权｜');
  if (tagText.includes('后市层级:')) return tagText.replace('后市层级:', '层｜');
  if (tagText.includes('后市路径:')) return tagText.replace('后市路径:', '路｜');
  if (tagText.includes('后市:')) return tagText.replace('后市:', '后｜');
  if (/^首次(D60|D30|放弃|降权):/.test(tagText)) return tagText.replace(/^首次/, '首｜');
  if (tagText.includes('后市变化:')) return tagText.replace('后市变化:', '变｜');
  if (tagText.includes('后市样本:')) return tagText.replace('后市样本:', '样｜');
  if (/^(买|试|等|慎|避|跟踪)[:｜]/.test(tagText)) return tagText.replace(/^([买试等慎避]|跟踪):/, '$1｜');
  if (['强信号', '观察', '无效'].includes(tagText)) return tagText;
  if (tagText.startsWith('历史:')) return '史｜' + tagText;
  const riskText = formatRiskTagText(tagText);
  if (riskText !== tagText) return riskText;
  if (tagText.includes('回撤管理')) return `管｜${tagText}`;
  if (tagText.includes('序列确认:')) return `序确｜${tagText}`;
  if (tagText.includes('序列警戒:')) return `序警｜${tagText}`;
  if (tagText.includes('低分修复:')) return `修｜${tagText}`;
  if (tagText.includes('低分观察:')) return `低观｜${tagText}`;
  if (tagText.includes('短线观察:')) return `短观｜${tagText}`;
  if (tagText.includes('短线:')) return `短｜${tagText}`;
  if (tagText.includes('警戒:')) return `警｜${tagText}`;
  const color = getCommentTagColor(tagText);
  if (color === 'red') return `强｜${tagText}`;
  if (color === 'blue') return `观｜${tagText}`;
  if (tagText.includes('弱匹配')) return `弱｜${tagText}`;
  return tagText;
};

const getBestPickTagColor = (tagText: string) => {
  if (/^买[:｜]/.test(tagText)) return 'red';
  if (/^试[:｜]/.test(tagText)) return 'volcano';
  if (/^等[:｜]/.test(tagText)) return 'geekblue';
  if (/^跟踪[:｜]/.test(tagText)) return 'blue';
  if (/^慎[:｜]/.test(tagText)) return 'gold';
  if (/^避[:｜]/.test(tagText)) return 'green';
  return undefined;
};

const renderCommentTag = (
  tagText: string,
  key: string,
  options: { color?: string; fontWeight?: number; fontSize?: number } = {}
) => {
  const displayText = formatCommentTagText(tagText);
  return (
    <Tag
      key={key}
      color={options.color || getCommentTagColor(tagText)}
      title={tagText}
      style={{
        marginBottom: 4,
        fontWeight: options.fontWeight,
        fontSize: options.fontSize,
        lineHeight: options.fontSize ? '22px' : undefined,
      }}
    >
      {displayText}
    </Tag>
  );
};

const renderComments = (comments?: string) => {
  if (!comments) return null;

  const tagTexts = (comments.match(/【[^】]+】/g) || []).map((tag) =>
    tag.slice(1, -1)
  );
  const scoreTag = tagTexts.find((tag) => /^-?\d+(?:\.\d+)?$/.test(tag));
  const statusTag = tagTexts.find((tag) =>
    ['强信号', '观察', '无效'].includes(tag)
  );
  const decisionTag = tagTexts.find((tag) => /^(买|试|等|慎|避|跟踪)[:｜]/.test(tag));
  const hotAlphaTags = tagTexts.filter((tag) => tag.startsWith('HA:'));
  const profitChipTags = tagTexts.filter((tag) => tag.startsWith('PC:'));
  const factorTags = tagTexts.filter((tag) =>
    /^(C|T|P|R|E|M|DMI|MA|PA|PAR):/.test(tag)
  );
  const riskTags = tagTexts.filter((tag) => tag.includes('风险'));
  const sortedRiskTags = [...riskTags].sort(
    (a, b) => getRiskTagRank(a) - getRiskTagRank(b)
  );
  const signalTags = tagTexts.filter(
    (tag) =>
      tag !== scoreTag &&
      tag !== statusTag &&
      tag !== decisionTag &&
      !factorTags.includes(tag) &&
      !riskTags.includes(tag) &&
      !hotAlphaTags.includes(tag) &&
      !profitChipTags.includes(tag)
  );
  const bestPickTag = decisionTag;
  const leadingSignalTags = bestPickTag
    ? signalTags
    : [scoreTag, statusTag, ...signalTags].filter(Boolean) as string[];

  return (
    <div style={{ lineHeight: 1.6 }}>
      {bestPickTag && (
        <div>
        {bestPickTag &&
          renderCommentTag(bestPickTag, 'best-pick', {
            color: getBestPickTagColor(bestPickTag),
            fontWeight: 700,
          })}
        {scoreTag && (
          <span
            style={{
              color: '#222',
              fontWeight: 700,
              fontSize: 15,
              marginRight: 6,
            }}
          >
            {scoreTag}
          </span>
        )}
        {statusTag && renderCommentTag(statusTag, 'status', { fontWeight: 600 })}
        </div>
      )}
      {(hotAlphaTags.length > 0 || profitChipTags.length > 0 || riskTags.length > 0) && (
        <div>
          {hotAlphaTags.map((tag, index) =>
            renderCommentTag(tag, `hot-alpha-${index}`, { fontWeight: 700 })
          )}
          {profitChipTags.map((tag, index) =>
            renderCommentTag(tag, `profit-chip-${index}`, { fontWeight: 700 })
          )}
          {sortedRiskTags.map((tag, index) => renderCommentTag(tag, `risk-${index}`))}
        </div>
      )}
      {leadingSignalTags.length > 0 && (
        <div>
          {leadingSignalTags.map((tag, index) =>
            renderCommentTag(tag, `signal-${index}`)
          )}
        </div>
      )}
      {factorTags.length > 0 && (
        <div style={{ color: '#666', fontSize: 14, lineHeight: 1.7 }}>
          {factorTags.map((tag) => tag.replace(':', ' ')).join(' · ')}
        </div>
      )}
    </div>
  );
};

const commentsWithAlertDecision = (alertDecision?: string, comments?: string) =>
  `${alertDecision ? `【${alertDecision}】` : ''}${comments || ''}`;

const getPostAlertRiskTags = (comments?: string) =>
  ((comments || '').match(/【后市风险:[^】]+】/g) || []).map((tag) => tag.slice(1, -1));

const formatPortraitDate = (value?: string) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const getPostEntryTimingText = (record: any) => {
  const observeDate = formatPortraitDate(record?.post_alert_observe_date);
  const observeDays = record?.post_alert_observe_days;
  return getEntryTimingText(observeDate, observeDays);
};

const getBestEntryTimingText = (record: any) => {
  const observeDate = formatPortraitDate(record?.best_entry_observe_date);
  const observeDays = record?.best_entry_observe_days;
  return getEntryTimingText(observeDate, observeDays);
};

const getEntryTimingText = (observeDate: string, observeDays: any) => {
  const dayText = observeDays !== undefined && observeDays !== null && observeDays !== ''
    ? `报警后第${observeDays}天`
    : '';

  if (observeDate) {
    return `接入/观察日：${observeDate}${dayText ? `｜${dayText}` : ''}`;
  }
  return '暂无明确后市接入日';
};

const getTerminalSortTime = (record: any) => {
  const sortDate = record?.best_entry_observe_date || record?.datestr;
  return new Date(sortDate).getTime();
};

const getPostGroup = (decision?: string) => {
  const text = decision || '';
  if (!text) return '无后市';
  if (text.includes('后接入') || text.includes('D4D7')) return '优先接入';
  if (text.includes('降权') || text.includes('放弃') || text.includes('转弱')) return '后市转弱';
  if (text.includes('兑现') || text.includes('偏高')) return '已兑现/偏高';
  if (text.includes('确认')) return '确认跟踪';
  if (text.includes('继续观察') || text.includes('观察')) return '继续观察';
  return '其他后市';
};

const getCompressedState = (record: any) => {
  const decision = record?.alert_decision || '';
  const comments = record?.comments || '';
  const postGroup = getPostGroup(record?.post_alert_decision);
  const tagTexts = (comments.match(/【[^】]+】/g) || []).map((tag) => tag.slice(1, -1));
  const hotAlphaTags = getHotAlphaTagsFromComments(comments);
  const profitChipTags = getProfitChipTagsFromComments(comments);
  const hasHotAlphaEm80 = hotAlphaTags.some((tag) => tag.startsWith('HA:em80'));
  const hasHotAlpha = hotAlphaTags.length > 0;
  const hasProfitChipStrong = profitChipTags.some((tag) => tag.startsWith('PC:strong'));
  const statusTag = tagTexts.find((tag) => ['强信号', '观察', '无效'].includes(tag));
  const hasWarning = tagTexts.some((tag) => tag.includes('警戒:') || tag.includes('风险:'));
  const isPositive = /^(买|试|等|跟踪)[:｜]/.test(decision);
  const isCautious = /^(慎|避)[:｜]/.test(decision) || statusTag === '无效';

  if (postGroup === '优先接入') return { label: '优先接入', color: 'red', desc: '后市已给出接入/D4D7信号，是当前列表里应优先看的组合。' };
  if (postGroup === '后市转弱') return { label: '后市转弱', color: 'green', desc: '后市已进入降权/放弃/转弱，优先看风险处理。' };
  if (postGroup === '已兑现/偏高') return { label: '已兑现/偏高', color: 'orange', desc: '后市已有明显兑现或偏高，不等同于负面。' };
  if (postGroup === '确认跟踪' && ['强信号', '观察'].includes(statusTag || '')) return { label: '确认跟踪', color: 'red', desc: '后市已有确认信号，可继续跟踪主策略。' };
  if (hasHotAlphaEm80) return { label: '热点主线', color: 'magenta', desc: 'Hot Alpha em80 命中，说明该股已挂到高强度前瞻热点板块。' };
  if (hasHotAlpha) return { label: '热点增强', color: 'purple', desc: 'Hot Alpha em70q 命中，说明该股具备热点板块增强因子。' };
  if (/^等[:｜]/.test(decision) && hasProfitChipStrong) return { label: '筹码强修复', color: 'volcano', desc: '等策略叠加 PC strong。成熟样本中收益中位和回撤控制均明显优于等策略基准，适合提高人工观察优先级。' };
  if (isPositive && hasWarning) return { label: '观察有风险', color: 'gold', desc: '主策略仍成立，但后台存在警戒；优先级低于优先观察。' };
  if (isPositive && ['强信号', '观察'].includes(statusTag || '')) return { label: '优先观察', color: 'red', desc: '主策略正向且无核心警戒，观察池内优先。' };
  if (isCautious) return { label: '谨慎观望', color: 'blue', desc: '主策略偏谨慎或无效，默认不做积极解读。' };
  return { label: '低信息', color: 'default', desc: '标签组合未形成明确增益，建议只保留详情。' };
};

const renderCompressedPortrait = (record: any, rawComments: React.ReactNode) => {
  const state = getCompressedState(record);
  const decision =
    record?.alert_decision ||
    (record?.comments || '').match(/【((?:买|试|等|慎|避|跟踪)[:｜][^】]+)】/)?.[1];
  return (
    <div style={{ lineHeight: 1.7 }}>
      <div>
        {decision && renderCommentTag(decision, 'compressed-decision', {
          color: getBestPickTagColor(decision),
          fontWeight: 800,
          fontSize: 17,
        })}
        <Tag color={state.color} style={{ fontWeight: 700, fontSize: 15, lineHeight: '22px' }}>{state.label}</Tag>
      </div>
      <div style={{ color: '#666', fontSize: 13 }}>{state.desc}</div>
      <details open style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', color: '#999' }}>原始画像标签</summary>
        <div style={{ marginTop: 4 }}>{rawComments}</div>
      </details>
    </div>
  );
};

const renderCompressedPostAlert = (record: any, rawComments: React.ReactNode) => {
  const postGroup = getPostGroup(record?.post_alert_decision);
  const postRiskTags = getPostAlertRiskTags(record?.post_alert_comments);
  const timingText = getPostEntryTimingText(record);
  const colorMap = {
    '优先接入': 'red',
    '后市转弱': 'green',
    '已兑现/偏高': 'orange',
    '确认跟踪': 'red',
    '继续观察': 'blue',
    '无后市': 'default',
    '其他后市': 'default',
  };
  const descMap = {
    '优先接入': '后市接入/D4D7已确认，优先查看。',
    '后市转弱': '降权/放弃/转弱优先处理。',
    '已兑现/偏高': '收益已兑现或位置偏高。',
    '确认跟踪': '后市已有确认，可继续观察。',
    '继续观察': '仍处观察阶段，暂不扩展解读。',
    '无后市': '暂无后市画像。',
    '其他后市': '后市信息未归入核心状态。',
  };
  return (
    <div style={{ lineHeight: 1.7 }}>
      <Tag color={colorMap[postGroup]} style={{ fontWeight: 700 }}>{postGroup}</Tag>
      {postRiskTags.map((tag, index) =>
        renderCommentTag(tag, `compressed-post-risk-${index}`, { color: 'gold', fontWeight: 700 })
      )}
      <span style={{ color: '#666', fontSize: 13 }}>{descMap[postGroup]}</span>
      <div style={{ color: '#333', fontSize: 13, fontWeight: postGroup === '优先接入' ? 700 : 500 }}>
        {timingText}
      </div>
      <details open style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', color: '#999' }}>原始后市标签</summary>
        <div style={{ marginTop: 4 }}>{rawComments}</div>
      </details>
    </div>
  );
};

const hasActiveD4D7PostAlert = (record: any) => {
  const decision = record?.best_entry_decision || '';
  return (
    decision.includes('D4D7') &&
    !decision.startsWith('后避') &&
    !decision.startsWith('后慎') &&
    !decision.includes('降权') &&
    !decision.includes('放弃') &&
    !decision.includes('兑现') &&
    !decision.includes('转弱')
  );
};

const isRecord1MainStrategyCandidate = (record: any) => {
  const decision = record?.alert_decision || '';
  return (
    decision.startsWith('买｜低位修复') ||
    decision.startsWith('试｜急跌修复') ||
    decision.startsWith('试｜低分修复') ||
    decision.startsWith('跟踪｜热市修复') ||
    decision.startsWith('跟踪｜热市低位修复') ||
    decision.startsWith('跟踪｜转折型')
  );
};

const isRecord1ValidatedObserveCandidate = (record: any) => {
  const decision = record?.alert_decision || '';
  return (
    decision.startsWith('等｜弱势早期修复') ||
    decision.startsWith('等｜弱势修复') ||
    decision.startsWith('等｜低分序列修复') ||
    decision.startsWith('等｜低分超卖') ||
    decision.startsWith('等｜低分深回撤超卖') ||
    decision.startsWith('等｜深回撤超卖') ||
    decision.startsWith('等｜低分低换') ||
    decision.startsWith('等｜中分低换') ||
    decision.startsWith('等｜高换高位弹性') ||
    decision.startsWith('等｜小盘活跃修复') ||
    decision.startsWith('等｜序列中位修复') ||
    decision.startsWith('等｜缩量低换')
  );
};

const terminalHighlightStyle: Record<string, React.CSSProperties> = {
  best: {
    background: '#fff1f0',
    borderLeft: '4px solid #ff4d4f',
    borderRadius: 4,
    padding: '6px 8px',
  },
  observe: {
    background: '#e6f7ff',
    borderLeft: '4px solid #1890ff',
    borderRadius: 4,
    padding: '6px 8px',
  },
  late: {
    background: '#fff7e6',
    borderLeft: '4px solid #fa8c16',
    borderRadius: 4,
    padding: '6px 8px',
  },
};

const getTerminalHighlight = (record: any) => {
  const postDecision = record?.post_alert_decision || '';
  if (isRecord1MainStrategyCandidate(record) && hasActiveD4D7PostAlert(record)) {
    return { level: 'best', color: 'red', label: '主策略+后接入', desc: '主策略强，且曾给出后市接入/D4D7。', timing: getBestEntryTimingText(record) };
  }
  if (isRecord1ValidatedObserveCandidate(record) && hasActiveD4D7PostAlert(record)) {
    return { level: 'observe', color: 'blue', label: '观察机会+后接入', desc: '验证过的观察分支，且曾给出后市接入/D4D7。', timing: getBestEntryTimingText(record) };
  }
  if (postDecision.includes('兑现') || postDecision.includes('偏高')) {
    return { level: 'late', color: 'orange', label: '已兑现/偏高', desc: '不是坏票，但更偏接入偏晚或兑现提示。', timing: getPostEntryTimingText(record) };
  }
  return null;
};

const renderBestComboCell = (record: any, content: React.ReactNode) => {
  const highlight = getTerminalHighlight(record);
  return (
    <div style={highlight ? terminalHighlightStyle[highlight.level] : undefined}>
      {highlight && (
        <div style={{ marginBottom: 4 }}>
          <Tag color={highlight.color} style={{ fontWeight: 700 }}>{highlight.label}</Tag>
          <span style={{ color: '#666', fontSize: 13 }}>{highlight.desc}</span>
          <Tag color={highlight.color} style={{ fontWeight: 700, marginLeft: 4 }}>{highlight.timing}</Tag>
        </div>
      )}
      {content}
    </div>
  );
};

export const MyFocusListComponent = () => {
  const [data, setData] = useState([]);
  const [rateByCur, setRateByCur] = useState();
  const [rateByMax, setRateByMax] = useState();

  // 分页相关 state
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const pageSize = 100;

  // 日期排序相关 state
  const [sortByDate, setSortByDate] = useState(true);
  const [dateSortOrder, setDateSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // 行业信息状态
  const [industryMap, setIndustryMap] = useState<Map<string, string>>(new Map());

  const [selectStatus, setSelectStatus] = useState<any>(null);

  const handleAllStockData = useCallback(async (page = 1, sortDate?: boolean, order?: 'ASC' | 'DESC') => {
    setTableLoading(true);
    try {
      const shouldSortByDate = sortDate !== undefined ? sortDate : sortByDate;
      const currentOrder = order !== undefined ? order : dateSortOrder;
      
      const response = await getAllFocusedStocks(page, pageSize, shouldSortByDate, currentOrder);
      let stockData = response.data || [];

      // 前端兜底排序（当后端不支持排序或排序失效时）
      if (shouldSortByDate && stockData.length) {
        stockData = [...stockData].sort((a, b) => {
          const dateA = getTerminalSortTime(a);
          const dateB = getTerminalSortTime(b);
          return currentOrder === 'ASC' ? dateA - dateB : dateB - dateA;
        });
      }

      // 计算率
      const rateByCurVal = stockData?.filter(
        (i) =>
          (i.currentPrice >= i.finalprice && i.predict === 'Up') ||
          (i.currentPrice < i.finalprice && i.predict === 'Down')
      ).length;
      const rateByMaxVal = stockData?.filter(
        (i) =>
          (i.maxPriceDiff > 0 && i.predict === 'Up') ||
          (i.maxPriceDiff === 0 && i.predict === 'Down')
      )?.length;
      setRateByCur(`${rateByCurVal}/${stockData.length}` as any);
      setRateByMax(`${rateByMaxVal}/${stockData.length}` as any);
      setData(
        selectStatus
          ? stockData.filter(
              (i) =>
                i.focus_status === (selectStatus === '0' ? null : selectStatus)
            )
          : stockData
      );
      setTotal(response.total || 0);

      // 批量获取行业信息（不阻塞数据渲染）
      const symbols = stockData.map((item: any) => item.symbol);
      if (symbols.length) {
        fetchBatchIndustry(symbols).then(map => {
          setIndustryMap(prev => new Map([...prev, ...map]));
        });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setTableLoading(false);
    }
  }, [selectStatus, sortByDate, dateSortOrder, pageSize]);

  const handleDateSort = useCallback((order: 'ascend' | 'descend' | null) => {
    if (order === null) {
      setSortByDate(false);
      handleAllStockData(1, false, 'DESC');
    } else {
      const newOrder = order === 'ascend' ? 'ASC' : 'DESC';
      setSortByDate(true);
      setDateSortOrder(newOrder);
      handleAllStockData(1, true, newOrder);
    }
  }, [handleAllStockData]);

  const onClickMenu = (item, tableIndex, datestr) => {
    post('/api/edit_focus_status', {
      body: JSON.stringify({
        symbol: tableIndex,
        status: item.key,
        datestr: datestr,
      }),
    }).then(() => {
      if (item.key === '3') {
        post('/api/edit_focus_datestr', {
          body: JSON.stringify({
            symbol: tableIndex,
            status: item.key,
            datestr: datestr,
            newDatestr: caculateDate(today, 0),
          }),
        }).then((i) => {
          if (i.code) {
            alert(i.sqlMessage);
          }
          handleAllStockData(currentPage);
        });
      } else {
        handleAllStockData(currentPage);
      }
    });
  };

  const handleSave = useCallback((row: any) => {
    post('/api/edit_focus', {
      body: JSON.stringify({ symbol: row?.symbol, comments: row?.comments }),
    }).then(() => {
      handleAllStockData(currentPage);
    });
  }, [currentPage, handleAllStockData]);

  useEffect(() => {
    handleAllStockData(1);
  }, []);

  // 稳定 components
  const components = useMemo(() => ({
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  }), []);

  const columns = useMemo(() => [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (text, record) => {
        const end_date = record?.datestr;
        const predict = record?.predict;
        return (
          <div>
            <a
              target="_blank"
              href={`https://quote.eastmoney.com/${text}.html`}
            >
              {text}
              {caculateAfterDate(record.datestr, 60) < caculateDate(today, 0) &&
                '*'}
            </a>
            <br />
            <Tag>
              <a
                target="_blank"
                href={`http://${location.host}/alarm?symbol=${text}&datestr=${record.datestr}`}
              >
                {'Show alarm'}
              </a>
            </Tag>
            <br />
            <StockChartsButton symbol={text} name={record?.name} datestr={record?.datestr} />
            <br />
            <span style={{ color: 'red' }}>
              {predict === 'Up' ? 'UP' : ''}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (text, record) => {
        return (
          <span>
            {text}
            {caculateAfterDate(record.datestr, 60) < caculateDate(today, 0) &&
              '*'}
          </span>
        );
      },
    },
    // {
    //   title: 'PCA',
    //   dataIndex: 'profit_chip_analyze',
    //   key: 'profit_chip_analyze',
    //   render: (text) => {
    //     const valueMap = JSON.parse(text);
    //     return (
    //       <div>
    //         {Object.keys(valueMap).map((i) => {
    //             return (
    //               <p>{i}: {valueMap?.[i]}</p>
    //             );
    //         })}
    //       </div>
    //     );
    //   },
    // },    
    {
      title: 'Continuance BYG',
      dataIndex: 'continuance_BYG',
      key: 'continuance_BYG',
      width: 180,
      render: (c, record) => {
        const firstPart = c.split('|')[0]?.trim() || '';
        
        const numericMatch = firstPart.match(/-?\d+(\.\d+)?/);
        if (!numericMatch) return false;

        const isUp = parseFloat(numericMatch[0]) > 0;
        return (
          <>
            <span style={{ color: isUp ? 'red' : 'green' }}>{c}</span>
          </>
        );
      },      
    },
    {
      title: 'Comments',
      dataIndex: 'comments',
      key: 'comments',
      width: 1000,
      editable: false,
      render: (text, record) =>
        renderBestComboCell(
          record,
          renderCompressedPortrait(
            record,
            renderComments(text)
          )
        ),
    },
    {
      title: '后市画像',
      dataIndex: 'post_alert_comments',
      key: 'post_alert_comments',
      width: 620,
      editable: false,
      render: (text, record) =>
        renderBestComboCell(
          record,
          renderCompressedPostAlert(record, (
            <div>
            {record?.post_alert_decision ? renderComments(`【${record.post_alert_decision}】`) : null}
            {renderComments(text)}
            </div>
          ))
        ),
    },
    {
      title: 'Date',
      dataIndex: 'datestr',
      key: 'datestr',
      width: 120,
      sorter: true,
      sortOrder: sortByDate ? (dateSortOrder === 'ASC' ? 'ascend' : 'descend') : null,
      onHeaderCell: () => ({
        onClick: () => {
          if (!sortByDate || dateSortOrder === 'DESC') {
            handleDateSort('ascend');
          } else if (dateSortOrder === 'ASC') {
            handleDateSort('descend');
          } else {
            handleDateSort(null);
          }
        },
      }),
    },
    {
      title: 'last_updated_at',
      dataIndex: 'last_updated_at',
      key: 'last_updated_at',
      render:(c) => {
        const value = c?.split('T')?.[0];
        return (
            <p>{value}</p>
        );        
      },
    },
    {
      title: 'Recent 10 days',
      dataIndex: 'recentTen',
      key: 'recentTen',
      render: (c, record) => {
        const upA1 = c.filter(
          (i) => i.status === 'up' && i.alarmtype === 'A1'
        ).length;
        const upA2 = c.filter(
          (i) => i.status === 'up' && i.alarmtype === 'A2'
        ).length;
        const upA3 = c.filter(
          (i) => i.status === 'up' && i.alarmtype === 'A3'
        ).length;
        const upNA = c.filter(
          (i) =>
            i.status === 'up' && (i.alarmtype === '' || i.alarmtype === null)
        ).length;
        const downA1 = c.filter(
          (i) => i.status === 'down' && i.alarmtype === 'A1'
        ).length;
        const downA2 = c.filter(
          (i) => i.status === 'down' && i.alarmtype === 'A2'
        ).length;
        const downA3 = c.filter(
          (i) => i.status === 'down' && i.alarmtype === 'A3'
        ).length;
        const downNA = c.filter(
          (i) =>
            i.status === 'down' && (i.alarmtype === '' || i.alarmtype === null)
        ).length;
        return (
          <div>
            <table border="1">
              <thead>
                <tr>
                  <th>A1</th>
                  <th>A2</th>
                  <th>A3</th>
                  <th>NA</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f1b4b0' }}>
                  <td>{upA1}</td>
                  <td>{upA2}</td>
                  <td>{upA3}</td>
                  <td>{upNA}</td>
                </tr>
                <tr style={{ background: '#cbeba8' }}>
                  <td>{downA1}</td>
                  <td>{downA2}</td>
                  <td>{downA3}</td>
                  <td>{downNA}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      },
    },
    {
      title: '流通股本',
      dataIndex: 'circulation_stock',
      key: 'circulation_stock',
      render: (c, record) => {
        const re = (record.marketvalue / record.finalprice).toFixed(3);
        return <>{re}</>;
      },
    },
    {
        title: 'Industry',
        dataIndex: 'symbol',
        key: 'industry',
        width: 150,
        render: (symbol: string) => <StockIndustry symbol={symbol} />,
    },
    {
      title: 'MaxPrice',
      dataIndex: 'maxPrice',
      key: 'maxPrice',
      render: (c, record) => {
        const diff = record.maxPriceDiff;
        return (
          <Tag color={diff > 0 ? 'red' : 'green'}>
            {c}/ {diff + '%'}
          </Tag>
        );
      },
    },
    {
      title: 'MaxPriceDay',
      dataIndex: 'maxPriceDay',
      key: 'maxPriceDay',
    },
    {
      title: 'MinPrice',
      dataIndex: 'minPrice',
      key: 'minPrice',
      render: (c, record) => {
        const diff = record.minPriceDiff;
        return (
          <Tag color={diff > 0 ? 'red' : 'green'}>
            {c}/ {diff + '%'}
          </Tag>
        );
      },
    },
    {
      title: 'MinPriceDay',
      dataIndex: 'minPriceDay',
      key: 'minPriceDay',
    },
    // {
    //   title: 'Action',
    //   key: 'action',
    //   render: (text, record) => (
    //     <Popconfirm
    //       title="Sure to delete?"
    //       onConfirm={() => {
    //         post('/api/delete_focus', {
    //           body: JSON.stringify({
    //             symbol: record?.symbol,
    //             datestr: record?.datestr,
    //           }),
    //         }).then(() => {
    //           handleAllStockData(currentPage);
    //         });
    //       }}
    //     >
    //       <a>Delete</a>
    //     </Popconfirm>
    //   ),
    // },
  ], [sortByDate, dateSortOrder, handleDateSort, handleAllStockData, currentPage]);

  const mergedColumns = useMemo(() => 
    columns.map((col) => {
      if (!col.editable) return col;
      return {
        ...col,
        onCell: (record) => ({
          record,
          editable: col.editable,
          dataIndex: col.dataIndex,
          title: col.title,
          handleSave,
        }),
      };
    }),
    [columns, handleSave]
  );

  return (
    <IndustryContext.Provider value={{ industryMap }}>
      <div style={{ padding: '20px' }}>
        Filter By Status:
        <Dropdown
          overlay={
            <Menu onClick={(ob) => {
              setSelectStatus(ob.key);
              setCurrentPage(1);
              handleAllStockData(1);
            }}>
              {Object.keys(focusStatusMap)
                .map((i) => (
                  <Menu.Item key={i}>{focusStatusMap[i]?.name}</Menu.Item>
                ))
                .concat(<Menu.Item key={'0'}>{'未标注'}</Menu.Item>)}
            </Menu>
          }
        >
          <Tag color={focusStatusMap[selectStatus]?.color}>
            {selectStatus === '0'
              ? '未标注'
              : focusStatusMap[selectStatus]?.name || 'All'}
          </Tag>
        </Dropdown>
        <Table
          loading={tableLoading}
          pagination={{ 
            current: currentPage,
            total: total,
            pageSize: pageSize,
            onChange: (page) => {
              setCurrentPage(page);
              handleAllStockData(page);
            },
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          columns={mergedColumns}
          dataSource={data}
          components={components}
          rowKey="symbol"
        />
      </div>
    </IndustryContext.Provider>
  );
};
