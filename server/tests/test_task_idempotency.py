"""P0-2 回归：create_task 服务端幂等（同 poster+title 60s 窗口内不二次建单/冻结）。

判据（对齐任务卡 方案/任务卡/P0-2_任务创建服务端幂等.md）：
  1. 双 POST（同 title+poster，间隔 <1s）→ 只建 1 单、nt_ledger 只多 1 条 task_freeze、余额只扣 1 次
  2. 正常单次 POST 不受影响（建单 + 冻结正常）
  3. 时间窗外同名任务可正常创建（回填旧 created_at 模拟窗口外）
  4. 边界：同 title 但 reward 不同 → 视为不同任务，允许创建
"""
import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy import select, func

from database import async_session
from models import User, CommunityPool, NTTask, NTLedger


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _register_and_login(client, name, role="villager", balance=1000):
    r = await client.post("/api/auth/register", json={"name": name, "password": "Passw0rd!"})
    assert r.status_code == 200 and r.json()["ok"] is True, r.text
    uid = r.json()["user"]["uid"]
    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        u.role = role
        u.nt_balance = balance
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0)
            s.add(pool)
        else:
            pool.balance = max(pool.balance or 0, 10000)
        await s.commit()
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"], uid


async def _count_tasks(poster, title):
    async with async_session() as s:
        return (await s.execute(
            select(func.count()).select_from(NTTask).where(
                NTTask.poster == poster, NTTask.title == title)
        )).scalar_one()


async def _count_freeze(task_id):
    async with async_session() as s:
        return (await s.execute(
            select(func.count()).select_from(NTLedger).where(
                NTLedger.task_id == task_id, NTLedger.type == "task_freeze")
        )).scalar_one()


async def _balance(uid):
    async with async_session() as s:
        return (await s.execute(select(User.nt_balance).where(User.id == uid))).scalar_one()


@pytest.mark.asyncio
async def test_double_post_idempotent(client):
    """判据1：双 POST 只建 1 单、只 1 条冻结流水、只扣 1 次余额。"""
    tok, uid = await _register_and_login(client, "idem_dbl_z", balance=1000)
    payload = {"title": "幂等双投任务_z", "reward": 5, "slots": 1}

    r1 = await client.post("/api/tasks", headers=_h(tok), json=payload)
    assert r1.status_code == 200, r1.text
    b1 = r1.json()
    assert b1["ok"] is True and b1.get("idempotent") is not True
    tid1 = b1["task_id"]

    r2 = await client.post("/api/tasks", headers=_h(tok), json=payload)
    assert r2.status_code == 200, r2.text
    b2 = r2.json()
    assert b2["task_id"] == tid1, "第二次应幂等返回同一 task_id"
    assert b2.get("idempotent") is True

    assert await _count_tasks(uid, "幂等双投任务_z") == 1, "只应建 1 单"
    assert await _count_freeze(tid1) == 1, "只应 1 条 task_freeze 流水"
    assert await _balance(uid) == 995, "只应扣 1 次 5NT（1000→995）"


@pytest.mark.asyncio
async def test_single_post_normal(client):
    """判据2：正常单次 POST 建单 + 冻结正常。"""
    tok, uid = await _register_and_login(client, "idem_single_z", balance=1000)
    r = await client.post("/api/tasks", headers=_h(tok),
                          json={"title": "正常单投_z", "reward": 8, "slots": 2})
    assert r.status_code == 200, r.text
    tid = r.json()["task_id"]
    assert r.json().get("idempotent") is not True
    assert await _count_tasks(uid, "正常单投_z") == 1
    assert await _count_freeze(tid) == 1
    assert await _balance(uid) == 984, "扣 8*2=16（1000→984）"


@pytest.mark.asyncio
async def test_outside_window_creates_new(client):
    """判据3：时间窗外同名任务可正常创建（回填旧 created_at 到 61s 前）。"""
    tok, uid = await _register_and_login(client, "idem_window_z", balance=1000)
    payload = {"title": "窗口外重发_z", "reward": 5, "slots": 1}

    r1 = await client.post("/api/tasks", headers=_h(tok), json=payload)
    tid1 = r1.json()["task_id"]

    # 回填第一单 created_at 到 61 秒前，使其落在幂等窗口之外
    old = (datetime.utcnow() - timedelta(seconds=61)).isoformat()
    async with async_session() as s:
        t = (await s.execute(select(NTTask).where(NTTask.id == tid1))).scalar_one()
        t.created_at = old
        await s.commit()

    r2 = await client.post("/api/tasks", headers=_h(tok), json=payload)
    assert r2.status_code == 200, r2.text
    assert r2.json().get("idempotent") is not True, "窗口外应新建，非幂等返回"
    assert r2.json()["task_id"] != tid1
    assert await _count_tasks(uid, "窗口外重发_z") == 2, "窗口外应建第 2 单"


@pytest.mark.asyncio
async def test_same_title_diff_reward_is_distinct(client):
    """判据4：同 title 但 reward 不同 → 视为不同任务，允许创建。"""
    tok, uid = await _register_and_login(client, "idem_diff_z", balance=1000)
    r1 = await client.post("/api/tasks", headers=_h(tok),
                          json={"title": "同名异价_z", "reward": 5, "slots": 1})
    r2 = await client.post("/api/tasks", headers=_h(tok),
                          json={"title": "同名异价_z", "reward": 9, "slots": 1})
    assert r1.status_code == 200 and r2.status_code == 200
    assert r2.json().get("idempotent") is not True
    assert r1.json()["task_id"] != r2.json()["task_id"]
    assert await _count_tasks(uid, "同名异价_z") == 2
