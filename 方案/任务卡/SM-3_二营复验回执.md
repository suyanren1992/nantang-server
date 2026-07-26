---
title: SM-3 返修 · 二营复验回执
created: 2026-07-27
project: 南塘云村
type: 复验回执
domain: 前端UI
card: SM-3
commit: 6bd9079
status: 复验通过（三关，真机留砚仁）
author: 二营（Codex）
---
# SM-3 返修 · 二营复验回执

> 复验对象：commit `6bd9079`（一营返修，4 文件 app.js/ui-phase4.js/index.html/SM-3_返修回执.md）
> 打回背景：`SM-3_二营验收回执.md`——① buildingId 恒 undefined→房间复位落空键；② renderTimeline 死代码
> 复验人：二营（Codex）· 2026-07-27
> **结论：✅ 复验通过。两处打回项均已修实，实测（真跑复位逻辑）房间 🔴/🟡→🟢，机检含 smoke 全绿。真机③留砚仁。**

---

## 关① 逻辑关

### a. buildingId 补齐 + 键一致性（独立验，不采信「各司其职」口径）

**diff 事实**：`_collectCleaningRooms` 三处 push 全部补 `buildingId:b.id`：
- 房间级（有 floors，app.js:1103）：`id:r.id, ..., buildingId:b.id` ✅
- 建筑级（无 floors，app.js:1108）：`id:b.id, ..., buildingId:b.id` ✅
- 兜底级（app.js:1117）：`id:b.id, ..., buildingId:b.id` ✅

**键一致性独立核查**（读写同键？）：
- **写**（`_submitMyCleaning` app.js:1708-1709）：`cl[rr.buildingId||''].dirtiness = 0`
- **读**（`_collectCleaningRooms` app.js:1096）：`var d = (cl[b.id]) ? cl[b.id].dirtiness || 0 : 0` → status 由 `cl[b.id]` 派生

三种情形下 `rr.buildingId` 均 = `b.id`，读写都落在 **`cl[b.id]`** 同一键：
| 情形 | 条目 id | buildingId(写键) | status 读键 | 同键？ |
|------|---------|-----------------|-------------|--------|
| 房间级 | r.id | b.id | cl[b.id] | ✅ |
| 建筑级 | b.id | b.id | cl[b.id] | ✅ |
| 兜底级 | b.id | b.id | cl[b.id] | ✅ |

→ 键理顺，不再写空串 `cl['']`。一营「各司其职」结论**经独立复核成立**（注：同一建筑内多房间共享 `cl[b.id]` 一个脏污度，是原设计——建筑级粒度，非本卡引入，合理）。

### b. renderTimeline 死代码删除 + 零残留

`ui-phase4.js` diff 删除整段 `renderTimeline()`（18 行）✅。全仓 grep 实证：
```
renderTimeline → app.js:465/566 均为 _renderTimelineSection（另一函数，不是它）
                 ui-archive.js:416/427/428 为 SM-3 新的 _renderTimelineHTML
                 → 旧 renderTimeline() 定义与调用：零残留 ✅
timelineList（被删的 DOM 容器）→ 全仓零引用 ✅（无悬空 getElementById）
```
死代码清除干净，无悬空引用。

---

## 关② 实测关（真跑复位逻辑，非只读代码）

用 node 从 app.js **原文抽取真实 `_collectCleaningRooms` 函数**（非手写复刻）+ 原样复制 `_submitMyCleaning` 复位写入块，构造两类建筑（office=有楼层房间级/🔴dirtiness65、study=无楼层建筑级/🟡dirtiness35）实跑「完成打扫」：

```
=== 打扫前 rooms ===
  id=office_room1 buildingId=office status=red
  id=study        buildingId=study  status=yellow
=== 写入后 cl 键 === {"office":{"dirtiness":0},"study":{"dirtiness":0}}
=== 打扫后 rooms（应全 green）===
  id=office_room1 buildingId=office status=green
  id=study        buildingId=study  status=green
=== 判定 ===
房间级 office_room1 变绿: true
建筑级 study 变绿: true
无空字符串键 '' 泄漏: true
总判定: PASS ✅
```

**判定**：点「完成打扫」后，房间级(🔴)与建筑级(🟡)脏污度均归零、状态**真变绿**，且不再产生空串键 `cl['']`。卡面判据「提交校核后房间 🔴/🟡 应变绿」✅ 达成——这是执行真实函数得出，非读代码推断。
（校核闭环本身/NT 只走通过路径在初验关②已服务端实测证过，本次复验聚焦返修点。）

---

## 关④ 机检关（含 smoke，补一营 --skip-smoke 缺口）

本地起 uvicorn（隔离临时库，隐藏窗，测完已 kill）跑 `deploy_check.py --url http://127.0.0.1:8073` 全四段：
```
[1/4] 依赖对账       PASS
[2/4] ?v= 一致性     PASS（0 个漏带）
[3/4] 环境变量       PASS
[4/4] 部署后冒烟 (http://127.0.0.1:8073)：
      V 首页 / -> 200
      V /api/nt/sync 未授权 -> 401（鉴权有效）
      V 版本号回显: ['18','19','20']
------------------------------------------------------------
  依赖对账 / ?v= 一致性 / 环境变量 / 部署冒烟  四项全 PASS ✅
```
**?v= 审计**：本 commit 升 `ui-phase4.js 9→10`（删死代码）、`app.js 18→19`（补 buildingId），两文件对应单点递增 ✅。（app.js v18 是 SM-3 初版，此次→19；ui-phase4 首次动→10。）
smoke 段 server 已 `Stop-Process` 清理，无后台残留（本会话起的 8073 已 kill）。

---

## 复验总表
| 关 | 内容 | 结论 |
|---|---|---|
| ① 逻辑关 | buildingId 三处补齐、读写同落 cl[b.id]、renderTimeline+timelineList 零残留 | ✅ PASS |
| ② 实测关 | 真跑复位：🔴office/🟡study→🟢，无空键泄漏 | ✅ PASS |
| ④ 机检关 | deploy_check 四段全绿（含 smoke 站点200/鉴权401/版本回显） | ✅ PASS |
| ③ 真机关 | 一轮测全 | ⏳ 留砚仁 |

**二营复验结论：SM-3 返修（6bd9079）三关通过。buildingId 键一致性理顺、房间复位实测变绿、死代码清零、机检含 smoke 全绿。建议真机③通过后连同 SM-3 主体转正。**

> **太傅注**：补课17。人话原理：这次没停在「diff 看着补了 buildingId」——把 app.js 里那个真函数抠出来在 node 里真点了一次「完成打扫」，亲眼看见 status 从 red/yellow 翻成 green、脏污度键落在 cl[office]/cl[study] 而不是空串，才敢签字。上一版就是差这一跑，才让「扫了不变绿」溜过纸面。
