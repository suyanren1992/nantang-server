# -*- coding: utf-8 -*-
"""UI-FIX-P2-BE补 B6: 田间地块端点——列表/详情/收割/浇水/施肥。"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, FieldPlot, FIELD_STAGES, FIELD_HEALTH
from routes.auth import get_current_user

router = APIRouter(prefix="/api/fields", tags=["fields"])


# ══ GET / — 地块列表 ══
@router.get("")
async def list_plots(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拉所有地块。"""
    r = await db.execute(select(FieldPlot).order_by(FieldPlot.created_at))
    plots = [_plot_dict(p) for p in r.scalars()]
    return {"ok": True, "plots": plots, "total": len(plots)}


# ══ GET /{plot_id} — 地块详情 ══
@router.get("/{plot_id}")
async def get_plot(
    plot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拉单个地块详情。"""
    r = await db.execute(select(FieldPlot).where(FieldPlot.id == plot_id))
    plot = r.scalar_one_or_none()
    if not plot:
        raise HTTPException(status_code=404, detail="地块不存在")
    return {"ok": True, "plot": _plot_dict(plot)}


# ══ POST /{plot_id}/harvest — 收割 ══
@router.post("/{plot_id}/harvest")
async def harvest_plot(
    plot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """收割成熟作物 → 地块回到休耕。"""
    plot = await _get_plot_or_404(plot_id, db)
    if plot.stage != "成熟":
        raise HTTPException(status_code=400,
                            detail=f"只能收割成熟的地块（当前阶段: {plot.stage}）")
    plot.stage = "休耕"
    plot.crop_name = None
    plot.planted_at = None
    plot.harvest_at = None
    plot.health = "健康"
    plot.watered_at = None
    plot.fertilized_at = None
    plot.harvested_by = user.id
    await db.commit()
    return {"ok": True, "plot": _plot_dict(plot)}


# ══ POST /{plot_id}/water — 浇水 ══
@router.post("/{plot_id}/water")
async def water_plot(
    plot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """浇水：更新 watered_at + 缺水→健康。"""
    plot = await _get_plot_or_404(plot_id, db)
    if plot.stage == "休耕":
        raise HTTPException(status_code=400, detail="休耕地块不需要浇水")
    plot.watered_at = datetime.utcnow().isoformat()
    if plot.health == "缺水":
        plot.health = "健康"
    await db.commit()
    return {"ok": True, "plot": _plot_dict(plot)}


# ══ POST /{plot_id}/fertilize — 施肥 ══
@router.post("/{plot_id}/fertilize")
async def fertilize_plot(
    plot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """施肥：更新 fertilized_at + 缺肥→健康。"""
    plot = await _get_plot_or_404(plot_id, db)
    if plot.stage == "休耕":
        raise HTTPException(status_code=400, detail="休耕地块不需要施肥")
    plot.fertilized_at = datetime.utcnow().isoformat()
    if plot.health == "缺肥":
        plot.health = "健康"
    await db.commit()
    return {"ok": True, "plot": _plot_dict(plot)}


# ══ Helpers ══
async def _get_plot_or_404(plot_id: str, db: AsyncSession) -> FieldPlot:
    r = await db.execute(select(FieldPlot).where(FieldPlot.id == plot_id))
    plot = r.scalar_one_or_none()
    if not plot:
        raise HTTPException(status_code=404, detail="地块不存在")
    return plot


def _plot_dict(p: FieldPlot) -> dict:
    return {
        "id": p.id,
        "plot_name": p.plot_name,
        "crop_name": p.crop_name,
        "planted_at": p.planted_at,
        "harvest_at": p.harvest_at,
        "stage": p.stage,
        "health": p.health,
        "watered_at": p.watered_at,
        "fertilized_at": p.fertilized_at,
        "harvested_by": p.harvested_by,
        "planted_by": p.planted_by,
        "created_at": p.created_at,
    }
