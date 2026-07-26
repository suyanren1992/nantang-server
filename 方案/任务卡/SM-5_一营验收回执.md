---
created: 2026-07-27
project: 南塘云村
type: 回执
domain: 测试基建
card: SM-5
kind: 一营验收回执（席位互换——一营验收二营施工）
---

# SM-5 · 一营验收回执

> 依据：席位互换裁定（砚仁 02:20 准）——本轮 SM-5 二营施工、一营验收。
> 施工 commit：f45955b（二营，未 push）。
> 验收方法：逻辑关 diff 逐条核 + 实测关真跑 uvicorn（非 AST 静态扫描）。

---

## 一、逻辑关 —— diff 对照卡面 v1.2 + 五条返修清单逐条核

### ① Journal 去 id 自增 + user+type+content 三字段查重幂等 ✅

- `_add_journal` 删除了 `jid=_seed_id(...)` 与 `Journal(id=jid, ...)`，改为 `Journal(user=..., type=..., content=..., time=now)`，不指定 id 由自增生成。
- 幂等查重从 `Journal.id == jid`（字符串塞整数列 → 500）改为 `Journal.user == uid AND type == jtype AND content == content`。
- diff 确认：`:253-263` 整段正确。

### ② CanteenOrder → MealOrder 三处 ✅

| 位置 | 旧 | 新 |
|------|-----|-----|
| import (line 116) | `CanteenOrder` | `MealOrder` |
| hard delete (line 127) | `delete(CanteenOrder)` | `delete(MealOrder)` |
| soft delete (line 151) | `delete(CanteenOrder)` | `delete(MealOrder)` |

models.py 确认：`MealOrder` 类存在（:225, 表 `meal_orders`），无 `CanteenOrder` 类。

### ③ SEED_KEY_PREFIXES 收窄 ✅

`("seed_", "presence:", "config_changes", "config_history")` → `("seed_", "presence:")`。
config_changes/config_history 是公约宪法级留痕，已移出 soft 档保护。

### ④ _add_inv 整块 + InventoryItem import 删除 ✅

- dev-seed 的 `from models import Journal, InventoryItem` → `from models import Journal`。
- `_add_inv` 函数（~10 行）+ 5 条 `_add_inv(...)` 调用全部删除。
- `dev-reset`（soft/hard）仍保留 `delete(InventoryItem)`——重置本就该清该表，与 seed 删除正交。
- 注释说明前端冰箱面板读 localStorage，服务端 seed 无法填入。

### ⑤ 禁区核查：withdraw/confirm/reject 资金端点零改动 ✅

- `POST /api/admin/withdraw/confirm`（line 51-67）：未动。
- `POST /api/admin/withdraw/reject`（line 70-88）：未动。
- diff 确认零行变更。

---

## 二、实测关 —— 本地 uvicorn 隔离库真跑（原样输出）

环境：Python 3.14.6，临时 SQLite 库，`DEV_TOOLS_ENABLED=true`。

```
===== dev-seed #1 =====
status: 200
{
  "ok": true,
  "created": [
    "user:测试甲", "user:测试乙", "user:测试丙",
    "camp:第四期共创营", "camp:夏季写生周",
    "task:个人", "task:营队", "task:社区",
    "vfy:pending",
    "presence:测试甲", "presence:测试乙",
    "journal:测试甲/cleaning", "journal:测试乙/cooking", "journal:测试甲/register"
  ],
  "ts": "2026-07-26T18:44:05.728863"
}
counts: User=5 Journal=3 NTTask=3 Camp=2 Verification=1 InventoryItem=0 MapLocation=2
PASS dev-seed #1 — 200, created 非空

===== dev-seed #2 (idempotent) =====
status: 200
{"ok": true, "created": [], "ts": "2026-07-26T18:44:05.973603"}
counts: User=5 Journal=3 NTTask=3 Camp=2 Verification=1 InventoryItem=0 MapLocation=2
PASS dev-seed #2 — 幂等: created=[], 七表 count 不增

===== dev-reset soft =====
status: 200
{"ok": true, "mode": "soft", "ts": "2026-07-26T18:44:06.206358"}
counts: User=5 Journal=0 NTTask=0 Camp=0 Verification=0 InventoryItem=0 | pool.balance=500
PASS dev-reset soft — User保留(5), 业务表清, pool.balance=500

===== dev-reset hard =====
status: 200
{"ok": true, "mode": "hard", "ts": "2026-07-26T18:44:06.229421"}
counts: User=0 NTTask=0 Verification=0 | pool.balance=500
PASS dev-reset hard — User=0(全清), pool.balance=500

===== DEV_TOOLS_ENABLED 未设 =====
dev-reset -> 404 | dev-seed -> 404
PASS DEV_TOOLS_ENABLED 未设 → 两端点均 404

===== 非 admin 调用 =====
dev-reset -> 403 | dev-seed -> 403
PASS 非 admin → 两端点均 403
```

**ALL 6/6 PASS**。全程无 500。

---

## 三、机检关 —— deploy_check + ?v= 审计

```
  依赖对账            PASS
  ?v= 一致性         PASS
  环境变量            PASS
```

- deploy_check 三检全绿，无新增依赖告警。
- ?v= 审计：SM-5 纯服务端改动（`server/routes/admin.py`），零前端文件变更，零 `?v=` 变动。

---

## 四、真机关

留砚仁本人。真机验证清单：
- [ ] 浏览器登录 admin → 「我的」页底部可见 🧪 测试台区
- [ ] [🔄 重置数据] → 选软/硬档 → 行为与上述实测一致
- [ ] [📥 一键填充] → 填充完成提示 → 刷新后数据一致
- [ ] 非 admin 登录 → 测试台区不存在
- [ ] Render 环境 `DEV_TOOLS_ENABLED` 未设 → 端点 404
- [ ] 重置后 localStorage 全空（DevTools → Application → Local Storage）

---

## 验收结论

**✅ 通过，准予 push。**

六条验收判据全部满足：
1. dev-seed 幂等 ✅
2. soft reset：User 保留 + 业务表清 + pool=500 ✅
3. hard reset：全清 + pool=500 ✅
4. DEV_TOOLS_ENABLED off → 404 ✅
5. 非 admin → 403 ✅
6. deploy_check 全绿 + ?v= 零变动 ✅

v1.2 修订：冰箱 seed 已删（InventoryItem=0），真机手动录入验证留砚仁。

---

## 附：太傅注

- **补课章节**：[数据库字符核对](https://www.sqlite.org/datatype3.html) — Journal 的 `id` 是 `Integer` 列，塞字符串如 `"seed_a1b2c3d4"` 在 SQLite 上不会报语法错但类型不匹配导致后续查询异常（前两轮 500 根因）。规矩：写数据前 grep 模型 `Column(Integer/Text/String)` 再落手。
- **人话原理**：幂等不是你说了算，是查重条件说了算。用自增 id 做查重 = 每次都是新记录（永远不等），用业务字段（user+type+content）做查重 = 真正的不重复。
