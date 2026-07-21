// ═══════════════════════════════════════════════════════════
// camp-reconciliation.js — 模块5：外部钱包对账
//
// 你需要实现 reconcile(platformLedger, externalTxs) 函数
// 输入：
//   platformLedger — 平台 NT 流水数组 [{ entry_id, to_user, type, amount, reason }, ...]
//   externalTxs — 外部钱包交易数组 [{ external_tx_id, to_user, type, amount, note }, ...]
// 输出：
//   {
//     summary: { total_platform, total_external, matched, unmatched_platform_only,
//                unmatched_external_only, net_discrepancy },
//     unmatched_items: [{ type, entry_id?, external_tx_id?, amount, note, action_required }]
//   }
//
// 匹配规则：按 (to_user + type + amount) 三元组匹配
// — 三元组一致 → matched
// — 平台有、外部无 → unmatched_platform_only
// — 外部有、平台无 → unmatched_external_only
// — net_discrepancy = 外部独有总额 - 平台独有总额
//
// 提示：注意同键多条目（如同一人同一类型同一金额可能有多条）
//
// 验证：node ../sandbox/test.js
// ═══════════════════════════════════════════════════════════

function reconcile(platformLedger, externalTxs) {
  // TODO: 在这里实现对账逻辑
  throw new Error('尚未实现 — 请完成 reconcile 函数');
}

// ══ 导出（不要改下面这行） ══
module.exports = { reconcile: reconcile };
