━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（二营 H 窗）
  卡号：REDTEAM-B-B3_shared_merge防种子丢失
  阶段：红队 B 盲点 #B3（🟡中）· 派工 P2
  施工方：二营 Qoder（后端 BE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 15:05
  法源：EMPIRICAL-B_验3项_回执_红队B_2026-07-31.md · 盲点 B3
  优先级：P2（红队 B 建议优先修）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  EMPIRICAL-🔴2.3 b96c208 引入 buildings 种子到 MapLocation.shared
  盲点：admin 可写覆写 shared 记录，导致 11 栋种子丢失
  真仓实证：sync_shared 路径允许 admin 写 shared
  风险：服务端种子数据被破坏，前端再次依赖硬编码兜底

【阵地】server/    【禁区】nantang-mobile/

【施工内容】

  ① server/routes/data.py sync_shared 加 shared 字段保护
     位置：sync_shared 函数体处理 'map_locations' 字段
     行为：
       - 检测 data['map_locations'] 是否含 'shared' key
       - 含 'shared' + 当前 user.role != 'admin' → 拒绝
       - 含 'shared' + admin → 仅允许 merge（不覆写整包）
     实现：
       if 'map_locations' in data and 'shared' in data['map_locations']:
           existing = await get_shared_map_location(db)
           # 合并而非覆写
           merged = deep_merge(existing, data['map_locations']['shared'])
           data['map_locations']['shared'] = merged

  ② 加 deep_merge 工具函数
     位置：server/utils/merge.py
     行为：递归合并 dict，list 替换
     测试：3 测（基本合并/嵌套合并/list 替换）

  ③ admin 写 shared 路径测试
     - admin 可更新 buildings 字段（merge）
     - admin 不可清空整包 buildings（仅 merge）
     - 非 admin 写 shared → 403

  ④ pytest 增 4 测（基线 234 → 238）

【约束】
  - 走 server/ 阵地
  - 禁区 nantang-mobile/
  - **只 commit 不 push**
  - 不引第三方库
  - 不影响 sync_shared 其他字段（presence 已验 ✅）

【回执落盘】
  方案/任务卡/REDTEAM-B-B3_回执_二营_2026-07-31.md

【太傅注 3 行】
  - **merge 而非覆写** — 种子保护核心
  - **deep_merge 必须递归** — 浅合并 buildings 列表被覆盖
  - **不影响其他字段** — presence / camps / inventory 走原路径
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
