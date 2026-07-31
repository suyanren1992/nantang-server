# -*- coding: utf-8 -*-
"""H-9: /api/nt/chain-balance 端点认证回归测试。

判据（机器可验证）：
  1. 无 token GET /api/nt/chain-balance → 401（get_current_user 拦截）
  2. 非 admin（villager）token → 403（require_admin 拦截）
  3. admin token → 200（放行；余额内容因无 PLATFORM_WALLET 返回 ok:False，但鉴权通过）
"""
import pytest

from auth_utils import hash_password
from database import async_session
from models import User


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="villager"):
    async with async_session() as s:
        exists = (await s.execute(__import__("sqlalchemy").select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"), role=role,
                       trust_score=100))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


class TestChainBalanceAuth:
    """H-9: chain-balance 端点须 require_admin。"""

    @pytest.mark.asyncio
    async def test_no_token_gets_401(self, client):
        r = await client.get("/api/nt/chain-balance")
        assert r.status_code == 401, f"无 token 应 401，got {r.status_code}"

    @pytest.mark.asyncio
    async def test_villager_gets_403(self, client):
        await _make_user("h9_villager", role="villager")
        tok = await _login(client, "h9_villager")
        r = await client.get("/api/nt/chain-balance", headers=_h(tok))
        assert r.status_code == 403, f"非 admin 应 403，got {r.status_code} {r.text}"

    @pytest.mark.asyncio
    async def test_admin_gets_200(self, client):
        await _make_user("h9_admin", role="admin")
        tok = await _login(client, "h9_admin")
        r = await client.get("/api/nt/chain-balance", headers=_h(tok))
        assert r.status_code == 200, f"admin 应 200，got {r.status_code} {r.text}"
