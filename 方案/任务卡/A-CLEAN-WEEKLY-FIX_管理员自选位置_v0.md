━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营 · 修复）
  卡号：A-CLEAN-WEEKLY-FIX_管理员自选位置
  阶段：A-CLEAN-WEEKLY 完工后砚仁新需求
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 15:35
  法源：砚仁 15:35 原话「管理员他自己也得选一个位置去打扫，因为他也是本身是住这里的人」
  优先级：P0（产品核心 + 砚仁亲自报）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【砚仁洞察】
  管理员发完任务后，自己也应参与打扫——因为他是住户
  现状：A-CLEAN-WEEKLY 管理员只发不选，与住户身份不符
  影响：管理员变成「监工」而非「参与者」，与社区共居精神违背

【阵地】nantang-mobile/    【禁区】server/

【施工内容】

  ① _doAdminClaim(spaceId) 新方法
     位置：ui-cardroom.js（或 ui-phase4.js）
     行为：
       - 管理员发放完任务后，可调用此方法
       - 走与普通用户同流程（_claimCleanTask + addVerification 闭环）
       - 选中的位置从 doer 字段改为 admin 自己

  ② UI：管理员发完任务后弹「你也可以选一个位置」提示
     位置：renderAdminDistribute 完成回调
     行为：
       - 弹 toast「🧹 你也可以选一个位置去打扫」
       - 跳转用户端选卡页（_renderUserCleanTasks）

  ③ 复用已有块面
     - UI.TaskCard 三态（已有 f269d7c）
     - UI.Card + UI.StatusBadge

  ④ 测试
     - 管理员发完后调 _doAdminClaim
     - 与普通用户同 addVerification 流程
     - 后端 clean_weekly_tasks 表 doer=admin_id 写入

【约束】
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - 1 commit
  - **只 commit 不 push**
  - ?v= bump 与 commit 同号
  - 不引第三方库

【回执落盘】
  方案/任务卡/A-CLEAN-WEEKLY-FIX_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **管理员也是住户** — 治理权与参与权分离 = 监工心态
  - **走同流程** — 不要为管理员开特殊后门
  - **与同伴感** — 砚仁洞察：社区精神的核心
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
