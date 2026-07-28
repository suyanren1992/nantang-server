"""D-2/D-3/D-4 回归：注册邀请码 / 用户名白名单 / 登录防枚举 / LIKE 通配符。"""
import os
import pytest
from httpx import AsyncClient

from auth_utils import hash_password
from database import async_session
from models import User


# ----- 辅助：直接写库造用户，绕开注册流 -----
# 注意：User.id = 用户名字符串（是主键，没有独立 user_id）
async def _create_user(name, password="Passw0rd!", role="villager"):
    async with async_session() as s:
        u = User(id=name, password_hash=hash_password(password), role=role)
        s.add(u)
        await s.commit()
        return name


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ===== D-3 回归：邀请码校验 =====
class TestInviteCode:
    @pytest.mark.asyncio
    async def test_invite_valid(self, client, monkeypatch):
        monkeypatch.setenv("INVITE_CODES", "NT-TEST123,ABC")
        r = await client.post("/api/auth/register", json={
            "name": "邀请测试", "password": "Passw0rd!", "invite_code": "NT-TEST123"
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True

    @pytest.mark.asyncio
    async def test_invite_invalid_rejected(self, client, monkeypatch):
        monkeypatch.setenv("INVITE_CODES", "NT-TEST123")
        r = await client.post("/api/auth/register", json={
            "name": "坏码用户", "password": "Passw0rd!", "invite_code": "WRONG"
        })
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False
        assert "邀请码" in body["error"]

    @pytest.mark.asyncio
    async def test_invite_disabled_allows_any(self, client, monkeypatch):
        monkeypatch.delenv("INVITE_CODES", raising=False)
        r = await client.post("/api/auth/register", json={
            "name": "无码用户", "password": "Passw0rd!", "invite_code": ""
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ===== D-3 回归：登录错误文案统一防枚举 =====
class TestLoginEnumeration:
    @pytest.mark.asyncio
    async def test_nonexistent_user_message(self, client):
        r = await client.post("/api/auth/login", json={"name": "nobody_x", "password": "x"})
        assert r.json()["ok"] is False
        assert r.json()["error"] == "用户名或密码错误"

    @pytest.mark.asyncio
    async def test_wrong_password_same_message(self, client):
        await _create_user("存在的人_y", "correct-horse")
        r = await client.post("/api/auth/login", json={"name": "存在的人_y", "password": "wrong"})
        assert r.json()["ok"] is False
        assert r.json()["error"] == "用户名或密码错误"


# ===== D-4 回归：用户名白名单 =====
class TestUsernameWhitelist:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("bad_name", ["%", "%%", "a;b", "a b", "evil'name", "<script>"])
    async def test_special_chars_rejected(self, client, bad_name, monkeypatch):
        monkeypatch.delenv("INVITE_CODES", raising=False)
        r = await client.post("/api/auth/register", json={"name": bad_name, "password": "Passw0rd!"})
        assert r.json()["ok"] is False
        assert "用户名仅限" in r.json()["error"]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("good_name", ["张三_z", "wang_wu_z", "TestUser123z", "李四_2z"])
    async def test_valid_names_accepted(self, client, good_name, monkeypatch):
        monkeypatch.delenv("INVITE_CODES", raising=False)
        r = await client.post("/api/auth/register", json={"name": good_name, "password": "Passw0rd!"})
        assert r.json()["ok"] is True, r.json()


# ===== D-4 回归：LIKE 通配符不返回全量 =====
class TestLikeWildcard:
    @pytest.mark.asyncio
    async def test_percent_user_cannot_see_others_tasks(self, client):
        await _create_user("alice_w")
        await _create_user("bob_w")
        # 恶意用户直接写库（绕白名单）模拟存量 % 账号
        async with async_session() as s:
            s.add(User(id="%", password_hash=hash_password("Passw0rd!")))
            await s.commit()
        r = await client.post("/api/auth/login", json={"name": "alice_w", "password": "Passw0rd!"})
        alice_tok = r.json()["token"]
        r = await client.post("/api/auth/login", json={"name": "%", "password": "Passw0rd!"})
        evil_tok = r.json()["token"]
        # GET /api/tasks（不是 /api/tasks/list，那是 nt 路由下的；这里是 tasks.py 根 GET）
        r = await client.get("/api/tasks", headers=_h(evil_tok))
        assert r.status_code == 200
        serialized = str(r.json())
        assert "alice_w" not in serialized
        assert "bob_w" not in serialized

    @pytest.mark.asyncio
    async def test_underscore_user_sees_own_tasks(self, client):
        """方案A：下划线转义后 LIKE 正确匹配合法用户名，不丢字。"""
        import json, uuid
        from models import NTTask
        await _create_user("user_x")
        r = await client.post("/api/auth/login", json={"name": "user_x", "password": "Passw0rd!"})
        tok = r.json()["token"]
        tid = f"task_{uuid.uuid4().hex[:8]}"
        # 直接写库造任务：user_x 在 assignees JSON 数组中
        async with async_session() as s:
            t = NTTask(id=tid, poster="other_guy", title="测试下划线用户可见",
                       assignees=json.dumps(["user_x"], ensure_ascii=False),
                       status="open", reward=5)
            s.add(t)
            await s.commit()
        # user_x 查任务——assignees LIKE 应命中
        r = await client.get("/api/tasks", headers=_h(tok))
        assert r.status_code == 200
        task_ids = [t["id"] for t in r.json()] if isinstance(r.json(), list) else []
        assert tid in task_ids, f"下划线用户 user_x 应能看到自己的任务，got={task_ids}"

    @pytest.mark.asyncio
    async def test_underscore_not_wildcard_leak(self, client):
        """方案A：下划线转义后 _ 不匹配任意单字符，不泄其他用户任务。"""
        import json, uuid
        from models import NTTask
        await _create_user("u1_x")
        await _create_user("u2_x")
        r = await client.post("/api/auth/login", json={"name": "u1_x", "password": "Passw0rd!"})
        tok1 = r.json()["token"]
        tid = f"task_{uuid.uuid4().hex[:8]}"
        async with async_session() as s:
            t = NTTask(id=tid, poster="other_guy", title="u2_x 专属任务",
                       assignees=json.dumps(["u2_x"], ensure_ascii=False),
                       status="open", reward=5)
            s.add(t)
            await s.commit()
        # u1_x 查任务——不应看到仅 u2_x 的任务（_ 不是 LIKE 单字符通配）
        r = await client.get("/api/tasks", headers=_h(tok1))
        assert r.status_code == 200
        task_ids = [t["id"] for t in r.json()] if isinstance(r.json(), list) else []
        assert tid not in task_ids, f"u1_x 不应看到 u2_x 的任务，got={task_ids}"
