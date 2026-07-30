// ══ C-B-5: 素社民宿独立界面 ══
// 与合作社 _showStaySheet()（app.js）独立，一字不改合作社代码
// 复用 main.css .inn-* 样式 + index.html overlayInn/innBody 容器

var _inn = { rooms: null, status: null, calY: 0, calM: 0, start: null, end: null, sel: null, _tab: 'inn', _bedNum: 1 };

function openInn() {
  _pushOverlay('overlayInn'); document.getElementById('overlayInn').classList.add('open');
  var now = new Date(); _inn.calY = now.getFullYear(); _inn.calM = now.getMonth() + 1;
  _inn.start = null; _inn.end = null; _inn.sel = null; _inn._bedNum = 1; _inn._tab = 'inn';
  _innLoad();
}

function closeInn() {
  document.getElementById('overlayInn').classList.remove('open');
  document.getElementById('overlayCampHome').classList.add('open');
}

function _innSeed() {
  return [
    {id:'mei',label:'梅·单人间',room_type:'single',beds:1,rate:40,dietary:'vegetarian',status:'active',occupied_dates:[]},
    {id:'lan',label:'兰·单人间',room_type:'single',beds:1,rate:40,dietary:'vegetarian',status:'active',occupied_dates:[]},
    {id:'zhu',label:'竹·单人间',room_type:'single',beds:1,rate:40,dietary:'vegetarian',status:'active',occupied_dates:[]},
    {id:'ju',label:'菊·单人间',room_type:'single',beds:1,rate:40,dietary:'vegetarian',status:'active',occupied_dates:[]},
    {id:'quadA',label:'四人间A',room_type:'quad',beds:4,rate:25,dietary:'vegetarian',status:'active',occupied_dates:[]},
    {id:'quadB',label:'四人间B',room_type:'quad',beds:4,rate:25,dietary:'vegetarian',status:'active',occupied_dates:[]}
  ];
}

function _innLoad() {
  var n = 0; function chk() { n++; if (n >= 2) _innRender(); }
  if (typeof API !== 'undefined' && API.token) {
    API.innRooms().then(function(r) { _inn.rooms = (r && r.rooms && r.rooms.length) ? r.rooms : _innSeed(); chk(); }).catch(function() { _inn.rooms = _innSeed(); chk(); });
    API.accommodationStatus().then(function(r) { _inn.status = (r && r.tenant) ? r.tenant : null; chk(); }).catch(function() { chk(); });
  } else { _inn.rooms = _innSeed(); _innRender(); }
}

function _innRender() {
  var el = document.getElementById('innBody'); if (!el) return;
  var rooms = _inn.rooms || _innSeed();
  var stay = _inn.status;
  var todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));

  var h = '';
  // ── inline styles (follow _showStaySheet pattern) ──
  h += '<style>';
  h += '.inn-tabbar{display:flex;gap:0;margin-bottom:10px;border-radius:10px;overflow:hidden;border:1px solid #d0d9ce}';
  h += '.inn-tab{flex:1;text-align:center;padding:8px;font-size:.65rem;font-weight:600;cursor:pointer;background:#f0f4ee;color:#5a6e5c;transition:.12s;user-select:none}';
  h += '.inn-tab.on{background:var(--green-primary);color:#fff}';
  h += '.inn-room-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}';
  h += '.inn-rc{background:#fff;border:2px solid #d0d9ce;border-radius:12px;padding:12px 8px;text-align:center;cursor:pointer;transition:.12s}';
  h += '.inn-rc:active{transform:scale(.97)}.inn-rc.sel{border-color:var(--green-primary);box-shadow:0 0 0 2px var(--green-primary)}';
  h += '.inn-rc-icon{font-size:1.4rem}.inn-rc-label{font-size:.65rem;font-weight:700;color:#1d2e24;margin:4px 0 2px}';
  h += '.inn-rc-meta{font-size:.52rem;color:#5a6e5c}.inn-rc-occ{font-size:.5rem;font-weight:600;margin-top:3px;padding:2px 8px;border-radius:8px;display:inline-block}';
  h += '.inn-rc-occ.avail{background:#e8f5e8;color:var(--green-primary)}.inn-rc-occ.partial{background:#fef8e8;color:#c8892e}.inn-rc-occ.full{background:#fde8e8;color:#b84c38}';
  h += '.inn-stay-banner{background:linear-gradient(135deg,#e8f5e8,#dce8d8);border:1px solid var(--green-primary);border-radius:12px;padding:12px 14px;margin-bottom:10px}';
  h += '.inn-stay-row{display:flex;justify-content:space-between;align-items:center}';
  h += '.inn-stay-info{font-size:.62rem;color:#2a4a30;line-height:1.5}.inn-stay-btn{font-size:.6rem;padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-weight:600}';
  h += '.inn-stay-btn.out{background:#b84c38;color:#fff}.inn-stay-btn.out:active{opacity:.85}';
  h += '.inn-booking{background:#fff;border:1.5px solid var(--green-primary);border-radius:12px;padding:12px;margin-bottom:10px;animation:fadeIn .2s}';
  h += '.inn-booking-title{font-size:.7rem;font-weight:700;color:#1d2e24;margin-bottom:2px}';
  h += '.inn-booking-sub{font-size:.55rem;color:#5a6e5c;margin-bottom:8px}';
  // calendar — copy pattern from _showStaySheet cal-* classes with inn- prefix
  h += '.inn-cal-month{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}';
  h += '.inn-cal-month-title{font-size:.68rem;font-weight:700;color:#1d2e24}';
  h += '.inn-cal-nav{font-size:.85rem;cursor:pointer;padding:4px 10px;border:none;background:#f0f0f0;border-radius:6px;color:#5a6e5c}';
  h += '.inn-cal-nav:active{background:#e0e0e0}';
  h += '.inn-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;max-width:290px;margin:0 auto}';
  h += '.inn-cal-dow{font-size:.45rem;color:#999;padding:3px 0}';
  h += '.inn-cal-day{width:100%;height:30px;display:flex;align-items:center;justify-content:center;font-size:.55rem;cursor:pointer;border-radius:6px;transition:.1s;user-select:none}';
  h += '.inn-cal-day:hover{background:#e8ece8}.inn-cal-day.other{color:#ccc;cursor:default}';
  h += '.inn-cal-day.start,.inn-cal-day.end{background:#2a4d3a!important;color:#fff!important;font-weight:800}';
  h += '.inn-cal-day.range{background:#d8ecd8}';
  h += '.inn-cal-day.today{box-shadow:inset 0 0 0 2px var(--green-primary)}';
  h += '.inn-cal-day.occupied{background:#fde8e8!important;color:#b84c38!important;cursor:not-allowed;text-decoration:line-through}';
  h += '.inn-date-row{display:flex;justify-content:space-between;padding:3px 0;font-size:.6rem;color:#5a6e5c}';
  h += '.inn-date-row b{color:#1d2e24}';
  h += '.inn-total{text-align:center;font-size:.78rem;font-weight:700;color:var(--green-primary);padding:6px 0}';
  h += '.inn-book-btn{width:100%;padding:10px;border-radius:10px;font-size:.68rem;font-weight:700;cursor:pointer;border:none;background:var(--green-primary);color:#fff;transition:.12s}';
  h += '.inn-book-btn:active{transform:scale(.97)}.inn-book-btn:disabled{opacity:.5;cursor:default}';
  h += '.inn-reset-link{text-align:center;padding:6px;font-size:.55rem;color:var(--green-primary);cursor:pointer;user-select:none}';
  h += '@keyframes fadeIn{from{opacity:0}to{opacity:1}}';
  h += '</style>';

  // ── Tab bar ──
  h += '<div class="inn-tabbar">';
  h += '<div class="inn-tab' + (!_inn._tab || _inn._tab === 'inn' ? ' on' : '') + '" onclick="_inn._tab=\'inn\';_innRender()">🏡 素社民宿</div>';
  h += '<div class="inn-tab' + (_inn._tab === 'coop' ? ' on' : '') + '" onclick="_inn._tab=\'coop\';_innCoop()">🛏️ 合作社住宿</div>';
  h += '</div>';

  if (_inn._tab === 'coop') {
    // 合作社 tab — 调 _showStaySheet（一字不改），先关 overlay
    h += '<div style="text-align:center;padding:20px;font-size:.65rem;color:#5a6e5c">点击下方按钮打开合作社住宿</div>';
    h += '<button class="inn-book-btn" style="background:#5a6e5c" onclick="document.getElementById(\'overlayInn\').classList.remove(\'open\');if(typeof _showStaySheet===\'function\')_showStaySheet()">🛏️ 打开合作社住宿</button>';
  } else {
    // ── 素社民宿 tab ──

    // Current stay banner
    var isInnStay = stay && stay.room_id && rooms.some(function(r) { return r.id === stay.room_id; });
    if (isInnStay) {
      var sr = rooms.find(function(r) { return r.id === stay.room_id; }) || {};
      h += '<div class="inn-stay-banner"><div class="inn-stay-row">';
      h += '<div class="inn-stay-info">🏡 <b>' + esc(sr.label || stay.room_id) + '</b>';
      h += '<br>🛏️ ' + (stay.bed_num || 1) + '床 · 📅 ' + (stay.checkin_date || '—') + '起';
      if (stay.check_out_date) h += ' → ' + stay.check_out_date;
      h += '<br>💵 ' + (stay.rate || sr.rate || 0) + ' NT/床/晚';
      if (stay.accommodation_due > 0) h += '<br>🧾 已记账：' + stay.accommodation_due + ' NT';
      if (stay.debt > 0) h += '<br>⚠ 欠费：' + stay.debt + ' NT';
      h += '</div><button class="inn-stay-btn out" onclick="_innCheckout()">🚪 退房</button>';
      h += '</div></div>';
    }

    // Room grid
    h += '<div class="inn-room-grid">';
    rooms.forEach(function(r) {
      var occ = r.occupied_dates || [];
      var full = occ.indexOf(todayStr) >= 0;
      var hasOcc = occ.length > 0;
      var occCls = full ? 'full' : (hasOcc ? 'partial' : 'avail');
      // C-B-5: 四人间显示可订床位数，单人间显示预订状态
      var occLabel;
      if (r.room_type === 'quad') {
        if (full && occ.length >= 30) occLabel = '近期全满';
        else if (full) occLabel = '今日已满（' + r.beds + '床）';
        else occLabel = '可订（' + r.beds + '床）';
      } else {
        occLabel = full ? '今日已满' : (hasOcc ? occ.length + '天有预订' : '可预订');
      }
      var sel = _inn.sel === r.id;
      var icon = r.room_type === 'quad' ? '🏠' : '🛏️';
      h += '<div class="inn-rc' + (sel ? ' sel' : '') + '" onclick="_innPick(\'' + r.id + '\')">';
      h += '<div class="inn-rc-icon">' + icon + '</div><div class="inn-rc-label">' + esc(r.label) + '</div>';
      h += '<div class="inn-rc-meta">' + r.beds + '床 · 💵' + r.rate + 'NT/晚</div>';
      h += '<div class="inn-rc-occ ' + occCls + '">' + occLabel + '</div>';
      h += '</div>';
    });
    h += '</div>';

    // Booking section (when room selected)
    if (_inn.sel) {
      var selRoom = rooms.find(function(r) { return r.id === _inn.sel; });
      if (selRoom) {
        h += '<div class="inn-booking">';
        h += '<div class="inn-booking-title">' + esc(selRoom.label) + '</div>';
        h += '<div class="inn-booking-sub">' + selRoom.beds + '床 · ' + selRoom.rate + 'NT/晚 · 🥬素食 · 选择入住日期</div>';
        // C-B-5: 四人间床位选择
        if (selRoom.room_type === 'quad') {
          var bedOpts = ''; for (var bi = 1; bi <= selRoom.beds; bi++) bedOpts += '<option value="' + bi + '"' + (_inn._bedNum === bi ? ' selected' : '') + '>' + bi + ' 床</option>';
          h += '<div style="margin-bottom:8px"><label style="font-size:.58rem;color:#5a6e5c;font-weight:600">🛏️ 床位数量</label><select onchange="_inn._bedNum=parseInt(this.value);_innRender()" style="width:100%;padding:8px;border:1px solid #d0d9ce;border-radius:8px;font-size:.72rem;margin-top:2px;background:#fff;color:#1d2e24">' + bedOpts + '</select></div>';
        }
        h += _innCal(selRoom);
        if (_inn.start) {
          var ci = _inn.start.y + '-' + String(_inn.start.m).padStart(2, '0') + '-' + String(_inn.start.d).padStart(2, '0');
          var days = (_inn.start && _inn.end) ? Math.ceil((new Date(_inn.end.y, _inn.end.m - 1, _inn.end.d) - new Date(_inn.start.y, _inn.start.m - 1, _inn.start.d)) / 86400000) + 1 : 0;
          h += '<div class="inn-date-row"><span>📅 入住</span><b>' + ci + '</b></div>';
          h += '<div class="inn-date-row"><span>📅 退房</span><b>' + (_inn.end ? _inn.end.y + '-' + String(_inn.end.m).padStart(2, '0') + '-' + String(_inn.end.d).padStart(2, '0') : '再次点击选择') + '</b></div>';
          if (days > 0) {
            var bedCount = _inn._bedNum || 1;
            var bedLabel2 = bedCount > 1 ? ' × ' + bedCount + '床' : '';
            h += '<div class="inn-total">💵 ' + days + '晚 × ' + selRoom.rate + 'NT' + bedLabel2 + ' = 约 ' + (days * selRoom.rate * bedCount) + ' NT</div>';
          }
          h += '<button class="inn-book-btn" ' + (days > 0 ? 'onclick="_innBook()"' : 'disabled') + '>✅ 确认预订</button>';
        }
        h += '<div class="inn-reset-link" onclick="_inn.sel=null;_inn.start=null;_inn.end=null;_innRender()">← 返回房型列表</div>';
        h += '</div>';
      }
    }
  }

  el.innerHTML = h;
}

function _innCoop() {
  // 延迟关闭 overlay 后调 _showStaySheet，避免 CSS 冲突
  document.getElementById('overlayInn').classList.remove('open');
  setTimeout(function() { if (typeof _showStaySheet === 'function') _showStaySheet(); }, 100);
}

function _innPick(id) { _inn.sel = id; _inn.start = null; _inn.end = null; _inn._bedNum = 1; _innRender(); }

function _innCal(room) {
  var y = _inn.calY, m = _inn.calM;
  var mon = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var dow = ['一','二','三','四','五','六','日'];
  var first = new Date(y, m - 1, 1).getDay() || 7;
  var total = new Date(y, m, 0).getDate();
  var todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
  var occ = {}; (room.occupied_dates || []).forEach(function(d) { occ[d] = true; });

  var h = '<div class="inn-cal-month">';
  h += '<button class="inn-cal-nav" onclick="_innCalShift(-1)">◀</button>';
  h += '<span class="inn-cal-month-title">' + y + '年 ' + mon[m - 1] + '</span>';
  h += '<button class="inn-cal-nav" onclick="_innCalShift(1)">▶</button>';
  h += '</div><div class="inn-cal-grid">';
  dow.forEach(function(d) { h += '<div class="inn-cal-dow">' + d + '</div>'; });
  for (var i = 1; i < first; i++) h += '<div class="inn-cal-day other"></div>';
  for (var d = 1; d <= total; d++) {
    var ds = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var cls = 'inn-cal-day';
    if (ds === todayStr) cls += ' today';
    if (occ[ds]) { cls += ' occupied'; }
    else if (_inn.start) {
      var cur = new Date(y, m - 1, d);
      var s = new Date(_inn.start.y, _inn.start.m - 1, _inn.start.d);
      if (cur.getTime() === s.getTime()) cls += ' start';
      if (_inn.end) { var e = new Date(_inn.end.y, _inn.end.m - 1, _inn.end.d);
        if (cur.getTime() === e.getTime()) cls += ' end';
        else if (cur > s && cur < e) cls += ' range';
      }
    }
    h += '<div class="' + cls + '"' + (occ[ds] ? '' : ' onclick="_innCalPick(' + y + ',' + m + ',' + d + ')"') + '>' + d + '</div>';
  }
  h += '</div><div style="text-align:center;padding:4px 0 0"><button class="inn-cal-nav" style="font-size:.5rem" onclick="_inn.start=null;_inn.end=null;_innRender()">⟳ 重置日期</button></div>';
  return h;
}

function _innCalShift(dir) { _inn.calM += dir; if (_inn.calM > 12) { _inn.calM = 1; _inn.calY++; } if (_inn.calM < 1) { _inn.calM = 12; _inn.calY--; } _innRender(); }

function _innCalPick(y, m, d) {
  if (!_inn.start || (_inn.start && _inn.end)) { _inn.start = { y: y, m: m, d: d }; _inn.end = null; }
  else { var cur = new Date(y, m - 1, d); var s = new Date(_inn.start.y, _inn.start.m - 1, _inn.start.d);
    if (cur < s) { _inn.start = { y: y, m: m, d: d }; _inn.end = null; }
    else _inn.end = { y: y, m: m, d: d }; }
  _innRender();
}

function _innBook() {
  if (!_inn.start || !_inn.end || !_inn.sel) return;
  var rooms = _inn.rooms || _innSeed();
  var room = rooms.find(function(r) { return r.id === _inn.sel; }); if (!room) return;
  var ci = _inn.start.y + '-' + String(_inn.start.m).padStart(2, '0') + '-' + String(_inn.start.d).padStart(2, '0');
  var co = _inn.end.y + '-' + String(_inn.end.m).padStart(2, '0') + '-' + String(_inn.end.d).padStart(2, '0');
  var days = Math.ceil((new Date(_inn.end.y, _inn.end.m - 1, _inn.end.d) - new Date(_inn.start.y, _inn.start.m - 1, _inn.start.d)) / 86400000) + 1;
  var bedNum = _inn._bedNum || 1;
  var bedLabel = room.room_type === 'quad' ? ' · ' + bedNum + '床' : '';
  var totalEst = days * room.rate * bedNum;
  showConfirm('🏡 预订确认\n\n' + room.label + bedLabel + '\n📅 ' + ci + ' → ' + co + '（' + days + '晚）\n💵 约 ' + totalEst + ' NT（以结算为准）\n\n确认预订？', function() {
    if (typeof API !== 'undefined' && API.token) {
      API.checkin(room.id, 'inn', ci, co, bedNum).then(function(r) {
        if (r && r.ok) { showToast('预订成功！' + room.label + bedLabel + ' · ' + ci + '→' + co, 'ok'); _inn.sel = null; _inn.start = null; _inn.end = null; _inn._bedNum = 1; _innLoad(); }
        else {
          var err = (r && r.detail) || (r && r.error) || '预订失败';
          // C-B-5: 后端重叠/超额判定——前端显错
          if (err.indexOf('重叠') >= 0 || err.indexOf('占用') >= 0 || err.indexOf('超额') >= 0) {
            showToast('⚠ ' + err + '，请另选日期', 'error');
          } else showToast(err, 'error');
        }
      }).catch(function(e) { showToast('网络异常，请重试', 'error'); });
    } else showToast('离线模式，请登录后重试', 'warn');
  });
}

function _innCheckout() {
  showConfirm('🚪 退房确认\n\n请确认个人物品已带走、垃圾已清理。\n退房后将结算住宿费（从 NT 余额扣除）。\n\n确认退房？', function() {
    if (typeof API !== 'undefined' && API.token) {
      API.checkout().then(function(r) {
        if (r && r.ok) {
          var st = r.settlement;
          if (st) {
            var msg = '已退房 · 结算 ' + st.paid + ' NT';
            if (st.debt > 0) msg += ' · ⚠ 欠费 ' + st.debt + ' NT 未结';
            showToast(msg, st.debt > 0 ? 'warn' : 'ok');
            // 结算明细弹窗
            var detail = '📋 退房结算单\n\n';
            if (st.room_label) detail += '🏡 ' + st.room_label + '\n';
            detail += '🛏️ ' + (st.bed_num || 1) + '床 · ' + st.days + ' 天';
            if (st.rate) detail += ' · ' + st.rate + ' NT/晚';
            detail += '\n💰 合计 ' + (st.total || 0) + ' NT';
            detail += '\n💳 已付 ' + (st.paid || 0) + ' NT';
            if (st.debt > 0) detail += '\n⚠ 欠费 ' + st.debt + ' NT（请尽快结清）';
            showConfirm(detail, function() {});
          } else showToast('已退房', 'ok');
          _inn.status = null; _innLoad();
        } else showToast((r && r.detail) || (r && r.error) || '退房失败', 'error');
      }).catch(function() { showToast('网络异常，请重试', 'error'); });
    } else showToast('离线模式，请登录后重试', 'warn');
  });
}

var _mealOrders = {};
// C-4: 启动时从 AppData 回填订单状态（解决刷新丢失）
(function(){ if(window.AppData&&AppData._data.mealOrders){ Object.keys(AppData._data.mealOrders).forEach(function(k){ var o=AppData._data.mealOrders[k]; if(o.status==='ordered')_mealOrders[k]=true; }); } })();
function _orderMeal(date, meal) {
  if (!CURRENT_USER) { showToast('请先登录', 'error'); return; }
  var mealCost = (window.CAMP_ECONOMY && window.CAMP_ECONOMY.canteenMealCost) || 10;

  // 时间限制检查
  var now = new Date();
  var deadlineHour = meal === 'lunch' ? 10 : 16;
  var todayStr = today();
  if (date === todayStr && now.getHours() >= deadlineHour) {
    showToast(meal==='lunch'?'午餐预定已截止（10:00）':'晚餐预定已截止（16:00）', 'warn');
    return;
  }
  // 历史日期（早于今天）不可预定
  if (date < todayStr) { showToast('不能预定过去的餐', 'warn'); return; }

  var key = CURRENT_USER + '_' + date + '_' + meal;
  if (_mealOrders[key]) { showToast('已预定过了', 'warn'); return; }

  var menu = (AppData._data.canteenMenu || {})[date];
  if (!menu || !(meal==='lunch'?menu.lunch:menu.dinner) || !(meal==='lunch'?menu.lunch:menu.dinner).length) {
    showToast('该时段暂无菜单', 'warn'); return;
  }

  showConfirm('预定 ' + date + ' ' + (meal==='lunch'?'午餐':'晚餐') + '？\n费用：' + mealCost + ' NT', function(){

  if (window.NT) {
    var u = NT.getUser(CURRENT_USER);
    if (!u || u.ntBalance < mealCost) { showToast('NT余额不足（需' + mealCost + ' NT）', 'error'); return; }
    NT.spend(CURRENT_USER, mealCost, '食堂预定: ' + date + ' ' + (meal==='lunch'?'午餐':'晚餐'), 'personal');
  }

  _mealOrders[key] = true;
  // C5: 饭局不再属于新手引导任务

  // 持久化订单到 AppData
  if (!AppData._data.mealOrders) AppData._data.mealOrders = {};
  AppData._data.mealOrders[key] = { user:CURRENT_USER, date:date, meal:meal, orderedAt:new Date().toISOString(), status:'ordered' };
  if (window.AppData) AppData._saveShared();

  try { recordTransaction({ type:'canteen_preorder', from:CURRENT_USER, amount:mealCost, scope:'camp', note:date+' '+(meal==='lunch'?'午餐':'晚餐') }); } catch(e) {}
  try { logActivity('canteen', CURRENT_USER + ' 预定了 ' + date + ' ' + (meal==='lunch'?'午餐':'晚餐') + ' · -' + mealCost + ' NT'); } catch(e) {}

  showToast('预定成功！-' + mealCost + ' NT', 'ok');
  renderCanteen();
  });
}

function _cancelMeal(date, meal) {
  if (!CURRENT_USER) return;
  var mealCost = (window.CAMP_ECONOMY && window.CAMP_ECONOMY.canteenMealCost) || 10;
  var key = CURRENT_USER + '_' + date + '_' + meal;
  if (!_mealOrders[key]) { showToast('未预定，无法取消', 'warn'); return; }

  // 时间限制检查（同预定）
  var now = new Date();
  var deadlineHour = meal === 'lunch' ? 10 : 16;
  var todayStr = today();
  if (date === todayStr && now.getHours() >= deadlineHour) {
    showToast(meal==='lunch'?'午餐已截止，无法取消':'晚餐已截止，无法取消', 'warn');
    return;
  }

  showConfirm('取消预定？\n将退回 ' + mealCost + ' NT', function(){

  // 退款
  if (window.NT) {
    NT.earn(CURRENT_USER, mealCost, '食堂退款: ' + date + ' ' + (meal==='lunch'?'午餐':'晚餐'), 'personal');
  }

  delete _mealOrders[key];
  if (AppData._data.mealOrders) { AppData._data.mealOrders[key] = { user:CURRENT_USER, date:date, meal:meal, status:'cancelled', cancelledAt:new Date().toISOString() }; }
  if (window.AppData) AppData._saveShared();

  try { recordTransaction({ type:'canteen_refund', to:CURRENT_USER, amount:mealCost, scope:'camp', note:date+' '+(meal==='lunch'?'午餐':'晚餐')+' 退款' }); } catch(e) {}
  try { logActivity('canteen', CURRENT_USER + ' 取消了 ' + date + ' ' + (meal==='lunch'?'午餐':'晚餐') + ' · +' + mealCost + ' NT'); } catch(e) {}

  showToast('已取消，退回 ' + mealCost + ' NT', 'ok');
  renderCanteen();
  });
}
// 管理员设置今日菜单: setCanteenMenu('2026-07-19', ['糙米饭','清炒时蔬','菌菇汤'], ['素汤面','田园沙拉','蒸红薯'])
function setCanteenMenu(date, lunch, dinner) {
  if (!window.AppData) return;
  if (!AppData._data.canteenMenu) AppData._data.canteenMenu = {};
  AppData._data.canteenMenu[date] = { lunch: lunch || [], dinner: dinner || [] };
  AppData._saveShared();
  showToast('菜单已更新');
}
function getFoodIcon(name) {
  var map = { '饭':'🍚','米':'🍚','面':'🍜','汤':'🍲','豆腐':'🫘','豆':'🫘','菜':'🥬','蔬':'🥬',
    '瓜':'🥒','茄':'🍆','薯':'🍠','花生':'🥜','茶':'🍵','蛋':'🥚','菇':'🍄','饺子':'🥟','沙拉':'🥗','果':'🍎' };
  for (var k in map) { if (name.indexOf(k) !== -1) return map[k]; }
  return '🍽️';
}

// ══ 阶段4: 食堂 overlay ══
var _canteenDate = '';

function openCanteen() {
  _canteenDate = today();
  _pushOverlay('overlayCanteen'); document.getElementById('overlayCanteen').classList.add('open');
  var c = getCampData();
  document.querySelector('#overlayCanteen .overlay-title').textContent = '🥬 ' + (c ? c.name : '') + ' · 食堂';
  renderCanteen();
}

function closeCanteen() {
  document.getElementById('overlayCanteen').classList.remove('open');
  document.getElementById('overlayCampHome').classList.add('open');
}

function _canteenDateLabel(d) {
  if (d === today()) return '今天';
  var dt = new Date(d + 'T00:00:00');
  var days = ['周日','周一','周二','周三','周四','周五','周六'];
  return (dt.getMonth()+1) + '月' + dt.getDate() + '日（' + days[dt.getDay()] + '）';
}

function _canteenShift(d, days) {
  var dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0,10);
}

function _canteenHasMenu(d) {
  var m = (AppData._data.canteenMenu || {})[d];
  return m && ((m.lunch && m.lunch.length) || (m.dinner && m.dinner.length));
}

function renderCanteen() {
  var el = document.getElementById('canteenBody'); if (!el) return;
  var d = _canteenDate || today();
  var menu = (AppData._data.canteenMenu || {})[d] || { lunch:[], dinner:[] };
  var prevD = _canteenShift(d, -1);
  var nextD = _canteenShift(d, 1);
  var hasPrev = _canteenHasMenu(prevD);
  var hasNext = _canteenHasMenu(nextD);
  var isToday = d === today();
  var now = new Date();
  var lunchExpired = isToday && now.getHours() >= 10;
  var dinnerExpired = isToday && now.getHours() >= 16;

  function _renderSection(meal, label, deadline, expired) {
    var items = menu[meal] || [];
    var key = CURRENT_USER + '_' + d + '_' + meal;
    var ordered = !!_mealOrders[key];
    var h = '<div class="canteen-section">';
    h += '<div class="canteen-meal-label">' + (meal==='lunch'?'☀️':'🌙') + ' ' + label + '</div>';
    if (!items.length) {
      h += '<div class="canteen-empty">暂无菜单</div>';
    } else {
      h += '<div class="canteen-card"><div class="canteen-items">';
      items.forEach(function(name) {
        h += '<div class="canteen-item"><span>' + getFoodIcon(name) + '</span><span>' + esc(name) + '</span></div>';
      });
      h += '</div>';
      h += '<div class="canteen-card-foot"><span class="canteen-price">10 NT</span>';
      if (expired) {
        h += '<span class="canteen-btn dead">已截止</span>';
      } else if (ordered) {
        h += '<span class="canteen-btn done">✅ 已预定</span>';
        h += '<span class="canteen-btn cancel" onclick="_cancelMeal(\''+d+'\',\''+meal+'\')">❌ 取消</span>';
      } else {
        h += '<span class="canteen-btn order" onclick="_orderMeal(\''+d+'\',\''+meal+'\')">🟢 预定</span>';
      }
      h += '</div></div>';
    }
    h += '</div>';
    return h;
  }

  var h = '';
  h += '<div class="canteen-date-row">';
  h += '<span class="canteen-date-arrow' + (hasPrev ? '' : ' disabled') + '" onclick="' + (hasPrev ? '_canteenDate=\''+prevD+'\';renderCanteen()' : '') + '">‹</span>';
  h += '<span class="canteen-date-label' + (isToday ? ' today' : '') + '">📅 ' + _canteenDateLabel(d) + (isToday ? '' : '') + '</span>';
  h += '<span class="canteen-date-arrow' + (hasNext ? '' : ' disabled') + '" onclick="' + (hasNext ? '_canteenDate=\''+nextD+'\';renderCanteen()' : '') + '">›</span>';
  h += '</div>';

  h += _renderSection('lunch', '午餐（11:30-13:00）', 10, lunchExpired);
  h += _renderSection('dinner', '晚餐（17:30-19:00）', 16, dinnerExpired);

  h += '<div class="canteen-divider">📋 我的订餐记录</div>';
  h += '<div id="canteenHistory">' + _renderCanteenHistory(false) + '</div>';

  el.innerHTML = h;
}

function _renderCanteenHistory(showAll) {
  var limit = showAll ? 999 : 3;
  var todayStr = today();
  var h = '';
  var count = 0;
  for (var i = 0; i < 30 && count < limit; i++) {
    var d = _canteenShift(todayStr, -i);
    var lunchKey = CURRENT_USER + '_' + d + '_lunch';
    var dinnerKey = CURRENT_USER + '_' + d + '_dinner';
    var lOrdered = !!_mealOrders[lunchKey];
    var dOrdered = !!_mealOrders[dinnerKey];
    var orders = AppData._data.mealOrders || {};
    var lCancelled = (orders[lunchKey] || {}).status === 'cancelled';
    var dCancelled = (orders[dinnerKey] || {}).status === 'cancelled';

    if (lOrdered || dOrdered || lCancelled || dCancelled) {
      count++;
      h += '<div class="canteen-history-row">';
      h += '<span class="ch-date">' + d.slice(5) + '</span>';
      h += '<span>' + (lOrdered ? '午餐 ✅' : lCancelled ? '午餐 ❌（已取消）' : '午餐 —') + '</span>';
      h += '<span style="margin-left:8px">' + (dOrdered ? '晚餐 ✅' : dCancelled ? '晚餐 ❌（已取消）' : '晚餐 —') + '</span>';
      h += '</div>';
    }
  }
  if (!h) h = '<div style="text-align:center;padding:12px;font-size:.65rem;color:#8a8a8a">暂无订餐记录</div>';
  if (!showAll && count >= 3) {
    h += '<div class="canteen-expand" onclick="document.getElementById(\'canteenHistory\').innerHTML=_renderCanteenHistory(true)">展开全部记录 ▼</div>';
  }
  return h;
}

// ══ 阶段4: 客栈 overlay — E3.1 已移除（INN_ROOMS → AppData.map_locations.accommodations）══
// openInn / closeInn 已移至文件顶部，复用 _showStaySheet()

// E3.1: 删除 renderInn / showInnDetail / submitInnApplication / cancelInnApplication 等死代码
// 原 ~220 行 INN_ROOMS 依赖代码已移除，住宿统一走 _showStaySheet()（app.js）



function recordTransaction(tx) {
  if (!window.AppData) return;
  if (!AppData._data.finance) AppData._data.finance = [];
  tx.time = tx.time || new Date().toISOString();
  tx.id = tx.id || ('tx_' + Date.now() + '_' + Math.random().toString(36).slice(2,6));
  AppData._data.finance.push(tx);
  AppData._saveShared();
}

