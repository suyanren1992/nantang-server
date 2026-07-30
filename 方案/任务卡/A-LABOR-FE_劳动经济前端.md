━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：A-LABOR-FE（NT 劳动经济重构 · 前端）
  标识：FE  施工方：一营 Claude Code  验收方：丞相 Codex
  法源：v0.3.2 终版(双路 PASS) + A-LABOR-BE
  复杂度：⭐⭐⭐⭐ UI 改造 + 治理权 UI + 提现/排队 + 志愿劳动 checkbox
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【优先级】P0(随 A-LABOR-BE 同步发,FE 必读 BE 端点契约)
【阵地】nantang-mobile/  【禁区】server/
【前提】BE 已 push 4 池拆表 + 治理端点,FE 对接

【FE 改造清单】
  ① nt-core.js:490 **删** spendToPool CV 扣减(提案权不挂 CV)
  ② app.js:54 校核奖励 0.25 → 0.15
  ③ app.js:66-76 labor_pricing 加 6 新项:
     - room_prep(10) / room_inspect(8) / newcomer_reception(12)
     - care_elderly(15) / care_sick(15) / mentor_newbie(12)
     = 48 项
  ④ app.js:55-58 BED_RATES 拉取 /api/labor/config 替代硬编
  ⑤ app-data.js 同步 labor_pricing (从 /api/labor/config 拉)
  ⑥ sync_all 读新字段: my_escrow / my_frozen / first_checkin_date / last_active_at / xp_by_category

【治理权 UI】
  ⑦ 提案按钮:调 /api/governance/check_proposal_right,不够提示"还需 X 天提案"
  ⑧ 投票按钮:调 /api/governance/check_vote_right,不在地禁用
  ⑨ 个人页:显示 first_checkin_date + 提案权状态 + 投票权状态

【提现/排队 UI】
  ⑩ 提现面板:显示 my_frozen(待审) + 可提余额
  ⑪ 排队提示:"您的提现请求已加入排队,预计 X 天内到账"
  ⑫ 部分提现:超过 reserve_pool 部分自动排队,不分全有全无

【志愿劳动 checkbox】
  ⑬ 劳动提交流水:加 checkbox "不计 NT,只加 CV/XP"
  ⑭ 勾上后:API 调 createVerification 时传志愿标志,BE 不发 NT

【等级/勋章纯荣誉化】
  ⑮ 删除等级 NT 加成显示(只加 NT 不加 CV/XP,纯荣誉)
  ⑯ 勋章"金锄头(≥500CV)"/"铁锄头(≥200CV)"显示,无治理权加成
  ⑰ 熟手/老把式 NT×1.2/×1.5 仍在,但纯经济效率,不动治理

【铁律】只 commit 不 push · git add 具名(禁-A) 只碰 nantang-mobile/
  commit 例:"fix(A-LABOR-FE): 治理权UI+提现排队+志愿checkbox+48项劳动 · 一营"
  回执落盘 方案/任务卡/A-LABOR-FE_回执_一营_2026-07-31.md
  含【皇帝验收单】

【四件套】① diff摘要 ② 自测 ③ 禁区(server=0) ④ 皇帝验收单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
