# 集成指南 — 如何把接手人的代码接入宿主 App

> 给砚仁（宿主维护者）——接手人交回 src/ 后，你按这个做对接

---

## 前置：验证接手人交回的东西

```bash
cd nantang-mobile/modules/camp-pipeline/sandbox
# 替换 src/ 为接手人版本
node test.js
```

看到「🎉 全部通过」才能继续。不通过直接打回。

---

## 集成点 1：预算计算 → 替换 ui-wizard.js

### 你要改的文件

`nantang-mobile/js/ui-wizard.js`

### 当前状态

预算计算逻辑散在 `renderStep3()` 函数里——数学公式直接嵌在 HTML 字符串拼接中。大约从第 557 行开始，`incomeRmb`、`expenseRmb`、`balanceRmb` 这些变量是手动算的。

### 改法

在 `ui-wizard.js` 顶部加一行引用，然后替换计算部分：

```javascript
// 文件顶部加
// （因为 ui-wizard.js 是 <script> 直接加载的全局脚本，
//  不是 CommonJS 模块，所以不能 require —— 
//  接手人的代码需要在集成前先做一次转换）

// 方案：接手人的 camp-budget.js 需要导出为全局函数
// 在 index.html 中加一行：
// <script src="modules/camp-pipeline/src/camp-budget.js"></script>
```

实际上接手人的代码用了 `module.exports`，需要他交回来时额外提供一个**浏览器兼容版本**，或者在集成时手动包一层：

```javascript
// 在 ui-wizard.js 中直接内联接手人的 calcBudget 实现
// （接手人交回来时要求他也交一个 camp-budget.browser.js，
//   用 window.calcBudget = function(params) { ... } 导出）
```

### 验证

打开 app → 管理员 → 世界终端 → 第③步预算 → 数字与之前一致（或接手人有文档说明修改了哪个公式）

---

## 集成点 2：结算引擎 → 新建服务端 API

### 你要改的文件

1. `server/routes/camp_settlement.py` — **新建**
2. `server/models.py` — 加表
3. `nantang-mobile/js/camp-settlement.js` — 客户端渲染（你写，或者接手人也交一版）

### 步骤 1：建表

```sql
-- 在 database.py init_db() 中加 create_all，或手动执行
CREATE TABLE IF NOT EXISTS camp_settlements (
    id TEXT PRIMARY KEY,
    camp_id TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft',
    data TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    reject_reason TEXT,
    correction_notes TEXT,
    submitted_at TEXT
);
```

### 步骤 2：服务端结算 API

核心逻辑：用接手人的 `generateSettlement()` 函数的算法，在 Python 中重新实现——或者更简单——让服务端调用 Node 脚本生成 JSON，Python 只做存储和 API 转发。

**最务实的做法**：接手人的 `generateSettlement()` 是纯 JS 函数，你在服务端不需要重写它。直接让客户端调用，把结果 POST 到服务端存储。

```python
# server/routes/camp_settlement.py —— 极简版
@router.post("/settlement/save")
async def save_settlement(req: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """客户端计算好结算数据，服务端只做校验+存储"""
    # 校验：traceability 中的 entry_id 必须在 ledger 中存在
    # 校验：金额必须与 ledger 聚合一致
    # 存储
    s = CampSettlement(id=..., camp_id=req["camp_id"], data=json.dumps(req), ...)
    db.add(s); await db.commit()
    return {"ok": True}
```

### 验证

营队结营 → 客户端跑 `generateSettlement()` → 结果 POST 到服务端 → 服务端校验金额一致 → 存储。

---

## 集成点 3：对账引擎 → 新建对账页面

### 你要改的文件

1. `server/routes/camp_reconciliation.py` — **新建**
2. `nantang-mobile/js/camp-reconciliation.js` — 客户端渲染（你写）

### 步骤

外部交易记录的导入可以很简单——不接 Web3 钱包 API，先支持手动粘贴 CSV：

```
支付宝交易记录导出 CSV → 粘贴到对账页面 → 客户端跑 reconcile() → 显示匹配/不匹配
```

```javascript
// 在对账页面中调用接手人的函数
var report = reconcile(platformLedger, parseAlipayCsv(csvText));
renderReconciliationReport(report);  // 你的 UI 代码
```

### 验证

导入 8 条支付宝记录 → 7 条自动匹配 → 1 条提示"外部有、平台无" → 管理员在平台补录 → 重新对账 → 8/8 匹配。

---

## 集成点 4：人工校核页面

接收手人的 `generateSettlement()` 出结算报告后，你需要一个审核页面：

```
结算报告(JSON) → 渲染为可视表格
  ├─ 审核通过 → 标记 approved → 进入对账
  └─ 审核打回 → 标记 rejected + reject_reason → 通知管理员补录
```

这个页面**不是接手人的工作**——是你的 UI 工作。接手人只负责保证 `generateSettlement()` 输出的数据是正确的。

---

## 集成清单（你拿到接手人代码后逐条做）

- [ ] `node test.js` 全绿
- [ ] `src/camp-budget.js` → 内联到 `ui-wizard.js`（或加 `<script>` 引用），验证第③步计算一致
- [ ] `src/camp-settlement.js` → 客户端调用 → POST 到新 API → 服务端校验
- [ ] `src/camp-reconciliation.js` → 对账页面 → 粘贴 CSV → 跑 reconcile → 显示结果
- [ ] 人工校核页面（审核 + 打回 + 补录流程）
- [ ] 用一份真实营队数据跑全流程：预算→自动记录→人工补录→结算→审核打回→修正→重算→通过→对账→全部匹配

---

## 接手人的交付物清单（要求他在交回来时提供）

- [ ] `src/camp-budget.js` — 通过 test.js 模块1
- [ ] `src/camp-budget.browser.js` — 同上逻辑，`window.calcBudget = ...` 导出（方便你直接 `<script>` 引用）
- [ ] `src/camp-settlement.js` — 通过 test.js 模块3
- [ ] `src/camp-settlement.browser.js` — 浏览器兼容版（如果你打算客户端计算）
- [ ] `src/camp-reconciliation.js` — 通过 test.js 模块5
- [ ] `src/camp-reconciliation.browser.js` — 浏览器兼容版
