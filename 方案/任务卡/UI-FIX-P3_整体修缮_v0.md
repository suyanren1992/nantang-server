━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：UI-FIX-P3_整体修缮_v0
  阶段：UI-FIX-ALL 路线图阶段 C（强依赖重排）
  施工方：一营 Claude Code（FE 1 窗串行）+ 二营 Qoder（BE 多窗并行）
  验收方：丞相 Codex + 红队 A
  立卡：丞相 Codex 2026-07-31 18:15
  法源：砚仁 18:00+ 怒报「整体审查 + 重新发单」+ 用户原话累积 + 红队 A/B 实证
  优先级：P0（砚仁明确「全部一次施工 + 出问题紧急召唤」）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【背景】
  砚仁 18:00+ 怒报：
  - 「这都没修好 · 改完不知道改哪个 · 改的也不知道改了哪个」
  - 「整体审查一下 · 重新发单 · 目前项目待怎么派单」
  - 「共享厨房 ≠ 订餐（关键概念厘清）」
  - 「1 营 + 2 营同步施工 · 数据表先行」

  现状盘点（18:10 git log + 真仓扫描）：
  - 未 push：86 commits + 127 文件 modified
  - 1 营已完：UI-FIX-P0 18 项 + 续单 22 项 + 阶段 3 4 页面
  - 2 营已完：28+ 项（路线图+验证修）
  - 测试：255 passed + 8 failed（预存污染，单独跑全过）
  - 线上 origin/main：53a4931（12:08 推，之后未推）

【关键概念厘清】
  ┌──────────────────────────────────────┐
  │ 共享厨房 ≠ 订餐（用户原话·18:00）   │
  ├──────────────────────────────────────┤
  │ 共享厨房        │ 订餐              │
  │ 自己做饭        │ 别人做（厨师/管理员）│
  │ 合作社成员+外来 │ 民宿住客           │
  │ 容量≤10人       │ 菜单定             │
  │ >20人需时段申请 │ 当日订             │
  │ 共享物品（冰箱）│ 餐费               │
  │ 字段：potluck/  │ 字段：meal_order/  │
  │ kitchen_slot/   │ 订餐表             │
  │ kitchen_booking │                    │
  │ UI：厨房面板+   │ UI：订餐页+        │
  │ 共享厨房页      │ 素社民宿页         │
  │ ❌ 砚仁从未提过「田间接龙」——       │
  │ 丞相捏造被 8867b0b 删除            │
  └──────────────────────────────────────┘

【阵营分工】

  二营可多窗并行（不同文件不冲突）：
  - 二营-甲：补 BE 13 路由（K 窗打回·数据黑洞）
  - 二营-乙：立共享厨房数据表（potluck / kitchen_slot / kitchen_booking / shared_item）
  - 二营-丙：修 BE 8 failed 测试（test_db_p0_1 / test_dev_reset / test_inn_rooms_list / test_inn_track / test_p1_remaining）
  - 二营-丁：住宿/田间 BE 增强（退房明细 + 田间 stage/planted_at/health）

  一营 1 窗串行（按强依赖排）：
  - P3-① K 窗回炉 4 步（?v= + 删内联网格 + 改函数 + 接 BE）
  - P3-② 修用户亲报 P0 5 项（撤回一次/牛皮糖/冰箱/设置按钮/世界终端）
  - P3-③ 归档文件/时间线字号统一
  - P3-④ 田地重设计（按设计 ③ 实施）
  - P3-⑤ 住宿深化（按设计 ⑦ 实施）
  - P3-⑥ 共享厨房 FE（按 DESIGN-共享厨房_v0 实施）
  - P3-⑦ 教学引导（按设计 ① 实施）
  - P3-⑧ 活动页深化（按设计 ⑤ 实施）
  - P3-⑨ 订餐页（按设计 ⑥ 实施）

【强依赖顺序】
  ┌────────────────────────────────────────────┐
  │ 二营先（数据契约先行）                       │
  │   ↓                                          │
  │ 二营-甲 13 路由（批 1: potluck 3 + proposals │
  │                批 2: labor/health/notif     │
  │                批 3: withdraw/camps）        │
  │   ↓                                          │
  │ 二营-乙 共享厨房数据表                       │
  │   ↓                                          │
  │ 二营-丙 修 8 failed 测试                     │
  │   ↓                                          │
  │ 二营-丁 住宿/田间 BE 增强                    │
  │   ↓ 全部 BE 完工                            │
  │ 一营-① K 窗回炉                             │
  │   ↓                                          │
  │ 一营-② 用户亲报 P0 5 项                      │
  │   ↓ 砚仁冒烟 5 条 P0 全过                    │
  │ 一营-③ 字号统一                             │
  │   ↓                                          │
  │ 一营-④⑤⑥⑦⑧⑨ 阶段 3 页面深化              │
  │   ↓ 全部完工                                │
  │ 红队 A 全验                                 │
  │   ↓ PASS                                    │
  │ 砚仁批 push                                 │
  └────────────────────────────────────────────┘

【施工内容 · 12 项独立卡】

━━━━━━━━━━━━━━━━━━━━━━━━━━
## A. 二营-甲：BE 13 路由补全（数据黑洞）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：K-REDTEAM-FIX_BE13路由补全_v0.md
  - 内容：13 路由分 3 批
    · 批 1（3）：potluck/list + potluck/join + proposals/list
    · 批 2（4）：labor/history + health/report + notifications/list + cleaning_pricing
    · 批 3（6）：withdraw/history + camps/budget + camps/schedule + proposals/submit + proposals/vote + camp_proposals/list
  - 测试：≥13 pytest（基线 255+8 failed + 修后 271 passed）
  - 阵地：server/  禁区：nantang-mobile/
  - 3 批 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## B. 二营-乙：共享厨房数据表（数据契约）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：DESIGN-共享厨房_v0.md
  - 内容：
    · potluck_event 表（接龙：event_id, organizer, datetime, capacity, dish, status）
    · potluck_participant 表（event_id, user_id, role, joined_at）
    · kitchen_slot 表（slot_id, start_at, end_at, capacity, status, booker_id）
    · kitchen_booking 表（slot_id, user_id, group_name, dish, party_size）
    · shared_item 表（item_id, name, owner_id, location, expired_at）
  - 端点：≥5 路由（potluck/create, potluck/join, kitchen/book, kitchen/release, shared_item/add）
  - 迁移：database.py + init_db 种子
  - 测试：≥8 pytest
  - 阵地：server/  禁区：nantang-mobile/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## C. 二营-丙：修 8 failed 测试
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：18:10 pytest 全量结果
  - 内容：
    · test_db_p0_1 vote_right 3 测试（governance 与 last_active_at 联动）
    · test_dev_reset inn_rooms 1 测试（dev-reset 与外键约束）
    · test_inn_rooms_list 2 测试（date interval + 房型筛选）
    · test_inn_track 1 测试（dev-reset 污染）
    · test_p1_remaining camp_report 1 测试（camp 表字段）
  - 单独跑 OK（32 passed 验证过）→ 修污染（共享 session 顺序问题）
  - 测试：基线 271 passed（修后 0 failed）
  - 阵地：server/  禁区：nantang-mobile/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## D. 二营-丁：住宿/田间 BE 增强
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：设计 ③ 田间 + ⑦ 住宿
  - 内容：
    · accommodation.py: checkout 返明细（住宿费+餐饮+服务+余额）
    · accommodation.py: room_change（关旧 Tenancy 开新 + 继承 first_checkin_date）
    · fields.py: harvest/fertilize 补 stage/planted_at/health 字段
    · 端点：≥3 路由
  - 测试：≥5 pytest
  - 阵地：server/  禁区：nantang-mobile/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## E. 一营-①：K 窗回炉 4 步
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：K-REDTEAM-FIX_K窗回炉_v0.md
  - 内容：?v= bump + 删内联网格 + 改 _openQuickMenu → _openKitchenQuick + 接 BE 13 路由
  - 阵地：nantang-mobile/  禁区：server/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## F. 一营-②：用户亲报 P0 5 项
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：砚仁 18:00+ 原话
  - 内容：
    · F1 撤回任务一次撤回（⑨ 修了但砚仁实测仍需 2 次）
    · F2 牛皮糖弹窗（关不掉 + 关掉又弹）
    · F3 冰箱放物品无反应（A4 写入流未修）
    · F4 设置按钮重复（全貌页 + 个人工作台）
    · F5 世界终端不见（⑫ 修了 admin 入口但用户实测不见）
  - 测试：砚仁冒烟 5 条全过
  - 阵地：nantang-mobile/  禁区：server/
  - 5 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## G. 一营-③：归档文件/时间线字号统一
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：砚仁 18:00+ 原话
  - 内容：
    · 档案室点不开（点击无响应）→ 排查档案室入口
    · 归档文件时间线字体不一致 → 排查所有 var(--g-font-size) 使用
    · 个人工作台/全貌页/归档文件 字体统一令牌
  - 阵地：nantang-mobile/  禁区：server/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## H. 一营-④：田间重设计
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：UI-DESIGN-PACK ③ + 砚仁 18:00+ 怒报
  - 内容：按设计 ③ 实施（4 块田 + 圆形 SVG 进度 + 阶段 emoji + 状态点 + 4 动作）
  - 阵地：nantang-mobile/  禁区：server/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## I. 一营-⑤：住宿深化
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：UI-DESIGN-PACK ⑦ + 砚仁 18:00+ 怒报
  - 内容：弹窗顺序整理 + 退房明细（住宿费+餐饮+服务+余额）+ 换房确认
  - 阵地：nantang-mobile/  禁区：server/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## J. 一营-⑥：共享厨房 FE
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：DESIGN-共享厨房_v0.md
  - 内容：共享厨房页（接龙/预订/物品）+ 厨房面板联动
  - 阵地：nantang-mobile/  禁区：server/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## K. 一营-⑦：教学引导
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：UI-DESIGN-PACK ①
  - 内容：7 步游戏化引导（🐱 小人 + 7 步 + 30 NT 奖励）
  - 阵地：nantang-mobile/  禁区：server/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## L. 一营-⑧：活动页深化
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：UI-DESIGN-PACK ⑤
  - 内容：3 层 Tab（今日/列表/历史）+ 6 活动类型
  - 阵地：nantang-mobile/  禁区：server/
  - 1 commit，**只 commit 不 push**

━━━━━━━━━━━━━━━━━━━━━━━━━━
## M. 一营-⑨：订餐页
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 法源：UI-DESIGN-PACK ⑥
  - 内容：今日菜单 + 订餐表单 + 我的订餐历史
  - 阵地：nantang-mobile/  禁区：server/
  - 1 commit，**只 commit 不 push**

【约束】
  - 二营：甲乙丙丁 4 窗可并行（不同文件不冲突）
  - 一营：①②③④⑤⑥⑦⑧⑨ 1 窗串行
  - git add 具名（禁 -A）
  - 只 commit 不 push
  - 砚仁 5 项亲报 P0 优先完工（5 commit 必先）
  - 不引第三方库 · 不重写已有
  - ?v= bump 与 commit 同号
  - 完工一项必派红队 A 验

【验收】
  - 砚仁冒烟 5 条 P0 全过（亲报先验）
  - 12 卡全部 commit
  - 红队 A 全验 PASS
  - 全部 271 passed / 0 failed / 8 skipped

【回执落盘】
  - 二营 4 卡：方案/任务卡/P3-二营*_回执_二营_2026-07-31.md
  - 一营 9 卡：方案/任务卡/P3-一营*_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **强依赖铁律**：BE 必先于 FE，FE 不接契约不开工
  - **数据表先行**：每模块先立表+端点契约，FE 按契约接线
  - **不批量派**：一营串行 9 项完工一项验一项，防假完工再发
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━