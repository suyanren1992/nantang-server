---
created: '2026-07-31'
project: 南塘云村
type: 盲点报告
domain: 前端审查
task_status: 已交付
status: 讨论中
series: REDTEAM-B
---

# REDTEAM-B 找盲点 · 4 项 UI 根本性 — 回执

## 仓

```
git rev-parse --show-toplevel
```

## 回执

卡号：REDTEAM-B_找盲点_4UI根本性_v0
commit：（提交后填入）

---

## A. 田间管理 — commit a0b7608

### 现象

砚仁报「田间管理没解决」——全貌页/快捷入口点进去看到的是本地假数据，不是后端真实田地。

### 根因（双重断裂）

**断裂 1：修了死函数**

a0b7608 重写的 `_showFieldSheet()` 在 app.js:1708 定义。但实际入口链不走它：

```
全貌页卡 → _openMgmtSheet('field') → openFieldPage() → renderFieldPage() → _renderFieldCards()
快捷入口 → openFieldPage() → renderFieldPage() → _renderFieldCards()
```

`_showFieldSheet()` 的唯一调用点是 `_doFieldAction` 回调里的 `setTimeout`（line 1975），而 `_doFieldAction` 本身也是 a0b7608 新增的——**整条链是自引用的孤岛**。实际渲染走的是另一套函数 `_renderFieldCards()`（line 1627），那套已有 UI.Card 范式且功能完整。

**断裂 2：API 路径缺前缀**

```javascript
// api.js:161
getFields: function() { return this.request('GET', '/fields'); }
// 后端实际路由 prefix = /api/fields
```

`this.request` 不自动加 `/api` 前缀（line 17: `url = this.base ? this.base + path : path`）。`fetch('/fields')` → FastAPI 无此路由 → 返回 index.html（StaticFiles fallback）→ `resp.json()` 解析 HTML 抛异常 → 走 `.catch()` → `_renderFieldCardsLocal()` → **恒显示本地假数据**。

deploy_check 的 API 契约检查也印证：`GET /api/fields` 和 `GET /api/fields/{}` 报 WARN「后端有前端未调」——前端从未真正调过正确路径。

### 盲点类型

**路径盲区**（修了错误函数）+ **数据盲区**（API 路径断裂导致恒走 fallback）

### 建议方向

1. 删除 `_showFieldSheet` / `_renderFieldCardsFromAPI` / `_renderFieldCardsLocal` / `_updateFieldSheetContent` / `_doFieldAction` 五个死函数（a0b7608 全量回退）
2. 修 `api.js:161` 路径 `/fields` → `/api/fields`，同理 `waterFieldPlot`/`fertilizeFieldPlot`/`harvestFieldPlot` 三处（line 163-165）
3. 实际入口 `renderFieldPage()` → `_renderFieldCards()` 已就绪，路径修好后自动走真实数据

---

## B. 校核提示字 — commit 2babdcf

### 现象

砚仁报「校核提示字仍糊，与背景融为一体」——卡片室校核 tab 的空状态提示文字在浅色背景上低对比度。

### 根因

2babdcf 只改了两处**空状态**的容器样式（`ui-cardroom.js:426` 和 `:438`），加了 `class="ui-card"` + `background:var(--g-card)`。

但**文字颜色没改**：
- 第一处：`color:#666`（主提示）+ `color:#999`（副提示 `<span>`）
- 第二处：`color:#aaa`

`--g-card: #fffdf9`（近白）背景上：
- `#666`：对比度 ~5.7:1，勉强达 WCAG AA
- `#999`：对比度 ~2.6:1，**不达 WCAG AA（要求 4.5:1）**
- `#aaa`：对比度 ~1.9:1，严重不足

此外 commit 只改了空状态（"暂无待验证项"/"暂无此类记录"），**有数据时的校核卡片提示文本**（_renderVerifyCard 函数内）完全没动。砚仁看到的大概率是校核操作时的提示文字，而非空状态。

### 盲点类型

**文化盲区**（修的是开发者视角的"空状态美化"，不是用户视角的"操作时提示字看不清"）

### 建议方向

1. 将所有硬编码颜色 `#666`/`#999`/`#aaa` 替换为设计系统 token：`var(--g-text)` / `var(--g-text-dim)` / `var(--g-text-muted)`
2. 排查 `_renderVerifyCard` 函数内的提示文本（非空状态），确认有数据态的对比度也达标

---

## C. 世界终端 — commit 8a15f05

### 现象

砚仁报「世界终端不见」——admin 角色的全貌页看不到 🌍 世界终端入口卡。

### 根因

**8a15f05 根本没有加世界终端。** commit message 是「角色仪表盘——visitor 看入住引导卡」，diff 只改了：
- visitor 入住引导卡（`_renderMgmtCards` 开头的 `if (!isMember)` 分支）
- 快捷入口角色收敛（`_renderQuickEntryCards` 的 `isMember` 三元）

世界终端入口在**更早的 commit** 中已存在于 app.js:406-411：
```javascript
var me = _me();
if (me && (typeof getUsers==='function') && ((getUsers()[me]||{}).role==='admin')) {
    h += '<div class="ic-card world-terminal" ...>🌍 世界终端</div>';
}
```

角色判断是 `role === 'admin'`（严格匹配 admin，不是 `isMember`）。如果砚仁的角色是 `npc`（村民）而非 `admin`，他能看到住宿/田地/厨房卡（`isMember = npc || admin || builder` 为 true），但看不到世界终端。

还有第二条渲染路径（data.js:729）：活动集市页也有世界终端入口，角色变量 `isAdmin` 的定义在该文件内，可能与 app.js 的判断逻辑不一致。

### 盲点类型

**角色盲区**（admin 专属入口与 `isMember` 判断不同层级）+ **数据盲区**（getUsers() 可能没拿到后端同步的 role 字段）

### 建议方向

1. 确认砚仁在数据库中的 `users.role` 字段实际值（`admin` vs `npc` vs 其他）
2. 如果砚仁确实是 admin，排查 `getUsers()[me]` 是否拿到了同步后的用户数据（可能 `_data.users` 未从后端同步 role 字段）
3. 世界终端入口在 `_renderMgmtCards` 末尾（`h += '</div>'` 之前），确认它在 `if (!isMember)` 的 return 之后、不被 visitor 提前 return 截断——代码结构看是在 `isMember` 分支内，所以 admin 能到这行，但 `getUsers()[me].role` 可能不是 `'admin'`

---

## D. 共享厨房 FE — 无 commit（BE 973f855 已就绪）

### 现象

砚仁报「共享厨房没看到」——全貌页/快捷入口没有任何共享厨房（potluck 接龙 / 时段预约 / 物品共享）的入口。

### 根因

**FE 零接入 P3 后端。** 三个维度全部断裂：

**入口断裂**：全貌页的 "🍳 厨房·冰箱" 卡片（app.js:404）调的是 `_openMgmtSheet('kitchen')` → `renderKitchenPanel()`，这是旧的**冰箱储物**面板（放取物品），不是共享厨房（接龙/时段/物品清单）。两条产品线混淆了同一个入口。

**API 断裂**：api.js 中完全没有 `/api/kitchen/*` 的任何端点。只有旧的 P1 接龙（`/api/potluck/list`、`/api/potluck/join`），但 P3 后端是 `/api/kitchen/potluck/*`（不同前缀）。10 个 P3 端点（potluck create/join/list + slots book/release/list + items add/take/list/delete）在 FE 侧一个都没接。

**UI 缺失**：没有 `renderKitchenPage()` / `openKitchenPage()` 函数，没有接龙列表 UI，没有时段预约 UI，没有物品共享 UI。

### 盲点类型

**路径盲区**（入口调了错误的旧面板）+ **数据盲区**（API 零对接）+ **文化盲区**（"厨房·冰箱"和"共享厨房"是两个不同模块，共用了一个入口名造成混淆）

### 建议方向

1. api.js 加 P3 的 10 个端点方法（`getKitchenPotluckList` / `createKitchenPotluck` / `joinKitchenPotluck` / `getKitchenSlots` / `bookKitchenSlot` / `releaseKitchenSlot` / `getKitchenItems` / `addKitchenItem` / `takeKitchenItem` / `deleteKitchenItem`）
2. 新建 `openKitchenPage()` 全屏 overlay（参考 `openFieldPage()` 范式），含三个 tab：接龙 / 时段 / 物品
3. 全貌页新增独立入口卡（🍳 共享厨房），与旧的 "厨房·冰箱" 储物卡区分

---

## 整体盲点类型归类

| 项 | 主要盲区 | 核心问题 |
|----|---------|---------|
| A 田间 | 路径 + 数据 | 修了死函数 + API 路径缺前缀 → 恒走假数据 |
| B 校核 | 文化 | 修了空状态没修操作态 + 文字颜色仍低对比度 |
| C 世界终端 | 角色 + 数据 | commit 没加世界终端 + role 判断可能取不到值 |
| D 共享厨房 | 路径 + 数据 | FE 完全未接入 P3 后端 10 端点 |

## 优先级排序

| 优先级 | 项 | 理由 |
|--------|-----|------|
| P0 | D 共享厨房 | 10 端点零接入，砚仁完全看不到新功能 |
| P0 | A 田间 | API 路径 1 字符修复即可激活，投入产出比最高 |
| P1 | C 世界终端 | 需先确认砚仁 role 实际值，再定修法 |
| P2 | B 校核 | 视觉优化，不影响功能可用性 |

## 结论

4 项盲点的共同特征：**commit 改了，但改的位置和实际渲染路径不对齐**。根因不在代码量多少，而在「改了 A 但用户看到的是 B」。1 营重做时按上述路径逐一修正。
