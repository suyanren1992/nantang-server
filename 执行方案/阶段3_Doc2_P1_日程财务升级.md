# 阶段3 · Doc 2/3：P1 日程+财务+模板升级

> 涉及文件：`nantang-mobile.html`
> 前置：Doc 1/3 已执行完毕
> 后续：Doc 3/3

**执行前自检：** 搜索以下字符串确认 Doc 1 已生效：
- `sessionStorage.getItem('nantang_camp_draft')` 应存在
- `openTaskEditSheet` 应存在
- `class="wiz-dot"` 应存在
- `campWizardGuide` 应存在

---

## 改动 1：日程「复制前一天」

### 1a — 在 `renderStep2` 按钮区加按钮

找到 `renderStep2` 函数中的按钮组（注意：在 `if (s.schedule && s.schedule.length)` 条件块内，L1747-1751）：
```javascript
  if (s.schedule && s.schedule.length) {
    h += '<button class="wiz-chip" onclick="addSchedDay()">＋天</button>'+
    '<button class="wiz-chip" onclick="removeSchedDay()">−天</button>'+
    '<button class="wiz-chip" onclick="saveSchedTemplate()">💾 存模板</button>';
  }
```

在 `'<button class="wiz-chip" onclick="saveSchedTemplate()">💾 存模板</button>';` 这行**之后**加（确保在同一个 `if` 块内）：
```javascript
    h += '<button class="wiz-chip" onclick="copyPrevDaySched()">📋 复制前一天</button>';
```

### 1b — 新增函数

在 `removeSchedDay` 函数的 `}` 之后插入：
```javascript
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
```

---

## 改动 2：补全任务模板（+3 套）

找到 `CAMP_TASK_PRESETS` 数组的 `];` 闭合（搜索 `{ name:'轻量营·最小任务集'`），将该数组的 `];` 替换为：
```javascript
,{ name:'课程密集型营', desc:'课程/教学任务为主，适合工笔画/艺术营', tasks:[
  { name:'课程大纲编制', category:'课程', nt:5 },{ name:'教学示范录制', category:'课程', nt:3 },{ name:'学员进度跟踪表', category:'课程', nt:3 },{ name:'每日技法讲解（5节）', category:'课程', nt:5 },{ name:'一对一辅导安排', category:'课程', nt:5 },{ name:'作品中期评审', category:'课程', nt:3 },{ name:'终期展览策划', category:'课程', nt:5 },{ name:'学员作品集编制', category:'课程', nt:3 },
  { name:'场地布置+画材采购', category:'生活', nt:5 },{ name:'住宿+就餐安排', category:'生活', nt:3 },{ name:'开营/结营仪式', category:'宣传', nt:3 },{ name:'招生推文+海报', category:'宣传', nt:3 },{ name:'预算编制+财务结算', category:'财务', nt:5 }
]},{ name:'生活体验型营', desc:'以在地生活/社区体验为主', tasks:[
  { name:'社区导览路线规划', category:'生活', nt:3 },{ name:'在地食材采购+菜单设计', category:'生活', nt:5 },{ name:'农耕体验日组织', category:'生活', nt:5 },{ name:'手作工作坊（3场）', category:'课程', nt:5 },{ name:'社区家宴策划', category:'生活', nt:5 },{ name:'星空夜谈会组织', category:'生活', nt:3 },{ name:'在地故事采集+影像记录', category:'宣传', nt:3 },{ name:'结营分享会', category:'结项', nt:3 },
  { name:'住宿协调+房间分配', category:'生活', nt:3 },{ name:'安全巡检+急救包', category:'生活', nt:3 },{ name:'招生宣传', category:'宣传', nt:3 },{ name:'预算+结算', category:'财务', nt:5 }
]},{ name:'轻量启动包', desc:'最少任务启动营队，6项核心', tasks:[
  { name:'筹备会——确定目标与分工', category:'统筹', nt:5 },{ name:'场地+住宿+就餐安排', category:'生活', nt:5 },{ name:'招生公告+面试', category:'宣传', nt:5 },{ name:'预算+财务结算', category:'财务', nt:5 },{ name:'开营+结营仪式', category:'结项', nt:5 },{ name:'课程教学（3节）', category:'课程', nt:5 }
]}];
```

---

## 改动 3：Quick Start 模板卡片 + 新增函数

### 3a — 在 `renderStep1` 开头插入 Quick Start 卡片

找到 `renderStep1` 函数中的这行（约 L1661）：
```javascript
  el.innerHTML = '<div style="padding:14px">'+
```

**替换整行**为：
```javascript
  var quickTpls = [
    { name:'工笔画营', theme:'以画笔绘南塘', emoji:'🎨', days:7, adv:6, bld:3, eb:499, fp:1099, season:'第四期' },
    { name:'生活体验营', theme:'在地生活七日谈', emoji:'🏕️', days:15, adv:12, bld:4, eb:399, fp:499, season:'第五期' },
    { name:'青年间隔月', theme:'28天发现另一种可能', emoji:'🌟', days:28, adv:20, bld:2, eb:199, fp:299, season:'特别期' }
  ];
  var qsHtml = '<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding:4px 0"><span style="font-size:.62rem;color:#5a6e5c;white-space:nowrap;padding:4px 4px 4px 0">🚀 快速启动：</span>';
  quickTpls.forEach(function(qt) {
    qsHtml += '<div style="flex:none;background:#fff;border:1px solid #d0d9ce;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:.62rem;text-align:center;min-width:80px" onclick="applyQuickTemplate(\''+qt.name+'\')"><div style="font-size:1.2rem">'+qt.emoji+'</div><div style="font-weight:600;margin:2px 0">'+qt.name+'</div><div style="color:#8a8a8a">'+qt.days+'天·'+qt.adv+'人</div></div>';
  });
  qsHtml += '</div>';
  el.innerHTML = qsHtml + '<div style="padding:14px">'+
```

### 3b — 在 `renderStep1` 函数之后插入 `applyQuickTemplate`

找到 `renderStep1` 函数的闭合 `}`（后面是 `// esc() fallback guard`），在 `}` 之后插入：
```javascript
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
```

---

## 改动 4：自定义收支项（完整精确版）

### 4a — 新增函数

在 `removeCampTask` 函数的 `}` 之后（`// ═══ 第⑤步` 之前）插入：
```javascript
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
```

### 4b — 修改 `renderStep3` 收入合计计算

找到 `renderStep3` 中的 `var incomeRmb =` 行（约 L1935），**替换**为：
```javascript
  var extraIncomeTotal = (s.extraIncome||[]).reduce(function(sum,item){ return sum+(item.amount||0); },0);
  var extraExpenseTotal = (s.extraExpense||[]).reduce(function(sum,item){ return sum+(item.amount||0); },0);
  var incomeRmb = adventurers * s.earlyBirdPrice * (s.earlyBirdPct/100) + adventurers * s.fullPrice * ((100-s.earlyBirdPct)/100) + extraIncomeTotal;
  var expenseRmb = s.lodgingRmb * totalPeople * days + s.mealRmb * totalPeople * days + extraExpenseTotal;
```

### 4c — 在收入合计行之后插入按钮+列表

找到 `'<div style="font-size:.72rem;color:var(--green-primary);font-weight:600">收入合计：RMB ¥' + incomeRmb.toLocaleString() + '</div></div>'`，**替换**为：
```javascript
    '<button class="wiz-chip" onclick="addBudgetItemMobile(\'income\')" style="margin-top:4px">+ 添加收入项</button>'+
    '<div style="font-size:.65rem;color:#5a6e5c">' + (s.extraIncome||[]).map(function(item,i){ return '<div style="display:flex;justify-content:space-between;padding:2px 0">'+esc(item.name)+' ¥'+item.amount+'<span style="color:#b84c38;cursor:pointer" onclick="event.stopPropagation();removeBudgetItemMobile(\'income\','+i+')">✕</span></div>'; }).join('') + '</div>'+
    '<div style="font-size:.72rem;color:var(--green-primary);font-weight:600">收入合计：RMB ¥' + incomeRmb.toLocaleString() + '</div></div>'+
```

### 4d — 在支出合计行之后插入按钮+列表

找到 `'<div style="font-size:.72rem;color:#8a6a30;font-weight:600">支出合计：RMB ¥' + expenseRmb.toLocaleString() + ' ｜ NT ' + expenseNT.toLocaleString() + '</div></div>'`，**替换**为：
```javascript
    '<button class="wiz-chip" onclick="addBudgetItemMobile(\'expense\')" style="margin-top:4px">+ 添加支出项</button>'+
    '<div style="font-size:.65rem;color:#5a6e5c">' + (s.extraExpense||[]).map(function(item,i){ return '<div style="display:flex;justify-content:space-between;padding:2px 0">'+esc(item.name)+' ¥'+item.amount+'<span style="color:#b84c38;cursor:pointer" onclick="event.stopPropagation();removeBudgetItemMobile(\'expense\','+i+')">✕</span></div>'; }).join('') + '</div>'+
    '<div style="font-size:.72rem;color:#8a6a30;font-weight:600">支出合计：RMB ¥' + expenseRmb.toLocaleString() + ' ｜ NT ' + expenseNT.toLocaleString() + '</div></div>'+
```

### 4e — 修改 `calcStep3Total`

找到 `calcStep3Total` 函数（约 L2160-2167），**替换整个函数**为：
```javascript
function calcStep3Total() {
  var s = _campDraft.step3;
  var totalPeople = (s.adventurers||0) + (s.builders||0);
  var days = _campDraft.step2.days || 1;
  var extraExpenseTotal = (s.extraExpense||[]).reduce(function(sum,item){ return sum+(item.amount||0); },0);
  var expenseRmb = s.lodgingRmb * totalPeople * days + s.mealRmb * totalPeople * days + extraExpenseTotal;
  var expenseNT = s.lodgingNT * totalPeople * days + s.mealNT * totalPeople * days;
  return { expenseRmb: expenseRmb, expenseNT: expenseNT };
}
```

---

## 改动 5：特别期选项

找到 `renderStep1` 中的期数数组 `['第一期','第二期','第三期','第四期','第五期','第六期','第七期','第八期','第九期','第十期']`，替换为：
```javascript
['第一期','第二期','第三期','第四期','第五期','第六期','第七期','第八期','第九期','第十期','特别期']
```

---

## 改动 6：日程时段增减（+行/−行）

> 本改动在 `copyPrevDaySched` 按钮（改动 1 已插入）之后追加。搜索 `copyPrevDaySched` 确认改动 1 已生效。

### 6a — 在 `renderStep2` 按钮区加按钮

搜索 `copyPrevDaySched`，找到这行：
```javascript
    h += '<button class="wiz-chip" onclick="copyPrevDaySched()">📋 复制前一天</button>';
```

在该行**之后**加：
```javascript
    h += '<button class="wiz-chip" onclick="addSchedSlot()">＋行</button>';
    h += '<button class="wiz-chip" onclick="removeSchedSlot()">−行</button>';
```

### 6b — 新增函数

在 `copyPrevDaySched` 函数的 `}` 之后插入：
```javascript
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
```

---

## 改动 7：里程碑可编辑

### 7a — 替换 `renderMilestones` 函数

找到 `function renderMilestones(s) {` 到它的闭合 `}`，**替换整个函数**为：
```javascript
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
```

### 7b — 新增辅助函数

在 `renderMilestones` 的闭合 `}` 之后插入：
```javascript
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
```

---

## 自检

| # | 检查项 |
|---|--------|
| 1 | 日程网格「📋 复制前一天」可点击，最后一天被填充 |
| 2 | 模板导入列表从 2 套变为 5 套（+课程密集/生活体验/轻量启动） |
| 3 | 第①步顶部出现 3 个 Quick Start 卡片（工笔画营/生活体验营/青年间隔月） |
| 4 | 点卡片 → 名称/主题/天数/预算自动填充 |
| 5 | 第③步「+ 添加收入项」→prompt→列表显示→合计自动增加 |
| 6 | 第③步「+ 添加支出项」→同上 |
| 7 | 第⑥步确认页面预算数字包含自定义收支 |
| 8 | 期数选择器有「特别期」选项 |
| 9 | 日程网格有「＋行」「−行」按钮，可增减时段 |
| 10 | 里程碑有 input 可编辑名称和日期，🔒锁定的不可改，自定义的可删除 |

---

*Doc 2/3 完成后方可执行 Doc 3/3。*
