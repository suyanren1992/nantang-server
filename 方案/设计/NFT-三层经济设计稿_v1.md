━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 设计稿
  编号：NFT-三层经济-v1
  立案：丞相 Codex 2026-07-31 22:30
  法源：砚仁 21:35「绝对不能自己造…劳动挣的多→铸成 NFT…勋章可在平台购买东西」
        砚仁 21:45「是劳动，不是脑洞…有些 NFT 只能在平台上用，平台铸造的不可交易，自己铸造的可以交易」
        砚仁 22:00「多出来的这个劳动所要赋予的这个货币其实是 NFT…怎么解决」
        砚仁 22:15「我说的是 NFT，除了名字的问题，其他都可以」
  参考：南塘云村_劳动记录NFT铸造方案 v1.0（2026-07-14）
  术语裁定：统一称「劳动 NFT」（不用 SBT 洋名），技术属性用 nft_type 字段区分
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【一、核心问题】

  砚仁问：「多出来的劳动价值怎么承载？」

  场景：小红本月劳动 50 次，社区池只剩 100 NT。
  · 旧机制：pool_refill 凭空印 20 NT 补池 → 年通胀 7,300 NT【砚仁已禁】
  · 矛盾：不印 → 劳动没回报；印 → 平台造币违反理念

  答案：**把「钱」和「功劳」拆成两种东西。**
  钱（NT）守恒不印；功劳（劳动 NFT）无限记录；功劳可换消费券（FT 勋章）内部花。


【二、三层结构】

  ┌─────────────────────────────────────────────────┐
  │ Layer 1 · NT（钱 · 有限 · 可提现 · 平台绝不印）      │
  ├─────────────────────────────────────────────────┤
  │ 来源  链上真钱充值（chain_scanner 扫入）             │
  │ 总量  == 链上实际充值总额（守恒）                    │
  │ 用途  任务奖励 / 住宿费 / 餐费 / 提现出金             │
  │ 铁律  pool.total_issued 只能因「链上充值」增加        │
  │       删除 pool_refill（nt.py:1325-1332）           │
  │ 池空  只发池子有的，发完为止（不补印）                │
  └─────────────────────────────────────────────────┘
                        ↓ 池空时劳动价值溢出到 ↓
  ┌─────────────────────────────────────────────────┐
  │ Layer 2 · 劳动 NFT（凭证 · 无限 · 劳动直接铸）★核心   │
  ├─────────────────────────────────────────────────┤
  │ 来源  劳动本身（校核 approve 通过即铸，不消耗 NT）     │
  │ 总量  无上限（记录不是货币，不通胀）                  │
  │ 用途  履历 / 治理权重 / 兑换 FT 勋章                 │
  │ 两型  nft_type='platform' 平台铸 · 不可转让          │
  │         · gas 走平台冷钱包                          │
  │         · 月度劳动凭证 / 里程碑 / 年度总结            │
  │       nft_type='self'     自己铸 · 可转让 · 可交易   │
  │         · gas 用户自付                              │
  │         · 需先持有对应 platform 记录才可申请自铸       │
  └─────────────────────────────────────────────────┘
                        ↓ NFT 兑换 ↓
  ┌─────────────────────────────────────────────────┐
  │ Layer 3 · FT 勋章（消费券 · 半有限 · 只在平台用）      │
  ├─────────────────────────────────────────────────┤
  │ 来源  劳动 NFT 兑换（销毁额度换勋章）                 │
  │ 总量  受平台商品库存约束（不是无限印）                │
  │ 用途  买平台东西（食材 / 住宿抵扣 / 活动名额）         │
  │ 铁律  勋章**不可兑回 NT**（单向阀 · 防变相印钱）       │
  │ 名字  由社员命名（砚仁 21:35：名字来自成员自创）        │
  └─────────────────────────────────────────────────┘

  ⚠️ 单向阀（防印钱红线）：
     NT → 勋章 ✅  |  劳动 → NFT ✅  |  NFT → 勋章 ✅
     勋章 → NT ❌  |  NFT → NT ❌   |  劳动 → NT（仅限池内余额）


【三、数据表（3 表）】

  ── labor_nft（劳动 NFT 主表）──
  id             String  PK   nft_xxxx
  user_id        String  FK → users.id
  nft_type       String       'platform' | 'self'
  category       String       'monthly' | 'milestone' | 'annual'
  title          String       月度劳动凭证 2026-07 / 百工里程碑
  labor_count    Integer      涵盖劳动次数
  nt_equivalent  Integer      同期劳动的 NT 等价（记录用·不是余额）
  period_start   String       YYYY-MM-DD
  period_end     String
  metadata_json  Text         劳动明细快照（IPFS 上传前的本地留档）
  ipfs_cid       String  null IPFS 内容寻址
  chain_tx       String  null 链上 tx hash（未上链为 null）
  chain_status   String       'local' | 'pending' | 'onchain' | 'failed'
  transferable   Boolean      platform=False / self=True
  badge_credit   Integer      可兑换勋章额度（= labor_count）
  badge_used     Integer      已兑换额度（≤ badge_credit）
  created_at     String

  ── badge（FT 勋章定义表 · 社员命名）──
  id             String  PK   badge_xxxx
  name           String       社员自创名（例：土豆勋章 / 灶王令）
  emoji          String
  cost_credit    Integer      兑换需消耗的 NFT 额度
  stock          Integer      库存（-1 = 不限）
  redeem_target  String       'food' | 'stay' | 'event' | 'generic'
  created_by     String  FK → users.id
  status         String       'active' | 'retired'
  created_at     String

  ── badge_holding（持有 / 消费流水）──
  id             String  PK
  user_id        String  FK → users.id
  badge_id       String  FK → badge.id
  qty            Integer
  source_nft_id  String  FK → labor_nft.id（哪笔 NFT 额度换来的）
  spent_at       String  null 已消费时间
  spent_note     String  null 消费在什么上
  created_at     String

  ⚠️ 新表必须同步入 admin.py dev-reset hard 删表清单（U-2 教训）


【四、铸造触发点（挂接现有代码）】

  ① 校核 approve 成功（nt.py:1100 附近）
     → 累加 user 当月 labor_count（不立即铸 NFT，月末批量）

  ② 月末 cron（cron.py tick_monthly · 新增）
     → 为每个当月 labor_count>0 的 user 铸 1 张 monthly platform NFT
     → chain_status='local'（先本地，上链异步）

  ③ 里程碑（approve 时检查累计）
     → 累计劳动 100/500/1000 次 → 铸 milestone platform NFT

  ④ 年末 cron
     → annual platform NFT（年度总结）

  ⑤ 用户申请自铸（端点 POST /api/nft/self-mint）
     → 校验该 user 有对应 platform NFT
     → 复制为 nft_type='self' transferable=True
     → gas 用户自付（前端引导钱包签名）

  成本参考（文章 v1.0）：OP Chain + IPFS，30 人社区 < $0.30/月


【五、端点契约（10 个 · prefix=/api/nft）】

  GET    /api/nft/list                 我的 NFT 列表（?type= ?category=）
  GET    /api/nft/{id}                 NFT 详情（含劳动明细）
  POST   /api/nft/self-mint            申请自铸可交易版（body: source_nft_id）
  GET    /api/nft/credit               我的可兑换额度汇总
  GET    /api/badges/list              勋章目录（?status=active）
  POST   /api/badges/create            创建勋章定义（admin · 社员提名走提案）
  POST   /api/badges/redeem            NFT 额度 → 勋章（body: badge_id, qty）
  GET    /api/badges/my                我持有的勋章
  POST   /api/badges/spend             消费勋章（body: holding_id, note）
  GET    /api/nft/leaderboard          劳动榜（按 labor_count · 公开）

  ⚠️ 全部走 /api/ 前缀（红队 B 根因①教训：缺前缀 → 404 → 静默假数据）


【六、UI 入口（3 处）】

  ① 卡片室 → 新增「🏅 我的劳动」Tab
     UI.Card 列出 NFT，StatusBadge 显示 local/onchain
  ② 全貌页 → 「🏅 勋章铺」卡片 → 勋章目录 + 兑换
  ③ 个人页 → 劳动榜入口（公开·激励）

  范式：UI.Card / UI.StatusBadge / UI.Alert.show（确认兑换）/ UI.EmptyState


【七、经济安全校验（必测）】

  1. NT 守恒：pool.total_issued 只因 chain_deposit 增加（删 pool_refill 后）
  2. 单向阀：勋章无任何路径回流 NT（grep 确认无 nt_balance += from badge）
  3. 额度守恒：badge_used ≤ badge_credit（DB 约束 + 端点校验）
  4. 库存守恒：badge.stock 递减，-1 才不限
  5. 自铸前置：无 platform NFT 不得自铸
  6. NFT 不可篡改 labor_count（铸后只读）


【八、实施分期】

  Phase 0（本阶段 · 已派卡）
    · 删 pool_refill → NT 层守恒（NT-P0-6）
    · except:pass 补日志

  Phase 1（下阶段 · 2 营）
    · 3 表 + 10 端点（本地版 · chain_status 恒 'local'）
    · 月末/里程碑 cron
    · dev-reset 适配 + 测试

  Phase 2（1 营）
    · 3 处 UI 入口 + api.js 10 方法

  Phase 3（上链 · 需砚仁批 gas 预算）
    · IPFS（Pinata）+ OP Chain 合约部署
    · 平台冷钱包 gas / 用户自付签名


【九、术语表（钉死·防以后误解）】

  劳动 NFT   = 劳动记录凭证。platform 型不可转让，self 型可转让。
  FT 勋章    = 平台内消费券。不可兑回 NT。名字由社员自创。
  NT         = 唯一「钱」。只从链上充值来。平台绝不印。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  待砚仁御批：Phase 1 是否即刻派 2 营
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
