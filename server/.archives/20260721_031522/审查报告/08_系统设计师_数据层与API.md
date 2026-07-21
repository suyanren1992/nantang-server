# 系统设计师审查 · 数据层 & API 一致性

> 2026-07-21 · Agent: systems-designer
> 覆盖: models.py, data.py, app-data.js, schema.js, database.py, store.js, index.html

---

## 发现清单（45 项，已去重）

### models.py（12 项）

1. **缺失所有 FK 列索引** — CampBuilder.camp_id, CampTask.camp_id, DepositIntent.user_id 等全表扫描
2. **DateTime 列全是 String** — created_at/updated_at 等，无法用原生时间函数
3. **NTTask.status 默认 `"pending"` 但 tasks.py 创建时用 `"进行中"`** — 英文/中文混用
4. **assignees 列存 JSON 但类型是 Text** — 无 JSON 约束
5. **DepositIntent 无 (user_id + status) 联合索引** — 每次查询全扫
6. **MealOrder 无 (user, date, meal) 唯一约束** — 可重复点餐
7. **InventoryItem.id 用 timestamp() → 同秒 PK 冲突**
8. **User.frozen_cv 无服务端读写路径** — 死字段
9. **CommunityPool.updated_at 永远 NULL**
10. **CampTask.name 不唯一** — 跨营地可重名
11. **CampBuilder.confirmed 用 Integer 存 Boolean**
12. **CommunityPool 三处创建不同初始值** — auth.py(0) vs database.py(2000) vs nt.py(2000)

### data.py（11 项）

13. **GET /api/data/journal 按 id 排序而非 time**
14. **POST /api/data/journal type 无枚举校验**
15. **POST /api/data/verifications doer 可被设成其他人** — 伪造验校记录
16. **POST /api/data/verifications nt_amount 无上限**
17. **POST /api/data/activity_log 内容无长度限制** — DB 膨胀
18. **POST /api/data/newbie_quests 无重复检查**
19. **sync_all 不返回 assignees** — 多槽任务数据丢失
20. **sync_all 不返回 discovery_id** — 写入了但从不读
21. **POST /api/data/sync_shared 创建 Camp 只填 name** — 其他字段全默认
22. **sync_shared canteenMenu 无日期格式校验**
23. **sync_shared 无并发写入冲突处理**

### app-data.js（13 项）

24. **_seedIfEmpty 硬编码假住宿（王五/李四/大飞）**
25. **硬编码假营地（camp1/camp4/camp5）**
26. **硬编码假菜单（今日午餐：糙米饭+清炒时蔬…）**
27. **_data.myItems 是死代码**
28. **Task key 不一致 — 本地用 name，服务端用 id**
29. **sync_all 不处理 assignees → claimants 始终 []**
30. **_saveShared 本地存全量但 sync_shared 只推 4 个字段** — tasks/users/verifications 不推服务端
31. **_deductAccommodation 债务重复计算**
32. **_archiveOldDiscoveries 修改后不保存**
33. **_dailyPoolRefill 硬编码 50 NT**
34. **_tickDirtiness 回退逻辑死分支**
35. **跨标签同步浅合并 → 嵌套对象被覆盖**
36. **inviteCodes 存在独立 key 中 → 清共享数据不清理**

### schema.js（2 项）

37. **schema.js 属于另一个应用（camp_data 体系）— 对当前 app 是死代码**
38. **_initialized / _role_migrated 设 false 但永远不翻 true**

### database.py（6 项）

39. **ALTER TABLE 异常静默吞掉** — 磁盘满/锁也跳过
40. **无 PRAGMA foreign_keys = ON** — FK 约束不生效
41. **手动 ALTER TABLE 是唯一 migration** — 新增列（wallet_address, frozen_cv 等）不迁移
42. **无连接池配置**
43. **init_db CommunityPool guard 不幂等** — 新列 NULL
44. **未启用 WAL 模式**

### index.html hash 路由（3 项）

45. **无 hashchange 监听** — 浏览器前进后退无效
46. **只有 4 条路由** — cardroom/canteen/treasury 等无 URL
47. **hash 读取在 auth 完成前（300ms setTime）— 可能导航到需要登录的页**

### store.js（4 项）

48. **存储 key 不同** — store.js 用 camp_data，AppData 用 nt_app_v2_shared
49. **reset() 只清 camp_data** — 不清 AppData
50. **App.backup.auto() 无防御检查** — backup.js 加载失败则崩溃
51. **损坏数据备份覆盖旧备份**
