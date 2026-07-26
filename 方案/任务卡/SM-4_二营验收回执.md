---
title: SM-4 村口视觉下移 · 二营验收回执
created: 2026-07-27
project: 南塘云村
type: 验收回执
domain: 前端UI
card: SM-4
commit: 3157b93
status: 逻辑关+机检关通过（真机视觉留砚仁）
author: 二营（Codex）
---
# SM-4 · 村口视觉下移 二营验收回执

> 验收对象：commit `3157b93`（一营施工，2 文件 main.css/index.html，3+/3-）
> 卡面：`方案/任务卡/SM-4_村口视觉下移.md` + `SM-4_一营施工回执.md`
> 验收人：二营（Codex）· 2026-07-27
> 分工：纯 CSS 视觉卡，二营只做①逻辑关+④机检关；②③视觉真机关留砚仁随一轮测全。
> 结论：**①④两关通过；矮屏算术有一处疑义（列于关①），不阻塞转真机。**

---

## 关① 逻辑关 — diff 与卡面处方一一对应

`git show 3157b93` 实际改动（仅 2 处 CSS + 1 处 ?v=）：

| # | 卡面处方 | diff 实际 | 判定 |
|---|---|---|---|
| 1 | `.village-group top` 130px→200px（恢复旧版） | `main.css:100` `calc(130px+safe-top)`→`calc(200px+safe-top)` | ✅ 精确对应 |
| 2 | `.village-window height` 联动重算（原按 130px 算的 210px 需改） | `main.css:101` `min(340px, calc(100vh - 210px - safe))`→`min(340px, calc(100vh - 340px - safe))` | ✅ 联动值 210→340 |
| 3 | `?v=` main.css 10→11 | `index.html:11` `main.css?v=10`→`?v=11` | ✅ |

**无顺手改核查**：diff 仅 3 行增/3 行删，全部落在上述三处；`.village-brand` 渐变底（SM-1 成果）、HTML 结构、JS 全部未碰。✅ 与「纯 CSS 卡、只动 main.css+index.html」约束一致。

### 矮屏算术复算（重点，据卡面要求）

一营回执称 360×640「剩 10px 余量刚好不溢出」。二营用**实际 DOM 结构**复算——注意 `.village-group` 是 flex column（gap:10px），其**直接子项有 4 个**（回执推导隐含只算了 window 一项，遗漏了 dots-label/dots/footer 之间的两道 gap 与各自高度）：

DOM 实证（index.html）：`village-window` → `village-dots-label`（← 左右滑动 →）→ `village-dots`（3×vdot 10px）→ `village-footer`（内含 square-player-card）。

360×640、安全区=0（最坏情形）逐项累加：
```
group top          = 200px
village-window      = min(340, 640-340) = 300px   → 底边 y=500px
可用余量 (640-500)                                  = 140px
── 窗口下方需占用 ──
gap×3 (4子项间)      = 30px
dots-label          ≈ 14px (.72rem 行高)
dots                = 10px (vdot；active 是 transform 不占布局)
footer margin-top   = 12px
footer padding      = 8+16 = 24px
player-card         ≈ 38(avatar)+7+7(pad)+3(border) = 55px
需求合计                                            ≈ 145px
净余量 = 140 - 145                                  ≈ -5px
```

**疑义（列出，不阻塞）**：一营「+10px 余量」是把 dots/footer 之间的 gap 与文字标签行高漏算了；按实际 4 子项累加，360×640 无安全区时约 **-5px（临界略负）**。三点缓解使其在真机大概率仍可接受：
1. 该 -5px 是**最坏估算**（安全区=0、行高取上限、footer 取满高）；多数 360×640 设备有底部 safe-inset，但 safe-inset 会同时缩小 window（`100vh-340-safebottom`），二者部分抵消。
2. 即便轻微溢出，`village-footer` 是页面最底元素，溢出表现为玩家卡贴近底栏而非截断轮播卡（轮播卡 270px < 窗口 300px，完整可见无截断 ✅）。
3. 卡面判据②「玩家卡不顶 safe-area 底栏」正是真机关要盯的点——建议砚仁在 **360×640 小屏**特别确认玩家卡与底栏间距；若贴顶，微调方向为 footer `margin-top:12`→`6` 或 window 常数 340→330。

**结论**：逻辑处方正确、无越界；矮屏余量按实际 DOM 复算为临界（约 -5px 最坏估），标注疑义交真机确认，**不阻塞转真机**。

---

## 关④ 机检关 — deploy_check + ?v= 审计

`python server/scripts/deploy_check.py --skip-smoke`：
```
依赖对账   PASS
?v= 一致性 PASS
环境变量   PASS
```
✅ 三项全绿。

**?v= 单点递增审计**：`git show 3157b93` 内 `?v=` 改动仅 `main.css 10→11` 一处；index.html 其余 27 条 js/css 引用在本 commit **零改动**（当前工作树中 data.js/ui-archive/app.js 的更高版本号来自 3157b93 之后的其他 commit，与本卡无关）。✅ main.css 10→11 单点递增成立。

---

## 验收总表

| 关 | 内容 | 结论 |
|---|---|---|
| ① 逻辑关 | diff 三处与卡面处方一一对应、无顺手改 | ✅ PASS |
| ① 矮屏算术 | 按实际 4 子项 DOM 复算，360×640 余量临界(约-5px最坏估) | ⚠️ 列疑义，不阻塞 |
| ④ 机检关 | deploy_check 三项全绿 + main.css ?v=10→11 单点递增 | ✅ PASS |
| ②③ 真机关 | 三档位零重叠/不截断/不顶底栏 | ⏳ 留砚仁一轮测全 |

**二营验收结论：逻辑关+机检关通过，矮屏余量列一条疑义（临界略负，最坏估），不阻塞转真机。建议砚仁真机重点盯 360×640 小屏玩家卡与底栏间距。**

> **太傅注**：补课17（看实证不听说）。人话原理：一营说「剩10px不溢出」，我没照抄——把村口那块 HTML 拉出来数清楚 group 底下其实挂了 4 个东西（窗+文字+圆点+玩家卡），逐项加起来矮屏反而差约 5px。这不是拦路，是给砚仁真机时一个明确的「重点看这里」，免得小屏用户玩家卡贴底栏才发现。
