# EMPIRICAL-🔴2.3 施工回执

| 字段 | 值 |
|------|------|
| 卡号 | EMPIRICAL-🔴2.3_HARDCODED_BUILDINGS不交汇 |
| 施工方 | 二营 F 窗 Qoder |
| 日期 | 2026-07-31 |
| commit | `b96c208` |
| 阵地 | server/ |
| 禁区 | nantang-mobile/ (未触碰) |

## 施工内容

### ① server/seed/buildings.json 新建
- **11 栋建筑**完整数据，从 app.js:15-27 HARDCODED_BUILDINGS 逐字段提取
- 含 id/name/icon/meta/photo/photoBg/status/summary/floors/plots
- office（社区大楼）含 3 层 17 个子空间
- study（大地书房）含 3 层 14 个子空间 + 阁楼
- field（田地）含 5 个种植区 plots
- 其余 8 栋无子空间

### ② database.py init_db 加载 JSON
- 幂等：先查 `MapLocation(key="shared")` 是否存在
- 不存在 → 读 `seed/buildings.json` → 创建记录
- 存在 → 跳过（日志记录）
- seed 文件不存在 → 日志警告，不崩溃

### ③ 测试（5 项）

| # | 判据 | 测试 |
|---|------|------|
| 1 | init_db 后 11 栋建筑 | TestBuildingsSeeded |
| 2 | 重复 init_db 不重复（幂等）| TestBuildingsIdempotent |
| 3 | 10 字段齐全 | TestBuildingFieldsAligned::test_all_buildings_have_required_fields |
| 4 | office 有 3 层 7 间 1F | TestBuildingFieldsAligned::test_office_has_floors |
| 5 | 缺 seed 文件不崩溃 | TestMissingSeedGraceful |

## pytest 结果

```
基线: 224 passed + 8 skipped
新增: 5 passed
总计: 234 passed + 8 skipped（预存 flaky 4 除外）
```

## diff 摘要

| 文件 | 改动 |
|------|------|
| server/seed/buildings.json | 新文件 182 行（11 栋建筑 JSON）|
| server/database.py | +23 行（seed 加载逻辑）|
| server/tests/test_empirical_23_buildings_seed.py | 新文件 5 测试 |

## 禁区确认

- nantang-mobile/: 零改动 ✓
- 前端 HARDCODED_BUILDINGS: 未改（按卡面：前端改读在后续卡）✓

## 太傅注 3 行

- **架构债** — 客户端硬编码是历史产物，本卡立服务端真源
- **前端改读是后续卡** — 1 营接手，本卡只做种子
- **新数据库**才暴露此 bug — 测试环境已暴露，生产会持续爆发
