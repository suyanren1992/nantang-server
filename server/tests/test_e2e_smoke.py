"""D-20 契约链路冒烟：A-7 校核闭环 + 提现 + 驳回 + presence 端到端。

每一环断言服务端状态（直查库或接口返回），不是返回文案。
D-18 后金额调整：校核奖励默认从 earn 路径走 60 NT（对齐服务端 earn_sync 日常值），
提现 50 NT 留 10 NT 余额（避免 trust_score 冷却期逻辑）。
"""
import uuid
import pytest
from httpx import AsyncClient

from auth_utils import hash_password
from database import async_session
from models import User, CommunityPool, Verification, NTLedger
from sqlalchemy import select


WALLET = "0x0000000000000000000000000000000000000001"


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _register_and_login(client, name, role="villager", trust=100, wallet=None):
    """注册 → 登录 → 直接写库补 role/trust/wallet。

    注意：register 端点会把第一个注册者设为 admin 并建 pool(balance=0)。
    本测试始终先注册 admin 让 pool 余额就绪。
    """
    payload = {"name": name, "password": "Passw0rd!"}
    if wallet:
        payload["wallet_address"] = wallet
    r = await client.post("/api/auth/register", json=payload)
    assert r.status_code == 200 and r.json()["ok"] is True, r.json()
    uid = r.json()["user"]["uid"]  # _user_json 里 uid = u.id
    async with async_session() as s:
        u = (await s.execute(select(User).where(User.id == uid))).scalar_one()
        u.role = role
        u.trust_score = trust
        if wallet:
            u.wallet_address = wallet
        # 无条件保证 pool 有钱（无论是不是 admin）
        pool = (await s.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool is None:
            pool = CommunityPool(balance=10000, total_issued=20000, reserve=10000, frozen=0)
            s.add(pool)
        else:
            pool.balance = max(pool.balance or 0, 10000)
            pool.reserve = max(pool.reserve or 0, 10000)
        await s.commit()
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"], uid


@pytest.mark.asyncio
async def test_full_capital_loop(client):
    """注册 → 校核 → approve 到账 → 提现冻结 → admin confirm → reject → presence 同步。"""
    # 1. 三账号：admin 先注册（保证 pool 已建 + 有钱）
    admin_tok, admin_id = await _register_and_login(client, "admin_e2e_z", role="admin")
    alice_tok, alice_id = await _register_and_login(client, "alice_e2e_z", wallet=WALLET, trust=100)
    bob_tok, bob_id = await _register_and_login(client, "bob_e2e_z", trust=100)

    # 2. A-7 回归：alice 创建校核（客户端生成 id）→ bob approve
    vfy_id = f"vfy-{uuid.uuid4().hex[:12]}"
    r = await client.post("/api/data/verifications", headers=_h(alice_tok), json={
        "id": vfy_id, "type": "task", "action": "discover",
        "detail": {"x": 1}, "ntAmount": 60, "verifierReward": 1,
    })
    assert r.status_code == 200, r.text
    # approve 必填 body: doer/action (VerificationApproveRequest)
    r = await client.post(f"/api/nt/verifications/{vfy_id}/approve", headers=_h(bob_tok),
                          json={"doer": alice_id, "action": "discover",
                                "nt_amount": 60, "verifier_reward": 1})
    assert r.status_code == 200, r.text
    # 直查库断言 alice 余额 +60
    async with async_session() as s:
        alice = (await s.execute(select(User).where(User.id == alice_id))).scalar_one()
        assert alice.nt_balance == 60, f"alice 应到账 60，实得 {alice.nt_balance}"
        vfy = (await s.execute(select(Verification).where(Verification.id == vfy_id))).scalar_one()
        assert vfy.status == "verified"
        assert vfy.verifier == bob_id

    # 2b. 变异：错 id → 404
    r = await client.post(f"/api/nt/verifications/{vfy_id}-WRONG/approve", headers=_h(bob_tok),
                          json={"doer": alice_id, "action": "discover"})
    assert r.status_code == 404

    # 3. alice 提现 50 NT
    r = await client.post("/api/nt/withdraw", headers=_h(alice_tok), json={
        "amount": 50, "to_address": WALLET,
    })
    assert r.status_code == 200 and r.json()["ok"] is True, r.json()
    entry_id = r.json()["entry_id"]
    async with async_session() as s:
        alice = (await s.execute(select(User).where(User.id == alice_id))).scalar_one()
        assert alice.nt_balance == 10
        ledgers = list((await s.execute(
            select(NTLedger).where(NTLedger.type == "withdraw", NTLedger.from_user == alice_id)
        )).scalars())
        assert len(ledgers) >= 1
        w = ledgers[-1]
        assert w.status == "pending"

    # 4. admin confirm（端点 /api/admin/withdraw/confirm?entry_id=xxx）
    r = await client.post(f"/api/admin/withdraw/confirm?entry_id={entry_id}", headers=_h(admin_tok))
    assert r.status_code == 200, r.text
    async with async_session() as s:
        w = (await s.execute(select(NTLedger).where(NTLedger.entry_id == entry_id))).scalar_one()
        assert w.status == "settled"

    # 5. reject 路径：再造一条校核，bob 驳回
    vfy2 = f"vfy-{uuid.uuid4().hex[:12]}"
    await client.post("/api/data/verifications", headers=_h(alice_tok), json={
        "id": vfy2, "type": "task", "action": "discover",
        "detail": {}, "ntAmount": 3, "verifierReward": 1,
    })
    r = await client.post(f"/api/nt/verifications/{vfy2}/reject", headers=_h(bob_tok),
                          json={"reason": "spam"})
    assert r.status_code == 200, r.text
    async with async_session() as s:
        v2 = (await s.execute(select(Verification).where(Verification.id == vfy2))).scalar_one()
        assert v2.status == "rejected"
        assert v2.retry_count == 1

    # 6. presence: alice 上报 → bob 拉 sync_all 看到
    await client.post("/api/data/sync_shared", headers=_h(alice_tok), json={
        "presence": {alice_id: {"flipped": True, "at": "2026-07-26T01:00:00"}},
    })
    r = await client.get("/api/data/sync_all", headers=_h(bob_tok))
    assert r.status_code == 200
    data = r.json()
    assert "presence" in data
    assert alice_id in data["presence"]
    assert data["presence"][alice_id].get("flipped") is True
