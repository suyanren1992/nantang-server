/* ══════════════════════════════════════════════════════════════════
   nt.js — 南塘云村 NT 经济核心（从 app.js 提取）
   NT 计算 / 头像渲染 / 交易记录 / 称号

   依赖（保持 app.js 全局引用）：
   - data      — 全局数据对象
   - getUsers()— 定义在 app.js 中
   - uid()     — 定义在 app.js:5
   - Clock     — 定义在 app.js:19（today(), iso(), stamp()）
   - AVATAR_STYLE  — 头像风格（本文件内定义）
   - CHARACTER_SEEDS — 头像种子（本文件内定义）
   - ROLE_TITLES / ROLE_CAPABILITIES — 称号/权限（本文件内定义）
   ══════════════════════════════════════════════════════════════════ */

// 头像常量 CHARACTER_SEEDS / AVATAR_STYLE — 在 app.js 中定义，此处引用

// ═══ 称号常量（app.js:1029-1046）═══
var ROLE_TITLES = { admin:'🧙管理员',builder:'🧱共建者',adventurer:'⚔️冒险者',npc:'👥在地伙伴',visitor:'🏕️云村民' };
var ROLE_LABELS = { admin:'管理员',builder:'共建者',adventurer:'冒险者',npc:'在地伙伴',visitor:'云村民' };
var ROLE_BADGE_ICONS = { builder:'🏅',adventurer:'🎖️',npc:'🌟',visitor:'🏕️' };

var ROLE_CAPABILITIES = {
  admin:      { isMember: true,  canClaimCamp: true,
    tabs: ['workspace','questboard','settings','members','players','taskhall','ntadmin','timeline','budget','settlement','map','leaderboard','treasury'] },
  builder:    { isMember: true,  canClaimCamp: true,
    tabs: ['workspace','questboard','taskhall','ntadmin','timeline','budget','settlement','members','leaderboard','treasury','settings'] },
  adventurer: { isMember: true,  canClaimCamp: true,
    tabs: ['workspace','questboard','timeline','leaderboard'] },
  npc:        { isMember: true,  canClaimCamp: true,
    tabs: ['workspace','questboard','timeline','leaderboard'] },
  visitor:    { isMember: false, canClaimCamp: false,
    tabs: ['workspace','timeline','leaderboard'] }
};

// ══════════════════════════════════════════════════════════════════
// NT 计算核心
// Phase 0: data.finance → NT.getLedger()
// ══════════════════════════════════════════════════════════════════

function _getFinance() { return (window.NT && NT.getLedger) ? NT.getLedger() : []; }
function _getTasksArr() { return (window.AppData && AppData._data.tasks) ? Object.values(AppData._data.tasks) : []; }
function _getMembers() { return (window.AppData && AppData._data.users) ? AppData._data.users : {}; }

// app.js:355-368
function calcNtByScope(name) {
  var camp = 0, personal = 0;
  _getFinance().forEach(function(tx) {
    var scope = tx.scope || 'camp';
    var amt = tx.amount || 0;
    if (tx.to === name) {
      if (scope === 'personal') personal += amt; else camp += amt;
    }
    if (tx.from === name) {
      if (scope === 'personal') personal -= amt; else camp -= amt;
    }
  });
  return { camp: camp, personal: personal };
}

// 计算某人总 NT（不区分 scope）
// app.js:371-374
function calcNtTotal(name) {
  var r = calcNtByScope(name);
  return r.camp + r.personal;
}

// ═══ 对账校验：SUM(所有用户余额) == SUM(增发) - SUM(回收) ═══
// app.js:377-428
function verifyLedgerBalance() {
  // 系统增发源：这些实体可以"创造"NT（充值、营队拨款、社区奖励）
  var CREATION_SOURCES = ['系统', 'camp_multisig', '社区池'];
  var totalCreated = 0;
  var totalDestroyed = 0;
  // 中间实体余额（应为零或可解释）
  var entityBalances = {};
  _getFinance().forEach(function(tx) {
    var amt = tx.amount || 0;
    // 增发检测
    if (CREATION_SOURCES.indexOf(tx.from) !== -1) totalCreated += amt;
    // 销毁检测
    if (CREATION_SOURCES.indexOf(tx.to) !== -1) totalDestroyed += amt;
    // 追踪中间实体
    if (tx.from && CREATION_SOURCES.indexOf(tx.from) === -1) {
      entityBalances[tx.from] = (entityBalances[tx.from] || 0) - amt;
    }
    if (tx.to && CREATION_SOURCES.indexOf(tx.to) === -1) {
      entityBalances[tx.to] = (entityBalances[tx.to] || 0) + amt;
    }
  });
  // 用户总余额
  var userTotal = 0;
  var users = getUsers();
  Object.keys(users).forEach(function(name) {
    userTotal += calcNtTotal(name);
  });
  // 非用户实体的异常余额（如拍卖行托管应为零）
  var entityWarnings = [];
  Object.keys(entityBalances).forEach(function(entity) {
    if (Math.abs(entityBalances[entity]) > 0.01 && !users[entity]) {
      entityWarnings.push(entity + ': ' + entityBalances[entity].toLocaleString() + ' NT');
    }
  });
  var systemNet = totalCreated - totalDestroyed;
  var discrepancy = userTotal - systemNet;
  // deposits 总额 vs finance 中 deposit 总额交叉校验
  var depositSum = (data.deposits || []).filter(function(d) { return d.status === 'confirmed'; }).reduce(function(s, d) { return s + d.amount; }, 0);
  var financeDepositSum = _getFinance().filter(function(tx) { return tx.type === 'deposit'; }).reduce(function(s, tx) { return s + (tx.amount || 0); }, 0);
  return {
    balanced: Math.abs(discrepancy) < 0.01,
    userTotal: userTotal,
    systemNet: systemNet,
    discrepancy: discrepancy,
    totalCreated: totalCreated,
    totalDestroyed: totalDestroyed,
    entityWarnings: entityWarnings,
    depositMatch: depositSum === financeDepositSum,
    depositSum: depositSum,
    financeDepositSum: financeDepositSum
  };
}

// ═══ 支付密码 ═══
// simpleHash() — defined in utils.js, referenced here
// app.js:436-441
var _paymentPwdPrompted = {};
function verifyPaymentPassword(name, pwd) {
  // One-time reminder for users who haven't set a payment password
  if (!_paymentPwdPrompted[name]) {
    _paymentPwdPrompted[name] = true;
    if ((!data.payment_passwords || !data.payment_passwords[name])) {
      if (typeof setStatus === 'function') {
        setStatus('💡 你还没有设置支付密码，NT 提现 unprotected。可在更多→设置中设置。');
      }
    }
  }
  if (!data.payment_passwords) return true; // 系统未初始化密码表 → 放行（MVP 阶段向后兼容）
  var stored = data.payment_passwords[name];
  if (!stored) return true; // 该用户未设置密码 → 放行（MVP 阶段向后兼容）
  return simpleHash(pwd) === stored;
}

// ═══ 平台余额（含冻结）═══
// app.js:444-446
function calcPlatformBalance(name) {
  return calcNtTotal(name);
}
// app.js:447-456
function calcFrozenBalance(name) {
  var frozen = 0;
  _getTasksArr().forEach(function(t) {
    if (t.poster !== name) return;
    if (t.status === 'active' || t.status === 'pending_approval') {
      frozen += (t.points || 0);
    }
  });
  return frozen;
}
// app.js:457-459
function calcAvailableBalance(name) {
  return calcPlatformBalance(name) - calcFrozenBalance(name);
}

// ═══ 充值 / 提现 ═══
// app.js:462
function getPlatformMultisig() { return (data.budget && data.budget.platform_multisig) || '0x0000000000000000000000000000000000000000'; }

// ══════════════════════════════════════════════════════════════════
// 交易记录
// ══════════════════════════════════════════════════════════════════

// app.js:736-759
function recordTransaction(opts) {
  if (!opts.amount || opts.amount <= 0) return null;
  var tx = {
    id: uid('tx'),
    type: opts.type,
    from: opts.from || '系统',
    to: opts.to,
    amount: opts.amount,
    scope: opts.scope || 'camp',
    date: Clock.today(),
    created_at: Clock.iso(),
    ref_id: opts.ref_id || '',
    task_name: opts.task_name || '',
    item_name: opts.item_name || '',
    confirmed_by: opts.confirmed_by || '',
    settled_at: opts.settled_at || '',
    note: opts.note || '',
    tx_hash: ''
  };
  // Phase 0: 交易记录通过 NT 系统持久化，不再写入 data.finance
  if (window.NT && NT.getLedger) {
    // NT ledger 在 nt-core.js 中管理，通过 NT 的 createTask/submitTask 等方法自动记录
  }
  return tx;
}

// ═══ 会计系统：旧流水迁移（一次性）═══
// app.js:762-774
function migrateFinanceRecords() {
  // Phase 0: data.finance 已废弃，迁移逻辑不再需要
}

// ══════════════════════════════════════════════════════════════════
// 头像渲染
// ══════════════════════════════════════════════════════════════════

// app.js:9142-9146
function avatarCircle(seed, size, styleIdx) {
  var name = typeof seed === 'string' ? seed : CHARACTER_SEEDS[seed % CHARACTER_SEEDS.length];
  var url = 'https://api.dicebear.com/7.x/' + AVATAR_STYLE + '/svg?seed=' + encodeURIComponent(name) + '&size=' + (size*2) + '&radius=50';
  return '<span style="display:inline-block;width:'+size+'px;height:'+size+'px;border-radius:50%;overflow:hidden;flex-shrink:0"><img src="' + url + '" width="' + (size*2) + '" height="' + (size*2) + '" style="border-radius:50%;object-fit:cover;display:block;width:100%;height:100%" alt="" onerror="this.style.opacity=\'0\'"></span>';
}

// ══════════════════════════════════════════════════════════════════
// 称号 / 成就 / 徽章
// ══════════════════════════════════════════════════════════════════

// app.js:1032
function getUserTitle(u){ return u?ROLE_TITLES[u.role]||u.role:''; }
// app.js:1033
function getUserBadges(u){ if(!u||!u.season_history)return[];return u.season_history.slice().reverse(); }

// app.js:3668-3678
function getAchievements(userName) {
  var tasks = _getTasksArr(); var achievements = [];
  var completed = tasks.filter(function(t) { var c = (t.claimants || []).find(function(cl) { return cl.name === userName; }); return c && c.status === 'completed'; });
  var allMain = tasks.filter(function(t) { return t.type === '主线'; }); var doneMain = completed.filter(function(t) { return t.type === '主线'; });
  if (allMain.length > 0 && doneMain.length === allMain.length) achievements.push({ name: '主线通关', icon: '🏅', desc: '完成全部主线任务' });
  if (completed.length >= 15) achievements.push({ name: '全勤猎人', icon: '🎖️', desc: '完成 15 项以上任务' });
  var doneSide = completed.filter(function(t) { return t.type === '支线'; }).length;
  if (doneSide >= 6) achievements.push({ name: '支线达人', icon: '⭐', desc: '完成 6 项以上支线任务' });
  var members = _getMembers();
  var manual = (members[userName] && members[userName].achievements) || [];
  return achievements.concat(manual);
}
