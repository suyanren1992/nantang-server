// ══ 卡片室 — 扑克牌桌「猜谁在干活」══
// 2026-07-20 v2 · 每人一次猜测 · 扑克牌网格 · 世界喇叭 · NT 1/0.1
// 流程：发起发现 → 选空间→自由描述→猜人（每人一次）→确认→喇叭播报→+1NT
//       上报劳动 → 选空间→选劳动→补充说明→校核队列

// ══ 世界喇叭 ══
function _trumpet(msg, type) {
  var el = document.createElement('div');
  var bg = type === 'golden' ? 'linear-gradient(135deg,#5a3a10,#8a5a20)' : 'linear-gradient(135deg,#5a4a20,#8a6a30)';
  var icon = type === 'streak' ? '🔥' : (type === 'golden' ? '🌟' : '🎺');
  el.innerHTML = icon + ' ' + msg;
  el.style.cssText = 'position:fixed;bottom:70px;left:8px;right:8px;z-index:500;background:'+bg+';color:#ffd700;padding:10px 16px;border-radius:12px;font-size:.72rem;font-weight:600;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.35);animation:trumpetIn .3s ease-out;pointer-events:none;letter-spacing:.02em';
  document.body.appendChild(el);
  setTimeout(function(){ el.style.transition='opacity .4s,transform .4s'; el.style.opacity='0'; el.style.transform='translateY(15px)'; }, 3500);
  setTimeout(function(){ if(el.parentNode) el.remove(); }, 4000);
}
// trumpet keyframe
var _trumpetStyle = document.createElement('style');
_trumpetStyle.textContent = '@keyframes trumpetIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
document.head.appendChild(_trumpetStyle);

// ═══════════════════════════════════════════════
// 从公约配置读取劳动定价（公约上没有的用硬编码默认值）
// ═══════════════════════════════════════════════
var _LABOR_NT_DEFAULTS = {
  sweep_mop:10, wipe_surface:8, take_trash:5, organize_items:8, clean_window:10,
  clean_toilet:15, clean_kitchen:15, clean_public:12,
  water:5, fertilize:8, weed:10, sow:8, harvest:15, turn_soil:12,
  trellis:10, pest_control:8, mulch:8, prune:8,
  chef:20, sous_chef:12, wash_dishes:10, prep_food:8, clean_stove:12, grocery:5, serve_meal:5,
  repair:15, move_goods:12, organize_warehouse:10, waste_sort:8, compost:8, change_light:8,
  reception:8, tour_guide:10, event_setup:12, event_cleanup:10, animal_care:8, notice_board:5,
  painting:15, calligraphy:10, craft:12, photo_video:8, writing:8,
  mow_lawn:12, weed_pick:8
};

function _getLaborNT(actionId) {
  // 优先从公约配置读取
  try {
    var cfg = typeof _mlConfig === 'function' ? _mlConfig() : null;
    if (cfg && cfg.labor_pricing && typeof cfg.labor_pricing[actionId] === 'number') {
      return cfg.labor_pricing[actionId];
    }
  } catch(e) {}
  // fallback 到默认值
  return _LABOR_NT_DEFAULTS[actionId] || 5;
}

// ═══════════════════════════════════════════════
// 硬编码劳动类型（NT 值仅作显示默认，实际从 _getLaborNT 读取）
// ═══════════════════════════════════════════════
var LABOR_ACTIONS = [
  { category:'🧹 整理打扫', icon:'🧹', actions:[
    { id:'sweep_mop', label:'扫地拖地', nt:10 },
    { id:'wipe_surface', label:'擦台面/桌面', nt:8 },
    { id:'take_trash', label:'倒垃圾', nt:5 },
    { id:'organize_items', label:'整理物品', nt:8 },
    { id:'clean_window', label:'擦窗户', nt:10 },
    { id:'clean_toilet', label:'清洗卫生间', nt:15 },
    { id:'clean_kitchen', label:'清洗厨房油污', nt:15 },
    { id:'clean_public', label:'公共区域打扫', nt:12 }
  ]},
  { category:'🌿 田间管理', icon:'🌿', actions:[
    { id:'water', label:'浇水', nt:5 },
    { id:'fertilize', label:'施肥', nt:8 },
    { id:'weed', label:'除草', nt:10 },
    { id:'sow', label:'播种/移栽', nt:8 },
    { id:'harvest', label:'收割/采摘', nt:15 },
    { id:'turn_soil', label:'翻土整地', nt:12 },
    { id:'trellis', label:'搭架/牵藤/绑枝', nt:10 },
    { id:'pest_control', label:'除虫/喷药', nt:8 },
    { id:'mulch', label:'覆膜/铺草', nt:8 },
    { id:'prune', label:'修剪/摘叶/打杈', nt:8 }
  ]},
  { category:'🍳 帮厨做饭', icon:'🍳', actions:[
    { id:'chef', label:'主厨', nt:20 },
    { id:'sous_chef', label:'帮厨切菜/备料', nt:12 },
    { id:'wash_dishes', label:'洗碗/收拾餐桌', nt:10 },
    { id:'prep_food', label:'择菜/洗菜', nt:8 },
    { id:'clean_stove', label:'清理灶台/油烟机', nt:12 },
    { id:'grocery', label:'采购食材', nt:5 },
    { id:'serve_meal', label:'打饭/端菜', nt:5 }
  ]},
  { category:'🔧 日常维护', icon:'🔧', actions:[
    { id:'repair', label:'修理物品/设备', nt:15 },
    { id:'move_goods', label:'搬运/卸货', nt:12 },
    { id:'organize_warehouse', label:'整理仓库/工具', nt:10 },
    { id:'waste_sort', label:'垃圾分类/回收', nt:8 },
    { id:'compost', label:'堆肥管理', nt:8 },
    { id:'change_light', label:'换灯泡/简单电工', nt:8 }
  ]},
  { category:'🤝 社区服务', icon:'🤝', actions:[
    { id:'reception', label:'接待来访/介绍社区', nt:8 },
    { id:'tour_guide', label:'带人参观/导览', nt:10 },
    { id:'event_setup', label:'活动布置/搭场地', nt:12 },
    { id:'event_cleanup', label:'活动收尾/清场', nt:10 },
    { id:'animal_care', label:'喂猫/遛狗/照看动物', nt:8 },
    { id:'notice_board', label:'更新公告栏/通知', nt:5 }
  ]},
  { category:'🎨 创作', icon:'🎨', actions:[
    { id:'painting', label:'绘画/壁画', nt:15 },
    { id:'calligraphy', label:'书法', nt:10 },
    { id:'craft', label:'手工/木工/编织', nt:12 },
    { id:'photo_video', label:'拍照/录视频记录', nt:8 },
    { id:'writing', label:'写作/文案', nt:8 }
  ]},
  { category:'📝 自定义', icon:'✏️', actions:[
    { id:'_custom', label:'其他劳动（手动输入）', nt:5, custom:true }
  ]}
];

function _findAction(id) {
  for (var i = 0; i < LABOR_ACTIONS.length; i++) {
    var cat = LABOR_ACTIONS[i];
    for (var j = 0; j < cat.actions.length; j++) {
      if (cat.actions[j].id === id) return { category:cat.category, icon:cat.icon, action:cat.actions[j] };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════
// 空间类型 → 智能推荐劳动
// 每个 roomId 归到一种空间类型，每种类型有对应的劳动列表
// ═══════════════════════════════════════════════
function _getSpaceType(roomId) {
  if (/kitchen/.test(roomId)) return 'kitchen';
  if (/toilet|washroom/.test(roomId)) return 'washroom';
  if (/wash_study/.test(roomId)) return 'washstand';
  if (/studio/.test(roomId)) return 'studio';
  if (/office/.test(roomId)) return 'office';
  if (/storage|attic/.test(roomId)) return 'storage';
  if (/farm_equipment/.test(roomId)) return 'equipment';
  if (/hall/.test(roomId)) return 'hall';
  if (/corridor/.test(roomId)) return 'corridor';
  if (/market/.test(roomId)) return 'market';
  if (/dorm/.test(roomId)) return 'dorm';
  if (/rooftop/.test(roomId)) return 'rooftop';
  if (/laundry/.test(roomId)) return 'laundry';
  if (/bar/.test(roomId)) return 'bar';
  if (/mahjong/.test(roomId)) return 'gameroom';
  if (/^f[a-e]$/.test(roomId)) return 'field';
  if (/field/.test(roomId)) return 'field';
  if (/lawn/.test(roomId)) return 'lawn';
  if (/pavilion|jingzi/.test(roomId)) return 'pavilion';
  if (/plaza/.test(roomId)) return 'plaza';
  if (/stage/.test(roomId)) return 'stage';
  if (/parking|gate/.test(roomId)) return 'outdoor';
  if (/compost/.test(roomId)) return 'compost';
  return 'common';
}

// 每种空间类型 → 可做的劳动 ID（从 LABOR_ACTIONS 中筛选）
var SPACE_ACTIONS = {
  kitchen:   ['sweep_mop','wipe_surface','take_trash','clean_kitchen','organize_items','chef','sous_chef','wash_dishes','prep_food','clean_stove','grocery','serve_meal','waste_sort'],
  washroom:  ['clean_toilet','sweep_mop','take_trash','wipe_surface','organize_items','change_light'],
  washstand: ['wipe_surface','take_trash','sweep_mop','organize_items'],
  studio:    ['sweep_mop','wipe_surface','organize_items','take_trash','clean_window','painting','calligraphy','craft','photo_video'],
  office:    ['sweep_mop','wipe_surface','organize_items','take_trash','clean_window','writing','reception'],
  storage:   ['organize_warehouse','move_goods','sweep_mop','take_trash','waste_sort'],
  equipment: ['repair','organize_warehouse','move_goods','sweep_mop','change_light'],
  hall:      ['sweep_mop','wipe_surface','clean_public','organize_items','take_trash','event_setup','event_cleanup','reception','tour_guide','notice_board'],
  corridor:  ['sweep_mop','clean_public','take_trash'],
  market:    ['organize_items','sweep_mop','grocery','move_goods','take_trash','wipe_surface'],
  dorm:      ['sweep_mop','wipe_surface','organize_items','take_trash','clean_window'],
  rooftop:   ['sweep_mop','clean_public','organize_items','take_trash'],
  laundry:   ['organize_items','sweep_mop','take_trash','clean_public'],
  bar:       ['wipe_surface','sweep_mop','organize_items','take_trash','reception'],
  gameroom:  ['sweep_mop','wipe_surface','organize_items','take_trash','clean_window'],
  field:     ['water','fertilize','weed','sow','harvest','turn_soil','trellis','pest_control','mulch','prune','compost'],
  lawn:      ['mow_lawn','weed_pick','clean_public','take_trash','compost','event_setup'],
  pavilion:  ['clean_public','sweep_mop','take_trash','wipe_surface','event_setup','event_cleanup'],
  plaza:     ['clean_public','sweep_mop','take_trash','event_setup','event_cleanup','weed_pick'],
  stage:     ['clean_public','sweep_mop','take_trash','organize_items','event_setup','event_cleanup'],
  outdoor:   ['clean_public','sweep_mop','take_trash','weed_pick','move_goods'],
  compost:   ['compost','waste_sort','organize_items','move_goods'],
  common:    ['sweep_mop','wipe_surface','take_trash','organize_items','clean_public']
};

// 补充：LABOR_ACTIONS 中新增两项
// 在 _findAction 中兼容：如果找不到 action，从 flat list 中找
var _EXTRA_ACTIONS = {
  mow_lawn:   { label:'修剪草坪', nt:12, icon:'🌿' },
  weed_pick:  { label:'捡垃圾/拔杂草', nt:8, icon:'🧤' }
};

// 根据 spaceId 获取推荐劳动列表，NT 值从公约实时读取
function _getActionsForSpace(spaceId) {
  var type = _getSpaceType(spaceId);
  var actionIds = SPACE_ACTIONS[type] || SPACE_ACTIONS['common'];
  var result = [];
  var seen = {};
  actionIds.forEach(function(aid) {
    var found = _findAction(aid);
    var nt = _getLaborNT(aid);
    if (found) {
      if (!seen[aid]) {
        seen[aid] = true;
        result.push({ category:found.category, icon:found.icon, action:{ id:aid, label:found.action.label, nt:nt } });
      }
    } else if (_EXTRA_ACTIONS[aid]) {
      var ea = _EXTRA_ACTIONS[aid];
      if (!seen[aid]) {
        seen[aid] = true;
        result.push({ category:'', icon:ea.icon, action:{ id:aid, label:ea.label, nt:nt } });
      }
    } else {
      // 纯公约定义的 action
      if (!seen[aid]) {
        seen[aid] = true;
        result.push({ category:'', icon:'📍', action:{ id:aid, label:aid, nt:nt } });
      }
    }
  });
  return result;
}

// ═══════════════════════════════════════════════
// 空间列表（从 map_locations + 建筑楼层展开）
// ═══════════════════════════════════════════════
var _CARD_ROOM_SPACES = null;

function _getCardRoomSpaces() {
  if (_CARD_ROOM_SPACES) return _CARD_ROOM_SPACES;

  // 先确保建筑数据已写入 AppData
  if (typeof getBuildings === 'function') getBuildings();

  var ml = (window.AppData && AppData._data.map_locations) ? AppData._data.map_locations : {};
  var buildings = (ml.buildings && ml.buildings.length > 0) ? ml.buildings
    : (typeof HARDCODED_BUILDINGS !== 'undefined' ? HARDCODED_BUILDINGS : []);

  var list = [];
  var seen = {};

  // 遍历建筑 — 有楼层的展开每个房间，无楼层的加建筑名
  buildings.forEach(function(b) {
    if (b.id === 'info') return; // 跳过南塘全貌
    var fKeys = Object.keys(b.floors || {});
    if (fKeys.length > 0) {
      fKeys.forEach(function(fName) {
        (b.floors[fName] || []).forEach(function(room) {
          if (!seen[room.id]) {
            seen[room.id] = true;
            list.push({ id: room.id, name: b.name + ' › ' + room.name, icon: room.icon || '📍', building: b.name });
          }
        });
      });
    } else {
      if (!seen[b.id]) {
        seen[b.id] = true;
        list.push({ id: b.id, name: b.name, icon: b.icon || '📍', building: '' });
      }
    }
  });

  // 田地单独展开 — 优先从 buildings 里找 field 的 plots
  var fieldBld = buildings.find(function(b){ return b.id === 'field'; });
  var allPlots = (ml.plots && ml.plots.length > 0) ? ml.plots : (fieldBld && fieldBld.plots ? fieldBld.plots : []);
  allPlots.forEach(function(p) {
    if (!seen[p.id]) {
      seen[p.id] = true;
      list.push({ id: p.id, name: '田地 › ' + p.name, icon: p.icon || '🌿', building: '田地' });
    }
  });

  _CARD_ROOM_SPACES = list;
  return list;
}

function _spaceLabel(id) {
  var map = {
    // 社区大楼
    community_hall:'社区大厅', community_market:'社区超市', storage:'小仓库', kitchen:'厨房',
    public_office:'公共办公室', toilet_r:'卫生间', backyard_corridor:'通往后院的走廊',
    studio:'画室', washroom:'洗浴室', farm_equipment:'农机室', biao_office:'标哥办公室',
    rooftop:'天台', laundry_room:'晾衣间',
    // 大地书房
    bar:'吧台', main_hall:'正厅', toilet_study:'卫生间', wash_study:'洗漱台',
    corridor_study:'走廊楼梯', mahjong:'麻将室', kitchen_study:'大地厨房',
    dorm101:'A室·大通铺', dorm102:'B室·大通铺', dorm103:'C室·上下床+大床',
    dorm104:'D室·单间大床房', dorm105:'E室·上下床', dorm106:'F室·上下床',
    attic:'阁楼储物',
    // 独立空间
    toilet_b:'公共厕所', parking:'B门·停车', gate_a:'A门',
    plaza:'硕区广场', stage:'戏台·花坛',
    jingzi_pavilion:'敬字亭', lawn:'大地草坪',
    // 田地
    fa:'田地A区', fb:'田地B区', fc:'田地C区', fd:'田地D区', fe:'田地E区',
    // 兼容旧ID
    office_r:'公共办公室', reading:'正厅', study_r:'公共办公室'
  };
  return map[id] || id;
}

function _spaceIcon(id) {
  var map = {
    bar:'🍸', main_hall:'🏛️', toilet_study:'🚻', wash_study:'🪥',
    corridor_study:'🚶', kitchen_study:'🍳', mahjong:'🀄', attic:'📦',
    community_hall:'🏛️', community_market:'🛒', public_office:'💼',
    backyard_corridor:'🚶', washroom:'🚿', farm_equipment:'🔧', biao_office:'👔',
    rooftop:'🌤️', laundry_room:'👕',
    toilet_b:'🚻', parking:'🅿️', gate_a:'🚪',
    plaza:'🏛️', stage:'🎭', field:'🌿',
    jingzi_pavilion:'🛕', lawn:'🌿',
    fa:'🥬', fb:'🌽', fc:'🍠', fd:'🌳', fe:'🍂'
  };
  if (map[id]) return map[id];
  if (id.indexOf('kitchen') !== -1) return '🍳';
  if (id.indexOf('studio') !== -1) return '🎨';
  if (id.indexOf('storage') !== -1 || id.indexOf('attic') !== -1) return '📦';
  if (id.indexOf('toilet') !== -1 || id.indexOf('wash') !== -1) return '🚿';
  if (id.indexOf('dorm') !== -1) return '🛏';
  if (id.indexOf('office') !== -1) return '💼';
  if (id.indexOf('corridor') !== -1) return '🚶';
  if (id.indexOf('rooftop') !== -1) return '🌤️';
  return '📍';
}

// ═══════════════════════════════════════════════
// 发现数据
// ═══════════════════════════════════════════════
function _getDiscoveries() {
  if (!window.AppData) return [];
  if (!AppData._data.cardDiscoveries || !Array.isArray(AppData._data.cardDiscoveries)) AppData._data.cardDiscoveries = [];
  return AppData._data.cardDiscoveries;
}
function _saveDiscoveries() {
  if (window.AppData) AppData._saveShared();
}

function _expireOldDiscoveries() {
  var discs = _getDiscoveries();
  var now = Date.now();
  var changed = false;
  discs.forEach(function(d) {
    if (d.status === 'pending' && (now - new Date(d.createdAt).getTime()) > 86400000) {
      d.status = 'expired';
      d.expiredAt = new Date().toISOString();
      if (window.NT && d.ntGuesser > 0) {
        NT.spend(d.guesser, 1, '超时扣除: ' + (d.actionLabel||d.description), 'personal');
      }
      if (typeof logActivity === 'function') {
        logActivity('discovery_expired', d.guesser + ' 的发现超时未确认，-1 NT');
      }
      changed = true;
    }
  });
  if (changed) _saveDiscoveries();
}

// ═══════════════════════════════════════════════
// 卡片室主界面
// ═══════════════════════════════════════════════
function openCardRoom() {
  _expireOldDiscoveries();
  _CARD_ROOM_SPACES = null;
  if (typeof getBuildings === 'function') getBuildings();
  var el = document.getElementById('overlayCardRoom');
  if (!el) { showToast('卡片室模块未加载', 'error'); return; }
  el.classList.add('open');
  renderCardRoom();
}

function closeCardRoom() {
  var el = document.getElementById('overlayCardRoom');
  if (el) el.classList.remove('open');
}

var _cardFilter = '全部';
function renderCardRoom() {
  var el = document.getElementById('cardRoomBody');
  if (!el) return;
  var discs = _getDiscoveries();
  var sevenDaysAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  var recentDiscs = discs.filter(function(d) { return d.createdAt.slice(0, 10) >= sevenDaysAgo; });
  var pending = recentDiscs.filter(function(d) { return d.status === 'pending'; });
  var resolved = recentDiscs.filter(function(d) { return d.status === 'confirmed' || d.status === 'expired'; });
  var today = new Date().toISOString().slice(0,10);
  var todayResolved = resolved.filter(function(d){ return d.doerConfirmedAt && d.doerConfirmedAt.slice(0,10) === today; });
  // 计算资金池（粗略：按公约定价累加今日已揭卡片的 NT）
  var poolNT = 0; resolved.forEach(function(d){ poolNT += d.ntDoer||0; });

  var h = '';

  // ── 顶部庄家信息 ──
  h += '<div style="background:linear-gradient(135deg,#2a1f0a,#4a3820);color:#ffd700;border-radius:12px;padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">';
  h += '<div><div style="font-size:.7rem;font-weight:700">🎴 庄家：社区资金池</div><div style="font-size:.55rem;opacity:.8">💰 池余额 '+poolNT+' NT · 今日已揭 '+todayResolved.length+' 张</div></div>';
  h += '<div style="font-size:1.5rem">🃏</div>';
  h += '</div>';

  // ── 搜索 ──
  h += '<div style="margin-bottom:6px"><input type="text" placeholder="🔍 搜索空间或劳动…" oninput="renderCardRoom()" id="cardSearchInput" style="width:100%;padding:6px 10px;border:1px solid #d0d9ce;border-radius:8px;font-size:.62rem;background:#fff;box-sizing:border-box"></div>';

  // ── 筛选 chips ──
  var chips = [{k:'全部',l:'全部'},{k:'pending',l:'⏳待揭'},{k:'confirmed',l:'✅已揭'},{k:'expired',l:'⏰过期'}];
  h += '<div style="display:flex;gap:5px;margin-bottom:8px;overflow-x:auto;-webkit-overflow-scrolling:touch">';
  chips.forEach(function(c){
    var cnt = c.k==='全部' ? recentDiscs.length : recentDiscs.filter(function(d){return d.status===c.k;}).length;
    var sel = _cardFilter === c.k;
    h += '<div onclick="_cardFilter=\''+c.k+'\';renderCardRoom()" style="flex-shrink:0;padding:4px 10px;border-radius:14px;font-size:.6rem;cursor:pointer;border:1.5px solid '+(sel?'var(--green-primary)':'#d0d9ce')+';background:'+(sel?'#e8f0e8':'#fff')+';font-weight:'+(sel?'600':'400')+'">'+c.l+' '+(cnt||0)+'</div>';
  });
  h += '</div>';

  // ── 过滤 ──
  var kw = (document.getElementById('cardSearchInput')||{}).value||'';
  var show = recentDiscs;
  if (_cardFilter !== '全部') show = recentDiscs.filter(function(d){ return d.status === _cardFilter; });
  if (kw) { kw = kw.trim().toLowerCase(); show = show.filter(function(d){ return (d.spaceName||'').toLowerCase().indexOf(kw)!==-1 || (d.actionLabel||'').toLowerCase().indexOf(kw)!==-1; }); }

  if (!show.length) {
    h += '<div style="text-align:center;padding:30px;color:#aaa;font-size:.7rem">🃏 暂无此分类的牌</div>';
  } else {
    // ── 4 列扑克牌网格 ──
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding-bottom:8px">';
    show.forEach(function(d){ h += _renderCard(d); });
    h += '</div>';
  }

  el.innerHTML = h;
}

// ═══════════════════════════════════════════════
// 卡片渲染
// ═══════════════════════════════════════════════
function _renderCard(d) {
  var act = d.actionId ? _findAction(d.actionId) : null;
  var icon = act ? act.icon : (d.actionIcon || '📍');
  var label = (d.actionLabel || d.description || '?').slice(0, 4);
  var spaceShort = (d.spaceName || d.spaceId || '').replace(/.* › /, '').slice(0, 5);
  var isPending = d.status === 'pending';
  var isConfirmed = d.status === 'confirmed';
  var isExpired = d.status === 'expired';
  var guessCount = (d.guesses || []).length;
  var myGuess = (d.guesses || []).find(function(g){ return g.name === CURRENT_USER; });
  var isGolden = d.ntDoer >= 15;

  // 花色
  var suitIcon = '📍';
  var suitChar = '';
  if (act) {
    if (/cleaning|打扫|clean/.test(act.category)) { suitIcon = '🧹'; suitChar = '♠'; }
    else if (/farming|田间|farm/.test(act.category)) { suitIcon = '🌿'; suitChar = '♣'; }
    else if (/cooking|厨房|cook/.test(act.category)) { suitIcon = '🍳'; suitChar = '♥'; }
    else { suitIcon = '🔧'; suitChar = '♦'; }
  }

  var bg = isConfirmed ? '#f8fcf6' : (isExpired ? '#f5f5f5' : '#fffdf9');
  var border = isGolden && !isExpired ? '#c88740' : (isConfirmed ? '#a0c8a0' : (isExpired ? '#e0e0e0' : '#c8c0b0'));
  var borderW = isGolden && !isExpired ? '2px' : '1.5px';
  var shadow = isGolden && !isExpired ? '0 2px 12px rgba(200,135,64,.25)' : '0 1px 4px rgba(0,0,0,.04)';
  var statusIcon = isConfirmed ? '✅' : (isExpired ? '⏰' : (myGuess ? '👁' : '🂠'));

  var h = '<div onclick="openDiscoveryDetail(\''+d.id+'\')" style="background:'+bg+';border:'+borderW+' solid '+border+';border-radius:10px;padding:8px 6px;cursor:pointer;box-shadow:'+shadow+';text-align:center;position:relative;min-height:130px;display:flex;flex-direction:column;justify-content:space-between">';

  // 左上花色
  h += '<div style="position:absolute;top:4px;left:5px;font-size:.55rem;color:#5a6e5c;font-weight:700">'+suitChar+'</div>';
  // 右上状态
  h += '<div style="position:absolute;top:4px;right:5px;font-size:.6rem">'+statusIcon+'</div>';
  // 右下 NT
  h += '<div style="position:absolute;bottom:4px;right:5px;font-size:.55rem;color:'+(isGolden?'#c88740':'#8a6a20')+';font-weight:700">'+(d.ntDoer||0)+'</div>';

  // 中央图标
  h += '<div style="font-size:2rem;line-height:1;margin-top:4px">'+icon+'</div>';
  // 劳动名
  h += '<div style="font-size:.62rem;font-weight:700;color:#1d2e24;line-height:1.2;margin-top:2px">'+esc(label)+'</div>';
  // 空间
  h += '<div style="font-size:.5rem;color:#5a6e5c;margin-top:1px">📍 '+esc(spaceShort)+'</div>';
  // 底部猜人数
  var bottomText = isConfirmed ? esc((d.guessedPerson||'').slice(0,4)) : (isExpired ? '过期' : (guessCount||0)+'人猜');
  h += '<div style="font-size:.5rem;color:'+(isConfirmed?'#5d8c52':'#5a6e5c')+';margin-top:2px">'+bottomText+'</div>';

  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════
// 发起发现 + 上报劳动 — 共用空间选择 + 智能劳动推荐
// ═══════════════════════════════════════════════
var _discDraft = {}; // 发现 draft
var _srDraft = {};   // 上报 draft
var _formMode = '';  // 'discovery' | 'selfreport'

// ── 建筑分组 ──
var _BUILDING_GROUPS = [
  { id:'office', name:'社区大楼', icon:'🏢' },
  { id:'study', name:'大地书房', icon:'🏯' },
  { id:'field', name:'田地', icon:'🌿' },
  { id:'outdoor', name:'户外', icon:'🌳' }
];

function _getRoomsForBuilding(groupId) {
  var spaces = _getCardRoomSpaces();
  if (groupId === 'outdoor') {
    // 户外：所有不属于社区大楼/大地书房/田地的空间
    return spaces.filter(function(s) {
      var bld = (s.building || '');
      return bld !== '社区大楼' && bld !== '大地书房' && bld !== '田地';
    });
  }
  if (groupId === 'field') {
    return spaces.filter(function(s) { return (s.building||'') === '田地'; });
  }
  // 建筑 ID 匹配
  return spaces.filter(function(s) {
    return (s.building||'') === (groupId==='office'?'社区大楼':'大地书房');
  });
}

// ── Step 1: 选空间（建筑 tabs → 房间网格）──
function openNewDiscovery() { _discDraft = {}; _formMode = 'discovery'; _renderStep1(); }
function openSelfReport(opts) {
  _srDraft = {};
  _formMode = 'selfreport';
  if (opts && opts.cat) _srDraft.filterCat = opts.cat;
  _renderStep1();
}

// 分类 → LABOR_ACTIONS 索引
var _CAT_INDEX = { cleaning:0, farming:1, cooking:2, maintenance:3, service:4, art:5, custom:6 };
var _CAT_LABEL = { cleaning:'🧹 打扫卫生', farming:'🌿 田间管理', cooking:'🍳 帮厨做饭', maintenance:'🔧 日常维护', service:'🤝 社区服务', art:'🎨 创作' };

function _draft() { return _formMode === 'selfreport' ? _srDraft : _discDraft; }

function _renderStep1() {
  var h = _formShell(_formMode==='selfreport'?'📝 上报劳动':'🔍 发起发现', '选空间');
  var d = _draft();
  var activeBld = d.activeBld || 'office';
  if (!d.activeBld) { d.activeBld = 'office'; activeBld = 'office'; }

  // 按分类过滤建筑 tabs
  var filterCat = (d.filterCat) || '';
  var showGroups = _BUILDING_GROUPS;
  if (filterCat === 'farming') {
    showGroups = _BUILDING_GROUPS.filter(function(g){ return g.id === 'field'; });
    if (!showGroups.some(function(g){ return g.id === activeBld; })) { activeBld = 'field'; d.activeBld = 'field'; }
  } else if (filterCat === 'cleaning') {
    showGroups = _BUILDING_GROUPS.filter(function(g){ return g.id !== 'field'; });
    if (activeBld === 'field') { activeBld = 'office'; d.activeBld = 'office'; }
  }

  // 建筑 tabs
  h += '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:10px;-webkit-overflow-scrolling:touch">';
  showGroups.forEach(function(g) {
    var sel = activeBld === g.id;
    h += '<div onclick="_pickBuilding(\''+g.id+'\')" class="step1-bld-tab" data-bld="'+g.id+'" style="flex-shrink:0;padding:8px 14px;border-radius:18px;font-size:.68rem;cursor:pointer;border:1.5px solid '+(sel?'var(--green-primary)':'#d0d9ce')+';background:'+(sel?'#e8f0e8':'#fff')+';font-weight:'+(sel?'600':'400')+'">'+g.icon+' '+g.name+'</div>';
  });
  h += '</div>';

  // 房间网格
  var rooms = _getRoomsForBuilding(activeBld);
  h += '<div style="max-height:260px;overflow-y:auto;margin-bottom:10px;-webkit-overflow-scrolling:touch">';
  if (!rooms.length) {
    h += '<div style="text-align:center;color:#aaa;padding:20px;font-size:.65rem">暂无空间数据</div>';
  } else {
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    rooms.forEach(function(s) {
      h += '<div onclick="_pickSpace(\''+s.id+'\',\''+esc(s.name)+'\')" style="width:calc(50% - 3px);padding:10px 8px;background:#fff;border:1px solid #e8ede6;border-radius:10px;cursor:pointer;font-size:.68rem;display:flex;align-items:center;gap:6px" onmouseover="this.style.background=\'#f5f8f2\'" onmouseout="this.style.background=\'#fff\'">';
      h += '<span style="font-size:1.1rem;flex-shrink:0">'+s.icon+'</span>';
      h += '<span style="line-height:1.2">'+esc(s.name.replace(/^.* › /,''))+'</span>';
      h += '</div>';
    });
    h += '</div>';
  }
  h += '</div>';

  h += _formFooter(_formMode==='selfreport'?'取消':'取消', '', '');
  _showModal(h);
}

function _pickBuilding(bldId) {
  _draft().activeBld = bldId;
  _renderStep1(); // 重新渲染
}

function _pickSpace(id, name) {
  var d = _draft();
  d.spaceId = id;
  d.spaceName = name;
  d.spaceIcon = _spaceIcon(id);
  setTimeout(function(){ _renderStep2(); }, 150);
}

// ── Step 2: 智能推荐劳动 ──
function _renderStep2() {
  var d = _draft();
  if (!d.spaceId) { _renderStep1(); return; }

  // ── 发现模式：自由描述（不选劳动项）──
  if (_formMode === 'discovery') {
    var h = _formShell('🔍 发起发现', '描述变化');
    h += '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:4px">📍 '+esc(d.spaceName)+'</div>';
    h += '<div style="font-size:.68rem;color:#1d2e24;font-weight:600;margin-bottom:8px">你注意到了什么变化？</div>';
    h += '<textarea id="discDescInput" rows="3" placeholder="比如：画室变干净了、番茄被收了、垃圾被倒了…" style="width:100%;padding:10px;border:1px solid var(--green-border);border-radius:10px;font-size:.7rem;margin-bottom:8px;background:#fff;color:#1d2e24;resize:vertical;font-family:inherit;box-sizing:border-box"></textarea>';
    h += '<div style="font-size:.58rem;color:#5a6e5c;margin-bottom:8px;background:#f8f8f8;padding:8px;border-radius:8px">💡 描述你看到的变化即可，不需要知道具体谁做了什么劳动。</div>';
    h += _formFooter('← 重选空间', '下一步 →', '_submitDiscDesc', '_renderStep1');
    _showModal(h);
    return;
  }

  // ── 上报模式：按分类/空间过滤劳动项 ──
  var catLabel = d.filterCat ? (_CAT_LABEL[d.filterCat] || '') : '';
  var title = catLabel ? '📝 上报劳动 · '+catLabel : '📝 上报劳动';
  var actions = _getActionsForSpace(d.spaceId);

  // 如果有分类过滤，只保留该分类的劳动
  if (d.filterCat) {
    var catIdx = _CAT_INDEX[d.filterCat];
    if (catIdx !== undefined) {
      var catActionIds = {};
      var catObj = LABOR_ACTIONS[catIdx];
      if (catObj) catObj.actions.forEach(function(a){ catActionIds[a.id] = true; });
      actions = actions.filter(function(item){ return catActionIds[item.action.id]; });
    }
  }

  var h = _formShell(title, '选劳动');
  h += '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:4px">📍 '+esc(d.spaceName)+'</div>';
  h += '<div style="font-size:.68rem;color:#1d2e24;font-weight:600;margin-bottom:8px">'+(d.spaceIcon||'')+' 你做了什么？</div>';

  if (!actions.length && d.filterCat) {
    // 该空间没有此分类的劳动，引导用户选"其他"
    h += '<div style="text-align:center;color:#aaa;padding:20px;font-size:.65rem">此空间暂无该分类的劳动项<br><span style="font-size:.55rem">尝试其他分类或使用「其他劳动」</span></div>';
  } else {
    h += '<div style="max-height:240px;overflow-y:auto;margin-bottom:10px;-webkit-overflow-scrolling:touch">';
    actions.forEach(function(item) {
      var a = item.action;
      var icon = item.icon || '📍';
      h += '<div onclick="_pickAction(\''+a.id+'\',\''+esc(a.label)+'\',\''+icon+'\','+a.nt+',false)" style="padding:10px 12px;margin:3px 0;background:#fff;border:1px solid #e8ede6;border-radius:10px;cursor:pointer;font-size:.72rem;display:flex;justify-content:space-between;align-items:center">';
      h += '<span>'+icon+' '+esc(a.label)+'</span>';
      h += '<span style="font-size:.62rem;color:#8a6a20;font-weight:600">+'+a.nt+' NT</span>';
      h += '</div>';
    });
    h += '</div>';
  }
  // 自定义始终可选
  h += '<div onclick="_pickAction(\'_custom\',\'其他劳动（手动输入）\',\'✏️\',5,true)" style="padding:10px 12px;margin:3px 0;background:#fafafa;border:1px dashed #d0d9ce;border-radius:10px;cursor:pointer;font-size:.72rem;display:flex;align-items:center;gap:8px;color:#5a6e5c">';
  h += '<span>✏️</span><span>其他劳动（手动输入）</span>';
  h += '</div>';

  h += _formFooter('← 重选空间', '', '', '_renderStep1');
  _showModal(h);
}

// ── 发现：自由描述提交 → 直接跳到猜人 ──
function _submitDiscDesc() {
  var desc = (document.getElementById('discDescInput')||{}).value || '';
  if (!desc.trim()) { showToast('请描述你看到的变化', 'warn'); return; }
  _discDraft.actionId = '_discovery';
  _discDraft.actionLabel = desc.trim();
  _discDraft.actionIcon = '👀';
  _discDraft.actionNT = 10; // 发现默认 NT
  _discDraft.isCustom = true;
  _renderStep3();
}

function _pickAction(id, label, icon, nt, isCustom) {
  var d = _draft();
  d.actionId = id;
  d.actionLabel = label;
  d.actionIcon = icon;
  d.actionNT = nt;
  d.isCustom = isCustom;

  if (isCustom) {
    setTimeout(function(){
      var custom = prompt('描述你的劳动内容：');
      if (custom) {
        d.actionLabel = custom;
        setTimeout(function(){ _renderStep3(); }, 100);
      }
    }, 200);
  } else {
    setTimeout(function(){ _renderStep3(); }, 150);
  }
}

// ── Step 3: 猜人（发现）/ 补充说明（上报）──
function _renderStep3() {
  var d = _draft();
  if (!d.actionId) { _renderStep2(); return; }

  if (_formMode === 'selfreport') {
    _renderSRStep3();
    return;
  }

  // 发现模式 → 猜是谁
  var h = _formShell('🔍 发起发现', '猜是谁');
  h += '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:2px">📍 '+esc(d.spaceName)+'</div>';
  h += '<div style="font-size:.68rem;color:#1d2e24;margin-bottom:8px">'+d.actionIcon+' '+esc(d.actionLabel)+'  ·  +'+d.actionNT+' NT</div>';
  h += '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:6px">🎯 猜猜是谁做的？</div>';

  var users = typeof getUsers === 'function' ? getUsers() : {};
  var names = Object.keys(users);
  if (!names.length) {
    h += '<div style="color:#aaa;text-align:center;padding:20px；font-size:.7rem">暂无用户</div>';
  } else {
    h += '<div style="max-height:180px;overflow-y:auto;margin-bottom:10px">';
    names.forEach(function(name) {
      if (name === CURRENT_USER) return;
      var u = users[name];
      var ri = typeof roleIcon === 'function' ? roleIcon(u.role) : '👤';
      var seed = (u && u.avatar_seed != null) ? u.avatar_seed : name;
      var avi = typeof avatarURL === 'function' ? avatarURL(seed, 32) : '';
      h += '<div onclick="_submitDiscGuess(\''+esc(name)+'\')" style="padding:10px 12px;margin:3px 0;background:#fff;border:1px solid #e8ede6;border-radius:10px;cursor:pointer;font-size:.72rem;display:flex;align-items:center;gap:8px">';
      if (avi) h += '<img src="'+avi+'" width="32" height="32" style="border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\'">';
      h += '<span style="flex:1">'+ri+' '+esc(name)+'</span><span style="color:#aaa">→</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  h += '<div style="font-size:.58rem;color:#5a6e5c;margin-bottom:8px;background:#f8f8f8;padding:8px;border-radius:8px">💡 猜对 → 你 +5 NT · 做事者 +'+d.actionNT+' NT</div>';
  h += _formFooter('← 重选劳动', '', '', '_renderStep2');
  _showModal(h);
}

// ── 上报劳动 Step 3 ──
function _renderSRStep3() {
  var d = _draft();
  var h = _formShell('📝 上报劳动', '补充说明');
  h += '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:2px">📍 '+esc(d.spaceName)+'</div>';
  h += '<div style="font-size:.68rem;color:#1d2e24;margin-bottom:8px">'+d.actionIcon+' '+esc(d.actionLabel)+'  ·  +'+d.actionNT+' NT</div>';

  h += '<textarea id="srNote" rows="3" placeholder="补充说明（选填）：擦了台面、拖了地、倒了垃圾…" style="width:100%;padding:10px;border:1px solid var(--green-border);border-radius:10px;font-size:.7rem;margin-bottom:8px;background:#fff;color:#1d2e24;resize:vertical;font-family:inherit;box-sizing:border-box"></textarea>';

  h += '<div style="font-size:.58rem;color:#5a6e5c;margin-bottom:8px;background:#f8f8f8;padding:8px;border-radius:8px">💡 提交后等待另一位成员验证。通过后 +'+d.actionNT+' NT 到账。</div>';

  h += _formFooter('← 重选劳动', '📤 提交', '_submitSelfReport', '_renderStep2');
  _showModal(h);
}

// ── 表单框架（精简版）──
function _formShell(title, step) {
  return '<div style="background:#fff;border-radius:16px;width:360px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)">'+
    '<div style="position:sticky;top:0;z-index:2;background:#fff;padding:14px 16px 8px;border-bottom:1px solid #f0f0f0">'+
    '<div style="display:flex;justify-content:space-between;align-items:center">'+
    '<span style="font-weight:700;font-size:.82rem">'+title+'</span>'+
    '<span style="font-size:.55rem;color:#aaa;background:#f0f0f0;padding:2px 8px;border-radius:10px">'+step+'</span>'+
    '</div></div><div style="padding:12px 16px">';
}

function _formFooter(leftLabel, rightLabel, rightFn, leftFn) {
  var h = '</div>'; // close content padding
  h += '<div style="position:sticky;bottom:0;z-index:2;background:#fff;padding:10px 16px;border-top:1px solid #f0f0f0;display:flex;gap:8px">';
  if (leftLabel && leftFn) {
    h += '<button class="btn-sm sec" style="flex:1;font-size:.65rem;padding:8px" onclick="'+leftFn+'()">'+leftLabel+'</button>';
  } else if (leftLabel) {
    h += '<button class="btn-sm sec" style="flex:1;font-size:.65rem;padding:8px" onclick="closeDiscoveryForm()">'+leftLabel+'</button>';
  }
  if (rightLabel && rightFn) {
    h += '<button class="btn-sm pri" style="flex:1;font-size:.65rem;padding:8px" onclick="'+rightFn+'()">'+rightLabel+'</button>';
  }
  h += '</div>';
  return h;
}

function _showModal(html) {
  document.querySelectorAll('.disc-modal-overlay').forEach(function(s) { s.remove(); });
  var overlay = document.createElement('div');
  overlay.className = 'disc-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);animation:fadeIn .15s ease-out';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = html;

  // 挂接提交按钮
  overlay.querySelectorAll('[onclick*="_submitSelfReport"]').forEach(function(btn){
    btn.onclick = function(e){ e.stopPropagation(); _submitSelfReport(); };
  });
  overlay.querySelectorAll('[onclick*="_submitDiscGuess"]').forEach(function(btn){
    // handled inline via onclick on user items
  });

  document.body.appendChild(overlay);
}

function closeDiscoveryForm() {
  document.querySelectorAll('.disc-modal-overlay').forEach(function(s) { s.remove(); });
  document.querySelectorAll('.disc-toast').forEach(function(t){ t.remove(); });
}

// ── 提交发现 ──
function _submitDiscGuess(name) {
  if (!name || !CURRENT_USER) { showToast('请先登录', 'error'); return; }
  if (name === CURRENT_USER) { showToast('不能猜自己', 'warn'); return; }

  // 检查是否已猜过此牌
  var discs = _getDiscoveries();
  var existing = discs.find(function(d){ return d.id === _discDraft.existingDiscId; });
  if (existing) {
    existing.guesses = existing.guesses || [];
    if (existing.guesses.some(function(g){ return g.name === CURRENT_USER; })) {
      showToast('你已经猜过这张牌了', 'warn'); return;
    }
    existing.guesses.push({ name: CURRENT_USER, guessedPerson: name, guessedAt: new Date().toISOString() });
    _saveDiscoveries();
    closeDiscoveryForm();
    var crEl = document.getElementById('overlayCardRoom');
    if (crEl) { crEl.classList.add('open'); renderCardRoom(); }
    showToast('🎯 已猜「'+name+'」！等揭晓', 'ok');
    return;
  }

  var ntDoer = _getLaborNT(_discDraft.actionId) || _discDraft.actionNT || 10;
  var disc = {
    id: 'disc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    spaceId: _discDraft.spaceId,
    spaceName: _discDraft.spaceName,
    spaceIcon: _discDraft.spaceIcon,
    actionId: _discDraft.actionId,
    actionLabel: _discDraft.actionLabel,
    actionIcon: _discDraft.actionIcon,
    description: _discDraft.actionLabel + ' @' + _discDraft.spaceName,
    guesser: CURRENT_USER,
    guessedPerson: name,
    guesses: [{ name: CURRENT_USER, guessedPerson: name, guessedAt: new Date().toISOString() }],
    guessedAt: new Date().toISOString(),
    status: 'pending',
    ntGuesser: 1,
    ntDoer: ntDoer,
    isSelfReport: false,
    createdAt: new Date().toISOString()
  };

  var discs = _getDiscoveries();
  discs.unshift(disc);
  if (discs.length > 100) discs.length = 100;
  _saveDiscoveries();

  if (typeof logActivity === 'function') {
    logActivity('discovery_new', CURRENT_USER + ' 发现「'+disc.actionLabel+'」→猜是 '+name);
  }

  closeDiscoveryForm();
  var crEl = document.getElementById('overlayCardRoom');
  if (crEl) { crEl.classList.add('open'); renderCardRoom(); }
  showToast('🔍 发现已发出！等 '+name+' 确认', 'ok');
}

// ── 提交劳动上报 ──
function _submitSelfReport() {
  if (!CURRENT_USER) { showToast('请先登录', 'error'); return; }
  var note = (document.getElementById('srNote')||{}).value || '';
  var actionLabel = _srDraft.actionLabel;
  var ntAmount = _getLaborNT(_srDraft.actionId) || _srDraft.actionNT || 5;
  var fullNote = actionLabel + (note ? ' · ' + note : '');

  // 写入校核队列
  if (window.AppData && typeof AppData.addVerification === 'function') {
    AppData.addVerification('labor_report', CURRENT_USER, fullNote, { spaceId: _srDraft.spaceId, actionId: _srDraft.actionId }, ntAmount, Math.ceil(ntAmount/5)||1);
  }

  // 同时写入卡片室 — 让上报的劳动在卡片室可见
  var disc = {
    id: 'sr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    spaceId: _srDraft.spaceId,
    spaceName: _srDraft.spaceName,
    spaceIcon: _srDraft.spaceIcon,
    actionId: _srDraft.actionId,
    actionLabel: actionLabel,
    actionIcon: _srDraft.actionIcon,
    description: actionLabel + (note ? ' · ' + note : '') + ' @' + _srDraft.spaceName,
    guesser: CURRENT_USER,
    guessedPerson: CURRENT_USER, // 自报：做事者即上报者
    guessedAt: new Date().toISOString(),
    status: 'pending', // 等待校核确认
    ntGuesser: 0,
    ntDoer: ntAmount,
    isSelfReport: true,
    createdAt: new Date().toISOString()
  };
  var discs = _getDiscoveries();
  discs.unshift(disc);
  if (discs.length > 100) discs.length = 100;
  _saveDiscoveries();

  if (typeof logActivity === 'function') {
    logActivity('labor_report', CURRENT_USER + ' 上报劳动：' + actionLabel + ' @'+_srDraft.spaceName);
  }

  closeDiscoveryForm();
  // 自动打开卡片室让用户看到自己的卡片
  var crEl = document.getElementById('overlayCardRoom');
  if (crEl) { crEl.classList.add('open'); renderCardRoom(); }
  showToast('📤 已上报！等待验证后发放 +'+ntAmount+' NT', 'ok');
  if (typeof refreshUserUI === 'function') refreshUserUI();
}

// ═══════════════════════════════════════════════
// 发现详情 + 确认/否认
// ═══════════════════════════════════════════════
function openDiscoveryDetail(discId) {
  var discs = _getDiscoveries();
  var d = discs.find(function(x) { return x.id === discId; });
  if (!d) return;

  _expireOldDiscoveries();
  discs = _getDiscoveries();
  d = discs.find(function(x) { return x.id === discId; });
  if (!d) return;

  var act = d.actionId ? _findAction(d.actionId) : null;
  var icon = act ? act.icon : (d.actionIcon || '📍');
  var actionLabel = d.actionLabel || d.description || '';
  var spaceName = d.spaceName || d.spaceId;
  var isDoer = d.guessedPerson === CURRENT_USER;
  var isGuesser = d.guesser === CURRENT_USER;
  var myGuess = (d.guesses || []).find(function(g){ return g.name === CURRENT_USER; });
  var hasGuessed = !!myGuess;
  var isGolden = d.ntDoer >= 15;
  var guessCount = (d.guesses || []).length;

  var h = '<div style="background:#fff;border-radius:16px;width:320px;max-width:92vw;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)">';

  // 头部
  h += '<div style="padding:16px 16px 10px;text-align:center;background:'+(isGolden&&d.status==='pending'?'linear-gradient(160deg,#fef8e8,#fef0d0)':'#fafaf6')+'">';
  h += '<div style="font-size:3rem;line-height:1;margin-bottom:4px">'+icon+'</div>';
  h += '<div style="font-size:.82rem;font-weight:700;color:#1d2e24">'+esc(actionLabel)+'</div>';
  h += '<div style="font-size:.62rem;color:#5a6e5c;margin-top:2px">📍 '+esc(spaceName)+'</div>';
  h += '</div>';

  // 详情
  h += '<div style="margin:0 16px 10px;background:#fafaf6;border-radius:12px;padding:12px">';
  var stColor = d.status==='confirmed'?'#5d8c52':(d.status==='expired'?'#aaa':'#c8892e');
  var stText = d.status==='confirmed'?'✅ 已揭晓':(d.status==='expired'?'⏰ 已过期':'⏳ 待揭晓');
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  h += '<span style="font-size:.62rem;color:#5a6e5c">🔍 '+esc(d.guesser||'')+' 发现</span>';
  h += '<span style="font-size:.58rem;color:'+stColor+';font-weight:600">'+stText+'</span>';
  h += '</div>';

  if (d.status === 'confirmed') {
    h += '<div style="font-size:.65rem;font-weight:600;color:#5d8c52;margin-bottom:4px">🎉 '+esc(d.guessedPerson||'')+' 确认了！</div>';
    // 猜中的人
    var winners = (d.guesses||[]).filter(function(g){ return g.guessedPerson === d.guessedPerson; });
    if (winners.length) h += '<div style="font-size:.58rem;color:#5a6e5c">🏆 猜中: '+winners.map(function(g){return g.name;}).join('、')+' (+1 NT)</div>';
    var losers = (d.guesses||[]).filter(function(g){ return g.guessedPerson !== d.guessedPerson; });
    if (losers.length) h += '<div style="font-size:.55rem;color:#999">猜错: '+losers.map(function(g){return g.name;}).join('、')+' (-0.1 NT)</div>';
  } else if (d.status === 'pending') {
    h += '<div style="font-size:.6rem;color:#5a6e5c;margin-bottom:4px">🎯 首发猜测：'+esc(d.guessedPerson||'')+'</div>';
    h += '<div style="font-size:.58rem;color:#5a6e5c">👤 '+guessCount+' 人已猜 · 每人限猜 1 次</div>';
    // 最近猜测
    (d.guesses||[]).slice(-3).forEach(function(g){
      h += '<div style="font-size:.55rem;color:#5a6e5c;margin-top:2px">'+g.name+' → '+esc(g.guessedPerson||'')+'</div>';
    });
  }
  h += '<div style="font-size:.55rem;color:#5a6e5c;margin-top:4px">💰 猜对 +1 NT · 做事者 +'+d.ntDoer+' NT · 猜错 -0.1 NT</div>';
  h += '<div style="font-size:.5rem;color:#aaa;margin-top:4px">'+d.createdAt.slice(0,16).replace('T',' ')+'</div>';
  h += '</div>';

  // 操作区
  h += '<div style="padding:0 16px 16px">';
  if (d.status === 'pending') {
    if (isDoer) {
      h += '<div style="display:flex;gap:8px">';
      h += '<button class="btn-sm danger" style="flex:1;font-size:.65rem;padding:10px" onclick="denyDiscovery(\''+d.id+'\')">🙅 不是我</button>';
      h += '<button class="btn-sm pri" style="flex:1;font-size:.65rem;padding:10px" onclick="confirmDiscovery(\''+d.id+'\')">✅ 是我做的！<br><span style="font-size:.5rem;opacity:.8">+'+d.ntDoer+' NT · 🎺全社区公告</span></button>';
      h += '</div>';
    } else if (hasGuessed) {
      h += '<div style="text-align:center;font-size:.62rem;color:#5a6e5c;padding:8px;background:#f5f8f2;border-radius:8px">👁 你已猜「'+esc(myGuess.guessedPerson||'')+'」· 等待揭晓</div>';
    } else {
      // 没猜过 → 可以猜
      h += '<div style="font-size:.6rem;color:#5a6e5c;margin-bottom:6px;font-weight:600">🎯 你要猜是谁做的？（仅一次机会）</div>';
      h += '<div style="max-height:160px;overflow-y:auto;margin-bottom:8px">';
      var users = typeof getUsers === 'function' ? getUsers() : {};
      Object.keys(users).forEach(function(name){
        if (name === CURRENT_USER) return;
        h += '<div onclick="_guessExistingCard(\''+d.id+'\',\''+esc(name)+'\')" style="padding:8px 10px;margin:2px 0;background:#fff;border:1px solid #e8ede6;border-radius:8px;cursor:pointer;font-size:.68rem;display:flex;align-items:center;gap:6px">';
        h += '<span>👤</span><span style="flex:1">'+esc(name)+'</span><span style="color:#5a6e5c">猜 +1 NT</span>';
        h += '</div>';
      });
      h += '</div>';
    }
  }
  h += '<button class="btn-sm sec" style="width:100%;margin-top:6px;font-size:.62rem;padding:6px" onclick="closeDiscoveryForm();renderCardRoom()">关闭</button>';
  h += '</div>';

  h += '</div>';
  _showModal(h);
}

// 连续猜中检查
function _checkStreak(userName) {
  var discs = _getDiscoveries();
  var confirmed = discs.filter(function(d){ return d.status === 'confirmed'; }).sort(function(a,b){ return (b.doerConfirmedAt||'').localeCompare(a.doerConfirmedAt||''); });
  var streak = 0;
  for (var i = 0; i < confirmed.length; i++) {
    var d = confirmed[i];
    var won = (d.guesses || []).some(function(g){ return g.name === userName && g.guessedPerson === d.guessedPerson; });
    if (won) streak++; else break;
  }
  return streak;
}

// 猜牌规则
function _openCardRules() {
  var h = '<div style="background:#fff;border-radius:16px;width:320px;max-width:92vw;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.25);max-height:70vh;overflow-y:auto">';
  h += '<div style="font-weight:700;font-size:.82rem;margin-bottom:10px">📜 猜牌规则</div>';
  h += '<div style="font-size:.65rem;color:#5a6e5c;line-height:1.8">';
  h += '🂠 <b>发牌</b>：有人上报劳动或发起发现 → 牌出现在牌桌上<br>';
  h += '🎯 <b>猜牌</b>：点牌 → 选一个人 → 每人限猜 1 次<br>';
  h += '✅ <b>揭晓</b>：做事者确认 → 牌翻开<br>';
  h += '💰 <b>奖励</b>：猜对 +1 NT · 做事者按公约定价 · 猜错 -0.1 NT<br>';
  h += '🌟 <b>金边牌</b>：NT≥15 的牌 → 金色边框，高价值<br>';
  h += '🎺 <b>世界喇叭</b>：牌翻开时全社区播报<br>';
  h += '📜 <b>归档</b>：已揭晓的牌 7 天后移入档案室「卡片记录」<br>';
  h += '</div>';
  h += '<button class="btn-sm sec" style="width:100%;margin-top:10px;font-size:.62rem" onclick="closeDiscoveryForm()">关闭</button>';
  h += '</div>';
  _showModal(h);
}

// 猜现有卡片
function _guessExistingCard(discId, name) {
  _discDraft.existingDiscId = discId;
  closeDiscoveryForm();
  _submitDiscGuess(name);
}

function confirmDiscovery(discId) {
  var discs = _getDiscoveries();
  var d = discs.find(function(x) { return x.id === discId; });
  if (!d || d.status !== 'pending') return;

  d.status = 'confirmed';
  d.doerConfirmedAt = new Date().toISOString();

  // NT: 做事者按公约定价，猜对者每人 +1 NT
  if (window.NT) {
    NT.earn(d.guessedPerson, d.ntDoer, '被发现: ' + (d.actionLabel||d.description), 'personal');
    // 所有猜对的人 +1 NT
    (d.guesses || []).forEach(function(g) {
      if (g.guessedPerson === d.guessedPerson) {
        NT.earn(g.name, 1, '猜中奖励: ' + (d.actionLabel||d.description), 'personal');
      } else {
        NT.spend(g.name, 0.1, '猜错: ' + (d.actionLabel||d.description), 'personal');
      }
    });
    // 如果发现者也猜了
    if (d.guesser && !(d.guesses||[]).some(function(g){ return g.name === d.guesser; })) {
      NT.earn(d.guesser, d.ntGuesser, '发现奖励: ' + (d.actionLabel||d.description), 'personal');
    }
  }

  _saveDiscoveries();

  if (typeof logActivity === 'function') {
    logActivity('discovery_confirmed', d.guessedPerson + ' 确认了发现 → +'+d.ntDoer+' NT');
  }

  // 🎺 世界喇叭
  var space = d.spaceName || '';
  var action = d.actionLabel || d.description || '';
  var guessers = (d.guesses || []).filter(function(g){ return g.guessedPerson === d.guessedPerson; }).map(function(g){ return g.name; });
  var guessersStr = guessers.length ? guessers.join('、') + ' 猜对了！' : '';
  var isGolden = d.ntDoer >= 15;
  _trumpet(guessersStr + space + ' ' + action + ' 是 ' + d.guessedPerson + ' 做的 🧹 +'+d.ntDoer+'NT', isGolden ? 'golden' : '');

  // 今日第一张牌
  var today = new Date().toISOString().slice(0,10);
  var todayConfirmed = discs.filter(function(x){ return x.status==='confirmed' && x.doerConfirmedAt && x.doerConfirmedAt.slice(0,10)===today; });
  if (todayConfirmed.length === 1) { setTimeout(function(){ _trumpet('牌局开了！今天第一张牌已揭晓 🔥', 'golden'); }, 4200); }

  // 连续猜中 streak — 检查所有猜中者
  guessers.forEach(function(gname){
    var streak = _checkStreak(gname);
    if (streak >= 3) { setTimeout(function(){ _trumpet(gname + ' 手气正旺！连续猜对 ' + streak + ' 张牌！', 'streak'); }, 4400); }
  });

  closeDiscoveryForm();
  renderCardRoom();
  if (typeof refreshUserUI === 'function') refreshUserUI();
  showToast('🎉 确认成功！+'+d.ntDoer+' NT', 'ok');
}

function denyDiscovery(discId) {
  var discs = _getDiscoveries();
  var d = discs.find(function(x) { return x.id === discId; });
  if (!d || d.status !== 'pending') return;

  d.status = 'denied';
  d.doerDeniedAt = new Date().toISOString();

  // 猜错 -0.1 NT
  (d.guesses || []).forEach(function(g) {
    if (window.NT) NT.spend(g.name, 0.1, '猜错: ' + (d.actionLabel||d.description), 'personal');
  });

  _saveDiscoveries();

  if (typeof logActivity === 'function') {
    logActivity('discovery_denied', d.guessedPerson + ' 否认了发现');
  }

  closeDiscoveryForm();
  renderCardRoom();
  if (typeof refreshUserUI === 'function') refreshUserUI();
  showToast('猜错了！', 'warn');
}