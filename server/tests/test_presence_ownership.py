"""EMPIRICAL-🔴2.4: sync_shared presence 所属权校验测试。

覆盖判据：
  ① 用户 A 写自己 presence → 200 OK
  ② 用户 A 写 B presence → 403
  ③ admin 写任意 presence → 200 OK
  ④ 无 token → 401

铁律：只碰 server/，不碰 nantang-mobile/。
"""
import pytest
from httpx import AsyncClient

from auth_utils import hash_password, create_access_token
from database import async_session
from models import User


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mk_user(name, role="villager", nt=0, **kwargs):
    async with async_session() as s:
        u = User(id=name, password_hash=hash_password("Passw0rd!"),
                 role=role, contribution_value=0, experience_value=0,
                 nt_balance=nt, trust_score=100, **kwargs)
        s.add(u)
        await s.commit()
    return create_access_token(name, role, 0)


# ══ presence 所属权校验 ══
class TestPresenceOwnership:
    @pytest.mark.asyncio
    async def test_user_writes_own_presence_ok(self, client):
        """用户 A 写自己的 presence → 200 OK。"""
        tok = await _mk_user("p2_alice")
        resp = await client.post("/api/data/sync_shared", headers=_h(tok), json={
            "presence": {"p2_alice": {"flipped": True, "at": "2026-07-31T00:00:00"}},
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["ok"] is True

    @pytest.mark.asyncio
    async def test_user_writes_others_presence_403(self, client):
        """用户 A 写 B 的 presence → 403。"""
        tok_a = await _mk_user("p2_alice2")
        await _mk_user("p2_bob")  # 创建 B 但不取其 token
        resp = await client.post("/api/data/sync_shared", headers=_h(tok_a), json={
            "presence": {"p2_bob": {"flipped": True, "at": "2026-07-31T00:00:00"}},
        })
        assert resp.status_code == 403
        assert "无权修改" in resp.json().get("detail", "")

    @pytest.mark.asyncio
    async def test_admin_writes_any_presence_ok(self, client):
        """admin 写任意用户 presence → 200 OK。"""
        tok_a = await _mk_user("p2_admin2", role="admin")
        await _mk_user("p2_charlie")
        resp = await client.post("/api/data/sync_shared", headers=_h(tok_a), json={
            "presence": {"p2_charlie": {"flipped": True, "at": "2026-07-31T00:00:00"}},
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["ok"] is True

    @pytest.mark.asyncio
    async def test_no_auth_401(self, client):
        """无 token → 401。"""
        resp = await client.post("/api/data/sync_shared", json={
            "presence": {"someone": {"flipped": True}},
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_user_writes_mixed_presence_partial(self, client):
        """混合写（自己 + 他人）→ 403 拒绝整包。"""
        tok_a = await _mk_user("p2_alice_mix")
        await _mk_user("p2_bob_mix")
        resp = await client.post("/api/data/sync_shared", headers=_h(tok_a), json={
            "presence": {
                "p2_alice_mix": {"flipped": True},
                "p2_bob_mix": {"flipped": False},
            },
        })
        # 整包拒绝：不改自己的，也不改别人的
        assert resp.status_code == 403
