━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营 · 修复）
  卡号：NEW-USER-TASK-FIX-FE
  阶段：NEW-USER-TASK-FE 验收打回 · 3 行修复
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 15:25
  法源：REDTEAM-A_验NEW-USER-TASK-FE_回执_红队A_2026-07-31.md
  优先级：P0（红队 A 打回）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【红队 A 打回原因】
  5 项中 3 项因 BE-FE 字段链路断裂静默失效：
  - ② 🆕 角标 — is_newbie_task 字段未到达 FE
  - ③ 倒计时 — 字段名 t.expires_at vs BE deadline
  - ④ 完成 toast — 同上
  - ① completeNewUserTask 死代码 — 零调用

【阵地】nantang-mobile/    【禁区】server/

【施工内容 · 3 行修复】

━━━━━━━━━━━━━━━━━━━━━━━━━━
① FE sync 映射补字段
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：nantang-mobile/js/core.js:360 TASKS sync 路径
  旧：
    TASKS[name] = { ...data.tasks[name], id: name };
  新：
    TASKS[name] = {
      ...data.tasks[name],
      id: name,
      is_newbie_task: data.tasks[name].is_newbie_task || false,
      deadline: data.tasks[name].deadline || null
    };

  验证：TASKS[name].is_newbie_task !== undefined
  验证：TASKS[name].deadline !== undefined

━━━━━━━━━━━━━━━━━━━━━━━━━━
② 字段名 t.expires_at 改 t.deadline
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：ui-cardroom.js 任务详情视图（NEW-USER-TASK-FE ③ 改动处）
  旧：t.expires_at
  新：t.deadline

  验证：倒计时从 deadline 字段读取

━━━━━━━━━━━━━━━━━━━━━━━━━━
③ doSubmit 接 completeNewUserTask
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：app.js _doSubmit 任务完成路径
  行为：
    - 检测 if (TASKS[name].is_newbie_task)
    - 调 API.completeNewUserTask(taskId)
    - 走 BE 校核闭环（不是绕过去）

  验证：新人任务完成走 BE 路径

━━━━━━━━━━━━━━━━━━━━━━━━━━

【约束】
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - 3 行修复，每行 1 commit（3 commit）
  - **只 commit 不 push**
  - ?v= bump 与 commit 同号

【紧急召唤】
  - 字段映射后仍 undefined → call 丞相派 2 营 K 窗查 BE
  - completeNewUserTask 调通后 BE 报错 → call 丞相派 2 营 K 窗查 BE

【回执落盘】
  方案/任务卡/NEW-USER-TASK-FIX-FE_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **红队 A 救了 4 行 P0** — 没验就上线，3 项永不可见
  - **字段链路断** 是双轨制副产物 — BE 返回什么，FE 必须接什么
  - **doSubmit 死代码** — 定义未用是 code smell，必须接上
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
