━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单
  卡号：W6-P-FE（presence 前端渲染断链）
  施工方：一营 Claude Code（前端）
  验收方：丞相 Codex
  立卡：丞相 Codex 2026-07-30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【优先级】MID（承接 W6-P：后端 presence 数据完好，坏在前端未渲染）

【阵地】nantang-mobile/    【禁区】server/（本卡零改动）

【背景】W6-P 终验确认：服务端 presence 写入/下发完整（data.py:419-431/513-533），
  端到端测试 PASS。「room.people 永空」真因在前端——sync_all.presence
  收到后未映射进 room.people。

【施工内容】
  ① 勘察 core.js _mergeSyncData：确认 sync_all 返回的 presence 是否落入本地 _data
  ② 定位房间/地块渲染读 room.people 的位置，补 presence → room.people 映射
  ③ 三态显示（皇帝 07-26 裁定）：🟢在地居住(在地+在线) / 🟡外出(外出+云在线) / ⚫离线
  ④ 自测：两账号 A 翻牌在地 → B 端房间可见 A 在此

【铁律】
  · 只 commit 不 push  · git add 具名(禁 -A)，只碰 nantang-mobile/
  · commit 例："fix(W6-P-FE): presence 映射进 room.people · 一营"
  · 回执落盘 方案/任务卡/W6-P-FE_回执_一营_2026-07-30.md
  · 回执须含【皇帝验收单】：改了哪/点哪/预期看到

【回执四件套】① diff摘要 ② 自测结果 ③ 禁区确认(server=0) ④ 皇帝验收单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
