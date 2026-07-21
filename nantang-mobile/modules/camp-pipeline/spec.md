# 共创营计算管线 + 人工校核 + 钱包对账 · 接手说明

> 2026-07-21 · 交付给计算管线接手人

---

## 一、你要做什么

重构共创营的**整条数据管线**。你的工作对象是**计算函数和数据流**，不是 UI。

五层管线：

```
创世终端(预算表)
    ↓
营中记录(NT ledger 自动 + 人工补录)
    ↓
自动结算(聚合 ledger → 工资单 + 报告)
    ↓
人工校核(审核 → 通过/打回 → 修正 → 重算)
    ↓
外部对账(平台流水 ↔ 钱包/支付宝流水)
    ↓
最终结项报告(可溯源 + 已校核 + 已对账)
```

---

## 二、架构约束（不可违反）

### 约束 1：平台不碰钱

本系统是**淘宝模式**——记录流水但不经手资金。所有实际转账通过外部钱包（Web3 钱包 / 支付宝）完成。平台的 NT ledger 是**镜像账本**，外部钱包的交易记录是**真实账本**。两者必须一致。

### 约束 2：溯源不可断

报告中每个数字 → 聚合自 NTLedger → 每条 ledger 有 `entry_id`。人工补录的条目也必须写入 NTLedger（标记 `is_manual=true`），不能用独立表或硬编码数字。

### 约束 3：校核有痕迹

每次人工操作（补录、修正、审核打回）必须记录：**谁、什么时候、做了什么、为什么**。最终报告里能看到完整的校核历史链。

---

## 三、数据模型（你需要新增的）

### 3.1 扩展 NTLedger（已有表，加列）

```python
# 在 models.py NTLedger 中加
is_manual = Column(Integer, default=0)       # 1=人工补录
corrected_by = Column(String, nullable=True)  # 谁补录的
corrected_at = Column(String, nullable=True)  # 什么时候补录的
correction_reason = Column(Text, nullable=True) # 为什么补录
tx_hash = Column(String, nullable=True)       # 已存在——外部交易哈希
```

### 3.2 结算记录表（新建）

```python
class CampSettlement(Base):
    __tablename__ = "camp_settlements"
    id = Column(String, primary_key=True)           # "cst_xxx"
    camp_id = Column(String, nullable=False)         # 关联营队
    version = Column(Integer, default=1)             # 每次修正 +1
    status = Column(String, default="draft")         # draft | pending_review | approved | rejected | corrected
    data = Column(Text, nullable=True)               # JSON — 完整结算报告（含 traceability）
    created_by = Column(String, nullable=False)      # 谁生成的
    created_at = Column(String, nullable=False)
    reviewed_by = Column(String, nullable=True)      # 谁审核的
    reviewed_at = Column(String, nullable=True)
    reject_reason = Column(Text, nullable=True)      # 打回原因
    correction_notes = Column(Text, nullable=True)   # 修正说明
    submitted_at = Column(String, nullable=True)     # 提交审核时间
```

### 3.3 对账记录表（新建）

```python
class LedgerReconciliation(Base):
    __tablename__ = "ledger_reconciliation"
    id = Column(Integer, primary_key=True, autoincrement=True)
    platform_entry_id = Column(String, nullable=False)  # NTLedger.entry_id
    external_tx_id = Column(String, nullable=True)       # 支付宝交易号 / Web3 tx hash
    external_amount = Column(Integer, nullable=True)     # 外部钱包金额（分）
    external_currency = Column(String, default="NT")     # NT | RMB | ETH | ...
    match_status = Column(String, default="pending")     # pending | matched | unmatched | partial
    discrepancy = Column(Integer, default=0)             # 差额（平台 - 外部）
    discrepancy_note = Column(Text, nullable=True)       # 差额说明
    matched_by = Column(String, nullable=True)           # 谁对账的
    matched_at = Column(String, nullable=True)
```

---

## 四、模块 1：预算表计算

从 `ui-wizard.js` 的 `renderStep3()` 中提取纯函数到 `nantang-mobile/js/camp-budget.js`。

```javascript
function calcBudget(params) {
  // 纯函数，不碰 DOM，不读全局
  var totalPeople = params.adventurers + params.builders;
  var incomeRmb = params.adventurers * params.earlyBirdPrice * (params.earlyBirdPct/100)
                + params.adventurers * params.fullPrice * ((100-params.earlyBirdPct)/100)
                + sumAmount(params.extraIncome);
  var expenseRmb = params.lodgingRmb * totalPeople * params.days
                 + params.mealRmb * totalPeople * params.days
                 + sumAmount(params.extraExpense);
  var expenseNT  = params.lodgingNT * totalPeople * params.days
                 + params.mealNT  * totalPeople * params.days;
  return {
    incomeRmb, expenseRmb, expenseNT,
    balanceRmb: incomeRmb - expenseRmb,
    health: incomeRmb > 0 ? (incomeRmb - expenseRmb) / incomeRmb : 0,
    totalPeople
  };
}
```

**验收**：纯函数可单独调用，输出与 `renderStep3()` 原逻辑一致。边界值不报错。

---

## 五、模块 2：营中记录（自动 + 人工补录）

### 5.1 自动记录（已存在）

NTLedger 表已有所有 NT 流水。新增的 `is_manual` 列默认 0（自动）。

### 5.2 人工补录 API（需要你新建）

```
POST /api/camp/{camp_id}/ledger/manual
```

```python
class ManualLedgerEntry(BaseModel):
    from_user: str     # 谁出
    to_user: str       # 谁收
    amount: int        # 多少 NT
    type: str          # earn / spend / transfer / reward / ...
    reason: str        # 为什么（必填——人工补录必须有理由）
    task_id: str = ""  # 关联任务（可选）
```

**约束**：
- 所有人工补录自动设 `is_manual=1`、`corrected_by=当前用户`、`corrected_at=当前时间`
- `reason` 必填——没有理由的人工条目拒绝写入
- 写入后 `NT.verify()` 必须仍然 pass
- 可补录的时间窗口：营队 `status='active'` 期间 + 结营后 30 天内

### 5.3 人工补录查询

```
GET /api/camp/{camp_id}/ledger?manual_only=true
```

返回该营队所有 `is_manual=1` 的条目，供审核人检查。

---

## 六、模块 3：自动结算

### 输入

| 输入 | 来源 | 说明 |
|------|------|------|
| 营队全量数据 | `AppData._data.camps[campId]` | 预算、任务列表、共建人 |
| NT 流水 | `NTLedger` WHERE task_id IN (营队任务) | 自动 + 人工 |
| 任务完成状态 | `NTTask` WHERE scope=camp | 哪些完成、谁做的 |
| 角色激励配置 | `CAMP_ECONOMY` | admin=20, builder=15, adventurer=0 |

### 输出：结算报告（含 traceability + 校核历史）

```javascript
{
  settlement_id: "cst_xxx",
  camp_id: "camp_xxx",
  version: 1,                    // 第几次结算（修正后递增）
  status: "pending_review",      // draft → pending_review → approved | rejected
  generated_at: "ISO时间",
  generated_by: "用户名",

  // ══ 工资单 ══
  payroll: [
    {
      name: "小王", role: "builder",
      tasks: [
        { title: "场地布置", reward: 10, ledger_entry: "L240721-001" },
        { title: "物资采购", reward: 5,  ledger_entry: "L240721-005" }
      ],
      taskTotal: 15,
      roleBonus: 15,
      activityBonus: 10,
      grossNT: 40,
      adjustments: [               // 人工修正记录
        { amount: -5, reason: "重复记账，扣除", corrected_by: "砚仁", corrected_at: "..." }
      ],
      netNT: 35
    }
  ],

  // ══ 财务汇总 ══
  finance: {
    budgetIncomeRmb: 12000,
    actualIncomeRmb: 11500,
    actualExpenseRmb: 9800,
    balanceRmb: 1700,
    totalNTIssued: 510,
    totalNTSpent: 380,
    totalNTManuallyAdjusted: 15,   // 人工补录的 NT 总额
    campPoolFinal: 130
  },

  // ══ 溯源索引 ══
  traceability: {
    "totalNTIssued": ["L240720-001", "L240720-003", ...],
    "totalNTManuallyAdjusted": ["L240722-m01", "L240725-m02"],
    "payroll.小王.taskTotal": ["L240721-001", "L240721-005"],
    "payroll.小王.adjustments[0]": ["L240723-m03"]
  },

  // ══ 校核历史 ══
  audit_trail: [
    { action: "generated", by: "系统", at: "2026-07-27T12:00:00Z", version: 1 },
    { action: "submitted_for_review", by: "砚仁", at: "2026-07-27T14:00:00Z" },
    { action: "rejected", by: "淑惠", at: "2026-07-28T09:00:00Z",
      reason: "缺少 7/23 小杨帮厨的 8 NT，请补录后重算" },
    { action: "corrected", by: "砚仁", at: "2026-07-28T10:00:00Z",
      notes: "补录 L240728-m01: 小杨 帮厨 8 NT" },
    { action: "regenerated", by: "系统", at: "2026-07-28T10:05:00Z", version: 2 },
    { action: "approved", by: "淑惠", at: "2026-07-28T11:00:00Z" }
  ]
}
```

### 结算 API

```
POST   /api/camp/{camp_id}/settlement/generate   # 生成结算（version+1）
GET    /api/camp/{camp_id}/settlement             # 查看最新结算
GET    /api/camp/{camp_id}/settlement?version=2   # 查看指定版本
POST   /api/camp/{camp_id}/settlement/submit      # 提交审核
POST   /api/camp/{camp_id}/settlement/review      # 审核（approve/reject）
GET    /api/camp/{camp_id}/settlement/history     # 校核历史链
```

---

## 七、模块 4：人工校核工作流

### 流程

```
结算生成(v1) → 提交审核 → 审核人审查
                              ├─ 通过 → 进入对账
                              └─ 打回 → 指定修正内容
                                          ↓
                              管理员补录遗漏条目(v1→v2)
                                          ↓
                              重新生成结算(v2) → 再次提交审核
                                          ↓
                              通过 → 进入对账
```

### 打回时的约束

- `reject_reason` 必填——审核人必须写清楚哪个数字不对、差了多少
- 打回后结算状态 = `rejected`，管理员看到后补录 → 重新 generate（version+1）
- 每次重新 generate 会对比新旧 ledger 差异，只重算有变化的部分
- 校核历史链在 `audit_trail` 中完整保留——**不可删除、不可覆盖**

### 审核权限

```
结算生成：camp 创建者 或 admin
提交审核：camp 创建者 或 admin
审核通过/打回：admin 或 指定的审核人（非 camp 创建者——自己不能审自己）
```

---

## 八、模块 5：外部钱包对账

### 约束

平台不碰钱。所有实际转账通过外部钱包（Web3 钱包 / 支付宝）。平台的 NT ledger 是**镜像**，外部钱包交易记录是**真相**。

### 对账流程

```
外部交易记录导入（CSV / API / 手动录入）
        ↓
逐条匹配：平台 entry_id ↔ 外部 tx_id
        ↓
      ┌─ 匹配成功（金额一致）→ status=matched
      ├─ 匹配成功（金额不一致）→ status=partial, 记录差额
      ├─ 平台有、外部无 → status=unmatched（可能是平台记账错误）
      └─ 外部有、平台无 → status=unmatched（可能是平台漏记）
        ↓
生成对账报告 → 人工处理 unmatched 项
```

### 对账 API

```
POST   /api/camp/{camp_id}/reconciliation/import    # 导入外部交易记录
GET    /api/camp/{camp_id}/reconciliation            # 查看对账结果
POST   /api/camp/{camp_id}/reconciliation/match      # 手动匹配（人工确认）
GET    /api/camp/{camp_id}/reconciliation/report     # 对账报告
```

### 外部交易导入格式

```json
[
  {
    "external_tx_id": "ALIPAY_20240720_001",   // 支付宝交易号
    "from": "138****1234",                       // 付款方
    "to": "139****5678",                         // 收款方
    "amount": 200,                                // 金额（分 / NT）
    "currency": "RMB",
    "timestamp": "2026-07-20T08:30:00Z",
    "note": "早鸟票 - 张三"
  }
]
```

### 对账报告结构

```javascript
{
  camp_id: "camp_xxx",
  generated_at: "...",
  summary: {
    total_platform_entries: 156,
    total_external_txs: 158,
    matched: 154,
    unmatched_platform_only: 1,   // 平台有、外部无
    unmatched_external_only: 2,   // 外部有、平台无——可能是平台漏记
    partial_match: 1,             // 金额不一致
    total_platform_amount: 510,
    total_external_amount: 512,
    net_discrepancy: -2
  },
  unmatched_items: [
    {
      type: "external_only",
      external_tx_id: "ALIPAY_20240723_045",
      amount: 8,
      note: "小杨 帮厨补贴",
      action_required: "平台补录此条目 → 重新对账"
    }
  ]
}
```

### 对账后的修正闭环

```
对账发现 unmatched（外部有、平台无）
    ↓
管理员在平台补录缺失条目（模块 2 人工补录）
    ↓
重新生成结算（模块 3，version+1）
    ↓
重新对账（模块 5）
    ↓
全部 matched → 锁定结算 → 输出最终结项报告
```

---

## 九、交付物

```
server/
  routes/
    camp_settlement.py       ← 模块 3+4：结算 API + 校核工作流
    camp_reconciliation.py   ← 模块 5：对账 API
  models.py                  ← 改动：NTLedger 加列 + CampSettlement + LedgerReconciliation 新表
nantang-mobile/js/
  camp-budget.js             ← 模块 1：预算纯函数
  camp-settlement.js         ← 模块 3：客户端结算报告渲染
  camp-reconciliation.js     ← 模块 5：客户端对账界面
```

---

## 十、宿主依赖

| 依赖 | 位置 | 用途 |
|------|------|------|
| `AppData._data.camps[campId]` | app-data.js | 营队全量数据 |
| `NTLedger` 表 | models.py | NT 流水——所有金额的唯一起始数据源 |
| `NTTask` 表 | models.py | 任务完成状态 |
| `User` 表 | models.py | 用户余额交叉校验 |
| `NT.verify()` | nt-core.js + nt.py | 会计等式——结算前后各跑一次 |
| `CAMP_ECONOMY` | core.js 全局 | 角色/活动激励默认值 |
| `API.request()` | api.js | 网络请求 |
| `get_current_user` | auth.py | 当前用户（记录谁做的操作） |

---

## 十一、已知坑

1. **外部钱包导入格式不统一**——支付宝 CSV、Web3 浏览器导出、手动录入，格式各不同。需要做一个格式适配层（先支持支付宝 CSV，其余逐步加）
2. **去重**——角色激励/活动激励的去重逻辑需要查 ledger。当前 `launchCamp()` 中的去重是客户端做的，服务端没有
3. **`NTTask.scope` 字段不精准**——按 `scope='camp'` 过滤可能包含非本营队任务，需要确认 campId 如何关联
4. **人工补录的时间窗口**——结营后 30 天内可补录是建议值，实际可能需要调整
5. **对账的金额精度**——RMB 分 vs NT 整数，跨币种对账需要汇率锚定（当前 NT 不锚定 RMB，见经济设计师审查）

---

## 十二、验收清单

### 自动结算
- [ ] `POST /settlement/generate` → 返回工资单 + 财务汇总 + traceability
- [ ] 工资单每人 taskTotal = ledger 中该人 task_reward 的 sum
- [ ] traceability 中每个 key 至少一个 entry_id
- [ ] 结算前后 `NT.verify().pass === true`

### 人工校核
- [ ] `POST /settlement/review { action: "reject", reason: "..." }` → 状态变 rejected，audit_trail 追加
- [ ] 补录遗漏后 `POST /settlement/generate` → version+1，新报告包含补录条目
- [ ] 重新提交审核 → 通过 → audit_trail 完整保留两轮历史
- [ ] 非 admin 不能审核自己创建的营队结算

### 人工补录
- [ ] `POST /camp/{id}/ledger/manual` → is_manual=1, reason 必填
- [ ] reason 为空 → 400 拒绝
- [ ] 补录后 `NT.verify().pass === true`
- [ ] `GET ...?manual_only=true` → 只返回人工条目

### 外部对账
- [ ] 导入 10 条外部交易 → 8 条自动匹配（entry_id ↔ tx_id + 金额一致）
- [ ] 1 条金额不一致 → status=partial, 显示差额
- [ ] 1 条外部有平台无 → status=unmatched_external_only, 提示补录
- [ ] 补录后重新对账 → 10/10 matched
- [ ] 对账报告显示净差额 = 0

### 全流程
- [ ] 创建营队 → 营中自动记录 + 人工补录 3 条 → 自动结算 v1 → 审核打回 → 补录 → 结算 v2 → 审核通过 → 外部对账 156/156 matched → 最终报告输出
