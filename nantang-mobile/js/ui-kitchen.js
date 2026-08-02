/* ══════════════════════════════════════════════════════════════════
   ui-kitchen.js — 共享厨房 FE（P3-一营丁·卡D · 2026-07-31）
   接入 P3 后端 10 端点 · 3 Tab（共享厨房·接龙/时段/冰箱）· UI.Card 包裹
   法源：P3-一营丁_4UI根本性修_v1.md + DESIGN-共享厨房_v0
   ══════════════════════════════════════════════════════════════════ */

var _ktTab = 'potluck'; // potluck | slots | items

function openKitchenPage() {
  closeAllExpands();
  _ktTab = 'potluck';
  _pushOverlay('overlayKitchen');
  var el = document.getElementById('overlayKitchen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'overlayKitchen';
    el.className = 'sub-page';
    el.innerHTML = '<div id="kitchenContent" style="padding:var(--g-pad)"></div>';
    document.body.appendChild(el);
  }
  el.classList.add('open');
  _renderKitchenPage();
}

function _renderKitchenPage() {
  // A-6: index.html 的静态 overlay 用 id=kitchenBody，动态创建路径用 id=kitchenContent，兼容两者
  var el = document.getElementById('kitchenContent') || document.getElementById('kitchenBody');
  if (!el) return;
  var tabs = [
    {key:'potluck', label:'🥘 共享厨房·接龙'},
    {key:'slots',   label:'⏰ 时段'},
    {key:'items',   label:'🧊 冰箱'}
  ];
  var h = '<div style="display:flex;gap:4px;margin-bottom:var(--g-pad);flex-wrap:wrap">';
  tabs.forEach(function(t){
    h += '<button onclick="_ktTab=\''+t.key+'\';_renderKitchenPage()" style="flex:1;min-width:70px;padding:8px 4px;border-radius:8px;border:'+(t.key===_ktTab?'2px solid var(--g-accent)':'1px solid var(--g-card-border)')+';background:'+(t.key===_ktTab?'var(--g-accent-bg)':'var(--g-card)')+';color:'+(t.key===_ktTab?'var(--g-accent)':'var(--g-text-dim)')+';font-size:var(--g-font-size-xs);font-weight:600;cursor:pointer">'+t.label+'</button>';
  });
  h += '<button onclick="closeOverlay(\'overlayKitchen\')" style="padding:8px 12px;border-radius:8px;border:1px solid var(--g-card-border);background:var(--g-card);color:var(--g-text-dim);font-size:var(--g-font-size-xs);cursor:pointer">✕</button>';
  h += '</div><div id="ktTabContent"><div style="text-align:center;padding:24px;color:var(--g-text-dim)">⏳ 加载中…</div></div>';
  el.innerHTML = h;
  if (_ktTab==='potluck') _renderPotluckTab();
  else if (_ktTab==='slots') _renderSlotsTab();
  else _renderItemsTab();
}

// ═══ 共享厨房·接龙 ═══
function _renderPotluckTab() {
  var el = document.getElementById('ktTabContent'); if(!el) return;
  _loadPotluckData(function(items){
    var h = '<button onclick="_showPotluckCreate()" style="width:100%;padding:10px;border-radius:var(--g-radius);border:2px dashed var(--g-accent);background:var(--g-accent-bg);color:var(--g-accent);font-size:var(--g-font-size-xs);font-weight:600;cursor:pointer;margin-bottom:var(--g-gap)">＋ 发起共享</button>';
    if(!items||!items.length){ h+='<div style="text-align:center;padding:24px;color:var(--g-text-muted)">暂无共享，快来发起一个吧！</div>'; }
    else items.forEach(function(e){
      var full=e.current_count>=e.capacity;
      h+='<div style="background:var(--g-card);border-radius:var(--g-radius);box-shadow:var(--g-shadow);padding:var(--g-pad);margin-bottom:var(--g-gap)">';
      h+='<div style="font-weight:700;font-size:var(--g-font-size)">'+esc(e.title)+'</div>';
      h+='<div style="font-size:var(--g-font-size-xs);color:var(--g-text-dim);margin:4px 0">🍽 '+esc(e.dish)+' · 👥 '+(e.current_count||0)+'/'+(e.capacity||8)+'</div>';
      if(e.description) h+='<div style="font-size:.62rem;color:var(--g-text-muted);margin-bottom:6px">'+esc(e.description)+'</div>';
      h+='<div style="font-size:.58rem;color:var(--g-text-dim);margin-bottom:6px">📅 '+(e.event_at||'').slice(0,16)+'</div>';
      if(e.status==='open'&&!full) h+='<button onclick="_doJoinPotluck('+e.id+')" style="width:100%;padding:8px;border-radius:8px;border:none;background:var(--g-accent);color:#fff;font-size:var(--g-font-size-xs);font-weight:600;cursor:pointer">🙋 我要报名</button>';
      else if(full) h+='<div style="text-align:center;padding:8px;font-size:var(--g-font-size-xs);color:var(--g-warn)">已满员</div>';
      h+='</div>';
    });
    el.innerHTML=h;
  });
}

function _showPotluckCreate(){
  var h='<div style="padding:var(--g-pad)"><div style="font-weight:700;font-size:var(--g-font-size);margin-bottom:var(--g-pad)">发起共享</div>';
  h+='<input id="pcTitle" placeholder="共享标题（如：周五包饺子）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<input id="pcDish" placeholder="菜品（如：猪肉白菜饺）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<input id="pcTime" type="datetime-local" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<select id="pcCap" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  for(var i=2;i<=20;i++) h+='<option value="'+i+'"'+(i===8?' selected':'')+'>'+i+' 人</option>';
  h+='</select><input id="pcDesc" placeholder="补充说明（可选）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-pad)">';
  h+='<div style="display:flex;gap:var(--g-gap)"><button onclick="_doCreatePotluck()" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--g-accent);color:#fff;font-size:var(--g-font-size-xs);font-weight:600;cursor:pointer">确认发起</button>';
  h+='<button onclick="closeAllExpands();_renderKitchenPage()" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--g-card-border);background:var(--g-card);color:var(--g-text-dim);font-size:var(--g-font-size-xs);cursor:pointer">取消</button></div></div>';
  _showCardPopup('🥘 发起共享',h,null,true);
}

function _doCreatePotluck(){
  var title=document.getElementById('pcTitle').value.trim(),dish=document.getElementById('pcDish').value.trim();
  var eventAt=document.getElementById('pcTime').value,cap=parseInt(document.getElementById('pcCap').value)||8,desc=document.getElementById('pcDesc').value.trim();
  if(!title||!dish||!eventAt){showToast('请填写标题、菜品和时间','error');return}
  API.createPotluck({title:title,dish:dish,event_at:eventAt,capacity:cap,description:desc}).then(function(r){
    if(r&&r.ok){showToast('共享已发起','ok');closeAllExpands();_renderKitchenPage()}else showToast((r&&r.error)||'发起失败','error');
  });
}

function _doJoinPotluck(eventId){
  UI.Alert.show({type:'info',title:'报名共享',message:'是否确认报名参加此共享？',actions:[{label:'取消',value:false,style:'ghost'},{label:'确认报名',value:true,style:'pri'}]}).then(function(ok){if(ok){
    API.joinPotluck(eventId).then(function(r){
      if(r&&r.ok){if(r.already_joined)showToast('已报过名啦','ok');else showToast('报名成功！','ok');_renderKitchenPage()}else showToast((r&&r.error)||'报名失败','error');
    });
  }});
}

function _loadPotluckData(cb){if(typeof API==='undefined'||!API.token){cb([]);return}API.getPotluckList().then(function(r){cb((r&&r.items)||[])}).catch(function(){cb([])})}

// ═══ 时段 ═══
function _renderSlotsTab(){
  var el=document.getElementById('ktTabContent');if(!el)return;
  _loadSlotsData(function(items){
    var h='<button onclick="_showSlotBook()" style="width:100%;padding:10px;border-radius:var(--g-radius);border:2px dashed var(--g-green);background:var(--g-green-bg);color:var(--g-green);font-size:var(--g-font-size-xs);font-weight:600;cursor:pointer;margin-bottom:var(--g-gap)">＋ 申请时段</button>';
    if(!items||!items.length){h+='<div style="text-align:center;padding:24px;color:var(--g-text-muted)">暂无时段预约</div>'}else{
      var sl={approved:'🟢 已批准',pending:'🟡 待审核',occupied:'🔵 使用中',done:'✅ 已完成',open:'⚪ 空闲'};
      items.forEach(function(s){
        h+='<div style="background:var(--g-card);border-radius:var(--g-radius);box-shadow:var(--g-shadow);padding:var(--g-pad);margin-bottom:var(--g-gap)">';
        h+='<div style="font-weight:700;font-size:var(--g-font-size)">'+(s.group_name?esc(s.group_name):'厨房时段')+'</div>';
        if(s.dish)h+='<div style="font-size:var(--g-font-size-xs);color:var(--g-text-dim)">🍽 '+esc(s.dish)+'</div>';
        h+='<div style="font-size:.62rem;color:var(--g-text-dim)">📅 '+esc((s.start_at||'').slice(0,16))+' → '+esc((s.end_at||'').slice(0,16))+'</div>';
        h+='<div style="font-size:.6rem;margin:4px 0">👥 '+s.party_size+'人 · '+(sl[s.status]||s.status)+'</div>';
        if(s.status==='pending')h+='<div style="text-align:center;padding:6px;font-size:var(--g-font-size-xs);color:var(--g-warn)">⏳ 等待管理员审核</div>';
        h+='</div>';
      });
    }
    el.innerHTML=h;
  });
}

function _showSlotBook(){
  var h='<div style="padding:var(--g-pad)"><div style="font-weight:700;font-size:var(--g-font-size);margin-bottom:var(--g-pad)">申请厨房时段</div>';
  h+='<input id="sbStart" type="datetime-local" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<input id="sbEnd" type="datetime-local" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<input id="sbGroup" placeholder="小组名称（可选）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<input id="sbDish" placeholder="菜品（可选）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<input id="sbSize" type="number" min="1" max="20" value="4" placeholder="人数" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<div style="font-size:.58rem;color:var(--g-text-muted);margin-bottom:var(--g-gap)">≤10人自动批准 · 11-20人需管理员审核</div>';
  h+='<input id="sbNote" placeholder="备注（可选）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-pad)">';
  h+='<div style="display:flex;gap:var(--g-gap)"><button onclick="_doBookSlot()" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--g-green);color:#fff;font-size:var(--g-font-size-xs);font-weight:600;cursor:pointer">确认申请</button>';
  h+='<button onclick="closeAllExpands();_renderKitchenPage()" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--g-card-border);background:var(--g-card);color:var(--g-text-dim);font-size:var(--g-font-size-xs);cursor:pointer">取消</button></div></div>';
  _showCardPopup('⏰ 申请时段',h,null,true);
}

function _doBookSlot(){
  var startAt=document.getElementById('sbStart').value,endAt=document.getElementById('sbEnd').value;
  var groupName=document.getElementById('sbGroup').value.trim(),dish=document.getElementById('sbDish').value.trim();
  var partySize=parseInt(document.getElementById('sbSize').value)||4,note=document.getElementById('sbNote').value.trim();
  if(!startAt||!endAt){showToast('请选择开始和结束时间','error');return}
  API.bookKitchenSlot({start_at:startAt,end_at:endAt,group_name:groupName,dish:dish,party_size:partySize,note:note}).then(function(r){
    if(r&&r.ok){closeAllExpands();
      if(r.status==='pending'){UI.Alert.show({type:'info',title:'已提交审核',message:'您的时段申请（'+partySize+'人）已提交，\n等待管理员审核。\n\n审核通过后将自动确认。',actions:[{label:'知道了',value:true,style:'pri'}]})}
      else showToast('时段已批准！','ok');
      _renderKitchenPage();
    }else showToast((r&&r.error)||(r&&r.detail)||'申请失败','error');
  });
}

function _loadSlotsData(cb){if(typeof API==='undefined'||!API.token){cb([]);return}API.getKitchenSlots().then(function(r){cb((r&&r.items)||[])}).catch(function(){cb([])})}

// ═══ 冰箱（UNIFY-B: 2列卡片网格 + 点击展开详情） ═══
function _renderItemsTab(){
  var el=document.getElementById('ktTabContent');if(!el)return;
  _loadItemsData(function(items){
    var h='<button onclick="_showItemAdd()" style="width:100%;padding:10px;border-radius:var(--g-radius);border:2px dashed var(--g-warn);background:var(--g-warn-bg);color:var(--g-warn);font-size:var(--g-font-size-xs);font-weight:600;cursor:pointer;margin-bottom:var(--g-gap)">＋ 放入物品</button>';
    if(!items||!items.length){h+='<div style="text-align:center;padding:24px;color:var(--g-text-muted)">冰箱空空如也</div>'}else{
      var ll={fridge:'🧊 冰箱',cabinet:'🗄 橱柜',counter:'🍳 台面'},cl={food:'🍎 食物',condiment:'🧂 调料',tool:'🔧 工具',other:'📦 其他'};
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--g-gap)">';
      items.forEach(function(it){
        var catEmoji = (cl[it.category]||'📦 ').split(' ')[0];
        var cardClass = 'card'+(it.is_expired?' card--danger':it.expired_soon?' card--warn':'');
        h+='<div class="'+cardClass+'" onclick="_toggleItemDetail('+it.id+')" style="text-align:center;min-height:70px;display:flex;flex-direction:column;align-items:center;justify-content:center" id="itemCard_'+it.id+'">'+
          '<div style="font-size:1.5rem;margin-bottom:2px">'+catEmoji+'</div>'+
          '<div style="font-weight:700;font-size:var(--g-font-size-sm)">'+esc(it.name)+'</div>'+
          '<div style="font-size:.6rem;color:var(--g-text-dim);margin-top:1px">'+(ll[it.location]||it.location)+'</div>'+
          (it.is_expired?'<div style="font-size:var(--g-font-size-xs);color:var(--g-red);font-weight:600;margin-top:2px">⚠ 已过期</div>':
           it.expired_soon?'<div style="font-size:var(--g-font-size-xs);color:var(--g-warn);font-weight:600;margin-top:2px">⏰ 即将过期</div>':'')+
        '</div>'+
        '<div id="itemDetail_'+it.id+'" style="display:none;grid-column:1/-1;background:var(--g-content);border-radius:var(--g-radius);padding:var(--g-pad);margin-bottom:var(--g-gap);animation:fadeIn .1s ease-out">'+
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:1.3rem">'+catEmoji+'</span><span style="font-weight:700;font-size:var(--g-font-size)">'+esc(it.name)+'</span></div>'+
          '<div style="font-size:var(--g-font-size-xs);color:var(--g-text-dim);margin-bottom:4px">'+(cl[it.category]||it.category)+' · '+(ll[it.location]||it.location)+'</div>'+
          (it.quantity?'<div style="font-size:var(--g-font-size-xs);color:var(--g-text-dim)">📏 '+esc(it.quantity)+'</div>':'')+
          (it.expired_at?'<div style="font-size:var(--g-font-size-xs);color:var(--g-text-dim)">📅 保质期：'+esc(it.expired_at)+'</div>':'')+
          (it.note?'<div style="font-size:var(--g-font-size-xs);color:var(--g-text-dim)">💬 '+esc(it.note)+'</div>':'')+
          '<div style="display:flex;gap:var(--g-gap);margin-top:8px">'+
          '<button onclick="event.stopPropagation();_doTakeItem('+it.id+')" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--g-accent);background:var(--g-card);color:var(--g-accent);font-size:.65rem;cursor:pointer;font-weight:600">📤 取出</button>'+
          '<button onclick="event.stopPropagation();_doRemoveItem('+it.id+')" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--g-red);background:var(--g-card);color:var(--g-red);font-size:.65rem;cursor:pointer;font-weight:600">🗑 移除</button>'+
          '</div>'+
          '<div style="text-align:center;margin-top:6px"><span onclick="_toggleItemDetail('+it.id+')" style="font-size:.62rem;color:var(--g-accent);cursor:pointer">收起 ▴</span></div>'+
        '</div>';
      });
      h+='</div>';
    }
    el.innerHTML=h;
  });
}
function _toggleItemDetail(id) {
  var detail = document.getElementById('itemDetail_'+id);
  if (!detail) return;
  var isOpen = detail.style.display !== 'none';
  var all = document.querySelectorAll('[id^="itemDetail_"]');
  for (var i = 0; i < all.length; i++) { all[i].style.display = 'none'; }
  if (!isOpen) detail.style.display = 'block';
}

function _showItemAdd(){
  var h='<div style="padding:var(--g-pad)"><div style="font-weight:700;font-size:var(--g-font-size);margin-bottom:var(--g-pad)">放入共享物品</div>';
  h+='<input id="iaName" placeholder="物品名称" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<select id="iaCat" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)"><option value="food">🍎 食物</option><option value="condiment">🧂 调料</option><option value="tool">🔧 工具</option><option value="other">📦 其他</option></select>';
  h+='<select id="iaLoc" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)"><option value="fridge">🧊 冰箱</option><option value="cabinet">🗄 橱柜</option><option value="counter">🍳 台面</option></select>';
  h+='<input id="iaQty" placeholder="数量（如：500g、1瓶）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<input id="iaExp" type="date" placeholder="保质期（可选）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-gap)">';
  h+='<input id="iaNote" placeholder="备注（可选）" style="width:100%;padding:8px;border:1px solid var(--g-card-border);border-radius:8px;font-size:var(--g-font-size-xs);margin-bottom:var(--g-pad)">';
  h+='<div style="display:flex;gap:var(--g-gap)"><button onclick="_doAddItem()" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--g-accent);color:#fff;font-size:var(--g-font-size-xs);font-weight:600;cursor:pointer">确认放入</button>';
  h+='<button onclick="closeAllExpands();_renderKitchenPage()" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--g-card-border);background:var(--g-card);color:var(--g-text-dim);font-size:var(--g-font-size-xs);cursor:pointer">取消</button></div></div>';
  _showCardPopup('📦 放入物品',h,null,true);
}

function _doAddItem(){
  var name=document.getElementById('iaName').value.trim(),cat=document.getElementById('iaCat').value;
  var loc=document.getElementById('iaLoc').value,qty=document.getElementById('iaQty').value.trim();
  var exp=document.getElementById('iaExp').value,note=document.getElementById('iaNote').value.trim();
  if(!name){showToast('请填写物品名称','error');return}
  API.addKitchenItem({name:name,category:cat,location:loc,quantity:qty,expired_at:exp,note:note}).then(function(r){
    if(r&&r.ok){showToast('已放入','ok');closeAllExpands();_renderKitchenPage()}else showToast((r&&r.error)||(r&&r.detail)||'放入失败','error');
  });
}

function _doTakeItem(id){API.takeKitchenItem({item_id:id}).then(function(r){if(r&&r.ok){showToast('已取出','ok');_renderKitchenPage()}else showToast((r&&r.error)||(r&&r.detail)||'取件失败','error')})}
function _doRemoveItem(id){UI.Alert.show({type:'warning',title:'移除物品',message:'确定要移除此物品吗？\n此操作不可撤销。',actions:[{label:'取消',value:false,style:'ghost'},{label:'确认移除',value:true,style:'danger'}]}).then(function(ok){if(ok){API.removeKitchenItem(id).then(function(r){if(r&&r.ok){showToast('已移除','ok');_renderKitchenPage()}else showToast((r&&r.error)||(r&&r.detail)||'移除失败','error')})}})}
function _loadItemsData(cb){if(typeof API==='undefined'||!API.token){cb([]);return}API.getKitchenItems().then(function(r){cb((r&&r.items)||[])}).catch(function(){cb([])})}
