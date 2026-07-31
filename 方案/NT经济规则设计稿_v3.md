---
title: 南塘云村 · NT 经济规则设计稿 v3.1（50 人版 · 第二轮复审后修订）
created: 2026-07-30
updated: 2026-07-30
project: 南塘云村
type: 方案规划
domain: 资金财务
status: 终审定稿
phase: 砚仁 2026-07-30 终审 · 二营放行 · P0-1~P0-5 已发卡
summary: v3.1 终审定稿——reserve 移出会计等式（方案 A）、锁序 P0-5、熔断下沉、轻检边界、契约 v0.2、P0 五卡。
author: 丞相修订 · 砚仁 2026-07-30 终审定稿
---

# NT 经济规则设计稿 v3.1（50 人版 · 第二轮复审后修订）

> **性质**：拟票待二营快速复审（铁律 9 涉钱=宪法级；一营复审已明示不阻塞）。本版 = v3 + 第二轮复审回执全量吸收。
> **第一轮回执**：`方案/任务卡/NT经济规则_一营对抗回执_2026-07-30.md`、`方案/任务卡/NT经济规则_二营对抗回执_2026-07-30.md`；汇总拟裁：`方案/NT经济规则_对抗汇总与拟裁_2026-07-30.md`。
> **第二轮回执**：`方案/任务卡/NT经济规则_一营复审回执_2026-07-30.md`、`方案/任务卡/NT经济规则_二营复审回执_2026-07-30.md`；汇总拟裁：`方案/NT经济规则_二轮复审汇总与拟裁_2026-07-30.md`。
> **数据基准**：2026-07-29，commit `dcd17fa`。适用规模：50 人。
> **第一轮修改标 🆕R1，第二轮修改标 🆕R2。**
>
> **核心决策**（砚仁 2026-07-29 裁定 + 2026-07-30 对抗定案）：
> - 记账模型：维持即时结算 + 社区池实持（不回归虚拟账本 + 月结）
> - 🆕R1 结算模式：**定 B 内部即时托管**，v0 链上 P2P 降级远期蓝图（两营一致否决 A）
> - 池子架构：CommunityPool 拆 4 张独立表 + 营队独立账本（**降 P1，带四项开工前置硬门槛**）
> - 安全网：自动对账 + txHash 回写 + 日终报告 + 大额熔断 + 异常告警，全上
> - 🆕R1 施工顺序：先治标（修 bug + 对账 + UI + 契约）再治本（拆表）
> - 🆕R2 reserve 语义：**砚仁 2026-07-30 批方案 A**——ReservePool 移出会计等式，定性「链上兑付背书台账」
> - 🆕R2 锁序统一：从拆表前置**提升为 P0-5 独立卡**（二营复审实锤现网存量 AB-BA 风险）
> - 远期方向：虚拟账本 + 月结 + 链上 P2P 结算，作为终局蓝图保留，本期不施工

---

## 一、三轨体系（不变）

| 轨道 | 名称 | 用途 | 获得方式 |
|------|------|------|----------|
| **NT**（南塘币） | 流通货币 | 付住宿费、订餐、打赏、买东西 | 做任务、卡片发现、校核通过、池发奖 |
| **CV**（贡献值） | 信誉积分 | 决定权限等级、解锁能力 | 做任务累积；转账时 75% 给接收方，25% 入公共池 |
| **XP**（经验值） | 劳动累积 | 解锁称号（园丁/修理工/厨神） | 做任务、池发奖时同步记 |

**规则**：
- NT 可花可转，CV 和 XP 只涨不花
- CV 首次注册冻结 75 点，完成 5 步新手任务逐步解冻（每步 15 CV）
- 信誉分（trust_score）独立于 CV，初始 100，范围 0-100

---

## 二、结算模式定案 🆕R1（第一轮对抗一致结论）

### 2.1 个人任务结算 = B 内部即时托管

```
发布任务：User.nt_balance → EscrowPool（reward × slots 托管）
执行完成：执行者 App 内点"提交"
审核通过：EscrowPool → 执行者 User.nt_balance（即时到账）
```

**否决 A 链上 P2P**（v0 §二"冻结不转账 + txHash 匹配解冻"），双营理由：
- 一营：60 后村民无加密钱包，A 卡死在钱包操作步（8-10 次点击 + gas 费签名）；B 全程 App 内 4-5 次点击、即时到账。
- 二营：txHash 信任根四大攻击面（重放 / 金额拆分聚合 / 假转账 / 地址伪装）+ RPC 索引器外部依赖 = 链故障即结算瘫痪；B 已由 D-17 锁型 + 会计等式兜住。

**处置**：v0 §二整节降级为远期蓝图（与"虚拟账本+月结"并列，标注"需全员配备钱包后启用"）；txHash **仅用于"出系统"的钱**（提现/充值确认）审计回写，不作为任务解冻的信任根。

### 2.2 发布者自校核个人任务：成立（保留 v0 御裁）

一营 Q4 重审结论：钱是发布者自己出的（发布时已扣到 escrow），自审 = 决定"认可成果、把钱给执行者"，逻辑成立，无套利空间。社区池/营地池任务仍**禁自校核**（钱不是审核人出的）。

---

## 三、四层资金池架构（重构核心 · P1 施工）

### 3.0 架构总览

```
┌──────────────────────────────────────────────────────────┐
│  个人层（50 行 User，每人独立）                             │
│  nt_balance / contribution_value / xp / trust_score      │
├──────────────────────────────────────────────────────────┤
│  平台层（4 张独立单例表）                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────┐ │
│  │ OperatingPool│ │ EscrowPool  │ │ReservePool│ │Frozen│ │
│  │ (运营池)     │ │ (任务托管)  │ │ (储备池)  │ │(待审)│ │
│  └─────────────┘ └─────────────┘ └──────────┘ └──────┘ │
├──────────────────────────────────────────────────────────┤
│  营队层（N 行 CampLedger，每营独立）                       │
│  camp_id / balance / escrow / status / multisig_address  │
├──────────────────────────────────────────────────────────┤
│  链上层（平台多签 + 未来营队多签）                         │
│  PLATFORM_WALLET + Camp.multisig_address                 │
└──────────────────────────────────────────────────────────┘
```

### 3.1 个人层

每个 User 一行，`nt_balance` 就是个人钱包。不是"池"，是"自己的钱"。

### 3.2 平台层（拆 4 表）

| 表名 | 用途 | 收入来源 | 支出方向 |
|------|------|----------|----------|
| **OperatingPool** | 日常发放 | 充值 topup、spend 回流、盈余划拨、每日补填 | 任务奖、卡片奖、校核奖、池发奖 |
| **EscrowPool** | 任务托管 | 发布任务冻结（user → escrow） | 审核通过释放、取消退回、仲裁 |
| **ReservePool** | 战略储备 🆕R2 背书台账（方案 A：不入 NT 会计等式） | 链上充值、运营池盈余划拨 | 提现资金来源、自动调水补运营池 |
| **FrozenPool** | 提现待审 | 用户申请提现（balance → frozen） | admin 确认（→ 链上转账）/ 驳回（→ 退回 balance） |

**OperatingPool 额外字段**：
- `total_issued`：全局会计锚点（总发行量）。🆕R1 拆表后**只存 OperatingPool 一处**，禁止冗余副本（二营 Q4-4）
- `contribution_pool`：CV 磨损 25% 归集。🆕R1 属 CV 域，**永不计入 NT 等式**（现况 verify 已正确排除，迁移后保持）
- `last_tick_date`：日结幂等标记

### 3.3 营队层（独立账本）

每个营队一行 `CampLedger`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `camp_id` | PK | 关联 camps 表 |
| `balance` | int | 当前可用余额 |
| `escrow` | int | 营队任务托管冻结 |
| `allocated` | int | 初始分配总额（= balance + escrow + 已支出） |
| `status` | str | active / settling / closed |
| `multisig_address` | str | 营队多签钱包地址（预留，远期启用） |
| `settled_at` | str | 结营结算时间 |

**营队资金流**：
```
创营：OperatingPool → CampLedger.balance（admin 注资）
营期内：
  任务发布 → CampLedger.balance → CampLedger.escrow
  审核通过 → CampLedger.escrow → 执行者 User.nt_balance
  订餐 → User.nt_balance → CampLedger.balance
  个人间转账 → 不碰 CampLedger（走 User 层 transfer）
结营：CampLedger.balance → OperatingPool（余额退回）
```

### 3.4 链上层

| 角色 | 地址 | 状态 |
|------|------|------|
| 平台多签 | `PLATFORM_WALLET_ADDRESS` | 已有，用于充值/提现 |
| 营队多签 | `Camp.multisig_address` | 预留字段，远期启用 |

### 3.5 分层会计等式 🆕R2（reserve 移出等式 · 砚仁批方案 A）

```
平台层等式（🆕R2 不含 reserve）：
  total_issued = Σ(user.nt_balance)
               + operating.balance
               + escrow.balance
               + frozen.balance

背书台账独立校验（🆕R2 reserve 不入等式，另设硬检查）：
  reserve_covers_frozen：ReservePool.balance ≥ FrozenPool.balance   必须成立

营队层等式（每营独立）：
  camp.allocated = camp.balance + camp.escrow + Σ(该营已支出到个人)

全局等式：
  total_issued = Σ(user.nt_balance)
               + operating + escrow + frozen（🆕R2 三池，不含 reserve）
               + Σ(各营 balance + escrow)

🆕R1 交叉校验（二营 Q2，拆表验收硬门槛）：
  escrow_drift = EscrowPool.balance
               − Σ(reward × (slots − 已到账人数 − 已退回份额))   必须 = 0
  🆕R2 口径写死为「未领取且未退回份额」（二营复审 Q1-②），部分领取态不误报
  camp_pool_drift（现有）保留
```

**任何时刻都必须成立。差 1 NT 都是 bug。**
🆕R1 escrow 从"信任单值"升级为"账本可推导值"——堵住"frozen 累加错但等式照样平"的假平漏洞。
🆕R2 **reserve 语义定案（方案 A）**：ReservePool = 链上兑付背书台账（与 contribution_pool 同级，不计 total_system）。依据：二营复审实锤现行 withdraw 申请 `reserve −X` 无对冲项 → 每完成一笔提现 diff 永久 −X（07-29「等式×4」候选根因，P0-2 SQL 追账证实）。方案 A 改动最小：verify() 等式去掉 reserve 项 + 新增 reserve_covers_frozen 检查，withdraw 资金流向代码一行不改（reserve 扣减照旧，只作台账）。

### 3.6 全局锁序硬约束 🆕R2（升级为 P0-5 全局铁律 · 二营复审 Q2）

🆕R2 **定位修正**：二营复审实锤——现行单表四条热路径（transfer L219 / _grant_from_pool L261 / withdraw L453 / cashout L425）全部 **User 先→Pool 后**，而 verify_task（L669→L685）是 **Pool 先→User 后**：PG 上 transfer×verify_task 交叉即 AB-BA 死锁对（SQLite 单写掩盖，上 Neon 即暴露）。**这是现网存量风险，不是拆表才有的问题**——锁序统一提升为 P0-5 独立卡，拆表（P1）复用其成果。

1. **全局锁序**（所有涉钱事务一律按此序 acquire，禁止逆序；🆕R2 方向与 verify_task 现行一致 = 改动面最小）：
   ```
   Pool（单表期 CommunityPool；拆表后 OperatingPool → EscrowPool → ReservePool → FrozenPool）
   → CampLedger(camp_id 升序) → User(user_id 升序)
   ```
2. 🆕R2 **P0-5 施工内容**：单表阶段先把 transfer / _grant_from_pool / withdraw / cashout 翻转为「先锁 Pool 后锁 User」；transfer 的 from/to 两行按 `user_id 升序` 加锁；锁序在四函数头部写死注释。
3. cron 的盈余划拨（Operating→Reserve）与自动调水（Reserve→Operating）**串行执行**（同一事务或互斥标记），杜绝 AB-BA 互锁。
4. 多营并发结算按 `camp_id` 升序循环加锁。
5. 所有 `with_for_update()` 一律带 `populate_existing`；生产 PG 设 `lock_timeout` 防无限等待。
6. **配套锁测**：🆕R2 P0-5 即补「单表 transfer×verify_task 交叉」PG 锁测（`requires_pg` 门控），不等拆表；拆表验收再加「营队审核×结营结算」「划拨×调水」两组。

### 3.7 数据迁移方案 🆕R1（重写为迁移原子性四件套 · 二营 Q4 · 拆表开工前置②③）

**字段映射**（同 v2）：
```
CommunityPool 单行 → 拆 5 张表：
  balance          → OperatingPool.balance
  task_escrow      → EscrowPool.balance
  reserve          → ReservePool.balance
  frozen           → FrozenPool.balance
  camp_balance     → 按营分摊到各 CampLedger 行（见前置校验）
  contribution_pool→ OperatingPool.contribution_pool（CV 域，不入 NT 等式）
  total_issued     → OperatingPool.total_issued（唯一锚点）
```

**四件套（缺一不开工）**：
1. **单事务原子**：迁移全程一个事务（PG DDL+DML 同事务；SQLite 先全库文件级备份）。中途任何异常 = 整体 ROLLBACK，不存在"拆到一半"状态。
2. **前后对拍**：迁移前跑 verify 存快照（各池值 + total_issued + diff）→ 迁移后立即重跑 verify → **diff ≠ 0 直接 ROLLBACK**。
3. **camp_balance 分摊前置校验**：camp_balance 现况是单值汇总，无营队维度。迁移前先从 NTLedger `camp_pool` 明细按 camp_id 重建每营初始账本，**重建 Σ 必须 == 旧 camp_balance，否则中止迁移**（禁止猜分摊）。
4. **旧表只读快照**：迁移后 `community_pool` 改名 `community_pool_backup` 保留 ≥14 天，回滚 = 还原备份 + 切读回旧表。

**执行窗口**：凌晨停机窗口迁移（禁涉钱写入），50 人规模停机 30 分钟可接受。
🆕R2 **前端维护提示**（一营复审）：拆表卡带前端子任务——停机前 24h 村口 banner 维护预告；停机期间前端拦截全部涉钱按钮显示「系统维护中」（防用户把 502/503 当故障）。

---

## 四、"冻结"命名规范（三种冻结正名 · 两营一致照准）

| 旧名 | 新名 | 准确含义 | 代码字段 |
|------|------|----------|----------|
| task_escrow | **任务托管** | 发布者的钱暂存，等审核结果 | EscrowPool.balance |
| frozen | **提现待审** | 用户提现申请后等待 admin 确认 | FrozenPool.balance |
| accommodation_due | **住宿应付** | 用户欠社区的住宿费（记账，不动余额） | Tenancy.accommodation_due |

**原则**：不再用"冻结"一词概括所有中间态。每个状态有准确的名字。
🆕R1 **前端文案同步**（一营 Q5）：命名落地时，前端所有 toast/提示同步更新——余额不足提示带"钱在哪"，如 `NT 余额不足（当前可用 10 NT，另有任务托管 30 NT）`。

---

## 五、收入路径（7 路，不变）

### 5.1 做任务（F2）

| 环节 | 资金流向 | 说明 |
|------|----------|------|
| 发布 | User.nt_balance → EscrowPool | `reward × slots` 托管 |
| 审核通过 | EscrowPool → 每个执行者 User.nt_balance | 每人得 `reward`，+CV +XP |
| 部分领取 | EscrowPool → 发布者 | 未领份额退还 |
| 3 次退回 | EscrowPool → 发布者 | 自动取消退回 |
| 取消 | EscrowPool → 发布者 | 全额退还 |

**营地任务**：EscrowPool 换成 CampLedger.escrow，其余相同。
🆕R1 EscrowPool 释放/退回必须**池行 + 收款方行双锁**（沿 `_grant_from_pool` 锁型，二营 Q2）。

### 5.2 卡片室发现（F5）

| 环节 | 资金流向 |
|------|----------|
| 发现确认 | OperatingPool → 做事者 User.nt_balance |
| 猜中奖励 | OperatingPool → 发现者 User.nt_balance |

**四道防线**（不变）：禁自校核 / 金额服务端取 / 行锁防并发 / 同事务提交。
🆕R1 **池=0 兜底**（P0 首位施工）：池余额不足时采纳拒绝 + 提醒 admin 注资，禁止卡死确认流程（第一轮 P0-1）。

### 5.3 校核通过（Verification）

OperatingPool → 做事者 + 校核人。防滥用：1h 冷却 + 日上限 10 次。

### 5.4 池发奖

| 端点 | 权限 | 说明 |
|------|------|------|
| `POST /api/nt/earn` | admin | OperatingPool → 指定用户，单笔上限 10000 |
| `POST /api/nt/card-confirm` | 登录 | 卡片确认，内部调 `_grant_from_pool` |

### 5.5 周期任务（F20）

每日 00:05 cron → 读模板 → 幂等 → OperatingPool 扣款 → EscrowPool 冻结 → 创建 NTTask。

### 5.6 充值

| 方式 | 说明 |
|------|------|
| 链上充值 | chain_scanner 监听 → OperatingPool.balance + total_issued |
| 手动 topup | admin 操作，增 total_issued |
| 社区池注资 | topup user="community_pool" |

### 5.7 转账（user → user）

单笔上限 10000 NT。CV 75% 给接收方，25% 入 OperatingPool.contribution_pool。

---

## 六、支出路径（6 路，不变）

### 6.1 住宿费

accrual 日记账（默认）：每日累加 accommodation_due，退房一次结算。
deduct 日扣（可回滚）：环境变量切换。
房费率：A=20 / B=30 / C=30 / D=60 / E=30 / F=35 NT/晚。

### 6.2 食堂订餐

10 NT/餐，预定扣款，取消退款。

### 6.3 消费（spend）

scope=personal → OperatingPool / scope=camp → CampLedger.balance。

### 6.4 提现（两阶段）🆕R2（会计口径按方案 A 重写）

| 阶段 | 操作 | 资金流向 | 🆕R2 等式效果（方案 A） |
|------|------|----------|------------------------|
| 申请 | 用户操作 | User.nt_balance → FrozenPool；ReservePool 台账同步 −X | user −X + frozen +X = 净 0 ✅（reserve 不入等式） |
| 确认 | admin 操作 | FrozenPool → 链上转账，**txHash 回写 NTLedger** | frozen −X + total_issued −X = 两边同减 ✅ |
| 驳回 | admin 操作 | FrozenPool → 退回 User.nt_balance；ReservePool 台账回补 +X | frozen −X + user +X = 净 0 ✅ |

门槛：50-200 NT，信誉分 ≥ 60，7 天冷却。
🆕R2 **现行 bug 定性**：代码不用改资金流向，只改 verify() 等式（去 reserve 项 + 加 reserve_covers_frozen）——现行等式含 reserve 导致每完成一笔提现 diff 永久 −X（二营复审实锤）。P0-2 先跑 `SELECT SUM(amount) FROM nt_ledger WHERE type='withdraw' AND status='settled'` 追账，若 = |diff| 则根因坐实，历史 diff 报砚仁签字后一次性核销调平。
🆕R1 提现申请与 cron 调水都动 ReservePool——按 §3.6 全局锁序 acquire，防两路争抢死锁。

### 6.5 夸奖赞誉

免费口头 / 🌹1 NT / 🎁5 NT，走 transfer 通道。

### 6.6 茶馆八卦（半成品）

5 NT/条，走 CampLedger。

---

## 七、每日自动化（cron 00:05）

| 步骤 | 操作 | 条件 |
|------|------|------|
| 1 | 生成周期任务 | 幂等 → OperatingPool 余额够 → 扣池建任务 |
| 2 | 住宿费记账/扣款 | 遍历活跃入住 → 按房费率逐日处理 |
| 3 | 运营池补填 | OperatingPool < 300 → 自动补 20 NT |
| 4 | 盈余划拨 | OperatingPool > 1000 → 超出 500 转 ReservePool |
| 5 | 自动调水 | OperatingPool < 150 且 ReservePool > 0 → 补到 300 |
| **6** | **自动对账** | **调 verify 校验三层等式 + escrow_drift 🆕R2 + reserve_covers_frozen，破裂则告警** |
| **7** | **日终报告** | **生成简报存 Announcement，admin 可见** |

🆕R1 步骤 4 与 5 **串行执行**（§3.6 锁序约束 2），禁止并发互调。

---

## 八、五道财务安全网

### 8.1 自动对账 🆕R2（轻检边界写死 · 二营复审 Q4-3）

- **每日全量**：cron 00:10（日结后 5 分钟）自动调 verify：等式成立 → 写日志；破裂 → 告警 admin + 记录断裂快照。
- 🆕R1 **即时轻检**（二营 Q7 加强）：关键涉钱写入路径（earn / transfer / withdraw 确认 / 任务结算）**事务提交前**做轻量 diff 校验，破裂立即回滚 + 告警。发现窗口从 24h 压到秒级。
- 🆕R2 **轻检边界（写死，防误报）**：
  1. 只算 **NT 字段**（各池 balance + 涉及用户的 nt_balance）增减和 = 0；**排除 CV / XP / contribution_pool**（_grant_from_pool 同事务改 CV/XP、transfer 改 contribution_pool，均属 CV 域，计入必误判）。
  2. `total_issued` 是锚点非池项：topup / 提现确认等改锚点的操作单列对账（锚点变动量必须等于对应池/账变动量）。
  3. 在已持有的行锁内计算，**禁止全表扫**。
  4. 轻检 = delta 式，只拦「本事务新失衡」，**抓不到存量漂移**（存量靠 P0-2 追账 + 每日全量 verify）——文档与代码注释均注明。

### 8.2 链上 txHash 回写

admin 确认提现时：链上转账 → 拿到 txHash → 回写 NTLedger.tx_hash。充值确认同理。审计闭环。
🆕R1 边界重申：txHash 只审计"出系统"的钱，**不作为任何内部结算的信任根**（§2.1 定案）。

### 8.3 日终财务报告

每日自动生成，存 Announcement：
```
📊 2026-07-29 日终报告
  运营池：480 NT（-20）  托管池：300 NT（3 任务）
  储备池：520 NT         待审池：0 NT
  营队池合计：8,200 NT（2 营队）
  总发行：10,000 NT      对账：✅  escrow_drift：0
  今日流水：收入 450 / 支出 65 / 净流入 +385
  活跃用户：8/50    人均余额：1,062 NT
```

### 8.4 大额熔断 🆕R2（下沉出池层 + 数值留余量 · 二营复审 Q3）

🆕R2 **挂载层修正**：熔断**下沉到 `_grant_from_pool` 层**按「资金出池」统一计数，覆盖 earn + card-confirm + 校核奖三路（原绑 /earn 端点方案下，后两路同样从 OperatingPool 出钱却绕过全部熔断）。

| 操作 | 维度一：单收款人 24h | 维度二：系统 24h 总量 | 触发后 |
|------|---------------------|----------------------|--------|
| 资金出池（earn+card-confirm+校核奖，统一计） | 🆕R2 **30,000 NT**（单笔上限 10000 的 3 倍，留并发余量） | 🆕R2 **40,000 NT**（按 50 人运营规模设） | 429 + 复核（见下） |
| topup | — | 100,000 NT | 429 |
| withdraw | 500 NT/用户 | 2,000 NT（全局） | 429 |
| transfer | 🆕R2 不熔断，入异常告警维度（§8.5） | 同左 | 告警不拦截 |

修订要点：
1. **双维度**：既拦单收款人，也拦系统总发放。🆕R2 数值与单笔上限拉开≥×3 差距，避免一笔顶格即锁死全天。
2. **滚动 24h 窗口**（非自然日），堵 23:59+00:01 跨零点翻倍。
3. **按操作 admin + 收款用户双计**：多 admin 账号不放大额度。
4. 🆕R2 **双人复核配置化**（二营复审 Q4-2）：`MIN_REVIEWERS` 可配；单 admin 环境降级为二次确认弹窗 + 审计留痕，不阻断合法大额发奖；其余双人复核 P2 后置。

### 8.5 异常告警

| 规则 | 阈值 | 告警方式 |
|------|------|----------|
| 单用户 1h receive > 10 笔 | 10 | 公告通知 admin |
| 🆕R2 单用户 transfer 24h 累计 > 20,000 NT | 20,000 | 公告通知 admin（不拦截） |
| 单用户余额 1h 增长 > 500% | 500% | 公告通知 admin |
| 运营池 1h 下降 > 50% | 50% | 公告通知 admin |
| 会计等式 diff ≠ 0 或 escrow_drift ≠ 0 或 🆕R2 reserve_covers_frozen 不成立 | 任何 | **最高优先级告警** |

---

## 九、前端配套 🆕R1（新增 · 一营 Q2/Q3/Q5）

### 9.1 资金分布折叠视图（与冻结正名同卡施工）

工作台现有三卡片（营队 NT / 个人 NT / 冻结）下方加小字链接「📊 查看资金分布 →」，点击展开：

```
💰 可用余额        120 NT
🔒 任务托管         30 NT  （3个进行中任务）
⏳ 提现待审         50 NT  （1笔待管理员确认）
🏠 住宿应付        -15 NT  （已住3天，退房时结算）
━━━━━━━━━━━━━━━━━━━━━━━
📊 实际可用        120 NT
```

不增页面、不破坏现有布局。**拆表卡（P1）必须带对应前端子卡，否则不予验收**（一营"白拆"条款）。

### 9.2 字段名契约 🆕R2（契约升 v0.2 · 一营复审全收）

- **NT_FIELD_CONTRACT.md v0.2**（`方案/NT_FIELD_CONTRACT.md`，施工时移入仓库根目录提交 git）：覆盖 /api/nt/sync、/api/nt/pools、/api/nt/verify 🆕R2 **+ /api/data/sync_all**（一营复审：前端双 sync 路径，登录走 sync_all，契约必须两条都覆盖）。**后端改表结构先改契约文件，前端对着改**。
- 🆕R2 v0.2 修订要点（一营复审 5 条全收）：①新增 §6 sync_all key 清单（含 pool_balance）②ALIAS 加 `pool_balance→operating_pool` ③补 tasks[] 内部字段规格 ④**禁复用 frozen_balance**——拆表后直接删旧 key，新发 my_escrow + my_frozen，前端一个版本双读过渡（防语义覆盖型 bug）⑤camp_balance→camp_ledgers 标注 ⚠️ STRUCTURAL CHANGE（int→array，ALIAS 不覆盖，需手动转换函数；拆表期 sync_all 保留 pool_balance 单值 + 新增 pool_detail 渐进迁移）。
- **前端 NT_CONTRACT 别名映射层**（api.js 或新建 nt-contract.js）：SYNC_KEYS / POOL_KEYS 必含字段清单 + ALIAS 映射，读 API 返回值统一走 `ALIAS[oldKey] || oldKey`，非预期 key 打 console.warn。

### 9.3 Toast 文案同步

冻结正名落地同卡内，全量替换前端涉钱提示文案（见 §四）。

### 9.4 熔断 429 前端处理 🆕R2（一营复审新增）

api.js 加 `if (resp.status === 429)` 分支：透传服务端 error message（或 Retry-After 头），toast 具体原因（如「今日提现已达上限」）而非通用「网络异常」。随 P2 熔断卡配套前端子卡施工。

---

## 十、安全防线（不变）

### 涉钱四道通用防线

1. 行级锁 `with_for_update() + populate_existing`
2. 金额服务端取，不信客户端
3. 同事务提交（发奖 + 状态变更原子）
4. 会计等式守恒（三层等式 + escrow_drift + 🆕R2 reserve_covers_frozen，自动校验）

### 权限门控

| 操作 | 权限 |
|------|------|
| 转账/消费/提现申请 | 登录 |
| earn / topup / cashout | admin |
| card-confirm | 登录（禁自校核） |
| 提现确认/驳回 | admin |
| 校核审批 | 登录（禁自校核；个人任务发布者自审除外，见 §2.2） |

---

## 十一、与公约对接（不变）

| 公约条目 | 落地 | 状态 |
|----------|------|------|
| 校核奖励 15% | verifier_reward_pct | 需改（C1） |
| 住宿价目 A-F | BED_RATES | 已一致 |
| 劳动价目 L1-L4 | labor_pricing 45 项 | 需比对（C9） |
| 签署公约发 10 NT | covenant 签署流程 | 待施工 |
| 岗位津贴 1500 NT/月 | 尚无配置 | 待施工 |
| 每周一 15:00 大扫除 | 周期任务模板 | 需改配置 |

---

## 十二、施工路线图 🆕R2（P0 重排五卡 · 二轮复审后）

### P0 · 治标（约 3-3.5 天，不动表结构）

| # | 内容 | 工期 | 施工方 | 说明 |
|---|------|------|--------|------|
| P0-1 | 修社区池=0 联动 bug（卡片确认拒绝+提醒兜底） | 0.5 天 | 二营 | v0 Q4 裁定落地，当前卡死用户 |
| P0-2 | 🆕R2 reserve 语义落地（方案 A）+ 等式追账修复 | 1 天 | 二营 | ①SQL 追账证实根因 ②verify() 去 reserve 项 ③加 reserve_covers_frozen ④历史 diff 报砚仁签字后核销 |
| P0-3 | 自动对账 cron + 等式 diff 告警 + 即时轻检（§8.1 边界） | 0.5 天 | 二营 | 在现有单表上先跑起来 |
| P0-4a | 🆕R2 sync 加 my_escrow / my_frozen / my_accommodation_due 三字段 | 0.5 天 | 二营 | 一营复审：后端先出字段，前端才能渲染 |
| P0-4b | 🆕R2 工作台资金分布折叠视图 + 契约 v0.2 定稿入 git | 0.5 天 | 一营 | 依赖 P0-4a，不混卡 |
| P0-5 | 🆕R2 锁序统一（四热路径翻转 Pool先User后 + transfer 按 user_id 升序 + requires_pg 交叉锁测） | 0.5-1 天 | 二营 | 二营复审实锤现网存量 AB-BA，二营请缨 |

### P1 · 治本（拆表重构，约 4 天，**四项开工前置硬门槛缺一不开工**）

前置：① 🆕R2 P0-5 锁序成果验收通过 ② §3.7 迁移回滚脚本+前后对拍 ③ 每营账本流水重建校验 ④ escrow_drift 入 verify

| # | 内容 | 工期 |
|---|------|------|
| P1-1 | CommunityPool 拆 4 表 + 迁移四件套 + 全量测试 | 2 天 |
| P1-2 | CampLedger 独立表 + 创营/结营资金流改造 | 1.5 天 |
| P1-3 | 三种冻结改名落地（后端字段 + 前端文案同步） + 前端契约层改造 + 🆕R2 停机维护页（§3.7） | 0.5 天 |

### P2 · 加固（约 2 天）

| # | 内容 | 工期 |
|---|------|------|
| P2-1 | 大额熔断（🆕R2 下沉出池层 + 新阈值）+ txHash 回写 + 🆕R2 前端 429 分支（§9.4，一营子卡） | 1 天 |
| P2-2 | 日终报告 + 异常告警 + 月度清算报表 | 1 天 |

**合计约 9-9.5 天**（较 v3 的 8.5-9 天 +0.5 天，换取现网死锁隐患清除与根因修复）。

---

## 十三、待完善项（优先级同步重排）

| # | 项目 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | 池=0 联动 bug 修复 | **P0** | 🆕R1 用户当前被卡 |
| 2 | 🆕R2 reserve 语义落地 + 等式追账修复 | **P0** | 方案 A，07-29「×4」根因候选 |
| 3 | 自动对账 + 即时轻检 | **P0** | 🆕R1 提前到单表阶段 |
| 4 | 资金分布视图 + 字段契约 v0.2 | **P0** | 🆕R2 拆 4a（二营）/4b（一营）两卡 |
| 5 | 🆕R2 锁序统一（四热路径 + PG 锁测） | **P0** | 现网存量 AB-BA 风险 |
| 6 | CommunityPool 拆 4 表 | P1 | 🆕R1 从 P0 降级，带四前置 |
| 7 | CampLedger 独立表 | P1 | 同上 |
| 8 | 三种冻结改名 + 🆕R2 停机维护页 | P1 | 随拆表同卡 |
| 9 | 大额熔断（🆕R2 出池层）+ 🆕R2 前端 429 分支 | P2 | 维度与挂载层修订 |
| 10 | txHash 回写 | P2 | 审计闭环 |
| 11 | 日终报告 / 异常告警 / 月度报表 | P2 | admin 可见性 |
| 12 | 猜牌后端化 / 茶馆八卦 UI / 二手集市 UI | P3 | 半成品 |
| 13 | 赏金任务随机掉落 / 感知层自动定价 / 营队独立多签 | P3 | 远期 |
| 14 | 虚拟账本 + 月结 + 链上 P2P 结算 | 终局蓝图 | 🆕R1 链上 P2P 并入蓝图，不本期施工 |

---

## 十四、端点速查表

| 端点 | 方法 | 权限 | 用途 |
|------|------|------|------|
| `/api/nt/balance` | GET | 登录 | 查余额/CV/XP |
| `/api/nt/sync` | GET | 登录 | 全量同步 |
| `/api/nt/ledger` | GET | 登录 | 查流水 |
| `/api/nt/transfer` | POST | 登录 | 转账（上限 10000） |
| `/api/nt/earn` | POST | admin | 池发奖（熔断见 §8.4） |
| `/api/nt/card-confirm` | POST | 登录 | 卡片确认发奖 |
| `/api/nt/spend` | POST | 登录 | 消费 |
| `/api/nt/topup` | POST | admin | 充值（日上限 100000） |
| `/api/nt/withdraw` | POST | 登录 | 提现申请（熔断见 §8.4） |
| `/api/nt/verify` | GET | 登录 | 三层等式 + escrow_drift + 🆕R2 reserve_covers_frozen 校验 |
| `/api/nt/pools` | GET | 登录 | 各池余额 |
| `/api/nt/deposit-intent` | POST | 登录 | 充值意向 |
| `/api/nt/earn-sync` | POST | 登录 | 离线同步（日上限 5） |
| `/api/nt/verifications/{id}/approve` | POST | 登录 | 校核通过 |
| `/api/nt/verifications/{id}/reject` | POST | 登录 | 校核驳回 |
| `/api/system/daily-tick` | POST | admin | 手动日结 |

---

## 附录 A：设计演进说明

**为什么选即时结算 + 社区池，不选虚拟账本 + 月结？**

原始蓝图（01_身份住宿与NT基础.md + 02_虚拟账本与月度清算.md）设计的是：
- 平台 = 虚拟记账 + P2P 清算引擎，不铸币不持币
- NT 月底 P2P 清算才真正到账
- 每日只记应收/应付

代码现状是：
- CommunityPool 持有实际余额
- 做任务即时到账
- topup 直接增 total_issued

两者是**两种不同的系统**。砚仁裁定维持现状，理由：
1. 20→50 人社区，即时到账的用户体感远优于"月底才看到钱"
2. 会计等式已兜住安全底线
3. 月结需要 web3 钱包签名等基础设施，当前不具备
4. 蓝图作为终局方向保留，待社区规模和基础设施成熟后再迁移

**txHash 审计思路从蓝图中吸收**：虽然不做月结，但每笔"出系统"的钱（提现、充值确认）都回写 txHash，保留链上审计能力。

## 附录 B：第一轮对抗吸收记录 🆕R1

| 来源 | 意见 | 吸收位置 |
|------|------|----------|
| 两营共识 | 否决链上 P2P，定 B 内部托管 | §二 |
| 两营共识 | 三种冻结正名 | §四 |
| 两营共识 | 自动对账+告警 P0 | §8.1/§12 |
| 一营 Q2 | 资金分布视图，拆表带前端子卡 | §9.1 |
| 一营 Q3 | 字段契约文件 + 别名映射层 | §9.2 |
| 一营 Q4 | 拆表降 P1，P0 先修 bug | §12 |
| 一营 Q4 附 | 发布者自校核成立（撤回反对） | §2.2 |
| 一营 Q5 | toast 文案同步 | §四/§9.3 |
| 二营 Q1/Q6 | txHash 攻击面，仅审计用 | §2.1/§8.2 |
| 二营 Q2 | escrow_drift 交叉校验 + 双锁 | §3.5/§5.1 |
| 二营 Q3 | 全局锁序 + cron 串行 + 锁测 | §3.6/§七 |
| 二营 Q4 | 迁移原子性四件套 | §3.7 |
| 二营 Q5 | 熔断三维 | §8.4 |
| 二营 Q7 | 即时轻检 | §8.1 |

## 附录 C：第二轮复审吸收记录 🆕R2

| 来源 | 意见 | 吸收位置 |
|------|------|----------|
| 二营 Q4-1 ❌ | withdraw reserve 扣减破等式（丞相府实证）→ 砚仁批方案 A | §3.5/§6.4/P0-2 |
| 二营 Q2 ❌ | 四热路径锁序反序，存量 AB-BA（丞相府实证）→ 提 P0-5 | §3.6/P0-5 |
| 二营 Q1-② | escrow_drift 口径歧义 → 写死「未领取且未退回份额」 | §3.5 |
| 二营 Q3 | 熔断顶格相等 + card-confirm/校核奖绕过洞 → 下沉出池层，30000/40000 | §8.4 |
| 二营 Q4-2 | 单 admin 双人复核死锁 → MIN_REVIEWERS 配置化 | §8.4 |
| 二营 Q4-3 | 轻检误判 CV/XP/锚点 → 边界四条写死 | §8.1 |
| 一营 Q1-③ | 契约漏 sync_all/pool_balance | 契约 v0.2 §6/§5，本稿 §9.2 |
| 一营 Q2-1 | tasks[] 内部字段无规格 | 契约 v0.2 §1.1 |
| 一营 Q2-2 | frozen_balance 语义覆盖坑 → 禁复用，双读过渡 | 契约 v0.2 §4 |
| 一营 Q2-3 | camp_ledgers 结构变化 ALIAS 不覆盖 → STRUCTURAL CHANGE 标注 + pool_detail 渐进 | 契约 v0.2 §2/§6 |
| 一营 Q3-1 | P0-4 前后端依赖 → 拆 P0-4a/4b | §12 |
| 一营 Q3-2 | 停机无提示 → 维护页子任务 | §3.7/P1-3 |
| 一营 Q3-3 | 429 无处理 → api.js 分支 | §9.4/P2-1 |

---

*丞相修订 · 2026-07-30 · 砚仁批方案 A · 待二营快速复审*
