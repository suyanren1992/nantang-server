"""SQLAlchemy models for Nantang Cloud Village."""
from sqlalchemy import Column, String, Integer, Text, ForeignKey, Float, Boolean
from database import Base

# D1: 任务状态统一词汇表
TASK_STATUSES = {
    "open": "进行中",
    "submitted": "待审核",
    "rejected": "退回修改",
    "verified": "待结算",
    "settled": "已结算",
    "cancelled": "已取消",
    "disputed": "已争议",
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
    balance = Column(Integer, default=0)
    total_issued = Column(Integer, default=0)
    task_escrow = Column(Integer, default=0)
    contribution_pool = Column(Integer, default=0)
    camp_balance = Column(Integer, default=0)
    last_tick_date = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)


# ══ Phase 2: Camps ══
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


class CampTask(Base):
    __tablename__ = "camp_tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    camp_id = Column(String, ForeignKey("camps.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=True)
    nt = Column(Integer, default=0)
    status = Column(String, default="draft")
    category = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    poster = Column(String, nullable=True)
    deadline = Column(String, nullable=True)
    reviewer = Column(String, nullable=True)
    slots = Column(Integer, default=1)
    claimants = Column(Text, nullable=True)         # JSON
    created_at = Column(String, nullable=True)


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
    last_deducted = Column(String, nullable=True)  # 上次扣费日期（幂等）
    debt = Column(Integer, default=0)
    status = Column(String, default="active")      # active / checked_out
