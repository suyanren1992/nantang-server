# -*- coding: utf-8 -*-
"""CLEAN-WEEKLY-BE: 大扫除周任务后端测试（6 项）。

判据（卡面 ⑩-⑱）：
  ⑩ distribute 创建 N 个 task
  ⑪ claim CAS 互斥（并发抢同一 task）
  ⑫ unclaim 限制（仅 claimed_by 可 unclaim）
  ⑯ 校核通过后 task 状态 completed + streak +1
  ⑰ FE 轮询看到 status 变化
  ⑱ admin 才能 distribute
"""
import asyncio
from datetime import datetime

import pytest
from sqlalchemy import select

from auth_utils import hash_password
from database import async_session
from models import User, CommunityPool, CleanWeeklyTask


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _make_user(name, role="villager"):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=1000, trust_score=100, role=role))
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            s.add(CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0))
        await s.commit()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


WEEK = "2026-07-27"  # 某个周一


# ══ ⑱ admin 才能 distribute ══
class TestDistributeAdminOnly:
    @pytest.mark.asyncio
    async def test_non_admin_distribute_403(self, client):
        await _make_user("cw_villager", role="villager")
        tok = await _login(client, "cw_villager")
        r = await client.post("/api/clean_weekly/distribute", headers=_h(tok), json={
            "week_start_date": WEEK,
            "space_ids": ["dorm101"],
            "space_names": ["宿舍101"],
        })
        assert r.status_code == 403, r.text

    @pytest.mark.asyncio
    async def test_admin_distribute_200(self, client):
        await _make_user("cw_admin1", role="admin")
        tok = await _login(client, "cw_admin1")
        r = await client.post("/api/clean_weekly/distribute", headers=_h(tok), json={
            "week_start_date": "2026-08-03",  # 不同周避免幂等冲突
            "space_ids": ["dorm101", "dorm102", "kitchen"],
            "space_names": ["宿舍101", "宿舍102", "厨房"],
            "reward_nt": 15,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["tasks_created"] == 3


# ══ ⑩ distribute 创建 N 个 task ══
class TestDistributeCreatesTasks:
    @pytest.mark.asyncio
    async def test_creates_n_tasks(self, client):
        await _make_user("cw_admin2", role="admin")
        tok = await _login(client, "cw_admin2")
        week = "2026-08-10"
        r = await client.post("/api/clean_weekly/distribute", headers=_h(tok), json={
            "week_start_date": week,
            "space_ids": ["studio", "bathroom", "garden"],
            "space_names": ["工作室", "卫生间", "花园"],
        })
        assert r.status_code == 200
        assert r.json()["tasks_created"] == 3

        # GET /tasks 验证
        r2 = await client.get(f"/api/clean_weekly/tasks?week={week}", headers=_h(tok))
        assert r2.status_code == 200
        tasks = r2.json()["tasks"]
        assert len(tasks) == 3
        assert all(t["status"] == "open" for t in tasks)
        assert all(t["reward_nt"] == 15 for t in tasks)

    @pytest.mark.asyncio
    async def test_idempotent_same_week(self, client):
        """同周重复发放 → 400。"""
        await _make_user("cw_admin3", role="admin")
        tok = await _login(client, "cw_admin3")
        week = "2026-08-17"
        payload = {"week_start_date": week, "space_ids": ["dorm101"]}
        r1 = await client.post("/api/clean_weekly/distribute", headers=_h(tok), json=payload)
        assert r1.status_code == 200
        r2 = await client.post("/api/clean_weekly/distribute", headers=_h(tok), json=payload)
        assert r2.status_code == 400
        assert "已发放" in r2.json()["detail"]


# ══ ⑪ claim CAS 互斥 ══
class TestClaimCAS:
    @pytest.mark.asyncio
    async def test_claim_success(self, client):
        await _make_user("cw_admin4", role="admin")
        await _make_user("cw_alice")
        admin_tok = await _login(client, "cw_admin4")
        alice_tok = await _login(client, "cw_alice")

        week = "2026-08-24"
        r = await client.post("/api/clean_weekly/distribute", headers=_h(admin_tok), json={
            "week_start_date": week,
            "space_ids": ["hallway"],
            "space_names": ["走廊"],
        })
        task_id = r.json()["task_ids"][0]

        r2 = await client.post(f"/api/clean_weekly/claim/{task_id}", headers=_h(alice_tok))
        assert r2.status_code == 200
        assert r2.json()["status"] == "claimed"

    @pytest.mark.asyncio
    async def test_claim_already_claimed_400(self, client):
        """已被认领的 task → 第二人 claim 失败。"""
        await _make_user("cw_admin5", role="admin")
        await _make_user("cw_bob")
        await _make_user("cw_carol")
        admin_tok = await _login(client, "cw_admin5")
        bob_tok = await _login(client, "cw_bob")
        carol_tok = await _login(client, "cw_carol")

        week = "2026-08-31"
        r = await client.post("/api/clean_weekly/distribute", headers=_h(admin_tok), json={
            "week_start_date": week,
            "space_ids": ["kitchen2"],
            "space_names": ["厨房2号"],
        })
        task_id = r.json()["task_ids"][0]

        # Bob 先领
        r2 = await client.post(f"/api/clean_weekly/claim/{task_id}", headers=_h(bob_tok))
        assert r2.status_code == 200

        # Carol 再领 → 400
        r3 = await client.post(f"/api/clean_weekly/claim/{task_id}", headers=_h(carol_tok))
        assert r3.status_code == 400
        assert "已被认领" in r3.json()["detail"]


# ══ ⑫ unclaim 限制（仅 claimed_by 可 unclaim） ══
class TestUnclaimRestriction:
    @pytest.mark.asyncio
    async def test_unclaim_by_owner(self, client):
        await _make_user("cw_admin6", role="admin")
        await _make_user("cw_dave")
        admin_tok = await _login(client, "cw_admin6")
        dave_tok = await _login(client, "cw_dave")

        week = "2026-09-07"
        r = await client.post("/api/clean_weekly/distribute", headers=_h(admin_tok), json={
            "week_start_date": week,
            "space_ids": ["laundry"],
            "space_names": ["洗衣房"],
        })
        task_id = r.json()["task_ids"][0]

        await client.post(f"/api/clean_weekly/claim/{task_id}", headers=_h(dave_tok))
        r2 = await client.post(f"/api/clean_weekly/unclaim/{task_id}", headers=_h(dave_tok))
        assert r2.status_code == 200
        assert r2.json()["status"] == "open"

    @pytest.mark.asyncio
    async def test_unclaim_by_other_403(self, client):
        """非本人 unclaim → 403。"""
        await _make_user("cw_admin7", role="admin")
        await _make_user("cw_eve")
        await _make_user("cw_frank")
        admin_tok = await _login(client, "cw_admin7")
        eve_tok = await _login(client, "cw_eve")
        frank_tok = await _login(client, "cw_frank")

        week = "2026-09-14"
        r = await client.post("/api/clean_weekly/distribute", headers=_h(admin_tok), json={
            "week_start_date": week,
            "space_ids": ["storage"],
            "space_names": ["储藏室"],
        })
        task_id = r.json()["task_ids"][0]

        await client.post(f"/api/clean_weekly/claim/{task_id}", headers=_h(eve_tok))
        r2 = await client.post(f"/api/clean_weekly/unclaim/{task_id}", headers=_h(frank_tok))
        assert r2.status_code == 403


# ══ ⑯ 校核通过后 task 状态 completed + streak ══
class TestApproveCompletesTask:
    @pytest.mark.asyncio
    async def test_full_flow(self, client):
        """distribute → claim → submit → approve → task completed + streak +1。"""
        await _make_user("cw_admin8", role="admin")
        await _make_user("cw_grace")
        await _make_user("cw_verifier1", role="villager")
        admin_tok = await _login(client, "cw_admin8")
        grace_tok = await _login(client, "cw_grace")
        verifier_tok = await _login(client, "cw_verifier1")

        week = "2026-09-21"
        # 1. distribute
        r = await client.post("/api/clean_weekly/distribute", headers=_h(admin_tok), json={
            "week_start_date": week,
            "space_ids": ["bedroom1"],
            "space_names": ["卧室1"],
            "reward_nt": 15,
        })
        task_id = r.json()["task_ids"][0]

        # 2. claim
        r2 = await client.post(f"/api/clean_weekly/claim/{task_id}", headers=_h(grace_tok))
        assert r2.status_code == 200

        # 3. submit（建 Verification）
        r3 = await client.post(f"/api/clean_weekly/submit/{task_id}", headers=_h(grace_tok))
        assert r3.status_code == 200
        vfy_id = r3.json()["verification_id"]

        # 4. approve（peer 校核通过）
        r4 = await client.post(f"/api/nt/verifications/{vfy_id}/approve",
                               headers=_h(verifier_tok),
                               json={"doer": "cw_grace", "action": "打扫 卧室1", "nt_amount": 15})
        assert r4.status_code == 200, r4.text

        # 5. 验证 task 状态 = completed
        async with async_session() as s:
            task = (await s.execute(
                select(CleanWeeklyTask).where(CleanWeeklyTask.id == task_id)
            )).scalar_one_or_none()
            assert task is not None
            assert task.status == "completed"

            # 6. 验证 streak +1
            grace = (await s.execute(
                select(User).where(User.id == "cw_grace")
            )).scalar_one_or_none()
            assert grace.clean_weekly_streak == 1


# ══ ⑰ FE 轮询看到 status 变化 ══
class TestPollingStatusChange:
    @pytest.mark.asyncio
    async def test_poll_shows_status_change(self, client):
        """distribute → claim → GET /tasks 看到 status=claimed。"""
        await _make_user("cw_admin9", role="admin")
        await _make_user("cw_heidi")
        admin_tok = await _login(client, "cw_admin9")
        heidi_tok = await _login(client, "cw_heidi")

        week = "2026-09-28"
        r = await client.post("/api/clean_weekly/distribute", headers=_h(admin_tok), json={
            "week_start_date": week,
            "space_ids": ["field_a"],
            "space_names": ["A 田"],
        })
        task_id = r.json()["task_ids"][0]

        # 轮询 1: open
        r2 = await client.get(f"/api/clean_weekly/tasks?week={week}", headers=_h(heidi_tok))
        assert r2.json()["tasks"][0]["status"] == "open"

        # claim
        await client.post(f"/api/clean_weekly/claim/{task_id}", headers=_h(heidi_tok))

        # 轮询 2: claimed
        r3 = await client.get(f"/api/clean_weekly/tasks?week={week}", headers=_h(heidi_tok))
        task_data = r3.json()["tasks"][0]
        assert task_data["status"] == "claimed"
        assert task_data["claimed_by"] == "cw_heidi"
