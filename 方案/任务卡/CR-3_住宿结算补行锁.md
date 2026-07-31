---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: NT经济
task_status: 已发卡
status: 讨论中
series: CR
---
# CR-3 住宿结算补行锁 + admin 顺手修（二营施工）

> 来源：CR-2 验卡时发现（4 处卡面范围外裸池写入）
> 施工：豆包 Codex（二营）｜验收：丞相复核
> 优先级：**HIGH**（住宿结算是生产写路径，并发下丢更新）
> 法源：砚仁终审

---

## BUG 描述

CR-2 修了 nt.py/tasks.py 的 8 处裸池写入，但验卡 grep 发现另有 4 处裸 `_get_pool(db)` 未覆盖：

| 文件:行号 | 操作 | 严重性 |
|---|---|---|
| **accommodation.py:31** | 住宿结算 `pool.balance += pay` | **HIGH**（生产写入） |
| admin.py:145 | dev-reset hard（fetch 后未使用 pool 值） | LOW |
| admin.py:172 | dev-reset soft `pool.balance = 500` | LOW |
| admin.py:288 | dev-seed `pool.balance += diff` | LOW |

**住宿结算风险**：两个用户同时退房 → 两请求同读旧 `pool.balance` → 各自 `+=pay` → 后提交覆盖前提交 → **一笔结算款凭空消失**。

## 施工内容

### ① accommodation.py:31 加行锁（HIGH）

```python
# 原
pool = await _get_pool(db)
# 改
pool = await _get_pool(db, lock=True)  # CR-3: 住宿结算写路径补行锁
```

### ② admin.py 3 处顺手修（LOW）

```python
# L145: dev-reset hard
pool = await _get_pool(db, lock=True)  # CR-3: 顺手加锁
# L172: dev-reset soft
pool = await _get_pool(db, lock=True)  # CR-3: 顺手加锁
# L288: dev-seed
pool = await _get_pool(db, lock=True)  # CR-3: 顺手加锁
```

## 禁区

- `nantang-mobile/` 零改动
- 不改 `_get_pool` 函数本身
- 不改其他文件

## 爆炸半径

- 改几个文件：2（accommodation.py + admin.py）
- 影响功能：住宿结算 + dev 工具
- 破坏性变更：无（加锁不改逻辑）
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `pytest tests/ -x -q` 全绿

## 判据

1. `grep -n '_get_pool(db)' server/routes/` → 仅命中 nt.py:534/660（两只读路径）
2. `grep -n '_get_pool(db, lock=True)' server/routes/` → 命中所有写路径（含新加 4 处）
3. `pytest tests/ -x -q` 全绿
4. `python -c "import ast; ast.parse(open('server/routes/accommodation.py').read())"` 无报错
