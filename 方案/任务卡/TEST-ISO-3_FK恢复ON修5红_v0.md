━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  卡号：TEST-ISO-3
  施工营：二营（Qoder · BE）
  阵地：server/tests/conftest.py + server/tests/test_db_p0_1.py
        + server/tests/test_inn_rooms_list.py
  立案：丞相 Codex 2026-08-01
  法源：砚仁 07-31 批「甲」——测试环境须与生产同构，FK 必须 ON
  优先级：P1（测试基础设施 · 拆除假绿灯）
  基线：294 passed / 0 failed / 8 skipped（FK OFF 下的虚假全绿）
  目标：294 passed / 0 failed / 8 skipped（FK ON 下的真全绿）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【病灶：TEST-ISO-1 的 0 红是关掉外键换来的】

  conftest.py:38-43 现有这段：

      @event.listens_for(engine.sync_engine, "checkout")
      def _force_fk_off(dbapi_conn, connection_record, connection_proxy):
          cur.execute("PRAGMA foreign_keys=OFF")

  而生产 database.py:81 是 `PRAGMA foreign_keys=ON`。
  → 测试环境比生产宽松。悬空外键引用在测试里永远照不出来，上线才炸。
  → 这与 GATE-1 修掉的「假绿灯」是同一类病，只是搬进了 conftest。

  丞相实证（把 OFF 改 ON 跑全量）：
      5 failed, 289 passed, 8 skipped in 196.25s
      test_db_p0_1.py::TestVoteRightStrict ×3
      test_inn_rooms_list.py::TestInnRoomsList ×2
      失败原因均为 sqlite3.IntegrityError: FOREIGN KEY constraint failed

【根因：不是数据造假，是同 flush 内的 INSERT 顺序】

  丞相三次探针实证（新建空库 + FK ON）：

  · PROBE-A：同一个 flush 里 s.add(User) + s.add(Tenancy) → FAIL
  · PROBE-B：先 s.add(User) 后 commit，再 s.add(Tenancy) 后 commit → OK
  · PROBE-C：同 flush，日期改 str 排除类型干扰 → 仍 FAIL
              打印 INSERT 顺序 = ['tenancies']   ← User 的 INSERT 根本没发出去

  结论：models.py 里 Tenancy.user_id 有 ForeignKey("users.id")，但
  **User 与 Tenancy 之间没有 relationship()**（全仓 relationship 数 = 0）。
  SQLAlchemy 无从得知两表的依赖顺序，同 flush 时按 mapper 注册序排 INSERT，
  先插 tenancies → 此刻 users 里还没有那行 → FK 失败。

  所以这 5 条测试**不是烂测试，是写法踩了 ORM 的坑**。
  测试数据本身合法（room_id 无 FK 约束，指向 map_locations 是弱引用，不违规）。

  生产侧无此问题：accommodation.py:114/175 建 Tenancy 时，user 来自
  已 commit 的登录态，不在同 flush 内新建。**这是纯测试写法问题，非业务 bug。**

【施工方向】

  第一步 · 拆掉 FK OFF（必做）
    删除 conftest.py 的 _force_fk_off 事件监听，改为 FK **ON**，与生产 database.py:81 一致。
    注意：_isolate_db 的 teardown 清表须保持 FK 逆序 DELETE，
    FK ON 后顺序错会直接报错——这正是我们要的约束。

  第二步 · 修 5 条测试的写法（二营自选实现）
    目标：让 User 的 INSERT 先于 Tenancy 落库。可选路径：
    · 甲：s.add(User) → await s.flush() → s.add(Tenancy) → await s.commit()
         （最小改动，一行 flush，推荐）
    · 乙：拆成两个 session/两次 commit
    · 丙：在 models.py 给 Tenancy 加 relationship("User")，让 ORM 自己排序
         —— 治本但动生产模型，需额外回归，慎选；若选此路须单独说明理由

    硬约束：
    1. **不许改任何业务断言** —— 只能改测试的数据准备(arrange)段
    2. 不许 skip / xfail / 不许给这 5 测加 FK OFF 局部豁免
    3. 不许把 room_id 改成真实房间号来"绕"——room_id 无 FK，不是失败原因，
       改它属于答非所问
    4. 全量耗时 < 250s（当前 196s~227s，已贴近上限，勿再拖慢）

【判据】
  ┌────┬────────────────────────────────────────────────────┬──────┐
  │ 1  │ conftest.py 中 PRAGMA foreign_keys 为 ON，无 OFF 残留 │      │
  │ 2  │ 全量 pytest → 0 failed，passed ≥ 294                 │      │
  │ 3  │ 连跑 2 次结果一致 + 贴完整 summary 尾行               │      │
  │ 4  │ 反向验证：临时把某测的 flush 撤掉 → 该测转红（证明     │      │
  │    │ FK 约束真生效，不是又被绕开）· 附前后两段输出          │      │
  │ 5  │ git diff 仅含 conftest.py + 那 2 个测试文件            │      │
  │    │ （若选丙路则含 models.py，须说明）                     │      │
  │ 6  │ deploy_check 六检全 PASS · exit 0                     │      │
  │ 7  │ 全量耗时 < 250s，贴实测秒数                            │      │
  │ 8  │ 只 commit 不 push · git add 具名                       │      │
  └────┴────────────────────────────────────────────────────┴──────┘

  判据 4 是本卡的唯一真判据。TEST-ISO-1 的教训：
  「全绿」本身不是证据，「能照出红」才是证据。

【为什么必须做】
  砚仁的「平台绝不印」铁律，最终靠 nt_ledger 的 from_account 完整性守住。
  nt_ledger 有 FK。FK OFF 意味着账本悬空引用在测试里永远照不出来。
  删 pool_refill 的决心，不该被一行 PRAGMA 抵消。

【回执落盘】
  方案/任务卡/TEST-ISO-3_回执_二营_2026-08-01.md
  必含：判据 4 的反向验证前后两段原文 + 连跑 2 次 summary + 耗时
  （方案/ 已于 e891b8d 入仓，回执写完即 git add 具名提交）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
