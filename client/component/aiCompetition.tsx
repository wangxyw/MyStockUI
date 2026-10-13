import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Collapse, ConfigProvider, DatePicker, Empty, Input, Radio, Select, Space, Spin, Table, Tabs, Tag, Tooltip } from 'antd';
import { ReloadOutlined, TrophyOutlined } from '@ant-design/icons';
import moment from 'moment';
import datePickerZhCN from 'antd/es/date-picker/locale/zh_CN';
import { get } from '../lib';
import './aiCompetition.css';
import { sharedSelections } from './aiCompetitionShared';

const periodLabels: Record<string, string> = { day: '统计归属日期', month: '统计归属月份', quarter: '统计归属季度', year: '统计归属年份' };
const periodFormats: Record<string, string> = { month: 'YYYY年MM月', quarter: 'YYYY年第Q季度', year: 'YYYY年' };
const periodPickerLocale = { ...datePickerZhCN, lang: { ...datePickerZhCN.lang, monthFormat: 'M月', quarterFormat: '[第]Q[季度]' } };

const labels: Record<string, string> = { TP: '止盈', SL: '止损', TIME: '到期退出', OPEN: '跟踪中', PENDING_ENTRY: '待下一交易日', EXPIRED_UNFILLED: '限价未成交', EXPIRED_NO_PRICE: '有效日无行情', NO_ENTRY_PRICE: '无入场行情', NO_OPEN_PRICE: '缺少开盘价', INCOMPLETE_OHLC: '路径数据缺失', MISSING_TERMS: '条件缺失', UNSIZABLE: '不足一手', UNSUPPORTED_MODEL: '模型待接入' };
const reasons: Record<string, string> = { NOT_ARMED_WINDOW: '窗口未开', NOT_ARMED_CASH: '资金不足', NOT_ARMED_CAPACITY: '仓位已满', NOT_ARMED_EXISTING_SOURCE_OR_SYMBOL: '已有来源/持仓', HISTORICAL_EXECUTION_UNKNOWN: '缺少执行证据', ARMED: '已挂条件单', QUALIFIED: '符合条件，未挂单', FILLED: '已买入', EXPIRED_UNFILLED: '条件单过期' };
const format = (v: any, digits = 2) => v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(digits);
const percent = (v: any) => v === null || v === undefined ? '—' : `${Number(v) > 0 ? '+' : ''}${format(v)}%`;
const ReturnValue = ({ value }: { value: any }) => <span className={value > 0 ? 'ai-positive' : value < 0 ? 'ai-negative' : ''}>{percent(value)}</span>;
const OutcomeCell = ({ result }: { result: any }) => <Tooltip title={result.reason}>
  <div><Tag color={result.status === 'TP' ? 'red' : result.status === 'SL' ? 'green' : result.status === 'OPEN' ? 'blue' : 'default'}>{labels[result.status] || result.status}</Tag>
    <ReturnValue value={result.netReturnPct ?? result.markReturnPct} /></div>
  <div className="ai-sub">{result.exitDate || result.entryDate || '尚未入场'}{result.holdDays !== null ? ` · ${result.holdDays}交易日` : ''}{result.status === 'OPEN' ? ' · 浮动' : ''}</div>
</Tooltip>;

export default function AiCompetitionView(): JSX.Element {
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('competition'), [period, setPeriod] = useState('month'), [periodDate, setPeriodDate] = useState('');
  const [days, setDays] = useState(0), [refresh, setRefresh] = useState(0), [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all'), [listScope, setListScope] = useState('active'), [evalMode, setEvalMode] = useState('own');
  const [sharedFilter, setSharedFilter] = useState('all');
  const selectionEnd = scope === 'research' && data?.meta.asOf >= '2026-07-20' ? '2026-07-19' : data?.meta.asOf || '';
  const selectionStart = scope === 'competition' ? '2026-07-20' : '';
  const requestedAnchor = periodDate || data?.meta.periodDate || selectionEnd;
  const selectionDate = requestedAnchor > selectionEnd ? selectionEnd : requestedAnchor < selectionStart ? selectionStart : requestedAnchor;
  const changePeriod = (next: string) => { setPeriod(next); if (next !== 'all') setPeriodDate(selectionDate); };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const params = new URLSearchParams({ period, scope });
    if (periodDate && period !== 'all') params.set('period_date', periodDate);
    if (days) params.set('days', String(days));
    get(`/api/ai_competition?${params}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setData(result); setLoading(false); }
    }).catch(err => { if (!controller.signal.aborted) { setError(err.message || '数据暂不可用'); setLoading(false); } });
    return () => controller.abort();
  }, [scope, period, periodDate, days, refresh]);
  const shared = useMemo(() => sharedSelections(data?.teams || [], listScope), [data, listScope]);
  const sharedMap = useMemo(() => new Map(shared.map(stock => [stock.symbol, stock])), [shared]);
  const matchesTeams = (stock: any) => sharedFilter === 'all' ? true : sharedFilter === 'shared' ? stock?.teamCount >= 2 : stock?.teamCount === Number(sharedFilter);
  const filtered = useMemo(() => (data?.teams || []).map((team: any) => ({ ...team, rows: team.candidates.filter((r: any) => {
    const inView = listScope === 'archive' ? !r.visible : listScope === 'all' ? true : r.visible;
    const text = `${r.symbol} ${r.name} ${r.industry} ${r.ruleId}`.toLowerCase();
    const state = r[evalMode].status;
    return inView && matchesTeams(sharedMap.get(r.symbol)) && (!search || text.includes(search.toLowerCase())) && (outcomeFilter === 'all' || outcomeFilter === 'completed' && ['TP', 'SL', 'TIME'].includes(state) || outcomeFilter === 'open' && ['OPEN', 'PENDING_ENTRY'].includes(state) || state === outcomeFilter);
  }) })), [data, search, outcomeFilter, listScope, evalMode, sharedFilter, sharedMap]);
  const matchedSymbols = new Set(filtered.flatMap((team: any) => team.rows.map((r: any) => r.symbol)));
  const sharedRows = shared.filter(stock => matchedSymbols.has(stock.symbol));
  const SharedBadge = ({ stock, date }: { stock: any; date?: string }) => <><Tag color={stock?.teamCount === 3 ? 'purple' : stock?.teamCount === 2 ? 'blue' : 'default'}>{stock?.teamCount || 1}队选过</Tag>{date && stock?.sharedDates.find((d: any) => d.date === date) && <Tag color="cyan">同日{stock.sharedDates.find((d: any) => d.date === date).teams.length}队</Tag>}</>;
  const columns: any[] = [
    { title: '股票 / 团队共识', key: 'stock', width: 210, fixed: 'left', render: (_: any, r: any) => <div><strong>{r.name}</strong><div className="ai-sub">{r.symbol}</div><div><Tag>{r.family}</Tag></div><SharedBadge stock={sharedMap.get(r.symbol)} date={r.decisionDate} /></div> },
    { title: 'Industry', dataIndex: 'industry', width: 100, render: (v: string, r: any) => <Tooltip title={`行业口径：当前映射${r.industryAsOf ? `，记录于${r.industryAsOf}` : ''}`}>{v || '未映射'}</Tooltip> },
    { title: '选股日期 / 收盘价', key: 'decision', width: 155, sorter: (a: any, b: any) => a.decisionDate.localeCompare(b.decisionDate), render: (_: any, r: any) => <><strong>{r.decisionDate}</strong><div>¥{format(r.decisionPrice)}</div><Tag color={r.captureScope === 'RECONSTRUCTED' ? 'orange' : 'blue'}>{r.captureScope === 'RECONSTRUCTED' ? '历史重建' : r.captureScope === 'OBSERVED' ? '日结捕获' : '已记录候选'}</Tag></> },
    { title: '报警日期 / 收盘价', key: 'alert', width: 135, render: (_: any, r: any) => <Tooltip title={r.alertDateScope === 'CURRENT_SOURCE_LOOKUP' ? '报警日期由当前源补查，未作为历史快照记录' : r.alertDateScope === 'MISSING' ? '缺少可验证的报警日期' : '已记录的报警基准'}><div>{r.alertDate || '未记录'}<div>¥{format(r.alertPrice)}</div></div></Tooltip> },
    { title: '最新价 / 较报警涨跌', key: 'move', width: 155, sorter: (a: any, b: any) => (a.moveSinceAlertPct ?? -Infinity) - (b.moveSinceAlertPct ?? -Infinity), render: (_: any, r: any) => <><div>¥{format(r.currentPrice)} <ReturnValue value={r.moveSinceAlertPct} /></div><div className="ai-sub">行情 {r.currentPriceDate || '缺失'}</div><div className="ai-sub">较选股 <ReturnValue value={r.moveSinceSelectionPct} /></div></> },
    { title: '执行策略 · TP / SL / H', key: 'terms', width: 180, render: (_: any, r: any) => <><strong>{r.ruleId}</strong><div>TP {format(r.tp, 0)}% / SL {format(r.sl, 0)}%</div><div className="ai-sub">H {r.horizon ?? '—'}个股交易日 · 限价 ¥{format(r.limitPrice)}</div></> },
    { title: '原策略候选假设', key: 'own', width: 190, render: (_: any, r: any) => <OutcomeCell result={r.own} /> },
    { title: '共同基准 · TP15/SL8/H60', key: 'benchmark', width: 200, render: (_: any, r: any) => <OutcomeCell result={r.benchmark} /> },
    { title: '实际操盘 / 未执行原因', key: 'actual', width: 175, render: (_: any, r: any) => <><Tag color={r.actual.status === 'NOT_BOUGHT' ? 'default' : 'purple'}>{r.actual.status === 'NOT_BOUGHT' ? '未买入' : r.actual.status === 'CLOSED' ? '实际已平仓' : '实际持仓'}</Tag>{r.actual.status === 'CLOSED' && <ReturnValue value={r.actual.returnPct} />}<div className="ai-sub">{reasons[r.status] || r.status}</div><Tooltip title={r.reason}><span className="ai-sub">{r.marketWindow === 'GOOD_ALLOW' ? '窗口允许' : r.marketWindow === 'NEUTRAL_WAIT' ? '中性等待' : r.marketWindow === 'BAD_GUARD' ? '坏窗口防守' : r.marketWindow}</span></Tooltip></> },
    { title: '同策略历史胜率', key: 'history', width: 140, render: (_: any, r: any) => <Tooltip title="同队、同策略版本、同规则的候选假设结果；仅计已完结净收益大于0的样本，非预测胜率"><strong>{r.ruleHistory.winPct === null ? '暂无完结' : `${format(r.ruleHistory.winPct, 1)}%`}<div className="ai-sub">已完结 N={r.ruleHistory.completed}</div></strong></Tooltip> },
  ];
  const sharedColumns: any[] = [
    { title: '股票', key: 'stock', fixed: 'left', width: 150, render: (_: any, r: any) => <><strong>{r.name}</strong><div className="ai-sub">{r.symbol}</div></> },
    { title: 'Industry', dataIndex: 'industry', width: 90 },
    { title: '团队共识', key: 'shared', width: 125, render: (_: any, r: any) => <><SharedBadge stock={r} /><div className="ai-sub">{r.sharedDates.length ? `同日共识 ${r.sharedDates.length}次` : r.teamCount === 1 ? '仅1队选择' : '选股日期不同'}</div></> },
    ...(data?.teams || []).map((team: any) => ({ title: team.label, key: team.id, width: 210, render: (_: any, stock: any) => {
      const member = stock.members.find((m: any) => m.id === team.id), r = member?.latest;
      return r ? <><strong>{r.decisionDate} · ¥{format(r.decisionPrice)}</strong><div className="ai-sub">{r.ruleId} · {member.candidates.length}次选择</div><OutcomeCell result={r[evalMode]} /></> : <span className="ai-sub">当前列表范围内未选</span>;
    } })),
  ];
  const rankingColumns = (actual: boolean): any[] => [
    { title: '排名', dataIndex: 'rank', width: 65, render: (v: number | null) => v === null ? '—' : <strong>#{v}</strong> },
    { title: '团队', dataIndex: 'label', width: 170 },
    { title: actual ? '期间净收益率' : '已完结平均净收益', dataIndex: actual ? 'returnPct' : 'avgNetReturnPct', width: 180, render: (v: any) => <ReturnValue value={v} /> },
    ...(actual ? [
      { title: '期间盈亏', dataIndex: 'pnl', render: (v: any) => v === null ? '—' : `¥${format(v)}` },
      { title: '实际买入 / 卖出', key: 'trades', render: (_: any, r: any) => `${r.buyCount} / ${r.sellCount}` },
      { title: '实际平仓胜率', dataIndex: 'winPct', render: (v: any) => v === null ? '暂无平仓' : `${format(v, 1)}%` },
      { title: '对齐账本日期', dataIndex: 'latestDate' },
    ] : [
      { title: '已入场平均表现（含浮动）', dataIndex: 'avgEvaluatedReturnPct', render: (v: any) => <ReturnValue value={v} /> },
      { title: '候选 / 股票 / 完结', key: 'counts', render: (_: any, r: any) => `${r.candidates} / ${r.uniqueStocks} / ${r.completed}` },
      { title: '入场数', dataIndex: 'entered' },
      { title: 'TP / SL / H退出', key: 'outcomes', render: (_: any, r: any) => `${r.tp} / ${r.sl} / ${r.time}` },
      { title: '净收益胜率', dataIndex: 'winPct', render: (v: any) => v === null ? '暂无完结' : `${format(v, 1)}%` },
      { title: '跟踪中 / 完结率', key: 'maturity', render: (_: any, r: any) => `${r.open} / ${r.maturityPct === null ? '—' : `${format(r.maturityPct, 1)}%`}` },
      { title: '未成交 / 缺失 / 待入场', key: 'missing', render: (_: any, r: any) => `${r.expired} / ${r.missing} / ${r.pending}` },
      { title: '平均持有交易日', dataIndex: 'avgHoldDays', render: (v: any) => format(v, 1) },
    ]),
  ];
  return <ConfigProvider getPopupContainer={trigger => trigger?.closest('.ai-competition') as HTMLElement || document.body}><div className="ai-competition">
    <div className="ai-heading"><div><div className="ai-eyebrow">THREE TEAM PAPER COMPETITION</div><h1><TrophyOutlined /> AI 团队模拟竞赛</h1><p>统一查看候选、跟踪结果与实际操盘表现</p></div><Button icon={<ReloadOutlined />} loading={loading} onClick={() => setRefresh(v => v + 1)}>刷新数据</Button></div>
    {loading && data && <Alert type="info" message="正在刷新，暂时展示上一次完成的结果。" style={{ marginBottom: 12 }} />}
    {error && <Alert type="error" showIcon message={error} description={data ? '保留上次结果供查看，当前数据尚未刷新成功。' : '请稍后刷新。'} style={{ marginBottom: 16 }} />}
    <div className="ai-toolbar"><Space wrap>
      <Radio.Group value={scope} onChange={e => { setScope(e.target.value); setPeriod(e.target.value === 'research' ? 'all' : 'month'); setPeriodDate(''); setListScope(e.target.value === 'research' ? 'all' : 'active'); }}><Radio.Button value="competition">正式竞赛期</Radio.Button><Radio.Button value="research">开赛前历史研究</Radio.Button></Radio.Group>
      <span className="ai-sub">列表时效</span><Select value={days} onChange={setDays} style={{ width: 210 }}><Select.Option value={0}>数据建议：{data?.meta.policy.defaultDays || '分析中'}天</Select.Option><Select.Option value={90}>近90天</Select.Option><Select.Option value={180}>近半年（180天）</Select.Option><Select.Option value={365}>近一年（365天）</Select.Option></Select>
      <Tag>行情截止 {data?.meta.asOf || '—'}</Tag>
    </Space></div>
    {loading && !data ? <div className="ai-loading"><Spin size="large" tip="读取三队账本并评估候选…" /></div> : data && <>
      <div className="ai-team-summary">{data.teams.map((team: any, index: number) => <Card key={team.id} className={`ai-team-card ai-team-${index}`}><div className="ai-sub">{team.label}</div><div className="ai-big">{team.allCount}<span>已记录候选</span></div><div className="ai-sub">账本截至 {team.latestDate} · 归档 {team.hiddenOlder}条</div></Card>)}</div>
      <section className="ai-section"><div className="ai-section-title"><span className="ai-number">01</span><div><h2>候选股票跟踪</h2><p>候选计划、假设结果与实际操作分别展示。列表时效不影响历史统计。</p></div></div>
        <div className="ai-consensus-summary"><span>当前列表范围：</span>{[3, 2, 1].map(count => <Button key={count} type={sharedFilter === String(count) ? 'primary' : 'default'} onClick={() => setSharedFilter(sharedFilter === String(count) ? 'all' : String(count))}>{count === 1 ? '仅1队' : `${count}队共同`} {shared.filter(stock => stock.teamCount === count).length}只</Button>)}</div>
        <Space wrap className="ai-filters"><Input.Search aria-label="搜索候选股票" placeholder="代码、名称、行业、策略" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} allowClear />
          <Select aria-label="列表范围" value={listScope} onChange={setListScope} style={{ width: 185 }}><Select.Option value="active">有效期内候选</Select.Option><Select.Option value="archive">归档候选</Select.Option><Select.Option value="all">全部历史候选</Select.Option></Select>
          <Select aria-label="结果筛选口径" value={evalMode} onChange={setEvalMode} style={{ width: 205 }}><Select.Option value="own">按原策略假设筛选</Select.Option><Select.Option value="benchmark">按共同基准筛选</Select.Option></Select>
          <Select aria-label="结果状态" value={outcomeFilter} onChange={setOutcomeFilter} style={{ width: 175 }}><Select.Option value="all">全部结果</Select.Option><Select.Option value="completed">已完结</Select.Option><Select.Option value="open">跟踪 / 待入场</Select.Option><Select.Option value="TP">止盈 TP</Select.Option><Select.Option value="SL">止损 SL</Select.Option><Select.Option value="EXPIRED_UNFILLED">限价未成交</Select.Option></Select>
          <Select aria-label="团队共识筛选" value={sharedFilter} onChange={setSharedFilter} style={{ width: 190 }}><Select.Option value="all">全部团队选择</Select.Option><Select.Option value="shared">至少2队共同</Select.Option><Select.Option value="3">3队共同</Select.Option><Select.Option value="2">恰好2队共同</Select.Option><Select.Option value="1">仅1队选择</Select.Option></Select>
        </Space>
        <p className="ai-note">共识按当前列表范围内的相同股票代码统计，每队只计一次；“同日共识”另按选股日期核对。搜索与结果筛选不改变参与团队数；对照展示各队最近一次选择及所选口径的假设结果，可展开查看全部日期。</p>
        <Tabs defaultActiveKey="shared"><Tabs.TabPane key="shared" tab={`跨队选股对照 (${sharedRows.length})`}>
          {data.teams.some((team: any) => team.warnings.length) && <Alert type="info" showIcon message="旧历史来自已记录流水，部分门控前候选缺失；共同选股统计只比较已记录候选。" style={{ marginBottom: 12 }} />}
          <Table rowKey="symbol" size="small" loading={loading} columns={sharedColumns} dataSource={sharedRows} scroll={{ x: 1040 }} pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '60'], showTotal: n => `共${n}只股票` }} locale={{ emptyText: <Empty description="当前范围暂无候选" /> }} expandable={{ columnWidth: 34, expandedRowRender: (stock: any) => <div className="ai-detail">
            {stock.members.map((member: any) => <div key={member.id} className="ai-consensus-member"><strong>{member.label}</strong>{member.candidates.map((r: any) => <p key={r.id}>{r.decisionDate} · {r.ruleId} · ¥{format(r.decisionPrice)} · {labels[r[evalMode].status] || r[evalMode].status} <ReturnValue value={r[evalMode].netReturnPct ?? r[evalMode].markReturnPct} /></p>)}</div>)}
            <p><strong>同日共识：</strong>{stock.sharedDates.length ? stock.sharedDates.map((d: any) => `${d.date}（${d.teams.join(' / ')}）`).join('；') : '当前范围内没有两个团队在同一天选择'}</p>
          </div> }} />
        </Tabs.TabPane>{filtered.map((team: any) => <Tabs.TabPane key={team.id} tab={`${team.label} (${team.rows.length})`}>
          {team.warnings.map((warning: string) => <Alert key={warning} type="info" showIcon message={warning} style={{ marginBottom: 10 }} />)}
          <Table rowKey="id" size="small" loading={loading} columns={columns} dataSource={team.rows} scroll={{ x: 2050 }} pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '60'], showTotal: n => `共${n}条候选` }} locale={{ emptyText: <Empty description="当前范围暂无候选" /> }} expandable={{ expandedRowRender: (r: any) => <div className="ai-detail">
            <p><strong>其他团队选择：</strong>{sharedMap.get(r.symbol)?.members.map((m: any) => `${m.label}：${m.candidates.map((c: any) => c.decisionDate).filter((d: string, i: number, a: string[]) => a.indexOf(d) === i).join('、')}`).join('；')}</p>
            <p><strong>策略版本：</strong>{r.strategyVersion} · <strong>执行模型：</strong>{r.executionModel} · <strong>选股规则：</strong>{r.selectionReason}</p>
            <p><strong>原策略假设：</strong>{r.own.reason}；入场 {r.own.entryDate || '—'} @ ¥{format(r.own.entryPrice)}，退出 {r.own.exitDate || '—'} @ ¥{format(r.own.exitPrice)}，历时 {r.own.calendarDays ?? '—'}自然日。</p>
            <p><strong>共同基准：</strong>{r.benchmark.reason}；入场 {r.benchmark.entryDate || '—'} @ ¥{format(r.benchmark.entryPrice)}，退出 {r.benchmark.exitDate || '—'} @ ¥{format(r.benchmark.exitPrice)}。</p>
            <p><strong>数据来源：</strong>{r.captureScope} · 捕获时间 {r.capturedAt || '旧账本未记录'} · 选股距今 {r.ageDays}天 · 行业 {r.industryScope}。<strong>原始未执行原因：</strong>{r.reason}</p>
            {r.factors && <p><strong>冻结选股因子：</strong>T_max={r.factors.t_max || '—'} · T_avg={r.factors.t_avg || '—'} · C_gap={r.factors.c_gap || '—'} · 紧凑筹码={r.factors.compact_chip} · 家族历史N={r.factors.family_history_n} · 排序={r.rank}</p>}
          </div> }} />
        </Tabs.TabPane>)}</Tabs>
      </section>
      <section className="ai-section"><div className="ai-section-title"><span className="ai-number">02</span><div><h2>收益与选股效率排名</h2><p>实际账户按期间权益变化；候选按选股日期分组，结果跟踪至 {data.meta.asOf}。</p></div></div>
        <Space wrap className="ai-filters"><Radio.Group value={period} onChange={e => changePeriod(e.target.value)}><Radio.Button value="day">日</Radio.Button><Radio.Button value="month">月</Radio.Button><Radio.Button value="quarter">季</Radio.Button><Radio.Button value="year">年</Radio.Button><Radio.Button value="all">全部</Radio.Button></Radio.Group>
          {period !== 'all' && <Space><label htmlFor="ai-ranking-period">{periodLabels[period]}</label>{period === 'day' ? <input id="ai-ranking-period" aria-label="统计归属日期" type="date" value={selectionDate} min={selectionStart || undefined} max={selectionEnd} onChange={e => setPeriodDate(e.target.value)} /> : <DatePicker
            key={period} id="ai-ranking-period" picker={period as 'month' | 'quarter' | 'year'} locale={periodPickerLocale} format={periodFormats[period]} value={moment(selectionDate, 'YYYY-MM-DD')}
            allowClear={false} inputReadOnly style={{ width: period === 'quarter' ? 220 : period === 'year' ? 160 : 190 }}
            disabledDate={date => date.clone().startOf(period as 'month' | 'quarter' | 'year').format('YYYY-MM-DD') > selectionEnd || !!selectionStart && date.clone().endOf(period as 'month' | 'quarter' | 'year').format('YYYY-MM-DD') < selectionStart}
            onChange={date => { if (date) setPeriodDate(date.clone().startOf(period as 'month' | 'quarter' | 'year').format('YYYY-MM-DD')); }}
          />}</Space>}
          <Tag>{data.meta.cohortStart === '1900-01-01' ? '早期历史' : data.meta.cohortStart} ～ {data.meta.cohortEnd}</Tag>
        </Space>
        <Tabs defaultActiveKey="actual"><Tabs.TabPane key="actual" tab="实际操盘 · 账户净收益">
          {data.meta.scope === 'research' ? <Alert type="info" message="开赛前记录属于历史研究，不进入正式账户排名。" /> : <><p className="ai-note">三队统一对齐至 {data.meta.commonAccountDate}；平仓胜率仅统计实际卖出。空仓期间收益为0，同收益并列。</p><Table size="small" rowKey="id" pagination={false} dataSource={data.rankings.actual} columns={rankingColumns(true)} scroll={{ x: 960 }} /></>}
        </Tabs.TabPane><Tabs.TabPane key="own" tab="候选 · 原策略假设"><p className="ai-note">{data.meta.ownBasis} {data.meta.rankingBasis}</p><Table size="small" rowKey="id" pagination={false} dataSource={data.rankings.own} columns={rankingColumns(false)} scroll={{ x: 1260 }} /></Tabs.TabPane>
          <Tabs.TabPane key="benchmark" tab="候选 · 共同基准"><p className="ai-note">选股后下一市场交易日真实开盘买入，TP15% / SL8% / H60个股交易日，T+1可卖；开盘跳空先处理，同日双触及按SL优先。{data.meta.rankingBasis}</p><Table size="small" rowKey="id" pagination={false} dataSource={data.rankings.benchmark} columns={rankingColumns(false)} scroll={{ x: 1260 }} /></Tabs.TabPane></Tabs>
      </section>
      <Collapse ghost><Collapse.Panel key="sources" header="查看候选数据来源与升级约束"><p>候选文件由后端服务器读取，浏览器电脑无需存放候选数据。部署后端时必须提供团队数据目录和现有行情数据库；数据目录通过 AI_SIMULATION_ROOT 配置。</p><p>页面读取各队 state/condition_orders.csv，并用 condition_orders_user_view.csv、portfolio_state.json、equity_curve.csv、trades.csv 对账；存在完整快照时合并 07_data_exports/selection_candidates.csv 和每日覆盖表。行业及价格由行情数据库补充。</p><p>读取协议 v{data.meta.dataContractVersion || '1'}：允许新增列及调整列顺序，必需字段不能删除或改名；快照格式升级须先接入适配器并通过兼容测试。策略版本独立保存，未知执行模型明确显示“模型待接入”。缺文件或格式不兼容会报错，保留上次结果并提示未更新，不伪装为零候选。</p></Collapse.Panel><Collapse.Panel key="method" header="查看统计口径与列表时效依据"><p>{data.meta.feeBasis}</p><p>{data.meta.provenance}</p><p>推荐默认展示 {data.meta.policy.defaultDays}天：{data.meta.policy.explanation}</p><p>原策略 H 采用各队冻结时钟：Codex/Kimi 在H到期后的下一有效行情日收盘退出，Deepseek 在H到期当日收盘退出。共同基准在H60到期当日收盘退出。</p><p>历史重建来自当前源，不能作为当时已留存的证据；候选胜率为事后汇总，未完结、未成交和缺失记录均不计入分母。</p></Collapse.Panel></Collapse>
    </>}
  </div></ConfigProvider>;
}
