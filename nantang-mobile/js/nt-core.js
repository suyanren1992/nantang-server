// ══════════════════════════════════════════════════════════════
// nt-core.js — 南塘云村 NT 结算系统（平台层/链下记账）
//
// 对齐「平台结算系统整体方案 v1.0」
// 数据结构：nt_users / nt_tasks / nt_ledger / nt_settlement
// 核心流程：发布→冻结→接取→完成→验证→释放→结算
//
// MVP 阶段：全内存操作。未来接合约/后端时换内部实现，调用方不动。
// ══════════════════════════════════════════════════════════════

;(function() {

// ── 计数器 ──
var _seq = { task:0, ledger:0, settlement:0 };
function _tid() { _seq.task++; return 'T' + _fmt(6) + '-' + _pad(_seq.task,3); }
function _lid() { _seq.ledger++; return 'L' + _fmt(6) + '-' + _pad(_seq.ledger,3); }
function _bid() { _seq.settlement++; return 'B' + _fmt(6); }
function _fmt(n) { var d = new Date(); return d.getFullYear().toString().slice(2) + _pad(d.getMonth()+1,2) + _pad(d.getDate(),2); }
function _pad(n,w) { var s=''+n; while(s.length<w)s='0'+s; return s; }

// ── 数据存储 ──
var USERS = {};       // userId → userObject
var TASKS = {};       // taskId → taskObject
var LEDGER = [];      // entry[]
var SETTLEMENTS = []; // batch[]

// ── 会计等式 ──
// sum(user.ntBalance) + sum(CAMP_POOLS) + TASK_ESCROW + COMMUNITY_POOL === _totalIssued
//   user.ntBalance  : 用户手中可自由支配的 NT
//   TASK_ESCROW     : 被任务冻结的 NT（创建任务时从发布者扣，验证后释放给执行者）
//   COMMUNITY_POOL  : 社区池（初始注资存放处，住宿费等收入进这里，劳动奖励从这里出）
//   _totalIssued : 通过 deposit() / 初始注资进入系统的 NT 总额
var _totalIssued = 0;
var COMMUNITY_POOL = 0;
var CAMP_POOLS = {};       // { campId: balance }
var TASK_ESCROW = 0;

// ── localStorage 持久化 ──
var NT_STORE_KEY = 'nt_core_v1';
var _saveTimer = null;
function _loadState() {
  try {
    var raw = localStorage.getItem(NT_STORE_KEY);
    if (!raw) return;
    var s = JSON.parse(raw);
    USERS = s.u || {}; TASKS = s.t || {}; LEDGER = s.l || []; SETTLEMENTS = s.st || [];
    _totalIssued = s.ti != null ? s.ti : 0; COMMUNITY_POOL = s.cmp != null ? s.cmp : (s.sp != null ? s.sp : 0); CAMP_POOLS = s.cps || {}; TASK_ESCROW = s.te != null ? s.te : 0; PUBLIC_CV_POOL = s.cvp != null ? s.cvp : (s.cp != null ? s.cp : 0);
    _processedTxIds = s.pt || {};
    _seq = s.sq || { task:0, ledger:0, settlement:0 };
  } catch(e) { console.warn('[NT] 加载存档失败，使用空状态'); }
}
// FIX-07: immediate 参数跳过防抖，关键操作（createTask/verifyTask/earn）使用即时写入
function _saveState(immediate) {
  var doWrite = function() {
    try {
      localStorage.setItem(NT_STORE_KEY, JSON.stringify({
        u: USERS, t: TASKS, l: LEDGER, st: SETTLEMENTS,
        ti: _totalIssued, cmp: COMMUNITY_POOL, cps: CAMP_POOLS, te: TASK_ESCROW, cvp: PUBLIC_CV_POOL, pt: _processedTxIds, sq: _seq
      }));
    } catch(e) { console.warn('[NT] 存档失败', e); }
  };
  if (immediate) { doWrite(); return; }
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(doWrite, 300);
}

// ═══════════════════════════════════════════════
//  用户管理
// ═══════════════════════════════════════════════

function registerUser(userId, initialDeposit) {
  if (USERS[userId]) return USERS[userId];
  USERS[userId] = {
    userId: userId,
    walletAddress: null,           // 钱包未接入时为 null
    ntBalance: initialDeposit || 0,
    contributionValue: 0,
    experienceValue: 0,
    depositBalance: 0,             // 托管合约中的保证金（模拟）
    frozenDeposit: 0,              // 冻结中的保证金
    availableDeposit: 0,
    trustScore: 100,
    trustLevel: '可信',
    totalTasksPosted: 0,
    totalTasksCompleted: 0,
    totalEarned: 0,
    totalPaid: 0,
    createdAt: new Date().toISOString()
  };
  if (initialDeposit) {
    _addLedger(null, userId, initialDeposit, 'deposit', 'initial');
    USERS[userId].ntBalance = initialDeposit;
    _totalIssued += initialDeposit;
  }
  return USERS[userId];
}

// ═══════════════════════════════════════════════
//  保证金操作（模拟合约 deposit/withdraw）
// ═══════════════════════════════════════════════

function deposit(userId, amount) {
  console.warn('[NT] deposit() deprecated, use topUp()');
  return null;
  var u = _getUser(userId); if (!u) return null;
  u.depositBalance += amount;
  u.availableDeposit += amount;
  _addLedger(null, userId, amount, 'deposit', '充值保证金');
  _totalIssued += amount;
  _saveState(true); return u;
}

function withdraw(userId, amount) {
  console.warn('[NT] withdraw() deprecated, use cashOut()');
  return null;
  var u = _getUser(userId); if (!u) return null;
  if (u.availableDeposit < amount) return _err('可用保证金不足');
  u.depositBalance -= amount;
  u.availableDeposit -= amount;
  u.ntBalance -= amount;
  _addLedger(userId, null, amount, 'withdraw', '提现保证金');
  _totalIssued -= amount;
  _saveState(true); return u;
}

// ═══════════════════════════════════════════════
//  任务生命周期
// ═══════════════════════════════════════════════

function createTask(posterId, title, reward, category, assigneeId) {
  var poster = _getUser(posterId); if (!poster) return null;
  if (poster.ntBalance < reward) return _err('NT 余额不足，无法发布任务（需要 '+reward+' NT，当前 '+poster.ntBalance+' NT）');

  // 冻结 NT：从发布者余额扣，进入任务托管
  poster.ntBalance -= reward;
  TASK_ESCROW += reward;

  var taskId = _tid();
  var now = new Date().toISOString();

  TASKS[taskId] = {
    taskId: taskId,
    title: title,
    category: category || 'other',
    reward: reward,
    poster: posterId,
    assignee: assigneeId || null,
    status: assigneeId ? 'active' : 'pending',
    createdAt: now,
    acceptedAt: assigneeId ? now : null,
    completedAt: null,
    verifiedAt: null,
    settledAt: null,
    evidence: null,
    verifiedBy: null,
    verifierId: null,
    txHash: null,
    batchId: null,
    disputeReason: null
  };

  poster.totalTasksPosted++;
  if (assigneeId) {
    var assignee = _getUser(assigneeId);
    if (assignee) assignee.totalTasksCompleted++;
  }

  _addLedger(posterId, 'escrow', reward, 'task_freeze', '发布任务: '+title, taskId);
  _saveState(true); return TASKS[taskId];
}

function acceptTask(taskId, assigneeId) {
  var t = _getTask(taskId); if (!t) return null;
  if (t.status !== 'pending') return _err('任务已被接取');
  var assignee = _getUser(assigneeId); if (!assignee) return null;

  t.assignee = assigneeId;
  t.status = 'active';
  t.acceptedAt = new Date().toISOString();
  assignee.totalTasksCompleted++;

  _addLedger(null, null, 0, 'task_accept', '接取任务: '+t.title, taskId);
  _saveState(true); return t;
}

function submitTask(taskId, evidence) {
  var t = _getTask(taskId); if (!t) return null;
  if (t.status !== 'active') return _err('任务不在进行中状态');
  t.status = 'completed';
  t.completedAt = new Date().toISOString();
  t.evidence = evidence || {};
  _addLedger(null, null, 0, 'task_submit', '提交任务: '+t.title, taskId);
  _saveState(true); return t;
}

function verifyTask(taskId, verifierId, approved, reason) {
  var t = _getTask(taskId); if (!t) return null;
  // ponytail: 允许 active/completed/verified 三种状态的任务被验证。pending（未接取）仍然拒绝。
  if (t.status === 'pending' || t.status === 'settled' || t.status === 'cancelled' || t.status === 'disputed')
    return _err('任务状态('+t.status+')不可验证');

  var poster = _getUser(t.poster);
  var assignee = _getUser(t.assignee);
  var now = new Date().toISOString();

  if (approved) {
    t.status = 'verified';
    t.verifiedAt = now;
    t.verifiedBy = 'admin';
    t.verifierId = verifierId;

    // 释放托管 → NT 转入执行者账户
    TASK_ESCROW -= t.reward;
    if (assignee) {
      assignee.ntBalance += t.reward;
      assignee.totalEarned += t.reward;
      assignee.contributionValue = (assignee.contributionValue||0) + t.reward;
      assignee.experienceValue = (assignee.experienceValue||0) + t.reward;
    }
    poster.totalPaid += t.reward;

    _addLedger(t.poster, t.assignee, t.reward, 'task_reward', '任务验证通过: '+t.title, taskId);

    // 信誉
    if (assignee) _adjustTrust(assignee, +5);
    _adjustTrust(poster, +3);

  } else {
    t.status = 'disputed';
    t.disputeReason = reason || '';

    // 退还托管 NT 给发布者
    TASK_ESCROW -= t.reward;
    poster.ntBalance += t.reward;

    _addLedger('escrow', t.poster, t.reward, 'refund', '任务退回: '+t.title, taskId);
    if (assignee) _adjustTrust(assignee, -15);
  }

  _saveState(true); return t;
}

function cancelTask(taskId, reason) {
  var t = _getTask(taskId); if (!t) return null;
  if (t.status === 'settled' || t.status === 'verified') return _err('已结算/已验证任务无法取消，请发起争议');
  if (t.status === 'completed' || t.status === 'disputed' || t.status === 'cancelled') return _err('任务状态('+t.status+')不允许取消');

  var poster = _getUser(t.poster);

  // 退还托管 NT
  TASK_ESCROW -= t.reward;
  poster.ntBalance += t.reward;

  t.status = 'cancelled';
  t.disputeReason = reason || '';

  _addLedger('escrow', t.poster, t.reward, 'refund', '取消任务: '+t.title, t.taskId);
  if (t.assignee) {
    var assignee = _getUser(t.assignee);
    if (assignee) _adjustTrust(assignee, -5);
  }
  _saveState(true); return t;
}

function disputeTask(taskId) {
  var t = _getTask(taskId); if (!t) return null;
  t.status = 'disputed';
  _addLedger(null, null, 0, 'dispute', '发起争议: '+t.title, taskId);
  _saveState(true); return t;
}

// ═══════════════════════════════════════════════
//  批量结算（净额清算）
// ═══════════════════════════════════════════════

// ⚠️ DEAD CODE — MVP阶段不使用。verifyTask() 已直接完成转账，再次调用 batchSettle 会导致双重扣款。
// 启用条件：将 verifyTask 中的转账逻辑移除，仅保留状态变更，由 batchSettle 统一结算。
// 见执行方案 FIX-14。
function batchSettle() {
  // 收集所有 verified 但未 settled 的流水
  var entries = LEDGER.filter(function(e) {
    return e.type === 'task_reward' && e.status === 'pending' && e.taskId;
  });

  if (entries.length === 0) return { settled: 0, batchId: null };

  // 净额清算算法
  var balances = {}; // userId → net amount
  entries.forEach(function(e) {
    if (e.from && e.from !== 'system') balances[e.from] = (balances[e.from]||0) - e.amount;
    if (e.to && e.to !== 'system') balances[e.to] = (balances[e.to]||0) + e.amount;
  });

  var payers = [], receivers = [];
  Object.keys(balances).forEach(function(uid) {
    if (balances[uid] < 0) payers.push({ user:uid, amount:-balances[uid] });
    else if (balances[uid] > 0) receivers.push({ user:uid, amount:balances[uid] });
  });

  // 最短路径匹配
  var plan = [];
  var i=0, j=0;
  while (i < payers.length && j < receivers.length) {
    var transfer = Math.min(payers[i].amount, receivers[j].amount);
    plan.push({ from:payers[i].user, to:receivers[j].user, amount:transfer });
    payers[i].amount -= transfer;
    receivers[j].amount -= transfer;
    if (payers[i].amount === 0) i++;
    if (receivers[j].amount === 0) j++;
  }

  var batchId = _bid();
  var now = new Date().toISOString();
  var total = entries.reduce(function(s,e){return s+e.amount;},0);

  SETTLEMENTS.push({
    batchId: batchId,
    periodStart: entries[0].timestamp,
    periodEnd: now,
    settledAt: now,
    totalEntries: entries.length,
    totalAmount: total,
    netPayers: payers.length,
    netReceivers: receivers.length,
    settlementPlan: plan,
    txHash: null,         // 链上交易哈希（后续接）
    gasUsed: null,
    status: 'confirmed'   // MVP: 直接确认
  });

  // 标记流水为已结算
  entries.forEach(function(e) {
    e.status = 'settled';
    e.settledAt = now;
    e.batchId = batchId;
    var t = TASKS[e.taskId];
    if (t) { t.status = 'settled'; t.settledAt = now; t.batchId = batchId; }
  });

  // 执行净额转账
  plan.forEach(function(p) {
    var from = _getUser(p.from), to = _getUser(p.to);
    if (from) from.ntBalance -= p.amount;
    if (to) to.ntBalance += p.amount;
  });

  console.log('[NT] 批量结算完成: '+batchId+' · '+entries.length+'笔→'+plan.length+'笔 · 总额 '+total+' NT');
  _saveState(true); return { settled: entries.length, batchId: batchId, plan: plan, saved: entries.length-plan.length };
}

// ═══════════════════════════════════════════════
//  简化操作（地图端/UI层调用）
// ═══════════════════════════════════════════════

// 向后兼容：路由到 COMMUNITY_POOL
// ponytail: 三池支持前，earn/spend wrapper 固定走 community pool，scope 仅影响 ledger type 标签
function earn(userId, amount, reason, scope) {
  return earnFromPool(userId, amount, reason, 'community', scope);
}

// ponytail: CAMP_POOLS 端到端实现前，spend() 固定走 community pool。scope 仅影响 ledger type 标签。
function spend(userId, amount, reason, scope) {
  return spendToPool(userId, amount, reason, 'community', scope);
}

// 充值：外部 NT 注入系统（增加 _totalIssued，会计等式保持平衡）
// FIX-06: txId 可选，传入则去重（防止管理员双击审批导致双倍到账）
function topUp(userId, amount, reason, txId) {
  if (txId && _processedTxIds[txId]) return _err('该交易已处理，不可重复充值');
  var u = _getUser(userId); if (!u) return null;
  if (amount <= 0) return _err('充值金额必须大于 0');
  u.ntBalance += amount;
  _totalIssued += amount;
  _addLedger('system', userId, amount, 'deposit', reason || '充值');
  if (txId) _processedTxIds[txId] = true;
  _saveState(true); return u;
}

// 提现：NT 退出系统（减少 _totalIssued，会计等式保持平衡）
// FIX-06: txId 可选，传入则去重
function cashOut(userId, amount, reason, txId) {
  if (txId && _processedTxIds[txId]) return _err('该交易已处理，不可重复提现');
  var u = _getUser(userId); if (!u) return null;
  if (u.ntBalance < amount) return _err('NT 余额不足');
  if (amount <= 0) return _err('提现金额必须大于 0');
  u.ntBalance -= amount;
  _totalIssued -= amount;
  _addLedger(userId, 'system', amount, 'withdrawal', reason || '提现');
  if (txId) _processedTxIds[txId] = true;
  _saveState(true); return u;
}

// ══ 章1: 三池 API ══
function earnFromPool(userId, amount, reason, pool, scope) {
  var u = _getUser(userId); if (!u) return null;
  scope = scope || 'personal';
  if (pool !== 'community' && (!pool || pool.indexOf('camp:') !== 0)) {
    console.error('[NT] earnFromPool: invalid pool', pool);
    return null;
  }
  // 检查池子余额
  if (pool === 'community' && COMMUNITY_POOL < amount) {
    console.error('[NT] 社区公共池余额不足！当前:'+COMMUNITY_POOL+' 需要:'+amount);
    return null;
  }
  if (pool === 'community') { COMMUNITY_POOL -= amount; }
  else if (pool && pool.indexOf('camp:') === 0) {
    var campId = pool.slice(5);
    if (!CAMP_POOLS[campId]) CAMP_POOLS[campId] = 0;
    if (CAMP_POOLS[campId] < amount) return null;
    CAMP_POOLS[campId] -= amount;
  }
  u.ntBalance += amount;
  u.totalEarned += amount;
  u.contributionValue = (u.contributionValue||0) + amount;
  u.experienceValue = (u.experienceValue||0) + amount;
  _addLedger(pool||'system', userId, amount, scope+'_earn', reason);
  _saveState(true); return u;
}

function spendToPool(userId, amount, reason, pool, scope) {
  var u = _getUser(userId); if (!u) return null;
  if (u.ntBalance < amount) return _err('NT 余额不足');
  scope = scope || 'personal';
  if (pool !== 'community' && (!pool || pool.indexOf('camp:') !== 0)) {
    console.error('[NT] spendToPool: invalid pool', pool);
    return null;
  }
  u.ntBalance -= amount;
  u.totalPaid += amount;
  if (pool === 'community') { COMMUNITY_POOL += amount; }
  else if (pool && pool.indexOf('camp:') === 0) {
    var campId = pool.slice(5);
    if (!CAMP_POOLS[campId]) CAMP_POOLS[campId] = 0;
    CAMP_POOLS[campId] += amount;
  }
  _addLedger(userId, pool||'system', amount, scope+'_spend', reason);
  _saveState(true); return u;
}

function getCommunityPool() { return COMMUNITY_POOL; }
function getCampPool(campId) { return CAMP_POOLS[campId] || 0; }

function depositToCampPool(campId, amount, reason) {
  if (!CAMP_POOLS[campId]) CAMP_POOLS[campId] = 0;
  CAMP_POOLS[campId] += amount; _totalIssued += amount;
  _addLedger('system', 'camp:' + campId, amount, 'deposit', reason || '营队注资');
  _saveState(true); return CAMP_POOLS[campId];
}

function depositToCommunityPool(amount, reason) {
  COMMUNITY_POOL += amount;
  _totalIssued += amount;
  _addLedger('system', '__community_pool__', amount, 'deposit', reason||'外部注资');
  _saveState(true); return COMMUNITY_POOL;
}

function transfer(fromId, toId, amount, reason) {
  var caller = (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : '';
  var callerRole = ((typeof getUsers === 'function' ? getUsers() : {})[caller] || {}).role || '';
  if (caller !== fromId && callerRole !== 'admin') return _err('无权转账');
  var from = _getUser(fromId), to = _getUser(toId);
  if (!from || !to) return null;
  if (from.ntBalance < amount) return _err('转出方余额不足');
  from.ntBalance -= amount;
  to.ntBalance += amount;
  from.totalPaid += amount;
  to.totalEarned += amount;
  // CV 转移规则: 75%→接收方 + 25%→公共池磨损
  var cvAmount = amount;
  from.contributionValue = Math.max(0, (from.contributionValue||0) - cvAmount);
  to.contributionValue = (to.contributionValue||0) + Math.floor(cvAmount * 0.75);
  _addToPublicPool(Math.floor(cvAmount * 0.25), 'transfer_wear');
  _addLedger(fromId, toId, amount, 'transfer', reason);
  _saveState(true); return { from:from, to:to, amount:amount };
}

// ═══ 公共贡献池 ═══
var PUBLIC_CV_POOL = 0;
// FIX-06: 防重放 — 已处理的 txId 集合
// ponytail: 无过期机制。当审批数 >1000 时改为 LRU Map 或加 TTL 自动清理。
var _processedTxIds = {};
function _addToPublicPool(cv, source) {
  // ponytail: PUBLIC_CV_POOL 单向积累无出口。当 >10000 时需实现分配机制（如按周活跃度分发给成员）
  PUBLIC_CV_POOL += cv;
  _addLedger('system', '__public_pool__', cv, 'cv_pool_'+source, '公共池收入');
}
function getPublicPoolCV() { return PUBLIC_CV_POOL; }

// ═══ CV 门槛检查 ═══
function checkCvGate(userId, action) {
  var u = getUser(userId);
  var cv = u ? (u.contributionValue||0) : 0;
  var xp = u ? (u.experienceValue||0) : 0;
  var gates = { post_task: 0, buy_work: 0, propose: 500, jury: 500 };
  var required = gates[action] || 0;
  if (action === 'jury') return { pass: xp >= required, required: required, current: xp };
  return { pass: cv >= required, required: required, current: cv };
}

// ═══════════════════════════════════════════════
//  会计验证
// ═══════════════════════════════════════════════

function verify() {
  var result = { pass: true, issues: [], balances: {}, checks: {} };

  // 汇总所有用户余额
  var totalUserBalance = 0;
  Object.keys(USERS).forEach(function(uid) {
    result.balances[uid] = USERS[uid].ntBalance;
    totalUserBalance += USERS[uid].ntBalance;
  });

  // 汇总所有流水净额
  var ledgerNet = 0;
  LEDGER.forEach(function(e) {
    if (e.type === 'deposit') ledgerNet += e.amount;
    else if (e.type === 'withdraw') ledgerNet -= e.amount;
    // earn/spend/transfer 不改变总额（系统内流动）
  });

  // 会计等式: sum(users) + sum(CAMP_POOLS) + TASK_ESCROW + COMMUNITY_POOL = _totalIssued
  var totalCamp = 0;
  Object.keys(CAMP_POOLS).forEach(function(cid){ totalCamp += CAMP_POOLS[cid]; });
  var totalSystem = totalUserBalance + totalCamp + TASK_ESCROW + COMMUNITY_POOL;
  result.checks.totalDeposited = _totalIssued;
  result.checks.totalUserBalance = totalUserBalance;
  result.checks.campPools = totalCamp;
  result.checks.taskEscrow = TASK_ESCROW;
  result.checks.communityPool = COMMUNITY_POOL;
  result.checks.totalSystem = totalSystem;

  if (Math.abs(totalSystem - _totalIssued) > 0.001) {
    result.pass = false;
    result.issues.push('会计等式不成立: 用户('+totalUserBalance+') + 营队池('+totalCamp+') + 任务托管('+TASK_ESCROW+') + 社区池('+COMMUNITY_POOL+') = '+totalSystem+' ≠ 存入('+_totalIssued+')，差额: '+(totalSystem-_totalIssued));
  }

  // 检查保证金冻结一致性（仅当使用了 deposit 系统时；MVP 阶段 depositBalance 为 0）

  // 检查 settled 任务和 ledger 的一致性
  var settledFromLedger = LEDGER.filter(function(e){return e.type==='task_reward'&&e.status==='settled';}).length;
  var settledFromTasks = Object.keys(TASKS).filter(function(tid){return TASKS[tid].status==='settled';}).length;
  result.checks.settledMatch = settledFromLedger === settledFromTasks;

  return result;
}

// ═══════════════════════════════════════════════
//  查询
// ═══════════════════════════════════════════════

function getUser(userId) { return USERS[userId] || null; }
function getTask(taskId) { return TASKS[taskId] || null; }
function getLedger(opts) {
  opts = opts || {};
  var entries = LEDGER.slice();
  if (opts.userId) entries = entries.filter(function(e){return e.from===opts.userId||e.to===opts.userId;});
  if (opts.type) entries = entries.filter(function(e){return e.type===opts.type;});
  if (opts.status) entries = entries.filter(function(e){return e.status===opts.status;});
  if (opts.limit) entries = entries.slice(-opts.limit);
  return entries;
}
function getSettlements() { return SETTLEMENTS.slice(); }
function getFrozenBalance(userId) {
  var frozen = 0;
  for (var tid in TASKS) {
    var t = TASKS[tid];
    if (t.poster !== userId) continue;
    if (t.status === 'verified' || t.status === 'settled' || t.status === 'cancelled' || t.status === 'disputed') continue;
    frozen += t.reward || 0;
  }
  return frozen;
}

function pendingTasks() {
  return Object.keys(TASKS).filter(function(tid){
    var t = TASKS[tid];
    return t.status === 'pending' || t.status === 'active' || t.status === 'completed' || t.status === 'verified';
  }).map(function(tid){return TASKS[tid];});
}

function userTasks(userId) {
  return Object.keys(TASKS).filter(function(tid){
    var t = TASKS[tid];
    return t.poster === userId || t.assignee === userId;
  }).map(function(tid){return TASKS[tid];});
}

// ═══════════════════════════════════════════════
//  内部辅助
// ═══════════════════════════════════════════════

function _getUser(id) { if (!id) return null; if (!USERS[id]) { console.warn('[NT] 自动注册未知用户: '+id); USERS[id] = registerUser(id); } return USERS[id]; }
function _getTask(id) { return TASKS[id] || null; }

function _addLedger(from, to, amount, type, reason, taskId) {
  var entry = {
    entryId: _lid(),
    taskId: taskId || null,
    from: from || 'system',
    to: to || 'system',
    amount: amount,
    type: type,
    reason: reason || '',
    status: (type === 'task_reward') ? 'pending' : 'settled',
    timestamp: new Date().toISOString(),
    settledAt: null,
    batchId: null,
    txHash: null
  };
  LEDGER.push(entry);
  return entry;
}

function _adjustTrust(user, delta) {
  user.trustScore = Math.max(0, Math.min(100, user.trustScore + delta));
  if (user.trustScore >= 80) user.trustLevel = '可信';
  else if (user.trustScore >= 60) user.trustLevel = '待观察';
  else if (user.trustScore >= 40) user.trustLevel = '受限';
  else user.trustLevel = '冻结';
}

function _err(msg) { console.warn('[NT]', msg); return null; }

// ═══════════════════════════════════════════════
//  导出
// ═══════════════════════════════════════════════

window.NT = {
  // 用户
  registerUser: registerUser,
  getUser: getUser,

  // 保证金（模拟合约）
  deposit: deposit,
  withdraw: withdraw,

  // 任务生命周期
  createTask: createTask,
  acceptTask: acceptTask,
  submitTask: submitTask,
  verifyTask: verifyTask,
  cancelTask: cancelTask,
  disputeTask: disputeTask,

  // 批量结算
  batchSettle: batchSettle,

  // 简化操作
  earn: earn,
  spend: spend,
  transfer: transfer,

  // 充值 / 提现（外部 NT 进出系统）
  topUp: topUp,
  cashOut: cashOut,

  // 三池 API（章1）
  earnFromPool: earnFromPool,
  spendToPool: spendToPool,
  getCommunityPool: getCommunityPool,
  getCampPool: getCampPool,
  depositToCommunityPool: depositToCommunityPool,
  depositToCampPool: depositToCampPool,

  // CV / XP / 公共池
  checkCvGate: checkCvGate,
  getPublicPoolCV: getPublicPoolCV,

  // 查询
  getTask: getTask,
  getLedger: getLedger,
  getSettlements: getSettlements,
  getFrozenBalance: getFrozenBalance,
  pendingTasks: pendingTasks,
  userTasks: userTasks,

  // 验证
  verify: verify,

  // 重置（测试用）
  _reset: function(){
    Object.keys(USERS).forEach(function(k){delete USERS[k]});
    for(var k in TASKS)delete TASKS[k];LEDGER.length=0;SETTLEMENTS.length=0;
    _totalIssued=0;COMMUNITY_POOL=0;CAMP_POOLS={};TASK_ESCROW=0;PUBLIC_CV_POOL=0;
    _processedTxIds={};  // FIX-06: 清空去重集合
    _seq = { task:0, ledger:0, settlement:0 };
    try { localStorage.removeItem(NT_STORE_KEY); } catch(e) {}
  },
  // 原始数据（调试用）
  _users: USERS,
  _tasks: TASKS,
  _ledger: LEDGER,
  _settlements: SETTLEMENTS,
  _saveState: _saveState
};

// 从 localStorage 恢复状态
_loadState();

// 章0.3: 池子初始注资（持久化标志防重复）
var _initialFunded = LEDGER.some(function(e) { return e.reason === 'initial_funding'; });
if (!_initialFunded) {
  COMMUNITY_POOL += 2000;
  _totalIssued += 2000;
  _addLedger('system', '__community_pool__', 2000, 'deposit', 'initial_funding');
  _saveState(true);
}

// FIX-07: 页面关闭前强制写盘
window.addEventListener('beforeunload', function() {
  try {
    localStorage.setItem(NT_STORE_KEY, JSON.stringify({
      u: USERS, t: TASKS, l: LEDGER, st: SETTLEMENTS,
      ti: _totalIssued, cmp: COMMUNITY_POOL, cps: CAMP_POOLS, te: TASK_ESCROW, cvp: PUBLIC_CV_POOL, pt: _processedTxIds, sq: _seq
    }));
  } catch(e) {}
});

})();