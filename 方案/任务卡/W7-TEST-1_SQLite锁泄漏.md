---
created: '2026-08-02'
type: 任务卡
编号: W7-TEST-1
标题: test_accounting_check_and_verify_same_diff teardown SQLite 锁泄漏
派给: 二营
优先级: 🟢 P3（质量 · 不阻塞业务）
轨: A 后端（仅测试修复 · conftest.py）
前置: 无
禁区: 不得改业务代码；只动测试基础设施
法源: 待办总账 #13 + 全量测试偶发 "database is locked" error
---

> ⚠ **本卡遵循：`Schema\施工流程.md` v0.5**（铁律 10 入口强制）
> **档位**：小卡（仅测试基础设施 · 单文件）
> **自检命令**：连续跑 5 次 `pytest tests/test_p0_ssot_chain.py::test_accounting_check_and_verify_same_diff -q`，不应出现 teardown error

---

# W7-TEST-1 · SQLite 锁泄漏修复

## 一、为什么开

全量测试偶发 2 个 teardown error：

```
ERROR test_p0_ssot_chain.py::test_accounting_check_and_verify_same_diff
ERROR test_p0_ssot_chain.py::test_backfill_is_idempotent_by_txhash
sqlite3.OperationalError: database is locked
```

**根因推断**：`conftest.py` 的 `_isolate_db` fixture 在 teardown 时 `await conn.execute(tbl.delete())`，SQLite 串行写锁下前一个测试的连接没释放，后一个 teardown 排队超时。

**单跑都绿，全量偶发** — 典型的连接池泄漏。

## 二、做什么

### 修 `tests/conftest.py`

`_isolate_db` teardown 逻辑：
1. 每个 table delete 后加 `await conn.commit()`（不攒到最后）
2. 或者改 teardown 为 `DROP TABLE + CREATE TABLE`（比逐行 DELETE 快，减少锁窗口）
3. 最坏情况：delete 前加 `await asyncio.sleep(0.1)`（不是好方案，但能确认是不是竞态）

**修法由施工方勘察后确定。** 目标：连续跑 5 次全量不出 "database is locked"。

## 三、不做什么
- 不改业务代码
- 不新增测试
- 不修其他警告

## 四、自检命令

```powershell
# 连续跑 5 次，不应出现 teardown error
1..5 | ForEach-Object {
    $env:PYTHONUTF8='1'; $env:JWT_SECRET='devsecret'
    .\.venv\Scripts\python.exe -m pytest server/tests/test_p0_ssot_chain.py -q --tb=line
}
```

---

**太傅注**
- 补课：SQLite 不支持行级锁——整个数据库同一时间只有一个写者。teardown DELETE 在事务里排队的现象叫"锁竞争"。
- 一句原理：DELETE + COMMIT 拆开 → 每次释放写锁 → 下个 DELETE 不用等。本质是缩小临界区。
- 不这样做会怎样：CI 偶发红灯 = 每次都要人工点"重跑" = 狼来了 = 真有 bug 也以为是偶发。
