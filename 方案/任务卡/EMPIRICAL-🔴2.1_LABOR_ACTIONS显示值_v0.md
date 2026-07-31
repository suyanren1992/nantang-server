━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营）
  卡号：EMPIRICAL-🔴2.1_LABOR_ACTIONS显示值
  阶段：实证审查 v2 · 4 🔴 之 #1
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 14:00
  法源：检查报告/全貌页与实景地图_实证审查报告_2026-07-31.md · §2.1
  优先级：P0（用户定价透明性 + 公约附页 B 不一致）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  ui-cardroom.js:52-117 LABOR_ACTIONS 硬编码 nt 字段
  vs app.js:66-76 _defaultConfig().labor_pricing 实际值
  5 处数值差异：

  | 动作 | 显示值 (ui-cardroom.js) | 实际值 (app.js) | 差 |
  |------|------------------------|----------------|-----|
  | water | 5 (line 64) | 3 (line 69) | +2 |
  | fertilize | 8 (line 65) | 15 (line 69) | -7 |
  | weed | 10 (line 66) | 15 (line 69) | -5 |
  | sow | 8 (line 67) | 5 (line 69) | +3 |
  | compost | 8 (line 89) | 5 (line 72) | +3 |

【阵地】nantang-mobile/    【禁区】server/

【施工内容】

  ① ui-cardroom.js 修改 _getActionsForSpace() (line 195)
     改：每个 action 的 nt 字段改为动态读取 _getLaborNT(actionId)
     删：LABOR_ACTIONS 中硬编码的 nt 字段（或保留 + 注释「运行时被覆盖」）

  ② 验证
     - 卡片室选空间后，每个劳动动作的 +N NT 与 _mlConfig().labor_pricing 一致
     - 5 处差异全部消除
     - 控制台：
       LABOR_ACTIONS[1].actions[0].nt === _mlConfig().labor_pricing.water

  ③ 单元测试（jsdom）
     - _getActionsForSpace('campus') 返回的 actions[].nt 与 _mlConfig() 一致

【约束】
  - 等 1 营修缮续单 3 完再接
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - **只 commit 不 push**
  - ?v= bump 与 commit 同号

【回执落盘】
  方案/任务卡/EMPIRICAL-🔴2.1_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **不能只改显示** — 必须统一到 labor_pricing 单一真源
  - **公约附页 B (app.js:120-125) 数字也要对** — 修改后顺手对一下
  - **影响卡片室闭环** — 显示对=用户信任
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
