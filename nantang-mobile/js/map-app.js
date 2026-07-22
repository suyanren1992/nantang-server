// ═══ Bridge: postMessage to parent ═══
// v2 — carousel sync fix
if(typeof _post==='undefined'){window._post=function(data){if(window.parent!==window)window.parent.postMessage(data,'*')}}
// ═══ DOM helper ═══
var _mapContainer=null;
function $(id) {
  if (_mapContainer) {
    return _mapContainer.querySelector('#' + CSS.escape(id));
  }
  return document.getElementById(id);
}

// ═══ 数据层 ═══
var HARDCODED_BUILDINGS = [
  { id:'toilet_b',name:'公共厕所',icon:'🚻',meta:'1F·🔴超时2天',photo:'https://placehold.co/600x360/d8c8b8/5a3a3a?text=厕所',photoBg:'linear-gradient(160deg,#e8e0d0,#d8d0b8)',status:'red',summary:{status:'📍办公楼1F',cleanliness:'🔴超时2天·小红轮值',items:'🧻卫生纸剩3卷',alert:'⚠急需打扫'},floors:{},plots:[],linkedTasks:['打扫厕所','补卫生纸']},
  { id:'parking',name:'B门·停车',icon:'🅿️',meta:'🟢正常',photo:'https://placehold.co/600x360/c8c0a8/5a4a3a?text=停车场',photoBg:'linear-gradient(160deg,#e0dcc8,#d0c8b0)',status:'green',summary:{vehicle:'🛵三轮车·○在库',key:'🔑钥匙在门卫处',user:'👤无人取用',returnTime:'⏰无预计归还'},floors:{},plots:[],linkedTasks:[]},
  { id:'gate_a',name:'A门',icon:'🚪',meta:'入口·🟢正常',photo:'https://placehold.co/600x360/d8d0c0/5a4a3a?text=A门',photoBg:'linear-gradient(160deg,#e8e0d0,#d8d0b8)',status:'green',summary:{status:'📍主入口·🟢正常',note:'📋无特殊事项'},floors:{},plots:[],linkedTasks:[]},
  { id:'office',name:'社区办公楼',icon:'🏠',meta:'3层·18间·🟢整洁',photo:'https://placehold.co/600x360/e8d8c0/8a7a60?text=办公楼',photoBg:'linear-gradient(160deg,#f0e8d8,#e0d4b8)',status:'green',summary:{cleanliness:'🟢4 🟡2 🔴1',items:'📦6件',onsite:'👤小杨在厨房',cleaning:'📋厨房·小红/厕所·大飞',alert:'⚠白菜3天后过期'},floors:{'1F':[{id:'storage',name:'小仓库',icon:'📦',status:'green',sub:'',items:[{icon:'📦',text:'备用桌椅',sub:'×3套',status:'clean'},{icon:'🧹',text:'清洁工具',sub:'拖把·水桶',status:'clean'}],people:[],cleaning:[{t:'整理仓库',status:''}],linkedTasks:[]},{id:'kitchen',name:'厨房',icon:'🍳',status:'yellow',sub:'🟡待打扫',items:[{icon:'🧊',text:'冰箱上层',sub:'小杨·7/12',status:'clean'},{icon:'🧊',text:'冰箱下层',sub:'公共·7/10',status:'clean'},{icon:'🍳',text:'灶台',sub:'正常',status:'clean'},{icon:'📦',text:'白菜',sub:'⚠3天过期',status:'warn'}],people:[{icon:'👤',text:'小杨',sub:'在做饭'}],cleaning:[{t:'擦台面',status:''},{t:'倒垃圾',status:''},{t:'拖地',status:''}],linkedTasks:['厨房打扫']},{id:'office_r',name:'办公室',icon:'💼',status:'green',sub:'',items:[{icon:'🪑',text:'办公桌×2',sub:'',status:'clean'},{icon:'💻',text:'电脑',sub:'',status:'clean'}],people:[],cleaning:[{t:'整理文件',status:''}],linkedTasks:[]},{id:'toilet_r',name:'公共厕所',icon:'🚻',status:'red',sub:'🔴超时2天',items:[{icon:'🧻',text:'卫生纸',sub:'剩3卷',status:'warn'}],people:[],cleaning:[{t:'打扫厕所',status:'bad'},{t:'补卫生纸',status:'warn'}],linkedTasks:['打扫厕所']}],'2F':[{id:'studio',name:'画室',icon:'🎨',status:'green',sub:'',items:[{icon:'🎨',text:'颜料×5套',sub:'',status:'clean'},{icon:'🖼',text:'画布×12',sub:'',status:'clean'}],people:[{icon:'👤',text:'若曦',sub:'在画画'}],cleaning:[{t:'洗画笔',status:''}],linkedTasks:['打扫画室']},{id:'study_r',name:'书房',icon:'📚',status:'green',sub:'',items:[{icon:'📚',text:'藏书·200册',sub:'',status:'clean'}],people:[],cleaning:[{t:'整理书架',status:''}],linkedTasks:[]}],'3F':[]}},
  { id:'info',name:'南塘全貌',icon:'📍',meta:'8个空间·3人在线',photo:'https://placehold.co/600x360/a0b8d0/4a6080?text=南塘全貌',photoBg:'linear-gradient(160deg,#d0dce8,#b0c8d8)',status:'green',summary:{isInfo:true},floors:{},plots:[],linkedTasks:[]},
  { id:'study',name:'大地书房',icon:'🏯',meta:'3层·12间·🟢整洁',photo:'https://placehold.co/600x360/c8b898/6a5a40?text=大地书房',photoBg:'linear-gradient(160deg,#d8d0c0,#c8b898)',status:'green',summary:{cleanliness:'🟢4 🟡1',items:'📚200册',onsite:'👤朝林在看书',stay:'🛏️2人入住·王五101·李四103',fee:'💰待收240NT'},floors:{'1F':[{id:'mahjong',name:'麻将室',icon:'🀄',status:'green',sub:'',items:[{icon:'🀄',text:'麻将桌×2',sub:'',status:'clean'}],people:[],cleaning:[{t:'擦拭桌面',status:''}],linkedTasks:[]},{id:'reading',name:'大书房',icon:'📚',status:'green',sub:'',items:[{icon:'📚',text:'藏书·200册',sub:'',status:'clean'}],people:[{icon:'👤',text:'朝林',sub:'在看书'}],cleaning:[{t:'整理书架',status:''}],linkedTasks:[]}],'2F':[{id:'dorm101',name:'101室',icon:'🛏',status:'yellow',sub:'王五·7/15→20·150NT',items:[{icon:'🛏',text:'王五入住',sub:'5天·150NT待付',status:'clean'}],people:[],cleaning:[{t:'整理床铺',status:''}],linkedTasks:[]},{id:'dorm102',name:'102室',icon:'🛏',status:'green',sub:'空房',items:[],people:[],cleaning:[],linkedTasks:[]},{id:'dorm103',name:'103室',icon:'🛏',status:'yellow',sub:'李四·7/15→18·90NT',items:[{icon:'🛏',text:'李四入住',sub:'3天·90NT待付',status:'clean'}],people:[],cleaning:[],linkedTasks:[]},{id:'dorm104',name:'104室',icon:'🛏',status:'green',sub:'空房',items:[],people:[],cleaning:[],linkedTasks:[]},{id:'dorm105',name:'105室',icon:'🛏',status:'green',sub:'空房',items:[],people:[],cleaning:[],linkedTasks:[]},{id:'dorm106',name:'106室',icon:'🛏',status:'green',sub:'空房',items:[],people:[],cleaning:[],linkedTasks:[]}],'阁楼':[{id:'attic',name:'阁楼储物',icon:'📦',status:'green',sub:'',items:[],people:[],cleaning:[],linkedTasks:[]}]}},
  { id:'field',name:'田地A-E',icon:'🌿',meta:'5个种植区',photo:'https://placehold.co/600x360/a0c870/4a6830?text=田地',photoBg:'linear-gradient(160deg,#c0d8a0,#a8c880)',status:'green',summary:{totalPlots:5,planted:3,suggestions:['🌽B区玉米7/23成熟·建议本周收割','💡明后天有雨·提前收割B区','🌱D区E区空闲·可种秋季蔬菜']},floors:{},plots:[{id:'fa',name:'A区',icon:'🥬',status:'green',crop:'番茄',planted:'6/15',days:55,remain:45,harvest:'8/30',note:''},{id:'fb',name:'B区',icon:'🌽',status:'yellow',crop:'玉米',planted:'5/20',days:80,remain:8,harvest:'7/23',note:'⚠即将成熟'},{id:'fc',name:'C区',icon:'🍠',status:'green',crop:'红薯',planted:'6/1',days:90,remain:82,harvest:'9/21',note:''},{id:'fd',name:'D区',icon:'🌳',status:'green',crop:'—',planted:'—',days:0,remain:0,harvest:'—',note:'防护林'},{id:'fe',name:'E区',icon:'🍂',status:'green',crop:'—',planted:'—',days:0,remain:0,harvest:'—',note:'堆肥发酵中'}],linkedTasks:['花园浇水']},
  { id:'stage',name:'戏台·花坛',icon:'🎭',meta:'1区·🟢整洁',photo:'https://placehold.co/600x360/e8d0b0/6a4a3a?text=戏台',photoBg:'linear-gradient(160deg,#f0e0d0,#e0c8b0)',status:'green',summary:{status:'📍1区·🟢整洁',items:'🌸月季·茉莉盛开',events:'🎭无活动·可预约',cleaning:'📋每月修剪花木'},floors:{},plots:[],linkedTasks:[]},
  { id:'plaza',name:'硕区广场',icon:'🏛️',meta:'开放·🟢整洁',photo:'https://placehold.co/600x360/d8c8a8/6a5a40?text=广场',photoBg:'linear-gradient(160deg,#e8dcc8,#d8c8a8)',status:'green',summary:{status:'📍开放空间·🟢整洁',onsite:'👤无人',cleaning:'📋每周六清扫'},floors:{},plots:[],linkedTasks:[]}
];

function getBuildings() {
  var data = (window.Game && window.Game.getData) ? window.Game.getData() : null;
  if (data && data.map_locations && data.map_locations.buildings && data.map_locations.buildings.length > 0) {
    return data.map_locations.buildings;
  }
  return HARDCODED_BUILDINGS;
}

// ═══ 状态 ═══
var currentIdx = 4; // 默认选中「南塘全貌」

var currentFloor = 0, selectedRoomId = null, overviewOpen = false;

function curBuilding() { return getBuildings()[currentIdx]; }
function curRooms() {
  var b = curBuilding();
  if (b.plots && b.plots.length > 0) return b.plots;
  var fKeys = Object.keys(b.floors || {});
  if (fKeys.length === 0) return [];
  if (currentFloor >= fKeys.length) currentFloor = 0;
  return b.floors[fKeys[currentFloor]] || [];
}

function render() { renderContent(currentIdx); renderCarousel(currentIdx); }

function renderContent(idx) {
  var b = getBuildings()[idx];
  if (b.id === 'info') { renderInfoPage(); return; }

  var fKeys = Object.keys(b.floors || {}), rooms = curRooms(), isField = !!(b.plots && b.plots.length > 0);

  $('crumbPath').innerHTML = '🗺️ 实景地图 › <span>' + b.name + '</span>' + (selectedRoomId ? ' › <span>' + (rooms.find(function(r){return r.id===selectedRoomId})||{}).name + '</span>' : '');

  $('photoImg').style.background = b.photoBg;
  $('photoImg').innerHTML = (b.photo ? '<img src="'+b.photo+'" class="ph-image" onerror="this.style.display=\'none\'">' : '') +
    '<div class="ph-fallback"><div class="ph-emoji">'+b.icon+'</div></div>' +
    '<button class="ph-arrow left" onclick="if(currentIdx>0)goTo(currentIdx-1)">‹</button>' +
    '<button class="ph-arrow right" onclick="if(currentIdx<getBuildings().length-1)goTo(currentIdx+1)">›</button>';

  $('bldName').textContent = b.name;
  $('bldMeta').textContent = b.meta;

  var ft = '';
  fKeys.forEach(function(f,i){ ft += '<button class="floor-tab'+(i===currentFloor?' sel':'')+'" onclick="setFloor('+i+')">'+f+'</button>'; });
  $('floorTabs').innerHTML = ft;
  $('floorTabs').style.display = ft ? 'flex' : 'none';

  if (!selectedRoomId && b.summary) {
    $('bldOverview').style.display = 'block';
    $('bldOverview').innerHTML = '<div class="overview-toggle" onclick="toggleOverview()">'+(isField?'🌿种植概况':'📊建筑总览')+'<span class="ov-summary">'+(overviewOpen?'':buildSummaryLine(b))+'</span><span class="ov-arrow">'+(overviewOpen?'▾':'▸')+'</span></div><div class="overview-card'+(overviewOpen?'':' collapsed')+'">'+buildOverviewHTML(b)+'</div>';
  } else { $('bldOverview').style.display = 'none'; }

  var rh = '';
  if (isField) { rh = renderFieldPlots(rooms); }
  else if (rooms.length > 0) { rooms.forEach(function(r){ var sel = selectedRoomId===r.id?' selected':''; rh += '<div class="room-card'+sel+'" onclick="selectRoom(\''+r.id+'\')"><div class="rc-dot" style="background:'+(r.status==='green'?'#5d8c52':r.status==='yellow'?'#c8892e':'#b84c38')+'"></div><div class="rc-icon">'+r.icon+'</div><div class="rc-name">'+r.name+'</div>'+(r.sub?'<div class="rc-sub">'+r.sub+'</div>':'')+'</div>'; }); }
  else { rh = '<div class="room-empty">📍开放空间</div>'; }
  $('roomsGrid').style.display = '';
  $('roomsGrid').innerHTML = rh;

  if (selectedRoomId) {
    var room = rooms.find(function(r){return r.id===selectedRoomId;});
    if (room) { $('scrollArea').style.display = 'none'; $('itemsOverlay').classList.add('show'); $('ioTitle').textContent = room.icon+' '+room.name; $('ioBody').innerHTML = isField ? buildFieldDetail(room) : buildRoomDetail(room); }
  } else { $('scrollArea').style.display = ''; $('itemsOverlay').classList.remove('show'); }
}

function renderInfoPage() {
  $('crumbPath').innerHTML = '🗺️ 实景地图 › <span>南塘合作社大院</span>';
  $('photoImg').style.background = 'linear-gradient(160deg,#d0dce8,#b0c8d8)';
  $('photoImg').innerHTML = '<div class="ph-fallback"><div class="ph-emoji">📍</div></div>' +
    '<button class="ph-arrow left" onclick="if(currentIdx>0)goTo(currentIdx-1)">‹</button>' +
    '<button class="ph-arrow right" onclick="if(currentIdx<getBuildings().length-1)goTo(currentIdx+1)">›</button>';
  $('bldName').textContent = '南塘合作社大院';
  $('bldMeta').textContent = '7月15日 周二 · 晴 32°C · 8个空间';
  $('floorTabs').style.display = 'none';
  $('bldOverview').style.display = 'none';

  var h = '';

  // ═══ 统计数字 ═══
  h += '<div class="info-stats">'+
    '<div class="is-item"><div class="is-num">3</div><div class="is-lbl">🏕️在地</div></div>'+
    '<div class="is-item"><div class="is-num">2</div><div class="is-lbl">☁️云上</div></div>'+
    '<div class="is-item"><div class="is-num">1</div><div class="is-lbl">🚶外出</div></div>'+
    '<div class="is-item warn"><div class="is-num">🟢6</div><div class="is-lbl">整洁</div></div>'+
    '<div class="is-item warn"><div class="is-num" style="color:#c8892e">🟡1</div><div class="is-lbl">注意</div></div>'+
    '<div class="is-item warn"><div class="is-num" style="color:#b84c38">🔴1</div><div class="is-lbl">需处理</div></div>'+
  '</div>';

  // ═══ 人员 ═══
  h += '<div class="section-label">👤 在地人员</div>';
  h += '<div class="avatar-list">'+
    '<div class="av-chip" onclick="jumpTo(\'office\')"><span class="av-circle">👤</span><span class="av-name">小杨</span><span class="av-at">🍳厨房做饭</span></div>'+
    '<div class="av-chip" onclick="jumpTo(\'study\')"><span class="av-circle">👤</span><span class="av-name">朝林</span><span class="av-at">📖大书房看书</span></div>'+
    '<div class="av-chip" onclick="jumpTo(\'office\')"><span class="av-circle">👤</span><span class="av-name">若曦</span><span class="av-at">🎨画室画画</span></div>'+
  '</div>';

  // ═══ 双列信息卡 ═══
  h += '<div class="info-cards">';

  // 打扫
  h += '<div class="ic-card" onclick="openMgmt(\'cleaning\')"><div class="ic-head">🧹 下次大扫除</div>'+
    '<div class="ic-body"><div class="ic-big">3 天</div><div>📅 7月18日 · 周六</div><div style="color:var(--g-text-dim);font-size:.65rem">负责人：小红 · 大飞</div></div></div>';

  // 入住
  h += '<div class="ic-card" onclick="openMgmt(\'stay\')"><div class="ic-head">🛏️ 住宿</div>'+
    '<div class="ic-body"><div><b>王五</b> 101室 · 7/15→20 · 150NT</div><div><b>李四</b> 103室 · 7/15→18 · 90NT</div><div style="color:var(--g-text-dim);font-size:.65rem">4间空房 · 💰待收240NT</div></div></div>';

  // 田地
  h += '<div class="ic-card" onclick="openMgmt(\'field\')"><div class="ic-head">🌿 田地速览</div>'+
    '<div class="ic-body"><div>🥬 A区番茄 · 剩45天</div><div style="color:#c8892e">🌽 B区玉米 · ⚠剩8天将熟</div><div style="color:var(--g-text-dim);font-size:.65rem">🍠 C区红薯 · 🍂 D/E空闲</div></div></div>';

  // 厨房
  h += '<div class="ic-card" onclick="openMgmt(\'kitchen\')"><div class="ic-head">🍳 厨房物品</div>'+
    '<div class="ic-body"><div>🧊 冰箱上层 · 小杨放入 · 7/12</div><div style="color:#c8892e">📦 白菜 · ⚠3天后过期</div><div style="color:var(--g-text-dim);font-size:.65rem">🍳灶台·🪑餐桌·🚿水槽正常</div></div></div>';

  h += '</div>'; // info-cards

  // ═══ 卡片室 + 校核室（对称入口）═══
  h += '<div class="section-label">🃏 社区互动</div>';
  h += '<div class="info-cards">';

  // 卡片室
  var discs = (window.AppData && AppData._data.cardDiscoveries) || [];
  var sevenDaysAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  var recentDiscs = discs.filter(function(d){ return d.createdAt && d.createdAt.slice(0,10) >= sevenDaysAgo; });
  var discPending = recentDiscs.filter(function(d){ return d.status === 'pending'; }).length;
  h += '<div class="ic-card" onclick="if(typeof openCardRoom===\'function\')openCardRoom()"><div class="ic-head">🃏 卡片室</div>';
  h += '<div class="ic-body"><div>近7天 <b>' + recentDiscs.length + '</b> 张牌</div><div><b>' + discPending + '</b> 张待揭</div></div></div>';

  // 校核室
  var vfys = (window.AppData && AppData._data.pendingVerifications) || [];
  var vfyPending = vfys.filter(function(v){ return v.status === 'pending'; }).length;
  var today = new Date().toISOString().slice(0,10);
  var vfyToday = vfys.filter(function(v){ return v.status === 'verified' && v.verifiedAt && v.verifiedAt.slice(0,10) === today; }).length;
  h += '<div class="ic-card" onclick="if(typeof openVerifyRoom===\'function\')openVerifyRoom()"><div class="ic-head">✓ 校核室</div>';
  h += '<div class="ic-body"><div><b>' + vfyPending + '</b> 条待确认</div><div>今日已验证 <b>' + vfyToday + '</b> 次</div></div></div>';

  h += '</div>'; // info-cards
  h += '<div class="section-label">⚠ 需要关注</div>';
  h += '<div class="alert-row" onclick="jumpTo(\'toilet_b\')"><span>🔴</span> 公共厕所 · 打扫超时2天 · 小红轮值</div>';
  h += '<div class="alert-row" onclick="jumpToRoom(\'office\',\'kitchen\',\'1F\')"><span>⚠</span> 厨房 · 白菜3天后过期</div>';
  h += '<div class="alert-row" onclick="jumpTo(\'field\')"><span>🌽</span> 田地 · B区玉米7/23成熟，建议本周收割</div>';

  // ═══ 公开任务 ═══
  h += '<div class="section-label">📋 公开委托</div>';
  h += '<div class="item-row"><div class="ir-icon">🧹</div><div class="ir-text">打扫画室<div class="ir-sub">50NT · 无人认领</div></div></div>';
  h += '<div class="item-row"><div class="ir-icon">🌱</div><div class="ir-text">给菜地浇水<div class="ir-sub">30NT · 无人认领</div></div></div>';

  $('roomsGrid').innerHTML = '<div class="info-wrapper">'+h+'</div>';
  $('roomsGrid').style.display = 'block';
  $('scrollArea').style.display = '';
  $('itemsOverlay').classList.remove('show');
}

// ═══ 跳转辅助 ═══
function jumpTo(id) {
  var idx = getBuildings().findIndex(function(b){ return b.id === id; });
  if (idx >= 0) goTo(idx);
}
function jumpToBuilding(id, floor) {
  var idx = getBuildings().findIndex(function(b){ return b.id === id; });
  if (idx >= 0) { currentIdx = idx; currentFloor = 0; selectedRoomId = null; overviewOpen = false;
    var b = getBuildings()[idx];
    if (b.floors) { var fKeys = Object.keys(b.floors); var fi = fKeys.indexOf(floor); if (fi >= 0) currentFloor = fi; }
    render(); }
}
function jumpToRoom(bldId, roomId, floor) {
  var idx = getBuildings().findIndex(function(b){ return b.id === bldId; });
  if (idx >= 0) { currentIdx = idx; currentFloor = 0; selectedRoomId = roomId; overviewOpen = false;
    var b = getBuildings()[idx];
    if (b.floors) { var fKeys = Object.keys(b.floors); var fi = fKeys.indexOf(floor); if (fi >= 0) currentFloor = fi; }
    render(); }
}

function renderCarousel(idx) {
  var blds = getBuildings();
  var h = '';
  blds.forEach(function(b2, i) {
    var active = (i === idx);
    h += '<div class="bc-card'+(active?' active':'')+'" onclick="goTo('+i+')">'+
      '<span class="bc-icon">'+b2.icon+'</span>'+
      '<span class="bc-name">'+b2.name+'</span>'+
      '<span class="bc-dot" style="background:'+(b2.status==='green'?'#5d8c52':b2.status==='yellow'?'#c8892e':'#b84c38')+'"></span></div>';
  });
  $('bcTrack').innerHTML = h;

  var dots = '';
  blds.forEach(function(_,i){ dots += '<div class="bc-dot'+(i===idx?' active':'')+'" onclick="goTo('+i+')"></div>'; });
  $('bcDots').innerHTML = dots;

  var track = $('bcTrack');
  if (track) {
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var cardW = track.children[0] ? track.children[0].offsetWidth : 60;
        track.style.scrollSnapType = 'none';
        track.scrollLeft = idx * cardW;
        requestAnimationFrame(function(){ track.style.scrollSnapType = ''; });
      });
    });
  }
}

function renderFieldPlots(plots) {
  var h = '';
  plots.forEach(function(p){
    var isP = p.crop && p.crop !== '—';
    h += '<div class="field-plot'+(p.note.indexOf('⚠')>=0?' warn':'')+'" onclick="selectRoom(\''+p.id+'\')"><div class="fp-icon">'+p.icon+'</div><div class="fp-name">'+p.name+'</div>';
    if (isP) h += '<div class="fp-crop">'+p.crop+'</div><div class="fp-bar"><div class="fp-fill" style="width:'+Math.round((1-p.remain/p.days)*100)+'%"></div></div><div class="fp-days">'+p.planted+'→'+p.harvest+'·剩'+p.remain+'天</div>';
    else h += '<div class="fp-crop" style="color:var(--g-text-dim)">'+(p.note||'空闲')+'</div>';
    if (p.note) h += '<div class="fp-note">'+p.note+'</div>';
    h += '</div>';
  });
  return '<div class="field-grid">'+h+'</div>';
}

function buildFieldDetail(plot) {
  var body = '';
  if (plot.crop && plot.crop !== '—') {
    body += '<div class="section-label">🌱作物</div><div class="item-row"><div class="ir-icon">'+plot.icon+'</div><div class="ir-text">'+plot.crop+'<div class="ir-sub">'+plot.planted+'种植·'+plot.days+'天周期·预计'+plot.harvest+'成熟</div></div></div>';
    body += '<div class="section-label">📊生长进度</div><div class="progress-bar"><div class="progress-fill" style="width:'+Math.round((1-plot.remain/plot.days)*100)+'%"></div></div>';
    body += '<div style="font-size:.68rem;color:var(--g-text-dim);margin-top:6px">已生长'+(plot.days-plot.remain)+'天/共'+plot.days+'天·剩余'+plot.remain+'天</div>';
    if (plot.note) body += '<div class="ov-alert">'+plot.note+'</div>';
  } else { body += '<div style="color:var(--g-text-dim);font-size:.72rem;padding:8px">'+(plot.note||'暂无种植')+'</div>'; }
  return body + '<button class="back-to-overview" onclick="closeRoom()">←返回田地总览</button>';
}

function buildSummaryLine(b) {
  var s = b.summary;
  if (!s) return '';
  // 田地
  if (s.totalPlots !== undefined) {
    return s.totalPlots+'个种植区 · '+s.planted+'个已种植'+(s.suggestions&&s.suggestions.length>0?' · ⚠'+s.suggestions.length+'条建议':'');
  }
  // 普通建筑：拼接已有字段
  var parts = [];
  if (s.cleanliness) parts.push(s.cleanliness);
  if (s.items)       parts.push(s.items);
  if (s.onsite)      parts.push(s.onsite.replace(/👤/g,''));
  if (s.stay)        parts.push(s.stay.replace(/🛏️/g,'').replace(/\d+人入住/g,''));
  if (s.fee)         parts.push(s.fee);
  if (s.status)      parts.push(s.status);
  if (s.alert)       parts.push('⚠');
  return parts.join(' · ');
}

function buildOverviewHTML(b) {
  var s = b.summary;
  if (s.totalPlots !== undefined) {
    var h = '<div class="item-row" style="margin-bottom:6px"><span>📊'+s.totalPlots+'个种植区·'+s.planted+'个已种植</span></div>';
    if (s.suggestions && s.suggestions.length) { h += '<div class="section-label" style="margin-top:0">💡建议</div>'; s.suggestions.forEach(function(tip){ h += '<div class="ov-alert" style="margin-bottom:4px">'+tip+'</div>'; }); }
    return h;
  }
  var h = '';
  if (s.cleanliness) h += '<div class="ov-row"><span class="ov-label">🧹卫生</span><span>'+s.cleanliness+'</span></div>';
  if (s.items)      h += '<div class="ov-row"><span class="ov-label">📦物品</span><span>'+s.items+'</span></div>';
  if (s.onsite)     h += '<div class="ov-row"><span class="ov-label">👤在场</span><span>'+s.onsite+'</span></div>';
  if (s.cleaning)   h += '<div class="ov-row"><span class="ov-label">📋打扫</span><span>'+s.cleaning+'</span></div>';
  if (s.stay)       h += '<div class="ov-row"><span class="ov-label">🛏️住宿</span><span>'+s.stay+'</span></div>';
  if (s.fee)        h += '<div class="ov-row"><span class="ov-label">💰费用</span><span>'+s.fee+'</span></div>';
  if (s.vehicle)    h += '<div class="ov-row"><span class="ov-label">🛵车辆</span><span>'+s.vehicle+'</span></div>';
  if (s.key)        h += '<div class="ov-row"><span class="ov-label">🔑钥匙</span><span>'+s.key+'</span></div>';
  if (s.user)       h += '<div class="ov-row"><span class="ov-label">👤取车</span><span>'+s.user+'</span></div>';
  if (s.returnTime) h += '<div class="ov-row"><span class="ov-label">⏰归还</span><span>'+s.returnTime+'</span></div>';
  if (s.events)     h += '<div class="ov-row"><span class="ov-label">🎭活动</span><span>'+s.events+'</span></div>';
  if (s.status)     h += '<div class="ov-row"><span class="ov-label">📍状态</span><span>'+s.status+'</span></div>';
  if (s.note)       h += '<div class="ov-row"><span class="ov-label">📋备注</span><span>'+s.note+'</span></div>';
  if (s.alert)      h += '<div class="ov-alert">'+s.alert+'</div>';
  return h;
}

function buildRoomDetail(room) {
  var body = '';

  // ── L3: 物品列表 ──
  if (room.items && room.items.length) {
    body += '<div class="section-label">📦物品('+room.items.length+'件)</div>';
    room.items.forEach(function(it){
      var statusLabel = it.status==='warn'?'注意':it.status==='expired'?'过期':'正常';
      var statusClass = it.status==='warn'?'is-warn':it.status==='expired'?'is-bad':'is-clean';
      body += '<div class="item-row"><div class="ir-icon">'+it.icon+'</div><div class="ir-text">'+it.text+'<div class="ir-sub">'+(it.sub||'')+'</div></div><div class="item-status '+statusClass+'">'+statusLabel+'</div></div>';
    });
  }

  // ── L3: 关联任务（B.5 可点击）──
  if (room.linkedTasks && room.linkedTasks.length) {
    body += '<div class="section-label">📋关联任务('+room.linkedTasks.length+'个)</div>';
    room.linkedTasks.forEach(function(taskId){
      body += '<div class="item-row" style="cursor:pointer" onclick="event.stopPropagation();window.Game&&Game.openTask&&Game.openTask(\''+taskId+'\')"><div class="ir-icon">📋</div><div class="ir-text" style="color:var(--g-accent);text-decoration:underline">'+taskId+'</div></div>';
    });
  }

  // ── L3: 在场人员 ──
  if (room.people && room.people.length) {
    body += '<div class="section-label">👤在场('+room.people.length+'人)</div>';
    room.people.forEach(function(p){
      body += '<div class="item-row"><div class="ir-icon">'+p.icon+'</div><div class="ir-text">'+p.text+'<div class="ir-sub">'+(p.sub||'')+'</div></div></div>';
    });
  }

  // ── 打扫清单 ──
  if (room.cleaning && room.cleaning.length) {
    body += '<div class="section-label">🧹打扫清单</div>';
    room.cleaning.forEach(function(c){
      body += '<div class="item-row"><div class="ir-icon">☐</div><div class="ir-text">'+c.t+'</div>'+(c.status==='bad'?'<div class="item-status is-bad">超时</div>':'')+'</div>';
    });
  }

  return body + '<button class="back-to-overview" onclick="closeRoom()">←返回建筑总览</button>';
}

function goTo(i) { currentIdx = i; selectedRoomId = null; currentFloor = 0; overviewOpen = false; render(); }
function setFloor(f) { currentFloor = f; selectedRoomId = null; render(); }
function selectRoom(id) { selectedRoomId = (selectedRoomId === id) ? null : id; render(); }
function closeRoom() { selectedRoomId = null; render(); }
function toggleOverview() { overviewOpen = !overviewOpen; render(); }

// ═══ 事件绑定 ═══
var _eventCleanups = [];

function _bindEvents() {
  var track = $('bcTrack');
  var photo = $('photoImg');

  if (track) {
    var _bcSnap;
    function onScroll() {
      clearTimeout(_bcSnap);
      var self = track;
      _bcSnap = setTimeout(function() {
        var blds = getBuildings();
        var cardW2 = self.children[0] ? self.children[0].offsetWidth : 60;
        var idx = Math.round(self.scrollLeft / Math.max(1, cardW2));
        if (idx >= 0 && idx < blds.length && idx !== currentIdx) {
          currentIdx = idx; selectedRoomId = null; currentFloor = 0; overviewOpen = false;
          render();
        }
      }, 80);
    }
    track.addEventListener('scroll', onScroll);
    _eventCleanups.push(function() { track.removeEventListener('scroll', onScroll); });
  }

  if (photo) {
    var _tx = 0;
    function onTouchStart(e) { _tx = e.touches[0].clientX; }
    function onTouchEnd(e) { var dx = e.changedTouches[0].clientX - _tx; if (Math.abs(dx) > 50) { dx < 0 ? goTo(currentIdx + 1) : goTo(currentIdx - 1); } }
    photo.addEventListener('touchstart', onTouchStart, {passive: true});
    photo.addEventListener('touchend', onTouchEnd, {passive: true});
    _eventCleanups.push(function() { photo.removeEventListener('touchstart', onTouchStart); photo.removeEventListener('touchend', onTouchEnd); });
  }

  function onKeydown(e) {
    var blds = getBuildings();
    if (e.key === 'ArrowRight') { if (currentIdx < blds.length - 1) goTo(currentIdx + 1); }
    if (e.key === 'ArrowLeft')  { if (currentIdx > 0) goTo(currentIdx - 1); }
    if (e.key === 'Escape' && selectedRoomId) { closeRoom(); }
  }
  document.addEventListener('keydown', onKeydown);
  _eventCleanups.push(function() { document.removeEventListener('keydown', onKeydown); });
}

function _unbindEvents() {
  _eventCleanups.forEach(function(fn) { fn(); });
  _eventCleanups = [];
}

function backToVillage() {
  currentIdx = 4; currentFloor = 0; selectedRoomId = null; overviewOpen = false;
  _post({type:'closeMap'});
}

// ══════════════════════════════════════
// 管理模块 — 全貌页四张卡的弹出管理界面
// 视角：第一人称（「我」的操作界面）
// 布局：提醒(顶) → 高频操作按钮 → 信息卡片 → 历史(底)
// ══════════════════════════════════════

// ponytail: NT定价后续从公约配置读取
var MGMT_DATA = {
  cleaning: {
    nextDate: '2026-07-18',
    pricing: { dirty: 20, warning: 15, clean: 5 },
    mySelections: [],   // 我选择的房间 ID 列表
    history: [
      { date:'7/08', person:'砚仁', roomName:'画室', nt:5, note:'日常维护' },
      { date:'7/01', person:'大飞', roomName:'厕所', nt:20, note:'大扫除' }
    ]
  },
  stay: {
    myRoom: null,       // 我当前入住的房间 ID
    myCheckIn: null,    // 入住日期
    myCheckOut: null,   // 预计离店日期
    history: [
      { date:'7/15', person:'王五', room:'101', detail:'入住 7/15→20·5天·150NT' },
      { date:'7/15', person:'李四', room:'103', detail:'入住 7/15→18·3天·90NT' }
    ]
  },
  field: {
    history: [
      { date:'7/12', person:'大飞', plotName:'A区', action:'浇水', note:'番茄长势良好' },
      { date:'7/10', person:'朝林', plotName:'C区', action:'施肥', note:'红薯追肥' }
    ]
  },
  kitchen: {
    history: [
      { date:'7/12', person:'小杨', action:'放入物品', item:'鸡蛋×12', location:'冰箱上层' },
      { date:'7/10', person:'公共', action:'放入物品', item:'豆腐×2', location:'冰箱下层' }
    ]
  }
};

var _mgmtFormType = '';

// ── 工具：当前用户 ──
function _me() {
  if (window.Game && Game.getUser) {
    var u = Game.getUser();
    if (u && u.name) return u.name;
  }
  return '砚仁'; // fallback
}

// ── 工具：收集打扫房间 ──
function _collectCleaningRooms() {
  var rooms = [];
  getBuildings().forEach(function(b) {
    var fKeys = Object.keys(b.floors || {});
    fKeys.forEach(function(fk) {
      (b.floors[fk] || []).forEach(function(r) {
        if (r.cleaning && r.cleaning.length > 0) {
          rooms.push({ id:r.id, name:r.name, icon:r.icon, status:r.status, buildingName:b.name, cleaning:r.cleaning });
        }
      });
    });
  });
  return rooms.sort(function(a,b) { return ({red:0,yellow:1,green:2})[a.status]-({red:0,yellow:1,green:2})[b.status]; });
}

// ── 工具：住宿房间 ──
function _getDormRooms() {
  var study = getBuildings().find(function(b) { return b.id === 'study'; });
  var rooms = [];
  if (study && study.floors) {
    Object.keys(study.floors).forEach(function(fk) {
      (study.floors[fk] || []).forEach(function(r) {
        if (r.id && r.id.indexOf('dorm') === 0) rooms.push(r);
      });
    });
  }
  return rooms;
}

// ── 入口 ──
function openMgmt(type) {
  _mgmtFormType = '';
  $('scrollArea').style.display = 'none';
  $('itemsOverlay').classList.remove('show');
  $('mgmtOverlay').classList.add('show');
  var titles = { cleaning:'🧹 大扫除管理', stay:'🛏️ 住宿管理', field:'🌿 田地管理', kitchen:'🍳 厨房管理' };
  $('mgmtTitle').textContent = titles[type] || '';
  renderMgmtPanel(type);
}

function closeMgmt() {
  _mgmtFormType = '';
  $('mgmtOverlay').classList.remove('show');
  $('scrollArea').style.display = '';
}

function renderMgmtPanel(type) {
  var fn = { cleaning:renderCleaningPanel, stay:renderStayPanel, field:renderFieldPanel, kitchen:renderKitchenPanel }[type];
  $('mgmtBody').innerHTML = fn ? fn() : '';
}

function _toggleForm(type) {
  _mgmtFormType = (_mgmtFormType === type) ? '' : type;
  renderMgmtPanel(type);
}

/* ══════════════════════════════════════
   🧹 大扫除管理（我的视角）
   ══════════════════════════════════════ */
function renderCleaningPanel() {
  var rooms = _collectCleaningRooms();
  var p = MGMT_DATA.cleaning.pricing;
  var ntMap = { red:p.dirty, yellow:p.warning, green:p.clean };
  var statusIcon = { red:'🔴', yellow:'🟡', green:'🟢' };
  var mySelections = MGMT_DATA.cleaning.mySelections || [];
  var h = '';

  // ═══ 提醒 ═══
  h += '<div class="mgmt-reminders">';
  var dirtyRooms = rooms.filter(function(r) { return r.status==='red'; });
  if (dirtyRooms.length) h += '<div class="mr-item danger">🔴 '+dirtyRooms.map(function(r){return r.name;}).join('、')+' 超时未打扫 · 需优先处理</div>';
  var warnRooms = rooms.filter(function(r) { return r.status==='yellow'; });
  if (warnRooms.length) h += '<div class="mr-item warn">🟡 '+warnRooms.map(function(r){return r.name;}).join('、')+' 待打扫</div>';
  h += '<div class="mr-item info">📅 下次大扫除：<b>'+MGMT_DATA.cleaning.nextDate+'</b> <span style="cursor:pointer;text-decoration:underline" onclick="_changeCleanDate()">修改</span></div>';
  h += '</div>';

  // ═══ 我的选择概览 ═══
  var myTotalNt = 0;
  mySelections.forEach(function(rid) { var rr=rooms.find(function(r){return r.id===rid;}); if(rr) myTotalNt+=ntMap[rr.status]||0; });
  h += '<div class="mgmt-actions">';
  h += '<button class="ma-btn primary" onclick="_toggleForm(\'cleaning\')">✅ 我完成了打扫</button>';
  h += '<button class="ma-btn secondary" onclick="_saveMySelections()">💾 保存我的选择</button>';
  h += '</div>';
  if (myTotalNt > 0) {
    h += '<div style="text-align:center;font-size:var(--g-font-size-xs);color:var(--g-gold);font-weight:700;margin-bottom:8px">我已选 '+mySelections.length+' 个位置 · 合计 <span style="font-size:1.1rem">+'+myTotalNt+' NT</span></div>';
  }

  // ── 快速完成表单 ──
  h += '<div class="mgmt-quick-form' + (_mgmtFormType==='cleaning'?' open':'') + '">';
  h += '<div class="qf-title">✏️ 我（'+_me()+'）完成了打扫</div>';
  h += '<div class="qf-row">打扫了 <select id="cqRoom"><option value="">选房间 ▼</option>'+rooms.map(function(r){return '<option value="'+r.id+'">'+r.icon+' '+r.name+' +'+ntMap[r.status]+'NT</option>';}).join('')+'</select>';
  h += ' <button class="qf-submit" onclick="_submitMyCleaning()">✓ 确认完成</button></div>';
  h += '</div>';

  // ═══ 房间卡片（点选） ═══
  h += '<div class="mgmt-card-grid">';
  rooms.forEach(function(r) {
    var sel = mySelections.indexOf(r.id) >= 0;
    h += '<div class="mgmt-card'+(sel?' selected':'')+'" onclick="_toggleMyRoom(\''+r.id+'\')">';
    h += '<span class="mc-status" style="background:'+(r.status==='red'?'var(--g-red)':r.status==='yellow'?'var(--g-warn)':'var(--g-green)')+'"></span>';
    h += '<span class="mc-icon">'+r.icon+'</span>';
    h += '<div class="mc-name">'+(sel?'✅ ':'')+statusIcon[r.status]+' '+r.name+'</div>';
    h += '<div class="mc-sub">'+r.buildingName+'</div>';
    if (r.cleaning && r.cleaning.length) {
      h += '<div class="mc-sub">'+r.cleaning[0].t+(r.cleaning[0].status==='bad'?' · ⚠超时':'')+'</div>';
    }
    h += '<div class="mc-nt">+'+ntMap[r.status]+' NT</div>';
    h += '</div>';
  });
  h += '</div>';

  // ═══ 公约定价 ═══
  h += '<div class="mgmt-pricing">';
  h += '<div class="mgmt-price-chip" style="background:var(--g-red-bg)">🔴 超时<br><span class="mp-nt">+'+p.dirty+' NT</span></div>';
  h += '<div class="mgmt-price-chip" style="background:var(--g-warn-bg)">🟡 待打扫<br><span class="mp-nt">+'+p.warning+' NT</span></div>';
  h += '<div class="mgmt-price-chip" style="background:var(--g-green-bg)">🟢 维护<br><span class="mp-nt">+'+p.clean+' NT</span></div>';
  h += '</div>';

  // ═══ 历史 ═══
  h += '<div class="mgmt-history"><div class="mas-title" style="margin-bottom:4px">📜 打扫记录</div>';
  MGMT_DATA.cleaning.history.forEach(function(hi) {
    h += '<div class="mh-item">'+hi.date+' · '+hi.person+' · '+hi.roomName+' ✓ <span style="color:var(--g-gold);font-weight:600">+'+hi.nt+' NT</span></div>';
  });
  h += '</div>';

  return h;
}

function _toggleMyRoom(roomId) {
  var sel = MGMT_DATA.cleaning.mySelections || [];
  MGMT_DATA.cleaning.mySelections = sel;
  var idx = sel.indexOf(roomId);
  if (idx >= 0) sel.splice(idx, 1); else sel.push(roomId);
  renderMgmtPanel('cleaning');
}

function _saveMySelections() {
  var cnt = (MGMT_DATA.cleaning.mySelections||[]).length;
  if (window.Game&&Game.toast) Game.toast('已保存，你选了 '+cnt+' 个打扫位置');
}

function _changeCleanDate() {
  var d = prompt('修改大扫除日期：', MGMT_DATA.cleaning.nextDate);
  if (d) { MGMT_DATA.cleaning.nextDate = d; renderMgmtPanel('cleaning'); }
}

function _submitMyCleaning() {
  var roomId = ($('cqRoom')||{}).value;
  if (!roomId) { if (window.Game&&Game.toast) Game.toast('请选择房间'); return; }
  var rooms = _collectCleaningRooms();
  var rr = rooms.find(function(r) { return r.id===roomId; });
  var p = MGMT_DATA.cleaning.pricing;
  var nt = rr ? ({red:p.dirty,yellow:p.warning,green:p.clean}[rr.status]||0) : 0;
  MGMT_DATA.cleaning.history.unshift({ date:'7/17', person:_me(), roomName:rr?rr.name:roomId, nt:nt, note:'' });
  var sel = MGMT_DATA.cleaning.mySelections || [];
  var idx = sel.indexOf(roomId);
  if (idx>=0) sel.splice(idx,1);
  _mgmtFormType = '';
  if (window.Game&&Game.toast) Game.toast('完成 '+ (rr?rr.name:'') +' +'+nt+'NT');
  renderMgmtPanel('cleaning');
}

/* ══════════════════════════════════════
   🛏️ 住宿管理（我的视角）
   ══════════════════════════════════════ */
function renderStayPanel() {
  var dormRooms = _getDormRooms();
  var me = _me();
  var myRoom = MGMT_DATA.stay.myRoom;
  var h = '';

  // ═══ 提醒 ═══
  h += '<div class="mgmt-reminders">';
  if (myRoom) {
    h += '<div class="mr-item ok">🛏️ 我当前入住：<b>'+myRoom.replace('dorm','')+'室</b> · '+MGMT_DATA.stay.myCheckIn+'→'+MGMT_DATA.stay.myCheckOut+'</div>';
  } else {
    h += '<div class="mr-item info">我尚未入住 · 下方有空房可选</div>';
  }
  h += '<div class="mr-item ok">✓ 4间空房可入住 · 待收 <b style="color:var(--g-gold)">240 NT</b></div>';
  h += '</div>';

  // ═══ 操作按钮 ═══
  h += '<div class="mgmt-actions">';
  if (myRoom) {
    h += '<button class="ma-btn primary" onclick="_checkoutStay()">🚪 退房</button>';
  } else {
    h += '<button class="ma-btn primary" onclick="_toggleForm(\'stay\')">＋ 登记入住</button>';
  }
  h += '</div>';

  // ── 登记表单（未入住时） ──
  h += '<div class="mgmt-quick-form' + (_mgmtFormType==='stay'?' open':'') + '">';
  h += '<div class="qf-title">✏️ 我（'+me+'）登记入住</div>';
  h += '<div class="qf-row">入住 <select id="srRoom">'+dormRooms.filter(function(r){return !r.sub||r.sub==='空房';}).map(function(r){return '<option value="'+r.id+'">'+r.name+'</option>';}).join('')+'</select>';
  h += ' <input id="srIn" placeholder="入住日" value="7/17"> → <input id="srOut" placeholder="离店日" value="7/20">';
  h += ' <button class="qf-submit" onclick="_submitMyStay()">✓ 登记</button></div>';
  h += '</div>';

  // ═══ 房间卡片 ═══
  h += '<div class="mgmt-card-grid">';
  dormRooms.forEach(function(r) {
    var occupied = r.sub && r.sub !== '空房';
    var isMine = myRoom === r.id;
    h += '<div class="mgmt-card'+(isMine?' selected':'')+(occupied&&!isMine?' vacant':'')+'" onclick="'+(!myRoom&&!occupied?'_toggleForm(\'stay\')':'')+'">';
    h += '<span class="mc-icon">🛏️</span>';
    h += '<div class="mc-name">'+r.name+(isMine?' ← 我':'')+'</div>';
    if (occupied) {
      h += '<div class="mc-occupant">👤 '+(r.sub||'')+'</div>';
    } else {
      h += '<div class="mc-vacant-label">'+(myRoom?'空房':'空房 · 点此入住')+'</div>';
    }
    h += '</div>';
  });
  h += '</div>';

  // ═══ 历史 ═══
  h += '<div class="mgmt-history"><div class="mas-title" style="margin-bottom:4px">📜 入住记录</div>';
  MGMT_DATA.stay.history.forEach(function(hi) {
    h += '<div class="mh-item">'+hi.date+' · '+hi.person+' · '+hi.room+'室 · '+hi.detail+'</div>';
  });
  h += '</div>';

  return h;
}

function _submitMyStay() {
  var roomId = ($('srRoom')||{}).value;
  var checkIn = ($('srIn')||{}).value||'7/17';
  var checkOut = ($('srOut')||{}).value||'7/20';
  if (!roomId) return;
  MGMT_DATA.stay.myRoom = roomId;
  MGMT_DATA.stay.myCheckIn = checkIn;
  MGMT_DATA.stay.myCheckOut = checkOut;
  var roomNum = roomId.replace('dorm','');
  MGMT_DATA.stay.history.unshift({
    date:'7/17', person:_me(), room:roomNum,
    detail:'入住 '+checkIn+'→'+checkOut
  });
  _mgmtFormType = '';
  if (window.Game&&Game.toast) Game.toast('已登记入住 '+roomNum+'室');
  renderMgmtPanel('stay');
}

function _checkoutStay() {
  if (window.Game && Game.confirm) {
    Game.confirm('退房确认', '请确认：\n\n✅ 个人物品已全部带走\n✅ 垃圾已清理完毕\n✅ 房间恢复入住前状态\n\n确认退房？', function() {
      _doCheckout();
    });
  } else {
    if (confirm('退房确认：\n\n请确认个人物品已带走、垃圾已清理。\n\n确认退房？')) _doCheckout();
  }
}

function _doCheckout() {
  var roomNum = (MGMT_DATA.stay.myRoom||'').replace('dorm','');
  MGMT_DATA.stay.history.unshift({
    date:'7/17', person:_me(), room:roomNum, detail:'退房 ✓'
  });
  MGMT_DATA.stay.myRoom = null;
  MGMT_DATA.stay.myCheckIn = null;
  MGMT_DATA.stay.myCheckOut = null;
  if (window.Game&&Game.toast) Game.toast('已退房 '+roomNum+'室');
  renderMgmtPanel('stay');
}

/* ══════════════════════════════════════
   🌿 田地管理（我的视角）
   ══════════════════════════════════════ */
function renderFieldPanel() {
  var fieldBld = getBuildings().find(function(b) { return b.id==='field'; });
  var plots = (fieldBld&&fieldBld.plots)||[];
  var actions = ['摘菜','浇水','播种','施肥','除草','收割','查看','其他'];
  var me = _me();
  var h = '';

  // ═══ 提醒 ═══
  h += '<div class="mgmt-reminders">';
  h += '<div class="mr-item warn">🌽 B区玉米 7/23 成熟（剩8天）· 本周收割</div>';
  h += '<div class="mr-item info">🌧 明后天有雨 · 建议提前收割B区</div>';
  h += '<div class="mr-item ok">🌱 D区E区空闲 · 可种秋季蔬菜</div>';
  h += '</div>';

  // ═══ 操作按钮 ═══
  h += '<div class="mgmt-actions">';
  h += '<button class="ma-btn primary" onclick="_toggleForm(\'field\')">📝 我做了农活</button>';
  h += '</div>';

  // ── 快速表单 ──
  h += '<div class="mgmt-quick-form' + (_mgmtFormType==='field'?' open':'') + '">';
  h += '<div class="qf-title">✏️ 我（'+me+'）在田地做了什么</div>';
  h += '<div class="qf-row">在 <select id="fpPlot">'+plots.map(function(p){return '<option value="'+p.id+'">'+p.icon+' '+p.name+'</option>';}).join('')+'</select>';
  h += ' <select id="fpAction">'+actions.map(function(a){return '<option>'+a+'</option>';}).join('')+'</select>';
  h += ' <input id="fpNote" placeholder="备注（可选）">';
  h += ' <button class="qf-submit" onclick="_submitFieldLog()">✓ 记录</button></div>';
  h += '</div>';

  // ═══ 田地卡片 ═══
  h += '<div class="mgmt-card-grid">';
  plots.forEach(function(p) {
    var isP = p.crop && p.crop!=='—';
    var pct = isP ? Math.round((1-p.remain/p.days)*100) : 0;
    h += '<div class="mgmt-card'+(p.note.indexOf('⚠')>=0?' selected':'')+'">';
    h += '<span class="mc-icon">'+p.icon+'</span>';
    h += '<div class="mc-name">'+p.name+'</div>';
    if (isP) {
      h += '<div class="mc-sub">'+p.crop+' · '+p.planted+'→'+p.harvest+'</div>';
      h += '<div style="width:100%;height:5px;background:var(--g-card-border);border-radius:3px;margin-top:4px"><div style="width:'+pct+'%;height:100%;background:'+(pct>80?'var(--g-warn)':'var(--g-green)')+';border-radius:3px"></div></div>';
      h += '<div class="mc-sub" style="margin-top:2px">剩'+p.remain+'天 · '+(pct>80?'⚠即将成熟':'正常生长')+'</div>';
    } else {
      h += '<div class="mc-sub">'+(p.note||'空闲')+'</div>';
    }
    h += '</div>';
  });
  h += '</div>';

  // ═══ 历史 ═══
  h += '<div class="mgmt-history"><div class="mas-title" style="margin-bottom:4px">📜 农事记录</div>';
  MGMT_DATA.field.history.forEach(function(hi) {
    h += '<div class="mh-item">'+hi.date+' · '+hi.person+' · '+hi.plotName+' · '+hi.action+(hi.note?' · '+hi.note:'')+'</div>';
  });
  h += '</div>';

  return h;
}

function _submitFieldLog() {
  var plotId = ($('fpPlot')||{}).value;
  var action = ($('fpAction')||{}).value;
  var note = ($('fpNote')||{}).value||'';
  var plots = (getBuildings().find(function(b){return b.id==='field';})||{}).plots||[];
  var plot = plots.find(function(p){return p.id===plotId;});
  MGMT_DATA.field.history.unshift({ date:'7/17', person:_me(), plotName:plot?plot.name:plotId, action:action, note:note });
  _mgmtFormType = '';
  if (window.Game&&Game.toast) Game.toast(action+' @'+(plot?plot.name:''));
  renderMgmtPanel('field');
}

/* ══════════════════════════════════════
   🍳 厨房管理（我的视角）
   ══════════════════════════════════════ */
function renderKitchenPanel() {
  var kitchenRoom = null;
  var office = getBuildings().find(function(b) { return b.id==='office'; });
  if (office&&office.floors) {
    Object.keys(office.floors).forEach(function(fk) {
      (office.floors[fk]||[]).forEach(function(r) { if (r.id==='kitchen') kitchenRoom=r; });
    });
  }
  var items = (kitchenRoom&&kitchenRoom.items)||[];
  var actions = ['放入物品','取出/消耗','打扫','做饭','其他'];
  var me = _me();
  var h = '';

  // ═══ 提醒 ═══
  h += '<div class="mgmt-reminders">';
  h += '<div class="mr-item warn">📦 白菜 ⚠ 3天后过期 · 建议尽快吃掉</div>';
  h += '<div class="mr-item info">🧻 卫生纸剩3卷 · 可考虑补货</div>';
  h += '</div>';

  // ═══ 操作按钮 ═══
  h += '<div class="mgmt-actions">';
  h += '<button class="ma-btn primary" onclick="_toggleForm(\'kitchen\')">📝 我在厨房做了什么</button>';
  h += '</div>';

  // ── 快速表单 ──
  h += '<div class="mgmt-quick-form' + (_mgmtFormType==='kitchen'?' open':'') + '">';
  h += '<div class="qf-title">✏️ 我（'+me+'）在厨房的操作</div>';
  h += '<div class="qf-row"><select id="kpAction">'+actions.map(function(a){return '<option>'+a+'</option>';}).join('')+'</select>';
  h += ' <input id="kpItem" placeholder="物品名（必填）">';
  h += ' <input id="kpLoc" placeholder="位置" style="width:80px" value="冰箱上层">';
  h += ' <button class="qf-submit" onclick="_submitKitchenLog()">✓ 记录</button></div>';
  h += '</div>';

  // ═══ 物品卡片 ═══
  h += '<div class="mgmt-card-grid">';
  items.forEach(function(it) {
    var statusColor = it.status==='warn'?'var(--g-warn)':it.status==='expired'?'var(--g-red)':'var(--g-green)';
    var statusLabel = it.status==='warn'?'⚠注意':it.status==='expired'?'❌过期':'🟢新鲜';
    h += '<div class="mgmt-card">';
    h += '<span class="mc-icon">'+it.icon+'</span>';
    h += '<div class="mc-name">'+it.text+'</div>';
    h += '<div class="mc-sub">'+(it.sub||'')+'</div>';
    h += '<div class="mc-sub" style="color:'+statusColor+';font-weight:600">'+statusLabel+'</div>';
    h += '</div>';
  });
  if (items.length===0) h += '<div style="grid-column:1/-1;color:var(--g-text-dim);font-size:var(--g-font-size-xs);text-align:center;padding:16px">暂无物品记录</div>';
  h += '</div>';

  // ═══ 历史 ═══
  h += '<div class="mgmt-history"><div class="mas-title" style="margin-bottom:4px">📜 操作记录</div>';
  MGMT_DATA.kitchen.history.forEach(function(hi) {
    h += '<div class="mh-item">'+hi.date+' · '+hi.person+' · '+hi.action+' · '+hi.item+(hi.location?' @'+hi.location:'')+'</div>';
  });
  h += '</div>';

  return h;
}

function _submitKitchenLog() {
  var action = ($('kpAction')||{}).value;
  var item = ($('kpItem')||{}).value;
  if (!item) { if (window.Game&&Game.toast) Game.toast('请输入物品名'); return; }
  var location = ($('kpLoc')||{}).value||'';
  MGMT_DATA.kitchen.history.unshift({ date:'7/17', person:_me(), action:action, item:item, location:location });
  _mgmtFormType = '';
  if (window.Game&&Game.toast) Game.toast(action+' '+item);
  renderMgmtPanel('kitchen');
}

// ═══ B.3 Map 接口 ═══

// ═══ B.3 Map 接口 ═══
window.Map = {

  init: function(container, options) {
    // 清理之前的状态（独立运行时的自动绑定 或 上次 init）
    _unbindEvents();
    if (_mapContainer && _mapContainer !== container) {
      _mapContainer.innerHTML = '';
    }

    _mapContainer = container;

    // 确保 DOM 结构存在：把现有 #app 移入 container
    if (!_mapContainer.querySelector('#app')) {
      var existingApp = document.getElementById('app');
      if (existingApp && existingApp.parentNode !== _mapContainer) {
        _mapContainer.appendChild(existingApp);
      }
    }

    // 处理初始导航
    var opts = options || {};
    if (opts.buildingId) {
      var blds = getBuildings();
      var idx = blds.findIndex(function(b) { return b.id === opts.buildingId; });
      if (idx >= 0) { currentIdx = idx; }
      if (opts.roomId) { selectedRoomId = opts.roomId; }
    }

    _bindEvents();
    render();
  },

  navigateTo: function(buildingId, roomId) {
    var blds = getBuildings();
    var idx = blds.findIndex(function(b) { return b.id === buildingId; });
    if (idx >= 0) {
      currentIdx = idx;
      selectedRoomId = roomId || null;
      currentFloor = 0;
      overviewOpen = false;
      render();
    }
  },

  destroy: function() {
    _unbindEvents();
    if (_mapContainer) {
      _mapContainer.innerHTML = '';
    }
    _mapContainer = null;
    selectedRoomId = null;
    currentIdx = 0;
    currentFloor = 0;
    overviewOpen = false;
  }
};

// ═══ 自动初始化 ═══
// F32: 防御重复定义——如果主框架已定义 _initMap，则跳过
if (typeof _initMap !== 'undefined') { console.warn('[map-app] _initMap already defined, skipping'); } else {
function _initMap(){
  try{if(!_mapContainer){currentIdx=4;currentFloor=0;selectedRoomId=null;overviewOpen=false;_bindEvents();render()}}catch(e){console.error('[Map] init failed:',e)}
}
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_initMap)}else{_initMap()}
