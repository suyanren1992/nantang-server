━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营 · 修复 2）
  卡号：NEW-USER-TASK-FIX-FE2_3处sync残留
  阶段：FIX-FE 后潜在遗留 · core.js 3 处 TASKS sync 补字段
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 16:00
  法源：NEW-USER-TASK-FIX-FE_回执_一营_2026-07-31.md · 潜在遗留
  优先级：P0（红队 A 验后潜在 P0）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  core.js 有 4 处 TASKS sync：
  - L360（FIX-FE ① 已修 cb4ebc6）
  - L936（残留）
  - L978（残留）
  - L1196（残留）

  残留 3 处未补 is_newbie_task + deadline
  影响：其他 sync 路径不显示 🆕 角标 / 倒计时

【阵地】nantang-mobile/    【禁区】server/

【施工内容】

  ① core.js L936 TASKS sync 补字段
     is_newbie_task: t.is_newbie_task || false
     deadline: t.deadline || null

  ② core.js L978 同上

  ③ core.js L1196 同上

  ④ 验证
     - 4 处 sync 全覆盖
     - grep 'is_newbie_task' 出现 4 次以上

【约束】
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - 3 commit
  - **只 commit 不 push**
  - ?v= bump 与 commit 同号

【回执落盘】
  方案/任务卡/NEW-USER-TASK-FIX-FE2_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **4 处 sync 必须全补** — 不能 L360 补了 L1196 漏
  - **字段映射是基础设施** — 一次补全 vs 多次补
  - **grep 验证** — 不靠肉眼，靠工具
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
