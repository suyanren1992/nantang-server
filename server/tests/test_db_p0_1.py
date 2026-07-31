"""DB-P0-1: last_active_at 写路径 + 治理权严格检查测试。

覆盖判据：
  ① 任何 auth 端点请求触发 last_active_at 更新
  ② 同日不重复写（跳过优化）
  ③ last_active_at = today → 投票权有效（直接调用）
  ④ last_active_at = 31 天前 → 投票权失效（直接调用）
  ⑤ last_active_at = None → 投票权严格不通过（直接调用）
  ⑥ 投票权完整 HTTP 流程（active tenancy + auth → eligible）
  ⑦ 投票权无 Tenancy → 不通过

铁律：只碰 server/，不碰 nantang-mobile/。
"""
import pytest
import pytest_asyncio
from datetime import date, timedelta

from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, Tenancy
from routes.governance import check_vote_right
from sqlalchemy import select


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mk_user(name, role="villager", nt=0, trust=100, **kwargs):
    async with async_session() as s:
        u = User(id=name, password_hash=hash_password("Passw0rd!"),
                 role=role, contribution_value=0, experience_value=0,
                 nt_balance=nt, trust_score=trust, **kwargs)
        s.add(u)
        await s.commit()
    return create_access_token(name, role, 0)


# ══ ① Activity tracker 写路径 ══
class TestActivityTracker:
    @pytest.mark.asyncio
    async def test_auth_endpoint_updates_last_active_at(self, client):
        """任何 auth 端点请求触发 last_active_at 更新为 today。"""
        tok = await _mk_user("p01_act")
        # 初始状态：last_active_at 应为 None
        async with async_session() as s:
            u = (await s.execute(
                select(User).where(User.id == "p01_act")
            )).scalar_one()
            assert u.last_active_at is None

        # 发 auth 请求（GET /api/auth/me）
        resp = await client.get("/api/auth/me", headers=_h(tok))
        assert resp.status_code == 200

        # 验证 last_active_at 已更新为 today
        async with async_session() as s:
            u = (await s.execute(
                select(User).where(User.id == "p01_act")
            )).scalar_one()
            assert u.last_active_at == date.today()

    @pytest.mark.asyncio
    async def test_activity_tracker_skips_same_day(self, client):
        """同日不重复写——第二次请求后 last_active_at 仍是 today。"""
        tok = await _mk_user("p01_skip")
        # 第一次请求
        await client.get("/api/auth/me", headers=_h(tok))
        async with async_session() as s:
            u = (await s.execute(
                select(User).where(User.id == "p01_skip")
            )).scalar_one()
            assert u.last_active_at == date.today()

        # 第二次请求——last_active_at 不应变化
        await client.get("/api/auth/me", headers=_h(tok))
        async with async_session() as s:
            u = (await s.execute(
                select(User).where(User.id == "p01_skip")
            )).scalar_one()
            assert u.last_active_at == date.today()


# ══ ② 投票权严格检查（直接调用 check_vote_right）══
class TestVoteRightStrict:
    @pytest.mark.asyncio
    async def test_vote_right_today_eligible(self, db):
        """User.last_active_at = today → 投票权有效。"""
        async with async_session() as s:
            u = User(id="p01_vote_today", password_hash=hash_password("Passw0rd!"),
                     role="villager", last_active_at=date.today())
            s.add(u)
            s.add(Tenancy(user_id="p01_vote_today", room_id="p01_room_a",
                          checkin_date=date.today().isoformat(), status="active"))
            await s.commit()
            eligible = await check_vote_right(s, u)
            assert eligible["eligible"] is True
            assert eligible["checks"]["last_active"] is True

    @pytest.mark.asyncio
    async def test_vote_right_31_days_ago_ineligible(self, db):
        """User.last_active_at = 31 天前 → 投票权失效。"""
        async with async_session() as s:
            u = User(id="p01_vote_old", password_hash=hash_password("Passw0rd!"),
                     role="villager", last_active_at=date.today() - timedelta(days=31))
            s.add(u)
            s.add(Tenancy(user_id="p01_vote_old", room_id="p01_room_b",
                          checkin_date="2026-01-01", status="active"))
            await s.commit()
            eligible = await check_vote_right(s, u)
            assert eligible["eligible"] is False
            assert eligible["checks"]["last_active"] is False

    @pytest.mark.asyncio
    async def test_vote_right_none_strict(self, db):
        """User.last_active_at = None → 严格不通过（不再默认通过）。"""
        async with async_session() as s:
            u = User(id="p01_vote_none", password_hash=hash_password("Passw0rd!"),
                     role="villager", last_active_at=None)
            s.add(u)
            s.add(Tenancy(user_id="p01_vote_none", room_id="p01_room_c",
                          checkin_date="2026-01-01", status="active"))
            await s.commit()
            eligible = await check_vote_right(s, u)
            assert eligible["eligible"] is False
            assert eligible["checks"]["last_active"] is False


# ══ ③ 投票权 HTTP 集成 ══
class TestVoteRightHTTP:
    @pytest.mark.asyncio
    async def test_vote_right_active_user_eligible(self, client):
        """HTTP 集成: active tenancy + auth 请求 → 投票权有效。
        Activity tracker 在 auth 请求时更新 last_active_at = today。
        """
        tok = await _mk_user("p01_http_vote")
        async with async_session() as s:
            s.add(Tenancy(user_id="p01_http_vote", room_id="p01_room_d",
                          checkin_date="2026-07-01", status="active"))
            await s.commit()
        resp = await client.get("/api/governance/check_vote_right", headers=_h(tok))
        assert resp.status_code == 200
        data = resp.json()
        assert data["eligible"] is True
        assert data["checks"]["tenancy_active"] is True
        assert data["checks"]["last_active"] is True

    @pytest.mark.asyncio
    async def test_vote_right_no_tenancy_ineligible(self, client):
        """无 Tenancy → 投票权不通过（即使 last_active_at = today）。"""
        tok = await _mk_user("p01_no_ten")
        resp = await client.get("/api/governance/check_vote_right", headers=_h(tok))
        assert resp.status_code == 200
        assert resp.json()["eligible"] is False
