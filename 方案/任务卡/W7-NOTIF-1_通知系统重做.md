---
created: '2026-08-02'
type: 任务卡
编号: W7-NOTIF-1
标题: 通知系统重做（按 B 方案 · 共享 activity_log 路由）
派给: 二营+一营
优先级: P1（段 B 准备 · COMWIN-1 ✅ 勘察完）
轨: A 后端（routes/ + models.py + community.py）+ B 前端（核心 widget）
前置: W7-COMWIN-1 ✅（NT-DECIMAL 已取消，非本卡前置）
禁区: 不得改 nantang-mobile/ 业务逻辑（只新加通知 widget）
法源: 皇帝 08-02 选 B「共享 activity_log，按 type 路由」+ 方案/社区窗口动态流_勘察v0.md
---

> ⚠ **本卡遵循：`Schema\施工流程.md` v0.5**（铁律 10 入口强制）
> **档位**：**大卡** —— 跨端（后端表结构 + 前端 widget）
> **触发铁律 8（架构图更新）**：**是** —— activity_log 表 schema 改动
> **自检命令（v0.5 M-6）**：`$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/ -q`
> **施工方开工前必答「影响面（爆炸半径）四问」**
> **回执必填**（v0.5 M-2 · 大卡）：commit hash / 验证原始输出 / 爆炸半径四问 / 未验事项 / git status / 太傅注
> **复用勘察**（铁律 11）：用现有 `activity_log` 表（models.py:216），不新造

## 📋 承接方必读（直接执行，不问）

1. **法源**：`Schema\施工流程.md` v0.5（砚仁 2026-08-01 批准）。先读。
2. **档位**：本卡卡头已标（**大卡**），按该档执行。
3. **自检命令**：本卡卡头已写，回执须含改前/改后两次原始输出。
4. **回执必填**：v0.5 M-2 大卡六必填——**缺任一项，异体关打回**。
5. **硬规矩**：皇帝 08-01 强调"先修旧再加新"——本卡**修旧**（修"通知全员同一份"的旧 bug + 修"activity_log 无收件人字段"的旧 bug）。
6. **零权限越界**：禁区文件 / 不在本卡范围的代码，**一律不碰**。
7. **回执位置**：本卡文件末尾追加"施工回执"小节。

---

# W7-NOTIF-1 · 通知系统重做

## 一、为什么开（修旧）

COMWIN-1 勘察发现：
- `/api/notifications/list` **全员同一份**（`community.py:229`，无收件人字段）
- `activity_log` 表**无 user_id / read_at 字段**（不能做"我的通知" / 小红点）
- 内存态 `AppData._data.activity_log` 刷新就没

**后果**：用户看不到"自己的通知"（被打赏、被 @、任务指派都没提示）→ 错失关键信息。

## 二、皇帝 08-02 选 B（共享 activity_log 路由）

```
A：四份独立（notifications/community_window/events/items）
B：一份共享流水（统一进 activity_log，按 type 路由）   ← 已选
```

### B 方案落点

```
activity_log 表（新增字段）
  type    : tip / booking / cleanup / listing / task_assign / @mention / system
  user_id : 收件人（用于"我的通知"过滤；NULL = 公开事件）
  read_at : 已读时间（NULL = 未读）
  actor_id: 触发者（用于头像/链接）
  target  : 关联对象（task_id / item_id / camp_id / proposal_id）
  + 现有字段（time / text / data JSON）

API
  GET  /api/notifications/list?type=&unread=true&limit=  →  按 user_id 过滤
  GET  /api/notifications/unread_count                    →  小红点
  POST /api/notifications/{id}/read                       →  标已读
  POST /api/notifications/read_all                        →  全标已读

前端 widget
  ⚡ 顶部铃铛图标 + 未读数字 badge
  下拉：分三类（@我的 / 任务指派 / 营地公告）
```

## 三、做什么（NOTIF-A ~ NOTIF-D）

### NOTIF-A · `activity_log` 表扩字段

迁移（database.py）：

```python
# 幂等迁移（同 NTLedger 修复模式）
ALTER TABLE activity_log ADD COLUMN type VARCHAR(32);  -- 默认 'system'
ALTER TABLE activity_log ADD COLUMN user_id VARCHAR;   -- 收件人，NULL=公开
ALTER TABLE activity_log ADD COLUMN read_at VARCHAR;   -- 已读时间
ALTER TABLE activity_log ADD COLUMN actor_id VARCHAR;  -- 触发者
ALTER TABLE activity_log ADD COLUMN target VARCHAR;    -- 关联对象
CREATE INDEX IF NOT EXISTS idx_activity_log_user_type ON activity_log(user_id, type, read_at);
```

⚠ **现有写入点**（6 处真写入，COMWIN-1 亲验：tasks.py:299/327/353/360/389 + data.py:131）。**本卡不动这些写入点**——新字段 `user_id`/`actor_id`/`target` 暂时留 NULL，API 用 `IS NULL` 兜底展示。写入点补字段由后续业务卡各自负责（见下方「后续卡责任」）。

### NOTIF-B · `/api/notifications/*` 端点重写

`community.py:229` 全员同一份 → 按 user_id 过滤。

```python
@router.get("/api/notifications/list")
async def notifications_list(user=Depends(get_current_user), 
                             type: str = None, 
                             unread: bool = False,
                             limit: int = 50):
    q = select(ActivityLog).where(
        (ActivityLog.user_id == user.id) | (ActivityLog.user_id.is_(None))  # 收件人=我 OR 公开
    )
    if type:
        q = q.where(ActivityLog.type == type)
    if unread:
        q = q.where(ActivityLog.read_at.is_(None))
    return {"ok": True, "items": [...], "unread_count": ...}

@router.get("/api/notifications/unread_count")
async def unread_count(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # SELECT count(*) FROM activity_log WHERE (user_id=me OR user_id IS NULL) AND read_at IS NULL
    return {"unread": n}

@router.post("/api/notifications/{log_id}/read")
@router.post("/api/notifications/read_all")
```

### NOTIF-C · 前端 widget

⚠ **本卡 B 段只做"通知 widget 框架"**，不接入所有业务触发点（那是各业务卡的活）。

新增 `nantang-mobile/js/ui-notify.js`（或挂 core.js）：
- 顶部铃铛 + 未读数字
- 下拉列表（type filter tabs）
- 单条点击跳关联对象（task / item / camp / proposal）
- "全部已读"按钮

⚠ **必走 M4b UI.Sheet**（铃铛下拉用 Sheet 弹层）—— 禁手搓。

### NOTIF-D · 测试（3 条）

加入 `test_nt_reserve_equation.py` 不合适，新建 `test_notifications.py`：

1. **收件人过滤**：A 给 B 发通知 → A 看不到 / B 看得到
2. **公开事件**：NULL 收件人的 → 所有人看得到
3. **小红点未读数**：5 条未读 → unread_count = 5；标已读后 = 4

## 四、不做什么（边界）

- 不动 `activity_log` 现有 6 个真写入点（**留给各自业务卡**接入）
- 不重写 UI-3 已画的全貌页营地卡
- 不接打赏（#14 / 涉钱）—— 那是 ITEM-4 的活
- 不接弹幕/评论（皇帝 8-01 没想）

### 后续卡责任（写入点补字段）

本卡建好基础设施后，以下卡须各自补传 `user_id`/`actor_id`/`target`：

| 写入点 | 文件:行号 | 补什么 | 由哪张卡负责 |
|--------|-----------|--------|-------------|
| task_retract | tasks.py:299 | user_id=任务发布者, actor_id=撤回者, target=任务ID | W7-TASK-REFINE 或后续任务卡 |
| task_retract_request | tasks.py:327 | 同上 | 同上 |
| task_retract_approved | tasks.py:353 | 同上 | 同上 |
| task_retract_rejected | tasks.py:360 | 同上 | 同上 |
| task_unclaim | tasks.py:389 | user_id=任务发布者, actor_id=取消者, target=任务ID | 同上 |
| 手动写日志 | data.py:131 | 调用方自行传参（已有 POST 端点） | 调用方各自负责 |

> **原则**：不动 NOTIF-1 的活，让施工方集中在这张卡的事上（表结构 + API + widget）。通知系统先上线跑起来，写入点逐个业务卡补——不阻塞基础设施交付。

## 五、影响面（爆炸半径）

| 问 | 答 |
|---|---|
| 调用方 | 9 个 activity_log 写入点（要补 type / actor_id）+ 通知 widget 前端 |
| 被依赖方 | `activity_log` 表（迁移）+ `community.py` 重写 + 前端新增 widget |
| 关联测试 | `test_notifications.py`（+3 条） |
| 回滚路径 | 迁移要可逆（新增列 + 默认值兼容老数据） |

## 六、自检命令

```
$env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'; .\.venv\Scripts\python.exe -m pytest server/tests/ -q
```

**预期**：基线 342 passed + 本卡 3 条新测试 = 345 passed（NT-DECIMAL 已取消，基线以前次全量测试为准）

---
**太傅注**
- 补课：通知系统的**核心是收件人**，没收件人字段 = 没法做"我的通知"。`activity_log` 现在是公告板，**改造 = 加 user_id**。
- 一句原理：**改 schema 是大动作，但比新增表轻**。给老表加列 + 索引 + 写入补字段 = 比新建 `notifications` 表 + 同步双写 = 简单得多。
- 不这样做会怎样：用户继续错失被打赏/被@的信息，每次都是"信任债"。
