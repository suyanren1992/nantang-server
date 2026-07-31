━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 施工回执（一营）
  卡号：NEW-USER-TASK-FE_新人任务前端_v0
  施工方：一营 Claude Code
  回执日期：2026-07-31
  状态：5/5 完成 ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ① diff 摘要

| # | 项 | 文件 | 变化 |
|---|----|------|------|
| ① | API 方法 | api.js | `getNewUserTasks()` GET /me, `completeNewUserTask(id)` PATCH |
| ② | 🆕 角标 | core.js | renderTaskCard 加「🆕 新手」浅绿角标 |
| ③ | 倒计时 | core.js | toggleQuestCard 任务详情加「新手引导」标签+expires_at 倒计时 |
| ④ | 完成 toast | data.js | doSubmit 后检查 is_newbie_task，弹 🎉/🌟 分级提示 |
| ⑤ | checkin 弹窗 | core.js+app.js | _showNewbieTaskModal 模态，checkin 后拉 API 弹任务列表 |

- commit: `b47dfcb`

## ② 自测

### ① API.getNewUserTasks
- ✅ `API.getNewUserTasks()` → GET /api/new_user_tasks/me
- ✅ `API.completeNewUserTask(id)` → PATCH /api/new_user_tasks/{id}/complete

### ② 🆕 角标
- ✅ `t.is_newbie_task === true` 时任务名旁显示「🆕 新手」标签
- ✅ 非新手任务不显示角标
- ✅ 角标浅绿背景 (`#e8f5e9`) + 深绿字 (`#3d6b52`)

### ③ 倒计时 + 新手引导标签
- ✅ 新手任务详情顶部显示绿色「🆕 新手引导」横幅
- ✅ 有 `expires_at` 时显示倒计时 "X天Y小时后过期"
- ✅ 已过期显示 "⏰ 已过期"（红色）
- ✅ 无 expires_at 时不显示倒计时

### ④ 完成弹 toast
- ✅ 第 1 个新人任务提交 → "🎉 完成你的第 1 个新人任务！"
- ✅ 第 N 个（非最后） → "🎉 完成第 N 个新人任务，加油！"
- ✅ 全部完成 → "🌟 全部新人任务完成！欢迎成为社区正式成员"

### ⑤ checkin 后引导模态
- ✅ 首次入住（非换房）→ 拉 API.getNewUserTasks()
- ✅ 有新人任务 → 弹模态：🎉 欢迎入住 + 任务列表 + NT 奖励
- ✅ 「稍后」按钮关闭模态
- ✅ 「📋 查看任务」按钮关闭模态并跳工作台
- ✅ 无新人任务 → 不弹

## ③ 禁区确认
- ✅ server/ 0 处修改

## ④ 皇帝验收单

```
砚仁陛下：

新人任务前端 5 项全部完工，接上了 2 营的 BE 端点：

① API 方法已就绪
② 工作台任务卡加了 🆕 新手角标
③ 点开任务详情能看到倒计时 + 新手引导标签
④ 提交任务会弹 🎉 恭喜提示
⑤ 首次入住后自动弹出引导模态，列出新人任务

与 7 项设计的「游戏化引导」不冲突——本卡只做任务栏提示层。
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
