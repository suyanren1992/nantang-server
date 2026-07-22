// ═══ Bridge: postMessage to parent ═══
// v2 — carousel sync fix
if(typeof _post==='undefined'){window._post=function(data){if(window.parent!==window)window.parent.postMessage(data,'*')}}
// ═══ DOM helper ═══
var _mapContainer=null;
// _q: 查地图内部元素（_mapContainer 内），未设容器时查 document
function _q(id) {
  if (_mapContainer) return _mapContainer.querySelector('#' + CSS.escape(id));
  return document.getElementById(id);
}
// _d: 始终查主文档（地图外部元素：管理面板、表单等）
function _d(id) { return document.getElementById(id); }

// ═══ 数据层 ═══
var HARDCODED_BUILDINGS = [
  { id:'toilet_b',name:'公共厕所',icon:'🚻',meta:'1F',photo:'https://placehold.co/600x360/d8c8b8/5a3a3a?text=厕所',photoBg:'linear-gradient(160deg,#e8e0d0,#d8d0b8)',status:'green',summary:{status:'📍办公楼1F'},floors:{},plots:[]},
  { id:'parking',name:'B门·停车',icon:'🅿️',meta:'🟢正常',photo:'https://placehold.co/600x360/c8c0a8/5a4a3a?text=停车场',photoBg:'linear-gradient(160deg,#e0dcc8,#d0c8b0)',status:'green',summary:{},floors:{},plots:[]},
  { id:'gate_a',name:'A门',icon:'🚪',meta:'入口·🟢正常',photo:'https://placehold.co/600x360/d8d0c0/5a4a3a?text=A门',photoBg:'linear-gradient(160deg,#e8e0d0,#d8d0b8)',status:'green',summary:{status:'📍主入口·🟢正常',note:'📋无特殊事项'},floors:{},plots:[]},
  { id:'office',name:'社区大楼',icon:'🏢',meta:'3层·15间·🟢整洁',photo:'https://placehold.co/600x360/e8d8c0/8a7a60?text=办公楼',photoBg:'linear-gradient(160deg,#f0e8d8,#e0d4b8)',status:'green',summary:{cleanliness:'🟢',items:'',onsite:'',cleaning:'',alert:''},floors:{'1F':[{id:'community_hall',name:'社区大厅',icon:'🏛️',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'community_market',name:'社区超市',icon:'🛒',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'storage',name:'小仓库',icon:'📦',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'kitchen',name:'厨房',icon:'🍳',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'public_office',name:'公共办公室',icon:'💼',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'toilet_r',name:'卫生间',icon:'🚻',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'backyard_corridor',name:'通往后院的走廊',icon:'🚶',status:'green',sub:'',items:[],people:[],cleaning:[]}],'2F':[{id:'studio',name:'画室',icon:'🎨',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'washroom',name:'洗浴室',icon:'🚿',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'farm_equipment',name:'农机室',icon:'🔧',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'biao_office',name:'标哥办公室',icon:'👔',status:'green',sub:'',items:[],people:[],cleaning:[]}],'3F':[{id:'rooftop',name:'天台',icon:'🌤️',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'laundry_room',name:'晾衣间',icon:'👕',status:'green',sub:'',items:[],people:[],cleaning:[]}]}},
  { id:'info',name:'南塘全貌',icon:'📍',meta:'10个空间',photo:'https://placehold.co/600x360/a0b8d0/4a6080?text=南塘全貌',photoBg:'linear-gradient(160deg,#d0dce8,#b0c8d8)',status:'green',summary:{isInfo:true},floors:{},plots:[]},
  { id:'study',name:'大地书房',icon:'🏯',meta:'3层·14间·🟢整洁',photo:'https://placehold.co/600x360/c8b898/6a5a40?text=大地书房',photoBg:'linear-gradient(160deg,#d8d0c0,#c8b898)',status:'green',summary:{cleanliness:'🟢4 🟡1',items:'📚200册',stay:'🛏️住宿'},floors:{'1F':[{id:'bar',name:'吧台',icon:'🍸',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'main_hall',name:'正厅',icon:'🏛️',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'toilet_study',name:'卫生间',icon:'🚻',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'wash_study',name:'洗漱台',icon:'🪥',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'corridor_study',name:'走廊楼梯',icon:'🚶',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'mahjong',name:'麻将室',icon:'🀄',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'kitchen_study',name:'大地厨房',icon:'🍳',status:'green',sub:'',items:[],people:[],cleaning:[]}],'2F':[{id:'dorm101',name:'A室·三人大通铺',icon:'🛏',status:'green',sub:'20NT/床·无空调',items:[],people:[],cleaning:[]},{id:'dorm102',name:'B室·四人大通铺',icon:'🛏',status:'green',sub:'30NT/床·有空调',items:[],people:[],cleaning:[]},{id:'dorm103',name:'C室·上下床+大床',icon:'🛏',status:'green',sub:'30NT/床·有空调',items:[],people:[],cleaning:[]},{id:'dorm104',name:'D室·单间大床房',icon:'🛏',status:'green',sub:'60NT/床·有空调',items:[],people:[],cleaning:[]},{id:'dorm105',name:'E室·两个上下床',icon:'🛏',status:'green',sub:'30NT/床·有空调',items:[],people:[],cleaning:[]},{id:'dorm106',name:'F室·四人间上下床',icon:'🛏',status:'green',sub:'30NT/床·有空调',items:[],people:[],cleaning:[]}],'阁楼':[{id:'attic',name:'阁楼储物',icon:'📦',status:'green',sub:'',items:[],people:[],cleaning:[]}]}},
  { id:'field',name:'田地A-E',icon:'🌿',meta:'5个种植区',photo:'https://placehold.co/600x360/a0c870/4a6830?text=田地',photoBg:'linear-gradient(160deg,#c0d8a0,#a8c880)',status:'green',summary:{totalPlots:5,planted:0},floors:{},plots:[{id:'fa',name:'A区',icon:'🥬',crops:[]},{id:'fb',name:'B区',icon:'🌽',crops:[]},{id:'fc',name:'C区',icon:'🍠',crops:[]},{id:'fd',name:'D区',icon:'🌳',crops:[]},{id:'fe',name:'E区',icon:'🍂',crops:[]}]},
  { id:'stage',name:'戏台·花坛',icon:'🎭',meta:'1区·🟢整洁',photo:'https://placehold.co/600x360/e8d0b0/6a4a3a?text=戏台',photoBg:'linear-gradient(160deg,#f0e0d0,#e0c8b0)',status:'green',summary:{status:'📍1区'},floors:{},plots:[]},
  { id:'plaza',name:'硕区广场',icon:'🏛️',meta:'开放·🟢整洁',photo:'https://placehold.co/600x360/d8c8a8/6a5a40?text=广场',photoBg:'linear-gradient(160deg,#e8dcc8,#d8c8a8)',status:'green',summary:{status:'📍开放空间·🟢整洁',onsite:'👤无人',cleaning:'📋每周六清扫'},floors:{},plots:[]},
  { id:'jingzi_pavilion',name:'敬字亭',icon:'🛕',meta:'1区·🟢整洁',photo:'https://placehold.co/600x360/d8c0a0/6a4a30?text=敬字亭',photoBg:'linear-gradient(160deg,#e8d8c8,#d8c0a0)',status:'green',summary:{status:'📍1区'},floors:{},plots:[]},
  { id:'lawn',name:'大地草坪',icon:'🌿',meta:'开放·🟢整洁',photo:'https://placehold.co/600x360/a0c870/4a6830?text=大地草坪',photoBg:'linear-gradient(160deg,#c0d8a0,#a8c880)',status:'green',summary:{status:'📍开放空间·🟢整洁'},floors:{},plots:[]}
];

function getBuildings() {
  var data = (window.Game && window.Game.getData) ? window.Game.getData() : null;
  if (data && data.map_locations && data.map_locations.buildings && data.map_locations.buildings.length > 0) {
    return data.map_locations.buildings;
  }
  // ponytail: 只读返回 fallback，写入由 _seedIfEmpty 统一初始化
  return HARDCODED_BUILDINGS;
}
function getPlots() {
  var data = (window.Game && window.Game.getData) ? window.Game.getData() : null;
  if (data && data.map_locations && data.map_locations.plots && data.map_locations.plots.length > 0) {
    return data.map_locations.plots;
  }
  var b = getBuildings().find(function(x) { return x.id === 'field'; });
  return (b && b.plots) ? b.plots : [];
}

// Phase 2: 辅助读取 map_locations
function _ml() { var d=(window.Game&&Game.getData)?Game.getData():null; return (d&&d.map_locations)?d.map_locations:{}; }
function _mlState() { return _ml().state||{}; }
function _defaultConfig() { return {
  cleaning_pricing: { dirty:20, warning:15, clean:5 },
  farming_pricing: { harvest:15, plant:5, water:5, weed:5, fertilize:5, view:2 },
  kitchen_pricing: { stock_in:2, stock_out:1, detail:5 },
  cooking_pricing: { chef:15, helper:5, wash:5 },
  verifier_reward_pct: 0.25,  // M1: 20%→25%，小社区更需激励校核供给
  accommodation_pricing: {
    dorm101:{ perBed:20, ac:false }, dorm102:{ perBed:30, ac:true },
    dorm103:{ perBed:30, ac:true }, dorm104:{ perRoom:60, ac:true },
    dorm105:{ perBed:30, ac:true }, dorm106:{ perBed:35, ac:true }
  },
  // E3.4: System B 已删除——新手引导统一走 data.js NEWBIE_QUESTS
  dirtiness_rates: { bathroom:15, kitchen:10, hallway:8, studio:8, bedroom:5, laundry:5, storage:3, outdoor:2, field:0 },
  dirtiness_thresholds: { green:30, yellow:60, red:80 },
  item_expiry_days: 5,
  nt_rewards: { stock_in:2, stock_out:1, cleaning:10 },
  // 劳动定价 — 公约统一管理，卡片室/上报/校核都从此读取
  labor_pricing: {
    sweep_mop:10, wipe_surface:8, take_trash:5, organize_items:8, clean_window:10,
    clean_toilet:15, clean_kitchen:15, clean_public:12,
    water:5, fertilize:8, weed:10, sow:8, harvest:15, turn_soil:12,
    trellis:10, pest_control:8, mulch:8, prune:8,
    chef:20, sous_chef:12, wash_dishes:10, prep_food:8, clean_stove:12, grocery:5, serve_meal:5,
    repair:15, move_goods:12, organize_warehouse:10, waste_sort:8, compost:8, change_light:8,
    reception:8, tour_guide:10, event_setup:12, event_cleanup:10, animal_care:8, notice_board:5,
    painting:15, calligraphy:10, craft:12, photo_video:8, writing:8,
    mow_lawn:12, weed_pick:8
  },
  camp_creation_fee: 50,
  maintenance_xp: 30,
  maintenance_badge: '🧹整洁守护者'
};}
function _deepMerge(def, cfg) { var r = {}; Object.keys(def).forEach(function(k) { if (cfg[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) { r[k] = _deepMerge(def[k], cfg[k]); } else { r[k] = (k in cfg) ? cfg[k] : def[k]; } }); Object.keys(cfg).forEach(function(k) { if (!(k in r)) r[k] = cfg[k]; }); return r; }
function _mlConfig() { return _deepMerge(_defaultConfig(), _ml().config||{}); }
function _todayStr() { var ct = (typeof Clock !== 'undefined' && Clock.today) ? Clock.today() : null; return ct ? ct.slice(5,10) : new Date().toISOString().slice(5,10); }
function _roomItems(roomId) { return (_mlState().room_items||[]).filter(function(i){return i.room===roomId;}); }
// 种子数据灰显：_seed 标记的示例数据用虚线灰显
function _seedStyle(o) { return (o && o._seed) ? 'opacity:.5;outline:1px dashed #999;' : ''; }
// 统一数据：住宿房间从 AppData accommodations 读真实入住
function _getRoomLiveData(roomId) { var accs=(window.AppData&&AppData._data.map_locations&&AppData._data.map_locations.accommodations)||{}; var a=accs[roomId]; if(!a)return null; if(!a.tenants)a.tenants=[]; return {tenants:a.tenants,price:a.pricePerBed||30,beds:a.beds||1,label:a.label||'',ac:a.ac||''}; }

// ═══ 状态 ═══
var currentIdx = 4; // 默认选中「南塘全貌」

var currentFloor = 0, selectedRoomId = null, overviewOpen = false;

function curBuilding() { return getBuildings()[currentIdx]; }
function curRooms() {
  var b = curBuilding();
  if (b.id === 'field') return getPlots();
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

  var cp = _q('crumbPath'); if (cp) cp.innerHTML = '🗺️ <span style="cursor:pointer;color:var(--g-accent);text-decoration:underline" onclick="renderOverview()">实景地图</span> › <span style="cursor:pointer" onclick="renderOverview()">' + b.name + '</span>' + (selectedRoomId ? ' › <span>' + (rooms.find(function(r){return r.id===selectedRoomId})||{}).name + '</span>' : '');

  _q('photoImg').style.height = ''; // 重置全貌页压缩的高度
  _q('photoImg').style.background = b.photoBg;
  _q('photoImg').innerHTML = (b.photo ? '<img src="'+b.photo+'" class="ph-image" onerror="this.style.display=\'none\'">' : '') +
    '<div class="ph-fallback"><div class="ph-emoji">'+b.icon+'</div></div>' +
    '<button class="ph-arrow left" onclick="if(currentIdx>0)goTo(currentIdx-1)">‹</button>' +
    '<button class="ph-arrow right" onclick="if(currentIdx<getBuildings().length-1)goTo(currentIdx+1)">›</button>';

  _q('bldName').textContent = b.name;
  _q('bldMeta').textContent = b.meta;

  var ft = '';
  fKeys.forEach(function(f,i){ ft += '<button class="floor-tab'+(i===currentFloor?' sel':'')+'" onclick="setFloor('+i+')">'+f+'</button>'; });
  _q('floorTabs').innerHTML = ft;
  _q('floorTabs').style.display = ft ? 'flex' : 'none';

  if (!selectedRoomId && b.summary) {
    _q('bldOverview').style.display = 'block';
    _q('bldOverview').innerHTML = '<div class="overview-toggle" onclick="toggleOverview()">'+(isField?'🌿种植概况':'📊建筑总览')+'<span class="ov-summary">'+(overviewOpen?'':buildSummaryLine(b))+'</span><span class="ov-arrow">'+(overviewOpen?'▾':'▸')+'</span></div><div class="overview-card'+(overviewOpen?'':' collapsed')+'">'+buildOverviewHTML(b)+'</div>';
  } else { _q('bldOverview').style.display = 'none'; }

  var rh = '';
  if (isField) { rh = renderFieldPlots(rooms); }
  else if (rooms.length > 0) { rooms.forEach(function(r){ var sel = selectedRoomId===r.id?' selected':''; rh += '<div class="room-card'+sel+'" onclick="selectRoom(\''+r.id+'\')"><div class="rc-dot" style="background:'+(r.status==='green'?'#5d8c52':r.status==='yellow'?'#c8892e':'#b84c38')+'"></div><div class="rc-icon">'+r.icon+'</div><div class="rc-name">'+r.name+'</div>'+(r.sub?'<div class="rc-sub">'+r.sub+'</div>':'')+'</div>'; }); }
  else { rh = '<div class="room-empty">📍开放空间</div>'; }
  _q('roomsGrid').style.display = '';
  _q('roomsGrid').innerHTML = rh;

  if (selectedRoomId) {
    var room = rooms.find(function(r){return r.id===selectedRoomId;});
    if (room) { _q('scrollArea').style.display = 'none'; _q('itemsOverlay').classList.add('show'); _q('ioTitle').textContent = room.icon+' '+room.name; _q('ioBody').innerHTML = isField ? buildFieldDetail(room) : buildRoomDetail(room); }
  } else { _q('scrollArea').style.display = ''; _q('itemsOverlay').classList.remove('show'); }
  // 章3: FAB — 根据当前建筑切换
  _updateFAB(b);
}
function _updateFAB(b) {
  var fab = document.getElementById('fabMain');
  if (!fab) { fab = document.createElement('button'); fab.id = 'fabMain'; fab.style.cssText = 'position:fixed;bottom:100px;right:16px;width:56px;height:56px;border-radius:50%;border:none;background:var(--green-primary);color:#fff;font-size:1.4rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:90;display:none;align-items:center;justify-content:center'; var container = document.getElementById('app') || document.body; container.appendChild(fab); }
  if (b.id === 'info') { fab.style.display = 'none'; return; }
  var icon = '🧹', action = function(){ _openCleanQuick(); };
  if (b.id === 'field') { icon = '🌱'; action = function(){ _openFarmQuick(); }; }
  else if (b.id === 'office' || b.id === 'toilet_b') { icon = '🧹'; }
  else if (b.plots && b.plots.length > 0) { icon = '🌱'; action = function(){ _openFarmQuick(); }; }
  fab.textContent = icon; fab.onclick = action; fab.style.display = 'flex';
}

function renderInfoPage() {
  var cp = _q('crumbPath'); if (cp) cp.innerHTML = '🗺️ 实景地图 › <span>南塘合作社大院</span>';

  // 全貌页照片 — 压缩高度但保留视觉
  _q('photoImg').style.background = 'linear-gradient(160deg,#d0dce8,#b0c8d8)';
  _q('photoImg').style.height = '100px';
  _q('photoImg').innerHTML = '<div class="ph-fallback"><div class="ph-emoji" style="font-size:2.5rem">📍</div></div>' +
    '<button class="ph-arrow left" onclick="if(currentIdx>0)goTo(currentIdx-1)">‹</button>' +
    '<button class="ph-arrow right" onclick="if(currentIdx<getBuildings().length-1)goTo(currentIdx+1)">›</button>';
  _q('bldName').textContent = '南塘合作社大院';
  _q('bldMeta').innerHTML = _todayStr() + ' · ' + getBuildings().length + '个空间 · <span style="cursor:pointer;border-bottom:1px dotted #999" onclick="_openCovenantOverlay()">📜 社区公约</span>';
  _q('floorTabs').style.display = 'none';
  _q('bldOverview').style.display = 'none';

  var sections = [
    function(){ return _s('announceTicker', _renderAnnounceTicker()); },
    function(){ return _s('quickEntryRow', _renderQuickEntryCards()); },
    function(){ return _s('cardVerifyRow', _renderCardVerifyRow()); },
    function(){ return _s('mgmtGrid', _renderMgmtCards()); },
    function(){ return _s('cardRoomSection', _renderCardRoomSection()); },
    function(){ return _s('poolCard', _renderPoolCard()); }
  ];
  var h = sections.map(function(fn){ try { return fn(); } catch(e) { console.error(e); return '<div style="color:var(--g-red);padding:8px;font-size:.6rem">⚠ 板块加载失败</div>'; } }).join('');
  _q('roomsGrid').innerHTML = '<div class="info-wrapper">'+h+'</div>';
  _q('roomsGrid').style.display = 'block';
  _q('scrollArea').style.display = '';
  _q('itemsOverlay').classList.remove('show');
}
function _s(id, html) { return html ? '<div id="'+id+'">'+html+'</div>' : ''; }

// ── 子板块渲染 ──
function _renderAnnounceTicker() {
  var anns = (window.AppData && AppData._data.announcements) ? AppData._data.announcements.slice(0,8) : [];
  if (!anns.length) return '';
  return '<div class="announce-bar"><span style="margin-right:8px">📢</span><span class="announce-track">'+
    anns.map(function(a){ return a.text; }).join(' &nbsp;·&nbsp; ')+'</span></div>';
}

function _renderStatusPills() {
  var h = '';
  var cl = (window.AppData && AppData._data.cleaning) ? AppData._data.cleaning : null;
  var greenC = 0, yellowC = 0, redC = 0;
  if (cl && cl.spaces) {
    Object.keys(cl.spaces).forEach(function(sid) {
      var st = _getDirtinessStatus(cl.spaces[sid].dirtiness);
      if (st === 'green') greenC++;
      else if (st === 'yellow') yellowC++;
      else redC++;
    });
  }
  h += '<div class="info-stats">'+
    '<div class="is-item"><div class="is-num">🟢'+greenC+'</div><div class="is-lbl">整洁</div></div>'+
    '<div class="is-item warn"><div class="is-num" style="color:#c8892e">🟡'+yellowC+'</div><div class="is-lbl">注意</div></div>'+
    '<div class="is-item warn"><div class="is-num" style="color:#b84c38">🔴'+redC+'</div><div class="is-lbl">需处理</div></div>'+
  '</div>';
  var alerts = _getExpiryAlerts();
  if (alerts.length > 0) {
    h += '<div class="section-label">⚠️ 物品提醒</div>';
    alerts.forEach(function(a) {
      var color = a.level === 'expired' ? 'var(--g-red)' : a.level === 'soon' ? '#c8892e' : 'var(--g-accent)';
      h += '<div class="alert-row" style="color:'+color+';cursor:default">'+(a.level==='expired'?'🔴':a.level==='soon'?'🟡':'🔵')+' '+a.text+'</div>';
    });
  }
  return h;
}

function _renderNewbieCard() {
  var me = _me(); if (!me) return '';
  // E3.4: 新手引导统一走 data.js NEWBIE_QUESTS
  var steps = (typeof NEWBIE_QUESTS !== 'undefined') ? NEWBIE_QUESTS : [];
  if (!steps.length) return '';
  var quests = (window.AppData && AppData._data.newbieQuests && AppData._data.newbieQuests[me]) || {};
  // 初始化
  if (!Object.keys(quests).length && window.AppData) {
    steps.forEach(function(s){ quests[s.id] = { done: false, verifiedBy: null, verifiedAt: null }; });
    if (!AppData._data.newbieQuests) AppData._data.newbieQuests = {};
    AppData._data.newbieQuests[me] = quests;
    AppData._savePrivate();
  }
  var doneCount = steps.filter(function(s){ return quests[s.id] && quests[s.id].done; }).length;
  if (doneCount >= steps.length) return ''; // 全部完成，不显示
  var pct = Math.round(doneCount / steps.length * 100);
  var h = '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px 12px;margin:4px 0">'+
    '<div style="font-weight:700;font-size:.72rem;margin-bottom:4px">🌱 新手引导 ('+doneCount+'/'+steps.length+')</div>'+
    '<div style="height:6px;background:#f0f0f0;border-radius:3px;margin-bottom:8px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--green-primary);border-radius:3px"></div></div>';
  steps.forEach(function(s){
    var q = quests[s.id] || {};
    var done = q.done;
    h += '<div style="font-size:.62rem;padding:3px 0;color:'+(done?'#999':'')+'">'+(done?'✅':'☐')+' '+s.title+(s.nt?' +'+s.nt+'NT':'')+(s.xp?' +'+s.xp+'XP':'')+'</div>';
  });
  var bonusNt = steps.reduce(function(sum,s){ return sum + (s.nt||0); }, 0);
  h += '<div style="font-size:.58rem;color:#999;margin-top:4px">💡 全部完成奖励: +'+bonusNt+' NT</div></div>';
  return h;
}

function _renderMgmtCards() {
  var h = '<div class="info-cards">';
  // 打扫
  var nextClean = (MGMT_DATA.cleaning.nextDate||'');
  var cleanDays = nextClean ? Math.ceil((new Date(nextClean+'T00:00:00')-new Date())/86400000) : null;
  var cfgPricing = _mlConfig().cleaning_pricing || {};
  h += '<div class="ic-card" onclick="_openMgmtSheet(\'cleaning\')"><div class="ic-head">🧹 大扫除</div>'+
    '<div class="ic-body">'+(cleanDays!=null ? '<div class="ic-big">'+(cleanDays>0?cleanDays+' 天':nextClean.slice(5))+'</div><div>📅 '+nextClean.slice(5)+'</div>' : '<div class="ic-muted">未设定</div>')+
    '<div class="ic-muted">🧹脏 '+cfgPricing.dirty+'NT · 🟡注意 '+cfgPricing.warning+'NT · 🟢维护 '+cfgPricing.clean+'NT</div></div></div>';
  // 住宿
  var accs = _ml().accommodations || {};
  var accList = Object.values(accs);
  var totalBeds = 0, usedBeds = 0;
  var guests = [];
  accList.forEach(function(a){ totalBeds += (a.beds||0); if (a.tenants) { usedBeds += a.tenants.length; a.tenants.forEach(function(t){ guests.push(t.name+' '+a.label); }); } });
  var guestLines = guests.length ? guests.slice(0,3).map(function(g){ return '<div>🛏 '+g+'</div>'; }).join('') : '';
  h += '<div class="ic-card" onclick="_openMgmtSheet(\'stay\')"><div class="ic-head">🛏️ 住宿</div>'+
    '<div class="ic-body">'+(guestLines||'<div class="ic-muted">暂无入住</div>')+'<div class="ic-muted">'+usedBeds+'/'+totalBeds+'床已用</div></div></div>';
  // 田地
  var plots = getPlots();
  var activePlots = plots.filter(function(p){ return (p.crops&&p.crops.length>0) || (p.crop&&p.crop!=='—'); });
  var cropLines = activePlots.map(function(p){
    var crops = p.crops || [];
    if (!crops.length && p.crop && p.crop!=='—') crops = [{name:p.crop, remain:p.remain, status:p.status}];
    var info = crops.map(function(c){ return (c.icon||p.icon)+' '+c.name+(c.remain<=0?' 可收':' '+c.remain+'天'); }).join(' · ');
    return '<div'+(p.status==='warning'?' class="ic-warn"':'')+'>'+p.icon+' '+p.name+' '+info+'</div>';
  }).join('');
  h += '<div class="ic-card" onclick="_openMgmtSheet(\'field\')"><div class="ic-head">🌿 田地</div>'+
    '<div class="ic-body">'+(cropLines||'<div class="ic-muted">暂无种植信息</div>')+'</div></div>';
  // 厨房·冰箱——读两个厨房（社区大楼 office + 大地书房 study）
  var invOffice = (window.AppData && AppData._data.inventory && AppData._data.inventory.office) ? AppData._data.inventory.office : [];
  var invStudy = (window.AppData && AppData._data.inventory && AppData._data.inventory.study) ? AppData._data.inventory.study : [];
  var inv = invOffice.concat(invStudy);
  var freshItems = inv.filter(function(it){ return it.status === 'fresh'; });
  var kitchenLines = freshItems.length ? freshItems.slice(0,3).map(function(it){
    var d = it.expiryDays && it.putDate ? it.expiryDays - Math.floor((Date.now()-new Date(it.putDate+'T00:00:00'))/86400000) : null;
    var warn = d !== null && d <= 0 ? ' <span class="ic-warn">过期</span>' : d !== null && d <= 2 ? ' <span class="ic-warn">'+d+'天</span>' : '';
    return '<div>📦 '+it.name+' · '+it.putBy+warn+'</div>';
  }).join('') : '';
  h += '<div class="ic-card" onclick="_openMgmtSheet(\'kitchen\')"><div class="ic-head">🍳 厨房·冰箱</div>'+
    '<div class="ic-body">'+(kitchenLines||'<div class="ic-muted">暂无物品，点此录入</div>')+'</div></div>';
  h += '</div>';
  return h;
}

function _renderQuickEntryCards() {
  return '<div style="display:flex;gap:6px;padding:4px 0">'+
    '<div class="quick-card" onclick="_openKitchenQuick()" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px;text-align:center;cursor:pointer"><div style="font-size:1.4rem">📦</div><div style="font-size:.65rem;font-weight:600">放取物品</div><div style="font-size:.55rem;color:#999">冰箱·仓库</div></div>'+
    '<div class="quick-card" onclick="if(typeof openSelfReport===\'function\')openSelfReport({cat:\'cleaning\'})" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px;text-align:center;cursor:pointer"><div style="font-size:1.4rem">🧹</div><div style="font-size:.65rem;font-weight:600">打扫卫生</div><div style="font-size:.55rem;color:#999">日常清洁</div></div>'+
    '<div class="quick-card" onclick="if(typeof openSelfReport===\'function\')openSelfReport({cat:\'farming\'})" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px;text-align:center;cursor:pointer"><div style="font-size:1.4rem">🌿</div><div style="font-size:.65rem;font-weight:600">田间管理</div><div style="font-size:.55rem;color:#999">种植·养护</div></div>'+
  '</div>';
}

function _renderCovenantCard() {
  return '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px 12px;margin:4px 0;cursor:pointer;display:flex;align-items:center;gap:8px" onclick="_openCovenantOverlay()"><span style="font-size:1.3rem">📜</span><div style="flex:1"><div style="font-weight:700;font-size:.72rem">南塘社区公约</div><div style="font-size:.58rem;color:#999">定价标准 · 行为准则 · 修改记录</div></div><span style="color:#999;font-size:.7rem">查看 ▸</span></div>';
}
function _openCovenantOverlay() {
  var cfg = _mlConfig();
  var pricing = [
    { section:'住宿定价', items:[
      'A室·三人大通铺(无空调): '+cfg.accommodation_pricing.dorm101.perBed+' NT/床',
      'B室·四人大通铺(有空调): '+cfg.accommodation_pricing.dorm102.perBed+' NT/床',
      'C室·上下床+大床(有空调): '+cfg.accommodation_pricing.dorm103.perBed+' NT/床',
      'D室·单间大床房(有空调): '+cfg.accommodation_pricing.dorm104.perRoom+' NT/床',
      'E室·两个上下床(有空调): '+cfg.accommodation_pricing.dorm105.perBed+' NT/床',
      'F室·四人间上下床(有空调): '+cfg.accommodation_pricing.dorm106.perBed+' NT/床']},
    { section:'劳动定价', items:[
      '大扫除(超时🔴): '+cfg.cleaning_pricing.dirty+' NT',
      '大扫除(注意🟡): '+cfg.cleaning_pricing.warning+' NT',
      '日常打扫(维护🟢): '+cfg.cleaning_pricing.clean+' NT',
      '农活(收割/除草/施肥): '+cfg.farming_pricing.harvest+' NT',
      '轻量农活(浇水/种植): '+cfg.farming_pricing.plant+' NT',
      '帮厨/主厨: '+cfg.cooking_pricing.chef+' NT',
      '洗碗/备菜: '+cfg.cooking_pricing.helper+' NT',
      '冰箱物品录入: '+cfg.kitchen_pricing.stock_in+' NT',
      '物品消耗标记: '+cfg.kitchen_pricing.stock_out+' NT',
      '详细录入(含拍照): '+cfg.kitchen_pricing.detail+' NT',
      '校核奖励: '+(cfg.verifier_reward_pct*100)+'% of 动作NT',
      '维护者奖励: +'+cfg.maintenance_xp+' XP + '+cfg.maintenance_badge,
      '营地创建费: '+cfg.camp_creation_fee+' NT']}
  ];
  var history = (window.AppData && AppData._data.configHistory) ? AppData._data.configHistory.slice(0,5) : [];
  var body = pricing.map(function(s){ return '<div style="margin-bottom:10px"><div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin-bottom:4px">'+s.section+'</div>'+s.items.map(function(i){ return '<div style="font-size:.62rem;padding:2px 0;border-bottom:1px dotted #f0f0f0">'+i+'</div>'; }).join('')+'</div>'; }).join('');
  if (history.length) {
    body += '<div style="margin-top:10px"><div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin-bottom:4px">📝 修改记录</div>';
    history.forEach(function(h){
      body += '<div style="font-size:.58rem;padding:3px 0;border-bottom:1px dotted #f0f0f0">'+h.appliedAt.slice(0,10)+' 校核人:'+(h.verifiedBy||[]).join('+')+' · '+(h.note||'')+'</div>';
    });
    body += '</div>';
  }
  body += '<div style="font-size:.55rem;color:#999;margin-top:8px">⚠ 所有定价由线下公约大会决定。管理员修改需24h公示+2人在线校核。</div>';
  _openQuickSheet('📜 南塘社区公约', body);
}

// ── 全貌页：卡片室+校核室并列 ──
function _renderCardVerifyRow() {
  var discs = (window.AppData && AppData._data.cardDiscoveries) || [];
  var sevenDaysAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  var recent = discs.filter(function(d){ return d.createdAt && d.createdAt.slice(0,10) >= sevenDaysAgo; });
  var discPending = recent.filter(function(d){ return d.status === 'pending'; }).length;
  var discConfirmed = recent.filter(function(d){ return d.status === 'confirmed' && d.doerConfirmedAt && d.doerConfirmedAt.slice(0,10) === new Date().toISOString().slice(0,10); }).length;

  var vfys = (window.AppData && AppData._data.pendingVerifications) || [];
  var vfyPending = vfys.filter(function(v){ return v.status === 'pending'; }).length;
  var today = new Date().toISOString().slice(0,10);
  var vfyToday = vfys.filter(function(v){ return v.status === 'verified' && v.verifiedAt && v.verifiedAt.slice(0,10) === today; }).length;

  var h = '<div style="display:flex;gap:10px;margin:4px 0">';
  // 卡片室
  h += '<div onclick="if(typeof openCardRoom===\'function\')openCardRoom()" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px 10px;cursor:pointer;text-align:center">';
  h += '<div style="font-size:1.2rem;margin-bottom:4px">🃏</div>';
  h += '<div style="font-weight:700;font-size:.7rem;color:#1d2e24">卡片室</div>';
  h += '<div style="font-size:.55rem;color:#5a6e5c;margin-top:2px">' + recent.length + '张牌 · ' + discPending + '待揭</div>';
  h += '</div>';
  // 校核室
  h += '<div onclick="if(typeof openVerifyRoom===\'function\')openVerifyRoom()" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px 10px;cursor:pointer;text-align:center">';
  h += '<div style="font-size:1.2rem;margin-bottom:4px">✓</div>';
  h += '<div style="font-weight:700;font-size:.7rem;color:#1d2e24">校核室</div>';
  h += '<div style="font-size:.55rem;color:#5a6e5c;margin-top:2px">' + vfyPending + '待确认 · 今日' + vfyToday + '</div>';
  h += '</div>';
  h += '</div>';
  return h;
}

// openVerifyRoom 在 ui-cardroom.js（独立 overlay）
function _renderRecentCardRoomCards_OLD() {
  var discs = (window.AppData && AppData._data.cardDiscoveries) ? AppData._data.cardDiscoveries : [];
  var sevenDaysAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  var recent = discs.filter(function(d){ return d.createdAt.slice(0,10) >= sevenDaysAgo; });
  var pendingCount = recent.filter(function(d){ return d.status === 'pending'; }).length;
  var todayResolved = recent.filter(function(d){ return d.status === 'confirmed' && d.doerConfirmedAt && d.doerConfirmedAt.slice(0,10) === new Date().toISOString().slice(0,10); }).length;
  var poolNT = 0; recent.forEach(function(d){ if(d.status==='confirmed') poolNT += d.ntDoer||0; });

  var h = '<div onclick="if(typeof openCardRoom===\'function\')openCardRoom()" style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px 14px;margin:4px 0;cursor:pointer">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center">';
  h += '<div style="flex:1">';
  h += '<div style="font-weight:700;font-size:.75rem;color:#1d2e24;margin-bottom:4px">🃏 卡片室</div>';
  h += '<div style="font-size:.6rem;color:#5a6e5c">近7天 '+recent.length+' 张牌 · '+pendingCount+' 张待揭 · 今日已揭 '+todayResolved+' 张</div>';
  h += '</div>';
  h += '<span style="font-size:1.5rem;flex-shrink:0">🃏</span>';
  h += '</div>';
  h += '</div>';
  return h;
}

function _renderCardRoomSection() {
  var sections = [
    { id:'pres', title:'👤 在地人员', badge: _onsiteCount(), content: _renderPresenceSection, empty: '还没有人在线，翻一下自己的牌吧~' },
    { id:'camp', title:'🏕️ 活跃营地', badge: _activeCampCount(), content: _renderCampSection, empty: '🏕️ 暂无活跃营地' },
    { id:'tl', title:'📜 时间线', badge: '', content: _renderTimelineSection, empty: '时间线还是空的——完成了校核后会出现在这里' }
  ];
  return '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:8px 12px;margin:4px 0">'+
    '<div style="font-weight:700;font-size:.72rem;margin-bottom:6px">👥 社区动态</div>'+
    sections.map(function(sec){ return _collapsibleSection(sec); }).join('')+'</div>';
}
function _collapsibleSection(sec) {
  return '<div class="cr-section" style="border-top:1px solid #f0f0f0;padding:6px 0">'+
    '<div class="cr-header" onclick="var b=this.nextElementSibling;var arrow=this.lastElementChild;var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'\';arrow.textContent=open?\'▸\':\'▾\'" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;min-height:30px">'+
      '<span style="font-weight:600;font-size:.7rem">'+sec.title+(sec.badge?' <span style="background:var(--green-primary);color:#fff;border-radius:8px;padding:1px 6px;font-size:.55rem">'+sec.badge+'</span>':'')+'</span>'+
      '<span style="color:#999;font-size:.6rem">▸</span></div>'+
    '<div class="cr-body" style="display:none">'+(_safeRender(sec.content) || '<div style="color:#999;font-size:.62rem;padding:4px 0">'+sec.empty+'</div>')+'</div></div>';
}
function _safeRender(fn) { try { return fn(); } catch(e) { return null; } }

// ── 卡片室数据辅助 ──
function _pendingVfyCount() { return (window.AppData && AppData._data.pendingVerifications) ? AppData._data.pendingVerifications.filter(function(v){return v.status==='pending';}).length : 0; }
function _activeDiscoveryCount() { return (window.AppData && AppData._data.discoveries) ? AppData._data.discoveries.filter(function(d){return d.status==='active';}).length : 0; }
function _onsiteCount() { var p = (window.AppData && AppData._data.presence) || {}; return Object.values(p).filter(function(x){return x.status==='onsite';}).length; }
function _activeCampCount() { return (window.AppData && AppData._data.camps) ? Object.values(AppData._data.camps).filter(function(c){return c.status==='active';}).length : 0; }

// ── 4.1 待校核区 ──
function _renderVerificationSection() {
  var vfys = (window.AppData && AppData._data.pendingVerifications) ? AppData._data.pendingVerifications.filter(function(v){return v.status==='pending';}).slice(0,5) : [];
  if (!vfys.length) return null;
  var me = _me();
  return vfys.map(function(v){
    var icons = { cleaning:'🧹', stock_in:'📦', stock_out:'🗑', field_harvest:'🌿', field_action:'🌿', quest:'📋', stay:'🛏️', other:'⭐' };
    var isMe = v.doer === me;
    return '<div class="vr-card" style="background:#fafaf5;border:1px solid #e0e0e0;border-radius:8px;padding:8px 10px;margin-bottom:4px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center">'+
        '<div style="flex:1"><span style="font-weight:600;font-size:.68rem">'+icons[v.type]+' '+v.doer+'</span> <span style="font-size:.6rem;color:#999">'+v.action+'</span></div>'+
        '<span style="font-size:.65rem;color:var(--green-primary);font-weight:600;margin-right:6px">+'+v.ntAmount+' NT</span>'+
      '</div>'+
      '<div style="display:flex;gap:4px;margin-top:4px">'+
        (isMe ? '<span style="font-size:.58rem;color:#999">等待他人校核…</span>' :
         '<button class="btn-sm pri" style="flex:1;font-size:.58rem;padding:3px 6px" onclick="event.stopPropagation();_doVerify(\''+v.id+'\')">✓ 校核 +'+v.verifierReward+'NT</button>'+
         '<button class="btn-sm sec" style="font-size:.58rem;padding:3px 6px" onclick="event.stopPropagation();var r=prompt(\'退回原因：\');if(r)_doReject(\''+v.id+'\',r)">✕ 退回</button>')+
      '</div></div>';
  }).join('');
}

// ── 4.2 被发现区 ──
function _renderDiscoverySection() {
  var cutoff = Date.now() - 24*3600*1000;
  var discs = (window.AppData && AppData._data.discoveries) ? AppData._data.discoveries.filter(function(d){return d.status==='active' && new Date(d.verifiedAt).getTime() > cutoff;}).slice(0,10) : [];
  if (!discs.length) return null;
  return discs.map(function(d){
    var icons = { cleaning:'🧹', stock_in:'📦', stock_out:'🗑', field_harvest:'🌿', field_action:'🌿', quest:'📋', stay:'🛏️', other:'⭐' };
    var time = d.verifiedAt ? d.verifiedAt.slice(11,16) : '';
    return '<div class="disc-card" style="padding:6px 0;border-bottom:1px dotted #f0f0f0;font-size:.65rem;cursor:pointer" onclick="alert(\''+d.doer+' '+d.action+'\\n校核: '+d.verifier+'\\nNT: +'+d.ntAmount+'\\n时间: '+d.verifiedAt+'\')">'+
      '<span>'+icons[d.type]+'</span> <b>'+d.doer+'</b> '+d.action+' <span style="color:#999">✅ '+d.verifier+'校核 +'+d.ntAmount+'NT</span> <span style="color:#999;float:right">'+time+'</span></div>';
  }).join('');
}

// ── 4.3 翻牌区 ──
function _renderPresenceSection() {
  var users = (typeof getUsers === 'function') ? getUsers() : {};
  var presence = (window.AppData && AppData._data.presence) || {};
  var me = _me();
  var all = Object.keys(users);
  if (!all.length) return null;
  return '<div style="display:flex;gap:6px;overflow-x:auto;padding:4px 0">'+all.map(function(uname){
    var p = presence[uname] || {};
    var st = p.status || 'cloud';
    var icon = st==='onsite'?'🟢':st==='out'?'🔵':'☁️';
    var label = st==='onsite'?'在地':st==='out'?'外出':'云在线';
    var loc = p.location||'';
    var safeName = uname.replace(/'/g,"\\'");
    return '<div class="presence-card'+(uname===me?' is-me':'')+'" style="min-width:72px;text-align:center;cursor:pointer;padding:6px 8px;background:#fff;border:1px solid '+(uname===me?'var(--green-primary)':'#e0e0e0')+';border-radius:10px" onclick="'+(uname===me?'_flipMyPresence()':'_showFlipOther(\''+safeName+'\')')+'">'+
      '<div style="font-size:1.1rem">'+icon+'</div><div style="font-weight:700;font-size:.65rem">'+uname+'</div><div style="font-size:.55rem;color:#999">'+label+(loc?' · '+loc:'')+'</div></div>';
  }).join('')+'</div>';
}

// ── 4.4 营地区 ──
function _renderCampSection() {
  var camps = (window.AppData && AppData._data.camps) ? Object.values(AppData._data.camps).filter(function(c){return c.status==='active';}) : [];
  if (!camps.length) return null;
  return camps.map(function(c){
    return '<div class="camp-card" style="padding:8px 0;border-bottom:1px dotted #f0f0f0;cursor:pointer;'+_seedStyle(c)+'" onclick="if(window.Game&&Game.openCamp)Game.openCamp(\''+c.id+'\')">'+
      '<span style="font-weight:700;font-size:.68rem">'+c.emoji+' '+c.name+'</span> <span style="color:#999;font-size:.6rem">👥'+c.people+'/'+c.max+'人 · '+c.date+'</span> <span style="color:var(--green-primary);font-size:.6rem;float:right">进入 ▸</span></div>';
  }).join('');
}

// ── 4.5 时间线 ──
function _renderTimelineSection() {
  var entries = [];
  var journal = (window.AppData && AppData._data.journal) || [];
  var anns = (window.AppData && AppData._data.announcements) || [];
  var vfys = (window.AppData && AppData._data.pendingVerifications) || [];
  // 合并 + 去重 + 排序
  journal.forEach(function(j){ entries.push({ time: j.time || '', text: '📝 '+j.user+' '+j.content, type: 'journal' }); });
  anns.forEach(function(a){ entries.push({ time: a.time || '', text: a.text, type: 'announcement' }); });
  vfys.filter(function(v){return v.status==='verified';}).forEach(function(v){
    entries.push({ time: v.verifiedAt || '', text: '✅ '+v.doer+' '+v.action+' · '+v.verifier+'校核 +'+v.ntAmount+'NT', type: 'verification' });
  });
  entries.sort(function(a,b){ return (b.time||'').localeCompare(a.time||''); });
  // 去重（相邻相同文本）
  var deduped = []; entries.forEach(function(e){ if (!deduped.length || deduped[deduped.length-1].text !== e.text) deduped.push(e); });
  var recent = deduped.slice(0,20);
  if (!recent.length) return null;
  return recent.map(function(e){
    var t = e.time || '';
    var display = t.slice(0,10) === new Date().toISOString().slice(0,10) ? t.slice(11,16) : t.slice(0,10) === _yesterday() ? '昨天 '+t.slice(11,16) : t.slice(5,10);
    return '<div class="tl-entry" style="padding:4px 0;font-size:.62rem;border-bottom:1px dotted #f8f8f8"><span style="color:#999">'+display+'</span> '+e.text+'</div>';
  }).join('');
}
function _yesterday() { var d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }

// ── 退回辅助 ──
function _doReject(vfyId, reason) {
  if (!reason) { showToast('请填写退回原因', 'warn'); return; }
  if (!window.AppData) return;
  var result = AppData.verifyAction(vfyId, _me(), false, reason);
  if (result && result.ok) {
    if (window.Game&&Game.toast) Game.toast('已退回');
    render();
  }
}

function _renderPoolCard() {
  var pool = (window.NT && typeof NT.getCommunityPool === 'function') ? NT.getCommunityPool() : 0;
  // R14: 当月流水（加日期过滤）
  var thisMonth = new Date().toISOString().slice(0,7);
  var monthlyIn = 0, monthlyOut = 0;
  if (window.NT && NT.getLedger) {
    var entries = NT.getLedger({ limit: 500 });
    entries.forEach(function(e) {
      if (!e.timestamp || e.timestamp.slice(0,7) !== thisMonth) return;
      if (e.type === 'deposit' || e.to === '__community_pool__') monthlyIn += e.amount;
      if ((e.type && e.type.indexOf('earn') >= 0) || (e.from === 'community')) monthlyOut += e.amount;
    });
  }
  var lowWarn = pool < 200 ? '<div style="font-size:.55rem;color:var(--g-red);margin-top:2px">⚠ 池子低水位，请尽快注资</div>' : '';
  return '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px 12px;margin:4px 0">'+
    '<div style="font-weight:700;font-size:.72rem;margin-bottom:4px">💰 社区资金池</div>'+
    '<div style="font-size:1.2rem;font-weight:700;color:'+(pool<200?'var(--g-red)':'#2a4a30')+'">'+pool+' NT</div>'+lowWarn+
    '<div style="display:flex;gap:8px;margin-top:4px;font-size:.58rem;color:#999">'+
      '<span>📈 本月收入 '+monthlyIn+'</span><span>📉 本月支出 '+monthlyOut+'</span>'+
    '</div></div>';
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
    var cl = (window.AppData && AppData._data.cleaning && AppData._data.cleaning.spaces[b2.id]) ? AppData._data.cleaning.spaces[b2.id] : null;
    var dotColor = '#5d8c52';
    if (cl) {
      var st = _getDirtinessStatus(cl.dirtiness);
      dotColor = st === 'green' ? '#5d8c52' : st === 'yellow' ? '#c8892e' : st === 'red' ? '#b84c38' : '#b84c38';
    } else if (b2.status) {
      dotColor = b2.status==='green'?'#5d8c52':b2.status==='yellow'?'#c8892e':'#b84c38';
    }
    h += '<div class="bc-card'+(active?' active':'')+'" onclick="goTo('+i+')">'+
      '<span class="bc-icon">'+b2.icon+'</span>'+
      '<span class="bc-name">'+b2.name+'</span>'+
      '<span class="bc-status" style="background:'+dotColor+'"></span></div>';
  });
  _q('bcTrack').innerHTML = h;

  var dots = '';
  blds.forEach(function(_,i){ dots += '<div class="bc-dot'+(i===idx?' active':'')+'" onclick="goTo('+i+')"></div>'; });
  _q('bcDots').innerHTML = dots;
  // 滚动由 goTo() 统一控制，此处不设 scrollLeft
}

function renderFieldPlots(plots) {
  var h = '';
  plots.forEach(function(p){
    var isP = p.crop && p.crop !== '—';
    h += '<div class="field-plot'+((p.note||'').indexOf('⚠')>=0?' warn':'')+'" onclick="selectRoom(\''+p.id+'\')"><div class="fp-icon">'+p.icon+'</div><div class="fp-name">'+p.name+'</div>';
    if (isP) h += '<div class="fp-crop">'+p.crop+'</div><div class="fp-bar"><div class="fp-fill" style="width:'+Math.round((1-p.remain/p.days)*100)+'%"></div></div><div class="fp-days">'+p.planted+'→'+p.harvest+'·剩'+p.remain+'天</div>';
    else h += '<div class="fp-crop" style="color:var(--g-text-dim)">'+(p.note||'空闲')+'</div>';
    if (p.note) h += '<div class="fp-note">'+p.note+'</div>';
    h += '</div>';
  });
  return '<div class="field-grid">'+h+'</div>';
}

function buildFieldDetail(plot) {
  // 章8: 支持多作物
  if (!plot.crops) plot.crops = [];
  if (plot.crop && plot.crop !== '—' && !plot.crops.length) {
    // 迁移旧数据
    plot.crops.push({ name: plot.crop, icon: plot.icon, planted: plot.planted, days: plot.days, remain: plot.remain, harvest: plot.harvest, status: plot.status });
  }
  var body = '';
  if (plot.crops.length > 0) {
    plot.crops.forEach(function(c, idx) {
      var pct = c.days ? Math.round((1 - c.remain / c.days) * 100) : 0;
      body += '<div class="section-label">🌱'+c.name+'</div>'+
        '<div class="item-row"><div class="ir-icon">'+c.icon+'</div><div class="ir-text">'+c.name+'<div class="ir-sub">'+c.planted+'种植·'+c.days+'天周期·预计'+c.harvest+'成熟</div></div></div>'+
        '<div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%"></div></div>'+
        '<div style="font-size:.68rem;color:var(--g-text-dim);margin:4px 0">已生长'+(c.days-c.remain)+'天/共'+c.days+'天·剩余'+c.remain+'天</div>'+
        '<div style="display:flex;gap:4px;margin-bottom:6px">'+
          (c.remain <= 0 ? '<button class="btn-sm pri" style="font-size:.6rem;padding:3px 8px" onclick="event.stopPropagation();_harvestCrop(\''+plot.id+'\','+idx+')">🌾 收割 +15 NT</button>' : '')+
          '<button class="btn-sm sec" style="font-size:.6rem;padding:3px 8px" onclick="event.stopPropagation();var n=prompt(\'修改作物名：\',\''+c.name+'\');if(n){plot.crops['+idx+'].name=n;_savePlotData();closeRoom();selectRoom(\''+plot.id+'\')}">✏️ 编辑</button>'+
        '</div>';
    });
  } else { body += '<div style="color:var(--g-text-dim);font-size:.72rem;padding:8px">暂无种植</div>'; }
  body += '<button class="btn-sm pri" style="width:100%;font-size:.65rem;padding:6px;margin-top:4px" onclick="event.stopPropagation();_openFarmQuick()">＋ 记录农活</button>';
  return body + '<button class="back-to-overview" onclick="closeRoom()">←返回田地总览</button>';
}
function _harvestCrop(plotId, cropIdx) {
  var plots = getPlots(); var plot = plots.find(function(p){return p.id===plotId;});
  if (!plot || !plot.crops || !plot.crops[cropIdx]) return;
  var crop = plot.crops[cropIdx];
  if (window.AppData) AppData.addVerification('field_harvest', _me(), '收割 '+crop.name+' @'+plot.name, { plotId:plotId, crop:crop.name }, 15, 3);
  plot.crops.splice(cropIdx, 1);
  _savePlotData();
  if (window.Game&&Game.toast) Game.toast('收割 '+crop.name+' +15 NT（待校核）');
  render();
}
function _savePlotData() {
  var plots = getPlots();
  var ml = (window.AppData && AppData._data.map_locations) ? AppData._data.map_locations : null;
  if (ml) { ml.plots = plots; if (window.AppData) AppData._saveShared(true); }
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
  // Step 3: 脏污度高时显示打扫按钮
  if (b.id && b.id !== 'info' && window.AppData) {
    var cl2 = AppData._data.cleaning;
    if (cl2 && cl2.spaces[b.id] && cl2.spaces[b.id].dirtiness > 30) {
      h += '<button class="ma-btn primary" style="margin-top:8px;width:100%;justify-content:center" onclick="event.stopPropagation();_doCleaning(\''+b.id+'\')">🧹 打扫 · 脏污度 '+cl2.spaces[b.id].dirtiness+'%</button>';
    }
  }
  return h;
}

function buildRoomDetail(room) {
  var body = '';

  // ── L3: 物品列表（硬编码 + AppData room_items + 库存动态）──
  var allItems = (room.items || []).slice();
  // Phase 2: 合并 AppData map_locations.state.room_items
  var rmItems = _roomItems(room.id);
  rmItems.forEach(function(i){ allItems.push(i); });
  // Step 2: 合并 AppData 库存
  var spaceId = (curBuilding()||{}).id;
  if (window.AppData && spaceId) {
    // 住宿房间：显示真实入住数据
    if (room.id.indexOf('dorm')===0) { var ld=_getRoomLiveData(room.id); if(ld&&ld.tenants.length){ ld.tenants.forEach(function(t){ allItems.push({icon:'🛏',text:t.name+' · 床'+t.bed,sub:t.checkIn+'→'+t.checkOut,status:'clean'}); }); } else { allItems.push({icon:'🛏',text:'空房',sub:ld?ld.price+'NT/床·'+ld.ac:'',status:'clean'}); } }
    var inv = AppData._data.inventory || {};
    var dynItems = (inv[spaceId] || []).filter(function(it){ return it.status === 'fresh'; });
    dynItems.forEach(function(it){
      var today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
      var putD = new Date(it.putDate + 'T00:00:00');
      var defExp = (_mlConfig().item_expiry_days)||5;
      var expD = new Date(putD.getTime() + (it.expiryDays||defExp) * 86400000);
      var daysLeft = Math.floor((expD - new Date(today + 'T00:00:00')) / 86400000);
      var st = daysLeft <= 0 ? 'expired' : daysLeft <= 1 ? 'warn' : 'clean';
      allItems.push({ icon: '📦', text: it.name, sub: (it.putBy||'')+' · '+(daysLeft<=0?'已过期':daysLeft+'天后过期'), status: st });
    });
  }
  if (allItems.length) {
    var isAdmin = (window.Game&&Game.getUser)?((Game.getUser().role||'')==='admin'):false;
    body += '<div class="section-label">📦物品('+allItems.length+'件)'+(isAdmin?' <span style="cursor:pointer;font-size:.6rem;color:var(--g-accent)" onclick="event.stopPropagation();_editRoomItem(\''+room.id+'\')">✏️编辑</span>':'')+'</div>';
    allItems.forEach(function(it, idx){
      var statusLabel = it.status==='warn'?'注意':it.status==='expired'?'过期':'正常';
      var statusClass = it.status==='warn'?'is-warn':it.status==='expired'?'is-bad':'is-clean';
      body += '<div class="item-row" style="'+_seedStyle(it)+'"><div class="ir-icon">'+it.icon+'</div><div class="ir-text">'+it.text+'<div class="ir-sub">'+(it.sub||'')+'</div></div><div class="item-status '+statusClass+'">'+statusLabel+'</div></div>';
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

  // 快捷操作按钮
  if (room.id === 'kitchen') body += '<button class="btn-sm pri" style="width:100%;margin-top:4px;min-height:36px;font-size:.62rem" onclick="event.stopPropagation();_openKitchenQuick()">＋ 放入物品</button>';
  body += '<button class="back-to-overview" onclick="closeRoom()">←返回建筑总览</button>';
  return body;
}

var _progScroll = false; // 程序化滚动标志，阻止 scroll 事件误触发
function goTo(i) {
  currentIdx = i; selectedRoomId = null; currentFloor = 0; overviewOpen = false;
  var bld = getBuildings()[i];
  if (bld && window.Game && window.Game.setMemberLocation) { window.Game.setMemberLocation(bld.id); }
  // E3.4: checkin_5 quest hook — 进入社区空间
  if (bld && bld.id && window.AppData) {
    if (!AppData._data.visitedSpaces) AppData._data.visitedSpaces = [];
    if (AppData._data.visitedSpaces.indexOf(bld.id) === -1) {
      AppData._data.visitedSpaces.push(bld.id);
      if (AppData._data.visitedSpaces.length >= 5 && typeof _completeNewbieQuest === 'function') {
        _completeNewbieQuest(CURRENT_USER, 'checkin_5');
      }
      AppData._save();
    }
  }
  render();
  var track = _q('bcTrack'); if (!track) return;
  var cards = track.querySelectorAll('.bc-card');
  if (cards[i]) {
    _progScroll = true;
    cards[i].scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    setTimeout(function(){ _progScroll = false; }, 400);
  }
}
function setFloor(f) { currentFloor = f; selectedRoomId = null; render(); }
function selectRoom(id) { selectedRoomId = (selectedRoomId === id) ? null : id; render(); }
function closeRoom() { selectedRoomId = null; render(); }
function toggleOverview() { overviewOpen = !overviewOpen; render(); }

// ═══ 事件绑定 ═══
var _eventCleanups = [];

function _bindEvents() {
  var track = _q('bcTrack');
  var photo = _q('photoImg');

  if (track) {
    var _bcSnap;
    function onScroll() {
      if (_progScroll) return; // 程序化滚动，不触发
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
    nextDate: '2026-07-21',
    time: '15:00',
    advanceHours: 2,  // 提前2h开放选位
    selections: {},   // { spaceId: { lockedBy: 'userName', lockedAt: '...' } }
    history: []
  },
  // 章7: 日常清理容器
  dailyContainers: [
    { id:'compost', name:'堆肥桶', icon:'🪣', location:'kitchen', periodHours:24, ntReward:3, lastCleaned:'2026-07-18T08:00', overdueMultiplier:1.5 },
    { id:'trash_kitchen', name:'厨房垃圾桶', icon:'🗑️', location:'kitchen', periodHours:48, ntReward:2, lastCleaned:'2026-07-17T12:00', overdueMultiplier:1.5 },
    { id:'trash_studio', name:'画室废纸篓', icon:'🗑️', location:'studio', periodHours:72, ntReward:1, lastCleaned:'2026-07-16T10:00', overdueMultiplier:1.5 },
    { id:'trash_toilet', name:'厕所垃圾桶', icon:'🗑️', location:'toilet_b', periodHours:48, ntReward:2, lastCleaned:'2026-07-18T14:00', overdueMultiplier:1.5 },
    { id:'counter_kitchen', name:'厨房台面', icon:'🍳', location:'kitchen', periodHours:24, ntReward:2, lastCleaned:'2026-07-18T20:00', overdueMultiplier:1.2 }
  ],
  stay: {
    myRoom: null,
    myCheckIn: null,
    myCheckOut: null,
    history: []
  },
  field: {
    history: []
  },
  kitchen: {
    history: []
  },
  _load: function() {
    // 迁移：旧 nt_mgmt_data key → 统一到 AppData._data
    try {
      var old = localStorage.getItem('nt_mgmt_data');
      if (old) {
        var s = JSON.parse(old);
        if (window.AppData && AppData._data) {
          AppData._data._mgmt = AppData._data._mgmt || {};
          AppData._data._mgmt.cleaning_history = s.cleaning_history || this.cleaning.history;
          AppData._data._mgmt.stay_history = s.stay_history || this.stay.history;
          AppData._data._mgmt.field_history = s.field_history || this.field.history;
          AppData._data._mgmt.kitchen_history = s.kitchen_history || this.kitchen.history;
          AppData._data._mgmt.cleaning_nextDate = s.cleaning_nextDate || this.cleaning.nextDate;
          AppData._data._mgmt.cleaning_mySelections = s.cleaning_mySelections || [];
          AppData._data._mgmt.stay_myRoom = s.stay_myRoom || null;
          AppData._data._mgmt.stay_myCheckIn = s.stay_myCheckIn || null;
          AppData._data._mgmt.stay_myCheckOut = s.stay_myCheckOut || null;
        }
        localStorage.removeItem('nt_mgmt_data');
      }
    } catch(e) {}
    // 从 AppData 恢复
    var d = (window.AppData && AppData._data && AppData._data._mgmt) ? AppData._data._mgmt : null;
    if (d) {
      this.cleaning.history = d.cleaning_history || this.cleaning.history;
      this.cleaning.nextDate = d.cleaning_nextDate || this.cleaning.nextDate;
      this.cleaning.mySelections = d.cleaning_mySelections || [];
      this.stay.history = d.stay_history || this.stay.history;
      this.stay.myRoom = d.stay_myRoom || null;
      this.stay.myCheckIn = d.stay_myCheckIn || null;
      this.stay.myCheckOut = d.stay_myCheckOut || null;
      this.field.history = d.field_history || this.field.history;
      this.kitchen.history = d.kitchen_history || this.kitchen.history;
    }
  },
  _save: function() {
    var self = this;
    clearTimeout(this._timer);
    this._timer = setTimeout(function() {
      if (window.AppData && AppData._data) {
        AppData._data._mgmt = AppData._data._mgmt || {};
        AppData._data._mgmt.cleaning_history = self.cleaning.history;
        AppData._data._mgmt.cleaning_nextDate = self.cleaning.nextDate;
        AppData._data._mgmt.cleaning_mySelections = self.cleaning.mySelections;
        AppData._data._mgmt.stay_history = self.stay.history;
        AppData._data._mgmt.stay_myRoom = self.stay.myRoom;
        AppData._data._mgmt.stay_myCheckIn = self.stay.myCheckIn;
        AppData._data._mgmt.stay_myCheckOut = self.stay.myCheckOut;
        AppData._data._mgmt.field_history = self.field.history;
        AppData._data._mgmt.kitchen_history = self.kitchen.history;
        AppData._saveShared();
      }
    }, 200);
  },
  _timer: null
};
MGMT_DATA._load();

var _mgmtFormType = '';

// ══ 章7: 大扫除选位 ══
function _getWeeklyCleaningAreas() {
  var areas = [];
  var blds = getBuildings();
  blds.forEach(function(b) {
    if (b.id === 'info' || b.id === 'gate_a' || b.id === 'parking') return;
    var fKeys = Object.keys(b.floors || {});
    fKeys.forEach(function(fk) {
      (b.floors[fk] || []).forEach(function(r) {
        if (r.cleaning && r.cleaning.length > 0) {
          areas.push({ id: r.id, name: r.name, icon: r.icon, buildingName: b.name, buildingId: b.id });
        }
      });
    });
  });
  return areas;
}

function _canSelectCleaningArea() {
  var nextDate = MGMT_DATA.cleaning.nextDate;
  var time = MGMT_DATA.cleaning.time || '15:00';
  var advanceHours = MGMT_DATA.cleaning.advanceHours || 2;
  var eventTime = new Date(nextDate + 'T' + time + ':00');
  var windowOpen = new Date(eventTime.getTime() - advanceHours * 3600 * 1000);
  var now = new Date();
  return now >= windowOpen && now < eventTime;
}

function _selectCleaningArea(spaceId) {
  if (!_canSelectCleaningArea()) {
    if (window.Game&&Game.toast) Game.toast('选位窗口尚未开放或已过期');
    return;
  }
  if (!MGMT_DATA.cleaning.selections) MGMT_DATA.cleaning.selections = {};
  if (MGMT_DATA.cleaning.selections[spaceId] && MGMT_DATA.cleaning.selections[spaceId].lockedBy !== _me()) {
    if (window.Game&&Game.toast) Game.toast('此区域已被 '+MGMT_DATA.cleaning.selections[spaceId].lockedBy+' 选定');
    return;
  }
  MGMT_DATA.cleaning.selections[spaceId] = { lockedBy: _me(), lockedAt: new Date().toISOString() };
  MGMT_DATA._save();
  if (window.Game&&Game.toast) Game.toast('已选定，请按时打扫！');
  renderMgmtPanel('cleaning');
}

// ══ 章7: 日常清理自动委托 ══
function _checkDailyContainers() {
  if (!MGMT_DATA.dailyContainers) return;
  var now = new Date();
  MGMT_DATA.dailyContainers.forEach(function(c) {
    var lastCleaned = new Date(c.lastCleaned);
    var hoursPassed = (now - lastCleaned) / 3600000;
    if (hoursPassed >= c.periodHours) {
      var overdue = hoursPassed / c.periodHours;
      var reward = Math.max(1, Math.round(c.ntReward * (overdue >= 1 ? Math.min(c.overdueMultiplier || 1.5, overdue * 0.5 + 0.5) : overdue)));
      // 检查是否已有此容器的待处理委托
      var existing = (window.AppData && AppData._data.pendingVerifications) ? AppData._data.pendingVerifications.filter(function(v){
        return v.type === 'daily_container' && v.detail && v.detail.containerId === c.id && v.status === 'pending';
      }) : [];
      if (!existing.length && window.AppData) {
        AppData.addVerification('daily_container', null, '清理 '+c.icon+' '+c.name+' ('+c.location+')', { containerId: c.id }, reward, Math.ceil(reward/5));
      }
    }
  });
}

// ── 工具：当前用户 ──
function _me() {
  var u = (window.Game && Game.getUser) ? Game.getUser() : null;
  return (u && u.name) ? u.name : '';
}

// ── 工具：收集打扫房间 ──
function _collectCleaningRooms() {
  var rooms = [];
  var cl = (window.AppData && AppData._data.cleaning && AppData._data.cleaning.spaces) ? AppData._data.cleaning.spaces : {};
  getBuildings().forEach(function(b) {
    if (b.id === 'info' || b.id === 'gate_a' || b.id === 'parking') return;
    var d = (cl[b.id]) ? cl[b.id].dirtiness || 0 : 0;
    var st = d >= 60 ? 'red' : d >= 30 ? 'yellow' : 'green';
    var fKeys = Object.keys(b.floors || {});
    if (fKeys.length) {
      fKeys.forEach(function(fk) {
        (b.floors[fk] || []).forEach(function(r) {
          if (r.cleaning && r.cleaning.length > 0) {
            rooms.push({ id:r.id, name:r.name, icon:r.icon, status:st, buildingName:b.name, cleaning:r.cleaning });
          }
        });
      });
    } else {
      rooms.push({ id:b.id, name:b.name, icon:b.icon, status:st, buildingName:b.name, cleaning:[] });
    }
  });
  if (!rooms.length) {
    // 兜底：所有建筑都作为可打扫空间
    getBuildings().forEach(function(b) {
      if (b.id === 'info' || b.id === 'gate_a') return;
      var d2 = (cl[b.id]) ? cl[b.id].dirtiness || 0 : 0;
      var st2 = d2 >= 60 ? 'red' : d2 >= 30 ? 'yellow' : 'green';
      rooms.push({ id:b.id, name:b.name, icon:b.icon, status:st2, buildingName:b.name, cleaning:[] });
    });
  }
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
  _q('scrollArea').style.display = 'none';
  _q('itemsOverlay').classList.remove('show');
  _d('mgmtOverlay').classList.add('show');
  var titles = { cleaning:'🧹 大扫除管理', stay:'🛏️ 住宿管理', field:'🌿 田地管理', kitchen:'🍳 厨房管理' };
  _d('mgmtTitle').textContent = titles[type] || '';
  renderMgmtPanel(type);
}

function closeMgmt() {
  _mgmtFormType = '';
  _d('mgmtOverlay').classList.remove('show');
  _q('scrollArea').style.display = '';
}

function renderMgmtPanel(type) {
  var fn = { cleaning:renderCleaningPanel, stay:_showStaySheet, field:renderFieldPanel, kitchen:renderKitchenPanel }[type];
  _d('mgmtBody').innerHTML = fn ? fn() : '';
}

// ── 卡片弹窗通用壳（fullscreen=true 全屏）──
function _showCardPopup(title, bodyHTML, actionBtn, fullscreen) {
  var old = document.querySelector('.mgmt-sheet'); if (old) old.remove();
  var el = document.createElement('div'); el.className = 'mgmt-sheet';
  el.style.cssText = 'position:fixed;inset:0;z-index:260;display:flex;align-items:flex-end;justify-content:center';
  // F23: 入场动画 — 遮罩 fadeIn + 卡片 slideUp
  el.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.45);animation:fadeIn .2s ease-out" onclick="this.parentElement.remove()"></div>'+
    '<div style="position:relative;background:#fff;border-radius:'+(fullscreen?'0':'16px 16px 0 0')+';width:100%;max-width:'+(fullscreen?'100%':'500px')+';height:'+(fullscreen?'100vh':'auto')+';max-height:'+(fullscreen?'100vh':'72vh')+';overflow-y:auto;padding:'+(fullscreen?'20px 16px 80px':'20px 16px')+';padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 24px rgba(0,0,0,.15);animation:spcPop .2s ease-out">'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:1.2rem">'+title+'</span></div>'+
    bodyHTML+(actionBtn||'')+'<button class="btn-sm sec" style="width:100%;margin-top:8px;min-height:44px" onclick="var s=document.querySelector(\'.mgmt-sheet\');if(s)s.remove()">✕ 关闭</button></div>';
  document.body.appendChild(el);
}

// 管理卡片点击 → 弹窗
function _openMgmtSheet(type) {
  if (type === 'kitchen') { _showFridgeSheet(); return; }
  if (type === 'field')   { _showFieldSheet(); return; }
  if (type === 'cleaning') { _showCardPopup('🧹 大扫除管理', renderCleaningPanel()||'', null, true); return; }
  if (type === 'stay')     { _showStaySheet(); return; }
}

function _showFridgeSheet() {
  var zones = [{ key:'fridge_upper', name:'🧊 冷藏上层', items:[] },{ key:'fridge_lower', name:'❄️ 冷冻下层', items:[] },{ key:'fridge_door', name:'🚪 门架', items:[] },{ key:'storage', name:'📦 储物间', items:[] }];
  var inv = (window.AppData && AppData._data.inventory && AppData._data.inventory.office) ? AppData._data.inventory.office : [];
  inv.forEach(function(it) { var z = zones.find(function(z){ return z.key === (it.location||''); }) || zones[3]; z.items.push(it); });
  var h = '';
  zones.forEach(function(z) {
    h += '<div style="font-weight:600;font-size:.7rem;color:#5a6e5c;margin:8px 0 2px">'+z.name+' ('+z.items.length+'件)</div>';
    if (!z.items.length) { h += '<div style="font-size:.6rem;color:#999;padding:4px 0">空</div>'; return; }
    z.items.forEach(function(it) {
      var w = ''; if (it.expiryDays && it.putDate) { var d = it.expiryDays - Math.floor((Date.now() - new Date(it.putDate+'T00:00:00'))/86400000); w = d <= 0 ? ' <span style="color:var(--g-red)">过期</span>' : d <= 2 ? ' <span style="color:#c8892e">'+d+'天</span>' : ''; }
      h += '<div style="font-size:.62rem;padding:3px 0;border-bottom:1px dotted #f0f0f0;display:flex;justify-content:space-between"><span>📦 '+it.name+' · '+it.putBy+w+'</span><span style="color:#999;font-size:.55rem">'+it.putDate+'</span></div>';
    });
  });
  _showCardPopup('🍳 冰箱', h, '<button class="btn-sm pri" style="width:100%;margin:8px 0;min-height:44px;font-size:.65rem" onclick="_openKitchenQuick()">＋ 放入物品</button>', true);
}

function _showFieldSheet() {
  var plots = getPlots();
  var h = '';
  plots.forEach(function(p) {
    if (!p.crops) p.crops = [];
    if (p.crop && p.crop !== '—' && !p.crops.length) { p.crops.push({ name:p.crop, icon:p.icon, planted:p.planted, days:p.days, remain:p.remain, harvest:p.harvest }); }
    var ci = p.crops.length ? p.crops.map(function(c){ return c.icon+' '+c.name+(c.remain<=0?' ✅':' 剩'+c.remain+'天'); }).join(' · ') : '空闲';
    h += '<div style="padding:8px 10px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:4px;cursor:pointer;font-size:.65rem" onclick="var s=document.querySelector(\'.mgmt-sheet\');if(s)s.remove();var b=getBuildings().findIndex(function(x){return x.id===\'field\'});if(b>=0){currentIdx=b;selectRoom(\''+p.id+'\');render()}">'+
      '<span style="font-size:1.1rem">'+p.icon+'</span> <b>'+p.name+'</b> <span style="color:#999">'+ci+'</span></div>';
  });
  _showCardPopup('🌿 田地', h, '<button class="btn-sm pri" style="width:100%;margin:4px 0;min-height:44px;font-size:.65rem" onclick="_openFarmQuick()">＋ 记录农活</button>', true);
}

// ── 住宿：选房间→展开床位→选床→填日期→申请入住 ──
// ── 住宿：选房间→床位面板→点击空床→居中入住卡（日历+计算+管理员提示）──
var _selectedBed = null, _expandedRoom = null, _expandedBed = null;
var _showCheckinCard = false, _calYear, _calMonth, _calStart, _calEnd;

function _showStaySheet() {
  var mapData = (window.AppData && AppData._data && AppData._data.map_locations) ? AppData._data.map_locations : {};
  var accs = (mapData.accommodations && Object.keys(mapData.accommodations).length) ? mapData.accommodations : (_ml().accommodations || {});
  if (!Object.keys(accs).length) {
    accs = { dorm101:{label:'A室·三人通铺',ac:'无',pricePerBed:20,beds:3,tenants:[]},dorm102:{label:'B室·四人通铺',ac:'有',pricePerBed:30,beds:4,tenants:[]},dorm103:{label:'C室·上下床',ac:'有',pricePerBed:30,beds:3,tenants:[]},dorm104:{label:'D室·单间',ac:'有',pricePerBed:60,beds:1,tenants:[]},dorm105:{label:'E室·上下床×2',ac:'有',pricePerBed:30,beds:4,tenants:[]},dorm106:{label:'F室·四人间',ac:'有',pricePerBed:35,beds:4,tenants:[]} };
  }
  var rooms = Object.keys(accs).map(function(k){ var a=accs[k]; a._id=k; if(!a.tenants)a.tenants=[]; if(!a.pricePerBed)a.pricePerBed=a.rentNT||30; return a; });
  var me = _me();
  var activeRoom = _expandedRoom ? accs[_expandedRoom] : null;
  if (!activeRoom && rooms.length) { _expandedRoom = rooms[0]._id; activeRoom = rooms[0]; }
  if (activeRoom && !activeRoom.tenants) activeRoom.tenants = [];

  var h = '';
  h += '<style>';
  // 房间卡片
  h += '.rm-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}';
  h += '.rm-card{background:#fff;border:2px solid #d0d9ce;border-radius:10px;overflow:hidden;cursor:pointer;transition:.12s}';
  h += '.rm-card:active{transform:scale(.97)}.rm-card.active{border-color:var(--green-primary);box-shadow:0 0 0 2px var(--green-primary)}';
  h += '.rm-inner{display:flex;flex-direction:column;align-items:center;padding:12px 6px 8px}';
  h += '.rm-icon{font-size:1.4rem}.rm-label{font-size:.65rem;font-weight:700;color:var(--tx);margin-top:2px}';
  h += '.rm-tags{display:flex;gap:3px;margin-top:3px;flex-wrap:wrap;justify-content:center}';
  h += '.rm-tag{font-size:.45rem;padding:1px 5px;border-radius:5px;background:#f0f0f0;color:#7a7a7a}';
  h += '.rm-tag.noac{background:#fef0d0;color:#8a6a30}.rm-tag.item{background:#e8f5e8;color:var(--gp)}';
  h += '.rm-occ{font-size:.5rem;font-weight:600;margin-top:3px;padding:1px 6px;border-radius:6px}';
  h += '.rm-occ.full{background:#fde8e8;color:var(--red)}.rm-occ.partial{background:#fef8e8;color:var(--ga)}.rm-occ.empty{background:#e8f5e8;color:var(--gp)}';
  h += '.rm-tenants{font-size:.48rem;color:var(--t2);margin-top:3px;text-align:center;line-height:1.3;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
  // 床位面板 — 独立卡片，横向排列
  h += '.bp-panel{background:#fff;border:1.5px solid #d0d9ce;border-radius:12px;padding:10px 12px;margin-top:4px;animation:rmFade .2s}';
  h += '.bp-head{font-size:.7rem;font-weight:700;color:var(--tx);padding-bottom:8px;display:flex;align-items:center;gap:6px;border-bottom:1px solid #e8ede6;margin-bottom:8px}';
  h += '.bp-bed-row{display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}';
  h += '.bp-bed-row::-webkit-scrollbar{display:none}';
  h += '.bd-card{flex:0 0 100px;width:100px;background:#fff;border:1.5px solid #e0e0e0;border-radius:10px;padding:10px 8px;text-align:center;cursor:pointer;transition:.12s;position:relative}';
  h += '.bd-card:active{transform:scale(.96)}.bd-card.occ{background:#f9faf6}.bd-card.vac{border-style:dashed;border-color:#c0d0c0}';
  h += '.bd-card.sel{border-color:var(--gp);background:#e8f5e8;box-shadow:0 0 0 1px var(--gp)}';
  h += '.bd-avatar{width:36px;height:36px;border-radius:50%;margin:0 auto 4px;background:#e8f0e8;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:var(--gp);overflow:hidden}';
  h += '.bd-avatar img{width:100%;height:100%;object-fit:cover}';
  h += '.bd-num{font-size:.6rem;font-weight:700;color:var(--tx)}.bd-name{font-size:.52rem;color:var(--t2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
  h += '.bd-date{font-size:.45rem;color:#999;margin-top:1px}.bd-price{font-size:.52rem;color:var(--gp);font-weight:600;margin-top:2px}';
  // 入住弹窗
  h += '.ci-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s}';
  h += '.ci-card{background:#fff;border-radius:16px;width:320px;max-width:92vw;max-height:90vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,.25);animation:ciPop .25s ease-out}';
  h += '@keyframes ciPop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}';
  h += '.ci-head{display:flex;align-items:center;gap:10px;padding:16px 16px 12px;border-bottom:1px solid #e8ede6}';
  h += '.ci-title{font-size:.75rem;font-weight:700;color:var(--tx);flex:1}';
  h += '.ci-close{font-size:1.1rem;cursor:pointer;color:#999;padding:4px 8px;border:none;background:none}';
  h += '.cal-wrap{padding:12px 16px}';
  h += '.cal-month{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}';
  h += '.cal-month-title{font-size:.72rem;font-weight:700;color:var(--tx)}';
  h += '.cal-nav{font-size:.9rem;cursor:pointer;padding:4px 10px;border:none;background:#f0f0f0;border-radius:6px;color:var(--t2)}';
  h += '.cal-nav:active{background:#e0e0e0}';
  h += '.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;max-width:280px;margin:0 auto}';
  h += '.cal-dow{font-size:.48rem;color:#999;padding:3px 0}';
  h += '.cal-day{width:100%;height:34px;display:flex;align-items:center;justify-content:center;font-size:.58rem;cursor:pointer;border-radius:6px;transition:.1s;user-select:none;-webkit-tap-highlight-color:transparent}';
  h += '.cal-day:hover{background:#e8ece8}.cal-day.other{color:#ccc;cursor:default}';
  h += '.cal-day.start,.cal-day.end{background:#2a4d3a!important;color:#fff!important;font-weight:800;font-size:.68rem;text-shadow:0 1px 1px rgba(0,0,0,.3)}';
  h += '.cal-day.range{background:#d8ecd8}';
  h += '.cal-day.today{box-shadow:inset 0 0 0 2px var(--gp)}';
  h += '.ci-info{padding:8px 16px;font-size:.65rem;color:var(--t2)}';
  h += '.ci-info-row{display:flex;justify-content:space-between;padding:4px 0}';
  h += '.ci-info-row b{color:var(--tx)}';
  h += '.ci-total{font-size:.78rem;font-weight:700;color:var(--gp);text-align:center;padding:8px 0}';
  h += '.ci-tip{display:flex;align-items:flex-start;gap:8px;margin:0 16px 12px;padding:10px 12px;background:#fdf9f0;border-radius:10px;border:1px solid #f0e8d0}';
  h += '.ci-tip-avatar{width:32px;height:32px;border-radius:50%;flex-shrink:0;overflow:hidden;background:#e8f0e8}';
  h += '.ci-tip-avatar img{width:100%;height:100%;object-fit:cover}';
  h += '.ci-tip-text{flex:1;font-size:.58rem;color:#8a6a30;line-height:1.5}';
  h += '.ci-tip-text strong{color:#6a4a10}';
  h += '.ci-actions{display:flex;gap:8px;padding:12px 16px 16px}';
  h += '.ci-btn{flex:1;padding:12px;border-radius:10px;font-size:.72rem;font-weight:700;cursor:pointer;border:none;min-height:44px;transition:.1s}';
  h += '.ci-btn:active{transform:scale(.97)}';
  h += '.ci-btn.go{background:var(--gp);color:#fff}.ci-btn.no{background:#f0f0f0;color:var(--t2)}';
  h += '.bk-det{padding:10px 12px;margin-top:8px;background:#fafaf8;border-radius:8px;border:1px solid #e8ede6;font-size:.6rem}';
  h += '.bk-row{display:flex;justify-content:space-between;padding:3px 0;color:var(--t2)}.bk-row b{color:var(--tx)}';
  h += '@keyframes rmFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}';
  h += '@keyframes fadeIn{from{opacity:0}to{opacity:1}}';
  h += '.rm-items-row{font-size:.52rem;color:var(--t2);padding:4px 0 8px}';
  h += '.rm-items-row span{margin-right:6px}';
  h += '.rm-add-item{color:var(--gp);cursor:pointer;text-decoration:underline}';
  h += '</style>';

  // ── 房间卡片网格 ──
  h += '<div class="rm-grid">';
  rooms.forEach(function(r){
    var occ=r.tenants.length,total=r.beds||1,full=occ>=total,empty=!occ;
    var occCls=full?'full':empty?'empty':'partial';
    var icon=r._id.indexOf('104')>=0?'🛏️':r._id.indexOf('103')>=0?'🛌':total>=4?'🏠':'🚪';
    var active=_expandedRoom===r._id;
    var tenantNames=r.tenants.map(function(t){return t.name}).join(' · ')||'空置';
    var noAC=r.ac==='无';
    h += '<div class="rm-card'+(active?' active':'')+'" onclick="_pickRoom(\''+r._id+'\')">';
    h += '<div class="rm-inner"><div class="rm-icon">'+icon+'</div><div class="rm-label">'+r.label+'</div>';
    h += '<div class="rm-tags">';
    h += '<span class="rm-tag'+(noAC?' noac':'')+'">'+(noAC?'❄️无空调':'❄️有空调')+'</span>';
    h += '<span class="rm-tag">💵'+r.pricePerBed+'NT</span>';
    h+='<span class="rm-tag item">🧰</span>';
    h += '</div><div class="rm-occ '+occCls+'">'+occ+'/'+total+' 人</div>';
    h += '<div class="rm-tenants">👤 '+tenantNames+'</div>';
    h += '</div></div>';
  });
  h += '</div>';

  // ── 床位面板（独立卡片，全宽）──
  if (activeRoom) {
    var r = activeRoom; var rid = r._id;
    h += '<div class="bp-panel">';
    h += '<div class="bp-head">🛏 '+r.label+'<span class="rm-tag">💵'+r.pricePerBed+'NT/天</span></div>';
    var items = r.items || [];
    h += '<div class="rm-items-row">🧰 物品：';
    if(items.length){items.forEach(function(it){h+='<span>'+it+'</span>';})}else{h+='<span style="color:#aaa">暂无</span>';}
    h += ' <span class="rm-add-item" onclick="event.stopPropagation();_addRoomItem(\''+rid+'\')">+添加</span></div>';
    h += '<div class="bp-bed-row">';
    for (var b=1; b<=(r.beds||1); b++) {
      var taken = r.tenants.find(function(t){return t.bed===b;});
      var sel = _selectedBed && _selectedBed.room===rid && _selectedBed.bed===b;
      var days = taken ? Math.max(1, Math.ceil((new Date(new Date().getFullYear()+'-'+taken.checkOut.replace('/','-'))-new Date(new Date().getFullYear()+'-'+taken.checkIn.replace('/','-')))/86400000)) : 0;
      var isMe = taken && taken.name===me;
      h += '<div class="bd-card'+(taken?' occ':' vac')+(sel?' sel':'')+'" onclick="'+(taken?'_expandBed(\''+rid+'\','+b+')':'_openCheckinCard(\''+rid+'\','+b+')')+'">';
      h += '<div class="bd-avatar">';
      if (taken) {
        var au = (typeof getUsers === 'function' ? getUsers() : {})[taken.name] || {};
        var seed = au.avatar_seed || taken.name || 'default';
        h += avatarImg(seed, 36);
      } else {
        h += '<span style="font-size:.7rem;color:#aaa">🛏</span>';
      }
      h += '</div>';
      h += '<div class="bd-num">'+(taken?taken.name:'床'+b)+'</div>';
      h += '<div class="bd-name">'+(taken?'床'+b+(isMe?' · 我':'')+'':'空置')+'</div>';
      h += '<div class="bd-date">'+(taken?taken.checkIn+'→'+taken.checkOut:'20NT/天')+'</div>';
      h += '<div class="bd-price">'+(taken?(days+'天'):'点击选择')+'</div>';
      h += '</div>';
    }
    h += '</div>';
    // 已占床位 → 详情展开
    var bOpen = _expandedBed;
    if (bOpen && bOpen.room===rid) {
      var bt = r.tenants.find(function(t){return t.bed===bOpen.bed;});
      if (bt) {
        var bdays = Math.max(1, Math.ceil((new Date(new Date().getFullYear()+'-'+bt.checkOut.replace('/','-'))-new Date(new Date().getFullYear()+'-'+bt.checkIn.replace('/','-')))/86400000));
        var btotal = bdays * r.pricePerBed;
        h += '<div class="bk-det">';
        h += '<div class="bk-row"><span>🛏 床号</span><b>床'+bOpen.bed+'</b></div>';
        h += '<div class="bk-row"><span>👤 入住人</span><b>'+bt.name+'</b></div>';
        h += '<div class="bk-row"><span>📅 入住</span><b>'+bt.checkIn+'</b></div>';
        h += '<div class="bk-row"><span>📅 离店</span><b>'+bt.checkOut+'</b></div>';
        h += '<div class="bk-row"><span>📆 天数</span><b>'+bdays+'天</b></div>';
        h += '<div class="bk-row"><span>💵 每日</span><b>'+r.pricePerBed+' NT</b></div>';
        h += '<div class="bk-row" style="border-top:1px solid #e8ede6;padding-top:4px;font-weight:700"><span>💰 合计</span><b style="color:var(--gp)">'+btotal+' NT</b></div>';
        if (bt.name===me) h += '<button class="ci-btn go" style="width:100%;margin-top:6px;font-size:.6rem;min-height:34px;background:var(--rd)" onclick="_checkoutBed()">🚪 退房</button>';
        h += '</div>';
      }
    }
    h += '</div>';
  }

  // ── 入住弹窗 ──
  if (_showCheckinCard && activeRoom) {
    h += '<div class="ci-overlay" onclick="_closeCheckinCard()">' + _renderCheckinCard(activeRoom) + '</div>';
  }

  _showCardPopup('🛏️ 住宿', h, null, true);
}
function _pickRoom(id) { _expandedRoom = id; _expandedBed = null; _selectedBed = null; _showCheckinCard = false; _showStaySheet(); }
function _openCheckinCard(roomId, bedNum) { _selectedBed = { room: roomId, bed: bedNum }; _showCheckinCard = true; _expandedRoom = roomId; _expandedBed = null; _showStaySheet(); }
function _expandBed(roomId, bedNum) { _expandedRoom = roomId; _showCheckinCard = false; _expandedBed = (_expandedBed&&_expandedBed.room===roomId&&_expandedBed.bed===bedNum) ? null : {room:roomId,bed:bedNum}; _showStaySheet(); }
function _closeCheckinCard() { _showCheckinCard = false; _selectedBed = null; _calStart = null; _calEnd = null; var ov = document.querySelector('.ci-overlay'); if (ov) ov.remove(); }

function _renderCheckinCard(activeRoom) {
  if (!_selectedBed || !activeRoom) return '';
  var r = activeRoom, rid = r._id, bed = _selectedBed.bed;
  var now = new Date();
  if (!_calYear) { _calYear = now.getFullYear(); _calMonth = now.getMonth() + 1; }
  var pricePerDay = r.pricePerBed || 20;
  var totalDays = (_calStart && _calEnd) ? Math.ceil((new Date(_calEnd.y, _calEnd.m-1, _calEnd.d) - new Date(_calStart.y, _calStart.m-1, _calStart.d)) / 86400000) + 1 : 0;
  var totalPrice = totalDays * pricePerDay;

  var h = '';
  h += '<div class="ci-card" onclick="event.stopPropagation()">';
  h += '<div class="ci-head"><span style="font-size:1.3rem">🛏</span><div class="ci-title">'+r.label+' · 床'+bed+'<br><span style="font-size:.55rem;color:#999">'+pricePerDay+'NT/天</span></div><button class="ci-close" onclick="_closeCheckinCard()">✕</button></div>';
  h += _renderMiniCalendar();
  h += '<div class="ci-info">';
  h += '<div class="ci-info-row"><span>📅 入住</span><b>' + (_calStart ? _calStart.y+'-'+String(_calStart.m).padStart(2,'0')+'-'+String(_calStart.d).padStart(2,'0') : '点击日历选择') + '</b></div>';
  h += '<div class="ci-info-row"><span>📅 退房</span><b>' + (_calEnd ? _calEnd.y+'-'+String(_calEnd.m).padStart(2,'0')+'-'+String(_calEnd.d).padStart(2,'0') : '再次点击选择退房') + '</b></div>';
  h += '</div>';
  if (totalDays > 0) {
    h += '<div class="ci-total">💵 '+totalDays+'天 × '+pricePerDay+'NT = '+totalPrice+' NT</div>';
  }
  h += _renderCheckinTip(r);
  h += '<div class="ci-actions">';
  h += '<button class="ci-btn no" onclick="_closeCheckinCard()">✕ 取消</button>';
  h += '<button class="ci-btn go" onclick="_confirmCheckin()"' + (totalDays <= 0 ? ' disabled style="opacity:.5;cursor:default"' : '') + '>✅ 确认入住</button>';
  h += '</div>';
  h += '</div>';
  return h;
}

function _renderMiniCalendar() {
  var y = _calYear, m = _calMonth;
  var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var dow = ['一','二','三','四','五','六','日'];
  var firstDay = new Date(y, m-1, 1).getDay() || 7;
  var daysInMonth = new Date(y, m, 0).getDate();
  var today = new Date(); var todayStr = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();

  var h = '<div class="cal-wrap"><div class="cal-month">';
  h += '<button class="cal-nav" onclick="_calNav(-1);return false">◀</button>';
  h += '<span class="cal-month-title">'+y+'年 '+monthNames[m-1]+'</span>';
  h += '<button class="cal-nav" onclick="_calNav(1);return false">▶</button>';
  h += '</div><div class="cal-grid">';
  dow.forEach(function(d){ h += '<div class="cal-dow">'+d+'</div>'; });
  for (var i = 1; i < firstDay; i++) { h += '<div class="cal-day other"></div>'; }
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = y+'-'+m+'-'+d;
    var cls = 'cal-day';
    if (dateStr === todayStr) cls += ' today';
    if (_calStart && _calEnd) {
      var cur = new Date(y, m-1, d);
      var s = new Date(_calStart.y, _calStart.m-1, _calStart.d);
      var e = new Date(_calEnd.y, _calEnd.m-1, _calEnd.d);
      if (cur.getTime() === s.getTime()) cls += ' start';
      else if (cur.getTime() === e.getTime()) cls += ' end';
      else if (cur > s && cur < e) cls += ' range';
    } else if (_calStart) {
      var cur2 = new Date(y, m-1, d);
      var s2 = new Date(_calStart.y, _calStart.m-1, _calStart.d);
      if (cur2.getTime() === s2.getTime()) cls += ' start';
    }
    h += '<div class="'+cls+'" data-y="'+y+'" data-m="'+m+'" data-d="'+d+'" onclick="_calPick('+y+','+m+','+d+');return false">'+d+'</div>';
  }
  h += '</div>';
  h += '<div style="text-align:center;padding:6px 0 0"><button class="cal-nav" style="font-size:.55rem" onclick="_calStart=null;_calEnd=null;_calUpdateHighlights();_calUpdateInfo();return false">⟳ 重置日期</button></div>';
  h += '</div>';
  return h;
}
function _calNav(dir) {
  _calMonth += dir; if (_calMonth > 12) { _calMonth = 1; _calYear++; } if (_calMonth < 1) { _calMonth = 12; _calYear--; }
  // 翻月需要重建日历格子（月份变了），但只换日历 wrap 的 innerHTML
  var wrap = document.querySelector('.cal-wrap');
  if (wrap) wrap.outerHTML = _renderMiniCalendar();
}
function _calPick(y, m, d) {
  if (!_calStart || (_calStart && _calEnd)) { _calStart = {y:y, m:m, d:d}; _calEnd = null; }
  else { var cur = new Date(y, m-1, d); var s = new Date(_calStart.y, _calStart.m-1, _calStart.d);
    if (cur < s) { _calStart = {y:y, m:m, d:d}; _calEnd = null; }
    else { _calEnd = {y:y, m:m, d:d}; } }
  // 纯 DOM 更新，零 innerHTML
  _calUpdateHighlights();
  _calUpdateInfo();
}
function _calUpdateHighlights() {
  var grid = document.querySelector('.cal-grid'); if (!grid) return;
  var days = grid.querySelectorAll('.cal-day:not(.other)');
  days.forEach(function(el){
    el.classList.remove('start','end','range');
    if (!_calStart) return;
    var y = parseInt(el.getAttribute('data-y')), m = parseInt(el.getAttribute('data-m')), d = parseInt(el.getAttribute('data-d'));
    var cur = new Date(y, m-1, d);
    var s = new Date(_calStart.y, _calStart.m-1, _calStart.d);
    if (cur.getTime() === s.getTime()) el.classList.add('start');
    if (_calEnd) {
      var e = new Date(_calEnd.y, _calEnd.m-1, _calEnd.d);
      if (cur.getTime() === e.getTime()) el.classList.add('end');
      else if (cur > s && cur < e) el.classList.add('range');
    }
  });
}
function _calUpdateInfo() {
  var rows = document.querySelectorAll('.ci-info-row b');
  if (rows[0]) rows[0].textContent = _calStart ? _calStart.y+'-'+String(_calStart.m).padStart(2,'0')+'-'+String(_calStart.d).padStart(2,'0') : '点击日历选择';
  if (rows[1]) rows[1].textContent = _calEnd ? _calEnd.y+'-'+String(_calEnd.m).padStart(2,'0')+'-'+String(_calEnd.d).padStart(2,'0') : '再次点击选择退房';
  var totalEl = document.querySelector('.ci-total');
  var confirmBtn = document.querySelector('.ci-btn.go');
  if (_selectedBed) {
    var room = (_ml().accommodations||{})[_selectedBed.room];
    var ppd = room ? room.pricePerBed||20 : 20;
    var td = (_calStart && _calEnd) ? Math.ceil((new Date(_calEnd.y, _calEnd.m-1, _calEnd.d) - new Date(_calStart.y, _calStart.m-1, _calStart.d)) / 86400000) + 1 : 0;
    if (totalEl) {
      if (td > 0) { totalEl.textContent = '💵 '+td+'天 × '+ppd+'NT = '+(td*ppd)+' NT'; totalEl.style.display = 'block'; }
      else totalEl.style.display = 'none';
    }
    if (confirmBtn) {
      if (td > 0) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; confirmBtn.style.cursor = 'pointer'; }
      else { confirmBtn.disabled = true; confirmBtn.style.opacity = '.5'; confirmBtn.style.cursor = 'default'; }
    }
  }
}
function _confirmCheckin() {
  if (!_calStart || !_calEnd || !_selectedBed) return;
  var accs = _ml().accommodations || {};
  var room = accs[_selectedBed.room]; if (!room) return;
  if (!room.tenants) room.tenants = [];
  if (room.tenants.find(function(t){return t.bed===_selectedBed.bed;})) { if (window.Game&&Game.toast) Game.toast('该床位已被占用'); return; }
  var checkIn = String(_calStart.m).padStart(2,'0')+'/'+String(_calStart.d).padStart(2,'0');
  var checkOut = String(_calEnd.m).padStart(2,'0')+'/'+String(_calEnd.d).padStart(2,'0');
  var totalD = Math.ceil((new Date(_calEnd.y,_calEnd.m-1,_calEnd.d)-new Date(_calStart.y,_calStart.m-1,_calStart.d))/86400000)+1;
  var totalP = totalD * room.pricePerBed;
  // 检查是否已有入住（换房场景）
  var me = _me(), oldRoom = null, oldBed = null;
  Object.keys(accs).forEach(function(k){
    var rr = accs[k]; if(!rr.tenants)return;
    var idx = rr.tenants.findIndex(function(t){return t.name===me;});
    if(idx>=0){ oldRoom = rr; oldBed = rr.tenants[idx]; }
  });
  var isSwitch = !!oldRoom;
  var confirmMsg = isSwitch
    ? '🏠 换房确认\n\n从 '+oldRoom.label+' 床'+oldBed.bed+' → '+room.label+' 床'+_selectedBed.bed+'\n'+checkIn+' → '+checkOut+' · '+totalD+'天 · '+totalP+' NT\n\n旧房间欠费将自动结算'
    : '📜 签署公约并入住？\n\n'+checkIn+' → '+checkOut+' · '+totalD+'天 · '+totalP+' NT\n\n入住即表示同意遵守社区公约';

  var doCheckin = function() {
    // 移除旧房间的入住记录
    if (oldRoom && oldBed) {
      var oidx = oldRoom.tenants.indexOf(oldBed);
      if (oidx >= 0) oldRoom.tenants.splice(oidx, 1);
    }
    room.tenants.push({ name:me, bed:_selectedBed.bed, checkIn:checkIn, checkOut:checkOut });
    if (window.AppData) AppData._saveShared(true);
    if (typeof API !== 'undefined' && API.token) {
      API.request('POST', '/api/accommodation/checkin', { room_id: _selectedBed.room, bed_num: _selectedBed.bed }).catch(function(e){console.warn('[checkin] sync failed',e)});
    }
    if (window.Game&&Game.toast) Game.toast(isSwitch?'已换房到 '+room.label+' 床'+_selectedBed.bed:'已入住 '+room.label+' 床'+_selectedBed.bed+' · '+room.pricePerBed+'NT/天');
    if (typeof _completeNewbieQuest === 'function') _completeNewbieQuest(me, 'sign_covenant');
    if (typeof changeUserRole === 'function' && !isSwitch) changeUserRole(me, 'npc');
    _showCheckinCard = false; _selectedBed = null; _expandedRoom = null; _calStart = null; _calEnd = null;
    var s = document.querySelector('.mgmt-sheet'); if (s) s.remove();
    // 刷新角色HUD + 如果在全貌页则重绘卡片室/校核室入口
    if (typeof refreshUserUI === 'function') refreshUserUI();
    var b = getBuildings()[currentIdx];
    if (b && b.id === 'info') renderInfoPage(); else render();
    _refreshTopBar();
  };
  if (typeof showConfirm === 'function') {
    showConfirm(confirmMsg, doCheckin);
    return;
  }
  if (!confirm(confirmMsg)) return;
  doCheckin();
}

function _renderCheckinTip(room) {
  var now = new Date(), m = now.getMonth() + 1;
  var season = (m >= 3 && m <= 5) ? '春' : (m >= 6 && m <= 8) ? '夏' : (m >= 9 && m <= 11) ? '秋' : '冬';
  var tips = [];
  if (room.ac === '无') tips.push(season==='夏'?'A室没有空调，最近天热记得带风扇～':season==='冬'?'A室冬天多盖一床被子哦～':'A室注意通风哦～');
  if (room.pricePerBed >= 50) tips.push('这是单间大床房，适合长期居住，安静舒适～');
  if (room.beds >= 4) tips.push('多人间热闹，适合短期活动和团队住宿～');
  if (season === '夏') tips.push('夏天山里蚊虫多，记得带驱蚊水和清凉油！');
  if (season === '冬') tips.push('冬天取暖请用热水袋，房间禁止明火和电热毯哦～');
  if (season === '春') tips.push('春天花开正好，窗外景色很美，适合早起散步～');
  if (season === '秋') tips.push('秋天干燥，多喝水，注意防火防盗～');
  if (now.getDay() === 5 || now.getDay() === 6) tips.push('周末房源紧张，确认后尽快付款锁定床位～');
  if (!tips.length) tips.push('欢迎入住南塘云村！有任何需要找社区管理员～');
  var tip = tips[Math.floor(Math.random() * tips.length)];

  var adminSeed = 'nantang_admin';
  var users = (typeof getUsers === 'function' ? getUsers() : {}) || {};
  var adminUser = null;
  Object.keys(users).forEach(function(k){ if (users[k].role === 'admin' && (!adminUser || (users[k].created||'99') < (adminUser.created||'99'))) adminUser = users[k]; });
  if (adminUser) adminSeed = adminUser.avatar_seed || adminUser.name || adminSeed;

  var h = '<div class="ci-tip">';
  h += '<div class="ci-tip-avatar">'+avatarImg(adminSeed, 32)+'</div>';
  h += '<div class="ci-tip-text"><strong>南塘管家</strong><br>💬 '+tip+'</div>';
  h += '</div>';
  return h;
}

function _addRoomItem(roomId) {
  var accs = _ml().accommodations || {}; var room = accs[roomId]; if(!room) return;
  var item = prompt('添加房间物品（如：风扇、毯子、蚊香）：'); if(!item||!item.trim()) return;
  if(!room.items) room.items = [];
  room.items.push(item.trim());
  if(window.AppData) AppData._saveShared(true);
  _showStaySheet();
}

// ponytail: _applyStay 已替换为 _confirmCheckin + 入住弹窗日历 (2026-07-22)
function _toggleForm(type) {
  _mgmtFormType = (_mgmtFormType === type) ? '' : type;
  renderMgmtPanel(type);
}

/* ══════════════════════════════════════
   🧹 大扫除管理（我的视角）
   ══════════════════════════════════════ */
function renderCleaningPanel() {
  var rooms = _collectCleaningRooms();
  var p = _cleaningPricing();
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
  MGMT_DATA._save();
  renderMgmtPanel('cleaning');
}

function _saveMySelections() {
  var cnt = (MGMT_DATA.cleaning.mySelections||[]).length;
  MGMT_DATA._save();
  if (window.Game&&Game.toast) Game.toast('已保存，你选了 '+cnt+' 个打扫位置');
}

function _changeCleanDate() {
  var d = prompt('修改大扫除日期：', MGMT_DATA.cleaning.nextDate);
  if (d) { MGMT_DATA.cleaning.nextDate = d; MGMT_DATA._save(); renderMgmtPanel('cleaning'); }
}

function _submitMyCleaning() {
  var roomId = (_d('cqRoom')||{}).value;
  if (!roomId) { if (window.Game&&Game.toast) Game.toast('请选择房间'); return; }
  var rooms = _collectCleaningRooms();
  var rr = rooms.find(function(r) { return r.id===roomId; });
  var p = _cleaningPricing();
  var nt = rr ? ({red:p.dirty,yellow:p.warning,green:p.clean}[rr.status]||0) : 0;
  MGMT_DATA.cleaning.history.unshift({ date:_todayStr(), person:_me(), roomName:rr?rr.name:roomId, nt:nt, note:'' });
  MGMT_DATA._save();
  var sel = MGMT_DATA.cleaning.mySelections || [];
  var idx = sel.indexOf(roomId);
  if (idx>=0) sel.splice(idx,1);
  _mgmtFormType = '';
  if (window.Game&&Game.toast) Game.toast('完成 '+ (rr?rr.name:'') +' +'+nt+'NT');
  renderMgmtPanel('cleaning');
}

/* ══════════════════════════════════════
   🛏️ 住宿管理（我的视角）

function _submitMyStay() {
  var roomId = (_d('srRoom')||{}).value;
  var checkIn = (_d('srIn')||{}).value||_todayStr();
  var defOut = new Date(); defOut.setDate(defOut.getDate()+3); var checkOutDefault = (defOut.getMonth()+1)+'/'+defOut.getDate();
  var checkOut = (_d('srOut')||{}).value||checkOutDefault;
  if (!roomId) return;
  MGMT_DATA.stay.myRoom = roomId;
  MGMT_DATA.stay.myCheckIn = checkIn;
  MGMT_DATA.stay.myCheckOut = checkOut;
  var roomNum = roomId.replace('dorm','');
  MGMT_DATA.stay.history.unshift({
    date:_todayStr(), person:_me(), room:roomNum,
    detail:'入住 '+checkIn+'→'+checkOut
  });
  _mgmtFormType = '';
  MGMT_DATA._save();
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
    date:_todayStr(), person:_me(), room:roomNum, detail:'退房 ✓'
  });
  MGMT_DATA.stay.myRoom = null;
  MGMT_DATA.stay.myCheckIn = null;
  MGMT_DATA.stay.myCheckOut = null;
  MGMT_DATA._save();
  // 退房自动切云在线
  if (window.AppData) AppData.flipPresence(_me(), 'cloud', null);
  if (window.Game&&Game.toast) Game.toast('已退房 '+roomNum+'室 · 状态已切为云在线');
  renderMgmtPanel('stay');
}

/* ══════════════════════════════════════
   🌿 田地管理（我的视角）
   ══════════════════════════════════════ */
function renderFieldPanel() {
  var plots = getPlots();
  var actions = ['摘菜','浇水','播种','施肥','除草','收割','查看','其他'];
  var me = _me();
  var h = '';

  // ═══ 提醒 ═══
  h += '<div class="mgmt-reminders">';
  var warnings = plots.filter(function(p) { return p.status === 'warning'; });
  var available = plots.filter(function(p) { return p.crop === '—' || p.crop === '-' || !p.crop; });
  warnings.forEach(function(p) { h += '<div class="mr-item warn">' + (p.icon||'🌿') + ' ' + p.name + ' ' + p.crop + ' ' + p.harvest + ' 成熟（剩' + p.remain + '天）· 准备收割</div>'; });
  if (available.length) { h += '<div class="mr-item ok">🌱 ' + available.map(function(p){return p.name;}).join('、') + '空闲 · 可种秋季蔬菜</div>'; } else { h += '<div class="mr-item ok">全部地块已种植</div>'; }
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
    h += '<div class="mgmt-card'+( (p.note||'').indexOf('⚠')>=0?' selected':'')+'">';
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
  var plotId = (_d('fpPlot')||{}).value;
  var action = (_d('fpAction')||{}).value;
  var note = (_d('fpNote')||{}).value||'';
  var plots = getPlots();
  var plot = plots.find(function(p){return p.id===plotId;});
  MGMT_DATA.field.history.unshift({ date:_todayStr(), person:_me(), plotName:plot?plot.name:plotId, action:action, note:note });
  MGMT_DATA._save();
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
  var kw = _roomItems('kitchen').filter(function(i){return i.status==='warn';});
  var tw = _roomItems('toilet_r').filter(function(i){return i.status==='warn';});
  kw.forEach(function(i){ h += '<div class="mr-item warn">'+i.icon+' '+i.text+' · '+i.sub+' · 建议尽快处理</div>'; });
  tw.forEach(function(i){ h += '<div class="mr-item info">'+i.icon+' '+i.text+' · '+i.sub+' · 可考虑补货</div>'; });
  if (!kw.length && !tw.length) h += '<div class="mr-item ok">🟢 物品充足，无需补充</div>';
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

  // ═══ 章8: 冰箱分区 ═══
  h += '<div class="section-label">🧊 冰箱</div>';
  var zones = [
    { key:'fridge_upper', name:'🧊 冷藏上层', items:[] },
    { key:'fridge_lower', name:'❄️ 冷冻下层', items:[] },
    { key:'fridge_door', name:'🚪 门架', items:[] },
    { key:'storage', name:'📦 储物间', items:[] }
  ];
  var inv = (window.AppData && AppData._data.inventory && AppData._data.inventory.office) ? AppData._data.inventory.office : [];
  inv.forEach(function(it) {
    var z = zones.find(function(z){ return z.key === (it.location||''); }) || zones[3];
    z.items.push(it);
  });
  zones.forEach(function(z) {
    if (!z.items.length) return;
    h += '<div style="font-size:.62rem;font-weight:600;color:#5a6e5c;margin:4px 0 2px">'+z.name+' ('+z.items.length+'件)</div>';
    z.items.forEach(function(it) {
      var expireWarn = '';
      if (it.expiryDays && it.putDate) {
        var daysLeft = it.expiryDays - Math.floor((new Date() - new Date(it.putDate+'T00:00:00'))/86400000);
        if (daysLeft <= 0) expireWarn = ' <span style="color:var(--g-red)">⚠已过期</span>';
        else if (daysLeft <= 2) expireWarn = ' <span style="color:#c8892e">⚠'+daysLeft+'天</span>';
      }
      h += '<div class="item-row" style="font-size:.62rem"><span>📦</span> '+it.name+' · '+it.putBy+expireWarn+'</div>';
    });
  });
  // 其他空间的库存（快捷录入按建筑 id 归集；office 已在上面的冰箱分区展示）
  var invAll = (window.AppData && AppData._data.inventory) ? AppData._data.inventory : {};
  Object.keys(invAll).forEach(function(sid) {
    if (sid === 'office') return;
    var list = (invAll[sid]||[]).filter(function(it){ return it.status === 'fresh'; });
    if (!list.length) return;
    h += '<div style="font-size:.62rem;font-weight:600;color:#5a6e5c;margin:4px 0 2px">📍 '+sid+' ('+list.length+'件)</div>';
    list.forEach(function(it) {
      h += '<div class="item-row" style="font-size:.62rem"><span>📦</span> '+it.name+' · '+(it.putBy||'')+' · '+(it.location||'')+'</div>';
    });
  });
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
  var action = (_d('kpAction')||{}).value;
  var item = (_d('kpItem')||{}).value;
  if (!item) { if (window.Game&&Game.toast) Game.toast('请输入物品名'); return; }
  var location = (_d('kpLoc')||{}).value||'';
  MGMT_DATA.kitchen.history.unshift({ date:_todayStr(), person:_me(), action:action, item:item, location:location });
  MGMT_DATA._save();
  _mgmtFormType = '';
  // Step 2: 同步到 AppData 持久存储
  if (window.Game&&Game.toast) Game.toast(action+' '+item);
  _syncItemToAppData(action, item, location);
  renderMgmtPanel('kitchen');
}
// Step 2: 物品操作同步到 AppData + NT 奖励（skipVerify=true 时只同步库存，校核记录由调用方写）
function _syncItemToAppData(action, itemName, location, skipVerify) {
  if (!window.AppData) return;
  var inv = AppData._data.inventory;
  var spaceId = (curBuilding()||{}).id || 'unknown';
  if (!inv[spaceId]) inv[spaceId] = [];
  if (action === '放入物品') {
    var cfg = _mlConfig();
    inv[spaceId].push({ name: itemName, location: location, putBy: _me(), putDate: (typeof Clock!=='undefined'?Clock.today():''), expiryDays: cfg.item_expiry_days||5, status: 'fresh' });
  } else if (action === '取出/消耗') {
    var found = false;
    for (var i = inv[spaceId].length-1; i >= 0; i--) {
      if (inv[spaceId][i].name === itemName && inv[spaceId][i].status === 'fresh') {
        inv[spaceId][i].status = 'consumed'; inv[spaceId][i].consumedBy = _me(); found = true; break;
      }
    }
    if (!found) inv[spaceId].push({ name: itemName, location: location, putBy: _me(), putDate: (typeof Clock!=='undefined'?Clock.today():''), status: 'consumed', consumedBy: _me() });
  }
  AppData._save(true);
  // 校核制：物品操作进入待校核队列（skipVerify 时跳过，由调用方自行记录，避免一次动作双记）
  if (action === '放入物品') {
    var cfg2 = _mlConfig();
    var stockInNT = (cfg2.nt_rewards&&cfg2.nt_rewards.stock_in) ? cfg2.nt_rewards.stock_in : 2;
    if (!skipVerify && window.AppData) AppData.addVerification('stock_in', _me(), '放入 '+itemName, { space: spaceId, item: itemName }, stockInNT, 1);
    if (typeof addJournal === 'function') addJournal(_me(), 'stock_in', '放入 '+itemName, { space: spaceId, linkedItems: [itemName] });
  } else if (action === '取出/消耗') {
    var stockOutNT = (_mlConfig().nt_rewards&&_mlConfig().nt_rewards.stock_out) ? _mlConfig().nt_rewards.stock_out : 1;
    if (!skipVerify && window.AppData) AppData.addVerification('stock_out', _me(), '消耗 '+itemName, { space: spaceId, item: itemName }, stockOutNT, 1);
  }
}

// ═══ Step 3: 脏污度系统 ═══
function _dirtinessRates() {
  var cfg = _mlConfig();
  if (cfg.dirtiness_rates && Object.keys(cfg.dirtiness_rates).length) return cfg.dirtiness_rates;
  if (window.AppData && AppData._data.map_locations && AppData._data.map_locations.config && AppData._data.map_locations.config.dirtiness_rates) {
    return AppData._data.map_locations.config.dirtiness_rates;
  }
  return { bathroom:15, kitchen:10, hallway:8, studio:8, bedroom:5, laundry:5, storage:3, outdoor:2, field:0 };
}
function _cleaningPricing() {
  return (_mlConfig().cleaning_pricing) || MGMT_DATA.cleaning.pricing;
}
function _getSpaceType(buildingId) {
  var b = getBuildings().find(function(x){ return x.id === buildingId; });
  if (!b) return 'bedroom';
  if (b.id === 'toilet_b') return 'bathroom';
  if (b.id === 'office') return 'kitchen'; // 含厨房
  if (b.id === 'study') return 'bedroom';
  if (b.id === 'field') return 'field';
  if (b.id === 'stage' || b.id === 'plaza') return 'outdoor';
  return 'hallway';
}
function _growDirtiness() {
  if (!window.AppData) return;
  var cl = AppData._data.cleaning;
  cl.spaces = cl.spaces || {}; cl.log = cl.log || [];
  var today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
  if (cl.lastCheckDate === today) return;
  var lastD = cl.lastCheckDate ? new Date(cl.lastCheckDate + 'T00:00:00') : new Date(today + 'T00:00:00');
  var todayD = new Date(today + 'T00:00:00');
  var daysPassed = Math.max(0, Math.floor((todayD - lastD) / 86400000));
  if (daysPassed <= 0) { cl.lastCheckDate = today; return; }
  // 对已存在的空间增长脏污度
  var blds = getBuildings();
  blds.forEach(function(b) {
    if (b.id === 'info' || b.id === 'gate_a' || b.id === 'parking') return;
    if (!cl.spaces[b.id]) {
      var rate = _dirtinessRates()[_getSpaceType(b.id)] || 5;
      cl.spaces[b.id] = { dirtiness: Math.min(100, rate * daysPassed), lastCleaned: '', cleanedBy: '', dailyGrowthBase: rate };
    } else {
      cl.spaces[b.id].dirtiness = Math.min(100, cl.spaces[b.id].dirtiness + cl.spaces[b.id].dailyGrowthBase * daysPassed);
    }
  });
  cl.lastCheckDate = today;
  AppData._save();
}
function _getDirtinessStatus(d) {
  if (d <= 30) return 'green';
  if (d <= 60) return 'yellow';
  if (d <= 80) return 'red';
  return 'urgent';
}
function _getDirtinessEmoji(d) {
  if (d <= 30) return '🟢';
  if (d <= 60) return '🟡';
  if (d <= 80) return '🔴';
  return '🚨';
}

// ═══ Step 3: 打扫操作 ═══
function _doCleaning(spaceId) {
  if (!window.AppData) return;
  var cl = AppData._data.cleaning;
  if (!cl.spaces[spaceId]) return;
  var sp = cl.spaces[spaceId];
  if (sp.dirtiness < 30) { if (window.Game&&Game.toast) Game.toast('已经很干净了，不需要打扫'); return; }
  // 复议制：不能自己复议自己上次的打扫
  var me = _me();
  if (sp.cleanedBy === me && sp.dirtiness === 0) { if (window.Game&&Game.toast) Game.toast('上次是你打扫的，需要其他人复议'); return; }
  // 章2: 维护者奖励 — 连续3次<30%打扫
  var prevDirtiness = sp.dirtiness;
  var streakKey = 'cleanStreak_'+me+'_'+spaceId;
  var streak = (parseInt(safeStorage ? safeStorage.getItem(streakKey) : localStorage.getItem(streakKey), 10) || 0);
  if (prevDirtiness < 30) { streak++; } else { streak = 0; }
  if (streak >= 3) {
    if (window.NT) { try { NT.getUser(me).experienceValue += (_mlConfig().maintenance_xp || 30); } catch(e) {} }
    if (window.AppData) { var u = AppData._data.users[me] || {}; u.badges = u.badges || []; u.badges.push(_mlConfig().maintenance_badge || '🧹整洁守护者'); }
    if (window.Game&&Game.toast) Game.toast('🏆 连续3次维护！获得 '+(_mlConfig().maintenance_badge||'🧹整洁守护者')+' +'+(_mlConfig().maintenance_xp||30)+' XP');
    streak = 0;
  }
  try { (safeStorage || localStorage).setItem(streakKey, streak); } catch(e) {}
  sp.dirtiness = 0;
  sp.lastCleaned = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
  sp.cleanedBy = me;
  (cl.log = cl.log || []).push({ space: spaceId, cleanedBy: me, date: sp.lastCleaned, reviewedBy: '', note: '' });
  // 校核制：打扫动作进入待校核队列，需另一人校核后 NT 才发放
  var st2 = _getDirtinessStatus(prevDirtiness);
  var prices = _cleaningPricing();
  var cleanReward = (st2==='red'||st2==='urgent') ? prices.dirty : st2==='yellow' ? prices.warning : prices.clean;
  if (window.AppData) AppData.addVerification('cleaning', me, '打扫了 '+spaceId, { space: spaceId }, cleanReward, Math.ceil(cleanReward/5));
  // Step 5: 大扫除触发 CV 解冻 + 新手任务
  if (typeof _unfreezeCV === 'function') _unfreezeCV(me);
  if (typeof _completeNewbieQuest === 'function') _completeNewbieQuest(me, 'join_cleaning');
  // Step 6: 时间线记录
  if (typeof addJournal === 'function') addJournal(me, 'cleaning', '打扫了 '+spaceId, { space: spaceId });
  if (window.Game&&Game.toast) Game.toast('打扫完成，等待校核 (+'+cleanReward+' NT)');
  AppData._save();
  render();
}

// ═══ Step 2: 过期检查 ═══
function _getExpiryAlerts() {
  var alerts = [];
  if (!window.AppData) return alerts;
  var today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
  var inv = AppData._data.inventory || {};
  Object.keys(inv).forEach(function(spaceId) {
    (inv[spaceId]||[]).forEach(function(it) {
      if (it.status !== 'fresh' || !it.expiryDays) return;
      var putD = new Date(it.putDate + 'T00:00:00');
      var expD = new Date(putD.getTime() + it.expiryDays * 86400000);
      var daysLeft = Math.floor((expD - new Date(today + 'T00:00:00')) / 86400000);
      if (daysLeft <= 0) alerts.push({ space: spaceId, item: it.name, level: 'expired', text: it.name+' 已过期' });
      else if (daysLeft <= 1) alerts.push({ space: spaceId, item: it.name, level: 'soon', text: it.name+' 还剩1天' });
      else if (daysLeft <= 3) alerts.push({ space: spaceId, item: it.name, level: 'note', text: it.name+' '+daysLeft+'天后过期' });
    });
  });
  return alerts;
}

// ═══ B.3 Map 接口 ═══
window.VillageMap = {

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
    goTo(currentIdx);
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
function _initMap(){
  try{
    // F22: 移除加载骨架
    var sk = document.getElementById('scrollSkeleton'); if (sk) sk.remove();
    _unbindEvents(); // R3: 防止重复绑定事件监听
    // 同窗运行，直接用 Game.getUser()
    var u = (window.Game && Game.getUser) ? Game.getUser() : null;
    if (u && u.name) {
        var avi = document.getElementById('ubAvatarImg');
        if (avi && u.avatar_url) {
          avi.src = u.avatar_url;
          avi.onerror = function(){ this.style.display='none'; this.parentElement.textContent='👤'; };
        }
        var nameEl = document.getElementById('ubName');
        if (nameEl) nameEl.textContent = u.name;
        var roleEl = document.getElementById('ubRole');
        if (roleEl && u.role) {
          var roleMap = { admin:'🧙 管理员', builder:'🧱 共建者', adventurer:'⚔️ 冒险者', npc:'👥 在地伙伴', visitor:'🏕️ 云村民' };
          roleEl.textContent = (roleMap[u.role] || u.role) + ' · 南塘云村';
        }
      }
    // 在线翻牌提醒
    if (window.AppData && u && u.name) {
      var reminder = AppData.checkPresenceReminder(u.name);
      if (reminder && reminder.neverFlipped && window.Game&&Game.toast) Game.toast('🃏 欢迎！设置你的在线状态吧~');
      else if (reminder && reminder.hours > 0 && window.Game&&Game.toast) Game.toast('你已经 '+reminder.hours+' 小时没有更新状态了，翻一下牌吧~');
    }
    // Step 3: 脏污度自动增长 + 状态灯更新
    _growDirtiness();
    // 章7: 日常清理容器到期检查
    _checkDailyContainers();
    if(!_mapContainer){currentIdx=4;currentFloor=0;selectedRoomId=null;overviewOpen=false;_bindEvents();}
    else { currentIdx=4;currentFloor=0;selectedRoomId=null;overviewOpen=false; }
    goTo(4);
    if(typeof refreshUserUI==='function') refreshUserUI();
    _refreshTopBar();
  }catch(e){console.error('[Map] init failed:',e);if(window.Game&&Game.toast) Game.toast('地图加载失败，请刷新');}
}
// 刷新顶栏统计数字——从真实数据源读取
function _refreshTopBar() {
  var dateEl = document.getElementById('ubStatDate');
  var stayEl = document.getElementById('ubStatStay');
  var peopleEl = document.getElementById('ubStatPeople');
  var tasksEl = document.getElementById('ubStatTasks');
  if (dateEl) dateEl.textContent = '📅 ' + new Date().toISOString().slice(0,10);
  if (stayEl) {
    var accs = (AppData._data.map_locations && AppData._data.map_locations.accommodations) || {};
    var stayCount = 0;
    Object.values(accs).forEach(function(r){ if(r.tenants) stayCount += r.tenants.length; });
    stayEl.textContent = '🛏️ ' + stayCount;
  }
  if (peopleEl) {
    var p = (AppData._data && AppData._data.presence) || {};
    var onsiteCount = Object.values(p).filter(function(x){return x.status==='onsite';}).length;
    peopleEl.textContent = '👤 ' + onsiteCount;
  }
  if (tasksEl) {
    var tasks = AppData._data.tasks || {};
    var openCount = Object.values(tasks).filter(function(t){return t.status==='进行中';}).length;
    tasksEl.textContent = '📋 ' + openCount + '待领';
  }
}

// Phase 2: 房间物品编辑器（管理员）
function _editRoomItem(roomId) {
  var items = _roomItems(roomId);
  var list = items.map(function(i,idx){ return idx+'. '+i.icon+' '+i.text+' ['+i.status+']'; }).join('\n');
  var action = prompt('✏️ 编辑「'+roomId+'」的物品\n\n当前物品：\n'+list+'\n\n输入: +图标 名称 状态 来添加\n输入: -编号 来删除\n或点取消关闭');
  if (!action) return;
  var ml = (window.AppData&&AppData._data.map_locations) ? AppData._data.map_locations : null;
  if (!ml) return;
  ml.state = ml.state || {}; ml.state.room_items = ml.state.room_items || [];
  if (action.charAt(0)==='-') {
    var idx = parseInt(action.slice(1),10);
    // 找到该房间的第 idx 个物品在全局数组中的位置
    var roomItems = ml.state.room_items, found = 0;
    for (var i = roomItems.length-1; i >= 0; i--) { if (roomItems[i].room === roomId) { if (found === idx) { roomItems.splice(i,1); break; } found++; } }
  } else if (action.charAt(0)==='+') {
    var parts = action.slice(1).trim().split(' ');
    var text, status;
    if (parts.length >= 3) { text = parts.slice(1,-1).join(' '); status = parts[parts.length-1]; }
    else if (parts.length === 2) { text = parts[1]; status = 'clean'; }
    else { text = '新物品'; status = 'clean'; }
    ml.state.room_items.push({ room: roomId, icon: parts[0]||'📦', text: text, sub: '', status: status });
  }
  if (window.AppData) AppData._saveShared();
  render();  // 刷新房间详情
}
// ═══ 在线翻牌 ═══
function _flipMyPresence() {
  var statuses = [
    { val:'onsite', label:'🟢 在地', desc:'我在南塘，选个位置' },
    { val:'cloud', label:'☁️ 云在线', desc:'我离开了南塘' },
    { val:'out', label:'🔵 外出', desc:'暂时外出，很快回来' }
  ];
  var me = _me();
  var cur = (window.AppData && AppData._data.presence && AppData._data.presence[me]) ? AppData._data.presence[me] : {};
  var curStatus = cur.status || 'cloud';
  var opts = statuses.map(function(s){ return '<button class="ma-btn '+(curStatus===s.val?'primary':'secondary')+'" style="flex:1;font-size:.65rem;padding:6px 4px" onclick="event.stopPropagation();_doFlipSelf(\''+s.val+'\')">'+s.label+'<br><span style="font-size:.5rem;opacity:.7">'+s.desc+'</span></button>'; }).join('');
  var locSelect = '<select id="flipLocSelect" style="width:100%;padding:6px;border:1px solid var(--green-border);border-radius:6px;font-size:.65rem;margin-top:4px"><option value="">选位置（可选）</option><option value="kitchen">🍳 厨房</option><option value="studio">🎨 画室</option><option value="field">🌿 田地</option><option value="study">📚 书房</option><option value="office">💼 办公室</option><option value="stage">🎭 戏台</option><option value="plaza">🏛️ 广场</option></select>';
  var html = '<div style="text-align:center"><div style="font-weight:700;font-size:.75rem;margin-bottom:8px">🃏 '+me+' 的状态</div><div style="display:flex;gap:4px;margin-bottom:6px">'+opts+'</div>'+locSelect+'<div style="display:flex;gap:6px;margin-top:8px"><button class="btn-sm sec" style=flex:1 onclick="event.stopPropagation();document.querySelector(\'.flip-popup\').remove()">取消</button></div></div>';
  var el = document.createElement('div'); el.className = 'flip-popup';
  el.style.cssText = 'position:fixed;inset:0;z-index:260;display:flex;align-items:center;justify-content:center';
  el.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.4)" onclick="event.stopPropagation();this.parentElement.remove()"></div><div style="position:relative;background:#fff;border-radius:14px;padding:16px;width:300px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,.25)">'+html+'</div>';
  document.body.appendChild(el);
}
function _doFlipSelf(status) {
  var me = _me(); if (!status) return;
  var loc = (document.getElementById('flipLocSelect')||{}).value||'';
  if (window.AppData) AppData.flipPresence(me, status, loc||null);
  var el = document.querySelector('.flip-popup'); if (el) el.remove();
  var labels = { onsite:'🟢 已更新为在地', cloud:'☁️ 已更新为云在线', out:'🔵 已更新为外出' };
  if (window.Game&&Game.toast) Game.toast(labels[status]||'状态已更新');
  render();
}
function _showFlipOther(targetName) {
  if (!window.AppData) return;
  var _cb = function(){
    var result = AppData.flipForOther(targetName, 'cloud', _me());
    if (!result || !result.ok) { if (window.Game&&Game.toast) Game.toast(result?result.error:'翻牌失败','warn'); return; }
    if (window.Game&&Game.toast) Game.toast('已帮 '+targetName+' 翻牌 (-1 NT)');
    render();
  };
  if (window.Game && Game.confirm) {
    Game.confirm('帮 '+targetName+' 翻牌？', '帮ta更新在线状态，将扣你 1 NT 作为提醒代价。', _cb);
  } else {
    if (confirm('帮 '+targetName+' 翻牌？将扣你 1 NT 作为提醒代价。')) _cb();
  }
}
// ═══ 铃铛面板（校核 + 新手 + 整洁度）═══
function _openVerificationPanel() {
  var me = _me();
  var h = '';
  // ── 新手引导 ──
  // E3.4: 新手引导统一走 data.js NEWBIE_QUESTS
  var steps = (typeof NEWBIE_QUESTS !== 'undefined') ? NEWBIE_QUESTS : [];
  var quests = (window.AppData && AppData._data.newbieQuests && AppData._data.newbieQuests[me]) || {};
  var doneCount = steps.filter(function(s){ return quests[s.id] && quests[s.id].done; }).length;
  if (steps.length && doneCount < steps.length) {
    var pct = Math.round(doneCount / steps.length * 100);
    h += '<div style="background:#f0f8f0;border-radius:8px;padding:8px 10px;margin-bottom:8px;cursor:pointer" onclick="var el=document.querySelector(\'.vfy-popup\');if(el)el.remove();alert(\'新手引导在首页下方查看\')"><div style="font-weight:700;font-size:.7rem">🌱 新手引导 ('+doneCount+'/'+steps.length+')</div><div style="height:4px;background:#ddd;border-radius:2px;margin:4px 0"><div style="height:100%;width:'+pct+'%;background:var(--green-primary);border-radius:2px"></div></div><div style="font-size:.55rem;color:#999">点击查看详情</div></div>';
  }
  // ── 整洁度 ──
  var cl = (window.AppData && AppData._data.cleaning) ? AppData._data.cleaning : null;
  var dirtyList = [];
  if (cl && cl.spaces) {
    Object.keys(cl.spaces).forEach(function(sid) {
      var d = cl.spaces[sid].dirtiness || 0;
      if (d >= 30) dirtyList.push({ id: sid, d: d, icon: d>=60?'🔴':d>=30?'🟡':'🟢' });
    });
  }
  if (dirtyList.length) {
    h += '<div style="margin-bottom:8px"><div style="font-weight:700;font-size:.7rem;margin-bottom:4px">🧹 需要关注</div>';
    dirtyList.sort(function(a,b){ return b.d - a.d; }).forEach(function(s){
      h += '<div style="font-size:.6rem;padding:2px 0;color:'+(s.d>=60?'var(--g-red)':'#c8892e')+'">'+s.icon+' '+s.id+' · '+s.d+'%</div>';
    });
    h += '</div>';
  }
  // ── 待校核 ──
  var vfys = (window.AppData && AppData._data.pendingVerifications) ? AppData._data.pendingVerifications : [];
  var pending = vfys.filter(function(v){ return v.status === 'pending'; });
  h += '<div style="font-weight:700;font-size:.72rem;margin-bottom:6px">📋 待校核 ('+pending.length+')</div>';
  if (!pending.length) { h += '<div style="text-align:center;color:#999;padding:8px;font-size:.62rem">暂无</div>'; }
  else pending.slice(0,5).forEach(function(v){
    var icons = { cleaning:'🧹', stock_in:'📦', stock_out:'🗑', store_in:'🏬', field_harvest:'🌿', field_action:'🌿', daily_container:'🗑️', quest:'📋', stay:'🛏️', labor_report:'📝', other:'⭐' };
    var isMe = v.doer === me || v.doer === null;
    h += '<div style="background:#fafaf5;border:1px solid #e0e0e0;border-radius:6px;padding:6px 8px;margin-bottom:4px;font-size:.62rem">';
    h += '<div style="display:flex;justify-content:space-between"><b>'+icons[v.type]+' '+(v.doer||'系统')+'</b><span style="color:var(--green-primary)">+'+v.ntAmount+' NT</span></div>';
    h += '<div style="color:#999;font-size:.55rem">'+v.action+'</div>';
    if (!isMe) { h += '<button class="btn-sm pri" style="font-size:.55rem;padding:2px 6px;margin-top:2px" onclick="event.stopPropagation();_doVerify(\''+v.id+'\')">✓ 校核 +'+v.verifierReward+'NT</button>'; }
    else { h += '<div style="color:#999;font-size:.55rem">等待他人校核</div>'; }
    h += '</div>';
  });
  h += '<button class="btn-sm sec" style="width:100%;margin-top:6px;font-size:.6rem" onclick="var el=document.querySelector(\'.vfy-popup\');if(el)el.remove()">✕ 关闭</button>';
  var el = document.createElement('div'); el.className = 'vfy-popup';
  el.style.cssText = 'position:fixed;inset:0;z-index:260;display:flex;align-items:center;justify-content:center';
  el.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.4)" onclick="event.stopPropagation();this.parentElement.remove()"></div><div style="position:relative;background:#fff;border-radius:14px;padding:16px;width:340px;max-width:92vw;max-height:70vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.25)">'+h+'</div>';
  document.body.appendChild(el);
}
function _doVerify(vfyId) {
  var me = _me();
  if (!window.AppData) return;
  var result = AppData.verifyAction(vfyId, me);
  if (result && result.async) {
    // HTTP 模式：异步，禁用按钮等待服务端响应
    var btns = document.querySelectorAll('button[onclick*="_doVerify"]');
    btns.forEach(function(b){ b.disabled = true; b.textContent = '⏳ 处理中…'; });
    return;
  }
  if (!result || !result.ok) { if (window.Game&&Game.toast) Game.toast(result?result.error:'校核失败','warn'); return; }
  var el = document.querySelector('.vfy-popup'); if (el) el.remove();
  if (window.Game&&Game.toast) Game.toast('✅ 校核完成！');
  render();
}
// ══ 章5: 快捷录入 ══
function _openQuickSheet(title, bodyHTML) {
  var el = document.createElement('div'); el.className = 'quick-sheet';
  el.innerHTML = '<div class="quick-sheet__backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:260" onclick="this.parentElement.remove()"></div>'+
    '<div style="position:fixed;bottom:0;left:0;right:0;background:#fff;border-radius:16px 16px 0 0;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));max-height:65vh;overflow-y:auto;z-index:261;animation:spcPop .2s ease-out">'+
    '<div style="font-weight:700;font-size:.8rem;margin-bottom:10px">'+title+'</div>'+bodyHTML+'</div>';
  document.body.appendChild(el); return el;
}

// ── 厨房 ──
function _openKitchenQuick() {
  // E3.7: 权限门 — visitor 不能存取物品
  if (typeof userCan === 'function' && !userCan({role:(AppData.me()||{}).role||'visitor'}, 'isMember')) {
    if (window.Game&&Game.toast) Game.toast('入住后可用'); return;
  }
  var presets = [
    {n:'白菜',i:'🥬'},{n:'鸡蛋',i:'🥚'},{n:'猪肉',i:'🥩'},{n:'牛奶',i:'🥛'},
    {n:'大米',i:'🍚'},{n:'豆腐',i:'🫘'},{n:'调料',i:'🧂'},{n:'纸巾',i:'🧻'},
    {n:'洗洁精',i:'🧴'},{n:'垃圾袋',i:'🗑️'},{n:'食用油',i:'🫒'},{n:'面条',i:'🍜'},
    {n:'面包',i:'🍞'},{n:'水果',i:'🍎'},{n:'蔬菜',i:'🥦'},{n:'工具',i:'🔧'}
  ];
  var actions = [
    {a:'stock_in',l:'📥 放入冰箱',nt:2},
    {a:'stock_out',l:'📤 取出消耗',nt:1},
    {a:'store_in',l:'📦 存入仓库',nt:2}
  ];

  var body = '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:6px;font-weight:600">选物品：</div>';
  body += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px">';
  presets.forEach(function(p){
    body += '<div onclick="_selectKitchenItem(\''+p.n+'\',\''+p.i+'\')" class="qk-item-btn" style="padding:8px 4px;border:1px solid #d0d9ce;border-radius:8px;cursor:pointer;font-size:.62rem;text-align:center;background:#fff;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center">';
    body += '<div style="font-size:1.2rem;line-height:1">'+p.i+'</div>';
    body += '<div style="margin-top:1px">'+p.n+'</div>';
    body += '</div>';
  });
  body += '</div>';
  body += '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:4px;font-weight:600">选动作：</div>';
  body += '<div style="display:flex;gap:5px;margin-bottom:8px">';
  actions.forEach(function(a){
    body += '<div onclick="_doKitchenAction(\''+a.a+'\',\''+a.l+'\','+a.nt+')" class="qk-act-btn" style="flex:1;padding:8px 4px;border:1px solid #d0d9ce;border-radius:8px;cursor:pointer;font-size:.6rem;text-align:center;background:#fff;min-height:44px;display:flex;align-items:center;justify-content:center">'+a.l+'<br><span style="font-size:.5rem;color:#8a6a20">+'+a.nt+' NT</span></div>';
  });
  body += '</div>';
  body += '<div style="font-size:.55rem;color:#5a6e5c;margin-bottom:6px;background:#f8f8f8;padding:6px;border-radius:6px">已选：<span id="qkSelectedItem" style="color:#1d2e24;font-weight:600">—</span></div>';
  body += '<input id="qkItemNote" placeholder="备注（选填）：数量、位置…" style="width:100%;padding:8px;border:1px solid #d0d9ce;border-radius:8px;font-size:.68rem;margin-bottom:6px;background:#fff;box-sizing:border-box">';
  body += '<button class="quick-sheet__submit" onclick="_submitKitchenEntry()" style="width:100%;padding:10px;background:var(--green-primary);color:#fff;border:none;border-radius:10px;font-size:.7rem;font-weight:700;min-height:44px">✅ 确认</button>';
  _openQuickSheet('📦 放取物品', body);
  window._qkSelected = null;
}

function _selectKitchenItem(name, icon) {
  window._qkSelected = {name:name, icon:icon};
  // 高亮选中
  var btns = document.querySelectorAll('.qk-item-btn');
  btns.forEach(function(b){ b.style.borderColor='#d0d9ce'; b.style.background='#fff'; });
  if (event && event.target) {
    var btn = event.target.closest('.qk-item-btn');
    if (btn) { btn.style.borderColor='var(--green-primary)'; btn.style.background='#e8f0e8'; }
  }
  var sel = document.getElementById('qkSelectedItem');
  if (sel) sel.innerHTML = icon + ' ' + name;
}

function _doKitchenAction(action, label, nt) {
  window._qkAction = {action:action, label:label, nt:nt};
  var btns = document.querySelectorAll('.qk-act-btn');
  btns.forEach(function(b){ b.style.borderColor='#d0d9ce'; b.style.background='#fff'; });
  if (event && event.target) {
    var btn = event.target.closest('.qk-act-btn');
    if (btn) { btn.style.borderColor='var(--green-primary)'; btn.style.background='#e8f0e8'; }
  }
}
function _submitKitchenEntry() {
  if (typeof userCan === 'function' && !userCan({role:(AppData.me()||{}).role||'visitor'}, 'isMember')) {
    showToast('入住后可用（前往 🏠 住宿页面→入住）', 'warn'); return;
  }
  var sel = window._qkSelected;
  var act = window._qkAction;
  if (!sel) { showToast('请先选一个物品','warn'); return; }
  if (!act) { showToast('请选动作：放入/取出/存仓库','warn'); return; }
  var note = (document.getElementById('qkItemNote')||{}).value || '';
  var name = sel.icon + ' ' + sel.name;
  var fullNote = act.label + ' ' + name + (note ? ' · ' + note : '');
  if (window.AppData) {
    // act.action 是英文（stock_in/stock_out/store_in），_syncItemToAppData 吃中文
    var actionMap = { stock_in: '放入物品', stock_out: '取出/消耗', store_in: '放入物品' };
    // skipVerify=true：校核记录只由下面这条写，避免一次动作两条记录
    _syncItemToAppData(actionMap[act.action] || act.action, sel.name, ((curBuilding()||{}).id === 'study' ? 'study' : 'office'), true);
    AppData.addVerification(act.action, _me(), fullNote, { item: sel.name, action: act.action, space: ((curBuilding()||{}).id === 'study' ? 'study' : 'office') }, act.nt, 1);
  }
  _closeQuickSheet();
  showToast('✅ '+act.label+' '+name, 'ok');
}

// ── 田地 ──
function _openFarmQuick() {
  var actions = ['🌾收割','💧浇水','🌱种植','🪴施肥','🧹除草','👀查看'];
  var plots = getPlots();
  var body = '<div id="qfActions" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">'+actions.map(function(a){ return '<div class="quick-sheet__preset-btn" onclick="var s=this;var p=this.parentElement;var prev=p.querySelector(\'[data-selected]\');if(prev&&prev!==s){prev.removeAttribute(\'data-selected\');prev.style.background=\'\';prev.style.color=\'\'}if(s.hasAttribute(\'data-selected\')){s.removeAttribute(\'data-selected\');s.style.background=\'\';s.style.color=\'\'}else{s.setAttribute(\'data-selected\',\'1\');s.style.background=\'var(--green-primary)\';s.style.color=\'#fff\'}" style="padding:6px 10px;border:1px solid #d0d9ce;border-radius:8px;cursor:pointer;font-size:.65rem;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center">'+a+'</div>'; }).join('')+'</div>'+
    '<div id="qfPlots" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">'+plots.map(function(p){ return '<div class="quick-sheet__preset-btn" style="padding:6px 10px;border:1px solid #d0d9ce;border-radius:8px;cursor:pointer;font-size:.6rem" onclick="var s=this;var pa=this.parentElement;var prev=pa.querySelector(\'[data-selected]\');if(prev&&prev!==s){prev.removeAttribute(\'data-selected\');prev.style.background=\'\';prev.style.color=\'\'}if(s.hasAttribute(\'data-selected\')){s.removeAttribute(\'data-selected\');s.style.background=\'\';s.style.color=\'\'}else{s.setAttribute(\'data-selected\',\'1\');s.style.background=\'var(--green-primary)\';s.style.color=\'#fff\'}">'+p.icon+' '+p.name+'</div>'; }).join('')+'</div>'+
    '<input id="qfFarmNote" placeholder="备注（选填）" style="width:100%;padding:8px;border:1px solid #d0d9ce;border-radius:8px;font-size:.7rem;margin-bottom:6px">'+
    '<button class="quick-sheet__submit" onclick="_submitFarmEntry()" style="width:100%;padding:10px;background:var(--green-primary);color:#fff;border:none;border-radius:10px;font-size:.75rem;font-weight:700;min-height:44px">✓ 确认记录</button>';
  _openQuickSheet('🌿 农活记录', body);
}
function _submitFarmEntry() {
  // 读选中的动作 + 田块
  var actionBtn = document.querySelector('#qfActions .quick-sheet__preset-btn[data-selected]');
  var plotBtn = document.querySelector('#qfPlots .quick-sheet__preset-btn[data-selected]');
  var action = actionBtn ? actionBtn.textContent : '农活';
  var plot = plotBtn ? plotBtn.textContent : '';
  var note = (document.getElementById('qfFarmNote')||{}).value || '';
  var desc = action + (plot ? ' @'+plot : '') + (note ? ' · '+note : '');
  var pricing = _mlConfig().farming_pricing;
  var nt = action.indexOf('收割')>=0 ? pricing.harvest : action.indexOf('浇水')>=0||action.indexOf('种植')>=0 ? pricing.plant : 5;
  if (window.AppData) AppData.addVerification('field_action', _me(), desc, { action:action, plot:plot }, nt, Math.ceil(nt/5));
  _closeQuickSheet();
  _undoToast('field_action');
}

// ── 打扫 ──
function _openCleanQuick() {
  var spaces = [];
  var cl = (window.AppData && AppData._data.cleaning) ? AppData._data.cleaning : null;
  var blds = getBuildings();
  blds.forEach(function(b) {
    if (b.id === 'info' || b.id === 'gate_a' || b.id === 'parking') return;
    var d = (cl && cl.spaces && cl.spaces[b.id]) ? cl.spaces[b.id].dirtiness : 0;
    var st = d >= 60 ? '需处理' : d >= 30 ? '注意' : '整洁';
    var icon = d >= 60 ? '🔴' : d >= 30 ? '🟡' : '🟢';
    var nt = d >= 60 ? 20 : d >= 30 ? 15 : 5;
    spaces.push({ id: b.id, name: b.name, icon: b.icon, dirtiness: d, status: st, statusIcon: icon, nt: nt });
  });
  spaces.sort(function(a,b){ return b.dirtiness - a.dirtiness; });
  var body = '<div class="quick-sheet__card-grid" style="display:flex;flex-wrap:wrap;gap:4px">'+spaces.map(function(s){
    return '<div class="quick-sheet__preset-btn" data-id="'+s.id+'" data-dirtiness="'+s.dirtiness+'" style="flex:0 0 calc(33%-4px);padding:8px 6px;border:1px solid #d0d9ce;border-radius:8px;cursor:pointer;text-align:center;font-size:.6rem;min-height:44px" onclick="var ss=this;var p=this.parentElement;var prev=p.querySelector(\'[data-selected]\');if(prev&&prev!==ss){prev.removeAttribute(\'data-selected\');prev.style.border=\'1px solid #d0d9ce\'}if(ss.hasAttribute(\'data-selected\')){ss.removeAttribute(\'data-selected\');ss.style.border=\'1px solid #d0d9ce\'}else{ss.setAttribute(\'data-selected\',\'1\');ss.style.border=\'2px solid var(--green-primary)\'}">'+
      '<div>'+s.icon+'</div><div style="font-weight:600">'+s.name+'</div>'+
      '<div style="color:'+(s.dirtiness>=60?'var(--g-red)':s.dirtiness>=30?'#c8892e':'var(--green-primary)')+'">'+s.statusIcon+' '+s.status+' · +'+s.nt+' NT</div></div>';
  }).join('')+'</div>'+
    '<div style="font-size:.55rem;color:#999;margin:6px 0">🟢整洁 &lt;30% · 🟡注意 30-60% · 🔴需处理 ≥60%</div>'+
    '<button class="quick-sheet__submit" onclick="_submitCleanEntry()" style="width:100%;padding:10px;background:var(--green-primary);color:#fff;border:none;border-radius:10px;font-size:.75rem;font-weight:700;min-height:44px">✓ 确认打扫</button>';
  _openQuickSheet('🧹 快速打扫', body);
}
function _submitCleanEntry() {
  // E3.7: 权限门 — visitor 不能参与大扫除
  if (typeof userCan === 'function' && !userCan({role:(AppData.me()||{}).role||'visitor'}, 'isMember')) {
    showToast('入住后可用', 'warn'); return;
  }
  var selected = document.querySelector('.quick-sheet__card-grid .quick-sheet__preset-btn[data-selected]');
  var spaceName = selected ? (selected.querySelector('div:nth-child(2)')||{}).textContent : '未知空间';
  var spaceId = selected ? (selected.getAttribute('data-id')||'') : '';
  var dirtiness = parseInt(selected ? (selected.getAttribute('data-dirtiness')||'0') : '0', 10);
  var st = dirtiness >= 60 ? 'red' : dirtiness >= 30 ? 'yellow' : 'green';
  var prices = _cleaningPricing();
  var reward = st === 'red' ? prices.dirty : st === 'yellow' ? prices.warning : prices.clean;
  if (window.AppData) {
    // 防刷：每 3 天最多 N 次快速打扫（N = 在地成员数，至少 1）
    var _users = AppData._data.users || {};
    var onsiteN = Object.keys(_users).filter(function(un){ return isMemberByRole((_users[un]||{}).role); }).length;
    var maxPer3d = Math.max(1, onsiteN);
    var _today = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
    var _winStart = new Date(_today + 'T00:00:00').getTime() - 2*86400000;  // 3 天窗口（含今天）
    var recentN = ((AppData._data.cleaning||{}).log||[]).filter(function(l){ return l.cleanedBy === _me() && l.date && new Date(l.date + 'T00:00:00').getTime() >= _winStart; }).length;
    if (recentN >= maxPer3d) { showToast('打扫太频繁了：每 3 天最多 '+maxPer3d+' 次（按在地 '+maxPer3d+' 人计）','warn'); return; }
    AppData.addVerification('cleaning', _me(), '打扫了 '+spaceName, { space: spaceName }, reward, Math.ceil(reward/5));
    // 持久化：与 _doCleaning 一致的字段
    var cl = AppData._data.cleaning;
    var sp = (cl && cl.spaces) ? cl.spaces[spaceId] : null;
    if (sp) {
      var me = _me();
      sp.dirtiness = 0;
      sp.lastCleaned = (typeof Clock !== 'undefined' ? Clock.today() : new Date().toISOString().slice(0,10));
      sp.cleanedBy = me;
      (cl.log = cl.log || []).push({ space: spaceId, cleanedBy: me, date: sp.lastCleaned, reviewedBy: '', note: '' });
      AppData._save();
      if (typeof render === 'function') render();
    }
  }
  _closeQuickSheet();
  _undoToast('cleaning');
}

// ── 撤销 + 通用 ──
function _closeQuickSheet() {
  var sheet = document.querySelector('.quick-sheet');
  if (sheet) sheet.remove();
}
function _undoToast(type) {
  var toast = document.createElement('div'); toast.className = 'toast-undo';
  toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#2a4a30;color:#fff;padding:8px 20px;border-radius:20px;font-size:.75rem;z-index:9999;cursor:pointer';
  toast.innerHTML = '已记录 <span style="text-decoration:underline">撤销</span>';
  toast.onclick = function() {
    var vfys = (window.AppData && AppData._data.pendingVerifications) || [];
    for (var i = vfys.length-1; i >= 0; i--) {
      if (vfys[i].type === type && vfys[i].doer === _me() && vfys[i].status === 'pending') { vfys.splice(i,1); break; }
    }
    if (window.AppData) AppData._saveShared(true);
    if (window.Game && Game.toast) Game.toast('已撤销');
    toast.remove();
  };
  document.body.appendChild(toast);
  setTimeout(function(){ if (toast.parentNode) toast.remove(); }, 30000);
}

// F11: 统一建筑物初始化——写入 AppData，后续 getBuildings() 只读
(function _seedBuildings() {
  if (window.AppData && AppData._data && AppData._data.map_locations) {
    var ml = AppData._data.map_locations;
    if (!ml.buildings || !ml.buildings.length) {
      ml.buildings = HARDCODED_BUILDINGS;
      AppData._saveShared(true);
    }
  }
})();

// 由主应用 openMapPage() 主动调用 _initMap()，确保 Game/avatarURL 已就绪
