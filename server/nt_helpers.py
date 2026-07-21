"""Shared NT economy helpers — extracted from routes/nt.py and cron.py to DRY.

ponytail: single source of truth for _get_pool (with lock param), _add_ledger,
_ledger_id (collision-proof), and _safe_assignees (corrupt-JSON fallback).
"""

import json
import secrets
from datetime import datetime
from sqlalchemy import select
from models import CommunityPool, NTLedger


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
        q = q.with_for_update()
    result = await db.execute(q)
    pool = result.scalar_one_or_none()
    if not pool:
        pool = CommunityPool(
            balance=0, total_issued=0, task_escrow=0,
            contribution_pool=0, camp_balance=0,
            updated_at=datetime.utcnow().isoformat(),
        )
        db.add(pool)
        await db.flush()
    # R7 migration guard: 已有数据库的 camp_balance 列可能为 NULL
    if pool.camp_balance is None:
        pool.camp_balance = 0
    return pool


def _safe_assignees(task):
    """Safely parse task.assignees JSON. Falls back to [task.assignee] on corruption.

    Ensures all callers that parse assignees don't 500 on manually-edited DB rows.
    """
    try:
        if task.assignees:
            return json.loads(task.assignees)
        return []
    except (json.JSONDecodeError, TypeError):
        return [task.assignee] if task.assignee else []
