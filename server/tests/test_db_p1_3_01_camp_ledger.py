# -*- coding: utf-8 -*-
"""DB-P1-3 ①: 删 camp_ledgers 孤儿表测试。

判据：
  1. CampLedger 类已从 models.py 移除
  2. init_db 后 camp_ledgers 表不存在
  3. 现有营地功能不受影响（camps CRUD 正常）
"""
import pytest
from sqlalchemy import text, inspect

from auth_utils import hash_password
from database import async_session, engine


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="admin"):
    from models import User
    from sqlalchemy import select
    async with async_session() as s:
        exists = (await s.execute(
            select(User).where(User.id == name)
        )).scalar_one_or_none()
        if exists is None:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=500, trust_score=100, role=role))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


# ══ 1. CampLedger 类已移除 ══
class TestCampLedgerRemoved:
    def test_class_not_in_models(self):
        """导入 models 不应有 CampLedger 类。"""
        import models
        assert not hasattr(models, "CampLedger"), "CampLedger should be removed from models.py"


# ══ 2. init_db 后表不存在 ══
class TestCampLedgerTableDropped:
    @pytest.mark.asyncio
    async def test_table_not_exists(self):
        """init_db 后 DROP TABLE IF EXISTS 应确保表不存在。"""
        # 检查 SQLAlchemy 元数据中没有 camp_ledgers
        from models import Base
        table_names = Base.metadata.tables.keys()
        assert "camp_ledgers" not in table_names, (
            f"camp_ledgers should not be in metadata, found: {table_names}")

    @pytest.mark.asyncio
    async def test_table_not_in_db(self):
        """数据库中不应有 camp_ledgers 表。"""
        async with engine.connect() as conn:
            def _check(dialect_conn):
                insp = inspect(dialect_conn)
                return insp.get_table_names()
            tables = await conn.run_sync(_check)
            assert "camp_ledgers" not in tables, (
                f"camp_ledgers table should not exist in DB, found: {tables}")


# ══ 3. 营地功能不受影响 ══
class TestCampCRUDUnaffected:
    @pytest.mark.asyncio
    async def test_camp_create_list(self, client):
        """删除 camp_ledgers 不影响 camps CRUD。"""
        await _make_user("p13_camp_admin")
        tok = await _login(client, "p13_camp_admin")

        # 创建营地
        r = await client.post("/api/camps", headers=_h(tok), json={
            "name": "测试营", "goal": "测试营地目标",
        })
        assert r.status_code == 200, r.text

        # 列表
        r2 = await client.get("/api/camps", headers=_h(tok))
        assert r2.status_code == 200, r2.text
        camps = r2.json()
        assert any(c["name"] == "测试营" for c in camps)
