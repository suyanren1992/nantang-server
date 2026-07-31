# -*- coding: utf-8 -*-
"""DB-P1-3 ③: sync_shared tasks + users 处理测试。

判据：
  1. sync_shared tasks → 创建服务端 NTTask（poster 匹配）
  2. sync_shared users → 更新自己 profile（bio/location）
  3. 不能更新他人 profile
  4. 幂等——重复推送同一任务不创建重复
"""
import pytest
from sqlalchemy import select

from auth_utils import hash_password
from database import async_session
from models import User, NTTask, CommunityPool


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _ensure_pool():
    async with async_session() as s:
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            s.add(CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0))
        await s.commit()


async def _make_user(name, role="npc"):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == name))).scalar_one_or_none()
        if exists is None:
            s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                       nt_balance=500, trust_score=100, role=role))
        await s.commit()
    await _ensure_pool()


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


# ══ 1. sync_shared tasks 创建服务端任务 ══
class TestSyncSharedTasks:
    @pytest.mark.asyncio
    async def test_sync_shared_creates_task(self, client):
        """推送带 tasks 字段 → 服务端创建 NTTask。"""
        await _make_user("p13_task_user")
        tok = await _login(client, "p13_task_user")

        r = await client.post("/api/data/sync_shared", headers=_h(tok), json={
            "tasks": {
                "sync_test_task": {
                    "title": "DB-P1-3 同步测试任务",
                    "reward": 15,
                    "poster": "p13_task_user",
                    "status": "draft",
                    "category": "other",
                    "scope": "personal",
                    "note": "来自 sync_shared",
                }
            }
        })
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

        # 验证 DB
        async with async_session() as s:
            task = (await s.execute(
                select(NTTask).where(
                    NTTask.poster == "p13_task_user",
                    NTTask.title == "DB-P1-3 同步测试任务",
                )
            )).scalars().first()
            assert task is not None, "Task should be created by sync_shared"
            assert task.reward == 15
            assert task.status == "draft"

    @pytest.mark.asyncio
    async def test_sync_shared_tasks_idempotent(self, client):
        """重复推送同一 title+poster 不创建重复任务。"""
        await _make_user("p13_task_idem")
        tok = await _login(client, "p13_task_idem")

        payload = {
            "tasks": {
                "idem_task": {
                    "title": "幂等测试任务",
                    "reward": 10,
                    "poster": "p13_task_idem",
                }
            }
        }

        # 第一次推送
        r1 = await client.post("/api/data/sync_shared", headers=_h(tok), json=payload)
        assert r1.status_code == 200, r1.text

        # 第二次推送相同 payload
        r2 = await client.post("/api/data/sync_shared", headers=_h(tok), json=payload)
        assert r2.status_code == 200, r2.text

        # 确认只有一条记录
        async with async_session() as s:
            tasks = (await s.execute(
                select(NTTask).where(
                    NTTask.poster == "p13_task_idem",
                    NTTask.title == "幂等测试任务",
                )
            )).scalars().all()
            assert len(tasks) == 1, f"Expected 1 task, got {len(tasks)}"

    @pytest.mark.asyncio
    async def test_sync_shared_tasks_other_poster_skipped(self, client):
        """他人 poster 的任务不创建（只处理自己的）。"""
        await _make_user("p13_owner")
        await _make_user("p13_other")
        tok = await _login(client, "p13_owner")

        r = await client.post("/api/data/sync_shared", headers=_h(tok), json={
            "tasks": {
                "other_task": {
                    "title": "别人的任务",
                    "reward": 99,
                    "poster": "p13_other",  # 不是当前用户
                }
            }
        })
        assert r.status_code == 200, r.text

        async with async_session() as s:
            task = (await s.execute(
                select(NTTask).where(NTTask.title == "别人的任务")
            )).scalars().first()
            assert task is None, "Other user's task should not be created"


# ══ 2. sync_shared users 更新 profile ══
class TestSyncSharedUsers:
    @pytest.mark.asyncio
    async def test_sync_shared_updates_own_profile(self, client):
        """推送 users.bio/location → 更新当前用户 profile。"""
        await _make_user("p13_profile")
        tok = await _login(client, "p13_profile")

        r = await client.post("/api/data/sync_shared", headers=_h(tok), json={
            "users": {
                "p13_profile": {
                    "bio": "这是测试简介",
                    "location": "南塘村",
                }
            }
        })
        assert r.status_code == 200, r.text

        async with async_session() as s:
            u = (await s.execute(
                select(User).where(User.id == "p13_profile")
            )).scalar_one_or_none()
            assert u.bio == "这是测试简介"
            assert u.location == "南塘村"

    @pytest.mark.asyncio
    async def test_sync_shared_cannot_update_others(self, client):
        """不能通过 sync_shared 更新他人 profile。"""
        await _make_user("p13_me")
        await _make_user("p13_victim", role="npc")
        tok = await _login(client, "p13_me")

        r = await client.post("/api/data/sync_shared", headers=_h(tok), json={
            "users": {
                "p13_victim": {
                    "bio": "黑客修改",
                    "location": "被篡改",
                }
            }
        })
        assert r.status_code == 200, r.text

        async with async_session() as s:
            u = (await s.execute(
                select(User).where(User.id == "p13_victim")
            )).scalar_one_or_none()
            # 不应被修改（只处理 user.id == 当前用户的条目）
            assert u.bio != "黑客修改", "Should not update other user's profile"
