// ══ API 适配层 — 行业标准：access token 存内存，refresh token httpOnly cookie ══
var API = {
  base: '',
  token: null,  // access token，仅存 JS 内存，不落 localStorage
  user: null,   // 当前用户信息

  init: function(baseUrl) {
    if (window.location.protocol !== 'file:') { this.base = ''; }
    else if (baseUrl) { this.base = baseUrl; }
  },

  // ── 底层请求 ──
  request: async function(method, path, body) {
    var url = this.base ? (this.base + path) : path;
    var headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    var opts = { method: method, headers: headers, credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);
    try {
      var resp = await fetch(url, opts);
      if (resp.status === 401) { this.token = null; return { ok: false, error: '登录过期', _offline: false }; }
      return await resp.json();
    } catch(e) {
      if (e.name === 'TypeError') return {ok:false, error:'网络不通', _offline:true};
      if (e.name === 'AbortError') return {ok:false, error:'请求超时', _offline:true};
      return {ok:false, error:'网络异常', _offline:true};
    }
  },

  // ── 认证 ──
  asyncAuth: function(type, name, password, role, seed, callback) {
    var path = type === 'register' ? '/api/auth/register' : '/api/auth/login';
    var body = type === 'register' ? {name:name, password:password, role:role||'visitor', avatar_seed:seed} : {name:name, password:password};
    var self = this;
    fetch((this.base||'') + path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.ok && d.token) {
          self.token = d.token; self.user = d.user;
          if (d.refresh_token) {
            try { localStorage.setItem('nt_refresh', d.refresh_token); } catch(e) {}
            document.cookie = 'nt_rt=' + d.refresh_token + '; path=/; max-age=604800';
          }
          if (callback) callback(d.user);
        } else { if (callback) callback(d); }
      })
      .catch(function() { if (callback) callback(null); });
  },

  silentRefresh: function(callback) {
    var self = this;
    var rt = null;
    try { rt = localStorage.getItem('nt_refresh'); } catch(e) {}
    if (!rt) { var m = document.cookie.match(/(?:^|;\s*)nt_rt=([^;]*)/); rt = m ? m[1] : null; }
    if (!rt) { if (callback) callback(null, 'no_token'); return; }
    fetch((this.base||'') + '/api/auth/refresh', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({refresh_token: rt}) })
      .then(function(r) { return r.json().then(function(d) { return {ok:r.ok,status:r.status,data:d}; }); })
      .then(function(r) {
        var d = r.data;
        if (d && d.ok && d.token) {
          self.token = d.token; self.user = d.user;
          if (d.refresh_token) { try { localStorage.setItem('nt_refresh', d.refresh_token); } catch(e) {} }
          if (callback) callback(d.user);
        } else if (r.status === 401) {
          try { localStorage.removeItem('nt_refresh'); } catch(e) {};
          if (callback) callback(null, 'expired');
        } else {
          try { localStorage.removeItem('nt_refresh'); } catch(e) {};
          if (callback) callback(null, 'server_error');
        }
      })
      .catch(function(e) { if (callback) callback(null, 'network'); });
  },

  logout: function(callback) {
    this.token = null; this.user = null;
    try { localStorage.removeItem('nt_refresh'); } catch(e) {}
    fetch((this.base||'') + '/api/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(function() { if (callback) callback(); });
  },

  // ── NT 操作 ──
  getBalance: function(callback) {
    this.request('GET', '/api/nt/balance').then(function(r) { if (callback) callback(r && !r.detail && !r._offline ? r : null); });
  },

  getLedger: function(opts) {
    var qs = '?limit=' + (opts && opts.limit || 50);
    if (opts && opts.type) qs += '&type=' + opts.type;
    return this.request('GET', '/api/nt/ledger' + qs);
  },

  transfer: function(to, amount, reason) { return this.request('POST', '/api/nt/transfer', {to:to, amount:amount, reason:reason||''}); },
  earn: function(amount, reason, scope) { return this.request('POST', '/api/nt/earn', {amount:amount, reason:reason||'', scope:scope||'personal'}); },
  spend: function(amount, reason, scope) { return this.request('POST', '/api/nt/spend', {amount:amount, reason:reason||'', scope:scope||'personal'}); },
  topUp: function(user, amount, reason) { return this.request('POST', '/api/nt/topup', {user:user, amount:amount, reason:reason||''}); },
  verify: function() { return this.request('GET', '/api/nt/verify'); },
  getPools: function() { return this.request('GET', '/api/nt/pools'); },

  // ── 任务同步 ──
  syncTask: function(task, callback) {
    var data = { title: task.name || task.title, reward: task.nt || task.reward || 5,
      category: task.type || task.category || 'other', scope: task.scope || '社区',
      note: task.note || '', slots: task.slots || 1, deadline: task.deadline || '',
      reviewer: task.reviewer || '', location_id: task.locationId || '' };
    this.request('POST', '/api/tasks', data).then(function(r) {
      if (callback) callback(r && r.task_id ? r.task_id : null);
    });
  },

  syncTaskUpdate: function(taskId, updates) { return this.request('PUT', '/api/tasks/' + taskId, updates); },

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
