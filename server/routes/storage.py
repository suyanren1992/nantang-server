# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE: 储物管理——增/查/删（B2/B3/B4）。"""
import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from database import get_db
from models import User, StorageItem, STORAGE_CATEGORIES, STORAGE_LOCATIONS
from routes.auth import get_current_user
from permissions import require_coop_resource, is_admin

router = APIRouter(prefix="/api/storage", tags=["storage"])


# ══ Pydantic 请求体 ══
class CreateItemReq(BaseModel):
    item_name: str = Field(min_length=1, max_length=100)
    category: str
    quantity: int = Field(default=1, ge=1)
    storage_location: str
    expires_at: str | None = None   # 可选过期时间 ISO


# ══ B2: POST /items — 新增储物 ══
@router.post("/items")
async def create_item(req: CreateItemReq,
                      user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    """村民新增一条储物记录。"""
    # enum 校验
    if req.category not in STORAGE_CATEGORIES:
        raise HTTPException(status_code=400,
                            detail=f"category 必须在 {STORAGE_CATEGORIES} 内")
    if req.storage_location not in STORAGE_LOCATIONS:
        raise HTTPException(status_code=400,
                            detail=f"storage_location 必须在 {STORAGE_LOCATIONS} 内")

    now = datetime.utcnow()
    item_id = f"si_{user.id}_{int(now.timestamp())}_{time.monotonic_ns() % 10000}"
    item = StorageItem(
        id=item_id,
        user_id=user.id,
        item_name=req.item_name,
        category=req.category,
        quantity=req.quantity,
        storage_location=req.storage_location,
        added_at=now.isoformat(),
        expires_at=req.expires_at,
    )
    db.add(item)
    await db.commit()
    return {"ok": True, "item": _item_dict(item)}


# ══ B3: GET /items — 查本人储物（按 location 分组，过滤过期） ══
@router.get("/items")
async def list_items(user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    """返回当前用户所有未过期储物，按 storage_location 分组。"""
    now_iso = datetime.utcnow().isoformat()
    q = select(StorageItem).where(StorageItem.user_id == user.id)
    result = await db.execute(q)
    items = result.scalars().all()

    groups: dict[str, list] = {loc: [] for loc in STORAGE_LOCATIONS}
    for item in items:
        # 过滤过期：expires_at 非空且 <= now → 跳过
        if item.expires_at and item.expires_at <= now_iso:
            continue
        loc = item.storage_location
        if loc not in groups:
            groups[loc] = []
        groups[loc].append(_item_dict(item))

    return {"ok": True, "items": groups}


# ══ B4: DELETE /items/{item_id} — 删储物（本人 OR admin） ══
@router.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: str,
                      user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    """删除一条储物记录。仅本人或 admin 可操作。"""
    r = await db.execute(
        select(StorageItem).where(StorageItem.id == item_id)
    )
    item = r.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="储物记录不存在")

    # 权限：走合作社物资闸门 + 本人判断
    await require_coop_resource(user, db)
    if item.user_id != user.id and not is_admin(user):
        raise HTTPException(status_code=403, detail="只能删除自己的储物")

    await db.delete(item)
    await db.commit()
    return None  # 204 No Content


# ══ 序列化 helper ══
def _item_dict(item: StorageItem) -> dict:
    return {
        "id": item.id,
        "user_id": item.user_id,
        "item_name": item.item_name,
        "category": item.category,
        "quantity": item.quantity,
        "storage_location": item.storage_location,
        "added_at": item.added_at,
        "expires_at": item.expires_at,
    }
