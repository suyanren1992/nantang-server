━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：A-LABOR-BE（A 劳动流 · 后端）
  标识：BE   施工方：二营 Qoder   验收方：丞相 Codex
  法源：A劳动流设计稿v0 §三（涉钱三件皇帝甲甲甲已御批）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【优先级】HIGH（涉钱，皇帝 2026-07-30 御批）
【阵地】server/   【禁区】nantang-mobile/（零改动）
【御批三件】
  ① 价目表 硬切（旧的旧账自负，不做双轨）
  ② 校验 0 容忍（客户端传多少=后端应得，差 0 拒；不留小数）
  ③ earn-sync 后门 直接关（admin 也禁，无补单通道）

────────────────────────
【施工内容】
  ① data.py 建单一真源 LABOR_PRICING（dict 硬编起步）：
     weed:10 / water:8 / fertilize:12 / harvest:15
     clean_red:20 / clean_yellow:15 / clean_green:5
  ② 新增 GET /api/labor/pricing 端点下发该表（前端禁用本地价目表）
  ③ data.py verifications 写入分支（data.py:203-220 段）加校验：
     expected = LABOR_PRICING.get(req.type)
     未知类型 → 400
     abs(req.nt_amount - expected) > 0  # 0容忍 → 400 "定价不符,应为 X NT"
  ④ nt.py:1094-1133 earn-sync 端点：直接禁（返回 410 Gone 或 403）
  ⑤ 新增测试：
     - 改 nt_amount=17 type=weed → 400
     - 改 nt_amount=10.5 type=weed → 400(0容忍,10.5≠10)
     - 改 type=unknowtype → 400
     - 普通用户调 earn-sync → 410/403
     - admin 调 earn-sync → 也 410/403
  ⑥ commit 前先 git log 核对 (4f2624d 等历史不冲突)
【铁律】只 commit 不 push · git add 具名(禁-A) 只碰 server/
  commit: "fix(A-LABOR-BE): 价目表硬切+校验0容忍+earn-sync关 · 二营"
  回执落盘 方案/任务卡/A-LABOR-BE_回执_二营_2026-07-30.md
  pytest tests/ -q 全绿(基线 136 passed, 8 skipped)
【回执四件套】① diff摘要 ② pytest ③ 禁区(mobile=0) ④ 太傅注
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
