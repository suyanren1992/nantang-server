"""Accommodation routes: checkin, checkout, status. Phase C2.5."""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from datetime import datetime
from database import get_db
from models import User, Tenancy, NTTask
import json
from routes.auth import get_current_user, require_admin
from routes.nt import _ledger_id, _add_ledger, _get_pool
from nt_helpers import _safe_assignees
router = APIRouter(prefix="/api/accommodation", tags=["accommodation"])


class CheckinRequest(BaseModel):
    room_id: str = Field(min_length=1)
    bed_num: int = 1


class RoleChangeRequest(BaseModel):
    user_id: str
    role: str  # visitor | npc | builder | adventurer | admin


@router.post("/checkin")
async def checkin(req: CheckinRequest, user: User = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    """入住——原子化：子查询防超额。已入住则自动换房。"""
    # 已有入住 → 自动退旧房（换房场景）
    existing = await db.execute(
        select(Tenancy).where(Tenancy.user_id == user.id, Tenancy.status == "active")
    )
    old = existing.scalar_one_or_none()
    old_room = None
    if old:
        old_room = old.room_id
        old.status = "checked_out"
        # 结算旧房间的欠费
        if old.debt > 0:
            if user.nt_balance >= old.debt:
                user.nt_balance -= old.debt
                pool = await _get_pool(db)
                pool.balance += old.debt
                await _add_ledger(db, _ledger_id(), user.id, "community_pool", old.debt, "debt_settlement",
                                 f"换房欠费结算: {old.debt} NT")
            else:
                await _add_ledger(db, _ledger_id(), user.id, "community_pool", old.debt, "debt_unpaid",
                                 f"换房欠费未结: {old.debt} NT")
            old.debt = 0

    # 原子化：子查询检查房间是否已满
    # ponytail: max_beds 从 map_locations JSON blob 读取，可通过环境变量覆盖
    MAX_BEDS = int(os.environ.get("MAX_BEDS_PER_ROOM", "6"))
    count_r = await db.execute(
        select(func.count(Tenancy.id)).where(
            Tenancy.room_id == req.room_id, Tenancy.status == "active"
        ).with_for_update()
    )
    occupied = count_r.scalar() or 0
    if occupied >= MAX_BEDS:
        raise HTTPException(status_code=400, detail="该房间已满")

    now = datetime.utcnow().isoformat()
    t = Tenancy(user_id=user.id, room_id=req.room_id, bed_num=req.bed_num,
                checkin_date=now, status="active")
    db.add(t)
    # 角色升级：visitor → npc
    if user.role == "visitor":
        user.role = "npc"
    await db.commit()
    return {"ok": True, "room_id": req.room_id, "bed_num": req.bed_num,
            "checkin_date": now, "role": user.role,
            "switched_from": old_room}


@router.post("/checkout")
async def checkout(user: User = Depends(get_current_user),
                   db: AsyncSession = Depends(get_db)):
    """退房——移除 tenant + 角色降级 + 结算欠费。"""
    result = await db.execute(
        select(Tenancy).where(Tenancy.user_id == user.id, Tenancy.status == "active")
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=400, detail="没有活跃的入住记录")

    t.status = "checked_out"
    # 结算欠费：从余额扣，回流社区池。未清部分记录账本，tenancy debt 清零
    if t.debt > 0:
        if user.nt_balance >= t.debt:
            user.nt_balance -= t.debt
            pool = await _get_pool(db)
            pool.balance += t.debt
            lid = _ledger_id()
            await _add_ledger(db, lid, user.id, "community_pool", t.debt, "debt_settlement",
                             f"退房欠费结算: {t.debt} NT")
        else:
            lid = _ledger_id()
            await _add_ledger(db, lid, user.id, "community_pool", t.debt, "debt_unpaid",
                             f"退房欠费未结: {t.debt} NT（余额不足）")
        t.debt = 0
    # 角色降级：admin/builder 不降级
    if user.role not in ("admin", "builder"):
        other = await db.execute(
            select(func.count(Tenancy.id)).where(
                Tenancy.user_id == user.id, Tenancy.status == "active"
            )
        )
        if (other.scalar() or 0) == 0:
            user.role = "visitor"

    # R10: 释放已认领的系统生成任务
    import json
    sys_tasks = await db.execute(
        select(NTTask).where(
            NTTask.is_system_generated == True,
            NTTask.status == "进行中"
        )
    )
    for task in sys_tasks.scalars():
        a_ids = _safe_assignees(task)
        if user.id in a_ids:
            a_ids.remove(user.id)
            task.assignees = json.dumps(a_ids, ensure_ascii=False)
            task.assignee = a_ids[0] if a_ids else None

    await db.commit()
    return {"ok": True, "remaining_debt": t.debt, "role": user.role}


@router.get("/status")
async def accommodation_status(user: User = Depends(get_current_user),
                                db: AsyncSession = Depends(get_db)):
    """当前用户的入住状态。"""
    result = await db.execute(
        select(Tenancy).where(Tenancy.user_id == user.id, Tenancy.status == "active")
    )
    t = result.scalar_one_or_none()
    if not t:
        return {"tenant": None, "role": user.role}
    return {"tenant": {"room_id": t.room_id, "bed_num": t.bed_num,
                       "checkin_date": t.checkin_date, "debt": t.debt,
                       "last_deducted": t.last_deducted},
            "role": user.role}


# ══ 角色变更（邀请码路径）══
role_router = APIRouter(prefix="/api/user", tags=["user"])


@role_router.post("/role")
async def change_role(req: RoleChangeRequest, admin: User = Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    """管理员变更用户角色。"""
    result = await db.execute(select(User).where(User.id == req.user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    valid_roles = ("visitor", "npc", "builder", "adventurer", "admin")
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"无效角色: {req.role}")
    target.role = req.role
    await db.commit()
    return {"ok": True, "user_id": req.user_id, "role": req.role}
