# Step 4：NT/CV/XP 三层扩展（重写版）

> 来源文档：`南塘NT经济系统_完整设计.md`、`01_身份住宿与NT基础.md`
> 前置依赖：Step 3（打扫系统——NT 操作点多了才有东西可测）
> 解锁：Step 5（社区活动）、Step 6（时间线）
> **⚠️ 重写原因**：代码审查发现 `nt-core.js`（567行）已实现任务生命周期+托管+批量清算+CV/XP字段，Step 4 从「从零建」改为「补全 nt-core.js」。

---

## 当前代码现状

### 已有资产（nt-core.js）

| 能力 | 状态 | 暴露 API |
|------|:--:|------|
| 用户注册（含 CV/XP 字段） | ✅ | `NT.registerUser(id, initialDeposit)` |
| 任务生命周期（冻结→接取→完成→验证→释放） | ✅ | `NT.createTask / acceptTask / submitTask / verifyTask / cancelTask` |
| 虚拟账本复式记账 | ✅ | `LEDGER[]` + 内部 `_addLedger`，7 种交易类型 |
| 批量净额清算（最短路径匹配） | ✅ | `NT.batchSettle()` |
| 简化 earn/spend/transfer | ✅ | `NT.earn / spend / transfer` |
| 充值/提现（外部 NT 进出） | ✅ | `NT.topUp / cashOut` |
| 会计验证 | ✅ | `NT.verify()` —— 等式：sum(users) + SYSTEM_POOL + TASK_ESCROW = _totalIssued |
| XP 递增 | ✅ earn() 内 `u.experienceValue += amount` |
| CV 递增 | ❌ CV 字段存在但 **从未被修改** |
| CV 转移规则 (75/25) | ❌ |
| 公共贡献池 | ❌ |
| CV 门槛检查 | ❌ |
| CV 负值处理 | ❌ |
| 用户数据持久化 | ✅ localStorage key = `nt_core_v1` |

### 需要清理的旧系统

| 文件 | 问题 | 处理方式 |
|------|------|---------|
| `nt.js` (239行) | `recordTransaction` 写 `data.finance[]`，与 nt-core.js 的 LEDGER 是两套账 | 废弃：`recordTransaction` → 改为调用 `NT.earn/spend/transfer`，`verifyLedgerBalance` → 改为 `NT.verify()` |
| `mobile-bundle.js` (307行) | 内含 `saveData()` + 独立交易逻辑，部分重复 nt-core.js | 保留 `saveData()` 作为 UI 数据层保存入口；交易逻辑迁到调 NT API |
| `app-data.js` (186行) | `_currentUser: '砚仁'` 硬编码；`new Date().toISOString().slice(0,10)` UTC+8 bug | 修复 |

### 两套 NT 系统的数据隔离问题

```
nt-core.js → localStorage 'nt_core_v1'   → NT.earn() 写 LEDGER
nt.js      → localStorage 'camp_data'    → recordTransaction() 写 data.finance

当前：两个系统互不相通。NT.earn() 加的余额，data.finance 里看不到。
目标：nt-core.js 为唯一真相源。旧 nt.js 的函数改为调用 NT.* 的薄封装。
```

---

## 做什么

在 nt-core.js 已有基础设施上补全 CV/XP 三层模型 + 公共贡献池 + CV 门槛。废弃旧的 `nt.js` 交易函数，统一所有 NT 操作走 `window.NT.*`。

## 关键设计决策

- **nt-core.js 是唯一 NT 真相源**。所有 NT/CV/XP 操作必须走 `NT.xxx()`，不直接操作 `data.finance`
- NT 余额即时显示变化（用户感知）：订餐花 15 NT → 立刻看到余额减 15。链上转账月底批量执行（技术实现）：用户 A→B 的 50 笔 NT 流水汇总为 1 笔链上净额转账。两者通过虚拟账本解耦
- CV 和 XP 即时生效（链下记分），NT 月底 P2P 清算
- **旧 nt.js 不删**——原有函数改为调用 NT API 的薄封装，避免改动所有调用点
- 公共贡献池是一个虚拟用户 `userId = '__public_pool__'`，注册在 USERS 中，只持有 CV，不持有 NT

## 三层价值体系

```
① NT（链上代币）：南塘 DAO 发行，平台不铸不毁
② 贡献值(CV)：= 劳动所得 − 消费支出 + 接收转移
   决定社区权限：买画、发委托、预定优先
   消费时：75% → 卖家 + 25% → 公共池（磨损）
③ 经验值(XP)：= 所有劳动所得 CV 的永久累计
   解锁权限：陪审团资格需 ≥500 XP
```

---

## 具体任务

### 4.0 前置：调查 + 建立调用清单

| # | 任务 | 说明 |
|---|------|------|
| 4.0.1 | grep 所有 `recordTransaction(` 调用点 | 查明哪些地方还在用旧 API，列替换清单 |
| 4.0.2 | grep 所有 `calcNtTotal\|calcNtByScope\|verifyLedgerBalance` | 查明旧查询函数的调用点 |
| 4.0.3 | grep 所有 `data.finance` 直接读写 | 找绕过 API 的裸操作 |
| 4.0.4 | 确认 `nt-core.js` 和 `app-data.js` 的用户 ID 体系是否一致 | 名字 vs UID——两边可能用不同的标识符 |

### 4.1 补全 nt-core.js：CV 核心逻辑

| # | 任务 | 说明 |
|---|------|------|
| 4.1.1 | `NT.earn()` 加 CV 递增 | 当前只加 XP，改为 `u.contributionValue += amount; u.experienceValue += amount`。劳动 = NT + CV + XP 三栏同增 |
| 4.1.2 | `NT.spend()` 加 CV 递减 | 当前只减 NT余额，改为同时 `u.contributionValue -= amount`。消费消耗 CV |
| 4.1.3 | `NT.transfer()` 加 CV 转移规则 | 转账时：CV 75% → 接收方 + 25% → 公共池磨损。NT 100% 照常转 |
| 4.1.4 | 注册公共贡献池 | `NT.registerUser('__public_pool__', 0)` —— 虚拟用户，只 track CV |
| 4.1.5 | `NT.getCV(userId)` / `NT.getXP(userId)` | 查询接口 |

### 4.2 补全 nt-core.js：CV 门槛 + 负值处理

| # | 任务 | 说明 |
|---|------|------|
| 4.2.1 | `NT.checkCvGate(userId, action)` | 返回 `{pass, required, current}`。门槛：发布委托 CV≥0、购买作品 CV≥卖家设定值、发起提案 CV≥500、陪审团 XP≥500 |
| 4.2.2 | `NT.getCvStatus(userId)` | 返回 CV 状态：正常 / 🟠连续2周为负 / 🔴连续4周为负 |
| 4.2.3 | CV 周快照 | 每周记录一次 CV 值到 `user.cvHistory[]`，用于判断连续负值 |

### 4.3 废弃旧 nt.js 交易函数

| # | 任务 | 说明 |
|---|------|------|
| 4.3.1 | `recordTransaction()` → 薄封装 | 改为内部调 `NT.earn/spend/transfer`，保持旧签名兼容。加 `console.warn` 标记废弃 |
| 4.3.2 | `calcNtTotal()` / `calcNtByScope()` → 读 `NT.getUser()` | 从读 `data.finance` 遍历改为读 `NT.getUser(id).ntBalance` |
| 4.3.3 | `verifyLedgerBalance()` → 调 `NT.verify()` | 薄封装 |
| 4.3.4 | `calcFrozenBalance()` / `calcAvailableBalance()` → 改造 | 需要对照 nt-core.js 的 TASK_ESCROW 概念重新实现 |

### 4.4 修复 app-data.js

| # | 任务 | 说明 |
|---|------|------|
| 4.4.1 | 修复 `_currentUser` 硬编码 | `'砚仁'` → 从登录态/session 读取 |
| 4.4.2 | 修复 UTC+8 bug | `new Date().toISOString().slice(0,10)` → `Clock.today()` |
| 4.4.3 | 修复 `_seedIfEmpty()` | 如有种子数据 → 清空（配合 Step 1） |

### 4.5 个人三栏 UI

| # | 任务 | 说明 |
|---|------|------|
| 4.5.1 | 个人资料卡显示 NT🪙 / CV💠 / XP⭐ | 调用 `NT.getUser(currentUser).ntBalance / .contributionValue / .experienceValue` |
| 4.5.2 | CV 状态提示 | 负值时在 UI 显示警告颜色 |

### 4.6 改造已有 NT 操作点

| # | 任务 | 说明 |
|---|------|------|
| 4.6.1 | 打扫系统（Step 3）NT 奖励 | `recordTransaction({type:'cleaning', amount:40})` → `NT.earn(userId, 40, '打扫:厨房', 'camp')` |
| 4.6.2 | 物品操作（Step 2）NT 奖励 | 放入/消耗的 +2/+1 改为调 `NT.earn()` |
| 4.6.3 | 所有 `data.finance.push` → 改为调 NT API | 逐步替换，每改一处验证 |

---

## 验证

- `NT.verify()` 全部维度通过（含 CV 维度）
- 打扫获得 +40 NT +40 CV +40 XP（`NT.earn`）
- 转账 200 NT：发送方 -200 NT -200 CV，接收方 +200 NT，接收方 +150 CV（75%），公共池 +50 CV（25%）
- `NT.checkCvGate('小红', 'post_task')` → `{pass: true, required: 0, current: 240}`
- CV 连续 2 周为负 → `NT.getCvStatus()` 返回警告
- 旧 `recordTransaction` 调用仍正常工作（薄封装兼容）
- `Clock.today()` 在 app-data.js 中替换后，凌晨注册不再出现昨天日期
