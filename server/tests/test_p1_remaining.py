# -*- coding: utf-8 -*-
"""P1 余 9 项回归测试（6 项）。

判据：
  1. /me 返回 xp_by_category（含 JSON 解析）
  2. /me 返回 clean_weekly_streak
  3. /sync 返回 xp_by_category + clean_weekly_streak
  4. list_camps 返回 budget/schedule/milestones
  5. camp_report 返回 budget/schedule/milestones
  6. 死字段标记存在（season/type/expired_at/doer_name_snapshot 有注释）
"""
import json
import pytest
from sqlalchemy import select

from auth_utils import hash_password
from database import async_session
from models import User, CommunityPool, Camp, CampBuilder, CampMembership


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="admin", xp_by_category=None, streak=0):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(
                id=name, password_hash=hash_password("Passw0rd!"),
                nt_balance=500, trust_score=100, role=role,
                xp_by_category=xp_by_category,
                clean_weekly_streak=streak,
            ))
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            s.add(CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


# ══ 1-2. /me 返回 xp_by_category + clean_weekly_streak ══

class TestMeReturnsXpAndStreak:
    @pytest.mark.asyncio
    async def test_me_returns_xp_by_category_null(self, client):
        """新用户 xp_by_category 为 None。"""
        await _make_user("p1_me_user1")
        tok = await _login(client, "p1_me_user1")
        r = await client.get("/api/auth/me", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "xp_by_category" in body, "me should return xp_by_category"
        assert body["xp_by_category"] is None

    @pytest.mark.asyncio
    async def test_me_returns_xp_by_category_json(self, client):
        """有值时 xp_by_category 解析为 dict。"""
        await _make_user("p1_me_user2", xp_by_category='{"labor": 50, "kitchen": 30}')
        tok = await _login(client, "p1_me_user2")
        r = await client.get("/api/auth/me", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["xp_by_category"] == {"labor": 50, "kitchen": 30}

    @pytest.mark.asyncio
    async def test_me_returns_clean_weekly_streak(self, client):
        """clean_weekly_streak 返回整数值。"""
        await _make_user("p1_me_user3", streak=5)
        tok = await _login(client, "p1_me_user3")
        r = await client.get("/api/auth/me", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "clean_weekly_streak" in body
        assert body["clean_weekly_streak"] == 5


# ══ 3. /sync 返回 xp_by_category + clean_weekly_streak ══

class TestSyncReturnsXpAndStreak:
    @pytest.mark.asyncio
    async def test_sync_returns_xp_and_streak(self, client):
        """/nt/sync 返回 xp_by_category 和 clean_weekly_streak。"""
        await _make_user("p1_sync_user1", xp_by_category='{"cleaning": 100}', streak=3)
        tok = await _login(client, "p1_sync_user1")
        r = await client.get("/api/nt/sync", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "xp_by_category" in body, "sync should return xp_by_category"
        assert body["xp_by_category"] == {"cleaning": 100}
        assert "clean_weekly_streak" in body, "sync should return clean_weekly_streak"
        assert body["clean_weekly_streak"] == 3


# ══ 4-5. list_camps + camp_report 返回 budget/schedule/milestones ══

class TestCampReturnsBudgetScheduleMilestones:
    @pytest.mark.asyncio
    async def test_list_camps_returns_budget(self, client):
        """list_camps 返回 budget/schedule/milestones。"""
        await _make_user("p1_camp_admin", role="admin")
        tok = await _login(client, "p1_camp_admin")

        # 创建营地（通过 API）— CampBudget 要求 adventurers/builders/lodgingNT/mealNT
        r = await client.post("/api/camps", headers=_h(tok), json={
            "name": "P1测试营地", "emoji": "🏕️", "theme": "测试",
            "desc": "测试营地", "status": "active", "date": "2026-08-01",
            "people": 5, "max": 10, "location": "测试地点",
            "highlights": ["亮点1"], "builders": [], "tasks": [],
            "budget": {"adventurers": 3, "builders": 2, "lodgingNT": 10, "mealNT": 5},
            "schedule": [{"day": 1, "activity": "开营"}],
            "milestones": [{"name": "第一周", "target": "完成引导"}],
        })
        assert r.status_code == 200, r.text
        camp_id = r.json()["camp_id"]  # create_camp 返回 camp_id 不是 id

        # list_camps
        r2 = await client.get("/api/camps", headers=_h(tok))
        assert r2.status_code == 200, r2.text
        camps = r2.json()
        camp = next((c for c in camps if c["id"] == camp_id), None)
        assert camp is not None, "camp should be in list"
        assert "budget" in camp, "list_camps should return budget"
        assert camp["budget"]["adventurers"] == 3
        assert "schedule" in camp, "list_camps should return schedule"
        assert len(camp["schedule"]) == 1
        assert "milestones" in camp, "list_camps should return milestones"

    @pytest.mark.asyncio
    async def test_camp_report_returns_budget(self, client):
        """camp_report 返回 budget/schedule/milestones。"""
        await _make_user("p1_report_admin", role="admin")
        tok = await _login(client, "p1_report_admin")

        # 创建营地
        r = await client.post("/api/camps", headers=_h(tok), json={
            "name": "P1报告测试营地", "emoji": "📊", "theme": "报告测试",
            "desc": "报告测试营地", "status": "active", "date": "2026-08-01",
            "people": 3, "max": 5, "location": "测试地点",
            "highlights": [], "builders": [], "tasks": [],
            "budget": {"adventurers": 2, "builders": 1, "lodgingNT": 0, "mealNT": 0},
            "schedule": [], "milestones": [],
        })
        assert r.status_code == 200, r.text
        camp_id = r.json()["camp_id"]

        # camp_report
        r2 = await client.get(f"/api/camps/{camp_id}/report", headers=_h(tok))
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert "budget" in body["camp"], "camp_report should return budget in camp object"
        assert body["camp"]["budget"]["adventurers"] == 2
        assert "schedule" in body["camp"]
        assert "milestones" in body["camp"]


# ══ 6. 死字段标记文档化 ══

class TestDeadFieldDocumentation:
    def test_camp_dead_fields_annotated(self):
        """Camp.season/type 有死字段标记注释。"""
        import inspect
        from models import Camp
        source = inspect.getsource(Camp)
        assert "死字段" in source or "🔴" in source, "Camp should have dead field annotation"

    def test_card_discovery_dead_fields_annotated(self):
        """CardDiscovery.expired_at/doer_name_snapshot 有死字段标记。"""
        import inspect
        from models import CardDiscovery
        source = inspect.getsource(CardDiscovery)
        assert "死字段" in source or "🔴" in source, "CardDiscovery should have dead field annotation"
