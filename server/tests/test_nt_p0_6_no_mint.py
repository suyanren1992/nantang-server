# -*- coding: utf-8 -*-
"""NT-P0-6: 删除 pool_refill 印币逻辑的回归测试。

核心铁律：NT 是唯一「钱」，只能从链上真钱充值来，平台绝不印。
  · 原 server/routes/nt.py 每日无条件印 20 NT（from_account=None = 凭空造）
  · 本卡将其删除，以下 3 测固化「不再印币」的契约

判据（机器可验证）：
  1. 池 balance < 300 时跑 daily_tick，balance 不再被凭空 +20
  2. ledger 中不再出现 type='pool_refill' 的记录
  3. pool.total_issued 跑 tick 前后相等——平台绝不印 NT

铁律：只碰 server/，不碰 nantang-mobile/。
"""
import pytest
from sqlalchemy import select

from database import async_session
from models import CommunityPool, NTLedger, Tenancy
from routes.nt import _run_daily_settlement

_TICK_DAY = "2026-07-31"


async def _prep_pool(balance=100, total_issued=500, reserve=0):
    """设定社区池状态 + 清理残留 active tenancy，隔离 daily_tick 的住宿费扣款分支。

    reserve=0 确保第 3 步自动调水（balance<150 and reserve>0）不触发；
    清理 active tenancy 确保第 1 步住宿费扣款不执行；
    这样 balance 变化只受（已删除的）pool_refill 影响。
    """
    async with async_session() as s:
        # 清理其他测试残留的 active tenancy
        for t in (await s.execute(
            select(Tenancy).where(Tenancy.status == "active")
        )).scalars():
            t.status = "checked_out"
        # 设池
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=balance, total_issued=total_issued,
                                 reserve=reserve)
            s.add(pool)
        else:
            pool.balance = balance
            pool.total_issued = total_issued
            pool.reserve = reserve
            pool.last_tick_date = None
        await s.commit()


class TestNoMintPoolRefill:
    """NT-P0-6: 平台绝不凭空印 NT。"""

    @pytest.mark.asyncio
    async def test_daily_tick_no_pool_refill(self, db):
        """池 balance < 300 跑 daily_tick，balance 不再 +20。"""
        await _prep_pool(balance=100, total_issued=500, reserve=0)
        await _run_daily_settlement(db, today=_TICK_DAY)
        async with async_session() as s:
            pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one()
            assert pool.balance == 100, f"pool_refill 仍在印币：balance={pool.balance}"

    @pytest.mark.asyncio
    async def test_no_pool_refill_ledger(self, db):
        """daily_tick 后 ledger 无 type='pool_refill' 记录。"""
        await _prep_pool(balance=100, total_issued=500, reserve=0)
        await _run_daily_settlement(db, today=_TICK_DAY)
        async with async_session() as s:
            rows = (await s.execute(
                select(NTLedger).where(NTLedger.type == "pool_refill")
            )).scalars().all()
            assert len(rows) == 0, f"ledger 仍有 pool_refill 记录：{len(rows)} 条"

    @pytest.mark.asyncio
    async def test_total_issued_unchanged(self, db):
        """daily_tick 前后 pool.total_issued 相等。"""
        await _prep_pool(balance=100, total_issued=500, reserve=0)
        await _run_daily_settlement(db, today=_TICK_DAY)
        async with async_session() as s:
            pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one()
            assert pool.total_issued == 500, f"total_issued 被篡改：{pool.total_issued}"
