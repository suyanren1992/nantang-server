"""Camp CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from datetime import datetime
import json
from database import get_db
from models import Camp, CampBuilder, CampMembership, NTTask, User
from routes.auth import get_current_user, require_admin
from routes.nt import _ledger_id, _add_ledger, _get_pool

router = APIRouter(prefix="/api/camps", tags=["camps"])


class CampBudget(BaseModel):
    adventurers: int = Field(0, ge=0)
    builders: int = Field(0, ge=0)
    lodgingNT: int = Field(0, ge=0)
    mealNT: int = Field(0, ge=0)


class CampCreateRequest(BaseModel):
    name: str = ""
    emoji: str = "🏕️"
    theme: str = ""
    desc: str = ""
    status: str = "active"
    date: str = ""
    people: int = Field(0, ge=0)
    max: int = Field(16, ge=1, le=100)
    location: str = "南塘合作社大院"
    highlights: list = []
    budget: CampBudget = CampBudget()
    schedule: list = []
    milestones: list = []
    builders: list = []
    tasks: list = []


def _camp_id():
    return f"camp_{datetime.utcnow().strftime('%y%m%d%H%M%S')}"


def _membership_subquery(user: User):
    """当前用户 active membership 的 camp_id 子查询（缩权激活时使用）。"""
    return select(CampMembership.camp_id).where(
        CampMembership.user_id == user.id,
        CampMembership.status == "active",
    )


# C-B-1: 过渡期缩权总开关。本期 False=只立机制不缩权（全库无 membership 数据，
# 非 admin 全集放行，与现状一致）。C-B-2 回填报到数据后另卡改 True 激活缩权。
CAMP_SCOPE_ENFORCED = False


def visible_camp_filter(user: User, query):
    """C-B-1 唯一收口：营地可见性过滤（照 C-B 设计稿 §2.3 admin 全通原则）。

    admin：一律绕过，返回全集（砚仁明令：无视一切限制全可见）。
    非 admin：机制已就位（按 CampMembership active 过滤），但受 CAMP_SCOPE_ENFORCED
    总开关控制——本期 False，故'过渡放行'返回全集（防爆条款：全库无 membership
    数据，缩权会误伤，与现状一致）。缩权待 C-B-2 回填数据后另卡置 True 开启。
    camps.py 不得有第二处手写过滤——所有营地查询都走此收口。
    """
    if user.role == "admin":
        return query
    if not CAMP_SCOPE_ENFORCED:
        return query  # 过渡放行：本期只立机制不缩权
    return query.where(Camp.id.in_(_membership_subquery(user)))


async def _camp_people_count(db: AsyncSession, camp_id: str) -> int:
    """C-B-2: 单营地在册人数读时聚合——count(active membership)。禁写时 ±1。"""
    return (await db.execute(
        select(func.count()).select_from(CampMembership).where(
            CampMembership.camp_id == camp_id,
            CampMembership.status == "active",
        )
    )).scalar_one()


@router.get("")
async def list_camps(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                     limit: int = 50, offset: int = 0):
    # BE-2③: 补分页（照 auth.py /users 写法），limit 上限 200
    # C-B-1: 营地可见性收口——admin 全通、非 admin 过渡放行（唯一入口 visible_camp_filter）
    # C-B-2: people 读时聚合——active membership 计数子查询单查询 outerjoin（防 N+1）
    cnt_subq = (
        select(CampMembership.camp_id.label("cid"), func.count().label("cnt"))
        .where(CampMembership.status == "active")
        .group_by(CampMembership.camp_id)
        .subquery()
    )
    base = select(Camp, cnt_subq.c.cnt).outerjoin(cnt_subq, Camp.id == cnt_subq.c.cid)
    q = visible_camp_filter(user, base)
    result = await db.execute(
        q.order_by(Camp.created_at.desc()).limit(min(limit, 200)).offset(offset)
    )
    items = []
    for c, cnt in result.all():
        try: highlights = json.loads(c.highlights) if c.highlights else []
        except (json.JSONDecodeError, TypeError): highlights = []
        items.append({
            "id": c.id, "name": c.name, "emoji": c.emoji, "theme": c.theme,
            "date": c.date, "status": c.status, "people": cnt or 0, "max": c.max,
            "location": c.location, "desc": c.desc,
            "highlights": highlights,
            "created_by": c.created_by, "launched_at": c.launched_at,
        })
    return items


@router.post("")
async def create_camp(req: CampCreateRequest, user: User = Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    camp = Camp(
        id=_camp_id(),
        name=req.name, emoji=req.emoji,
        theme=req.theme, desc=req.desc,
        status=req.status, date=req.date,
        people=req.people, max=req.max,
        location=req.location,
        highlights=json.dumps(req.highlights, ensure_ascii=False),
        budget=req.budget.model_dump_json(),
        schedule=json.dumps(req.schedule, ensure_ascii=False),
        milestones=json.dumps(req.milestones, ensure_ascii=False),
        created_by=user.id,
        launched_at=datetime.utcnow().isoformat(),
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(camp)
    # Builders
    for b in req.builders:
        db.add(CampBuilder(camp_id=camp.id, name=b.get("name", ""), role=b.get("role", ""),
                           task_names=json.dumps(b.get("taskNames", []), ensure_ascii=False),
                           total_nt=b.get("totalNT", 0), confirmed=b.get("confirmed", 0)))
    # Tasks — T7: 营地任务走 NTTask(scope='camp')
    for t in req.tasks:
        db.add(NTTask(
            id=f"camp_{camp.id}_{t.get('name','')}_{len(req.tasks)}",
            poster=t.get("poster", ""), title=t.get("name", ""), reward=t.get("nt", 0),
            status=t.get("status", "draft"), category=t.get("type", ""),
            scope="camp", camp_ref_id=camp.id,
            note=t.get("note", ""), slots=t.get("slots", 1),
            deadline=t.get("deadline", ""), reviewer=t.get("reviewer", ""),
            assignees=json.dumps(t.get("claimants", []), ensure_ascii=False)))
    # Budget NT → camp_pool topup
    adv = req.budget.adventurers
    bld = req.budget.builders
    people = adv + bld
    days = len((req.schedule[0] or {}).get("cells", [])) if req.schedule else 8
    if days == 0: days = 8
    lodging = req.budget.lodgingNT
    meal = req.budget.mealNT
    camp_total = lodging * people * days + meal * people * days
    if camp_total > 0:
        pool = await _get_pool(db, lock=True)
        pool.camp_balance += camp_total
        lid = _ledger_id()
        await _add_ledger(db, lid, None, "camp_pool", camp_total, "topup", f"营队注资: {camp.name}")

    await db.commit()
    return {"ok": True, "camp_id": camp.id}


@router.post("/{camp_id}/checkin")
async def camp_checkin(camp_id: str, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    """C-B-2 营地报到（照设计稿 §3.1）：写 CampMembership 并回真实人数。

    幂等：membership 已存在→返回既有，不重复建行（uq_camp_member 亦保底）。
    不存在→写 status=active/joined_at=now。本期不开审批（设计稿明文）。
    鉴权沿既有：未登录 401（get_current_user）；camp 不存在 404。
    """
    camp = (await db.execute(select(Camp).where(Camp.id == camp_id))).scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404, detail="营地不存在")
    existing = (await db.execute(
        select(CampMembership).where(
            CampMembership.user_id == user.id,
            CampMembership.camp_id == camp_id,
        )
    )).scalar_one_or_none()
    if existing:
        already = True
        m = existing
    else:
        already = False
        m = CampMembership(user_id=user.id, camp_id=camp_id,
                           camp_role="member", status="active",
                           joined_at=datetime.utcnow().isoformat())
        db.add(m)
        await db.commit()
    people = await _camp_people_count(db, camp_id)
    return {
        "ok": True,
        "already_member": already,
        "membership": {
            "user_id": m.user_id, "camp_id": m.camp_id,
            "camp_role": m.camp_role, "status": m.status,
            "joined_at": m.joined_at,
        },
        "people": people,
    }


@router.put("/{camp_id}")
async def update_camp(camp_id: str, req: dict, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Camp).where(Camp.id == camp_id))
    camp = result.scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404)
    if camp.created_by != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能修改自己的营地")
    for key in ("name", "theme", "desc", "status", "date", "people", "max", "location"):
        if key in req:
            setattr(camp, key, req[key])
    if "highlights" in req:
        camp.highlights = json.dumps(req["highlights"], ensure_ascii=False)
    if req.get("status") == "archived":
        camp.closed_at = datetime.utcnow().isoformat()
    camp.updated_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True}


@router.post("/{camp_id}/settle")
async def settle_camp(camp_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Camp).where(Camp.id == camp_id))
    camp = result.scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404)
    # D-10 M-9: 仅营地创建者或管理员可结算（沿用同文件 update_camp 鉴权风格）
    if camp.created_by != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="仅营地创建者或管理员可结算")
    # 找出待结算的营地任务（verify 后 status="待结算"，尚未营地级结算）
    tasks_result = await db.execute(
        select(NTTask).where(NTTask.camp_ref_id == camp_id, NTTask.status == "待结算"))
    camp_tasks = list(tasks_result.scalars())
    total_nt = sum(t.reward for t in camp_tasks)
    now = datetime.utcnow().isoformat()
    # ponytail: verify_task 已是唯一支付点，settle_camp 只更新状态
    for t in camp_tasks:
        t.settler_id = user.id
        t.settled_at = now
        t.status = "已结算"
    await db.commit()
    builders_result = await db.execute(select(CampBuilder).where(CampBuilder.camp_id == camp_id))
    builders = list(builders_result.scalars())
    return {
        "ok": True,
        "total_tasks": len(camp_tasks),
        "settled_tasks": len(camp_tasks),
        "total_nt": total_nt,
        "builders": [{"name": b.name, "total_nt": b.total_nt} for b in builders],
    }


@router.get("/{camp_id}/members")
async def camp_members(camp_id: str, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db),
                       limit: int = 50, offset: int = 0):
    """C-B-4（C-B-3 前端依赖）：营地成员名录。

    走 visible_camp_filter 收口——admin 全通（可见任意营地名录）；
    非 admin 过渡期照 CAMP_SCOPE_ENFORCED（本期 False=放行，与 list_camps 一致）。
    名录含 user 基本字段 + camp_role + joined_at，分页沿 list_camps 惯例。
    """
    camp = (await db.execute(select(Camp).where(Camp.id == camp_id))).scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404, detail="营地不存在")
    # 收口鉴权：admin 全通；非 admin 过渡放行时该营地对其可见即放行
    visible = visible_camp_filter(user, select(Camp.id).where(Camp.id == camp_id))
    if not (await db.execute(visible)).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="无权查看该营地成员")
    rows = (await db.execute(
        select(CampMembership, User)
        .join(User, User.id == CampMembership.user_id)
        .where(CampMembership.camp_id == camp_id, CampMembership.status == "active")
        .order_by(CampMembership.joined_at.asc())
        .limit(min(limit, 200)).offset(offset)
    )).all()
    return [{
        "user_id": u.id, "role": u.role, "avatar_seed": u.avatar_seed,
        "nt_balance": u.nt_balance, "contribution_value": u.contribution_value,
        "camp_role": m.camp_role, "joined_at": m.joined_at,
    } for m, u in rows]


@router.get("/{camp_id}/report")
async def camp_report(camp_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Camp).where(Camp.id == camp_id))
    camp = result.scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404)
    tasks_result = await db.execute(select(NTTask).where(NTTask.camp_ref_id == camp_id))
    camp_tasks = list(tasks_result.scalars())
    done = [t for t in camp_tasks if t.status == "已结算"]
    builders_result = await db.execute(select(CampBuilder).where(CampBuilder.camp_id == camp_id))
    builders = list(builders_result.scalars())
    return {
        "camp": {"id": camp.id, "name": camp.name, "theme": camp.theme, "date": camp.date,
                 "status": camp.status, "people": await _camp_people_count(db, camp_id), "location": camp.location},
        "stats": {"total_tasks": len(camp_tasks), "done_tasks": len(done),
                  "pct": round(len(done) / max(1, len(camp_tasks)) * 100),
                  "total_nt": sum(t.reward for t in done)},
        "builders": sorted([{"name": b.name, "total_nt": b.total_nt} for b in builders],
                           key=lambda x: x["total_nt"], reverse=True),
    }


@router.delete("/{camp_id}")
async def delete_camp(camp_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(status_code=403)
    result = await db.execute(select(Camp).where(Camp.id == camp_id))
    camp = result.scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404)
    # Cascade delete builders and tasks (T7: CampTask → NTTask)
    for tbl in (CampBuilder,):
        r = await db.execute(select(tbl).where(tbl.camp_id == camp_id))
        for row in r.scalars():
            await db.delete(row)
    tasks_r = await db.execute(select(NTTask).where(NTTask.camp_ref_id == camp_id))
    tasks_to_delete = list(tasks_r.scalars())
    # R13: 退还未结算任务的 NT 到社区池
    unsettled_total = sum(t.reward for t in tasks_to_delete if t.status != "已结算")
    if unsettled_total > 0:
        pool = await _get_pool(db, lock=True)
        pool.balance += unsettled_total
        pool.camp_balance = max(0, pool.camp_balance - unsettled_total)
        await _add_ledger(db, _ledger_id(), "camp_pool", "community_pool", unsettled_total, "camp_refund",
                          f"删除营地 {camp.name} 退还未结算 NT", task_id=None, status="settled")
    for row in tasks_to_delete:
        await db.delete(row)
    await db.delete(camp)
    await db.commit()
    return {"ok": True}
