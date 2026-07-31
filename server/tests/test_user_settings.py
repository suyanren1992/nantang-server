# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE补 B7: 用户设置端点测试（4 用例）。

① GET 默认值
② PATCH 局部更新
③ PATCH 无效 theme → 400
④ 未认证 → 401
"""
import pytest

from auth_utils import hash_password
from database import async_session
from models import User
from sqlalchemy import select


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="villager"):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if not exists:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=1000, trust_score=100, role=role))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


class TestGetSettings:
    @pytest.mark.asyncio
    async def test_get_defaults(self, client):
        """① 新用户无设置 → 返回默认值"""
        await _make_user("us_default")
        tok = await _login(client, "us_default")
        r = await client.get("/api/users/me/settings", headers=_h(tok))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        s = body["settings"]
        assert s["notification"] is True
        assert s["theme"] == "light"
        assert s["language"] == "zh-CN"


class TestPatchSettings:
    @pytest.mark.asyncio
    async def test_patch_partial(self, client):
        """② PATCH 局部更新 theme"""
        await _make_user("us_patch")
        tok = await _login(client, "us_patch")

        r = await client.patch("/api/users/me/settings", headers=_h(tok),
                               json={"theme": "dark"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["settings"]["theme"] == "dark"
        assert body["settings"]["notification"] is True  # 未改的保持默认

        # 再读一遍，确认持久化
        r2 = await client.get("/api/users/me/settings", headers=_h(tok))
        assert r2.json()["settings"]["theme"] == "dark"

    @pytest.mark.asyncio
    async def test_patch_bad_theme_400(self, client):
        """③ 无效 theme → 400"""
        await _make_user("us_patch")
        tok = await _login(client, "us_patch")
        r = await client.patch("/api/users/me/settings", headers=_h(tok),
                               json={"theme": "rainbow"})
        assert r.status_code == 400, r.text


class TestSettingsAuth:
    @pytest.mark.asyncio
    async def test_unauthenticated_401(self, client):
        """④ 未认证 → 401"""
        r = await client.get("/api/users/me/settings")
        assert r.status_code == 401, r.text
