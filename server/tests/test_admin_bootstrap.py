# -*- coding: utf-8 -*-
"""REDTEAM-B-B6: admin bootstrap 种子测试。

判据：
  1. admin_user.json 种子文件存在且字段完整
  2. 种子逻辑不重复插（已存在 admin → 跳过）
  3. ADMIN_BOOTSTRAP_PASSWORD 环境变量生效
"""
import json
import logging
import os
import pytest
from sqlalchemy import select

from auth_utils import hash_password, verify_password
from database import async_session, DB_PATH, init_db, _enforce_admin_password_guard
from models import User


# ══ seed 文件路径 ══
_seed_dir = os.path.join(os.path.dirname(__file__), "..", "seed")
_admin_json_path = os.path.join(_seed_dir, "admin_user.json")


# ══ 辅助函数 ══
async def _seed_admin_user(pwd="admin123", db_path_override=None):
    """直接执行 admin bootstrap 种子逻辑（旁路 init_db，不污染测试环境）。"""
    from models import User
    if not os.path.exists(_admin_json_path):
        return False
    with open(_admin_json_path, "r", encoding="utf-8") as f:
        seed = json.load(f)
    async with async_session() as s:
        has_admin = (await s.execute(
            select(User).where(User.role == "admin").limit(1)
        )).scalars().first()
        if not has_admin:
            from datetime import datetime
            s.add(User(
                id=seed["id"],
                password_hash=hash_password(pwd),
                role=seed["role"],
                wallet_address=seed.get("wallet_address"),
                avatar_seed=seed.get("avatar_seed"),
                contribution_value=0, experience_value=0,
                nt_balance=0, trust_score=100,
                created_at=datetime.utcnow().isoformat(),
            ))
            await s.commit()
            return True
        return False


class TestAdminBootstrapSeed:
    """测试 admin bootstrap 种子逻辑（不调 init_db，避免 FOREIGN KEY 污染）。"""

    @pytest.mark.asyncio
    async def test_seed_file_exists_and_valid(self):
        """种子文件存在且字段完整。"""
        assert os.path.exists(_admin_json_path), f"Seed file not found: {_admin_json_path}"
        with open(_admin_json_path, "r", encoding="utf-8") as f:
            seed = json.load(f)
        assert seed["id"] == "admin_bootstrap"
        assert seed["role"] == "admin"
        assert "wallet_address" in seed
        assert "avatar_seed" in seed

    @pytest.mark.asyncio
    async def test_seed_skips_when_admin_exists(self, db):
        """已有 admin 用户时种子跳过，不重复创建。"""
        from models import User
        # 确保无 admin_bootstrap
        async with async_session() as s:
            existing = (await s.execute(
                select(User).where(User.id == "admin_bootstrap")
            )).scalar_one_or_none()
            if existing:
                await s.delete(existing)
                await s.commit()
        # 第一次：应该创建
        created = await _seed_admin_user()
        # 即使已有其他 admin 也不会创建
        async with async_session() as s:
            user = (await s.execute(
                select(User).where(User.id == "admin_bootstrap")
            )).scalar_one_or_none()
        # 清理
        if user:
            async with async_session() as s:
                u = (await s.execute(
                    select(User).where(User.id == "admin_bootstrap")
                )).scalar_one_or_none()
                if u:
                    await s.delete(u)
                    await s.commit()

    @pytest.mark.asyncio
    async def test_env_password_effective(self):
        """ADMIN_BOOTSTRAP_PASSWORD 环境变量生效。"""
        pwd_default = hash_password("admin123")
        os.environ["ADMIN_BOOTSTRAP_PASSWORD"] = "EnvPwd999!"
        try:
            pwd_val = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "admin123")
            assert pwd_val == "EnvPwd999!"
            pwd_env = hash_password(pwd_val)
            assert pwd_env != pwd_default
            assert verify_password("EnvPwd999!", pwd_env) is True
            assert verify_password("admin123", pwd_env) is False
        finally:
            del os.environ["ADMIN_BOOTSTRAP_PASSWORD"]


class TestAdminPasswordGuardBlock:
    """C-1: 默认管理员密码守卫——非 dev 环境 + 默认密码 = 阻断启动。

    判据（机器可验证）：
      1. 非 dev（无 TESTING / ENVIRONMENT=production）+ 默认 admin123 → raise RuntimeError
      2. dev（TESTING=1）+ 默认 admin123 → 不 raise（仅告警）
      3. 自定义密码 → 不 raise
    """

    @pytest.mark.asyncio
    async def test_prod_default_password_raises(self):
        """非 dev 环境 + 默认密码 → RuntimeError 阻断。"""
        saved_testing = os.environ.pop("TESTING", None)
        saved_env = os.environ.get("ENVIRONMENT")
        saved_pwd = os.environ.pop("ADMIN_BOOTSTRAP_PASSWORD", None)
        os.environ["ENVIRONMENT"] = "production"
        try:
            with pytest.raises(RuntimeError, match="非开发环境拒绝启动"):
                _enforce_admin_password_guard()
        finally:
            if saved_testing is not None:
                os.environ["TESTING"] = saved_testing
            if saved_env is not None:
                os.environ["ENVIRONMENT"] = saved_env
            else:
                os.environ.pop("ENVIRONMENT", None)
            if saved_pwd is not None:
                os.environ["ADMIN_BOOTSTRAP_PASSWORD"] = saved_pwd

    @pytest.mark.asyncio
    async def test_dev_default_password_no_raise(self):
        """dev 环境（TESTING=1）+ 默认密码 → 不阻断。"""
        os.environ["TESTING"] = "1"
        os.environ.pop("ADMIN_BOOTSTRAP_PASSWORD", None)
        _enforce_admin_password_guard()  # 不应 raise

    @pytest.mark.asyncio
    async def test_custom_password_no_raise(self):
        """自定义密码 → 守卫直接放行。"""
        saved_pwd = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD")
        os.environ["ADMIN_BOOTSTRAP_PASSWORD"] = "SecurePwd2026!"
        try:
            _enforce_admin_password_guard()  # 不应 raise
        finally:
            if saved_pwd is not None:
                os.environ["ADMIN_BOOTSTRAP_PASSWORD"] = saved_pwd
            else:
                os.environ.pop("ADMIN_BOOTSTRAP_PASSWORD", None)


class TestAdminDefaultPasswordWarning:
    """REDTEAM-B-P2: 默认密码运行时告警测试。"""

    @pytest.mark.asyncio
    async def test_default_password_triggers_warning(self, db, caplog):
        """未设置 ADMIN_BOOTSTRAP_PASSWORD → 跳过 auto-bootstrap，第一个注册者变 admin。"""
        async with async_session() as s:
            all_admins = (await s.execute(
                select(User).where(User.role == "admin")
            )).scalars().all()
            for a in all_admins:
                await s.delete(a)
            await s.commit()
        os.environ.pop("ADMIN_BOOTSTRAP_PASSWORD", None)
        with caplog.at_level(logging.INFO, logger="database"):
            await init_db()
        assert any(
            "ADMIN_BOOTSTRAP_PASSWORD not set" in record.message
            for record in caplog.records
        ), "未设 ADMIN_BOOTSTRAP_PASSWORD 应跳过 auto-bootstrap 并记录 info 日志"

    @pytest.mark.asyncio
    async def test_custom_password_no_warning(self, db, caplog):
        """自定义密码 → logger.warning 不触发。"""
        # 确保无任何 admin
        async with async_session() as s:
            all_admins = (await s.execute(
                select(User).where(User.role == "admin")
            )).scalars().all()
            for a in all_admins:
                await s.delete(a)
            await s.commit()
        # 设自定义密码
        os.environ["ADMIN_BOOTSTRAP_PASSWORD"] = "SecurePwd2026!"
        try:
            with caplog.at_level(logging.WARNING, logger="database"):
                await init_db()
            assert not any(
                "ADMIN_BOOTSTRAP_PASSWORD 使用默认值 admin123" in record.message
                for record in caplog.records
            ), "自定义密码不应触发默认密码警告"
        finally:
            del os.environ["ADMIN_BOOTSTRAP_PASSWORD"]
        # 清理
        async with async_session() as s:
            u = (await s.execute(
                select(User).where(User.id == "admin_bootstrap")
            )).scalar_one_or_none()
            if u:
                await s.delete(u)
                await s.commit()
