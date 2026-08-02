"""SQLite database connection and session management."""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select, text
from datetime import datetime
import os

from auth_utils import hash_password

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


def _enforce_admin_password_guard():
    """C-1: 默认管理员密码守卫。

    默认密码 admin123 时：dev/test 环境（TESTING 或 ENVIRONMENT=dev/development/test/local）
    仅 logger.warning 告警；非开发环境直接 raise RuntimeError 阻断启动，
    杜绝公开已知凭据（admin_bootstrap / admin123）被部署上线。
    """
    pwd = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "admin123")
    if pwd != "admin123":
        return
    _is_dev = bool(
        os.getenv("TESTING")
        or os.getenv("ENVIRONMENT", "").lower() in ("dev", "development", "test", "local")
    )
    logger.warning(
        "⚠️ ADMIN_BOOTSTRAP_PASSWORD 使用默认值 admin123，"
        "生产环境必须设置环境变量！"
    )
    if not _is_dev:
        raise RuntimeError(
            "ADMIN_BOOTSTRAP_PASSWORD 未设置（默认 admin123），非开发环境拒绝启动。"
            "请设置 ADMIN_BOOTSTRAP_PASSWORD 环境变量后再部署。"
        )


# ══ P0-IDX: 索引 DDL 清单（在轻量迁移之后统一建，见文件末 _build_indexes）══
# 原先这 30 条裸跑在本事务里，任一条失败即冒泡到 lifespan → 整站起不来。
# 两次生产事故均源于此：
#   ① journal(user) —— user 是 PG 保留字，被解析为函数 USER()
#   ② nt_tasks(is_newbie_task) —— 该列由下方轻量迁移 ALTER 添加，
#      建索引却排在迁移之前，PG 上列尚不存在 → UndefinedColumnError
# 治法：① 清单化，移到迁移之后执行（解决顺序倒置）
#       ② 逐条独立事务 + 失败仅 logger.warning（索引缺失只影响查询速度，
#          绝不该阻断启动；与本文件 ALTER 段既有的 try/rollback 惯例一致）
_INDEX_DDL = [
    "CREATE INDEX IF NOT EXISTS idx_nt_ledger_from_user ON nt_ledger(from_user)",
    "CREATE INDEX IF NOT EXISTS idx_nt_ledger_to_user ON nt_ledger(to_user)",
    "CREATE INDEX IF NOT EXISTS idx_nt_ledger_task_id ON nt_ledger(task_id)",
    # B+4: NTTask 高频查询列索引
    "CREATE INDEX IF NOT EXISTS idx_nt_tasks_poster ON nt_tasks(poster)",
    "CREATE INDEX IF NOT EXISTS idx_nt_tasks_assignee ON nt_tasks(assignee)",
    "CREATE INDEX IF NOT EXISTS idx_nt_tasks_status ON nt_tasks(status)",
    "CREATE INDEX IF NOT EXISTS idx_nt_tasks_is_system ON nt_tasks(is_system_generated)",
    "CREATE INDEX IF NOT EXISTS idx_verifications_status_created ON verifications(status, created_at DESC)",
    # 50 人承载：sync/checkin/营地/校核高频 WHERE 列补索引（原缺失，随数据增长恶化）
    "CREATE INDEX IF NOT EXISTS idx_tenancies_user_id ON tenancies(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_tenancies_room_id ON tenancies(room_id)",
    "CREATE INDEX IF NOT EXISTS idx_tenancies_status ON tenancies(status)",
    "CREATE INDEX IF NOT EXISTS idx_nt_tasks_camp_ref_id ON nt_tasks(camp_ref_id)",
    "CREATE INDEX IF NOT EXISTS idx_verifications_doer ON verifications(doer)",
    "CREATE INDEX IF NOT EXISTS idx_deposit_intents_user_id ON deposit_intents(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_journal_user ON journal(\"user\")",
    "CREATE INDEX IF NOT EXISTS idx_camp_memberships_camp_id ON camp_memberships(camp_id)",
    # UI-FIX-P2-BE B1: storage_items 复合索引
    "CREATE INDEX IF NOT EXISTS idx_storage_items_user_location ON storage_items(user_id, storage_location)",
    # UI-FIX-P2-BE补 B6: field_plots 索引
    "CREATE INDEX IF NOT EXISTS idx_field_plots_stage ON field_plots(stage)",
    # NEW-USER-TASK-BE: 新人任务模板复合索引 + NTTask 新人任务索引
    "CREATE INDEX IF NOT EXISTS idx_new_user_task_templates_role_order ON new_user_task_templates(target_role, display_order)",
    "CREATE INDEX IF NOT EXISTS idx_nt_tasks_is_newbie ON nt_tasks(is_newbie_task)",
    # ══ DB-P1-3 ②: 10 缺失索引（v2 报告附录 A）══
    "CREATE INDEX IF NOT EXISTS idx_nt_ledger_type_status ON nt_ledger(type, status)",
    "CREATE INDEX IF NOT EXISTS idx_nt_ledger_created_at ON nt_ledger(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_verifications_verifier ON verifications(verifier)",
    "CREATE INDEX IF NOT EXISTS idx_camp_builders_camp_id ON camp_builders(camp_id)",
    "CREATE INDEX IF NOT EXISTS idx_canteen_menu_date ON canteen_menu(date)",
    "CREATE INDEX IF NOT EXISTS idx_meal_orders_user ON meal_orders(\"user\")",
    "CREATE INDEX IF NOT EXISTS idx_clean_weekly_tasks_week_start ON clean_weekly_tasks(week_start_date)",
    "CREATE INDEX IF NOT EXISTS idx_clean_weekly_tasks_claimed_by ON clean_weekly_tasks(claimed_by)",
    "CREATE INDEX IF NOT EXISTS idx_clean_weekly_dist_week_start ON clean_weekly_distributions(week_start_date)",
    "CREATE INDEX IF NOT EXISTS idx_tenancies_track ON tenancies(track)",
    # W7-NOTIF-1: 通知系统 — 按收件人+类型+已读状态过滤
    "CREATE INDEX IF NOT EXISTS idx_activity_log_user_type ON activity_log(user_id, type, read_at)",
    # W7-ITEM-1: items 表高频查询列索引
    "CREATE INDEX IF NOT EXISTS idx_items_location_id ON items(location_id)",
    "CREATE INDEX IF NOT EXISTS idx_items_owner_id ON items(owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)",
    "CREATE INDEX IF NOT EXISTS idx_items_state ON items(state)",
    "CREATE INDEX IF NOT EXISTS idx_items_expiration ON items(expiration)",
    # W7-EVENT-1: space_events 表索引
    "CREATE INDEX IF NOT EXISTS idx_space_events_location_id ON space_events(location_id)",
    "CREATE INDEX IF NOT EXISTS idx_space_events_type ON space_events(type)",
    "CREATE INDEX IF NOT EXISTS idx_space_events_created_at ON space_events(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_space_events_visibility ON space_events(visibility)",
]


def _log_migration_skip(exc: Exception) -> None:
    """迁移 ALTER 失败的分级日志。

    "列/表已存在" 是幂等重跑的正常结果 -> debug。
    其余(语法错/类型不兼容/保留字)是真故障: 列不会被创建, 运行时查询必 500,
    但 except 会把它咽掉, 启动照常成功 -> 必须 warning, 否则无人知晓。
    三次生产事故(journal(user) 保留字 / is_newbie_task BOOLEAN DEFAULT 0)
    都是被静默吞掉的这一类。
    """
    msg = str(exc)
    low = msg.lower()
    if "already exists" in low or "duplicate column" in low:
        logger.debug("迁移跳过(已存在): %s", msg)
    else:
        logger.warning("[MIGRATION-FAIL] ALTER 未生效, 相关列缺失将导致运行时 500: %s", msg)


async def init_db():
    async with engine.begin() as conn:
        # SQLite 专属 PRAGMA（PG 上跳过，否则报错）
        if engine.dialect.name == 'sqlite':
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA foreign_keys=ON"))
        await conn.run_sync(Base.metadata.create_all)
        # B+3: nt_ledger 高频查询列索引
    # 轻量迁移：为新列补默认值（create_all 不会给已有表加列）
    async with async_session() as session:
        # T1: CommunityPool 防多行 — 必须在查询前执行，否则旧表无此列会报错
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN singleton BOOLEAN DEFAULT TRUE"))
            await session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_community_pool_singleton ON community_pool(singleton)"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()  # PG: 失败 DDL 会中止事务，必须回滚才能继续
        # R7: 为已有 User 补 token_version（SQLite ALTER TABLE 加列 + 默认值）
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()  # 列已存在则跳过（PG 需回滚恢复事务）
        # G-3: Tenancy.accommodation_due（住宿费日记账累计；存量表补列默认 0）
        try:
            await session.execute(text("ALTER TABLE tenancies ADD COLUMN accommodation_due INTEGER DEFAULT 0"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()  # 列已存在则跳过（PG 需回滚恢复事务）
        # Step 1: 社区资金系统 — reserve/frozen 列
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN reserve INTEGER DEFAULT 0"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()  # PG: 同上，回滚恢复事务
        try:
            await session.execute(text("ALTER TABLE community_pool ADD COLUMN frozen INTEGER DEFAULT 0"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()  # PG: 同上，回滚恢复事务
        from models import CommunityPool, NTLedger, MapLocation
        from nt_helpers import _add_ledger, _ledger_id
        r = await session.execute(select(CommunityPool).limit(1))
        pool = r.scalar_one_or_none()
        if not pool:
            # SSOT-CHAIN: 池子起始值不再写死数字。
            #
            # 原实现 balance=500/total_issued=500 是凭空造币: 链上一分钱没有时,
            # 账上就凭空多出 500, 而 /verify 右边用的是系统自己记的
            # total_issued, 两边同时涨 -> 永远"平", 永远验不出钱是否真存在。
            # 新库一律从 0 开始; 钱只能从链上进来(chain_scanner 认
            # CAPITAL_SOURCES 入社区池), 账上每一分都有链上凭据。
            pool = CommunityPool(balance=0, total_issued=0, task_escrow=0,
                         contribution_pool=0, camp_balance=0, reserve=0, frozen=0,
                         updated_at=datetime.utcnow().isoformat())
            session.add(pool)
            await session.commit()
            logger.info("[SSOT-CHAIN] 新建社区池 balance=0 "
                        "(起始资金须由链上充值入池, 不再凭空发币)")
        # ══ SSOT-CHAIN: 历史充值补录(幂等, MapLocation 持久化去重) ══
        # 下方交易已在链上确认到账多签钱包, 但扫链扫不到:
        # 它们落在扫链游标之前(远超免费节点归档窗口), 永远追不回。
        # 无此补录, 对账会永远显示"链上比账上多"。
        # 去重改用 MapLocation(key="backfill_applied") — 原实现查 NTLedger.tx_hash,
        # 但 soft-reset 会 delete(NTLedger) → 重启后去重失效 → 重复入账。
        # MapLocation 的 key 不以 "seed_"/"presence:" 开头则不被 soft-reset 删除。
        BACKFILL_KEY = "backfill_applied"
        BACKFILL_DEPOSITS = [
            # (tx_hash, amount NT, 说明)
            ("0x1b0a693e3cb9449a79430a4773a22252b1df7166c5e8e06993e9a595e9128918",
             1, "社区资本金补录(2026-07-21 链上区块 154506642)"),
        ]
        _bf_row = (await session.execute(
            select(MapLocation).where(MapLocation.key == BACKFILL_KEY)
        )).scalar_one_or_none()
        _applied = set(json.loads(_bf_row.data)) if (_bf_row and _bf_row.data) else set()
        for _tx, _amt, _why in BACKFILL_DEPOSITS:
            if _tx in _applied:
                continue
            try:
                # 双重去重: MapLocation(主, 存活 soft-reset) + NTLedger(副, 防崩溃半写)
                _dup = (await session.execute(
                    select(NTLedger).where(NTLedger.tx_hash == _tx).limit(1)
                )).scalar_one_or_none()
                if _dup:
                    _applied.add(_tx); continue
                _p = (await session.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
                if _p is None:
                    break
                _p.balance = (_p.balance or 0) + _amt
                _p.reserve = (_p.reserve or 0) + _amt  # 提现额控
                _p.total_issued = (_p.total_issued or 0) + _amt
                _p.updated_at = datetime.utcnow().isoformat()
                await _add_ledger(session, _ledger_id(), None, "community_pool", _amt,
                                  "deposit_capital", _why, status="settled", tx_hash=_tx)
                await session.commit()
                _applied.add(_tx)
                logger.info("[SSOT-CHAIN] 补录历史充值 %s NT tx=%s", _amt, _tx[:18])
            except Exception as _e:
                await session.rollback()
                logger.error("[SSOT-CHAIN] 补录失败 tx=%s: %s", _tx[:18], _e)
        if _applied and _applied != set(t[0] for t in BACKFILL_DEPOSITS if t[0] in _applied):
            # Persist applied set to MapLocation (survives soft-reset)
            _payload = json.dumps(list(_applied))
            if _bf_row:
                _bf_row.data = _payload
            else:
                session.add(MapLocation(key=BACKFILL_KEY, data=_payload))
            await session.commit()

        # Fix 2: 为已有 NTTask 补 assignees 列（多槽位）
        try:
            await session.execute(text("ALTER TABLE nt_tasks ADD COLUMN assignees TEXT"))
            await session.commit()
        except Exception as e:
            logger.debug("迁移跳过: %s", e)
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
        except Exception as _e:
            _log_migration_skip(_e)
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
            except Exception as _e:
                _log_migration_skip(_e)
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
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()
        # ④ User.xp_by_category (Text/JSON)
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN xp_by_category TEXT"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()
        # ② Tenancy.last_active_at (String/DateTime)
        try:
            await session.execute(text("ALTER TABLE tenancies ADD COLUMN last_active_at VARCHAR"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()
        # ══ DB-P0-1: User.last_active_at (Date) ══
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN last_active_at DATE"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()
        # ══ CLEAN-WEEKLY-BE ③: User.clean_weekly_streak ══
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN clean_weekly_streak INTEGER DEFAULT 0"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()
        # ══ UI-FIX-P2-BE补 B7: User.user_settings (JSON) ══
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN user_settings TEXT"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()
        # ══ NEW-USER-TASK-BE: NTTask 加 3 字段 ══
        for _ddl in (
            "ALTER TABLE nt_tasks ADD COLUMN is_newbie_task BOOLEAN DEFAULT FALSE",
            "ALTER TABLE nt_tasks ADD COLUMN assigned_by_system BOOLEAN DEFAULT FALSE",
            "ALTER TABLE nt_tasks ADD COLUMN template_id VARCHAR",
        ):
            try:
                await session.execute(text(_ddl))
                await session.commit()
            except Exception as _e:
                _log_migration_skip(_e)
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
        # ══ DB-P1-3 ①: 删 camp_ledgers 孤儿表（零 API 读写，零数据行）══
        try:
            await session.execute(text("DROP TABLE IF EXISTS camp_ledgers"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()
        # ══ EMPIRICAL-🔴2.3: 建筑种子（从 seed/buildings.json 加载，幂等——空表才播）══
        try:
            from models import MapLocation
            _has_shared = (await session.execute(
                select(MapLocation).where(MapLocation.key == "shared")
            )).scalar_one_or_none()
            if not _has_shared:
                import json as _json, os as _os
                _seed_path = _os.path.join(_os.path.dirname(__file__), "seed", "buildings.json")
                if _os.path.exists(_seed_path):
                    with open(_seed_path, "r", encoding="utf-8") as _f:
                        _buildings = _json.load(_f)
                    _shared_data = _json.dumps({"buildings": _buildings}, ensure_ascii=False)
                    session.add(MapLocation(key="shared", data=_shared_data))
                    await session.commit()
                    logger.info(f"[EMPIRICAL-🔴2.3] seeded {len(_buildings)} buildings into map_locations.shared")
                else:
                    logger.warning(f"[EMPIRICAL-🔴2.3] seed file not found: {_seed_path}")
            else:
                logger.info("[EMPIRICAL-🔴2.3] map_locations.shared already exists, skip seed")
        except Exception as e:
            logger.warning(f"[EMPIRICAL-🔴2.3] buildings seed skipped: {e}")
            await session.rollback()
        # ══ REDTEAM-B-B6: admin bootstrap 种子（幂等——无 admin 角色才播）══
        # ⚠️ 生产环境必须设 ADMIN_BOOTSTRAP_PASSWORD 环境变量
        try:
            from models import User as _User
            _has_admin = (await session.execute(
                select(_User).where(_User.role == "admin").limit(1)
            )).scalars().first()
            if not _has_admin:
                _seed_dir = os.path.join(os.path.dirname(__file__), "seed")
                _admin_path = os.path.join(_seed_dir, "admin_user.json")
                if os.path.exists(_admin_path):
                    import json as _json
                    with open(_admin_path, "r", encoding="utf-8") as _f:
                        _admin_seed = _json.load(_f)
                    _admin_pwd = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "admin123")
                    _enforce_admin_password_guard()  # C-1: 默认密码守卫（dev 告警 / 非 dev 阻断）
                    _now = datetime.utcnow().isoformat()
                    session.add(_User(
                        id=_admin_seed["id"],
                        password_hash=hash_password(_admin_pwd),
                        role=_admin_seed["role"],
                        wallet_address=_admin_seed.get("wallet_address"),
                        avatar_seed=_admin_seed.get("avatar_seed"),
                        contribution_value=0, experience_value=0,
                        nt_balance=0, trust_score=100,
                        created_at=_now,
                    ))
                    await session.commit()
                    logger.info(f"[REDTEAM-B-B6] seeded admin_bootstrap user (id=admin_bootstrap)")
                else:
                    logger.warning(f"[REDTEAM-B-B6] seed file not found: {_admin_path}")
            else:
                logger.info("[REDTEAM-B-B6] admin already exists, skip bootstrap")
        except Exception as e:
            logger.warning(f"[REDTEAM-B-B6] admin bootstrap skipped: {e}")
            await session.rollback()
        # ══ P3-二营乙: 共享厨房种子（幂等——空表才播；测试环境跳过避免 FK 污染）══
        if not os.getenv("TESTING"):
            try:
                from models import PotluckEvent, PotluckParticipant, KitchenSlot, SharedItem
                _now = datetime.utcnow().isoformat()
                _has_pe = (await session.execute(select(PotluckEvent).limit(1))).scalar_one_or_none()
                if not _has_pe:
                    pe = PotluckEvent(
                        organizer_id="admin_bootstrap", title="周六火锅局",
                        dish="四川麻辣火锅", event_at="2026-08-02T18:00:00",
                        capacity=8, current_count=1, description="周末一起来涮火锅",
                        status="open", created_at=_now,
                    )
                    session.add(pe)
                    await session.flush()
                    session.add(PotluckParticipant(
                        event_id=pe.id, user_id="admin_bootstrap",
                        role="organizer", portion=1, joined_at=_now,
                    ))
                    logger.info("[P3-二营乙] seeded 1 potluck_event + 1 participant")
                _has_ks = (await session.execute(select(KitchenSlot).limit(1))).scalar_one_or_none()
                if not _has_ks:
                    for _sh, _eh, _ps, _st, _gn, _dish in [
                        ("2026-08-02T08:00:00", "2026-08-02T11:00:00", 4, "approved", "李四家", "包饺子"),
                        ("2026-08-02T17:00:00", "2026-08-02T20:00:00", 8, "approved", "火锅局", "四川火锅"),
                        ("2026-08-03T11:30:00", "2026-08-03T13:30:00", 15, "pending", "合作社聚餐", "烧烤"),
                    ]:
                        session.add(KitchenSlot(
                            start_at=_sh, end_at=_eh, capacity=10,
                            booker_id="admin_bootstrap", group_name=_gn, dish=_dish,
                            party_size=_ps, status=_st, created_at=_now,
                        ))
                    logger.info("[P3-二营乙] seeded 3 kitchen_slots")
                _has_si = (await session.execute(select(SharedItem).limit(1))).scalar_one_or_none()
                if not _has_si:
                    for _name, _cat, _loc, _qty, _prod, _exp in [
                        ("牛奶", "food", "fridge", "1L", "2026-07-28", "2026-08-01"),
                        ("鸡蛋", "food", "fridge", "10个", "2026-07-30", "2026-08-05"),
                        ("酱油", "condiment", "cabinet", "500ml", None, None),
                        ("炒锅", "tool", "counter", "1个", None, None),
                        ("辣椒酱", "condiment", "fridge", "200g", "2026-07-15", "2026-09-15"),
                    ]:
                        session.add(SharedItem(
                            name=_name, category=_cat, owner_id="admin_bootstrap",
                            location=_loc, quantity=_qty,
                            produced_at=_prod, expired_at=_exp, created_at=_now,
                        ))
                    logger.info("[P3-二营乙] seeded 5 shared_items")
                await session.commit()
            except Exception as e:
                logger.warning(f"[P3-二营乙] kitchen seed skipped: {e}")
                await session.rollback()
        # ══ W7-NOTIF-1: activity_log 扩字段（通知系统重做）══
        # 幂等迁移：为存量 activity_log 表补 user_id / read_at / actor_id / target 列
        for _ddl in (
            "ALTER TABLE activity_log ADD COLUMN user_id VARCHAR",
            "ALTER TABLE activity_log ADD COLUMN read_at VARCHAR",
            "ALTER TABLE activity_log ADD COLUMN actor_id VARCHAR",
            "ALTER TABLE activity_log ADD COLUMN target VARCHAR",
        ):
            try:
                await session.execute(text(_ddl))
                await session.commit()
            except Exception as _e:
                _log_migration_skip(_e)
                await session.rollback()

        # ══ W7-ID-1a I-6: 事实驱动身份层迁移 ══
        # 1. User.native 列补齐（存量表 ALTER TABLE）
        try:
            await session.execute(text("ALTER TABLE users ADD COLUMN native BOOLEAN DEFAULT FALSE"))
            await session.commit()
        except Exception as _e:
            _log_migration_skip(_e)
            await session.rollback()
        # 2. 存量用户回填 UserTag（幂等——靠联合唯一约束 + grant_tag 幂等）
        try:
            from models import User as _U, UserTag, Tenancy as _T
            from identity import grant_tag, sync_user_role
            _all_users = (await session.execute(select(_U))).scalars().all()
            for _u in _all_users:
                _changed = False
                # role=='npc' → 保守视为本地村民（native=true + npc/native）
                if _u.role == "npc":
                    _u.native = True
                    await grant_tag(session, _u.id, "npc", "native")
                    _changed = True
                # role=='adventurer' → camp_member:legacy（不被任何 revoke 规则匹配）
                elif _u.role == "adventurer":
                    await grant_tag(session, _u.id, "adventurer", "camp_member:legacy")
                    _changed = True
                # role=='builder' → camp_job:legacy
                elif _u.role == "builder":
                    await grant_tag(session, _u.id, "builder", "camp_job:legacy")
                    _changed = True
                # 有 active coop tenancy → local_partner
                _coop_t = (await session.execute(
                    select(_T).where(_T.user_id == _u.id, _T.track == "coop", _T.status == "active")
                )).scalars().first()
                if _coop_t:
                    await grant_tag(session, _u.id, "local_partner", f"tenancy:{_coop_t.id}")
                    _changed = True
                if _changed:
                    await sync_user_role(session, _u)
            await session.commit()
            logger.info("[W7-ID-1a] identity migration applied (%d users scanned)", len(_all_users))
        except Exception as e:
            logger.warning(f"[W7-ID-1a] identity migration skipped: {e}")
            await session.rollback()

    # ══ P0-IDX: 全部迁移/种子完成后，逐条建索引 ══
    # 放在最后是刻意的：轻量迁移的 ALTER 已把新列补齐，此时建索引才不会撞
    # UndefinedColumnError（生产事故②的根因是它排在迁移之前）。
    await _build_indexes()


async def _build_indexes():
    """逐条建索引，单条失败只告警不中断启动。

    设计约束（两次生产事故换来的）：
      · 每条独立事务——PG 上失败的 DDL 会中止整个事务，必须隔离，
        否则第一条失败会连带后面全部失败（SQLite 无此问题，故本地测不出）。
      · 失败仅 logger.warning——索引缺失只让查询变慢，不影响正确性，
        绝不该让整站起不来。与本文件 ALTER 段既有 try/rollback 惯例一致。
    返回 (成功数, 失败列表) 供测试断言。
    """
    ok, failed = 0, []
    for _ddl in _INDEX_DDL:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(_ddl))
            ok += 1
        except Exception as e:
            name = _ddl.split("EXISTS", 1)[-1].strip().split()[0] if "EXISTS" in _ddl else _ddl[:40]
            failed.append((name, str(e).split("\n")[0][:160]))
    if failed:
        logger.warning(
            "[P0-IDX] %d/%d 索引建立成功，%d 条失败（不阻断启动）：",
            ok, len(_INDEX_DDL), len(failed))
        for name, err in failed:
            logger.warning("[P0-IDX]   x %s -> %s", name, err)
    else:
        logger.info("[P0-IDX] %d 条索引全部就位", ok)
    return ok, failed
