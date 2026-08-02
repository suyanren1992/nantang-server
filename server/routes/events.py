# -*- coding: utf-8 -*-
"""W7-EVENT-1: 空间事情栏——记录/列表/详情 + 三档公开度强制 + activity_log 同步。

空间孪生"事"的对应。每个建筑容器里发生的事，统一在此记录。
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from database import get_db
from models import (
    User, SpaceEvent, ActivityLog,
    EVENT_TYPES, EVENT_VISIBILITIES, EVENT_SYNC_TYPES,
)
from routes.auth import get_current_user

router = APIRouter(prefix="/api/events", tags=["events"])


# ══ 公开度强制规则 ══
# key=type, value=允许的 visibility 集合（None=不接受用户传参，服务端直接定）
_VISIBILITY_RULES = {
    "checkin":   {"public"},          # 强制公开，不接受参数
    "checkout":  {"public"},
    "system":    {"private"},         # 强制私密
    "tip":       set(EVENT_VISIBILITIES),  # 全可选
    "note":      set(EVENT_VISIBILITIES),
}
# 除上述特殊 type 外，默认规则：接受 public / anonymous，拒绝 private
_DEFAULT_ALLOWED = {"public", "anonymous"}


def _resolve_visibility(event_type: str, requested: str | None) -> str:
    """服务端强制公开度——不信任前端传参。

    规则：
      - checkin/checkout → 强制 public（不接受参数）
      - system → 强制 private
      - tip/note → 全可选，默认 public
      - 其他 → public / anonymous 可选，默认 public；传 private 被拒
    """
    allowed = _VISIBILITY_RULES.get(event_type, _DEFAULT_ALLOWED)

    # 该 type 不接受用户传参 → 服务端直定
    if len(allowed) == 1:
        return next(iter(allowed))

    if requested and requested in allowed:
        return requested
    if requested and requested not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"事件类型 '{event_type}' 不允许公开度 '{requested}'，可选: {sorted(allowed)}",
        )
    return "public"


# ══ Pydantic ══
class CreateEventReq(BaseModel):
    type: str = Field(min_length=1, max_length=20)
    location_id: str = Field(min_length=1)
    text: str = Field(min_length=1, max_length=500)
    visibility: str | None = None        # 可选，服务端强制
    linked_item_id: int | None = None    # 关联物品
    linked_task_id: str | None = None    # 关联任务


# ══ GET / — 空间事情列表 ══
@router.get("")
async def list_events(
    location_id: str | None = Query(None),
    type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拉空间事情列表，按房间/类型筛选。私密事件仅本人+admin 可见。"""
    q = select(SpaceEvent)
    if location_id is not None:
        q = q.where(SpaceEvent.location_id == location_id)
    if type is not None:
        q = q.where(SpaceEvent.type == type)
    q = q.order_by(SpaceEvent.id.desc()).limit(limit)
    r = await db.execute(q)
    rows = r.scalars().all()

    is_admin = (user.role == "admin")
    items = []
    for ev in rows:
        # 私密事件：仅本人+admin 可见
        if ev.visibility == "private":
            if not is_admin and ev.user_id != user.id:
                continue
        items.append(_event_dict(ev, as_admin=is_admin, viewer_id=user.id))
    return {"ok": True, "items": items, "total": len(items)}


# ══ POST / — 记录事情 ══
@router.post("")
async def create_event(
    req: CreateEventReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """记录一条空间事情。公开度由服务端强制，不信任前端传参。"""
    # 校验 type
    if req.type not in EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"未知事件类型 '{req.type}'，可选: {EVENT_TYPES}",
        )

    # 服务端强制公开度
    visibility = _resolve_visibility(req.type, req.visibility)

    now = datetime.utcnow().isoformat()
    ev = SpaceEvent(
        location_id=req.location_id,
        user_id=user.id,
        type=req.type,
        text=req.text,
        visibility=visibility,
        linked_item_id=req.linked_item_id,
        linked_task_id=req.linked_task_id,
        created_at=now,
    )
    db.add(ev)
    await db.flush()  # 拿到 ev.id

    # ══ 同步写入 activity_log（同一事务，约 3 行）══
    if req.type in EVENT_SYNC_TYPES:
        _target = None
        if req.type in ("cooking", "cleaning", "farming"):
            _target = str(ev.id)
        elif req.type in ("item_put", "item_take") and req.linked_item_id:
            _target = str(req.linked_item_id)
        # checkin/checkout: target=None

        db.add(ActivityLog(
            time=now,
            type=f"event_{req.type}",
            text=req.text,
            user_id=user.id,
            actor_id=user.id,
            target=_target,
        ))

    await db.commit()
    await db.refresh(ev)
    return {"ok": True, "event": _event_dict(ev, as_admin=False, viewer_id=user.id)}


# ══ GET /{event_id} — 单条详情 ══
@router.get("/{event_id}")
async def get_event(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拉单条事情详情。私密事件仅本人+admin 可见。"""
    r = await db.execute(select(SpaceEvent).where(SpaceEvent.id == event_id))
    ev = r.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="事情不存在")

    is_admin = (user.role == "admin")
    if ev.visibility == "private" and not is_admin and ev.user_id != user.id:
        raise HTTPException(status_code=404, detail="事情不存在")

    return {"ok": True, "event": _event_dict(ev, as_admin=is_admin, viewer_id=user.id)}


# ══ Helpers ══
def _event_dict(ev: SpaceEvent, *, as_admin: bool, viewer_id: str) -> dict:
    """序列化 SpaceEvent，按 visibility 清洗 user_id。"""
    d = {
        "id": ev.id,
        "location_id": ev.location_id,
        "type": ev.type,
        "text": ev.text,
        "visibility": ev.visibility,
        "linked_item_id": ev.linked_item_id,
        "linked_task_id": ev.linked_task_id,
        "created_at": ev.created_at,
    }
    # 匿名事件：API 返回洗掉 user_id（数据库留存可追溯）
    if ev.visibility == "anonymous":
        d["user_id"] = None
    else:
        d["user_id"] = ev.user_id
    return d
