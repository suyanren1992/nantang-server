---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 资金财务
task_status: 已发卡
status: 讨论中
series: NT-P0
---
# NT-P0-3 自动对账 cron + 等式 diff 告警 + 即时轻检 🔴

> 来源：NT 经济规则设计稿 v3.1 §7 / §8.1 / §8.4 / §8.5
> 施工：豆包 Codex（二营）｜验收：Claude Code（一营）
> 优先级：**P0** · 工期 0.5 天
> 法源：砚仁 2026-07-30 终审定稿
> 依赖：NT-P0-2（verify 等式改造就位后 cron 才有意义）

## 施工内容

### A. 自动对账 cron（§7）

在现有 cron 框架（`server/cron.py`）新增每日全量 verify 任务：
- 每日定时调用 verify 逻辑，检查等式 `total_issued = Σuser + operating + escrow + frozen`
- diff ≠ 0 时触发告警（日志 + 站内通知 admin）
- 结果沉淀到日志（`server/logs/app.log`）

### B. 即时轻检（§8.1 边界四条）

在所有涉钱写路径（earn / transfer / withdraw / confirm / verify_task）的事务提交前，加轻量等式校验：

**四条边界写死**：
1. **只算 NT 字段**：池 balance + 涉及用户 nt_balance 增减和=0，排除 CV/XP/contribution_pool
2. **total_issued 是锚点非池项**：topup / 提现确认等改锚点的操作单列对账（锚点变动量必须等于对应池/账变动量）
3. **在已持有的行锁内计算**，禁止全表扫
4. **delta 式只拦新失衡**，抓不到存量漂移（存量靠每日全量 verify）——代码注释 + 文档均注明

轻检失败 → 事务回滚 + 告警，不静默放行。

### C. 告警维度（§8.5）

- 等式 diff ≠ 0 → **最高优先级**告警
- reserve_covers_frozen = False → **最高优先级**告警
- transfer 24h 累计 > 20,000 → 告警（不拦截）
- 熔断触发 → 告警

### D. 熔断下沉（§8.4）

将熔断逻辑从端点层下沉到 `_grant_from_pool` 函数层（按"资金出池"统一计数）：

| 维度 | 阈值 | 行为 |
|---|---|---|
| 单收款人 24h | 30,000 NT | 拦截 + 告警 |
| 全局 24h | 40,000 NT | 拦截 + 告警 |

覆盖 earn + card-confirm + 校核奖三路出池，堵住原绑端点的绕过洞。

## 爆炸半径（四答）

- 改几个文件：2-3（cron.py + nt.py 轻检/熔断 + 可能的告警模块）
- 影响功能：所有涉钱写路径（加轻检）、cron（加对账任务）
- 破坏性变更：轻检失败会回滚事务（之前可能静默通过的不平衡会被拦截）
- 回滚：`git revert` 本 commit 一键

## 铁律

- **禁区**：withdraw 资金流向代码零改动
- 只 commit 不 push；只加具名文件；pytest 零回归
- 回执独立落盘 `方案/任务卡/` 随 commit；末尾太傅注三行内

## 判据（验收方实跑，逐条贴输出）

1. cron 日志出现每日 verify 记录（diff=0 或 diff=X）
2. 人为制造不平衡（mock）→ 轻检拦截事务回滚（不静默通过）
3. 熔断：单收款人 24h 出池 > 30000 → 拦截
4. 熔断：全局 24h 出池 > 40000 → 拦截
5. 正常操作（< 阈值）不受影响
6. pytest 全绿零回归
