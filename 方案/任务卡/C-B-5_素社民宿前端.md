━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：C-B-5（素社民宿前端界面）
  施工方：一营 Claude Code（前端）
  验收方：丞相 Codex ｜ 立卡 2026-07-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【优先级】MID（后端已完整上线，缺前端，用户订不了房）
【阵地】nantang-mobile/   【禁区】server/（零改动，接口已就绪）

【后端接口契约（已上线，直接调）】
  · GET  /api/accommodation/inn-rooms  → 房型列表(InnRoom：4单人间梅兰竹菊 + 2四人间AB，beds上限)
  · POST /api/accommodation/checkin    → 区间预订(room_id, bed_num, checkin/checkout 日期；服务端区间重叠判定)
  · POST /api/accommodation/checkout   → 退房结算
  · GET  /api/accommodation/status     → 当前住宿状态

【施工内容】
  ① 先勘察现有住宿界面（app.js/ui-phase4.js 住宿相关），复用现有面板风格——不从零造
  ② 房型列表页：展示梅兰竹菊单人间 + AB四人间，含床位余量
  ③ 区间预订：选入住/退房日期 → 调 checkin，重叠由后端判定，前端显错
  ④ 我的住宿：读 status 显示当前预订 + 退房按钮
【约束】UI 套用现有住宿面板风格（底座 v0 明日出，先对齐现状避免返工）；涉费展示以后端返回为准，前端不自算金额

【铁律】只 commit 不 push · git add 具名(禁-A) 只碰 nantang-mobile/
  · 回执落盘 方案/任务卡/C-B-5_回执_一营_2026-07-30.md，含【皇帝验收单】
【回执四件套】① diff摘要 ② 自测 ③ 禁区(server=0) ④ 皇帝验收单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
