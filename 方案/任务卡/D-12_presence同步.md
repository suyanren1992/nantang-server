# 任务卡 D-12：presence 翻牌状态跨设备同步 🟠

> 施工方：Claude Code（一营，跨端卡全权，可动 server/routes/data.py 对应端点） · 监察：Kimi Code · 验收：Kimi Work · 单独 commit，不 push
> 来源：07-24 夜战复盘（丞相承诺的已知限制，现立项补上）

## 背景
服务器和同步管道都在：`POST /api/data/sync_shared`（上行）+ `GET /api/data/sync_all`（下行）。**presence 只是没接进管子**——不是缺服务器：
- 上行：`app-data.js` `_saveShared` 的 POST payload（:226 附近）只含 camps/map_locations/inventory/canteenMenu/tasks/users，没有 presence
- 下行：`core.js` `_mergeSyncData`（:908）不合并 presence
- journal 已在 dcc2b08 接通（可参考其接法）

## 修法
1. **先读 `server/routes/data.py` 的 sync_shared/sync_all 存储模型**：
   - 若服务端是透传共享文档（整个 JSON 存取）→ 只需改前端两处（payload 加 presence、merge 合并 presence），服务端零改动
   - 若服务端按字段白名单接收 → 同步给 data.py 白名单加 presence
2. 合并策略：presence 以**服务端为准整体覆盖**（状态类数据，无需细粒度合并）；本机刚翻牌后立即 `_saveShared` 上行（现有 flipPresence 已触发保存，确认即可）
3. 遵守铁律 6：升 app-data.js / core.js 的 ?v=

## 验收
- 设备 A 翻牌为"🟢 在地"→ 设备 B 刷新后在"在地人员"区看到 A 的状态
- 离线翻牌 → 恢复联网后自动上行（依赖现有保存机制，若缺失需补登记）
- commit message：`feat(D-12): presence 接入 sync_shared/sync_all 双向同步（翻牌状态跨设备可见）`
