## Install 
```
npm install 


```

## Config
config/database.yml


## Config
yarn start_dev  //to start front-end
yarn start      //to start nodejs server, default port:3005, use 'PORT:*** yarn start' to start on your port

## Update trading days
npm install request
node ./routes/caculate_date.js ${year} //Update once a year after offical holidays is announced 
e.g. node caculate_date.js 2024

## AI 团队模拟竞赛

入口：`http://127.0.0.1:3005/ai_competition`，菜单“AI竞赛”。
只读接口：`GET /api/ai_competition`。
参数：`period=day|month|quarter|year|all`、`period_date=YYYY-MM-DD`（选股归属日期）、
`scope=competition|research`、`days=90|180|365`、`as_of=YYYY-MM-DD`（可选行情截断）。

读取三队规范账本和候选快照，不写账本或数据库，不运行模拟。
2026-07-20起为竞赛期，开赛前记录单列研究；文件变动失效缓存，页面每60秒刷新。
流水、视图、账户与权益必须对齐，候选快照和零候选覆盖表须覆盖最新账本日。

- 实际榜：共同账本截止日的期间权益变化，开赛前数据排除。
- 原策略候选：忽略窗口/资金/仓位，沿用冻结D+1 DAY限价、TP/SL/H和退出模型。
- 共同基准：下一市场交易日真实开盘，TP15/SL8/H60、T+1；缺失开盘不替代。
- 候选按选股日归属统计周期，跟踪至行情日；排名按已完结等权平均净收益。
  同时展示含浮动平均表现、股票数、完结率、未成交/缺失/待入场和胜率样本数。
- 每候选10万元名义买入金额折算整手，另计双向佣金0.03%（最低5元）和卖出税0.05%。
  独立候选均值不累乘为账户收益。未知执行模型不套用旧模型。
- 默认近180天，超期归档仍保留统计；192只股票的4217条H90含缓冲路径，
  95分位146自然日、最长162日。这是当前样本的时钟覆盖分析，不是未来保证。
- 行业为当前映射；旧报警日补查明确来源，重建不作为历史PIT证据。
- Deepseek经授权新增完整门控前观察和零日覆盖；旧历史不追认为完整观察快照。

合成测试：
```bash
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' node -r ts-node/register/transpile-only scripts/test_ai_competition.js
```
完整48项核验、13项HTTP、Deepseek16项对照及diff见
`/Users/xywang/Documents/STOCK/tmp/ai_competition_dashboard_20261012/`。

### 候选对照与数据读取协议 v1

竞赛页字体统一增加3px。新增跨队股票对照、3队/2队/仅1队筛选和每队全部选股日期。
共识以当前列表范围内的股票代码分组，每队只计一次；同日共识另按选股日期核对。
搜索和结果筛选不改变参与团队数。此范围独立于第二部分的收益统计周期。

数据由运行Node后端的服务器读取，浏览器终端无需候选文件。默认根目录为
`/Users/xywang/Documents/AI_Simulation`，可用环境变量 `AI_SIMULATION_ROOT` 指向
已同步或挂载的只读数据目录；其子目录必须为 `Codex`、`Deepseek`、`Kimi`。
这项配置仅选择本地/挂载目录，不会自动从另一台服务器下载数据。

每队需同步 `state/condition_orders.csv`、`condition_orders_user_view.csv`、
`portfolio_state.json`、`equity_curve.csv`、`trades.csv`。有详细观察时同时同步
`07_data_exports/selection_candidates.csv` 与 `selection_candidate_daily_summary.csv`。
复制到临时目录并验证后整体切换，或使用各队日结完成后的快照；不要逐文件覆盖正在读取的目录。
行情和行业仍使用UI现有MySQL数据源。跨机运行后端也要独立配置该数据库连接。

读取适配器版本 `DATA_CONTRACT_VERSION=1`，必需列以 `routes/aiCompetition.ts` 中
`REQUIRED_COLUMNS` 为准；CSV按字段名读取，允许新增列和调整列顺序，不能删除/改名必需列，
不能改变日期、价格、百分比、H交易日及状态字段的含义。账户JSON保留初始资金、现金和持仓数组。
策略升级必须保留旧候选的 `strategy_version`、冻结TP/SL/H和 `execution_model`，不能追改历史。
未知执行模型不计算原策略假设，显示“模型待接入”；共同基准仍独立评估。

Codex快照已有 `schema_version=1`，其他显式版本会被拒绝；Deepseek新观察和Kimi旧流水
目前没有格式版本列，使用已验证的旧格式适配器。这是兼容现状，不代表三队已完全统一输出。
升级规则：向后兼容新增字段可直接扩展；删改字段/单位/含义时，先发布新的格式版本和测试样本，
更新读取适配器与兼容测试，再升级生产者，最后部署页面；旧版本兼容期保留原字段。
无版本旧输出尤其不能直接改变字段语义。维护者须遵守此约束，读取端校验不能代替生产者治理。

缺目录、缺文件、字段缺失、未知快照版本返回HTTP503及具体错误代码；
不会将缺数据当成零候选。首次加载显示错误，刷新失败保留上次完成结果并提示未更新。
某队内部文件缺失或未完成对齐时暂停三队比较，避免缺一队还给出完整排名。
