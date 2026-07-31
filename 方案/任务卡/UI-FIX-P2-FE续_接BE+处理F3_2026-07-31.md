━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营续单）
  卡号：UI-FIX-P2-FE续_接BE+处理F3
  阶段：Phase 2 续 · 1 营接 BE 端点 + 处理 F3
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 13:00
  法源：UI-FIX-P2-FE 第一波回执 + F3 真因 + BE 接口契约
  优先级：P0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【派单理由】
  一营第一波 11 项完工 + 二营 B1-B4 已交付：
  - **强依赖解**：G1/G2 可接 B2/B3 端点（storage_items）
  - **F3 真因已指认**：index.html:123 顶部 ⚙️ 按钮 + 点头像双入口
  - **C1-C4 需设计方向**：本卡先不接，等砚仁批设计稿
  - **第二波 4 项**（F1/F2/H2/I1）需二营 B5补/B6补/B7补

【阵地】nantang-mobile/    【禁区】server/

【续单施工内容 · 8 项】

━━━━━━━━━━━━━━━━━━━━━━━━━━
## A. F3 重复设置按钮修复（指认完成）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  F3 真因：
    - index.html:123 顶部 nav 栏有 ⚙️ 按钮 → 调 openSettings() → enderProfile('edit') 直接进编辑
    - 点头像进入 profileCard → 调 enderProfile('view')（含"通知设置"等）
    - **两条不同路，但都进设置区域 = 砚仁感觉"重复"**

  修复方案：
    - **方案 A**（推荐）：删 index.html:123 顶部 ⚙️ 按钮，统一走点头像
    - **方案 B**：保留 ⚙️，但改为调 openProfileView()（与点头像一致）

  1 营自行决定方案 A 或 B，但必须**只留一个入口**。

━━━━━━━━━━━━━━━━━━━━━━━━━━
## B. G1/G2 强依赖项（接 BE 契约）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  G1 冰箱「放入物品」按钮 onClick
    - 调 _openQuickSheet('放入物品') → 弹表单
    - 表单 submit 调 API.addItemStorage({item_name, category, quantity, storage_location})
    - 接口契约见 openapi_2026-07-31.yaml B2
    - 成功后调 _refreshStorage() + toast 成功
    - 失败 toast 错误

  G2 冰箱列表刷新
    - 调 API.getStorage() → 按 storage_location 分组渲染
    - 接口契约见 openapi_2026-07-31.yaml B3
    - 拉到的数据替换当前 _renderKitchenPanel() 内容
    - 列表只显未过期（expires_at > now or null）

  G3 冰箱「删除」按钮
    - 调 API.removeItemStorage(id)
    - 接口契约见 openapi_2026-07-31.yaml B4
    - 成功后 _refreshStorage()

━━━━━━━━━━━━━━━━━━━━━━━━━━
## C. 第二波弱依赖项（先做 H2，B8 已有）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  H2 校核室整体 UI.Card 重包
    - 校核列表：UI.Card 网格
    - 校核详情：UI.Modal + UI.Card
    - 状态/提示/等待：UI.Card + StatusBadge
    - B8 端点已存在（/api/data/verifications），可直接接

━━━━━━━━━━━━━━━━━━━━━━━━━━
## D. 第三波强依赖项（等二营 B5补/B6补/B7补）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  F1 全貌页/个人工作台时间线拆开（依赖 B5补）
  F2 全貌页设置按钮重写（依赖 B7补）
  I1 田间界面排查（依赖 B6补）

  1 营可先写 FE mock，等 BE 出后切真接口。

━━━━━━━━━━━━━━━━━━━━━━━━━━

【施工规则】
  - 1 营 1 窗 串行
  - 先 F3（不动 BE）→ G1/G2（接 B2/B3 端点）→ H2（接 B8 端点）→ 等 BE 补 → F1/F2/I1
  - 每项 1 commit
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - **只 commit 不 push**（等二营 B5补/B6补/B7补 一起推）
  - ?v= bump 与 commit 同号

【紧急召唤】
  - 接 B2/B3/B4 端点发现字段缺 → 立刻 call 丞相
  - F3 修复发现需改 BE → 立刻 call 丞相
  - C1-C4 设计方向未明 → 不要动手，等砚仁批

【回执落盘】
  方案/任务卡/UI-FIX-P2-FE续_回执_一营_2026-07-31.md
  包含 F3 修复方案选择 + G1/G2 接 API 验证 + H2 接 API 验证

【太傅注 3 行】
  - **F3 是治理债**——设置按钮双入口是历史欠账，1 营必须二选一删一个
  - **G1/G2 强依赖已解**——二营 B2/B3 端点已上，1 营立刻可接
  - **C1-C4 暂停**——设计方向未明，1 营不要猜
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
