# 田间管理 & 厨房食物管理 UI 设计方案

> 版本 1.0 | 2026-07-20
> 对齐现有设计系统（CSS Token、Overlay 模式、AppData 持久化）

---

## 0. 通用设计原则

### 0.1 触控友好

- 所有操作按钮使用 `.btn-sm`（min-height: 44px，min-width via padding: 10px 16px）
- 列表项可点击区域不低于 44px 高度
- 左滑/右滑不冲突（无横向滑动容器与按钮重叠）

### 0.2 对齐现有模式

| 现有模式 | 本方案对应 |
|----------|-----------|
| `overlayCanteen` 日期箭头 | 田地种植日期选择、厨房入库日期 |
| `canteen-card` 卡片 | 田地状态卡片、库存食物卡片 |
| `.my-fchip` 筛选 Chip | 厨房分类筛选、田间状态筛选 |
| `.section-head` 可折叠区域 | 田地按区域分组折叠 |
| `.btn-sm.pri/.sec/.warn/.danger` | 快速操作按钮 |
| `inn-sheet` Sheet 模式 | 添加种植表单、添加/消耗食物表单 |
| `showToast(msg, type)` | 所有操作反馈 |
| `AppData._saveShared()` | 两个模块的持久化 |

### 0.3 入口位置

两个模块均从营地主页（`overlayCampHome`）的快捷网格 (`quick-grid`) 进入，与食堂/客栈平级：

```
quick-grid:
  [田间管理]  [厨房]
  [食堂]      [客栈]
```

或通过 `camp-nav-card` 列表进入。具体入口位置由父页面布局决定，本文档只定义 overlay 内部交互。

---

## 1. 田间管理

### 1.1 信息架构

```
overlayFarm
  ├── 顶部：日期切换 + 添加按钮
  ├── 汇总栏：待办数量（需除草 N · 需施肥 N · 待采摘 N）
  ├── 区域A 折叠组
  │   ├── 田地1 卡片（作物名 / 状态进度条 / 倒计时 / 操作按钮）
  │   └── 田地2 卡片
  ├── 区域B 折叠组
  │   └── ...
  └── 操作日志（最近20条，可折叠）
```

**数据流：**
```
AppData._data.farm_plantings  ──→  renderFarm()
AppData._data.farm_logs       ──→  renderFarmLogs()
用户操作（除草/施肥/采摘/堆肥）──→  更新 planting + 写 log ──→ saveShared + toast
```

### 1.2 主界面布局

```
┌──────────────────────────────────────┐
│ ←  田间管理                     ＋ 添加 │  ← overlay-top
├──────────────────────────────────────┤
│  ◀ 07-20 (今天) ▶                    │  ← canteen-date-row 风格
├──────────────────────────────────────┤
│  🌱 待除草 2  ·  💧 待施肥 1  ·  ✂️ 待采摘 3  │  ← 汇总栏（行内三指标）
├──────────────────────────────────────┤
│  ▾ 菜地A区 (3块)                      │  ← section-head 折叠
│  ┌────────────────────────────────┐  │
│  │ 🥬 小白菜  ▓▓▓▓▓▓▓░░░ 65%    │  │  ← 状态卡片
│  │    品种：上海青                │  │
│  │    种下：07-10 (10天前)       │  │
│  │    ⏰ 预计5天后成熟            │  │
│  │    [🌿除草(2天后)] [💧施肥]   │  │  ← 快速操作按钮
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ 🍅 番茄   ▓▓▓▓▓▓▓▓▓▓ 100%   │  │
│  │    品种：樱桃番茄              │  │
│  │    种下：06-20 (30天前)       │  │
│  │    ✅ 已成熟，可采摘！         │  │
│  │    [✂️采摘]                    │  │
│  └────────────────────────────────┘  │
│  ...                                 │
│  ▸ 菜地B区 (1块)                      │  ← 折叠状态
├──────────────────────────────────────┤
│  📜 操作日志                         │  ← 可折叠区域
│  07-19 砚仁 在 菜地A区 采摘了 小白菜  │
│  07-17 淑惠 在 菜地A区 给 番茄 除草  │
└──────────────────────────────────────┘
```

### 1.3 关键交互流程

#### 1.3.1 添加种植记录

```
[＋ 添加] 点击
  → 打开 farmPlantSheet (bottom sheet)
  → 表单字段：
      - 区域选择 (select: 菜地A区 / 菜地B区 / ... )
      - 田地编号 (text input, 如 "A-3")
      - 农作物名称 (text input)
      - 品种 (text input, 选填)
      - 种植日期 (date input, 默认今天)
      - 预计成熟天数 (number input, 默认 30)
      - 除草间隔/天 (number input, 默认 7)
      - 施肥间隔/天 (number input, 默认 14)
  → [保存] → 写入 AppData._data.farm_plantings
           → 写入 farm_logs (type: planted)
           → close sheet + showToast('已添加种植记录', 'ok')
           → renderFarm()
  → [取消] → close sheet
```

**Sheet 复用现有 `inn-sheet` 样式**，表单字段复用 `.pub-field` 布局。

#### 1.3.2 日常管理（除草/施肥）

```
点击卡片上的 [🌿除草] 或 [💧施肥]
  → 确认 Toast（或直接执行，看用户偏好）
  → 更新 planting.last_weeded = today 或 planting.last_fertilized = today
  → 写入 farm_logs (type: weeded / fertilized)
  → showToast('已记录除草', 'ok')
  → renderFarm() 更新按钮状态
```

**按钮状态规则：**
- 距离上次操作 < 间隔天数 → 按钮灰色 `.btn-sm.sec`，显示倒计时 "(3天后)"
- 距离上次操作 >= 间隔天数 → 按钮高亮 `.btn-sm.warn`，显示 "现在"
- 如果处于「已收获」或「已堆肥」状态 → 按钮隐藏

#### 1.3.3 采摘/收获

```
点击 [✂️采摘]
  → 弹出确认 Sheet（收获信息确认）
  → 更新 planting.status = 'harvested'
  → planting.harvested_at = today
  → 写入 farm_logs (type: harvested)
  → showToast('已收获！', 'ok')
  → renderFarm()
```

采摘后，卡片变为「已收获」状态，显示"⚫ 已收获，可堆肥"，操作按钮只剩 [🔄堆肥]。

#### 1.3.4 堆肥

```
点击 [🔄堆肥]
  → 弹出确认
  → 更新 planting.status = 'composted'
  → planting.composted_at = today
  → 写入 farm_logs (type: composted)
  → showToast('已堆肥，回归土地', 'ok')
  → renderFarm() — 卡片变为低透明度，折叠到"已完成"分组
```

#### 1.3.5 提醒逻辑（被动+主动）

**被动提醒（卡片本身）：**
- 卡片进度条颜色随状态变化
- 接近成熟时文字变为强调色

**主动提醒（汇总栏 + Badge）：**
- `renderFarm()` 每次渲染时计算待办事项
- 汇总栏显示三个数字：需除草数 / 需施肥数 / 待采摘数
- 入口按钮上可显示 Badge（与 `spc-badge` 同一模式）

### 1.4 数据模型

```js
// ══ 种植记录 — 共享数据 ══
AppData._data.farm_plantings = {
  "planting_abc123": {
    id: "planting_abc123",          // 唯一ID (planting_ + 随机)
    region: "菜地A区",              // 区域名称
    plot: "A-1",                    // 田地编号
    crop_name: "小白菜",            // 农作物名称
    variety: "上海青",              // 品种（选填）
    planted_date: "2026-07-10",     // 种植日期 (YYYY-MM-DD)
    maturity_days: 20,              // 预计成熟天数
    weed_interval: 7,               // 除草间隔（天）
    fertilize_interval: 14,         // 施肥间隔（天）
    status: "growing",              // just_planted | growing | ready_harvest | harvested | composted
    created_at: "2026-07-10T08:00:00Z",
    created_by: "砚仁",
    // 动态更新的字段：
    last_weeded: "2026-07-15",      // 上次除草日期（null=从未）
    last_fertilized: "2026-07-10",  // 上次施肥日期（null=从未）
    harvested_at: null,             // 收获日期
    composted_at: null              // 堆肥日期
  }
  // ... more plantings
};

// ══ 操作日志 — 共享数据 ══
AppData._data.farm_logs = [
  {
    id: "log_xyz",
    planting_id: "planting_abc123",
    type: "weeded",                 // planted | weeded | fertilized | harvested | composted
    user: "砚仁",
    time: "2026-07-15T09:30:00Z",
    note: ""                        // 选填备注
  }
  // ...
];

// ponytail: 日志只保留最近100条，超过的在 renderFarmLogs 中截断。
// 如需完整历史，后续可追加归档到 archive_logs。
```

### 1.5 状态与提醒规则

```js
// 状态判定（每次 renderFarm 时实时计算）
function getPlantingState(p) {
  var todayStr = today();
  var planted = new Date(p.planted_date + 'T00:00:00');
  var mature = new Date(p.planted_date + 'T00:00:00');
  mature.setDate(mature.getDate() + p.maturity_days);

  if (p.status === 'composted') return 'composted';
  if (p.status === 'harvested') return 'harvested';
  if (todayStr >= mature.toISOString().slice(0,10)) return 'ready_harvest';
  if (todayStr === p.planted_date) return 'just_planted';
  return 'growing';
}

// 提醒判定
function getPendingActions(p) {
  var todayStr = today();
  var r = { need_weed: false, need_fertilize: false, need_harvest: false };
  if (p.status === 'composted') return r;
  if (p.status === 'harvested') { r.need_compost = true; return r; }

  var state = getPlantingState(p);
  if (state === 'ready_harvest') { r.need_harvest = true; return r; }

  // 计算除草是否到期
  if (p.weed_interval > 0) {
    var lastW = p.last_weeded || p.planted_date;
    var nextW = new Date(lastW + 'T00:00:00');
    nextW.setDate(nextW.getDate() + p.weed_interval);
    if (todayStr >= nextW.toISOString().slice(0,10)) r.need_weed = true;
  }
  // 计算施肥是否到期
  if (p.fertilize_interval > 0) {
    var lastF = p.last_fertilized || p.planted_date;
    var nextF = new Date(lastF + 'T00:00:00');
    nextF.setDate(nextF.getDate() + p.fertilize_interval);
    if (todayStr >= nextF.toISOString().slice(0,10)) r.need_fertilize = true;
  }
  return r;
}
```

**卡片颜色映射：**

| 状态 | 进度条颜色 | 文字提示 | 操作按钮 |
|------|----------|---------|---------|
| just_planted | `--green-pale` #a0c8a8 | "🌱 刚种下" | 无（首日免操作） |
| growing (normal) | `--green-primary` #3d6b52 | "⏰ X天后成熟" | 除草/施肥（按需） |
| growing (weed due) | `--amber` #c8892e | "需除草" | [🌿除草 now] [💧施肥] |
| growing (fert due) | `--amber` #c8892e | "需施肥" | [🌿除草] [💧施肥 now] |
| ready_harvest | `--gold` #c88740 | "✅ 可采摘！" | [✂️采摘] |
| harvested | `--text-muted` #8a8a8a | "⚫ 已收获" | [🔄堆肥] |
| composted | `--text-muted` 低透明度 | "🔄 已堆肥" | 无 |

### 1.6 需要的 Overlay / Sheet 组件清单

| 组件 | 用途 | 复用模式 |
|------|------|---------|
| `#overlayFarm` | 田间管理主页 | `.overlay` 标准结构 |
| `#farmPlantSheet` | 添加/编辑种植记录 | `.inn-sheet` bottom sheet 模式 |
| `#farmConfirmSheet` | 采摘/堆肥确认 | `.inn-sheet` 简化版 |
| `#farmRegionInput` | 新区域名称输入 | inline `.login-input` + 确认按钮 |

---

## 2. 厨房食物管理

### 2.1 信息架构

```
overlayKitchen
  ├── 顶部：标题 + 添加按钮
  ├── 汇总栏：库存总数 / 临期数 / 过期数
  ├── 分类筛选 Chip 行（全部/蔬菜/肉类/调料/干货/冷冻）
  ├── 食物卡片列表
  │   ├── 每张卡片：名称 / 分类 / 数量 / 入库日期 / 保质期倒计时 / 消耗按钮
  │   └── 颜色标记：绿（新鲜）→ 黄（临期）→ 红（过期）
  ├── 添加食物 Sheet (bottom sheet)
  └── 消耗记录（最近20条，可折叠）
```

**数据流：**
```
AppData._data.kitchen_items   ──→  renderKitchen()
AppData._data.kitchen_logs   ──→  renderKitchenLogs()
用户操作（入库/消耗）        ──→  更新 items + 写 log ──→ saveShared + toast
```

### 2.2 主界面布局

```
┌──────────────────────────────────────┐
│ ←  厨房                       ＋ 添加 │  ← overlay-top
├──────────────────────────────────────┤
│  📦 库存 12 件  ·  ⚠️ 临期 3  ·  ❌ 过期 1 │  ← 汇总栏
├──────────────────────────────────────┤
│  [全部] [🥬蔬菜] [🥩肉类] [🧂调料] [📦干货] [❄️冷冻] │  ← 分类 Chip
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ 🥬 小白菜          2 把       │  │  ← 食物卡片
│  │    入库：07-15                │  │
│  │    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 85%    │  │  ← 保质期进度条（绿色=新鲜）
│  │    ⏰ 最佳食用期还剩 5 天       │  │
│  │    [−消耗]                      │  │  ← 操作按钮
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ 🥩 猪肉            500g       │  │
│  │    入库：07-10                │  │
│  │    ▓▓▓▓▓▓▓░░░░░░░ 55%    ⚠️ │  │  ← 黄色=临期
│  │    ⚠️ 还剩 3 天，尽快使用     │  │
│  │    [−消耗]                      │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ ❌ 豆腐            1 盒       │  │  ← 过期卡片（低透明度/灰色）
│  │    入库：07-01                │  │
│  │    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 0% ❌  │  │
│  │    ❌ 已过期 5 天              │  │
│  │    [🗑丢弃]                     │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  📜 消耗记录                         │  ← 可折叠
│  07-19 砚仁 使用了 小白菜 ×1把      │
│  07-18 淑惠 添加了 鸡蛋 ×10个       │
└──────────────────────────────────────┘
```

### 2.3 关键交互流程

#### 2.3.1 添加食物（入库）

```
[＋ 添加] 点击
  → 打开 kitchenAddSheet
  → 表单字段：
      - 食物名称 (text input, required)
      - 分类 (select: 蔬菜/肉类/调料/干货/冷冻)
      - 数量 (number input)
      - 单位 (select/text: 把/斤/g/个/盒/瓶/包)
      - 入库日期 (date, 默认今天)
      - 保质期天数 (number, 默认7天)
  → [保存] → 写入 AppData._data.kitchen_items
           → 写入 kitchen_logs (type: added)
           → close sheet + showToast('已入库', 'ok')
           → renderKitchen()
```

#### 2.3.2 消耗食物

```
点击卡片上的 [−消耗]
  → 打开 kitchenConsumeSheet
  → 显示：食物名称 + 当前库存 + 消耗数量输入
  → 表单字段：
      - 消耗数量 (number, 默认1)
      - 用途备注 (text, 选填，如 "午餐炒菜")
      - 关联菜单 (select, 选填，列出当日食堂菜单项)
  → [确认消耗] → 更新 item.quantity -= 消耗量
               → 如果 quantity <= 0，标记 item.depleted = true
               → 写入 kitchen_logs (type: consumed)
               → showToast('已记录消耗', 'ok')
               → renderKitchen()
```

#### 2.3.3 丢弃过期食物

```
点击过期卡片上的 [🗑丢弃]
  → 确认 Toast（或直接）
  → 更新 item.depleted = true
  → 写入 kitchen_logs (type: discarded)
  → showToast('已丢弃', 'ok')
  → renderKitchen()
```

### 2.4 数据模型

```js
// ══ 厨房库存 — 共享数据 ══
AppData._data.kitchen_items = {
  "item_abc123": {
    id: "item_abc123",              // 唯一ID (item_ + 随机)
    name: "小白菜",                 // 食物名称
    category: "蔬菜",               // 蔬菜 | 肉类 | 调料 | 干货 | 冷冻
    quantity: 2,                    // 剩余数量
    unit: "把",                     // 单位
    in_date: "2026-07-15",          // 入库日期 (YYYY-MM-DD)
    expiry_days: 7,                 // 保质期天数（从入库日算起）
    best_before: "2026-07-22",      // 最佳食用日期 = in_date + expiry_days
    depleted: false,                // 是否已用完/丢弃
    created_by: "砚仁",
    created_at: "2026-07-15T10:00:00Z"
  }
  // ...
};

// ══ 厨房操作日志 — 共享数据 ══
AppData._data.kitchen_logs = [
  {
    id: "klog_xyz",
    item_id: "item_abc123",
    type: "consumed",               // added | consumed | discarded
    user: "砚仁",
    time: "2026-07-19T12:00:00Z",
    quantity: 1,                    // 消耗/添加数量
    note: "午餐炒菜",              // 选填备注
    linked_menu: ""                 // 关联菜单项ID（选填）
  }
  // ...
];

// ponytail: 日志只保留最近100条。items 中 depleted=true 的记录保留30天后自动清理。
```

### 2.5 临期/过期规则

```js
// 每次 renderKitchen 时实时计算
function getExpiryState(item) {
  if (item.depleted) return 'depleted';

  var todayStr = today();
  var bestBefore = item.best_before || item.in_date; // 兜底
  var daysLeft = daysBetween(todayStr, bestBefore);  // 正数=未到期，负数=已过期

  if (daysLeft < 0) {
    // 已过期
    return { level: 'expired', days: Math.abs(daysLeft), label: '已过期 ' + Math.abs(daysLeft) + ' 天' };
  }
  if (daysLeft <= 3) {
    // 临期（3天内）
    return { level: 'warning', days: daysLeft, label: '还剩 ' + daysLeft + ' 天，尽快使用' };
  }
  if (daysLeft <= 7) {
    // 接近临期
    return { level: 'soon', days: daysLeft, label: '最佳食用期还剩 ' + daysLeft + ' 天' };
  }
  // 新鲜
  return { level: 'fresh', days: daysLeft, label: '新鲜，还剩 ' + daysLeft + ' 天' };
}
```

**颜色映射：**

| 级别 | 进度条颜色 | 左侧边框/标记 | 卡片透明度 | 操作按钮 |
|------|----------|-------------|-----------|---------|
| fresh (>7天) | `--green-primary` #3d6b52 | 无 | 100% | [−消耗] |
| soon (3-7天) | `--green-mid` #5a8a6e | 无 | 100% | [−消耗] |
| warning (<=3天) | `--amber` #c8892e | ⚠️ 左黄色边框 | 100% | [−消耗] |
| expired | `--red` #b84c38 | ❌ 左红色边框 | 85% | [🗑丢弃] |
| depleted | `--text-muted` | 无 | 60% | 无 |

**进度条百分比：**
```
percent = max(0, min(100, (daysLeft / expiry_days) * 100))
// 新鲜: 100%-57%, soon: 57%-29%, warning: 29%-0%, expired: 0%
```

### 2.6 需要的 Overlay / Sheet 组件清单

| 组件 | 用途 | 复用模式 |
|------|------|---------|
| `#overlayKitchen` | 厨房管理主页 | `.overlay` 标准结构 |
| `#kitchenAddSheet` | 添加食物入库 | `.inn-sheet` bottom sheet + `.pub-field` 表单 |
| `#kitchenConsumeSheet` | 消耗食物 | `.inn-sheet` 简化版（单字段+备注） |
| `#kitchenDiscardConfirm` | 丢弃过期食物确认 | `.inn-sheet` / 简化确认弹窗 |

---

## 3. CSS 样式建议

### 3.1 新增 CSS Class

所有新增样式对齐现有 Design Token，不引入新颜色值。

```css
/* ══ 田间管理 ══ */

/* 汇总栏 — 三等分行内统计 */
.farm-summary-row {
  display: flex;
  gap: 8px;
  padding: 8px 14px;
}
.farm-summary-item {
  flex: 1;
  text-align: center;
  padding: 8px 4px;
  border-radius: var(--radius-sm);
  background: #fff;
  font-size: .65rem;
  color: var(--text-secondary);
}
.farm-summary-item .fs-count {
  font-size: 1.1rem;
  font-weight: 700;
  display: block;
  margin-bottom: 2px;
}
.farm-summary-item.weed .fs-count  { color: var(--amber); }
.farm-summary-item.fert .fs-count  { color: var(--green-primary); }
.farm-summary-item.harv .fs-count  { color: var(--gold); }

/* 田地卡片 */
.farm-card {
  background: #fff;
  border: 1px solid var(--green-border);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 8px;
}
.farm-card.harvested { border-color: var(--amber); background: #fffbf5; }
.farm-card.composted  { opacity: .6; }
.farm-card.urgent     { border-color: var(--amber); }

/* 田地卡片头部 */
.farm-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.farm-crop-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
}
.farm-crop-name {
  font-weight: 700;
  font-size: .78rem;
  flex: 1;
}
.farm-crop-status {
  font-size: .62rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}
.farm-crop-status.ready    { background: #fef8e8; color: var(--amber); }
.farm-crop-status.growing  { background: #e8f0e8; color: var(--green-primary); }
.farm-crop-status.done     { background: #f0f0f0; color: var(--text-muted); }

/* 田地信息行 */
.farm-info-row {
  display: flex;
  gap: 12px;
  font-size: .62rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.farm-info-row span {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 进度条（复用 .co-progress 模式） */
.farm-progress {
  height: 6px;
  background: rgba(0,0,0,.06);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}
.farm-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width .3s ease;
}
.farm-progress-fill.growing  { background: var(--green-primary); }
.farm-progress-fill.weed     { background: var(--amber); }
.farm-progress-fill.ready    { background: var(--gold); }
.farm-progress-fill.done     { background: var(--text-muted); }

/* 倒计时文字 */
.farm-countdown {
  font-size: .62rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.farm-countdown.urgent { color: var(--amber); font-weight: 600; }
.farm-countdown.ready  { color: var(--gold); font-weight: 600; }

/* 操作按钮行 */
.farm-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 日志行（复用 .archive-log-row 模式） */
.farm-log-row {
  display: flex;
  gap: 8px;
  padding: 6px 14px;
  font-size: .62rem;
  line-height: 1.5;
  border-bottom: 1px dotted var(--gray-hairline);
}
.farm-log-icon {
  flex-shrink: 0;
  width: 22px;
  text-align: center;
}
.farm-log-text {
  flex: 1;
  color: var(--text-secondary);
}
.farm-log-time {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: .55rem;
  white-space: nowrap;
}
.farm-log-user {
  font-weight: 600;
  color: var(--text);
}

/* ══ 厨房管理 ══ */

/* 厨房汇总栏（复用 .farm-summary-row） */
.kitchen-summary-row {
  display: flex;
  gap: 8px;
  padding: 8px 14px;
}
.kitchen-summary-item {
  flex: 1;
  text-align: center;
  padding: 8px 4px;
  border-radius: var(--radius-sm);
  background: #fff;
  font-size: .62rem;
  color: var(--text-secondary);
}
.kitchen-summary-item .ks-count {
  font-size: 1.1rem;
  font-weight: 700;
  display: block;
  margin-bottom: 2px;
}
.kitchen-summary-item.total .ks-count   { color: var(--green-primary); }
.kitchen-summary-item.warning .ks-count  { color: var(--amber); }
.kitchen-summary-item.expired .ks-count  { color: var(--red); }

/* 食物库存卡片 */
.kitchen-card {
  background: #fff;
  border: 1px solid var(--green-border);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 8px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.kitchen-card.expired   { opacity: .85; border-left: 3px solid var(--red); }
.kitchen-card.warning   { border-left: 3px solid var(--amber); }
.kitchen-card.depleted  { opacity: .6; }

/* 食物图标 */
.kitchen-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
  width: 36px;
  text-align: center;
  line-height: 1.4;
}

/* 食物信息 */
.kitchen-body {
  flex: 1;
  min-width: 0;
}
.kitchen-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}
.kitchen-name {
  font-weight: 700;
  font-size: .75rem;
}
.kitchen-qty {
  font-size: .65rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.kitchen-cat {
  font-size: .58rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: #e8f0e8;
  color: var(--green-primary);
  flex-shrink: 0;
}

/* 日期信息 */
.kitchen-date {
  font-size: .6rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

/* 保质期进度条（复用 .farm-progress） */
.kitchen-expiry-bar {
  height: 4px;
  background: rgba(0,0,0,.06);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 3px;
}
.kitchen-expiry-fill {
  height: 100%;
  border-radius: 2px;
  transition: width .3s ease;
}
.kitchen-expiry-fill.fresh   { background: var(--green-primary); }
.kitchen-expiry-fill.soon    { background: var(--green-mid); }
.kitchen-expiry-fill.warning { background: var(--amber); }
.kitchen-expiry-fill.expired { background: var(--red); }

/* 保质期文字 */
.kitchen-expiry-text {
  font-size: .58rem;
  margin-bottom: 4px;
}
.kitchen-expiry-text.fresh   { color: var(--text-secondary); }
.kitchen-expiry-text.soon    { color: var(--text-secondary); }
.kitchen-expiry-text.warning { color: var(--amber); font-weight: 600; }
.kitchen-expiry-text.expired { color: var(--red); font-weight: 600; }

/* 消耗按钮行 */
.kitchen-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  align-items: center;
}

/* 分类 Chip 行（复用 .my-filters 模式） */
.kitchen-filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 14px;
  border-bottom: 1px solid var(--green-border);
}
.kitchen-filters::-webkit-scrollbar { display: none; }

/* 厨房日志行（复用 .farm-log-row） */
.kitchen-log-row {
  display: flex;
  gap: 8px;
  padding: 6px 14px;
  font-size: .62rem;
  border-bottom: 1px dotted var(--gray-hairline);
}
.kitchen-log-icon {
  flex-shrink: 0;
  width: 22px;
  text-align: center;
}
.kitchen-log-text {
  flex: 1;
  color: var(--text-secondary);
}
.kitchen-log-time {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: .55rem;
  white-space: nowrap;
}

/* ══ 共享表单样式（两个模块的 Sheet 共用） ══ */

/* 表单 Sheet（复用 .inn-sheet 结构） */
.farm-sheet {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.farm-sheet-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 20px 16px;
  padding-bottom: max(20px, env(safe-area-inset-bottom, 0px));
  max-height: 80vh;
  overflow-y: auto;
  animation: fadeIn .2s ease-out;
}
.farm-sheet-title {
  font-size: .85rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 16px;
  color: var(--text);
}
.farm-sheet-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.farm-sheet-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-size: .75rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.farm-sheet-actions button:active {
  transform: scale(.97);
}
.farm-sheet-actions .fs-btn-save {
  background: var(--green-primary);
  color: #fff;
}
.farm-sheet-actions .fs-btn-cancel {
  background: var(--gray-light);
  color: var(--text-secondary);
}

/* 空状态 */
.farm-empty {
  text-align: center;
  padding: 40px 16px;
  color: var(--text-muted);
  font-size: .7rem;
}
.farm-empty-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
}
```

### 3.2 不新增的颜色值

所有颜色引用现有 Token：`var(--green-primary)`, `var(--amber)`, `var(--gold)`, `var(--red)`, `var(--text-muted)`, `var(--text-secondary)`, `var(--green-border)`, `var(--gray-hairline)`, `var(--green-bg)`。

### 3.3 响应式注意事项

- 所有宽度使用百分比或 flex 布局，`max-width: 400px` 限制 Sheet 宽度
- 卡片内容区域使用 `min-width: 0` + `overflow: hidden` + `text-overflow: ellipsis` 防止文字溢出
- Chip 行使用 `overflow-x: auto` + `-webkit-overflow-scrolling: touch` + `white-space: nowrap`
- 底部 Sheet 使用 `padding-bottom: max(20px, env(safe-area-inset-bottom, 0px))` 适配刘海屏

---

## 4. AppData 初始化清单

在 `AppData.init()` 中新增初始化项：

```js
if (!this._data.farm_plantings) this._data.farm_plantings = {};
if (!this._data.farm_logs)      this._data.farm_logs = [];
if (!this._data.kitchen_items)  this._data.kitchen_items = {};
if (!this._data.kitchen_logs)   this._data.kitchen_logs = [];
```

在 `AppData._saveShared()` 的 data 对象中新增：

```js
farm_plantings: this._data.farm_plantings,
farm_logs: this._data.farm_logs,
kitchen_items: this._data.kitchen_items,
kitchen_logs: this._data.kitchen_logs,
```

---

## 5. 待用户决策的问题

1. **区域管理**：田地"区域"是预设死数据（如"菜地A区/菜地B区"），还是允许用户自由创建/删除区域？当前设计允许自由命名但走 text input。

2. **提醒的主动性**：当前设计是「被动卡片的视觉提示 + 汇总栏数字」。是否需要更强的主动提醒（如：在村口页面上显示 Badge）？

3. **与食堂菜单关联**：厨房消耗时是否真的需要连接到食堂菜单（参见 2.3.2 中的 `linked_menu` 字段）？如果需要，这个关联逻辑谁维护？

4. **权限模型**：所有用户都可以对田地和厨房进行操作，还是只有特定角色？当前设计无权限限制。

5. **NT 奖励**：田间操作（除草/施肥/采摘/堆肥）和厨房操作（入库/消耗）是否获得 NT 奖励？如果需要，沿用 `recordTransaction()` 模式，可在具体实现时追加。
