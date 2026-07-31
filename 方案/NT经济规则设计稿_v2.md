---
title: 南塘云村 · NT 经济规则设计稿 v2（50 人版）
created: 2026-07-29
project: 南塘云村
type: 方案规划
domain: 资金财务
status: 讨论中
phase: 拟票待对抗
summary: 50 人规模架构——池子拆表、营队独立、五道安全网全上、分层会计等式。基于 v1 代码提取 + 三份原始设计文档（01_身份住宿与NT基础 / 01_自动定价机制 / 02_虚拟账本与月度清算）对照后重写。
author: 丞相拟票 · 待豆包 Codex（二营）+ DeepSeek（谏臣）对抗 · 砚仁终审
---

# NT 经济规则设计稿 v2（50 人版）

> **性质**：拟票待对抗（铁律 9 涉钱=宪法级：丞相拟票 → 豆包 Codex（二营）+ DeepSeek（谏臣）对抗一轮 → 砚仁批，未过三视角不生效）。提取代码现状 + 对照原始蓝图 + 砚仁裁定方向后，重新设计的 50 人规模 NT 经济架构。
> **数据基准**：2026-07-29，commit `dcd17fa`。
> **适用规模**：50 人（营队开始后预估）。
> **核心决策**（砚仁 2026-07-29 裁定）：
> - 记账模型：维持即时结算 + 社区池实持（不回归虚拟账本 + 月结）
> - 池子架构：CommunityPool 拆 4 张独立表 + 营队独立账本
> - 安全网：自动对账 + txHash 回写 + 日终报告 + 大额熔断 + 异常告警，全上
> - 远期方向：虚拟账本 + 月结作为终局蓝图保留，本期不施工

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

## 二、四层资金池架构（重构核心）

### 2.0 架构总览

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

### 2.1 个人层

每个 User 一行，`nt_balance` 就是个人钱包。不是"池"，是"自己的钱"。

### 2.2 平台层（拆 4 表）

| 表名 | 用途 | 收入来源 | 支出方向 |
|------|------|----------|----------|
| **OperatingPool** | 日常发放 | 充值 topup、spend 回流、盈余划拨、每日补填 | 任务奖、卡片奖、校核奖、池发奖 |
| **EscrowPool** | 任务托管 | 发布任务冻结（user → escrow） | 审核通过释放、取消退回、仲裁 |
| **ReservePool** | 战略储备 | 链上充值、运营池盈余划拨 | 提现资金来源、自动调水补运营池 |
| **FrozenPool** | 提现待审 | 用户申请提现（balance → frozen） | admin 确认（→ 链上转账）/ 驳回（→ 退回 balance） |

**OperatingPool 额外字段**：
- `total_issued`：全局会计锚点（总发行量）
- `contribution_pool`：CV 磨损 25% 归集
- `last_tick_date`：日结幂等标记

### 2.3 营队层（独立账本）

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

### 2.4 链上层

| 角色 | 地址 | 状态 |
|------|------|------|
| 平台多签 | `PLATFORM_WALLET_ADDRESS` | 已有，用于充值/提现 |
| 营队多签 | `Camp.multisig_address` | 预留字段，远期启用 |

### 2.5 分层会计等式

```
平台层等式：
  total_issued = Σ(user.nt_balance)
               + operating.balance
               + escrow.balance
               + reserve.balance
               + frozen.balance

营队层等式（每营独立）：
  camp.allocated = camp.balance + camp.escrow + Σ(该营已支出到个人)

全局等式：
  total_issued = Σ(user.nt_balance)
               + Σ(平台4池)
               + Σ(各营 balance + escrow)
```

**任何时刻都必须成立。差 1 NT 都是 bug。**

### 2.6 数据迁移方案

```
现有 CommunityPool 单行 → 拆 5 张表：
  balance          → OperatingPool.balance
  task_escrow      → EscrowPool.balance
  reserve          → ReservePool.balance
  frozen           → FrozenPool.balance
  camp_balance     → 按现有营队分配到各 CampLedger 行
  contribution_pool→ OperatingPool.contribution_pool
  total_issued     → OperatingPool.total_issued
```

---

## 三、"冻结"命名规范（三种冻结正名）

| 旧名 | 新名 | 准确含义 | 代码字段 |
|------|------|----------|----------|
| task_escrow | **任务托管** | 发布者的钱暂存，等审核结果 | EscrowPool.balance |
| frozen | **提现待审** | 用户提现申请后等待 admin 确认 | FrozenPool.balance |
| accommodation_due | **住宿应付** | 用户欠社区的住宿费（记账，不动余额） | Tenancy.accommodation_due |

**原则**：不再用"冻结"一词概括所有中间态。每个状态有准确的名字。

---

## 四、收入路径（7 路，不变）

### 4.1 做任务（F2）

| 环节 | 资金流向 | 说明 |
|------|----------|------|
| 发布 | User.nt_balance → EscrowPool | `reward × slots` 托管 |
| 审核通过 | EscrowPool → 每个执行者 User.nt_balance | 每人得 `reward`，+CV +XP |
| 部分领取 | EscrowPool → 发布者 | 未领份额退还 |
| 3 次退回 | EscrowPool → 发布者 | 自动取消退回 |
| 取消 | EscrowPool → 发布者 | 全额退还 |

**营地任务**：EscrowPool 换成 CampLedger.escrow，其余相同。

### 4.2 卡片室发现（F5）

| 环节 | 资金流向 |
|------|----------|
| 发现确认 | OperatingPool → 做事者 User.nt_balance |
| 猜中奖励 | OperatingPool → 发现者 User.nt_balance |

**四道防线**（不变）：禁自校核 / 金额服务端取 / 行锁防并发 / 同事务提交。

### 4.3 校核通过（Verification）

OperatingPool → 做事者 + 校核人。防滥用：1h 冷却 + 日上限 10 次。

### 4.4 池发奖

| 端点 | 权限 | 说明 |
|------|------|------|
| `POST /api/nt/earn` | admin | OperatingPool → 指定用户，单笔上限 10000 |
| `POST /api/nt/card-confirm` | 登录 | 卡片确认，内部调 `_grant_from_pool` |

### 4.5 周期任务（F20）

每日 00:05 cron → 读模板 → 幂等 → OperatingPool 扣款 → EscrowPool 冻结 → 创建 NTTask。

### 4.6 充值

| 方式 | 说明 |
|------|------|
| 链上充值 | chain_scanner 监听 → OperatingPool.balance + total_issued |
| 手动 topup | admin 操作，增 total_issued |
| 社区池注资 | topup user="community_pool" |

### 4.7 转账（user → user）

单笔上限 10000 NT。CV 75% 给接收方，25% 入 OperatingPool.contribution_pool。

---

## 五、支出路径（6 路，不变）

### 5.1 住宿费

accrual 日记账（默认）：每日累加 accommodation_due，退房一次结算。
deduct 日扣（可回滚）：环境变量切换。

房费率：A=20 / B=30 / C=30 / D=60 / E=30 / F=35 NT/晚。

### 5.2 食堂订餐

10 NT/餐，预定扣款，取消退款。

### 5.3 消费（spend）

scope=personal → OperatingPool / scope=camp → CampLedger.balance。

### 5.4 提现（两阶段）

| 阶段 | 操作 | 资金流向 |
|------|------|----------|
| 申请 | 用户操作 | User.nt_balance → FrozenPool，ReservePool 等额扣减 |
| 确认 | admin 操作 | FrozenPool → 链上转账，**txHash 回写 NTLedger** |
| 驳回 | admin 操作 | FrozenPool → 退回 User.nt_balance |

门槛：50-200 NT，信誉分 ≥ 60，7 天冷却。

### 5.5 夸奖赞誉

免费口头 / 🌹1 NT / 🎁5 NT，走 transfer 通道。

### 5.6 茶馆八卦（半成品）

5 NT/条，走 CampLedger。

---

## 六、每日自动化（cron 00:05）

| 步骤 | 操作 | 条件 |
|------|------|------|
| 1 | 生成周期任务 | 幂等 → OperatingPool 余额够 → 扣池建任务 |
| 2 | 住宿费记账/扣款 | 遍历活跃入住 → 按房费率逐日处理 |
| 3 | 运营池补填 | OperatingPool < 300 → 自动补 20 NT |
| 4 | 盈余划拨 | OperatingPool > 1000 → 超出 500 转 ReservePool |
| 5 | 自动调水 | OperatingPool < 150 且 ReservePool > 0 → 补到 300 |
| **6** | **自动对账** | **调 verify 校验三层等式，破裂则告警** |
| **7** | **日终报告** | **生成简报存 Announcement，admin 可见** |

---

## 七、五道财务安全网（新增）

### 7.1 自动对账

每日 cron 00:10（日结后 5 分钟）自动调 verify：
- 等式成立 → 写日志
- 等式破裂 → 告警 admin + 记录断裂快照

### 7.2 链上 txHash 回写

admin 确认提现时：链上转账 → 拿到 txHash → 回写 NTLedger.tx_hash。
充值确认时同理。审计闭环。

### 7.3 日终财务报告

每日自动生成，存 Announcement：
```
📊 2026-07-29 日终报告
  运营池：480 NT（-20）  托管池：300 NT（3 任务）
  储备池：520 NT         待审池：0 NT
  营队池合计：8,200 NT（2 营队）
  总发行：10,000 NT      对账：✅
  今日流水：收入 450 / 支出 65 / 净流入 +385
  活跃用户：8/50    人均余额：1,062 NT
```

### 7.4 大额熔断

| 操作 | 日累计上限 | 触发后 |
|------|-----------|--------|
| earn（admin 发奖） | 50,000 NT | 429 + 需其他 admin 确认 |
| topup | 100,000 NT | 429 |
| withdraw（单用户） | 500 NT | 429 |

### 7.5 异常告警

| 规则 | 阈值 | 告警方式 |
|------|------|----------|
| 单用户 1h receive > 10 笔 | 10 | 公告通知 admin |
| 单用户余额 1h 增长 > 500% | 500% | 公告通知 admin |
| 运营池 1h 下降 > 50% | 50% | 公告通知 admin |
| 会计等式 diff > 0 | 任何 | **最高优先级告警** |

---

## 八、安全防线（不变）

### 涉钱四道通用防线

1. 行级锁 `with_for_update() + populate_existing`
2. 金额服务端取，不信客户端
3. 同事务提交（发奖 + 状态变更原子）
4. 会计等式守恒（三层等式，自动校验）

### 权限门控

| 操作 | 权限 |
|------|------|
| 转账/消费/提现申请 | 登录 |
| earn / topup / cashout | admin |
| card-confirm | 登录（禁自校核） |
| 提现确认/驳回 | admin |
| 校核审批 | 登录（禁自校核） |

---

## 九、与公约对接（不变）

| 公约条目 | 落地 | 状态 |
|----------|------|------|
| 校核奖励 15% | verifier_reward_pct | 需改（C1） |
| 住宿价目 A-F | BED_RATES | 已一致 |
| 劳动价目 L1-L4 | labor_pricing 45 项 | 需比对（C9） |
| 签署公约发 10 NT | covenant 签署流程 | 待施工 |
| 岗位津贴 1500 NT/月 | 尚无配置 | 待施工 |
| 每周一 15:00 大扫除 | 周期任务模板 | 需改配置 |

---

## 十、待完善项

| # | 项目 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | CommunityPool 拆 4 表 | **P0** | 50 人基础架构 |
| 2 | CampLedger 独立表 | **P0** | 营队财务独立 |
| 3 | 自动对账 | **P0** | 日结后自动校验 |
| 4 | txHash 回写 | **P0** | 审计闭环 |
| 5 | 日终报告 | P1 | admin 可见性 |
| 6 | 大额熔断 | P1 | 防刷防误 |
| 7 | 异常告警 | P1 | 风控前置 |
| 8 | 月度清算报表 | P1 | 50 人财务透明 |
| 9 | 三种冻结改名 | P0 | 命名规范落地 |
| 10 | 猜牌后端化 | P2 | 可选 |
| 11 | 茶馆八卦 UI | P2 | 半成品 |
| 12 | 二手集市 UI | P2 | 半成品 |
| 13 | 赏金任务随机掉落 | P3 | 远期 |
| 14 | 感知层自动定价 | P3 | 蓝图保留，远期 |
| 15 | 营队独立多签 | P3 | 预留字段，远期启用 |
| 16 | 虚拟账本 + 月结 | 终局蓝图 | 不本期施工 |

---

## 十一、端点速查表

| 端点 | 方法 | 权限 | 用途 |
|------|------|------|------|
| `/api/nt/balance` | GET | 登录 | 查余额/CV/XP |
| `/api/nt/sync` | GET | 登录 | 全量同步 |
| `/api/nt/ledger` | GET | 登录 | 查流水 |
| `/api/nt/transfer` | POST | 登录 | 转账（上限 10000） |
| `/api/nt/earn` | POST | admin | 池发奖（日上限 50000） |
| `/api/nt/card-confirm` | POST | 登录 | 卡片确认发奖 |
| `/api/nt/spend` | POST | 登录 | 消费 |
| `/api/nt/topup` | POST | admin | 充值（日上限 100000） |
| `/api/nt/withdraw` | POST | 登录 | 提现申请（日上限 500） |
| `/api/nt/verify` | GET | 登录 | 三层等式校验 |
| `/api/nt/pools` | GET | 登录 | 各池余额 |
| `/api/nt/deposit-intent` | POST | 登录 | 充值意向 |
| `/api/nt/earn-sync` | POST | 登录 | 离线同步（日上限 5） |
| `/api/nt/verifications/{id}/approve` | POST | 登录 | 校核通过 |
| `/api/nt/verifications/{id}/reject` | POST | 登录 | 校核驳回 |
| `/api/system/daily-tick` | POST | admin | 手动日结 |

---

## 十二、施工路线图

| 阶段 | 内容 | 工期 | 前置 |
|------|------|------|------|
| P1 | CommunityPool 拆 4 表 + 数据迁移 + 全量测试 | 2 天 | 无 |
| P2 | CampLedger 独立表 + 创营/结营资金流改造 | 1.5 天 | P1 |
| P3 | 自动对账 + txHash 回写 | 1 天 | P1 |
| P4 | 日终报告 + 大额熔断 + 异常告警 | 1.5 天 | P1 |
| P5 | 月度清算报表 + 三层等式全量验证 | 1 天 | P1+P2 |
| P6 | 设计稿定稿 + 三种冻结改名落地 | 1 天 | P1-P5 |
| **合计** | | **8 天** | |

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

---

*丞相起草 · 2026-07-29 · 待 DeepSeek / 豆包 / 砚仁 三方审查*
