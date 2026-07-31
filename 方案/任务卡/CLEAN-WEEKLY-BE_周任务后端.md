━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：CLEAN-WEEKLY-BE（大扫除周任务服务端）
  阶段：阶段 4/4 · 后端
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex + 双路红队 A/B
  立卡：丞相 Codex 2026-07-31
  法源：方案/设计系统底座_v0 + 方案/卡片化范式v0 + 方案/现有UI体检v0
  复杂度：⭐⭐⭐⭐ 涉钱级 + 状态机 + 轮询
  前端依赖：A-CLEAN-WEEKLY（阶段 3 第 1 张）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【优先级】HIGH（用户 07-31 御批：游戏化升级特殊通道）

【阵地】server/    【禁区】nantang-mobile/

【背景】
  砚仁 07-31 御批：现有"快速打扫"流程不友好。新流程 = 管理员选位 → 周一发放 → 选英雄式选卡 → 校核闭环。
  选卡互斥用 3 秒轮询（FE 拉 /api/clean_weekly/tasks 实时刷新）。
  「快速打扫」保留为应急通道（已有 app.js:6127）。
  走现有 addVerification 校核闭环（不重建结算）。

【数据模型】

  ① 新增表 `clean_weekly_tasks`（任务实例表）
     - id (UUID, PK)
     - week_start_date (Date, 周一日期)
     - space_id (str, 13 个建筑物空间之一)
     - space_name (str)
     - reward_nt (int, 默认 15 — 脏污等级 yellow)
     - status (enum: 'open' / 'claimed' / 'locked' / 'completed')
     - claimed_by (FK users, nullable)
     - claimed_at (DateTime, nullable)
     - created_by (FK users, 管理员)
     - created_at (DateTime)

  ② 新增表 `clean_weekly_distributions`（发放批次表）
     - id (UUID, PK)
     - week_start_date (Date, 周一日期)
     - distribute_at (DateTime, 周一 15:00)
     - space_ids (JSON list)
     - mode (enum: 'even' / 'by_count')
     - created_by (FK users)
     - created_at (DateTime)

  ③ User 加 `clean_weekly_streak` (int, 连续周参与数 — 后续勋章用)

【端点（5 个）】

  ④ POST /api/clean_weekly/distribute
     - 入参：week_start_date / space_ids[] / mode / distribute_at
     - 权限：Depends(require_admin) 或 builder 角色
     - 行为：建 distribution + 自动建 N 个 task（status='open'）

  ⑤ GET /api/clean_weekly/tasks?week=YYYY-MM-DD
     - 返回：本周所有 task + 状态 + claimed_by 信息
     - 限速：100/分钟（防刷）
     - 用于 FE 3 秒轮询

  ⑥ POST /api/clean_weekly/claim/{task_id}
     - 权限：Depends(get_current_user)
     - 行为：CAS 更新（status=open → claimed, claimed_by=current_user）
     - 拒绝条件：status != 'open' / 用户已领过本周其他 task / 用户不是 member

  ⑦ POST /api/clean_weekly/unclaim/{task_id}
     - 权限：task.claimed_by == current_user
     - 行为：CAS 更新（status=claimed → open, claimed_by=null）
     - 截止时间：周日 23:59

  ⑧ POST /api/clean_weekly/submit/{task_id}
     - 走 addVerification 校核闭环
     - 校核通过后：status='completed' + 结算 NT

【结算逻辑】

  ⑨ 校核 approve 路径：调 addVerification 走现有闭环
     - reward_nt 从 task 表取（不信客户端）
     - 完成后 status='completed'，不再可 unclaim

【测试（6 项）】

  ⑩ distribute 创建 N 个 task
  ⑪ claim CAS 互斥（并发抢同一 task）
  ⑫ unclaim 限制（仅 claimed_by 可 unclaim）
  ⑯ 校核通过后 task 状态 completed
  ⑰ FE 轮询 3 秒看到 status 变化
  ⑱ admin 才能 distribute

【铁律】
  - 只 commit 不 push · git add 具名（禁 -A）· 只碰 server/
  - pytest tests/ -q 全绿（基线 159 + 6 新测试 = 165 passed）
  - commit 例："feat(CLEAN-WEEKLY-BE): 周任务实例表+轮询端点 · 二营"
  - 回执落盘 方案/任务卡/CLEAN-WEEKLY-BE_回执_二营_2026-07-31.md
  - 含【皇帝验收单】+【红队验收】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
