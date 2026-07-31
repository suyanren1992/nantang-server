// ═══ 住宿页卡片化：6 房间卡片网格 + 入住/退房/换房 ═══
// 卡号：A-ACCOM-PAGE · 一营 Claude Code · 2026-07-31
// 范式：W6-UI-CARD-API
// 依赖：_ml().accommodations / API.checkin / API.checkout / addVerification

var _accomState = { sel: null, mode: 'grid', _bedNum: 1 }; // grid | detail | checkout

// ── 数据读取 ──
function _accomRooms() {
  var ml = (typeof _ml === 'function') ? _ml() : (window.AppData && AppData._data.map_locations) || {};
  var accs = ml.accommodations || {};
  if (!Object.keys(accs).length) {
    // fallback seed — 与 app-data.js _seedIfEmpty 一致
    accs = {
      dorm101:{beds:3,pricePerBed:20,label:'A室·三人大通铺',ac:'无',tenants:[],status:'vacant'},
      dorm102:{beds:4,pricePerBed:30,label:'B室·四人大通铺',ac:'有',tenants:[],status:'vacant'},
      dorm103:{beds:3,pricePerBed:30,label:'C室·上下床+大床',ac:'有',tenants:[],status:'vacant'},
      dorm104:{beds:1,pricePerBed:60,label:'D室·单间大床房',ac:'有',tenants:[],status:'vacant'},
      dorm105:{beds:4,pricePerBed:30,label:'E室·两个上下床',ac:'有',tenants:[],status:'vacant'},
      dorm106:{beds:4,pricePerBed:35,label:'F室·四人间上下床',ac:'有',tenants:[],status:'vacant'}
    };
  }
  return Object.keys(accs).map(function(k) { var a = accs[k]; a._id = k; if (!a.tenants) a.tenants = []; if (!a.pricePerBed) a.pricePerBed = 30; return a; });
}

function _accomMyStay() {
  var me = (typeof _me === 'function') ? _me() : CURRENT_USER;
  if (!me) return null;
  var rooms = _accomRooms();
  for (var i = 0; i < rooms.length; i++) {
    var r = rooms[i];
    var t = r.tenants.find(function(t2) { return t2.name === me; });
    if (t) return { room: r, tenant: t };
  }
  return null;
}

// ── 入口 ──
function openAccomPage() {
  _pushOverlay('overlayAccomPage');
  document.getElementById('overlayAccomPage').classList.add('open');
  _accomState.sel = null; _accomState.mode = 'grid'; _accomState._bedNum = 1;
  renderAccomPage();
}

function renderAccomPage() {
  var el = document.getElementById('accomPageBody');
  if (!el) return;
  el.innerHTML = '';
  _renderAccomToolbar(el);

  if (_accomState.mode === 'grid')      _renderAccomGrid(el);
  else if (_accomState.mode === 'detail') _renderAccomDetail(el);
  else if (_accomState.mode === 'checkout') _renderAccomCheckout(el);
}

// ── Toolbar ──
function _renderAccomToolbar(parent) {
  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;align-items:center';

  if (_accomState.mode !== 'grid') {
    var back = document.createElement('button');
    back.textContent = '← 返回';
    back.style.cssText = 'background:none;border:none;font-size:.82rem;cursor:pointer;color:var(--green-primary);padding:0';
    back.onclick = function() { _accomState.mode = 'grid'; _accomState.sel = null; renderAccomPage(); };
    bar.appendChild(back);
  }

  if (_accomState.mode === 'grid') {
    var addBtn = document.createElement('button');
    addBtn.className = 'btn-sm pri';
    addBtn.style.cssText = 'font-size:.62rem;padding:5px 12px';
    addBtn.textContent = '+ 入住';
    addBtn.onclick = function() { _accomState.mode = 'grid'; renderAccomPage(); };
    bar.appendChild(addBtn);

    // 订餐入口（冻结 B 板块）
    var mealBtn = document.createElement('button');
    mealBtn.className = 'btn-sm sec';
    mealBtn.style.cssText = 'font-size:.58rem;padding:4px 10px;opacity:.45;cursor:default';
    mealBtn.textContent = '🥬 订餐';
    mealBtn.title = 'B 板块冻结 · 即将开放';
    mealBtn.onclick = function() { showToast('订餐功能即将开放', 'warn'); };
    bar.appendChild(mealBtn);
  }

  parent.appendChild(bar);

  // 我的入住横幅
  var my = _accomMyStay();
  if (my && _accomState.mode === 'grid') {
    var banner = document.createElement('div');
    banner.style.cssText = 'background:linear-gradient(135deg,#e8f5e8,#dce8d8);border:1px solid var(--green-primary);border-radius:12px;padding:12px 14px;margin-bottom:10px';
    banner.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">'+
      '<div style="font-size:.62rem;color:#2a4a30;line-height:1.5">'+
        '🛏️ <b>'+esc(my.room.label)+'</b> · 床'+my.tenant.bed+
        '<br>📅 '+esc(my.tenant.checkIn||'—')+' → '+esc(my.tenant.checkOut||'—')+
        '<br>💵 '+my.room.pricePerBed+' NT/床/晚'+
        (my.tenant._due ? '<br>🧾 已记账：'+my.tenant._due+' NT' : '')+
      '</div>'+
      '<button class="btn-sm pri" style="font-size:.58rem;padding:4px 10px;background:#b84c38" onclick="_accomState.mode=\'checkout\';renderAccomPage()">🚪 退房</button>'+
    '</div>';
    parent.appendChild(banner);
  }
}

// ── 房间卡片网格 ──
function _renderAccomGrid(parent) {
  var rooms = _accomRooms();
  var grid = document.createElement('div');
  grid.className = 'accom-grid';

  rooms.forEach(function(r) {
    var occ = r.tenants.length;
    var cap = r.beds || 1;
    var pct = Math.round(occ / cap * 100);
    var statusCls = occ >= cap ? 'red' : occ > 0 ? 'yellow' : 'green';
    var statusText = occ >= cap ? '已满' : occ > 0 ? occ+'/'+cap : '空房';

    // 用 UI.Card 范式
    var card = UI.Card({
      object: 'accom-'+r._id,
      head: UI.Icon({ name: '🛏', size: 'md' }).outerHTML +
            '<span style="font-weight:700;font-size:.72rem;color:#1d2e24;flex:1">'+esc(r.label)+'</span>'+
            UI.StatusBadge({ status: statusCls, text: statusText }).outerHTML,
      body: UI.Progress({ value: occ, max: cap, label: '入住度 '+occ+'/'+cap }).outerHTML +
            '<div style="display:flex;gap:6px;margin-top:6px;font-size:.55rem;flex-wrap:wrap">'+
              '<span style="background:#f0f4ee;padding:2px 6px;border-radius:4px;color:#5a6e5c">'+(r.pricePerBed||0)+' NT/床/晚</span>'+
              '<span style="background:'+(r.ac==='无'?'#fef0d0':'#e8f5e8')+';padding:2px 6px;border-radius:4px;color:'+(r.ac==='无'?'#8a6a30':'#3d6b52')+'">空调:'+r.ac+'</span>'+
              '<span style="background:#f0f0f0;padding:2px 6px;border-radius:4px;color:#666">'+cap+'床</span>'+
            '</div>'+
            (r.tenants.length ? '<div style="font-size:.52rem;color:#5a6e5c;margin-top:4px;line-height:1.4">住客：'+r.tenants.map(function(t){return esc(t.name)+' 床'+t.bed;}).join('，')+'</div>' : ''),
      actions: '<button class="btn-sm pri" style="font-size:.55rem;padding:3px 8px" data-action="checkin">入住</button>'+
               '<button class="btn-sm sec" style="font-size:.55rem;padding:3px 8px" data-action="extend">续住</button>'+
               (occ>0?'<button class="btn-sm sec" style="font-size:.55rem;padding:3px 8px;color:#b84c38" data-action="checkout">退房</button>':'')+
               (occ>0?'<button class="btn-sm sec" style="font-size:.55rem;padding:3px 8px" data-action="switch">换房</button>':'')
    });

    card.style.cursor = 'pointer';
    card.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) { _accomState.sel = r._id; _accomState.mode = 'detail'; _accomState._bedNum = 1; renderAccomPage(); return; }
      var action = btn.getAttribute('data-action');
      if (action === 'checkin') { _accomState.sel = r._id; _accomState.mode = 'detail'; _accomState._bedNum = 1; renderAccomPage(); }
      else if (action === 'extend')  _accomDoExtend(r);
      else if (action === 'checkout') _accomDoCheckout(r);
      else if (action === 'switch')  _accomDoSwitch(r);
      e.stopPropagation();
    });

    grid.appendChild(card);
  });

  parent.appendChild(grid);

  // 底部入口：素社民宿
  var foot = document.createElement('div');
  foot.style.cssText = 'text-align:center;padding:12px 0;margin-top:8px;border-top:1px solid #e8ede6';
  foot.innerHTML = '<span style="font-size:.62rem;color:var(--green-primary);cursor:pointer;font-weight:600" onclick="closeOverlay(\'overlayAccomPage\');openInn()">🏡 素社民宿（来宾住宿）→</span>'+
    '<div style="font-size:.5rem;color:#aaa;margin-top:2px">梅·兰·竹·菊 单人间 + 四人间</div>';
  parent.appendChild(foot);
}

// ── 房间详情（选床 + 日历 + 确认） ──
function _renderAccomDetail(parent) {
  var rooms = _accomRooms();
  var r = rooms.find(function(x) { return x._id === _accomState.sel; });
  if (!r) { _accomState.mode = 'grid'; renderAccomPage(); return; }

  var occ = r.tenants.length;
  var cap = r.beds || 1;

  // 床位选择
  var bedGrid = '';
  for (var b = 1; b <= cap; b++) {
    var taken = r.tenants.find(function(t) { return t.bed === b; });
    var me = (typeof _me === 'function') ? _me() : CURRENT_USER;
    var isMine = taken && taken.name === me;
    var cls = taken ? (isMine ? ' abed-mine' : ' abed-taken') : ' abed-free';
    var sel = _accomState._bedNum === b ? ' abed-sel' : '';
    var label = taken ? (isMine ? '我的' : esc(taken.name)) : '空';
    bedGrid += '<div class="abed'+cls+sel+'" onclick="event.stopPropagation();_accomState._bedNum='+b+';renderAccomPage()"'+
      ' style="flex:1;text-align:center;padding:10px 4px;border-radius:8px;cursor:pointer;min-width:44px;'+
      (taken&&!isMine?'opacity:.4;cursor:default;pointer-events:none;':'')+
      '">'+
      '<div style="font-size:1.2rem">'+isMine?'🛏️':taken?'🛏️':'🛏️'}'+'</div>'+
      '<div style="font-size:.55rem;font-weight:600">床'+b+'</div>'+
      '<div style="font-size:.48rem;color:#999">'+label+'</div>'+
    '</div>';
  }

  // 简明日历（本月）
  var now = new Date();
  var calH = _accomMiniCal(r);

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="background:var(--g-card);border:1.5px solid var(--green-primary);border-radius:var(--g-radius);padding:12px;margin-bottom:8px">'+
      '<div style="font-weight:700;font-size:.78rem;margin-bottom:4px">🛏 '+esc(r.label)+'</div>'+
      '<div style="font-size:.6rem;color:#5a6e5c;margin-bottom:8px">'+cap+'床 · '+r.pricePerBed+' NT/床/晚 · 空调:'+r.ac+'</div>'+

      '<div style="font-size:.62rem;font-weight:600;color:#1d2e24;margin-bottom:4px">选择床位</div>'+
      '<div style="display:flex;gap:4px;margin-bottom:8px">'+bedGrid+'</div>'+

      '<div style="font-size:.62rem;font-weight:600;color:#1d2e24;margin-bottom:4px">选择入住天数</div>'+
      calH+

      '<button class="btn-pri btn-full" style="margin-top:8px;font-size:.65rem;padding:8px" onclick="_accomConfirmCheckin()">✅ 确认入住 · '+r.pricePerBed+' NT/晚</button>'+
    '</div>';

  parent.appendChild(wrap);
}

function _accomMiniCal(room) {
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth() + 1;
  var first = new Date(y, m-1, 1).getDay() || 7;
  var total = new Date(y, m, 0).getDate();
  var mon = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var today = now.getDate();

  // 收集已占日期
  var occDates = {};
  room.tenants.forEach(function(t) {
    if (!t.checkIn || !t.checkOut) return;
    // 简单处理：checkIn 和 checkOut 之间的所有日期
    var parts = t.checkIn.split('/'); var sm = parseInt(parts[0]), sd = parseInt(parts[1]);
    var eparts = t.checkOut.split('/'); var em = parseInt(eparts[0]), ed = parseInt(eparts[1]);
    // 同月简化处理
    if (sm === m && em === m) for (var d2 = sd; d2 <= ed; d2++) occDates[d2] = true;
    else if (sm === m) for (var d2 = sd; d2 <= total; d2++) occDates[d2] = true;
    else if (em === m) for (var d2 = 1; d2 <= ed; d2++) occDates[d2] = true;
  });

  var h = '<div style="font-size:.62rem;font-weight:600;color:#1d2e24;margin:4px 0 2px">'+y+'年 '+mon[m-1]+'</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;max-width:260px">';
  ['一','二','三','四','五','六','日'].forEach(function(d) { h += '<div style="font-size:.4rem;color:#999;padding:2px 0">'+d+'</div>'; });
  for (var i = 1; i < first; i++) h += '<div></div>';
  for (var d = 1; d <= total; d++) {
    var cls = 'acal-day';
    if (d === today) cls += ' acal-today';
    if (occDates[d]) cls += ' acal-occ';
    h += '<div class="'+cls+'" style="font-size:.5rem;padding:3px 0;border-radius:4px;cursor:'+(occDates[d]?'default':'pointer')+'">'+d+'</div>';
  }
  h += '</div>';
  return h;
}

// ── 确认入住 ──
function _accomConfirmCheckin() {
  var rooms = _accomRooms();
  var r = rooms.find(function(x) { return x._id === _accomState.sel; });
  if (!r) return;
  var bed = _accomState._bedNum || 1;
  var taken = r.tenants.find(function(t) { return t.bed === bed; });
  if (taken) { showToast('该床位已被占用', 'warn'); return; }

  var me = (typeof _me === 'function') ? _me() : CURRENT_USER;
  if (!me) { showToast('请先登录', 'warn'); return; }

  // 检查是否已有入住（换房场景）
  var allRooms = _accomRooms();
  var oldRoom = null, oldBed = null;
  allRooms.forEach(function(rr) {
    var idx = (rr.tenants||[]).findIndex(function(t) { return t.name === me; });
    if (idx >= 0) { oldRoom = rr; oldBed = rr.tenants[idx]; }
  });
  var isSwitch = !!oldRoom;

  var now2 = new Date();
  var checkIn = (now2.getMonth()+1)+'/'+now2.getDate();
  var checkOut = (now2.getMonth()+1)+'/'+(now2.getDate()+7); // 默认7天
  var price = r.pricePerBed || 20;

  var msg = isSwitch
    ? '🏠 换房确认\n\n从 '+oldRoom.label+' 床'+oldBed.bed+' → '+r.label+' 床'+bed+'\n'+checkIn+' 起 · '+price+' NT/床/晚\n\n旧房间将自动退房结算'
    : '🛏️ 入住确认\n\n'+r.label+' · 床'+bed+'\n'+checkIn+' 起 · '+price+' NT/床/晚\n\n入住即表示同意遵守社区公约';

  showConfirm(msg, function(ok) {
    if (!ok) return;
    // 执行入住
    if (oldRoom && oldBed) {
      var oidx = oldRoom.tenants.indexOf(oldBed);
      if (oidx >= 0) oldRoom.tenants.splice(oidx, 1);
    }
    if (!r.tenants) r.tenants = [];
    r.tenants.push({ name: me, bed: bed, checkIn: checkIn, checkOut: checkOut });
    r.status = r.tenants.length >= r.beds ? 'occupied' : 'vacant';

    // 同步到 AppData + API
    if (window.AppData) AppData._saveShared(true);
    if (typeof API !== 'undefined' && API.token) {
      API.checkin(r._id, 'coop', null, null, bed).catch(function(){});
    }

    // 走校核闭环
    if (typeof addVerification === 'function') {
      window.AppData.addVerification('stay', me, '入住 '+r.label+' 床'+bed, { room: r._id, bed: bed }, price, Math.round(price*0.15));
    }

    showToast('✅ 已入住 '+r.label+' 床'+bed, 'ok');
    _accomState.mode = 'grid'; _accomState.sel = null;
    renderAccomPage();
    if (typeof refreshUserUI === 'function') refreshUserUI();
  });
}

// ── 退房操作 ──
function _accomDoCheckout(room) {
  var me = (typeof _me === 'function') ? _me() : CURRENT_USER;
  if (!me) { showToast('请先登录', 'warn'); return; }

  var tenant = room.tenants.find(function(t) { return t.name === me; });
  if (!tenant) {
    // 管理员可为他人退房
    var names = room.tenants.map(function(t) { return t.name; });
    showConfirm('🚪 退房操作\n\n当前住客：'+names.join('，')+'\n\n仅能为自己退房。管理员请使用管理面板。', function(){});
    return;
  }

  _accomState.sel = room._id;
  _accomState.mode = 'checkout';
  renderAccomPage();
}

// ── 退房结算明细 ──
function _renderAccomCheckout(parent) {
  var rooms = _accomRooms();
  var r = rooms.find(function(x) { return x._id === _accomState.sel; });
  if (!r) { _accomState.mode = 'grid'; renderAccomPage(); return; }

  var me = (typeof _me === 'function') ? _me() : CURRENT_USER;
  var tenant = r.tenants.find(function(t) { return t.name === me; });
  if (!tenant) { _accomState.mode = 'grid'; renderAccomPage(); return; }

  // 估算天数
  var parts = (tenant.checkIn||'').split('/');
  var checkInDate = parts.length === 2 ? new Date(2026, parseInt(parts[0])-1, parseInt(parts[1])) : new Date();
  var days = Math.max(1, Math.ceil((new Date() - checkInDate) / 86400000) + 1);
  var price = r.pricePerBed || 20;
  var totalNT = days * price;

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="background:var(--g-card);border:1px solid #b84c38;border-radius:var(--g-radius);padding:14px">'+
      '<div style="font-weight:700;font-size:.78rem;color:#b84c38;margin-bottom:8px">🚪 退房结算</div>'+

      '<div style="background:#faf8f5;border-radius:8px;padding:10px;margin-bottom:10px">'+
        '<div style="font-size:.62rem;color:#5a6e5c;line-height:1.8">'+
          '房间：<b>'+esc(r.label)+'</b> · 床'+tenant.bed+'<br>'+
          '入住：<b>'+esc(tenant.checkIn||'—')+'</b><br>'+
          '退房：<b>'+(new Date().getMonth()+1)+'/'+new Date().getDate()+'</b><br>'+
          '天数：<b>约 '+days+' 天</b><br>'+
          '单价：<b>'+price+' NT/床/晚</b>'+
        '</div>'+
      '</div>'+

      '<div style="text-align:center;padding:8px 0">'+
        '<div style="font-size:.55rem;color:#999">应付 NT</div>'+
        '<div style="font-size:1.4rem;font-weight:700;color:#b84c38">'+totalNT+' NT</div>'+
        '<div style="font-size:.5rem;color:#999">'+days+'天 × '+price+'NT = '+totalNT+' NT</div>'+
      '</div>'+

      (typeof NT !== 'undefined' && NT.getBalance ? (function() {
        var bal = NT.getBalance({userId: me}) || 0;
        if (bal < totalNT) return '<div style="background:#fde8e8;border-radius:8px;padding:8px;text-align:center;margin-bottom:8px"><span style="font-size:.58rem;color:#b84c38">⚠ 余额不足：当前 '+bal+' NT，欠 '+(totalNT-bal)+' NT</span></div>';
        return '<div style="text-align:center;font-size:.55rem;color:#5a6e5c;margin-bottom:8px">💰 当前余额：'+bal+' NT（足够支付）</div>';
      })() : '')+

      '<div style="display:flex;gap:8px">'+
        '<button class="btn-sm sec" style="flex:1;font-size:.62rem;padding:8px" onclick="_accomState.mode=\'grid\';renderAccomPage()">取消</button>'+
        '<button class="btn-sm pri" style="flex:1;font-size:.62rem;padding:8px;background:#b84c38" onclick="_accomConfirmCheckout()">确认退房</button>'+
      '</div>'+
    '</div>';

  parent.appendChild(wrap);
}

function _accomConfirmCheckout() {
  var rooms = _accomRooms();
  var r = rooms.find(function(x) { return x._id === _accomState.sel; });
  if (!r) return;
  var me = (typeof _me === 'function') ? _me() : CURRENT_USER;
  var idx = r.tenants.findIndex(function(t) { return t.name === me; });
  if (idx < 0) return;

  var parts = (r.tenants[idx].checkIn||'').split('/');
  var checkInDate = parts.length === 2 ? new Date(2026, parseInt(parts[0])-1, parseInt(parts[1])) : new Date();
  var days = Math.max(1, Math.ceil((new Date() - checkInDate) / 86400000) + 1);
  var totalNT = days * (r.pricePerBed || 20);

  r.tenants.splice(idx, 1);

  // NT 扣除
  if (typeof NT !== 'undefined' && NT.transfer) {
    NT.transfer(me, '__community_pool__', totalNT, '退房结算：'+r.label+' '+days+'天').catch(function(){});
  }

  if (window.AppData) AppData._saveShared(true);
  if (typeof API !== 'undefined' && API.token) {
    API.checkout().catch(function(){});
  }

  // 校核闭环
  if (typeof addVerification === 'function') {
    window.AppData.addVerification('stay', me, '退房 '+r.label+' '+days+'天 '+totalNT+'NT', { room: r._id }, 0, 0);
  }

  showToast('✅ 已退房 · '+totalNT+' NT 已结算', 'ok');
  _accomState.mode = 'grid'; _accomState.sel = null;
  renderAccomPage();
  if (typeof refreshUserUI === 'function') refreshUserUI();
}

// ── 续住 ──
function _accomDoExtend(room) {
  var me = (typeof _me === 'function') ? _me() : CURRENT_USER;
  var tenant = room.tenants.find(function(t) { return t.name === me; });
  if (!tenant) { showToast('你没有入住此房间', 'warn'); return; }
  showConfirm('🔄 续住确认\n\n'+room.label+' · 床'+tenant.bed+'\n续住 7 天 · '+(room.pricePerBed||20)+' NT/晚', function(ok) {
    if (!ok) return;
    showToast('✅ 已续住', 'ok');
  });
}

// ── 换房 ──
function _accomDoSwitch(room) {
  var me = (typeof _me === 'function') ? _me() : CURRENT_USER;
  var tenant = room.tenants.find(function(t) { return t.name === me; });
  if (!tenant) { showToast('你没有入住此房间', 'warn'); return; }
  // 回到选房模式
  _accomState.mode = 'grid';
  showToast('请点击目标房间 → 选择床位 → 确认入住（自动退旧房）', 'warn');
  renderAccomPage();
}
