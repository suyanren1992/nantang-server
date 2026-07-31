# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE补 B5: 档案室端点测试（3 用例）。

① 列表正常返回（含多源聚合）
② category 过滤生效
③ 详情端点 404 / 正常
"""
import pytest
from datetime import datetime

from auth_utils import hash_password
from database import async_session
from models import User, Journal, Announcement, ActivityLog


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="villager"):
    async with async_session() as s:
        exists = (await s.execute(
            __import__("sqlalchemy").select(User).where(User.id == name)
        )).scalar_one_or_none()
        if not exists:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=1000, trust_score=100, role=role))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


async def _seed_archive_data():
    """种归档测试数据。"""
    now = datetime.utcnow().isoformat()
    async with async_session() as s:
        # Journal
        s.add(Journal(user="arc_user", type="explore", content="发现了古井",
                      time=now, space_id="well"))
        # ActivityLog
        s.add(ActivityLog(type="system", text="南塘云村开门迎客", time=now))
        # Announcement
        s.add(Announcement(type="reward", doer="arc_user", action="完成打扫",
                           nt_amount=15, created_at=now))
        await s.commit()


# ══ ① 列表正常返回 ══
class TestArchiveList:
    @pytest.mark.asyncio
    async def test_list_all(self, client):
        await _make_user("arc_user")
        await _seed_archive_data()
        tok = await _login(client, "arc_user")

        r = await client.get("/api/archive/items", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["total"] >= 3
        # 多源聚合
        sources = {i["source"] for i in body["items"]}
        assert "journal" in sources or "announcement" in sources

    # ══ ② category 过滤 ══
    @pytest.mark.asyncio
    async def test_filter_by_category(self, client):
        await _make_user("arc_user")
        tok = await _login(client, "arc_user")

        r = await client.get("/api/archive/items?category=event", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        for item in body["items"]:
            assert item["category"] == "event"

    # ══ ③ 详情端点 ══
    @pytest.mark.asyncio
    async def test_detail_and_404(self, client):
        await _make_user("arc_user")
        tok = await _login(client, "arc_user")

        # 先拿列表取一个合法 ID
        r = await client.get("/api/archive/items", headers=_h(tok))
        items = r.json()["items"]
        if items:
            good_id = items[0]["id"]
            r2 = await client.get(f"/api/archive/items/{good_id}", headers=_h(tok))
            assert r2.status_code == 200, r2.text
            assert r2.json()["ok"] is True

        # 不存在的 → 404
        r3 = await client.get("/api/archive/items/journal_999999", headers=_h(tok))
        assert r3.status_code == 404, r3.text
