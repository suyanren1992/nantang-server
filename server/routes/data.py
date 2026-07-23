"""Data layer routes: journal, discoveries, canteen, map, verifications, etc."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import json
from database import get_db
from models import (Journal, ActivityLog, CardDiscovery, Verification, NewbieQuest,
                    CanteenMenu, MealOrder, MapLocation, Announcement, InventoryItem, User, NTTask, Camp, CommunityPool, TASK_STATUSES)
from routes.auth import get_current_user, require_admin
from pydantic import BaseModel, Field
from nt_helpers import _safe_assignees

router = APIRouter(prefix="/api/data", tags=["data"])


def _safe_json(s):
    try: return json.loads(s) if s else {}
    except (json.JSONDecodeError, TypeError): return {}


# ══ Pydantic Models (T9: req:dict → typed) ══
class JournalReq(BaseModel):
    type: str = Field(min_length=1, default="daily")
    content: str = Field(default="", max_length=10000)
    space_id: str = ""
    discovery_id: str = ""

class ActivityLogReq(BaseModel):
    type: str = Field(min_length=1)
    text: str = ""

class CardDiscoveryReq(BaseModel):
    space_id: str = ""
    description: str = ""
    guessed_person: str = ""
    guessed_at: str = ""
    status: str = "pending"
    nt_guesser: int = Field(default=5, ge=0, le=50)
    nt_doer: int = Field(default=10, ge=0, le=50)

class CardDiscoveryUpdateReq(BaseModel):
    status: str = ""
    doer_confirmed_at: str = ""
    doer_denied_at: str = ""

class VerificationReq(BaseModel):
    id: str = ""  # A-7: 接受客户端生成的 id，保证 approve 链路 id 一致
    type: str = Field(min_length=1)
    action: str = ""
    detail: dict = {}
    nt_amount: int = Field(default=0, ge=0, le=1000)
    verifier_reward: int = Field(default=1, ge=0, le=1000)

class VerificationUpdateReq(BaseModel):
    status: str = ""
    verifier: str = ""
    verified_at: str = ""
    reject_reason: str = ""
    rejected_by: str = ""
    rejected_at: str = ""
    retry_count: int = 0

class NewbieQuestItem(BaseModel):
    id: str = Field(min_length=1)
    name: str = ""
    desc: str = ""
    nt: int = 0

class NewbieQuestsReq(BaseModel):
    quests: list[NewbieQuestItem] = []

class CanteenMenuReq(BaseModel):
    date: str = Field(min_length=1)
    lunch: list[str] = []
    dinner: list[str] = []

class MealOrderReq(BaseModel):
    date: str = Field(min_length=1)
    meal: str = "lunch"

class MapLocationsReq(BaseModel):
    locations: str = ""  # JSON blob, minimal validation
    class Config:
        extra = "allow"  # allow additional fields for map data

class AnnouncementReq(BaseModel):
    type: str = Field(min_length=1)
    doer: str = ""
    verifier: str = ""
    action: str = ""
    nt_amount: int = 0

class InventoryReq(BaseModel):
    name: str = Field(min_length=1)
    cat: str = "其他"
    status: str = "storage"
    price: int = Field(default=0, ge=0, le=100000)
    location: str = ""
    desc: str = ""
    date: str = ""

# ── Journal ──
@router.get("/journal")
async def get_journal(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                      limit: int = 50):
    result = await db.execute(select(Journal).where(Journal.user == user.id).order_by(Journal.id.desc()).limit(limit))
    return [{"type": j.type, "content": j.content, "time": j.time,
             "space_id": j.space_id, "discovery_id": j.discovery_id} for j in result.scalars()]


@router.post("/journal")
async def add_journal(req: JournalReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    j = Journal(user=user.id, type=req.type, content=req.content,
                time=datetime.utcnow().isoformat(), space_id=req.space_id,
                discovery_id=req.discovery_id)
    db.add(j)
    await db.commit()
    return {"ok": True}


# ── Activity Log ──
@router.get("/activity_log")
async def get_activity_log(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db), limit: int = 20):
    result = await db.execute(select(ActivityLog).order_by(ActivityLog.id.desc()).limit(limit))
    return [{"time": a.time, "type": a.type, "text": a.text} for a in result.scalars()]


@router.post("/activity_log")
async def add_activity_log(req: ActivityLogReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = ActivityLog(time=datetime.utcnow().isoformat(), type=req.type,
                    text=req.text)
    db.add(a)
    await db.commit()
    return {"ok": True}


# ── Card Discoveries ──
@router.get("/card_discoveries")
async def get_card_discoveries(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CardDiscovery).order_by(CardDiscovery.created_at.desc()).limit(100))
    return [{"id": d.id, "space_id": d.space_id, "description": d.description,
             "guesser": d.guesser, "guessed_person": d.guessed_person,
             "status": d.status, "nt_guesser": d.nt_guesser, "nt_doer": d.nt_doer,
             "created_at": d.created_at} for d in result.scalars()]


@router.post("/card_discoveries")
async def add_card_discovery(req: CardDiscoveryReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    d = CardDiscovery(
        id=f"disc_{datetime.utcnow().timestamp()}",
        space_id=req.space_id, description=req.description,
        guesser=user.id, guessed_person=req.guessed_person,
        guessed_at=req.guessed_at, status=req.status,
        nt_guesser=req.nt_guesser, nt_doer=req.nt_doer,
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(d)
    await db.commit()
    return {"ok": True, "id": d.id}


@router.put("/card_discoveries/{disc_id}")
async def update_card_discovery(disc_id: str, req: CardDiscoveryUpdateReq, user: User = Depends(get_current_user),
                                db: AsyncSession = Depends(get_db)):
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
    q = select(Verification).order_by(Verification.created_at.desc()).limit(50)
    if user.role != "admin":
        q = q.where(Verification.doer == user.id)
    result = await db.execute(q)
    return [{"id": v.id, "type": v.type, "doer": v.doer, "action": v.action,
             "detail": _safe_json(v.detail),
             "nt_amount": v.nt_amount, "verifier_reward": v.verifier_reward,
             "status": v.status, "verifier": v.verifier, "verified_at": v.verified_at,
             "reject_reason": v.reject_reason, "retry_count": v.retry_count,
             "created_at": v.created_at}
            for v in result.scalars()]


@router.post("/verifications")
async def add_verification(req: VerificationReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # A-7: 客户端带 id 时优先使用并按 id 幂等——approve 链路靠客户端 id 查本表
    if req.id:
        existing = await db.execute(select(Verification).where(Verification.id == req.id))
        if existing.scalar_one_or_none():
            return {"ok": True, "id": req.id}
    v = Verification(
        id=req.id or f"vfy_{datetime.utcnow().timestamp()}",
        type=req.type, doer=user.id,
        action=req.action, detail=json.dumps(req.detail, ensure_ascii=False),
        nt_amount=req.nt_amount,
        verifier_reward=req.verifier_reward,
        status="pending", created_at=datetime.utcnow().isoformat(),
    )
    db.add(v)
    await db.commit()
    return {"ok": True, "id": v.id}


@router.put("/verifications/{vfy_id}")
async def update_verification(vfy_id: str, req: VerificationUpdateReq, user: User = Depends(get_current_user),
                              db: AsyncSession = Depends(get_db)):
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
    result = await db.execute(select(NewbieQuest).where(NewbieQuest.user == user.id))
    return [{"quest_id": q.quest_id, "name": q.name, "desc": q.desc,
             "nt": q.nt, "done": bool(q.done), "done_at": q.done_at} for q in result.scalars()]


@router.post("/newbie_quests")
async def init_newbie_quests(req: NewbieQuestsReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for q in req.quests:
        db.add(NewbieQuest(user=user.id, quest_id=q.id, name=q.name,
                           desc=q.desc, nt=q.nt, done=0))
    await db.commit()
    return {"ok": True}


@router.put("/newbie_quests/{quest_id}")
async def complete_newbie_quest(quest_id: str, user: User = Depends(get_current_user),
                                db: AsyncSession = Depends(get_db)):
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
    items = []
    for m in result.scalars():
        try: lunch = json.loads(m.lunch) if m.lunch else []
        except (json.JSONDecodeError, TypeError): lunch = []
        try: dinner = json.loads(m.dinner) if m.dinner else []
        except (json.JSONDecodeError, TypeError): dinner = []
        items.append({"date": m.date, "lunch": lunch, "dinner": dinner})
    return items


@router.post("/canteen_menu")
async def set_canteen_menu(req: CanteenMenuReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user or user.role != "admin":
        raise HTTPException(status_code=403)
    m = CanteenMenu(date=req.date, lunch=json.dumps(req.lunch, ensure_ascii=False),
                    dinner=json.dumps(req.dinner, ensure_ascii=False))
    db.add(m)
    await db.commit()
    return {"ok": True}


@router.get("/meal_orders")
async def get_meal_orders(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MealOrder).where(MealOrder.user == user.id).order_by(MealOrder.date.desc()))
    return [{"date": o.date, "meal": o.meal, "status": o.status,
             "ordered_at": o.ordered_at} for o in result.scalars()]


@router.post("/meal_orders")
async def add_meal_order(req: MealOrderReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    o = MealOrder(user=user.id, date=req.date, meal=req.meal,
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
    try: return json.loads(ml.data) if ml.data else {}
    except (json.JSONDecodeError, TypeError): return {}


@router.post("/map_locations")
async def save_map_locations(req: MapLocationsReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user or user.role != "admin":
        raise HTTPException(status_code=403)
    result = await db.execute(select(MapLocation).where(MapLocation.key == "shared"))
    ml = result.scalar_one_or_none()
    if not ml:
        ml = MapLocation(key="shared")
        db.add(ml)
    ml.data = json.dumps(req.model_dump(), ensure_ascii=False)
    await db.commit()
    return {"ok": True}


# ── Announcements ──
@router.get("/announcements")
async def get_announcements(db: AsyncSession = Depends(get_db), limit: int = 20):
    result = await db.execute(select(Announcement).order_by(Announcement.id.desc()).limit(limit))
    return [{"type": a.type, "doer": a.doer, "action": a.action,
             "nt_amount": a.nt_amount, "created_at": a.created_at} for a in result.scalars()]


@router.post("/announcements")
async def add_announcement(req: AnnouncementReq, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    a = Announcement(type=req.type, doer=req.doer,
                     verifier=req.verifier, action=req.action,
                     nt_amount=req.nt_amount, created_at=datetime.utcnow().isoformat())
    db.add(a)
    await db.commit()
    return {"ok": True}


# ── Inventory ──
@router.get("/inventory")
async def get_inventory(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InventoryItem).where(InventoryItem.user == user.id))
    return [{"id": i.id, "name": i.name, "cat": i.cat, "status": i.status,
             "price": i.price, "location": i.location, "desc": i.desc, "date": i.date}
            for i in result.scalars()]


@router.post("/inventory")
async def add_inventory(req: InventoryReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    i = InventoryItem(id=f"i{datetime.utcnow().timestamp()}", user=user.id,
                      name=req.name, cat=req.cat,
                      status=req.status, price=req.price,
                      location=req.location, desc=req.desc,
                      date=req.date)
    db.add(i)
    await db.commit()
    return {"ok": True}

# ══ 统一共享数据推送 ══
@router.post("/sync_shared")
async def sync_shared(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 营地（仅管理员可创建）
    if req.get("camps") and isinstance(req.get("camps"), dict) and user.role == "admin":
        for camp_id, camp_data in req["camps"].items():
            existing = (await db.execute(select(Camp).where(Camp.id == camp_id))).scalar_one_or_none()
            if not existing:
                db.add(Camp(id=camp_id, name=camp_data.get("name",""), created_by=user.id,
                           created_at=datetime.utcnow().isoformat()))
    # 地图（仅管理员可覆盖）
    if req.get("map_locations") and user.role == "admin":
        ml = (await db.execute(select(MapLocation).where(MapLocation.key == "shared"))).scalar_one_or_none()
        if not ml:
            ml = MapLocation(key="shared"); db.add(ml)
        ml.data = json.dumps(req["map_locations"], ensure_ascii=False)
    # 食堂菜单（仅管理员可设置）
    if req.get("canteenMenu") and user.role == "admin":
        for date, menu in req["canteenMenu"].items():
            existing = (await db.execute(select(CanteenMenu).where(CanteenMenu.date == date))).scalar_one_or_none()
            if not existing:
                db.add(CanteenMenu(date=date, lunch=json.dumps(menu.get("lunch",[]), ensure_ascii=False),
                                   dinner=json.dumps(menu.get("dinner",[]), ensure_ascii=False)))
    await db.commit()
    return {"ok": True}

# ══ 全量同步：登录时客户端拉取所有数据 ══
@router.get("/sync_all")
async def sync_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 我的任务
    tasks_r = await db.execute(
        select(NTTask).where(
            (NTTask.poster == user.id) | (NTTask.assignee == user.id) | (NTTask.assignees.like(f'%"{user.id}"%'))
        ).order_by(NTTask.created_at.desc())
    )
    my_tasks = [{"id": t.id, "title": t.title, "reward": t.reward, "category": t.category,
                 "scope": t.scope, "status": t.status, "poster": t.poster, "assignee": t.assignee,
                 "assignees": _safe_assignees(t), "slots": t.slots,
                 "deadline": t.deadline, "reviewer": t.reviewer,
                 "note": t.note, "evidence": t.evidence,
                 "escrow_amount": t.escrow_amount, "settler_id": t.settler_id,
                 "settled_at": t.settled_at,
                 "is_system_generated": t.is_system_generated or False,
                 "created_at": t.created_at} for t in tasks_r.scalars()]
    # 我的日记
    j_r = await db.execute(select(Journal).where(Journal.user == user.id).order_by(Journal.id.desc()).limit(200))
    journal = [{"type": j.type, "content": j.content, "time": j.time, "space_id": j.space_id, "discovery_id": j.discovery_id} for j in j_r.scalars()]
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
    # P2: 待校核记录（全社区 pending 状态）
    v_r = await db.execute(
        select(Verification).where(Verification.status == "pending")
        .order_by(Verification.created_at.desc()).limit(50)
    )
    verifications = [{"id": v.id, "type": v.type, "doer": v.doer, "action": v.action,
                      "detail": _safe_json(v.detail), "nt_amount": v.nt_amount,
                      "verifier_reward": v.verifier_reward, "status": v.status,
                      "retry_count": v.retry_count, "created_at": v.created_at}
                     for v in v_r.scalars()]
    pool_r = (await db.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
    pool_balance = pool_r.balance if pool_r else 0
    # 地图数据
    ml_r = (await db.execute(select(MapLocation).where(MapLocation.key == "shared"))).scalar_one_or_none()
    map_locations = _safe_json(ml_r.data) if ml_r else {}
    # 营地列表
    camps_r = await db.execute(select(Camp).order_by(Camp.created_at.desc()).limit(20))
    camps = [{"id": c.id, "name": c.name, "emoji": c.emoji, "theme": c.theme,
              "date": c.date, "status": c.status, "people": c.people, "max": c.max,
              "location": c.location, "desc": c.desc} for c in camps_r.scalars()]
    return {"tasks": my_tasks, "journal": journal, "discoveries": discoveries,
            "activity": activity, "items": items, "newbie": newbie,
            "verifications": verifications, "cron_active": True,
            "task_statuses": TASK_STATUSES,
            "pool_balance": pool_balance,
            "map_locations": map_locations,
            "camps": camps}
