"""NT economy routes: transfer, earn, spend, topup, verify."""
import os
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from datetime import datetime
import secrets
import json
from database import get_db
from models import User, NTLedger, NTTask, CommunityPool, DepositIntent, Verification, TASK_STATUSES
from routes.auth import get_current_user, require_admin
from nt_helpers import _ledger_id, _add_ledger, _get_pool, _safe_assignees

router = APIRouter(prefix="/api/nt", tags=["nt"])

PLATFORM_WALLET = os.environ.get("PLATFORM_WALLET_ADDRESS", "")


class TransferRequest(BaseModel):
    from_user: str = ""  # admin 可指定转出方
    to: str
    amount: int = Field(ge=1, le=10000)
    reason: str = ""


class EarnSpendRequest(BaseModel):
    amount: int = Field(ge=1, le=50000)
    reason: str = ""
    scope: str = "personal"


class TopUpRequest(BaseModel):
    user: str
    amount: int = Field(ge=1, le=100000)
    reason: str = ""


class CreateTaskRequest(BaseModel):
    title: str
    reward: int
    category: str = "other"


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


async def _get_accommodation_status(db: AsyncSession, user_id: str):
    """查询用户的活跃入住状态。ponytail: 复用已有 Tenancy 模型。"""
    from models import Tenancy
    r = await db.execute(
        select(Tenancy).where(Tenancy.user_id == user_id, Tenancy.status == "active")
    )
    t = r.scalar_one_or_none()
    if not t:
        return None
    return {"room_id": t.room_id, "bed_num": t.bed_num,
            "checkin_date": t.checkin_date, "debt": t.debt,
            "last_deducted": t.last_deducted}


async def _is_onsite(db: AsyncSession, user: User) -> bool:
    """在地成员判断：admin/builder 始终在地，或有活跃入住记录。
    ponytail: 过渡期方案，Phase E 完整就位后改用 resident role。"""
    if user.role in ("admin", "builder"):
        return True
    from models import Tenancy
    r = await db.execute(
        select(Tenancy).where(Tenancy.user_id == user.id, Tenancy.status == "active")
    )
    return r.scalar_one_or_none() is not None


@router.get("/balance")
async def get_balance(user: User = Depends(get_current_user)):
    return {"balance": user.nt_balance, "cv": user.contribution_value, "xp": user.experience_value}


@router.get("/sync")
async def sync(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """全量同步：余额/CV/XP/角色/流水/任务/充值意图/冻结余额。Phase C0。"""
    # 用户的任务（发布或认领）
    tasks_r = await db.execute(
        select(NTTask).where(
            (NTTask.poster == user.id) | (NTTask.assignee == user.id)
        ).order_by(NTTask.created_at.desc())
    )
    all_tasks = list(tasks_r.scalars())

    # 冻结余额：本人发布且 escrow 未释放的任务的 escrow_amount
    frozen = 0
    frozen_statuses = ("进行中", "待提交", "待审核", "退回修改", "待结算", "已争议")
    for t in all_tasks:
        if t.poster == user.id and t.status in frozen_statuses:
            frozen += t.escrow_amount if t.escrow_amount is not None else (t.reward * (t.slots or 1))

    # 近期流水（50 条）
    ledger_r = await db.execute(
        select(NTLedger).where(
            (NTLedger.from_user == user.id) | (NTLedger.to_user == user.id)
        ).order_by(NTLedger.created_at.desc()).limit(50)
    )
    ledger = [{"entry_id": e.entry_id, "from": e.from_user, "to": e.to_user,
               "amount": e.amount, "type": e.type, "reason": e.reason,
               "status": e.status, "created_at": e.created_at, "tx_hash": e.tx_hash}
              for e in ledger_r.scalars()]

    # 充值意图（20 条）
    di_r = await db.execute(
        select(DepositIntent).where(DepositIntent.user_id == user.id)
        .order_by(DepositIntent.created_at.desc()).limit(20)
    )
    deposit_intents = [{"id": d.id, "amount": d.amount, "from_address": d.from_address,
                        "status": d.status, "created_at": d.created_at, "tx_hash": d.tx_hash}
                       for d in di_r.scalars()]

    # R6: 所有活跃入住记录
    from models import Tenancy as _Tenancy
    all_tenancies = [
        {"room_id": t.room_id, "bed_num": t.bed_num, "user_id": t.user_id,
         "checkin_date": t.checkin_date, "debt": t.debt}
        for t in (await db.execute(select(_Tenancy).where(_Tenancy.status == "active"))).scalars()
    ]
    # 任务
    tasks = [{"id": t.id, "title": t.title, "reward": t.reward, "category": t.category,
              "scope": t.scope, "status": t.status, "poster": t.poster, "assignee": t.assignee,
              "assignees": _safe_assignees(t), "slots": t.slots,
              "deadline": t.deadline, "reviewer": t.reviewer, "note": t.note,
              "evidence": t.evidence, "escrow_amount": t.escrow_amount,
              "is_system_generated": t.is_system_generated or False,
              "camp_ref_id": t.camp_ref_id, "location_id": t.location_id,
              "created_at": t.created_at, "verified_at": t.verified_at,
              "verifier_id": t.verifier_id,
              "settler_id": t.settler_id, "settled_at": t.settled_at} for t in all_tasks]

    return {
        "balance": user.nt_balance, "cv": user.contribution_value,
        "xp": user.experience_value, "role": user.role,
        "trust_score": user.trust_score, "frozen_balance": frozen,
        "wallet_address": user.wallet_address,
        "ledger": ledger, "tasks": tasks, "deposit_intents": deposit_intents,
        "task_statuses": TASK_STATUSES,
        # R6: 所有活跃入住记录（供客户端住宿面板同步）
        "all_tenancies": all_tenancies,
        # ponytail: C2/C2.5 就位后补 accommodation + pending_verifications
        "accommodation": await _get_accommodation_status(db, user.id),
        "pending_verifications": [
            {"id": v.id, "type": v.type, "doer": v.doer, "action": v.action,
             "nt_amount": v.nt_amount, "verifier_reward": v.verifier_reward,
             "status": v.status, "retry_count": v.retry_count,
             "verifier": v.verifier, "created_at": v.created_at}
            for v in (await db.execute(
                select(Verification).where(Verification.status == "pending")
                .order_by(Verification.created_at.desc()).limit(30)
            )).scalars()
        ],
    }


@router.get("/ledger")
async def get_ledger(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                     limit: int = 50, type: str = None):
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
    actual_from = req.from_user or user.id
    if actual_from != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="只有管理员可以代他人转账")
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")
    if req.amount > 10000:
        raise HTTPException(status_code=400, detail="单笔金额上限 10000 NT")

    from_user_obj = (await db.execute(
        select(User).where(User.id == actual_from).with_for_update()
    )).scalar_one_or_none()
    if not from_user_obj:
        raise HTTPException(status_code=404, detail="转出用户不存在")
    if from_user_obj.nt_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"余额不足（当前 {from_user_obj.nt_balance} NT）")

    to_result = await db.execute(select(User).where(User.id == req.to))
    to_user = to_result.scalar_one_or_none()
    if not to_user:
        raise HTTPException(status_code=404, detail="目标用户不存在")

    from_user_obj.nt_balance -= req.amount
    to_user.nt_balance += req.amount
    from_user_obj.updated_at = datetime.utcnow().isoformat()
    to_user.updated_at = datetime.utcnow().isoformat()

    cv_amount = req.amount
    actual_cv_deducted = min(cv_amount, from_user_obj.contribution_value)
    from_user_obj.contribution_value = max(0, from_user_obj.contribution_value - cv_amount)
    to_user.contribution_value = (to_user.contribution_value or 0) + int(actual_cv_deducted * 0.75)
    pool = await _get_pool(db)
    pool.contribution_pool = (pool.contribution_pool or 0) + int(actual_cv_deducted * 0.25)

    lid = _ledger_id()
    await _add_ledger(db, lid, actual_from, to_user.id, req.amount, "transfer", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid, "from_balance": user.nt_balance}


# R11-1: POST /api/nt/earn 已废弃 — 客户端无调用方（grep 确认 2026-07-21）。earn 仅通过校核制/任务结算等服务端逻辑触发。
# 如需恢复：取消下面注释并加 Depends(require_admin)
# @router.post("/earn")
# async def earn(req: EarnSpendRequest, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
#     if req.amount <= 0: raise HTTPException(status_code=400, detail="金额必须大于0")
#     if req.amount > 10000: raise HTTPException(status_code=400, detail="单笔金额上限 10000 NT")
#     pool = await _get_pool(db, lock=True)
#     ...


@router.post("/spend")
async def spend(req: EarnSpendRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")
    if req.scope not in ("personal", "camp"):
        raise HTTPException(status_code=400, detail=f"无效 scope: {req.scope}")
    if user.nt_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"余额不足（当前 {user.nt_balance} NT）")

    # 重新查询加行锁防并发扣款
    user_locked = (await db.execute(select(User).where(User.id == user.id).with_for_update())).scalar_one_or_none()
    if not user_locked or user_locked.nt_balance < req.amount:
        raise HTTPException(status_code=400, detail="余额不足")
    user_locked.nt_balance -= req.amount
    user_locked.updated_at = datetime.utcnow().isoformat()

    # spend returns to pool — camp-scope routes to camp_balance
    pool = await _get_pool(db)
    if req.scope == "camp":
        pool.camp_balance += req.amount
    else:
        pool.balance += req.amount

    lid = _ledger_id()
    await _add_ledger(db, lid, user.id, "camp_pool" if req.scope == "camp" else "community_pool",
                      req.amount, f"{req.scope}_spend", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid, "balance": user.nt_balance}


# ponytail: chain_scanner 已接管自动化充值。此端点仅用于例外处理（补账/纠错/线下收款）。
@router.post("/topup")
async def topup(req: TopUpRequest, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")

    # P0': 支持社区池直接注资
    if req.user == "community_pool":
        pool = await _get_pool(db)
        pool.balance += req.amount
        pool.total_issued += req.amount
        lid = _ledger_id()
        await _add_ledger(db, lid, None, "community_pool", req.amount, "topup", req.reason)
        await db.commit()
        return {"ok": True, "entry_id": lid, "pool_balance": pool.balance}

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
    pool = await _get_pool(db)
    if pool.total_issued < req.amount: raise HTTPException(status_code=400, detail="系统发行量不足")
    pool.total_issued -= req.amount
    lid = _ledger_id()
    await _add_ledger(db, lid, target.id, None, req.amount, "cashout", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid, "balance": target.nt_balance}


# ══ 提现（两阶段冻结）══
@router.post("/withdraw")
async def withdraw(req: WithdrawRequest, user: User = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    """用户提现 NT——第一阶段：冻结到 frozen，等待管理员多签确认"""
    from web3 import Web3
    from datetime import timedelta

    # 输入校验
    addr = req.to_address or user.wallet_address
    if not addr or not Web3.is_address(addr):
        raise HTTPException(400, "请先设置有效的钱包地址（0x开头40位）")
    if user.nt_balance < req.amount:
        raise HTTPException(400, f"余额不足（当前 {user.nt_balance} NT）")
    if user.trust_score < 60:
        raise HTTPException(400, "信誉分≥60方可提现")

    # 7天冷却
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
    recent = (await db.execute(
        select(func.count(NTLedger.id)).where(
            NTLedger.from_user == user.id, NTLedger.type == "withdraw",
            NTLedger.created_at >= week_ago
        )
    )).scalar()
    if recent > 0:
        raise HTTPException(429, "7天内已提现过，请等待冷却期结束")

    pool = await _get_pool(db, lock=True)
    if (pool.reserve or 0) < req.amount:
        raise HTTPException(400, f"储备池余额不足（当前 {pool.reserve or 0} NT），请联系管理员")

    # 第一阶段：冻结
    user.nt_balance -= req.amount
    pool.reserve = (pool.reserve or 0) - req.amount
    pool.frozen = (pool.frozen or 0) + req.amount
    lid = _ledger_id()
    await _add_ledger(db, lid, user.id, "frozen_pool", req.amount, "withdraw",
                      f"提现至 {addr[:10]}... 等待管理员签名", status="pending")
    await _adjust_trust(user, -10)
    await db.commit()
    return {"ok": True, "entry_id": lid, "balance": user.nt_balance,
            "status": "pending", "expected_time": "24小时内"}


@router.get("/verify")
async def verify(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = list(result.scalars())
    total_user_balance = sum(u.nt_balance for u in users)

    pool = await _get_pool(db)
    # 营队池：账本推导值 vs 池表真实值交叉校验
    camp_result = await db.execute(select(NTLedger).where(NTLedger.to_user == "camp_pool"))
    camp_in = sum(e.amount for e in camp_result.scalars())
    camp_out_result = await db.execute(select(NTLedger).where(NTLedger.from_user == "camp_pool"))
    camp_out = sum(e.amount for e in camp_out_result.scalars())
    camp_pool_ledger = camp_in - camp_out
    camp_pool_drift = pool.camp_balance - camp_pool_ledger
    total_system = total_user_balance + pool.balance + pool.task_escrow + pool.camp_balance + (pool.reserve or 0) + (pool.frozen or 0)

    return {
        "pass": abs(total_system - pool.total_issued) <= 1 and camp_pool_drift == 0,
        "checks": {
            "total_user_balance": total_user_balance,
            "community_pool": pool.balance,
            "task_escrow": pool.task_escrow,
            "reserve": pool.reserve or 0,
            "frozen": pool.frozen or 0,
            "camp_balance": pool.camp_balance,
            "camp_pool_ledger": camp_pool_ledger,
            "camp_pool_drift": camp_pool_drift,
            "total_system": total_system,
            "total_issued": pool.total_issued,
            "diff": total_system - pool.total_issued,
        }
    }


# ══ 充值意向（链上自动化）══

class WithdrawRequest(BaseModel):
    amount: int = Field(ge=50, le=200)
    to_address: str = ""  # 可选，默认用 profile 的 wallet_address

class DepositIntentRequest(BaseModel):
    amount: int = Field(ge=1, le=100000)
    from_address: str = ""


@router.post("/deposit-intent")
async def create_deposit_intent(req: DepositIntentRequest, user: User = Depends(get_current_user),
                                db: AsyncSession = Depends(get_db)):
    if not PLATFORM_WALLET:
        raise HTTPException(status_code=503, detail="平台钱包未配置")
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")
    from_addr = req.from_address or user.wallet_address
    if not from_addr:
        raise HTTPException(status_code=400, detail="请先在个人资料中设置钱包地址")

    # 有进行中的意向时复用，不重复创建
    existing = (await db.execute(
        select(DepositIntent).where(
            DepositIntent.user_id == user.id,
            DepositIntent.status == "pending"
        )
    )).scalar_one_or_none()
    if existing:
        return {"ok": True, "intent_id": existing.id, "to_address": PLATFORM_WALLET,
                "amount": existing.amount, "reuse": True}

    intent_id = f"intent_{datetime.utcnow().strftime('%y%m%d%H%M%S')}_{secrets.token_hex(4)}"
    intent = DepositIntent(
        id=intent_id, user_id=user.id, amount=req.amount,
        from_address=from_addr, to_address=PLATFORM_WALLET,
        status="pending", created_at=datetime.utcnow().isoformat()
    )
    db.add(intent)
    await db.commit()
    return {"ok": True, "intent_id": intent_id, "to_address": PLATFORM_WALLET, "amount": req.amount}


@router.get("/deposit-intents")
async def list_deposit_intents(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DepositIntent).where(DepositIntent.user_id == user.id).order_by(DepositIntent.created_at.desc()).limit(20)
    )
    return [{"id": i.id, "amount": i.amount, "from_address": i.from_address,
             "to_address": i.to_address, "tx_hash": i.tx_hash, "status": i.status,
             "created_at": i.created_at, "detected_at": i.detected_at}
            for i in result.scalars()]


@router.get("/deposit-intents/admin")
async def admin_deposit_intents(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db),
                                limit: int = 50):
    result = await db.execute(
        select(DepositIntent).order_by(DepositIntent.created_at.desc()).limit(limit)
    )
    return [{"id": i.id, "user_id": i.user_id, "amount": i.amount,
             "from_address": i.from_address, "to_address": i.to_address,
             "tx_hash": i.tx_hash, "status": i.status,
             "created_at": i.created_at, "detected_at": i.detected_at}
            for i in result.scalars()]


@router.get("/chain-balance")
async def chain_balance():
    """读取多签钱包在链上的实际 NT 余额。"""
    if not PLATFORM_WALLET:
        return {"ok": False, "error": "平台钱包未配置"}
    try:
        from web3 import Web3
        import os
        rpc = os.environ.get("OP_RPC_URL", "https://mainnet.optimism.io")
        token_addr = os.environ.get("NT_TOKEN_CONTRACT", "")
        if not token_addr:
            return {"ok": False, "error": "NT_TOKEN_CONTRACT 未配置"}
        w3 = Web3(Web3.HTTPProvider(rpc))
        abi = '[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}]'
        c = w3.eth.contract(address=w3.to_checksum_address(token_addr), abi=abi)
        decimals = c.functions.decimals().call()
        raw = c.functions.balanceOf(w3.to_checksum_address(PLATFORM_WALLET)).call()
        return {"ok": True, "balance": raw // 10**decimals, "balance_raw": raw, "decimals": decimals, "wallet": PLATFORM_WALLET}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/pools")
async def pools(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pool = await _get_pool(db)
    return {"community_pool": pool.balance, "reserve": pool.reserve or 0, "frozen": pool.frozen or 0,
            "task_escrow": pool.task_escrow, "camp_balance": pool.camp_balance or 0,
            "total_issued": pool.total_issued}


# R11-7: POST /api/nt/tasks 已废弃 — 使用 POST /api/tasks（tasks.py 版本，字段齐全）。客户端无调用方（grep 确认 2026-07-21）。
# 如需恢复：取消下面注释
# @router.post("/tasks")
# async def create_task(req: CreateTaskRequest, ...): ...


@router.post("/tasks/{task_id}/accept")
async def accept_task(task_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.poster == user.id:
        raise HTTPException(status_code=400, detail="不能认领自己发布的任务")
    if task.status != "进行中":
        raise HTTPException(status_code=400, detail=f"任务状态不可接取: {task.status}")
    assignees = _safe_assignees(task)
    if len(assignees) >= task.slots:
        raise HTTPException(status_code=409, detail=f"任务已满员（{task.slots}/{task.slots}）")
    if user.id in assignees:
        raise HTTPException(status_code=409, detail="你已接取此任务")
    assignees.append(user.id)
    task.assignees = json.dumps(assignees)
    task.assignee = assignees[0]  # 向后兼容旧列
    task.status = "进行中"
    task.accepted_at = datetime.utcnow().isoformat()
    await _adjust_trust(user, 2)
    await db.commit()
    return {"ok": True}


@router.post("/tasks/{task_id}/verify")
async def verify_task(task_id: str, approved: bool = Body(True), reject_reason: str = Body(""),
                      user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if user.role != "admin" and task.reviewer and task.reviewer != user.id:
        raise HTTPException(status_code=403, detail="只有指定的审核人可以验证此任务")
    if user.role != "admin" and not task.reviewer and task.poster != user.id:
        raise HTTPException(status_code=403, detail="未指定审核人时，只有发布者可以验证")
    if task.status not in ("待审核", "待提交", "退回修改"):
        raise HTTPException(status_code=400, detail=f"任务状态不可验证: {task.status}")

    pool = await _get_pool(db, lock=True)
    if approved:
        import json
        assignee_ids = _safe_assignees(task)
        if not assignee_ids:
            raise HTTPException(status_code=400, detail="任务执行者不存在")
        is_camp = task.scope == "camp"  # R4: 营地任务从 camp_balance 支付
        total_payout = task.reward * len(assignee_ids)
        if is_camp:
            if pool.camp_balance < total_payout:
                raise HTTPException(status_code=400, detail="营地余额不足")
            pool.camp_balance -= total_payout
        else:
            pool.task_escrow -= total_payout
        for aid in assignee_ids:
            a = (await db.execute(select(User).where(User.id == aid))).scalar_one_or_none()
            if a:
                a.nt_balance += task.reward
                a.experience_value += task.reward
                await _adjust_trust(a, 5)
        task.status = "待结算"
        task.verifier_id = user.id
        task.verified_at = datetime.utcnow().isoformat()
        task.escrow_amount = 0

        poster = await db.execute(select(User).where(User.id == task.poster))
        poster = poster.scalar_one_or_none()
        if poster:
            await _adjust_trust(poster, 3)

        # 部分领取：未领份额 (slots - 实领人数) × reward 退还
        unclaimed = task.reward * ((task.slots or 1) - len(assignee_ids))
        if unclaimed > 0:
            if poster:
                poster.nt_balance += unclaimed
            elif is_camp:
                pool.camp_balance += unclaimed  # 营地任务回流 camp_balance
            else:
                pool.balance += unclaimed  # 发布者不存在时回流社区池
            lid_u = _ledger_id() + "-u"
            await _add_ledger(db, lid_u, "escrow", task.poster, unclaimed, "task_refund",
                              f"未领份额退还({(task.slots or 1) - len(assignee_ids)}个名额): {task.title}", task_id)

        for aid in assignee_ids:
            lid = _ledger_id()
            await _add_ledger(db, lid, "escrow", aid, task.reward, "task_reward",
                             f"任务完成: {task.title}", task_id)
    else:
        # 退回修改 — escrow 保持冻结，允许修改后重新提交
        task.status = "退回修改"
        task.reject_reason = reject_reason
        task.reject_count = (task.reject_count or 0) + 1
        if task.reject_count >= 3:
            # 超 3 次 → 释放 escrow，自动取消
            if not task.escrow_amount or task.escrow_amount <= 0:
                raise HTTPException(status_code=409, detail="任务无托管金额，无法自动取消")
            poster = await db.execute(select(User).where(User.id == task.poster))
            poster = poster.scalar_one_or_none()
            if poster:
                poster.nt_balance += task.escrow_amount
            else:
                pool.balance += task.escrow_amount
            pool.task_escrow -= task.escrow_amount
            lid = _ledger_id()
            await _add_ledger(db, lid, "escrow", task.poster or "community_pool",
                              task.escrow_amount, "task_auto_cancelled", f"3次退回自动取消: {task.title}", task_id)
            task.status = "已取消"
            task.escrow_amount = 0

    await db.commit()
    return {"ok": True, "status": task.status}


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404)
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403)
    if task.status in ("已结算", "待结算", "已取消", "已争议"):
        raise HTTPException(status_code=400, detail="不可取消已结算/已取消/已争议任务")

    # R1.5: poster='社区' 的任务取消——退款回社区池
    if task.poster == "社区":
        pool = await _get_pool(db)
        if task.escrow_amount > 0:
            pool.balance += task.escrow_amount
            pool.task_escrow -= task.escrow_amount
            lid = _ledger_id()
            await _add_ledger(db, lid, "escrow", "community_pool", task.escrow_amount,
                              "task_cancelled", f"取消社区任务: {task.title}", task_id)
            task.escrow_amount = 0
        task.status = "已取消"
        await db.commit()
        return {"ok": True}

    if task.escrow_amount > 0:
        pool = await _get_pool(db)
        poster = (await db.execute(select(User).where(User.id == task.poster))).scalar_one_or_none()
        if poster: poster.nt_balance += task.escrow_amount
        else: pool.balance += task.escrow_amount
        pool.task_escrow -= task.escrow_amount
        lid = _ledger_id()
        refund_target = task.poster if poster else "community_pool"
        await _add_ledger(db, lid, "escrow", refund_target, task.escrow_amount,
                          "task_cancelled", f"取消任务: {task.title}", task_id)
        task.escrow_amount = 0
    task.status = "已取消"
    await db.commit()
    return {"ok": True}

@router.post("/tasks/{task_id}/submit")
async def submit_task(task_id: str, evidence: str = "", user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404)
    a_ids = _safe_assignees(task)
    if user.id not in a_ids: raise HTTPException(status_code=403, detail="只有认领者可以提交")
    if task.status not in ("进行中", "待提交", "退回修改"):
        raise HTTPException(status_code=400, detail=f"任务状态不可提交: {task.status}")

    # P4: evidence 改为 JSON map {user_id: text}，全员提交后才设待审核
    evidence_map = {}
    try:
        if task.evidence:
            evidence_map = json.loads(task.evidence)
    except (json.JSONDecodeError, TypeError):
        evidence_map = {}
    evidence_map[user.id] = evidence
    task.evidence = json.dumps(evidence_map, ensure_ascii=False)

    # 仅当所有 assignee 都提交后才设为待审核
    if set(a_ids).issubset(set(evidence_map.keys())):
        task.status = "待审核"
        task.completed_at = datetime.utcnow().isoformat()

    await db.commit()
    return {"ok": True, "submitted": len(evidence_map), "total": len(a_ids)}


@router.post("/tasks/{task_id}/settle")
async def settle_task(task_id: str, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    """结算任务——仅任务发布者或管理员可操作。ponytail: 最小实现。"""
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="仅发布者或管理员可结算")
    if task.status != "待结算":
        raise HTTPException(status_code=400, detail=f"任务状态不可结算: {task.status}")
    task.status = "已结算"
    task.settled_at = datetime.utcnow().isoformat()
    task.settler_id = user.id
    lid = _ledger_id()
    await _add_ledger(db, lid, task.poster, "system", 0, "task_settled",
                      f"任务结算: {task.title}", task_id, status="settled")
    await db.commit()
    return {"ok": True, "status": "已结算"}


@router.post("/tasks/{task_id}/dispute")
async def dispute_task(task_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404)
    a_ids = _safe_assignees(task)
    if task.poster != user.id and user.id not in a_ids:
        raise HTTPException(status_code=403, detail="只有任务参与者可以发起争议")
    # 状态白名单：已结算/待结算/已取消/已争议的任务不可再争议（防争议→仲裁双重赔付）
    if task.status not in ("进行中", "待提交", "待审核", "退回修改"):
        raise HTTPException(status_code=400, detail=f"任务状态不可争议: {task.status}")
    task.status = "已争议"
    await db.commit()
    return {"ok": True}


class ResolveTaskRequest(BaseModel):
    action: str  # refund_poster | release_assignee | split_5050


# B2b: 争议仲裁 — 仅管理员，仅允许「已争议」状态
@router.post("/tasks/{task_id}/resolve")
async def resolve_task(task_id: str, req: ResolveTaskRequest, admin: User = Depends(require_admin),
                       db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NTTask).where(NTTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "已争议":
        raise HTTPException(status_code=400, detail=f"仅已争议任务可仲裁: {task.status}")
    if req.action not in ("refund_poster", "release_assignee", "split_5050"):
        raise HTTPException(status_code=400, detail=f"无效的仲裁动作: {req.action}")

    assignee_ids = _safe_assignees(task)
    if req.action in ("release_assignee", "split_5050") and not assignee_ids:
        raise HTTPException(status_code=400, detail="任务执行者不存在")

    pool = await _get_pool(db)
    # 以实际托管金额为准（非 reward×slots 重算），防 dispute 守卫漏洞导致重复赔付
    escrow = task.escrow_amount or 0
    if escrow <= 0:
        raise HTTPException(status_code=400, detail="任务无托管金额，无法仲裁")
    pool.task_escrow -= escrow
    task.escrow_amount = 0
    ledger_entries = []

    # 发布者份额：refund_poster 全额 / split_5050 一半
    if req.action in ("refund_poster", "split_5050"):
        poster_share = escrow if req.action == "refund_poster" else escrow // 2
        poster = (await db.execute(select(User).where(User.id == task.poster))).scalar_one_or_none()
        if poster:
            poster.nt_balance += poster_share
            poster.updated_at = datetime.utcnow().isoformat()
        else:
            pool.balance += poster_share  # 发布者账户不存在时回流社区池，防 NT 蒸发
        lid = f"{_ledger_id()}-{len(ledger_entries)}"  # 同请求内防 entry_id 撞唯一键
        await _add_ledger(db, lid, "escrow", task.poster, poster_share, "task_refund",
                          f"争议仲裁退回发布者: {task.title}", task_id)
        ledger_entries.append(lid)

    # 执行者份额：release_assignee 全额平分 / split_5050 剩余一半平分（余数归第一人）
    if req.action in ("release_assignee", "split_5050"):
        assignee_total = escrow if req.action == "release_assignee" else escrow - escrow // 2
        per = assignee_total // len(assignee_ids)
        for i, aid in enumerate(assignee_ids):
            share = per + (assignee_total - per * len(assignee_ids)) if i == 0 else per
            a = (await db.execute(select(User).where(User.id == aid))).scalar_one_or_none()
            if a:
                a.nt_balance += share
                a.updated_at = datetime.utcnow().isoformat()
            else:
                pool.balance += share  # 执行者账户不存在时回流社区池，防 NT 蒸发
            lid = f"{_ledger_id()}-{len(ledger_entries)}"
            await _add_ledger(db, lid, "escrow", aid, share, "task_reward",
                              f"争议仲裁释放({len(assignee_ids)}人): {task.title}", task_id)
            ledger_entries.append(lid)

    task.status = "已取消" if req.action == "refund_poster" else "待结算"
    await db.commit()
    return {"ok": True, "task_id": task_id, "new_status": task.status, "ledger_entries": ledger_entries}


# ══ 校核制端点（C2：第四条资金路径）══

class VerificationApproveRequest(BaseModel):
    doer: str
    action: str
    nt_amount: int = 0
    verifier_reward: int = 0


@router.post("/verifications/{vfy_id}/approve")
async def approve_verification(vfy_id: str, req: VerificationApproveRequest,
                                user: User = Depends(get_current_user),
                                db: AsyncSession = Depends(get_db)):
    """Peer 校核通过——从社区池发放 NT 给 doer + verifier。ponytail: 最小实现，完整校核规则在 Phase D2。"""
    # 从 Verification 表获取权威金额（不信任客户端传入值）
    from models import Verification as VfyModel
    vfy_r = await db.execute(select(VfyModel).where(VfyModel.id == vfy_id).with_for_update())
    vfy = vfy_r.scalar_one_or_none()
    if not vfy:
        raise HTTPException(status_code=404, detail="校核记录不存在")
    if vfy.status != "pending":
        raise HTTPException(status_code=400, detail="校核已处理")
    # 非自校核
    if vfy.doer == user.id:
        raise HTTPException(status_code=400, detail="不能校核自己的操作")

    # P3: 同对 1h 冷却
    from datetime import timedelta
    one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    recent = await db.execute(
        select(VfyModel).where(
            VfyModel.verifier == user.id,
            VfyModel.doer == vfy.doer,
            VfyModel.verified_at >= one_hour_ago
        )
    )
    if recent.scalar_one_or_none():
        raise HTTPException(status_code=429, detail="同对 1h 内已操作")

    # P3: 日上限 10 次
    from sqlalchemy import func
    today = datetime.utcnow().strftime("%Y-%m-%d")
    daily_count = await db.execute(
        select(func.count(VfyModel.id)).where(
            VfyModel.verifier == user.id,
            VfyModel.verified_at.like(f"{today}%")
        )
    )
    if daily_count.scalar() >= 10:
        raise HTTPException(status_code=429, detail="今日验证已达上限 10 次")

    # 校核 NT 走服务端先：扣社区池 → earn（金额从 Verification 表取，不信任客户端）
    pool = await _get_pool(db, lock=True)  # P3: TOCTOU 修复，池加行锁
    nt_amount = vfy.nt_amount or 0
    verifier_reward = vfy.verifier_reward or 0
    total_payout = nt_amount + verifier_reward
    if pool.balance < total_payout:
        raise HTTPException(status_code=400, detail="社区池余额不足")
    pool.balance -= total_payout
    # 更新校核状态
    vfy.status = "verified"
    vfy.verifier = user.id
    vfy.verified_at = datetime.utcnow().isoformat()
    # 发放 NT 给 doer
    doer = (await db.execute(select(User).where(User.id == vfy.doer))).scalar_one_or_none()
    if doer and nt_amount > 0:
        doer.nt_balance += nt_amount
        lid = _ledger_id()
        await _add_ledger(db, lid, "community_pool", vfy.doer, nt_amount, "earn",
                          f"校核通过: {vfy.action}", status="settled")
    # 发放 verifier 奖励
    if verifier_reward > 0:
        user.nt_balance += verifier_reward
        lid2 = _ledger_id() + "-v"
        await _add_ledger(db, lid2, "community_pool", user.id, verifier_reward, "earn",
                          f"校核奖励: {vfy.action}", status="settled")
    await db.commit()
    return {"ok": True, "doer_balance": doer.nt_balance if doer else None,
            "verifier_balance": user.nt_balance}


@router.post("/verifications/{vfy_id}/reject")
async def reject_verification(vfy_id: str, user: User = Depends(get_current_user),
                               db: AsyncSession = Depends(get_db)):
    """Peer 驳回校核——写 DB，3 次驳回后永久拒绝。"""
    from models import Verification as VfyModel
    vfy_r = await db.execute(select(VfyModel).where(VfyModel.id == vfy_id).with_for_update())
    vfy = vfy_r.scalar_one_or_none()
    if not vfy:
        raise HTTPException(status_code=404, detail="校核记录不存在")
    if vfy.status != "pending":
        raise HTTPException(status_code=400, detail="校核已处理")
    if vfy.doer == user.id:
        raise HTTPException(status_code=400, detail="不能校核自己的操作")

    vfy.retry_count = (vfy.retry_count or 0) + 1
    vfy.rejected_by = user.id
    vfy.rejected_at = datetime.utcnow().isoformat()
    if vfy.retry_count >= 3:
        vfy.status = "permanently_rejected"
    else:
        vfy.status = "rejected"
    await db.commit()
    return {"ok": True, "rejected": True, "retry_count": vfy.retry_count}


# ══ F16: 离线 earn 队列同步 ══

class EarnSyncRequest(BaseModel):
    items: list = []

@router.post("/earn-sync")
async def earn_sync(req: EarnSyncRequest, user: User = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    """客户端离线 earn 队列同步——仅允许同步本人的 earn。日上限 + 单次上限防滥用。"""
    import os
    DAILY_LIMIT = int(os.environ.get("EARN_SYNC_DAILY_LIMIT", "5"))
    MAX_BATCH = int(os.environ.get("EARN_SYNC_MAX_BATCH", "50"))

    # 日上限：查今日已同步条目数
    today = datetime.utcnow().strftime("%Y-%m-%d")
    from sqlalchemy import func
    today_done = (await db.execute(
        select(func.count(NTLedger.id)).where(
            NTLedger.to_user == user.id,
            NTLedger.type == "earn",
            NTLedger.reason.like(f"离线同步:%")
        )
    )).scalar() or 0
    if today_done >= DAILY_LIMIT:
        raise HTTPException(status_code=429, detail=f"今日离线同步已达上限 {DAILY_LIMIT} 次")

    synced = 0
    pool = await _get_pool(db, lock=True)
    for item in req.items:
        doer = item.get("doer", "")
        amount = min(int(item.get("amount", 0)), MAX_BATCH)
        if doer != user.id or amount <= 0:
            continue
        if pool.balance < amount:
            break
        if today_done + synced >= DAILY_LIMIT:
            break
        pool.balance -= amount
        user.nt_balance += amount
        lid = _ledger_id()
        await _add_ledger(db, lid, "community_pool", user.id, amount, "earn",
                         f"离线同步: {item.get('action', '')}", status="settled")
        synced += 1
    await db.commit()
    return {"ok": True, "synced": synced, "balance": user.nt_balance}


# ══ 每日 tick（C2.6：替代客户端 _dailyTick）══
system_router = APIRouter(prefix="/api/system", tags=["system"])


@system_router.post("/daily-tick")
async def daily_tick(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """客户端登录时触发——幂等：同一天不重复执行。"""
    from models import Tenancy
    today = datetime.utcnow().strftime("%Y-%m-%d")

    pool = await _get_pool(db, lock=True)
    if pool.last_tick_date == today:
        return {"ok": True, "skipped": True, "date": today}

    results = {"date": today, "accommodation_fees": 0, "pool_refill": 0}

    # 1. 住宿费扣款
    tenancies_r = await db.execute(
        select(Tenancy).where(Tenancy.status == "active")
    )
    # 公约定价：每房不同价格（大地书房2F dorm101-106）
    BED_RATES = {"dorm101":20,"dorm102":30,"dorm103":30,"dorm104":60,"dorm105":30,"dorm106":35}
    for t in tenancies_r.scalars():
        if t.last_deducted == today:
            continue
        tenant_user = (await db.execute(select(User).where(User.id == t.user_id))).scalar_one_or_none()
        if not tenant_user:
            continue
        rate = BED_RATES.get(t.room_id, 28)  # fallback 均价 28
        if tenant_user.nt_balance >= rate:
            tenant_user.nt_balance -= rate
            pool.balance += rate
            lid = _ledger_id()
            await _add_ledger(db, lid, tenant_user.id, "community_pool", rate,
                              "accommodation_fee", f"住宿费 {today}", status="settled")
            results["accommodation_fees"] += rate
        else:
            t.debt += rate
        t.last_deducted = today

    # 2. 社区池补填 (M2: 50→20，20人规模轻度补填)
    if pool.balance < 300:
        pool.balance += 20
        pool.total_issued += 20
        lid_r = _ledger_id()
        await _add_ledger(db, lid_r, None, "community_pool", 20, "pool_refill",
                         f"每日补填 {today}", status="settled")
        results["pool_refill"] = 20

    # 3. 盈余划拨：运营池 > 1000 时，超出 500 的部分转入储备池
    if pool.balance > 1000:
        surplus = pool.balance - 500
        pool.balance -= surplus
        pool.reserve = (pool.reserve or 0) + surplus
        lid_s = _ledger_id()
        await _add_ledger(db, lid_s, "community_pool", "reserve", surplus,
                          "surplus_sweep", f"盈余划拨 {today}", status="settled")
        results["surplus_sweep"] = surplus

    # 4. 自动调水：运营池 < 150 时，从储备池补到 300
    if pool.balance < 150 and (pool.reserve or 0) > 0:
        need = 300 - pool.balance
        draw = min(need, pool.reserve or 0)
        pool.balance += draw
        pool.reserve = (pool.reserve or 0) - draw
        lid_a = _ledger_id()
        await _add_ledger(db, lid_a, "reserve", "community_pool", draw,
                          "auto_rebalance", f"自动调水 {today}", status="settled")
        results["auto_rebalance"] = draw

    pool.last_tick_date = today
    await db.commit()
    return {"ok": True, **results}
