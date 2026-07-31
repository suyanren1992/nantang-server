---
created: 2026-07-31
card: W6-UI-CARD-API 终验报告
verifier: 丞相 Codex
verdict: PASS
status: 闸口就绪（与 A-LABOR-BE+A-LABOR-FE 同批 push）
---

# W6-UI-CARD-API 终验 · 丞相

> 闸口就绪：阶段 1 范式先行完工，5 件套全部就位，阶段 3 全部页面（A-CLEAN-WEEKLY/A-FIELD/A-ACCOM/A-ACTIVITY）将挂此范式。

## 一、机检（全绿）

| 项 | 结果 |
|---|---|
| node --check ui-primitives.js | 语法通过 |
| 20 项静态结构校验 | 20/20 PASS（回执 §②）|
| server/ 零改动 | 0 文件 |
| 2 文件 +235 行（ui-primitives.js +234 新建 + index.html +1 行 script 引入 v=1）| 071d56a |
| git add 具名 | 2 文件逐一列出 |
| commit 只 commit 不 push | OK |

## 二、5 件套逐项核

| 组件 | 一句话 | 关键实现 |
|---|---|---|
| UI.Card | head/body/actions 三段式 | 引用 --g-card/--g-radius/--g-shadow/--g-gap/--g-pad-sm，onAction 预埋 |
| UI.Icon | emoji 主体 + 右下角状态点 | size 三档 sm/md/lg，状态点用共享 STATUS |
| UI.Progress | linear（复用 theme.css）+ circular（内联 SVG 56px）| .progress-bar/.progress-fill 类引用，autoRefresh 预埋 |
| UI.StatusBadge | 4 态 🟢🟡🔴⚫ 色牌 | 与 Icon 共用 STATUS 定义 |
| UI.TaskCard | 可领/已领/锁定三态卡牌 | doer 字段驱动：空=可领/'locked'=锁定/其他=已领，pollingInterval 预埋(3000ms) |

5/5 全到位，共享 STATUS 4 态定义避免散落。

## 三、阶段 3 预埋检查

| 接口 | 留口 | 用途 |
|---|---|---|
| Card.onAction | 委托到 [data-action] 元素 | A-CLEAN-WEEKLY 用户点"选卡"动作 |
| TaskCard.pollingInterval | data-polling-interval (3000) | A-CLEAN-WEEKLY 实时互斥（3 秒轮询）|
| Progress.autoRefresh | data-auto-refresh | 田间生长度/住宿入住度自动重渲染 |

3/3 预埋完成。

## 四、法源合规

- **底座 v0 引用**：5 件套全部引用 theme.css --g-* 令牌，无 px 硬编码
- **间距 8 倍数**：8/10/14（令牌定义）
- **圆角 12px**：引用 --g-radius
- **共享 STATUS**：与 Icon 共用定义，避免散落

对齐≠创造：未新造任何令牌/组件/范式。

## 五、上线后浏览器验证

推 main 后到 https://nantang.imeeting.club 验：

```js
// DevTools Console 逐条
console.assert(window.UI, 'UI namespace')
console.assert(typeof UI.Card === 'function')
console.assert(typeof UI.Icon === 'function')
console.assert(typeof UI.Progress === 'function')
console.assert(typeof UI.StatusBadge === 'function')
console.assert(typeof UI.TaskCard === 'function')

// 田间页（阶段 3 后会有）
var c = UI.Card({ object:'field', head:'A区', body:'🌽 生长中', actions:'<button data-action="water">💧浇水</button>' })
document.body.appendChild(c)
```

5 件套可独立调用。

---
丞相 Codex · 2026-07-31 · commit 071d56a 终验
