# -*- coding: utf-8 -*-
"""共享厨房路由 — potluck 接龙 / slots 时段 / items 共享物品。

P3-二营乙：4 表 + 10 端点。
概念厘清：共享厨房 ≠ 订餐（砚仁 18:00+ 原话，铁律级）。
容量规则后端定：≤10 自动 / 11-20 待审 / >20 拒。
"""
import logging
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import PotluckEvent, PotluckParticipant, KitchenSlot, SharedItem
from routes.auth import get_current_user, require_admin, User

logger = logging.getLogger("kitchen")

kitchen_router = APIRouter(prefix="/api/kitchen", tags=["kitchen"])


# ══════════════════════════════════════════════════════
# ① potluck/list — 接龙列表
# ══════════════════════════════════════════════════════

@kitchen_router.get("/potluck/list")
async def potluck_list(status: str = None,
                       user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db),
                       limit: int = 50):
    """GET /api/kitchen/potluck/list — 接龙事件列表。"""
    q = select(PotluckEvent).order_by(PotluckEvent.event_at.desc())
    if status:
        q = q.where(PotluckEvent.status == status)
    result = await db.execute(q.limit(min(limit, 200)))
    events = []
    for e in result.scalars():
        events.append({
            "id": e.id, "title": e.title, "dish": e.dish,
            "event_at": e.event_at, "capacity": e.capacity,
            "current_count": e.current_count, "description": e.description,
            "status": e.status, "organizer_id": e.organizer_id,
            "created_at": e.created_at,
        })
    return {"ok": True, "items": events}


# ══════════════════════════════════════════════════════
# ② potluck/create — 创建接龙
# ══════════════════════════════════════════════════════

class PotluckCreateReq(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    dish: str = Field(min_length=1, max_length=200)
    event_at: str = Field(min_length=10)
    capacity: int = Field(8, ge=1, le=50)
    description: str = ""


@kitchen_router.post("/potluck/create")
async def potluck_create(req: PotluckCreateReq,
                         user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    """POST /api/kitchen/potluck/create — 创建接龙事件。"""
    now = datetime.utcnow().isoformat()
    event = PotluckEvent(
        organizer_id=user.id, title=req.title, dish=req.dish,
        event_at=req.event_at, capacity=req.capacity,
        current_count=1,  # 含发起人
        description=req.description or None,
        status="open", created_at=now,
    )
    db.add(event)
    await db.flush()  # 拿到 autoincrement id
    # 发起人自动加入为 organizer
    db.add(PotluckParticipant(
        event_id=event.id, user_id=user.id, role="organizer",
        portion=1, joined_at=now,
    ))
    await db.commit()
    # 补 participant_id（SQLite autoincrement 在 commit 后才有值）
    # event_id 在 flush 后已可用
    return {"ok": True, "id": event.id}


# ══════════════════════════════════════════════════════
# ③ potluck/join — 报名接龙
# ══════════════════════════════════════════════════════

class PotluckJoinReq(BaseModel):
    event_id: int
    portion: int = Field(1, ge=1, le=20)


@kitchen_router.post("/potluck/join")
async def potluck_join(req: PotluckJoinReq,
                       user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    """POST /api/kitchen/potluck/join — 报名接龙（幂等：重复报名返回已有）。"""
    event = (await db.execute(
        select(PotluckEvent).where(PotluckEvent.id == req.event_id)
    )).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="接龙事件不存在")
    if event.status != "open":
        raise HTTPException(status_code=400, detail=f"接龙已{event.status}，无法报名")
    if event.current_count >= event.capacity:
        raise HTTPException(status_code=400, detail="接龙已满")

    # 幂等检查
    existing = (await db.execute(
        select(PotluckParticipant).where(
            PotluckParticipant.event_id == req.event_id,
            PotluckParticipant.user_id == user.id,
        )
    )).scalar_one_or_none()
    if existing:
        return {"ok": True, "id": existing.id, "already_joined": True}

    now = datetime.utcnow().isoformat()
    p = PotluckParticipant(
        event_id=req.event_id, user_id=user.id, role="participant",
        portion=req.portion, joined_at=now,
    )
    db.add(p)
    event.current_count += 1
    if event.current_count >= event.capacity:
        event.status = "full"
    await db.commit()
    return {"ok": True, "id": p.id, "current_count": event.current_count}


# ══════════════════════════════════════════════════════
# ④ slots/list — 时段列表
# ══════════════════════════════════════════════════════

@kitchen_router.get("/slots/list")
async def slots_list(start_date: str = None,
                     user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db),
                     limit: int = 50):
    """GET /api/kitchen/slots/list — 厨房时段列表。start_date 可选过滤。"""
    q = select(KitchenSlot).order_by(KitchenSlot.start_at.desc())
    if start_date:
        q = q.where(KitchenSlot.start_at >= start_date)
    result = await db.execute(q.limit(min(limit, 200)))
    slots = [{
        "id": s.id, "start_at": s.start_at, "end_at": s.end_at,
        "capacity": s.capacity, "booker_id": s.booker_id,
        "group_name": s.group_name, "dish": s.dish,
        "party_size": s.party_size, "status": s.status,
        "note": s.note, "created_at": s.created_at,
    } for s in result.scalars()]
    return {"ok": True, "items": slots}


# ══════════════════════════════════════════════════════
# ⑤ slots/book — 申请时段（容量规则后端定）
# ══════════════════════════════════════════════════════

class SlotBookReq(BaseModel):
    start_at: str = Field(min_length=10)
    end_at: str = Field(min_length=10)
    group_name: str = ""
    dish: str = ""
    party_size: int = Field(1, ge=1, le=100)
    note: str = ""


@kitchen_router.post("/slots/book")
async def slot_book(req: SlotBookReq,
                    user: User = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    """POST /api/kitchen/slots/book — 申请厨房时段。
    容量规则（后端定）：≤10 自动 approved / 11-20 pending / >20 reject。
    """
    # 容量规则后端定——不让前端判断
    if req.party_size > 20:
        raise HTTPException(status_code=400,
                            detail="超过 20 人上限，请拆分为多个时段申请")

    if req.party_size <= 10:
        status = "approved"
    else:
        status = "pending"

    now = datetime.utcnow().isoformat()
    slot = KitchenSlot(
        start_at=req.start_at, end_at=req.end_at,
        booker_id=user.id, group_name=req.group_name or None,
        dish=req.dish or None, party_size=req.party_size,
        status=status, note=req.note or None, created_at=now,
    )
    db.add(slot)
    await db.commit()
    return {"ok": True, "id": slot.id, "status": status,
            "hint": "已批准" if status == "approved" else "已提交，等待管理员审核（11-20人需审核）"}


# ══════════════════════════════════════════════════════
# ⑥ slots/release — 释放时段
# ══════════════════════════════════════════════════════

class SlotReleaseReq(BaseModel):
    slot_id: int


@kitchen_router.post("/slots/release")
async def slot_release(req: SlotReleaseReq,
                       user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    """POST /api/kitchen/slots/release — 释放厨房时段（仅 booker 或 admin）。"""
    slot = (await db.execute(
        select(KitchenSlot).where(KitchenSlot.id == req.slot_id)
    )).scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="时段不存在")
    if slot.booker_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只有预约人或管理员可释放时段")
    if slot.status in ("done", "open"):
        raise HTTPException(status_code=400, detail=f"时段状态为 {slot.status}，无需释放")
    slot.status = "open"
    await db.commit()
    return {"ok": True, "slot_id": slot.id}


# ══════════════════════════════════════════════════════
# ⑦ items/list — 共享物品清单
# ══════════════════════════════════════════════════════

@kitchen_router.get("/items/list")
async def items_list(category: str = None,
                     user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db),
                     limit: int = 100):
    """GET /api/kitchen/items/list — 共享物品清单。
    业务规则：3 天内过期的标记 expired_soon=true（前端高亮红）。
    """
    q = select(SharedItem).order_by(SharedItem.created_at.desc())
    if category:
        q = q.where(SharedItem.category == category)
    result = await db.execute(q.limit(min(limit, 500)))

    today = date.today()
    items = []
    for it in result.scalars():
        expired_soon = False
        is_expired = False
        if it.expired_at:
            try:
                exp_date = date.fromisoformat(it.expired_at[:10])
                days_left = (exp_date - today).days
                if days_left < 0:
                    is_expired = True
                elif days_left <= 3:
                    expired_soon = True
            except (ValueError, TypeError):
                pass
        items.append({
            "id": it.id, "name": it.name, "category": it.category,
            "owner_id": it.owner_id, "location": it.location,
            "quantity": it.quantity, "produced_at": it.produced_at,
            "expired_at": it.expired_at, "note": it.note,
            "expired_soon": expired_soon, "is_expired": is_expired,
            "created_at": it.created_at,
        })
    return {"ok": True, "items": items}


# ══════════════════════════════════════════════════════
# ⑧ items/add — 放入物品
# ══════════════════════════════════════════════════════

class ItemAddReq(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = "food"
    location: str = "fridge"
    quantity: str = ""
    produced_at: str = ""
    expired_at: str = ""
    note: str = ""


@kitchen_router.post("/items/add")
async def item_add(req: ItemAddReq,
                   user: User = Depends(get_current_user),
                   db: AsyncSession = Depends(get_db)):
    """POST /api/kitchen/items/add — 放入共享物品。"""
    now = datetime.utcnow().isoformat()
    item = SharedItem(
        name=req.name, category=req.category,
        owner_id=user.id, location=req.location,
        quantity=req.quantity or None,
        produced_at=req.produced_at or None,
        expired_at=req.expired_at or None,
        note=req.note or None, created_at=now,
    )
    db.add(item)
    await db.commit()
    return {"ok": True, "id": item.id}


# ══════════════════════════════════════════════════════
# ⑨ items/take — 取出物品
# ══════════════════════════════════════════════════════

class ItemTakeReq(BaseModel):
    item_id: int
    quantity: str = ""  # 取出数量（可选，空=全部取出→标记 done）


@kitchen_router.post("/items/take")
async def item_take(req: ItemTakeReq,
                    user: User = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    """POST /api/kitchen/items/take — 取出共享物品（消耗减量）。"""
    item = (await db.execute(
        select(SharedItem).where(SharedItem.id == req.item_id)
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="物品不存在")
    # 取出操作：若未指定数量则视为全部取出（记录 note）
    if not req.quantity:
        item.note = (item.note or "") + f"\n[{datetime.utcnow().isoformat()[:16]}] {user.id} 全部取出"
    else:
        item.note = (item.note or "") + f"\n[{datetime.utcnow().isoformat()[:16]}] {user.id} 取出 {req.quantity}"
    await db.commit()
    return {"ok": True, "item_id": item.id, "remaining": item.quantity}


# ══════════════════════════════════════════════════════
# ⑩ items/{id} DELETE — 移除物品（owner/admin）
# ══════════════════════════════════════════════════════

@kitchen_router.delete("/items/{item_id}")
async def item_delete(item_id: int,
                      user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    """DELETE /api/kitchen/items/{id} — 移除共享物品（仅 owner 或 admin）。"""
    item = (await db.execute(
        select(SharedItem).where(SharedItem.id == item_id)
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="物品不存在")
    if item.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只有物主或管理员可移除物品")
    await db.delete(item)
    await db.commit()
    return {"ok": True, "deleted_id": item_id}
