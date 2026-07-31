━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：A-FIELD-PAGE（田间页卡片化）
  阶段：阶段 3/4 · 第 2 张页面
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex + 双路红队 A/B
  立卡：丞相 Codex 2026-07-31
  法源：方案/卡片化范式v0 + 方案/现有UI体检v0
  范式：W6-UI-CARD-API
  后端依赖：A-LABOR-BE 已上线的 /api/labor/config + /api/data/sync_all
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【优先级】HIGH（砚仁 07-31 原话"田间管理要快速地能够录入选择哪个田地"）

【阵地】nantang-mobile/    【禁区】server/

【背景】
  砚仁 07-31 报：田间管理是痛感最高模块。"要快速地能够录入选择哪个田地"+"田地的查看块图图"+"用卡片的进度条"+"图标形象"。
  现状：app-data.js:296-300 4 块种子数据已落（番茄/玉米/红薯/枣树），但 UI 0 用。
  3 入口分裂（_submitFarmEntry / _harvestCrop / openSelfReport）需收敛。

【施工内容】

  ① 田块卡片网格（用 UI.Card 范式）
     - 4 块田（番茄/玉米/红薯/枣树）每块一张 Card
     - 头：icon（🌾🥕🌽🌳）+ name + StatusBadge（生长中/可收/警告/空闲）
     - 体：图标组（种了啥）+ Progress（生长度 0-100%）+ 关键字段（planted/harvest/days/remain）
     - 动作：[浇水] [施肥] [除草] [收割] 4 按钮 → onAction 委托

  ② 顶部 toolbar
     - 选中田块高亮
     - 「+ 新种」按钮 → 选种+选块+种

  ③ 3 入口收敛为 1
     - H 抽屉"田间管理" → 跳本页（已有 H 抽屉设计稿）
     - 全貌页"田间"快捷 → 跳本页
     - 卡片室/档案室 田块发现 → 跳本页
     - 删 _submitFarmEntry 的全貌页直接入口（保留本页入口）

  ④ 范式使用
     - UI.Card × 4 田块
     - UI.Progress × 4 生长度
     - UI.Icon × 4 田块 icon
     - UI.StatusBadge × 4 田块状态

【约束】
  - 只 commit 不 push · git add 具名（禁 -A）
  - 不引第三方库
  - 不删 app-data.js:296-300 种子（保留兼容）
  - 提交走 addVerification 校核闭环（已通）

【验收】
  - 4 块田卡片渲染正确
  - 4 个动作按钮可点
  - 选田块高亮
  - 3 入口收敛为 1

【回执落盘】方案/任务卡/A-FIELD-PAGE_回执_一营_2026-07-31.md
【回执四件套】①diff摘要 ②自测 ③禁区确认(server=0) ④皇帝验收单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
