---
created: 2026-07-27
project: 南塘云村
type: 回执
domain: 测试基建
card: SM-5
kind: 二营施工回执（席位互换首案）
---

# SM-5 · 二营施工回执（席位互换首案）

> 依据：席位互换裁定（砚仁 02:20 准，BUG_TRACKER 已入档）——本轮 SM-5 二营施工、一营验收。
> 施工文件：`server/routes/admin.py`（单文件，未碰其余业务逻辑）。
> 纪律：字段名/类名对着 `models.py` 抄；不碰 withdraw/资金发放路径；不 push。

## 一、返修五条逐条对照

### ① Journal 去掉 id 让自增；幂等改按 user+type+content 查重 ✅
- `models.py:150` 实为 `id = Column(Integer, primary_key=True, autoincrement=True)`——字符串主键塞不进整数列（前两轮 500 根因之一）。
- `dev-seed` 内 `_add_journal`：删 `jid=_seed_id(...)` 与 `Journal(id=jid, ...)`，改 `Journal(user=..., type=..., content=..., time=now)`（不再指定 id，交给自增）。
- 幂等查重从 `Journal.id == jid` 改为 `Journal.user == uid AND type == jtype AND content == content`——同一条时间线重复点不再新增。

### ② CanteenOrder → MealOrder ✅
- `models.py` 只有 `MealOrder`（:224，表 `meal_orders`）+ `CanteenMenu`（:216），无 `CanteenOrder` 类（前两轮 500 根因之二：import 不存在的类）。
- `admin.py:116` import 改 `CanteenOrder` → `MealOrder`。
- `admin.py:127`（hard 档）、`:151`（soft 档）两处 `delete(CanteenOrder)` → `delete(MealOrder)`。

### ③ SEED_KEY_PREFIXES 的 config_changes/config_history 移出 soft 档 ✅
- `admin.py:108`：`("seed_", "presence:", "config_changes", "config_history")` → `("seed_", "presence:")`。
- 理由：公约历史（config_changes/config_history）是宪法级历史留痕，非 seed 数据，soft 重置不应连带清除。

### ④ 冰箱 seed 已删（卡面 v1.2）✅ + 前端读取源结论
- `dev-seed` 内 `_add_inv` 整块（5 件物品）删除，dev-seed 的 `InventoryItem` import 一并移除（不再使用）。
- **前端读取源结论**：冰箱面板读 `localStorage`（`AppData._data.inventory.office`），**不读** `InventoryItem` 表；服务端 seed 写进 `InventoryItem` 表也不会出现在冰箱 UI（不同源）。故卡面 v1.2 改为真机手动录入 1 件验证录入链路。
- 注意：`dev-reset`（soft/hard）仍保留 `delete(InventoryItem)`——重置本就该清该表，与 seed 删除不矛盾。

### ⑤【硬性】交付前真跑 ✅（终端输出原样贴下方第二节）

## 二、真跑终端输出（原样粘贴，非静态扫描）

环境：工作区 venv（fastapi/httpx/sqlalchemy/aiosqlite/jose/bcrypt），临时 SQLite 库，`DEV_TOOLS_ENABLED=true`，admin 用户 + JWT。

```
===== dev-seed #1 =====
status: 200
{'ok': True, 'created': ['user:测试甲', 'user:测试乙', 'user:测试丙', 'camp:第四期共创营', 'camp:夏季写生周', 'task:个人', 'task:营队', 'task:社区', 'vfy:pending', 'presence:测试甲', 'presence:测试乙', 'journal:测试甲/cleaning', 'journal:测试乙/cooking', 'journal:测试甲/register', 'pool:+500->500'], 'ts': '2026-07-26T18:28:53.245551'}
counts: {'User': 4, 'Journal': 3, 'NTTask': 3, 'Camp': 2, 'Verification': 1, 'MapLocation': 2, 'InventoryItem': 0}
===== dev-seed #2 (idempotent) =====
status: 200
{'ok': True, 'created': [], 'ts': '2026-07-26T18:28:53.528519'}
counts: {'User': 4, 'Journal': 3, 'NTTask': 3, 'Camp': 2, 'Verification': 1, 'MapLocation': 2, 'InventoryItem': 0}
IDEMPOTENT count unchanged: True
===== dev-reset soft =====
status: 200
{'ok': True, 'mode': 'soft', 'ts': '2026-07-26T18:28:53.763932'}
counts: {'User': 4, 'Journal': 0, 'NTTask': 0, 'Camp': 0, 'Verification': 0, 'MapLocation': 0, 'InventoryItem': 0} | users kept: 4 | pool.balance: 500
===== dev-reset hard =====
status: 200
{'ok': True, 'mode': 'hard', 'ts': '2026-07-26T18:28:53.790917'}
counts: {'User': 0, 'Journal': 0, 'NTTask': 0, 'Camp': 0, 'Verification': 0, 'MapLocation': 0, 'InventoryItem': 0} | users cleared: 0 | pool.balance: 500
```

结论逐项判据：
- dev-seed×2：两次 status=200，第二次 `created=[]`，七表 count 完全一致 → **幂等 count 不增 ✅**
- soft：status=200，User 保留 4（admin+3 seed 用户），业务表全清，pool.balance=500 ✅
- hard：status=200，User=0（全清需重注册），pool.balance=500（C-7 初始化）✅
- InventoryItem 全程 0（冰箱 seed 已删）✅
- 全程无 500（前两轮 500 已消除）✅

## 三、deploy_check（真跑）

```
  语法检查            PASS
  ?v= 一致性         PASS
  环境变量            PASS
  启动冒烟            PASS
```

## 四、纪律自查

- 字段/类名对 `models.py` 逐一核对（User/Journal/NTTask/Camp/Verification/MealOrder/InventoryItem/CommunityPool）。
- 未碰 withdraw/资金发放路径（confirm_withdraw 等未动）。
- 仅改 `server/routes/admin.py` 一个文件；git status 见下。
- 不 push。

### git status（提交前自查）
- 变更文件：`server/routes/admin.py`（+13 / -23）
- 本回执：`方案/任务卡/SM-5_二营施工回执.md`
- 说明：工作树另有大量既存 doc 改动（与本卡无关，非本轮所改），未纳入本次 commit。

commit message：
`fix(SM-5二营施工): Journal自增+MealOrder+config移出soft——席位互换首案`
