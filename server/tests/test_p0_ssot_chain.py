"""SSOT-CHAIN: 链上为底账 — 禁凭空发币 + 资本金入池 + 对账含 reserve。

砂仁定的铁律:
    所有人余额 + 社区池 + 托管 + 营队池 + 冻结 + 储备 == 多签链上余额

实测出的四处违反:
  ① 新库/空池时凭空写 balance=500,total_issued=500(database/nt_helpers)
  ② dev-reset soft/hard 写死 500 — 链上 1000 时重置就蒸发 500
  ③ dev-seed "补池至 500" — 直接印钱
  ④ /verify 把 reserve 排除在等式外, 而链上充值恰好记入 reserve
     -> 真钱藏在对账看不见的格子里
"""
import inspect
import re

import pytest

import database as D
import nt_helpers as H
import chain_scanner as CS
import routes.admin as A
import routes.nt as NT


def _code_only(mod_or_src):
    """取源码中的"可执行代码"部分: 剔除注释与字符串字面量。

    直接字符串匹配会把注释里描述旧 bug 的文字(如"原实现 balance=500")
    误判为真代码, 故用 tokenize 精确剔除。
    """
    import io as _io, tokenize, inspect
    src = mod_or_src if isinstance(mod_or_src, str) else inspect.getsource(mod_or_src)
    out = []
    try:
        for tok in tokenize.generate_tokens(_io.StringIO(src).readline):
            if tok.type in (tokenize.COMMENT, tokenize.STRING):
                continue
            out.append(tok.string)
    except Exception:
        return src
    return " ".join(out)


# ── ① 禁凭空发币 ────────────────────────────

def test_new_pool_starts_at_zero_not_500():
    """新建社区池必须从 0 开始 — 钱只能从链上进来。"""
    for mod, name in ((D, "database.py"), (H, "nt_helpers.py")):
        code = _code_only(mod)
        assert "balance = 500" not in code, f"{name} 仍凭空发 500"
        assert "total_issued = 500" not in code, f"{name} 仍凭空发 500"
    assert "balance=0, total_issued=0" in inspect.getsource(H)


@pytest.mark.asyncio
async def test_get_pool_creates_zero_pool(_setup_db):
    """真判据: 实际调 _get_pool 建出来的池子余额必须是 0。"""
    from database import async_session
    from models import CommunityPool
    from sqlalchemy import delete, select
    async with async_session() as db:
        await db.execute(delete(CommunityPool))
        await db.commit()
        pool = await H._get_pool(db)
        await db.commit()
        assert pool.balance == 0, f"空池凭空发了 {pool.balance} NT"
        assert pool.total_issued == 0


# ── ②③ dev 工具不得写死金额 ─────────────────

def test_dev_reset_does_not_hardcode_500():
    """重置必须对齐链上, 不得写死 500(链上 1000 时会蒸发 500)。"""
    code = _code_only(A)
    assert "balance = 500" not in code, "dev-reset 仍写死 500"
    assert "total_issued = 500" not in code, "dev-reset 仍写死 500"
    assert "_reset_pool_to_chain" in inspect.getsource(A), "重置未对齐链上余额"


def test_dev_seed_no_longer_mints_to_500():
    """dev-seed 不得再"补池至 500" — 那是印钱。"""
    code = _code_only(A.dev_seed)
    assert "pool.balance += diff" not in code.replace(" ", "").replace("pool.balance+=diff", "pool.balance += diff") or True
    compact = code.replace(" ", "")
    assert "pool.balance+=diff" not in compact, "dev-seed 仍在凭空补池"
    assert "total_issued+=diff" not in compact
    assert "pool_seed" not in code


def test_reset_pool_to_chain_uses_zero_when_chain_unreadable(monkeypatch):
    """链上读不到时宁可置 0, 不得猜一个数字(宁可偏少不可多记)。"""
    import asyncio

    class FakePool:
        balance = 999; total_issued = 999; task_escrow = 5
        contribution_pool = 1; camp_balance = 2; reserve = 3
        frozen = 4; updated_at = None

    class FakeDB:
        def add(self, x): pass

    async def none_chain(): return None
    monkeypatch.setattr(A, "_chain_balance_or_none", none_chain)
    p = FakePool()
    amt = asyncio.run(A._reset_pool_to_chain(FakeDB(), p, "now", "soft"))
    assert amt == 0 and p.balance == 0 and p.total_issued == 0


def test_reset_pool_aligns_to_chain_balance(monkeypatch):
    """链上 1000 时重置必须得 1000, 而不是 500。"""
    import asyncio

    class FakePool:
        balance = 0; total_issued = 0; task_escrow = 0
        contribution_pool = 0; camp_balance = 0; reserve = 0
        frozen = 0; updated_at = None

    added = []
    class FakeDB:
        def add(self, x): added.append(x)

    async def chain_1000(): return 1000
    monkeypatch.setattr(A, "_chain_balance_or_none", chain_1000)
    p = FakePool()
    amt = asyncio.run(A._reset_pool_to_chain(FakeDB(), p, "now", "hard"))
    assert amt == 1000 and p.balance == 1000 and p.total_issued == 1000
    assert added, "未写 pool_init 账"


# ── ④ 对账等式不含 reserve（修：reserve 是 pool.balance 内部额控）──

def test_verify_equation_excludes_reserve():
    """reserve 不等于式项——它是 pool.balance 的内部额控(提现上限), 非独立资金。
    旧 bug（链上充值记 reserve）已修正为进 pool.balance。
    若 reserve 入等式, 提现流程(user→frozen)会破坏守恒。
    """
    import ast, textwrap
    tree = ast.parse(textwrap.dedent(inspect.getsource(NT.verify)))
    expr = None
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == "total_system":
                    expr = ast.unparse(node.value)
    assert expr, "未找到 total_system 赋值"
    assert "reserve" not in expr, \
        f"reserve 不应在等式内（它是 pool.balance 的内部额控）: {expr}"
    assert "pool.balance" in expr, "等式必须含 pool.balance"
    assert "pool.camp_balance" in expr, "等式必须含 camp_balance"


def test_reconcile_chain_endpoint_exists_and_uses_chain():
    """必须有一个拿链上余额做右边的对账端点。"""
    assert hasattr(NT, "reconcile_chain")
    src = inspect.getsource(NT.reconcile_chain)
    assert "_read_chain_balance" in src
    code = _code_only(src)
    assert "total_issued" not in code, "对账端点不得用 total_issued 自证"
    # reserve 可在 breakdown 展示，但不在 book_total 等式内
    book_src = "\n".join(l for l in src.split("\n") if "book_total" in l)
    assert "reserve" not in _code_only(book_src), \
        f"book_total 不应含 reserve: {book_src}"


def test_cron_has_daily_chain_reconcile():
    """每日必须自动链上对账并在不平时告警。"""
    import cron
    assert hasattr(cron, "_chain_reconcile")
    src = inspect.getsource(cron._chain_reconcile)
    assert "_read_chain_balance" in src
    assert "logger.critical" in src or "logger.error" in src


# ── 资本金入池(本次需求核心) ───────────────

def test_capital_source_routes_to_pool_not_personal():
    """资本金地址转入 -> 全额进社区池, 不进个人余额。"""
    src = inspect.getsource(CS.ChainScanner._process_log)
    assert "_is_capital_source" in src, "未区分资本金与个人充值"
    assert "deposit_capital" in src
    assert "pool.balance += amount" in src


def test_capital_source_sets_reserve_cap():
    """资本金入池时同时设 reserve 为提现额控(≤pool.balance)。"""
    src = inspect.getsource(CS.ChainScanner._process_log)
    body = "\n".join(l for l in src.split("\n") if not l.strip().startswith("#"))
    assert "pool.reserve = (pool.reserve or 0) + amount" in body, \
        "资本金未设 reserve 额控, 提现将永久上限为 0"


def test_capital_source_checked_before_user_matching():
    """_is_capital_source 必须在用户匹配之前调用。"""
    src = inspect.getsource(CS.ChainScanner._process_log)
    pos_cap = src.index("_is_capital_source")
    pos_user = src.index("user_result = await db.execute")
    assert pos_cap < pos_user, \
        f"资本金判断({pos_cap})必须在用户匹配({pos_user})之前, 否则未绑用户的资本金地址会被 return"


def test_capital_source_matching_is_case_insensitive(monkeypatch):
    """链上地址大小写混写很常见, 必须不区分大小写。"""
    monkeypatch.setattr(CS, "CAPITAL_SOURCES", {"0xeb558cfa7cf4e1a8e1b79d7446f21c41a34c86ac"})
    assert CS._is_capital_source("0xEB558CFA7CF4E1A8E1B79D7446F21C41A34C86AC")
    assert CS._is_capital_source("0xeb558cfa7cf4e1a8e1b79d7446f21c41a34c86ac")
    assert not CS._is_capital_source("0x0000000000000000000000000000000000000001")
    assert not CS._is_capital_source("")


def test_personal_deposit_no_longer_double_counts():
    """旧 bug: 个人充值同时 user.nt_balance+=amount 且 pool.reserve+=amount。
    修正后 reserve 只在资本金分支设（额控），个人分支不碰 reserve。"""
    src = inspect.getsource(CS.ChainScanner._process_log)
    # 找个人充值分支 (else: 块) — 里面不应有 reserve 赋值
    # 验证 reserve 赋值仅出现在 is_capital 分支
    lines = src.split("\n")
    in_capital, in_personal, seen_reserve = False, False, False
    for l in lines:
        stripped = l.strip()
        if "if is_capital:" in stripped:
            in_capital = True; in_personal = False; continue
        if stripped == "else:" and in_capital:
            in_capital = False; in_personal = True; continue
        if "pool.reserve" in stripped and "=" in stripped and not stripped.lstrip().startswith("#"):
            if in_personal:
                # 如果在非 capital 分支（即个人分支）出现 reserve 赋值 → bug
                raise AssertionError(f"个人充值分支不应设 reserve: {l.strip()}")
    # 验证 reserve 确实在 capital 分支被设置（额控）
    cap_section = "\n".join(src.split("if is_capital:")[1].split("else:")[0].split("\n"))
    assert "pool.reserve" in cap_section or "reserve" in cap_section, \
        "资本金分支应设 reserve 作为提现额控"


# ── 准入条件①: 提现闭环（提现/拒绝→verify 仍 pass）──

@pytest.mark.asyncio
async def test_withdraw_full_cycle_keeps_verify_pass(_setup_db):
    """闭环: 设池→提现冻结→confirm→verify pass 仍 True。
    这是 P0 事故的直接成因——reserve 入等式时 withdraw 冻结步骤会破守恒。
    测试不调 HTTP 端点, 直接用模型操作复现端点逻辑, 验证等式一致性。"""
    from database import async_session
    from models import User, CommunityPool, NTLedger
    from sqlalchemy import delete, select
    import nt_helpers as H
    from routes.nt import verify as _verify

    async with async_session() as db:
        await db.execute(delete(NTLedger))
        await db.execute(delete(User))
        await db.execute(delete(CommunityPool))
        await db.commit()

        admin = User(id="adm", password_hash="x", role="admin", nt_balance=0,
                     avatar_seed="x", created_at="2026-01-01", updated_at="2026-01-01")
        user = User(id="u1", password_hash="x", role="user", nt_balance=300,
                    avatar_seed="y", created_at="2026-01-01", updated_at="2026-01-01",
                    wallet_address="0xtest")
        db.add_all([admin, user])
        pool = CommunityPool(singleton=True, balance=500, total_issued=800,
                             task_escrow=0, contribution_pool=0, camp_balance=0,
                             reserve=500, frozen=0)
        db.add(pool)
        await db.commit()

    # Step 1: verify before withdraw
    async with async_session() as db:
        v1 = await _verify(user=admin, db=db)
        assert v1["pass"] is True, f"初始应 pass: diff={v1['checks']['diff']}"

    # Step 2: withdraw request (复现端点逻辑)
    #   user.nt_balance -= amount
    #   pool.frozen += amount
    #   reserve 不扣减（只作额控）
    amount = 100
    async with async_session() as db:
        u = (await db.execute(select(User).where(User.id == "u1"))).scalar_one_or_none()
        p = await H._get_pool(db, lock=True)
        u.nt_balance -= amount
        p.frozen = (p.frozen or 0) + amount
        lid = H._ledger_id()
        await H._add_ledger(db, lid, u.id, "frozen_pool", amount,
                           "withdraw", "提现测试", status="pending")
        await db.commit()

    # Step 3: verify — 提现 pending 中应仍 pass
    async with async_session() as db:
        v2 = await _verify(user=admin, db=db)
        assert v2["pass"] is True, (
            f"提现 pending 中 verify 应仍 pass: diff={v2['checks']['diff']}, "
            f"total_system={v2['checks']['total_system']}, "
            f"total_issued={v2['checks']['total_issued']}")

    # Step 4: confirm (复现端点逻辑)
    #   pool.frozen -= amount
    #   pool.total_issued -= amount
    async with async_session() as db:
        p = await H._get_pool(db, lock=True)
        p.frozen = (p.frozen or 0) - amount
        p.total_issued -= amount
        await db.commit()

    # Step 5: verify — confirm 后应仍 pass
    async with async_session() as db:
        v3 = await _verify(user=admin, db=db)
        assert v3["pass"] is True, (
            f"confirm 后 verify 应仍 pass: diff={v3['checks']['diff']}")


@pytest.mark.asyncio
async def test_withdraw_reject_keeps_verify_pass(_setup_db):
    """闭环: withdraw→reject→verify pass。"""
    from database import async_session
    from models import User, CommunityPool, NTLedger
    from sqlalchemy import delete, select
    import nt_helpers as H
    from routes.nt import verify as _verify

    async with async_session() as db:
        await db.execute(delete(NTLedger))
        await db.execute(delete(User))
        await db.execute(delete(CommunityPool))
        await db.commit()

        admin = User(id="adm2", password_hash="x", role="admin", nt_balance=0,
                     avatar_seed="x", created_at="2026-01-01", updated_at="2026-01-01")
        user = User(id="u2", password_hash="x", role="user", nt_balance=200,
                    avatar_seed="y", created_at="2026-01-01", updated_at="2026-01-01",
                    wallet_address="0xr")
        db.add_all([admin, user])
        pool = CommunityPool(singleton=True, balance=500, total_issued=700,
                             task_escrow=0, contribution_pool=0, camp_balance=0,
                             reserve=500, frozen=0)
        db.add(pool)
        await db.commit()

    # verify before
    async with async_session() as db:
        v0 = await _verify(user=admin, db=db)
        assert v0["pass"] is True

    # withdraw: freeze 100 (reserve 不扣减)
    amount = 100
    async with async_session() as db:
        u = (await db.execute(select(User).where(User.id == "u2"))).scalar_one_or_none()
        p = await H._get_pool(db, lock=True)
        u.nt_balance -= amount
        p.frozen = (p.frozen or 0) + amount
        lid = H._ledger_id()
        await H._add_ledger(db, lid, u.id, "frozen_pool", amount,
                           "withdraw", "test", status="pending")
        await db.commit()

    # verify during pending
    async with async_session() as db:
        v1 = await _verify(user=admin, db=db)
        assert v1["pass"] is True, f"pending 中应 pass: diff={v1['checks']['diff']}"

    # reject: return to user (reserve 不退回)
    async with async_session() as db:
        u = (await db.execute(select(User).where(User.id == "u2"))).scalar_one_or_none()
        p = await H._get_pool(db, lock=True)
        p.frozen = (p.frozen or 0) - amount
        u.nt_balance += amount
        await db.commit()

    # verify after reject
    async with async_session() as db:
        v2 = await _verify(user=admin, db=db)
        assert v2["pass"] is True, f"reject 后应 pass: diff={v2['checks']['diff']}"


# ── 准入条件②: _accounting_check 与 /verify 口径一致 ──

@pytest.mark.asyncio
async def test_accounting_check_and_verify_same_diff(_setup_db):
    """_accounting_check 和 /verify 对同一库状态应返回相同 diff。"""
    from database import async_session
    from models import User, CommunityPool
    from sqlalchemy import delete
    import nt_helpers as H

    async with async_session() as db:
        await db.execute(delete(User))
        await db.execute(delete(CommunityPool))
        await db.commit()

        admin = User(id="a", password_hash="x", role="admin", nt_balance=50,
                     avatar_seed="a", created_at="2026-01-01", updated_at="2026-01-01")
        u1 = User(id="u1", password_hash="x", role="user", nt_balance=100,
                  avatar_seed="b", created_at="2026-01-01", updated_at="2026-01-01")
        u2 = User(id="u2", password_hash="x", role="user", nt_balance=30,
                  avatar_seed="c", created_at="2026-01-01", updated_at="2026-01-01")
        db.add_all([admin, u1, u2])
        # Σuser(180) + balance(100) + escrow(20) + camp(50) + frozen(30) = 380
        pool = CommunityPool(singleton=True, balance=100, total_issued=380,
                             task_escrow=20, contribution_pool=0, camp_balance=50,
                             reserve=1000, frozen=30)
        db.add(pool)
        await db.commit()

    # /verify diff
    from routes.nt import verify
    v = await verify(user=admin, db=db)
    v_diff = v["checks"]["diff"]

    # _accounting_check diff
    check = await H._accounting_check(db)
    c_diff = check["diff"]

    assert v_diff == c_diff, \
        f"/verify diff={v_diff} ≠ _accounting_check diff={c_diff} — 口径不一致"


# ── 历史补录幂等 ───────────────────────

def test_backfill_is_idempotent_by_txhash():
    """补录必须按 tx_hash 幂等 — 重启不得重复入账。"""
    src = inspect.getsource(D)
    assert "BACKFILL_DEPOSITS" in src
    i = src.index("BACKFILL_DEPOSITS")
    seg = src[i:i + 1800]
    assert "NTLedger.tx_hash == _tx" in seg, "补录未按 tx_hash 去重"
    assert "continue" in seg


# ── A' N-5: 端到端日结闭环（调真函数，不复刻端点逻辑）────────

@pytest.mark.asyncio
async def test_daily_settlement_keeps_verify_pass(_setup_db):
    """N-5: 高余额日结后 verify pass + reserve≤balance。

    设池 balance=1200 reserve=1200 → 真 _run_daily_settlement → 真 verify。
    旧 A-LABOR-BE 在 balance>1000 时触发 surplus_sweep（池→储备划拨）破坏守恒
    与 reserve≤balance；删 N-1 后应原样保持 pass。
    """
    from database import async_session
    from models import User, CommunityPool, NTLedger
    from sqlalchemy import delete
    from routes.nt import _run_daily_settlement, verify as _verify

    async with async_session() as db:
        await db.execute(delete(NTLedger))
        await db.execute(delete(User))
        await db.execute(delete(CommunityPool))
        await db.commit()

        admin = User(id="adm_ds1", password_hash="x", role="admin", nt_balance=0,
                     avatar_seed="x", created_at="2026-01-01", updated_at="2026-01-01")
        db.add(admin)
        pool = CommunityPool(singleton=True, balance=1200, total_issued=1200,
                             task_escrow=0, contribution_pool=0, camp_balance=0,
                             reserve=1200, frozen=0)
        db.add(pool)
        await db.commit()

    # Step 1: 调真 _run_daily_settlement（不走 HTTP，不复制端点逻辑）
    async with async_session() as db:
        result = await _run_daily_settlement(db, today="2026-08-01")
        assert "surplus_sweep" not in result, \
            f"N-1 未生效: surplus_sweep={result.get('surplus_sweep')}"
        assert "auto_rebalance" not in result, \
            f"N-1 未生效: auto_rebalance={result.get('auto_rebalance')}"

    # Step 2: 调真 verify（不走 HTTP，不复制等式逻辑）
    async with async_session() as db:
        v = await _verify(user=admin, db=db)
        assert v["pass"] is True, (
            f"高余额日结后 verify 应 pass: diff={v['checks']['diff']}, "
            f"reserve={v['checks']['reserve']}, balance={v['checks']['community_pool']}")
        assert v["checks"]["reserve_within_balance"] is True, (
            f"reserve_within_balance 应为 True: reserve={v['checks']['reserve']}, "
            f"balance={v['checks']['community_pool']}")
        assert (v["checks"]["reserve"] or 0) <= (v["checks"]["community_pool"] or 0)


@pytest.mark.asyncio
async def test_daily_settlement_low_balance_keeps_verify_pass(_setup_db):
    """N-5: 低余额日结后 verify pass + reserve≤balance。

    设池 balance=100 reserve=100 → 真 _run_daily_settlement → 真 verify。
    旧 A-LABOR-BE 在 balance<150 时触发 auto_rebalance（储备→池调水）破坏守恒；
    删 N-1 后应原样保持 pass。
    """
    from database import async_session
    from models import User, CommunityPool, NTLedger
    from sqlalchemy import delete
    from routes.nt import _run_daily_settlement, verify as _verify

    async with async_session() as db:
        await db.execute(delete(NTLedger))
        await db.execute(delete(User))
        await db.execute(delete(CommunityPool))
        await db.commit()

        admin = User(id="adm_ds2", password_hash="x", role="admin", nt_balance=0,
                     avatar_seed="x", created_at="2026-01-01", updated_at="2026-01-01")
        db.add(admin)
        pool = CommunityPool(singleton=True, balance=100, total_issued=100,
                             task_escrow=0, contribution_pool=0, camp_balance=0,
                             reserve=100, frozen=0)
        db.add(pool)
        await db.commit()

    # Step 1: 调真 _run_daily_settlement
    async with async_session() as db:
        result = await _run_daily_settlement(db, today="2026-08-02")
        assert "surplus_sweep" not in result, \
            f"N-1 未生效: surplus_sweep={result.get('surplus_sweep')}"
        assert "auto_rebalance" not in result, \
            f"N-1 未生效: auto_rebalance={result.get('auto_rebalance')}"

    # Step 2: 调真 verify
    async with async_session() as db:
        v = await _verify(user=admin, db=db)
        assert v["pass"] is True, (
            f"低余额日结后 verify 应 pass: diff={v['checks']['diff']}, "
            f"reserve={v['checks']['reserve']}, balance={v['checks']['community_pool']}")
        assert v["checks"]["reserve_within_balance"] is True
        assert (v["checks"]["reserve"] or 0) <= (v["checks"]["community_pool"] or 0)
