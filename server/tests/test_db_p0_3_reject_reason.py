# -*- coding: utf-8 -*-
"""DB-P0-3: reject_verification reject_reason 写入测试（4 项）。

判据：
  1. 正常 reject + reject_reason → 写入 DB
  2. 空 reject_reason → 写入空字符串
  3. 长 reject_reason → 截断到 500 字
  4. verify_task 的 reject_reason 不受影响（原有路径不变）
"""
import json
from datetime import datetime

import pytest
from sqlalchemy import select

from auth_utils import hash_password
from database import async_session
from models import User, CommunityPool, Verification


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


async def _make_pending_vfy(vfy_id, doer_name, nt_amount=10):
    """建一条 pending 校核记录。"""
    async with async_session() as s:
        existing = (await s.execute(
            select(Verification).where(Verification.id == vfy_id)
        )).scalar_one_or_none()
        if existing:
            return
        s.add(Verification(
            id=vfy_id, type="test", doer=doer_name,
            action="test_action", nt_amount=nt_amount,
            verifier_reward=1, status="pending",
            created_at=datetime.utcnow().isoformat(),
        ))
        await s.commit()


# ══ 1. 正常 reject + reject_reason → 写入 ══
class TestRejectReasonWritten:
    @pytest.mark.asyncio
    async def test_reject_with_reason(self, client):
        await _make_user("rr_doer1")
        await _make_user("rr_peer1")
        peer_tok = await _login(client, "rr_peer1")

        vfy_id = "vfy_rr_test1"
        await _make_pending_vfy(vfy_id, "rr_doer1")

        r = await client.post(
            f"/api/nt/verifications/{vfy_id}/reject",
            headers=_h(peer_tok),
            json={"reject_reason": "证据不足，请补充照片"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["reject_reason"] == "证据不足，请补充照片"

        # 验证 DB
        async with async_session() as s:
            vfy = (await s.execute(
                select(Verification).where(Verification.id == vfy_id)
            )).scalar_one_or_none()
            assert vfy.reject_reason == "证据不足，请补充照片"
            assert vfy.rejected_by == "rr_peer1"
            assert vfy.status == "rejected"


# ══ 2. 空 reject_reason → 写入空字符串 ══
class TestEmptyRejectReason:
    @pytest.mark.asyncio
    async def test_reject_empty_reason(self, client):
        await _make_user("rr_doer2")
        await _make_user("rr_peer2")
        peer_tok = await _login(client, "rr_peer2")

        vfy_id = "vfy_rr_test2"
        await _make_pending_vfy(vfy_id, "rr_doer2")

        # 不传 reject_reason → 默认 ""
        r = await client.post(
            f"/api/nt/verifications/{vfy_id}/reject",
            headers=_h(peer_tok),
            json={},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["reject_reason"] == ""

        async with async_session() as s:
            vfy = (await s.execute(
                select(Verification).where(Verification.id == vfy_id)
            )).scalar_one_or_none()
            assert vfy.reject_reason == ""


# ══ 3. 长 reject_reason → 截断到 500 字 ══
class TestLongRejectReason:
    @pytest.mark.asyncio
    async def test_reject_reason_truncated(self, client):
        await _make_user("rr_doer3")
        await _make_user("rr_peer3")
        peer_tok = await _login(client, "rr_peer3")

        vfy_id = "vfy_rr_test3"
        await _make_pending_vfy(vfy_id, "rr_doer3")

        long_reason = "A" * 600  # 超 500
        r = await client.post(
            f"/api/nt/verifications/{vfy_id}/reject",
            headers=_h(peer_tok),
            json={"reject_reason": long_reason},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["reject_reason"]) == 500

        async with async_session() as s:
            vfy = (await s.execute(
                select(Verification).where(Verification.id == vfy_id)
            )).scalar_one_or_none()
            assert len(vfy.reject_reason) == 500
            assert vfy.reject_reason == "A" * 500


# ══ 4. verify_task 的 reject_reason 不受影响 ══
class TestVerifyTaskRejectUnchanged:
    @pytest.mark.asyncio
    async def test_verify_task_reject_still_works(self, client):
        """POST /api/nt/tasks/{task_id}/verify 的 reject_reason 参数不受影响。"""
        from models import NTTask
        # 建任务 + 认领 + 提交
        await _make_user("rr_poster", role="admin")
        await _make_user("rr_assignee")
        poster_tok = await _login(client, "rr_poster")
        assignee_tok = await _login(client, "rr_assignee")

        # 建任务
        r = await client.post("/api/tasks", headers=_h(poster_tok), json={
            "title": "DB-P0-3 测试任务", "reward": 10, "category": "other",
        })
        assert r.status_code == 200, r.text
        task_id = r.json().get("id") or r.json().get("task_id")

        # 认领
        r2 = await client.post(f"/api/nt/tasks/{task_id}/accept", headers=_h(assignee_tok))
        assert r2.status_code == 200, r2.text

        # 提交
        r3 = await client.post(f"/api/nt/tasks/{task_id}/submit", headers=_h(assignee_tok),
                               json={"evidence": "done"})
        assert r3.status_code == 200, r3.text

        # verify_task reject（原有路径）
        r4 = await client.post(
            f"/api/nt/tasks/{task_id}/verify",
            headers=_h(poster_tok),
            json={"approved": False, "reject_reason": "需要补充证据"},
        )
        assert r4.status_code == 200, r4.text

        # 验证 NTTask.reject_reason 写入（原有路径不变）
        async with async_session() as s:
            task = (await s.execute(
                select(NTTask).where(NTTask.id == task_id)
            )).scalar_one_or_none()
            assert task.reject_reason == "需要补充证据"
            assert task.status == "退回修改"
