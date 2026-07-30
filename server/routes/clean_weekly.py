# -*- coding: utf-8 -*-
"""CLEAN-WEEKLY-BE: 大扫除周任务——发放/认领/提交/校核闭环。"""
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from database import get_db
from models import (User, CleanWeeklyTask, CleanWeeklyDistribution,
                    Verification, CommunityPool)
from routes.auth import get_current_user, require_admin
from nt_helpers import _add_ledger, _ledger_id

router = APIRouter(prefix="/api/clean_weekly", tags=["clean_weekly"])


# ══ Pydantic 请求体 ══
class DistributeReq(BaseModel):
    week_start_date: str = Field(min_length=10, description="YYYY-MM-DD（周一日期）")
    space_ids: list[str] = Field(min_length=1)
    space_names: list[str] = []       # 与 space_ids 等长的显示名列表
    mode: str = "even"                # even | by_count
    distribute_at: str = ""           # 可选，计划发放时间
    reward_nt: int = Field(default=15, ge=1, le=100)


# ══ ④ POST /distribute — 管理员批量建任务 ══
@router.post("/distribute")
async def distribute_tasks(req: DistributeReq,
                           user: User = Depends(require_admin),
                           db: AsyncSession = Depends(get_db)):
    """管理员选空间 → 建 distribution + N 个 task（status='open'）。"""
    # 幂等：同周已发放过 → 拒绝
    existing = await db.execute(
        select(CleanWeeklyDistribution).where(
            CleanWeeklyDistribution.week_start_date == req.week_start_date
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400,
                            detail=f"本周（{req.week_start_date}）已发放过打扫任务")

    now = datetime.utcnow().isoformat()
    dist_id = f"cwd_{req.week_start_date}_{int(datetime.utcnow().timestamp())}"

    # 建 distribution 记录
    dist = CleanWeeklyDistribution(
        id=dist_id,
        week_start_date=req.week_start_date,
        distribute_at=req.distribute_at or now,
        space_ids=json.dumps(req.space_ids, ensure_ascii=False),
        mode=req.mode,
        created_by=user.id,
        created_at=now,
    )
    db.add(dist)

    # 建 N 个 task
    names = req.space_names if len(req.space_names) == len(req.space_ids) else [""] * len(req.space_ids)
    task_ids = []
    for i, (sid, sname) in enumerate(zip(req.space_ids, names)):
        tid = f"cwt_{req.week_start_date}_{sid}_{i}"
        t = CleanWeeklyTask(
            id=tid,
            week_start_date=req.week_start_date,
            space_id=sid,
            space_name=sname or sid,
            reward_nt=req.reward_nt,
            status="open",
            created_by=user.id,
            created_at=now,
        )
        db.add(t)
        task_ids.append(tid)

    await db.commit()
    return {"ok": True, "distribution_id": dist_id,
            "tasks_created": len(task_ids), "task_ids": task_ids}


# ══ ⑤ GET /tasks — 轮询端点（FE 3 秒拉） ══
@router.get("/tasks")
async def list_tasks(week: str = "",
                     user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    """返回本周所有 task + 状态 + claimed_by 信息。"""
    if not week:
        # 默认本周：找最近一个周一
        today = datetime.utcnow().date()
        week = str(today - timedelta(days=today.weekday()))

    q = select(CleanWeeklyTask).where(
        CleanWeeklyTask.week_start_date == week
    ).order_by(CleanWeeklyTask.created_at)
    result = await db.execute(q)
    tasks = []
    for t in result.scalars():
        tasks.append({
            "id": t.id,
            "week_start_date": t.week_start_date,
            "space_id": t.space_id,
            "space_name": t.space_name,
            "reward_nt": t.reward_nt,
            "status": t.status,
            "claimed_by": t.claimed_by,
            "claimed_at": t.claimed_at,
            "verification_id": t.verification_id,
            "created_at": t.created_at,
        })
    return {"week": week, "tasks": tasks}


# ══ ⑥ POST /claim/{task_id} — CAS 认领 ══
@router.post("/claim/{task_id}")
async def claim_task(task_id: str,
                     user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    """CAS 更新：status=open → claimed, claimed_by=current_user。"""
    # 行锁（PG 有效，SQLite 静默降级但单写者保护）
    r = await db.execute(
        select(CleanWeeklyTask).where(CleanWeeklyTask.id == task_id)
        .with_for_update().execution_options(populate_existing=True)
    )
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "open":
        raise HTTPException(status_code=400,
                            detail=f"任务已被认领或完成（当前状态: {task.status}）")

    # 用户本周不能领多个任务
    dup = await db.execute(
        select(CleanWeeklyTask).where(
            CleanWeeklyTask.week_start_date == task.week_start_date,
            CleanWeeklyTask.claimed_by == user.id,
            CleanWeeklyTask.status.in_(("claimed", "completed")),
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400,
                            detail="你本周已认领过打扫任务")

    task.status = "claimed"
    task.claimed_by = user.id
    task.claimed_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True, "task_id": task.id, "status": "claimed"}


# ══ ⑦ POST /unclaim/{task_id} — 取消认领 ══
@router.post("/unclaim/{task_id}")
async def unclaim_task(task_id: str,
                       user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    """CAS 更新：status=claimed → open, claimed_by=null。仅本人可操作。截止周日 23:59。"""
    r = await db.execute(
        select(CleanWeeklyTask).where(CleanWeeklyTask.id == task_id)
        .with_for_update().execution_options(populate_existing=True)
    )
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "claimed":
        raise HTTPException(status_code=400,
                            detail=f"只能取消已认领的任务（当前状态: {task.status}）")
    if task.claimed_by != user.id:
        raise HTTPException(status_code=403, detail="只能取消自己认领的任务")

    # 截止时间：周日 23:59（week_start_date + 6 天 + 23:59:59）
    from datetime import date as date_type
    try:
        ws = datetime.strptime(task.week_start_date, "%Y-%m-%d").date()
    except ValueError:
        ws = datetime.utcnow().date() - timedelta(days=datetime.utcnow().weekday())
    deadline = datetime.combine(ws + timedelta(days=6), datetime.max.time())
    if datetime.utcnow() > deadline:
        raise HTTPException(status_code=400,
                            detail="已超过取消截止时间（周日 23:59）")

    task.status = "open"
    task.claimed_by = None
    task.claimed_at = None
    await db.commit()
    return {"ok": True, "task_id": task.id, "status": "open"}


# ══ ⑧⑨ POST /submit/{task_id} — 提交校核（走 addVerification 闭环） ══
@router.post("/submit/{task_id}")
async def submit_task(task_id: str,
                      user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    """走 addVerification 校核闭环：建 Verification → 等 peer 校核 → approve 后 task completed。"""
    r = await db.execute(
        select(CleanWeeklyTask).where(CleanWeeklyTask.id == task_id)
        .with_for_update().execution_options(populate_existing=True)
    )
    task = r.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "claimed":
        raise HTTPException(status_code=400,
                            detail=f"只能提交已认领的任务（当前状态: {task.status}）")
    if task.claimed_by != user.id:
        raise HTTPException(status_code=403, detail="只能提交自己认领的任务")

    # 幂等：已有 verification_id → 直接返回
    if task.verification_id:
        return {"ok": True, "verification_id": task.verification_id}

    now = datetime.utcnow()
    vfy_id = f"cwt_vfy_{task_id}_{int(now.timestamp())}"
    detail = json.dumps({
        "clean_weekly_task_id": task.id,
        "space_id": task.space_id,
        "space_name": task.space_name,
        "week": task.week_start_date,
    }, ensure_ascii=False)

    vfy = Verification(
        id=vfy_id,
        type="clean_weekly",
        doer=user.id,
        action=f"打扫 {task.space_name}",
        detail=detail,
        nt_amount=task.reward_nt,
        verifier_reward=max(1, task.reward_nt // 5),
        status="pending",
        created_at=now.isoformat(),
    )
    db.add(vfy)
    task.verification_id = vfy_id
    await db.commit()
    return {"ok": True, "verification_id": vfy_id,
            "nt_amount": task.reward_nt}
