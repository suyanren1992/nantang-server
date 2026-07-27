"""P1-1 任务撤回与退领端点测试（retract / retract-request / retract-review / unclaim）。

覆盖判据 1-4；判据5(pytest零回归)由全量套件保证。
每条断言服务端状态（直查库 + 接口返回），钱随单走：解冻退款必有 ledger + escrow 同步减。
"""
import json
import pytest
from httpx import AsyncClient
from sqlalchemy import select, func

from database import async_session
from models import User, NTTask, NTLedger, CommunityPool, ActivityLog


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


async def _create_task(client, tok, poster, title, reward=1, slots=1):
    r = await client.post("/api/tasks", json={
        "title": title, "reward": reward, "category": "other",
        "scope": "社区", "slots": slots, "poster": poster,
    }, headers=_h(tok))
    assert r.status_code == 200, r.text
    return r.json()["task_id"]


async def _task(tid):
    async with async_session() as s:
        return (await s.execute(select(NTTask).where(NTTask.id == tid))).scalar_one()


async def _ledger_count(tid, type_=None):
    async with async_session() as s:
        q = select(func.count()).select_from(NTLedger).where(NTLedger.task_id == tid)
        if type_:
            q = q.where(NTLedger.type == type_)
        return (await s.execute(q)).scalar()


async def _balance(uid):
    async with async_session() as s:
        return (await s.execute(select(User.nt_balance).where(User.id == uid))).scalar()


async def _escrow():
    async with async_session() as s:
        return (await s.execute(select(CommunityPool.task_escrow).limit(1))).scalar()


# ── 判据1：无人领撤回 → 回草稿+退款+ledger+escrow同步减 ──
@pytest.mark.asyncio
async def test_retract_unclaimed_refunds(client):
    tok, uid = await _reg(client, "p1_poster_a", balance=10)
    e0 = await _escrow()
    tid = await _create_task(client, tok, "p1_poster_a", "无人领任务A", reward=3)
    assert await _balance(uid) == 7      # 10 - 3 冻结
    assert await _escrow() == e0 + 3
    r = await client.post(f"/api/tasks/{tid}/retract", headers=_h(tok))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "草稿" and r.json()["refunded"] == 3
    t = await _task(tid)
    assert t.status == "草稿" and (t.escrow_amount or 0) == 0
    assert await _balance(uid) == 10     # 退款回全额
    assert await _escrow() == e0         # escrow 同步减回
    assert await _ledger_count(tid, "task_retract") == 1  # 解冻流水


# ── 判据2：已领未提交 自助撤回409 → 申请 → admin批准=退款/拒绝=继续 ──
@pytest.mark.asyncio
async def test_retract_claimed_requires_request_then_approve(client):
    ptok, puid = await _reg(client, "p1_poster_b", balance=10)
    dtok, duid = await _reg(client, "p1_doer_b")
    atok, auid = await _reg(client, "p1_admin_b", role="admin")
    tid = await _create_task(client, ptok, "p1_poster_b", "已领任务B", reward=4)
    assert (await client.post(f"/api/nt/tasks/{tid}/accept", headers=_h(dtok))).status_code == 200
    # 自助撤回 → 409
    r = await client.post(f"/api/tasks/{tid}/retract", headers=_h(ptok))
    assert r.status_code == 409
    # 申请制
    r = await client.post(f"/api/tasks/{tid}/retract-request", headers=_h(ptok))
    assert r.status_code == 200 and r.json()["status"] == "撤回申请中"
    # admin 批准 → 退款 + 回草稿 + 通知领取者
    e_before = await _escrow()
    r = await client.post(f"/api/tasks/{tid}/retract-review", json={"approved": True}, headers=_h(atok))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "草稿" and r.json()["refunded"] == 4
    assert duid in r.json()["notified"]
    assert await _balance(puid) == 10
    assert await _escrow() == e_before - 4
    assert await _ledger_count(tid, "task_retract") == 1


@pytest.mark.asyncio
async def test_retract_review_reject_continues(client):
    ptok, puid = await _reg(client, "p1_poster_c", balance=10)
    dtok, duid = await _reg(client, "p1_doer_c")
    atok, auid = await _reg(client, "p1_admin_c", role="admin")
    tid = await _create_task(client, ptok, "p1_poster_c", "已领任务C", reward=4)
    assert (await client.post(f"/api/nt/tasks/{tid}/accept", headers=_h(dtok))).status_code == 200
    await client.post(f"/api/tasks/{tid}/retract-request", headers=_h(ptok))
    bal_before = await _balance(puid)
    r = await client.post(f"/api/tasks/{tid}/retract-review", json={"approved": False}, headers=_h(atok))
    assert r.status_code == 200 and r.json()["status"] == "进行中"
    t = await _task(tid)
    assert t.status == "进行中" and (t.escrow_amount or 0) == 4  # 托管金原样冻结
    assert await _balance(puid) == bal_before                    # 未退款


# ── 判据3：已提交任务撤回 → 409 ──
@pytest.mark.asyncio
async def test_retract_submitted_409(client):
    ptok, puid = await _reg(client, "p1_poster_d", balance=10)
    dtok, duid = await _reg(client, "p1_doer_d")
    tid = await _create_task(client, ptok, "p1_poster_d", "已提交任务D", reward=2)
    assert (await client.post(f"/api/nt/tasks/{tid}/accept", headers=_h(dtok))).status_code == 200
    # doer 提交 → 待审核
    async with async_session() as s:
        t = (await s.execute(select(NTTask).where(NTTask.id == tid))).scalar_one()
        t.status = "待审核"
        await s.commit()
    r = await client.post(f"/api/tasks/{tid}/retract", headers=_h(ptok))
    assert r.status_code == 409
    r2 = await client.post(f"/api/tasks/{tid}/retract-request", headers=_h(ptok))
    assert r2.status_code == 409


# ── 判据4：unclaim → 移除claimant、回大厅、取消日志管理员可见 ──
@pytest.mark.asyncio
async def test_unclaim_releases_and_logs(client):
    ptok, puid = await _reg(client, "p1_poster_e", balance=10)
    dtok, duid = await _reg(client, "p1_doer_e")
    tid = await _create_task(client, ptok, "p1_poster_e", "退领任务E", reward=2, slots=2)
    assert (await client.post(f"/api/nt/tasks/{tid}/accept", headers=_h(dtok))).status_code == 200
    t = await _task(tid)
    assert duid in json.loads(t.assignees)
    r = await client.post(f"/api/tasks/{tid}/unclaim", headers=_h(dtok))
    assert r.status_code == 200 and r.json()["status"] == "进行中"
    t = await _task(tid)
    assignees = json.loads(t.assignees) if t.assignees else []
    assert duid not in assignees            # claimant 移除
    # 取消日志（管理员经 activity_log 可见）
    async with async_session() as s:
        logs = (await s.execute(select(ActivityLog).where(ActivityLog.type == "task_unclaim"))).scalars().all()
    assert any(duid in (l.text or "") and "退领任务E" in (l.text or "") for l in logs)
    # 未领者不能退领
    r2 = await client.post(f"/api/tasks/{tid}/unclaim", headers=_h(dtok))
    assert r2.status_code == 409


# ── 命名/托管金铁律：unclaim 不动托管金 ──
@pytest.mark.asyncio
async def test_unclaim_does_not_touch_escrow(client):
    ptok, puid = await _reg(client, "p1_poster_f", balance=10)
    dtok, duid = await _reg(client, "p1_doer_f")
    tid = await _create_task(client, ptok, "p1_poster_f", "退领不动钱F", reward=3)
    await client.post(f"/api/nt/tasks/{tid}/accept", headers=_h(dtok))
    e_before = await _escrow()
    bal_before = await _balance(puid)
    await client.post(f"/api/tasks/{tid}/unclaim", headers=_h(dtok))
    assert await _escrow() == e_before        # escrow 不变
    assert await _balance(puid) == bal_before  # 发布者余额不变
    t = await _task(tid)
    assert (t.escrow_amount or 0) == 3         # 托管金仍冻结
