---
title: SM-5 测试台v1.1 · 二营验收回执
created: 2026-07-27
project: 南塘云村
type: 验收回执
domain: 测试基建
card: SM-5
commit: d7cb977
status: 打回返修（两处 500 崩溃，端点全废）
author: 二营（Codex）
---
# SM-5 · 测试台v1.1 二营验收回执

> 验收对象：commit `d7cb977`（一营施工，6 文件 admin.py/auth.py/index.html/api.js/app-data.js/core.js）
> 卡面：`方案/任务卡/SM-5_测试台重置与填充.md`（v1.1）
> 验收人：二营（Codex）· 2026-07-27
> **结论：🔴 打回返修。dev-reset 与 dev-seed 两个核心端点均因 ORM 字段名写错而 500 崩溃——测试台完全不可用。** 双闸/trim/autocomplete/机检/?v= 均正确，但主功能全废。

---

## 🔴 打回主因（两处 500 崩溃，实测实证）

### 崩溃1 · `NTLedger(note=...)` 字段名错 → dev-reset 两档全崩
`admin.py` 新增代码里所有 `NTLedger(... note="...")`（dev-reset hard 行 ~113、soft 行 ~146、dev-seed 补池行 ~290）用了 **`note=`**，但 `NTLedger` 模型（models.py:40-54）**没有 `note` 列，字段名是 `reason`**。
实测（隔离库，DEV_TOOLS_ENABLED=true，admin token）：
```
D dev-reset soft EXC: TypeError 'note' is an invalid keyword argument for NTLedger
```
→ dev-reset soft/hard 均在写操作日志 ledger 时抛 500。**重置键完全不可用。**

### 崩溃2 · `MapLocation(updated_at=..., _seed=...)` 字段名错 → dev-seed 崩
`admin.py` dev-seed 里 presence/journal/inventory/cleaning 四处 `MapLocation(key=..., data=..., updated_at=now, _seed=True)`，但 `MapLocation` 模型（models.py:235-239）**只有 `id/key/data` 三列，无 `updated_at`、无 `_seed`**。
实测：
```
E dev-seed EXC: TypeError 'updated_at' is an invalid keyword argument for MapLocation
```
→ dev-seed 在 `_ensure_presence` 第一次写入即抛 500（用户/营地/任务已 add 但未 commit，随事务回滚）。**一键填充完全不可用。**

> 两处都是「凭印象写字段名」——commit message 声称「幂等填充…」但**从未真跑通过**。这正是卡面纪律「后端验收看实证不听说」要拦的。

---

## 关① 逻辑关（逐处核 diff）

### a. dev-reset 清表清单 + 池初始化
- **soft**（admin.py）：`delete(NTTask/Verification/NTLedger/MapLocation/Camp)` + 池重置为 500 各字段归零 + 遍历 users 余额/贡献/经验归零、**保留 users 行** ✅（设计对）
- **hard**：soft 清单 + `delete(User)` + 删旧池重建 `CommunityPool(balance=500,total_issued=500,...)` ✅（C-7 池 500 复用为**手写重建**，非调用现成初始化函数——功能等价，可接受）
- **⚠️ 隐患1（即便修字段名仍在）**：`delete(MapLocation)` 清**整张 map_locations 表**，含真实地图 blob（`key="shared"` 主地图数据），而卡面 §一清单**未列 map_locations**。hard/soft 后真实地图数据被抹，且 dev-seed 不重建地图 → 重置后地图可能空。**建议：MapLocation 删除限定 `key.like('seed_%')` 或排除 `shared`。**
- **⚠️ 隐患2**：seed 把 journal/inventory/cleaning/presence 塞进 **MapLocation blob**，但真实表 `Journal`（models:148）/`InventoryItem`（models:253）**未被 reset 清、也未被 seed 写**。若前端时间线/冰箱读的是真实表而非 MapLocation blob，则判据3「时间线3条/冰箱5件」即便修好崩溃也**不会显示**。**返修时须确认前端这些数据的真实读取源。**

### b. dev-seed 幂等机制
机制 = 确定性 `_seed_id(key)=("seed_"+md5(key)[:8])` 生成固定 ID + 插入前存在性检查（用户按 id、营地/任务按 id、待校核按 id、MapLocation 按 key）。**设计上幂等成立**✅，但因崩溃2**无法实跑验证**（端点未跑通即抛错）。

### c. 双闸真双缺 ✅
`_dev_gate(user)`（admin.py）**先判 `_dev_enabled()` 不满足→404，再判 `role!=admin`→403**，两道独立。实证：
- 非 admin 调用（visitor token，DEV_TOOLS_ENABLED=true）→ **403**（实测 C）
- DEV_TOOLS_ENABLED 未设（admin token）→ dev-seed/dev-reset **均 404**（实测独立跑）
→ 双闸真双缺，非只判一个。✅

### d. auth.py trim 全量替换 ✅
register 内 `req.name` 全部换为 `name=req.name.strip()`：长度校验/白名单正则/查重 select/`User(id=name)`/`avatar_seed=...or name` 五处均用 `name`（grep 实证 register 体内无残留 `req.name`）。查重文案改「这个名字已经被占用了，换一个试试」✅。
- **小提示（非卡面范围，不阻塞）**：`login()`（auth.py:99）仍用 `req.name` 未 trim——注册按 trim 存「张三」，若登录输入「张三␣」会查不到。建议登录侧顺手 trim。

### e. withdraw/confirm/reject 零改动 ✅（复核丞相初核）
admin.py diff 全部为**行 86 之后新增**（reject_withdraw 尾行之后）+ 头部 import/docstring 增量。既有 `confirm_withdraw`(50)/`reject_withdraw`(69)/`pending_withdraws`(39) 函数体**逐字未动**。✅

---

## 关② 实测关（隔离库 httpx ASGI，DEV_TOOLS_ENABLED=true）

| 步 | 卡面判据 | 实测结果 | 判定 |
|---|---|---|---|
| 注册「张三␣」 | trim 后存「张三」 | 200，uid=`'张三'`（尾空格已去） | ✅ |
| 再注册「张三」 | 人话拒绝 | `{ok:false,error:'这个名字已经被占用了，换一个试试'}` | ✅ |
| 非 admin dev-seed | 403 | 403 | ✅ |
| DEV_TOOLS 未设 | 两端点 404 | dev-seed 404 / dev-reset 404 | ✅ |
| **dev-reset soft** | 清业务留账号 | **500 TypeError(NTLedger note)** | ❌ |
| **dev-seed** | 幂等填充 | **500 TypeError(MapLocation updated_at)** | ❌ |
| dev-seed 再点查重复 | 幂等 | 无法测（前置崩溃） | ⛔ 阻断 |
| dev-reset hard 池500 | 全清+500 | 无法测（NTLedger 崩溃同因） | ⛔ 阻断 |

**判据1/2/3/4/7/8**：8「张三␣占用」✅；其余重置/填充相关判据因两处 500 **全部无法达成**。

---

## 关④ 机检关 ✅
`deploy_check.py --skip-smoke`：依赖对账/?v= 一致性/环境变量 三项全 PASS。
`?v=` 审计：`api.js 12→13`、`core.js 19→20`、`app-data.js 13→14`——与卡面要求**一一对应，单点递增**。✅
（注：deploy_check 是静态 import+?v= 检查，抓不到运行时 ORM kwarg 错误——这类崩溃只有实跑端点才暴露，印证实测关不可省。）

---

## 前端侧核查（附）
- `AppData.reset` 改 `localStorage.clear()` 全清 ✅（根治逐 key 枚举漏删）
- autocomplete：regName=`username`、regPwd=`new-password`、loginName=`username`、loginPwd=`current-password` ✅
- 测试台面板 `devToolsPanel` 默认 `display:none`，`showMy()` 中仅 `API.user.role==='admin'` 才 `block` ✅（不渲染非置灰，前端也构成 admin 闸）
- `devReset/devSeed` 交互：showConfirm→调 API→成功 localStorage.clear+reload / 失败提示「检查 DEV_TOOLS_ENABLED」✅（交互逻辑对，但后端崩溃时会走 catch 提示失败）

---

## 返修清单（交一营）
1. **必修**：`admin.py` 所有 `NTLedger(... note=...)` → `reason=`（dev-reset hard/soft + dev-seed 补池，共 3 处）。
2. **必修**：`admin.py` dev-seed 四处 `MapLocation(... updated_at=now, _seed=True)` → 删掉 `updated_at`/`_seed` 两个不存在的 kwarg（MapLocation 只有 key/data）。
3. **应修**：`delete(MapLocation)` 限定 seed 键（`key.like('seed_%')` 或排除 `shared`），避免抹掉真实地图。
4. **应查**：seed 的 journal/inventory 用 MapLocation blob 还是真实 Journal/InventoryItem 表——须与前端读取源一致，否则判据3 填充数据不显示。
5. 返修后**必须实跑** dev-seed×2（验幂等 count 不增）+ soft/hard 重置，贴输出再交验。

## 验收总表
| 关 | 结论 |
|---|---|
| ① 逻辑关 | ⚠️ 双闸✅/trim✅/withdraw零改✅，但清表含真实地图、seed 存储源存疑，且下述崩溃 |
| ② 实测关 | ❌ trim/查重/双闸✅，**dev-reset/dev-seed 双双 500** |
| ③ 真机关 | ⛔ 免谈（端点跑不通，砚仁无法测） |
| ④ 机检关 | ✅ deploy_check 全绿 + ?v= 三文件单点递增 |

**二营验收结论：🔴 打回。测试台两个核心端点均 500 崩溃（ORM 字段名 note/updated_at/_seed 写错），完全不可用。修字段名 + 收窄地图删除 + 核对 seed 存储源后，实跑贴输出再交复验。**

> **太傅注**：补课17（后端验收看实证不听说）。人话原理：commit 说「幂等填充3用户2营地…」写得头头是道，一起服务真点下去，第一下就 500——字段名照脑子里想的写（note/updated_at），跟数据库真实列（reason，MapLocation 只有 key/data）对不上。deploy_check 静态检查照样全绿，只有真发一次请求才现原形。这就是为什么验收台账认「跑通的输出」不认「写了的代码」。
