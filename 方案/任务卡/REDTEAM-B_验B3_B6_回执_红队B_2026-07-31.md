# REDTEAM-B 二次验证回执 · 红队 B

> 卡号：REDTEAM-B_验B3_B6_v0（B3 shared merge / B6 admin bootstrap）
> 被验方：二营 H 窗 (`fbf3b2e` / `0817921`) + I 窗 (`d97688c`)
> 方法：真仓 `server/` 逐行白盒 + `git diff` 对照 + pytest 实测
> 日期：2026-07-31

---

## 一、B3 shared merge（commit `fbf3b2e`）— 防种子丢失

### 判据对照

| # | 卡面要求 | 真仓验证 | 结果 |
|---|---------|---------|:--:|
| ① | 非 admin 写 map_locations → 403 | data.py:408-409 — `if user.role != "admin": raise HTTPException(403)` | ✅ |
| ② | admin merge 不覆写 | data.py:414-417 — `deep_merge(_existing, _ml)` 替换 `ml.data = json.dumps(_ml)` | ✅ |
| ③ | deep_merge 递归合并 dict | merge.py:30-32 — `isinstance(result[key], dict) and isinstance(val, dict)` → 递归 | ✅ |
| ④ | deep_merge list 替换 | merge.py:34-36 — 非 dict+dict → 直接替换（None 除外）| ✅ |
| ⑤ | None 不覆盖已有值 | merge.py:35/38 — `if val is not None` 守卫 | ✅ |
| ⑥ | deep_merge 不修改入参 | merge.py:28 — `result = dict(base)` 浅拷贝 | ✅ |
| ⑦ | 7 测试全绿 | test_redteam_b3_shared_merge.py: 7 PASSED（实测） | ✅ |

### 盲点

**🔴 B3-R1 — `test_admin_cannot_clear_buildings` 名实不符，实为无效测试**
- 测试体第 146-149 行：读数据后**只有注释，无任何 assert**
- 注释自认：「buildings 被 list 替换为空（这是 deep_merge 的 list 语义）」
- 事实：admin 推 `{"buildings": []}` **确实会清空 11 栋种子**
- 测试名说 "cannot clear"，实际上 ~can~ clear
- **严重度：中**。不是安全漏洞（admin 本身全权），但测试名误导验收方
- **fix**：改名 `test_admin_can_clear_buildings_by_list_replace` + 加 `assert data["buildings"] == []` 确认语义

**🟡 B3-R2 — `_ml` 非 dict 类型未经校验**
- data.py:407 — `if _ml:` 通过后直接传 `deep_merge(existing, _ml)`
- 若 `_ml` 是 list/string（非 dict），`deep_merge` 返回 override 原值（merge.py:25-26）
- `ml.data` 被设为非 dict JSON → 后续 `sync_all` 读 `map_locations` → `json.loads` 返回 list → 前端崩溃
- 触发条件：客户端 bug 或恶意请求发 `map_locations: []`
- **严重度：低**（前端始终发 dict，从未见过 list 触发）
- **fix**：`if not isinstance(_ml, dict): raise HTTPException(422, "map_locations must be dict")`

**🟡 B3-R3 — deep_merge 类型混淆时静默替换**
- 若 `base[key]` 是 dict、`override[key]` 是 list → override 胜出（merge.py:34-36）
- 例：seed 含 `buildings: [{...}]`（list），admin 误发 `buildings: {"name": "x"}`（dict）→ 11 栋种子被 1 个 dict 替换
- **严重度：低**（admin 误操作，merge 本意就是 admin 能覆盖）

**🟢 判定：真生效，但 B3-R1 测试是虚的。** 核心保护逻辑正确（不送 buildings → 不丢 buildings）。唯一缺口：admin **主动**推空列表仍会清空——这是 list 替换语义的设计权衡，测试不应叫 "cannot clear"。

---

## 二、B6 admin bootstrap（commit `d97688c`）— admin 种子

### 判据对照

| # | 卡面要求 | 真仓验证 | 结果 |
|---|---------|---------|:--:|
| ① | seed/admin_user.json 含 id/role/wallet/avatar | 5 行 JSON — id/role/wallet_address/avatar_seed | ✅ |
| ② | init_db 无 admin 时插入 | database.py:335-358 — `select(User).where(User.role == "admin")` → 无则插 | ✅ |
| ③ | 环境变量 ADMIN_BOOTSTRAP_PASSWORD | database.py:345 — `os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "admin123")` | ✅ |
| ④ | 幂等（已有 admin → 跳过） | database.py:335-337 — `_has_admin` guard | ✅ |
| ⑤ | seed/README.md 安全警告 | README.md:15-22 — 改密码 + env var 双标警告 | ✅ |
| ⑥ | seed 文件缺失不崩溃 | database.py:359-360 — `logger.warning` + 不抛异常 | ✅ |
| ⑦ | 异常回滚 | database.py:363-365 — `except Exception: rollback` | ✅ |
| ⑧ | 3 测试全绿 | test_admin_bootstrap.py: 3 PASSED（实测） | ✅ |

### 盲点

**🟡 B6-R1 — 默认密码 `admin123` 无运行时告警**
- database.py:345 — fallback 硬编码 `"admin123"`
- README.md 文档警告存在，但代码无运行时检测（如：env 未设时 logger.warning）
- 生产部署忘记设 env → admin 用公开已知密码登录 → **P0 安全事件**
- **严重度：中**（文档警告有，但运行时静默更可靠）
- **fix**：加一行 `if "ADMIN_BOOTSTRAP_PASSWORD" not in os.environ: logger.warning("生产环境：ADMIN_BOOTSTRAP_PASSWORD 未设，使用默认密码 admin123")`

**🟡 B6-R2 — admin_user.json 与卡面示例不一致**
- 卡面示例含 `"name": "系统管理员"`，实际 JSON 无此字段
- 根因：User 模型（models.py:47-67）无 `name` 列，`id` 即用户名
- 不影响功能（`admin_bootstrap` 即用户名），但与卡面期望有差
- **严重度：低**（数据模型决定的合理省略）

**🟡 B6-R3 — 竞态条件：并发 init_db 可能双插**
- 幂等检查（select）和插入（add + commit）不在同一事务
- 双进程同时启动 → 可能插入两个 admin（但 id 主键冲突防住第二个，报错回滚）
- **严重度：低**（init_db 单进程调用，实际不触发）

**🟡 B6-R4 — admin_bootstrap 缺少 `last_active_at` / `first_checkin_date`**
- init_db 不设 `last_active_at`（User 模型有此列，DB-P0-1 新增）
- 首次 admin 登录后治理权判定可能依赖 `first_checkin_date`（nt.py:1019 等）
- 如果 admin 只做管理操作不签到，某些 visitor 限制可能误触发
- **严重度：低**（admin role 本身绕过了绝大部分 role check）

**🟢 判定：真生效。** admin 种子正确入库，幂等安全，环境变量路径工作。默认密码的运行时告警是唯一值得加一行的改进。

---

## 三、pytest 验证

### 全量回归

```
=========== short test summary ===========
4 failed, 244 passed, 8 skipped
```

### 4 失败分析

| # | 失败测试 | 所属模块 | 与 B3/B6 相关？ |
|---|---------|---------|:--:|
| 1 | `test_dev_reset.py::TestDevResetHard::test_hard_clears_four_new_tables` | dev-reset 端点 | ❌ 无关 |
| 2 | `test_inn_rooms_list.py::TestInnRoomsList::test_occupied_dates_interval` | 素社民宿 | ❌ 无关 |
| 3 | `test_inn_rooms_list.py::TestInnRoomsList::test_coop_and_checked_out_not_counted` | 素社民宿 | ❌ 无关 |
| 4 | `test_inn_track.py::TestDevResetInnRoom::test_hard_clears_inn_rooms` | dev-reset 端点 | ❌ 无关 |

**4 预存失败与 B3/B6 零相关** ✅

### B3+B6 专项测试

```
tests/test_redteam_b3_shared_merge.py: 7 PASSED  ✅
tests/test_admin_bootstrap.py:          3 PASSED  ✅
```

---

## 汇总

| # | 项目 | commit | 真生效？ | 盲点 |
|---|------|--------|:--:|------|
| B3 | shared merge | `fbf3b2e` | ✅ 是 | R1: 无效测试名 · R2: 非 dict 类型 · R3: 类型混淆 |
| B6 | admin bootstrap | `d97688c` | ✅ 是 | R1: 默认密码无运行时告警 · R2: 缺 name 字段 · R3: 竞态 · R4: 缺时间字段 |

**2 项完工 commit 均真生效。** 244 passed 真实。4 预存失败确认无关。

### 建议优先级

| 优先 | 建议 | commit |
|:--:|------|--------|
| P2 | B3-R1: 改名 `test_admin_can_clear_buildings_by_list_replace` + 加 assert | `fbf3b2e` |
| P2 | B6-R1: 加运行时 env 未设的 logger.warning | `d97688c` |
| P3 | B3-R2: 加 `_ml` 类型校验（422 if not dict） | `fbf3b2e` |
| — | B3-R3 / B6-R2/R3/R4: 保持现状 | — |

> 红队 B 二次验证完成 · 逐行白盒 + pytest 实测 · 7 盲点（1 中 6 低）· 零阻断

## 太傅注 3 行

- **B3 的 merge 是对的，但测试名骗了验收方** — 那个叫 "cannot clear" 的测试没有 assert，buildings 确实可以被 admin 清空
- **B6 种子播了，肥沃度看运维水平** — 默认密码 `admin123` 的静默 fallback 是最大的残留风险点
- **244 passed 是真的，4 个红叉全是素的** — inn 民宿 + dev-reset，碰都没碰 sync_shared 和 init_db
