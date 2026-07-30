# -*- coding: utf-8 -*-
"""W5-B 后端安全补丁回归测试（H-4/H-6/H-7）。

判据（机器可验证）：
  H-4：非本营用户 GET /{camp_id}/report → 403；本营 active 成员 → 200；admin → 200
  H-6：无 token GET canteen_menu / map_locations / announcements → 401
  H-7：删营地后 CampMembership 表无该 camp_id 残留

注：H-5（activity_log 按用户过滤）经实测判为误诊——ActivityLog 模型无 user 字段、
  写入端不记归属、数据本质为全站公开活动流，且 GET 已有 get_current_user 鉴权。
  详见回执，故本文件不含 H-5 用例。
"""
from datetime import datetime

import pytest
from sqlalchemy import select

from auth_utils import hash_password
from database import async_session
from models import User, CommunityPool, Camp, CampMembership


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="villager"):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=1000, trust_score=100, role=role,
                       wallet_address="0x0000000000000000000000000000000000000001"))
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            s.add(CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


async def _make_camp(camp_id, created_by):
    async with async_session() as s:
        s.add(Camp(id=camp_id, name="安全测试营地", created_by=created_by,
                   created_at=datetime.utcnow().isoformat()))
        await s.commit()


async def _add_membership(user_id, camp_id, status="active"):
    async with async_session() as s:
        s.add(CampMembership(user_id=user_id, camp_id=camp_id,
                             camp_role="member", status=status,
                             joined_at=datetime.utcnow().isoformat()))
        await s.commit()


# ===== H-4：camp_report 归属校验 =====
class TestH4CampReportScope:
    @pytest.mark.asyncio
    async def test_non_member_gets_403(self, client):
        await _make_user("h4_owner", role="villager")
        await _make_user("h4_outsider", role="villager")
        await _make_camp("camp-h4-1", "h4_owner")
        tok = await _login(client, "h4_outsider")
        r = await client.get("/api/camps/camp-h4-1/report", headers=_h(tok))
        assert r.status_code == 403, r.text

    @pytest.mark.asyncio
    async def test_active_member_gets_200(self, client):
        await _make_user("h4_owner2", role="villager")
        await _make_user("h4_member", role="villager")
        await _make_camp("camp-h4-2", "h4_owner2")
        await _add_membership("h4_member", "camp-h4-2", status="active")
        tok = await _login(client, "h4_member")
        r = await client.get("/api/camps/camp-h4-2/report", headers=_h(tok))
        assert r.status_code == 200, r.text

    @pytest.mark.asyncio
    async def test_left_member_gets_403(self, client):
        """非 active（left）成员不得访问。"""
        await _make_user("h4_owner3", role="villager")
        await _make_user("h4_left", role="villager")
        await _make_camp("camp-h4-3", "h4_owner3")
        await _add_membership("h4_left", "camp-h4-3", status="left")
        tok = await _login(client, "h4_left")
        r = await client.get("/api/camps/camp-h4-3/report", headers=_h(tok))
        assert r.status_code == 403, r.text

    @pytest.mark.asyncio
    async def test_admin_gets_200(self, client):
        await _make_user("h4_owner4", role="villager")
        await _make_user("h4_admin", role="admin")
        await _make_camp("camp-h4-4", "h4_owner4")
        tok = await _login(client, "h4_admin")
        r = await client.get("/api/camps/camp-h4-4/report", headers=_h(tok))
        assert r.status_code == 200, r.text


# ===== H-6：三个 GET 无 token → 401 =====
class TestH6GetAuth:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("path", [
        "/api/data/canteen_menu",
        "/api/data/map_locations",
        "/api/data/announcements",
    ])
    async def test_no_token_gets_401(self, client, path):
        r = await client.get(path)
        assert r.status_code == 401, f"{path} -> {r.status_code} {r.text}"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("path", [
        "/api/data/canteen_menu",
        "/api/data/map_locations",
        "/api/data/announcements",
    ])
    async def test_with_token_ok(self, client, path):
        await _make_user("h6_user", role="villager")
        tok = await _login(client, "h6_user")
        r = await client.get(path, headers=_h(tok))
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text}"


# ===== H-7：delete_camp 级联删 CampMembership =====
class TestH7CascadeMembership:
    @pytest.mark.asyncio
    async def test_delete_camp_removes_memberships(self, client):
        await _make_user("h7_admin", role="admin")
        await _make_user("h7_m1", role="villager")
        await _make_user("h7_m2", role="villager")
        await _make_camp("camp-h7-1", "h7_admin")
        await _add_membership("h7_m1", "camp-h7-1", status="active")
        await _add_membership("h7_m2", "camp-h7-1", status="left")
        # 前置断言：确实有 2 行
        async with async_session() as s:
            n = (await s.execute(select(CampMembership).where(
                CampMembership.camp_id == "camp-h7-1"))).scalars().all()
        assert len(n) == 2
        tok = await _login(client, "h7_admin")
        r = await client.delete("/api/camps/camp-h7-1", headers=_h(tok))
        assert r.status_code == 200 and r.json()["ok"] is True, r.text
        # 删后无残留
        async with async_session() as s:
            rest = (await s.execute(select(CampMembership).where(
                CampMembership.camp_id == "camp-h7-1"))).scalars().all()
        assert rest == [], f"孤儿 CampMembership 残留: {rest}"
