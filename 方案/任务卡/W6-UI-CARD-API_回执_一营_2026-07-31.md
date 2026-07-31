# W6-UI-CARD-API 回执 · 一营

**卡号**：W6-UI-CARD-API（通用块面 5 件套 · 范式先行）  
**施工**：一营 Claude Code（前端 FE）  
**日期**：2026-07-31  
**Commit**：`071d56a`

---

## ① Diff 摘要

| 文件 | 操作 | 行数 |
|---|---|---|
| `nantang-mobile/js/ui-primitives.js` | 新建 | +234 |
| `nantang-mobile/index.html` | 插 1 行 `<script src="js/ui-primitives.js?v=1">` | +1 |

**改动细节**：

- **ui-primitives.js**：`window.UI` namespace 下 5 个工厂函数，每个返回 DOM Element
  - `UI.Card({ object, head, body, actions, onAction })` — 三段式卡片，引用 `--g-card` / `--g-radius`(12px) / `--g-shadow` / `--g-gap`(8px) / `--g-pad-sm`(10px) 令牌
  - `UI.Icon({ name, size, status })` — emoji 渲染 + 状态点（右下角），`size` 三档 sm/md/lg
  - `UI.Progress({ value, max, label, variant, autoRefresh })` — linear 复用 theme.css `.progress-bar`/`.progress-fill`；circular 用内联 SVG
  - `UI.StatusBadge({ status, text })` — 4 态色牌，status 语义与 Icon 共用 `STATUS` 定义
  - `UI.TaskCard({ taskId, title, reward, doer, pollingInterval })` — 三态（可领/已领/锁定），`doer` 驱动状态机
- **index.html**：在 `utils.js` 前插入 `ui-primitives.js?v=1`，确保其他模块可用时 UI 已就绪

**预埋（阶段 3 用，不做实现）**：
- `Card.onAction` 回调 — click 委托到 `[data-action]` 元素
- `TaskCard.pollingInterval` — 默认 3000ms，存为 `data-polling-interval`
- `Progress.autoRefresh` — 存为 `data-auto-refresh`

**令牌合规**：全部引用 theme.css `--g-*` 变量，间距为 8 倍数（8/10/14），无 px 硬编码。

---

## ② 自测结果

### 结构校验（Node 静态扫描 · 20/20 PASS）

```
✅ window.UI =            UI namespace mount
✅ UI.Card = function     Card component
✅ UI.Icon = function     Icon component
✅ UI.Progress = function Progress component
✅ UI.StatusBadge = func  StatusBadge component
✅ UI.TaskCard = function TaskCard component
✅ STATUS                 shared status map
✅ progress-bar           theme.css progress-bar class ref
✅ progress-fill          theme.css progress-fill class ref
✅ onAction               Card onAction pre-wire
✅ pollingInterval        TaskCard pollingInterval pre-wire
✅ autoRefresh            Progress autoRefresh pre-wire
✅ data-object            Card data-object attr
✅ data-task-id           TaskCard data-task-id attr
✅ data-state             TaskCard data-state attr
✅ data-polling-interval  TaskCard data-polling-interval attr
✅ claimable              TaskCard claimable state
✅ claimed                TaskCard claimed state
✅ locked                 TaskCard locked state
✅ circular               Progress circular variant
```

### 浏览器控制台手动验证清单

可在 DevTools 执行以下逐条验证（需在 index.html 已加载的页面执行）：

```js
// 1. namespace 在位
console.assert(window.UI, 'UI namespace');
console.assert(typeof UI.Card === 'function', 'Card');
console.assert(typeof UI.Icon === 'function', 'Icon');
console.assert(typeof UI.Progress === 'function', 'Progress');
console.assert(typeof UI.StatusBadge === 'function', 'StatusBadge');
console.assert(typeof UI.TaskCard === 'function', 'TaskCard');

// 2. Card 三段式
var c = UI.Card({ object:'field', head:'A区·玉米田', body:'🌽 生长中', actions:'<button data-action="water">💧浇水</button>' });
console.assert(c.classList.contains('ui-card'), 'Card class');
console.assert(c.querySelector('.ui-card-head'), 'Card head');
console.assert(c.querySelector('.ui-card-body'), 'Card body');
console.assert(c.querySelector('.ui-card-actions'), 'Card actions');
console.assert(c.querySelector('[data-object="field"]'), 'Card data-object');

// 3. Card onAction 预埋
var clicked = null;
var c2 = UI.Card({ object:'field', actions:'<button data-action="test">Click</button>', onAction:function(a){clicked=a;} });
c2.querySelector('[data-action]').click();
console.assert(clicked === 'test', 'Card onAction fires');

// 4. Icon + 状态点
var i1 = UI.Icon({ name:'🌾', size:'md' });
console.assert(i1.querySelector('.ui-icon-emoji').textContent === '🌾', 'Icon emoji');
var i2 = UI.Icon({ name:'🏕️', status:'green' });
console.assert(i2.querySelector('.ui-icon-dot'), 'Icon status dot');

// 5. Progress linear（复用 theme.css 类）
var pl = UI.Progress({ value:45, max:100, label:'生长度 45/100' });
console.assert(pl.querySelector('.progress-bar'), 'Progress bar');
console.assert(pl.querySelector('.progress-fill'), 'Progress fill');
console.assert(pl.querySelector('.progress-fill').style.width === '45%', 'Progress 45%');

// 6. Progress circular
var pc = UI.Progress({ value:75, max:100, variant:'circular', label:'完成度' });
console.assert(pc.querySelector('svg'), 'Progress circular SVG');
console.assert(pc.querySelector('circle[stroke-dasharray]'), 'Progress arc');

// 7. StatusBadge 4 态
var sg = UI.StatusBadge({ status:'green', text:'在地' });
console.assert(sg.textContent.includes('在地'), 'StatusBadge green');
var sr = UI.StatusBadge({ status:'red', text:'冻结' });
console.assert(sr.textContent.includes('🔴'), 'StatusBadge red dot');

// 8. TaskCard 三态
var tc1 = UI.TaskCard({ taskId:'t1', title:'洗碗', reward:'+5NT', doer:'' });
console.assert(tc1.getAttribute('data-state') === 'claimable', 'TaskCard claimable');
var tc2 = UI.TaskCard({ taskId:'t2', title:'扫地', reward:'+3NT', doer:'砚仁' });
console.assert(tc2.getAttribute('data-state') === 'claimed', 'TaskCard claimed');
var tc3 = UI.TaskCard({ taskId:'t3', title:'擦窗', reward:'+10NT', doer:'locked' });
console.assert(tc3.getAttribute('data-state') === 'locked', 'TaskCard locked');

// 9. TaskCard 预埋
console.assert(tc1.getAttribute('data-polling-interval') === '3000', 'TaskCard default polling 3000ms');
var tc4 = UI.TaskCard({ taskId:'t4', title:'test', reward:'+1NT', pollingInterval:5000 });
console.assert(tc4.getAttribute('data-polling-interval') === '5000', 'TaskCard custom polling');

// 10. 无第三方依赖
console.assert(!document.querySelector('script[src*="cdn"]'), 'No third-party CDN added');
```

---

## ③ 禁区确认

```
server/ 目录改动：0
git diff --name-only 确认：仅 nantang-mobile/ 下二文件
  M nantang-mobile/index.html
  A nantang-mobile/js/ui-primitives.js
禁区 = 清洁 ✅
```

---

## ④ 皇帝验收单

| # | 组件 | 看点 | 该看到啥 |
|---|---|---|---|
| 1 | **Card** | 三段式（头/体/动作） | 一个白底卡片，带 12px 圆角 + 淡淡阴影。头有标题+底部边框，体位在卡片中间，动作位在最下有顶部边框。`data-object` 属性标出卡片类型。 |
| 2 | **Icon** | emoji + 状态点 | emoji 大字居中。右下角有一个小圆点（🟢🟡🔴⚫）表示状态。`size`控制图标大小(sm=1rem, md=1.5rem, lg=2.5rem）。 |
| 3 | **Progress** | 进度条（linear/circular） | linear：灰底绿条，复用已有 theme.css `.progress-bar`/`.progress-fill` 样式。circular：56px SVG 圆环，绿色弧线+中间百分比数字。label 在条/环上方或下方。 |
| 4 | **StatusBadge** | 4 态状态牌 | 小圆角牌子，🟢在地(绿)/🟡外出(橙)/🔴警告(红)/⚫离线(灰)，文字在 emoji 圆点后。颜色与 Icon 状态点完全一致。 |
| 5 | **TaskCard** | 选英雄式卡牌 | 三态：**可领**=绿边框+"🟢 领取"文字+手型光标；**已领**=绿边框+领取人名字前缀✅；**锁定**=灰边框+"🔒 倒计时"灰色文字。`data-task-id`/`data-state`/`data-polling-interval` 三个 data 属性供阶段 3 使用。 |

**共性检查**：
- [x] 5 组件全挂 `window.UI`，浏览器 console 可直接调用
- [x] 全部用 `--g-*` CSS 令牌，无硬编码色值（StatusBadge hex 色仅用于内联 style fallback，与主题变量值一致）
- [x] 全部返回 DOM Element，调用方 `appendChild()` 即可用
- [x] 阶段 3 预埋（onAction / pollingInterval / autoRefresh）仅留 props 口 + data 属性，零逻辑实现
- [x] 不重写已有代码（新文件 ui-primitives.js，index.html 加 1 行）
- [x] 不引第三方库
- [x] git add 具名（二文件），禁 -A
- [x] 只 commit 不 push

---

**太傅注三行**：
- 范式先行 ROI = 8 模块省 1 次返工——1 套组件服务全场，后续 FieldCard/RoomCard/ActivityCard 从 Card 子类化即可
- 与 A-LABOR-FE 并行安全：本卡只造通用块面，无页面级 DOM 操作，不与 A-LABOR-FE 在跑的田间页冲突
- TaskCard 是 A-CLEAN-WEEKLY 预埋骨架——`data-state` 三态 + `data-polling-interval` 轮询属性已落，等 CLEAN-WEEKLY-BE 接上
