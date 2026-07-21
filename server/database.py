"""SQLite database connection and session management."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "nantang_fresh.db")
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # 预创建 CommunityPool 行，避免 register 首次创建时的并发竞态
    async with async_session() as session:
        from models import CommunityPool
        r = await session.execute(select(CommunityPool).limit(1))
        if not r.scalar_one_or_none():
            session.add(CommunityPool(balance=2000, total_issued=2000, task_escrow=0, contribution_pool=0, camp_balance=0))
            await session.commit()
