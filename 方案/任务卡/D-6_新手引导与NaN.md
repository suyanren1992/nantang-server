# 任务卡 D-6：新手引导 newbieQuests 格式冲突 + 脏污度 NaN 🔴

> 施工方：Claude Code（一营） · 监察：Kimi Code · 验收：Kimi Work · 单独 commit，不 push
> 来源：《全面权限扫描_B方案_2026-07-24》H-4 + H-5（Kimi Work 复核补充：H-4 是条件性崩溃+进度恒显示 0，非"必崩溃"）

## 位置
- `nantang-mobile/js/data.js:59` `_initNewbieQuests` 存**数组**（`NEWBIE_QUESTS.map(...)`），`_completeNewbieQuest` 用 `.find()`
- `nantang-mobile/js/app.js:233` 附近（及 :2342）渲染路径在 quests 为空时初始化为**对象 map**（`quests[s.id] = {...}`），读取用 `quests[s.id]`
- `nantang-mobile/js/app.js:2067` `_growDirtiness`：`dirtiness + dailyGrowthBase * daysPassed`，旧数据缺字段 → NaN 扩散

## 问题
- 若渲染路径先执行（老用户无 `newbieQuests[me]`）→ 写入对象格式 → 之后 `_completeNewbieQuest` 的 `.find()` 必崩
- 即使不崩：数组格式在渲染路径下 `quests[s.id]` 全部读不到 → 进度恒显示 0/N、引导永不消失
- 脏污度 NaN → 打扫系统显示异常、定价错误

## 修法
1. **统一为数组**：app.js 两处渲染路径初始化改为与 data.js 一致的数组格式（`NEWBIE_QUESTS.map(...)` 含 done:false），读取进度改用 `.find(function(x){return x.id===s.id})`；判断空用 `quests.length===0`
2. `_growDirtiness` 加兜底：`(cl.spaces[b.id].dirtiness||0)` 和 `(cl.spaces[b.id].dailyGrowthBase||rate)`
3. 遵守铁律 6：同 commit 升 index.html 中 app.js 与 data.js 的 ?v=

## 验收
- 全新用户：引导出现、完成任务计数递增、全部完成后消失
- 模拟老用户（localStorage 里删 `newbieQuests`）：渲染不崩、格式自愈为数组
- 手动把某空间 `dailyGrowthBase` 删掉刷新：dirtiness 不 NaN
- commit message：`fix(D-6): newbieQuests 统一数组格式（H-4 引导崩溃/进度恒0）+ 脏污度 NaN 兜底（H-5）`
