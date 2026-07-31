"""SQLAlchemy models for Nantang Cloud Village."""
import json
import math
from sqlalchemy import Column, String, Integer, Text, ForeignKey, Float, Boolean, UniqueConstraint, Date
from database import Base

# ══ A-LABOR-BE: CV/XP 公式常量 ══
XP_DECAY = [10, 5, 3, 1, 1, 1, 1]  # 同类当周递减系数


def compute_cv(nt_amount: int) -> int:
    """CV = floor(nt/2)，nt = 基础价（不含等级加成）。御批 v0.3.1 §五#5。"""
    return math.floor(nt_amount / 2)


def compute_xp(nt_amount: int, category: str, week_counts: dict) -> tuple:
    """XP 按类分桶 + 同类当周递减 [10,5,3,1,1,1,1]。
    返回 (xp_delta, updated_week_counts)。
    nt_amount: 基础价; category: 劳动类别; week_counts: 本周各类次数 dict。
    """
    count = week_counts.get(category, 0)
    idx = min(count, len(XP_DECAY) - 1)
    multiplier = XP_DECAY[idx]
    # XP = floor(nt * multiplier / 10)
    xp = math.floor(nt_amount * multiplier / 10)
    new_counts = dict(week_counts)
    new_counts[category] = count + 1
    return xp, new_counts

# D1: 任务状态统一词汇表
TASK_STATUSES = {
    "open": "进行中",
    "submitted": "待审核",
    "pending_submit": "待提交",
    "rejected": "退回修改",
    "verified": "待结算",
    "settled": "已结算",
    "cancelled": "已取消",
    "disputed": "已争议",
    "draft": "草稿",
    "retract_requested": "撤回申请中",
}
TASK_STATUS_LIST = list(TASK_STATUSES.values())
TASK_STATUS_DEFAULT = TASK_STATUSES["open"]


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="visitor")
    nt_balance = Column(Integer, default=0)
    contribution_value = Column(Integer, default=0)
    experience_value = Column(Integer, default=0)
    trust_score = Column(Integer, default=100)
    trust_level = Column(String, default="可信")
    frozen_cv = Column(Integer, default=0)
    wallet_address = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    location = Column(String, nullable=True)
    avatar_seed = Column(String, nullable=True)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)
    token_version = Column(Integer, default=0)
    # ══ A-LABOR-BE ①④: 治理权 + XP 分桶 ══
    first_checkin_date = Column(Date, nullable=True)       # ① 入住 SET、退房不清、全退 NULL
    xp_by_category = Column(Text, nullable=True)           # ④ JSON {labor: xp, 厨房: xp, 田间: xp, ...}
    # ══ CLEAN-WEEKLY-BE ③: 连续周参与数 ══
    clean_weekly_streak = Column(Integer, default=0)


class NTLedger(Base):
    __tablename__ = "nt_ledger"
    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(String, unique=True, nullable=False)
    task_id = Column(String, nullable=True)
    from_user = Column(String, nullable=True)
    to_user = Column(String, nullable=True)
    amount = Column(Integer, nullable=False)
    type = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    status = Column(String, default="settled")
    created_at = Column(String, nullable=False)
    settled_at = Column(String, nullable=True)
    batch_id = Column(String, nullable=True)
    tx_hash = Column(String, nullable=True)


class NTTask(Base):
    __tablename__ = "nt_tasks"
    id = Column(String, primary_key=True)
    poster = Column(String, nullable=False)
    assignee = Column(String, nullable=True)
    assignees = Column(Text, nullable=True)  # JSON 数组，多 assignee。ponytail: 过渡期与 assignee 列共存
    title = Column(String, nullable=False)
    reward = Column(Integer, default=0)
    status = Column(String, default=TASK_STATUS_DEFAULT)
    category = Column(String, default="other")
    scope = Column(String, default="社区")
    note = Column(Text, nullable=True)
    slots = Column(Integer, default=1)
    deadline = Column(String, nullable=True)
    reviewer = Column(String, nullable=True)
    evidence = Column(Text, nullable=True)
    location_id = Column(String, nullable=True)
    escrow_amount = Column(Integer, default=0)
    is_system_generated = Column(Boolean, default=False)    # 系统自动生成=周期/赏金
    idempotency_key = Column(String(128), unique=True, nullable=True)  # cron 幂等
    camp_ref_id = Column(String, nullable=True)  # T7: CampTask 合并，关联营地 ID
    created_at = Column(String, nullable=True)
    accepted_at = Column(String, nullable=True)
    completed_at = Column(String, nullable=True)
    verified_at = Column(String, nullable=True)
    settled_at = Column(String, nullable=True)
    verifier_id = Column(String, nullable=True)
    settler_id = Column(String, nullable=True)
    reject_reason = Column(String, nullable=True)
    reject_count = Column(Integer, default=0)
    tx_hash = Column(String, nullable=True)
    batch_id = Column(String, nullable=True)


class CommunityPool(Base):
    __tablename__ = "community_pool"
    id = Column(Integer, primary_key=True, autoincrement=True)
    singleton = Column(Boolean, default=True, unique=True)  # 防多行
    balance = Column(Integer, default=0)
    total_issued = Column(Integer, default=0)
    task_escrow = Column(Integer, default=0)
    contribution_pool = Column(Integer, default=0)
    camp_balance = Column(Integer, default=0)
    reserve = Column(Integer, default=0)   # 储备池：链上充值+盈余划拨
    frozen = Column(Integer, default=0)    # 冻结池：提现锁定+争议暂扣
    last_tick_date = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


# ══ Phase 2: Camps ══
# ponytail: CampTask 已合并到 NTTask(scope='camp', camp_ref_id=...), 2026-07-22 T7
class Camp(Base):
    __tablename__ = "camps"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    season = Column(String, nullable=True)
    type = Column(String, nullable=True)
    theme = Column(String, nullable=True)
    desc = Column(Text, nullable=True)
    emoji = Column(String, default="🏕️")
    status = Column(String, default="active")   # active|upcoming|archived
    date = Column(String, nullable=True)
    people = Column(Integer, default=0)
    max = Column(Integer, default=16)
    location = Column(String, default="南塘合作社大院")
    highlights = Column(Text, nullable=True)     # JSON array
    created_by = Column(String, nullable=True)
    launched_at = Column(String, nullable=True)
    closed_at = Column(String, nullable=True)
    budget = Column(Text, nullable=True)          # JSON: {adventurers, builders, lodgingNT, mealNT, ...}
    schedule = Column(Text, nullable=True)        # JSON
    milestones = Column(Text, nullable=True)      # JSON
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


class CampBuilder(Base):
    __tablename__ = "camp_builders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    camp_id = Column(String, ForeignKey("camps.id"), nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=True)
    task_names = Column(Text, nullable=True)       # JSON array
    total_nt = Column(Integer, default=0)
    confirmed = Column(Integer, default=0)


# C-B-1: 营地级成员关系（照 C-B 设计稿 §2.2）——立机制。camp_role='manager' 承载
# 宿舍/营地管理员（≠平台 admin=User.role）。本期只建表，缩权待 C-B-2 回填数据后另卡开启。
class CampMembership(Base):
    __tablename__ = "camp_memberships"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    camp_id = Column(String, ForeignKey("camps.id"), nullable=False)
    camp_role = Column(String, default="member")   # member | manager
    status = Column(String, default="active")      # active | left | pending
    joined_at = Column(String, nullable=True)
    __table_args__ = (UniqueConstraint("user_id", "camp_id", name="uq_camp_member"),)


# ponytail: CampTask 表已废弃，改用 NTTask(scope='camp', camp_ref_id=camp_id)。模型类保留注释避免 import 断裂。


# ══ Phase 3: Data Layer ══
class Journal(Base):
    __tablename__ = "journal"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user = Column(String, nullable=False)
    type = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    time = Column(String, nullable=False)
    space_id = Column(String, nullable=True)
    discovery_id = Column(String, nullable=True)


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    time = Column(String, nullable=False)
    type = Column(String, nullable=False)
    text = Column(Text, nullable=True)


class CardDiscovery(Base):
    __tablename__ = "card_discoveries"
    id = Column(String, primary_key=True)
    space_id = Column(String, nullable=True)
    description = Column(String, nullable=True)
    guesser = Column(String, nullable=True)
    guessed_person = Column(String, nullable=True)
    guessed_at = Column(String, nullable=True)
    status = Column(String, default="pending")
    nt_guesser = Column(Integer, default=5)
    nt_doer = Column(Integer, default=10)
    doer_confirmed_at = Column(String, nullable=True)
    doer_denied_at = Column(String, nullable=True)
    expired_at = Column(String, nullable=True)
    doer_name_snapshot = Column(String(64), nullable=True)  # doer 名字快照（防用户注销后丢失）
    created_at = Column(String, nullable=True)


class Verification(Base):
    __tablename__ = "verifications"
    id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    doer = Column(String, nullable=False)
    action = Column(String, nullable=True)
    detail = Column(Text, nullable=True)          # JSON
    nt_amount = Column(Integer, default=0)
    verifier_reward = Column(Integer, default=1)
    status = Column(String, default="pending")
    verifier = Column(String, nullable=True)
    verified_at = Column(String, nullable=True)
    rejected_by = Column(String, nullable=True)
    rejected_at = Column(String, nullable=True)
    reject_reason = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(String, nullable=True)


class NewbieQuest(Base):
    __tablename__ = "newbie_quests"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user = Column(String, nullable=False)
    quest_id = Column(String, nullable=False)
    name = Column(String, nullable=True)
    desc = Column(Text, nullable=True)
    nt = Column(Integer, default=0)
    done = Column(Integer, default=0)
    done_at = Column(String, nullable=True)


class CanteenMenu(Base):
    __tablename__ = "canteen_menu"
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, nullable=False)
    lunch = Column(Text, nullable=True)            # JSON array
    dinner = Column(Text, nullable=True)           # JSON array


class MealOrder(Base):
    __tablename__ = "meal_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user = Column(String, nullable=False)
    date = Column(String, nullable=False)
    meal = Column(String, nullable=False)
    status = Column(String, default="ordered")
    ordered_at = Column(String, nullable=True)
    cancelled_at = Column(String, nullable=True)


class MapLocation(Base):
    __tablename__ = "map_locations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, unique=True, nullable=False)   # "shared" for the main map data
    data = Column(Text, nullable=True)                   # Full JSON blob


class Announcement(Base):
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String, nullable=True)
    doer = Column(String, nullable=True)
    verifier = Column(String, nullable=True)
    action = Column(String, nullable=True)
    nt_amount = Column(Integer, default=0)
    created_at = Column(String, nullable=True)


class InventoryItem(Base):
    __tablename__ = "inventory"
    id = Column(String, primary_key=True)
    user = Column(String, nullable=False)
    name = Column(String, nullable=True)
    cat = Column(String, nullable=True)
    status = Column(String, default="storage")
    price = Column(Integer, default=0)
    location = Column(String, nullable=True)
    desc = Column(Text, nullable=True)
    date = Column(String, nullable=True)


# ══ 充值意向（链上自动化充值）══
class DepositIntent(Base):
    __tablename__ = "deposit_intents"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    from_address = Column(String, nullable=False)
    to_address = Column(String, nullable=False)
    tx_hash = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending|detected|confirmed|expired
    created_at = Column(String, nullable=False)
    detected_at = Column(String, nullable=True)


# ══ Phase C2.5: 身份与入住 ══
class Tenancy(Base):
    __tablename__ = "tenancies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    room_id = Column(String, nullable=False)       # 引用 map_locations 中的 roomId
    bed_num = Column(Integer, default=1)
    checkin_date = Column(String, nullable=False)
    check_out_date = Column(String, nullable=True)  # C-B-4: inn 轨预订退房日（coop 轨留空；区间重叠占用判定用）
    track = Column(String, default="coop")          # C-B-4: coop 合作社实景 | inn 素社民宿；default coop 向后兼容零迁移
    room_type = Column(String, nullable=True)       # C-B-4: single | quad（inn 轨房型快照；coop 留空）
    last_deducted = Column(String, nullable=True)  # 上次扣费/记账日期（幂等）
    debt = Column(Integer, default=0)              # 未结欠费（退房结算后未清部分留存，可追缴）
    accommodation_due = Column(Integer, default=0) # G-3: 住宿费应计记账累计（退房一次性结算，不动 nt_balance）
    status = Column(String, default="active")      # active / checked_out
    # ══ A-LABOR-BE ②: 活跃度治理 ══
    last_active_at = Column(String, nullable=True)  # 最后活跃时间，30 天未活跃=治理权失效


# C-B-4: 素社民宿房型配置（照 C-B 设计稿 §4 / §6 PC inn_rooms 参考重写，非搬运）
# 素社规格：单人间×4（梅/兰/竹/菊 beds=1）+ 四人间×2（A/B beds=4）。rate 为展示/配置字段，
# 实际 G-3 应计结算沿既有 BED_RATES 路径（不新造钱路）。
class InnRoom(Base):
    __tablename__ = "inn_rooms"
    id = Column(String, primary_key=True)          # mei/lan/zhu/ju/quadA/quadB
    label = Column(String, nullable=False)         # 梅/兰/竹/菊/四人间A/四人间B
    room_type = Column(String, nullable=False)     # single | quad
    beds = Column(Integer, default=1)              # single=1 | quad=4
    rate = Column(Integer, default=0)              # 每晚 NT（展示/配置，不直连钱路）
    dietary = Column(String, default="vegetarian")  # 素食标签
    status = Column(String, default="active")      # active | closed


# G-1: 公约签署凭证
class CovenantSignature(Base):
    __tablename__ = "covenant_signatures"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False)
    covenant_version = Column(String, nullable=False)  # 对应 covenant_text config 的 version
    sign_type = Column(String, default="新入住")       # 新入住 / 老成员补签 / 续签
    reward_granted = Column(Boolean, default=False)    # 是否发过 10 NT（每人只发一次首签）
    signed_at = Column(String, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "covenant_version", name="uq_covenant_user_version"),)


# ══ A-LABOR-BE ⑦: 营地独立账本 ══
class CampLedger(Base):
    """营地多账本——每营独立行（camp_id, balance, escrow, status, multisig_address）。
    替代 CommunityPool.camp_balance 单字段，支持多营地独立核算。"""
    __tablename__ = "camp_ledgers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    camp_id = Column(String, ForeignKey("camps.id"), nullable=False)
    balance = Column(Integer, default=0)
    escrow = Column(Integer, default=0)
    status = Column(String, default="active")           # active | archived
    multisig_address = Column(String, nullable=True)    # 营地多签钱包地址
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)
    __table_args__ = (UniqueConstraint("camp_id", name="uq_camp_ledger"),)


# ══ CLEAN-WEEKLY-BE: 大扫除周任务 ══
CLEAN_WEEKLY_STATUSES = ("open", "claimed", "completed")


class CleanWeeklyTask(Base):
    """周打扫任务实例——管理员发放 → 用户认领 → 校核完成。"""
    __tablename__ = "clean_weekly_tasks"
    id = Column(String, primary_key=True)
    week_start_date = Column(String, nullable=False)       # YYYY-MM-DD（周一）
    space_id = Column(String, nullable=False)              # 建筑物空间 ID
    space_name = Column(String, nullable=True)             # 空间显示名
    reward_nt = Column(Integer, default=15)                # NT 奖励（默认 yellow 档）
    status = Column(String, default="open")                # open | claimed | completed
    claimed_by = Column(String, ForeignKey("users.id"), nullable=True)
    claimed_at = Column(String, nullable=True)
    verification_id = Column(String, nullable=True)        # 关联校核记录
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(String, nullable=True)


class CleanWeeklyDistribution(Base):
    """周打扫发放批次——每周一管理员选空间批量建任务。"""
    __tablename__ = "clean_weekly_distributions"
    id = Column(String, primary_key=True)
    week_start_date = Column(String, nullable=False)       # YYYY-MM-DD（周一）
    distribute_at = Column(String, nullable=True)          # 计划发放时间
    space_ids = Column(Text, nullable=True)                # JSON list of space IDs
    mode = Column(String, default="even")                  # even | by_count
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(String, nullable=True)


# ══ UI-FIX-P2-BE B1: 储物管理 ══
STORAGE_CATEGORIES = ("食物", "工具", "杂物")
STORAGE_LOCATIONS = ("冰箱", "储物间", "共享")


class StorageItem(Base):
    """村民储物记录——冰箱/储物间/共享三档分类。"""
    __tablename__ = "storage_items"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    item_name = Column(String(100), nullable=False)
    category = Column(String, nullable=False)          # 食物 / 工具 / 杂物
    quantity = Column(Integer, default=1)
    storage_location = Column(String, nullable=False)  # 冰箱 / 储物间 / 共享
    added_at = Column(String, nullable=True)           # ISO datetime
    expires_at = Column(String, nullable=True)         # ISO datetime, nullable=不过期
