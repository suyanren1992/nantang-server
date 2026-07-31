"""P3-二营戊: /api/camps/schedule 端点验收。

覆盖判据：
  ① 聚合：2 个 Camp 各塞 2 个 schedule 事件 → 返 4 个 item 按 date 升序
  ② 日期过滤：start_date=2026-08-01 → 仅返 8 月事件
  ③ 缺字段容错：Camp 无 schedule 字段 → 不崩，跳过
"""
import json
import uuid
import pytest
from datetime import datetime

from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, Camp


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mk_user(name, role="adventurer"):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                   role=role, contribution_value=0, experience_value=0,
                   nt_balance=0, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


async def _mk_camp_with_schedule(name, schedule_list):
    cid = f"sched_{uuid.uuid4().hex[:6]}"
    async with async_session() as s:
        s.add(Camp(
            id=cid, name=name, status="active",
            schedule=json.dumps(schedule_list, ensure_ascii=False),
            created_at=datetime.utcnow().isoformat(),
        ))
        await s.commit()
    return cid


class TestCampsScheduleAggregation:
    """① 聚合：2 Camp × 2 events = 4 items，按 date 升序。"""

    @pytest.mark.asyncio
    async def test_camps_schedule_returns_aggregated_events(self, client):
        tok = await _mk_user("sched_user1")

        await _mk_camp_with_schedule("营地甲", [
            {"date": "2026-08-15", "time": "09:00", "title": "开营仪式"},
            {"date": "2026-07-20", "time": "14:00", "title": "预备会"},
        ])
        await _mk_camp_with_schedule("营地乙", [
            {"date": "2026-08-01", "time": "10:00", "title": "工作坊"},
            {"date": "2026-07-10", "time": "08:00", "title": "团建"},
        ])

        resp = await client.get("/api/camps/schedule", headers=_h(tok))
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["count"] >= 4

        # 取前 4 个（可能有其他测试残留），验证升序
        dates = [item["event"]["date"] for item in data["items"]]
        assert dates == sorted(dates), f"日期应升序，实际: {dates}"


class TestCampsScheduleDateFilter:
    """② 日期过滤：start_date=2026-08-01 → 仅返 8 月事件。"""

    @pytest.mark.asyncio
    async def test_camps_schedule_filters_by_date_range(self, client):
        tok = await _mk_user("sched_user2")

        await _mk_camp_with_schedule("过滤营", [
            {"date": "2026-07-15", "time": "09:00", "title": "七月活动"},
            {"date": "2026-08-10", "time": "10:00", "title": "八月活动"},
            {"date": "2026-09-05", "time": "11:00", "title": "九月活动"},
        ])

        resp = await client.get(
            "/api/camps/schedule?start_date=2026-08-01&end_date=2026-08-31",
            headers=_h(tok),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True

        for item in data["items"]:
            d = item["event"].get("date", "")
            assert "2026-08-01" <= d <= "2026-08-31", f"日期 {d} 不在 8 月范围内"


class TestCampsScheduleMissingField:
    """③ 缺字段容错：Camp 无 schedule → 不崩，跳过。"""

    @pytest.mark.asyncio
    async def test_camps_schedule_handles_missing_schedule(self, client):
        tok = await _mk_user("sched_user3")

        # 建一个 schedule=None 的营地
        cid = f"nosched_{uuid.uuid4().hex[:6]}"
        async with async_session() as s:
            s.add(Camp(id=cid, name="无日程营", status="active",
                       schedule=None,
                       created_at=datetime.utcnow().isoformat()))
            await s.commit()

        resp = await client.get("/api/camps/schedule", headers=_h(tok))
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        # 无日程营不应出现在结果中
        camp_ids = [item["camp_id"] for item in data["items"]]
        assert cid not in camp_ids
