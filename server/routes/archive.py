# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE补 B5: 档案室端点——复用现有表聚合归档条目。

数据源：
  - Journal → category='log'
  - ActivityLog → category='log'
  - Announcement → category='event'
  - CovenantSignature → category='contract'

复合 ID 格式：{source}_{db_id}（如 journal_123, announcement_45）
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, Journal, ActivityLog, Announcement, CovenantSignature
from routes.auth import get_current_user

router = APIRouter(prefix="/api/archive", tags=["archive"])

# ══ 分类映射 ══
_CATEGORY_MAP = {
    "log": ("journal", "activity_log"),
    "event": ("announcement",),
    "contract": ("covenant_signature",),
}
ALL_CATEGORIES = list(_CATEGORY_MAP.keys())


def _journal_to_item(j: Journal) -> dict:
    return {
        "id": f"journal_{j.id}",
        "title": j.type,
        "content": j.content or "",
        "category": "log",
        "created_at": j.time,
        "author": j.user,
        "source": "journal",
    }


def _activity_to_item(a: ActivityLog) -> dict:
    return {
        "id": f"activity_{a.id}",
        "title": a.type,
        "content": a.text or "",
        "category": "log",
        "created_at": a.time,
        "author": "system",
        "source": "activity_log",
    }


def _announcement_to_item(an: Announcement) -> dict:
    return {
        "id": f"announcement_{an.id}",
        "title": an.action or an.type or "公告",
        "content": f"{an.doer or ''} {an.action or ''} NT:{an.nt_amount or 0}",
        "category": "event",
        "created_at": an.created_at or "",
        "author": an.doer or "system",
        "source": "announcement",
    }


def _covenant_to_item(cs: CovenantSignature) -> dict:
    return {
        "id": f"covenant_{cs.id}",
        "title": f"公约签署 · {cs.sign_type}",
        "content": f"版本: {cs.covenant_version}",
        "category": "contract",
        "created_at": cs.signed_at,
        "author": cs.user_id,
        "source": "covenant_signature",
    }


# ══ GET /items — 列表（可按 category 过滤） ══
@router.get("/items")
async def list_items(
    category: str = Query(default="", description="过滤分类: log/event/contract"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """聚合多表归档条目，按 created_at 倒序。"""
    items: list[dict] = []
    cats = [category] if category else ALL_CATEGORIES

    for cat in cats:
        if cat not in _CATEGORY_MAP:
            continue
        sources = _CATEGORY_MAP[cat]
        if "journal" in sources:
            r = await db.execute(
                select(Journal).order_by(Journal.time.desc()).limit(100)
            )
            items.extend(_journal_to_item(j) for j in r.scalars())
        if "activity_log" in sources:
            r = await db.execute(
                select(ActivityLog).order_by(ActivityLog.time.desc()).limit(100)
            )
            items.extend(_activity_to_item(a) for a in r.scalars())
        if "announcement" in sources:
            r = await db.execute(
                select(Announcement).order_by(Announcement.created_at.desc()).limit(100)
            )
            items.extend(_announcement_to_item(a) for a in r.scalars())
        if "covenant_signature" in sources:
            r = await db.execute(
                select(CovenantSignature).order_by(CovenantSignature.signed_at.desc()).limit(100)
            )
            items.extend(_covenant_to_item(c) for c in r.scalars())

    # 按 created_at 倒序
    items.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return {"ok": True, "items": items, "total": len(items)}


# ══ GET /items/{item_id} — 详情 ══
@router.get("/items/{item_id}")
async def get_item(
    item_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """按复合 ID 查单条归档详情。"""
    parts = item_id.split("_", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="无效的归档 ID 格式")
    source, db_id_str = parts
    try:
        db_id = int(db_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="无效的归档 ID")

    if source == "journal":
        r = await db.execute(select(Journal).where(Journal.id == db_id))
        j = r.scalar_one_or_none()
        if j:
            return {"ok": True, "item": _journal_to_item(j)}
    elif source == "activity":
        r = await db.execute(select(ActivityLog).where(ActivityLog.id == db_id))
        a = r.scalar_one_or_none()
        if a:
            return {"ok": True, "item": _activity_to_item(a)}
    elif source == "announcement":
        r = await db.execute(select(Announcement).where(Announcement.id == db_id))
        an = r.scalar_one_or_none()
        if an:
            return {"ok": True, "item": _announcement_to_item(an)}
    elif source == "covenant":
        r = await db.execute(select(CovenantSignature).where(CovenantSignature.id == db_id))
        cs = r.scalar_one_or_none()
        if cs:
            return {"ok": True, "item": _covenant_to_item(cs)}

    raise HTTPException(status_code=404, detail="归档条目不存在")
