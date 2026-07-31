━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营戊）
  卡号：P3-二营戊_camps-schedule补
  阶段：BE 13 路由补全收尾（砚仁 18:35 批乙）
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex + 红队 A
  立卡：丞相 Codex 2026-07-31 18:40
  法源：K-REDTEAM-FIX_BE13路由补全_v0.md #13 + 砚仁 18:35 批乙
  优先级：P0（红队 A 13 路由第 13 项·数据黑洞未完全堵上）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【背景】
  K 窗红队 A 列 13 路由第 13 项 `/api/camps/schedule` ——
  二营 47d1c7d 用了 /api/camps（已存在列表端点）替代，未补独立端点。
  砚仁 18:35 批乙：「补 /api/camps/schedule 1 行路由」。

【施工内容 · 1 路由 + 2 测试】

  ### 第 1 步：加 /api/camps/schedule 路由
  server/routes/camps.py：

  ```python
  @router.get("/schedule")
  async def camps_schedule(
      start_date: str = None,  # 可选 YYYY-MM-DD
      end_date: str = None,
      user: User = Depends(get_current_user),
      db: AsyncSession = Depends(get_db)
  ):
      """GET /api/camps/schedule — 营地时间表聚合视图。

      返：
      - 跨所有 active 营地的 schedule 字段合并
      - 按日期升序排序
      - 标 camp_id + camp_name
      - 容量/CV 摘要
      """
      result = await db.execute(
          select(Camp).where(Camp.status != "archived")
          .order_by(Camp.created_at.desc()).limit(100)
      )
      items = []
      for c in result.scalars():
          try:
              sched = json.loads(c.schedule) if c.schedule else []
          except (json.JSONDecodeError, TypeError):
              sched = []
          if not sched:
              continue
          for ev in sched:
              items.append({
                  "camp_id": c.id,
                  "camp_name": c.name,
                  "event": ev,  # {date, time, title, capacity, ...}
              })
      # 按 date 升序
      items.sort(key=lambda x: (x["event"].get("date",""), x["event"].get("time","")))
      # 过滤日期范围
      if start_date:
          items = [i for i in items if i["event"].get("date","") >= start_date]
      if end_date:
          items = [i for i in items if i["event"].get("date","") <= end_date]
      return {"ok": True, "count": len(items), "items": items}
  ```

  ### 第 2 步：测试
  server/tests/test_camps_schedule.py（新建）：

  - test_camps_schedule_returns_aggregated_events
    建 2 个 Camp，各塞 2 个 schedule 事件 → 调端点 → 返 4 个 item 按 date 升序
  - test_camps_schedule_filters_by_date_range
    start_date=2026-08-01 → 仅返 8 月事件
  - test_camps_schedule_handles_missing_schedule
    Camp 无 schedule 字段 → 不崩，跳过

  ### 第 3 步：清理 main.py 注释
  server/main.py 第 5 行附近：

  ```python
  # 修改前（注释残留「田间接龙」）
  app.include_router(potluck_router)         # P1-#6 ③ 田间接龙

  # 修改后
  app.include_router(potluck_router)         # K-REDTEAM-FIX ① 共享厨房接龙
  ```

【约束】
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - 1 commit（camps.py + test_camps_schedule.py + main.py）
  - pytest 全绿（基线 271 passed + 3 新测 = 274）
  - **只 commit 不 push**

【回执落盘】
  方案/任务卡/P3-二营戊_camps-schedule补_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **schedule 不是 list** — list 是营地清单，schedule 是时间表，语义不可混
  - **3 测覆盖 3 判据** — 聚合 / 日期过滤 / 缺字段容错
  - **注释清理同步** — 与 8867b0b 删「田间断掉」目标保持一致
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━