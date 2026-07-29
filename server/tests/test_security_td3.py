"""TD-3 回归：安全三件——CSP 头 / Token TTL 15min / python-jose→PyJWT。

覆盖：
  1) CSP 头：任一 HTTP 响应含 Content-Security-Policy，白名单含扫到的三外链域名
  2) Token TTL：ACCESS_TOKEN_EXPIRE_MINUTES == 15；签发 token 的 exp-iat ≈ 15min
  3) PyJWT：底层库为 PyJWT（import jwt），编解码往返正确；过期/非法 token 解码返回 None
"""
import time
import pytest
from datetime import datetime, timedelta

import jwt as _pyjwt
import auth_utils


class TestCSPHeader:
    @pytest.mark.asyncio
    async def test_csp_header_present_and_whitelist(self, client):
        r = await client.get("/api/health")
        assert r.status_code == 200
        csp = r.headers.get("Content-Security-Policy")
        assert csp, "响应缺少 Content-Security-Policy 头"
        # 先扫外链得到的三域名须在白名单
        assert "https://cdn.jsdelivr.net" in csp        # gsap
        assert "https://api.dicebear.com" in csp         # 头像
        assert "https://placehold.co" in csp             # 占位图
        # 默认策略收紧
        assert "default-src 'self'" in csp
        assert "object-src 'none'" in csp
        assert "frame-ancestors 'none'" in csp

    @pytest.mark.asyncio
    async def test_nosniff_still_present(self, client):
        r = await client.get("/api/health")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"


class TestTokenTTL:
    def test_access_ttl_is_15min(self):
        assert auth_utils.ACCESS_TOKEN_EXPIRE_MINUTES == 15

    def test_issued_token_exp_about_15min(self):
        before = datetime.utcnow()
        tok = auth_utils.create_access_token("ttluser", "villager", 0)
        payload = auth_utils.decode_token(tok)
        assert payload is not None
        exp = datetime.utcfromtimestamp(payload["exp"])
        delta_min = (exp - before).total_seconds() / 60
        # 15min ±1min 容差
        assert 14 <= delta_min <= 16, f"access token TTL 应≈15min，实测 {delta_min:.1f}min"


class TestPyJWTMigration:
    def test_backend_lib_is_pyjwt(self):
        # PyJWT 暴露 __version__ 与 PyJWTError；python-jose 无 __version__ 于顶层 jwt
        assert hasattr(_pyjwt, "PyJWTError")
        assert hasattr(_pyjwt, "__version__")

    def test_encode_decode_roundtrip(self):
        tok = auth_utils.create_access_token("alice", "admin", 3)
        d = auth_utils.decode_token(tok)
        assert d["sub"] == "alice"
        assert d["role"] == "admin"
        assert d["type"] == "access"
        assert d["version"] == 3

    def test_invalid_token_returns_none(self):
        assert auth_utils.decode_token("not-a-jwt") is None

    def test_expired_token_returns_none(self):
        payload = {"sub": "x", "type": "access",
                   "exp": datetime.utcnow() - timedelta(minutes=1)}
        expired = _pyjwt.encode(payload, auth_utils.SECRET_KEY, algorithm=auth_utils.ALGORITHM)
        assert auth_utils.decode_token(expired) is None