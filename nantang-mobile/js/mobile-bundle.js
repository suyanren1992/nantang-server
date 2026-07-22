/* ══════════════════════════════════════════════════════════════════
   mobile-bundle.js — 南塘云村 移动端专用核心
   替换 app.js（784KB → ~15KB），仅包含移动端需要的函数/状态
   所有函数从 app.js 复制，无桌面端 DOM 依赖
   ══════════════════════════════════════════════════════════════════ */

// ═══ 常量 ═══
var CHARACTER_SEEDS = [
  'Alex','Jordan','Casey','Morgan','Riley','Taylor','Quinn','Sam',
  'Charlie','Drew','Blake','Avery','Skyler','Reese','Finley','Sage',
  'Harper','Emery','Parker','Rowan','Dakota','Phoenix','River','Jamie',
  'Kai','Sasha','Remy','Jules','Ari','Nico','Luca','Ezra','Theo','Ollie',
  'Max','Leo','Mia','Zoe','Eli','Ivy','Asher','Nova','Kiran','Zuri',
  'Robin','Jade','Cody','Erin','Liam','Noah','Emma','Ava','Sophia','Jackson',
  'Aiden','Lucas','Lily','Grace','Chloe','Penelope','Riley','Zion','Mateo','Nora'
];
var AVATAR_STYLE = 'avataaars'; var DICEBEAR_VER = '9.x';
var NT_USERS_KEY = 'nt_users';
// Phase 0: NT_INVITE_KEY 已废弃，邀请码统一存储到 AppData._data.inviteCodes
var NT_SESSION_KEY = 'nt_session';
var TX_TYPES = {
  TASK_REWARD: 'task_reward', TASK_POST: 'task_post',
  CANTEEN_PREORDER: 'canteen_preorder', CANTEEN_WALKIN: 'canteen_walkin',
  BAZAAR_TRADE: 'bazaar_trade', TEAHOUSE_POST: 'teahouse_post',
  GAME_FEE: 'game_fee', ADMIN_ADJUST: 'admin_adjust',
  SEASON_BONUS: 'season_bonus', AUCTION_DEPOSIT: 'auction_deposit',
  AUCTION_REFUND: 'auction_refund', AUCTION_SETTLE: 'auction_settle',
  TIP: 'tip', ENCOURAGE: 'encourage'
};
var adminNames = [];  // 生产环境由服务端 role 决定，客户端仅 file:// fallback

// ═══ Safe localStorage wrapper (from app.js, with write-failure warning) ═══
var safeStorage = {
  available: true,
  _warned: false,
  _warn: function() {
    if (safeStorage._warned) return;
    safeStorage._warned = true;
    console.error('[safeStorage] localStorage 不可用，数据无法保存！');
    try {
      var w = document.createElement('div');
      w.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#b84c38;color:#fff;padding:12px;text-align:center;z-index:99999;font-weight:600;font-size:14px';
      w.textContent = '⚠️ 浏览器存储不可用，数据无法保存！请关闭隐私模式或允许网站数据。';
      document.body.appendChild(w);
      setTimeout(function() { w.style.opacity = '0'; w.style.transition = 'opacity .5s'; }, 8000);
    } catch(e) {}
  },
  getItem: function(key) { try { return localStorage.getItem(key); } catch(e) { safeStorage.available = false; safeStorage._warn(); return null; } },
  setItem: function(key, val) { try { localStorage.setItem(key, val); safeStorage.available = true; } catch(e) { safeStorage.available = false; safeStorage._warn(); } },
  removeItem: function(key) { try { localStorage.removeItem(key); } catch(e) { safeStorage.available = false; safeStorage._warn(); } }
};

// ═══ Global state ═══
var data = {
  _schema_version: 1, decisions: [], budget: {},
  budget_items: [], finance_cny: {},
  camp_progress: { step: 0, steps: { '0': 'active', '1': 'locked', '2': 'locked', '3': 'locked', '4': 'locked' } },
  camp_dates: { start: '', end: '', duration_days: 15, milestones: [] },
  staff_cards: [], inventory: [], canteen_menus: {}, canteen_orders: [],
  canteen_suggestions: [], inn_rooms: [], inn_bookings: [], teahouse_posts: [],
  game_sessions: [], auctions: [], tips: [], council_meetings: [],
  council_room: {}, community_pool: { balance: 500, managers: [], pending_approvals: [], log: [] },
  community_archives: [], deposits: [], withdrawals: [], finance_archives: [],
  activity_log: [], member_notes: {}, payment_passwords: {}, custom_tags: [],
  archived_periods: {}, currentPeriod: '', periodClosed: '',
  camp_info: { current: { version: 0, updated_at: '', updated_by: '',
    identity: { name: '', period: '', description: '', type: 'regular', status: 'draft', created_at: '', created_by: '', test_mode: false },
    budget: { nt_total_pool: 0, nt_allocated: 0, nt_remaining: 0, rmb_budget: 0, rmb_items: [], allocation_rules: {}, community_pool_total: 0, community_pool_daily: 0 },
    calendar: { start_date: '', end_date: '', duration_days: 15, daily_schedule: [], milestones: [], key_dates: [] },
    team: { admin: '', staff_cards: [], members: {} },
    tasks: { pool: [], assignments: {}, templates: [] },
    governance: { council_meetings: [], decisions: [], rules: {} }
  }, snapshots: [], changelog: [] },
  _initialized: false
};
var currentUser = null;
var previewMode = false;
var _settlementPending = null;

// ═══ Core I/O ═══
function saveData() {
  // Phase 0: 数据统一通过 AppData._save() 持久化，saveData 保留接口兼容性
}

function loadData() {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() {
      try {
        var loaded = JSON.parse(reader.result);
        // Phase 0: tasks/members/finance 统一由 AppData/NT 管理，不再从旧文件加载
        if (loaded.decisions) data.decisions = loaded.decisions;
        if (loaded.budget) data.budget = loaded.budget;
        if (loaded.budget_items) data.budget_items = loaded.budget_items;
        if (loaded.finance_cny) data.finance_cny = loaded.finance_cny;
        if (loaded.inventory) data.inventory = loaded.inventory;
        if (loaded.canteen_menus) data.canteen_menus = loaded.canteen_menus;
        if (loaded.canteen_orders) data.canteen_orders = loaded.canteen_orders;
        if (loaded.inn_bookings) data.inn_bookings = loaded.inn_bookings;
        if (loaded.teahouse_posts) data.teahouse_posts = loaded.teahouse_posts;
        if (loaded.game_sessions) data.game_sessions = loaded.game_sessions;
        if (loaded.auctions) data.auctions = loaded.auctions;
        if (loaded.activity_log) data.activity_log = loaded.activity_log;
        if (loaded.deposits) data.deposits = loaded.deposits;
        if (loaded.withdrawals) data.withdrawals = loaded.withdrawals;
        if (loaded.community_pool) data.community_pool = loaded.community_pool;
        if (loaded.community_archives) data.community_archives = loaded.community_archives;
        if (window.NM) { NM.showToast('✅ 数据已加载'); NM.refreshHUD(); NM.switchTab(NM.currentTab || 0); }
      } catch(err) {
        if (window.NM) NM.showToast('❌ 文件格式错误');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function exportData() {
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'nantang-data-' + (typeof Clock !== 'undefined' ? Clock.today() : 'export') + '.json';
  a.click();
  if (window.NM) NM.showToast('✅ 数据已导出');
}

function setStatus(msg) {
  if (window.NM) NM.showToast(msg);
}

// ═══ Settlements ═══
function getPayableBills(forUser) {
  var bills = [];
  var name = forUser || (currentUser ? currentUser.name : '');
  if (!name) return bills;
  var tasks = (window.AppData ? AppData.taskMarket() : []);
  tasks.forEach(function(t, idx) {
    if (t.poster !== name) return;
    (t.claimants || []).forEach(function(cl) {
      if ((cl.status === 'approved' || cl.status === 'settling') && (!cl.settled_at || cl.settled_at === 'pending')) {
        bills.push({ taskIdx: idx, taskName: t.name, claimant: cl.name, amount: t.points || 0, reviewedAt: cl.reviewed_at, scope: t.scope || 'camp' });
      }
    });
  });
  return bills;
}

function executeSettlement(idx, claimantName) {
  if (idx === undefined && _settlementPending) {
    var sp = _settlementPending;
    idx = sp.idx; claimantName = sp.claimantName;
  }
  var tasks = (window.AppData ? AppData.taskMarket() : []);
  var t = tasks[idx];
  if (!t || !t.claimants) return;
  var cl = t.claimants.find(function(c) { return c.name === claimantName; });
  if (!cl || cl.status !== 'approved' || cl.settled_at) return;
  var taskScope = t.scope || 'camp';
  if (taskScope === 'personal' && !t.poster) { setStatus('任务发布者不存在，无法结算'); return; }
  var fromAccount = taskScope === 'personal' ? t.poster : 'camp_multisig';
  // Phase 0: 交易通过 NT 系统记录
  if (window.NT && NT.getLedger) { /* NT ledger managed by nt-core.js */ }
  cl.status = 'settling'; cl.settled_at = 'pending'; cl.settled_by = currentUser ? currentUser.name : '';
  if (window.AppData) AppData.updateTask(t.name, { claimants: t.claimants });
  if (window.NM) { NM.showToast('已结算：' + claimantName + ' → ' + t.name + '（NT ' + (t.points||0) + '）'); NM.renderWorkspace(); }
  if (!data.activity_log) data.activity_log = [];
  data.activity_log.push({ time: (typeof Clock !== 'undefined' ? Clock.iso() : new Date().toISOString()), type: 'settlement', text: (currentUser?currentUser.name:'系统') + ' 结算了 ' + claimantName + ' 的「' + t.name + '」NT' + (t.points||0) });
}

function batchSettleAll() {
  var bills = getPayableBills();
  _settlementPending = null;
  if (bills.length === 0) { setStatus('没有待结算的项'); return; }
  var total = bills.reduce(function(s,b){return s+b.amount;},0);
  var lines = bills.map(function(b){return b.claimant + ' → ' + b.taskName + ' · NT ' + b.amount;}).join('<br>');
  if (window.NM) {
    NM.showConfirm('确认结算 ' + bills.length + ' 笔？', lines + '<br><br>总计：NT ' + total, function() {
      var success = 0, fail = 0;
      bills.forEach(function(b) { try { executeSettlement(b.taskIdx, b.claimant); success++; } catch(e) { fail++; } });
      setStatus('结算完成：成功 ' + success + ' 笔' + (fail > 0 ? '，失败 ' + fail + ' 笔' : ''));
      if (window.NM) NM.renderWorkspace();
    });
  } else {
    if (!confirm('确认结算以下 ' + bills.length + ' 笔？\n' + bills.map(function(b){return b.claimant + ' → ' + b.taskName + ' · NT ' + b.amount;}).join('\n') + '\n总计：NT ' + total)) return;
    bills.forEach(function(b) { try { executeSettlement(b.taskIdx, b.claimant); } catch(e) {} });
    setStatus('结算完成');
  }
}

// ═══ Inbox ═══
function getInboxSeenIds() {
  try { return JSON.parse(safeStorage.getItem('inbox_seen_ids') || '[]'); } catch(e) { return []; }
}
function isInboxMsgNew(msgId) { return getInboxSeenIds().indexOf(msgId) === -1; }

function computeInboxMessages() {
  var msgs = [];
  if (!currentUser) return msgs;
  var tasks = (window.AppData ? AppData.taskMarket() : []);
  var today = (typeof Clock !== 'undefined' ? Clock.today() : '');
  var role = currentUser.role;
  if (role === 'admin' || role === 'builder') {
    var submittedByPerson = {};
    tasks.forEach(function(t) {
      (t.claimants || []).forEach(function(c) {
        if (c.status === 'submitted') {
          if (!submittedByPerson[c.name]) submittedByPerson[c.name] = { tasks: [], earliestDate: c.submitted_at || '', totalPoints: 0 };
          submittedByPerson[c.name].tasks.push(t.name);
          submittedByPerson[c.name].totalPoints += (t.points || 0);
          if (c.submitted_at && (!submittedByPerson[c.name].earliestDate || c.submitted_at < submittedByPerson[c.name].earliestDate))
            submittedByPerson[c.name].earliestDate = c.submitted_at;
        }
      });
    });
    Object.keys(submittedByPerson).forEach(function(person) {
      var s = submittedByPerson[person];
      msgs.push({ type: 'submitted', id: 'sub_' + person, person: person, taskCount: s.tasks.length, taskNames: s.tasks, totalPoints: s.totalPoints, createdAt: s.earliestDate, jump: { tab: 'ntadmin', highlight: { type: 'review', person: person } } });
    });
  }
  // Own task status changes
  var myName = currentUser.name;
  tasks.forEach(function(t) {
    var cl = (t.claimants || []).find(function(c) { return c.name === myName; });
    if (!cl) return;
    if (cl.status === 'approved' && !cl.settled_at) {
      msgs.push({ type: 'approved', id: 'appr_' + t.id, person: myName, taskName: t.name, amount: t.points || 0, createdAt: cl.reviewed_at || today, jump: { tab: 'settlement', highlight: { type: 'task', name: t.name } } });
    }
    if (cl.status === 'rejected') {
      msgs.push({ type: 'rejected', id: 'rej_' + t.id, person: myName, taskName: t.name, createdAt: cl.reviewed_at || today, jump: { tab: 'workspace', highlight: null } });
    }
  });
  return msgs;
}

function updateInboxBadge() {
  var msgs = computeInboxMessages();
  var unread = msgs.filter(function(m) { return isInboxMsgNew(m.id); }).length;
  var dot = document.getElementById('inboxDot');
  if (dot) dot.classList.toggle('hidden', unread === 0);
}

// ═══ Marketplace / Inn / Workshop stubs ═══
function showPurchase(itemId) {
  var it = (data.inventory || []).find(function(x) { return x.id === itemId; });
  if (!it) return;
  if (!currentUser) { setStatus('请先登录'); return; }
  if (currentUser.name === it.owner) { setStatus('不能购买自己的物品'); return; }
  var myNT = typeof calcNtTotal === 'function' ? calcNtTotal(currentUser.name) : 0;
  if (window.NM) {
    NM.showConfirm('购买「' + (typeof esc === 'function' ? esc(it.name) : it.name) + '」',
      '卖家：' + (typeof esc === 'function' ? esc(it.owner) : it.owner) + '\n价格：' + it.price + ' NT\n你的余额：' + myNT + ' NT' + (myNT < it.price ? ' ⚠️余额不足！' : ''),
      function() {
        if (myNT < it.price) { setStatus('NT 余额不足'); return; }
        it.status = 'sold'; it.sold_to = currentUser.name; it.sold_at = (typeof Clock !== 'undefined' ? Clock.today() : '');
        if (typeof recordTransaction === 'function') recordTransaction({ type: TX_TYPES.BAZAAR_TRADE, from: currentUser.name, to: it.owner, amount: it.price, ref_id: itemId, item_name: it.name, scope: 'personal' });
        saveData();
        setStatus('已购买：' + it.name + '（' + it.price + ' NT）');
      });
  }
}

function getInnRooms() {
  if (data.inn_rooms && data.inn_rooms.length) return data.inn_rooms;
  if (window.AppData && AppData._data.map_locations && AppData._data.map_locations.accommodations) {
    return Object.values(AppData._data.map_locations.accommodations).map(function(a) {
      return { id: a.key || '', type: a.type || 'single', label: a.label || '', beds: 1, tenant: a.tenant, rentNT: a.rentNT, status: a.status };
    });
  }
  return [];
}

function enterWorkshop() {
  if (window.NM) NM.showToast('请在桌面端使用创营向导');
}

function showChangelogPanel() {
  if (window.NM) NM.openSubPage('更新日志', function(el) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">更新日志</div><div class="empty-state-desc">暂无记录</div></div>';
  });
}

// ═══ Multi-tab sync: detect camp_data changes from OTHER tabs (Issue 3) ═══
window.addEventListener('storage', function(e) {
  if (e.key !== 'camp_data' || !e.newValue) return;
  try {
    var incoming = JSON.parse(e.newValue);
    // Guard: skip if identical to avoid saveData → storage → saveData feedback loops
    if (JSON.stringify(incoming) === JSON.stringify(window.data)) return;
    window.data = incoming;
    if (window.NM && window.currentUser) {
      window.NM.refreshHUD();
      window.NM.switchTab(window.NM.currentTab || 0);
    }
  } catch(ex) { /* parse failure — ignore */ }
});
