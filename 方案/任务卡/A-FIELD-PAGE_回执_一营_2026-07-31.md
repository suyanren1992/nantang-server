━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 施工回执（一营）
  卡号：A-FIELD-PAGE（田间页卡片化）
  施工方：一营 Claude Code
  回执日期：2026-07-31
  状态：完成 ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ① diff 摘要

| 文件 | 变化 |
|------|------|
| index.html | 加 `#overlayFieldPage` 全屏 overlay |
| app.js | `openFieldPage()` + `renderFieldPage()` + `_renderFieldCards()` (API) + `_renderFieldCardsLocal()` (offline) |
| app.js | 3 入口收敛：FAB / quick-card / _openMgmtSheet → 全部指向 `openFieldPage()` |

- commit: `d66bace`

## ② 自测

### 4 田块卡片
- ✅ 每块田使用 `UI.Card({ head, body, actions, onAction })` 范式
- ✅ head：UI.Icon(emoji + status dot) + 名称 + UI.StatusBadge（生长中/可收割/休耕/缺水/缺肥）
- ✅ body：大图标 + 种植/收割/剩余天数 + UI.Progress（生长度 %）
- ✅ actions：💧浇水 / 🪴施肥 / 🧺收割（only 成熟时显示）/ 🌱新种（only 休耕时显示）
- ✅ onAction 事件委托到 `_doFieldAction(plotId, action)`

### 入口收敛
- ✅ 地图 FAB 🌱 → `openFieldPage()`
- ✅ 快捷卡片「田间管理」→ `openFieldPage()`
- ✅ 地图管理面板 field → `openFieldPage()`
- ✅ 建筑详情「＋ 记录农活」→ `openFieldPage()`

### API/离线
- ✅ 优先 `API.getFields()` → `_renderFieldCards()`
- ✅ 离线 fallback `_renderFieldCardsLocal()`（读 AppData plots）
- ✅ 加载中显示「⏳ 加载中…」

## ③ 禁区确认
- ✅ server/ 0 处修改

## ④ 皇帝验收单

```
砚仁陛下：

田间页卡片化完成。4 块田（番茄/玉米/红薯/枣树）每块都是 UI.Card，
带进度条、状态牌、种植数据、浇水/施肥/收割按钮。

3 个入口（FAB/快捷卡片/管理面板）全部收敛到同一个田间页。
再也不会出现点了不同入口进不同页面的情况。

API 优先，离线用本地种子数据兜底。
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
