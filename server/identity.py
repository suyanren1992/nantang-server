"""W7-ID-1a · 事实驱动的身份层 —— 唯一身份权威模块。

皇帝原则：权限不挂在身份上，挂在事实记录上。身份只是事实的显示名。

本模块是唯一允许写 UserTag 的模块。其他 route 只准调这四个函数：
  - derive_tags(user, db)              从事实行推导标签集合
  - grant_tag(db, user_id, tag, source) 幂等发标签
  - revoke_by_source_prefix(db, ...)    按 source 前缀批量收回
  - derived_role(tags, base_role)       标签集合 → 派生 role（兼容层）

source 前缀约定（强制）：
  native                → 本地村民（永久，不可 revoke）
  tenancy:<tenancy_id>  → 住宿产生
  camp_job:<job_id>     → 工作岗产生
  camp_member:<camp_id> → 营员身份产生

收回时按 source 前缀批量收，绝不按 tag 收。
这是"互不牵连"的技术保证：
  退房只收 tenancy:*，营地归档只收 camp_job:* 和 camp_member:*。
"""
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models import UserTag, User


# 权级排序：admin > builder > adventurer > npc = local_partner > visitor
_ROLE_PRIORITY = {
    "admin": 100,
    "builder": 80,
    "adventurer": 60,
    "npc": 40,
    "local_partner": 40,   # 与 npc 同级
    "visitor": 0,
}


async def derive_tags(user: User, db: AsyncSession) -> set[str]:
    """从 UserTag 事实行推导标签集合。唯一权威，禁止其他地方自行判断身份。

    读 UserTag where user_id=user.id and status='active' → 返回 tag 集合。
    本地村民（User.native=True）永远包含 'npc'，即使 UserTag 行被意外删除。
    """
    tags: set[str] = set()
    if getattr(user, "native", False):
        tags.add("npc")
    r = await db.execute(
        select(UserTag.tag).where(
            UserTag.user_id == user.id,
            UserTag.status == "active",
        )
    )
    tags.update(r.scalars().all())
    return tags


async def grant_tag(db: AsyncSession, user_id: str, tag: str, source: str) -> None:
    """幂等发标签：(user_id, tag, source) 已存在 active 则 no-op。

    联合唯一约束 uq_user_tag_source 保底防重复。
    不 commit——由调用方在业务事务中统一 commit。
    """
    existing = (await db.execute(
        select(UserTag).where(
            UserTag.user_id == user_id,
            UserTag.tag == tag,
            UserTag.source == source,
            UserTag.status == "active",
        )
    )).scalar_one_or_none()
    if existing:
        return  # 幂等 no-op
    db.add(UserTag(
        user_id=user_id, tag=tag, source=source,
        granted_at=datetime.utcnow().isoformat(),
        status="active",
    ))


async def revoke_by_source_prefix(db: AsyncSession, user_id: str, prefix: str) -> int:
    """按 source 前缀批量收回标签，返回收回条数。

    source='native' 永不收回（本地村民是永久事实）。
    前缀匹配：source LIKE 'prefix%'（含冒号分隔，如 'tenancy:5' 匹配 'tenancy:50' 也匹配 'tenancy:5'）。
    调用方应传完整前缀（如 f'tenancy:{tenancy_id}'）。

    不 commit——由调用方在业务事务中统一 commit。
    """
    if prefix == "native":
        return 0  # 永不收回
    # 精确前缀匹配：source 以 prefix 开头
    r = await db.execute(
        select(UserTag).where(
            UserTag.user_id == user_id,
            UserTag.source.like(f"{prefix}%"),
            UserTag.status == "active",
        )
    )
    count = 0
    now = datetime.utcnow().isoformat()
    for tag_row in r.scalars():
        tag_row.status = "revoked"
        tag_row.revoked_at = now
        count += 1
    return count


def derived_role(tags: set[str], base_role: str) -> str:
    """标签集合 → 派生 role（兼容层）。

    取权级最高的标签映射为 role。admin 不被覆盖（平台运营是独立维度）。
    权级：admin > builder > adventurer > npc = local_partner > visitor

    兼容目的：全仓 30+ 处读 role 的旧代码不用改。
    """
    # admin 是平台运营，不参与标签派生
    if base_role == "admin":
        return "admin"
    best_role = "visitor"
    best_priority = _ROLE_PRIORITY.get(base_role, 0)
    for tag in tags:
        p = _ROLE_PRIORITY.get(tag, -1)
        if p > best_priority:
            best_priority = p
            best_role = tag
    return best_role


async def sync_user_role(db: AsyncSession, user: User) -> None:
    """标签变动后回写 user.role = derived_role(...)。

    不 commit——由调用方统一 commit。
    30+ 处旧引用（JWT、ROLE_CAPABILITIES、nt.js 等）零改动。
    """
    tags = await derive_tags(user, db)
    user.role = derived_role(tags, user.role)
