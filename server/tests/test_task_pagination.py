# -*- coding: utf-8 -*-
"""B-3 回归：任务大厅分页——治"50 条上限旧任务看不到"。

判据（对齐派工单 批次3 B-3）：
  1. 造 60+ 条"进行中"任务后，X-Total-Count 头如实反映过滤后总数（60），不再被默认 50 截断
  2. limit=200 一次全返回 60 条；默认 limit=50 只返回 50 条但头仍为 60（前端据此续拉）
  3. offset 翻页拼接（0..50..）能取回全部 60 条、无重无漏 —— 复刻前端 fetchTasks 循环分页逻辑
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


async def _seed_hall_tasks(n, tag):
    """直接写库造 n 条'进行中'非系统任务（poster=社区，避免 60s 幂等窗口）。"""
    ids = []
    async with async_session() as s:
        for i in range(n):
            tid = f"B3_{tag}_{i:03d}_{uuid.uuid4().hex[:4]}"
            s.add(NTTask(id=tid, poster="社区", title=f"B3大厅任务_{tag}_{i}",
                         status="进行中", reward=5, scope="社区",
                         is_system_generated=False))
            ids.append(tid)
        await s.commit()
    return ids


@pytest.mark.asyncio
async def test_hall_total_count_header_not_capped(client: AsyncClient):
    """判据1+2：60 条时 X-Total-Count=60，默认页只返 50，头不被截断。"""
    tok = await _register_and_login(client, "b3_cap_user")
    ids = await _seed_hall_tasks(60, "cap")

    # 默认 limit=50：返回体 50 条，但头暴露总数 60
    r = await client.get("/api/tasks?mode=hall", headers=_h(tok))
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    total = int(r.headers.get("X-Total-Count", "-1"))
    assert total >= 60, f"X-Total-Count 应 >=60，got={total}"
    assert len(body) == 50, f"默认页应 50 条，got={len(body)}"

    # limit=200：一次全返回（>=60）
    r2 = await client.get("/api/tasks?mode=hall&limit=200", headers=_h(tok))
    assert r2.status_code == 200
    seen = {t["id"] for t in r2.json()}
    for tid in ids:
        assert tid in seen, f"limit=200 应能看到全部造的任务，缺 {tid}"


@pytest.mark.asyncio
async def test_hall_offset_pagination_covers_all(client: AsyncClient):
    """判据3：复刻前端 fetchTasks 循环分页——offset 翻页拼接取回全部 65 条无重无漏。"""
    tok = await _register_and_login(client, "b3_page_user")
    ids = set(await _seed_hall_tasks(65, "page"))

    PAGE = 50
    acc, offset, guard = [], 0, 0
    while guard < 100:
        guard += 1
        r = await client.get(f"/api/tasks?mode=hall&limit={PAGE}&offset={offset}", headers=_h(tok))
        assert r.status_code == 200
        page = r.json()
        acc.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE

    got = [t["id"] for t in acc]
    # 无重复
    assert len(got) == len(set(got)), "翻页拼接不应有重复"
    # 造的 65 条全部覆盖
    seen = set(got)
    for tid in ids:
        assert tid in seen, f"翻页拼接应覆盖全部造的任务，缺 {tid}"
