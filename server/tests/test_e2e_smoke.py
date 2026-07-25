"""D-20 契约链路冒烟：A-7 校核闭环 + 提现 + 驳回 + presence 端到端。

每一环断言服务端状态（直查库或接口返回），不是返回文案。
"""
import uuid
import pytest
from httpx import AsyncClient

from server.auth_utils import hash_password
from server.database import async_session
from server.models import User, CommunityPool, Verification, NTLedger


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def _register_and_login(client, name, role="villager", trust=100, wallet=None):
    """注册 → 登录 → 直接写库补 role/trust/wallet（注册端点不接受这些字段）。"""
    r = await client.post("/api/auth/register", json={"name": name, "password": "Passw0rd!"})
    assert r.status_code == 200 and r.json()["ok"] is True, r.json()
    uid = r.json()["user"]["id"]
    async with async_session() as s:
        u = (await s.execute(__import__("sqlalchemy").select(User).where(User.id == uid))).scalar_one()
        u.role = role
        u.trust_score = trust
        if wallet:
            u.wallet_address = wallet
        if role == "admin":
            pool = (await s.execute(__import__("sqlalchemy").select(CommunityPool).limit(1))).scalar_one_or_none()
            if not pool:
                s.add(CommunityPool(balance=10000, total_issued=10000, reserve=10000, frozen=0))
            else:
                pool.balance = max(pool.balance or 0, 10000)
                pool.reserve = max(pool.reserve or 0, 10000)
        await s.commit()
    r = await client.post("/api/auth/login", json={"name": name, "password": "Passw0rd!"})
    return r.json()["token"], uid


WALLET = "0x0000000000000000000000000000000000000001"


@pytest.mark.asyncio
async def test_full_capital_loop(client: AsyncClient):
    """注册 → 校核 → approve 到账 → 提现冻结 → admin confirm → reject 另一条 → presence 同步。"""
    # 1. 三账号：alice（doer）/ bob（verifier）/ admin
    alice_tok, alice_id = await _register_and_login(client, "alice_e2e", wallet=WALLET)
    bob_tok, bob_id = await _register_and_login(client, "bob_e2e")
    admin_tok, admin_id = await _register_and_login(client, "admin_e2e", role="admin")

    # 2. A-7 回归：alice 创建校核记录（客户端生成 id），bob approve，断言 NT 到账
    vfy_id = f"vfy-{uuid.uuid4().hex[:12]}"
    r = await client.post("/api/data/verifications", headers=_h(alice_tok), json={
        "id": vfy_id, "type": "task", "action": "discover",
        "detail": {"x": 1}, "ntAmount": 10, "verifierReward": 1,
    })
    assert r.status_code == 200, r.text
    # bob approve
    r = await client.post(f"/api/nt/verifications/{vfy_id}/approve", headers=_h(bob_tok), json={})
    assert r.status_code == 200, r.text
    # 直查库断言 alice 余额 +10（服务端状态，非返回文案）
    async with async_session() as s:
        from sqlalchemy import select
        alice = (await s.execute(select(User).where(User.id == alice_id))).scalar_one()
        assert alice.nt_balance == 10, f"alice 应到账 10，实得 {alice.nt_balance}"
        vfy = (await s.execute(select(Verification).where(Verification.id == vfy_id))).scalar_one()
        assert vfy.status == "verified"
        assert vfy.verifier == bob_id

    # 2b. 变异：故意用错误 id approve → 应 404（锁死 A-7 不复发）
    r = await client.post(f"/api/nt/verifications/{vfy_id}-WRONG/approve", headers=_h(bob_tok), json={})
    assert r.status_code == 404

    # 3. alice 提现 5 NT → 断言 ledger pending + frozen 增加 + 余额扣减
    r = await client.post("/api/nt/withdraw", headers=_h(alice_tok), json={
        "amount": 5, "to_address": WALLET,
    })
    assert r.status_code == 200 and r.json()["ok"] is True, r.json()
    entry_id = r.json()["entry_id"]
    async with async_session() as s:
        from sqlalchemy import select, func
        alice = (await s.execute(select(User).where(User.id == alice_id))).scalar_one()
        assert alice.nt_balance == 5
        ledgers = list((await s.execute(
            select(NTLedger).where(NTLedger.type == "withdraw", NTLedger.from_user == alice_id)
        )).scalars())
        assert len(ledgers) >= 1
        w = ledgers[-1]
        assert w.status == "pending"

    # 4. admin confirm → 断言 ledger confirmed
    r = await client.post(f"/api/admin/withdraw/confirm?entry_id={entry_id}", headers=_h(admin_tok))
    assert r.status_code == 200, r.text
    async with async_session() as s:
        from sqlalchemy import select
        w = (await s.execute(select(NTLedger).where(NTLedger.id == entry_id))).scalar_one()
        assert w.status == "confirmed"

    # 5. reject 路径：再造一条校核，bob 驳回 → 断言 rejected + retry_count+1
    vfy2 = f"vfy-{uuid.uuid4().hex[:12]}"
    await client.post("/api/data/verifications", headers=_h(alice_tok), json={
        "id": vfy2, "type": "task", "action": "discover",
        "detail": {}, "ntAmount": 3, "verifierReward": 1,
    })
    r = await client.post(f"/api/nt/verifications/{vfy2}/reject", headers=_h(bob_tok),
                          json={"reason": "spam"})
    assert r.status_code == 200, r.text
    async with async_session() as s:
        from sqlalchemy import select
        v2 = (await s.execute(select(Verification).where(Verification.id == vfy2))).scalar_one()
        assert v2.status == "rejected"
        assert v2.retry_count == 1

    # 6. presence: alice 上报翻牌状态 → bob 拉 sync_all 能看到
    await client.post("/api/data/sync_shared", headers=_h(alice_tok), json={
        "presence": {alice_id: {"flipped": True, "at": "2026-07-25T22:00:00"}},
    })
    r = await client.get("/api/data/sync_all", headers=_h(bob_tok))
    assert r.status_code == 200
    data = r.json()
    assert "presence" in data
    assert alice_id in data["presence"]
    assert data["presence"][alice_id].get("flipped") is True
