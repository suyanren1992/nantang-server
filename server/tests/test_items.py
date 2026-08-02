"""W7-ITEM-1 ITEM-E: 物品一套表测试（放入/列表/筛选/确认/保质期提示）。"""
import pytest
from httpx import AsyncClient
from datetime import datetime

from auth_utils import hash_password
from database import async_session
from models import User, Item


async def _create_user(name, password="Passw0rd!", role="villager"):
    async with async_session() as s:
        u = User(id=name, password_hash=hash_password(password), role=role)
        s.add(u)
        await s.commit()
        return name


async def _login(client, name, password="Passw0rd!"):
    r = await client.post("/api/auth/login", json={"name": name, "password": password})
    return r.json()["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════
# 1. 放入物品 + 查列表
# ══════════════════════════════════════════════════════
class TestCreateAndList:
    @pytest.mark.asyncio
    async def test_create_and_list(self, client):
        """放入一件物品后，列表能查到。"""
        await _create_user("item_user_1")
        tok = await _login(client, "item_user_1")

        # 放入物品（location_id 用已有的 shared key）
        r = await client.post("/api/items", json={
            "name": "牛奶", "category": "乳品",
            "location_id": "shared",
            "quantity": "1L",
            "expiration": "2026-08-15",
        }, headers=_h(tok))
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["item"]["name"] == "牛奶"
        assert body["item"]["category"] == "乳品"
        assert body["item"]["state"] == "active"

        # 查列表
        r = await client.get("/api/items", headers=_h(tok))
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        names = [it["name"] for it in items]
        assert "牛奶" in names


# ══════════════════════════════════════════════════════
# 2. 按类别筛选
# ══════════════════════════════════════════════════════
class TestFilterByCategory:
    @pytest.mark.asyncio
    async def test_filter_by_category(self, client):
        """放入两类物品，按类别筛选只返回匹配的。"""
        await _create_user("item_user_2")
        tok = await _login(client, "item_user_2")

        # 放入牛奶（乳品）+ 炒锅（工具）
        await client.post("/api/items", json={
            "name": "牛奶", "category": "乳品",
            "location_id": "shared", "quantity": "1L",
        }, headers=_h(tok))
        await client.post("/api/items", json={
            "name": "炒锅", "category": "工具",
            "location_id": "shared", "quantity": "1个",
        }, headers=_h(tok))

        # 按乳品筛选
        r = await client.get("/api/items?category=乳品", headers=_h(tok))
        items = r.json()["items"]
        cats = {it["category"] for it in items}
        assert cats == {"乳品"} or "乳品" in cats
        names = [it["name"] for it in items]
        assert "牛奶" in names
        assert "炒锅" not in names


# ══════════════════════════════════════════════════════
# 3. 标记「还在」刷新 last_confirmed
# ══════════════════════════════════════════════════════
class TestConfirm:
    @pytest.mark.asyncio
    async def test_confirm_refreshes_last_confirmed(self, client):
        """标记还在后 last_confirmed 应更新为更晚的时间。"""
        await _create_user("item_user_3")
        tok = await _login(client, "item_user_3")

        # 放入物品
        r = await client.post("/api/items", json={
            "name": "酱油", "category": "调料",
            "location_id": "shared", "quantity": "500ml",
        }, headers=_h(tok))
        item_id = r.json()["item"]["id"]
        old_confirmed = r.json()["item"]["last_confirmed"]

        # 标记还在
        r = await client.post(f"/api/items/{item_id}/confirm", headers=_h(tok))
        assert r.status_code == 200
        new_confirmed = r.json()["item"]["last_confirmed"]
        assert new_confirmed >= old_confirmed, \
            f"last_confirmed 应刷新, old={old_confirmed}, new={new_confirmed}"


# ══════════════════════════════════════════════════════
# 4. 食物类未填保质期 → 返回 suggestion
# ══════════════════════════════════════════════════════
class TestExpirationSuggestion:
    @pytest.mark.asyncio
    async def test_food_without_expiration_gets_suggestion(self, client):
        """乳品未填保质期 → 响应含 suggestion。"""
        await _create_user("item_user_4")
        tok = await _login(client, "item_user_4")

        r = await client.post("/api/items", json={
            "name": "鸡蛋", "category": "肉蛋",
            "location_id": "shared", "quantity": "10个",
        }, headers=_h(tok))
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert "suggestion" in body, f"食物类未填保质期应有 suggestion, got keys={list(body.keys())}"
        assert "保质期" in body["suggestion"]

    @pytest.mark.asyncio
    async def test_food_with_expiration_no_suggestion(self, client):
        """乳品填了保质期 → 无 suggestion。"""
        await _create_user("item_user_5")
        tok = await _login(client, "item_user_5")

        r = await client.post("/api/items", json={
            "name": "牛奶", "category": "乳品",
            "location_id": "shared", "quantity": "1L",
            "expiration": "2026-09-01",
        }, headers=_h(tok))
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert "suggestion" not in body, f"已填保质期不应有 suggestion"

    @pytest.mark.asyncio
    async def test_tool_without_expiration_no_suggestion(self, client):
        """工具类未填保质期 → 无 suggestion。"""
        await _create_user("item_user_6")
        tok = await _login(client, "item_user_6")

        r = await client.post("/api/items", json={
            "name": "扫把", "category": "工具",
            "location_id": "shared", "quantity": "1把",
        }, headers=_h(tok))
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert "suggestion" not in body, f"非食物类不应有 suggestion"
