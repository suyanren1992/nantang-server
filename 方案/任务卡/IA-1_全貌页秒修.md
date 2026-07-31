---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 全貌页
task_status: 已发卡
status: 讨论中
series: IA
---
# IA-1 全貌页秒修（一营施工）

> 来源：7路审查报告 P0-1/P0-2/P0-6 + 审查 #1/#2/#13
> 施工：Claude Code（一营）｜验收：施工二营
> 优先级：**P0 秒修**（3 项合 1 卡，共 < 30 分钟）
> 法源：审查报告 + 砚仁终审

---

## 施工内容（3 项，逐条带行号）

### ① 恢复全貌页 3 个已实现但未渲染的板块

**现状**：`app.js:256-263` 的 `sections` 数组只有 6 项，遗漏了已定义的 3 个函数：
- `_renderStatusPills()`（L282）— 绿/黄/红空间计数 + 物品过期提醒
- `_renderNewbieCard()`（L310）— 新手引导进度条
- `_renderCovenantCard()`（L394）— 公约快捷入口

**修复**：在 sections 数组（L256-262）末尾追加 3 项调用：
```js
function(){ return _s('statusPills', _renderStatusPills()); },
function(){ return _s('newbieCard', _renderNewbieCard()); },
function(){ return _s('covenantCard', _renderCovenantCard()); }
```

> 注意：`_s()` 是现有的安全包裹函数，确保单项渲染失败不影响其他板块。

### ② 修复面包屑导航 renderOverview() 未定义

**现状**：`app.js:195` — `onclick="renderOverview()"` 引用了不存在的函数，用户点击面包屑触发 `ReferenceError`。

**修复**：二选一（一营自行判断哪种更合理）：
- 方案 A：将 `renderOverview()` 改为 `goTo(0)`（回到全貌页索引）
- 方案 B：新增 `function renderOverview() { goTo(0); }` 作为别名

推荐方案 B（语义清晰，不改现有 onclick 模式）。

### ③ postMessage 通配符 origin `'*'` → 收紧

**现状**：5 处 postMessage 全部使用 `'*'` 目标 origin：
- `app.js:3` — `_post()` 封装
- `core.js:1274` — mapFrame userData
- `core.js:1824` — bridge confirm userData
- `core.js:1829` — bridge confirmResult（2 处）
- `core.js:1837` — bridge ntBalance

**修复**：将 5 处 `'*'` 改为 `window.location.origin`：
```js
// app.js:3
window.parent.postMessage(data, window.location.origin)

// core.js:1274
mapFrame.contentWindow.postMessage({type:'userData',...}, window.location.origin)

// core.js:1824, 1829(×2), 1837 — 同理
e.source.postMessage({...}, window.location.origin)
```

> 注意：如果存在跨域 iframe 场景（如地图嵌入外部域），需保留 `'*'` 并加注释说明。全貌页不存在跨域，全部收紧。

## 禁区

- `server/` 零改动
- `data.py` 零改动（IA-2 归二营）
- `auth.py` 零改动

## 爆炸半径

- 改几个文件：2（app.js + core.js）
- 影响功能：全貌页渲染 + 面包屑导航 + iframe 通信
- 破坏性变更：无（恢复已有函数 + 收紧 origin）
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `node --check` 全绿

## 判据（验收方逐条贴输出）

1. 全貌页 → 状态总览（🟢🟡🔴 计数）+ 新手引导进度条 + 公约入口卡片全部可见
2. 面包屑点击"实景地图" → 回到全貌页（无 ReferenceError）
3. `node --check` 全绿
4. `grep -rn "postMessage.*'\*'" nantang-mobile/js/` → 0 匹配
