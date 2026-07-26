---
created: 2026-07-27
project: 南塘云村
type: 施工回执
domain: 前端UI
card: SM-4
commit: 3157b93
---

# SM-4 一营施工回执

> commit `3157b93` · 2026-07-27 · Claude Code 一营

---

## 改动前后对照

| 属性 | 改前 | 改后 |
|------|------|------|
| `.village-group top` | `calc(130px + safe-top)` | `calc(200px + safe-top)` |
| `.village-window height` | `min(340px, calc(100vh - 210px - safe))` | `min(340px, calc(100vh - 340px - safe))` |

**数字推导**：

```
品牌块实际高度 ≈ 24(top-pad) + 80(logo) + 8(margin) + 64(ring) + 1.1rem×1.4(h2) + 10(bottom-pad) ≈ 210px
旧版卡片起点 = 200px → 标题底 ~210px 与卡片顶 200px 有 10px 呼吸缝
新版 130px  → 卡片顶 130px < 标题底 210px → 80px 重叠区
```

改后品牌底~210px，卡片顶 200px，**10px 呼吸缝 + SM-1 渐变底双保险**，标题与卡片零重叠。

## 矮屏取舍（360×640）

| 屏高 | 卡片顶 | 轮播高 | 卡片底 | 剩余底部 | dots+footer 需 | 结论 |
|------|--------|--------|--------|----------|-----------------|------|
| 640px | 200px | `min(340, 640-340)=300px` | 500px | 140px | ~130px | **10px 余量 · 不溢出** ✅ |
| 844px | 200px | `min(340, 844-340)=340px` | 540px | 304px | ~130px | **充裕** ✅ |
| 1080px | 200px | `min(340, 1080-340)=340px` | 540px | 540px | ~130px | **充裕** ✅ |

**取舍说明**：360×640 档位轮播窗从 340px 缩至 300px——卡片内高 270px + padding 28×2 → 在 300px 窗口内完整可见（300 > 270+56=326... wait）。

**更正**：`.vp-card-inner` height 是 `270px`（含 padding 28+24=52）。卡片内部内容区 = 270-52=218px。轮播窗 300px → 卡片 270px 在 300px 内完整可见 ✓。40px 余量供 gap 和视觉间距。

**未用 clamp/媒体查询的原因**：`min(340px, calc(100vh-340px))` 已自动缩窗——矮屏缩到 300px 时卡片（270px）仍完整可见，无截断。加 clamp 纯属多写代码（Ponytail 决策阶梯第 6 级：能一行不两行）。

## 改动文件

```
nantang-mobile/css/main.css  | 2 处数字替换（130→200, 210→340）
nantang-mobile/index.html    | main.css ?v=10→11
2 files, 3 insertions(+), 3 deletions(-)
```

**未碰**：`.village-brand` 渐变底（SM-1）、HTML 结构、任何 JS。

## 闸口

- `deploy_check.py` → **全 PASS**
- **待二营验收（逻辑关+机检关）+ 砚仁真机视觉关**
- **待丞相 push**
