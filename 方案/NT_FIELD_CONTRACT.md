---
project: 南塘云村
type: 方案规划
domain: 资金财务
status: 终审定稿
created: 2026-07-30
revised: 2026-07-30
finalized: 2026-07-30
---

# NT_FIELD_CONTRACT — NT 接口字段契约（v0.2）

> 规则：**后端改表结构先改本文件，前端对着改**；前后端引用同一份（施工时移入仓库根目录随 git 提交）。
> 改契约 = 涉钱契约变更，须在任务卡上点名。前端读值统一走 ALIAS 映射层，非预期 key 打 console.warn。
> 数据基准：nt.py @ dcd17fa + data.py 实测（2026-07-30 核对）。
> 🆕R2 v0.2：吸收二营复审 Q4-1（reserve 移出等式）+ 一营复审 §1 语义勘误 + sync_all 实测补全。

## 1. GET /api/nt/sync（个人资金视图 · 必含 key）

| key | 类型 | 必含 | 说明 |
|---|---|---|---|
| balance | int | ✅ | 个人可用余额（nt_balance） |
| cv / xp / role | int/int/str | ✅ | 贡献值/经验/角色 |
| trust_score | int | ✅ | 信誉分 0-100 |
| frozen_balance | int | ✅ | ⚠️ **v0.2 语义勘误**：实测 nt.py L117-122 = **本人发布且 escrow 未释放的任务托管合计**（非提现待审）。拆表后由 my_escrow 取代，见 §4 |
| wallet_address | str\|null | ✅ | 链上地址 |
| cron_active | bool | ✅ | cron 开关 |
| ledger / tasks / deposit_intents | array | ✅ | 流水/任务/充值意向 |
| task_statuses | dict | ✅ | 任务状态枚举（key→中文） |
| all_tenancies | array | ✅ | 活跃入住 |
| accommodation | object\|null | ✅ | 当前住宿状态（无入住=null） |
| pending_verifications | array | ✅ | 待校核（≤30） |

### 1.1 tasks[] 内部字段规格（🆕R2 补全）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | str | 任务 ID |
| title | str | 标题 |
| reward | int | 单人报酬 |
| category / scope | str | 分类 / 范围（community\|camp） |
| status | str | 中文状态（对应 task_statuses） |
| poster | str | 发布者 user_id |
| assignee / assignees | str\|null / list | 单人认领 / 多人认领列表 |
| slots | int\|null | 多人名额 |
| deadline / reviewer | str\|null | 截止日 / 指定审核人 |
| note / evidence | str\|null | 备注 / 凭证 |
| escrow_amount | int | 托管金额（poster 侧冻结） |
| is_system_generated | bool | 是否系统生成任务 |
| camp_ref_id / location_id | str\|null | 关联营地 / 地点 |
| created_at / verified_at / verifier_id | str\|null | 创建/验证时间 + 验证人 |

## 2. GET /api/nt/pools（资金池视图 · 现况 → 拆表后）

| 现况 key | 拆表后 key | 类型 | 说明 |
|---|---|---|---|
| community_pool | operating_pool | int | 运营池 |
| task_escrow | escrow_pool | int | 任务托管池 |
| reserve | reserve_pool | int | 储备池（🆕R2 **移出会计等式**，仅作链上兑付背书台账） |
| frozen | frozen_pool | int | 提现待审池 |
| camp_balance | camp_ledgers（array：{camp_id,balance,escrow}） | int→array | ⚠️ **STRUCTURAL CHANGE**：营队独立账本 |
| total_issued | total_issued | int | 全局锚点，唯一处 |

> 🆕R2 **reserve 定性变更**：ReservePool 与 contribution_pool 同级，不计入 total_system。
> 新等式：`total_issued = Σuser + operating + escrow + frozen`（不含 reserve）。
> 新增硬检查：`reserve_covers_frozen: reserve_pool ≥ frozen_pool`。

### 2.1 拆表过渡期兼容

- 拆表前 sync_all 保留 `pool_balance`（单值 = CommunityPool.balance）
- 拆表后新增 `pool_detail`（对象 = {operating, escrow, reserve, frozen, camp_ledgers[]}）
- 前端经 ALIAS 过渡，pool_balance 保留一个版本后废弃

## 3. GET /api/nt/verify（等式校验 · checks 内 key）

| 现况 key | 拆表后 | 说明 |
|---|---|---|
| pass | 不变 | bool 总判 |
| total_user_balance / total_system / total_issued / diff | 不变 | 等式主件（🆕R2 total_system 不含 reserve） |
| community_pool / task_escrow / frozen | operating_pool / escrow_pool / frozen_pool | 三池 |
| reserve | reserve_pool | ⚠️ **不再计入等式**，仅展示 |
| （🆕R2 新增） | reserve_covers_frozen | bool，reserve_pool ≥ frozen_pool |
| camp_balance / camp_pool_ledger / camp_pool_drift | camp_ledgers 数组 + 逐营 drift | 营队层 |
| （新增） | escrow_drift | int，必须=0（`escrow_pool − Σ未领取且未退回份额`） |

> 🆕R2 **escrow_drift 口径写死**：`EscrowPool.balance − Σ(reward × (slots − 已到账人数 − 已退回份额)) = 0`
> 部分领取态不误报；只算"未领取且未退回"份额。

## 4. sync 拆表后新增字段（资金分布视图数据源）

| 新 key | 类型 | 说明 |
|---|---|---|
| my_escrow | int | 我发布任务的托管合计（替代 frozen_balance 现况语义） |
| my_frozen | int | 我的提现待审合计（新增语义） |
| my_accommodation_due | int | 我的住宿应付 |

> 🆕R2 **禁复用 frozen_balance**：
> - frozen_balance 现况语义="本人发布任务托管合计"（nt.py L117-122 实测），与"提现待审"名实不符
> - 拆表后**删 frozen_balance**，新发 `my_escrow` + `my_frozen` 两个独立字段
> - 过渡期：前端双读 `my_escrow ?? frozen_balance`（ALIAS 层处理），一个版本后移除 frozen_balance

## 5. 前端 ALIAS 映射（nt-contract.js）

```js
var NT_CONTRACT = {
  ALIAS: { community_pool:'operating_pool', task_escrow:'escrow_pool',
           reserve:'reserve_pool', frozen:'frozen_pool',
           pool_balance:'operating_pool' /* 🆕R2 补 */ },
  get(obj,key){ var k=this.ALIAS[key]||key;
    if(!(k in obj)&&!(key in obj)) console.warn('[NT_CONTRACT] missing key:',key);
    return obj[k]!==undefined?obj[k]:obj[key]; }
};
```

## 6. GET /api/data/sync_all（🆕R2 新增 · 前端全量同步实测清单）

> 数据来源：data.py L519-528 实测（2026-07-30）。
> 与 /api/nt/sync 是**两个独立端点**：sync 出个人资金视图，sync_all 出社区全量数据。

| # | key | 类型 | 说明 |
|---|---|---|---|
| 1 | tasks | array | 我的任务 |
| 2 | journal | array | 日志 |
| 3 | discoveries | array | 发现 |
| 4 | activity | array | 社区动态 |
| 5 | items | array | 仓库物品 |
| 6 | newbie | array | 新手任务 |
| 7 | verifications | array | 待校核 |
| 8 | cron_active | bool | cron 开关 |
| 9 | task_statuses | dict | 状态枚举 |
| 10 | pool_balance | int | CommunityPool.balance（过渡期保留，拆表后改 pool_detail） |
| 11 | map_locations | object | 地图数据 |
| 12 | camps | array | 营地列表 |
| 13 | presence | object | 翻牌状态（uid→data） |
| 14 | pendingConfigChanges | array | 公约待审修改 |
| 15 | configHistory | array | 公约修改历史 |

> P0-4a 施工后 sync_all 将新增 `my_escrow` / `my_frozen` / `my_accommodation_due` 三字段。
