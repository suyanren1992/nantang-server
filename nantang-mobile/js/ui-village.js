// ── 任务12: 进入营地 + 邀请码 ──
function enterCamp(campId) {
  if (!CURRENT_USER) { showToast('请先登录','error'); return; }
  // C-B-3: 先查本地 membership 缓存
  var mems = (window.AppData && AppData._data.camp_memberships) ? AppData._data.camp_memberships : {};
  if (mems[campId] && mems[campId][CURRENT_USER]) { _enterCampFetchPeople(campId); openCampHome(campId); return; }
  var users = typeof getUsers==='function'?getUsers():{};
  var role = (users[CURRENT_USER]||{}).role;
  // TODO: C-B-2 端点就位后改 API 查 membership，现暂用角色放行
  if (isMemberByRole(role)) { _enterCampFetchPeople(campId); openCampHome(campId); return; }
  // 非成员→四步报到告知流
  _showBriefingSheet(campId);
}
// C-B-3: 进营地时尝试拉后端真实 people 计数（端点未就位则静默 fallback）
function _enterCampFetchPeople(campId) {
  if (typeof API === 'undefined' || !API.token) return;
  API.campStats(campId).then(function(r) {
    if (r && r.ok && r.people !== undefined && window.AppData && AppData._data.camps && AppData._data.camps[campId]) {
      AppData._data.camps[campId].people = r.people;
    }
  }).catch(function(){ /* 静默——端点未就位不阻塞 */ });
}
// ══ C-B-3: 四步报到告知流（活动须知→安全提示→日程确认→确认加入）══
var _briefingStep = 0, _briefingCampId = null;
function _showBriefingSheet(campId) {
  _briefingStep = 0; _briefingCampId = campId;
  var c = getCamps().find(function(x){ return x.id === campId; }); if (!c) return;
  _renderBriefingStep(c);
}
function _renderBriefingStep(c) {
  var steps = [
    { title: '📋 活动须知', body: _briefActivity(c) },
    { title: '🛡️ 安全提示', body: _briefSafety(c) },
    { title: '📅 日程确认', body: _briefSchedule(c) },
    { title: '✅ 确认加入', body: _briefConfirm(c) }
  ];
  var s = steps[_briefingStep];
  var isLast = _briefingStep >= 3;
  var btnText = isLast ? '✅ 确认加入' : '下一步 ▸';
  var btnAction = isLast ? '_doCampCheckin()' : '_briefingNext()';
  _showCardPopup('🏕️ ' + esc(c.name||'') + ' · ' + s.title + ' (' + (_briefingStep+1) + '/4)',
    s.body,
    '<button class="btn-pri" style="width:100%;margin-top:8px;min-height:44px;font-size:.72rem;border-radius:10px" onclick="'+btnAction+'">'+btnText+'</button>'+
    (_briefingStep>0?'<button class="btn-sm sec" style="width:100%;margin-top:4px;min-height:36px;font-size:.6rem" onclick="_briefingPrev()">◂ 上一步</button>':''),
    false);
}
function _briefingNext() { _briefingStep++; var c = getCamps().find(function(x){ return x.id === _briefingCampId; }); if (c) _renderBriefingStep(c); }
function _briefingPrev() { _briefingStep = Math.max(0, _briefingStep-1); var c = getCamps().find(function(x){ return x.id === _briefingCampId; }); if (c) _renderBriefingStep(c); }
function _briefActivity(c) {
  return '<div style="font-size:.68rem;color:#3a3a3a;line-height:1.7">'+
    '<div style="background:#f8fcf6;border-radius:10px;padding:12px;margin-bottom:10px">'+
    '<div style="font-weight:700;color:#1d2e24;margin-bottom:4px">📌 '+esc(c.name||'')+'</div>'+
    '<div style="color:#5a6e5c">'+esc(c.desc||'暂无简介')+'</div></div>'+
    '<div style="margin-bottom:8px"><b>📅 日期</b><br>'+esc(c.date||'待定')+'</div>'+
    '<div style="margin-bottom:8px"><b>📍 地点</b><br>'+esc(c.location||'待定')+'</div>'+
    '<div style="margin-bottom:8px"><b>👥 规模</b><br>已有 '+(c.people||0)+' 人 · 上限 '+(c.max||'不限')+' 人</div>'+
    '<div style="color:#999;font-size:.58rem;margin-top:12px">加入即表示你同意遵守社区公约并参与集体劳动</div></div>';
}
function _briefSafety(c) {
  return '<div style="font-size:.68rem;color:#3a3a3a;line-height:1.7">'+
    '<div style="background:#fff8e8;border-radius:10px;padding:12px;margin-bottom:10px">'+
    '<div style="font-weight:700;color:#8a6a30;margin-bottom:4px">⚠️ 安全第一</div>'+
    '<div style="color:#6a5a30">参加活动前请确认你已阅读并理解以下安全提示</div></div>'+
    '<div style="margin-bottom:6px">🦺 听从组织者安排，不擅自离队</div>'+
    '<div style="margin-bottom:6px">🏥 如有身体不适，立即告知组织者</div>'+
    '<div style="margin-bottom:6px">🌧️ 户外活动注意天气，做好防晒防雨</div>'+
    '<div style="margin-bottom:6px">🔧 使用工具前确认安全操作方式</div>'+
    '<div style="margin-bottom:6px">🚫 禁止在非指定区域使用明火</div>'+
    '<div style="margin-bottom:6px">📞 保存组织者联系方式：'+(c._contact||'请向管理员索取')+'</div>'+
    '<div style="color:#999;font-size:.58rem;margin-top:12px">以上为通用安全提示，具体活动可能有额外安全要求</div></div>';
}
function _briefSchedule(c) {
  var h = '<div style="font-size:.68rem;color:#3a3a3a;line-height:1.7">';
  h += '<div style="background:#e8f0f8;border-radius:10px;padding:12px;margin-bottom:10px"><div style="font-weight:700;color:#3a5a7a;margin-bottom:4px">📅 日程安排</div><div style="color:#4a6a8a">请确认你可以全程参加以下日程</div></div>';
  var schedule = c.schedule || [];
  if (schedule.length) {
    schedule.forEach(function(item, i) {
      h += '<div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start"><span style="background:#e8f0f8;color:#3a5a7a;padding:2px 8px;border-radius:6px;font-size:.6rem;font-weight:700;white-space:nowrap">第'+(i+1)+'天</span><span style="font-size:.65rem">'+esc(item.title||item||'')+'</span></div>';
    });
  } else {
    h += '<div style="color:#999;font-size:.65rem;text-align:center;padding:12px">日程待组织者发布</div>';
  }
  var milestones = c.milestones || [];
  if (milestones.length) {
    h += '<div style="font-weight:700;font-size:.65rem;color:#5a6e5c;margin:10px 0 4px">📌 关键节点</div>';
    milestones.forEach(function(m) { h += '<div style="font-size:.62rem;color:#5a6e5c;margin-bottom:2px">• '+esc(m.title||m||'')+'</div>'; });
  }
  h += '</div>';
  return h;
}
function _briefConfirm(c) {
  var h = '<div style="font-size:.68rem;color:#3a3a3a;line-height:1.7">';
  h += '<div style="background:#e8f5e8;border-radius:10px;padding:12px;margin-bottom:10px"><div style="font-weight:700;color:#3d6b52;margin-bottom:4px">✅ 最后确认</div><div style="color:#4a7a5a">点击下方按钮即表示你已阅读并同意以上全部内容</div></div>';
  h += '<div style="margin-bottom:4px">📋 已阅读活动须知</div>';
  h += '<div style="margin-bottom:4px">🛡️ 已了解安全提示</div>';
  h += '<div style="margin-bottom:4px">📅 已确认日程安排</div>';
  h += '<div style="margin-bottom:4px">📜 同意遵守社区公约</div>';
  h += '<div style="color:#999;font-size:.58rem;margin-top:10px">报到后你将正式成为本营地成员</div>';
  h += '</div>';
  return h;
}
// C-B-3: 调报到 API（幂等，already_member 视为成功）
function _doCampCheckin() {
  var campId = _briefingCampId; if (!campId) return;
  // 离线模式：记录本地，跳过 API
  if (_isOffline()) {
    showToast('离线模式，报到信息已记录', 'ok');
    _finishCheckin(campId);
    return;
  }
  if (typeof API === 'undefined' || !API.token) {
    showToast('请先登录', 'warn');
    return;
  }
  API.campCheckin(campId).then(function(r) {
    if (r && (r.ok || r.already_member)) {
      _finishCheckin(campId);
    } else {
      showToast((r && r.detail) || '报到失败，请稍后重试', 'error');
    }
  }).catch(function() {
    showToast('报到失败，请检查网络', 'error');
  });
}
function _finishCheckin(campId) {
  // 写本地 membership 缓存
  if (window.AppData) {
    if (!AppData._data.camp_memberships) AppData._data.camp_memberships = {};
    if (!AppData._data.camp_memberships[campId]) AppData._data.camp_memberships[campId] = {};
    AppData._data.camp_memberships[campId][CURRENT_USER] = true;
    AppData._saveShared();
    // 尝试拉后端真实 people 计数
    _enterCampFetchPeople(campId);
  }
  var el = document.querySelector('.mgmt-sheet'); if (el) el.remove();
  showToast('✅ 报到成功！欢迎加入', 'ok');
  openCampHome(campId);
}
var _inviteCampId = null;
function showInviteModal(campId) {
  _inviteCampId = campId;
  document.getElementById('inviteCodeInput').value = '';
  document.getElementById('inviteCodeError').textContent = '';
  document.getElementById('inviteModal').style.display = 'flex';
  setTimeout(function(){ document.getElementById('inviteCodeInput').focus(); }, 100);
}
function closeInviteModal() {
  document.getElementById('inviteModal').style.display = 'none';
  _inviteCampId = null;
}
function submitInviteCode() {
  var code = document.getElementById('inviteCodeInput').value.trim().toUpperCase();
  var errEl = document.getElementById('inviteCodeError');
  if (!code) { errEl.textContent = '请输入邀请码'; return; }
  if (!/^NT-[A-Z0-9]{4,12}$/.test(code)) { errEl.textContent = '格式：NT- 开头 + 4-12位字母数字'; return; }
  if (!window.AppData) { errEl.textContent = '系统错误，请刷新页面'; return; }
  var result = AppData.validateInviteCode(code, _inviteCampId);
  if (!result.valid) { errEl.textContent = result.reason || '邀请码无效'; return; }
  AppData.consumeInviteCode(code, CURRENT_USER);
  if (typeof changeUserRole === 'function') { changeUserRole(CURRENT_USER, 'adventurer', { inviteCode: code }); }
  if (window.NT) { var u = NT.getUser(CURRENT_USER); if (u) u.trustLevel = '可信'; }
  if (typeof logActivity === 'function') logActivity('role_change', CURRENT_USER + ' 从 云村民 升级为 冒险者');
  closeInviteModal();
  showToast('身份升级成功！⚔️ 欢迎加入营地', 'ok');
  openCampHome(_inviteCampId);
}
// ── 营地窗口 ──
function showCampWindow(campId) {
  var camps = getCamps();
  var c = camps.find(function(x){ return x.id===campId; }); if (!c) return;

  // 阶段6: 已归档营队 → 跳转只读报告
  if (c.status === 'archived') {
    _campCurrentId = campId;
    document.getElementById('campReportTitle').textContent = '📁 ' + c.name + ' · 归档';
    renderCampReport(document.getElementById('campReportBody'), c);
    document.getElementById('overlayCampReport').classList.add('open');
    return;
  }

  var users = typeof getUsers === 'function' ? getUsers() : {};
  var role = (users[CURRENT_USER] || {}).role || 'visitor';
  var isMember = isMemberByRole(role);

  document.getElementById('campWindowTitle').textContent = c.name;
  document.getElementById('campWindowTitle').setAttribute('data-camp-id', campId);

  var h = '<div style=text-align:center;padding:10px 0><div style=font-size:3rem>'+c.emoji+'</div><div style=font-weight:700;font-size:.95rem>'+c.name+'</div><div style=font-size:.72rem;color:#5a6e5c;margin-top:4px>'+c.theme+'</div></div>';
  h += '<div style=display:flex;gap:12px;justify-content:center;font-size:.68rem;color:#5a6e5c;margin-bottom:10px><span>📅 '+c.date+'</span><span>👥 '+c.people+'/'+c.max+'人</span><span>📍 '+(c.location||'')+'</span></div>';
  h += '<div style=font-size:.78rem;line-height:1.6;color:#1d2e24;padding:8px 0;border-top:1px solid #e8ede6>'+c.desc+'</div>';

  // ── 最近动态（新增）──
  var journal = (window.AppData && AppData._data.journal) ? AppData._data.journal : [];
  if (journal.length) {
    h += '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px;margin-top:8px"><div style=font-weight:700;font-size:.7rem;margin-bottom:6px>👥 最近动态</div>';
    journal.slice(0, 3).forEach(function(j) {
      var iconMap = { tip:'💬', encourage:'💬', task_done:'✅', task_post:'📋', checkin:'👋' };
      h += '<div style=font-size:.68rem;padding:4px 0;color:#5a6e5c;border-bottom:1px dotted #f0f0f0>'+(iconMap[j.type]||'📝')+' '+j.user+' · '+j.content+' <span style=color:#aaa;font-size:.6rem>'+j.date+'</span></div>';
    });
    h += '</div>';
  }

  // ── 照片（已有）──
  h += '<div class=camp-photos><div class=camp-photo>🖼️</div><div class=camp-photo>🖼️</div><div class=camp-photo>🖼️</div></div>';

  // ── 送鼓励（新增）──
  h += '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px;margin-top:8px">';
  h += '<div style=font-weight:700;font-size:.7rem;margin-bottom:8px>💬 送个鼓励</div>';
  h += '<div style=display:flex;align-items:center;gap:8px;margin-bottom:8px>';
  h += '<span style=font-size:.68rem;color:#5a6e5c>送给：</span>';
  h += '<span id="encourageTarget" style=font-weight:700;font-size:.78rem;color:var(--green-primary);cursor:pointer;border-bottom:2px dotted var(--green-primary);padding-bottom:2px" onclick="showMemberPicker(\'encourageTarget\')">点击选择成员</span>';
  h += '</div>';
  h += '<div style=display:flex;gap:6px>';
  h += '<button class="encourage-btn free" onclick="sendEncouragement(document.getElementById(\'encourageTarget\').textContent,\'👏\')">👏</button>';
  h += '<button class="encourage-btn free" onclick="sendEncouragement(document.getElementById(\'encourageTarget\').textContent,\'💪\')">💪</button>';
  h += '<button class="encourage-btn paid" onclick="sendEncouragement(document.getElementById(\'encourageTarget\').textContent,\'🌹1\')">🌹1</button>';
  h += '<button class="encourage-btn paid" onclick="sendEncouragement(document.getElementById(\'encourageTarget\').textContent,\'🎁5\')">🎁5</button>';
  h += '</div>';
  if (CURRENT_USER && window.NT) {
    var myNT = NT.getUser(CURRENT_USER);
    h += '<div style=font-size:.62rem;color:#8a8a8a;margin-top:6px>你的余额：💎 '+(myNT?myNT.ntBalance||0:0)+' NT</div>';
  }
  h += '</div>';

  // ── 日程亮点（已有）──
  if (c.highlights && c.highlights.length) {
    h += '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px;margin-top:8px"><div style=font-weight:700;font-size:.7rem;margin-bottom:6px>📋 日程亮点</div>';
    c.highlights.forEach(function(hl){ h += '<div style=font-size:.68rem;padding:4px 0;border-bottom:1px dotted #f0f0f0">· '+hl+'</div>'; });
    h += '</div>';
  }

  // ── 报名按钮（已有，逻辑修正）──
  if (!isMember && (c.status==='active'||c.status==='upcoming')) {
    h += '<button class="btn-pri btn-full" style=margin-top:12px onclick="enterCamp(\''+c.id+'\')">我要报名 →</button>';
    h += '<div style=font-size:.62rem;color:#8a8a8a;text-align:center;margin-top:4px>报名需要冒险者邀请码</div>';
  }

  document.getElementById('campWindowBody').innerHTML = h;
  document.getElementById('overlayCampWindow').classList.add('open');
}
