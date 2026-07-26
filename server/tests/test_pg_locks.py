"""K-2: PostgreSQL 行级锁并发测试。

三路径各打 2 并发，断言只有 1 个成功 + 余额正确：
  D-5  提现并发双扣 —— with_for_update() 防双重扣款
  D-17 populate_existing —— 加锁重查读到最新值（非 session 缓存旧值）
  D-26 日结行锁 —— pool 行锁防并发重复执行

铁律：不改业务代码，只记录不修。揭示锁序错/漏锁 → 发 K-3。

运行方式：
  PG_DATABASE_URL=postgres://... pytest server/tests/test_pg_locks.py -v
"""

import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime, timedelta

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text

from models import Base, User, CommunityPool, Tenancy

# requires_pg: PG_DATABASE_URL 为空时 skip
# loop_scope="module": pg_engine 是 module 级 fixture，测试必须同循环域
#   否则 asyncpg 报 InterfaceError: another operation is in progress
pytestmark = [
    pytest.mark.requires_pg,
    pytest.mark.asyncio(loop_scope="module"),
]

# ── PG URL 构建（对齐 database.py 的 postgres→asyncpg 转换）────────────
PG_RAW = os.environ.get("PG_DATABASE_URL", "")


def _build_async_url(raw: str) -> str:
    if raw.startswith("postgres://"):
        raw = "postgresql+asyncpg://" + raw[len("postgres://"):]
    elif raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    if "sslmode=" in raw:
        raw = raw.replace("sslmode=", "ssl=")
    return raw


PG_URL = _build_async_url(PG_RAW)


# ── fixtures ─────────────────────────────────────────────────────────
@pytest_asyncio.fixture(scope="module")
async def pg_engine():
    """模块级 PG 引擎——建表一次，所有测试共用，最后统一清理。"""
    engine = create_async_engine(PG_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def _factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ══════════════════════════════════════════════════════════════════════
# D-5: 提现并发双扣
# ══════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_withdraw_concurrent_prevents_double_deduct(pg_engine):
    """D-5: 2 并发提现各 80 NT，只有 1 个成功，余额 100→20。

    复现服务端 /api/nt/withdraw 的锁模式：
      select(User).with_for_update().populate_existing()
    第一个事务持有行锁 → 第二个阻塞等待 →
    锁释放后读到已扣余额 → 余额不足拒绝。
    """
    factory = _factory(pg_engine)

    # setup: 用户余额 100，池有 reserve
    async with factory() as s:
        s.add(User(id="k2_d5", password_hash="x",
                   nt_balance=100, trust_score=80))
        s.add(CommunityPool(balance=10000, total_issued=20000,
                            reserve=1000, frozen=0))
        await s.commit()

    async def _withdraw(sf, amount):
        async with sf() as s:
            u = (await s.execute(
                select(User).where(User.id == "k2_d5")
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            if u.nt_balance < amount:
                await s.rollback()
                return False
            u.nt_balance -= amount
            await s.commit()
            return True

    ok = await asyncio.gather(
        _withdraw(factory, 80),
        _withdraw(factory, 80),
    )

    assert sum(ok) == 1, f"D-5 并发双扣: 应只有1个成功，实际 {ok}"
    async with factory() as s:
        u = (await s.execute(select(User).where(User.id == "k2_d5"))).scalar_one()
        assert u.nt_balance == 20, f"D-5: 余额应为20，实得 {u.nt_balance}"

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM users WHERE id = 'k2_d5'"))
        await s.execute(text("DELETE FROM community_pool"))
        await s.commit()


# ══════════════════════════════════════════════════════════════════════
# D-17: populate_existing 读到最新值
# ══════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_populate_existing_reads_fresh_after_concurrent_update(pg_engine):
    """D-17: with_for_update().populate_existing() 让加锁重查读到并发提交的最新值。

    Session A 先读到余额 100（缓存到 identity map）。
    Session B 并发改为 50 并提交。
    Session A 再以 populate_existing 加锁查询 → 应读到 50（非缓存旧值 100）。

    不加 populate_existing → SQLAlchemy 返回 session 缓存的旧对象 → 脏写。
    """
    factory = _factory(pg_engine)

    async with factory() as s:
        s.add(User(id="k2_d17", password_hash="x", nt_balance=100))
        await s.commit()

    async with factory() as sA:
        # A 首次读——缓存到 session identity map
        uA = (await sA.execute(
            select(User).where(User.id == "k2_d17")
        )).scalar_one()
        assert uA.nt_balance == 100

        # B 并发更新 + 提交
        async with factory() as sB:
            uB = (await sB.execute(
                select(User).where(User.id == "k2_d17")
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            uB.nt_balance = 50
            await sB.commit()

        # A 加锁重查 —— populate_existing 应读到 B 的提交值
        uA2 = (await sA.execute(
            select(User).where(User.id == "k2_d17")
            .with_for_update().execution_options(populate_existing=True)
        )).scalar_one()
        assert uA2.nt_balance == 50, (
            f"D-17 populate_existing: 应读到 B 的更新值 50，实得 {uA2.nt_balance}。"
            f"若为 100 → populate_existing 未生效，session 返回了缓存旧值。"
        )
        await sA.rollback()

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM users WHERE id = 'k2_d17'"))
        await s.commit()


# ══════════════════════════════════════════════════════════════════════
# D-26: 日结行锁
# ══════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_concurrent_daily_tick_only_one_executes(pg_engine):
    """D-26: 2 并发日结，只有 1 个执行扣款，另 1 个 skipped。

    复现 _run_daily_settlement 的锁模式：
      select(CommunityPool).with_for_update()  → 检查 last_tick_date
      select(User).with_for_update().populate_existing() → 扣款
    第一个事务持 pool 行锁 → 第二个在 pool 锁上阻塞 →
    锁释放后读到 last_tick_date==today → skipped。
    """
    factory = _factory(pg_engine)
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    async with factory() as s:
        s.add(User(id="k2_d26", password_hash="x",
                   nt_balance=200, role="villager"))
        s.add(CommunityPool(balance=10000, total_issued=20000,
                            reserve=1000, frozen=0, last_tick_date=None))
        s.add(Tenancy(user_id="k2_d26", room_id="dorm101", bed_num=1,
                      checkin_date=yesterday, status="active", debt=0))
        await s.commit()

    async def _daily_tick(sf):
        async with sf() as s:
            # 锁池行 → 读 last_tick_date
            pool = (await s.execute(
                select(CommunityPool).limit(1).with_for_update()
            )).scalar_one()
            if pool.last_tick_date == today:
                await s.rollback()
                return False  # skipped

            pool.last_tick_date = today

            # 锁用户行 → 扣款
            u = (await s.execute(
                select(User).where(User.id == "k2_d26")
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            u.nt_balance -= 20  # dorm101 rate
            pool.balance += 20

            # 更新 tenancy
            ten = (await s.execute(
                select(Tenancy).where(
                    Tenancy.user_id == "k2_d26",
                    Tenancy.status == "active"
                )
            )).scalar_one()
            ten.last_deducted = today

            await s.commit()
            return True  # executed

    ok = await asyncio.gather(
        _daily_tick(factory),
        _daily_tick(factory),
    )

    assert sum(ok) == 1, f"D-26 日结行锁: 应只有1个执行，实际 {ok}"
    async with factory() as s:
        u = (await s.execute(select(User).where(User.id == "k2_d26"))).scalar_one()
        assert u.nt_balance == 180, (
            f"D-26: 余额应为180（扣20），实得 {u.nt_balance}"
        )

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM tenancies WHERE user_id = 'k2_d26'"))
        await s.execute(text("DELETE FROM users WHERE id = 'k2_d26'"))
        await s.execute(text("DELETE FROM community_pool"))
        await s.commit()
