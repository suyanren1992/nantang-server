"""M-2a: POST /api/nt/earn 池发奖端点测试（涉钱）。

覆盖判据：
  ① admin 池发奖到账：pool.balance -= amount，target.nt_balance += amount，200
  ② 非 admin → 403（require_admin 双保险）
  ③ 超额（>10000）→ 400（保留 R11-1 上限，显式拦非 422）
  ④ 社区池余额不足 → 400 明示 detail
并发锁不双花见 test_pg_locks.py::test_earn_concurrent_no_double_spend（requires_pg，SQLite skip）。

铁律：不碰 withdraw confirm/reject 既有逻辑；池→人不改 total_issued。
"""
import uuid
import pytest

from sqlalchemy import select
from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, CommunityPool


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mk_user(name, role="villager", nt=0):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                   role=role, contribution_value=0, experience_value=0,
                   nt_balance=nt, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


async def _set_pool(balance):
    """把社区池设成指定 balance（幂等：有则改，无则建）。"""
    async with async_session() as s:
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=balance, total_issued=max(balance, 500),
                                 task_escrow=0, contribution_pool=0, camp_balance=0,
                                 reserve=0, frozen=0)
            s.add(pool)
        else:
            pool.balance = balance
        await s.commit()


async def _pool_balance():
    async with async_session() as s:
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one()
        return pool.balance


async def _user_balance(name):
    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == name))).scalar_one()
        return u.nt_balance


class TestEarnEndpoint:
    @pytest.mark.asyncio
    async def test_admin_earn_credits_user_and_debits_pool(self, client):
        admin_tok = await _mk_user(f"m2a_admin_{uuid.uuid4().hex[:6]}", role="admin")
        doer = f"m2a_doer_{uuid.uuid4().hex[:6]}"
        await _mk_user(doer, role="villager", nt=0)
        await _set_pool(100)

        r = await client.post("/api/nt/earn",
                              json={"to": doer, "amount": 8, "reason": "卡片室发现: 打扫正厅"},
                              headers=_h(admin_tok))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert j["balance"] == 8, j
        assert j["pool_balance"] == 92, j
        # 落库实证
        assert await _user_balance(doer) == 8
        assert await _pool_balance() == 92

    @pytest.mark.asyncio
    async def test_non_admin_forbidden_403(self, client):
        villager_tok = await _mk_user(f"m2a_vil_{uuid.uuid4().hex[:6]}", role="villager")
        target = f"m2a_t_{uuid.uuid4().hex[:6]}"
        await _mk_user(target, role="villager", nt=0)
        await _set_pool(100)

        r = await client.post("/api/nt/earn",
                              json={"to": target, "amount": 5},
                              headers=_h(villager_tok))
        assert r.status_code == 403, r.text

    @pytest.mark.asyncio
    async def test_over_limit_400(self, client):
        admin_tok = await _mk_user(f"m2a_admin2_{uuid.uuid4().hex[:6]}", role="admin")
        target = f"m2a_t2_{uuid.uuid4().hex[:6]}"
        await _mk_user(target, role="villager", nt=0)
        await _set_pool(999999)

        r = await client.post("/api/nt/earn",
                              json={"to": target, "amount": 10001},
                              headers=_h(admin_tok))
        assert r.status_code == 400, r.text
        assert "10000" in r.json()["detail"], r.text
        # 未到账
        assert await _user_balance(target) == 0

    @pytest.mark.asyncio
    async def test_pool_insufficient_400(self, client):
        admin_tok = await _mk_user(f"m2a_admin3_{uuid.uuid4().hex[:6]}", role="admin")
        target = f"m2a_t3_{uuid.uuid4().hex[:6]}"
        await _mk_user(target, role="villager", nt=0)
        await _set_pool(3)

        r = await client.post("/api/nt/earn",
                              json={"to": target, "amount": 8, "reason": "池空发奖"},
                              headers=_h(admin_tok))
        assert r.status_code == 400, r.text
        assert "余额不足" in r.json()["detail"], r.text
        # 未扣池、未到账
        assert await _pool_balance() == 3
        assert await _user_balance(target) == 0

    @pytest.mark.asyncio
    async def test_target_not_found_404(self, client):
        admin_tok = await _mk_user(f"m2a_admin4_{uuid.uuid4().hex[:6]}", role="admin")
        await _set_pool(100)
        r = await client.post("/api/nt/earn",
                              json={"to": "查无此人_" + uuid.uuid4().hex[:6], "amount": 5},
                              headers=_h(admin_tok))
        assert r.status_code == 404, r.text
