"""P0-IDX: 索引建立必须容错——单条失败不得阻断启动。

两次生产事故的回归哨兵：
  ① journal(user)            —— PG 保留字未加引号
  ② nt_tasks(is_newbie_task) —— 建索引排在轻量迁移 ALTER 之前
判据：注入必然失败的 DDL 后，_build_indexes 仍正常返回而不抛异常。
"""
import pytest
import database as D


@pytest.mark.asyncio
async def test_bad_index_does_not_raise(_setup_db):
    """注入 2 条坏 DDL：列不存在 + 表不存在 —— 必须不抛，只计入 failed。"""
    bad = [
        "CREATE INDEX IF NOT EXISTS idx_probe_badcol ON nt_tasks(col_not_exist)",
        "CREATE INDEX IF NOT EXISTS idx_probe_badtbl ON tbl_not_exist(x)",
    ]
    orig = D._INDEX_DDL[:]
    D._INDEX_DDL.extend(bad)
    try:
        ok, failed = await D._build_indexes()   # 不抛即通过
    finally:
        D._INDEX_DDL[:] = orig
    names = [n for n, _ in failed]
    assert "idx_probe_badcol" in names, f"坏列索引应被记为失败, got {names}"
    assert "idx_probe_badtbl" in names, f"坏表索引应被记为失败, got {names}"
    assert ok >= 1, "正常索引仍应建成"


@pytest.mark.asyncio
async def test_all_real_indexes_succeed(_setup_db):
    """真实 30 条索引在完整 schema 上应全部建成（0 失败）。"""
    ok, failed = await D._build_indexes()
    assert failed == [], f"真实索引不应有失败: {failed}"
    assert ok == len(D._INDEX_DDL)


def test_no_bare_create_index_in_init_db():
    """结构哨兵：init_db 内不得再出现裸 CREATE INDEX 执行（防回归）。"""
    src = open(D.__file__, encoding="utf-8").read()
    assert 'conn.execute(text("CREATE INDEX' not in src
    assert "conn.execute(text('CREATE INDEX" not in src


def test_index_ddl_has_no_unquoted_reserved_word():
    """PG 保留字必须加引号（事故①回归）。"""
    RESERVED = {"user", "order", "time", "check", "table", "column", "default",
                "group", "end", "start", "references", "primary", "unique"}
    bad = []
    for ddl in D._INDEX_DDL:
        cols = ddl.split("(", 1)[1].rsplit(")", 1)[0]
        for c in cols.split(","):
            c = c.strip().replace(" DESC", "").replace(" ASC", "").strip()
            if c.lower() in RESERVED and not c.startswith('"'):
                bad.append(ddl)
    assert bad == [], f"保留字列未加引号: {bad}"
