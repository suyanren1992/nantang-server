"""P1-3 回归：劳动结算路径同步更新 CV（contribution_value）。

覆盖两条结算路径：
  1) /api/nt/tasks/{id}/verify (approved) —— 任务通过，assignee CV += floor(reward/2)
  2) /api/nt/verifications/{id}/approve —— 校核通过，doer CV += floor(nt_amount/2)
A-LABOR-BE ⑫: CV 公式改为 floor(nt/2)（原 1:1）。
"""
import json
import uuid
import pytest

from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, NTTask, CommunityPool, Verification


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mkuser(name, role="villager", cv=0):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                   role=role, contribution_value=cv, experience_value=0,
                   nt_balance=0, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


async def _get_cv(name):
    async with async_session() as s:
        u = (await s.execute(
            __import__("sqlalchemy").select(User).where(User.id == name)
        )).scalar_one()
        return u.contribution_value


class TestVerifyTaskCV:
    @pytest.mark.asyncio
    async def test_task_settlement_increments_cv(self, client):
        admin_tok = await _mkuser("cv_admin", role="admin")
        await _mkuser("cv_doer", role="villager", cv=0)

        tid = f"cvT_{uuid.uuid4().hex[:8]}"
        async with async_session() as s:
            s.add(NTTask(id=tid, poster="cv_admin", title="CV 结算任务",
                         assignees=json.dumps(["cv_doer"], ensure_ascii=False),
                         status="待审核", reward=10, slots=1, escrow_amount=10, scope="社区"))
            # 确保社区池存在
            from sqlalchemy import select as _sel
            pool = (await s.execute(_sel(CommunityPool).limit(1))).scalar_one_or_none()
            if not pool:
                s.add(CommunityPool(balance=1000, total_issued=1000, task_escrow=100))
            await s.commit()

        cv_before = await _get_cv("cv_doer")
        r = await client.post(f"/api/nt/tasks/{tid}/verify",
                              headers=_h(admin_tok), json={"approved": True})
        assert r.status_code == 200, r.text
        cv_after = await _get_cv("cv_doer")
        assert cv_after == cv_before + 5, f"任务结算后 CV 应 +5（floor(10/2)）：{cv_before}->{cv_after}"


class TestVerificationApproveCV:
    @pytest.mark.asyncio
    async def test_verification_approve_increments_doer_cv(self, client):
        verifier_tok = await _mkuser("cv_verifier", role="villager")
        await _mkuser("cv_vdoer", role="villager", cv=0)

        async with async_session() as s:
            from sqlalchemy import select as _sel
            pool = (await s.execute(_sel(CommunityPool).limit(1))).scalar_one_or_none()
            if not pool:
                s.add(CommunityPool(balance=1000, total_issued=1000))
            else:
                pool.balance = max(pool.balance, 1000)
            vid = f"cvV_{uuid.uuid4().hex[:8]}"
            s.add(Verification(id=vid, type="cleaning", doer="cv_vdoer",
                               action="打扫了正厅", nt_amount=15, verifier_reward=5,
                               status="pending"))
            await s.commit()

        cv_before = await _get_cv("cv_vdoer")
        r = await client.post(f"/api/nt/verifications/{vid}/approve",
                              headers=_h(verifier_tok),
                              json={"doer": "cv_vdoer", "action": "打扫了正厅",
                                    "nt_amount": 15, "verifier_reward": 5})
        assert r.status_code == 200, r.text
        cv_after = await _get_cv("cv_vdoer")
        assert cv_after == cv_before + 7, f"校核结算后 doer CV 应 +7（floor(15/2)）：{cv_before}->{cv_after}"
