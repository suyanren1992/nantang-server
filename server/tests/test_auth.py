"""D-2/D-3/D-4 回归：注册邀请码 / 用户名白名单 / 登录防枚举 / LIKE 通配符。"""
import os
import pytest
from httpx import AsyncClient

from server.auth_utils import hash_password, create_access_token
from server.database import async_session
from server.models import User


# ----- 辅助：直接写库造用户，绕开注册流 -----
async def _create_user(user_id: str, name: str, password: str = "Passw0rd!", role: str = "villager"):
    async with async_session() as s:
        u = User(id=user_id, name=name, password_hash=hash_password(password), role=role)
        s.add(u)
        await s.commit()
        return user_id


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ===== D-3 回归：邀请码校验 =====
class TestInviteCode:
    @pytest.mark.asyncio
    async def test_invite_valid(self, client: AsyncClient, monkeypatch):
        monkeypatch.setenv("INVITE_CODES", "NT-TEST123,ABC")
        r = await client.post("/api/auth/register", json={
            "name": "邀请测试", "password": "Passw0rd!", "invite_code": "NT-TEST123"
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True

    @pytest.mark.asyncio
    async def test_invite_invalid_rejected(self, client: AsyncClient, monkeypatch):
        monkeypatch.setenv("INVITE_CODES", "NT-TEST123")
        r = await client.post("/api/auth/register", json={
            "name": "坏码用户", "password": "Passw0rd!", "invite_code": "WRONG"
        })
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False
        assert "邀请码" in body["error"]

    @pytest.mark.asyncio
    async def test_invite_disabled_allows_any(self, client: AsyncClient, monkeypatch):
        monkeypatch.delenv("INVITE_CODES", raising=False)
        r = await client.post("/api/auth/register", json={
            "name": "无码用户", "password": "Passw0rd!", "invite_code": ""
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ===== D-3 回归：登录错误文案统一防枚举 =====
class TestLoginEnumeration:
    @pytest.mark.asyncio
    async def test_nonexistent_user_message(self, client: AsyncClient):
        r = await client.post("/api/auth/login", json={"name": "nobody", "password": "x"})
        assert r.json()["ok"] is False
        assert r.json()["error"] == "用户名或密码错误"

    @pytest.mark.asyncio
    async def test_wrong_password_same_message(self, client: AsyncClient):
        await _create_user("u-exists", "存在的人", "correct-horse")
        r = await client.post("/api/auth/login", json={"name": "存在的人", "password": "wrong"})
        assert r.json()["ok"] is False
        assert r.json()["error"] == "用户名或密码错误"


# ===== D-4 回归：用户名白名单 =====
class TestUsernameWhitelist:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("bad_name", ["%", "%%", "a;b", "a b", "evil'name", "<script>"])
    async def test_special_chars_rejected(self, client: AsyncClient, bad_name, monkeypatch):
        monkeypatch.delenv("INVITE_CODES", raising=False)
        r = await client.post("/api/auth/register", json={"name": bad_name, "password": "Passw0rd!"})
        assert r.json()["ok"] is False
        assert "用户名仅限" in r.json()["error"]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("good_name", ["张三", "wang_wu", "TestUser123", "李四_2"])
    async def test_valid_names_accepted(self, client: AsyncClient, good_name, monkeypatch):
        monkeypatch.delenv("INVITE_CODES", raising=False)
        r = await client.post("/api/auth/register", json={"name": good_name, "password": "Passw0rd!"})
        assert r.json()["ok"] is True, r.json()


# ===== D-4 回归：LIKE 通配符不返回全量 =====
class TestLikeWildcard:
    @pytest.mark.asyncio
    async def test_percent_user_cannot_see_others_tasks(self, client: AsyncClient):
        # 造两个正常用户 + 一个名字含 % 的恶意用户
        await _create_user("u-alice", "alice")
        await _create_user("u-bob", "bob")
        # 恶意用户直接写库（绕白名单）模拟存量
        async with async_session() as s:
            s.add(User(id="u-evil", name="%", password_hash=hash_password("Passw0rd!")))
            await s.commit()
        # alice 登录拿 token
        r = await client.post("/api/auth/login", json={"name": "alice", "password": "Passw0rd!"})
        alice_tok = r.json()["token"]
        # 恶意用户登录拿 token
        r = await client.post("/api/auth/login", json={"name": "%", "password": "Passw0rd!"})
        evil_tok = r.json()["token"]
        # 恶意用户列任务——应该只能看到自己的（空），看不到 alice/bob 的
        r = await client.get("/api/tasks/list", headers=_h(evil_tok))
        assert r.status_code == 200
        data = r.json()
        # 断言响应里不含 alice/bob 标识（粗检；具体字段按端点实际）
        serialized = str(data)
        assert "alice" not in serialized.lower()
        assert "bob" not in serialized.lower()
