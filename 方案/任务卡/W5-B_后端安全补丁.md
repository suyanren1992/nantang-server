---
created: '2026-07-30'
project: 南塘云村
type: 任务卡
domain: 安全补丁
task_status: 已派工
status: 讨论中
series: Wave 5
---
# W5-B · 后端安全补丁（H-4/5/6/7）

> 归属：二营（Codex）
> 阵地：`server/`
> 禁区：`nantang-mobile/` 不许碰
> 并行：一营 W5-A 同步做前端，不互相等

## 问题（4 个，全部亲证）

### H-4：camp_report 无营地归属校验
- **位置**：`server/routes/camps.py:294-314`
- **现象**：任何登录用户可看任何营地报告，不检查是否为本营成员
- **修**：非 admin 须有 active `CampMembership` 才能访问

### H-5：activity_log 全量暴露
- **位置**：`server/routes/data.py:125-128`
- **现象**：GET `/api/data/activity_log` 返回全量日志，不过滤用户
- **修**：加 `.where(ActivityLog.user == user.id)`（admin 可看全量）

### H-6：3 个 GET 端点无鉴权
- **位置**：`server/routes/data.py:275/326/351`
  - `canteen_menu`（食堂菜单）
  - `map_locations`（地图位置）
  - `announcements`（公告）
- **现象**：未登录也能读
- **修**：3 个 GET 加 `user: User = Depends(get_current_user)`

### H-7：delete_camp 级联漏删 CampMembership
- **位置**：`server/routes/camps.py:326-342`
- **现象**：删营地只删 CampBuilder + NTTask，CampMembership 变孤儿行
- **修**：在 cascade 循环中加 `CampMembership`

## 判据（机器可验证）

1. H-4：非本营用户 GET `/{camp_id}/report` → 403
2. H-5：普通用户 GET `/activity_log` → 只返回自己的
3. H-6：无 token GET 三个端点 → 401
4. H-7：删营地后 `CampMembership` 表无该 camp_id 残留
5. `pytest tests/ -q` → 0 failed
6. 禁区 `nantang-mobile/` 零改动

## 纪律
- 具名 `git add`，禁 `-A`
- commit message 带卡号：`fix(W5-B): 后端安全补丁 H-4/5/6/7 · 二营`
- 不 push
- 回执四件套 + 太傅注三行
