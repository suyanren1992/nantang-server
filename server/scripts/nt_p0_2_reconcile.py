#!/usr/bin/env python3
"""nt_p0_2_reconcile.py \u2014 NT-P0-2 reserve \u7834\u7b49\u5f0f\u8ffd\u8d26\u811a\u672c\uff08\u8b41\u94b1\u53ea\u8bfb\uff09\u3002

\u8b41\u94b1\u76ee\u7684\uff1a\u8b01\u5b9e\u201c\u6bcf\u5b8c\u6210\u4e00\u7b14\u63d0\u73b0 diff \u6c38\u4e45 -X\u201d\u7684\u6839\u56e0\u3002
\u65e7\u7b49\u5f0f\uff08\u542b reserve\uff09\u4e0b\uff0cwithdraw \u7533\u8bf7 reserve-=X \u65e0\u5bf9\u51b2\u9879 \u2192 total_system \u76f8\u5bf9 total_issued \u6301\u7eed -X\u3002
\u672c\u811a\u672c\u5bf9\u6bd4\uff1a
  A. \u5df2\u7ed3\u7b97\u63d0\u73b0\u603b\u989d  SUM(amount) WHERE type='withdraw' AND status='settled'
  B. \u65e7\u7b49\u5f0f diff\uff08\u542b reserve\uff09 vs \u65b0\u7b49\u5f0f diff\uff08\u4e0d\u542b reserve\uff09
  C. \u82e5 |\u65e7 diff - \u65b0 diff| == reserve \u4e14 \u65b0 diff \u2248 0 \u2192 \u6839\u56e0\u5750\u5b9e\uff08reserve \u9879\u5373\u5386\u53f2\u6f02\u79fb\u6765\u6e90\uff09

\u7528\u6cd5\uff1a
  python server/scripts/nt_p0_2_reconcile.py           # \u8bfb DATABASE_URL
  DATABASE_URL=... python server/scripts/nt_p0_2_reconcile.py

\u5b89\u5168\uff1a\u53ea\u8bfb\uff08SELECT\uff09\uff0c\u4e0d\u5199\u5e93\u3002\u6838\u9500\u8c03\u5e73\u9700\u53e6\u884c\u4eba\u5de5\u62a5\u7817\u4ec1\u7b7e\u5b57\u540e\u6267\u884c\uff0c\u672c\u811a\u672c\u4e0d\u4ee3\u5199\u3002
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, func  # noqa: E402
from database import async_session   # noqa: E402
from models import User, NTLedger, CommunityPool  # noqa: E402


async def main():
    async with async_session() as s:
        users = list((await s.execute(select(User))).scalars())
        total_user = sum(u.nt_balance for u in users)
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            print("[!] \u65e0 CommunityPool \u884c\uff0c\u65e0\u6cd5\u8ffd\u8d26")
            return

        settled_withdraw = (await s.execute(
            select(func.coalesce(func.sum(NTLedger.amount), 0)).where(
                NTLedger.type == "withdraw", NTLedger.status == "settled")
        )).scalar() or 0
        pending_withdraw = (await s.execute(
            select(func.coalesce(func.sum(NTLedger.amount), 0)).where(
                NTLedger.type == "withdraw", NTLedger.status == "pending")
        )).scalar() or 0

        reserve = pool.reserve or 0
        frozen = pool.frozen or 0
        base = total_user + pool.balance + pool.task_escrow + (pool.camp_balance or 0)
        old_total_system = base + reserve + frozen   # \u65e7\u7b49\u5f0f\uff08\u542b reserve\uff09
        new_total_system = base + frozen             # \u65b0\u7b49\u5f0f\uff08\u4e0d\u542b reserve\uff09
        old_diff = old_total_system - pool.total_issued
        new_diff = new_total_system - pool.total_issued

        print("=" * 56)
        print("NT-P0-2 reserve \u8ffd\u8d26\uff08\u53ea\u8bfb\uff09")
        print("=" * 56)
        print(f"  \u7528\u6237\u4f59\u989d\u603b\u548c        = {total_user}")
        print(f"  \u8fd0\u8425\u6c60 balance       = {pool.balance}")
        print(f"  \u4efb\u52a1\u6258\u7ba1 task_escrow  = {pool.task_escrow}")
        print(f"  \u8425\u961f\u6c60 camp_balance   = {pool.camp_balance or 0}")
        print(f"  \u50a8\u5907\u6c60 reserve       = {reserve}")
        print(f"  \u63d0\u73b0\u5f85\u5ba1 frozen       = {frozen}")
        print(f"  total_issued          = {pool.total_issued}")
        print("-" * 56)
        print(f"  A. \u5df2\u7ed3\u7b97\u63d0\u73b0\u603b\u989d settled_withdraw = {settled_withdraw}")
        print(f"     \u5f85\u5ba1\u63d0\u73b0\u603b\u989d   pending_withdraw = {pending_withdraw}")
        print(f"  B. \u65e7 diff\uff08\u542b reserve\uff09 = {old_diff}")
        print(f"     \u65b0 diff\uff08\u4e0d\u542b reserve\uff09 = {new_diff}")
        print(f"  C. reserve_covers_frozen = {reserve >= frozen}")
        print("-" * 56)
        if abs(old_diff) == settled_withdraw and abs(new_diff) <= 1:
            print("  \u2705 \u6839\u56e0\u5750\u5b9e\uff1a\u65e7 diff \u7edd\u5bf9\u503c == \u5df2\u7ed3\u7b97\u63d0\u73b0\u603b\u989d\uff0c\u65b0\u7b49\u5f0f diff \u2248 0")
            print("     reserve \u79fb\u51fa\u7b49\u5f0f\u540e\u5b58\u91cf\u6f02\u79fb\u6d88\u9664\uff1b\u5386\u53f2 diff \u62a5\u7817\u4ec1\u7b7e\u5b57\u540e\u4e00\u6b21\u6027\u6838\u9500\u3002")
        else:
            print("  \u2139 \u8bf7\u4eba\u5de5\u590d\u6838\uff1a\u65e7/\u65b0 diff \u4e0e settled_withdraw \u5173\u7cfb\u4e0d\u5b8c\u5168\u5300\u79f0\uff0c")
            print("     \u53ef\u80fd\u53e0\u52a0\u5176\u4ed6\u5386\u53f2\u6f02\u79fb\uff08\u975e\u5355\u4e00 reserve \u6765\u6e90\uff09\uff0c\u9700\u9010\u7b14\u8ffd\u8d26\u3002")
        print("=" * 56)


if __name__ == "__main__":
    asyncio.run(main())
