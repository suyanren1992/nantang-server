# Bug 追踪

> 2026-07-19 · 多轮审查汇总
> 状态：✅已修复 / 🔧待修 / 📋Step N

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
