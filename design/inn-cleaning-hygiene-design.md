# 住宿管理 . 大扫除 . 卫生管理 UI 设计方案

> 南塘云村 App -- 移动端 Web 优先  
> 设计 Token 对齐: `--green-primary: #3d6b52` / `--green-bg: #e8ede6` / `--radius-md: 12px`  
> 复用现有: `.overlay` / `.inn-sheet` / `.btn-sm` / `.my-fchip` / `.section-head` / `.mgmt-section` / `showToast()`  
> 数据: 扩展 `INN_ROOMS` + `inn_applications`，复用 `JOURNAL_TYPES.cleaning` 验证管道

---

## 1. 住宿管理升级

### 1.1 房间状态机

```
                     ┌──────────────────────────────┐
                     │         维 修 中               │
                     │  (maintenance)  ⚫            │
                     │  admin 手动标记/取消           │
                     └──────────┬───────────────────┘
                                │ 维修完成 → 标记打扫
                                v
    ┌──────────┐   admin 办理入住   ┌──────────┐
    │ 可 入 住  │ ───────────────> │ 已 入 住  │
    │(available)│                  │(occupied) │
    │    🟢    │ <─────────────── │    🔴    │
    └──────────┘   admin 退房      └──────────┘
         ^                              │
         │   打扫完成 + 备品确认         │  退房后自动生成
         │         admin 确认           │  打扫任务
         │                              v
         └──── 待 打 扫 ────────────────┘
              (dirty)  🟡
              - 自动关联打扫任务
              - 显示"谁在打扫"
```

**状态流转规则:**

| 当前状态 | 可用操作 | 目标状态 | 操作者 |
|---------|---------|---------|--------|
| `available` | 办理入住 | `occupied` | admin |
| `available` | 标记维修 | `maintenance` | admin |
| `occupied` | 办理退房 | `dirty` | admin |
| `dirty` | 打扫完成 + 备品确认 | `available` | admin |
| `maintenance` | 维修完成 | `dirty` (走打扫流程) | admin |
| 任意 | 查看详情 | -- | 所有人 |

**状态标签设计:**

| 状态 | 标签颜色 | 图标 | CSS class |
|-----|---------|------|-----------|
| `available` | 绿色 `#3d6b52` | 空室 | `.inn-status--available` |
| `occupied` | 红色 `#b84c38` | 入住中 | `.inn-status--occupied` |
| `dirty` | 琥珀 `#c8892e` | 待打扫 | `.inn-status--dirty` |
| `maintenance` | 灰色 `#8a8a8a` | 维修中 | `.inn-status--maintenance` |

### 1.2 信息架构

```
客栈 overlay (overlayInn)
│
├── 顶栏: ← 返回 | 客栈 | [管理员标记: 🔧管理]
│
├── 标签栏: [🏨 房间] [📋 我的住宿] [🧹 打扫队列]
│   └── 复用 .my-fchip 横向滚动模式
│
├── 🏨 房间 Tab 主体
│   ├── 统计条: 总计4栋 · 可住N · 入住N · 待扫N
│   ├── 竹楼 ▸ (可折叠, 复用 .inn-building-head)
│   │   ├── 竹·A间  🟢 可入住 · ¥30/天
│   │   └── 竹·B间  🔴 砚仁 · 07-20 至 07-27
│   ├── 梅楼 ▸
│   │   └── ...
│   ├── 兰楼(四人间) ▸
│   │   └── ...
│   └── 菊楼 ▸
│       └── ...
│
├── 📋 我的住宿 Tab 主体
│   └── 本人住宿申请列表 (复用 .inn-stay-card)
│
└── 🧹 打扫队列 Tab 主体 (仅 admin 可见)
    └── 待打扫任务卡片列表
```

### 1.3 主界面布局 (ASCII 线框图)

#### 1.3.1 房间卡片 (管理视角)

```
┌────────────────────────────────────────────┐
│  竹楼                        ▾ 展开/折叠    │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ 🟢 可入住              ¥30 / 天      │   │
│ │ 竹·A间  1.2m床 · 书桌 · 朝南        │   │
│ │ 状态: 已打扫 ✓  备品: 齐全 ✓        │   │
│ │ 备注: (无)                          │   │
│ │                         [办理入住 >] │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ 🔴 已入住              ¥30 / 天      │   │
│ │ 竹·B间  1.2m床 · 书桌 · 朝北        │   │
│ │ 住客: 砚仁 · 07-20 ~ 07-27 (第8天)  │   │
│ │ 预计退房: 2026-07-27                │   │
│ │                         [办理退房 >] │   │
│ └──────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

#### 1.3.2 床位详情 Sheet (管理视角)

```
┌────────────────────────────────────────────┐
│       (半屏 Sheet, 复用 .inn-sheet)        │
│                                            │
│          竹·A间                            │
│        🟢 可入住                           │
│                                            │
│  ┌─ 基本信息 ──────────────────────┐       │
│  │  床位: 1.2m        朝向: 朝南    │       │
│  │  书桌: 有          价格: ¥30/天  │       │
│  │  容纳: 1人                      │       │
│  └─────────────────────────────────┘       │
│                                            │
│  ┌─ 房间状态 ──────────────────────┐       │
│  │  清洁: [已打扫 v] [需打扫]      │       │
│  │  备品: ☑床品 ☑毛巾 ☑洗漱       │       │
│  │        ☐其他: [______]          │       │
│  │  备注: ┌────────────────┐       │       │
│  │        │                │       │       │
│  │        └────────────────┘       │       │
│  └─────────────────────────────────┘       │
│                                            │
│  ┌─ 当前住客 (入住中) ────────────┐       │
│  │  住客: 砚仁                    │       │
│  │  入住: 2026-07-20              │       │
│  │  预计退房: 2026-07-27          │       │
│  │  已住: 8天  费用累计: ¥240     │       │
│  └─────────────────────────────────┘       │
│                                            │
│  [办理入住]  [标记维修]  [关闭]            │
│                                            │
└────────────────────────────────────────────┘
```

#### 1.3.3 办理入住 Sheet

```
┌────────────────────────────────────────────┐
│       办理入住 · 竹·A间                     │
│                                            │
│  选择住客:                                 │
│  ┌──────────────────────────────────┐      │
│  │ 👤 砚仁 · admin              ▾  │      │
│  └──────────────────────────────────┘      │
│  (可选: 扫描/输入住客名, 复用 .user-chip)   │
│                                            │
│  入住日期: [2026-07-20 v]                  │
│  预计退房: [2026-07-27 v]                  │
│  预计天数: 7 天                            │
│                                            │
│  日费: ¥30                                 │
│  预计总费: ¥210                            │
│                                            │
│  收费: [______] RMB/NT                     │
│  已收: [______]                            │
│                                            │
│  备注: ┌────────────────────────┐          │
│        │                        │          │
│        └────────────────────────┘          │
│                                            │
│  [✅ 确认入住]    [取消]                    │
└────────────────────────────────────────────┘
```

#### 1.3.4 打扫队列 Tab (仅 admin)

```
┌────────────────────────────────────────────┐
│  🧹 打扫队列                  共 2 间待打扫 │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ 🟡 待打扫                           │   │
│ │ 竹·A间                              │   │
│ │ 退房时间: 07-27 · 退房人: 砚仁      │   │
│ │ 生成时间: 07-27 14:00               │   │
│ │ 打扫人: ___________                 │   │
│ │ ┌ 打扫确认 ─────────────────┐       │   │
│ │ │ ☐ 垃圾已清理              │       │   │
│ │ │ ☐ 垃圾分类: []可回收 []厨余│       │   │
│ │ │    []其他 []有害           │       │   │
│ │ │ ☐ 床品更换                │       │   │
│ │ │ ☐ 毛巾更换                │       │   │
│ │ │ ☐ 洗漱用品补充            │       │   │
│ │ │ ☐ 地面/桌面清洁           │       │   │
│ │ │ 打扫人: _______________   │       │   │
│ │ │ 完成时间: 07-27 15:30     │       │   │
│ │ │ [✅ 确认打扫完成]         │       │   │
│ │ └───────────────────────────┘       │   │
│ └──────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

### 1.4 关键交互流程

#### 流程 1: 办理入住

```
点击房间卡片 [办理入住]
  → 弹出入住 Sheet (.inn-sheet)
  → 选择住客 (下拉 / 搜索 / user-chip 网格)
  → 设置入住日期 (默认今天)
  → 设置预计退房 (默认+7天)
  → 显示预计费用 = 日费 × 天数
  → 填入实际收费金额 (可与预计不同)
  → 可选备注
  → [确认入住]
  → 写入数据:
    - INN_ROOMS[room].occupant = userName
    - INN_ROOMS[room].checkIn = date
    - INN_ROOMS[room].checkOut = expDate
    - INN_ROOMS[room].status = 'occupied'
    - INN_ROOMS[room].feeCollected = amount
    - 创建 inn_applications 记录 (status='confirmed', 含费用信息)
    - AppData.addJournal(user, 'register', '入住 '+roomName)
    - recordTransaction({ type:'inn_checkin', user, room, amount, ... })
  → showToast('入住办理成功', 'ok')
  → 关闭 Sheet, refresh 房间列表
```

#### 流程 2: 办理退房

```
点击房间卡片 [办理退房]
  → 弹出退房确认 Sheet
  → 显示: 住客名 · 入住日期 · 预计退房 · 实际已住天数
  → 输入实际退房日期 (默认今天)
  → 费用结算:
    - 预计费用: ¥X
    - 实际天数: N 天
    - 实际费用: ¥Y
    - 已收费用: ¥Z
    - 差额: ¥(Y - Z)  [正=欠费, 负=应退]
  → 退房检查:
    ☐ 房间无损坏
    ☐ 如有损坏: [描述损伤] [预估维修费 ¥___]
  → [确认退房]
  → 写入数据:
    - INN_ROOMS[room].occupant = null
    - INN_ROOMS[room].status = 'dirty'
    - INN_ROOMS[room].cleanState = 'needs_cleaning'
    - INN_ROOMS[room].supplies = { bedding:false, towels:false, toiletries:false }
    - 更新 inn_applications 记录 (actualCheckOut, feeAdjustment)
    - 自动生成打扫任务 → cleaning_tasks[]
    - recordTransaction({ type:'inn_checkout', user, room, feeDiff, damage, ... })
  → showToast('退房完成，已生成打扫任务', 'ok')
  → 关闭 Sheet, refresh 房间列表 + 打扫队列
```

#### 流程 3: 打扫流程

```
打扫队列 Tab → 点击某条待打扫房间
  → 展开打扫确认面板 (inline, 不弹窗)
  → 显示 Checklist:
    ☐ 垃圾已清理
    ☐ 垃圾分类 (弹出选择: 可回收/厨余/其他/有害)
    ☐ 床品更换
    ☐ 毛巾更换
    ☐ 洗漱用品补充
    ☐ 地面/桌面清洁
  → 输入: 打扫人姓名 / 打扫完成时间
  → [确认打扫完成]
  → 写入数据:
    - 更新 cleaning_tasks[taskId].status = 'done'
    - 更新 cleaning_tasks[taskId].doneBy / doneAt / checklist
    - INN_ROOMS[room].status = 'available'
    - INN_ROOMS[room].cleanState = 'cleaned'
    - INN_ROOMS[room].supplies = { bedding:true, towels:true, toiletries:true }
    - AppData.addJournal(cleaner, 'cleaning', '打扫 '+roomName+' 完成')
    // 校核制: cleaning 类型通过 AppData.addVerification 发 NT
  → showToast('打扫完成，房间已恢复可入住', 'ok')
  → refresh 房间列表 + 打扫队列
```

### 1.5 数据模型扩展

```js
// ══ INN_ROOMS 现有字段保持不变，仅新增以下字段 ══

// 每个 room/bed 新增字段:
{
  // --- 现有字段 (不变) ---
  id:'zhu_a', name:'竹·A间', bed:'1.2m', desk:true, dir:'朝南', price:30,
  occupant:null, checkIn:null, checkOut:null,

  // --- 新增字段 ---
  status: 'available',           // 'available'|'occupied'|'dirty'|'maintenance'
  cleanState: 'cleaned',         // 'cleaned'|'needs_cleaning'
  supplies: {                    // 备品状态
    bedding: true,               // 床品
    towels: true,                // 毛巾
    toiletries: true,            // 洗漱用品
    other: ''                    // 其他备品备注
  },
  notes: '',                     // 备注 (如 "窗户需要修理")
  feeCollected: 0,               // 实收费用 (本次入住)
  lastCleanAt: '',               // 上次打扫时间
  lastCleanBy: ''                // 上次打扫人
}

// ══ inn_applications 新增字段 ══
{
  // --- 现有字段 (不变) ---
  user, bedId, bedName, building, checkIn, checkOut,
  price, status, appliedAt, totalCost,

  // --- 新增字段 ---
  actualCheckOut: '',            // 实际退房日期
  feeCollected: 0,               // 实际收款
  feeAdjustment: 0,              // 费用调整 (正=补收, 负=退款)
  damage: '',                    // 损坏描述
  damageFee: 0,                  // 损坏扣费
  checkedOutBy: '',              // 办理退房的管理员
  checkedOutAt: ''               // 退房操作时间
}

// ══ 新增: 打扫任务 (存 AppData._data.cleaning_tasks) ══
{
  id: 'clean_zhu_a_20260727',
  roomId: 'zhu_a',
  roomName: '竹·A间',
  building: '竹',
  status: 'pending',      // 'pending'|'done'
  generatedAt: '2026-07-27T14:00',
  generatedBy: '退房自动',
  doneBy: '',
  doneAt: '',
  checklist: {
    garbage_cleared: false,
    garbage_sorted: false,
    garbage_types: [],    // ['recyclable','kitchen','other','hazardous']
    bedding_replaced: false,
    towels_replaced: false,
    toiletries_refilled: false,
    surfaces_cleaned: false
  }
}
```

### 1.6 与现有 INN_ROOMS / overlayInn 的集成方式

**原则: 最小改动，新增功能叠加。**

| 改动点 | 方式 | 现有代码影响 |
|-------|------|------------|
| room 数据结构 | 给每个 room/bed 增加 `status` 等字段，缺省时 `status = occupant ? 'occupied' : 'available'` | `findInnBed()` 不变；`renderInn()` 读取新字段 |
| 房间卡片 | 在现有 `.inn-room-card` 模板中增加状态标签行 + 状态类名 | `renderInn()` 替换卡片 HTML 模板 |
| Tab 切换 | 在 overlay-body 顶部加 `.my-fchip` 行: [房间] [我的住宿] [打扫队列] | 新增 `innTab` 变量 + `switchInnTab(tab)` |
| 床位详情 Sheet | 根据 status 显示不同操作按钮行，复用 `.inn-sheet` 壳 + `.inn-detail-*` 样式 | 扩展 `showInnDetail()` → `renderInnDetailSheet()` |
| 打扫队列 | 新增 Tab 面板，仅 admin 可见 | 新增 `renderCleaningQueue()` |
| 数据持久化 | `INN_ROOMS` 全局数组（不用 AppData 包裹，与现有一致）；`cleaning_tasks` 存 `AppData._data` | `AppData._saveShared()` 已覆盖 |

**降级策略**: 旧数据没有 `status` 字段时，运行时降级推断:
```js
function getRoomStatus(room) {
  if (room.status) return room.status;
  // 降级: 从旧字段推断
  if (room.occupant) return 'occupied';
  return 'available';
}
```

---

## 2. 大扫除

### 2.1 信息架构

```
大扫除 overlay (overlayDeepClean)          ← 新建
│
├── 顶栏: ← 返回 | 大扫除
│
├── 状态标签栏: [进行中 N] [即将开始 N] [往期归档]
│   └── 复用 .my-fchip 横向滚动
│
├── 活动列表
│   ├── 大扫除卡片 × N
│   │   ├── 标题 + 日期时间
│   │   ├── 目的 (如 "迎接新营员")
│   │   ├── 区域进度条 (厨房✓ 院子✓ 厕所... 4/6)
│   │   ├── 参与者头像行
│   │   ├── NT 奖励显示
│   │   └── [查看详情 >]
│   │
│   └── [＋ 发起大扫除] (admin only, 底部固定按钮)
│
└── 大扫除详情 Sheet
    ├── 基本信息: 日期/目的/发起人
    ├── 区域进度面板
    ├── 参与者列表
    ├── 发现日志
    ├── 验收 + 发 NT (admin)
    └── [报名参加] (非 admin)
```

### 2.2 主界面布局 (ASCII 线框图)

#### 2.2.1 大扫除列表

```
┌────────────────────────────────────────────┐
│  ← 大扫除                                  │
├────────────────────────────────────────────┤
│  [进行中 2]  [即将开始 1]  [往期归档 5]    │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ 🧹 周末例行大扫除                    │   │
│ │ 07-26 (周六) 09:00 - 12:00          │   │
│ │ 目的: 周末例行清扫，保持院子整洁    │   │
│ │                                      │   │
│ │ 厨房 ✓  院子 ✓  厕所 ...  客厅 ...  │   │
│ │ ████████░░░░░░░░░░ 4/6 区域已完成    │   │
│ │                                      │   │
│ │ 👤砚仁 👤淑惠 👤朝林  +2人          │   │
│ │                                      │   │
│ │ 🪙 每人 +15 NT          [查看详情 >]│   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ 🧹 迎接新营员大扫除                  │   │
│ │ 07-28 (周一) 14:00 - 17:00          │   │
│ │ 目的: 新营员到来前全面清理          │   │
│ │                                      │   │
│ │ 厨房 ...  院子 ...  厕所 ...  (0/6) │   │
│ │ ░░░░░░░░░░░░░░░░░░ 0/6 区域         │   │
│ │                                      │   │
│ │ 👤砚仁 (发起人)  报名中...          │   │
│ │                                      │   │
│ │ 🪙 每人 +20 NT          [报名参加 >]│   │
│ └──────────────────────────────────────┘   │
│                                            │
│              [+ 发起大扫除]                │
└────────────────────────────────────────────┘
```

#### 2.2.2 大扫除详情 Sheet

```
┌────────────────────────────────────────────┐
│       周末例行大扫除                        │
│       07-26 (周六) 09:00 - 12:00           │
│       发起人: 砚仁                          │
│                                            │
│  ┌─ 区域进度 ──────────────────────┐       │
│  │  ☑ 厨房       砚仁 打扫完成     │       │
│  │  ☑ 院子       淑惠 打扫完成     │       │
│  │  ☑ 厕所       朝林 打扫完成     │       │
│  │  ☑ 客厅       大飞 打扫完成     │       │
│  │  ☐ 书房       未分配            │       │
│  │  ☐ 走廊       未分配            │       │
│  │  进度: 4/6 (67%)               │       │
│  └─────────────────────────────────┘       │
│                                            │
│  ┌─ 参与者 (4人) ──────────────────┐       │
│  │  👤 砚仁 (发起)                 │       │
│  │  👤 淑惠                         │       │
│  │  👤 朝林                         │       │
│  │  👤 大飞                         │       │
│  │  [我要报名]  (仅非参与者可见)    │       │
│  └─────────────────────────────────┘       │
│                                            │
│  ┌─ 发现日志 ──────────────────────┐       │
│  │  📝 砚仁: 在角落找到了遗失的画笔 │       │
│  │  📝 淑惠: 书房书架第三层需要加固 │       │
│  │  [+ 添加发现]                   │       │
│  └─────────────────────────────────┘       │
│                                            │
│  ┌─ 管理操作 (admin only) ─────────┐       │
│  │  [✅ 全部验收]  [📢 发NT公告]   │       │
│  └─────────────────────────────────┘       │
│                                            │
│                   [关闭]                    │
└────────────────────────────────────────────┘
```

#### 2.2.3 发起大扫除表单

```
┌────────────────────────────────────────────┐
│       发起大扫除                            │
│                                            │
│  标题: [周末例行大扫除_______________]      │
│                                            │
│  日期: [2026-07-26 v]                      │
│  时间段: [09:00 v] - [12:00 v]            │
│                                            │
│  目的:                                     │
│  ○ 迎接新营员    ○ 周末例行                │
│  ○ 节前大扫除    ○ 其他: [__________]      │
│                                            │
│  打扫区域 (多选):                          │
│  ┌──────────────────────────────────┐      │
│  │ [☑] 厨房    [☑] 院子    [☑] 厕所│      │
│  │ [☑] 客厅    [☑] 书房    [☑] 走廊│      │
│  │ [☐] 仓库    [☐] 其他: [_____]   │      │
│  └──────────────────────────────────┘      │
│                                            │
│  NT 奖励: 每人 [15] NT                     │
│  (默认: = cleaning_pricing.clean × 区域数) │
│                                            │
│  备注: ┌────────────────────────┐          │
│        │                        │          │
│        └────────────────────────┘          │
│                                            │
│  [✅ 发起]    [取消]                        │
└────────────────────────────────────────────┘
```

### 2.3 关键交互流程

#### 流程 1: 发起大扫除 (admin)

```
[+ 发起大扫除] (底部固定按钮)
  → 弹出表单 Sheet
  → 填写: 标题(必填) / 日期(必填, 默认本周六) / 时间段 / 目的 / 区域(至少选1个) / NT奖励(默认值)
  → [发起]
  → 写入: deep_cleans[eventId] = { ...全部字段, status:'upcoming', participants:[], discoveries:[] }
  → showToast('大扫除已发布', 'ok')
  → 关闭 Sheet, 列表出现新活动卡片
```

#### 流程 2: 报名参加 (所有用户)

```
列表卡片 [报名参加] 或 详情 Sheet [我要报名]
  → 写入: deep_cleans[eventId].participants.push({ name:CURRENT_USER, joinedAt:now, areas:[] })
  → showToast('报名成功', 'ok')
  → refresh 卡片 (按钮变 [已报名] / 显示参与者列表)
```

#### 流程 3: 区域打扫标记

```
详情 Sheet → 点击未完成区域
  → 弹出小确认: "标记 [厨房] 为已完成?"
  → 可选输入: 发现日志 (textarea)
  → [确认]
  → 写入:
    - 区域状态 = 'done'
    - 区域打扫人 = CURRENT_USER
    - 如有发现: discoveries.push({ user, area, content, time })
    - progress = doneCount / totalCount
  → refresh 进度面板
  → (首次有人完成区域时) 活动 status 自动从 'upcoming' → 'active'
```

#### 流程 4: 全部验收 + 发 NT (admin)

```
详情 Sheet → [✅ 全部验收]
  → 确认弹窗: "确认所有区域打扫完成? 将为 N 人发放 NT 奖励。"
  → [确认]
  → 写入:
    - 活动 status = 'completed'
    - 活动 completedAt = now()
    - 遍历 participants: NT.earn(user, rewardNT, '大扫除: '+title, 'community')
    - AppData.addJournal(每人, 'cleaning', '参加大扫除: '+title+' 完成')
    // cleaning 类型走校核制: AppData.addVerification → admin 校核 → NT 到账
  → showToast('大扫除验收完成，NT已发放', 'ok')
  → 活动移入 [往期归档]
```

### 2.4 数据模型

```js
// ══ 存 AppData._data.deep_cleans ══
// 每个大扫除活动:
{
  id: 'dc_20260726',
  title: '周末例行大扫除',
  date: '2026-07-26',
  timeStart: '09:00',
  timeEnd: '12:00',
  purpose: 'weekend_routine',    // 'welcome_new'|'weekend_routine'|'pre_festival'|'other'
  purposeLabel: '周末例行',
  areas: [                        // 打扫区域
    { id:'kitchen',   name:'厨房', status:'pending', doneBy:'', doneAt:'', note:'' },
    { id:'courtyard', name:'院子', status:'done',    doneBy:'砚仁', doneAt:'10:30', note:'' },
    { id:'toilet',    name:'厕所', status:'done',    doneBy:'淑惠', doneAt:'11:00', note:'' },
    { id:'living',    name:'客厅', status:'done',    doneBy:'朝林', doneAt:'10:45', note:'' },
    { id:'study',     name:'书房', status:'pending', doneBy:'', doneAt:'', note:'' },
    { id:'corridor',  name:'走廊', status:'pending', doneBy:'', doneAt:'', note:'' }
  ],
  participants: [                // 参与者
    { name:'砚仁', joinedAt:'2026-07-20T14:00', role:'host' },
    { name:'淑惠', joinedAt:'2026-07-20T15:00', role:'member' }
  ],
  discoveries: [                 // 发现日志
    { user:'砚仁', area:'courtyard', content:'在角落找到了遗失的画笔', time:'10:15' },
  ],
  rewardNT: 15,                  // 每人 NT 奖励
  createdBy: '砚仁',             // 发起人
  createdAt: '2026-07-20T14:00',
  status: 'active',              // 'upcoming'|'active'|'completed'
  completedAt: '',
  completedBy: ''
}
```

### 2.5 与 NT 经济系统的集成

```
大扫除完成 → admin 验收
  → 遍历参与者:
    for each participant:
      // 复用现有的 cleaning 验证管道
      AppData.addJournal(user, 'cleaning', '大扫除: '+title+' - '+areasDone+'区域完成')
      // addJournal 内部: JOURNAL_TYPES.cleaning → skipEarn → AppData.addVerification
      // admin 在 verification 面板校核通过 → NT.earn(user, rewardNT, ...)
  → 大扫除活动状态 → 'completed'
  → 自动触发: _unfreezeCV(user) (如果用户有冻结 CV, 大扫除后解冻 50%)
  → 新手任务: join_cleaning 自动完成检测
```

**关键设计点:** 大扫除的 cleaning journal 走校核制，不是自动发 NT。这样 admin 可以在 verification 面板统一审核确认后发放，避免单人虚假标记。

---

## 3. 日常卫生管理

### 3.1 信息架构

```
日常卫生 overlay (overlayHygiene)            ← 新建
│
├── 顶栏: ← 返回 | 日常卫生
│
├── 日期行: [← 昨天] 07-26 周六 [明天 →]
│   └── 滑动切换日期
│
├── 今日统计: 3/6 项已完成 · 可获得 +6 NT
│
├── 任务清单 (Checklist)
│   ├── ☑ 厨房清洁    砚仁 · 09:30
│   ├── ☑ 厕所清洁    淑惠 · 10:15
│   ├── ☐ 客厅整理    待完成 · 截止 22:00
│   ├── ☐ 院子清扫    待完成 · 截止 22:00
│   ├── ☐ 倒垃圾      待完成 · 截止 22:00
│   └── ☑ 走廊拖地    朝林 · 08:45
│
├── 标签栏: [本周] [本月]
│
├── 历史记录 (简单列表)
│   └── 每日完成率 + 参与者
│
└── [管理排班] (admin only, 底部按钮)
```

### 3.2 主界面布局 (ASCII 线框图)

#### 3.2.1 今日卫生清单

```
┌────────────────────────────────────────────┐
│  ← 日常卫生                                │
├────────────────────────────────────────────┤
│         ←  07月26日 周六  →                │
├────────────────────────────────────────────┤
│  📊 今日: 3/6 项完成 · 🪙 +6 NT 可获得     │
│  ████████░░░░░░░░░░ 50%                    │
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ ☑ 厨房清洁                          │   │
│ │    砚仁 · 09:30 · +2 NT             │   │
│ │    ────────────────────────────      │   │
│ │    (绿色底纹打勾, 已完成视觉)       │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ ☑ 厕所清洁                          │   │
│ │    淑惠 · 10:15 · +2 NT             │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ ☐ 客厅整理                          │   │
│ │    待完成 · 截止 22:00              │   │
│ │    ────────────────────────────      │   │
│ │    [我来做 ▸]                       │   │
│ │    (白色底纹, 右侧操作按钮)         │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ ☐ 院子清扫                          │   │
│ │    待完成 · 截止 22:00              │   │
│ │    [我来做 ▸]                       │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ 🔴 倒垃圾                           │   │
│ │    已逾期! 截止昨日 22:00           │   │
│ │    [我来做 ▸]                       │   │
│ │    (红色高亮, 逾期提醒)             │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ ☑ 走廊拖地                          │   │
│ │    朝林 · 08:45 · +2 NT             │   │
│ └──────────────────────────────────────┘   │
│                                            │
│  [本周]  [本月]                    [⚙ 排班]│
└────────────────────────────────────────────┘
```

#### 3.2.2 打卡确认弹窗

```
┌────────────────────────────────────────────┐
│      确认完成: 客厅整理                     │
│                                            │
│  任务: 客厅整理                             │
│  日期: 2026-07-26                          │
│  NT 奖励: +2 NT                            │
│                                            │
│  备注 (可选):                              │
│  ┌────────────────────────────────┐        │
│  │ 整理了沙发垫，吸尘完成         │        │
│  └────────────────────────────────┘        │
│                                            │
│  [✅ 确认完成]    [取消]                    │
└────────────────────────────────────────────┘
```

#### 3.2.3 排班管理 (admin)

```
┌────────────────────────────────────────────┐
│  ⚙ 卫生排班管理                            │
├────────────────────────────────────────────┤
│ ┌ 任务模板 ────────────────────────┐       │
│ │                                    │       │
│ │  厨房清洁    🕐 每天     👤 砚仁   │       │
│ │  厕所清洁    🕐 每天     👤 淑惠   │       │
│ │  客厅整理    🕐 每天     👤 轮值   │       │
│ │  院子清扫    🕐 每2天    👤 轮值   │       │
│ │  倒垃圾      🕐 每天     👤 大飞   │       │
│ │  走廊拖地    🕐 每周     👤 轮值   │       │
│ │                                    │       │
│ │  [+ 添加任务模板]                  │       │
│ └────────────────────────────────────┘       │
│                                            │
│ ┌ 今日自动分配 ────────────────────┐       │
│ │  (从模板生成: 厨房/厕所/客厅/    │       │
│ │   垃圾为今天, 院子为偶数日,      │       │
│ │   走廊为周日)                    │       │
│ │                                    │       │
│ │  "轮值" → 按参与历史轮流分配     │       │
│ │  ponytail: 简单轮询，不建复杂算法 │       │
│ └────────────────────────────────────┘       │
│                                            │
│  [💾 保存排班]                             │
└────────────────────────────────────────────┘
```

#### 3.2.4 历史记录视图

```
┌────────────────────────────────────────────┐
│  本周卫生记录                   07-21 ~ 07-26│
├────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐   │
│ │ 07-26 周六  5/6 完成  83%           │   │
│ │ 👤砚仁 · 👤淑惠 · 👤朝林            │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ 07-25 周五  6/6 完成  100%  ✓       │   │
│ │ 👤砚仁 · 👤淑惠 · 👤朝林 · 👤大飞   │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ 07-24 周四  4/6 完成  67%           │   │
│ │ 👤砚仁 · 👤淑惠                      │   │
│ └──────────────────────────────────────┘   │
│ ...                                        │
└────────────────────────────────────────────┘
```

### 3.3 关键交互流程

#### 流程: 每日卫生打卡

```
用户在今日清单看到未完成项 → 点击 [我来做 ▸]
  → 弹出确认弹窗 (.modal-overlay → .modal-card)
  → 显示: 任务名 / 日期 / NT奖励 / 备注输入
  → [确认完成]
  → 写入:
    - hygiene_records[date][taskId] = { doneBy:CURRENT_USER, doneAt:now, note }
    - NT.earn(CURRENT_USER, rewardNT, '日常卫生: '+taskName, 'personal')
    // 小额的 daily NT，不走校核制 (与 cleaning 大额不同)
  → showToast('打卡成功! +'+rewardNT+' NT', 'ok')
  → 关闭弹窗, 刷新清单 (该项变为 ☑ 完成状态)
  → 刷新顶部统计条
```

#### 流程: 漏做提醒

```
每次 renderHygiene() 时:
  遍历今日任务模板:
    for each taskId in todayTemplate:
      if hygiene_records[today][taskId] exists → 已完成, 跳过
      if currentTime > task.deadline (默认 22:00):
        → 卡片显示为逾期状态 (红色 🔴 + "已逾期!")
        → 卡片仍可点击 [我来做] (允许补打卡，但提醒)

ponytail: 不使用 push notification / 后台定时器，
只在用户打开页面时渲染检查。
```

### 3.4 数据模型

```js
// ══ 存 AppData._data.hygiene ══
{
  // 任务模板 (admin 可编辑)
  templates: [
    {
      id: 'kitchen_clean',
      name: '厨房清洁',
      icon: '🍳',
      frequency: 'daily',       // 'daily'|'every_2_days'|'weekly'|'custom'
      frequencyDays: 1,         // 频率天数 (1/2/7)
      assignee: '砚仁',         // 默认负责人名; '轮值' = round_robin
      rewardNT: 2,
      deadline: '22:00',
      active: true
    },
    { id:'toilet_clean',  name:'厕所清洁', icon:'🚽', frequency:'daily',         frequencyDays:1, assignee:'淑惠', rewardNT:2, deadline:'22:00', active:true },
    { id:'living_tidy',   name:'客厅整理', icon:'🛋', frequency:'daily',         frequencyDays:1, assignee:'轮值', rewardNT:2, deadline:'22:00', active:true },
    { id:'yard_sweep',    name:'院子清扫', icon:'🌿', frequency:'every_2_days',  frequencyDays:2, assignee:'轮值', rewardNT:2, deadline:'22:00', active:true },
    { id:'garbage',       name:'倒垃圾',   icon:'🗑', frequency:'daily',         frequencyDays:1, assignee:'大飞', rewardNT:2, deadline:'22:00', active:true },
    { id:'corridor_mop',  name:'走廊拖地', icon:'🧹', frequency:'weekly',        frequencyDays:7, assignee:'轮值', rewardNT:3, deadline:'22:00', active:true }
  ],

  // 打卡记录
  // 结构: { '2026-07-26': { kitchen_clean: { doneBy, doneAt, note }, ... } }
  records: {
    '2026-07-26': {
      'kitchen_clean':  { doneBy:'砚仁', doneAt:'09:30', note:'' },
      'toilet_clean':   { doneBy:'淑惠', doneAt:'10:15', note:'' },
      'corridor_mop':   { doneBy:'朝林', doneAt:'08:45', note:'' }
    }
  },

  // 轮值跟踪 (per assignee='轮值' task)
  // 记录上次轮到谁，下次按顺序往下排
  roundRobin: {
    'living_tidy':  { lastAssignee:'砚仁', order:['砚仁','淑惠','朝林','大飞'] },
    'yard_sweep':   { lastAssignee:'淑惠', order:['砚仁','淑惠','朝林','大飞'] },
    'corridor_mop': { lastAssignee:'朝林', order:['砚仁','淑惠','朝林','大飞'] }
  }
}

// ══ 辅助函数: 判断某日某任务是否应执行 ══
function isTaskScheduled(task, dateStr) {
  // 基准日期: 第一次排班日期 (或 2026-07-01)
  var baseDate = '2026-07-01';
  // 从基准日期到今天的天数差
  // 如果天数差 能被 frequencyDays 整除 → 今日应执行
  // ponytail: 单行判断, 不建复杂调度库
  return (_daysBetween(baseDate, dateStr) % task.frequencyDays) === 0;
}

// ══ 辅助函数: 轮值获取今天的负责人 ══
function getRoundRobinAssignee(taskId, dateStr, roundRobin, order) {
  if (!roundRobin[taskId]) {
    roundRobin[taskId] = { lastAssignee:'', order:order };
  }
  var rr = roundRobin[taskId];
  var idx = rr.order.indexOf(rr.lastAssignee);
  var next = rr.order[(idx + 1) % rr.order.length];
  rr.lastAssignee = next;
  return next;
}
```

---

## 4. CSS 样式建议

### 4.1 新增 CSS class

所有样式在现有设计 Token 基础上扩展，注入到 `<style>` 块中。

```css
/* ══ 房间状态标签 ══ */
.inn-status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: .65rem;
  font-weight: 600;
  line-height: 1.5;
}
.inn-status--available  { background: #e8f5e8; color: var(--green-primary); }
.inn-status--occupied   { background: #fde8e8; color: var(--red); }
.inn-status--dirty      { background: #fef8e8; color: var(--amber-text); }
.inn-status--maintenance{ background: var(--gray-light); color: var(--text-muted); }

/* ══ 房间卡片增强 ══ */
.inn-room-card {
  /* 保留现有样式，增加状态左侧色条 */
  position: relative;
  overflow: hidden;
}
.inn-room-card::before {
  content: '';
  position: absolute;
  left: 0; top: 8px; bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
}
.inn-room-card.status-available::before  { background: var(--green-primary); }
.inn-room-card.status-occupied::before   { background: var(--red); }
.inn-room-card.status-dirty::before      { background: var(--amber); }
.inn-room-card.status-maintenance::before{ background: var(--text-muted); }

/* ══ 打扫队列卡片 ══ */
.clean-task-card {
  background: #fff;
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 10px;
  border: 1px solid var(--green-border);
  box-shadow: 0 1px 3px rgba(0,0,0,.03);
}
.clean-task-card.pending { border-left: 4px solid var(--amber); }
.clean-task-card.done    { border-left: 4px solid var(--green-primary); opacity: .7; }
.clean-checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: .7rem;
  color: var(--text);
  cursor: pointer;
  min-height: 40px;  /* 手指触摸最小区域 */
}
.clean-checklist-item input[type="checkbox"] {
  width: 20px; height: 20px;
  accent-color: var(--green-primary);
  cursor: pointer;
}

/* ══ 大扫除活动卡片 ══ */
.dc-card {
  background: #fff;
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 10px;
  border: 1px solid var(--green-border);
  cursor: pointer;
  transition: transform .12s;
}
.dc-card:active { transform: scale(.98); }
.dc-card-title {
  font-size: .78rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}
.dc-card-meta {
  font-size: .65rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.dc-progress-bar {
  height: 6px;
  background: var(--gray-border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}
.dc-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--green-primary), var(--green-mid));
  border-radius: 3px;
  transition: width .3s ease;
}
.dc-participants {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: .65rem;
  color: var(--text-secondary);
}
.dc-avatar-dot {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--green-bg);
  display: flex; align-items: center; justify-content: center;
  font-size: .65rem;
  border: 1.5px solid var(--green-border);
}

/* ══ 区域选择器 (大扫除) ══ */
.area-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.area-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  border: 2px solid var(--green-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: .72rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: .12s;
  min-height: 44px;
  user-select: none;
}
.area-chip:active { transform: scale(.96); }
.area-chip.selected {
  border-color: var(--green-primary);
  background: #e8f5e8;
  color: var(--green-primary);
}

/* ══ 卫生清单项 ══ */
.hygiene-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  margin-bottom: 6px;
  background: #fff;
  border-radius: var(--radius-md);
  border: 1px solid var(--green-border);
  min-height: 56px;
  transition: background .15s;
}
.hygiene-item.done {
  background: #f5faf5;
  border-color: #c8dcc8;
}
.hygiene-item.overdue {
  background: #fff8f8;
  border-color: #e8cccc;
}
.hygiene-check {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid var(--green-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: .8rem;
  cursor: pointer;
  transition: .12s;
}
.hygiene-check.done {
  background: var(--green-primary);
  border-color: var(--green-primary);
  color: #fff;
}
.hygiene-info {
  flex: 1;
  min-width: 0;
}
.hygiene-name {
  font-size: .75rem;
  font-weight: 600;
  color: var(--text);
}
.hygiene-meta {
  font-size: .62rem;
  color: var(--text-muted);
  margin-top: 2px;
}
.hygiene-action {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  background: var(--green-primary);
  color: #fff;
  font-size: .7rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  min-height: 36px;
  transition: transform .12s;
}
.hygiene-action:active { transform: scale(.96); }

/* ══ 日期滑动条 ══ */
.date-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 0;
  font-size: .78rem;
  font-weight: 700;
  color: var(--text);
  user-select: none;
}
.date-strip-arrow {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid var(--green-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  color: var(--green-primary);
  transition: transform .12s;
}
.date-strip-arrow:active { transform: scale(.9); }

/* ══ 统计条 ══ */
.stat-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fff;
  border-radius: var(--radius-md);
  margin-bottom: 10px;
  font-size: .7rem;
  color: var(--text-secondary);
  border: 1px solid var(--green-border);
}
.stat-strip .stat-value {
  font-weight: 700;
  color: var(--green-primary);
}

/* ══ Admin 底部固定按钮 ══ */
.overlay-fab {
  position: sticky;
  bottom: 0;
  padding: 12px 14px;
  padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
  background: linear-gradient(0deg, var(--green-bg) 80%, transparent);
  z-index: 5;
}
```

### 4.2 与现有组件的复用对照

| 现有组件 | 复用场景 |
|---------|---------|
| `.overlay` / `.overlay-top` / `.overlay-body` | 新增大扫除 overlay (overlayDeepClean)、卫生 overlay (overlayHygiene) |
| `.overlay-close` / `.overlay-title` | 所有 overlay 顶栏 |
| `.inn-sheet` / `.inn-sheet-card` | 入住 Sheet、退房 Sheet、大扫除详情 Sheet、发起大扫除表单 |
| `.inn-building-head` (折叠) | 房间按建筑分组折叠 |
| `.inn-room-card` | 房间卡片（加状态色条 + 新字段） |
| `.inn-stay-card` | 我的住宿申请列表 |
| `.my-fchip` / `.on` | Tab 切换（房间/我的住宿/打扫队列；进行中/即将开始/往期） |
| `.btn-sm.pri` / `.btn-sm.sec` / `.btn-sm.danger` / `.btn-sm.warn` | 所有按钮操作 |
| `.login-input` | 表单输入（排班管理输入框） |
| `showToast(msg, type)` | 所有操作反馈 |
| `.modal-overlay` / `.modal-card` | 打卡确认弹窗 |
| `.section-head` | 排班管理折叠区域 |
| `.mgmt-section` / `.mgmt-section-head` / `.mgmt-section-body` | 排班管理面板 |

### 4.3 颜色使用规范 (对齐现有 Token)

| 语义 | CSS 变量 | 使用场景 |
|-----|---------|---------|
| 可入住/完成/通过 | `--green-primary` `#3d6b52` | 状态标签、勾选框、进度条 |
| 待打扫/警告/逾期 | `--amber` `#c8892e` | 打扫队列标记、逾期提示 |
| 已入住/危险/删除 | `--red` `#b84c38` | 入住标签、逾期高亮 |
| 维修中/禁用 | `--text-muted` `#8a8a8a` | 维修状态标签 |
| 主按钮 | `.btn-sm.pri` (green-primary 渐变) | 确认入住/退房/打扫完成 |
| 次要操作 | `.btn-sm.sec` (e8f0e8) | 取消、关闭 |
| 危险操作 | `.btn-sm.danger` (fde8e8) | 标记维修、删除活动 |
| 警告操作 | `.btn-sm.warn` (fef8e8) | 催办打扫 |

---

## 附录 A: Overlay DOM 结构 (新增)

```html
<!-- ══ 大扫除 overlay ══ -->
<div id="overlayDeepClean" class="overlay">
  <div class="overlay-top">
    <button class="overlay-close" onclick="closeDeepClean()">←</button>
    <span class="overlay-title">大扫除</span>
  </div>
  <div class="overlay-body" id="deepCleanBody"></div>
</div>

<!-- ══ 大扫除详情 Sheet ══ -->
<div id="deepCleanSheet" class="inn-sheet" style="display:none"
     onclick="if(event.target===this)closeDeepCleanSheet()">
  <div class="inn-sheet-card" id="deepCleanSheetCard"></div>
</div>

<!-- ══ 日常卫生 overlay ══ -->
<div id="overlayHygiene" class="overlay">
  <div class="overlay-top">
    <button class="overlay-close" onclick="closeHygiene()">←</button>
    <span class="overlay-title">日常卫生</span>
  </div>
  <div class="overlay-body" id="hygieneBody"></div>
</div>
```

## 附录 B: 核心函数签名 (JS)

```js
// ══ 住宿管理 ══
function getRoomStatus(room)           // 降级推断房间状态
function renderInn()                   // 重写: 增加 Tab/状态标签/管理入口
function switchInnTab(tab)             // 'rooms'|'myStays'|'cleaningQueue'
function renderInnDetailSheet(bed)     // 重写: 根据 status 显示不同操作
function showCheckInSheet(bed)         // 办理入住 Sheet
function showCheckOutSheet(bed)        // 退房 Sheet
function submitCheckIn(bed)            // 确认入住
function submitCheckOut(bed)           // 确认退房
function renderCleaningQueue()         // 打扫队列
function confirmCleaning(taskId)       // 确认打扫完成

// ══ 大扫除 ══
function renderDeepClean()             // 列表 (筛选: upcoming/active/archived)
function renderDeepCleanSheet(eventId) // 详情 Sheet
function showCreateDeepClean()         // 发起表单
function submitDeepClean()             // 提交新活动
function joinDeepClean(eventId)        // 报名
function markAreaDone(eventId, areaId) // 标记区域完成
function addDiscovery(eventId)         // 添加发现
function verifyDeepClean(eventId)      // admin 验收+发 NT

// ══ 日常卫生 ══
function renderHygiene(dateStr)        // 今日清单 (默认今天)
function navigateDate(delta)           // -1 / +1 天
function confirmHygieneTask(taskId)    // 打卡确认
function renderHygieneHistory(scope)   // 'week'|'month'
function renderHygieneRoster()         // 排班管理 (admin)
function saveHygieneTemplates()        // 保存排班
```

---

## 附录 C: 实现优先级建议

| 优先级 | 模块 | 功能 | 理由 |
|-------|------|------|------|
| P0 | 住宿 | 房间状态机 + 状态标签 + 管理入口 | 核心基础设施，所有升级依赖此 |
| P0 | 住宿 | 办理入住/退房 Sheet + 数据写入 | 核心业务流程 |
| P1 | 住宿 | 打扫队列 + 打扫确认 Checklist | 退房→打扫→可入住的闭环 |
| P1 | 卫生 | 今日清单 + 打卡确认 + NT 奖励 | 独立模块，无依赖 |
| P2 | 大扫除 | 发起/报名/区域标记/验收发 NT | 依赖 cleaning 验证管道 |
| P2 | 卫生 | 历史记录 + 排班管理 | 增强功能 |
| P3 | 住宿 | 垃圾处理跟踪 + 垃圾分类 | 锦上添花 |
| P3 | 大扫除 | 发现日志 | 社交附加功能 |
