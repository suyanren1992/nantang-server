// ── 送鼓励 ──
function sendEncouragement(target, type) {
  if (!target || target === '点击选择成员') { showToast('请先选择送给谁', 'warn'); return; }
  if (target === CURRENT_USER) { showToast('不能送给自己', 'warn'); return; }
  var isPaid = type === '🌹1' || type === '🎁5';
  var amount = type === '🌹1' ? 1 : type === '🎁5' ? 5 : 0;
  if (isPaid) {
    if (!CURRENT_USER) { showToast('请先登录', 'error'); return; }
    if (window.NT) {
      var u = NT.getUser(CURRENT_USER);
      if (!u || u.ntBalance < amount) { showToast('NT余额不足', 'error'); return; }
      NT.spend(CURRENT_USER, amount, '送给 ' + target + ' ' + type, 'personal');
      if (typeof recordTransaction === 'function') {
        recordTransaction({ type: TX_TYPES.TIP, from: CURRENT_USER, to: target, amount: amount, scope: 'personal', note: '送了 ' + type });
      }
    }
  }
  // 写 journal
  if (window.AppData) {
    if (!AppData._data.journal) AppData._data.journal = [];
    var labelMap = { '👏':'太棒了', '💪':'加油', '🌹1':'🌹 1 NT', '🎁5':'🎁 5 NT' };
    AppData._data.journal.unshift({
      type: isPaid ? 'tip' : 'encourage',
      user: CURRENT_USER,
      content: '送了 ' + target + ' ' + (labelMap[type] || type),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5)
    });
    if (typeof AppData.save === 'function') AppData.save();
  }
  // 写 activity_log
  if (typeof logActivity === 'function') {
    logActivity(isPaid ? 'tip' : 'encourage', CURRENT_USER + ' → ' + target + ' ' + (labelMap[type] || type));
  }
  showToast('已送出！', 'ok');
  // 刷新营地窗口
  var campId = document.getElementById('campWindowTitle').getAttribute('data-camp-id');
  if (campId) showCampWindow(campId);
}
// ═══ 信箱系统（阶段 1 前置A）═══
function logActivity(type, text) {
  if (!window.AppData) return;
  var log = AppData._data.activity_log || (AppData._data.activity_log = []);
  log.unshift({ time: new Date().toISOString(), type: type, text: text });
  updateInboxBadge();
  if (typeof API !== 'undefined' && API.token) API.syncActivity(type, text);
}

function getInboxLastOpened() {
  try { return localStorage.getItem('inbox_lastOpened') || ''; } catch(e) { return ''; }
}
function updateInboxLastOpened() {
  try { localStorage.setItem('inbox_lastOpened', new Date().toISOString()); } catch(e) {}
}

function computeInboxMessages() {
  var msgs = [];
  var tasks = TASKS || {};
  var lastOpened = getInboxLastOpened();
  var users = typeof getUsers === 'function' ? getUsers() : {};

  // 1. 任务提交审核（submitted）— 按人聚合
  var submitByPerson = {};
  Object.values(tasks).forEach(function(t) {
    (t.claimants || []).forEach(function(c) {
      if (c.status === 'submitted') {
        if (!submitByPerson[c.name]) submitByPerson[c.name] = [];
        submitByPerson[c.name].push(t.name);
      }
    });
  });
  Object.keys(submitByPerson).forEach(function(name) {
    msgs.push({
      type: 'submitted', person: name, taskNames: submitByPerson[name],
      icon: '🆕', time: new Date().toISOString().slice(0, 10)
    });
  });

  // 2. 审核通过/退回（本人）
  Object.values(tasks).forEach(function(t) {
    (t.claimants || []).forEach(function(c) {
      if (c.name !== CURRENT_USER) return;
      if (c.status === 'approved') {
        msgs.push({ type: 'approved', person: CURRENT_USER, taskName: t.name, amount: t.nt || 0, icon: '✅', time: new Date().toISOString().slice(0, 10) });
      } else if (c.status === 'rejected') {
        msgs.push({ type: 'rejected', person: CURRENT_USER, taskName: t.name, icon: '❌', time: new Date().toISOString().slice(0, 10) });
      }
    });
  });

  // 3. 收到打赏/鼓励（tip_received）
  var finance = (window.AppData && AppData._data.finance) ? AppData._data.finance : [];
  finance.forEach(function(f) {
    if ((f.type === 'tip' || f.type === 'encourage') && f.to === CURRENT_USER) {
      msgs.push({
        type: 'tip_received', from: f.from, to: f.to,
        amount: f.amount || 0, isPaid: f.type === 'tip',
        icon: '💬', time: f.time || new Date().toISOString().slice(0, 10)
      });
    }
  });

  // 4. 任务奖励到账（task_reward）
  finance.forEach(function(f) {
    if (f.type === 'task_reward' && f.to === CURRENT_USER) {
      msgs.push({
        type: 'task_reward', from: f.from, to: f.to,
        amount: f.amount || 0, taskName: f.note || '',
        icon: '🎁', time: f.time || new Date().toISOString().slice(0, 10)
      });
    }
  });

  // 按时间倒序
  msgs.sort(function(a, b) { return b.time.localeCompare(a.time); });

  // 分新/旧
  var newer = [], older = [];
  msgs.forEach(function(m) {
    if (m.time > lastOpened) newer.push(m); else older.push(m);
  });
  return { newer: newer, older: older, total: msgs.length };
}

function renderInbox() {
  var panel = document.getElementById('myInboxPanel');
  if (!panel) return;
  var data = computeInboxMessages();
  var h = '';

  if (!data.total) {
    h = '<div style="text-align:center;padding:40px 0;color:#5a6e5c">📭 暂无消息<br><span style="font-size:.65rem;color:#aaa">有新的消息会出现在这里</span></div>';
  } else {
    if (data.newer.length) {
      h += '<div style="font-weight:700;font-size:.7rem;color:#b84c38;margin-bottom:8px">🔴 新消息</div>';
      data.newer.forEach(function(m) { h += inboxMsgRow(m); });
    }
    if (data.older.length) {
      h += '<div style="font-weight:700;font-size:.7rem;color:#5a6e5c;margin:12px 0 8px;padding-top:8px;border-top:1px solid #e8ede6">── 已读 ──</div>';
      data.older.forEach(function(m) { h += inboxMsgRow(m); });
    }
    h += '<div style="text-align:center;padding:12px 0"><span style="font-size:.65rem;color:var(--green-primary);cursor:pointer" onclick="updateInboxLastOpened();renderInbox();updateInboxBadge()">全部标为已读</span></div>';
  }
  panel.innerHTML = h;
  panel.style.display = 'block';
}

function inboxMsgRow(m) {
  var h = '<div style="padding:8px 0;border-bottom:1px dotted #f0f0f0;font-size:.68rem">';
  h += '<span style="font-size:.9rem;margin-right:6px">' + m.icon + '</span>';
  if (m.type === 'submitted') {
    h += '<b>' + esc(m.person) + '</b> 提交了 ' + m.taskNames.length + ' 项任务';
    h += '<div style="font-size:.6rem;color:#8a8a8a;margin:2px 0 0 22px">' + m.taskNames.slice(0, 3).map(esc).join(' · ') + (m.taskNames.length > 3 ? ' …还有' + (m.taskNames.length - 3) + '项' : '') + '</div>';
  } else if (m.type === 'approved') {
    h += '「' + esc(m.taskName) + '」已通过 · <b>' + m.amount + ' NT</b>';
  } else if (m.type === 'rejected') {
    h += '「' + esc(m.taskName) + '」被退回';
  } else if (m.type === 'tip_received') {
    h += '<b>' + esc(m.from) + '</b> 送了 ' + (m.isPaid ? '🌹 · ' + m.amount + ' NT' : '👏太棒了');
  } else if (m.type === 'task_reward') {
    h += '<b>' + esc(m.from) + '</b> 结算了「' + esc(m.taskName || '任务') + '」· <b>' + m.amount + ' NT</b>';
  }
  h += '<div style="font-size:.55rem;color:#aaa;text-align:right;margin-top:2px">' + (m.time||'').slice(0, 10) + '</div>';
  h += '</div>';
  return h;
}

function openInboxPanel() {
  var tabs = document.querySelectorAll('#myPage .my-tab-panel');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('on');
  renderInbox();
  updateInboxLastOpened();
  updateInboxBadge();
}

function updateInboxBadge() {
  var badge = document.getElementById('inboxBadge');
  if (!badge) return;
  var data = computeInboxMessages();
  if (data.newer.length) {
    badge.textContent = data.newer.length;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// 在现有 logActivity 调用点之后，补写日志
(function initActivityLog() {
  // 补历史数据：把 journal 里现有的 tip/role_change 写入 activity_log
  if (window.AppData && AppData._data.journal) {
    var log = AppData._data.activity_log;
    if (!log || !log.length) {
      AppData._data.activity_log = [];
      var journal = AppData._data.journal;
      for (var i = journal.length - 1; i >= 0; i--) {
        var j = journal[i];
        if (j.type === 'tip' || j.type === 'encourage' || j.type === 'role_change' || j.type === 'camp_launch') {
          AppData._data.activity_log.push({ time: (j.date||'') + 'T' + (j.time||'00:00:00'), type: j.type, text: j.user + ' · ' + j.content });
        }
      }
    }
  }
})();

// 阶段 1 前置B：在已有大地书房中添加档案室房间（若建筑列表有数据则操作，否则 app.js 用硬编码列表——另行适配）
(function initArchiveBuilding() {
  if (!window.AppData || !AppData._data.map_locations) return;
  var ml = AppData._data.map_locations;
  ml.buildings = ml.buildings || [];
  // 匹配已知的大地书房 id（app.js 硬编码用 'study'，自定义数据可能用 'dadi_study'）
  var dadi = ml.buildings.find(function(b) { return b.id === 'study' || b.id === 'dadi_study' || b.name === '大地书房'; });
  if (dadi) {
    // 已有大地书房 → 往 1F 追加档案室房间（不重复添加）
    dadi.floors = dadi.floors || {};
    dadi.floors['1F'] = dadi.floors['1F'] || [];
    var hasArchive = dadi.floors['1F'].some(function(r) { return r.id === 'archive'; });
    if (!hasArchive) {
      dadi.floors['1F'].push({ id: 'archive', name: '档案室', icon: '📚', sub: '社区记录 · 成员目录 · 运行日志', action: 'openArchive' });
      if (typeof AppData._saveShared === 'function') AppData._saveShared();
    }
  } else if (!ml.buildings.length) {
    // 建筑列表为空（app.js 走硬编码列表，不在此处重复创建）
  } else {
    // 建筑列表非空但没有大地书房 → 新建
    ml.buildings.push({
      id: 'dadi_study', name: '大地书房', icon: '📖',
      floors: { '1F': [{ id: 'archive', name: '档案室', icon: '📚', sub: '社区记录 · 成员目录 · 运行日志', action: 'openArchive' }] }
    });
    if (typeof AppData._saveShared === 'function') AppData._saveShared();
  }
})();

// ═══ 档案室（阶段 1 前置B）═══
var _archiveActiveTab = 'members';
var _archiveLogPage = 0;
var _archiveLogPageSize = 50;
var LOG_ICONS = {
  task_post:'📋', task_claim:'✋', review_approve:'✅', review_reject:'❌',
  tip:'💬', encourage:'💬', role_change:'🔄', camp_launch:'🏕️', camp_confirm:'📋'
};

function openArchive(tab) {
  _archiveLogPage = 0;
  document.getElementById('overlayArchive').classList.add('open');
  switchArchiveTab(tab || 'members');
}

function switchArchiveTab(tab) {
  _archiveActiveTab = tab;
  var tabs = document.querySelectorAll('#archiveTabBar .archive-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('on');
  var target = document.querySelector('#archiveTabBar .archive-tab[onclick*="'+tab+'"]');
  if (target) target.classList.add('on');
  var body = document.getElementById('archiveBody');
  body.scrollTop = 0;
  if (tab === 'members') renderArchiveMembers(body);
  else if (tab === 'log') renderArchiveLog(body);
  else if (tab === 'periods') renderArchivePeriods(body);
}

function renderArchiveMembers(el) {
  var users = typeof getUsers === 'function' ? getUsers() : {};
  if (!Object.keys(users).length) { el.innerHTML = '<div class="archive-empty">📂 暂无注册成员</div>'; return; }

  var groups = [
    { label:'🧙 管理员', role:'admin', members:[] },
    { label:'🧱 共建者', role:'builder', members:[] },
    { label:'⚔️ 冒险者', role:'adventurer', members:[] },
    { label:'👥 在地伙伴', role:'npc', members:[] },
    { label:'🏕️ 云村民', role:'visitor', members:[] }
  ];

  Object.keys(users).forEach(function(name) {
    var u = users[name];
    var group = groups.find(function(g) { return g.role === u.role; }) || groups[4];
    var nt = 0;
    try { var ntu = window.NT && NT.getUser(name); if (ntu) nt = ntu.ntBalance || 0; } catch(e) {}
    group.members.push({
      name: name,
      role: u.role,
      seed: u.avatar_seed || 0,
      nt: nt,
      online: u._online
    });
  });

  var h = '<div class="archive-search"><input type="text" placeholder="🔍 搜索姓名…" oninput="filterArchiveMembers()" id="archiveMemberSearch"></div>';

  groups.forEach(function(g, gi) {
    if (!g.members.length) return;
    var expanded = g.members.length > 0 && (gi === 0 || (gi === 1 && !groups[0].members.length));
    h += '<div class="archive-group" data-role="'+g.role+'">'+
      '<div class="archive-group-head" onclick="toggleArchiveGroup(this)">'+
        '<span>' + (expanded ? '▾' : '▸') + ' ' + g.label + ' · ' + g.members.length + '人</span>'+
      '</div>'+
      '<div class="archive-group-body" style="display:' + (expanded ? 'block' : 'none') + '">';

    g.members.forEach(function(m) {
      var avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + m.seed + '&size=56';
      var onlineDot = m.online ? '🟢' : '🔴';
      h += '<div class="archive-member-row" onclick="showToast(\'' + m.name + ' · ' + roleName(m.role) + ' · ' + (m.nt || 0) + ' NT\',\'\')">'+
        '<img src="' + avatarUrl + '" width="32" height="32" class="archive-member-avatar" alt="" onerror="this.outerHTML=\'<div style=width:32px;height:32px;border-radius:50%;background:#e8ede6;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#5a6e5c;flex-shrink:0>\'+(\'' + m.name + '\').charAt(0)+\'</div>\'">'+
        '<div class="archive-member-info"><div class="archive-member-name">' + m.name + '</div><div class="archive-member-sub">' + roleName(m.role) + '</div></div>'+
        '<span class="archive-member-nt">' + (m.nt ? m.nt + ' NT' : '') + '</span>'+
        '<span class="archive-member-dot">' + onlineDot + '</span>'+
      '</div>';
    });

    h += '</div></div>';
  });

  if (!h) h = '<div class="archive-empty">📂 暂无注册成员</div>';
  el.innerHTML = h;
}

function toggleArchiveGroup(el) {
  var body = el.nextElementSibling;
  var isVisible = body.style.display !== 'none';
  body.style.display = isVisible ? 'none' : 'block';
  el.innerHTML = '<span>' + (isVisible ? '▸' : '▾') + el.textContent.slice(2) + '</span>';
}

function filterArchiveMembers() {
  var kw = (document.getElementById('archiveMemberSearch').value || '').trim().toLowerCase();
  var groups = document.querySelectorAll('#archiveBody .archive-group');
  groups.forEach(function(g) {
    if (!kw) { g.style.display = ''; return; }
    var rows = g.querySelectorAll('.archive-member-row');
    var hasMatch = false;
    rows.forEach(function(r) {
      var name = (r.querySelector('.archive-member-name') || {}).textContent || '';
      var match = name.toLowerCase().indexOf(kw) !== -1;
      r.style.display = match ? '' : 'none';
      if (match) hasMatch = true;
    });
    g.style.display = hasMatch ? '' : 'none';
  });
}

function renderArchiveLog(el) {
  _archiveLogPage = 0;
  var log = (window.AppData && AppData._data.activity_log) ? AppData._data.activity_log : [];
  if (!log.length) { el.innerHTML = '<div class="archive-empty">📜 暂无运行日志<br><span style="font-size:.6rem;color:#aaa">社区活动将自动记录在这里</span></div>'; return; }

  var total = log.length;
  var pageSize = _archiveLogPageSize;
  var start = 0;
  var end = Math.min(pageSize, total);

  function renderPage() {
    var slice = log.slice(start, end);
    var h = '<div class="archive-log-divider">── 最近 ' + end + ' 条 ──</div>';

    slice.forEach(function(item) {
      var d = new Date(item.time);
      var dateStr = (d.getMonth()+1) + '/' + d.getDate();
      var timeStr = ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
      var icon = LOG_ICONS[item.type] || '📝';
      h += '<div class="archive-log-row">'+
        '<span class="archive-log-icon">' + icon + '</span>'+
        '<span class="archive-log-text">' + item.text + '</span>'+
        '<span class="archive-log-time">' + dateStr + ' ' + timeStr + '</span>'+
      '</div>';
    });

    if (end < total) {
      h += '<div class="archive-load-more" onclick="loadMoreArchiveLog()">显示 ' + end + '/' + total + ' 条 · 加载更多</div>';
    }
    return h;
  }

  el.innerHTML = renderPage();

  _archiveLogRenderState = { log: log, total: total, pageSize: pageSize, end: end, el: el };
}

var _archiveLogRenderState = null;

function loadMoreArchiveLog() {
  var s = _archiveLogRenderState; if (!s) return;
  s.end = Math.min(s.end + s.pageSize, s.total);
  var slice = s.log.slice(0, s.end);
  var h = '<div class="archive-log-divider">── 最近 ' + s.end + ' 条 ──</div>';
  slice.forEach(function(item) {
    var d = new Date(item.time);
    var dateStr = (d.getMonth()+1) + '/' + d.getDate();
    var timeStr = ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
    var icon = LOG_ICONS[item.type] || '📝';
    h += '<div class="archive-log-row">'+
      '<span class="archive-log-icon">' + icon + '</span>'+
      '<span class="archive-log-text">' + item.text + '</span>'+
      '<span class="archive-log-time">' + dateStr + ' ' + timeStr + '</span>'+
    '</div>';
  });
  if (s.end < s.total) {
    h += '<div class="archive-load-more" onclick="loadMoreArchiveLog()">显示 ' + s.end + '/' + s.total + ' 条 · 加载更多</div>';
  }
  s.el.innerHTML = h;
}

function toggleArchiveExpand(){
  var ex=document.getElementById('archiveExpand');if(!ex)return;
  if(ex.style.display==='block'){ex.style.display='none';return}
  ex.style.display='block';
  var users=typeof getUsers==='function'?getUsers():{};
  var total=Object.keys(users).length;
  var taskCount=Object.keys(TASKS).length;
  var itemCount=MOCK_ITEMS.length;
  var logCount=(window.AppData&&AppData._data.activity_log)?AppData._data.activity_log.length:0;
  var countEl=document.getElementById('archiveCountText');if(countEl)countEl.textContent='登记'+total+'人 · 任务'+taskCount+' · 日志'+logCount;
  ex.innerHTML='<div style="font-size:.72rem;color:#5a6e5c;line-height:1.8;margin-bottom:10px">'+
    '<div>👤 <b>注册成员</b> — '+total+' 位</div>'+
    '<div>📋 <b>社区任务</b> — '+taskCount+' 个</div>'+
    '<div>📜 <b>运行日志</b> — '+logCount+' 条</div>'+
    '<div>📦 <b>物品</b> — '+itemCount+' 件登记</div>'+
    '</div>'+
    '<div style="text-align:center;padding:8px;background:var(--green-primary);color:#fff;border-radius:8px;font-size:.7rem;font-weight:600;cursor:pointer" onclick="closeMyPage();openArchive(\'log\')">📚 打开档案室 →</div>';
}
