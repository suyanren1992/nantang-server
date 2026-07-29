"""NT-P0-4a: GET /api/nt/sync \u65b0\u589e my_escrow / my_frozen / my_accommodation_due \u4e09\u5b57\u6bb5\u3002

\u8986\u76d6\u5224\u636e\uff1a
  \u2460 \u8fd4\u56de\u4f53\u542b\u4e09\u5b57\u6bb5
  \u2461 my_escrow = \u672c\u4eba\u53d1\u5e03\u672a\u91ca\u653e\u4efb\u52a1 escrow_amount \u6c47\u603b\uff08= frozen_balance \u73b0\u51b5\u503c\uff09
  \u2462 my_frozen = \u672c\u4eba pending \u63d0\u73b0\u6d41\u6c34\u5408\u8ba1
  \u2463 my_accommodation_due = \u672c\u4eba\u6d3b\u8dc3\u5165\u4f4f debt\uff08\u65e0\u5165\u4f4f=0\uff09
  \u2464 frozen_balance \u4ecd\u4fdd\u7559\uff08\u8fc7\u6e21\u671f\uff09
"""
import uuid
import pytest

from database import async_session
from auth_utils import hash_password, create_access_token
from models import User, NTTask, NTLedger, Tenancy, TASK_STATUSES


def _h(t): return {"Authorization": f"Bearer {t}"}


async def _mk_user(name, nt=0):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"), role="villager",
                   contribution_value=0, experience_value=0, nt_balance=nt, trust_score=100))
        await s.commit()
    return create_access_token(name, "villager", 0)


async def _mk_task(poster, escrow, status_key="open"):
    tid = f"t_{uuid.uuid4().hex[:8]}"
    async with async_session() as s:
        s.add(NTTask(id=tid, poster=poster, title="\u6d4b\u8bd5\u4efb\u52a1", reward=escrow,
                     status=TASK_STATUSES[status_key], slots=1, escrow_amount=escrow,
                     created_at="2026-07-29T00:00:00"))
        await s.commit()
    return tid


async def _mk_withdraw(uid, amount, status="pending"):
    async with async_session() as s:
        s.add(NTLedger(entry_id=f"L_{uuid.uuid4().hex[:8]}", from_user=uid, to_user="frozen_pool",
                       amount=amount, type="withdraw", status=status,
                       created_at="2026-07-29T00:00:00"))
        await s.commit()


async def _mk_tenancy(uid, debt, status="active"):
    async with async_session() as s:
        s.add(Tenancy(user_id=uid, room_id="A", bed_num=1, checkin_date="2026-07-01",
                      track="coop", status=status, debt=debt))
        await s.commit()


class TestSyncThreeFields:
    @pytest.mark.asyncio
    async def test_three_fields_present_and_correct(self, client):
        uid = f"s4_{uuid.uuid4().hex[:6]}"
        tok = await _mk_user(uid, nt=100)
        await _mk_task(uid, escrow=30)          # my_escrow=30
        await _mk_withdraw(uid, 50)             # my_frozen=50
        await _mk_withdraw(uid, 7, status="settled")   # \u4e0d\u8ba1\u5165 pending
        await _mk_tenancy(uid, debt=15)         # my_accommodation_due=15

        r = await client.get("/api/nt/sync", headers=_h(tok))
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("my_escrow", "my_frozen", "my_accommodation_due", "frozen_balance"):
            assert k in j, list(j.keys())
        assert j["my_escrow"] == 30, j
        assert j["my_escrow"] == j["frozen_balance"], "my_escrow \u5e94\u7b49\u4e8e\u73b0\u51b5 frozen_balance"
        assert j["my_frozen"] == 50, j
        assert j["my_accommodation_due"] == 15, j

    @pytest.mark.asyncio
    async def test_no_tenancy_no_withdraw_zero(self, client):
        uid = f"s4b_{uuid.uuid4().hex[:6]}"
        tok = await _mk_user(uid, nt=0)
        r = await client.get("/api/nt/sync", headers=_h(tok))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["my_escrow"] == 0, j
        assert j["my_frozen"] == 0, j
        assert j["my_accommodation_due"] == 0, j
