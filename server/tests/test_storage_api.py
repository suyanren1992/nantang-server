# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE B2/B3/B4: 储物 API 端点测试（11 用例）。

B2 (POST /api/storage/items)：正常建 / 缺字段 400 / 未认证 401 / category 错 400 / location 错 400
B3 (GET  /api/storage/items)：正常 / 空 / 过期过滤
B4 (DEL  /api/storage/items/:id)：本人删 / admin 删 / 他人删 403
"""
import pytest
from datetime import datetime, timedelta

from auth_utils import hash_password
from database import async_session
from models import User, CommunityPool, StorageItem, Tenancy
from sqlalchemy import select


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="villager", coop=False):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=1000, trust_score=100, role=role))
            pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
            if pool is None:
                s.add(CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0))
        await s.commit()
    if coop:
        async with async_session() as s:
            exists_t = (await s.execute(
                select(Tenancy).where(Tenancy.user_id == name, Tenancy.track == "coop", Tenancy.status == "active")
            )).scalar_one_or_none()
            if not exists_t:
                from datetime import datetime
                s.add(Tenancy(user_id=name, room_id="dorm101", bed_num=1,
                              checkin_date=datetime.utcnow().isoformat(),
                              track="coop", status="active"))
                await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


# ══════════════════════════════════════════
# B2: POST /api/storage/items
# ══════════════════════════════════════════

class TestCreateItem:
    @pytest.mark.asyncio
    async def test_create_ok(self, client):
        """正常建一条储物"""
        await _make_user("st_create_user")
        tok = await _login(client, "st_create_user")
        r = await client.post("/api/storage/items", headers=_h(tok), json={
            "item_name": "萝卜",
            "category": "食物",
            "quantity": 5,
            "storage_location": "冰箱",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["item"]["item_name"] == "萝卜"
        assert body["item"]["quantity"] == 5

    @pytest.mark.asyncio
    async def test_missing_field_422(self, client):
        """缺必填字段 item_name → Pydantic 422"""
        await _make_user("st_create_user")
        tok = await _login(client, "st_create_user")
        r = await client.post("/api/storage/items", headers=_h(tok), json={
            "category": "食物",
            "storage_location": "冰箱",
        })
        assert r.status_code == 422, r.text

    @pytest.mark.asyncio
    async def test_unauthenticated_401(self, client):
        """未认证 → 401"""
        r = await client.post("/api/storage/items", json={
            "item_name": "锤子",
            "category": "工具",
            "storage_location": "储物间",
        })
        assert r.status_code == 401, r.text

    @pytest.mark.asyncio
    async def test_bad_category_400(self, client):
        """category 不在枚举 → 400"""
        await _make_user("st_create_user")
        tok = await _login(client, "st_create_user")
        r = await client.post("/api/storage/items", headers=_h(tok), json={
            "item_name": "火箭",
            "category": "违禁品",
            "storage_location": "冰箱",
        })
        assert r.status_code == 400, r.text

    @pytest.mark.asyncio
    async def test_bad_location_400(self, client):
        """storage_location 不在枚举 → 400"""
        await _make_user("st_create_user")
        tok = await _login(client, "st_create_user")
        r = await client.post("/api/storage/items", headers=_h(tok), json={
            "item_name": "书",
            "category": "杂物",
            "storage_location": "外太空",
        })
        assert r.status_code == 400, r.text


# ══════════════════════════════════════════
# B3: GET /api/storage/items
# ══════════════════════════════════════════

class TestListItems:
    @pytest.mark.asyncio
    async def test_list_normal(self, client):
        """正常拉取：有数据"""
        uid = "st_list_user"
        await _make_user(uid)
        tok = await _login(client, uid)
        # 先建一条
        await client.post("/api/storage/items", headers=_h(tok), json={
            "item_name": "酱油",
            "category": "食物",
            "storage_location": "冰箱",
        })
        r = await client.get("/api/storage/items", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert "冰箱" in body["items"]
        names = [i["item_name"] for i in body["items"]["冰箱"]]
        assert "酱油" in names

    @pytest.mark.asyncio
    async def test_list_empty(self, client):
        """空用户拉取：三档全空列表"""
        uid = "st_empty_user"
        await _make_user(uid)
        tok = await _login(client, uid)
        r = await client.get("/api/storage/items", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        for loc in ("冰箱", "储物间", "共享"):
            assert body["items"][loc] == []

    @pytest.mark.asyncio
    async def test_list_expired_filtered(self, client):
        """过期记录不返回"""
        uid = "st_expiry_user"
        await _make_user(uid)
        now = datetime.utcnow()
        async with async_session() as s:
            # 已过期
            s.add(StorageItem(
                id="si_api_expired", user_id=uid, item_name="过期酸奶",
                category="食物", quantity=1, storage_location="冰箱",
                added_at=now.isoformat(),
                expires_at=(now - timedelta(days=3)).isoformat(),
            ))
            # 不过期
            s.add(StorageItem(
                id="si_api_fresh", user_id=uid, item_name="新鲜番茄",
                category="食物", quantity=2, storage_location="冰箱",
                added_at=now.isoformat(), expires_at=None,
            ))
            await s.commit()

        tok = await _login(client, uid)
        r = await client.get("/api/storage/items", headers=_h(tok))
        assert r.status_code == 200, r.text
        names = [i["item_name"] for i in r.json()["items"]["冰箱"]]
        assert "新鲜番茄" in names
        assert "过期酸奶" not in names


# ══════════════════════════════════════════
# B4: DELETE /api/storage/items/{id}
# ══════════════════════════════════════════

class TestDeleteItem:
    @pytest.mark.asyncio
    async def test_owner_delete_ok(self, client):
        """本人可删"""
        uid = "st_del_owner"
        await _make_user(uid, coop=True)
        tok = await _login(client, uid)
        r = await client.post("/api/storage/items", headers=_h(tok), json={
            "item_name": "待删物品",
            "category": "杂物",
            "storage_location": "共享",
        })
        item_id = r.json()["item"]["id"]
        dr = await client.delete(f"/api/storage/items/{item_id}", headers=_h(tok))
        assert dr.status_code == 204, dr.text

        # 删后再查：应该没有了
        lr = await client.get("/api/storage/items", headers=_h(tok))
        all_names = []
        for loc_items in lr.json()["items"].values():
            all_names.extend(i["item_name"] for i in loc_items)
        assert "待删物品" not in all_names

    @pytest.mark.asyncio
    async def test_admin_delete_ok(self, client):
        """admin 可删他人储物"""
        owner = "st_del_target"
        admin = "st_del_admin"
        await _make_user(owner, role="villager")
        await _make_user(admin, role="admin")

        tok_owner = await _login(client, owner)
        r = await client.post("/api/storage/items", headers=_h(tok_owner), json={
            "item_name": "admin要删的",
            "category": "工具",
            "storage_location": "储物间",
        })
        item_id = r.json()["item"]["id"]

        tok_admin = await _login(client, admin)
        dr = await client.delete(f"/api/storage/items/{item_id}", headers=_h(tok_admin))
        assert dr.status_code == 204, dr.text

    @pytest.mark.asyncio
    async def test_other_user_delete_403(self, client):
        """他人删 → 403"""
        owner = "st_del_owner2"
        other = "st_del_other"
        await _make_user(owner, role="villager")
        await _make_user(other, role="villager", coop=True)

        tok_owner = await _login(client, owner)
        r = await client.post("/api/storage/items", headers=_h(tok_owner), json={
            "item_name": "不许删",
            "category": "杂物",
            "storage_location": "冰箱",
        })
        item_id = r.json()["item"]["id"]

        tok_other = await _login(client, other)
        dr = await client.delete(f"/api/storage/items/{item_id}", headers=_h(tok_other))
        assert dr.status_code == 403, dr.text
