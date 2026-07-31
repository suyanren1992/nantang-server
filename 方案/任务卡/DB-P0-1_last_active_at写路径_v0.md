━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营施工 · 数据 P0）
  卡号：DB-P0-1_last_active_at写路径_v0
  阶段：数据表全面监察 v2 · 3 P0 之 #1
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 13:50
  法源：数据表全面监察报告_v2_2026-07-31.md · 附录 C #1
  优先级：P0（投票权活跃门控失效）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  治理权 v0.3.2 规则：last_active_at > 30 天 = 失去治理权（投票权）
  现状：全仓 grep 零写路径，governance.py:88 注释「若无 last_active_at 记录，默认通过」
  影响：投票权活跃门控完全失效，30 天没活跃的账户仍能投票

【阵地】server/    【禁区】nantang-mobile/

【施工内容】

  ① User 表加 last_active_at 字段
     字段：Date nullable
     迁移：ALTER TABLE users ADD COLUMN last_active_at DATE

  ② 写路径：所有 auth-required 端点中间件
     位置：新建 server/middleware/activity_tracker.py
     行为：JWT 解码后自动更新 user.last_active_at = today
     注册：所有 104 个端点 Depends(activity_tracker)
     注意：写库要轻量（避免每请求 full transaction）

  ③ governance.py:88 默认通过逻辑改为严格检查
     旧：
       if not user.last_active_at:
           return True  # 默认通过
     新：
       if not user.last_active_at:
           return False  # 严格：无记录 = 无活跃 = 不通过
       days = (date.today() - user.last_active_at).days
       return days <= 30

  ④ 测试
     - 首次 checkin 后 last_active_at 有值
     - 31 天前 last_active_at = 投票权失效
     - 今天 last_active_at = 投票权有效
     - 任何 auth 端点请求触发 last_active_at 更新

  ⑤ governance.py 测试方法
     - 改用 HTTP 路由触发，不再 ORM 直设
     - 或加 unit test 覆盖 last_active_at 路径

【施工规则】
  - 1 营 1 窗 串行 ① → ⑤
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - **只 commit 不 push**
  - pytest 全绿（基线 207 + 新增 ≥ 6 = 213）
  - ?v= 不适用

【紧急召唤】
  - 写中间件发现循环依赖 → 立刻 call 丞相
  - governance.py 改严格逻辑影响老用户 → 立刻 call 丞相

【回执落盘】
  方案/任务卡/DB-P0-1_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **默认通过是历史欠账**——v0.3.2 设计了 30 天但代码没实现，治理权因此失效
  - **中间件方案**——所有 auth 端点共用，避免每个端点手写
  - **影响老用户**——之前没写 last_active_at 的用户全部需要触发一次才有治理权
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
