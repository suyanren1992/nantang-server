# 任务卡使用说明（三方协作入口）

> 2026-07-23 · 新制：**Claude Code = 施工单位（所有代码修改）· Kimi Code = 监察（排查+校验，不动手修）· Kimi Work = 设计+验收 · 砚仁 = 皇帝（看政绩）**

## 当前卡片

| 卡 | 内容 | 施工 | 状态 |
|---|---|---|---|
| A-5 | 村落滑动卡片不居中 | Claude Code | ✅ 已修待验（997334d） |
| A-6 | 注册/登录密码小眼睛回归 | Claude Code | ✅ 已修待验（723b36b） |
| A-12 | 社区动态点不进去 + 明晰用途 | Claude Code | ✅ 已修待验（9288301） |
| A-7 | 校核确认后奖励 NT 没到账 | Kimi Code | ✅ 已修待验（e10349b） |
| C-1 | 密码眼睛点不了（A-6复修） | Claude Code | 🟡 待施工 |
| C-2 | 滑块居中后跳转太慢（A-5复修） | Claude Code | 🟡 待施工 |
| C-3 | 滑块左侧多余方框 | Claude Code 修 / Kimi Code 先排查 | 🟡 待施工 |
| C-4 | 数据库迁 Neon 免费 Postgres（路B定案 07-24） | 监察勘察→Claude Code 施工→监察校验 | 🔴 优先 |
| C-5 | 社区动态仍点不开+无小字（A-12复修） | Claude Code 修 / Kimi Code 先排查 | 🟡 待施工 |
| C-6 | 确认后余额仍无+N（A-7复修） | Claude Code 修 / Kimi Code 先排查 | 🔴 优先 |
| C-7 | 社区池起始值500（照多钱包稿） | Claude Code 修 / Kimi Code 先读稿核查 | 🟡 待施工 |
| B-1 | 田间管理面板照稿改造 | Claude Code | 🟡 待施工 |
| B-2 | 厨房冰箱双门面板照稿改造 | Claude Code | 🟡 待施工 |
| B-3 | 全貌页与建筑页数据同源 + 大扫除补全房间 | Claude Code 修 / Kimi Code 先排查 | 🟡 待施工 |
| B-8 | 我需要帮忙跳任务大厅 + 待校核隐去上报人 | Claude Code | 🟡 待施工 |
| B-9 | 校核通过写入档案室归档 | Claude Code | 🟡 待施工 |
| B-10 | 校核确认前作证提示（文案已定稿） | Claude Code | 🟡 待施工 |
| B-11 | 脑力劳动渠道（设计已批准 07-23） | Claude Code | 🟡 待施工（排 C 类后） |
| 换房优化 | O1 房价环境变量化 + O2 换房先请求后改本地 | Claude Code | ⏸ 非阻塞 |

## 流转规则（每张卡走完整的四步）

```
① Kimi Code 排查（只读不改）→ 断点结论写 BUG_TRACKER.md
② Claude Code 施工（按卡+排查结论修）→ 单独 commit，不 push
③ Kimi Code 监察（审 diff + 跑验收命令 + 实测）→ 通过/打回写 BUG_TRACKER.md
④ 砚仁或 Kimi Work push 上线 → 砚仁冒烟看政绩
```

## 给 Kimi Code 的开场白（监察，复制即用）

```
项目根目录：C:\Users\苏砚仁\thinknote\项目\实景游戏移动端代码_new
先读 方案/任务卡/README.md 的卡片总表和流转规则。你是监察，不是施工：
1. 排查任务：按优先级 C-4 🔴 → C-6 🔴 → C-5 → C-3 → C-7 → B-3，
   只读不改，断点结论（文件:行号+证据+修法建议）写进 BUG_TRACKER.md
2. 监察任务：Claude Code 每提交一张卡，你审 git diff、跑卡里验收命令、
   浏览器实测，结论「通过/打回+原因」写进 BUG_TRACKER.md
3. 你永远不改业务代码；发现施工错了就打回，不替它修
遇到架构级问题（如数据库持久化），只报告不动手。
```

## 给 Claude Code 的开场白（施工，复制即用）

```
项目根目录：C:\Users\苏砚仁\thinknote\项目\实景游戏移动端代码_new
先读 方案/任务卡/README.md 的卡片总表和流转规则。你是施工单位，所有代码修改都归你。
施工顺序：C-1 → C-2 → C-4🔴 → C-6🔴 → C-5 → C-3 → C-7 → B-1 → B-2 → B-3 → B-8 → B-10 → B-9 → B-11
（带🔴和标注「Kimi Code 先排查」的卡：先读 BUG_TRACKER.md 里它的排查结论再动手）
1. 只改卡里点名的范围，一次一张卡
2. 改完跑卡里验收命令，浏览器实测类必须实测
3. 单独 git commit（用卡里的 message），不要 push
4. 结果摘要追加到 BUG_TRACKER.md
遇到卡里没写清的情况，停下来在 BUG_TRACKER.md 记录疑问，不要自由发挥。
```

## 铁律（三方都遵守）
1. 只移不删；一次一个目标；心脏文件（nt-core.js / app-data.js / api.js）的卡只由 Kimi Work 写
2. Claude Code 只 commit 不 push；push 由砚仁或 Kimi Work 执行（push = 上线 Render）
3. Kimi Code 是监察：可排查、可校验、可打回，永不改业务代码
4. 同一时刻只有一方改代码，commit 后另一方才动手
5. 所有政绩以 BUG_TRACKER.md + git log 为凭，口说无凭
