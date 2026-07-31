---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 资金财务
task_status: 已发卡
status: 讨论中
series: NT-P0
---
# NT-P0-2 reserve 语义落地（方案 A）+ 等式追账修复 🔴

> 来源：NT 经济规则设计稿 v3.1 §3.5 / §6.4（砚仁 2026-07-30 批方案 A）
> 施工：豆包 Codex（二营）｜验收：Claude Code（一营）
> 优先级：**P0** · 工期 1 天
> 法源：砚仁 2026-07-30 终审定稿 · 二营复审两条❌之❶解除方案

## 施工内容

### A. SQL 追账（证根）

在 PG 生产库执行：
```sql
SELECT SUM(amount) FROM nt_ledger WHERE type='withdraw' AND status='settled';
```
对比当前 verify() 的 diff 值。若二者相等 → 根因坐实（每完成一笔提现 diff 永久 −X）。追账结果报砚仁签字后一次性核销调平。

### B. verify() 等式改造

`server/routes/nt.py` verify 端点：

1. **等式去掉 reserve 项**：
   - 旧：`total_system = community_pool + task_escrow + reserve + frozen`
   - 新：`total_system = community_pool + task_escrow + frozen`（不含 reserve）
   - 新等式：`total_issued = Σuser + operating + escrow + frozen`

2. **新增 reserve_covers_frozen 硬检查**：
   ```python
   reserve_covers_frozen = (pool.reserve or 0) >= (pool.frozen or 0)
   ```
   加入 verify checks 返回体，False 时触发最高优先级告警。

3. **withdraw 准入加固**（二营复审备忘，顺手闭环）：
   `server/routes/nt.py:474` 准入校验从 `reserve ≥ amount` 收紧为 `reserve ≥ frozen + amount`：
   ```python
   if (pool.reserve or 0) < (pool.frozen or 0) + req.amount:
       raise HTTPException(400, "储备池不足以覆盖冻结+本次提现")
   ```

### C. 历史 diff 核销

追账确认后，通过 topup 或管理端点一次性调平 total_issued 与实际余额，消除存量 diff。需砚仁签字确认核销金额。

## 爆炸半径（四答）

- 改几个文件：1（nt.py；verify + withdraw 各一处）
- 影响功能：verify 等式计算、withdraw 准入校验
- 破坏性变更：verify 返回体新增 reserve_covers_frozen 字段（前端可选展示）
- 回滚：`git revert` 本 commit 一键

## 铁律

- **禁区**：withdraw 资金流向代码（user/reserve/frozen 三向移动）零改动——只改等式和准入
- 只 commit 不 push；只加具名文件；pytest 零回归
- 回执独立落盘 `方案/任务卡/` 随 commit；末尾太傅注三行内
- 追账 SQL 结果 + 核销金额截图附回执

## 判据（验收方实跑，逐条贴输出）

1. verify 返回体不含 reserve 计入 total_system（旧 `diff 永久 −X` 消除）
2. reserve_covers_frozen 字段存在且值正确
3. withdraw 准入：reserve < frozen + amount 时返回 400
4. 追账 SQL 结果 = |历史 diff|（截图附回执）
5. 核销后 verify diff = 0
6. pytest 全绿零回归
