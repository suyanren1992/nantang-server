━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 施工回执（一营）
  卡号：NEW-USER-TASK-FIX-FE（红队 A 打回 · 字段链路断裂修复）
  施工方：一营 Claude Code
  回执日期：2026-07-31
  状态：2/2 完工 ✅
  法源：K 窗发现 BE deadline 已存在，只需补 is_newbie_task
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ① diff 摘要

| # | 项 | 文件 | 变化 | commit |
|---|----|------|------|--------|
| ① | sync 补 is_newbie_task | core.js:360 | 尾部追加 `,is_newbie_task:t.is_newbie_task\|\|false` | `cb4ebc6` |
| ③ | doSubmit 接 BE | data.js:360-371 | is_newbie_task 分支追加 `API.completeNewUserTask(quest_id)` | `cd31c57` |

- ?v= bump: core.js 51→52, data.js 22→23

## ② 逐项验证

### ① core.js:360 sync 映射补 is_newbie_task
- ✅ `fetchTasks` 回调中 TASKS 映射追加以 `t.is_newbie_task || false`
- ✅ `deadline` 已存在于当前映射（`deadline:t.deadline`），不重复补
- ✅ falsy (undefined/false/null) → `false`

### ③ doSubmit 接 API.completeNewUserTask
- ✅ 在现有 `if (t.is_newbie_task)` 块内追加，不破坏现有 toast 逻辑
- ✅ 匹配 `AppData._data.newbieQuests` 中 name/title → quest_id
- ✅ `!nq.done` 防重复调 BE
- ✅ `.catch(function(){})` 静默降级，不阻塞主流程
- ✅ `API.completeNewUserTask` 已存在于 api.js:171（PATCH 端点）

## ③ 禁区确认
- ✅ `server/` 0 处修改

## ④ 未修项

| 卡面项 | 状态 | 原因 |
|--------|:--:|------|
| ② `t.expires_at` → `t.deadline` (ui-cardroom.js) | 跳过 | 用户指令排除；K 窗确认 BE deadline 已存在 |

## ⑤ 潜在遗留

| 项 | 说明 |
|----|------|
| BE tasks.py 序列化 | FE sync 已接 `is_newbie_task`，但若 BE 端点不返回此字段 → 始终 `false`。红队 A 指出 `server/routes/tasks.py` 需补。本卡只修 FE 侧。 |
| 其他 sync 路径 | core.js:936/978/1196 另有 3 处 TASKS sync 未补 `is_newbie_task`。按卡面精准修复，仅改 L360。若其他路径也有 newbie 任务需同步修复。 |

## ⑥ 皇帝验收单

```
砚仁陛下：

红队 A 打回的字段链路断裂修复 2 行：

① core.js sync 补 is_newbie_task — 🆕 角标字段不再静默丢失
③ doSubmit 接 API.completeNewUserTask — 新人任务走 BE 校核闭环

只 commit 不 push。禁区零触碰。
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
