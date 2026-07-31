━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：W6-P（presence 断链修复 · 后端）
  施工方：二营 Qoder（千问）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【优先级】MID（room.people 永空，楚门窗口基础；数据也将喂 Wave6 南塘此刻弹幕）

【阵地】server/    【禁区】nantang-mobile/（本卡零改动）

────────────────────────────
【症状】在地人员 NPC 渲染断链——room.people 永远为空，
  房间/地块看不到"谁此刻在这"。

【勘察结论】BUG_TRACKER.md:635-637 已定位修法：
  · server/routes/data.py：sync_shared 加 presence 写入
    （复用 MapLocation key="presence"）
  · sync_all 加 presence 下发

【施工内容】
  ① data.py sync_shared：接收并持久化 presence（MapLocation key=presence）
  ② data.py sync_all：下发 presence 给客户端
  ③ 施工前先 `git log` 核对现状——避免重复施工/覆盖
     （总账记 C-6 系列旧改动 4d0e714 曾落库，须先核）
  ④ 新增测试：presence 上行写入 → sync_all 下发可读回

【禁区】nantang-mobile/ 零改动（前端渲染另开 W6-P-FE 派一营）

【铁律】
  · 只 commit 不 push
  · git add 具名（禁 -A），只碰 server/
  · commit: "fix(W6-P): presence 写入+下发 · 二营"
  · 回执落盘 方案/任务卡/W6-P_回执_二营_2026-07-30.md
  · pytest tests/ -q 全绿（基线 136 passed, 8 skipped）

【回执四件套】① 改动 diff 摘要 ② pytest 结果 ③ 禁区确认(mobile=0) ④ 太傅注三行
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
