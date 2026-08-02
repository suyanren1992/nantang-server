"""统一权限闸门 —— 唯一权限判定入口。

设计稿 C-B §2.3：避免每处手写、防漏。
admin 全通是硬规则（皇帝明令「管理员不管哪种身份都有权限」）。
每个函数第一行必须是 admin 检查。
"""
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from models import User, Camp, CampMembership, CampJob, Tenancy


def is_admin(user: User) -> bool:
    """admin 判定辅助——避免 routes 中手写 role == 'admin'。"""
    return user.role == "admin"


async def visible_camp_filter(user: User, query, db: AsyncSession):
    """admin 全通；否则只见 公开营地 ∪ 自己有 membership/job 的营地。

    公开营地 = status != 'archived'。
    即使用户的 membership/job 所在营地已归档，仍可见。
    """
    if user.role == "admin":
        return query
    return query.where(
        or_(
            Camp.status != "archived",
            Camp.id.in_(
                select(CampMembership.camp_id).where(
                    CampMembership.user_id == user.id,
                    CampMembership.status == "active",
                )
            ),
            Camp.id.in_(
                select(CampJob.camp_id).where(
                    CampJob.user_id == user.id,
                    CampJob.status == "active",
                )
            ),
        )
    )


async def can_manage_camp(user: User, camp_id: str, db: AsyncSession) -> bool:
    """admin | camp.created_by | CampJob active | camp_role=='manager'"""
    if user.role == "admin":
        return True

    camp = (await db.execute(select(Camp).where(Camp.id == camp_id))).scalar_one_or_none()
    if not camp:
        return False
    if camp.created_by == user.id:
        return True

    # CampJob active
    job = (await db.execute(
        select(CampJob.id).where(
            CampJob.camp_id == camp_id,
            CampJob.user_id == user.id,
            CampJob.status == "active",
        )
    )).scalar_one_or_none()
    if job:
        return True

    # camp_role == 'manager'
    membership = (await db.execute(
        select(CampMembership.id).where(
            CampMembership.camp_id == camp_id,
            CampMembership.user_id == user.id,
            CampMembership.status == "active",
            CampMembership.camp_role == "manager",
        )
    )).scalar_one_or_none()
    if membership:
        return True

    return False


async def can_access_coop_resource(user: User, db: AsyncSession) -> bool:
    """admin | 有 active coop tenancy。物资/劳动类权限唯一判据。"""
    if user.role == "admin":
        return True

    tenancy = (await db.execute(
        select(Tenancy.id).where(
            Tenancy.user_id == user.id,
            Tenancy.track == "coop",
            Tenancy.status == "active",
        )
    )).scalar_one_or_none()
    return tenancy is not None


async def require_coop_resource(user: User, db: AsyncSession):
    """快捷闸门：非 admin 且无 coop 资源权限 → 直接 403。

    用于 kitchen / storage / clean_weekly 等物资劳动端点开头。
    注意：from fastapi import HTTPException 放在函数内避免循环导入。
    """
    if user.role == "admin":
        return
    if not await can_access_coop_resource(user, db):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="你不是合作社住客，无法操作共享物资",
        )


async def capabilities(user: User, db: AsyncSession) -> dict:
    """给前端的能力清单 —— B-3 端点数据源。

    deny_reason 由后端统一给，前端不自己编话术。
    """
    from identity import derive_tags

    tags = sorted(await derive_tags(user, db))
    can_coop = await can_access_coop_resource(user, db)

    # camp_manage: 列出所有可管理的营地 ID
    camp_manage = []
    if user.role == "admin":
        result = await db.execute(select(Camp.id))
        camp_manage = sorted(row[0] for row in result)
    else:
        # 创建的营地
        created = await db.execute(select(Camp.id).where(Camp.created_by == user.id))
        camp_manage.extend(row[0] for row in created)
        # CampJob 的营地
        jobs = await db.execute(
            select(CampJob.camp_id).where(
                CampJob.user_id == user.id,
                CampJob.status == "active",
            )
        )
        for row in jobs:
            if row[0] not in camp_manage:
                camp_manage.append(row[0])
        # manager 角色的 membership
        mgr = await db.execute(
            select(CampMembership.camp_id).where(
                CampMembership.user_id == user.id,
                CampMembership.status == "active",
                CampMembership.camp_role == "manager",
            )
        )
        for row in mgr:
            if row[0] not in camp_manage:
                camp_manage.append(row[0])
        camp_manage.sort()

    return {
        "role": user.role,
        "tags": tags,
        "native": getattr(user, "native", False),
        "can": {
            "coop_resource": can_coop,
            "clean_weekly_claim": can_coop,
            "field_manage": can_coop,
            "camp_manage": camp_manage,
            "platform_admin": user.role == "admin",
        },
        "deny_reason": {
            "coop_resource": None if can_coop else "你不是合作社住客，无法使用共享物资",
            "camp_manage": "你不是该营地工作人员",
        },
    }
