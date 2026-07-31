// ══ API 适配层 — 行业标准：access token 存内存，refresh token httpOnly cookie ══
var API = {
  base: '',
  token: null,
  _consecutiveFailures: 0,
  _serverOnline: true,  // access token，仅存 JS 内存，不落 localStorage
  _refreshInProgress: null,  // Promise|null — 防并发重入
  user: null,   // 当前用户信息
  init: function(baseUrl) {
    // 同源模式：API 请求发给当前页面所在的服务器（部署自包含）。
    // 只有前后端分离部署时（如纯静态前端 + 独立后端）才需要传入 baseUrl。
    this.base = baseUrl || '';
  },
  // ── 底层请求 ──
  request: async function(method, path, body) {
    if (window.location.protocol === 'file:' && !this.base) return {ok:false, error:'离线模式', _offline:true};
    var url = this.base ? (this.base + path) : path;
    var headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    var opts = { method: method, headers: headers, credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);
    opts.signal = AbortSignal.timeout(30000);  // 30s timeout
    try {
      var resp = await fetch(url, opts);
      this._consecutiveFailures = 0;
      if (!this._serverOnline) { this._serverOnline = true; if (typeof showToast === 'function') showToast('已重新连接', 'ok'); }
      if (resp.status === 401) {
        var self = this;
        // 防并发：多个请求同时401时共享一次refresh
        if (!self._refreshInProgress) {
          self._refreshInProgress = new Promise(function(resolve) {
            self.silentRefresh(function(user) { resolve(!!user); });
          });
        }
        var refreshed = await self._refreshInProgress;
        self._refreshInProgress = null;
        if (refreshed && self.token) {
          // 重试原请求一次
          var retryHeaders = { 'Content-Type': 'application/json' };
          retryHeaders['Authorization'] = 'Bearer ' + self.token;
          var retryOpts = { method: method, headers: retryHeaders, credentials: 'include' };
          if (body) retryOpts.body = JSON.stringify(body);
          var retryResp = await fetch(url, retryOpts);
          if (retryResp.status !== 401) { self._consecutiveFailures = 0; var _rr=await retryResp.json(); if (retryResp.status>=400&&_rr.detail){if(typeof showToast==='function')showToast(_rr.detail,'error');_rr.ok=false;_rr.error=_rr.detail;} return _rr; }
        }
        self.token = null;
        return { ok: false, error: '登录过期', _offline: false };
      }
      var result = await resp.json();
      // B-8: 400+ 服务端错误透传——detail 映射到 error 字段，toast 提示
      if (resp.status >= 400 && result.detail) {
        if (typeof showToast === 'function') showToast(result.detail, 'error');
        result.ok = false; result.error = result.detail;
      }
      return result;
    } catch(e) {
      this._consecutiveFailures++;
      if (this._consecutiveFailures >= 3 && this._serverOnline) {
        this._serverOnline = false;
        if (typeof showToast === 'function') showToast('服务器连接断开，离线模式', 'warn');
      }
      if (e.name === 'TypeError') return {ok:false, error:'网络不通', _offline:true};
      if (e.name === 'AbortError') return {ok:false, error:'请求超时', _offline:true};
      return {ok:false, error:'网络异常', _offline:true};
    }
  },
  // ── 认证 ──
  asyncAuth: function(type, name, password, role, seed, inviteCode, callback) {
    if (window.location.protocol === 'file:' && !this.base) { if (callback) callback({ok:false, error:'离线模式，请通过服务器访问'}); return; }
    var path = type === 'register' ? '/api/auth/register' : '/api/auth/login';
    var body = type === 'register' ? {name:name, password:password, role:role||'visitor', avatar_seed:seed, invite_code:inviteCode||''} : {name:name, password:password};
    var self = this;
    fetch((this.base||'') + path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body), credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.ok && d.token) {
          self.token = d.token; self.user = d.user;
          // httpOnly cookie 由服务器 set-cookie 自动管理，无需 JS 操作
          if (callback) callback(d.user);
        } else { if (callback) callback(d); }
      })
      .catch(function(e) { console.warn('[API] request failed', e); if (callback) callback(null); });
  },
  silentRefresh: function(callback) {
    if (window.location.protocol === 'file:' && !this.base) { if (callback) callback(null, 'offline'); return; }
    var self = this;
    fetch((this.base||'') + '/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(function(r) { return r.json().then(function(d) { return {ok:r.ok,status:r.status,data:d}; }); })
      .then(function(r) {
        var d = r.data;
        if (d && d.ok && d.token) {
          self.token = d.token; self.user = d.user;
          if (callback) callback(d.user);
        } else if (r.status === 401) {
          if (callback) callback(null, 'expired');
        } else {
          if (callback) callback(null, 'server_error');
        }
      })
      .catch(function(e) { self._consecutiveFailures++; if (self._consecutiveFailures >= 3 && self._serverOnline) { self._serverOnline = false; if (typeof showToast === 'function') showToast('服务器连接断开，离线模式', 'warn'); } if (callback) callback(null, 'network'); });
  },
  logout: function(callback) {
    this.token = null; this.user = null;
    if (window.location.protocol === 'file:' && !this.base) { if (callback) callback(); return; }
    fetch((this.base||'') + '/api/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(function() { if (callback) callback(); });
  },
  changePassword: function(oldPwd, newPwd) {
    return this.request('POST', '/api/auth/change-password', {old_password: oldPwd, new_password: newPwd});
  },
  updateProfile: function(data) {
    return this.request('PUT', '/api/auth/profile', data);
  },
  // ── NT 操作 ──
  createDepositIntent: function(amount, fromAddress) {
    return this.request('POST', '/api/nt/deposit-intent', {amount: amount, from_address: fromAddress||''});
  },
  getDepositIntents: function() {
    return this.request('GET', '/api/nt/deposit-intents');
  },
  getBalance: function(callback) {
    this.request('GET', '/api/nt/balance').then(function(r) { if (callback) callback(r && !r.detail && !r._offline ? r : null); });
  },
  getLedger: function(opts) {
    var qs = '?limit=' + (opts && opts.limit || 50);
    if (opts && opts.type) qs += '&type=' + opts.type;
    return this.request('GET', '/api/nt/ledger' + qs);
  },
  transfer: function(to, amount, reason) { return this.request('POST', '/api/nt/transfer', {to:to, amount:amount, reason:reason||''}); },
  earn: function(amount, reason, scope) { console.warn('[API] earn deprecated, use /api/nt/verifications/{id}/approve'); return Promise.resolve({ok:false, error:"deprecated"}); },
  spend: function(amount, reason, scope) { return this.request('POST', '/api/nt/spend', {amount:amount, reason:reason||'', scope:scope||'personal'}); },
  topUp: function(user, amount, reason) { return this.request('POST', '/api/nt/topup', {user:user, amount:amount, reason:reason||''}); },
  verify: function() { return this.request('GET', '/api/nt/verify'); },
  approveVerification: function(id, data) { return this.request('POST', '/api/nt/verifications/' + id + '/approve', data); },
  rejectVerification: function(id, reason) { return this.request('POST', '/api/nt/verifications/' + id + '/reject', {reject_reason: reason}); },
  withdraw: function(amount, toAddress) { return this.request('POST', '/api/nt/withdraw', {amount: amount, to_address: toAddress||''}); },
  // ── 公约签署 ──
  covenantStatus: function() { return this.request('GET', '/api/covenant/status'); },
  covenantSign: function() { return this.request('POST', '/api/covenant/sign'); },
  covenantText: function() { return this.request('GET', '/api/covenant/text'); },
  // ── Admin 审批 ──
  pendingWithdraws: function() { return this.request('GET', '/api/admin/withdraws/pending'); },
  confirmWithdraw: function(entryId) { return this.request('POST', '/api/admin/withdraw/confirm?entry_id=' + encodeURIComponent(entryId)); },
  rejectWithdraw: function(entryId) { return this.request('POST', '/api/admin/withdraw/reject?entry_id=' + encodeURIComponent(entryId)); },
  // ── 住宿 ──
  innRooms: function() { return this.request('GET', '/api/accommodation/inn-rooms'); },  // C-B-5: 素社民宿房型列表
  checkin: function(roomId, track, checkIn, checkOut, bedNum) { return this.request('POST', '/api/accommodation/checkin', {room_id: roomId, track: track || 'coop', check_in: checkIn || null, check_out: checkOut || null, bed_num: bedNum || 1}); },
  checkout: function() { return this.request('POST', '/api/accommodation/checkout'); },
  accommodationStatus: function() { return this.request('GET', '/api/accommodation/status'); },  // G-3 记账/欠费状态
  // ── B2/B3/B4: Storage 储物 ──
  addItemStorage: function(data) { return this.request('POST', '/storage/items', data); },
  getStorage: function() { return this.request('GET', '/storage/items'); },
  removeItemStorage: function(id) { return this.request('DELETE', '/storage/items/' + encodeURIComponent(id)); },
  // ── C-B-3: 营地报到（幂等）──
  campCheckin: function(campId) { return this.request('POST', '/api/camps/' + encodeURIComponent(campId) + '/checkin'); },
  getPools: function() { return this.request('GET', '/api/nt/pools'); },
  archiveSummary: function(userId) { return this.request('GET', '/api/data/archive_summary/' + encodeURIComponent(userId)); },  // ZX-4 F12 个人沉淀公开计数
  // ── B5补: Archive 档案 ──
  getArchiveItems: function(category) { return this.request('GET', '/archive/items' + (category ? '?category=' + encodeURIComponent(category) : '')); },
  // ── B6补: Fields 田地 ──
  getFields: function() { return this.request('GET', '/fields'); },
  getFieldPlot: function(id) { return this.request('GET', '/fields/' + encodeURIComponent(id)); },
  harvestFieldPlot: function(id) { return this.request('POST', '/fields/' + encodeURIComponent(id) + '/harvest'); },
  waterFieldPlot: function(id) { return this.request('POST', '/fields/' + encodeURIComponent(id) + '/water'); },
  fertilizeFieldPlot: function(id) { return this.request('POST', '/fields/' + encodeURIComponent(id) + '/fertilize'); },
  // ── B7补: Settings 用户设置 ──
  getUserSettings: function() { return this.request('GET', '/users/me/settings'); },
  patchUserSettings: function(data) { return this.request('PATCH', '/users/me/settings', data); },
  // ── NEW-USER-TASK: 新人任务 ──
  getNewUserTasks: function() { return this.request('GET', '/api/new_user_tasks/me'); },
  completeNewUserTask: function(id) { return this.request('PATCH', '/api/new_user_tasks/' + encodeURIComponent(id) + '/complete'); },
  // ── A-CLEAN-WEEKLY: 大扫除周任务 ──
  cleanWeeklyDistribute: function(data) { return this.request('POST', '/api/clean_weekly/distribute', data); },
  cleanWeeklyTasks: function(week) { return this.request('GET', '/api/clean_weekly/tasks' + (week ? '?week=' + encodeURIComponent(week) : '')); },
  cleanWeeklyClaim: function(taskId) { return this.request('POST', '/api/clean_weekly/claim/' + encodeURIComponent(taskId)); },
  cleanWeeklyUnclaim: function(taskId) { return this.request('POST', '/api/clean_weekly/unclaim/' + encodeURIComponent(taskId)); },
  cleanWeeklySubmit: function(taskId) { return this.request('POST', '/api/clean_weekly/submit/' + encodeURIComponent(taskId)); },
  // ── 任务同步 ──
  syncTask: function(task, callback) {
    var data = { title: task.name || task.title, reward: task.nt || task.reward || 5,
      category: task.type || task.category || 'other', scope: task.scope || '社区',
      note: task.note || '', slots: task.slots || 1, deadline: task.deadline || '',
      reviewer: task.reviewer || '', location_id: task.locationId || '',
      req_photo: task.reqPhoto || 0, req_file: task.reqFile || 0 };
    this.request('POST', '/api/tasks', data).then(function(r) {
      if (callback) callback(r && r.task_id ? r.task_id : null);
    });
  },
  syncTaskUpdate: function(taskId, updates) { return this.request('PUT', '/api/tasks/' + taskId, updates); },
  deleteTask: function(name) { return this.request('DELETE', '/api/tasks/' + name); },
  fetchTasks: function(callback) {
    // B-3: 循环分页拉全——后端 mode=hall 默认每页 50/上限 200，旧策略只拉首页致 50 条后任务不可见。
    // 每页取 200，页满则续拉下一页，直到返回不足一页；上限 2000 条防御无限循环。
    var self = this, PAGE = 200, MAX = 2000, acc = [];
    function pull(offset) {
      self.request('GET', '/api/tasks?mode=hall&limit=' + PAGE + '&offset=' + offset).then(function(tasks) {
        if (!Array.isArray(tasks)) {
          // 首页即失败/离线 → 回 null 兜底；已累积则返回已得部分
          if (callback) callback(acc.length ? acc : null);
          return;
        }
        acc = acc.concat(tasks);
        if (tasks.length >= PAGE && acc.length < MAX) { pull(offset + PAGE); }
        else { if (callback) callback(acc); }
      });
    }
    pull(0);
  },
  fetchDiscoveries: function(callback) {
    this.request('GET', '/api/data/card_discoveries').then(function(discs) {
      if (callback) callback(Array.isArray(discs) ? discs : null);
    });
  },
  // ── 全量同步：登录时拉取所有数据覆盖本地 ──
  syncAll: function(callback) {
    this.request('GET', '/api/data/sync_all').then(function(data) {
      if (callback) callback(Array.isArray(data) ? null : data);  // data is an object {tasks, journal, ...}
    });
  },
  syncActivity: function(type, text) { this.request('POST', '/api/data/activity_log', {type:type, text:text}); },
  syncJournal: function(entry) { this.request('POST', '/api/data/journal', entry); },
  syncDiscovery: function(disc) {
    return this.request('POST', '/api/data/card_discoveries', {
      id: disc.id, space_id: disc.spaceId, description: disc.description,
      guesser: disc.guesser, guessed_person: disc.guessedPerson,
      guessed_at: disc.guessedAt, status: disc.status || 'pending',
      nt_guesser: disc.ntGuesser || 5, nt_doer: disc.ntDoer || 10
    }).then(function(r) {
      return (r && r.id) ? r.id : disc.id;
    });
  },
  // ── A-LABOR-FE: 治理端点 ──
  checkProposalRight: function() { return this.request('GET', '/api/governance/check_proposal_right'); },
  checkVoteRight: function() { return this.request('GET', '/api/governance/check_vote_right'); },
  // ── A-LABOR-FE: 劳动配置 ──
  laborConfig: function() { return this.request('GET', '/api/labor/config'); },
  // ── A-LABOR-FE: 部分提现(超额部分排队) ──
  withdrawPartial: function(amount, toAddress) { return this.request('POST', '/api/nt/withdraw', {amount: amount, to_address: toAddress||'', partial: true}); },
  // ── SM-5: 测试台 ──
  devReset: function(mode) { return this.request('POST', '/api/admin/dev-reset?mode=' + (mode||'soft')); },
  devSeed: function() { return this.request('POST', '/api/admin/dev-seed'); },
  // ── P1-#6 ③ potluck 田间接龙 ──
  getPotluckList: function() { return this.request('GET', '/api/potluck/list'); },
  joinPotluck: function(data) { return this.request('POST', '/api/potluck/join', data); },
  // ── P1-#6 ⑤⑥⑦ proposals 议事厅提案 ──
  getProposalsList: function() { return this.request('GET', '/api/proposals/list'); },
  submitProposal: function(data) { return this.request('POST', '/api/proposals/submit', data); },
  voteProposal: function(propId, vote) { return this.request('POST', '/api/proposals/vote', {proposal_id: propId, vote: vote}); },
  // ── P1-#6 ⑧ camp_proposals 营地议事 ──
  getCampProposalsList: function(campId) { return this.request('GET', '/api/camp_proposals/list' + (campId ? '?camp_id=' + encodeURIComponent(campId) : '')); },
  // ── P1-#6 ⑨ gossip 茶馆八卦（冻结）──
  getGossipList: function() { return Promise.resolve({ok:true, _frozen:true, items:[], hint:'茶馆板块即将开放'}); },
  // ── P1-#6 ⑩ market 二手集市（冻结）──
  getMarketList: function() { return Promise.resolve({ok:true, _frozen:true, items:[], hint:'集市板块即将开放'}); },
  // ── P1-#6 ⑪ auction 拍卖会（冻结）──
  getAuctionList: function() { return Promise.resolve({ok:true, _frozen:true, items:[], hint:'拍卖板块即将开放'}); },
  // ── P1-#6 ⑫ health 体检报告 ──
  getHealthReport: function() { return this.request('GET', '/api/health/report'); },
  // ── P1-#6 ⑬ notifications 通报 ──
  getNotificationsList: function() { return this.request('GET', '/api/notifications/list'); },
  // ── P1-#6 ⑭ cleaning_pricing 清洁定价 ──
  getCleaningPricing: function() { return this.request('GET', '/api/cleaning_pricing'); },
  // ── P1-#6 ⑮ labor/history 劳动历史 ──
  getLaborHistory: function() { return this.request('GET', '/api/labor/history'); },
  // ── P1-#6 ⑯ nt/withdraw/history 提现历史 ──
  getWithdrawHistory: function() { return this.request('GET', '/api/nt/withdraw/history'); },
  // ── P1-#6 ⑰ camps/budget 营地预算 ──
  getCampsBudget: function(campId) { return this.request('GET', '/api/camps/budget' + (campId ? '?camp_id=' + encodeURIComponent(campId) : '')); },
  // ── P1-#6 ⑱ camps/schedule 营地日程 ──
  getCampsSchedule: function(campId) { return this.request('GET', '/api/camps/schedule' + (campId ? '?camp_id=' + encodeURIComponent(campId) : '')); },
};
API.init();
