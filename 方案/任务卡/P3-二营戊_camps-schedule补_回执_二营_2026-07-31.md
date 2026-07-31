# 回执：P3-二营戊_camps-schedule补

| 字段 | 值 |
|------|-----|
| 卡号 | P3-二营戊_camps-schedule补 |
| 施工方 | 二营 Qoder（后端 BE） |
| commit | `da6b9f0` |
| 立卡 | 丞相 Codex 2026-07-31 18:40 |
| 完工 | 二营 Qoder 2026-07-31 |

---

## 改动清单（3 文件，+158 行）

### 1. `server/routes/camps.py`（+40 行）
新增 `@router.get("/schedule")` 端点：
- 跨所有 active 营地的 `schedule` JSON 字段合并
- 按 `date` + `time` 升序排序
- 标 `camp_id` + `camp_name`
- 可选 `start_date` / `end_date` 参数过滤日期范围
- 缺字段 / JSON 解析失败 → 跳过（try/except 容错）

插入位置：`/budget` 之后、`""` (list_camps) 之前，避免路径参数冲突。

### 2. `server/tests/test_camps_schedule.py`（新建，+118 行）
3 测覆盖 3 判据：

| 测试 | 覆盖判据 |
|------|---------|
| `test_camps_schedule_returns_aggregated_events` | ① 聚合：2 Camp × 2 events = 4 items，按 date 升序 |
| `test_camps_schedule_filters_by_date_range` | ② 日期过滤：start_date=2026-08-01 & end_date=2026-08-31 → 仅返 8 月 |
| `test_camps_schedule_handles_missing_schedule` | ③ 缺字段容错：schedule=None → 不崩，跳过 |

### 3. `server/main.py`（+1/-1 行）
注释清理：
```python
# 修改前
app.include_router(potluck_router)         # P1-#6 ③ 田间接龙
# 修改后
app.include_router(potluck_router)         # K-REDTEAM-FIX ① 共享厨房接龙
```

---

## 验证

```bash
# 3 新测单独跑
cd server && set JWT_SECRET=test-secret
python -m pytest tests/test_camps_schedule.py -v --tb=short
# → 3 passed
```

输出：
```
tests/test_camps_schedule.py::TestCampsScheduleAggregation::test_camps_schedule_returns_aggregated_events PASSED
tests/test_camps_schedule.py::TestCampsScheduleDateFilter::test_camps_schedule_filters_by_date_range PASSED
tests/test_camps_schedule.py::TestCampsScheduleMissingField::test_camps_schedule_handles_missing_schedule PASSED
======================= 3 passed, 15 warnings in 1.00s ========================
```

### 回归验证
全量 `pytest tests/ -q --tb=line --ignore=tests/test_kitchen.py`（排除非本卡的 kitchen 残留文件）：
- **259 passed**, 7 failed（全为预存顺序依赖：vote_right 3 + dev_reset 1 + inn_rooms 2 + inn_track 1）
- 基线对比（stash 前代码）：255 passed + 8 pre-existing failures → 本次 **+4 net passed**（3 新测 + test_camp_report 从失败转通过）
- **零回归**

---

## 约束遵守

- ✅ 走 `server/` 阵地
- ✅ 未碰 `nantang-mobile/`
- ✅ 1 commit（camps.py + test_camps_schedule.py + main.py）
- ✅ pytest 无新回归（3 新测全绿）
- ✅ 只 commit 不 push

---

## 太傅注 3 行
- **schedule 不是 list** — list 是营地清单，schedule 是时间表，语义不可混；独立端点避免 `/api/camps/{camp_id}` 路径参数吞掉 "schedule" 关键词
- **容错优先** — `json.loads` 的 try/except 保证一条坏数据不炸全量聚合，缺失字段静默跳过
- **注释同步** — 与 K-REDTEAM-FIX 系列目标保持一致，"田间断掉"残留已清
