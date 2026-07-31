---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: NT经济
task_status: 已发卡
status: 讨论中
series: CR
---
# CR-1 营地任务 escrow 双重扣款（二营施工）🔴

> 来源：外部审计报告 CR-1（已逐行核对代码，确认真实 BUG）
> 施工：豆包 Codex（二营）｜验收：丞相复核
> 优先级：**P0 紧急**（用户资金被吃，必须立即修）
> 法源：砚仁终审

---

## BUG 描述

营地任务（`scope=camp`）创建时，用户的 NT 被凭空吃掉：

**代码流程**（`tasks.py:120-158`）：
1. L129-131：`elif req.scope == "camp": pass` — 注释说"营地任务走 camp_balance，不设 escrow"
2. L146：`escrow_amount=req.reward * req.slots` — **无条件**设置 escrow（包含营地任务）
3. L150-153：`if req.poster != "社区":` — 营地任务 poster 不是"社区"，所以**仍然扣用户余额 + 加 task_escrow**

**结果**：
- 用户被扣 NT → 进 task_escrow
- 执行者完成营地任务 → `nt.py:717-723` 从 `camp_balance` 付款
- 任务完成/取消 → `task_escrow -= escrow_amount`（L803），但从未退回用户
- **用户的 NT 被凭空吃掉**

## 施工内容

**修复 `tasks.py` 创建任务逻辑**：

```python
# L150-153 修改：营地任务不扣用户余额、不设 escrow
if req.poster != "社区" and req.scope != "camp":
    (user_locked if user_locked is not None else user).nt_balance -= req.reward * req.slots
    pool = await _get_pool(db)
    pool.task_escrow += req.reward * req.slots
```

同时 L146 也需条件化：
```python
escrow_amount=0 if req.scope == "camp" else req.reward * req.slots,
```

以及 L156-157 ledger 记录也需排除营地任务：
```python
if req.poster == "社区":
    freeze_from = "community_pool"
elif req.scope == "camp":
    freeze_from = "camp_pool"  # 或跳过 ledger
else:
    freeze_from = user.id
```

> 注意：营地任务的资金来源是 `camp_balance`，由营地报到/充值流程管理，不走个人 escrow。

## 禁区

- `nantang-mobile/` 零改动
- 不改 `nt.py` 的执行者付款逻辑（那部分是正确的）
- 不改 `_get_pool` / `_add_ledger` 函数本身

## 爆炸半径

- 改几个文件：1（tasks.py）
- 影响功能：营地任务创建的资金流
- 破坏性变更：无（修 BUG，回归到注释声明的行为）
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `pytest tests/ -x -q` 全绿
- **并发验证**：写最小脚本模拟 2 个用户同时创建营地任务，确认不超扣

## 判据

1. 创建营地任务（scope=camp）→ 用户余额不变，task_escrow 不变
2. 创建个人任务 → 用户余额扣减，task_escrow 增加（不受影响）
3. 创建社区任务 → 社区池扣减，task_escrow 增加（不受影响）
4. 营地任务完成后 → camp_balance 减少，用户余额不受影响
5. `pytest tests/ -x -q` 全绿
