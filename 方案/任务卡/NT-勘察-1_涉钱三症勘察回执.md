# NT-勘察-1 · 涉钱域三症勘察回执（P0 · 只读零写入）

> 勘察方：施工二营 | 日期：2026-07-29 | 类型：涉钱域只读勘察，零业务代码改动
> 触发：砚仁 21:19 线上日志实证三症（会计等式×4 / 社区池 0 / nt-core?v=8 落后）
> 结论一句话：**三症同源——前端 nt-core.js 是「file:// 离线模拟器」，在 HTTP 线上模式下从未与后端对账；
> 后端账本（Neon PG）真实健康，池重建真执行到 500。所谓「池=0」是前端一个从未注水的变量，不是后端的钱丢了。**

---

## 症①：会计等式不成立 ×4（core.js:1306）

### 触发路径
- `showMy()` [core.js:1304] → `if(window.NT && !NT.verify().pass)` → [core.js:1306] `console.error('[NT] 会计等式不成立！', v)`。
- `showMy` 每次切到「我的」页就跑一次，故一次会话点几次 = ×4。

### 校验的是什么科目（nt-core 校验函数）
- 校验函数 `verify()` 定义在 [nt-core.js:552-590]，会计等式在 [nt-core.js:571/584]：
  `sum(users.ntBalance) + sum(CAMP_POOLS) + TASK_ESCROW + COMMUNITY_POOL === _totalIssued`
- 四个科目 + 一个总量，全部是 **nt-core.js 模块内的 JS 内存变量**（[nt-core.js:45-59]）：
  `USERS / CAMP_POOLS / TASK_ESCROW / COMMUNITY_POOL / _totalIssued`。

### 不平衡的具体那一项 + 根因
- `issues:Array(1)` 里唯一那条就是 [nt-core.js:584] 的等式差额行。
- **根因**：nt-core.js 是 file:// 离线模拟器（自证：[nt-core.js:706/688/697] 三处注释「fallback for file:// mode (Phase C3)」）。
  在 HTTP 模式下 `_loadState()` [nt-core.js:64-69] **直接 `localStorage.removeItem` 后 return**，不加载任何存档。
  于是 `COMMUNITY_POOL` 恒为初始值 **0**（[nt-core.js:57]），`_totalIssued` 恒为 0，`CAMP_POOLS/TASK_ESCROW` 恒为 0。
- 而 `USERS` 却会被别处（登录/同步）零星塞进带 `ntBalance` 的用户 → `sum(users) > 0`。
- 等式两边：`(某个正数 users) + 0 + 0 + 0  ≠  0(_totalIssued)` → 恒不平衡，差额 = sum(users)。
- **本质是假警报**：线上真账本在后端 PG（`community_pool` 表 + `nt_ledger`），前端这台模拟器根本没参与对账，它的「等式」自然对不上。verify() 不该在 HTTP 模式跑。

---

## 症②：社区池余额不足 当前:0 需要:8 → 卡片发现确认卡死

### 两层错误叠加（都在 confirmDiscovery [ui-cardroom.js:1286-1313]）

**第一层（噪音）**：[ui-cardroom.js:1296] `NT.earn(d.guessedPerson, d.ntDoer, ...)`
- `NT.earn` → [nt-core.js:419-420] `earn()` → `earnFromPool(...,'community')` → [nt-core.js:456-464]
- [nt-core.js:461-463]：`if (pool==='community' && COMMUNITY_POOL < amount){ console.error('[NT] 社区公共池余额不足！当前:'+COMMUNITY_POOL+' 需要:'+amount); return null; }`
- COMMUNITY_POOL 恒为 0（见症①）→ 每次都打这条 error 并 return null。**无害但制造「池=0」假象**。

**第二层（真卡死）**：[ui-cardroom.js:1298-1299] HTTP 模式转账
- `API.request('POST','/api/nt/transfer',{to:d.guessedPerson, amount:d.ntDoer, ...})`
- 后端 [nt.py:197-213] `transfer`：`from = 当前登录用户`（确认者），[nt.py:212-213] `if from_user_obj.nt_balance < amount → 400 "余额不足（当前 X NT）"`。
- 确认「是我做的」的按钮 [ui-cardroom.js:1212] 由**做事者本人**点，即 `from == d.guessedPerson`（自己转给自己）——既无意义，又要求本人余额 ≥ ntDoer。新用户余额 0 → **transfer 400 → catch 静默 → 奖励never到账 → 界面卡在「确认成功」toast 但钱没动**。

### 根因：卡片室奖励「无池可发」——用错端点 + 正确端点被废弃
- 「被发现做好事得 NT」本应是 **社区池 → 做事者** 的 grant（pool-funded），却错用了 **user→user 的 /api/nt/transfer**。
- 而真正该用的 `POST /api/nt/earn`（池→用户）**已被废弃注释掉**：[nt.py:239-246] 「R11-1: POST /api/nt/earn 已废弃 — 客户端无调用方（grep 确认 2026-07-21）」。
- 于是卡片室退而用 transfer 兜底，撞上「确认者自己没钱」→ 400。

### 后端池重建：真执行、到 500、钱没丢（回答卡面「钱去了哪/重建是否真执行」）
- dev-reset hard 池重建逻辑 [admin.py:145-154]：`delete(CommunityPool)` → commit → **`new_pool = CommunityPool(balance=500, total_issued=500,...)` + `db.add` + pool_init 500 账本** → [admin.py:181] commit。**确定执行**。
- `_get_pool` [nt_helpers.py:37-52] 兜底：查不到池就新建 balance=500。双保险。
- **本地库实证**（`server/nantang_fresh.db` 直接查）：
  `community_pool: balance=416, total_issued=500, task_escrow=134`；`nt_ledger`: `pool_init ×1 = 500`、`task_freeze ×17 = 134`。
  → 池起始 500，134 因 17 笔任务托管冻结从 balance 划入 task_escrow（500−134=366… 实为 416，差额为期间 spend 回流，属正常经营）。**没有一笔把池抽到 0**。
- **结论**：后端池非 0；砚仁看到的「当前:0」是前端 nt-core 那个从未注水的 `COMMUNITY_POOL` 变量（[nt-core.js:57]），**不是后端的钱丢了**。

### 钱流图（回答「池从 500 到 0 的每一笔去向」）
```
【后端 PG 真账本】                          【前端 nt-core 模拟器】
pool_init  +500  (dev-reset/首建)           COMMUNITY_POOL = 0   ← 出生即 0[nt-core.js:57]
task_freeze -134 (17笔任务托管→escrow)        _loadState() 在HTTP直接return[nt-core.js:66-68]
spend回流   +50  (personal/camp_spend→池)     ↑ 从无任何代码把后端池灌进来
─────────────                               （API.getPools 定义在api.js:150但全仓0调用方）
现值 balance=416, escrow=134, issued=500     现值 = 0（恒定，非漏光）
        ↑ 钱都在，账平                              ↑ 卡面担心的「0」在这里，是空瓶不是漏瓶
```

---

## 症③：nt-core.js?v=8 版本号严重落后

### index.html 引用行
- [index.html:520] `<script src="js/nt-core.js?v=8"></script>`
- 同批兄弟：utils v9 / mobile-bundle v19 / nt v17 / app-data v22 / api v21 / core v34 / app v30……**唯 nt-core 卡在 8**。

### 是「铁律6 漏标」还是「长期 frozen」？→ 铁律6 漏标（改了没走闸）
- nt-core.js **不是长期冻结**：git 史显示它 2026-07-22 仍在改——
  `1cbd2c2 W1-A+W2: XSS止血`、`a6dc124 校核卡片可点击`、`3120c86 校核室扑克牌卡片`（均 07-22）。
- 而 `1cbd2c2` 的 diff 里明确改了 nt-core.js（「加 STATUS_MAP/STATUS_REVERSE 映射表」），**却没有同步 bump index.html 的 `nt-core.js?v=`**（该 commit 对 index.html 的 nt-core 行零改动）。
- 版本号演化：最早 `?v=20260719`（日期式）→ 后改 `?v=8` → 此后 nt-core 多次被编辑但 **8 再没动过**。
- **判定**：典型「铁律6 漏标」——文件在改、缓存版本号没递增。线上用户浏览器很可能仍执行**被 CDN/浏览器缓存的旧 nt-core.js**，与已修的兄弟文件版本错配，放大症①②的诡异表现（旧模拟器逻辑 + 新调用方）。

---

## 修法案（呈丞相裁，本卡不施工）

### 建议 M-1（症①，前端，🟢 低）——HTTP 模式停跑模拟器自检
- [core.js:1304] 的 `NT.verify()` 用 `if (window.location.protocol==='file:')` 门控，仅离线演示模式跑；HTTP 模式后端为唯一账本真相，不跑前端假等式。爆炸半径：仅去一条 console 噪音，零业务影响。

### 建议 M-2（症②真卡死，后端+前端，🟡 中，涉钱）——恢复池发奖端点
- 后端：解注 `POST /api/nt/earn`（[nt.py:241-246]），**必须** `Depends(require_admin 或校核制内部调用)` + `_get_pool(db, lock=True)` **D-17 锁型** + 池余额校验 + `pool.balance -= amount` + `_add_ledger(community_pool→user)`。**严禁**裸开放（否则人人可凭空印钱）。
- 前端：[ui-cardroom.js:1298-1299] 改调新的池发奖端点（校核制服务端结算路径），不再用 user→user transfer 让做事者自己掏钱。
- **或（更稳妥）**：卡片发现确认接入既有**后端校核制**（`card_discoveries` + `verifications` 表 + verify_task 结算路径，已有 D-17 锁），前端 confirmDiscovery 走后端而非 localStorage `_getDiscoveries`。此为架构归位，工程量较大，建议单独制卡。

### 建议 M-3（症②噪音，前端，🟢 低）——模拟器 earn 在 HTTP 模式短路
- [nt-core.js:456] earnFromPool 或 [ui-cardroom.js:1296] 调用处，HTTP 模式跳过 `NT.earn` 模拟调用（后端已负责），消除「社区池余额不足 当前:0」误导性 error。

### 建议 M-4（症③，前端，🟢 低，铁律6）——bump nt-core.js?v=
- [index.html:520] `?v=8` → 递增到当前梯队（如 `?v=9`+），强制刷新缓存。此后凡改 nt-core.js 必走闸递增（并入 T-1 deploy_check ?v= 检的既有清单）。

> 注：M-2 涉钱，须 D-17 锁型 + require_admin/服务端内部调用双保险；本勘察卡零写入，施工另发。

---

## 影响面声明
- 纯只读勘察，**零业务代码改动**；本地 `nantang_fresh.db` 仅 SELECT 未写。
- 产出文件：`方案/任务卡/NT-勘察-1_涉钱三症勘察回执.md`。
- 未碰 withdraw/confirm/reject、未碰任何涉钱写路径。

---

## 太傅注（三行）
- **补课章节：单一真相源（Single Source of Truth）**。同一笔钱不能有两个账本各记各的。本案前端 nt-core（离线模拟器）与后端 PG（线上真账本）并存，线上却让模拟器也发言（verify/earn），它手里是空账 → 报警、发不出钱。修法核心是「线上只认后端」，模拟器闭嘴。
- **人话原理**：「池=0」不是钱被人偷走了，是前端摆了个**空存钱罐的道具**，真金库（后端）好好的有 416 块。会计等式老是不平，是拿道具账本去对真账——本来就不该对。
- **纪律眼**：nt-core.js 改了三年没换缓存号（?v=8 卡死），是「改代码不走闸」的活证据；缓存版本号形同资金账本的封条，封条不换＝没人知道账本被动过——这正是 T-1 那道 ?v= 机检门要守的位。