// ══ 团队动态 feed ══
var _activityFilter = '全部';

var ACTIVITY_TYPES = [
  {key:'全部',icon:'📋',label:'全部'},
  {key:'审核',icon:'✅',label:'审核'},
  {key:'财务',icon:'💰',label:'财务'},
  {key:'物资',icon:'📦',label:'物资'},
  {key:'媒体',icon:'📸',label:'媒体'},
  {key:'签到',icon:'👋',label:'签到'}
];

function _renderActivityFeed(c) {
  var log = (window.AppData && AppData._data.activity_log) ? AppData._data.activity_log : [];
  if (!log.length) return '';

  var h = '<div class="activity-feed">';
  h += '<div class="activity-feed-head">👥 团队动态</div>';

  h += '<div class="activity-filters">';
  ACTIVITY_TYPES.forEach(function(at){
    h += '<span class="af-chip'+(at.key===_activityFilter?' on':'')+'" onclick="_activityFilter=\''+at.key+'\';renderCampTab(\''+_campActiveTab+'\')">'+at.icon+' '+at.label+'</span>';
  });
  h += '</div>';

  var items = _formatActivityItems(log);
  if (_activityFilter !== '全部') {
    items = items.filter(function(item){return item.filterKey===_activityFilter;});
  }
  var pageSize = 10;
  var shown = items.slice(0, pageSize);

  shown.forEach(function(item){
    h += '<div class="activity-item">';
    h += '<div class="activity-icon">'+item.icon+'</div>';
    h += '<div class="activity-body">';
    h += '<div>'+item.html+'</div>';
    if (item.thumbs && item.thumbs.length) {
      h += '<div class="activity-thumbs">';
      item.thumbs.forEach(function(src){
        h += '<img class="activity-thumb" src="'+src+'" alt="" onerror="this.style.display=\'none\'">';
      });
      h += '</div>';
    }
    h += '<div class="activity-time">'+item.timeAgo+'</div>';
    h += '</div></div>';
  });

  if (items.length > pageSize) {
    h += '<div style="text-align:center;padding:10px;font-size:.65rem;color:var(--green-primary);cursor:pointer">加载更多 ('+(items.length-pageSize)+'条)</div>';
  }
  if (!shown.length) {
    h += '<div style="text-align:center;padding:20px;color:#aaa;font-size:.65rem">暂无此类动态</div>';
  }
  h += '</div>';
  return h;
}

function _formatActivityItems(log) {
  var items = [];
  log.forEach(function(entry){
    var item = null;
    var type = entry.type||'';
    var text = entry.text||'';
    var time = entry.time||'';

    if (type==='review_approve') {
      var parts = _parseActText(text, ['通过了「','」审核']);
      item = {icon:'✅',filterKey:'审核',html:'<span class="act-name">'+esc(parts[0])+'</span> 通过了「<span class="act-task">'+esc(parts[1])+'</span>」审核'};
    } else if (type==='review_reject') {
      var parts2 = _parseActText(text, ['退回了「','」：']);
      item = {icon:'❌',filterKey:'审核',html:'<span class="act-name">'+esc(parts2[0])+'</span> 退回了「<span class="act-task">'+esc(parts2[1])+'</span>」'};
    } else if (type==='task_submit') {
      var ps = _parseActText(text, ['提交了「','」']);
      item = {icon:'📤',filterKey:'审核',html:'<span class="act-name">'+esc(ps[0])+'</span> 提交了「<span class="act-task">'+esc(ps[1])+'</span>」'};
    } else if (type==='task_post') {
      var pp = _parseActText(text, ['发布了「','」· ']);
      var rest = text.split('· ').pop()||'';
      item = {icon:'📋',filterKey:'审核',html:'<span class="act-name">'+esc(pp[0])+'</span> 发布了「<span class="act-task">'+esc(pp[1])+'</span>」· '+rest};
    } else if (type==='task_reward') {
      var pr = _parseActText(text, ['结算了「','」· ']);
      var rest2 = text.split('· ').pop()||'';
      item = {icon:'💰',filterKey:'财务',html:'<span class="act-name">'+esc(pr[0])+'</span> 结算了「<span class="act-task">'+esc(pr[1])+'</span>」· '+rest2};
    } else if (type==='purchase') {
      var ppu = _parseActText(text, ['采购了 ',' · ']);
      item = {icon:'📦',filterKey:'物资',html:'<span class="act-name">'+esc(ppu[0])+'</span> 采购了 '+esc(ppu[1])+' · '+esc(ppu[2]||'')};
    } else if (type==='reimburse') {
      var prm = _parseActText(text, ['提交了 ',' 报销 · ']);
      item = {icon:'🧾',filterKey:'财务',html:'<span class="act-name">'+esc(prm[0])+'</span> 提交了 '+esc(prm[1])+' 报销 · '+esc(prm[2]||'')};
    } else if (type==='media_upload') {
      var pm = _parseActText(text, ['上传了 ',' 张活动照片']);
      item = {icon:'📸',filterKey:'媒体',html:'<span class="act-name">'+esc(pm[0])+'</span> 上传了 '+esc(pm[1]||'')+' 张活动照片',thumbs:entry.thumbs||[]};
    } else if (type==='checkin') {
      var pc = text.replace(' 签到入营','');
      item = {icon:'👋',filterKey:'签到',html:'<span class="act-name">'+esc(pc)+'</span> 签到入营'};
    } else if (type==='feedback') {
      var pf = _parseActText(text, ['反馈了「','」']);
      item = {icon:'💬',filterKey:'全部',html:'<span class="act-name">'+esc(pf[0])+'</span> 反馈了「'+esc(pf[1]||text)+'」'};
    } else if (type==='tip'||type==='encourage') {
      var parts3 = text.split(' → ');
      item = {icon:'💬',filterKey:'全部',html:'<span class="act-name">'+esc(parts3[0]||'')+'</span> → '+esc(parts3[1]||'')};
    } else if (type==='camp_launch') {
      item = {icon:'🔥',filterKey:'全部',html:text};
    } else if (type==='camp_close') {
      item = {icon:'📦',filterKey:'全部',html:text};
    } else if (type==='canteen') {
      item = {icon:'🥬',filterKey:'全部',html:text};
    } else if (type==='inn') {
      item = {icon:'🏨',filterKey:'全部',html:text};
    } else if (type==='submission_approve'||type==='submission_reject'||type==='task_reveal') {
      item = {icon:'✅',filterKey:'审核',html:text};
    }

    if (item) {
      item.time = time;
      item.timeAgo = _timeAgo(time);
    }
    if (item) items.push(item);
  });
  return items;
}

function _parseActText(text, delimiters) {
  var a = '', b = '', c = '';
  var idx1 = text.indexOf(delimiters[0]);
  if (idx1!==-1) {
    a = text.slice(0, idx1);
    var rest = text.slice(idx1+delimiters[0].length);
    if (delimiters[1]) {
      var idx2 = rest.indexOf(delimiters[1]);
      if (idx2!==-1) { b = rest.slice(0, idx2); c = rest.slice(idx2+delimiters[1].length); }
      else b = rest;
    } else b = rest;
  }
  return [a,b,c];
}

function _timeAgo(isoStr) {
  if (!isoStr) return '';
  var now = new Date();
  var then = new Date(isoStr);
  var diff = now - then;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff/60000)+'分钟前';
  if (diff < 86400000) return Math.floor(diff/3600000)+'小时前';
  if (diff < 172800000) return '昨天';
  if (diff < 604800000) return Math.floor(diff/86400000)+'天前';
  return isoStr.slice(0,10);
}

function renderCampTab(tab) {
  var body = document.getElementById('campHomeBody');
  if (tab==='overview') renderCampOverview(body);
  else if (tab==='schedule') renderCampSchedule(body);
  else switchCampTab(tab);
}

// ══ 营地消息面板 ══
function openCampInbox() {
  var c = getCampData();
  if (!c) { showToast('未找到营队','error'); return; }
  _openCampInboxPanel(c);
}

function _openCampInboxPanel(c) {
  document.querySelectorAll('.camp-inbox-overlay').forEach(function(s){s.remove();});
  var overlay = document.createElement('div');
  overlay.className = 'camp-inbox-overlay';
  overlay.style.display = 'flex';
  overlay.addEventListener('click', function(e){if(e.target===overlay)overlay.remove();});

  var card = document.createElement('div');
  card.className = 'camp-inbox-card';

  var msgs = _getCampMessages(c);
  var newer = msgs.filter(function(m){return m.isNew;});
  var older = msgs.filter(function(m){return !m.isNew;});

  var h = '';
  h += '<div class="camp-inbox-head">';
  h += '<button class="overlay-close" onclick="this.closest(\'.camp-inbox-overlay\').remove()">←</button>';
  h += '<span class="overlay-title" style="padding-right:0">消息</span>';
  h += '</div>';

  h += '<div class="camp-inbox-body">';
  if (!msgs.length) {
    h += '<div style="text-align:center;padding:40px;color:#5a6e5c">📭 暂无营地消息</div>';
  } else {
    if (newer.length) {
      h += '<div style="font-weight:700;font-size:.68rem;color:#b84c38;margin-bottom:6px">⏳ 待处理（'+newer.length+'）</div>';
      newer.forEach(function(m){ h += _campMsgRow(m); });
    }
    if (older.length) {
      h += '<div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin:12px 0 6px;padding-top:8px;border-top:1px solid #e8ede6">📋 已读</div>';
      older.forEach(function(m){ h += _campMsgRow(m); });
    }
    h += '<div style="text-align:center;padding:12px"><span style="font-size:.62rem;color:var(--green-primary);cursor:pointer" onclick="_markAllCampMsgRead();this.closest(\'.camp-inbox-overlay\').remove()">全部标为已读</span></div>';
  }
  h += '</div>';
  card.innerHTML = h;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function _getCampMessages(c) {
  var msgs = [];
  var lastOpened = getInboxLastOpened();
  var pendingReview = _getPendingReview(c);
  pendingReview.forEach(function(item){
    msgs.push({
      icon:'🔍', type:'pending_review', text:item.task.publisher+' 提交了「'+item.task.name+'」',
      sub:'等你审核', jump:'mgmtBlock1', time:new Date().toISOString(),
      isNew:true
    });
  });
  var pendingSubs = _getPendingSubmissions(c);
  pendingSubs.forEach(function(sub){
    msgs.push({
      icon:'📤', type:'pending_submission', text:sub.person+' 提交了「'+sub.taskName+'」',
      sub:'等你审核', jump:'mgmtBlock3', time:new Date().toISOString(),
      isNew:true
    });
  });
  var unpaid = _getUnpaidList(c);
  unpaid.forEach(function(item){
    msgs.push({
      icon:'💰', type:'pending_settle', text:item.person+' · '+item.taskName+' · NT '+item.nt,
      sub:'待结算', jump:'mgmtBlock4', time:new Date().toISOString(),
      isNew:true
    });
  });
  var log = (window.AppData && AppData._data.activity_log) ? AppData._data.activity_log : [];
  log.forEach(function(entry){
    var entryTime = entry.time||'';
    msgs.push({
      icon:'📋', type:'activity', text:entry.text||'',
      time:entryTime,
      isNew: entryTime > lastOpened
    });
  });
  msgs.sort(function(a,b){return b.time.localeCompare(a.time);});
  return msgs;
}

function _campMsgRow(m) {
  var h = '<div class="camp-inbox-msg" onclick="'+
    (m.jump ? 'mgmtScrollToBlock(\''+m.jump.replace('mgmtBlock','')+'\');this.closest(\'.camp-inbox-overlay\').remove()' : '')+'"'+
    (m.jump?'':'style="cursor:default"')+'>';
  h += '<span class="ci-icon">'+m.icon+'</span>';
  h += '<span>'+esc(m.text)+'</span>';
  if (m.sub) h += '<div style="font-size:.58rem;color:#aaa;margin-left:22px">'+m.sub+'</div>';
  h += '<div class="ci-time">'+_timeAgo(m.time)+'</div>';
  h += '</div>';
  return h;
}

function _markAllCampMsgRead() {
  updateInboxLastOpened();
  updateInboxBadge();
}

// ══ 成员个人案卷 ══
function openDossier(name) {
  if (!name) return;
  var c = getCampData(); if (!c) return;
  var users = typeof getUsers==='function'?getUsers():{};
  var u = users[name] || {};
  var b = (c.builders||[]).find(function(x){return x.name===name;});
  var taskNames = b ? b.taskNames : [];
  var totalNT = b ? b.totalNT : 0;
  var campTasks = c.tasks || [];

  var completedTasks = 0, cumulativeNT = 0;
  campTasks.forEach(function(t){
    var cl = (t.claimants||[]).find(function(x){return x.name===name;});
    if (cl) {
      if (cl.status==='settled'||cl.status==='approved') { completedTasks++; cumulativeNT += (t.nt||0); }
    }
  });
  var completionRate = taskNames.length ? Math.round(completedTasks/taskNames.length*100) : 0;

  var finance = (window.AppData && AppData._data.finance) ? AppData._data.finance : [];
  var finRecords = [];
  if (window.NT) {
    var entries = NT.getLedger({userId:name});
    entries.forEach(function(e){
      var isIn = e.to===name;
      var isOut = e.from===name;
      if (isIn) finRecords.push({date:(e.timestamp||'').slice(0,10),note:e.reason||e.type,amount:e.amount||0,in:true});
      else if (isOut) finRecords.push({date:(e.timestamp||'').slice(0,10),note:e.reason||e.type,amount:e.amount||0,in:false});
    });
  }
  finance.forEach(function(f){
    if (f.type==='tip' && f.to===name) {
      finRecords.push({date:(f.time||'').slice(0,10),note:'来自 '+esc(f.from||'')+' 打赏',amount:f.amount||0,in:true});
    }
  });

  var tips = [];
  if (window.AppData && AppData._data.journal) {
    AppData._data.journal.forEach(function(j){
      if ((j.type==='tip'||j.type==='encourage') && j.content.indexOf(name)!==-1) {
        tips.push({from:j.user||'', type:j.type, content:j.content, date:j.date, time:j.time, isPaid:j.type==='tip'});
      }
    });
  }

  var h = '';
  h += '<div style="text-align:center;padding:14px">';
  h += '<img src="https://api.dicebear.com/7.x/avataaars/svg?seed='+(u.avatar_seed||0)+'&size=56" width="48" height="48" style="border-radius:50%;object-fit:cover" alt="">';
  h += '<div style="font-weight:700;font-size:.82rem;margin-top:6px">'+esc(name)+'</div>';
  h += '<div style="font-size:.65rem;color:#5a6e5c">'+roleIcon(u.role||'visitor')+' '+roleName(u.role||'visitor')+' · '+totalNT+' NT</div>';
  h += '</div>';

  h += '<div class="dossier-section"><h3>📊 本期统计</h3>';
  h += '<div class="dossier-stat"><span>分配任务</span><span>'+taskNames.length+' 项</span></div>';
  h += '<div class="dossier-stat"><span>已完成</span><span>'+completedTasks+' 项</span></div>';
  h += '<div class="dossier-stat"><span>累计 NT</span><span style="font-weight:700;color:var(--green-primary)">'+cumulativeNT+'</span></div>';
  h += '<div class="dossier-stat"><span>完成率</span><span>'+completionRate+'%</span></div>';
  h += '<div style="height:4px;background:#f0f0f0;border-radius:2px;overflow:hidden;margin-top:6px"><div style="height:100%;width:'+completionRate+'%;background:#3d6b52;border-radius:2px"></div></div>';
  h += '</div>';

  h += '<div class="dossier-section"><h3>📋 任务记录</h3>';
  if (taskNames.length) {
    taskNames.forEach(function(tn){
      var t = campTasks.find(function(ct){return ct.name===tn;});
      var cl = t ? ((t.claimants||[]).find(function(x){return x.name===name;})||{}) : {};
      var statusIcon = cl.status==='settled'?'✅':cl.status==='approved'?'⏳':cl.status==='submitted'?'📤':(t&&t.status==='进行中'?'◷':'⏳');
      h += '<div class="dossier-record"><span>'+statusIcon+' '+esc(tn)+' · '+(t?t.nt:0)+' NT</span><span style="color:#aaa;font-size:.6rem">'+(cl.settledAt||cl.submittedAt||'进行中')+'</span></div>';
    });
  } else { h += '<div style="font-size:.62rem;color:#aaa">暂无任务分配</div>'; }
  h += '</div>';

  h += '<div class="dossier-section"><h3>💰 财务记录</h3>';
  if (finRecords.length) {
    finRecords.slice(0,10).forEach(function(r){
      h += '<div class="dossier-record"><span>'+r.date+' '+(r.in?'+':'-')+r.amount+' NT · '+esc(r.note)+'</span></div>';
    });
  } else { h += '<div style="font-size:.62rem;color:#aaa">暂无财务记录</div>'; }
  h += '</div>';

  h += '<div class="dossier-section"><h3>💬 打赏记录</h3>';
  if (tips.length) {
    tips.slice(0,10).forEach(function(tip){
      var paidIcon = tip.isPaid ? '🌹 '+tip.content.split(' ').pop() : '👏太棒了';
      h += '<div class="dossier-record"><span>'+tip.date+' '+esc(tip.from)+' → '+esc(name)+' '+paidIcon+'</span></div>';
    });
  } else { h += '<div style="font-size:.62rem;color:#aaa">暂无打赏记录</div>'; }
  h += '</div>';

  _openDossierOverlay(name, h);
}

function _openDossierOverlay(name, html) {
  document.querySelectorAll('.dossier-overlay').forEach(function(s){s.remove();});
  var overlay = document.createElement('div');
  overlay.className = 'dossier-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--green-bg);overflow-y:auto;display:flex;flex-direction:column';
  overlay.innerHTML =
    '<div class="overlay-top">'+
    '<button class="overlay-close" onclick="this.closest(\'.dossier-overlay\').remove()">←</button>'+
    '<span class="overlay-title" style="padding-right:0">'+esc(name)+' · 个人案卷</span></div>'+
    '<div class="overlay-body" style="flex:1;overflow-y:auto;padding:14px">'+html+'</div>';
  document.body.appendChild(overlay);
}

// ══ ＋ 快捷菜单 Sheet ══
function _openQuickMenu() {
  document.querySelectorAll('.quick-menu-overlay').forEach(function(s){s.remove();});
  var c = getCampData();
  var myTasks = c ? ((c.builders||[]).find(function(b){return b.name===CURRENT_USER;})||{}).taskNames||[] : [];
  var campTasks = c ? (c.tasks||[]) : [];

  var categories = [];
  myTasks.forEach(function(tn){
    var t = campTasks.find(function(ct){return ct.name===tn;});
    if (t && t.category && categories.indexOf(t.category)===-1) categories.push(t.category);
  });

  var ALL_MENUS = {
    '管理': [
      {icon:'📋',label:'发布营队任务',action:function(){switchCampTab('manage');document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'🔍',label:'查看待审核',action:function(){mgmtScrollToBlock(1);document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'🧾',label:'待结算列表',action:function(){mgmtScrollToBlock(4);document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'✅',label:'成员签到',action:function(){_wipToast('签到');document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'📊',label:'NT池统计',action:function(){mgmtScrollToBlock(5);document.querySelector('.quick-menu-overlay').remove()}}
    ],
    '财务': [
      {icon:'🧾',label:'待结算列表',action:function(){mgmtScrollToBlock(4);document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'📊',label:'NT池统计',action:function(){mgmtScrollToBlock(5);document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'💰',label:'资金流水',action:function(){switchCampTab('funds');document.querySelector('.quick-menu-overlay').remove()}}
    ],
    '生活': [
      {icon:'📦',label:'添加采购项',action:function(){_wipToast('采购');document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'🧾',label:'提交报销',action:function(){_wipToast('报销');document.querySelector('.quick-menu-overlay').remove()}}
    ],
    '课程': [
      {icon:'📚',label:'今日课程',action:function(){_wipToast('课程');document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'🎨',label:'材料准备',action:function(){_wipToast('材料');document.querySelector('.quick-menu-overlay').remove()}}
    ],
    '宣传': [
      {icon:'📸',label:'上传照片',action:function(){_wipToast('上传');document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'📝',label:'征集文稿',action:function(){_wipToast('征集');document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'📰',label:'写简报',action:function(){_wipToast('简报');document.querySelector('.quick-menu-overlay').remove()}}
    ],
    '结项': [
      {icon:'📊',label:'结项进度',action:function(){_wipToast('结项');document.querySelector('.quick-menu-overlay').remove()}},
      {icon:'📸',label:'展览准备',action:function(){_wipToast('展览');document.querySelector('.quick-menu-overlay').remove()}}
    ]
  };

  // 管理员显示全部菜单类别
  var users = typeof getUsers==='function'?getUsers():{};
  if ((users[CURRENT_USER]||{}).role === 'admin') { categories = Object.keys(ALL_MENUS); }

  var menuItems = [];
  var seen = {};
  menuItems.push({icon:'🃏',label:'卡片室',action:function(){closeOverlay('overlayCampHome');openCardRoom();document.querySelector('.quick-menu-overlay').remove()}});
  categories.forEach(function(cat){
    var items = ALL_MENUS[cat] || [];
    items.forEach(function(item){
      if (!seen[item.label]) { seen[item.label] = true; menuItems.push(item); }
    });
  });
  if (!menuItems.length) {
    menuItems.push({icon:'📋',label:'发布任务',action:function(){switchCampTab('manage');document.querySelector('.quick-menu-overlay').remove()}});
  }
  menuItems.push({icon:'📝',label:'上报劳动',action:function(){closeOverlay('overlayCampHome');openSelfReport();document.querySelector('.quick-menu-overlay').remove()}});
  menuItems.push({icon:'💬',label:'问题反馈',action:function(){_wipToast('反馈');document.querySelector('.quick-menu-overlay').remove()}});

  var overlay = document.createElement('div');
  overlay.className = 'quick-menu-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .15s ease-out';
  overlay.addEventListener('click', function(e){if(e.target===overlay)overlay.remove();});

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-height:70vh;box-shadow:0 -4px 20px rgba(0,0,0,.08);overflow-y:auto';
  var sh = '';
  menuItems.forEach(function(item){
    sh += '<div class="quick-sheet-item" onclick="('+item.action.toString()+')()"><span class="qs-icon">'+item.icon+'</span><span>'+item.label+'</span></div>';
  });
  sh += '<div class="quick-sheet-cancel" onclick="this.closest(\'.quick-menu-overlay\').remove()">取消</div>';
  sheet.innerHTML = sh;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

