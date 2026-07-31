---
created: 2026-07-31
card: CLEAN-WEEKLY-BE 终验报告
verifier: 丞相 Codex
verdict: PASS
status: 闸口就绪（等 push 与 A-CLEAN-WEEKLY 联动）
---

# CLEAN-WEEKLY-BE 终验 · 丞相

> 闸口就绪：19 项全交付，169 passed / 0 failed，禁区零碰。

## 一、机检（全绿）

| 项 | 结果 |
|---|---|
| pytest 全量 | 169 passed, 8 skipped（基线 159 → +10 新测试）|
| nantang-mobile/ 零改动 | 0 文件 |
| 6 文件 +585/-1 | 993c48a + a768351（回执）|
| git add 具名 | 6 文件逐一列出，无 -A |
| commit 只 commit 不 push | OK |

## 二、19 项施工逐条核

| # | 卡面要求 | 实际 | 判定 |
|---|----------|------|------|
| ① | 2 新表 | clean_weekly_tasks + clean_weekly_distributions | OK |
| ② | User.clean_weekly_streak | models.py L69 | OK |
| ③ | database.py 迁移 | 存量表补列 | OK |
| ④ | distribute 端点（admin）| clean_weekly.py L42-L81 | OK |
| ⑤ | GET tasks 轮询 | clean_weekly.py L85-L115 | OK |
| ⑥ | claim CAS 互斥 | with_for_update + status CAS | OK |
| ⑦ | unclaim（仅本人 + 周日截止）| clean_weekly.py L155-L188 | OK |
| ⑧ | submit 走 addVerification | clean_weekly.py L192-L236 | OK |
| ⑨ | 校核闭环 | nt.py L1100-L1119（+20 行钩子）| OK |
| ⑩-⑱ | 10 测试用例 6 类 | 169 passed | OK |

19/19 全交付。

## 三、状态机闭环验证

```
open ──claim──→ claimed ──submit+approve──→ completed
  ↑                 │
  └──unclaim────────┘
```

测试覆盖：TestApproveCompletesTask 全流程 distribute→claim→submit→approve→completed+streak=1

## 四、校核闭环复用性（关键设计）

- 走 `Verification(type='clean_weekly', detail.clean_weekly_task_id)` 现有表
- nt.py approve 路径加 try/except 钩子，**不阻塞主流程**
- reward_nt 从 task 表取（不信客户端）
- streak+1 在 approve 后

**复用 > 创造**——20 行钩子接上整条钱路，无新建结算逻辑。

## 五、闸口动作

| 卡 | 状态 | 何时 push |
|---|---|---|
| CLEAN-WEEKLY-BE | 终验 PASS | push 2 commits（a768351 + 993c48a）|
| A-CLEAN-WEEKLY | 一营 UI-FIX-P0 中（暂缓）| 等 UI-FIX-P0 完工后单独派 |

**前端依赖顺序**：UI-FIX-P0 完工 → 派 A-CLEAN-WEEKLY（用 UI.Card 范式建选卡 UI）→ 与 CLEAN-WEEKLY-BE 同批 push。

## 六、上线后冒烟

```
- [ ] distribute 端点 admin 200 / 非 admin 403
- [ ] GET tasks?week=YYYY-MM-DD 返回本周所有 task
- [ ] claim 第二人 400（CAS 互斥）
- [ ] unclaim 非本人 403
- [ ] submit + approve → task completed + streak=1
```

---
丞相 Codex · 2026-07-31 · commit 993c48a + a768351 终验
