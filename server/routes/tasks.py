"""Task CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from datetime import datetime
import secrets
import json
from database import get_db
from models import NTTask, User
from routes.auth import get_current_user, require_admin
from routes.nt import _ledger_id, _add_ledger, _adjust_trust, _get_pool
from nt_helpers import _safe_assignees

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    reward: int = Field(5, ge=1, le=10000)
    category: str = "other"
    scope: str = "社区"
    note: str = ""
    slots: int = Field(1, ge=1, le=10)
    deadline: str = ""
    reviewer: str = ""
    location_id: str = ""
    poster: str = ""  # 空=当前用户，"社区"=社区管理员发布
    req_photo: int = 0
    req_file: int = 0


class TaskUpdate(BaseModel):
    status: str | None = None
    assignee: str | None = None
    note: str | None = None
    evidence: str | None = None
    reject_reason: str | None = None
    settler_id: str | None = None


def _task_id():
    return f"T{datetime.utcnow().strftime('%y%m%d%H%M%S')}-{secrets.token_hex(3)}"


@router.get("")
async def list_tasks(scope: str = None, status: str = None, mode: str = Query(None),
                     user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    # ponytail: O(n) 全量扫描。用户数 <100 时无感，超百人后加 SQLite JSON 函数或关联表 assignee_tasks。
    if mode == "hall":
        # R1.3: 任务大厅模式——进行中的任务 + 在地过滤
        result = await db.execute(
            select(NTTask).order_by(NTTask.created_at.desc())
        )
        from routes.nt import _is_onsite
        is_onsite = await _is_onsite(db, user)
        tasks = [t for t in result.scalars() if t.status == "进行中"]
        if not is_onsite:
            tasks = [t for t in tasks if not t.is_system_generated]
    else:
        result = await db.execute(
            select(NTTask).where(
                (NTTask.poster == user.id) | (NTTask.assignee == user.id) | (NTTask.assignees.like(f'%"{user.id}"%'))
            ).order_by(NTTask.created_at.desc())
        )
        tasks = [t for t in result.scalars()]
    if scope:
        tasks = [t for t in tasks if t.scope == scope]
    if status:
        tasks = [t for t in tasks if t.status == status]
    return [{"id": t.id, "title": t.title, "reward": t.reward, "category": t.category,
             "scope": t.scope, "status": t.status, "poster": t.poster, "assignee": t.assignee, "assignees": t.assignees,
             "slots": t.slots, "deadline": t.deadline, "reviewer": t.reviewer,
             "location_id": t.location_id, "note": t.note, "evidence": t.evidence,
             "reject_reason": t.reject_reason, "settler_id": t.settler_id,
             "is_system_generated": t.is_system_generated,
             "created_at": t.created_at, "accepted_at": t.accepted_at, "completed_at": t.completed_at,
             "settled_at": t.settled_at} for t in tasks]


@router.post("")
async def create_task(req: TaskCreate, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if req.reward <= 0:
        raise HTTPException(status_code=400, detail="奖励必须大于0")

    # R1.4: poster='社区' 分支——从社区池扣款
    if req.poster == "社区":
        if user.role not in ("admin", "builder"):
            raise HTTPException(status_code=403, detail="仅管理员可发布社区任务")
        pool = await _get_pool(db)
        if pool.balance < req.reward * req.slots:
            raise HTTPException(status_code=400, detail="社区池余额不足")
        pool.balance -= req.reward * req.slots
        pool.task_escrow += req.reward * req.slots
    elif req.scope == "camp":
        # F14: 营地任务预算走 camp_balance，不设 escrow
        pass
    else:
        if user.nt_balance < req.reward * req.slots:
            raise HTTPException(status_code=400, detail=f"余额不足（需 {req.reward * req.slots} NT，当前 {user.nt_balance}）")

    if req.reviewer and req.reviewer.strip():
        rv = (await db.execute(select(User).where(User.id == req.reviewer.strip()))).scalar_one_or_none()
        if not rv: raise HTTPException(status_code=400, detail="审核人不存在")

    task_id = _task_id()
    task_poster = req.poster or user.id
    task = NTTask(
        id=task_id, poster=task_poster, title=req.title, reward=req.reward,
        category=req.category, scope=req.scope, note=req.note,
        slots=req.slots, deadline=req.deadline, reviewer=req.reviewer,
        location_id=req.location_id, escrow_amount=req.reward * req.slots,
        status="进行中", created_at=datetime.utcnow().isoformat(),
    )
    # 仅个人发布时从用户余额扣款（社区任务已在上面从池扣款）
    if req.poster != "社区":
        user.nt_balance -= req.reward * req.slots
        pool = await _get_pool(db)
        pool.task_escrow += req.reward * req.slots
    db.add(task)
    lid = _ledger_id()
    freeze_from = "community_pool" if req.poster == "社区" else user.id
    await _add_ledger(db, lid, freeze_from, "escrow", req.reward * req.slots, "task_freeze", f"创建任务: {req.title}", task_id, "pending")
    await db.commit()
    return {"ok": True, "task_id": task_id}


@router.put("/{task_id}")
async def update_task(task_id: str, req: TaskUpdate, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NTTask).where(NTTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能修改自己的任务")
    if req.status:
        raise HTTPException(status_code=400, detail="状态请通过专用端点变更: /api/nt/tasks/{id}/cancel|submit|verify")
    if req.assignee:
        task.assignee = req.assignee
    if req.note:
        task.note = req.note
    if req.evidence:
        task.evidence = req.evidence
    if req.reject_reason:
        task.reject_reason = req.reject_reason
    if req.settler_id:
        task.settler_id = req.settler_id
    await db.commit()
    return {"ok": True, "status": task.status}


@router.delete("/{task_id}")
async def delete_task(task_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404)
    if task.status in ("待结算", "已结算", "已取消", "已争议"):
        raise HTTPException(status_code=400, detail=f"不可删除状态: {task.status}")
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能删除自己的任务")
    # Refund escrow if task was active
    if task.escrow_amount > 0 and task.status != "已结算":
        poster_result = await db.execute(select(User).where(User.id == task.poster))
        poster = poster_result.scalar_one_or_none()
        pool = await _get_pool(db)
        if poster:
            poster.nt_balance += task.escrow_amount
        else:
            pool.balance += task.escrow_amount
        pool.task_escrow -= task.escrow_amount
        lid = _ledger_id()
        refund_target = task.poster if poster else "community_pool"
        await _add_ledger(db, lid, "escrow", refund_target, task.escrow_amount,
                         "task_cancelled", f"删除任务: {task.title}", task_id, status="settled")
    await db.delete(task)
    await db.commit()
    return {"ok": True}
