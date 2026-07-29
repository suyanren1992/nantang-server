"""IA-2: \u540e\u7aef\u5b89\u5168\u79d2\u4fee\u2014\u2014\u516c\u7ea6\u914d\u7f6e\u5199\u5165\u9274\u6743 + \u654f\u611f\u5b57\u6bb5\u8131\u654f\u3002

\u5224\u636e\uff1a
  1. \u975e admin POST sync_shared \u5e26 pendingConfigChanges \u2192 403
  2. admin POST \u540c\u4e0a \u2192 \u6b63\u5e38\u5199\u5165
  3. GET /api/auth/users \u2192 \u4e0d\u542b location/wallet_address
  4. GET /api/auth/me \u2192 \u542b location/wallet_address
"""
import uuid
import json
import pytest

from sqlalchemy import select
from database import async_session
from auth_utils import hash_password, create_access_token
from models import User, MapLocation


def _h(t): return {"Authorization": f"Bearer {t}"}


async def _mk_user(name, role="villager", location="\u6885\u5385", wallet="0x" + "b" * 40):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"), role=role,
                   location=location, wallet_address=wallet, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


class TestConfigWriteAdminGate:
    @pytest.mark.asyncio
    async def test_non_admin_config_change_403(self, client):
        tok = await _mk_user(f"ia2_v_{uuid.uuid4().hex[:6]}", role="villager")
        r = await client.post("/api/data/sync_shared", headers=_h(tok),
                              json={"pendingConfigChanges": [{"k": "x", "v": 1}]})
        assert r.status_code == 403, r.text
        assert "\u7ba1\u7406\u5458" in r.json()["detail"], r.text

    @pytest.mark.asyncio
    async def test_non_admin_config_history_403(self, client):
        tok = await _mk_user(f"ia2_v2_{uuid.uuid4().hex[:6]}", role="villager")
        r = await client.post("/api/data/sync_shared", headers=_h(tok),
                              json={"configHistory": [{"ts": "t", "change": "c"}]})
        assert r.status_code == 403, r.text

    @pytest.mark.asyncio
    async def test_admin_config_change_writes(self, client):
        tok = await _mk_user(f"ia2_a_{uuid.uuid4().hex[:6]}", role="admin")
        payload = [{"k": "verifier_reward_pct", "v": 15}]
        r = await client.post("/api/data/sync_shared", headers=_h(tok),
                              json={"pendingConfigChanges": payload})
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        async with async_session() as s:
            row = (await s.execute(
                select(MapLocation).where(MapLocation.key == "config_changes"))).scalar_one()
            assert json.loads(row.data) == payload, row.data


class TestSensitiveFieldDesensitize:
    @pytest.mark.asyncio
    async def test_users_list_no_sensitive(self, client):
        tok = await _mk_user(f"ia2_u_{uuid.uuid4().hex[:6]}")
        r = await client.get("/api/auth/users", headers=_h(tok))
        assert r.status_code == 200, r.text
        for item in r.json():
            assert "location" not in item, item
            assert "wallet_address" not in item, item

    @pytest.mark.asyncio
    async def test_me_has_sensitive(self, client):
        name = f"ia2_m_{uuid.uuid4().hex[:6]}"
        tok = await _mk_user(name, location="\u5170\u5385", wallet="0x" + "c" * 40)
        r = await client.get("/api/auth/me", headers=_h(tok))
        assert r.status_code == 200, r.text
        j = r.json()
        assert "location" in j and j["location"] == "\u5170\u5385", j
        assert "wallet_address" in j and j["wallet_address"] == "0x" + "c" * 40, j
