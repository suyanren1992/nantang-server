# 共创营计算管线

## 你要做什么

三条纯计算模块。**输入数据 → 输出结果。不需要跑 app，不需要浏览器，不需要装数据库。**

## 快速开始

```bash
cd sandbox
node test.js
```

看到「全部通过」= 你完成了当前模块。

## 文件

```
src/
  camp-budget.js          ← 模块1：预算计算（纯函数，约1小时）
  camp-settlement.js      ← 模块3：结算引擎（最核心，约4-6小时）
  camp-reconciliation.js  ← 模块5：对账逻辑（约2小时）

sandbox/
  sample-camp.json        ← 示例输入数据（你的全部输入）
  expected-output.json    ← 正确结果（你的输出必须与此一致）
  test.js                 ← 自动化测试（你的验收标准）

spec.md                   ← 完整架构 spec（遇到不确定时查阅）
```

## 工作顺序

1. **先读** `sandbox/sample-camp.json` — 理解输入数据结构
2. **再看** `sandbox/expected-output.json` — 理解你需要的输出长什么样
3. **从模块1开始** — `camp-budget.js` 最简单，先拿下建立信心
4. **然后模块3** — 结算引擎是核心，花最多时间
5. **最后模块5** — 对账逻辑相对独立

每完成一个模块，跑 `node test.js` 验证。不要三个模块全写完再跑。

## 铁律

1. **所有金额从 ledger 聚合** — 不硬编码数字
2. **is_manual=1 的条目必须出现在 adjustments 中** — 人工补录要能看见
3. **traceability 必须完整** — 每个金额都能追溯到 entry_id
4. **你的输出必须与 expected-output.json 完全一致** — 这是唯一验收标准

## 你需要了解的

- **NT** = 南塘云村内部积分，不是人民币
- **ledger** = 流水账本，所有 NT 变动都记在这里
- **entry_id** = 每笔流水的唯一编号（如 L240720-001）
- **is_manual** = 1 表示人工补录（结营后发现遗漏，手动加的）
- **campEconomy** = 角色激励配置（admin=20, builder=15, adventurer=0）+ 活动参与激励（每人 10）

## 碰到问题？

1. 先看 `spec.md` — 有完整的计算规则和数据结构定义
2. 再看 `sandbox/expected-output.json` — 正确的输出长这样
3. 实在不确定 → 在代码里加 `console.log`，跑 `node test.js` 看中间结果

## 完成之后

1. 确保 `node test.js` 三个模块全部通过
2. 每个模块额外提供一个**浏览器兼容版**（`*.browser.js`），用 `window.xxx = function(...) {...}` 导出：

```
src/
  camp-budget.js           ← Node 版（module.exports）
  camp-budget.browser.js   ← 浏览器版（window.calcBudget = ...）
  camp-settlement.js
  camp-settlement.browser.js
  camp-reconciliation.js
  camp-reconciliation.browser.js
```

两个版本逻辑完全一致，只是导出方式不同。浏览器版让宿主页面可以直接 `<script src="...">` 引用。

3. 把整个 `src/` 目录交回来
