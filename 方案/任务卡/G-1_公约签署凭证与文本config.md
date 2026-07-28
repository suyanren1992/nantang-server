---
created: '2026-07-28'
project: 南塘云村
type: 任务卡
domain: 激励经济
status: 已发卡
---
# G-1 公约签署凭证 + 公约文本 config（二营 · 服务端中卡）🔴

> 来源：砚仁 2026-07-28 谕（签署是合同性质，不签不能入住/预定）+
> 《方案/社区公约与共居住约定_v12.md》（第十章签署存档 · 附页 E-7 签署规则）+
> 《公约-平台对照修改清单_v1》F1/F8
> 施工：豆包 Codex（二营）｜验收：Claude Code（一营）
> 议定：签署发 10 NT 每人每版本一次（续签不发）；文本走提案生效制

## 施工内容（四件）

1. **签署凭证模型**：`covenant_signatures` 表（user_id + covenant_version + signed_at），
   user+version 唯一约束防重复。
2. **签署端点**：`POST /api/covenant/sign`
   - 首次签当前版本 → 记录 + **从 community_pool 发 10 NT**（ledger 流水 type=`covenant_sign`，
     pool.balance 同步减，钱随单走）+ 返回已签状态
   - 重复签同版本 → 幂等返回已签，不重复发 NT
   - 签旧版本 → 409 提示需签当前版本
3. **状态端点**：`GET /api/covenant/status` → 当前公约版本 + 本用户是否已签当前版本。
4. **公约文本 config**：全文存 `MapLocation` key=`"covenant_text"`
   （JSON：version + 正文章节 + 附页 + 签署页条款五项），初始内容从
   `方案/社区公约与共居住约定_v12.md` 提取录入；后续修改走 D-15 已有
   `pendingConfigChanges` 提案-校核-生效机制（F8），**不许另开修改通道**。

## 爆炸半径（四答）
- 改几个文件：models.py + covenant 路由（新文件或并入现有）+ 测试
- 影响功能：新增签署域；既有入住/预定/资金端点不动
- 破坏性变更：新增表+端点，不改旧行为
- 回滚：`git revert` 本 commit（新表随代码回退弃用）

## 铁律
- **禁区**：withdraw / confirm / reject 资金端点零改动（丞相闸口必查）
- 发 NT 必写 ledger 且 pool 同步减；10 NT 金额进 config 不硬编码
- 只 commit 不 push；只加具名文件；pytest 零回归
- 回执独立落盘 `方案/任务卡/` 随 commit；末尾太傅注三行内

## 判据（验收方实跑贴输出）
1. 新用户 sign → 200 + 记录落库 + nt_balance +10 + ledger 一条 + pool -10
2. 同用户同版本再 sign → 幂等，余额不变，无新流水
3. status 端点：未签返回未签、已签返回已签+版本
4. covenant_text 可从 config 读出，版本号与 v12 对应
5. pytest 全绿零回归
