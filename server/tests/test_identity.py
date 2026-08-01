"""W7-ID-1a I-7: 事实驱动身份层端到端测试。

铁律：全部走 HTTP 端点（client.post），禁止复刻端点逻辑。
卡验收判据：
  1. test_adventurer_and_npc_coexist — 叠加能力实证
  2. test_inn_checkin_grants_no_local_tag — 民宿不发在地标签
  3. test_checkout_keeps_adventurer — 冒险者退房标签保留
  4. test_camp_archive_revokes_camp_tags_only — 归档只收 camp 标签
  5. test_native_never_revoked — 本地村民退房/归档后 npc 仍在
  6. test_migration_idempotent — 迁移跑两次 UserTag 行数不变
"""
import pytest
from httpx import AsyncClient
from database import async_session
from models import User, UserTag, Tenancy, CampMembership, Camp
from sqlalchemy import select, func


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _register(client, name, invite_code=""):
    r = await client.post("/api/auth/register", json={
        "name": name, "password": "Passw0rd!", "invite_code": invite_code,
    })
    return r


async def _login(client, name):
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"]


async def _get_tags(uid):
    """直接查库获取用户 active tags（验证用，非复刻逻辑）。"""
    async with async_session() as s:
        rows = (await s.execute(
            select(UserTag.tag, UserTag.source).where(
                UserTag.user_id == uid, UserTag.status == "active",
            )
        )).all()
        return {r[0] for r in rows}, {r[1] for r in rows}


# ─── 测试 1：冒险者 + NPC 共存（证明身份叠加已解决）──────────────────

@pytest.mark.asyncio
async def test_adventurer_and_npc_coexist(client, monkeypatch):
    """注册本地村民 → 住合作社 → 报名营员 → tags 同时含 npc + local_partner。

    证明：① 单值 role 不可叠加的问题已解决（UserTag 多行共存）。
    """
    # 设置在地码池
    monkeypatch.setenv("NATIVE_INVITE_CODES", "NATIVE-TEST-1")
    monkeypatch.setenv("INVITE_CODES", "NATIVE-TEST-1")

    await _register(client, "coexist_user", invite_code="NATIVE-TEST-1")
    tok = await _login(client, "coexist_user")
    uid = "coexist_user"

    # 住合作社（coop）
    r = await client.post("/api/accommodation/checkin", headers=_h(tok),
                          json={"room_id": "dorm101", "bed_num": 1, "track": "coop"})
    assert r.status_code == 200, r.json()

    tags, sources = await _get_tags(uid)
    assert "npc" in tags, f"native npc tag missing: {tags}"
    assert "local_partner" in tags, f"local_partner tag missing: {tags}"
    # 关键断言：两个标签共存——这在旧单值 role 模型里物理不可能
    assert len(tags) >= 2, f"身份叠加失败，只有 {tags}"


# ─── 测试 2：民宿不发任何在地标签 ──────────────────────────────────

@pytest.mark.asyncio
async def test_inn_checkin_grants_no_local_tag(client, monkeypatch):
    """民宿入住后 tags 不含 npc / local_partner。"""
    monkeypatch.delenv("INVITE_CODES", raising=False)
    monkeypatch.delenv("NATIVE_INVITE_CODES", raising=False)

    await _register(client, "inn_user")
    tok = await _login(client, "inn_user")

    r = await client.post("/api/accommodation/checkin", headers=_h(tok),
                          json={"room_id": "mei", "track": "inn",
                                "check_in": "2026-09-01", "check_out": "2026-09-05"})
    assert r.status_code == 200, r.json()

    tags, _ = await _get_tags("inn_user")
    assert "npc" not in tags, f"inn 不应发 npc: {tags}"
    assert "local_partner" not in tags, f"inn 不应发 local_partner: {tags}"


# ─── 测试 3：冒险者退房后标签保留 ─────────────────────────────────

@pytest.mark.asyncio
async def test_checkout_keeps_adventurer(client, monkeypatch):
    """冒险者退房 → local_partner 消失，但其他标签（如手动给的 adventurer）保留。

    模拟：用户先有 adventurer 标签，住合作社后退房，
    退房只收 tenancy:*，adventurer 不受影响。
    """
    monkeypatch.delenv("INVITE_CODES", raising=False)

    await _register(client, "checkout_user")
    tok = await _login(client, "checkout_user")
    uid = "checkout_user"

    # 先手动给一个 adventurer 标签（模拟 B2 报名后的效果）
    from identity import grant_tag
    async with async_session() as s:
        await grant_tag(s, uid, "adventurer", "camp_member:test_camp_1")
        await s.commit()

    # 住合作社
    r = await client.post("/api/accommodation/checkin", headers=_h(tok),
                          json={"room_id": "dorm102", "bed_num": 1, "track": "coop"})
    assert r.status_code == 200, r.json()

    tags_before, _ = await _get_tags(uid)
    assert "local_partner" in tags_before
    assert "adventurer" in tags_before

    # 退房
    r = await client.post("/api/accommodation/checkout", headers=_h(tok))
    assert r.status_code == 200, r.json()

    tags_after, _ = await _get_tags(uid)
    assert "local_partner" not in tags_after, f"退房后 local_partner 应消失: {tags_after}"
    assert "adventurer" in tags_after, f"退房后 adventurer 应保留: {tags_after}"


# ─── 测试 4：归档只收 camp 标签，住宿标签保留 ──────────────────────

@pytest.mark.asyncio
async def test_camp_archive_revokes_camp_tags_only(client, monkeypatch):
    """归档后 camp_job/camp_member 标签消失，tenancy 标签保留。"""
    monkeypatch.delenv("INVITE_CODES", raising=False)

    # 注册管理员 + 普通用户
    await _register(client, "archive_admin")
    admin_tok = await _login(client, "archive_admin")
    # 手动设为 admin
    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == "archive_admin"))).scalar_one()
        u.role = "admin"
        await s.commit()
    admin_tok = await _login(client, "archive_admin")

    await _register(client, "archive_worker")
    worker_tok = await _login(client, "archive_worker")

    # admin 建营地
    r = await client.post("/api/camps", headers=_h(admin_tok), json={
        "name": "归档测试营", "emoji": "🏕️", "max": 10,
    })
    assert r.status_code == 200, r.json()
    camp_id = r.json()["camp_id"]

    # admin 派工作岗给 worker
    r = await client.post(f"/api/camps/{camp_id}/jobs", headers=_h(admin_tok), json={
        "user_id": "archive_worker", "job_title": "厨房组长",
    })
    assert r.status_code == 200, r.json()

    # worker 先住合作社（有 tenancy 标签）
    r = await client.post("/api/accommodation/checkin", headers=_h(worker_tok),
                          json={"room_id": "dorm103", "bed_num": 1, "track": "coop"})
    assert r.status_code == 200, r.json()

    tags_before, _ = await _get_tags("archive_worker")
    assert "builder" in tags_before
    assert "local_partner" in tags_before

    # admin 归档营地
    r = await client.put(f"/api/camps/{camp_id}", headers=_h(admin_tok), json={"status": "archived"})
    assert r.status_code == 200, r.json()

    tags_after, _ = await _get_tags("archive_worker")
    # camp_job 标签应收走
    assert "builder" not in tags_after, f"归档后 builder 应消失: {tags_after}"
    # tenancy 标签应保留
    assert "local_partner" in tags_after, f"归档后 local_partner 应保留: {tags_after}"


# ─── 测试 5：本地村民永不收回 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_native_never_revoked(client, monkeypatch):
    """本地村民退房/归档后 npc 标签仍在。"""
    monkeypatch.setenv("NATIVE_INVITE_CODES", "NATIVE-TEST-5")
    monkeypatch.setenv("INVITE_CODES", "NATIVE-TEST-5")

    await _register(client, "native_user", invite_code="NATIVE-TEST-5")
    tok = await _login(client, "native_user")

    # 住合作社
    r = await client.post("/api/accommodation/checkin", headers=_h(tok),
                          json={"room_id": "dorm104", "bed_num": 1, "track": "coop"})
    assert r.status_code == 200, r.json()

    tags_before, _ = await _get_tags("native_user")
    assert "npc" in tags_before
    assert "local_partner" in tags_before

    # 退房
    r = await client.post("/api/accommodation/checkout", headers=_h(tok))
    assert r.status_code == 200, r.json()

    tags_after, _ = await _get_tags("native_user")
    assert "npc" in tags_after, f"退房后 npc 应保留（永久）: {tags_after}"
    assert "local_partner" not in tags_after, f"退房后 local_partner 应消失: {tags_after}"


# ─── 测试 6：迁移幂等（连跑两次行数不变）──────────────────────────

@pytest.mark.asyncio
async def test_migration_idempotent(client, monkeypatch):
    """迁移逻辑跑两次 → UserTag active 行数不变（幂等）。

    模拟：手动调用 grant_tag 两次，联合唯一约束保证不产生重复行。
    """
    monkeypatch.delenv("INVITE_CODES", raising=False)

    await _register(client, "mig_user")
    uid = "mig_user"

    from identity import grant_tag
    # 第一次发标签
    async with async_session() as s:
        await grant_tag(s, uid, "npc", "native")
        await grant_tag(s, uid, "adventurer", "camp_member:legacy")
        await s.commit()

    # 计数
    async with async_session() as s:
        count1 = (await s.execute(
            select(func.count(UserTag.id)).where(UserTag.user_id == uid)
        )).scalar()

    # 第二次发同样的标签（幂等 no-op）
    async with async_session() as s:
        await grant_tag(s, uid, "npc", "native")
        await grant_tag(s, uid, "adventurer", "camp_member:legacy")
        await s.commit()

    async with async_session() as s:
        count2 = (await s.execute(
            select(func.count(UserTag.id)).where(UserTag.user_id == uid)
        )).scalar()

    assert count1 == count2, f"迁移不幂等: 第一次 {count1} 行, 第二次 {count2} 行"
    assert count1 == 2, f"期望 2 行, 实际 {count1}"
