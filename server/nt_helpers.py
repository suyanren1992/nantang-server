"""Shared NT economy helpers — extracted from routes/nt.py and cron.py to DRY.

ponytail: single source of truth for _get_pool (with lock param), _add_ledger,
_ledger_id (collision-proof), and _safe_assignees (corrupt-JSON fallback).

A-LABOR-BE: 新增 _get_4pool() 四池视图 + _calc_escrow_drift() 漂移校验。
"""

import json
import logging
import secrets
from datetime import datetime
from sqlalchemy import select
from models import CommunityPool, NTLedger

logger = logging.getLogger("nt_helpers")


def _ledger_id():
    """Unique ledger entry ID — collision-proof with token_hex(3)."""
    now = datetime.utcnow()
    return f"L{now.strftime('%y%m%d')}-{now.strftime('%f')}-{secrets.token_hex(3)}"


async def _add_ledger(db, entry_id, from_user, to_user, amount, type_,
                      reason="", task_id=None, status="settled", tx_hash=None):
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
        tx_hash=tx_hash,
    )
    db.add(entry)


async def _get_pool(db, lock: bool = False):
    """Get or create CommunityPool singleton. pass lock=True for row-level lock."""
    q = select(CommunityPool).limit(1)
    if lock:
        q = q.with_for_update().execution_options(populate_existing=True)
    result = await db.execute(q)
    pool = result.scalar_one_or_none()
    if not pool:
        # SSOT-CHAIN: 池行自动创建时一律从 0 开始 — 钱只能从链上进来。
        # 原为 500, 意味着任何一个碰到空池的请求都会凭空发 500 NT。
        pool = CommunityPool(
            balance=0, total_issued=0, task_escrow=0,
            contribution_pool=0, camp_balance=0,
            reserve=0, frozen=0,
            updated_at=datetime.utcnow().isoformat(),
        )
        db.add(pool)
        await db.flush()
    # R7 migration guard: 已有数据库的 camp_balance 列可能为 NULL
    if pool.camp_balance is None:
        pool.camp_balance = 0
    if pool.reserve is None:
        pool.reserve = 0
    if pool.frozen is None:
        pool.frozen = 0
    # SSOT-CHAIN A' N-1b: reserve ≤ balance 硬不变量。
    # reserve 是提现额度上限（available = reserve - frozen），虚高 = 用户能提出
    # 超过运营池实有的钱。clamp 只收窄不放大；改动时 warning 打印原值与新值
    # （涉钱大忌：静默修数据）。
    _bal = pool.balance or 0
    _res = pool.reserve or 0
    if _res > _bal:
        logger.warning("[SSOT-CHAIN N-1b] reserve(%s) > balance(%s), clamp→%s",
                       _res, _bal, _bal)
        pool.reserve = _bal
    return pool


def _safe_assignees(task):
    """Safely parse task.assignees JSON. Falls back to [task.assignee] on corruption.

    Ensures all callers that parse assignees don't 500 on manually-edited DB rows.
    ponytail: 'assignee' 列（单值）为过渡期兼容，Phase E 后可移除 fallback 分支。
    """
    try:
        if task.assignees:
            return json.loads(task.assignees)
        return []
    except (json.JSONDecodeError, TypeError):
        return [task.assignee] if task.assignee else []


async def _get_4pool(db) -> dict:
    """四池视图——从 CommunityPool 单表派生四池值（A-LABOR-BE ⑥）。
    拆表前过渡期：物理上仍是单表，语义上拆四池。
    返回: {operating, escrow, reserve, frozen, total_issued, camp_balance}
    """
    pool = await _get_pool(db)
    return {
        "operating": pool.balance or 0,       # 运营池
        "escrow": pool.task_escrow or 0,      # 任务托管池
        "reserve": pool.reserve or 0,         # 储备池
        "frozen": pool.frozen or 0,           # 提现待审池
        "total_issued": pool.total_issued or 0,
        "camp_balance": pool.camp_balance or 0,
    }


async def _calc_escrow_drift(db) -> int:
    """escrow_drift = escrow_pool − Σ未领取且未退回份额。
    口径写死（NT_FIELD_CONTRACT v0.2 §3）：
    EscrowPool.balance − Σ(reward × (slots − 已到账人数 − 已退回份额))
    必须 = 0，否则会计不守恒。
    """
    from models import NTTask, TASK_STATUSES
    pool = await _get_pool(db)
    escrow_pool = pool.task_escrow or 0

    # 计算未领取且未退回份额
    # 状态为“进行中/待审核/待提交/退回修改/已争议”的任务有未释放的 escrow
    open_statuses = (
        TASK_STATUSES["open"],
        TASK_STATUSES["submitted"],
        TASK_STATUSES["pending_submit"],
        TASK_STATUSES["rejected"],
        TASK_STATUSES["disputed"],
    )
    result = await db.execute(
        select(NTTask).where(
            NTTask.status.in_(open_statuses),
            NTTask.escrow_amount > 0,
        )
    )
    tasks = list(result.scalars())
    unclaimed_total = sum(t.escrow_amount for t in tasks)
    return escrow_pool - unclaimed_total


async def _accounting_check(db) -> dict:
    """会计等式 + 硬检查（A-LABOR-BE ⑧⑨⑩）。
    返回 {pass, total_user, operating, escrow, frozen, total_issued, diff,
           reserve_covers_frozen, escrow_drift}。
    """
    from models import User
    pool4 = await _get_4pool(db)
    user_result = await db.execute(select(User))
    total_user = sum(u.nt_balance for u in user_result.scalars())
    # SSOT-CHAIN: 等式口径与 /verify 一致
    # total_issued = Σuser + operating + escrow + camp + frozen
    # reserve 不等于式项（它是 pool.balance 的内部额控，非独立资金池）
    total_system = (total_user + pool4["operating"] + pool4["escrow"]
                    + pool4["camp_balance"] + pool4["frozen"])
    diff = total_system - pool4["total_issued"]
    reserve_covers_frozen = pool4["reserve"] >= pool4["frozen"]
    escrow_drift = await _calc_escrow_drift(db)
    return {
        "pass": abs(diff) <= 1 and reserve_covers_frozen and escrow_drift == 0,
        "total_user": total_user,
        "operating": pool4["operating"],
        "escrow": pool4["escrow"],
        "reserve": pool4["reserve"],
        "frozen": pool4["frozen"],
        "total_issued": pool4["total_issued"],
        "total_system": total_system,
        "diff": diff,
        "reserve_covers_frozen": reserve_covers_frozen,
        "escrow_drift": escrow_drift,
    }
