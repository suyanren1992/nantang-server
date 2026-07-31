---
created: '2026-07-31'
project: 南塘云村
type: 回执
domain: 二营K窗
task_status: 已交付
status: 待验收
series: NEW-USER-TASK-FIX-BE
---

# NEW-USER-TASK-FIX-BE 回执 · 二营 K 窗 · 2026-07-31

## 判据对照

| # | 卡面要求 | 二营交付 | 验证 |
|---|---------|---------|:--:|
| ① | tasks.py:79-86 list_tasks 序列化补 `is_newbie_task` | `tasks.py:87`：`"is_newbie_task": getattr(t, "is_newbie_task", False)` —— deadline 已在 L81，无需新增 | ✅ |
| ② | 测试 5 个 | `test_task_is_newbie.py`：is_newbie_task 字段含 / deadline 字段含 / 新人 true / 普通 false / deadline null | ✅ |
| ③ | OpenAPI tasks schema 加字段 | `openapi_2026-07-31.yaml`：新增 NTTask schema（68 行），含 `is_newbie_task` (boolean) + `deadline` (nullable date-time) | ✅ |
| ④ | pytest 基线 244 → ≥248 | **249 passed**（基线 244 + 新增 5），8 skipped，4 预存失败与本卡无关 | ✅ |

## 改动清单

```
server/routes/tasks.py                        | +1 行   补 is_newbie_task 序列化
server/tests/test_task_is_newbie.py           | +130 行  5 测试
方案/契约/openapi_2026-07-31.yaml             | +65 行  NTTask schema
```

- commit: `df51edc`

## 关键设计决策

- **`getattr(t, "is_newbie_task", False)`**：防御式取值——存量 ORM 实例（旧版模型无此列）不会 AttributeError，安全回退 `False`。
- **deadline 已存在**：`tasks.py:81` 原本就有 `"deadline": t.deadline`，卡面标注"补 deadline"系误判——实际只需补 `is_newbie_task`。
- **5 测而非 4 测**：卡面列 4 个判据，但 deadline null 边界是显式需求，拆成独立 case（P2 精度）。

## 验证

```bash
# 新测试（5 passed）
cd server && python -m pytest tests/test_task_is_newbie.py -v
# 5 passed ✅

# 全量回归（249 passed, 8 skipped, 4 预存失败）
cd server && python -m pytest tests/ -q
# 249 passed, 8 skipped ✅
# 4 预存失败：test_dev_reset / test_inn_rooms_list (×2) / test_inn_track
#  与 REDTEAM-B-B6 回执一致，非本卡引入
```

## 太傅注

红队 A 挖出的是一条三方断裂线：BE 不发 → FE 不存 → 功能静默失效。二营 K 窗补了 BE 侧的缺口——一行 `getattr` 加一个 Schema 定义。但 FE 侧还有两条缝（sync 映射缺 `is_newbie_task` + `expires_at`→`deadline` 字段名错位），那是一营的活。
**字段链的每一环都是脆的——BE 序列化漏一个字段，FE 静默失效，验收 mock 数据看不出来。修链要两端一起修。**

---
> 二营 K 窗交付完毕，待丞相验收。
