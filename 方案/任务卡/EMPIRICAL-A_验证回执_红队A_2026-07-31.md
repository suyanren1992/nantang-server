# EMPIRICAL-A 验证回执 · 红队 A

> 卡号：EMPIRICAL-A_验证4🔴真伪_v0（4 张子卡）
> 审查方：红队 A（Claude Code）
> 方法：逐声明真仓读源码验证
> 日期：2026-07-31

---

## 🔴 2.1：LABOR_ACTIONS 硬编码 nt 与 labor_pricing 5 处差异

**卡面声明**：ui-cardroom.js:52-117 LABOR_ACTIONS 的 nt 值与 app.js labor_pricing 存在 5 处数值差异。

### 验证

**来源对比——5 处差异确实存在**：

| 动作 | LABOR_ACTIONS (ui-cardroom.js) | labor_pricing (app.js) | 差 |
|------|-------------------------------|------------------------|-----|
| water | L64: `nt:5` | L69: `water:3` | +2 |
| fertilize | L65: `nt:8` | L69: `fertilize:15` | -7 |
| weed | L66: `nt:10` | L69: `weed:15` | -5 |
| sow | L67: `nt:8` | L69: `sow:5` | +3 |
| compost | L89: `nt:8` | L72: `compost:5` | +3 |

**但是——差异不产生用户可见 bug**：

`_getActionsForSpace()` (ui-cardroom.js:195-223) **已经**通过 `_getLaborNT(aid)` 动态读取：

```javascript
// L202: 动态从 labor_pricing 读取
var nt = _getLaborNT(aid);
// L206: 使用动态值覆盖硬编码
result.push({ ... action:{ id:aid, label:found.action.label, nt:nt } });
```

所有显示路径都走了 `_getLaborNT()`：
- 卡片室选空间：`_getActionsForSpace()` → `_getLaborNT()` (L202)
- 自我上报：`_getLaborNT(_srDraft.actionId)` (L1130)
- 发现流程：`_getLaborNT(_discDraft.actionId)` (L1076)

代码 L50-51 注释已注明：`// 硬编码劳动类型（NT 值仅作显示默认，实际从 _getLaborNT 读取）`

### 判定：🟡 虚假 🔴——差异存在但不可见

- 5 处数值差异：真实存在 ✅
- 用户看到错误 NT 值：**不成立** ❌ — `_getActionsForSpace` 已动态覆盖
- 卡片所述修复（改 line 195）：**已实现** — 代码现状与修复目标一致

**建议**：降级为 P2（清理硬编码默认值，避免代码读者误判）。不是 P0。

---

## 🔴 2.2：全貌页 sections 数组缺 _renderStatusPills

**卡面声明**：app.js:259-268 sections 数组 8 项，缺少 `_renderStatusPills()` 调用，全貌页看不到空间状态指示。

### 验证

**实证 1**：`_renderStatusPills()` 完整实现（app.js:296-322）
- 绿/黄/红整洁度计数 ✅
- 物品过期提醒 ✅
- 函数完整，无依赖缺失

**实证 2**：sections 数组（app.js:259-268）共 8 项：
```javascript
var sections = [
  function(){ return _s('announceTicker', _renderAnnounceTicker()); },  // 公告
  function(){ return _s('newbieCard', _renderNewbieCard()); },         // 新人
  function(){ return _s('quickEntryRow', _renderQuickEntryCards()); }, // 快捷入口
  function(){ return _s('cardVerifyRow', _renderCardVerifyRow()); },   // 验证
  function(){ return _s('mgmtGrid', _renderMgmtCards()); },           // 管理
  function(){ return _s('cardRoomSection', _renderCardRoomSection()); },// 卡片室
  function(){ return _s('covenantCard', _renderCovenantCard()); },     // 公约
  function(){ return _s('poolCard', _renderPoolCard()); }              // 资金池
];
```

**实证 3**：无 `_renderStatusPills` 调用。Grepped `_renderStatusPills` — 只在函数定义处（L296）出现，**sections 数组中零引用**。

### 判定：✅ 真实 🔴

- 函数已完整实现 ✅
- sections 渲染管线缺此项 ✅
- 用户看不到空间状态指示 ✅
- 1 行修复（加数组项），零风险 ✅

---

## 🔴 2.3：HARDCODED_BUILDINGS 与服务端不交汇

**卡面声明**：客户端 app.js HARDCODED_BUILDINGS 12 建筑，服务端 database.py init_db() 不写 map_locations 种子。

### 验证

**实证 1**：客户端 HARDCODED_BUILDINGS（app.js:15-27）
- 实际 **11 个**建筑（非 12）：toilet_b, parking, gate_a, office, info, study, field, stage, plaza, jingzi_pavilion, lawn
- 含完整 floors/plots 层级数据

**实证 2**：服务端 database.py init_db()
- Grep `building` / `seed.*build` / `map_location.*build` → **零命中**
- init_db 确实 seed 了 `inn_rooms`（L190-207），但**不 seed 建筑数据**
- `MapLocation` 表存在（models.py:280-284）但 init_db 不写入

**实证 3**：`getBuildings()`（app.js:29）有 fallback 逻辑——先读服务端数据，为空时用 `HARDCODED_BUILDINGS` 兜底。新数据库无建筑种子 → 所有人都走客户端兜底 → 每个客户端自己的"真相"。

### 判定：✅ 真实 🔴

- init_db 不写 buildings 种子 ✅
- 新数据库暴露此 bug ✅
- 服务端无建筑真相源 ✅
- 小修正：11 个建筑，非 12

---

## 🔴 2.4：sync_shared presence 无所属权校验

**卡面声明**：data.py sync_shared 端点接受 presence 字段，任何认证用户可写入任意 user_id 的 presence。

### 验证

**实证**：data.py:419-431 presence 处理逻辑：
```python
_presence = req.get("presence")
if _presence and isinstance(_presence, dict):
    for uid, pdata in _presence.items():
        if not isinstance(pdata, dict): continue
        pk = f"presence:{uid}"
        pr = (await db.execute(select(MapLocation).where(MapLocation.key == pk))).scalar_one_or_none()
        if not pr:
            pr = MapLocation(key=pk); db.add(pr)
        existing = json.loads(pr.data) if pr.data else {}
        if pdata.get("updatedAt", "") >= existing.get("updatedAt", ""):
            pr.data = json.dumps(pdata, ensure_ascii=False)
```

**实证分析**：
- `uid` 来自请求体，可以任意指定 ✅
- `user` 对象存在于函数作用域（`user: User = Depends(get_current_user)`）✅
- 但无 `uid != user.id` 校验 ✅
- 也无 `user.role == 'admin'` 例外 ✅

**攻击场景**：用户 A 发送 `{presence: {"B": {status: "onsite", location: "田间", updatedAt: "..."}}}` → 服务端接受并写入 B 的 presence → B 的翻牌状态被伪造 → 影响全貌页显示 + 治理权 voting 判定（governance.py checks presence）。

### 判定：✅ 真实 🔴 安全漏洞

- 无所属权校验 ✅
- 任意认证用户可写任意用户 presence ✅
- 影响翻牌显示 + 治理权 ✅

---

## 汇总

| # | 卡面 🔴 | 验证结果 | 真实度 |
|---|---------|---------|:--:|
| 2.1 | LABOR_ACTIONS 5 处差异 | 差异存在，但 `_getActionsForSpace` 已动态覆盖，不可见 | 🟡 非 P0 |
| 2.2 | sections 缺 _renderStatusPills | 函数完整实现但未接入渲染管线 | ✅ 真 🔴 |
| 2.3 | buildings 不交汇 | init_db 零 building 种子，11 建筑（非 12） | ✅ 真 🔴 |
| 2.4 | presence 无所属权 | 任意用户可写任意 uid 的 presence | ✅ 真 🔴 |

**真 🔴：3 个。虚假 🔴：1 个（2.1）。**

> 红队 A 验证完成 · 逐文件逐行真仓对照 · 零估算
