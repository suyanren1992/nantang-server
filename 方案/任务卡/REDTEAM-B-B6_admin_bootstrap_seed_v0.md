━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营 I 窗）
  卡号：REDTEAM-B-B6_admin_bootstrap_seed
  阶段：红队 B 盲点 #B6（🟡低）· 派工 P2
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 15:05
  法源：EMPIRICAL-B_验3项_回执_红队B_2026-07-31.md · 盲点 B6
  优先级：P2（红队 B 建议优先修）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  首个 admin 需手动 INSERT
  现状：dev-reset 端点造测试用户，但 admin role 需手动 SQL
  风险：新部署无法测试 admin 例外路径（presence 校验 / B3 shared merge）

【阵地】server/    【禁区】nantang-mobile/

【施工内容】

  ① server/seed/admin_user.json 新建
     内容：
       {
         "id": "admin_bootstrap",
         "name": "系统管理员",
         "role": "admin",
         "wallet_address": "0x000...000",
         "avatar_seed": "admin_seed"
       }

  ② database.py init_db 加 admin bootstrap
     位置：buildings 种子加载后
     行为：
       - 查 User 表，无 admin → 插 admin_bootstrap
       - 密码走 env var ADMIN_BOOTSTRAP_PASSWORD（默认 'admin123'）
       - 加注释：「⚠️ 生产环境必须改 ADMIN_BOOTSTRAP_PASSWORD」

  ③ 文档：server/seed/README.md
     说明：
       - 首次启动自动建 admin_bootstrap 用户
       - 登录后立即改密码
       - 生产 env 必设 ADMIN_BOOTSTRAP_PASSWORD

  ④ 测试
     - 空数据库 init_db → 1 个 admin 用户
     - 已有 admin → 不重复插
     - ADMIN_BOOTSTRAP_PASSWORD 环境变量生效

  ⑤ pytest 增 3 测（基线 238 → 241）

【约束】
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - **只 commit 不 push**
  - 不引第三方库
  - 默认密码 'admin123' 仅 dev 用，README 警告

【回执落盘】
  方案/任务卡/REDTEAM-B-B6_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **新部署无 admin 是真问题** — 没人能提现 / 改配置
  - **默认密码必须警告** — README + init_db 注释双标
  - **环境变量可覆盖** — 生产 devops 友好
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
