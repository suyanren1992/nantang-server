━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：NEW-USER-TASK（新人任务自动派发）
  阶段：独立 · 不在 UI-FIX-ALL 路线图内
  施工方：二营 Qoder（后端 BE） + 一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 02:40
  法源：砚仁 07-31 原话「进了入住之后，它的工作台里面应该是要弹出新手任务的自动社区发给他的这些任务」
  复杂度：⭐⭐⭐ 涉钱 P0（任务派发走钱路）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【背景】
  砚仁 07-31 02:40 原话：
  - 「新人引导，他应该是进了这个入住之后，它的工作台里面应该是要弹出新手任务的」
  - 「自动社区发给他的这些任务，这样他才能能够去工作台个人工作台里面的任务栏里面去」
  - 「系统自动发这个社区的任务给他，这样才算对的」

  核心：新人首次入住后，**系统自动派发新手任务模板**到新人工作台任务栏——这是产品核心功能（让新人融入社区）。
  这不是"加新功能"——是**任务派发发起方的扩展**（从用户/管理员扩展到系统）。

【阵地】
  - 二营：server/（任务派发逻辑 + 模板）
  - 一营：nantang-mobile/（新人任务栏 UI）
  - 顺序：BE 先上 → FE 后接

【数据模型】

  ① 新增表 `new_user_task_templates`（新人任务模板）
     - id (UUID, PK)
     - title (str, 如"认识一下你的邻居")
     - description (str)
     - reward_nt (int, 默认 5-10 NT，新人友好价)
     - target_role (str, visitor/npc/builder 之一)
     - display_order (int, 显示顺序)
     - expires_days (int, 默认 7 天，过期不显)
     - created_at (DateTime)

  ② 现有 Task 表扩展
     - 加 `is_newbie_task` (bool, 标识是新人任务)
     - 加 `assigned_by_system` (bool, 标识系统派发)
     - 加 `template_id` (FK new_user_task_templates.id, nullable)

  ③ 触发点：用户首次 Tenancy 创建时（accommodation.py checkin 路径）
     - 自动查 is_newbie_task=true 的模板
     - 按 display_order 批量建 N 个 task
     - task.doer = 新人 user.id
     - task.assigned_by_system = true
     - task.verifier = 系统指定（先 default=null，让新人自己选？或随机指派？）

【端点】

  ④ GET /api/new_user_tasks/templates
     - 拉所有模板（admin 可见/新人可见按 target_role）

  ⑤ POST /api/new_user_tasks/assign
     - 入参：user_id
     - 行为：建 N 个 task（按 is_newbie_task + display_order）
     - 权限：Depends(require_admin) 或系统内部调用

  ⑥ 现有 /api/tasks 拉取时
     - 新人任务加角标"新手任务"（前端展示用）
     - 加 expires_days 倒计时

【结算逻辑】

  ⑦ 新人任务 approve 走现有 addVerification 校核闭环
  ⑧ reward_nt 从 template 取（不信客户端）
  ⑨ 走 A-LABOR-BE 已落地的 CV=floor(nt/2) + XP 公式

【测试】

  ⑩ 首次入住触发自动派发
  ⑪ 模板按 display_order 排
  ⑫ 过期不显（expires_days）
  ⑬ 新人任务走校核闭环

【前端（FE 配合）】

  ⑭ 工作台任务栏：新人任务有"🆕 新手任务"角标
  ⑮ 任务详情页：倒计时 + "新手引导"标签
  ⑯ 任务完成弹"🎉 完成你的第 N 个任务"提示

【约束】
  - 二营：只 commit 不 push · git add 具名(禁 -A) · 只碰 server/
  - 一营：等 BE 完工 + push 后接 · 只碰 nantang-mobile/
  - 不引第三方库
  - 走现有 addVerification 校核闭环（不重建结算）

【回执】
  - 二营：方案/任务卡/NEW-USER-TASK-BE_回执_二营_2026-07-31.md
  - 一营：方案/任务卡/NEW-USER-TASK-FE_回执_一营_2026-07-31.md
  - 各含：① diff ② pytest/自测 ③ 禁区 ④ 皇帝验收单

【执行时机】
  - **砚仁 UI 修缮完后再派**——一营一窗不撞，先修 UI 后做新人任务 UI
  - 二营可与 UI-FIX-ALL 并行（不同阵地）
  - 但 FE 部分必须等 BE push 后才能接
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
