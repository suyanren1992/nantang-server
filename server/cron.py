"""Cron runner — 每日 00:05 触发。ponytail: 单进程 asyncio sleep loop，无 APScheduler 依赖。

Round 6 会扩展 _do_daily_tick() 为完整的周期任务生成逻辑（读 periodic_tasks.json → 创建系统任务）。
"""
import asyncio
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("cron")


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
            await _do_daily_tick()
        except Exception as e:
            logger.error(f"cron tick failed: {e}")


async def _do_daily_tick():
    """每日逻辑——Round 6 会扩展为任务生成。此刻仅打日志占位。"""
    logger.info("cron: daily tick executed")
    # TODO Round 6: 读 periodic_tasks.json → 生成系统任务
