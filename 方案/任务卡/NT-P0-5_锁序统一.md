---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 资金财务
task_status: 已发卡
status: 讨论中
series: NT-P0
---
# NT-P0-5 锁序统一（四热路径翻转 + 交叉锁测）🔴

> 来源：NT 经济规则设计稿 v3.1 §3.6（二营复审❷实锤现网存量 AB-BA）
> 施工：豆包 Codex（二营）｜验收：Claude Code（一营）
> 优先级：**P0** · 工期 0.5-1 天
> 法源：砚仁 2026-07-30 终审定稿
> 二营请缨：✅

## 现状问题（二营复审实锤）

现行单表四条热路径全部 **User 先→Pool 后**：
- transfer L219→L226→L241
- _grant_from_pool L261→L269
- withdraw L453→L473
- cashout L425→L430

而 verify_task L658→L669→L685 是 **Pool 先→User 后**。

**PG 上 transfer × verify_task 交叉即 AB-BA 死锁对**（SQLite 单写掩盖，上 Neon 即暴露）。transfer from→to 也不按 id 升序。

## 施工内容

### A. 四热路径翻转（方向定 Pool 先→User 后）

`server/routes/nt.py` 四个函数统一翻转为先锁 Pool 后锁 User：

1. **transfer**：先 `_get_pool(db, lock=True)` → 再锁 from User → 再锁 to User
2. **_grant_from_pool**：先锁 Pool → 再锁 User
3. **withdraw**：先锁 Pool → 再锁 User（现行已接近，微调顺序）
4. **cashout**：先锁 Pool → 再锁 User

每个函数头部加注释写明锁序：
```python
# 🔒 LOCK ORDER: Pool → User(user_id ASC) — 全局铁律 §3.6
```

### B. transfer from/to 按 user_id 升序

transfer 的 from_user 和 to_user 两行加锁时按 `user_id` 升序（小的先锁），堵住 A→B / B→A 并发自死锁：
```python
ids = sorted([from_id, to_id])
first = (await db.execute(select(User).where(User.id == ids[0]).with_for_update()...)).scalar_one()
second = (await db.execute(select(User).where(User.id == ids[1]).with_for_update()...)).scalar_one()
```

### C. 配套锁测（requires_pg 门控）

新增测试 `server/tests/test_pg_locks.py`：
- **单表 transfer × verify_task 交叉**：两事务并发（一个 transfer A→B，一个 verify_task B），验证不死锁
- 门控 `@pytest.mark.requires_pg`（SQLite 跳测，只跑 PG）
- 拆表验收再加两组（营队审核 × 结营结算、划拨 × 调水），本卡不做

### D. populate_existing 全量覆盖

所有 `with_for_update()` 一律带 `.execution_options(populate_existing=True)`（现行部分已有，全面检查补齐）。

### E. lock_timeout

生产 PG 设 `lock_timeout`（建议 5s）防无限等待，超时抛 HTTPException(409, "锁等待超时，请重试")。

## 爆炸半径（四答）

- 改几个文件：1-2（nt.py 四函数 + 测试）
- 影响功能：transfer / _grant_from_pool / withdraw / cashout 的内部锁获取顺序
- 破坏性变更：无行为变更（纯锁序调整，功能等价）
- 回滚：`git revert` 本 commit 一键

## 铁律

- **禁区**：verify_task（现行 Pool 先→User 后）**零改动**——本卡方向就是与它对齐
- 只 commit 不 push；只加具名文件；pytest 零回归
- 回执独立落盘 `方案/任务卡/` 随 commit；末尾太傅注三行内
- 锁序注释必须在函数头部可见

## 判据（验收方实跑，逐条贴输出）

1. 四个函数头部均有 `🔒 LOCK ORDER: Pool → User` 注释
2. transfer 的 from/to 按 user_id 升序加锁（代码 review）
3. 所有 `with_for_update()` 均带 `populate_existing`（grep 确认）
4. requires_pg 锁测：transfer × verify_task 并发不死锁（PG 实跑）
5. pytest 全绿零回归（SQLite 环境跳 requires_pg 标记）
