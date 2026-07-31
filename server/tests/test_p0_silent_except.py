# -*- coding: utf-8 -*-
"""M-9: 三处 except Exception: pass → logger.warning 回归测试。

判据（机器可验证）：
  1. nt.py 源码中 verify_approve 路径的三处 except 块不再含 `pass`，改为 `logger.warning`
  2. 正常 approve 流程仍返回 200（证明 logger.warning 改动未破坏 happy path）
"""
import os
import uuid

import pytest

from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, CommunityPool, Verification

_NT_PY = os.path.join(os.path.dirname(__file__), "..", "routes", "nt.py")


def _h(token):
    return {"Authorization": f"Bearer {token}"}


class TestSilentExceptReplaced:
    """M-9: 三处静默吞错已改为 logger.warning。"""

    @pytest.mark.asyncio
    async def test_no_silent_pass_in_verify_approve(self):
        """源码断言：三处 `pass  # ...不阻塞校核` 已被 logger.warning 替换。"""
        with open(_NT_PY, "r", encoding="utf-8") as f:
            src = f.read()
        # 三处原有静默注释均不应再出现
        assert "pass  # 归档失败不阻塞校核" not in src, "归档 except 仍为 pass"
        assert "pass  # 周任务状态更新失败不阻塞校核" not in src, "周任务 except 仍为 pass"
        assert "pass  # 新人任务状态更新失败不阻塞校核" not in src, "新人任务 except 仍为 pass"
        # 三处 logger.warning 已落位
        assert src.count("logger.warning") >= 3, "应至少 3 处 logger.warning"

    @pytest.mark.asyncio
    async def test_approve_flow_still_ok(self, client):
        """正常 approve 返回 200——证明 logger.warning 改动未破坏校核主流程。"""
        async with async_session() as s:
            for _name in ("m9_verifier", "m9_doer"):
                _ex = (await s.execute(
                    __import__("sqlalchemy").select(User).where(User.id == _name)
                )).scalar_one_or_none()
                if _ex is None:
                    s.add(User(id=_name, password_hash=hash_password("Passw0rd!"),
                               role="villager", trust_score=100))
            verifier_tok = create_access_token("m9_verifier", "villager", 0)
            pool = (await s.execute(
                __import__("sqlalchemy").select(CommunityPool).limit(1)
            )).scalar_one_or_none()
            if not pool:
                s.add(CommunityPool(balance=1000, total_issued=1000))
            else:
                pool.balance = max(pool.balance, 1000)
            vid = f"m9V_{uuid.uuid4().hex[:8]}"
            s.add(Verification(id=vid, type="cleaning", doer="m9_doer",
                               action="打扫了正厅", nt_amount=10, verifier_reward=5,
                               status="pending"))
            await s.commit()
        r = await client.post(f"/api/nt/verifications/{vid}/approve",
                              headers=_h(verifier_tok),
                              json={"doer": "m9_doer", "action": "打扫了正厅",
                                    "nt_amount": 10, "verifier_reward": 5})
        assert r.status_code == 200, f"approve 应 200，got {r.status_code} {r.text}"
        assert r.json()["ok"] is True
