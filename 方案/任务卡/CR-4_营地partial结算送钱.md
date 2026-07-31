---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: NT经济
task_status: 设计议单
status: 讨论中
series: CR
---
# CR-4 营地 partial 结算送钱（二营施工）

> 来源：CR-1 回执太傅注发现（nt.py:746-757）
> 施工：豆包 Codex（二营）｜验收：丞相复核
> 优先级：**HIGH**（凭空印钱漏洞，营地任务部分完成时 poster 收到不存在的退款）
> 法源：砚仁终审

---

## BUG 描述

`nt.py:746-757`，营地任务部分完成时，未认领份额的"退款"逻辑：

```python
# L746-757（verify_task → approve 分支）
unclaimed = task.reward * ((task.slots or 1) - len(assignee_ids))
if unclaimed > 0:
    if poster:              # ← poster 存在就走这里
        poster.nt_balance += unclaimed  # ← 凭空给 poster 加钱！
    elif is_camp:
        pool.camp_balance += unclaimed
    else:
        pool.balance += unclaimed
```

**CR-1 修完后**：营地任务 `escrow_amount = 0`，poster 从未被扣钱。但结算时仍然按 `unclaimed = reward × (slots - assignees)` 给 poster 退钱 → **poster 收到从未交过的退款 = 凭空印钱**。

**例子**：
- 营地任务：reward=10, slots=3, 实际 1 人完成
- unclaimed = 10 × (3-1) = 20 NT
- poster.nt_balance += 20 → poster 凭空获得 20 NT

## 根因

L749 `if poster:` 条件优先于 L751 `elif is_camp:`。营地任务的 poster 通常存在（发布者），所以永远走 L749 → poster 拿钱。

## 施工内容

### 方案 A（推荐）：camp 任务走 camp_balance 退还

```python
unclaimed = task.reward * ((task.slots or 1) - len(assignee_ids))
if unclaimed > 0:
    if is_camp:                          # ← camp 优先判断
        pool.camp_balance += unclaimed   # 回流营地余额
    elif poster:
        poster.nt_balance += unclaimed
    else:
        pool.balance += unclaimed
```

### 方案 B（更保守）：camp 任务 escrow=0 → 无 unclaimed 可退

```python
# 在计算 unclaimed 前加判断
if not is_camp:
    unclaimed = task.reward * ((task.slots or 1) - len(assignee_ids))
    if unclaimed > 0:
        # ...原逻辑
```

> 方案 A 更合理：营地任务的"预算"来自 camp_balance，未使用的部分应回流 camp_balance。
> 方案 B 更安全：camp 任务 escrow=0，逻辑上不应有 unclaimed 退款。

## 禁区

- `nantang-mobile/` 零改动
- 不改 CR-1 的 create_task 逻辑
- 不改其他结算路径

## 爆炸半径

- 改几个文件：1（nt.py）
- 影响功能：营地任务结算的 unclaimed 退款路径
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `pytest tests/ -x -q` 全绿
- **测试**：新增 test 验证 camp partial（3 slots 只 1 人完成）→ poster 余额不变 + camp_balance 回流

## 判据

1. 营地任务 partial（3 slots 完成 1 人）→ poster.nt_balance 不变
2. 营地任务 partial → camp_balance += unclaimed
3. 个人任务 partial → poster.nt_balance += unclaimed（不受影响）
4. 社区任务 partial → pool.balance += unclaimed（不受影响）
5. `pytest tests/ -x -q` 全绿
