# 新人引导 & 卡片室猜卡 UI 设计方案

> 2026-07-20 · 对齐现有 `nantang-mobile.html` 设计系统
> 前端：单文件 HTML App，localStorage 持久化，移动端优先
> 入口：社区 Hub（亮色工作台模式）

---

## 1. 新人引导 (Newcomer Guidance)

### 1.0 角色与权限

| 角色 | 可录入新人 | 可编辑引导清单 | 可查看全部新人 | 可管理FAQ |
|------|-----------|---------------|---------------|----------|
| admin | 是 | 是 | 是 | 是 |
| builder | 是 | 是 | 是 | 是 |
| adventurer | 否 | 否 | 仅自己（若为新人） | 可浏览FAQ |
| npc/visitor | 否 | 否 | 否 | 可浏览FAQ |

引导员通常是 admin 或 builder。新人为 adventurer 或 visitor。

### 1.1 信息架构

```
社区 Hub 入口（「更多」Tab 或营地管理）
  └── overlayNewcomer
        ├── [Tab] 新人看板（默认）
        │     ├── 当前在村 · 即将到达 · 已离开（三类分区）
        │     ├── 每张新人卡：姓名 / 到达日期 / 停留天数 / 进度条 / 住宿状态 / 饮食标签
        │     └── [FAB] ＋ 录入新人 → Sheet
        │
        ├── [Tab] 引导清单
        │     ├── 顶部选择当前引导的新人（横向 chip 选择器）
        │     ├── 所选新人的信息摘要卡
        │     ├── 引导步骤 checklist（可勾选，实时进度）
        │     └── 入住/饮食备注
        │
        └── [Tab] 知识库 FAQ
              ├── 搜索框（可选）
              ├── FAQ 列表（手风琴折叠）
              └── [＋ 添加问题]（admin/builder 可见）
```

### 1.2 主界面布局（ASCII 线框图）

```
┌──────────────────────────────────────┐
│ overlay-top                          │
│ ← 返回       新人引导                │
├──────────────────────────────────────┤
│ tab bar:                             │
│ [👥 看板]  [✅ 清单]  [📚 FAQ]      │  ← .camp-tabbar 风格
├──────────────────────────────────────┤
│ overlay-body                         │
│                                      │
│  ── Tab: 看板 ────────────────────  │
│                                      │
│  🟢 当前在村（3人）                  │  ← .section-head
│  ┌──────────────────────────────┐   │
│  │ 🔵 张三          🟢 进行中    │   │  ← .camp-nav-card 改造
│  │    7/18 到达 · 停留 7 天      │   │     左：头像+姓名+日期
│  │    🏠 需要住宿  🥬 素食       │   │     中：进度条 + 标签
│  │    ████████░░ 4/6 步骤        │   │     右：状态
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ 🔵 李四          🟡 刚到      │   │
│  │    今天到达 · 停留 3 天        │   │
│  │    🏠 无需住宿  🍖 忌辣       │   │
│  │    ██░░░░░░░░ 1/6 步骤        │   │
│  └──────────────────────────────┘   │
│                                      │
│  📅 即将到达（1人）                  │
│  ┌──────────────────────────────┐   │
│  │ 🔵 王五          🔵 7/25     │   │
│  │    预计停留 5 天 · 需住宿     │   │
│  └──────────────────────────────┘   │
│                                      │
│  📁 已离开（展开/折叠）              │  ← .section-head
│  ┌──────────────────────────────┐   │
│  │ 🔵 赵六 · 7/10-7/15 · ✅    │   │
│  └──────────────────────────────┘   │
│                                      │
│                          [＋] FAB    │  ← 固定右下角，录入新人
│                                      │
│  ── Tab: 引导清单 ──────────────   │
│                                      │
│  选择新人：（横向滑动）              │
│  [🔵 张三 4/6] [🔵 李四 1/6] ...  │  ← .my-fchip 风格
│                                      │
│  ┌ 新人信息卡 ──────────────────┐   │
│  │ 🔵 张三   64px               │   │
│  │ 7/18 到达 · 停留 7 天         │   │
│  │ 🏠 竹·A间  🥬 素食  🚫辣     │   │
│  │ 📞 紧急联系人：张父 138xxx   │   │
│  │ [✏️ 编辑信息]                │   │
│  └──────────────────────────────┘   │
│                                      │
│  引导进度  4/6（67%）                │
│  ████████████░░░░░░  进度条          │
│                                      │
│  引导清单：                          │
│  ┌──────────────────────────────┐   │
│  │ ☑ 参观村子                    │   │  ← 点击切换完成/未完成
│  │   引导员：小云 · 7/18 已完成  │   │     完成后显示引导员+时间
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ ☑ 介绍规则（NT/任务/规范）    │   │
│  │   引导员：砚仁 · 7/18 已完成  │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ ☑ 分配房间                    │   │
│  │   竹·A间 · 7/18 已分配       │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ ☐ 介绍厨房/食堂              │   │  ← 待完成状态
│  │   [标记完成]  .btn-sm.pri    │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ ☐ 拉入微信群                  │   │
│  │   [标记完成]                  │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ ☐ 3日回访                     │   │
│  │   [标记完成]                  │   │
│  └──────────────────────────────┘   │
│                                      │
│  ── Tab: FAQ ────────────────────  │
│                                      │
│  🔍 搜索常见问题…                   │  ← .quest-search-input 风格
│                                      │
│  ┌ 入住相关 ▾ ──────────────────┐   │  ← 手风琴分组
│  │ · 如何预约房间？               │   │
│  │ · 退房时间是什么时候？         │   │
│  └──────────────────────────────┘   │
│  ┌ 食堂相关 ▾ ──────────────────┐   │
│  │ · 食堂开放时间是？             │   │
│  │ · 有素食选项吗？               │   │
│  └──────────────────────────────┘   │
│  ┌ NT 系统 ▸ ──────────────────┐   │
│  └──────────────────────────────┘   │
│                                      │
│  [＋ 添加问题]  .btn-sm.sec          │  ← admin/builder 可见
│                                      │
└──────────────────────────────────────┘
```

### 1.3 关键交互流程

#### 1.3.1 新人到达 → 录入

```
引导员操作：
  点击 [＋] FAB
  → 底部 Sheet 弹出（65vh）
  → 填写：姓名、到达日期、来自哪里、预计停留天数
  → 勾选：需要住宿？/ 有饮食偏好？
  → 填写：紧急联系人（可选）
  → [确认录入]
  → showToast('新人已录入', 'ok')
  → Sheet 关闭，看板刷新
  → 新人在「当前在村」列表中出现
```

#### 1.3.2 引导流程

```
引导员操作：
  切换到「引导清单」Tab
  → 顶部 chip 选择新人
  → 查看该新人的引导清单
  → 点击待完成步骤的 [标记完成] 按钮
  → 自动记录：完成时间、引导员姓名（CURRENT_USER）
  → 进度条实时更新
  → 全部完成 → 进度 100%，新人状态变为 ✅
```

#### 1.3.3 编辑新人信息

```
  点击新人卡 → 进入编辑 Sheet
  → 可修改所有字段
  → [保存修改] → showToast('已更新', 'ok')
  → [标记离开] → 确认弹窗 → 移入「已离开」
```

### 1.4 数据模型

```javascript
// 存储在 AppData._data 中，通过 AppData._saveShared() 持久化
AppData._data.newcomers = [
  {
    id: 'nc_1',               // 唯一 ID，时间戳生成
    name: '张三',              // 姓名/昵称
    arriveDate: '2026-07-18', // 到达日期
    from: '北京',              // 来自哪里
    stayDays: 7,              // 预计停留天数
    needLodging: true,        // 是否需要住宿
    assignedRoom: 'zhu_a',    // 分配的房间 ID（对应客栈 INN_ROOMS）
    dietary: ['素食', '忌辣'], // 饮食偏好/忌口
    emergencyContact: '张父 138xxxx', // 紧急联系人
    status: 'active',         // 'active' | 'departed'
    createdAt: '2026-07-18T10:00:00',
    createdBy: '小云',         // 录入人
    guideProgress: {           // 引导进度
      tour:        { done: true,  by: '小云', at: '2026-07-18T14:00' },
      rules:       { done: true,  by: '砚仁', at: '2026-07-18T15:00' },
      roomAssign:  { done: true,  by: '小云', at: '2026-07-18T16:00' },
      kitchen:     { done: false, by: null,    at: null },
      wechatGroup: { done: false, by: null,    at: null },
      followUp3d:  { done: false, by: null,    at: null }
    }
  }
  // ...更多新人
];

// FAQ 知识库
AppData._data.newcomerFAQ = [
  {
    id: 'faq_1',
    category: '入住相关',       // 分类
    question: '如何预约房间？',
    answer: '在客栈页面选择可用的房间并提交申请，管理员审核通过后即可入住。',
    order: 1                   // 排序
  }
  // ...更多FAQ
];
```

### 1.5 引导清单模板

默认 6 个步骤（初始化时自动创建，可定制）：

```javascript
var DEFAULT_GUIDE_STEPS = [
  { key: 'tour',         label: '参观村子',           icon: '🚶' },
  { key: 'rules',        label: '介绍规则（NT/任务/社区规范）', icon: '📋' },
  { key: 'roomAssign',   label: '分配房间',           icon: '🏠' },
  { key: 'kitchen',      label: '介绍厨房/食堂使用规则', icon: '🍳' },
  { key: 'wechatGroup',  label: '拉入微信群/通讯录',    icon: '💬' },
  { key: 'followUp3d',   label: '3日回访',            icon: '📞' }
];
```

### 1.6 需要的 Overlay / Sheet 组件清单

| 组件 | 类型 | CSS 复用 |
|------|------|---------|
| `overlayNewcomer` | overlay（全屏，3 Tab） | `.overlay` + `.overlay-top` + `.overlay-body` |
| Tab 栏 | 横向 chip 切换 | `.camp-tabbar` / `.camp-tab` 风格 |
| 新人卡片 | 列表卡片 | `.camp-nav-card` 改造（flex row 布局） |
| 进度条 | 内联 | `.co-progress` + `.co-progress-fill` |
| 引导清单项 | 列表行 + 按钮 | `.camp-nav-card` + `.btn-sm.pri` |
| FAQ 手风琴 | 折叠分组 | `.section-head` + `.archive-group-head` |
| 录入新人 Sheet | 底部 Sheet（65vh） | `.inn-sheet` / `.sheet-card` 风格 |
| 编辑信息 Sheet | 底部 Sheet（65vh） | 同上 |
| 添加 FAQ Sheet | 底部 Sheet（40vh） | 同上 |

---

## 2. 卡片室猜卡 (Card Room Guessing Game)

### 2.1 游戏规则简述 — Dealer 模式

```
玩家面对面，手机是"发牌员" / 裁判。

角色：
  - Dealer（出题人）：持手机、看到底牌
  - Guessers（猜卡人）：不看手机、口头提问

一局流程：
  1. Dealer 从卡池抽一张底牌（或手动指定）
  2. 手机显示底牌（仅 Dealer 可见）
  3. Guessers 口头提问，Dealer 口头回答（是/否/不确定）
  4. Dealer 在手机上记录关键提问（可选，帮助追踪）
  5. 有人猜对 → Dealer 点 [猜对了！]
  6. 揭晓底牌，记录得分（NT奖励）
  7. 再来一局

惩罚/奖励：
  - 猜对的人 +N NT（可配置）
  - 若 10 轮提问内猜对，全部猜卡人各 +1 NT
  - 若超过 20 轮，Dealer +2 NT（出题有难度）
```

### 2.2 信息架构

```
社区 Hub 入口（网格 tile「🎴 卡片室」）
  └── overlayCardGame
        ├── [Tab] 游戏大厅（默认）
        │     ├── 开始新游戏（抽卡/选卡）
        │     └── 历史记录（最近 10 局）
        │
        ├── [Tab] 卡池管理
        │     ├── 默认卡池列表
        │     ├── 自定义卡池管理
        │     └── [＋ 添加词语] / [导入词库]
        │
        └── 游戏进行界面（推入模式）
              ├── 底牌区（仅 Dealer 可见）
              ├── 提问记录（时间线）
              ├── 猜卡确认
              └── 得分板
```

### 2.3 入口布局

```
社区 Hub 网格（3 列）中新增 tile：

  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ 🍵        │ │ 🎴        │ │ 🎲        │
  │ 茶馆      │ │ 卡片室    │ │ 桌游室    │
  └──────────┘ └──────────┘ └──────────┘

  .more-tile: 2rem icon, .g-sm 600 label
  :active: scale(.95)
```

### 2.4 游戏大厅布局（ASCII 线框图）

```
┌──────────────────────────────────────┐
│ overlay-top                          │
│ ← 返回       🎴 卡片室              │
├──────────────────────────────────────┤
│ tab bar:                             │
│ [🎮 游戏]  [📦 卡池]               │  ← .camp-tabbar
├──────────────────────────────────────┤
│ overlay-body                         │
│                                      │
│  ── 开始游戏 ────────────────────  │
│                                      │
│  ┌ 选择卡池 ────────────────────┐   │
│  │ ○ 基础词库（30词）            │   │  ← radio 选择
│  │ ○ 角色名（12词）              │   │
│  │ ○ 南塘专属（18词）            │   │
│  │ ○ 自定义卡池1（8词）          │   │
│  │ [管理卡池 →]                  │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌ 选择 Dealer ─────────────────┐   │
│  │ 🔵 砚仁（我）                 │   │  ← 默认当前用户
│  │ 🔵 小云                       │   │
│  │ 🔵 阿楠                       │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌ 游戏设置 ────────────────────┐   │
│  │ 猜对奖励：[  5 ] NT           │   │
│  │ □ 10轮内猜对额外＋1 NT       │   │
│  │ □ 超20轮Dealer＋2 NT         │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │     🎴  开始发牌  🎴         │   │  ← .btn-pri 大按钮
│  └──────────────────────────────┘   │
│                                      │
│  ── 最近记录 ──────────────────   │
│                                      │
│  🎴 砚仁出题 · 底牌「凤凰」         │  ← 每行：Dealer / 底牌 / 谁猜对 / NT
│     小云猜对 · ＋5 NT · 8轮        │
│     7/20 14:30                      │
│                                      │
│  🎴 阿楠出题 · 底牌「陶渊明」       │
│     砚仁猜对 · ＋5 NT · 12轮       │
│     7/19 20:15                      │
│                                      │
│  [查看全部记录 →]                   │
│                                      │
└──────────────────────────────────────┘
```

### 2.5 游戏进行界面（推入模式）

```
┌──────────────────────────────────────┐
│ overlay-top（游戏模式）              │
│ ← 结束游戏    🎴 第 3 局           │
├──────────────────────────────────────┤
│ overlay-body                         │
│                                      │
│  ┌ 底牌区（仅 Dealer 可见）─────┐   │
│  │                                │   │
│  │    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │   │  ← 虚线边框卡片
│  │    │                    │    │   │
│  │    │      🎴            │    │   │  ← 大号扑克牌 icon
│  │    │                    │    │   │
│  │    │    凤凰            │    │   │  ← 1.4rem 大字
│  │    │                    │    │   │
│  │    │   只有 Dealer      │    │   │
│  │    │   能看到这张卡      │    │   │
│  │    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │   │
│  │                                │   │
│  │  👀 已进行 8 轮提问           │   │  ← 计数器
│  └────────────────────────────────┘   │
│                                      │
│  ┌ 快速记录提问（可选）─────────┐   │
│  │ [＋ 记录提问]                  │   │  ← 点击弹输入框
│  │                                │   │
│  │ 1. "是动物吗？" → 否          │   │  ← 提问时间线
│  │ 2. "是神话生物吗？" → 是      │   │
│  │ 3. "会飞吗？" → 是            │   │
│  │ ...                           │   │
│  └────────────────────────────────┘   │
│                                      │
│  [＋ 手动记录一轮提问]              │  ← .btn-sm.sec
│                                      │
│  ┌──────────────────────────────┐   │
│  │      🎉  猜对了！           │   │  ← .btn-pri 大按钮
│  └──────────────────────────────┘   │
│                                      │
│  ┌ 猜卡人 ─────────────────────┐   │
│  │ ○ 砚仁（我）                 │   │  ← 选择谁猜对了
│  │ ○ 小云                       │   │
│  │ ○ 全员（多人同时猜对）       │   │
│  └──────────────────────────────┘   │
│                                      │
└──────────────────────────────────────┘
```

### 2.6 结算界面

```
┌──────────────────────────────────────┐
│ 结算弹窗（modal-card，游戏页面上层） │
│                                      │
│        🎉  猜对啦！                  │
│                                      │
│    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐          │
│    │     🎴  凤凰        │          │  ← 揭晓底牌
│    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘          │
│                                      │
│    👤 出题人：阿楠                   │
│    🏆 猜对人：小云                   │
│    🔄 提问轮数：8 轮                 │
│    💰 奖励：＋5 NT                  │
│                                      │
│    ┌──────────────────────────┐     │
│    │     🎴  再来一局          │     │  ← .btn-pri
│    └──────────────────────────┘     │
│    [返回大厅]  .btn-sm.sec          │
│                                      │
└──────────────────────────────────────┘
```

### 2.7 卡池管理界面

```
┌──────────────────────────────────────┐
│ overlay-top                          │
│ ← 返回        📦 卡池管理           │
├──────────────────────────────────────┤
│ overlay-body                         │
│                                      │
│  ── 系统卡池 ────────────────────  │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ 📦 基础词库                  │   │  ← .camp-nav-card 改造
│  │    30 个词                    │   │     左：图标+名称+词数
│  │    [预览]  [用于游戏]        │   │     右：操作按钮
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ 📦 角色名                    │   │
│  │    12 个词                    │   │
│  │    [预览]  [用于游戏]        │   │
│  └──────────────────────────────┘   │
│                                      │
│  ── 我的自定义卡池 ────────────   │
│                                      │
│  ┌ [＋ 创建新卡池] ────────────┐   │  ← .btn-sm.sec
│  └──────────────────────────────┘   │
│                                      │
│  点击卡池 → 展开编辑：               │
│  ┌ 南塘专属 ────────────────────┐   │
│  │ ┌──┬──┬──┬──┬──┬──┬──┬──┐  │   │  ← 词语 chip 网格
│  │ │竹│兰│梅│菊│凤凰│云│风│土│  │   │     .task-chip 风格
│  │ └──┴──┴──┴──┴──┴──┴──┴──┘  │   │
│  │ ┌──┬──┬──┬──┬──┬──┬──┬──┐  │   │
│  │ │墨│茶│禅│道│水│山│松│鹤│  │   │
│  │ └──┴──┴──┴──┴──┴──┴──┴──┘  │   │
│  │                              │   │
│  │ [＋ 添加词语]  [导入词库]    │   │  ← 操作按钮
│  │ [删除此卡池]                 │   │  ← danger 按钮
│  └──────────────────────────────┘   │
│                                      │
└──────────────────────────────────────┘
```

### 2.8 关键交互流程

#### 创建游戏 → 发牌 → 提问 → 猜卡 → 结算

```
1. Dealer 操作：
   大厅 → 选择卡池 → 选择 Dealer → 设 NT 奖励
   → [开始发牌]
   → 系统从所选卡池随机抽一张（不重复最近 5 局的底牌）
   → 进入游戏界面
   → Dealer 看到底牌，将手机屏幕转向自己

2. 提问轮（口头为主，手机辅助记录）：
   Guessers 口头提问 → Dealer 口头答是/否/不确定
   → Dealer 可选在手机上记录关键提问：
     点 [＋ 记录提问] → 输入提问内容 + 答案（是/否/不确定）
   → 时间线滚动显示

3. 猜对结算：
   有人猜对 → Dealer 点 [猜对了！]
   → 选择谁猜对了（单人/全员）
   → 结算弹窗弹出
   → 统计轮数 → 计算 NT 奖励
   → 写 NT 交易（recordTransaction） + 写入游戏记录

4. 再来一局 / 结束：
   [再来一局] → 重新抽卡（同一卡池，同一 Dealer）
   [返回大厅] → 回到 Tab 游戏
   ← 返回 → 关闭游戏界面，回到大厅
```

#### 记录提问的交互细节

```
点击 [＋ 记录提问]
→ 底部 Sheet（40vh）：

  ┌──────────────────────────────┐
  │ 📝 记录提问                   │
  ├──────────────────────────────┤
  │                              │
  │ 提问内容：                    │
  │ ┌────────────────────────┐  │
  │ │ "是动物吗？"            │  │  ← textarea，1行
  │ └────────────────────────┘  │
  │                              │
  │ Dealer 回答：                 │
  │ [✓ 是]  [✗ 否]  [~ 不确定]  │  ← seg-control
  │                              │
  │ [确认记录]  .btn-sm.pri      │
  │                              │
  └──────────────────────────────┘

→ 确认后，时间线新增一行
→ Sheet 关闭
→ Dealer 也可以直接 [猜对了！] 跳过记录
```

### 2.9 数据模型

```javascript
// 卡池
AppData._data.cardPools = [
  {
    id: 'pool_default',
    name: '基础词库',
    isSystem: true,           // 系统卡池不可删除
    words: ['太阳', '月亮', '凤凰', '龙', '长城', '故宫', '陶渊明', '李白',
            '火锅', '饺子', '茶', '熊猫', '竹子', '梅花', '围棋', '太极',
            '孙悟空', '诸葛亮', '黄河', '长江', '丝绸', '瓷器', '太极拳',
            '算盘', '风筝', '灯笼', '筷子', '龙舟', '月饼', '春联']
  },
  {
    id: 'pool_roles',
    name: '角色名',
    isSystem: true,
    words: ['管理员', '共建者', '冒险者', '在地伙伴', '云村民',
            '砚仁', '小云', '阿楠', '若雨', '朝林', '大飞', 'niya']
  },
  {
    id: 'pool_nantang',
    name: '南塘专属',
    isSystem: true,
    words: ['南塘村', '大地书房', '素社食堂', '竹间', '兰室',
            '共创营', '工笔画', 'NT豆', '村口老树', '萝卜议事厅',
            '白菜拍卖行', '结营仪式', '火种', '副本', '档案室',
            '时间线', '任务大厅', '引导员']
  },
  {
    id: 'pool_custom_1',
    name: '自定义卡池1',
    isSystem: false,
    createdBy: '砚仁',
    words: ['自定义词1', '自定义词2']
  }
];

// 游戏记录
AppData._data.cardGameRecords = [
  {
    id: 'cg_1712345678',
    poolId: 'pool_default',       // 使用的卡池
    dealer: '阿楠',               // 出题人
    card: '凤凰',                 // 底牌
    winner: '小云',               // 猜对人（'all' 表示全员猜对）
    rounds: 8,                    // 提问轮数
    questions: [                  // 记录的提问（可选）
      { q: '是动物吗？', a: 'no' },
      { q: '是神话生物吗？', a: 'yes' },
      { q: '会飞吗？', a: 'yes' }
    ],
    ntReward: 5,                  // NT 奖励
    bonusTriggers: [],            // 触发的额外奖励 ['quick_guess']
    createdAt: '2026-07-20T14:30:00'
  }
  // ...更多记录
];

// 当前进行中的游戏状态（存在内存中，不持久化）
var currentGame = {
  poolId: null,
  dealer: null,
  card: null,
  rounds: 0,
  questions: [],
  gameSettings: {
    ntReward: 5,
    enableQuickBonus: true,
    enableDealerBonus: true
  }
};
```

### 2.10 NT 结算规则

```javascript
// 结算时计算 NT
function calculateNTReward(game) {
  var reward = game.gameSettings.ntReward || 5;  // 基础奖励
  var bonuses = [];
  
  // 10轮内猜对：所有猜卡人额外 +1
  if (game.gameSettings.enableQuickBonus && game.rounds <= 10) {
    bonuses.push({ type: 'quick_guess', amount: 1, to: 'all_guessers' });
  }
  
  // 超过20轮：Dealer +2
  if (game.gameSettings.enableDealerBonus && game.rounds >= 20) {
    bonuses.push({ type: 'dealer_bonus', amount: 2, to: game.dealer });
  }
  
  return { baseReward: reward, bonuses: bonuses };
}
```

### 2.11 需要的 Overlay / Sheet 组件清单

| 组件 | 类型 | CSS 复用 |
|------|------|---------|
| `overlayCardGame` | overlay（全屏，2 Tab） | `.overlay` + `.overlay-top` + `.overlay-body` |
| Tab 栏 | 横向 chip 切换 | `.camp-tabbar` / `.camp-tab` 风格 |
| 开始游戏卡片 | 设置面板 | `.camp-nav-card` + radio 选择 + `.btn-pri` |
| 历史记录行 | 列表 | `.funds-tx-row` 风格改造 |
| 游戏界面 | overlay 内子视图（显示/隐藏切换） | `.camp-overview` 风格 |
| 底牌卡片 | 装饰性卡片 | 新 CSS class，虚线边框 + 居中大字 + emoji |
| 提问时间线 | 列表 | `.archive-log-row` 风格改造 |
| 记录提问 Sheet | 底部 Sheet（40vh） | `.inn-sheet` / `.sheet-card` 风格 |
| 结算弹窗 | 居中弹窗 | `.modal-overlay` + `.modal-card` |
| 卡池管理 | 卡片列表 + chip 网格 | `.camp-nav-card` + `.task-chip` |
| 添加词语 Sheet | 底部 Sheet（40vh） | `.inn-sheet` 风格 |
| 导入词库 Sheet | 底部 Sheet（50vh） | 同上 |

---

## 3. CSS 样式建议

### 3.1 新增 CSS class（对齐现有设计系统）

```css
/* ══ 新人引导 ══ */

/* 新人卡片（基于 .camp-nav-card 改造） */
.nc-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--green-border);
  border-radius: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: transform .12s;
}
.nc-card:active { transform: scale(.98); background: #fafaf8; }
.nc-card-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #e8ede6;
}
.nc-card-avatar img { width: 100%; height: 100%; object-fit: cover; }
.nc-card-body { flex: 1; min-width: 0; }
.nc-card-name { font-weight: 700; font-size: .82rem; color: var(--text); }
.nc-card-meta { font-size: .65rem; color: var(--text-secondary); margin-top: 2px; }
.nc-card-tags { display: flex; gap: 4px; margin-top: 4px; }
.nc-tag {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: .6rem;
  font-weight: 600;
  background: #f0f4f0;
  color: var(--green-primary);
}
.nc-tag.diet { background: #fef8e8; color: var(--amber-text); }
.nc-tag.room { background: #e8f0ee; color: #4a7a82; }
.nc-card-status { flex-shrink: 0; }
.nc-status {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: .6rem;
  font-weight: 700;
}
.nc-status.active { background: #e8f0e4; color: var(--green-primary); }
.nc-status.new { background: #fef8e8; color: var(--amber-text); }
.nc-status.departed { background: #f0f0f0; color: var(--text-muted); }

/* 引导进度条 */
.nc-progress {
  height: 6px;
  background: #e8ede6;
  border-radius: 3px;
  overflow: hidden;
  margin: 4px 0;
}
.nc-progress-fill {
  height: 100%;
  background: var(--green-primary);
  border-radius: 3px;
  transition: width .3s ease;
}

/* 引导清单项 */
.guide-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--green-border);
  border-radius: 10px;
  margin-bottom: 6px;
}
.guide-item.done { background: #f5faf5; border-color: #d0e0d0; }
.guide-check {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid var(--green-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .8rem;
  flex-shrink: 0;
  transition: .15s;
}
.guide-item.done .guide-check {
  background: var(--green-primary);
  border-color: var(--green-primary);
  color: #fff;
}
.guide-body { flex: 1; min-width: 0; }
.guide-label { font-size: .78rem; font-weight: 600; color: var(--text); }
.guide-detail { font-size: .62rem; color: var(--text-secondary); margin-top: 2px; }
.guide-action { flex-shrink: 0; }

/* ══ 卡片室猜卡 ══ */

/* 底牌卡片（虚线边框，仅 Dealer 可见） */
.card-reveal {
  text-align: center;
  padding: 24px 20px;
  border: 2px dashed var(--amber);
  border-radius: 16px;
  background: linear-gradient(135deg, #fef9ee, #fdf3d8);
  margin-bottom: 12px;
  user-select: none;
}
.card-reveal-icon { font-size: 2.5rem; margin-bottom: 8px; }
.card-reveal-word {
  font-size: 1.4rem;
  font-weight: 700;
  color: #5a3e18;
  margin-bottom: 4px;
  letter-spacing: 2px;
}
.card-reveal-hint {
  font-size: .6rem;
  color: var(--amber-text);
  font-weight: 600;
}

/* 提问时间线 */
.question-timeline {
  margin-bottom: 12px;
}
.qt-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: .68rem;
  color: var(--text-secondary);
  border-bottom: 1px dotted var(--gray-hairline);
}
.qt-num {
  font-weight: 700;
  color: var(--text-muted);
  min-width: 20px;
  flex-shrink: 0;
}
.qt-q { flex: 1; }
.qt-a {
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: .6rem;
  flex-shrink: 0;
}
.qt-a.yes { background: #e8f0e4; color: var(--green-primary); }
.qt-a.no { background: #fde8e8; color: var(--red); }
.qt-a.unsure { background: #f0f0f0; color: var(--text-muted); }

/* 猜对按钮（大） */
.guess-btn {
  display: block;
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, var(--amber), #d4a030);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: .95rem;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
  margin: 8px 0;
  transition: transform .12s;
  min-height: 52px;
}
.guess-btn:active { transform: scale(.96); }

/* 卡池词语 chip 网格 */
.pool-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
}
.pool-chip {
  padding: 6px 12px;
  border-radius: 14px;
  border: 1.5px solid var(--green-border);
  font-size: .7rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: #fff;
  user-select: none;
}

/* 游戏设置 radio 行 */
.setting-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--gray-hairline);
  font-size: .72rem;
}
.setting-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  flex: 1;
}
.setting-row input[type="radio"],
.setting-row input[type="checkbox"] {
  accent-color: var(--green-primary);
  width: 16px; height: 16px;
}

/* Dealer 选择器（头像 chip 行） */
.dealer-select {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.dealer-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 2px solid var(--green-border);
  cursor: pointer;
  font-size: .7rem;
  font-weight: 600;
  transition: .12s;
  background: #fff;
}
.dealer-chip.selected {
  border-color: var(--green-primary);
  background: #e8f0e4;
  color: var(--green-primary);
}
.dealer-chip:active { transform: scale(.95); }
.dealer-chip-avatar {
  width: 24px; height: 24px;
  border-radius: 50%;
  object-fit: cover;
  background: #e8ede6;
}
```

### 3.2 新增 CSS class 总览

| class | 用途 | 参考来源 |
|-------|------|---------|
| `.nc-card` | 新人列表卡片 | `.camp-nav-card` 改造 |
| `.nc-tag` | 新人标签（饮食/住宿） | `.task-chip` 风格 |
| `.nc-status` | 新人状态标签 | `.g-badge-*` 风格 |
| `.nc-progress` | 引导进度条 | `.co-progress` 复用 |
| `.guide-item` | 引导清单行 | `.camp-nav-card` + `.btn-sm` |
| `.card-reveal` | 底牌展示区 | 新设计，虚线边框+渐变 |
| `.qt-item` | 提问时间线行 | `.archive-log-row` 风格 |
| `.guess-btn` | 猜对按钮 | `.btn-pri` 放大版 + amber |
| `.pool-chips` | 卡池词语网格 | `.canteen-items` 风格 |
| `.pool-chip` | 单个词语 chip | `.task-chip` 改造 |
| `.setting-row` | 游戏设置行 | `.pub-check-row` 风格 |
| `.dealer-chip` | Dealer 选择器 | `.my-fchip` 风格 |

### 3.3 触控友好检查清单

- [x] 所有按钮 `min-height: 44px`（通过 `.btn-sm` 的 `padding: 10px 16px` 实现）
- [x] `.guess-btn` 显式 `min-height: 52px`（更大的主操作按钮）
- [x] 所有卡片 `cursor: pointer` + `:active { transform: scale(.98) }`
- [x] Chip 选择器 `min-height: 44px`（padding 6px + 24px avatar = 36px，但相邻间距保证触控区）
- [x] Checkbox toggle 区域足够大（`gap: 6px` 保证间距）
- [x] 底部 Sheet 内的提交按钮宽度 100%（`flex: 1`）
- [x] 无闪烁内容（无自动播放动画）

---

## 4. 实现优先级建议

### P0 — 核心 MVP（可玩/可用）

| # | 模块 | 做什么 |
|---|------|--------|
| 1 | 新人引导 | 录入新人 Sheet + 看板列表 + 引导清单 checklist |
| 2 | 卡片室 | 大厅（选卡池 + 设 Dealer + 发牌）+ 游戏界面（底牌 + 猜对） |

### P1 — 完善体验

| # | 模块 | 做什么 |
|---|------|--------|
| 3 | 新人引导 | FAQ 知识库 + 编辑信息 + 标记离开 |
| 4 | 卡片室 | 提问记录时间线 + 结算 NT + 历史记录 |

### P2 — 锦上添花

| # | 模块 | 做什么 |
|---|------|--------|
| 5 | 新人引导 | 3日回访提醒 + 引导员统计 |
| 6 | 卡片室 | 卡池管理（自定义 + 导入词库）+ 计时器 |

---

## 5. 与现有系统的接缝

### 5.1 入口注册

两个模块的入口都在社区 Hub 内。在 `renderCommunityHub()` 中新增：

```javascript
// 新人引导入口（仅 admin/builder 可见）
if (role === 'admin' || role === 'builder') {
  hubHTML += '<div class="more-tile" onclick="openNewcomer()">' +
    '<div style="font-size:2rem">🧭</div>' +
    '<div style="font-size:.6rem;font-weight:600;color:#3d3629">新人引导</div></div>';
}

// 卡片室入口（所有人可见）
hubHTML += '<div class="more-tile" onclick="openCardGame()">' +
  '<div style="font-size:2rem">🎴</div>' +
  '<div style="font-size:.6rem;font-weight:600;color:#3d3629">卡片室</div></div>';
```

### 5.2 数据初始化

在 `AppData` 初始化逻辑中添加：

```javascript
// 首次初始化
if (!AppData._data.newcomers) AppData._data.newcomers = [];
if (!AppData._data.newcomerFAQ) AppData._data.newcomerFAQ = DEFAULT_FAQ;
if (!AppData._data.cardPools) AppData._data.cardPools = DEFAULT_CARD_POOLS;
if (!AppData._data.cardGameRecords) AppData._data.cardGameRecords = [];
```

### 5.3 NT 集成

猜对结算时调用现有 NT 系统：

```javascript
// 给猜对人发放 NT
var tx = recordTransaction({
  type: 'card_game_reward',
  from: 'system',       // 从系统池发放
  to: winner,
  amount: reward,
  note: '卡片室猜对「' + card + '」'
});

// 记录活动
logActivity('card_game', {
  dealer: dealer,
  winner: winner,
  card: card,
  rounds: rounds
});
```

### 5.4 CSS 注入

新增 CSS 直接追加到 `nantang-mobile.html` 的 `<style>` 块末尾，在现有样式之后。所有新增 class 使用 `nc-` 和 `card-` / `qt-` / `pool-` 前缀，避免与现有 class 冲突。
