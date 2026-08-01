"""reserve 提现额控 + reserve_covers_frozen + withdraw 准入加固。

【SSOT-CHAIN 修正】
reserve 不等于式独立项——它是 pool.balance 的内部额控(提现上限),
资金仍在 pool.balance 内, 不单独计入 total_system。
若 reserve 入等式, 提现流程(user→frozen)会破守恒:
  withdraw_request: reserve-=N, frozen+=N → total_system-N（total_issued 不变→不平）

链上充值现在进 pool.balance（不再藏 reserve）, 故 reserve 无需入等式。

覆盖判据：
  ① verify() total_system 不含 reserve 项（它在 pool.balance 内部）
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


class TestReserveInEquation:
    @pytest.mark.asyncio
    async def test_total_system_excludes_reserve(self, client):
        """SSOT-CHAIN: reserve 不计入 total_system — 它是 pool.balance 内部额控。

        reserve 的资金已在 pool.balance 里, 入等式会 double-count 且提现破守恒。
        """
        tok = await _mk_user(f"p2_a_{uuid.uuid4().hex[:6]}")
        await _set_pool(balance=100, task_escrow=0, camp_balance=0, reserve=77, frozen=0)
        r = await client.get("/api/nt/verify", headers=_h(tok))
        assert r.status_code == 200, r.text
        c = r.json()["checks"]
        # total_system 应不含 reserve
        expected_no_reserve = (c["total_user_balance"] + c["community_pool"]
                               + c["task_escrow"] + c["camp_balance"] + c["frozen"])
        assert c["total_system"] == expected_no_reserve, (
            f"total_system={c['total_system']} ≠ {expected_no_reserve} (含reserve会被double-count)")
        # reserve 字段仍存在（展示用）；N-1b clamp 确保 reserve ≤ balance
        assert c["reserve"] == 77, c

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
