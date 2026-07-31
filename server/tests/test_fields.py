# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE补 B6: 田间地块端点测试（5 用例）。

① 列表返回（空/有种）
② 详情 404
③ 收割成熟地块
④ 收割非成熟 400
⑤ 浇水 + 施肥
"""
import pytest
from datetime import datetime

from auth_utils import hash_password
from database import async_session
from models import User, FieldPlot, CommunityPool
from sqlalchemy import select


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="villager"):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if not exists:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=1000, trust_score=100, role=role))
            pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
            if pool is None:
                s.add(CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


async def _seed_plots():
    """种测试地块（幂等：已存在则跳过）。"""
    now = datetime.utcnow().isoformat()
    async with async_session() as s:
        existing = {row[0] for row in (await s.execute(
            select(FieldPlot.id).where(FieldPlot.id.in_(
                ("fp_mature", "fp_growing", "fp_fallow"))
            ))).all()}
        if "fp_mature" not in existing:
            s.add(FieldPlot(id="fp_mature", plot_name="东田A", crop_name="水稻",
                            planted_at="2026-06-01T00:00:00", stage="成熟",
                            health="健康", planted_by="fld_user", created_at=now))
        if "fp_growing" not in existing:
            s.add(FieldPlot(id="fp_growing", plot_name="西田B", crop_name="玉米",
                            planted_at="2026-07-15T00:00:00", stage="生长",
                            health="缺水", planted_by="fld_user", created_at=now))
        if "fp_fallow" not in existing:
            s.add(FieldPlot(id="fp_fallow", plot_name="南田C", stage="休耕",
                            health="健康", created_at=now))
        await s.commit()


class TestFieldsList:
    @pytest.mark.asyncio
    async def test_list_plots(self, client):
        """① 列表返回"""
        await _make_user("fld_user")
        await _seed_plots()
        tok = await _login(client, "fld_user")
        r = await client.get("/api/fields", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["total"] >= 3


class TestFieldsDetail:
    @pytest.mark.asyncio
    async def test_detail_404(self, client):
        """② 详情 404"""
        await _make_user("fld_user")
        tok = await _login(client, "fld_user")
        r = await client.get("/api/fields/nonexistent", headers=_h(tok))
        assert r.status_code == 404, r.text


class TestFieldsHarvest:
    @pytest.mark.asyncio
    async def test_harvest_mature_ok(self, client):
        """③ 收割成熟地块 → 休耕"""
        await _make_user("fld_user")
        await _seed_plots()
        tok = await _login(client, "fld_user")
        r = await client.post("/api/fields/fp_mature/harvest", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["plot"]["stage"] == "休耕"
        assert body["plot"]["crop_name"] is None

    @pytest.mark.asyncio
    async def test_harvest_non_mature_400(self, client):
        """④ 收割非成熟 → 400"""
        await _make_user("fld_user")
        await _seed_plots()
        tok = await _login(client, "fld_user")
        r = await client.post("/api/fields/fp_growing/harvest", headers=_h(tok))
        assert r.status_code == 400, r.text


class TestFieldsWaterFertilize:
    @pytest.mark.asyncio
    async def test_water_and_fertilize(self, client):
        """⑤ 浇水 + 施肥"""
        await _make_user("fld_user")
        await _seed_plots()
        tok = await _login(client, "fld_user")

        # 浇水：缺水 → 健康
        r = await client.post("/api/fields/fp_growing/water", headers=_h(tok))
        assert r.status_code == 200, r.text
        assert r.json()["plot"]["health"] == "健康"
        assert r.json()["plot"]["watered_at"] is not None

        # 施肥
        r2 = await client.post("/api/fields/fp_growing/fertilize", headers=_h(tok))
        assert r2.status_code == 200, r2.text
        assert r2.json()["plot"]["fertilized_at"] is not None

        # 休耕浇水 → 400
        r3 = await client.post("/api/fields/fp_fallow/water", headers=_h(tok))
        assert r3.status_code == 400, r3.text
