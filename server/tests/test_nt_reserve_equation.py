"""NT-P0-2: reserve \u79fb\u51fa\u4f1a\u8ba1\u7b49\u5f0f + reserve_covers_frozen + withdraw \u51c6\u5165\u52a0\u56fa\u3002

\u8986\u76d6\u5224\u636e\uff1a
  \u2460 verify() total_system \u4e0d\u518d\u542b reserve \u9879\uff08\u65e7 diff \u6c38\u4e45 -X \u6d88\u9664\uff09
  \u2461 reserve_covers_frozen \u5b57\u6bb5\u5b58\u5728\u4e14\u503c\u6b63\u786e
  \u2462 withdraw \u51c6\u5165\uff1areserve < frozen + amount \u65f6\u8fd4\u56de 400
"""
import uuid
import pytest

from sqlalchemy import select
from database import async_session
from auth_utils import hash_password, create_access_token
from models import User, CommunityPool


def _h(t): return {"Authorization": f"Bearer {t}"}
WALLET = "0x" + "a" * 40


async def _mk_user(name, nt=0, trust=100):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"), role="villager",
                   contribution_value=0, experience_value=0, nt_balance=nt,
                   trust_score=trust, wallet_address=WALLET))
        await s.commit()
    return create_access_token(name, "villager", 0)


async def _set_pool(balance=0, task_escrow=0, camp_balance=0, reserve=0, frozen=0):
    async with async_session() as s:
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(total_issued=500)
            s.add(pool)
        pool.balance = balance
        pool.task_escrow = task_escrow
        pool.camp_balance = camp_balance
        pool.reserve = reserve
        pool.frozen = frozen
        await s.commit()


class TestReserveOutOfEquation:
    @pytest.mark.asyncio
    async def test_total_system_excludes_reserve(self, client):
        tok = await _mk_user(f"p2_a_{uuid.uuid4().hex[:6]}")
        await _set_pool(balance=100, task_escrow=0, camp_balance=0, reserve=777, frozen=0)
        r = await client.get("/api/nt/verify", headers=_h(tok))
        assert r.status_code == 200, r.text
        c = r.json()["checks"]
        # total_system = \u7528\u6237\u603b\u989d + \u8fd0\u8425 + \u6258\u7ba1 + \u8425\u961f + \u51bb\u7ed3\uff08\u4e0d\u542b reserve\uff09
        expected = (c["total_user_balance"] + c["community_pool"] + c["task_escrow"]
                    + c["camp_balance"] + c["frozen"])
        assert c["total_system"] == expected, c
        # reserve \u4ecd\u5c55\u793a\u4f46\u4e0d\u53c2\u4e0e total_system
        assert c["reserve"] == 777, c
        assert c["total_system"] != expected + 777

    @pytest.mark.asyncio
    async def test_reserve_covers_frozen_flag(self, client):
        tok = await _mk_user(f"p2_b_{uuid.uuid4().hex[:6]}")
        # reserve >= frozen \u2192 True
        await _set_pool(balance=100, reserve=100, frozen=50)
        c = (await client.get("/api/nt/verify", headers=_h(tok))).json()["checks"]
        assert c["reserve_covers_frozen"] is True, c
        # reserve < frozen \u2192 False
        await _set_pool(balance=100, reserve=5, frozen=50)
        c = (await client.get("/api/nt/verify", headers=_h(tok))).json()["checks"]
        assert c["reserve_covers_frozen"] is False, c


class TestWithdrawAdmissionHardened:
    @pytest.mark.asyncio
    async def test_reserve_below_frozen_plus_amount_400(self, client):
        tok = await _mk_user(f"p2_w_{uuid.uuid4().hex[:6]}", nt=500)
        # reserve=100 < frozen(80)+amount(50)=130 \u2192 400
        await _set_pool(balance=100, reserve=100, frozen=80)
        r = await client.post("/api/nt/withdraw", headers=_h(tok),
                              json={"amount": 50, "to_address": WALLET})
        assert r.status_code == 400, r.text
        assert "\u50a8\u5907" in r.json()["detail"], r.text

    @pytest.mark.asyncio
    async def test_reserve_covers_admits(self, client):
        tok = await _mk_user(f"p2_w2_{uuid.uuid4().hex[:6]}", nt=500)
        # reserve=200 >= frozen(80)+amount(50)=130 \u2192 \u51c6\u5165 200
        await _set_pool(balance=100, reserve=200, frozen=80)
        r = await client.post("/api/nt/withdraw", headers=_h(tok),
                              json={"amount": 50, "to_address": WALLET})
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
