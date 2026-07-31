---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 安全
task_status: 已发卡
status: 讨论中
series: IA
---
# IA-2 后端安全秒修（二营施工）

> 来源：7路审查报告 P0-3 + 审查 #12/#46
> 施工：豆包 Codex（二营）｜验收：施工二营自验 + 丞相复核
> 优先级：**P0 秒修**（2 项合 1 卡，共 < 30 分钟）
> 法源：审查报告 + 砚仁终审

---

## 施工内容（2 项，逐条带行号）

### ① config_changes 写入补 admin 权限检查

**现状**：`data.py:432-443` — `sync_shared` 中写 `pendingConfigChanges` 和 `configHistory` 的代码**没有 `user.role == "admin"` 检查**。同函数中 map_locations / canteenMenu / camps 都有 admin 校验，唯独 config_changes 遗漏。

**后果**：任何认证用户都可以通过 API 覆盖 config_changes，配合公约修改的纯客户端校验（`app-data.js:553`），可绕过所有治理流程修改定价。

**修复**：在 `data.py:432` 和 `data.py:438` 之前各加 admin 检查：

```python
# data.py:432 区域
_pcc = req.get("pendingConfigChanges")
if _pcc and isinstance(_pcc, list):
    if user.role != "admin":
        raise HTTPException(403, "仅管理员可修改公约配置变更")
    pc = (await db.execute(...))...

# data.py:438 区域
_ch = req.get("configHistory")
if _ch and isinstance(_ch, list):
    if user.role != "admin":
        raise HTTPException(403, "仅管理员可写入公约配置历史")
    ch = (await db.execute(...))...
```

> 注意：`sync_shared` 端点已有 `Depends(get_current_user)`，`user` 变量可用。只需加 role 检查。

### ② _user_json 不暴露 location 给非本人

**现状**：`auth.py:32-38` — `_user_json()` 无条件返回 `u.location`。`/api/auth/users`（L237）列表接口对所有认证用户返回全部用户信息，包括每个人的真实位置。

**修复**：`/api/auth/users` 端点在序列化时过滤敏感字段。两种方式选一：

- **方案 A**（推荐）：`_user_json()` 加 `include_sensitive=False` 参数，默认不返回 `location`；`/me` 和 `/login` 传 `True`
- **方案 B**：`/users` 端点单独构建返回体，不暴露 location

```python
# 方案 A 示例
def _user_json(u, include_sensitive=False):
    d = {"name": u.id, "uid": u.id, "role": u.role, ...}
    if include_sensitive:
        d["location"] = u.location
        d["wallet_address"] = u.wallet_address
    return d
```

> 注意：`/login`、`/refresh`、`/me` 调用时传 `include_sensitive=True`（用户看自己的信息）；`/users` 列表不传（脱敏）。

## 禁区

- `nantang-mobile/` 零改动（一营阵地）
- `nt.py` / `accommodation.py` 零改动

## 爆炸半径

- 改几个文件：2（data.py + auth.py）
- 影响功能：公约配置写入权限 + 用户列表信息泄露
- 破坏性变更：无（收紧权限，向前兼容）
- 回滚：`git revert` 本 commit

## 铁律

- 只 commit 不 push；具名 add（禁 `-A`）；commit 带卡号营号
- 回执落盘 `方案/任务卡/` 随 commit；末尾太傅注三行
- `pytest tests/ -x -q` 全绿

## 判据（验收方逐条贴输出）

1. 非 admin 用户 POST `sync_shared` 带 `pendingConfigChanges` → 返回 403
2. admin 用户 POST 同上 → 正常写入
3. `GET /api/auth/users` → 返回体不含 `location` / `wallet_address`
4. `GET /api/auth/me` → 返回体含 `location` / `wallet_address`（本人可见）
5. `pytest tests/ -x -q` 全绿
