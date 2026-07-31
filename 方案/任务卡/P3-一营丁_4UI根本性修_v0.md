━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营丁）
  卡号：P3-一营丁_4UI根本性修
  阶段：按红队 B 根因 4 项修复
  施工方：一营 Claude Code（前端 FE 1 窗串行）
  验收方：丞相 Codex + 红队 A
  立卡：丞相 Codex 2026-07-31 21:15
  法源：REDTEAM-B 4 项盲点报告 2fd8a25 + 砚仁 21:10 批丙
  优先级：P0（砚仁怒报·根本性修复）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【背景】
  红队 B 4 项根因（2fd8a25）：
  - 修的位置和实际渲染路径不对齐
  - 共同特征：commit 改了 A，但用户看到的是 B

  砚仁 21:10 批丙：两件并行
  - 派 1 营修 4 UI（按红队 B 根因）
  - 丞相出 NT 议单

【施工内容 · 4 项独立修复 · 1 营 1 窗串行】

━━━━━━━━━━━━━━━━━━━━━━━━━━
## A. 田间管理 P0（api.js 路径前缀）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  红队 B 根因：
  ① a0b7608 重写的 _showFieldSheet 是死函数（无人调）—— 实际走 openFieldPage → _renderFieldCards
  ② api.js 路径 /fields 缺 /api 前缀 → fetch 404 → 恒走本地假数据

  修法：
  1. 搜索 nantang-mobile/js/api.js 找 fields 相关
     期望：getFields / waterField / fertilize / harvest 调 this.request('GET', '/fields', ...)
  2. 改路径：'/fields' → '/api/fields'、'/fields/{id}/water' → '/api/fields/{id}/water' 等
  3. 验：grep -n "fields" nantang-mobile/js/api.js

  验证：
  - DevTools 看 Network /api/fields 200（不是 404）
  - 砚仁实测田间管理激活（不是本地假数据）

  1 commit（api.js 路径修复）

━━━━━━━━━━━━━━━━━━━━━━━━━━
## B. 校核提示字 P2（颜色 token 对比度）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  红队 B 根因：
  - 2babdcf 只改空状态容器背景，没改文字色 #999（对比 2.6:1 不达 WCAG AA）
  - 有数据态的提示文本完全没动

  修法：
  1. 搜校核卡片提示字渲染（"不能校核自己"等）
     期望：color: '#999' 或 color: #999
  2. 改：'#999' → 'var(--g-text-muted)' 或主题令牌
  3. 验：main.css 查 --g-text-muted 对比度 ≥ 4.5:1

  验证：
  - 砚仁实测提示字清晰可见
  - DevTools 算对比度 ≥ 4.5:1（WCAG AA）

  1 commit（提示字 token 替换）

━━━━━━━━━━━━━━━━━━━━━━━━━━
## C. 世界终端 P1（commit 找错）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  红队 B 根因：
  - 8a15f05 根本没加世界终端（只加了 visitor 入住引导）
  - 世界终端入口在更早 commit
  - 角色判断 role === 'admin' 与 isMember 不同层级

  修法：
  1. 搜 nantang-mobile/js/ 找 "世界终端" 字符串
  2. 找当前入口在哪、什么角色能看
  3. 确认 admin 角色判断对（user.role === "admin" 或 currentUser.role === "admin"）
  4. 修逻辑：确保 admin 可见、npc/visitor 不可见

  验证：
  - 砚仁 admin 登录看世界终端入口
  - 砚仁 npc 登录看世界终端入口（按 ⑫ 修复意图）

  1 commit（角色判断 + 入口逻辑）

━━━━━━━━━━━━━━━━━━━━━━━━━━
## D. 共享厨房 FE P0（接入 P3 后端 10 端点）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  红队 B 根因：
  - api.js 无 /api/kitchen/*（零接入）
  - 无 openKitchenPage()
  - 旧"厨房·冰箱"入口走的是冰箱储物面板

  修法（按 DESIGN-共享厨房_v0 设计稿）：
  1. nantang-mobile/js/api.js 加 10 端点方法
     - API.getPotluckList() = GET /api/kitchen/potluck/list
     - API.joinPotluck(eventId) = POST /api/kitchen/potluck/join
     - API.createPotluck(payload) = POST /api/kitchen/potluck/create
     - API.getKitchenSlots(date) = GET /api/kitchen/slots/list
     - API.bookKitchenSlot(payload) = POST /api/kitchen/slots/book
     - API.releaseKitchenSlot(slotId) = POST /api/kitchen/slots/release
     - API.getKitchenItems(category) = GET /api/kitchen/items/list
     - API.addKitchenItem(payload) = POST /api/kitchen/items/add
     - API.takeKitchenItem(payload) = POST /api/kitchen/items/take
     - API.removeKitchenItem(id) = DELETE /api/kitchen/items/{id}
  2. 新增 nantang-mobile/js/ui-kitchen.js
     - openKitchenPage() 主入口
     - 3 Tab：接龙 / 时段 / 冰箱
     - UI.Card 包裹
  3. 全貌页 _renderMgmtCards 厨房卡 onclick 改 openKitchenPage
  4. index.html 加 <script src="js/ui-kitchen.js?v=1"></script>
  5. ?v= bump：api.js → 32、ui-kitchen.js 新增 v=1

  验证：
  - 砚仁实测共享厨房页可见
  - 3 Tab 都能切
  - 放入物品 / 取出 / 接龙 / 预订都通

  1 commit（10 端点 + 1 新文件 + 入口改）

【约束】
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - 4 项 = 4 commit（A→B→C→D 串行）
  - 4 commit 同号 ?v= bump
  - 完工后砚仁冒烟 4 项
  - **只 commit 不 push**

【验收】
  - 红队 A 验 4 项（按 4 项根因）
  - 砚仁冒烟 4 项全过
  - deploy_check 五检全 PASS

【回执落盘】
  方案/任务卡/P3-一营丁_4UI根本性修_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **4 项独立 commit**——一营 1 窗串行 4 步，完工一项验一项
  - **api.js 路径前缀**——4 行改动激活整个田间 Card 范式，最高杠杆
  - **共享厨房 FE**——最大工作量 1 commit·按设计稿·别再加新功能
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━