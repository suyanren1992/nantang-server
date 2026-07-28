# -*- coding: utf-8 -*-
"""G-1 公约签署凭证 + 公约文本 config 路由。

- POST /api/covenant/sign   首签当前版本→记录+从社区池发首签 NT（幂等防重，续签不发）
- GET  /api/covenant/status 当前公约版本 + 本用户是否已签当前版本
- GET  /api/covenant/text   公约全文 config（存 MapLocation key=covenant_text）

铁律：发 NT 必写 ledger 且 pool.balance 同步减；首签奖励金额进 config(sign_reward)不硬编码；
      文本修改走 D-15 pendingConfigChanges 提案-校核-生效机制，本路由不提供文本写入端点。
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import User, CovenantSignature, MapLocation
from routes.auth import get_current_user
from nt_helpers import _ledger_id, _add_ledger, _get_pool

router = APIRouter(prefix="/api/covenant", tags=["covenant"])

COVENANT_TEXT_KEY = "covenant_text"

# 初始公约全文 config（提取自《社区公约与共居住约定_v12》）。
# 后续修改走 D-15 pendingConfigChanges（F8），此常量仅作首次 seed 的默认值。
DEFAULT_COVENANT_TEXT = {
    "version": "v12",
    "title": "南塘合作大院共居公约",
    "sign_reward": 10,  # 首签奖励 NT（金额进 config，不硬编码）
    "chapters": [
        {"no": "一", "title": "我们是谁"},
        {"no": "二", "title": "区域一览"},
        {"no": "三", "title": "安全须知"},
        {"no": "四", "title": "NT 与空间使用费"},
        {"no": "五", "title": "劳动与贡献"},
        {"no": "六", "title": "共享空间"},
        {"no": "七", "title": "我们的责任"},
        {"no": "八", "title": "约怎么改"},
        {"no": "九", "title": "生活组"},
        {"no": "十", "title": "表决与生效"},
    ],
    "appendices": [
        {"key": "A", "title": "区域介绍"},
        {"key": "B", "title": "劳动定价与劳动标准"},
        {"key": "C", "title": "新人引导（一页工单）"},
        {"key": "D", "title": "生活组组长：职责、权限与报酬"},
        {"key": "E", "title": "公约解释（为什么这样设计）"},
    ],
    "sign_terms": [
        "我知道大院各个区域的情况，也知晓流浪猫狗、农具、车辆、公共区域活动的安全风险，自己的安全自己负责",
        "我知道 NT 是大院的劳动积分，不能购买物资、不能兑换人民币；空间使用费按公约 4.2 的标准，用 NT 支付",
        "我愿意承担每周一集体大扫除和突击整理的参与义务；这跟 NT 余额多少无关，不想亲手做可以付 NT 请人代",
        "我愿意遵守共享空间的规则：安静时段、厨房、农具、公共空间、退房恢复原状",
        "我同意“个人行为个人负责”的责任边界，也同意公约的修订程序",
    ],
    "sign_types": ["新入住", "老成员补签", "续签（修订后重签）"],
    "note": "首签发 10 NT，每人只发一次（首次签署），续签不发；转账记录即签署凭证。",
}


async def _get_covenant_config(db: AsyncSession) -> dict:
    """读取 covenant_text config；不存在则惰性 seed 默认值（幂等，不覆盖已存在的修订）。"""
    row = (await db.execute(
        select(MapLocation).where(MapLocation.key == COVENANT_TEXT_KEY)
    )).scalar_one_or_none()
    if row and row.data:
        try:
            return json.loads(row.data)
        except (json.JSONDecodeError, TypeError):
            pass
    # 惰性 seed：仅当缺失时写入默认，绝不覆盖已存在的（D-15 修订经由此表落地）
    if not row:
        db.add(MapLocation(key=COVENANT_TEXT_KEY,
                           data=json.dumps(DEFAULT_COVENANT_TEXT, ensure_ascii=False)))
        await db.commit()
    return dict(DEFAULT_COVENANT_TEXT)


@router.get("/text")
async def get_covenant_text(user: User = Depends(get_current_user),
                            db: AsyncSession = Depends(get_db)):
    cfg = await _get_covenant_config(db)
    return cfg


@router.get("/status")
async def covenant_status(user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    cfg = await _get_covenant_config(db)
    version = cfg.get("version", "v12")
    sig = (await db.execute(
        select(CovenantSignature).where(
            CovenantSignature.user_id == user.id,
            CovenantSignature.covenant_version == version,
        )
    )).scalar_one_or_none()
    return {
        "version": version,
        "signed": sig is not None,
        "signed_at": sig.signed_at if sig else None,
        "sign_reward": cfg.get("sign_reward", 10),
    }


@router.post("/sign")
async def covenant_sign(version: str = Body(default="", embed=True),
                        sign_type: str = Body(default="新入住", embed=True),
                        user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    cfg = await _get_covenant_config(db)
    current_version = cfg.get("version", "v12")
    reward = int(cfg.get("sign_reward", 10))

    # 签旧版本 → 409（客户端显式传了非当前版本）
    if version and version != current_version:
        raise HTTPException(status_code=409,
                            detail=f"请签署当前版本 {current_version}（你提交的是 {version}）")

    # 幂等：已签当前版本 → 直接返回，不重复发 NT
    existing = (await db.execute(
        select(CovenantSignature).where(
            CovenantSignature.user_id == user.id,
            CovenantSignature.covenant_version == current_version,
        )
    )).scalar_one_or_none()
    if existing:
        return {
            "ok": True, "signed": True, "already_signed": True,
            "reward_granted": False, "version": current_version,
            "balance": user.nt_balance,
        }

    # 续签不发：只有历史零签署（真·首次签署）才发 NT
    prior_count = (await db.execute(
        select(func.count()).select_from(CovenantSignature).where(
            CovenantSignature.user_id == user.id
        )
    )).scalar() or 0
    grant_reward = (prior_count == 0)

    now = datetime.utcnow().isoformat()
    sig = CovenantSignature(
        user_id=user.id, covenant_version=current_version,
        sign_type=sign_type, reward_granted=grant_reward, signed_at=now,
    )
    db.add(sig)

    balance = user.nt_balance
    if grant_reward and reward > 0:
        # 钱随单走：社区池发 NT → pool.balance 同步减 + ledger 一条
        pool = await _get_pool(db, lock=True)
        if pool.balance < reward:
            raise HTTPException(status_code=400, detail="社区池余额不足，无法发放签署 NT")
        pool.balance -= reward
        u = (await db.execute(
            select(User).where(User.id == user.id)
            .with_for_update().execution_options(populate_existing=True)
        )).scalar_one()
        u.nt_balance += reward
        balance = u.nt_balance
        await _add_ledger(db, _ledger_id(), "community_pool", user.id, reward,
                          "covenant_sign", f"签署公约 {current_version}", status="settled")

    await db.commit()
    return {
        "ok": True, "signed": True, "already_signed": False,
        "reward_granted": grant_reward, "reward": reward if grant_reward else 0,
        "version": current_version, "balance": balance,
    }
