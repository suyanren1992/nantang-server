# 南塘云村 · 28 个已验证 Bug 执行方案

> 2026-07-21 · 基于 6 角色审查去重后生成
> 来源：[00_去重校验.md](reviews/00_去重校验.md)
> 排除：`camps.py:78 schedule[0] IndexError`（实地核查后发现 `if schedule` 已兜底，误报）

---

## 总览

| 阶段 | 主题 | 数量 | 预计改动 |
|------|------|:--:|:--:|
| P0 | 崩溃/安全/隐私 | 6 | ~20 行 |
| P1 | 经济完整性 | 11 | ~80 行 |
| P2 | 任务生命周期 | 11 | ~100 行 |
| P3 | 客户端健壮性 | 14 | ~50 行 |
| P4 | 服务端健壮性 | 3 | ~20 行 |

---

## P0 · 崩溃/安全（6 个 · 立即修）

### P0-1 🔴 index.html — _inboxReadIds 未声明

**文件：** `nantang-mobile/index.html`  
**问题：** `_isInboxUnread()` 引用未声明的 `_inboxReadIds`，inbox 面板打开时抛 ReferenceError 崩溃  
**修复：** 在 `_markInboxRead` 上方添加：

```javascript
var _inboxReadIds = {};
try { _inboxReadIds = JSON.parse(localStorage.getItem('nt_inbox_read') || '{}'); } catch(e) {}
```

### P0-2 🔴 index.html — _inboxCategory 未声明

**文件：** `nantang-mobile/index.html`  
**问题：** `_renderInbox()` 中 `if (_inboxCategory !== '全部')` 引用未声明的变量  
**修复：** 在 P0-1 同位置添加：

```javascript
var _inboxCategory = '全部';
```

### P0-3 🔴 auth.py — /api/auth/users 无认证

**文件：** `server/routes/auth.py`，第 107-110 行  
**问题：** 任何人可 GET 此端点，泄露所有用户名和头像种子  
**修复：**

```python
@router.get("/users")
async def list_users(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user: raise HTTPException(status_code=401)
    ...
```

### P0-4 🔴 auth.py — register 不验证用户名

**文件：** `server/routes/auth.py`，第 50-51 行  
**问题：** 空字符串、超长字符串可直接入库  
**修复：** 在 `register` 函数开头加：

```python
if not req.name or len(req.name) > 64:
    return JSONResponse({"ok": False, "error": "用户名需为1-64字符"})
```

### P0-5 🟡 data.py — sync_shared 内层缺类型校验

**文件：** `server/routes/data.py`，第 297-320 行  
**问题：** FastAPI 校验外层 `req: dict`，但 `req["camps"].items()` 在 camps 为 list 时 AttributeError  
**修复：** 每个 `.items()` 调用前加 isinstance 检查：

```python
if isinstance(req.get("camps"), dict):
    for camp_id, camp_data in req["camps"].items():
        ...
```

### P0-6 🟡 data.py + camps.py — json.loads 无 try/except

**文件：** `server/routes/camps.py:30`，`server/routes/data.py:193-194,235`  
**问题：** 数据库中损坏的 JSON 导致 500  
**修复：** 每个 `json.loads` 加 try/except，降级返回 `[]` 或 `{}`

---

## P1 · 经济完整性（11 个）

### P1-1 🔴 nt.py — earn 不更新 CV

**文件：** `server/routes/nt.py`，第 147-148 行  
**问题：** HTTP 模式下 earn 只加 XP，不加 CV。file:// 模式正常加 CV。双模不一致。  
**修复：**

```python
user.nt_balance += req.amount
user.experience_value += req.amount
user.contribution_value += req.amount  # 新增
```

### P1-2 🔴 nt.py — spend 不更新 CV

**文件：** `server/routes/nt.py`，第 167-168 行  
**问题：** HTTP 模式下 spend 不减 CV。与客户端行为（nt-core.js:428 减 CV）不一致。  
**修复：**

```python
user.nt_balance -= req.amount
user.contribution_value = max(0, user.contribution_value - req.amount)  # 新增
```

### P1-3 🔴 nt.py — transfer 无 CV 转移规则

**文件：** `server/routes/nt.py`，第 109-131 行  
**问题：** HTTP 模式下转账不执行 75%/25% CV 分润和公共池磨损。  
**修复：** 在 transfer 的 commit 前增加：

```python
# CV 转移规则: 75%→接收方 + 25%→公共池磨损
cv_amount = req.amount
user.contribution_value = max(0, user.contribution_value - cv_amount)
to_user.contribution_value = (to_user.contribution_value or 0) + int(cv_amount * 0.75)
pool.contribution_pool = (pool.contribution_pool or 0) + int(cv_amount * 0.25)
```

### P1-4 🔴 nt.py — spend scope→ledger 映射不一致

**文件：** `server/routes/nt.py`，第 175 行  
**问题：** spend 在 scope=="personal" 时写 `to_user="community_pool"`，否则 `to_user=None`。earn 在 scope=="camp" 时写 `from_user="community_pool"`。条件逻辑不一致，导致 verify 端点的 camp_pool_balance 计算不可靠。  
**修复：** spend 的 ledger 写入与 earn 对齐——都用 scope 参数设置 type，from_user/to_user 只用用户 ID：

```python
# spend（约 175 行）：to_user 始终为 "community_pool"，type 反映 scope
lid = _ledger_id()
await _add_ledger(db, lid, user.id, "community_pool",
                  req.amount, f"{req.scope}_spend", req.reason)
```

### P1-5 🔴 nt.py — 缺 cashout 端点

**文件：** `server/routes/nt.py`  
**问题：** 客户端有 `NT.cashOut()`，服务端有 topup 但无 cashout。提现审批流链路断裂。  
**修复：** 新增端点（完整实现，镜像 topup 方向+补全 ledger/pool 操作）：

```python
@router.post("/cashout")
async def cashout(req: TopUpRequest, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="金额必须大于0")
    target = (await db.execute(select(User).where(User.id == req.user))).scalar_one_or_none()
    if not target: raise HTTPException(status_code=404, detail="用户不存在")
    if target.nt_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"余额不足（当前 {target.nt_balance} NT）")
    target.nt_balance -= req.amount
    target.updated_at = datetime.utcnow().isoformat()
    pool = await _get_pool(db)
    pool.total_issued -= req.amount
    if pool.total_issued < 0:
        raise HTTPException(status_code=400, detail="系统发行量不足，无法提现")
    lid = _ledger_id()
    await _add_ledger(db, lid, target.id, None, req.amount, "cashout", req.reason)
    await db.commit()
    return {"ok": True, "entry_id": lid, "balance": target.nt_balance}
```

### P1-6 🟡 nt-core.js — spend() scope 参数误导

**文件：** `nantang-mobile/js/nt-core.js`，第 358-360 行  
**问题：** `spend(userId, amount, reason, scope)` 永远路由到 community pool，scope 只改 ledger type 标签名。与 earn 不一致。  
**修复：** MVP 阶段 CAMP_POOLS 未实现端到端，暂不改路由。删除 pool 参数，明确标注：

```javascript
// ponytail: CAMP_POOLS 端到端实现前，spend() 固定走 community pool。scope 仅影响 ledger type 标签。
function spend(userId, amount, reason, scope) {
  return spendToPool(userId, amount, reason, 'community', scope);
}
```

### P1-7 🔴 nt-core.js + camps.py — CAMP_POOLS 从未注资可用

**文件（客户端）：** `nantang-mobile/js/nt-core.js`  
**文件（服务端）：** `server/routes/camps.py`，第 82-87 行  
**问题：** camps.py 把 camp_total 写入 ledger 但不注入 ComunityPool 的 camp_balance。客户端 CAMP_POOLS 没有 `depositToCampPool()` 对应函数。`earnFromPool('camp:xxx')` 永远失败。  
**修复（服务端）：** models.py CommunityPool 加列 + camps.py 注入 + nt.py earn 支持 camp pool：

```python
# models.py CommunityPool 加：
camp_balance = Column(Integer, default=0)

# camps.py create_camp（约87行）：
pool.camp_balance += camp_total

# nt.py earn（约141行），在扣 pool.balance 之前加判断：
if req.scope == "camp" or (hasattr(req, 'pool') and req.pool and req.pool.startswith('camp:')):
    if pool.camp_balance < req.amount:
        raise HTTPException(status_code=400, detail="营队池余额不足")
    pool.camp_balance -= req.amount
else:
    if pool.balance < req.amount:
        raise HTTPException(status_code=400, detail="社区池余额不足")
    pool.balance -= req.amount
```

**修复（客户端）：** nt-core.js 加：

```javascript
function depositToCampPool(campId, amount, reason) {
  if (!CAMP_POOLS[campId]) CAMP_POOLS[campId] = 0;
  CAMP_POOLS[campId] += amount;
  _totalIssued += amount;
  _addLedger('system', 'camp:' + campId, amount, 'deposit', reason || '营队注资');
  _saveState(true);
  return CAMP_POOLS[campId];
}
// 导出到 window.NT
```

### P1-8 🔴 app-data.js — overdueNT 永不追缴

**文件：** `nantang-mobile/js/app-data.js`，第 417-431 行  
**问题：** `totalDue = roomPrice * daysPassed` 只收当天租金，`room.overdueNT` 历史欠费从不加入。欠费无限滚雪球。  
**修复：** 同时覆盖 room.overdueNT（P1-9 生效前旧数据）和 ntUser.overdueNT（P1-9 生效后新数据）：

```javascript
var ntUser = NT.getUser(room.tenant);
var userOverdue = ntUser ? (ntUser.overdueNT || 0) : 0;
var totalDue = roomPrice * daysPassed + (room.overdueNT || 0) + userOverdue;
```
> ⚠️ P1-8 和 P1-9 有读写耦合：P1-9 之后新欠费写 ntUser.overdueNT，不再写 room.overdueNT。P1-8 同时读两处确保不遗漏。

### P1-9 🔴 app-data.js — overdueNT 存房间不存用户

**文件：** `nantang-mobile/js/app-data.js`，第 428 行  
**问题：** 租客搬离后欠费留在房间，新房客继承前人债务。  
**修复：** `overdueNT` 存到 NT 用户对象而非 room：

```javascript
var ntUser = NT.getUser(room.tenant);
if (ntUser) ntUser.overdueNT = (ntUser.overdueNT || 0) + unpaid;
```

### P1-10 🔴 nt-core.js — _loadState 旧 sp→cmp fallback

**文件：** `nantang-mobile/js/nt-core.js`，第 47-48 行  
**问题：** `COMMUNITY_POOL = s.cmp != null ? s.cmp : (s.sp != null ? s.sp : 0)` 如果加载了含旧 `sp` 字段的状态，COMMUNITY_POOL 被设为 `sp` 的值，但 `_totalIssued` 是 `s.ti`。两个值可能来自不同快照，等式断裂。  
**修复：** 保留迁移兼容，旧 `sp` 值迁移到 `cmp`，写回后删除 `sp`：

```javascript
// 迁移旧 sp→cmp（一次性，避免静默丢失数据）
if (s.cmp == null && s.sp != null) {
  console.warn('[NT] 检测到旧 sp 字段，已迁移到 cmp，请验证会计等式');
  COMMUNITY_POOL = s.sp;
  // 触发一次保存，将 cmp 持久化并从状态中删除 sp
  _saveState(true);
} else {
  COMMUNITY_POOL = s.cmp != null ? s.cmp : 0;
}
```
> ⚠️ 原方案直接删除 sp fallback 会导致旧用户 COMMUNITY_POOL 静默归零。

### P1-11 🟡 nt.py — reject 缺 poster 时缺 ledger 记录

**文件：** `server/routes/nt.py`，第 331-332 行  
**问题：** reject verify 时如果 poster 不存在，NT 进入 `pool.balance` 但没有 ledger 记录。  
**修复：** 在 else 分支加：

```python
await _add_ledger(db, lid, task.poster or "escrow", "community_pool", task.reward, "escrow_absorbed", "发布者不存在,NT 回收", task_id)
```

---

## P2 · 任务生命周期（11 个）

### P2-1 🔴 data.js — doSubmit 多人任务阻断

**文件：** `nantang-mobile/js/data.js`，第 322 行  
**问题：** 3 人任务第 1 人提交后 status→"待审核"，其余人无法提交。  
**修复：**

```javascript
// 多人任务：仅当全部 claimants 都提交后才改变 task.status
if ((t.slots || 1) > 1) {
  var allSubmitted = (t.claimants || []).every(function(c) { return c.submission; });
  if (!allSubmitted) { AppData._saveShared(); filterQuests(); renderMyTasks(); return; }
}
t.status = '待审核';
```

### P2-2 🔴 data.js — claimTask 不检查 slots 上限

**文件：** `nantang-mobile/js/data.js`，第 333-338 行  
**问题：** slots=1 可被无限人认领。  
**修复：** claimTask 开头加：

```javascript
if ((t.claimants || []).length >= (t.slots || 1)) { showToast('名额已满', 'error'); return; }
```

### P2-3 🔴 server tasks.py — slots 无下限

**文件：** `server/routes/tasks.py`，第 21 行（TaskCreate 模型）  
**问题：** slots=0 或 -1 可传入。  
**修复：**

```python
slots: int = Field(1, ge=1, le=100)
```

### P2-4 🔴 nt.py — verify_task 空 reviewer 无权限

**文件：** `server/routes/nt.py`，第 297-299 行  
**问题：** `if task.reviewer and task.reviewer != user.id and user.role != "admin"` — 当 reviewer 为空时整条跳过，任何登录用户可验证任意任务。  
**修复：**

```python
if user.role != "admin" and (not task.reviewer or task.reviewer != user.id):
    raise HTTPException(status_code=403, detail="只有指定的审核人可以验证此任务")
```

### P2-5 🔴 server tasks.py — reviewer 字段零校验

**文件：** `server/routes/tasks.py`，第 76, 98 行  
**问题：** 创建任务时 reviewer 可设为空字符串或不存在的人，服务端不做校验。  
**修复：** create_task 中校验 reviewer：

```python
if req.reviewer and req.reviewer.strip():
    rv = (await db.execute(select(User).where(User.id == req.reviewer.strip()))).scalar_one_or_none()
    if not rv:
        raise HTTPException(status_code=400, detail="审核人不存在")
```

### P2-6 🔴 nt.py — accept_task 覆盖已有 assignee

**文件：** `server/routes/nt.py`，第 281-282 行  
**问题：** 后来者 accept 直接覆盖之前的 assignee。  
**修复：**

```python
if task.assignee:
    raise HTTPException(status_code=409, detail="任务已被接取")
```

### P2-7 🔴 nt-core.js — 缺 unclaimTask

**文件：** `nantang-mobile/js/nt-core.js`  
**问题：** 认领者无法放弃任务，NT 永久冻结在 TASK_ESCROW。  
**修复：** 新增 `unclaimTask(taskId, assigneeId)`：

```javascript
function unclaimTask(taskId, assigneeId) {
  var t = _getTask(taskId); if (!t) return null;
  if (t.assignee !== assigneeId) return _err('你不是此任务的认领者');
  if (t.status !== 'active' && t.status !== 'pending') return _err('任务状态不允许放弃');
  // 退还托管 NT 给发布者
  TASK_ESCROW -= t.reward;
  var poster = _getUser(t.poster);
  if (poster) poster.ntBalance += t.reward;
  t.assignee = null; t.status = 'pending'; t.acceptedAt = null;
  _saveState(true); return t;
}
```

### P2-8 🔴 nt-core.js — 缺 resolveDispute

**文件：** `nantang-mobile/js/nt-core.js`  
**问题：** 任务标记为 disputed 后无法恢复。  
**修复：** 新增 `resolveDispute(taskId, resolution)`：

```javascript
function resolveDispute(taskId, resolution) {
  var t = _getTask(taskId); if (!t) return null;
  if (t.status !== 'disputed') return _err('任务不在争议状态');
  var poster = _getUser(t.poster);
  var assignee = _getUser(t.assignee);
  if (resolution === 'approve') {
    // 判给执行者：NT 从托管释放给 assignee
    TASK_ESCROW -= t.reward;
    if (assignee) { assignee.ntBalance += t.reward; assignee.totalEarned += t.reward; }
    t.status = 'settled'; t.settledAt = new Date().toISOString();
    _addLedger('escrow', t.assignee, t.reward, 'dispute_resolve', '争议裁决:判给执行者', taskId);
  } else if (resolution === 'refund') {
    // 判给发布者：NT 退还
    TASK_ESCROW -= t.reward;
    if (poster) poster.ntBalance += t.reward;
    t.status = 'cancelled';
    _addLedger('escrow', t.poster, t.reward, 'dispute_resolve', '争议裁决:退还发布者', taskId);
  } else {
    return _err('无效裁决类型，需为 approve/refund');
  }
  _saveState(true); return t;
}
// 导出到 window.NT
```

### P2-9 🔴 nt.py — 缺 cancel/dispute/submit 端点

**文件：** `server/routes/nt.py`  
**问题：** HTTP 模式下这三个操作无服务端 API。  
**修复：** 新增三个端点：

```python
@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user: raise HTTPException(status_code=401)
    result = await db.execute(select(NTTask).where(NTTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404)
    if task.poster != user.id and user.role != "admin":
        raise HTTPException(status_code=403)
    if task.status in ("已结算", "待结算"):
        raise HTTPException(status_code=400, detail="不可取消已结算任务")
    # 退还托管 NT
    if task.escrow_amount > 0:
        pool = await _get_pool(db)
        poster = (await db.execute(select(User).where(User.id == task.poster))).scalar_one_or_none()
        if poster: poster.nt_balance += task.escrow_amount
        else: pool.balance += task.escrow_amount
        pool.task_escrow -= task.escrow_amount
    task.status = "已取消"
    await db.commit()
    return {"ok": True}

@router.post("/tasks/{task_id}/submit")
async def submit_task(task_id: str, evidence: str = "", user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user: raise HTTPException(status_code=401)
    result = await db.execute(select(NTTask).where(NTTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404)
    if task.assignee != user.id: raise HTTPException(status_code=403, detail="只有认领者可以提交")
    if task.status not in ("进行中", "待提交", "退回修改"):
        raise HTTPException(status_code=400, detail=f"任务状态不可提交: {task.status}")
    task.evidence = evidence
    task.status = "待审核"
    task.completed_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ok": True}

@router.post("/tasks/{task_id}/dispute")
async def dispute_task(task_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user: raise HTTPException(status_code=401)
    result = await db.execute(select(NTTask).where(NTTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task: raise HTTPException(status_code=404)
    if task.poster != user.id and task.assignee != user.id:
        raise HTTPException(status_code=403, detail="只有任务参与者可以发起争议")
    task.status = "已争议"
    await db.commit()
    return {"ok": True}
```

### P2-10 🔴 core.js — "已完成" 死状态

**文件：** `nantang-mobile/js/core.js`，第 259, 979 行  
**问题：** UI 过滤器引用"已完成"但无任何转换路径生成此状态。  
**修复：** 从过滤器中移除"已完成"，统一使用"待结算"→"已结算"。

### P2-11 🟡 server tasks.py — completed_at 打回不清除

**文件：** `server/routes/tasks.py`，第 115-118 行  
**问题：** 打回后 completed_at 停留在第一次提交时间。  
**修复：** 打回时 `task.completed_at = None`（或增加 `rejected_at` 字段记录打回时间）。

---

## P3 · 客户端健壮性（14 个）

### P3-1 🔴 core.js — doPublish 双击双重冻结

**文件：** `nantang-mobile/js/core.js`，第 543-562 行  
**问题：** addTask→createTask→updateTask 顺序导致双击时 `_ntTaskId` 同步有窗口期，可能重复冻结 NT。  
**修复：**

```javascript
var _publishing = false;
function doPublish() {
  if (_publishing) return;
  _publishing = true;
  // ... 原有逻辑 ...
  // 最后: _publishing = false;
}
```

### P3-2 🔴 core.js — publishDraft 无防重入

**文件：** `nantang-mobile/js/core.js`，第 567-577 行  
**问题：** 同上模式。  
**修复：** 同 P3-1 加锁。

### P3-3 🔴 api.js — syncTaskUpdate 用错 ID

**文件：** `nantang-mobile/js/api.js`，第 101-105 行  
**问题：** `PUT /api/tasks/{task_id}` 传入客户端 name 而非服务端 `_srvId`，收到 404 静默失败。  
**修复：** 改为：

```javascript
var srvId = task._srvId || name;
xhr.open('PUT', '/api/tasks/' + encodeURIComponent(srvId), true);
```

### P3-4 🔴 ui-cardroom.js — NT.spend 浮点数 0.1（2 处）

**文件：** `nantang-mobile/js/ui-cardroom.js`，第 1031 行和第 1081 行  
**问题：** `NT.spend(g.name, 0.1, ...)` 将用户余额 corrupt 为浮点数；服务端 Pydantic int 截断为 0。  
**修复：** 两处都改为：

```javascript
NT.spend(g.name, 1, '猜错: ' + (d.actionLabel||d.description), 'personal');
```

### P3-5 🔴 index.html — filterQuests 搜索用 ID 而非 title

**文件：** `nantang-mobile/index.html`（或 core.js），第 244-255 行  
**问题：** 从服务端同步的任务 name 是 UUID，用户搜索"筹备会"永不命中。  
**修复：**

```javascript
if (keyword) items = items.filter(function(t) {
  return (t.name||'').toLowerCase().indexOf(keyword)!==-1
      || (t.title||'').toLowerCase().indexOf(keyword)!==-1
      || (t.note||'').toLowerCase().indexOf(keyword)!==-1;
});
```

### P3-6 🔴 core.js — sync 丢弃 location_id

**文件：** `nantang-mobile/js/core.js`，第 204-206 行（_mergeSyncData / sync 逻辑）  
**问题：** 服务端→客户端同步时 location_id 被丢弃。  
**修复：** 在 sync 映射中加 `locationId: t.location_id || ''`

### P3-7 🔴 core.js + index.html — _avatarSeedPool 重复定义

**文件：** `nantang-mobile/js/core.js`，第 1002 行 和 `nantang-mobile/index.html`，第 1221 行  
**问题：** 变量在两个文件中各定义一次。  
**修复：** 删除 index.html 中的重复定义。

### P3-8 🔴 core.js + index.html — _secFold 重复定义

**文件：** `nantang-mobile/js/core.js`，第 197 行 和 `nantang-mobile/index.html`，第 1218 行  
**问题：** 同上。  
**修复：** 删除 index.html 中的重复定义。

### P3-9 🔴 nt-core.js — earnFromPool / spendToPool 不校验 amount>0

**文件：** `nantang-mobile/js/nt-core.js`，第 392 行和第 418 行  
**问题：** amount=0 写空 ledger；负数逆流方向。  
**修复：** 两函数开头各加：

```javascript
if (amount <= 0) { console.error('[NT] amount must be > 0, got', amount); return null; }
```

### P3-10 🔴 nt-core.js — batchSettle 死代码仍导出

**文件：** `nantang-mobile/js/nt-core.js`，第 274-347 行  
**问题：** 注释说 DEAD CODE 但仍在 `window.NT` 导出对象中，调用则双重扣款。  
**修复：** 函数入口加：

```javascript
function batchSettle() {
  console.error('[NT] batchSettle() is disabled. Use verifyTask() instead.');
  return { settled: 0, error: 'disabled' };
```

### P3-11 🔴 nt-core.js — deposit/withdraw 静默返回 null 仍导出

**文件：** `nantang-mobile/js/nt-core.js`，第 102-124 行  
**问题：** `NT.deposit()` / `NT.withdraw()` 永远返回 null，但仍在导出对象中，语义误导。  
**修复：** 从 `window.NT` 导出对象中移除这两个键。

### P3-12 🔴 app-data.js — campRmb 未初始化

**文件：** `nantang-mobile/js/app-data.js`，第 9-42 行（init）  
**问题：** `_data.campRmb` 未显式初始化，首次保存前刷新丢失。  
**修复：** init 中加：

```javascript
if (this._data.campRmb === undefined) this._data.campRmb = 0;
```

### P3-13 🔴 app-data.js — tickDirtiness / poolRefill 未用 Clock

**文件：** `nantang-mobile/js/app-data.js`，第 547 行和第 560 行  
**问题：** 使用 `new Date().toISOString()` 而非 `Clock.today()`，虚拟时间模式不一致。  
**修复：** 统一为：

```javascript
var today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
```

### P3-14 🟡 app-data.js — myItems 死数据

**文件：** `nantang-mobile/js/app-data.js`，第 38 行  
**问题：** `_savePrivate` 保存 `myItems` 字段但从未被读取使用，浪费存储。  
**修复：** 确认无使用后从 `_savePrivate` 移除 `myItems`。

---

## P4 · 服务端健壮性（3 个）

### P4-1 🟡 nt.py + tasks.py — task_id 碰撞风险

**文件：** `server/routes/nt.py`，第 252 行 和 `server/routes/tasks.py`，第 38-39 行  
**问题：** `datetime.utcnow().strftime('%f')` 同一微秒两次调用产生相同 ID，主键冲突 500。  
**修复：** ID 加随机后缀：

```python
import secrets
task_id = f"T{datetime.utcnow().strftime('%y%m%d%H%M%S')}-{secrets.token_hex(3)}"
```

### P4-2 🟡 data.py — sync_all 返回全量任务但注释说"我的任务"

**文件：** `server/routes/data.py`，第 324-354 行  
**问题：** 无 user 过滤，返回所有用户的任务。注释和实际行为不一致。  
**修复：** 决策——sync_all 应返回"我的任务"（注释正确，代码有 bug）。加 user 过滤：

```python
# sync_all（约302行）：加 user 过滤
tasks_r = await db.execute(
    select(NTTask).where(
        (NTTask.poster == user.id) | (NTTask.assignee == user.id)
    ).order_by(NTTask.created_at.desc())
)
```
> 决策理由：注释写"我的任务"说明设计意图如此。返回全量任务会导致移动端数据量膨胀、同步慢、且泄露其他用户的任务信息。

### P4-3 🟢 models.py — Camp 缺 season 字段

**文件：** `server/models.py`，第 81-103 行  
**问题：** 客户端传入 season（"第四期"），服务端 Camp 无此列，数据丢失。  
**修复：** Camp 模型加 `season = Column(String, nullable=True)`

---

## 文件变更汇总

| 文件 | P0 | P1 | P2 | P3 | P4 | 总改动 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
| `server/routes/auth.py` | 2 | — | — | — | — | +6 行 |
| `server/routes/nt.py` | — | 6 | 4 | — | 1 | +60 行 |
| `server/routes/tasks.py` | — | — | 3 | — | 1 | +12 行 |
| `server/routes/camps.py` | 1 | 1 | — | — | — | +8 行 |
| `server/routes/data.py` | 2 | — | — | — | 1 | +12 行 |
| `server/models.py` | — | 1 | — | — | 1 | +3 行 |
| `nantang-mobile/index.html` | 2 | — | — | 3 | — | +10 行 |
| `nantang-mobile/js/nt-core.js` | — | 3 | 2 | 4 | — | +50 行 |
| `nantang-mobile/js/core.js` | — | — | 1 | 3 | — | +15 行 |
| `nantang-mobile/js/app-data.js` | — | 2 | — | 3 | — | +12 行 |
| `nantang-mobile/js/api.js` | — | — | — | 1 | — | +2 行 |
| `nantang-mobile/js/data.js` | — | — | 2 | — | — | +8 行 |
| `nantang-mobile/js/ui-cardroom.js` | — | — | — | 1 | — | +2 行 |

---

## 执行顺序

```
P0-1 → P0-2 → P0-3 → P0-4 → P0-5 → P0-6
  ↓
P1-1 → P1-2 → P1-3 → P1-4 → P1-5 → P1-6 → P1-7 → P1-8 → P1-9 → P1-10 → P1-11
  ↓
P2-1 → P2-2 → P2-3 → P2-4 → P2-5 → P2-6 → P2-7 → P2-8 → P2-9 → P2-10 → P2-11
  ↓
P3-1 → P3-2 → P3-3 → P3-4 → P3-5 → P3-6 → P3-7 → P3-8 → P3-9 → P3-10 → P3-11 → P3-12 → P3-13 → P3-14
  ↓
P4-1 → P4-2 → P4-3
  ↓
验证：`python -c "from main import app"` + 全部 `node -c` + 运行时测试
```

---

## 已知暂缓（2 个 QA 🔴 发现，不在本轮修复范围）

| # | 发现 | 暂缓理由 |
|---|------|---------|
| Q1 | nt.py:115 — transfer 并发绕过余额检查（缺 SELECT ... FOR UPDATE） | MVP 并发极低（<5 用户），行级锁引入复杂度不值得。并发量上来后加 `with_for_update()` |
| Q2 | nt.py:topUp 不补 pool.balance — 只增 total_issued，长期运行 pool 枯竭 | A2-1 初始注资持久化覆盖初始场景；持续运营的 pool 补充机制需单独设计（如每月从 total_issued 自动划拨） |

## 架构债标注

**三套 NT 并行模型**（创意总监 🔴 #1）：nt-core.js（客户端内存）/ nt.js（客户端旧层）/ server（SQLAlchemy）。三个系统各自记账，HTTP 模式下状态存在漂移。

本轮方案选择**修复症状而非重构架构**——补 CV 差异、补 camp_pool 支持、补缺失端点。这是 MVP 阶段的务实取舍。

触发重构条件：当 `NT.verify()` 在 HTTP 模式下的 `diff` 值持续 >10 超过 3 天，或跨设备数据不一致的用户反馈 ≥3 次时，启动"统一 NT 真相源"重构。

---

*方案 v2 完毕。已根据审查意见修正：P1-8/P1-9 读写对齐、P1-10 迁移兼容、5 个缺代码条目补全、P1-5 cashout 完整实现、P4-2 决策+代码、2 个暂缓+架构债标注。*
