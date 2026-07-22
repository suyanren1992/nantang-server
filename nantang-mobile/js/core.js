function avatarURL(seed,size){var ver=typeof DICEBEAR_VER!=='undefined'?DICEBEAR_VER:'9.x';return 'https://api.dicebear.com/'+ver+'/'+AVATAR_STYLE+'/svg?seed='+encodeURIComponent(seed)+'&size='+(size||80)}
function avatarImg(seed,size){return '<img src="'+avatarURL(seed,size)+'" width="'+(size||40)+'" height="'+(size||40)+'" style="border-radius:50%;object-fit:cover" alt="" onerror="this.style.opacity=\'0\'">'}
function roleIcon(r){return r==='admin'?'🛡️':r==='builder'?'🧱':r==='adventurer'?'⚔️':r==='npc'?'🏠':'☁️'}
function roleName(r){return r==='admin'?'管理员':r==='builder'?'共建者':r==='adventurer'?'冒险者':r==='npc'?'在地伙伴':'云村民'}
// ═══ 公共工具函数 ═══
// R8: 合并客户端 claimants（含 submission 字段）与服务端 assignees（纯 ID 数组）
function _mergeClaimants(existing, serverIds) {
  var map = {}; existing.forEach(function(c){ map[c.name] = c; });
  return serverIds.map(function(id){ return map[id] || {name:id}; });
}
function _isOffline() { return !window.API || !API.token || API._serverOnline === false || window.location.protocol === 'file:'; }
function _guardOnline(action) { if (_isOffline()) { showToast('离线模式，无法'+action,'warn'); return true; } return false; }
// 更新离线 badge 显示（全局：地图栏 + 村口个人页）
setInterval(function(){ document.querySelectorAll('.offline-badge').forEach(function(b){b.style.display=_isOffline()?'inline':'none'}); }, 5000);
function closeAllExpands(){document.querySelectorAll('.card-expand,.submit-expand,.settle-expand,.withdraw-expand,.review-expand,.unclaim-expand,.submission-sub,.ledger-expand,.archive-detail,.confirm-card,.toast-card,.avatar-picker').forEach(function(c){c.remove()})}
function isTaskOverdue(t){return t.deadline&&t.deadline<today()&&t.status!=='已结算'&&t.status!=='待结算'}
function _processOverdueTasks(){Object.values(TASKS).forEach(function(t){if(isTaskOverdue(t)){t.action='overdue';AppData.updateTask(t.name,{action:'overdue'});}})}
function NT_ICON(s){s=s||14;return'<img src=豆子.png alt=NT onerror="this.outerHTML=\'🌱\'" style=width:'+s+'px;height:'+s+'px;vertical-align:middle;margin-right:2px>'}
// FIX-15: LEDGER 已废弃。RMB 金库迁移到 AppData._data.campRmb。
function openLedger(type){
  if(_ledgerOpen===type){_ledgerOpen='';document.querySelectorAll('.ledger-expand').forEach(function(c){c.remove()});return}
  _ledgerOpen=type;
  document.querySelectorAll('.ledger-expand').forEach(function(c){c.remove()});
  // 从 NT 核心取流水，而非 UI LEDGER 对象
  var records=[],income=0,expense=0;
  if(window.NT){
    var entries=NT.getLedger({userId:CURRENT_USER});
    entries.forEach(function(e){
      var isIn=(e.to===CURRENT_USER||(e.type==='task_reward'&&e.status==='settled'));
      var isOut=(e.from===CURRENT_USER||e.type==='task_freeze');
      var amt=e.amount||0;
      // 跳过系统内部流转（escrow 托管）
      if(e.to==='escrow'||e.from==='escrow'){
        if(e.type==='task_freeze'){isOut=true;isIn=false}
        else if(e.type==='task_reward'&&e.status==='settled'){isIn=true;isOut=false}
        else return;
      }
      if(isIn){income+=amt;records.push({d:e.timestamp.slice(5,10),note:e.reason||e.type,amt:amt,in:true})}
      else if(isOut){expense+=amt;records.push({d:e.timestamp.slice(5,10),note:e.reason||e.type,amt:amt,in:false})}
    });
  }
  var bal=income-expense;
  var d=document.createElement('div');d.className='ledger-expand';
  d.style.cssText='margin:6px 14px;background:#fff;border:1px solid var(--green-border);border-radius:10px;padding:14px;animation:fadeIn .2s ease-out;font-size:.72rem';
  var h='';
  h+='<div style=display:flex;gap:8px;margin-bottom:10px>';
  h+='<div style=flex:1;background:#e8f5e9;border-radius:10px;padding:10px;text-align:center><div style=font-size:.62rem;color:#5a6e5c>收入</div><div style=font-size:1.1rem;font-weight:700;color:#5d8c52>+'+income+'</div></div>';
  h+='<div style=flex:1;background:#fde8e8;border-radius:10px;padding:10px;text-align:center><div style=font-size:.62rem;color:#5a6e5c>支出</div><div style=font-size:1.1rem;font-weight:700;color:var(--red)>-'+expense+'</div></div>';
  h+='<div style=flex:1;background:#e8f0e8;border-radius:10px;padding:10px;text-align:center><div style=font-size:.62rem;color:#5a6e5c>余额</div><div style=font-size:1.1rem;font-weight:700;color:var(--green-primary)>'+bal+'</div></div></div>';
  // Categorize
  var cats={};records.forEach(function(r){var cat=catLedger(r.note);if(!cats[cat])cats[cat]={in:0,out:0,count:0};if(r.in)cats[cat].in+=r.amt;else cats[cat].out+=r.amt;cats[cat].count++});
  if(Object.keys(cats).length){
    h+='<div style=font-size:.65rem;font-weight:700;color:#5a6e5c;margin-bottom:4px>📊 分类汇总</div>';
    Object.keys(cats).forEach(function(c){
      var v=cats[c];h+='<div style=display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0;font-size:.7rem"><span>'+c+' ('+v.count+'笔)</span><span>';
      if(v.in) h+='<span style=color:#5d8c52;margin-right:8px>+'+v.in+'</span>';
      if(v.out) h+='<span style=color:var(--red)>-'+v.out+'</span>';
      h+='</span></div>';
    });
  }
  if(records.length){
    h+='<div style=font-size:.65rem;font-weight:700;color:#5a6e5c;margin:10px 0 4px>📋 流水（最近 '+Math.min(records.length,20)+' 条）</div>';
    records.slice(0,20).forEach(function(r){h+='<div style=display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:.68rem"><span>'+r.d+' '+r.note+'</span><span style=font-weight:700;color:'+(r.in?'#5d8c52':'var(--red)')+'>'+(r.in?'+':'-')+r.amt+'</span></div>'});
  }else{
    h+='<div style=text-align:center;padding:12px;color:#5a6e5c;font-size:.7rem">暂无流水记录</div>';
  }
  d.innerHTML=h;
  var row=document.getElementById('ledgerRow');
  if(row) row.parentElement.insertBefore(d,row.nextSibling)
}
function catLedger(note){if(note.indexOf('任务')!==-1||note.indexOf('完成')!==-1)return'🎯 任务';if(note.indexOf('餐')!==-1)return'🍽️ 餐饮';if(note.indexOf('颜料')!==-1||note.indexOf('物资')!==-1||note.indexOf('采购')!==-1)return'📦 材料';if(note.indexOf('打赏')!==-1)return'🎁 打赏';if(note.indexOf('拨款')!==-1||note.indexOf('基金')!==-1)return'💰 拨款';if(note.indexOf('奖励')!==-1)return'🏆 奖励';if(note.indexOf('转入')!==-1)return'📥 转入';if(note.indexOf('转给')!==-1)return'📤 转出';if(note.indexOf('捐赠')!==-1)return'🎁 捐赠';return'📌 其他';}
function refreshLedgerCards(){
  var b=window.NT?NT.getUser(CURRENT_USER):null;
  var bal=b?b.ntBalance:0;
  var el=document.getElementById('ledgerPersonalBal');if(el)el.textContent=bal;
  // 营队/社区 NT 目前 NT 核心无 scope 隔离，暂显示"—"，等 scope 隔离后差异化
  el=document.getElementById('ledgerCampBal');if(el)el.textContent='—';
  el=document.getElementById('ledgerCommunityBal');if(el)el.textContent='—';
  // RMB 金库独立于 NT 系统，数据来源不变
  el=document.getElementById('ledgerCampRmb');if(el){
    var campRmb=(window.AppData&&AppData._data.campRmb)?AppData._data.campRmb:0;
    el.textContent=campRmb;
  }
}
// ═══ Bridge: window.Game — 地图 iframe 通过 parent.Game 调用主应用 ═══
window.Game = {
  getUser: function() {
    var name = CURRENT_USER;
    var u = (window.AppData) ? AppData.me() : null;
    if (u && u.name) name = u.name;
    var users = (typeof getUsers === 'function') ? getUsers() : {};
    var role = (u && u.role) ? u.role : ((users[name] && users[name].role) || 'visitor');
    // avatar_seed 优先级: AppData > nt_users > 用户名
    var seed = (u && u.avatar_seed != null) ? u.avatar_seed
             : ((users[name] && users[name].avatar_seed != null) ? users[name].avatar_seed : (name||_avatarSeedPool[0]));
    return { name: name, role: role, avatar_seed: seed, avatar_url: avatarURL(seed, 80) };
  },
  getData: function() {
    var ad = (window.AppData && AppData._data) ? AppData._data : {};
    return {
      spaces: ad.spaces || {},
      inventory: ad.inventory || {},
      map_locations: ad.map_locations || { buildings: [], plots: [], accommodations: {}, people_on_site: [], state: {}, config: {} },
      member_locations: ad.member_locations || {}
    };
  },
  setMemberLocation: function(buildingId) {
    if (window.AppData) AppData.setMemberLocation(buildingId);
  },
  openTask: function(taskId) { openQuestHallPage(); },
  toast: function(msg) { showToast(msg); },
  confirm: function(title, message, onConfirm) {
    if (confirm(title + '\n\n' + message)) { setTimeout(onConfirm, 0); }
  },
  openCamp: function(campId) { openCampHome(campId); },
  refresh: function() { if (window.AppData) AppData._saveShared(); if (typeof refreshUserUI === 'function') refreshUserUI(); }
};
// NT 用户注册已在 AppData._seedIfEmpty() 中处理
// A2 过渡：TASKS 别名指向 AppData
// A2 过渡完成：TASKS 直接指向 AppData。旧种子数据 _OLD_TASKS 已废弃。
// R9: 社区管理面板
function openAdminPanel() {
  // F13: 角色从服务端权威来源读取，离线时 fallback localStorage
  var role = (typeof API !== 'undefined' && API.user && API.user.role) ? API.user.role
           : ((typeof getUsers === 'function' ? getUsers() : {})[CURRENT_USER] || {}).role;
  if (role !== 'admin') { showToast('仅管理员可访问', 'error'); return; }
  var h = '<div style="background:#fff;border-radius:16px;width:360px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)">';
  h += '<div style="padding:16px;border-bottom:1px solid #f0f0f0"><span style="font-weight:700;font-size:.82rem">⚙️ 社区管理</span></div>';
  h += '<div style="padding:12px 16px">';

  // 待审核新人
  h += '<div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin-bottom:6px">📋 待审核</div>';
  h += '<div id="adminPendingList" style="margin-bottom:12px;font-size:.65rem;color:#aaa">加载中…</div>';

  // 发布社区任务
  h += '<div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin-bottom:6px">📝 发布社区任务</div>';
  h += '<input id="adminTaskTitle" placeholder="任务标题" style="width:100%;padding:8px;border:1px solid #d0d9ce;border-radius:8px;font-size:.7rem;margin-bottom:6px;box-sizing:border-box">';
  h += '<div style="display:flex;gap:6px;margin-bottom:6px">';
  h += '<input id="adminTaskReward" type="number" value="5" min="1" placeholder="NT" style="flex:1;padding:8px;border:1px solid #d0d9ce;border-radius:8px;font-size:.7rem">';
  h += '<input id="adminTaskSlots" type="number" value="1" min="1" placeholder="人数" style="flex:1;padding:8px;border:1px solid #d0d9ce;border-radius:8px;font-size:.7rem">';
  h += '</div>';
  h += '<button class="btn-pri" style="width:100%;font-size:.7rem;padding:8px" onclick="_adminPublishTask()">✅ 发布（从社区池扣款）</button>';

  h += '</div>';
  h += '<button class="btn-sm sec" style="width:calc(100% - 32px);margin:0 16px 16px;font-size:.62rem" onclick="closeDiscoveryForm()">关闭</button>';
  h += '</div>';
  _showModal ? _showModal(h) : (function(){ var o=document.createElement('div'); o.className='disc-modal-overlay'; o.style.cssText='position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)'; o.innerHTML=h; o.onclick=function(e){if(e.target===o)o.remove()}; document.body.appendChild(o); })();

  // 异步加载待审核列表
  if (typeof API !== 'undefined' && API.token) {
    API.request('GET', '/api/admin/pending-newbie').then(function(data) {
      var el = document.getElementById('adminPendingList');
      if (!el) return;
      if (Array.isArray(data) && data.length) {
        el.innerHTML = data.map(function(v) {
          return '<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:.62rem">' +
            '👤 ' + esc(v.doer) + ' · ' + esc(v.action) + ' · +' + v.nt_amount + 'NT ' +
            '<span style="color:var(--green-primary);cursor:pointer" onclick="AppData.verifyAction(\''+v.id+'\',CURRENT_USER,true);setTimeout(function(){openAdminPanel()},500)">[通过]</span> ' +
            '<span style="color:var(--red);cursor:pointer" onclick="AppData.verifyAction(\''+v.id+'\',CURRENT_USER,false);setTimeout(function(){openAdminPanel()},500)">[退回]</span></div>';
        }).join('');
      } else {
        el.innerHTML = '✅ 暂无待审核';
      }
    }).catch(function() { el.innerHTML = '加载失败'; });
  }
}

function _adminPublishTask() {
  var title = document.getElementById('adminTaskTitle').value.trim();
  if (!title) { showToast('请输入任务标题', 'warn'); return; }
  var reward = parseInt(document.getElementById('adminTaskReward').value, 10) || 5;
  var slots = parseInt(document.getElementById('adminTaskSlots').value, 10) || 1;
  if (typeof API !== 'undefined' && API.token) {
    API.request('POST', '/api/tasks', {title:title, reward:reward, slots:slots, scope:'社区', poster:'社区'}).then(function(r) {
      if (r.ok) { showToast('社区任务已发布', 'ok'); closeDiscoveryForm(); }
      else { showToast(r.detail||'发布失败', 'error'); }
    }).catch(function() { showToast('网络错误', 'error'); });
  } else {
    // offline fallback — 检查角色权限
    var role = (getUsers()[CURRENT_USER] || {}).role;
    if (role !== 'admin') { showToast('仅管理员可发布社区任务', 'warn'); return; }
    var t = { name: 'T_'+Date.now().toString(36), title:title, type:'other', nt:reward, scope:'社区', status:'进行中', publisher:'社区', slots:slots, note:'', claimants:[], action:'' };
    AppData._data.tasks[t.name] = t;
    showToast('社区任务已发布（离线）', 'ok');
    closeDiscoveryForm();
  }
}

// ── 管理员配置 ──
function openAdminConfig(){
  var cfg = (window.AppData&&AppData._data.map_locations&&AppData._data.map_locations.config) ? AppData._data.map_locations.config : {};
  var p = cfg.cleaning_pricing||{}; document.getElementById('cfgCleanDirty').value=p.dirty||20; document.getElementById('cfgCleanWarn').value=p.warning||15; document.getElementById('cfgCleanOk').value=p.clean||5;
  var r = cfg.nt_rewards||{}; document.getElementById('cfgStockIn').value=r.stock_in||2; document.getElementById('cfgStockOut').value=r.stock_out||1; document.getElementById('cfgCleanReward').value=r.cleaning||10;
  document.getElementById('cfgExpiryDays').value=cfg.item_expiry_days||5;
  var t=cfg.dirtiness_thresholds||{}; document.getElementById('cfgThGreen').value=t.green||30; document.getElementById('cfgThYellow').value=t.yellow||60; document.getElementById('cfgThRed').value=t.red||80;
  var _cfgOverlay=document.createElement('div'); _cfgOverlay.className='ci-overlay';
  _cfgOverlay.innerHTML='<div class="ci-card"><div class="ci-head"><span class="ci-title">⚙️ 地图配置</span><button class="ci-close" onclick="this.closest(\'.ci-overlay\').remove()">✕</button></div>'+document.getElementById('overlayAdminConfig').querySelector('.overlay-body').innerHTML+'</div>';
  _cfgOverlay.addEventListener('click',function(e){if(e.target===_cfgOverlay)_cfgOverlay.remove()});
  document.body.appendChild(_cfgOverlay);
}
function saveAdminConfig(){
  if(!window.AppData)return;
  var cu=(typeof getUsers==='function'?getUsers():{})[CURRENT_USER];
  if(!cu||cu.role!=='admin'){showToast('权限不足，仅管理员可操作','error');return;}
  var ml = AppData._data.map_locations || {};
  ml.config = ml.config || {};
  ml.config.cleaning_pricing = { dirty: parseInt(document.getElementById('cfgCleanDirty').value,10)||20, warning: parseInt(document.getElementById('cfgCleanWarn').value,10)||15, clean: parseInt(document.getElementById('cfgCleanOk').value,10)||5 };
  ml.config.nt_rewards = { stock_in: parseInt(document.getElementById('cfgStockIn').value,10)||2, stock_out: parseInt(document.getElementById('cfgStockOut').value,10)||1, cleaning: parseInt(document.getElementById('cfgCleanReward').value,10)||10 };
  ml.config.item_expiry_days = parseInt(document.getElementById('cfgExpiryDays').value,10)||5;
  ml.config.dirtiness_thresholds = { green: parseInt(document.getElementById('cfgThGreen').value,10)||30, yellow: parseInt(document.getElementById('cfgThYellow').value,10)||60, red: parseInt(document.getElementById('cfgThRed').value,10)||80 };
  // 保留现有 dirtiness_rates（从 config 或默认值）
  ml.config.dirtiness_rates = ml.config.dirtiness_rates || { bathroom:15, kitchen:10, hallway:8, studio:8, bedroom:5, laundry:5, storage:3, outdoor:2, field:0 };
  AppData._saveShared();
  var _co=document.querySelector('.ci-overlay'); if(_co)_co.remove();
  showToast('✅ 地图配置已保存','ok');
}
// ── 成员选择 Sheet ──
var _memberPickerTarget = null, _memberPickerSelected = null;
function showMemberPicker(targetInputId) {
  _memberPickerTarget = targetInputId;
  _memberPickerSelected = null;
  document.getElementById('memberPickerSearch').value = '';
  document.getElementById('memberPickerSheet').style.display = 'flex';
  renderMemberPicker();
}
function closeMemberPicker() {
  document.getElementById('memberPickerSheet').style.display = 'none';
  _memberPickerTarget = null;
}
function renderMemberPicker() {
  var users = typeof getUsers === 'function' ? getUsers() : {};
  var search = (document.getElementById('memberPickerSearch').value || '').trim().toLowerCase();
  var list = Object.keys(users).filter(function(name) {
    return !search || name.toLowerCase().indexOf(search) !== -1;
  });
  var h = '';
  list.forEach(function(name) {
    var u = users[name];
    if (name === CURRENT_USER) return; // 不能选自己
    var seed = u.avatar_seed || 0;
    var avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + seed + '&size=56';
    var online = u._online ? '🟢' : '🔴';
    h += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:.78rem" onclick="selectMemberPicker(\'' + name + '\')">'+
      '<img src="' + avatarUrl + '" width="28" height="28" style="border-radius:50%;object-fit:cover" alt="" onerror="this.outerHTML=\'<div style=width:28px;height:28px;border-radius:50%;background:#e8ede6;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#5a6e5c>\'+name.charAt(0)+\'</div>\'">'+
      '<span style="flex:1">' + name + '</span>'+
      '<span style="font-size:.65rem;color:#5a6e5c">' + (u.role==='admin'?'🧙':u.role==='builder'?'🧱':u.role==='adventurer'?'⚔️':u.role==='npc'?'👥':'🏕️') + '</span>'+
      '<span style="font-size:.6rem">' + online + '</span>'+
    '</div>';
  });
  if (!h) h = '<div style="text-align:center;padding:20px;color:#8a8a8a;font-size:.72rem">没有可选的成员</div>';
  document.getElementById('memberPickerList').innerHTML = h;
}
function selectMemberPicker(name) {
  if (_memberPickerTarget === '_builderPick') { closeMemberPicker(); onBuilderPicked(name); return; }
  _memberPickerSelected = name;
  var displayEl = document.getElementById(_memberPickerTarget);
  if (displayEl) displayEl.textContent = name;
  closeMemberPicker();
}
function onBuilderPicked(name) {
  if (!_campDraft) return;
  var taskChoices = _builderPendingTasks;
  var taskNames = [];
  if (taskChoices.length) {
    var list = taskChoices.map(function(t, i) { return (i+1)+'. '+t.name+' ('+t.nt+'NT)'; }).join('\n');
    var sel = prompt('分配任务（序号逗号分隔，留空=全选）：\n'+list);
    if (sel) {
      var idxs = sel.split(',').map(function(s){ return parseInt(s.trim())-1; }).filter(function(i){ return i>=0 && i<taskChoices.length; });
      taskNames = idxs.map(function(i){ return taskChoices[i].name; });
    } else { taskNames = taskChoices.map(function(t){ return t.name; }); }
  }
  var totalNT = _campDraft.step4.tasks.filter(function(t){ return taskNames.indexOf(t.name)!==-1; }).reduce(function(s,t){ return s+t.nt; },0);
  _campDraft.step5.builders.push({ name:name, taskNames:taskNames, totalNT:totalNT, confirmed:false });
  if (typeof changeUserRole === 'function') { changeUserRole(name, 'builder', { skipAdventurerCheck: true }); }
  showToast(name + ' 已添加为共建人', 'ok');
  renderWizardStep(5);
}
var _secFold={claimable:false,active:false,done:false};
var _pollTimer = null;
// M5: 离线指示器
(function(){
  var _offBar = document.createElement('div'); _offBar.id = '_offlineBar';
  _offBar.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:9999;height:3px;background:#f0a030;text-align:center;font-size:.55rem;color:#fff;line-height:18px;padding:1px';
  _offBar.textContent = '📡 离线';
  document.body.appendChild(_offBar);
  function _update(){ _offBar.style.display = navigator.onLine ? 'none' : 'block'; }
  window.addEventListener('online',_update); window.addEventListener('offline',_update);
  _update();
})();
function _startPolling() {
  if (_pollTimer) return;
  if (typeof API === 'undefined' || !API.token) return;
  var _pollInterval = 30000;  // C4: 30s 全量同步
  function _pollCycle() {
    API.request('GET', '/api/nt/sync').then(function(srv) {
      if (srv && (srv.detail === 'unauthorized' || srv.error === '登录过期')) { _stopPolling(); return; }
      if (srv && !srv.detail) { _mergeNTSyncData(srv); }
      // F15: 每次成功 sync 后排空离线 earn 队列
      if (window.AppData && typeof AppData._drainPendingEarns === 'function') AppData._drainPendingEarns();
    }).catch(function(e){console.warn('[poll] sync failed',e)});
    // 退避
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    _pollInterval = (typeof API !== 'undefined' && API._serverOnline === false)
      ? Math.min(_pollInterval * 2, 120000) : 30000;
    _pollTimer = setInterval(_pollCycle, _pollInterval);
  }
  _pollCycle();  // 立即执行首次，后续由内部 setInterval 递归调度
}
function _stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}
function openQuestHallPage(){
  var users = typeof getUsers==='function'?getUsers():{};
  var role = (users[CURRENT_USER]||{}).role||'visitor';
  var isCampMember = isMemberByRole(role);
  var isOnsite = isMemberByRole(role);
  var campChip = document.querySelector('#questHallBody .my-fchip[onclick*="营队"]');
  if (campChip) campChip.style.display = isCampMember ? '' : 'none';
  // R8.2: 非在地成员隐藏二级chip + 恢复一级chip全选
  var secChips = document.getElementById('secondaryChips');
  if (secChips) secChips.style.opacity = isOnsite ? '' : '0.4';
  // 从 API 拉取最新任务（完成后刷新列表）
  if(typeof API!=='undefined'&&API.token){
    API.fetchTasks(function(tasks){
      if(tasks){tasks.forEach(function(t){
        t.publisher = t.poster || t.publisher;
        // 按 ID 或标题去重
        var exists = AppData._data.tasks[t.id];
        if(!exists){
          var localTasks = Object.values(AppData._data.tasks);
          exists = localTasks.find(function(lt){return lt.title===t.title && lt.publisher===t.poster;});
        }
        if(!exists){
          AppData._data.tasks[t.id] = {name:t.id,title:t.title,type:t.category,nt:t.reward,scope:t.scope,status:t.status,publisher:t.poster,deadline:t.deadline,reviewer:t.reviewer,slots:t.slots,note:t.note,claimants:[],action:'',is_system_generated:t.is_system_generated||false};
        }
      })}
      filterQuests();
    });
  } else { filterQuests(); }
  if (typeof _pushOverlay === 'function') _pushOverlay('overlayQuestHall');
  document.getElementById('overlayQuestHall').classList.add('open');
}
function filterQuests(){
  // R8: 一级chip限定 primary-filters 作用域
  var chip=document.querySelector('#questHallBody .primary-filters .my-fchip.on');
  var scope=chip?chip.textContent:'全部';
  // R8: 二级chip（来源过滤）
  var srcChip=document.querySelector('#questHallBody .secondary-filters .my-fchip.on');
  var sourceFilter=srcChip?srcChip.textContent:'全部来源';
  var kw=document.getElementById('questSearchInput');
  var keyword=(kw&&kw.value||'').trim().toLowerCase();
  var items=Object.values(TASKS);
  // scope filter
  if(scope==='营队') items=items.filter(function(t){return t.scope==='营队'});
  else if(scope==='个人委托') items=items.filter(function(t){return t.scope==='个人'});
  else if(scope==='社区') items=items.filter(function(t){return t.scope==='社区'});
  // R8: source filter (二级chip)
  if(sourceFilter==='周期任务') items=items.filter(function(t){return t.is_system_generated});
  else if(sourceFilter==='个人发布') items=items.filter(function(t){return !t.is_system_generated && t.poster!=='社区'});
  else if(sourceFilter==='赏金') items=items.filter(function(t){return t.poster==='社区' && !t.is_system_generated});
  // keyword
  if(keyword) items=items.filter(function(t){return (t.name||'').toLowerCase().indexOf(keyword)!==-1||(t.title||'').toLowerCase().indexOf(keyword)!==-1||(t.note||'').toLowerCase().indexOf(keyword)!==-1||(t.publisher||'').toLowerCase().indexOf(keyword)!==-1});
  // sections
  var claimable=items.filter(function(t){return t.status==='进行中'&&(t.claimants||[]).length===0});
  var active=items.filter(function(t){return t.status==='待提交'||t.status==='待审核'||t.status==='退回修改'||(t.status==='进行中'&&(t.claimants||[]).length>0)});
  var done=items.filter(function(t){return t.status==='待结算'||t.status==='已结算'||t.status==='已完成'});
  // B3: 已取消/已争议任务不再从大厅消失
  var closed=items.filter(function(t){return t.status==='已取消'||t.status==='已争议'});
  function typedColor(t){return t==='主线'?{c:'var(--green-primary)',b:'#e8f0e8',icon:'🎯'}:t==='支线'?{c:'#c8892e',b:'#fef8e8',icon:'📋'}:{c:'#4a7a82',b:'#e0eaee',icon:'🧹'}}
  // section renderer
  function renderSection(label,emoji,arr,key){
    var h='';
    var f=_secFold[key];
    h+='<div class="section-head" onclick="toggleSection(\''+key+'\')"><span>'+emoji+' '+label+' ('+arr.length+')</span><span>'+(f?'▸ 展开':'▾ 收起')+'</span></div>';
    if(!f){arr.forEach(function(t){var tc=typedColor(t.type);h+=questCard(t,tc.c,tc.b,tc.icon)})}
    return h;
  }
  var h='';
  h+=renderSection('待领取','🟢',claimable,'claimable');
  if(!claimable.length) h+='<div style="font-size:.65rem;color:#5a5a5a;padding:0 0 8px">暂无待领取任务，<span style="color:var(--green-primary);cursor:pointer;text-decoration:underline" onclick="openPublishTask()">+ 发布委托</span> 创建新任务</div>';
  h+=renderSection('进行中','📋',active,'active');
  h+=renderSection('最近完成','✅',done,'done');
  h+=renderSection('已取消/已争议','🚫',closed,'closed');
  var list=document.getElementById('questList');if(list)list.innerHTML=h||'<div style="text-align:center;padding:40px;color:#5a6e5c">🏛️<br><br>没有匹配的任务</div>';
}
function toggleSection(key){_secFold[key]=!_secFold[key];if(key.indexOf('my')===0)renderMyTasks();else filterQuests()}
// FIX-16: 统一任务卡片渲染。questCard 和 myCard 共用此函数。
// opts: { context:'hall'|'my', showReviewBtn:bool }
function renderTaskCard(t, opts) {
  var ctx = opts && opts.context || 'hall';
  // R8: 系统任务蓝色边框，赏金任务黄色边框
  var tc = t.is_system_generated ? {c:'#4a8aaa',b:'#e0eaf4',icon:'🤖'}
         : t.poster==='社区' ? {c:'#c8892e',b:'#fef8e8',icon:'🏛️'}
         : t.type==='主线'?{c:'var(--green-primary)',b:'#e8f0e8',icon:'🎯'}
         : t.type==='支线'?{c:'#c8892e',b:'#fef8e8',icon:'📋'}
         : {c:'#4a7a82',b:'#e0eaee',icon:'🧹'};
  var cls = t.type==='支线'?'task-type-side':t.type==='日常'?'task-type-daily':'task-type-main';
  var claimed = t.claimants||[]; var slots = t.slots||1;
  var remain = Math.max(0, slots-claimed.length);
  var claimLine = '👤 '+claimed.length+'/'+slots+'人'+(remain>0?' · '+remain+'空位':'');
  var overdue = isTaskOverdue(t);
  if(overdue) claimLine += ' · ⚠️逾期';
  var cardCls = '';
  if(t.status==='待审核'||t.status==='退回修改') cardCls=' warn';
  else if(t.status==='待提交') cardCls=' urgent';
  else if(t.status==='已完成'||t.status==='已结算'||t.status==='待结算') cardCls=' done';
  else if(t.status==='已取消'||t.status==='已争议') cardCls=' closed';
  var isMyClaim = claimed.some(function(c){return c.name===CURRENT_USER});
  var isPublisher = t.publisher===CURRENT_USER;
  var rightEl = '';
  if(ctx==='my'&&opts.showReviewBtn&&t.reviewer===CURRENT_USER&&t.status==='待审核'){
    rightEl = '<div class="task-review"><span class="rv-ok" onclick="event.stopPropagation();reviewTask(\''+esc(t.name)+'\',\'approve\')">✓</span><span class="rv-no" onclick="event.stopPropagation();reviewTask(\''+esc(t.name)+'\',\'reject\')">✕</span></div>';
  }
  var quickBtn = '';
  if(t.status==='进行中'&&!isMyClaim&&!isPublisher){
    quickBtn = '<button class=btn-pri style=padding:2px 8px;font-size:.68rem;border-radius:4px;white-space:nowrap" onclick="event.stopPropagation();claimTask(\''+esc(t.name)+'\')">🎯认领</button>';
  }
  var h = '<div class="task-card'+cardCls+'" style="border-left:3px solid '+tc.c+'" onclick="event.stopPropagation();toggleQuestCard(this,\''+esc(t.name)+'\')">';
  h += '<div class="task-left '+cls+'">'+tc.icon+'</div><div class="task-body">';
  h += '<div class="task-row1"><span class="task-name">'+esc(t.name)+'</span><span class="task-nt"><img src=豆子.png alt=NT onerror="this.outerHTML=\'🌱\'" style=width:18px;height:18px;vertical-align:middle;margin-right:3px>'+t.nt+' NT</span></div>';
  h += '<div class="task-row2">';
  h += '<span class="task-chip '+cls+'">'+t.type+'</span>';
  // R8: poster='社区' 特殊显示
  if(t.publisher==='社区') h += '<span>🏛️社区发布</span>';
  else if(t.publisher) h += '<span>👤'+esc(t.publisher)+(t.publisher===CURRENT_USER?'(我)':'')+'发布</span>';
  h += '<span>'+claimLine+'</span>';
  if(quickBtn) h += '<span style=margin-left:auto>'+quickBtn+'</span>';
  h += '</div></div>';
  if(!quickBtn&&rightEl) h += rightEl;
  h += '</div>';
  return h;
}
function questCard(t,color,bg,icon){return renderTaskCard(t,{context:'hall'});}
function toggleQuestCard(el,name){
  if(!el)return;
  if(!el.classList.contains('task-card')) el=el.closest('.task-card');
  if(!el)return;
  var t=TASKS[name];if(!t)return;
  // Collapse: find any expand right after this card and remove it
  var nxt=el.nextElementSibling;
  if(nxt&&(nxt.classList.contains('card-expand')||nxt.classList.contains('submit-expand')||nxt.classList.contains('settle-expand')||nxt.classList.contains('withdraw-expand')||nxt.classList.contains('review-expand')||nxt.classList.contains('unclaim-expand'))){nxt.style.maxHeight=nxt.scrollHeight+'px';nxt.style.transition='max-height .2s ease-out,opacity .2s ease-out';nxt.style.overflow='hidden';requestAnimationFrame(function(){nxt.style.maxHeight='0';nxt.style.opacity='0'});setTimeout(function(){nxt.remove()},200);el.scrollIntoView({behavior:'smooth',block:'nearest'});return}
  // Remove all other floating expands EXCEPT cards themselves
  document.querySelectorAll('.card-expand,.submission-sub,.submit-expand,.withdraw-expand,.settle-expand,.review-expand,.unclaim-expand').forEach(function(c){c.remove()});
  var d=document.createElement('div');d.className='card-expand';
  d.style.cssText='margin-bottom:16px;background:#fafbfa;border:1px solid var(--green-border);border-radius:10px;padding:14px;font-size:.88rem;animation:fadeIn .2s ease-out;border-bottom:3px solid var(--green-border)';
  var h='';var cs=t.claimants||[];var slots=t.slots||1;var remain=Math.max(0,slots-cs.length);
  // 说明
  if(t.note) h+='<div style=background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e8ede6;line-height:1.5;margin-bottom:8px>'+esc(t.note)+'</div>';
  // 时间线（完整链路）
  h+='<div style=margin-bottom:8px><div style=font-size:.72rem;color:#5a5a5a;margin-bottom:3px>🕐 时间线</div>';
  h+='<div style=display:flex;flex-direction:column;gap:3px;font-size:.78rem;color:#5a6e5c>';
  if(t.deadline){var isOverdue=t.deadline<(today())&&t.status!=='已结算';h+='<div style=color:'+(isOverdue?'var(--red)':'#5a6e5c')+'>⏰ 截止：'+t.deadline+(isOverdue?' ⚠️已逾期':'')+'</div>'}
  if(t.claimedAt) h+='<div>'+t.claimedAt+' 📥 领取</div>';
  cs.forEach(function(c){if(c.submittedAt) h+='<div>'+c.submittedAt+' 📤 '+esc(c.name)+' 提交</div>'});
  if(t.reviewedAt) h+='<div>'+t.reviewedAt+' 🔍 审核通过</div>';
  else if(t.status==='待审核') h+='<div>🔍 等待审核…</div>';
  if(t.completedAt) h+='<div>'+t.completedAt+' ✅ 完成</div>';
  if(t.status==='待结算') h+='<div style=color:#c8892e>🧾 待结算</div>';
  else if(t.status==='已结算') h+='<div style=color:#5d8c52>🧾 已结算 · '+esc(t.settler||t.settler_id||t.publisher||'')+'</div>';
  h+='</div></div>';
  // 谁会领了+空位
  if(cs.length>0){
    var names=cs.map(function(c){return c.name}).join(' · ');
    h+='<div style=font-size:.78rem;color:#5a6e5c;margin-bottom:6px>👥 '+names+' 已领'+(remain>0?' · 还有 '+remain+' 空位':'')+'</div>';
  }else h+='<div style=font-size:.78rem;color:#5a6e5c;margin-bottom:6px>👥 无人领取 · '+remain+' 空位</div>';
  // 退回意见
  if(t.reviewNote) h+='<div style=background:#fff5f5;padding:8px 10px;border-radius:8px;border:1px solid #f0c8c8;margin-bottom:6px><span style=font-size:.62rem;color:var(--red)>🔙 '+esc(t.reviewNote)+'</span></div>';
  // 审核人
  if(t.reviewer&&(t.status==='待审核'||t.status==='退回修改'||t.action==='submit'||t.action==='edit')) h+='<div style=font-size:.62rem;color:#5a6e5c;margin-bottom:4px>✅ 审核人：'+esc(t.reviewer)+'</div>';
  if(t.status==='已结算'&&t.settler) h+='<div style=font-size:.62rem;color:#5a6e5c;margin-bottom:4px>🧾 结算人：'+t.settler+'</div>';
  // T10: 多人任务提交进度
  if(t.slots>1&&(t.status==='进行中'||t.status==='待提交')){
    var evMap={};try{if(t.evidence)evMap=JSON.parse(t.evidence)}catch(e){}
    var subN=Object.keys(evMap).length;
    if(subN>0)h+='<div style=font-size:.68rem;color:var(--green-primary);margin-bottom:4px;font-weight:600>📤 '+subN+'/'+t.slots+' 已提交</div>';
  }
  // 操作按钮
  var btns='';var inHall=el.closest('#questHallBody')!==null;
  var isMyClaim=cs.some(function(c){return c.name===CURRENT_USER});
  var isReviewer=t.reviewer===CURRENT_USER||(!t.reviewer&&t.publisher===CURRENT_USER);
  var isPublisher=t.publisher===CURRENT_USER;
  var isSettler=(t.settler||t.settler_id||t.publisher)===CURRENT_USER;
  if(t.status==='draft') btns='<div style=display:flex;justify-content:space-between;gap:12px><button class="btn-sm pri" onclick="publishDraft(\''+esc(t.name)+'\')">✅ 发布草稿</button><button class="btn-sm danger" onclick="deleteDraft(\''+esc(t.name)+'\')">🗑️ 删除</button></div>';
  else if(t.status==='进行中'||t.status==='待提交'){
    if(isPublisher&&cs.length===0) btns='<button class="btn-sm pri" style=margin-right:6px onclick="editTask(\''+esc(t.name)+'\')">✏️ 编辑</button><button class="btn-sm danger" onclick="withdrawTask(\''+esc(t.name)+'\')">🗑️ 撤回</button>';
    else if(isPublisher&&cs.length>0&&!inHall) btns='<button class="btn-sm danger" onclick="requestWithdraw(\''+esc(t.name)+'\')">📩 申请撤回</button>';
    else if(isMyClaim&&!cs.some(function(c){return c.name===CURRENT_USER&&c.submission})){
      if(isTaskOverdue(t)) btns='<span style=font-size:.62rem;color:var(--red);background:#fde8e8;padding:4px 10px;border-radius:8px">⏰ 已逾期，无法提交</span>';
      else btns='<div style=display:flex;justify-content:space-between;gap:12px><button class="btn-sm pri" onclick="openSubmit(this,\''+esc(t.name)+'\')">📤 提交</button><button class="btn-sm sec" onclick="unclaimTask(\''+esc(t.name)+'\')">📩 取消认领</button></div>';
    }
    else if(!isMyClaim&&!isPublisher) btns='<button class="btn-sm pri" onclick="claimTask(\''+esc(t.name)+'\')">🎯 认领</button>';
    else if(isPublisher&&!isMyClaim) btns='<span style=font-size:.62rem;color:#5a5a5a;background:#f0f0f0;padding:4px 10px;border-radius:8px">⏳ 自己的任务</span>';
    else btns='<span style=font-size:.62rem;color:#5a6e5c;background:#f0f0f0;padding:4px 10px;border-radius:8px">⏳ 等待中</span>';
  }else if(t.status==='待审核'){
    if(isReviewer) btns='<div style=display:flex;justify-content:space-between;gap:12px><button class="btn-sm pri" onclick="reviewTask(\''+esc(t.name)+'\',\'approve\')">✓ 通过</button><button class="btn-sm danger" onclick="reviewTask(\''+esc(t.name)+'\',\'reject\')">✕ 打回</button></div>';
    else if(isMyClaim) btns='<span style=font-size:.62rem;color:#c8892e;background:#fff8e8;padding:4px 10px;border-radius:8px">🔍 等待审核</span>';
  }else if(t.status==='退回修改'){
    if(isMyClaim){
      if(isTaskOverdue(t)) btns='<span style=font-size:.62rem;color:var(--red);background:#fde8e8;padding:4px 10px;border-radius:8px">⏰ 已逾期，无法重新提交</span>';
      else btns='<button class="btn-sm pri" onclick="openSubmit(this,\''+esc(t.name)+'\')">📤 重新提交</button>';
    }
  }else if(t.status==='待结算'||t.status==='已完成'){
    if(isSettler&&!inHall&&t.status==='待结算') btns='<button class="btn-sm pri" onclick="settleTask(\''+esc(t.name)+'\')">🧾 确认结算</button>';
    else btns='<span style=font-size:.62rem;color:#c8892e;background:#fff8e8;padding:4px 10px;border-radius:8px">🧾 待结算</span>';
  }else if(t.status==='已结算') btns='<span style=font-size:.62rem;color:#5d8c52;background:#e0ece0;padding:4px 10px;border-radius:8px">✅ 已结算</span>';
  if(btns) h+='<div style=margin-bottom:6px>'+btns+'</div>';
  // 提交成果头像（DiceBear，名字在下方，每行5个）
  var done=cs.filter(function(c){return c.submission});
  if(done.length){
    h+='<div style=border-top:1px solid #e8ede6;padding-top:8px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap>';
    done.forEach(function(c){
      var cu=getUsers()[c.name];var cs=(cu&&cu.avatar_seed!==undefined)?cu.avatar_seed:c.name;
      var url=avatarURL(cs,48);
      h+='<div style=text-align:center;cursor:pointer;width:52px" onclick="event.stopPropagation();toggleClaimantSub(this,\''+esc(t.name)+'\',\''+esc(c.name)+'\')">';
      h+='<img src="'+url+'" width="36" height="36" style="border-radius:50%;object-fit:cover;border:2px solid var(--green-primary)" alt="" onerror="this.style.opacity=\'0\'">';
      h+='<div style=font-size:.55rem;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap>'+esc(c.name)+'</div></div>';
    });
    h+='</div>';
  }
  d.innerHTML=h;el.parentElement.insertBefore(d,el.nextSibling)
}
function toggleClaimantSub(el,name,cname){
  var cardExpand=el.closest('.card-expand');if(!cardExpand)return;
  var sub=cardExpand.nextElementSibling;
  if(sub&&sub.classList.contains('submission-sub')){
    if(sub.getAttribute('data-claimant')===cname){sub.remove();return}
    sub.remove();
  }
  document.querySelectorAll('.submission-sub').forEach(function(s){s.remove()});
  var t=TASKS[name];if(!t)return;
  var c=(t.claimants||[]).find(function(x){return x.name===cname});if(!c||!c.submission)return;
  var sd=document.createElement('div');sd.className='submission-sub';
  sd.setAttribute('data-claimant',cname);
  sd.style.cssText='margin-bottom:8px;background:#fff;border:1px solid var(--green-border);border-radius:8px;padding:10px 12px;font-size:.85rem;animation:fadeIn .2s ease-out;border-left:3px solid var(--green-primary)';
  sd.innerHTML='<div style=font-weight:700;margin-bottom:4px;font-size:.7rem>🧑 '+cname+' 的提交 · '+(c.submittedAt||'')+'</div><div style=color:#5a6e5c;line-height:1.5>'+esc(c.submission)+'</div>';
  cardExpand.parentElement.insertBefore(sd,cardExpand.nextSibling)
}
// Publish Task
// PUB_USERS 已删除——改为 live call Object.keys(getUsers()) inside filterReviewers/filterPubTargets
function onPubScopeChange(){
  var v=document.getElementById('pubScope').value;
  var picker=document.getElementById('pubTargetPicker');
  if(v==='specific'){
    if(!picker){
      var s=document.getElementById('pubScope');
      picker=document.createElement('div');picker.id='pubTargetPicker';
      picker.style.cssText='margin-bottom:8px';
      s.parentElement.parentElement.after(picker);
    }
    var sel=document.getElementById('pubTarget');if(!sel){sel=document.createElement('input');sel.type='hidden';sel.id='pubTarget';document.getElementById('overlayPublishTask').appendChild(sel)}
    picker.innerHTML='<label style="font-size:.65rem;font-weight:600;color:#5a6e5c;margin-bottom:3px;display:block">指定领取人</label>'+
      '<div style=position:relative><input id="pubTargetSearch" class="login-input" placeholder="🔍 搜索名字…" autocomplete="off" oninput="filterPubTargets()" onfocus="filterPubTargets()" style="margin:0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.75rem;padding:8px" value="'+(sel.value||'')+'">'+
      '<div id="pubTargetList" style="position:absolute;top:100%;left:0;right:0;z-index:50;background:#fff;border:1px solid var(--green-border);border-radius:8px;max-height:180px;overflow-y:auto;display:none;box-shadow:0 4px 12px rgba(0,0,0,.1)"></div></div>';
    filterPubTargets();
  }else{if(picker)picker.innerHTML=''}
}
function filterPubTargets(){
  var kw=(document.getElementById('pubTargetSearch')||{}).value||'';
  var list=document.getElementById('pubTargetList');if(!list)return;
  var filtered=Object.keys(getUsers()).filter(function(u){return!kw||u.indexOf(kw)!==-1});
  list.innerHTML=filtered.length?filtered.map(function(u){return'<div style="padding:8px 12px;cursor:pointer;font-size:.72rem;border-bottom:1px solid #f0f0f0" onclick="selectPubTarget(\''+esc(u)+'\')">👤 '+u+'</div>'}).join(''):'<div style="padding:8px 12px;font-size:.68rem;color:#aaa">未找到</div>';
  list.style.display='block';
}
function selectPubTarget(name){
  document.getElementById('pubTarget').value=name;
  var inp=document.getElementById('pubTargetSearch');if(inp)inp.value=name;
  document.getElementById('pubTargetList').style.display='none';
}
function selectReviewer(name){
  document.getElementById('pubReviewer').value=name;
  document.getElementById('pubReviewerList').style.display='none';
}
function filterReviewers(){
  var el=document.getElementById('pubReviewer');if(!el)return;
  var kw=el.value||'';
  var list=document.getElementById('pubReviewerList');if(!list)return;
  var filtered=Object.keys(getUsers()).filter(function(u){return!kw||u.indexOf(kw)!==-1});
  list.innerHTML=filtered.length?filtered.map(function(u){return'<div style="padding:8px 12px;cursor:pointer;font-size:.72rem;border-bottom:1px solid #f0f0f0" onclick="selectReviewer(\''+esc(u)+'\')">👤 '+u+'</div>'}).join(''):'<div style="padding:8px 12px;font-size:.68rem;color:#aaa">未找到</div>';
  list.style.display='block';
}
function onPubTypeChange(){
  var t=document.getElementById('pubType').value;
  var slots=document.getElementById('pubSlots');
  var extra=document.getElementById('pubTypeExtra');if(!extra)return;
  if(t==='日程任务'){
    slots.value=1;
    extra.innerHTML='<div class="pub-field" style="margin-bottom:8px"><label>重复周期</label><select id="pubRecur"><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="custom">自定义</option></select></div><div id="pubRecurDays" style="display:none;margin-bottom:8px"><label style="font-size:.62rem;color:#5a6e5c">重复日</label><div style="display:flex;gap:6px;flex-wrap:wrap">'+['周一','周二','周三','周四','周五','周六','周日'].map(function(d,i){return'<label style="font-size:.65rem;cursor:pointer;display:flex;align-items:center;gap:2px"><input type="checkbox" class="pubRecurDay" value="'+(i+1)+'">'+d+'</label>'}).join('')+'</div></div>';
    document.getElementById('pubRecur').onchange=function(){document.getElementById('pubRecurDays').style.display=this.value==='custom'?'block':'none'};
  }else if(t==='多人任务'){
    slots.value=Math.max(2,parseInt(slots.value,10)||2);slots.min=2;
    extra.innerHTML='<div class="pub-field" style="margin-bottom:8px"><label>人数上限</label><input type="number" id="pubSlots2" value="'+slots.value+'" min="2" style="width:100%;padding:8px 10px;border:1px solid var(--green-border);border-radius:8px;font-size:.78rem"></div>';
    document.getElementById('pubSlots2').oninput=function(){slots.value=this.value};
  }else if(t==='单人任务'){
    slots.value=1;slots.min=1;
    extra.innerHTML='<div style="font-size:.65rem;color:#5a6e5c;padding:4px 0 8px">👤 单人任务，人数固定为 1</div>';
  }else{
    slots.min=0;
    extra.innerHTML='';
  }
}
function openPublishTask(){
  document.getElementById('overlayPublishTask').classList.add('open');
  var d=document.getElementById('pubStartDate');if(d&&!d.value)d.value=today();
  // 填充地点选择
  var locSel=document.getElementById('pubLocation');if(locSel){
    var opts='<option value="">— 不关联 —</option>';
    var locs=(window.AppData&&AppData._data.map_locations&&AppData._data.map_locations.buildings)?AppData._data.map_locations.buildings:{};
    if(Array.isArray(locs)){locs.forEach(function(b){opts+='<option value="'+b.id+'">'+b.icon+' '+b.name+'</option>';});}
    locSel.innerHTML=opts;
  }
  onPubTypeChange();renderDrafts();document.getElementById('pubReviewer').value='';
}
function saveDraft(){
  var name=document.getElementById('pubName').value.trim();if(!name)return;
  var draft={name:name,type:document.getElementById('pubType').value,nt:parseInt(document.getElementById('pubNT').value,10)||0,scope:document.getElementById('pubScope').value==='all'?'社区':document.getElementById('pubScope').value,slots:parseInt(document.getElementById('pubSlots').value,10)||1,deadline:document.getElementById('pubDeadline').value,reviewer:document.getElementById('pubReviewer').value.trim(),note:document.getElementById('pubNote').value.trim(),publisher:CURRENT_USER,status:'draft',claimants:[],action:'',locationId:document.getElementById('pubLocation').value||''};
  AppData.addTask(draft);
  clearPubForm();renderDrafts();closeOverlay('overlayPublishTask');filterQuests();
}
function publishTask(){
  var name=document.getElementById('pubName').value.trim();if(!name)return;
  // Show confirm card
  var m=document.getElementById('pubConfirm');if(!m){
    m=document.createElement('div');m.id='pubConfirm';
    m.style.cssText='position:fixed;inset:0;z-index:400;display:none;align-items:center;justify-content:center';
    m.innerHTML='<div style="position:absolute;inset:0;background:rgba(0,0,0,.6)"></div><div id="pubConfirmCard" style="position:relative;width:300px;max-width:90vw;background:#fff;border-radius:16px;padding:20px;box-shadow:0 16px 48px rgba(0,0,0,.3);animation:spcPop .25s ease-out;font-size:.78rem;max-height:80vh;overflow-y:auto"></div>';
    document.body.appendChild(m);
  }
  var nt=document.getElementById('pubNT').value;
  var tp=document.getElementById('pubType').value;
  var sc=document.getElementById('pubScope');
  var scopeText=sc&&sc.selectedOptions[0]?sc.selectedOptions[0].text:'社区';
  var slots=document.getElementById('pubSlots').value;
  var dl=document.getElementById('pubDeadline').value;
  var start=document.getElementById('pubStartDate')?document.getElementById('pubStartDate').value:'';
  var rv=document.getElementById('pubReviewer').value;
  var note=document.getElementById('pubNote').value;
  var target=document.getElementById('pubTarget');
  var targetVal=target?target.value:'';
  var reqText=document.getElementById('pubReqNote').checked?'📝文字':'';
  var reqPhoto=document.getElementById('pubReqPhoto').checked?'📷照片×'+document.getElementById('pubReqPhotoCount').value:'';
  var reqFile=document.getElementById('pubReqFile').checked?'📎文件×'+document.getElementById('pubReqFileCount').value:'';
  var reqs=[reqText,reqPhoto,reqFile].filter(function(r){return r}).join(' · ')||'无';
  var recur=document.getElementById('pubRecur');
  var recurText=recur?recur.selectedOptions[0].text:'';
  var h='<button style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#5a5a5a;z-index:1" onclick="document.getElementById(\'pubConfirm\').style.display=\'none\'">✕</button>';
  h+='<div style="font-weight:700;font-size:.95rem;margin-bottom:4px;text-align:center">📋 确认发布</div>';
  h+='<div style="font-size:.68rem;color:#5a5a5a;text-align:center;margin-bottom:12px">发布后可自由撤回，有人领取后需管理员同意</div>';
  h+='<div style="display:flex;flex-direction:column;gap:8px;font-size:.72rem">';
  h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">任务名称</span><b>'+name+'</b></div>';
  h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">任务类型</span><span>'+tp+'</span></div>';
  if(recurText) h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">重复周期</span><span>'+recurText+'</span></div>';
  h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">NT 奖励</span><b style="color:var(--green-primary)">'+nt+'</b></div>';
  h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">领取范围</span><span>'+scopeText+(targetVal?' → '+targetVal:'')+'</span></div>';
  h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">人数限制</span><span>'+slots+'人</span></div>';
  if(start) h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">发布时间</span><span>'+start+'</span></div>';
  if(dl) h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">截止日期</span><span>'+dl+'</span></div>';
  if(rv) h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">审核人</span><span>👤 '+rv+'</span></div>';
  h+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a">提交要求</span><span style="font-size:.65rem">'+reqs+'</span></div>';
  if(note) h+='<div style="margin-top:4px"><div style="color:#5a5a5a;font-size:.65rem;margin-bottom:2px">任务说明</div><div style="background:#f8f8f8;padding:10px;border-radius:8px;line-height:1.5;font-size:.7rem">'+note+'</div></div>';
  h+='</div>';
  h+='<div style="display:flex;gap:8px;margin-top:14px"><button class="btn-sm sec" style=flex:1 onclick="document.getElementById(\'pubConfirm\').style.display=\'none\'">← 返回修改</button><button class="btn-sm pri" style=flex:1 onclick="doPublish()">✅ 确认发布</button></div>';
  document.getElementById('pubConfirmCard').innerHTML=h;
  document.getElementById('pubConfirm').style.display='flex';
}
var _publishing = false;
function doPublish(){
  if (_publishing) return; _publishing = true;
  var name=document.getElementById('pubName').value.trim();if(!name){_publishing=false;return}
  var target=document.getElementById('pubTarget');var scope=document.getElementById('pubScope').value;
  if(scope==='specific'&&target)scope=target.value;
  var nt=parseInt(document.getElementById('pubNT').value,10)||5;
  if (nt <= 0) { showToast('奖励必须大于0', 'error'); _publishing = false; return; }
  var data={name:name,type:document.getElementById('pubType').value,nt:nt,scope:scope==='all'?'社区':(scope==='specific'?'个人':scope),slots:parseInt(document.getElementById('pubSlots').value,10)||1,deadline:document.getElementById('pubDeadline').value,reviewer:document.getElementById('pubReviewer').value.trim(),note:document.getElementById('pubNote').value.trim(),publisher:CURRENT_USER,status:'进行中',action:'claim',reqPhoto:document.getElementById('pubReqPhoto').checked?parseInt(document.getElementById('pubReqPhotoCount').value,10)||1:0,reqFile:document.getElementById('pubReqFile').checked?parseInt(document.getElementById('pubReqFileCount').value,10)||1:0,locationId:document.getElementById('pubLocation').value||'',_ntTaskId:null};
  // Preserve existing claimants if editing
  if(TASKS[name]){var old=TASKS[name];data.claimants=old.claimants||[];data.claimedAt=old.claimedAt||'';data._ntTaskId=old._ntTaskId||null;}
  else data.claimants=[];
  // 先校验 AppData，失败不扣 NT
  var addResult=AppData.addTask(data);
  if(!addResult.ok){showToast(addResult.error,'error');return;}
  // C2: HTTP 模式服务端已在 POST /api/tasks 中处理扣款+冻结，客户端不再重复
  if(!data._ntTaskId&&window.NT){
    var isOffline = (typeof API === 'undefined' || !API.token);
    if (isOffline) {
      var ntR=NT.createTask(CURRENT_USER, name, nt, 'other', null, data.slots||1);
      if(!ntR){showToast('NT 余额不足（需 '+(nt*(data.slots||1))+' NT，请先赚取或充值）','error');return}
      if(!ntR.taskId){showToast('NT 系统异常，请重试','error');return}
      data._ntTaskId=ntR.taskId;
      AppData.updateTask(name, {_ntTaskId: ntR.taskId});
    }
  }
  document.getElementById('pubConfirm').style.display='none';
  clearPubForm();closeOverlay('overlayPublishTask');filterQuests();renderMyTasks();refreshUserUI();
  _publishing = false;
}
function publishDraft(name){
  if (_publishing) return; _publishing = true;
  var t=TASKS[name];if(!t){_publishing=false;return}
  var ntD=t.nt||0;
  // C2: HTTP 模式先调服务端创建任务（服务端做余额检查+冻结）
  var isOffline = (typeof API === 'undefined' || !API.token);
  if (!isOffline && ntD > 0) {
    API.syncTask(t, function(srvId) {
      if (!srvId) { showToast('发布失败，请检查余额或重试', 'error'); _publishing = false; return; }
      t._ntTaskId = srvId; t._srvId = srvId;
      AppData.updateTask(name, {_ntTaskId: srvId, _srvId: srvId});
      _finalizePublish(name);
    });
    return;  // 等回调
  }
  if(!t._ntTaskId&&window.NT&&ntD>0){
    if (isOffline) {
      var ntR=NT.createTask(CURRENT_USER, name, ntD, 'other', null, t.slots||1);
      if(!ntR){showToast('NT 余额不足（需 '+ntD+' NT）','error');_publishing=false;return}
      if(!ntR.taskId){showToast('NT 系统异常，请重试','error');_publishing=false;return}
      t._ntTaskId=ntR.taskId;
      AppData.updateTask(name, {_ntTaskId: ntR.taskId});
    }
  }
  _finalizePublish(name);
}
function _finalizePublish(name) {
  var t = TASKS[name]; if (!t) { _publishing = false; return; }
  t.status='进行中';t.action='claim';
  AppData.updateTask(name, {status:'进行中', action:'claim'});
  document.querySelectorAll('.card-expand').forEach(function(c){c.remove()});
  filterQuests();renderDrafts();renderMyTasks();refreshUserUI();
  _publishing = false;
}
function deleteDraft(name){showConfirm('确定删除草稿「'+name+'」？',function(){AppData.deleteTask(name);document.querySelectorAll('.card-expand').forEach(function(c){c.remove()});filterQuests();renderDrafts()})}
function clearPubForm(){['pubName','pubNT','pubSlots','pubDeadline','pubReviewer','pubNote'].forEach(function(id){document.getElementById(id).value=''});document.getElementById('pubNT').value='5';document.getElementById('pubSlots').value='1'}
function renderDrafts(){
  var el=document.getElementById('draftList');if(!el)return;
  var drafts=Object.values(TASKS).filter(function(t){return t.status==='draft'});
  if(!drafts.length){el.innerHTML='';return}
  var h='<div style="font-size:.65rem;font-weight:700;color:#c8892e;margin-bottom:4px">💾 草稿箱 ('+drafts.length+')</div>';
  drafts.forEach(function(t){h+='<div style="font-size:.7rem;padding:4px 0;cursor:pointer;color:var(--green-primary)" onclick="editDraft(\''+esc(t.name)+'\')">📝 '+t.name+(t.nt?' · NT'+t.nt:'')+'</div>'});
  el.innerHTML=h;
}
function editDraft(name){
  var t=TASKS[name];if(!t)return;
  document.getElementById('pubName').value=t.name||'';
  document.getElementById('pubType').value=t.type||'在地任务';
  document.getElementById('pubNT').value=t.nt||5;
  document.getElementById('pubSlots').value=t.slots||1;
  document.getElementById('pubDeadline').value=t.deadline||'';
  document.getElementById('pubReviewer').value=t.reviewer||'';
  document.getElementById('pubNote').value=t.note||'';
  renderDrafts();
}
function openMapPage(){
  document.getElementById('overlayMap').classList.add('open');
  if(typeof _initMap==='function'){_initMap()}
}
// Item system
function closeSub(){document.getElementById('subPage').classList.remove('open')}
function S(id){
  ['scrEntry','scrRegister','scrLogin'].forEach(function(s){document.getElementById(s).classList.add('hidden')});
  document.getElementById(id).classList.remove('hidden');
  if(id==='scrLogin'){renderLoginUserList()}
  if(id==='scrRegister'){
    if(!_profileSeed)_profileSeed=_avatarSeedPool[Math.floor(Math.random()*_avatarSeedPool.length)];
    updateRegAvatar();
  }
}
function renderLoginUserList(){
  var localUsers = {};
  try { localUsers = JSON.parse(localStorage.getItem('nt_local_users')||'{}'); } catch(e) {}
  var names = Object.keys(localUsers);
  // HTTP 模式：本地没有 → 从服务器拉用户列表
  if (names.length === 0 && window.location.protocol !== 'file:') {
    fetch('/api/auth/users').then(function(r){return r.json()}).then(function(list){
      if (Array.isArray(list)) { list.forEach(function(u){ localUsers[u.name] = u.avatar_seed || u.name; }); names = Object.keys(localUsers); }
      _renderUserChips(localUsers, names);
    }).catch(function(){ _renderUserChips(localUsers, names); });
    return;
  }
  _renderUserChips(localUsers, names);
}
function _renderUserChips(localUsers, names) {
  if (names.length === 0) {
    document.getElementById('userScroll').innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,.4);font-size:.7rem">还没有账号，请注册或手动输入名字</div>';
    return;
  }
  var h = '';
  names.forEach(function(n){
    var s = localUsers[n] || n;
    var initial = n.charAt(0);
    h += '<div class="user-chip" onclick="pickLoginUser(\''+esc(n)+'\')"><div class="user-chip-avatar"><img src="'+avatarURL(s,48)+'" width="48" height="48" style="border-radius:50%;object-fit:cover;background:#c8d8c8" alt="'+initial+'" onerror="this.outerHTML=&#39;<div style=width:48px;height:48px;border-radius:50%;background:#c8d8c8;display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:#5a6e5c>&#39;+&#39;'+initial+'&#39;+&#39;</div>&#39;"></div><div class="user-chip-name">'+n+'</div></div>';
  });
  document.getElementById('userScroll').innerHTML = h;
  if (names[0]) { document.getElementById('loginName').value = names[0]; renderLoginAvatar(); }
}
// ── 登录用户列表渲染 ──
// 登录/注册成功时保存到本地列表
function _saveLocalUser(name, seed) {
  try {
    var lu = JSON.parse(localStorage.getItem('nt_local_users')||'{}');
    // 只有真正的种子才存，null/空字符串/等于名字的不存
    lu[name] = (seed && seed !== name) ? seed : (lu[name] && lu[name] !== name ? lu[name] : (name));
    localStorage.setItem('nt_local_users', JSON.stringify(lu));
    // A2: 顺带缓存角色到并行 key，供 auth.js getUsers() 的 fallback 读取
    var role = (typeof API !== 'undefined' && API.user && API.user.role) || (typeof getUsers === 'function' && (getUsers()[name] || {}).role);
    if (role) {
      var lr = JSON.parse(localStorage.getItem('nt_local_roles')||'{}');
      lr[name] = role;
      localStorage.setItem('nt_local_roles', JSON.stringify(lr));
    }
  } catch(e) {}
}
function pickLoginUser(name){document.getElementById('loginName').value=name;document.querySelectorAll('#userScroll .user-chip').forEach(function(c){c.classList.remove('selected')});event.target.closest('.user-chip').classList.add('selected');renderLoginAvatar()}
function renderLoginAvatar(){
  var name=document.getElementById('loginName').value||'';
  var seed = name; // fallback: 用名字生成头像
  // 优先从本地登录记录查头像种子
  try { var lu = JSON.parse(localStorage.getItem('nt_local_users')||'{}'); if (lu[name]) seed = lu[name]; } catch(e) {}
  // 其次从 nt_users 查
  if (seed === name) { var users=getUsers(); if (users[name]&&users[name].avatar_seed!=null) seed = users[name].avatar_seed; }
  if (seed == null) seed = _avatarSeedPool[Math.floor(Math.random()*_avatarSeedPool.length)];
  var url=avatarURL(seed,96);
  var initial = name ? name.charAt(0) : '?';
  document.getElementById('loginAvatar').innerHTML='<img src="'+url+'" width="96" height="96" style="border-radius:50%;object-fit:cover;background:#c8d8c8" alt="'+initial+'" onerror="this.outerHTML=&#39;<div style=width:96px;height:96px;border-radius:50%;background:#c8d8c8;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#5a6e5c;margin:0 auto>&#39;+initial+&#39;</div>&#39;">'
}
function cycleAvatar(styleIdx){
  document.querySelectorAll('.avatar-picker').forEach(function(p){p.remove()});
  var av=document.getElementById('regAvatar');if(!av)return;
  var r=av.getBoundingClientRect();
  var g=document.createElement('div');g.className='avatar-picker';
  g.style.cssText='position:fixed;z-index:999;left:'+Math.round(r.left-120)+'px;top:'+Math.round(r.bottom+4)+'px;width:280px;max-height:260px;overflow-y:auto;padding:8px;background:rgba(18,28,20,.96);border:1px solid rgba(255,255,255,.15);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:spcPop .2s ease-out';
  var pool=_avatarSeedPool;
  var grid='<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">';
  for(var i=0;i<pool.length;i++){
    var seed=pool[i];var url=avatarURL(seed,44);
    grid+='<img src="'+url+'" width="44" height="44" style="border-radius:50%;cursor:pointer;border:2px solid '+(seed===_profileSeed?'var(--green-primary)':'transparent')+'" onclick="event.stopPropagation();_profileSeed=\''+seed+'\';updateRegAvatar();cycleAvatar()" onerror="this.style.display=\'none\'">';
  }
  grid+='</div>';
  g.innerHTML=grid;
  document.body.appendChild(g);
  setTimeout(function(){document.addEventListener('click',function rm(e){if(g&&g.parentNode&&!g.contains(e.target)){g.remove();document.removeEventListener('click',rm)}})},50);
}
function updateRegAvatar(){
  var av=document.getElementById('regAvatar');if(!av)return;
  av.innerHTML='<img src="'+avatarURL(_profileSeed!=null?_profileSeed:'demo',64)+'" width="64" height="64" style="border-radius:50%;object-fit:cover" alt="">';
}
function _mergeNTSyncData(data) {
  if (!data || data.detail || !window.NT) return;
  // T13: cron_active 传播（初始 syncAll 可能不含此字段，轮询补设）
  if (data.cron_active) window._cronActive = true;
  var me = CURRENT_USER;
  // 余额/CV/XP：服务端权威，直接覆盖
  var ntUser = NT.getUser(me);
  if (ntUser) {
    ntUser.ntBalance = data.balance || 0;
    ntUser.contributionValue = data.cv || 0;
    ntUser.experienceValue = data.xp || 0;
    ntUser.frozenBalance = data.frozen_balance || 0;
  }
  // 角色：服务端权威
  if (data.role && window.AppData) {
    var users = (typeof getUsers === 'function') ? getUsers() : {};
    if (users[me]) users[me].role = data.role;
    if (window.location.protocol === 'file:') { try { localStorage.setItem('nt_users', JSON.stringify(users)); } catch(e) {} }
  }
  // 任务合并
  if (data.tasks && window.AppData) {
    data.tasks.forEach(function(t) {
      t.publisher = t.poster || t.publisher;
      var dup = AppData._data.tasks[t.id] || Object.values(AppData._data.tasks).find(function(lt){ return lt.title===t.title && lt.publisher===t.poster; });
      var srvC = (t.assignees||[]).map(function(id){ return {name:id}; });
      if (!dup) AppData._data.tasks[t.id] = { name:t.id, title:t.title, type:t.category, nt:t.reward, scope:t.scope, status:t.status, publisher:t.poster, assignee:t.assignee, assignees:t.assignees, deadline:t.deadline, reviewer:t.reviewer, slots:t.slots, note:t.note, evidence:t.evidence, claimants:srvC, action:'', is_system_generated:t.is_system_generated||false, escrow_amount:t.escrow_amount||0, settler_id:t.settler_id||'', settled_at:t.settled_at||'' };
      else { var kp=dup.claimants||[]; Object.assign(dup, { status:t.status, assignee:t.assignee, evidence:t.evidence, slots:t.slots, reviewer:t.reviewer, note:t.note, deadline:t.deadline, is_system_generated:t.is_system_generated||false, escrow_amount:t.escrow_amount||0, settler_id:t.settler_id||'', settled_at:t.settled_at||'' }); dup.claimants=_mergeClaimants(kp, t.assignees||[]); }
    });
  }
  // 充值意图缓存
  if (data.deposit_intents && window.AppData) {
    AppData._data._depositIntents = data.deposit_intents;
  }
  // R6: 同步所有活跃入住记录到本地住宿面板
  if (data.all_tenancies && window.AppData) {
    var accs = AppData._data.map_locations && AppData._data.map_locations.accommodations;
    if (accs) {
      // 清空旧 tenancy 数据（保留房间结构）
      Object.keys(accs).forEach(function(k){ if(accs[k].tenants) accs[k].tenants = []; });
      data.all_tenancies.forEach(function(t){
        var room = accs[t.room_id]; if(!room) return;
        if(!room.tenants) room.tenants = [];
        room.tenants.push({ name:t.user_id, bed:t.bed_num, checkIn:(t.checkin_date||'').slice(5,10), checkOut:'', debt:t.debt||0 });
      });
      AppData._saveShared();
    }
  }
  // 流水缓存（供离线查看）
  if (data.ledger && window.NT) {
    try { localStorage.setItem('nt_synced_ledger_' + me, JSON.stringify(data.ledger)); } catch(e) {}
  }
}

function _mergeSyncData(data) {
  if (!data || !window.AppData) return;
  // R7: 读取 cron_active 标志，服务端已接管则客户端降级
  if (data.cron_active) window._cronActive = true;
  if (data.pool_balance !== undefined && window.AppData) {
    AppData._data._poolBalance = data.pool_balance;
  }
  if (data.tasks) { data.tasks.forEach(function(t) {
    t.publisher = t.poster || t.publisher;
    var dup = AppData._data.tasks[t.id] || Object.values(AppData._data.tasks).find(function(lt){ return lt.title===t.title && lt.publisher===t.poster; });
    var srvClaimants = (t.assignees||[]).map(function(id){ return {name:id}; });
    if (!dup) AppData._data.tasks[t.id] = { name:t.id, title:t.title, type:t.category, nt:t.reward, scope:t.scope, status:t.status, publisher:t.poster, deadline:t.deadline, reviewer:t.reviewer, slots:t.slots, note:t.note, claimants:srvClaimants, action:'' };
    else { var keep=dup.claimants||[]; Object.assign(dup, { status:t.status, assignee:t.assignee, evidence:t.evidence, slots:t.slots, reviewer:t.reviewer, note:t.note, deadline:t.deadline, settler_id:t.settler_id }); dup.claimants=_mergeClaimants(keep, t.assignees||[]); }
  });}
  if (data.journal) {
    AppData._data.journal = AppData._data.journal || [];
    var _jExisting = new Set(AppData._data.journal.map(function(j){return j.time+j.type+(j.content||'');}));
    data.journal.forEach(function(j) {
      var key = j.time + j.type + (j.content||'');
      if (!_jExisting.has(key)) { AppData._data.journal.push({type:j.type, content:j.content, time:j.time, space_id:j.space_id}); _jExisting.add(key); }
    });
  }
  if (data.activity) { AppData._data.activity_log = data.activity; }
  if (data.items && Array.isArray(data.items)) {
    if (!AppData._data.items[AppData._currentUser]) AppData._data.items[AppData._currentUser] = [];
    var existing = AppData._data.items[AppData._currentUser];
    data.items.forEach(function(it) {
      if (!existing.find(function(e) { return e.id === it.id; })) existing.push(it);
    });
  }
  if (data.newbie && Array.isArray(data.newbie)) {
    AppData._data.newbieQuests = {};
    data.newbie.forEach(function(q) { AppData._data.newbieQuests[q.quest_id] = q; });
  }
  if (data.verifications && Array.isArray(data.verifications)) {
    var localVfys = AppData._data.pendingVerifications || [];
    var localById = {}; localVfys.forEach(function(v){ localById[v.id] = v; });
    data.verifications.forEach(function(sv) {
      if (!localById[sv.id]) { localVfys.push(sv); }
      else if (localById[sv.id].status === 'pending') { Object.assign(localById[sv.id], sv); }
    });
    AppData._data.pendingVerifications = localVfys;
  }
  if (data.map_locations && window.AppData) {
    AppData._data.map_locations = data.map_locations;
  }
  if (data.camps && window.AppData) {
    data.camps.forEach(function(c) { AppData._data.camps[c.id] = c; });
  }
}
function enterVillage(){
  var isReg=!document.getElementById('scrRegister').classList.contains('hidden');
  var isLogin=!document.getElementById('scrLogin').classList.contains('hidden');
  var isHTTP = window.location.protocol !== 'file:';
  // 提取进入村庄的公共尾段
  function _finishEnter(name) {
    // 头像：优先 _profileSeed，其次 API.user，最后 nt_local_users
    var seed = _profileSeed;
    if (!seed && typeof API !== 'undefined' && API.user && API.user.avatar_seed) seed = API.user.avatar_seed;
    if (!seed) { try { var _lu2 = JSON.parse(localStorage.getItem('nt_local_users')||'{}'); if (_lu2[name]) seed = _lu2[name]; } catch(e) {} }
    if (!isHTTP) _saveLocalUser(name, seed);
    // HTTP 模式：写 nt_local_users + nt_local_roles 确保 getUsers() fallback 可用
    if (isHTTP && typeof API !== 'undefined' && API.user) {
      try {
        var _role = API.user.role || 'visitor';
        var _seed = seed || (API.user.avatar_seed || name);
        // nt_local_users: {name: seed} ——供 getUsers() fallback 遍历
        var _lu = JSON.parse(localStorage.getItem('nt_local_users')||'{}');
        _lu[name] = _seed;
        localStorage.setItem('nt_local_users', JSON.stringify(_lu));
        // nt_local_roles: {name: role} ——供 getUsers() fallback 取角色
        var _lr = JSON.parse(localStorage.getItem('nt_local_roles')||'{}');
        _lr[name] = _role;
        localStorage.setItem('nt_local_roles', JSON.stringify(_lr));
      } catch(e) { console.warn('_finishEnter persist failed', e); }
    }
    document.getElementById('myPage').classList.add('hidden');
    document.querySelectorAll('.overlay.open').forEach(function(o){o.classList.remove('open')});
    document.querySelectorAll('.mgmt-sheet,.ci-overlay,.confirm-card,.profile-card').forEach(function(e){e.remove()});
    _fromQuestHall=false;
    document.getElementById('loginPage').classList.add('hidden');document.getElementById('villagePage').classList.remove('hidden');initCarousel();setTimeout(initSpcCard,200);refreshUserUI();
    // 新手引导不再弹窗，静默初始化，签约后在信箱通知
    setTimeout(function(){ if(typeof _initNewbieQuests==='function')_initNewbieQuests(CURRENT_USER); },600);
    if(typeof API!=='undefined'&&API.token){
      API.syncAll(function(data) {
        if (data && !data.detail && !data._offline && data.ok !== false) _mergeSyncData(data);
      });
      // CR2: 先 sync 后 tick——避免 tick 余额变更被 sync 旧数据覆盖
      API.request('GET', '/api/nt/sync').then(function(srv) {
        if (srv && !srv.detail) _mergeNTSyncData(srv);
        // C2.6: tick 在 sync 之后，幂等，服务端同一天不重复执行
        if (typeof API !== 'undefined' && API.token) API.request('POST', '/api/system/daily-tick').catch(function(e){console.warn('[daily-tick] failed',e)});
        // F16: 离线 earn 队列同步
        if (window.AppData && typeof AppData._drainPendingEarns === 'function') AppData._drainPendingEarns();
      }).catch(function(e){console.warn('[sync] NT sync failed',e)});
    }
    _startPolling();
    // B10: 预创建信箱面板 DOM（创建后立刻隐藏），首次点击不再 createElement
    setTimeout(function(){ if (typeof _toggleInbox === 'function' && !document.getElementById('inboxPanel')) { _toggleInbox(); closeInbox(); } }, 800);
  }
  if(isReg){
    var n=document.getElementById('regName').value.trim();var p=document.getElementById('regPwd').value.trim();
    var errors=[];
    if(!n) errors.push('请输入名字');
    if(p.length<8) errors.push('密码至少8位');
    if(errors.length){showToast(errors.join('；'),'error');return}
    if(!_profileSeed)_profileSeed=_avatarSeedPool[Math.floor(Math.random()*_avatarSeedPool.length)];
    if (isHTTP) {
      var inviteCode = (document.getElementById('regInviteCode')||{}).value || '';
      API.asyncAuth('register', n, p, 'visitor', _profileSeed, inviteCode, function(result) {
        if (result && result.name) {
          if(window.NT)NT.registerUser(n);setCurrentUser(n);if(window.AppData)AppData.switchUser(n);
          _initNewbieQuests(n); addJournal(n, 'register', '加入了南塘云村');
          if (typeof logActivity === 'function') logActivity('system', '🌱 新手引导已开启');
          _finishEnter(n);
        } else if (!result) {
          showToast('无法连接服务器，请检查网络','error');
        } else {
          showToast(result.error||'注册失败','error');
        }
      });
      return;
    } else {
      var firstUser = (typeof getUsers === 'function') ? (Object.keys(getUsers()).length === 0) : true;
      var role = firstUser ? 'admin' : 'visitor';
      var r=registerUser(n,p,role,_profileSeed,'');if(!r||!r.ok){showToast(r&&r.error||'注册失败','error',document.getElementById('regName'));return}
      safeStorage.setItem('nt_remembered_user', JSON.stringify({name:n}));
    }
    if(window.NT)NT.registerUser(n);setCurrentUser(n);if(window.AppData)AppData.switchUser(n);
    _saveLocalUser(n, _profileSeed);
    _initNewbieQuests(n); addJournal(n, 'register', '加入了南塘云村');
    if (typeof logActivity === 'function') logActivity('system', '🌱 新手引导已开启');
  }else if(isLogin){
    var ln=document.getElementById('loginName').value.trim();var lp=document.getElementById('loginPwd').value;
    if(!lp){showToast('请输入密码','error',document.getElementById('loginPwd'));return}
    if (isHTTP) {
      API.asyncAuth('login', ln, lp, null, null, null, function(result) {
        if (result && result.name) {
          setCurrentUser(ln);if(window.AppData)AppData.switchUser(ln);
          _finishEnter(ln);
        } else if (!result) {
          showToast('无法连接服务器，请检查网络','error');
        } else {
          showToast(result.error||'登录失败','error');
        }
      });
      return;
    } else {
      var lr=loginUser(ln,lp);if(!lr||!lr.ok){showToast(lr&&lr.error||'密码错误','error',document.getElementById('loginPwd'));return}
      safeStorage.setItem('nt_remembered_user', JSON.stringify({name:ln}));
    }
    setCurrentUser(ln);if(window.AppData)AppData.switchUser(ln);
  }
  if (isHTTP) return; // HTTP 异步路径已 return，下面只给 file://
  // file:// 模式：关闭残留页面
  document.getElementById('myPage').classList.add('hidden');
  document.getElementById('overlayCommunity').classList.remove('open');
  document.getElementById('overlayQuestHall').classList.remove('open');
  document.getElementById('overlayMap').classList.remove('open');
  var pc=document.getElementById('profileCard');if(pc)pc.remove();
  _fromQuestHall=false;
  document.getElementById('loginPage').classList.add('hidden');document.getElementById('villagePage').classList.remove('hidden');initCarousel();setTimeout(initSpcCard,200);refreshUserUI();
// E3.4: sign_covenant 已移至 _applyStay()，新手引导静默初始化
setTimeout(function(){ if(typeof _initNewbieQuests==='function')_initNewbieQuests(CURRENT_USER); },600)
// 从 API 拉取其他用户的数据
if(typeof API!=='undefined'&&API.token){
  API.fetchTasks(function(tasks){if(tasks&&window.AppData){tasks.forEach(function(t){if(!AppData._data.tasks[t.id]){AppData._data.tasks[t.id]={name:t.id,title:t.title,type:t.category,nt:t.reward,scope:t.scope,status:t.status,publisher:t.poster,deadline:t.deadline,reviewer:t.reviewer,slots:t.slots,note:t.note,claimants:[],action:''}}})}});
  API.fetchDiscoveries(function(discs){if(discs&&window.AppData){if(!AppData._data.cardDiscoveries)AppData._data.cardDiscoveries=[];discs.forEach(function(d){var exists=AppData._data.cardDiscoveries.find(function(x){return x.id===d.id});if(!exists){AppData._data.cardDiscoveries.push({id:d.id,spaceId:d.space_id,description:d.description,guesser:d.guesser,guessedPerson:d.guessed_person,status:d.status,ntGuesser:d.nt_guesser,ntDoer:d.nt_doer,createdAt:d.created_at})}})}});
}
}
function resetAllData(){
  showConfirm('确定要清空所有数据吗？此操作不可恢复。',function(){
  localStorage.clear();
  if(window.NT) NT._reset();
  if(window.AppData) AppData.reset();
  showToast('数据已清空，即将刷新','error');setTimeout(function(){location.reload()},800);
})}
function refreshVillageCards(){
  var tasks=Object.values(TASKS);
  // 任务大厅：可领取数（status=进行中 且 无人认领 且 未逾期）
  var claimable=tasks.filter(function(t){
    if(t.status!=='进行中')return false;
    if((t.claimants||[]).length>0)return false;
    if(t.deadline&&t.deadline<today())return false;
    return true;
  }).length;
  // 任务大厅：进行中总数（有人认领但未完成）
  var activeCount=tasks.filter(function(t){
    return t.status==='进行中'&&(t.claimants||[]).length>0;
  }).length;
  var el=document.getElementById('vpQuestCount');
  if(el){
    if(claimable>0)el.textContent=claimable+' 个可领取';
    else if(activeCount>0)el.textContent=activeCount+' 个进行中 · 暂无新委托';
    else el.textContent='暂无委托 · 发布第一个？';
  }
  // 实景地图：进行中任务数 + 在线提示
  el=document.getElementById('vpMapInfo');
  if(el){
    var totalActive=tasks.filter(function(t){return t.status!=='已结算'}).length;
    if(totalActive>0)el.textContent=totalActive+' 个活跃任务 · 探索南塘';
    else el.textContent='探索南塘 · 看看大家在哪';
  }
  // 社区副本：活动数量
  el=document.getElementById('vpCommunityInfo');
  if(el){
    var campCount=window.AppData&&AppData._data.camps?Object.keys(AppData._data.camps).length:1;
    if(campCount>0)el.textContent=campCount+' 个活动 · 点击查看';
    else el.textContent='暂无活动 · 敬请期待';
  }
}
function refreshUserUI(){
  var u=CURRENT_USER||'';
  var users=getUsers();
  var appUser=window.AppData?AppData.me():null;
  var seed=(appUser&&appUser.avatar_seed!=null)?appUser.avatar_seed:((users[u]&&users[u].avatar_seed!=null)?users[u].avatar_seed:null);
  if(seed==null)seed=u||_avatarSeedPool[Math.floor(Math.random()*_avatarSeedPool.length)];
  var url=u?avatarURL(seed,40):'';
  var sa=document.getElementById('spcAvatarImg');if(sa){if(url){sa.src=url;sa.style.display=''}else sa.style.display='none';}
  var sn=document.querySelector('#spcCard .spc-name');if(sn)sn.textContent=u||'未登录';
  var ma=document.getElementById('myAvatarImg');if(ma){if(url){ma.src=url;ma.style.display=''}else ma.style.display='none';}
  var mn=document.querySelector('.my-topbar .my-name');if(mn)mn.textContent=u||'未登录';
  // 动态角色 + 注册日期（仅工作台顶栏显示）
  var role='云村民';var users=getUsers();if(users[u]){var r=users[u].role;role=roleName(r)}
  var created='';
  if(appUser&&appUser.created)created=appUser.created;
  if(!created){var gu=getUsers()[u];if(gu&&gu.created)created=gu.created;}
  if(!created)created=today();
  var roleIco=roleIcon((users[u]||{}).role||'visitor');
  var mr=document.querySelector('.my-id-row2');if(mr){
    var title = (typeof computeTitle === 'function' && u) ? computeTitle(u) : null;
    var titleStr = title ? title.tier.tier : (roleIco+' '+role);
    var branchStr = (title && title.branches.length) ? ' · ' + title.branches.slice(0,2).map(function(b){return b.icon+b.name}).join(' ') : '';
    var ntUser = (window.NT && u) ? NT.getUser(u) : null;
    var trustStr = ntUser ? ' · ' + (getTrustLevel(ntUser.trustScore||100).level) : '';
    mr.textContent = titleStr + branchStr + trustStr + ' · ' + created + ' 注册';
  }
  // 营期 / 简介
  var campRow=document.getElementById('myCampRow');if(campRow){
    var campText='';
    if(appUser&&appUser.camp)campText='🏕️ '+appUser.camp;
    else{var ubio=(users[u]||{}).bio||'';if(ubio)campText='📝 '+ubio}
    campRow.textContent=campText;campRow.style.display=campText?'':'none';
  }
  // NT 余额 + CV/XP（顶栏 + 个人卡 + 进度条）
  var b=0, cv=0, xp=0;
  // 异步从 API 获取服务端余额（移动端不阻塞）
  if (typeof API !== 'undefined' && API.token) {
    var _balEl = document.querySelector('.my-nt-val');
    var _cardEl = document.getElementById('myNtBalance');
    var _barEl = document.getElementById('myNtBar');
    API.request('GET', '/api/nt/balance', null).then(function(srv) {
      if (srv && !srv.detail && !srv._offline) {
        b = srv.balance || 0; cv = srv.cv || 0; xp = srv.xp || 0;
        if (_balEl) _balEl.innerHTML = '<img src=豆子.png alt=NT onerror="this.outerHTML=\x27🌱\x27" style=width:18px;height:18px;vertical-align:middle;margin-right:2px>'+b+'<span style=font-size:.55rem;color:#5a6e5c;margin-left:4px>💠'+cv+' ⭐'+xp+'</span><span style=font-size:.55rem;color:var(--green-primary);margin-left:6px;cursor:pointer" onclick="event.stopPropagation();renderWeeklySettlement()">📊</span>';
        if (_cardEl) _cardEl.textContent = b;
        if (_barEl) _barEl.style.width = Math.min(100, Math.round(b/1250*100))+'%';
      }
    });
  }
  if (!b && window.NT){var bal=NT.getUser(u);b=bal?bal.ntBalance:0;cv=bal?bal.contributionValue||0:0;xp=bal?bal.experienceValue||0:0;
    var ntVal=document.querySelector('.my-nt-val');if(ntVal)ntVal.innerHTML='<img src=豆子.png alt=NT onerror="this.outerHTML=\x27🌱\x27" style=width:18px;height:18px;vertical-align:middle;margin-right:2px>'+b+'<span style=font-size:.55rem;color:#5a6e5c;margin-left:4px>💠'+cv+' ⭐'+xp+'</span><span style=font-size:.55rem;color:var(--green-primary);margin-left:6px;cursor:pointer" onclick="event.stopPropagation();renderWeeklySettlement()">📊</span>';
    var ntCard=document.getElementById('myNtBalance');if(ntCard)ntCard.textContent=b;
    var ntBar=document.getElementById('myNtBar');if(ntBar)ntBar.style.width=Math.min(100,Math.round(b/1250*100))+'%';
  }
  // 营队 NT = 从 NT Ledger 汇总 camp_earn 类型的收入
  var campNt=0;
  if(window.NT){ NT.getLedger({userId:u}).filter(function(e){return e.type==='camp_earn'||(e.type||'').indexOf('camp:')===0;}).forEach(function(e){campNt+=e.amount||0}); }
  var campCard=document.getElementById('myCampNtBalance');if(campCard)campCard.textContent=campNt;
  var campBar=document.getElementById('myCampNtBar');if(campBar)campBar.style.width=(campNt>0?Math.min(100,Math.round(campNt/1250*100)):0)+'%';
  // 刷新账本卡片
  refreshLedgerCards();
  // FIX-05: 冻结 NT
  var frozen = (window.NT && typeof NT.getFrozenBalance === 'function') ? NT.getFrozenBalance(u) : 0;
  var frozenEl=document.getElementById('myFrozenBalance');if(frozenEl)frozenEl.textContent=frozen;
  var frozenBar=document.getElementById('myFrozenBar');if(frozenBar){var b2=b||0;frozenBar.style.width=(b2+frozen>0?Math.round(frozen/(b2+frozen)*100):0)+'%';}
  // 村口气泡角标
  var pendingCount=window.AppData?AppData.myPendingCount():0;
  var badge=document.querySelector('#spcCard .spc-badge');if(badge){badge.textContent=pendingCount||'';badge.style.display=pendingCount>0?'':'none'}
  // 村口委托数
  refreshVillageCards();
  // 任务大厅底栏
  var qma=document.getElementById('questMyAvatarImg');if(qma&&seed!=null){qma.src=avatarURL(seed,32);qma.style.display=''}else if(qma){qma.style.display='none'}
  var qmn=document.querySelector('.quest-my-btn span');if(qmn)qmn.textContent=u;
  // 资料卡 seed
  _profileSeed=seed;
  // 提醒芯片
  if(typeof updateMyChips==='function')updateMyChips('tasks');
  // 通知地图 iframe — 推送完整用户数据
  var mapFrame=document.querySelector('#overlayMap iframe');
  if(mapFrame&&mapFrame.contentWindow){
    try{mapFrame.contentWindow.postMessage({type:'userData',data:Game.getUser()},'*')}catch(e){}
  }
  // Phase 2: 管理员入口
  var cfgBtn=document.getElementById('ubAdminCfgBtn');
  if(cfgBtn){var ur=(getUsers()[u]||{}).role||'';cfgBtn.style.display=(ur==='admin')?'':'none';}
  // Phase 2: 动态统计
  var dateEl=document.getElementById('ubStatDate'); if(dateEl) dateEl.textContent='📅 '+(typeof Clock!=='undefined'?Clock.today():today()).slice(5);
  var ml = (window.AppData&&AppData._data.map_locations) ? AppData._data.map_locations : null;
  if(ml){
    var cl=AppData._data.cleaning; var dc=0;
    if(cl&&cl.spaces){ Object.keys(cl.spaces).forEach(function(s){ var d=cl.spaces[s].dirtiness||0; if(d>60)dc++; }); }
    var dirtEl=document.getElementById('ubStatDirt'); if(dirtEl){ dirtEl.textContent=dc>0?'🔴'+dc+'处需清洁':'🟢整洁'; }
    var presence = (window.AppData && AppData._data.presence) ? AppData._data.presence : {};
    var pplCount = Object.values(presence).filter(function(p){return p.status==='在地';}).length || 0;
    var pplEl=document.getElementById('ubStatPeople'); if(pplEl) pplEl.textContent='👤'+pplCount+'人在线';
    // 校核铃铛 badge
    var vBadge=document.getElementById('ubVerifyBadge'); if(vBadge){ var vCnt=(AppData._data.pendingVerifications||[]).filter(function(v){return v.status==='pending';}).length; vBadge.textContent=vCnt; vBadge.style.display=vCnt>0?'inline':'none'; }
    // 公告栏更新
    if(typeof _updateAnnounceBar==='function') _updateAnnounceBar();
    var accs=ml.accommodations||{}; var occ=Object.values(accs).filter(function(a){return a.status==='occupied';});
    var stayEl=document.getElementById('ubStatStay'); if(stayEl) stayEl.textContent='🛏️'+occ.length+'人入住';
    var plots=ml.plots||[]; var warns=plots.filter(function(p){return p.status==='warning';});
    var growing=plots.filter(function(p){return p.status==='growing'||p.status==='warning';});
    var farmEl=document.getElementById('ubFarmStat');
    if(farmEl){ if(warns.length){farmEl.textContent='⚠'+warns.length+'块待收';farmEl.style.color='#c8892e';}else if(growing.length){farmEl.textContent='🌿'+growing.length+'块生长';farmEl.style.color='';}else{farmEl.textContent='🌿 无种植';farmEl.style.color='';} }
    var tasks=Object.values(TASKS).filter(function(t){return t.status==='进行中'&&(t.claimants||[]).length===0;});
    var taskEl=document.getElementById('ubStatTasks'); if(taskEl) taskEl.textContent='📋'+tasks.length+'待领';
  }
}
function showMy(opts){document.getElementById('villagePage').classList.add('hidden');document.getElementById('villagePage').classList.add('behind');document.getElementById('myPage').classList.remove('hidden');renderMyTasks();refreshUserUI();
  // 刷新工作台动态
  var af=document.getElementById('activityFeed');if(af&&window.AppData){var log=AppData._data.activity_log||[];if(log.length){var h='<div style="background:#fff;border:1px solid var(--green-border);border-radius:10px;overflow:hidden"><div style="padding:8px 12px;border-bottom:1px solid #e8ede6"><div class="my-flow-title" style="margin:0">🕐 最近动态</div></div>';log.slice(0,5).forEach(function(a){h+='<div style="padding:6px 12px;border-bottom:1px solid #f0f0f0;font-size:.65rem;color:#5a6e5c">'+(a.time||'').slice(0,16).replace('T',' ')+' · '+esc(a.text||'')+'</div>'});h+='</div>';af.innerHTML=h;}else{af.innerHTML='<div style="background:#fff;border:1px solid var(--green-border);border-radius:10px;overflow:hidden"><div style="padding:8px 12px;border-bottom:1px solid #e8ede6"><div class="my-flow-title" style="margin:0">🕐 最近动态</div></div><div style="padding:12px;text-align:center;color:#5a5a5a;font-size:.7rem">暂无动态</div></div>';}}
  if(window.NT&&!NT.verify().pass){
  var v=NT.verify();
  console.error('[NT] 会计等式不成立！',v);
  if(typeof showToast==='function') showToast('NT 会计等式异常，请检查账本','warn');
}
  // 阶段 3：营地概览联动 preselect chip（审计 P3）
  if (opts && opts.presetChip === '营队') {
    setTimeout(function() {
      var chips = document.querySelectorAll('#myChipRow .my-fchip');
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove('on');
      var campChip = document.querySelector('#myChipRow .my-fchip[onclick*="营队"]');
      if (campChip) { campChip.classList.add('on'); }
      if (typeof renderMyTasks === 'function') renderMyTasks();
    }, 100);
  }
  // 任务可见性：非营地成员隐藏 [营队] chip
  var users = typeof getUsers==='function'?getUsers():{};
  var role = (users[CURRENT_USER]||{}).role||'visitor';
  var isCampMember = isMemberByRole(role);
  if (!isCampMember) {
    var campChip = document.querySelector('#myChipRow .my-fchip[onclick*="营队"]');
    if (campChip) campChip.style.display = 'none';
  }
  updateInboxBadge();
}
function renderMyTasks(){
  var items=Object.values(TASKS).filter(function(t){
    return t.publisher===CURRENT_USER||(t.claimants||[]).some(function(c){return c.name===CURRENT_USER})||t.reviewer===CURRENT_USER;
  });
  // Read filter chips
  var filters=document.querySelectorAll('#myTabTasks .my-filters');
  var typeChip=filters[0]?filters[0].querySelector('.my-fchip.on'):null;
  var scopeChip=filters[1]?filters[1].querySelector('.my-fchip.on'):null;
  var ownerChip=filters[2]?filters[2].querySelector('.my-fchip.on'):null;
  if(typeChip&&typeChip.textContent!=='全部类型'){var tv=typeChip.textContent;items=items.filter(function(t){return t.type===tv})}
  if(scopeChip&&scopeChip.textContent!=='全部范围'){var sv=scopeChip.textContent;items=items.filter(function(t){return (sv==='个人'&&t.scope==='个人')||(sv==='营队'&&t.scope==='营队')||(sv==='社区'&&t.scope==='社区')})}
  if(ownerChip&&ownerChip.textContent==='我接的'){items=items.filter(function(t){return(t.claimants||[]).some(function(c){return c.name===CURRENT_USER})})}
  if(ownerChip&&ownerChip.textContent==='我发的'){items=items.filter(function(t){return t.publisher===CURRENT_USER})}
  var kw=(document.getElementById('myTaskSearchInput')||{}).value;
  if(kw){kw=kw.trim().toLowerCase();items=items.filter(function(t){return t.name.toLowerCase().indexOf(kw)!==-1||(t.note||'').toLowerCase().indexOf(kw)!==-1})}
  function myCard(t){return renderTaskCard(t,{context:'my',showReviewBtn:true});}
  var secs=[
    {label:'🔴 待处理',color:'var(--red)',key:'urgent',filter:function(t){return t.status==='待提交'||t.status==='待审核'||t.status==='退回修改'}},
    {label:'📋 进行中',color:'var(--green-primary)',key:'active',filter:function(t){return t.status==='进行中'}},
    {label:'🧾 待结算',color:'#c8892e',key:'settle',filter:function(t){return t.status==='待结算'}},
    {label:'✅ 最近完成',color:'#5a6e5c',key:'done',filter:function(t){return t.status==='已完成'||t.status==='已结算'}},
    {label:'🚫 已取消/争议',color:'#999',key:'closed',filter:function(t){return t.status==='已取消'||t.status==='已争议'}}
  ];
  var h='';
  secs.forEach(function(s){
    var arr=items.filter(s.filter);if(!arr.length)return;
    var fold=_secFold['my'+s.key];
    h+='<div style="border-top:1px solid var(--green-border);margin-top:4px" id="my-sec-'+s.key+'"></div>';
    h+='<div class="section-head" onclick="toggleSection(\'my'+s.key+'\')" style="color:'+s.color+'"><span>'+s.label+' ('+arr.length+')</span><span>'+(fold?'▸ 展开':'▾ 收起')+'</span></div>';
    if(!fold) arr.forEach(function(t){h+=myCard(t)});
  });
  document.getElementById('myTaskList').innerHTML=h||'<div style="text-align:center;padding:20px;color:#5a6e5c">暂无任务</div>';
}
var _fromQuestHall=false;
function openMyFromQuestHall(){_fromQuestHall=true;document.getElementById('overlayQuestHall').classList.remove('open');showMy()}
function toggleProfile(){
  var m=document.getElementById('profileCard');if(m){m.remove();return}
  m=document.createElement('div');m.id='profileCard';
  m.style.cssText='position:fixed;inset:0;z-index:250;display:flex;align-items:center;justify-content:center';
  m.innerHTML='<div id="profileBg" style="position:absolute;inset:0;background:rgba(0,0,0,.45);animation:fadeIn .2s ease-out" onclick="document.getElementById(\'profileCard\').remove()"></div><div id="profileInner" style="position:relative;width:300px;max-width:90vw;background:#fff;border-radius:16px;padding:20px;box-shadow:0 16px 48px rgba(0,0,0,.3);animation:spcPop .25s ease-out;max-height:80vh;overflow-y:auto"></div>';
  document.body.appendChild(m);
  renderProfile('view');
}
var _profileSeed=null;  // null="未选头像",注册/渲染时从池子随机取
var _avatarStyles=['avataaars','bottts','fun-emoji','pixel-art','micah','lorelei','adventurer','big-ears','big-smile','croodles','identicon','personas'];
var _avatarStyleIdx=0;
var _avatarSeedPool=[];
function fillSeedPool(){
  if(_avatarSeedPool.length)return;
  var names=['nantang-guide','云村','大理','南塘','Aria','Bao','Chen','Diana','Elena','Felix','Grace','Hana','Iris','Jade','Kai','Luna','Ming','Nora','Olive','Petra','Quinn','Ravi','Sage','Taro','Uma','Vera','Wren','Xia','Yuki','Zara'];
  for(var i=0;i<names.length;i++)_avatarSeedPool.push(names[i]);
}
fillSeedPool();
function profileSrc(seed,size){size=size||56;return'https://api.dicebear.com/7.x/'+_avatarStyles[_avatarStyleIdx]+'/svg?seed='+encodeURIComponent(seed)+'&size='+size}
function renderProfile(mode){
  var el=document.getElementById('profileInner');if(!el)return;
  var h='<button style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#5a5a5a;z-index:1" onclick="document.getElementById(\'profileCard\').remove()">✕</button>';
  var pu=getUsers()[CURRENT_USER]||{};var pr=pu.role||'visitor';var pRole=roleName(pr);var pIcon=roleIcon(pr);var pCreated=pu.created||'';var au=window.AppData?AppData.me():null;if(!pCreated&&au&&au.created)pCreated=au.created;if(!pCreated)pCreated=today();
  h+='<div style="text-align:center;margin-bottom:14px"><img src="'+profileSrc(_profileSeed)+'" width="56" height="56" style="border-radius:50%;border:2.5px solid var(--green-primary);cursor:'+(mode==='edit'?'pointer':'default')+'" alt="" id="profileAvatarImg" '+(mode==='edit'?'onclick="pickAvatar()"':'')+'><div style="font-weight:700;font-size:.9rem;margin-top:6px">'+esc(CURRENT_USER)+'</div><div style="font-size:.65rem;color:#5a6e5c">'+pIcon+' '+pRole+' · '+pCreated+'</div></div>';
  if(mode==='view'){
    var u=getUsers()[CURRENT_USER]||{};var rl=u.role||'visitor';var rn=roleName(rl);
    // NT 余额 + 充值/提现
    var ntBal=window.NT?(NT.getUser(CURRENT_USER)||{}).ntBalance||0:0;
    h+='<div style="background:linear-gradient(135deg,#e8f0e4,#dce8d8);border-radius:12px;padding:12px 14px;margin-bottom:10px;text-align:center">';
    h+='<div style="font-size:.6rem;color:#5a6e5c;margin-bottom:2px">💰 NT 余额</div>';
    h+='<div style="font-size:1.6rem;font-weight:700;color:#2a4a30">'+ntBal+'</div>';
    h+='<div style="display:flex;gap:6px;margin-top:8px">';
    h+='<button class="btn-sm pri" style=flex:1;font-size:.7rem;padding:6px onclick="event.stopPropagation();showRechargeForm()">💰 充值</button>';
    h+='<button class="btn-sm sec" style=flex:1;font-size:.7rem;padding:6px onclick="event.stopPropagation();showWithdrawForm()">📤 提现</button>';
    h+='</div><div id="profileTxForm" style="margin-top:8px"></div></div>';
    // 管理员：待审核
    if(rl==='admin'){
      var pending=(AppData._data.pendingTransactions||[]).filter(function(tx){return tx.status==='pending'});
      if(pending.length>0) h+='<div style="background:#fff8e8;border:1px solid #e8d890;border-radius:10px;padding:10px 12px;margin-bottom:10px;text-align:center;cursor:pointer" onclick="event.stopPropagation();renderProfile(\'review\')"><span style="font-size:.7rem;color:#8a6a30">📋 '+pending.length+' 笔充值/提现待审核 →</span></div>';
    }
    var rows=[['🆔 ID',esc(u.uid||'未分配')],['👤 名字',esc(CURRENT_USER)],['🧱 身份',rn],['🔑 密码','••••••'],['💼 钱包',esc(u.wallet||'未填写')],['📝 简介',esc(u.bio||'未填写')],['📍 坐标',esc(u.location||'未填写')]];
    rows.forEach(function(r){h+='<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f0f0f0"><span style="color:#5a5a5a;font-size:.68rem">'+r[0]+'</span><span style="font-weight:600;font-size:.72rem">'+r[1]+'</span></div>'});
    h+='<div style="margin-top:12px;display:flex;gap:6px"><button class="btn-sm sec" style=flex:1 onclick="document.getElementById(\'profileCard\').remove()">✕ 关闭</button><button class="btn-sm pri" style=flex:1 onclick="renderProfile(\'edit\')">✏️ 编辑</button><button class="btn-sm danger" style=flex:1 onclick="logout()">🚪 退出</button></div>';
  }else if(mode==='edit'){
    var eu=getUsers()[CURRENT_USER]||{};
    var fields=[['名字','profileName',CURRENT_USER],['钱包地址','profileWallet',eu.wallet||''],['简介','profileBio',eu.bio||''],['坐标','profileLoc',eu.location||'']];
    fields.forEach(function(f){h+='<div style="margin-bottom:8px"><label style="font-size:.62rem;color:#5a6e5c;font-weight:600">'+f[0]+'</label><input id="'+f[1]+'" class="login-input" value="'+esc(f[2])+'" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.75rem;padding:8px"></div>'});
    h+='<div style="margin-top:12px;display:flex;gap:6px"><button class="btn-sm sec" style=flex:1 onclick="renderProfile(\'view\')">取消</button><button class="btn-sm pri" style=flex:1 onclick="saveProfileEdits();renderProfile(\'view\')">💾 保存</button></div>';
    h+='<div style="border-top:1px solid #e0e0e0;margin-top:12px;padding-top:10px"><div style="font-size:.68rem;font-weight:700;color:#5a6e5c;margin-bottom:6px">🔑 修改密码</div>';
    h+='<input id="profileOldPwd" class="login-input" type="password" placeholder="当前密码" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.75rem;padding:8px">';
    h+='<input id="profileNewPwd" class="login-input" type="password" placeholder="新密码（至少8位）" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.75rem;padding:8px">';
    h+='<input id="profileCfmPwd" class="login-input" type="password" placeholder="确认新密码" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.75rem;padding:8px">';
    h+='<button class="btn-sm warn" style="width:100%;margin-top:6px" onclick="changePwd()">🔑 确认修改密码</button></div>';
  }else if(mode==='review'){
    // 管理员审核充值/提现
    var txns=AppData._data.pendingTransactions||[];
    var pending=txns.filter(function(tx){return tx.status==='pending'});
    h+='<div style="font-size:.8rem;font-weight:700;margin-bottom:10px">📋 待审核 ('+pending.length+')</div>';
    if(!pending.length){h+='<div style="text-align:center;color:#5a5a5a;padding:16px;font-size:.72rem">暂无待审核项</div>'}
    else pending.forEach(function(tx){
      var icon=tx.type==='topUp'?'💰':'📤';
      h+='<div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px;margin-bottom:6px;font-size:.7rem">';
      h+='<div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>'+icon+' '+tx.user+'</b><span style="color:#5a6e5c">'+tx.amount+' NT</span></div>';
      h+='<div style="color:#5a5a5a;font-size:.62rem;margin-bottom:6px">'+(tx.reason||'')+' · '+tx.createdAt+'</div>';
      h+='<div style="display:flex;gap:4px"><button class="btn-sm pri" style=flex:1;font-size:.62rem;padding:4px onclick="event.stopPropagation();approveTx(\''+tx.id+'\')">✓ 通过</button><button class="btn-sm danger" style=flex:1;font-size:.62rem;padding:4px onclick="event.stopPropagation();rejectTx(\''+tx.id+'\')">✕ 拒绝</button></div>';
      h+='</div>';
    });
    h+='<div style="margin-top:10px"><button class="btn-sm sec" style=width:100% onclick="renderProfile(\'view\')">← 返回资料</button></div>';
  }
  el.innerHTML=h;
}
// ══ 充值/提现 ══
function _genTxId(){return 'tx_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6)}
function _saveTxns(txns){AppData._data.pendingTransactions=txns;AppData._save()}
if(!AppData._data.pendingTransactions)AppData._data.pendingTransactions=[];

function showRechargeForm(){
  var el=document.getElementById('profileTxForm');if(!el)return;
  var wallet=(window.AppData&&AppData.me()&&AppData.me().wallet)||'';
  if(!wallet){el.innerHTML='<div style="border-top:1px solid #e0e0e0;padding-top:8px;color:#c8892e;font-size:.72rem">请先在个人资料中设置钱包地址（编辑资料 -> 钱包地址），充值需要链上转账凭证。</div>';return}
  el.innerHTML='<div style="border-top:1px solid #e0e0e0;padding-top:8px">'+
    '<input id="rechargeAmount" type="number" min="1" placeholder="充值 NT 数量" style="width:100%;padding:8px;border:1px solid var(--green-border);border-radius:8px;font-size:.75rem;margin-bottom:6px;text-align:left;background:#fff;color:#1d2e24">'+
    '<div style="font-size:.6rem;color:#5a6e5c;margin-bottom:4px">你的钱包：'+wallet.substring(0,10)+'...'+wallet.slice(-6)+'</div>'+
    '<div style="display:flex;gap:4px"><button class="btn-sm sec" style=flex:1 onclick="document.getElementById(\'profileTxForm\').innerHTML=\'\'">取消</button>'+
    '<button class="btn-sm pri" style=flex:1 onclick="submitRecharge()">生成充值地址</button></div></div>';
}
function showWithdrawForm(){
  var el=document.getElementById('profileTxForm');if(!el)return;
  var ntBal=window.NT?(NT.getUser(CURRENT_USER)||{}).ntBalance||0:0;
  el.innerHTML='<div style="border-top:1px solid #e0e0e0;padding-top:8px">'+
    '<div style="font-size:.62rem;color:#5a5a5a;margin-bottom:4px">可提现余额：'+ntBal+' NT</div>'+
    '<input id="withdrawAmount" type="number" min="1" max="'+ntBal+'" placeholder="提现 NT 数量" style="width:100%;padding:8px;border:1px solid var(--green-border);border-radius:8px;font-size:.75rem;margin-bottom:6px;text-align:left;background:#fff;color:#1d2e24">'+
    '<input id="withdrawNote" placeholder="备注（选填）" style="width:100%;padding:8px;border:1px solid var(--green-border);border-radius:8px;font-size:.72rem;margin-bottom:6px;text-align:left;background:#fff;color:#1d2e24">'+
    '<div style="display:flex;gap:4px"><button class="btn-sm sec" style=flex:1 onclick="document.getElementById(\'profileTxForm\').innerHTML=\'\'">取消</button>'+
    '<button class="btn-sm pri" style=flex:1 onclick="submitWithdraw()">提交申请</button></div></div>';
}
function submitRecharge(){
  var amt=parseInt(document.getElementById('rechargeAmount').value,10)||0;
  if(amt<=0){showToast('请输入有效金额','error');return}
  if(typeof API==='undefined'||!API.token){showToast('请先登录','error');return}
  var wallet=(window.AppData&&AppData.me()&&AppData.me().wallet)||'';
  API.createDepositIntent(amt, wallet).then(function(r){
    if(!r||r.detail||!r.ok){showToast((r&&r.error)||'创建充值意向失败','error');return}
    var el=document.getElementById('profileTxForm');if(!el)return;
    el.innerHTML='<div style="border-top:1px solid #e0e0e0;padding-top:8px">'+
      '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:4px">请向以下地址转账 '+amt+' NT</div>'+
      '<div style="background:#f5f5f5;padding:10px;border-radius:8px;word-break:break-all;font-size:.65rem;font-family:monospace;margin-bottom:8px;user-select:all" onclick="navigator.clipboard.writeText(this.textContent);showToast(\'已复制\')">'+r.to_address+'</div>'+
      '<div style="font-size:.58rem;color:#5a6e5c;margin-bottom:8px">转账成功后系统将自动检测并入账（约30秒）。如未到账请联系管理员并提供交易哈希。</div>'+
      '<button class="btn-sm sec" style=width:100% onclick="document.getElementById(\'profileTxForm\').innerHTML=\'\'">关闭</button></div>';
  });
}
function submitWithdraw(){
  var amt=parseInt(document.getElementById('withdrawAmount').value,10)||0;
  if(amt<=0){showToast('请输入有效金额','error');return}
  var ntBal=window.NT?(NT.getUser(CURRENT_USER)||{}).ntBalance||0:0;
  if(amt>ntBal){showToast('余额不足（当前 '+ntBal+' NT）','error');return}
  var note=document.getElementById('withdrawNote').value.trim();
  var tx={id:_genTxId(),type:'cashOut',user:CURRENT_USER,amount:amt,reason:note,status:'pending',createdAt:today()};
  AppData._data.pendingTransactions.push(tx);AppData._save();
  document.getElementById('profileTxForm').innerHTML='<div style="color:var(--green-primary);font-size:.7rem;text-align:center;padding:4px">✅ 已提交提现申请，等待管理员审核</div>';
}
function approveTx(txId){
  // FIX-04: 管理员权限检查
  var cu=(typeof getUsers==='function'?getUsers():{})[CURRENT_USER];
  if(!cu||cu.role!=='admin'){showToast('权限不足，仅管理员可审批','error');return}
  var txns=AppData._data.pendingTransactions;
  var tx=txns.find(function(t){return t.id===txId});
  if(!tx||tx.status!=='pending')return;
  if(window.NT){
    try {
      var result=tx.type==='topUp'?NT.topUp(tx.user,tx.amount,tx.reason||'管理员审核充值',tx.id):NT.cashOut(tx.user,tx.amount,tx.reason||'管理员审核提现',tx.id);
      if(!result){showToast('NT 操作失败，请检查余额或用户状态','error');return}
    } catch(e) { showToast('NT 系统异常，请刷新后重试','error');return; }
  }
  // A3: 审批充值同步服务端余额（服务端 /api/nt/topup 需 admin 权限）
  if (tx.type==='topUp' && typeof API !== 'undefined' && API.token) {
    API.topUp(tx.user, tx.amount, tx.reason).catch(function(e) {
      showToast('服务端同步失败', 'warn');
    });
  }
  tx.status='approved';tx.reviewedBy=CURRENT_USER;tx.reviewedAt=today();AppData._save();
  renderProfile('review');refreshUserUI();
  showToast((tx.type==='topUp'?'💰 充值':'📤 提现')+' '+tx.amount+' NT 已到账','ok');
}
function rejectTx(txId){
  // FIX-04: 管理员权限检查
  var cu=(typeof getUsers==='function'?getUsers():{})[CURRENT_USER];
  if(!cu||cu.role!=='admin'){showToast('权限不足，仅管理员可审批','error');return}
  var txns=AppData._data.pendingTransactions;
  var tx=txns.find(function(t){return t.id===txId});
  if(!tx||tx.status!=='pending')return;
  tx.status='rejected';tx.reviewedBy=CURRENT_USER;tx.reviewedAt=today();AppData._save();
  renderProfile('review');
}
function pickAvatar(styleIdx){
  if(typeof styleIdx!=='undefined')_avatarStyleIdx=styleIdx;
  var s=_avatarStyles[_avatarStyleIdx];
  document.querySelectorAll('.avatar-picker').forEach(function(p){p.remove()});
  var avImg=document.getElementById('profileAvatarImg');if(!avImg)return;
  var r=avImg.getBoundingClientRect();
  var g=document.createElement('div');g.className='avatar-picker';
  g.style.cssText='position:fixed;z-index:260;left:'+Math.round(r.left-120)+'px;top:'+Math.round(r.bottom+4)+'px;width:280px;max-height:260px;overflow-y:auto;padding:8px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.25);animation:spcPop .2s ease-out';
  var tabs='<div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid #e0e0e0">';
  for(var t=0;t<_avatarStyles.length;t++) tabs+='<span style="font-size:.55rem;padding:2px 7px;border-radius:10px;cursor:pointer;white-space:nowrap;font-weight:600;'+(t===_avatarStyleIdx?'background:var(--green-primary);color:#fff':'background:#f0f0f0;color:#5a6e5c')+'" onclick="event.stopPropagation();pickAvatar('+t+')">'+_avatarStyles[t]+'</span>';
  tabs+='</div>';
  var grid='<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">';
  var pool=_avatarSeedPool;if(s!=='avataaars'){pool=[];for(var j=0;j<18;j++)pool.push('user'+(j+1))}
  for(var i=0;i<pool.length;i++){
    var seed=pool[i];var url='https://api.dicebear.com/7.x/'+s+'/svg?seed='+encodeURIComponent(seed)+'&size=44';
    grid+='<img src="'+url+'" width="44" height="44" style="border-radius:50%;cursor:pointer;border:2px solid '+(seed===_profileSeed&&s==='avataaars'?'var(--green-primary)':'transparent')+'" onclick="event.stopPropagation();_profileSeed=\''+seed+'\';pickAvatar()" onerror="this.style.display=\'none\'">';
  }
  grid+='</div>';
  var randBtn='<div style="text-align:center;margin-top:6px"><button class="btn-sm pri" style="font-size:.55rem;padding:3px 10px" onclick="event.stopPropagation();var r=Math.random().toString(36).substring(2,8);_avatarSeedPool.push(r);_profileSeed=r;pickAvatar()">🎲 随机生成</button></div>';
  g.innerHTML=tabs+grid+randBtn;
  document.body.appendChild(g);
  if(avImg)avImg.src=profileSrc(_profileSeed);
  setTimeout(function(){document.addEventListener('click',function rm(e){if(g&&g.parentNode&&!g.contains(e.target)&&e.target!==avImg){g.remove();document.removeEventListener('click',rm)}})},50);
}
function saveProfileEdits(){
  var users=getUsers();var u=users[CURRENT_USER];if(!u)return;
  var wallet=document.getElementById('profileWallet').value.trim();
  var bio=document.getElementById('profileBio').value.trim();
  var loc=document.getElementById('profileLoc').value.trim();
  u.wallet=wallet;u.bio=bio;u.location=loc;u.avatar_seed=_profileSeed!=null&&_profileSeed!==undefined?_profileSeed:u.avatar_seed;
  saveUsers(users);
  if(window.AppData){var me=AppData.me();if(me){me.wallet=wallet;me.bio=bio;me.location=loc;me.avatar_seed=u.avatar_seed;AppData._save();}}
  // 同步钱包地址到服务端
  if(wallet&&typeof API!=='undefined'&&API.token){API.updateProfile({wallet_address:wallet}).catch(function(){});}
  if(window.AppData){var me=AppData.me();if(me){me.avatar_seed=u.avatar_seed;AppData._save();}}
  refreshUserUI();
}
function logout(){
  var m=document.getElementById('profileCard');if(m)m.remove();
  // 记住用户名方便下次登录
  try { localStorage.setItem('nt_last_user', CURRENT_USER || ''); } catch(e) {}
  document.cookie = 'nt_user=; path=/; max-age=0';
  document.cookie = 'nt_rt=; path=/; max-age=0';
  try { localStorage.removeItem('nt_refresh'); } catch(e) {}
  if (typeof API !== 'undefined') API.logout();
  // FIX-09: 仅清会话，不删持久化数据。
  // NT 数据由 nt-core.js 独立持久化（NT_STORE_KEY），不受 logout 影响。
  // Phase 1: AppData 按用户分 key（nt_app_v2_{userId}），重新登录后自动恢复。
  if(window.AppData)AppData._currentUser='';
  setCurrentUser('');
  // Phase 0: 清理所有内存全局变量，防止泄露到下一用户
  if(typeof data!=='undefined'){for(var k in data)delete data[k]}
  MOCK_ITEMS=[];
  _avatarSeedPool.length=0;fillSeedPool();
  localStorage.removeItem('nt_session');
  safeStorage.removeItem('nt_remembered_user');
  document.getElementById('villagePage').classList.add('hidden');
  document.getElementById('myPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  S('scrEntry');
}
function changePwd(){
  var o=document.getElementById('profileOldPwd').value;
  var n=document.getElementById('profileNewPwd').value;
  var c=document.getElementById('profileCfmPwd').value;
  if(!o||!n||!c){showToast('请填写完整');return}
  if(n.length<8){showToast('新密码至少8位','error');return}
  if(n!==c){showToast('两次密码不一致','error');return}
  // 优先走服务端（HTTP 模式）
  if(typeof API!=='undefined'&&API.token){
    API.changePassword(o,n).then(function(r){
      if(r&&r.ok){showToast('密码已修改！请重新登录','ok');renderProfile('view');}
      else{showToast((r&&r.error)||'修改失败','error');}
    });
    return;
  }
  // file:// 离线 fallback
  var users=getUsers();var u=users[CURRENT_USER];
  if(!u){showToast('用户数据异常','error');return}
  if(u.password!==encodePassword(o,CURRENT_USER)){showToast('当前密码错误','error');return}
  u.password=encodePassword(n,CURRENT_USER);
  saveUsers(users);
  showToast('密码已修改！','ok');renderProfile('view');
}
function closeMyPage(){
  window.location.hash = '';
  var p=document.getElementById('myPage');p.classList.add('hidden');p.style.zIndex='';
  document.getElementById('villagePage').classList.remove('behind');
  // FIX-11: 如果当前有打开的 overlay，说明用户从 myPage 内导航到了别处，不应触发返回 questHall
  var hasOpenOverlay=document.querySelector('.overlay.open');
  if(_fromQuestHall&&!hasOpenOverlay){
    _fromQuestHall=false;
    _pushOverlay('overlayQuestHall'); document.getElementById('overlayQuestHall').classList.add('open');
  }else{
    _fromQuestHall=false;
    document.getElementById('villagePage').classList.remove('hidden');
  }
}
function showVillage(){document.getElementById('myPage').classList.add('hidden');document.getElementById('villagePage').classList.remove('hidden')}
// Village player card — click to workbench
function initSpcCard(){
  var c=document.getElementById('spcCard');if(!c||c._init)return;c._init=true;
  c.addEventListener('click',function(){showMy()});
}
function initCarousel(){
  var c=document.getElementById('villageCarousel');if(!c)return;
  // 等 DOM 就绪再定位（hidden→visible 后 offsetWidth 才正确）
  requestAnimationFrame(function(){
    var p=c.querySelector('.vp-card');var pw=p?p.offsetWidth:260;
    c.scrollLeft=pw;
  });
  if(c._init)return;c._init=true;
  var cachedDots=document.querySelectorAll('.vdot');
  var cachedPages=c.querySelectorAll('.vp-card');
  var cachedInners=[];cachedPages.forEach(function(pg){cachedInners.push(pg.querySelector('.vp-card-inner'))});
  c.addEventListener('scroll',function(){
    var p0=c.querySelector('.vp-card');var pw=p0?p0.offsetWidth:260;
    var idx=Math.round(c.scrollLeft/Math.max(pw,1));idx=Math.max(0,Math.min(2,idx));
    cachedDots.forEach(function(d,i){d.classList.toggle('active',i===idx)});
    var center=c.scrollLeft+c.offsetWidth/2;
    cachedPages.forEach(function(pg,i){
      var pc=pg.offsetLeft+pg.offsetWidth/2,dist=center-pc,t=Math.min(1,Math.max(0,Math.abs(dist)/(pg.offsetWidth*.7)));
      pg.style.opacity=(1-t*.45);
      var ci=cachedInners[i];if(ci){var v=Math.round(26+t*229);ci.style.background='rgba(255,255,255,'+(1-t*.92).toFixed(2)+')';ci.style.color='rgb('+v+','+v+','+v+')'}
    })
  },{passive:true});
  cachedDots.forEach(function(d){d.addEventListener('click',function(){var i=parseInt(this.dataset.dot,10);var p1=c.querySelector('.vp-card');var pw1=p1?p1.offsetWidth:260;c.scrollTo({left:pw1*i,behavior:'smooth'})})})
}
// FIX-08: 会话级 bridge nonce — file:// 协议下 origin 不可靠，nonce 作为共享密钥
window._APP_NONCE = 'nt_'+Math.random().toString(36).slice(2)+'_'+Date.now().toString(36);
// Bridge: handle messages from map iframe
window.addEventListener('message',function(e){
  if(e.origin!==window.location.origin&&e.origin!=='null')return;
  var d=e.data;if(!d||!d.type)return;
  // FIX-08: 敏感操作（ntEarn/ntSpend）需要有效的 bridge nonce
  if((d.type==='ntEarn'||d.type==='ntSpend'||d.type==='confirm')&&window._APP_NONCE){
    if(d._bridgeNonce!==window._APP_NONCE)return;  // nonce 不匹配，静默丢弃
  }
  if((d.type==='ntEarn'||d.type==='ntSpend')&&(typeof d.amount!=='number'||d.amount<=0||d.amount>10000))return;
  if(d.type==='getUser'){
    var u = Game.getUser();
    e.source.postMessage({type:'userData', data:u, _bridgeNonce:window._APP_NONCE}, '*');
  }
  else if(d.type==='openTask'){openQuestHallPage()}
  else if(d.type==='openMe'){document.getElementById('myPage').style.zIndex='200';showMy()}
  else if(d.type==='toast'){showToast(d.msg)}
  else if(d.type==='confirm'){if(confirm(d.title+'\n\n'+d.msg))e.source.postMessage({type:'confirmResult',result:true},'*')}
  else if(d.type==='closeMap'){closeOverlay('overlayMap')}
  // 阶段 1 前置B：地图建筑 → 档案室
  else if(d.type==='openArchive'){openArchive(d.tab||'members')}
  else if(d.type==='openCardRoom'){openCardRoom()}
  // NT 桥接
  else if(d.type==='ntEarn'){var r=NT.earn(CURRENT_USER,d.amount,d.reason,d.scope);if(r){var t=document.createElement('div');t.textContent='+'+d.amount+' NT · '+d.reason;t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--green-primary);color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;z-index:9999';document.body.appendChild(t);setTimeout(function(){t.remove()},2000)}}
  else if(d.type==='ntSpend'){NT.spend(CURRENT_USER,d.amount,d.reason,d.scope)}
  else if(d.type==='ntGetBalance'){var u=NT.getUser(CURRENT_USER);e.source.postMessage({type:'ntBalance',balance:u?u.ntBalance:0},'*')}
});
// 审计修复：统一 NT 池计算公式
function _calcCampTotalNT(c) {
  var budget = c.budget || {};
  var people = (budget.adventurers||0)+(budget.builders||0);
  var days = (c.schedule||[])[0] ? ((c.schedule[0].cells||[]).length||8) : 8;
  return (budget.lodgingNT||0)*people*days + (budget.mealNT||0)*people*days;
}
// P2-2: 世界观一致的占位提示
function _wipToast(feature) {
  var messages = [
    '村口告示：' + feature + '尚在筹备',
    '📜 ' + feature + '——此页尚在书写中',
    '匠人正在打磨「' + feature + '」，稍后再来',
    '这条路还没通——' + feature + '请走大路'
  ];
  showToast(messages[Math.floor(Math.random() * messages.length)], 'warn');
}
// P2-3: 统一数据访问层
function appData(key, fallback) {
  return (window.AppData && AppData._data && AppData._data[key] != null) ? AppData._data[key] : (fallback !== undefined ? fallback : null);
}
// ══ 结算报告 ══
function renderWeeklySettlement(userId) {
  document.querySelectorAll('.weekly-settle-card').forEach(function(c){c.remove();});
  var u = userId || CURRENT_USER;
  if (!window.NT || !u) return;
  var entries = NT.getLedger({userId: u});
  // 本周一 00:00 → 现在
  var now = new Date();
  var day = now.getDay() || 7; // 周日=7
  var mon = new Date(now); mon.setDate(now.getDate() - day + 1); mon.setHours(0,0,0,0);
  var weekEntries = entries.filter(function(e){
    var t = new Date(e.timestamp).getTime();
    return t >= mon.getTime();
  });
  var income = 0, expense = 0, taskInc = 0, taskExp = 0, rewardInc = 0;
  weekEntries.forEach(function(e){
    var amt = e.amount || 0;
    if (e.to === u) { income += amt; if (e.type === 'task_reward') taskInc++; else if (e.reason && e.reason.indexOf('发现')!==-1) rewardInc++; }
    else if (e.from === u) { expense += amt; if (e.type === 'task_freeze') taskExp++; }
  });
  var net = income - expense;
  var monStr = mon.toISOString().slice(0,10);
  var nowStr = now.toISOString().slice(0,10);

  var card = document.createElement('div');
  card.className = 'weekly-settle-card';
  card.style.cssText = 'position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)';
  card.addEventListener('click', function(e){if(e.target===card)card.remove();});
  var h = '<div style="background:#fff;border-radius:14px;padding:20px;width:300px;max-width:92vw;box-shadow:0 12px 36px rgba(0,0,0,.3);max-height:80vh;overflow-y:auto">';
  h += '<div style="font-weight:700;font-size:.82rem;margin-bottom:4px">📊 本周结算</div>';
  h += '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:12px">' + monStr + ' — ' + nowStr + '</div>';
  h += '<div style="display:flex;gap:8px;margin-bottom:12px">';
  h += '<div style="flex:1;background:#e8f5e9;border-radius:10px;padding:10px;text-align:center"><div style="font-size:.58rem;color:#5a6e5c">收入</div><div style="font-size:1.1rem;font-weight:700;color:#5d8c52">+' + income + '</div></div>';
  h += '<div style="flex:1;background:#fde8e8;border-radius:10px;padding:10px;text-align:center"><div style="font-size:.58rem;color:#5a6e5c">支出</div><div style="font-size:1.1rem;font-weight:700;color:#b84c38">-' + expense + '</div></div>';
  h += '<div style="flex:1;background:' + (net>=0?'#e8f0e8':'#fef0f0') + ';border-radius:10px;padding:10px;text-align:center"><div style="font-size:.58rem;color:#5a6e5c">净收益</div><div style="font-size:1.1rem;font-weight:700;color:' + (net>=0?'#3d6b52':'#b84c38') + '">' + (net>=0?'+':'') + net + '</div></div>';
  h += '</div>';
  h += '<div style="font-size:.65rem;color:#5a6e5c;margin-bottom:10px">📋 完成任务 ' + taskInc + ' 个 · 发布任务 ' + taskExp + ' 个 · 🔍 发现奖励 ' + rewardInc + ' 次</div>';
  if (weekEntries.length) {
    h += '<div style="font-size:.6rem;font-weight:700;color:#5a6e5c;margin-bottom:4px">明细（最近 10 条）</div>';
    weekEntries.slice(0,10).forEach(function(e){
      var isIn = e.to === u;
      h += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:.6rem"><span>' + (e.timestamp||'').slice(0,10) + ' ' + (e.reason||e.type) + '</span><span style="font-weight:600;color:' + (isIn?'#5d8c52':'#b84c38') + '">' + (isIn?'+':'-') + (e.amount||0) + ' NT</span></div>';
    });
  }
  h += '<div style="margin-top:10px"><button class="btn-sm sec" style="width:100%" onclick="document.querySelector(\'.weekly-settle-card\').remove()">关闭</button></div>';
  h += '</div>';
  card.innerHTML = h;
  document.body.appendChild(card);
}
// ══ 信誉系统 ══
function getTrustLevel(score) {
  if (score >= 80) return { level:'🟢 可信', color:'#5d8c52' };
  if (score >= 60) return { level:'🟡 待观察', color:'#c8892e' };
  if (score >= 40) return { level:'🟠 受限', color:'#c8602e' };
  return { level:'🔴 冻结', color:'#b84c38' };
}
