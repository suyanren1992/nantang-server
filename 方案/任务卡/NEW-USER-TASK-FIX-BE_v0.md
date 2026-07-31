━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营 K 窗 · 修复）
  卡号：NEW-USER-TASK-FIX-BE
  阶段：NEW-USER-TASK-FE 验收打回 · BE 序列化补字段
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 15:25
  法源：REDTEAM-A_验NEW-USER-TASK-FE_回执_红队A_2026-07-31.md
  优先级：P0（红队 A 打回）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【红队 A 打回原因】
  BE 序列化缺 2 字段：
  - is_newbie_task — list_tasks 不返回
  - deadline — 字段名约定 vs FE 期望

【阵地】server/    【禁区】nantang-mobile/

【施工内容 · 1 项修复】

━━━━━━━━━━━━━━━━━━━━━━━━━━
① server/routes/tasks.py:79-86 list_tasks 加 2 字段
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：list_tasks 端点 Task ORM 序列化
  旧：
    return {
      "id": t.id,
      "title": t.title,
      "doer": t.doer,
      ...
    }
  新：
    return {
      "id": t.id,
      "title": t.title,
      "doer": t.doer,
      "is_newbie_task": getattr(t, "is_newbie_task", False),
      "deadline": getattr(t, "deadline", None),  # 注意是 deadline 不是 expires_at
      ...
    }

  字段名：BE 表用 deadline（V0.2 起的命名约定），不是 xpires_at

━━━━━━━━━━━━━━━━━━━━━━━━━━
② 测试
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - list_tasks 返回 is_newbie_task
  - list_tasks 返回 deadline
  - 新人任务的 is_newbie_task=true
  - 普通任务的 is_newbie_task=false
  - deadline 字段无值时为 null

━━━━━━━━━━━━━━━━━━━━━━━━━━
③ OpenAPI 契约更新
━━━━━━━━━━━━━━━━━━━━━━━━━━
  openapi_2026-07-31.yaml tasks schema 加 is_newbie_task + deadline

━━━━━━━━━━━━━━━━━━━━━━━━━━

【约束】
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - 1 项 1 commit
  - pytest 全绿（基线 244 + 新增 ≥4 = 248）
  - **只 commit 不 push**

【回执落盘】
  方案/任务卡/NEW-USER-TASK-FIX-BE_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **字段名 deadline** — 表里就是这名字，不是 expires_at
  - **序列化必须显式** — 默认 ORM 序列化不返回 nullable 字段
  - **测试要验新人 vs 普通** — is_newbie_task 区分必须有真数据
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
