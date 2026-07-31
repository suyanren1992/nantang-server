━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营 · 1 行修复）
  卡号：EMPIRICAL-🔴2.2_statusPills渲染
  阶段：实证审查 v2 · 4 🔴 之 #2（最快）
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 14:00
  法源：检查报告/全貌页与实景地图_实证审查报告_2026-07-31.md · §2.2
  优先级：P0（1 行修复，零风险）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  app.js:259-268 sections 数组 8 项，缺 _renderStatusPills()
  函数已在 app.js:296-322 完整实现（空间整洁度绿/黄/红 + 物品过期）
  影响：全貌页看不到空间状态指示

【阵地】nantang-mobile/    【禁区】server/

【施工内容】
  ① app.js:259-268 sections 数组追加一项
     位置：line 264 后插入（在 _renderMgmtCards 之前或之后）
     代码：
       function(){ return _s('statusPills', _renderStatusPills()); },

  ② 验证
     - 浏览器控制台 getComputedStyle('.statusPills') 不为空
     - 全貌页能看到绿/黄/红 + 物品过期

【施工规则】
  - 1 项 1 commit
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - **只 commit 不 push**
  - ?v= bump 与 commit 同号

【回执落盘】
  方案/任务卡/EMPIRICAL-🔴2.2_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **1 行修复** — 加数组项，零风险
  - **立刻可接** — 不依赖 BE
  - **3 分钟搞定** — 让 1 营先做这个热身
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
