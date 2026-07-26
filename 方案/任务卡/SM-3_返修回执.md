---
title: SM-3 返修回执 · 房间复位缺陷+死代码清理
created: 2026-07-27
project: 南塘云村
type: 返修回执
domain: 前端UI
card: SM-3
status: 返修完成，待二营复验
author: 丞相（Claude Code）
---
# SM-3 · 返修回执

> 返修对象：二营验收回执指出的两处缺陷
> 基准回执：`方案/任务卡/SM-3_二营验收回执.md`
> 施工人：丞相 · 2026-07-27

---

## ① 🔴 房间脏污度复位写错键 — 已修复

**根因**：`_collectCleaningRooms()`（app.js）三处 `rooms.push` 不含 `buildingId`，导致 `_submitMyCleaning` 中 `rr.buildingId` 恒为 `undefined`，复位写到 `cl['']`（空键），建筑级 `dirtiness` 未归零。

**修法**：三处 `rooms.push` 各补 `buildingId:b.id`（参照 `_getWeeklyCleaningAreas` app.js:1029 写法）。

**修改位置**：
- `app.js:1103` — 房间级条目 push，补 `buildingId:b.id`
- `app.js:1108` — 建筑级条目 push（有楼层无房间），补 `buildingId:b.id`
- `app.js:1117` — 兜底建筑级条目 push，补 `buildingId:b.id`

**键一致性核对**：

| 条目类型 | entry.id | entry.buildingId | dirtiness 读键 `cl[?]` | 复位写键 `cl[?]` | 一致？ |
|---------|----------|-----------------|------------------------|-----------------|--------|
| 房间级（1103） | `r.id` | `b.id` | `cl[b.id]` | `cl[rr.buildingId]` = `cl[b.id]` | ✅ |
| 建筑级（1108） | `b.id` | `b.id` | `cl[b.id]` | `cl[rr.buildingId]` = `cl[b.id]` | ✅ |
| 兜底级（1117） | `b.id` | `b.id` | `cl[b.id]` | `cl[rr.buildingId]` = `cl[b.id]` | ✅ |

房间级条目的 id 为 `r.id`（房间 ID），但 dirtiness 存储在建筑级 `cl[b.id]`——这是设计如此（整栋建筑共享脏污度）。`buildingId` 提供建筑键、`id` 提供房间标识，各司其职，不混淆。

---

## ② 🟡 死代码删除 — renderTimeline() 已移除

**位置**：`ui-phase4.js:240-257`，`renderTimeline()` 函数本体（18 行）。

**确认已死**：全仓 grep `renderTimeline`（区分大小写）：
- `ui-archive.js:428` → `_renderTimelineHTML()`（新实现，接替功能）
- `app.js:465/566` → `_renderTimelineSection()`（档案卡，不同函数）
- **无任何调用 `renderTimeline()` 的代码** ✅

函数本体已删除，无残留引用。

---

## 版本号变更

| 文件 | 旧 ?v= | 新 ?v= |
|------|--------|--------|
| `app.js` | 18 | 19 |
| `ui-phase4.js` | 9 | 10 |

`deploy_check --skip-smoke`：依赖对账 PASS / ?v= 一致性 PASS / 环境变量 PASS ✅

---

## 影响面

- 改动文件：`index.html` / `app.js` / `ui-phase4.js`（前端 3 个）
- 不改服务端、不改资金/权限端点
- `_collectCleaningRooms` 返回值新增 `buildingId` 字段——调用方仅 `_submitMyCleaning` 使用此字段，无其他消费者
- `renderTimeline` 删除——确认零调用方

---

## 待二营复验

- **逻辑关**：`buildingId` 字段存在、`_submitMyCleaning` 复位键正确
- **实测关**：打扫→提交校核→房间颜色变绿（`AppData._data.cleaning.spaces[b.id].dirtiness = 0`）
- **机检关**：`deploy_check` 全绿、?v= 一致性
