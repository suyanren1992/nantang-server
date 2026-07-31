━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营 · 新窗）
  卡号：K-REDTEAM-FIX_BE13路由补全
  阶段：红队 A 验 K 窗打回 · 13 BE 路由不存在
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex + 红队 A
  立卡：丞相 Codex 2026-07-31 17:15
  法源：REDTEAM-A_验K_L_回执_红队A_2026-07-31.md
  优先级：P0（13 端点 BE 不存在 = 数据黑洞）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【红队 A 🔴】
  13 端点 BE 不存在：
  1. /api/potluck/list
  2. /api/potluck/join
  3. /api/proposals/list
  4. /api/proposals/submit
  5. /api/proposals/vote
  6. /api/camp_proposals/list
  7. /api/labor/history
  8. /api/health/report
  9. /api/notifications/list
  10. /api/cleaning_pricing
  11. /api/withdraw/history
  12. /api/camps/budget
  13. /api/camps/schedule

  影响：FE 调 → FastAPI 返回 index.html → JSON.parse 失败 → catch → localStorage 黑洞
  数据不上服务端 = 治理隐患

【阵地】server/    【禁区】nantang-mobile/

【施工内容 · 13 端点】

  按依赖分批：
  - 批 1（5 路由）：potluck / proposals / camp_proposals（接龙+提案）
  - 批 2（4 路由）：labor / health / notifications / cleaning_pricing（数据查询）
  - 批 3（4 路由）：withdraw / camps/budget / camps/schedule（财务+营地）

  每路由：建 server/routes/<name>.py + 注册到 main.py + pytest 覆盖

【约束】
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - 13 路由可分批 commit（3 批）
  - pytest 全绿（基线 255 + 新增 ≥13 = 268）
  - **只 commit 不 push**
  - ?v= 不适用（BE）

【回执落盘】
  方案/任务卡/K-REDTEAM-FIX_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **13 路由不是 13 卡** — 3 批派工，每批 4-5 路由
  - **数据黑洞 = 治理债** — FE 静默 fallback 让 bug 看不见
  - **优先补查询端点** — 批 2 数据查询影响最大
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
