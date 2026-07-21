"""OP Chain scanner — polls Transfer events, matches to DepositIntent, auto-credits NT.

ponytail: single file, no framework, read-only chain. Requires web3.py.
Skipped silently when env vars not configured.
"""
import os
import asyncio
import json
from datetime import datetime, timezone
from web3 import Web3

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

_scan_state_file = os.path.join(os.path.dirname(__file__), "last_scanned_block.txt")


def _read_last_block() -> int | None:
    try:
        with open(_scan_state_file, "r") as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return None


def _write_last_block(block: int):
    with open(_scan_state_file, "w") as f:
        f.write(str(block))


class ChainScanner:
    """Background chain scanner. Start/stop via FastAPI lifespan."""

    def __init__(self, db_factory):
        if not RPC_URL or not NT_TOKEN or not PLATFORM_WALLET:
            raise ValueError("OP_RPC_URL, NT_TOKEN_CONTRACT, PLATFORM_WALLET_ADDRESS must all be set")
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.contract = self.w3.eth.contract(
            address=self.w3.to_checksum_address(NT_TOKEN),
            abi=json.loads(ERC20_ABI)
        )
        self.platform = self.w3.to_checksum_address(PLATFORM_WALLET)
        self.db_factory = db_factory
        self._running = False
        self._failures = 0

    async def start(self):
        print(f"[scanner] started RPC={RPC_URL[:40]}... interval={SCAN_INTERVAL}s")
        self._running = True
        while self._running:
            try:
                await self._scan_cycle()
                self._failures = 0
            except Exception as e:
                self._failures += 1
                print(f"[scanner] cycle failed (consecutive={self._failures}): {e}")
            await asyncio.sleep(SCAN_INTERVAL)

    async def stop(self):
        self._running = False

    async def _scan_cycle(self):
        last_block = _read_last_block()
        current_block = self.w3.eth.block_number

        if last_block is None:
            last_block = current_block - START_BLOCKS_BACK
        if current_block <= last_block:
            return

        # Batch size: 100 blocks (public RPC limit; increase to 2000 for Alchemy/Infura)
        CHUNK = 100
        from_block = last_block + 1
        to_block = min(from_block + CHUNK - 1, current_block)

        try:
            logs = self.w3.eth.get_logs({
                "address": self.contract.address,
                "topics": [TRANSFER_TOPIC, None, f"0x000000000000000000000000{self.platform[2:].lower()}"],
                "fromBlock": from_block,
                "toBlock": to_block,
            })
        except Exception:
            print(f"[scanner] get_logs failed ({from_block}-{to_block}), retry next cycle")
            return

        async with self.db_factory() as db:
            for log in logs:
                try:
                    await self._process_log(db, log)
                    await db.commit()
                except Exception as e:
                    await db.rollback()
                    print(f"[scanner] log process failed: {e}")

        _write_last_block(to_block)
        if logs:
            print(f"[scanner] blocks {from_block}-{to_block}: {len(logs)} transfer(s)")

    async def _process_log(self, db, log):
        from sqlalchemy import select
        from models import User, NTLedger, DepositIntent, CommunityPool

        # Decode Transfer event
        try:
            decoded = self.contract.events.Transfer().process_log(log)
            args = decoded["args"]
            to_addr = args["to"]
            from_addr = args["from"]
            amount = args["value"] // 10**18  # NT has 18 decimals
        except Exception:
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

        # Match user by wallet_address (case-insensitive)
        from sqlalchemy import func
        user_result = await db.execute(
            select(User).where(func.lower(User.wallet_address) == from_addr.lower())
        )
        user = user_result.scalar_one_or_none()
        if not user:
            print(f"[scanner] unknown wallet {from_addr} amount={amount} tx={tx_hash[:16]}...")
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

        # Update CommunityPool
        pool = (await db.execute(select(CommunityPool).limit(1))).scalar_one_or_none()
        if pool:
            pool.total_issued += amount

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

        print(f"[scanner] credited user_id_hex={user.id.encode('utf-8').hex()} amount={amount} tx={tx_hash[:16]}...")


def _scanner_singleton(db_factory):
    """Get scanner singleton. Returns None if env vars not configured."""
    if not RPC_URL or not NT_TOKEN or not PLATFORM_WALLET:
        print("[scanner] env vars not set, skipping chain scan")
        return None
    return ChainScanner(db_factory)
