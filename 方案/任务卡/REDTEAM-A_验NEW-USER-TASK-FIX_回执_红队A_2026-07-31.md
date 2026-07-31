# REDTEAM-A 审查回执：NEW-USER-TASK-FIX (FE+BE)

| 字段 | 值 |
|------|------|
| 卡号 | REDTEAM-A_验NEW-USER-TASK-FIX |
| 审查方 | 红队 A (Qoder H 窗代审) |
| 日期 | 2026-07-31 |
| 审查目标 | FIX-FE (cb4ebc6 + cd31c57) + FIX-BE (df51edc) |
| 文件范围 | core.js:360/936/978/1196, data.js:360-377, tasks.py:79-87 |

---

## 4 项验证

### ① core.js sync 映射真生效？

**判定：部分真 🟡（L360 已修，3 处残留未补）**

| 位置 | 状态 | 实证 |
|------|------|------|
| core.js:360 | ✅ 已修 | `is_newbie_task:t.is_newbie_task\|\|false` (cb4ebc6) |
| core.js:936 | 🔴 残留 | 无 `is_newbie_task` 字段 |
| core.js:978 | 🔴 残留 | 无 `is_newbie_task` 字段 |
| core.js:1196 | 🔴 残留 | 无 `is_newbie_task` 字段，且无 `is_system_generated` |

**代码实证：**

```javascript
// core.js:936 — 缺 is_newbie_task
if (!dup) AppData._data.tasks[t.id] = { name:t.id, title:t.title, ..., is_system_generated:t.is_system_generated||false, escrow_amount:t.escrow_amount||0, settler_id:t.settler_id||'', settled_at:t.settled_at||'' };

// core.js:978 — 缺 is_newbie_task
if (!dup) AppData._data.tasks[t.id] = { name:t.title || '未命名任务', ..., _srvId:t.id, _ntTaskId:t.id };

// core.js:1196 — 缺 is_newbie_task + is_system_generated
if(!AppData._data.tasks[t.id]){AppData._data.tasks[t.id]={name:t.title,title:t.title,...,claimants:[],action:''}}
```

**结论：** FIX-FE2 卡已立项但未实施，3 处 sync 路径仍不传 `is_newbie_task`。影响：60s 轮询、登录后 fetchTasks 等路径拉到的任务不显示 🆕 角标。

---

### ② doSubmit 接 completeNewUserTask 真调通？

**判定：真 ✅（有边界问题 🟡）**

| 实证 | 文件:行号 |
|------|-----------|
| `if (t.is_newbie_task)` 分支 | data.js:360 |
| 匹配 newbieQuests 中 quest | data.js:373-374 |
| 调 `API.completeNewUserTask(nq.quest_id)` | data.js:375 |
| 非 done 态触发 | data.js:375 `if (nq && !nq.done)` |

**代码实证：**

```javascript
// data.js:373-375
var qs = AppData._data.newbieQuests || {};
var nq = Object.values(qs).find(function(q) { return (q.name||'') === (t.name||'') || (q.name||'') === (t.title||''); });
if (nq && !nq.done) { API.completeNewUserTask(nq.quest_id).catch(function(){}); }
```

**边界 case：**
- 🟡 **错误静默** — `.catch(function(){})` 空函数，BE 报错用户无感知
- 🟡 **name/title 双匹配** — `(q.name||'') === (t.name||'') || (q.name||'') === (t.title||'')`，若 newbieQuests 与 TASKS 命名不一致则匹配失败

---

### ③ 3 处 sync 残留是否真补？

**判定：假 🔴（未补）**

| 残留位置 | FIX-FE2 卡状态 | 当前代码 |
|----------|----------------|----------|
| core.js:936 | 已立项未实施 | 缺 `is_newbie_task` |
| core.js:978 | 已立项未实施 | 缺 `is_newbie_task` |
| core.js:1196 | 已立项未实施 | 缺 `is_newbie_task` |

**结论：** FIX-FE2 卡（NEW-USER-TASK-FIX-FE2_3处sync残留_v0.md）已立但未施工。

---

### ④ BE 序列化真发 is_newbie_task？

**判定：真 ✅**

| 实证 | 文件:行号 |
|------|-----------|
| `is_newbie_task: getattr(t, "is_newbie_task", False)` | tasks.py:85 |
| `deadline: t.deadline` 已存在 | tasks.py:81 |
| 5 测试全过 | test_task_is_newbie.py |

**测试覆盖：**
- ✅ list_tasks 返回体含 is_newbie_task 字段
- ✅ list_tasks 返回体含 deadline 字段
- ✅ 新人任务 is_newbie_task=true
- ✅ 普通任务 is_newbie_task=false
- ✅ deadline 无值时为 null

---

## 🔴 额外发现：expires_at 未改 deadline

**判定：假 🔴（FIX-FE ② 未修）**

| 实证 | 文件:行号 |
|------|-----------|
| `if(t.expires_at)` | core.js:480 |
| `new Date(t.expires_at).getTime()` | core.js:481 |

**代码实证：**

```javascript
// core.js:480-481 — 仍用 expires_at，应为 deadline
if(t.expires_at) {
  var remainMs = new Date(t.expires_at).getTime() - Date.now();
```

**结论：** FIX-FE 卡 ② 要求「字段名 t.expires_at 改 t.deadline」未实施。新人任务倒计时读错字段，永远为 0。

---

## 问题汇总

| 级别 | 问题 | 文件:行号 | 建议 |
|------|------|-----------|------|
| 🔴 致命 | 3 处 sync 残留未补 is_newbie_task | core.js:936/978/1196 | 实施 FIX-FE2 卡 |
| 🔴 致命 | 倒计时仍用 expires_at | core.js:480-481 | 改 t.deadline |
| 🟡 中 | doSubmit 错误静默 | data.js:375 | 加错误提示 |
| 🟡 中 | name/title 匹配可能失败 | data.js:374 | 加 quest_id 字段 |

---

## 结论

**FIX-BE (df51edc) 完成正确 ✅** — BE 序列化补字段 + 5 测试覆盖

**FIX-FE (cb4ebc6 + cd31c57) 部分完成 🟡：**
- ✅ L360 sync 映射已修
- ✅ doSubmit 接 completeNewUserTask
- 🔴 L936/978/1196 残留未补（FIX-FE2 卡待实施）
- 🔴 expires_at 未改 deadline（FIX-FE ② 未修）

**建议：** 1 营优先实施 FIX-FE2 + 修 expires_at→deadline，红队复验后方可上线。

---

## 太傅注 3 行

- **sync 路径 4 处** — 补 1 漏 3 等于没补，全量 grep 是基本功
- **字段名是契约** — BE 用 deadline，FE 用 expires_at，双轨制副产物
- **错误不能静默** — `.catch(function(){})` 是 code smell，用户应知 BE 报错
