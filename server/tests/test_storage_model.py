# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE B1: StorageItem 模型测试（3 用例）。

① 建表成功
② 必填字段约束
③ expires_at 过期过滤
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from auth_utils import hash_password
from database import async_session
from models import User, StorageItem


async def _ensure_user(uid="si_model_user"):
    async with async_session() as s:
        exists = (await s.execute(select(User).where(User.id == uid))).scalar_one_or_none()
        if not exists:
            s.add(User(id=uid, password_hash=hash_password("Pw!"), role="villager"))
            await s.commit()


# ══ ① 建表成功 ══
class TestStorageModelCreate:
    @pytest.mark.asyncio
    async def test_create_item_ok(self, _setup_db):
        await _ensure_user("si_model_user")
        async with async_session() as s:
            item = StorageItem(
                id="si_test_001",
                user_id="si_model_user",
                item_name="白菜",
                category="食物",
                quantity=3,
                storage_location="冰箱",
                added_at=datetime.utcnow().isoformat(),
            )
            s.add(item)
            await s.commit()

            result = await s.execute(
                select(StorageItem).where(StorageItem.id == "si_test_001")
            )
            loaded = result.scalar_one()
            assert loaded.item_name == "白菜"
            assert loaded.category == "食物"
            assert loaded.quantity == 3
            assert loaded.storage_location == "冰箱"


# ══ ② 必填字段约束 ══
class TestStorageModelConstraints:
    @pytest.mark.asyncio
    async def test_missing_item_name_raises(self, _setup_db):
        await _ensure_user("si_model_user")
        async with async_session() as s:
            item = StorageItem(
                id="si_test_002",
                user_id="si_model_user",
                item_name=None,           # 必填为 None → IntegrityError
                category="工具",
                quantity=1,
                storage_location="储物间",
                added_at=datetime.utcnow().isoformat(),
            )
            s.add(item)
            with pytest.raises(IntegrityError):
                await s.commit()


# ══ ③ expires_at 过期过滤 ══
class TestStorageModelExpiry:
    @pytest.mark.asyncio
    async def test_expired_items_filtered(self, _setup_db):
        uid = "si_model_expiry_user"
        await _ensure_user(uid)
        now = datetime.utcnow()
        async with async_session() as s:
            # 已过期
            s.add(StorageItem(
                id="si_expired_1", user_id=uid, item_name="过期牛奶",
                category="食物", quantity=1, storage_location="冰箱",
                added_at=now.isoformat(),
                expires_at=(now - timedelta(days=2)).isoformat(),
            ))
            # 未过期
            s.add(StorageItem(
                id="si_fresh_1", user_id=uid, item_name="新鲜苹果",
                category="食物", quantity=2, storage_location="冰箱",
                added_at=now.isoformat(),
                expires_at=(now + timedelta(days=7)).isoformat(),
            ))
            # 不过期
            s.add(StorageItem(
                id="si_no_exp_1", user_id=uid, item_name="扳手",
                category="工具", quantity=1, storage_location="储物间",
                added_at=now.isoformat(), expires_at=None,
            ))
            await s.commit()

            # 模拟 B3 逻辑：拉所有 → 过滤 expires_at <= now
            now_iso = now.isoformat()
            result = await s.execute(
                select(StorageItem).where(StorageItem.user_id == uid)
            )
            items = result.scalars().all()
            non_expired = [
                i for i in items
                if not i.expires_at or i.expires_at > now_iso
            ]
            assert len(non_expired) == 2
            names = {i.item_name for i in non_expired}
            assert "新鲜苹果" in names
            assert "扳手" in names
            assert "过期牛奶" not in names
