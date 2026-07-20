---
version: 1.0
name: 南塘云村 · Nantang Cloud Village
description: >
  一个融合线下社区与游戏化体验的移动端 Web 应用。视觉基调：墨绿底的村庄入口（暗色、毛玻璃、
  漂浮粒子），进入工作台后切换为浅绿灰的明亮空间。整体风格温和、手工感、去工业化——
  圆角主导、无硬直边、绿色梯度按钮、DiceBear 插画头像。
  Two-mode: dark village landing (frosted glass, floating particles) →
  light workbench (warm green-gray, clean task cards).
---

## Colors

```yaml
# ── 品牌色（Brand） ──
brand-primary:        "#3d6b52"   # 深橄榄绿 — 主按钮、选中态、头像边框
brand-primary-dark:   "#2a4d3a"   # 暗绿 — 按钮渐变终点
brand-primary-light:  "#5a8a6e"   # 中绿 — hover、链接、次要强调
brand-gold:           "#c88740"   # 暖金 — 管理员头像边框、特殊标记
brand-amber:          "#c8892e"   # 琥珀 — 冻结 NT 卡片、结算按钮

# ── 背景色（Background） ──
bg-village:           "#1d2e24"   # 村口页面底色 — 墨绿黑
bg-workspace:         "#e8ede6"   # 工作台底色 — 浅绿灰
bg-login-overlay:     "rgba(18,28,20,.92)"  # 登录卡片底色
bg-card:              "#ffffff"   # 卡片底色
bg-surface-soft:      "#f7f7f7"   # 浅灰底
bg-glass:             "rgba(255,255,255,.14)"  # 毛玻璃（村口玩家卡）
bg-glass-card:        "rgba(255,255,255,.80)"  # 毛玻璃（滑动卡片）

# ── 文字色（Text） ──
text-primary:         "#1d2e24"   # 主文字（浅色背景上）
text-secondary:       "#5a6e5c"   # 次要文字
text-muted:           "#8a8a8a"   # 弱化文字
text-on-dark:         "#ffffff"   # 暗色背景上的文字
text-on-dark-muted:   "rgba(255,255,255,.65)"  # 暗色背景弱化文字
text-brand:           "#a0c8a8"   # 暗色背景品牌文字

# ── 边框色（Border） ──
border-default:       "#d0d9ce"   # 默认边框
border-light:         "#e0e0e0"   # 浅边框
border-hairline:      "#f0f0f0"   # 极浅分割线
border-glass:         "rgba(255,255,255,.22)"  # 毛玻璃边框

# ── 语义色（Semantic） ──
danger:               "#b84c38"   # 红色 — 角标、删除、错误
danger-light:         "#d46048"   # 浅红 — 错误提示
success:              "#3d6b52"   # 绿色 — 成功（复用 primary）
warning-bg:           "#fff8e8"   # 浅黄底 — 结算提示
```

## Typography

```yaml
fontFamily: "system-ui, -apple-system, 'Noto Sans SC', sans-serif"
baseSize: 16px

scale:
  display-lg:   { size: "1.6rem", weight: 700, lineHeight: 1.2 }   # NT 余额大数字
  display-md:   { size: "1.2rem", weight: 700, lineHeight: 1.3 }   # 卡片金额
  title-lg:     { size: "1.1rem", weight: 600, lineHeight: 1.4 }   # 页面标题
  title-md:     { size: "1rem",   weight: 700, lineHeight: 1.4 }   # 卡片标题
  title-sm:     { size: "0.9rem", weight: 700, lineHeight: 1.4 }   # 按钮文字
  body:         { size: "0.85rem",weight: 400, lineHeight: 1.5 }   # 正文
  body-sm:      { size: "0.78rem",weight: 400, lineHeight: 1.5 }   # 列表项
  caption:      { size: "0.72rem",weight: 400, lineHeight: 1.4 }   # 辅助说明
  caption-sm:   { size: "0.65rem",weight: 400, lineHeight: 1.4 }   # 标签、日期
  micro:        { size: "0.55rem",weight: 700, lineHeight: 1.2 }   # 角标数字
```

## Spacing

```yaml
space-xs:   4px    # 图标内边距、紧凑间隙
space-sm:   6px    # 卡片内间距、按钮组间隙
space-md:   10px   # 标准内边距、头像间距
space-lg:   16px   # 卡片间距、段落间距
space-xl:   24px   # 页面内边距
space-2xl:  32px   # 大区块间距
```

## Border Radius

```yaml
rounded-full:   9999px   # 药丸形 — 搜索栏、玩家卡片、chip 标签
rounded-circle: 50%      # 正圆 — 头像
rounded-xl:     20px     # 大圆角 — 登录卡片、弹窗
rounded-lg:     16px     # 中圆角 — 资料卡、结算弹窗
rounded-md:     12px     # 标准圆角 — 卡片、输入框、按钮
rounded-sm:     8px      # 小圆角 — 小型按钮
```

## Shadows

```yaml
shadow-card:     "0 8px 32px rgba(0,0,0,.1)"       # 滑动卡片
shadow-float:    "0 4px 20px rgba(0,0,0,.35)"      # 村口玩家卡（悬浮感）
shadow-modal:    "0 16px 48px rgba(0,0,0,.3)"      # 弹窗
shadow-button:   "none"                              # 按钮无阴影（扁平）
```

## Two-Mode System

本应用有两套视觉模式，通过页面切换自然过渡：

### Mode 1: Village（村口 · 暗色）

```yaml
background:    "#1d2e24"     # 墨绿底
surface:       "毛玻璃"       # backdrop-filter: blur(16-20px)
text:          "#ffffff"     # 白色文字
cards:         "rgba(255,255,255,.14-.80)"  # 半透明毛玻璃卡片
decorations:   "漂浮粒子动画"  # CSS floatUp 动画
```

用于：登录页、村口页（三卡滑动 + 底部玩家卡）

### Mode 2: Workspace（工作台 · 亮色）

```yaml
background:    "#e8ede6"     # 浅绿灰底
surface:       "#ffffff"     # 白卡片
text:          "#1d2e24"     # 深色文字
borders:       "#d0d9ce"     # 浅绿边框
tabs:          sticky bottom, glass morphism
```

用于：任务列表、账本、物品、个人资料、任务大厅

## Components

### Button（按钮）

```yaml
# 主按钮（Primary）
btn-pri:
  background: "linear-gradient(135deg, #3d6b52, #2a4d3a)"
  color: "#ffffff"
  padding: "14px 24px"
  borderRadius: "{rounded-sm}"
  fontSize: "{title-sm}"
  fontWeight: 700
  minWidth: 130px

# 次级按钮（Secondary）
btn-sec:
  background: "transparent"
  color: "{text-secondary}"
  border: "1px solid {border-default}"
  borderRadius: "{rounded-sm}"

# 小按钮
btn-sm:
  padding: "6px 12px"
  fontSize: "{caption}"
  borderRadius: "{rounded-sm}"

# 毛玻璃按钮（村口）
btn-glass:
  background: "rgba(0,0,0,.06)"
  color: "#3d3629"
  borderRadius: "{rounded-md}"

# 危险按钮
btn-danger:
  background: "{danger}"
  color: "#ffffff"
```

### Card（卡片）

```yaml
# 任务卡片
task-card:
  background: "{bg-card}"
  border: "1px solid {border-default}"
  borderRadius: "{rounded-md}"
  padding: "14px"
  leftBorder: "3px solid" — 主线绿 / 支线琥珀 / 日常蓝灰

# 滑动卡片（村口）
vp-card:
  background: "{bg-glass-card}"
  backdropFilter: "blur(18px)"
  borderRadius: "18px"
  width: 260px
  height: 270px

# 玩家卡片（村口底部）
spc-card:
  background: "{bg-glass}"
  backdropFilter: "blur(16px)"
  borderRadius: "28px"
  display: flex, avatar 38px + name
  floating animation: cardFloat 3s ease-in-out infinite

# 弹窗卡片
modal-card:
  background: "{bg-card}"
  borderRadius: "{rounded-xl}"
  maxWidth: 300px (mobile), 90vw fallback
  shadow: "{shadow-modal}"
```

### Input（输入框）

```yaml
input:
  background: "{bg-card}"
  border: "1px solid {border-default}"
  borderRadius: "{rounded-md}"
  padding: "10px 14px"
  fontSize: "{body-sm}"
  color: "{text-primary}"
  focus: "border-color → {brand-primary}"

# 登录态输入框
input-login:
  background: "rgba(255,255,255,.08)"
  border: "2px solid rgba(255,255,255,.2)"
  color: "{text-on-dark}"
  textAlign: center
```

### Avatar（头像）

```yaml
# 统一使用 DiceBear API
url: "https://api.dicebear.com/7.x/avataaars/svg?seed={name}&size={size}"

sizes:
  avatar-sm:  { size: 28px, border: "2px solid {brand-primary}" }
  avatar-md:  { size: 40px, border: "2.5px solid {brand-primary}" }
  avatar-lg:  { size: 56px, border: "2.5px solid {brand-primary}" }
  avatar-xl:  { size: 96px }

# 角色边框色
avatar-role-admin:      border-color "{brand-gold}"
avatar-role-builder:    border-color "#5d8c52"
avatar-role-adventurer: border-color "#4a7a82"
```

### Tab Bar（底部导航）

```yaml
tab-bar:
  position: fixed, bottom
  background: "rgba(242,245,241,.96)"
  backdropFilter: "blur(12px)"
  borderTop: "1px solid {border-default}"
  height: ~56px + safe-area-inset-bottom

tab-item:
  flex: 1
  padding: 8px
  borderRadius: "{rounded-md}"
  fontSize: "{body-sm}"
  fontWeight: 700
  color: "{text-secondary}"
  active:
    background: "{brand-primary}"
    color: "#ffffff"
```

### Chip / Filter（筛选标签）

```yaml
chip:
  padding: "6px 14px"
  borderRadius: "14px"
  border: "1.5px solid {border-default}"
  fontSize: "{body-sm}"
  fontWeight: 600
  color: "{text-secondary}"
  background: "{bg-card}"
  active:
    background: "{brand-primary}"
    color: "#ffffff"
    borderColor: "{brand-primary}"
```

### Role Icons（角色图标）

```yaml
# 全局 roleIcon() / roleName() 映射
role-admin:       { icon: "🛡️", name: "管理员" }
role-builder:     { icon: "🧱", name: "共建者" }
role-adventurer:  { icon: "⚔️", name: "冒险者" }
role-npc:         { icon: "🏠", name: "在地伙伴" }
role-visitor:     { icon: "☁️", name: "云村民" }
```

## Animation

```yaml
transition:
  fast:    ".15s ease-out"     # 按钮 hover、chip 切换
  normal:  ".2s ease-out"      # 卡片展开、弹窗出现
  slow:    ".25s ease-out"     # 资料卡弹出

keyframes:
  fadeIn:       opacity 0→1
  spcPop:       scale(.9)→1 + opacity 0→1 (弹窗弹出)
  cardFloat:    上下浮动 4px, 3s 循环 (村口玩家卡)
  floatUp:      粒子从底部升起 (村口背景装饰)
```

## Page Layout

```yaml
# 移动端优先，全屏沉浸
maxWidth: 100vw
height: 100vh (overflow hidden)

pages:
  - loginPage:   全屏暗色毛玻璃登录/注册
  - villagePage: 全屏暗色，滑动卡片 + 底部玩家卡
  - myPage:      全屏亮色，sticky topbar + 内容区 + 底部 tab bar
  - overlays:    全屏覆盖 (社区副本/任务大厅/地图/发布表单)

safe-area: 使用 env(safe-area-inset-*) 适配刘海屏
```

## Data-Driven UI

```yaml
# 以下 UI 元素必须从数据源动态渲染（禁止硬编码）：
dynamic-elements:
  - 用户名 / 头像 seed       → CURRENT_USER / getUsers()
  - 角色名 / 角色图标        → roleIcon() / roleName()
  - NT 余额                 → NT.getUser(CURRENT_USER).ntBalance
  - 冻结 NT                 → sum(TASKS 中未结算任务，发布者=CURRENT_USER)
  - 营期名称                → AppData.me('camp')
  - 注册日期                → AppData.me('created') || getUsers()[u].created
  - 村口委托数               → AppData.taskMarket().length
  - 待处理角标               → AppData.myPendingCount()
  - 任务列表                 → renderMyTasks() 按 CURRENT_USER 过滤
  - 最近动态                 → AppData.myActivityLog() (Phase §2)

# 单一刷新入口
refresh-entry: refreshUserUI()
callsites: enterVillage(), showMy(), AppData.switchUser(), saveProfileEdits()
```
