"""Task CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
import secrets
import json
from database import get_db
from models import NTTask, User, ActivityLog, TASK_STATUSES
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
async def list_tasks(response: Response, scope: str = None, status: str = None, mode: str = Query(None),
                     limit: int = 50, offset: int = 0,
                     user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    # ponytail: O(n) 全量扫描。用户数 <100 时无感，超百人后加 SQLite JSON 函数或关联表 assignee_tasks。
    # BE-2③: 过滤后在内存切片分页（limit 上限 200），先治"返回无上限"，全表扫描留待关联表方案。
    if mode == "hall":
        # R1.3: 任务大厅模式——进行中的任务 + 在地过滤
        result = await db.execute(
            select(NTTask).where(NTTask.status == "进行中").order_by(NTTask.created_at.desc())
        )
        from routes.nt import _is_onsite
        is_onsite = await _is_onsite(db, user)
        tasks = [t for t in result.scalars()]
        if not is_onsite:
            tasks = [t for t in tasks if not t.is_system_generated]
    else:
        # D-4 方案A: LIKE 拼接前转义通配符（存量 %/_ 用户名不丢字，防注入看全量）
        uid = user.id.replace('%', r'\%').replace('_', r'\_')
        result = await db.execute(
            select(NTTask).where(
                (NTTask.poster == user.id) | (NTTask.assignee == user.id) | (NTTask.assignees.like(f'%"{uid}"%', escape='\\'))
            ).order_by(NTTask.created_at.desc())
        )
        tasks = [t for t in result.scalars()]
    if scope:
        tasks = [t for t in tasks if t.scope == scope]
    if status:
        tasks = [t for t in tasks if t.status == status]
    # B-3: 切片前记录过滤后总数，经 X-Total-Count 暴露，前端据此翻页拉全（治"50条上限旧任务看不到"）
    response.headers["X-Total-Count"] = str(len(tasks))
    tasks = tasks[offset:offset + min(limit, 200)]
    return [{"id": t.id, "title": t.title, "reward": t.reward, "category": t.category,
             "scope": t.scope, "status": t.status, "poster": t.poster, "assignee": t.assignee, "assignees": t.assignees,
             "slots": t.slots, "deadline": t.deadline, "reviewer": t.reviewer,
             "location_id": t.location_id, "note": t.note, "evidence": t.evidence,
             "reject_reason": t.reject_reason, "settler_id": t.settler_id,
             "is_system_generated": t.is_system_generated,
             "is_newbie_task": getattr(t, "is_newbie_task", False),
             "created_at": t.created_at, "accepted_at": t.accepted_at, "completed_at": t.completed_at,
             "settled_at": t.settled_at} for t in tasks]


@router.post("")
async def create_task(req: TaskCreate, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    if req.reward <= 0:
        raise HTTPException(status_code=400, detail="奖励必须大于0")

    task_poster = req.poster or user.id

    # P0-2 幂等防重：同 poster+title+reward+slots+scope 在 60s 窗口内已存在任务，
    # 直接幂等返回既有 task_id（HTTP 200），不新建、不二次冻结——前端无感。
    # 排除已取消任务，允许撤单后重发；窗口外同名任务可正常创建。
    # 结论理由：P0-1 已删前端双调用，本层为第二道锁，兜住网络重试/双击等重复 POST；
    # 选 200 幂等返回而非 409——因为任务确已存在，返回错误会误导前端弹“发布失败”。
    _idem_window_sec = 60
    _idem_cutoff = (datetime.utcnow() - timedelta(seconds=_idem_window_sec)).isoformat()
    _dup = (await db.execute(
        select(NTTask).where(
            NTTask.poster == task_poster,
            NTTask.title == req.title,
            NTTask.reward == req.reward,
            NTTask.slots == req.slots,
            NTTask.scope == req.scope,
            NTTask.status != TASK_STATUSES["cancelled"],
            NTTask.created_at >= _idem_cutoff,
        ).order_by(NTTask.created_at.desc())
    )).scalars().first()
    if _dup is not None:
        return {"ok": True, "task_id": _dup.id, "idempotent": True}

    user_locked = None  # X2: 行锁引用，personal 分支内赋值

    # R1.4: poster='社区' 分支——从社区池扣款
    if req.poster == "社区":
        if user.role not in ("admin", "builder"):
            raise HTTPException(status_code=403, detail="仅管理员可发布社区任务")
        pool = await _get_pool(db, lock=True)  # 行锁：防并发社区任务超额扣池（对齐全项目锁型）
        if pool.balance < req.reward * req.slots:
            raise HTTPException(status_code=400, detail="社区池余额不足")
        pool.balance -= req.reward * req.slots
        pool.task_escrow += req.reward * req.slots
    elif req.scope == "camp":
        # F14: 营地任务预算走 camp_balance，不设 escrow
        pass
    else:
        user_locked = (await db.execute(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
        if not user_locked or user_locked.nt_balance < req.reward * req.slots:
            raise HTTPException(status_code=400, detail=f"余额不足（需 {req.reward * req.slots} NT，当前 {user_locked.nt_balance if user_locked else 0}）")

    if req.reviewer and req.reviewer.strip():
        rv = (await db.execute(select(User).where(User.id == req.reviewer.strip()))).scalar_one_or_none()
        if not rv: raise HTTPException(status_code=400, detail="审核人不存在")

    task_id = _task_id()
    task = NTTask(
        id=task_id, poster=task_poster, title=req.title, reward=req.reward,
        category=req.category, scope=req.scope, note=req.note,
        slots=req.slots, deadline=req.deadline, reviewer=req.reviewer,
        location_id=req.location_id, escrow_amount=(0 if req.scope == "camp" else req.reward * req.slots),
        status="进行中", created_at=datetime.utcnow().isoformat(),
    )
    # 仅个人发布时从用户余额扣款（社区任务已在上面从池扣款）
    if req.poster != "社区" and req.scope != "camp":
        (user_locked if user_locked is not None else user).nt_balance -= req.reward * req.slots
        pool = await _get_pool(db, lock=True)  # CR-2: 写路径补行锁
        pool.task_escrow += req.reward * req.slots
    db.add(task)
    lid = _ledger_id()
    if req.poster == "社区":
        freeze_from = "community_pool"
    elif req.scope == "camp":
        freeze_from = "camp_pool"
    else:
        freeze_from = user.id
    freeze_amount = 0 if req.scope == "camp" else req.reward * req.slots
    await _add_ledger(db, lid, freeze_from, "escrow", freeze_amount, "task_freeze", f"创建任务: {req.title}", task_id, "pending")
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
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update().execution_options(populate_existing=True))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404)
    if task.status in ("待结算", "已结算", "已取消", "已争议"):
        raise HTTPException(status_code=400, detail=f"不可删除状态: {task.status}")
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能删除自己的任务")
    # Refund escrow if task was active
    if task.escrow_amount > 0 and task.status != "已结算":
        poster_result = await db.execute(select(User).where(User.id == task.poster).with_for_update().execution_options(populate_existing=True))
        poster = poster_result.scalar_one_or_none()
        pool = await _get_pool(db, lock=True)  # CR-2: 写路径补行锁
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


# ══════════════════════════════════════════════════════════════════
# P1-1 任务撤回与退领端点（retract / retract-request / retract-review / unclaim）
# 来源：实测议单 T4 + T4T5C2 二营情报回执（00e51a4）——confirmUnclaim 死链、服务端无退领端点。
# 命名纪律：一律 retract/unclaim，禁 withdraw（避免与提现资金端点混淆）。
# 钱随单走：每笔解冻退款必写 nt_ledger，nt_balance 与 pool.task_escrow 同步增减。
# 禁区：withdraw/confirm/reject 零改动。
# ══════════════════════════════════════════════════════════════════

# 终态：不可撤回/不可退领（钱已流走或单已闭合）
_TERMINAL_STATUSES = ("待结算", "已结算", "已取消", "已争议")


async def _refund_task_escrow(db, task, reason_type, reason_text):
    """解冻退款铁律：task.escrow_amount → 发布者 nt_balance（发布者不存在或=社区则回社区池），
    pool.task_escrow 同步减，写 1 条 settled ledger。返回退款额（0 表示无托管金）。"""
    amount = task.escrow_amount or 0
    if amount <= 0:
        return 0
    pool = await _get_pool(db, lock=True)
    if task.poster == "社区":
        pool.balance += amount
        refund_target = "community_pool"
    else:
        poster = (await db.execute(
            select(User).where(User.id == task.poster)
            .with_for_update().execution_options(populate_existing=True)
        )).scalar_one_or_none()
        if poster:
            poster.nt_balance += amount
            refund_target = task.poster
        else:
            pool.balance += amount
            refund_target = "community_pool"
    pool.task_escrow -= amount
    lid = _ledger_id()
    await _add_ledger(db, lid, "escrow", refund_target, amount,
                      reason_type, reason_text, task.id, status="settled")
    task.escrow_amount = 0
    return amount


async def _log_activity(db, type_, text):
    """写活动日志（管理员经 /api/data/sync_all 的 activity 段 + /api/data/activity_log 可见）。"""
    db.add(ActivityLog(time=datetime.utcnow().isoformat(), type=type_, text=text))


@router.post("/{task_id}/retract")
async def retract_task(task_id: str, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    """发布者撤回。无人领→回草稿箱+解冻全额退款；已领未提交→409转申请制；已提交→409。"""
    task = (await db.execute(
        select(NTTask).where(NTTask.id == task_id)
        .with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能撤回自己发布的任务")
    if task.status in _TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail=f"任务状态不可撤回: {task.status}")
    if task.status == "草稿":
        raise HTTPException(status_code=409, detail="任务已在草稿箱")
    if task.status == "撤回申请中":
        raise HTTPException(status_code=409, detail="已有撤回申请，请等待管理员审批")
    if task.status == "待审核":
        raise HTTPException(status_code=409, detail="任务已提交待审核，不可撤回，请走校核/拒绝")
    assignees = _safe_assignees(task)
    if assignees:
        raise HTTPException(status_code=409, detail="任务已被领取，请使用 /retract-request 申请撤回")
    # 无人领 → 回草稿箱 + 解冻全额退款
    refunded = await _refund_task_escrow(db, task, "task_retract",
                                         f"撤回未领任务: {task.title}")
    task.status = "草稿"
    task.assignee = None
    task.assignees = None
    await _log_activity(db, "task_retract",
                        f"发布者「{user.id}」撤回未领任务「{task.title}」，解冻退款 {refunded} NT")
    await db.commit()
    return {"ok": True, "status": task.status, "refunded": refunded}


@router.post("/{task_id}/retract-request")
async def retract_request(task_id: str, user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    """已领未提交时，发布者申请撤回 → 状态『撤回申请中』，托管金保持冻结，待 admin 审批。"""
    task = (await db.execute(
        select(NTTask).where(NTTask.id == task_id)
        .with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只能对自己发布的任务申请撤回")
    if task.status in _TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail=f"任务状态不可撤回: {task.status}")
    if task.status == "撤回申请中":
        raise HTTPException(status_code=409, detail="已在撤回申请中")
    if task.status == "待审核":
        raise HTTPException(status_code=409, detail="任务已提交待审核，不可撤回，请走校核/拒绝")
    assignees = _safe_assignees(task)
    if not assignees:
        raise HTTPException(status_code=400, detail="任务无人领取，请直接使用 /retract 撤回")
    task.status = "撤回申请中"
    await _log_activity(db, "task_retract_request",
                        f"发布者「{user.id}」申请撤回已领任务「{task.title}」（领取者: {', '.join(assignees)}），待管理员审批")
    await db.commit()
    return {"ok": True, "status": task.status}


@router.post("/{task_id}/retract-review")
async def retract_review(task_id: str, approved: bool = Body(..., embed=True),
                         admin: User = Depends(require_admin),
                         db: AsyncSession = Depends(get_db)):
    """管理员审批撤回申请。批准=解冻退款+回草稿箱+通知领取者；拒绝=任务继续（回进行中）。"""
    task = (await db.execute(
        select(NTTask).where(NTTask.id == task_id)
        .with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "撤回申请中":
        raise HTTPException(status_code=400, detail=f"任务不在撤回申请中: {task.status}")
    assignees = _safe_assignees(task)
    if approved:
        refunded = await _refund_task_escrow(db, task, "task_retract",
                                             f"管理员批准撤回任务: {task.title}")
        task.status = "草稿"
        task.assignee = None
        task.assignees = None
        await _log_activity(db, "task_retract_approved",
                            f"管理员「{admin.id}」批准撤回任务「{task.title}」，解冻退款 {refunded} NT，"
                            f"领取者收到通知: {', '.join(assignees) or '无'}")
        await db.commit()
        return {"ok": True, "status": task.status, "refunded": refunded, "notified": assignees}
    # 拒绝 → 任务继续（回进行中，托管金原样冻结）
    task.status = "进行中"
    await _log_activity(db, "task_retract_rejected",
                        f"管理员「{admin.id}」拒绝撤回任务「{task.title}」，任务继续")
    await db.commit()
    return {"ok": True, "status": task.status}


@router.post("/{task_id}/unclaim")
async def unclaim_task(task_id: str, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    """领取者退领 → 移除自己、任务回大厅、记取消日志（管理员可见，v1 不限次数）。
    不动托管金：钱是发布者的、仍冻结，仅释放名额。"""
    task = (await db.execute(
        select(NTTask).where(NTTask.id == task_id)
        .with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    assignees = _safe_assignees(task)
    if user.id not in assignees:
        raise HTTPException(status_code=409, detail="你未领取此任务")
    if task.status == "待审核":
        raise HTTPException(status_code=409, detail="已提交待审核，不可退领")
    if task.status in _TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail=f"任务状态不可退领: {task.status}")
    assignees = [a for a in assignees if a != user.id]
    task.assignees = json.dumps(assignees) if assignees else None
    task.assignee = assignees[0] if assignees else None
    if task.status != "撤回申请中":
        task.status = "进行中"  # 回大厅
    await _log_activity(db, "task_unclaim",
                        f"「{user.id}」退领任务「{task.title}」，名额已释放回大厅")
    await db.commit()
    return {"ok": True, "status": task.status, "remaining_assignees": assignees}
