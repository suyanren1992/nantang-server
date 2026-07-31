# -*- coding: utf-8 -*-
"""DB-P1-3 ②: 10 缺失索引测试（v2 报告附录 A）。

判据：
  1. init_db 后 10 个索引全部存在
  2. 索引名不重复（无冲突）
"""
import pytest
from sqlalchemy import inspect

from database import engine, init_db

EXPECTED_INDEXES = [
    ("nt_ledger", "idx_nt_ledger_type_status"),
    ("nt_ledger", "idx_nt_ledger_created_at"),
    ("verifications", "idx_verifications_verifier"),
    ("camp_builders", "idx_camp_builders_camp_id"),
    ("canteen_menu", "idx_canteen_menu_date"),
    ("meal_orders", "idx_meal_orders_user"),
    ("clean_weekly_tasks", "idx_clean_weekly_tasks_week_start"),
    ("clean_weekly_tasks", "idx_clean_weekly_tasks_claimed_by"),
    ("clean_weekly_distributions", "idx_clean_weekly_dist_week_start"),
    ("tenancies", "idx_tenancies_track"),
]


# ══ 1. init_db 后 10 索引全部存在 ══
class TestTenIndexesExist:
    @pytest.mark.asyncio
    async def test_all_indexes_present(self):
        """init_db 后 10 个新索引全部存在。"""
        await init_db()
        async with engine.connect() as conn:
            def _get_indexes(dialect_conn):
                insp = inspect(dialect_conn)
                result = {}
                for table_name in set(t for t, _ in EXPECTED_INDEXES):
                    idxs = insp.get_indexes(table_name)
                    result[table_name] = [i["name"] for i in idxs]
                return result
            idx_map = await conn.run_sync(_get_indexes)

        missing = []
        for table, idx_name in EXPECTED_INDEXES:
            table_idxs = idx_map.get(table, [])
            if idx_name not in table_idxs:
                missing.append(f"{table}.{idx_name}")

        assert not missing, (
            f"{len(missing)}/10 indexes missing: {missing}\n"
            f"Found indexes: {idx_map}"
        )
