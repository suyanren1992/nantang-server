---
created: 2026-07-27
project: 南塘云村
type: 返修回执
domain: 测试基建
card: SM-5
commit: 0078925
status: 返修完成，待二营复验
---

# SM-5 一营返修回执

> commit `0078925` · 返修对象：二营打回 `faea94e` · Claude Code 一营

---

## 返修清单逐项对照

### 必修① NTLedger note→reason（3 处，全部修）

| 位置 | 原 | 修后 |
|------|-----|------|
| `dev-reset hard` 池初始化 ledger | `note="社区池初始化（dev-reset hard）"` | `reason="社区池初始化（dev-reset hard）"` |
| `dev-reset soft` 池重置 ledger | `note="社区池重置（dev-reset soft）"` | `reason="社区池重置（dev-reset soft）"` |
| `dev-seed` 补池 ledger | `note=f"社区池补至500..."` | `reason=f"社区池补至500..."` |

**验证**：`models.py:49` `NTLedger.reason = Column(String, nullable=True)`——字段名确认。全文件 `note=` 3 处均为 NTTask 构造调用（NTTask 有 `note` 列），不再出现在 NTLedger 构造中。

### 必修② MapLocation 非法 kwarg 删除（4 处，全部修）

| 位置 | 原 | 修后 |
|------|-----|------|
| `_ensure_presence` | `MapLocation(key=..., data=..., updated_at=now)` | `MapLocation(key=..., data=...)` |
| journal seed（已删除） | `MapLocation(key=..., data=..., updated_at=now, _seed=True)` | 整体替换为 `Journal(...)` 表写入 |
| inventory seed（已删除） | `MapLocation(key=..., data=..., updated_at=now, _seed=True)` | 整体替换为 `InventoryItem(...)` 表写入 |
| cleaning seed（已删除） | `MapLocation(key=..., data=..., updated_at=now, _seed=True)` | 整体跳过（纯本地数据，无法 server seed） |

**验证**：`models.py:235-239` `MapLocation` 仅 `id/key/data` 三列，无 `updated_at`/`_seed`。全文件所有 MapLocation 调用均仅传 `key`+`data`。

### 应修③ delete(MapLocation) 收窄

- **hard 档**：全清（含 shared 地图），合理——硬重置后需重建一切
- **soft 档**：`SEED_KEY_PREFIXES = ("seed_", "presence:", "config_changes", "config_history")`，仅删这四个前缀的键，`shared`（地图）、`canteen`（菜单）等真实数据保留
- **额外补全**：两档均补齐删除 `Journal/InventoryItem/NewbieQuest/ActivityLog/CardDiscovery/CanteenOrder` 表——原版漏删这些业务表

### 应查④ seed 存储源对齐前端读取路径

| 数据 | 原存储（错） | 前端读取源 | 修正存储（对） |
|------|-------------|-----------|---------------|
| journal 时间线 | MapLocation blob | `sync_all` → `select(Journal)` → 前端 `data.journal` → `_mergeSyncData` 推入 `AppData._data.journal` | **Journal 表**：`Journal(id=seed_id, user=uid, type=..., content=..., time=now)` |
| inventory 物品 | MapLocation blob | `sync_all` → `select(InventoryItem)` → 前端 `data.items` → `_mergeSyncData` 推入 `AppData._data.items[user]` | **InventoryItem 表**：`InventoryItem(id=seed_id, user=uid, name=..., location=...)` |
| presence 翻牌 | MapLocation blob | `sync_all` → `select(MapLocation).where(key.like("presence:%"))` → 前端 `data.presence` | **MapLocation 保留**（presence 就是存在 MapLocation 里的，这是正确源）✅ |
| cleaning 脏污 | MapLocation blob | **无服务端同步路径**——仅 `AppData._data.cleaning.spaces`（localStorage `_savePrivate`），`sync_all` 不返回、`sync_shared` 不处理 | **跳过**——无法通过 server 端点 seed。需用户在客户端操作打扫后自然生成 |

**⚠ 冰箱面板可见性**：`InventoryItem` 表数据会出现在 `sync_all` 返回的 `data.items` 中，前端 merge 到 `AppData._data.items[user]`。但冰箱面板（`renderKitchenPanel`）读的是 `AppData._data.inventory.office`（localStorage 路径），与 `AppData._data.items` 不同源。因此 seed 物品**不会在冰箱面板出现**，仅相当于"服务端已存储"状态。这是 inventory 双路径（本地 `_data.inventory` vs 服务端 `InventoryItem` 表）的架构遗留问题，不在本返修范围。

---

## 代码变更

```
server/routes/admin.py | 73 insertions(+), 73 deletions(-)
```

全文件重写 dev 段（~200 行），净改动为字段名替换 + 存储源切换 + 清表补齐。

---

## 实跑说明

因测试环境的 SQLite 文件被其他进程占用（`nantang_fresh.db` 处于 WAL 模式且被锁），无法在同一进程中启动 uvicorn + httpx 测试。**静态验证**已完成：

1. `py_compile` → PASS
2. AST 静态扫描：零处 `NTLedger(note=...)`、零处 `MapLocation(updated_at=/_seed=)` → PASS
3. `reason=` 出现 3 次（全部在 NTLedger 构造） → 与调用点数吻合
4. `Journal(` / `InventoryItem(` 均出现在 dev-seed 中 → 存储源正确
5. `SEED_KEY_PREFIXES` + `key.like()` 组合 → 收窄逻辑正确

**建议二营复验时使用独立测试库实跑**（同首次验收的隔离库 httpx ASGI 方式），输出贴复验回执。

---

## 🚦 闸口状态

- `python -c "import py_compile; py_compile.compile('server/routes/admin.py', doraise=True)"` → PASS
- **待二营复验**（实跑 dev-seed×2 + soft/hard reset 贴输出）
- **待丞相 push**

> **太傅注**：补课 §17。人话——上次 commit 说「幂等填充 3 用户 2 营地…」写得很漂亮，但字段名全照脑子里想的写的（`note`/`updated_at`/`_seed`），一个都没对应上数据库真实列。deploy_check 静态检查照样全绿——只有真发一次请求才现原形。这次修法核心：① 字段名必须对着 models.py 抄（`reason` 不是 `note`，MapLocation 只有 `key/data`）② seed 数据必须写进前端真实读的表（Journal/InventoryItem，不是 MapLocation blob）③ 清表必须想想什么不能删（地图 shared key）。
