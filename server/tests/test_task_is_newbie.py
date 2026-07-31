# -*- coding: utf-8 -*-
"""NEW-USER-TASK-FIX-BE 回归：list_tasks 序列化包含 is_newbie_task + deadline 字段。

判据（对齐派工单 NEW-USER-TASK-FIX-BE）：
  1. list_tasks 返回体每项含 is_newbie_task 字段
  2. list_tasks 返回体每项含 deadline 字段
  3. 新人任务的 is_newbie_task=true
  4. 普通任务的 is_newbie_task=false
  5. deadline 字段无值时为 null
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from database import async_session
from models import User, NTTask


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _register_and_login(client, name):
    r = await client.post("/api/auth/register", json={"name": name, "password": "Passw0rd!"})
    assert r.status_code == 200 and r.json()["ok"] is True, r.text
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


async def _seed_tasks(tasks_def: list[dict]):
    """直接写库造任务（绕过 api.create_task 的幂等/冻结逻辑）。"""
    ids = []
    async with async_session() as s:
        for td in tasks_def:
            tid = td.get("id", f"nb_test_{uuid.uuid4().hex[:8]}")
            s.add(NTTask(
                id=tid,
                poster=td.get("poster", "系统"),
                title=td.get("title", "测试任务"),
                reward=td.get("reward", 5),
                status=td.get("status", "进行中"),
                category=td.get("category", "other"),
                scope=td.get("scope", "社区"),
                slots=td.get("slots", 1),
                deadline=td.get("deadline"),
                is_newbie_task=td.get("is_newbie_task", False),
                is_system_generated=td.get("is_system_generated", False),
            ))
            ids.append(tid)
        await s.commit()
    return ids


@pytest.mark.asyncio
async def test_list_tasks_includes_is_newbie_task_field(client: AsyncClient):
    """判据1：list_tasks 返回体每项含 is_newbie_task 字段（值可为 true/false）。"""
    tok = await _register_and_login(client, "nb_field_user1")
    await _seed_tasks([
        {"title": "新人任务A", "is_newbie_task": True},
        {"title": "普通任务B", "is_newbie_task": False},
    ])
    r = await client.get("/api/tasks?mode=hall&limit=200", headers=_h(tok))
    assert r.status_code == 200, r.text
    tasks = r.json()
    assert len(tasks) >= 2, f"应至少有 2 条任务，got={len(tasks)}"
    for t in tasks:
        assert "is_newbie_task" in t, f"任务 {t.get('id','?')} 缺 is_newbie_task 字段"


@pytest.mark.asyncio
async def test_list_tasks_includes_deadline_field(client: AsyncClient):
    """判据2：list_tasks 返回体每项含 deadline 字段。"""
    tok = await _register_and_login(client, "nb_field_user2")
    await _seed_tasks([
        {"title": "带截止日期", "deadline": "2026-08-15T00:00:00"},
        {"title": "无截止日期", "deadline": None},
    ])
    r = await client.get("/api/tasks?mode=hall&limit=200", headers=_h(tok))
    assert r.status_code == 200, r.text
    tasks = r.json()
    assert len(tasks) >= 2, f"应至少有 2 条任务，got={len(tasks)}"
    for t in tasks:
        assert "deadline" in t, f"任务 {t.get('id','?')} 缺 deadline 字段"


@pytest.mark.asyncio
async def test_newbie_task_is_newbie_task_true(client: AsyncClient):
    """判据3：新人任务 is_newbie_task=true。"""
    tok = await _register_and_login(client, "nb_true_user")
    ids = await _seed_tasks([
        {"title": "真正新人任务", "is_newbie_task": True},
    ])
    r = await client.get("/api/tasks?mode=hall&limit=200", headers=_h(tok))
    assert r.status_code == 200, r.text
    tasks = r.json()
    nb = [t for t in tasks if t["id"] == ids[0]]
    assert len(nb) == 1, f"应找到刚造的新人任务 {ids[0]}"
    assert nb[0]["is_newbie_task"] is True, f"新人任务 is_newbie_task 应为 true，got={nb[0]['is_newbie_task']}"


@pytest.mark.asyncio
async def test_normal_task_is_newbie_task_false(client: AsyncClient):
    """判据4：普通任务 is_newbie_task=false。"""
    tok = await _register_and_login(client, "nb_false_user")
    ids = await _seed_tasks([
        {"title": "普通任务", "is_newbie_task": False},
    ])
    r = await client.get("/api/tasks?mode=hall&limit=200", headers=_h(tok))
    assert r.status_code == 200, r.text
    tasks = r.json()
    nb = [t for t in tasks if t["id"] == ids[0]]
    assert len(nb) == 1, f"应找到刚造的普通任务 {ids[0]}"
    assert nb[0]["is_newbie_task"] is False, f"普通任务 is_newbie_task 应为 false，got={nb[0]['is_newbie_task']}"


@pytest.mark.asyncio
async def test_newbie_task_deadline_null_when_no_value(client: AsyncClient):
    """判据5：deadline 字段无值时为 null。"""
    tok = await _register_and_login(client, "nb_null_user")
    ids = await _seed_tasks([
        {"title": "无截止日期任务", "deadline": None},
    ])
    r = await client.get("/api/tasks?mode=hall&limit=200", headers=_h(tok))
    assert r.status_code == 200, r.text
    tasks = r.json()
    nb = [t for t in tasks if t["id"] == ids[0]]
    assert len(nb) == 1, f"应找到刚造的任务 {ids[0]}"
    assert nb[0]["deadline"] is None, f"deadline 应为 null，got={nb[0]['deadline']}"
