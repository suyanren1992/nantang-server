"""W7-EVENT-1 EVENT-D: 空间事情栏测试（公开/匿名/私密/筛选/activity_log 同步）。"""
import pytest
from httpx import AsyncClient
from datetime import datetime

from auth_utils import hash_password
from database import async_session
from models import User, SpaceEvent, ActivityLog


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
# 1. 公开事件所有人可见
# ══════════════════════════════════════════════════════
class TestPublicEvent:
    @pytest.mark.asyncio
    async def test_public_event_visible_to_everyone(self, client):
        """A 发一条公开打扫事件 → B 也能看到。"""
        await _create_user("ev_user_A")
        await _create_user("ev_user_B")
        tok_a = await _login(client, "ev_user_A")
        tok_b = await _login(client, "ev_user_B")

        # A 记录公开打扫事件
        r = await client.post("/api/events", json={
            "type": "cleaning", "location_id": "shared",
            "text": "A 打扫了厨房", "visibility": "public",
        }, headers=_h(tok_a))
        assert r.status_code == 200

        # B 也能看到
        r = await client.get("/api/events?location_id=shared", headers=_h(tok_b))
        items = r.json()["items"]
        texts = [it["text"] for it in items]
        assert "A 打扫了厨房" in texts

    @pytest.mark.asyncio
    async def test_public_event_shows_user_id(self, client):
        """公开事件应返回 user_id。"""
        await _create_user("ev_user_C")
        tok = await _login(client, "ev_user_C")

        r = await client.post("/api/events", json={
            "type": "cleaning", "location_id": "shared",
            "text": "C 打扫了厨房",
        }, headers=_h(tok))
        ev = r.json()["event"]
        assert ev["user_id"] == "ev_user_C", f"公开事件应显示 user_id"
        assert ev["visibility"] == "public"


# ══════════════════════════════════════════════════════
# 2. 匿名事件不返回 user_id
# ══════════════════════════════════════════════════════
class TestAnonymousEvent:
    @pytest.mark.asyncio
    async def test_anonymous_event_hides_user_id(self, client):
        """匿名事件 API 返回 user_id=None。"""
        await _create_user("ev_user_D")
        tok = await _login(client, "ev_user_D")

        r = await client.post("/api/events", json={
            "type": "cleaning", "location_id": "shared",
            "text": "有人整理了台面", "visibility": "anonymous",
        }, headers=_h(tok))
        assert r.status_code == 200
        ev = r.json()["event"]
        assert ev["user_id"] is None, f"匿名事件 user_id 应为 None, got={ev['user_id']}"
        assert ev["visibility"] == "anonymous"


# ══════════════════════════════════════════════════════
# 3. 私密事件他人不可见
# ══════════════════════════════════════════════════════
class TestPrivateEvent:
    @pytest.mark.asyncio
    async def test_private_event_hidden_from_others(self, client):
        """A 发一条 tip(private) → B 看不到。"""
        await _create_user("ev_user_E")
        await _create_user("ev_user_F")
        tok_e = await _login(client, "ev_user_E")
        tok_f = await _login(client, "ev_user_F")

        # E 发私密 tip
        r = await client.post("/api/events", json={
            "type": "tip", "location_id": "shared",
            "text": "E 给 F 打赏了", "visibility": "private",
        }, headers=_h(tok_e))
        assert r.status_code == 200

        # F 查列表 → 不应看到
        r = await client.get("/api/events?location_id=shared", headers=_h(tok_f))
        items = r.json()["items"]
        texts = [it["text"] for it in items]
        assert "E 给 F 打赏了" not in texts, f"私密事件不应被他人看到"

        # E 自己查 → 应看到
        r = await client.get("/api/events?location_id=shared", headers=_h(tok_e))
        texts = [it["text"] for it in r.json()["items"]]
        assert "E 给 F 打赏了" in texts, f"本人应看到自己的私密事件"


# ══════════════════════════════════════════════════════
# 4. 按 location_id 筛选
# ══════════════════════════════════════════════════════
class TestFilterByLocation:
    @pytest.mark.asyncio
    async def test_filter_by_location(self, client):
        """两个空间的公开事件，按 location_id 只返回匹配的。"""
        await _create_user("ev_user_G")
        tok = await _login(client, "ev_user_G")

        # 在 shared 发一条
        await client.post("/api/events", json={
            "type": "cooking", "location_id": "shared",
            "text": "在 shared 做饭",
        }, headers=_h(tok))

        # 筛选 shared
        r = await client.get("/api/events?location_id=shared", headers=_h(tok))
        shared_texts = [it["text"] for it in r.json()["items"]]
        assert "在 shared 做饭" in shared_texts


# ══════════════════════════════════════════════════════
# 5. activity_log 同步验证
# ══════════════════════════════════════════════════════
class TestActivityLogSync:
    @pytest.mark.asyncio
    async def test_cooking_syncs_activity_log(self, client):
        """cooking 事件应在 activity_log 中生成一条记录。"""
        await _create_user("ev_user_H")
        tok = await _login(client, "ev_user_H")

        # 发一条 cooking 事件
        r = await client.post("/api/events", json={
            "type": "cooking", "location_id": "shared",
            "text": "H 做了午饭",
        }, headers=_h(tok))
        assert r.status_code == 200

        # 查 activity_log
        async with async_session() as s:
            from sqlalchemy import select
            r = await s.execute(
                select(ActivityLog).where(ActivityLog.type == "event_cooking")
            )
            logs = r.scalars().all()
            assert len(logs) >= 1, "cooking 应同步到 activity_log"
            assert logs[0].text == "H 做了午饭"

    @pytest.mark.asyncio
    async def test_note_does_not_sync_activity_log(self, client):
        """note 事件不应同步到 activity_log。"""
        await _create_user("ev_user_I")
        tok = await _login(client, "ev_user_I")

        r = await client.post("/api/events", json={
            "type": "note", "location_id": "shared",
            "text": "I 的个人备忘", "visibility": "private",
        }, headers=_h(tok))
        assert r.status_code == 200

        # 查 activity_log → 不应有
        async with async_session() as s:
            from sqlalchemy import select
            r = await s.execute(
                select(ActivityLog).where(ActivityLog.type == "event_note")
            )
            logs = r.scalars().all()
            assert len(logs) == 0, "note 不应同步到 activity_log"


# ══════════════════════════════════════════════════════
# 6. 公开度强制规则
# ══════════════════════════════════════════════════════
class TestVisibilityEnforcement:
    @pytest.mark.asyncio
    async def test_checkin_forces_public(self, client):
        """checkin 传 private → 服务端强制改为 public。"""
        await _create_user("ev_user_J")
        tok = await _login(client, "ev_user_J")

        r = await client.post("/api/events", json={
            "type": "checkin", "location_id": "shared",
            "text": "J 办理入住", "visibility": "private",
        }, headers=_h(tok))
        assert r.status_code == 200
        ev = r.json()["event"]
        assert ev["visibility"] == "public", \
            f"checkin 应强制 public, got={ev['visibility']}"

    @pytest.mark.asyncio
    async def test_cleaning_rejects_private(self, client):
        """cleaning 传 private → 400 拒绝（共享空间无私密劳动）。"""
        await _create_user("ev_user_K")
        tok = await _login(client, "ev_user_K")

        r = await client.post("/api/events", json={
            "type": "cleaning", "location_id": "shared",
            "text": "K 私下打扫", "visibility": "private",
        }, headers=_h(tok))
        assert r.status_code == 400, f"cleaning 应拒 private, got {r.status_code}"
