"""M-2b-i: POST /api/nt/card-confirm 卡片发现确认发奖测试（涉钱）。

覆盖判据：
  ① 他人确认到账：doer(guessed_person) 确认 → 池→doer，pool.balance -= nt_doer，200
  ② 自校核 403：发现者(guesser) 确认自己发起的发现 → 403（御旨硬拦）
  ③ 记录不存在 404
  ④ 重复确认 409：已 confirmed 再确认 → 409
  ⑤ 社区池余额不足 → 400 明示 detail
  ⑥ 金额取自服务端记录（客户端只传 disc_id，无金额入参可篡改）
并发锁不双确认见 test_pg_locks.py::test_card_confirm_concurrent_single_grant（requires_pg，SQLite skip）。

铁律：不碰 withdraw confirm/reject；不改 earn 对外行为（M-2a 五测另测零回归）；不改 discovery 模型结构。
"""
import uuid
import pytest

from sqlalchemy import select
from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, CommunityPool, CardDiscovery


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mk_user(name, role="villager", nt=0):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                   role=role, contribution_value=0, experience_value=0,
                   nt_balance=nt, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


async def _mk_disc(guesser, doer, nt_doer=8, status="pending"):
    did = f"disc_{uuid.uuid4().hex[:8]}"
    async with async_session() as s:
        s.add(CardDiscovery(id=did, space_id="sp", description="打扫正厅",
                            guesser=guesser, guessed_person=doer,
                            status=status, nt_guesser=5, nt_doer=nt_doer,
                            created_at="2026-07-29T00:00:00"))
        await s.commit()
    return did


async def _set_pool(balance):
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
        return (await s.execute(select(CommunityPool).limit(1))).scalar_one().balance


async def _user_balance(name):
    async with async_session() as s:
        return (await s.execute(select(User).where(User.id == name))).scalar_one().nt_balance


async def _disc_status(did):
    async with async_session() as s:
        return (await s.execute(select(CardDiscovery).where(CardDiscovery.id == did))).scalar_one().status


class TestCardConfirm:
    @pytest.mark.asyncio
    async def test_doer_confirm_grants_from_pool(self, client):
        reporter = f"cc_rep_{uuid.uuid4().hex[:6]}"
        doer = f"cc_doer_{uuid.uuid4().hex[:6]}"
        await _mk_user(reporter)
        doer_tok = await _mk_user(doer, nt=0)
        did = await _mk_disc(guesser=reporter, doer=doer, nt_doer=8)
        await _set_pool(100)

        r = await client.post("/api/nt/card-confirm",
                              json={"disc_id": did}, headers=_h(doer_tok))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert j["balance"] == 8, j
        assert j["pool_balance"] == 92, j
        assert await _user_balance(doer) == 8
        assert await _pool_balance() == 92
        assert await _disc_status(did) == "confirmed"

    @pytest.mark.asyncio
    async def test_guesser_self_verify_403(self, client):
        reporter = f"cc_rep2_{uuid.uuid4().hex[:6]}"
        doer = f"cc_doer2_{uuid.uuid4().hex[:6]}"
        rep_tok = await _mk_user(reporter)
        await _mk_user(doer)
        did = await _mk_disc(guesser=reporter, doer=doer, nt_doer=8)
        await _set_pool(100)

        # 发现者本人来确认 → 御旨硬拦 403
        r = await client.post("/api/nt/card-confirm",
                              json={"disc_id": did}, headers=_h(rep_tok))
        assert r.status_code == 403, r.text
        # 未发奖、未改状态
        assert await _pool_balance() == 100
        assert await _disc_status(did) == "pending"

    @pytest.mark.asyncio
    async def test_disc_not_found_404(self, client):
        tok = await _mk_user(f"cc_x_{uuid.uuid4().hex[:6]}")
        await _set_pool(100)
        r = await client.post("/api/nt/card-confirm",
                              json={"disc_id": "查无此牌_" + uuid.uuid4().hex[:6]},
                              headers=_h(tok))
        assert r.status_code == 404, r.text

    @pytest.mark.asyncio
    async def test_double_confirm_409(self, client):
        reporter = f"cc_rep3_{uuid.uuid4().hex[:6]}"
        doer = f"cc_doer3_{uuid.uuid4().hex[:6]}"
        await _mk_user(reporter)
        doer_tok = await _mk_user(doer, nt=0)
        did = await _mk_disc(guesser=reporter, doer=doer, nt_doer=6)
        await _set_pool(100)

        r1 = await client.post("/api/nt/card-confirm",
                               json={"disc_id": did}, headers=_h(doer_tok))
        assert r1.status_code == 200, r1.text
        # 第二次确认 → 409，且不重复发奖
        r2 = await client.post("/api/nt/card-confirm",
                               json={"disc_id": did}, headers=_h(doer_tok))
        assert r2.status_code == 409, r2.text
        assert await _user_balance(doer) == 6, "重复确认不得二次发奖"
        assert await _pool_balance() == 94, "重复确认不得二次扣池"

    @pytest.mark.asyncio
    async def test_pool_insufficient_400(self, client):
        reporter = f"cc_rep4_{uuid.uuid4().hex[:6]}"
        doer = f"cc_doer4_{uuid.uuid4().hex[:6]}"
        await _mk_user(reporter)
        doer_tok = await _mk_user(doer, nt=0)
        did = await _mk_disc(guesser=reporter, doer=doer, nt_doer=8)
        await _set_pool(3)

        r = await client.post("/api/nt/card-confirm",
                              json={"disc_id": did}, headers=_h(doer_tok))
        assert r.status_code == 400, r.text
        assert "余额不足" in r.json()["detail"], r.text
        # 未扣池、未到账、状态仍 pending
        assert await _pool_balance() == 3
        assert await _user_balance(doer) == 0
        assert await _disc_status(did) == "pending"

    @pytest.mark.asyncio
    async def test_amount_from_record_not_client(self, client):
        """金额只取 discovery.nt_doer；客户端多传 amount 字段被忽略。"""
        reporter = f"cc_rep5_{uuid.uuid4().hex[:6]}"
        doer = f"cc_doer5_{uuid.uuid4().hex[:6]}"
        await _mk_user(reporter)
        doer_tok = await _mk_user(doer, nt=0)
        did = await _mk_disc(guesser=reporter, doer=doer, nt_doer=7)
        await _set_pool(100)

        r = await client.post("/api/nt/card-confirm",
                              json={"disc_id": did, "amount": 9999, "to": reporter},
                              headers=_h(doer_tok))
        assert r.status_code == 200, r.text
        # 仍按记录 nt_doer=7 发给 guessed_person(doer)，客户端 amount/to 无效
        assert r.json()["balance"] == 7, r.text
        assert await _user_balance(doer) == 7
        assert await _user_balance(reporter) == 0
