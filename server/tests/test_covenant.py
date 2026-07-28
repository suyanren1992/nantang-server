# -*- coding: utf-8 -*-
"""G-1 公约签署凭证测试——覆盖判据 1-4；判据5(pytest零回归)由全量套件保证。

钱随单走：首签发 NT 必有 ledger 一条 + pool.balance 同步减；幂等重签零副作用。
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select, func

from database import async_session
from models import User, CommunityPool, CovenantSignature, NTLedger, MapLocation


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _reg(client, name, balance=0):
    r = await client.post("/api/auth/register", json={"name": name, "password": "Passw0rd!"})
    assert r.json()["ok"], r.text
    uid = r.json()["user"]["uid"]
    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        u.nt_balance = balance
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(reserve=0, frozen=0)
            s.add(pool)
        pool.balance = 10000; pool.total_issued = 10000  # 注册已建 balance=0 的池，此处显式充值
        await s.commit()
    tok = (await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})).json()["token"]
    return tok, uid


@pytest.mark.asyncio
async def test_judgement_1_new_user_sign(client: AsyncClient):
    """判据1：新用户 sign → 200 + 记录落库 + nt_balance +10 + ledger 一条 + pool -10。"""
    tok, uid = await _reg(client, "签约甲", balance=0)
    # 池初值
    async with async_session() as s:
        pool0 = (await s.execute(select(CommunityPool).limit(1))).scalar_one().balance

    r = await client.post("/api/covenant/sign", json={}, headers=_h(tok))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] and d["signed"] and d["reward_granted"] and d["reward"] == 10
    assert d["balance"] == 10

    async with async_session() as s:
        # 记录落库
        sig = (await s.execute(select(CovenantSignature).where(
            CovenantSignature.user_id == uid))).scalar_one()
        assert sig.covenant_version == "v12" and sig.reward_granted is True
        # 用户余额 +10
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        assert u.nt_balance == 10
        # ledger 一条 covenant_sign
        led = (await s.execute(select(NTLedger).where(
            NTLedger.to_user == uid, NTLedger.type == "covenant_sign"))).scalars().all()
        assert len(led) == 1 and led[0].amount == 10 and led[0].from_user == "community_pool"
        # pool -10
        pool1 = (await s.execute(select(CommunityPool).limit(1))).scalar_one().balance
        assert pool1 == pool0 - 10


@pytest.mark.asyncio
async def test_judgement_2_idempotent_resign(client: AsyncClient):
    """判据2：同用户同版本再 sign → 幂等，余额不变，无新流水。"""
    tok, uid = await _reg(client, "签约乙", balance=0)
    r1 = await client.post("/api/covenant/sign", json={}, headers=_h(tok))
    assert r1.json()["reward_granted"] is True
    bal1 = r1.json()["balance"]

    r2 = await client.post("/api/covenant/sign", json={}, headers=_h(tok))
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["signed"] and d2["already_signed"] and d2["reward_granted"] is False
    assert d2["balance"] == bal1

    async with async_session() as s:
        # 签署记录仍只有 1 条
        cnt = (await s.execute(select(func.count()).select_from(CovenantSignature).where(
            CovenantSignature.user_id == uid))).scalar()
        assert cnt == 1
        # ledger 仍只有 1 条 covenant_sign
        led = (await s.execute(select(NTLedger).where(
            NTLedger.to_user == uid, NTLedger.type == "covenant_sign"))).scalars().all()
        assert len(led) == 1
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        assert u.nt_balance == bal1


@pytest.mark.asyncio
async def test_judgement_3_status_endpoint(client: AsyncClient):
    """判据3：status 端点——未签返回未签、已签返回已签+版本。"""
    tok, uid = await _reg(client, "签约丙", balance=0)
    s0 = (await client.get("/api/covenant/status", headers=_h(tok))).json()
    assert s0["version"] == "v12" and s0["signed"] is False and s0["signed_at"] is None
    assert s0["sign_reward"] == 10

    await client.post("/api/covenant/sign", json={}, headers=_h(tok))
    s1 = (await client.get("/api/covenant/status", headers=_h(tok))).json()
    assert s1["signed"] is True and s1["signed_at"] is not None and s1["version"] == "v12"


@pytest.mark.asyncio
async def test_judgement_4_covenant_text_config(client: AsyncClient):
    """判据4：covenant_text 可从 config 读出，版本号与 v12 对应，含正文/附页/签署条款五项。"""
    tok, uid = await _reg(client, "签约丁", balance=0)
    r = await client.get("/api/covenant/text", headers=_h(tok))
    assert r.status_code == 200, r.text
    cfg = r.json()
    assert cfg["version"] == "v12"
    assert cfg["sign_reward"] == 10
    assert len(cfg["chapters"]) == 10          # 正文十章
    assert len(cfg["appendices"]) == 5         # 附页 A-E
    assert len(cfg["sign_terms"]) == 5         # 签署页条款五项
    # 落库到 MapLocation key=covenant_text
    async with async_session() as s:
        row = (await s.execute(select(MapLocation).where(
            MapLocation.key == "covenant_text"))).scalar_one()
        assert row.data and "南塘" in row.data


@pytest.mark.asyncio
async def test_sign_old_version_409(client: AsyncClient):
    """签旧版本 → 409 提示需签当前版本（附加：契约边界）。"""
    tok, uid = await _reg(client, "签约戊", balance=0)
    r = await client.post("/api/covenant/sign", json={"version": "v11"}, headers=_h(tok))
    assert r.status_code == 409, r.text


@pytest.mark.asyncio
async def test_resign_new_version_no_reward(client: AsyncClient):
    """续签不发：已签过任一版本者，再签新版本不再发 NT（每人只发一次首签）。"""
    tok, uid = await _reg(client, "签约己", balance=0)
    # 先签 v12（首签发 10）
    r1 = await client.post("/api/covenant/sign", json={}, headers=_h(tok))
    assert r1.json()["reward_granted"] is True
    bal1 = r1.json()["balance"]
    # 模拟版本升级到 v13（走 config 修订落地）
    async with async_session() as s:
        import json as _j
        row = (await s.execute(select(MapLocation).where(
            MapLocation.key == "covenant_text"))).scalar_one()
        cfg = _j.loads(row.data)
        cfg["version"] = "v13"
        row.data = _j.dumps(cfg, ensure_ascii=False)
        await s.commit()
    # 续签 v13 → 不发 NT
    r2 = await client.post("/api/covenant/sign", json={}, headers=_h(tok))
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["signed"] and d2["already_signed"] is False and d2["reward_granted"] is False
    assert d2["balance"] == bal1  # 余额不变
