---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 安全
task_status: 已发卡
status: 讨论中
series: IA
---
# IA-5 XSS 转义全覆盖（一营施工）

> 来源：7路审查报告 P1-1 + 审查 #10/#11
> 施工：Claude Code（一营）｜验收：施工二营
> 优先级：**P1 安全修复**（~3h）
> 法源：审查报告 + 砚仁终审

---

## 施工内容

### innerHTML 字符串拼接全部包裹 esc()

**现状**：30+ 处 innerHTML 赋值使用字符串拼接，admin 可控数据（建筑名/房间名/公告/时间线文本）未经转义直接注入。

**已审查的高危位置**（审查报告标注的文件:行号）：

**app.js 建筑/房间名**（审查 #10）：
- L195 — 面包屑 `b.name` 未转义
- L219 — 房间名未转义
- L276-279 — 公告/时间线文本未转义
- L375-378 — 物品名未转义
- L827-841 — 社区动态文本未转义
- L922 — 建筑名未转义
- L1034+ — 库存名未转义

**app.js 发现描述**（审查 #11）：
- L800 区域 — 发现描述文本未转义

**core.js**：
- 地图相关 innerHTML（如有建筑名注入）

**修复方法**：每处 innerHTML 拼接中，所有来自用户输入或服务端的数据用 `esc()` 包裹。

`esc()` 函数在 app.js 中已定义（搜索 `function esc`）。如果没有，在 utils.js 或 app.js 顶部新增：

```js
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
```

**示例修复**：

```js
// 修复前（L195 面包屑）
cp.innerHTML = '... <span>' + b.name + '</span> ...';

// 修复后
cp.innerHTML = '... <span>' + esc(b.name) + '</span> ...';
```

> 注意：不要对 emoji（硬编码字符串）包裹 esc()，只对用户/服务端可控的数据包裹。
> 注意：已有 `esc()` 的地方（如 `_presenceSection`）不要重复包裹。

## 禁区

- `server/` 零改动
- 不改 `esc()` 函数本身的逻辑（如已存在）
- 不改 innerHTML 的整体结构（只增量包裹数据变量）

## 爆炸半径

- 改几个文件：1-2（app.js，可能 core.js）
- 影响功能：零（纯防御性包裹，不改渲染逻辑）
- 破坏性变更：无
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `node --check` 全绿

## 判据

1. `grep -n 'innerHTML.*+' nantang-mobile/js/app.js` → 所有来自变量的字符串拼接都经过 `esc()`
2. 在浏览器控制台执行：`AppData._data.buildings[0].name = '<script>alert(1)</script>'` → 刷新全貌页 → 无 XSS 弹出
3. `node --check` 全绿
4. 回执中列出所有修改的位置 + 对应数据源（如 b.name / room.name / announcement.text）
