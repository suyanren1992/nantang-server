// ═══ 7步创营向导 ═══
var _campDraft = null;
var _campWizardStep = 1;
var _ceremonyTL = null;

function openCreateCamp() {
  // P0-1: 检测未完成草稿
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('nantang_camp_draft')); } catch(e) {}
  if (saved && saved.step1 && saved.step1.name) {
    if (confirm('检测到未完成的创营草稿「' + saved.step1.name + '」，是否恢复？\n\n选择「取消」将重新开始。')) {
      _campDraft = saved;
      _campWizardStep = saved._step || 1;
      document.getElementById('overlayCreateCamp').classList.add('open');
      renderWizardStep(_campWizardStep);
      showToast('草稿已恢复', 'ok');
      return;
    }
    sessionStorage.removeItem('nantang_camp_draft');
  }
  _campDraft = {
    step1: { name:'', season:'第四期', type:'regular', theme:'', desc:'', testMode:false, soulWhy:'', soulWho:'', soulWhat:'' },
    step2: { startDate:'', days:8, schedule:[], milestones:[] },
    step3: { adventurers:10, builders:6, earlyBirdPrice:499, earlyBirdPct:60, fullPrice:599,
             lodgingRmb:30, lodgingNT:40, mealRmb:8, mealNT:10, extraIncome:[], extraExpense:[] },
    step4: { tasks:[] },
    step5: { builders:[] },
    step6: { sentAt:null, confirmations:{} },
    step7: { launched:false }
  };
  // P2-2: 预填 18 个默认预算项
  var defBudget = initDefaultBudgetItems();
  _campDraft.step3.extraIncome = defBudget.extraIncome.slice();
  _campDraft.step3.extraExpense = defBudget.extraExpense.slice();
  _campWizardStep = 1;
  document.getElementById('overlayCreateCamp').classList.add('open');
  renderWizardStep(1);
}

function cancelCampWizard() {
  if (_campDraft && _campDraft.step1.name) {
    if (!confirm('确定放弃创建？已填写的内容将丢失。')) return;
  }
  sessionStorage.removeItem('nantang_camp_draft');
  _campDraft = null;
  document.getElementById('overlayCreateCamp').classList.remove('open');
}

function campWizardPrev() { goWizardStep(_campWizardStep - 1); }

function goWizardStep(step) {
  if (step < 1 || step > 7) return;
  saveWizardStep(_campWizardStep);
  var err = step > _campWizardStep ? validateWizardStep(_campWizardStep) : null;
  if (err) { showToast(err, 'warn'); return; }
  _campWizardStep = step;
  renderWizardStep(step);
  document.getElementById('campWizardBody').scrollTop = 0;
}

function validateWizardStep(step) {
  if (step === 1) {
    if (!_campDraft.step1.name) return '请输入营队名称';
    if (!_campDraft.step1.theme) return '请输入一句话主题';
  }
  if (step === 5) {
    if (!_campDraft.step5.builders.length) return '请至少选择一位共建人';
  }
  return null;
}

function saveWizardStep(step) {
  if (step === 1) {
    var nameEl = document.getElementById('cwName'); if (nameEl) _campDraft.step1.name = nameEl.value.trim();
    var seasonEl = document.getElementById('cwSeason'); if (seasonEl) _campDraft.step1.season = seasonEl.value;
    var typeEl = document.querySelector('input[name="cwType"]:checked'); if (typeEl) _campDraft.step1.type = typeEl.value;
    var themeEl = document.getElementById('cwTheme'); if (themeEl) _campDraft.step1.theme = themeEl.value.trim();
    var descEl = document.getElementById('cwDesc'); if (descEl) _campDraft.step1.desc = descEl.value.trim();
    var testEl = document.getElementById('cwTestMode'); if (testEl) _campDraft.step1.testMode = testEl.checked;
    var swEl = document.getElementById('cwSoulWhy'); if (swEl) _campDraft.step1.soulWhy = swEl.value.trim();
    var soEl = document.getElementById('cwSoulWho'); if (soEl) _campDraft.step1.soulWho = soEl.value.trim();
    var stEl = document.getElementById('cwSoulWhat'); if (stEl) _campDraft.step1.soulWhat = stEl.value.trim();
  }
  if (step === 2) {
    var sdEl = document.getElementById('cwStartDate'); if (sdEl) _campDraft.step2.startDate = sdEl.value;
    var daysEl = document.getElementById('cwDays'); if (daysEl) _campDraft.step2.days = parseInt(daysEl.value) || 8;
  }
  if (step === 3) {
    var map3 = { cwAdventurers:'adventurers', cwBuilders:'builders', cwEarlyBird:'earlyBirdPrice', cwEarlyBirdPct:'earlyBirdPct', cwFullPrice:'fullPrice', cwLodgingRmb:'lodgingRmb', cwLodgingNT:'lodgingNT', cwMealRmb:'mealRmb', cwMealNT:'mealNT' };
    Object.keys(map3).forEach(function(id) {
      var el = document.getElementById(id); if (!el) return;
      _campDraft.step3[map3[id]] = parseInt(el.value) || 0;
    });
  }
  try { _campDraft._step = _campWizardStep; sessionStorage.setItem('nantang_camp_draft', JSON.stringify(_campDraft)); } catch(e) {}
}

function updateWizardButtons() {
  var btnBack = document.getElementById('wizBtnBack');
  var btnNext = document.getElementById('wizBtnNext');
  btnBack.style.display = _campWizardStep === 1 ? 'none' : 'block';
  if (_campWizardStep === 1) {
    btnNext.textContent = '✨ 点燃火种 →';
    btnNext.className = 'wiz-btn next primary';
  } else if (_campWizardStep === 6) {
    var allConfirmed = _campDraft.step5.builders.length > 0 && _campDraft.step5.builders.every(function(b){return b.confirmed;});
    if (allConfirmed) {
      btnNext.textContent = '🎊 启营仪式 →';
      btnNext.className = 'wiz-btn next primary';
    } else {
      btnNext.textContent = '📤 发送确认请求';
      btnNext.className = 'wiz-btn next';
    }
  } else if (_campWizardStep === 7) {
    btnBack.style.display = 'none';
    btnNext.textContent = '🏁 正式启动';
    btnNext.className = 'wiz-btn next primary';
  } else {
    btnNext.textContent = '下一步 →';
    btnNext.className = 'wiz-btn next';
  }
}

// ═══ 第①步 ═══
function renderWizardStep(step) {
  var titleEl = document.getElementById('campWizardTitle');
  var bodyEl = document.getElementById('campWizardBody');
  var steps = ['','① 点燃火种','② 绘制星图','③ 铸造预算','④ 铭刻符文','⑤ 召唤英雄','⑥ 签订契约','⑦ 开启传送门'];
  titleEl.textContent = steps[step] || '创建营队';
  var dotsHtml = '';
  for (var i = 1; i <= 7; i++) {
    dotsHtml += '<span class="wiz-dot' + (i === step ? ' active' : i < step ? ' done' : '') + '" onclick="goWizardStep('+i+')">' + (i < step ? '✓' : i) + '</span>';
  }
  titleEl.innerHTML = '<span>' + (steps[step] || '创建营队') + '</span><span style="margin-left:10px">' + dotsHtml + '</span>';
  var subtitles = { 1:'填入基本信息，点燃属于你们的共创火种', 2:'设定营期起止日期，编排每日活动日程', 3:'规划收入与支出，预览营队财务全景', 4:'从模板导入或逐条添加营队任务', 5:'选择共建者并匹配合适的任务', 6:'向共建者发送任务确认，收集反馈', 7:'汇聚星光，正式启动营队' };
  var guideEl = document.getElementById('campWizardGuide');
  if (!guideEl) {
    guideEl = document.createElement('div'); guideEl.id = 'campWizardGuide';
    guideEl.style.cssText = 'padding:8px 14px;font-size:.65rem;color:#5a6e5c;text-align:center;border-bottom:1px solid #e8ede6;background:#fafaf8;line-height:1.4';
    var body = document.getElementById('campWizardBody');
    body.parentNode.insertBefore(guideEl, body);
  }
  guideEl.textContent = '💡 ' + (subtitles[step] || '');
  updateWizardButtons();
  if (step === 1) renderStep1(bodyEl);
  else if (step === 2) renderStep2(bodyEl);
  else if (step === 3) renderStep3(bodyEl);
  else if (step === 4) renderStep4(bodyEl);
  else if (step === 5) renderStep5(bodyEl);
  else if (step === 6) renderStep6(bodyEl);
  else if (step === 7) renderStep7(bodyEl);
}

// esc() fallback guard — 必须在 renderStep1 之前定义
if (typeof esc !== 'function') { function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); } }

function renderStep1(el) {
  var s = _campDraft.step1;
  var quickTpls = [
    { name:'工笔画营', theme:'以画笔绘南塘', emoji:'🎨', days:7, adv:6, bld:3, eb:499, fp:599, season:'第四期' },
    { name:'生活体验营', theme:'在地生活七日谈', emoji:'🏕️', days:15, adv:12, bld:4, eb:399, fp:499, season:'第五期' },
    { name:'青年间隔月', theme:'28天发现另一种可能', emoji:'🌟', days:28, adv:20, bld:2, eb:199, fp:299, season:'特别期' }
  ];
  var qsHtml = '<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding:4px 0"><span style="font-size:.62rem;color:#5a6e5c;white-space:nowrap;padding:4px 4px 4px 0">🚀 快速启动：</span>';
  quickTpls.forEach(function(qt) {
    qsHtml += '<div style="flex:none;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:.62rem;text-align:center;min-width:80px" onclick="applyQuickTemplate(\''+qt.name+'\')"><div style="font-size:1.2rem">'+qt.emoji+'</div><div style="font-weight:600;margin:2px 0">'+qt.name+'</div><div style="color:#8a8a8a">'+qt.days+'天·'+qt.adv+'人</div></div>';
  });
  qsHtml += '</div>';
  el.innerHTML = qsHtml + '<div style="padding:14px">'+
    '<div style="margin-bottom:12px"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">营队名称 *</label>'+
    '<input id="cwName" class="login-input" value="'+esc(s.name)+'" placeholder="例：第四期南塘共创营" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px"></div>'+
    '<div style="margin-bottom:12px"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">期数</label>'+
    '<select id="cwSeason" class="login-input" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px">'+
      ['第一期','第二期','第三期','第四期','第五期','第六期','第七期','第八期','第九期','第十期','特别期'].map(function(v){ return '<option'+(v===s.season?' selected':'')+'>'+v+'</option>'; }).join('')+
    '</select></div>'+
    '<div style="margin-bottom:12px"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">类型</label>'+
    '<div style="display:flex;gap:12px;margin-top:6px">'+
      '<label style="cursor:pointer;font-size:.78rem"><input type="radio" name="cwType" value="regular"'+(s.type==='regular'?' checked':'')+' style="margin-right:4px">常规共创营</label>'+
      '<label style="cursor:pointer;font-size:.78rem"><input type="radio" name="cwType" value="special"'+(s.type==='special'?' checked':'')+' style="margin-right:4px">特别活动营</label>'+
    '</div></div>'+
    '<div style="margin-bottom:12px"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">一句话主题 *</label>'+
    '<input id="cwTheme" class="login-input" value="'+esc(s.theme)+'" placeholder="例：南塘有风，共创有光" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px"></div>'+
    '<div style="margin-bottom:12px"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">描述（可选）</label>'+
    '<textarea id="cwDesc" class="login-input" rows="3" placeholder="七天沉浸式在地创作…" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.72rem;padding:8px;width:100%;resize:vertical;font-family:inherit">'+esc(s.desc)+'</textarea></div>'+
    '<label style="cursor:pointer;font-size:.72rem;color:#5a6e5c;display:flex;align-items:center;gap:6px"><input type="checkbox" id="cwTestMode"'+(s.testMode?' checked':'')+' style="accent-color:var(--green-primary)"> 🧪 测试模式（不计入正式统计）</label>'+
    '<div style="margin-top:12px;background:#fafaf8;border:1px solid #e8ede6;border-radius:10px;padding:10px;cursor:pointer" onclick="var el=document.getElementById(\'soulQuestions\');el.style.display=el.style.display===\'none\'?\'block\':\'none\'"><div style="font-size:.65rem;color:#5a6e5c;font-weight:600">💭 Soul Questions <span style="font-size:.55rem;color:#8a8a8a">（可选·点击展开）</span></div></div>'+
    '<div id="soulQuestions" style="display:none;padding:8px 10px">'+
    '<div style="margin-bottom:8px"><label style="font-size:.6rem;color:#5a6e5c">为什么做这个营？</label>'+
    '<textarea id="cwSoulWhy" class="login-input" rows="2" placeholder="我想要创造什么样的体验？" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.68rem;padding:6px;width:100%;resize:vertical;font-family:inherit">'+esc(s.soulWhy||'')+'</textarea></div>'+
    '<div style="margin-bottom:8px"><label style="font-size:.6rem;color:#5a6e5c">为谁而做？</label>'+
    '<textarea id="cwSoulWho" class="login-input" rows="2" placeholder="谁会来？他们需要什么？" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.68rem;padding:6px;width:100%;resize:vertical;font-family:inherit">'+esc(s.soulWho||'')+'</textarea></div>'+
    '<div style="margin-bottom:0"><label style="font-size:.6rem;color:#5a6e5c">做成什么样才算成功？</label>'+
    '<textarea id="cwSoulWhat" class="login-input" rows="2" placeholder="三个月后回头看，什么让我觉得值得？" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.68rem;padding:6px;width:100%;resize:vertical;font-family:inherit">'+esc(s.soulWhat||'')+'</textarea></div>'+
    '</div>'+
  '</div>';
}

function applyQuickTemplate(name) {
  var map = {
    '工笔画营': { name:'工笔画创作营', theme:'以画笔绘南塘', season:'第四期', days:7, adv:6, bld:3, eb:499, fp:599 },
    '生活体验营': { name:'南塘生活体验营', theme:'在地生活七日谈', season:'第五期', days:15, adv:12, bld:4, eb:399, fp:499 },
    '青年间隔月': { name:'青年间隔月', theme:'28天发现另一种可能', season:'特别期', days:28, adv:20, bld:2, eb:199, fp:299 }
  };
  var t = map[name]; if (!t) return;
  if (_campDraft.step1.name && !confirm('替换当前已填写内容？')) return;
  _campDraft.step1.name = t.name; _campDraft.step1.theme = t.theme; _campDraft.step1.season = t.season;
  _campDraft.step2.days = t.days;
  _campDraft.step3.adventurers = t.adv; _campDraft.step3.builders = t.bld;
  _campDraft.step3.earlyBirdPrice = t.eb; _campDraft.step3.fullPrice = t.fp;
  showToast('已应用模板：'+name, 'ok');
  renderWizardStep(1);
}

// ═══ 第①→② 过渡动画 ═══
function playCreateCeremony() {
  var layer = document.getElementById('campCeremonyLayer');
  var content = document.getElementById('ceremonyContent');
  layer.style.display = 'flex';
  document.getElementById('ceremonySkip').style.display = 'block';
  var name = _campDraft.step1.name;
  var theme = _campDraft.step1.theme;
  var creator = CURRENT_USER || '';
  content.innerHTML = '<div id="candle" style="font-size:4rem;opacity:0">🕯️</div>'+
    '<div id="fireGlow" style="position:absolute;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,180,50,.6),transparent);opacity:0"></div>'+
    '<div id="campNameReveal" style="font-size:1.5rem;font-weight:700;color:#fff;margin-top:40px;opacity:0">'+name+'</div>'+
    '<div id="campThemeReveal" style="font-size:.9rem;color:rgba(255,255,255,.7);margin-top:8px;opacity:0">'+theme+'</div>'+
    '<div id="campCreated" style="font-size:1rem;color:#fff;margin-top:60px;opacity:0">营队正式创立</div>'+
    '<div id="campCreator" style="font-size:.8rem;color:rgba(255,255,255,.6);margin-top:8px;opacity:0">'+creator+' 创建</div>';
  if (_ceremonyTL) _ceremonyTL.kill();
  _ceremonyTL = gsap.timeline({ onComplete: function() {
    setTimeout(function() {
      document.getElementById('campCeremonyLayer').style.display = 'none';
      document.getElementById('ceremonySkip').style.display = 'none';
      goWizardStep(2);
    }, 500);
  }});
  _ceremonyTL.to('#candle', { opacity:1, duration:.5 })
    .to('#fireGlow', { opacity:1, scale:1.5, duration:.5 }, '-=.2')
    .to('#campNameReveal', { opacity:1, duration:.8 }, '+=.2')
    .to('#campThemeReveal', { opacity:1, duration:.6 }, '-=.4')
    .to('#campCreated', { opacity:1, duration:.6 }, '+=.3')
    .to('#campCreator', { opacity:1, duration:.6 }, '-=.3');
}

function skipCeremony() {
  if (_ceremonyTL) _ceremonyTL.progress(1);
}

function campWizardNext() {
  saveWizardStep(_campWizardStep);
  if (_campWizardStep === 1) {
    var err = validateWizardStep(1);
    if (err) { showToast(err, 'warn'); return; }
    playCreateCeremony();
    return;
  }
  if (_campWizardStep === 7) {
    playLaunchCeremony();
    return;
  }
  var err = validateWizardStep(_campWizardStep);
  if (err) { showToast(err, 'warn'); return; }
  goWizardStep(_campWizardStep + 1);
}

// ═══ 第②步 — 时间参数（升级版：11时段 + 单元格编辑 + 模板） ═══
var SCHED_TPL_KEY = 'nantang_sched_templates';
var _schedEditSi = -1, _schedEditDi = -1;
// 来自电脑端创世终端的 11 时段模板
var DEFAULT_SLOTS_MOBILE = [
  { section:'🎯 活动日', time:'6:30-7:30' },
  { section:'🍵 早餐', time:'7:30-8:00' },
  { section:'🚶 晨间活动', time:'8:00-9:00' },
  { section:'📚 上午主课', time:'9:00-10:30' },
  { section:'🎯 自主时间', time:'10:30-11:30' },
  { section:'🍚 午餐&午休', time:'11:30-14:30' },
  { section:'🎨 下午主课', time:'14:30-15:00' },
  { section:'✍️ 练习时间', time:'15:00-16:30' },
  { section:'☕ 自由活动', time:'16:30-17:30' },
  { section:'🍲 晚餐', time:'17:30-19:30' },
  { section:'🌙 晚间活动', time:'19:30-22:00' }
];

function renderStep2(el) {
  var s = _campDraft.step2;
  var today = new Date().toISOString().slice(0,10);
  var tplNames = keysSchedTemplates();
  var h = '<div style="padding:14px">'+
    '<div style="display:flex;gap:8px;margin-bottom:12px"><div style="flex:1"><label style="font-size:.62rem;color:#5a6e5c;font-weight:600">营期起</label>'+
    '<input id="cwStartDate" class="login-input" type="date" value="'+(s.startDate||today)+'" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px"></div>'+
    '<div style="width:70px"><label style="font-size:.62rem;color:#5a6e5c;font-weight:600">天数</label>'+
    '<input id="cwDays" class="login-input" type="number" value="'+s.days+'" min="1" max="60" style="margin:2px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px"></div></div>'+
    '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center">'+
    '<select id="cwSchedTpl" style="flex:1;padding:8px;border:1px solid #d0d9ce;border-radius:8px;font-size:.72rem;background:#fff" onchange="loadSchedTemplate(this.value)"><option value="">📋 选择日程模板…</option>';
  tplNames.forEach(function(n){ h += '<option value="'+esc(n)+'">'+esc(n)+'</option>'; });
  h += '</select></div>'+
    '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">'+
    '<button class="wiz-chip active" onclick="generateCampSchedule()">🔄 生成日历</button>';
  if (s.schedule && s.schedule.length) {
    h += '<button class="wiz-chip" onclick="addSchedDay()">＋天</button>'+
    '<button class="wiz-chip" onclick="removeSchedDay()">−天</button>'+
    '<button class="wiz-chip" onclick="saveSchedTemplate()">💾 存模板</button>'+
    '<button class="wiz-chip" onclick="copyPrevDaySched()">📋 复制前一天</button>'+
    '<button class="wiz-chip" onclick="addSchedSlot()">＋行</button>'+
    '<button class="wiz-chip" onclick="removeSchedSlot()">−行</button>';
  }
  h += '</div>';

  // 日程网格
  if (s.schedule && s.schedule.length) {
    var days = (s.schedule[0].cells||[]).length;
    h += '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;overflow:hidden;margin-bottom:10px">'+
      '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch" id="schedGridScroll">'+
      '<table style="font-size:.58rem;border-collapse:collapse;min-width:'+(days*60+70)+'px;width:max-content">'+
      '<thead><tr><th style="position:sticky;left:0;background:#f7f7f5;padding:4px 2px;min-width:70px;border-bottom:1px solid #e0e0e0"></th>';
    for (var d = 0; d < days; d++) {
      var dd = offsetDate(s.startDate, d);
      h += '<th style="padding:4px 2px;min-width:60px;border-bottom:1px solid #e0e0e0;text-align:center;font-weight:600">D'+(d+1)+'<br><span style="font-weight:400;color:#8a8a8a">'+(dd||'').slice(5)+'</span></th>';
    }
    h += '</tr></thead><tbody>';
    s.schedule.forEach(function(slot, si) {
      h += '<tr><td style="position:sticky;left:0;background:#f7f7f5;padding:4px 6px;font-weight:600;border-bottom:1px solid #f0f0f0;white-space:nowrap;font-size:.55rem">'+slot.section+'<br><span style="color:#8a8a8a;font-weight:400">'+slot.time+'</span></td>';
      for (var d2 = 0; d2 < days; d2++) {
        var cell = (slot.cells||[])[d2] || '';
        var bg = cell ? '#e8f0e4' : '#fff';
        h += '<td style="padding:2px;border-bottom:1px solid #f0f0f0;cursor:pointer;background:'+bg+'" onclick="editSchedCell('+si+','+d2+')"><div style="min-height:28px;font-size:.55rem;line-height:1.3;word-break:break-all;max-width:58px;overflow:hidden;max-height:30px">'+(cell?cell:'·')+'</div></td>';
      }
      h += '</tr>';
    });
    h += '</tbody></table></div></div>';
  } else {
    h += '<div style="text-align:center;padding:20px;color:#8a8a8a;font-size:.68rem;background:#fff;border:1px dashed #d0d9ce;border-radius:10px">👆 先设置日期和天数，点击「生成日历」</div>';
  }
  h += renderMilestones(s);
  el.innerHTML = h;
}

function generateCampSchedule() {
  var startDate = document.getElementById('cwStartDate').value;
  var days = parseInt(document.getElementById('cwDays').value) || 8;
  if (!startDate) { showToast('请先设置营期起日期', 'warn'); return; }
  _campDraft.step2.startDate = startDate;
  _campDraft.step2.days = days;
  var slots = DEFAULT_SLOTS_MOBILE.map(function(s){ return { section:s.section, time:s.time, cells:new Array(days).fill('') }; });
  // 从模板填充内容
  var tplName = document.getElementById('cwSchedTpl').value;
  if (tplName) {
    var tpl = loadSchedTemplateData(tplName);
    if (tpl && tpl.slots) {
      tpl.slots.forEach(function(ts, si) {
        if (si >= slots.length) return;
        (ts.cells||[]).forEach(function(c, di) { if (di < days && c) slots[si].cells[di] = c; });
      });
    }
  }
  _campDraft.step2.schedule = slots;
  var ms = PRESET_MILESTONES.map(function(m) {
    return { name:m.name, date:resolveMilestoneOffset(m.offset, startDate, days), rule:m.rule, locked:true };
  });
  _campDraft.step2.milestones = ms;
  showToast('日程已生成！11时段 × '+days+' 天', 'ok');
  renderWizardStep(2);
}

function editSchedCell(si, di) {
  _schedEditSi = si; _schedEditDi = di;
  var slot = _campDraft.step2.schedule[si];
  var dateStr = offsetDate(_campDraft.step2.startDate, di);
  document.getElementById('schedEditLabel').textContent = (dateStr||'') + ' · ' + slot.section + ' (' + slot.time + ')';
  document.getElementById('schedEditText').value = (slot.cells||[])[di] || '';
  document.getElementById('schedEditModal').style.display = 'flex';
  setTimeout(function(){ document.getElementById('schedEditText').focus(); }, 100);
}

function saveSchedEdit() {
  var si = _schedEditSi, di = _schedEditDi;
  if (si < 0 || di < 0) return;
  var slot = _campDraft.step2.schedule[si];
  if (!slot) return;
  if (!slot.cells) slot.cells = [];
  slot.cells[di] = document.getElementById('schedEditText').value;
  closeSchedEdit();
  renderWizardStep(2);
}

function closeSchedEdit() {
  document.getElementById('schedEditModal').style.display = 'none';
  _schedEditSi = -1; _schedEditDi = -1;
}

function addSchedDay() {
  var s = _campDraft.step2;
  if (!s.schedule || !s.schedule.length) return;
  var days = (s.schedule[0].cells||[]).length;
  s.schedule.forEach(function(slot) { if (!slot.cells) slot.cells = []; slot.cells.push(''); });
  s.days = days + 1;
  // 更新结营里程碑
  var lastMS = s.milestones[s.milestones.length-1];
  if (lastMS && lastMS.name === '结营日') lastMS.date = offsetDate(s.startDate, days);
  renderWizardStep(2);
}

function removeSchedDay() {
  var s = _campDraft.step2;
  if (!s.schedule || !s.schedule.length) return;
  var days = (s.schedule[0].cells||[]).length;
  if (days <= 1) { showToast('至少保留1天', 'warn'); return; }
  s.schedule.forEach(function(slot) { if (slot.cells) slot.cells.pop(); });
  s.days = days - 1;
  var lastMS = s.milestones[s.milestones.length-1];
  if (lastMS && lastMS.name === '结营日') lastMS.date = offsetDate(s.startDate, days - 2);
  renderWizardStep(2);
}

function copyPrevDaySched() {
  var sch = _campDraft.step2.schedule;
  if (!sch || !sch.length) return;
  var days = (sch[0].cells || []).length;
  if (days < 2) { showToast('至少需要2天', 'warn'); return; }
  var copied = 0;
  sch.forEach(function(slot) {
    if (!slot.cells) slot.cells = [];
    if (slot.cells[days-2] && !slot.cells[days-1]) { slot.cells[days-1] = slot.cells[days-2]; copied++; }
  });
  showToast('已复制 ' + copied + ' 个时段', 'ok');
  renderWizardStep(2);
}

function addSchedSlot() {
  var sch = _campDraft.step2.schedule;
  if (!sch || !sch.length) return;
  var days = (sch[0].cells || []).length;
  var name = prompt('新时段名称（例：🎵 音乐时间）：', '');
  if (!name) return;
  var time = prompt('时间段（例：20:00-21:00）：', '');
  sch.push({ section: name, time: time || '—', cells: new Array(days).fill('') });
  renderWizardStep(2);
}
function removeSchedSlot() {
  var sch = _campDraft.step2.schedule;
  if (!sch || sch.length <= 3) { showToast('至少保留3个时段', 'warn'); return; }
  sch.pop();
  renderWizardStep(2);
}

// ── 日程模板存取 ──
function keysSchedTemplates() {
  try { return Object.keys(JSON.parse(localStorage.getItem(SCHED_TPL_KEY) || '{}')); } catch(e) { return []; }
}

function loadSchedTemplateData(name) {
  try { var all = JSON.parse(localStorage.getItem(SCHED_TPL_KEY) || '{}'); return all[name] || null; } catch(e) { return null; }
}

function loadSchedTemplate(name) {
  if (!name) return;
  var data = loadSchedTemplateData(name);
  if (!data) { showToast('模板不存在', 'warn'); return; }
  if (_campDraft.step2.schedule && _campDraft.step2.schedule.length) {
    if (!confirm('加载模板将覆盖当前日程，确定？')) return;
  }
  _campDraft.step2.schedule = data.slots.map(function(s){ return { section:s.section, time:s.time, cells:(s.cells||[]).slice() }; });
  _campDraft.step2.startDate = data.startDate || _campDraft.step2.startDate;
  _campDraft.step2.days = data.days || _campDraft.step2.days;
  showToast('已加载模板：'+name, 'ok');
  renderWizardStep(2);
}

function saveSchedTemplate() {
  var s = _campDraft.step2;
  if (!s.schedule || !s.schedule.length) { showToast('请先生成日历', 'warn'); return; }
  var name = prompt('模板名称（例：标准15天共创营日程）：');
  if (!name) return;
  try {
    var all = JSON.parse(localStorage.getItem(SCHED_TPL_KEY) || '{}');
    all[name] = { slots: s.schedule.map(function(sl){ return { section:sl.section, time:sl.time, cells:(sl.cells||[]).slice() }; }), startDate: s.startDate, days: s.days };
    localStorage.setItem(SCHED_TPL_KEY, JSON.stringify(all));
    showToast('模板「'+name+'」已保存', 'ok');
    renderWizardStep(2);
  } catch(e) { showToast('保存失败：存储空间不足', 'error'); }
}

function offsetDate(dateStr, days) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function renderMilestones(s) {
  if (!s.milestones || !s.milestones.length) return '';
  var h = '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px;margin-top:8px"><div style="font-weight:700;font-size:.7rem;margin-bottom:8px">📍 里程碑节点 <button class="wiz-chip" onclick="addMilestone()" style="font-size:.55rem;margin-left:8px">+</button></div>';
  s.milestones.forEach(function(m, i) {
    var lockedAttr = m.locked ? ' disabled' : '';
    var lockIcon = m.locked ? ' 🔒' : '';
    h += '<div style="display:flex;gap:6px;align-items:center;padding:4px 0;font-size:.65rem;border-bottom:1px dotted #f0f0f0">'+
      '<input value="'+esc(m.name)+'" onchange="_campDraft.step2.milestones['+i+'].name=this.value" style="flex:1;border:1px solid #d0d9ce;border-radius:4px;padding:4px;font-size:.65rem;font-family:inherit;min-width:60px"'+lockedAttr+'>'+
      '<input type="date" value="'+m.date+'" onchange="_campDraft.step2.milestones['+i+'].date=this.value" style="width:110px;border:1px solid #d0d9ce;border-radius:4px;padding:4px;font-size:.62rem"'+lockedAttr+'>'+
      '<span style="font-size:.58rem;color:#aaa;white-space:nowrap">'+m.rule+lockIcon+'</span>'+
      (m.locked ? '' : '<span style="color:#b84c38;cursor:pointer;font-size:.8rem" onclick="removeMilestone('+i+')">✕</span>')+
    '</div>';
  });
  h += '</div>';
  return h;
}

function addMilestone() {
  var name = prompt('里程碑名称：'); if (!name) return;
  var date = prompt('日期（YYYY-MM-DD）：', _campDraft.step2.startDate || '');
  _campDraft.step2.milestones.push({ name: name, date: date || '', rule: '自定义', locked: false });
  renderWizardStep(2);
}
function removeMilestone(i) {
  _campDraft.step2.milestones.splice(i, 1);
  renderWizardStep(2);
}

// ═══ 预设里程碑（移植桌面端 17 个） ═══
var PRESET_MILESTONES = [
  { name:'立项日',          offset:'D-60',   rule:'开营-60天' },
  { name:'资助申请截止',    offset:'D-45',   rule:'开营-45天' },
  { name:'第一次筹备会',    offset:'D-30',   rule:'开营-30天' },
  { name:'第二次筹备会',    offset:'D-20',   rule:'开营-20天' },
  { name:'宣传启动',        offset:'D-14',   rule:'开营-14天' },
  { name:'面试周开始',      offset:'D-10',   rule:'开营-10天' },
  { name:'录取通知',        offset:'D-7',    rule:'开营-7天' },
  { name:'物资采购截止',    offset:'D-3',    rule:'开营-3天' },
  { name:'场地布置',        offset:'D-1',    rule:'开营-1天' },
  { name:'开营日',          offset:'D0',     rule:'⏵ 营队开启' },
  { name:'中期评审',        offset:'MID',    rule:'营期½节点' },
  { name:'作品展览',        offset:'MID+2',  rule:'营期½+2天' },
  { name:'结营日',          offset:'END',    rule:'⏸ 营队收官' },
  { name:'财务结算',        offset:'END+3',  rule:'结营+3天' },
  { name:'资料归档',        offset:'END+7',  rule:'结营+7天' },
  { name:'复盘会',          offset:'END+14', rule:'结营+14天' },
  { name:'成果发布',        offset:'END+30', rule:'结营+30天' }
];

function resolveMilestoneOffset(offset, startDate, days) {
  var endDate = offsetDate(startDate, days - 1);
  var midDate = offsetDate(startDate, Math.floor(days / 2));
  var num = parseInt(offset.replace(/[^0-9-]/g, '')) || 0;
  if (offset.indexOf('END') === 0) { return offsetDate(endDate, num); }
  if (offset.indexOf('MID') === 0) { return offsetDate(midDate, num); }
  return offsetDate(startDate, num); // D-N or D0 or D+N
}

// ═══ 第③步 — 财务参数 ═══
function renderStep3(el) {
  var s = _campDraft.step3;
  var days = _campDraft.step2.days || 1;
  var adventurers = s.adventurers;
  var builders = s.builders;
  var totalPeople = adventurers + builders;
  var extraIncomeTotal = (s.extraIncome||[]).reduce(function(sum,item){ return sum+(item.amount||0); },0);
  var extraExpenseTotal = (s.extraExpense||[]).reduce(function(sum,item){ return sum+(item.amount||0); },0);
  var incomeRmb = adventurers * s.earlyBirdPrice * (s.earlyBirdPct/100) + adventurers * s.fullPrice * ((100-s.earlyBirdPct)/100) + extraIncomeTotal;
  var expenseRmb = s.lodgingRmb * totalPeople * days + s.mealRmb * totalPeople * days + extraExpenseTotal;
  var expenseNT = s.lodgingNT * totalPeople * days + s.mealNT * totalPeople * days;
  var balanceRmb = incomeRmb - expenseRmb;
  el.innerHTML = '<div style="padding:14px">'+
    '<div style="margin-bottom:16px"><div style="font-weight:700;font-size:.75rem;color:#3d6b52;margin-bottom:8px">📥 收入参数</div>'+
    '<div style="display:flex;gap:8px;margin-bottom:8px"><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">冒险者人数</label><input id="cwAdventurers" class="login-input" type="number" value="'+adventurers+'" min="0" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">共建者人数</label><input id="cwBuilders" class="login-input" type="number" value="'+builders+'" min="1" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:8px"><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">早鸟价 ¥</label><input id="cwEarlyBird" class="login-input" type="number" value="'+s.earlyBirdPrice+'" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">早鸟比例 %</label><input id="cwEarlyBirdPct" class="login-input" type="number" value="'+s.earlyBirdPct+'" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">原价 ¥</label><input id="cwFullPrice" class="login-input" type="number" value="'+s.fullPrice+'" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div></div>'+
    '<button class="wiz-chip" onclick="addBudgetItemMobile(\'income\')" style="margin-top:4px">+ 添加收入项</button>'+
    '<div style="font-size:.65rem;color:#5a6e5c">' + (s.extraIncome||[]).map(function(item,i){ return '<div style="display:flex;justify-content:space-between;padding:2px 0">'+esc(item.name)+' ¥'+item.amount+'<span style="color:#b84c38;cursor:pointer" onclick="event.stopPropagation();removeBudgetItemMobile(\'income\','+i+')">✕</span></div>'; }).join('') + '</div>'+
    '<div style="font-size:.72rem;color:var(--green-primary);font-weight:600">收入合计：RMB ¥' + incomeRmb.toLocaleString() + '</div></div>'+
    '<div style="margin-bottom:16px"><div style="font-weight:700;font-size:.75rem;color:#8a6a30;margin-bottom:8px">📤 支出参数（单价 × '+days+'天 × '+totalPeople+'人）</div>'+
    '<div style="display:flex;gap:8px;margin-bottom:8px"><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">🏠住宿 ¥/人/天</label><input id="cwLodgingRmb" class="login-input" type="number" value="'+s.lodgingRmb+'" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">🏠住宿 NT/人/天</label><input id="cwLodgingNT" class="login-input" type="number" value="'+s.lodgingNT+'" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:8px"><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">🍚吃饭 ¥/人/天</label><input id="cwMealRmb" class="login-input" type="number" value="'+s.mealRmb+'" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div><div style="flex:1"><label style="font-size:.6rem;color:#5a6e5c">🍚吃饭 NT/人/天</label><input id="cwMealNT" class="login-input" type="number" value="'+s.mealNT+'" style="margin:2px 0;background:#fff;font-size:.78rem;padding:8px"></div></div>'+
    '<button class="wiz-chip" onclick="addBudgetItemMobile(\'expense\')" style="margin-top:4px">+ 添加支出项</button>'+
    '<div style="font-size:.65rem;color:#5a6e5c">' + (s.extraExpense||[]).map(function(item,i){ return '<div style="display:flex;justify-content:space-between;padding:2px 0">'+esc(item.name)+' ¥'+item.amount+'<span style="color:#b84c38;cursor:pointer" onclick="event.stopPropagation();removeBudgetItemMobile(\'expense\','+i+')">✕</span></div>'; }).join('') + '</div>'+
    '<div style="font-size:.72rem;color:#8a6a30;font-weight:600">支出合计：RMB ¥' + expenseRmb.toLocaleString() + ' ｜ NT ' + expenseNT.toLocaleString() + '</div></div>'+
    (function(){
      var healthPct = incomeRmb > 0 ? balanceRmb / incomeRmb : (balanceRmb > 0 ? 1 : -1);
      var healthBg = healthPct > 0.2 ? '#e8f0e4' : healthPct >= 0 ? '#fef8e8' : '#fde8e8';
      var healthIcon = healthPct > 0.2 ? '🟢 健康' : healthPct >= 0 ? '🟡 偏紧' : '🔴 亏损';
      var healthColor = healthPct > 0.2 ? '#3d6b52' : healthPct >= 0 ? '#8a6a30' : '#b84c38';
      var healthTip = healthPct > 0.2 ? '盈余充裕，可从容调配' : healthPct >= 0 ? '预算偏紧，关注支出节奏' : '收入不足以覆盖支出，需调整';
      return '<div style="background:'+healthBg+';border-radius:10px;padding:12px;text-align:center">'+
        '<div style="font-weight:700;font-size:.78rem;color:'+healthColor+'">📊 '+healthIcon+'</div>'+
        '<div style="font-size:.72rem;margin-top:4px">RMB ¥' + balanceRmb.toLocaleString() + (balanceRmb>=0?' 盈余':' 亏损') + ' ｜ NT -' + expenseNT.toLocaleString() + '</div>'+
        '<div style="font-size:.58rem;color:#8a8a8a;margin-top:2px">' + healthTip + ' · 盈余率 ' + (healthPct*100).toFixed(0) + '%</div></div>';
    })()+
  '</div>';
}

// ═══ 第④步 — 任务参数（升级版：模板 + 分类筛选） ═══
// 来自电脑端创世终端 PRESET_TEMPLATES（精简版）
var CAMP_TASK_PRESETS = [
  { name:'流程手册·完整任务包', desc:'50+条标准任务，覆盖统筹/宣传/生活/财务/课程/结项', tasks:[
    { name:'第一次筹备会——确定营期目标与分工', category:'统筹', nt:5 },{ name:'第二次筹备会——细化流程与时间线', category:'统筹', nt:5 },{ name:'第三次筹备会——确认预算与资助申请', category:'统筹', nt:5 },{ name:'项目提案与基金申请', category:'统筹', nt:5 },{ name:'设计冒险者合约模板', category:'统筹', nt:3 },{ name:'制定游戏规则与NT核算细则', category:'统筹', nt:5 },{ name:'确定里程碑节点与验收标准', category:'统筹', nt:3 },{ name:'分工认领——各板块负责人确认', category:'统筹', nt:3 },{ name:'召开动员会——全员对齐目标与流程', category:'统筹', nt:3 },{ name:'与合作社商讨场地餐费合作', category:'统筹', nt:3 },
    { name:'发布招生公告与推文', category:'宣传', nt:3 },{ name:'制作招生海报与宣传素材', category:'宣传', nt:3 },{ name:'小红书推流量', category:'宣传', nt:3 },{ name:'组织线上宣讲/答疑会', category:'宣传', nt:3 },{ name:'面试组织——制定标准+通知+面试+公示', category:'宣传', nt:5 },{ name:'准备开营仪式流程与物料', category:'宣传', nt:3 },{ name:'拍摄营期照片与视频素材+影像归档', category:'宣传', nt:3 },{ name:'图文报道（3次）+ 冒险者投稿收集', category:'宣传', nt:3 },{ name:'营后回顾推文/视频', category:'宣传', nt:3 },
    { name:'场地布置与设备调试', category:'生活', nt:5 },{ name:'物资清点与补充采购', category:'生活', nt:3 },{ name:'住宿安排——确认房源+分配房间', category:'生活', nt:3 },{ name:'就餐安排——确定菜单+采购食材+安排帮厨', category:'生活', nt:3 },{ name:'伴手礼采购', category:'生活', nt:2 },{ name:'安全检查——排查隐患+购买保险+急救包', category:'生活', nt:3 },{ name:'入住接待——迎接签到+发放物资', category:'生活', nt:3 },{ name:'接风宴——采购食材+布置+组织用餐', category:'生活', nt:2 },{ name:'结营聚餐——采购食材+组织活动', category:'生活', nt:2 },
    { name:'编制营期预算表（RMB + NT）', category:'财务', nt:5 },{ name:'撰写资助申请书', category:'财务', nt:5 },{ name:'收取学费与购买保险', category:'财务', nt:3 },{ name:'财务结算——RMB支出汇总与报销', category:'财务', nt:5 },{ name:'结算财务表——整理票据+编制报表', category:'财务', nt:5 },{ name:'工资条制作与发放', category:'财务', nt:3 },{ name:'合作社水电费+场地费结算+备用金管理', category:'财务', nt:3 },
    { name:'国画教学（5节）——示范技法+学员练习+点评', category:'课程', nt:5 },{ name:'绘画指导（5节）——巡视进度+一对一指导', category:'课程', nt:5 },{ name:'写生指导（2节）——选地点+讲解观察+作品点评', category:'课程', nt:3 },{ name:'作品评审（2次）——收集+评审会+汇总结果', category:'课程', nt:3 },{ name:'作品装裱（2节）——指导装裱技法+检查质量', category:'课程', nt:3 },
    { name:'结营仪式策划与组织', category:'结项', nt:5 },{ name:'作品展览布置与撤展', category:'结项', nt:5 },{ name:'结营报告撰写——汇总数据+总结经验', category:'结项', nt:5 },{ name:'收集参与者反馈与建议', category:'结项', nt:3 },{ name:'编制下一期改进清单', category:'结项', nt:3 },{ name:'归档所有文档与影像资料', category:'结项', nt:3 }
  ]},
  { name:'轻量营·最小任务集', desc:'15条核心任务，适合短营期', tasks:[
    { name:'筹备会——确定目标与分工', category:'统筹', nt:5 },{ name:'制定预算表', category:'财务', nt:5 },{ name:'发布招生公告', category:'宣传', nt:3 },{ name:'场地布置与设备调试', category:'生活', nt:5 },{ name:'住宿安排', category:'生活', nt:3 },{ name:'就餐安排', category:'生活', nt:3 },{ name:'安全检查+购买保险', category:'生活', nt:3 },{ name:'入住接待', category:'生活', nt:3 },{ name:'开营仪式', category:'宣传', nt:3 },{ name:'教学课程（3节）', category:'课程', nt:5 },{ name:'写生指导', category:'课程', nt:3 },{ name:'作品评审+装裱', category:'课程', nt:3 },{ name:'结营聚餐', category:'生活', nt:2 },{ name:'作品展览布置', category:'结项', nt:5 },{ name:'结营报告+归档', category:'结项', nt:5 }
  ]},{ name:'课程密集型营', desc:'课程/教学任务为主，适合工笔画/艺术营', tasks:[
    { name:'课程大纲编制', category:'课程', nt:5 },{ name:'教学示范录制', category:'课程', nt:3 },{ name:'学员进度跟踪表', category:'课程', nt:3 },{ name:'每日技法讲解（5节）', category:'课程', nt:5 },{ name:'一对一辅导安排', category:'课程', nt:5 },{ name:'作品中期评审', category:'课程', nt:3 },{ name:'终期展览策划', category:'课程', nt:5 },{ name:'学员作品集编制', category:'课程', nt:3 },
    { name:'场地布置+画材采购', category:'生活', nt:5 },{ name:'住宿+就餐安排', category:'生活', nt:3 },{ name:'开营/结营仪式', category:'宣传', nt:3 },{ name:'招生推文+海报', category:'宣传', nt:3 },{ name:'预算编制+财务结算', category:'财务', nt:5 }
  ]},{ name:'生活体验型营', desc:'以在地生活/社区体验为主', tasks:[
    { name:'社区导览路线规划', category:'生活', nt:3 },{ name:'在地食材采购+菜单设计', category:'生活', nt:5 },{ name:'农耕体验日组织', category:'生活', nt:5 },{ name:'手作工作坊（3场）', category:'课程', nt:5 },{ name:'社区家宴策划', category:'生活', nt:5 },{ name:'星空夜谈会组织', category:'生活', nt:3 },{ name:'在地故事采集+影像记录', category:'宣传', nt:3 },{ name:'结营分享会', category:'结项', nt:3 },
    { name:'住宿协调+房间分配', category:'生活', nt:3 },{ name:'安全巡检+急救包', category:'生活', nt:3 },{ name:'招生宣传', category:'宣传', nt:3 },{ name:'预算+结算', category:'财务', nt:5 }
  ]},{ name:'轻量启动包', desc:'最少任务启动营队，6项核心', tasks:[
    { name:'筹备会——确定目标与分工', category:'统筹', nt:5 },{ name:'场地+住宿+就餐安排', category:'生活', nt:5 },{ name:'招生公告+面试', category:'宣传', nt:5 },{ name:'预算+财务结算', category:'财务', nt:5 },{ name:'开营+结营仪式', category:'结项', nt:5 },{ name:'课程教学（3节）', category:'课程', nt:5 }
  ]}
];
var _taskEditIdx = -1;
function openTaskEditSheet(idx) {
  _taskEditIdx = idx;
  document.getElementById('taskEditSheetTitle').textContent = idx >= 0 ? '编辑任务' : '添加任务';
  if (idx >= 0) {
    var t = _campDraft.step4.tasks[idx];
    document.getElementById('taskEditName').value = t.name;
    document.getElementById('taskEditCat').value = t.category;
    document.getElementById('taskEditNT').value = t.nt;
    document.getElementById('taskEditType').value = t.type || '支线S';
  } else {
    document.getElementById('taskEditName').value = '';
    document.getElementById('taskEditCat').value = '生活';
    document.getElementById('taskEditType').value = '支线S';
    document.getElementById('taskEditNT').value = '5';
  }
  document.getElementById('taskEditSheet').style.display = 'flex';
  setTimeout(function(){ document.getElementById('taskEditName').focus(); }, 100);
}
function closeTaskEditSheet() { document.getElementById('taskEditSheet').style.display = 'none'; _taskEditIdx = -1; }
function saveTaskEdit() {
  var name = document.getElementById('taskEditName').value.trim();
  if (!name) { showToast('请输入任务名称', 'warn'); return; }
  var cat = document.getElementById('taskEditCat').value;
  var nt = parseInt(document.getElementById('taskEditNT').value) || 5;
  var type = document.getElementById('taskEditType').value;
  if (_taskEditIdx >= 0) {
    var t = _campDraft.step4.tasks[_taskEditIdx]; t.name = name; t.category = cat; t.nt = nt; t.type = type;
  } else {
    _campDraft.step4.tasks.push({ name:name, category:cat, nt:nt, type:type, status:'todo' });
  }
  closeTaskEditSheet();
  renderWizardStep(4);
}
var _taskCatFilter = '';

function renderStep4(el) {
  var tasks = _campDraft.step4.tasks;
  var cats = {}; tasks.forEach(function(t){ cats[t.category] = (cats[t.category]||0) + 1; });
  var filtered = _taskCatFilter ? tasks.filter(function(t){ return t.category === _taskCatFilter; }) : tasks;
  var h = '<div style="padding:14px">'+
    '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">'+
    '<button class="wiz-chip active" onclick="openTaskEditSheet(-1)">+ 添加</button>'+
    '<button class="wiz-chip" onclick="importTaskTemplate()">📥 模板导入</button>'+
    '<button class="wiz-chip" onclick="loadTaskTemplate()">📂 加载模板</button>'+
    '<button class="wiz-chip" onclick="saveTaskTemplate()">💾 存模板</button>'+
    '</div>';
  // 类别筛选
  if (Object.keys(cats).length > 1) {
    h += '<div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;font-size:.62rem">'+
      '<span class="wiz-chip'+(!_taskCatFilter?' active':'')+'" onclick="_taskCatFilter=\'\';renderWizardStep(4)" style="font-size:.6rem">全部('+tasks.length+')</span>';
    Object.keys(cats).forEach(function(c){
      h += '<span class="wiz-chip'+(_taskCatFilter===c?' active':'')+'" onclick="_taskCatFilter=\''+c+'\';renderWizardStep(4)" style="font-size:.6rem">'+c+'('+cats[c]+')</span>';
    });
    h += '</div>';
  }
  if (!filtered.length) {
    h += '<div style="text-align:center;padding:30px;color:#8a8a8a;font-size:.72rem">' + (_taskCatFilter ? '该类别无任务' : '暂无任务，点击上方按钮添加或从模板导入') + '</div>';
  } else {
    h += '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;overflow:hidden">';
    filtered.forEach(function(t) {
      var origIdx = tasks.indexOf(t);
      var typeColors = { '主线M':'#b84c38', '支线S':'#c8892e', '共创C':'#3d6b52', '隐藏H':'#7b4ca8', '身份I':'#4a7db8', '彩蛋E':'#c8a82e' };
      var catColors = { '统筹':'#5d8c52','宣传':'#4a7db8','生活':'#c8892e','财务':'#c8a82e','课程':'#7b4ca8','结项':'#b84c38' };
      h += '<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:.7rem;cursor:pointer" onclick="openTaskEditSheet('+origIdx+')">'+
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">'+esc(t.name)+'</span>'+
        '<span style="background:'+(typeColors[t.type]||'#ddd')+';color:#fff;padding:2px 8px;border-radius:10px;font-size:.58rem;margin:0 4px;white-space:nowrap">'+(t.type||'支线S')+'</span>'+
        '<span style="background:'+(catColors[t.category]||'#ddd')+';color:#fff;padding:2px 8px;border-radius:10px;font-size:.58rem;margin:0 4px;white-space:nowrap">'+t.category+'</span>'+
        '<span style="font-weight:700;color:var(--green-primary);margin:0 4px;white-space:nowrap">'+t.nt+'pt</span>'+
        '<span style="background:'+(t.status==='todo'?'#5d8c52':t.status==='maybe'?'#c8892e':'#b84c38')+';color:#fff;padding:2px 6px;border-radius:10px;font-size:.55rem;cursor:pointer;white-space:nowrap;margin:0 4px" onclick="event.stopPropagation();toggleTaskStatus('+origIdx+')">'+(t.status==='todo'?'要做':t.status==='maybe'?'备选':'不做')+'</span>'+
        '<span style="color:#b84c38;cursor:pointer;padding:4px;font-size:.8rem" onclick="event.stopPropagation();removeCampTask('+origIdx+')">✕</span>'+
      '</div>';
    });
    h += '</div>';
    h += '<div style="font-size:.62rem;color:#5a6e5c;margin-top:6px">共 ' + tasks.length + ' 项 · 合计 <b>' + tasks.reduce(function(s,t){return s+t.nt;},0) + 'pt</b></div>';
  }
  h += '<div style="background:#fafaf8;border:1px solid #e8ede6;border-radius:10px;padding:10px;margin-top:10px;font-size:.6rem;color:#8a8a8a;line-height:1.6">'+
    '<b>6 类营队任务：</b> 统筹 宣传 生活 财务 课程 结项<br>⚠️ 营队任务 ≠ 个人委托（村口任务大厅发布的是个人委托）</div>';
  el.innerHTML = h;
}

function importTaskTemplate() {
  var names = CAMP_TASK_PRESETS.map(function(p){ return p.name+' ('+p.tasks.length+'项)'; });
  var choice = prompt('选择任务模板：\n1. '+names.join('\n2. ')+'\n\n输入序号（1-'+CAMP_TASK_PRESETS.length+'）：','1');
  var idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= CAMP_TASK_PRESETS.length) return;
  var preset = CAMP_TASK_PRESETS[idx];
  if (_campDraft.step4.tasks.length && !confirm('导入将追加到现有任务列表，确定？')) return;
  preset.tasks.forEach(function(pt) {
    if (!_campDraft.step4.tasks.some(function(t){ return t.name === pt.name; })) {
      _campDraft.step4.tasks.push({ name:pt.name, category:pt.category, nt:pt.nt, type:'支线S', status:'todo' });
    }
  });
  showToast('已导入「'+preset.name+'」', 'ok');
  renderWizardStep(4);
}

function saveTaskTemplate() {
  if (!_campDraft.step4.tasks.length) { showToast('当前无任务可保存', 'warn'); return; }
  var name = prompt('模板名称：');
  if (!name) return;
  try {
    var all = JSON.parse(localStorage.getItem('nantang_task_templates') || '{}');
    all[name] = _campDraft.step4.tasks.map(function(t){ return { name:t.name, category:t.category, nt:t.nt, type:t.type }; });
    localStorage.setItem('nantang_task_templates', JSON.stringify(all));
    showToast('任务模板「'+name+'」已保存', 'ok');
  } catch(e) { showToast('保存失败', 'error'); }
}

function loadTaskTemplate() {
  try {
    var all = JSON.parse(localStorage.getItem('nantang_task_templates') || '{}');
    var names = Object.keys(all);
    if (!names.length) { showToast('没有已保存的模板', 'warn'); return; }
    var choice = prompt('选择加载的模板：\n'+names.map(function(n,i){ return (i+1)+'. '+n+' ('+all[n].length+'项)'; }).join('\n'));
    var idx = parseInt(choice) - 1; if (isNaN(idx) || idx < 0 || idx >= names.length) return;
    var tasks = all[names[idx]];
    if (_campDraft.step4.tasks.length && !confirm('加载将替换当前任务列表，确定？')) return;
    _campDraft.step4.tasks = tasks.map(function(t){ return { name:t.name, category:t.category, nt:t.nt, type:t.type||'支线S', status:'todo' }; });
    showToast('已加载：'+names[idx], 'ok'); renderWizardStep(4);
  } catch(e) { showToast('加载失败', 'error'); }
}

function addCampTask() { openTaskEditSheet(-1); }
function editCampTask(i) { openTaskEditSheet(i); }

function removeCampTask(i) {
  _campDraft.step4.tasks.splice(i, 1);
  renderWizardStep(4);
}

function toggleTaskStatus(i) {
  var t = _campDraft.step4.tasks[i]; if (!t) return;
  t.status = t.status === 'todo' ? 'maybe' : t.status === 'maybe' ? 'skip' : 'todo';
  renderWizardStep(4);
}

function addBudgetItemMobile(type) {
  var name = prompt('项目名称（例：资助金 / 画材采购）：'); if (!name) return;
  var amount = parseInt(prompt('金额（¥）：','0')) || 0;
  var key = type === 'income' ? 'extraIncome' : 'extraExpense';
  _campDraft.step3[key] = _campDraft.step3[key] || [];
  _campDraft.step3[key].push({ name: name, amount: amount });
  renderWizardStep(3);
}
function removeBudgetItemMobile(type, i) {
  var key = type === 'income' ? 'extraIncome' : 'extraExpense';
  (_campDraft.step3[key] || []).splice(i, 1);
  renderWizardStep(3);
}

function initDefaultBudgetItems() {
  return {
    extraIncome: [
      { name:'基金资助', amount:3000 },{ name:'社区募捐', amount:1500 },{ name:'企业赞助', amount:2000 },{ name:'材料费收入', amount:500 }
    ],
    extraExpense: [
      { name:'场地租金', amount:2000 },{ name:'画材采购', amount:800 },{ name:'装裱材料', amount:600 },{ name:'全员保险', amount:300 },
      { name:'交通补贴', amount:500 },{ name:'宣传物料', amount:400 },{ name:'伴手礼', amount:600 },{ name:'展览布置', amount:1000 },
      { name:'娱乐活动', amount:500 },{ name:'应急备用金', amount:800 },{ name:'水电杂费', amount:300 },{ name:'讲师酬劳', amount:2000 },
      { name:'摄影记录', amount:400 },{ name:'结营聚餐', amount:1000 }
    ]
  };
}

// ═══ 第⑤步 — 人员选择 ═══
function renderStep5(el) {
  var builders = _campDraft.step5.builders;
  var tasks = _campDraft.step4.tasks;
  var assignedCount = builders.reduce(function(sum, b) { return sum + b.taskNames.length; }, 0);
  var h = '<div style="padding:14px">'+
    '<div style="text-align:center;margin-bottom:16px"><div style="font-size:.65rem;color:#5a6e5c;margin-bottom:8px">共建人</div><div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap">';
  for (var i = 0; i < Math.max(builders.length + 1, 3); i++) {
    if (i < builders.length) {
      var b = builders[i];
      h += '<div style="text-align:center;cursor:pointer" onclick="selectBuilder('+i+')"><div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#e8f0e4,#dce8d8);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 4px">👤</div><div style="font-size:.68rem;font-weight:600">'+b.name+'</div><div style="font-size:.58rem;color:#5a6e5c">'+b.taskNames.length+'项·'+b.totalNT+'NT</div></div>';
    } else if (i === builders.length) {
      h += '<div style="text-align:center;cursor:pointer" onclick="addNewBuilder()"><div style="width:56px;height:56px;border-radius:50%;border:2px dashed #d0d9ce;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 4px;color:#d0d9ce">+</div><div style="font-size:.62rem;color:#aaa">虚位以待</div></div>';
    }
  }
  h += '</div></div>';
  h += '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px">'+
    '<div style="font-weight:700;font-size:.7rem;margin-bottom:8px">选择成员并分配任务</div>'+
    '<div style="margin-bottom:8px"><button class="wiz-chip" onclick="addNewBuilder()" style="width:100%;text-align:left">👤 点击选择共建人…</button></div>';
  tasks.forEach(function(t) {
    var assigned = builders.some(function(b) { return b.taskNames.indexOf(t.name) !== -1; });
    h += '<div style="display:flex;align-items:center;padding:6px 0;font-size:.68rem;border-bottom:1px dotted #f0f0f0">'+
      '<span style="flex:1">'+t.name+' · '+t.nt+'NT · '+t.category+'</span>'+
      '<span style="color:'+(assigned?'var(--green-primary)':'#8a8a8a')+';font-size:.6rem">'+(assigned?'已分配':'未分配')+'</span>'+
    '</div>';
  });
  h += '</div>';
  if (tasks.length && assignedCount === tasks.length) {
    h += '<div style="background:#e8f0e4;border-radius:10px;padding:10px;margin-top:10px;text-align:center;font-size:.7rem;color:var(--green-primary);font-weight:600">✅ 全部 '+tasks.length+' 个任务已分配完毕</div>';
  }
  if (tasks.length && assignedCount < tasks.length) {
    h += '<div style="background:#fef8e8;border-radius:10px;padding:10px;margin-top:10px;text-align:center;font-size:.65rem;color:#c8892e">⚠️ 还有 '+(tasks.length-assignedCount)+' 个任务未分配</div>';
  }
  el.innerHTML = h;
}

var _builderPendingTasks = [];
function addNewBuilder() {
  var users = typeof getUsers === 'function' ? getUsers() : {};
  var names = Object.keys(users).filter(function(n) {
    if (n === CURRENT_USER) return false;
    return !_campDraft.step5.builders.some(function(b) { return b.name === n; });
  });
  if (!names.length) { showToast('没有可选的成员', 'warn'); return; }
  _builderPendingTasks = _campDraft.step4.tasks.filter(function(t) {
    return !_campDraft.step5.builders.some(function(b) { return b.taskNames.indexOf(t.name) !== -1; });
  });
  showMemberPicker('_builderPick');
}
function selectBuilder(i) {
  /* ponytail: 共建人详情编辑（任务重分配/移除）留给后续迭代 */
  _wipToast('共建人详情编辑');
}

// ═══ 第⑥步 — 分包确认 ═══
function renderStep6(el) {
  var builders = _campDraft.step5.builders;
  var h = '<div style="padding:14px">'+
    '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:12px;margin-bottom:12px">'+
    '<div style="font-weight:700;font-size:.7rem;margin-bottom:6px">📊 确认将以下信息发送给共建人</div>'+
    '<div style="font-size:.65rem;color:#5a6e5c;line-height:1.8">预算 RMB ¥' + calcStep3Total().expenseRmb.toLocaleString() + ' · NT ' + calcStep3Total().expenseNT.toLocaleString() + '<br>日程 ' + (_campDraft.step2.startDate||'?') + ' · ' + _campDraft.step2.days + '天<br>任务 ' + _campDraft.step4.tasks.length + '项</div></div>';
  h += '<div style="font-weight:700;font-size:.7rem;margin-bottom:8px">发送给：</div>';
  builders.forEach(function(b) {
    h += '<div style="background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">'+
      '<div style="width:32px;height:32px;border-radius:50%;background:#e8f0e4;display:flex;align-items:center;justify-content:center;font-size:.8rem">👤</div>'+
      '<div style="flex:1"><div style="font-weight:600;font-size:.72rem">'+b.name+'</div><div style="font-size:.6rem;color:#5a6e5c">'+b.taskNames.length+'项 · '+b.totalNT+'NT</div></div>'+
      '<span style="font-size:.65rem;'+(b.confirmed?'color:var(--green-primary)':'color:#8a8a8a')+'">'+(b.confirmed?'✅ 已确认':'⏳ 等待确认')+'</span></div>';
  });
  if (!_campDraft.step6.sentAt && builders.length) {
    h += '<button class="btn-pri btn-full" onclick="sendConfirmations()" style="margin-top:8px">📤 发送确认请求</button>';
  }
  var allConfirmed = builders.length > 0 && builders.every(function(b){return b.confirmed;});
  if (allConfirmed) {
    h += '<div style="background:#e8f0e4;border-radius:10px;padding:10px;margin-top:10px;text-align:center;font-size:.7rem;color:var(--green-primary);font-weight:600">✅ '+builders.length+'/'+builders.length+' 人全部确认 · 可启动启营仪式</div>';
  }
  el.innerHTML = h;
}

function calcStep3Total() {
  var s = _campDraft.step3;
  var totalPeople = (s.adventurers||0) + (s.builders||0);
  var days = _campDraft.step2.days || 1;
  var extraExpenseTotal = (s.extraExpense||[]).reduce(function(sum,item){ return sum+(item.amount||0); },0);
  var expenseRmb = s.lodgingRmb * totalPeople * days + s.mealRmb * totalPeople * days + extraExpenseTotal;
  var expenseNT = s.lodgingNT * totalPeople * days + s.mealNT * totalPeople * days;
  return { expenseRmb: expenseRmb, expenseNT: expenseNT };
}

function sendConfirmations() {
  _campDraft.step6.sentAt = new Date().toISOString();
  /* ponytail: MVP 管理员代替共建人自动确认。阶段 3 后改为共建人逐页确认——需要工作台通知链路 + 共建人确认页面 3 步 UI */
  _campDraft.step5.builders.forEach(function(b) { b.confirmed = true; });
  showToast('确认请求已发送！(MVP 模式：自动确认)', 'ok');
  if (typeof logActivity === 'function') logActivity('camp_confirm', '分包确认已发送给 ' + _campDraft.step5.builders.length + ' 位共建人');
  renderWizardStep(6);
}

// ═══ 第⑦步 — 启营仪式 + 启动 ═══
function renderStep7(el) {
  el.innerHTML = '<div style="padding:40px 14px;text-align:center">'+
    '<div style="font-size:3rem;margin-bottom:12px">🎊</div>'+
    '<div style="font-weight:700;font-size:1rem;margin-bottom:4px">启营仪式</div>'+
    '<div style="font-size:.72rem;color:#5a6e5c;margin-bottom:20px">所有共建者将进入星光汇聚仪式</div>'+
    _campDraft.step5.builders.map(function(b) {
      return '<div style="display:inline-block;text-align:center;margin:8px 12px"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#e8f0e4,#dce8d8);display:flex;align-items:center;justify-content:center;font-size:1.2rem;margin:0 auto 4px">👤</div><div style="font-size:.65rem">'+b.name+'</div><div style="font-size:.55rem;color:#5a6e5c">'+b.taskNames.length+'项·'+b.totalNT+'NT</div></div>';
    }).join('') +
    '<div style="margin-top:20px;font-size:.65rem;color:#8a8a8a">点击「🏁 正式启动」后营队将正式开启</div>'+
  '</div>';
}

function playLaunchCeremony() {
  var layer = document.getElementById('campCeremonyLayer');
  var content = document.getElementById('ceremonyContent');
  layer.style.display = 'flex';
  document.getElementById('ceremonySkip').style.display = 'block';
  var builders = _campDraft.step5.builders;
  var stars = builders.map(function(b, i) {
    return '<div id="lStar'+i+'" style="position:absolute;left:'+(20+Math.random()*60)+'%;top:'+(30+Math.random()*40)+'%;font-size:2rem;opacity:0">⭐</div>';
  }).join('');
  content.innerHTML = '<div style="font-size:3rem;opacity:0" id="launchIcon">🎊</div>'+
    '<div style="font-size:1rem;color:#fff;margin-top:20px;opacity:0" id="launchTitle">星光汇聚 · 营队启程</div>'+stars+
    '<div style="font-size:.8rem;color:rgba(255,255,255,.7);margin-top:60px;opacity:0" id="launchMembers">'+builders.length+' 位共建者就位</div>';
  if (_ceremonyTL) _ceremonyTL.kill();
  _ceremonyTL = gsap.timeline({ onComplete: function() {
    setTimeout(function() {
      document.getElementById('campCeremonyLayer').style.display = 'none';
      document.getElementById('ceremonySkip').style.display = 'none';
      launchCamp();
    }, 600);
  }});
  _ceremonyTL.to('#launchIcon', { opacity:1, scale:1.3, duration:.6 })
    .to('#launchTitle', { opacity:1, duration:.5 }, '-=.3');
  builders.forEach(function(b, i) {
    _ceremonyTL.fromTo('#lStar'+i, { opacity:0, scale:0 }, { opacity:1, scale:1, duration:.4 }, '-=.2');
  });
  _ceremonyTL.to('#launchMembers', { opacity:1, duration:.5 }, '+=.2');
}

function launchCamp() {
  var campId = 'camp_' + Date.now().toString(36);
  var s1 = _campDraft.step1;
  var s2 = _campDraft.step2;
  var s3 = _campDraft.step3;
  var s4 = _campDraft.step4;
  var s5 = _campDraft.step5;
  var newCamp = {
    id: campId, name: s1.name, season: s1.season, type: s1.type,
    theme: s1.theme, desc: s1.desc, emoji: '🏕️',
    status: 'active',
    date: (s2.startDate||'?') + ' — ' + offsetDate(s2.startDate, s2.days-1),
    people: s5.builders.length, max: (s3.adventurers||0) + (s3.builders||0),
    location: '南塘合作社大院',
    highlights: [s2.startDate+' 开营仪式', offsetDate(s2.startDate, 5)+' 作品展览', offsetDate(s2.startDate, s2.days-1)+' 结营仪式'],
    schedule: s2.schedule, milestones: s2.milestones,
    budget: s3, tasks: s4.tasks, builders: s5.builders,
    launchedAt: new Date().toISOString(), createdBy: CURRENT_USER
  };
  if (window.AppData) {
    if (!AppData._data.camps) AppData._data.camps = {};
    AppData._data.camps[campId] = newCamp;
    AppData._saveShared();
  } else {
    CAMP_MOCK.unshift(newCamp);
  }
  if (typeof logActivity === 'function') logActivity('camp_launch', CURRENT_USER + ' 启动了「' + s1.name + '」');
  // P0-1：营队启动时注资 camp_pool（幂等：已有余额则跳过）
  var campTotalNT = _calcCampTotalNT(newCamp);
  if (window.NT && campTotalNT > 0) {
    var existingPool = NT.getUser('camp_pool');
    if (!existingPool || existingPool.ntBalance === 0) {
      NT.topUp('camp_pool', campTotalNT, '营队注资: ' + newCamp.name);
    }
  }
  // P1-3：发放角色 NT + 活动 NT（幂等：检查 ledger 是否已有记录）
  var econ = window.CAMP_ECONOMY || { roleBonus:{admin:20,builder:15,adventurer:0}, activityBonus:10 };
  if (window.NT && campTotalNT > 0) {
    var builders = newCamp.builders || [];
    var extraNT = 0;
    builders.forEach(function(b) {
      var bonus = econ.roleBonus[b.role] || 0;
      var entries = NT.getLedger({userId: b.name});
      var alreadyPaid = entries.some(function(e){ return e.reason && e.reason.indexOf('角色激励') !== -1; });
      if (!alreadyPaid && bonus > 0) {
        NT.transfer('camp_pool', b.name, bonus, '角色激励: ' + b.role);
        extraNT += bonus;
      }
      var actAlreadyPaid = entries.some(function(e){ return e.reason && e.reason.indexOf('活动参与激励') !== -1; });
      if (!actAlreadyPaid && econ.activityBonus > 0) {
        NT.transfer('camp_pool', b.name, econ.activityBonus, '活动参与激励');
        extraNT += econ.activityBonus;
      }
    });
    if (extraNT > 0) {
      NT.topUp('camp_pool', extraNT, '角色/活动激励注资: ' + newCamp.name);
    }
  }
  sessionStorage.removeItem('nantang_camp_draft');
  _campDraft = null;
  document.getElementById('overlayCreateCamp').classList.remove('open');
  showToast('🔥 营队正式启动！', 'ok');
  renderCommunityHub();
}
