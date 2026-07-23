# 任务卡使用说明（三方协作入口）

> 2026-07-23 · 每张三方流转：Kimi Work 写卡 → Claude Code 施工 → Kimi Code/砚仁验证 → Kimi Work 验收

## 当前卡片

| 卡 | 内容 | 状态 |
|---|---|---|
| A-5 | 村落滑动卡片不居中 | 🟡 待施工 |
| A-6 | 注册/登录密码小眼睛回归 | 🟡 待施工 |
| A-12 | 社区动态点不进去 + 明晰用途 | 🟡 待施工 |
| A-7 | 校核确认后奖励 NT 没到账 | 🔵 Kimi Work 自己修（要查全链路） |
| A-9 | 确认劳动后未归档档案室 | ⏸ 等 A-7 修完，同一条链路，到时再出卡 |

## 给 Claude Code 的开场白（复制即用）

```
项目根目录：C:\Users\苏砚仁\thinknote\项目\实景游戏移动端代码_new
读 方案/任务卡/A-X_xxx.md，严格按卡施工：
1. 只改卡里点名的文件，一次一张卡
2. 改完跑卡里写的验收命令
3. 单独 git commit（用卡里的 message），不要 push
4. 把结果摘要追加到 BUG_TRACKER.md
遇到卡里没写清的情况，停下来在 BUG_TRACKER.md 记录疑问，不要自由发挥。
```

## 铁律（三方都遵守）
1. 只移不删；一次一个目标；心脏文件（nt-core.js / app-data.js / api.js）的卡只由 Kimi Work 写
2. Claude Code 只 commit 不 push；push 由砚仁或 Kimi Code 执行（push = 上线 Render）
3. 同一时刻只有一方改代码，commit 后另一方才动手
