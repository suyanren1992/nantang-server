"""C-B-2: 营地报到端点 + people 读时聚合验收。

覆盖判据：
  ① 幂等：两次 checkin 恰 1 条 membership，响应一致（already_member 第二次 True）
  ② 聚合：3 人报到 → people=3；1 人 left → people=2（list_camps + report 两处）
  ③ 404（camp 不存在）/ 401（未登录）路径齐
"""
import uuid
import pytest
from datetime import datetime

from sqlalchemy import select, func
from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, Camp, CampMembership


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mk_user(name, role="adventurer"):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                   role=role, contribution_value=0, experience_value=0,
                   nt_balance=0, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


async def _mk_camp(name="C-B-2 报到营"):
    cid = f"cb2_c_{uuid.uuid4().hex[:6]}"
    async with async_session() as s:
        s.add(Camp(id=cid, name=name, created_at=datetime.utcnow().isoformat()))
        await s.commit()
    return cid


async def _membership_count(camp_id, status=None):
    async with async_session() as s:
        q = select(func.count()).select_from(CampMembership).where(CampMembership.camp_id == camp_id)
        if status:
            q = q.where(CampMembership.status == status)
        return (await s.execute(q)).scalar_one()


class TestCampCheckinIdempotent:
    @pytest.mark.asyncio
    async def test_double_checkin_one_row_consistent(self, client):
        cid = await _mk_camp()
        tok = await _mk_user(f"cb2_u_{uuid.uuid4().hex[:6]}")

        r1 = await client.post(f"/api/camps/{cid}/checkin", headers=_h(tok))
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert b1["ok"] is True
        assert b1["already_member"] is False
        assert b1["membership"]["status"] == "active"
        assert b1["membership"]["camp_role"] == "member"
        assert b1["people"] == 1

        r2 = await client.post(f"/api/camps/{cid}/checkin", headers=_h(tok))
        assert r2.status_code == 200, r2.text
        b2 = r2.json()
        assert b2["already_member"] is True, "第二次应识别既有成员"
        assert b2["membership"]["user_id"] == b1["membership"]["user_id"]
        assert b2["membership"]["camp_id"] == b1["membership"]["camp_id"]
        assert b2["people"] == 1, "幂等：不重复计数"

        # 恰 1 条记录
        assert await _membership_count(cid) == 1


class TestCampPeopleAggregation:
    @pytest.mark.asyncio
    async def test_three_join_then_one_left(self, client):
        cid = await _mk_camp()
        toks = [await _mk_user(f"cb2_agg_{i}_{uuid.uuid4().hex[:6]}") for i in range(3)]
        uids = []
        for t in toks:
            r = await client.post(f"/api/camps/{cid}/checkin", headers=_h(t))
            assert r.status_code == 200, r.text
            uids.append(r.json()["membership"]["user_id"])
        assert r.json()["people"] == 3

        # list_camps 读时聚合 = 3
        admin_tok = await _mk_user(f"cb2_admin_{uuid.uuid4().hex[:6]}", "admin")
        rl = await client.get("/api/camps", headers=_h(admin_tok))
        assert rl.status_code == 200
        row = next(c for c in rl.json() if c["id"] == cid)
        assert row["people"] == 3, "list_camps 聚合应为 3"

        # report 读时聚合 = 3
        rr = await client.get(f"/api/camps/{cid}/report", headers=_h(admin_tok))
        assert rr.status_code == 200
        assert rr.json()["camp"]["people"] == 3, "report 聚合应为 3"

        # 1 人 left → people=2
        async with async_session() as s:
            m = (await s.execute(select(CampMembership).where(
                CampMembership.camp_id == cid, CampMembership.user_id == uids[0]))).scalar_one()
            m.status = "left"
            await s.commit()

        rl2 = await client.get("/api/camps", headers=_h(admin_tok))
        row2 = next(c for c in rl2.json() if c["id"] == cid)
        assert row2["people"] == 2, "left 后 list_camps 应为 2"
        rr2 = await client.get(f"/api/camps/{cid}/report", headers=_h(admin_tok))
        assert rr2.json()["camp"]["people"] == 2, "left 后 report 应为 2"
        # 记录仍在（left 非删除）
        assert await _membership_count(cid) == 3
        assert await _membership_count(cid, status="active") == 2


class TestCampCheckinAuthPaths:
    @pytest.mark.asyncio
    async def test_camp_not_found_404(self, client):
        tok = await _mk_user(f"cb2_404_{uuid.uuid4().hex[:6]}")
        r = await client.post("/api/camps/nonexistent_camp/checkin", headers=_h(tok))
        assert r.status_code == 404, r.text

    @pytest.mark.asyncio
    async def test_unauthenticated_401(self, client):
        cid = await _mk_camp()
        r = await client.post(f"/api/camps/{cid}/checkin")
        assert r.status_code == 401, r.text
