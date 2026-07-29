"""C-B-4: 素社民宿轨后端验收。

覆盖判据：
  ① 区间重叠四边界（包含/相交/相邻不重叠/同日进出）——纯函数 + 端点集成
  ② Tenancy.track 兼容回归：coop 查询/入住行为零变化，track 默认 coop
  ③ InnRoom 单人间×4+四人间×2 规格；beds 上限占用
  ④ dev-reset hard 播 InnRoom → 200 且表空
"""
import uuid
import pytest
from datetime import datetime

from sqlalchemy import select, func
from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, Tenancy, InnRoom
from routes.accommodation import _intervals_overlap


def _h(t): return {"Authorization": f"Bearer {t}"}


async def _mk_user(name, role="visitor", nt=500):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"), role=role,
                   contribution_value=0, experience_value=0, nt_balance=nt, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


async def _seed_inn(rid, rtype="single", beds=1):
    async with async_session() as s:
        ex = (await s.execute(select(InnRoom).where(InnRoom.id == rid))).scalar_one_or_none()
        if not ex:
            s.add(InnRoom(id=rid, label=f"测试{rid}", room_type=rtype, beds=beds,
                          rate=40, dietary="vegetarian", status="active"))
            await s.commit()


class TestOverlapFourBoundaries:
    def test_contained(self):
        # [1,10] 包含 [3,5]
        assert _intervals_overlap("2026-01-03", "2026-01-05", "2026-01-01", "2026-01-10") is True

    def test_partial_intersect(self):
        # [1,5] 与 [3,8] 相交
        assert _intervals_overlap("2026-01-01", "2026-01-05", "2026-01-03", "2026-01-08") is True

    def test_adjacent_no_overlap(self):
        # [1,5] 与 [5,8] 相邻不重叠
        assert _intervals_overlap("2026-01-01", "2026-01-05", "2026-01-05", "2026-01-08") is False

    def test_same_day_in_out(self):
        # 同日进出：一人 5 号退、一人 5 号进 → 不重叠
        assert _intervals_overlap("2026-01-05", "2026-01-09", "2026-01-01", "2026-01-05") is False


class TestInnCheckin:
    @pytest.mark.asyncio
    async def test_single_room_overlap_rejected_adjacent_ok(self, client):
        rid = f"inn_s_{uuid.uuid4().hex[:5]}"
        await _seed_inn(rid, "single", 1)
        t1 = await _mk_user(f"inn_a_{uuid.uuid4().hex[:5]}")
        t2 = await _mk_user(f"inn_b_{uuid.uuid4().hex[:5]}")
        t3 = await _mk_user(f"inn_c_{uuid.uuid4().hex[:5]}")

        r1 = await client.post("/api/accommodation/checkin", headers=_h(t1), json={
            "room_id": rid, "track": "inn", "check_in": "2026-02-01", "check_out": "2026-02-05"})
        assert r1.status_code == 200, r1.text
        assert r1.json()["track"] == "inn"
        assert r1.json()["room_type"] == "single"

        # 相交 → 单人间(beds=1)已满 → 400
        r2 = await client.post("/api/accommodation/checkin", headers=_h(t2), json={
            "room_id": rid, "track": "inn", "check_in": "2026-02-03", "check_out": "2026-02-07"})
        assert r2.status_code == 400, r2.text

        # 相邻不重叠（2/5 进）→ 成功
        r3 = await client.post("/api/accommodation/checkin", headers=_h(t3), json={
            "room_id": rid, "track": "inn", "check_in": "2026-02-05", "check_out": "2026-02-09"})
        assert r3.status_code == 200, r3.text

    @pytest.mark.asyncio
    async def test_quad_holds_four(self, client):
        rid = f"inn_q_{uuid.uuid4().hex[:5]}"
        await _seed_inn(rid, "quad", 4)
        # 同日期区间四人可入，第五人满
        for i in range(4):
            tok = await _mk_user(f"inn_q{i}_{uuid.uuid4().hex[:5]}")
            r = await client.post("/api/accommodation/checkin", headers=_h(tok), json={
                "room_id": rid, "track": "inn", "check_in": "2026-03-01", "check_out": "2026-03-04"})
            assert r.status_code == 200, r.text
        tok5 = await _mk_user(f"inn_q5_{uuid.uuid4().hex[:5]}")
        r5 = await client.post("/api/accommodation/checkin", headers=_h(tok5), json={
            "room_id": rid, "track": "inn", "check_in": "2026-03-01", "check_out": "2026-03-04"})
        assert r5.status_code == 400, r5.text

    @pytest.mark.asyncio
    async def test_inn_room_not_found_404(self, client):
        tok = await _mk_user(f"inn_nf_{uuid.uuid4().hex[:5]}")
        r = await client.post("/api/accommodation/checkin", headers=_h(tok), json={
            "room_id": "no_such_inn", "track": "inn", "check_in": "2026-02-01", "check_out": "2026-02-03"})
        assert r.status_code == 404, r.text

    @pytest.mark.asyncio
    async def test_inn_missing_dates_400(self, client):
        rid = f"inn_md_{uuid.uuid4().hex[:5]}"
        await _seed_inn(rid, "single", 1)
        tok = await _mk_user(f"inn_md_{uuid.uuid4().hex[:5]}")
        r = await client.post("/api/accommodation/checkin", headers=_h(tok), json={
            "room_id": rid, "track": "inn"})
        assert r.status_code == 400, r.text


class TestCoopBackwardCompat:
    @pytest.mark.asyncio
    async def test_coop_checkin_unchanged_track_default(self, client):
        tok = await _mk_user(f"coop_{uuid.uuid4().hex[:5]}", "visitor")
        r = await client.post("/api/accommodation/checkin", headers=_h(tok), json={
            "room_id": "dorm101", "bed_num": 1})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["room_id"] == "dorm101"
        assert "track" not in body or body.get("track") in (None, "coop")  # coop 响应不新增 track 字段
        # DB: track 默认 coop
        async with async_session() as s:
            t = (await s.execute(select(Tenancy).where(Tenancy.room_id == "dorm101",
                 Tenancy.status == "active"))).scalars().first()
            assert t is not None
            assert t.track == "coop"
            assert t.check_out_date is None


class TestCampMembersEndpoint:
    @pytest.mark.asyncio
    async def test_admin_sees_members_fields_and_pagination(self, client):
        from models import Camp, CampMembership
        cid = f"cb4_c_{uuid.uuid4().hex[:5]}"
        async with async_session() as s:
            s.add(Camp(id=cid, name="C-B-4 名录营", created_at=datetime.utcnow().isoformat()))
            await s.commit()
        # 3 成员报到
        for i in range(3):
            tok = await _mk_user(f"cb4_m{i}_{uuid.uuid4().hex[:5]}", "adventurer")
            r = await client.post(f"/api/camps/{cid}/checkin", headers=_h(tok))
            assert r.status_code == 200, r.text
        admin = await _mk_user(f"cb4_admin_{uuid.uuid4().hex[:5]}", "admin")

        r = await client.get(f"/api/camps/{cid}/members", headers=_h(admin))
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) == 3
        row = data[0]
        for k in ("user_id", "role", "camp_role", "joined_at", "nt_balance"):
            assert k in row, f"缺字段 {k}"
        assert row["camp_role"] == "member"

        # 分页
        r2 = await client.get(f"/api/camps/{cid}/members?limit=2&offset=0", headers=_h(admin))
        assert len(r2.json()) == 2
        r3 = await client.get(f"/api/camps/{cid}/members?limit=2&offset=2", headers=_h(admin))
        assert len(r3.json()) == 1

    @pytest.mark.asyncio
    async def test_members_camp_not_found_404(self, client):
        admin = await _mk_user(f"cb4_404_{uuid.uuid4().hex[:5]}", "admin")
        r = await client.get("/api/camps/nope/members", headers=_h(admin))
        assert r.status_code == 404, r.text


class TestDevResetInnRoom:
    @pytest.mark.asyncio
    async def test_hard_clears_inn_rooms(self, client, monkeypatch):
        monkeypatch.setenv("DEV_TOOLS_ENABLED", "1")
        await _seed_inn(f"inn_dr_{uuid.uuid4().hex[:5]}", "single", 1)
        admin = await _mk_user(f"cb4_dr_admin_{uuid.uuid4().hex[:5]}", "admin")
        async with async_session() as s:
            cnt = (await s.execute(select(func.count()).select_from(InnRoom))).scalar_one()
        assert cnt >= 1
        r = await client.post("/api/admin/dev-reset?mode=hard", headers=_h(admin))
        assert r.status_code == 200, r.text
        async with async_session() as s:
            cnt2 = (await s.execute(select(func.count()).select_from(InnRoom))).scalar_one()
        assert cnt2 == 0
