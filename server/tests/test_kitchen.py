# -*- coding: utf-8 -*-
"""P3-二营乙：共享厨房 8 测（4 表 + 10 端点）。

判据覆盖：
  ① potluck create+join（端点 1+2+3）
  ② potluck list filter status（端点 1）
  ③ slot book ≤10 自动 approved（端点 5）
  ④ slot book 11-20 pending（端点 5）
  ⑤ slot book >20 reject（端点 5）
  ⑥ items add+take+remove（端点 8+9+10）
  ⑦ items list filter category（端点 7）
  ⑧ item expired 3 天内高亮（端点 7·业务规则）
"""
import pytest
from datetime import date, timedelta
from sqlalchemy import select

from auth_utils import hash_password
from database import async_session
from models import User, CommunityPool


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="admin"):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(
                id=name, password_hash=hash_password("P@ssw0rd!"),
                nt_balance=100, trust_score=100, role=role,
            ))
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            s.add(CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "P@ssw0rd!"})
    return r.json()["token"]


# ══ ① potluck create + join（端点 1+2+3）══

class TestPotluckCreateAndJoin:
    @pytest.mark.asyncio
    async def test_create_and_join(self, client):
        """创建接龙 → 列表可查 → 另一用户报名成功。"""
        await _make_user("k_org")
        tok = await _login(client, "k_org")
        # 创建
        r = await client.post("/api/kitchen/potluck/create", headers=_h(tok), json={
            "title": "测试火锅局", "dish": "麻辣火锅",
            "event_at": "2026-08-10T18:00:00", "capacity": 4,
        })
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        event_id = r.json()["id"]
        # 列表
        r2 = await client.get("/api/kitchen/potluck/list", headers=_h(tok))
        assert r2.status_code == 200
        assert any(i["id"] == event_id for i in r2.json()["items"])
        # 报名
        await _make_user("k_joiner", role="villager")
        tok2 = await _login(client, "k_joiner")
        r3 = await client.post("/api/kitchen/potluck/join", headers=_h(tok2), json={
            "event_id": event_id, "portion": 1,
        })
        assert r3.status_code == 200
        assert r3.json()["ok"] is True
        assert r3.json()["current_count"] == 2


# ══ ② potluck list filter status（端点 1）══

class TestPotluckListFilterStatus:
    @pytest.mark.asyncio
    async def test_filter_open(self, client):
        """按 status=open 过滤。"""
        await _make_user("k_flst")
        tok = await _login(client, "k_flst")
        await client.post("/api/kitchen/potluck/create", headers=_h(tok), json={
            "title": "过滤测试", "dish": "凉拌黄瓜",
            "event_at": "2026-08-15T12:00:00", "capacity": 10,
        })
        r = await client.get("/api/kitchen/potluck/list?status=open", headers=_h(tok))
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["status"] == "open"


# ══ ③④⑤ slot book 容量规则（端点 5）══

class TestSlotBookCapacityRules:
    @pytest.mark.asyncio
    async def test_auto_approved_le_10(self, client):
        """③ ≤10 人自动 approved。"""
        await _make_user("k_slot10")
        tok = await _login(client, "k_slot10")
        r = await client.post("/api/kitchen/slots/book", headers=_h(tok), json={
            "start_at": "2026-08-10T08:00:00", "end_at": "2026-08-10T11:00:00",
            "group_name": "小聚", "dish": "早餐", "party_size": 6,
        })
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

    @pytest.mark.asyncio
    async def test_pending_11_to_20(self, client):
        """④ 11-20 人 pending 待审。"""
        await _make_user("k_slot15")
        tok = await _login(client, "k_slot15")
        r = await client.post("/api/kitchen/slots/book", headers=_h(tok), json={
            "start_at": "2026-08-10T17:00:00", "end_at": "2026-08-10T20:00:00",
            "group_name": "大聚餐", "dish": "烧烤", "party_size": 15,
        })
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    @pytest.mark.asyncio
    async def test_reject_gt_20(self, client):
        """⑤ >20 人拒绝（提示拆分）。"""
        await _make_user("k_slot25")
        tok = await _login(client, "k_slot25")
        r = await client.post("/api/kitchen/slots/book", headers=_h(tok), json={
            "start_at": "2026-08-11T08:00:00", "end_at": "2026-08-11T12:00:00",
            "group_name": "超大团", "dish": "流水席", "party_size": 25,
        })
        assert r.status_code == 400
        assert "拆分" in r.json()["detail"]


# ══ ⑥ items add + take + remove（端点 8+9+10）══

class TestItemsAddTakeRemove:
    @pytest.mark.asyncio
    async def test_add_take_remove(self, client):
        """放入 → 取出 → 移除（owner 可删）。"""
        await _make_user("k_items")
        tok = await _login(client, "k_items")
        # 放入
        r = await client.post("/api/kitchen/items/add", headers=_h(tok), json={
            "name": "测试牛奶", "category": "food", "location": "fridge",
            "quantity": "2L", "expired_at": "2026-08-20",
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True
        item_id = r.json()["id"]
        # 取出
        r2 = await client.post("/api/kitchen/items/take", headers=_h(tok), json={
            "item_id": item_id, "quantity": "1L",
        })
        assert r2.status_code == 200
        assert r2.json()["ok"] is True
        # 移除
        r3 = await client.delete(f"/api/kitchen/items/{item_id}", headers=_h(tok))
        assert r3.status_code == 200
        assert r3.json()["deleted_id"] == item_id


# ══ ⑦ items list filter category（端点 7）══

class TestItemsListFilterCategory:
    @pytest.mark.asyncio
    async def test_filter_by_category(self, client):
        """按 category=food 过滤。"""
        await _make_user("k_icat")
        tok = await _login(client, "k_icat")
        await client.post("/api/kitchen/items/add", headers=_h(tok), json={
            "name": "过滤_食材", "category": "food", "location": "fridge",
        })
        await client.post("/api/kitchen/items/add", headers=_h(tok), json={
            "name": "过滤_调料", "category": "condiment", "location": "cabinet",
        })
        r = await client.get("/api/kitchen/items/list?category=food", headers=_h(tok))
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["category"] == "food"


# ══ ⑧ item expired 3 天内高亮（端点 7·业务规则）══

class TestItemExpiredHighlight:
    @pytest.mark.asyncio
    async def test_expired_soon_and_expired(self, client):
        """2 天后过期→expired_soon=true；昨天过期→is_expired=true。"""
        await _make_user("k_exp3d")
        tok = await _login(client, "k_exp3d")
        today = date.today()

        soon = (today + timedelta(days=2)).isoformat()
        r1 = await client.post("/api/kitchen/items/add", headers=_h(tok), json={
            "name": "即将过期牛奶", "category": "food", "expired_at": soon,
        })
        soon_id = r1.json()["id"]

        past = (today - timedelta(days=1)).isoformat()
        r2 = await client.post("/api/kitchen/items/add", headers=_h(tok), json={
            "name": "已过期酸奶", "category": "food", "expired_at": past,
        })
        past_id = r2.json()["id"]

        r3 = await client.get("/api/kitchen/items/list", headers=_h(tok))
        assert r3.status_code == 200
        items = {i["id"]: i for i in r3.json()["items"]}

        assert items[soon_id]["expired_soon"] is True
        assert items[soon_id]["is_expired"] is False
        assert items[past_id]["is_expired"] is True
        assert items[past_id]["expired_soon"] is False
