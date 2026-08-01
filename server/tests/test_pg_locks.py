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

from models import Base, User, CommunityPool, Tenancy, NTLedger, CardDiscovery

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
        await s.commit()  # 两段式：先落 users/pool 再落 tenancies——Tenancy 仅表级 FK 无 ORM relationship，UOW 不保证落库序，PG 真 FK 会拒（models.py:284）
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


# ══════════════════════════════════════════════════════════════════════
# P1-3: 公约签署发 NT 路径行锁（covenant.py:157 补 populate_existing）
# ══════════════════════════════════════════════════════════════════════
async def test_covenant_sign_populate_existing_reads_fresh(pg_engine):
    """P1-3: covenant_sign 发首签 NT 前 select(User).with_for_update()
    .populate_existing() 必须读到并发提交的最新余额，否则 u.nt_balance += reward
    基于陈旧缓存值写回 → 覆盖并发扣款（安慰剂锁脏写）。

    复现 covenant.py:156-158 的锁模式：
      pool = _get_pool(lock=True) → select(User).with_for_update().populate_existing()
    Session A 先读余额 100（缓存 identity map）。
    Session B 并发把余额改 30 提交（模拟同期提现/扣费）。
    Session A 加锁重查 → 应读 30（非旧值 100）→ +10 reward 得 40（非 110）。
    """
    factory = _factory(pg_engine)

    async with factory() as s:
        s.add(User(id="k2_p13", password_hash="x", nt_balance=100))
        await s.commit()

    async with factory() as sA:
        # A 首次读——缓存旧值 100 到 session identity map
        uA = (await sA.execute(
            select(User).where(User.id == "k2_p13")
        )).scalar_one()
        assert uA.nt_balance == 100

        # B 并发扣费到 30 并提交
        async with factory() as sB:
            uB = (await sB.execute(
                select(User).where(User.id == "k2_p13")
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            uB.nt_balance = 30
            await sB.commit()

        # A 以 covenant_sign 的锁模式加锁重查 → populate_existing 读到 B 的 30
        uA2 = (await sA.execute(
            select(User).where(User.id == "k2_p13")
            .with_for_update().execution_options(populate_existing=True)
        )).scalar_one()
        assert uA2.nt_balance == 30, (
            f"P1-3 covenant_sign 锁: populate_existing 应读到并发提交值 30，实得 {uA2.nt_balance}。"
            f"若为 100 → 锁形同虚设，+reward 将脏写覆盖并发扣款。"
        )
        # 模拟发首签 NT：+10 → 应基于最新值 30 得 40
        uA2.nt_balance += 10
        await sA.commit()

    async with factory() as s:
        u = (await s.execute(select(User).where(User.id == "k2_p13"))).scalar_one()
        assert u.nt_balance == 40, f"P1-3: 40=30+10 reward（非110=100+10脏写），实得 {u.nt_balance}"

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM users WHERE id = 'k2_p13'"))
        await s.commit()


# ══════════════════════════════════════════════════════════════════════
# P0-1: 提现 confirm 并发双过 —— entry 行锁防 frozen/total_issued 双减
# ══════════════════════════════════════════════════════════════════════
async def test_withdraw_confirm_concurrent_single_settle(pg_engine):
    """P0-1: 2 并发 confirm 同一 pending 提现，只有 1 个成功结算，
    frozen 只减一次（100→60），另一个读到「已处理」。

    复现 admin.py confirm_withdraw 的锁模式：
      select(NTLedger).where(entry_id, status=='pending')
        .with_for_update().execution_options(populate_existing=True)
    第一个事务持锁 settle → 第二个阻塞 → 锁释放后重查 status='pending'
    不再命中（EvalPlanQual 重评 WHERE）→ None → 「已处理」。
    """
    factory = _factory(pg_engine)

    async with factory() as s:
        s.add(CommunityPool(balance=10000, total_issued=20000,
                            reserve=0, frozen=100))
        s.add(NTLedger(entry_id="k2_p01", type="withdraw", from_user="k2_p01_u",
                       amount=40, reason="test", status="pending",
                       created_at=datetime.utcnow().isoformat()))
        await s.commit()

    async def _confirm(sf):
        async with sf() as s:
            entry = (await s.execute(
                select(NTLedger).where(
                    NTLedger.entry_id == "k2_p01", NTLedger.status == "pending"
                ).with_for_update().execution_options(populate_existing=True)
            )).scalar_one_or_none()
            if not entry:
                await s.rollback()
                return False  # 已处理
            pool = (await s.execute(
                select(CommunityPool).limit(1).with_for_update()
            )).scalar_one()
            pool.frozen = (pool.frozen or 0) - entry.amount
            pool.total_issued -= entry.amount
            entry.status = "settled"
            entry.settled_at = datetime.utcnow().isoformat()
            await s.commit()
            return True  # settled

    ok = await asyncio.gather(_confirm(factory), _confirm(factory))

    assert sum(ok) == 1, f"P0-1 confirm 并发: 应只有1个结算，实际 {ok}"
    async with factory() as s:
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one()
        assert pool.frozen == 60, f"P0-1: frozen 应只减一次 100→60，实得 {pool.frozen}"
        assert pool.total_issued == 19960, f"P0-1: total_issued 应只减一次，实得 {pool.total_issued}"
        e = (await s.execute(select(NTLedger).where(NTLedger.entry_id == "k2_p01"))).scalar_one()
        assert e.status == "settled"

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM nt_ledger WHERE entry_id = 'k2_p01'"))
        await s.execute(text("DELETE FROM community_pool"))
        await s.commit()


# ══════════════════════════════════════════════════════════════════════
# M-2a / S-1: 池发奖并发不双花（/api/nt/earn 池行锁）
# ══════════════════════════════════════════════════════════════════════
async def test_earn_concurrent_no_double_spend(pg_engine):
    """M-2a: 池 balance=10，2 并发各发奖 8 NT。

    复现 /api/nt/earn 的池行锁：
      select(CommunityPool).with_for_update().populate_existing()
    第一个事务持锁扣池 10→2 → 第二个阻塞等锁 →
    锁释放后读到 balance=2 < 8 → 池不足拒绝。
    断言：只有 1 笔成功，池 10→2，收款方只进账一次。
    """
    factory = _factory(pg_engine)

    async with factory() as s:
        s.add(User(id="m2a_lock_doer", password_hash="x",
                   nt_balance=0, trust_score=80))
        s.add(CommunityPool(balance=10, total_issued=500,
                            reserve=0, frozen=0))
        await s.commit()

    async def _earn(sf, amount):
        async with sf() as s:
            # 收款方行锁
            u = (await s.execute(
                select(User).where(User.id == "m2a_lock_doer")
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            # D-17 池行锁 + populate_existing
            pool = (await s.execute(
                select(CommunityPool).limit(1)
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            if pool.balance < amount:
                await s.rollback()
                return False
            pool.balance -= amount
            u.nt_balance += amount
            await s.commit()
            return True

    ok = await asyncio.gather(_earn(factory, 8), _earn(factory, 8))

    assert sum(ok) == 1, f"M-2a 池发奖并发双花: 应只有1个成功，实际 {ok}"
    async with factory() as s:
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one()
        assert pool.balance == 2, f"M-2a: 池应 10→2（只扣一次），实得 {pool.balance}"
        u = (await s.execute(select(User).where(User.id == "m2a_lock_doer"))).scalar_one()
        assert u.nt_balance == 8, f"M-2a: 收款方应只进账一次=8，实得 {u.nt_balance}"

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM users WHERE id = 'm2a_lock_doer'"))
        await s.execute(text("DELETE FROM community_pool"))
        await s.commit()


# ══════════════════════════════════════════════════════════════════════
# M-2b-i / S-1: 卡片确认并发只发一次（discovery 行锁 + 池行锁）
# ══════════════════════════════════════════════════════════════════════
async def test_card_confirm_concurrent_single_grant(pg_engine):
    """M-2b-i: 同一 discovery 2 并发确认，只有 1 个发奖成功。

    复现 /api/nt/card-confirm 的锁模式：
      select(CardDiscovery).with_for_update().populate_existing()  # P0-1 行锁
      + _grant_from_pool 内 select(CommunityPool).with_for_update().populate_existing()  # D-17
    第一个事务持 discovery 锁 → 置 confirmed + 扣池发奖 →
    第二个阻塞等锁 → 锁释放后读到 status=confirmed → 拒绝（不二次发奖）。
    断言：只 1 个成功，doer 只进账一次，池只扣一次，disc=confirmed。
    """
    factory = _factory(pg_engine)

    async with factory() as s:
        s.add(User(id="m2bi_doer", password_hash="x", nt_balance=0, trust_score=80))
        s.add(CommunityPool(balance=100, total_issued=500, reserve=0, frozen=0))
        s.add(CardDiscovery(id="m2bi_disc", space_id="sp", description="扫地",
                            guesser="m2bi_reporter", guessed_person="m2bi_doer",
                            status="pending", nt_guesser=5, nt_doer=8,
                            created_at="2026-07-29T00:00:00"))
        await s.commit()

    async def _confirm(sf):
        async with sf() as s:
            disc = (await s.execute(
                select(CardDiscovery).where(CardDiscovery.id == "m2bi_disc")
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            if disc.status != "pending":
                await s.rollback()
                return False
            # _grant_from_pool 等效内联：池行锁 + 扣池加人
            u = (await s.execute(
                select(User).where(User.id == disc.guessed_person)
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            pool = (await s.execute(
                select(CommunityPool).limit(1)
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            if pool.balance < disc.nt_doer:
                await s.rollback()
                return False
            pool.balance -= disc.nt_doer
            u.nt_balance += disc.nt_doer
            disc.status = "confirmed"
            await s.commit()
            return True

    ok = await asyncio.gather(_confirm(factory), _confirm(factory))

    assert sum(ok) == 1, f"M-2b-i 并发双确认: 应只有1个发奖，实际 {ok}"
    async with factory() as s:
        u = (await s.execute(select(User).where(User.id == "m2bi_doer"))).scalar_one()
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one()
        disc = (await s.execute(select(CardDiscovery).where(CardDiscovery.id == "m2bi_disc"))).scalar_one()
        assert u.nt_balance == 8, f"M-2b-i: doer 应只进账一次=8，实得 {u.nt_balance}"
        assert pool.balance == 92, f"M-2b-i: 池应只扣一次 100→92，实得 {pool.balance}"
        assert disc.status == "confirmed"

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM users WHERE id = 'm2bi_doer'"))
        await s.execute(text("DELETE FROM card_discoveries WHERE id = 'm2bi_disc'"))
        await s.execute(text("DELETE FROM community_pool"))
        await s.commit()


# ══════════════════════════════════════════════════════════════════════
# W7-DB-1 D-3: clean_weekly claim 并发 —— 同 task 两人同抢一胜一败
# ══════════════════════════════════════════════════════════════════════
async def test_clean_weekly_claim_concurrent_only_one_wins(pg_engine):
    """D-3: W7-CLEAN-1 揭示：SQLite 上两并发 claim 同 task 都返 200。

    PG 上 with_for_update() 应生效 → 恰好 1×200 + 1×4xx。
    复现 clean_weekly.py:121-130 的锁模式：
      select(CleanWeeklyTask).with_for_update().populate_existing()
      读 status → open? → 写 claimed_by + status=claimed
    第一个事务持行锁 → 第二个阻塞 → 锁释放后读到 status=claimed → 拒绝。
    """
    from models import CleanWeeklyTask
    factory = _factory(pg_engine)
    WEEK = "2026-08-01"

    async with factory() as s:
        s.add(User(id="d3_alice", password_hash="x", nt_balance=100))
        s.add(User(id="d3_bob", password_hash="x", nt_balance=100))
        s.add(CleanWeeklyTask(
            id="cwt_d3_test", week_start_date=WEEK, space_id="room1",
            space_name="测试房间", reward_nt=15, status="open",
            created_at="2026-08-01T00:00:00",
        ))
        await s.commit()

    async def _claim(sf, uid):
        async with sf() as s:
            task = (await s.execute(
                select(CleanWeeklyTask).where(CleanWeeklyTask.id == "cwt_d3_test")
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            if task.status != "open":
                await s.rollback()
                return False
            task.status = "claimed"
            task.claimed_by = uid
            task.claimed_at = "2026-08-01T12:00:00"
            await s.commit()
            return True

    ok = await asyncio.gather(
        _claim(factory, "d3_alice"),
        _claim(factory, "d3_bob"),
    )

    assert sum(ok) == 1, (
        f"D-3 clean_weekly claim 并发: 应只有1个成功，实际 alice={ok[0]} bob={ok[1]}。"
        f"若两 True → with_for_update() 未生效（SQLite 级静默无效复现）。"
    )
    async with factory() as s:
        task = (await s.execute(
            select(CleanWeeklyTask).where(CleanWeeklyTask.id == "cwt_d3_test")
        )).scalar_one()
        assert task.status == "claimed", f"D-3: 最终态应为 claimed，实得 {task.status}"
        winner = "d3_alice" if ok[0] else "d3_bob"
        assert task.claimed_by == winner, (
            f"D-3: claimed_by 应为胜者 {winner}，实得 {task.claimed_by}"
        )

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM clean_weekly_tasks WHERE id = 'cwt_d3_test'"))
        await s.execute(text("DELETE FROM users WHERE id IN ('d3_alice', 'd3_bob')"))
        await s.commit()


# ══════════════════════════════════════════════════════════════════════
# W7-DB-1 D-4a: pool clamp 并发写不破 N-1b
# ══════════════════════════════════════════════════════════════════════
async def test_pool_clamp_under_concurrent_writes(pg_engine):
    """D-4a: W7-NT-1 的 reserve ≤ balance clamp 在并发写下不破。

    两并发操作同时动 pool（一个加 balance+reserve，一个扣 balance）。
    断言收敛后 reserve <= balance 且 /verify pass=True。

    复现 nt_helpers.py:_get_pool(lock=True) 的锁模式：
      select(CommunityPool).with_for_update()  ← 注意：无 populate_existing！
    第一个事务持锁读写 → 第二个阻塞 → 锁释放后读到已提交值 → 各自 clamp。
    """
    factory = _factory(pg_engine)

    async with factory() as s:
        s.add(CommunityPool(balance=100, total_issued=500,
                            reserve=80, frozen=0))
        await s.commit()

    async def _add_balance(sf, amount):
        """模拟链上充值：加 balance + reserve。"""
        async with sf() as s:
            pool = (await s.execute(
                select(CommunityPool).limit(1).with_for_update()
            )).scalar_one()
            pool.balance = (pool.balance or 0) + amount
            pool.reserve = (pool.reserve or 0) + amount
            pool.total_issued += amount
            await s.commit()

    async def _deduct_balance(sf, amount):
        """模拟发奖：扣 balance（reserve 不变，可能触发 clamp）。"""
        async with sf() as s:
            pool = (await s.execute(
                select(CommunityPool).limit(1).with_for_update()
            )).scalar_one()
            pool.balance = (pool.balance or 0) - amount
            # 模拟 _get_pool N-1b clamp
            if (pool.reserve or 0) > (pool.balance or 0):
                pool.reserve = pool.balance
            await s.commit()

    await asyncio.gather(
        _add_balance(factory, 50),
        _deduct_balance(factory, 30),
    )

    async with factory() as s:
        pool = (await s.execute(
            select(CommunityPool).limit(1)
        )).scalar_one()
        assert (pool.reserve or 0) <= (pool.balance or 0), (
            f"D-4a N-1b 破: reserve={pool.reserve} > balance={pool.balance}"
        )
        # total_system 守恒校验
        total_users = (await s.execute(select(User))).scalars()
        total_user_balance = sum((u.nt_balance or 0) for u in total_users)
        total_system = (total_user_balance + (pool.balance or 0)
                        + (pool.task_escrow or 0) + (pool.camp_balance or 0)
                        + (pool.frozen or 0))
        assert abs(total_system - (pool.total_issued or 0)) <= 1, (
            f"D-4a 等式破: total_system={total_system} vs total_issued={pool.total_issued}"
        )

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM community_pool"))
        await s.commit()


# ══════════════════════════════════════════════════════════════════════
# W7-DB-1 D-4b: daily_tick + verify 在 PG 上全绿
# ══════════════════════════════════════════════════════════════════════
async def test_daily_tick_after_nt1_keeps_verify_pass_on_pg(pg_engine):
    """D-4b: PG 上跑 _run_daily_settlement → 断言 verify pass=True。

    复现 _run_daily_settlement 的完整锁链（nt.py:1342-1390）：
      select(CommunityPool).with_for_update()
      → 检查 last_tick_date
      → 遍历每用户 select(User).with_for_update().populate_existing()
      → 扣款、写 ledger
    断言扣款后等式仍守恒。
    """
    factory = _factory(pg_engine)
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    today = datetime.utcnow().strftime("%Y-%m-%d")

    async with factory() as s:
        s.add(User(id="d4b_u1", password_hash="x", nt_balance=100, role="villager"))
        s.add(User(id="d4b_u2", password_hash="x", nt_balance=50, role="villager"))
        s.add(CommunityPool(balance=500, total_issued=700,
                            reserve=300, frozen=0, last_tick_date=None))
        await s.commit()
        s.add(Tenancy(user_id="d4b_u1", room_id="dorm_a", bed_num=1,
                      checkin_date=yesterday, status="active", debt=0))
        s.add(Tenancy(user_id="d4b_u2", room_id="dorm_b", bed_num=1,
                      checkin_date=yesterday, status="active", debt=0))
        await s.commit()

    # 简版 daily_tick
    async with factory() as s:
        pool = (await s.execute(
            select(CommunityPool).limit(1).with_for_update()
        )).scalar_one()
        if pool.last_tick_date == today:
            await s.rollback()
            pytest.skip("今天已跑过日结")
        pool.last_tick_date = today

        users = (await s.execute(
            select(User).where(User.role == "villager")
            .with_for_update().execution_options(populate_existing=True)
        )).scalars()
        for u in users:
            if u.nt_balance >= 40:
                u.nt_balance -= 40
                pool.balance += 40
        await s.commit()

    # verify
    async with factory() as s:
        pool = (await s.execute(
            select(CommunityPool).limit(1)
        )).scalar_one()
        total_users = (await s.execute(select(User))).scalars()
        total_user_balance = sum((u.nt_balance or 0) for u in total_users)
        total_system = (total_user_balance + (pool.balance or 0)
                        + (pool.task_escrow or 0) + (pool.camp_balance or 0)
                        + (pool.frozen or 0))
        diff = total_system - (pool.total_issued or 0)
        assert abs(diff) <= 1, (
            f"D-4b 日结后等式破: total_system={total_system} "
            f"vs total_issued={pool.total_issued}, diff={diff}"
        )
        assert (pool.reserve or 0) <= (pool.balance or 0), (
            f"D-4b N-1b 破: reserve={pool.reserve} > balance={pool.balance}"
        )

    # cleanup
    async with factory() as s:
        await s.execute(text("DELETE FROM tenancies WHERE user_id IN ('d4b_u1', 'd4b_u2')"))
        await s.execute(text("DELETE FROM users WHERE id IN ('d4b_u1', 'd4b_u2')"))
        await s.execute(text("DELETE FROM community_pool"))
        await s.commit()
