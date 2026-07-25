"""Shared pytest fixtures: async engine against a temporary SQLite DB + httpx AsyncClient."""
import os
import sys
import asyncio
import tempfile
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

from database import engine, async_session, init_db, Base  # noqa: E402
from main import app  # noqa: E402


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
