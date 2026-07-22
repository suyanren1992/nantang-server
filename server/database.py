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
        # B+4: NTTask 高频查询列索引
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nt_tasks_poster ON nt_tasks(poster)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nt_tasks_assignee ON nt_tasks(assignee)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nt_tasks_status ON nt_tasks(status)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nt_tasks_is_system ON nt_tasks(is_system_generated)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_verifications_status_created ON verifications(status, created_at DESC)"))
    # 轻量迁移：为新列补默认值（create_all 不会给已有表加列）
    async with async_session() as session:
        # T1: CommunityPool 防多行 — 必须在查询前执行，否则旧表无此列会报错
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN singleton BOOLEAN DEFAULT 1"))
            await session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_community_pool_singleton ON community_pool(singleton)"))
            await session.commit()
        except Exception:
            pass
        # R7: 为已有 User 补 token_version（SQLite ALTER TABLE 加列 + 默认值）
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            pass  # 列已存在则跳过
        # Step 1: 社区资金系统 — reserve/frozen 列
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN reserve INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            pass
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN frozen INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            pass
        from models import CommunityPool
        r = await session.execute(select(CommunityPool).limit(1))
        if not r.scalar_one_or_none():
            session.add(CommunityPool(balance=0, total_issued=0, task_escrow=0,
                         contribution_pool=0, camp_balance=0, reserve=0, frozen=0))
            await session.commit()
        # Fix 2: 为已有 NTTask 补 assignees 列（多槽位）
        try:
            await session.execute(text("ALTER TABLE nt_tasks ADD COLUMN assignees TEXT"))
            await session.commit()
        except Exception:
            pass
        # T7: CampTask 合并到 NTTask — 加 camp_ref_id 列 + 迁移数据
        try:
            await session.execute(text("ALTER TABLE nt_tasks ADD COLUMN camp_ref_id TEXT"))
            await session.commit()
            # 迁移已有 camp_tasks 数据
            r2 = await session.execute(text("SELECT * FROM camp_tasks"))
            keys = r2.keys()
            rows = [dict(zip(keys, vals)) for vals in r2.fetchall()]
            import json as _json
            for row in rows:
                task_id = f"camp_{row['camp_id']}_{row['id']}"
                # CampTask claimants JSON → NTTask assignees JSON (name array)
                claimants_raw = row.get("claimants") or "[]"
                try: claimants_list = _json.loads(claimants_raw) if isinstance(claimants_raw, str) else claimants_raw
                except Exception: claimants_list = []
                assignee_names = [c if isinstance(c, str) else c.get("name", str(c)) for c in claimants_list]
                await session.execute(text(
                    "INSERT OR IGNORE INTO nt_tasks(id, poster, title, reward, status, category, scope, note, slots, deadline, reviewer, assignees, camp_ref_id, created_at) "
                    "VALUES(:id, :poster, :title, :reward, :status, :category, 'camp', :note, :slots, :deadline, :reviewer, :assignees, :camp_ref_id, :created_at)"
                ), {
                    "id": task_id, "poster": row.get("poster") or "", "title": row["name"], "reward": row.get("nt") or 0,
                    "status": row.get("status") or "draft", "category": row.get("type") or "",
                    "note": row.get("note") or "", "slots": row.get("slots") or 1,
                    "deadline": row.get("deadline"), "reviewer": row.get("reviewer"),
                    "assignees": _json.dumps(assignee_names, ensure_ascii=False), "camp_ref_id": row["camp_id"],
                    "created_at": row.get("created_at")
                })
            await session.execute(text("DROP TABLE IF EXISTS camp_tasks"))
            await session.commit()
            print(f"[T7 migration] migrated {len(rows)} camp_tasks to NTTask")
        except Exception as e:
            print(f"[T7 migration] skipped: {e}")
        # T8: card_discoveries 加 doer_name_snapshot 列
        try:
            await session.execute(text("ALTER TABLE card_discoveries ADD COLUMN doer_name_snapshot VARCHAR(64)"))
            await session.commit()
        except Exception:
            pass
