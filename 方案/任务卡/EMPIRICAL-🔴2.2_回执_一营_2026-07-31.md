# EMPIRICAL-🔴2.2 施工回执 · 一营

> 卡号：EMPIRICAL-🔴2.2_statusPills渲染
> 施工方：一营 Claude Code
> 日期：2026-07-31

## 施工记录

**改动**（2 文件）：

1. `nantang-mobile/js/app.js` L264 后插入 1 行：
```javascript
function(){ return _s('statusPills', _renderStatusPills()); },
```
位置：mgmtGrid 与 cardRoomSection 之间。`_renderStatusPills()` 已在 L296-322 完整实现。

2. `nantang-mobile/index.html` L544：`?v=43` → `?v=44`

**commit**：`11a0d73` fix(EMPIRICAL-🔴2.2): sections 数组补 _renderStatusPills，全貌页恢复空间状态指示

## 验收自检

- [x] 语法：`node --check nantang-mobile/js/app.js` 通过
- [x] sections 数组含 `statusPills` 项
- [x] `_renderStatusPills()` 函数完整（绿/黄/红计数 + 物品过期提醒）
- [x] ?v= 已升版
- [x] 未碰 server/

> 施工完成 · 1 行修复 · 1 commit · 未 push
