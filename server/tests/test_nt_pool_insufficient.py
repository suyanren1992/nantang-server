"""NT-P0-1: \u793e\u533a\u6c60=0 \u8054\u52a8 bug\u2014\u2014card-confirm \u6c60\u4e0d\u8db3\u4e0d\u5361\u6b7b\uff0c\u8fd4\u56de\u660e\u786e 400 + \u63d0\u9192 admin\u3002

\u8986\u76d6\u5224\u636e\uff1a
  \u2460 pool=0 \u65f6 card-confirm \u8fd4\u56de\u660e\u786e\u9519\u8bef\u7801 400\uff08\u975e 500\u3001\u975e\u8d85\u65f6\uff09\uff0cdetail \u542b\u201c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u201d
  \u2461 admin \u7aef\u53ef\u89c2\u5bdf\u5230\u201c\u6c60\u4e0d\u8db3\u201d\u63d0\u9192\uff08logger.warning\uff09
  \u2462 \u6c60\u4e0d\u8db3\u65f6\u672a\u6263\u6c60\u3001\u672a\u5230\u8d26\u3001\u72b6\u6001\u4ecd pending\uff08\u4e0d\u5361\u6b7b\u3001\u4e0d\u526f\u4f5c\u7528\uff09
  \u2463 \u6c60\u5145\u8db3\u65f6\u6b63\u5e38\u786e\u8ba4\u4e0d\u53d7\u5f71\u54cd
"""
import uuid
import logging
import pytest

from sqlalchemy import select
from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, CommunityPool, CardDiscovery


def _h(t): return {"Authorization": f"Bearer {t}"}


async def _mk_user(name, role="villager", nt=0):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"), role=role,
                   contribution_value=0, experience_value=0, nt_balance=nt, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


async def _mk_disc(guesser, doer, nt_doer=8, status="pending"):
    did = f"disc_{uuid.uuid4().hex[:8]}"
    async with async_session() as s:
        s.add(CardDiscovery(id=did, space_id="sp", description="\u6253\u626b\u6b63\u5385",
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


class TestPoolInsufficientNoDeadlock:
    @pytest.mark.asyncio
    async def test_pool_zero_returns_clear_400_and_reminds_admin(self, client, caplog):
        rep = f"p1_rep_{uuid.uuid4().hex[:6]}"
        doer = f"p1_doer_{uuid.uuid4().hex[:6]}"
        await _mk_user(rep)
        doer_tok = await _mk_user(doer, nt=0)
        did = await _mk_disc(guesser=rep, doer=doer, nt_doer=8)
        await _set_pool(0)

        with caplog.at_level(logging.WARNING, logger="nt"):
            r = await client.post("/api/nt/card-confirm",
                                  json={"disc_id": did}, headers=_h(doer_tok))
        # \u2460 \u660e\u786e 400\uff08\u975e 500\uff09
        assert r.status_code == 400, r.text
        detail = r.json()["detail"]
        assert "\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458" in detail, detail
        # \u2461 admin \u63d0\u9192\u5df2\u843d\u65e5\u5fd7
        assert any("NT-P0-1" in rec.message for rec in caplog.records), caplog.text
        # \u2462 \u672a\u6263\u6c60/\u672a\u5230\u8d26/\u72b6\u6001\u4ecd pending
        assert await _pool_balance() == 0
        assert await _user_balance(doer) == 0
        assert await _disc_status(did) == "pending"

    @pytest.mark.asyncio
    async def test_pool_sufficient_still_ok(self, client):
        rep = f"p1_rep2_{uuid.uuid4().hex[:6]}"
        doer = f"p1_doer2_{uuid.uuid4().hex[:6]}"
        await _mk_user(rep)
        doer_tok = await _mk_user(doer, nt=0)
        did = await _mk_disc(guesser=rep, doer=doer, nt_doer=8)
        await _set_pool(100)

        r = await client.post("/api/nt/card-confirm",
                              json={"disc_id": did}, headers=_h(doer_tok))
        assert r.status_code == 200, r.text
        assert await _user_balance(doer) == 8
        assert await _pool_balance() == 92
        assert await _disc_status(did) == "confirmed"
