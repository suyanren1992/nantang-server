
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  卡号：TEST-ISO-3
  施工营：二营（Qoder · BE）
  阵地：server/tests/conftest.py + server/routes/nt.py（1 行）
  立案：丞相 Codex 2026-08-01 00:15
  法源：丞相亲跑复核 TEST-ISO-2，确认 294 passed 真实但代价需登记
  优先级：P2（测试保真度 · 非阻塞）
  基线：294 passed / 0 failed / 8 skipped（217s）· deploy_check 五检 PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【背景 · 丞相亲跑三组对照实证】

  TEST-ISO-2 用 `PRAGMA foreign_keys=OFF`（checkout 事件强制）达成 294 passed / 0 failed。
  丞相把它改成 ON 重跑，得 289 passed / 5 failed：
    test_db_p0_1::TestVoteRightStrict ×3
    test_inn_rooms_list::TestInnRoomsList ×2

  | conftest 版本 | passed | failed | 耗时 |
  |---|---|---|---|
  | FK=OFF（当前 HEAD） | **294** | **0** | 217s |
  | FK=ON（丞相实验） | 289 | 5 | 192s |

  → 5 红确实是 FK 约束造成，2 营的根因判断**正确**。

【但代价必须登记（丞相判定）】

  2 营的修法是「关掉 FK 检查让测试过」，不是「让测试数据合法」。

  实证 `test_db_p0_1.py:93`：
    s.add(Tenancy(user_id="p01_vote_today", room_id="p01_room_a", ...))
                                            ^^^^^^^^^^^^^^^^^^^^
  · `p01_room_a` 在 inn_rooms 种子里**不存在**（种子只有素社 4 single + 2 quad）
  · `Tenancy.room_id` 在 models.py 里**没有 ForeignKey 声明**（只有注释「引用 map_locations 中的 roomId」）

  → 所以 FK 报错来自**别的表的真 FK**（user_id → users.id 等），
    而非 room_id。测试数据的「假 room_id」是设计上允许的（弱引用）。

  **结论：FK=OFF 让测试跑通，但同时也关掉了对「真 FK 违规」的检测能力。**
  以后如果有代码真的写坏了 user_id/camp_id 这类真 FK，测试不会红。
  这是**用保真度换绿灯**，不是白赚的。

  丞相不打回（294 绿是真实的、方案是可用的），但要求登记代价并加一条防护。

【施工项（3 项 · 都是小改）】

  ① conftest.py 加代价说明注释（在 `_force_fk_off` 上方）
     内容要点（自行组织文字，但必须含这 3 点）：
     · 为什么关 FK：SQLite 测试库无完整种子，测试数据用弱引用假 ID（如 room_id="p01_room_a"）
     · 代价：同时关掉了真 FK（user_id/camp_id）的违规检测能力
     · 后果：若业务代码写坏真 FK，测试不会红。生产 PG 仍强制 FK，届时才爆
     · 留一行 TODO：理想解是给测试补完整种子后开回 FK=ON

  ② 加一个「真 FK 哨兵测试」（server/tests/test_fk_sentinel.py · 1 测）
     目的：FK 全局关掉后，至少保留一处对真 FK 的检测。
     做法自选，参考思路：
     · 单独开一个 FK=ON 的临时 engine/连接
     · 插一条 user_id 指向不存在用户的记录（如 Tenancy 或 NTLedger）
     · 断言抛 IntegrityError
     → 证明「真 FK 违规在 FK=ON 环境下会被抓到」，
       这样以后有人误以为「FK 检测已彻底废弃」时，这个测试是活文档。

  ③ nt.py:1325 补回溯源标记（1 行）
     现状（`056b3f5` 把标记删了）：
       # 池空时直接拒绝派工（见本函数上游 400 分支），不补印、不欠账。
     改为：
       # 【NT-P0-6】pool_refill 已删除 — NT 只从链上充值来，平台绝不印。
       # 池空时直接拒绝派工（见本函数上游 400 分支），不补印、不欠账。

     理由：卡号标记是溯源锚点。以后有人问「这里为什么没有补池逻辑」，
     `grep NT-P0-6` 能直接找到卡面和回执。删掉标记等于断了线索。
     （2 营自己在回执「未处理」里也提了这条，准了。）

【判据】
  ┌────┬──────────────────────────────────────────────┬──────┐
  │ 1  │ conftest.py 注释含 3 要点 + TODO               │      │
  │ 2  │ test_fk_sentinel.py 1 测通过（证真 FK 可抓）     │      │
  │ 3  │ nt.py 有【NT-P0-6】标记（grep 命中）             │      │
  │ 4  │ 全量 295+ passed / 0 failed / 耗时 < 250s       │      │
  │ 5  │ 只 commit 不 push · git add 具名                │      │
  └────┴──────────────────────────────────────────────┴──────┘

【明确不做】
  · 不改回 FK=ON（会退回 5 红）
  · 不改任何业务测试的假 room_id（弱引用是设计允许的）
  · 不给测试补完整 inn_rooms 种子（工程量大，留 TODO 给未来）

【回执落盘】
  方案/任务卡/TEST-ISO-3_回执_二营_2026-08-01.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
