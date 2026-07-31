━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  红队 A 验工单（戊乙两卡完工后派）
  卡号：REDTEAM-A_验P3-二营戊乙_v0
  阶段：二营两卡完工验证
  验收方：红队 A（第三方 AI·技术悲观）
  派工方：丞相 Codex
  立卡：2026-07-31 18:52
  优先级：P0（防假完工·防 commit msg 误导）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【两卡验工清单】

═══════════════════════════════════════════
卡 1：P3-二营戊 camps-schedule 补
═══════════════════════════════════════════

  □ 验 1：/api/camps/schedule 路由真注册
    命令：python -c "from main import app; [print(r.methods, r.path) for r in app.routes if 'schedule' in getattr(r,'path','')]"
    期望：含 GET /api/camps/schedule

  □ 验 2：schedule 字段聚合 + 日期过滤
    命令：pytest tests/test_camps_schedule.py -v
    期望：3 测全过（聚合 / 日期过滤 / 缺字段容错）

  □ 验 3：main.py 注释清理
    命令：grep "田间接龙" server/main.py
    期望：无匹配

  □ 验 4：commit msg 与 diff 一致
    命令：git show --stat HEAD
    期望：3 文件（camps.py + test_camps_schedule.py + main.py）

  □ 验 5：禁区确认
    命令：git show --name-only HEAD | grep nantang-mobile
    期望：无匹配

═══════════════════════════════════════════
卡 2：P3-二营乙 共享厨房数据表
═══════════════════════════════════════════

  □ 验 1：4 张新表真创建
    命令：grep "^class.*Base" server/models.py | grep -E "Potluck|Kitchen|Shared"
    期望：4 行匹配

  □ 验 2：10 端点真注册
    命令：python -c "from main import app; [print(','.join(sorted(r.methods-{chr(72)EAD,chr(79)PTIONS})), r.path) for r in app.routes if hasattr(r,'path') and 'kitchen' in r.path]"
    期望：10 路由

  □ 验 3：8 测试全绿
    命令：pytest tests/test_kitchen.py -v
    期望：8 测全过

  □ 验 4：容量规则后端定
    代码审：test_slot_book_* 测 ≤10/11-20/>20 三档逻辑
    期望：后端 hard-coded，前端不参与

  □ 验 5：commit msg 与 diff 一致
    命令：git show --stat HEAD
    期望：5 文件（models.py + routes/kitchen.py + main.py + database.py + test_kitchen.py）

  □ 验 6：禁区确认
    命令：git show --name-only HEAD | grep nantang-mobile
    期望：无匹配

  □ 验 7：FE 接线预留
    命令：grep -c "kitchen" nantang-mobile/js/api.js
    期望：当前 0（前端 1 营等二营完工后再接）

═══════════════════════════════════════════
红队 A 验工回执落盘
═══════════════════════════════════════════

  方案/任务卡/REDTEAM-A_验P3-二营戊乙_回执_红队A_2026-07-31.md
  格式：12 验项 × (✅/⚠️/❌) + 关键证据
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━