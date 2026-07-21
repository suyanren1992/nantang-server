# 系统设计师审查 · 数据层与API

> 审查范围：数据层、API 通信、hash 路由、每日 tick
> 文件：server/routes/data.py, server/database.py, nantang-mobile/js/app-data.js, nantang-mobile/js/api.js

## 发现 9 项

### 1. 🔴 _dailyPoolRefill guard 页面刷新丢失 → 刷 N 次 = N×50 NT 注入
**文件：** app-data.js:566,218
`_lastPoolRefill` 不在 `_saveShared` 序列化 payload 中 → 刷新后 guard=undefined → 每次刷新 refill。
**修复：** payload 中加 `_lastPoolRefill`，refill 后调 `this._saveShared()`。

### 2. 🔴 _mergeSyncData 静默接收错误/401 → card discoveries 丢弃
**文件：** api.js:127-131, core.js:697-715
syncAll 无错误检查 → `{ok:false, error:'登录过期'}` 传入 _mergeSyncData → 静默跳过。card discoveries 字段被丢弃。
**修复：** 回调前检查 `data.ok !== false && !data._offline`。补 `data.discoveries` 合并。

### 3. 🔴 _mergeSyncData 永不更新已存在任务 → 客户端状态永久陈旧
**文件：** core.js:699-702
`if (!dup)` 仅插入新任务。服务端 status 变更不传播到客户端已有任务。
**修复：** 去重后对已存在任务 apply `Object.assign` 更新 status/assignee 等。

### 4. 🟡 sync_shared camp_data 单值无验证 → 500
**文件：** data.py:316-321
`isinstance(camps, dict)` 保护外层，但内部 `camp_data.get("name")` 对非 dict 值抛 `AttributeError`。
**修复：** 循环内加 `if not isinstance(camp_data, dict): continue`。

### 5. 🟡 sync_shared canteenMenu 值无验证 → 500
**文件：** data.py:329-334
同 #4 — `menu.get("lunch")` 对非 dict 值抛错。
**修复：** 加 `isinstance(menu, dict)` guard。

### 6. 🟡 _mergeSyncData journal/newbie quests 全量替换 → 离线数据丢失
**文件：** core.js:703,712-713
`AppData._data.journal = []` 再重填 → 离线 journal 条目永久丢失。newbie quests 同样。
**修复：** 按 key 合并插入。

### 7. 🟡 init_db CommunityPool 多 worker 竞态
**文件：** database.py:27-32
"check-then-add" 模式无唯一约束。多 uvicorn worker → 重复 pool 行。
**修复：** 加 UNIQUE 约束或文档说明仅单 worker。

### 8. 🟢 get_verifications detail JSON 损坏 → 500
**文件：** data.py:114
`json.loads(v.detail)` 对损坏 JSON 抛异常。整个端点 500。
**修复：** 包裹 try/except。

### 9. 🟢 服务端任务字段在客户端合并时静默丢弃
**文件：** core.js:701
服务端 `sync_all` 返回 `assignee`、`evidence`、`settler_id`，但 `_mergeSyncData` 均不映射。
**修复：** 将 `assignee` 映射到 `claimants` 数组。存储 `evidence`、`settler_id`。
