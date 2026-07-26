---
title: SM-3 社区副本UI六问 · 二营验收回执
created: 2026-07-27
project: 南塘云村
type: 验收回执
domain: 前端UI
card: SM-3
commit: 52a6858
status: 逻辑关一处缺陷待返修（NT闭环通过），实测/机检通过，真机留砚仁
author: 二营（Codex）
---
# SM-3 · 社区副本UI六问 二营验收回执

> 验收对象：commit `52a6858`（一营施工，4 文件 index.html/app.js/data.js/ui-archive.js）
> 卡面：`方案/任务卡/SM-3_社区副本UI六问.md`
> 验收人：二营（Codex）· 2026-07-27
> 结论：**②实测关+④机检关通过；①逻辑关发现一处真缺陷（子项3「房间状态复位」失效）+ 一处死代码（子项1 迁入点偏离，旧 renderTimeline 成孤儿）**——NT 闭环与假 toast 已正确处理，缺陷不涉资金安全但未达卡面判据，交丞相裁是否返修。③真机留砚仁。

---

## 关① 逻辑关 — 逐文件过 diff

### a. 子项1 · 时间线迁入点 ui-archive.js（卡面预估 ui-phase4.js）

**diff 事实**：
- `index.html:164-165` 删除「📜 南塘时间线」段（section-head + timelineList）✅
- `data.js:599 openCommunityPage` 去掉 `renderTimeline()` 调用 ✅
- `ui-archive.js` 新增 `_renderTimelineHTML()` 生成器 + `toggleArchiveExpand` 末尾插入「📜 我的时间线」块 ✅（文本过 `esc()`）

**偏离核查（重点）**：卡面处方是「`renderTimeline()`（ui-phase4.js:240）**本体不删——改造接入**」。一营实际**另写**了 `_renderTimelineHTML()`（ui-archive.js:428），**未复用/未改造** ui-phase4.js 的 `renderTimeline()`。

**后果 — 旧 renderTimeline 成孤儿死代码**：全仓 grep `renderTimeline`（区分大小写）：
```
ui-phase4.js:240  function renderTimeline() {   ← 定义
（无任何调用点——openCommunityPage 已删调用，别处零引用）
app.js:465/566 是 _renderTimelineSection（另一函数，档案卡），非 renderTimeline
```
→ `renderTimeline()`（ui-phase4.js:240-257，操作 `#timelineList` DOM，而该容器已被 index.html 删除）**现为无人调用的死代码**。

**判定**：功能达标（社区副本无时间线段 ✅、个人归档展开区显示时间线 ✅、esc 转义 ✅），但**偏离卡面「改造本体」处方，遗留一段死代码**（`renderTimeline` + 其唯一目标 DOM `#timelineList` 已不存在）。建议清理或至少注释标注废弃。**不涉安全，属整洁度缺陷。**

### b. 子项3 · _submitMyCleaning 接校核闭环

**① NT 只走校核通过路径（无新水龙头）** ✅：
- `_submitMyCleaning`（app.js:1705）调 `AppData.addVerification('cleaning', ...)` → `app-data.js:323` 仅 push `pendingVerifications`（status:'pending'，`ntAmount` 存着**不发放**）+ POST `/api/data/verifications`。
- NT 实际入账在 `nt.py:819 approve_verification`（校核通过）：`pool.balance -= total_payout`、`doer.nt_balance += nt_amount`（nt.py:878-879）。
- 服务端 `add_verification`（data.py:203）只建 pending 记录，**不碰余额**。→ 无新水龙头 ✅（实测见关②）。

**② 假 toast 是否删净** — ⚠️ 部分：
- 主路径（addVerification 可用）：已删「+N NT」，改为 `Game.toast('已提交校核：…（待他人确认后 NT 到账）','info')` ✅
- **else 兜底分支**（app.js:1721）仍保留 `Game.toast('完成 '+roomName+' +'+nt+'NT')`——但该分支仅在 `AppData.addVerification` 不存在时触发（生产环境 AppData 恒在），且它本就不入账（原来也只是 toast）。**属死分支残留假文案**，非活跃假入账。建议删或改文案，**不阻塞**。

**③ 房间脏污度复位逻辑 — ❌ 真缺陷（未达卡面判据）**：
```
app.js:1708  if (!cl[rr.buildingId||'']) cl[rr.buildingId||''] = { dirtiness: 0 };
app.js:1709  else cl[rr.buildingId||''].dirtiness = 0;
```
`rr` 来自 `_collectCleaningRooms()`（app.js:1104/1108/1117），其 push 的 room 对象字段为 `{id,name,icon,status,buildingName,cleaning}`——**不含 `buildingId`**（grep 实证：buildingId 只在 app.js:1029 的**另一个**采集器出现，非清洁房间采集器）。
→ `rr.buildingId` 恒为 `undefined` → 复位写到 `cl['']`（空字符串键）。
→ 而房间颜色/状态由 `cl[b.id].dirtiness`（`_collectCleaningRooms` app.js:1098）派生——**没有任何建筑读 `cl['']`**。
→ **结论：脏污度归零写错了键，实际建筑 dirtiness 未复位，房间 🔴/🟡 颜色不会变绿。** 卡面判据「房间状态有可见变化」仅部分成立（该房间会从「我的选择」列表移除 sel.splice，但颜色态不复位）。

**修法建议**：`_collectCleaningRooms` 的 room push 补 `buildingId:b.id`（三处 push：1104/1108/1117），或 `_submitMyCleaning` 改用 `rr.id`/回查 building。**不涉资金（NT 正确），属功能缺陷。**

### c. 子项2 · renderCommunityHub 兜底（data.js）

diff（data.js:623）逐字段核：

| 字段 | 兜底 | esc | 判定 |
|------|------|-----|------|
| emoji | `c.emoji||'🏕️'` | —（emoji 固定源，无需 esc） | ✅ |
| name | `c.name||'未命名'` | `esc()` | ✅ |
| date | `c.date||'日期待定'` | `esc()` | ✅ |
| people | `c.people||0` | —（数字） | ✅ |
| theme | `c.theme||''` | `esc()` | ✅ |
| status | 三元映射进行中/招募中/已结束 | —（枚举） | ✅ |

`esc` 全局定义（utils.js:163，先于 data.js 加载）✅。**五字段逐一兜底 + 文本过 esc，无一裸拼**。达标 ✅。
（卡面要求「顺手查服务端 null 字段点名」：models 中 camp 的 theme/date 为 nullable 无 default，API 返回 null 即前端裸显——一营 commit message 已点名，属历史脏数据不改服务端，仅报，合规。）

**关①小结**：子项2 完全达标；子项1 功能达标但迁入点偏离卡面且遗留死代码；子项3 NT 闭环✅/假 toast 主路径已删/**房间复位存在真缺陷**。

---

## 关② 实测关 — 打扫校核闭环（httpx ASGI 隔离库）

隔离临时 sqlite（`%TEMP%\sm3_smoke.db`），临时 JWT_SECRET，CRON_ACTIVE=0，不碰生产库。httpx.AsyncClient（无 curl 中文坑）。

实测输出原文：
```
pool.balance set: 1000
① submit verification: 200 {'ok': True, 'id': 'vfy_sm3test_1'}
  after submit -> status: pending | doer NT (expect 0): 0
② approve: 200 {'ok': True, 'doer_balance': 8, 'verifier_balance': 3}
  after approve -> vfy status: verified verifier: verf2
  doer NT (expect 8): 8 | verifier NT (expect 3): 3 | pool (expect 989): 989
```

| 步 | 期望 | 实测 | 判定 |
|---|---|---|---|
| ① 提交打扫→出待校核 | status=pending，NT **不预发** | pending，doer NT=0 | ✅ 无假入账/无水龙头 |
| ② 校核通过→NT 真入账 | doer+8 / verifier+3 / 池-11 | 8 / 3 / 1000→989 | ✅ |
| 资金守恒 | 池扣 = doer+verifier | 11 = 8+3 | ✅ |

**判定**：NT 只走校核通过路径、金额从服务端 Verification 表取（不信客户端）、社区池扣账守恒。✅ 全绿。
（前端「🧹快捷卡→openSelfReport(cat=cleaning)」「_submitMyCleaning→addVerification」的按钮/预填属真机 UI，留关③；服务端闭环已证通。）

---

## 关④ 机检关 — deploy_check + ?v= 审计

`python server/scripts/deploy_check.py --skip-smoke`：依赖对账 PASS / ?v= 一致性 PASS / 环境变量 PASS。✅

**?v= 审计**（被改文件须升版）：

| 改动文件 | ?v= 变化 | 判定 |
|---------|---------|------|
| data.js | 12→13 | ✅ |
| ui-archive.js | 17→18 | ✅ |
| app.js | 17→18 | ✅ |
| index.html | 自身无 ?v=（宿主） | — |

三个被引用 JS 文件全部对应升版，无漏升、无多升。✅

---

## 影响面回填（爆炸半径四答）

- **改了哪几个文件**：index.html / app.js / data.js / ui-archive.js（前端4个），未碰 server/、未碰资金/权限端点。
- **调用方**：openCommunityPage←社区副本入口；toggleArchiveExpand←个人页归档；_renderQuickEntryCards←全貌页快捷区；_submitMyCleaning←打扫管理面板。
- **被依赖方**：`AppData.addVerification`（app-data.js:323）、`esc`（utils.js:163）、`openSelfReport`（ui-cardroom.js:752）。
- **关联测试**：本回执关②服务端校核闭环实测。
- **回滚路径**：`git revert 52a6858`（纯前端，无 DB 迁移，可安全回滚；退回 data.js v12/ui-archive v17/app v17，时间线回社区副本）。

---

## 验收总表

| 关 | 内容 | 结论 |
|---|---|---|
| ① 逻辑关 | 子项2达标；子项1功能达标但迁入偏离+死代码(renderTimeline孤儿)；子项3 NT闭环✅但房间复位❌真缺陷 | ⚠️ 一处真缺陷待返修 |
| ② 实测关 | 打扫→待校核(NT不预发)→校核通过→NT真入账 8/3/池989，守恒 | ✅ PASS |
| ③ 真机关 | 快捷卡三卡/🧹进cleaning预填/无假toast/房间状态 | ⏳ 留砚仁 |
| ④ 机检关 | deploy_check三项全绿 + 三JS文件?v=全升 | ✅ PASS |

**二营验收结论：实测关+机检关通过；逻辑关发现子项3「房间脏污度复位」真缺陷（`rr.buildingId` undefined→写空键，房间颜色不复位，未达卡面判据）+ 子项1 死代码。二者均不涉资金安全（NT 闭环正确、假 toast 主路径已删），但子项3 复位是卡面明列判据。建议：子项3 补 buildingId 后返修复验；子项1 死代码清理可并入或记 SM-2。交丞相裁。**

> **太傅注**：补课17。人话原理：这卡最要命的是「别再开假水龙头」——实测证了 NT 确实只在校核通过才发、社区池对应扣账、守恒，这条铁律守住了。但顺着 diff 往下读发现房间「打扫完变绿」那步写错了键（rr 身上根本没 buildingId），等于扫了白扫、颜色不变——不是安全问题，是没干成卡面要的活，得回炉。
