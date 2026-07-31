━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 施工回执
  卡号：A-ACTIVITY-PAGE（活动+营地+茶馆+集市+拍卖 入口收敛）
  施工方：一营 Claude Code（前端 FE）
  日期：2026-07-31
  状态：施工完成，待验收
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【① diff 摘要】

新增文件：
  nantang-mobile/js/ui-activity.js        +188 行（活动总览页全部逻辑）

修改文件：
  nantang-mobile/index.html               +12 -6
    - 村口卡片「社区副本」→「活动集市」，入口改为 openActivityHub()
    - 新增 overlayActivityHub overlay HTML
    - 引入 ui-activity.js?v=1 脚本
    - app.js?v=52→53, main.css?v=11→12
  nantang-mobile/css/main.css              +9 行
    - .activity-hub-grid / .ah-card / .ah-card-frozen / .ah-sub-card / .ah-event-card

【② 自测】

│ 验收项                              │ 状态 │ 备注                           │
│ 5 子模块入口收敛为 1 页             │ ✅   │ overlayActivityHub 5 卡片网格   │
│ 社区活动入口 → 活动子页             │ ✅   │ 列表 + 报名/签到/分享 3 按钮    │
│ 营地架构入口 → 营地子页             │ ✅   │ 4 卡片(子活动/物资/账本/分账)    │
│                                    │      │ + 提案区入口                     │
│ 茶馆/集市/拍卖 置灰                 │ ✅   │ opacity:0.45 + pointer-events:none│
│ 冻结提示文本                        │ ✅   │ "B 板块冻结 · UI 已就位等开放"   │
│ 村口卡片文案更新                    │ ✅   │ "🎪 活动集市"                    │
│ UI.Card 范式使用                    │ ✅   │ ah-card 复用 --g-card/--g-radius  │
│ UI.StatusBadge 范式使用             │ ✅   │ 状态牌（🟢绿色/⚫置灰）          │
│ UI.Icon 范式使用                    │ ✅   │ emoji icon 1.6rem                │
│ 返回到总览                          │ ✅   │ 子页 ← 返回按钮                  │
│ 已有社区副本可完整进入              │ ✅   │ "进入完整社区副本 →" 链接        │
│ 已有营地页可进入                    │ ✅   │ "进入 ▸" 按钮                    │

【③ 禁区确认】server/ = 0 ✅ 未触碰任何 server/ 文件

【④ 皇帝验收单】

请砚仁在浏览器中打开 nantang-mobile/index.html，验证以下操作：
1. 村口第一张卡片显示「🎪 活动集市」→ 点击「🎪 进入集市」
2. 活动集市页显示 5 张卡片网格（2行：2+2+1）
3. 上方 2 张（社区活动🟢、营地架构🟢/⚫）可点击，下方 3 张（茶馆/集市/拍卖⚫）置灰不可点
4. 点击「社区活动」→ 进入活动子页，看到活动列表 + 报名/签到/分享 3 按钮
5. 点击「← 返回」→ 回到活动集市总览
6. 点击「营地架构」→ 看到活跃营地列表，每个营地有 4 子卡片 + 提案区
7. 点击「进入 ▸」或任一子卡片 → 跳转到营地详情页

【已知局限】
- 签到功能为占位（showToast），待实景验证端点对接
- 分享功能为占位（showToast），待 Clipboard API / 分享面板对接
- 活动列表数据源为营地数据（getCamps），独立活动表待服务端提供
- 茶馆/集市/拍卖冻结态为纯前端占位，待 B 板块解冻后激活
