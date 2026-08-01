# SSOT-CHAIN：链上为底账 — 修复方案

> 状态：**v2 修订**（复审中）  
> 作者：丞相（Kimi Work）施工 v1，Claude Code 修订 v2  
> 日期：2026-08-01  
> 触发：砚仁向多签钱包充入 1000 NT（1 NT + 999 NT），但系统账上只显示 500  
> **v2 修订原因**：太傅 + 皇帝审查打回，纠正 v1 中 reserve 入等式导致的提现破守恒等 3 个实证问题

---

## 一、背景

砚仁从个人钱包 `0xeb55…86ac` 向多签钱包 `0xf0aa…1a0d` 转入 1000 NT（两笔：2026-07-21 的 1 NT + 2026-08-01 的 999 NT）。链路确认已到账，但系统线上账目仍是 500。

## 二、铁律

> **所有人余额 + 社区池 + 任务托管 + 营队池 + 冻结 + 储备 == 多签钱包链上余额**

链上的 NT 余额是底账（source of truth），系统账本是副本。副本必须和底账一致。

## 三、根因分析：四个违反铁律的位置

### ③① 新库凭空发币（database.py + nt_helpers.py）

`CommunityPool` 首次创建时写死 `balance=500, total_issued=500`，链上一分钱没有时账上就有 500。`/verify` 右边用的是 `total_issued`（系统自己记的数），充值时两边同涨 → 永远"平"，永远验不出钱是否真存在。

**涉及位置：**
- `database.py:199` — 新库建池
- `nt_helpers.py:46-47` — 空池时 _get_pool 自动创建

### ③② 重置工具写死 500（routes/admin.py）

`/api/admin/dev-reset` 的 soft/hard 两种模式都写死 `balance=500, total_issued=500`。链上实际 1000 时，跑一次重置 → 池子被打回 500 → 凭空蒸发 500 NT。

**涉及位置：**
- `routes/admin.py` — hard-reset（原 `balance=500`）
- `routes/admin.py` — soft-reset（原 `balance=500; total_issued=500`）

### ③③ dev-seed 印钱（routes/admin.py）

`dev-seed` 有 "补池至 500" 逻辑：池子 < 500 时 `pool.balance += diff; total_issued += diff`。链上没有对应的 NT，补出来的部分永远无法兑付。

**涉及位置：**
- `routes/admin.py` — `dev_seed()` 函数

### ③④ reserve 被排除在对账等式外 + 重复记账（routes/nt.py + chain_scanner.py）

`/verify` 的等式把 `reserve` 排除在外（NT-P0-2 的改动），而扫链充值恰好记入 `pool.reserve += amount`。真钱藏在看不见的格子 → 对账永远"平"。

更致命的是：旧扫链代码同时做了 `user.nt_balance += amount` 和 `pool.reserve += amount`，**同一笔钱记了两处**。但因为 reserve 被排除在等式外，这个重复从未被发现。一旦 reserve 回归等式，旧逻辑会直接造成不平。

**涉及位置：**
- `chain_scanner.py` — `_process_log()` 入账逻辑
- `routes/nt.py:589` — `/verify` 的 `total_system` 等式

### 附：999 NT 为什么没自动入账

扫链认人靠 "转出地址 → 绑定用户"。`0xeb55…86ac` 未绑在任何账号上，扫链扫到这笔只会打告警跳过。且原实现只有 "个人充值" 一种钱路——即使绑了，1000 NT 会全部记成砚仁个人余额，社区池反而空。**缺少 "社区资本金" 这个概念。**

## 四、设计

### 4.1 新增概念：资本金来源（Capital Source）

从指定地址转入多签的 NT → **全额进社区池**，不记入任何个人余额。其余地址 → 视为个人充值 → 进个人余额。

配置方式：环境变量 `NT_CAPITAL_SOURCES`，逗号分隔地址列表，大小写不敏感。

```
NT_CAPITAL_SOURCES=0xeb558cfa7cf4e1a8e1b79d7446f21c41a34c86ac
```

### 4.2 池子起始值：0

新库/空池一律从 0 开始。钱只能从链上进来（扫链 + 资本金入池）。账上每一分都有链上凭据。

### 4.3 重置工具：对齐链上

dev-reset（soft/hard）不再写死任何数字，改为读多签钱包链上余额来定池子。读不到链时置 0（宁可偏少不可凭空多记）。

dev-seed 删除 "补池至 500" 逻辑。测试需要池子有钱 → 往多签钱包真充 NT。

### 4.4 对账等式：reserve 不等于式项（v2 修正）

```
total_system = 用户余额合计 + community_pool + task_escrow + camp_balance + frozen
```

**reserve 不等于式独立项。** 它是 `pool.balance` 的内部额控（提现上限），资金已在 `pool.balance` 内，单独计入会 double-count。

**v1 错误**：将 reserve 加入等式。后果——提现流程 `user→reserve→frozen` 时：
```
withdraw_request: reserve-=N, frozen+=N → total_system-N（total_issued 不变→不平）
reject_withdraw:  frozen-=N, reserve+=N, user+=N → total_system+N（凭空多出钱→不平）
```

**v2 修正**：reserve 从等式中移除。链上充值已正确进 `pool.balance`（不再藏 reserve），故 reserve 无需在等式内。它仅作为提现额控——`reserve_covers_frozen` 检查仍保留。

### 4.5 链上对账端点（真对账）

新增 `GET /api/nt/reconcile-chain`。与 `/verify` 的区别：

| | `/verify` | `/reconcile-chain` |
|---|---|---|
| 右边 | `total_issued`（系统自记） | 链上真余额（调用 RPC） |
| 性质 | 自证闭环 | 底账验证 |
| 能发现 | 内部一致性错误 | 钱是否真存在 |

### 4.6 每日自动链上对账

每日 cron 自动跑 `_chain_reconcile()`，不平即 `logger.critical` 告警。不阻断日结（链上 RPC 可能临时不可用），但差额必须大声喊。

### 4.7 历史补录（幂等）

那笔 2026-07-21 的 1 NT 落在扫链游标之前（47 万块），远超免费节点归档窗口，永远追不回。在 `database.py` 的 `init_db` 中按 `tx_hash` 幂等补录——已有同 hash 账则跳过，重启不重复。

### 4.8 资本金同时设 reserve 为提现额控（v2 新增）

资本金进入 `pool.balance` 时，同步设置 `pool.reserve`：
```
pool.balance += amount        ← 社区运营池
pool.reserve += amount        ← 提现额控（≤ pool.balance，非独立资金）
pool.total_issued += amount   ← 发行总量
```

**reserve 始终 ≤ pool.balance**，是 balance 的内部子项，不是独立资金池。
这样提现时有额控可用（`reserve - frozen ≥ withdraw_amount`），资金本身在 balance 内只计一次。

> N-1b（W7-NT-1 A'）: 该不变量已由 `_get_pool` clamp + `/verify` `reserve_within_balance` 代码强制，不再"碰巧成立"。

### 4.9 修正重复计数 bug（v1 已做，保留）

个人充值的旧逻辑：
```
user.nt_balance += amount   ← 记一笔
pool.reserve += amount      ← 同一笔又记一次 ✗
```

新逻辑：
```
user.nt_balance += amount   ← 只记一笔
pool.total_issued += amount ← 发行总量跟踪
```
个人充值不再碰 reserve。reserve 仅由资本金路径设置。

## 五、代码改动清单

全部改动在 `server/` 下，7 个文件，+293/-57 行。已通过 13 个单元测试。

### 5.1 `server/chain_scanner.py`（+53/-4）

| 改动 | 说明 |
|------|------|
| 新增 `CAPITAL_SOURCES` | 从 `NT_CAPITAL_SOURCES` 环境变量解析，set 结构，小写比较 |
| 新增 `_is_capital_source(addr)` | 判断地址是否为资本金来源，大小写不敏感 |
| `_process_log()` 入账分叉 | 资本金 → `pool.balance += amount` + `deposit_capital` 账类；个人 → `user.nt_balance += amount` + `deposit_onchain` 账类 |
| 删除 `pool.reserve += amount` | 修正重复计数 bug |
| ledger 写入改用分流变量 | `to_user` / `type` / `reason` 按资本金/个人分别取值 |
| 日志区分 | kind=`capital->pool` / `personal` |

### 5.2 `server/database.py`（+53/-12）

| 改动 | 说明 |
|------|------|
| 新建池子从 0 开始 | `balance=0, total_issued=0`，不再写死 500 |
| 新增 `BACKFILL_DEPOSITS` | 历史充值补录列表，按 `tx_hash` 幂等 |
| 补录逻辑 | init_db 末尾逐笔检查 → 已有账跳过 → 否则入池 + 写 ledger |

### 5.3 `server/nt_helpers.py`（+4/-2）

| 改动 | 说明 |
|------|------|
| `_get_pool` 空池创建 | `balance=0, total_issued=0`，不再写死 500 |

### 5.4 `server/routes/admin.py`（+86/-28）

| 改动 | 说明 |
|------|------|
| 新增 `import logging` + logger | admin 模块原无 logger |
| 新增 `_chain_balance_or_none()` | 读多签钱包链上 NT 余额，失败返 None |
| 新增 `_reset_pool_to_chain()` | 重置后池子对齐链上余额，读不到链置 0，写 `pool_init` ledger |
| hard-reset 改造 | 建空池 → `_reset_pool_to_chain()` |
| soft-reset 改造 | `_reset_pool_to_chain()` |
| dev-seed 改造 | 删除 "补池至 500" → `pool:unchanged` |

### 5.5 `server/routes/nt.py`（+83/-5）

| 改动 | 说明 |
|------|------|
| `/verify` 等式 | `total_system` 不含 `reserve`（v2 修正：reserve 是 pool.balance 内部额控，非独立资金）|
| `/verify` 返回注释 | reserve 标注回归 |
| 新增 `_read_chain_balance()` | 共享的链上余额读取函数，供 reconcile 和 cron 复用 |
| 新增 `GET /reconcile-chain` | 链上对账端点（admin only），返回 `balanced` + `diff` + `hint` + `breakdown` |

### 5.6 `server/cron.py`（+42/-0）

| 改动 | 说明 |
|------|------|
| 新增 `_chain_reconcile()` | 每日会计检查后自动跑，读链上余额校账本，不平即 `logger.critical/error` |
| `_run_tick()` 调用链 | 在会计检查之后插入 `await _chain_reconcile()` |

### 5.7 `server/tests/test_p0_ssot_chain.py`（新增，204 行）

13 个测试，覆盖：

| # | 测试 | 类型 |
|---|------|------|
| 1 | `test_new_pool_starts_at_zero_not_500` | 禁凭空发币（静态检查） |
| 2 | `test_get_pool_creates_zero_pool` | 禁凭空发币（运行时验证） |
| 3 | `test_dev_reset_does_not_hardcode_500` | 重置不对齐（静态检查） |
| 4 | `test_dev_seed_no_longer_mints_to_500` | 禁止印钱（静态检查） |
| 5 | `test_reset_pool_to_chain_uses_zero_when_chain_unreadable` | 链不可用时置 0 |
| 6 | `test_reset_pool_aligns_to_chain_balance` | 链上 1000 → 账上 1000 |
| 7 | `test_verify_equation_excludes_reserve` | reserve 不算等式项（AST 验证） |
| 8 | `test_reconcile_chain_endpoint_exists_and_uses_chain` | 真对账端点存在且不引用 total_issued |
| 9 | `test_cron_has_daily_chain_reconcile` | 每日自动对账 |
| 10 | `test_capital_source_routes_to_pool_not_personal` | 资本金入池不分叉 |
| 11 | `test_capital_source_matching_is_case_insensitive` | 地址大小写不敏感 |
| 12 | `test_personal_deposit_no_longer_double_counts` | 个人充值不再 reserve 重复记 |
| 13 | `test_backfill_is_idempotent_by_txhash` | 补录幂等 |

运行命令：
```bash
cd server
$env:PYTHONUTF8='1'; $env:JWT_SECRET='<测试值>'
.\..\.venv\Scripts\python.exe -m pytest tests/test_p0_ssot_chain.py tests/test_nt_reserve_equation.py -q
```

### 5.8 `server/chain_scanner.py` — 补充修复（审查发现，待施工，+15/-10）

**问题**：`_process_log()` 中 `_is_capital_source(from_addr)` 在用户匹配之后（第 353 行）。如果资本金地址没绑用户 → 第 337-342 行直接 return → 资本金逻辑永远走不到。详见 §七。

**修复**：将资本金判断提前到用户匹配之前。

```python
# 改动点：_process_log() 第 331-362 行，调整执行顺序

# 旧流程：匹配用户 → 无用户 return → 判资本金
# 新流程：判资本金 → 资本金则跳过用户匹配 → 分叉入账

is_capital = _is_capital_source(from_addr)

if not is_capital:
    # 个人充值：必须匹配用户（行锁防并发充值覆盖）
    user_result = await db.execute(
        select(User).where(func.lower(User.wallet_address) == from_addr.lower())
        .with_for_update()
    )
    user = user_result.scalar_one_or_none()
    if not user:
        logger.error("[scanner][ALERT] 收到未知钱包转入, 无法入账...")
        return
    # Find matching pending intent
    intent = ...
else:
    # 资本金：无需用户匹配，钱直接进社区池
    user = None
    intent = None

pool = await _get_pool(db)

if is_capital:
    pool.balance += amount
    pool.total_issued += amount
    ledger_to = "community_pool"
    ledger_type = "deposit_capital"
    ...
else:
    user.nt_balance += amount
    ...
```

**注意**：此修复需要同步更新测试 `test_capital_source_routes_to_pool_not_personal` 以验证资本金不依赖用户匹配。

### 5.9 文件汇总

| 文件 | 改动量 | 状态 |
|------|--------|------|
| `server/chain_scanner.py` | +70/-15 | 待合并 5.8 补充修复 |
| `server/database.py` | +53/-12 | 已完成 |
| `server/nt_helpers.py` | +4/-2 | 已完成 |
| `server/routes/admin.py` | +86/-28 | 已完成 |
| `server/routes/nt.py` | +83/-5 | 已完成 |
| `server/cron.py` | +42/-0 | 已完成 |
| `server/tests/test_p0_ssot_chain.py` | 新增 204 行 | 待补充资本金无用户测试 |
| **合计** | **+357/-62** | |

## 六、部署步骤

### 步骤 1：提交代码

```bash
git add server/chain_scanner.py server/database.py server/nt_helpers.py \
        server/routes/admin.py server/routes/nt.py server/cron.py \
        server/tests/test_p0_ssot_chain.py server/tests/test_nt_reserve_equation.py
git commit -m "fix(SSOT-CHAIN): 链上为底账——禁凭空发币+资本金入池+reserve回归+链上对账"
git push
```

### 步骤 2：部署到 Render

触发 Render 自动部署（push 到 master 后自动触发，或手动 deploy）。

### 步骤 3：配置环境变量

在 Render Dashboard 添加：

```
NT_CAPITAL_SOURCES=0xeb558cfa7cf4e1a8e1b79d7446f21c41a34c86ac
```

**重要**：此变量必须在步骤 4 之前配好，否则 hard-reset 时读不到资本金来源，链上 1000 会被当作未知钱包转入告警（不会入账）。

### 步骤 4：执行 soft-reset 对齐链上

**用 soft-reset，不要用 hard-reset。** hard-reset 会删除所有 User → 没人能登录 → 死锁。soft-reset 保留用户，只清业务表 + 对齐链上。

```
POST /api/admin/dev-reset?mode=soft
Authorization: Bearer <admin-token>
```

前提：`DEV_TOOLS_ENABLED=true` 已在 Render 配好。

soft-reset 会：
1. 保留所有 User（砚仁、111 等）
2. 清空 NTTask、Verification、NTLedger 等业务表
3. 调 `_reset_pool_to_chain` → 读链上余额 → pool 设为 1000
4. 写 ledger 记录 "社区池对齐链上余额（dev-reset soft）"

### 步骤 5：绑定钱包地址

将 `0xeb558cfa7cf4e1a8e1b79d7446f21c41a34c86ac` 绑定到砚仁的账号：

```
POST /api/auth/bind-wallet
Body: { "wallet_address": "0xeb558cfa7cf4e1a8e1b79d7446f21c41a34c86ac" }
```

**注意**：虽然地址绑在砚仁账号上，但因为它在 `NT_CAPITAL_SOURCES` 名单里，从它转入的 NT 会进社区池，不会进个人余额。

### 步骤 6：验证

```bash
# 1. 查看池子状态
GET /api/nt/pools
# 期望: {"community_pool": 1000, "total_issued": 1000, ...}

# 2. 查看 ledger
GET /api/nt/ledger
# 期望: 有 pool_init 记录（amount=1000）

# 3. 链上对账（最关键）
GET /api/nt/reconcile-chain
# 期望: {"ok": true, "balanced": true, "chain_balance": 1000, "book_total": 1000, "diff": 0}

# 4. 旧 verify（作为对比）
GET /api/nt/verify
# 期望: {"pass": true, "diff": 0}
```

## 七、审查发现：一个未修复的 bug

### 7.0 资本金检查在用户匹配之后（`chain_scanner.py:_process_log`）

**问题**：当前代码流程是：

```
1. 解析 tx log
2. 按 tx_hash 去重
3. 按 from_addr 匹配 User（wallet_address）  ← 第 333 行
4. 如果没匹配到用户 → alert + return        ← 第 337-342 行
5. 获取 pool
6. _is_capital_source(from_addr)             ← 第 353 行，永远走不到！
7. 分叉：资本金入池 / 个人入余额
```

步骤 6 在步骤 4 的 `return` 之后。如果资本金来源地址没有绑在任何用户账号上，扫链会在步骤 4 直接返回，永远到不了资本金分叉逻辑。

**影响**：
- 部署后如果忘记绑钱包 → 后续充值扫链会报 unknown wallet 告警，钱不会入账
- 对账会永远显示「链上比账上多」

**修复**：在用户匹配**之前**先判断是否资本金来源。资本金来源跳过用户匹配（钱进池子，不需要绑定用户）。

```python
# 修复后的流程（chain_scanner.py _process_log）：
is_capital = _is_capital_source(from_addr)

if not is_capital:
    # 个人充值：必须匹配用户
    user = ...
    if not user:
        logger.error("unknown wallet...")
        return
else:
    # 资本金：不需要匹配用户，直接进池
    user = None  # 跳过用户匹配

pool = await _get_pool(db)

if is_capital:
    pool.balance += amount
    pool.total_issued += amount
    ...
else:
    user.nt_balance += amount
    ...
```

**此修复已纳入下方的「补充改动」清单。**

## 八、安全注意事项

### 8.1 DEV_TOOLS_ENABLED

在部署前确保 `DEV_TOOLS_ENABLED=true` 仅在 Render 上临时开启。重置完成后建议关掉，避免误操作。

### 8.2 hard-reset 会删数据

hard-reset 删除所有 User、NTTask、Verification、NTLedger 等。内测阶段可接受，但执行前确认没有需要保留的数据。

### 8.3 链上 RPC 依赖

`_chain_balance_or_none` 和 `_read_chain_balance` 依赖外部 RPC 节点。如果 Render 容器访问 RPC 不通：
- reset 会置 0（宁可偏少不凭空多记）
- reconcile 会返回 `ok: false`
- cron reconcile 会静默跳过

## 九、测试结果（v2）

```
23 passed, 60 warnings in 8.00s
```

全部通过。新增 5 个测试（准入条件①② + scanner 顺序 + 资本金额控 + 等式排除 reserve）。

| 测试 | 说明 |
|------|------|
| `test_withdraw_full_cycle_keeps_verify_pass` | 准入条件①: 提现→confirm 闭环 |
| `test_withdraw_reject_keeps_verify_pass` | 准入条件①: 提现→reject 闭环 |
| `test_accounting_check_and_verify_same_diff` | 准入条件②: 两处口径一致 |
| `test_capital_source_sets_reserve_cap` | 资本金设 reserve 额控 |
| `test_capital_source_checked_before_user_matching` | scanner 顺序正确 |

## 十、未覆盖的边界

| 边界 | 处理 | 风险 |
|------|------|------|
| 资本金地址充了之后又转出 | 未处理 | 低（砚仁承诺不转出） |
| 多个人都是资本金来源 | 支持（逗号分隔） | 无 |
| 资本金和个人充值同一 tx | 不会发生（一个 tx 只有一个 from） | 无 |
| 链上 RPC 长期不通 | cron 告警 + reconcile 返回 error | 中（需人工介入看 RPC 状态） |

---

## 审查清单

请审查者逐项确认（v2 更新）：

- [ ] **铁律是否正确**：等式不含 reserve（它是 pool.balance 内部额控），资金是否只在 pool.balance 内计一次？
- [ ] **reserve 额控**：资本金入池时 `reserve += amount`，`reserve ≤ pool.balance` 始终成立？提现后 reserve 不扣减→是否可能 frozen > reserve？
- [ ] **提现闭环（v2 P0 修复）**：withdraw→frozen→confirm 全流程等式守恒？reject 也不破坏？
- [ ] **资本金分叉逻辑**：资本金入池、个人入余额的分流是否正确？
- [ ] **资本金提前判断（v2 已修）**：`_is_capital_source` 在用户匹配之前，资本金不依赖用户绑定？
- [ ] **重复计数修正**：个人充值不再碰 reserve；reserve 仅资本金路径设置？
- [ ] **三处对账口径统一（v2 已修）**：`/verify`、`_accounting_check`、`/reconcile-chain` 的等式项完全一致（均含 camp_balance，均不含 reserve）？
- [ ] **重置工具安全性**：读不到链置 0 的策略是否合理？（vs 拒绝重置）**生产注意**：RPC 抖动会清零池子。
- [ ] **历史补录（v2 已修）**：改用 MapLocation 持久化，soft-reset 后不重复？崩溃半写有 NTLedger 双重去重？
- [ ] **部署步骤**：soft-reset（非 hard-reset）顺序正确？env var 在 reset 之前配好？
- [ ] **测试覆盖（v2: 23 个）**：闭环提现测试、口径一致性测试、scanner 顺序测试是否充分？
- [ ] **env var 依赖**：`NT_CAPITAL_SOURCES` 未设置时，所有充值均为个人充值（资本金功能关闭）→ 降级行为安全？
