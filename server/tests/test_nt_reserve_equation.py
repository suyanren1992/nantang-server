"""NT-P0-2: reserve 移出会计等式 + reserve_covers_frozen + withdraw 准入加固。

覆盖判据：
  ① verify() total_system 不再含 reserve 项（旧 diff 永久 -X 消除）
  ② reserve_covers_frozen 字段存在且值正确
  ③ withdraw 准入：A-LABOR-BE ⑭ 部分提现+排队（reserve 无可用空间时 400）
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
        """A-LABOR-BE ⑭: reserve 无可用空间（reserve ≤ frozen）→ 400。"""
        tok = await _mk_user(f"p2_w_{uuid.uuid4().hex[:6]}", nt=500)
        # reserve=100, frozen=100 → available=0 → 400
        await _set_pool(balance=100, reserve=100, frozen=100)
        r = await client.post("/api/nt/withdraw", headers=_h(tok),
                              json={"amount": 50, "to_address": WALLET})
        assert r.status_code == 400, r.text
        assert "储备" in r.json()["detail"], r.text
    
    @pytest.mark.asyncio
    async def test_reserve_partial_withdraw_queue(self, client):
        """A-LABOR-BE ⑭: reserve 部分可用 → 部分发放+排队。"""
        tok = await _mk_user(f"p2_wp_{uuid.uuid4().hex[:6]}", nt=500)
        # reserve=100, frozen=80 → available=20 → pay 20, queue 30
        await _set_pool(balance=100, reserve=100, frozen=80)
        r = await client.post("/api/nt/withdraw", headers=_h(tok),
                              json={"amount": 50, "to_address": WALLET})
        assert r.status_code == 200, r.text
        assert r.json()["paid"] == 20
        assert r.json()["queued"] == 30

    @pytest.mark.asyncio
    async def test_reserve_covers_admits(self, client):
        tok = await _mk_user(f"p2_w2_{uuid.uuid4().hex[:6]}", nt=500)
        # reserve=200 >= frozen(80)+amount(50)=130 \u2192 \u51c6\u5165 200
        await _set_pool(balance=100, reserve=200, frozen=80)
        r = await client.post("/api/nt/withdraw", headers=_h(tok),
                              json={"amount": 50, "to_address": WALLET})
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
