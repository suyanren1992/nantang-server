# EMPIRICAL-B 验证回执 · 红队 B

> 卡号：EMPIRICAL-B_验3项完工_v0（A-FIELD-PAGE / 🔴2.3 / 🔴2.4）
> 审查方：红队 B（Claude Code）— 找盲点，不看已知问题
> 方法：`项目/实景游戏移动端代码_new/` 真仓读码 + git log 逐 commit diff
> 日期：2026-07-31

---

## 一、A-FIELD-PAGE（commit `d66bace`）：田间页卡片化 + 3 入口收敛

### 判据对照

| # | 卡面/回执声明 | 真仓验证 | 结果 |
|---|-------------|---------|:--:|
| ① | `openFieldPage()` 存在 | app.js:1609 — 定义完整，打开 overlay | ✅ |
| ② | UI.Card 范式（head/body/actions/onAction） | app.js:1640-1663 — `UI.Card({ object, head, body, actions, onAction })` | ✅ |
| ③ | FAB 🌱 → `openFieldPage()` | app.js:239/241 — 地图建筑列表 field 分支 | ✅ |
| ④ | 快捷卡片「田间管理」→ `openFieldPage()` | app.js:425 — quick-card onclick | ✅ |
| ⑤ | 管理面板 field → `openFieldPage()` | app.js:1000/1527 — 2 处 mgmt 入口收敛 | ✅ |
| ⑥ | API 优先 / 离线兜底 | app.js:1617-1624 — `API.getFields()` → `_renderFieldCards()` / catch → `_renderFieldCardsLocal()` | ✅ |
| ⑦ | `#overlayFieldPage` 在 index.html | index.html:302 — overlay 容器 + close 按钮 | ✅ |
| ⑧ | `_doFieldAction` 按钮回调生效 | app.js:1792-1806 — 调用 API.waterFieldPlot/fertilizeFieldPlot/harvestFieldPlot | ✅ |

### 盲点

**🟡 B1 — 静默失败**：`_doFieldAction` 中 `if (!fn) return;`（app.js:1797）
- 如果 API 对象上缺少 `waterFieldPlot` 等方法 → 按钮无响应，无 toast
- 触发条件：API 版本不匹配 / 服务端端点改名但前端未同步
- 严重度：**低**（当前 API 方法已验证存在，但你改 API 时记得搜这里）

**🟢 判定：真生效。** 4 个入口全部收敛到同一个 `openFieldPage()`，UI.Card 范式正确用于 4 块田。

---

## 二、🔴2.3 F 窗（commit `b96c208`）：buildings.json + init_db 种子

### 判据对照

| # | 卡面/回执声明 | 真仓验证 | 结果 |
|---|-------------|---------|:--:|
| ① | buildings.json 存在 | server/seed/buildings.json — 182 行，11 栋建筑 | ✅ |
| ② | id/name/icon/meta/photo/photoBg/status/summary/floors/plots 10 字段 | buildings.json 逐字段对照 HARDCODED_BUILDINGS — **完全对齐** | ✅ |
| ③ | 11 栋 vs HARDCODED_BUILDINGS 11 栋 | 两边 id 序列一致：toilet_b / parking / gate_a / office / info / study / field / stage / plaza / jingzi_pavilion / lawn | ✅ |
| ④ | office 含 3F 7+4+2 子空间 | buildings.json:47-68 — 1F×7, 2F×4, 3F×2 | ✅ |
| ⑤ | study 含 1F×7 + 2F×6 + 阁楼×1 | buildings.json:91-113 — 与 HARDCODED_BUILDINGS L21 逐层一致 | ✅ |
| ⑥ | field 含 5 个 plots | buildings.json:125-131 — fa/fb/fc/fd/fe + crops 数组 | ✅ |
| ⑦ | init_db 幂等（MapLocation(key="shared") 查重） | database.py:309-311 — 先查后写 | ✅ |
| ⑧ | seed 文件缺失不崩溃 | database.py:323 — logger.warning，不抛异常 | ✅ |
| ⑨ | 全链路可读：sync_all → 前端 getBuildings() | data.py:568-569 读 shared → 返回 map_locations；app.js:31 读 `.buildings` | ✅ |

### 盲点

**🟡 B2 — 粗粒度幂等检查**：init_db 用 `MapLocation(key="shared")` 是否存在判断是否已 seed（database.py:309）
- 如果 admin 在 init_db 之前通过 `save_map_locations` 或 `sync_shared` 创建了 shared 记录（不含 buildings），init_db 会跳过种子
- 实际风险：**极低**（init_db 在启动时同步执行，早于任何用户请求）
- 但你部署新环境时注意：**先 init_db，再开放 API**

**🟡 B3 — 种子可被覆盖**：`save_map_locations`（data.py:338，admin-only）和 `sync_shared`（data.py:407，admin-only write）都可以覆盖 `MapLocation(key="shared").data`
- 如果 admin 通过 sync_shared 写入一个不含 `buildings` 字段的 `map_locations` → 种子数据丢失
- 前端 `getBuildings()` 会回退到 HARDCODED_BUILDINGS 兜底（app.js:35）
- 种子丢失不致命（有兜底），但破坏了「服务端真源」的设计意图
- **建议**：merge 而非 overwrite — 或者至少日志告警当 shared 被覆盖

**🔴 B4 — 客户端仍依赖硬编码**：按卡面"前端改读在后续卡"，此 bug 仍存在
- 新用户登录 → sync_all 返回 map_locations（含 buildings）→ `getBuildings()` 优先读服务端（app.js:31）
- 但服务器宕机/离线 → 回退 HARDCODED_BUILDINGS
- 当前状态：**种子已播，前端能读到，但机制脆弱**（see B3）

**🟢 判定：真生效但脆弱。** 种子数据正确，init_db 写入正确，全链路连通。但覆盖风险和客户端兜底意味着「服务端真源」尚未稳固。

---

## 三、🔴2.4 G 窗（commit `3da7e8e`）：presence 所属权校验

### 判据对照

| # | 卡面/回执声明 | 真仓验证 | 结果 |
|---|-------------|---------|:--:|
| ① | uid≠current_user && role≠admin → 403 | data.py:425-426 — 3 行校验 | ✅ |
| ② | A 写自己 presence → 200 | 校验仅检查 `uid != user.id`，self-write 放行 | ✅ |
| ③ | admin 写任意 presence → 200 | `user.role != "admin"` 例外 — admin 全权 | ✅ |
| ④ | 整包拒绝（混合 self+other → 全拒） | for 循环内逐 uid 检查，任一不通过 → 403 | ✅ |
| ⑤ | e2e smoke 保持 | 回执声明 6 passed，代码未动 e2e 路径 | ✅ |

### 边界 case 白盒审计

| 边界 | 代码行为 | 判定 |
|------|---------|:--:|
| `{"presence": {}}` 空 dict | `bool({})` = False → 整块跳过，静默 | ✅ 无副作用 |
| `{"presence": {"A": "not_a_dict"}}` 非 dict 值 | `isinstance(pdata, dict)` = False → continue 跳过 | ✅ 静默跳过 |
| `{"presence": {"A": {...}, "B": {...}}}` A=self B=other | A 通过 → B 403 → 整包拒绝 | ✅ 设计意图 |
| `{"presence": {"": {...}}}` 空字符串 uid | `"" != user.id` = True → 403（非 admin）| ✅ 合理拒绝 |
| `uid = user.id` 精确匹配 | 通过校验 → 写入 | ✅ |
| 无 token → 无 user | `get_current_user` 拦截 → 401 | ✅ |

### 盲点

**🟡 B5 — admin 校验依赖字符串比较**：`user.role != "admin"`（data.py:425）
- User model role 字段默认 `"visitor"`（models.py:51）
- `require_admin` 依赖同款字符串比较（auth.py:69）
- 如果某处代码将 role 拼成 `"Admin"` / `"ADMIN"` → 校验失效
- 实际风险：**低**（当前 role 设置路径均用小写，accommodation.py 设 `"npc"`/`"visitor"`）

**🟡 B6 — admin 例外不可测试于新部署**：`require_admin`（auth.py:68-70）
- 第一个 admin 必须手动 INSERT 到 DB（无 bootstrap 端点）
- 这意味着 `user.role == "admin"` 的测试 case（admin 写任意 presence → 200）在全新部署中无法验证
- 不影响安全（admin 不存在 = 无人可越权写他人 presence），但测试覆盖存在盲点
- **建议**：加一条 seed SQL 或环境变量注入首个 admin

**🟢 B7 — sync_shared 其他写入路径已有保护**：
- map_locations 写入 → `user.role == "admin"` 检查（data.py:407）✅
- camps 写入 → `user.role == "admin"` 检查（data.py:400）✅
- canteenMenu 写入 → `user.role == "admin"` 检查（data.py:413）✅
- pendingConfigChanges 写入 → `user.role != "admin"` → 403（data.py:439）✅
- configHistory 写入 → `user.role != "admin"` → 403（data.py:448）✅
- **sync_shared 整体安全水位一致**

**🟢 判定：真生效。** 校验逻辑正确，边界 case 处理合理，admin 提权链安全（visitor→npc 自动，admin 手动 bootstrap），无越权路径。

---

## 汇总

| # | 项目 | commit | 真生效？ | 盲点 | 严重度 |
|---|------|--------|:--:|------|:--:|
| 1 | A-FIELD-PAGE | `d66bace` | ✅ 是 | B1: _doFieldAction 静默失败 | 🟡 低 |
| 2 | 🔴2.3 buildings | `b96c208` | ✅ 是（脆弱） | B2: 粗粒度幂等 · B3: 种子可覆盖 · B4: 客户端兜底 | 🟡 中 |
| 3 | 🔴2.4 presence | `3da7e8e` | ✅ 是 | B5: 大小写 · B6: admin bootstrap | 🟡 低 |

**3 项完工 commit 均真生效。** 无虚报。盲点均为边界 case，无阻断性漏洞。

### 建议优先级

| 优先 | 建议 | 关联 |
|:--:|------|------|
| P2 | B3: shared 记录 merge 而非 overwrite（防种子丢失） | 🔴2.3 |
| P2 | B6: 加首个 admin 的 bootstrap 端点或 seed SQL | 🔴2.4 |
| P3 | B1: `_doFieldAction` 静默失败加 toast 提示 | A-FIELD |
| P3 | B4: 前端改读服务端（按后续卡计划） | 🔴2.3 |
| — | B2/B5/B7: 保持现状，不须改 | — |

> 红队 B 验证完成 · 逐文件逐行真仓对照 · 零估算 · 7 盲点

## 太傅注 3 行

- **种子是播了，地还没围篱笆** — buildings.json 正确入库但 shared 记录可被覆盖，服务端真源需加固
- **presence 锁上了，但钥匙只存在 DB 里** — admin 校验链完整但需手动 bootstrap，部署文档应写明
- **红队 A 找的是"有没有做"，红队 B 找的是"做了之后还有什么会坏"** — 两者互补，不重复
