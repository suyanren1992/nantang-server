# -*- coding: utf-8 -*-
"""社区功能路由 — potluck 接龙 / proposals 议事 / camp_proposals 营地议事 /
notifications 通报 / health 体检报告 / cleaning_pricing 清洁定价。

P1-#6 系列：前端 api.js 的 getPotluckList / joinPotluck / getProposalsList /
submitProposal / voteProposal / getCampProposalsList / getNotificationsList /
getHealthReport / getCleaningPricing 的后端真源。
"""
import json
import logging
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import (
    User, Potluck, CommunityProposal, ProposalVote,
    NTLedger, NTTask, Verification, Announcement,
    ActivityLog, Camp,
)
from routes.auth import get_current_user
from routes.governance import check_proposal_right, check_vote_right

logger = logging.getLogger("community")

# ══════════════════════════════════════════════════════
# potluck 路由 (/api/potluck)
# ══════════════════════════════════════════════════════
potluck_router = APIRouter(prefix="/api/potluck", tags=["potluck"])


@potluck_router.get("/list")
async def list_potluck(user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db),
                       limit: int = 100):
    """GET /api/potluck/list — 共享厨房接龙列表。"""
    result = await db.execute(
        select(Potluck).order_by(Potluck.created_at.desc()).limit(min(limit, 200))
    )
    items = [{
        "id": p.id, "item": p.item_name, "qty": p.quantity,
        "user": p.user_id, "category": p.category,
        "note": p.note, "time": p.created_at,
    } for p in result.scalars()]
    return {"ok": True, "items": items}


class PotluckJoinReq(BaseModel):
    item: str = Field(min_length=1, max_length=100)
    qty: int = Field(1, ge=1, le=50)
    category: str = "菜品"
    note: str = ""
    event_date: str = ""


@potluck_router.post("/join")
async def join_potluck(req: PotluckJoinReq,
                       user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    """POST /api/potluck/join — 报名参加接龙。"""
    p = Potluck(
        item_name=req.item, category=req.category,
        user_id=user.id, quantity=req.qty,
        note=req.note or None,
        event_date=req.event_date or None,
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(p)
    await db.commit()
    return {"ok": True, "id": p.id}


# ══════════════════════════════════════════════════════
# proposals 路由 (/api/proposals)
# ══════════════════════════════════════════════════════
proposals_router = APIRouter(prefix="/api/proposals", tags=["proposals"])


async def _serialize_proposal(db: AsyncSession, p: CommunityProposal) -> dict:
    """提案序列化——附带投票统计。"""
    votes_r = await db.execute(
        select(ProposalVote).where(ProposalVote.proposal_id == p.id)
    )
    votes_list = list(votes_r.scalars())
    votes_for = [v.voter_id for v in votes_list if v.vote == "for"]
    votes_against = [v.voter_id for v in votes_list if v.vote == "against"]
    return {
        "id": p.id, "title": p.title, "description": p.description,
        "author": p.proposer_id, "category": p.category,
        "status": p.status,
        "votes": {"for": votes_for, "against": votes_against},
        "voters": list({v.voter_id for v in votes_list}),
        "time": p.created_at,
    }


@proposals_router.get("/list")
async def list_proposals(user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db),
                         limit: int = 50):
    """GET /api/proposals/list — 社区提案列表（仅社区级，不含营地提案）。"""
    result = await db.execute(
        select(CommunityProposal)
        .where(CommunityProposal.camp_id.is_(None))
        .order_by(CommunityProposal.created_at.desc())
        .limit(min(limit, 200))
    )
    proposals = []
    for p in result.scalars():
        proposals.append(await _serialize_proposal(db, p))
    return {"ok": True, "items": proposals}


class ProposalSubmitReq(BaseModel):
    id: str = ""              # 可选，前端生成 ID 时直接传入
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    category: str = "general"


@proposals_router.post("/submit")
async def submit_proposal(req: ProposalSubmitReq,
                          user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    """POST /api/proposals/submit — 提交社区提案（需提案权）。"""
    # 治理权检查
    right = await check_proposal_right(db, user)
    if not right["eligible"]:
        raise HTTPException(status_code=403,
                            detail=f"无提案权: {right['reason']}")

    pid = req.id or f"prop_{datetime.utcnow().strftime('%y%m%d%H%M%S')}_{user.id}"
    # 幂等：同 ID 已存在则返回
    existing = (await db.execute(
        select(CommunityProposal).where(CommunityProposal.id == pid)
    )).scalar_one_or_none()
    if existing:
        return {"ok": True, "id": existing.id, "already_exists": True}

    p = CommunityProposal(
        id=pid, title=req.title,
        description=req.description or None,
        proposer_id=user.id, category=req.category,
        status="active",
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(p)
    await db.commit()
    return {"ok": True, "id": p.id}


class ProposalVoteReq(BaseModel):
    proposal_id: str
    vote: str = Field(..., pattern="^(for|against)$")


@proposals_router.post("/vote")
async def vote_proposal(req: ProposalVoteReq,
                        user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    """POST /api/proposals/vote — 投票（需投票权，每人每提案一票）。"""
    # 投票权检查
    right = await check_vote_right(db, user)
    if not right["eligible"]:
        raise HTTPException(status_code=403,
                            detail=f"无投票权: {right['reason']}")

    proposal = (await db.execute(
        select(CommunityProposal).where(CommunityProposal.id == req.proposal_id)
    )).scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="提案不存在")
    if proposal.status != "active":
        raise HTTPException(status_code=400,
                            detail=f"提案已关闭（状态: {proposal.status}）")

    # 幂等：已投票则更新（改票）
    existing = (await db.execute(
        select(ProposalVote).where(
            ProposalVote.proposal_id == req.proposal_id,
            ProposalVote.voter_id == user.id,
        )
    )).scalar_one_or_none()
    if existing:
        existing.vote = req.vote
        existing.created_at = datetime.utcnow().isoformat()
    else:
        db.add(ProposalVote(
            proposal_id=req.proposal_id, voter_id=user.id,
            vote=req.vote,
            created_at=datetime.utcnow().isoformat(),
        ))
    await db.commit()
    return {"ok": True, "proposal_id": req.proposal_id, "vote": req.vote}


# ══════════════════════════════════════════════════════
# camp_proposals 路由 (/api/camp_proposals)
# ══════════════════════════════════════════════════════
camp_proposals_router = APIRouter(prefix="/api/camp_proposals", tags=["camp_proposals"])


@camp_proposals_router.get("/list")
async def list_camp_proposals(camp_id: str = None,
                              user: User = Depends(get_current_user),
                              db: AsyncSession = Depends(get_db),
                              limit: int = 50):
    """GET /api/camp_proposals/list — 营地议事提案列表。camp_id 可选过滤。"""
    q = select(CommunityProposal).where(CommunityProposal.camp_id.is_not(None))
    if camp_id:
        q = q.where(CommunityProposal.camp_id == camp_id)
    result = await db.execute(
        q.order_by(CommunityProposal.created_at.desc()).limit(min(limit, 200))
    )
    proposals = []
    for p in result.scalars():
        proposals.append(await _serialize_proposal(db, p))
    return {"ok": True, "items": proposals}


# ══════════════════════════════════════════════════════
# health 路由 (/api/health)
# ══════════════════════════════════════════════════════
health_report_router = APIRouter(prefix="/api/health", tags=["health"])


@health_report_router.get("/report")
async def health_report(user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    """GET /api/health/report — 个人体检报告（劳动/经济/信誉/活跃度汇总）。"""
    # 劳动统计：已完成任务数 + 总获得 NT
    task_done_r = await db.execute(
        select(func.count(NTTask.id), func.coalesce(func.sum(NTTask.reward), 0))
        .where(
            (NTTask.assignee == user.id) | (NTTask.assignees.like(f'%"{user.id}"%')),
            NTTask.status.in_(("待结算", "已结算")),
        )
    )
    task_count, task_earned = task_done_r.one()

    # 校核统计
    vfy_r = await db.execute(
        select(func.count(Verification.id))
        .where(Verification.doer == user.id, Verification.status == "verified")
    )
    vfy_count = vfy_r.scalar() or 0

    # 最近 30 天流水
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
    ledger_r = await db.execute(
        select(func.coalesce(func.sum(NTLedger.amount), 0))
        .where(
            NTLedger.to_user == user.id,
            NTLedger.type.in_(("earn", "task_reward", "personal_earn")),
            NTLedger.created_at >= thirty_days_ago,
        )
    )
    recent_income = ledger_r.scalar() or 0

    # XP 分桶
    try:
        xp_by_cat = json.loads(user.xp_by_category) if user.xp_by_category else {}
    except (json.JSONDecodeError, TypeError):
        xp_by_cat = {}

    # 活跃度
    days_active = 0
    if user.last_active_at:
        try:
            days_active = (date.today() - user.last_active_at).days
        except (ValueError, TypeError):
            days_active = -1

    return {
        "ok": True,
        "balance": user.nt_balance,
        "cv": user.contribution_value,
        "xp": user.experience_value,
        "trust_score": user.trust_score,
        "trust_level": user.trust_level,
        "tasks_completed": task_count or 0,
        "tasks_earned_nt": task_earned or 0,
        "verifications_done": vfy_count,
        "income_30d": recent_income,
        "xp_by_category": xp_by_cat,
        "clean_weekly_streak": user.clean_weekly_streak or 0,
        "days_since_active": days_active,
        "frozen_cv": user.frozen_cv or 0,
    }


# ══════════════════════════════════════════════════════
# cleaning_pricing 路由 (/api/cleaning_pricing)
# ══════════════════════════════════════════════════════
cleaning_pricing_router = APIRouter(prefix="/api/cleaning_pricing", tags=["cleaning_pricing"])

# 清洁定价三档（前端 _defaultConfig 对齐）
CLEANING_PRICING = {
    "dirty": 20,     # 🔴 超时/脏乱
    "warning": 15,   # 🟡 需注意
    "clean": 5,      # 🟢 日常维护
}


@cleaning_pricing_router.get("")
async def get_cleaning_pricing(user: User = Depends(get_current_user)):
    """GET /api/cleaning_pricing — 清洁定价三档（后端真源）。"""
    return {"ok": True, **CLEANING_PRICING}
