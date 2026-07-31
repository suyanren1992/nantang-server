━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营施工）
  卡号：UI-FIX-P2-BE_数据表先行_v0
  阶段：Phase 1 · BE 数据表 + 接口契约先行
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 12:50
  法源：UI-FIX-P2_BE先行FE接_总账_v0（Phase 1 详）
  优先级：P0（砚仁 12:42 御批「数据表先行」）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【派单理由】
  砚仁 12:42 御批「数据表是不是先应该先行」+「二营同步施工」
  1 营 FE 强依赖 2 营 B2/B3 端点（冰箱 G1/G2）—— 2 营先动 45min 出接口，1 营立刻接。
  砚仁 12:50 御批「开始」。

【阵地】server/    【禁区】nantang-mobile/

【施工内容 · 9 项 BE】

━━━━━━━━━━━━━━━━━━━━━━━━━━
B1. 建表 storage_items（核心，先做）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  字段：
    id (UUID, PK)
    user_id (FK users.id, NOT NULL, indexed)
    item_name (str, NOT NULL, max 100)
    category (str: 食物/工具/杂物, NOT NULL)
    quantity (int, default 1, min 1)
    storage_location (str: 冰箱/储物间/共享, NOT NULL)
    added_at (datetime, default now)
    expires_at (datetime, nullable)
  索引：(user_id, storage_location)
  迁移：走现有 database.py migration 流程

  测试：test_storage_model.py 3 用例
    - 建表成功
    - 必填字段约束
    - expires_at 过期过滤

━━━━━━━━━━━━━━━━━━━━━━━━━━
B2. POST /api/storage/items
━━━━━━━━━━━━━━━━━━━━━━━━━━
  路由：server/routes/storage.py
  入参：{item_name, category, quantity, storage_location}
  权限：Depends(auth)
  行为：
    - 验证 user 存在
    - 验证 category/storage_location 在 enum 内
    - 建 storage 记录
    - 返回新记录 + 200 OK
  错误：
    - 401 未认证
    - 400 字段缺失 / category 不在 enum
    - 500 DB 错误

  测试：test_storage_api.py 5 用例
    - 正常建
    - 缺字段 400
    - 未认证 401
    - category 错 400
    - DB 错误 500

━━━━━━━━━━━━━━━━━━━━━━━━━━
B3. GET /api/storage/items
━━━━━━━━━━━━━━━━━━━━━━━━━━
  路由：同 B2
  权限：Depends(auth)
  行为：
    - 拉当前 user 所有未过期（expires_at > now OR null）
    - 按 storage_location 分组
    - 返回 {冰箱: [...], 储物间: [...], 共享: [...]}

  测试：3 用例（正常 / 空 / 过期过滤）

━━━━━━━━━━━━━━━━━━━━━━━━━━
B4. DELETE /api/storage/items/:id
━━━━━━━━━━━━━━━━━━━━━━━━━━
  路由：同 B2
  权限：本人 OR admin
  行为：
    - 找记录
    - 校验权限
    - 软删（标记 deleted_at）或硬删（建议硬删，小数据）
    - 返回 204

  测试：3 用例（本人删 / admin 删 / 他人删 403）

━━━━━━━━━━━━━━━━━━━━━━━━━━
B5. 检查 GET /api/archive/items（档案室）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 端点是否存在
  - 字段是否完整（id/title/content/created_at/category）
  - 不改代码，只输出检查报告
  - 输出：方案/任务卡/UI-FIX-P2-BE_B5检查_2026-07-31.md

━━━━━━━━━━━━━━━━━━━━━━━━━━
B6. 检查 GET /api/fields（田间列表）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 端点是否存在
  - 字段是否完整（id/crop_name/planted_at/harvest_at/stage/health）
  - 不改代码，只输出检查报告
  - 输出：方案/任务卡/UI-FIX-P2-BE_B6检查_2026-07-31.md

━━━━━━━━━━━━━━━━━━━━━━━━━━
B7. 检查 GET /api/users/me/settings（设置）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 端点是否存在
  - 字段是否完整（notification/theme/language）
  - 不改代码，只输出检查报告
  - 输出：方案/任务卡/UI-FIX-P2-BE_B7检查_2026-07-31.md

━━━━━━━━━━━━━━━━━━━━━━━━━━
B8. 检查 GET /api/verifications（校核列表）
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 端点是否存在
  - 字段是否完整（id/task_id/verifier_id/status/created_at）
  - 不改代码，只输出检查报告
  - 输出：方案/任务卡/UI-FIX-P2-BE_B8检查_2026-07-31.md

━━━━━━━━━━━━━━━━━━━━━━━━━━
B9. OpenAPI 3.0 契约文档
━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 文件：方案/契约/openapi_2026-07-31.yaml
  - 含 B2-B8 端点定义
  - 含字段约束、错误码
  - 长度 ≤ 300 行
  - 1 营 FE 读契约后立刻开工

【施工规则】
  - 1 营 1 窗 串行 B1 → B9
  - 走现有 addVerification 校核闭环
  - 不引第三方库
  - 走 server/ 阵地
  - **只 commit 不 push**（等 FE 33 项一起推）
  - pytest 全绿（基线 169 + 新增 ≥ 14 用例）
  - ?v= 不适用

【紧急召唤】
  - 任何缺字段 / 字段不对 → 立刻 call 丞相
  - 丞相 5min 内派单

【回执落盘】方案/任务卡/UI-FIX-P2-BE_回执_二营_2026-07-31.md
【回执四件套】
  ① diff 摘要（按 B1-B9 列表）
  ② pytest 结果（基线 169 + 新增 ≥ 14）
  ③ 禁区确认（nantang-mobile=0）
  ④ 皇帝验收单

【执行顺序（关键）】
  1. B1 建表（30min）
  2. B2/B3/B4 端点（并行，45min）—— **45min 节点：1 营可接 G1/G2**
  3. B5-B8 端点检查（15min）
  4. B9 OpenAPI 契约（30min）—— **总 2h 节点：FE 全部就绪**

【太傅注 3 行】
  - **B1-B4 是 1 营强依赖**——2h 内必须出，否则 1 营会卡住
  - **B5-B8 是只检查不改**——避免 2 营返工影响 1 营
  - **B9 是契约基线**——1 营按契约写代码，2 营按契约测试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
