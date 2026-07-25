"""D-5 回归：提现余额不足 + 并发（SQLite 下顺序模拟行锁）；D-10 回归：营地结算权限。"""
import pytest
from httpx import AsyncClient

from server.auth_utils import hash_password
from server.database import async_session
from server.models import User, CommunityPool, Camp


async def _make_user(uid, name, balance=1000, trust=100, role="villager", wallet="0x0000000000000000000000000000000000000001"):
    async with async_session() as s:
        u = User(id=uid, name=name, password_hash=hash_password("Passw0rd!"),
                 nt_balance=balance, trust_score=trust, role=role, wallet_address=wallet)
        s.add(u)
        # 确保障备池有钱
        from sqlalchemy import select
        r = await s.execute(select(CommunityPool).limit(1))
        pool = r.scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=0, total_issued=0, reserve=10000, frozen=0)
            s.add(pool)
        else:
            pool.reserve = max(pool.reserve or 0, 10000)
        await s.commit()


async def _login(client, name, pw="Passw0rd!"):
    r = await client.post("/api/auth/login", json={"name": name, "password": pw})
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ===== D-5 回归：提现 =====
class TestWithdraw:
    @pytest.mark.asyncio
    async def test_insufficient_balance_rejected(self, client: AsyncClient):
        await _make_user("u-poor", "穷光蛋", balance=5)
        tok = await _login(client, "穷光蛋")
        r = await client.post("/api/nt/withdraw", headers=_h(tok),
                              json={"amount": 100, "to_address": "0x0000000000000000000000000000000000000001"})
        assert r.status_code == 400 or (r.status_code == 200 and r.json().get("ok") is False)

    @pytest.mark.asyncio
    async def test_sequential_double_withdraw_does_not_double_spend(self, client: AsyncClient):
        """SQLite 下模拟并发：顺序提交两笔同额提现，第二笔应被拒（锁生效后余额不足）。"""
        await _make_user("u-rich", "有钱人", balance=200, trust=100)
        tok = await _login(client, "有钱人")
        addr = "0x0000000000000000000000000000000000000001"
        # 第一笔提 150
        r1 = await client.post("/api/nt/withdraw", headers=_h(tok),
                               json={"amount": 150, "to_address": addr})
        assert r1.status_code == 200 and r1.json()["ok"] is True, r1.json()
        # 第二笔再提 150 → 余额剩 50，应被拒
        r2 = await client.post("/api/nt/withdraw", headers=_h(tok),
                               json={"amount": 150, "to_address": addr})
        assert r2.status_code == 400 or r2.json().get("ok") is False, r2.json()
        # 库内余额应该是 50，不是 -100
        async with async_session() as s:
            from sqlalchemy import select
            u = (await s.execute(select(User).where(User.id == "u-rich"))).scalar_one()
            assert u.nt_balance == 50


# ===== D-10 回归：营地结算权限 =====
class TestCampSettlePermission:
    @pytest.mark.asyncio
    async def test_non_creator_non_admin_gets_403(self, client: AsyncClient):
        # 造 creator + stranger
        await _make_user("u-creator", "创建者", role="villager")
        await _make_user("u-stranger", "路人甲", role="villager")
        # 直接写库造营地
        from datetime import datetime
        async with async_session() as s:
            s.add(Camp(id="camp-1", name="测试营地", created_by="u-creator",
                       created_at=datetime.utcnow().isoformat()))
            await s.commit()
        # 路人甲尝试结算 → 应该 403
        tok = await _login(client, "路人甲")
        r = await client.post("/api/camps/camp-1/settle", headers=_h(tok))
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_creator_can_settle(self, client: AsyncClient):
        await _make_user("u-creator2", "创建者2", role="villager")
        from datetime import datetime
        async with async_session() as s:
            s.add(Camp(id="camp-2", name="创建者营地", created_by="u-creator2",
                       created_at=datetime.utcnow().isoformat()))
            await s.commit()
        tok = await _login(client, "创建者2")
        r = await client.post("/api/camps/camp-2/settle", headers=_h(tok))
        assert r.status_code == 200
        assert r.json()["ok"] is True

    @pytest.mark.asyncio
    async def test_admin_can_settle_any_camp(self, client: AsyncClient):
        await _make_user("u-boss", "管理员", role="admin")
        await _make_user("u-other", "别人", role="villager")
        from datetime import datetime
        async with async_session() as s:
            s.add(Camp(id="camp-3", name="别人营地", created_by="u-other",
                       created_at=datetime.utcnow().isoformat()))
            await s.commit()
        tok = await _login(client, "管理员")
        r = await client.post("/api/camps/camp-3/settle", headers=_h(tok))
        assert r.status_code == 200
        assert r.json()["ok"] is True
