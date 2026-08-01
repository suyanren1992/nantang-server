/* ══════════════════════════════════════════════════════════════════
   mobile-bundle.js — 南塘云村 移动端专用核心
   替换 app.js（784KB → ~15KB），仅包含移动端需要的函数/状态
   所有函数从 app.js 复制，无桌面端 DOM 依赖
   ══════════════════════════════════════════════════════════════════ */

// ═══ NM shim（P1-1：seed-test-data.js 将 NM 定义为 {} 空对象，导致 5 处调用 TypeError） ═══
// mobile-bundle 先于 data.js/core.js 加载，shim 方法在调用时延迟解析全局函数
window.NM = {
  currentTab: 0,
  showToast: function(msg) {
    if (typeof showToast === 'function') { showToast(msg); return; }
    console.log('[NM:showToast]', msg);
  },
  showConfirm: function(title, body, onOk) {
    if (typeof showConfirm === 'function') { showConfirm(title + '\n' + (body || ''), onOk); return; }
    if (confirm(title + '\n' + (body || ''))) { if (onOk) onOk(); }
  },
  // 以下在现行 mobile 代码库中无等价实现，安全 no-op
  // ponytail: 待 M1-M5 墓碑评估——若桌面端搬过来 renderWorkspace/switchTab/refreshHUD/openSubPage 则替换为桥接
  renderWorkspace: function() { /* no-op: 移动端无等价物 */ },
  switchTab: function(idx) { NM.currentTab = idx; /* no-op: 移动端无等价物 */ },
  refreshHUD: function() { /* no-op: 移动端无等价物 */ },
  openSubPage: function(title, renderFn) {
    // 尝试桥接 openSub，但签名不同（openSub 接受 task 对象），fallback no-op
    if (typeof renderFn === 'function') {
      var el = document.getElementById('subBody');
      if (el) { document.getElementById('subTitle').textContent = title; renderFn(el); if(typeof _pushOverlay==='function')_pushOverlay('subPage'); document.getElementById('subPage').classList.add('open'); }
    }
  }
};

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

// ═══ Core I/O ═══
function saveData() {
  // Phase 0: 数据统一通过 AppData._save() 持久化，saveData 保留接口兼容性
}

function setStatus(msg) {
  if (window.NM) NM.showToast(msg);
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
