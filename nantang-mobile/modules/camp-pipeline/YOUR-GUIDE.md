# 如何把计算管线交给接手人 · 操作指南

> 2026-07-21

---

## 你需要准备的东西（你在交出去之前做）

### 1. 一个独立目录

```
nantang-mobile/
  modules/
    camp-pipeline/
      README.md                 ← 接手人入口（下面有模板）
      spec.md                   ← camp-pipeline-handoff.md 精简版（只保留约束和验收）
      sandbox/
        sample-camp.json        ← 一份完整的示例营队数据
        expected-output.json    ← 这份数据应该产生的正确结算结果
        test.js                 ← 接手人跑 `node test.js`，通过=正确
      src/
        camp-budget.js          ← 接手人在这里写模块 1
        camp-settlement.js      ← 接手人在这里写模块 3
        camp-reconciliation.js  ← 接手人在这里写模块 5
```

### 2. 一份示例数据 `sandbox/sample-camp.json`

从你的真实数据库里导出一份**脱敏后的完整营队数据**，结构跟 `AppData._data.camps[campId]` 一致，加上对应的 `NTLedger` 条目。

```json
{
  "camp": {
    "id": "camp_sample_01",
    "name": "示例共创营",
    "builders": [
      { "name": "小王", "role": "builder", "taskNames": ["场地布置", "物资采购"], "totalNT": 10, "confirmed": true },
      { "name": "小李", "role": "admin", "taskNames": ["统筹协调"], "totalNT": 5, "confirmed": true }
    ],
    "tasks": [
      { "name": "场地布置", "reward": 10, "category": "生活", "status": "verified" },
      { "name": "物资采购", "reward": 5,  "category": "生活", "status": "verified" },
      { "name": "统筹协调", "reward": 5,  "category": "统筹", "status": "verified" }
    ],
    "budget": {
      "adventurers": 4, "builders": 2, "days": 7,
      "earlyBirdPrice": 499, "earlyBirdPct": 60, "fullPrice": 599,
      "lodgingRmb": 30, "lodgingNT": 40, "mealRmb": 8, "mealNT": 10,
      "extraIncome": [{ "name": "基金资助", "amount": 3000 }],
      "extraExpense": [{ "name": "场地租金", "amount": 2000 }]
    }
  },
  "ledger": [
    { "entry_id": "L240720-001", "from_user": "system", "to_user": "小王", "amount": 10, "type": "task_reward", "task_id": "T001", "reason": "任务完成: 场地布置", "is_manual": 0 },
    { "entry_id": "L240720-002", "from_user": "system", "to_user": "小王", "amount": 5,  "type": "task_reward", "task_id": "T002", "reason": "任务完成: 物资采购", "is_manual": 0 },
    { "entry_id": "L240720-003", "from_user": "system", "to_user": "小李", "amount": 5,  "type": "task_reward", "task_id": "T003", "reason": "任务完成: 统筹协调", "is_manual": 0 },
    { "entry_id": "L240720-m01", "from_user": "system", "to_user": "小王", "amount": 8,  "type": "task_reward", "task_id": "T004", "reason": "补录: 帮厨补贴", "is_manual": 1, "corrected_by": "砚仁", "corrected_at": "2026-07-28T10:00:00Z", "correction_reason": "结营后发现遗漏" }
  ],
  "campEconomy": {
    "roleBonus": { "admin": 20, "builder": 15, "adventurer": 0 },
    "activityBonus": 10
  }
}
```

### 3. 一份预期输出 `sandbox/expected-output.json`

你自己先用手算一遍，或者用现有代码跑一遍，得到正确结果。**这是接手人的唯一验收标准**——他的代码对同样的输入必须产生同样的输出。

```json
{
  "payroll": [
    {
      "name": "小王",
      "role": "builder",
      "taskTotal": 23,
      "roleBonus": 15,
      "activityBonus": 10,
      "adjustments": [
        { "amount": 8, "reason": "补录: 帮厨补贴", "ledger_entry": "L240720-m01", "is_manual": true }
      ],
      "grossNT": 48,
      "netNT": 48
    },
    {
      "name": "小李",
      "role": "admin",
      "taskTotal": 5,
      "roleBonus": 20,
      "activityBonus": 10,
      "adjustments": [],
      "grossNT": 35,
      "netNT": 35
    }
  ],
  "finance": {
    "totalNTIssued": 83,
    "totalNTManuallyAdjusted": 8,
    "campPoolFinal": 0
  },
  "traceability": {
    "totalNTIssued": ["L240720-001", "L240720-002", "L240720-003", "L240720-m01"],
    "payroll.小王.taskTotal": ["L240720-001", "L240720-002", "L240720-m01"],
    "payroll.小李.taskTotal": ["L240720-003"]
  }
}
```

### 4. 一个测试脚本 `sandbox/test.js`

接手人不需要跑整个 app。他只需要：

```javascript
// test.js — 接手人跑 `node test.js`，全绿 = 通过
var sample = require('./sample-camp.json');
var expected = require('./expected-output.json');

// 模块 1：预算
var budget = calcBudget(sample.camp.budget);
console.assert(budget.incomeRmb === 4796, '预算收入计算错误');

// 模块 3：结算
var settlement = generateSettlement(sample.camp, sample.ledger, sample.campEconomy);
console.assert(
  JSON.stringify(settlement.payroll) === JSON.stringify(expected.payroll),
  '工资单不匹配'
);
console.assert(
  JSON.stringify(settlement.traceability) === JSON.stringify(expected.traceability),
  '溯源索引不匹配'
);

console.log('全部通过');
```

---

## 给接手人的 README.md 模板

把下面内容放进 `modules/camp-pipeline/README.md`：

```markdown
# 共创营计算管线

## 你要做什么

三条纯计算模块。输入数据 → 输出结果。不需要跑 app，不需要碰 UI。

## 快速开始

cd sandbox
node test.js

看到「全部通过」= 你完成了。

## 文件

src/camp-budget.js        — 模块1：预算计算（纯函数，1小时）
src/camp-settlement.js    — 模块3：结算引擎（最核心，4-6小时）
src/camp-reconciliation.js — 模块5：对账逻辑（2小时）

## 规则

1. 所有金额从 ledger 聚合，不硬编码
2. 所有人工补录条目 is_manual=1，必须保留在结果中
3. traceability 字段必须记录每个金额对应的 entry_id
4. 你的输出必须与 sandbox/expected-output.json 完全一致

## 数据结构

见 sandbox/sample-camp.json — 这就是你的全部输入

## 验收

node test.js → 全部通过
```

---

## 你交出去之后的工作流

```
1. 你把 modules/camp-pipeline/ 整个目录给他（zip / git repo / 共享文件夹）
2. 他写代码，跑 test.js，自己调试
3. 他交回来：src/ 里三个文件 + test.js 全绿
4. 你审查：
   - node test.js 通过 ✓
   - 用另一份真实数据跑一遍，结果与手动计算一致 ✓
   - 代码没有硬编码金额 ✓
   - traceability 字段完整 ✓
5. 你把 src/ 里的函数接入宿主 app：
   - camp-budget.js 替换 ui-wizard.js 的 renderStep3 计算逻辑
   - camp-settlement.js 接入结算页面
   - camp-reconciliation.js 接入对账页面
```

---

## 你需要准备的（清单）

- [ ] 创建 `modules/camp-pipeline/` 目录结构
- [ ] 写 `sandbox/sample-camp.json`（一份真实脱敏数据）
- [ ] 手算 `sandbox/expected-output.json`（或用现有代码生成）
- [ ] 写 `sandbox/test.js`（对照 expected-output 做 assert）
- [ ] 写 `README.md`（用上面模板）
- [ ] 把 `camp-pipeline-handoff.md`（spec）放进目录
- [ ] 打包，交出去
