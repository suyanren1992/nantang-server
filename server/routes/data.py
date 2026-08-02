"""Data layer routes: journal, discoveries, canteen, map, verifications, etc."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
import json
from database import get_db
from models import (Journal, ActivityLog, CardDiscovery, Verification, NewbieQuest,
                    CanteenMenu, MealOrder, MapLocation, Announcement, InventoryItem, User, NTTask, Camp, CommunityPool, Tenancy, FieldPlot, TASK_STATUSES)
from routes.auth import get_current_user, require_admin
from pydantic import BaseModel, Field, AliasChoices
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
    id: str = ""
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
    # C-6: 客户端发的是 camelCase（ntAmount/verifierReward），两种命名都接受
    nt_amount: int = Field(default=0, ge=0, le=1000, validation_alias=AliasChoices("nt_amount", "ntAmount"))
    verifier_reward: int = Field(default=1, ge=0, le=1000, validation_alias=AliasChoices("verifier_reward", "verifierReward"))

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
    # D-16 M-16: 优先用客户端 id + 幂等去重（照 A-7 同修）
    disc_id = req.id if req.id else f"disc_{datetime.utcnow().timestamp()}"
    if req.id:
        existing = (await db.execute(select(CardDiscovery).where(CardDiscovery.id == req.id))).scalar_one_or_none()
        if existing:
            return {"ok": True, "id": existing.id}
    d = CardDiscovery(
        id=disc_id,
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
async def get_newbie_quests(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                            limit: int = 50, offset: int = 0):
    # BE-2③: 补分页，limit 上限 200
    result = await db.execute(
        select(NewbieQuest).where(NewbieQuest.user == user.id).limit(min(limit, 200)).offset(offset)
    )
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
async def get_canteen_menu(date: str = None, user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db),
                           limit: int = 50, offset: int = 0):
    # BE-2③: 补分页，limit 上限 200
    q = select(CanteenMenu)
    if date:
        q = q.where(CanteenMenu.date == date)
    result = await db.execute(q.order_by(CanteenMenu.date.desc()).limit(min(limit, 200)).offset(offset))
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
async def get_meal_orders(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                          limit: int = 50, offset: int = 0):
    # BE-2③: 补分页，limit 上限 200
    result = await db.execute(
        select(MealOrder).where(MealOrder.user == user.id)
        .order_by(MealOrder.date.desc()).limit(min(limit, 200)).offset(offset)
    )
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
async def get_map_locations(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
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
async def get_announcements(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db), limit: int = 20):
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
async def get_inventory(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                        limit: int = 50, offset: int = 0):
    # BE-2③: 补分页，limit 上限 200
    result = await db.execute(
        select(InventoryItem).where(InventoryItem.user == user.id).limit(min(limit, 200)).offset(offset)
    )
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
    # D-8 第一步：兼容前端 camel/snake 混用（旧前端发 map_locations(snake) + canteenMenu(camel)）
    _ml = req.get("map_locations") or req.get("mapLocations")
    _cm = req.get("canteenMenu") or req.get("canteen_menu")
    # 营地（仅管理员可创建）
    if req.get("camps") and isinstance(req.get("camps"), dict) and user.role == "admin":
        for camp_id, camp_data in req["camps"].items():
            existing = (await db.execute(select(Camp).where(Camp.id == camp_id))).scalar_one_or_none()
            if not existing:
                db.add(Camp(id=camp_id, name=camp_data.get("name",""), created_by=user.id,
                           created_at=datetime.utcnow().isoformat()))
    # 地图（仅管理员可写——REDTEAM-B-B3: merge 而非覆写，保护 buildings 种子）
    if _ml:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="仅管理员可修改地图数据")
        ml = (await db.execute(select(MapLocation).where(MapLocation.key == "shared"))).scalar_one_or_none()
        if not ml:
            ml = MapLocation(key="shared"); db.add(ml)
        # REDTEAM-B-B3: deep_merge 保护种子——新数据 merge 到已有数据上
        from utils.merge import deep_merge
        _existing = json.loads(ml.data) if ml.data else {}
        _merged = deep_merge(_existing, _ml)
        ml.data = json.dumps(_merged, ensure_ascii=False)
    # 食堂菜单（仅管理员可设置）
    if _cm and user.role == "admin":
        for date, menu in _cm.items():
            existing = (await db.execute(select(CanteenMenu).where(CanteenMenu.date == date))).scalar_one_or_none()
            if not existing:
                db.add(CanteenMenu(date=date, lunch=json.dumps(menu.get("lunch",[]), ensure_ascii=False),
                                   dinner=json.dumps(menu.get("dinner",[]), ensure_ascii=False)))
    # D-12 返修: presence 翻牌状态——分用户 key 存储，防并发互踩
    _presence = req.get("presence")
    if _presence and isinstance(_presence, dict):
        for uid, pdata in _presence.items():
            if not isinstance(pdata, dict): continue
            # EMPIRICAL-🔴2.4: 所属权校验——非 admin 不得改他人 presence
            if uid != user.id and user.role != "admin":
                raise HTTPException(status_code=403, detail="无权修改他人在线状态")
            # updatedAt 防回写：只有更新的数据才覆盖
            pk = f"presence:{uid}"
            pr = (await db.execute(select(MapLocation).where(MapLocation.key == pk))).scalar_one_or_none()
            if not pr:
                pr = MapLocation(key=pk); db.add(pr)
            existing = json.loads(pr.data) if pr.data else {}
            if pdata.get("updatedAt", "") >= existing.get("updatedAt", ""):
                pr.data = json.dumps(pdata, ensure_ascii=False)
    # D-15: 公约修改同步
    _pcc = req.get("pendingConfigChanges")
    if _pcc and isinstance(_pcc, list):
        # IA-2: 公约配置变更写入仅限 admin（非 admin 写入硬拦）
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="仅管理员可修改公约配置变更")
        pc = (await db.execute(select(MapLocation).where(MapLocation.key == "config_changes"))).scalar_one_or_none()
        if not pc:
            pc = MapLocation(key="config_changes"); db.add(pc)
        pc.data = json.dumps(_pcc, ensure_ascii=False)
    _ch = req.get("configHistory")
    if _ch and isinstance(_ch, list):
        # IA-2: 公约修改历史写入仅限 admin
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="仅管理员可修改公约配置变更")
        ch = (await db.execute(select(MapLocation).where(MapLocation.key == "config_history"))).scalar_one_or_none()
        if not ch:
            ch = MapLocation(key="config_history"); db.add(ch)
        ch.data = json.dumps(_ch, ensure_ascii=False)
    # ══ DB-P1-3 ③: tasks 字段处理（前端本地任务 → 服务端 NTTask 兜底同步）══
    _tasks = req.get("tasks")
    if _tasks and isinstance(_tasks, dict):
        import uuid
        for _tname, tdata in _tasks.items():
            if not isinstance(tdata, dict):
                continue
            # 只处理自己的任务
            _poster = tdata.get("poster") or tdata.get("createdBy") or user.id
            if _poster != user.id:
                continue
            _title = tdata.get("title") or tdata.get("name") or _tname
            # 幂等：按 poster + title 查已有记录
            existing = (await db.execute(
                select(NTTask).where(NTTask.poster == user.id, NTTask.title == _title)
            )).scalars().first()
            if existing:
                continue  # 已有，跳过
            _task_id = tdata.get("_srvId") or tdata.get("id") or f"sync_{uuid.uuid4().hex[:8]}"
            # 防重：按 task_id 查
            dup = (await db.execute(
                select(NTTask).where(NTTask.id == _task_id)
            )).scalar_one_or_none()
            if dup:
                continue
            nt_task = NTTask(
                id=_task_id, poster=user.id,
                title=_title,
                reward=int(tdata.get("reward") or tdata.get("nt") or 0),
                status=tdata.get("status") or "draft",
                category=tdata.get("category") or "other",
                scope=tdata.get("scope") or "personal",
                note=tdata.get("note") or "",
                slots=int(tdata.get("slots") or 1),
                deadline=tdata.get("deadline"),
                reviewer=tdata.get("reviewer"),
                created_at=tdata.get("created_at") or datetime.utcnow().isoformat(),
            )
            db.add(nt_task)
    # ══ DB-P1-3 ③: users 字段处理（前端用户资料 → 服务端 User 同步）══
    _users = req.get("users")
    if _users and isinstance(_users, dict):
        # 本端只允许更新当前登录用户自己的资料
        _me = _users.get(user.id)
        if _me and isinstance(_me, dict):
            # 安全字段白名单（禁止修改 role/nt_balance/trust_score）
            _allowed = {
                "bio": ("bio", str),
                "location": ("location", str),
                "walletAddress": ("wallet_address", str),
                "wallet_address": ("wallet_address", str),
                "avatarSeed": ("avatar_seed", str),
                "avatar_seed": ("avatar_seed", str),
            }
            for _key, (_col, _typ) in _allowed.items():
                _val = _me.get(_key)
                if _val is not None and isinstance(_val, _typ) and hasattr(user, _col):
                    setattr(user, _col, str(_val) if _typ == str else _val)
            db.add(user)
    await db.commit()
    return {"ok": True}

# ══ 全量同步：登录时客户端拉取所有数据 ══
@router.get("/sync_all")
async def sync_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # 我的任务
    # D-16: LIKE 拼接前转义通配符（存量 %/_ 用户名不丢字，防注入看全量）
    _uid = user.id.replace('%', r'\%').replace('_', r'\_')
    tasks_r = await db.execute(
        select(NTTask).where(
            (NTTask.poster == user.id) | (NTTask.assignee == user.id) | (NTTask.assignees.like(f'%"{_uid}"%', escape='\\'))
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
    # W7-FIELD-SYNC: 田间地块数据从 FieldPlot 表直出（替代旧 map_locations.plots JSON blob）
    plots_r = await db.execute(select(FieldPlot).order_by(FieldPlot.id))
    plots = [{
        "id": p.id, "plot_name": p.plot_name, "crop_name": p.crop_name,
        "planted_at": p.planted_at, "harvest_at": p.harvest_at,
        "stage": p.stage, "health": p.health,
        "watered_at": p.watered_at, "fertilized_at": p.fertilized_at,
        "harvested_by": p.harvested_by, "planted_by": p.planted_by,
        "created_at": p.created_at,
    } for p in plots_r.scalars()]
    # 营地列表
    camps_r = await db.execute(select(Camp).order_by(Camp.created_at.desc()).limit(20))
    camps = [{"id": c.id, "name": c.name, "emoji": c.emoji, "theme": c.theme,
              "date": c.date, "status": c.status, "people": c.people, "max": c.max,
              "location": c.location, "desc": c.desc} for c in camps_r.scalars()]
    # D-12 返修: presence 翻牌状态——合并所有分用户 key
    pr_rows = (await db.execute(select(MapLocation).where(MapLocation.key.like("presence:%")))).scalars()
    presence = {}
    for pr in pr_rows:
        uid = pr.key.replace("presence:", "")
        pdata = _safe_json(pr.data) if pr.data else {}
        if pdata:
            presence[uid] = pdata
    # D-15: 公约修改同步
    pcc_r = (await db.execute(select(MapLocation).where(MapLocation.key == "config_changes"))).scalar_one_or_none()
    pendingConfigChanges = json.loads(pcc_r.data) if pcc_r and pcc_r.data else []
    ch_r = (await db.execute(select(MapLocation).where(MapLocation.key == "config_history"))).scalar_one_or_none()
    configHistory = json.loads(ch_r.data) if ch_r and ch_r.data else []
    return {"tasks": my_tasks, "journal": journal, "discoveries": discoveries,
            "activity": activity, "items": items, "newbie": newbie,
            "verifications": verifications, "cron_active": True,
            "task_statuses": TASK_STATUSES,
            "pool_balance": pool_balance,
            "map_locations": map_locations,
            "plots": plots,
            "camps": camps,
            "presence": presence,
            "pendingConfigChanges": pendingConfigChanges,
            "configHistory": configHistory}


# ── ZX-4 F12: 档案室个人内容沉淀（口径①保守：仅公开计数，不露 NT 金额明细/欠费）──
@router.get("/archive_summary/{target_id}")
async def archive_summary(target_id: str, user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    """按 user 聚合公开计数：完成任务数 / 完成校核数 / 住宿信息。
    砚仁终裁口径①：只吐非敏感计数，隐私边界与社区动态 Feed 一致——不含任何 NT 金额、欠费、流水明细。
    纯读，不改任何现有读/写口径；ledger/verification 敏感字段不出现在返回体。"""
    # 目标用户存在性（不存在也返回零计数，避免枚举报错）
    target = (await db.execute(select(User).where(User.id == target_id))).scalar_one_or_none()
    # LIKE ESCAPE：转义通配符 %/_ 而非删除（删除会破坏含下划线的合法用户名匹配，
    # 优于 D-4/D-16 的 replace 删字符法——既防注入又不损匹配）
    _esc = target_id.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')

    # 劳动：完成（已结算）任务数——user 为 assignee 或在 assignees JSON 中
    tasks_completed = (await db.execute(
        select(func.count()).select_from(NTTask).where(
            NTTask.status == "已结算",
            (NTTask.assignee == target_id) | (NTTask.assignees.like(f'%"{_esc}"%', escape='\\'))
        )
    )).scalar() or 0

    # 校核：作为校核员完成（verified）的校核数
    verifications_done = (await db.execute(
        select(func.count()).select_from(Verification).where(
            Verification.verifier == target_id, Verification.status == "verified"
        )
    )).scalar() or 0

    # 住宿：入住次数（tenancy 条数）+ 当前在住天数（active 记录 today-checkin）
    accommodation_stays = (await db.execute(
        select(func.count()).select_from(Tenancy).where(Tenancy.user_id == target_id)
    )).scalar() or 0
    accommodation_days = 0
    active = (await db.execute(
        select(Tenancy).where(Tenancy.user_id == target_id, Tenancy.status == "active")
    )).scalar_one_or_none()
    if active and active.checkin_date:
        try:
            ci = datetime.fromisoformat(active.checkin_date[:10]).date()
            accommodation_days = max((datetime.utcnow().date() - ci).days, 0)
        except (ValueError, TypeError):
            accommodation_days = 0

    return {
        "user_id": target_id,
        "exists": target is not None,
        "tasks_completed": tasks_completed,
        "verifications_done": verifications_done,
        "accommodation_stays": accommodation_stays,
        "accommodation_days": accommodation_days,
    }
