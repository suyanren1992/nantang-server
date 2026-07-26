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
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    Path(_TMP_DB.name).unlink(missing_ok=True)


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
