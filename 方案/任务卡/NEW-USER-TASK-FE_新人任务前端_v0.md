━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营施工）
  卡号：NEW-USER-TASK-FE_新人任务前端_v0
  阶段：阶段 3 · NEW-USER-TASK 配对 FE（BE 已就绪）
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 14:55
  法源：方案/任务卡/NEW-USER-TASK_新人任务自动派发.md + NEW-USER-TASK-BE 已完工
  优先级：HIGH（砚仁 02:40 原话「自动社区发给他的这些任务」+ 12:25 设计合集 ⑦）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【派单理由】
  砚仁痛点：新人首次入住后，工作台应自动弹出新人任务
  BE 已完工：commit a4e596d（NEW-USER-TASK-BE 4 端点 + checkin 触发 + 校核闭环 + 12 测）
  强依赖已解：FE 立刻可接

【阵地】nantang-mobile/    【禁区】server/

【施工内容 · 5 项】

━━━━━━━━━━━━━━━━━━━━━━━━━━
① API.getNewUserTasks() 客户端方法
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：nantang-mobile/js/api.js
  调：GET /api/new_user_tasks/me
  返回：{ tasks: [...], total, pending_count }
  缓存：AppData._data.new_user_tasks

━━━━━━━━━━━━━━━━━━━━━━━━━━
② 工作台任务栏加「🆕 新手任务」角标
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：app.js 工作台任务栏渲染
  行为：
    - 遍历 tasks，is_newbie_task=true 的加角标
    - 角标显示「🆕」emoji + 浅绿色背景
    - 角标位置：任务卡右上角

  复用块面：UI.StatusBadge（已有，4 态：🟢🟡🔴⚫）

━━━━━━━━━━━━━━━━━━━━━━━━━━
③ 任务详情页加倒计时 + 「新手引导」标签
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：ui-cardroom.js 任务详情视图
  行为：
    - 显示 expires_at 倒计时（X 天 Y 时）
    - 加「新手引导」标签（绿色）
    - 已过期任务不显示

  复用块面：UI.Card + UI.Icon + UI.Progress

━━━━━━━━━━━━━━━━━━━━━━━━━━
④ 任务完成弹「🎉 完成第 N 个任务」提示
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：app.js 任务完成回调
  行为：
    - 完成任务时弹 toast
    - 第 1 个：「🎉 完成你的第 1 个新人任务！」
    - 第 N 个：「🎉 完成第 N 个新人任务，加油！」
    - 全完成：「🌟 全部新人任务完成！欢迎成为社区正式成员」

━━━━━━━━━━━━━━━━━━━━━━━━━━
⑤ checkin 后自动弹新人任务引导
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：app.js checkin 成功回调
  行为：
    1. 拉 API.getNewUserTasks() 拿新人任务
    2. 弹模态（UI.Modal）：「🎉 欢迎入住！系统给你准备了 N 个新人任务」
    3. 列出任务标题 + 「查看任务」按钮
    4. 关闭后跳转工作台任务栏
  复用块面：UI.Modal + UI.Card + UI.TaskCard

  注意：与 7 项设计中的「游戏化引导」不冲突——本卡只做任务栏提示，游戏化引导是另卡

━━━━━━━━━━━━━━━━━━━━━━━━━━

【接口契约】
  openapi_2026-07-31.yaml NEW-USER-TASK 段（2 营已更新）
  端点：
    GET  /api/new_user_tasks/me       拉自己的新人任务
    PATCH /api/new_user_tasks/:id/complete  完成（走校核闭环）

【施工规则】
  - 1 营 1 窗 串行 ① → ⑤
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - **只 commit 不 push**
  - ?v= bump 与 commit 同号
  - 复用 W6-UI-CARD-API 5 件套（Card/Icon/StatusBadge/TaskCard/Modal）
  - 不引第三方库

【紧急召唤】
  - 调 BE 端点发现字段缺 → call 丞相
  - ⑤ 弹模态发现 checkin 回调路径错 → call 丞相

【回执落盘】
  方案/任务卡/NEW-USER-TASK-FE_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **与 7 项设计「游戏化引导」不冲突**——本卡只做任务栏提示
  - **5 项强依赖 BE**——2 营已就绪，立刻可接
  - **checkin 后弹模态**——5 最重要，砚仁痛点
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
