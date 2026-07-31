---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: NT经济
task_status: 已发卡
status: 讨论中
series: CR
---
# CR-2 池修改补行锁（二营施工）🔴

> 来源：外部审计报告 CR-2（已逐行核对代码，确认至少 8 处裸池访问）
> 施工：豆包 Codex（二营）｜验收：丞相复核
> 优先级：**P0 紧急**（并发下资金池数据不一致）
> 法源：砚仁终审

---

## BUG 描述

`_get_pool(db)` 在多处被裸调用（无 `lock=True`），修改池余额时不加行锁。并发场景下两个请求同时读到同一个池余额 → 各自修改 → 后提交者覆盖前者 → **资金数据不一致**。

## 需加行锁的 8+ 处位置

| 文件:行号 | 操作 | 当前 | 修复 |
|---|---|---|---|
| tasks.py:124 | 社区任务扣 balance + 加 escrow | 裸 | `lock=True` |
| tasks.py:152 | 个人任务加 escrow | 裸 | `lock=True` |
| tasks.py:202 | 取消任务退 escrow | 裸 | `lock=True` |
| nt.py:433 | topup 加 balance + total_issued | 裸 | `lock=True` |
| nt.py:449 | topup 加 total_issued | 裸 | `lock=True` |
| nt.py:801 | 取消任务退 escrow 到 balance | 裸 | `lock=True` |
| nt.py:814 | 取消任务退 escrow 到用户 | 裸 | `lock=True` |
| nt.py:916 | dispute 处理 escrow | 裸 | `lock=True` |

**已有正确示范**：
- `nt.py:508` withdraw 准入 → `_get_pool(db, lock=True)` ✅
- P0-2 已加固的 withdraw → `lock=True` ✅

**修复方式**：所有写路径的 `_get_pool(db)` → `_get_pool(db, lock=True)`

> 只读路径不需要锁：`nt.py:534`（verify 统计）/ `nt.py:660`（admin 查询）保持裸读即可。

## 禁区

- `nantang-mobile/` 零改动
- 不改 `_get_pool` 函数本身（已有 lock 参数支持）
- 不改只读路径

## 爆炸半径

- 改几个文件：2（tasks.py + nt.py）
- 影响功能：所有资金池写入路径
- 破坏性变更：无（加锁不改逻辑）
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `pytest tests/ -x -q` 全绿
- **并发验证**：写最小脚本模拟 10 个并发 topup + 10 个并发 withdraw，确认 final balance 正确

## 判据

1. `grep -n '_get_pool(db)' server/routes/tasks.py server/routes/nt.py` → 只命中只读路径（verify/admin）
2. `grep -n '_get_pool(db, lock=True)' server/routes/` → 命中所有写路径
3. 并发测试：10 并发 topup(10) + 10 并发 withdraw(10) → final balance == initial balance
4. `pytest tests/ -x -q` 全绿
