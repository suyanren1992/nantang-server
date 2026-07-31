━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：W6-UI-CARD-API（通用块面 5 件套 · 范式先行）
  阶段：阶段 1 / 4（范式先行）
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex + 皇帝砚仁
  立卡：丞相 Codex 2026-07-31
  法源：方案/设计系统底座_v0.md + 方案/卡片化范式_勘察v0.md
  御批：v0 4 问全甲 + 大扫除周任务「游戏化升级」特殊通道
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【优先级】HIGH（阶段 3 全部页面依赖此范式，不出=全卡）

【阵地】nantang-mobile/    【禁区】server/（本卡零改动）

【背景】
  御批 07-31：v0 4 问全甲——方向准 / 8 模块共用 / 田间优先 / emoji 双轨。
  阶段 1 范式先行：造 1 套通用块面，8 模块（田间/住宿/活动/营地/任务/物品/卡片室/个人）共用。
  阶段 3 全部页面（A-CLEAN-WEEKLY / A-FIELD-PAGE / A-ACCOM-PAGE / A-ACTIVITY-PAGE）挂此范式。
  冻结 B/C/D/E/F 新功能（07-31 砚仁「先不添东西」原则）。

【施工内容 · 5 件套】

  ① <Card> 组件（head / body / actions 三段式）
     - 引用底座「卡片-内容」令牌（圆角中 12px / 阴影卡片 / sm8 间距）
     - 必带 props：object（field/room/activity/camp/task/item/discovery/profile）
     - 用法：\<Card object="field" head="A区" body="..." actions="..."></Card>\

  ② <Icon> 组件（emoji 双轨 = emoji + 少量 icon 库）
     - 默认 emoji，特殊场景（如营地🏕️/议事厅🏛️）允许 icon 库回退
     - 必带 props：name / size（sm/md/lg）/ status（🟢🟡🔴⚫）
     - 与 <StatusBadge> 共用 status 语义

  ③ <Progress> 组件（theme.css 进度条已写但 0 启用）
     - 激活 theme.css:272-274 进度条 CSS，组件化
     - 必带 props：value / max / label（如「生长度 45/100」）/ variant（linear/circular）
     - 服务于田间生长度 / 住宿入住度 / 任务完成度 / 物品库存

  ④ <StatusBadge> 组件（4 态 + 文字）
     - 🟢🟡🔴⚫ 4 态，对应 W6-P-FE 已落地的 status 三态+离线
     - 必带 props：status / text（如「在地」「外出」「离线」）
     - 与 <Icon> 共用 status 语义，避免散落

  ⑤ <TaskCard> 组件（选英雄式卡牌 · 阶段 3 A-CLEAN-WEEKLY 用）
     - 大扫除周任务的"卡牌"基础——可领/已领/锁定三态
     - 必带 props：taskId / title / reward / doer（空=可领 / 某人=已领 / 锁定=倒计时）
     - 前端骨架：状态机由 CLEAN-WEEKLY-BE 后端驱动（轮询 3 秒）

【组件挂载方式】
  - 文件位置：nantang-mobile/js/ui-primitives.js（新建）
  - 注册到 window.UI（namespace）
  - 入口：index.html 引入 \<script src="js/ui-primitives.js?v=NEW_HASH"></script>\
  - ?v= bump 与 commit 同号（铁律）

【约束】
  · 只 commit 不 push  · git add 具名(禁 -A)，只碰 nantang-mobile/
  · 不引第三方库（用现有 vanilla JS）
  · 不重写已有，只造通用块面
  · commit 例："feat(W6-UI-CARD-API): 通用块面 5 件套 · 一营"
  · 回执落盘 方案/任务卡/W6-UI-CARD-API_回执_一营_2026-07-31.md
  · 回执须含【皇帝验收单】：5 组件各点哪 / 该看到啥

【阶段 3 接口预留（不要做，但要在组件 props 里留）】
  - <Card> 预留 onAction(action) 回调（A-CLEAN-WEEKLY 用）
  - <TaskCard> 预留 polling interval（默认 3000ms）
  - <Progress> 预留 autoRefresh（田间/住宿状态变化时重渲染）

【回执四件套】① diff摘要 ② 自测结果 ③ 禁区确认(server=0) ④ 皇帝验收单

【太傅注三行】
  - 范式先行的 ROI = 8 模块省 1 次返工——1 套组件服务 8 用
  - 不重写已有，只造通用块面——避免动了 A-LABOR-FE 已在跑的回执
  - TaskCard 是为 A-CLEAN-WEEKLY 预埋的「选英雄」骨架，状态机由后端驱动
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
