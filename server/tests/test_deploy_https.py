# -*- coding: utf-8 -*-
"""H-6: deploy.sh HTTPS / certbot 集成静态校验。

deploy.sh 是 VPS 部署脚本，无法在单测里真实执行（需 root + 公网域名 + nginx）。
改用静态断言：读取 deploy.sh 文本，确认 certbot 步骤与 443/重定向逻辑已落位。
判据（机器可验证）：
  1. apt install 含 certbot + python3-certbot-nginx
  2. 脚本含 certbot --nginx ... --redirect 调用
  3. 脚本设置 ADMIN_BOOTSTRAP_PASSWORD（C-1 守卫要求生产环境必须配）
"""
import os

import pytest

_DEPLOY_SH = os.path.join(os.path.dirname(__file__), "..", "deploy.sh")


def _read_deploy():
    with open(_DEPLOY_SH, "r", encoding="utf-8") as f:
        return f.read()


class TestDeployHttps:
    """H-6: deploy.sh 已集成 certbot + HTTPS。"""

    @pytest.mark.asyncio
    async def test_certbot_in_apt_install(self):
        txt = _read_deploy()
        assert "certbot" in txt, "apt install 应包含 certbot"
        assert "python3-certbot-nginx" in txt, "apt install 应包含 python3-certbot-nginx"

    @pytest.mark.asyncio
    async def test_certbot_redirect_invocation(self):
        txt = _read_deploy()
        assert "certbot --nginx" in txt, "应调用 certbot --nginx 申请证书"
        assert "--redirect" in txt, "certbot 应带 --redirect 自动配置 HTTP→HTTPS 重定向"
        assert "--non-interactive" in txt, "certbot 应非交互模式（CI/无人值守部署）"

    @pytest.mark.asyncio
    async def test_admin_bootstrap_password_set(self):
        """C-1 守卫要求生产环境必须设 ADMIN_BOOTSTRAP_PASSWORD，deploy.sh 须自动生成。"""
        txt = _read_deploy()
        assert "ADMIN_BOOTSTRAP_PASSWORD" in txt, "deploy.sh 须设置 ADMIN_BOOTSTRAP_PASSWORD"
        assert "ENVIRONMENT=production" in txt, "deploy.sh 须标记 ENVIRONMENT=production"
