/* ══════════════════════════════════════════════════════════════════
   auth.js — 南塘云村 用户与权限（从 app.js 提取）
   用户管理 / 身份系统 / 邀请码 / 权限检查
   ══════════════════════════════════════════════════════════════════ */

// localStorage key 常量（NT_USERS_KEY / NT_SESSION_KEY）在 mobile-bundle.js 中定义。邀请码迁移到 AppData。
// encodePassword() — 在 utils.js 中定义，此处引用

// ═══ 用户 CRUD ═══
function getUsers() {
  try {
    var users = JSON.parse(safeStorage.getItem(NT_USERS_KEY)) || {};
    // A2 兜底：NT_USERS_KEY 为空时从 nt_local_users（{name: seed字符串}）合成用户记录
    if (Object.keys(users).length === 0) {
      var localUsers = JSON.parse(safeStorage.getItem('nt_local_users')) || {};
      var localRoles = JSON.parse(safeStorage.getItem('nt_local_roles')) || {};  // {name: role}
      Object.keys(localUsers).forEach(function(name) {
        users[name] = { name: name, avatar_seed: localUsers[name], role: localRoles[name] || 'visitor' };
      });
    }
    return users;
  } catch(e) { return {}; }
}
function saveUsers(users) { if (window.location.protocol === 'file:') safeStorage.setItem(NT_USERS_KEY, JSON.stringify(users)); }

// Phase 3: 邀请码存储 key 常量
var INVITES_KEY = 'nt_invites';

// ═══ NT 角色检查（原 app.js:6069，移入模块以确保 auth.js 自包含）═══
function hasNTRole() {
  if (!currentUser) return false;
  var staff = (data && data.staff_cards) ? data.staff_cards : [];
  var card = staff.find(function(c) { return c.name === currentUser.name; });
  return card && card.role === 'NT';
}

// ═══ 权限快捷检查 ═══
function userCan(user, cap) { if (!user) return false; var c = ROLE_CAPABILITIES[user.role]; return c ? !!c[cap] : false; }
function userTabs(user) { if (!user) return []; var c = ROLE_CAPABILITIES[user.role]; return c ? c.tabs : []; }
function hasRole(user, roles) { if (!user) return false; if (typeof roles === 'string') return user.role === roles; return roles.indexOf(user.role) >= 0; }
// D12: 便捷 helper——替代分散的 role==='admin'||role==='builder'||...
function isMemberByName(name) { var u = getUsers()[name]; return u ? userCan({name:name,role:u.role||'visitor'}, 'isMember') : false; }
function isMemberByRole(role) { return !!((ROLE_CAPABILITIES[role] || {}).isMember); }
function getActiveClaimant(t, name) { return (t.claimants || []).find(function(c) { return c.name === name && c.status !== 'dropped'; }); }

// ═══════════════════════════════════════════════════════════════════
// 身份工牌系统：全系统唯一身份入口
// 固定层 + 变化层 → 一个对象，所有 UI / 权限 / 数据显示都从这里取
// ═══════════════════════════════════════════════════════════════════
function getIdentity(user) {
  if (!user) return null;
  var name  = user.name;
  var role  = user.role || '';
  var users = getUsers();
  var u     = users[name] || {};
  var caps  = ROLE_CAPABILITIES[role] || {};
  var mem   = (window.AppData && AppData._data.users ? AppData._data.users[name] : null) || {};
  var bal   = calcNtByScope(name);
  var tasks = (window.AppData ? AppData.taskMarket() : []);
  var today = Clock.today();

  // ── 快捷角色判断 ──
  var isAdmin      = (role === 'admin');
  var isBuilder    = (role === 'builder');
  var isAdventurer = (role === 'adventurer');
  var isNPC        = (role === 'npc');
  var isVisitor    = (role === 'visitor');

  // ── 任务统计 ──
  var myClaims = tasks.filter(function(t) {
    var c = getActiveClaimant(t, name);
    return !!c;
  });
  var tasksActive = myClaims.filter(function(t) {
    var c = getActiveClaimant(t, name);
    return c && (c.status === 'in_progress' || c.status === 'triggered');
  }).length;
  var tasksSubmit = myClaims.filter(function(t) {
    var c = getActiveClaimant(t, name);
    return c && c.status === 'submitted';
  }).length;
  var tasksDone = myClaims.filter(function(t) {
    var c = getActiveClaimant(t, name);
    return c && (c.status === 'completed' || c.status === 'approved');
  }).length;

  // ── 成就 ──
  var completed = tasks.filter(function(t) {
    var c = (t.claimants || []).find(function(cl) { return cl.name === name; });
    return c && (c.status === 'completed' || c.status === 'approved');
  });
  var allMain  = tasks.filter(function(t) { return t.type === '主线'; });
  var doneMain = completed.filter(function(t) { return t.type === '主线'; });
  var autoAchievements = [];
  if (allMain.length > 0 && doneMain.length === allMain.length) autoAchievements.push({ icon: '🏅', name: '主线通关', desc: '完成全部主线任务' });
  if (completed.length >= 15) autoAchievements.push({ icon: '🎖️', name: '全勤猎人', desc: '完成 15 项以上任务' });
  var doneSide = completed.filter(function(t) { return t.type === '支线'; }).length;
  if (doneSide >= 6) autoAchievements.push({ icon: '⭐', name: '支线达人', desc: '完成 6 项以上支线任务' });
  var manualAch = (mem.achievements) || [];
  var achievements = autoAchievements.concat(manualAch);

  // ── 徽章（历期身份）──
  var badges = (u.season_history || []).slice().reverse().map(function(h) {
    var icon = ROLE_BADGE_ICONS[h.role] || '⭐';
    return { icon: icon, label: (h.period || '') + '·' + (ROLE_TITLES[h.role] || h.role), role: h.role, period: h.period, date: h.changed_at };
  });

  return {
    // ── 固定层（永不变）──
    uid:      u.uid || '',
    name:     name,
    created:  u.created || '',

    // ── 变化层（角色驱动）──
    role:     role,
    title:    ROLE_TITLES[role] || role,
    season:   u.season || '',
    worldId:  u.world_id || '',

    // ── 履历 ──
    badges:   badges,
    history:  u.season_history || [],

    // ── 权限 ──
    can: {
      isMember:       !!caps.isMember,
      postTask:       !isVisitor,
      claimTask:      !!caps.canClaimCamp || isAdmin,
      reviewTask:     isAdmin || hasNTRole(),
      manageNT:       isAdmin || hasNTRole(),
      seeMembers:     isAdmin || isBuilder,
      seeNTAdmin:     isAdmin,
      inviteCode:     isAdmin,
    },

    // ── 界面配置 ──
    ui: {
      tabs:             caps.tabs || [],
      defaultPage:      'workspace',  // 所有人默认进个人工作台
      mode:             (isAdmin || isBuilder) ? 'builder' : 'adventurer',
      showGenesisBtn:   isAdmin,
      showBuilderBar:   isAdmin,
      showQuestBoard:   !isVisitor,
      workspaceSections: (isAdmin || isBuilder)
        ? ['drafts','pendingReview','campApproval','posted','claimed','done']
        : ['drafts','posted','claimed','done'],
    },

    // ── 个人资料 ──
    profile: {
      avatar:      mem.avatar_seed !== undefined ? mem.avatar_seed : (u.avatar_seed || 0),
      gender:      mem.gender || '',
      bio:         mem.bio || '',
      phone:       mem.phone || '',
      address:     mem.address || '',
      wallet:      mem.wallet || '',
      skills:      mem.skills || [],
      customTitle: mem.identity || '',
    },

    // ── 实时数据 ──
    stats: {
      nt:          bal.camp + bal.personal,
      ntCamp:      bal.camp,
      ntPersonal:  bal.personal,
      daysActive:  u.created ? daysSince(u.created) : 0,
      tasksActive: tasksActive,
      tasksSubmit: tasksSubmit,
      tasksDone:   tasksDone,
      achievements: achievements,
    },

    // ── 快捷判断 ──
    isAdmin:      isAdmin,
    isBuilder:    isBuilder,
    isAdventurer: isAdventurer,
    isNPC:        isNPC,
    isVisitor:    isVisitor,
    isNewUser:    u.created ? (daysSince(u.created) < 7) : true,
  };
}

// ═══ 统一权限中枢：所有任务可见性/可领取判断均走此入口 ═══

// ── 基础：某用户能否看到某任务（显示层过滤用）──
function canUserSee(user, task) {
  if (!task || task.status === 'draft') return false;
  if (task.status === 'active') return true;                     // 活跃任务所有人可见
  if (!user) return false;
  if (hasRole(user, 'admin')) return true;                        // 管理员可见全部
  // 隐藏任务：仅发布者和已领取者可见
  if (task.type === '隐藏') {
    if (task.poster === user.name) return true;
    var claimed = (task.claimants || []).some(function(c) { return c.name === user.name && c.status !== 'dropped'; });
    return claimed;
  }
  // 非活跃状态（withdrawn 等）：仅发布者可见
  if (task.status !== 'active') return task.poster === user.name;
  return true;
}

// ── 完整：某用户能否领取某任务（claim 前校验 + 卡片锁定原因）──
function canUserClaim(user, task) {
  if (!user)                return { ok: false, reason: '请先登录' };
  if (!task)                return { ok: false, reason: '任务不存在' };
  // CR1: 字段名修正——服务端用 进行中/publisher/slots
  if (task.status !== '进行中') return { ok: false, reason: '任务当前不可领取' };
  if (hasRole(user, 'admin')) return { ok: true };
  if ((task.publisher||task.poster) === user.name) return { ok: false, reason: '不能领取自己发布的任务' };
  var activeC = (task.claimants || []).filter(function(c) { return c.status !== 'dropped'; });
  var maxSlots = task.slots || task.max_slots || 1;
  if (maxSlots > 0 && activeC.length >= maxSlots) return { ok: false, reason: '名额已满' };

  // 已领取检查
  var myClaim = activeC.find(function(c) { return c.name === user.name; });
  if (myClaim) return { ok: false, reason: '你已经领取过了' };

  // 营队任务需要 isMember
  var scope = task.scope || 'camp';
  if (scope === 'camp' && !userCan(user, 'isMember')) return { ok: false, reason: '需加入营队才能领取营队任务' };

  // 可见性检查（核心）
  var vis = task.visibility || 'all';
  if (vis === 'all') return { ok: true };

  if (vis === 'specific') {
    if (task.target_claimant === user.name) return { ok: true };
    return { ok: false, reason: '仅 ' + (task.target_claimant || '指定领取人') + ' 可领' };
  }

  // vis 是角色名：adventurer / builder / npc / visitor
  var validRoles = ['adventurer', 'builder', 'npc', 'visitor'];
  if (validRoles.indexOf(vis) !== -1) {
    if (user.role === vis) return { ok: true };
    var label = ROLE_TITLES[vis] || vis;
    return { ok: false, reason: '仅 ' + label + ' 可领' };
  }

  return { ok: true };  // fallback
}

// ── 便捷：检查并弹窗提示 ──
function assertCanClaim(user, task) {
  var cr = canUserClaim(user, task);
  if (!cr.ok) { setStatus(cr.reason); return false; }
  return true;
}

// ── 显示：任务可见性标签（与 canUserClaim 的决策逻辑完全对应）──
function getVisibilityLabel(task) {
  var vis = task.visibility || 'all';
  if (vis === 'all') return '';  // 所有人可领，无需标注
  if (vis === 'specific') return '🎯 仅 ' + (task.target_claimant || '指定者');
  var map = { adventurer: '⚔️ 仅冒险者', builder: '🧱 仅共建者', npc: '👥 仅在地伙伴', visitor: '🏕️ 仅云村民' };
  return map[vis] || '';
}

// ── 核对：当前用户是否能领（与卡片锁图标一致）──
function getLockReason(user, task) {
  if (!user) return '请先登录查看';
  var cr = canUserClaim(user, task);
  return cr.ok ? '' : cr.reason;
}

// ═══ 邀请码 ═══
// Phase 0: 统一存储到 AppData._data.inviteCodes
function getWorldCodes() {
  if (!window.AppData || !AppData._data.inviteCodes) return [];
  return Object.keys(AppData._data.inviteCodes).filter(function(k) {
    var c = AppData._data.inviteCodes[k];
    return c.role === 'adventurer' && !c.usedBy;
  });
}
function saveWorldCodes(codes) { /* no-op: AppData handles persistence */ }
function getInviteCodes() {
  if (!window.AppData || !AppData._data.inviteCodes) return [];
  return Object.keys(AppData._data.inviteCodes).filter(function(k) {
    var c = AppData._data.inviteCodes[k];
    return c.role === 'npc' && !c.usedBy;
  });
}
function saveInviteCodes(codes) { /* no-op: AppData handles persistence */ }

function generateInviteCode() { var arr = new Uint8Array(4); crypto.getRandomValues(arr); return 'NT-' + Array.from(arr).map(function(b) { return b.toString(36).toUpperCase().padStart(2, '0'); }).join(''); }

// ═══ 角色变更 ═══
function changeUserRole(name, newRole, opts) {
  opts = opts || {};
  var users = getUsers();
  if (!users[name]) return { ok: false, error: '用户不存在' };

  // Step 0: 校验
  var validRoles = ['admin', 'builder', 'adventurer', 'npc', 'visitor'];
  if (validRoles.indexOf(newRole) === -1) return { ok: false, error: '无效的角色：' + newRole };
  var oldRole = opts.fromRole || users[name].role;
  // P1: HTTP 模式信任服务端 role，仅 file:// 模式启用客户端 adminNames 守卫
  if (!(typeof API !== 'undefined' && API.token) && (typeof adminNames!=='undefined'?adminNames:['砚仁']).indexOf(name) !== -1 && newRole !== 'admin') {
    return { ok: false, error: '管理员不可被降级' };
  }
  if (newRole === 'builder') {
    var history = users[name].season_history || [];
    var wasAdventurer = history.some(function(h) { return h.role === 'adventurer'; });
    if (!opts.skipAdventurerCheck && !wasAdventurer && oldRole !== 'adventurer') {
      return { ok: false, error: '共建者需先有冒险者经历' };
    }
  }
  // 邀请码校验（必须在修改数据前完成，避免无效码导致半途修改）
  if (opts.inviteCode) {
    var wc = getWorldCodes();
    var ic = getInviteCodes();
    var codeValid = false;
    if (newRole === 'adventurer') {
      codeValid = wc.indexOf(opts.inviteCode) !== -1;
    } else if (newRole === 'npc') {
      codeValid = wc.indexOf(opts.inviteCode) !== -1 || ic.indexOf(opts.inviteCode) !== -1;
    }
    if (!codeValid) return { ok: false, error: '邀请码无效（冒险者池' + wc.length + '个，NBC池' + ic.length + '个）' };
  }

  // Step 1: 写 season_history
  if (!users[name].season_history) users[name].season_history = [];
  users[name].season_history.push({
    role: oldRole,
    period: opts.period || '',
    changed_at: Clock.today()
  });

  // Step 2: 更新 users 表
  users[name].role = newRole;
  if (opts.inviteCode && (newRole === 'adventurer' || newRole === 'npc')) {
    users[name].world_id = opts.inviteCode;
  }
  if (opts.staffCard) {
    users[name].staff_card = opts.staffCard;
  }
  saveUsers(users);

  // Phase 3: 双向同步 — AppData 也更新角色
  if (window.AppData) AppData.setMe('role', newRole);

  // Phase 0: 角色通过 saveUsers 和 AppData 同步，不再写 data.members
  saveData();

  // Step 4: 如果改的是当前登录用户，刷新界面
  if (currentUser && currentUser.name === name && !opts.skipUI) {
    currentUser.role = newRole;
    safeStorage.setItem(NT_SESSION_KEY, JSON.stringify(currentUser)); // 同步 session，防止刷新后回退
    refreshUserHUD();
    var newId = getIdentity(currentUser);
    showMainInterface(newId, 'workspace');
  }

  // Step 5: 消耗邀请码（校验已在 Step 0 完成，这里只消费）
  if (opts.inviteCode && window.AppData) {
    AppData.consumeInviteCode(opts.inviteCode, name);
  }

  if (!data.activity_log) data.activity_log = [];
  data.activity_log.push({ time: Clock.iso(), type: 'role_change', text: name + '：' + (ROLE_LABELS[oldRole]||oldRole) + ' → ' + (ROLE_LABELS[newRole]||newRole) });
  return { ok: true };
}

// ═══ 注册 / 登录 / 登出 ═══
function generateUID(name) {
  // 格式：NT + 时间戳后6位 + '-' + 名字缩写（前2-3个字母/汉字）
  var num = String(Clock.stamp()).slice(-6);
  if (name) {
    var abbr = name.replace(/[^a-zA-Z一-鿿]/g, '').slice(0, 3);
    return 'NT' + num + '-' + abbr;
  }
  return 'NT' + num;
}

function registerUser(name, password, role, avatarSeed, inviteCode) {
  var users = getUsers();
  if (users[name]) return { ok: false, error: '这个名字已经被注册了' };
  if (role === 'adventurer') {
    var codes = getWorldCodes();
    if (!inviteCode) return { ok: false, error: '需要冒险者邀请码' };
    if (!codes.includes(inviteCode)) return { ok: false, error: '邀请码无效' };
    if (window.AppData) AppData.consumeInviteCode(inviteCode, name);
  }
  users[name] = { name: name, role: role, password: encodePassword(password, name), avatar_seed: avatarSeed, season: '', created: Clock.today(), world_id: (role === 'adventurer') ? inviteCode : null, uid: generateUID(name), season_history: [{ role: role, period: '', changed_at: Clock.today() }] };
  saveUsers(users);
  // Phase 0: 用户数据通过 AppData.switchUser 同步
  if (window.AppData) { AppData._data.users[name] = { name: name, role: role, avatar_seed: avatarSeed }; AppData._save(); }
  return { ok: true };
}

function loginUser(name, password, rememberMe) {
  var users = getUsers(), user = users[name];
  if (!user) return { ok: false, error: '用户不存在' };
  if (user.password == null) {
    if (!password || password.length < 8) return { ok: false, error: '请设置你的密码（至少 8 位）' };
    user.password = encodePassword(password, name); saveUsers(users);
  } else {
    var newHash = encodePassword(password, name);
    if (user.password !== newHash) {
      // Migration: old btoa-format passwords
      var oldHash;
      try { oldHash = btoa(encodeURIComponent(password + ':' + name)); } catch(e) { oldHash = ''; }
      if (user.password === oldHash && typeof isOldPasswordFormat === 'function' && isOldPasswordFormat(user.password)) {
        // Old format matched — migrate to new hash
        user.password = newHash; saveUsers(users);
      } else {
        return { ok: false, error: '密码错误' };
      }
    }
  }
  currentUser = { name: user.name, role: user.role }; previewMode = false;
  safeStorage.setItem(NT_SESSION_KEY, JSON.stringify(currentUser));
  if (rememberMe) safeStorage.setItem('nt_remembered_user', JSON.stringify(currentUser));
  if (typeof enterWorld === 'function') enterWorld(currentUser, 'login');
  return { ok: true };
}

function logoutUser() {
  if (!confirm('确定退出登录？')) return;
  if (currentUser && currentTab) saveLastPage(currentUser.name, currentTab);
  currentUser = null; previewMode = false; localStorage.removeItem(NT_SESSION_KEY);
  ['worldHUD','builderTabs','adventurerTabs','builderModeBar','instanceSidebar','mobileBottomNav'].forEach(function(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); });
  var banner = document.getElementById('previewBanner'); if (banner) banner.style.display = 'none';
  document.body.classList.remove('builder-mode', 'adventurer-mode', 'sidebar-open', 'has-mobile-nav'); hideAllTabs(); closeMoreSheet(); closeProfilePanel();
  _moreSheetCacheRole = null; // 重置浮层缓存，下次登录按新角色渲染
  document.getElementById('loginPage').style.display = 'flex'; showLoginEntry();
}
