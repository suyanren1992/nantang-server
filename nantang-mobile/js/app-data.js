// AppData — 统一数据层
// F21: 依赖检查
if (typeof window === 'undefined' || !window.localStorage) console.error('[app-data] localStorage not available');
// 原则：NT 系统是金融唯一真相源。AppData 不存交易、不存余额。
// Phase 1: 共享/私有分层存储，按用户 ID 隔离私有数据
window.AppData = {
  _currentUser: '',
  _data: {},

  // ══ 初始化（加载共享数据，不依赖当前用户）══
  init: function() {
    this._data = this._load('nt_app_v2_shared') || {};
    if (!this._data.tasks)  this._data.tasks  = {};
    if (!this._data.camps)  this._data.camps  = {};
    if (!this._data.users)  this._data.users  = {};
    if (!this._data.inviteCodes) {
      try { this._data.inviteCodes = JSON.parse(localStorage.getItem('nt_invites')) || {}; } catch(e) { this._data.inviteCodes = {}; }
    }
    if (!this._data.canteenMenu) this._data.canteenMenu = {};
    if (!this._data.spaces) this._data.spaces = {};
    if (!this._data.inventory) this._data.inventory = {};
    if (!this._data.pendingTransactions) this._data.pendingTransactions = [];
    if (!this._data.pendingVerifications) this._data.pendingVerifications = [];
    if (!this._data._pendingEarnQueue) this._data._pendingEarnQueue = [];
    if (!this._data.announcements) this._data.announcements = [];
    if (!this._data.presence) this._data.presence = {};
    if (!this._data.discoveries) this._data.discoveries = [];           // 校核制记录（verification）
    if (!this._data.cardDiscoveries) this._data.cardDiscoveries = [];   // 卡片室发现（card room）
    if (!this._data.pendingConfigChanges) this._data.pendingConfigChanges = [];
    if (!this._data.configHistory) this._data.configHistory = [];
    if (!this._data._lastAccommodationDeduction) this._data._lastAccommodationDeduction = '';
    if (this._data.campRmb === undefined) this._data.campRmb = 0;
    if (!this._data.map_locations) this._data.map_locations = { buildings: [], plots: [], accommodations: {}, people_on_site: [] };
    if (!this._data.member_locations) this._data.member_locations = {};
    this._migrateInviteCodes();
    this._seedIfEmpty();
    this._archiveOldDiscoveries(); // 章0.4: 启动时归档超过24h的发现
    this._deductAccommodation();   // 章2: 住宿费每日自动扣
    if (typeof _growDirtiness === 'function') _growDirtiness();
    this._dailyPoolRefill();       // 社区池每日自动补充
    // 私有字段（每用户覆盖），初始化为空
    this._data.myItems = {};
    this._data.items = {};
    this._data.journal = [];
    this._data.newbieQuests = {};
    this._data.cleaning = { lastCheckDate: '', spaces: {}, log: [] };
  },

  _load: function(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; }
  },
  _saveKey: function(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {
      console.error('[AppData] 保存失败: '+key, e);
      if (typeof showToast === 'function') showToast('⚠️ 存储空间不足，数据可能丢失', 'error');
    }
  },

  // ══ 当前用户 ══
  me: function(key) {
    var u = this._data.users[this._currentUser] || {};
    return key ? u[key] : u;
  },

  switchUser: function(name) {
    this._currentUser = name;
    // 加载私有数据，合并到共享 _data 上（不替换 _data 对象）
    var priv = this._load('nt_app_v2_' + name) || {};
    this._data.myItems = priv.myItems || {};
    this._data.items = priv.items || {};
    this._data.journal = priv.journal || [];
    this._data.newbieQuests = priv.newbieQuests || {};
    this._data.cleaning = priv.cleaning || { lastCheckDate: '', spaces: {}, log: [] };
    // 同步用户信息
    var u2 = (typeof getUsers === 'function') ? getUsers() : {};
    var au = u2[name] || {};
    if (!this._data.users[name]) {
      this._data.users[name] = { name: name, type: au.role||'visitor', role: au.role||'', avatar_seed: au.avatar_seed, created: (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10)), camp: '' };
    } else {
      if (au.avatar_seed !== undefined && au.avatar_seed !== null) this._data.users[name].avatar_seed = au.avatar_seed;
      if (au.role) this._data.users[name].role = au.role;
    }
    this._saveShared();
    if (typeof refreshUserUI === 'function') refreshUserUI();
  },

  // ══ NT 余额/流水 ══
  ntBalance: function() {
    if (!window.NT) return 0;
    var u = NT.getUser(this._currentUser);
    return u ? u.ntBalance : 0;
  },
  myTransactions: function(opts) {
    if (!window.NT) return [];
    return NT.getLedger({ userId: this._currentUser, limit: (opts && opts.limit) || 50 });
  },

  // ══ 任务（共享）══
  myTasks: function() {
    var me = this._currentUser;
    return Object.values(this._data.tasks).filter(function(t) {
      return t.publisher === me
        || (t.claimants || []).some(function(c) { return c.name === me; })
        || t.reviewer === me;
    });
  },
  taskMarket: function() {
    return Object.values(this._data.tasks).filter(function(t) { return t.status !== 'draft'; });
  },
  myPendingCount: function() {
    var me = this._currentUser;
    return Object.values(this._data.tasks).filter(function(t) {
      var isMy = (t.claimants || []).some(function(c) { return c.name === me; }) || t.publisher === me;
      if (!isMy) return false;
      return t.status === '待提交' || t.status === '待审核' || t.status === '退回修改';
    }).length;
  },
  addTask: function(task) {
    var existing = this._data.tasks[task.name];
    if (existing && existing.status !== 'draft' && existing.publisher !== task.publisher) {
      return { ok: false, error: '任务名「' + task.name + '」已被使用' };
    }
    this._data.tasks[task.name] = task;
    this._saveShared();
    if (typeof API !== 'undefined' && API.token) {
      var self = this;
      API.syncTask(task, function(srvId) {  // syncTask 是回调风格，无返回值
        if (srvId && typeof srvId === 'string') { task._srvId = srvId; task._ntTaskId = srvId; self._data.tasks[srvId] = task; self._saveShared(); }
        else { delete self._data.tasks[task.name]; self._saveShared(); if (typeof showToast === 'function') showToast('发布失败：服务端拒绝（余额不足或参数无效）', 'error'); }  // 服务端拒绝→回滚本地
      });
    }
    return { ok: true };
  },
  updateTask: function(name, updates) {
    if (this._data.tasks[name]) Object.assign(this._data.tasks[name], updates);
    this._saveShared();
    var srvId = (this._data.tasks[name] && this._data.tasks[name]._srvId) || name;
    // H-7 修复：服务端 TaskUpdate 显式拒绝 status 字段（400），同步前剔除，剔除后无剩余字段则跳过
    if (typeof API !== 'undefined' && API.token) {
      var sync = Object.assign({}, updates);
      delete sync.status; delete sync.action;
      if (Object.keys(sync).length) API.syncTaskUpdate(srvId, sync);
    }
  },
  deleteTask: function(name) {
    var srvId = (this._data.tasks[name] && this._data.tasks[name]._srvId) || name;
    delete this._data.tasks[name];
    delete this._data.tasks[srvId];  // 双向索引的 srvId key 一并删，防僵尸条目
    this._saveShared();
    if (typeof API !== 'undefined' && API.token) { API.deleteTask(srvId); }  // 服务端主键是 srvId
  },

  // ══ 物品（私有）══
  myItems: function(filter) {
    var items = this._data.items[this._currentUser] || [];
    return (!filter || filter === 'all') ? items : items.filter(function(i) { return i.status === filter; });
  },
  // ponytail: 有出库需求时补 deleteItem(userId, itemId)
  addItem: function(item) {
    if (!this._data.items[this._currentUser]) this._data.items[this._currentUser] = [];
    this._data.items[this._currentUser].push(item);
    this._savePrivate();
  },
  updateItem: function(id, updates) {
    var items = this._data.items[this._currentUser] || [];
    var it = items.find(function(i) { return i.id === id; });
    if (it) Object.assign(it, updates);
    this._savePrivate();
  },

  // ══ 写入 ══
  setMe: function(key, val) {
    if (!this._data.users[this._currentUser]) this._data.users[this._currentUser] = {};
    this._data.users[this._currentUser][key] = val;
    if (key === 'role') {
      var users = (typeof getUsers === 'function') ? getUsers() : {};
      if (users[this._currentUser]) { users[this._currentUser].role = val;
        if (typeof saveUsers === 'function') saveUsers(users); }
    }
    this._saveShared();
  },

  // ══ 邀请码（共享，独立 key） ══
  _migrateInviteCodes: function() {
    try {
      var wc = JSON.parse(localStorage.getItem('nt_world_codes')) || [];
      var ic = JSON.parse(localStorage.getItem('nt_invite_codes')) || [];
      var any = false;
      wc.forEach(function(c) {
        if (!this._data.inviteCodes[c]) { this._data.inviteCodes[c] = { campId:'migrated',role:'adventurer',createdBy:'',usedBy:null,usedAt:null,createdAt:new Date().toISOString() }; any = true; }
      }.bind(this));
      ic.forEach(function(c) {
        if (!this._data.inviteCodes[c]) { this._data.inviteCodes[c] = { campId:'migrated',role:'npc',createdBy:'',usedBy:null,usedAt:null,createdAt:new Date().toISOString() }; any = true; }
      }.bind(this));
      if (any) { localStorage.removeItem('nt_world_codes'); localStorage.removeItem('nt_invite_codes'); this._saveInvites(); }
    } catch(e) {}
  },
  _saveInvites: function() { this._saveKey('nt_invites', this._data.inviteCodes); },
  validateInviteCode: function(code, campId) {
    var e = this._data.inviteCodes[code];
    if (!e) return { valid:false, reason:'邀请码不存在' };
    if (e.usedBy) return { valid:false, reason:'邀请码已被使用' };
    if (e.campId !== campId) return { valid:false, reason:'邀请码不匹配当前营队' };
    return { valid:true, entry:e };
  },
  generateInviteCode: function(campId, role, createdBy) {
    var code = 'NT-'+Math.random().toString(36).substring(2,6).toUpperCase()+'-'+Math.random().toString(36).substring(2,6).toUpperCase();
    this._data.inviteCodes[code] = { campId:campId, role:role||'adventurer', createdBy:createdBy||'', usedBy:null, usedAt:null, createdAt:new Date().toISOString() };
    this._saveInvites(); return code;
  },
  consumeInviteCode: function(code, userName) {
    if (!this._data.inviteCodes[code]) return false;
    this._data.inviteCodes[code].usedBy = userName;
    this._data.inviteCodes[code].usedAt = new Date().toISOString();
    this._saveInvites(); return true;
  },

  // ══ 地图数据 ══
  setMapLocations: function(locations) { this._data.map_locations = locations; this._saveShared(); },
  setMemberLocation: function(buildingId) { if(this._currentUser){this._data.member_locations[this._currentUser]=buildingId;this._saveShared();} },

  // ══ 存盘 ══
  _timerS: null, _timerP: null,
  _saveShared: function(immediate) {
    clearTimeout(this._timerS);
    var data = { tasks: this._data.tasks, camps: this._data.camps, users: this._data.users, canteenMenu: this._data.canteenMenu, spaces: this._data.spaces, inventory: this._data.inventory, map_locations: this._data.map_locations, member_locations: this._data.member_locations, campRmb: this._data.campRmb, pendingTransactions: this._data.pendingTransactions, pendingVerifications: this._data.pendingVerifications, announcements: this._data.announcements, presence: this._data.presence, discoveries: this._data.discoveries, cardDiscoveries: this._data.cardDiscoveries, pendingConfigChanges: this._data.pendingConfigChanges, configHistory: this._data.configHistory, _lastAccommodationDeduction: this._data._lastAccommodationDeduction, _lastPoolRefill: this._data._lastPoolRefill };
    if (immediate) { this._saveKey('nt_app_v2_shared', data); return; }
    // 服务器同步：在 _saveShared 末尾统一推送
    if (typeof API !== 'undefined' && API.token) {
      var self = this;
      var payload = {
        camps: this._data.camps,
        map_locations: this._data.map_locations,
        inventory: this._data.inventory,
        canteenMenu: this._data.canteenMenu,
        tasks: this._data.tasks,
        users: this._data.users
      };
      API.request('POST', '/api/data/sync_shared', payload);
    }
    var self = this;
    this._timerS = setTimeout(function() { self._saveKey('nt_app_v2_shared', data); }, 200);
  },
  _savePrivate: function(immediate) {
    if (!this._currentUser) return;
    clearTimeout(this._timerP);
    var data = { items: this._data.items, journal: this._data.journal, newbieQuests: this._data.newbieQuests, cleaning: this._data.cleaning };
    if (immediate) { this._saveKey('nt_app_v2_' + this._currentUser, data); return; }
    var self = this;
    this._timerP = setTimeout(function() { self._saveKey('nt_app_v2_' + self._currentUser, data); }, 200);
  },
  _save: function(immediate) { this._saveShared(immediate); this._savePrivate(immediate); },

  // ══ 种子数据 ══
  _seedIfEmpty: function() {
    var today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
    if (!this._data.canteenMenu || Object.keys(this._data.canteenMenu).length === 0) {
      this._data.canteenMenu = {};
      this._data.canteenMenu[today] = { lunch: ['糙米饭','清炒时蔬','菌菇汤','麻婆豆腐'], dinner: ['素汤面','田园沙拉','蒸红薯','凉拌黄瓜'] };
    }
    if (!this._data.map_locations || !this._data.map_locations.accommodations || Object.keys(this._data.map_locations.accommodations).length === 0) {
      this._data.map_locations = this._data.map_locations || { buildings: [], state: {}, config: {}, plots: [], accommodations: {}, people_on_site: [] };
      this._data.map_locations.state = this._data.map_locations.state || {};
      this._data.map_locations.config = this._data.map_locations.config || {};
      // 住宿
      this._data.map_locations.accommodations = {
        dorm101: { beds:3, pricePerBed:20, label:'A室·三人大通铺', ac:'无', tenants:[], status:'vacant' },
        dorm102: { beds:4, pricePerBed:30, label:'B室·四人大通铺', ac:'有', tenants:[], status:'vacant' },
        dorm103: { beds:3, pricePerBed:30, label:'C室·上下床+大床', ac:'有', tenants:[], status:'vacant' },
        dorm104: { beds:1, pricePerBed:60, label:'D室·单间大床房', ac:'有', tenants:[], status:'vacant' },
        dorm105: { beds:4, pricePerBed:30, label:'E室·两个上下床', ac:'有', tenants:[], status:'vacant' },
        dorm106: { beds:4, pricePerBed:35, label:'F室·四人间上下床', ac:'有', tenants:[], status:'vacant' }
      };
this._data.map_locations.people_on_site = [];
      // 田地
      this._data.map_locations.plots = [
        { id:'fa', name:'A区', icon:'🥬', crop:'番茄', planted:'6/15', harvest:'8/30', days:55, remain:45, status:'growing' },
        { id:'fb', name:'B区', icon:'🌽', crop:'玉米', planted:'5/20', harvest:'7/23', days:80, remain:8, status:'warning' },
        { id:'fc', name:'C区', icon:'🍠', crop:'红薯', planted:'6/1', harvest:'9/21', days:90, remain:82, status:'growing' },
        { id:'fd', name:'D区', icon:'🌳', crop:'—', planted:'—', harvest:'—', days:0, remain:0, status:'conservation' },
        { id:'fe', name:'E区', icon:'🍂', crop:'—', planted:'—', harvest:'—', days:0, remain:0, status:'composting' }
      ];
      // 房间物品（生产环境从空开始，由管理员逐间录入）
      this._data.map_locations.state.room_items = [];
      // 停车
      this._data.map_locations.state.parking = { vehicle:'🛵三轮车', status:'在库', key:'🔑钥匙在门卫处', user:'无人取用' };
      // 戏台
      this._data.map_locations.state.stage = { status:'🟢整洁', items:'🌸月季·茉莉盛开', events:'🎭无活动', cleaning:'📋每月修剪花木' };
      // 配置
      this._data.map_locations.config = {
        cleaning_pricing: { dirty:20, warning:15, clean:5 },
        dirtiness_rates: { bathroom:15, kitchen:10, hallway:8, studio:8, bedroom:5, laundry:5, storage:3, outdoor:2, field:0 },
        dirtiness_thresholds: { green:30, yellow:60, red:80 },
        item_expiry_days: 5,
        nt_rewards: { stock_in:2, stock_out:1, cleaning:10 }
      };
    }
    if (!this._data.camps || Object.keys(this._data.camps).length === 0) {
      this._data.camps = {
        camp4:{id:'camp4',name:'第四期共创营',emoji:'🏕️',theme:'南塘有风，共创有光',date:'7/20 — 7/27',status:'active',people:12,max:16,location:'南塘合作社大院',desc:'七天沉浸式在地创作：工笔画、陶艺、书法、田园生活。适合所有对传统文化感兴趣的朋友。',highlights:['7/20 开营仪式 + 欢迎晚餐','7/22 工笔画大师课','7/25 作品展览日','7/27 结营仪式 + 敬字亭'],_seed:true},
        camp5:{id:'camp5',name:'工笔画写生营',emoji:'🎨',theme:'五天集中写生，导师一对一点评',date:'8/1 — 8/5',status:'upcoming',people:5,max:10,location:'大地书房',desc:'五天集中写生，导师一对一点评。适合有基础的同学。',highlights:['8/1 开营','8/2-4 写生+点评','8/5 作品展'],_seed:true},
        camp1:{id:'camp1',name:'春季写生周',emoji:'🌸',theme:'春季户外写生',date:'4/10 — 4/17',status:'archived',people:8,max:12,location:'南塘周边',desc:'春季户外写生。',highlights:['已结束'],_seed:true}
      };
    }
    this._saveShared();
  },

  // ══ 日记（私有） ══
  addJournal: function(user, type, content, opts) {
    var entry = { user: user, type: type, content: content, time: (typeof Clock!=='undefined'?Clock.iso():new Date().toISOString()) };
    if (opts) Object.assign(entry, opts);
    this._data.journal.unshift(entry);
    if (this._data.journal.length > 200) this._data.journal.length = 200;
    this._savePrivate();
    // E 修复：同步到服务端（此前 API.syncJournal 是死代码，时间线跨设备永远为空）
    if (typeof API !== 'undefined' && API.token && typeof API.syncJournal === 'function') {
      try { API.syncJournal(entry); } catch(e) { console.warn('[journal] sync failed', e); }
    }
  },

  // ══ 校核制 ══
  addVerification: function(type, doer, action, detail, ntAmount, verifierReward) {
    // CR5: 仅在地成员（非 visitor）可发起校核
    var users = typeof getUsers === 'function' ? getUsers() : {};
    var userRole = (users[doer || this._currentUser] || {}).role || 'visitor';
    if (userRole === 'visitor') {
      if (typeof showToast === 'function') showToast('🏕️ 入住后可使用校核功能', 'warn');
      return null;
    }
    var vfy = { id: 'vfy_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6), type: type, doer: doer, action: action, detail: detail||{}, ntAmount: ntAmount||0, verifierReward: verifierReward||Math.max(2, Math.ceil(ntAmount/3)), createdAt: new Date().toISOString(), verifier: null, verifiedAt: null, status: 'pending' };
    if (!this._data.pendingVerifications) this._data.pendingVerifications = [];
    this._data.pendingVerifications.push(vfy);
    this._saveShared(true);
    // R2.3: HTTP 模式同步写服务端
    if (typeof API !== 'undefined' && API.token) {
      API.request('POST', '/api/data/verifications', vfy).catch(function(){});
    }
    return vfy;
  },
  verifyAction: function(vfyId, verifierName, approved, rejectReason) {
    var vfys = this._data.pendingVerifications || [];
    var vfy = vfys.find(function(v){ return v.id===vfyId; });
    if (!vfy) return { ok: false, error: '校核项不存在' };
    if (vfy.status !== 'pending' && vfy.status !== 'rejected') return { ok: false, error: '已校核过了' };
    if (vfy.doer === verifierName) return { ok: false, error: '不能校核自己的操作' };
    // 冷却/日上限校验——已迁移到服务端（P3），客户端仅保留结构性校验
    // 退回模式
    if (approved === false) {
      vfy.retryCount = (vfy.retryCount || 0) + 1;
      vfy.rejectReason = rejectReason || '';
      vfy.rejectedBy = verifierName;
      vfy.rejectedAt = new Date().toISOString();
      if (vfy.retryCount >= 3) {
        vfy.status = 'permanently_rejected';
      } else {
        vfy.status = 'rejected';
      }
      this._saveShared(true);
      return { ok: true, rejected: true, retryCount: vfy.retryCount };
    }
    // 通过模式——HTTP 先调 API，成功回调中更新本地状态（悲观更新）
    // 兼容服务端 snake_case 和客户端 camelCase
    var ntAmt = vfy.ntAmount || vfy.nt_amount || 0;
    var vfyReward = vfy.verifierReward || vfy.verifier_reward || 0;
    var isOffline = (typeof API === 'undefined' || !API.token);
    if (isOffline) {
      // 离线：直接本地 earn + 入队
      vfy.status = 'verified'; vfy.verifier = verifierName; vfy.verifiedAt = new Date().toISOString();
      if (window.NT && ntAmt > 0) {
        try { NT.earn(vfy.doer, ntAmt, vfy.action, 'camp'); } catch(e) {}
        this._data._pendingEarnQueue.push({vfyId: vfy.id, doer: vfy.doer, amount: ntAmt, action: vfy.action, reward: vfyReward, ts: Date.now()});
        this._saveShared(true);
      }
    } else {
      // HTTP：异步调用API，不返回同步 ok——调用方应在回调中处理 UI 更新
      var self = this;
      API.request('POST', '/api/nt/verifications/' + vfy.id + '/approve',
        {doer: vfy.doer, action: vfy.action, nt_amount: ntAmt, verifier_reward: vfyReward}
      ).then(function() {
        vfy.status = 'verified'; vfy.verifier = verifierName; vfy.verifiedAt = new Date().toISOString();
        self.addAnnouncement(vfy.type, vfy.doer, verifierName, vfy.action, ntAmt);
        if (typeof _trumpet === 'function') _trumpet(verifierName + ' 确认了 ' + vfy.doer + ' 的 ' + (vfy.action||'劳动') + ' ✅ +' + ntAmt + 'NT', 'golden');
        if (vfy.type === 'cleaning' && typeof _completeNewbieQuest === 'function') _completeNewbieQuest(vfy.doer, 'join_cleaning');
        if (!self._data.discoveries) self._data.discoveries = [];
        self._data.discoveries.unshift({ id: vfy.id, type: vfy.type, doer: vfy.doer, verifier: verifierName, action: vfy.action, ntAmount: ntAmt, verifiedAt: vfy.verifiedAt, status: 'active' });
        self._saveShared(true);
        if (typeof renderCardRoom === 'function') renderCardRoom();
        if (typeof renderVerifyRoom === 'function') renderVerifyRoom();
        if (typeof refreshUserUI === 'function') refreshUserUI();  // C-6: 确认后立即重拉服务端余额，刷新工作台显示
        var popup = document.querySelector('.vfy-popup'); if (popup) popup.remove();
        if (window.Game && Game.toast) Game.toast('✅ 校核完成！');
      }).catch(function(err) {
        var msg = (err && err.detail) || '网络错误';
        if (err && err.status === 429) {
          msg = msg.indexOf('1h') !== -1 ? '你在 1 小时内已经验证过 TA 了' :
                msg.indexOf('10') !== -1 ? '今天已验证 10 次，明天再来吧' : msg;
        }
        showToast(msg, 'warn');
        vfy.status = 'pending'; vfy.verifier = null; vfy.verifiedAt = null;
        self._saveShared(true);
        if (typeof renderCardRoom === 'function') renderCardRoom();
      });
      return { async: true };  // 异步处理，调用方不应依赖同步结果
    }
    // 离线路径：本地更新
    this.addAnnouncement(vfy.type, vfy.doer, verifierName, vfy.action, vfy.ntAmount);
    if (vfy.type === 'cleaning' && typeof _completeNewbieQuest === 'function') _completeNewbieQuest(vfy.doer, 'join_cleaning');
    if (!this._data.discoveries) this._data.discoveries = [];
    this._data.discoveries.unshift({ id: vfy.id, type: vfy.type, doer: vfy.doer, verifier: verifierName, action: vfy.action, ntAmount: vfy.ntAmount, verifiedAt: vfy.verifiedAt, status: 'active' });
    this._saveShared(true);
    return { ok: true };
  },
  // ══ 离线 earn 队列同步 ══
  _drainPendingEarns: function() {
    if (!this._data._pendingEarnQueue || !this._data._pendingEarnQueue.length) return;
    if (typeof API === 'undefined' || !API.token) return;
    var queue = this._data._pendingEarnQueue.slice(0);
    this._data._pendingEarnQueue = [];
    var self = this;
    var seen = {};
    queue.forEach(function(item) {
      var key = item.vfyId || (item.doer + '|' + item.ts);
      if (seen[key]) return; seen[key] = true;
      API.request('POST', '/api/nt/verifications/' + item.vfyId + '/approve',
        {doer: item.doer, action: item.action, nt_amount: item.amount, verifier_reward: item.reward || 0}
      ).catch(function() {
        self._data._pendingEarnQueue.push(item);
      });
    });
  },
  // ══ 公告栏 ══
  addAnnouncement: function(type, doer, verifier, action, ntAmount) {
    if (!this._data.announcements) this._data.announcements = [];
    var icons = { cleaning:'🧹', stock_in:'📦', stock_out:'🗑', field_harvest:'🌿', field_action:'🌿', quest:'📋', stay:'🛏️', presence:'🃏', other:'⭐' };
    var text = (icons[type]||'⭐')+' '+doer+' '+action+' ✅ '+verifier+'校核 +'+ntAmount+'NT';
    this._data.announcements.unshift({ id: 'ann_'+Date.now().toString(36), text: text, time: new Date().toISOString(), type: type, doer: doer, verifier: verifier });
    if (this._data.announcements.length > 50) this._data.announcements.length = 50;
    this._saveShared(true);
  },
  // ══ 章2: 住宿费日扣 ══
  _deductAccommodation: function() {
    // CR6: HTTP 模式由服务端 daily_tick 处理，客户端跳过防双重扣费
    if (typeof API !== 'undefined' && API.token) return;
    // E3.1: 遍历 room.tenants[] 数组（替代旧的 room.tenant 字符串）
    var accs = (this._data.map_locations && this._data.map_locations.accommodations) || {};
    var today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
    var lastDeduction = this._data._lastAccommodationDeduction || '';
    if (lastDeduction === today) return;
    var lastDate = lastDeduction ? new Date(lastDeduction + 'T00:00:00') : new Date(today + 'T00:00:00');
    var todayDate = new Date(today + 'T00:00:00');
    var daysPassed = Math.max(1, Math.floor((todayDate - lastDate) / 86400000));
    if (daysPassed <= 0) { this._data._lastAccommodationDeduction = today; return; }
    Object.keys(accs).forEach(function(roomId) {
      var room = accs[roomId];
      if (!room.tenants || !room.tenants.length) return;
      var roomPrice = room.pricePerBed || room.rentNT || 30;
      room.tenants.forEach(function(t) {
        if (!t.name) return;
        var user = window.NT ? NT.getUser(t.name) : null;
        if (!user) return;
        var totalDue = roomPrice * daysPassed;
        var affordable = Math.min(user.ntBalance, totalDue);
        if (affordable > 0) {
          try { NT.spend(t.name, affordable, '住宿费: '+roomId+' ×'+daysPassed+'天', 'personal'); } catch(e) {}
        }
        var unpaid = totalDue - affordable;
        if (unpaid > 0) {
          user.overdueNT = (user.overdueNT || 0) + unpaid;
          if (typeof showToast === 'function') showToast(t.name+' 住宿欠费 '+unpaid+' NT', 'warn');
        }
      });
    }.bind(this));
    this._data._lastAccommodationDeduction = today;
    this._saveShared(true);
  },

  // ══ 在线翻牌 ══
  flipPresence: function(userName, status, location) {
    if (!this._data.presence) this._data.presence = {};
    var now = new Date().toISOString();
    this._data.presence[userName] = { status: status||'onsite', location: location||null, updatedAt: now, updatedBy: userName };
    // 切到云在线/外出时清除 member_locations；在地但未选位置也清除
    if (status !== 'onsite' || !location) {
      if (this._data.member_locations[userName]) delete this._data.member_locations[userName];
    }
    if (status === 'onsite' && location) {
      this._data.member_locations[userName] = location;
    }
    this._saveShared(true);
  },
  flipForOther: function(targetName, status, flipperName) {
    if (!window.NT) return { ok: false, error: 'NT系统不可用' };
    if (targetName === flipperName) return { ok: false, error: '不能翻自己的牌，请直接用翻牌功能' };
    // 翻牌者支付 1 NT 提醒代价（不扣被翻者的钱）
    var cost = 1;
    var flipper = NT.getUser(flipperName);
    if (!flipper || flipper.ntBalance < cost) return { ok: false, error: '你的 NT 余额不足，无法帮翻' };
    try { NT.spend(flipperName, cost, '帮 '+targetName+' 翻牌', 'personal'); } catch(e) {}
    this.flipPresence(targetName, status, null);
    this.addAnnouncement('presence', targetName, flipperName, '状态更新为 '+(status==='onsite'?'🟢在地':status==='cloud'?'☁️云在线':'🔵外出'), 0);
    return { ok: true, cost: cost };
  },

  // ══ 章2: 公约修改 ══
  proposeConfigChange: function(changes, note, meetingMinutes, votes, proposer) {
    if (!this._data.pendingConfigChanges) this._data.pendingConfigChanges = [];
    var change = {
      id: 'cfg_'+Date.now().toString(36),
      changes: changes,           // [{ field:'cleaning_pricing.dirty', old:20, new:25 }]
      note: note || '',
      meetingMinutes: meetingMinutes || '',
      votes: votes || { for:[], against:[] },
      proposedBy: proposer,
      proposedAt: new Date().toISOString(),
      verifiedBy: [],
      requiredVerifiers: 2,
      status: 'pending',
      noticePeriodHours: 24       // 公示期
    };
    this._data.pendingConfigChanges.push(change);
    this._saveShared(true);
    return change;
  },
  verifyConfigChange: function(changeId, verifier) {
    var changes = this._data.pendingConfigChanges || [];
    var change = changes.find(function(c){ return c.id===changeId; });
    if (!change) return { ok: false, error: '修改提案不存在' };
    if (change.status !== 'pending') return { ok: false, error: '提案已处理' };
    if (change.proposedBy === verifier) return { ok: false, error: '管理员不能校核自己的修改' };
    if (change.verifiedBy.indexOf(verifier) >= 0) return { ok: false, error: '你已经校核过了' };
    // 检查24h公示期
    var proposedAt = new Date(change.proposedAt).getTime();
    var minTime = proposedAt + change.noticePeriodHours * 3600 * 1000;
    if (Date.now() < minTime) {
      var remaining = Math.ceil((minTime - Date.now()) / 3600000);
      return { ok: false, error: '公示期未满，还需 '+remaining+' 小时' };
    }
    change.verifiedBy.push(verifier);
    if (change.verifiedBy.length >= change.requiredVerifiers) {
      change.status = 'approved';
      change.appliedAt = new Date().toISOString();
      // 应用修改到 config
      var config = this._data.map_locations && this._data.map_locations.config;
      if (config) {
        change.changes.forEach(function(c) {
          var keys = c.field.split('.');
          var obj = config;
          for (var i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
          }
          obj[keys[keys.length - 1]] = c.new;
        });
      }
      // 写入修改历史
      if (!this._data.configHistory) this._data.configHistory = [];
      this._data.configHistory.push(change);
    }
    this._saveShared(true);
    return { ok: true, remaining: change.requiredVerifiers - change.verifiedBy.length };
  },

  checkPresenceReminder: function(userName) {
    var p = (this._data.presence||{})[userName];
    if (!p) return { hours: -1, neverFlipped: true }; // 从未翻牌
    var updated = new Date(p.updatedAt).getTime();
    var now = Date.now();
    if (now - updated > 24*3600*1000) return { hours: Math.floor((now-updated)/3600000), neverFlipped: false };
    return null; // 24h 内翻过，无需提醒
  },

  // 章0.4: 24h 归档旧发现
  _archiveOldDiscoveries: function() {
    var cutoff = Date.now() - 24 * 3600 * 1000;
    (this._data.discoveries || []).forEach(function(d) {
      if (d.status === 'active' && new Date(d.verifiedAt).getTime() < cutoff) {
        d.status = 'archived';
      }
    });
  },

  // 脏污度每日自动增长（每天每空间 += 该类型的 dirtiness_rate）
  _tickDirtiness: function() {
    console.warn('[deprecated] use _growDirtiness in app.js instead');
    var ml = this._data.map_locations;
    if (!ml || !ml.state || !ml.state.room_items) return;
    var today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
    if (ml._lastDirtinessTick === today) return;
    ml._lastDirtinessTick = today;
    var rates = (ml.config && ml.config.dirtiness_rates) ? ml.config.dirtiness_rates : { bathroom:15, kitchen:10, hallway:8, studio:8, bedroom:5, laundry:5, storage:3, outdoor:2, field:0 };
    (ml.state.room_items || []).forEach(function(room) {
      var rate = rates[room.room] || rates[room.type] || 5;
      room.dirtiness = Math.min(100, (room.dirtiness||0) + rate);
    });
    this._saveShared();
  },

  _dailyPoolRefill: function() {
    // R7: 服务端 cron 已接管，cron_active 时客户端跳过
    if (window._cronActive) return;
    // E3.7: HTTP 模式由服务端 daily_tick 处理，客户端不再独立执行
    if (typeof API !== 'undefined' && API.token) return;
    if (!window.NT) return;
    var today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
    if (this._data._lastPoolRefill === today) return;
    this._data._lastPoolRefill = today;
    var pool = NT.getCommunityPool();
    if (pool < 500) {
      NT.depositToCommunityPool(50);
      if (typeof logActivity === 'function') logActivity('pool_refill', '社区池自动补充 +50 NT（余额 '+pool+' → '+(pool+50)+'）');
    }
    this._saveShared();
  },

  reset: function() {
    if (this._currentUser) localStorage.removeItem('nt_app_v2_' + this._currentUser);
    localStorage.removeItem('nt_app_v2_shared');
    this._data = {};
    this._currentUser = '';
    this.init();
  }
};

// 迁移：旧 nt_app_v2（混合存储）→ 共享 + 私有
(function() {
  var old;
  try { old = JSON.parse(localStorage.getItem('nt_app_v2')); } catch(e) { old = null; }
  if (!old || old._splitDone) return;
  // 迁移前先加载已有新格式数据，避免覆盖
  var existing = AppData._load('nt_app_v2_shared') || {};
  if (old.tasks)   AppData._saveKey('nt_app_v2_shared', { tasks:old.tasks||{}, camps:old.camps||{}, users:old.users||{}, canteenMenu:old.canteenMenu||{}, spaces:old.spaces||{}, inventory:old.inventory||{}, map_locations: old.map_locations || {}, member_locations: old.member_locations || {}, pendingTransactions: existing.pendingTransactions || old.pendingTransactions || [], pendingVerifications: existing.pendingVerifications || old.pendingVerifications || [], announcements: existing.announcements || old.announcements || [], presence: existing.presence || old.presence || {} });
  if (old.myItems)  { Object.keys(old.myItems).forEach(function(u) { var d = AppData._load('nt_app_v2_'+u)||{}; d.myItems=old.myItems[u]; if(old.items&&old.items[u])d.items=old.items[u]; if(old.newbieQuests&&old.newbieQuests[u])d.newbieQuests=old.newbieQuests[u]; AppData._saveKey('nt_app_v2_'+u, d); }); }
  // journal: 按 user 字段拆分
  if (old.journal) {
    var byUser = {};
    old.journal.forEach(function(j) { var u = j.user||''; if(u){if(!byUser[u])byUser[u]=[];byUser[u].push(j);} });
    Object.keys(byUser).forEach(function(u) { var d = AppData._load('nt_app_v2_'+u)||{}; d.journal=byUser[u]; AppData._saveKey('nt_app_v2_'+u, d); });
  }
  if (old.cleaning && typeof old.cleaning.lastCheckDate === 'string') { /* 扁平 cleaning（新格式），跳过不拆分 */ }
  else if (old.cleaning) { Object.keys(old.cleaning).forEach(function(u) { var d=AppData._load('nt_app_v2_'+u)||{}; d.cleaning=old.cleaning; AppData._saveKey('nt_app_v2_'+u,d); }); }
  old._splitDone = true;
  try { localStorage.setItem('nt_app_v2', JSON.stringify(old)); } catch(e) {}
})();

// Phase 3: 跨标签同步（深度合并，非 Object.assign 直接替换）
window.addEventListener('storage', function(e) {
  if (e.key === 'nt_app_v2_shared' && e.newValue) {
    try {
      var d = JSON.parse(e.newValue);
      if (d) {
        Object.keys(d).forEach(function(k) {
          if (typeof d[k] === 'object' && !Array.isArray(d[k]) && typeof AppData._data[k] === 'object') {
            Object.assign(AppData._data[k], d[k]);
          } else { AppData._data[k] = d[k]; }
        });
      }
    } catch(ex) {}
    if (typeof refreshUserUI === 'function') refreshUserUI();
  }
});

AppData.init();
// 脏污度由 app.js _growDirtiness 统一管理；此处仅保留社区池补填
setInterval(function(){ if(window.AppData){ AppData._dailyPoolRefill(); } }, 3600000);
