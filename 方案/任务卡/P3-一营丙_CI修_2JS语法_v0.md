━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  南塘云村 · 任务派发单（一营丙）
  卡号：P3-一营丙_CI修_2JS语法
  阶段：CI 红灯修（砚仁 19:42 批甲）
  施工方：一营 Claude Code（前端 FE）
  验收方：丞相 Codex + 红队 A
  立卡：丞相 Codex 2026-07-31 19:45
  法源：CI deploy_check FAIL 截图（砚仁贴）+ node --check 真验
  优先级：P0（机器闸门红灯·阻塞 push 闸口）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【背景】
  CI deploy_check FAIL · JS 语法机检 + API 契约机检双 FAIL
  push 闸口未通 · origin/main 仍 53a4931 · 88 commits 未推

【施工内容 · 2 JS 语法修 + 1 API 契约排查】

━━━━━━━━━━━━━━━━━━━━━━━━━━
## A. 修 app-data.js:271
━━━━━━━━━━━━━━━━━━━━━━━━━━

  node --check 报错：
    C:\..\app-data.js:271
      },
       ^
    SyntaxError: Unexpected token ','

  定位：_saveShared 内 setTimeout 闭包结构错位

  上下文（line 256-272）：
    var doWrite = function() {
      if (self._data && self._currentUser) {
        var payload = { ... };
        API.request('POST', '/api/data/sync_shared', payload);
      }
      this._timerS = setTimeout(doWrite, 200);  // BUG: this 错（应 self）
    },
    _save: function(immediate) { ... },

  修法：
    1. `this._timerS` → `self._timerS`（doWrite 内 this 不是 self）
    2. 验证 `},` close bracket 正确（close doWrite callback + close _saveShared）
    3. node --check 验证绿

  验证：node --check nantang-mobile/js/app-data.js

━━━━━━━━━━━━━━━━━━━━━━━━━━
## B. 修 ui-accom.js:187
━━━━━━━━━━━━━━━━━━━━━━━━━━

  node --check 报错：
    C:\..\ui-accom.js:187
      "<div...font-size:1.2rem">'+isMine?'🛏️':taken?'🛏️':'🛏️'}'+'</div>'+
                                                                          ^
    SyntaxError: Invalid regular expression: missing /

  定位：三元运算符优先级错（+isMine 优先于 ?:）

  原代码（line 185-189）：
    '<div style="font-size:1.2rem">'+isMine?'🛏️':taken?'🛏️':'🛏️'}'+'</div>'+

  修法（加括号）：
    '<div style="font-size:1.2rem">'+ (isMine?'🛏️':taken?'🛏️':'🛏️') +'</div>'+

  验证：node --check nantang-mobile/js/ui-accom.js

━━━━━━━━━━━━━━━━━━━━━━━━━━
## C. 排查 API 契约 CI 偏差（不动手·只查）
━━━━━━━━━━━━━━━━━━━━━━━━━━

  CI 报：前端调后端没有: PATCH /api/new_user_tasks/{}/complete

  实际：两处都存在
    前端 api.js:170: this.request('PATCH', '/api/new_user_tasks/' + encodeURIComponent(id) + '/complete')
    后端 new_user_tasks.py: @router.patch("/{task_id}/complete")（prefix=/api/new_user_tasks）

  排查路径：
    1. deploy_check.py 看 API 契约机检逻辑（用 grep 找 method/path 提取规则）
    2. 看是否 {task_id} vs {} 占位符不一致
    3. 看是否 api.js 解析有问题（this.request 调用方式）

  产出：1 段排查结论（不动代码，落到回执）
    - 若 deploy_check bug → 修 deploy_check.py
    - 若 1 营调用方式错 → 改 api.js
    - 若后端 prefix 错 → 改 new_user_tasks.py（但这是 2 营阵地）

【约束】
  - 走 nantang-mobile/ 阵地
  - 禁区 server/
  - 2 JS 修 = 1 commit（A+B 合并）
  - C 排查 = 回执内 1 段
  - 完工后砚仁重跑 deploy_check 验绿
  - **只 commit 不 push**

【验收】
  - node --check 2 文件绿
  - python server/scripts/deploy_check.py --skip-smoke 绿
  - 排查结论落回执

【回执落盘】
  方案/任务卡/P3-一营丙_CI修_2JS语法_回执_一营_2026-07-31.md

【太傅注 3 行】
  - **机器闸门不许绕过** — §四·🔴 修代码不修闸
  - **this vs self** — 闭包内 this 不是 self，A 卡常见坑
  - **三元运算符优先级** — `+x?a:b+c` 解析为 `(+x)?a:b+c`，必须加括号
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━