# 阶段3 · Doc 1/3：P0 基础修复

> 涉及文件：`nantang-mobile.html`
> 前置：阶段 1 + 阶段 2 已执行完毕
> 后续：Doc 2/3 → Doc 3/3

**执行前自检：** 搜索以下字符串确认阶段 1+2 已生效：
- `_campDraft` 应存在（阶段2）
- `renderStep1` 到 `renderStep7` 均应存在（阶段2）
- `CAMP_MOCK` 应存在（阶段1）
- `DEFAULT_SLOTS_MOBILE` 应存在（阶段2）
- `CAMP_TASK_PRESETS` 应有 2 个条目（阶段2）
- `showMemberPicker` 应存在（阶段1）
- `campCeremonyLayer` DOM 元素应存在（阶段2）
- 文件不应包含 `sessionStorage` 或 `nantang_camp_draft`（当前状态）

---

## 改动 0：修复 campWizardNext 缺少 step 7 处理（预存 bug）

当前第⑦步的「🏁 正式启动」按钮不会触发 `launchCamp()`——`campWizardNext` 在 step 7 时走到 `goWizardStep(8)` 被拦截，无任何效果。

改前（L1708-1712）：
```javascript
function campWizardNext() {
  saveWizardStep(_campWizardStep);
  if (_campWizardStep === 1) {
    var err = validateWizardStep(1);
    if (err) { showToast(err, 'warn'); return; }
    playCreateCeremony();
    return;
  }
  var err = validateWizardStep(_campWizardStep);
  if (err) { showToast(err, 'warn'); return; }
  goWizardStep(_campWizardStep + 1);
}
```

改后：
```javascript
function campWizardNext() {
  saveWizardStep(_campWizardStep);
  if (_campWizardStep === 1) {
    var err = validateWizardStep(1);
    if (err) { showToast(err, 'warn'); return; }
    playCreateCeremony();
    return;
  }
  if (_campWizardStep === 7) {
    launchCamp();
    return;
  }
  var err = validateWizardStep(_campWizardStep);
  if (err) { showToast(err, 'warn'); return; }
  goWizardStep(_campWizardStep + 1);
}
```

---

## 改动 1：草稿暂存（sessionStorage）

**涉及函数：** `openCreateCamp` / `saveWizardStep` / `launchCamp` / `cancelCampWizard`

### 1a — 替换 `openCreateCamp`

改前（L1537-1551）：
```javascript
function openCreateCamp() {
  _campDraft = {
    step1: { name:'', season:'第四期', type:'regular', theme:'', desc:'', testMode:false },
    step2: { startDate:'', days:8, schedule:[], milestones:[] },
    step3: { adventurers:10, builders:6, earlyBirdPrice:499, earlyBirdPct:60, fullPrice:599,
             lodgingRmb:30, lodgingNT:40, mealRmb:8, mealNT:10, extraIncome:[], extraExpense:[] },
    step4: { tasks:[] },
    step5: { builders:[] },
    step6: { sentAt:null, confirmations:{} },
    step7: { launched:false }
  };
  _campWizardStep = 1;
  document.getElementById('overlayCreateCamp').classList.add('open');
  renderWizardStep(1);
}
```

改后：
```javascript
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
    step1: { name:'', season:'第四期', type:'regular', theme:'', desc:'', testMode:false },
    step2: { startDate:'', days:8, schedule:[], milestones:[] },
    step3: { adventurers:10, builders:6, earlyBirdPrice:499, earlyBirdPct:60, fullPrice:599,
             lodgingRmb:30, lodgingNT:40, mealRmb:8, mealNT:10, extraIncome:[], extraExpense:[] },
    step4: { tasks:[] },
    step5: { builders:[] },
    step6: { sentAt:null, confirmations:{} },
    step7: { launched:false }
  };
  _campWizardStep = 1;
  document.getElementById('overlayCreateCamp').classList.add('open');
  renderWizardStep(1);
}
```

### 1b — 在 `saveWizardStep` 末尾加一行

找到 saveWizardStep 函数的闭合 `}` 和下一行 `function updateWizardButtons()`（L1593-1595）：
```javascript
  }
}

function updateWizardButtons() {
```

在 `}`（L1593）**上面**插入：
```javascript
  try { _campDraft._step = _campWizardStep; sessionStorage.setItem('nantang_camp_draft', JSON.stringify(_campDraft)); } catch(e) {}
```

### 1c — 改动 `launchCamp`

找到 `launchCamp` 函数中的这行（L2207）：
```javascript
  _campDraft = null;
```

在它**上一行**加：
```javascript
  sessionStorage.removeItem('nantang_camp_draft');

### 1d — 改动 `cancelCampWizard`

改前（L1553-1559）：
```javascript
function cancelCampWizard() {
  if (_campDraft && _campDraft.step1.name) {
    if (!confirm('确定放弃创建？已填写的内容将丢失。')) return;
  }
  _campDraft = null;
  document.getElementById('overlayCreateCamp').classList.remove('open');
}
```

改后：
```javascript
function cancelCampWizard() {
  if (_campDraft && _campDraft.step1.name) {
    if (!confirm('确定放弃创建？已填写的内容将丢失。')) return;
  }
  sessionStorage.removeItem('nantang_camp_draft');
  _campDraft = null;
  document.getElementById('overlayCreateCamp').classList.remove('open');
}
```

---

## 改动 2：任务编辑底部 Sheet

### 2a — 插入 HTML

位置：`#memberPickerSheet` 的 `</div>` 之后。搜索 `<!-- 任务编辑 Sheet -->` 不存在则插入。

在 `</div>`（`#memberPickerSheet` 闭合标签）之后、下一个元素之前插入：
```html
<!-- 任务编辑 Sheet -->
<div id="taskEditSheet" class="sheet-overlay" style="display:none" onclick="if(event.target===this)closeTaskEditSheet()">
  <div class="sheet-card">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid #e8ede6">
      <span style="font-weight:700;font-size:.85rem" id="taskEditSheetTitle">添加任务</span>
      <button onclick="closeTaskEditSheet()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#8a8a8a">✕</button>
    </div>
    <div style="padding:14px">
      <div style="margin-bottom:12px"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">任务名称</label>
      <input id="taskEditName" class="login-input" placeholder="例：第一次筹备会" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div style="flex:1"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">类别</label>
        <select id="taskEditCat" class="login-input" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px">
          <option>统筹</option><option>宣传</option><option>生活</option><option>财务</option><option>课程</option><option>结项</option>
        </select></div>
        <div style="flex:1"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">激励点 (NT)</label>
        <input id="taskEditNT" class="login-input" type="number" value="5" min="1" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px"></div>
      </div>
      <button class="btn-pri btn-full" onclick="saveTaskEdit()">确认</button>
    </div>
  </div>
</div>
```

### 2b — 插入 JS 函数

找到 `var _taskCatFilter = '';`（目前约 L1969），在它**上面**插入：
```javascript
var _taskEditIdx = -1;
function openTaskEditSheet(idx) {
  _taskEditIdx = idx;
  document.getElementById('taskEditSheetTitle').textContent = idx >= 0 ? '编辑任务' : '添加任务';
  if (idx >= 0) {
    var t = _campDraft.step4.tasks[idx];
    document.getElementById('taskEditName').value = t.name;
    document.getElementById('taskEditCat').value = t.category;
    document.getElementById('taskEditNT').value = t.nt;
  } else {
    document.getElementById('taskEditName').value = '';
    document.getElementById('taskEditCat').value = '生活';
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
  if (_taskEditIdx >= 0) {
    var t = _campDraft.step4.tasks[_taskEditIdx]; t.name = name; t.category = cat; t.nt = nt;
  } else {
    _campDraft.step4.tasks.push({ name:name, category:cat, nt:nt, type:'支线S', status:'todo' });
  }
  closeTaskEditSheet();
  renderWizardStep(4);
}
```

### 2c — 替换旧的 `addCampTask` / `editCampTask`

改前（约 L2041-2058）：
```javascript
function addCampTask() {
  var name = prompt('任务名称：');
  if (!name) return;
  var category = prompt('类别（统筹/宣传/生活/财务/课程/结项）：','生活');
  var nt = parseInt(prompt('激励点（NT）：','5')) || 5;
  _campDraft.step4.tasks.push({ name:name, category:category||'生活', nt:nt, type:'支线S', status:'todo' });
  renderWizardStep(4);
}

function editCampTask(i) {
  var t = _campDraft.step4.tasks[i]; if (!t) return;
  var name = prompt('任务名称：', t.name); if (!name) return;
  t.name = name;
  var cat = prompt('类别（统筹/宣传/生活/财务/课程/结项）：', t.category);
  if (cat) t.category = cat;
  var nt = prompt('激励点（NT）：', t.nt);
  if (nt !== null) t.nt = parseInt(nt) || t.nt;
  renderWizardStep(4);
}
```

改后：
```javascript
function addCampTask() { openTaskEditSheet(-1); }
function editCampTask(i) { openTaskEditSheet(i); }
```

### 2d — 修改 `renderStep4` 中的 onclick

改前（约 L1977 和 L1998）：
```javascript
'<button class="wiz-chip active" onclick="addCampTask()">+ 添加</button>'
```
```javascript
'<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:.7rem;cursor:pointer" onclick="editCampTask('+origIdx+')">'
```

改后：
```javascript
'<button class="wiz-chip active" onclick="openTaskEditSheet(-1)">+ 添加</button>'
```
```javascript
'<div style="display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:.7rem;cursor:pointer" onclick="openTaskEditSheet('+origIdx+')">'
```

---

## 改动 3：选人复用 showMemberPicker

### 3a — 替换 `addNewBuilder`

改前（约 L2102-2126）：
```javascript
function addNewBuilder() {
  var users = typeof getUsers === 'function' ? getUsers() : {};
  var names = Object.keys(users).filter(function(n) {
    if (n === CURRENT_USER) return false;
    return !_campDraft.step5.builders.some(function(b) { return b.name === n; });
  });
  if (!names.length) { showToast('没有可选的成员', 'warn'); return; }
  var name = prompt('选择共建人：\n'+names.join(', '));
  if (!name || names.indexOf(name) === -1) return;
  ...
```

改后：
```javascript
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
```

### 3b — 在 `selectMemberPicker` 函数开头加路由

找到 `function selectMemberPicker(name) {`（目前约 L1393），在 `{` 之后第一行加：
```javascript
  if (_memberPickerTarget === '_builderPick') { closeMemberPicker(); onBuilderPicked(name); return; }
```

### 3c — 在 `selectMemberPicker` 函数之后插入 `onBuilderPicked`

在 `selectMemberPicker` 的 `}` 之后插入：
```javascript
function onBuilderPicked(name) {
  var taskChoices = _builderPendingTasks;
  var taskNames = [];
  if (taskChoices.length) {
    var list = taskChoices.map(function(t, i) { return (i+1)+'. '+t.name+' ('+t.nt+'NT)'; }).join('\n');
    var sel = prompt('分配任务（序号逗号分隔，留空=全选）：\n'+list);
    if (sel) {
      var idxs = sel.split(',').map(function(s){ return parseInt(s.trim())-1; }).filter(function(i){ return i>=0 && i<taskChoices.length; });
      taskNames = idxs.map(function(i){ return taskChoices[i].name; });
    } else { taskNames = taskChoices.map(function(t){ return t.name; }); }
  }
  var totalNT = _campDraft.step4.tasks.filter(function(t){ return taskNames.indexOf(t.name)!==-1; }).reduce(function(s,t){ return s+t.nt; },0);
  _campDraft.step5.builders.push({ name:name, taskNames:taskNames, totalNT:totalNT, confirmed:false });
  if (typeof changeUserRole === 'function') { changeUserRole(name, 'builder', { skipAdventurerCheck: true }); }
  showToast(name + ' 已添加为共建人', 'ok');
  renderWizardStep(5);
}
```

---

## 改动 4：进度指示器（7 圆点）

### 4a — CSS 新增

在 `</style>` 之前，现有 `.wiz-chip.active` CSS 之后追加：
```css
.wiz-dot{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:.58rem;font-weight:700;margin:0 2px;background:#e0e0e0;color:#8a8a8a;transition:.15s;vertical-align:middle}
.wiz-dot.active{background:var(--green-primary);color:#fff;transform:scale(1.2);box-shadow:0 2px 6px rgba(61,107,82,.3)}
.wiz-dot.done{background:#a0c8a8;color:#fff}
```

### 4b — 在 `renderWizardStep` 中插入圆点渲染

找到 `titleEl.textContent = steps[step] || '创建营队';`（目前约 L1637），**替换**为：
```javascript
  titleEl.textContent = steps[step] || '创建营队';
  var dotsHtml = '';
  for (var i = 1; i <= 7; i++) {
    dotsHtml += '<span class="wiz-dot' + (i === step ? ' active' : i < step ? ' done' : '') + '" onclick="goWizardStep('+i+')">' + (i < step ? '✓' : i) + '</span>';
  }
  titleEl.innerHTML = '<span>' + (steps[step] || '创建营队') + '</span><span style="margin-left:10px">' + dotsHtml + '</span>';
```

---

## 改动 5：每步引导文案

### 5a — 在 `renderWizardStep` 中，圆点代码之后、`if (step === 1)` 之前，插入：

```javascript
  var subtitles = { 1:'填入基本信息，点燃属于你们的共创火种', 2:'设定营期起止日期，编排每日活动日程', 3:'规划收入与支出，预览营队财务全景', 4:'从模板导入或逐条添加营队任务', 5:'选择共建者并匹配合适的任务', 6:'向共建者发送任务确认，收集反馈', 7:'汇聚星光，正式启动营队' };
  var guideEl = document.getElementById('campWizardGuide');
  if (!guideEl) {
    guideEl = document.createElement('div'); guideEl.id = 'campWizardGuide';
    guideEl.style.cssText = 'padding:8px 14px;font-size:.65rem;color:#5a6e5c;text-align:center;border-bottom:1px solid #e8ede6;background:#fafaf8;line-height:1.4';
    var body = document.getElementById('campWizardBody');
    body.parentNode.insertBefore(guideEl, body);
  }
  guideEl.textContent = '💡 ' + (subtitles[step] || '');
```

定位方式：搜索 `if (step === 1) renderStep1(bodyEl);` 这行，在它**上方紧邻**插入。

---

## 自检

执行完毕后验证：

| # | 检查项 |
|---|--------|
| 1 | 填一半→关闭 overlay→再点「世界终端」→弹窗「是否恢复草稿」→恢复后各步数据完整 |
| 2 | 第④步点「+ 添加」→底部 Sheet 弹出→一次填名称+类别+NT→确认→列表新增 |
| 3 | 点任务行→底部 Sheet 弹出→字段已预填→修改→确认→更新 |
| 4 | 第⑤步点「虚位以待」→成员选择 Sheet 弹出→选人→prompt 分配任务→共建人新增 |
| 5 | 标题栏显示 7 个圆点（当前放大绿/已完成✓绿/未完成灰），可点击跳步 |
| 6 | 每步标题下方有 💡 引导文案 |

---

*Doc 1/3 完成后方可执行 Doc 2/3。*
