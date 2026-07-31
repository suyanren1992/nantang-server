---
created: '2026-07-31'
project: 南塘云村
type: 回执
domain: 红队A
task_status: 已验收
status: 打回
series: REDTEAM-A_验NEW-USER-TASK-FE
---

# REDTEAM-A 验 NEW-USER-TASK-FE · 红队 A · 2026-07-31

**验仓**：`nantang-mobile/`（一营 FE）  **验人**：红队 A  
**验卡**：`方案/任务卡/NEW-USER-TASK-FE_新人任务前端_v0.md`（5 项）  
**验 commit**：`b47dfcb`（一营回执 `NEW-USER-TASK-FE_回执_一营_2026-07-31.md`）

---

## 结论

🎯 **打回。②③④ 三项因 BE-FE 字段链路断裂无法工作，① 中的 `completeNewUserTask` 是死代码。⑤ 可用但有优化空间。**

---

## 逐项挑漏洞

### ① API 方法：`getNewUserTasks` / `completeNewUserTask`

| 判据 | 结果 | 洞 |
|------|:----:|-----|
| GET 端点 `/api/new_user_tasks/me` | ✅ | `api.js:169` 正确对接 BE `new_user_tasks.py:168`。 |
| PATCH 端点 `/:id/complete` | ✅ | `api.js:170` URL 拼装正确，`encodeURIComponent` 到位。 |
| 卡要求缓存到 `AppData._data.new_user_tasks` | 🔴 | **未实现**。两方法仅 `return this.request(...)` 裸返原始 Promise，无任何 AppData 写入。`api.js:169-170`。 |
| `completeNewUserTask` 被调用 | 🔴 | **死代码**——全仓 grep 零调用点。`doSubmit`（`data.js:331-372`）走常规提交流 (`NT.submitTask` / `API POST submit`)，从未调此方法。新建人任务走常规路径会绕过 BE 的 Verification 建记录（`new_user_tasks.py:243`）、过期检查（`new_user_tasks.py:233`）、模板金额查表（`new_user_tasks.py:237-240`）。`api.js:171` 定义了但无处使用。 |
| 边界：离线模式 | 🟡 | `getNewUserTasks` 没有任何 `_guardOnline` 检查或离线回退，离线环境调用会静默 reject。 |

---

### ② 工作台 🆕 角标

| 判据 | 结果 | 洞 |
|------|:----:|-----|
| `t.is_newbie_task === true` 时显示角标 | 🔴 | **永不渲染**。原因链：BE `list_tasks` 端点（`server/routes/tasks.py:79-86`）序列化不含 `is_newbie_task` 字段 → 即使 BE 返回了，FE sync 映射（`core.js:360` 和 `core.js:1196`）也不写此字段 → `TASKS[name].is_newbie_task` 始终 `undefined`。`core.js:446` 的三元判断 `t.is_newbie_task ? '🆕 新手' : ''` 恒走空分支。 |
| 角标位置「任务卡右上角」 | 🟡 | 实际位置：inline 在 `.task-name` span 内（`core.js:446`），在任务名文字末尾、NT 金额前面。不是独立定位右上角。 |
| 复用 `UI.StatusBadge` | 🟡 | 未复用——直接内联 `<span style="...">`。卡面明确写「复用块面：UI.StatusBadge（已有，4 态：🟢🟡🔴⚫）」。 |
| 浅绿背景 `#e8f5e9` | ✅ | 颜色正确。 |
| 边界：多 badge 堆叠 | 🟡 | 如果未来加上 `is_system_generated` 角标，两项 inline span 会挤在同一行，无优先级/间距处理。 |

---

### ③ 详情倒计时 + 「新手引导」标签

| 判据 | 结果 | 洞 |
|------|:----:|-----|
| 显示「🆕 新手引导」标签 | 🔴 | 同上（②）——`t.is_newbie_task` 为 `undefined`，`core.js:477` 的 `if(t.is_newbie_task)` 永不进入，整块 HTML 不生成。 |
| 倒计时「X 天 Y 时」 | 🔴 | **字段名断裂**：`core.js:479` 使用 `t.expires_at`，但 BE（`new_user_tasks.py:196`）返回名为 `deadline`，FE sync 也映射到 `deadline`（`core.js:360`）。`t.expires_at` 始终 `undefined` → 即便修复 `is_newbie_task` 也不渲染倒计时。 |
| 已过期不显示 | 🟡 | 卡面写「已过期任务不显示」，代码在 `core.js:485` 显示红色「⏰ 已过期」。语义差一档（不显示 vs 显示过期标签）。 |
| 边界：倒计时 0 精度 | 🟡 | `daysLeft>0 ? daysLeft+'天' : ''`——当 `daysLeft=0` 且 `hoursLeft=0` 时，显示「0小时后过期」，语义凑合但不够友好。小于 1 小时时用「不足 1 小时」更妥。 |
| 边界：`remainsMs` 脏读 | 🟡 | `Date.now()` 只在渲染时执行一次，不自动刷新。用户盯着详情页看倒计时不会走。 |

---

### ④ 完成 toast

| 判据 | 结果 | 洞 |
|------|:----:|-----|
| 第 1 个 → 「🎉 完成你的第 1 个新人任务！」 | 🔴 | 同上（②）——`data.js:360` 的 `if (t.is_newbie_task)` 恒不进入，整个 toast 块不触发。 |
| 第 N 个 → 「🎉 完成第 N 个新人任务，加油！」 | 🔴 | 同上，不触发。 |
| 全完成 → 「🌟 全部新人任务完成！」 | 🔴 | 同上，不触发。 |
| 计数逻辑 | 🟡 | `doneCount` 计算：`x.status === '待审核' \|\| x.status === '已结算'`（`data.js:362`）。BE `TASK_STATUSES["submitted"] = "待审核"`、`TASK_STATUSES["settled"] = "已结算"`——中文值对齐，但「已驳回」状态不计入，若被驳回后重交会正确计入。逻辑本身 OK。 |
| 边界：同一任务重复提交 | 🟡 | `doSubmit` 无幂等检查——用户连点两次提交按钮，`doneCount` 增 2（两次状态设 `'待审核'`），但 `totalCount` 不变，可能误触发「全完成」toast。 |
| 边界：`showToast` 是否定义 | 🟡 | `showToast` 在 `utils.js` 定义，`data.js` 不 import/检查直接调用。虽然全局可用，但缺少防御式检查（对比 ⑤ 中对 `_showNewbieTaskModal` 做了 `typeof === 'function'` 检查）。 |

---

### ⑤ checkin 后弹新人引导模态

| 判据 | 结果 | 洞 |
|------|:----:|-----|
| 首次入住（非换房）拉 API | ✅ | `app.js:2188`：`if (!isSwitch && ...)` 正确区分首次入住 vs 换房。`isSwitch` 在 `app.js:2291` 定义为是否已有活跃 Tenancy。 |
| 有任务时弹模态 | ✅ | `app.js:2190`：`r && r.ok && r.tasks && r.tasks.length` 链式防御。 |
| 无任务不弹 | ✅ | `r.tasks.length` 为 0 或 r 为 null → 不弹。 |
| 模态内容：欢迎语 + N 个任务 + NT 奖励 | ✅ | `core.js:1607-1612`：标题「欢迎入住南塘云村！」、N 计数、任务列表带序号 + NT。 |
| 「稍后」关闭 | ✅ | `core.js:1617`：`onclick="this.closest('.disc-modal-overlay').remove()"`。 |
| 「📋 查看任务」跳工作台 | ✅ | `core.js:1618`：`onclick="...;showMy()"` —— `showMy()` 跳工作台任务栏。 |
| 使用 BE 响应字段 | ✅ | `t.title\|\|t.name`（BE 有 `title`）、`t.reward_nt\|\|t.nt\|\|0`（BE 有 `reward_nt`）均正确回退。 |
| 边界：checkin 返回已含 `assigned_newbie_tasks` | 🟡 | BE `/api/checkin` 响应（`accommodation.py:128,188`）已带 `assigned_newbie_tasks`，FE 多一次往返调 `API.getNewUserTasks()`。可用 checkin 响应数据原地渲染，减少 1 RTT。 |
| 边界：模态 z-index 冲突 | 🟡 | `core.js:1605`：`z-index:350`。不调 `closeAllModals()`（如 `disc-modal-overlay` 清除），可能覆盖在已有模态之上。 |
| 边界：空 `.catch()` | 🟡 | `app.js:2191`：`.catch(function(){})` 静默吞错——API 失败时用户无提示，延误排查。 |
| 边界：任务列表 cut 6 条 | ✅ | `tasks.slice(0,6)` — 合理。超过 6 条时用户需进工作台看全量。 |

---

## 根因判定

**核心断裂点**：`is_newbie_task` 字段从 BE → FE 的传输链两处断裂：

1. **BE 未发**：`server/routes/tasks.py:79-86` 的 `list_tasks`（`fetchTasks` 数据源）序列化不含 `is_newbie_task`。
2. **FE 未存**：`core.js:360` 和 `core.js:1196` 的 sync 映射也不含 `is_newbie_task`。

两条链任一修复，②③ 可复活。③ 的倒计时另需将 `t.expires_at` 改为 `t.deadline`（或 sync 映射加 `expires_at` 别名）。

**死代码**：`API.completeNewUserTask`（`api.js:171`）定义了但无调用点——新 nib 任务走常规 submit 路径，绕过了 BE 的 Verification 建记录 + 过期校验 + 模板金额查表。

---

## 改动建议（最小修复集）

| 优先级 | 位置 | 改什么 |
|--------|------|--------|
| 🔴 P0 | `server/routes/tasks.py:84` 后 | 加 `"is_newbie_task": t.is_newbie_task,` 到 list_tasks 序列化 |
| 🔴 P0 | `nantang-mobile/js/core.js:360,1196` | sync 映射加 `is_newbie_task:t.is_newbie_task\|\|false` |
| 🔴 P0 | `nantang-mobile/js/core.js:479` | `t.expires_at` → `t.deadline`（或 sync 映射中别名 `expires_at:t.deadline`） |
| 🔴 P0 | `nantang-mobile/js/data.js:331-372` | `doSubmit` 中判断 `t.is_newbie_task` 时调 `API.completeNewUserTask(t._srvId)` 而非走常规 submit |
| 🟡 P1 | `nantang-mobile/js/app.js:2189` | 用 checkin 响应的 `assigned_newbie_tasks` 替代二次 API 调用 |
| 🟡 P2 | `nantang-mobile/js/core.js:446` | 角标改为右上角绝对定位，或复用 `UI.StatusBadge` |

---

## 太傅注

**前端修 5 项、后端对不上一项，是最常见的「看起来做完了」陷阱。** 红队的价值不是找谁的错，而是找到 BE/FE 之间的缝隙——那条链上任何一个字段少传一格，功能就静默失效。静默失效比报错更危险，因为验收时容易漏——自测用的是 mock 数据（直接设 `is_newbie_task:true`），真实数据走 BE sync 才有这条缝。

**下次 FE 验收自测，至少跑一次真 BE 返回的原始 JSON，不要只信本地 mock。**

---

> 红队 A 交付。结论：**打回**——②③④ 不工作，① 有死代码。⑤ 可用。最小修复 4 行 P0 + 1 行 P1。
