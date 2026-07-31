---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 资金财务
task_status: 已发卡
status: 讨论中
series: NT-P0
---
# NT-P0-4b 工作台资金分布折叠视图 + 契约 v0.2 定稿入 git 🟡

> 来源：NT 经济规则设计稿 v3.1 §9.2 / §9.4 + 契约 v0.2
> 施工：Claude Code（一营）｜验收：豆包 Codex（二营）
> 优先级：**P0** · 工期 0.5 天
> 法源：砚仁 2026-07-30 终审定稿
> **依赖：NT-P0-4a（后端三字段就位后才可开工）**

## 施工内容

### A. 工作台资金分布折叠视图

`nantang-mobile/` 工作台页面新增"资金分布"折叠面板：

- 数据源：GET /api/nt/sync 返回的 my_escrow / my_frozen / my_accommodation_due + 已有 balance
- 展示项：可用余额 / 任务托管 / 提现待审 / 住宿应付
- 默认折叠，用户点击展开
- 读值统一走 NT_CONTRACT.ALIAS 映射层（契约 v0.2 §5）

### B. 429 错误处理（§9.4）

前端适配 withdraw 的 7 天冷却期 429 响应：
- 429 → 展示"提现冷却中，请 N 天后再试"（N 从 Retry-After 或默认 7 计算）
- 非 429 错误走现有通用错误处理

### C. 契约 v0.2 入 git

- 确认 `方案/NT_FIELD_CONTRACT.md` 已随本 commit 入 git（终审定稿版）
- 前端 ALIAS 映射按契约 v0.2 §5 实现（pool_balance → operating_pool 等）

### D. frozen_balance 双读过渡

- 前端读 my_escrow 时 fallback frozen_balance（`my_escrow ?? frozen_balance`）
- 回执注明双读逻辑已就位，下个版本可安全删除 frozen_balance

## 爆炸半径（四答）

- 改几个文件：2-3（工作台页面 js + api.js + 可能的 css）
- 影响功能：工作台新增折叠面板 + 提现错误提示
- 破坏性变更：无（纯增量 UI + 错误处理增强）
- 回滚：`git revert` 本 commit 一键

## 铁律

- **禁区**：server/ 零改动（二营阵地）
- 只 commit 不 push；只加具名文件
- 回执独立落盘 `方案/任务卡/` 随 commit；末尾太傅注三行内

## 判据（验收方实跑，逐条贴输出）

1. 工作台可见"资金分布"折叠面板，点击展开显示四项
2. my_escrow / my_frozen / my_accommodation_due 数值与 sync 返回值一致
3. withdraw 429 → 展示冷却期提示（mock 429 响应验证）
4. NT_CONTRACT.ALIAS 映射正确（pool_balance → operating_pool）
5. frozen_balance 双读逻辑就位
6. 无 console 报错
