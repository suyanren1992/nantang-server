"""SQLite database connection and session management."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select, text
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
        # B+1: WAL 提升并发读写；显式开启外键约束（SQLite 默认关闭）
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        await conn.run_sync(Base.metadata.create_all)
        # B+3: nt_ledger 高频查询列索引
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nt_ledger_from_user ON nt_ledger(from_user)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nt_ledger_to_user ON nt_ledger(to_user)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nt_ledger_task_id ON nt_ledger(task_id)"))
    # 轻量迁移：为新列补默认值（create_all 不会给已有表加列）
    async with async_session() as session:
        from models import CommunityPool
        r = await session.execute(select(CommunityPool).limit(1))
        if not r.scalar_one_or_none():
            session.add(CommunityPool(balance=0, total_issued=0, task_escrow=0, contribution_pool=0, camp_balance=0))
            await session.commit()
        # R7: 为已有 User 补 token_version（SQLite ALTER TABLE 加列 + 默认值）
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            pass  # 列已存在则跳过
        # Fix 2: 为已有 NTTask 补 assignees 列（多槽位）
        try:
            await session.execute(text("ALTER TABLE nt_tasks ADD COLUMN assignees TEXT"))
            await session.commit()
        except Exception:
            pass
