// ═══ Bridge: postMessage to parent ═══
// v2 — carousel sync fix
if(typeof _post==='undefined'){window._post=function(data){if(window.parent!==window)window.parent.postMessage(data,window.location.origin||'*')}}
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
  { id:'office',name:'社区大楼',icon:'🏢',meta:'3层·15间·🟢整洁',photo:'https://placehold.co/600x360/e8d8c0/8a7a60?text=办公楼',photoBg:'linear-gradient(160deg,#f0e8d8,#e0d4b8)',status:'green',summary:{cleanliness:'🟢',items:'',onsite:'',cleaning:'',alert:''},floors:{'1F':[{id:'community_hall',name:'社区大厅',icon:'🏛️',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'community_market',name:'社区超市',icon:'🛒',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'storage',name:'小仓库',icon:'📦',status:'green',sub:'',items:['农具（锄头、镰刀、铁锹等）'],people:[],cleaning:[]},{id:'kitchen',name:'厨房',icon:'🍳',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'public_office',name:'公共办公室',icon:'💼',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'toilet_r',name:'卫生间',icon:'🚻',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'backyard_corridor',name:'通往后院的走廊',icon:'🚶',status:'green',sub:'',items:['部分农具和物品'],people:[],cleaning:[]}],'2F':[{id:'studio',name:'画室',icon:'🎨',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'washroom',name:'洗浴室',icon:'🚿',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'farm_equipment',name:'阅览室（原农机室）',icon:'📖',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'biao_office',name:'标哥办公室',icon:'👔',status:'green',sub:'',items:[],people:[],cleaning:[]}],'3F':[{id:'rooftop',name:'天台',icon:'🌤️',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'laundry_room',name:'晾衣间',icon:'👕',status:'green',sub:'',items:[],people:[],cleaning:[]}]}},
  { id:'info',name:'南塘全貌',icon:'📍',meta:'10个空间',photo:'https://placehold.co/600x360/a0b8d0/4a6080?text=南塘全貌',photoBg:'linear-gradient(160deg,#d0dce8,#b0c8d8)',status:'green',summary:{isInfo:true},floors:{},plots:[]},
  { id:'study',name:'大地书房',icon:'🏯',meta:'3层·14间·🟢整洁',photo:'https://placehold.co/600x360/c8b898/6a5a40?text=大地书房',photoBg:'linear-gradient(160deg,#d8d0c0,#c8b898)',status:'green',summary:{cleanliness:'🟢4 🟡1',items:'📚200册',stay:'🛏️住宿'},floors:{'1F':[{id:'bar',name:'吧台',icon:'🍸',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'main_hall',name:'正厅',icon:'🏛️',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'toilet_study',name:'卫生间',icon:'🚻',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'wash_study',name:'洗漱台',icon:'🪥',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'corridor_study',name:'走廊楼梯',icon:'🚶',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'mahjong',name:'麻将室',icon:'🀄',status:'green',sub:'',items:[],people:[],cleaning:[]},{id:'kitchen_study',name:'大地厨房',icon:'🍳',status:'green',sub:'',items:[],people:[],cleaning:[]}],'2F':[{id:'dorm101',name:'A室·三人大通铺',icon:'🛏',status:'green',sub:'20NT/床·无空调',items:[],people:[],cleaning:[]},{id:'dorm102',name:'B室·四人大通铺',icon:'🛏',status:'green',sub:'30NT/床·有空调',items:[],people:[],cleaning:[]},{id:'dorm103',name:'C室·上下床+大床',icon:'🛏',status:'green',sub:'30NT/床·有空调',items:[],people:[],cleaning:[]},{id:'dorm104',name:'D室·单间大床房',icon:'🛏',status:'green',sub:'60NT/床·有空调',items:[],people:[],cleaning:[]},{id:'dorm105',name:'E室·两个上下床',icon:'🛏',status:'green',sub:'30NT/床·有空调',items:[],people:[],cleaning:[]},{id:'dorm106',name:'F室·四人间上下床',icon:'🛏',status:'green',sub:'35NT/床·有空调',items:[],people:[],cleaning:[]}],'阁楼':[{id:'attic',name:'阁楼储物',icon:'📦',status:'green',sub:'',items:[],people:[],cleaning:[]}]}},
  { id:'field',name:'田地A-E',icon:'🌿',meta:'5个种植区',photo:'https://placehold.co/600x360/a0c870/4a6830?text=田地',photoBg:'linear-gradient(160deg,#c0d8a0,#a8c880)',status:'green',summary:{totalPlots:5,planted:0},floors:{},plots:[{id:'fa',name:'A区',icon:'🥬',crops:[]},{id:'fb',name:'B区',icon:'🌽',crops:[]},{id:'fc',name:'C区',icon:'🍠',crops:[]},{id:'fd',name:'D区',icon:'🌳',crops:[]},{id:'fe',name:'E区',icon:'🍂',crops:[]}]},
  { id:'stage',name:'戏台·花坛',icon:'🎭',meta:'1区·🟢整洁',photo:'https://placehold.co/600x360/e8d0b0/6a4a3a?text=戏台',photoBg:'linear-gradient(160deg,#f0e0d0,#e0c8b0)',status:'green',summary:{status:'📍1区'},floors:{},plots:[]},
  { id:'plaza',name:'硕区广场',icon:'🏛️',meta:'开放·🟢整洁',photo:'https://placehold.co/600x360/d8c8a8/6a5a40?text=广场',photoBg:'linear-gradient(160deg,#e8dcc8,#d8c8a8)',status:'green',summary:{status:'📍开放空间·🟢整洁',onsite:'👤无人',cleaning:'📋每周一 15:00 大扫除'},floors:{},plots:[]},
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
  farming_pricing: { harvest:15, plant:5, water:3, weed:5, fertilize:5, view:2 },
  kitchen_pricing: { stock_in:2, stock_out:1, detail:5 },
  cooking_pricing: { chef:15, helper:5, wash:5 },
  verifier_reward_pct: 0.15,  // A-LABOR-FE ②: 15% 校核奖励（以公约附页B为准）
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
    water:3, fertilize:15, weed:15, sow:5, harvest:15, turn_soil:12,
    trellis:10, pest_control:8, mulch:8, prune:8,
    chef:20, sous_chef:12, wash_dishes:10, prep_food:8, clean_stove:12, grocery:5, serve_meal:5,
    repair:15, move_goods:12, organize_warehouse:10, waste_sort:8, compost:5, change_light:8,
    reception:8, tour_guide:10, event_setup:12, event_cleanup:10, animal_care:8, notice_board:5,
    painting:15, calligraphy:10, craft:12, photo_video:8, writing:8,
    mow_lawn:12, weed_pick:8,
    // A-LABOR-FE ③: 6 新劳动项（48 项）
    room_prep:10, room_inspect:8, newcomer_reception:12,
    care_elderly:15, care_sick:15, mentor_newbie:12
  },
  camp_creation_fee: 50,
  maintenance_xp: 30,
  maintenance_badge: '🧹整洁守护者',
  // C6: 岗位津贴——公约附页D，1500=900保底+600绩效
  leader_stipend: { base: 900, performance: 600, total: 1500, role: '生活组组长', unit: 'NT/月' },
  // 公约文本 — 从 config 渲染，禁止硬编码到 JS 逻辑中
  covenant_text: { version:'v12', updated:'2026-07-27', sign_clauses:[
    '我知道大院各个区域的情况，也知晓流浪猫狗、农具、车辆、公共区域活动的安全风险，自己的安全自己负责',
    '我知道 NT 是大院的劳动积分，不能购买物资、不能兑换人民币；空间使用费按公约 4.2 的标准，用 NT 支付',
    '我愿意承担每周一集体大扫除和突击整理的参与义务；这跟 NT 余额多少无关，不想亲手做可以付 NT 请人代',
    '我愿意遵守共享空间的规则：安静时段、厨房、农具、公共空间、退房恢复原状',
    '我同意「个人行为个人负责」的责任边界，也同意公约的修订程序'
  ], chapters:[
    {num:'一',title:'我们是谁',body:'南塘合作大院位于安徽阜阳颍州区三合镇三星村（原南塘村）。入住即视为愿意加入这个共同生活体。我们都是共同空间的共同管理者，没有谁是谁的房东，也没有谁是谁的租客。本公约由常住成员共同约定，经线下会议过半数表决通过。'},
    {num:'二',title:'区域一览',body:'大院由社区大楼（3 层）、大地书房（住宿区，A–F 六间卧室）、田地（A–E 五个种植区）、戏台·花坛、硕区广场、敬字亭、大地草坪、后院等区域组成。完整介绍见附页 A。'},
    {num:'三',title:'安全须知',body:'周边有流浪猫狗出没，已发生入住成员被咬伤的情况。农具（锄头、镰刀、铁锹等）因个人操作不当造成的伤害由使用者自行负责。借用大院车辆期间的事故、车损、人伤由借用人承担全部责任。公共区域因个人疏忽造成的意外由当事人自行负责。'},
    {num:'四',title:'NT 与空间使用费',body:'NT（南塘豆）是大院内部的劳动积分，不能购买物资、不能兑换人民币，只记录你为大院做了多少贡献。空间使用费只收 NT，按公约 4.2 标准（A-F 室 20-60 NT/床/晚）。结房费时一次性转入社区资金池（多签钱包），转账截图发给生活组组长校核入账。线上只能预定，不能付款。'},
    {num:'五',title:'劳动与贡献',body:'每周一下午 3 点集体大扫除。自愿劳动按 L1-L4 四级计酬。校核他人劳动得该次劳动 NT 的 15%。新人引导：签署后由生活组组长或其委托的成员带你完成引导任务。详见附页 B、C。'},
    {num:'六',title:'共享空间',body:'安静时段 22:00-08:00。厨房用完清洁归位。公共区域物品不长期堆放。农具用完清洁归位到 1F 小仓库或后院走廊。退房前把房间恢复原状、带走个人物品。'}
  ],
  appendices:{
    A:{title:'区域介绍',sections:[
      {title:'社区大楼 1F',rows:[['社区大厅','活动、休息、开会'],['社区超市','公共物资兑换、补给'],['小仓库','公共物资、农具存放，取用请登记'],['厨房','含冰箱、灶台、厨具、餐具'],['公共办公室','办公、讨论'],['卫生间','共同维护'],['通往后院的走廊','放有部分农具和物品（整理这里有 NT）']]},
      {title:'社区大楼 2F',rows:[['画室','绘画、创作'],['洗浴室','洗浴'],['阅览室（原农机室）','阅读、自习'],['标哥办公室','办公']]},
      {title:'社区大楼 3F',rows:[['天台','晾晒、活动'],['晾衣间','晾衣']]},
      {title:'大地书房 1F',rows:[['吧台','茶水、接待'],['正厅','阅读、会客'],['卫生间/洗漱台','共同维护'],['走廊楼梯','保持畅通'],['麻将室','休闲'],['大地厨房','大地书房侧厨房']]},
      {title:'大地书房 2F（住宿区）',rows:[['A-F 六间卧室','房型与价格见公约 4.2']]},
      {title:'田地',rows:[['A-E 五个种植区','种植、农活；农具在 1F 小仓库和后院走廊']]},
      {title:'院落与周边',rows:[['戏台·花坛','活动、演出'],['社区广场','开放空间，活动、集会'],['敬字亭','请保持敬重、整洁'],['大地草坪','休闲，请勿长期堆放个人物品'],['后院','经办公楼 1F 走廊可达'],['A门/B门·停车','主入口/车辆停放']]}
    ]},
    B:{title:'劳动定价与劳动标准',sections:[
      {title:'B-1 自愿劳动定价（L1-L4 分级）',rows:[
        ['L1·随手','不到10分钟','浇水、消耗标记、简单整理','1-3 NT'],
        ['L2·日常','10-30分钟','日常打扫、洗碗备菜、冰箱物品录入、整理小仓库/后院走廊','5 NT'],
        ['L3·专项','30-60分钟','主厨（3-5人餐）、标准量除草/收割','10-15 NT'],
        ['L4·重劳','1小时以上','大扫除、大面积施肥、多人帮厨（6人以上）','15-20 NT'],
        ['校核','现场确认劳动属实、达到标准','—','该次劳动NT的15%'],
        ['连续3次维护达标','—','—','+30 XP + 徽章']
      ]},
      {title:'B-2 农活量化标准',rows:[
        ['除草','平方米','10平方米','15 NT'],
        ['浇水','区域','完成指定区域一轮浇水','3 NT'],
        ['施肥','平方米','10平方米，均匀撒施','15 NT'],
        ['收割','畦/行','一畦/一行收割+初步整理','15 NT'],
        ['种植','株数','20株，挖坑放苗覆土浇水','5 NT'],
        ['翻堆肥','堆','翻堆一次，确保通气','5 NT']
      ]},
      {title:'B-3 各区域打扫合格标准',rows:[
        ['厨房','台面无油污，餐具洗净归位，地面无积水'],
        ['卫生间/洗浴室','无异味，无积水，垃圾清空'],
        ['卧室','床铺整洁，个人物品不占用公共区域'],
        ['大厅/正厅','无垃圾，桌椅归位，地面干净'],
        ['走廊/楼道','畅通，无杂物堆放'],
        ['小仓库/后院走廊','物品分类归位，农具清洁后放回'],
        ['院落（广场/草坪/戏台）','无垃圾，无长期堆放的私人物品']
      ]}
    ]},
    C:{title:'新人引导（一页工单）',sections:[
      {title:'引导任务',rows:[
        ['签署共居约定','读完公约并签字','10 NT'],
        ['认地方','引导人带你走遍附页A各个区域','15 NT'],
        ['认人','认识常住成员和生活组的伙伴','5 NT'],
        ['认物品','知道农具、厨房物品、三轮车钥匙在哪','10 NT']
      ]},
      {title:'引导人',rows:[['引导人完成一次完整引导，获 5 NT']]}
    ]},
    D:{title:'生活组组长：职责、权限与报酬',sections:[
      {title:'岗位津贴',rows:[['每月 1500 NT：900 保底 + 600 绩效']]},
      {title:'职责',rows:[['NT记账与发放','向社区资金池申领公用支出额度'],['组织劳动','划定每周一大扫除区域，组织突击整理'],['新人引导','亲自带或委托成员带'],['收存档案','签署的约定、账目记录'],['日常杂务','公用物资登记、线上预定管理']]},
      {title:'兜底边界',rows:[['组长只兜"没人认领但又必须有人做的事"']]}
    ]},
    E:{title:'公约解释（为什么这样设计）',sections:[
      {title:'核心原则',rows:[
        ['NT与人民币关系','NT不可换钱，是劳动可见度积分，不是货币'],
        ['劳动定价','按"花多少时间、费多大力"分L1-L4四级，而非具体动作'],
        ['大扫除义务','与NT余额无关——再有钱也不能免，这是共居的前提'],
        ['签署即承诺','签字发10NT，转账记录即签署凭证，每人只发一次']
      ]}
    ]}
  }
}}}
function _deepMerge(def, cfg) { var r = {}; Object.keys(def).forEach(function(k) { if (cfg[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) { r[k] = _deepMerge(def[k], cfg[k]); } else { r[k] = (k in cfg) ? cfg[k] : def[k]; } }); Object.keys(cfg).forEach(function(k) { if (!(k in r)) r[k] = cfg[k]; }); return r; }
function _mlConfig() { return _deepMerge(_defaultConfig(), _ml().config||{}); }
// 公约文本 — 服务端权威 → config 兜底（D3: 对接 GET /api/covenant/text）
var _covenantTextCache = null;
function _covenantText() { return _covenantTextCache || _mlConfig().covenant_text || _defaultConfig().covenant_text; }
function _covenantVersion() { var ct=_covenantText(); return ct?ct.version:'v12'; }
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

  var cp = _q('crumbPath'); if (cp) cp.innerHTML = '🗺️ <span style="cursor:pointer;color:var(--g-accent);text-decoration:underline" onclick="renderOverview()">实景地图</span> › <span style="cursor:pointer" onclick="renderOverview()">' + esc(b.name) + '</span>' + (selectedRoomId ? ' › <span>' + esc((rooms.find(function(r){return r.id===selectedRoomId})||{}).name||'') + '</span>' : '');

  _q('photoImg').style.height = ''; // 重置全貌页压缩的高度
  _q('photoImg').style.background = b.photoBg;
  _q('photoImg').innerHTML = (b.photo ? '<img src="'+esc(b.photo)+'" class="ph-image" onerror="this.style.display=\'none\'">' : '') +
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
  else if (rooms.length > 0) { rooms.forEach(function(r){ var sel = selectedRoomId===r.id?' selected':''; rh += '<div class="room-card'+sel+'" onclick="selectRoom(\''+r.id+'\')"><div class="rc-dot" style="background:'+(r.status==='green'?'#5d8c52':r.status==='yellow'?'#c8892e':'#b84c38')+'"></div><div class="rc-icon">'+r.icon+'</div><div class="rc-name">'+esc(r.name)+'</div>'+(r.sub?'<div class="rc-sub">'+esc(r.sub)+'</div>':'')+'</div>'; }); }
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
    function(){ return _s('newbieCard', _renderNewbieCard()); },
    function(){ return _s('quickEntryRow', _renderQuickEntryCards()); },
    function(){ return _s('cardVerifyRow', _renderCardVerifyRow()); },
    function(){ return _s('mgmtGrid', _renderMgmtCards()); },
    function(){ return _s('cardRoomSection', _renderCardRoomSection()); },
    function(){ return _s('covenantCard', _renderCovenantCard()); },
    function(){ return _s('poolCard', _renderPoolCard()); }
  ];
  var h = sections.map(function(fn){ try { return fn(); } catch(e) { console.error('[U-1b] renderInfoPage 板块异常:', e); return '<div style="color:var(--g-red);padding:8px;font-size:.6rem">⚠ 板块加载失败</div>'; } }).join('');
  console.log('[U-1b] renderInfoPage: sections HTML 长度=', h.length, 'roomsGrid=', !!_q('roomsGrid'), 'scrollArea=', !!_q('scrollArea'));
  _q('roomsGrid').innerHTML = '<div class="info-wrapper">'+h+'</div>';
  _bindCrToggles();  // C-5: 折叠区事件委托绑定
  _q('roomsGrid').style.display = 'block';
  _q('scrollArea').style.display = '';
  _q('itemsOverlay').classList.remove('show');
}
function _s(id, html) { return html ? '<div id="'+id+'">'+html+'</div>' : ''; }

// ── 子板块渲染 ──
function _renderAnnounceTicker() {
  var items = [];
  var anns = (window.AppData && AppData._data.announcements) ? AppData._data.announcements.slice(0,5) : [];
  anns.forEach(function(a){ items.push('📢 '+esc(a.text)); });
  // ⑱ 楚门层：从 activity_log 拉最近动态
  var log = (window.AppData && AppData._data.activity_log) ? AppData._data.activity_log.slice(0,10) : [];
  log.forEach(function(l){ items.push(esc((l.user||'')+' '+(l.content||l.text||l.action||''))); });
  // 从 presence 显示在地人员
  var pres = (window.AppData && AppData._data.presence) || {};
  var onsite = Object.keys(pres).filter(function(k){ return pres[k].status === 'onsite'; });
  if (onsite.length) items.unshift('🟢 在地 '+onsite.length+' 人：'+onsite.slice(0,5).map(function(n){return esc(n);}).join('、'));
  if (!items.length) return '';
  return '<div class="announce-bar"><span style="margin-right:8px">🏕️ 南塘此刻</span><span class="announce-track">'+
    items.join(' &nbsp;·&nbsp; ')+'</span></div>';
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
  var quests = (window.AppData && AppData._data.newbieQuests && AppData._data.newbieQuests[me]);
  // H-4 修复：统一为数组格式（data.js _initNewbieQuests 已用数组；老用户无 newbieQuests[me] 时，此路径原写为对象 → .find() 崩溃）
  if ((!quests || !quests.length) && window.AppData) {
    quests = steps.map(function(s){ return { id: s.id, done: false, verifiedBy: null, verifiedAt: null }; });
    if (!AppData._data.newbieQuests) AppData._data.newbieQuests = {};
    AppData._data.newbieQuests[me] = quests;
    AppData._savePrivate();
  }
  if (!quests || !quests.length) return '';
  var doneCount = quests.filter(function(q){ return q.done; }).length;
  if (doneCount >= steps.length) return ''; // 全部完成，不显示
  var pct = Math.round(doneCount / steps.length * 100);
  var h = '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px 12px;margin:4px 0">'+
    '<div style="font-weight:700;font-size:.72rem;margin-bottom:4px">🌱 新手引导 ('+doneCount+'/'+steps.length+')</div>'+
    '<div style="height:6px;background:#f0f0f0;border-radius:3px;margin-bottom:8px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--green-primary);border-radius:3px"></div></div>';
  steps.forEach(function(s){
    var q = quests.find(function(x){ return x.id === s.id; }) || {};
    var done = q.done;
    h += '<div style="font-size:.62rem;padding:3px 0;color:'+(done?'#999':'')+'">'+(done?'✅':'☐')+' '+s.name+(s.nt?' +'+s.nt+'NT':'')+'</div>';
  });
  var bonusNt = steps.reduce(function(sum,s){ return sum + (s.nt||0); }, 0);
  h += '<div style="font-size:.58rem;color:#999;margin-top:4px">💡 全部完成奖励: +'+bonusNt+' NT</div></div>';
  return h;
}

function _renderMgmtCards() {
  var h = '<div class="info-cards">';
  // ⑳ 角色仪表盘：visitor 只看住宿+世界终端，npc/admin 看全部
  var me = _me();
  var myRole = (me && typeof getUsers === 'function') ? ((getUsers()[me] || {}).role || 'visitor') : 'visitor';
  var isMember = myRole === 'npc' || myRole === 'admin' || myRole === 'builder';
  // visitor 专属：住宿引导卡
  if (!isMember) {
    h += '<div class="ic-card" style="border:2px solid var(--g-accent)" onclick="_openMgmtSheet(\'stay\')"><div class="ic-head">🛏️ 入住南塘</div>'+
      '<div class="ic-body"><div class="ic-big">🏠</div><div class="ic-muted">入住后才能使用厨房/打扫/田地功能</div></div></div>';
    h += '</div>'; return h;
  }
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
    return '<div>📦 '+esc(it.name)+' · '+esc(it.putBy)+warn+'</div>';
  }).join('') : '';
  h += '<div class="ic-card" onclick="_openMgmtSheet(\'kitchen\')"><div class="ic-head">🍳 厨房·冰箱</div>'+
    '<div class="ic-body">'+(kitchenLines||'<div class="ic-muted">暂无物品，点此录入</div>')+'</div></div>';
  // ⑫ 世界终端——admin 专属入口
  var me = _me();
  if (me && (typeof getUsers==='function') && ((getUsers()[me]||{}).role==='admin')) {
    h += '<div class="ic-card world-terminal" onclick="openCreateCamp()"><div class="ic-head">🌍 世界终端</div>'+
      '<div class="ic-body"><div class="ic-muted">创建新的共创营队</div></div></div>';
  }
  h += '</div>';
  return h;
}

function _renderQuickEntryCards() {
  // ⑳ 角色仪表盘：visitor 不显示操作卡片
  var me = _me();
  var myRole = (me && typeof getUsers === 'function') ? ((getUsers()[me] || {}).role || 'visitor') : 'visitor';
  var isMember = myRole === 'npc' || myRole === 'admin' || myRole === 'builder';
  // SM-3.3: 恢复 🧹 快捷打扫卡——D 修复误删了真入口（openSelfReport 走校核闭环），留的假入口 _submitMyCleaning 只写本地历史不触发 NT
  return '<div style="display:flex;gap:6px;padding:4px 0">'+
    (isMember ? '<div class="quick-card" onclick="_openKitchenQuick()" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px;text-align:center;cursor:pointer"><div style="font-size:1.4rem">📦</div><div style="font-size:.65rem;font-weight:600">放取物品</div><div style="font-size:.55rem;color:#999">冰箱·仓库</div></div>'+
    '<div class="quick-card" onclick="if(typeof openSelfReport===\'function\')openSelfReport({cat:\'cleaning\'})" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px;text-align:center;cursor:pointer"><div style="font-size:1.4rem">🧹</div><div style="font-size:.65rem;font-weight:600">打扫卫生</div><div style="font-size:.55rem;color:#999">清洁·维护</div></div>'+
    '<div class="quick-card" onclick="if(typeof openSelfReport===\'function\')openSelfReport({cat:\'farming\'})" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px;text-align:center;cursor:pointer"><div style="font-size:1.4rem">🌿</div><div style="font-size:.65rem;font-weight:600">田间管理</div><div style="font-size:.55rem;color:#999">种植·养护</div></div>' : '')+
    '<div class="quick-card" onclick="if(typeof openSelfReport===\'function\')openSelfReport({cat:\'explore\'})" style="flex:1;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px;text-align:center;cursor:pointer"><div style="font-size:1.4rem">🗺️</div><div style="font-size:.65rem;font-weight:600">探索南塘</div><div style="font-size:.55rem;color:#999">地图·建筑</div></div>'+
  '</div>';
}

function _renderCovenantCard() {
  return '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px 12px;margin:4px 0;cursor:pointer;display:flex;align-items:center;gap:8px" onclick="_openCovenantOverlay()"><span style="font-size:1.3rem">📜</span><div style="flex:1"><div style="font-weight:700;font-size:.72rem">南塘社区公约</div><div style="font-size:.58rem;color:#999">行为准则 · 定价标准 · 修改记录</div></div><span style="color:#999;font-size:.7rem">查看 ▸</span></div>';
}
// G-2: 公约 overlay 两页签 — 📜行为准则 + 💰定价标准
var _covenantTab = 'rules'; // 'rules' | 'pricing'
function _openCovenantOverlay() {
  _covenantTab = 'rules';
  _renderCovenantOverlay();
}
function _renderCovenantOverlay() {
  var ct = _covenantText();
  var cfg = _mlConfig();
  var body = '';

  // ── 两页签切换 ──
  body += '<div style="display:flex;border-bottom:2px solid #e8ede6;margin-bottom:10px">';
  body += '<div style="flex:1;text-align:center;padding:10px 0;font-size:.72rem;font-weight:700;cursor:pointer;'+
    (_covenantTab==='rules'?'color:var(--green-primary);border-bottom:2px solid var(--green-primary);margin-bottom:-2px':'color:#999')+
    '" onclick="_covenantTab=\'rules\';_renderCovenantOverlay()">📜 行为准则</div>';
  body += '<div style="flex:1;text-align:center;padding:10px 0;font-size:.72rem;font-weight:700;cursor:pointer;'+
    (_covenantTab==='pricing'?'color:var(--green-primary);border-bottom:2px solid var(--green-primary);margin-bottom:-2px':'color:#999')+
    '" onclick="_covenantTab=\'pricing\';_renderCovenantOverlay()">💰 定价标准</div>';
  body += '</div>';

  if (_covenantTab === 'rules') {
    // ── 📜 行为准则：正文+附页A–E ──
    body += '<div style="font-size:.58rem;color:#999;margin-bottom:6px">南塘合作大院共居公约 · '+_covenantVersion()+' · '+(ct.updated||'')+'</div>';
    // 正文十章折叠条
    if (ct.chapters) {
      body += '<div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin:8px 0 4px">📋 正文</div>';
      var _cnNum=['一','二','三','四','五','六','七','八','九','十'];
      ct.chapters.forEach(function(ch,idx){
        ch.num = ch.num || _cnNum[idx] || (idx+1);
        ch.title = ch.title || '';
        ch.body = ch.body || '';
        var cid = 'cov_ch_'+ch.num;
        body += '<div style="border:1px solid #e8ede6;border-radius:8px;margin-bottom:4px;overflow:hidden">';
        body += '<div style="padding:8px 10px;background:#f9faf6;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:.65rem;font-weight:600;color:#1d2e24" onclick="var el=document.getElementById(\''+cid+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'">';
        body += '<span>'+ch.num+'. '+ch.title+'</span><span style="font-size:.55rem;color:#999">▾</span></div>';
        body += '<div id="'+cid+'" style="display:none;padding:8px 10px;font-size:.6rem;color:#5a6e5c;line-height:1.6;border-top:1px solid #e8ede6">'+esc(ch.body)+'</div>';
        body += '</div>';
      });
    }
    // 附页 A–E 抽屉
    if (ct.appendices) {
      body += '<div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin:10px 0 4px">📎 附页</div>';
      ['A','B','C','D','E'].forEach(function(key){
        var ap = ct.appendices[key]; if (!ap) return;
        var aid = 'cov_apx_'+key;
        body += '<div style="border:1px solid #e8ede6;border-radius:8px;margin-bottom:4px;overflow:hidden">';
        body += '<div style="padding:8px 10px;background:#faf8f0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:.65rem;font-weight:600;color:#8a6a30" onclick="var el=document.getElementById(\''+aid+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'">';
        body += '<span>附页 '+key+' · '+ap.title+'</span><span style="font-size:.55rem;color:#999">▾</span></div>';
        body += '<div id="'+aid+'" style="display:none;padding:8px 10px;font-size:.58rem;color:#5a6e5c;line-height:1.5;border-top:1px solid #e8ede6">';
        (ap.sections||[]).forEach(function(sec){
          body += '<div style="font-weight:600;color:#5a6e5c;margin:6px 0 2px;font-size:.62rem">'+sec.title+'</div>';
          if (sec.rows && sec.rows.length) {
            body += '<table style="width:100%;border-collapse:collapse;font-size:.55rem">';
            sec.rows.forEach(function(row){
              body += '<tr style="border-bottom:1px dotted #f0f0f0">';
              row.forEach(function(cell,i){
                body += '<td style="padding:3px 4px;'+(i===0?'font-weight:600;color:#1d2e24;white-space:nowrap':'color:#5a6e5c')+'">'+cell+'</td>';
              });
              body += '</tr>';
            });
            body += '</table>';
          }
        });
        body += '</div></div>';
      });
    }
    // 签署入口
    body += '<button class="btn-pri btn-full" style="margin-top:10px;font-size:.68rem" onclick="_openSignPage()">✍️ 签署公约</button>';
  } else {
    // ── 💰 定价标准：现有 _mlConfig 实时表不动 ──
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
        '轻量农活(种植): '+cfg.farming_pricing.plant+' NT',
        '浇水: '+cfg.farming_pricing.water+' NT',
        '帮厨/主厨: '+cfg.cooking_pricing.chef+' NT',
        '洗碗/备菜: '+cfg.cooking_pricing.helper+' NT',
        '冰箱物品录入: '+cfg.kitchen_pricing.stock_in+' NT',
        '物品消耗标记: '+cfg.kitchen_pricing.stock_out+' NT',
        '校核奖励: '+(cfg.verifier_reward_pct*100)+'% of 动作NT',
        '维护者奖励: +'+cfg.maintenance_xp+' XP + '+cfg.maintenance_badge,
        '营地创建费: '+cfg.camp_creation_fee+' NT']}
    ];
    if (cfg.leader_stipend) {
      var ls = cfg.leader_stipend;
      pricing.push({ section:'岗位津贴', items:[ls.role+': '+ls.total+' '+ls.unit+'（'+ls.base+'保底+'+ls.performance+'绩效）']});
    }
    body += pricing.map(function(s){ return '<div style="margin-bottom:10px"><div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin-bottom:4px">'+s.section+'</div>'+s.items.map(function(i){ return '<div style="font-size:.62rem;padding:2px 0;border-bottom:1px dotted #f0f0f0">'+i+'</div>'; }).join('')+'</div>'; }).join('');
  }

  // ── 修改记录+提案（两页共用，沉底）──
  var history = (window.AppData && AppData._data.configHistory) ? AppData._data.configHistory.slice(0,5) : [];
  if (history.length) {
    body += '<div style="margin-top:10px"><div style="font-weight:700;font-size:.68rem;color:#5a6e5c;margin-bottom:4px">📝 修改记录</div>';
    history.forEach(function(h){
      body += '<div style="font-size:.58rem;padding:3px 0;border-bottom:1px dotted #f0f0f0">'+(h.appliedAt||'').slice(0,10)+' 校核人:'+(h.verifiedBy||[]).join('+')+' · '+(h.note||'')+'</div>';
    });
    body += '</div>';
  }
  var pendingCfgs = (window.AppData && AppData._data.pendingConfigChanges) ? AppData._data.pendingConfigChanges.filter(function(c){ return c.status === 'pending'; }) : [];
  if (pendingCfgs.length) {
    body += '<div style="margin-bottom:10px"><div style="font-weight:700;font-size:.68rem;color:#c8892e;margin-bottom:4px">⏳ 待校核修改 ('+pendingCfgs.length+')</div>';
    pendingCfgs.forEach(function(c){
      body += '<div style="font-size:.58rem;padding:4px;background:#fef8e8;border-radius:6px;margin:4px 0">提案人:'+esc(c.proposedBy)+' · '+(c.note||'')+'<br>';
      (c.changes||[]).forEach(function(ch){ body += ch.field+': '+ch.old+'→'+ch.new+'<br>'; });
      body += '<button class="btn-sm pri" style="font-size:.55rem;padding:2px 8px;margin-top:4px" onclick="event.stopPropagation();_verifyCovenantProposal(\''+c.id+'\')">✓ 校核 ('+(c.verifiedBy||[]).length+'/'+c.requiredVerifiers+')</button>';
      body += '</div>';
    });
    body += '</div>';
  }
  if (_me().role === 'admin') {
    body += '<button class="btn-sm pri" style="width:100%;margin-top:6px;font-size:.65rem" onclick="closeQuickSheet();_openCovenantProposal()">📝 发起修改提案</button>';
  }
  body += '<div style="font-size:.55rem;color:#999;margin-top:8px">⚠ 所有定价由线下公约大会决定。管理员修改需24h公示+2人在线校核。</div>';
  _openQuickSheet('📜 南塘社区公约', body);
}

// D-15: 发起公约修改提案
function _openCovenantProposal() {
  var fields = [
    { id:'cleaning_pricing.dirty', label:'大扫除超时🔴 NT' },
    { id:'cleaning_pricing.warning', label:'大扫除注意🟡 NT' },
    { id:'cleaning_pricing.clean', label:'日常打扫🟢 NT' },
    { id:'farming_pricing.harvest', label:'农活收割/除草/施肥 NT' },
    { id:'farming_pricing.plant', label:'轻量农活浇水/种植 NT' },
    { id:'cooking_pricing.chef', label:'帮厨/主厨 NT' },
    { id:'cooking_pricing.helper', label:'洗碗/备菜 NT' },
    { id:'kitchen_pricing.stock_in', label:'冰箱物品录入 NT' },
    { id:'kitchen_pricing.stock_out', label:'物品消耗标记 NT' },
    { id:'kitchen_pricing.detail', label:'详细录入 NT' },
    { id:'verifier_reward_pct', label:'校核奖励比例' },
    { id:'accommodation_pricing.dorm101.perBed', label:'A室 NT/床' },
    { id:'accommodation_pricing.dorm102.perBed', label:'B室 NT/床' }
  ];
  var opts = fields.map(function(f){ return '<option value="'+f.id+'">'+f.label+'</option>'; }).join('');
  var h = '<div style="padding:12px"><div style="font-weight:700;font-size:.7rem;margin-bottom:8px">📝 发起定价修改提案</div>';
  h += '<select id="cfgField" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;font-size:.65rem;margin-bottom:6px;font-family:inherit">'+opts+'</select>';
  h += '<input id="cfgOld" placeholder="当前值" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;font-size:.65rem;margin-bottom:4px;box-sizing:border-box;font-family:inherit">';
  h += '<input id="cfgNew" placeholder="新值" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;font-size:.65rem;margin-bottom:4px;box-sizing:border-box;font-family:inherit">';
  h += '<input id="cfgNote" placeholder="修改原因/会议纪要（必填）" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;font-size:.65rem;margin-bottom:8px;box-sizing:border-box;font-family:inherit">';
  h += '<button class="btn-pri btn-full" style="font-size:.65rem" onclick="var f=document.getElementById(\'cfgField\').value;var o=document.getElementById(\'cfgOld\').value;var n=document.getElementById(\'cfgNew\').value;var nt=document.getElementById(\'cfgNote\').value;if(!nt){showToast(\'请填写修改原因\',\'warn\');return}var ch={field:f,old:isNaN(o)?o:parseInt(o),new:isNaN(n)?n:parseInt(n)};AppData.proposeConfigChange([ch],nt,\'\',null,_me().name);closeSub();showToast(\'提案已提交，需24h公示+2人校核\',\'ok\')">提交提案</button>';
  h += '</div>';
  openSub('公约修改提案', '⚖️', h, [{ label:'返回', action:'closeSub' }]);
}

// D-15: 校核公约修改
function _verifyCovenantProposal(changeId) {
  if (!CURRENT_USER) { showToast('请先登录', 'warn'); return; }
  var result = AppData.verifyConfigChange(changeId, CURRENT_USER);
  if (result.ok) {
    showToast('校核成功！'+(result.remaining?'还需 '+result.remaining+' 人校核':'修改已生效'), 'ok');
  } else {
    showToast(result.error, 'warn');
  }
}

// ── G-2: 签署页 ──
var _signChecked = {}; // 五□勾选状态
var _signStatus = null;  // cached covenant status
function _openSignPage() {
  if (!CURRENT_USER) { showToast('请先登录', 'warn'); return; }
  var ct = _covenantText();
  var clauses = ct.sign_clauses || [];
  // 初始化勾选
  clauses.forEach(function(_,i){ if (!(i in _signChecked)) _signChecked[i] = false; });
  // 先查签署状态
  _signStatus = null;
  _fetchCovenantStatus(function(signed, version, signedAt) {
    var body = '';
    if (signed) {
      body += '<div style="text-align:center;padding:20px 0">';
      body += '<div style="font-size:2rem;margin-bottom:8px">✅</div>';
      body += '<div style="font-weight:700;font-size:.78rem;color:#5d8c52">已签署 '+_covenantVersion()+'</div>';
      body += '<div style="font-size:.6rem;color:#999;margin-top:4px">签署日期：'+(signedAt||'—')+'</div>';
      body += '<div style="font-size:.58rem;color:#5a6e5c;margin-top:8px">如有疑问请联系生活组</div>';
      body += '</div>';
    } else {
      body += '<div style="font-size:.65rem;color:#5a6e5c;margin-bottom:10px;line-height:1.5">请逐条阅读并勾选以下全部条款后签署：</div>';
      clauses.forEach(function(clause, i) {
        var cid = 'sign_clause_'+i;
        body += '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="var cb=document.getElementById(\''+cid+'\');_signChecked['+i+']=!_signChecked['+i+'];cb.checked=_signChecked['+i+'];cb.style.accentColor=_signChecked['+i+']?\'var(--green-primary)\':\'#ccc\';_updateSignBtn()">';
        body += '<input type="checkbox" id="'+cid+'" style="margin-top:2px;flex-shrink:0;accent-color:#ccc;pointer-events:none" '+(false?'checked':'')+'>';
        body += '<span style="font-size:.62rem;color:#1d2e24;line-height:1.5">'+esc(clause)+'</span>';
        body += '</div>';
      });
      body += '<button id="signSubmitBtn" class="btn-pri btn-full" style="margin-top:12px;font-size:.68rem;opacity:.4;cursor:default" disabled onclick="_doSignCovenant()">✍️ 确认签署</button>';
      body += '<div style="font-size:.55rem;color:#999;margin-top:6px;text-align:center">签署后 +10 NT 将到账你的钱包</div>';
    }
    body += '<button class="btn-sm sec" style="width:100%;margin-top:8px;font-size:.6rem" onclick="closeQuickSheet()">关闭</button>';
    _openQuickSheet('✍️ 签署公约 · '+_covenantVersion(), body);
    if (!signed) _updateSignBtn();
  });
}
function _updateSignBtn() {
  var btn = document.getElementById('signSubmitBtn'); if (!btn) return;
  var ct = _covenantText(); var clauses = ct.sign_clauses||[];
  var allChecked = clauses.every(function(_,i){ return _signChecked[i]; });
  btn.disabled = !allChecked;
  btn.style.opacity = allChecked ? '1' : '.4';
  btn.style.cursor = allChecked ? 'pointer' : 'default';
}
function _doSignCovenant() {
  var ct = _covenantText(); var clauses = ct.sign_clauses||[];
  var allChecked = clauses.every(function(_,i){ return _signChecked[i]; });
  if (!allChecked) { showToast('请勾选全部条款后再签署', 'warn'); return; }
  // 调用 G-1 签署端点（mock 兼容：离线/未部署时本地标记）
  var isOffline = (typeof API === 'undefined' || !API.token);
  if (!isOffline) {
    API.covenantSign().then(function(r) {
      if (r && r.ok) {
        showToast('签署成功', 'ok');
        // D2: sign 响应无 nt_earned，改读 reward + reward_granted
        if (r.reward_granted && r.reward) showToast('+'+r.reward+' NT 已到账', 'warn');
        _signStatus = { signed: true, version: _covenantVersion(), signedAt: _todayStr() };
        closeQuickSheet();
        if (typeof refreshUserUI === 'function') refreshUserUI();
      } else {
        showToast((r&&r.error)||'签署失败，请重试', 'error');
      }
    }).catch(function(){ showToast('网络错误，请重试', 'error'); });
  } else {
    // 离线 mock：本地标记已签
    _signStatus = { signed: true, version: _covenantVersion(), signedAt: _todayStr() };
    if (!window.AppData._data._covenantSignatures) AppData._data._covenantSignatures = {};
    AppData._data._covenantSignatures[CURRENT_USER] = { version: _covenantVersion(), signedAt: _todayStr() };
    AppData._saveShared(true);
    showToast('签署成功（离线模式）', 'ok');
    showToast('+10 NT 已到账', 'warn');
    closeQuickSheet();
    if (typeof refreshUserUI === 'function') refreshUserUI();
  }
}
// 查签署状态（G-1 GET /api/covenant/status，服务端权威，不落本地缓存）
function _fetchCovenantStatus(callback) {
  var isOffline = (typeof API === 'undefined' || !API.token);
  if (!isOffline) {
    API.covenantStatus().then(function(r) {
      // D1: 服务端 status 无 ok 键，判 r.signed !== undefined
      if (r && typeof r.signed !== 'undefined') { _signStatus = r; callback(r.signed, r.version, r.signed_at); }
      // D5: 请求失败/无 signed 字段 → 不退回本地缓存，显示联网提示
      else { showToast('签署状态未知，请联网后重试', 'warn'); callback(false, '', ''); }
    }).catch(function(){ showToast('签署状态未知，请联网后重试', 'warn'); callback(false, '', ''); });
  } else { showToast('签署状态未知，请联网后重试', 'warn'); callback(false, '', ''); }
}
function _checkLocalCovenant(callback) {
  var sigs = (window.AppData&&AppData._data._covenantSignatures) ? AppData._data._covenantSignatures : {};
  var mine = sigs[CURRENT_USER];
  var signed = mine && mine.version === _covenantVersion();
  callback(!!signed, _covenantVersion(), mine?mine.signedAt:'');
}
function _isCovenantSigned(callback) {
  if (_signStatus && _signStatus.signed && _signStatus.version === _covenantVersion()) {
    callback(true); return;
  }
  _fetchCovenantStatus(function(signed) { callback(signed); });
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
    { id:'pres', title:'👤 在地人员', desc:'谁现在在村里，翻牌亮个相', badge: _onsiteCount(), content: _renderPresenceSection, empty: '还没有人在线，翻一下自己的牌吧~' },
    { id:'camp', title:'🏕️ 活跃营地', desc:'正在进行的营队活动，点"进入"看详情', badge: _activeCampCount(), content: _renderCampSection, empty: '🏕️ 暂无活跃营地' },
    { id:'tl', title:'📜 时间线', desc:'村里最近发生的大事小情', badge: '', content: _renderTimelineSection, empty: '时间线还是空的——完成了校核后会出现在这里' }
  ];
  return '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:8px 12px;margin:4px 0">'+
    '<div style="font-weight:700;font-size:.72rem;margin-bottom:6px">👥 社区动态</div>'+
    sections.map(function(sec){ return _collapsibleSection(sec); }).join('')+'</div>';
}
function _collapsibleSection(sec) {
  return '<div class="cr-section" style="border-top:1px solid #f0f0f0;padding:6px 0">'+
    '<div class="cr-header" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;min-height:44px;transition:background .15s" onmouseover="this.style.background=\'#f5f7f3\'" onmouseout="this.style.background=\'\'" ontouchstart="this.style.background=\'#edf0e9\'" ontouchend="this.style.background=\'\'">'+
      '<span style="font-weight:600;font-size:.7rem">'+sec.title+(sec.badge?' <span style="background:var(--green-primary);color:#fff;border-radius:8px;padding:1px 6px;font-size:.55rem">'+sec.badge+'</span>':'')+
      (sec.desc?'<br><span style="font-weight:400;font-size:.58rem;color:#999">'+sec.desc+'</span>':'')+'</span>'+
      '<span style="color:#999;font-size:.6rem">▸</span></div>'+
    '<div class="cr-body" style="display:none">'+(_safeRender(sec.content) || '<div style="color:#999;font-size:.62rem;padding:4px 0">'+sec.empty+'</div>')+'</div></div>';
}
// C-5: 折叠区开关改事件委托（根治行内 onclick 的环境敏感）；roomsGrid 每次 innerHTML 重写，委托只挂一次
function _bindCrToggles() {
  var rg = _q('roomsGrid');
  if (!rg || rg._crBound) return;
  rg._crBound = true;
  rg.addEventListener('click', function(e) {
    var h = (e.target && e.target.closest) ? e.target.closest('.cr-header') : null;
    if (!h || !rg.contains(h)) return;
    var b = h.nextElementSibling, arrow = h.lastElementChild;
    if (!b || !arrow) return;
    var open = b.style.display !== 'none';
    b.style.display = open ? 'none' : '';
    arrow.textContent = open ? '▸' : '▾';
  });
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
         '<button class="btn-sm sec" style="font-size:.58rem;padding:3px 6px" onclick="event.stopPropagation();_promptDialog(\'退回原因：\',\'\',function(r){if(r)_doReject(\''+v.id+'\',r)})">✕ 退回</button>')+
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
    return '<div class="disc-card" style="padding:6px 0;border-bottom:1px dotted #f0f0f0;font-size:.65rem;cursor:pointer" onclick="_showAlertCard({title:\''+esc(d.doer)+' '+esc(d.action)+'\',message:\'校核: '+esc(d.verifier)+'  NT +'+d.ntAmount+'\n'+d.verifiedAt+'\'})">'+
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
      '<div style="font-size:1.1rem">'+icon+'</div><div style="font-weight:700;font-size:.65rem">'+esc(uname)+'</div><div style="font-size:.55rem;color:#999">'+label+(loc?' · '+esc(loc):'')+'</div></div>';
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
    return '<div class="tl-entry" style="padding:4px 0;font-size:var(--g-font-size-xs);border-bottom:1px dotted #f8f8f8"><span style="color:var(--g-text-dim)">'+display+'</span> '+esc(e.text)+'</div>';
  }).join('');
}
function _yesterday() { var d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }

// ── 退回辅助 ──
function _doReject(vfyId, reason) {
  if (!reason) { showToast('请填写退回原因', 'warn'); return; }
  if (!window.AppData) return;
  var result = AppData.verifyAction(vfyId, _me(), false, reason);
  if (result && result.async) {
    // D-18: 异步HTTP，禁用按钮等待服务端响应
    var btns = document.querySelectorAll('button[onclick*="_doReject"]');
    btns.forEach(function(b){ b.disabled = true; b.textContent = '⏳ 处理中…'; });
    return;
  }
  if (result && result.ok) {
    if (window.Game&&Game.toast) Game.toast('已退回');
    render();
  }
}

function _renderPoolCard() {
  var pool = (window.AppData && AppData._data._poolBalance != null) ? AppData._data._poolBalance : ((window.NT && typeof NT.getCommunityPool === 'function') ? NT.getCommunityPool() : 0);
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
      '<span class="bc-name">'+esc(b2.name)+'</span>'+
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
          '<button class="btn-sm sec" style="font-size:.6rem;padding:3px 8px" onclick="event.stopPropagation();_promptDialog(\'修改作物名：\',\''+c.name+'\',function(n){if(n){plot.crops['+idx+'].name=n;_savePlotData();closeRoom();selectRoom(\''+plot.id+'\')}})">✏️ 编辑</button>'+
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
  if (window.AppData) AppData.addVerification('field_harvest', _me(), '收割 '+crop.name+' @'+plot.name, { plotId:plotId, crop:crop.name }, 15, AppData._verifierReward(15));
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
  // W6-P-FE: 动态在场人数（从 presence 实时计算）
  if (b.id && b.id !== 'info') {
    var _pres = (window.AppData && AppData._data.presence) || {};
    var _onSiteCount = Object.values(_pres).filter(function(p){ return p.status === 'onsite' && p.location === b.id; }).length;
    if (_onSiteCount > 0) h += '<div class="ov-row" style="color:var(--green-primary)"><span class="ov-label">🟢实时在场</span><span>'+_onSiteCount+' 人</span></div>';
  }
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
  // ⑪ 教室/阅览室 Card 范式：学习空间用卡片包裹
  var isStudy = room.id === 'farm_equipment' || room.id === 'studio';
  if (isStudy) body += '<div style="background:var(--g-card);border-radius:var(--g-radius);box-shadow:var(--g-shadow);padding:var(--g-pad);margin-bottom:8px">';

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
      body += '<div class="item-row" style="'+_seedStyle(it)+'"><div class="ir-icon">'+it.icon+'</div><div class="ir-text">'+esc(it.text)+'<div class="ir-sub">'+esc(it.sub||'')+'</div></div><div class="item-status '+statusClass+'">'+statusLabel+'</div></div>';
    });
  }


  // ── L3: 在场人员（W6-P-FE: 从 presence 映射进 room.people，三态显示）──
  // presence 由 sync_all 下发、_mergeSyncData 存入 AppData._data.presence
  // 三态：🟢在地居住(onsite+location 匹配) / 🟡外出(cloud/away) / ⚫离线(不在 presence)
  var bldId = (curBuilding() || {}).id;
  var presenceData = (window.AppData && AppData._data.presence) || {};
  var peopleList = [];
  if (bldId) {
    Object.keys(presenceData).forEach(function(uid) {
      var p = presenceData[uid];
      if (!p || !p.status) return;
      var atHere = (p.status === 'onsite' && p.location === bldId);
      peopleList.push({
        icon: atHere ? '🟢' : '🟡',
        text: uid,
        sub: atHere ? '在地居住' : (p.status === 'cloud' ? '云在线' : '外出')
      });
    });
    // ⚫ 离线：已知用户中不在 presence 的（限 10 人防噪声）
    var knownUsers = (typeof getUsers === 'function') ? getUsers() : {};
    var addedOffline = 0;
    Object.keys(knownUsers).forEach(function(uid) {
      if (addedOffline >= 10) return;
      if (!presenceData[uid]) {
        peopleList.push({ icon: '⚫', text: uid, sub: '离线' });
        addedOffline++;
      }
    });
  }
  if (peopleList.length) {
    body += '<div class="section-label">👤在场('+peopleList.length+'人)</div>';
    peopleList.forEach(function(p){
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
  if (isStudy) body += '</div>';
  body += '<button class="back-to-overview" onclick="closeRoom()">←返回建筑总览</button>';
  return body;
}

var _progScroll = false; // 程序化滚动标志，阻止 scroll 事件误触发
function goTo(i) {
  currentIdx = i; selectedRoomId = null; currentFloor = 0; overviewOpen = false;
  var bld = getBuildings()[i];
  if (bld && window.Game && window.Game.setMemberLocation) { window.Game.setMemberLocation(bld.id); }
  // C5: 空间访问追踪保留（数据用），不再自动完成新手任务（引导任务改人工确认）
  if (bld && bld.id && window.AppData) {
    if (!AppData._data.visitedSpaces) AppData._data.visitedSpaces = [];
    if (AppData._data.visitedSpaces.indexOf(bld.id) === -1) {
      AppData._data.visitedSpaces.push(bld.id);
      AppData._save();
    }
  }
  render();
  var track = _q('bcTrack'); if (!track) return;
  var cards = track.querySelectorAll('.bc-card');
  if (cards[i]) {
    _progScroll = true;
    cards[i].scrollIntoView({behavior:'instant', block:'nearest', inline:'center'});
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ _progScroll = false; }); });
  }
}
function renderOverview() { goTo(0); }
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
        var snapStep = cardW2 + 6; // 6px = CSS gap
        var idx = Math.round(self.scrollLeft / Math.max(1, snapStep));
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
        AppData.addVerification('daily_container', null, '清理 '+c.icon+' '+c.name+' ('+c.location+')', { containerId: c.id }, reward, AppData._verifierReward(reward));
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
  if (!Object.keys(cl).length && window.AppData) { AppData._data.cleaning = AppData._data.cleaning || {}; AppData._data.cleaning.spaces = cl; }
  getBuildings().forEach(function(b) {
    if (b.id === 'info' || b.id === 'gate_a' || b.id === 'parking') return;
    var d = (cl[b.id]) ? cl[b.id].dirtiness || 0 : 0;
    var st = d >= 60 ? 'red' : d >= 30 ? 'yellow' : 'green';
    var fKeys = Object.keys(b.floors || {});
    if (fKeys.length) {
      fKeys.forEach(function(fk) {
        (b.floors[fk] || []).forEach(function(r) {
          if (r.id.indexOf('dorm') !== 0) {
            rooms.push({ id:r.id, name:r.name, icon:r.icon, status:st, buildingName:b.name, buildingId:b.id, cleaning:r.cleaning });
          }
        });
      });
    } else {
      rooms.push({ id:b.id, name:b.name, icon:b.icon, status:st, buildingName:b.name, buildingId:b.id, cleaning:[] });
    }
  });
  if (!rooms.length) {
    // 兜底：所有建筑都作为可打扫空间
    getBuildings().forEach(function(b) {
      if (b.id === 'info' || b.id === 'gate_a') return;
      var d2 = (cl[b.id]) ? cl[b.id].dirtiness || 0 : 0;
      var st2 = d2 >= 60 ? 'red' : d2 >= 30 ? 'yellow' : 'green';
      rooms.push({ id:b.id, name:b.name, icon:b.icon, status:st2, buildingName:b.name, buildingId:b.id, cleaning:[] });
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
  var fn = { cleaning:renderCleaningPanel, stay:_showStaySheet, field:renderFieldPanel, fieldPlant:renderFieldPanel, kitchen:renderKitchenPanel, kitchenAdd:renderKitchenPanel }[type];
  _d('mgmtBody').innerHTML = fn ? fn() : '';
}

// ── IA-6: 统一弹窗卡片替代浏览器 alert ──
function _showAlertCard(opts) {
  var icon = opts.icon || '💬';
  var title = opts.title || '';
  var message = opts.message || '';
  var okText = opts.okText || '知道了';
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);animation:fadeIn .2s ease-out';
  el.onclick = function(e) { if (e.target === el) { el.remove(); if (opts.onOk) opts.onOk(); } };
  el.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:24px 20px;width:300px;max-width:88vw;box-shadow:0 12px 40px rgba(0,0,0,.2);text-align:center;animation:spcPop .2s ease-out">' +
    '<div style="font-size:2rem;margin-bottom:8px">' + icon + '</div>' +
    (title ? '<div style="font-weight:700;font-size:.82rem;margin-bottom:6px;color:#1d2e24">' + esc(title) + '</div>' : '') +
    '<div style="font-size:.68rem;color:#5a6e5c;line-height:1.7;margin-bottom:16px;white-space:pre-line">' + esc(message) + '</div>' +
    '<button id="_alertCardBtn" style="width:100%;padding:10px 0;background:var(--green-primary);color:#fff;border:none;border-radius:10px;font-size:.75rem;font-weight:700;min-height:44px;cursor:pointer" onclick="var o=this.parentElement.parentElement;if(o)o.remove()">' + okText + '</button>' +
    '</div>';
  document.body.appendChild(el);
}

// ── 卡片弹窗通用壳（fullscreen=true 全屏）──
function _showCardPopup(title, bodyHTML, actionBtn, fullscreen) {
  // D-2: 增量 DOM——容器已存在则只换三段内容，消 remove+append 闪烁
  var el = document.querySelector('.mgmt-sheet');
  if (el) {
    var inner = el.querySelector('.mgmt-sheet-inner'); if (!inner) return;
    inner.querySelector('.mgmt-sheet-title').textContent = title;
    inner.querySelector('.mgmt-sheet-body').innerHTML = bodyHTML;
    var btnWrap = inner.querySelector('.mgmt-sheet-actions');
    btnWrap.innerHTML = (actionBtn||'')+'<button class="btn-sm sec" style="width:100%;margin-top:8px;min-height:44px" onclick="var s=document.querySelector(\'.mgmt-sheet\');if(s)s.remove()">✕ 关闭</button>';
    return;
  }
  el = document.createElement('div'); el.className = 'mgmt-sheet';
  el.style.cssText = 'position:fixed;inset:0;z-index:260;display:flex;align-items:flex-end;justify-content:center';
  // F23: 入场动画 — 遮罩 fadeIn + 卡片 slideUp（仅新建时播）
  el.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,.45);animation:fadeIn .2s ease-out" onclick="this.parentElement.remove()"></div>'+
    '<div class="mgmt-sheet-inner" style="position:relative;background:#fff;border-radius:'+(fullscreen?'0':'16px 16px 0 0')+';width:100%;max-width:'+(fullscreen?'100%':'500px')+';height:'+(fullscreen?'100vh':'auto')+';max-height:'+(fullscreen?'100vh':'72vh')+';overflow-y:auto;padding:'+(fullscreen?'20px 16px 80px':'20px 16px')+';padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 24px rgba(0,0,0,.15);animation:spcPop .2s ease-out">'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span class="mgmt-sheet-title" style="font-size:1.2rem">'+title+'</span></div>'+
    '<div class="mgmt-sheet-body">'+bodyHTML+'</div>'+
    '<div class="mgmt-sheet-actions">'+(actionBtn||'')+'<button class="btn-sm sec" style="width:100%;margin-top:8px;min-height:44px" onclick="var s=document.querySelector(\'.mgmt-sheet\');if(s)s.remove()">✕ 关闭</button></div></div>';
  document.body.appendChild(el);
}

// 管理卡片点击 → 弹窗
function _openMgmtSheet(type) {
  if (type === 'kitchen') { try { var kp = renderKitchenPanel(); _showCardPopup('🍳 厨房 · 冰箱', kp||'', null, true); } catch(e) { console.error(e); _showCardPopup('🍳 厨房 · 冰箱', '<div style="padding:20px;text-align:center;color:#b84c38;font-size:.75rem">⚠ 面板加载失败<br><span style="font-size:.6rem;color:#999">请刷新页面后重试</span></div>', null, true); } return; }  // J 修复 + SM-1.5: try-catch 兜底——renderKitchenPanel 异常时至少弹出面板壳而非静默无反应
  if (type === 'field')   { _showFieldSheet(); return; }
  if (type === 'cleaning') { _showCardPopup('🧹 大扫除管理', renderCleaningPanel()||'', null, true); return; }
  if (type === 'stay')     { _showStaySheet(); return; }
}
// J 修复：厨房面板可能开在建筑页 mgmtOverlay 或全貌页弹层（.mgmt-sheet），重绘时按当前容器选择
function _rerenderKitchen() {
  try {
    if (document.querySelector('.mgmt-sheet')) { _openMgmtSheet('kitchen'); }
    else { renderMgmtPanel('kitchen'); }
  } catch(e) { console.error(e); }
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
      h += '<div style="font-size:.62rem;padding:3px 0;border-bottom:1px dotted #f0f0f0;display:flex;justify-content:space-between"><span>📦 '+esc(it.name)+' · '+esc(it.putBy)+w+'</span><span style="color:#999;font-size:.55rem">'+it.putDate+'</span></div>';
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
    var status = p.crops.length > 0 ? 'green' : 'offline';
    var statusDot = {green:'🟢',offline:'⚫'}[status];
    h += '<div style="background:var(--g-card);border-radius:var(--g-radius);box-shadow:var(--g-shadow);padding:10px 12px;margin-bottom:6px;cursor:pointer;font-size:.65rem" onclick="var s=document.querySelector(\'.mgmt-sheet\');if(s)s.remove();var b=getBuildings().findIndex(function(x){return x.id===\'field\'});if(b>=0){currentIdx=b;render()}">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:1.3rem">'+p.icon+'</span><b style="font-size:.75rem">'+p.name+'</b><span style="margin-left:auto">'+statusDot+'</span></div>'+
      '<div style="color:var(--g-text-dim)">'+ci+'</div>'+
      (p.crops.length ? '<div class="progress-bar" style="margin-top:6px"><div class="progress-fill" style="width:'+Math.min(100,Math.max(0,(p.crops[0].remain||0)/((p.crops[0].days||30)||1)*100))+'%"></div></div>' : '')+
      '</div>';
  });
  _showCardPopup('🌿 田地', h, '<button class="btn-sm pri" style="width:100%;margin:4px 0;min-height:44px;font-size:.65rem" onclick="_openFarmQuick()">＋ 记录农活</button>', true);
}

// ── 住宿：选房间→展开床位→选床→填日期→申请入住 ──
// ── 住宿：选房间→床位面板→点击空床→居中入住卡（日历+计算+管理员提示）──
var _selectedBed = null, _expandedRoom = null, _expandedBed = null;
var _showCheckinCard = false, _calYear, _calMonth, _calStart, _calEnd;

// G-3: 拉取住宿记账状态，填充「已记账 X NT（退房时结算）」横幅 + 欠费提醒
function _loadAccDueBanner() {
  var el = document.getElementById('accDueBanner');
  if (!el) return;
  if (typeof API === 'undefined' || !API.token) { el.innerHTML = ''; return; }
  API.accommodationStatus().then(function(r){
    var el2 = document.getElementById('accDueBanner'); if (!el2) return;
    if (!r || !r.tenant) { el2.innerHTML = ''; return; }
    var due = r.tenant.accommodation_due || 0;
    var debt = r.tenant.debt || 0;
    var html = '';
    if (due > 0 || debt > 0) {
      var bg = r.overdue_limit ? '#fde8e8' : (r.overdue_remind ? '#fef4e0' : '#eef6ee');
      var bd = r.overdue_limit ? 'var(--red,#d05050)' : (r.overdue_remind ? '#d99a2b' : 'var(--gp,#5d8c52)');
      html += '<div style="background:'+bg+';border:1px solid '+bd+';border-radius:10px;padding:8px 10px;font-size:.62rem;color:#5a4a2a">';
      html += '<b>🧾 已记账 '+due+' NT</b>（退房时一次性结算）';
      if (debt > 0) html += '<br>⚠ 历史欠费 '+debt+' NT 未结';
      if (r.overdue_remind && !r.overdue_limit) html += '<br>🔴 已超 '+r.remind_days+' 天房费，请及时结清';
      if (r.overdue_limit) { html += '<br>🔴 已达 '+r.limit_days+' 天房费上限，新预定将被限制'; if (navigator.vibrate) navigator.vibrate([200,100,200]); }
      html += '</div>';
    }
    el2.innerHTML = html;
  }).catch(function(){});
}
function _showStaySheet() {
  // ⑨ 弹窗栈：关闭已有弹窗避免多层叠加
  var existing = document.querySelector('.mgmt-sheet'); if (existing) existing.remove();
  var existingCI = document.querySelector('.stay-ci-overlay'); if (existingCI) existingCI.remove();
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
  h += '.stay-ci-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s}';
  h += '.stay-ci-card{background:#fff;border-radius:16px;width:320px;max-width:92vw;max-height:90vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,.25);animation:stayCiPop .25s ease-out}';
  h += '@keyframes stayCiPop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}';
  h += '.stay-ci-head{display:flex;align-items:center;gap:10px;padding:16px 16px 12px;border-bottom:1px solid #e8ede6}';
  h += '.stay-ci-title{font-size:.75rem;font-weight:700;color:var(--tx);flex:1}';
  h += '.stay-ci-close{font-size:1.1rem;cursor:pointer;color:#999;padding:4px 8px;border:none;background:none}';
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

  // G-3: 已记账住宿费横幅（退房时结算）
  h += '<div id="accDueBanner" style="margin-bottom:8px"></div>';

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
    h += '<div class="stay-ci-overlay" onclick="_closeCheckinCard()">' + _renderCheckinCard(activeRoom) + '</div>';
  }

  _showCardPopup('🛏️ 住宿', h, null, true);
  _loadAccDueBanner();
}
function _pickRoom(id) { _expandedRoom = id; _expandedBed = null; _selectedBed = null; _showCheckinCard = false; _showStaySheet(); }
function _openCheckinCard(roomId, bedNum) { _selectedBed = { room: roomId, bed: bedNum }; _showCheckinCard = true; _expandedRoom = roomId; _expandedBed = null; _showStaySheet(); }
function _expandBed(roomId, bedNum) { _expandedRoom = roomId; _showCheckinCard = false; _expandedBed = (_expandedBed&&_expandedBed.room===roomId&&_expandedBed.bed===bedNum) ? null : {room:roomId,bed:bedNum}; _showStaySheet(); }
function _closeCheckinCard() { _showCheckinCard = false; _selectedBed = null; _calStart = null; _calEnd = null; var ov = document.querySelector('.stay-ci-overlay'); if (ov) ov.remove(); }

function _renderCheckinCard(activeRoom) {
  if (!_selectedBed || !activeRoom) return '';
  var r = activeRoom, rid = r._id, bed = _selectedBed.bed;
  var now = new Date();
  if (!_calYear) { _calYear = now.getFullYear(); _calMonth = now.getMonth() + 1; }
  var pricePerDay = r.pricePerBed || 20;
  var totalDays = (_calStart && _calEnd) ? Math.ceil((new Date(_calEnd.y, _calEnd.m-1, _calEnd.d) - new Date(_calStart.y, _calStart.m-1, _calStart.d)) / 86400000) + 1 : 0;
  var totalPrice = totalDays * pricePerDay;

  var h = '';
  h += '<div class="stay-ci-card" onclick="event.stopPropagation()">';
  h += '<div class="stay-ci-head"><span style="font-size:1.3rem">🛏</span><div class="stay-ci-title">'+r.label+' · 床'+bed+'<br><span style="font-size:.55rem;color:#999">'+pricePerDay+'NT/天</span></div><button class="stay-ci-close" onclick="_closeCheckinCard()">✕</button></div>';
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
  // B-4: 增量更新月份标题+日历格子，不动 .cal-wrap DOM 节点，消 outerHTML 闪烁
  var wrap = document.querySelector('.cal-wrap'); if (!wrap) return;
  var tmp = document.createElement('div'); tmp.innerHTML = _renderMiniCalendar();
  var g = wrap.querySelector('.cal-grid'), ng = tmp.querySelector('.cal-grid');
  if (g && ng) g.innerHTML = ng.innerHTML;
  var t = wrap.querySelector('.cal-month-title'), nt = tmp.querySelector('.cal-month-title');
  if (t && nt) t.textContent = nt.textContent;
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

  // G-2: 未签拦截 —— 入住前必须签署公约
  var self = this;
  _isCovenantSigned(function(signed) {
    if (!signed && !isSwitch) {
      // 🔴 拒绝必出声：振动+toast
      if (navigator.vibrate) navigator.vibrate([200,100,200]);
      showToast('签署公约后才能入住', 'error');
      _openSignPage();
      return;
    }

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
      API.request('POST', '/api/accommodation/checkin', { room_id: _selectedBed.room, bed_num: _selectedBed.bed, track: 'inn' }).catch(function(e){console.warn('[checkin] sync failed',e)});
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
  showConfirm(confirmMsg, doCheckin);
  }); // _isCovenantSigned callback
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
  _promptDialog('添加房间物品（如：风扇、毯子、蚊香）：', '', function(item){
    if(!item||!item.trim()) return;
    if(!room.items) room.items = [];
    room.items.push(item.trim());
    if(window.AppData) AppData._saveShared(true);
    _showStaySheet();
  });
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
  _promptDialog('修改大扫除日期：', MGMT_DATA.cleaning.nextDate, function(d){
    if (d) { MGMT_DATA.cleaning.nextDate = d; MGMT_DATA._save(); renderMgmtPanel('cleaning'); }
  });
}

function _submitMyCleaning() {
  var roomId = (_d('cqRoom')||{}).value;
  if (!roomId) { if (window.Game&&Game.toast) Game.toast('请选择房间'); return; }
  var rooms = _collectCleaningRooms();
  var rr = rooms.find(function(r) { return r.id===roomId; });
  var p = _cleaningPricing();
  var nt = rr ? ({red:p.dirty,yellow:p.warning,green:p.clean}[rr.status]||0) : 0;
  var roomName = rr ? rr.name : roomId;
  // 保留本地历史记录
  MGMT_DATA.cleaning.history.unshift({ date:_todayStr(), person:_me(), roomName:roomName, nt:nt, note:'' });
  MGMT_DATA._save();
  // SM-3.5: 接入校核闭环——不再假报"+N NT"，走 addVerification 进校核室
  if (window.AppData && typeof AppData.addVerification === 'function') {
    var detail = { roomId: roomId, roomName: roomName, buildingName: rr?rr.buildingName:'', status: rr?rr.status:'', nt: nt };
    AppData.addVerification('cleaning', _me(), '打扫了 '+roomName, detail, nt);
    // 写入卡片室
    var discs = AppData._data.cardDiscoveries || (AppData._data.cardDiscoveries = []);
    discs.unshift({ id:'sr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6), spaceId:roomId, spaceName:roomName, actionId:'cleaning', actionLabel:'打扫了 '+roomName, description:'打扫了 '+roomName+(rr&&rr.buildingName?' @'+rr.buildingName:''), guesser:CURRENT_USER, guessedPerson:CURRENT_USER, guessedAt:new Date().toISOString(), status:'pending', ntGuesser:0, ntDoer:nt, isSelfReport:true, createdAt:new Date().toISOString() });
    if (discs.length > 200) discs.length = 200;
    // 房间状态复位：提交校核后将脏污度归零
    var cl = (AppData._data.cleaning && AppData._data.cleaning.spaces) ? AppData._data.cleaning.spaces : {};
    if (!cl[rr.buildingId||'']) cl[rr.buildingId||''] = { dirtiness: 0 };
    else cl[rr.buildingId||''].dirtiness = 0;
    AppData._saveShared(true);
    // 写 journal
    if (typeof AppData.addJournal === 'function') {
      AppData.addJournal(_me(), 'cleaning', '打扫了 '+roomName+'（待校核·+'+nt+' NT）');
    }
    if (window.Game&&Game.toast) Game.toast('已提交校核：'+roomName+'（待他人确认后 NT 到账）', 'info');
  } else {
    if (window.Game&&Game.toast) Game.toast('完成 '+roomName+' +'+nt+'NT');
  }
  var sel = MGMT_DATA.cleaning.mySelections || [];
  var idx = sel.indexOf(roomId);
  if (idx>=0) sel.splice(idx,1);
  _mgmtFormType = '';
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
    showConfirm('退房确认：\n\n请确认个人物品已带走、垃圾已清理。\n\n确认退房？', _doCheckout);
  }
}

function _doCheckout() {
  var roomNum = (MGMT_DATA.stay.myRoom||'').replace('dorm','');
  // D-18: 退房接服务端——先调 API，失败时保留本地状态
  var isOffline = (typeof API === 'undefined' || !API.token);
  if (isOffline) {
    MGMT_DATA.stay.history.unshift({date:_todayStr(), person:_me(), room:roomNum, detail:'退房 ✓'});
    MGMT_DATA.stay.myRoom = null; MGMT_DATA.stay.myCheckIn = null; MGMT_DATA.stay.myCheckOut = null;
    MGMT_DATA._save();
    if (window.AppData) AppData.flipPresence(_me(), 'cloud', null);
    if (window.Game&&Game.toast) Game.toast('已退房 '+roomNum+'室（离线）· 状态已切为云在线');
    renderMgmtPanel('stay');
    return;
  }
  API.checkout().then(function(r){
    if (r && r.ok) {
      MGMT_DATA.stay.history.unshift({date:_todayStr(), person:_me(), room:roomNum, detail:'退房 ✓'});
      MGMT_DATA.stay.myRoom = null; MGMT_DATA.stay.myCheckIn = null; MGMT_DATA.stay.myCheckOut = null;
      MGMT_DATA._save();
      if (window.AppData) AppData.flipPresence(_me(), 'cloud', null);
      // 服务端可能返回角色变更
      if (r.role && window.AppData) {
        var users = (typeof getUsers === 'function') ? getUsers() : {};
        if (users[_me()]) users[_me()].role = r.role;
      }
      var msg = '已退房 '+roomNum+'室 · 状态已切为云在线';
      // G-3 退房结算单：住了 X 天 · 每天 Y · 合计 Z · 已付/欠费
      var st = r.settlement;
      if (st && st.total > 0) {
        var sMsg = '📋 退房结算单\n住了 '+st.days+' 天 · 每天 '+st.rate+' NT · 合计 '+st.total+' NT\n已付 '+st.paid+' NT'+(st.debt>0?(' · ⚠ 欠费 '+st.debt+' NT 未结'):'');
        if (typeof showToast==='function') showToast('已结算 '+st.paid+' NT'+(st.debt>0?('，欠费 '+st.debt+' NT'):''), st.debt>0?'warn':'ok');
        if (typeof _promptDialog==='function' || typeof alert==='function') { try{ (window.showConfirm||alert)(sMsg); }catch(e){} }
      }
      if (r.remaining_debt > 0) msg += ' · ⚠ 欠费 '+r.remaining_debt+' NT 未结';
      if (window.Game&&Game.toast) Game.toast(msg);
    } else {
      showToast((r&&r.detail)||'退房失败，请重试','error');
    }
    renderMgmtPanel('stay');
  }).catch(function(){
    showToast('网络异常，请稍后重试','error');
    renderMgmtPanel('stay');
  });
}
function _checkoutBed(){ _checkoutStay(); }

/* ══════════════════════════════════════
   🌿 田地管理（我的视角）
   ══════════════════════════════════════ */
function renderFieldPanel() {
  var plots = getPlots();
  var actions = ['摘菜','浇水','播种','施肥','除草','收割','查看','其他'];
  var pricing = _defaultConfig().farming_pricing;
  var me = _me();
  var h = '';

  // B-1: 确保每块地有子区域
  plots.forEach(function(p) { _ensurePlotZones(p); });

  // ═══ ① 提醒 ═══
  h += '<div class="mgmt-reminders">';
  var allZones = []; plots.forEach(function(p) { (p.zones||[]).forEach(function(z) { allZones.push({plot:p,zone:z}); }); });
  var ripeZones = allZones.filter(function(x) { return x.zone.crop && x.zone.status==='warning'; });
  var idlePlots = plots.filter(function(p) { return (p.zones||[]).some(function(z) { return !z.crop; }); });
  if (ripeZones.length) {
    ripeZones.forEach(function(x) {
      var ci = _cropInfo(x.zone.crop); var seasonNote = '';
      if (ci && ci.seasons.indexOf(_currentSeason())<0) seasonNote = ' · ⚠不当季';
      h += '<div class="mr-item warn">⚠ '+x.plot.name+' '+x.zone.crop+' 即将成熟 · 剩'+x.zone.remain+'天 · 准备收割'+seasonNote+'</div>';
    });
  }
  if (idlePlots.length) {
    var season = _currentSeason(); var seasonalCrops = Object.keys(CROP_TABLE).filter(function(c) { return CROP_TABLE[c].seasons.indexOf(season)>=0; });
    h += '<div class="mr-item ok">🌱 '+idlePlots.map(function(p){return p.name;}).join('、')+'有空闲子区域 · 当季可种：'+seasonalCrops.join('、')+'</div>';
  }
  if (!ripeZones.length && !idlePlots.length) h += '<div class="mr-item ok">🟢 全部地块正常生长中</div>';
  h += '</div>';

  // ═══ ② 操作按钮 ═══
  var tmpSels = MGMT_DATA.field._tmpSelections || [];
  h += '<div class="mgmt-actions">';
  h += '<button class="ma-btn primary" onclick="_toggleForm(\'field\')">📝 记录农活</button>';
  h += '<button class="ma-btn secondary" onclick="_toggleForm(\'fieldPlant\')">🌱 种植/修改</button>';
  h += '</div>';
  if (tmpSels.length > 0) {
    h += '<div style="text-align:center;font-size:var(--g-font-size-xs);color:var(--g-gold);font-weight:700;margin-bottom:8px">已选 '+tmpSels.length+' 块子区域待操作</div>';
  }

  // ═══ ③ 快速表单 ═══
  // 表单 A：记录农活
  h += '<div class="mgmt-quick-form' + (_mgmtFormType==='field'?' open':'') + '">';
  h += '<div class="qf-title">✏️ 我（'+me+'）在田地做了什么</div>';
  h += '<div class="qf-row">在 <select id="fpPlot">'+plots.map(function(p){return '<option value="'+p.id+'">'+p.icon+' '+p.name+'</option>';}).join('')+'</select>';
  h += ' <select id="fpZone"><option value="">全区 ▼</option>'+plots.map(function(p){return (p.zones||[]).map(function(z){return '<option value="'+z.id+'">'+p.name+'-'+(z.label||z.id.slice(-1))+(z.crop?' '+z.crop:' 空闲')+'</option>';}).join('');}).join('')+'</select>';
  h += ' <select id="fpAction">'+actions.map(function(a){return '<option>'+a+'</option>';}).join('')+'</select>';
  h += ' <input id="fpNote" placeholder="备注（可选）">';
  h += ' <button class="qf-submit" onclick="_submitFieldLog()">✓ 记录</button></div>';
  h += '</div>';
  // 表单 B：种植/修改
  h += '<div class="mgmt-quick-form' + (_mgmtFormType==='fieldPlant'?' open':'') + '">';
  h += '<div class="qf-title">🌱 种植或修改作物</div>';
  h += '<div class="qf-row">在 <select id="fpPlot2">'+plots.map(function(p){return '<option value="'+p.id+'">'+p.icon+' '+p.name+'</option>';}).join('')+'</select>';
  h += ' <select id="fpZone2"><option value="">全区 ▼</option>'+plots.map(function(p){return (p.zones||[]).map(function(z){return '<option value="'+z.id+'">'+p.name+'-'+(z.label||z.id.slice(-1))+(z.crop?' '+z.crop:' 空闲')+'</option>';}).join('');}).join('')+'</select>';
  h += ' <select id="fpCrop"><option value="">选作物 ▼</option>'+Object.keys(CROP_TABLE).map(function(c){var ci=CROP_TABLE[c];return '<option value="'+c+'">'+c+' ('+ci.days+'天·'+ci.seasons.join('/')+')</option>';}).join('')+'</select>';
  h += ' <button class="qf-submit" onclick="_submitFieldPlant()">✓ 确认</button></div>';
  h += '</div>';

  // ═══ ④ 卡片网格 ═══
  h += '<div class="mgmt-card-grid">';
  plots.forEach(function(p) {
    var zoneCount = (p.zones||[]).length;
    var plantedCount = (p.zones||[]).filter(function(z){return z.crop;}).length;
    var hasWarning = (p.zones||[]).some(function(z){return z.status==='warning';});
    var statusColor = hasWarning?'#d4a017':plantedCount>0?'var(--g-green)':'#999';
    var isExpanded = _expandedFieldPlot === p.id;
    h += '<div class="mgmt-card'+(isExpanded?' selected':'')+'" onclick="_expandFieldPlot(\''+p.id+'\')" style="cursor:pointer">';
    h += '<span class="mc-status" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+statusColor+';margin-right:4px;vertical-align:middle"></span>';
    h += '<span class="mc-icon">'+p.icon+'</span>';
    h += '<div class="mc-name">'+p.name+'</div>';
    h += '<div class="mc-sub">'+(plantedCount>0?plantedCount+'块种植':'空闲')+(zoneCount>0?' · '+zoneCount+'块可种':'')+'</div>';
    if (plantedCount > 0) {
      var mainZone = (p.zones||[]).find(function(z){return z.crop;}) || p.zones[0];
      var pct = mainZone.crop ? Math.round((1-(mainZone.remain||0)/(mainZone.days||90))*100) : 0;
      h += '<div style="width:100%;height:5px;background:var(--g-card-border);border-radius:3px;margin-top:4px"><div style="width:'+pct+'%;height:100%;background:'+(pct>80?'var(--g-warn)':'var(--g-green)')+';border-radius:3px"></div></div>';
      if (mainZone.crop) {
        var ci = _cropInfo(mainZone.crop); var seasonOk = ci && ci.seasons.indexOf(_currentSeason())>=0;
        h += '<div class="mc-sub" style="margin-top:2px">'+(mainZone.crop||'')+' · '+(mainZone.planted||'')+'→'+(mainZone.harvest||'')+' · 剩'+(mainZone.remain||0)+'天'+(seasonOk?'':' ⚠')+'</div>';
      }
    }
    h += '</div>';
    // 展开子区域
    if (isExpanded) {
      h += '<div style="grid-column:1/-1;background:#f8faf7;border-radius:10px;padding:8px;margin-bottom:4px"><div style="font-weight:600;font-size:.65rem;margin-bottom:6px">'+p.icon+' '+p.name+' 子区域</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px">';
      (p.zones||[]).forEach(function(z) {
        var isPlanted = z.crop && z.crop!=='—';
        var zPct = isPlanted ? Math.round((1-(z.remain||0)/(z.days||90))*100) : 0;
        var zStatusColor = !isPlanted?'#ccc':z.status==='warning'?'#d4a017':'var(--g-green)';
        h += '<div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:6px;text-align:center;font-size:.6rem">';
        h += '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+zStatusColor+';margin-right:3px"></span>';
        h += '<b>'+(z.label||z.id.slice(-1))+'</b>';
        if (isPlanted) {
          h += '<div>'+z.crop+'</div><div style="height:3px;background:#eee;border-radius:2px;margin:3px 0"><div style="width:'+zPct+'%;height:100%;background:'+(zPct>80?'var(--g-warn)':'var(--g-green)')+';border-radius:2px"></div></div><div style="color:#999">剩'+z.remain+'天</div>';
        } else {
          h += '<div style="color:#999">空闲</div>';
        }
        h += '</div>';
      });
      h += '</div></div>';
    }
  });
  h += '</div>';

  // ═══ ⑤ 定价说明 ═══
  h += '<div class="mgmt-pricing">';
  var chips = [
    { label:'收割 +'+pricing.harvest+'NT', style:'' },
    { label:'种植/施肥/除草 +'+pricing.plant+'NT', style:'' },
    { label:'浇水 +'+pricing.water+'NT', style:'' },
    { label:'查看 +'+pricing.view+'NT', style:'' }
  ];
  chips.forEach(function(ch) { h += '<span class="mgmt-price-chip"'+(ch.style?' style="'+ch.style+'"':'')+'>'+ch.label+'</span>'; });
  h += '</div>';

  // ═══ ⑥ 历史 ═══
  h += '<div class="mgmt-history"><div class="mas-title" style="margin-bottom:4px">📜 农事记录</div>';
  MGMT_DATA.field.history.forEach(function(hi) {
    h += '<div class="mh-item">'+hi.date+' · '+hi.person+' · '+(hi.plotName||'')+' · '+hi.action+(hi.note?' · '+hi.note:'')+'</div>';
  });
  h += '</div>';

  return h;
}

// B-1: 确保地块有子区域数据
function _ensurePlotZones(p) {
  if (!p.zones) p.zones = [];
  if (p.zones.length > 0) return;
  for (var i=1; i<=3; i++) {
    p.zones.push({ id: p.id+'-'+i, label: p.name+'-'+i, crop: null, planted: '', days: 0, remain: 0, status: 'idle' });
  }
}
// B-1: 点击地块展开/收起子区域
var _expandedFieldPlot = null;
function _expandFieldPlot(pid) {
  _expandedFieldPlot = (_expandedFieldPlot === pid) ? null : pid;
  renderMgmtPanel('field');
}
// B-1: 种植提交
function _submitFieldPlant() {
  var crop = (_d('fpCrop')||{}).value; if (!crop) { if (window.Game&&Game.toast) Game.toast('请选择作物','warn'); return; }
  var plotId = (_d('fpPlot2')||{}).value;
  var zoneId = (_d('fpZone2')||{}).value;
  var plots = getPlots();
  var plot = plots.find(function(p){return p.id===plotId;});
  if (!plot) return;
  var ci = _cropInfo(crop); var today = _todayStr(); var days = ci ? ci.days : 90;
  var harvestDate = new Date(); harvestDate.setDate(harvestDate.getDate()+days);
  var harvestStr = (harvestDate.getMonth()+1)+'/'+harvestDate.getDate();
  if (zoneId) {
    // 指定子区域
    var zone = (plot.zones||[]).find(function(z){return z.id===zoneId;});
    if (zone) {
      zone.crop = crop; zone.planted = today; zone.days = days; zone.remain = days;
      zone.harvest = harvestStr; zone.status = days<=7?'warning':'ok';
    }
  } else {
    // 全区：找第一个空闲子区域
    var free = (plot.zones||[]).find(function(z){return !z.crop;});
    if (free) {
      free.crop = crop; free.planted = today; free.days = days; free.remain = days;
      free.harvest = harvestStr; free.status = days<=7?'warning':'ok';
    }
  }
  MGMT_DATA.field.history.unshift({ date:today, person:_me(), plotName:plot.name, action:'播种 '+crop, note:'子区域' });
  MGMT_DATA._save();
  _savePlotData();
  _mgmtFormType = '';
  if (window.Game&&Game.toast) Game.toast('已种植 '+crop+' @'+plot.name);
  renderMgmtPanel('field');
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
var _kOpen = {};
function renderKitchenPanel() {
  var me = _me(); var h = '';
  // 收集冰箱物品
  var inv = (window.AppData && AppData._data.inventory && AppData._data.inventory.office) ? AppData._data.inventory.office : [];
  var upperItems = inv.filter(function(it){ return (it.location||'').indexOf('fridge')>=0 || (it.location||'').indexOf('冷藏')>=0 || (it.location||'').indexOf('上层')>=0; });
  var lowerItems = inv.filter(function(it){ return (it.location||'').indexOf('冷冻')>=0 || (it.location||'').indexOf('下层')>=0; });
  if (!upperItems.length && !lowerItems.length) { upperItems = inv.slice(); }
  var upperWarn = upperItems.filter(function(i){ return _itemExpired(i)==='warn'||_itemExpired(i)==='expired'; }).length;
  var lowerWarn = lowerItems.filter(function(i){ return _itemExpired(i)==='warn'||_itemExpired(i)==='expired'; }).length;

  // ═══ ① 提醒 + 库存清单 ═══
  h += '<div class="mgmt-reminders">';
  if (upperWarn+lowerWarn > 0) h += '<div class="mr-item warn">⚠ 冰箱 '+upperWarn+lowerWarn+' 件物品临期/过期 · 建议清理</div>';
  h += '<div class="mr-item info">🧊 冷冻 '+lowerItems.length+'件 · 冷藏 '+upperItems.length+'件 · 储物间 '+(inv.length-upperItems.length-lowerItems.length)+'件</div>';
  // ⑩ 库存清单
  var allFridge = inv.filter(function(it){ return it.status !== 'consumed'; });
  if (allFridge.length) {
    h += '<div class="mr-item" style="font-size:var(--g-font-size-xs);color:var(--g-text-dim)">📋 '+
      allFridge.slice(0,8).map(function(it){ return esc(it.name); }).join('、')+
      (allFridge.length > 8 ? ' …等'+allFridge.length+'件' : '')+'</div>';
  }
  h += '</div>';

  // ═══ ② 操作按钮 ═══
  h += '<div class="mgmt-actions">';
  h += '<button class="ma-btn primary" onclick="_toggleForm(\'kitchen\')">🍳 做饭</button>';
  h += '<button class="ma-btn secondary" onclick="_toggleForm(\'kitchenAdd\')">＋ 放入物品</button>';
  h += '</div>';

  // ── 快速表单 A：操作记录 ──
  h += '<div class="mgmt-quick-form' + (_mgmtFormType==='kitchen'?' open':'') + '">';
  h += '<div class="qf-title">✏️ 我（'+me+'）在厨房的操作</div>';
  h += '<div class="qf-row"><select id="kpAction"><option>放入物品</option><option>取出/消耗</option><option>打扫</option><option>做饭</option><option>其他</option></select>';
  h += ' <input id="kpItem" placeholder="物品名（必填）">';
  h += ' <input id="kpLoc" placeholder="位置" style="width:80px" value="冰箱冷藏">';
  h += ' <button class="qf-submit" onclick="_submitKitchenLog()">✓ 记录</button></div>';
  h += '</div>';
  // ── 快速表单 B：放入物品 ──
  h += '<div class="mgmt-quick-form' + (_mgmtFormType==='kitchenAdd'?' open':'') + '">';
  h += '<div class="qf-title">＋ 往冰箱加东西</div>';
  h += '<div class="qf-row"><input id="kpItem2" placeholder="物品名（必填）">';
  h += ' <select id="kpLoc2"><option value="冷藏">❄️ 冷藏</option><option value="冷冻">🧊 冷冻</option></select>';
  h += ' <button class="qf-submit" onclick="var a=_d(\'kpItem2\'),b=_d(\'kpLoc2\');var n=a?a.value:\'\';if(!n.trim())return;var l=b?b.value:\'冷藏\';_d(\'kpItem\').value=n;_d(\'kpLoc\').value=l;_d(\'kpAction\').value=\'放入物品\';_submitKitchenLog()">✓ 放进去</button></div>';
  h += '</div>';

  // ═══ ③ 冰箱双门 ═══
  h += '<div style="font-weight:700;font-size:.72rem;margin:8px 0 4px">🧊 双开门冰箱</div>';
  var lowerOpen = _kOpen['comp_lower']||false, upperOpen = _kOpen['comp_upper']||false;
  h += '<div class="fridge-doors">';
  // 左门：冷冻
  h += '<div class="fridge-door-card'+(lowerOpen?' open':'')+'"><div class="fridge-door-head" onclick="_toggleFridgeComp(\'lower\')"><div class="fridge-door-handle"></div><div class="fridge-door-icon">🧊</div><div class="fridge-door-label">冷冻室</div><div class="fridge-door-temp">-18°C</div><div class="fridge-door-count">'+lowerItems.length+'件'+(lowerWarn?' <span style="color:#c8892e">⚠'+lowerWarn+'</span>':'')+'</div></div><div class="fridge-door-arrow">'+(lowerOpen?'▲ 收起':'▼ 展开')+'</div></div>';
  // 右门：冷藏
  h += '<div class="fridge-door-card'+(upperOpen?' open':'')+'"><div class="fridge-door-head" onclick="_toggleFridgeComp(\'upper\')"><div class="fridge-door-handle"></div><div class="fridge-door-icon">❄️</div><div class="fridge-door-label">冷藏室</div><div class="fridge-door-temp">0-4°C</div><div class="fridge-door-count">'+upperItems.length+'件'+(upperWarn?' <span style="color:#c8892e">⚠'+upperWarn+'</span>':'')+'</div></div><div class="fridge-door-arrow">'+(upperOpen?'▲ 收起':'▼ 展开')+'</div></div>';
  h += '</div>';
  // 物品面板
  h += '<div class="fridge-body-panel'+(lowerOpen?' open':'')+'"><div class="fridge-item" style="font-weight:600;color:#5a6e5c">🧊 冷冻室物品</div>';
  if (!lowerItems.length) h += '<div class="fridge-item" style="color:#999">冷冻室暂无物品</div>';
  else lowerItems.forEach(function(it){ h += _renderFridgeItem(it); });
  h += '</div>';
  h += '<div class="fridge-body-panel'+(upperOpen?' open':'')+'"><div class="fridge-item" style="font-weight:600;color:#5a6e5c">❄️ 冷藏室物品</div>';
  if (!upperItems.length) h += '<div class="fridge-item" style="color:#999">冷藏室暂无物品</div>';
  else upperItems.forEach(function(it){ h += _renderFridgeItem(it); });
  h += '</div>';

  // ═══ ④ 其他储物区（手风琴）═══
  var otherZones = [
    { id:'basket', icon:'🧺', name:'菜篮架', desc:'冰箱旁 · 常温蔬果' },
    { id:'spice', icon:'🧂', name:'调料区', desc:'橱柜下层' },
    { id:'noodle', icon:'🍜', name:'粉面区', desc:'橱柜中层' },
    { id:'delivery', icon:'📦', name:'快递区', desc:'入口右侧' }
  ];
  var invAll = (window.AppData && AppData._data.inventory) ? AppData._data.inventory : {};
  otherZones.forEach(function(z) {
    var zItems = (invAll[z.id]||[]).filter(function(it){ return it.status !== 'expired'; });
    var isOpen = _kOpen[z.id]||false;
    h += '<div class="mgmt-card" style="cursor:pointer;margin:4px 0;padding:8px 12px;text-align:left" onclick="_toggleKitchenZone(\''+z.id+'\')"><div style="display:flex;align-items:center;gap:8px"><span>'+z.icon+'</span><div style="flex:1"><div style="font-weight:600;font-size:.68rem">'+z.name+'</div><div style="font-size:.58rem;color:#999">'+z.desc+' · '+zItems.length+'件</div></div><span style="font-size:.6rem;color:#999">'+(isOpen?'▾':'▸')+'</span></div></div>';
    if (isOpen) {
      h += '<div style="padding:0 12px">';
      if (!zItems.length) h += '<div style="color:#999;font-size:.6rem;padding:4px 0">暂无物品</div>';
      else zItems.forEach(function(it){ h += _renderFridgeItem(it); });
      h += '</div>';
    }
  });

  // ═══ ⑤ 历史 ═══
  h += '<div class="mgmt-history"><div class="mas-title" style="margin-bottom:4px">📜 操作记录</div>';
  MGMT_DATA.kitchen.history.forEach(function(hi) {
    h += '<div class="mh-item">'+hi.date+' · '+hi.person+' · '+hi.action+' · '+hi.item+(hi.location?' @'+hi.location:'')+'</div>';
  });
  h += '</div>';

  return h;
}

function _itemExpired(it) {
  if (!it.expiryDays || !it.putDate) return 'ok';
  var daysLeft = it.expiryDays - Math.floor((new Date() - new Date(it.putDate+'T00:00:00'))/86400000);
  if (daysLeft <= 0) return 'expired';
  if (daysLeft <= 2) return 'warn';
  return 'fresh';
}

function _renderFridgeItem(it) {
  var status = _itemExpired(it);
  var tag = {fresh:'🟢新鲜', warn:'⚠剩'+(it.expiryDays-Math.floor((new Date()-new Date(it.putDate+'T00:00:00'))/86400000))+'天', expired:'❌过期'}[status]||'';
  var cls = 'fi-tag '+(status==='expired'?'expired':status==='warn'?'warn':'fresh');
  return '<div class="fridge-item">📦 '+it.name+' · '+(it.putBy||'')+' · '+(it.putDate||'')+' <span class="'+cls+'">'+tag+'</span></div>';
}

function _toggleFridgeComp(comp) { _kOpen['comp_'+comp] = !_kOpen['comp_'+comp]; _rerenderKitchen(); }
function _toggleKitchenZone(zid) { _kOpen[zid] = !_kOpen[zid]; _rerenderKitchen(); }

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
  _syncItemToAppData(action, item, location, false, 'office');
  _rerenderKitchen();
}
// Step 2: 物品操作同步到 AppData + NT 奖励（skipVerify=true 时只同步库存，校核记录由调用方写）
function _syncItemToAppData(action, itemName, location, skipVerify, spaceOverride) {
  if (!window.AppData) return;
  var inv = AppData._data.inventory;
  // 厨房面板从全貌页打开时 curBuilding 是 info，会写错空间导致冰箱永不更新；
  // 调用方可传 spaceOverride 强制目标空间（厨房固定 'office'）
  var spaceId = spaceOverride || (curBuilding()||{}).id || 'unknown';
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
  var cl = AppData._data.cleaning = AppData._data.cleaning || {};
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
    var rate = _dirtinessRates()[_getSpaceType(b.id)] || 5;
    if (!cl.spaces[b.id]) {
      cl.spaces[b.id] = { dirtiness: Math.min(100, rate * daysPassed), lastCleaned: '', cleanedBy: '', dailyGrowthBase: rate };
    } else {
      // H-5 修复：旧数据缺 dailyGrowthBase 或 dirtiness → NaN 扩散，加 || 兜底
      cl.spaces[b.id].dirtiness = Math.min(100, (cl.spaces[b.id].dirtiness||0) + (cl.spaces[b.id].dailyGrowthBase||rate) * daysPassed);
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
  if (window.AppData) AppData.addVerification('cleaning', me, '打扫了 '+spaceId, { space: spaceId }, cleanReward, AppData._verifierReward(cleanReward));
  // 写入卡片室
  var discs = AppData._data.cardDiscoveries || (AppData._data.cardDiscoveries = []);
  discs.unshift({ id:'sr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6), spaceId:spaceId, spaceName:spaceId, actionId:'cleaning', actionLabel:'打扫了 '+spaceId, description:'打扫了 '+spaceId, guesser:CURRENT_USER, guessedPerson:CURRENT_USER, guessedAt:new Date().toISOString(), status:'pending', ntGuesser:0, ntDoer:cleanReward, isSelfReport:true, createdAt:new Date().toISOString() });
  if (discs.length > 200) discs.length = 200;
  // Step 5: 大扫除触发 CV 解冻 + 新手任务
  if (typeof _unfreezeCV === 'function') _unfreezeCV(me);
  // C5: 大扫除不再属于新手引导任务
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
    console.log('[U-1b] _initMap 开始, AppData._data.map_locations: acc=', (window.AppData&&AppData._data.map_locations&&AppData._data.map_locations.accommodations)?Object.keys(AppData._data.map_locations.accommodations).length:'N/A', 'plots=', (window.AppData&&AppData._data.map_locations&&AppData._data.map_locations.plots)?AppData._data.map_locations.plots.length:'N/A', 'buildings=', (window.AppData&&AppData._data.map_locations&&AppData._data.map_locations.buildings)?AppData._data.map_locations.buildings.length:'N/A');
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
    // D3: 启动时拉取服务端公约文本（异步，不阻塞渲染）
    if (typeof API !== 'undefined' && API.token) {
      API.covenantText().then(function(r) {
        if (r && r.version) _covenantTextCache = r;  // 服务端直接返回 config 对象
      }).catch(function(){ /* 静默失败，_covenantText() 回落 config */ });
    }
    if(!_mapContainer){currentIdx=4;currentFloor=0;selectedRoomId=null;overviewOpen=false;_bindEvents();}
    else { currentIdx=4;currentFloor=0;selectedRoomId=null;overviewOpen=false; }
    console.log('[U-1b] _initMap → goTo(4), getBuildings()=', getBuildings().length, '个建筑, getPlots()=', getPlots().length, '个地块');
    goTo(4);
    if(typeof refreshUserUI==='function') refreshUserUI();
    _refreshTopBar();
  }catch(e){console.error('[Map] init failed:',e);if(window.Game&&Game.toast) Game.toast('地图加载失败，请刷新');}
}
// 刷新顶栏统计数字——从真实数据源读取
function _refreshTopBar() {
  var dateEl = document.getElementById('ubStatDate');
  var weatherEl = document.getElementById('ubStatWeather');
  var stayEl = document.getElementById('ubStatStay');
  var peopleEl = document.getElementById('ubStatPeople');
  var tasksEl = document.getElementById('ubStatTasks');
  if (dateEl) dateEl.textContent = '📅 ' + new Date().toISOString().slice(0,10);
  if (weatherEl) {
    var m = new Date().getMonth() + 1;
    var weather = (m >= 3 && m <= 5) ? '🌸 春' : (m >= 6 && m <= 8) ? '☀️ 夏' : (m >= 9 && m <= 11) ? '🍂 秋' : '❄️ 冬';
    weatherEl.textContent = weather;
  }
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
  _promptDialog('✏️ 编辑「'+roomId+'」的物品\n\n当前物品：\n'+list+'\n\n输入: +图标 名称 状态 来添加\n输入: -编号 来删除\n或点取消关闭', '', function(action){
    if (!action) return;
    var ml = (window.AppData&&AppData._data.map_locations) ? AppData._data.map_locations : null;
    if (!ml) return;
    ml.state = ml.state || {}; ml.state.room_items = ml.state.room_items || [];
    if (action.charAt(0)==='-') {
      var idx = parseInt(action.slice(1),10);
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
    render();
  });
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
    showConfirm('帮 '+targetName+' 翻牌？将扣你 1 NT 作为提醒代价。', _cb);
  }
}
// ═══ 铃铛面板（校核 + 新手 + 整洁度）═══
function _openVerificationPanel() {
  var me = _me();
  var h = '';
  // ── 新手引导 ──
  // E3.4: 新手引导统一走 data.js NEWBIE_QUESTS
  var steps = (typeof NEWBIE_QUESTS !== 'undefined') ? NEWBIE_QUESTS : [];
  var quests = (window.AppData && AppData._data.newbieQuests && AppData._data.newbieQuests[me]) || [];
  var doneCount = quests.length ? steps.filter(function(s){ var q = quests.find(function(x){ return x.id === s.id; }); return q && q.done; }).length : 0;
  if (steps.length && doneCount < steps.length) {
    var pct = Math.round(doneCount / steps.length * 100);
    h += '<div style="background:#f0f8f0;border-radius:8px;padding:8px 10px;margin-bottom:8px;cursor:pointer" onclick="var el=document.querySelector(\'.vfy-popup\');if(el)el.remove();_showAlertCard({message:\'新手引导在首页下方查看\'})"><div style="font-weight:700;font-size:.7rem">🌱 新手引导 ('+doneCount+'/'+steps.length+')</div><div style="height:4px;background:#ddd;border-radius:2px;margin:4px 0"><div style="height:100%;width:'+pct+'%;background:var(--green-primary);border-radius:2px"></div></div><div style="font-size:.55rem;color:#999">点击查看详情</div></div>';
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
    h += '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:8px;padding:8px 10px;margin-bottom:4px;font-size:.62rem">';
    h += '<div style="display:flex;justify-content:space-between"><b style="color:#1d2e24">'+icons[v.type]+' '+(v.doer||'系统')+'</b><span style="color:var(--green-primary)">+'+v.ntAmount+' NT</span></div>';
    h += '<div style="color:#666;font-size:.55rem">'+v.action+'</div>';
    if (!isMe) { h += '<button class="btn-sm pri" style="font-size:.55rem;padding:2px 6px;margin-top:2px" onclick="event.stopPropagation();_doVerify(\''+v.id+'\')">✓ 校核 +'+v.verifierReward+'NT</button>'; }
    else { h += '<div style="color:#666;font-size:.55rem">等待他人校核</div>'; }
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
    // D-5: HTTP 模式——toast 反馈 + 关闭 popup，消按钮 disabled 无声
    showToast('⏳ 校核已提交，等待确认', 'ok');
    var _vp = document.querySelector('.vfy-popup'); if (_vp) _vp.remove();
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
    showToast('请先入住才能使用厨房功能\n前往 🏠 住宿页面 → 入住', 'warn'); return;
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
  if (sel) sel.innerHTML = icon + ' ' + esc(name);
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
    showToast('请先入住才能操作厨房物品\n前往 🏠 住宿页面 → 入住', 'warn'); return;
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
    _syncItemToAppData(actionMap[act.action] || act.action, sel.name, '', true, ((curBuilding()||{}).id === 'study' ? 'study' : 'office'));
    AppData.addVerification(act.action, _me(), fullNote, { item: sel.name, action: act.action, space: ((curBuilding()||{}).id === 'study' ? 'study' : 'office') }, act.nt, AppData._verifierReward(act.nt));
    // 写入卡片室
    var spaceId = (curBuilding()||{}).id === 'study' ? 'study' : 'office';
    var bld = getBuildings().find(function(b){ return b.id === spaceId; });
    var spaceName = bld ? bld.name : spaceId;
    var discs = AppData._data.cardDiscoveries || (AppData._data.cardDiscoveries = []);
    discs.unshift({ id:'sr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6), spaceId:spaceId, spaceName:spaceName, actionId:act.action, actionLabel:act.label, description:act.label+' '+name+(note?' · '+note:''), guesser:CURRENT_USER, guessedPerson:CURRENT_USER, guessedAt:new Date().toISOString(), status:'pending', ntGuesser:0, ntDoer:act.nt, isSelfReport:true, createdAt:new Date().toISOString() });
    if (discs.length > 200) discs.length = 200;
  }
  _closeQuickSheet();
  showToast('✅ '+act.label+' '+name, 'ok');
}

// ── 田地 ──
function _openFarmQuick() {
  var pricing = _mlConfig().farming_pricing;
  var actionDefs = [
    { label:'🌾收割', key:'harvest', nt:pricing.harvest },
    { label:'💧浇水', key:'water', nt:pricing.water },
    { label:'🌱种植', key:'plant', nt:pricing.plant },
    { label:'🪴施肥', key:'fertilize', nt:pricing.fertilize },
    { label:'🧹除草', key:'weed', nt:pricing.weed },
    { label:'👀查看', key:'view', nt:pricing.view }
  ];
  var plots = getPlots();
  var body = '<div id="qfActions" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">'+actionDefs.map(function(a){ return '<div class="quick-sheet__preset-btn" data-action-key="'+a.key+'" onclick="var s=this;var p=this.parentElement;var prev=p.querySelector(\'[data-selected]\');if(prev&&prev!==s){prev.removeAttribute(\'data-selected\');prev.style.background=\'\';prev.style.color=\'\'}if(s.hasAttribute(\'data-selected\')){s.removeAttribute(\'data-selected\');s.style.background=\'\';s.style.color=\'\'}else{s.setAttribute(\'data-selected\',\'1\');s.style.background=\'var(--green-primary)\';s.style.color=\'#fff\'}" style="padding:6px 10px;border:1px solid #d0d9ce;border-radius:8px;cursor:pointer;font-size:.65rem;min-width:44px;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">'+a.label+'<span style="font-size:.45rem;color:#8a6a20">+'+a.nt+'NT</span></div>'; }).join('')+'</div>'+
    '<div id="qfPlots" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">'+plots.map(function(p){ return '<div class="quick-sheet__preset-btn" style="padding:6px 10px;border:1px solid #d0d9ce;border-radius:8px;cursor:pointer;font-size:.6rem" onclick="var s=this;var pa=this.parentElement;var prev=pa.querySelector(\'[data-selected]\');if(prev&&prev!==s){prev.removeAttribute(\'data-selected\');prev.style.background=\'\';prev.style.color=\'\'}if(s.hasAttribute(\'data-selected\')){s.removeAttribute(\'data-selected\');s.style.background=\'\';s.style.color=\'\'}else{s.setAttribute(\'data-selected\',\'1\');s.style.background=\'var(--green-primary)\';s.style.color=\'#fff\'}">'+p.icon+' '+p.name+'</div>'; }).join('')+'</div>'+
    '<input id="qfFarmNote" placeholder="备注（选填）" style="width:100%;padding:8px;border:1px solid #d0d9ce;border-radius:8px;font-size:.7rem;margin-bottom:6px">'+
    '<button class="quick-sheet__submit" onclick="_submitFarmEntry()" style="width:100%;padding:10px;background:var(--green-primary);color:#fff;border:none;border-radius:10px;font-size:.75rem;font-weight:700;min-height:44px">✓ 确认记录</button>';
  _openQuickSheet('🌿 农活记录', body);
}
function _submitFarmEntry() {
  // 读选中的动作 + 田块
  var actionBtn = document.querySelector('#qfActions .quick-sheet__preset-btn[data-selected]');
  var plotBtn = document.querySelector('#qfPlots .quick-sheet__preset-btn[data-selected]');
  var actionKey = actionBtn ? actionBtn.getAttribute('data-action-key') : '';
  var action = actionBtn ? actionBtn.textContent.replace(/\+.*/,'').trim() : '农活';
  var plot = plotBtn ? plotBtn.textContent : '';
  var note = (document.getElementById('qfFarmNote')||{}).value || '';
  var desc = action + (plot ? ' @'+plot : '') + (note ? ' · '+note : '');
  var pricing = _mlConfig().farming_pricing;
  var nt = actionKey ? (pricing[actionKey] || 5) : 5;
  if (window.AppData) AppData.addVerification('field_action', _me(), desc, { action:action, plot:plot, actionKey:actionKey }, nt, AppData._verifierReward(nt));
  // 写入卡片室
  var discs = AppData._data.cardDiscoveries || (AppData._data.cardDiscoveries = []);
  discs.unshift({ id:'sr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6), spaceId:plot, spaceName:plot, actionId:actionKey, actionLabel:action, description:action+' @'+plot+(note?' · '+note:''), guesser:CURRENT_USER, guessedPerson:CURRENT_USER, guessedAt:new Date().toISOString(), status:'pending', ntGuesser:0, ntDoer:nt, isSelfReport:true, createdAt:new Date().toISOString() });
  if (discs.length > 200) discs.length = 200;
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
    AppData.addVerification('cleaning', _me(), '打扫了 '+spaceName, { space: spaceName }, reward, AppData._verifierReward(reward));
    // 写入卡片室
    var discs = AppData._data.cardDiscoveries || (AppData._data.cardDiscoveries = []);
    discs.unshift({ id:'sr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6), spaceId:spaceId, spaceName:spaceName, actionId:'cleaning', actionLabel:'打扫了 '+spaceName, description:'打扫了 '+spaceName, guesser:CURRENT_USER, guessedPerson:CURRENT_USER, guessedAt:new Date().toISOString(), status:'pending', ntGuesser:0, ntDoer:reward, isSelfReport:true, createdAt:new Date().toISOString() });
    if (discs.length > 200) discs.length = 200;
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
function closeQuickSheet(){ _closeQuickSheet(); }
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
