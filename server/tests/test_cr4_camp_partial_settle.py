"""CR-4 营地任务 partial 结算送钱修复测试。

BUG（原 CR-4 / 派发单 BUG-2）：
  verify_task partial 退款分支原为 `if poster: poster.nt_balance += unclaimed`，
  营地任务只要 poster 存在就把未领份额打进 poster 个人余额 → 凭空送钱。

关键会计事实（CR-1 修复后）：
  营地任务 escrow_amount==0，创建时不冻结 camp_balance；结算 camp_balance 只扣
  实付 total_payout=reward*实领人数。未领份额的钱**从未离开 camp_balance**。
  因此营地任务不应退款——再退（无论进 poster 还是回 camp_balance）都会凭空造币。

  注意：派发单 BUG-2 建议 `if is_camp: camp_balance += unclaimed`——经实测该方案
  会令 camp_balance 凭空 +unclaimed（造币）。正确修复为营地任务不退款。

守恒判据（本卡真正保证）：
  verify approve 前后 total_system（total_user_balance+community_pool+task_escrow
  +camp_balance+frozen）保持不变 → 无凭空造币。
    · 修复前：poster 获 +unclaimed → total_system 抬高 unclaimed（造币）
    · 修复后：camp_balance 减实付、实领者加实付 → total_system delta==0
  ① 营地 partial 结算后 poster 余额不变（不得凭空获退款）
  ② 实领者正常到账 reward
  ③ total_system 守恒（delta==0，无造币）
  ④ 个人任务 partial 退款不受影响（回归保护）

已知遗留（非本卡范围）：营地支付奖励账本记 from='escrow' 而非 'camp_pool'，
  导致 verify() 的 camp_pool_drift 出现 -total_payout 缺口。这是营地支付路径的
  既有账本缺口（与锁/送钱无关），另案记录，见回执。
"""
import uuid
import pytest
from sqlalchemy import select

from database import async_session
from models import User, CommunityPool


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


async def _balance(uid):
    async with async_session() as s:
        return (await s.execute(select(User.nt_balance).where(User.id == uid))).scalar()


async def _total_system(client, tok):
    return (await client.get("/api/nt/verify", headers=_h(tok))).json()["checks"]["total_system"]


async def _camp_balance(client, tok):
    return (await client.get("/api/nt/verify", headers=_h(tok))).json()["checks"]["camp_balance"]


# ── 判据①②③：营地 partial 结算不送钱、total_system 守恒 ──
@pytest.mark.asyncio
async def test_camp_partial_settle_no_gift_to_poster(client):
    sfx = uuid.uuid4().hex[:6]
    tok, poster = await _reg(client, f"cr4_camp_poster_{sfx}", role="admin", balance=0)
    tokA, exeA = await _reg(client, f"cr4_exec_{sfx}", role="villager", balance=0)

    # 营地注资 camp_balance
    r = await client.post("/api/camps", json={
        "name": f"CR4营_{sfx}",
        "budget": {"adventurers": 0, "builders": 3, "lodgingNT": 20, "mealNT": 0},
        "schedule": [{"cells": [1]}], "milestones": [], "highlights": [],
        "builders": [], "tasks": [],
    }, headers=_h(tok))
    assert r.status_code == 200, r.text

    # 营地任务 reward=10, slots=3，只 1 人认领 → 未领 2 份=20
    tid = (await client.post("/api/tasks", json={
        "title": f"营地活_{sfx}", "reward": 10, "category": "other",
        "scope": "camp", "slots": 3, "poster": "",
    }, headers=_h(tok))).json()["task_id"]

    await client.post(f"/api/nt/tasks/{tid}/accept", headers=_h(tokA))
    await client.post(f"/api/nt/tasks/{tid}/submit", json={"evidence": "done"}, headers=_h(tokA))

    ts_before = await _total_system(client, tok)
    cb_before = await _camp_balance(client, tok)

    rv = await client.post(f"/api/nt/tasks/{tid}/verify", json={"approved": True}, headers=_h(tok))
    assert rv.status_code == 200, rv.text

    # ① poster 余额不变（不得凭空获 20 退款）
    assert await _balance(poster) == 0, "营地任务 poster 不得凭空获得未领份额退款"
    # ② 实领者到账 reward
    assert await _balance(exeA) == 10, "实领者应到账 reward=10"
    # ③ total_system 守恒（无造币）；camp_balance 仅减实付
    ts_after = await _total_system(client, tok)
    cb_after = await _camp_balance(client, tok)
    assert ts_after == ts_before, f"total_system 必须守恒（无造币）: {ts_before}->{ts_after}"
    assert cb_after == cb_before - 10, f"camp_balance 应仅减实付10: {cb_before}->{cb_after}"


# ── 判据④：个人任务 partial 退款不受影响（回归保护）──
@pytest.mark.asyncio
async def test_personal_partial_still_refunds_poster(client):
    sfx = uuid.uuid4().hex[:6]
    tok, poster = await _reg(client, f"cr4_p_poster_{sfx}", role="villager", balance=1000)
    tokA, exeA = await _reg(client, f"cr4_p_exec_{sfx}", role="villager", balance=0)

    bal_after_create = 1000 - 30  # reward10*slots3 冻结
    tid = (await client.post("/api/tasks", json={
        "title": f"个人活_{sfx}", "reward": 10, "category": "other",
        "scope": "personal", "slots": 3, "poster": "",
    }, headers=_h(tok))).json()["task_id"]
    assert await _balance(poster) == bal_after_create, "个人任务创建应冻结 reward*slots"

    await client.post(f"/api/nt/tasks/{tid}/accept", headers=_h(tokA))
    await client.post(f"/api/nt/tasks/{tid}/submit", json={"evidence": "done"}, headers=_h(tokA))
    await client.post(f"/api/nt/tasks/{tid}/verify", json={"approved": True}, headers=_h(tok))

    # 个人任务：未领 2 份=20 应退回 poster；1000 -30 +20 = 990
    assert await _balance(poster) == 990, "个人任务 partial 未领份额应退回 poster"
    assert await _balance(exeA) == 10, "实领者应到账 reward=10"
