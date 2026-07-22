// ── 阶段3: 营地骨架 ──
var _campCurrentId = null;
var _campActiveTab = 'overview';

function getCampData() {
  var camps = getCamps();
  return camps.find(function(x){ return x.id===_campCurrentId; });
}

function openCampHome(campId) {
  _campCurrentId = campId;
  var c = getCampData(); if (!c) return;
  var users = typeof getUsers==='function'?getUsers():{};
  var role = (users[CURRENT_USER]||{}).role||'visitor';
  var isBuilder = role==='builder'||role==='admin';
  var isAdventurer = role==='adventurer';

  document.getElementById('campHomeTitle').textContent = c.name;

  // Tab visibility
  document.getElementById('campTabManage').style.display = isBuilder ? '' : 'none';

  // Bottom bar role switch
  var inboxBtn = document.getElementById('cbBtnInbox');
  var plusBtn = document.getElementById('cbBtnPlus');
  if (isAdventurer) {
    inboxBtn.innerHTML = '<span style="font-size:1.2rem">🥬</span><span class="cb-label">订餐</span>';
    inboxBtn.onclick = function(){ openCanteen(); };
    plusBtn.innerHTML = '<span style="font-size:1.2rem">🃏</span><span class="cb-label">卡片</span>';
    plusBtn.onclick = function(){ openCardRoom(); };
  } else {
    inboxBtn.innerHTML = '<span style="font-size:1.2rem">📬</span><span class="cb-label">消息</span>';
    inboxBtn.onclick = function(){ openCampInbox(); };
    plusBtn.innerHTML = '<span style="font-size:1.2rem">＋</span><span class="cb-label">更多</span>';
    plusBtn.onclick = function(){ _openQuickMenu(); };
  }

  // DiceBear avatar
  var seed = (users[CURRENT_USER]||{}).avatar_seed || 0;
  var avImg = document.getElementById('cbAvatar');
  avImg.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed='+seed+'&size=56';
  avImg.style.display = 'block';
  avImg.onerror = function(){ this.style.display='none'; };

  document.getElementById('overlayCampHome').classList.add('open');
  switchCampTab('overview');
}

function switchCampTab(tab) {
  _campActiveTab = tab;
  var tabs = document.querySelectorAll('#campTabBar .camp-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('on');
  var target = document.querySelector('#campTabBar .camp-tab[onclick*="'+tab+'"]');
  if (target) target.classList.add('on');
  var body = document.getElementById('campHomeBody');
  if (tab === 'overview') renderCampOverview(body);
  else if (tab === 'schedule') renderCampSchedule(body);
  else if (tab === 'funds') renderCampFunds(body);
  else if (tab === 'members') renderCampMembers(body);
  else if (tab === 'ranking') renderCampRanking(body);
  else if (tab === 'settle') renderCampSettle(body);
  else if (tab === 'manage') renderCampManage(body);
  body.scrollTop = 0;
}

// ── 概览 Tab ──
function renderCampOverview(el) {
  var c = getCampData(); if (!c) return;
  var tasks = c.tasks || [];
  var doneTasks = tasks.filter(function(t){return t.status==='已结算';}).length;
  var pct = tasks.length ? Math.round(doneTasks/tasks.length*100) : 0;
  var myTasks = (c.builders||[]).find(function(b){return b.name===CURRENT_USER;});
  var myCount = myTasks ? myTasks.taskNames.length : 0;
  var myNT = myTasks ? myTasks.totalNT : 0;
  var myTaskNames = myTasks ? myTasks.taskNames.slice(0,2) : [];

  // 今日安排摘要（多时段）
  var schedule = c.schedule || [];
  var todaySlots = '';
  if (schedule.length) {
    var slotPreviews = schedule.slice(0, 3).map(function(s) {
      return '<span style="display:inline-block;background:#f0f4ee;border-radius:4px;padding:1px 5px;margin:1px 2px;font-size:.58rem;white-space:nowrap">'+s.time+'</span>';
    });
    todaySlots = slotPreviews.join('');
  }

  // 资金摘要（审计 P1：从 c.budget 读取）
  var budget = c.budget || {};
  var people = (budget.adventurers||0)+(budget.builders||0);
  var days = (c.schedule||[])[0] ? ((c.schedule[0].cells||[]).length||8) : 8;
  var rmbTotal = (budget.lodgingRmb||0)*people*days + (budget.mealRmb||0)*people*days;
  var ntTotal = (budget.lodgingNT||0)*people*days + (budget.mealNT||0)*people*days;
  var rmbPerDay = rmbTotal ? Math.round(rmbTotal/days) : 0;
  var ntPerDay = ntTotal ? Math.round(ntTotal/days) : 0;

  // 成员摘要：构建者头像行
  var users = typeof getUsers==='function'?getUsers():{};
  var allMemberNames = [CURRENT_USER];
  (c.builders||[]).forEach(function(b){ if(allMemberNames.indexOf(b.name)===-1) allMemberNames.push(b.name); });
  Object.keys(users).forEach(function(name){ if(allMemberNames.indexOf(name)===-1 && users[name].role==='adventurer') allMemberNames.push(name); });
  var memberAvatars = '';
  allMemberNames.slice(0, 5).forEach(function(name) {
    var seed = (users[name]||{}).avatar_seed || 0;
    memberAvatars += '<img src="https://api.dicebear.com/7.x/avataaars/svg?seed='+seed+'&size=40" width="20" height="20" style="border-radius:50%;object-fit:cover;margin-left:-4px;border:1.5px solid #fff" alt="'+name+'" title="'+name+'" onerror="this.outerHTML=\'<span style=display:inline-block;width:20px;height:20px;border-radius:50%;background:#e0e0e0;text-align:center;line-height:20px;font-size:.5rem;margin-left:-4px;border:1.5px solid #fff>\'+(\''+name+'\').charAt(0)+\'</span>\'">';
  });
  if (allMemberNames.length > 5) memberAvatars += '<span style="font-size:.55rem;color:#5a6e5c;margin-left:2px">+'+(allMemberNames.length-5)+'</span>';

  // 订餐摘要
  var mealRmb = budget.mealRmb || 0;
  var mealNT = budget.mealNT || 0;

  // 住宿摘要
  var lodgingRmb = budget.lodgingRmb || 0;
  var lodgingNT = budget.lodgingNT || 0;

  el.innerHTML =
    '<div style="padding:14px">'+
    // 营队概览 header
    '<div style="background:linear-gradient(135deg,#e8f0e4,#dce8d8);border-radius:14px;padding:16px;text-align:center;margin-bottom:12px">'+
      '<div style="font-weight:700;font-size:.85rem;color:#2a4a30;margin-bottom:6px">📊 '+esc(c.name||'营队')+'</div>'+
      '<div style="font-size:.7rem;color:#5a6e5c">'+c.date+' · '+(c.people||0)+'人 · '+tasks.length+'个任务 · '+days+'天</div>'+
      '<div style="height:6px;background:rgba(0,0,0,.06);border-radius:3px;overflow:hidden;margin:8px 0"><div style="height:100%;width:'+pct+'%;background:#3d6b52;border-radius:3px"></div></div>'+
      '<div style="font-size:.65rem;color:#5a6e5c">已完成 '+doneTasks+' / 进行中 '+(tasks.length-doneTasks)+'</div>'+
    '</div>'+

    // 📋 我的任务
    '<div class="camp-nav-card" onclick="closeOverlay(\'overlayCampHome\');showMy({presetChip:\'营队\'})"><span>📋</span>'+
      '<div style="flex:1"><div style="font-size:.72rem;font-weight:600">我的任务包</div>'+
      (myCount ? '<div style="font-size:.58rem;color:#5a6e5c;margin-top:2px">'+(myTaskNames.length?myTaskNames.join(' · '):'')+'</div>' : '<div style="font-size:.58rem;color:#aaa;margin-top:2px">暂无分配</div>')+
      '</div>'+
      '<div style="text-align:right"><div style="font-size:.72rem;font-weight:700;color:var(--green-primary)">'+(myNT||0)+' NT</div><div style="font-size:.55rem;color:#5a6e5c">'+(myCount||0)+'项</div></div>'+
      '<span style="color:#d0d9ce">→</span></div>'+

    // 🕐 今日安排
    '<div class="camp-nav-card" onclick="switchCampTab(\'schedule\')"><span>🕐</span>'+
      '<div style="flex:1"><div style="font-size:.72rem;font-weight:600">今日安排</div>'+
      '<div style="margin-top:2px">'+(todaySlots||'<span style="font-size:.58rem;color:#aaa">暂无日程</span>')+'</div></div>'+
      '<span style="color:#d0d9ce">→</span></div>'+

    // 💰 资金概览
    '<div class="camp-nav-card" onclick="switchCampTab(\'funds\')"><span>💰</span>'+
      '<div style="flex:1"><div style="font-size:.72rem;font-weight:600">资金概览</div>'+
      '<div style="display:flex;gap:12px;margin-top:3px"><div style="font-size:.58rem;color:#5a6e5c">¥'+(rmbTotal||0).toLocaleString()+' <span style="color:#8a6a30">RMB</span></div><div style="font-size:.58rem;color:#5a6e5c">'+(ntTotal||0).toLocaleString()+' <span style="color:#3d6b52">NT</span></div><div style="font-size:.58rem;color:#aaa">¥'+(rmbPerDay||0)+'/天</div></div></div>'+
      '<span style="color:#d0d9ce">→</span></div>'+

    // 🥬 订餐
    '<div class="camp-nav-card" onclick="showToast(\'订餐功能将在阶段4上线\',\'warn\')"><span>🥬</span>'+
      '<div style="flex:1"><div style="font-size:.72rem;font-weight:600">订餐</div>'+
      '<div style="font-size:.58rem;color:'+(mealNT?'#5a6e5c':'#aaa')+';margin-top:2px">'+(mealNT?mealNT+' NT/餐 · ¥'+(mealRmb||0)+'/餐':'暂无菜单')+'</div></div>'+
      (mealNT ? '<span style="font-size:.6rem;background:#e8f0e4;color:#3d6b52;padding:3px 8px;border-radius:10px">预定</span>' : '')+
      '<span style="color:#d0d9ce">→</span></div>'+

    // 🏨 住宿
    '<div class="camp-nav-card" onclick="showToast(\'住宿功能将在阶段4上线\',\'warn\')"><span>🏨</span>'+
      '<div style="flex:1"><div style="font-size:.72rem;font-weight:600">住宿</div>'+
      '<div style="font-size:.58rem;color:'+(lodgingRmb?'#5a6e5c':'#aaa')+';margin-top:2px">'+(lodgingRmb?lodgingNT+' NT/天 · ¥'+lodgingRmb+'/天':'暂无客栈数据')+'</div></div>'+
      (lodgingRmb ? '<span style="font-size:.6rem;background:#e8f0e4;color:#3d6b52;padding:3px 8px;border-radius:10px">查看</span>' : '')+
      '<span style="color:#d0d9ce">→</span></div>'+

    // 👥 成员
    '<div class="camp-nav-card" onclick="switchCampTab(\'members\')"><span>👥</span>'+
      '<div style="flex:1"><div style="font-size:.72rem;font-weight:600">成员</div>'+
      '<div style="margin-top:2px">'+memberAvatars+'</div></div>'+
      '<div style="text-align:right"><div style="font-size:.72rem;font-weight:700;color:#3d6b52">'+(c.people||0)+'</div><div style="font-size:.55rem;color:#5a6e5c">人在营</div></div>'+
      '<span style="color:#d0d9ce">→</span></div>'+

    renderCampMilestones(c)+
    getMyBlocks(c)+
    _renderActivityFeed(c)+
    '</div>';
}

function renderCampMilestones(c) {
  var ms = c.milestones || [];
  if (!ms.length) return '';
  var h = '<div style="margin-top:12px;padding:12px;background:#fff;border-radius:10px"><div style="font-weight:700;font-size:.7rem;margin-bottom:8px">📍 里程碑</div><div style="display:flex;align-items:center;justify-content:space-between;padding:0 8px">';
  ms.forEach(function(m, i) {
    var isDone = m.date < new Date().toISOString().slice(0,10);
    h += '<div style="text-align:center;flex:1"><div style="width:10px;height:10px;border-radius:50%;background:'+(isDone?'#3d6b52':'#d0d9ce')+';margin:0 auto 4px"></div><div style="font-size:.58rem;color:'+(isDone?'#3d6b52':'#8a8a8a')+'">'+m.name+'</div><div style="font-size:.52rem;color:#aaa">'+m.date.slice(5)+'</div></div>';
    if (i < ms.length-1) h += '<div style="flex:0.5;height:1px;background:#d0d9ce;margin-bottom:12px"></div>';
  });
  h += '</div></div>';
  return h;
}

// ══ 概览 Tab 个性化区块 ══
var CATEGORY_BLOCKS = {
  '管理': ['review_queue', 'publish_task'],
  '财务': ['settlement_queue', 'nt_pool'],
  '生活': ['purchase_list', 'reimbursement'],
  '课程': ['class_schedule', 'material_prep'],
  '宣传': ['photo_shoot', 'essay_collect'],
  '结项': ['closing_progress', 'exhibition_prep']
};

var BLOCK_LABELS = {
  'review_queue': '⏳ 待你审核',
  'publish_task': '📋 发布任务',
  'settlement_queue': '🧾 待你结算',
  'nt_pool': '📊 NT 池',
  'purchase_list': '📦 今日采购',
  'reimbursement': '🧾 待报销',
  'class_schedule': '📚 今日课程',
  'material_prep': '🎨 材料准备',
  'photo_shoot': '📸 今日拍摄',
  'essay_collect': '📝 文稿征集',
  'closing_progress': '📊 结项进度',
  'exhibition_prep': '📸 展览准备'
};

function getMyBlocks(c) {
  if (!c || !CURRENT_USER) return '';
  var myTasks = (c.builders||[]).find(function(b){return b.name===CURRENT_USER;});
  if (!myTasks) return '';
  var campTasks = c.tasks || [];
  var categories = [];
  myTasks.taskNames.forEach(function(tn){
    var t = campTasks.find(function(ct){return ct.name===tn;});
    if (t && t.category && categories.indexOf(t.category)===-1) categories.push(t.category);
  });
  if (!categories.length) return '';

  var blocks = [];
  categories.forEach(function(cat){
    var b = CATEGORY_BLOCKS[cat] || [];
    b.forEach(function(bid){ if (blocks.indexOf(bid)===-1) blocks.push(bid); });
  });
  if (!blocks.length) return '';

  var maxShow = 3;
  var visible = blocks.slice(0, maxShow);
  var hidden = blocks.slice(maxShow);
  var folded = hidden.length > 0;

  var h = '';
  visible.forEach(function(bid, idx){
    h += _renderPersonalBlock(c, bid, idx===0);
  });
  if (folded) {
    h += '<div class="personal-more" id="personalMoreBtn" onclick="'+
      'var hidden=document.querySelectorAll(\'.personal-block-folded\');'+
      'for(var i=0;i<hidden.length;i++)hidden[i].style.display=\'block\';'+
      'this.style.display=\'none\'">▶ '+(hidden.length)+' 个更多区块</div>';
    hidden.forEach(function(bid){
      h += '<div class="personal-block personal-block-folded" style="display:none">';
      h += _renderPersonalBlockBody(c, bid);
      h += '</div>';
    });
  }
  return h;
}

function _renderPersonalBlock(c, bid, isFirst) {
  var label = BLOCK_LABELS[bid] || bid;
  var h = '<div class="personal-block">';
  h += '<div class="personal-block-head">'+label+'</div>';
  h += '<div class="personal-block-body">';
  h += _renderPersonalBlockBody(c, bid);
  h += '</div></div>';
  return h;
}

function _renderPersonalBlockBody(c, bid) {
  var h = '';
  if (bid==='review_queue') {
    var pending = _getPendingReview(c);
    if (pending.length) {
      pending.slice(0,2).forEach(function(item){
        h += '<div class="personal-block-item">';
        h += '<span style="flex:1">'+esc(item.task.publisher||'共创营')+' · '+esc(item.task.name)+' · NT '+item.task.nt+'</span>';
        h += '<button class="mgmt-btn ok" style="font-size:.6rem;padding:3px 8px" onclick="event.stopPropagation();mgmtApproveTask(\''+encodeURIComponent(item.task.name)+'\')">通过</button>';
        h += '<button class="mgmt-btn no" style="font-size:.6rem;padding:3px 8px" onclick="event.stopPropagation();mgmtRejectTask(\''+encodeURIComponent(item.task.name)+'\')">退回</button>';
        h += '</div>';
      });
      if (pending.length>2) h += '<div style="font-size:.6rem;color:#aaa;text-align:center">还有 '+(pending.length-2)+' 项…</div>';
    } else { h += '<div style="font-size:.62rem;color:#aaa;text-align:center">暂无待审核</div>'; }
  } else if (bid==='settlement_queue') {
    var unpaid = _getUnpaidList(c);
    if (unpaid.length) {
      unpaid.slice(0,2).forEach(function(item){
        h += '<div class="personal-block-item"><span style="flex:1">'+encodeURIComponent(item.person)+' · '+encodeURIComponent(item.taskName)+' · NT '+item.nt+'</span><button class="mgmt-btn settle" style="font-size:.6rem;padding:3px 8px" onclick="event.stopPropagation();mgmtSettleOne(\''+encodeURIComponent(item.taskName)+'\',\''+encodeURIComponent(item.person)+'\')">结算</button></div>';
      });
      if (unpaid.length>2) h += '<div style="font-size:.6rem;color:#aaa;text-align:center">还有 '+(unpaid.length-2)+' 笔…</div>';
    } else { h += '<div style="font-size:.62rem;color:#aaa;text-align:center">暂无待结算</div>'; }
  } else if (bid==='nt_pool') {
    var budget = c.budget || {};
    var people = (budget.adventurers||0)+(budget.builders||0);
    var days = (c.schedule||[])[0] ? ((c.schedule[0].cells||[]).length||8) : 8;
    var totalPool = (budget.lodgingNT||0)*people*days + (budget.mealNT||0)*people*days;
    var issuedNT = 0;
    (c.tasks||[]).forEach(function(t){(t.claimants||[]).forEach(function(cl){if(cl.status==='settled')issuedNT+=(t.nt||0);});});
    var remaining = totalPool - issuedNT;
    h += '<div style="text-align:center;font-size:.82rem;font-weight:700;color:'+(remaining>=0?'#3d6b52':'var(--red)')+'">剩余 '+(remaining>=0?'':'−')+Math.abs(remaining).toLocaleString()+' NT</div>';
    h += '<div style="font-size:.58rem;color:#5a6e5c;text-align:center;margin-top:2px">总池 '+totalPool.toLocaleString()+' · 已发 '+issuedNT.toLocaleString()+'</div>';
  } else if (bid==='publish_task') {
    var pubCount = (c.tasks||[]).filter(function(t){return t.status==='active'||t.status==='进行中';}).length;
    h += '<div style="text-align:center;font-size:.65rem;color:#5a6e5c">已发布 '+pubCount+' 个任务</div>';
    h += '<div style="text-align:center;margin-top:4px"><button class="mgmt-btn pri" style="font-size:.6rem" onclick="switchCampTab(\'manage\')">进入管理面板</button></div>';
  } else {
    var placeholders = {
      'purchase_list': '采购清单将在后续版本上线',
      'reimbursement': '报销功能将在后续版本上线',
      'class_schedule': '课程表将在后续版本上线',
      'material_prep': '材料准备将在后续版本上线',
      'photo_shoot': '拍摄任务将在后续版本上线',
      'essay_collect': '文稿征集将在后续版本上线',
      'closing_progress': '结项进度将在后续版本上线',
      'exhibition_prep': '展览准备将在后续版本上线'
    };
    h += '<div style="text-align:center;font-size:.62rem;color:#aaa">'+(placeholders[bid]||'即将上线')+'</div>';
  }
  return h;
}

// ══ 日程 Tab ──
// offsetDate fallback（审计 P2：阶段 2 未执行不报错）
if (typeof offsetDate !== 'function') { function offsetDate(d,days){ var dt=new Date(d+'T00:00:00');dt.setDate(dt.getDate()+days);return dt.toISOString().slice(0,10);} }

function renderCampSchedule(el) {
  var c = getCampData(); if (!c) return;
  var schedule = c.schedule || [];
  var milestones = c.milestones || [];
  if (!schedule.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#5a6e5c">📅 暂无日程安排<br><span style="font-size:.65rem">创营时未生成日程表</span></div>'; return; }

  var startDate = milestones.length>1 ? milestones[1].date : '';
  var days = schedule[0].cells ? schedule[0].cells.length : 0;

  var h = '<div style="padding:10px 0">';
  h += '<div style="margin:0 14px;background:#fff;border-radius:12px;padding:14px"><div style="font-weight:700;font-size:.78rem;margin-bottom:8px">📅 今日安排</div>';
  schedule.forEach(function(s) {
    h += '<div style="display:flex;padding:6px 0;font-size:.68rem;border-bottom:1px dotted #f0f0f0"><span style="color:#5a6e5c;width:50px;flex-shrink:0">'+s.time+'</span><span>'+(s.cells&&s.cells[0]||'—')+'</span></div>';
  });
  h += '</div>';

  h += '<div style="text-align:center;margin:12px 0"><span class="camp-nav-card" onclick="renderCampTimeline()" style="width:auto;display:inline-flex">📅 查看完整时间线 →</span></div>';

  h += '<div style="overflow-x:auto;padding:0 14px;white-space:nowrap;-webkit-overflow-scrolling:touch">';
  for (var i = 0; i < days; i++) {
    var d = offsetDate(startDate, i);
    var label = d.slice(5);
    var isToday = d === new Date().toISOString().slice(0,10);
    h += '<span style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;border-radius:12px;margin-right:6px;font-size:.65rem;'+(isToday?'background:#3d6b52;color:#fff;font-weight:700':'background:#fff;color:#5a6e5c')+'">'+label+'</span>';
  }
  h += '</div></div>';
  h += _renderActivityFeed(c);
  el.innerHTML = h;
}

function renderCampTimeline() {
  var c = getCampData(); if (!c) return;
  var schedule = c.schedule || [];
  var milestones = c.milestones || [];
  var days = schedule[0] ? (schedule[0].cells||[]).length : 0;
  var startDate = milestones.length>1 ? milestones[1].date : '';
  var h = '<div style="padding:14px">';
  for (var i = 0; i < days; i++) {
    var d = offsetDate(startDate, i);
    var ms = milestones.filter(function(m){return m.date===d;});
    h += '<div style="margin-bottom:12px"><div style="font-weight:700;font-size:.72rem;color:'+(ms.length?'#3d6b52':'#5a6e5c')+'">'+(ms.length?'● ':'')+d.slice(5)+' '+(ms.length?ms[0].name:'')+'</div>';
    h += '<div style="background:#fff;border-radius:10px;padding:10px">';
    schedule.forEach(function(s) {
      h += '<div style="display:flex;padding:4px 0;font-size:.65rem"><span style="color:#5a6e5c;width:50px">'+s.time+'</span><span>'+(s.cells&&s.cells[i]||'—')+'</span></div>';
    });
    h += '</div></div>';
  }
  h += '<span class="camp-nav-card" onclick="switchCampTab(\'schedule\')" style="width:auto;display:inline-flex">📅 回到日期滚轮 →</span></div>';
  document.getElementById('campHomeBody').innerHTML = h;
}

function scrollCampToToday() { switchCampTab('schedule'); }

// ── 资金 Tab ──
// ── 资金 Tab（阶段3 双卡片 + 阶段4 流水列表 + 按人汇总）──
var _fundsFilter = 'all';
var _fundsPage = 0;
var FUNDS_PAGE_SIZE = 20;

function _fundsIcon(type) {
  var map = { lodging:'🏠', meal:'🍚', material:'📦', transport:'🚗', task_reward:'🎁', tip:'💬', encourage:'💬', canteen_preorder:'🥬', canteen_refund:'🥬', topUp:'💳', cashOut:'💸' };
  return map[type] || '📝';
}

function _fundsTypeLabel(type) {
  var map = { lodging:'住宿', meal:'吃饭', material:'物资', transport:'交通', task_reward:'奖励', tip:'打赏', encourage:'鼓励', canteen_preorder:'订餐', canteen_refund:'退餐', topUp:'充值', cashOut:'提现' };
  return map[type] || '其他';
}

function renderCampFunds(el) {
  var c = getCampData(); if (!c) return;
  var budget = c.budget || {};
  var people = (budget.adventurers||0)+(budget.builders||0);
  var days = (c.schedule||[])[0] ? ((c.schedule[0].cells||[]).length||8) : 8;
  var rmbTotal = (budget.lodgingRmb||0)*people*days + (budget.mealRmb||0)*people*days;
  var ntTotal = (budget.lodgingNT||0)*people*days + (budget.mealNT||0)*people*days;
  var myTasks = (c.builders||[]).find(function(b){return b.name===CURRENT_USER;});
  var myNT = myTasks ? myTasks.totalNT : 0;

  var h = '<div style="padding:14px">';
  // === 阶段3 双卡片 ===
  h += '<div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:10px">'+
    '<div style="font-weight:700;font-size:.78rem;margin-bottom:8px">💰 RMB 金库</div>'+
    '<div style="display:flex;justify-content:space-between;font-size:.65rem;color:#5a6e5c"><span>总预算</span><span>¥'+rmbTotal.toLocaleString()+'</span></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:.65rem;color:#5a6e5c;margin:4px 0"><span>已支出</span><span>¥0</span></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:.72rem;font-weight:700;color:#3d6b52"><span>剩余</span><span>¥'+rmbTotal.toLocaleString()+'</span></div>'+
    '<div style="height:6px;background:rgba(0,0,0,.06);border-radius:3px;margin-top:8px"><div style="height:100%;width:0%;background:#3d6b52;border-radius:3px"></div></div>'+
  '</div>'+
  '<div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:10px">'+
    '<div style="font-weight:700;font-size:.78rem;margin-bottom:8px">🫘 NT 金库</div>'+
    '<div style="display:flex;justify-content:space-between;font-size:.65rem;color:#5a6e5c"><span>总池</span><span>'+ntTotal.toLocaleString()+' NT</span></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:.65rem;color:#5a6e5c;margin:4px 0"><span>已发放</span><span>0 NT</span></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:.72rem;font-weight:700;color:#3d6b52"><span>剩余</span><span>'+ntTotal.toLocaleString()+' NT</span></div>'+
    '<div style="height:6px;background:rgba(0,0,0,.06);border-radius:3px;margin-top:8px"><div style="height:100%;width:0%;background:#3d6b52;border-radius:3px"></div></div>'+
  '</div>'+
  '<div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:10px">'+
    '<div style="font-weight:700;font-size:.72rem;margin-bottom:8px">我的 NT</div>'+
    '<div style="display:flex;justify-content:space-between;font-size:.65rem;color:#5a6e5c"><span>任务激励</span><span>'+(myNT||0)+' NT</span></div>'+
  '</div>';

  // === 阶段4: 最近流水 ===
  _fundsFilter = 'all';
  _fundsPage = 0;
  h += '<div class="canteen-divider">最近流水</div>';
  h += _renderFundsChips();
  h += '<div id="fundsTransactionList">' + _renderFundsTransactions() + '</div>';
  h += '<div id="fundsSummary">' + _renderFundsSummary() + '</div>';
  h += '</div>';
  el.innerHTML = h;
}

function _renderFundsChips() {
  var types = [
    { key:'all', label:'全部' },
    { key:'lodging', label:'住宿' },
    { key:'meal', label:'吃饭' },
    { key:'material', label:'物资' },
    { key:'transport', label:'交通' },
    { key:'task_reward', label:'奖励' },
    { key:'canteen_preorder', label:'订餐' },
    { key:'tip', label:'打赏' },
    { key:'other', label:'其他' }
  ];
  var h = '<div class="funds-chip-row" id="fundsChipRow">';
  types.forEach(function(t) {
    var on = _fundsFilter === t.key ? ' on' : '';
    h += '<span class="funds-chip' + on + '" onclick="_fundsFilter=\'' + t.key + '\';document.getElementById(\'fundsTransactionList\').innerHTML=_renderFundsTransactions();_refreshFundsChips()">' + t.label + '</span>';
  });
  h += '</div>';
  return h;
}

function _refreshFundsChips() {
  var chips = document.querySelectorAll('#fundsChipRow .funds-chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.remove('on');
  var target = document.querySelector('#fundsChipRow .funds-chip[onclick*="\'' + _fundsFilter + '\'"]');
  if (target) target.classList.add('on');
}

function _renderFundsTransactions() {
  var finance = (window.AppData && AppData._data.finance) ? AppData._data.finance : [];
  var campTx = finance.filter(function(tx) { return tx.scope === 'camp' || tx.scope === undefined; });

  if (_fundsFilter !== 'all') {
    campTx = campTx.filter(function(tx) {
      if (_fundsFilter === 'other') {
        return !['lodging','meal','material','transport','task_reward','canteen_preorder','canteen_refund','tip','encourage','topUp','cashOut'].some(function(k){ return tx.type === k; });
      }
      return tx.type === _fundsFilter || tx.type === _fundsFilter.replace('preorder','refund').replace('refund','preorder');
    });
  }

  campTx.sort(function(a, b) { return (b.time||'').localeCompare(a.time||''); });

  var total = campTx.length;
  var start = 0;
  var end = Math.min((_fundsPage + 1) * FUNDS_PAGE_SIZE, total);
  var pageItems = campTx.slice(start, end);

  var h = '';
  if (!pageItems.length) {
    h += '<div style="text-align:center;padding:16px;font-size:.65rem;color:#8a8a8a">暂无流水记录</div>';
  } else {
    pageItems.forEach(function(tx) {
      var icon = _fundsIcon(tx.type);
      var label = _fundsTypeLabel(tx.type);
      var person = tx.from || tx.to || '系统';
      var note = tx.note || '';
      var amount = tx.amount || 0;
      var isNT = ['task_reward','tip','encourage','canteen_preorder','canteen_refund'].indexOf(tx.type) !== -1;
      var amtStr = isNT ? amount + ' NT' : '¥' + amount.toLocaleString();
      var sign = (tx.type === 'canteen_refund' || tx.type === 'task_reward') ? '+' : '-';
      if (tx.type === 'tip') sign = '';

      h += '<div class="funds-tx-row">'+
        '<span class="funds-tx-icon">' + icon + '</span>'+
        '<div class="funds-tx-body">'+
          '<div class="funds-tx-top"><span class="funds-tx-type">' + label + '</span><span class="funds-tx-person">' + esc(person) + '</span></div>'+
          '<div class="funds-tx-note">' + esc(note) + '</div>'+
        '</div>'+
        '<span class="funds-tx-amount">' + sign + ' ' + amtStr + '</span>'+
      '</div>';
    });
  }

  if (end < total) {
    h += '<div class="funds-load-more" onclick="_fundsPage++;document.getElementById(\'fundsTransactionList\').innerHTML=_renderFundsTransactions()">显示 ' + Math.min(FUNDS_PAGE_SIZE, total - end) + '/' + total + ' 条 · 加载更多</div>';
  }

  return h;
}

function _renderFundsSummary() {
  var finance = (window.AppData && AppData._data.finance) ? AppData._data.finance : [];
  var campTx = finance.filter(function(tx) { return tx.scope === 'camp' || tx.scope === undefined; });

  var summary = {};
  campTx.forEach(function(tx) {
    var person = tx.from || tx.to || '系统';
    if (person === '系统' && tx.to) person = tx.to;
    if (!summary[person]) summary[person] = { rmb:0, nt:0, count:0 };
    var isNT = ['task_reward','tip','encourage','canteen_preorder','canteen_refund'].indexOf(tx.type) !== -1;
    if (isNT) {
      summary[person].nt += tx.amount || 0;
    } else {
      summary[person].rmb += tx.amount || 0;
    }
    summary[person].count++;
  });

  var names = Object.keys(summary);
  if (!names.length) return '';

  var h = '<div class="canteen-divider">按人汇总</div>';
  h += '<div class="funds-summary-table">';
  names.forEach(function(name) {
    var s = summary[name];
    h += '<div class="funds-summary-row">'+
      '<span class="fs-name">' + esc(name) + '</span>'+
      '<span class="fs-rmb">' + (s.rmb ? '¥' + s.rmb.toLocaleString() : '—') + '</span>'+
      '<span class="fs-nt">' + (s.nt ? s.nt.toLocaleString() + ' NT' : '—') + '</span>'+
      '<span class="fs-count">' + s.count + ' 笔</span>'+
    '</div>';
  });
  h += '</div>';
  return h;
}

// ── 成员 Tab ──
function renderCampMembers(el) {
  var c = getCampData(); if (!c) return;
  var users = typeof getUsers==='function'?getUsers():{};
  var builders = c.builders || [];

  // 收集所有营地成员（审计 P1：含冒险者）
  var allMembers = [CURRENT_USER];
  builders.forEach(function(b){ if (allMembers.indexOf(b.name)===-1) allMembers.push(b.name); });
  Object.keys(users).forEach(function(name) {
    if (allMembers.indexOf(name) !== -1) return;
    if (users[name].role === 'adventurer') allMembers.push(name);
  });

  var groups = [
    { label:'🧙 管理员', role:'admin', members:[] },
    { label:'🧱 共建者', role:'builder', members:[] },
    { label:'⚔️ 冒险者', role:'adventurer', members:[] },
    { label:'👥 在地伙伴', role:'npc', members:[] },
    { label:'🏕️ 云村民', role:'visitor', members:[] }
  ];

  allMembers.forEach(function(name) {
    var u = users[name]; if (!u) return;
    var group = groups.find(function(g){return g.role===u.role;}) || groups[4];
    var b = builders.find(function(x){return x.name===name;});
    group.members.push({ name:name, role:u.role, seed:u.avatar_seed||0, tasks:b?b.taskNames.length:0, nt:b?b.totalNT:0 });
  });

  var h = '<div style="padding:14px">';
  groups.forEach(function(g, gi) {
    if (!g.members.length) return;
    var expanded = gi <= 1;
    h += '<div style="margin-bottom:8px"><div style="padding:8px 0;font-size:.7rem;font-weight:700;color:#5a6e5c;cursor:pointer" onclick="toggleCampMemberGroup(this)">'+(expanded?'▾':'▸')+' '+g.label+' · '+g.members.length+'人</div>';
    h += '<div class="camp-member-group" style="display:'+(expanded?'block':'none')+'">';
    g.members.forEach(function(m) {
      var avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed='+m.seed+'&size=56';
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#fff;border-radius:8px;margin-bottom:4px;cursor:pointer" onclick="toggleCampMemberDetail(this,\''+m.name+'\')">'+
        '<img src="'+avatarUrl+'" width="28" height="28" style="border-radius:50%;object-fit:cover" alt="" onerror="this.outerHTML=\'<div style=width:28px;height:28px;border-radius:50%;background:#e8ede6;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#5a6e5c>\'+(\''+m.name+'\').charAt(0)+\'</div>\'">'+
        '<div style="flex:1"><div style="font-weight:600;font-size:.7rem">'+m.name+'</div><div style="font-size:.58rem;color:#5a6e5c">'+(m.nt?m.nt+' NT':'')+(m.tasks?' · '+m.tasks+'项':'')+'</div></div>'+
        '<span style="font-size:.6rem;color:#d0d9ce">▸</span></div>';
    });
    h += '</div></div>';
  });
  h += '</div>';
  el.innerHTML = h;
}

function toggleCampMemberGroup(el) {
  var group = el.nextElementSibling;
  var isVisible = group.style.display !== 'none';
  group.style.display = isVisible ? 'none' : 'block';
  el.textContent = (isVisible ? '▸' : '▾') + el.textContent.slice(2);
}

function toggleCampMemberDetail(el, name) {
  var existing = el.nextElementSibling;
  if (existing && existing.className === 'camp-member-detail') { existing.remove(); return; }
  // E3.4: meet_3 quest hook — 查看其他成员 profile
  if (name !== CURRENT_USER && window.AppData) {
    if (!AppData._data.viewedMembers) AppData._data.viewedMembers = [];
    if (AppData._data.viewedMembers.indexOf(name) === -1) {
      AppData._data.viewedMembers.push(name);
      if (AppData._data.viewedMembers.length >= 3 && typeof _completeNewbieQuest === 'function') {
        _completeNewbieQuest(CURRENT_USER, 'meet_3');
      }
      AppData._save();
    }
  }
  var c = getCampData();
  var b = (c.builders||[]).find(function(x){return x.name===name;});
  var taskNames = b ? b.taskNames : [];
  var detail = document.createElement('div');
  detail.className = 'camp-member-detail';
  detail.style.cssText = 'padding:8px 12px;margin:0 0 4px 38px;background:#fafaf8;border-radius:8px;font-size:.65rem';
  var detailH = '<div style="font-weight:600;margin-bottom:4px">📋 任务包</div>';
  if (taskNames.length) {
    taskNames.forEach(function(t){ detailH += '<div style="padding:2px 0;color:#5a6e5c">· '+t+'</div>'; });
  } else { detailH += '<div style="color:#8a8a8a">暂无任务</div>'; }
  detailH += '<div style="margin-top:6px;color:#8a8a8a;cursor:pointer" onclick="openDossier(\''+name+'\')">查看案卷 →</div>';
  detail.innerHTML = detailH;
  el.parentNode.insertBefore(detail, el.nextSibling);
}

// ── 排行 Tab + 管理 Tab ──
// ── 阶段6: 通关结算 ──
var _settleSelectedUser = null;

function renderCampSettle(el) {
  var c = getCampData(); if (!c) return;
  var builders = c.builders || [];
  var users = typeof getUsers==='function'?getUsers():{};
  var allMembers = [CURRENT_USER];
  builders.forEach(function(b){ if (allMembers.indexOf(b.name)===-1) allMembers.push(b.name); });
  Object.keys(users).forEach(function(name) {
    if (allMembers.indexOf(name)!==-1) return;
    if (users[name].role==='adventurer') allMembers.push(name);
  });

  var builderGroup = [];
  var adventurerGroup = [];
  allMembers.forEach(function(name) {
    var u = users[name]; if (!u) return;
    var b = builders.find(function(x){ return x.name===name; });
    var nt = b ? b.totalNT : 0;
    var tasks = b ? b.taskNames.length : 0;
    var seed = u.avatar_seed || 0;
    var member = { name:name, role:u.role, nt:nt, tasks:tasks, seed:seed };
    if (u.role==='admin'||u.role==='builder') builderGroup.push(member);
    else if (u.role==='adventurer') adventurerGroup.push(member);
  });

  if (!_settleSelectedUser && builderGroup.length) _settleSelectedUser = builderGroup[0].name;
  else if (!_settleSelectedUser && adventurerGroup.length) _settleSelectedUser = adventurerGroup[0].name;

  var h = '<div style="padding:14px">';
  h += '<div style="font-weight:700;font-size:.78rem;margin-bottom:10px;text-align:center">🏁 通关结算</div>';

  h += '<div style="font-weight:600;font-size:.65rem;color:#5a6e5c;margin-bottom:6px">👥 共建者</div>';
  h += '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch">';
  builderGroup.forEach(function(m) {
    var avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed='+m.seed+'&size=56';
    var isSelected = m.name === _settleSelectedUser;
    h += '<div style="flex-shrink:0;text-align:center;cursor:pointer;padding:6px;border-radius:10px;border:2px solid '+(isSelected?'#3d6b52':'transparent')+';min-width:64px;transition:.12s" onclick="_settleSelectedUser=\''+m.name+'\';renderCampSettle(document.getElementById(\'campHomeBody\'))">'+
      '<img src="'+avatarUrl+'" width="36" height="36" style="border-radius:50%;object-fit:cover;display:block;margin:0 auto 4px" alt="" onerror="this.outerHTML=\'<div style=width:36px;height:36px;border-radius:50%;background:#e8ede6;display:flex;align-items:center;justify-content:center;font-size:.8rem;margin:0 auto 4px>\'+(\''+m.name+'\').charAt(0)+\'</div>\'">'+
      '<div style="font-size:.62rem;font-weight:600">'+m.name+'</div>'+
      '<div style="font-size:.55rem;color:#5a6e5c">'+m.nt+' NT</div>'+
    '</div>';
  });
  h += '</div>';

  if (adventurerGroup.length) {
    h += '<div style="font-weight:600;font-size:.65rem;color:#5a6e5c;margin:8px 0 6px">⚔️ 冒险者</div>';
    h += '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch">';
    adventurerGroup.forEach(function(m) {
      var avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed='+m.seed+'&size=56';
      var isSelected = m.name === _settleSelectedUser;
      h += '<div style="flex-shrink:0;text-align:center;cursor:pointer;padding:6px;border-radius:10px;border:2px solid '+(isSelected?'#3d6b52':'transparent')+';min-width:64px;transition:.12s" onclick="_settleSelectedUser=\''+m.name+'\';renderCampSettle(document.getElementById(\'campHomeBody\'))">'+
        '<img src="'+avatarUrl+'" width="36" height="36" style="border-radius:50%;object-fit:cover;display:block;margin:0 auto 4px" alt="" onerror="this.outerHTML=\'<div style=width:36px;height:36px;border-radius:50%;background:#e8ede6;display:flex;align-items:center;justify-content:center;font-size:.8rem;margin:0 auto 4px>\'+(\''+m.name+'\').charAt(0)+\'</div>\'">'+
        '<div style="font-size:.62rem;font-weight:600">'+m.name+'</div>'+
        '<div style="font-size:.55rem;color:#5a6e5c">'+m.nt+' NT</div>'+
      '</div>';
    });
    h += '</div>';
  }

  if (_settleSelectedUser) {
    var sel = (builderGroup.concat(adventurerGroup)).find(function(x){ return x.name===_settleSelectedUser; });
    if (sel) {
      h += renderSettleDetail(c, sel, users);
    }
  }

  h += '</div>';
  el.innerHTML = h;
}

function renderSettleDetail(c, member, users) {
  var avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed='+member.seed+'&size=112';
  var tasks = c.tasks || [];
  var b = (c.builders||[]).find(function(x){ return x.name===member.name; });
  var taskNames = b ? b.taskNames : [];
  var memberTasks = tasks.filter(function(t){ return taskNames.indexOf(t.name)!==-1; });
  var doneCount = memberTasks.filter(function(t){ return t.status==='已结算'; }).length;
  var pct = memberTasks.length ? Math.round(doneCount/memberTasks.length*100) : 0;
  var taskNT = memberTasks.reduce(function(s,t){ return s+(t.nt||0); },0);
  var econ = window.CAMP_ECONOMY || { roleBonus:{admin:20,builder:15,adventurer:0}, activityBonus:10 };
  var roleNT = econ.roleBonus[member.role] || 0;
  var activityNT = econ.activityBonus || 10;

  var h = '<div style="background:#fff;border-radius:12px;padding:16px;margin-top:12px">';
  h += '<div style="text-align:center;margin-bottom:12px">';
  h += '<img src="'+avatarUrl+'" width="56" height="56" style="border-radius:50%;object-fit:cover" alt="" onerror="this.outerHTML=\'<div style=width:56px;height:56px;border-radius:50%;background:#e8ede6;display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem;color:#5a6e5c>\'+(\''+member.name+'\').charAt(0)+\'</div>\'">';
  h += '<div style="font-weight:700;font-size:.78rem;margin-top:4px">'+member.name+'</div>';
  var roleLabel = member.role==='admin'?'🧱 共建者 · 南塘云村':(member.role==='builder'?'🧱 共建者 · 南塘云村':'⚔️ 冒险者 · 南塘云村');
  h += '<div style="font-size:.62rem;color:#5a6e5c">'+roleLabel+'</div>';
  h += '</div>';

  h += '<div style="display:flex;gap:8px;margin-bottom:10px">';
  h += '<div style="flex:1;text-align:center;background:#f5f3ef;border-radius:8px;padding:8px"><div style="font-size:.55rem;color:#5a6e5c">任务数</div><div style="font-weight:700;font-size:.78rem;color:#1d2e24">'+memberTasks.length+'</div></div>';
  h += '<div style="flex:1;text-align:center;background:#f5f3ef;border-radius:8px;padding:8px"><div style="font-size:.55rem;color:#5a6e5c">激励点</div><div style="font-weight:700;font-size:.78rem;color:#3d6b52">'+member.nt+'</div></div>';
  h += '<div style="flex:1;text-align:center;background:#f5f3ef;border-radius:8px;padding:8px"><div style="font-size:.55rem;color:#5a6e5c">完成率</div><div style="font-weight:700;font-size:.78rem;color:#1d2e24">'+pct+'%</div></div>';
  h += '</div>';

  h += '<div style="border-top:1px solid #f0f0f0;padding-top:8px;cursor:pointer" onclick="toggleSettleCalc(this)">';
  h += '<span style="font-size:.62rem;color:#3d6b52">▶ NT 计算方式</span></div>';
  h += '<div class="settle-calc-detail" style="display:none;font-size:.62rem;color:#5a6e5c;padding:4px 12px 8px;line-height:1.7">';
  h += '<div>任务激励：'+taskNT+'</div>';
  h += '<div>角色 NT：'+roleNT+'</div>';
  h += '<div>活动 NT：'+activityNT+'</div>';
  h += '<div style="border-top:1px dotted #d0d9ce;margin-top:2px;padding-top:2px;font-weight:600;color:#1d2e24">合计：'+(taskNT+roleNT+activityNT)+' NT</div>';
  h += '</div>';

  h += '<div style="border-top:1px solid #f0f0f0;padding-top:8px;cursor:pointer" onclick="toggleSettleCalc(this)">';
  h += '<span style="font-size:.62rem;color:#3d6b52">▶ 任务明细（'+memberTasks.length+'项）</span></div>';
  h += '<div class="settle-calc-detail" style="display:none;font-size:.62rem;color:#5a6e5c;padding:4px 12px 8px;line-height:1.7">';
  if (memberTasks.length) {
    memberTasks.forEach(function(t) {
      var icon = t.status==='已结算'?'✅':(t.status==='待结算'?'◷':'☐');
      h += '<div>'+icon+' '+t.name+' · '+(t.type||'支线')+' · '+t.nt+' NT</div>';
    });
  } else { h += '<div style="color:#8a8a8a">暂无任务</div>'; }
  h += '</div>';

  h += '<div style="border-top:1px solid #f0f0f0;padding-top:8px;cursor:pointer" onclick="toggleSettleCalc(this)">';
  h += '<span style="font-size:.62rem;color:#3d6b52">▶ 工资分配</span></div>';
  h += '<div class="settle-calc-detail" style="display:none;font-size:.62rem;color:#5a6e5c;padding:4px 12px 8px;line-height:1.7">';
  var budget = c.budget || {};
  var peopleEst = (budget.adventurers||0)+(budget.builders||0) || c.people || 1;
  var rmbPer = peopleEst > 0 ? Math.round(((budget.lodgingRmb||0)+(budget.mealRmb||0)) / peopleEst) : 0;
  h += '<div>RMB：¥'+rmbPer.toLocaleString()+' ｜ NT：'+member.nt+'</div>';
  h += '<div style="font-size:.55rem;color:#8a8a8a;margin-top:2px">数据来源：营队预算 ÷ 参与人数</div>';
  h += '</div>';

  h += '</div>';
  return h;
}

function toggleSettleCalc(el) {
  var detail = el.querySelector('.settle-calc-detail') || el.nextElementSibling;
  if (detail && detail.className.indexOf('settle-calc-detail')!==-1) {
    var isVisible = detail.style.display !== 'none';
    detail.style.display = isVisible ? 'none' : 'block';
    el.querySelector('span').textContent = (isVisible ? '▶' : '▾') + el.querySelector('span').textContent.slice(2);
  }
}

function renderCampRanking(el) {
  var c = getCampData(); if (!c) return;
  var builders = c.builders || [];
  var ranked = builders.slice().sort(function(a,b){return b.totalNT - a.totalNT;});
  var myIdx = ranked.findIndex(function(b){return b.name===CURRENT_USER;});
  var myRank = myIdx + 1;
  var medals = ['🥇','🥈','🥉'];
  var prevRanked = c._prevRank || [];
  var rankDelta = {};
  if (prevRanked.length) {
    ranked.forEach(function(b, i) {
      var prevIdx = prevRanked.findIndex(function(p){ return p.name===b.name; });
      if (prevIdx !== -1 && prevIdx !== i) rankDelta[b.name] = (prevIdx > i) ? 'up' : 'down';
    });
  }

  var h = '<div style="padding:14px 14px 60px">';
  if (!ranked.length) {
    h += '<div style="text-align:center;padding:40px;color:#5a6e5c">暂无排名数据</div>';
  } else {
    ranked.forEach(function(b, i) {
      var medal = i < 3 ? medals[i] : '';
      var maxNT = ranked[0].totalNT || 1;
      var barW = Math.round(b.totalNT / maxNT * 100);
      var delta = rankDelta[b.name];
      var deltaText = delta==='up'?' ↑':(delta==='down'?' ↓':' —');
      var deltaColor = delta==='up'?'#3d6b52':(delta==='down'?'#b84c38':'#8a8a8a');
      h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:.68rem;border-bottom:1px dotted #f0f0f0">'+
        '<span style="width:28px;text-align:center;font-size:.9rem">'+medal+'</span>'+
        '<span style="width:20px;text-align:center;font-weight:700;color:'+(i<3?'#c8892e':'#5a6e5c')+'">'+(i+1)+'</span>'+
        '<span style="flex:1">'+b.name+'<span style="font-size:.55rem;color:'+deltaColor+';margin-left:4px">'+deltaText+'</span></span>'+
        '<span style="color:var(--green-primary);font-weight:600;width:50px;text-align:right">'+b.totalNT+' NT</span>'+
        '<span style="color:#5a6e5c;width:40px;text-align:right">'+b.taskNames.length+'项</span>'+
        '<div style="width:60px;height:4px;background:#f0f0f0;border-radius:2px;overflow:hidden"><div style="height:100%;width:'+barW+'%;background:#3d6b52;border-radius:2px"></div></div>'+
      '</div>';
    });
  }
  h += '</div>';

  if (myRank) {
    var user = ranked[myIdx];
    h += '<div style="position:sticky;bottom:0;left:0;right:0;background:rgba(232,240,228,.96);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-top:1px solid #d0d9ce;padding:10px 14px;text-align:center;font-size:.68rem;color:var(--green-primary);font-weight:600;margin:0 -14px">你的排名：第 '+myRank+' 位 · '+(user?user.totalNT+' NT':'')+'</div>';
  }

  el.innerHTML = h;
}

// ── 管理面板 6 区块 ──
function _canManage() {
  var users = typeof getUsers==='function'?getUsers():{};
  var role = (users[CURRENT_USER]||{}).role||'visitor';
  if (role==='admin') return true;
  var c = getCampData(); if (!c) return false;
  var myTasks = (c.builders||[]).find(function(b){return b.name===CURRENT_USER;});
  if (!myTasks) return false;
  var campTasks = c.tasks || [];
  return myTasks.taskNames.some(function(tn){
    var t = campTasks.find(function(ct){return ct.name===tn;});
    return t && t.category==='管理';
  });
}

function renderCampManage(el) {
  var c = getCampData(); if (!c) { el.innerHTML='<div style="text-align:center;padding:60px;color:#5a6e5c">未找到营队数据</div>'; return; }
  if (!_canManage()) { el.innerHTML='<div style="text-align:center;padding:60px;color:#5a6e5c"><div style="font-size:2rem;margin-bottom:8px">🔒</div><div style="font-weight:700">暂无管理权限</div></div>'; return; }
  _ensureCampTaskClaimants(c);
  var tasks = c.tasks || [];
  var h = '<div style="padding:14px">';

  // ══ 区块 1: 营队任务待审批 ══
  var pendingReview = _getPendingReview(c);
  h += '<div class="mgmt-section" id="mgmtBlock1">';
  h += '<div class="mgmt-section-head">⏳ 营队任务待审批（'+pendingReview.length+'项）</div>';
  if (pendingReview.length) {
    h += '<div class="mgmt-section-body">';
    pendingReview.forEach(function(item){
      var tc = _typeColor(item.task.type);
      h += '<div class="mgmt-item">';
      h += '<div class="mgmt-item-body">';
      h += '<span class="type-tag type-tag-'+tc.cls+'">'+tc.icon+' '+item.task.type+'</span>';
      h += '<span class="mgmt-item-name">'+esc(item.task.name)+'</span>';
      h += '<span class="mgmt-item-nt">NT '+item.task.nt+'</span>';
      h += '<div class="mgmt-item-meta">发出者：'+esc(item.task.publisher||'共创营')+' · 审核人：'+esc(item.task.reviewer||'')+'</div>';
      h += '</div>';
      h += '<div class="mgmt-actions">';
      h += '<button class="mgmt-btn ok" onclick="event.stopPropagation();mgmtApproveTask(\''+encodeURIComponent(item.task.name)+'\')">✅ 通过</button>';
      h += '<button class="mgmt-btn no" onclick="event.stopPropagation();mgmtRejectTask(\''+encodeURIComponent(item.task.name)+'\')">❌ 退回</button>';
      h += '</div></div>';
    });
    h += '</div>';
  } else {
    h += '<div class="mgmt-section-body" style="text-align:center;color:#aaa;font-size:.65rem">暂无待审批任务</div>';
  }
  h += '</div>';

  // ══ 区块 2: 已发布任务 ══
  var published = tasks.filter(function(t){return t.status==='active'||t.status==='进行中';});
  h += '<div class="mgmt-section" id="mgmtBlock2">';
  h += '<div class="mgmt-section-head">📋 已发布任务（'+published.length+'项）</div>';
  if (published.length) {
    h += '<div class="mgmt-table-wrap"><table class="mgmt-table"><thead><tr><th>任务名</th><th>类型</th><th>NT</th><th>已领/额</th><th>状态</th><th>操作</th></tr></thead><tbody>';
    published.forEach(function(t){
      var tc = _typeColor(t.type);
      var claimed = (t.claimants||[]).length;
      var slots = t.slots||0;
      h += '<tr>';
      h += '<td class="sticky-name">'+esc(t.name)+'</td>';
      h += '<td><span class="type-tag type-tag-'+tc.cls+'">'+t.type+'</span></td>';
      h += '<td style="font-weight:700;color:var(--green-primary)">'+t.nt+'</td>';
      h += '<td>'+claimed+'/'+(slots||'不限')+'</td>';
      h += '<td style="color:'+(t.status==='active'?'#3d6b52':'#5a6e5c')+'">'+(t.status||'active')+'</td>';
      h += '<td>';
      if (t.type==='隐藏') h += '<button class="mgmt-btn settle" onclick="event.stopPropagation();mgmtRevealTask(\''+encodeURIComponent(t.name)+'\')">🔓触发</button>';
      else h += '<span style="color:#aaa;font-size:.6rem">—</span>';
      h += '</td></tr>';
    });
    h += '</tbody></table></div>';
  } else {
    h += '<div class="mgmt-section-body" style="text-align:center;color:#aaa;font-size:.65rem">暂无已发布任务</div>';
  }
  h += '</div>';

  // ══ 区块 3: 待审核（提交审核） ══
  var pendingSubmissions = _getPendingSubmissions(c);
  h += '<div class="mgmt-section" id="mgmtBlock3">';
  h += '<div class="mgmt-section-head">⏳ 待审核（'+pendingSubmissions.length+'项）</div>';
  if (pendingSubmissions.length) {
    h += '<div class="mgmt-section-body">';
    pendingSubmissions.forEach(function(sub){
      h += '<div class="mgmt-item">';
      h += '<div class="mgmt-item-body">';
      h += '<span class="mgmt-item-name">'+esc(sub.person)+' · '+esc(sub.taskName)+' · NT '+sub.nt+'</span>';
      h += '<div class="mgmt-item-meta">提交于 '+sub.date+' · "'+esc(sub.note||'')+'"</div>';
      h += '</div>';
      h += '<div class="mgmt-actions">';
      h += '<button class="mgmt-btn ok" onclick="event.stopPropagation();mgmtConfirmSubmit(\''+encodeURIComponent(sub.taskName)+'\',\''+encodeURIComponent(sub.person)+'\')">✅ 确认通过</button>';
      h += '<input id="rejectReason_'+esc(sub.person)+'_'+esc(sub.taskName).replace(/\s/g,'_')+'" placeholder="退回原因" style="width:70px;padding:3px 6px;border:1px solid #d0d9ce;border-radius:4px;font-size:.6rem" onkeydown="if(event.key===\'Enter\')mgmtRejectSubmit(\''+esc(sub.taskName)+'\',\''+esc(sub.person)+'\')">';
      h += '<button class="mgmt-btn no" onclick="event.stopPropagation();mgmtRejectSubmit(\''+encodeURIComponent(sub.taskName)+'\',\''+encodeURIComponent(sub.person)+'\')">❌ 退回</button>';
      h += '</div></div>';
    });
    h += '</div>';
  } else {
    h += '<div class="mgmt-section-body" style="text-align:center;color:#aaa;font-size:.65rem">暂无待审核提交</div>';
  }
  h += '</div>';

  // ══ 区块 4: 应付未付 ══
  var unpaid = _getUnpaidList(c);
  var unpaidTotal = unpaid.reduce(function(s,item){return s+item.nt;},0);
  h += '<div class="mgmt-section" id="mgmtBlock4">';
  h += '<div class="mgmt-section-head">📋 应付未付（'+unpaid.length+'笔，共 NT '+unpaidTotal+'）</div>';
  if (unpaid.length) {
    h += '<div class="mgmt-section-body">';
    unpaid.forEach(function(item){
      h += '<div class="mgmt-item">';
      h += '<div class="mgmt-item-body">';
      h += '<span class="mgmt-item-name">'+esc(item.person)+' · '+esc(item.taskName)+' · NT '+item.nt+'</span>';
      h += '<div class="mgmt-item-meta">审核于 '+item.date+'</div>';
      h += '</div>';
      h += '<button class="mgmt-btn settle" onclick="event.stopPropagation();mgmtSettleOne(\''+encodeURIComponent(item.taskName)+'\',\''+encodeURIComponent(item.person)+'\')">🔓 结算</button>';
      h += '</div>';
    });
    h += '<div style="text-align:center;margin-top:10px">';
    h += '<button class="mgmt-btn pri" style="width:100%;padding:10px" onclick="mgmtSettleAll()">💰 一键结算全部（'+unpaid.length+'笔 · NT '+unpaidTotal+'）</button>';
    h += '</div>';
    h += '</div>';
  } else {
    h += '<div class="mgmt-section-body" style="text-align:center;color:#aaa;font-size:.65rem">暂无应付未付</div>';
  }
  h += '</div>';

  // ══ 区块 5: NT 池统计 ══
  h += _renderNTPoolStats(c);

  // ══ 区块 6: 完结本期 ══
  h += '<div class="mgmt-section" id="mgmtBlock6">';
  h += '<div class="mgmt-section-head">📦 完结本期</div>';
  h += '<div class="mgmt-section-body">';
  h += '<div class="archive-warn">⚠️ 完结后营队状态变为「已结束」，不可再发布/结算任务。未结算的应付项将被标记为「已过期」。</div>';
  h += '<button class="mgmt-btn no" style="width:100%;padding:10px;font-size:.75rem" onclick="mgmtArchiveCamp()">📦 完结本期</button>';
  h += '</div></div>';

  h += '</div>';
  el.innerHTML = h;
}

function _typeColor(type) {
  if (type==='主线'||type==='主线M') return {cls:'main',icon:'🎯',c:'var(--green-primary)',b:'#e8f0e8'};
  if (type==='支线'||type==='支线S') return {cls:'side',icon:'📋',c:'#c8892e',b:'#fef8e8'};
  if (type==='共创') return {cls:'co',icon:'🤝',c:'#4a7a82',b:'#e0eaee'};
  if (type==='隐藏') return {cls:'hidden',icon:'🔮',c:'#7a4a82',b:'#f0e8f0'};
  if (type==='身份') return {cls:'identity',icon:'🪪',c:'#3a5a82',b:'#e0e8f0'};
  if (type==='彩蛋') return {cls:'easter',icon:'🥚',c:'#8a6a30',b:'#fef0d0'};
  return {cls:'main',icon:'📌',c:'var(--green-primary)',b:'#e8f0e8'};
}

function _ensureCampTaskClaimants(c) {
  if (!c || !c.tasks) return;
  c.tasks.forEach(function(t){
    if (!t.claimants) t.claimants = [];
    if (!t.publisher) t.publisher = c.createdBy || '共创营';
    if (!t.slots) t.slots = 1;
    if (!t.status) t.status = 'todo';
  });
}

function _getPendingReview(c) {
  var tasks = c.tasks || [];
  return tasks.filter(function(t){
    return t.status==='pending_review' && t.reviewer===CURRENT_USER;
  }).map(function(t){return {task:t};});
}

function _getPendingSubmissions(c) {
  var result = [];
  var tasks = c.tasks || [];
  tasks.forEach(function(t){
    (t.claimants||[]).forEach(function(cl){
      if (cl.status==='submitted') {
        result.push({
          taskName: t.name, person: cl.name, nt: t.nt,
          date: cl.submittedAt||'', note: cl.submission||''
        });
      }
    });
  });
  return result;
}

function _getUnpaidList(c) {
  var result = [];
  var tasks = c.tasks || [];
  tasks.forEach(function(t){
    (t.claimants||[]).forEach(function(cl){
      if (cl.status==='approved') {
        result.push({
          taskName: t.name, person: cl.name, nt: t.nt,
          date: cl.approvedAt||''
        });
      }
    });
  });
  return result;
}

function _renderNTPoolStats(c) {
  var tasks = c.tasks || [];
  var issuedNT = 0;
  tasks.forEach(function(t){
    (t.claimants||[]).forEach(function(cl){
      if (cl.status==='settled') issuedNT += (t.nt||0);
    });
  });
  var pendingReviewNT = 0;
  var pendingSubs = _getPendingSubmissions(c);
  pendingSubs.forEach(function(s){ pendingReviewNT += s.nt; });
  var unpaidList = _getUnpaidList(c);
  var unpaidNT = 0;
  unpaidList.forEach(function(u){ unpaidNT += u.nt; });
  var budget = c.budget || {};
  var people = (budget.adventurers||0)+(budget.builders||0);
  var days = (c.schedule||[])[0] ? ((c.schedule[0].cells||[]).length||8) : 8;
  var totalPool = (budget.lodgingNT||0)*people*days + (budget.mealNT||0)*people*days;
  var remaining = totalPool - issuedNT - unpaidNT - pendingReviewNT;
  var remainColor = remaining >= 0 ? 'positive' : 'negative';
  var communityPool = (window.NT && typeof NT.getCommunityPool === 'function') ? NT.getCommunityPool() : 0;

  return '<div class="mgmt-section" id="mgmtBlock5">'+
    '<div class="mgmt-section-head">📊 NT 池统计 <span style="font-size:.58rem;color:'+(communityPool<500?'#b84c38':'#5a6e5c')+'">社区池 '+(communityPool||0)+' NT</span></div>'+
    '<div class="mgmt-section-body">'+
    '<div class="nt-pool-grid">'+
    '<div class="nt-pool-cell"><div class="nt-val" style="color:#3d6b52">'+(totalPool||0).toLocaleString()+'</div><div class="nt-label">本期总池 NT</div></div>'+
    '<div class="nt-pool-cell"><div class="nt-val" style="color:#c8892e">'+issuedNT.toLocaleString()+'</div><div class="nt-label">已发放 NT</div></div>'+
    '<div class="nt-pool-cell"><div class="nt-val" style="color:#4a7a82">'+pendingReviewNT.toLocaleString()+'</div><div class="nt-label">待审核 NT</div></div>'+
    '<div class="nt-pool-cell"><div class="nt-val" style="color:#8a6a30">'+unpaidNT.toLocaleString()+'</div><div class="nt-label">应付未付 NT</div></div>'+
    '<div class="nt-pool-cell '+remainColor+'"><div class="nt-val">'+(remaining>=0?'':'−')+Math.abs(remaining).toLocaleString()+'</div><div class="nt-label">剩余 NT</div></div>'+
    '<div class="nt-pool-cell"><div class="nt-val" style="color:#5a6e5c">'+(issuedNT+unpaidNT+pendingReviewNT).toLocaleString()+'</div><div class="nt-label">已承诺 NT</div></div>'+
    '</div>'+
    (communityPool < 500 ?
      '<div style="margin-top:8px;padding:8px 10px;background:#fff5f5;border:1px solid #f0c8c8;border-radius:8px;font-size:.6rem;color:#b84c38">'+
        '⚠️ 社区 NT 池仅剩 ' + communityPool + ' NT，日志奖励和新手任务可能无法发放。'+
        (communityPool === 0 ? '<br>池已耗尽，请管理员立即补充。' : '')+
      '</div>' : '') +
    '</div></div>';
}

function mgmtScrollToBlock(blockNum) {
  switchCampTab('manage');
  setTimeout(function(){
    var el = document.getElementById('mgmtBlock'+blockNum);
    if (el) el.scrollIntoView({behavior:'smooth',block:'start'});
  }, 100);
}

// ══ 管理操作：审批/退回/发布/结算/完结 ══
function mgmtApproveTask(taskName) {
  taskName = decodeURIComponent(taskName);
  var c = getCampData(); if (!c) return;
  var t = (c.tasks||[]).find(function(x){return x.name===taskName;});
  if (!t) { showToast('任务不存在','error'); return; }
  t.status = 'active';
  _saveCamp(c);
  logActivity('review_approve', CURRENT_USER+' 通过了「'+taskName+'」审核');
  showToast('「'+taskName+'」已通过','ok');
  switchCampTab('manage');
}

function mgmtRejectTask(taskName) {
  taskName = decodeURIComponent(taskName);
  var c = getCampData(); if (!c) return;
  var t = (c.tasks||[]).find(function(x){return x.name===taskName;});
  if (!t) { showToast('任务不存在','error'); return; }
  _openRejectSheet('mgmtRejectTaskConfirm', {taskName:taskName}, function(data){
    var c2 = getCampData(); if (!c2) return;
    var t2 = (c2.tasks||[]).find(function(x){return x.name===data.taskName;});
    if (!t2) return;
    t2.status = 'draft';
    t2.rejectReason = data.reason;
    _saveCamp(c2);
    logActivity('review_reject', CURRENT_USER+' 退回了「'+data.taskName+'」：'+data.reason);
    showToast('已退回「'+data.taskName+'」','warn');
    switchCampTab('manage');
  });
}

function _openRejectSheet(actionKey, context, callback) {
  document.querySelectorAll('.reject-sheet-overlay').forEach(function(s){s.remove();});
  var overlay = document.createElement('div');
  overlay.className = 'reject-sheet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .15s ease-out';
  overlay.addEventListener('click', function(e){if(e.target===overlay)overlay.remove();});
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-height:60vh;padding:16px 20px 20px;box-shadow:0 -4px 20px rgba(0,0,0,.08)';
  card.innerHTML = '<div style="font-weight:700;font-size:.78rem;margin-bottom:12px">❌ 退回原因</div>'+
    '<textarea id="rejectSheetReason" placeholder="请填写退回原因（必填）…" rows="3" style="width:100%;padding:10px;border:1px solid #d0d9ce;border-radius:8px;font-size:.72rem;font-family:inherit;resize:vertical"></textarea>'+
    '<div id="rejectSheetError" style="color:var(--red);font-size:.62rem;min-height:16px;margin:4px 0"></div>'+
    '<div style="display:flex;gap:8px;margin-top:10px">'+
    '<button class="btn-sm sec" style="flex:1" onclick="this.closest(\'.reject-sheet-overlay\').remove()">取消</button>'+
    '<button class="btn-sm danger" style="flex:1" id="rejectSheetConfirmBtn">确认退回</button></div>';
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.getElementById('rejectSheetConfirmBtn').addEventListener('click', function(){
    var reason = document.getElementById('rejectSheetReason').value.trim();
    if (!reason) { document.getElementById('rejectSheetError').textContent = '请填写退回原因'; return; }
    overlay.remove();
    if (callback) callback({reason:reason, taskName:context.taskName, person:context.person});
  });
}

function mgmtConfirmSubmit(taskName, person) {
  taskName = decodeURIComponent(taskName); person = decodeURIComponent(person);
  var c = getCampData(); if (!c) return;
  var t = (c.tasks||[]).find(function(x){return x.name===taskName;});
  if (!t) { showToast('任务不存在','error'); return; }
  var cl = (t.claimants||[]).find(function(x){return x.name===person;});
  if (!cl) { showToast('认领记录不存在','error'); return; }
  cl.status = 'approved';
  cl.approvedAt = today();
  _saveCamp(c);
  logActivity('submission_approve', CURRENT_USER+' 通过了 '+person+' 对「'+taskName+'」的提交');
  showToast(person+' 的提交已通过 · 进入应付未付','ok');
  switchCampTab('manage');
}

function mgmtRejectSubmit(taskName, person) {
  taskName = decodeURIComponent(taskName); person = decodeURIComponent(person);
  var c = getCampData(); if (!c) return;
  var t = (c.tasks||[]).find(function(x){return x.name===taskName;});
  if (!t) { showToast('任务不存在','error'); return; }
  var cl = (t.claimants||[]).find(function(x){return x.name===person;});
  if (!cl) { showToast('认领记录不存在','error'); return; }
  var reasonInput = document.getElementById('rejectReason_'+esc(person)+'_'+esc(taskName).replace(/\s/g,'_'));
  var reason = reasonInput ? reasonInput.value.trim() : '';
  if (!reason) { showToast('请填写退回原因','error'); return; }
  cl.status = 'in_progress';
  cl.rejectReason = reason;
  _saveCamp(c);
  logActivity('submission_reject', CURRENT_USER+' 退回了 '+person+' 对「'+taskName+'」的提交：'+reason);
  showToast('已退回 '+person+' 的提交','warn');
  switchCampTab('manage');
}

function mgmtRevealTask(taskName) {
  taskName = decodeURIComponent(taskName);
  var c = getCampData(); if (!c) return;
  var t = (c.tasks||[]).find(function(x){return x.name===taskName;});
  if (!t) return;
  t.type = '支线';
  _saveCamp(c);
  logActivity('task_reveal', CURRENT_USER+' 公开了隐藏任务「'+taskName+'」');
  showToast('「'+taskName+'」已公开','ok');
  switchCampTab('manage');
}

function mgmtSettleOne(taskName, person) {
  taskName = decodeURIComponent(taskName); person = decodeURIComponent(person);
  var c = getCampData(); if (!c) return;
  var t = (c.tasks||[]).find(function(x){return x.name===taskName;});
  if (!t) { showToast('任务不存在','error'); return; }
  showConfirm('确认结算 '+person+' · '+taskName+' · NT '+t.nt+'？', function(){
    _doSettle(c, t, person);
  });
}

function mgmtSettleAll() {
  var c = getCampData(); if (!c) return;
  var unpaid = _getUnpaidList(c);
  if (!unpaid.length) { showToast('没有待结算项','warn'); return; }
  var total = unpaid.reduce(function(s,i){return s+i.nt;},0);
  showConfirm('确定一键结算全部 '+unpaid.length+' 笔 · 共 NT '+total+'？', function(){
    unpaid.forEach(function(item){
      var t = (c.tasks||[]).find(function(x){return x.name===item.taskName;});
      if (t) _doSettle(c, t, item.person, true);
    });
    _saveCamp(c);
    showToast('已结算 '+unpaid.length+' 笔 · NT '+total,'ok');
    switchCampTab('manage');
  });
}

function _doSettle(c, t, person, silent) {
  var cl = (t.claimants||[]).find(function(x){return x.name===person;});
  if (!cl) return;
  var amount = t.nt||0;

  // P0-3: 检查本期总池是否超支
  var totalPool = _calcCampTotalNT(c);
  if (totalPool > 0) {
    var tasks = c.tasks || [];
    var issuedNT = 0;
    tasks.forEach(function(task){
      (task.claimants||[]).forEach(function(cl2){
        if (cl2.status==='settled') issuedNT += (task.nt||0);
      });
    });
    if (issuedNT + amount > totalPool) {
      showToast('⚠️ NT 池超支 ' + (issuedNT + amount - totalPool) + ' NT。请调整预算或减少任务 NT 值。', 'error');
      return;
    }
  }

  // P0-2: 检查 camp_pool 余额 + 转账返回值
  if (window.NT) {
    var pool = NT.getUser('camp_pool');
    if (!pool || pool.ntBalance < amount) {
      showToast('⚠️ camp_pool 余额不足（需 ' + amount + ' NT，当前 ' + (pool ? pool.ntBalance : 0) + ' NT）。', 'error');
      return;
    }
    var result = NT.transfer('camp_pool', person, amount, '任务结算: '+t.name);
    if (!result) {
      showToast('⚠️ 转账失败，结算未执行', 'error');
      return;
    }
  }

  cl.status = 'settled';
  cl.settledAt = today();
  logActivity('task_reward', CURRENT_USER+' 结算了「'+t.name+'」· '+amount+' NT → '+person);
  if (!silent) {
    _saveCamp(c);
    showToast('已结算 '+person+' · NT '+amount,'ok');
    switchCampTab('manage');
  }
}

function mgmtArchiveCamp() {
  var c = getCampData(); if (!c) return;
  showConfirm('确定完结本期？<br><span style="font-size:.65rem;color:#b84c38">此操作不可撤销，完结后不可再发布/结算任务</span>', function(){
    // 阶段6: 保存排名快照 + 存档到 archived_periods
    var builders = (c.builders||[]).slice().sort(function(a,b){ return b.totalNT - a.totalNT; });
    c._prevRank = builders.map(function(b){ return { name:b.name, totalNT:b.totalNT }; });
    if (!AppData._data.archived_periods) AppData._data.archived_periods = {};
    AppData._data.archived_periods[c.id] = {
      id: c.id, name: c.name, theme: c.theme, emoji: c.emoji,
      date: c.date, people: c.people, location: c.location, desc: c.desc,
      highlights: c.highlights, builders: c.builders, tasks: c.tasks,
      budget: c.budget, milestones: c.milestones, schedule: c.schedule,
      archivedAt: new Date().toISOString(), archivedBy: CURRENT_USER
    };
    c.status = 'archived';
    c.closedAt = new Date().toISOString();
    (c.tasks||[]).forEach(function(t){
      (t.claimants||[]).forEach(function(cl){
        if (cl.status==='approved') { cl.status = 'expired'; cl.expiredAt = today(); }
      });
    });
    _saveCamp(c);
    logActivity('camp_close', CURRENT_USER+' 完结了「'+c.name+'」');
    showToast('📁 营队已归档','ok');
    closeOverlay('overlayCampHome');
    renderCommunityHub();
    // 触发结营仪式
    setTimeout(function() { playCloseCeremony(c.id); }, 400);
  });
}

function _saveCamp(c) {
  if (!window.AppData) return;
  if (!AppData._data.camps) AppData._data.camps = {};
  AppData._data.camps[c.id] = c;
  if (typeof AppData._saveShared === 'function') AppData._saveShared();
}
// ── 阶段6: 完结本期 + 归档 ──
function closePeriod() {
  var c = getCampData(); if (!c) return;
  if (c.status === 'archived') { showToast('本期已完结', 'warn'); return; }
  if (!confirm('确定完结本期「'+c.name+'」？\n\n此操作不可撤销。完结后所有任务不可再结算。')) return;

  var builders = (c.builders||[]).slice().sort(function(a,b){ return b.totalNT - a.totalNT; });
  c._prevRank = builders.map(function(b){ return { name:b.name, totalNT:b.totalNT }; });

  if (!window.AppData) { showToast('系统错误：AppData 未加载', 'error'); return; }
  if (!AppData._data.archived_periods) AppData._data.archived_periods = {};
  AppData._data.archived_periods[c.id] = {
    id: c.id, name: c.name, season: c.season, theme: c.theme, emoji: c.emoji,
    date: c.date, people: c.people, location: c.location, desc: c.desc,
    highlights: c.highlights, builders: c.builders, tasks: c.tasks,
    budget: c.budget, milestones: c.milestones, schedule: c.schedule,
    archivedAt: new Date().toISOString(), archivedBy: CURRENT_USER
  };

  c.status = 'archived';
  c.closedAt = new Date().toISOString();
  c.closedBy = CURRENT_USER;
  AppData._saveShared();

  (c.tasks||[]).forEach(function(t) {
    if (t.status !== '已结算' && t.status !== '待结算') {
      t.status = '已过期';
      t.closedAt = new Date().toISOString();
    }
  });

  if (typeof logActivity === 'function') logActivity('camp_close', CURRENT_USER + ' 完结了「' + c.name + '」');
  showToast('📁 营队已归档', 'ok');

  if (typeof renderCommunityHub === 'function') renderCommunityHub();

  setTimeout(function() {
    playCloseCeremony(c.id);
  }, 400);
}

function openCampReport(campId) {
  _campCurrentId = campId;
  var c = getCampData(); if (!c) return;
  document.getElementById('campReportTitle').textContent = '结营报告';
  renderCampReport(document.getElementById('campReportBody'), c);
  document.getElementById('overlayCampReport').classList.add('open');
}

// ── 阶段6: 敬字亭结营仪式动画 ──
var _closeTL = null;

function playCloseCeremony(campId) {
  document.getElementById('overlayCampHome').classList.remove('open');
  var layer = document.getElementById('campCloseLayer');
  var content = document.getElementById('closeCeremonyContent');
  layer.style.display = 'flex';
  document.getElementById('closeCeremonySkip').style.display = 'block';

  content.innerHTML =
    '<div id="jzt" style="position:relative;opacity:0">'+
      '<div style="width:100px;height:120px;background:linear-gradient(180deg,#8B7355,#6B5B3A);margin:0 auto;border-radius:4px 4px 0 0;position:relative">'+
        '<div style="position:absolute;top:-20px;left:-10px;right:-10px;height:20px;background:linear-gradient(180deg,#6B5B3A,#8B7355);border-radius:4px 4px 0 0"></div>'+
        '<div style="position:absolute;top:-40px;left:50%;transform:translateX(-50%);width:60px;height:40px;background:linear-gradient(180deg,#5B4B2A,#8B7355);border-radius:50% 50% 0 0"></div>'+
      '</div>'+
      '<div id="jzt-fire" style="position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);opacity:0">'+
        '<div id="jzt-fire-big" style="width:40px;height:50px;background:radial-gradient(ellipse at bottom, #ff6600, #ff3300, transparent);border-radius:50% 50% 20% 20%;animation:jztFireBig 0.8s ease-in-out infinite alternate"></div>'+
        '<div id="jzt-fire-small" style="width:20px;height:30px;background:radial-gradient(ellipse at bottom, #ffaa00, #ff6600, transparent);border-radius:50% 50% 20% 20%;margin:-30px auto 0;animation:jztFireSmall 0.5s ease-in-out infinite alternate"></div>'+
      '</div>'+
      '<div id="jzt-text" style="text-align:center;margin-top:40px">'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">以</span>'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">字</span>'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">入</span>'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">火</span>'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">，</span>'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">以</span>'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">志</span>'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">成</span>'+
        '<span style="display:inline-block;opacity:0;color:#ffcc80;font-size:1.1rem;font-weight:700">林</span>'+
      '</div>'+
      '<div id="jzt-particles" style="position:absolute;inset:0;opacity:0;pointer-events:none"></div>'+
      '<div id="jzt-report" style="text-align:center;margin-top:30px;opacity:0">'+
        '<div style="color:#a0c8a8;font-size:.72rem">数据报告已生成</div>'+
      '</div>'+
    '</div>';

  var particlesHtml = '';
  for (var i = 0; i < 20; i++) {
    particlesHtml += '<div class="jzt-particle" style="position:absolute;width:4px;height:4px;background:#ffcc00;border-radius:50%;top:35%;left:50%;opacity:0"></div>';
  }
  document.getElementById('jzt-particles').innerHTML = particlesHtml;

  if (_closeTL) _closeTL.kill();
  _closeTL = gsap.timeline({ onComplete: function() {
    setTimeout(function() {
      document.getElementById('closeCeremonySkip').style.display = 'none';
      var jztReport = document.getElementById('jzt-report');
      if (jztReport) {
        jztReport.innerHTML = '<div style="color:#a0c8a8;font-size:.72rem;margin-bottom:6px">火光照亮了这段旅程的记录</div>'+
          '<div style="color:rgba(160,200,168,.5);font-size:.58rem">数据报告已生成</div>';
      }
      setTimeout(function() {
        document.getElementById('campCloseLayer').style.display = 'none';
        openCampReport(campId);
      }, 1500);
    }, 500);
  }});

  _closeTL.from('#jzt', { y: 200, opacity: 0, duration: 0.8, ease: 'power2.out' });
  _closeTL.to('#jzt-fire', { opacity: 1, scale: 1.2, duration: 1.0 }, '-=0.3');
  _closeTL.from('#jzt-text span', { y: -20, opacity: 0, stagger: 0.08, duration: 0.8 }, '-=0.5');
  _closeTL.to('#jzt-fire', { opacity: 0, duration: 1.0 });
  var particles = document.querySelectorAll('.jzt-particle');
  particles.forEach(function(p, i) {
    var angle = Math.random() * Math.PI * 2;
    var dist = 40 + Math.random() * 80;
    var dx = Math.cos(angle) * dist;
    var dy = Math.sin(angle) * dist - 30;
    _closeTL.to(p, { x: dx, y: dy, opacity: 0.8, duration: 0.8, ease: 'power2.out' }, '-=0.8');
    _closeTL.to(p, { opacity: 0, duration: 0.4 }, '-=0.2');
  });
  _closeTL.from('#jzt-report', { opacity: 0, y: 10, duration: 0.6 }, '-=0.3');
}

function skipCloseCeremony() {
  if (_closeTL) _closeTL.progress(1);
}

// ── 阶段6: 结营报告页 ──
function renderCampReport(el, c) {
  if (!c) { c = getCampData(); if (!c) return; }

  var tasks = c.tasks || [];
  var doneTasks = tasks.filter(function(t){ return t.status==='已结算'; });
  var doneCount = doneTasks.length;
  var pct = tasks.length ? Math.round(doneCount/tasks.length*100) : 0;
  var totalNT = doneTasks.reduce(function(s,t){ return s+(t.nt||0); }, 0);

  var budget = c.budget || {};
  var people = (budget.adventurers||0)+(budget.builders||0) || c.people || 0;
  var days = (c.schedule||[])[0] ? ((c.schedule[0].cells||[]).length||8) : 8;
  var totalRMB = (budget.lodgingRmb||0)*people*days + (budget.mealRmb||0)*people*days;

  var builders = (c.builders||[]).slice().sort(function(a,b){ return b.totalNT - a.totalNT; });
  var top5 = builders.slice(0, 5);
  var medals = ['🥇','🥈','🥉'];

  var archivedPeriods = (window.AppData && AppData._data.archived_periods) ? Object.values(AppData._data.archived_periods) : [];

  var h = '<div style="padding:14px">';

  h += '<div style="text-align:center;padding:20px 0;border-bottom:1px solid #d0d9ce;margin-bottom:16px">';
  h += '<div style="font-size:2rem;margin-bottom:8px">🏕️</div>';
  h += '<div style="font-weight:700;font-size:.95rem">'+c.name+'</div>';
  h += '<div style="font-size:.7rem;color:#5a6e5c;margin-top:4px">'+c.date+'</div>';
  h += '<div style="font-size:.72rem;color:#3d6b52;margin-top:2px">'+c.theme+'</div>';
  if (c.status === 'archived') h += '<div style="font-size:.58rem;color:#c8892e;margin-top:6px">📁 归档 · 只读</div>';
  h += '</div>';

  h += '<div style="font-weight:700;font-size:.72rem;margin-bottom:8px">📊 数据总览</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
  var stats = [
    { label:'参与人数', value:c.people+' 人' },
    { label:'完成任务', value:doneCount+' 项' },
    { label:'总 NT 发放', value:totalNT.toLocaleString()+' NT' },
    { label:'总 RMB 支出', value:'¥'+totalRMB.toLocaleString() },
    { label:'完成率', value:pct+'%' },
    { label:'人均 NT', value:people?Math.round(totalNT/people)+' NT':totalNT+' NT' }
  ];
  stats.forEach(function(s) {
    h += '<div style="background:#fff;border-radius:10px;padding:12px;text-align:center">';
    h += '<div style="font-size:.55rem;color:#5a6e5c;margin-bottom:4px">'+s.label+'</div>';
    h += '<div style="font-weight:700;font-size:.78rem;color:#1d2e24">'+s.value+'</div>';
    h += '</div>';
  });
  h += '</div>';

  h += '<div style="font-weight:700;font-size:.72rem;margin-bottom:8px">🏆 贡献榜</div>';
  if (!top5.length) {
    h += '<div style="text-align:center;padding:20px;color:#5a6e5c;font-size:.65rem">暂无排名数据</div>';
  } else {
    top5.forEach(function(b, i) {
      var medal = i < 3 ? medals[i]+' ' : '    ';
      h += '<div style="display:flex;align-items:center;padding:6px 0;font-size:.68rem;border-bottom:1px dotted #f0f0f0">'+
        '<span style="width:40px">'+medal+'</span>'+
        '<span style="width:20px;text-align:center;font-weight:700;color:'+(i<3?'#c8892e':'#5a6e5c')+'">'+(i+1)+'.</span>'+
        '<span style="flex:1">'+b.name+'</span>'+
        '<span style="color:var(--green-primary);font-weight:600;width:60px;text-align:right">'+b.totalNT+' NT</span>'+
        '<span style="color:#5a6e5c;width:40px;text-align:right">'+b.taskNames.length+'项</span>'+
      '</div>';
    });
  }

  h += '<div style="font-weight:700;font-size:.72rem;margin:16px 0 8px">🖼️ 活动照片</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
  for (var pi = 0; pi < 4; pi++) {
    h += '<div style="aspect-ratio:1;background:#f5f3ef;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#d0d9ce">🖼️</div>';
  }
  h += '</div>';

  if (archivedPeriods.length > 0) {
    h += '<div style="font-weight:700;font-size:.72rem;margin-bottom:8px">📋 历期展览汇总</div>';
    h += '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch">';
    archivedPeriods.forEach(function(ap) {
      if (ap.id === c.id) return;
      h += '<div style="flex-shrink:0;width:140px;background:#fff;border-radius:10px;padding:10px;cursor:pointer" onclick="openCampReport(\''+ap.id+'\')">'+
        '<div style="font-size:.65rem;font-weight:600">'+(ap.emoji||'🏕️')+' '+ap.name+'</div>'+
        '<div style="font-size:.55rem;color:#5a6e5c;margin:4px 0">'+ap.date+' · '+(ap.people||0)+'人</div>'+
        '<div style="font-size:.52rem;color:var(--green-primary)">查看报告 →</div>'+
      '</div>';
    });
    h += '</div>';
  }

  if (c.status !== 'archived') {
    h += '<div style="margin-top:16px"><button class="btn-pri btn-full" onclick="exportCampReport()">📥 导出结项报告</button></div>';
  } else {
    h += '<div style="margin-top:16px"><button class="btn-pri btn-full" style="background:#5a6e5c" onclick="showToast(\'已归档营期不支持导出\',\'warn\')">📜 查看日志</button></div>';
  }

  h += '</div>';
  el.innerHTML = h;
}

// ── 阶段6: 导出结项报告 ──
function exportCampReport() {
  var c = getCampData(); if (!c) return;

  var tasks = c.tasks || [];
  var doneTasks = tasks.filter(function(t){ return t.status==='已结算'; });
  var totalNT = doneTasks.reduce(function(s,t){ return s+(t.nt||0); }, 0);
  var builders = (c.builders||[]).slice().sort(function(a,b){ return b.totalNT - a.totalNT; });
  var top3 = builders.slice(0, 3);

  var md = '# ' + c.name + ' · 结项报告\n\n';
  md += '## 基本信息\n';
  md += '- 日期：' + c.date + '\n';
  md += '- 主题：' + c.theme + '\n';
  md += '- 参与人数：' + (c.people||0) + ' 人\n';
  md += '- 完成任务：' + doneTasks.length + ' 项\n\n';

  md += '## 数据总览\n';
  md += '- 总 NT 发放：' + totalNT.toLocaleString() + ' NT\n';
  md += '- 完成率：' + (tasks.length?Math.round(doneTasks.length/tasks.length*100):0) + '%\n\n';

  md += '## 贡献榜\n';
  top3.forEach(function(b, i) {
    md += (i+1) + '. ' + b.name + ' — ' + b.totalNT + ' NT — ' + b.taskNames.length + ' 项\n';
  });
  md += '\n## 活动照片\n（待上传）\n\n';
  md += '---\n*报告由南塘云村自动生成 · ' + new Date().toISOString().slice(0,10) + '*';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(md).then(function() {
      showToast('✅ 报告已复制到剪贴板', 'ok');
    }).catch(function() {
      downloadMd(md, c.name);
    });
  } else {
    downloadMd(md, c.name);
  }
}

function downloadMd(text, name) {
  var blob = new Blob([text], { type: 'text/markdown' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (name||'结项报告') + '_结项报告.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥 报告已下载', 'ok');
}

// ── 阶段6: 档案室 📦 往期营期 ──
function renderArchivePeriods(el) {
  var archived = [];
  if (window.AppData && AppData._data.archived_periods) {
    archived = Object.values(AppData._data.archived_periods);
  }
  var archivedCamps = getCamps().filter(function(c){ return c.status==='archived'; });
  archivedCamps.forEach(function(ac) {
    if (!archived.some(function(a){ return a.id===ac.id; })) archived.push(ac);
  });

  var h = '<div style="padding:14px">';
  if (!archived.length) {
    h += '<div style="text-align:center;padding:40px;color:#5a6e5c">'+
      '<div style="font-size:2rem;margin-bottom:8px">📦</div>'+
      '<div style="font-size:.7rem">暂无完结营期</div>'+
      '<div style="font-size:.6rem;color:#aaa;margin-top:4px">完结营期后将在此处归档</div>'+
    '</div>';
  } else {
    archived.forEach(function(ap) {
      var taskCount = (ap.tasks||[]).length;
      var doneCount = (ap.tasks||[]).filter(function(t){ return t.status==='已结算'; }).length;
      h += '<div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer" onclick="openCampReport(\''+ap.id+'\')">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
          '<span style="font-size:1.5rem">'+(ap.emoji||'🏕️')+'</span>'+
          '<div style="flex:1"><div style="font-weight:700;font-size:.75rem">'+ap.name+'</div><div style="font-size:.6rem;color:#5a6e5c">'+ap.date+' · '+ap.people+'人 · '+doneCount+'/'+taskCount+'项</div></div>'+
        '</div>'+
        '<div style="text-align:right;font-size:.6rem;color:var(--green-primary)">查看报告 →</div>'+
      '</div>';
    });
  }
  h += '</div>';
  el.innerHTML = h;
}

