"""A-13 核验：governance API 404——体检报告称 governance 端点 404，
经勘察 main.py:111 已 include_router(governance.router)，且 governance.py
定义了 prefix='/api/governance' 的 check_proposal_right / check_vote_right 端点。
原始根因是 uvicorn 未重启（旧进程无新路由），现已修复。
此测试锁路由注册不被误删。"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestGovernanceRouteRegistered:
    """A-13: 直接发 HTTP 请求断路由存在（非 404 即路由已注册）。"""

    def test_check_proposal_right_not_404(self):
        """GET /api/governance/check_proposal_right 非 404。
        无 token 可能返回 401/403，但不应返回 404（路由不存在）。"""
        resp = client.get("/api/governance/check_proposal_right")
        assert resp.status_code != 404, (
            f"governance 路由不存在！status={resp.status_code}, body={resp.text[:200]}"
        )

    def test_check_vote_right_not_404(self):
        """GET /api/governance/check_vote_right 非 404。"""
        resp = client.get("/api/governance/check_vote_right")
        assert resp.status_code != 404, (
            f"governance 路由不存在！status={resp.status_code}, body={resp.text[:200]}"
        )

    def test_governance_prefix_registered(self):
        """/api/governance 前缀下有端点响应（非全 404）。"""
        resp = client.get("/api/governance/check_proposal_right")
        # 路由存在 → 要么鉴权失败(401/403) 要么返回数据(200)
        assert resp.status_code in (200, 401, 403, 422), (
            f"非预期的响应码：{resp.status_code}"
        )
