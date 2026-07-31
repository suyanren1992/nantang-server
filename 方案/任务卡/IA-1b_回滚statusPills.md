---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 全貌页
task_status: 已发卡
status: 讨论中
series: IA
---
# IA-1b 回滚 statusPills + 顶栏整洁提示（一营施工）

> 来源：砚仁反馈 ⑭（全貌页绿黄红卡片去掉）
> 施工：Claude Code（一营）｜验收：施工二营
> 优先级：**P0**（与 IA-1 冲突，需立即修正）
> 法源：砚仁终审

---

## 施工内容

### ① 回滚 IA-1 的 statusPills

IA-1 在 `app.js:256` sections 数组中加了 `_renderStatusPills()`（绿/黄/红整洁计数卡片），砚仁认为这些卡片不应出现在全貌页——"寸土寸金不该放这个"。

**修复**：从 sections 数组移除 `_renderStatusPills` 调用。

### ② 整洁提示移到顶栏

将 `_renderStatusPills` 的核心信息（有问题的空间数量）简化为顶栏一行小字或图标提示：
- 全绿 → 不显示
- 有黄/红 → 顶栏显示 `⚠️ N个空间需处理`（可点击跳转到打扫面板）

> 全貌页只保留 IA-1 已加的 `_renderNewbieCard` + `_renderCovenantCard`（这两个砚仁没反对）。

## 禁区

- `server/` 零改动
- 不改 IA-1 的 ② 面包屑修复和 ③ postMessage 收紧

## 爆炸半径

- 改几个文件：1（app.js）
- 影响功能：全貌页整洁卡片 → 顶栏提示
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `node --check` 全绿

## 判据

1. 全貌页不显示绿黄红整洁计数卡片
2. 有问题的空间时顶栏显示简洁提示（可点击跳转）
3. 全貌页仍显示新手引导 + 公约入口（IA-1 的 newbieCard + covenantCard）
4. `node --check` 全绿
