"""Admin routes: pending newbie review, community task publishing, withdraw management."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Verification, User, NTLedger, CommunityPool
from routes.auth import require_admin
from nt_helpers import _get_pool

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/pending-newbie")
async def pending_newbie(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """查看新人提交的待审核任务（pending verifications from non-admin/non-builder users）。"""
    result = await db.execute(
        select(Verification).where(
            Verification.status == "pending"
        ).order_by(Verification.created_at.desc()).limit(50)
    )
    vfys = list(result.scalars())

    # 过滤：仅显示非 admin/builder 的提交
    pending = []
    for v in vfys:
        doer = (await db.execute(select(User).where(User.id == v.doer))).scalar_one_or_none()
        if doer and doer.role not in ("admin", "builder"):
            pending.append({
                "id": v.id, "type": v.type, "doer": v.doer,
                "action": v.action, "nt_amount": v.nt_amount,
                "verifier_reward": v.verifier_reward,
                "status": v.status, "created_at": v.created_at,
            })
    return pending


# ══ 提现管理 ══
@router.get("/withdraws/pending")
async def pending_withdraws(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """列出所有待处理的提现申请"""
    result = await db.execute(
        select(NTLedger).where(NTLedger.type == "withdraw", NTLedger.status == "pending")
        .order_by(NTLedger.created_at.desc()).limit(50)
    )
    return [{"entry_id": e.entry_id, "from_user": e.from_user, "amount": e.amount,
             "reason": e.reason, "created_at": e.created_at} for e in result.scalars()]


@router.post("/withdraw/confirm")
async def confirm_withdraw(entry_id: str, admin: User = Depends(require_admin),
                            db: AsyncSession = Depends(get_db)):
    """管理员确认提现——从 frozen 销毁 NT，减少 total_issued"""
    entry = (await db.execute(
        select(NTLedger).where(NTLedger.entry_id == entry_id, NTLedger.status == "pending")
    )).scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "提现记录不存在或已处理")

    pool = await _get_pool(db, lock=True)
    pool.frozen = (pool.frozen or 0) - entry.amount
    pool.total_issued -= entry.amount
    entry.status = "settled"
    entry.settled_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True, "entry_id": entry_id}


@router.post("/withdraw/reject")
async def reject_withdraw(entry_id: str, admin: User = Depends(require_admin),
                           db: AsyncSession = Depends(get_db)):
    """管理员拒绝提现——退回冻结资金到储备池和用户余额"""
    entry = (await db.execute(
        select(NTLedger).where(NTLedger.entry_id == entry_id, NTLedger.status == "pending")
    )).scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "提现记录不存在或已处理")

    pool = await _get_pool(db, lock=True)
    pool.frozen = (pool.frozen or 0) - entry.amount
    pool.reserve = (pool.reserve or 0) + entry.amount
    user = (await db.execute(select(User).where(User.id == entry.from_user))).scalar_one_or_none()
    if user:
        user.nt_balance += entry.amount
    entry.status = "cancelled"
    await db.commit()
    return {"ok": True, "entry_id": entry_id, "refunded": True}
