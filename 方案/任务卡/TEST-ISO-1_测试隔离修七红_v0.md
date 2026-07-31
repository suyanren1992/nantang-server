━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  卡号：TEST-ISO-1
  施工营：二营（Qoder · BE）
  阵地：server/tests/conftest.py
  立案：丞相 Codex 2026-07-31 23:25
  法源：2 营 22:01 回执建议「修 conftest.py 一处可解七红」
  优先级：P1（测试基础设施 · 修一处解七红）
  基线：284 passed / 7 failed / 8 skipped
  目标：291 passed / 0 failed / 8 skipped
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【病灶】
  conftest.py:62 引擎 fixture 是 `scope="session"`，只在整场开头 create_all、结尾 drop_all。
  → 所有测试共享同一个 SQLite 库，无 per-test 回滚。
  → 前面测试插的 User/Tenancy/Camp 残留，后面测试撞 FK / UNIQUE 约束。

  实证：这 7 个失败**单独跑全部通过**，只在全量跑时红：
    test_db_p0_1.py::TestVoteRightStrict ×3
    test_dev_reset.py::test_hard_clears_four_new_tables
    test_inn_rooms_list.py ×2
    test_inn_track.py::test_hard_clears_inn_rooms

  已困扰多轮：每次施工都要人工分辨「哪些红是我弄的」，成本高且易误判
  （丞相 22:55 就因此误判过一次）。

【施工方向（二营自选实现，丞相不指定具体写法）】
  目标：per-test 隔离。任一测试的写入不影响其他测试。

  可选路径（择优，或另有更好方案）：
  · 甲：每个 test 用嵌套事务（SAVEPOINT）包裹，测试结束 rollback
  · 乙：function-scope 引擎 + 内存库（`sqlite+aiosqlite:///:memory:`），每测重建 schema
       — 注意会拖慢；如 create_all 太慢可只在 module scope 建
  · 丙：保留 session 引擎，但加 function-scope fixture 在每测后按 FK 逆序 TRUNCATE 全表

  硬约束：
  1. **不许改任何业务测试的断言来让它变绿** —— 只能改 conftest.py（及必要的 fixture 文件）
  2. 不许 skip / xfail 这 7 个测试
  3. 全量耗时不得超过现在的 2 倍（当前 ~126s，上限 ~250s）

【判据】
  ┌────┬──────────────────────────────────────────────┬──────┐
  │ 1  │ 全量 pytest → **0 failed**                     │      │
  │ 2  │ passed ≥ 291                                  │      │
  │ 3  │ git diff 只含 conftest.py（+必要 fixture 文件）  │      │
  │ 4  │ 无任何测试被 skip/xfail 新增                     │      │
  │ 5  │ 全量耗时 < 250s                                │      │
  │ 6  │ 连跑 2 次结果一致（证明不是随机撞对）              │      │
  │ 7  │ 只 commit 不 push · git add 具名                │      │
  └────┴──────────────────────────────────────────────┴──────┘

【为什么现在做】
  7 个常红 = 每次施工的信噪比污染源。
  丞相 22:55 的误判（把 2 营刚做的事记成「早已存在」）根子上也是
  「基线不干净 → 判断靠人工记忆 → 记错」。
  测试全绿是所有后续验收的地基。

【回执落盘】
  方案/任务卡/TEST-ISO-1_回执_二营_2026-07-31.md
  必含：连跑 2 次的完整 summary 行 + 耗时对比

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
