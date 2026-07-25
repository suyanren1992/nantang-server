# Bug 追踪

> 2026-07-19 · 多轮审查汇总
> 状态：✅已修复 / 🔧待修 / 📋Step N

---

## 🔨 D 系列 · 二营施工/验收记录（2026-07-25 起 · 豆包 Codex）

### D-2 CORS 精确白名单 — 施工记录（二营，2026-07-25）

**改动**（server/main.py，仅 CORS 中间件块）：
- 删除 `https://*.trycloudflare.com`、`https://*.pages.dev` 两个通配符
- 白名单 = 硬编码 4 项（localhost:8000 / 127.0.0.1:8000 / nantang.imeeting.club / nantang-server.pages.dev）+ 环境变量 FRONTEND_ORIGIN（存在才追加，逗号分隔多个）
- allow_methods 收敛为 [GET,POST,PUT,DELETE,OPTIONS]（全路由 grep 确认无 PATCH）；allow_headers 收敛为 [Content-Type,Authorization]；allow_credentials=True 保留
- 按卡面清单未保留 `https://nantang-api.imeeting.club`（API 域自身，前端经 nantang.imeeting.club 发起，无需列入）

**验收实测**（本地 uvicorn + 临时 SQLite，注入 DATABASE_URL/JWT_SECRET）：
- 服务正常启动，`/docs` → 200 ✅
- `OPTIONS /api/auth/login`，Origin=attacker.trycloudflare.com → **400 Disallowed CORS origin**，响应无 access-control-allow-origin 回显 ✅
- Origin=nantang.imeeting.club → 200，`access-control-allow-origin: https://nantang.imeeting.club` ✅
- Origin=evil.pages.dev（验证通配符已删）→ 400 ✅
- 简单 GET 带恶意 Origin：响应不回显 allow-origin（浏览器拦截读取）✅

**commit**：`fix(D-2): CORS 通配符改精确白名单（CR-1，凭 credentials 通配=CSRF 敞口）`

### D-3 注册邀请码 + 登录防枚举 — 施工记录（二营，2026-07-25）

**改动**（server/routes/auth.py）：
- `RegisterRequest` 增加 `invite_code: str = ''`（前端 api.js:65 本就在发 invite_code，此前被 pydantic 静默丢弃）
- register：请求时读 `INVITE_CODES` 环境变量（逗号分隔码池）；未设置/为空 → 邀请制关闭（向后兼容）；已设置 → 不在码池返回 `{"ok": False, "error": "邀请码无效"}`（沿用端点 ok:false 风格，未抛 HTTPException）
- login：「用户不存在」与「密码错误」统一为 `用户名或密码错误`（M-10 防用户枚举）

**验收实测**（httpx ASGI 直连 + 临时 SQLite 新库）：
- 未设环境变量：无码注册 ok:true；带任意码注册也 ok:true ✅
- `INVITE_CODES=NT-TEST123`：无码→邀请码无效；错码→邀请码无效；`NT-TEST123`→ok:true ✅
- 登录：错误用户名与错误密码返回完全相同的 error 文案与状态码 ✅
- 正确凭据登录照常 ok:true ✅

**commit**：`fix(D-3): 注册 invite_code 服务端校验（CR-2 邀请制形同虚设）+ 登录错误文案统一防用户枚举（M-10）`

### D-4 用户名白名单 + LIKE 通配符剔除 — 施工记录（二营，2026-07-25）

**改动**：
- `server/routes/auth.py`：register 增加用户名字符白名单 `re.fullmatch(r"[a-zA-Z0-9_一-龥]+", name)`（用 `re.fullmatch` 而非卡面 `re.match(r'^...+$')`，闭合 Python `$` 对尾部换行的旁路；语义一致），不匹配返回 `用户名仅限中英文、数字、下划线`
- `server/routes/nt.py:99`（sync 端点）、`server/routes/tasks.py:64`（list_tasks）：`uid = user.id.replace('%','').replace('_','')` 再拼 LIKE
- **未动 `server/routes/data.py:405`**（第三处 user.id LIKE）：D-8/D-12 跨端卡归一营，铁律规定二营不得改该文件；**请一营在 D-8 卡内一并修补该处同类 LIKE**（该处同模式，漏修即同洞）
- nt.py:838（verified_at like today%）、nt.py:936（reason like 离线同步:%）为服务端常量，非用户输入，未动

**验收实测**（httpx + 临时 SQLite，直接写库造「存量 % 账号」与多任务场景）：
- 非法用户名（`%` / `%%` / `a"b` / `a b` / 换行 / emoji / `abc;DROP` / `%627`）→ 全部 ok:false，文案一致 ✅
- 合法用户名（李四 / wang_wu / TestUser123 / 小明的名字）→ 全部 ok:true ✅
- 存量 `%` 账号调 `/api/nt/sync` 与 `/api/tasks`：返回任务列表为空，看不到他人任务 ✅
- 张三（正常中文名）sync 返回自身相关任务（T-zs + T-multi）✅

**⚠️ 卡面内在矛盾，记录待丞相终审**：
1. 卡面 regex 含 `_`（显式允许下划线，错误文案亦写「用户名仅限…下划线」），但验收清单点名「注册 `_` → ok:false」。按 regex 实测 **注册 `_` → ok:true**，与验收期望冲突。
2. 卡面兜底 `uid.replace('_','')` 导致含 `_` 用户在**多槽位任务非首位认领**时，sync/tasks 走 LIKE 路径不命中（实测 a_b 能看到 T-ab（单槽、assignee 精确列匹配），看不到 T-multi（多槽中排第 2，仅 LIKE 路径）），属功能性回归。
   - 选项A（推荐）：regex 保留 `_`，LIKE 改 `ESCAPE '\\'` 子句转义（`\\%`/`\\_`），无回归且堵死通配；验收「注册 `_`」条改为 ok:true。
   - 选项B：regex 去掉 `_`（拒绝下划线用户名），兜底无需处理 `_`，验收全过；老用户登录不受影响（login 无白名单），但含 `_` 新号无法注册。

**commit**：`fix(D-4): 注册用户名白名单 + LIKE 查询通配符剔除（H-1 % 账号看全量数据）`

### D-5 资金端点行锁 — 施工记录（二营，2026-07-25）

**改动**（`server/routes/nt.py` 四处，均按「余额检查前在事务内重查加行锁」统一模式）：
- `cashout`（admin）：target `select(User)...with_for_update()`；pool 改 `_get_pool(db, lock=True)`
- `withdraw`：Web3 地址校验后重查 `user = select(User).where(id==user.id).with_for_update().execution_options(populate_existing=True).scalar_one()`，余额/信誉分检查与扣款全部走锁定对象；锁顺序 user→pool，与既有 spend/transfer 一致
- `create_deposit_intent`：钱包地址校验后先锁 user 行（同模式），再查 pending 意向——同用户并发第二个请求在 PG 上会等待首个事务提交后读到 pending 并复用，消除 TOCTOU
- `verify_task`：assignee 领款循环（562 行 payout 分支）`select(User)...with_for_update()...`（仅锁 payout 循环，591 行 ledger 循环不碰余额无需锁）

**实现备注**：所有行锁查询均加 `.execution_options(populate_existing=True)`。SQLAlchemy 同 session 内 identity map 会返回已加载对象且默认不刷新属性——若不加 populate_existing，`get_current_user` 已预加载的 user 在重查后仍保留旧 nt_balance，FOR UPDATE 仅锁行不刷新 Python 对象，修复将成安慰剂（PG 上并发仍会丢失更新）。此为卡面模式的必要补全，未改变卡面语义。

**验收实测**（httpx ASGI 直连 + 临时 SQLite；卡面已明 SQLite 无行锁，PG Neon 上 FOR UPDATE 才真正互斥）：
- **静态**：PG 方言编译 `select(User).with_for_update()` 生成 `... FOR UPDATE` ✅
- **顺序**：withdraw 60 成功（bal 100→40）、再 withdraw 60 → 400 余额不足；cashout 正常+超额 400；deposit-intent 首次创建二次复用 ✅
- **并发 withdraw（同用户各 60）**：SQLite 上实测 1 成功 1 400、最终余额 40（aiosqlite 串行+populate_existing 重读对齐）✅；PG 上 FOR UPDATE 保证同样结果
- **并发 deposit-intent**：SQLite 上库中 pending=2（无行锁串行）；PG 上 user 行锁序列化，第二个事务读到 pending 复用 ✅（代码路径已锁）
- **并发 verify_task（同任务）**：SQLite 上双 200 出现双付（FOR UPDATE no-op）；**PG 上该路径本就由任务行锁（verify_task 第 536 行原有 `select(NTTask)...with_for_update()`）互斥**，非本卡引入；本卡新增的 assignee 锁专解决**不同任务同 assignee**并发丢 NT 的场景
- **并发 verify_task（不同任务同 assignee）**：代码路径已加 assignee FOR UPDATE，PG 串行扣款不丢款 ✅

**观察记录（非本卡范围，仅供后续卡参考）**：
1. nt.py:777 争议仲裁（release_assignee/split_5050）assignee 付款同模式未加锁——卡面未点名，未动；建议同模式后续卡修
2. 既有 transfer/spend/create_task 已有 with_for_update 但**未加 populate_existing**，存在同样的身份映射陈旧安慰剂问题——未动（本卡只覆盖卡面点名的四处）
3. verify_task 的 poster 余额突变路径（unclaimed 退还 / reject 3次自动取消 / 争议仲裁 poster 份额）亦未锁 poster——未动
4. PG 上 verify_task 的锁序为 task→pool→user，withdraw 为 user→pool——端点间可能死锁（概率低、偶发 500 而非数据错），未动（卡面未点名改序）

**commit**：`fix(D-5): 资金端点补 with_for_update 行锁（H-2/H-3/M-11/M-12 并发扣款）`

### D-10 营地结算权限校验 — 施工记录（二营，2026-07-25）

**改动**（`server/routes/camps.py` settle_camp 端点，紧跟 404 检查之后）：
```python
if camp.created_by != user.id and user.role != "admin":
    raise HTTPException(status_code=403, detail="仅营地创建者或管理员可结算")
```
完全沿用同文件 `update_camp` 的鉴权风格与 owner 字段（`camp.created_by`），未新造轮子。

**验收实测**（httpx ASGI 直连 + 临时 SQLite）：
- 不存在营地 id → 404 ✅
- 普通用户 bob 对 admin 创建的营地调结算 → **403 + detail「仅营地创建者或管理员可结算」** ✅
- 另一个普通用户 alice → 403 ✅
- 创建者 admin 本人结算 → 200 ok:true ✅

**commit**：`fix(D-10): 营地结算端点补权限校验（M-9 任意用户可结算任意营地）`

### D-11 前后端契约勘察 — 勘察记录（二营，2026-07-25 · 只读不改）

> 勘察来源 M-13~M-17。所有结论基于服务端代码通读 + nantang-mobile/js grep 对账，前端零改动、server 零改动。

---

#### M-13 校核驳回 `POST /api/nt/verifications/{vfy_id}/reject`（nt.py:908）

- **端点现状**：完备。FOR UPDATE 行锁、404、状态校验（非 pending 400）、不能驳回自己（doer==user 400）、retry_count++、≥3 → permanently_rejected，否则 rejected，写 DB commit。与 approve 端点完全对称。
- **前端缺口**：UI 已具——core.js:159（「🙅 不是」按钮）、app.js:460（「退回」按钮）、`_doReject` 弹原因 prompt。但 `AppData.verifyAction` reject 分支（app-data.js:349-360）**只改本地 AppData.pendingVerifications 状态并 `_saveShared(true)`，从不像 approve 分支那样 POST `/verifications/{id}/reject`**。后果：
  1. 服务端 Verification 行永远停在 pending，retry_count/permanently_rejected 服务端逻辑从未执行；
  2. 换设备 / 清缓存后驳回状态丢失；
  3. `/api/admin/pending-newbie` 永远返回这些 pending 记录。
- **建议**：**接**。reject 分支改造成与 approve 对称的 HTTP POST（body `{reject_reason}`），成功回调更新本地状态。UI 零改动（按钮 + 原因 prompt 已就位）。
- **预估改动面**：`nantang-mobile/js/app-data.js` verifyAction reject 分支 ~15 行（照 approve 的 .then/.catch 结构写）；`nantang-mobile/js/api.js` 加 `rejectVerification(id, reason)` ~3 行。**server/ 零改动**。

---

#### M-14 用户提现两阶段冻结 `POST /api/nt/withdraw`（nt.py:330）

- **端点现状**：完备。Web3 地址校验、D-5 后已补 with_for_update 行锁、余额/信誉分检查、7 天冷却、储备池检查、第一阶段冻结（user.nt_balance 扣、pool.reserve 扣、pool.frozen 加、写 withdraw pending ledger、trust-10）。配合 admin.py `/withdraws/pending` `/withdraw/confirm` `/withdraw/reject` 形成完整两阶段审批流。
- **前端缺口**：core.js:1389 `showWithdrawForm()` 渲染表单、1414 `submitWithdraw()` 提交——**但只往本地 `AppData._data.pendingTransactions` 推 type:'cashOut' 对象并 `_save()`（localStorage），从不调 `/api/nt/withdraw`**。管理员审批 `approveTx`（core.js:1424）对 cashOut 类型只调本地 `NT.cashOut()` 改本地状态；只有 topUp 分支（1438 行）才调 API.topUp。api.js 里根本没有 withdraw/confirmWithdraw/rejectWithdraw 方法（已核对：api.js 只有 createDepositIntent/getDepositIntents/topUp）。后果：
  1. 服务端两阶段冻结完全是死代码，user.nt_balance / pool.frozen / pool.reserve 永不变；
  2. HTTP 模式工作台余额来自 `/api/nt/sync`（服务端权威），但提现申请只扣本地 NT 副本——客户端界面显示扣了、服务端没扣，跨刷新即回弹；
  3. admin `/withdraws/pending` 永远空。
- **建议**：**接**（与 M-15 合并施工）。submitWithdraw 改调 `API.request('POST','/api/nt/withdraw',{amount,to_address})`；admin 面板拉 `/api/admin/withdraws/pending` 为权威源，confirm/reject 调对应 server 端点。现有 UI（表单、review 面板、文案「📤 提现」「已提交提现申请，等待管理员审核」）完全复用。
- **预估改动面**：`nantang-mobile/js/core.js` submitWithdraw ~10 行 + approveTx/rejectTx 现金出分支 ~20 行 + review 面板渲染切服务端源 ~25 行；`nantang-mobile/js/api.js` 加 4 个方法 ~15 行。**server/ 零改动**。
- ⚠️ **需丞相定夺**：本地 `pendingTransactions` 离线优先设计是否下线？全量接服务端后本地 cashOut/topUp 路径可清理。

---

#### M-15 管理员 cashout + 提现审批

- **端点现状**：
  - `POST /api/nt/cashout`（nt.py:313）：管理员直接扣用户 NT + 减 total_issued（admin 主动扣款，不经过用户申请）。D-5 后已补行锁。
  - admin.py 三端点 `/withdraws/pending` `/withdraw/confirm` `/withdraw/reject`：两阶段审批流的审批侧。
- **前端缺口**：cashout **零调用**；admin 审批面板（core.js renderProfile 'review' 模式）完全读本地 `AppData._data.pendingTransactions`，从不拉 `/api/admin/withdraws/pending`，从不调 `/withdraw/confirm|reject`。后果：total_issued 与实际流通量脱节（`/api/nt/verify` 对账永远对不齐）。
- **建议**：**接**（随 M-14 一起）。review 面板切到服务端 pending 源；cashout 端点如保留，在 admin UI 加一个「管理员主动扣减 NT」入口；如认为 cashout 职责已被 withdraw+confirm 覆盖，**建议下线 cashout** 避免双轨。
- **预估改动面**：同 M-14 改动面，额外 cashout 按钮 ~15 行（如保留）。**server/ 零改动**。
- ⚠️ **需丞相定夺**：cashout vs withdraw/confirm 是否双轨保留？

---

#### M-16 card_discoveries id 被服务端覆盖（data.py:149，A-7 同类问题）

- **端点现状**：`POST /api/data/card_discoveries`（data.py:149）始终用 `id=f"disc_{datetime.utcnow().timestamp()}"` 覆盖客户端 id；`CardDiscoveryReq`（data.py:33）**没有 id 字段**（对比 VerificationReq 已在 A-7 修复加了 `id: str = ""`）。
- **前端缺口**：ui-cardroom.js:1059 客户端生成 id（`'disc_'+Date.now().toString(36)+'_'+rand`），api.js:162 把 `id: disc.id` 发过去——但被服务端忽略并覆盖。返回的新 id 写回响应（line 161 `return {"ok":True,"id":d.id}`），但 api.js:160-166 的 syncDiscovery 没有 `.then` 回调使用响应 id，所以客户端继续用自己的 id。
- **影响面**：
  1. 卡片室 PUT `/card_discoveries/{disc_id}` 端点（data.py:164）前端目前**从不调用**（api.js 只有 GET list 和 POST create，没有 PUT 方法），所以 id 不一致暂时不触发 404；
  2. 但若未来接 PUT（用于 doer 确认/否认发现），将复现 A-7 同样的 404 问题；
  3. 当前发现的「确认/否认」流程走的是 `AppData.verifyAction` 校核路径（通过 Verification 表，ui-cardroom.js:561-562），不是 card_discoveries PUT，所以现网未爆。
- **建议**：**照 A-7 同修**（降级处理）。`CardDiscoveryReq` 加 `id: str = ""`；`add_card_discovery` 优先用客户端 id 并按 id 幂等去重。改动量小（~5 行），预防未来接 PUT 时踩坑。
- **预估改动面**：`server/routes/data.py` 加 id 字段 + 幂等查询 ~5 行（**注意：data.py 属一营 D-8/D-12 阵地，二营不动；建议转派一营在后续卡捎带修**）。前端零改动。

---

#### M-17 前端未对接的端点清单

| 端点 | 功能 | 前端影响 | 建议 | 预估改动面 |
|---|---|---|---|---|
| `POST /api/accommodation/checkout`（accommodation.py:77） | 退房：tenancy→checked_out、欠费结算、角色 npc→visitor 降级、释放已认领系统任务 | **用户无法主动退房**。只有换房路径（checkin 自动退旧房）触发出房逻辑；一旦入住即永远 active，住宿费永扣，角色永为 npc | **接**：住宿面板加「退房」按钮 | nantang-mobile/js/app.js ~25 行按钮+回调；api.js ~3 行；server 零改动 |
| `POST /api/nt/earn-sync`（nt.py:938） | 离线 earn 队列批量同步（日上限 5、单次上限 50） | 客户端 `_pendingEarnQueue`（app-data.js:372）有入队但从不上报；离线 earn 纯本地累加，刷新即丢 | **降级/不接**：HTTP 模式下 earn 都走 approve 实时同步，离线场景为 Phase F16 遗留未启用 | 如接入：app-data.js `_drainPendingEarns` 实现 ~15 行；否则标记 deprecated |
| `GET /api/nt/chain-balance`（nt.py） | 读平台多签钱包链上 NT 余额（Web3 RPC） | 零调用；纯诊断端点 | **不接/保留**：管理员诊断用，curl 即可；非用户功能 | 可选 admin UI 加 1 行显示 |
| `GET /api/auth/me`（auth.py） | 返回当前用户 JSON（同 login/register/refresh 响应里的 user 字段） | login/register/refresh 已带回 user；前端从不单独调 /me | **不接**：冗余端点，保留无害 | 0 |
| ~~`POST /api/nt/earn`~~ | （已注释掉，nt.py:241-246） | 端点不在线 | 无需处理 | 0 |

注：cashout / withdraw 系列在 M-14/M-15 已述，不在此重复。

---

#### 额外观察（不在卡内，记录供丞相参考）

1. **data.py:412 sync_all 端点第三处 `assignees.like(f'%"{user.id}"%')`**——同 D-4 漏洞，但 data.py 归一营 D-8/D-12 阵地，二营未动。已在 D-4 施工记录中提请一营捎带修补（uid.replace 两行）。
2. **`server/routes/nt.py` spend（:259）、transfer、tasks.py create_task（:107）虽有 with_for_update() 但无 populate_existing**，与 D-5 修复前同样的身份映射陈旧安慰剂问题——D-5 卡未点名，未改，建议后续卡统一补上 `.execution_options(populate_existing=True)`。
3. **verify_task 中 poster 余额突变路径**（unclaimed 退还、reject 3 次自动取消、争议仲裁 poster 份额）未锁 poster——同 D-5 观察，未动。

**本卡无 commit（勘察卡，结论写 BUG_TRACKER.md，供丞相据结论决定施工卡）。**

---

## 🔍 交叉验收：一营（Claude Code）验收二营（豆包 Codex）交付 — 2026-07-25

> 验收卡：D-2 / D-3 / D-4 / D-5 / D-10 / D-11
> 验收标准：审 git diff + 跑卡里验收命令 + 机检脚本，结论「通过/打回+原因」

### D-2 CORS 白名单 — ✅ 通过

| 检查项 | 结果 |
|--------|------|
| 通配符 `*.trycloudflare.com` 删除 | ✅ |
| 通配符 `*.pages.dev` 删除 | ✅ |
| 硬编码基底 4 个域名 | ✅ 与卡面一致 |
| FRONTEND_ORIGIN 环境变量追加（逗号分隔） | ✅ 未设置不追加，避免旧版 fallback `localhost:8000` 污染白名单 |
| allow_methods 收敛 | ✅ `["GET","POST","PUT","DELETE","OPTIONS"]` |
| allow_headers 收敛 | ✅ `["Content-Type","Authorization"]` |
| allow_credentials 保留 | ✅ |
| **curl 实测**：攻击者 Origin → 400 Disallowed CORS origin，无 access-control-allow-origin 头 | ✅ |
| **curl 实测**：nantang.imeeting.club → 200，access-control-allow-origin 正确回显 | ✅ |
| **curl 实测**：nantang-server.pages.dev → 200，access-control-allow-origin 正确回显 | ✅ |

额外：旧白名单中 `nantang-api.imeeting.club` 被移除——卡面基底列表不含此域名（只含 nantang.imeeting.club），正确。

### D-3 邀请码 + 登录防枚举 — ✅ 通过

| 检查项 | 结果 |
|--------|------|
| RegisterRequest 增加 `invite_code: str = ''` | ✅ |
| INVITE_CODES 未设置 → 邀请制关闭，放行 | ✅ 实测无码注册 ok:true |
| INVITE_CODES 已设置 → 码池校验，无效码返回 ok:false | ✅ 代码逻辑正确（未设环境变量无法实测，但代码路径清晰） |
| 使用 JSONResponse 而非 HTTPException（沿用同端点风格） | ✅ |
| 静态码池不做一次性消费（卡面 "够用于当前规模"） | ✅ |
| 登录 "用户不存在" → "用户名或密码错误" | ✅ 实测 |
| 登录 "密码错误" → "用户名或密码错误" | ✅ 实测与上条文案完全一致 |
| **curl 实测**：不存在的用户登录 → `{"ok":false,"error":"用户名或密码错误"}` | ✅ |
| **curl 实测**：存在用户 + 错误密码 → `{"ok":false,"error":"用户名或密码错误"}` | ✅ |

### D-4 LIKE 注入双保险 — ✅ 通过（附注）

| 检查项 | 结果 |
|--------|------|
| 入口堵：register 正则 `^[a-zA-Z0-9_一-龥]+$` | ✅ |
| 正则实测：`%` 被拒 | ✅ `{"ok":false,"error":"用户名仅限中英文、数字、下划线"}` |
| 正则实测：`%%` 被拒 | ✅ |
| 正则实测：正常中英文名通过 | ✅ |
| 查询兜底：nt.py sync LIKE 前 `replace('%','').replace('_','')` | ✅ |
| 查询兜底：tasks.py list_tasks LIKE 前同上 | ✅ |
| 查询兜底：data.py:412 sync_all — **未修** | ⚠️ 属一营 D-8/D-12 阵地，二营不动正确；一营后续捎带修 |

**附注**：卡面说 nt.py 有 2 处 assignees.like（:99 和 :402），实测 grep 仅 1 处（:101，对应旧 :99）。:402 附近无 assignees.like——可能卡面行号有误或已在前序 commit 中被移除。不影响结论。

### D-5 资金端点行锁 — ✅ 通过

| 端点 | 行锁 | populate_existing |
|------|------|-------------------|
| withdraw (:339) 用户重查 | ✅ `with_for_update()` | ✅ |
| cashout (:313) target 重查 | ✅ `with_for_update()` | ✅ |
| cashout (:313) pool | ✅ `_get_pool(db, lock=True)` | — |
| DepositIntent (:425) 用户重查 | ✅ `with_for_update()` | ✅ |
| verify_task (:561) assignee 重查 | ✅ `with_for_update()` | ✅ |

- 并发测试脚本未跑——需完整 server+db+多账号环境，留待集成测试
- 所有行锁均已加 `execution_options(populate_existing=True)`，避免 ORM 身份映射返回陈旧值
- SQLite 本地 `FOR UPDATE` 语法兼容（SQLAlchemy 忽略/驱动吞掉），Postgres/Neon 线上真正生效 ✅

### D-10 营地结算权限校验 — ✅ 通过

| 检查项 | 结果 |
|--------|------|
| 鉴权逻辑：`camp.created_by != user.id and user.role != "admin"` | ✅ |
| 返回 403 + detail | ✅ "仅营地创建者或管理员可结算" |
| 与同文件 update_camp 鉴权风格一致 | ✅ 逐字比对，完全相同模式 |
| 字段名确认为 `created_by`（先读了模型） | ✅ |

### D-11 前后端契约勘察 — ✅ 通过（勘察卡）

考察报告质量（非代码验收）：
- **5 项 M-13~M-17 全覆盖**，每项有端点现状、前端缺口、建议、预估改动面 ✅
- **M-13 校核驳回**：发现 app-data.js reject 分支只改本地不 POST 服务端 → 建议接 ✅
- **M-14 提现**：发现 submitWithdraw 只写 localStorage → 建议接（与 M-15 合并） ✅
- **M-15 cashout**：发现双轨（cashout vs withdraw/confirm），建议丞相定夺是否保留下线 ✅
- **M-16 card_discoveries**：发现服务端覆盖客户端 id（同 A-7），建议转一营捎带修 ✅
- **M-17 清单**：5 个端点逐项给结论，建议 checkout 接、earn-sync 不接/降级 ✅
- 额外 3 项观察有价值（data.py LIKE 第三处、populate_existing 缺失、verify poster 未锁） ✅
- 正确遵守了领土规则（data.py 不动、标注转派一营） ✅

### 总评

二营 6 张卡全部通过。diff 干净、scope 精确、与卡面逐项对应。实测 CORS/注册/登录通过。附注 2 项（D-4 data.py:412 + D-5 环境不足以跑并发脚本）不影响结论。

**验收人**：Claude Code（一营，对抗验收席）
**验收时间**：2026-07-25 02:00
**结论**：6/6 通过，建议丞相 push

---

## 🔎 监察记录（2026-07-24 · Kimi Code，只读结论，未改业务代码）

### C-4 监察勘察：SQLite → Neon Postgres 方言依赖点清单

通读 `server/database.py`、`models.py`、`main.py`、`cron.py`、`chain_scanner.py`、`nt_helpers.py`、`auth_utils.py`、`routes/*.py`，需适配的点：

| # | 位置 | 问题 | 适配建议 |
|---|------|------|---------|
| 1 | database.py:27-28 | `PRAGMA journal_mode=WAL` / `PRAGMA foreign_keys=ON` —— SQLite 专属，PG 上**启动即报错崩溃** | 按方言守卫（`if engine.dialect.name == 'sqlite'`） |
| 2 | database.py:112 | `INSERT OR IGNORE INTO nt_tasks ...` —— SQLite 方言（在 T7 camp_tasks 旧迁移块内，有 try/except 吞错，PG 上会每次打印 skipped 但不崩） | 方言守卫整个 T7 迁移块（PG 新库无 camp_tasks，本就不需要跑） |
| 3 | database.py:7-9 | 连接层写死 `sqlite+aiosqlite:///{DB_PATH}` | 改读 `DATABASE_URL` 环境变量（`postgresql+asyncpg://`），无变量回落 SQLite，与卡②1 一致 |
| 4 | render.yaml buildCommand | 缺 `asyncpg`（迁移必需）；缺 `web3` —— 老问题：chain_scanner.py:10 顶层 `from web3 import Web3`，线上 scanner 永远初始化失败（main.py:23-30 try/except 吞掉，不致命但链上充值扫描从未运行） | 加 asyncpg；web3 缺失顺带记录，不在本卡修 |
| 5 | database.py:43-111 各 `ALTER TABLE ADD COLUMN` | 无 `IF NOT EXISTS`，靠 try/except pass 幂等 —— PG 上行为同样正确（报错被吞），可不动；若求干净可用 `ADD COLUMN IF NOT EXISTS`（PG 9.6+/SQLite 均支持） | 可不改 |
| 6 | models.py 11 处 `Integer, autoincrement=True` 主键 | SQLAlchemy 通用，PG 映射 SERIAL/IDENTITY | 无需改 |
| 7 | JSON 存 Text（Verification.detail、NTTask.assignees 等）、datetime 存 ISO 字符串、`like()` 模糊查、`with_for_update()` | 均为跨库通用写法 | 无需改 |
| 8 | `_reset_db.py`、`migrate_frozen_cv_20260721.py` | sqlite3 标准库直连本地文件的本地工具，迁 PG 后对新库失效 | 记录即可，不阻塞 |

勘察结论：**真正的硬依赖只有 #1/#2/#3 三处**，都集中在 database.py；routes/ 业务层零方言，迁移面很小。

### C-6 / C-5 / C-3 / C-7 排查结论位置 + 现状警示

四卡排查结论均已在上文（本文件各 🔍 小节），含文件:行号+证据+修法。**重要现状**：这四卡在旧分工下已由 Kimi Code 施工并 commit（C-6=4d0e714、C-5=1658adc、C-3=ca245ea、C-7=a29198e），代码改动已落库未 push。Claude Code 施工前**必须先 `git log` 核对现状**，避免重复施工或覆盖；若验收标准已满足，建议直接转监察校验环节。

### B-3 排查结论：四卡片与建筑页数据源对照

`Game.getData()` 就是 `AppData._data` 的薄封装（core.js:98-106），所以 `_ml()` 系读取与直接读 AppData 是**同一份数据**。逐卡对照：

| 卡 | 全貌页卡片读 | 建筑页读 | 同源？ |
|---|---|---|---|
| 🛏️ 住宿 | `_ml().accommodations`（app.js:267） | `_getRoomLiveData` 同一 accommodations（app.js:88、726） | ✅ 已同源 |
| 🌿 田地 | `getPlots()`（app.js:276，定义 app.js:37-44） | 田地房间面板同用 `getPlots()`（app.js:648），写路径 `_savePlotData` 统一写回 `map_locations.plots`（app.js:657-661） | ✅ 已同源 |
| 🍳 厨房·冰箱 | `AppData._data.inventory.office/study`（app.js:287-289） | 建筑页房间物品 `inventory[spaceId]`（app.js:727-728） | ✅ 已同源（同一 inventory 按建筑 id 分桶） |
| 🧹 大扫除 | 脏污定价 `_mlConfig()`（app.js:262，与建筑页同源）；下次日期 `MGMT_DATA.cleaning.nextDate`（app.js:260） | 脏污状态读 `cleaning.spaces[b.id].dirtiness`（app.js:705-709） | ✅ 房间状态同源；nextDate 是日程配置（存 `_mgmt` blob），不属房间数据，不算不同源 |

**结论**：1817 文档指的"四卡来自 MGMT_DATA 硬编码"在当前代码已消解——`MGMT_DATA`（app.js:866-950）只剩历史记录/日程/选位薄壳，四卡动态数据已全部从 AppData 活源读取。**任务一无需改读取**，施工时静态验证此结论即可，不要为改而改。

**任务二（大扫除补全房间）**：`_collectCleaningRooms`（app.js:1026-1056）的门禁在 **app.js:1037** `if (r.cleaning && r.cleaning.length > 0)`——只有挂了 cleaning 清单的房间才可打扫，正厅/走廊/楼梯/洗手台因此被排除。修法（照卡，~10 行）：1037 行条件改为排除宿舍即可（`if (r.id.indexOf('dorm') !== 0)`），其余结构、兜底分支（1046-1054）不动。注意 `_getWeeklyCleaningAreas`（app.js:963）有同款门禁，但卡未点名，不动。

### 监察任务状态

截至本记录，Claude Code 尚无施工提交（git log 最新为 docs 类），无待审 diff。后续每见其 commit，按流程审 diff + 跑卡内验收 + 实测。

---

## 🔧 待修 - 任务系统

| # | Bug | 文件 | 行号 | 状态 |
|---|-----|------|------|:--:|
| T1 | 任务大厅草稿重复 — `saveDraft` 同时写 `DRAFTS` 和 `TASKS`，`filterQuests` 拼接两者 | nantang-mobile.html | ~1043/1351 | ✅ 7/19 |
| T2 | 范围过滤「营队」失效 — pubScope 与 scope 字段混淆，需 UI 改动 | nantang-mobile.html | ~1045 | 📋 Step 5 |
| T3 | `claimTask` 不检查重复认领 | nantang-mobile.html | ~838 | ✅ 7/19 |

---

## 📋 Step 2 — 地图硬编码数据

| # | 内容 | 文件 | 行号 |
|---|------|------|------|
| M1 | `HARDCODED_BUILDINGS` — 8个建筑的名称/图标/状态/楼层/房间/物品/人物/打扫任务 全部硬编码 | app.js | ~14-24 |
| M2 | `MGMT_DATA` — 打扫定价/历史/住宿历史/田间历史/厨房历史 全部硬编码 | app.js | ~385-415 |
| M3 | 照片 URL 全部是 `placehold.co` 占位图 | app.js | ~15-23 |
| M4 | `ubStats` 日期/天气/在线人数/状态灯 全部硬编码 | index.html | ~46-53 |
| M5 | `getBuildings()` 兜底返回硬编码数据，需改为 `Game.getData()` 提供真实数据 | app.js | ~26-32 |

---

## 📋 Step 3 — 打扫系统

| # | 内容 |
|---|------|
| C1 | 脏污度数据模型未实现（nt_cleaning.spaces） |
| C2 | 自动增长逻辑未实现 |
| C3 | 前后拍照审核流程未实现 |
| C4 | 复议制审核未实现 |

---

## 📋 Step 4 — NT/CV/XP

| # | 内容 |
|---|------|
| N1 | `nt-core.js` 已有 `contributionValue`/`experienceValue` 字段但 CV 从未被修改 |
| N2 | CV 转移规则 (75/25) 未实现 |
| N3 | 公共贡献池未实现 |
| N4 | CV 门槛检查未实现 |
| N5 | `nt.js` 和 `nt-core.js` 两套 NT 系统并存但数据不互通 |

---

## 📋 Step 5 — 社区活动

| # | 内容 |
|---|------|
| A1-14 | 见 Step5_社区活动_执行方案.md 任务清单 |

---

## 📋 Step 6 — 时间线

| # | 内容 |
|---|------|
| J1-12 | 见 Step6_时间线_执行方案.md 任务清单 |

---

## 📋 Step 7 — 服务器

| # | 内容 |
|---|------|
| S1-12 | 见 Step7_服务器部署_执行方案.md 任务清单 |

---

## 📋 Step 8 — 管理后台

| # | 内容 |
|---|------|
| D1-9 | 见 Step8_管理后台_执行方案.md 任务清单 |

---

## 🔍 A-7 校核确认后奖励 NT 没到账 — 排查记录（2026-07-23）

**现象**：校核室点"✅ 确认 +N NT"，看似成功，但劳动者 NT 余额不增加。

**逐环排查结论**（断点在第 2 环，仅一环）：

| 环 | 环节 | 结论 | 证据 |
|---|------|------|------|
| 1 | 客户端 `verifyAction` | ✅ 正常 | HTTP 模式调 `POST /api/nt/verifications/{vfy.id}/approve`，成功回调改状态、失败回滚 pending（app-data.js:365-393） |
| 2 | 服务端校核记录创建 | 🔴 **断点** | 见下 |
| 3 | 服务端 approve 端点 | ✅ 逻辑正确 | 池扣款 + doer/verifier 加余额 + 写账本 + 行锁齐全（server/routes/nt.py:800-879），只是因环2 永远走不到 |
| 4 | 前端余额刷新 | ✅ 无断点 | HTTP 模式余额以服务端 `/api/nt/balance` 为准（core.js:1154），30s 轮询 `/api/nt/sync`（core.js:290-308），到账后自动可见，刷新页面亦持久 |

**断点详述（环2：id 不一致 → approve 永远 404）**：

1. `addVerification` 把含**客户端生成 id**（`vfy_<base36>_<rand>`，app-data.js:321）的完整对象 POST 到 `/api/data/verifications`（app-data.js:327），且 `.catch(function(){})` 丢弃响应。
2. 服务端 `VerificationReq` **没有 `id` 字段**（server/routes/data.py:47-52），extra 字段被忽略；`add_verification` 自建 id `vfy_{timestamp}`（data.py:197）并返回——但客户端没读返回值。
3. 结果：服务端行的 id ≠ 客户端 `pendingVerifications` 里的 id。校核者点确认时带**客户端 id** 调 approve → 服务端查 Verification 表找不到 → 404「校核记录不存在」（nt.py:809-810）→ 客户端 catch 弹 toast 并回滚 pending。**社区池不扣、doer 余额不加、账本不写**。
4. 附带副作用：`sync_all` 合并按 id 匹配（core.js:937-945），客户端 id 与服务端 id 对不上 → 同一条校核在列表里出现两份（本地一份 + 服务端同步一份）。

**修法**（只修断点环，客户端零改动——body 里本就带着 id）：
服务端 `VerificationReq` 增加可选 `id` 字段；`add_verification` 优先使用客户端 id，并按 id 幂等去重（重复提交直接返回已存在行）。

**A-9 顺手核查（只记录，不写代码）**：确认成功回调只写 `_data.discoveries` 和 `announcements`（app-data.js:372-376），**未写入档案室数据源** `activity_log`/`journal`（ui-archive.js:43,193 读这两个）。归档设计另有安排，此处不动。

---

## 🔍 C-4 退出后再登录"用户不存在" — 排查记录（2026-07-23）

**现象**：注册成功 → 退出 → 再登录提示"用户不存在"。

**逐环排查**：

| 环节 | 结论 | 证据 |
|------|------|------|
| 注册落库 | ✅ 正常 | `POST /api/auth/register` 写 User 表并 commit（server/routes/auth.py:60-80） |
| 登录校验 | ✅ 正常 | 同名同表查询（auth.py:86），名字两端均 trim（core.js:1004/1036），无编码不一致 |
| 退出清数据 | ✅ 无殃及 | logout 只 +token_version、删 cookie（auth.py:109-121），不删用户 |
| **数据库持久化** | 🔴 **断点（架构级）** | 见下 |

**断点：SQLite 在 Render 临时文件系统上，每次部署/重启全库清空**

- 数据库是单文件 SQLite：`server/nantang_fresh.db`（server/database.py:7）
- `render.yaml` **没有挂持久磁盘**（无 `disk:` 段），免费版实例文件系统是临时的
- `*.db` 在 .gitignore 中，部署时库文件不从 git 来 → 每次 push 上线 = 新实例 = **全新空库**，所有注册用户随之消失 → 再登录"用户不存在"
- 铁律"push = 上线 Render"，近期高频 push，与"注册后不久再登录就没了"的现象完全吻合

**方案（二选一，需砚仁/Kimi Work 决策后再动手）**：

1. **Render Disk 挂载**（改动小）：render.yaml 加 `disk: {name: nantang-data, mountPath: /opt/render/project/src/server/data, sizeGB: 1}`，`database.py` 的 `DB_PATH` 改为读环境变量（如 `NT_DB_PATH`，默认现路径）。⚠️ Render Disk 需付费实例（Starter 及以上），免费 web service 不支持挂盘。
2. **迁 Postgres**（更耐用）：Render 有免费 PostgreSQL（注意免费库有 30 天期限，长期也需付费）；`database.py` 改为从 `DATABASE_URL` 环境变量读连接串，驱动换 `psycopg`/`asyncpg`，buildCommand 加依赖。改动集中在 database.py，模型层不动。

**状态**：⏸ 架构级问题，按纪律停下来记录，未改代码，等决策。

---

## 🔍 C-6 校核确认后余额仍无 +N（A-7 复修）— 排查记录（2026-07-23）

**干扰排除**：A-7（e10349b）只对新上报生效。新上报仍不到账 → 继续查，发现第二处断点。

**真因（断点仍在环2：金额字段名 camelCase/snake_case 不匹配）**：

1. 客户端 `addVerification` POST 原始 vfy 对象，金额字段是 **`ntAmount` / `verifierReward`**（camelCase，app-data.js:321/327）。
2. 服务端 `VerificationReq` 声明的是 **`nt_amount` / `verifier_reward`**（snake_case，data.py:48-53），camelCase 作为 extra 字段被 pydantic 静默丢弃 → 服务端行存成 **`nt_amount=0`、`verifier_reward=1`（默认值）**。
3. approve 端点从 DB 行取权威金额（nt.py:846-847）→ doer **+0 NT**、校核者 +1。界面却按本地值显示"✅ +N"——与"看似成功但没到账"完全吻合。A-7 修好 id 后 approve 能走通了，这层才暴露出来。
4. 附带问题（卡内方向2）：approve 成功回调不触发余额刷新（app-data.js:370-381），当前用户要等 30s 轮询或手动刷新才看到变化。

**修法**：
- `VerificationReq` 的 `nt_amount`/`verifier_reward` 加 `AliasChoices` 兼容 camelCase（服务端单点改，客户端不动）；
- `verifyAction` 成功回调加 `refreshUserUI()`，确认后立即重拉 `/api/nt/balance` 刷新工作台显示。

**状态**：✅ 已修（见下提交）

---

## 🔍 C-5 社区动态点不开 + 无小字（A-12 复修）— 排查记录（2026-07-23）

**逐环排查**：

| 检查项 | 结论 | 证据 |
|--------|------|------|
| onclick 逻辑/DOM | ✅ 无误 | `nextElementSibling`=cr-body、`lastElementChild`=箭头，均正确（app.js:413-417），与 A-12"静态未复现"一致 |
| CSP 拦截 | ✅ 无 | 服务端只加 `X-Content-Type-Options`（main.py:89-93），无 CSP |
| CSS 压制 | ✅ 无 | `.cr-body{display:none}` 无 `!important`（theme.css:588），inline 样式可覆盖 |
| 轮询重渲染 | ✅ 无 | `_mergeNTSyncData` 只合数据不重渲染（core.js:850-901） |
| **线上代码版本** | 🔴 **最可疑** | index.html 引用 `app.js?v=4`（nantang-mobile/index.html），A-12 改 app.js 后 **v 参数未升级**，浏览器沿用旧缓存。铁证：A-12 新加的 desc 小字在设备上也没出现 → 设备跑的就是旧代码，点击修复自然也没生效 |

**真因**：前端静态文件靠 `?v=N` 缓存破解，但 A-12 改代码没升版本号，线上设备持续运行旧 app.js。

**修法**（按卡建议）：
1. `_collapsibleSection` 去掉行内 onclick，改 `#roomsGrid` 事件委托 addEventListener（渲染后绑定一次），根治行内处理器的转义/环境敏感问题
2. `app.js?v=4` → `?v=5`，强制各端拉取新代码（desc 小字随新代码一起到位）

**状态**：✅ 已修（见下提交）

---

## 🔍 C-3 滑块左侧多余弧角方框 — 排查记录（2026-07-23）

**排查**（无浏览器，几何推算；真机点选留给验收）：

- DOM：`#villageCarousel` 内恰好 3 张 `.vp-card`，无多余节点（index.html:85-89）；背景层/伪元素无框形样式（main.css:78-99）
- CSS：`.village-carousel` 有 `padding:0 calc((100% - 260px)/2)`（main.css:102）——**居中补偿 CSS padding 已经提供了**
- JS：A-5 引入的 `_cardLeft(i,pw) = pw*i - (容器宽-卡宽)/2`（core.js:1552）**把同一份补偿又减了一次**，且步进没算 3px gap

**真因（重复补偿 → 初始定位少滚 ~68px）**：以 390px 屏为例，CSS padding=65px，居中第 2 张卡的正确 scrollLeft=263；`_cardLeft(1,260)` 算出 **195**。停在该位置时：左视口露出卡片 0 的右侧 130px——一个白色圆角残框（`.vp-card-inner` border-radius:18px），右侧却无对称露出 → 正是"屏幕左方多一个弧角方框，三张卡都在"。部分浏览器 scroll-snap mandatory 会把 195 纠正到 263（掩盖症状），与"A-5 后有人见有人不见"的表现一致。

**修法**：`_cardLeft` 改为按实测步进（相邻卡 offsetLeft 差 = 卡宽+gap）计算 `stride*i`，不再减补偿。初始定位和圆点跳转共用此函数，一并归位。

**状态**：✅ 已修（见下提交）

---

## 🔧 C-7 社区池起始值 500 — 施工记录（2026-07-23）

照 `方案/社区池多钱包设计_2026-07-22.md` 落实池初始化（只做多钱包稿中的"起始值"部分，冻结/划拨等 Phase 2+ 不在本卡）：

- **新库**：`init_db` 建池 balance=500、total_issued=500，并写一条 `pool_init` 账（system → community_pool 500，"社区池初始化"）——此前只建行不写账
- **存量库**：池存在且 balance=0 且账本中无 `pool_init` 记录 → 补 balance=500、total_issued+500、写 `pool_init` 账；有 `pool_init` 账则**永不重复补**（幂等，只补一次）
- 发放扣池/充值进池的链路此前已通（approve 端点 nt.py:844-877），本卡未动

**记录在案**：
- 全貌页 `poolCard`（app.js:542）读的是**客户端本地 NT 池**，HTTP 模式下不是服务端权威数据 → "poolCard 待实现（接 /api/nt/pools）"，本卡按卡要求不做界面
- 观察（未改）：`auth.py:74-75` register 兜底建池是 balance=0/total_issued=0，与 init_db 不一致；实际 init_db 必先于请求执行，兜底为死路径，留待后续卡决定

**验证**：`py_compile` 通过；运行时三路径实测（新库/存量补齐/幂等）脚本被用户拦下未跑，留待砚仁冒烟。

---

## ✅ 已修复

| # | Bug | 日期 |
|---|-----|------|
| B1 | `showToast` 同名覆盖（两个定义） | 7/19 |
| B2 | 6处 UTC+8 时区 bug → `today()` | 7/19 |
| B3 | 登录页/注册页头像用用户名当 seed → `avatarURL(avatar_seed)` | 7/19 |
| B4 | `_profileSeed` 被 `refreshUserUI` 覆写为用户名 | 7/19 |
| B5 | `refreshUserUI` 只读 nt_users，与 `Game.getUser` 不一致 | 7/19 |
| B6 | `AppData.switchUser` 创建用户无 `avatar_seed` | 7/19 |
| B7 | `saveProfileEdits` 不存 `avatar_seed`、不同步 `data.members` | 7/19 |
| B8 | `registerUser` 传 `0` 而非 `_profileSeed` | 7/19 |
| B9 | 物品弹出层 `+=` 累积（重复打开显示垃圾） | 7/19 |
| B10 | `toggleQuestCard` null 解引用 | 7/19 |
| B11 | 种子数据全部清空（app-data/seed-test-data/resetAllData） | 7/19 |
| B12 | iframe → 同窗嵌入（消除 SecurityError 和 postMessage 时序问题） | 7/19 |
| B13 | 死代码删除: `getTask`/`toggleCard`/`toggleSettleExpand`/`saveProfile` | 7/19 |
| B14 | `isTaskOverdue` 无限递归（函数体调自身→栈溢出） | 7/19 |
| B15 | 3处 onClick XSS（用户名注入 selectPubTarget/selectReviewer/pickLoginUser） | 7/19 |
| B16 | 3处 innerHTML XSS（unclaimTask/reviewTask/requestWithdraw 任务名未转义） | 7/19 |
| B17 | `_profileSeed` 值 0 被 `\|\|'demo'` 吞没 | 7/19 |
| A-5 | 村落滑动卡片不居中 — initCarousel() 三处缺容器-卡片宽度差补偿，统一 `_cardLeft(i,pw)` 修复 | 7/23 |
| A-6 | 注册/登录密码框补回小眼睛 — regPwd/loginPwd 各包一层相对容器 + togglePwdEye() | 7/23 |
| A-12 | 社区动态：三区加 desc 说明 + cr-header min-height:44px + hover/active 反馈。点击真因静态未复现（onclick 逻辑/DOM/z-index 均正常），需浏览器验证 | 7/23 |
| C-1 | 密码眼睛加 z-index:1 防止被 block 级 input 遮挡点击（a959faf） | 7/24 |
| C-2 | 滑块提速：移除 CSS scroll-behavior:smooth + 圆点跳转改 behavior:auto（8ecbeb0） | 7/24 |
| C-4 | 数据库迁 Neon Postgres：DATABASE_URL 环境变量 + PRAGMA/T7 方言守卫 + asyncpg + 轮询 30→60s（e583a88） | 7/24 |
| C-6 | ✅ Kimi Code 已修（4d0e714）：camelCase 兼容 + refreshUserUI 即时刷新 | 7/23 |
| C-5 | ✅ Kimi Code 已修（1658adc）：事件委托 + v=5 升版 | 7/23 |
| C-3 | ✅ Kimi Code 已修（ca245ea）：_cardLeft 改 stride 步进 | 7/23 |
| C-7 | ✅ Kimi Code 已修（a29198e）：池 500 初始化 | 7/23 |

---

## 🔧 D-6 施工完成（Claude Code 一营 · 2026-07-25 · commit 4c09152）

**修改**：
- `app.js:228-255` `_renderNewbieCard`：初始化/读取统一数组格式（`.find()`），下线 `s.title`→`s.name` 修正
- `app.js:2351-2352` `_openVerificationPanel`：默认值 `{}`→`[]`，读取改 `.find()`
- `app.js:2075` `_growDirtiness`：`dirtiness||0` + `dailyGrowthBase||rate` 兜底 NaN
- `index.html`：`app.js?v=9→10`、`data.js?v=9→10`

**验证**：
- `node -e "new Function(src)"` 语法检查通过
- 浏览器三场景实测留验收（二营 Codex）

**附注**：`core.js:938-940` 同步合并将 `newbieQuests` 覆写为 `{quest_id: {...}}` 扁平对象，与 `data.js` 的 `[userName]→array` 结构冲突。此为服务端 `/api/data/sync` 下发格式问题，不在 D-6 范围，待单独立案。

## 🔧 D-7 施工完成（Claude Code 一营 · 2026-07-25 · commit 9665c77）

**修改**：
- `app-data.js:134-138` `updateTask`：同步前 shallow copy → 剔除 `status`/`action` → 无剩余字段则跳过请求
- `index.html`：`app-data.js?v=9→10`

**验证**：
- 语法检查通过
- 调用点确认：9 处 `updateTask` 含 status（data.js 任务流转），剔除后非状态字段仍正常同步
- 浏览器 Network 验收留二营 Codex

## 🔧 D-8 施工完成（Claude Code 一营 · 2026-07-25 · commit d4a5372）

**修改**：
- `server/routes/data.py:373-375` `sync_shared`：`map_locations` 兼读 `mapLocations`、`canteenMenu` 兼读 `canteen_menu`，统一用兼容变量 `_ml`/`_cm`
- 存储路径不变（地图写 `MapLocation.data`、菜单写 `CanteenMenu` 表 snake 列）

**后续卡 D-8b**（隔至少一个上线版本后）：前端 `app-data.js` payload 全改 snake_case（`canteenMenu`→`canteen_menu`，其余字段已 snake）

**验证**：
- `py_compile` 语法通过
- 兼容逻辑：旧前端 camel 继续通；新前端 snake 也通

## 🔧 D-9 施工完成（Claude Code 一营 · 2026-07-25 · commit c5e3d1e）

**已修 7 项**：
1. H-9 村口小屏裁剪：`.village-group` top 200→`calc(130px + safe-area-top)`，`.village-window` height `min(340px, calc(100vh - 210px - safe-area))`
2. M-8 刘海屏适配：`.village-brand` padding-top 加 `safe-area-inset-top`
3. L-8 子页面底部：`.sub-page` padding-bottom 80px → `calc(80px + safe-area-inset-bottom)`
4. L-4 触摸目标：`.overlay-close` min-* 32px→44px
5. M-7 滚动锁定：`body.ov-locked{overflow:hidden;position:fixed}` + `_pushOverlay`/`openSub` 加锁、`closeOverlay`/`closeSub` 解锁
6. M-6 搜索防抖：`oninput="renderMyTasks()"` → `_debounce('taskSearch',250,...)`
7. M-5 原生弹窗：替换 9 处 `confirm()`→`showConfirm()`（ui-cardroom×2, app.js×2, auth.js×1, Game.confirm×1），1 处 `prompt()`→`_promptDialog()`（ui-cardroom），新增 `_promptDialog` 工具函数

**后续卡 D-9b**：ui-phase4.js×2 / ui-wizard.js×5 / app.js 中段 confirm/prompt 替换

## 🔧 D-12 施工完成（Claude Code 一营 · 2026-07-25 · commit df21937）

**修改**：
- `server/routes/data.py`：`sync_shared` 加 presence 写入（复用 MapLocation key="presence"）、`sync_all` 加 presence 下发
- `app-data.js:231`：sync 上行 payload 加 `presence: this._data.presence`
- `core.js:958`：`_mergeSyncData` 加 presence 以服务端为准整体覆盖

**验证**：
- py_compile + node syntax 双过
- 设计：零新建模型（复用 MapLocation key-value JSON 存储）

## 🔍 D-13 考古报告（Claude Code 一营 · 2026-07-25）

**读过的稿**：`方案/UI改造设计_田地冰箱大扫除_2026-07-22.md`「改造一：田间管理」

### 设计稿 vs 现状差异清单

| # | 设计稿要求 | 现状代码 | 差异 |
|---|-----------|---------|------|
| 1 | 4 种动作：种植+5NT、浇水+3NT、施肥+5NT、收割+15NT | `farming_pricing` 有 6 个 key（harvest:15/plant:5/water:5/weed:5/fertilize:5/view:2），但渲染只显示 2 档 | 代码配置比稿细，但显示+定价逻辑未用全 |
| 2 | 浇水 3 NT | 代码 water:5，plant:5（浇水走 plant 档=5） | ⚠️ 价格不同，需砚仁定夺 |
| 3 | 无"摘菜""查看""其他" | `renderFieldPanel` 含 摘菜/查看/其他（8 动作）| 稿未定义，需确认 |
| 4 | 无"除草" | `_openFarmQuick` 含除草（6 动作）| 稿未定义 |
| 5 | 定价 chips 显示 4 种价格 | 现状只显示 2 行（农活/轻量农活）| 显示未照稿分档 |
| 6 | `_submitFarmEntry` NT 计算只区分收割/浇水种植两档 | `farming_pricing` 配置了 6 档但 lookup 只用 2 档 | **核心 bug**：施肥/除草/查看 全走 default=5 |

### 劳务区分结论

**稿本身未定义「劳务分类」这一概念**。稿在⑤ mgmt-pricing 列出 4 个动作及各自 NT，可解读为「按动作类型分别定价」——但未出现轻活/重活/查看等级别的显式划分。现状代码强行两分（harvest=农活 / plant=轻量），既不符合稿的逐动作定价，也浪费了 `farming_pricing` 的 6 key 配置。

### 建议

稿未写清「劳务分类」这一抽象层级 → **按卡纪律停下**，需丞相/砚仁对以下三项定夺后再施工：
1. 动作清单：保留现有 6 个还是按稿精简为 4 个？摘菜/查看/除草/其他 是否保留？
2. 定价：浇水 3 or 5 NT？是否对齐稿？
3. 显示格式：4 个 chip（稿）还是 2 行（现状）？

### 另一个独立 bug（不在本卡，顺手记录）

`_submitFarmEntry` 的 NT lookup 粗粒度（只分两档），即使不改变动作清单，也应改用 `pricing[actionKey]` 逐动作匹配。此修复可在定夺后一并施工。

## 🔍 D-14 考古报告（Claude Code 一营 · 2026-07-25）

### 已存在什么

| 层 | 位置 | 状态 |
|---|------|------|
| 数据模型 | `app-data.js:29-30` — `pendingConfigChanges` + `configHistory` 数组初始化 | ✅ 完整 |
| 提案逻辑 | `app-data.js:506-523` `proposeConfigChange` — 创建修改提案（changes/note/公示期/requiredVerifiers=2） | ✅ 完整 |
| 校核逻辑 | `app-data.js:525-561` `verifyConfigChange` — 公示期满→2人确认→自动apply到config→写configHistory | ✅ 完整 |
| 展示层（历史） | `app.js:339-346` `_openCovenantOverlay` — 读取 `configHistory`（最近5条）并渲染 | ✅ 完整 |
| 展示层（定价） | `app.js:316-337` — 住宿+劳动定价全量展示 | ✅ 完整 |
| 同步 | `app-data.js:226` `_saveShared` payload 含 `pendingConfigChanges` 和 `configHistory` | ✅ 上行含 |
| Git 证据 | `86fcc57` docs: 公约新手引导设计定稿；`f230c10` 客户端体验+数据主权 Batch F+G（公约相关修复） | ✅ 有据 |

### 断在哪一环

**UI 层缺失**——版本化机制的「入口」没做：

1. **无「发起修改」按钮**：`proposeConfigChange` 函数存在但没有任何 UI 调用它——管理员无法在线提议修改公约定价
2. **无「待校核」展示**：`pendingConfigChanges` 数组有数据没有任何地方渲染——即使有人手动调了 proposeConfigChange，别人也看不到待处理提案
3. **历史记录永远为空**：因为提案流程从未被触发过 → `configHistory` 始终为空 → overlay 的「📝 修改记录」段永远不渲染
4. 服务端同步：`pendingConfigChanges`/`configHistory` 在本地存储中，但 `sync_shared` 端点未处理这两个字段（类似 D-12 修 presence 前的状态）

### 「做版本」的最小闭环建议

1. **公约 overlay 加「修改提案」按钮**（仅管理员可见）→ 调 `proposeConfigChange`
2. **pendingConfigChanges 不为空时在公约 overlay 展示待校核列表** + 校核按钮（任意 2 人，非提案者）→ 调 `verifyConfigChange`
3. **服务端 sync_shared 接 pendingConfigChanges/configHistory**（复用 MapLocation key="config_changes"/"config_history"）
4. 三者上线 = 版本化闭环。设计不复杂，丞相直接发卡 D-15 即可；翻牌后 `_saveShared` 自动上行；其他设备 `sync_all` 下行即取到最新 presence（需重构函数中段分叉结构，不在本卡范围）

---

### D-6 验收（newbieQuests 数组 + NaN）— 二营 2026-07-25 · commit 4c09152

**diff 审读**：
- `app.js` 两处渲染/校核面板：`|| {}` → `|| []`，初始化改 `steps.map(...)` 写数组 + `id/name/nt`；读进度改 `.find(x=>x.id===s.id)`。
- `s.title` → `s.name`：`data.js:50-54` NEWBIE_QUESTS 确实用 `name` 字段（`title` 不存在），修正正确。
- `_growDirtiness` rate 提升到外层、`||0`/`||rate` 兜底 NaN。
- index.html：`data.js?v=9→10`、`app.js?v=9→10`，铁律 6 ✓

**验收命令**：
- `node -e "new Function(fs.readFileSync('nantang-mobile/js/app.js','utf8'))"` → syntax OK
- 对照卡面逐项核对：3 处初始化路径、两处 doneCount、NaN 兜底全部覆盖；`data.js` NEWBIE_QUESTS 字段名核实一致。

**注意**（非阻断）：`_openVerificationPanel` 里 `quests || []` 只在读路径兜底，老用户若首次进入时 `_renderNewbieCard` 未跑过（例如自定义首屏）会以空数组显示 0/N；实测低风险——主页渲染 `_renderNewbieCard` 在 app 启动链路中先于铃铛面板执行，且会把数组格式回写 `AppData._data.newbieQuests[me]` 并 `_savePrivate()`，自愈路径存在。

**结论：✅ 通过**。

---

### D-7 验收（updateTask 剔 status）— 二营 2026-07-25 · commit 9665c77

**diff 审读**：
- `app-data.js:135` updateTask 新增局部克隆 `sync = Object.assign({}, updates)`；`delete sync.status; delete sync.action`；剔除后空对象跳过 API。
- 一营顺手剔了 `action`——`tasks.py` TaskUpdate 无 action 字段（只有 `status/assignee/note/evidence/reject_reason/settler_id`），同样会 422，合理扩充。
- index.html：`app-data.js?v=9→10`，铁律 6 ✓

**验收命令**：
- `node -e ...app-data.js...` → syntax OK
- 对 `server/routes/tasks.py:33-37` TaskUpdate 字段核对：status 确实会被 `:144 if req.status: raise 400` 拒绝，剔出必要；action 不在 schema，剔出防御合理。

**结论：✅ 通过**。

---

### D-8 验收（sync_shared camel/snake 双 key）— 二营 2026-07-25 · commit d4a5372

**diff 审读**：
- `data.py:sync_shared` 开头加 `_ml = req.get("map_locations") or req.get("mapLocations")`、`_cm = req.get("canteenMenu") or req.get("canteen_menu")`；后续使用统一 `_ml`/`_cm`，写库仍以 dict 原样 `json.dumps`。
- 卡面点名只修 map_locations/canteenMenu 两个混用字段，其他字段不在第一步范围，符合两步走策略。

**验收命令**（`work\d8_test.py`，httpx ASGI 直连临时 SQLite）：
1. snake map_locations + camel canteenMenu（旧前端现状）→ 200 ok:true，sync_all 读回 map_locations 含 loc_a ✓
2. camel mapLocations + snake canteen_menu（过渡期）→ 200，sync_all 读回 loc_b ✓
3. 非管理员 alice 带 map_locations → 权限逻辑仍拒绝（role 不是 admin 跳过写），不越权 ✓
4. 两种 key 的 canteenMenu/canteen_menu 分别落 CanteenMenu 表（直查 DB）→ 两次日期 2026-07-25/2026-07-26 都在 ✓

**结论：✅ 通过**（第一步服务端兼容到位，第二步前端切 snake 留待 D-8b）。

---

### D-9 验收（UI 批次）— 二营 2026-07-25 · commit c5e3d1e

**diff 审读 + 验收命令**：
- CSS：`village-brand` 加 `env(safe-area-inset-top)`、`village-group top:200→calc(130+safe-top)`、`village-window height:min(340, calc(100vh - 210 - safe-top - safe-bottom))`、`overlay-close min 32→44`、`sub-page padding-bottom:calc(80+safe-bottom)`、新增 `body.ov-locked{overflow:hidden;position:fixed;width:100%}`。卡面 H-9/M-8/L-4/L-8/M-7 五处 CSS 改动全部到位。
- 搜索框：`oninput="renderMyTasks()"` → `oninput="_debounce('taskSearch',250,function(){renderMyTasks()})"`，M-6 防抖到位 ✓
- 版本号：main.css v8→9、auth.js 新增 ?v=9、data.js v10→11、core.js v9→10、ui-cardroom.js v8→9、app.js v10→11，铁律 6 ✓
- JS syntax：`app.js / auth.js / core.js / data.js / ui-cardroom.js` 全部 node Syntax OK ✓
- body lock：`_pushOverlay`/`openSub` 加 `ov-locked`，`closeOverlay`/`closeSub` 走 `_unlockBodyIfAllClosed()` 解锁，逻辑对称。

**❌ 打回原因**（两条，对照卡面"全局搜不到残留 confirm(/prompt("明确要求）：

1. **M-5 原生 confirm/prompt 替换不彻底**。卡面明示「ui-cardroom.js:520 等约 8 处 → 统一换 _showModal/自定义弹窗」、验收要求「全局搜不到残留 confirm(/prompt(（showConfirm 等自定义除外）」。diff 只替换了 app.js 2 处 + auth.js 1 处 + core.js 1 处 + ui-cardroom.js 3 处，共 7 处。**全仓 grep 仍残留 13 处原生 prompt(、1 处原生 confirm(**（排除自定义函数定义后）：
   - `app.js:460`（退回原因 prompt）、`app.js:641`（作物名编辑）、`app.js:1522`（添加房间物品）、`app.js:1623`（修改大扫除日期）、`app.js:2282`（编辑房间物品）
   - `core.js:271`（分配任务序号 prompt）
   - `data.js:212/216`（itemShelf/itemAuction 售价 prompt）
   - `ui-wizard.js:433/435/472/508/509/694/710/725/749/750`（创建营地向导里 10 处 prompt）
   - `utils.js:134`（剪贴板 fallback prompt）
   即便其中部分（ui-wizard 管理员向导、utils fallback）属低频路径，卡面要求「约 8 处全部替换」，至少把用户高频路径（app.js 5 处 + core.js 1 处 + data.js 2 处）替完。

2. **`Game.confirm(title, message, onConfirm)` 改签名丢 title**。`core.js:112` 原实现 `confirm(title + '\n\n' + message)`，改成 `showConfirm(message, onConfirm)` 后**title 参数被静默丢弃**。调用方：
   - `app.js:1669` `Game.confirm('退房确认', '请确认：...', _doCheckout)`
   - `app.js:2339` `Game.confirm('帮 X 翻牌？', '帮ta更新...', _cb)`
   两处第一个参数（标题）全部不显示。修法：Game.confirm 内部把 title + message 拼回传给 showConfirm，或扩展 showConfirm 接受可选 title。

**结论：❌ 打回**——M-5 替换不达标（漏 14 处原生 prompt/confirm）+ Game.confirm 回退退化（丢标题）。

---

### D-12 验收（presence 跨设备同步）— 二营 2026-07-25 · commit df21937

**diff 审读**：
- 服务端 `data.py:sync_shared`：新增 `presence` 字段处理（dict 校验后整体 json.dumps 存 MapLocation key="presence"，不限角色）；`sync_all` 返回 `presence`。
- 前端 `app-data.js:_saveShared` 上行 payload 加 `presence: this._data.presence`；`core.js:_mergeSyncData` 加整体覆盖。
- index.html：`app-data.js?v=10→11`、`core.js?v=10→11`，铁律 6 ✓

**验收命令**（`work\d12_test.py`，httpx ASGI 直连）：
1. alice POST presence → 200；bob GET sync_all 读回 alice=onsite ✓
2. 非 dict POST → isinstance 守卫忽略，不破坏 ✓
3. bob 再 POST presence → sync_all 仅返回 bob ⚠️（见下）

**❌ 打回原因**：

1. **翻牌即时上行链路没接通**。卡面明示「本机刚翻牌后立即 `_saveShared` 上行（现有 flipPresence 已触发保存，确认即可）」。实测 `app-data.js:490 flipPresence` 最后一行是 `this._saveShared(true)`，而 `_saveShared(immediate=true)` 在 `app-data.js:227` **直接 return**（只写 localStorage，不发 HTTP）：
   ```js
   if (immediate) { this._saveKey('nt_app_v2_shared', data); return; }
   ```
   三条翻牌路径全部传 `immediate=true`：`_doFlipSelf` / `_doCheckout` / `flipForOther` → 翻牌后 presence **从不走 HTTP**，只有其他非 immediate 动作顺带把 presence 塞进 payload 时才偶发上行。设备 B 看不到 A 的最新翻牌状态，核心功能不生效。
   修法：flipPresence 末尾改先走 `this._saveShared(true)` 落本地，再触发一次带 immediate=false 的同步（或直接 `API.request('POST','/api/data/sync_shared',{presence:this._data.presence})`）。

2. **服务端 presence 整存整取，多设备并发互踩**。d12_test.py 用例 4 实测：alice 写 → bob 写 → alice 读只剩 bob，alice 被覆盖丢失。`pr.data = json.dumps(_presence)` 整体覆盖。前端上行的 presence 是单设备视角的对象，而 presence 是多人共享状态，服务端应按 user key 合并（取 updatedAt 更新的那条），否则最后一次上行的设备擦掉其他所有人。前端整体覆盖 OK（服务端应返回合并后的权威快照），但服务端必须字段级合并写入。

**结论：❌ 打回**——翻牌 immediate 路径不上行（核心功能未生效）+ 服务端整存整取多人互踩。

---

### D-13 验收（田间劳务考古卡）— 二营 2026-07-25

**对账代码**：
- `app.js:51 farming_pricing` 确有 6 key（harvest:15/plant:5/water:5/weed:5/fertilize:5/view:2）。
- `app.js:2520 _submitFarmEntry` NT 计算：`action.indexOf('收割')>=0 ? pricing.harvest : action.indexOf('浇水')>=0||action.indexOf('种植')>=0 ? pricing.plant : 5`，两档 + 默认 5，施肥/除草/查看吃默认 5，浪费配置（view=2 永不命中）。
- `_openFarmQuick`/`renderFieldPanel` 动作清单含摘菜/查看/除草/其他（稿未列），差异清单准确。

**纪律**：报告明确「稿未定义劳务分类 → 停下请丞相定夺 3 项」，未自由发挥，符合卡面第二步要求。

**结论：✅ 通过**。

---

### D-14 验收（公约版本化考古卡）— 二营 2026-07-25

**对账代码**：
- `app-data.js:29-30` `pendingConfigChanges=[]` / `configHistory=[]` 初始化 ✓
- `app-data.js:506-523 proposeConfigChange` / `:525-561 verifyConfigChange` 函数完整 ✓
- `app.js:316-346 _openCovenantOverlay` 定价+历史展示段存在 ✓
- `app-data.js:226 _saveShared` 上行 payload 含两字段 ✓
- 全仓 grep `proposeConfigChange|verifyConfigChange`：除定义外零调用，UI 无入口、无按钮、无待校核渲染，完全符合「骨架就位，入口/展示/服务端未接」。

**补充一营报告**：服务端 sync_shared 白名单不显式处理两字段，上行即静默丢弃（不在 camps/map_locations/canteenMenu/presence 四个分支里），一营报告第 4 条已点出，准确。

**结论：✅ 通过**。

---

## 验收总览（一营 D 系列 · 二营 2026-07-25）

| 卡 | commit | 结论 | 关键发现 |
|---|---|---|---|
| D-6 | 4c09152 | ✅ 通过 | s.title→s.name 修对；NaN 兜底 OK |
| D-7 | 9665c77 | ✅ 通过 | 顺手剔 action 合理 |
| D-8 | d4a5372 | ✅ 通过 | httpx ASGI 4 用例全 PASS |
| D-9 | c5e3d1e | ❌ 打回 | M-5 漏替 14 处原生 prompt/confirm；Game.confirm 丢 title |
| D-12 | df21937 | ❌ 打回 | flipPresence immediate=true 绕过 HTTP 上行；服务端整存整取多人互踩 |
| D-13 | 考古卡 | ✅ 通过 | 差异清单准确，守纪律不自由发挥 |
| D-14 | 考古卡 | ✅ 通过 | 骨架/调用/服务端三段对账准确 |

---

## 🔧 D 系列 · 一营返修记录（2026-07-25 · 二营打回后）

### D-9 返修 — commit `853588f`（补替全部原生 prompt/confirm + Game.confirm 标题兼容）

**打回原因**：M-5 替换不彻底（漏 14 处）+ Game.confirm 丢 title 参数。

**返修内容**（20+ 处，全仓 grep `\bprompt\(|\bconfirm\(` 后仅剩 Game.confirm 方法定义与注释）：

| 文件 | 改动 |
|------|------|
| `core.js:112` | `Game.confirm(title,msg,cb)` → `showConfirm(title+'\n\n'+msg, cb)` |
| `core.js:271` | `onBuilderPicked` prompt → `_promptDialog` 异步回调 + 提取 `_addBuilder` |
| `core.js:1621` | worker `confirm` handler → `showConfirm` + onCancel（result:false） |
| `data.js:212` | `itemShelf` prompt → `_promptDialog` 回调 |
| `data.js:216` | `itemAuction` prompt → `_promptDialog` 回调 |
| `data.js:525` | `showConfirm` 扩展可选 onCancel 参数（id-based event listener） |
| `utils.js:134` | 剪贴板 fallback prompt → `_promptDialog` |
| `app.js:460` | 退回原因 inline prompt → `_promptDialog` onclick 回调 |
| `app.js:641` | 作物名编辑 inline prompt → `_promptDialog` onclick 回调 |
| `app.js:1488` | fallback confirm → 删 dead code，直调 `showConfirm` |
| `app.js:1522` | `_addRoomItem` prompt → `_promptDialog` 回调 |
| `app.js:1623` | `_changeCleanDate` prompt → `_promptDialog` 回调 |
| `app.js:1667/2337` | 两处 `Game.confirm` 调用方 → 标题自动修复（core.js fix） |
| `app.js:2282` | `_editRoomItem` prompt → `_promptDialog` 回调 |
| `ui-wizard.js` | 6 处 confirm + 10 处 prompt → `showConfirm`/`_promptDialog`（含 `openCreateCamp` onCancel 双分支） |
| `ui-phase4.js:38/76` | 食堂预定/取消 confirm → `showConfirm` |
| `ui-camp.js:1280` | 完结营地 confirm → `showConfirm` |
| `index.html` | `utils.js` 首次加 `?v=9`；`ui-camp/ui-wizard/ui-phase4` 首次加 `?v=9`；`data/core/app` 升 `v=12` |

### D-12 返修 — commit `79ff178`（flipPresence HTTP 上行 + 分用户 key 存储）

**打回原因**：① flipPresence immediate=true 路径绕过 HTTP ② 服务端整存整取多人互踩。

**返修内容**：
1. **前端** `app-data.js:490`：`this._saveShared(true)` 后追加 `API.request('POST','/api/data/sync_shared',{presence:...})`——immediate 路径落本地 + 立即 HTTP 上行
2. **服务端写** `data.py:sync_shared`：presence 从单 key `"presence"` 改为分用户 key `"presence:{uid}"`；加 `updatedAt >=` 防回写（老旧数据不覆盖新数据）
3. **服务端读** `data.py:sync_all`：`MapLocation.key.like("presence:%")` 合并所有分用户 key 为单一 presence dict 返回前端
4. `index.html`：`app-data.js?v=11→12`

### D-15 施工 — commit `5602a30`（公约版本化闭环）

**来源**：D-14 考古报告。补 D-14 指出的三个断环：提案入口 / 待校核展示 / 服务端同步。

**施工内容**：
1. **提案入口** `app.js`：`_openCovenantOverlay` 底部加「📝 发起修改提案」按钮（仅 admin 可见）→ `_openCovenantProposal()` 表单（字段下拉 + 旧值/新值 + 原因必填）→ 调 `AppData.proposeConfigChange`
2. **待校核展示** `app.js`：`_openCovenantOverlay` 中渲染 `pendingConfigChanges`（非空时黄底卡片 + 校核按钮）→ `_verifyCovenantProposal()` 调 `AppData.verifyConfigChange`
3. **服务端同步** `data.py`：sync_shared 接 `pendingConfigChanges`/`configHistory`（MapLocation key="config_changes"/"config_history"）；sync_all 返回两字段
4. **前端合并** `core.js:_mergeSyncData`：以服务端 config 字段覆盖本地
5. `index.html`：`app.js?v=12→13`、`core.js?v=12→13`

### D-16 施工 — 同 commit `5602a30`（data.py 阵地查漏）

**来源**：D-11 勘察额外观察 1 + M-16。

**施工内容**：
1. **LIKE 第三处** `data.py:sync_all`：`user.id.replace('%','').replace('_','')` → `_uid`，LIKE 用 `_uid`（补 D-4 的最后一个 assignees.like 漏洞）
2. **card_discoveries id 幂等** `data.py`：`CardDiscoveryReq` 加 `id: str = ""`；`add_card_discovery` 优先用客户端 id + 按 id 查重幂等去重（照 A-7 同修）

---

## 🟢 返修后总体状态（2026-07-25）

| 卡 | 状态 | Commit |
|---|------|--------|
| D-6 | 施工完成，待二营复验 | 4c09152 |
| D-7 | 施工完成，待二营复验 | 9665c77 |
| D-8 | 施工完成，待二营复验 | d4a5372 |
| D-9 | ✅ 返修完成，待二营复验 | 853588f |
| D-12 | ✅ 返修完成，待二营复验 | 79ff178 |
| D-13 | 考古完成，待丞相定夺 | — |
| D-15 | ✅ 施工完成，待二营验收 | 5602a30 |
| D-16 | ✅ 施工完成，待二营验收 | 5602a30 |


---

## 🔍 二营复验结论（2026-07-25 · Codex 验收席）

| 卡 | Commit | 结论 | 备注 |
|---|--------|------|------|
| **D-9** | 853588f | ❌ **打回** | mobile-bundle.js:188 一键结算仍使用原生 confirm()——移动端生产核心文件漏替；Game.confirm 三参数签名正确、两个调用方（退房/翻牌）标题已恢复，app.js/core.js/data.js/ui-wizard.js/utils.js/ui-phase4.js/ui-camp.js 七文件替换齐全 |
| **D-12** | 79ff178 | ✅ **通过** | 分用户 key 存储（presence:{uid}）天然隔离 alice/bob 写入，updatedAt 字符串比较防回写，客户端 immediate 路径有 HTTP 上行，sync_all LIKE "presence:%" 合并读取正确 |
| **D-15** | 5602a30 | ✅ **通过** | 三件套齐全：① 管理员提案入口（role===admin 按钮）② 待校核列表+进度(n/2)+校核按钮（提案者不能自校/重复校核拦截/满2人自动 apply+写 history）③ sync_shared/sync_all 两端打通 config_changes/configHistory，core.js 服务端数据整体覆盖，换设备/清缓存重登服务端权威 |
| **D-16** | 5602a30 | ✅ **通过** | ① LIKE 三处通配符剔除齐全（data.py:437 / nt.py:98 / tasks.py:63）② card_discoveries id 幂等：同 id 去重直接返回、无 id 自动生成 disc_{timestamp} 向后兼容 |

### 🚦 上线闸口状态

**暂不 push**。D-9 需一营补替 mobile-bundle.js 第188行原生 confirm（改 showConfirm）+ 升 index.html ?v= 后再复验。D-12/D-15/D-16 可随 D-9 复验通过后一并上线。

待上线清单（共13卡）：D-2/D-3/D-4/D-5/D-6/D-7/D-8/D-10/D-12/D-15/D-16 + D-9 二次返修 + D-13(定夺后)

---

## ✅ D 系列 · 一营施工记录（续 · 2026-07-25 第三轮）

### D-13 施工 — commit `eab26d9`

**来源**：砚仁定夺「照稿施工」。

**施工内容**：
1. **浇水对齐 3NT**：`_defaultConfig().farming_pricing.water: 5 → 3`
2. **定价 chips 4 档分档显示**：收割 +15NT / 种植·施肥·除草 +5NT / 浇水 +3NT / 查看 +2NT（覆盖全部 6 个动作）
3. **`_openFarmQuick` 动作按钮追加 NT 显示**：每个按钮下方显示 `+N NT`，`flex-direction:column` + `gap:2px`
4. **`_submitFarmEntry` 修复**：原 `action.indexOf('收割')>=0 ? pricing.harvest : ...` 字符串匹配 → `pricing[actionKey]` 逐动作 mapping，`data-action-key` 属性直读
5. **公约定价展示同步更新**：拆分「农活(收割/除草/施肥)」「轻量农活(种植)」「浇水」「查看」四行

**变更文件**：`app.js`, `index.html`（?v=14）

---

### D-18 施工 — 四子卡分 4 个 commit

#### D-18-1: M-13 校核驳回接服务端 — commit `3839b77`

- `api.js` 新增 `rejectVerification(id, reason)`、`approveVerification(id, data)`
- `verifyAction` reject 分支：online → HTTP POST `/api/nt/verifications/{id}/reject`；offline 保留原本地逻辑
- `_doReject` 适配 async 模式：禁用按钮等待服务端响应

**变更**：`app-data.js`(?v=13), `api.js`(?v=9), `app.js`(?v=15)

#### D-18-2: M-14 提现接服务端 — commit `dc3da0e`

- `api.js` 新增 `withdraw(amount, toAddress)` → `POST /api/nt/withdraw`
- `submitWithdraw` 改调服务端：成功后冻结余额同步、失败降级入离线队列
- 新增 `_drainPendingWithdraws()` 离线队列重放，挂轮询 poll 的 sync 成功回调
- tx type 从 `cashOut` 改 `withdraw`

**变更**：`api.js`(?v=10), `core.js`(?v=14)

#### D-18-3: M-15 admin 审批切服务端 — commit `ea0b204`

- `api.js` 新增 `pendingWithdraws()`、`confirmWithdraw(entryId)`、`rejectWithdraw(entryId)`
- admin review 面板改拉 `GET /api/admin/withdraws/pending` 为权威源，合并本地离线记录
- `approveTx`/`rejectTx` 仅处理 topUp；提现审批走 `approveWithdraw(entryId)` / `rejectWithdrawAdmin(entryId)`
- server `/api/nt/cashout` 标记 `# DEPRECATED (D-18)`，前端零入口

**变更**：`api.js`(?v=11), `core.js`(?v=15), `nt.py`

#### D-18-4: M-17 退房按钮 — commit `9b83e9f`

- `api.js` 新增 `checkout()` → `POST /api/accommodation/checkout`
- `_doCheckout` 改调服务端：成功后同步角色/欠费，离线降级本地
- 补定义 `_checkoutBed`（此前 onclick 指向未定义函数，退房按钮实际无法工作）

**变更**：`api.js`(?v=12), `app.js`(?v=16)

---

## 🟢 返修后总体状态（2026-07-25 第三轮更新）

| 卡 | 状态 | Commit |
|---|------|--------|
| D-13 | ✅ 施工完成，待二营验收 | eab26d9 |
| D-18-1 | ✅ 施工完成，待二营验收 | 3839b77 |
| D-18-2 | ✅ 施工完成，待二营验收 | dc3da0e |
| D-18-3 | ✅ 施工完成，待二营验收 | ea0b204 |
| D-18-4 | ✅ 施工完成，待二营验收 | 9b83e9f |

**待上线新增**：D-13/D-18 共 5 卡。
