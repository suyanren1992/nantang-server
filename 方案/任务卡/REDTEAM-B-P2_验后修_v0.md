━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营 L 窗 · 修复）
  卡号：REDTEAM-B-P2_验后修
  阶段：红队 B 验 B3 + B6 完 · 修 2 盲点
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 15:50
  法源：REDTEAM-B_验B3_B6_回执_红队B_2026-07-31.md
  优先级：P2（红队 B 建议）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【红队 B 盲点】
  ① B3 测试名实不符（🔴）
     test_admin_cannot_clear_buildings 测试体无 assert
     实际：admin 推 {"buildings": []} 能清空（deep_merge list 替换语义）
     测试名误导验收方
  ② B6 默认密码无运行时告警（🟡）
     README 有警告，但代码无 logger.warning
     生产忘记设 env → admin 用公开密码登录 → P0 风险

【阵地】server/    【禁区】nantang-mobile/

【施工内容 · 2 项】

━━━━━━━━━━━━━━━━━━━━━━━━━━
① 改名 test_admin_cannot_clear_buildings + 加 assert
━━━━━━━━━━━━━━━━━━━━━━━━━━
  旧名：test_admin_cannot_clear_buildings
  新名：test_admin_can_clear_buildings_by_list_replace

  测试体加 assert：
    - admin 推 {"buildings": []} 后，DB 中 buildings 为空
    - 这反映 deep_merge 的 list 替换语义
    - 加注释：「如需保护种子，应改用 deep_merge 兼容 list 的策略」

  文档：CHANGELOG 标注「list 替换是设计行为，非 bug」

━━━━━━━━━━━━━━━━━━━━━━━━━━
② B6 默认密码运行时告警
━━━━━━━━━━━━━━━━━━━━━━━━━━
  位置：server/database.py init_db 中 admin 种子插入处
  行为：
    - 检测 _admin_password == 'admin123'（默认值）
    - 触发：logger.warning(
        '⚠️ ADMIN_BOOTSTRAP_PASSWORD 使用默认值 admin123，'
        '生产环境必须设置环境变量！'
      )
    - 警告输出到 stderr

  测试：
    - 默认密码 → 警告触发（caplog 捕获）
    - env var 自定义 → 警告不触发

━━━━━━━━━━━━━━━━━━━━━━━━━━

【约束】
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - 2 项 2 commit
  - pytest 全绿（基线 249 + 0 回归，至少不变）
  - **只 commit 不 push**

【回执落盘】
  方案/任务卡/REDTEAM-B-P2_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **测试名 = 文档** — 误导的测试名是技术债
  - **README 不够** — 运行时告警是兜底
  - **list 替换是设计** — B3 不算 bug，但需文档化
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
