# -*- coding: utf-8 -*-
"""W7-ITEM-1: 物品一套表 CRUD——列表/放入/修改/移除/确认。

空间孪生物品栏真源。替代旧 StorageItem + SharedItem 两表。
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from database import get_db
from models import User, Item, ITEM_CATEGORIES, ITEM_STATES, FOOD_CATEGORIES
from routes.auth import get_current_user

router = APIRouter(prefix="/api/items", tags=["items"])


# ══ Pydantic 请求体 ══
class CreateItemReq(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=50)
    location_id: str = Field(min_length=1)
    owner_id: str | None = None       # NULL=公用
    quantity: str = "1"
    expiration: str | None = None     # ISO date，可空
    notes: str | None = None


class UpdateItemReq(BaseModel):
    name: str | None = None
    category: str | None = None
    location_id: str | None = None
    owner_id: str | None = None
    quantity: str | None = None
    expiration: str | None = None
    state: str | None = None
    notes: str | None = None


# ══ GET / — 物品列表（多条件筛选）══
@router.get("")
async def list_items(
    location_id: str | None = Query(None),
    category: str | None = Query(None),
    owner: str | None = Query(None),
    state: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拉物品列表，支持按房间/类别/物主/状态筛选。"""
    q = select(Item)
    if location_id is not None:
        q = q.where(Item.location_id == location_id)
    if category is not None:
        q = q.where(Item.category == category)
    if owner is not None:
        q = q.where(Item.owner_id == owner)
    if state is not None:
        q = q.where(Item.state == state)
    q = q.order_by(Item.id.desc())
    r = await db.execute(q)
    items = [_item_dict(it) for it in r.scalars()]
    return {"ok": True, "items": items, "total": len(items)}


# ══ POST / — 放入物品 ══
@router.post("")
async def create_item(
    req: CreateItemReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """放入一件物品。食物类未填保质期 → 返回 suggestion。"""
    now = datetime.utcnow().isoformat()

    item = Item(
        name=req.name,
        category=req.category,
        location_id=req.location_id,
        owner_id=req.owner_id if req.owner_id else user.id,
        put_by=user.id,
        quantity=req.quantity,
        expiration=req.expiration,
        state="active",
        notes=req.notes,
        last_confirmed=now,
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    resp: dict = {"ok": True, "item": _item_dict(item)}

    # ══ ITEM-D: 食物类未填保质期 → 返回 suggestion，不强拦 ══
    if req.category in FOOD_CATEGORIES and not req.expiration:
        resp["suggestion"] = "建议填写保质期"

    return resp


# ══ PUT /{item_id} — 修改物品 ══
@router.put("/{item_id}")
async def update_item(
    item_id: int,
    req: UpdateItemReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改物品字段。仅物主或 admin 可操作。"""
    item = await _get_item_or_404(item_id, db)

    if item.owner_id and item.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能修改自己的物品")

    # 逐字段更新（只更新传入的非 None 字段）
    updates = req.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(item, field, value)
    item.updated_at = datetime.utcnow().isoformat()

    await db.commit()
    await db.refresh(item)
    return {"ok": True, "item": _item_dict(item)}


# ══ DELETE /{item_id} — 移除物品 ══
@router.delete("/{item_id}")
async def delete_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """移除物品。仅物主或 admin 可操作。"""
    item = await _get_item_or_404(item_id, db)

    if item.owner_id and item.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能移除自己的物品")

    await db.delete(item)
    await db.commit()
    return {"ok": True, "detail": "已移除"}


# ══ POST /{item_id}/confirm — 标记「还在」══
@router.post("/{item_id}/confirm")
async def confirm_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """刷新 last_confirmed，标记物品仍在原位。仅物主可操作。"""
    item = await _get_item_or_404(item_id, db)

    if item.owner_id and item.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能确认自己的物品")

    now = datetime.utcnow().isoformat()
    item.last_confirmed = now
    item.updated_at = now
    await db.commit()
    await db.refresh(item)
    return {"ok": True, "item": _item_dict(item)}


# ══ Helpers ══
async def _get_item_or_404(item_id: int, db: AsyncSession) -> Item:
    r = await db.execute(select(Item).where(Item.id == item_id))
    item = r.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="物品不存在")
    return item


def _item_dict(it: Item) -> dict:
    return {
        "id": it.id,
        "name": it.name,
        "category": it.category,
        "location_id": it.location_id,
        "owner_id": it.owner_id,
        "put_by": it.put_by,
        "quantity": it.quantity,
        "expiration": it.expiration,
        "state": it.state,
        "listed_to": it.listed_to,
        "listing_id": it.listing_id,
        "notes": it.notes,
        "last_confirmed": it.last_confirmed,
        "created_at": it.created_at,
        "updated_at": it.updated_at,
    }
