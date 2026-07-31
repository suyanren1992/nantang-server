━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营施工 · 数据 P0）
  卡号：DB-P0-2_NT-HTTP模式断裂_v0
  阶段：数据表全面监察 v2 · 3 P0 之 #2
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-31 13:50
  法源：数据表全面监察报告_v2_2026-07-31.md · 附录 C #2
  优先级：P0（NT 经济 HTTP 模式断裂）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【问题】
  位置：nantang-mobile/js/nt-core.js:66-68
  现状：HTTP 模式下本地 NT 引擎清空后不同步回服务端
  代码：
    if (mode === 'http') {
      this.localLedger = [];  // 清空本地
      // ❌ 缺：调 API.syncNTState() 从服务端拉回
    }
  影响：用户切到 HTTP 模式后本地 NT 引擎空，所有 NT 操作走服务端但前端显示异常

【阵地】nantang-mobile/    【禁区】server/

【施工内容】

  ① nt-core.js:66-68 HTTP 模式切完调 sync
     旧：
       if (mode === 'http') {
         this.localLedger = [];
       }
     新：
       if (mode === 'http') {
         this.localLedger = [];
         // 同步拉服务端 NT 状态
         return this._syncFromServer();
       }

  ② 加 _syncFromServer() 方法
     行为：
       1. 调 API.getNTState() 拉服务端 NT 余额 + ledger
       2. 用服务端数据覆盖 this.localLedger
       3. 触发 UI 刷新

  ③ API.getNTState() 端点（如果后端没有）
     位置：server/routes/nt.py
     端点：GET /api/nt/state
     返回：{ balance, ledger, frozen, last_sync }

     **注意**：2 营已在 sync_all 返回 NT 状态，可考虑复用 /api/data/sync_all 而不是新建端点。

  ④ 切模式测试
     - HTTP 模式切换触发服务端拉取
     - 本地 ledger 与服务端对齐
     - UI 显余额正确

  ⑤ OpenAPI 契约检查
     - 如果新建 /api/nt/state，加入 openapi_2026-07-31.yaml
     - 如果复用 sync_all，注明 nt-core.js:66 调的是 sync_all

【约束】
  - 等 1 营修缮 F1/F2/I1 完工后再接此卡
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - **只 commit 不 push**
  - ?v= bump 与 commit 同号

【紧急召唤】
  - 切模式发现服务端无对应端点 → call 丞相派 2 营
  - _syncFromServer 发现 UI 刷新链断 → call 丞相

【回执落盘】
  方案/任务卡/DB-P0-2_回执_一营_2026-07-31.md

【执行时间线】
  - 等待 1 营修缮 F1/F2/I1 完工后开工
  - 预计 1h

【太傅注 3 行】
  - **HTTP 模式断裂是双轨制副产物**——本地引擎 + 服务端引擎切换时没做数据迁移
  - **首选复用 sync_all**——2 营已有端点，避免新建
  - **1 营先修缮**——DB-P0-2 等修缮完，避免撞 1 窗
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
