// ══ 阶段4: 客栈数据 ══
var INN_ROOMS = [
  { building:'竹', type:'单人间', rooms:[
    { id:'zhu_a', name:'竹·A间', bed:'1.2m', desk:true, dir:'朝南', price:30, occupant:null, checkIn:null, checkOut:null },
    { id:'zhu_b', name:'竹·B间', bed:'1.2m', desk:true, dir:'朝北', price:30, occupant:null, checkIn:null, checkOut:null }
  ]},
  { building:'梅', type:'单人间', rooms:[
    { id:'mei_a', name:'梅·A间', bed:'1.2m', desk:true, dir:'朝东', price:30, occupant:'砚仁', checkIn:'2026-07-20', checkOut:'2026-07-27' },
    { id:'mei_b', name:'梅·B间', bed:'1.2m', desk:true, dir:'朝西', price:30, occupant:null, checkIn:null, checkOut:null }
  ]},
  { building:'兰', type:'四人间', beds:[
    { id:'lan_a', name:'兰·床A', price:15, occupant:'朝林', checkIn:'2026-07-20', checkOut:'2026-07-27' },
    { id:'lan_b', name:'兰·床B', price:15, occupant:'大飞', checkIn:'2026-07-20', checkOut:'2026-07-25' },
    { id:'lan_c', name:'兰·床C', price:15, occupant:null, checkIn:null, checkOut:null },
    { id:'lan_d', name:'兰·床D', price:15, occupant:null, checkIn:null, checkOut:null }
  ]},
  { building:'菊', type:'单人间', rooms:[
    { id:'ju_a', name:'菊·A间', bed:'1.2m', desk:true, dir:'朝南', price:30, occupant:null, checkIn:null, checkOut:null },
    { id:'ju_b', name:'菊·B间', bed:'1.2m', desk:true, dir:'朝北', price:30, occupant:null, checkIn:null, checkOut:null }
  ]}
];

function findInnBed(id) {
  for (var i = 0; i < INN_ROOMS.length; i++) {
    var b = INN_ROOMS[i];
    var list = b.rooms || b.beds || [];
    for (var j = 0; j < list.length; j++) {
      if (list[j].id === id) return list[j];
    }
  }
  return null;
}

function getInnApplications() {
  if (!window.AppData) return [];
  if (!AppData._data.inn_applications) AppData._data.inn_applications = [];
  return AppData._data.inn_applications;
}

function getUserStay(userName) {
  var apps = getInnApplications();
  for (var i = apps.length - 1; i >= 0; i--) {
    if (apps[i].user === userName && apps[i].status === 'confirmed') return apps[i];
  }
  for (var i = 0; i < INN_ROOMS.length; i++) {
    var b = INN_ROOMS[i];
    var list = b.rooms || b.beds || [];
    for (var j = 0; j < list.length; j++) {
      if (list[j].occupant === userName) {
        return { user:userName, bedId:list[j].id, bedName:list[j].name, building:b.building, checkIn:list[j].checkIn, checkOut:list[j].checkOut, price:list[j].price, status:'confirmed', appliedAt:'' };
      }
    }
  }
  return null;
}

function _innApplyId() { return 'inn_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

var _mealOrders = {};
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

  if (!confirm('预定 ' + date + ' ' + (meal==='lunch'?'午餐':'晚餐') + '？\n费用：' + mealCost + ' NT')) return;

  if (window.NT) {
    var u = NT.getUser(CURRENT_USER);
    if (!u || u.ntBalance < mealCost) { showToast('NT余额不足（需' + mealCost + ' NT）', 'error'); return; }
    NT.spend(CURRENT_USER, mealCost, '食堂预定: ' + date + ' ' + (meal==='lunch'?'午餐':'晚餐'), 'personal');
  }

  _mealOrders[key] = true;
  if (typeof _completeNewbieQuest === 'function') _completeNewbieQuest(CURRENT_USER, 'join_meal');

  // 持久化订单到 AppData
  if (!AppData._data.mealOrders) AppData._data.mealOrders = {};
  AppData._data.mealOrders[key] = { user:CURRENT_USER, date:date, meal:meal, orderedAt:new Date().toISOString(), status:'ordered' };
  if (window.AppData) AppData._saveShared();

  try { recordTransaction({ type:'canteen_preorder', from:CURRENT_USER, amount:mealCost, scope:'camp', note:date+' '+(meal==='lunch'?'午餐':'晚餐') }); } catch(e) {}
  try { logActivity('canteen', CURRENT_USER + ' 预定了 ' + date + ' ' + (meal==='lunch'?'午餐':'晚餐') + ' · -' + mealCost + ' NT'); } catch(e) {}

  showToast('预定成功！-' + mealCost + ' NT', 'ok');
  renderCanteen();
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

  if (!confirm('取消预定？\n将退回 ' + mealCost + ' NT')) return;

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
  document.getElementById('overlayCanteen').classList.add('open');
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

// ══ 阶段4: 客栈 overlay ══
function openInn() {
  document.getElementById('overlayInn').classList.add('open');
  var c = getCampData();
  document.querySelector('#overlayInn .overlay-title').textContent = '🏨 ' + (c ? c.name : '') + ' · 客栈';
  renderInn();
}

function closeInn() {
  document.getElementById('overlayInn').classList.remove('open');
  document.getElementById('overlayCampHome').classList.add('open');
}

function renderInn() {
  var el = document.getElementById('innBody'); if (!el) return;
  var h = '';
  h += '<div class="inn-header">🏨 大地书房客栈</div>';

  INN_ROOMS.forEach(function(building) {
    h += '<div class="inn-building">';
    h += '<div class="inn-building-head" onclick="toggleInnBuilding(this)">';
    h += '<span>▾</span>';
    h += '<span>' + (building.building==='竹'?'🎋':building.building==='梅'?'🌸':building.building==='兰'?'🌿':'🌼') + ' ' + building.building + ' — ' + building.type;
    var list = building.rooms || building.beds || [];
    h += ' ×' + list.length + '</span>';
    h += '</div>';
    h += '<div class="inn-building-body">';
    (building.rooms || building.beds || []).forEach(function(room) {
      var isOccupied = !!room.occupant;
      var dot = isOccupied ? '🔴' : '🟢';
      h += '<div class="inn-room-card" onclick="showInnDetail(\'' + room.id + '\')">';
      h += '<div style="display:flex;align-items:center;gap:6px">';
      h += '<span>' + dot + '</span>';
      h += '<span class="inn-room-name">' + esc(room.name) + ' · ¥' + room.price + '/天</span>';
      h += '</div>';
      if (isOccupied) {
        h += '<div class="inn-room-occ">住客：' + esc(room.occupant) + ' · ' + (room.checkIn||'') + ' 至 ' + (room.checkOut||'') + '</div>';
      }
      h += '<div class="inn-room-detail">床位：' + esc(room.bed||(building.type==='四人间'?'上下铺':'1.2m')) + (room.desk ? ' · 书桌' : '') + ' · ' + esc(room.dir||'') + '</div>';
      h += '</div>';
    });
    h += '</div></div>';
  });

  var stay = getUserStay(CURRENT_USER);
  h += '<div class="canteen-divider">📋 我的住宿</div>';
  if (stay) {
    var days = stay.checkIn && stay.checkOut ? Math.round((new Date(stay.checkOut+'T00:00:00') - new Date(stay.checkIn+'T00:00:00')) / 86400000) : 0;
    var totalCost = days * (stay.price || 0);
    var statusIcon = stay.status === 'confirmed' ? '✅' : stay.status === 'pending' ? '⏳' : '❌';
    var statusLabel = stay.status === 'confirmed' ? '已确认' : stay.status === 'pending' ? '审核中' : '已拒绝';
    h += '<div class="inn-stay-card">';
    h += '<div class="inn-stay-title">' + (stay.building||'') + ' · ' + esc(stay.bedName||'') + ' · ' + (stay.checkIn||'') + ' 至 ' + (stay.checkOut||'') + ' · ¥' + totalCost + '</div>';
    h += '<div class="inn-stay-status">状态：' + statusIcon + ' ' + statusLabel + '</div>';
    if (stay.status === 'pending') {
      h += '<div class="inn-stay-cancel" onclick="cancelInnApplication(\'' + stay.bedId + '\')">取消申请</div>';
    }
    h += '</div>';
  } else {
    h += '<div style="text-align:center;padding:12px;font-size:.65rem;color:#8a8a8a">暂无住宿记录</div>';
  }

  el.innerHTML = h;
}

function toggleInnBuilding(el) {
  var body = el.nextElementSibling;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  el.querySelector('span').textContent = isOpen ? '▸' : '▾';
}

// ══ 阶段4: 客栈床位详情 Sheet ══
var _innDetailBed = null;
var _innDetailCheckIn = '';
var _innDetailCheckOut = '';

function _innShiftDate(d, days) {
  var dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function _innDaysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

function showInnDetail(bedId) {
  var bed = findInnBed(bedId); if (!bed) return;
  _innDetailBed = bed;
  var todayStr = today();
  _innDetailCheckIn = todayStr;
  _innDetailCheckOut = _innShiftDate(todayStr, 7);

  var isOccupied = !!bed.occupant;
  var card = document.getElementById('innDetailCard');
  if (isOccupied) {
    card.innerHTML = '<div class="inn-detail-header">' + esc(bed.name) + '</div>' +
      '<div class="inn-detail-info">' +
        '<div>类型：' + (bed.bed ? '床位' : '单人间') + '</div>' +
        '<div>价格：¥' + bed.price + '/天</div>' +
        '<div>床位：' + esc(bed.bed||'1.2m') + (bed.desk ? ' · 书桌' : '') + ' · ' + esc(bed.dir||'') + '</div>' +
        '<div style="color:#b84c38;margin-top:8px">🔴 已入住：' + esc(bed.occupant) + ' · ' + (bed.checkIn||'') + ' 至 ' + (bed.checkOut||'') + '</div>' +
      '</div>' +
      '<div class="inn-detail-close" onclick="closeInnDetail()">关闭</div>';
    document.getElementById('innDetailSheet').style.display = 'flex';
    return;
  }

  _renderInnDetailSheet();
  document.getElementById('innDetailSheet').style.display = 'flex';
}

function _renderInnDetailSheet() {
  var bed = _innDetailBed; if (!bed) return;
  var card = document.getElementById('innDetailCard');
  var days = _innDaysBetween(_innDetailCheckIn, _innDetailCheckOut);
  if (days < 1) days = 1;
  var cost = days * (bed.price || 0);

  var checkInOptions = '';
  for (var i = 0; i < 14; i++) {
    var d = _innShiftDate(today(), i);
    var sel = d === _innDetailCheckIn ? ' selected' : '';
    checkInOptions += '<option value="'+d+'"'+sel+'>'+d+'</option>';
  }
  var checkOutOptions = '';
  for (var j = 1; j <= 30; j++) {
    var d2 = _innShiftDate(_innDetailCheckIn, j);
    var sel2 = d2 === _innDetailCheckOut ? ' selected' : '';
    checkOutOptions += '<option value="'+d2+'"'+sel2+'>'+d2+'</option>';
  }

  card.innerHTML =
    '<div class="inn-detail-header">' + esc(bed.name) + '</div>' +
    '<div class="inn-detail-info">' +
      '<div>类型：' + (bed.bed ? '床位' : '单人间') + '</div>' +
      '<div>价格：¥' + bed.price + '/天</div>' +
      '<div>床位：' + esc(bed.bed||'1.2m') + (bed.desk ? ' · 书桌' : '') + ' · ' + esc(bed.dir||'') + '</div>' +
    '</div>' +
    '<div class="inn-detail-form">' +
      '<div class="inn-form-row"><span>入住日期</span><select onchange="_innDetailCheckIn=this.value;_innDetailCheckOut=_innShiftDate(_innDetailCheckIn,Math.max(1,_innDaysBetween(_innDetailCheckIn,_innDetailCheckOut)));_renderInnDetailSheet()">' + checkInOptions + '</select></div>' +
      '<div class="inn-form-row"><span>退房日期</span><select onchange="_innDetailCheckOut=this.value;_renderInnDetailSheet()">' + checkOutOptions + '</select></div>' +
      '<div class="inn-form-row"><span>天数</span><span>' + days + ' 天</span></div>' +
      '<div class="inn-form-row"><span>费用</span><span style="font-weight:700;color:var(--green-primary)">¥' + cost + '</span></div>' +
    '</div>' +
    '<textarea id="innApplyNote" class="inn-note" placeholder="备注（可选）" rows="2"></textarea>' +
    '<div class="inn-detail-actions">' +
      '<button class="inn-submit-btn" onclick="submitInnApplication()">提交住宿申请</button>' +
      '<button class="inn-close-btn" onclick="closeInnDetail()">取消</button>' +
    '</div>';
}

function closeInnDetail() {
  document.getElementById('innDetailSheet').style.display = 'none';
  _innDetailBed = null;
}

function submitInnApplication() {
  if (!CURRENT_USER) { showToast('请先登录', 'error'); return; }
  var bed = _innDetailBed; if (!bed) return;
  var note = (document.getElementById('innApplyNote') || {}).value || '';
  var apps = getInnApplications();
  var days = _innDaysBetween(_innDetailCheckIn, _innDetailCheckOut);
  if (days < 1) days = 1;
  var cost = days * (bed.price || 0);

  var existing = apps.filter(function(a) {
    return a.user === CURRENT_USER && (a.status === 'pending' || a.status === 'confirmed');
  });
  if (existing.length) {
    showToast('你已有住宿申请在处理中', 'warn');
    return;
  }

  var app = {
    id: _innApplyId(),
    user: CURRENT_USER,
    bedId: bed.id,
    bedName: bed.name,
    building: _findInnBuilding(bed.id),
    price: bed.price,
    checkIn: _innDetailCheckIn,
    checkOut: _innDetailCheckOut,
    days: days,
    totalCost: cost,
    note: note,
    status: 'pending',
    appliedAt: new Date().toISOString()
  };
  apps.push(app);
  AppData._saveShared();

  try { logActivity('inn', CURRENT_USER + ' 申请住宿 ' + bed.name + ' · ' + _innDetailCheckIn + ' 至 ' + _innDetailCheckOut + ' · ¥' + cost); } catch(e) {}

  showToast('申请已提交，等待管理员审核', 'ok');
  closeInnDetail();
  renderInn();
}

function _findInnBuilding(bedId) {
  for (var i = 0; i < INN_ROOMS.length; i++) {
    var b = INN_ROOMS[i];
    var list = b.rooms || b.beds || [];
    for (var j = 0; j < list.length; j++) {
      if (list[j].id === bedId) return b.building;
    }
  }
  return '';
}

function cancelInnApplication(bedId) {
  if (!CURRENT_USER) return;
  if (!confirm('确认取消住宿申请？')) return;
  var apps = getInnApplications();
  for (var i = apps.length - 1; i >= 0; i--) {
    if (apps[i].user === CURRENT_USER && apps[i].bedId === bedId && apps[i].status === 'pending') {
      apps[i].status = 'cancelled';
      apps[i].cancelledAt = new Date().toISOString();
      AppData._saveShared();
      try { logActivity('inn', CURRENT_USER + ' 取消了住宿申请 ' + apps[i].bedName); } catch(e) {}
      showToast('申请已取消', 'ok');
      renderInn();
      return;
    }
  }
  showToast('未找到可取消的申请', 'warn');
}

function renderTimeline() {
  var el = document.getElementById('timelineList'); if (!el) return;
  var journal = (window.AppData && AppData._data.journal) ? AppData._data.journal : [];
  if (!journal.length) { el.innerHTML = '<div style=text-align:center;padding:20px;color:#5a6e5c>📜 暂无动态<br><span style=font-size:.65rem>打扫、放物品、完成任务都会记录在这里</span></div>'; return; }
  var h = '';
  journal.slice(0, 20).forEach(function(j) {
    var jt = JOURNAL_TYPES[j.type] || { icon:'📋', label:j.type };
    h += '<div style=display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:.72rem;align-items:flex-start>'+
      '<span style=font-size:1.1rem;flex-shrink:0>'+jt.icon+'</span>'+
      '<div style=flex:1;min-width:0>'+
        '<div><b>'+esc(j.user)+'</b> · <span style=color:#5a6e5c>'+jt.label+'</span></div>'+
        '<div style=color:#1d2e24;margin-top:1px>'+esc(j.content)+'</div>'+
        '<div style=font-size:.6rem;color:#aaa;margin-top:2px>'+j.date+' '+j.time+'</div>'+
      '</div>'+
    '</div>';
  });
  el.innerHTML = h;
}

function recordTransaction(tx) {
  if (!window.AppData) return;
  if (!AppData._data.finance) AppData._data.finance = [];
  tx.time = tx.time || new Date().toISOString();
  tx.id = tx.id || ('tx_' + Date.now() + '_' + Math.random().toString(36).slice(2,6));
  AppData._data.finance.push(tx);
  AppData._saveShared();
}

