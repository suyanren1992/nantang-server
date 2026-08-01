"""SCAN-FIX: 扫链器容错与可观测性。

生产事故: 日志每 30 秒一次
    [scanner] get_logs failed (154519032-154519131), retry next cycle
持续数日无人发现 -> 链上充值完全停摆。

实测定根因(两层):
  ① 游标落在本地文件 last_scanned_block.txt, Render 重部换容器即丢,
     游标回退后反复重扫同一旧区间;
  ② 旧区间已超出免费节点的归档窗口(实测 publicnode 历史日志返
     "Archive requests require a personal token"), 永远取不到 -> 死循环。
放大器: 失败只 print, 无告警无状态端点。
"""
import asyncio
import pytest

import chain_scanner as CS


def test_cursor_not_stored_on_local_disk_only():
    """游标必须落库 — 容器重建后仍在(事故根因①回归)。"""
    import inspect
    src = inspect.getsource(CS)
    assert "_CURSOR_KEY" in src, "游标未落库"
    # 读写游标必须是 async(走数据库)
    assert inspect.iscoroutinefunction(CS._read_last_block)
    assert inspect.iscoroutinefunction(CS._write_last_block)


def test_get_logs_splits_on_range_too_large():
    """真判据: 节点报"区间过大"时必须自动二分, 而不是整轮放弃。

    不同免费节点上限 50~10000 差异极大(实测),
    写死 CHUNK 必在某些节点上全部失败。
    """
    sc = CS.ChainScanner.__new__(CS.ChainScanner)
    sc.platform = "0x" + "ab" * 20
    calls = []

    class FakeEth:
        def get_logs(self, params):
            f, t = params["fromBlock"], params["toBlock"]
            calls.append((f, t))
            if t - f > 24:   # 模拟节点上限 25 块
                raise Exception("Block range is too large")
            return [f"log{f}"]

    class FakeW3:
        eth = FakeEth()

    sc.w3 = FakeW3()
    sc.contract = type("C", (), {"address": "0x" + "cd" * 20})()

    logs = sc._get_logs(0, 99)
    assert len(logs) > 1, f"未二分, calls={calls}"
    assert all(t - f <= 24 for f, t in calls if t - f <= 24)
    # 每一层都应最终落到 <=24 的区间且全覆盖 0..99
    ok = [(f, t) for f, t in calls if t - f <= 24]
    assert min(f for f, _ in ok) == 0 and max(t for _, t in ok) == 99


def test_get_logs_reraises_non_range_errors():
    """非"区间过大"的错(如鉴权失败)不得被当成区间问题无限二分。"""
    sc = CS.ChainScanner.__new__(CS.ChainScanner)
    sc.platform = "0x" + "ab" * 20

    class FakeEth:
        def get_logs(self, params):
            raise Exception("Archive requests require a personal token")

    sc.w3 = type("W", (), {"eth": FakeEth()})()
    sc.contract = type("C", (), {"address": "0x" + "cd" * 20})()
    with pytest.raises(Exception, match="Archive"):
        sc._get_logs(0, 99)


def test_status_reports_unhealthy_when_lagging():
    """落后太多必须报 healthy=false — 充值实际停摆的判据。"""
    sc = CS.ChainScanner.__new__(CS.ChainScanner)
    sc.rpc_urls = ["https://example.org/rpc"]
    sc._rpc_idx = 0
    sc._running = True
    sc._failures = 0
    sc.last_ok_at = None
    sc.last_error = None
    sc.credited_total = 0

    sc.chain_head = 1_000_000
    sc.last_scanned_block = 1_000_000 - (CS.MAX_LAG_BLOCKS + 1)
    st = sc.status
    assert st["blocks_behind"] == CS.MAX_LAG_BLOCKS + 1
    assert st["healthy"] is False, "严重落后却报健康 = 假绿灯"

    sc.last_scanned_block = 1_000_000
    assert sc.status["healthy"] is True


def test_status_unhealthy_on_consecutive_failures():
    sc = CS.ChainScanner.__new__(CS.ChainScanner)
    sc.rpc_urls = ["https://example.org/rpc"]
    sc._rpc_idx = 0
    sc._running = True
    sc.last_ok_at = None
    sc.last_error = "boom"
    sc.credited_total = 0
    sc.chain_head = 100
    sc.last_scanned_block = 100
    sc._failures = CS.FAIL_ALERT_AFTER
    assert sc.status["healthy"] is False


def test_rpc_mask_hides_api_key():
    """RPC URL 常带 API key, 日志/端点不得泄露。"""
    masked = CS._mask("https://opt-mainnet.g.alchemy.com/v2/SECRETKEY123")
    assert "SECRETKEY123" not in masked
    assert "alchemy.com" in masked


def test_rpc_candidates_dedup_and_primary_first():
    cands = CS._rpc_candidates()
    assert len(cands) == len(set(cands)), "备用节点未去重"
    if CS.RPC_URL:
        assert cands[0] == CS.RPC_URL, "主节点必须在前"


def test_no_silent_print_in_scanner():
    """放大器回归: 扫链器不得再用 print 当告警。"""
    src = io_read()
    assert "print(" not in src, "扫链器里仍有 print, 告警会被埋掉"
    assert "logger.error" in src, "无 ERROR 级告警"


def test_unknown_wallet_is_alerted_not_swallowed():
    """未知钱包转入 = 真钱进了多签但认不到人, 必造成对账差额, 必告警。"""
    src = io_read()
    i = src.index("unknown") if "unknown" in src else -1
    assert "未知钱包转入" in src or i >= 0
    # 必须是 ERROR 而非 print/debug
    seg = src[src.index("if not user:"):]
    seg = seg[:400]
    assert "logger.error" in seg, f"未知钱包未告警: {seg[:200]}"


def test_catchup_skips_unreachable_history_and_alerts(monkeypatch):
    """游标远远落后时必须跳到链头, 否则永久卡死(事故根因②回归)。"""
    sc = CS.ChainScanner.__new__(CS.ChainScanner)
    sc.platform = "0x" + "ab" * 20
    sc.contract = type("C", (), {"address": "0x" + "cd" * 20})()
    sc.credited_total = 0
    sc.last_scanned_block = None
    sc.chain_head = None
    HEAD = 154_982_000
    STALE = HEAD - 463_000          # 生产实际落后量

    class FakeEth:
        block_number = HEAD
        def get_logs(self, params):
            # 归档窗口外就报鉴权错(真实节点行为)
            if params["fromBlock"] < HEAD - 10_000:
                raise Exception("Archive requests require a personal token")
            return []

    sc.w3 = type("W", (), {"eth": FakeEth()})()

    written = []
    async def fake_read(_f): return STALE
    async def fake_write(_f, b): written.append(b)
    monkeypatch.setattr(CS, "_read_last_block", fake_read)
    monkeypatch.setattr(CS, "_write_last_block", fake_write)

    class DummyDB:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
    sc.db_factory = lambda: DummyDB()

    asyncio.get_event_loop_policy().new_event_loop().run_until_complete(sc._scan_cycle())
    assert written, "游标未推进 -> 仍会卡在旧区间"
    assert min(written) > STALE + 1, "仍在死磕不可达的历史区间"
    assert min(written) >= HEAD - CS.START_BLOCKS_BACK - 1


def io_read():
    import inspect
    return inspect.getsource(CS)
