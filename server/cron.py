"""Cron runner — 每日 00:05 触发。ponytail: 单进程 asyncio sleep loop，无 APScheduler 依赖。

Round 6: 完整实现周期任务自动生成（读 periodic_tasks.json → 检查幂等 → 扣池 → 创建 NTTask）。
"""
import asyncio
import json
import logging
import os
import secrets
from datetime import datetime, timedelta
from sqlalchemy import select
from database import async_session
from models import NTTask
from nt_helpers import _ledger_id, _add_ledger, _get_pool, _accounting_check
logger = logging.getLogger("cron")

# ══ A-LABOR-BE ⑧-⑪: 会计硬检查状态 ══
_consecutive_check_failures = 0
_check_blocked = False  # True = 3 次连续失败，阻断日结，待 admin 手动解锁
_CHECK_BLOCK_THRESHOLD = 3


def reset_accounting_lock():
    """Admin 手动解锁会计检查阻断（供 /api/system/reset-accounting-lock 调用）。"""
    global _consecutive_check_failures, _check_blocked
    _consecutive_check_failures = 0
    _check_blocked = False

TEMPLATES_PATH = os.path.join(os.path.dirname(__file__), "config", "periodic_tasks.json")
_TEMPLATES_CACHE = None


def _load_templates():
    """模块级 JSON 缓存——避免每次 tick 重新读盘+解析。"""
    global _TEMPLATES_CACHE
    if _TEMPLATES_CACHE is None:
        with open(TEMPLATES_PATH, encoding="utf-8") as f:
            _TEMPLATES_CACHE = json.load(f)["templates"]
    return _TEMPLATES_CACHE


def _task_id():
    return f"T{datetime.utcnow().strftime('%y%m%d%H%M%S')}-{secrets.token_hex(3)}"


async def _wait_until(target_hour=0, target_minute=5):
    """计算到下一个 target_hour:target_minute 的秒数并 sleep。"""
    now = datetime.utcnow()
    target = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    seconds = (target - now).total_seconds()
    logger.info(f"cron: next tick at {target.isoformat()} ({seconds:.0f}s)")
    await asyncio.sleep(seconds)


async def run_cron():
    """主循环：每天 00:05 执行 tick。ponytail: 无限循环，异常不退出。"""
    while True:
        await _wait_until(0, 5)
        try:
            await tick_daily()
        except Exception as e:
            logger.error(f"cron tick failed: {e}")


async def tick_daily():
    """每日 00:05 触发——生成每日任务 + 检查每周任务 + 会计等式硬检查。"""
    global _consecutive_check_failures, _check_blocked
    today = datetime.utcnow().strftime("%Y-%m-%d")
    weekday = datetime.utcnow().weekday()  # 0=Monday, 6=Sunday

    # ══ A-LABOR-BE ⑪: 检查是否被阻断 ══
    if _check_blocked:
        logger.critical(f"cron: 会计检查已阻断(连续{_consecutive_check_failures}次失败)，等待 admin 手动解锁。日结跳过。")
        return

    try:
        templates = _load_templates()
    except Exception as e:
        logger.error(f"cron: failed to load templates: {e}")
        return

    async with async_session() as db:
        pool = await _get_pool(db, lock=True)
        created = 0

        for tmpl in templates:
            # 周期匹配
            if tmpl["period"] == "weekly":
                target_day = tmpl.get("dayOfWeek", 0)
                if weekday != target_day:
                    continue

            # 幂等键
            idem_key = f"{tmpl['id']}:{today}"
            existing = await db.execute(
                select(NTTask).where(NTTask.idempotency_key == idem_key)
            )
            if existing.scalar_one_or_none():
                continue

            # 池余额检查
            cost = tmpl["reward"] * tmpl["slots"]
            if pool.balance < cost:
                logger.warning(f"cron: pool balance ({pool.balance}) < {cost}, skip {tmpl['id']}")
                continue

            # 扣池 + 创建任务
            pool.balance -= cost
            pool.task_escrow += cost
            task = NTTask(
                id=_task_id(),
                poster="社区",
                title=tmpl["title"],
                reward=tmpl["reward"],
                slots=tmpl["slots"],
                scope=tmpl.get("scope", "社区"),
                category=tmpl.get("category", "other"),
                status="进行中",
                is_system_generated=True,
                idempotency_key=idem_key,
                escrow_amount=cost,
                created_at=datetime.utcnow().isoformat(),
            )
            db.add(task)
            lid = _ledger_id()
            await _add_ledger(db, lid, "community_pool", "escrow", cost,
                              "task_freeze", f"系统任务: {tmpl['title']}", task.id, status="pending")
            created += 1
            logger.info(f"cron: created task {task.id} — {tmpl['title']} ({cost} NT)")

        await db.commit()
        if created > 0:
            logger.info(f"cron: tick complete, {created} tasks generated")
        else:
            logger.debug("cron: tick complete, no new tasks")

    # D-26: 每日住宿费日结（直接调用内部函数，不走 HTTP；独立 session 隔离事务）
    try:
        from routes.nt import _run_daily_settlement
        async with async_session() as settle_db:
            settle_results = await _run_daily_settlement(settle_db)
            logger.info(f"cron: daily settlement complete: {settle_results}")
    except Exception as e:
        logger.error(f"cron: daily settlement failed: {e}")

    # ══ A-LABOR-BE ⑧⑨⑩: 会计等式 + reserve_covers_frozen + escrow_drift 硬检查 ══
    try:
        async with async_session() as check_db:
            checks = await _accounting_check(check_db)
            if not checks["pass"]:
                _consecutive_check_failures += 1
                logger.error(
                    f"cron: 会计检查失败 ({_consecutive_check_failures}/{_CHECK_BLOCK_THRESHOLD}): "
                    f"diff={checks['diff']}, reserve_covers_frozen={checks['reserve_covers_frozen']}, "
                    f"escrow_drift={checks['escrow_drift']}"
                )
                if _consecutive_check_failures >= _CHECK_BLOCK_THRESHOLD:
                    _check_blocked = True
                    logger.critical(
                        f"cron: 会计检查连续{_consecutive_check_failures}次失败，"
                        f"已阻断日结。请 admin 调用 /api/system/reset-accounting-lock 手动解锁。"
                    )
            else:
                # 检查通过，重置计数器
                if _consecutive_check_failures > 0:
                    logger.info(f"cron: 会计检查恢复，此前连续{_consecutive_check_failures}次失败，现已重置")
                _consecutive_check_failures = 0
    except Exception as e:
        _consecutive_check_failures += 1
        logger.error(f"cron: 会计检查异常 ({_consecutive_check_failures}/{_CHECK_BLOCK_THRESHOLD}): {e}")
        if _consecutive_check_failures >= _CHECK_BLOCK_THRESHOLD:
            _check_blocked = True
            logger.critical(f"cron: 会计检查连续异常，已阻断日结")

    # ══ SSOT-CHAIN: 每日链上对账 ══
    # 上面的会计检查右边用 total_issued(系统自己记的数), 是自证。
    # 这里拿链上真余额做右边 — 链上是底账, 系统是副本。
    await _chain_reconcile()


async def _chain_reconcile():
    """拿链上余额校账本, 不平即告警。

    不阻断日结: 链上读取依赖外部 RPC, 报错不应拖垮结算。
    但差额必须大声喊 — 这是"钱是否真存在"的唯一判据。
    """
    try:
        from routes.nt import _read_chain_balance
        from models import User as _U
        from sqlalchemy import select as _sel
        chain = await _read_chain_balance()
        if chain is None:
            logger.warning("[reconcile] 链上余额读不到, 本日跳过链上对账")
            return
        async with async_session() as db:
            users = list((await db.execute(_sel(_U))).scalars())
            pool = await _get_pool(db)
            book = (sum(u.nt_balance for u in users) + pool.balance
                    + pool.task_escrow + pool.camp_balance
                    + (pool.frozen or 0))
        diff = book - chain
        if diff == 0:
            logger.info("[reconcile] 链上对账平: %s NT", chain)
        elif diff > 0:
            logger.critical(
                "[reconcile][ALERT] 账上比链上多 %s NT "
                "(账本=%s 链上=%s) — 存在无链上支撑的记账, "
                "这部分 NT 永远无法兑付", diff, book, chain)
        else:
            logger.error(
                "[reconcile][ALERT] 链上比账上多 %s NT "
                "(账本=%s 链上=%s) — 有充值未入账"
                "(扫链漏扫或未知钱包转入)", -diff, book, chain)
    except Exception as e:
        logger.error("[reconcile] 链上对账异常: %s", e)
