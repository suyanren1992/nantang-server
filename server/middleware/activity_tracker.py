"""DB-P0-1: Activity tracker — 轻量活跃追踪中间件 + 依赖。

get_current_user() 已在 JWT 解码后自动更新 user.last_active_at（同日跳过）。
本模块提供：
  1. ActivityTrackerMiddleware: 全局中间件骨架（日志观测用）
  2. activity_tracker 依赖: 可作为显式 Depends 注册到需要活跃追踪的端点

写库策略：同日跳过（date.today() 比对），每用户每日仅一次写入。
"""
import logging
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from routes.auth import get_current_user

logger = logging.getLogger("activity_tracker")


class ActivityTrackerMiddleware:
    """轻量活跃追踪中间件骨架。

    实际的 last_active_at 更新由 get_current_user() 完成（同日跳过）。
    本中间件仅做 ASGI passthrough，不增加每请求写库开销。
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        await self.app(scope, receive, send)


async def activity_tracker(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """显式活跃追踪依赖。

    用法：在需要显式标记活跃追踪的端点中加入 Depends(activity_tracker)。
    get_current_user 已在 JWT 解码后更新 last_active_at，
    此依赖返回已更新的 user 对象，确保端点能读到最新活跃日期。
    """
    return user
