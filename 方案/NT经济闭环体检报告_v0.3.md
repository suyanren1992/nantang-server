---
created: '2026-07-31'
project: 南塘云村
type: 经济体检
version: v0.3(真仓对齐+治理)
status: 红队待挑
author: 丞相 Codex(起草) · 红队A/B(待挑)
法源: NT_FIELD_CONTRACT v0.2 + NT经济规则设计稿 v3.1 + 链上集成 + 用户2026-07-31御批
# 💰 NT 经济闭环体检报告 v0.3(真仓对齐+治理)

> v0.2 没读真仓就动 = 错得离谱。v0.3 必对齐三份真仓:
> ① NT_FIELD_CONTRACT v0.2(契约终审)
> ② NT经济规则设计稿 v3.1(50 人版,reserve 移出等式)
> ③ chain_scanner.py 192 行(链上集成已通)

---

## 一、真仓体检(v0.2 错的全在真仓里)

| 项 | 计划(v3.1 + 契约 v0.2) | 现状(代码) | 差距 |
|---|---|---|---|
| **链上集成** | 多签 + OP Chain + NT ERC-20 | ✅ `chain_scanner.py` + Web3.py + Transfer 事件 + 自动入账 | 🟢 已通 |
| **平台收款** | 共创营官方多签 | ✅ `PLATFORM_WALLET_ADDRESS=0xf0aa...` | 🟢 |
| **4 池架构** | OperatingPool / EscrowPool / ReservePool / FrozenPool | ❌ `community_pool` 单表多列(reserve/frozen 字段已加,但未拆表) | 🔴 待拆 |
| **会计等式** | `total_issued = Σuser + operating + escrow + frozen`(不含 reserve) | ❌ 无硬检查 | 🔴 待加 |
| **reserve ≥ frozen** | `reserve_covers_frozen: bool` 硬检查 | ❌ 无 | 🔴 待加 |
| **escrow_drift=0** | 硬检查 | ❌ 无 | 🔴 待加 |
| **营地账本** | `camp_ledgers[]`(多营地:{camp_id, balance, escrow, status, multisig_address}) | ❌ `camp_balance` 单字段 | 🔴 待扩 |
| **frozen_balance 语义** | 已勘误=任务托管(非提现待审) | ⚠️ 代码 L117-122 是任务托管,新拆 my_escrow+my_frozen | 🟡 待拆字段 |
| **多签持有人** | 文档未定(用户原话:组长+杨振) | ❌ 未入文档 | 🔴 待定 |
| **CV 三轨** | 75 CV 注册冻结 + 5 步新手任务逐步解冻(每步 15) | ⚠️ v3.1 §一 已定,代码未跑(v0.2 体检未对齐) | 🟡 待对齐 |
| **提案权** | 文档未定(用户原话:连续 3 周+在地) | ❌ 无 | 🔴 待加 |
| **投票权** | 文档未定(用户原话:在地即有,一人一票) | ❌ 无 | 🔴 待加 |

---

## 二、治本:NT 三轨 + 治理(对齐 v3.1 + 用户拍板)

### 2.1 NT 三轨(v3.1 已有,微调)

| 轨 | 计算规则(v0.3) | 来源 |
|---|---|---|
| **NT** | labor_pricing 价目 NT(沿用 42 项) | v3.1 不变 |
| **CV** | 首次注册冻结 75 → 5 步新手任务逐步解冻(每步 15);**日常 earn:floor(nt/2)** | v3.1 §一 + 红队 A 修正 |
| **XP** | 按劳动类别分桶 + 同类当周递减 [10,5,3,1,1,1,1] | 红队 A 修正(防刷) |

### 2.2 治理(用户 2026-07-31 御批,居委会模型)

| 权 | 门槛 | 来源 |
|---|---|---|
| **提案权** | 连续居住 ≥ 3 周 + 在地 | 用户原话"3 周有提案权" |
| **投票权** | 在地即有,一人一票,**不挂 CV/等级** | 用户原话"跟居委会一样" |
| **投票权失效** | 离开本地(away/offline)= 投票权消失 | 用户原话"离开之后就没有了" |
| **CV/XP/等级/勋章** | **纯荣誉**,**全不挂治理权** | 用户原话"资历是历史,跟提案权不要太挂钩" |

### 2.3 多签(用户 2026-07-31 御批)

- **持有人**:组长 + 杨振(在地成员)
- **出账**:两人签
- **提现窗口**:每月某一天集中提
- **冻结语义**:NT 冻结(用户原话)——提现待审池 `frozen_pool`

### 2.4 池子架构(对齐 v3.1 + 契约 v0.2)

```
            ┌─ 链上层:多签钱包 + 链上兑付 ─┐
            │                              │
            │   ┌─── 4 池(平台内部) ───┐    │
            │   │                       │    │
            │   │  OperatingPool        │    │ ← 住宿收入/公用
            │   │  EscrowPool           │    │ ← 任务托管
            │   │  FrozenPool           │    │ ← 提现待审(新签冻结)
            │   │  ReservePool          │    │ ← 链上兑付背书(移出等式)
            │   └───────────────────────┘    │
            │                                │
            │   Σuser + operating + escrow + frozen = total_issued
            │   reserve_covers_frozen: reserve_pool ≥ frozen_pool
            │   escrow_drift = escrow_pool − Σ未领份额 = 0
            │                                │
            │   camp_ledgers[] (多营地):     │
            │   {camp_id, balance, escrow,   │
            │    status, multisig_address}   │
            └────────────────────────────────┘
```

### 2.5 三池流转(对齐用户原话)

| 关系 | 规则 |
|---|---|
| 个人 ↔ 社区 | 个人接社区任务 → earn → 个人池;住宿 → 个人池 → 社区池(operating) |
| 营地 ↔ 个人 | 营地活动 earn → 个人池 |
| 营地 ↔ 社区 | **物理空间占用付费**(营地成员住社区 → 营地住宿费 → 社区池) |
| 社区 → 组长 | ❌ 不通(组长薪资由南塘 DAO 国库发,**独立通道**) |

### 2.6 退出机制(红队 B 盲点 3)

- 余额可转赠 / 留公益池 / 换外部 NT(限额 10%)
- 没冻结部分自由提现
- 冻结部分(frozen_pool)= 提现待审,签完才放

---

## 三、红队 A/B 盲点整合(进 v0.3 治理)

| 红队 | 盲点 | v0.3 机制 |
|---|---|---|
| A P0 | 提案权阈值 500 vs 设计 100 | 改用**居住时间** = 3 周(不挂 CV) |
| A P0 | `xp_by_category` 数据结构 | 单一 `experience_value` Integer 拆为 JSON 字段 |
| A P1 | 等级加成"也按比例加成 CV/XP" | 删,加成只加 NT |
| A P1 | 首月 50% 宽限 | 改"无",经济已自洽(净 +195) |
| A P1 | `labor_config.json` 独立文件 | 合并 `map_locations.config`(D-15 可改) |
| B ★★★★★ | 无衰减/降级/撤销 | CV/XP 不衰减(纯历史),等级不降(纯荣誉) |
| B ★★★★★ | 无照护劳动 | 新增 `care_elderly`(15)/`care_sick`(15)/`mentor_newbie`(12) |
| B ★★★★ | 退出机制空白 | 已入 §2.6(转赠/公益/外部 NT 限额 10%) |
| B ★★★★ | 同工不同酬=阶层裂痕 | 等级加成只加 NT(不挂 CV/XP)+ 纯荣誉化 |
| B ★★★ | 经济激励挤出志愿精神 | 留"志愿劳动"checkbox,不计 NT,只加 CV/XP |

---

## 四、待皇帝拍的真问题(关键参数)

1. **提案权**:连续 3 周 + 在地?甲=是 / 乙=改 4 周 / 丙=改 2 周
2. **投票权**:在地即有,一人一票?甲=是 / 乙=也挂 3 周门槛
3. **退出换外部 NT 限额**:10%?甲=10% / 乙=全免 / 丙=你来定
4. **CV 日常 earn 公式**:`floor(nt/2)`?甲=是 / 乙=`floor(nt/3)` / 丙=`floor(sqrt(nt))`
5. **首月宽限**:无?甲=是 / 乙=50% / 丙=你来定
6. **照护劳动 3 项 NT**:care_elderly(15)/care_sick(15)/mentor_newbie(12)?甲=是 / 乙=你来定
7. **志愿劳动 checkbox**:可选"不计 NT"只加 CV/XP?甲=是 / 乙=不要这个机制

---

## 五、施工清单(列真仓改造点)

### BE 后端(二营)——涉钱级 P0

| 位置 | 改造 | 来源 |
|---|---|---|
| `database.py:98-103` | 4 池**拆表**:`operating_pool` / `escrow_pool` / `frozen_pool` / `reserve_pool` 各自独立表 | 契约 v0.2 §2 |
| `database.py:79-80` | community_pool 加 singleton 索引已 OK | 不动 |
| `models.py:93` | CommunityPool 拆 4 类 Pool | 契约 v0.2 |
| `models.py` | 新增 `CampLedger`(camp_id, balance, escrow, status, multisig_address) | 契约 v0.2 §2 STRUCTURAL |
| `models.py:28-29` | `experience_value` 拆 JSON 字段 `{by_category: {labor: xp}}` | 红队 A P0 |
| `nt.py:_earn` | CV 公式改 `floor(nt/2)`;XP 按类分桶递减 | 红队 A 修正 |
| `nt.py:1034` | 校核路径**补 XP 写入** | 红队 A 修正 |
| `nt.py:L117-122` | `frozen_balance` 拆为 `my_escrow + my_frozen` | 契约 v0.2 勘误 |
| `routes/cron.py` | 每日**会计等式硬检查** `total_issued = Σuser + operating + escrow + frozen` | 契约 v0.2 §2 |
| `routes/cron.py` | `reserve_covers_frozen: bool` 校验 | 契约 v0.2 §2 |
| `routes/cron.py` | `escrow_drift=0` 校验 | 契约 v0.2 §2 |
| `routes/covenant.py` | 公约修订走 D-15 提案-校核-生效,上报南塘 DAO | 治理 |
| 新增 `routes/governance.py` | `check_proposal_right(user)`:连续 3 周+在地;`check_vote_right(user)`:在地 | 治理 |
| 新增 `routes/labor_config.py` | 拉取 `map_locations.config.labor` 端点 | 红队 A P1 |
| `nt.py:1138` | BED_RATES 入 `map_locations.config.accommodation` | 重构 |
| `app.js:54` | 校核奖励 0.25 → 0.15 | 清单 C1 |
| `app.js:66-76` | 加 3 新项 room_prep/room_inspect/newcomer_reception | 用户 2026-07-31 |

### FE 前端(一营)

| 位置 | 改造 |
|---|---|
| `nt-core.js:490` | **删** `spendToPool` CV 扣减(提案权不挂 CV) |
| 提案按钮 | 检查 `连续 3 周+在地`,不够提示 |
| 投票按钮 | 检查 `在地`,离开禁用 |
| 等级/勋章显示 | 纯荣誉,不显示任何"治理权加成" |
| 志愿劳动 checkbox | UI 加,勾上=不计 NT 只加 CV/XP |
| 提现提示 | 显示 `frozen` vs `available` 余额 |
| 提案上传 | 加 D-15 pendingConfigChanges 支持 `labor_config` 字段 |

---

## 六、实践调整(用户原话"边上线边调")

- D-15 提案-校核-生效(已存在)= 改阈值/价目/治理参数
- 3-6 月观察:外部 NT 用户比例 / 纯劳动 vs 半劳动 / 提案权使用率 / 提现频率 / 4 池 drift
- **起止合理+实践调整**——阈值初值是起点,不是终点

---

## 七、红队攻击点(给红队 A/B)

### A 挑漏洞

1. CV 公式 `floor(nt/2)` + 75 注册冻结 + 5 步解冻 是否平衡?
2. 4 池拆表 + 等式硬检查 + reserve ≥ frozen + escrow_drift=0 数据迁移怎么做?
3. 治理:连续 3 周+在地——3 周怎么算?累计/连续?中断规则?
4. 多签两人签=组长+杨振,杨振"在地"是动态的,不在怎么办?
5. 提现限额 10% 余额 vs"想提就提"——怎么定?
6. v3.1 75 CV 冻结 与 v0.3 治理提案权(3 周)是否冲突?
7. 等级加成只加 NT——这条 v3.1 没写,是新增,合理吗?
8. 营地多账本[] — multisig_address 怎么生成?链上还是平台?

### B 找盲点

1. v0.3 设计了"经济引擎+治理",但"文化保护"章节仍空白——劳动换 NT 是否会腐蚀社区精神?
2. 老人/病号/孕/幼 怎么 cover 住宿?照护劳动 3 项够吗?
3. "想提就提"无冻结的边界——会不会被洗钱/外流?
4. 跨社区(若南塘与其他社区互通)——NT 怎么换?
5. 死亡/退出时"账号"怎么办?余额归谁?
6. "在地"的判定 — W6-P-FE 的 onsite 翻牌?是用户主动翻还是被动识别?
7. 长期演化:等级+勋章纯荣誉化 1 年后还有人追求吗?
8. v0.3 加了 8 项红队盲点修补,但社区治理的"弹性"够吗?(争议如何仲裁?)

回执:方案/任务卡/红队A/B审查_v0.3_2026-07-31.md

---

**太傅注三行**:
- v0.3 第一次"对齐真仓+整合红队"——v3.1 终审 + 契约 v0.2 + 链上集成 + 用户御批,四源合一。
- 治本方向(3 轨+治理+多签+提现)= 真在跑的链上架构,不是空中楼阁。
- 8 项红队盲点全进 v0.3,但**不能一次全修**——排 P0(多签+治理+4 池)先上,P1(照护+志愿+文化保护)后续。

---
## 八、皇帝御批(2026-07-31)· v0.3 终版

| # | 参数 | 御批 | 落地 |
|---|---|---|---|
| 1 | 提案权门槛 | **甲=是**：连续 3 周 + 在地 | `routes/governance.py:check_proposal_right()` |
| 2 | 投票权 | **甲=是**：在地即有,一人一票,离开消失 | `routes/governance.py:check_vote_right()`(读 W6-P-FE status) |
| 3 | 退出换外部 NT 限额 | **非冻结的全部退**(无限额) | `routes/withdraw.py:my_frozen` 之外全可提 |
| 4 | CV 日常 earn 公式 | **甲=floor(nt/2)**(丞相建议) | `nt.py:_earn` |
| 5 | 首月宽限 | **甲=无** | 不写 |
| 6 | 照护劳动 3 项 NT | care_elderly(15)/care_sick(15)/mentor_newbie(12)(丞相建议) | `app.js:66-76` 加 3 新项 |
| 7 | 志愿劳动 checkbox | **甲=是**：不计 NT,只加 CV/XP | FE 加 checkbox 字段 |

**关键设计(御批后定型)**:
- **CV 公式 floor(nt/2)**——堵住反向激励(take_trash 5→CV+2 vs chef 20→CV+10)
- **退出机制**——只冻结"待审 NT"(`frozen_pool`),其余全自由(无限额)
- **治理双轨**——提案权 3 周冷静期,投票权在地即有,CV/XP/等级/勋章**全不挂治理权**
- **多签两签**——组长+杨振(在地),每月某天集中提
