"""C-B-1: 营地级 membership 地基验收。

覆盖三判据：
  A. visible_camp_filter helper 单测：admin 全集 / 非 admin 过渡放行 / 唯一入口机制就位
  B. CampMembership uq_camp_member 唯一约束生效
  C. dev-reset hard 播 membership 行 → 200 且表空（U-2 教训：漏入=硬重置 500）

本期只立机制不缩权（CAMP_SCOPE_ENFORCED=False，过渡放行），故非 admin 也返回全集，
与现状一致；缩权待 C-B-2 回填数据后另卡开启。
"""
import uuid
import pytest
from datetime import datetime

from sqlalchemy import select, func
from auth_utils import hash_password, create_access_token
from database import async_session
from models import User, Camp, CampMembership
from routes.camps import visible_camp_filter, CAMP_SCOPE_ENFORCED, _membership_subquery


def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def _mk_user(name, role):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password("Passw0rd!"),
                   role=role, contribution_value=0, experience_value=0,
                   nt_balance=0, trust_score=100))
        await s.commit()
    return create_access_token(name, role, 0)


async def _count(model):
    async with async_session() as s:
        return (await s.execute(select(func.count()).select_from(model))).scalar_one()


class _FakeUser:
    def __init__(self, uid, role):
        self.id = uid
        self.role = role


class TestVisibleCampFilterHelper:
    def test_admin_returns_full_query_unchanged(self):
        """admin：一律绕过，返回原 query 全集（对象同一，无 where 追加）。"""
        base = select(Camp)
        admin = _FakeUser("admin_x", "admin")
        assert visible_camp_filter(admin, base) is base

    def test_non_admin_transition_passthrough(self):
        """非 admin：过渡期 CAMP_SCOPE_ENFORCED=False → 全集放行（返回原 query）。"""
        assert CAMP_SCOPE_ENFORCED is False, "本期应为过渡放行"
        base = select(Camp)
        adv = _FakeUser("adv_x", "adventurer")
        assert visible_camp_filter(adv, base) is base

    def test_single_entry_mechanism_ready(self):
        """唯一入口机制就位：membership 子查询可构造（缩权激活时使用）。"""
        adv = _FakeUser("adv_y", "adventurer")
        subq = _membership_subquery(adv)
        # 子查询能编译成 SQL 即证机制在位（不依赖开关）
        assert "camp_memberships" in str(subq).lower()

    @pytest.mark.asyncio
    async def test_list_camps_admin_and_nonadmin_both_see_all(self, client):
        """端到端：过渡期 admin 与非 admin 都能列出营地（放行一致）。"""
        cid = f"cb1_camp_{uuid.uuid4().hex[:6]}"
        async with async_session() as s:
            s.add(Camp(id=cid, name="C-B-1 可见性营", created_at=datetime.utcnow().isoformat()))
            await s.commit()
        admin_tok = await _mk_user(f"cb1_admin_{uuid.uuid4().hex[:6]}", "admin")
        adv_tok = await _mk_user(f"cb1_adv_{uuid.uuid4().hex[:6]}", "adventurer")

        r_admin = await client.get("/api/camps", headers=_h(admin_tok))
        r_adv = await client.get("/api/camps", headers=_h(adv_tok))
        assert r_admin.status_code == 200, r_admin.text
        assert r_adv.status_code == 200, r_adv.text
        admin_ids = {c["id"] for c in r_admin.json()}
        adv_ids = {c["id"] for c in r_adv.json()}
        assert cid in admin_ids
        assert cid in adv_ids, "过渡放行：非 admin 也应见到（与现状一致）"


class TestCampMembershipConstraint:
    @pytest.mark.asyncio
    async def test_uq_camp_member_unique(self):
        """uq_camp_member：同一 (user_id, camp_id) 不可重复。"""
        uid = f"cb1_u_{uuid.uuid4().hex[:6]}"
        cid = f"cb1_c_{uuid.uuid4().hex[:6]}"
        now = datetime.utcnow().isoformat()
        async with async_session() as s:
            s.add(User(id=uid, password_hash=hash_password("Passw0rd!"), role="adventurer",
                       contribution_value=0, experience_value=0, nt_balance=0, trust_score=100))
            s.add(Camp(id=cid, name="uq 测试营"))
            await s.commit()
            s.add(CampMembership(user_id=uid, camp_id=cid, joined_at=now))
            await s.commit()
        with pytest.raises(Exception):
            async with async_session() as s2:
                s2.add(CampMembership(user_id=uid, camp_id=cid, joined_at=now))
                await s2.commit()


class TestDevResetCampMembership:
    @pytest.mark.asyncio
    async def test_hard_clears_camp_membership(self, client, monkeypatch):
        """dev-reset hard 播 membership 行 → 200 且表空（U-2 教训：漏入=500）。"""
        monkeypatch.setenv("DEV_TOOLS_ENABLED", "1")
        admin_tok = await _mk_user(f"cb1_dr_admin_{uuid.uuid4().hex[:6]}", "admin")
        now = datetime.utcnow().isoformat()
        async with async_session() as s:
            uid = f"cb1_dr_u_{uuid.uuid4().hex[:6]}"
            cid = f"cb1_dr_c_{uuid.uuid4().hex[:6]}"
            s.add(User(id=uid, password_hash=hash_password("Passw0rd!"), role="adventurer",
                       contribution_value=0, experience_value=0, nt_balance=0, trust_score=100))
            s.add(Camp(id=cid, name="dev-reset membership 营"))
            await s.commit()
            s.add(CampMembership(user_id=uid, camp_id=cid, joined_at=now))
            await s.commit()
        assert await _count(CampMembership) >= 1

        r = await client.post("/api/admin/dev-reset?mode=hard", headers=_h(admin_tok))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True, r.text
        assert await _count(CampMembership) == 0
