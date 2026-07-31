# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE补 B7: 用户设置端点——GET / PATCH settings。"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from database import get_db
from models import User
from routes.auth import get_current_user

router = APIRouter(prefix="/api/users/me", tags=["user_settings"])

# ══ 默认设置 ══
_DEFAULT_SETTINGS = {
    "notification": True,
    "theme": "light",
    "language": "zh-CN",
}
VALID_THEMES = ("light", "dark")
VALID_LANGUAGES = ("zh-CN", "en")


class PatchSettingsReq(BaseModel):
    notification: bool | None = None
    theme: str | None = None
    language: str | None = None


# ══ GET /settings ══
@router.get("/settings")
async def get_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """读当前用户设置（无记录则返回默认值）。"""
    settings = _parse_settings(user.user_settings)
    return {"ok": True, "settings": settings}


# ══ PATCH /settings ══
@router.patch("/settings")
async def patch_settings(
    req: PatchSettingsReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """局部更新用户设置（只改传入的字段）。"""
    current = _parse_settings(user.user_settings)

    if req.notification is not None:
        current["notification"] = req.notification
    if req.theme is not None:
        if req.theme not in VALID_THEMES:
            raise HTTPException(status_code=400,
                                detail=f"theme 必须在 {VALID_THEMES} 内")
        current["theme"] = req.theme
    if req.language is not None:
        if req.language not in VALID_LANGUAGES:
            raise HTTPException(status_code=400,
                                detail=f"language 必须在 {VALID_LANGUAGES} 内")
        current["language"] = req.language

    user.user_settings = json.dumps(current, ensure_ascii=False)
    await db.commit()
    return {"ok": True, "settings": current}


# ══ Helper ══
def _parse_settings(raw: str | None) -> dict:
    if not raw:
        return dict(_DEFAULT_SETTINGS)
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return dict(_DEFAULT_SETTINGS)
    # 补全缺失字段
    for k, v in _DEFAULT_SETTINGS.items():
        if k not in data:
            data[k] = v
    return data
