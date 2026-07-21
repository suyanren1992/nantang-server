var CURRENT_USER='';
function setCurrentUser(name){
  CURRENT_USER=name;
  if(window.AppData)AppData._currentUser=name;
  if(typeof currentUser!=='undefined'){
    if(name)currentUser={name:name,role:(getUsers()[name]||{}).role||'visitor'};
    else currentUser=null;
  }
}
// showToast 统一入口 — 见下方定义
var TASKS = (window.AppData) ? AppData._data.tasks : {};
// Step 5: 物品持久化到 AppData
var MOCK_ITEMS = [];
function _loadItems(){
  if(window.AppData&&AppData._data.myItems){
    MOCK_ITEMS = AppData._data.myItems[CURRENT_USER] || [];
  }
}
function _saveItems(){ if(window.AppData){ if(!AppData._data.myItems)AppData._data.myItems={}; AppData._data.myItems[CURRENT_USER]=MOCK_ITEMS; AppData._savePrivate(); } }
// Step 6: 统一时间线 — 日记系统
var JOURNAL_TYPES = {
  cooking:    { icon:'🍳', label:'厨房记录', cv:3, xp:3 },
  farming:    { icon:'🌿', label:'田间记录', cv:3, xp:3 },
  repair:     { icon:'🔧', label:'修缮记录', cv:5, xp:5 },
  art:        { icon:'🎨', label:'创作记录', cv:3, xp:3 },
  cleaning:   { icon:'🧹', label:'打扫记录', cv:2, xp:2 },
  daily:      { icon:'📋', label:'日常记录', cv:2, xp:2 },
  stock_in:   { icon:'📦', label:'入库记录', cv:2, xp:2 },
  stock_out:  { icon:'🗑', label:'出库记录', cv:1, xp:1 },
  register:   { icon:'🌟', label:'加入社区', cv:0, xp:0 },
  task_done:  { icon:'✅', label:'完成任务', cv:0, xp:0 }
};
function addJournal(user, type, content, opts) {
  if (!window.AppData) return;
  // 委托给 AppData.addJournal 统一管理
  var entry = AppData.addJournal(user, type, content, opts);
  // 校核制：cleaning/stock_in/stock_out 已通过 AppData.addVerification 发放 NT
  // 其他类型（cooking/farming/repair/art/daily）保留小额的日记NT奖励
  var skipEarn = { cleaning:1, stock_in:1, stock_out:1 };
  if (!skipEarn[type]) {
    var jt = JOURNAL_TYPES[type];
    if (jt && (jt.cv > 0 || jt.xp > 0) && window.NT) {
      try { NT.earn(user, jt.cv, '日记: '+jt.label, 'personal'); } catch(e) {}
    }
  }
  return entry;
}
// Step 5: 新手任务 + CV抵押
var NEWBIE_QUESTS = [
  { id:'sign_covenant', name:'签署社区公约', desc:'阅读并签署南塘在地社区公约', nt:5 },
  { id:'meet_3', name:'认识3位在地成员', desc:'和3位在地成员交换名字和一句话介绍', nt:15 },
  { id:'checkin_5', name:'社区空间打卡', desc:'参观并打卡5个社区空间', nt:20 },
  { id:'join_meal', name:'参加1次饭局', desc:'报名参加一次社区饭局', nt:10 },
  { id:'join_cleaning', name:'参加1次大扫除', desc:'参加第一次大扫除', nt:15 }
];
function _initNewbieQuests(userName) {
  if (!window.AppData) return;
  if (AppData._data.newbieQuests[userName]) return;
  AppData._data.newbieQuests[userName] = NEWBIE_QUESTS.map(function(q){ return { id:q.id, name:q.name, desc:q.desc, nt:q.nt, done:false, doneAt:'' }; });
  // CV抵押：新人CV先冻结
  if (window.NT) {
    var u = NT.getUser(userName);
    if (u) { u.frozenCV = 75; u.contributionValue = 0; }
  }
  AppData._save();
}
function _completeNewbieQuest(userName, questId) {
  if (!window.AppData || !window.NT) return;
  var quests = AppData._data.newbieQuests[userName];
  if (!quests) return;
  var q = quests.find(function(x){ return x.id === questId; });
  if (!q || q.done) return;
  q.done = true; q.doneAt = (typeof Clock !== 'undefined' ? Clock.today() : '');
  NT.earn(userName, q.nt, '新手任务: '+q.name, 'personal');
  // 每完成一个新手任务，解冻 15 CV
  var u2 = NT.getUser(userName);
  if (u2 && u2.frozenCV > 0) {
    var release = Math.min(15, u2.frozenCV);
    u2.frozenCV -= release;
    u2.contributionValue = (u2.contributionValue||0) + release;
  }
  // 全部完成额外奖励
  if (quests.every(function(x){ return x.done; })) {
    NT.earn(userName, 10, '新手任务全部完成奖励', 'personal');
    // 剩余 CV 全部解冻
    var u3 = NT.getUser(userName);
    if (u3 && u3.frozenCV > 0) { u3.contributionValue = (u3.contributionValue||0) + u3.frozenCV; u3.frozenCV = 0; }
  }
  AppData._save();
  updateNewbieChip();
}
// ── 新手引导 UI ──
function showNewbieOnEntry() {
  var quests = (window.AppData && AppData._data.newbieQuests) ? AppData._data.newbieQuests[CURRENT_USER] : null;
  if (!quests || quests.every(function(q){ return q.done; })) return;
  document.getElementById('newbieGuideOverlay').style.display = 'flex';
  renderNewbieGuide();
}
function toggleNewbieGuide() {
  var el = document.getElementById('newbieGuideOverlay');
  if (el.style.display === 'flex') { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  renderNewbieGuide();
}
function updateNewbieChip() {
  var chip = document.getElementById('ubNewbieChip');
  if (!chip) return;
  var quests = (window.AppData && AppData._data.newbieQuests) ? AppData._data.newbieQuests[CURRENT_USER] : null;
  if (!quests) { chip.style.display = 'none'; return; }
  var done = quests.filter(function(q){ return q.done; }).length;
  var total = quests.length;
  if (done >= total) { chip.style.display = 'none'; return; }
  chip.textContent = '🌱 新手 ' + done + '/' + total;
  chip.style.display = 'inline';
}
function renderNewbieGuide() {
  var el = document.getElementById('newbieGuideBody');
  if (!el) return;
  var quests = (window.AppData && AppData._data.newbieQuests) ? AppData._data.newbieQuests[CURRENT_USER] : [];
  if (!quests.length) { el.innerHTML = ''; return; }
  var done = quests.filter(function(q){ return q.done; }).length;
  var total = quests.length;
  var h = '';
  h += '<div style="font-size:.65rem;color:#5a6e5c;margin-bottom:8px">🌱 新手计划 · ' + done + '/' + total + ' 完成</div>';
  quests.forEach(function(q){
    var icon = q.done ? '✅' : '○';
    var color = q.done ? '#5d8c52' : '#1d2e24';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:.7rem;color:' + color + '">';
    h += '<span>' + icon + ' ' + q.name + '</span>';
    h += '<span style="font-size:.6rem;color:#5a6e5c">' + (q.done ? (q.doneAt||'✓') : ('+' + q.nt + ' NT')) + '</span>';
    h += '</div>';
  });
  if (done >= total) {
    h += '<div style="text-align:center;padding:10px;color:#5d8c52;font-size:.72rem;font-weight:600">🎉 全部完成！</div>';
  }
  el.innerHTML = h;
}
// 每周大扫除后解冻50% CV
function _unfreezeCV(userName) {
  if (!window.NT) return;
  var u = NT.getUser(userName);
  if (!u || !u.frozenCV || u.frozenCV <= 0) return;
  var release = Math.ceil(u.frozenCV / 2);
  u.frozenCV -= release;
  u.contributionValue = (u.contributionValue||0) + release;
}
var ITEM_CATS=['画材','画作','杯具','纸张','文具','工具','书籍','食材','手工','其他'];
var ITEM_ICONS={画材:'🎨',画作:'🖼️',杯具:'☕',纸张:'📜',文具:'✒️',工具:'🔧',书籍:'📚',食材:'🥬',手工:'🧶',其他:'📦'};
var _itemFold={};
function renderItemsInTab(filter){
  var f=filter||'all';
  var h='<div style="padding:8px 14px 4px;display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;font-size:.82rem">📦 背包</span><button class="btn-sm pri" onclick="addItem()">+ 添加</button></div>';
  var secs=[
    {k:'storage',label:'📥 在库',color:'#5a6e5c'},
    {k:'selling',label:'🏪 上架中',color:'var(--green-primary)'},
    {k:'auction',label:'🔨 拍卖',color:'#c8892e'},
    {k:'sold',label:'📤 已售出',color:'#8a8a8a'}
  ];
  secs.forEach(function(s){
    if(f!=='all'&&s.k!==f)return;
    var items=MOCK_ITEMS.filter(function(i){return i.status===s.k});
    var fold=_itemFold[s.k];
    h+='<div style="border-top:1px solid var(--green-border);margin:4px 14px 0"></div>';
    h+='<div class="section-head" onclick="_itemFold.'+s.k+'=!_itemFold.'+s.k+';renderItemsInTab(\''+filter+'\')" style=color:'+s.color+'><span>'+s.label+' ('+items.length+')</span><span>'+(fold?'▸ 展开':'▾ 收起')+'</span></div>';
    if(!fold){
      h+='<div style="padding:2px 0 2px 14px;display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-behavior:smooth">';
      h+='<div style=width:4px;flex-shrink:0></div>';
      if(!items.length) h+='<div style="font-size:.6rem;color:#5a5a5a;padding:8px;white-space:nowrap">空空如也</div>';
      else items.forEach(function(item){
        var icon=ITEM_ICONS[item.cat]||'📦';
        h+='<div style="width:80px;height:96px;background:#fff;border:1.5px solid var(--green-border);border-radius:8px;padding:6px 4px;text-align:center;cursor:pointer;flex-shrink:0" onclick="openItemPopup(\''+esc(item.id)+'\')">';
        h+='<div style="font-size:1.6rem;line-height:1">'+icon+'</div>';
        h+='<div style="font-size:.6rem;font-weight:600;margin-top:2px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(item.name)+'</div>';
        h+='<div style="font-size:.58rem;color:'+(item.price?s.color:'#ccc')+';font-weight:600">'+(item.price?'¥'+item.price:'—')+'</div>';
        h+='</div>';
      });
      h+='<div style=width:14px;flex-shrink:0></div>';
      h+='</div>';
    }
  });
  document.getElementById('myTabItems').innerHTML=h;
}
function openItemPopup(id){
  var item=MOCK_ITEMS.find(function(i){return i.id===id});if(!item)return;
  var m=document.getElementById('itemPopup');if(!m){
    m=document.createElement('div');m.id='itemPopup';
    m.style.cssText='position:fixed;inset:0;z-index:300;display:none;align-items:center;justify-content:center';
    m.innerHTML='<div id="itemPopupBg" style="position:absolute;inset:0;background:rgba(0,0,0,.55);animation:fadeIn .2s ease-out" onclick="closeItemPopup()"></div><div id="itemPopupCard" style="position:relative;width:280px;max-width:90vw;background:#fff;border-radius:16px;padding:20px;box-shadow:0 16px 48px rgba(0,0,0,.3);animation:spcPop .25s ease-out"></div>';
    document.body.appendChild(m);
  }
  var card=document.getElementById('itemPopupCard');
  var icon=ITEM_ICONS[item.cat]||'📦';
  card.innerHTML='<button style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#5a5a5a;z-index:1" onclick="closeItemPopup()">✕</button>';
  card.innerHTML+='<div style="text-align:center"><div style="font-size:3rem">'+icon+'</div>';
  card.innerHTML+='<div style="font-weight:700;font-size:1rem;margin-top:6px">'+esc(item.name)+'</div>';
  if(item.cat) card.innerHTML+='<div style="font-size:.65rem;color:#5a6e5c;margin-top:2px">'+icon+' '+(item.cat||'其他')+' · 📍 '+(item.location||'背包')+'</div>';
  card.innerHTML+='<div style="font-size:.68rem;color:#5a6e5c;margin-top:2px">'+item.date+'</div>';
  card.innerHTML+='<div style="margin-top:4px"><span style="font-size:.62rem;padding:2px 8px;border-radius:5px;font-weight:600;background:'+(item.status==='selling'?'#e8f0e8;color:var(--green-primary)':item.status==='auction'?'#fef8e8;color:#c8892e':item.status==='sold'?'#f0f0f0;color:#5a5a5a':'#f2f5f1;color:#5a6e5c')+'">'+({storage:'在库',selling:'上架中',auction:'拍卖中',sold:'已售出'})[item.status]+'</span></div>';
  if(item.price) card.innerHTML+='<div style="font-size:1.2rem;font-weight:700;color:var(--green-primary);margin-top:6px">¥'+item.price+'</div>';
  if(item.desc) card.innerHTML+='<div style="font-size:.68rem;color:#5a6e5c;margin-top:6px;background:#f8f8f8;padding:8px;border-radius:8px;line-height:1.4">'+esc(item.desc)+'</div>';
  card.innerHTML+='<div style="display:flex;gap:8px;margin-top:12px">';
  if(item.status==='storage'){card.innerHTML+='<button class="btn-sm pri" style=flex:1 onclick="closeItemPopup();itemShelf(\''+id+'\')">🏪 上架</button><button class="btn-sm warn" style=flex:1 onclick="closeItemPopup();itemAuction(\''+id+'\')">🔨 送拍</button><button class="btn-sm sec" style=flex:1 onclick="closeItemPopup();editItem(\''+id+'\')">✏️ 编辑</button>'}
  else if(item.status==='selling') card.innerHTML+='<button class="btn-sm danger" style=flex:1 onclick="closeItemPopup();itemDelist(\''+id+'\')">⬇ 下架收回</button>';
  else if(item.status==='auction') card.innerHTML+='<button class="btn-sm danger" style=flex:1 onclick="closeItemPopup();itemCancelAuction(\''+id+'\')">撤回送拍</button>';
  else if(item.status==='sold') card.innerHTML+='<button class="btn-sm pri" style=flex:1 onclick="closeItemPopup();itemRelist(\''+id+'\')">🔄 再次上架</button>';
  card.innerHTML+='</div>';
  m.style.display='flex';
}
function closeItemPopup(){var m=document.getElementById('itemPopup');if(m)m.style.display='none'}
// ponytail: prompt OK for quick price input, replace with inline form later
function itemShelf(id){var p=prompt('售价 ¥');if(!p)return;var it=MOCK_ITEMS.find(function(i){return i.id===id});if(it){it.status='selling';it.price=parseInt(p,10);it.date='刚刚';_saveItems()};renderItemsInTab()}
function itemDelist(id){var it=MOCK_ITEMS.find(function(i){return i.id===id});if(it){it.status='storage';it.price=0;_saveItems()};renderItemsInTab()}
function itemRelist(id){var it=MOCK_ITEMS.find(function(i){return i.id===id});if(it){it.status='selling';it.date='刚刚';_saveItems()};renderItemsInTab()}
function itemCancelAuction(id){var it=MOCK_ITEMS.find(function(i){return i.id===id});if(it){it.status='storage';it.price=0;_saveItems()};renderItemsInTab()}
function itemAuction(id){var p=prompt('起拍价 ¥');if(!p)return;var it=MOCK_ITEMS.find(function(i){return i.id===id});if(it){it.status='auction';it.price=parseInt(p,10);it.date='刚刚';_saveItems()};renderItemsInTab()}
function addItem(){openItemForm('new',null)}
function editItem(id){openItemForm('edit',id)}
function openItemForm(mode,id){
  var item=id?MOCK_ITEMS.find(function(i){return i.id===id}):null;
  var m=document.getElementById('itemPopup');if(!m){m=document.createElement('div');m.id='itemPopup';m.style.cssText='position:fixed;inset:0;z-index:300;display:none;align-items:center;justify-content:center';m.innerHTML='<div id="itemPopupBg" style="position:absolute;inset:0;background:rgba(0,0,0,.55);animation:fadeIn .2s ease-out"></div><div id="itemPopupCard" style="position:relative;width:300px;max-width:92vw;background:#fff;border-radius:16px;padding:20px;box-shadow:0 16px 48px rgba(0,0,0,.3);animation:spcPop .25s ease-out"></div>';document.body.appendChild(m)}
  // Form mode: no outside click to close
  var bg=document.getElementById('itemPopupBg');if(bg)bg.onclick=mode==='new'||mode==='edit'?null:closeItemPopup;
  var card=document.getElementById('itemPopupCard');
  var isNew=mode==='new';
  var h='<button style="position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#5a5a5a;z-index:1" onclick="closeItemPopup()">✕</button>';
  card.innerHTML=h+'<div style="font-weight:700;font-size:.9rem;margin-bottom:10px">'+(isNew?'➕ 添加物品':'✏️ 编辑物品')+'</div>';
  card.innerHTML+='<div style=margin-bottom:8px><label style="font-size:.62rem;color:#5a6e5c;font-weight:600">名称</label><input id="itemFormName" class="login-input" value="'+esc(item?item.name:'')+'" placeholder="物品名称" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px"></div>';
  card.innerHTML+='<div style="display:flex;gap:8px;margin-bottom:8px"><div style=flex:1><label style="font-size:.62rem;color:#5a6e5c;font-weight:600">分类</label><select id="itemFormCat" class="login-input" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.72rem;padding:6px">'+ITEM_CATS.map(function(c){return'<option value="'+c+'"'+(item&&item.cat===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select></div><div style=flex:1><label style="font-size:.62rem;color:#5a6e5c;font-weight:600">地点</label><input id="itemFormLoc" class="login-input" value="'+(item?item.location||'':'')+'" placeholder="存放位置" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.72rem;padding:8px"></div></div>';
  card.innerHTML+='<div style=margin-bottom:10px><label style="font-size:.62rem;color:#5a6e5c;font-weight:600">简介</label><textarea id="itemFormDesc" class="login-input" rows="2" placeholder="物品描述…" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.72rem;padding:8px;width:100%;resize:vertical;font-family:inherit">'+esc(item?item.desc||'':'')+'</textarea></div>';
  card.innerHTML+='<div style="display:flex;gap:8px"><button class="btn-sm sec" style=flex:1 onclick="closeItemPopup()">取消</button><button class="btn-sm pri" style=flex:1 onclick="saveItemForm(\''+mode+'\',\''+(id||'')+'\')">💾 保存</button></div>';
  m.style.display='flex';
}
function saveItemForm(mode,id){
  var name=document.getElementById('itemFormName').value.trim();if(!name)return;
  var cat=document.getElementById('itemFormCat').value;
  var loc=document.getElementById('itemFormLoc').value.trim();
  var desc=document.getElementById('itemFormDesc').value.trim();
  if(mode==='new'){MOCK_ITEMS.push({id:'i'+(MOCK_ITEMS.length+1),name:name,status:'storage',price:0,location:loc||'背包',date:'刚刚',cat:cat,desc:desc})}
  else{var it=MOCK_ITEMS.find(function(i){return i.id===id});if(it){it.name=name;it.cat=cat;it.location=loc;it.desc=desc}}
  _saveItems();closeItemPopup();renderItemsInTab();
}
function pickChip(el){el.parentElement.querySelectorAll('.my-fchip').forEach(function(c){c.classList.remove('on')});el.classList.add('on');renderMyTasks()}
function openSub(t){document.getElementById('subTitle').textContent=t.name;document.getElementById('subPage').classList.add('open');
  var h='<span class="sub-badge sb-gold">'+t.type+'</span> ';
  h+='<span class="sub-badge sb-blue">'+t.status+'</span> ';
  h+='<div style="font-size:1.1rem;font-weight:700;margin-top:8px">'+esc(t.name)+'</div>';
  h+='<div style="font-size:1.2rem;font-weight:700;color:var(--green-primary);margin:4px 0"><img src=豆子.png alt=NT onerror="this.outerHTML=\x27🌱\x27" style=width:14px;height:14px;vertical-align:middle;margin-right:2px>'+t.nt+'</div>';
  if(t.note) h+='<div class="sub-section"><h3>任务说明</h3><p style="font-size:.85rem;line-height:1.6;color:#1d2e24">'+esc(t.note)+'</p></div>';
  h+='<div class="sub-section"><h3>信息</h3><div class="sub-meta">';
  if(t.poster) h+='<span>👤 '+esc(t.poster)+'</span>';
  if(t.deadline) h+='<span>⏰ '+t.deadline+'</span>';
  if(t.reviewer) h+='<span>✅ 审核: '+esc(t.reviewer)+'</span>';
  if(t.slots) h+='<span>👥 '+t.slots+'</span>';
  h+='</div></div>';
  if(t.claimants) h+='<div class="sub-section"><h3>领取人</h3><div class="sub-meta">'+t.claimants.map(function(c){return '<span style="background:#f2f5f1;padding:4px 10px;border-radius:8px;font-size:.75rem">'+c+'</span>'}).join('')+'</div></div>';
  h+='<div class="sub-section"><h3>提交要求</h3><div class="sub-meta"><span>☑ 文字说明</span></div></div>';
  document.getElementById('subBody').innerHTML=h;
  var bar=document.getElementById('subBar');
  if(t.action==='claim'){bar.innerHTML='<button class="btn-pri btn-full" onclick="closeSub()">🎯 认领任务</button>';bar.classList.remove('hidden')}
  else if(t.action==='submit'){bar.innerHTML='<button class="btn-pri btn-full" onclick="closeSub()">📤 提交完成</button>';bar.classList.remove('hidden')}
  else bar.classList.add('hidden')
}
var _ledgerOpen='';
function switchMyTab(tab){
  document.querySelectorAll('.my-tabbar .my-tab').forEach(function(t){t.classList.remove('on')});
  document.querySelectorAll('.my-tab-panel').forEach(function(p){p.classList.remove('on')});
  var inboxPanel = document.getElementById('myInboxPanel'); if (inboxPanel) inboxPanel.style.display = 'none';
  var tabs=document.querySelectorAll('.my-tabbar .my-tab');
  var idx={'tasks':0,'ledger':1,'items':2}[tab]||0;
  if(tabs[idx])tabs[idx].classList.add('on');
  var panel=document.getElementById('myTab'+tab.charAt(0).toUpperCase()+tab.slice(1));
  if(panel)panel.classList.add('on');
  updateMyChips(tab);
  if(tab==='items'){_loadItems();renderItemsInTab('all');}
  if(tab==='ledger'&&!_ledgerOpen){openLedger('personal');refreshLedgerCards()}
  if(tab!=='ledger'){_ledgerOpen='';document.querySelectorAll('.ledger-expand').forEach(function(c){c.remove()})}
}
function updateMyChips(tab){
  var row=document.getElementById('myChipRow');if(!row)return;
  if(tab!=='tasks'){row.style.display='none';return}
  row.style.display='flex';
  var h='';
    var tasks=Object.values(TASKS);
    var urgent=tasks.filter(function(t){return t.status==='待提交'||t.status==='待审核'||t.status==='退回修改'}).length;
    var active=tasks.filter(function(t){return t.status==='进行中'}).length;
    var settle=tasks.filter(function(t){return t.status==='待结算'}).length;
    h+='<span style="font-size:.7rem;background:#fde8e8;color:var(--red);padding:4px 10px;border-radius:14px;font-weight:600;cursor:pointer" onclick="scrollToSection(\'my-sec-urgent\')">🔴 '+urgent+'待处理</span>';
    h+='<span style="font-size:.7rem;background:#e8f0e8;color:var(--green-primary);padding:4px 10px;border-radius:14px;font-weight:600;cursor:pointer" onclick="scrollToSection(\'my-sec-active\')">📋 '+active+'进行中</span>';
    h+='<span style="display:inline-flex;align-items:center;gap:0;margin-left:auto;font-size:.7rem;background:#fff8e8;border:1px solid #d0c090;border-radius:14px;overflow:hidden;font-weight:600"><span style="padding:4px 8px;color:#8a6a30">🧾 '+settle+'待结算</span><span style="padding:4px 10px;background:var(--green-primary);color:#fff;cursor:pointer" onclick="scrollToSection(\'my-sec-settle\')">结算</span></span>';
  row.innerHTML=h;
}
// Shared: inline expand card below a task card
function expandCard(name,cls,css,html,el){
  var ex=document.querySelector('.'+cls);if(ex){ex.remove();return}
  var anchor=(el?el.closest('.card-expand'):null)||document.querySelector('.card-expand')||document.querySelector('.task-card');
  if(!anchor)return;
  document.querySelectorAll('.'+cls).forEach(function(s){s.remove()});
  var d=document.createElement('div');d.className=cls;
  d.style.cssText=css;d.innerHTML=html;
  anchor.parentElement.insertBefore(d,anchor.nextSibling);
  d.scrollIntoView({behavior:'smooth',block:'center'});
}
function openSubmit(el,name){
  var t=TASKS[name];if(!t)return;
  if(t.deadline&&t.deadline<(today())){showToast('任务已逾期，无法提交','error');return}
  var h='<div style=font-weight:700;margin-bottom:8px>📤 提交 · '+esc(t.name)+' · <img src=豆子.png alt=NT onerror="this.outerHTML=\x27🌱\x27" style=width:14px;height:14px;vertical-align:middle;margin-right:2px>'+t.nt+'</div>';
  h+='<div style=margin-bottom:8px><textarea id="submitNote" rows="3" placeholder="描述你完成的内容…" style=width:100%;padding:8px;border:1px solid var(--green-border);border-radius:8px;font-size:.72rem;font-family:inherit;resize:vertical></textarea></div>';
  if(t.reqPhoto){for(var i=1;i<=t.reqPhoto;i++) h+='<div style=margin-bottom:6px><label style=font-size:.6rem;color:#5a6e5c>📷 照片 '+i+'/'+t.reqPhoto+'</label><input type="text" id="submitPhoto'+i+'" placeholder="照片链接" style=width:100%;padding:6px 8px;border:1px solid var(--green-border);border-radius:6px;font-size:.7rem></div>'}
  if(t.reqFile){for(var j=1;j<=t.reqFile;j++) h+='<div style=margin-bottom:6px><label style=font-size:.6rem;color:#5a6e5c>📎 附件 '+j+'/'+t.reqFile+'</label><input type="text" id="submitFile'+j+'" placeholder="附件链接" style=width:100%;padding:6px 8px;border:1px solid var(--green-border);border-radius:6px;font-size:.7rem></div>'}
  h+='<div style=display:flex;gap:8px><button class="btn-sm sec" style=flex:1" onclick="this.closest(\'.submit-expand\').remove()">取消</button><button class="btn-sm pri" style=flex:1" onclick="doSubmit(\''+name+'\')">📤 确认提交</button></div>';
  expandCard(name,'submit-expand','margin-bottom:16px;background:#fff;border:1px solid var(--green-border);border-radius:10px;padding:14px;font-size:.85rem;animation:fadeIn .2s ease-out;border-left:3px solid var(--green-primary)',h,el)
}
function doSubmit(name){
  var t=TASKS[name];if(!t)return;
  var noteEl=document.getElementById('submitNote');if(!noteEl)return;var note=noteEl.value.trim();if(!note)return;
  var sub=note;
  if(t.reqPhoto){for(var i=1;i<=t.reqPhoto;i++){var p=document.getElementById('submitPhoto'+i);if(p&&p.value.trim())sub+='\n📷照片'+i+': '+p.value.trim()}}
  if(t.reqFile){for(var j=1;j<=t.reqFile;j++){var f=document.getElementById('submitFile'+j);if(f&&f.value.trim())sub+='\n📎附件'+j+': '+f.value.trim()}}
  if ((t.slots || 1) > 1) {
    var allSubmitted = (t.claimants || []).every(function(c) { return c.submission; });
    if (!allSubmitted) { AppData._saveShared(); filterQuests(); renderMyTasks(); return; }
  }
  var c=(t.claimants||[]).find(function(x){return x.name===CURRENT_USER});
  if(c){c.submission=sub;c.submittedAt=today();c.status='submitted'}
  else{t.claimants=t.claimants||[];t.claimants.push({name:CURRENT_USER,submission:sub,submittedAt:today(),status:'submitted'})}
  t.status='待审核';t.action='';
  // A2: 通过 AppData 更新
  AppData.updateTask(name, {claimants: t.claimants, status: '待审核', action: ''});
  // FIX-01: 同步 NT 核心状态 — submitTask 让任务进入 completed 态，verifyTask 可释放托管 NT
  if(t._ntTaskId&&window.NT){
    var subResult=NT.submitTask(t._ntTaskId,{note:sub,user:CURRENT_USER});
    if(!subResult){showToast('操作失败，请刷新后重试','error');return;}
  }
  document.querySelectorAll('.submit-expand,.card-expand,.submission-sub').forEach(function(c){c.remove()});
  filterQuests();renderMyTasks();refreshUserUI();
}
function claimTask(name){
  var t=TASKS[name];if(!t)return;
  if(t.publisher===CURRENT_USER){showToast('不能领取自己发布的任务','error');return}
  t.claimants=t.claimants||[];
  if ((t.claimants || []).length >= (t.slots || 1)) { showToast('名额已满', 'error'); return; }
  if(t.claimants.some(function(c){return c.name===CURRENT_USER})){showToast('你已经领取过了','warn');return}
  t.claimants.push({name:CURRENT_USER,status:'in_progress'});
  t.claimedAt=t.claimedAt||today();
  AppData.updateTask(name, {claimants: t.claimants, claimedAt: t.claimedAt});
  // FIX-02: 同步 NT 核心状态 — acceptTask 将任务从 pending 变为 active，分配 assignee
  if(t._ntTaskId&&window.NT){
    var accResult=NT.acceptTask(t._ntTaskId,CURRENT_USER);
    if(!accResult){showToast('操作失败，请刷新后重试','error');return;}
  }
  filterQuests();renderMyTasks();refreshUserUI();
}
function unclaimTask(name){
  var t=TASKS[name];if(!t)return;
  var h='<div style=font-weight:700;margin-bottom:6px;color:#c8892e>📩 申请取消认领 · '+esc(name)+'</div><div style=font-size:.72rem;color:#5a6e5c;margin-bottom:8px>⚠️ 取消认领需要发布者审核批准。<br>确定要申请吗？</div><div style=display:flex;gap:8px><button class="btn-sm sec" style=flex:1" onclick="this.closest(\'.unclaim-expand\').remove()">再想想</button><button class="btn-sm warn" style=flex:1" onclick="confirmUnclaim(\''+esc(name)+'\')">📩 确认申请</button></div>';
  expandCard(name,'unclaim-expand','margin-bottom:16px;background:#fff5f5;border:1px solid #f0c8c8;border-radius:10px;padding:12px 14px;font-size:.85rem;animation:fadeIn .2s ease-out;border-left:3px solid #c8892e',h)
}
function confirmUnclaim(name){
  var t=TASKS[name];if(!t)return;
  t.unclaimRequest=CURRENT_USER;t.unclaimRequestedAt=today();
  document.querySelectorAll('.unclaim-expand,.card-expand').forEach(function(c){c.remove()});
  filterQuests();renderMyTasks();refreshUserUI();
}
function reviewTask(name,action){
  var t=TASKS[name];if(!t)return;
  if(action==='approve'){
    var _t=t;var _name=name;
    showConfirm('确认审核通过「'+_name+'」？通过后将释放 NT 奖励给完成者。',function(){
    _t.status='待结算';_t.completedAt=today();_t.reviewedAt=today();
    _t.claimants.forEach(function(c){if(c.status==='submitted')c.status='completed'});
    AppData.updateTask(_name, {status:'待结算', completedAt:_t.completedAt, reviewedAt:_t.reviewedAt, claimants:_t.claimants});
    if(_t._ntTaskId&&window.NT){var vr=NT.verifyTask(_t._ntTaskId, CURRENT_USER, true);if(!vr){showToast('审核失败，请刷新后重试','error');return;}}
    document.querySelectorAll('.card-expand,.review-expand,.submission-sub').forEach(function(c){c.remove()});
    filterQuests();renderMyTasks();refreshUserUI();
    });
  }else{
    var h='<div style=font-weight:700;margin-bottom:6px;color:var(--red)>🔙 退回修改 · '+esc(name)+'</div><textarea id="reviewReason" rows="2" placeholder="说明退回理由…" style=width:100%;padding:8px;border:1px solid #f0c8c8;border-radius:8px;font-size:.72rem;font-family:inherit;resize:vertical;margin-bottom:8px></textarea><div style=display:flex;gap:8px><button class="btn-sm sec" style=flex:1" onclick="this.closest(\'.review-expand\').remove()">取消</button><button class="btn-sm danger" style=flex:1" onclick="confirmReject(\''+esc(name)+'\')">✕ 确认打回</button></div>';
    expandCard(name,'review-expand','margin-bottom:16px;background:#fff5f5;border:1px solid #f0c8c8;border-radius:10px;border-bottom:3px solid #f0c8c8;padding:12px 14px;font-size:.85rem;animation:fadeIn .2s ease-out;border-left:3px solid var(--red)',h)
  }
}
function confirmReject(name){
  var reason=document.getElementById('reviewReason').value.trim();if(!reason){showToast('请填写退回理由','error');return}
  var t=TASKS[name];if(!t)return;
  t.reviewNote=reason;t.status='退回修改';t.reviewedAt=today();t.action='edit';
  AppData.updateTask(name, {reviewNote:reason, status:'退回修改', reviewedAt:t.reviewedAt, action:'edit'});
  // NT 系统：退还托管 NT 给发布者
  if(t._ntTaskId&&window.NT){var vr=NT.verifyTask(t._ntTaskId, CURRENT_USER, false, reason);if(!vr){showToast('退回失败，请刷新后重试','error');return;}}
  document.querySelectorAll('.review-expand,.card-expand,.submission-sub').forEach(function(c){c.remove()});
  filterQuests();renderMyTasks();refreshUserUI();
}
function editTask(name){
  var t=TASKS[name];if(!t)return;
  document.getElementById('pubName').value=t.name||'';
  document.getElementById('pubType').value=t.type||'在地任务';
  document.getElementById('pubNT').value=t.nt||5;
  document.getElementById('pubSlots').value=t.slots||1;
  document.getElementById('pubDeadline').value=t.deadline||'';
  document.getElementById('pubReviewer').value=t.reviewer||'';
  document.getElementById('pubNote').value=t.note||'';
  if(t.reqPhoto){document.getElementById('pubReqPhoto').checked=true;document.getElementById('pubReqPhotoCount').value=t.reqPhoto}
  if(t.reqFile){document.getElementById('pubReqFile').checked=true;document.getElementById('pubReqFileCount').value=t.reqFile}
  var locSel=document.getElementById('pubLocation');if(locSel&&t.locationId)locSel.value=t.locationId;
  onPubTypeChange();
  document.getElementById('overlayPublishTask').classList.add('open');
}
function withdrawTask(name){
  var t=TASKS[name];if(!t)return;
  var submitters=(t.claimants||[]).filter(function(c){return c.status==='submitted'||c.status==='completed'});
  if(submitters.length>0){
    // 有人已提交 → 扣 50% NT 补偿认领者
    var penalty=Math.round(t.nt/2);
    var each=Math.round(penalty/submitters.length);
    var names=submitters.map(function(c){return c.name}).join('、');
    showConfirm('⚠️ '+names+' 已提交成果。撤回将扣除 '+penalty+' NT（50%）作为补偿。确认？',function(){
      if(t._ntTaskId&&window.NT){
        NT.cancelTask(t._ntTaskId,'发布者撤回（已提交，罚50%）');
        submitters.forEach(function(c){NT.transfer(CURRENT_USER,c.name,each,'撤回补偿: '+t.name)});
      }
      delete TASKS[name];AppData.deleteTask(name);filterQuests();renderMyTasks();refreshUserUI();
    });
  }else{
    showConfirm('确认撤回任务「'+name+'」？',function(){
      if(t._ntTaskId&&window.NT){NT.cancelTask(t._ntTaskId,'发布者撤回');}
      delete TASKS[name];AppData.deleteTask(name);filterQuests();renderMyTasks();refreshUserUI();
    });
  }
}
function requestWithdraw(name){
  var h='<div style=font-weight:700;margin-bottom:6px;color:var(--red)>📩 申请撤回 · '+esc(name)+'</div>';
  h+='<textarea id="withdrawReason" rows="2" placeholder="说明撤回原因…" style=width:100%;padding:8px;border:1px solid #f0c8c8;border-radius:8px;font-size:.72rem;font-family:inherit;resize:vertical;margin-bottom:8px></textarea>';
  h+='<div style=font-size:.6rem;color:#5a5a5a;margin-bottom:8px>⚠️ 提交后需审核人批准</div>';
  h+='<div style=display:flex;gap:8px><button class="btn-sm sec" style=flex:1" onclick="this.closest(\'.withdraw-expand\').remove()">取消</button><button class="btn-sm danger" style=flex:1" onclick="confirmWithdraw(\''+name+'\')">📩 确认申请</button></div>';
  expandCard(name,'withdraw-expand','margin-bottom:16px;background:#fff5f5;border:1px solid #f0c8c8;border-radius:10px;border-bottom:3px solid #f0c8c8;padding:12px 14px;font-size:.85rem;animation:fadeIn .2s ease-out;border-left:3px solid var(--red)',h)
}
function confirmWithdraw(name){
  var reason=document.getElementById('withdrawReason').value.trim();if(!reason){showToast('请填写撤回理由','error');return}
  var t=TASKS[name];if(!t)return;
  t.withdrawRequest=reason;t.withdrawRequestedBy=CURRENT_USER;
  document.querySelectorAll('.withdraw-expand,.card-expand').forEach(function(c){c.remove()});
  filterQuests();renderMyTasks();refreshUserUI();
}
function settleTask(name){
  var t=TASKS[name];if(!t)return;
  var stlr=t.settler||t.publisher||'';
  var h='<div style=font-weight:700;margin-bottom:6px;color:#c8892e>🧾 结算确认 · '+esc(t.name)+'</div>';
  h+='<div style=font-size:.65rem;color:#5a6e5c;margin-bottom:4px>💳 支付人：'+esc(stlr)+' · 金额：<img src=豆子.png alt=NT onerror="this.outerHTML=\x27🌱\x27" style=width:14px;height:14px;vertical-align:middle;margin-right:2px>'+t.nt+'</div>';
  var done=(t.claimants||[]).filter(function(c){return c.status==='completed'});
  if(done.length) h+='<div style=font-size:.65rem;color:#5a6e5c;margin-bottom:8px>✅ 完成人：'+done.map(function(c){return c.name}).join('、')+'</div>';
  h+='<div style=display:flex;gap:8px><button class="btn-sm sec" style=flex:1" onclick="this.closest(\'.settle-expand\').remove()">取消</button><button class="btn-sm pri" style=flex:1" onclick="confirmSettle(\''+name+'\')">✅ 确认结算 · <img src=豆子.png alt=NT onerror="this.outerHTML=\x27🌱\x27" style=width:14px;height:14px;vertical-align:middle;margin-right:2px>'+t.nt+'</button></div>';
  expandCard(name,'settle-expand','margin-bottom:16px;background:#fffbf5;border:1px solid #e8d5a0;border-bottom:3px solid #e8d5a0;border-radius:10px;padding:12px 14px;font-size:.85rem;animation:fadeIn .2s ease-out;border-left:3px solid #c8892e',h)
}
function confirmSettle(name){
  var t=TASKS[name];if(!t)return;
  if(t.status==='已结算')return;
  // FIX-10: 只允许从"待结算"或"已完成"状态结算，防止非法流转
  if(t.status!=='待结算'&&t.status!=='已完成'){showToast('任务状态('+t.status+')不可结算','error');return}
  // A2: 通过 AppData 更新任务状态（自动存盘）
  AppData.updateTask(name, {status:'已结算', settler:CURRENT_USER, completedAt:t.completedAt||today()});
  // 营队任务完成后，认领者自动升级为共建者
  if(t.scope==='营队'){(t.claimants||[]).forEach(function(c){var u=getUsers()[c.name];if(u&&u.role==='visitor'&&c.status==='completed')upgradeRole(c.name,'builder','')})}
  // NT 已在 verifyTask 时完成转帐，结算仅更新任务状态，不重复记账
  document.querySelectorAll('.settle-expand,.card-expand,.submission-sub,.submit-expand').forEach(function(c){c.remove()});
  filterQuests();renderMyTasks();refreshUserUI();
}
function today(){return (window.Clock&&Clock.today)?Clock.today():new Date().toISOString().slice(0,10)}
// Toast system: inline card notifications, no browser dialogs
function showConfirm(msg,onOk){
  document.querySelectorAll('.confirm-card').forEach(function(c){c.remove()});
  var d=document.createElement('div');d.className='confirm-card';
  d.style.cssText='position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);animation:fadeIn .15s ease-out';
  d.innerHTML='<div style="background:#fff;border-radius:14px;padding:20px;width:260px;text-align:center;box-shadow:0 12px 36px rgba(0,0,0,.3)"><div style="font-size:.82rem;font-weight:700;margin-bottom:12px">'+esc(msg)+'</div><div style="display:flex;gap:8px"><button class="btn-sm sec" style=flex:1 onclick="this.closest(\'.confirm-card\').remove()">取消</button><button class="btn-sm danger" style=flex:1 id="confirmOkBtn">确认</button></div></div>';
  document.body.appendChild(d);
  document.getElementById('confirmOkBtn').addEventListener('click',function(){d.remove();if(onOk)onOk()});
}
function showToast(msg,type,anchor){
  // 单参数：浮动绿色 toast（Game.toast / postMessage 使用）
  if(!type&&!anchor){
    var t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--green-primary);color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;z-index:9999;pointer-events:none;animation:spcPop .15s ease-out';
    document.body.appendChild(t);
    setTimeout(function(){t.style.opacity='0';t.style.transition='opacity .15s';setTimeout(function(){t.remove()},150)},1500);
    return;
  }
  // 多参数：内联彩色卡片
  document.querySelectorAll('.toast-card').forEach(function(t){t.remove()});
  var d=document.createElement('div');d.className='toast-card';
  var bg=type==='error'?'#fde8e8':type==='warn'?'#fef8e8':'#e8f0e8';
  var cl=type==='error'?'var(--red)':type==='warn'?'#c8892e':'var(--green-primary)';
  d.style.cssText='padding:8px 12px;border-radius:8px;font-size:.7rem;font-weight:600;background:'+bg+';color:'+cl+';margin:4px 0;animation:fadeIn .1s ease-out;text-align:center';
  d.textContent=msg;
  if(anchor&&anchor.parentNode){anchor.parentNode.insertBefore(d,anchor.nextSibling);setTimeout(function(){if(d.parentNode)d.remove()},2500)}
  else{var el=document.activeElement||document.body;el.parentNode.insertBefore(d,el.nextSibling||el);setTimeout(function(){if(d.parentNode)d.remove()},2500)}
}
// A4: saveAppData/loadAppData 已由 AppData 替代。保留空函数防止调用报错。
function saveAppData(){}
function loadAppData(){}
function upgradeRole(name,newRole,code){
  if(typeof changeUserRole!=='function')return{ok:false,error:'功能未加载'};
  var r=changeUserRole(name,newRole,{inviteCode:code||'',skipAdventurerCheck:true});
  if(r&&r.ok){if(window.AppData)AppData.setMe('role',newRole);if(typeof refreshUserUI==='function')refreshUserUI();}
  return r||{ok:false,error:'升级失败'};
}
function scrollToSection(id){var el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}
function closeOverlay(id,showVillage){document.getElementById(id).classList.remove('open');if(showVillage!==false)document.getElementById('villagePage').classList.remove('hidden')}
function openCommunityPage(){document.getElementById('overlayCommunity').classList.add('open');renderCommunityHub();renderTimeline()}
// ── 营地种子数据 ──
// ponytail: CAMP_MOCK fallback 阶段2创营上线后删除
var CAMP_MOCK = [
  { id:'camp_demo_1', name:'第五期共创营', emoji:'🏕️', theme:'南塘有风，共创有光', date:'2026-07-20 — 2026-08-03', status:'active', people:8, max:16, location:'南塘合作社大院', desc:'两周深度共创，在地生活+创作+分享', highlights:['2026-07-20 开营仪式','2026-07-25 工笔画工作坊','2026-08-01 成果分享会'] },
  { id:'camp_demo_2', name:'暑期艺术营', emoji:'🎨', theme:'用画笔记录南塘', date:'2026-08-10 — 2026-08-20', status:'upcoming', people:3, max:12, location:'南塘合作社大院', desc:'暑期艺术创作营，面向青少年和艺术爱好者', highlights:['2026-08-10 开营仪式'] },
  { id:'camp_demo_3', name:'第一期试运营', emoji:'🌟', theme:'探索在地共创模式', date:'2026-06-01 — 2026-06-15', status:'archived', people:12, max:12, location:'南塘合作社大院', desc:'第一次试运营，验证在地共创模式', highlights:['2026-06-01 开营','2026-06-15 结营'] }
];
function getCamps(){ return (window.AppData&&AppData._data.camps&&Object.keys(AppData._data.camps).length) ? Object.values(AppData._data.camps) : CAMP_MOCK; }
function renderCommunityHub() {
  var el = document.getElementById('communityHubContent'); if (!el) return;
  var role = (typeof getUsers==='function'?getUsers():{})[CURRENT_USER]||{};
  var isMember = role.role==='admin'||role.role==='builder'||role.role==='adventurer';
  var isAdmin = role.role==='admin';
  var active = getCamps().filter(function(c){ return c.status==='active'; });
  var upcoming = getCamps().filter(function(c){ return c.status==='upcoming'; });
  var archived = getCamps().filter(function(c){ return c.status==='archived'; });
  var h = '';
  function card(c, showEnter) {
    var cls = c.status==='active'?' camp-card active-camp':' camp-card';
    var btns = '';
    if (c.status==='active') {
      if (isMember||isAdmin) btns += '<button class=camp-btn-enter onclick="enterCamp(\''+c.id+'\')">进入营地</button>';
      btns += '<button class=camp-btn-window onclick="showCampWindow(\''+c.id+'\')">查看窗口</button>';
      if (!isMember) btns += '<span style=font-size:.62rem;color:var(--green-primary);cursor:pointer;margin-left:auto;white-space:nowrap onclick="enterCamp(\''+c.id+'\')">我要报名 →</span>';
    } else if (c.status==='upcoming') {
      btns += '<button class=camp-btn-window onclick="showCampWindow(\''+c.id+'\')">查看窗口</button>';
    } else {
      btns += '<button class=camp-btn-review onclick="showCampWindow(\''+c.id+'\')">查看回顾</button>';
    }
    return '<div class="'+cls+'"><div class=camp-header><div class=camp-emoji>'+c.emoji+'</div><div class=camp-info><div class=camp-name>'+c.name+'</div><div class=camp-meta>'+c.date+' · '+(c.status==='active'?'进行中':c.status==='upcoming'?'招募中':'已结束')+' · '+c.people+'人</div></div></div><div class=camp-theme>'+c.theme+'</div><div class=camp-actions>'+btns+'</div></div>';
  }
  if (active.length) { h += '<div class=event-section-label style=margin-top:0>🟢 进行中</div>'; active.forEach(function(c){ h += card(c, true); }); }
  if (upcoming.length) { h += '<div class=event-section-label>📅 即将开始</div>'; upcoming.forEach(function(c){ h += card(c, false); }); }
  if (archived.length) { h += '<div class=event-section-label>📁 往期归档</div>'; archived.forEach(function(c){ h += card(c, false); }); }
  if (isAdmin) h += '<div class=world-terminal onclick="openCreateCamp()">🌍 世界终端 · 创建新的共创营队</div>';
  // 社区动态流
  var actLog = (window.AppData && AppData._data.activity_log) ? AppData._data.activity_log : [];
  if (actLog.length) {
    h += '<div style="border-top:1px solid #e8ede6;margin-top:8px;padding-top:8px">';
    h += '<div style="font-size:.65rem;font-weight:700;color:#5a6e5c;margin-bottom:6px">📡 社区动态</div>';
    actLog.slice(0,5).forEach(function(a){
      var time = (a.time||'').slice(0,16).replace('T',' ');
      h += '<div style="font-size:.6rem;color:#5a6e5c;padding:3px 0;border-bottom:1px solid #f5f5f5">'+time+' · '+esc(a.text)+'</div>';
    });
    h += '</div>';
  }
  // 阶段 1 前置B：社区档案室入口
  h += '<div style="text-align:center;padding:14px 0 4px;border-top:1px solid #e8ede6;margin-top:8px">'+
    '<span style="font-size:.72rem;color:var(--green-primary);cursor:pointer;font-weight:600" onclick="closeOverlay(\'overlayCommunity\');openArchive(\'members\')">📚 社区档案室 →</span>'+
    '<div style="font-size:.58rem;color:#8a8a8a;margin-top:2px">成员目录 · 运行日志</div>'+
  '</div>';
  // FIX-24: 空状态
  if (!h) {
    h = '<div style="text-align:center;padding:40px 20px;color:#5a6e5c">'+
      '<div style="font-size:2rem;margin-bottom:8px">🏕️</div>'+
      '<div style="font-size:.8rem;font-weight:600">暂无活动</div>'+
      '<div style="font-size:.65rem;color:#aaa;margin-top:4px">等待管理员创建第一个共创营队</div>'+
    '</div>';
  }
  el.innerHTML = h;
}
// ══ 经济常量（统一调参面）══
// 调参范围：roleBonus 5-50, activityBonus 0-30, canteenMealCost 5-30
var CAMP_ECONOMY = {
  roleBonus: { admin: 20, builder: 15, adventurer: 0 },
  activityBonus: 10,
  canteenMealCost: 10
};
// ══ 称号晋升链 ══
var TITLE_LADDER = [
  { min:0,    tier:'🌱 新芽',  color:'#8a8a8a' },
  { min:100,  tier:'🌿 小树',  color:'#5d8c52' },
  { min:500,  tier:'🌳 大树',  color:'#3d6b52' },
  { min:2000, tier:'🏔️ 山峰', color:'#c8892e' },
  { min:5000, tier:'⭐ 星辰',  color:'#c89d2e' }
];
var BRANCH_TITLES = {
  cleaning:  { min:10, icon:'🧹', name:'清洁工' },
  farming:   { min:10, icon:'🧑‍🌾', name:'园丁' },
  cooking:   { min:10, icon:'🍳', name:'伙夫' },
  repair:    { min:5,  icon:'🔧', name:'修理工' },
  art:       { min:10, icon:'🎨', name:'画师' },
  discovery: { min:10, icon:'👀', name:'发现者' }
};
function computeTitle(userId) {
  var u = window.NT ? NT.getUser(userId) : null;
  var xp = u ? (u.experienceValue||0) : 0;
  var tier = TITLE_LADDER[0];
  for (var i = TITLE_LADDER.length - 1; i >= 0; i--) {
    if (xp >= TITLE_LADDER[i].min) { tier = TITLE_LADDER[i]; break; }
  }
  // 分支称号：从 journal 统计各类型次数
  var stats = { cleaning:0, farming:0, cooking:0, repair:0, art:0, discovery:0 };
  if (window.AppData && AppData._data.journal) {
    AppData._data.journal.forEach(function(j) {
      if (stats.hasOwnProperty(j.type)) stats[j.type]++;
    });
  }
  // 加上 cardDiscoveries 中该用户被 confirmed 的次数
  if (window.AppData && AppData._data.cardDiscoveries) {
    AppData._data.cardDiscoveries.forEach(function(d) {
      if (d.status === 'confirmed' && d.guessedPerson === userId) stats.discovery++;
    });
  }
  var branches = [];
  for (var k in BRANCH_TITLES) {
    if (stats[k] >= BRANCH_TITLES[k].min) branches.push(BRANCH_TITLES[k]);
  }
  return { tier: tier, branches: branches, xp: xp, stats: stats };
}
