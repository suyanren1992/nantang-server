"""U-2 回归：dev-reset 硬重置 500——后加 4 表未入删表清单致 FK 冲突。

覆盖两条判据：
  判据①：CampBuilder/DepositIntent/Tenancy/CovenantSignature 各播一行
          → POST /api/admin/dev-reset?mode=hard → {"ok":true} 且四表+users 全空
  判据②：仅播 CampBuilder → mode=soft → 200 且 users 保留（soft 不删 users）

病灶：admin.py dev_reset 删 camps/users 时上述表 FK 引用尚存 → 500。
修法：hard 补删四表（CampBuilder 先于 delete(Camp)，余三表先于 delete(User)）；
      soft 只补 CampBuilder（soft 不删 users，其余三表不动）。
"""
import os
import uuid
import pytest
from datetime import datetime

from sqlalchemy import select, func
from auth_utils import hash_password, create_access_token
from database import async_session
from models import (User, Camp, CampBuilder, DepositIntent, Tenancy,
                    CovenantSignature)


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mk_admin(name):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                   role="admin", contribution_value=0, experience_value=0,
                   nt_balance=0, trust_score=100))
        await s.commit()
    return create_access_token(name, "admin", 0)


async def _count(model):
    async with async_session() as s:
        return (await s.execute(select(func.count()).select_from(model))).scalar_one()


class TestDevResetHard:
    @pytest.mark.asyncio
    async def test_hard_clears_four_new_tables(self, client, monkeypatch):
        monkeypatch.setenv("DEV_TOOLS_ENABLED", "1")
        admin_tok = await _mk_admin(f"u2_hard_admin_{uuid.uuid4().hex[:6]}")
        now = datetime.utcnow().isoformat()

        # 四表各播一行（外加承载 FK 的 camp/user）
        async with async_session() as s:
            uid = f"u2_hard_user_{uuid.uuid4().hex[:6]}"
            cid = f"u2_hard_camp_{uuid.uuid4().hex[:6]}"
            s.add(User(id=uid, password_hash=hash_password("Passw0rd!"),
                       role="villager", contribution_value=0, experience_value=0,
                       nt_balance=0, trust_score=100))
            s.add(Camp(id=cid, name="U-2 测试营"))
            await s.commit()
            s.add(CampBuilder(camp_id=cid, name="建设者甲"))
            s.add(DepositIntent(id=f"di_{uuid.uuid4().hex[:6]}", user_id=uid, amount=100,
                                from_address="0xfrom", to_address="0xto", created_at=now))
            s.add(Tenancy(user_id=uid, room_id="room_1", checkin_date=now))
            s.add(CovenantSignature(user_id=uid, covenant_version="v1", signed_at=now))
            await s.commit()

        # 前置断言：四表非空
        assert await _count(CampBuilder) >= 1
        assert await _count(DepositIntent) >= 1
        assert await _count(Tenancy) >= 1
        assert await _count(CovenantSignature) >= 1

        r = await client.post("/api/admin/dev-reset?mode=hard", headers=_h(admin_tok))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True, r.text

        # 四表 + users 全空
        assert await _count(CampBuilder) == 0
        assert await _count(DepositIntent) == 0
        assert await _count(Tenancy) == 0
        assert await _count(CovenantSignature) == 0
        assert await _count(User) == 0
        assert await _count(Camp) == 0


class TestDevResetSoft:
    @pytest.mark.asyncio
    async def test_soft_clears_campbuilder_keeps_users(self, client, monkeypatch):
        monkeypatch.setenv("DEV_TOOLS_ENABLED", "1")
        admin_tok = await _mk_admin(f"u2_soft_admin_{uuid.uuid4().hex[:6]}")

        async with async_session() as s:
            cid = f"u2_soft_camp_{uuid.uuid4().hex[:6]}"
            s.add(Camp(id=cid, name="U-2 soft 营"))
            await s.commit()
            s.add(CampBuilder(camp_id=cid, name="建设者乙"))
            await s.commit()

        assert await _count(CampBuilder) >= 1
        users_before = await _count(User)
        assert users_before >= 1  # 至少 admin 自己

        r = await client.post("/api/admin/dev-reset?mode=soft", headers=_h(admin_tok))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True, r.text

        # CampBuilder 清空，users 保留
        assert await _count(CampBuilder) == 0
        assert await _count(User) == users_before, "soft 模式不得删 users"