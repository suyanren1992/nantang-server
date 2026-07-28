"""G-3 回归：住宿费日「记账」（accrual 模式：cron + HTTP + 补记 + 鉴权收敛）。

G-3 后日 tick 默认 accrual——不动 nt_balance，只累计 Tenancy.accommodation_due，退房总结算。
四断言（对齐 accrual 语义）：
  1. 余额够 → 不扣余额、accommodation_due += rate、写 accommodation_accrued(pending) ledger、last_deducted 更新
  2. 余额=0 → 同样只记账（due += rate），余额不动、不产生 debt（欠费只在退房结算时才可能出现）
  3. 同一天重复触发 → 幂等，due 不重复累计
  4. 漏记 N 天 → tick 后补记 N 天（due == rate*N）
外加：G5 鉴权收敛——普通用户调 /api/system/daily-tick 应 403。
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, date, timedelta

from auth_utils import hash_password
from database import async_session
from models import User, Tenancy, NTLedger, CommunityPool
from sqlalchemy import select


WALLET = "0x0000000000000000000000000000000000000001"
BED_RATE = 20  # dorm101 费率


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(client, name, balance=200, role="villager"):
    """注册+登录+写库补 role/balance/wallet。"""
    r = await client.post("/api/auth/register", json={"name": name, "password": "Passw0rd!"})
    uid = r.json()["user"]["uid"]
    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        u.role = role
        u.nt_balance = balance
        u.wallet_address = WALLET
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=10000, total_issued=20000, reserve=10000)
            s.add(pool)
        else:
            pool.balance = max(pool.balance or 0, 10000)
            pool.last_tick_date = None  # 重置——使本测试的 daily_tick 不被前测阻塞
        await s.commit()
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"], uid


async def _checkin(client, tok, room_id="dorm101"):
    r = await client.post("/api/accommodation/checkin", headers=_h(tok),
                          json={"room_id": room_id, "bed_num": 1})
    assert r.status_code == 200 and r.json()["ok"] is True, r.json()


async def _backdate_checkin(user_id):
    """将最近 active tenancy 的 checkin_date 回填到昨天（UTC）——使 days_passed ≥ 1。"""
    yesterday = (datetime.utcnow().date() - timedelta(days=1)).isoformat()
    async with async_session() as s:
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == user_id, Tenancy.status == "active")
        )).scalar_one()
        ten.checkin_date = yesterday
        await s.commit()


@pytest.mark.asyncio
async def test_daily_tick_deducts_when_balance_sufficient(client: AsyncClient):
    """断言1：active tenancy + 余额够 → 扣费率 + accommodation_fee ledger + last_deducted=今天。"""
    admin_tok, _ = await _make_user(client, "d26_admin_z", role="admin", balance=10000)
    alice_tok, alice_id = await _make_user(client, "d26_alice_z", balance=200)
    await _checkin(client, alice_tok, "dorm101")
    await _backdate_checkin(alice_id)

    today = datetime.utcnow().strftime("%Y-%m-%d")
    r = await client.post("/api/system/daily-tick", headers=_h(admin_tok))
    assert r.status_code == 200 and r.json()["ok"] is True, r.json()

    async with async_session() as s:
        alice = (await s.execute(select(User).where(User.id == alice_id))).scalar_one()
        assert alice.nt_balance == 200, f"accrual 不动余额，实为 {alice.nt_balance}"
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == alice_id, Tenancy.status == "active")
        )).scalar_one()
        assert ten.last_deducted == today
        assert ten.accommodation_due == BED_RATE, f"应记账 {BED_RATE}，实为 {ten.accommodation_due}"
        ledgers = list((await s.execute(
            select(NTLedger).where(NTLedger.type == "accommodation_accrued",
                                   NTLedger.from_user == alice_id)
        )).scalars())
        assert len(ledgers) >= 1
        assert ledgers[-1].amount == BED_RATE
        assert ledgers[-1].status == "pending"


@pytest.mark.asyncio
async def test_daily_tick_accumulates_debt_when_insufficient(client: AsyncClient):
    """断言2：余额=0 → debt += rate，余额不动，写 debt_accrued ledger。"""
    admin_tok, _ = await _make_user(client, "d26_admin2_z", role="admin", balance=10000)
    bob_tok, bob_id = await _make_user(client, "d26_bob_z", balance=0)
    await _checkin(client, bob_tok, "dorm101")
    await _backdate_checkin(bob_id)

    r = await client.post("/api/system/daily-tick", headers=_h(admin_tok))
    assert r.status_code == 200

    async with async_session() as s:
        bob = (await s.execute(select(User).where(User.id == bob_id))).scalar_one()
        assert bob.nt_balance == 0, "accrual 不动余额"
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == bob_id, Tenancy.status == "active")
        )).scalar_one()
        assert ten.accommodation_due == BED_RATE, "余额0也只记账"
        assert ten.debt == 0, "记账期不产生 debt（欠费只在退房结算才可能）"
        ledgers = list((await s.execute(
            select(NTLedger).where(NTLedger.type == "accommodation_accrued", NTLedger.from_user == bob_id)
        )).scalars())
        assert len(ledgers) >= 1


@pytest.mark.asyncio
async def test_daily_tick_idempotent_same_day(client: AsyncClient):
    """断言3：同一天两次 tick → 第二次 skipped，余额只扣一次。"""
    admin_tok, _ = await _make_user(client, "d26_admin3_z", role="admin", balance=10000)
    carol_tok, carol_id = await _make_user(client, "d26_carol_z", balance=200)
    await _checkin(client, carol_tok, "dorm101")
    await _backdate_checkin(carol_id)

    r1 = await client.post("/api/system/daily-tick", headers=_h(admin_tok))
    assert r1.json().get("skipped") is not True  # 第一次执行
    r2 = await client.post("/api/system/daily-tick", headers=_h(admin_tok))
    assert r2.json().get("skipped") is True, "第二次应 skipped"

    async with async_session() as s:
        carol = (await s.execute(select(User).where(User.id == carol_id))).scalar_one()
        assert carol.nt_balance == 200, "accrual 不动余额"
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == carol_id, Tenancy.status == "active")
        )).scalar_one()
        assert ten.accommodation_due == BED_RATE, "幂等失败：记账累计了两次"


@pytest.mark.asyncio
async def test_daily_tick_catches_up_missed_days(client: AsyncClient):
    """断言4：last_deducted=3天前 → tick 补扣 3 天。"""
    admin_tok, _ = await _make_user(client, "d26_admin4_z", role="admin", balance=10000)
    dave_tok, dave_id = await _make_user(client, "d26_dave_z", balance=500)
    await _checkin(client, dave_tok, "dorm101")
    await _backdate_checkin(dave_id)

    # 手动把 last_deducted 设到 3 天前（UTC，对齐服务端 datetime.utcnow()）
    three_days_ago = (datetime.utcnow().date() - timedelta(days=3)).isoformat()
    async with async_session() as s:
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == dave_id, Tenancy.status == "active")
        )).scalar_one()
        ten.last_deducted = three_days_ago
        # pool last_tick_date 也设旧，否则整体 skipped
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one()
        pool.last_tick_date = three_days_ago
        await s.commit()

    r = await client.post("/api/system/daily-tick", headers=_h(admin_tok))
    assert r.status_code == 200
    body = r.json()
    assert body.get("caught_up_days", 0) >= 3, f"应补扣≥3天，实得 {body}"

    async with async_session() as s:
        dave = (await s.execute(select(User).where(User.id == dave_id))).scalar_one()
        assert dave.nt_balance == 500, "accrual 不动余额"
        ten = (await s.execute(
            select(Tenancy).where(Tenancy.user_id == dave_id, Tenancy.status == "active")
        )).scalar_one()
        assert ten.accommodation_due == BED_RATE * 3, f"应补记3天={BED_RATE*3}，实为 {ten.accommodation_due}"
        assert ten.last_deducted == datetime.utcnow().strftime("%Y-%m-%d")


@pytest.mark.asyncio
async def test_daily_tick_requires_admin(client: AsyncClient):
    """G5 鉴权收敛：普通用户调用应 403/401。"""
    villager_tok, _ = await _make_user(client, "d26_villager_z", balance=100, role="villager")
    r = await client.post("/api/system/daily-tick", headers=_h(villager_tok))
    assert r.status_code in (401, 403), f"普通用户应被拒，实际 {r.status_code}"
