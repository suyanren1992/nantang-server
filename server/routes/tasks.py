"""Task CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from datetime import datetime
import secrets
from database import get_db
from models import NTTask, User
from routes.auth import get_current_user, require_admin
from routes.nt import _ledger_id, _add_ledger, _adjust_trust, _get_pool

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    title: str
    reward: int = 5
    category: str = "other"
    scope: str = "社区"
    note: str = ""
    slots: int = Field(1, ge=1, le=100)
    deadline: str = ""
    reviewer: str = ""
    location_id: str = ""
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
async def list_tasks(scope: str = None, status: str = None, user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(NTTask).order_by(NTTask.created_at.desc()))
    tasks = list(result.scalars())
    if scope:
        tasks = [t for t in tasks if t.scope == scope]
    if status:
        tasks = [t for t in tasks if t.status == status]
    return [{"id": t.id, "title": t.title, "reward": t.reward, "category": t.category,
             "scope": t.scope, "status": t.status, "poster": t.poster, "assignee": t.assignee,
             "slots": t.slots, "deadline": t.deadline, "reviewer": t.reviewer,
             "location_id": t.location_id, "note": t.note, "evidence": t.evidence,
             "reject_reason": t.reject_reason, "settler_id": t.settler_id,
             "created_at": t.created_at, "accepted_at": t.accepted_at, "completed_at": t.completed_at,
             "settled_at": t.settled_at} for t in tasks]


@router.post("")
async def create_task(req: TaskCreate, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    if req.reward <= 0:
        raise HTTPException(status_code=400, detail="奖励必须大于0")
    if user.nt_balance < req.reward:
        raise HTTPException(status_code=400, detail=f"余额不足（需 {req.reward} NT，当前 {user.nt_balance}）")

    if req.reviewer and req.reviewer.strip():
        rv = (await db.execute(select(User).where(User.id == req.reviewer.strip()))).scalar_one_or_none()
        if not rv: raise HTTPException(status_code=400, detail="审核人不存在")

    task_id = _task_id()
    task = NTTask(
        id=task_id, poster=user.id, title=req.title, reward=req.reward,
        category=req.category, scope=req.scope, note=req.note,
        slots=req.slots, deadline=req.deadline, reviewer=req.reviewer,
        location_id=req.location_id, escrow_amount=req.reward,
        status="进行中", created_at=datetime.utcnow().isoformat(),
    )
    user.nt_balance -= req.reward
    pool = await _get_pool(db)
    pool.task_escrow += req.reward
    db.add(task)
    lid = _ledger_id()
    await _add_ledger(db, lid, user.id, "escrow", req.reward, "task_freeze", f"创建任务: {req.title}", task_id, "pending")
    await db.commit()
    return {"ok": True, "task_id": task_id}


@router.put("/{task_id}")
async def update_task(task_id: str, req: TaskUpdate, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(NTTask).where(NTTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能修改自己的任务")
    old_status = task.status  # 保存旧状态
    if req.status:
        task.status = req.status
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
    if req.status == "已结算" and old_status != "已结算":
        task.settled_at = datetime.utcnow().isoformat()
    if req.status == "待审核" and old_status != "待审核":
        task.completed_at = datetime.utcnow().isoformat()
    if req.status == "退回修改":
        task.completed_at = None
    await db.commit()
    return {"ok": True, "status": task.status}


@router.delete("/{task_id}")
async def delete_task(task_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(NTTask).where(NTTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404)
    if task.status in ("待结算", "已结算"):
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
    await db.delete(task)
    await db.commit()
    return {"ok": True}
