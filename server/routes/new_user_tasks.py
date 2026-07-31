"""NEW-USER-TASK-BE: 新人任务路由（模板查询 / 手动派发 / 我的任务 / 完成校核）。

首次入住自动派发逻辑在 routes/accommodation.py checkin 路径调用 _auto_assign_newbie_tasks。
校核闭环走 addVerification（approve 后 nt.py 钩子标记 task 待结算）。
结算：CV = floor(nt/2) + XP 公式（A-LABOR-BE 已落地，不重建）。
"""
import json
import logging
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import (
    User, NTTask, Verification, NewUserTaskTemplate,
    TASK_STATUSES, compute_cv,
)
from routes.auth import get_current_user, require_admin
from nt_helpers import _ledger_id

logger = logging.getLogger("new_user_tasks")

router = APIRouter(prefix="/api/new_user_tasks", tags=["new_user_tasks"])


# ══ 内部：派发内核（checkin + 手动派发共用）══

async def _auto_assign_newbie_tasks(
    db: AsyncSession, user: User,
) -> list[dict]:
    """按 user.role 拉模板并批量建任务。返回新建任务列表。
    调用方负责 commit。"""
    templates_r = await db.execute(
        select(NewUserTaskTemplate)
        .where(NewUserTaskTemplate.target_role == user.role)
        .order_by(NewUserTaskTemplate.display_order)
    )
    templates = list(templates_r.scalars())
    if not templates:
        return []

    now = datetime.utcnow()
    created = []
    for tpl in templates:
        expires_at = (now + timedelta(days=tpl.expires_days or 7)).isoformat()
        task_id = f"newbie_{user.id}_{tpl.id}_{secrets.token_hex(3)}"
        task = NTTask(
            id=task_id,
            poster="系统",
            assignee=user.id,
            assignees=json.dumps([user.id], ensure_ascii=False),
            title=tpl.title,
            reward=tpl.reward_nt,
            status=TASK_STATUSES["open"],
            category="newbie",
            scope="社区",
            note=tpl.description,
            slots=1,
            is_newbie_task=True,
            assigned_by_system=True,
            template_id=tpl.id,
            created_at=now.isoformat(),
            deadline=expires_at,
        )
        db.add(task)
        created.append({
            "id": task_id,
            "title": tpl.title,
            "reward_nt": tpl.reward_nt,
            "expires_at": expires_at,
            "template_id": tpl.id,
        })
    return created


# ══ ① GET /templates ══

@router.get("/templates")
async def list_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拉取新人任务模板。admin 看全部，其他人只看 target_role=自己。"""
    if user.role == "admin":
        q = select(NewUserTaskTemplate).order_by(NewUserTaskTemplate.display_order)
    else:
        q = (
            select(NewUserTaskTemplate)
            .where(NewUserTaskTemplate.target_role == user.role)
            .order_by(NewUserTaskTemplate.display_order)
        )
    rows = (await db.execute(q)).scalars()
    return {
        "ok": True,
        "templates": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "reward_nt": t.reward_nt,
                "target_role": t.target_role,
                "display_order": t.display_order,
                "expires_days": t.expires_days,
            }
            for t in rows
        ],
    }


# ══ ② POST /assign ══

class AssignRequest(BaseModel):
    user_id: str
    template_ids: list[str] | None = None  # 空=全部


@router.post("/assign")
async def assign_newbie_tasks(
    req: AssignRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """admin 手动触发派发（测试 / 补发用）。"""
    target = (await db.execute(
        select(User).where(User.id == req.user_id)
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="目标用户不存在")

    if req.template_ids:
        # 指定模板
        tpl_r = await db.execute(
            select(NewUserTaskTemplate)
            .where(NewUserTaskTemplate.id.in_(req.template_ids))
            .order_by(NewUserTaskTemplate.display_order)
        )
        templates = list(tpl_r.scalars())
        now = datetime.utcnow()
        created = []
        for tpl in templates:
            expires_at = (now + timedelta(days=tpl.expires_days or 7)).isoformat()
            task_id = f"newbie_{target.id}_{tpl.id}_{secrets.token_hex(3)}"
            db.add(NTTask(
                id=task_id, poster="系统", assignee=target.id,
                assignees=json.dumps([target.id], ensure_ascii=False),
                title=tpl.title, reward=tpl.reward_nt,
                status=TASK_STATUSES["open"], category="newbie",
                scope="社区", note=tpl.description, slots=1,
                is_newbie_task=True, assigned_by_system=True,
                template_id=tpl.id, created_at=now.isoformat(),
                deadline=expires_at,
            ))
            created.append({"id": task_id, "title": tpl.title,
                            "reward_nt": tpl.reward_nt, "template_id": tpl.id})
    else:
        created = await _auto_assign_newbie_tasks(db, target)

    await db.commit()
    return {"ok": True, "tasks_created": len(created), "tasks": created}


# ══ ③ GET /me ══

@router.get("/me")
async def my_newbie_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拉当前用户的新人任务（is_newbie_task=true）。"""
    now = datetime.utcnow().isoformat()
    rows = (await db.execute(
        select(NTTask)
        .where(
            NTTask.is_newbie_task == True,
            NTTask.assignee == user.id,
        )
        .order_by(NTTask.created_at)
    )).scalars()

    tasks = []
    for t in rows:
        expired = t.deadline and t.deadline < now and t.status == TASK_STATUSES["open"]
        tasks.append({
            "id": t.id,
            "title": t.title,
            "description": t.note,
            "reward_nt": t.reward,
            "status": t.status,
            "is_newbie_task": True,
            "template_id": t.template_id,
            "created_at": t.created_at,
            "deadline": t.deadline,
            "expired": expired,
            "expires_in_hours": (
                max(0, round(
                    (datetime.fromisoformat(t.deadline) - datetime.utcnow()).total_seconds() / 3600, 1
                ))
                if t.deadline and t.deadline >= now else 0
            ) if t.status == TASK_STATUSES["open"] else None,
        })
    return {"ok": True, "tasks": tasks}


# ══ ④ PATCH /:id/complete ══

@router.patch("/{task_id}/complete")
async def complete_newbie_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """提交新人任务 → 建 Verification 记录，等待 peer 校核。
    reward_nt 从 template 取（不信客户端）。"""
    task = (await db.execute(
        select(NTTask)
        .where(NTTask.id == task_id)
        .with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if not task.is_newbie_task:
        raise HTTPException(status_code=400, detail="非新人任务")
    if task.assignee != user.id:
        raise HTTPException(status_code=403, detail="只有任务执行者可以提交")
    if task.status != TASK_STATUSES["open"]:
        raise HTTPException(status_code=400, detail=f"任务状态不可提交: {task.status}")

    # 过期检查
    if task.deadline and task.deadline < datetime.utcnow().isoformat():
        raise HTTPException(status_code=400, detail="任务已过期")

    # 从 template 取权威金额
    tpl = (await db.execute(
        select(NewUserTaskTemplate).where(NewUserTaskTemplate.id == task.template_id)
    )).scalar_one_or_none() if task.template_id else None
    reward_nt = tpl.reward_nt if tpl else task.reward

    # 建 Verification 记录
    vfy_id = f"vfy_newbie_{task_id}_{secrets.token_hex(3)}"
    vfy = Verification(
        id=vfy_id,
        type="newbie_task",
        doer=user.id,
        action=f"新人任务: {task.title}",
        detail=json.dumps({
            "newbie_task_id": task_id,
            "template_id": task.template_id,
        }, ensure_ascii=False),
        nt_amount=reward_nt,
        verifier_reward=1,
        status="pending",
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(vfy)

    # 任务状态 → 待审核
    task.status = TASK_STATUSES["submitted"]
    task.completed_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True, "verification_id": vfy_id, "reward_nt": reward_nt,
            "status": task.status}
