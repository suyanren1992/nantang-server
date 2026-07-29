"""CR-2 池修改补行锁并发守恒测试（requires_pg——SQLite 行锁静默无效，仅 PG 真生效）。

判据3：10 topup(10) + 10 withdraw(10) 并发 → final pool.balance == initial。
锁型沿 S-1/D-5 先例：_get_pool(db, lock=True) = SELECT ... FOR UPDATE 池行，
写路径串行化防丢更新（lost update）。无 PG 时 requires_pg 自动 skip。
"""
import os
import sys
import asyncio
from pathlib import Path

_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text

from models import Base, CommunityPool

pytestmark = [
    pytest.mark.requires_pg,
    pytest.mark.asyncio(loop_scope="module"),
]

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


@pytest_asyncio.fixture(scope="module")
async def pg_engine():
    engine = create_async_engine(PG_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def _factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def test_pool_lock_topup_withdraw_conserved(pg_engine):
    """10 topup(10) + 10 withdraw(10)：净变化 0，final == initial（1000）。"""
    factory = _factory(pg_engine)
    INITIAL = 1000
    async with factory() as s:
        s.add(CommunityPool(balance=INITIAL, total_issued=INITIAL, reserve=0, frozen=0))
        await s.commit()

    async def _delta(sf, amount):
        async with sf() as s:
            pool = (await s.execute(
                select(CommunityPool).limit(1)
                .with_for_update().execution_options(populate_existing=True)
            )).scalar_one()
            pool.balance += amount
            await s.commit()

    ops = [_delta(factory, 10) for _ in range(10)] + [_delta(factory, -10) for _ in range(10)]
    await asyncio.gather(*ops)

    async with factory() as s:
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one()
        assert pool.balance == INITIAL, f"守恒失败：final={pool.balance} != {INITIAL}"

    async with factory() as s:
        await s.execute(text("DELETE FROM community_pool"))
        await s.commit()
