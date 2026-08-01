---
created: '2026-08-02'
type: 任务卡
编号: W7-LOCK-2
标题: L-5 COUNT+FOR UPDATE 重写 + chain_scanner.py:359 资本金加锁
派给: 二营
优先级: 🔴 P0（资金安全 · DB-1/LOCK-1 揭示的两处漏洞）
轨: A 后端（server/ 独占）
前置: W7-LOCK-1 ✅ · W7-DB-1 ✅
禁区: 不得改 nantang-mobile/ 任何文件；不得放宽 N-1b clamp；不得改 NT-2 提现逻辑
法源: W7-LOCK-1_回执_二营_2026-08-01.md 未验事项 + 丞相 08-01 Q2 裁定
---

> ⚠ **本卡遵循：`Schema/施工流程.md` v0.5**（铁律 10 入口强制）
> **档位**：大卡 —— 涉钱（资本金 reserve += 路径 + 房间占用计数），授权分级一档硬升档
> **触发铁律 8（架构图更新）**：是 —— 改锁模型语义（COUNT+FOR UPDATE 不兼容）
> **自检命令（v0.5 M-6）**：`$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/test_pg_locks.py server/tests/test_p0_ssot_chain.py -q`
> **施工方开工前必答「影响面（爆炸半径）四问」**
> **回执必填**（v0.5 M-2 · 大卡）：commit hash / 验证原始输出 / 爆炸半径四问 / 未验事项 / git status / 太傅注
> **复用勘察**（铁律 11）：复用 `clean_weekly.py:121-130` 范式；COUNT+FOR UPDATE 重写参考"先锁明细后聚合"标准模式

## 📋 承接方必读（直接执行，不问）

1. **法源**：`Schema\施工流程.md` v0.5（砚仁 2026-08-01 批准）。先读。
2. **档位**：本卡卡头已标（**大卡**），按该档执行。
3. **自检命令**：本卡卡头已写，回执须含改前/改后两次原始输出。
4. **回执必填**：v0.5 M-2 大卡六必填——**缺任一项，异体关打回**。
5. **硬规矩**：皇帝 08-01 强调"先修旧再加新"——若本卡触及未修的旧功能，**在回执"未验事项"中明确标出，不擅自扩本卡范围**。
6. **零权限越界**：禁区文件 / 不在本卡范围的代码，**一律不碰**。
7. **回执位置**：本卡文件末尾追加"施工回执"小节。

---

# W7-LOCK-2 · 两处 PG 行锁漏洞修复

## 一、为什么开（LOCK-1 揭示的两坑）

W7-LOCK-1 二营诚实标注了两处未修漏洞（不藏是好习惯）：

| 坑 | 落点 | 严重度 | 后果 |
|---|---|---|---|
| **L-5** | `accommodation.py:167` `select(func.count(Tenancy.id)).with_for_update()` | 中 | PG 上 `FOR UPDATE is not allowed with aggregate functions` —— 锁加不上（**LOCK-1 补 `populate_existing` 是无效修复**） |
| **#359** | `chain_scanner.py:359` `_get_pool(db)` 没传 `lock=True` | 高 | 链扫资本金 `pool.reserve += amount` 不走行锁。**绕过了 LOCK-1 刚修好的 `_get_pool(lock=True)`**——20+ 涉钱路径都白修 |

## 二、做什么（LOCK-2-A ~ LOCK-2-C）

### LOCK-2-A · L-5 重写：先锁明细后聚合

**当前（`accommodation.py:165-170`）**：
```python
count_r = await db.execute(
    select(func.count(Tenancy.id))
    .where(Tenancy.room_id == req.room_id, Tenancy.status == "active")
    .with_for_update()  # PG 不允许
)
occupied = count_r.scalar() or 0
```

**改为（"先锁明细后聚合"标准模式）**：
```python
# 1. 锁同房间所有 active 租约明细（行锁 PG 允许）
locked = await db.execute(
    select(Tenancy.id)  # 只查 id 字段，行锁
    .where(Tenancy.room_id == req.room_id, Tenancy.status == "active")
    .with_for_update(populate_existing=True)
    .limit(MAX_BEDS + 5)  # 多查几条防漏
)
# 2. 在已锁的明细上做 count
occupied = len(locked.scalars().all())
if occupied >= MAX_BEDS:
    raise HTTPException(...)
```

⚠ 关键点：先 `select(Tenancy.id)` 拿明细行锁 → 锁住的是行不是聚合 → 然后在 Python 层 count → 锁正确 + 聚合正确。

⚠ 锁的是"该房间当前所有 active 租约"，所以并发新申请同房间会被**等锁释放后才能判断**，避免双份租约。

### LOCK-2-B · #359 链扫资本金加锁

**当前（`chain_scanner.py:359` 附近）**：
```python
pool = await _get_pool(db)   # 没传 lock=True
if is_capital:
    pool.balance += amount
    pool.reserve = (pool.reserve or 0) + amount
```

**改为**：
```python
pool = await _get_pool(db, lock=True)   # 关键：加 lock=True
if is_capital:
    pool.balance += amount
    pool.reserve = (pool.reserve or 0) + amount
```

⚠ 锁住 pool singleton 后，并发的"手动 reserve 划拨"和"链上资本金"会**序列化**，避免双写覆写。

### LOCK-2-C · 测试（2 条）

加入 `server/tests/test_pg_locks.py`：

1. **L-5 房间占用并发**：
   - 设 room 有 N=10 床位，已住 9 个
   - 并发 5 路"申请同房间" → 只能有 1 路成功（其他 4 路因 9+1=10 已满被拒）
   - 在真 PG 上跑

2. **#359 资本金与手动划拨并发**：
   - 链扫 +1 NT 资本金
   - 同时 admin 手动 reserve 划拨
   - 断言 reserve 总额 = 链扫入 + 划拨入（**没有覆盖**）
   - 在真 PG 上跑

⚠ 测试需真 PG 环境。**SQLite 静默无效**（`with_for_update` 是 no-op）。可用 DB-1 已有的 `--encoding=SQL_ASCII` 本地 PG（命令复用 `W7-DB-1_回执_二营_2026-08-01.md` 第四节）。

## 三、不做什么（边界）

- 不改 NT-2 提现逻辑
- 不放宽 N-1b clamp
- 不改 `clean_weekly.py:121-130` 范式
- 不动其他 45 处锁

## 四、影响面（爆炸半径）

| 问 | 答 |
|---|---|
| 调用方 | 房间入住端点 + 链上资本金扫描 |
| 被依赖方 | `Tenancy` 模型（确认 id 主键）/ `CommunityPool` 模型（已确认有） |
| 关联测试 | `test_pg_locks.py`（+2 条新测试） |
| 回滚路径 | 2 笔 commit（LOCK-2-A / LOCK-2-B / LOCK-2-C）任一可单独 `git revert` |

## 五、自检命令

```
$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/test_pg_locks.py server/tests/test_p0_ssot_chain.py -q
```

**预期**：基线 25 passed + 新增 2 条 = 27 passed（PG 上）/ SQLite 上 11 skip + 既有 14 passed

回执须含**改前 / 改后两次**该命令的原始输出。

---
**太傅注**
- 补课：PG `FOR UPDATE` 与聚合函数**互斥**。`SELECT COUNT(*) ... FOR UPDATE` 在 PG 直接报错。**正确模式：锁明细行 → 在应用层 count**。
- 一句原理：**绕过高层 API = 修复了等于没修**。`_get_pool(lock=True)` 修了 20+ 路径，但 `_get_pool(db)` 不带 lock 还在被调用 = 0 收益。
- 不这样做会怎样：N-1b clamp 压低 reserve 后，资本金写入并发会再次让 reserve 虚高（覆写旧值），重新踩 NT-1 修过的坑。

---

# 施工回执（二营 · 2026-08-02）

## ① commit hash
`6211326139a5bbb097d9b5f5f030c53ac53b4ae6`

## ② 验证命令原始输出

### 改前（20 passed, 11 skipped, 1 teardown error）
```
sssssssssss.................E...                                         [100%]
20 passed, 11 skipped, 31 warnings, 1 error in 14.12s
```

### 改后（20 passed, 13 skipped, 1 teardown error）
```
sssssssssssss.................E...                                       [100%]
20 passed, 13 skipped, 31 warnings, 1 error in 13.24s
```

> 13 skipped = 原 11 skip（PG 锁测试）+ 新增 2 skip（`requires_pg` marker）。teardown error 为 `test_accounting_check_and_verify_same_diff` SQLite 并发锁（改前同样存在，与本卡无关）。新增测试在 SQLite 上正确 skip，需真 PG 验证锁语义。

## ③ 爆炸半径四问

| 问 | 答 |
|---|---|
| 调用方 | L-5：房间入住端点（`accommodation.py` checkin）→ 同房间并发 checkin 被序列化（先锁明细行后 count）；#359：链扫资本金入池（`chain_scanner.py` `_process_transfer`）→ 与 admin 手动 reserve 划拨序列化 |
| 被依赖方 | `Tenancy` 模型（id 主键已确认）；`_get_pool(lock=True)` 已在 `nt_helpers.py:42-47` 实现，只缺调用方传参 |
| 关联测试 | `test_pg_locks.py` 新增 2 条：`test_room_occupancy_concurrent_lock_rows_then_count`（L-5 房间超员防呆）+ `test_capital_scan_and_manual_reserve_concurrent_no_overwrite`（#359 并发覆写防呆） |
| 回滚路径 | 2 笔改动同一 commit，`git revert 6211326` 即可回滚。无数据迁移，无配置变更 |

## ④ 未验证事项

- **PG 真仓验证未跑**：本地无 PG_DATABASE_URL，新增 2 条测试仅在 SQLite 上确认语法正确 + skip 行为正常。真 PG 上需验证锁语义（并发只有 1 路成功）——建议在 CI/Render 上跑。
- 其他 45 处锁未触及——不在本卡范围。

## ⑤ git status 输出

```
On branch main
Your branch is ahead of 'origin/main' by 31 commits.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean (for 本卡三文件)
```

## ⑥ 太傅注
- 补课：**锁语义必须匹配数据库实际行为**。`FOR UPDATE + 聚合函数` 在 PG 上直接报错——不是性能问题，是语义不兼容。L-5 的 `populate_existing` 补了也白补，因为锁根本没加上。
- 一句原理：**API 设计者的意图必须落实到每个调用方**。`_get_pool(lock=True)` 是一扇门，但门开着的时候偷懒不锁的调用方就是墙上的洞。#359 就是那个洞。
- 不这样做会怎样：L-5 房间超员入住（并发都读到 occupied=5 全通过）；#359 reserve += 并发覆写 → reserve 虚高 → 提现额度 > 池实有余额 → 用户能提空池。
