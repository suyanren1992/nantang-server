// ══ API 适配层 — 行业标准：access token 存内存，refresh token httpOnly cookie ══
var API = {
  base: '',
  token: null,
  _consecutiveFailures: 0,
  _serverOnline: true,  // access token，仅存 JS 内存，不落 localStorage
  _refreshInProgress: null,  // Promise|null — 防并发重入
  user: null,   // 当前用户信息
  init: function(baseUrl) {
    // 外网模式：指向服务器公网地址
    this.base = 'https://tobacco-month-hans-ventures.trycloudflare.com';
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
          if (retryResp.status !== 401) { self._consecutiveFailures = 0; return await retryResp.json(); }
        }
        self.token = null;
        return { ok: false, error: '登录过期', _offline: false };
      }
      return await resp.json();
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
  getPools: function() { return this.request('GET', '/api/nt/pools'); },
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
    this.request('GET', '/api/tasks').then(function(tasks) {
      if (callback) callback(Array.isArray(tasks) ? tasks : null);
    });
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
    this.request('POST', '/api/data/card_discoveries', {
      id: disc.id, space_id: disc.spaceId, description: disc.description,
      guesser: disc.guesser, guessed_person: disc.guessedPerson,
      guessed_at: disc.guessedAt, status: disc.status || 'pending',
      nt_guesser: disc.ntGuesser || 5, nt_doer: disc.ntDoer || 10
    });
  },
};
API.init();
