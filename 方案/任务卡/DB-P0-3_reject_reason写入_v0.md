━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营施工 · 数据 P0）
  卡号：DB-P0-3_reject_reason写入_v0
  阶段：数据表全面监察 v2 · 3 P0 之 #3
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 13:50
  法源：数据表全面监察报告_v2_2026-07-31.md · 附录 B-3 + C #3
  优先级：P0（校核拒绝原因静默丢失）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  端点：POST /api/nt/verifications/{vfy_id}/reject（nt.py:1124-1146）
  现状：
    - 端点函数签名无 reject_reason 参数
    - Verification 表有 reject_reason 列
    - 对比 verify_task（nt.py:720）有 eject_reason: str = Body("") 接收并写入
  影响：校核拒绝原因静默丢失，前端无法展示拒绝理由

【阵地】server/    【禁区】nantang-mobile/

【施工内容】

  ① nt.py:1124 reject_verification 加 reject_reason 参数
     旧：
       @router.post("/verifications/{vfy_id}/reject")
       async def reject_verification(vfy_id: str, body: dict = Body(default={})):
     新：
       @router.post("/verifications/{vfy_id}/reject")
       async def reject_verification(
           vfy_id: str,
           reject_reason: str = Body("", embed=True),
           ...  # 现有参数
       ):

  ② 写入 vfy.reject_reason
     位置：reject_verification 函数体
     新增：
       vfy.reject_reason = reject_reason.strip()[:500]  # 限 500 字
       vfy.rejected_by = user.id
       vfy.rejected_at = datetime.utcnow().isoformat()

  ③ 响应加 reject_reason
     返回 JSON 含 reject_reason 字段
     前端（校核拒绝 toast）能展示

  ④ 测试
     - 正常 reject + reject_reason → 写入
     - 空 reject_reason → 写入空字符串
     - 长 reject_reason → 截断到 500 字
     - verify_task 的 reject_reason 不受影响

  ⑤ OpenAPI 契约更新
     - openapi_2026-07-31.yaml 加 reject_verification request body schema

【施工规则】
  - 1 营 1 窗 串行
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - **只 commit 不 push**
  - pytest 全绿（基线 213 + 新增 4 = 217）
  - ?v= 不适用

【紧急召唤】
  - 函数签名改了发现前端调用方不传 reject_reason → 立刻 call 丞相
  - 截断逻辑发现需要更长 → 立刻 call 丞相

【回执落盘】
  方案/任务卡/DB-P0-3_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **不修这 bug 校核体验差**——前端只能看到「已拒绝」看不到原因
  - **不破坏 verify_task 路径**——那个端点已经正确，拒改
  - **OpenAPI 同步**——拒绝契约漂移
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
