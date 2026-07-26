---
title: SM-5 返修 · 二营复验回执
created: 2026-07-27
project: 南塘云村
type: 复验回执
domain: 测试基建
card: SM-5
commit: 0078925
status: 🔴 二次打回（换了两处崩溃，端点仍全 500）
author: 二营（Codex）
---
# SM-5 返修 · 二营复验回执

> 复验对象：commit `0078925`（一营返修，admin.py 单文件 73+/73−）
> 打回背景：`SM-5_二营验收回执.md`（首验双 500：note/updated_at/_seed 字段名错）
> 复验人：二营（Codex）· 2026-07-27
> 前置警示：一营返修**只做 py_compile+AST 静态扫描，未实跑**（丞相已点名）。实测关是唯一实跑岗，从严。
> **结论：🔴 二次打回。首验的两处崩溃已修，但换来两处新崩溃——dev-seed 与 dev-reset 仍双双 500，端点依旧完全不可用。**

---

## 🔴 二次打回主因（两处新 500，实测实证）

### 崩溃3 · `Journal(id="seed_...")` — Integer 主键塞字符串 → dev-seed 崩
返修把 journal 从 MapLocation 改存 Journal 表（方向对），但用 `_seed_id()` 生成的**字符串 id** 塞进 `Journal.id`，而 `Journal.id`（models.py:150）是 **`Integer, autoincrement=True`**。
实测（隔离库，DEV_TOOLS_ENABLED=true，admin token）：
```
seed#1: 500
sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) datatype mismatch
[SQL: INSERT INTO journal (id, user, type, content, time, ...) VALUES (?, ...)]
[parameters: ('seed_430e511d', '测试甲', 'cleaning', '打扫了正厅', ...)]
```
→ dev-seed 写第一条 journal 即 `datatype mismatch`。**一键填充仍不可用。**
（对比：`InventoryItem.id` 是 `String` 主键，seed 字符串 id 没问题——问题只在 Journal 的 Integer 主键。修法：Journal 别传 id，让其 autoincrement；幂等改按 user+type+content 查重。）

### 崩溃4 · `from models import ... CanteenOrder` — 类不存在 → dev-reset 崩
返修在 dev-reset 里补清表，import 了 **`CanteenOrder`**，但 models.py **没有这个类**——食堂相关是 `CanteenMenu`(216) + `MealOrder`(224)。
实测（提权环境直接 import）：
```
from models import CanteenOrder
→ ImportError: cannot import name 'CanteenOrder' from 'models'
（实际类：MealOrder + CanteenMenu 存在）
```
→ dev-reset（admin.py:116 函数内 import）一进 soft/hard 分支即 `ImportError` 500。**重置键仍不可用。**（修法：`CanteenOrder`→`MealOrder`，两处 delete 同改。）

> 两处又都是「凭印象写名字」：Journal 主键类型没查、CanteenOrder 类名没查。**py_compile/AST 扫得过语法，扫不出「字符串塞 Integer 列」「import 不存在的类」——这正是必须实跑的理由。**

---

## 关① 逻辑关（四处核 diff）

### a. `note=`→`reason=` 三处全改 ✅
grep `note=` in admin.py：仅剩 3 处 `NTTask(... note=...)`（任务备注，note 是 NTTask 合法列），**NTLedger 的 note= 零残留**。dev-reset hard(行 138)/soft(行 160)/dev-seed 补池(行 287) 三处均已 `reason=`。✅

### b. MapLocation 仅剩 key+data ✅
admin.py 现只剩 1 处 `MapLocation(key=..., data=...)`（presence，行 249），无 `updated_at`/`_seed`。✅（journal/inventory 已改走各自表，故 MapLocation 调用减少。）

### c. SEED_KEY_PREFIXES 收窄 — ✅ 保住 shared，⚠️ 但前缀过宽（列疑义）
`SEED_KEY_PREFIXES = ("seed_", "presence:", "config_changes", "config_history")`，soft 只删这些前缀，`key="shared"`（真实地图 blob）**得以保留** ✅。
**⚠️ 疑义（列出，交裁）**：`"presence:"`、`"config_changes"`、`"config_history"` 三前缀清的是**真实业务/配置数据**（用户在地状态、社区公约变更历史），非 seed 数据。soft 档卡面语义是「清业务数据留账号」——
- presence（在地状态）算业务数据，soft 清掉尚可接受；
- 但 **config_changes/config_history（公约变更历史）被 soft 一并清掉，可能过度**——公约历史更接近「配置资产」，重置业务数据不应连带抹掉。建议 soft 保留 config_*，只在 hard 清。**不阻塞（端点本就崩），但修崩溃时一并定夺。**

### d. 存储源对齐 — journal ✅ / inventory ⚠️不同源 / cleaning 跳过
逐一对照 data.py 读取源：
- **journal**：seed 写 `Journal` 表；`GET /api/data/journal`(data.py:107) 读 `Journal` 表 → **源对齐** ✅（但崩溃3 导致写不进）
- **inventory**：seed 写 `InventoryItem` 表；`GET /api/data/inventory`(data.py:360) 读 `InventoryItem` 表 → sync 源对齐 ✅ **但**——一营自己在代码注释承认：「⚠ 冰箱面板读 `AppData._data.inventory.office`（localStorage），不同源，seed 物品不在冰箱出现」。**即判据3「冰箱5件（临期/过期警告）」即便修好崩溃仍不满足**——冰箱 UI 读的不是 InventoryItem 表。
- **presence**：seed 写 `MapLocation key=presence:{uid}`；sync_shared(data.py:406) 处理 presence → 源对齐 ✅
- **cleaning**：跳过（纯 localStorage，server 无法 seed）——注释已说明，判据3「2脏房」这项 seed 天然做不到，需真机本地造。

### e. withdraw 零改动 ✅
本 commit 仅动 dev-tools 段（行 88 之后），withdraw/confirm/reject 未触及（复核延续首验结论）。✅

---

## 关② 实测关（核心实跑岗，从严）

| 子项 | 卡面要求 | 实测结果 | 判定 |
|---|---|---|---|
| a | dev-seed 连点2次幂等 | **seed#1 即 500**（Journal datatype mismatch），无法验幂等 | ❌ |
| b | dev-reset soft | **500**（CanteenOrder ImportError） | ❌ |
| c | dev-reset hard 池500 | **500**（同 CanteenOrder ImportError） | ❌ |
| d | 填充后判据3 逐项 | 前置崩溃，无数据可验；且冰箱源不同源(见①d) | ⛔ 阻断 |
| e | DEV_TOOLS 未设两端点404 | （首验已证 404，本次逻辑未动闸门，双闸仍在） | ✅ 沿用 |

实测输出原样：
```
seed#1: 500  → IntegrityError datatype mismatch: INSERT INTO journal id='seed_430e511d'
（dev-seed 崩溃，counts 未产生，幂等无从谈起）
dev-reset soft/hard → ImportError: cannot import name 'CanteenOrder'
```

**判定**：核心实测 a/b/c/d 全部**不通过**——两端点仍 500。

---

## 关④ 机检关（含 smoke）✅（但抓不到本质问题）
本地起 uvicorn（隔离库/隐藏窗/测完已 kill）跑 `deploy_check --url http://127.0.0.1:8074` 四段：
```
依赖对账 PASS / ?v= 一致性 PASS / 环境变量 PASS / 部署冒烟 PASS
  冒烟: 首页200 · /api/nt/sync 401 · 版本回显['18','19','20']
```
✅ 四段全绿。**但**：本 commit 纯服务端（admin.py），无前端改动，故无 ?v= 变化（版本回显与 SM-3 后一致，正常）。
**再次印证**：deploy_check 是静态 import 名单 + ?v= + 站点存活检查，**抓不到「字符串塞 Integer 列」「import 不存在的类」这类运行时错误**——dev-seed/dev-reset 端点在 deploy_check 里根本不被调用。这就是为什么本卡必须实跑端点。

---

## 返修清单（交一营，二次）
1. **必修** `Journal(id=_seed_id(...))` → 去掉 id 参数（Integer 主键自增），幂等改按 `Journal.user+type+content` 查重。
2. **必修** `from models import ... CanteenOrder` → `MealOrder`；`delete(CanteenOrder)` 两处 → `delete(MealOrder)`。
3. **应修** SEED_KEY_PREFIXES 从 soft 删除列表移除 `config_changes`/`config_history`（公约历史不应随业务重置抹掉），或明确 soft 也清的口径。
4. **应查/回执说明** 冰箱面板读 localStorage 而非 InventoryItem 表——判据3「冰箱5件」server seed 无法满足，需前端改读取源或降级判据（写清）。
5. 返修后**必须真跑** dev-seed×2 + soft + hard，**贴原样输出**再交复验（第三次不接受纯静态扫描）。

## 复验总表
| 关 | 结论 |
|---|---|
| ① 逻辑关 | reason✅/MapLocation✅/收窄保 shared✅(config前缀过宽存疑)/journal源对齐✅但inventory冰箱不同源 |
| ② 实测关 | ❌ dev-seed 500(Journal Integer PK)、dev-reset 500(CanteenOrder ImportError) |
| ③ 真机关 | ⛔ 免谈（端点跑不通） |
| ④ 机检关 | ✅ 四段全绿（含smoke），但结构性抓不到运行时崩溃 |

**二营复验结论：🔴 二次打回。首验两崩溃已修，又引入两处新崩溃（Journal 字符串主键 + CanteenOrder 不存在的类），dev-seed/dev-reset 仍 100% 500。改这两处 + 定夺 config 前缀/冰箱源后，实跑贴输出三验。**

> **太傅注**：补课17。人话原理：一营这次修好了「note/updated_at」，却在补清表时又import了个不存在的类（CanteenOrder，实际叫 MealOrder），还把字符串塞进 Journal 的整数主键——py_compile 全过、AST 全过，一起服务真点，第一下照样 500。这就是丞相点名「未实跑」的代价：静态扫描永远证明不了「跑得起来」，只能证明「编译得过」。第三次务必先自己真点一遍再交。
