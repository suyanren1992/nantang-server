"""P1-2 回归：登录失败内存 IP 限速——连续失败锁定 + 解封恢复。

限速为进程内存态（routes.auth._login_fails），ASGITransport 下所有请求同一 IP key，
故每个用例首尾清零 store，避免跨用例串扰。阈值直接改模块属性（不依赖 import 期 env）。
"""
import time
import pytest

import routes.auth as auth_mod
from auth_utils import hash_password
from database import async_session
from models import User


async def _mkuser(name, password="Passw0rd!"):
    async with async_session() as s:
        s.add(User(id=name, password_hash=hash_password(password)))
        await s.commit()
    return name


@pytest.fixture(autouse=True)
def _reset_limiter():
    """每个用例前后清零限速 store，并保存/还原阈值。"""
    saved_max = auth_mod._LOGIN_FAIL_MAX
    saved_min = auth_mod._LOGIN_LOCK_MINUTES
    auth_mod._login_fails.clear()
    yield
    auth_mod._login_fails.clear()
    auth_mod._LOGIN_FAIL_MAX = saved_max
    auth_mod._LOGIN_LOCK_MINUTES = saved_min


class TestLoginRateLimit:
    @pytest.mark.asyncio
    async def test_lock_after_consecutive_failures(self, client):
        """连错达阈值 → 锁定，后续登录（含正确密码）一律 429。"""
        auth_mod._LOGIN_FAIL_MAX = 3
        auth_mod._LOGIN_LOCK_MINUTES = 15
        await _mkuser("rl_lock_user")

        # 前 3 次错密码：返回统一错误文案，非 429
        for i in range(3):
            r = await client.post("/api/auth/login",
                                   json={"name": "rl_lock_user", "password": "wrong"})
            assert r.status_code == 200, f"第{i+1}次应为普通失败，got {r.status_code}"
            assert r.json()["ok"] is False

        # 第 4 次：即使密码正确也被锁 → 429
        r = await client.post("/api/auth/login",
                               json={"name": "rl_lock_user", "password": "Passw0rd!"})
        assert r.status_code == 429, f"达阈值后应锁定 429，got {r.status_code}"
        assert r.json()["ok"] is False
        assert "次数过多" in r.json()["error"]

    @pytest.mark.asyncio
    async def test_unlock_after_expiry_restores_login(self, client):
        """锁定过期后，正确密码登录恢复成功，且失败计数清零。"""
        auth_mod._LOGIN_FAIL_MAX = 3
        auth_mod._LOGIN_LOCK_MINUTES = 15
        await _mkuser("rl_recover_user")

        for _ in range(3):
            await client.post("/api/auth/login",
                              json={"name": "rl_recover_user", "password": "wrong"})
        # 确认已锁
        r = await client.post("/api/auth/login",
                              json={"name": "rl_recover_user", "password": "Passw0rd!"})
        assert r.status_code == 429

        # 模拟锁定到期：把 lock_until 拨到过去
        assert auth_mod._login_fails, "限速 store 应有记录"
        for rec in auth_mod._login_fails.values():
            rec[1] = time.time() - 1

        # 解封后正确密码登录成功
        r = await client.post("/api/auth/login",
                              json={"name": "rl_recover_user", "password": "Passw0rd!"})
        assert r.status_code == 200, f"解封后应登录成功，got {r.status_code}"
        assert r.json()["ok"] is True

        # 成功登录已清零：store 中该 IP 记录被清除
        assert auth_mod._login_fails == {}, "成功登录后失败计数应清零"

    @pytest.mark.asyncio
    async def test_success_resets_fail_count(self, client):
        """未达阈值时成功登录 → 清零，之后可再次容错。"""
        auth_mod._LOGIN_FAIL_MAX = 3
        auth_mod._LOGIN_LOCK_MINUTES = 15
        await _mkuser("rl_reset_user")

        # 2 次失败（未达 3）
        for _ in range(2):
            await client.post("/api/auth/login",
                              json={"name": "rl_reset_user", "password": "wrong"})
        # 成功登录清零
        r = await client.post("/api/auth/login",
                              json={"name": "rl_reset_user", "password": "Passw0rd!"})
        assert r.status_code == 200 and r.json()["ok"] is True
        assert auth_mod._login_fails == {}

        # 再连错 2 次仍不锁（说明计数确已清零，未累加到 4）
        for _ in range(2):
            r = await client.post("/api/auth/login",
                                  json={"name": "rl_reset_user", "password": "wrong"})
            assert r.status_code == 200
