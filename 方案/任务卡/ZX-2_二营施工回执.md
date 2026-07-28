---
created: '2026-07-29'
project: 南塘云村
type: 回执
task_status: 二营施工完成
domain: 后端测试
status: 待丞相亲验
---

# ZX-2 二营施工回执 · deduct 模式回归测试

> 卡面：丞相派工 ZX-2（砚仁已批准）
> 来源：G-3 验收裁夺点三（O-1）——mode 开关无人试过不算安全垫
> 施工：Claude Code（二营，丞相亲令越阵地）
> 验收：丞相亲验
> 基底：main 最新（含 G-3 `1e38f78`）

## 施工内容

`server/tests/test_accommodation_daily.py` 增补 1 个测试，零业务代码改动。

### 新增测试：`test_deduct_mode_charges_balance_and_idempotent`

```python
monkeypatch.setattr(nt, "ACCOMMODATION_DAILY_MODE", "deduct")
```

**断言旧日扣语义（五条全量）**：

| # | 断言 | 实现 |
|---|------|------|
| 1 | 余额扣减 | `eve.nt_balance == 200 - BED_RATE`（200→180） |
| 2 | 流水类型+状态 | `NTLedger.type == "accommodation_fee"` + `status == "settled"` |
| 3 | 流水金额 | `ledgers[-1].amount == BED_RATE`（20） |
| 4 | last_deducted 更新 | `ten.last_deducted == today` |
| 5 | 同日幂等 | 第二次 tick → `r2.json().get("skipped") is True`；余额不变 |

## 判据

### 1. 新测 PASSED ✅
```
tests/test_accommodation_daily.py::test_deduct_mode_charges_balance_and_idempotent PASSED
```

### 2. accrual 既有 5 测不受影响 ✅
```
test_daily_tick_deducts_when_balance_sufficient PASSED
test_daily_tick_accumulates_debt_when_insufficient PASSED
test_daily_tick_idempotent_same_day PASSED
test_daily_tick_catches_up_missed_days PASSED
test_daily_tick_requires_admin PASSED
```

### 3. settlement 既有 4 测不受影响 ✅
```
test_checkout_settles_when_balance_sufficient PASSED
test_checkout_records_debt_when_insufficient PASSED
test_checkin_blocked_when_debt_over_limit PASSED
test_checkin_allowed_when_debt_under_limit PASSED
```

### 4. 全量零回归 ✅
```
$ pytest --tb=short
50 passed, 4 skipped, 0 failed
```
skipped 4 个全为 PG 锁测试（SQLite 正确跳过），含 G-3 新增的 `test_covenant_sign_populate_existing_reads_fresh`。

## 变更文件

| 文件 | 改动 |
|------|------|
| `server/tests/test_accommodation_daily.py` | +42 行，1 个新测试函数 |

**零业务代码改动**（routes/nt.py / models.py 等均未动）。

## 机检

```
git diff --stat: 1 file changed, 42 insertions(+)
grep -r "ACCOMMODATION_DAILY_MODE" server/routes/ — 仅 nt.py:985 一处定义，未改
deploy_check: 未跑（纯测试增补，无部署影响）
```

## 附评

- **mode 开关验证价值**：deduct 分支 (`nt.py:1041-1054`) 是 G-3 保留的回滚安全垫——如果 accrual 模式出问题，改环境变量即可切回旧日扣。Z-2 证实这个开关真的能切、切了真的对。在此之前无人实跑过 deduct 路径。
- **monkeypatch 注意**：`ACCOMMODATION_DAILY_MODE` 是模块级变量（非每请求读取），测试用 `monkeypatch.setattr` 而非 `monkeypatch.setenv`——若用 env 方式会在已导入模块上失效。此坑已在测试文件以注释标明，防后续维护者踩。

## 太傅注（三行）

- **安全垫必须测试**：代码里留了 `if MODE == "deduct"` 分支声称「可回滚」，但从未跑过——等于消防通道上了锁。ZX-2 就是那把锁的钥匙测试。
- **module-level config 的测试坑**：`os.environ.get()` 在 import 时求值一次，测试中改环境变量已来不及。`monkeypatch.setattr(target_module, "VAR", value)` 是正确姿势。
- **Pool 盈余划拨的测试隔离**：daily_tick 有「池 > 1000 → 转储备」逻辑，测试中勿断言 pool 绝对值，改验 `accommodation_fees` 响应字段 + 用户余额变化。
