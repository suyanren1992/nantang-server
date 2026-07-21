// ═══════════════════════════════════════════════════════════
// test.js — 接手人跑 `node test.js`，全绿 = 通过
// 不需要跑 app，不需要浏览器，只需要 Node.js
// ═══════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');

var sample = require('./sample-camp.json');
var expected = require('./expected-output.json');

var allPassed = 0;
var allFailed = 0;

function loadModule(name) {
  try { return require('../src/' + name + '.js'); }
  catch(e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.log('  ⏳ 文件 src/' + name + '.js 尚未创建');
    } else {
      console.log('  ⏳ ' + e.message);
    }
    return null;
  }
}

function check(label, actual, expected) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log('  ✅ ' + label); allPassed++; }
  else {
    console.log('  ❌ ' + label);
    console.log('     期望: ' + JSON.stringify(expected));
    console.log('     实际: ' + JSON.stringify(actual));
    allFailed++;
  }
}

// ══ 模块1：预算 ══
console.log('\n📊 模块1: 预算计算');
var budget = loadModule('camp-budget');
if (budget && budget.calcBudget) {
  try {
    var result = budget.calcBudget(sample.camp.budget);
    check('incomeRmb ' + expected.budget.incomeRmb, result.incomeRmb, expected.budget.incomeRmb);
    check('expenseRmb ' + expected.budget.expenseRmb, result.expenseRmb, expected.budget.expenseRmb);
    check('expenseNT ' + expected.budget.expenseNT, result.expenseNT, expected.budget.expenseNT);
    check('balanceRmb ' + expected.budget.balanceRmb, result.balanceRmb, expected.budget.balanceRmb);
    check('totalPeople ' + expected.budget.totalPeople, result.totalPeople, expected.budget.totalPeople);
  } catch(e) { console.log('  ❌ 异常: ' + e.message); allFailed++; }
} else { console.log('  ⏭ 跳过（模块未完成）'); }

// ══ 模块3：结算 ══
console.log('\n💵 模块3: 结算引擎');
var settlement = loadModule('camp-settlement');
if (settlement && settlement.generateSettlement) {
  try {
    var s = settlement.generateSettlement(sample.camp, sample.ledger, sample.campEconomy);
    expected.payroll.forEach(function(exp) {
      var actual = (s.payroll || []).find(function(p) { return p.name === exp.name; });
      if (!actual) { console.log('  ❌ 缺少 ' + exp.name + ' 的工资单'); allFailed++; return; }
      var p = 'payroll.' + exp.name;
      check(p + '.taskTotal', actual.taskTotal, exp.taskTotal);
      check(p + '.roleBonus', actual.roleBonus, exp.roleBonus);
      check(p + '.activityBonus', actual.activityBonus, exp.activityBonus);
      check(p + '.grossNT', actual.grossNT, exp.grossNT);
      check(p + '.netNT', actual.netNT, exp.netNT);
      check(p + '.adjustments', actual.adjustments, exp.adjustments);
    });
    check('finance.totalNTIssued', s.finance.totalNTIssued, expected.finance.totalNTIssued);
    check('finance.totalNTManuallyAdjusted', s.finance.totalNTManuallyAdjusted, expected.finance.totalNTManuallyAdjusted);
    check('traceability', s.traceability.totalNTIssued.sort(), expected.traceability.totalNTIssued.sort());
  } catch(e) { console.log('  ❌ 异常: ' + e.message); allFailed++; }
} else { console.log('  ⏭ 跳过（模块未完成）'); }

// ══ 模块5：对账 ══
console.log('\n🔗 模块5: 外部对账');
var reconciliation = loadModule('camp-reconciliation');
if (reconciliation && reconciliation.reconcile) {
  try {
    var externalTxs = [
      { external_tx_id: "EXT-001", amount: 10, to_user: "小王", type: "task_reward", note: "场地布置" },
      { external_tx_id: "EXT-002", amount: 5,  to_user: "小王", type: "task_reward", note: "物资采购" },
      { external_tx_id: "EXT-003", amount: 5,  to_user: "小李", type: "task_reward", note: "统筹协调" },
      { external_tx_id: "EXT-004", amount: 15, to_user: "小王", type: "role_bonus", note: "角色激励" },
      { external_tx_id: "EXT-005", amount: 20, to_user: "小李", type: "role_bonus", note: "角色激励" },
      { external_tx_id: "EXT-006", amount: 10, to_user: "小王", type: "activity_bonus", note: "活动激励" },
      { external_tx_id: "EXT-007", amount: 10, to_user: "小李", type: "activity_bonus", note: "活动激励" },
      { external_tx_id: "EXT-008", amount: 12, to_user: "小张", type: "reimbursement", note: "交通报销（平台未记录）" }
    ];
    var rec = reconciliation.reconcile(sample.ledger, externalTxs);
    check('对账 matched', rec.summary.matched, 7);
    check('对账 unmatched_external_only', rec.summary.unmatched_external_only, 1);
    check('对账 net_discrepancy', rec.summary.net_discrepancy, 4);
  } catch(e) { console.log('  ❌ 异常: ' + e.message); allFailed++; }
} else { console.log('  ⏭ 跳过（模块未完成）'); }

// ══ 总结 ══
console.log('\n══════════════════════════════');
if (allFailed === 0 && allPassed > 0) {
  console.log('🎉 全部通过！(' + allPassed + ' 项)');
} else if (allPassed === 0) {
  console.log('📝 尚无测试通过 — 开始写 src/ 里的代码吧！');
} else {
  console.log('⚠️ ' + allPassed + ' 通过 / ' + allFailed + ' 失败 — 继续加油');
  process.exit(1);
}
