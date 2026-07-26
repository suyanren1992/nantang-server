---
created: 2026-07-27
project: 南塘云村
type: 任务卡
domain: 测试基建
status: 已发包
card: SM-5
version: 1.0
---

# SM-5 · 测试台：重置键 + 一键填充（砚仁测 bug 的拐杖）

> 来源：砚仁 2026-07-27 01:12 旨「要一个重置键 + 一个一键填充数据，不然完全一头雾水，不知道数据有没有运行好」。
> 考古底子：① `js/seed-test-data.js` 已清空为 No-op（历史上 `_seedIfEmpty` 假数据被清，A6 教训：seed 数据必须带 `_seed` 标记）；② 服务端无任何 reset/seed 端点；③ 前端 `resetAllData`（core.js 内）只清本地，不动服务端。
> 分工：一营施工（跨端全权，可动 server/routes/ + 前端），二营验收，真机留砚仁。
> **定位：这是真机 17 项清单的前置工具——没有填充数据，清单里大半项目没法测。排 SM-4 之后、push 之前。**

## 一、服务端两个端点（仅 admin + 环境变量开关双保险）

挂载条件：`DEV_TOOLS_ENABLED=true`（Render 环境变量，默认不设=端点 404）+ JWT role=admin，缺一不可用。

### 1. `POST /api/admin/dev-reset` 重置键（两档）
- `mode=soft`（默认）：清业务数据——nt_tasks / verifications / journal / inventory / camps / presence / nt_ledger / community_pool 流水类，**保留 users 账号**（免重新注册）
- `mode=hard`：全清回初始态（users 也清，schema 不动），清完跑 C-7 社区池 500 初始化（复用现有初始化函数）
- 两档都写一条操作日志（谁、何时、哪档）

### 2. `POST /api/admin/dev-seed` 一键填充（幂等，可重复点）
造一套「能摸到所有功能」的最小数据，**每条带 `_seed: true` 标记**（A6 教训）：
- 3 个测试用户：`测试甲`（在地 builder）/ `测试乙`（外出 adventurer）/ `测试丙`（visitor），密码统一 `test12345`，各给 100 NT
- 2 个营地：1 进行中 + 1 招募中（字段填满，治 SM-3 子项 2 的 null 场景）
- 3 条任务：个人/营队/社区各 1（含 1 条待校核）
- 冰箱物品 5 件：含 1 件临期 + 1 件过期（触发警告UI）
- 打扫：2 个房间置脏（🔴/🟡各一）+ 1 条历史记录
- 时间线 journal 3 条 + presence 两人翻牌
- 社区池确认 500（不足补，账上留痕）

## 二、前端入口（🧪 测试台）

- 位置：「我的」页底部新增 🧪 测试台区（**仅 admin 可见**）：[🔄 重置数据] [📥 一键填充]
- 重置点按 → showConfirm 选档（软/硬，写清区别）→ 调端点 → 清本地 localStorage → 踢回登录页
- 填充点按 → 调端点 → 提示「填充完成：3用户/2营地/3任务/5物品…」→ 刷新数据
- 非 admin 或开关未开：按钮不渲染（不是置灰，是不存在）

## 验收判据

1. 软重置后：大厅空、冰箱空、时间线空，账号还在能直接登
2. 硬重置后：账号清空需重注册，社区池=500
3. 填充后（无痕重登=服务端权威）：大厅 3 任务、冰箱 5 件（临期/过期警告显示）、时间线 3 条、在地人员 2 人、营地 2 个无 null、待校核 1 条
4. 重复点填充不产生重复数据（幂等）
5. 非 admin 登录看不到测试台；`DEV_TOOLS_ENABLED` 不设时两端点 404
6. deploy_check 全绿；?v= 纪律；回执独立落盘

## 纪律

- 端点属数据敏感：**不做批量删资金流水的隐藏路径**，nt_ledger 清空仅限 dev-reset 显式调用且写日志
- seed 用户/数据一律 `_seed: true` 标记；不动现有任何业务逻辑
- 单独 commit 不 push；commit message：`feat(SM-5): 测试台——dev-reset/dev-seed双端点+我的页测试台入口(admin+DEV_TOOLS_ENABLED双闸)`
