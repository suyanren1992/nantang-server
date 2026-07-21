"""Admin routes: pending newbie review, community task publishing."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Verification, User
from routes.auth import require_admin

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
