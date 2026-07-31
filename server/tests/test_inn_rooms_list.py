"""C-B-5a: GET /api/accommodation/inn-rooms \u623f\u578b\u5217\u8868\u7aef\u70b9\u9a8c\u6536\u3002

\u8986\u76d6\u5224\u636e\uff1a
  \u2460 \u8fd4\u56de 6 \u95f4\u6d3b\u8dc3\u623f\uff08\u6885/\u5170/\u7af9/\u83ca/quadA/quadB\uff09
  \u2461 occupied_dates \u6b63\u786e\u53cd\u6620\u5f53\u524d\u6d3b\u8dc3 inn \u9884\u8ba2\u7684 [checkin, checkout) \u533a\u95f4
  \u2462 closed \u623f\u4e0d\u8fdb\u5217\u8868\uff1bcoop \u8f68/\u5df2\u9000\u623f\u9884\u8ba2\u4e0d\u8ba1\u5165\u5360\u7528
"""
import uuid
import pytest

from sqlalchemy import select
from auth_utils import hash_password
from database import async_session
from models import InnRoom, Tenancy, User


async def _add_user(uid, role="villager"):
    """FK ON 下 Tenancy 引用的 user 必须存在——先建 user 再建 tenancy。"""
    async with async_session() as s:
        s.add(User(id=uid, password_hash=hash_password("Passw0rd!"),
                   role=role, contribution_value=0, experience_value=0,
                   nt_balance=0, trust_score=100))
        await s.commit()


async def _seed_six_rooms():
    rooms = [
        ("mei", "\u6885\u00b7\u5355\u4eba\u95f4", "single", 1, 40),
        ("lan", "\u5170\u00b7\u5355\u4eba\u95f4", "single", 1, 40),
        ("zhu", "\u7af9\u00b7\u5355\u4eba\u95f4", "single", 1, 40),
        ("ju", "\u83ca\u00b7\u5355\u4eba\u95f4", "single", 1, 40),
        ("quadA", "\u56db\u4eba\u95f4A", "quad", 4, 25),
        ("quadB", "\u56db\u4eba\u95f4B", "quad", 4, 25),
    ]
    async with async_session() as s:
        for rid, label, rtype, beds, rate in rooms:
            ex = (await s.execute(select(InnRoom).where(InnRoom.id == rid))).scalar_one_or_none()
            if not ex:
                s.add(InnRoom(id=rid, label=label, room_type=rtype, beds=beds,
                              rate=rate, dietary="vegetarian", status="active"))
        await s.commit()


async def _add_tenancy(rid, uid, checkin, checkout, track="inn", status="active"):
    async with async_session() as s:
        s.add(Tenancy(user_id=uid, room_id=rid, bed_num=1,
                      checkin_date=checkin, check_out_date=checkout,
                      track=track, status=status))
        await s.commit()


class TestInnRoomsList:
    @pytest.mark.asyncio
    async def test_returns_six_rooms(self, client):
        await _seed_six_rooms()
        r = await client.get("/api/accommodation/inn-rooms")
        assert r.status_code == 200, r.text
        rooms = r.json()["rooms"]
        ids = {x["id"] for x in rooms}
        assert {"mei", "lan", "zhu", "ju", "quadA", "quadB"} <= ids, rooms
        # \u6bcf\u95f4\u623f\u5b57\u6bb5\u9f50\u5907
        one = next(x for x in rooms if x["id"] == "mei")
        for k in ("label", "room_type", "beds", "rate", "dietary", "status", "occupied_dates"):
            assert k in one, one

    @pytest.mark.asyncio
    async def test_occupied_dates_interval(self, client):
        await _seed_six_rooms()
        uid = f"innu_{uuid.uuid4().hex[:6]}"
        await _add_user(uid)
        # [02-10, 02-13) => 10/11/12 三天占用，13 不含
        await _add_tenancy("lan", uid, "2026-02-10", "2026-02-13")
        r = await client.get("/api/accommodation/inn-rooms")
        assert r.status_code == 200, r.text
        lan = next(x for x in r.json()["rooms"] if x["id"] == "lan")
        assert lan["occupied_dates"] == ["2026-02-10", "2026-02-11", "2026-02-12"], lan

    @pytest.mark.asyncio
    async def test_coop_and_checked_out_not_counted(self, client):
        await _seed_six_rooms()
        u1 = f"innc_{uuid.uuid4().hex[:6]}"
        u2 = f"innd_{uuid.uuid4().hex[:6]}"
        await _add_user(u1)
        await _add_user(u2)
        # coop 轨不计入 inn 占用
        await _add_tenancy("zhu", u1, "2026-03-01", "2026-03-05", track="coop")
        # \u5df2\u9000\u623f\u4e0d\u8ba1\u5165
        await _add_tenancy("zhu", u2, "2026-03-06", "2026-03-09", track="inn", status="checked_out")
        r = await client.get("/api/accommodation/inn-rooms")
        assert r.status_code == 200, r.text
        zhu = next(x for x in r.json()["rooms"] if x["id"] == "zhu")
        assert zhu["occupied_dates"] == [], zhu
