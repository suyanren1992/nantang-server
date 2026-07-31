"""SQLite database connection and session management."""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select, text
from datetime import datetime
import os

logger = logging.getLogger("nantang.db")

DB_PATH = os.path.join(os.path.dirname(__file__), "nantang_fresh.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DB_PATH}")

# Neon/Render 给的 postgres:// 或 postgresql:// 统一改用 asyncpg 驱动
# （部署环境未装 psycopg2，直接传入会因缺驱动启动崩溃）
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+asyncpg://" + DATABASE_URL[len("postgres://"):]
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+asyncpg://" + DATABASE_URL[len("postgresql://"):]
# asyncpg 不认 sslmode 参数，翻译成 ssl
if "sslmode=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("sslmode=", "ssl=")

# 连接池配置：生产 Postgres(Neon) 默认仅 5+10=15 连接，50 人并发峰值会耗尽 → 超时。
# SQLite 本地不吃这些参数（用 StaticPool/异步适配），故按方言分支传参。
# 连接数账：pool_size + max_overflow = 每 worker 最多 15；配 --workers 2 → 上限 30，
# 在 Neon 免费/入门档连接上限内。若换更小档位需同步下调。
_engine_kwargs = {"echo": False}
if not DATABASE_URL.startswith("sqlite"):
    _engine_kwargs.update(
        pool_size=10,
        max_overflow=5,
        pool_recycle=1800,   # Neon 会闲置断链，30 分钟回收避免用到死连接
        pool_pre_ping=True,  # 取连接前探活，断链自动重建
    )
engine = create_async_engine(DATABASE_URL, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        # SQLite 专属 PRAGMA（PG 上跳过，否则报错）
        if engine.dialect.name == 'sqlite':
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
        # 50 人承载：sync/checkin/营地/校核高频 WHERE 列补索引（原缺失，随数据增长恶化）
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenancies_user_id ON tenancies(user_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenancies_room_id ON tenancies(room_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tenancies_status ON tenancies(status)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nt_tasks_camp_ref_id ON nt_tasks(camp_ref_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_verifications_doer ON verifications(doer)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deposit_intents_user_id ON deposit_intents(user_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_journal_user ON journal(user)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_camp_memberships_camp_id ON camp_memberships(camp_id)"))
        # UI-FIX-P2-BE B1: storage_items 复合索引
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_storage_items_user_location ON storage_items(user_id, storage_location)"))
        # UI-FIX-P2-BE补 B6: field_plots 索引
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_field_plots_stage ON field_plots(stage)"))
        # NEW-USER-TASK-BE: 新人任务模板复合索引 + NTTask 新人任务索引
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_new_user_task_templates_role_order "
            "ON new_user_task_templates(target_role, display_order)"))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_nt_tasks_is_newbie ON nt_tasks(is_newbie_task)"))
    # 轻量迁移：为新列补默认值（create_all 不会给已有表加列）
    async with async_session() as session:
        # T1: CommunityPool 防多行 — 必须在查询前执行，否则旧表无此列会报错
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN singleton BOOLEAN DEFAULT 1"))
            await session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_community_pool_singleton ON community_pool(singleton)"))
            await session.commit()
        except Exception:
            await session.rollback()  # PG: 失败 DDL 会中止事务，必须回滚才能继续
        # R7: 为已有 User 补 token_version（SQLite ALTER TABLE 加列 + 默认值）
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            await session.rollback()  # 列已存在则跳过（PG 需回滚恢复事务）
        # G-3: Tenancy.accommodation_due（住宿费日记账累计；存量表补列默认 0）
        try:
            await session.execute(text("ALTER TABLE tenancies ADD COLUMN accommodation_due INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            await session.rollback()  # 列已存在则跳过（PG 需回滚恢复事务）
        # Step 1: 社区资金系统 — reserve/frozen 列
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN reserve INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            await session.rollback()  # PG: 同上，回滚恢复事务
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN frozen INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            await session.rollback()  # PG: 同上，回滚恢复事务
        from models import CommunityPool, NTLedger
        from nt_helpers import _add_ledger, _ledger_id
        r = await session.execute(select(CommunityPool).limit(1))
        pool = r.scalar_one_or_none()
        if not pool:
            # C-7: 新库池起始值 500，账上留痕（照社区池多钱包设计稿）
            pool = CommunityPool(balance=500, total_issued=500, task_escrow=0,
                         contribution_pool=0, camp_balance=0, reserve=0, frozen=0,
                         updated_at=datetime.utcnow().isoformat())
            session.add(pool)
            await _add_ledger(session, _ledger_id(), "system", "community_pool", 500,
                              "pool_init", "社区池初始化", status="settled")
            await session.commit()
        else:
            # C-7: 存量库池为 0 且从未补过 → 幂等补一次 500（有 pool_init 账则永不重复）
            has_init = await session.execute(select(NTLedger).where(NTLedger.type == "pool_init").limit(1))
            if (pool.balance or 0) == 0 and not has_init.scalar_one_or_none():
                pool.balance = 500
                pool.total_issued = (pool.total_issued or 0) + 500
                pool.updated_at = datetime.utcnow().isoformat()
                await _add_ledger(session, _ledger_id(), "system", "community_pool", 500,
                                  "pool_init", "社区池初始化（存量库补齐）", status="settled")
                await session.commit()
        # Fix 2: 为已有 NTTask 补 assignees 列（多槽位）
        try:
            await session.execute(text("ALTER TABLE nt_tasks ADD COLUMN assignees TEXT"))
            await session.commit()
        except Exception:
            pass
        # T7: CampTask 合并到 NTTask — 加 camp_ref_id 列 + 迁移数据（SQLite 专属，PG 新库无此表）
        if engine.dialect.name == 'sqlite':
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
                logger.info(f"[T7 migration] migrated {len(rows)} camp_tasks to NTTask")
            except Exception as e:
                logger.warning(f"[T7 migration] skipped: {e}")
                await session.rollback()  # PG: 回滚恢复事务，避免影响后续迁移
        # T8: card_discoveries 加 doer_name_snapshot 列
        try:
            await session.execute(text("ALTER TABLE card_discoveries ADD COLUMN doer_name_snapshot VARCHAR(64)"))
            await session.commit()
        except Exception:
            await session.rollback()  # PG: 同上，回滚恢复事务
        # C-B-4: Tenancy 加 track/room_type/check_out_date（存量表补列，向后兼容默认值）
        for _ddl in (
            "ALTER TABLE tenancies ADD COLUMN track VARCHAR DEFAULT 'coop'",
            "ALTER TABLE tenancies ADD COLUMN room_type VARCHAR",
            "ALTER TABLE tenancies ADD COLUMN check_out_date VARCHAR",
        ):
            try:
                await session.execute(text(_ddl))
                await session.commit()
            except Exception:
                await session.rollback()  # 列已存在则跳过（PG 需回滚恢复事务）
        # C-B-4: 素社 InnRoom 种子（幂等——空表才播；沿 CommunityPool 池初始化惯例）
        try:
            from models import InnRoom
            _has_inn = (await session.execute(select(InnRoom).limit(1))).scalar_one_or_none()
            if not _has_inn:
                _seed_rooms = [
                    ("mei", "梅·单人间", "single", 1, 40),
                    ("lan", "兰·单人间", "single", 1, 40),
                    ("zhu", "竹·单人间", "single", 1, 40),
                    ("ju", "菊·单人间", "single", 1, 40),
                    ("quadA", "四人间A", "quad", 4, 25),
                    ("quadB", "四人间B", "quad", 4, 25),
                ]
                for _rid, _label, _rtype, _beds, _rate in _seed_rooms:
                    session.add(InnRoom(id=_rid, label=_label, room_type=_rtype,
                                        beds=_beds, rate=_rate, dietary="vegetarian", status="active"))
                await session.commit()
                logger.info("[C-B-4] seeded 6 inn_rooms (素社: 4 single + 2 quad)")
        except Exception as e:
            logger.warning(f"[C-B-4] inn_rooms seed skipped: {e}")
            await session.rollback()
        # ══ A-LABOR-BE: 新字段迁移 ══
        # ① User.first_checkin_date (Date)
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN first_checkin_date DATE"))
            await session.commit()
        except Exception:
            await session.rollback()
        # ④ User.xp_by_category (Text/JSON)
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN xp_by_category TEXT"))
            await session.commit()
        except Exception:
            await session.rollback()
        # ② Tenancy.last_active_at (String/DateTime)
        try:
            await session.execute(text("ALTER TABLE tenancies ADD COLUMN last_active_at VARCHAR"))
            await session.commit()
        except Exception:
            await session.rollback()
        # ══ CLEAN-WEEKLY-BE ③: User.clean_weekly_streak ══
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN clean_weekly_streak INTEGER DEFAULT 0"))
            await session.commit()
        except Exception:
            await session.rollback()
        # ══ UI-FIX-P2-BE补 B7: User.user_settings (JSON) ══
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN user_settings TEXT"))
            await session.commit()
        except Exception:
            await session.rollback()
        # ══ NEW-USER-TASK-BE: NTTask 加 3 字段 ══
        for _ddl in (
            "ALTER TABLE nt_tasks ADD COLUMN is_newbie_task BOOLEAN DEFAULT 0",
            "ALTER TABLE nt_tasks ADD COLUMN assigned_by_system BOOLEAN DEFAULT 0",
            "ALTER TABLE nt_tasks ADD COLUMN template_id VARCHAR",
        ):
            try:
                await session.execute(text(_ddl))
                await session.commit()
            except Exception:
                await session.rollback()
        # ══ NEW-USER-TASK-BE: 种子数据（4 个模板，幂等——空表才播）══
        try:
            from models import NewUserTaskTemplate
            _has_tpl = (await session.execute(select(NewUserTaskTemplate).limit(1))).scalar_one_or_none()
            if not _has_tpl:
                _now = datetime.utcnow().isoformat()
                _seed_tpls = [
                    ("tpl_meet_neighbor", "认识一下你的邻居", "和一位邻居打个招呼，互相认识一下", 10, "visitor", 1, 7),
                    ("tpl_covenant_sign", "浏览公约 + 签到", "阅读社区公约并完成签到", 5, "visitor", 2, 7),
                    ("tpl_first_cleanup", "参与第一次大扫除", "参加一次社区大扫除活动", 15, "visitor", 3, 7),
                    ("tpl_first_task", "领取你的第一个任务", "从任务板领取并完成一个任务", 20, "npc", 4, 7),
                ]
                for _tid, _title, _desc, _nt, _role, _order, _exp in _seed_tpls:
                    session.add(NewUserTaskTemplate(
                        id=_tid, title=_title, description=_desc,
                        reward_nt=_nt, target_role=_role,
                        display_order=_order, expires_days=_exp,
                        created_at=_now,
                    ))
                await session.commit()
                logger.info("[NEW-USER-TASK-BE] seeded 4 new_user_task_templates")
        except Exception as e:
            logger.warning(f"[NEW-USER-TASK-BE] template seed skipped: {e}")
            await session.rollback()
