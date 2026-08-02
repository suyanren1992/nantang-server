"""Admin routes: pending newbie review, community task publishing, withdraw management, dev tools."""
import os, json, hashlib
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_db
from models import Verification, User, NTLedger, CommunityPool, NTTask, Camp, MapLocation
from routes.auth import require_admin, get_current_user, hash_password
from nt_helpers import _get_pool, _ledger_id, _add_ledger
import logging

logger = logging.getLogger("nantang.admin")

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
    # P0-1: entry 行锁 + populate_existing——双 admin 并发 confirm 时，第二事务阻塞等锁，
    # 锁释放后重查 status='pending' 不再命中（已 settled）→ 返回 404「已处理」，frozen/total_issued 只减一次。
    # 同 D-17/P1-3 锁型。
    entry = (await db.execute(
        select(NTLedger).where(NTLedger.entry_id == entry_id, NTLedger.status == "pending")
        .with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "提现记录不存在或已处理")

    pool = await _get_pool(db, lock=True)
    # W7-NT-2 B-最小: entry.amount = pay_now（账本存的就是能发金额）
    # 用户已被扣 pay_now，confirm 只销毁冻结，不再动用户余额
    pool.frozen = (pool.frozen or 0) - entry.amount
    pool.total_issued -= entry.amount  # 烧币：NT 离开系统，total_issued 减少
    await _add_ledger(db, _ledger_id(), entry.from_user, None, entry.amount,
                      "withdraw_confirmed", f"提现确认 #{entry_id[:8]}", status="confirmed")
    entry.status = "settled"
    entry.settled_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True, "entry_id": entry_id}


@router.post("/withdraw/reject")
async def reject_withdraw(entry_id: str, admin: User = Depends(require_admin),
                           db: AsyncSession = Depends(get_db)):
    """管理员拒绝提现——退回冻结资金到用户余额"""
    # P0-1: 同型行锁——reject 同样销/退冻结资金，双并发 reject 会双退，同款补锁。
    entry = (await db.execute(
        select(NTLedger).where(NTLedger.entry_id == entry_id, NTLedger.status == "pending")
        .with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "提现记录不存在或已处理")

    pool = await _get_pool(db, lock=True)
    # W7-NT-2 B-最小: entry.amount = pay_now，解冻并退回用户已被扣的部分
    pool.frozen = (pool.frozen or 0) - entry.amount
    # SSOT-CHAIN: 不退回 reserve。reserve 是 pool.balance 的内部额控，退款只回用户余额。
    user = (await db.execute(select(User).where(User.id == entry.from_user))).scalar_one_or_none()
    if user:
        user.nt_balance += entry.amount
    await _add_ledger(db, _ledger_id(), entry.from_user, "frozen_pool", entry.amount,
                      "withdraw_rejected", f"提现拒绝 #{entry_id[:8]}", status="rejected")
    entry.status = "cancelled"

    # W7-ORPHAN-QUEUE OQ-C: 连带取消排队流水（queue_amount 在 NT-2-A 留在余额，
    # 只需标记取消即可，无需资金操作）
    queued_entry = (await db.execute(
        select(NTLedger).where(NTLedger.entry_id == entry.entry_id + "-q")
    )).scalar_one_or_none()
    if queued_entry and queued_entry.status == "queued":
        queued_entry.status = "cancelled"

    await db.commit()
    return {"ok": True, "entry_id": entry_id, "refunded": True}


# ══ SM-5返修: Dev Tools（admin + DEV_TOOLS_ENABLED 双闸） ══

def _dev_enabled():
    return os.environ.get("DEV_TOOLS_ENABLED", "").strip().lower() in ("1", "true", "yes")


def _dev_gate(user: User):
    if not _dev_enabled():
        raise HTTPException(status_code=404, detail="Not found")
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin required")


def _seed_id(key: str) -> str:
    return "seed_" + hashlib.md5(key.encode()).hexdigest()[:8]


SEED_KEY_PREFIXES = ("seed_", "presence:")


async def _chain_balance_or_none():
    """读多签钱包链上 NT 余额。读不到返 None(不猜、不默认数字)。"""
    import os
    wallet = os.environ.get("PLATFORM_WALLET_ADDRESS", "")
    token = os.environ.get("NT_TOKEN_CONTRACT", "")
    if not wallet or not token:
        return None
    try:
        from web3 import Web3
        rpc = os.environ.get("OP_RPC_URL", "https://mainnet.optimism.io")
        w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": 15}))
        abi = ('[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],'
               '"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},'
               '{"constant":true,"inputs":[],"name":"decimals",'
               '"outputs":[{"name":"","type":"uint8"}],"type":"function"}]')
        c = w3.eth.contract(address=w3.to_checksum_address(token), abi=abi)
        dec = c.functions.decimals().call()
        raw = c.functions.balanceOf(w3.to_checksum_address(wallet)).call()
        return raw // 10 ** dec
    except Exception as e:
        logger.warning("[dev-reset] 链上余额读取失败: %s", e)
        return None


async def _reset_pool_to_chain(db, pool, now, mode):
    """SSOT-CHAIN: 重置后池子对齐链上余额, 而非写死 500。

    原实现 balance=500/total_issued=500 写死了数字。链上实际是 1000 时,
    跑一次重置就把池子打回 500 — 凭空蒸发 500 NT, 账立刻不平。
    读不到链上余额时保持原值不写 0（防 RPC 故障清零全池）。
    """
    chain = await _chain_balance_or_none()
    if chain is None:
        logger.error("[dev-reset %s] 链上余额读取失败——池子原值不变，请检查 RPC/环境变量", mode)
        return None  # 不写 0，保持原值
    pool.balance = chain
    pool.total_issued = chain
    pool.task_escrow = 0
    pool.contribution_pool = 0
    pool.camp_balance = 0
    pool.reserve = 0
    pool.frozen = 0
    pool.updated_at = now
    db.add(NTLedger(entry_id=_ledger_id(), type="pool_init",
                    from_user="system", to_user="community_pool",
                    amount=chain,
                    reason=f"社区池对齐链上余额（dev-reset {mode}）",
                    status="settled", created_at=now, settled_at=now))
    logger.info("[dev-reset %s] 池子对齐链上余额=%s", mode, chain)
    return chain


@router.post("/dev-reset")
async def dev_reset(mode: str = "soft", admin: User = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    _dev_gate(admin)
    now = datetime.utcnow().isoformat()
    from models import Journal, InventoryItem, NewbieQuest, ActivityLog, CardDiscovery, MealOrder
    # U-2: 后加 4 表未入删表清单——删 camps/users 时 FK 引用尚存致 500
    from models import CampBuilder, DepositIntent, Tenancy, CovenantSignature, CampMembership, InnRoom
    # P3-二营乙: 共享厨房 4 表（FK->users，须先于 delete(User)）
    from models import PotluckParticipant, PotluckEvent, KitchenSlot, SharedItem
    # W7: 孪生系统新表（FK→users/items/map_locations，须先于 delete(User)/delete(MapLocation)）
    from models import SpaceEvent, Item, FieldPlot

    if mode == "hard":
        # 新表优先删（FK 指向 users/items/map_locations）
        await db.execute(delete(SpaceEvent))
        await db.execute(delete(Item))
        await db.execute(delete(FieldPlot))
        await db.execute(delete(NTTask))
        await db.execute(delete(Verification))
        await db.execute(delete(NTLedger))
        await db.execute(delete(Journal))
        await db.execute(delete(InventoryItem))
        await db.execute(delete(NewbieQuest))
        await db.execute(delete(ActivityLog))
        await db.execute(delete(CardDiscovery))
        await db.execute(delete(MealOrder))
        await db.execute(delete(MapLocation))
        await db.execute(delete(CampMembership))  # C-B-1: FK->camps & users，先于 delete(Camp)/delete(User)
        await db.execute(delete(CampBuilder))   # U-2: FK->camps，先于 delete(Camp)
        await db.execute(delete(Camp))
        await db.execute(delete(DepositIntent))    # U-2: FK->users，先于 delete(User)
        await db.execute(delete(Tenancy))          # U-2: FK->users，先于 delete(User)
        await db.execute(delete(InnRoom))          # C-B-4: 民宿房型配置表，hard 全清
        await db.execute(delete(CovenantSignature))  # U-2: 无 FK 但语义应清，先于 delete(User)
        await db.execute(delete(PotluckParticipant))  # P3: FK->potluck_events & users
        await db.execute(delete(PotluckEvent))        # P3: FK->users
        await db.execute(delete(KitchenSlot))         # P3: FK->users
        await db.execute(delete(SharedItem))          # P3: FK->users
        await db.execute(delete(User))
        pool = await _get_pool(db, lock=True)  # CR-3: dev 工具写池补行锁
        await db.execute(delete(CommunityPool).where(CommunityPool.singleton == True))
        await db.commit()
        new_pool = CommunityPool(singleton=True, balance=0, total_issued=0, task_escrow=0,
                                  contribution_pool=0, camp_balance=0, reserve=0, frozen=0)
        db.add(new_pool)
        await db.flush()
        await _reset_pool_to_chain(db, new_pool, now, "hard")
    else:
        # soft: 保留 users，清业务表
        await db.execute(delete(NTTask))
        await db.execute(delete(Verification))
        await db.execute(delete(NTLedger))
        await db.execute(delete(Journal))
        await db.execute(delete(InventoryItem))
        await db.execute(delete(NewbieQuest))
        await db.execute(delete(ActivityLog))
        await db.execute(delete(CardDiscovery))
        await db.execute(delete(MealOrder))
        # MapLocation: 只删 seed/presence/config 键，保留 shared(地图)等真实数据
        for prefix in SEED_KEY_PREFIXES:
            await db.execute(delete(MapLocation).where(MapLocation.key.like(f"{prefix}%")))
        await db.execute(delete(CampMembership))  # C-B-1: FK->camps，先于 delete(Camp)（soft 删 camps 故须清子行；users 保留）
        await db.execute(delete(CampBuilder))   # U-2: FK->camps，先于 delete(Camp)（soft 不删 users，其余三表不动）
        await db.execute(delete(Camp))
        pool = await _get_pool(db, lock=True)  # CR-3: dev 工具写池补行锁
        await _reset_pool_to_chain(db, pool, now, "soft")
        users = (await db.execute(select(User))).scalars().all()
        for u in users:
            u.nt_balance = 0; u.contribution_value = 0; u.experience_value = 0
            u.trust_score = 100; u.frozen_cv = 0

    await db.commit()
    return {"ok": True, "mode": mode, "ts": now}


@router.post("/dev-seed")
async def dev_seed(admin: User = Depends(get_current_user),
                   db: AsyncSession = Depends(get_db)):
    _dev_gate(admin)
    now = datetime.utcnow().isoformat()
    pwd_hash = hash_password("test12345")
    created = []
    from models import Journal

    # ── 用户（幂等）──
    async def _ensure_user(uid, role, nt):
        ex = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
        if ex:
            return ex
        u = User(id=uid, password_hash=pwd_hash, role=role, nt_balance=nt,
                 avatar_seed=uid, created_at=now, updated_at=now)
        db.add(u)
        created.append(f"user:{uid}")
        return u

    u1 = await _ensure_user("测试甲", "builder", 100)
    u2 = await _ensure_user("测试乙", "adventurer", 100)
    u3 = await _ensure_user("测试丙", "visitor", 100)

    # ── 营地（幂等）──
    sid1 = _seed_id("camp_active")
    sid2 = _seed_id("camp_upcoming")
    ex_camps = (await db.execute(select(Camp).where(Camp.id.in_([sid1, sid2])))).scalars().all()
    existing_camp_ids = {c.id for c in ex_camps}
    if sid1 not in existing_camp_ids:
        db.add(Camp(id=sid1, name="第四期共创营", emoji="🏕️", theme="南塘有风，共创有光", date="7/20 — 7/27",
                    status="active", people=5, max=16, location="南塘合作社大院",
                    desc="七天沉浸式在地创作：工笔画、陶艺、书法、田园生活。",
                    highlights=json.dumps(["7/20 开营仪式", "7/22 工笔画大师课", "7/25 作品展览", "7/27 结营仪式"]),
                    created_by="测试甲", created_at=now))
        created.append("camp:第四期共创营")
    if sid2 not in existing_camp_ids:
        db.add(Camp(id=sid2, name="夏季写生周", emoji="🎨", theme="户外写生+导师一对一点评", date="8/1 — 8/5",
                    status="upcoming", people=3, max=10, location="大地书房",
                    desc="五天集中写生，导师一对一点评。适合有基础的同学。",
                    highlights=json.dumps(["8/1 开营", "8/2-4 写生+点评", "8/5 作品展"]),
                    created_by="测试乙", created_at=now))
        created.append("camp:夏季写生周")

    # ── 任务（幂等）──
    t1_id = _seed_id("task_personal")
    t2_id = _seed_id("task_camp")
    t3_id = _seed_id("task_community")
    ex_tasks = (await db.execute(select(NTTask).where(NTTask.id.in_([t1_id, t2_id, t3_id])))).scalars().all()
    existing_task_ids = {t.id for t in ex_tasks}
    if t1_id not in existing_task_ids:
        db.add(NTTask(id=t1_id, poster="测试甲", title="整理书房书架", reward=5, category="日常", scope="个人",
                      note="把书房的书按分类整理好", slots=1, status="进行中", created_at=now))
        created.append("task:个人")
    if t2_id not in existing_task_ids:
        db.add(NTTask(id=t2_id, poster="测试乙", title="营地宣传海报设计", reward=15, category="宣传", scope="营队",
                      note="设计一张A3海报用于社区公告栏", slots=1, status="进行中", created_at=now))
        created.append("task:营队")
    if t3_id not in existing_task_ids:
        db.add(NTTask(id=t3_id, poster="社区", title="村口公告栏更新", reward=10, category="宣传", scope="社区",
                      note="更新本周活动安排和天气提醒", slots=2, status="进行中", created_at=now))
        created.append("task:社区")

    # ── 待校核（幂等）──
    vfy_id = _seed_id("vfy_pending")
    ex_vfy = (await db.execute(select(Verification).where(Verification.id == vfy_id))).scalar_one_or_none()
    if not ex_vfy:
        db.add(Verification(id=vfy_id, type="cleaning", doer="测试甲", action="打扫了 正厅",
                            detail=json.dumps({"roomId":"hall","roomName":"正厅","nt":15}),
                            nt_amount=15, verifier_reward=5, status="pending", created_at=now))
        created.append("vfy:pending")

    # ── 翻牌 presence → MapLocation（sync_all 读 MapLocation key=presence:{uid}，正确源）──
    async def _ensure_presence(uid, loc):
        key = f"presence:{uid}"
        ex = (await db.execute(select(MapLocation).where(MapLocation.key == key))).scalar_one_or_none()
        if not ex:
            db.add(MapLocation(key=key, data=json.dumps({"status":"onsite","location":loc,"updatedAt":now})))
            created.append(f"presence:{uid}")
    await _ensure_presence("测试甲", "大地书房")
    await _ensure_presence("测试乙", "南塘")

    # ── journal 时间线 → Journal 表（sync_all 读 Journal 表，正确源）──
    async def _add_journal(uid, jtype, content):
        # 幂等：Journal.id 为自增整数主键，不能塞字符串；按 user+type+content 查重
        ex = (await db.execute(select(Journal).where(
            Journal.user == uid, Journal.type == jtype, Journal.content == content
        ))).scalar_one_or_none()
        if not ex:
            db.add(Journal(user=uid, type=jtype, content=content, time=now))
            created.append(f"journal:{uid}/{jtype}")
    await _add_journal("测试甲", "cleaning", "打扫了正厅")
    await _add_journal("测试乙", "cooking", "做了午餐——番茄炒蛋+米饭")
    await _add_journal("测试甲", "register", "加入了南塘云村")

    # ── 冰箱/物品 seed：卡面 v1.2 删除。
    #     实证前端冰箱面板读 localStorage（AppData._data.inventory.office），非 InventoryItem 表；
    #     服务端 seed 填不进冰箱 UI，改真机手动录入 1 件验证录入链路。

    # ── SSOT-CHAIN: 删除"补池至 500" ──
    # 原实现在池子 < 500 时凭空补差额并 total_issued += diff — 这是印钱。
    # 链上没有对应的 NT, 补出来的部分永远无法兑付, 对账必不平。
    # 测试需要池子有钱 -> 往多签钱包真充 NT(扫链自动入池), 不得凭空造。
    pool = await _get_pool(db, lock=True)
    created.append(f"pool:unchanged({pool.balance})")

    # cleaning/spaces 为纯本地数据（仅 localStorage），无法通过 server 端点 seed——已跳过

    await db.commit()
    return {"ok": True, "created": created, "ts": now}
