"""D-5 回归：提现余额不足 + 并发（SQLite 下顺序模拟行锁）；D-10 回归：营地结算权限。"""
import pytest
from httpx import AsyncClient

from auth_utils import hash_password
from database import async_session
from models import User, CommunityPool, Camp
from sqlalchemy import select


# 注意：User.id = 用户名字符串（主键）；Camp.created_by = User.id = 用户名
async def _make_user(name, balance=1000, trust=100, role="villager",
                     wallet="0x0000000000000000000000000000000000000001"):
    async with async_session() as s:
        u = User(id=name, password_hash=hash_password("Passw0rd!"),
                 nt_balance=balance, trust_score=trust, role=role, wallet_address=wallet)
        s.add(u)
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0)
            s.add(pool)
        else:
            pool.balance = max(pool.balance or 0, 10000)
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
    async def test_insufficient_balance_rejected(self, client):
        await _make_user("穷光蛋_w", balance=5)
        tok = await _login(client, "穷光蛋_w")
        r = await client.post("/api/nt/withdraw", headers=_h(tok),
                              json={"amount": 100, "to_address": "0x0000000000000000000000000000000000000001"})
        # 要么 400，要么 200 但 ok:false
        assert r.status_code == 400 or r.json().get("ok") is False

    @pytest.mark.asyncio
    async def test_sequential_double_withdraw_no_double_spend(self, client):
        """SQLite 顺序模拟：第二笔提现在第一笔之后应因余额不足被拒。"""
        await _make_user("有钱人_w", balance=200, trust=100)
        tok = await _login(client, "有钱人_w")
        addr = "0x0000000000000000000000000000000000000001"
        r1 = await client.post("/api/nt/withdraw", headers=_h(tok), json={"amount": 150, "to_address": addr})
        assert r1.status_code == 200 and r1.json()["ok"] is True, r1.json()
        r2 = await client.post("/api/nt/withdraw", headers=_h(tok), json={"amount": 150, "to_address": addr})
        assert r2.status_code == 400 or r2.json().get("ok") is False, r2.json()
        async with async_session() as s:
            u = (await s.execute(select(User).where(User.id == "有钱人_w"))).scalar_one()
            assert u.nt_balance == 50


# ===== D-10 回归：营地结算权限 =====
class TestCampSettlePermission:
    @pytest.mark.asyncio
    async def test_non_creator_non_admin_gets_403(self, client):
        await _make_user("创建者_c", role="villager")
        await _make_user("路人甲_c", role="villager")
        from datetime import datetime
        async with async_session() as s:
            s.add(Camp(id="camp-c1", name="测试营地", created_by="创建者_c",
                       created_at=datetime.utcnow().isoformat()))
            await s.commit()
        tok = await _login(client, "路人甲_c")
        r = await client.post("/api/camps/camp-c1/settle", headers=_h(tok))
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_creator_can_settle(self, client):
        await _make_user("创建者2_c", role="villager")
        from datetime import datetime
        async with async_session() as s:
            s.add(Camp(id="camp-c2", name="创建者营地", created_by="创建者2_c",
                       created_at=datetime.utcnow().isoformat()))
            await s.commit()
        tok = await _login(client, "创建者2_c")
        r = await client.post("/api/camps/camp-c2/settle", headers=_h(tok))
        assert r.status_code == 200 and r.json()["ok"] is True

    @pytest.mark.asyncio
    async def test_admin_can_settle_any_camp(self, client):
        await _make_user("管理员_c", role="admin")
        await _make_user("别人_c", role="villager")
        from datetime import datetime
        async with async_session() as s:
            s.add(Camp(id="camp-c3", name="别人营地", created_by="别人_c",
                       created_at=datetime.utcnow().isoformat()))
            await s.commit()
        tok = await _login(client, "管理员_c")
        r = await client.post("/api/camps/camp-c3/settle", headers=_h(tok))
        assert r.status_code == 200 and r.json()["ok"] is True
