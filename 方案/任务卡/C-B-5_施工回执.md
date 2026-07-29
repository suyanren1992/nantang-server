# C-B-5 施工回执（一营 · Claude Code）

**时间**：2026-07-30  
**卡片**：C-B-5 素社民宿独立前端界面  
**状态**：施工完成，待验收

## 改动清单

| 文件 | 改动 | ?v= |
|------|------|-----|
| `nantang-mobile/js/api.js` | 新增 `innRooms()`、`checkin()` 两个 API 调用 | 21→22 |
| `nantang-mobile/js/ui-phase4.js` | 重写 inn 模块（~200 行），替换原空壳 `openInn()` | 12→13 |
| `nantang-mobile/index.html` | 升级 `?v=` 版本号 | — |

## 施工详情

### 1. api.js
- `innRooms()` — `GET /api/accommodation/inn-rooms`
- `checkin(roomId, track, checkIn, checkOut)` — `POST /api/accommodation/checkin`，支持 `track: "inn"` 参数

### 2. ui-phase4.js（素社民宿完整界面）
- **Tab 切换**：`overlayInn` 顶部"素社民宿 | 合作社住宿"两个 Tab，合作社 Tab 调 `_showStaySheet()`（一字未改）
- **房型网格**：6 间房（梅/兰/竹/菊/四人间A/B）2×3 网格，emoji 图标 + 房型名 + beds + rate + 占用状态
- **日历**：月份导航 + 7 列日期网格，复用 `_showStaySheet` 日历模式（start/end/range/today 标记）
- **占用标红**：`occupied_dates` 数组中日期红色 + 删除线 + `cursor: not-allowed` + 无 onclick
- **预订确认**：选中日期区间 → 显示总价 → `showConfirm` → 调 `API.checkin(roomId, 'inn', ci, co)`
- **入住横幅**：顶部绿色横幅显示已入住房间 + 记账金额 + 退房按钮
- **退房**：确认 → `API.checkout()` → 显示结算详情（天数/单价/合计/已付/欠费）
- **离线 fallback**：API 不可用时 fallback 到硬编码 seed 数据（与 InnRoom model 一致）

### 3. 禁区
- `server/routes/data.py` — 零改动 ✅
- 合作社 `_showStaySheet()` — 一字不改 ✅

## 验收判据自查

1. ✅ 6 间房卡片全部渲染（seed 含梅/兰/竹/菊/quadA/quadB）
2. ✅ 已占日期标红不可选（`.inn-cal-day.occupied` 无 onclick）
3. ✅ 预订调 `POST /api/accommodation/checkin`（track=inn）
4. ✅ 退房调 `POST /api/accommodation/checkout` + 结算详情展示
5. ✅ 合作社住宿零影响（`_showStaySheet()` 未改动）
6. ✅ `node --check` 全绿

## 太傅注

补课章节：`ui-phase4.js` 日历模式移植自 `app.js` `_renderMiniCalendar()`——该函数为合作社住宿专用，素社民宿独立实现了一份日历（inn-cal-* 类），避免跨组件状态污染。这是"复制优于耦合"在单文件多场景中的正确实践。
