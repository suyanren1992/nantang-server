"""NT economy routes: transfer, earn, spend, topup, verify."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models import User, NTLedger, NTTask, CommunityPool
from routes.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/nt", tags=["nt"])


class TransferRequest(BaseModel):
    to: str
    amount: int
    reason: str = ""


class EarnSpendRequest(BaseModel):
    amount: int
    reason: str = ""
    scope: str = "personal"


class TopUpRequest(BaseModel):
    user: str
    amount: int
    reason: str = ""


class CreateTaskRequest(BaseModel):
    title: str
    reward: int
    category: str = "other"


def _ledger_id():
    now = datetime.utcnow()
    return f"L{now.strftime('%y%m%d')}-{now.strftime('%f')}"


async def _add_ledger(db: AsyncSession, entry_id: str, from_user: str | None, to_user: str | None,
                      amount: int, type_: str, reason: str = "", task_id: str = None, status: str = "settled"):
    entry = NTLedger(
        entry_id=entry_id,
        task_id=task_id,
        from_user=from_user,
        to_user=to_user,
        amount=amount,
        type=type_,
        reason=reason,
        status=status,
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(entry)


async def _adjust_trust(user: User, delta: int):
    user.trust_score = max(0, min(100, user.trust_score + delta))
    if user.trust_score >= 80:
        user.trust_level = "可信"
    elif user.trust_score >= 60:
        user.trust_level = "待观察"
    elif user.trust_score >= 40:
        user.trust_level = "受限"
    else:
        user.trust_level = "冻结"


async def _get_pool(db: AsyncSession) -> CommunityPool:
    result = await db.execute(select(CommunityPool).limit(1))
    pool = result.scalar_one_or_none()
    if not pool:
        pool = CommunityPool(balance=2000, total_issued=2000, task_escrow=0, contribution_pool=0, camp_balance=0, updated_at=datetime.utcnow().isoformat())
        db.add(pool)
        await db.flush()
    return pool


@router.get("/balance")
async def get_balance(user: User = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401)
    return {"balance": user.nt_balance, "cv": user.contribution_value, "xp": user.experience_value}


@router.get("/ledger")
async def get_ledger(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                     limit: int = 50, type: str = None):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(
        select(NTLedger).where(
            (NTLedger.from_user == user.id) | (NTLedger.to_user == user.id)
        ).order_by(NTLedger.id.desc()).limit(limit)
    )
    entries = list(result.scalars())
    if type:
        entries = [e for e in entries if e.type == type]
    return [
        {"entry_id": e.entry_id, "from": e.from_user, "to": e.to_user,
         "amount": e.amount, "type": e.type, "reason": e.reason,
         "status": e.status, "timestamp": e.created_at, "task_id": e.task_id}
        for e in entries
    ]


@router.post("/transfer")
async def transfer(req: TransferRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")
    if user.nt_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"余额不足（当前 {user.nt_balance} NT）")

    to_result = await db.execute(select(User).where(User.id == req.to))
    to_user = to_result.scalar_one_or_none()
    if not to_user:
        raise HTTPException(status_code=404, detail="目标用户不存在")

    user.nt_balance -= req.amount
    to_user.nt_balance += req.amount
    user.updated_at = datetime.utcnow().isoformat()
    to_user.updated_at = datetime.utcnow().isoformat()

    cv_amount = req.amount
    user.contribution_value = max(0, user.contribution_value - cv_amount)
    to_user.contribution_value = (to_user.contribution_value or 0) + int(cv_amount * 0.75)
    pool = await _get_pool(db)
    pool.contribution_pool = (pool.contribution_pool or 0) + int(cv_amount * 0.25)

    lid = _ledger_id()
    await _add_ledger(db, lid, user.id, to_user.id, req.amount, "transfer", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid, "from_balance": user.nt_balance}


@router.post("/earn")
async def earn(req: EarnSpendRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")

    pool = await _get_pool(db)
    if req.scope == "camp" or (hasattr(req, 'pool') and req.pool and req.pool.startswith('camp:')):
        if pool.camp_balance < req.amount:
            raise HTTPException(status_code=400, detail=f"营队池余额不足（当前 {pool.camp_balance} NT）")
        pool.camp_balance -= req.amount
    else:
        if pool.balance < req.amount:
            raise HTTPException(status_code=400, detail=f"社区池余额不足（当前 {pool.balance} NT）")
        pool.balance -= req.amount

    user.nt_balance += req.amount
    user.experience_value += req.amount
    user.contribution_value += req.amount
    user.updated_at = datetime.utcnow().isoformat()

    lid = _ledger_id()
    await _add_ledger(db, lid, "community_pool" if req.scope == "camp" else None, user.id,
                      req.amount, "earn", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid, "balance": user.nt_balance}


@router.post("/spend")
async def spend(req: EarnSpendRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")
    if user.nt_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"余额不足（当前 {user.nt_balance} NT）")

    user.nt_balance -= req.amount
    user.updated_at = datetime.utcnow().isoformat()

    # spend returns to community pool
    pool = await _get_pool(db)
    pool.balance += req.amount

    lid = _ledger_id()
    await _add_ledger(db, lid, user.id, "community_pool",
                      req.amount, f"{req.scope}_spend", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid, "balance": user.nt_balance}


@router.post("/topup")
async def topup(req: TopUpRequest, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")

    target = await db.execute(select(User).where(User.id == req.user))
    target = target.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    target.nt_balance += req.amount
    target.updated_at = datetime.utcnow().isoformat()

    pool = await _get_pool(db)
    pool.total_issued += req.amount

    lid = _ledger_id()
    await _add_ledger(db, lid, None, target.id, req.amount, "topup", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid}


@router.post("/cashout")
async def cashout(req: TopUpRequest, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if req.amount <= 0: raise HTTPException(status_code=400, detail="金额必须大于0")
    target = (await db.execute(select(User).where(User.id == req.user))).scalar_one_or_none()
    if not target: raise HTTPException(status_code=404, detail="用户不存在")
    if target.nt_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"余额不足（当前 {target.nt_balance} NT）")
    target.nt_balance -= req.amount; target.updated_at = datetime.utcnow().isoformat()
    pool = await _get_pool(db); pool.total_issued -= req.amount
    if pool.total_issued < 0: raise HTTPException(status_code=400, detail="系统发行量不足")
    lid = _ledger_id()
    await _add_ledger(db, lid, target.id, None, req.amount, "cashout", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid, "balance": target.nt_balance}


@router.get("/verify")
async def verify(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(User))
    users = list(result.scalars())
    total_user_balance = sum(u.nt_balance for u in users)

    pool = await _get_pool(db)
    # 营队池：从账本统计 camp_pool 净额
    camp_result = await db.execute(select(NTLedger).where(NTLedger.to_user == "camp_pool"))
    camp_in = sum(e.amount for e in camp_result.scalars())
    camp_out_result = await db.execute(select(NTLedger).where(NTLedger.from_user == "camp_pool"))
    camp_out = sum(e.amount for e in camp_out_result.scalars())
    camp_pool_balance = camp_in - camp_out
    total_system = total_user_balance + pool.balance + pool.task_escrow + camp_pool_balance

    return {
        "pass": abs(total_system - pool.total_issued) <= 1,
        "checks": {
            "total_user_balance": total_user_balance,
            "community_pool": pool.balance,
            "task_escrow": pool.task_escrow,
            "camp_pools": camp_pool_balance,
            "total_system": total_system,
            "total_issued": pool.total_issued,
            "diff": total_system - pool.total_issued,
        }
    }


@router.get("/pools")
async def pools(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    pool = await _get_pool(db)
    return {"community_pool": pool.balance, "task_escrow": pool.task_escrow, "total_issued": pool.total_issued}


# ── 任务（NT 核心部分）──
@router.post("/tasks")
async def create_task(req: CreateTaskRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    if req.reward <= 0:
        raise HTTPException(status_code=400, detail="奖励必须大于0")
    if user.nt_balance < req.reward:
        raise HTTPException(status_code=400, detail=f"余额不足（需 {req.reward} NT，当前 {user.nt_balance}）")

    task_id = f"T{datetime.utcnow().strftime('%y%m%d')}-{datetime.utcnow().strftime('%f')}"
    user.nt_balance -= req.reward

    pool = await _get_pool(db)
    pool.task_escrow += req.reward

    task = NTTask(
        id=task_id, poster=user.id, title=req.title, reward=req.reward,
        category=req.category, escrow_amount=req.reward,
        status="进行中", created_at=datetime.utcnow().isoformat(),
    )
    db.add(task)

    lid = _ledger_id()
    await _add_ledger(db, lid, user.id, "escrow", req.reward, "task_freeze", f"创建任务: {req.title}", task_id, "pending")
    await db.commit()
    return {"ok": True, "task_id": task_id}


@router.post("/tasks/{task_id}/accept")
async def accept_task(task_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(NTTask).where(NTTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "进行中":
        raise HTTPException(status_code=400, detail=f"任务状态不可接取: {task.status}")
    task.assignee = user.id
    task.status = "进行中"
    task.accepted_at = datetime.utcnow().isoformat()
    await _adjust_trust(user, 2)
    await db.commit()
    return {"ok": True}


@router.post("/tasks/{task_id}/verify")
async def verify_task(task_id: str, approved: bool = True, reject_reason: str = "",
                      user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    result = await db.execute(select(NTTask).where(NTTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.reviewer and task.reviewer != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只有指定的审核人可以验证此任务")
    if task.status not in ("待审核", "进行中", "待提交"):
        raise HTTPException(status_code=400, detail=f"任务状态不可验证: {task.status}")

    pool = await _get_pool(db)
    if approved:
        assignee = await db.execute(select(User).where(User.id == task.assignee))
        assignee = assignee.scalar_one_or_none()
        if not assignee:
            raise HTTPException(status_code=400, detail="任务执行者不存在")
        assignee.nt_balance += task.reward
        assignee.experience_value += task.reward
        await _adjust_trust(assignee, 5)
        pool.task_escrow -= task.reward
        task.status = "待结算"
        task.verifier_id = user.id
        task.verified_at = datetime.utcnow().isoformat()

        poster = await db.execute(select(User).where(User.id == task.poster))
        poster = poster.scalar_one_or_none()
        if poster:
            await _adjust_trust(poster, 3)

        lid = _ledger_id()
        await _add_ledger(db, lid, "escrow", task.assignee, task.reward, "task_reward",
                          f"任务完成: {task.title}", task_id)
    else:
        # Return escrow to poster
        poster = await db.execute(select(User).where(User.id == task.poster))
        poster = poster.scalar_one_or_none()
        if poster:
            poster.nt_balance += task.reward
        else:
            pool.balance += task.reward
        pool.task_escrow -= task.reward
        task.status = "已取消"
        if not poster:
            await _add_ledger(db, _ledger_id(), task.poster or "escrow", "community_pool", task.reward, "escrow_absorbed", "发布者不存在,NT 回收", task_id)

    await db.commit()
    return {"ok": True, "status": task.status}
