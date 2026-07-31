---
project: 南塘云村
type: 任务卡
domain: 资金财务
status: 讨论中
created: 2026-07-29
---

你是南塘云村的谏臣席（DeepSeek，异体对抗方），现在对 NT 经济规则 v0/v2 两案做对抗审查。

你的审查立场：假设这两份方案是别人写的，你来找它们会在哪些地方让项目撞墙。不替方案说话，只找漏洞。

审查方法（谏臣席标准 SOP · 审计三步法）：
1. 逐条排查：审计对象逐条过，不抽样代替全量；
2. 闭环保真：结论与证据一一对应，无证据不入报告；
3. 看实证：不听"做完了/不存在"——否定性断言（X 不存在）比肯定性断言更需要实证。

项目背景：
- 南塘云村是一个实景游戏社区平台，营队开始后约 50 人规模
- NT 是社区流通货币，CV 是贡献值（只涨不花），XP 是经验值
- 技术栈：FastAPI + SQLAlchemy（SQLite 开发 / Neon Postgres 生产），原生 JS 移动端前端
- v0 是早期御裁稿（治理规则），v2 是最新工程稿（50 人架构），两案有冲突

必答题（逐项回答）：

1.【可验证质疑】对 v0 和 v2 各提出至少 2 条可验证质疑——每条必须附核查方法（怎么验证你的质疑成立），不接受纯感受。

2.【结算模式对抗】个人任务结算：A. 链上 P2P（frozen 标记+txHash 匹配解冻，平台不代付只验证）vs B. 内部即时（托管池+审核释放，平台代付）。两案各自的失败模式是什么（列出各自最坏情况的具体场景）？哪个失败模式对 50 人社区更致命？

3.【盲点清单】两份方案都没有提到、但 50 人社区运营中一定会遇到的问题，列出至少 3 个（如：用户死亡/退出社区时余额怎么办？营队中途解散怎么清算？admin 自己给自己发奖谁来管？）。

4.【写归写做归做风险】v2 的 8 天施工路线图和五道安全网，哪些条款存在"写在纸上但实际执行会走样"的风险？参照：本项目曾发生流程文档要求三件套但 18 张卡 0 张执行的先例。

5.【最不同意的一个设计决策】在 v0 和 v2 中指出你最不认同的一处设计，说明为什么，给出替代方案。

6.【最认同的一个设计决策】在 v0 和 v2 中指出你最赞同的一处设计，说明为什么。

输出格式：每条 ✅ 通过 / ⚠️ 有疑虑 / ❌ 必须修改 + 理由（不超过 200 字）+ 核查方法/修改建议（如有）。

════════════════════════════════════════
附件一：NT 经济规则设计稿 v0（御裁稿）全文
════════════════════════════════════════

# NT 经济规则设计稿 v0（呈砚仁裁 · 丞相起草）

> 依据：砚仁 2026-07-29 20:42 / 21:19 / 21:28 三次明旨。涉钱 D-17 锁型，御笔级。
> 状态：v0 待裁。裁后出施工拆解卡，涉钱路径逐条审锁。

## 一、三池模型（御旨：账要清清楚楚）

| 池 | 资金来源 | 出资场景 | 确认权 |
|---|---|---|---|
| 个人池 | 用户链上充值（个人钱包 → 平台记录） | 任务大厅个人任务 | 发布者本人（钱是他出的，可自审） |
| 社区池 | 多签钱包注入（链上多签地址） | 卡片室发现确认、公共任务、新人奖励 | 他人校核（发现者禁止自校核——钱是社区的） |
| 营地池 | 待裁（见 Q3） | 营地任务 | 营地 manager / 营地任务发布者 |

规则一句话：钱谁出，谁确认；钱不是自己的，就不能自己确认。
- 任务大厅个人任务：发布者可自校核（御旨 21:28）。
- 卡片室发现：发现者禁止自校核（御旨 21:28）——前端已隐藏自校核按钮（doer===me），服务端须加硬拦（双保险，禁 API 绕过）。

## 二、个人任务质押冻结状态机（御旨：链上转账记录查到才解冻）

发布任务 → [冻结] 发布者个人池 NT（服务端 escrow 记账，不扣走，只锁）
   ↓ 执行者完成
双方线下结算：发布者用个人钱包向执行者转账（可逐笔，可统一结算批量转）
   ↓
[解冻条件] 链上转账记录被查到并匹配（txHash + 金额 + 双方地址）
   ↓
[解冻] escrow 释放（冻结解除，任务闭环）

关键设计点：
1. 冻结不转账：发布时 NT 只在账本标记 frozen，仍在发布者余额里但不可用（防双花）。
2. 结算在链上：平台不代付——发布者自己用钱包转，平台只验证。
3. 统一结算：多笔冻结可合并一次链上转账，平台按金额+备注/顺序匹配解冻（匹配规则需细化，见 Q2）。
4. 解冻 = 链上记录确认：这是御旨核心。技术路径见 Q1。

## 三、待砚仁裁（Q1-Q4）

Q1 链上确认的技术路径（决定开发量）：
- A. 自动查链：服务端接 RPC/索引器，定时扫多签地址和用户地址的转账记录，自动匹配解冻。体验好，开发量大。
- B. 录入 txHash 验证：发布者转完账把 txHash 填进平台，服务端只验这一笔（存在性+金额+双方地址）。开发量小，多一步手工。
- C. 过渡方案：先 B 后 A。建议 C。

Q2 统一结算的匹配规则：多笔冻结合并一笔转账时，怎么知道这笔钱解哪些冻结？（按收款人+总额匹配 / txHash 关联冻结清单 / 备注字段编码）

Q3 营地池的钱从哪来：①社区池划拨（多签→营地子账户）；②营地自筹（成员缴纳/营地任务收入）；③暂不开营地池（营地任务先走个人池/社区池过渡）。

Q4 社区池=0 策略（现状：发现确认卡死 transfer 400）：①拒绝+明示"池空，请联系管理充值"；②挂账欠条（先记账，池有钱补付）；③触发多签充值提醒。建议 ①+③ 组合。

## 四、现状病灶（NT-勘察-1 在勘）
- 会计等式不成立 ×4 + 社区池=0（砚仁 21:19 日志实证）——钱流图待二营回执。
- transfer 400 → 卡片发现确认卡死（池=0 连锁）。
- nt-core.js?v=8 版本号 frozen 三年未进 ?v= 体系。

## 五、施工拆解预告（裁后发卡）
1. NT-1 服务端 escrow 账本（frozen 字段/冻结流水表，D-17 锁型）
2. NT-2 发布任务接冻结（个人池校验余额→冻结→任务关联）
3. NT-3 解冻端点（txHash 录入验证 or 链上自动匹配，按 Q1 裁）
4. NT-4 校核权硬拦（发现禁止自校核服务端拦截 + 任务自审放开）
5. NT-5 池=0 策略 + 多签充值提醒（按 Q4 裁）
6. NT-6 营地池（按 Q3 裁，可后置）

════════════════════════════════════════
附件二：NT 经济规则设计稿 v2（50 人版工程稿）全文
════════════════════════════════════════

# NT 经济规则设计稿 v2（50 人版）

> 性质：规则定型文档。提取代码现状 + 对照原始蓝图 + 砚仁裁定方向后，重新设计的 50 人规模 NT 经济架构。
> 适用规模：50 人（营队开始后预估）。
> 核心决策（砚仁 2026-07-29 裁定）：
> - 记账模型：维持即时结算 + 社区池实持（不回归虚拟账本 + 月结）
> - 池子架构：CommunityPool 拆 4 张独立表 + 营队独立账本
> - 安全网：自动对账 + txHash 回写 + 日终报告 + 大额熔断 + 异常告警，全上
> - 远期方向：虚拟账本 + 月结作为终局蓝图保留，本期不施工

## 一、三轨体系

| 轨道 | 名称 | 用途 | 获得方式 |
|------|------|------|----------|
| NT（南塘币） | 流通货币 | 付住宿费、订餐、打赏、买东西 | 做任务、卡片发现、校核通过、池发奖 |
| CV（贡献值） | 信誉积分 | 决定权限等级、解锁能力 | 做任务累积；转账时 75% 给接收方，25% 入公共池 |
| XP（经验值） | 劳动累积 | 解锁称号（园丁/修理工/厨神） | 做任务、池发奖时同步记 |

规则：
- NT 可花可转，CV 和 XP 只涨不花
- CV 首次注册冻结 75 点，完成 5 步新手任务逐步解冻（每步 15 CV）
- 信誉分（trust_score）独立于 CV，初始 100，范围 0-100

## 二、四层资金池架构（重构核心）

### 2.0 架构总览

个人层（50 行 User，每人独立）：nt_balance / contribution_value / xp / trust_score
平台层（4 张独立单例表）：OperatingPool(运营池) / EscrowPool(任务托管) / ReservePool(储备池) / FrozenPool(提现待审)
营队层（N 行 CampLedger，每营独立）：camp_id / balance / escrow / status / multisig_address
链上层（平台多签 + 未来营队多签）：PLATFORM_WALLET + Camp.multisig_address

### 2.1 个人层

每个 User 一行，nt_balance 就是个人钱包。不是"池"，是"自己的钱"。

### 2.2 平台层（拆 4 表）

| 表名 | 用途 | 收入来源 | 支出方向 |
|------|------|----------|----------|
| OperatingPool | 日常发放 | 充值 topup、spend 回流、盈余划拨、每日补填 | 任务奖、卡片奖、校核奖、池发奖 |
| EscrowPool | 任务托管 | 发布任务冻结（user → escrow） | 审核通过释放、取消退回、仲裁 |
| ReservePool | 战略储备 | 链上充值、运营池盈余划拨 | 提现资金来源、自动调水补运营池 |
| FrozenPool | 提现待审 | 用户申请提现（balance → frozen） | admin 确认（→ 链上转账）/ 驳回（→ 退回 balance） |

OperatingPool 额外字段：total_issued（全局会计锚点）、contribution_pool（CV 磨损 25% 归集）、last_tick_date（日结幂等标记）

### 2.3 营队层（独立账本）

每个营队一行 CampLedger：camp_id(PK) / balance(当前可用) / escrow(营队任务托管) / allocated(初始分配总额) / status(active/settling/closed) / multisig_address(预留) / settled_at(结营结算时间)

营队资金流：
创营：OperatingPool → CampLedger.balance（admin 注资）
营期内：任务发布 → CampLedger.balance → CampLedger.escrow；审核通过 → CampLedger.escrow → 执行者 User.nt_balance；订餐 → User.nt_balance → CampLedger.balance；个人间转账不碰 CampLedger
结营：CampLedger.balance → OperatingPool（余额退回）

### 2.4 链上层

平台多签 PLATFORM_WALLET_ADDRESS（已有，用于充值/提现）；营队多签 Camp.multisig_address（预留字段，远期启用）

### 2.5 分层会计等式

平台层等式：total_issued = Σ(user.nt_balance) + operating.balance + escrow.balance + reserve.balance + frozen.balance
营队层等式（每营独立）：camp.allocated = camp.balance + camp.escrow + Σ(该营已支出到个人)
全局等式：total_issued = Σ(user.nt_balance) + Σ(平台4池) + Σ(各营 balance + escrow)
任何时刻都必须成立。差 1 NT 都是 bug。

### 2.6 数据迁移方案

现有 CommunityPool 单行拆分：balance→OperatingPool.balance；task_escrow→EscrowPool.balance；reserve→ReservePool.balance；frozen→FrozenPool.balance；camp_balance→按现有营队分配到各 CampLedger 行；contribution_pool→OperatingPool.contribution_pool；total_issued→OperatingPool.total_issued

## 三、"冻结"命名规范（三种冻结正名）

| 旧名 | 新名 | 准确含义 | 代码字段 |
|------|------|----------|----------|
| task_escrow | 任务托管 | 发布者的钱暂存，等审核结果 | EscrowPool.balance |
| frozen | 提现待审 | 用户提现申请后等待 admin 确认 | FrozenPool.balance |
| accommodation_due | 住宿应付 | 用户欠社区的住宿费（记账，不动余额） | Tenancy.accommodation_due |

原则：不再用"冻结"一词概括所有中间态。每个状态有准确的名字。

## 四、收入路径（7 路）

### 4.1 做任务
发布：User.nt_balance → EscrowPool（reward × slots 托管）
审核通过：EscrowPool → 每个执行者 User.nt_balance（每人得 reward，+CV +XP）
部分领取/3 次退回/取消：EscrowPool → 发布者（未领份额/全额退还）
营地任务：EscrowPool 换成 CampLedger.escrow，其余相同。

### 4.2 卡片室发现
发现确认：OperatingPool → 做事者；猜中奖励：OperatingPool → 发现者
四道防线：禁自校核 / 金额服务端取 / 行锁防并发 / 同事务提交。

### 4.3 校核通过
OperatingPool → 做事者 + 校核人。防滥用：1h 冷却 + 日上限 10 次。

### 4.4 池发奖
POST /api/nt/earn（admin，单笔上限 10000）；POST /api/nt/card-confirm（登录，内部调 _grant_from_pool）

### 4.5 周期任务
每日 00:05 cron → 读模板 → 幂等 → OperatingPool 扣款 → EscrowPool 冻结 → 创建 NTTask。

### 4.6 充值
链上充值（chain_scanner 监听 → OperatingPool.balance + total_issued）；手动 topup（admin，增 total_issued）；社区池注资（topup user="community_pool"）

### 4.7 转账（user → user）
单笔上限 10000 NT。CV 75% 给接收方，25% 入 OperatingPool.contribution_pool。

## 五、支出路径（6 路）

5.1 住宿费：accrual 日记账（默认，每日累加 accommodation_due，退房一次结算）；房费率 A=20/B=30/C=30/D=60/E=30/F=35 NT/晚
5.2 食堂订餐：10 NT/餐，预定扣款，取消退款
5.3 消费（spend）：scope=personal → OperatingPool / scope=camp → CampLedger.balance
5.4 提现（两阶段）：申请（User.nt_balance → FrozenPool，ReservePool 等额扣减）→ admin 确认（FrozenPool → 链上转账，txHash 回写 NTLedger）或驳回（退回余额）。门槛：50-200 NT，信誉分 ≥ 60，7 天冷却
5.5 夸奖赞誉：免费口头 / 🌹1 NT / 🎁5 NT，走 transfer 通道
5.6 茶馆八卦（半成品）：5 NT/条，走 CampLedger

## 六、每日自动化（cron 00:05）

1 生成周期任务（幂等 → 池余额够 → 扣池建任务）
2 住宿费记账/扣款（遍历活跃入住）
3 运营池补填（OperatingPool < 300 → 自动补 20 NT）
4 盈余划拨（OperatingPool > 1000 → 超出 500 转 ReservePool）
5 自动调水（OperatingPool < 150 且 ReservePool > 0 → 补到 300）
6 自动对账（调 verify 校验三层等式，破裂则告警）【新增】
7 日终报告（生成简报存 Announcement，admin 可见）【新增】

## 七、五道财务安全网（新增）

7.1 自动对账：每日 cron 00:10 自动调 verify，等式破裂 → 告警 admin + 记录断裂快照
7.2 链上 txHash 回写：admin 确认提现/充值时，链上转账 → txHash 回写 NTLedger.tx_hash，审计闭环
7.3 日终财务报告：每日自动生成（各池余额/今日流水/活跃用户/对账结果），存 Announcement
7.4 大额熔断：earn 日累计 50000 / topup 日累计 100000 / withdraw 单用户日累计 500，超限 429
7.5 异常告警：单用户 1h receive>10 笔；单用户余额 1h 增长>500%；运营池 1h 下降>50%；会计等式 diff>0（最高优先级）

## 八、安全防线

涉钱四道通用防线：行级锁 with_for_update()+populate_existing / 金额服务端取 / 同事务提交 / 会计等式守恒
权限门控：转账/消费/提现申请=登录；earn/topup/cashout=admin；card-confirm=登录（禁自校核）；提现确认/驳回=admin；校核审批=登录（禁自校核）

## 九、与公约对接

校核奖励 15%（需改 C1）；住宿价目 A-F（已一致）；劳动价目 L1-L4 45 项（需比对 C9）；签署公约发 10 NT（待施工）；岗位津贴 1500 NT/月（待施工）；每周一 15:00 大扫除（需改配置）

## 十、待完善项（优先级）

P0：CommunityPool 拆 4 表 / CampLedger 独立表 / 自动对账 / txHash 回写 / 三种冻结改名
P1：日终报告 / 大额熔断 / 异常告警 / 月度清算报表
P2：猜牌后端化 / 茶馆八卦 UI / 二手集市 UI
P3：赏金任务随机掉落 / 感知层自动定价 / 营队独立多签
终局蓝图：虚拟账本 + 月结（不本期施工）

## 十一、施工路线图

P1 CommunityPool 拆 4 表 + 数据迁移 + 全量测试（2 天）
P2 CampLedger 独立表 + 创营/结营资金流改造（1.5 天，前置 P1）
P3 自动对账 + txHash 回写（1 天，前置 P1）
P4 日终报告 + 大额熔断 + 异常告警（1.5 天，前置 P1）
P5 月度清算报表 + 三层等式全量验证（1 天，前置 P1+P2）
P6 设计稿定稿 + 三种冻结改名落地（1 天，前置 P1-P5）
合计 8 天

## 附录 A：设计演进说明

为什么选即时结算 + 社区池，不选虚拟账本 + 月结？
原始蓝图设计的是：平台 = 虚拟记账 + P2P 清算引擎，不铸币不持币；NT 月底 P2P 清算才真正到账。
代码现状是：CommunityPool 持有实际余额；做任务即时到账；topup 直接增 total_issued。
砚仁裁定维持现状，理由：
1. 20→50 人社区，即时到账的用户体感远优于"月底才看到钱"
2. 会计等式已兜住安全底线
3. 月结需要 web3 钱包签名等基础设施，当前不具备
4. 蓝图作为终局方向保留，待社区规模和基础设施成熟后再迁移
txHash 审计思路从蓝图中吸收：每笔"出系统"的钱（提现、充值确认）都回写 txHash，保留链上审计能力。

（附件完 · 请按开头的 6 道必答题输出审查意见）
