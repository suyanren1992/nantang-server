// ═══════════════════════════════════════════════════════════
// camp-settlement.js — 模块3：结项结算引擎（最核心）
//
// 你需要实现 generateSettlement(camp, ledger, campEconomy) 函数
// 输入：
//   camp — 营队对象 { builders: [{name,role,...}], tasks: [...], budget: {...} }
//   ledger — NT 流水数组 [{ entry_id, to_user, amount, type, reason, is_manual, ... }]
//   campEconomy — { roleBonus: {admin, builder, adventurer}, activityBonus }
// 输出：
//   { payroll: [...], finance: {...}, traceability: {...} }
//   结构见 sandbox/expected-output.json
//
// 步骤提示：
// 1. 遍历 ledger，按 to_user 分组聚合
//    — task_reward → taskTotal
//    — role_bonus → roleBonus
//    — activity_bonus → activityBonus
// 2. 对每个 builder，构造 payroll 条目
//    — is_manual=1 的条目放入 adjustments 数组
//    — grossNT = taskTotal + roleBonus + activityBonus
// 3. 计算 finance 汇总
//    — totalNTIssued = 所有 ledger.amount 之和
//    — totalNTManuallyAdjusted = is_manual=1 的 amount 之和
// 4. 构造 traceability 对象
//    — 每个金额 key → 对应的 entry_id 列表
//
// 核心约束（不可违反）：
//   - 所有金额从 ledger 聚合——不硬编码
//   - is_manual=1 的条目必须出现在 adjustments 中
//   - traceability 必须完整
//
// 验证：node ../sandbox/test.js
// ═══════════════════════════════════════════════════════════

function generateSettlement(camp, ledger, campEconomy) {
  // TODO: 在这里实现结算逻辑
  throw new Error('尚未实现 — 请完成 generateSettlement 函数');
}

// ══ 导出（不要改下面这行） ══
module.exports = { generateSettlement: generateSettlement };
