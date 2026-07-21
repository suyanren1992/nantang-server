"""Camp CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
import json
from database import get_db
from models import Camp, CampBuilder, CampTask, User
from routes.auth import get_current_user
from routes.nt import _ledger_id, _add_ledger, _get_pool

router = APIRouter(prefix="/api/camps", tags=["camps"])


def _camp_id():
    return f"camp_{datetime.utcnow().strftime('%y%m%d%H%M%S')}"


@router.get("")
async def list_camps(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(Camp).order_by(Camp.created_at.desc()))
    camps = list(result.scalars())
    items = []
    for c in camps:
        try: highlights = json.loads(c.highlights) if c.highlights else []
        except: highlights = []
        items.append({
            "id": c.id, "name": c.name, "emoji": c.emoji, "theme": c.theme,
            "date": c.date, "status": c.status, "people": c.people, "max": c.max,
            "location": c.location, "desc": c.desc,
            "highlights": highlights,
            "created_by": c.created_by, "launched_at": c.launched_at,
        })
    return items


@router.post("")
async def create_camp(req: dict, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    camp = Camp(
        id=req.get("id") or _camp_id(),
        name=req.get("name", ""), emoji=req.get("emoji", "🏕️"),
        theme=req.get("theme", ""), desc=req.get("desc", ""),
        status=req.get("status", "active"), date=req.get("date", ""),
        people=req.get("people", 0), max=req.get("max", 16),
        location=req.get("location", "南塘合作社大院"),
        highlights=json.dumps(req.get("highlights", []), ensure_ascii=False),
        budget=json.dumps(req.get("budget", {}), ensure_ascii=False),
        schedule=json.dumps(req.get("schedule", []), ensure_ascii=False),
        milestones=json.dumps(req.get("milestones", []), ensure_ascii=False),
        created_by=user.id,
        launched_at=datetime.utcnow().isoformat(),
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(camp)
    # Builders
    builders = req.get("builders", [])
    for b in builders:
        db.add(CampBuilder(camp_id=camp.id, name=b.get("name", ""), role=b.get("role", ""),
                           task_names=json.dumps(b.get("taskNames", []), ensure_ascii=False),
                           total_nt=b.get("totalNT", 0), confirmed=b.get("confirmed", 0)))
    # Tasks
    tasks = req.get("tasks", [])
    for t in tasks:
        db.add(CampTask(camp_id=camp.id, name=t.get("name", ""), type=t.get("type", ""),
                        nt=t.get("nt", 0), status=t.get("status", "draft"),
                        category=t.get("category", ""), note=t.get("note", ""),
                        poster=t.get("poster", ""), deadline=t.get("deadline", ""),
                        reviewer=t.get("reviewer", ""), slots=t.get("slots", 1),
                        claimants=json.dumps(t.get("claimants", []), ensure_ascii=False)))
    # Budget NT → camp_pool topup
    budget = req.get("budget", {})
    if budget:
        adv = budget.get("adventurers", 0)
        bld = budget.get("builders", 0)
        people = adv + bld
        schedule = req.get("schedule", [])
        days = len((schedule[0] or {}).get("cells", [])) if schedule else 8
        if days == 0: days = 8
        lodging = budget.get("lodgingNT", 0)
        meal = budget.get("mealNT", 0)
        camp_total = lodging * people * days + meal * people * days
        if camp_total > 0:
            pool = await _get_pool(db)
            pool.total_issued += camp_total
            pool.camp_balance += camp_total
            lid = _ledger_id()
            await _add_ledger(db, lid, None, "camp_pool", camp_total, "topup", f"营队注资: {camp.name}")

    await db.commit()
    return {"ok": True, "camp_id": camp.id}


@router.put("/{camp_id}")
async def update_camp(camp_id: str, req: dict, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
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
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(Camp).where(Camp.id == camp_id))
    camp = result.scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404)
    tasks_result = await db.execute(select(CampTask).where(CampTask.camp_id == camp_id))
    camp_tasks = list(tasks_result.scalars())
    settled = [t for t in camp_tasks if t.status == "已结算"]
    builders_result = await db.execute(select(CampBuilder).where(CampBuilder.camp_id == camp_id))
    builders = list(builders_result.scalars())
    return {
        "ok": True,
        "total_tasks": len(camp_tasks),
        "settled_tasks": len(settled),
        "total_nt": sum(t.nt for t in settled),
        "builders": [{"name": b.name, "total_nt": b.total_nt} for b in builders],
    }


@router.get("/{camp_id}/report")
async def camp_report(camp_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(Camp).where(Camp.id == camp_id))
    camp = result.scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404)
    tasks_result = await db.execute(select(CampTask).where(CampTask.camp_id == camp_id))
    camp_tasks = list(tasks_result.scalars())
    done = [t for t in camp_tasks if t.status == "已结算"]
    builders_result = await db.execute(select(CampBuilder).where(CampBuilder.camp_id == camp_id))
    builders = list(builders_result.scalars())
    return {
        "camp": {"id": camp.id, "name": camp.name, "theme": camp.theme, "date": camp.date,
                 "status": camp.status, "people": camp.people, "location": camp.location},
        "stats": {"total_tasks": len(camp_tasks), "done_tasks": len(done),
                  "pct": round(len(done) / max(1, len(camp_tasks)) * 100),
                  "total_nt": sum(t.nt for t in done)},
        "builders": sorted([{"name": b.name, "total_nt": b.total_nt} for b in builders],
                           key=lambda x: x["total_nt"], reverse=True),
    }


@router.delete("/{camp_id}")
async def delete_camp(camp_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    if user.role != "admin":
        raise HTTPException(status_code=403)
    result = await db.execute(select(Camp).where(Camp.id == camp_id))
    camp = result.scalar_one_or_none()
    if not camp:
        raise HTTPException(status_code=404)
    # Cascade delete builders and tasks
    for tbl in (CampBuilder, CampTask):
        r = await db.execute(select(tbl).where(tbl.camp_id == camp_id))
        for row in r.scalars():
            await db.delete(row)
    await db.delete(camp)
    await db.commit()
    return {"ok": True}
