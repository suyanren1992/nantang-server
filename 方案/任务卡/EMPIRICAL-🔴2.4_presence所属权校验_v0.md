━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营）
  卡号：EMPIRICAL-🔴2.4_presence所属权校验
  阶段：实证审查 v2 · 4 🔴 之 #4
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 14:00
  法源：检查报告/全貌页与实景地图_实证审查报告_2026-07-31.md · §2.4
  优先级：P0（安全漏洞）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  server/routes/data.py sync_shared 端点
  接受 presence 字段
  现状：任何认证用户可写入任意 user_id 的 presence
  利用：用户 A 可伪造「B 在线」/「B 在地里」状态
  后果：篡改他人在线状态，影响 W6-P-FE 翻牌显示 + 治理权判定

【阵地】server/    【禁区】nantang-mobile/

【施工内容】

  ① data.py sync_shared 端点加所属权校验
     位置：sync_shared 函数体处理 presence 字段处
     旧：
       if 'presence' in data:
           # 写入
     新：
       if 'presence' in data:
           for uid, status in data['presence'].items():
               if uid != current_user.id and current_user.role != 'admin':
                   raise HTTPException(403, '无权修改他人 presence')
               # 写入

  ② 测试
     - 用户 A 写自己 presence → 200 OK
     - 用户 A 写 B presence → 403
     - admin 写任意 presence → 200 OK
     - 缺身份 → 401

  ③ sync_all presence 读取不受影响（只读路径）

  ④ 旧测试回归
     - W6-P presence 端到端测试（test_e2e_smoke.py:125-134）必须仍通过

【约束】
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - **只 commit 不 push**
  - pytest 全绿（基线 222 + 新增 ≥ 4 = 226）
  - 不引第三方库

【紧急召唤】
  - 校验逻辑发现合法场景被拒 → 立刻 call 丞相
  - 改 data.py 发现其他端点有同类问题 → 立刻 call 丞相派扩展卡

【回执落盘】
  方案/任务卡/EMPIRICAL-🔴2.4_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **安全 P0** — 在线状态可伪造 = 翻牌显示失真 + 治理权被利用
  - **admin 例外** — 管理员可改任意，符合 admin 全权预期
  - **只校验写路径** — sync_all 读取只读，无需校验
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
