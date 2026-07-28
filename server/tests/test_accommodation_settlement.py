"""G-3 新增：退房总结算 + 欠费上限（判据 2/3/4/5）。

覆盖：
  判据2 退房余额够 → 一次性扣款 + accommodation_settlement(settled) ledger + due 清零 + 结算单
  判据3 退房余额不足 → 实扣部分 + 剩余记 debt(留存) + debt_unpaid(pending) ledger
  判据4 累计未结欠费超 14 天房费 → 全新入住 checkin 被 403 拒绝且人话提示
  判据5 对账等式守恒：退房结算是 user↔pool 转移，total_system 前后不变（GET /api/nt/verify）

  注：测试用直接置库注入余额，破坏 total_issued 绝对等式，故判据5断言「结算前后
  total_system 守恒」——这才是 G-3 计费改造要守的真不变量（due/debt 不入等式）。
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta

from database import async_session
from models import User, Tenancy, NTLedger, CommunityPool
from sqlalchemy import select


BED_RATE = 20  # dorm101


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(client, name, balance=200, role="villager"):
    r = await client.post("/api/auth/register", json={"name": name, "password": "Passw0rd!"})
    uid = r.json()["user"]["uid"]
    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        u.role = role
        u.nt_balance = balance
        u.wallet_address = "0x0000000000000000000000000000000000000001"
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=10000, total_issued=20000, reserve=10000)
            s.add(pool)
        else:
            pool.balance = max(pool.balance or 0, 10000)
        await s.commit()
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"], uid


async def _checkin(client, tok, room_id="dorm101"):
    r = await client.post("/api/accommodation/checkin", headers=_h(tok),
                          json={"room_id": room_id, "bed_num": 1})
    assert r.status_code == 200 and r.json()["ok"] is True, r.json()


async def _set_due(user_id, due=0, debt=0):
    """直接置 active tenancy 的 accommodation_due/debt，模拟已记账 N 天。"""
    async with async_session() as s:
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == user_id, Tenancy.status == "active")
        )).scalar_one()
        ten.accommodation_due = due
        ten.debt = debt
        await s.commit()


async def _total_system(client, admin_tok):
    r = await client.get("/api/nt/verify", headers=_h(admin_tok))
    assert r.status_code == 200, r.text
    return r.json()["checks"]["total_system"]


@pytest.mark.asyncio
async def test_checkout_settles_when_balance_sufficient(client: AsyncClient):
    """判据2：退房余额够 → 一次性扣 due、settled ledger、due 清零、结算单。"""
    admin_tok, _ = await _make_user(client, "s_admin_a", role="admin", balance=10000)
    tok, uid = await _make_user(client, "s_alice", balance=200)
    await _checkin(client, tok, "dorm101")
    await _set_due(uid, due=BED_RATE * 3)  # 记账 3 天

    ts_before = await _total_system(client, admin_tok)
    r = await client.post("/api/accommodation/checkout", headers=_h(tok))
    assert r.status_code == 200, r.text
    st = r.json()["settlement"]
    assert st["accrued"] == BED_RATE * 3
    assert st["paid"] == BED_RATE * 3
    assert st["debt"] == 0
    assert st["days"] == 3

    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        assert u.nt_balance == 200 - BED_RATE * 3, f"应扣 {BED_RATE*3}，实为 {u.nt_balance}"
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == uid).order_by(Tenancy.id.desc())
        )).scalars().first()
        assert ten.accommodation_due == 0
        ledgers = list((await s.execute(
            select(NTLedger).where(NTLedger.type == "accommodation_settlement",
                                   NTLedger.from_user == uid)
        )).scalars())
        assert len(ledgers) == 1 and ledgers[0].status == "settled"
        assert ledgers[0].amount == BED_RATE * 3
    # 判据5：结算是 user→pool 转移，系统总额守恒
    assert await _total_system(client, admin_tok) == ts_before


@pytest.mark.asyncio
async def test_checkout_records_debt_when_insufficient(client: AsyncClient):
    """判据3：退房余额不足 → 实扣部分 + 剩余记 debt(留存) + debt_unpaid ledger。"""
    admin_tok, _ = await _make_user(client, "s_admin_b", role="admin", balance=10000)
    tok, uid = await _make_user(client, "s_bob", balance=50)
    await _checkin(client, tok, "dorm101")
    await _set_due(uid, due=BED_RATE * 5)  # 记账 5 天 = 100，余额只有 50

    ts_before = await _total_system(client, admin_tok)
    r = await client.post("/api/accommodation/checkout", headers=_h(tok))
    assert r.status_code == 200, r.text
    st = r.json()["settlement"]
    assert st["accrued"] == BED_RATE * 5
    assert st["paid"] == 50
    assert st["debt"] == BED_RATE * 5 - 50

    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        assert u.nt_balance == 0, f"应扣光余额，实为 {u.nt_balance}"
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == uid).order_by(Tenancy.id.desc())
        )).scalars().first()
        assert ten.debt == BED_RATE * 5 - 50, "剩余欠费应留存 debt（可追缴）"
        assert ten.accommodation_due == 0
        unpaid = list((await s.execute(
            select(NTLedger).where(NTLedger.type == "debt_unpaid", NTLedger.from_user == uid)
        )).scalars())
        assert len(unpaid) == 1 and unpaid[0].status == "pending"
    # 判据5：实扣部分是 user→pool 转移，debt 未结不入等式 → 系统总额守恒
    assert await _total_system(client, admin_tok) == ts_before


@pytest.mark.asyncio
async def test_checkin_blocked_when_debt_over_limit(client: AsyncClient):
    """判据4：累计未结欠费超 14 天房费 → 全新入住被 403 且人话提示。"""
    admin_tok, _ = await _make_user(client, "s_admin_c", role="admin", balance=10000)
    tok, uid = await _make_user(client, "s_carol", balance=0)
    await _checkin(client, tok, "dorm101")
    # 退房后留存超上限欠费（15 天房费 > 14 天上限）
    await _set_due(uid, due=BED_RATE * 15)
    r = await client.post("/api/accommodation/checkout", headers=_h(tok))
    assert r.status_code == 200

    # 再次全新入住 → 被拦
    r2 = await client.post("/api/accommodation/checkin", headers=_h(tok),
                           json={"room_id": "dorm101", "bed_num": 1})
    assert r2.status_code == 403, r2.text
    assert "欠费" in r2.json()["detail"] and "上限" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_checkin_allowed_when_debt_under_limit(client: AsyncClient):
    """判据4 反向：欠费未达上限 → 全新入住放行。"""
    admin_tok, _ = await _make_user(client, "s_admin_d", role="admin", balance=10000)
    tok, uid = await _make_user(client, "s_dave", balance=0)
    await _checkin(client, tok, "dorm101")
    await _set_due(uid, due=BED_RATE * 5)  # 5 天 < 14 天上限
    r = await client.post("/api/accommodation/checkout", headers=_h(tok))
    assert r.status_code == 200

    r2 = await client.post("/api/accommodation/checkin", headers=_h(tok),
                           json={"room_id": "dorm101", "bed_num": 1})
    assert r2.status_code == 200, r2.text
