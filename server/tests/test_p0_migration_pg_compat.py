"""P0-MIG: 轻量迁移 DDL 的 Postgres 兼容 + 失败可见性哨兵。

第三次生产事故（登录后持续加载）根因：
    ALTER TABLE nt_tasks ADD COLUMN is_newbie_task BOOLEAN DEFAULT 0
PG 不接受布尔列用 0/1 作默认值 -> 该 ALTER 每次启动都失败 -> 3 个列从未建成
-> 凡查任务的接口全部 500。而 `except Exception: rollback()` 把错咽掉，
启动照常成功，本地 SQLite 又接受 DEFAULT 0，故本地全绿、线上全挂。

本文件不连 PG，只做静态结构哨兵——这类雷的共性是"能被静态查出，却测不出来"。
"""
import re
import database as D

SRC = open(D.__file__, encoding="utf-8").read()


def _migration_ddls():
    return re.findall(r'"(ALTER TABLE [^"]+)"', SRC)


def test_no_boolean_default_numeric():
    """布尔列默认值必须用 TRUE/FALSE，不得用 0/1（PG 报 datatype mismatch）。"""
    bad = [d for d in _migration_ddls()
           if re.search(r"BOOLEAN\s+DEFAULT\s+[01]\b", d, re.I)]
    assert bad == [], f"布尔默认值用了数字，PG 上必失败: {bad}"


def test_no_reserved_word_column_unquoted_in_alter():
    """ADD COLUMN 的列名不得是未加引号的 PG 保留字。"""
    RESERVED = {"user", "order", "time", "check", "table", "column",
                "default", "group", "end", "start", "references"}
    bad = []
    for d in _migration_ddls():
        m = re.search(r"ADD COLUMN\s+(\S+)", d, re.I)
        if m and m.group(1).strip('"').lower() in RESERVED                 and not m.group(1).startswith('"'):
            bad.append(d)
    assert bad == [], f"保留字列名未加引号: {bad}"


def test_migration_failures_are_logged_not_swallowed():
    """迁移失败不得静默——每个 rollback 前都要留痕，否则线上无从发现。"""
    assert "except Exception:\n            await session.rollback()" not in SRC,         "存在静默吞错的迁移 except（无日志），线上失败将无人知晓"
    assert "except Exception:\n                await session.rollback()" not in SRC
    assert hasattr(D, "_log_migration_skip")


def test_log_migration_skip_classifies_real_failure(caplog):
    """真判据：真故障必须 WARNING，幂等的'已存在'只 debug。"""
    import logging
    with caplog.at_level(logging.DEBUG, logger="nantang.db"):
        D._log_migration_skip(Exception('column "x" of relation "y" already exists'))
        D._log_migration_skip(Exception("syntax error at or near \"0\""))
    levels = {r.levelno for r in caplog.records}
    msgs = " | ".join(r.getMessage() for r in caplog.records)
    assert logging.WARNING in levels, f"真故障未告警: {msgs}"
    warns = [r.getMessage() for r in caplog.records if r.levelno >= logging.WARNING]
    assert len(warns) == 1, f"'已存在'不该告警，实际告警: {warns}"
    assert "MIGRATION-FAIL" in warns[0]
