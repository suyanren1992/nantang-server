# 手机端 UI 设计方案 — 修正版

> 基于审计反馈修正 · 2026-07-15
> 原版：`手机端UI设计方案.md`
> 审计来源：UX 审计 (ux-designer) + 编程审计 (ui-programmer)

---

## 修正说明

### 核心修正（策略层）

| # | 原版问题 | 修正 |
|---|---------|------|
| 1 | 当成白纸设计，忽略 `mobile-ui.js` (1185行) 的存在 | 明确三层标注：✅保留 / 🔧修改 / 🆕新增 |
| 2 | 声称"渲染代理"复用 `app.js` render 函数（不可行） | 继续现有策略：`M.render*` 函数 + 复用 `app.js` 工具函数 |
| 3 | 新建 `nantang-mobile.html`，未说明与 `mobile.html` 关系 | 明确：**升级现有 `mobile.html`**，不新建入口文件 |
| 4 | Tab 3 村口描述与现有 village map 实现矛盾 | 修正为保留现有实现，方案描述与实际代码一致 |
| 5 | 手风琴互斥折叠不适合信息查阅场景 | 改为独立展开/折叠 |
| 6 | 复杂表单（≥4字段）用 Bottom Sheet + 键盘冲突 | 复杂表单改用 Push 子页面 |

### 保留不变

原版中以下内容**准确且不需修改**，本修正版不再重复全文：
- 设计 Token（§〇 颜色/字号/间距/圆角）— 与 `mobile-game.css` 一致 ✅
- 组件库清单 — 全部 CSS 类在 `mobile-game.css` 中真实存在 ✅
- 数据字段引用 — 除 `labor_records`（待建）外全部在 `schema.js` 中存在 ✅
- 各页面线框图（§三~§九）— 设计本身质量高，仅标注实现归属

---

## 〇、实现策略

### 文件关系（修正）

```
工具/
├── mobile.html               ← 🔧 升级此文件（不改文件名）
├── css/
│   ├── mobile-game.css       ← ✅ 保留不改（684行设计系统足够）
│   └── animate.min.css       ← ✅ 保留（现有依赖）
├── js/
│   ├── data/schema.js        ← ✅ 保留不改
│   ├── data/store.js         ← ✅ 保留不改
│   ├── data/backup.js        ← ✅ 保留不改
│   ├── app.js                ← ✅ 保留不改（只复用其工具函数）
│   └── mobile-ui.js          ← 🔧 核心修改文件
└── sw.js                     ← ✅ 保留（PWA Service Worker）
```

### mobile-ui.js 改造标注

按三层标注，明确每个模块的处理方式：

```
✅ 保留不改：
  M.switchTab()           — Tab 切换逻辑（需适配5→4/5 tab数量）
  M.openSheet()/M.closeSheet()  — Bottom Sheet
  M.openSubPage()/M.closeSubPage() — Push 子页面
  M.showToast()           — Toast
  M.showConfirm()         — Dialog
  M.openProfile()/M.closeProfile()  — Profile Panel（左侧滑出）
  M.openInbox()/M.closeInbox()     — Inbox Panel
  M.initSheetDrag()       — Sheet 下拉关闭
  avatarCircle()          — 头像生成
  calcAvailableBalance()  — NT 计算
  getUserTitle()          — 称号
  formatDate()/formatTime() — 日期格式化
  所有 app.js 工具函数引用

🔧 需修改：
  M.renderVillage()       — 保持现有 village map 实现
  M.renderQuests()        — 增加搜索、筛选 chip 栏
  M.renderCharacter()     — 适配 → Push 子页面（不再作为独立 Tab）
  M.renderCommunity()     — 内容分散到 Tab 4 手风琴
  M.renderMore()          — grid → 手风琴 + 网格混合
  M.switchTab()           — tab 数量参数化
  M.renderTaskDetail()    — 新增 deadline 状态颜色
  HTML 结构               — tab-page div 数量和 ID

🆕 需新增：
  M.renderWorkspace()     — Tab 1 工作台（全新页面）
  M.renderWorkspaceTasks()— 工作台「进行中的任务」列表
  M.toggleAccordion()     — 手风琴展开/折叠（独立模式，不互斥）
  M.expandAccordion()     — 从其他 Tab 跳转并自动展开指定 section
  M.openSubPageStack()    — 子页面导航栈（支持二级 Push）
  M.renderBudgetMobile()  — 账本展开区
  M.renderMembersMobile() — 成员档案展开区
  M.renderLeaderboardMobile() — 排行榜展开区
  M.renderSettlementMobile()  — 通关结算展开区
  M.renderTreasuryMobile()    — 大家的东西展开区
  M.renderCampManageMobile()  — 营地管理展开区
  M.renderArchiveMobile()     — 档案室展开区
  M.renderCanteenSubPage()    — 素社食堂（Push 子页面）
  M.renderInnSubPage()        — 客栈（Push 子页面）
  M.renderTeahouseSubPage()   — 茶馆（Push 子页面）
  M.renderBoardgameSubPage()  — 桌游室（Push 子页面）
  M.renderAuctionSubPage()    — 白菜拍卖行（Push 子页面）
  M.renderCouncilSubPage()    — 萝卜议事厅（Push 子页面）
  M.renderMapSubPage()        — 实景地图（Push 子页面）
  M.renderArchiveVillageSubPage() — 云村档案室（Push 子页面）

预估增量：
  mobile-ui.js: 1185行 → ~2000行 (+815行)
  mobile-game.css: 694行 → ~850行 (+156行 补充)
  mobile.html: 少量 HTML 结构调整
```

---

## 一、交互模型（修正）

### Tab 结构决策：5 Tab

保留现有 5 Tab 结构，调整内容和顺序：

| # | 现有 | 修正后 | 变更 |
|---|------|--------|------|
| 0 | 🏠 村口 | 🏠 村口 | 🔧 保持现有 village map 实现 |
| 1 | 📋 任务 | 🏠 工作台 | 🆕 全新页面（聚合视图） |
| 2 | ⚔️ 角色 | 📋 任务 | 🔧 增加搜索和筛选 |
| 3 | 👥 社群 | 👤 我的 | 🔧 从原角色页改造 |
| 4 | ☰ 更多 | ☰ 更多 | 🔧 grid → 手风琴+网格混合 |

**决策理由**：
- 原版 4 Tab 方案将角色信息藏在 Tab 4 手风琴中——这是高频访问内容，应有独立 Tab
- 工作台是新增的聚合视图，替代原来村口作为 landing page 后的空白
- 社群内容（成员、排行）移入 Tab 4 手风琴（中低频），通过工作台快捷入口可达

### Tab 2「我的」vs 原版不同

原版将角色信息移到顶栏头像触发的 Push 子页面。修正版保留为独立 Tab：

```
顶栏头像点击 → Profile Panel（左侧滑出，quick access）
Tab 2「我的」→ 完整个人中心（角色信息 + 统计 + 设置 + 退出）
```

两个入口互补：顶栏是快捷版，Tab 2 是完整版。

### 手势规范（原版 §一 保留，补充）

原版手势表完整 ✅。补充：

| 手势 | 区域 | 修正 |
|------|------|------|
| 左右滑动 | 标签 chip 栏 | 新增：`overscroll-behavior-x: contain` 防止触发 iOS 左滑返回 |
| 长按 | 茶馆帖子(自己) | 保留。补充：删除前弹出 Dialog 确认 |

### 页面层级（修正）

```
Tab 根页面
  ├─ [Push →] 全屏子页面（最多2级）
  │    └─ [Push →] 二级子页面（如：成员档案→成员详情）
  │         └─ 不再深入（第三级用 Bottom Sheet 替代）
  └─ [Sheet ↑] 底部浮层（仅简单操作：确认/选择/1-3字段表单）
       └─ 复杂表单（≥4字段）→ Push 子页面
```

**修正理由**：现有 `#subPage` 没有导航栈。实现二级 Push 的栈即可满足所有需求，第三级用 Sheet 替代。

---

## 二、全局 App Shell（原版 §二，修正标注）

原版 App Shell 线框图保留。标注变更：

```
✅ 保留：
  Top Bar (48px) — 结构不变
  Bottom Nav (56px) — 改为 5 Tab
  avatar-slot / nt-badge / inbox-btn — 全部保留

🔧 修改：
  Bottom Nav Tab 数量和标签：
    现有: 🏠村口 / 📋任务 / ⚔️角色 / 👥社群 / ☰更多
    改为: 🏠村口 / 🏠工作台 / 📋任务 / 👤我的 / ☰更多
```

---

## 三、Tab 页面（标注每页的实现归属）

以下各节对应原版 §三~§九，标注每个模块的实现归属（✅保留 / 🔧修改 / 🆕新增）。

### Tab 0：🏠 村口

**保留现有实现**。不是原版描述的"三页滑动卡片"。

```
现有 mobile-ui.js M.renderVillage() 包含：
  ✅ 交互式村庄地图 (.village-map)
  ✅ 建筑定位 + 点击交互
  ✅ NPC 对话气泡
  ✅ 时间徽章
  ✅ 统计卡片
```

### Tab 1：🏠 工作台（🆕 全新）

原版 §三 的线框图保留。实现标注：

```
🆕 M.renderWorkspace():
  ① 状态总览卡 — 🆕 但复用 .g-card + .res-bar + .stat-tile
  ② 快捷操作 2x2 Grid — 🆕 复用 .g-card
     - 接任务 → M.switchTab(2)
     - 提交任务 → 筛选待提交 + M.openSheet('submit')
     - 账本 → M.switchTab(4) + M.expandAccordion('budget')
     - 伙伴 → M.switchTab(4) + M.expandAccordion('members')
  ③ 进行中的任务 — 🆕 M.renderWorkspaceTasks()
     复用 .quest-card 组件，数据来源：data.tasks 过滤用户已领取的

🆕 expandAccordion():
  从其他 Tab 跳转到 Tab 4 并自动展开指定手风琴 section
  实现：switchTab(4) → 等待 DOM 渲染 → toggleAccordion(sectionId, true)
```

### Tab 2：📋 任务（🔧 修改现有）

原版 §四 的线框图保留。实现标注：

```
🔧 M.renderQuests() 修改：
  ✅ NPC 对话气泡 — 保留
  🆕 搜索框 — 新增
  🔧 seg-control chip 栏 — 现有 .seg-control 改为横向滑动 chip 栏
  ✅ quest-card 列表 — 保留组件，增加 deadline 状态色
  ✅ FAB 发布委托 — 保留

🔧 发布委托：原版是 Bottom Sheet (65vh, 8+字段)
  → 改为 Push 子页面（字段太多，键盘会覆盖浮层）

🔧 提交任务：原版是 Bottom Sheet (65vh, 4字段)
  → 保持 Bottom Sheet（字段少，键盘不会覆盖）
```

### Tab 3：👤 我的（🔧 从现有角色页改造）

原版 §3.2（角色信息 Push 子页面）→ 改为独立 Tab 页 + 保留顶栏 Profile Panel。

```
🔧 M.renderCharacter() 改造：
  ✅ char-header（头像+名字+称号+NT余额）
  ✅ stats-row（营队NT/个人NT/冻结）
  🔧 char-menu — 菜单项调整：
     - 📋 我的任务 → Push 子页面
     - 💰 我的流水 → Push 子页面（复用 .tx-item）
     - 🎒 我的物品 → Push 子页面
     - ⚙️ 设置 → Push 子页面
     - 🚪 退出登录（底部，红色）

✅ 顶栏头像 → M.openProfile()（Profile Panel，保留）
  Profile Panel 作为快捷入口，显示精简信息
```

### Tab 4：☰ 更多（🔧 从 grid 改为手风琴+网格混合）

原版 §六 的线框图保留。实现标注：

```
🔧 手风琴改为独立展开模式（不互斥）：
  原版问题：点击一个自动折叠其他 → 无法跨区参考
  修正：每个 section 独立 toggle，可同时展开多个

🆕 M.toggleAccordion(sectionId):
  - 箭头 ▸ ↔ ▾（rotate 90°, 250ms）
  - 内容区 max-height 过渡（300ms ease）
  - 震动反馈 8ms
  - 尊重 prefers-reduced-motion：匹配时跳过动画

手风琴内容归属：
  💰 大家的账本    → 🆕 M.renderBudgetMobile()
  📅 时间线        → 🆕 复用现有 timeline 组件
  👥 成员档案      → 🆕 M.renderMembersMobile()
  🏆 排行榜        → 🆕 M.renderLeaderboardMobile()
  🧾 通关结算      → 🆕 M.renderSettlementMobile()
  📦 大家的东西    → 🆕 M.renderTreasuryMobile()
  🏕️ 营地管理      → 🆕 M.renderCampManageMobile()
  📚 档案室        → 🆕 M.renderArchiveMobile()
  🌍 创营向导      → ✅ 保留（现有实现已是子页面）
  ⚙️ 设置          → 🔧 Push 子页面（从 Profile Panel 拆出独立设置页）

云村网格（✅ 保留，复用 .more-grid + .more-tile）：
  9 个网格卡片 → 点击 Push 到对应子页面
  
  注意：「档案室」出现两次：
  - 手风琴 📚 档案室 → 社区档案/记录
  - 网格 📚 档案室 → 云村档案/成员档案
  → 重命名：手风琴「📚 社区档案」 / 网格「📚 云村档案」
```

---

## 四、底部浮层汇总（修正）

原版 §九 列出 14 个浮层。修正后：

| 浮层 | 高度 | 修正 |
|------|------|------|
| 提交任务 | 65vh | ✅ 保持 Bottom Sheet（3-4字段） |
| 发布委托 | — | 🔧 **改为 Push 子页面**（8+字段，键盘冲突） |
| 发布营队任务 | — | 🔧 **改为 Push 子页面**（同上） |
| 确认购买 | 40vh | ✅ 保持 Bottom Sheet |
| 结算确认 | 40vh | ✅ 保持 Bottom Sheet |
| 充值 NT | 65vh | 🔧 **改为 Push 子页面** |
| 提现 NT | 65vh | 🔧 **改为 Push 子页面** |
| 添加/编辑物品 | 65vh | 🔧 **改为 Push 子页面** |
| 预订客栈 | 40vh | ✅ 保持 Bottom Sheet |
| 预订食堂 | 40vh | ✅ 保持 Bottom Sheet |
| 付钱确认 | 40vh | ✅ 保持 Bottom Sheet |
| 创建游戏 | 50vh | 🔧 **改为 Push 子页面**（5+字段） |
| 创建拍卖 | 65vh | 🔧 **改为 Push 子页面**（6+字段） |
| 创建会议 | 65vh | 🔧 **改为 Push 子页面**（5+字段） |

**原则**：表单字段 ≥ 4 个 → Push 子页面。≤ 3 个 → Bottom Sheet。

---

## 五、子页面汇总（修正）

### Push 子页面（全屏，slide-in-right）

| 子页面 | 级别 | 实现归属 |
|--------|------|---------|
| 任务详情 | 1 级 | 🔧 M.renderTaskDetail() |
| 成员详情 | 2 级（从手风琴成员列表进入） | 🆕 |
| 发布委托 | 1 级（从 FAB 进入） | 🆕（从 Sheet 升级） |
| 发布营队任务 | 1 级 | 🆕（从 Sheet 升级） |
| 充值/提现 | 1 级 | 🆕（从 Sheet 升级） |
| 添加物品 | 1 级 | 🆕（从 Sheet 升级） |
| 我的任务 | 1 级（从 Tab 3 进入） | 🔧 |
| 我的流水 | 1 级（从 Tab 3 进入） | 🔧 |
| 我的物品 | 1 级（从 Tab 3 进入） | 🔧 |
| 设置 | 1 级 | 🔧 独立设置页 |
| 🏪 集市 | 1 级（从云村网格进入） | 🆕 |
| 🥬 素社食堂 | 1 级 | 🆕 |
| 🏨 客栈 | 1 级 | 🆕 |
| 🍵 茶馆 | 1 级 | 🆕 |
| 🎲 桌游室 | 1 级 | 🆕 |
| 🔨 白菜拍卖行 | 1 级 | 🆕 |
| 🥕 萝卜议事厅 | 1 级 | 🆕 |
| 📚 云村档案室 | 1 级 | 🆕 |
| 🧭 实景地图 | 1 级 | 🆕 |

### 导航栈实现

```js
// mobile-ui.js 新增
M._subPageStack = [];
M.openSubPage(renderFn, title) {
  M._subPageStack.push({ renderFn, title });
  M._renderSubPage();
}
M.closeSubPage() {
  M._subPageStack.pop();
  if (M._subPageStack.length === 0) {
    // 关闭子页面，返回 Tab
    document.getElementById('subPage').classList.remove('show');
  } else {
    M._renderSubPage();
  }
}
```

---

## 六、数据层补充

### labor_records（🆕 待建）

方案中多处引用 `data.labor_records[]`。如不需要独立表，可复用 `data.activity_log[]` + `data.finance[]`。如需要独立表，在 `schema.js` 的 `defaultData()` 中添加：

```js
labor_records: [
  // { person, date, type, space, description, nt_earned, status }
]
```

---

## 七、可访问性（修正）

原版缺失的部分：

| 问题 | 修正 |
|------|------|
| Quest card 类型仅用颜色区分 | 🆕 每种类型加图标前缀：📍在地 / 📅日程 / 👥多人 / 🧑单人 / 🏕️营队 |
| 状态灯无文字标签 | 🆕 每个状态灯旁加文字：🟢 正常 / 🟡 待处理 / 🔴 紧急 |
| 手风琴动画无障碍 | 🆕 `prefers-reduced-motion` 时跳过动画，直接切换 |
| 震动反馈无障碍 | 🆕 检查 `prefers-reduced-motion`，匹配时禁用 |
| `.nav-label` 字号 .6rem (9.6px) | 🔧 改为 `--g-xs` (0.625rem = 10px) |
| 色彩对比度 | ✅ `mobile-game.css` 中主文字 #2d2416 对 #fffdf7 背景对比度 12.5:1（AAA级） |

---

## 八、离线/弱网（修正补充）

原版未覆盖。最低方案（P0 设计预留，P2 实现）：

```
P0 设计预留：
  - 用户自己的任务列表 → localStorage 缓存
  - NT 余额 → localStorage 缓存（store.js 已有）
  - 离线标识：Top Bar 下方 2px 黄色横条 + "📡 离线" 文字

P2 实现：
  - 写操作队列化（发布委托、提交任务）
  - 恢复连接后自动同步
```

---

## 九、实施顺序

| 阶段 | 任务 | 预估 |
|------|------|:--:|
| 1 | `mobile.html` 调整 Tab 结构（5→5，但内容重排） | 1h |
| 2 | `mobile-ui.js` 新增手风琴系统 + `expandAccordion()` | 2h |
| 3 | 🆕 `M.renderWorkspace()` 工作台 | 3h |
| 4 | 🔧 `M.renderMore()` 手风琴化 | 3h |
| 5 | 🔧 `M.renderCharacter()` → Tab 3「我的」 | 2h |
| 6 | 🆕 云村子页面 ×9（集市/食堂/客栈/茶馆/桌游/拍卖/议事/地图/档案） | 6h |
| 7 | 🆕 Push 子页面升级（发布委托/充值/提现/添加物品/创建游戏等） | 3h |
| 8 | 🔧 复杂表单 Sheet → Push 迁移 | 2h |
| 9 | `mobile-game.css` 补充样式 | 2h |
| 10 | `schema.js` 补充 `labor_records`（如需要） | 0.5h |
| 11 | 可访问性修正（颜色+图标、字号、reduced-motion） | 1h |
| **合计** | | **~25.5h** |

---

## 十、与现有代码的兼容性确认

| 现有文件 | 是否修改 | 修改范围 |
|---------|:--:|------|
| `mobile.html` | 🔧 | Tab page div 调整、新增 HTML 结构 |
| `css/mobile-game.css` | 🔧 | +156 行补充样式 |
| `css/animate.min.css` | ✅ | 不改 |
| `js/app.js` | ✅ | 不改（只复用工具函数） |
| `js/mobile-ui.js` | 🔧 | +815 行增量 |
| `js/data/schema.js` | 🔧 | +labor_records（如需要） |
| `js/data/store.js` | ✅ | 不改 |
| `js/data/backup.js` | ✅ | 不改 |
| `sw.js` | ✅ | 不改 |

---

*修正版 v1 · 2026-07-15 · 基于 UX 审计 + 编程审计*