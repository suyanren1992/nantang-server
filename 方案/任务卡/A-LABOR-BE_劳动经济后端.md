━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：A-LABOR-BE（NT 劳动经济重构 · 后端）
  标识：BE  施工方：二营 Qoder  验收方：丞相 Codex + 红队A/B
  法源：v0.3.2 终版(双路 PASS) + NT_FIELD_CONTRACT v0.2 + v3.1 + chain_scanner
  复杂度：⭐⭐⭐⭐⭐ 涉钱+治理+多签+链上+4池+等式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【优先级】P0 涉钱级
【阵地】server/  【禁区】nantang-mobile/
【数据模型改造】
  ① models.py:User 加 `first_checkin_date` (Date, 入住 SET、退房不清、全退 NULL)
  ② models.py:Tenancy 加 `last_active_at` (DateTime, 30 天治理权失效)
  ③ models.py:User.contribution_value 改 `cv_balance` 公式 floor(nt/2)
  ④ models.py:User 新增 `xp_by_category` JSON {labor: xp, 厨房: xp, 田间: xp}
  ⑤ models.py:User.frozen_balance 拆 `my_escrow` + `my_frozen`
  ⑥ models.py:CommunityPool 拆 4 表:OperatingPool/EscrowPool/FrozenPool/ReservePool
  ⑦ models.py:CampLedger 改 camp_ledgers[] (camp_id, balance, escrow, status, multisig_address)

【4 池 + 等式 + 硬检查】
  ⑧ cron.py 每日会计等式: `total_issued = Σuser.nt_balance + operating + escrow + frozen`
  ⑨ cron.py reserve_covers_frozen: `reserve_pool >= frozen_pool` 硬检查
  ⑩ cron.py escrow_drift=0: `escrow_pool - Σ未领份额 = 0` 硬检查
  ⑪ cron.py 告警升级: 3 次连续失败 = 阻断日结 + admin 手动解锁

【结算逻辑】
  ⑫ nt.py:_earn 改 CV=floor(nt/2), XP=按类分桶+同类当周递减 [10,5,3,1,1,1,1]
  ⑬ nt.py:1034 校核 approve 路径**补 XP 写入**
  ⑭ nt.py:512 reserve 部分提现+排队(超 reserve 部分下次发,加通知)
  ⑮ nt.py:522 trust 提现扣分 10 → 5;劳动涨分 2-5 → 5-10

【治理】
  ⑯ 新建 routes/governance.py:
     - check_proposal_right(user): first_checkin_date ≤ 21 天 + Tenancy 有效
     - check_vote_right(user): Tenancy 有效 AND last_active_at ≤ 30 天 AND presence=onsite
     - 三 AND 收敛(§十御批)

【配置入 config】
  ⑰ BED_RATES 迁 map_locations.config.accommodation
  ⑱ labor_pricing 42 项 + 3 新项(room_prep/room_inspect/newcomer_reception) + 3 照护(care_elderly/sick/mentor_newbie)= 48 项入 map_locations.config.labor
  ⑲ 校核奖励 0.25 → 0.15(清单 C1)

【新端点】
  ⑳ GET /api/labor/config 拉取 map_locations.config.labor
  ㉑ GET /api/governance/check_proposal_right
  ㉒ GET /api/governance/check_vote_right

【测试】
  ㉓ first_checkin_date 字段测试
  ㉔ CV=floor(nt/2) + XP 递减 测试
  ㉕ 4 池等式 + reserve_covers_frozen + escrow_drift=0 测试
  ㉖ 部分提现+排队 测试
  ㉗ trust 再平衡 测试
  ㉘ 治理三 AND 测试
  ㉙ 48 项 labor_pricing 拉取测试

【铁律】只 commit 不 push · git add 具名(禁-A) 只碰 server/
  commit 例:"fix(A-LABOR-BE): 4池拆表+等式硬检查+治理+CV/XP重构 · 二营"
  pytest tests/ -q 全绿(基线 136 passed, 8 skipped)
  回执落盘 方案/任务卡/A-LABOR-BE_回执_二营_2026-07-31.md
  含【皇帝验收单】+【红队验收】

【四件套】① diff摘要 ② pytest ③ 禁区(mobile=0) ④ 皇帝验收单+红队验收
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
