━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 施工回执（一营）
  卡号：A-CLEAN-WEEKLY（大扫除周任务 · 游戏化升级）
  施工方：一营 Claude Code
  回执日期：2026-07-31
  状态：完成 ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ① diff 摘要

| 文件 | 变化 |
|------|------|
| api.js | +5 端点：distribute / tasks / claim / unclaim / submit |
| app.js | openCleanWeekly + renderCleanWeekly + admin 面板 + 用户选卡 + 3s轮询 + 认领/取消/提交 |
| index.html | #overlayCleanWeekly overlay |

- commit: `f269d7c`

## ② 自测

### 管理员端
- ✅ 自动从 buildings 提取所有可打扫空间（含 building 名/icon）
- ✅ 复选框勾选空间（3-6 个），校验至少 3 个
- ✅ 均分/按人数 模式选择
- ✅ 自动计算本周一日期 → week_start_date
- ✅ 发放按钮 → API.cleanWeeklyDistribute → toast 结果
- ✅ 已发放周显示绿色提示

### 用户端
- ✅ 三态 TaskCard：
  - 🟢 可领：白底+灰边+「🧹 选择」按钮
  - 🔒 已领（他人）：灰底+「已领」标签，无按钮
  - 🧹 已选（本人）：绿底+绿边+「取消」+「✅ 提交」按钮
- ✅ 每人限选 1 个（后端 CAS 拒）
- ✅ 3 秒轮询静默更新状态（不改 DOM 结构）
- ✅ 关闭 overlay 自动停轮询

### 校核闭环
- ✅ Submit → API.cleanWeeklySubmit → 建 Verification（走 addVerification）
- ✅ 幂等：已有 verification_id 直接返回

### 范式
- ✅ UI.Card 包裹整页 banner + 卡片网格
- ✅ 卡片使用 ui-card class + CSS 变量

## ③ 禁区确认
- ✅ server/ 0 处修改

## ④ 皇帝验收单

```
砚仁陛下：

大扫除周任务游戏化升级完成：

管理员端 — 勾选空间→选模式→一键发放
用户端 — 选英雄式选卡，三态清晰（可领/已选/锁定）
        3 秒轮询保状态同步，选完提交走校核闭环
应急通道「快速打扫」保留不动
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
