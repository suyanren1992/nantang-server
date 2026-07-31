---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 资金财务
task_status: 已发卡
status: 讨论中
series: NT-P0
---
# NT-P0-4a sync 加 my_escrow / my_frozen / my_accommodation_due 三字段 🔴

> 来源：NT 经济规则设计稿 v3.1 §9.2 + 契约 v0.2 §4
> 施工：豆包 Codex（二营）｜验收：Claude Code（一营）
> 优先级：**P0** · 工期 0.5 天
> 法源：砚仁 2026-07-30 终审定稿
> 下游：NT-P0-4b（一营前端依赖本卡字段）

## 施工内容

### A. GET /api/nt/sync 新增三字段

`server/routes/nt.py` sync 端点返回体新增：

| 新 key | 类型 | 来源 | 说明 |
|---|---|---|---|
| my_escrow | int | nt.py L117-122 逻辑复用 | 我发布任务的托管合计（替代 frozen_balance 现况语义） |
| my_frozen | int | nt_ledger type='withdraw' status='pending' | 我的提现待审合计（新增语义） |
| my_accommodation_due | int | Tenancy.debt（如有） | 我的住宿应付 |

### B. 契约同步

确认 `方案/NT_FIELD_CONTRACT.md` v0.2 §4 的三个字段已在契约中（已终审定稿，本卡只做代码落地）。

### C. 禁复用 frozen_balance

- frozen_balance 现况语义="本人发布任务托管合计"（nt.py L117-122 实测），与"提现待审"名实不符
- 本卡新增 my_escrow + my_frozen 后，frozen_balance 保留一个版本（过渡期），前端双读后废弃
- 回执须注明 frozen_balance 仍保留、未删除

## 爆炸半径（四答）

- 改几个文件：1（nt.py sync 端点）
- 影响功能：sync 返回体新增三个 key（向后兼容，旧前端忽略）
- 破坏性变更：无（纯增量）
- 回滚：`git revert` 本 commit 一键

## 铁律

- **禁区**：data.py（一营阵地）零改动；withdraw 资金流向代码零改动
- 只 commit 不 push；只加具名文件；pytest 零回归
- 回执独立落盘 `方案/任务卡/` 随 commit；末尾太傅注三行内

## 判据（验收方实跑，逐条贴输出）

1. GET /api/nt/sync 返回体含 my_escrow / my_frozen / my_accommodation_due 三字段
2. my_escrow = 本人发布未释放任务 escrow_amount 汇总（与 frozen_balance 现况值相等）
3. my_frozen = 本人 pending 状态提现流水合计
4. my_accommodation_due = 本人活跃入住 debt（无入住=0）
5. frozen_balance 仍保留（过渡期）
6. pytest 全绿零回归
