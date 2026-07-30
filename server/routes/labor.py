"""劳动定价配置路由 — A-LABOR-BE ⑱⑲⑳。

labor_pricing 48 项入 map_locations.config.labor（后端真源，前端对齐读取）。
校核奖励 0.25 → 0.15（清单 C1，⑲）。
D-15 提案-校核-生效路径可修改价目。
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from routes.auth import get_current_user

logger = logging.getLogger("labor")
router = APIRouter(prefix="/api/labor", tags=["labor"])

# ══ A-LABOR-BE ⑲: 校核奖励比例 0.25 → 0.15 ══
VERIFIER_REWARD_PCT = 0.15

# ══ A-LABOR-BE ⑱: labor_pricing 48 项 ══
# 前端 app.js L66-78 同步（后端真源，前端对齐读取）
LABOR_PRICING = {
    # 🧹 整理打扫 (8)
    "sweep_mop": 10, "wipe_surface": 8, "take_trash": 5, "organize_items": 8,
    "clean_window": 10, "clean_toilet": 15, "clean_kitchen": 15, "clean_public": 12,
    # 🌾 田间种植 (10)
    "water": 3, "fertilize": 15, "weed": 15, "sow": 5, "harvest": 15,
    "turn_soil": 12, "trellis": 10, "pest_control": 8, "mulch": 8, "prune": 8,
    # 🍳 帮厨做饭 (7)
    "chef": 20, "sous_chef": 12, "wash_dishes": 10, "prep_food": 8,
    "clean_stove": 12, "grocery": 5, "serve_meal": 5,
    # 🔧 维修搬运 (6)
    "repair": 15, "move_goods": 12, "organize_warehouse": 10,
    "waste_sort": 8, "compost": 5, "change_light": 8,
    # 🏠 接待活动 (6)
    "reception": 8, "tour_guide": 10, "event_setup": 12,
    "event_cleanup": 10, "animal_care": 8, "notice_board": 5,
    # 🎨 文艺创作 (5)
    "painting": 15, "calligraphy": 10, "craft": 12, "photo_video": 8, "writing": 8,
    # 🌿 户外园艺 (2)
    "mow_lawn": 12, "weed_pick": 8,
    # 🏨 新项 A-LABOR-BE ⑱ (3)
    "room_prep": 10, "room_inspect": 8, "newcomer_reception": 12,
    # 💗 照护劳动 A-LABOR-BE ⑱ 御批 #6 (3)
    "care_elderly": 15, "care_sick": 15, "mentor_newbie": 12,
}

# 劳动类别映射（供 XP 分桶使用）
LABOR_CATEGORIES = {
    "sweep_mop": "卫生", "wipe_surface": "卫生", "take_trash": "卫生",
    "organize_items": "卫生", "clean_window": "卫生", "clean_toilet": "卫生",
    "clean_kitchen": "卫生", "clean_public": "卫生",
    "water": "田间", "fertilize": "田间", "weed": "田间", "sow": "田间",
    "harvest": "田间", "turn_soil": "田间", "trellis": "田间",
    "pest_control": "田间", "mulch": "田间", "prune": "田间",
    "chef": "厨房", "sous_chef": "厨房", "wash_dishes": "厨房",
    "prep_food": "厨房", "clean_stove": "厨房", "grocery": "厨房", "serve_meal": "厨房",
    "repair": "维修", "move_goods": "维修", "organize_warehouse": "维修",
    "waste_sort": "维修", "compost": "维修", "change_light": "维修",
    "reception": "接待", "tour_guide": "接待", "event_setup": "接待",
    "event_cleanup": "接待", "animal_care": "接待", "notice_board": "接待",
    "painting": "文艺", "calligraphy": "文艺", "craft": "文艺",
    "photo_video": "文艺", "writing": "文艺",
    "mow_lawn": "园艺", "weed_pick": "园艺",
    "room_prep": "住宿", "room_inspect": "住宿", "newcomer_reception": "接待",
    "care_elderly": "照护", "care_sick": "照护", "mentor_newbie": "照护",
}

# ══ A-LABOR-BE ⑰: BED_RATES 入 config ══
BED_RATES_CONFIG = {
    "dorm101": 20, "dorm102": 30, "dorm103": 30,
    "dorm104": 60, "dorm105": 30, "dorm106": 35,
}


@router.get("/config")
async def get_labor_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GET /api/labor/config — 拉取劳动定价 + 住宿费率 + 校核奖励配置。

    数据源: 后端真源（本文件），前端对齐读取。
    D-15 提案-校核-生效路径可修改价目。
    """
    return {
        "ok": True,
        "labor_pricing": LABOR_PRICING,
        "labor_categories": LABOR_CATEGORIES,
        "accommodation": BED_RATES_CONFIG,
        "verifier_reward_pct": VERIFIER_REWARD_PCT,
        "item_count": len(LABOR_PRICING),
    }
