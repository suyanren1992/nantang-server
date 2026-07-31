# NEW-USER-TASK-BE 施工回执

| 字段 | 值 |
|------|------|
| 卡号 | NEW-USER-TASK-BE_新人任务BE_v0 |
| 施工方 | 二营 B 窗 Qoder |
| 日期 | 2026-07-31 |
| 阵地 | server/ |
| 禁区 | nantang-mobile/ (未触碰) |

## 施工内容（6 项串行）

### ① new_user_task_templates 表
- `models.py`: `NewUserTaskTemplate` 类——id / title / description / reward_nt / target_role / display_order / expires_days / created_at
- 复合索引: `(target_role, display_order)`
- `database.py`: 种子数据 4 模板（空表幂等播种）

| id | title | target_role | reward_nt |
|----|-------|-------------|-----------|
| tpl_meet_neighbor | 认识一下你的邻居 | visitor | 10 |
| tpl_covenant_sign | 浏览公约 + 签到 | visitor | 5 |
| tpl_first_cleanup | 参与第一次大扫除 | visitor | 15 |
| tpl_first_task | 领取你的第一个任务 | npc | 20 |

### ② Task 表加 3 字段
- `models.py` NTTask: `is_newbie_task` (bool, indexed) / `assigned_by_system` (bool) / `template_id` (FK, nullable)
- `database.py`: 3 条 ALTER TABLE 迁移（幂等 try/except）

### ③ checkin 触发派发
- `routes/accommodation.py`: `_checkin_newbie_hook()` 钩子
  - 复用 `User.first_checkin_date` 防重复派发
  - 用升级前角色匹配模板（visitor→npc 升级前先查 visitor 模板）
  - coop + inn 双路径均接入
  - 响应加 `assigned_newbie_tasks` 数组

### ④ 4 端点
- `routes/new_user_tasks.py`（新文件）:

| 端点 | 方法 | 权限 | 行为 |
|------|------|------|------|
| /api/new_user_tasks/templates | GET | auth | admin 全量 / 其他人 target_role=自己 |
| /api/new_user_tasks/assign | POST | admin | 手动派发（全量或指定 template_ids） |
| /api/new_user_tasks/me | GET | auth | 本人新人任务 + expired 标记 + 倒计时 |
| /api/new_user_tasks/{id}/complete | PATCH | auth | 建 Verification → 待 peer 校核 |

### ⑤ 校核闭环 + 结算
- `routes/nt.py` approve_verification 加 `newbie_task` 钩子:
  - approve 后 NTTask 状态 → 待结算（verified）
  - reward_nt 从 template 取（不信客户端）
- 结算走已有 addVerification 路径: CV=floor(nt/2) + XP 分桶递减
- `main.py`: 注册 new_user_tasks.router

### ⑥ 测试
- `tests/test_new_user_tasks.py`（新文件）12 个测试用例覆盖 8 项判据:

| # | 判据 | 测试类 |
|---|------|--------|
| 1 | 首次入住触发派发 | TestFirstCheckinTrigger |
| 2 | 模板按 display_order 排 | TestTemplateOrdering (2 tests) |
| 3 | 过期不显 | TestExpiredTasks |
| 4 | 新人任务走校核闭环 | TestNewbieVerificationFlow |
| 5 | CV/XP 公式生效 | TestCVXPFormula |
| 6 | 重复派发拦截 | TestDuplicateAssignmentBlock |
| 7 | admin 手动派发 | TestAdminManualAssign (3 tests) |
| 8 | GET /me 拉自己 | TestGetMyNewbieTasks (2 tests) |

## pytest 结果

```
基线: 195 passed + 8 skipped (零回归)
新增: 12 passed
总计: 207 passed + 8 skipped
```

## diff 摘要

| 文件 | 改动 |
|------|------|
| server/models.py | NewUserTaskTemplate 表 + NTTask 3 字段 (已在 97fdf79) |
| server/database.py | 3 ALTER TABLE + 索引 + 种子数据 (已在 97fdf79) |
| server/main.py | 注册 new_user_tasks.router (已在 97fdf79) |
| server/routes/accommodation.py | +_checkin_newbie_hook + coop/inn 双路径接入 |
| server/routes/nt.py | approve_verification 加 newbie_task 钩子 |
| server/routes/new_user_tasks.py | 新文件 4 端点 + _auto_assign_newbie_tasks |
| server/tests/test_new_user_tasks.py | 新文件 12 测试 |

## 禁区确认

- nantang-mobile/: 零改动 ✓
- routes/data.py: 零改动 ✓

## 验收单

- [x] 新表 new_user_task_templates + 4 种子
- [x] NTTask 加 is_newbie_task / assigned_by_system / template_id
- [x] checkin 首次入住自动派发（first_checkin_date 防重）
- [x] GET /templates (admin 全量 / 村民按 role)
- [x] POST /assign (admin 手动派发)
- [x] GET /me (本人新人任务 + 过期标记)
- [x] PATCH /{id}/complete (建 Verification 校核闭环)
- [x] approve 钩子标记任务待结算
- [x] CV=floor(nt/2) + XP 公式走已有路径
- [x] pytest 207 passed 零回归
- [x] 只 commit 不 push

## 太傅注 3 行

- **角色升级时序**——checkin 先 visitor→npc 再派发，但模板用升级前角色匹配，否则 visitor 用户永远只拿到 npc 模板
- **幂等三保险**——first_checkin_date 防重复派发 + 种子数据空表才播 + ALTER TABLE try/except
- **校核闭环复用**——新人任务不造新钱路，走 addVerification 已有的池→doer 路径，CV/XP 自动写入
