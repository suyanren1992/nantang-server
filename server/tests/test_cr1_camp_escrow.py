"""CR-1 营地任务 escrow 双重扣款修复测试。

BUG：scope=="camp" 任务创建时原无条件扣发布者余额+加 task_escrow+设 escrow_amount，
但 camp 预算走 camp_balance，发布者被双重扣款且从未退回。
修复后：camp 任务 → 发布者余额不变、pool.task_escrow 不变、escrow_amount==0、
freeze ledger from=="camp_pool" 且金额==0（不击破 camp_pool_drift）。
个人/社区任务不受影响。判据5(pytest零回归)由全量套件保证。
"""
import pytest
from sqlalchemy import select, func

from database import async_session
from models import User, NTTask, NTLedger, CommunityPool


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _reg(client, name, role="villager", balance=0):
    r = await client.post("/api/auth/register", json={"name": name, "password": "Passw0rd!"})
    assert r.json()["ok"], r.text
    uid = r.json()["user"]["uid"]
    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        u.role = role
        u.nt_balance = balance
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0)
            s.add(pool)
        await s.commit()
    tok = (await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})).json()["token"]
    return tok, uid


async def _pool_escrow():
    async with async_session() as s:
        return (await s.execute(select(CommunityPool.task_escrow).limit(1))).scalar()


async def _balance(uid):
    async with async_session() as s:
        return (await s.execute(select(User.nt_balance).where(User.id == uid))).scalar()


async def _task(tid):
    async with async_session() as s:
        return (await s.execute(select(NTTask).where(NTTask.id == tid))).scalar_one()


# ── 判据1：营地任务 → 发布者余额不变、task_escrow 不变、escrow_amount==0 ──
@pytest.mark.asyncio
async def test_camp_task_no_double_charge(client):
    tok, uid = await _reg(client, "cr1_camp_poster", balance=1000)
    bal_before = await _balance(uid)
    esc_before = await _pool_escrow()

    r = await client.post("/api/tasks", json={
        "title": "营地任务A", "reward": 8, "category": "other",
        "scope": "camp", "slots": 2, "poster": "",
    }, headers=_h(tok))
    assert r.status_code == 200, r.text
    tid = r.json()["task_id"]

    assert await _balance(uid) == bal_before, "camp 任务不得扣发布者余额"
    assert await _pool_escrow() == esc_before, "camp 任务不得增加 task_escrow"

    t = await _task(tid)
    assert (t.escrow_amount or 0) == 0, "camp 任务 escrow_amount 必须为 0"


# ── 判据1b：camp freeze ledger from=camp_pool 且金额=0（不击破 camp_pool_drift）──
@pytest.mark.asyncio
async def test_camp_freeze_ledger_zero_amount(client):
    tok, uid = await _reg(client, "cr1_camp_ledger", balance=1000)
    r = await client.post("/api/tasks", json={
        "title": "营地任务B", "reward": 5, "category": "other",
        "scope": "camp", "slots": 1, "poster": "",
    }, headers=_h(tok))
    tid = r.json()["task_id"]
    async with async_session() as s:
        led = (await s.execute(
            select(NTLedger).where(NTLedger.task_id == tid, NTLedger.type == "task_freeze")
        )).scalar_one()
    assert led.from_user == "camp_pool", led.from_user
    assert led.amount == 0, "camp freeze ledger 金额必须为 0，否则击破 camp_pool_drift"


# ── 判据2：个人任务不受影响——正常扣款+加 escrow ──
@pytest.mark.asyncio
async def test_personal_task_still_charges(client):
    tok, uid = await _reg(client, "cr1_personal_poster", balance=1000)
    bal_before = await _balance(uid)
    esc_before = await _pool_escrow()

    r = await client.post("/api/tasks", json={
        "title": "个人任务A", "reward": 6, "category": "other",
        "scope": "社区", "slots": 2, "poster": "",
    }, headers=_h(tok))
    assert r.status_code == 200, r.text
    tid = r.json()["task_id"]

    assert await _balance(uid) == bal_before - 12, "个人任务应扣 reward*slots"
    assert await _pool_escrow() == esc_before + 12, "个人任务应加 task_escrow"
    t = await _task(tid)
    assert (t.escrow_amount or 0) == 12


# ── 判据2b：社区任务不受影响——从池扣、freeze from=community_pool ──
@pytest.mark.asyncio
async def test_community_task_unaffected(client):
    tok, uid = await _reg(client, "cr1_admin_poster", role="admin", balance=0)
    r = await client.post("/api/tasks", json={
        "title": "社区任务A", "reward": 3, "category": "other",
        "scope": "社区", "slots": 1, "poster": "社区",
    }, headers=_h(tok))
    assert r.status_code == 200, r.text
    tid = r.json()["task_id"]
    t = await _task(tid)
    assert (t.escrow_amount or 0) == 3
    async with async_session() as s:
        led = (await s.execute(
            select(NTLedger).where(NTLedger.task_id == tid, NTLedger.type == "task_freeze")
        )).scalar_one()
    assert led.from_user == "community_pool"
    assert led.amount == 3


# ── 判据4：两次创建营地任务不超扣（串行验证累计余额守恒）──
@pytest.mark.asyncio
async def test_camp_tasks_serial_no_overcharge(client):
    tok, uid = await _reg(client, "cr1_camp_serial", balance=1000)
    bal_before = await _balance(uid)
    esc_before = await _pool_escrow()
    for i in range(2):
        r = await client.post("/api/tasks", json={
            "title": f"营地并发{i}", "reward": 100, "category": "other",
            "scope": "camp", "slots": 1, "poster": "",
        }, headers=_h(tok))
        assert r.status_code == 200, r.text
    assert await _balance(uid) == bal_before, "两次营地任务发布者余额必须不变"
    assert await _pool_escrow() == esc_before, "两次营地任务 task_escrow 必须不变"
