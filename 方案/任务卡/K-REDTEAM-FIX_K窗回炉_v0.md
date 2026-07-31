━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营 K 窗 · 回炉）
  卡号：K-REDTEAM-FIX_K窗回炉
  阶段：红队 A 验 K 窗打回 · 4 步回炉
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex + 红队 A
  立卡：丞相 Codex 2026-07-31 17:15
  法源：REDTEAM-A_验K_L_回执_红队A_2026-07-31.md
  优先级：P0（红队 A 打回 4 🔴）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【红队 A 4 🔴】
  1. ?v= 未 bump（app.js→v54 + data.js→v25）
  2. K 窗内联网格 vs L 窗 overlay 重复
  3. 接龙入口调错函数（_openQuickMenu('接龙')）
  4. 13 端点 BE 不存在（待 2 营补全）

【阵地】nantang-mobile/    【禁区】server/

【施工内容 · 4 步回炉】

━━━━━━━━━━━━━━━━━━━━━━━━━━
步骤 1：?v= bump
━━━━━━━━━━━━━━━━━━━━━━━━━━
  index.html:
    app.js?v=53 → ?v=54
    data.js?v=23 → ?v=25

━━━━━━━━━━━━━━━━━━━━━━━━━━
步骤 2：删 K 窗内联网格 → 用 L 窗 overlay
━━━━━━━━━━━━━━━━━━━━━━━━━━
  data.js: 删 community hub 5 卡内联网格代码
  改用 L 窗 ui-activity.js 的 overlayActivityHub

━━━━━━━━━━━━━━━━━━━━━━━━━━
步骤 3：接龙入口改 _openKitchenQuick
━━━━━━━━━━━━━━━━━━━━━━━━━━
  app.js: _openQuickMenu('接龙') → _openKitchenQuick('potluck')

  _openKitchenQuick 已有走共享厨房接龙（D2 d109aff）

━━━━━━━━━━━━━━━━━━━━━━━━━━
步骤 4：13 端点对接 BE（或 stub 兜底）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  等待 2 营 K-REDTEAM-FIX_BE13路由补全完工
  或全降 stub + 注释「BE 端点缺失，待补」

【约束】
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - 4 步 4 commit
  - **只 commit 不 push**

【回执落盘】
  方案/任务卡/K-REDTEAM-FIX_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **?v= bump = 部署最后一公里** — 代码改了但缓存没刷 = 改动不可见
  - **删内联网格** — K 窗 L 窗不重复造轮子
  - **接龙改 _openKitchenQuick** — D2 已修，复用
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
