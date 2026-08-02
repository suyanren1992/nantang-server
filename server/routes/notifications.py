# -*- coding: utf-8 -*-
"""W7-NOTIF-1: 通知系统重做 — 按 user_id 过滤的 /api/notifications/* 端点。

B 方案：共享 activity_log 表，按 type 路由 + user_id 过滤。
旧端点 community.py 的同名 router 已移除，main.py 改为引入本模块。
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ActivityLog, User
from routes.auth import get_current_user

logger = logging.getLogger("notifications")

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/list")
async def list_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    type: str = None,
    unread: bool = False,
    limit: int = 50,
):
    """GET /api/notifications/list — 按收件人过滤的通知列表。

    - 返回 user_id=我 OR user_id IS NULL（公开事件）的 activity_log 记录
    - 支持 type / unread 过滤
    """
    lim = min(limit, 100)

    # 条件：收件人=我 OR 公开事件
    q = select(ActivityLog).where(
        (ActivityLog.user_id == user.id) | (ActivityLog.user_id.is_(None))
    )
    if type:
        q = q.where(ActivityLog.type == type)
    if unread:
        q = q.where(ActivityLog.read_at.is_(None))

    q = q.order_by(ActivityLog.time.desc()).limit(lim)
    result = await db.execute(q)
    rows = result.scalars().all()

    # 未读总数（同一过滤条件下）
    unread_q = select(func.count(ActivityLog.id)).where(
        (ActivityLog.user_id == user.id) | (ActivityLog.user_id.is_(None)),
        ActivityLog.read_at.is_(None),
    )
    if type:
        unread_q = unread_q.where(ActivityLog.type == type)
    unread_r = await db.execute(unread_q)
    unread_count = unread_r.scalar() or 0

    items = [{
        "id": a.id,
        "type": a.type,
        "text": a.text,
        "time": a.time,
        "user_id": a.user_id,
        "actor_id": a.actor_id,
        "target": a.target,
        "read_at": a.read_at,
        "unread": a.read_at is None,
    } for a in rows]

    return {"ok": True, "items": items, "unread_count": unread_count}


@router.get("/unread_count")
async def unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GET /api/notifications/unread_count — 小红点未读数。

    统计 (user_id=我 OR 公开) AND read_at IS NULL 的记录数。
    """
    q = select(func.count(ActivityLog.id)).where(
        (ActivityLog.user_id == user.id) | (ActivityLog.user_id.is_(None)),
        ActivityLog.read_at.is_(None),
    )
    result = await db.execute(q)
    n = result.scalar() or 0
    return {"ok": True, "unread": n}


@router.post("/{log_id}/read")
async def mark_read(
    log_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """POST /api/notifications/{log_id}/read — 标单条已读。

    仅允许标自己的通知（user_id=我 或 公开事件）。
    """
    row = (await db.execute(
        select(ActivityLog).where(ActivityLog.id == log_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="通知不存在")
    # 仅允许标自己的或公开的
    if row.user_id is not None and row.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能标记自己的通知")
    row.read_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True, "id": log_id}


@router.post("/read_all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """POST /api/notifications/read_all — 全标已读。

    将 (user_id=我 OR 公开) 且未读的通知全部标为已读。
    """
    now = datetime.utcnow().isoformat()
    rows = (await db.execute(
        select(ActivityLog).where(
            (ActivityLog.user_id == user.id) | (ActivityLog.user_id.is_(None)),
            ActivityLog.read_at.is_(None),
        )
    )).scalars().all()
    count = 0
    for r in rows:
        r.read_at = now
        count += 1
    await db.commit()
    return {"ok": True, "marked_read": count}
