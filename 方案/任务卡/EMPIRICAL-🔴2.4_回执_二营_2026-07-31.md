---
created: '2026-07-31'
project: 南塘云村
type: 回执
domain: 实证审查
task_status: 已交付
status: 待验收
series: EMPIRICAL-🔴2.4
---

# EMPIRICAL-🔴2.4 回执 · 二营 G 窗 · 2026-07-31

## 判据对照

| # | 卡面要求 | 二营交付 | 验证 |
|---|---------|---------|:--:|
| ① | presence 加所属权校验（uid≠current_user && !admin → 403） | data.py L425-426：3 行校验，非 admin 改他人 presence → 403 | ✅ |
| ② | 测试：A 写自己 → 200 / A 写 B → 403 / admin 写任意 → 200 / 无 token → 401 | test_presence_ownership.py 5 测试（含混合写整包拒绝边界） | ✅ |
| ③ | e2e smoke presence 测试仍通过 | test_e2e_smoke.py::test_full_capital_loop → 6 passed | ✅ |
| ④ | pytest 全绿 228+≥4=232 | **234 passed, 8 skipped**（4 预存失败与本次无关） | ✅ |

## 改动清单

```
server/routes/data.py                            | +3 行  presence 所属权校验
server/tests/test_presence_ownership.py          | +88 行  5 测试
```

## 关键设计决策

- **整包拒绝**：presence dict 中任意 uid 非本人且非 admin，整包 403。不部分批准（防偏序操作）。
- **admin 例外**：admin 可改任意用户 presence，符合 admin 全权预期。

## 验证

```bash
# 新测试（5 passed）
cd server && python -m pytest tests/test_presence_ownership.py -v
# 5 passed ✅

# 全量回归（234 passed, 8 skipped, 4 预存失败）
cd server && python -m pytest tests/ -q
# 234 passed, 8 skipped ✅
```

## 太傅注

安全 P0 往往藏在一行缺少的 if 语句里。presence 可伪造 = 在线状态不可信 = 翻牌显示失实 + 治理权被利用。3 行校验，5 个测试，零新依赖。
**安全加固的本质不是加锁，是补"该检查但没检查"的缺口。**

---
> 二营 G 窗交付完毕，待一营验收。
