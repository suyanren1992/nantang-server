---
created: '2026-07-31'
project: 南塘云村
type: 施工回执
domain: 大扫除周任务后端
card: CLEAN-WEEKLY-BE
施工方: 二营（Qoder）
验收方: 丞相 Codex + 双路红队 A/B
commit: 993c48a
---
# CLEAN-WEEKLY-BE 施工回执 · 二营

## ① diff 摘要

| 文件 | 改动 | 说明 |
|---|---|---|
| `server/models.py` | +34 行 | ① `CleanWeeklyTask` + `CleanWeeklyDistribution` 两张表 + ③ `User.clean_weekly_streak` |
| `server/database.py` | +6 行 | ③ 存量表补 `clean_weekly_streak` 列迁移 |
| `server/routes/clean_weekly.py` | +236 行（新建） | ④-⑧ 5 端点：distribute / tasks / claim / unclaim / submit |
| `server/routes/nt.py` | +20 行 | ⑨ 校核 approve 后自动完成周任务 + streak +1 |
| `server/main.py` | +1 行 | 注册 `clean_weekly.router` |
| `server/tests/test_clean_weekly.py` | +289 行（新建） | ⑩-⑱ 6 类 10 个测试用例 |

**总 diff**：585 insertions / 1 deletion · 6 files changed

### 端点清单

| 端点 | 方法 | 权限 | 卡面编号 |
|---|---|---|---|
| `/api/clean_weekly/distribute` | POST | require_admin | ④ |
| `/api/clean_weekly/tasks?week=` | GET | get_current_user | ⑤ |
| `/api/clean_weekly/claim/{task_id}` | POST | get_current_user | ⑥ |
| `/api/clean_weekly/unclaim/{task_id}` | POST | get_current_user（仅本人） | ⑦ |
| `/api/clean_weekly/submit/{task_id}` | POST | get_current_user（仅本人） | ⑧ |

### 状态机

```
open ──claim──→ claimed ──submit+approve──→ completed
  ↑                 │
  └──unclaim────────┘
```

### 校核闭环（⑨）

- submit 端点建 `Verification(type='clean_weekly')`，detail JSON 含 `clean_weekly_task_id`
- reward_nt 从 task 表取（不信客户端）
- verifier_reward = max(1, reward_nt // 5)
- nt.py approve 路径：校核通过后检查 `vfy.type == 'clean_weekly'` → task.status = 'completed' + user.clean_weekly_streak += 1
- 所有状态更新均 try/except 包裹，不阻塞校核主流程

### 关键设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 任务 ID 格式 | `cwt_{week}_{space}_{i}` | 幂等，同周同空间不重复 |
| 发放幂等 | 同 `week_start_date` 只允许一次 distribute | 防重复发放 |
| 每人每周限领 1 task | claim 时查本周已有 claimed/completed | 公平分配 |
| unclaim 截止 | 周日 23:59（week_start_date + 6 天） | 卡面要求 |
| 行锁 | `with_for_update().execution_options(populate_existing=True)` | D-17 锁型，PG 有效 |

## ② pytest 结果

```
169 passed, 8 skipped, 1441 warnings in 86.08s
```

| 基线 | 新增 | 结果 |
|---|---|---|
| 159 passed | +10（6 类 10 个方法） | 169 passed ✅ |
| 8 skipped | 0 | 8 skipped ✅ |

### 测试覆盖（卡面 ⑩-⑱ 对照）

| 卡面编号 | 测试类 | 方法数 | 判据 |
|---|---|---|---|
| ⑩ distribute 创建 N 个 task | TestDistributeCreatesTasks | 2 | 3 task 创建 + 同周幂等 400 |
| ⑪ claim CAS 互斥 | TestClaimCAS | 2 | 成功 claim + 第二人 400 |
| ⑫ unclaim 限制 | TestUnclaimRestriction | 2 | 本人成功 + 非本人 403 |
| ⑯ 校核通过 task completed | TestApproveCompletesTask | 1 | 全流程 distribute→claim→submit→approve→completed+streak=1 |
| ⑰ 轮询看到 status 变化 | TestPollingStatusChange | 1 | open → claim → claimed |
| ⑱ admin 才能 distribute | TestDistributeAdminOnly | 2 | 非 admin 403 + admin 200 |

## ③ 禁区确认

```
nantang-mobile/ 改动行数 = 0
```

所有改动均在 `server/` 阵地内。

## ④ 皇帝验收单

| 验收项 | 卡面要求 | 实际 | 判定 |
|---|---|---|---|
| ① 2 新表 | clean_weekly_tasks + clean_weekly_distributions | ✅ models.py L386-L416 | PASS |
| ② User 字段 | clean_weekly_streak int | ✅ models.py L69 | PASS |
| ④ distribute | admin + 批量建 N task | ✅ clean_weekly.py L42-L81 | PASS |
| ⑤ GET tasks | 轮询端点 | ✅ clean_weekly.py L85-L115 | PASS |
| ⑥ claim CAS | status=open→claimed | ✅ clean_weekly.py L119-L151 | PASS |
| ⑦ unclaim | 仅本人 + 周日截止 | ✅ clean_weekly.py L155-L188 | PASS |
| ⑧ submit | 走 addVerification | ✅ clean_weekly.py L192-L236 | PASS |
| ⑨ 校核闭环 | approve 后 completed + streak | ✅ nt.py L1100-L1119 | PASS |
| ⑩-⑱ 6 测试 | 10 方法 6 类 | ✅ 169 passed | PASS |
| pytest 全绿 | 基线 159+6=165 | 实际 159+10=169（超出 4 个边界测试） | PASS |
| 禁区 | nantang-mobile/ = 0 | ✅ 0 改动 | PASS |
| 不引第三方库 | 无新依赖 | ✅ 仅用 stdlib + 现有 sqlalchemy/fastapi | PASS |
| 只 commit 不 push | 本地 commit 993c48a | ✅ 未 push | PASS |
| git add 具名 | 6 文件具名 add | ✅ 禁 -A | PASS |

## ⑤ 红队验收

| 检查点 | 判定 |
|---|---|
| CAS 互斥真安全？ | `with_for_update` + `populate_existing` D-17 锁型，PG 有效；SQLite 测试覆盖单线程场景，真并发需 K-2 PG 锁测试补充 |
| 校核闭环不破坏现有流程？ | ✅ 钩子用 try/except 包裹，不阻塞主流程 |
| 状态机完整？ | open → claimed → completed + unclaim 回退 → open。无 locked 态（卡面未要求） |
| 幂等？ | 同周重复 distribute → 400；submit 已有 verification_id → 直接返回 |
| streak 正确？ | approve 后 +1；unclaim 后重新 claim + approve 仍 +1（每完成一次 +1） |

## 太傅注（三行）

- 校核闭环的关键不在新建端点，在"旧端点 approve 后回调新表"——nt.py 加了 20 行钩子就把整条钱路接上了，没有重建结算逻辑，这正是"复用 > 创造"的实践。
- 周任务状态机只有 3 态（open/claimed/completed），比 NTTask 的 11 态简单一个量级——复杂度控制在"刚好够用"，不过度设计 locked/expired 等未来态。
- claim 互斥用了 `with_for_update` + 状态 CAS 双重保护——SQLite 测试只验单线程，真 PG 上跑才能验并发，这条应在 K-2 扩展测试中补。
