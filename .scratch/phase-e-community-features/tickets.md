# Tickets: 社区功能扩展（Phase E 相关）

> 拆自 [spec.md](spec.md) · 9 轮 · 25 张票据
> 状态：待认领（needs-triage）

---

## 第 1 轮：数据层（S · 3 张 · 2-3h）

### TKT-001 — `nt_tasks` 加 `is_system_generated` + `idempotency_key`

- **文件**：[server/models.py](../../server/models.py) + [server/database.py](../../server/database.py)
- **改量**：models.py +2 列；database.py +migration + 1 UNIQUE INDEX
- **验证**：`sqlite3 nantang_fresh.db ".schema nt_tasks"` 含 `is_system_generated BOOLEAN`、`idempotency_key VARCHAR(128)`

### TKT-002 — `card_discoveries` 加 `doer_name_snapshot`

- **文件**：[server/models.py](../../server/models.py) + [server/database.py](../../server/database.py)
- **改量**：~5 行
- **验证**：`.schema card_discoveries` 含 `doer_name_snapshot VARCHAR(64)`

### TKT-003 — 创建 `server/config/periodic_tasks.json`

- **文件**：`server/config/periodic_tasks.json`（新）
- **改量**：~50 行 JSON（4 个模板：日常清扫/周末大扫除/库存盘点/翻堆肥）
- **验证**：`python -c "import json; json.load(open('server/config/periodic_tasks.json'))"` 通过

---

## 第 2 轮：服务端校核（S · 3 张 · 2-3h）

### TKT-004 — `GET /api/tasks?mode=hall` 大厅模式

- **文件**：[server/routes/tasks.py](../../server/routes/tasks.py)
- **改量**：~30 行（新增 mode=hall 分支 + 在地成员过滤）
- **验证**：`curl /api/tasks?mode=hall&scope=社区` → 返回进行中任务，非在地成员不返回系统任务

### TKT-005 — `POST /api/tasks` 加 `poster='社区'` 分支 + cancel 退款

- **文件**：[server/routes/nt.py](../../server/routes/nt.py)
- **改量**：~30 行（create 分支 ~20 行 + cancel 退款 ~10 行）
- **验证**：admin 发 `poster='社区'` 任务 → pool 减少；取消 → pool 恢复

### TKT-006 — `POST /api/verify` 校核制服务端化 + 4 条防作弊

- **文件**：[server/routes/nt.py](../../server/routes/nt.py)（或 data.py）
- **改量**：~90 行（端点 ~60 行 + 4 条规则 ~30 行）
- **验证**：curl 校核通过 → pool 减少 + NT 到账；自校核 → 400；1h 内重复 → 429；超日限 → 429

---

## 第 3 轮：客户端校核对接（C · 2 张 · 1-2h）

### TKT-007 — `verifyAction()` 改调服务端 `POST /api/verify`

- **文件**：[nantang-mobile/js/app-data.js](../../nantang-mobile/js/app-data.js)
- **改量**：~15 行（替换 `NT.earn()` 调用，file:// 模式保留原逻辑）
- **验证**：HTTP 模式校核 → 调服务端端点；file:// 模式仍走本地

### TKT-008 — `addVerification()` 改调服务端创建

- **文件**：[nantang-mobile/js/app-data.js](../../nantang-mobile/js/app-data.js)
- **改量**：~10 行
- **验证**：上报劳动 → 服务端 `verifications` 表有记录

---

## 第 4 轮：卡片室/校核室标签页（UI · 3 张 · 2-3h）

### TKT-009 — `renderCardRoom()` 顶部加 tab bar

- **文件**：[nantang-mobile/js/ui-cardroom.js](../../nantang-mobile/js/ui-cardroom.js)
- **改量**：~15 行 JS（`_cardroomTab` 状态 + 分发 `guess`/`verify`）
- **验证**：点击 tab 切换，内容刷新

### TKT-010 — tab CSS 样式

- **文件**：[nantang-mobile/css/main.css](../../nantang-mobile/css/main.css) 或 `<style>`
- **改量**：~20 行（44px 触控、active 态高亮、安全区）
- **验证**：移动端两个 tab 均可点击，视觉区分

### TKT-011 — 校核列表渲染 + 云村民只读

- **文件**：[nantang-mobile/js/ui-cardroom.js](../../nantang-mobile/js/ui-cardroom.js)
- **改量**：~20 行（verify tab 内容 ~15 行 + 只读模式 ~5 行）
- **验证**：校核 tab 显示待确认列表，可确认/拒绝；云村民隐藏按钮

---

## 第 5 轮：服务端 cron（S · 2 张 · 2-3h）

### TKT-012 — cron runner 主循环

- **文件**：[server/cron.py](../../server/cron.py)（新）
- **改量**：~90 行（daily/weekly tick 调度 ~50 行 + 模板读取+幂等键+INSERT ~40 行）
- **验证**：手动触发 → nt_tasks 出现任务卡片，二次触发不重复

### TKT-013 — sync 响应加 `cron_active` + COMMUNITY_POOL 余额检查

- **文件**：[server/routes/nt.py](../../server/routes/nt.py) sync 端点 + [server/cron.py](../../server/cron.py)
- **改量**：~15 行
- **验证**：`GET /api/nt/sync` → 含 `cron_active`；pool=0 时 cron 跳过 + WARN 日志

---

## 第 6 轮：客户端降级（C · 2 张 · 1h）

### TKT-014 — `_checkDailyContainers()` 检测 `cron_active` 后跳过

- **文件**：[nantang-mobile/js/app.js](../../nantang-mobile/js/app.js)
- **改量**：~8 行
- **验证**：`cron_active=true` → 不生成 verification

### TKT-015 — `_dailyPoolRefill()` 降级

- **文件**：[nantang-mobile/js/app-data.js](../../nantang-mobile/js/app-data.js)
- **改量**：~5 行
- **验证**：`cron_active=true` → 不执行池补充

---

## 第 7 轮：任务大厅 UI（UI · 2 张 · 1-2h）

### TKT-016 — scope tab 栏（个人/营队/社区）

- **文件**：[nantang-mobile/js/core.js](../../nantang-mobile/js/core.js) + [nantang-mobile/index.html](../../nantang-mobile/index.html)
- **改量**：~15 行 JS + ~10 行 CSS
- **验证**：三个 tab 切换，内容过滤正确

### TKT-017 — 社区 tab 内 filter chips + 卡片视觉区分

- **文件**：[nantang-mobile/js/core.js](../../nantang-mobile/js/core.js)
- **改量**：~25 行（filter chips ~15 行 + 颜色区分 ~10 行）
- **验证**：非在地成员不可见「周期」「赏金」chip；周期蓝边/赏金黄边

---

## 第 8 轮：管理后台（UI+S · 3 张 · 1-2h）

### TKT-018 — 发布社区任务鉴权

- **文件**：[server/routes/tasks.py](../../server/routes/tasks.py)
- **改量**：~5 行（`poster='社区'` 需 `role IN (admin, builder)`）
- **验证**：visitor 发社区任务 → 403

### TKT-019 — `GET /api/admin/pending-newbie` 端点

- **文件**：[server/routes/admin.py](../../server/routes/admin.py)（新或现有）
- **改量**：~20 行
- **验证**：admin 查看待审核新人任务列表

### TKT-020 — 管理后台 UI

- **文件**：[nantang-mobile/js/core.js](../../nantang-mobile/js/core.js)
- **改量**：~25 行（管理员入口 + 待审核列表 + 审核/驳回按钮）
- **验证**：admin 可见「管理」入口，可审核/驳回

---

## 第 9 轮：退房清理（S · 1 张 · 0.5h · 远期）

### TKT-021 — 退房 hook → 释放系统任务认领

- **文件**：[server/routes/accommodation.py](../../server/routes/accommodation.py) 或 checkin/checkout 端点
- **改量**：~10 行（退房时释放 `is_system_generated=true` + `assignee=user` 的认领）
- **验证**：退房 → 之前认领的周期任务 slot 释放

---

## 额外票据（非 9 轮内的补充）

### TKT-022 — 贡献路径选择器

- **文件**：[nantang-mobile/js/ui-cardroom.js](../../nantang-mobile/js/ui-cardroom.js)
- **改量**：~20 行（合并 `openNewDiscovery` + `openSelfReport` 入口）
- **验证**：点击「贡献」→ 选「委托」或「报备」

### TKT-023 — `_submitSelfReport()` 双写验证

- **文件**：[nantang-mobile/js/ui-cardroom.js](../../nantang-mobile/js/ui-cardroom.js)
- **改量**：~5 行（确认同时调用 addVerification 和构造 cardDiscovery 的逻辑完整）
- **验证**：自报劳动 → cardDiscoveries + pendingVerifications 均有记录

### TKT-024 — Phase E 入住系统 E3.1-E3.3
- **依赖**：Phase E spec（独立于本文档）
- **文件**：`server/routes/accommodation.py` + `server/models.py`
- **内容**：入住→resident role、退房→visitor、住宿记录数据模型

### TKT-025 — Phase D12：adminNames 迁移到服务端 role
- **文件**：[nantang-mobile/js/mobile-bundle.js](../../nantang-mobile/js/mobile-bundle.js) + [server/routes/auth.py](../../server/routes/auth.py)
- **内容**：硬编码 `adminNames = ['砚仁']` → 服务端 `users.role`

---

## 汇总

| 轮次 | 票据 | 工时 | 可并行 |
|------|------|:---:|:---:|
| 1 数据层 | TKT-001-003 | 2-3h | 可与 5 并行 |
| 2 服务端校核 | TKT-004-006 | 2-3h | — |
| 3 客户端对接 | TKT-007-008 | 1-2h | 可与 4 并行 |
| 4 标签页 UI | TKT-009-011 | 2-3h | 可与 3 并行 |
| 5 cron | TKT-012-013 | 2-3h | 可与 1 并行 |
| 6 客户端降级 | TKT-014-015 | 1h | — |
| 7 大厅 UI | TKT-016-017 | 1-2h | — |
| 8 管理后台 | TKT-018-020 | 1-2h | — |
| 9 退房清理 | TKT-021 | 0.5h | 远期 |
| 补充 | TKT-022-025 | 取决于前置 | — |

**总计**：25 张票据 · ~14-21h（不含前置 Phase E/D12）
