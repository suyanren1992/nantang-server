━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营 · 修复 2）
  卡号：A-CLEAN-WEEKLY-FIX2_openCleanWeekly入口
  阶段：A-CLEAN-WEEKLY 红队 A 验 · 1 真 🔴 残留
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 16:05
  法源：REDTEAM-A_验A-CLEAN-WEEKLY_回执_红队A_2026-07-31.md
  优先级：P0（红队 A 真 🔴）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【红队 A 🔴 1】
  openCleanWeekly() 函数定义了，但全文搜索无任何 onclick 调用
  现状：用户无法进入大扫除周任务页
  修复：加 UI 入口

【阵地】nantang-mobile/    【禁区】server/

【施工内容】

  ① _renderMgmtCards 加入口
     位置：app.js _renderMgmtCards（已有的 🧹 大扫除卡旁边）
     行为：
       - 大扫除卡 onclick="openCleanWeekly()"
       - 不只是 _openMgmtSheet('cleaning')，而是跳周任务页

  ② _renderQuickEntryCards 加 banner
     位置：app.js _renderQuickEntryCards
     行为：
       - 加 🧹 大扫除周任务入口
       - onclick="openCleanWeekly()"
       - 显示"本周大扫除 X/Y 人已选"

  ③ ui-cardroom.js 头部 banner
     位置：ui-cardroom.js 头部
     行为：
       - 检测 isAdmin 或 isNpc
       - 加 🧹 大扫除周任务管理按钮
       - onclick="openCleanWeekly()"

  ④ 验证
     - 全仓 grep 'openCleanWeekly()' 出现 ≥3 次（1 函数定义 + 3 调用点）
     - 用户从全貌页能进入大扫除周任务页

【约束】
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - 1 commit
  - **只 commit 不 push**
  - ?v= bump 与 commit 同号

【回执落盘】
  方案/任务卡/A-CLEAN-WEEKLY-FIX2_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **入口断 = 功能废** — 函数定义不接 = 不可用
  - **3 个入口** — 全貌页 + 快捷区 + 卡片室头部
  - **grep 验证** — 工具检验，不靠肉眼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
