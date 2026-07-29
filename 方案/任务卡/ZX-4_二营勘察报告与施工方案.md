---
created: '2026-07-29'
project: 南塘云村
type: 勘察报告+施工方案
domain: 档案室内容沉淀
status: 待丞相闸批（第二段施工前）
卡: ZX-4（歼灭战子卡①主攻件）· F12 档案室内容沉淀
施工营: 豆包 Codex（二营，跨端）
阶段: 第一段·勘察（只读零写入）
---
# ZX-4 F12 档案室内容沉淀 · 第一段勘察报告 + 施工方案

> 铁律遵行：只读零写入，逐问 文件:行号 实证，事实/推论分列，未明项单列。
> **⚠️ 关键闸口预警**：第 4 问方案落在「跨用户看他人 ledger/verification 记录」的**读口径**上——按卡面「若需动 ledger/verification 读口径→停笔呈砚仁」，第二段涉此处需砚仁先裁（详见问4末「停笔点」）。

---

## 问1 · 档案室现有 4 Tab 各由什么接口/数据驱动？

Tab 切换总控：`switchArchiveTab`（ui-archive.js:251-263），4 分支：

| Tab | 渲染函数（锚） | 数据源（锚） | 后端接口 | 事实判定 |
|---|---|---|---|---|
| 📂 成员 members | `renderArchiveMembers`（ui-archive.js:265） | `getUsers()` 本地用户表 + `NT.getUser(name)`（余额，:281）；当前用户余额走 `_serverBalance` | 无专用接口，靠 sync 落地的 users | 纯本地渲染 |
| 📜 日志 log | `renderArchiveLog`（ui-archive.js:344） | `AppData._data.activity_log`（:346），由 `logActivity` 写、`API.syncActivity` 同步（:46） | syncActivity（写） | 本地数组，服务端有 activity 同步 |
| 📦 往期营期 periods | `renderArchivePeriods`（**ui-camp.js:1555**，跨文件） | `AppData._data.archived_periods` + `getCamps()` 中 status==='archived'（:1558-1562） | 走 camps sync | 本地聚合 |
| 🃏 卡片记录 cards | `renderArchiveCards`（**index.html:1152**，内联脚本） | `AppData._data.cardDiscoveries`（:1153） | 走 card_discoveries sync（api.js:162/175） | 本地数组 |

**推论**：4 Tab **全是本地 `AppData._data.*` 渲染**，无一个按 user 聚合的「个人记录」视图。渲染函数散落 3 个文件（ui-archive.js / ui-camp.js / index.html 内联），F12「内容沉淀」缺的正是**「点一个人→看他的劳动/校核/住宿沉淀」**这一层。

---

## 问2 · 劳动/校核/住宿记录能否按 user 聚合？缺什么字段/索引？

**结论：三类记录后端表均已带 user 关联列，聚合查询天然可行；缺的是「索引」与「对外聚合接口」，不缺关联字段。**

| 记录类型 | 后端表（锚） | user 关联列 | 现有按-user 查询实证 | 缺什么 |
|---|---|---|---|---|
| 劳动（任务完成） | `NTTask`（models.py:59） | `poster` / `assignee` / `assignees`(JSON) / `settler_id` / `verifier_id`（models.py:60-62,88-89） | data.py:455 / nt.py:101 / tasks.py:68 均按 `poster==uid \| assignee==uid \| assignees LIKE` 过滤 | 无索引（全扫）；无「按 user 聚合完成数/NT」的接口 |
| 校核（verification） | `Verification`（models.py:187） | `doer` / `verifier`（models.py:190,197） | `GET /api/data/verifications`（data.py:187）非 admin 时 `where doer==user.id`（data.py:192） | 无索引；现接口仅返「自己的」或 admin 全量 |
| 住宿（tenancy） | `Tenancy`（models.py:283） | `user_id`(FK users.id, models.py:286) | G-3 `_settle_tenancy` / status 均按 user_id 查 | 无索引；无历史列表接口（仅 active 查询） |
| 资金流水（ledger） | `NTLedger`（models.py:42） | `from_user` / `to_user`（models.py:46-47） | `GET /api/nt/ledger`（nt.py:178）`where from_user==uid \| to_user==uid` | 无索引；接口只查「自己」 |

**事实**：`server/models.py` 全表 **零 `index=True`**（grep 实证空）。当前单社区数据量小（单库 SQLite/单 PG），全表扫描无性能痛点。
**推论**：按 user 聚合**不缺字段**（四表都有 user 列且已有过滤先例）；**缺聚合接口 + 缺索引**（索引在数据涨起来前非必须，可挂账）。

---

## 问3 · 营地/点头像现状行为与改造触点

**现状行为（事实）**：成员 Tab 每行 `onclick` = `showToast('name · role · nt NT','')`（ui-archive.js:301）——**点成员/头像只弹一条 toast**，无任何下钻。头像 `<img>` 用 DiceBear（ui-archive.js:303），无独立点击事件。

**改造触点（文件清单）**：
1. `nantang-mobile/js/ui-archive.js:301` —— member-row 的 `onclick` 从 toast 改为「打开该成员沉淀详情」（主触点）。
2. `nantang-mobile/js/ui-archive.js:265`（renderArchiveMembers）—— 需新增「成员详情面板」渲染函数（劳动/校核/住宿三段）。
3. `nantang-mobile/js/api.js` —— 若走后端聚合，新增 `archiveUserSummary(userId)` 方法（现有 getLedger:118 / verifications 可复用但仅限自己，见问4停笔点）。
4. `nantang-mobile/index.html` —— `?v=` 递增（改哪个 js 升哪个）。
5. （可选）`core.js` 头像组件 `avatarURL`（core.js:1）—— 复用即可，无需改。

**推论**：改造是「把 toast 换成下钻面板 + 一个按-user 聚合数据源」，前端触点集中在 ui-archive.js 一处，爆炸半径小。

---

## 问4 · 沉淀方案 A（聚合查询）vs B（事件落表）—— 推荐 + 理由

### 方案 A：聚合查询（无新表）
新增只读聚合接口 `GET /api/archive/user/{id}`（或前端多次调现有接口拼装），实时 `SELECT ... WHERE user 列` 汇总 NTTask/Verification/Tenancy/NTLedger。

- ✅ 无新表、无迁移、无写路径改动 → **不碰 ledger/verification 写口径**。
- ✅ 数据永远与源表一致（实时查，无双源漂移）。
- ✅ 爆炸半径最小：纯读 + 前端一个面板。
- ⚠ 每次打开面板 4 表查询（无索引全扫）；单社区量级可忽略，数据涨起来加索引即可。

### 方案 B：事件落表（新 `archive_entries` 表）
在 settleTask / createVerification / checkout 等**写路径**插桩，每次事件落一条 archive_entry。

- ✅ 读时单表快、天然时间线。
- 🔴 **必须在结算/校核/退房等写路径插桩** → 紧邻 ledger/pool 钱操作，**触碰涉钱写路径**（禁区邻域）。
- 🔴 **双源一致性风险**：archive_entries 与 ledger 可能漂移（历史已有 `name:t.id` 乱码、状态 key 债等双源前科）。
- 🔴 存量迁移：已发生的历史事件需回填，成本高。
- 🔴 爆炸半径大：动多个写端点 + 新表迁移守卫 + 新测试。

### 🎯 推荐：**方案 A（聚合查询）**
理由三条：
1. **数据量**：单社区，四表行数小，实时聚合无性能痛点；B 的「读快」优势在本项目用不上。
2. **一致性**：A 实时查源表恒一致；B 引入第二份真相源，与本项目「同源收口」主线（P0-1/P1-2 一直在打双源漂移）相悖。
3. **爆炸半径**：A 纯读+前端面板，禁区零风险；B 必插写路径、碰钱操作邻域、需迁移+测试，风险与工期都高一档。

### ⚠️ 停笔点（呈砚仁裁 · 涉账本读口径）
方案 A 有一处**必须砚仁先裁**才能进第二段：
- 现有 `GET /api/nt/ledger`（nt.py:178）与 `GET /api/data/verifications`（data.py:187）**只返「自己的」记录**（非 admin）。F12 要「点**别人**头像看**他的**劳动/校核/住宿沉淀」，等于**要把他人的账本流水/校核记录对非 admin 可见**——这是**读口径 + 隐私口径**变更。
- **两个口径选项供砚仁裁**：
  - **口径①（保守，推荐）**：他人沉淀只展示**非敏感聚合**（完成任务数、校核通过数、住宿天数等**计数/公开事实**），**不展示** NT 金额流水明细/欠费。→ 不动现有 ledger/verification 接口口径，新增接口只吐聚合计数。
  - **口径②（透明）**：他人沉淀含 NT 明细 → 需放宽 ledger/verification 读权限至「社区公开」。**涉账本数据可见性，属砚仁事权**。
- **本卡第二段在砚仁裁定口径前，不动 ledger/verification 任何读权限**。

---

## 未明项（单列不硬猜）
1. F12 卡面原文未在仓内找到（`git ls-files` 无 ZX-4/F12 卡）——本报告依派工单口令四问作答；若卡面有额外验收判据，请补发。
2. 「内容沉淀」是否要求**跨营期历史**（往期营期里的个人贡献）还是仅当前？影响聚合是否含 archived_periods。
3. activity_log 是否也纳入个人沉淀（现为社区级日志，非按 user 严格聚合）。
4. 索引是否本卡加：建议**挂账**（数据量未到瓶颈），非本卡范围。

---
## 第二段施工方案（预案 · 待闸批+砚仁口径裁定后执行）
1. 后端新增只读聚合接口 `GET /api/archive/user/{id}`（按口径①先做非敏感聚合：任务完成数/校核数/住宿天数）——纯读，不改任何现有写/读端点。
2. 前端 ui-archive.js:301 member-row onclick 改开「成员沉淀面板」；新增 renderMemberArchive 函数（劳动/校核/住宿三段）。
3. api.js 新增 archiveUserSummary；index.html `?v=` 递增。
4. pytest 新增聚合接口测试；deploy_check 4/4；禁区 withdraw/confirm/reject 零改动。
5. 回执四件套 + 太傅注。

---
> **太傅注**：①「内容沉淀」＝把散落各表的行为按「人」重新聚合成一条个人档案线，是典型的**读模型（read model）**需求（补课：CQRS 读写分离——读模型可以是实时聚合视图，不必物化成表）。②A vs B 的本质是「实时聚合 vs 物化视图」：数据量小选前者（简单一致），量大且读频高才值得后者（拿一致性风险换读性能）。③最深的坑不在技术在**口径**——「看别人的账」是隐私与治理决策，工程上一行 WHERE 的事，制度上是砚仁的事权，故停笔先请裁。
