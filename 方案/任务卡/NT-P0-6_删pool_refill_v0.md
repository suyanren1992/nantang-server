━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  卡号：NT-P0-6
  施工营：二营（Qoder · BE）
  阵地：server/  【禁区 nantang-mobile/ 零触碰】
  立案：丞相 Codex 2026-07-31 22:30
  法源：砚仁 21:35「绝对不能自己造」→ 已批甲：删 pool_refill
        设计稿：方案/设计/NFT-三层经济设计稿_v1.md §二 Layer 1 铁律
  优先级：P0（经济安全 · 全面审查双重击中）
  基线：275 passed / 8 failed（顺序污染·单跑全绿）/ 8 skipped
  目标：278+ passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【背景】
  NT 是唯一「钱」，只能从链上真钱充值来。平台绝不印。
  现状 server/routes/nt.py:1325-1332 每日无条件印 20 NT：
    if pool.balance < 300:
        pool.balance += 20
        pool.total_issued += 20
        await _add_ledger(db, lid_r, None, "community_pool", 20, "pool_refill", ...)
        results["pool_refill"] = 20
  ledger 的 from_account 是 None = 无出资方 = 凭空印。
  年通胀 7,300 NT。砚仁已批：删。

  ⚠️ 池空后的劳动价值由「劳动 NFT」承载（设计稿 Layer 2），本卡不做，Phase 1 另派。

【施工项（4 项串行）】

  ① 删 pool_refill 整段
     文件：server/routes/nt.py
     · 删 1325-1332 整段（含注释行「# 2. 社区池补填」）
     · 编号顺延：原「# 3. 盈余划拨」改「# 2. 盈余划拨」
     · results 初始化（nt.py:1266）里的 "pool_refill": 0 **保留**
       理由：前端可能读该字段，删键会 KeyError；保留恒 0 更安全
     · 在原位置加注释留痕：
       # 【NT-P0-6】pool_refill 已删除 — NT 只从链上充值来，平台绝不印。
       # 池空时的劳动价值由劳动 NFT 承载（方案/设计/NFT-三层经济设计稿_v1.md）

  ② except Exception: pass 补日志（5 处）
     · server/routes/nt.py:1121 → logger.warning("归档失败不阻塞校核: %s", e)
     · server/routes/nt.py:1141 → logger.warning("周任务状态更新失败不阻塞校核: %s", e)
     · server/routes/nt.py:1159 → logger.warning("新人任务状态更新失败不阻塞校核: %s", e)
     · server/database.py:182   → logger.warning("迁移跳过: %s", e)
     · server/chain_scanner.py:130 → logger.warning("scanner 异常提前返回: %s", e)
     要求：except Exception as e: 形式，logger 用各文件已有 logger（无则 logging.getLogger(__name__)）
     ⚠️ 不改控制流，只加日志。database.py 里 await session.rollback() 的那些**不动**（有意为之）

  ③ 测试（3 测 · 新文件 server/tests/test_nt_p0_6_no_mint.py）
     · test_daily_tick_no_pool_refill
       — 池 balance 设 < 300，跑 daily_tick，断言 balance 未增加
     · test_no_pool_refill_ledger
       — 跑 daily_tick 后，断言 ledger 中无 reason='pool_refill' 的记录
     · test_total_issued_unchanged
       — 断言 pool.total_issued 跑 tick 前后相等

  ④ 全量回归
     cd server
     $env:JWT_SECRET='test-secret-key-for-ci-32bytes-long'
     ..\.venv\Scripts\python.exe -m pytest tests/ -q -p no:cacheprovider --tb=no
     要求：278+ passed，8 预存 failed 不增加

【判据】
  ┌────┬──────────────────────────────────────┬──────┐
  │ #  │ 判据                                  │ 证据 │
  ├────┼──────────────────────────────────────┼──────┤
  │ 1  │ grep pool_refill 在 nt.py 只剩         │      │
  │    │ results 初始化 1 处 + 注释             │      │
  │ 2  │ 无 pool.total_issued += 20            │      │
  │ 3  │ 5 处 except pass 已加 logger.warning  │      │
  │ 4  │ 3 测全绿                              │      │
  │ 5  │ 全量 278+ passed，预存 failed 未增     │      │
  │ 6  │ 禁区 nantang-mobile/ 零改动            │      │
  │ 7  │ 只 commit 不 push · git add 具名       │      │
  └────┴──────────────────────────────────────┴──────┘

【回执落盘】
  方案/任务卡/NT-P0-6_回执_二营_2026-07-31.md
  格式：交付表（文件/改动行数）+ pytest 前后对比 + commit hash

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  【卡面更正 · 丞相 22:55】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ②项范围缩小：nt.py 三处 except pass 已由 2 营 `3ae6ef9` 完成
  （1121/1141/1159 均已 logger.warning + exc_info=True）。

  ② 修正后只做 2 处：
     · server/database.py:182  → 真 pass（迁移跳过）
       改 logger.debug("迁移跳过: %s", e)  ★用 debug 不用 warning，避免启动噪音
     · server/chain_scanner.py:130 → 静默 return
       改 logger.warning("scanner 提前返回: %s", e) 后再 return

     不动：chain_scanner.py:72/101/110（已有 print，统一改 logger 另案 P2）
     不动：database.py 其余 await session.rollback() 分支（有意为之）

  ①项（删 pool_refill）**未做**，仍是本卡核心。
  丞相 22:55 亲证 nt.py 仍有：
     1330  await _add_ledger(db, lid_r, None, "community_pool", 20, "pool_refill",
     1332  results["pool_refill"] = 20

  基线更正：2 营已推进到 P0⑤，pytest 基线需自行跑一遍确认再对比。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
