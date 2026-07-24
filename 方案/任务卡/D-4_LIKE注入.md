# 任务卡 D-4：用户名 LIKE 通配符注入 🔴

> 施工方：豆包 Codex（二营） · 监察：Kimi Code · 验收：Kimi Work · 单独 commit，不 push
> 来源：《全面权限扫描_B方案_2026-07-24》H-1 + L-3

## 位置
- `server/routes/auth.py:62` 注册仅校验 `len(name) ≤ 64`，无字符白名单
- `server/routes/nt.py:99`（及 :402 附近）、`server/routes/tasks.py:64`：
  `NTTask.assignees.like(f'%"{user.id}"%')` 模式

## 问题
注册名为 `%` 的账号后，上述 LIKE 被注入为 `%"%"%`，匹配所有有认领者的行 → 可查看全平台任务列表与流水。

## 修法（双保险，两层都做）
1. **入口堵**：register 端点加字符白名单校验，用户名必须匹配 `^[a-zA-Z0-9_一-龥]+$`（允许中英文数字下划线，拒绝 `%`、`_` 以外的特殊字符也一并拒绝），不匹配返回 `JSONResponse({"ok": False, "error": "用户名仅限中英文、数字、下划线"})`
2. **查询兜底**：三处 LIKE 拼接前对 `user.id` 做转义/剔除：`uid = user.id.replace('%','').replace('_','')`，再用 `f'%"{uid}"%'`

## 验收
- 注册 `%`、`%%`、`_`、含引号用户名 → 均 ok:false
- 正常中文名/英文名注册不受影响
- 用存量正常账号调 `GET /api/nt/sync` 与任务列表，返回范围不含他人任务
- commit message：`fix(D-4): 注册用户名白名单 + LIKE 查询通配符剔除（H-1 % 账号看全量数据）`
