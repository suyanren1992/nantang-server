# Spec: 社区功能扩展（Phase E 相关）

> 来源：[外层设计_社区功能扩展.md](../../方案/外层设计_社区功能扩展.md)
> 审查：8 Agent 已通过 · 22 项发现全部修复
> 状态：🟡 spec 就绪 · 待拆 tickets

---

## 一、范围

### 包含

| 项目 | 说明 | 成熟度 |
|------|------|:---:|
| **前置** Phase E 入住系统 | 入住→resident role、退房→visitor、住宿记录 | 🟡 |
| **A** 统一贡献系统 | 卡片室+校核室双 tab + 贡献路径选择器 | 🟡 |
| **B** 社区管理员 | admin/builder 权限模型 + 管理后台 | 🟡 |
| **C** 自动任务生成 | 周期性任务（cron）+ 赏金任务（远期） | 🟡/🔴 |

### 不包含

- E3.5-E3.7（新手引导、访客权限）—— 独立设计
- 赏金任务 —— 周期任务稳定后
- 模板管理 DB 化 —— Phase 2（社区超 30 人）

### 约束

- 服务端唯一真相源（Phase C 之后）
- 移动端优先（双栏→标签页）
- 复用 `ui-cardroom.js`、`Verification` 表
- `poster='社区'` 任务从 COMMUNITY_POOL 出

---

## 二、数据模型变更

### 2.1 nt_tasks 新增字段

```sql
ALTER TABLE nt_tasks ADD COLUMN is_system_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE nt_tasks ADD COLUMN idempotency_key VARCHAR(128) UNIQUE;
```

- `is_system_generated=true` → 周期/赏金任务
- `idempotency_key` → `{template_id}:{date}` 防 cron 重复

### 2.2 card_discoveries 新增字段

```sql
ALTER TABLE card_discoveries ADD COLUMN doer_name_snapshot VARCHAR(64);
```

- 匿名揭示时用户已注销的 fallback

### 2.3 不需要的变更

- ~~`source` VARCHAR~~ → `poster + is_system_generated` 推导
- ~~`visible_to`~~ → 从 poster/在地成员推导
- ~~`anonymous_until`~~ → 复用 `CardDiscovery.expired_at`
- ~~`cron_state` 表~~ → 幂等键 + UNIQUE
- ~~ledger 扩展~~ → 复用 Verification 表

---

## 三、API 契约

### 3.1 `GET /api/tasks?mode=hall&scope=社区`

**新增 `mode=hall` 查询参数**。不改现有端点。

返回：所有 `status='进行中'` + scope 匹配 + 用户可见的任务。

可见性过滤：
- `is_system_generated=false` → 所有人可见
- `is_system_generated=true` → 仅在地成员可见
- 非在地成员 → 不返回周期/赏金任务

### 3.2 `POST /api/tasks` — poster='社区' 分支

```python
if req.poster == "社区":
    assert user.role in ("admin", "builder")
    pool = await get_community_pool(db)
    assert pool.balance >= req.reward * req.slots
    pool.balance -= req.reward * req.slots
    pool.task_escrow += req.reward * req.slots
```

### 3.3 cancel_task — poster='社区' 退款

cancel 时识别 `poster='社区'` → 退还给 COMMUNITY_POOL

### 3.4 `POST /api/verify` — 校核制服务端化

**入参**：`{ verification_id, approved: bool, reject_reason?: string }`

**4 条防作弊规则**（从客户端 migrate 到服务端）：

| # | 规则 | 实现 |
|---|------|------|
| 1 | 非自校核 | `req.verifier != verification.doer` |
| 2 | 同对 1h 冷却 | 查 Verification 表 verifier+doer+created_at |
| 3 | 日上限 10 次 | COUNT WHERE date = today |
| 4 | 3 次驳回=永久拒绝 | 复用 `Verification.retry_count` |

**通过** → earnFromPool（COMMUNITY_POOL → doer + verifier）

### 3.5 `GET /api/admin/pending-newbie`

返回：待审核的新人任务列表。鉴权：`role IN (admin, builder)`

### 3.6 sync 端点追加 `cron_active`

`GET /api/nt/sync` 响应新增 `cron_active: bool`。客户端读到 `true` 时跳过本地任务生成。

---

## 四、UI 规格

### 4.1 卡片室/校核室标签页（`ui-cardroom.js`）

在 `renderCardRoom()` 顶部加 tab bar：
- `🃏 猜`（默认）→ 现有卡片网格
- `✓ 确认` → `pendingVerifications` 列表 + confirm/deny 按钮
- 44px 触控目标，active/inactive 视觉区分

### 4.2 贡献路径选择器

合并 `openNewDiscovery` 和 `openSelfReport` 为统一入口：
- 「📋 我要报备」→ 校核室公开确认 → 社区池出 NT
- 「📝 我要委托」→ 任务大厅招募 → 冻结我的 NT

### 4.3 任务大厅 scope tab + filter chips

- 一级 tab：个人委托 / 营队任务 / 社区
- 社区 tab 内二级 chips：全部 / 手动委托 / 周期性 / 赏金
- 非在地成员不可见「周期性」「赏金」chips
- 卡片视觉：周期蓝边 / 赏金黄边 / 手动默认

### 4.4 管理后台

- admin/builder 可见「管理」入口
- 可发布社区任务（NT 从社区池出）
- 可查看/审核/驳回待审核新人任务

### 4.5 云村民只读

- 卡片室：隐藏「猜」按钮，保留查看
- 校核室：隐藏「确认」「拒绝」按钮

---

## 五、服务端 cron

### 5.1 模板配置

`server/config/periodic_tasks.json`：4 个模板（日常清扫/周末大扫除/库存盘点/翻堆肥）

### 5.2 cron runner

- 高频 tick（10min）：仅赏金（远期）
- 每日 tick（00:05）：daily 模板
- 每周 tick（周日 00:10）：weekly 模板

### 5.3 幂等

- 键：`{template_id}:{period_start_date}`
- `INSERT OR IGNORE` + UNIQUE 约束
- 余额不足 → 跳过 + WARN 日志
- 错过周期 → 不补发

### 5.4 迁移机制

- `cron_active` 标志位分阶段启用
- Phase 1：cron_active=false，双写验证
- Phase 2：cron_active=true，客户端降级
- Phase 3：移除客户端任务生成代码

---

## 六、依赖与前置

| 前置 | 内容 | 阻塞 |
|------|------|:---:|
| Phase E (E3.1-E3.3) | 入住系统 + resident role | A/B/C 全部 |
| Phase D12 | adminNames → 服务端 role | B |
| Phase C0 | sync 端点 + card_discoveries/verifications 同步 | A/C |
| Phase C2 | earnFromPool 服务端端点 | A 校核制路径 |
| cron runner | APScheduler 或 asyncio loop | C |
| doSubmit bug | 多人任务提交修复 | A 验收 |

---

## 七、执行计划（9 轮 · 17-21 文件 · 14-21h）

| 轮次 | 内容 | 文件 | 工时 |
|------|------|:---:|:---:|
| 1 | 数据层（加字段+配置+API mode） | 3-5 | 2-3h |
| 2 | 服务端校核（verifyAction 服务端化） | 2 | 2-3h |
| 3 | 客户端校核对接（改调服务端） | 2 | 1-2h |
| 4 | 卡片室/校核室标签页 UI | 2 | 2-3h |
| 5 | 服务端 cron 任务生成 | 2 | 2-3h |
| 6 | 客户端 cron 降级 | 2 | 1h |
| 7 | 任务大厅 scope tab + filter chips | 2 | 1-2h |
| 8 | 管理后台 | 3 | 1-2h |
| 9 | 退房清理（远期） | 1 | 0.5h |

---

## 八、验收标准

- [ ] 在地成员定义可用（从服务端 role + accommodations 推导）
- [ ] 周期任务每天自动生成，无重复
- [ ] 校核通过 → COMMUNITY_POOL 减少 → doer + verifier NT 增加
- [ ] 非在地成员看不到周期/赏金任务
- [ ] 卡片室 tab 切换正常，云村民只读
- [ ] admin/builder 可发布社区任务
- [ ] 退房时自动释放已认领的周期任务
- [ ] COMMUNITY_POOL 余额不足时 cron 跳过 + 日志告警
