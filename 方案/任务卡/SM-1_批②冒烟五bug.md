---
title: "SM-1 批②收官冒烟五 bug"
type: 任务卡
domain: ["南塘云村", "线上bug", "冒烟"]
created: 2026-07-27
author: "丞相（Kimi Work）"
status: "待发包（一营施工/二营验收）"
---

# SM-1 · 批②收官冒烟五 bug（一营施工 → 二营验收）

> 来源：2026-07-27 00:09 砚仁批②收官冒烟（真机 + 无痕模式复现）——**真 bug，非 PWA 缓存**。
> 判别实证：线上 index.html `?v=` 分布与仓库一致（服务端发最新）；批② 21 commits 零前端改动。
> 定档：**中卡**（一营阵地为主；子项 1 若勘察证跨端，拆出单独立卡）。
> 砚仁 00:18 谕：实测归施工单位——卡内附实测方法，施工营自跑自证。
> 铁律：勘察只读零写入；验收必须**真机无痕复测**，不接受模拟器/口头过。

## 一、五子项症状与勘察锚点（丞相第一轮只读勘察，证或否）

| # | 症状（砚仁原话） | 勘察锚点 | 施工营任务 |
|---|---|---|---|
| 1 | 发任务消失；没 NT 提示不能发，发了还是消失 | 服务端创建端点 = `tasks.py:84 POST /api/tasks`（nt.py:515-518 注释明确：nt 版废弃，用 tasks.py）；前端链路 `core.js:697` → `api.js:145 syncTask POST /api/tasks` → 得 srvId → 本地 `NT.createTask`（nt-core.js:153）→ `renderMyTasks()`；列表拉取 `api.js:152 GET /api/tasks?mode=hall` | 本地实测全链路（方法见二），定位消失环节：创建失败 / 创建成功但列表查询过滤掉（scope/status/字段）/ 前端渲染丢 |
| 2 | 村口卡片顶端「实景游戏·南塘云村」与卡片重叠 | `index.html:40` `<h1>` / `:82` `<h2>` 双标题 | 量 CSS 层级/定位，修重叠 |
| 3 | 校核室作证提示文字看不清（「你正在为这件事作证」及解释） | `ui-cardroom.js:466` 标题 `color:#2a4a30`；`:471` 按钮 `font-size:.65rem` | 对比度/字号修到可读 |
| 4 | 校核选择键按了没反应 | `ui-cardroom.js:471` onclick → `AppData.verifyAction(...)` | 控制台看报错，修绑定/异常 |
| 5 | 冰箱还是打不开 | B-2 卡修点对照 `app.js` 冰箱引用 | 对照 B-2 卡面修点，查线上路径为何未覆盖 |

## 二、子项 1 实测方法（施工营照跑，输出入回执）

```bash
cd server && JWT_SECRET=<临时32位> python -m uvicorn main:app --port 8010 &
# python/urllib 或 httpie 逐步（不要用 git bash curl 传中文 JSON——编码坑，会报 parsing the body）：
# ① POST /api/auth/register {"name":"t1","password":"xxxxxxxx"} → 拿 token
# ② sqlite 预置余额：UPDATE users SET nt_balance=100 WHERE id='t1'
# ③ POST /api/tasks {"title":"冒烟","reward":10,"slots":1,"scope":"社区","category":"other"} → 期望 {"ok":true,"task_id":...}
# ④ GET /api/tasks?mode=hall → 任务在不在？
# ⑤ GET /api/tasks → 我的任务在不在？
# 每步贴 status+响应原文入回执；哪步断，根因就在哪步。
```

## 三、必交物（中卡）

- 影响面声明一段（改了哪几个文件 / 碰没碰资金路径或权限 / 回滚怎么滚）
- 「影响面（爆炸半径）」四答：调用方 / 被依赖方 / 关联测试 / 回滚路径
- 子项 1 实测五步输出（每步 status+响应原文）
- 修 js/css 必升 `?v=`（同 commit）

## 四、可证伪验收判据（二营收）

1. 子项 1：实测五步全绿输出在回执，且线上真机无痕发任务 → 任务大厅可见
2. 子项 2-5：真机无痕逐项复测过（截图或砚仁确认）
3. `python server/scripts/deploy_check.py` 全绿；`?v=` 一致性 PASS
4. 未碰资金路径/权限逻辑（碰了升大卡重走）

> **太傅注**：补课 17。人话原理：验收四关的冒烟关是最后防线——批①省了它，五个「修了」在线上躺两天；
> 本卡验收不认「我本地好了」，只认真机无痕，免得再躺一次。
EOF
