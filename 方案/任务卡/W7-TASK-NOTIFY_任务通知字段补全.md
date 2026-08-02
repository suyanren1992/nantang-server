---
created: '2026-08-02'
type: 任务卡
编号: W7-TASK-NOTIFY
标题: tasks.py 写入点补通知字段（NOTIF-1 后续）
派给: 二营
优先级: P1（NOTIF-1 后续 · 让通知系统有内容可推）
轨: A 后端（server/routes/tasks.py 仅 1 文件）
前置: W7-NOTIF-1 ✅（activity_log 新字段已建 + API 已上线）
禁区: 不得改 models.py / nt.py / community.py；不动业务逻辑，只补传参
法源: W7-NOTIF-1 卡面「后续卡责任」表 + COMWIN-1 勘察（6 写入点实测）
---

> ⚠ **本卡遵循：`Schema\施工流程.md` v0.5**（铁律 10 入口强制）
> **档位**：**小卡**升中卡 —— 单文件 5 处改动，但涉 tasks.py 资金路径（任务撤回/认领），定档存疑升中卡
> **触发铁律 8（架构图更新）**：否
> **自检命令（v0.5 M-6）**：`$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/test_nt_reserve_equation.py -q`
> **施工方开工前必答「影响面（爆炸半径）四问」**
> **回执必填**（v0.5 M-2 · 中卡）：commit hash / 验证原始输出 / 影响面声明 / git status / 太傅注

## 📋 承接方必读（直接执行，不问）

1. **法源**：`Schema\施工流程.md` v0.5。先读。
2. **档位**：中卡（单文件 5 处改动，涉资金路径）
3. **铁律 12**：一项一 commit（5 处可合为 1 commit，message 全列 5 处）
4. **零权限越界**：禁区文件一律不碰。

---

# W7-TASK-NOTIFY · 任务通知字段补全

## 一、为什么开

NOTIF-1 给 `activity_log` 加了 `user_id` / `actor_id` / `target` 三个新字段，但 `tasks.py` 的 5 个 `_log_activity()` 调用点没补传这些字段。后果：

- 任务被撤回 → 通知写入了，但 `user_id=NULL` → 发布者看不到
- 任务被认领/取消认领 → 同上

**本卡 = 给这 5 个洞补上参数，让任务相关通知真正能推到收件人。**

## 二、做什么

### 改 `tasks.py` 5 处 `_log_activity()` 调用

每条补传 `user_id` / `actor_id` / `target`，不动 `_log_activity` 函数签名——先改 `activity_log` 的写入方式（直接 ORM 写表，不走 `_log_activity`），确保老调用不受影响。

| # | 行号 | 活动类型 | user_id（通知谁） | actor_id（谁触发的） | target（关联对象） |
|---|------|---------|------------------|-------------------|------------------|
| 1 | tasks.py:299 | task_retract | 任务发布者 (task.poster) | 当前用户 (user.id) | 任务ID (task.id) |
| 2 | tasks.py:327 | task_retract_request | 任务发布者 | 当前用户 | 任务ID |
| 3 | tasks.py:353 | task_retract_approved | 任务发布者 | 当前用户 | 任务ID |
| 4 | tasks.py:360 | task_retract_rejected | 任务发布者 | 当前用户 | 任务ID |
| 5 | tasks.py:389 | task_unclaim | 任务发布者 | 当前用户 | 任务ID |

### 修法

`_log_activity()` 函数只接受 `(db, type_, text)`，不改它。每条调用点改为直接用 ORM 写入 `ActivityLog` 表，补上新字段：

```python
# 改前
await _log_activity(db, "task_retract", f"任务「{task.title}」已被撤回")

# 改后
db.add(ActivityLog(
    time=datetime.utcnow().isoformat(),
    type="task_retract",
    text=f"任务「{task.title}」已被撤回",
    user_id=task.poster,
    actor_id=user.id,
    target=task.id,
))
```

⚠ 5 条中有 3 条已在 `_log_activity` 调用后有 `await db.commit()`，改为 ORM 直接写入后，确认 commit 由外层统一管理，不重复提交。

## 三、不做什么

- 不动 `_log_activity()` 函数签名（data.py:131 的 POST 端点仍用它）
- 不新增 API 端点
- 不碰 models.py（NOTIF-1 已加好字段）
- 不碰前端（通知 widget NOTIF-1 已做）

## 四、影响面

| 问 | 答 |
|---|---|
| 调用方 | 5 处 `_log_activity` 调用 → 改为 ORM 直接写入 |
| 被依赖方 | `ActivityLog` 模型（NOTIF-1 已扩字段）+ `tasks.py` 任务撤回/认领逻辑 |
| 关联测试 | `test_nt_reserve_equation.py`（涉任务撤回测试）+ 需新增 1 条通知字段验证 |
| 回滚路径 | 1 commit revert，改回 `_log_activity` 调用即可 |

## 五、自检命令

```
$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/ -q
```

**预期**：基线 342 passed → 342+ passed（不引入新失败），5 处新写入可通过日志确认。

---

**太傅注**
- 补课：通知系统的价值不在"建了 API"，而在"有人往里面写对的数据"。NOTIF-1 建了管道，本卡通水。
- 一句原理：`_log_activity` 是老函数，改签名会炸 data.py:131 的调用方。不动函数、改调用方直接用 ORM = 最小侵入。
- 不这样做会怎样：通知 widget 上线后一直显示"暂无通知"——不是没通知，是通知里没收件人，API 过滤掉了。
