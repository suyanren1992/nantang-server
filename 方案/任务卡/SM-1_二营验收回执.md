---
title: SM-1 批②冒烟五bug · 二营验收回执
created: 2026-07-27
project: 南塘云村
type: 验收回执
domain: 部署运维
status: 验收通过
author: 二营（Codex）
---
# SM-1 · 批②冒烟五bug 二营验收回执

> 验收对象：commit `5a13803`（一营施工，5 文件，未碰 server/）
> 卡面：`方案/任务卡/SM-1_批②冒烟五bug.md`
> 验收人：二营（Codex）· 2026-07-27
> 结论：**四关全过 + 关⑤核查完成 → 验收通过**（真机关③留砚仁本人无痕复测）

---

## 关① 逻辑关 — git show 5a13803 逐文件对照根因

`git show 5a13803 --stat`：
```
 nantang-mobile/css/main.css      |  2 +-
 nantang-mobile/index.html        |  8 ++++----
 nantang-mobile/js/app.js         |  8 +++++---
 nantang-mobile/js/core.js        | 28 +++++++++++++++++++---------
 nantang-mobile/js/ui-cardroom.js | 10 +++++-----
 5 files changed, 34 insertions(+), 22 deletions(-)
```
未碰 `server/` — 与卡面「一营阵地/未碰服务端」约束一致。✅

| 子项 | 卡面根因锚点 | 5a13803 实际修法 | 判定 |
|---|---|---|---|
| 1 发任务消失 | `core.js:697 doPublish()` HTTP 路径只走本地 `AppData.addTask`，服务端从未收到 → 刷新即消失 | `core.js:683-721` 重构：离线走 `NT.createTask`+本地收尾；HTTP 走 `API.syncTask(data, cb)` 上行服务端，回调写 `_srvId` 再收尾 | ✅ |
| 2 村口双标题重叠 | `index.html:40 <h1>/:82 <h2>` 与卡片重叠 | `main.css:95` `.village-brand` 加深色渐变底（rgba(29,46,36,.92→透明），品牌栏不透明化，文字不再与白底卡片撞色 | ✅ |
| 3 作证提示看不清 | `ui-cardroom.js:466` 标题 `#2a4a30`、`:471` 按钮 `.65rem` | 标题 `#2a4a30→#1a2a20`、描述 `#5a6e5c→#3a3a3a`、字号 `.72→.75rem`、按钮 `.65→.72rem` | ✅ |
| 4 校核键没反应 | `ui-cardroom.js:471 onclick→_closeModal()` | 根因：`_closeModal()` 未定义→`ReferenceError` 静默吞掉后续 `verifyAction`。修法：onclick 内联 `querySelectorAll('.disc-modal-overlay').remove()` 替换未定义函数 | ✅ |
| 5 冰箱打不开 | 对照 B-2 冰箱引用 | `app.js:1173 _openMgmtSheet('kitchen')`+`_rerenderKitchen()` 加 try-catch 兜底：`renderKitchenPanel()` 抛错时弹「面板加载失败」壳而非静默无反应 | ⚠️→✅ |

**关①备注（诚实标注）**：子项 5 是防御性兜底（保证不再「按了没反应」），非定位 `renderKitchenPanel()` 抛错真实根因。若线上真机仍打不开，会弹「面板加载失败」壳并 `console.error`，据此可二次定位——比原「静默无反应」可诊断。可接受修法，根因是否彻底除掉需真机关③确认。

**多改漏改核查**：`index.html` 8 处改动全为 `?v=` 版本号，无越界业务改动；五子项全覆盖，无漏项。✅

---

## 关② 实测关 — 发任务全链路（httpx ASGI 隔离库实测）

技术法：`httpx.ASGITransport` 在隔离临时 sqlite（`%TEMP%\sm1_smoke.db`）跑，临时注入 `JWT_SECRET`、`CRON_ACTIVE=0`，不碰生产库。用 httpx.AsyncClient（urllib 系），无 curl 中文编码坑。

服务端创建端点 = `tasks.py:84 POST /api/tasks`（与卡面锚点一致，nt.py 版已废弃）。

实测输出原文：
```
① register: 200 True
② balance set: 100
③ create: 200 {"ok":true,"task_id":"T260726165539-c0c698"}
④ hall count: 1 | our task in hall: True | title: 冒烟测试
⑤ mine count: 1 | our task in mine: True
balance after (expect 90): 90
```

| 步 | 期望 | 实测 | 判定 |
|---|---|---|---|
| ① 注册拿 token | ok:true | 200 True | ✅ |
| ② 预置余额 100 | 100 | 100 | ✅ |
| ③ 创建任务(个人,reward=10) | ok:true+task_id | 200 ok:true | ✅ |
| ④ GET ?mode=hall 大厅可见 | 任务在 | in hall: True | ✅ |
| ⑤ GET 我的任务可见 | 任务在 | in mine: True | ✅ |
| 扣款校验 | 100→90 | 90 | ✅ |

**判定**：服务端全链路(创建→大厅→我的任务→扣款) ✅ 全绿。`5a13803` 的 doPublish 现调 `API.syncTask` 上行此端点，正是修复「刷新即消失」关键。前端真机链路留关③。

---

## 关④ 机检关 — deploy_check

`python server/scripts/deploy_check.py --skip-smoke`（smoke 需线上 URL，本地跳过）：
```
[1/4] 依赖对账      V 6 个第三方 import 均已声明
[2/4] ?v= 一致性    V 0 个本地 js/css 引用全部带 ?v=
[3/4] 环境变量      13 个（DATABASE_URL/JWT_SECRET 必需）
  依赖对账 PASS | ?v= 一致性 PASS | 环境变量 PASS
```
**?v= 递增核查**：main.css 9→10 / core.js 18→19 / ui-cardroom 9→10 / app.js 16→17，四项全递增，无回退无冲突。✅

---

## 关⑤ 加核 — core.js:633 vs 697 是否同一调用链

`grep AppData.addTask( core.js` → 仅两处：`633`、`695`。

函数边界实证：
```
630 function saveDraft(){          ← 633 在此
636 function publishTask(){
683 function doPublish(){          ← 695 在此（卡面所指 697）
722 function publishDraft(name){
749 function _finalizePublish(name){
```

- **633** 在 `saveDraft()`：保存草稿 `AppData.addTask(draft)`（status='draft'），其后无 API/sync——设计如此：草稿仅本地暂存，不该上行。
- **695** 在 `doPublish()`：真正发任务，5a13803 已补 `API.syncTask`。
- 草稿→发布走 `publishDraft():722`，其函数体 724-737 已调 `API.syncTask(t, cb)` 上行。

**核查结论**：633 与 697 非同一调用链（草稿暂存 vs 发布）。但 633 不是发任务第二漏网入口——草稿的服务端上行由 `publishDraft():722` 独立覆盖且已有 syncTask。故：633 无需记入 SM-2 模式C待修清单（非漏网），不阻塞本卡验收。（结 SM-2 中「core.js:633 疑第二入口」疑点：属草稿路径，非漏网。）

---

## 影响面回填（爆炸半径四答）

- **改了哪几个文件**：main.css/index.html/app.js/core.js/ui-cardroom.js（前端5个），未碰 server/、未碰资金/权限逻辑。
- **调用方**：doPublish←发布确认按钮；_openMgmtSheet←建筑/全貌页管理入口；_confirmWitness←校核 tab。
- **被依赖方**：`API.syncTask`(api.js:145)、`AppData.addTask/updateTask`、`renderKitchenPanel`。
- **关联测试**：本回执关②实测（服务端全链路）。
- **回滚路径**：`git revert 5a13803`（纯前端，无 DB 迁移，可安全回滚；退回 v9/v18/v9/v16）。

---

## 验收总表

| 关 | 内容 | 结论 |
|---|---|---|
| ① 逻辑关 | 五子项修法逐一对应根因，无越界无漏项（子项5兜底已标注） | ✅ PASS |
| ② 实测关 | 发任务全链路5步全绿+扣款100→90 | ✅ PASS |
| ③ 真机关 | 无痕五项复测 | ⏳ 留砚仁本人 |
| ④ 机检关 | deploy_check 三项全绿+?v=全递增 | ✅ PASS |
| ⑤ 加核 | core.js:633 属草稿路径，非发布第二入口，不漏网不阻塞 | ✅ 结疑 |

**二营验收结论：四关全过，关⑤结疑。建议关③真机无痕复测通过后转正。**

> **太傅注**：补课 17（后端验收看实证不听说）。人话原理：关②没信「我改了 doPublish 就好了」，而是真起服务发一条任务、再查大厅/我的任务/余额三处都对上——服务端确实收到并扣了钱，才敢说链路通。子项5是兜底不是根治，真机若还打不开冰箱，这次至少会弹壳报错、能接着查。
