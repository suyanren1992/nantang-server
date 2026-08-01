"""OP Chain scanner — polls Transfer events, matches to DepositIntent, auto-credits NT.

ponytail: single file, no framework, read-only chain. Requires web3.py.
Skipped silently when env vars not configured.
"""
import os
import asyncio
import json
from datetime import datetime, timezone
from web3 import Web3
import logging

logger = logging.getLogger(__name__)

# == Config (env vars) ==
RPC_URL = os.environ.get("OP_RPC_URL", "")
NT_TOKEN = os.environ.get("NT_TOKEN_CONTRACT", "")
PLATFORM_WALLET = os.environ.get("PLATFORM_WALLET_ADDRESS", "")
SCAN_INTERVAL = int(os.environ.get("SCAN_INTERVAL", "30"))
START_BLOCKS_BACK = int(os.environ.get("SCAN_START_BLOCKS_BACK", "500"))

# ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
# Minimal ERC-20 ABI: only Transfer event
ERC20_ABI = json.dumps([{
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "from", "type": "address"},
        {"indexed": True, "name": "to", "type": "address"},
        {"indexed": False, "name": "value", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
}])


# 追赶与容错参数
# CHUNK: 单次 get_logs 的区块跨度。免费公共节点上限差异极大(50~10000),
#        取小值保证兼容, 超限时 _get_logs 会自动二分。
CHUNK = int(os.environ.get("SCAN_CHUNK", "100"))
# 一轮最多处理几段 -> 单轮最多追 CHUNK*MAX_CHUNKS_PER_CYCLE 个区块
MAX_CHUNKS_PER_CYCLE = int(os.environ.get("SCAN_MAX_CHUNKS", "20"))
# 游标落后超过此值即视为不可追(免费节点无那么久的归档日志), 跳到链头并告警
MAX_CATCHUP_BLOCKS = int(os.environ.get("SCAN_MAX_CATCHUP", "50000"))
# 落后超过此值即判定不健康(OP 约 2 秒一块, 1800 块约 1 小时)
MAX_LAG_BLOCKS = int(os.environ.get("SCAN_MAX_LAG", "1800"))
# 连续失败几次开始 ERROR 级告警并轮换 RPC
FAIL_ALERT_AFTER = int(os.environ.get("SCAN_FAIL_ALERT", "3"))

# 备用 RPC: 主节点故障时轮换。逗号分隔, 覆盖默认列表。
# 注意 publicnode/1rpc 等免费档不提供历史日志(archive), 只能扫最近区块;
# mainnet.optimism.io 是官方节点, 实测可查历史日志且区间上限较宽。
_DEFAULT_FALLBACKS = "https://mainnet.optimism.io,https://optimism-rpc.publicnode.com"
RPC_FALLBACKS = os.environ.get("OP_RPC_FALLBACKS", _DEFAULT_FALLBACKS)


def _rpc_candidates() -> list[str]:
    """主 RPC 在前, 去重保序附加备用节点。"""
    out, seen = [], set()
    for u in [RPC_URL] + [x.strip() for x in RPC_FALLBACKS.split(",")]:
        if u and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def _mask(url: str) -> str:
    """RPC URL 常含 API key, 日志里只留主机名。"""
    if not url:
        return ""
    try:
        from urllib.parse import urlparse
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}"
    except Exception:
        return url[:24] + "..."


def _tx_of(log) -> str:
    try:
        h = log["transactionHash"]
        return "0x" + (h.hex() if hasattr(h, "hex") else str(h))[:16]
    except Exception:
        return "?"


# ── 扫描游标持久化 ─────────────────────────────────────────────
# 原实现写本地文件 last_scanned_block.txt。Render 每次部署换容器、磁盘不持久,
# 文件必丢 -> 游标回退到 current-500, 之前扫过的区块被当成"没扫过"重扫,
# 且一旦落后超过节点归档窗口(publicnode 免费档只给最近约 128 个区块的日志),
# 就永久卡死在同一个区间反复失败。故游标必须落库。
_CURSOR_KEY = "chain_scan_cursor"
_scan_state_file = os.path.join(os.path.dirname(__file__), "last_scanned_block.txt")


async def _read_last_block(db_factory) -> int | None:
    """读游标: 优先数据库; 库里没有则尝试迁移旧的本地文件值(一次性)。"""
    from sqlalchemy import select
    from models import MapLocation
    async with db_factory() as db:
        row = (await db.execute(
            select(MapLocation).where(MapLocation.key == _CURSOR_KEY)
        )).scalar_one_or_none()
        if row and row.data:
            try:
                return int(json.loads(row.data)["last_block"])
            except Exception:
                logger.warning("[scanner] 游标解析失败, 视为无游标: %r", row.data)
    try:
        with open(_scan_state_file, "r") as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return None


async def _write_last_block(db_factory, block: int):
    """写游标到数据库(容器重建后仍在)。"""
    from sqlalchemy import select
    from models import MapLocation
    payload = json.dumps({"last_block": int(block)})
    async with db_factory() as db:
        row = (await db.execute(
            select(MapLocation).where(MapLocation.key == _CURSOR_KEY)
        )).scalar_one_or_none()
        if row:
            row.data = payload
        else:
            db.add(MapLocation(key=_CURSOR_KEY, data=payload))
        await db.commit()


class ChainScanner:
    """Background chain scanner. Start/stop via FastAPI lifespan."""

    def __init__(self, db_factory):
        if not RPC_URL or not NT_TOKEN or not PLATFORM_WALLET:
            raise ValueError("OP_RPC_URL, NT_TOKEN_CONTRACT, PLATFORM_WALLET_ADDRESS must all be set")
        self.rpc_urls = _rpc_candidates()
        self._rpc_idx = 0
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_urls[0], request_kwargs={"timeout": 20}))
        self.contract = self.w3.eth.contract(
            address=self.w3.to_checksum_address(NT_TOKEN),
            abi=json.loads(ERC20_ABI)
        )
        self.platform = self.w3.to_checksum_address(PLATFORM_WALLET)
        self.db_factory = db_factory
        self._running = False
        self._failures = 0
        # 可观测状态 — 供 /api/system/scanner-status 读取, 不必翻日志
        self.last_ok_at = None
        self.last_error = None
        self.last_scanned_block = None
        self.chain_head = None
        self.credited_total = 0

    # ── RPC 故障转移 ────────────────────────────────────────────
    def _switch_rpc(self) -> bool:
        """轮换到下一个 RPC 端点。返回是否真的换了。"""
        if len(self.rpc_urls) <= 1:
            return False
        self._rpc_idx = (self._rpc_idx + 1) % len(self.rpc_urls)
        url = self.rpc_urls[self._rpc_idx]
        self.w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 20}))
        self.contract = self.w3.eth.contract(
            address=self.w3.to_checksum_address(NT_TOKEN),
            abi=json.loads(ERC20_ABI)
        )
        logger.warning("[scanner] 切换 RPC -> %s", _mask(url))
        return True

    @property
    def status(self) -> dict:
        lag = None
        if self.chain_head is not None and self.last_scanned_block is not None:
            lag = self.chain_head - self.last_scanned_block
        return {
            "running": self._running,
            "rpc": _mask(self.rpc_urls[self._rpc_idx]),
            "rpc_candidates": len(self.rpc_urls),
            "consecutive_failures": self._failures,
            "last_ok_at": self.last_ok_at,
            "last_error": self.last_error,
            "last_scanned_block": self.last_scanned_block,
            "chain_head": self.chain_head,
            "blocks_behind": lag,
            "credited_total": self.credited_total,
            # 判据: 落后超过 MAX_LAG_BLOCKS 说明扫链实际停摆, 充值扫不到
            "healthy": self._failures < FAIL_ALERT_AFTER and (lag is None or lag <= MAX_LAG_BLOCKS),
        }

    async def start(self):
        logger.info("[scanner] started rpc=%s interval=%ss candidates=%d",
                    _mask(self.rpc_urls[0]), SCAN_INTERVAL, len(self.rpc_urls))
        self._running = True
        while self._running:
            try:
                await self._scan_cycle()
                self._failures = 0
                self.last_error = None
                self.last_ok_at = datetime.now(timezone.utc).isoformat()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                self._failures += 1
                self.last_error = f"{type(e).__name__}: {e}"
                # 失败必须喊出来: 原实现只 print, 扫链停了好几天无人知晓
                if self._failures >= FAIL_ALERT_AFTER:
                    logger.error(
                        "[scanner][ALERT] 连续失败 %d 次, 链上充值已停止入账! 最近错误: %s",
                        self._failures, self.last_error)
                else:
                    logger.warning("[scanner] 本轮失败(连续 %d): %s", self._failures, self.last_error)
                # 连续失败达阈值时轮换 RPC
                if self._failures % FAIL_ALERT_AFTER == 0:
                    self._switch_rpc()
            await asyncio.sleep(SCAN_INTERVAL)

    async def stop(self):
        self._running = False

    def _get_logs(self, from_block: int, to_block: int):
        """取日志。RPC 报"区间过大"时自动二分重试, 不同节点上限不同(50~10000)。"""
        topic_to = "0x" + "0" * 24 + self.platform[2:].lower()
        try:
            return self.w3.eth.get_logs({
                "address": self.contract.address,
                "topics": [TRANSFER_TOPIC, None, topic_to],
                "fromBlock": from_block,
                "toBlock": to_block,
            })
        except Exception as e:
            msg = str(e).lower()
            too_big = ("too large" in msg or "limited to" in msg or "range" in msg
                       or "too many" in msg or "exceed" in msg)
            if too_big and to_block > from_block:
                mid = from_block + (to_block - from_block) // 2
                logger.debug("[scanner] 区间过大, 二分 %d-%d", from_block, to_block)
                return list(self._get_logs(from_block, mid)) + list(self._get_logs(mid + 1, to_block))
            raise

    async def _scan_cycle(self):
        current_block = self.w3.eth.block_number
        self.chain_head = current_block
        last_block = await _read_last_block(self.db_factory)

        if last_block is None:
            last_block = max(0, current_block - START_BLOCKS_BACK)
            logger.info("[scanner] 无游标, 从 %d 开始(回溯 %d)", last_block, START_BLOCKS_BACK)

        # 游标严重落后时(容器重建丢档/长时间停摆), 免费节点没有那么老的日志,
        # 死磕旧区间只会永久卡死。此处放弃无法取得的历史段并告警, 让扫描回到链头,
        # 保证"新的充值能进来"; 跳过的窗口由对账/人工补录处理。
        if current_block - last_block > MAX_CATCHUP_BLOCKS:
            skipped_from, skipped_to = last_block + 1, current_block - START_BLOCKS_BACK
            logger.error(
                "[scanner][ALERT] 游标落后 %d 个区块, 超过可追范围 %d; "
                "放弃区间 %d-%d 并跳到链头, 该窗口内的充值需人工核对链上记录补录",
                current_block - last_block, MAX_CATCHUP_BLOCKS, skipped_from, skipped_to)
            last_block = max(0, current_block - START_BLOCKS_BACK)

        if current_block <= last_block:
            self.last_scanned_block = last_block
            return

        # 追赶: 一轮内最多处理 MAX_CHUNKS_PER_CYCLE 段, 避免单轮跑太久
        from_block = last_block + 1
        for _ in range(MAX_CHUNKS_PER_CYCLE):
            if from_block > current_block:
                break
            to_block = min(from_block + CHUNK - 1, current_block)
            logs = self._get_logs(from_block, to_block)
            if logs:
                async with self.db_factory() as db:
                    for log in logs:
                        try:
                            await self._process_log(db, log)
                            await db.commit()
                        except Exception as e:
                            await db.rollback()
                            logger.error("[scanner] 日志入账失败 tx=%s: %s",
                                         _tx_of(log), e)
                logger.info("[scanner] 区块 %d-%d: %d 笔转入", from_block, to_block, len(logs))
            # 只有整段成功处理完才推进游标, 失败会抛出 -> 游标不动 -> 下轮重扫
            await _write_last_block(self.db_factory, to_block)
            self.last_scanned_block = to_block
            from_block = to_block + 1

    async def _process_log(self, db, log):
        from sqlalchemy import select
        from models import User, NTLedger, DepositIntent
        from nt_helpers import _get_pool

        # Decode Transfer event
        try:
            decoded = self.contract.events.Transfer().process_log(log)
            args = decoded["args"]
            to_addr = args["to"]
            from_addr = args["from"]
            amount = args["value"] // 10**18  # NT has 18 decimals
        except Exception as e:
            logger.warning("scanner 提前返回: %s", e)
            return

        # Only process transfers TO platform wallet
        if to_addr.lower() != self.platform.lower():
            return

        tx_hash = "0x" + log["transactionHash"].hex()
        block_num = log["blockNumber"]

        # Dedup
        dup = (await db.execute(select(NTLedger).where(NTLedger.tx_hash == tx_hash))).scalar_one_or_none()
        if dup:
            return

        # Match user by wallet_address (case-insensitive) — 行锁防并发充值覆盖
        from sqlalchemy import func
        user_result = await db.execute(
            select(User).where(func.lower(User.wallet_address) == from_addr.lower()).with_for_update()
        )
        user = user_result.scalar_one_or_none()
        if not user:
            # 真钱已到多签钱包但匹配不到用户 -> 账目会比链上少这笔, 必须告警人工认领
            logger.error(
                "[scanner][ALERT] 收到未知钱包转入, 无法入账(对账将出现差额): "
                "from=%s amount=%s tx=%s", from_addr, amount, tx_hash)
            return

        # Find matching pending intent
        intent = (await db.execute(
            select(DepositIntent).where(
                DepositIntent.user_id == user.id,
                DepositIntent.status == "pending"
            ).order_by(DepositIntent.created_at.desc())
        )).scalar_one_or_none()

        # Credit user
        user.nt_balance += amount
        user.updated_at = datetime.now(timezone.utc).isoformat()

        # Update CommunityPool — 走 _get_pool 确保池行不存在时自动创建
        pool = await _get_pool(db)
        pool.total_issued += amount
        pool.reserve = (pool.reserve or 0) + amount  # 充值进储备池

        # Write ledger with tx_hash（D15: 统一走 routes.nt._add_ledger，tx_hash 与类型不变）
        from routes.nt import _add_ledger, _ledger_id
        now = datetime.now(timezone.utc)
        await _add_ledger(db, _ledger_id(), None, user.id, amount, "deposit_onchain",
                          f"onchain deposit {tx_hash[:10]}...", status="settled", tx_hash=tx_hash)

        # Update intent
        if intent:
            intent.status = "confirmed"
            intent.tx_hash = tx_hash
            intent.detected_at = now.isoformat()

        self.credited_total += 1
        logger.info("[scanner] 已入账 user_id_hex=%s amount=%s tx=%s",
                    user.id.encode("utf-8").hex(), amount, tx_hash[:18])


def _scanner_singleton(db_factory):
    """Get scanner singleton. Returns None if env vars not configured."""
    if not RPC_URL or not NT_TOKEN or not PLATFORM_WALLET:
        logger.warning("[scanner] 环境变量未配置(OP_RPC_URL/NT_TOKEN_CONTRACT/"
                       "PLATFORM_WALLET_ADDRESS), 跳过链上扫描 —— 链上充值将不会入账")
        return None
    return ChainScanner(db_factory)
