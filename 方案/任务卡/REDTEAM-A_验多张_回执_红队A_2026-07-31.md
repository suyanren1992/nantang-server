---
created: '2026-07-31'
project: 南塘云村
type: 回执
domain: 红队A
task_status: 已验收
status: 打回 (2张) + 通过 (1张) + 待确认 (1项)
series: REDTEAM-A_验多张
---

# REDTEAM-A 验多张 · 红队 A · 2026-07-31

**验仓**：`nantang-mobile/`（一营 FE）  **验人**：红队 A  
**验卡**：
- A-CLEAN-WEEKLY-FIX（`a1700d4`）— 管理员自选位置
- A-CLEAN-WEEKLY-FIX2（待）— openCleanWeekly() 入口
- FIX-FE2（3 处 sync）— core.js 补 is_newbie_task

**验法**：全仓 grep + git log --all + 逐行 diff 对照。不靠回执自述。

---

## 结论

🎯 **A-CLEAN-WEEKLY 双卡打回——代码完全不在阵地。FIX-FE2 通过。**

| 卡 | 结论 | 根因 |
|----|:----:|------|
| A-CLEAN-WEEKLY-FIX (a1700d4) | 🔴 打回 | 代码零命中，commit 不在仓库 |
| A-CLEAN-WEEKLY-FIX2 (openCleanWeekly) | 🔴 打回 | 函数未定义，入口零命中 |
| FIX-FE2 (core.js sync) | ✅ 通过 | 5/5 写入点覆盖 |
| BE is_newbie_task 序列化 | 🟡 待确认 | 禁区不可读，上次红队 A 已报 |

---

## 逐卡挑漏洞

### 🧹 A-CLEAN-WEEKLY-FIX（管理员自选位置）

**回执称**：`app.js` `_renderCleanAdmin` 加「我也要打扫」选卡网格，commit `a1700d4`

**实测**：

| 判据 | 预期 | 实际 | 结果 |
|------|------|------|:----:|
| `_renderCleanAdmin` 存在 | hook 函数 | grep: 0 matches | 🔴 |
| `_doAdminClaim` 存在 | 管理员认领方法 | grep: 0 matches | 🔴 |
| `cleanWeeklyClaim` API | api.js PATCH 端点 | grep: 0 matches | 🔴 |
| `cleanWeeklySubmit` API | api.js 提交端点 | grep: 0 matches | 🔴 |
| `openCleanWeekly` 函数 | 周任务页入口 | grep: 0 matches | 🔴 |
| 任何 `cleanWeekly`/`clean_weekly` | 周任务相关代码 | grep 全仓: 0 matches | 🔴 |
| commit `a1700d4` | git log | `git log --all`: not found | 🔴 |

```bash
# 验仓命令
grep -rn 'openCleanWeekly\|_renderCleanAdmin\|_doAdminClaim\|cleanWeeklyClaim\|cleanWeeklySubmit\|clean_weekly' nantang-mobile/
# → 0 matches
git log --all --oneline | grep a1700d4
# → (empty)
```

**根因判定**：整个 A-CLEAN-WEEKLY 功能（BE `feat(CLEAN-WEEKLY-BE)` 993c48a 对应的 FE 端）未进入阵地。不仅 `a1700d4`（管理员自选）缺失，连基础周任务功能（`openCleanWeekly`、`cleanWeeklyClaim` API）也完全不存。

**无法验**：因为 base 层不存在，无法判断回执中「三态正确」「认领走 CAS」「提交走 addVerification 闭环」是否真实。

---

### 🚪 A-CLEAN-WEEKLY-FIX2（openCleanWeekly 入口）

**卡面要求**：`openCleanWeekly()` 加 3 个 onclick 入口（全貌页 + 快捷区 + 卡片室头部），最终 `grep 'openCleanWeekly()'` ≥4 次。

**实测**：

| 判据 | 预期 | 实际 | 结果 |
|------|------|------|:----:|
| 函数定义 | `function openCleanWeekly()` | grep: 0 matches | 🔴 |
| 全貌页 onclick 入口 | `onclick="openCleanWeekly()"` | grep: 0 matches | 🔴 |
| 快捷区 banner 入口 | `onclick="openCleanWeekly()"` | grep: 0 matches | 🔴 |
| 卡片室头部入口 | `onclick="openCleanWeekly()"` | grep: 0 matches | 🔴 |
| grep 计数 ≥4 | 1 定义 + 3 调用 | 0 | 🔴 |

```bash
grep -rn 'openCleanWeekly' nantang-mobile/
# → 0 matches
```

**根因判定**：函数未定义，入口无从接入。与 FIX 卡同一根因——A-CLEAN-WEEKLY 整体未进入阵地。

---

### 📋 FIX-FE2（core.js sync 补 is_newbie_task）

**卡面要求**：core.js 中 TASKS sync 路径补 `is_newbie_task` 字段。

**实测**：

| 位置 | 行号 | 类型 | is_newbie_task? |
|------|:----:|------|:----:|
| `_startPolling()` 轮询 | 219 | 新任务写入 | ✅ `is_newbie_task: t.is_newbie_task \|\| false` |
| `openQuestHallPage()` 大厅 | 249 | 新任务写入 | ✅ `is_newbie_task:t.is_newbie_task\|\|false` |
| `_mergeSyncData()` 新任务 | 712 | 新任务写入 | ✅ `is_newbie_task: t.is_newbie_task \|\| false` |
| `_mergeSyncData()` 更新 | 713 | Object.assign | ✅ `is_newbie_task: t.is_newbie_task \|\| false` |
| `_finishEnter()` 登录后 | 827 | 新任务写入 | ✅ `is_newbie_task:t.is_newbie_task\|\|false` |

```bash
grep -c 'is_newbie_task' nantang-mobile/js/core.js
# → 5
grep -n 'data\.tasks\[.*\].*=' nantang-mobile/js/core.js
# → 4 条写入（219/249/712/827）+ 1 条 Object.assign（713）= 5/5 全覆盖
```

| 判据 | 结果 | 备注 |
|------|:----:|------|
| 所有 BE→FE sync 写入点覆盖 | ✅ | 5/5。无遗漏。 |
| Object.assign 更新路径覆盖 | ✅ | L713 不会在覆盖更新时丢失字段 |
| `\|\| false` 防 undefined | ✅ | BE 不发 → false，不崩溃 |
| 本地发布 `doPublish()` 不补 | ✅ 正判 | 用户自建任务不应设 `is_newbie_task` |
| 回执称 "936/978/1196 另有3处" | 🟡 | 这些行号不是 sync 映射（936=refreshUserUI frozenBar，978=ubStatTasks taskEl，1196=avatar随机生成btn），不影响 |

---

### 🔗 BE 序列化 is_newbie_task

| 判据 | 结果 | 备注 |
|------|:----:|------|
| `server/routes/tasks.py` | 🟡 禁区 | 不可读 |
| 上次红队 A 报告 | 🔴 已指出需补 | `tasks.py:84` 后需加 `"is_newbie_task": t.is_newbie_task` |
| FE 后果 | 🟡 | FE `\|\| false` 防崩溃，但字段恒 false → ②③④ 静默失效 |

**若 BE 仍未补**：FE 的 5 处 sync 虽正确映射，但源数据 `t.is_newbie_task` 始终 `undefined`，`undefined || false` = `false`。🆕 角标/倒计时/toast 均不触发。

---

## 改动建议（最小修复集）

| 优先级 | 位置 | 改什么 |
|--------|------|--------|
| 🔴 P0 | `nantang-mobile/` | **恢复 A-CLEAN-WEEKLY 全部 FE 代码**（回执称已完但不在阵地）。含：openCleanWeekly 函数、cleanWeeklyClaim/Submit API 方法、_renderCleanAdmin/UserCleanTasks 渲染、管理员自选逻辑。 |
| 🔴 P0 | `server/routes/tasks.py:84` 后 | 加 `"is_newbie_task": t.is_newbie_task,` 到 list_tasks 序列化（上次红队 A 已指出，若未修则 FIX-FE2 白修） |
| 🟡 P1 | 全仓 | grep 验 `is_newbie_task` 引用——确认 ②③④（角标/倒计时/toast）的渲染逻辑仍在阵地，否则 FE sync 接到字段也无法展示 |

---

## 太傅注

**A-CLEAN-WEEKLY 最严重**——不是「入口没接」，而是「整个功能不在仓库」。回执说 commit `a1700d4` 修了，但 `git log --all` 里没有，`grep` 全仓零命中。这有两种可能：(1) commit 在另一个 clone/worktree 里但没推到此仓；(2) commit 被 reset/rebase 冲掉了。无论哪种，阵地当前状态是 A-CLEAN-WEEKLY 完全不存——不仅是管理员的「我也要打扫」，连基础周任务（用户选卡、管理员分发）都缺。

**FIX-FE2 是唯一通过的**——5 处 sync 全覆盖，`|| false` 防御到位。但它独木难支：BE 不发字段 → 永远 `false` → 角标/倒计时/toast 永远不触发。这条链需要 BE+FE 双端修。

**三张卡总结**：FE 代码管理有碎片化风险——回执声称已交但仓库不见。建议丞相建立「回执→commit→grep」三步验卡制。

---

> 红队 A 交付。结论：A-CLEAN-WEEKLY 双卡 **打回**（代码完全不在阵地），FIX-FE2 **通过**，BE is_newbie_task **待确认**。
