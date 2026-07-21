// ═══════════════════════════════════════════════════════════
// camp-budget.js — 模块1：预算表计算
//
// 你需要实现 calcBudget(params) 纯函数
// 输入：预算参数对象（见 sandbox/sample-camp.json 的 camp.budget）
// 输出：{ incomeRmb, expenseRmb, expenseNT, balanceRmb, health, totalPeople }
//
// 公式：
//   totalPeople = adventurers + builders
//   incomeRmb = adventurers * earlyBirdPrice * (earlyBirdPct/100)
//             + adventurers * fullPrice * ((100-earlyBirdPct)/100)
//             + sum(extraIncome)
//   expenseRmb = lodgingRmb * totalPeople * days
//              + mealRmb * totalPeople * days
//              + sum(extraExpense)
//   expenseNT = lodgingNT * totalPeople * days
//             + mealNT * totalPeople * days
//   balanceRmb = incomeRmb - expenseRmb
//   health = incomeRmb > 0 ? balanceRmb / incomeRmb : 0  （保留两位小数）
//
// 验证：node ../sandbox/test.js
// ═══════════════════════════════════════════════════════════

function calcBudget(params) {
  // TODO: 在这里实现预算计算逻辑
  throw new Error('尚未实现 — 请完成 calcBudget 函数');
}

// ══ 导出（不要改下面这行） ══
module.exports = { calcBudget: calcBudget };
