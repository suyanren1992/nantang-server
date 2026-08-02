"""Shared pytest fixtures: async engine against a temporary SQLite DB + httpx AsyncClient."""
import os
import sys
import asyncio
import tempfile
import warnings
from pathlib import Path

# 把 server/ 目录加到 sys.path，这样测试里能直接 `from database import ...`
_SERVER_DIR = Path(__file__).resolve().parent.parent
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))

import pytest
import pytest_asyncio
from sqlalchemy import text, event
from sqlalchemy.exc import OperationalError
from httpx import AsyncClient, ASGITransport

_TMP_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_TMP_DB.close()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP_DB.name}"
os.environ["TESTING"] = "1"

# ══ K-2: SQLite 行级锁无效警告 ══
_SQLITE_WARNING = (
    "SQLite 方言：with_for_update() / populate_existing 行级锁在 SQLite 上静默无效。\n"
    "  并发锁测试（test_pg_locks.py）仅在 PostgreSQL 上运行——设置 PG_DATABASE_URL 以启用。\n"
    "  SQLite 单写者锁可能掩盖锁序错/漏锁——见到此警告即代表未在真 PG 上验证锁正确性。"
)
warnings.warn(_SQLITE_WARNING, UserWarning)

from database import engine, async_session, init_db, Base  # noqa: E402
from main import app  # noqa: E402

# ══ FK ON：与生产 database.py:81 同构 ══
# SQLite 默认 FK=OFF；connect 事件在每连接创建时显式开启，保证外键约束在测试中真生效。
# _isolate_db 清表已使用 reversed(sorted_tables) 逆序 DELETE，FK ON 下安全。
@event.listens_for(engine.sync_engine, "connect")
def _set_fk_on(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ══ K-2: requires_pg marker — 无 PG 连接串时 skip ══
def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "requires_pg: 需要 PostgreSQL（设置 PG_DATABASE_URL 环境变量）——行级锁仅在 PG 上真生效",
    )


def pytest_collection_modifyitems(config, items):
    """无 PG_DATABASE_URL 时自动 skip 所有 requires_pg 标记的测试。"""
    pg_url = os.environ.get("PG_DATABASE_URL", "")
    has_pg = bool(pg_url and pg_url.startswith("postgres"))
    if has_pg:
        return
    skip_pg = pytest.mark.skip(reason="需要 PostgreSQL（设置 PG_DATABASE_URL 环境变量）")
    for item in items:
        if "requires_pg" in item.keywords:
            item.add_marker(skip_pg)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def _setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # 种子基线（不调 init_db：其 PRAGMA foreign_keys=ON 会污染连接池，导致测试中
    # 合法的松散 FK 引用报错；且其 ALTER/索引为存量库补列，新库 create_all 已建全 schema）。
    await _reseed_baseline()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    Path(_TMP_DB.name).unlink(missing_ok=True)


async def _reseed_baseline():
    """轻量重种 init_db 的种子基线（跳过 DDL，只重种数据行）。

    与 _isolate_db 清表配合：清表后把 community_pool(500)/inn_rooms/
    new_user_task_templates/admin_bootstrap/buildings 种回。models 已完整定义
    所有运行时列，session setup 的 create_all 即建出全 schema，此处只补数据，
    不重跑 init_db 的 DDL（ALTER/索引）以免拖慢全量。
    种子逻辑与 database.init_db 保持一致。
    """
    from datetime import datetime
    import json as _json
    from sqlalchemy import select
    from database import async_session
    from models import (
        CommunityPool, NTLedger, InnRoom, NewUserTaskTemplate,
        MapLocation, User as _User,
    )
    from nt_helpers import _add_ledger, _ledger_id
    from auth_utils import hash_password
    _now = datetime.utcnow().isoformat()
    _seed_dir = _SERVER_DIR / "seed"
    async with async_session() as s:
        # 1. CommunityPool 500 起始 + pool_init 账
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if not pool:
            s.add(CommunityPool(balance=500, total_issued=500, task_escrow=0,
                                contribution_pool=0, camp_balance=0,
                                reserve=0, frozen=0, updated_at=_now))
            await _add_ledger(s, _ledger_id(), "system", "community_pool", 500,
                              "pool_init", "社区池初始化", status="settled")
        # 2. 素社 InnRoom ×6
        if not (await s.execute(select(InnRoom).limit(1))).scalar_one_or_none():
            for _rid, _label, _rtype, _beds, _rate in [
                ("mei", "梅·单人间", "single", 1, 40),
                ("lan", "兰·单人间", "single", 1, 40),
                ("zhu", "竹·单人间", "single", 1, 40),
                ("ju", "菊·单人间", "single", 1, 40),
                ("quadA", "四人间A", "quad", 4, 25),
                ("quadB", "四人间B", "quad", 4, 25),
            ]:
                s.add(InnRoom(id=_rid, label=_label, room_type=_rtype,
                              beds=_beds, rate=_rate, dietary="vegetarian",
                              status="active"))
        # 3. 新人任务模板 ×4
        if not (await s.execute(select(NewUserTaskTemplate).limit(1))).scalar_one_or_none():
            for _tid, _title, _desc, _nt, _role, _order, _exp in [
                ("tpl_meet_neighbor", "认识一下你的邻居", "和一位邻居打个招呼，互相认识一下", 10, "visitor", 1, 7),
                ("tpl_covenant_sign", "浏览公约 + 签到", "阅读社区公约并完成签到", 5, "visitor", 2, 7),
                ("tpl_first_cleanup", "参与第一次大扫除", "参加一次社区大扫除活动", 15, "visitor", 3, 7),
                ("tpl_first_task", "领取你的第一个任务", "从任务板领取并完成一个任务", 20, "npc", 4, 7),
            ]:
                s.add(NewUserTaskTemplate(
                    id=_tid, title=_title, description=_desc, reward_nt=_nt,
                    target_role=_role, display_order=_order,
                    expires_days=_exp, created_at=_now,
                ))
        # 4. admin_bootstrap（无 admin 角色用户才播）
        _has_admin = (await s.execute(
            select(_User).where(_User.role == "admin").limit(1)
        )).scalars().first()
        if not _has_admin:
            _admin_path = _seed_dir / "admin_user.json"
            if _admin_path.exists():
                with open(_admin_path, "r", encoding="utf-8") as _f:
                    _admin_seed = _json.load(_f)
                _admin_pwd = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "admin123")
                s.add(_User(
                    id=_admin_seed["id"],
                    password_hash=hash_password(_admin_pwd),
                    role=_admin_seed["role"],
                    wallet_address=_admin_seed.get("wallet_address"),
                    avatar_seed=_admin_seed.get("avatar_seed"),
                    contribution_value=0, experience_value=0,
                    nt_balance=0, trust_score=100, created_at=_now,
                ))
        # 5. buildings 种子（map_locations.shared）
        _has_shared = (await s.execute(
            select(MapLocation).where(MapLocation.key == "shared")
        )).scalar_one_or_none()
        if not _has_shared:
            _seed_path = _seed_dir / "buildings.json"
            if _seed_path.exists():
                with open(_seed_path, "r", encoding="utf-8") as _f:
                    _buildings = _json.load(_f)
                s.add(MapLocation(
                    key="shared",
                    data=_json.dumps({"buildings": _buildings}, ensure_ascii=False),
                ))
        # 6. W7-ITEM-ROOM: 每个房间独立 MapLocation 行（幂等——按 key 存在即跳过）
        _seed_path = _seed_dir / "buildings.json"
        if _seed_path.exists():
            with open(_seed_path, "r", encoding="utf-8") as _f:
                _buildings = _json.load(_f)
            for _b in _buildings:
                for _floor_key, _rooms in (_b.get("floors") or {}).items():
                    for _r in _rooms:
                        _rid = _r.get("id")
                        if not _rid:
                            continue
                        if (await s.execute(
                            select(MapLocation).where(MapLocation.key == _rid)
                        )).scalar_one_or_none():
                            continue
                        s.add(MapLocation(
                            key=_rid,
                            data=_json.dumps({
                                "space_type": _r.get("space_type", "common"),
                                "name": _r.get("name", _rid),
                            }, ensure_ascii=False),
                        ))
                for _p in _b.get("plots") or []:
                    _pid = _p.get("id")
                    if not _pid:
                        continue
                    if (await s.execute(
                        select(MapLocation).where(MapLocation.key == _pid)
                    )).scalar_one_or_none():
                        continue
                    s.add(MapLocation(
                        key=_pid,
                        data=_json.dumps({
                            "space_type": _p.get("space_type", "field"),
                            "name": _p.get("name", _pid),
                        }, ensure_ascii=False),
                    ))
        await s.commit()


@pytest_asyncio.fixture(autouse=True)
async def _isolate_db(_setup_db):
    """每测隔离：测后 FK 逆序清空全表 + 重新 _reseed_baseline 种子。

    只清脏数据会让 community_pool / inn_rooms / admin 等种子一并丢失（client 经
    ASGITransport 不触发 lifespan，init_db 不会被自动重调）。故每测 teardown 先清
    全表，再 _reseed_baseline 把种子基线种回——只重种数据行，不跑 DDL（session
    setup 的 create_all 已建完整 schema），保证每测拿到「干净库 + 种子就位」的基线。
    autouse 覆盖 client（走 app get_db）与 db 两条路径；teardown 在两者之后执行。
    """
    yield
    # W7-TEST-1: dispose 关闭连接池 + 重试（SQLite 串行写者下 dispose 可能未即时释放后台线程锁）
    _max_retries = 3
    for _attempt in range(_max_retries):
        await engine.dispose()
        await asyncio.sleep(0.1 * (_attempt + 1))  # 递增退避：0.1s / 0.2s / 0.3s
        try:
            async with engine.begin() as conn:
                for tbl in reversed(Base.metadata.sorted_tables):
                    await conn.execute(tbl.delete())
                try:
                    await conn.execute(text("DELETE FROM sqlite_sequence"))
                except Exception:
                    pass
            break  # DELETE 成功，跳出重试循环
        except OperationalError as _e:
            if "database is locked" in str(_e) and _attempt < _max_retries - 1:
                continue
            raise
    # 重种 CommunityPool 基线：注册端点无池时建 balance=0 空池，
    # 而社区任务需要非零余额——与 init_db() 种子一致 balance=500。
    from models import CommunityPool as _CP
    async with async_session() as s:
        s.add(_CP(balance=500, total_issued=500, task_escrow=0,
                  contribution_pool=0, camp_balance=0,
                  reserve=0, frozen=0))
        await s.commit()
    # 重新种种子基线（轻量：跳过 DDL，只重种数据）
    await _reseed_baseline()


@pytest_asyncio.fixture
async def db(_setup_db):
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(_setup_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
