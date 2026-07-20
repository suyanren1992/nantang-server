# 阶段3 · Doc 3/3：P1 交互+叙事升级

> 涉及文件：`nantang-mobile.html`
> 前置：Doc 1/3 + Doc 2/3 已执行完毕

**执行前自检：** 搜索以下字符串确认 Doc 1+Doc 2 已生效：
- `openTaskEditSheet` 应存在（Doc1）
- `class="wiz-dot"` 应存在（Doc1）
- `campWizardGuide` 应存在（Doc1）
- `applyQuickTemplate` 应存在（Doc2）
- `addBudgetItemMobile` 应存在（Doc2）
- `copyPrevDaySched` 应存在（Doc2）
- `renderMilestones` 中应含 `onchange="_campDraft.step2.milestones`（Doc2 改动7）
- `特别期` 应存在于期数选择器（Doc2 改动5）

---

## 改动 1：任务状态快速切换 chip

### 1a — 新增函数

在 `removeCampTask` 函数的 `}` 之后插入：
```javascript
function toggleTaskStatus(i) {
  var t = _campDraft.step4.tasks[i]; if (!t) return;
  t.status = t.status === 'todo' ? 'maybe' : t.status === 'maybe' ? 'skip' : 'todo';
  renderWizardStep(4);
}
```

### 1b — 在 `renderStep4` 任务行中加状态 chip

找到 `renderStep4` 中渲染 NT 值的行和删除按钮行（约 L2001-2002）：
```javascript
        '<span style="font-weight:700;color:var(--green-primary);margin:0 4px;white-space:nowrap">'+t.nt+'pt</span>'+
        '<span style="color:#b84c38;cursor:pointer;padding:4px;font-size:.8rem" onclick="event.stopPropagation();removeCampTask('+origIdx+')">✕</span>'+
```

在这两行**之间**插入状态 chip：
```javascript
        '<span style="background:'+(t.status==='todo'?'#5d8c52':t.status==='maybe'?'#c8892e':'#b84c38')+';color:#fff;padding:2px 6px;border-radius:10px;font-size:.55rem;cursor:pointer;white-space:nowrap;margin:0 4px" onclick="event.stopPropagation();toggleTaskStatus('+origIdx+')">'+(t.status==='todo'?'要做':t.status==='maybe'?'备选':'不做')+'</span>'+
```

---

## 改动 2：第⑦步启营仪式 GSAP 星光汇聚

### 2a — 新增 `playLaunchCeremony` 函数

在 `launchCamp` 函数的 `}` 之前插入：
```javascript
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
```

定位方式：搜索 `function launchCamp() {`，在它**上面**插入上面的完整函数。

### 2b — 修改 `campWizardNext` 的 step 7 处理

搜索 `if (_campWizardStep === 7)`（Doc 1 改动 0 已插入此块），找到：
```javascript
  if (_campWizardStep === 7) {
    launchCamp();
    return;
  }
```

将 `launchCamp();` **替换**为：
```javascript
    playLaunchCeremony();
```

---

## 改动 3：叙事化步骤标题

找到 `renderWizardStep` 中的 `var steps =` 行（搜索 `'① 创营 · 创建营队'`），**替换整行**为：
```javascript
  var steps = ['','① 点燃火种','② 绘制星图','③ 铸造预算','④ 铭刻符文','⑤ 召唤英雄','⑥ 签订契约','⑦ 开启传送门'];
```

---

## 改动 4：任务模板加载 UI

### 4a — 在 `renderStep4` 按钮区加按钮

找到 `renderStep4` 中 `'<button class="wiz-chip" onclick="importTaskTemplate()">📥 模板导入</button>'`，在该行**之后**加：
```javascript
    '<button class="wiz-chip" onclick="loadTaskTemplate()">📂 加载模板</button>'+
```

### 4b — 新增函数

在 `saveTaskTemplate` 函数的 `}` 之后插入：
```javascript
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
```

---

## 改动 5：任务类型选择（6 种）— 完整精确版

### 5a — 修改任务编辑 Sheet HTML（在 Doc1 插入的 `#taskEditSheet` 中加类型下拉）

找到 `#taskEditSheet` 中的这行：
```html
        <div style="flex:1"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">激励点 (NT)</label>
```

在它**上面**插入：
```html
        <div style="flex:1"><label style="font-size:.65rem;color:#5a6e5c;font-weight:600">类型</label>
        <select id="taskEditType" class="login-input" style="margin:4px 0;text-align:left;background:#fff;color:#1d2e24;border-color:var(--green-border);font-size:.78rem;padding:8px">
          <option>主线M</option><option>支线S</option><option>共创C</option><option>隐藏H</option><option>身份I</option><option>彩蛋E</option>
        </select></div>
```

### 5b — 修改 `openTaskEditSheet`：预填类型

找到 `openTaskEditSheet` 函数中编辑模式分支（`if (idx >= 0) {` 块），在 `document.getElementById('taskEditNT').value = t.nt;` 之后加：
```javascript
    document.getElementById('taskEditType').value = t.type || '支线S';
```

### 5c — 修改 `saveTaskEdit`：读取类型

找到 `saveTaskEdit` 函数中的 `var nt = parseInt(document.getElementById('taskEditNT').value) || 5;`，在它**之后**加：
```javascript
  var type = document.getElementById('taskEditType').value;
```

然后将该函数中两处构造 task 对象的代码修改——找到 `nt:nt, type:'支线S'`，替换为 `nt:nt, type:type`。

具体：

改前（新增模式）：
```javascript
    _campDraft.step4.tasks.push({ name:name, category:cat, nt:nt, type:'支线S', status:'todo' });
```

改后：
```javascript
    _campDraft.step4.tasks.push({ name:name, category:cat, nt:nt, type:type, status:'todo' });
```

改前（编辑模式）：
```javascript
    var t = _campDraft.step4.tasks[_taskEditIdx]; t.name = name; t.category = cat; t.nt = nt;
```

改后：
```javascript
    var t = _campDraft.step4.tasks[_taskEditIdx]; t.name = name; t.category = cat; t.nt = nt; t.type = type;
```

### 5d — 修改 `renderStep4`：渲染类型彩色 chip

找到 `renderStep4` 中渲染类别 chip 的行（`'<span style="background:'+(catColors[t.category]||'#ddd')+';color:#fff;padding:2px 8px;...">'+t.category+'</span>'`），在它**之前**插入类型 chip：
```javascript
        '<span style="background:'+(typeColors[t.type]||'#ddd')+';color:#fff;padding:2px 8px;border-radius:10px;font-size:.58rem;margin:0 4px;white-space:nowrap">'+(t.type||'支线S')+'</span>'+
```

---

---

> **验证**：改动 4 的 `loadTaskTemplate` 函数插入位置应为 `saveTaskTemplate` 的 `}` 之后。如果 `saveTaskTemplate` 不存在（Doc 2 未执行），则在 `importTaskTemplate` 函数之后插入。

---

## 自检

| # | 检查项 |
|---|--------|
| 1 | 第④步任务行右侧有状态 chip，点击循环（要做→备选→不做→要做），颜色对应（绿/橙/红） |
| 2 | 第⑦步点「🏁 正式启动」→黑屏星光汇聚 GSAP 动画→自动 `launchCamp` |
| 3 | 步骤标题已变为叙事化：①点燃火种 ②绘制星图 ③铸造预算 ④铭刻符文 ⑤召唤英雄 ⑥签订契约 ⑦开启传送门 |
| 4 | 第④步按钮区有「📂 加载模板」按钮，点击可加载用户保存的模板 |
| 5 | 第④步「+ 添加」Sheet 中有类型下拉（主线M/支线S/共创C/隐藏H/身份I/彩蛋E） |
| 6 | 编辑已有任务时类型下拉预填正确值 |
| 7 | 保存任务后类型正确写入 `_campDraft.step4.tasks[].type` |
| 8 | 第④步任务列表中每条显示类型的彩色 chip |

---

*Doc 3/3 执行完毕。阶段 3 P0+P1 全部 18 处改动完成（Doc1:6 + Doc2:7 + Doc3:5）。*
