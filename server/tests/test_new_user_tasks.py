# -*- coding: utf-8 -*-
"""NEW-USER-TASK-BE: 新人任务后端测试（8 项）。

判据（任务卡 ⑥）：
  1. 首次入住触发派发
  2. 模板按 display_order 排
  3. 过期不显
  4. 新人任务走校核闭环
  5. CV/XP 公式生效
  6. 重复派发拦截
  7. admin 手动派发
  8. GET /api/new_user_tasks/me 拉自己
"""
import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from auth_utils import hash_password
from database import async_session
from models import (
    User, CommunityPool, NTTask, NewUserTaskTemplate,
    Verification, TASK_STATUSES, compute_cv, compute_xp,
)


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _ensure_pool():
    async with async_session() as s:
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            s.add(CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0))
        await s.commit()


async def _make_user(name, role="visitor", nt=1000):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=nt, trust_score=100, role=role))
        await s.commit()
    await _ensure_pool()


async def _make_user_fresh(name, role="visitor"):
    """创建全新用户（无 first_checkin_date），供首次入住测试。"""
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=500, trust_score=100, role=role,
                       first_checkin_date=None))
        else:
            exists.first_checkin_date = None
        await s.commit()
    await _ensure_pool()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


async def _seed_templates():
    """幂等播种 4 个模板（与 database.py 种子一致）。"""
    async with async_session() as s:
        existing = (await s.execute(select(NewUserTaskTemplate).limit(1))).scalar_one_or_none()
        if existing:
            return
        now = datetime.utcnow().isoformat()
        seed = [
            ("tpl_meet_neighbor", "认识一下你的邻居", "和一位邻居打招呼", 10, "visitor", 1, 7),
            ("tpl_covenant_sign", "浏览公约 + 签到", "阅读公约并签到", 5, "visitor", 2, 7),
            ("tpl_first_cleanup", "参与第一次大扫除", "参加大扫除", 15, "visitor", 3, 7),
            ("tpl_first_task", "领取你的第一个任务", "领取并完成任务", 20, "npc", 4, 7),
        ]
        for tid, title, desc, nt_val, role, order, exp in seed:
            s.add(NewUserTaskTemplate(
                id=tid, title=title, description=desc,
                reward_nt=nt_val, target_role=role,
                display_order=order, expires_days=exp, created_at=now,
            ))
        await s.commit()


# ══ 1. 首次入住触发派发 ══
class TestFirstCheckinTrigger:
    @pytest.mark.asyncio
    async def test_checkin_assigns_newbie_tasks(self, client):
        await _seed_templates()
        await _make_user_fresh("nt_fresh_user1", role="visitor")
        tok = await _login(client, "nt_fresh_user1")

        # checkin 触发
        r = await client.post("/api/accommodation/checkin", headers=_h(tok),
                              json={"room_id": "dorm101", "bed_num": 1})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "assigned_newbie_tasks" in body
        # visitor 角色有 3 个模板
        assert len(body["assigned_newbie_tasks"]) == 3
        titles = [t["title"] for t in body["assigned_newbie_tasks"]]
        assert "认识一下你的邻居" in titles

        # 验证任务写入 DB
        async with async_session() as s:
            tasks = (await s.execute(
                select(NTTask).where(
                    NTTask.is_newbie_task == True,
                    NTTask.assignee == "nt_fresh_user1",
                )
            )).scalars().all()
            assert len(tasks) == 3
            assert all(t.assigned_by_system for t in tasks)


# ══ 2. 模板按 display_order 排 ══
class TestTemplateOrdering:
    @pytest.mark.asyncio
    async def test_templates_ordered_by_display_order(self, client):
        await _seed_templates()
        await _make_user("nt_order_user", role="visitor")
        tok = await _login(client, "nt_order_user")

        r = await client.get("/api/new_user_tasks/templates", headers=_h(tok))
        assert r.status_code == 200
        tpls = r.json()["templates"]
        assert len(tpls) >= 3
        orders = [t["display_order"] for t in tpls]
        assert orders == sorted(orders), f"模板未按 display_order 排序: {orders}"

    @pytest.mark.asyncio
    async def test_admin_sees_all_templates(self, client):
        await _seed_templates()
        await _make_user("nt_admin_tpl", role="admin")
        tok = await _login(client, "nt_admin_tpl")

        r = await client.get("/api/new_user_tasks/templates", headers=_h(tok))
        tpls = r.json()["templates"]
        # admin 看到全部 4 个（visitor 3 + npc 1）
        assert len(tpls) == 4


# ══ 3. 过期不显 ══
class TestExpiredTasks:
    @pytest.mark.asyncio
    async def test_expired_task_shows_expired_flag(self, client):
        await _seed_templates()
        await _make_user_fresh("nt_expired_user", role="visitor")
        tok = await _login(client, "nt_expired_user")

        # checkin 派发
        r = await client.post("/api/accommodation/checkin", headers=_h(tok),
                              json={"room_id": "dorm102", "bed_num": 1})
        assert r.status_code == 200

        # 手动把任务 deadline 改到过去
        async with async_session() as s:
            tasks = (await s.execute(
                select(NTTask).where(
                    NTTask.is_newbie_task == True,
                    NTTask.assignee == "nt_expired_user",
                )
            )).scalars().all()
            for t in tasks:
                t.deadline = (datetime.utcnow() - timedelta(days=1)).isoformat()
            await s.commit()

        # GET /me 应该标记 expired
        r2 = await client.get("/api/new_user_tasks/me", headers=_h(tok))
        assert r2.status_code == 200
        expired_tasks = [t for t in r2.json()["tasks"] if t["expired"]]
        assert len(expired_tasks) >= 1


# ══ 4. 新人任务走校核闭环 ══
class TestNewbieVerificationFlow:
    @pytest.mark.asyncio
    async def test_full_verification_flow(self, client):
        """checkin → complete(submit) → approve → task 待结算。"""
        await _seed_templates()
        await _make_user_fresh("nt_verify_doer", role="visitor")
        await _make_user("nt_verify_peer", role="npc")
        doer_tok = await _login(client, "nt_verify_doer")
        peer_tok = await _login(client, "nt_verify_peer")

        # 1. checkin 派发
        r = await client.post("/api/accommodation/checkin", headers=_h(doer_tok),
                              json={"room_id": "dorm103", "bed_num": 1})
        task_id = r.json()["assigned_newbie_tasks"][0]["id"]

        # 2. complete → 建 Verification
        r2 = await client.patch(f"/api/new_user_tasks/{task_id}/complete",
                                headers=_h(doer_tok))
        assert r2.status_code == 200, r2.text
        vfy_id = r2.json()["verification_id"]
        assert r2.json()["status"] == TASK_STATUSES["submitted"]

        # 3. approve → peer 校核
        r3 = await client.post(f"/api/nt/verifications/{vfy_id}/approve",
                               headers=_h(peer_tok),
                               json={"doer": "nt_verify_doer", "action": "新人任务", "nt_amount": 10})
        assert r3.status_code == 200, r3.text

        # 4. 验证 task 状态 = 待结算
        async with async_session() as s:
            task = (await s.execute(
                select(NTTask).where(NTTask.id == task_id)
            )).scalar_one_or_none()
            assert task.status == TASK_STATUSES["verified"], f"任务状态应为待结算，实际: {task.status}"


# ══ 5. CV/XP 公式生效 ══
class TestCVXPFormula:
    @pytest.mark.asyncio
    async def test_cv_xp_after_approve(self, client):
        """校核通过后 CV = floor(nt/2), XP 按公式写入。"""
        await _seed_templates()
        await _make_user_fresh("nt_cv_doer", role="visitor")
        await _make_user("nt_cv_peer", role="npc")
        doer_tok = await _login(client, "nt_cv_doer")
        peer_tok = await _login(client, "nt_cv_peer")

        # checkin + complete
        r = await client.post("/api/accommodation/checkin", headers=_h(doer_tok),
                              json={"room_id": "dorm104", "bed_num": 1})
        # 找 reward=10 的模板任务
        newbie_tasks = r.json()["assigned_newbie_tasks"]
        task_10nt = [t for t in newbie_tasks if t["reward_nt"] == 10][0]
        task_id = task_10nt["id"]

        r2 = await client.patch(f"/api/new_user_tasks/{task_id}/complete",
                                headers=_h(doer_tok))
        vfy_id = r2.json()["verification_id"]

        # approve
        await client.post(f"/api/nt/verifications/{vfy_id}/approve",
                          headers=_h(peer_tok),
                          json={"doer": "nt_cv_doer", "action": "新人任务", "nt_amount": 10})

        # 验证 CV/XP
        async with async_session() as s:
            doer = (await s.execute(
                select(User).where(User.id == "nt_cv_doer")
            )).scalar_one_or_none()
            expected_cv = compute_cv(10)  # floor(10/2) = 5
            assert doer.contribution_value >= expected_cv, \
                f"CV 应 >= {expected_cv}，实际: {doer.contribution_value}"


# ══ 6. 重复派发拦截 ══
class TestDuplicateAssignmentBlock:
    @pytest.mark.asyncio
    async def test_second_checkin_no_duplicate(self, client):
        """第二次入住不再派发（first_checkin_date 已设）。"""
        await _seed_templates()
        await _make_user_fresh("nt_dup_user", role="visitor")
        tok = await _login(client, "nt_dup_user")

        # 第一次 checkin
        r1 = await client.post("/api/accommodation/checkin", headers=_h(tok),
                               json={"room_id": "dorm105", "bed_num": 1})
        first_count = len(r1.json().get("assigned_newbie_tasks", []))
        assert first_count >= 1

        # 退房
        await client.post("/api/accommodation/checkout", headers=_h(tok))

        # 第二次 checkin
        r2 = await client.post("/api/accommodation/checkin", headers=_h(tok),
                               json={"room_id": "dorm105", "bed_num": 1})
        second_tasks = r2.json().get("assigned_newbie_tasks", [])
        assert len(second_tasks) == 0, f"第二次入住不应再派发，实际派发: {len(second_tasks)}"


# ══ 7. admin 手动派发 ══
class TestAdminManualAssign:
    @pytest.mark.asyncio
    async def test_admin_assign_all_templates(self, client):
        await _seed_templates()
        await _make_user("nt_assign_admin", role="admin")
        await _make_user("nt_assign_target", role="visitor")
        admin_tok = await _login(client, "nt_assign_admin")

        r = await client.post("/api/new_user_tasks/assign", headers=_h(admin_tok),
                              json={"user_id": "nt_assign_target"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["tasks_created"] == 3  # visitor 3 个模板

    @pytest.mark.asyncio
    async def test_admin_assign_specific_templates(self, client):
        await _seed_templates()
        await _make_user("nt_assign_admin2", role="admin")
        await _make_user("nt_assign_target2", role="visitor")
        admin_tok = await _login(client, "nt_assign_admin2")

        r = await client.post("/api/new_user_tasks/assign", headers=_h(admin_tok),
                              json={"user_id": "nt_assign_target2",
                                    "template_ids": ["tpl_meet_neighbor"]})
        assert r.status_code == 200
        assert r.json()["tasks_created"] == 1

    @pytest.mark.asyncio
    async def test_non_admin_assign_403(self, client):
        await _make_user("nt_no_admin", role="visitor")
        tok = await _login(client, "nt_no_admin")
        r = await client.post("/api/new_user_tasks/assign", headers=_h(tok),
                              json={"user_id": "nt_no_admin"})
        assert r.status_code == 403


# ══ 8. GET /api/new_user_tasks/me 拉自己 ══
class TestGetMyNewbieTasks:
    @pytest.mark.asyncio
    async def test_me_returns_own_tasks(self, client):
        await _seed_templates()
        await _make_user_fresh("nt_me_user", role="visitor")
        tok = await _login(client, "nt_me_user")

        # checkin 派发
        await client.post("/api/accommodation/checkin", headers=_h(tok),
                          json={"room_id": "dorm106", "bed_num": 1})

        # GET /me
        r = await client.get("/api/new_user_tasks/me", headers=_h(tok))
        assert r.status_code == 200
        tasks = r.json()["tasks"]
        assert len(tasks) == 3
        assert all(t["is_newbie_task"] for t in tasks)

    @pytest.mark.asyncio
    async def test_me_no_tasks_for_non_newbie(self, client):
        await _make_user("nt_old_user", role="npc")
        tok = await _login(client, "nt_old_user")
        r = await client.get("/api/new_user_tasks/me", headers=_h(tok))
        assert r.status_code == 200
        assert len(r.json()["tasks"]) == 0
