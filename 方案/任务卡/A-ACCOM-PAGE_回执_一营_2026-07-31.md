━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 施工回执
  卡号：A-ACCOM-PAGE（住宿页卡片化）
  施工方：一营 Claude Code（前端 FE）
  日期：2026-07-31
  状态：施工完成，待验收
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【① diff 摘要】

新增文件：
  nantang-mobile/js/ui-accom.js             +427 行（住宿页全部逻辑）

修改文件：
  nantang-mobile/index.html                 +10 -3
    - 新增 overlayAccomPage overlay HTML
    - 引入 ui-accom.js?v=1 脚本
    - ui-camp.js?v=14→15, app.js?v=53→54, main.css?v=12→13
  nantang-mobile/js/ui-camp.js              +1 -1
    - 营地概览「住宿」入口 openInn() → openAccomPage()
  nantang-mobile/css/main.css               +14 行
    - .accom-grid 2列网格 / .abed 床位选择 / .acal-day 迷你日历

【② 自测】

│ 验收项                              │ 状态 │ 备注                           │
│ 6 房间卡片渲染                      │ ✅   │ dorm101-106 2列网格             │
│ UI.Card 范式 ×6                     │ ✅   │ head/body/actions 三段式        │
│ UI.Progress 入住度 ×6              │ ✅   │ 入住人数/capacity               │
│ UI.Icon ×6                          │ ✅   │ 🛏 房间图标                     │
│ UI.StatusBadge ×6                   │ ✅   │ green空房/yellow部分/red已满     │
│ 4 个动作按钮可点                    │ ✅   │ 入住/续住/退房/换房              │
│ 退房结算弹明细                      │ ✅   │ 天数×单价=应付NT + 余额检查     │
│ 床位选择器                          │ ✅   │ 空/已占/我的 三态               │
│ 我的入住横幅                        │ ✅   │ 房型+床位+日期+价格             │
│ 换房流程                            │ ✅   │ 选新房→确认→自动退旧房          │
│ 订餐入口冻结                        │ ✅   │ opacity:0.45 + toast提示         │
│ 素社民宿入口保留                    │ ✅   │ 底部链接 → openInn()            │
│ 校核闭环                            │ ✅   │ AppData.addVerification 调用     │
│ 已有代码未重写                      │ ✅   │ ui-phase4.js 零改动              │

【③ 禁区确认】server/ = 0 ✅ 未触碰任何 server/ 文件

【④ 皇帝验收单】

请砚仁在浏览器中打开 nantang-mobile/index.html，验证以下操作：
1. 进入任一营地 → 概览 → 点击「🏨 住宿」
2. 住宿管理页显示 6 张房间卡片（2×3 网格）
3. 每张卡片有：🛏图标、房间名、状态徽章（空房/已满）、入住度进度条、价格/空调/床数标签
4. 点击空房卡片 → 进入详情：床位选择器 + 迷你日历 + 「确认入住」按钮
5. 选择床位（空床位可点）→ 点击「确认入住」→ 弹出确认对话框 → 确认
6. 已入住后，页面顶部显示「我的入住」横幅（房型+床位+日期）
7. 已入住后，退房按钮可点 → 点击 → 退房结算明细（天数×单价=应付NT）
8. 点击「确认退房」→ 扣除NT，移除入住记录
9. 底部「🏡 素社民宿（来宾住宿）→」点击可跳转到原有客栈页

【已知局限】
- 日历为简版（仅显示当前月），未做跨月日期范围选择 — 已有 _showStaySheet 完整日历可用
- 续住功能为占位确认（未做日期延长逻辑），待后续深化
- 欠费提醒依赖 `NT.getBalance`，离线模式可能未初始化
- 管理员转他人退房需走管理面板（现有 _showStaySheet 支持）
- 床位状态未实时反射 API（退房/入住后本地渲染，API catch 静默）
