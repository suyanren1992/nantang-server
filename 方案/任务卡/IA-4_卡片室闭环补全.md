---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 卡片室
task_status: 已发卡
status: 讨论中
series: IA
---
# IA-4 卡片室闭环补全（一营施工）

> 来源：7路审查报告 P1-2 + 审查 #3
> 施工：Claude Code（一营）｜验收：施工二营
> 优先级：**P1 核心修复**（~2h）
> 法源：审查报告 + 砚仁终审

---

## 施工内容

### 5 条快捷操作补 cardDiscoveries 双写

**现状**：5 条快捷操作路径只写 `pendingVerifications`（校核队列），不写 `cardDiscoveries`（卡片室）。80% 劳动在卡片室不可见，观察者没有牌可猜。

| 操作 | 文件:行号 | 写校核 | 写卡片室 |
|---|---|---|---|
| `_submitMyCleaning()` | app.js:2003 | ✅ | ❌ |
| `_doCleaning()` | app.js:2520 | ✅ | ❌ |
| `_submitKitchenEntry()` | app.js:2912 | ✅ | ❌ |
| `_submitFarmEntry()` | app.js:2952 | ✅ | ❌ |
| `_submitCleanEntry()` | app.js:2991 | ✅ | ❌ |

**已有正确示范**：`_submitSelfReport()` (ui-cardroom.js:1094-1130) 做了双写——同时写 `pendingVerifications` 和 `cardDiscoveries`。

**修复**：参考 `_submitSelfReport()` 的 disc 对象结构，在以上 5 个函数的 `AppData.addVerification(...)` 调用之后，各补一个 `_getDiscoveries().unshift(disc)` 写入。

disc 对象模板（从 _submitSelfReport 复制）：
```js
var disc = {
  id: 'quick_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
  spaceId: spaceId,        // 从函数上下文取
  spaceName: spaceName,    // 从函数上下文取
  spaceIcon: '🏠',         // 默认或从建筑数据取
  actionId: actionId,      // 从函数上下文取
  actionLabel: actionLabel, // 从函数上下文取
  actionIcon: '🧹',        // 按操作类型选 emoji
  description: actionLabel + ' @' + spaceName,
  guesser: null,           // 快捷操作无人猜
  guessedPerson: me,       // 做事者
  guessedAt: null,
  status: 'pending',
  ntGuesser: 0,
  ntDoer: ntAmount,
  isSelfReport: true,
  createdAt: new Date().toISOString()
};
var discs = _getDiscoveries();
discs.unshift(disc);
if (discs.length > 200) discs.length = 200;
```

> 注意：`_getDiscoveries()` 是 ui-cardroom.js 的局部函数。如果 app.js 访问不到，需抽到公共位置（如 app-data.js 或 data.js）或直接在 app.js 中读 `AppData._data.cardDiscoveries`。

**具体 5 处上下文**：

1. **_submitMyCleaning** (app.js:2003)：roomId 已知 → spaceId = roomId
2. **_doCleaning** (app.js:2520)：spaceId 已知，cleanReward 已知
3. **_submitKitchenEntry** (app.js:2912)：从厨房放取记录取 spaceId（默认 'kitchen'）
4. **_submitFarmEntry** (app.js:2952)：从田块按钮取 spaceId + actionId
5. **_submitCleanEntry** (app.js:2991)：从打扫面板取 spaceId

## 禁区

- `server/` 零改动
- 不改 `_submitSelfReport()` 本身（它已经正确）
- 不改校核队列逻辑（只增量补卡片室写入）

## 爆炸半径

- 改几个文件：1（app.js）
- 影响功能：卡片室可见劳动记录（增量）
- 破坏性变更：无（纯新增，不改现有写入）
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `node --check` 全绿

## 判据

1. 每个函数执行后 `AppData._data.cardDiscoveries.length` 增加 1
2. 新写入的 disc 包含 `spaceId`、`actionId`、`ntDoer`、`isSelfReport:true`
3. `_submitSelfReport()` 原有逻辑不受影响
4. `node --check` 全绿
