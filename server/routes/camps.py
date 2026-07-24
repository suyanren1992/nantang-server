"""Camp CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from datetime import datetime
import json
from database import get_db
from models import Camp, CampBuilder, NTTask, User
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


@router.get("")
async def list_camps(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Camp).order_by(Camp.created_at.desc()))
    camps = list(result.scalars())
    items = []
    for c in camps:
        try: highlights = json.loads(c.highlights) if c.highlights else []
        except (json.JSONDecodeError, TypeError): highlights = []
        items.append({
            "id": c.id, "name": c.name, "emoji": c.emoji, "theme": c.theme,
            "date": c.date, "status": c.status, "people": c.people, "max": c.max,
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
                 "status": camp.status, "people": camp.people, "location": camp.location},
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
