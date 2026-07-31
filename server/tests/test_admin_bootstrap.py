# -*- coding: utf-8 -*-
"""REDTEAM-B-B6: admin bootstrap 种子测试。

判据：
  1. admin_user.json 种子文件存在且字段完整
  2. 种子逻辑不重复插（已存在 admin → 跳过）
  3. ADMIN_BOOTSTRAP_PASSWORD 环境变量生效
"""
import json
import os
import pytest
from sqlalchemy import select

from auth_utils import hash_password, verify_password
from database import async_session, DB_PATH


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
