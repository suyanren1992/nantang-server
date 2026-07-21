// ══ 阶段4: 客栈 — E3.1 已迁移到 AppData.map_locations.accommodations ══
// openInn → 复用 _showStaySheet()（app.js），不再维护独立 INN_ROOMS 系统

function openInn() {
  // E3.7: 直接复用住宿卡片弹窗，不再打开空壳 overlay
  if (typeof _showStaySheet === 'function') { _showStaySheet(); }
}

function closeInn() {
  document.getElementById('overlayInn').classList.remove('open');
  document.getElementById('overlayCampHome').classList.add('open');
}

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

// ══ 阶段4: 客栈 overlay — E3.1 已移除（INN_ROOMS → AppData.map_locations.accommodations）══
// openInn / closeInn 已移至文件顶部，复用 _showStaySheet()

// E3.1: 删除 renderInn / showInnDetail / submitInnApplication / cancelInnApplication 等死代码
// 原 ~220 行 INN_ROOMS 依赖代码已移除，住宿统一走 _showStaySheet()（app.js）


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

