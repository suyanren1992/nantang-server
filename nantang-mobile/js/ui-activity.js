// ═══ 活动总览页：活动/营地/茶馆/集市/拍卖 入口收敛 ═══
// 卡号：A-ACTIVITY-PAGE · 一营 Claude Code · 2026-07-31
// 范式：W6-UI-CARD-API

var _activityHubMode = 'hub'; // hub | camp | events | frozen

function openActivityHub() {
  _activityHubMode = 'hub';
  _pushOverlay('overlayActivityHub');
  document.getElementById('overlayActivityHub').classList.add('open');
  renderActivityHub();
}

function renderActivityHub() {
  var el = document.getElementById('activityHubBody');
  if (!el) return;

  var camps = (typeof getCamps === 'function') ? getCamps() : [];
  var activeCamps = camps.filter(function(c) { return c.status === 'active'; });
  var campCount = activeCamps.length;
  var campStatusText = campCount ? campCount + ' 营地活跃' : '暂无活跃营地';
  var campStatus = campCount ? 'green' : 'offline';

  var MODULES = [
    { icon: '🎨', title: '社区活动',  status: 'green',   statusText: '查看活动',     action: 'events' },
    { icon: '🏕️', title: '营地架构',  status: campStatus, statusText: campStatusText, action: 'camp' },
    { icon: '🍵', title: '茶馆八卦',  status: 'offline', statusText: '即将开放',     frozen: true },
    { icon: '🛒', title: '二手集市',  status: 'offline', statusText: '即将开放',     frozen: true },
    { icon: '🔨', title: '拍卖会',    status: 'offline', statusText: '即将开放',     frozen: true },
  ];

  var h = '<div class="activity-hub-grid">';
  MODULES.forEach(function(m) {
    var frozen = m.frozen;
    var st = { green: ['🟢','#5d8c52','#5d8c5218'], yellow: ['🟡','#c88740','#c8874018'], offline: ['⚫','#8a8a8a','rgba(0,0,0,0.04)'] }[m.status] || ['⚫','#8a8a8a','rgba(0,0,0,0.04)'];
    var badge = '<span style="display:inline-flex;align-items:center;gap:3px;font-size:.58rem;padding:2px 7px;border-radius:6px;color:'+st[1]+';background:'+st[2]+';flex-shrink:0">'+st[0]+' '+m.statusText+'</span>';
    var desc = frozen ? 'B 板块冻结 · UI 已就位等开放' : '';
    var cls = frozen ? ' ah-card-frozen' : '';
    var act = frozen ? ' onclick="showToast(\'即将开放，敬请期待\',\'warn\')"' : ' data-ah-action="'+m.action+'"';
    h += '<div class="ah-card'+cls+'"'+act+' style="background:var(--g-card);border:1px solid '+(frozen?'var(--g-card-border)':'#d0d9ce')+';border-radius:var(--g-radius);padding:12px;cursor:'+(frozen?'default':'pointer')+';opacity:'+(frozen?'0.45':'1')+'">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
        '<span style="font-size:1.6rem;line-height:1">'+m.icon+'</span>'+
        '<span style="font-weight:700;font-size:.78rem;color:#1d2e24;flex:1">'+m.title+'</span>'+
        badge+
      '</div>'+
      (desc ? '<div style="font-size:.58rem;color:#8a8a8a">'+desc+'</div>' : '')+
    '</div>';
  });
  h += '</div>';

  // 社区动态简报
  var actLog = (window.AppData && AppData._data.activity_log) ? AppData._data.activity_log.slice(0,3) : [];
  if (actLog.length) {
    h += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e8ede6">';
    h += '<div style="font-size:.68rem;font-weight:700;color:#5a6e5c;margin-bottom:6px">📡 最近动态</div>';
    actLog.forEach(function(a) {
      var time = (a.time||'').slice(0,16).replace('T',' ');
      h += '<div style="font-size:.58rem;color:#5a6e5c;padding:2px 0;border-bottom:1px dotted #f0f0f0">'+time+' · '+esc(a.text||'')+'</div>';
    });
    h += '</div>';
  }

  el.innerHTML = h;

  // 事件委托：点击卡片
  el.querySelectorAll('[data-ah-action]').forEach(function(card) {
    card.addEventListener('click', function() {
      var action = this.getAttribute('data-ah-action');
      if (action === 'camp') openCampSubPage();
      else if (action === 'events') openActivitySubPage();
    });
  });
}

// ═══ 营地子页：3 卡片 + 提案区 ═══
function openCampSubPage() {
  _activityHubMode = 'camp';
  var el = document.getElementById('activityHubBody');
  if (!el) return;

  var camps = (typeof getCamps === 'function') ? getCamps() : [];
  var activeCamps = camps.filter(function(c) { return c.status === 'active'; });

  var h = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+
    '<button onclick="renderActivityHub()" style="background:none;border:none;font-size:1rem;cursor:pointer;color:var(--green-primary);padding:0">← 返回</button>'+
    '<span style="font-weight:700;font-size:.82rem">🏕️ 营地架构</span>'+
  '</div>';

  if (!activeCamps.length) {
    h += UI.EmptyState({ icon: '🏕️', title: '暂无活跃营地', hint: '等待管理员创建第一个共创营队' }).outerHTML;
  } else {
    // 每个活跃营地一张总览卡 + 3 子卡片
    activeCamps.forEach(function(c) {
      h += '<div style="background:var(--g-card);border:1px solid var(--green-primary);border-radius:var(--g-radius);padding:12px;margin-bottom:10px">';
      h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'+
        '<span style="font-size:1.4rem">'+esc(c.emoji||'🏕️')+'</span>'+
        '<div style="flex:1"><div style="font-weight:700;font-size:.78rem">'+esc(c.name||'未命名')+'</div>'+
        '<div style="font-size:.58rem;color:#5a6e5c">'+esc(c.date||'')+' · '+esc(c.theme||'')+' · '+(c.people||0)+'人</div></div>'+
        '<button class="btn-sm pri" style="font-size:.58rem;padding:4px 10px" onclick="event.stopPropagation();closeOverlay(\'overlayActivityHub\');openCampHome(\''+c.id+'\')">进入 ▸</button>'+
      '</div>';

      // 3 子卡片（D2: 删田间断掉伪需求，砚仁原话「共享厨房接龙」已修）
      var subCards = [
        { icon:'📋', label:'子活动', desc:'营地日程与活动', tab:'schedule' },
        { icon:'💰', label:'账本',   desc:'资金流水',      tab:'funds' },
        { icon:'🧾', label:'分账',   desc:'结算分账',      tab:'settle' },
      ];
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';
      subCards.forEach(function(sc) {
        h += '<div class="ah-sub-card" style="background:var(--g-content);border:1px solid #e0e0e0;border-radius:8px;padding:8px 6px;text-align:center;cursor:pointer"'+
          ' onclick="event.stopPropagation();closeOverlay(\'overlayActivityHub\');openCampHome(\''+c.id+'\');setTimeout(function(){switchCampTab(\''+sc.tab+'\')},300)">'+
          '<div style="font-size:1.2rem">'+sc.icon+'</div>'+
          '<div style="font-size:.62rem;font-weight:600;color:#1d2e24">'+sc.label+'</div>'+
          '<div style="font-size:.5rem;color:#999">'+sc.desc+'</div>'+
        '</div>';
      });
      h += '</div>';

      // 营地提案区
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e8ede6">'+
        '<div style="font-size:.6rem;color:var(--green-primary);cursor:pointer;font-weight:600"'+
        ' onclick="event.stopPropagation();closeOverlay(\'overlayActivityHub\');openCampHome(\''+c.id+'\');setTimeout(function(){switchCampTab(\'discuss\')},300)">'+
        '🏛️ 营地提案区（待议池）→</div>'+
      '</div>';

      h += '</div>';
    });
  }

  el.innerHTML = h;
}

// ═══ 活动子页：活动列表 + 3 动作 ═══
function openActivitySubPage() {
  _activityHubMode = 'events';
  var el = document.getElementById('activityHubBody');
  if (!el) return;

  var camps = (typeof getCamps === 'function') ? getCamps() : [];
  var allCamps = camps.filter(function(c) { return c.status === 'active' || c.status === 'upcoming'; });

  var h = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+
    '<button onclick="renderActivityHub()" style="background:none;border:none;font-size:1rem;cursor:pointer;color:var(--green-primary);padding:0">← 返回</button>'+
    '<span style="font-weight:700;font-size:.82rem">🎨 社区活动</span>'+
  '</div>';

  // 3 动作按钮
  h += '<div style="display:flex;gap:8px;margin-bottom:10px">'+
    '<button class="btn-sm pri" style="flex:1;font-size:.62rem;padding:6px" onclick="closeOverlay(\'overlayActivityHub\');openCommunityPage()">📝 报名活动</button>'+
    '<button class="btn-sm sec" style="flex:1;font-size:.62rem;padding:6px" onclick="showToast(\'签到功能需在地验证\',\'warn\')">✅ 签到</button>'+
    '<button class="btn-sm sec" style="flex:1;font-size:.62rem;padding:6px" onclick="showToast(\'分享链接已复制\',\'ok\')">📤 分享</button>'+
  '</div>';

  if (!allCamps.length) {
    h += UI.EmptyState({ icon: '🎨', title: '暂无活动', hint: '等待管理员创建共创营队' }).outerHTML;
  } else {
    h += '<div style="font-size:.65rem;font-weight:700;color:#5a6e5c;margin-bottom:6px">活动列表</div>';
    allCamps.forEach(function(c) {
      var statusLabel = c.status === 'active' ? '🟢 进行中' : '📅 招募中';
      h += '<div class="ah-event-card" style="background:var(--g-card);border:1px solid #d0d9ce;border-radius:var(--g-radius);padding:12px;margin-bottom:8px;cursor:pointer"'+
        ' onclick="closeOverlay(\'overlayActivityHub\');openCommunityPage()">'+
        '<div style="display:flex;align-items:flex-start;gap:10px">'+
          '<span style="font-size:1.4rem;flex-shrink:0">'+esc(c.emoji||'🎯')+'</span>'+
          '<div style="flex:1">'+
            '<div style="font-weight:700;font-size:.72rem">'+esc(c.name||'未命名')+'</div>'+
            '<div style="font-size:.58rem;color:#5a6e5c;margin:2px 0">'+esc(c.date||'')+' · '+esc(c.theme||'')+' · '+(c.people||0)+'人</div>'+
            '<div style="font-size:.55rem;color:var(--green-primary);margin-top:2px">'+statusLabel+'</div>'+
          '</div>'+
          '<span style="font-size:.7rem;color:#999;flex-shrink:0">▸</span>'+
        '</div>'+
      '</div>';
    });
  }

  // 入口：社区副本完整页
  h += '<div style="text-align:center;padding:10px 0;margin-top:8px;border-top:1px solid #e8ede6">'+
    '<span style="font-size:.68rem;color:var(--green-primary);cursor:pointer;font-weight:600"'+
    ' onclick="closeOverlay(\'overlayActivityHub\');openCommunityPage()">📋 进入完整社区副本 →</span>'+
    '<div style="font-size:.55rem;color:#aaa;margin-top:2px">查看全部营地、社区动态、档案室</div>'+
  '</div>';

  el.innerHTML = h;
}

// ═══ 冻结页面（茶馆/集市/拍卖） ═══
// 仅做入口置灰，无独立子页；点击由 renderActivityHub 的 pointer-events:none 阻止
