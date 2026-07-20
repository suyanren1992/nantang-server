# NT Three-Pool Redesign

> Systems Design | 2026-07-19 | Status: DRAFT — awaiting user decisions on marked items

---

## 1. Current Architecture Audit

### 1.1 Pool Structure (Current)

```
SYSTEM_POOL = 0       ← single undifferentiated pool
TASK_ESCROW  = 0      ← frozen task NT
_totalIssued = 0      ← total NT ever deposited

Accounting: sum(users.ntBalance) + SYSTEM_POOL + TASK_ESCROW = _totalIssued
```

### 1.2 Flow Diagram (Current)

```
   earn(user, N, reason)         spend(user, N, reason)
   ┌─────────────────┐           ┌─────────────────┐
   │ SYSTEM_POOL -= N │           │ SYSTEM_POOL += N │
   │ user.balance += N│           │ user.balance -= N│
   └─────────────────┘           └─────────────────┘

   All earns debit SYSTEM_POOL (can go negative — infinite mint)
   All spends credit SYSTEM_POOL (accumulates, no purpose)
```

### 1.3 Issues Found

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | Single `SYSTEM_POOL` — no community/camp/personal separation | High | Cannot track community finances vs camp finances |
| 2 | `NT.earn()` always debits SYSTEM_POOL regardless of action type | High | Cleaning, farming, camp tasks all draw from same undifferentiated pool |
| 3 | No pool receives community income (accommodation fees, space fees) | High | Community has expenses but no revenue mechanism |
| 4 | `NT.spend()` returns NT to SYSTEM_POOL — no destination differentiation | Medium | Accommodation payment and tag fee both go to same bucket |
| 5 | No per-camp pool accounting | Medium | Camp finances invisible; cross-camp subsidy unavoidable |
| 6 | `verifyAction()` hardcodes `NT.earn()` with no pool routing | High | All verification rewards go through same path |
| 7 | `scope` parameter ('camp'/'personal') is a ledger tag only — no actual pool routing | Low | Misleading API surface |

### 1.4 All Live Call Sites

| File | Line | Call | Current Behavior |
|------|------|------|-----------------|
| `app-data.js` | 306 | `NT.earn(vfy.doer, vfy.ntAmount, vfy.action, 'camp')` | Debits SYSTEM_POOL, credits doer |
| `app-data.js` | 309 | `NT.earn(verifierName, vfy.verifierReward, '校核: '+vfy.action, 'personal')` | Debits SYSTEM_POOL, credits verifier |
| `app-data.js` | 346 | `NT.spend(flipperName, 1, '帮 '+targetName+' 翻牌', 'personal')` | Debits flipper, credits SYSTEM_POOL |

All 3 call sites are in `app-data.js`. The map actions (`_doCleaning`, `_syncItemToAppData`) go through `addVerification()` queue — `verifyAction()` is the sole NT payout path.

---

## 2. Three-Pool Model

### 2.1 Pool Variables

```javascript
// ── Pool Variables ──
var COMMUNITY_POOL = 0;        // 社区公共池 — funds public goods
var CAMP_POOLS = {};           // campId → balance — per-camp pools
var TASK_ESCROW = 0;           // unchanged — frozen task NT
var _totalIssued = 0;          // unchanged — total NT deposited

// SYSTEM_POOL → REMOVED (migrated into COMMUNITY_POOL)
// PUBLIC_CV_POOL → unchanged (CV is separate from NT)
```

### 2.2 Accounting Equation

```
sum(users.ntBalance) + COMMUNITY_POOL + sum(CAMP_POOLS.values) + TASK_ESCROW = _totalIssued
```

### 2.3 Pool Purposes and Money Flow

```
COMMUNITY_POOL (社区公共池)
  INCOME:
    + accommodation fees    (住宿费, personal → community)
    + space usage fees      (空间使用费, personal → community)
    + activity revenue share(活动分成, personal → community)
    + tag fees              (标签费, personal → community)
    + transfer CV wear      (转账磨损 25% CV → public CV pool, NT stays)
    + external deposit      (depositToCommunityPool)
  EXPENSE:
    - newbie quests         (新手任务 → personal)
    - cleaning (routine)    (日常打扫 → personal)
    - cleaning (deep)       (大扫除 → personal)
    - info entry            (信息录入 → personal)
    - farming actions       (农活 → personal)
    - field discovery       (发现者 → personal)
    - verification rewards  (校核者 → personal)
    - flipForOther cost     (翻牌代价 → community receives this, not pays)

CAMP_POOL[campId] (营队资金池)
  INCOME:
    + camp registration     (营队报名费, personal → camp pool)
    + camp activity income  (营队活动收入 → camp pool)
    + external deposit      (depositToCampPool)
  EXPENSE:
    - camp task bounties    (营队任务悬赏 → personal)
    - camp activity costs   (营队活动开支 → personal)

PERSONAL (user.ntBalance)
  INCOME:
    + all rewards from COMMUNITY_POOL or CAMP_POOL
    + transfers from other users
    + topUp (external deposit)
  EXPENSE:
    - fees to COMMUNITY_POOL
    - transfers to other users
    - cashOut (external withdrawal)
```

### 2.4 Flow Diagram (New)

```
                    ┌──────────────────────────┐
  accommodation ──→ │                          │──→ cleaning rewards
  space fees ─────→ │     COMMUNITY_POOL       │──→ farming rewards
  tag fees ───────→ │                          │──→ newbie quests
  flipForOther ───→ │                          │──→ verification rewards
                    └──────────────────────────┘

                    ┌──────────────────────────┐
  camp reg ───────→ │   CAMP_POOL['camp4']     │──→ camp task rewards
  camp income ────→ │                          │──→ camp expenses
                    └──────────────────────────┘

                    ┌──────────────────────────┐
  rewards ────────→ │                          │──→ fees to community
  transfers ─────→ │   user.ntBalance          │──→ transfers to others
  topUp ─────────→ │                          │──→ cashOut
                    └──────────────────────────┘
```

---

## 3. New API Surface

### 3.1 Core Pool Operations

#### `NT.earnFromPool(userId, amount, reason, poolType, poolId?)`

De bits the specified pool, credits the user.

| Param | Type | Range | Description |
|-------|------|-------|-------------|
| userId | string | registered user | Recipient |
| amount | number | > 0 | NT to transfer |
| reason | string | any | Ledger description |
| poolType | string | 'community' \| 'camp' | Source pool type |
| poolId | string? | valid campId | Required when poolType='camp' |

**Expression:**
```
user.ntBalance += amount
if poolType == 'community': COMMUNITY_POOL -= amount
if poolType == 'camp':     CAMP_POOLS[poolId] -= amount  (auto-create if absent)
```

**Output range:** Unbounded — COMMUNITY_POOL can go negative (see Decision A).

**Worked example:**
```
NT.earnFromPool('小杨', 10, '打扫了厨房', 'community')
→ 小杨.ntBalance += 10, COMMUNITY_POOL -= 10

NT.earnFromPool('朝林', 50, '完成营队任务:画壁画', 'camp', 'camp4')
→ 朝林.ntBalance += 50, CAMP_POOLS['camp4'] -= 50
```

---

#### `NT.spendToPool(userId, amount, reason, poolType, poolId?)`

Debits the user, credits the specified pool.

| Param | Type | Range | Description |
|-------|------|-------|-------------|
| userId | string | registered user | Payer |
| amount | number | > 0, ≤ user.ntBalance | NT to transfer |
| reason | string | any | Ledger description |
| poolType | string | 'community' \| 'camp' | Destination pool type |
| poolId | string? | valid campId | Required when poolType='camp' |

**Expression:**
```
user.ntBalance -= amount
if poolType == 'community': COMMUNITY_POOL += amount
if poolType == 'camp':     CAMP_POOLS[poolId] += amount
```

**Output range:** Returns user object on success, null if insufficient balance.

**Worked example:**
```
NT.spendToPool('王五', 150, '住宿费 dorm101 5天', 'community')
→ 王五.ntBalance -= 150, COMMUNITY_POOL += 150
```

---

### 3.2 Pool Query

| Function | Returns | Description |
|----------|---------|-------------|
| `NT.getCommunityPool()` | number | COMMUNITY_POOL balance |
| `NT.getCampPool(campId)` | number | CAMP_POOLS[campId] balance (0 if not yet created) |
| `NT.getAllCampPools()` | {campId: balance} | All camp pool balances |

### 3.3 Pool Injection

| Function | Description |
|----------|-------------|
| `NT.depositToCommunityPool(amount, reason)` | External NT injection into community pool. Increases _totalIssued. |
| `NT.depositToCampPool(campId, amount, reason)` | External NT injection into camp pool. Increases _totalIssued. |

### 3.4 Backward-Compatible Wrappers

> **Decision C (Recommendation: Keep as wrappers)**

Existing `earn()` and `spend()` remain as wrappers that default to COMMUNITY_POOL:

```javascript
// Old API → preserved, routes to community pool
function earn(userId, amount, reason, scope) {
  return earnFromPool(userId, amount, reason, 'community');
}
function spend(userId, amount, reason, scope) {
  return spendToPool(userId, amount, reason, 'community');
}
```

The `scope` parameter is retained as a ledger tag (stored in the ledger entry's `type` field) but no longer controls pool routing.

---

## 4. Action-Pool Routing Config

```javascript
NT.ACTION_POOL = {
  // ═══ Community-funded rewards → COMMUNITY_POOL → personal ═══
  cleaning:       { pool: 'community', amount: 10, verifierReward: 2 },
  stock_in:       { pool: 'community', amount: 2,  verifierReward: 1 },
  stock_out:      { pool: 'community', amount: 1,  verifierReward: 1 },
  field_action:   { pool: 'community', amount: 5,  verifierReward: 1 },
  field_harvest:  { pool: 'community', amount: 8,  verifierReward: 2 },
  newbie_quest:   { pool: 'community', amount: 10, verifierReward: 0 },
  info_entry:     { pool: 'community', amount: 3,  verifierReward: 1 },
  quest:          { pool: 'community', amount: 0,  verifierReward: 0 },  // amount from task definition
  presence:       { pool: 'community', amount: 0,  verifierReward: 0 },  // flipForOther cost

  // ═══ Payments to community → personal → COMMUNITY_POOL ═══
  accommodation:  { pool: 'community', amount: null },  // variable by room type
  space_usage:    { pool: 'community', amount: null },   // variable
  tag_fee:        { pool: 'community', amount: 5 },

  // ═══ Camp-funded rewards → CAMP_POOL → personal ═══
  camp_task:      { pool: 'camp', amount: null },       // variable, campId required
};
```

### Default values (when config entry missing)

| Fallback | Value |
|----------|-------|
| Default amount | 5 NT |
| Default verifier reward | `Math.ceil(amount / 5) \|\| 1` |
| Default pool | `'community'` |

> **Decision B (Recommendation: Inline in nt-core.js)**
> The config table lives inline in `nt-core.js` for MVP. Exposed as `NT.ACTION_POOL` so an admin UI can read/modify it later. Tuning values without touching core logic requires only editing this object.

---

## 5. Verification Integration

### 5.1 Current (Broken)

```javascript
// app-data.js:297 — verifyAction()
NT.earn(vfy.doer, vfy.ntAmount, vfy.action, 'camp');        // always 'camp' scope
NT.earn(verifierName, vfy.verifierReward, '校核: '+vfy.action, 'personal'); // always 'personal'
```

### 5.2 Redesigned

```javascript
// app-data.js:verifyAction() — pool-routed version
verifyAction: function(vfyId, verifierName) {
  // ... validation unchanged ...

  // Look up pool routing from config
  var cfg = (window.NT && NT.ACTION_POOL) ? (NT.ACTION_POOL[vfy.type] || {}) : {};
  var poolType = cfg.pool || 'community';
  var campId = (vfy.detail && vfy.detail.campId) || null;

  // Doer reward — from appropriate pool
  if (window.NT && vfy.ntAmount > 0) {
    try {
      if (poolType === 'camp' && campId) {
        NT.earnFromPool(vfy.doer, vfy.ntAmount, vfy.action, 'camp', campId);
      } else {
        NT.earnFromPool(vfy.doer, vfy.ntAmount, vfy.action, 'community');
      }
    } catch(e) {}
  }

  // Verifier reward — always from community pool
  if (window.NT && vfy.verifierReward > 0) {
    try {
      NT.earnFromPool(verifierName, vfy.verifierReward, '校核: '+vfy.action, 'community');
    } catch(e) {}
  }

  this.addAnnouncement(vfy.type, vfy.doer, verifierName, vfy.action, vfy.ntAmount);
  this._saveShared(true);
  return { ok: true };
}
```

### 5.3 flipForOther — pool-routed

```javascript
// Current: NT.spend(flipperName, cost, ..., 'personal')
// New:     NT.spendToPool(flipperName, cost, ..., 'community')
// The 1 NT flip cost goes INTO the community pool (it's a fee, not destroyed)
```

---

## 6. Migration Plan

### Phase 1 — Additive (zero risk, no behavior change)

```
1. Add COMMUNITY_POOL = 0, CAMP_POOLS = {} to nt-core.js
2. Add earnFromPool(), spendToPool(), getCommunityPool(), getCampPool(),
   getAllCampPools(), depositToCommunityPool(), depositToCampPool()
3. Initialize COMMUNITY_POOL from existing SYSTEM_POOL on load:
   if (loadedState.sp !== undefined) { COMMUNITY_POOL = loadedState.sp; }
4. Update saveState() to persist COMMUNITY_POOL and CAMP_POOLS:
   cp: COMMUNITY_POOL, cmp: CAMP_POOLS
5. Update loadState() to restore new pools:
   COMMUNITY_POOL = s.cp || s.sp || 0;  CAMP_POOLS = s.cmp || {};
6. Update verify() accounting equation to include new pools
7. Keep earn()/spend() unchanged (still use SYSTEM_POOL for transition)
```

### Phase 2 — Route Through New Pools

```
1. Update verifyAction() to use earnFromPool() with ACTION_POOL lookup
2. Update flipForOther() to use spendToPool() → community
3. Old earn()/spend() → set as wrappers calling earnFromPool/spendToPool
   with default pool='community'
```

### Phase 3 — Cleanup

```
1. Remove SYSTEM_POOL variable
2. Remove all SYSTEM_POOL references
3. SaveState: drop 'sp' key, only persist 'cp'
4. LoadState: accept 'sp' for backward compat, map to 'cp'
```

### Migration Safety

- **Old localStorage data auto-migrates**: `loadState()` reads old `sp` key and maps to `COMMUNITY_POOL`
- **No data loss**: All user balances, ledger entries, and TASK_ESCROW unchanged
- **Rollback**: If Phase 2 fails, revert to Phase 1 state — community pool still holds correct balance
- **Accounting holds throughout**: At every phase, `sum(users) + COMMUNITY_POOL + sum(CAMP_POOLS) + TASK_ESCROW = _totalIssued`

---

## 7. Call Site Mapping (Complete)

| # | File | Current Call | New Call | Pool |
|---|------|-------------|----------|------|
| 1 | `app-data.js:306` | `NT.earn(vfy.doer, vfy.ntAmount, vfy.action, 'camp')` | `NT.earnFromPool(vfy.doer, vfy.ntAmount, vfy.action, poolType, campId?)` | community or camp (from ACTION_POOL) |
| 2 | `app-data.js:309` | `NT.earn(verifierName, vfy.verifierReward, ..., 'personal')` | `NT.earnFromPool(verifierName, vfy.verifierReward, ..., 'community')` | community (always) |
| 3 | `app-data.js:346` | `NT.spend(flipperName, 1, ..., 'personal')` | `NT.spendToPool(flipperName, 1, ..., 'community')` | community |

---

## 8. Updated verify() — Accounting Check

```javascript
function verify() {
  // ... user balance summation unchanged ...

  // New accounting equation
  var totalCampPools = 0;
  Object.keys(CAMP_POOLS).forEach(function(cid) {
    totalCampPools += CAMP_POOLS[cid];
  });

  var totalSystem = totalUserBalance + COMMUNITY_POOL + totalCampPools + TASK_ESCROW;

  result.checks.communityPool = COMMUNITY_POOL;
  result.checks.campPools = totalCampPools;
  result.checks.totalSystem = totalSystem;

  if (Math.abs(totalSystem - _totalIssued) > 0.001) {
    result.pass = false;
    result.issues.push(
      '会计等式不成立: 用户('+totalUserBalance+') + 社区池('+COMMUNITY_POOL+
      ') + 营队池('+totalCampPools+') + 任务托管('+TASK_ESCROW+
      ') = '+totalSystem+' ≠ 存入('+_totalIssued+')'
    );
  }
  return result;
}
```

---

## 9. Updated Save/Load

```javascript
// Save — add cp (community pool) and cmp (camp pools)
function _saveState(immediate) {
  var doWrite = function() {
    try {
      localStorage.setItem(NT_STORE_KEY, JSON.stringify({
        u: USERS, t: TASKS, l: LEDGER, st: SETTLEMENTS,
        ti: _totalIssued,
        cp: COMMUNITY_POOL,        // NEW — replaces sp
        cmp: CAMP_POOLS,           // NEW
        te: TASK_ESCROW,
        cv: PUBLIC_CV_POOL,
        pt: _processedTxIds,
        sq: _seq
      }));
    } catch(e) { console.warn('[NT] 存档失败', e); }
  };
  // ... debounce logic unchanged ...
}

// Load — accept old 'sp' key for backward compat
function _loadState() {
  try {
    var raw = localStorage.getItem(NT_STORE_KEY);
    if (!raw) return;
    var s = JSON.parse(raw);
    USERS = s.u || {};
    TASKS = s.t || {};
    LEDGER = s.l || [];
    SETTLEMENTS = s.st || [];
    _totalIssued = s.ti || 0;
    COMMUNITY_POOL = s.cp || s.sp || 0;  // NEW: prefer cp, fallback to old sp
    CAMP_POOLS = s.cmp || {};             // NEW
    TASK_ESCROW = s.te || 0;
    PUBLIC_CV_POOL = s.cv || 0;
    _processedTxIds = s.pt || {};
    _seq = s.sq || { task:0, ledger:0, settlement:0 };
  } catch(e) { console.warn('[NT] 加载存档失败，使用空状态'); }
}
```

---

## 10. Pending Decisions

| Decision | Options | Recommendation | Why |
|----------|---------|---------------|-----|
| **A. COMMUNITY_POOL negative?** | Allow / Enforce | **Allow negative** | Matches current behavior (ponytail). SYSTEM_POOL already goes negative. Funding enforcement adds complexity — add later when real revenue flows exist. |
| **B. Config location** | Inline in nt-core.js / Separate file | **Inline** | Single file, no dependency. Exposed as `NT.ACTION_POOL` for future admin UI read/write. |
| **C. Backward compat** | Keep wrappers / Remove old API | **Keep wrappers** | 3 call sites confirmed — but there may be others in files not yet migrated to verification pipeline. Wrappers cost 4 lines each; breaking changes risk missed call sites. |

---

## 11. Affected Files Summary

| File | Changes |
|------|---------|
| `nt-core.js` | +2 pool variables, +6 new functions, updated save/load/verify, ACTION_POOL config, earn/spend → wrappers |
| `app-data.js` | `verifyAction()` — 2 lines changed (earn → earnFromPool); `flipForOther()` — 1 line changed (spend → spendToPool) |
| `app.js` (map) | No changes needed — already routes through AppData verification pipeline |

---

## 12. ledger type Convention

All ledger entries use the `type` field for categorization. New convention:

```
[pool]_[direction]_[action]

Examples:
  community_earn_cleaning       — reward from community pool for cleaning
  community_spend_accommodation — payment to community pool for accommodation
  camp_earn_task_camp4          — reward from camp4 pool for task
  camp_spend_registration       — payment to camp pool for registration
  community_earn_verification   — verifier reward from community pool
```

This keeps the existing `_addLedger(from, to, amount, type, reason, taskId)` signature unchanged — only the `type` string changes to encode pool routing.