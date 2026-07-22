# 南塘云村 · Kimi Code 交接文档

> 2026-07-22 · 从 Kimi Work 规划会话交接 · 开工前必读
> 本文档是唯一入口。读完后从「第 0 步」开始执行，不要跳过。

---

## 0. 最重要的安全规则（先读这个）

1. **git 先行**：仓库已存在，改造前基线已提交（`38cf911`，2026-07-22，含全部现状 + 文档归档）。之后每次改动前先 commit，一次只改一个功能，改完单独 commit。注意：本项目有过"修复被后续重构冲掉"的前科（见 B1），所以每个修复必须单独 commit，便于追溯。
2. **只移不删**：任何旧文档、旧代码要清理时，先移入 `存档/`，等所有者确认后才删除。设计文档（`设计/`、`方案/` 里的 .md）是资产，永不删除。
3. **一次一个方案**：`执行中/` 目录同一时间最多 1 份方案。做完 → 归档 → 再拿下一份。不要并行改多个功能。
4. **冒烟清单**：每次代码改动后，手动验证这 10 条核心路径：登录/刷新保持登录、发任务、接任务、卡片室发起发现、猜一次卡片、NT 余额变动、住宿入住、食堂订餐、充值提交、档案室打开。
5. **心脏文件谨慎改**：`js/nt-core.js`（NT 结算引擎）和 `js/app-data.js`（数据层）改动必须单独 commit + 全量冒烟。
6. **部署纪律**：Render 自动部署已改为手动（第 0 步确认）。本地验证通过后才 Manual Deploy。

---

## 1. 项目是什么

「南塘云村」——线下共建社区的实景游戏化运营工具。核心闭环：做事 → 被发现在卡片室"猜谁在干活" → 确认 → 双方获得 NT 虚拟货币。五类身份：管理员/共建者/冒险者/在地伙伴/云村民。

## 2. 技术架构速览

- **前端** `nantang-mobile/`：纯静态 HTML/JS，零框架零构建，ES5 风格全局函数，21 个 js 文件按依赖顺序 `<script src>` 加载。
- **后端** `server/`：FastAPI + uvicorn（端口 8000）+ SQLite。JWT access token（60 分钟）+ httpOnly cookie refresh（7 天）。部署在 Render。
- **数据双轨**：离线 file:// 模式全走 localStorage；HTTP 模式走 API + 每 10 秒轮询。**线上线下数据互通是已知大坑**。

### 关键文件地图

| 文件 | 职责 |
|---|---|
| `nantang-mobile/index.html` (84KB) | 4 主页面 + 15 overlay + ~840 行内联脚本（postMessage 桥、会话恢复、hash 路由） |
| `js/app.js` (132KB) | 实景地图全部逻辑（建筑/房间/打扫/田地/全貌页 renderInfoPage） |
| `js/core.js` | 账本 UI、任务大厅、充值表单、10 秒轮询 `_startPolling` |
| `js/nt-core.js` | NT 结算引擎（金融唯一真相源，含会计等式校验） |
| `js/app-data.js` | AppData 统一数据层（共享/私有分键存储、每日 tick） |
| `js/ui-cardroom.js` | 卡片室「猜谁在干活」核心玩法 + 劳动定价表 |
| `js/ui-archive.js` | 档案室 4 Tab |
| `js/ui-camp.js` / `js/ui-wizard.js` | 营地 7 Tab / 7 步创营向导 |
| `js/ui-phase4.js` | 客栈 + 食堂 + renderTimeline |
| `js/api.js` | 后端 API 适配层 |
| `server/main.py` + `server/routes/` | FastAPI 入口与路由（auth.py、nt.py 等） |

### 死代码（待清理，需所有者确认后删除）

- `js/map-app.js`（51KB 旧版地图，未加载，数据已分叉）
- `js/feishu.js`（废弃飞书通道，未加载）
- `core/eventbus.js`（未加载）、`modules/` 7 个空目录、`ui/theme.css`（与 css/theme.css 重复）

---

## 3. 已知 Bug 清单（含根因，按优先级）

| # | 现象 | 根因 | 位置 |
|---|---|---|---|
| B1 🔴 | 刷新后登录态丢失 | refresh cookie 缺 `secure=True`，HTTPS 下浏览器拒存。**注：此修复 7/20 曾提交（3fa3633），Round 1 重构（2d286f3）重写 cookie 函数时被冲掉，还一度丢了 httponly。修复 = 在 auth.py:33 重新加回 `secure=True`，提交信息注明"防再次回归"** | `server/routes/auth.py:33` |
| B2 🔴 | 登录过期后轮询不停、控制台每 10 秒报错 | 判断 `tasks.detail === 'unauthorized'`，但后端返回 `"Unauthorized"`（大写） | `js/core.js:206` |
| B3 🟡 | 充值表单点不进去/填不了 | z-index 遮挡：新手引导浮层 280、信箱 300 > 资料弹窗 250 | `js/core.js:1032`、`index.html:221` |
| B4 🟡 | "点充值提醒登录" | 充值链路纯本地无登录判断；实为页面加载时 autoLogin 失败的 toast 误导。随 B1 修复 | `index.html:1254-1293` |
| B5 🟡 | 档案室「卡片记录」Tab 点了没反应 | `switchArchiveTab` 漏 `'cards'` 分支，`renderArchiveCards` 已写好但零调用 | `js/ui-archive.js:249`、`index.html:1111` |
| B6 🟡 | activity_log 刷新就丢 | 不在 `_saveShared` 持久化白名单，`logActivity` 不调 `_save()` | `js/app-data.js:216`、`js/ui-archive.js:41` |
| B7 🟡 | 社区页「南塘时间线」内容错误 | 数据源是当前用户私密 journal，不是社区事件；且时间渲染出 "undefined"（`j.date` 不存在） | `js/ui-phase4.js:505-522` |
| B8 🟢 | 充值线上多人不同步 | 前端纯本地记账，后端 `/api/nt/topup`（admin 权限）从未被前端调用 | `js/api.js:81` |
| B9 🟢 | 大扫除面板 0 房间 | `_collectCleaningRooms()` 过滤条件 `r.cleaning.length > 0`，所有房间 cleaning 都是 `[]` | `js/app.js:1009` |
| B10 🟢 | 田地管理双实现不一致 | `_showFieldSheet`（内联简版）与 `renderFieldPanel`（标准版）并行 | `js/app.js:1114` |

---

## 4. 六周路线图

| 周 | 主题 | 内容 | 状态 |
|---|---|---|---|
| 0 | 止血 | 冷备份 + git 基线 + 关 Render 自动部署 + 修 B1(cookie secure) + 文档归档 + 建《现状盘点表》 | ⬜ |
| 1 | 核心闭环修复 | B2-B7 逐个修 + 死代码清理（确认后） | ⬜ |
| 2-3 | 全貌页改造 | 按 `方案/2026-07-22_1900_全貌页面板综合改造方案.md` 执行：P0 大扫除 27 间房(B9) + 田地统一(B10) → P1 冰箱双门 + 挂载 3 个未挂载函数 | ⬜ |
| 4 | 档案室改造 | 时间线迁入 + 四区结构（个人/营队/社区/时间线）+ NT 三层门槛（免费浏览/深度查看 1-2NT/导出 10-50NT，费用进社区池，看自己永远免费） | ⬜ |
| 5 | 治理补全 | 公约全文签署（`方案/2026-07-22_1725` 议题一）、营地权限统一 `canManageCamp()`（议题五）、reset-db 端点（议题二）、staging 环境（议题七） | ⬜ |

待执行方案文档（都在 `方案/` 目录）：
- `2026-07-22_1725_第三轮讨论方案_测试策略与Bug修复.md`（7 个议题，含优先级表）
- `2026-07-22_1900_全貌页面板综合改造方案.md`（精确到行号，可直接执行）

---

## 5. 第 0 步任务清单

**已由 Kimi Work 完成（2026-07-22 晚）：**

- ① 冷备份 ✅ → `C:\Users\苏砚仁\thinknote\项目\备份\实景游戏移动端代码_备份_20260722_1908.tar.gz`（13MB，555 个文件，已校验，排除了 venv）
- ② git 基线 ✅ → 仓库原本就存在（含 Round 1-6、R7-R11 等历史提交），基线提交 `38cf911`「存档：改造前基线 2026-07-22」已叠加在最新
- ⑤ 文档归档 ✅ → 根目录 54 份过程稿（Step0-8、任务01-13b、审查报告、旧执行方案等）已移入 `存档/2026-07-22_改造前归档/`，只移不删

**轮到 Kimi Code 执行：**

④ 修 B1：`server/routes/auth.py:33` 的 set_cookie 加回 `secure=True`（修复曾被 Round 1 重构冲掉，见 Bug 清单 B1 注），单独 commit
⑥ 建《现状盘点表.md》：功能 × 状态（✅已验证/🟡写了未验/🔴坏/⚫没做/🗑死代码），从此是唯一真相源

**需所有者本人操作（Kimi Code 提醒他）：**

③ Render 后台：Settings → Auto-Deploy 改为 Off

---

## 6. 与 Kimi Work 的分工

- **这里（Kimi Code）**：执行代码改动、跑验证、git 操作。
- **Kimi Work 会话**：产品决策、方案评审、盘点表与路线图维护。改代码前若发现「要做什么」不明确，先回去对齐再动手。

> 交接人：Kimi Work 规划会话 · 2026-07-22
