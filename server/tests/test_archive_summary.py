"""ZX-4 F12: 档案室个人沉淀聚合接口（口径①保守：仅公开计数，不露 NT 金额/欠费）。

判据：
  1. 完成任务数（已结算）按 user 聚合正确
  2. 完成校核数（verifier+verified）聚合正确
  3. 住宿次数/在住天数聚合正确
  4. 返回体不含任何 NT 金额/欠费字段（口径①隐私边界）
  5. 不存在用户返回零计数不报错；含%用户名不注入
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta

from database import async_session
from models import User, NTTask, Verification, Tenancy
from sqlalchemy import select


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _reg(client, name):
    rr = await client.post("/api/auth/register", json={"name": name, "password": "Passw0rd!"})
    uid = rr.json()["user"]["uid"]
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"], uid


@pytest.mark.asyncio
async def test_archive_summary_aggregates_public_counts(client: AsyncClient):
    tok, uid = await _reg(client, "zx4_alice")
    async with async_session() as s:
        # 2 个已结算任务（assignee）+ 1 个进行中（不计）
        s.add(NTTask(id="zx4_t1", poster="p", assignee=uid, title="t1",
                     status="已结算", created_at="2026-01-01"))
        s.add(NTTask(id="zx4_t2", poster="p", assignees=f'["{uid}"]', title="t2",
                     status="已结算", created_at="2026-01-01"))
        s.add(NTTask(id="zx4_t3", poster="p", assignee=uid, title="t3",
                     status="进行中", created_at="2026-01-01"))
        # 2 个 verified 校核（verifier=uid）+ 1 pending（不计）
        s.add(Verification(id="zx4_v1", type="cleaning", doer="x", verifier=uid,
                           status="verified", created_at="2026-01-01"))
        s.add(Verification(id="zx4_v2", type="cleaning", doer="y", verifier=uid,
                           status="verified", created_at="2026-01-01"))
        s.add(Verification(id="zx4_v3", type="cleaning", doer="z", verifier=uid,
                           status="pending", created_at="2026-01-01"))
        # 住宿：1 历史 + 1 active（3天前入住）
        three = (datetime.utcnow().date() - timedelta(days=3)).isoformat()
        s.add(Tenancy(user_id=uid, room_id="dorm101", bed_num=1,
                      checkin_date="2025-01-01", status="checked_out"))
        s.add(Tenancy(user_id=uid, room_id="dorm101", bed_num=1,
                      checkin_date=three, status="active"))
        await s.commit()

    r = await client.get(f"/api/data/archive_summary/{uid}", headers=_h(tok))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["tasks_completed"] == 2, d
    assert d["verifications_done"] == 2, d
    assert d["accommodation_stays"] == 2, d
    assert d["accommodation_days"] == 3, d
    # 判据4：口径① 不露任何 NT 金额/欠费
    keys = set(d.keys())
    forbidden = {"nt_balance", "balance", "debt", "accommodation_due", "amount", "ledger", "reward"}
    assert not (keys & forbidden), f"泄露敏感字段: {keys & forbidden}"


@pytest.mark.asyncio
async def test_archive_summary_nonexistent_and_wildcard_safe(client: AsyncClient):
    tok, uid = await _reg(client, "zx4_bob")
    # 不存在用户 → 零计数不报错
    r = await client.get("/api/data/archive_summary/nope_xyz", headers=_h(tok))
    assert r.status_code == 200
    d = r.json()
    assert d["exists"] is False and d["tasks_completed"] == 0
    # 含 % 通配符不注入（不返回全量）
    r2 = await client.get("/api/data/archive_summary/%25", headers=_h(tok))
    assert r2.status_code == 200
    assert r2.json()["tasks_completed"] == 0
