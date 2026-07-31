━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营施工）
  卡号：NEW-USER-TASK-BE_新人任务BE_v0
  阶段：独立（与 UI-FIX-P2 修缮并行，2 营多窗）
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 13:10
  法源：方案/任务卡/NEW-USER-TASK_新人任务自动派发.md（02:40 起草）
  优先级：HIGH（砚仁 02:40 原话「自动社区发给他的这些任务」）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【派单理由】
  砚仁 12:50 御批「开始」+ 13:00 御批「继续派卡」
  1 营 1 窗串行修缮（UI-FIX-P2 续单），2 营多窗并行（修缮 B5补/B6补/B7补 + 此卡 NEW-USER-TASK-BE）。
  此卡与 B5补/B6补/B7补 无文件冲突（不同路由），可同时跑。

【阵地】server/    【禁区】nantang-mobile/

【施工内容】

━━━━━━━━━━━━━━━━━━━━━━━━━━
① 新增表 new_user_task_templates
━━━━━━━━━━━━━━━━━━━━━━━━━━
  字段：
    id (UUID, PK)
    title (str, NOT NULL)
    description (str, NOT NULL)
    reward_nt (int, default 10)
    target_role (str: visitor/npc/builder 之一, NOT NULL)
    display_order (int, default 0)
    expires_days (int, default 7)
    created_at (datetime, default now)
  索引：(target_role, display_order)

  种子数据（4 个模板）：
    1. 「认识一下你的邻居」 - visitor - 10 NT
    2. 「浏览公约 + 签到」 - visitor - 5 NT
    3. 「参与第一次大扫除」 - visitor - 15 NT
    4. 「领取你的第一个任务」 - npc - 20 NT

━━━━━━━━━━━━━━━━━━━━━━━━━━
② Task 表扩展
━━━━━━━━━━━━━━━━━━━━━━━━━━
  加字段：
    is_newbie_task (bool, default false, indexed)
    assigned_by_system (bool, default false)
    template_id (FK new_user_task_templates.id, nullable)
  迁移：ALTER TABLE tasks

  注意：不删老字段，只加 nullable + default false

━━━━━━━━━━━━━━━━━━━━━━━━━━
③ 触发点：用户首次 Tenancy 创建时
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：server/routes/accommodation.py checkin 路径
  行为：
    1. 查 is_newbie_task=false（首次入住）→ 改 is_newbie_task=true（标记）
    2. 拉 new_user_task_templates WHERE target_role=user.role ORDER BY display_order
    3. 按 expires_days 算 expires_at
    4. 批量建 N 个 task（doer=new_user_id, verifier=null, is_newbie_task=true, template_id=xxx）
    5. 返回响应中加 assigned_newbie_tasks 数组

  注意：避免重复派发——加 user.first_checkin_date 是否已派过的检查

━━━━━━━━━━━━━━━━━━━━━━━━━━
④ 端点
━━━━━━━━━━━━━━━━━━━━━━━━━━
  GET /api/new_user_tasks/templates
    - 拉所有模板（admin 看全部，其他人看 target_role=自己）
    - 权限：Depends(auth)

  POST /api/new_user_tasks/assign
    - 入参：{ user_id, template_ids? (空=全部) }
    - 权限：admin
    - 行为：手动触发派发（测试用）

  GET /api/new_user_tasks/me
    - 拉当前用户的新人任务
    - 字段加 is_newbie_task 角标（前端展示用）
    - expires_at 倒计时

  PATCH /api/new_user_tasks/:id/complete
    - 走现有 addVerification 校核闭环
    - 校核 approve 后 task.is_newbie_task=true → completed
    - reward_nt 从 template 取（不信客户端）

━━━━━━━━━━━━━━━━━━━━━━━━━━
⑤ 结算逻辑
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 走 A-LABOR-BE 已落地的 CV=floor(nt/2) + XP 公式
  - 走 addVerification 校核闭环
  - 不重建结算

━━━━━━━━━━━━━━━━━━━━━━━━━━
⑥ 测试（pytest）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  test_new_user_tasks.py：
    1. 首次入住触发派发
    2. 模板按 display_order 排
    3. 过期不显
    4. 新人任务走校核闭环
    5. CV/XP 公式生效
    6. 重复派发拦截
    7. admin 手动派发
    8. GET /api/new_user_tasks/me 拉自己

  基线：183 passed + 新增 8 = 191 passed

━━━━━━━━━━━━━━━━━━━━━━━━━━

【施工规则】
  - 1 营 1 窗 串行 ① → ⑥
  - 走 server/ 阵地
  - 禁区 nant-mobile/
  - **只 commit 不 push**（等 1 营修缮完一起推）
  - pytest 全绿
  - ?v= 不适用

【紧急召唤】
  - 改 Task 表发现 NT 计算冲突 → 立刻 call 丞相
  - 触发点改 accommodation.py 发现有循环依赖 → 立刻 call 丞相
  - 校核闭环接 approve 后发现 XP 不对 → 立刻 call 丞相

【回执落盘】
  方案/任务卡/NEW-USER-TASK-BE_回执_二营_2026-07-31.md
  含 6 项施工 diff 摘要 + pytest 结果（基线 183 + 新增 8）+ 禁区确认 + 验收单

【执行时间线】
  - 0min：开工
  - 1h：表 + 字段 + 触发点
  - 2h：4 端点
  - 3h：测试
  - 3.5h：commit + 回执

【太傅注 3 行】
  - **2 营多窗并行不撞**——NEW-USER-TASK-BE 改 routes/accommodation.py，B5补/B6补/B7补 改 routes/archive.py/fields.py/user_settings.py，无文件冲突
  - **首次派发拦截**——user.first_checkin_date 已在 v0.3.2 加，复用即可，不重建
  - **前端未派**——等 1 营修缮完再派 FE 续单 NEW-USER-TASK-FE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
