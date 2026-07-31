━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：W6-FE-BUG（前端三bug 集中修复）
  施工方：一营 Claude Code（前端） ｜ 验收方：丞相 Codex
  标识：FE ｜ 立卡 2026-07-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【优先级】HIGH（三个全是"看起来能用其实没真用"的前端假执行，皇帝痛感高）
【阵地】nantang-mobile/  【禁区】server/（零改动，所有API已存在）

────────────────────────
【BUG-1：校核"退回/不是"按钮假执行】
  · UI 已具：core.js:159（🙅不是按钮）+ app.js:460（退回按钮）
  · 现状：AppData.verifyAction reject 分支(app-data.js:349-360)只改本地 pendingVerifications 状态并 _saveShared(true)
  · **从不**像 approve 分支那样 POST `/api/nt/verifications/{id}/reject`
  · 后果：点"退回"后另一端收不到，对方看不到"被退"，数据不同步
  · 施工：reject 分支调 `/verifications/{id}/reject`（api.js 缺此方法需补）

【BUG-2：提现(cashOut)表单假提交】
  · UI 已具：core.js:1389 showWithdrawForm / 1414 submitWithdraw
  · 现状：只往 AppData._data.pendingTransactions 推 type:cashOut 并 _save()到 localStorage
  · **从不**调 `/api/nt/withdraw`；管理员 approveTx 1424 对 cashOut 也只调本地 NT.cashOut()
  · 只有 topUp 走 API（line 1438）；api.js 缺 withdraw/confirmWithdraw/rejectWithdraw 三个方法
  · 后果：提现申请=本地假数据，管理员审批=本地假审批，钱根本没动
  · 施工：api.js 补三方法 + submitWithdraw 真正调 API + 管理员侧改调 API

【BUG-3：卡片室发现 id 客户端/服务端不同步】
  · 现状：ui-cardroom.js:1059 客户端生成 id 随 POST 发出 → 服务端忽略并覆盖为新 id 返回
  · api.js:160-166 syncDiscovery 没用 .then 接收响应 id → 客户端继续用自己 id
  · 后果：客户端 id 与服务端 id 错位累积（同一发现两边不同 id）
  · 施工：api.js syncDiscovery 补 .then 用服务端返回 id 写回本地
────────────────────────

【铁律】只 commit 不 push · git add 具名(禁-A) 只碰 nantang-mobile/
  · 一 bug 一 commit，msg 例："fix(W6-FE-BUG): 校核退回走API · 一营"
  · 回执落盘 方案/任务卡/W6-FE-BUG_回执_一营_2026-07-30.md，含【皇帝验收单】
【回执四件套】① diff摘要 ② 自测 ③ 禁区(server=0) ④ 皇帝验收单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
