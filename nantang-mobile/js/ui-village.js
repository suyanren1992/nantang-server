// ── 任务12: 进入营地 + 邀请码 ──
function enterCamp(campId) {
  if (!CURRENT_USER) { showToast('请先登录','error'); return; }
  var users = typeof getUsers==='function'?getUsers():{};
  var role = (users[CURRENT_USER]||{}).role;
  if (isMemberByRole(role)) { openCampHome(campId); return;
  }
  // npc 或 visitor → 邀请码弹窗
  showInviteModal(campId);
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
