# C-B 社区架构设计（住宿订餐双轨 · 权限视图 · 半成品补完 · 双端预留）

> 设计卡：C-B（P0 设计卡，纯设计零代码，呈砚仁裁后才发施工卡）
> 施工方：施工二营（后端主力） | 设计日期：2026-07-29
> 数据基准：真仓 commit `20b9ad1`（HEAD，C-A 一营快赢三连已落）
> 法源：沿用 D-17 资金锁型 `with_for_update().execution_options(populate_existing=True)`
> 参考源（考古不搬运）：`项目\实景游戏pc端代码\js\app.js`（13110 行，55 处实现），见文末 PC 考古笔记节
> 关联勘察：`方案/任务卡/C-勘察-1_勘察回执.md`（一营 C-1~C-7）、`方案/真源映射表.md`（S-1，35 条+行号）

---

## 〇、总纲：三句话讲清本设计要解决什么

1. **住宿订餐现在是「一套半」**：合作社的 F16 实景住宿全链路已通，食堂 UI 通但前后端割裂（C-4/C-15 半成品）；宿舍「素社」民宿轨从零。本设计给出**双轨=同一引擎两套配置**的结论与数据模型。
2. **权限现在是「全局角色，无营地隔离」**（C-2 架构缺陷）：adventurer 能进所有营地、成员列表拉全局。本设计引入**营地级 membership 表** + **admin 全通原则**（砚仁明令），并给出身份×营地×可见性矩阵。
3. **半成品与预留**：C-5 报到写死数、C-6 NPC 数据断链——给后端补完方案；茶馆/共享厨房/集市/拍卖会四通件**只定数据模型预留不施工**。

---

## 一、住宿订餐双轨制

### 1.1 第一问必答：同一引擎两套配置 vs 两个独立系统

**结论：同一引擎两套配置（单引擎 + `track` 维度 + 配置驱动）。不建独立系统。**

**理由（四条）：**

1. **核心流程同构**。住宿两轨都是「选房型→选床位→查占用（区间重叠）→确认→计费/记账→退房结算」；订餐两轨都是「看菜单→下单(预定/现场)→NT 扣费→截止锁→履约/取消」。差异只在**配置数据**（房型清单、菜单、定价、素食标签、vendor 归属、结算入账户），不在**流程骨架**。PC 端 `inn_rooms`/`isRoomAvailable`/`roomOccupancy` 与 `canteen_menus`/`canteen_orders` 就是一套逻辑跑不同数据，已验证同构可行。
2. **涉钱路径必须唯一**。住宿费、餐费都进 NT 账本（`NTLedger` + `CommunityPool`）。两个独立系统 = 两套扣费/记账/退款代码 = 两倍锁审计面 = D-17 类竞态风险翻倍。单引擎让**所有资金写路径收敛到一处**，只审一遍锁。
3. **admin 全通与跨轨报表**。砚仁要 admin 无视限制全可见。单引擎下「查全部住宿/全部订单」是一句 `where(track in (...))`；双系统要 join 两张异构表，报表口径易漂。
4. **爆炸半径可控**。双轨差异用 `track` 字段（`coop` 合作社 / `inn` 素社民宿）+ 配置表承载，新增民宿轨 = 加配置行 + 少量分支，不复制表结构。反例：独立系统改一处订餐规则要改两处，长期必漂。

**唯一例外（保留独立的部分）**：**前端界面**素社民宿走**独立入口/独立 UI 皮肤**（卡面明确要「独立界面」），但**后端引擎共用**。即「前端两套壳，后端一套芯」。

### 1.2 引擎抽象：track 维度

现行 `Tenancy`（住宿）与 `MealOrder`/`CanteenMenu`（订餐）均**无 track 维度**，全部隐含 = 合作社轨。补 `track` 字段（默认 `coop` 保持向后兼容），民宿轨 = `inn`。

| 维度 | 合作社轨 `coop` | 素社民宿轨 `inn` |
|------|----------------|-----------------|
| 住宿房型 | F16 实景地图房间（`map_locations` roomId，MAX_BEDS=6/环境可覆盖） | 素社：2×四人间(beds4) + 4×单人间(双人床,beds1)，共 6 间（对齐 PC `inn_rooms` 梅/兰/竹/菊+A/B） |
| 住宿计费 | `BED_RATES` 现行日费，退房 G-3 应计结算 | 民宿独立定价（配置表 `inn_room_rate`），可按晚 |
| 订餐菜单 | `CanteenMenu`(date/lunch/dinner) | 民宿素食菜单（`track='inn'` + `dietary='vegetarian'` 标签） |
| 订餐定价 | 现行（前端 10/15 NT 预定/现场，需后端确权，见 §3.2） | 民宿餐价（配置） |
| vendor 归属 | 合作社食堂/客栈管理员 | 素社宿舍管理员（≠平台 admin，见 §2） |
| 入账账户 | 社区池 `camp_balance`/相应科目 | 同账本，`reason` 标 track 区分 |

### 1.3 数据模型改造（住宿订餐）

**A. `Tenancy` 补字段（向后兼容）**
```
track       = Column(String, default="coop")     # coop | inn
room_type   = Column(String, nullable=True)      # single | quad（民宿房型，coop 可空）
```
> coop 现存行 track 默认 coop，零迁移。checkin 端点加 `track` 入参（默认 coop），民宿走同一 `/checkin` 引擎不同 track。

**B. 新增 `InnRoom`（民宿房型配置，替代前端硬编码）**
```
class InnRoom(Base):
    __tablename__ = "inn_rooms"
    id        = Column(String, primary_key=True)   # mei/lan/zhu/ju/A/B
    label     = Column(String)                      # 梅/兰/竹/菊/四人间A/四人间B
    room_type = Column(String)                      # single | quad
    beds      = Column(Integer)                     # 1 | 4
    rate      = Column(Integer)                      # 每晚 NT
    dietary   = Column(String, default="vegetarian")
    status    = Column(String, default="active")
```

**C. `MealOrder`/`CanteenMenu` 补 track**
```
# MealOrder:  track = Column(String, default="coop")
# CanteenMenu: track = Column(String, default="coop")
# MealOrder 另需补：price（成交价快照）、is_preorder（预定/现场）——见 §3.2 C-4 后端确权
```

### 1.4 订餐：共享厨房「接龙」新交互（合作社轨）

PC 端订餐是「点单式」。本卡要合作社订餐升级为**共享厨房接龙**（谁做饭→谁跟单）：沿用 PC `canteen_suggestions` 思路，新增数据模型见 §4.2（共享厨房作为四通件之一预留，接龙交互施工卡另发）。**本设计只定模型，不施工。**

---

## 二、权限与视图

### 2.1 病根（C-2 实证）

现系统只有**全局角色** `User.role`（visitor/npc/adventurer/builder/admin）。`Camp` 无成员表，`camps.py list_camps`（:45-64）零过滤全员同列表；前端 `isMemberByRole()` 对 4/5 角色放行。**没有「谁属于哪个营地」的记录**。`CampBuilder`(:135) 只记建设者（name 字符串），非通用 membership。

### 2.2 数据模型：营地级 membership

**新增 `CampMembership`（营地成员关系，核心补件）**
```
class CampMembership(Base):
    __tablename__ = "camp_memberships"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(String, ForeignKey("users.id"), nullable=False)
    camp_id    = Column(String, ForeignKey("camps.id"), nullable=False)
    camp_role  = Column(String, default="member")   # member | manager（宿舍/营地管理员）
    status     = Column(String, default="active")   # active | left | pending（若开审批）
    joined_at  = Column(String, nullable=True)
    __table_args__ = (UniqueConstraint("user_id", "camp_id", name="uq_camp_member"),)
```
> `camp_role='manager'` = **宿舍管理员/营地管理员 ≠ 平台 admin**（对齐 PC `getVendorPanels` 按 world_id 匹配的 vendor 权限原型）。平台 admin 是 `User.role='admin'`，全局最高。

### 2.3 admin 全通原则（砚仁明令）

**规则**：所有 scope/camp/成员/报表查询，`if user.role == "admin"` **一律绕过** membership/track/可见性过滤，返回全集。

落点（施工时）：`camps.list_camps`、成员列表端点、归档报告端点、住宿/订餐查询端点——统一封装 helper `def visible_camp_filter(user, query): return query if user.role=="admin" else query.where(<membership 过滤>)`。避免每处手写、防漏。

### 2.4 身份 × 营地 × 可见性矩阵

| 全局角色 | 营地列表 | 进入某营地内部 | 营地成员名录 | 归档报告(财务/排行) | 平台管理区 | 说明 |
|---------|---------|--------------|-------------|-------------------|-----------|------|
| **admin** | 全部 | 全部（全通） | 全部 | 全部 | ✅ | 砚仁明令：无视一切限制 |
| **builder** | 公开 + 已加入 | 仅已加入（membership active） | 所属营地 | 所属营地 | ❌ | canClaimCamp |
| **adventurer** | 公开 + 已加入 | 仅已加入 | 所属营地 | 所属营地 | ❌ | 报到后写 membership |
| **npc（在地伙伴）** | 公开 + 已加入 | 仅已加入 | 所属营地 | ❌ | ❌ | 入住自动升 npc；isMember 收窄（见下） |
| **visitor** | 仅公开列表 | ❌ 需邀请码报到 | ❌ | ❌ | ❌ | 报到→升 adventurer + 写 membership |

**camp_role='manager' 叠加权限**（在其所属营地内）：可见本营地管理面板（住宿/订餐/成员审批），**但不跨营地、不等于平台 admin**。

**npc `isMember` 收窄裁决**：现 `nt.js:29` npc `isMember:true` 导致可进任意营地。建议改为 **npc 仅对「已入住/已报到营地」为成员**（走 membership 判定），不再全局放行。此为前端 `ROLE_CAPABILITIES` 改动，归一营；后端只需 membership 端点支撑。

### 2.5 爆炸半径

🔴 高（跨前后端）。后端：新增 `CampMembership` 表 + 报到写入端点 + 各查询挂 `visible_camp_filter`（camps/成员/报告/住宿/订餐）。前端（一营）：`getCamps` 过滤、`enterCamp` 门禁、`renderCampMembers` 取 membership、归档报告门禁。**建议拆多张施工卡**（见 §5）。

---

## 三、半成品补完

### 3.1 C-5 营地报到（告知步骤 + 写 members + people 真实计数）

**现状**：visitor 输邀请码→升 adventurer→直接进营地，**跳过报到告知**、**从不写营地成员**、`Camp.people`(:121) 是种子死数。后端 `camps.py` **无报到端点**。

**后端补完方案**：
1. **新增端点** `POST /api/camps/{camp_id}/checkin`（营地报到，区别于住宿 checkin）：
   - 幂等：查 `CampMembership(user_id, camp_id)` 存在则返回既有（防重复报到）；
   - 写 `CampMembership(status=active, joined_at=now)`；
   - **`Camp.people` 改为真实计数**：`people = count(CampMembership where camp_id, status=active)`——**读时聚合**（推荐，杜绝漂移）或写时 ±1（需锁）。建议读时聚合，`list_camps`/report 输出时 `func.count`。
   - 若开审批：`status=pending` 待 manager 审。**本期建议先不开审批**（降爆炸半径），报到即 active。
2. **告知步骤（活动须知→安全提示→日程确认→确认加入）**：纯前端 UI（一营 `ui-village.js`），后端不阻塞；后端只在最终「确认加入」时收报到请求。

**涉钱**：报到本身不涉钱。若未来报到含押金→走 D-17 锁型。本期无。

**爆炸半径**：🟡 中。后端新增 1 端点 + `Camp.people` 计数改读时聚合（影响 list/report 两处输出）。

### 3.2 C-4 订餐后端确权（半成品陷阱，与报到同批建议）

> C-勘察 C-4 指出前端订单刷新即丢（一营 C-A 已修前端持久化）。但**后端 `MealOrder` 缺 price/is_preorder 字段**，定价 10/15NT 仅前端写死，**扣费未经后端确权**——涉钱隐患。
> 建议：`MealOrder` 补 `price`（成交价快照）+ `is_preorder`；`add_meal_order`（data.py:316）**后端确定价格 + 扣 NT**（现前端扣费，后端只记订单）。**注意：data.py 归一营禁区**——此项需丞相协调跨营或改由 nt 路径。本设计标注为**待裁项**，不纳入二营本期施工。

### 3.3 C-6 NPC 数据消费接通

**现状**：`member_locations` 有写无读，`room.people[]` 永空（前端断链，C-6）。后端侧 `people_on_site` 仅服务端同步。

**后端支撑方案**：
- 现无「在场人员」持久化表。建议**新增轻量 `MemberLocation`** 或复用 `map_locations` JSON——但核心断链在**前端渲染层**（`buildRoomDetail` 读静态空数组不读 `member_locations`），属一营修复范围。
- **后端本期职责**：提供 `GET /api/presence?location=<id>` 聚合当前在场人员（按 track/camp 过滤 + admin 全通），供前端消费替代静态空数组。
```
class MemberLocation(Base):
    __tablename__ = "member_locations"
    user_id    = Column(String, ForeignKey("users.id"), primary_key=True)
    location_id= Column(String, nullable=True)   # 当前所在房间/建筑
    updated_at = Column(String, nullable=True)
```

**爆炸半径**：🟡 中。后端新增 1 表 + 1 查询端点 + 1 写端点（flipPresence 对应）；前端渲染接通归一营。

---

## 四、双端四通件预留（只定数据模型，不施工）

> 四件：茶馆 / 共享厨房 / 集市 / 拍卖会。均沿 PC `app.js` 结构改造为 PG 表。**本卡只出模型，施工卡另发。** 涉钱路径**全部标 D-17 锁型**。

### 4.1 茶馆八卦 `TeahousePost`（C-7 零施工）
```
class TeahousePost(Base):
    __tablename__ = "teahouse_posts"
    id        = Column(String, primary_key=True)
    author    = Column(String, ForeignKey("users.id"))
    content   = Column(Text)
    likes     = Column(Integer, default=0)
    replies   = Column(Text, nullable=True)   # JSON array
    track     = Column(String, default="coop")
    created_at= Column(String)
```
涉钱：`TEAHOUSE_POST` TX 若含打赏→D-17 锁。基础发帖不涉钱。

### 4.2 共享厨房接龙 `KitchenChain` / `KitchenSignup`（合作社订餐新交互载体）
```
class KitchenChain(Base):        # 一次接龙（谁开饭）
    __tablename__ = "kitchen_chains"
    id        = Column(String, primary_key=True)
    host      = Column(String, ForeignKey("users.id"))   # 掌勺
    date      = Column(String); meal = Column(String)     # lunch|dinner
    menu      = Column(Text)      # JSON
    price     = Column(Integer)   # 每份 NT
    cutoff    = Column(String)     # 截止（对齐 PC 10:30/16:30）
    max_slots = Column(Integer, default=0)   # 0=不限
    status    = Column(String, default="open")  # open|closed|settled
    track     = Column(String, default="coop")

class KitchenSignup(Base):       # 跟单（谁吃）
    __tablename__ = "kitchen_signups"
    id       = Column(Integer, primary_key=True, autoincrement=True)
    chain_id = Column(String, ForeignKey("kitchen_chains.id"))
    user_id  = Column(String, ForeignKey("users.id"))
    qty      = Column(Integer, default=1)
    price_paid = Column(Integer)   # 成交价快照
    status   = Column(String, default="signed")  # signed|paid|cancelled
```
**涉钱：跟单扣 NT + 结算给 host——扣费/结算写路径 D-17 锁型**（`with_for_update().execution_options(populate_existing=True)`），防并发满员超卖 + 双扣。

### 4.3 集市 `MarketListing`
```
class MarketListing(Base):
    __tablename__ = "market_listings"
    id        = Column(String, primary_key=True)
    seller    = Column(String, ForeignKey("users.id"))
    title     = Column(String); desc = Column(Text, nullable=True)
    price     = Column(Integer)
    status    = Column(String, default="listed")  # listed|sold|removed
    buyer     = Column(String, nullable=True)
    track     = Column(String, default="coop")
    created_at= Column(String)
```
**涉钱：成交转账 D-17 锁型**（买卖双方余额 + 状态 CAS，防并发双买）。

### 4.4 拍卖会 `Auction` / `AuctionBid`（PC 有完整实现，托管户模型）
```
class Auction(Base):
    __tablename__ = "auctions"
    id          = Column(String, primary_key=True)
    title       = Column(String); host = Column(String, ForeignKey("users.id"))
    time        = Column(String); location = Column(String, nullable=True)
    start_price = Column(Integer); deposit = Column(Integer)
    status      = Column(String, default="signup")  # signup|pending|settled
    winner      = Column(String, nullable=True)
    track       = Column(String, default="coop")

class AuctionBid(Base):
    __tablename__ = "auction_bids"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    auction_id = Column(String, ForeignKey("auctions.id"))
    bidder     = Column(String, ForeignKey("users.id"))
    anon       = Column(Boolean, default=False)   # 匿名竞拍（host/admin 可见实名）
    anon_index = Column(Integer, nullable=True)
    deposit_paid = Column(Integer, default=0)
    status     = Column(String, default="active")  # active|refunded|won
```
**涉钱最重：押金托管/退款/成交结算全 D-17 锁型**。托管户沿 PC `AUCTION_ESCROW='拍卖行托管'` 概念（后端映射为 `CommunityPool` 专项科目或系统账户）。TX：`AUCTION_DEPOSIT/REFUND/SETTLE`。匿名可见性走 admin 全通 + host 特权。

---

## 五、施工拆解（每卡爆炸半径 + 涉钱锁型）

> 排序建议：权限地基先行（membership 是 C-5 报到与视图隔离的共同底座）。

| 卡号(建议) | 内容 | 阵地 | 爆炸半径 | 涉钱锁型 |
|-----------|------|------|:--:|:--:|
| C-B-1 | 新增 `CampMembership` 表 + `visible_camp_filter` helper + admin 全通 | 二营 server | 🔴 高 | 无 |
| C-B-2 | 营地报到端点 `POST /camps/{id}/checkin` + `Camp.people` 读时聚合（C-5 后端） | 二营 server | 🟡 中 | 无 |
| C-B-3 | 前端报到告知步骤 + getCamps/成员/报告门禁接 membership（C-2/C-5 前端） | 一营 | 🔴 高 | 无 |
| C-B-4 | `Tenancy.track`+`room_type` / `InnRoom` 表 / checkin 引擎加 track（民宿轨后端） | 二营 server | 🟡 中 | 住宿记账沿 G-3 |
| C-B-5 | 素社民宿独立前端界面（复用后端引擎） | 一营 | 🟡 中 | 无 |
| C-B-6 | `MealOrder/CanteenMenu` 加 track + price/is_preorder + 后端确权扣费（C-4 后端，待裁：data.py 归一营） | 待协调 | 🟡 中 | **D-17 扣费** |
| C-B-7 | `MemberLocation` 表 + presence 端点（C-6 后端支撑） | 二营 server | 🟡 中 | 无 |
| C-B-8 | NPC room.people 渲染接通 member_locations（C-6 前端） | 一营 | 🟡 中 | 无 |
| C-B-9 | 共享厨房接龙（KitchenChain/Signup）全栈 | 双端 | 🔴 高 | **D-17 跟单扣费+结算** |
| C-B-10 | 茶馆 TeahousePost 全栈（C-7 零施工，成本≈新建食堂） | 双端 | 🟡 中 | 打赏则 D-17 |
| C-B-11 | 集市 MarketListing 全栈 | 双端 | 🔴 高 | **D-17 成交转账** |
| C-B-12 | 拍卖会 Auction/Bid 全栈（PC 有完整参考） | 双端 | 🔴 高 | **D-17 押金/退款/结算** |

> C-B-9~12 为四通件，本设计仅出模型（§4），施工卡逐张另发、逐张涉钱审锁。

---

## 六、PC 考古笔记节（参考禁搬运）

> 源：`项目\实景游戏pc端代码\js\app.js`（13110 行，55 处实现）。仅参考业务逻辑，**禁整段搬运代码**；后端一律以 PG 表 + FastAPI 端点重写。

- **订餐**：`canteen_menus{date:{lunch:[],dinner:[]}}`、`canteen_orders[{id,person,date,meal,items,price,is_preorder,status:ordered/paid,paid_at}]`、`canteen_suggestions[]`。价：预定 10NT / 现场 15NT。TX：`CANTEEN_PREORDER/CANTEEN_WALKIN`。午餐 11:30-13:00（10:30 截）、晚餐 17:30-19:00（16:30 截）。
- **民宿**：`inn_rooms[{id,type:single/quad,label,beds}]`（梅/兰/竹/菊·单人间 beds1 + A/B·四人间 beds4，**正合素社 2 四人间 + 4 单人间规格**）、`inn_bookings[{id,room,guest,check_in,check_out,status:confirmed/cancelled/rejected}]`。占用判定区间重叠 `checkIn<b.check_out && checkOut>b.check_in`（`roomOccupancy/isRoomAvailable`）。
- **拍卖**：`data.auctions[{id,title,host,time,location,start_price,deposit,bidders:[{name,anon,anonIndex}],status:signup/pending}]`。TX：`AUCTION_DEPOSIT/REFUND/SETTLE`，托管户 `AUCTION_ESCROW='拍卖行托管'`。匿名竞拍（host/admin 可见实名）。
- **议事**：`council_meetings[]`、`council_room`（本卡未展开，随四通件后议）。
- **供应商权限**：`getVendorPanels(user)` 按 `user.world_id` 字符串匹配（'高琳姐'→客栈+食堂管理，'文峰'→茶馆管理）＝**宿舍/营地管理员≠平台 admin** 的 PC 原型；`_hasVendorPanel('inn')`。本设计以 `CampMembership.camp_role='manager'` 承载。
- **角色能力表** `ROLE_CAPABILITIES`：admin/builder/adventurer `isMember:true canClaimCamp:true`；npc/visitor `isMember:false`（本设计建议 npc 收窄为按 membership 判定）。各角色 `tabs:[]` 白名单（admin 最全 13 项）。
- **成员**：`data.members{name:{name,role,avatar_seed,title}}`。

---

## 七、涉钱路径统一声明（D-17 锁型清单）

以下写路径**全部**采用 `select(...).where(...).with_for_update().execution_options(populate_existing=True)`：
- 共享厨房跟单扣费 + 掌勺结算（C-B-9）
- 集市成交双方转账（C-B-11）
- 拍卖押金托管/退款/成交结算（C-B-12）
- 订餐后端确权扣费（C-B-6，待裁）
- 住宿记账沿现行 G-3 应计结算路径（Tenancy，已在位）

现有已落锁路径不动：`admin.py confirm/reject_withdraw`、`nt.py verify_task`（S-1 已实证）。

---

## 八、影响面声明

- 本卡**纯设计零代码**，无任何业务代码改动。
- 产出文件：`方案/C-B_社区架构设计.md`（本文件）。
- 数据模型均为**新增表 / 现有表加带默认值字段**（向后兼容，coop 现存数据零迁移）。
- 施工卡 C-B-1~C-B-12 呈砚仁裁后逐张发；四通件涉钱卡逐张审锁。

---

## 太傅注（补课）

**补课章节：为什么「同一引擎两套配置」优于「两个独立系统」？**

这是软件设计里的**「变化点隔离」**原则。判断标准一句话：**看什么在变、什么不变**。住宿/订餐的**流程骨架不变**（选→查占用→下单→扣费→结算），变的只是**数据**（房型、菜单、价格、素食标签、归谁管）。当「不变的多、变的少且是数据」时，就该用**一套代码 + 配置/维度字段**（这里是 `track`），而不是复制两套代码。

反过来，如果两轨**流程本身**都不同（比如民宿要走「预订-审批-签合同-押金」而合作社是「即到即住」），那才考虑独立系统。本例流程同构，所以单引擎胜出。

**人话原理：** 一套芯、两只壳。厨房只有一个灶台（后端引擎），但可以摆两个不同的菜单牌（配置）——你不会因为要卖两种菜就砌两个灶台，那样以后换煤气罐得换两回。涉钱的钱箱也只有一个（NT 账本），锁一把好锁看住一个箱子，比看两个箱子安全。而「admin 全通」就像老板有万能钥匙：普通店员只能开自己柜台（营地 membership），老板哪个柜台都能开（`role=='admin'` 绕过所有过滤）——这把万能钥匙的代码只写一处（`visible_camp_filter`），漏一处就是权限漏洞，所以必须收口到一个 helper。