━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营）
  卡号：EMPIRICAL-🔴2.3_HARDCODED_BUILDINGS不交汇
  阶段：实证审查 v2 · 4 🔴 之 #3
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 14:00
  法源：检查报告/全貌页与实景地图_实证审查报告_2026-07-31.md · §2.3
  优先级：P0（架构层面，12 建筑种子数据散落客户端）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  客户端 app.js:15-27 HARDCODED_BUILDINGS 12 建筑
  vs 服务端 database.py init_db() 不写 map_locations.buildings 种子
  后果：
  - 新数据库无建筑数据
  - 客户端依赖硬编码兜底（每客户端各自的真相）
  - 建筑师改名/新增建筑只改客户端，服务端无感

【阵地】server/    【禁区】nantang-mobile/

【施工内容】

  ① server/database.py init_db() 加 buildings 种子
     数据源：从 app.js:15-27 复制 HARDCODED_BUILDINGS
     写入：map_locations.buildings 表
     时机：init_db 第一次建表时

  ② server/seed/buildings.json 新建
     12 建筑的完整数据（id/name/icon/meta/photo/photoBg/status/summary/floors/plots）
     从 app.js 提取并写成 JSON

  ③ init_db() 加载 JSON
     读 seed/buildings.json → 写 map_locations.buildings
     幂等：先查再插，避免重复

  ④ 客户端 HARDCODED_BUILDINGS 改读服务端
     注意：本卡只做后端种子，前端改读在后续卡
     现阶段：客户端仍用 HARDCODED_BUILDINGS 兜底，但服务端有了真相

  ⑤ 测试
     - 新数据库 init_db 后 map_locations.buildings 有 12 行
     - 多次 init_db 不重复插入
     - 字段对齐客户端 HARDCODED_BUILDINGS

【约束】
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - **只 commit 不 push**
  - pytest 全绿（基线 218 + 新增 ≥ 4 = 222）
  - 不引第三方库
  - seed/buildings.json 进 git

【紧急召唤】
  - 复制 HARDCODED_BUILDINGS 发现字段不对 → 立刻 call 丞相
  - init_db 幂等发现 schema 限制 → 立刻 call 丞相

【回执落盘】
  方案/任务卡/EMPIRICAL-🔴2.3_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **架构债** — 客户端硬编码是历史产物，本卡立服务端真源
  - **前端改读是后续卡** — 1 营接手，本卡只做种子
  - **新数据库**才暴露此 bug — 测试环境已暴露，生产会持续爆发
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
