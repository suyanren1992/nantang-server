---
created: 2026-07-27
project: 南塘云村
type: 任务卡
domain: 前端UI
status: 已发包
card: SM-4
version: 1.0
---

# SM-4 · 村口视觉下移卡（卡片让位标题，恢复旧版间距）

> 来源：砚仁 2026-07-27 01:05 旨「标题和卡片重合了，把卡片往下面移动」+ 指引考古旧版村口布置；01:12 准开卡。
> 考古实证（丞相，已入档 BUG_TRACKER）：旧版 `.village-group` `top:200px`（旧库 main.css:100）→ 新版被抬到 `top:calc(130px + safe-top)`（新 main.css:100）；而标题块 `.village-brand` 实际高度 ≈ 210px（logo img 80 + logo-ring 64+8 + h2 + p + padding 24+10）——卡片 130px 起必撞标题。SM-1 的渐变底是治标，本卡治本。
> 分工：一营施工，二营验收（逻辑关+机检关），视觉真机关留砚仁（随 SM-3 一并一轮测全）。

## 修法（预计只动 main.css 一个文件）

1. **卡片下移**：`main.css:100` `.village-group` `top: calc(130px + env(safe-area-inset-top, 0px))` → `top: calc(200px + env(safe-area-inset-top, 0px))`（恢复旧版 200px 间距）。
2. **联动重算轮播高度**：`main.css:101` `.village-window` 现高 `min(340px, calc(100vh - 210px - safe-top - safe-bottom))` 是按 130px 布局算的——下移 70px 后须重算（按 200px + 底部 dots/footer 预留），保证矮屏不溢出、玩家卡不顶底栏。
3. **矮屏兜底**：360×640 档位实测；若 200px 固定值在矮屏挤压轮播，允许用 clamp()/媒体查询处理，但须在回执写明取舍。
4. **不动**：`.village-brand` 渐变底（SM-1 成果，保留双保险）、index.html 村口结构（旧版好设计元素 logo+圆环+滑动圆点+玩家卡全在，无需动）、任何 JS。

## 验收判据

1. 村口标题（含 logo+⚔️圆环+标题+副标题）与三张轮播卡**零重叠**（真机多档位：360×640 / 390×844 / 平板）
2. 轮播卡完整可见，高度不被截断；底部圆点+玩家卡不顶 safe-area 底栏
3. `?v=` main.css 10→11（同 commit）；`deploy_check.py` 全绿
4. 回执独立落盘 `方案/任务卡/SM-4_一营施工回执.md`，附改动前后对照（截图或数值）

## 纪律

- 单独 commit，不 push（丞相统一闸口）；commit message：`fix(SM-4): 村口卡片区下移200px恢复旧版间距——标题零重叠`
- 纯 CSS 卡：若施工中发现必须动 HTML/JS，停工回执说明原因，等丞相裁后再动
