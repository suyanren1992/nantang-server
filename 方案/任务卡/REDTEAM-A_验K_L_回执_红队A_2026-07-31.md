---
created: '2026-07-31'
project: 南塘云村
type: 回执
domain: 前端审查
task_status: 已审查
status: 打回
series: REDTEAM-A
---

# REDTEAM-A 验 K窗+L窗 回执 — 红队 A · 2026-07-31

## 审查范围

| 窗口 | 卡号 | Commit | 文件 | 行数 |
|------|------|--------|------|------|
| K窗 | P1-#6 18端点接入 | dacc6cc | nantang-mobile/js/api.js | +29 |
| K窗 | P1-#6 app接线 | 124677e | nantang-mobile/js/app.js | +143/-11 |
| K窗 | P1-#6 5卡网格 | eb0e490 | nantang-mobile/js/data.js | +33 |
| L窗 | A-ACTIVITY-PAGE | a0c7f4a | ui-activity.js(188) + index.html + main.css | +224 |

---

## 一、18 端点真生效？

### 结论：🔴 13/16 端点是幽灵——BE 路由全部不存在

| 编号 | FE 方法 | 请求路径 | BE 路由存在？ | 实测行为 |
|------|---------|----------|--------------|---------|
| ③ | getPotluckList | GET /api/potluck/list | ❌ 无 | 404→HTML→JSON.parse失败→catch→`{_offline:true}` |
| ④ | joinPotluck | POST /api/potluck/join | ❌ 无 | 同上→fallback localStorage |
| ⑤ | getProposalsList | GET /api/proposals/list | ❌ 无 | 同上 |
| ⑥ | submitProposal | POST /api/proposals/submit | ❌ 无 | 同上→fallback localStorage |
| ⑦ | voteProposal | POST /api/proposals/vote | ❌ 无 | 同上→fallback `_voteLocal` |
| ⑧ | getCampProposalsList | GET /api/camp_proposals/list | ❌ 无 | 同上 |
| ⑨ | getGossipList | Promise.resolve | N/A（前端 stub） | ✅ 冻结 stub 正常 |
| ⑩ | getMarketList | Promise.resolve | N/A | ✅ 同上 |
| ⑪ | getAuctionList | Promise.resolve | N/A | ✅ 同上 |
| ⑫ | getHealthReport | GET /api/health/report | ❌ 无（只有 /api/health） | 同上→UI.ErrorState |
| ⑬ | getNotificationsList | GET /api/notifications/list | ❌ 无 | 同上→inbox 通报区空白 |
| ⑭ | getCleaningPricing | GET /api/cleaning_pricing | ❌ 无 | 死代码（未被任何 UI 调用） |
| ⑮ | getLaborHistory | GET /api/labor/history | ❌ 无（/api/labor 只有 /config） | 同上→"⚠️ 加载失败" |
| ⑯ | getWithdrawHistory | GET /api/nt/withdraw/history | ❌ 无（/api/nt/withdraw 是 POST） | 死代码 |
| ⑰ | getCampsBudget | GET /api/camps/budget | ❌ 无 | 死代码 |
| ⑱ | getCampsSchedule | GET /api/camps/schedule | ❌ 无 | 死代码 |

**根因**：FE api.js 用 `this.request('GET', path)` 发请求→FastAPI 无匹配路由→fallback 到 StaticFiles(html=True)→返回 index.html→`resp.json()` 抛 SyntaxError→catch 返回 `{ok:false, _offline:true}`→调用方全部 fallback 到 localStorage。

**危害**：用户看到「离线模式」提示，数据写 localStorage 但永远不上服务端。表面功能正常，实质数据全在本地黑洞——与改动前完全相同，只是多了 16 个函数和 1 个 catch 链路。

---

## 二、5 卡入口网格真渲染？

### K窗 data.js（renderCommunityHub 内联网格）

| 卡 | 渲染 | onclick | 评价 |
|----|------|---------|------|
| ① 社区活动 | ✅ 2×grid | `_openActivityHub()` | ✅ 正常 |
| ② 共创营队 | ✅ 数量正确 | **无 onclick** | 🔴 死卡——点了无反应 |
| ③ 茶馆八卦 | ✅ 置灰 | 无（正确） | ✅ 冻结态正确 |
| ④ 二手集市 | ✅ 置灰 | 无 | ✅ |
| ⑤ 拍卖会 | ✅ 置灰 | 无 | ✅ |

### L窗 ui-activity.js（overlayActivityHub 独立页）

L窗是**完整实现**：5 卡 + StatusBadge + CSS class（`ah-card`/`ah-card-frozen`）+ 事件委托 + 营地子页 + 活动子页。质量远优于 K窗内联方案。

**但两个网格并存**：K窗 在 `renderCommunityHub()` 里又渲染了一套 5 卡网格（data.js:708-740），与 L窗 `openActivityHub()` 功能重叠。

---

## 三、冻结板块置灰不响应？

### L窗：✅ 通过
- CSS `ah-card-frozen{pointer-events:none}`（main.css:557）
- `opacity:0.45` + `cursor:default`
- 冻结卡不添加 `data-ah-action` 属性 → 事件委托不绑定

### K窗：✅ 通过（功能层面）
- `opacity:.55` + `filter:grayscale(1)` + 虚线边框
- 无 onclick → 点击无反应
- ⚠️ 缺少 `pointer-events:none`（但无 handler 所以实际等效）

---

## 四、4 子入口（接龙/议事/劳动/健康）真调通？

| 子入口 | 调用链 | 结果 | 判定 |
|--------|--------|------|------|
| 🥘 田间接龙 | `_openQuickMenu('接龙')` | 🔴 **函数签名不匹配**——`_openQuickMenu()` 定义在 ui-social.js:371，**无参数**，打开的是营地管理菜单（管理/财务/生活/课程/宣传/结项），不是接龙 | ❌ 错误入口 |
| 🏛️ 议事厅 | `_openCommunityProposals()` → `API.submitProposal()` → 404 → catch → localStorage | ⚠️ 功能可用但数据不上服务端 | ⚠️ 假通 |
| 📝 劳动记录 | `_openLaborHistory()` → `API.getLaborHistory()` → 404 → catch | 🔴 显示 "⚠️ 加载失败" | ❌ 不通 |
| 💚 健康报告 | `_openHealthReport()` → `API.getHealthReport()` → 404 → catch | 🔴 显示 `UI.ErrorState({title:'加载失败'})` | ❌ 不通 |

---

## 五、附加发现

### 🔴 F1: app.js + data.js 缓存版本未更新

| 文件 | 代码已改 | index.html ?v= | 结果 |
|------|---------|----------------|------|
| api.js | dacc6cc 改了 | v29→v30（L窗 a0c7f4a 顺带更了） | ✅ 新代码生效 |
| app.js | 124677e 改了 | **仍是 v53**（L窗之前的值） | 🔴 老用户拿到缓存旧版 |
| data.js | eb0e490 改了 | **仍是 v24**（L窗之前的值） | 🔴 同上 |

K窗三次 commit 只改了 JS 文件没 bump index.html 版本号。L窗 commit (a0c7f4a) 更早在链上，其 index.html 版本值是旧文件的。部署后老用户浏览器缓存命中，K窗所有改动**对用户不可见**。

### 🟡 F2: 8 个 API 方法是死代码

`getPotluckList / getProposalsList / getCampProposalsList / getNotificationsList / getCleaningPricing / getWithdrawHistory / getCampsBudget / getCampsSchedule`——定义在 api.js 但全项目无任何调用方。

### 🟡 F3: K窗/L窗 5 卡网格重复

K窗 data.js:708-740 和 L窗 ui-activity.js:14-73 各自渲染 5 卡入口网格。L窗方案更完整（有子页/CSS class/StatusBadge），K窗方案是简易内联版。两者并存导致用户看到两套入口。

---

## 判案

【判案】红队 A 审查
【仓】`c:\Users\苏砚仁\thinknote\项目\实景游戏移动端代码_new`
【回执】K窗 dacc6cc/124677e/eb0e490 + L窗 a0c7f4a / REDTEAM-A / 2026-07-31
【验证】逐文件读 diff + grep server/routes 全量路由 + 追踪 API.request 异常链路 + 追踪 _openQuickMenu 签名
【结论】**打回 K窗（dacc6cc/124677e/eb0e490）；L窗（a0c7f4a）通过**
【理由】K窗 13/16 端点 BE 不存在→全部 fallback localStorage 数据黑洞 + app.js/data.js 缓存未更新 + 接龙入口调错函数 + 劳动/健康必败显示错误态；L窗冻结卡/子页/CSS 均正确

---

**太傅注：**
FE 接线不等于 BE 就绪——13 个 catch fallback 织成一张「看起来能用」的安全网，实则把所有数据关进 localStorage 的孤岛。
缓存版本号是部署的最后一公里：代码改了但 ?v= 没 bump，等于给老用户发了一封永远收不到的信。
两套入口网格并存是典型的「多窗口不协调」——L窗做了完整方案，K窗又内联一套简易版，最终用户看到两个入口打架。

**建议：K窗三 commit 需回炉——(1) 补 BE 13 路由或降级为全 stub；(2) bump app.js→v54 + data.js→v25；(3) 删 K窗内联网格改用 L窗 overlay；(4) 接龙入口改 _openKitchenQuick 或独立函数。**
