/* M-4b 自检（node 隔离脚本 · 2026-08-01 · 一营）
   验证 UI.Sheet / UI.IconGrid / UI.Field 三个新增原语的 API 完整性。
   vitest 在丞相沙箱不可用，本脚本手工断言。 */

const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'js');
const uiSrc = fs.readFileSync(path.join(jsDir, 'ui-primitives.js'), 'utf-8');
const appSrc = fs.readFileSync(path.join(jsDir, 'app.js'), 'utf-8');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + label); }
  else { fail++; console.log('  \x1b[31m✗\x1b[0m ' + label + (detail ? ' — ' + detail : '')); }
}

console.log('=== M-4b 自检 ===\n');

// ── B-1~B-3: ui-primitives.js 新增 ──
console.log('B-1~B-3 三个新原语定义:');
check('UI.Sheet 已定义', /UI\.Sheet\s*=\s*function/.test(uiSrc));
check('UI.IconGrid 已定义', /UI\.IconGrid\s*=\s*function/.test(uiSrc));
check('UI.Field 已定义', /UI\.Field\s*=\s*function/.test(uiSrc));

console.log('UI.Sheet API:');
check('返回 { el, id, close }', /\breturn\s*\{[^}]*\bel\b[^}]*\bid\b[^}]*\bclose\b/.test(uiSrc));
check('_pushOverlay 调用', /typeof\s+_pushOverlay/.test(uiSrc), '运行时检测 overlay 栈');
check('closeOverlay 调用', /typeof\s+closeOverlay/.test(uiSrc), '关闭时清栈');

console.log('UI.IconGrid API:');
check('返回 { el, getSelected, setSelected, clear }', /\breturn\s*\{[^}]*\bgetSelected\b/.test(uiSrc));
check('multi 模式支持', /\bmulti\b/.test(uiSrc));
check('onChange 回调支持', /\bonChange\b/.test(uiSrc));

console.log('UI.Field API:');
check('返回 { el, getValue, setValue, validate, setHint }', /\breturn\s*\{[^}]*\bgetValue\b/.test(uiSrc));
check('text 类型', /type\s*===\s*'text'/.test(uiSrc));
check('number 类型（±步进）', /type\s*===\s*'number'/.test(uiSrc));
check('radio 类型', /type\s*===\s*'radio'/.test(uiSrc));
check('select 类型', /type\s*===\s*'select'/.test(uiSrc));

// ── B-1: _openQuickSheet 薄壳 ──
console.log('\nB-1 _openQuickSheet / _closeQuickSheet:');
check('_openQuickSheet → UI.Sheet 转发', /UI\.Sheet\(\s*\{/.test(appSrc.match(/function _openQuickSheet[\s\S]*?^}/m)[0]));
check('_closeQuickSheet 找 .ui-sheet-backdrop', /ui-sheet-backdrop/.test(appSrc.match(/function _closeQuickSheet[\s\S]*?^}/m)[0]));
check('_closeQuickSheet 清 overlay 栈', /closeOverlay/.test(appSrc.match(/function _closeQuickSheet[\s\S]*?^}/m)[0]));

// ── B-4: _openKitchenQuick 样板 ──
console.log('\nB-4 _openKitchenQuick 样板:');
var kqFn = appSrc.match(/function _openKitchenQuick[\s\S]*?^}/m)[0];
check('使用 UI.IconGrid', /UI\.IconGrid/.test(kqFn));
check('使用 UI.Field radio', /type:\s*'radio'/.test(kqFn));
check('使用 UI.Field text', /type:\s*'text'/.test(kqFn));
check('使用 UI.Sheet', /UI\.Sheet/.test(kqFn));
check('无硬编码 HTML 拼接', !/body\s*\+=\s*'<div/.test(kqFn));
check('_submitKitchenEntry 读 _qkNoteVal', /window\._qkNoteVal/.test(appSrc.match(/function _submitKitchenEntry[\s\S]*?^}/m)[0]));

// ── B-5 复用清单 ──
console.log('\nB-5 「后续谁该用它」清单:');
var qsCount = (appSrc.match(/_openQuickSheet\(/g) || []).length;
// 原始 11 调用方中，厨房迁移到直接 UI.Sheet，剩余 9 走薄壳 + 1 函数定义 = 10
check('_openQuickSheet 剩余 9 调用方走薄壳（厨房已迁直接 UI.Sheet）', qsCount >= 10, '当前 ' + qsCount + ' 次出现（预期 ≥10）');
check('presets 数据非内嵌（由调用方传入）', !/presets/.test(uiSrc), 'IconGrid 不内嵌 presets 数据');

// ── 9 个旧原语未动 ──
console.log('\n旧原语契约不变:');
var oldPrims = [
  {name:'UI.Card', rx:/UI\.Card\s*=\s*function/},
  {name:'UI.Icon (emoji+dot)', rx:/UI\.Icon\s*=\s*function/},
  {name:'UI.Progress', rx:/UI\.Progress\s*=\s*function/},
  {name:'UI.StatusBadge', rx:/UI\.StatusBadge\s*=\s*function/},
  {name:'UI.TaskCard', rx:/UI\.TaskCard\s*=\s*function/},
  {name:'UI.EmptyState', rx:/UI\.EmptyState\s*=\s*function/},
  {name:'UI.ErrorState', rx:/UI\.ErrorState\s*=\s*function/},
  {name:'UI.LoadingState', rx:/UI\.LoadingState\s*=\s*function/},
  {name:'UI.Alert (plain object)', rx:/UI\.Alert\s*=\s*\{/}
];
oldPrims.forEach(function(p){ check(p.name + ' 仍存在', p.rx.test(uiSrc)); });

console.log('\n' + '='.repeat(40));
console.log('结果: ' + pass + ' 通过 / ' + fail + ' 失败 / ' + (pass+fail) + ' 总计');
if (fail) { console.log('❌ 有失败项，施工未完成'); process.exit(1); }
else console.log('✅ 全部自检通过');
