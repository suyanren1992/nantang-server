━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 施工回执（一营）
  卡号：A-CLEAN-WEEKLY-FIX_管理员自选位置_v0
  施工方：一营 Claude Code
  回执日期：2026-07-31
  状态：完成 ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ① diff 摘要

- `app.js` `_renderCleanAdmin`: 发放区下方加「我也要打扫」选卡网格
- 管理员可认领/取消/提交，复用 `_doCleanClaim/Unclaim/Submit`
- commit: `a1700d4`

## ② 自测

- ✅ 管理员发放任务后，下方出现任务卡片网格
- ✅ 三态正确：🟢可领 / 🔒已领（他人）/ 🧹已选（本人）
- ✅ 认领走 `API.cleanWeeklyClaim`，取消走 `API.cleanWeeklyUnclaim`
- ✅ 提交走 `API.cleanWeeklySubmit` → addVerification 闭环
- ✅ 管理员也能选 1 个（后端 CAS 限）

## ③ 禁区确认
- ✅ server/ 0 处修改

## ④ 皇帝验收单
```
管理员发完任务后也能自己选一个位置去打扫了。
走跟普通用户一模一样的 claim → submit → 校核流程。
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
