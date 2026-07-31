---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: NT经济
task_status: 已发卡
status: 讨论中
series: IA
---
# IA-3 统一劳动定价 + 校核奖励公式（一营施工）

> 来源：7路审查报告 P0-4/P0-5 + 审查 #4/#5
> 施工：Claude Code（一营）｜验收：施工二营
> 优先级：**P1 核心修复**（~1h）
> 法源：审查报告 + 砚仁终审

---

## 施工内容（2 项）

### ① 统一劳动定价为单一源

**现状**：两套数字打架——
- `app.js:66-76` 公约附页B `labor_pricing`：water:3, fertilize:15, weed:15, sow:5, compost:5
- `ui-cardroom.js:25-35` `_LABOR_NT_DEFAULTS`：water:5, fertilize:8, weed:10, sow:8, compost:8

`_getLaborNT()` (ui-cardroom.js:37-47) 已实现"优先读公约配置，fallback 到默认值"，但默认值与公约不一致。

**修复**：将 `_LABOR_NT_DEFAULTS` (ui-cardroom.js:25-35) 的数字改为与 `app.js:66-76` 公约附页B 完全一致：

```js
var _LABOR_NT_DEFAULTS = {
  sweep_mop:10, wipe_surface:8, take_trash:5, organize_items:8, clean_window:10,
  clean_toilet:15, clean_kitchen:15, clean_public:12,
  water:3, fertilize:15, weed:15, sow:5, harvest:15, turn_soil:12,  // ← water 5→3, fertilize 8→15, weed 10→15, sow 8→5
  trellis:10, pest_control:8, mulch:8, prune:8,
  chef:20, sous_chef:12, wash_dishes:10, prep_food:8, clean_stove:12, grocery:5, serve_meal:5,
  repair:15, move_goods:12, organize_warehouse:10, waste_sort:8, compost:5, change_light:8,  // ← compost 8→5
  reception:8, tour_guide:10, event_setup:12, event_cleanup:10, animal_care:8, notice_board:5,
  painting:15, calligraphy:10, craft:12, photo_video:8, writing:8,
  mow_lawn:12, weed_pick:8
};
```

### ② 统一校核奖励公式为 15%

**现状**：4 种公式不一致——

| 调用位置 | 当前公式 | 15 NT 时奖励 |
|---|---|---|
| `app-data.js:342` addVerification 默认值 | `Math.max(2, Math.ceil(ntAmount/3))` | 5 NT (33%) |
| `ui-cardroom.js:1106` _submitSelfReport | `Math.ceil(ntAmount/5)||1` | 3 NT (20%) |
| `app.js:2549` _doCleaning | `Math.ceil(cleanReward/5)` | 3 NT (20%) |
| `app.js:971` _harvestCrop | 硬编码 `3` | 3 NT |
| 公约附页B `app.js:113` | `该次劳动NT的15%` | 2.25 NT |

**修复**：全部统一为 `Math.max(1, Math.round(ntAmount * 0.15))`：

- `app-data.js:342` — `verifierReward` 默认值改为 `Math.max(1, Math.round(ntAmount * 0.15))`
- `ui-cardroom.js:1106` — `Math.ceil(ntAmount/5)||1` 改为 `Math.max(1, Math.round(ntAmount * 0.15))`
- `app.js:2549` — `Math.ceil(cleanReward/5)` 改为 `Math.max(1, Math.round(cleanReward * 0.15))`
- `app.js:971` 区域 — `_harvestCrop` 的校核奖励硬编码 3 改为 `Math.max(1, Math.round(ntAmount * 0.15))`（需确认 ntAmount 来源）

> 推荐：抽一个共享函数 `_verifierReward(ntAmount)` 放在 app-data.js 或 utils.js，所有调用点引用它。

## 禁区

- `server/` 零改动
- 不改 `_getLaborNT()` 的逻辑（只改默认值数字）
- 不改公约文本（app.js:83-122 只读）

## 爆炸半径

- 改几个文件：3（app-data.js + ui-cardroom.js + app.js）
- 影响功能：劳动定价显示 + 校核奖励计算
- 破坏性变更：无（数字对齐 + 公式归一）
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `node --check` 全绿

## 判据

1. `grep -n 'water.*3\b' nantang-mobile/js/ui-cardroom.js` → 命中 `_LABOR_NT_DEFAULTS` 中 water:3
2. `grep -rn 'ntAmount/3\|ntAmount/5\|cleanReward/5' nantang-mobile/js/` → 0 匹配（旧公式全清）
3. `grep -rn 'verifierReward\|verifier_reward\|_verifierReward' nantang-mobile/js/` → 所有调用点使用同一公式 `* 0.15`
4. `node --check` 全绿
