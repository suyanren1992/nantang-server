━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  卡号：GATE-1
  施工营：二营（Qoder · BE）
  阵地：server/scripts/deploy_check.py + server/routes/nt.py（1 行注释）
  立案：丞相 Codex 2026-07-31 23:25
  法源：砚仁 22:30 批甲（GATE-1 并入 2 营）
  优先级：P1（闸门自身缺陷 · 假绿灯）
  基线：284 passed / 7 failed（预存 DB 隔离）/ 8 skipped
  目标：287+ passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【背景 · 闸门盲区实证】

  红队 B 根因① 是「api.js 用裸路径 /fields（缺 /api）→ 404 → catch 兜底 → 恒走本地假数据」。
  FE-API-2 又发现 6 处同类裸路径（storage×3 / archive×1 / users-settings×2）。

  **这两次 deploy_check 的「API契约」检查都是 PASS。**

  根因：契约检查只验「前端调的路径后端有对应路由」。
  裸路径 '/storage/items' 不匹配任何后端路由时，被当作**未知路径跳过**而非报错。
  → 假绿灯。本该被闸门拦住的两次 P0 都溜过去了。

【施工项（3 项）】

  ① deploy_check.py 加「/api 前缀强制」规则
     位置：API契约检查段（_extract_fe_calls / 契约比对处）
     规则：扫 nantang-mobile/js/*.js 所有 this.request('METHOD', '<path>' 的 path 字面量，
           凡不以 '/api/' 开头 → 记为 FAIL，打印文件:行号 + 路径
     · 白名单：如有确实不走 /api 的（例如外部 CDN、about:blank），显式列白名单常量
       并在代码注释说明为什么豁免。若无则不设白名单。
     · 输出格式与现有五检一致（PASS/FAIL 对齐）
     · 变量拼接的路径（'/api/fields/' + id）只判前缀字面量部分，不做求值

  ② 自检：改完后跑一次 deploy_check --skip-smoke
     当前 api.js 已全部补齐 /api（1 营 d5ad543 修完），所以应仍 PASS。
     ⚠️ **必须验反向**：临时把 api.js 某一行改成裸路径 → 跑 deploy_check → 应 FAIL
        → 改回 → 应 PASS。这一步是本卡唯一真判据，务必在回执里贴出两次输出。
        （反向验证后 api.js 必须还原，git diff nantang-mobile/ 应为空）

  ③ nt.py:1326 注释更正（1 行）
     现状：
       # 池空时的劳动价值由劳动 NFT 承载（方案/设计/NFT-三层经济设计稿_v1.md）
     问题：该设计稿已被砚仁 23:10 御批冻结，移入 方案/归档/冻结/。
           注释指向不存在的路径，会误导后人以为 NFT 方案在推进。
     改为：
       # 池空时直接拒绝派工（见本函数上游 400 分支），不补印、不欠账。

【测试（3 测 · server/tests/test_gate1_api_prefix.py）】
  · test_deploy_check_detects_bare_path
    — 构造临时 js 内容含裸路径，调检查函数，断言返回 FAIL/非空违规列表
  · test_deploy_check_accepts_api_prefix
    — 同上但用 /api/ 前缀，断言无违规
  · test_current_api_js_all_prefixed
    — 直接扫真实 nantang-mobile/js/api.js，断言违规列表为空（回归哨兵）

  ⚠️ 若 deploy_check.py 现有结构不便单测（全是 main 里的过程代码），
     允许抽一个纯函数 `check_api_prefix(js_dir) -> list[str]` 出来供测试调用，
     main 里调这个函数。这是必要重构，不算超范围。

【判据】
  ┌────┬──────────────────────────────────────────────┬──────┐
  │ 1  │ 反向验证两次输出已贴回执（裸路径→FAIL，还原→PASS） │      │
  │ 2  │ deploy_check --skip-smoke 当前 → 六检全 PASS     │      │
  │ 3  │ 3 测全绿                                       │      │
  │ 4  │ 全量 287+ passed，预存 7 failed 未增             │      │
  │ 5  │ nt.py:1326 注释已改，无「NFT」字样                │      │
  │ 6  │ git diff nantang-mobile/ 为空（反向验证已还原）    │      │
  │ 7  │ 只 commit 不 push · git add 具名                 │      │
  └────┴──────────────────────────────────────────────┴──────┘

【明确不做】
  · 不改 api.js（1 营阵地，且已修完）
  · 不动其他五检逻辑
  · ❄️ NFT/SBT 相关一律不做（砚仁 23:10 已冻结）

【回执落盘】
  方案/任务卡/GATE-1_回执_二营_2026-07-31.md
  必含：反向验证的两次 deploy_check 输出原文

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
