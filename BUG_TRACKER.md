# Bug 追踪

> 2026-07-19 · 多轮审查汇总
> 状态：✅已修复 / 🔧待修 / 📋Step N

---

## 🔎 监察记录（2026-07-24 · Kimi Code，只读结论，未改业务代码）

### C-4 监察勘察：SQLite → Neon Postgres 方言依赖点清单

通读 `server/database.py`、`models.py`、`main.py`、`cron.py`、`chain_scanner.py`、`nt_helpers.py`、`auth_utils.py`、`routes/*.py`，需适配的点：

| # | 位置 | 问题 | 适配建议 |
|---|------|------|---------|
| 1 | database.py:27-28 | `PRAGMA journal_mode=WAL` / `PRAGMA foreign_keys=ON` —— SQLite 专属，PG 上**启动即报错崩溃** | 按方言守卫（`if engine.dialect.name == 'sqlite'`） |
| 2 | database.py:112 | `INSERT OR IGNORE INTO nt_tasks ...` —— SQLite 方言（在 T7 camp_tasks 旧迁移块内，有 try/except 吞错，PG 上会每次打印 skipped 但不崩） | 方言守卫整个 T7 迁移块（PG 新库无 camp_tasks，本就不需要跑） |
| 3 | database.py:7-9 | 连接层写死 `sqlite+aiosqlite:///{DB_PATH}` | 改读 `DATABASE_URL` 环境变量（`postgresql+asyncpg://`），无变量回落 SQLite，与卡②1 一致 |
| 4 | render.yaml buildCommand | 缺 `asyncpg`（迁移必需）；缺 `web3` —— 老问题：chain_scanner.py:10 顶层 `from web3 import Web3`，线上 scanner 永远初始化失败（main.py:23-30 try/except 吞掉，不致命但链上充值扫描从未运行） | 加 asyncpg；web3 缺失顺带记录，不在本卡修 |
| 5 | database.py:43-111 各 `ALTER TABLE ADD COLUMN` | 无 `IF NOT EXISTS`，靠 try/except pass 幂等 —— PG 上行为同样正确（报错被吞），可不动；若求干净可用 `ADD COLUMN IF NOT EXISTS`（PG 9.6+/SQLite 均支持） | 可不改 |
| 6 | models.py 11 处 `Integer, autoincrement=True` 主键 | SQLAlchemy 通用，PG 映射 SERIAL/IDENTITY | 无需改 |
| 7 | JSON 存 Text（Verification.detail、NTTask.assignees 等）、datetime 存 ISO 字符串、`like()` 模糊查、`with_for_update()` | 均为跨库通用写法 | 无需改 |
| 8 | `_reset_db.py`、`migrate_frozen_cv_20260721.py` | sqlite3 标准库直连本地文件的本地工具，迁 PG 后对新库失效 | 记录即可，不阻塞 |

勘察结论：**真正的硬依赖只有 #1/#2/#3 三处**，都集中在 database.py；routes/ 业务层零方言，迁移面很小。

### C-6 / C-5 / C-3 / C-7 排查结论位置 + 现状警示

四卡排查结论均已在上文（本文件各 🔍 小节），含文件:行号+证据+修法。**重要现状**：这四卡在旧分工下已由 Kimi Code 施工并 commit（C-6=4d0e714、C-5=1658adc、C-3=ca245ea、C-7=a29198e），代码改动已落库未 push。Claude Code 施工前**必须先 `git log` 核对现状**，避免重复施工或覆盖；若验收标准已满足，建议直接转监察校验环节。

### B-3 排查结论：四卡片与建筑页数据源对照

`Game.getData()` 就是 `AppData._data` 的薄封装（core.js:98-106），所以 `_ml()` 系读取与直接读 AppData 是**同一份数据**。逐卡对照：

| 卡 | 全貌页卡片读 | 建筑页读 | 同源？ |
|---|---|---|---|
| 🛏️ 住宿 | `_ml().accommodations`（app.js:267） | `_getRoomLiveData` 同一 accommodations（app.js:88、726） | ✅ 已同源 |
| 🌿 田地 | `getPlots()`（app.js:276，定义 app.js:37-44） | 田地房间面板同用 `getPlots()`（app.js:648），写路径 `_savePlotData` 统一写回 `map_locations.plots`（app.js:657-661） | ✅ 已同源 |
| 🍳 厨房·冰箱 | `AppData._data.inventory.office/study`（app.js:287-289） | 建筑页房间物品 `inventory[spaceId]`（app.js:727-728） | ✅ 已同源（同一 inventory 按建筑 id 分桶） |
| 🧹 大扫除 | 脏污定价 `_mlConfig()`（app.js:262，与建筑页同源）；下次日期 `MGMT_DATA.cleaning.nextDate`（app.js:260） | 脏污状态读 `cleaning.spaces[b.id].dirtiness`（app.js:705-709） | ✅ 房间状态同源；nextDate 是日程配置（存 `_mgmt` blob），不属房间数据，不算不同源 |

**结论**：1817 文档指的"四卡来自 MGMT_DATA 硬编码"在当前代码已消解——`MGMT_DATA`（app.js:866-950）只剩历史记录/日程/选位薄壳，四卡动态数据已全部从 AppData 活源读取。**任务一无需改读取**，施工时静态验证此结论即可，不要为改而改。

**任务二（大扫除补全房间）**：`_collectCleaningRooms`（app.js:1026-1056）的门禁在 **app.js:1037** `if (r.cleaning && r.cleaning.length > 0)`——只有挂了 cleaning 清单的房间才可打扫，正厅/走廊/楼梯/洗手台因此被排除。修法（照卡，~10 行）：1037 行条件改为排除宿舍即可（`if (r.id.indexOf('dorm') !== 0)`），其余结构、兜底分支（1046-1054）不动。注意 `_getWeeklyCleaningAreas`（app.js:963）有同款门禁，但卡未点名，不动。

### 监察任务状态

截至本记录，Claude Code 尚无施工提交（git log 最新为 docs 类），无待审 diff。后续每见其 commit，按流程审 diff + 跑卡内验收 + 实测。

---

## 🔧 待修 - 任务系统

| # | Bug | 文件 | 行号 | 状态 |
|---|-----|------|------|:--:|
| T1 | 任务大厅草稿重复 — `saveDraft` 同时写 `DRAFTS` 和 `TASKS`，`filterQuests` 拼接两者 | nantang-mobile.html | ~1043/1351 | ✅ 7/19 |
| T2 | 范围过滤「营队」失效 — pubScope 与 scope 字段混淆，需 UI 改动 | nantang-mobile.html | ~1045 | 📋 Step 5 |
| T3 | `claimTask` 不检查重复认领 | nantang-mobile.html | ~838 | ✅ 7/19 |

---

## 📋 Step 2 — 地图硬编码数据

| # | 内容 | 文件 | 行号 |
|---|------|------|------|
| M1 | `HARDCODED_BUILDINGS` — 8个建筑的名称/图标/状态/楼层/房间/物品/人物/打扫任务 全部硬编码 | app.js | ~14-24 |
| M2 | `MGMT_DATA` — 打扫定价/历史/住宿历史/田间历史/厨房历史 全部硬编码 | app.js | ~385-415 |
| M3 | 照片 URL 全部是 `placehold.co` 占位图 | app.js | ~15-23 |
| M4 | `ubStats` 日期/天气/在线人数/状态灯 全部硬编码 | index.html | ~46-53 |
| M5 | `getBuildings()` 兜底返回硬编码数据，需改为 `Game.getData()` 提供真实数据 | app.js | ~26-32 |

---

## 📋 Step 3 — 打扫系统

| # | 内容 |
|---|------|
| C1 | 脏污度数据模型未实现（nt_cleaning.spaces） |
| C2 | 自动增长逻辑未实现 |
| C3 | 前后拍照审核流程未实现 |
| C4 | 复议制审核未实现 |

---

## 📋 Step 4 — NT/CV/XP

| # | 内容 |
|---|------|
| N1 | `nt-core.js` 已有 `contributionValue`/`experienceValue` 字段但 CV 从未被修改 |
| N2 | CV 转移规则 (75/25) 未实现 |
| N3 | 公共贡献池未实现 |
| N4 | CV 门槛检查未实现 |
| N5 | `nt.js` 和 `nt-core.js` 两套 NT 系统并存但数据不互通 |

---

## 📋 Step 5 — 社区活动

| # | 内容 |
|---|------|
| A1-14 | 见 Step5_社区活动_执行方案.md 任务清单 |

---

## 📋 Step 6 — 时间线

| # | 内容 |
|---|------|
| J1-12 | 见 Step6_时间线_执行方案.md 任务清单 |

---

## 📋 Step 7 — 服务器

| # | 内容 |
|---|------|
| S1-12 | 见 Step7_服务器部署_执行方案.md 任务清单 |

---

## 📋 Step 8 — 管理后台

| # | 内容 |
|---|------|
| D1-9 | 见 Step8_管理后台_执行方案.md 任务清单 |

---

## 🔍 A-7 校核确认后奖励 NT 没到账 — 排查记录（2026-07-23）

**现象**：校核室点"✅ 确认 +N NT"，看似成功，但劳动者 NT 余额不增加。

**逐环排查结论**（断点在第 2 环，仅一环）：

| 环 | 环节 | 结论 | 证据 |
|---|------|------|------|
| 1 | 客户端 `verifyAction` | ✅ 正常 | HTTP 模式调 `POST /api/nt/verifications/{vfy.id}/approve`，成功回调改状态、失败回滚 pending（app-data.js:365-393） |
| 2 | 服务端校核记录创建 | 🔴 **断点** | 见下 |
| 3 | 服务端 approve 端点 | ✅ 逻辑正确 | 池扣款 + doer/verifier 加余额 + 写账本 + 行锁齐全（server/routes/nt.py:800-879），只是因环2 永远走不到 |
| 4 | 前端余额刷新 | ✅ 无断点 | HTTP 模式余额以服务端 `/api/nt/balance` 为准（core.js:1154），30s 轮询 `/api/nt/sync`（core.js:290-308），到账后自动可见，刷新页面亦持久 |

**断点详述（环2：id 不一致 → approve 永远 404）**：

1. `addVerification` 把含**客户端生成 id**（`vfy_<base36>_<rand>`，app-data.js:321）的完整对象 POST 到 `/api/data/verifications`（app-data.js:327），且 `.catch(function(){})` 丢弃响应。
2. 服务端 `VerificationReq` **没有 `id` 字段**（server/routes/data.py:47-52），extra 字段被忽略；`add_verification` 自建 id `vfy_{timestamp}`（data.py:197）并返回——但客户端没读返回值。
3. 结果：服务端行的 id ≠ 客户端 `pendingVerifications` 里的 id。校核者点确认时带**客户端 id** 调 approve → 服务端查 Verification 表找不到 → 404「校核记录不存在」（nt.py:809-810）→ 客户端 catch 弹 toast 并回滚 pending。**社区池不扣、doer 余额不加、账本不写**。
4. 附带副作用：`sync_all` 合并按 id 匹配（core.js:937-945），客户端 id 与服务端 id 对不上 → 同一条校核在列表里出现两份（本地一份 + 服务端同步一份）。

**修法**（只修断点环，客户端零改动——body 里本就带着 id）：
服务端 `VerificationReq` 增加可选 `id` 字段；`add_verification` 优先使用客户端 id，并按 id 幂等去重（重复提交直接返回已存在行）。

**A-9 顺手核查（只记录，不写代码）**：确认成功回调只写 `_data.discoveries` 和 `announcements`（app-data.js:372-376），**未写入档案室数据源** `activity_log`/`journal`（ui-archive.js:43,193 读这两个）。归档设计另有安排，此处不动。

---

## 🔍 C-4 退出后再登录"用户不存在" — 排查记录（2026-07-23）

**现象**：注册成功 → 退出 → 再登录提示"用户不存在"。

**逐环排查**：

| 环节 | 结论 | 证据 |
|------|------|------|
| 注册落库 | ✅ 正常 | `POST /api/auth/register` 写 User 表并 commit（server/routes/auth.py:60-80） |
| 登录校验 | ✅ 正常 | 同名同表查询（auth.py:86），名字两端均 trim（core.js:1004/1036），无编码不一致 |
| 退出清数据 | ✅ 无殃及 | logout 只 +token_version、删 cookie（auth.py:109-121），不删用户 |
| **数据库持久化** | 🔴 **断点（架构级）** | 见下 |

**断点：SQLite 在 Render 临时文件系统上，每次部署/重启全库清空**

- 数据库是单文件 SQLite：`server/nantang_fresh.db`（server/database.py:7）
- `render.yaml` **没有挂持久磁盘**（无 `disk:` 段），免费版实例文件系统是临时的
- `*.db` 在 .gitignore 中，部署时库文件不从 git 来 → 每次 push 上线 = 新实例 = **全新空库**，所有注册用户随之消失 → 再登录"用户不存在"
- 铁律"push = 上线 Render"，近期高频 push，与"注册后不久再登录就没了"的现象完全吻合

**方案（二选一，需砚仁/Kimi Work 决策后再动手）**：

1. **Render Disk 挂载**（改动小）：render.yaml 加 `disk: {name: nantang-data, mountPath: /opt/render/project/src/server/data, sizeGB: 1}`，`database.py` 的 `DB_PATH` 改为读环境变量（如 `NT_DB_PATH`，默认现路径）。⚠️ Render Disk 需付费实例（Starter 及以上），免费 web service 不支持挂盘。
2. **迁 Postgres**（更耐用）：Render 有免费 PostgreSQL（注意免费库有 30 天期限，长期也需付费）；`database.py` 改为从 `DATABASE_URL` 环境变量读连接串，驱动换 `psycopg`/`asyncpg`，buildCommand 加依赖。改动集中在 database.py，模型层不动。

**状态**：⏸ 架构级问题，按纪律停下来记录，未改代码，等决策。

---

## 🔍 C-6 校核确认后余额仍无 +N（A-7 复修）— 排查记录（2026-07-23）

**干扰排除**：A-7（e10349b）只对新上报生效。新上报仍不到账 → 继续查，发现第二处断点。

**真因（断点仍在环2：金额字段名 camelCase/snake_case 不匹配）**：

1. 客户端 `addVerification` POST 原始 vfy 对象，金额字段是 **`ntAmount` / `verifierReward`**（camelCase，app-data.js:321/327）。
2. 服务端 `VerificationReq` 声明的是 **`nt_amount` / `verifier_reward`**（snake_case，data.py:48-53），camelCase 作为 extra 字段被 pydantic 静默丢弃 → 服务端行存成 **`nt_amount=0`、`verifier_reward=1`（默认值）**。
3. approve 端点从 DB 行取权威金额（nt.py:846-847）→ doer **+0 NT**、校核者 +1。界面却按本地值显示"✅ +N"——与"看似成功但没到账"完全吻合。A-7 修好 id 后 approve 能走通了，这层才暴露出来。
4. 附带问题（卡内方向2）：approve 成功回调不触发余额刷新（app-data.js:370-381），当前用户要等 30s 轮询或手动刷新才看到变化。

**修法**：
- `VerificationReq` 的 `nt_amount`/`verifier_reward` 加 `AliasChoices` 兼容 camelCase（服务端单点改，客户端不动）；
- `verifyAction` 成功回调加 `refreshUserUI()`，确认后立即重拉 `/api/nt/balance` 刷新工作台显示。

**状态**：✅ 已修（见下提交）

---

## 🔍 C-5 社区动态点不开 + 无小字（A-12 复修）— 排查记录（2026-07-23）

**逐环排查**：

| 检查项 | 结论 | 证据 |
|--------|------|------|
| onclick 逻辑/DOM | ✅ 无误 | `nextElementSibling`=cr-body、`lastElementChild`=箭头，均正确（app.js:413-417），与 A-12"静态未复现"一致 |
| CSP 拦截 | ✅ 无 | 服务端只加 `X-Content-Type-Options`（main.py:89-93），无 CSP |
| CSS 压制 | ✅ 无 | `.cr-body{display:none}` 无 `!important`（theme.css:588），inline 样式可覆盖 |
| 轮询重渲染 | ✅ 无 | `_mergeNTSyncData` 只合数据不重渲染（core.js:850-901） |
| **线上代码版本** | 🔴 **最可疑** | index.html 引用 `app.js?v=4`（nantang-mobile/index.html），A-12 改 app.js 后 **v 参数未升级**，浏览器沿用旧缓存。铁证：A-12 新加的 desc 小字在设备上也没出现 → 设备跑的就是旧代码，点击修复自然也没生效 |

**真因**：前端静态文件靠 `?v=N` 缓存破解，但 A-12 改代码没升版本号，线上设备持续运行旧 app.js。

**修法**（按卡建议）：
1. `_collapsibleSection` 去掉行内 onclick，改 `#roomsGrid` 事件委托 addEventListener（渲染后绑定一次），根治行内处理器的转义/环境敏感问题
2. `app.js?v=4` → `?v=5`，强制各端拉取新代码（desc 小字随新代码一起到位）

**状态**：✅ 已修（见下提交）

---

## 🔍 C-3 滑块左侧多余弧角方框 — 排查记录（2026-07-23）

**排查**（无浏览器，几何推算；真机点选留给验收）：

- DOM：`#villageCarousel` 内恰好 3 张 `.vp-card`，无多余节点（index.html:85-89）；背景层/伪元素无框形样式（main.css:78-99）
- CSS：`.village-carousel` 有 `padding:0 calc((100% - 260px)/2)`（main.css:102）——**居中补偿 CSS padding 已经提供了**
- JS：A-5 引入的 `_cardLeft(i,pw) = pw*i - (容器宽-卡宽)/2`（core.js:1552）**把同一份补偿又减了一次**，且步进没算 3px gap

**真因（重复补偿 → 初始定位少滚 ~68px）**：以 390px 屏为例，CSS padding=65px，居中第 2 张卡的正确 scrollLeft=263；`_cardLeft(1,260)` 算出 **195**。停在该位置时：左视口露出卡片 0 的右侧 130px——一个白色圆角残框（`.vp-card-inner` border-radius:18px），右侧却无对称露出 → 正是"屏幕左方多一个弧角方框，三张卡都在"。部分浏览器 scroll-snap mandatory 会把 195 纠正到 263（掩盖症状），与"A-5 后有人见有人不见"的表现一致。

**修法**：`_cardLeft` 改为按实测步进（相邻卡 offsetLeft 差 = 卡宽+gap）计算 `stride*i`，不再减补偿。初始定位和圆点跳转共用此函数，一并归位。

**状态**：✅ 已修（见下提交）

---

## 🔧 C-7 社区池起始值 500 — 施工记录（2026-07-23）

照 `方案/社区池多钱包设计_2026-07-22.md` 落实池初始化（只做多钱包稿中的"起始值"部分，冻结/划拨等 Phase 2+ 不在本卡）：

- **新库**：`init_db` 建池 balance=500、total_issued=500，并写一条 `pool_init` 账（system → community_pool 500，"社区池初始化"）——此前只建行不写账
- **存量库**：池存在且 balance=0 且账本中无 `pool_init` 记录 → 补 balance=500、total_issued+500、写 `pool_init` 账；有 `pool_init` 账则**永不重复补**（幂等，只补一次）
- 发放扣池/充值进池的链路此前已通（approve 端点 nt.py:844-877），本卡未动

**记录在案**：
- 全貌页 `poolCard`（app.js:542）读的是**客户端本地 NT 池**，HTTP 模式下不是服务端权威数据 → "poolCard 待实现（接 /api/nt/pools）"，本卡按卡要求不做界面
- 观察（未改）：`auth.py:74-75` register 兜底建池是 balance=0/total_issued=0，与 init_db 不一致；实际 init_db 必先于请求执行，兜底为死路径，留待后续卡决定

**验证**：`py_compile` 通过；运行时三路径实测（新库/存量补齐/幂等）脚本被用户拦下未跑，留待砚仁冒烟。

---

## ✅ 已修复

| # | Bug | 日期 |
|---|-----|------|
| B1 | `showToast` 同名覆盖（两个定义） | 7/19 |
| B2 | 6处 UTC+8 时区 bug → `today()` | 7/19 |
| B3 | 登录页/注册页头像用用户名当 seed → `avatarURL(avatar_seed)` | 7/19 |
| B4 | `_profileSeed` 被 `refreshUserUI` 覆写为用户名 | 7/19 |
| B5 | `refreshUserUI` 只读 nt_users，与 `Game.getUser` 不一致 | 7/19 |
| B6 | `AppData.switchUser` 创建用户无 `avatar_seed` | 7/19 |
| B7 | `saveProfileEdits` 不存 `avatar_seed`、不同步 `data.members` | 7/19 |
| B8 | `registerUser` 传 `0` 而非 `_profileSeed` | 7/19 |
| B9 | 物品弹出层 `+=` 累积（重复打开显示垃圾） | 7/19 |
| B10 | `toggleQuestCard` null 解引用 | 7/19 |
| B11 | 种子数据全部清空（app-data/seed-test-data/resetAllData） | 7/19 |
| B12 | iframe → 同窗嵌入（消除 SecurityError 和 postMessage 时序问题） | 7/19 |
| B13 | 死代码删除: `getTask`/`toggleCard`/`toggleSettleExpand`/`saveProfile` | 7/19 |
| B14 | `isTaskOverdue` 无限递归（函数体调自身→栈溢出） | 7/19 |
| B15 | 3处 onClick XSS（用户名注入 selectPubTarget/selectReviewer/pickLoginUser） | 7/19 |
| B16 | 3处 innerHTML XSS（unclaimTask/reviewTask/requestWithdraw 任务名未转义） | 7/19 |
| B17 | `_profileSeed` 值 0 被 `\|\|'demo'` 吞没 | 7/19 |
| A-5 | 村落滑动卡片不居中 — initCarousel() 三处缺容器-卡片宽度差补偿，统一 `_cardLeft(i,pw)` 修复 | 7/23 |
| A-6 | 注册/登录密码框补回小眼睛 — regPwd/loginPwd 各包一层相对容器 + togglePwdEye() | 7/23 |
| A-12 | 社区动态：三区加 desc 说明 + cr-header min-height:44px + hover/active 反馈。点击真因静态未复现（onclick 逻辑/DOM/z-index 均正常），需浏览器验证 | 7/23 |
| C-1 | 密码眼睛加 z-index:1 防止被 block 级 input 遮挡点击（a959faf） | 7/24 |
| C-2 | 滑块提速：移除 CSS scroll-behavior:smooth + 圆点跳转改 behavior:auto（8ecbeb0） | 7/24 |
| C-4 | 数据库迁 Neon Postgres：DATABASE_URL 环境变量 + PRAGMA/T7 方言守卫 + asyncpg + 轮询 30→60s（e583a88） | 7/24 |
| C-6 | ✅ Kimi Code 已修（4d0e714）：camelCase 兼容 + refreshUserUI 即时刷新 | 7/23 |
| C-5 | ✅ Kimi Code 已修（1658adc）：事件委托 + v=5 升版 | 7/23 |
| C-3 | ✅ Kimi Code 已修（ca245ea）：_cardLeft 改 stride 步进 | 7/23 |
| C-7 | ✅ Kimi Code 已修（a29198e）：池 500 初始化 | 7/23 |
