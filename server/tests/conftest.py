"""Shared pytest fixtures: async engine against a temporary SQLite DB + httpx AsyncClient."""
import os
import asyncio
import tempfile
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# 强制 SQLite 内存库 + 临时路径，避免碰到开发库
# 设置在 import server.* 之前，确保 database 模块读到测试 URL
_TMP_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_TMP_DB.close()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP_DB.name}"
# 测试时关闭链扫描器和 cron，避免后台任务捣乱
os.environ["TESTING"] = "1"

from server.database import engine, async_session, init_db, Base  # noqa: E402
from server.main import app  # noqa: E402


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped loop so the engine stays alive across all async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def _setup_db():
    """Create tables once per session; drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    Path(_TMP_DB.name).unlink(missing_ok=True)


@pytest_asyncio.fixture
async def db(_setup_db):
    """Fresh session per test; tests can mutate freely without rollback coupling."""
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(_setup_db):
    """httpx AsyncClient wired straight to the FastAPI ASGI app (no network)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
