"""Accommodation routes: checkin, checkout, status. Phase C2.5."""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from datetime import datetime, date, timedelta
from database import get_db
from models import User, Tenancy, NTTask, InnRoom
import json
from routes.auth import get_current_user, require_admin
from routes.nt import _ledger_id, _add_ledger, _get_pool, BED_RATES
from nt_helpers import _safe_assignees
router = APIRouter(prefix="/api/accommodation", tags=["accommodation"])

# G-3: 欠费上限阈值（天数进 config 不硬编码）——超 REMIND 天房费提醒、超 LIMIT 天房费限新预定
ACCOMMODATION_REMIND_DAYS = int(os.environ.get("ACCOMMODATION_DEBT_REMIND_DAYS", "7"))
ACCOMMODATION_LIMIT_DAYS = int(os.environ.get("ACCOMMODATION_DEBT_LIMIT_DAYS", "14"))


async def _settle_tenancy(db, user, t, occasion):
    """G-3 一次性结算某条 tenancy 的 应计住宿费(accommodation_due)+存量欠费(debt)。
    钱随单走：够则扣 nt_balance→pool，不足记欠费(debt 留存可追缴)。返回结算单。"""
    due = t.accommodation_due or 0
    prev_debt = t.debt or 0
    amount = due + prev_debt
    rate = BED_RATES.get(t.room_id, 28)
    paid = 0
    remaining = 0
    if amount > 0:
        pool = await _get_pool(db, lock=True)  # CR-3: 结算写池补行锁
        pay = min(user.nt_balance, amount)
        if pay > 0:
            user.nt_balance -= pay
            pool.balance += pay
            await _add_ledger(db, _ledger_id(), user.id, "community_pool", pay,
                              "accommodation_settlement",
                              f"{occasion}结算: {pay} NT（住宿 {due}+欠费 {prev_debt}）", status="settled")
            paid = pay
        remaining = amount - pay
        if remaining > 0:
            await _add_ledger(db, _ledger_id(), user.id, "community_pool", remaining,
                              "debt_unpaid", f"{occasion}欠费未结: {remaining} NT（余额不足）", status="pending")
    t.debt = remaining          # 未清欠费留存（不清零→可追缴/展示）
    t.accommodation_due = 0
    days = (due // rate) if rate else 0
    return {"days": days, "rate": rate, "accrued": due, "prev_debt": prev_debt,
            "total": amount, "paid": paid, "debt": remaining}


def _intervals_overlap(a_in: str, a_out: str, b_in: str, b_out: str) -> bool:
    """C-B-4 区间重叠判定（PC inn_bookings 原型逻辑重写，非搬运）。
    半开区间 [in, out)：重叠 ⇔ a_in < b_out 且 a_out > b_in。
    相邻不重叠（a_out == b_in）与同日进出（零长区间）均判不重叠。"""
    return a_in < b_out and a_out > b_in


class CheckinRequest(BaseModel):
    room_id: str = Field(min_length=1)
    bed_num: int = 1
    track: str = "coop"                 # C-B-4: coop | inn
    check_in: str | None = None         # inn 轨必填（YYYY-MM-DD）
    check_out: str | None = None        # inn 轨必填（YYYY-MM-DD）


class RoleChangeRequest(BaseModel):
    user_id: str
    role: str  # visitor | npc | builder | adventurer | admin


async def _inn_checkin(req: "CheckinRequest", user: User, db: AsyncSession):
    """C-B-4 素社民宿区间预订：InnRoom 房型 + 区间重叠占用判定（beds 上限）。
    结算沿 G-3 应计路径（退房时 _settle_tenancy），本函数不新造钱路。"""
    if not req.check_in or not req.check_out:
        raise HTTPException(status_code=400, detail="民宿预订需提供 check_in / check_out 日期")
    if req.check_in >= req.check_out:
        raise HTTPException(status_code=400, detail="check_out 必须晚于 check_in")
    room = (await db.execute(select(InnRoom).where(InnRoom.id == req.room_id))).scalar_one_or_none()
    if not room or room.status != "active":
        raise HTTPException(status_code=404, detail="民宿房间不存在或未开放")
    # 区间重叠占用判定（带行锁防并发超卖）——同房 active inn 预订逐条比对
    existing_r = await db.execute(
        select(Tenancy).where(
            Tenancy.room_id == req.room_id,
            Tenancy.track == "inn",
            Tenancy.status == "active",
        ).with_for_update()
    )
    overlaps = [t for t in existing_r.scalars()
                if _intervals_overlap(req.check_in, req.check_out,
                                      t.checkin_date, t.check_out_date or t.checkin_date)]
    if len(overlaps) >= (room.beds or 1):
        raise HTTPException(status_code=400, detail="该房间在所选日期已满")
    t = Tenancy(user_id=user.id, room_id=req.room_id, bed_num=req.bed_num,
                checkin_date=req.check_in, check_out_date=req.check_out,
                track="inn", room_type=room.room_type, status="active")
    db.add(t)
    if user.role == "visitor":
        user.role = "npc"
    await db.commit()
    return {"ok": True, "track": "inn", "room_id": req.room_id,
            "room_type": room.room_type, "room_label": room.label,
            "check_in": req.check_in, "check_out": req.check_out,
            "role": user.role}


@router.post("/checkin")
async def checkin(req: CheckinRequest, user: User = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    """入住——原子化：子查询防超额。已入住则自动换房。
    C-B-4: track=inn 走素社民宿区间预订引擎；coop（default）路径一字不变。
    """
    if req.track == "inn":
        return await _inn_checkin(req, user, db)
    # 已有入住 → 自动退旧房（换房场景）
    existing = await db.execute(
        select(Tenancy).where(Tenancy.user_id == user.id, Tenancy.status == "active").with_for_update()  # 行锁：防同一用户并发 checkin 创建双份活跃入住
    )
    old = existing.scalar_one_or_none()
    old_room = None
    if old:
        old_room = old.room_id
        old.status = "checked_out"
        # G-3: 换房时一次性结算旧房 应计住宿费+欠费
        await _settle_tenancy(db, user, old, "换房")

    # G-3: 欠费上限拦截——全新入住（非换房）时，累计未结欠费超上限则拒绝（拒绝出声给原因）
    if old is None:
        _rate = BED_RATES.get(req.room_id, 28)
        _out_r = await db.execute(
            select(func.coalesce(func.sum(Tenancy.debt), 0)).where(Tenancy.user_id == user.id)
        )
        _outstanding = _out_r.scalar() or 0
        if _outstanding >= ACCOMMODATION_LIMIT_DAYS * _rate:
            raise HTTPException(status_code=403,
                detail=f"住宿欠费 {_outstanding} NT 已达 {ACCOMMODATION_LIMIT_DAYS} 天房费上限，请先结清欠费再预定/入住")

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
    # G-3: 退房一次性总结算——汇总 应计住宿费(due)+存量欠费(debt)，钱随单走
    settlement = await _settle_tenancy(db, user, t, "退房")
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
    return {"ok": True, "remaining_debt": settlement["debt"], "settlement": settlement, "role": user.role}


@router.get("/status")
async def accommodation_status(user: User = Depends(get_current_user),
                                db: AsyncSession = Depends(get_db)):
    """当前用户的入住状态。"""
    result = await db.execute(
        select(Tenancy).where(Tenancy.user_id == user.id, Tenancy.status == "active")
    )
    t = result.scalar_one_or_none()
    if not t:
        return {"tenant": None, "role": user.role,
                "remind_days": ACCOMMODATION_REMIND_DAYS, "limit_days": ACCOMMODATION_LIMIT_DAYS}
    _rate = BED_RATES.get(t.room_id, 28)
    _due = t.accommodation_due or 0
    return {"tenant": {"room_id": t.room_id, "bed_num": t.bed_num,
                       "checkin_date": t.checkin_date, "debt": t.debt,
                       "accommodation_due": _due, "rate": _rate,
                       "last_deducted": t.last_deducted},
            "overdue_remind": _due >= ACCOMMODATION_REMIND_DAYS * _rate,
            "overdue_limit": _due >= ACCOMMODATION_LIMIT_DAYS * _rate,
            "remind_days": ACCOMMODATION_REMIND_DAYS, "limit_days": ACCOMMODATION_LIMIT_DAYS,
            "role": user.role}


@router.get("/inn-rooms")
async def list_inn_rooms(db: AsyncSession = Depends(get_db)):
    """C-B-5a: 素社民宿房型列表（含占用日期）。公开接口，无需鉴权。"""
    rooms_r = await db.execute(select(InnRoom).where(InnRoom.status == "active"))
    rooms = []
    for room in rooms_r.scalars():
        tenancies = await db.execute(
            select(Tenancy).where(
                Tenancy.room_id == room.id,
                Tenancy.track == "inn",
                Tenancy.status == "active",
            )
        )
        occupied = set()
        for t in tenancies.scalars():
            if t.checkin_date and t.check_out_date:
                # 展开 [checkin, checkout) 区间内所有日期
                d = date.fromisoformat(t.checkin_date)
                end = date.fromisoformat(t.check_out_date)
                while d < end:
                    occupied.add(d.isoformat())
                    d += timedelta(days=1)
        rooms.append({
            "id": room.id, "label": room.label, "room_type": room.room_type,
            "beds": room.beds, "rate": room.rate, "dietary": room.dietary,
            "status": room.status, "occupied_dates": sorted(occupied),
        })
    return {"rooms": rooms}


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
