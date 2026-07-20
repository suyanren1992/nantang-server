"""Data layer routes: journal, discoveries, canteen, map, verifications, etc."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import json
from database import get_db
from models import (Journal, ActivityLog, CardDiscovery, Verification, NewbieQuest,
                    CanteenMenu, MealOrder, MapLocation, Announcement, InventoryItem, User, NTTask)
from routes.auth import get_current_user

router = APIRouter(prefix="/api/data", tags=["data"])


# ── Journal ──
@router.get("/journal")
async def get_journal(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                      limit: int = 50):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(Journal).where(Journal.user == user.id).order_by(Journal.id.desc()).limit(limit))
    return [{"type": j.type, "content": j.content, "time": j.time,
             "space_id": j.space_id, "discovery_id": j.discovery_id} for j in result.scalars()]


@router.post("/journal")
async def add_journal(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    j = Journal(user=user.id, type=req.get("type", "daily"), content=req.get("content", ""),
                time=datetime.utcnow().isoformat(), space_id=req.get("space_id"),
                discovery_id=req.get("discovery_id"))
    db.add(j)
    await db.commit()
    return {"ok": True}


# ── Activity Log ──
@router.get("/activity_log")
async def get_activity_log(db: AsyncSession = Depends(get_db), limit: int = 20):
    result = await db.execute(select(ActivityLog).order_by(ActivityLog.id.desc()).limit(limit))
    return [{"time": a.time, "type": a.type, "text": a.text} for a in result.scalars()]


@router.post("/activity_log")
async def add_activity_log(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    a = ActivityLog(time=datetime.utcnow().isoformat(), type=req.get("type", ""),
                    text=req.get("text", ""))
    db.add(a)
    await db.commit()
    return {"ok": True}


# ── Card Discoveries ──
@router.get("/card_discoveries")
async def get_card_discoveries(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(CardDiscovery).order_by(CardDiscovery.created_at.desc()).limit(100))
    return [{"id": d.id, "space_id": d.space_id, "description": d.description,
             "guesser": d.guesser, "guessed_person": d.guessed_person,
             "status": d.status, "nt_guesser": d.nt_guesser, "nt_doer": d.nt_doer,
             "created_at": d.created_at} for d in result.scalars()]


@router.post("/card_discoveries")
async def add_card_discovery(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    d = CardDiscovery(
        id=req.get("id", f"disc_{datetime.utcnow().timestamp()}"),
        space_id=req.get("space_id"), description=req.get("description"),
        guesser=req.get("guesser"), guessed_person=req.get("guessed_person"),
        guessed_at=req.get("guessed_at"), status=req.get("status", "pending"),
        nt_guesser=req.get("nt_guesser", 5), nt_doer=req.get("nt_doer", 10),
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(d)
    await db.commit()
    return {"ok": True, "id": d.id}


@router.put("/card_discoveries/{disc_id}")
async def update_card_discovery(disc_id: str, req: dict, user: User = Depends(get_current_user),
                                db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(CardDiscovery).where(CardDiscovery.id == disc_id))
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404)
    if d.guesser != user.id and d.guessed_person != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能修改自己参与的发现")
    for key in ("status", "doer_confirmed_at", "doer_denied_at"):
        if key in req:
            setattr(d, key, req[key])
    await db.commit()
    return {"ok": True}


# ── Verifications ──
@router.get("/verifications")
async def get_verifications(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(Verification).order_by(Verification.created_at.desc()).limit(50))
    return [{"id": v.id, "type": v.type, "doer": v.doer, "action": v.action,
             "nt_amount": v.nt_amount, "status": v.status, "created_at": v.created_at}
            for v in result.scalars()]


@router.post("/verifications")
async def add_verification(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    v = Verification(
        id=req.get("id", f"vfy_{datetime.utcnow().timestamp()}"),
        type=req.get("type", ""), doer=req.get("doer", user.id),
        action=req.get("action", ""), detail=json.dumps(req.get("detail", {}), ensure_ascii=False),
        nt_amount=req.get("nt_amount", 0), verifier_reward=req.get("verifier_reward", 1),
        status="pending", created_at=datetime.utcnow().isoformat(),
    )
    db.add(v)
    await db.commit()
    return {"ok": True, "id": v.id}


@router.put("/verifications/{vfy_id}")
async def update_verification(vfy_id: str, req: dict, user: User = Depends(get_current_user),
                              db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(Verification).where(Verification.id == vfy_id))
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404)
    if v.doer != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能修改自己的校核记录")
    for key in ("status", "verifier", "verified_at", "reject_reason", "rejected_by", "rejected_at", "retry_count"):
        if key in req:
            setattr(v, key, req[key])
    await db.commit()
    return {"ok": True}


# ── Newbie Quests ──
@router.get("/newbie_quests")
async def get_newbie_quests(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(NewbieQuest).where(NewbieQuest.user == user.id))
    return [{"quest_id": q.quest_id, "name": q.name, "desc": q.desc,
             "nt": q.nt, "done": bool(q.done), "done_at": q.done_at} for q in result.scalars()]


@router.post("/newbie_quests")
async def init_newbie_quests(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    quests = req.get("quests", [])
    for q in quests:
        db.add(NewbieQuest(user=user.id, quest_id=q.get("id"), name=q.get("name"),
                           desc=q.get("desc"), nt=q.get("nt", 0), done=0))
    await db.commit()
    return {"ok": True}


@router.put("/newbie_quests/{quest_id}")
async def complete_newbie_quest(quest_id: str, user: User = Depends(get_current_user),
                                db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(NewbieQuest).where(
        NewbieQuest.user == user.id, NewbieQuest.quest_id == quest_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404)
    q.done = 1
    q.done_at = datetime.utcnow().isoformat()[:10]
    await db.commit()
    return {"ok": True}


# ── Canteen ──
@router.get("/canteen_menu")
async def get_canteen_menu(date: str = None, db: AsyncSession = Depends(get_db)):
    q = select(CanteenMenu)
    if date:
        q = q.where(CanteenMenu.date == date)
    result = await db.execute(q.order_by(CanteenMenu.date.desc()))
    return [{"date": m.date, "lunch": json.loads(m.lunch) if m.lunch else [],
             "dinner": json.loads(m.dinner) if m.dinner else []} for m in result.scalars()]


@router.post("/canteen_menu")
async def set_canteen_menu(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user or user.role != "admin":
        raise HTTPException(status_code=403)
    m = CanteenMenu(date=req.get("date", ""), lunch=json.dumps(req.get("lunch", []), ensure_ascii=False),
                    dinner=json.dumps(req.get("dinner", []), ensure_ascii=False))
    db.add(m)
    await db.commit()
    return {"ok": True}


@router.get("/meal_orders")
async def get_meal_orders(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(MealOrder).where(MealOrder.user == user.id).order_by(MealOrder.date.desc()))
    return [{"date": o.date, "meal": o.meal, "status": o.status,
             "ordered_at": o.ordered_at} for o in result.scalars()]


@router.post("/meal_orders")
async def add_meal_order(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    o = MealOrder(user=user.id, date=req.get("date", ""), meal=req.get("meal", "lunch"),
                  status="ordered", ordered_at=datetime.utcnow().isoformat())
    db.add(o)
    await db.commit()
    return {"ok": True}


# ── Map Locations ──
@router.get("/map_locations")
async def get_map_locations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MapLocation).where(MapLocation.key == "shared"))
    ml = result.scalar_one_or_none()
    if not ml:
        return {"buildings": [], "plots": [], "accommodations": {}, "people_on_site": [], "state": {}, "config": {}}
    return json.loads(ml.data) if ml.data else {}


@router.post("/map_locations")
async def save_map_locations(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user or user.role != "admin":
        raise HTTPException(status_code=403)
    result = await db.execute(select(MapLocation).where(MapLocation.key == "shared"))
    ml = result.scalar_one_or_none()
    if not ml:
        ml = MapLocation(key="shared")
        db.add(ml)
    ml.data = json.dumps(req, ensure_ascii=False)
    await db.commit()
    return {"ok": True}


# ── Announcements ──
@router.get("/announcements")
async def get_announcements(db: AsyncSession = Depends(get_db), limit: int = 20):
    result = await db.execute(select(Announcement).order_by(Announcement.id.desc()).limit(limit))
    return [{"type": a.type, "doer": a.doer, "action": a.action,
             "nt_amount": a.nt_amount, "created_at": a.created_at} for a in result.scalars()]


@router.post("/announcements")
async def add_announcement(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    a = Announcement(type=req.get("type", ""), doer=req.get("doer", ""),
                     verifier=req.get("verifier", ""), action=req.get("action", ""),
                     nt_amount=req.get("nt_amount", 0), created_at=datetime.utcnow().isoformat())
    db.add(a)
    await db.commit()
    return {"ok": True}


# ── Inventory ──
@router.get("/inventory")
async def get_inventory(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(InventoryItem).where(InventoryItem.user == user.id))
    return [{"id": i.id, "name": i.name, "cat": i.cat, "status": i.status,
             "price": i.price, "location": i.location, "desc": i.desc, "date": i.date}
            for i in result.scalars()]


@router.post("/inventory")
async def add_inventory(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    i = InventoryItem(id=req.get("id", f"i{datetime.utcnow().timestamp()}"), user=user.id,
                      name=req.get("name", ""), cat=req.get("cat", "其他"),
                      status=req.get("status", "storage"), price=req.get("price", 0),
                      location=req.get("location", ""), desc=req.get("desc", ""),
                      date=req.get("date", ""))
    db.add(i)
    await db.commit()
    return {"ok": True}

# ══ 全量同步：登录时客户端拉取所有数据 ══
@router.get("/sync_all")
async def sync_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user: raise HTTPException(status_code=401)
    # 我的任务
    tasks_r = await db.execute(select(NTTask).order_by(NTTask.created_at.desc()))
    my_tasks = [{"id": t.id, "title": t.title, "reward": t.reward, "category": t.category,
                 "scope": t.scope, "status": t.status, "poster": t.poster, "assignee": t.assignee,
                 "slots": t.slots, "deadline": t.deadline, "reviewer": t.reviewer,
                 "note": t.note, "evidence": t.evidence, "settler_id": t.settler_id,
                 "created_at": t.created_at} for t in tasks_r.scalars()]
    # 我的日记
    j_r = await db.execute(select(Journal).where(Journal.user == user.id).order_by(Journal.id.desc()).limit(200))
    journal = [{"type": j.type, "content": j.content, "time": j.time, "space_id": j.space_id} for j in j_r.scalars()]
    # 卡片发现（全社区共享）
    d_r = await db.execute(select(CardDiscovery).order_by(CardDiscovery.created_at.desc()).limit(100))
    discoveries = [{"id": d.id, "space_id": d.space_id, "description": d.description,
                    "guesser": d.guesser, "guessed_person": d.guessed_person,
                    "status": d.status, "nt_guesser": d.nt_guesser, "nt_doer": d.nt_doer,
                    "created_at": d.created_at} for d in d_r.scalars()]
    # 活动日志
    a_r = await db.execute(select(ActivityLog).order_by(ActivityLog.id.desc()).limit(50))
    activity = [{"time": a.time, "type": a.type, "text": a.text} for a in a_r.scalars()]
    # 我的物品
    i_r = await db.execute(select(InventoryItem).where(InventoryItem.user == user.id))
    items = [{"id": i.id, "name": i.name, "cat": i.cat, "status": i.status,
              "price": i.price, "location": i.location, "desc": i.desc} for i in i_r.scalars()]
    # 我的新手任务
    n_r = await db.execute(select(NewbieQuest).where(NewbieQuest.user == user.id))
    newbie = [{"quest_id": q.quest_id, "name": q.name, "nt": q.nt, "done": bool(q.done)} for q in n_r.scalars()]
    return {"tasks": my_tasks, "journal": journal, "discoveries": discoveries,
            "activity": activity, "items": items, "newbie": newbie}
