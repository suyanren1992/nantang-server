# 任务卡使用说明（三方协作入口 · 2026-07-25 v4 改制）

> 砚仁 = 皇帝（看政绩，最终拍板）
> Kimi Work = 丞相（**只做四件事：设计/发卡、朝会主持、争议终审、push 闸口**；不做日常验收，不下场写代码）
> Claude Code = 施工一营（前端阵地 `nantang-mobile/` 为主，**兼二营交付的验收席**）
> 豆包 Codex = 施工二营（后端阵地 `server/` 为主，2026-07-25 入伍，**兼一营交付的验收席**）
>
> ~~Kimi Code = 监察~~ **2026-07-25 裁撤**：与丞相同一流量池、成本过高。
> 其考古职责并入一营（D-14），抽检职责由交叉验收 + 丞相抽检覆盖。

## 当前卡片（D 系列 · 源自《全面权限扫描_B方案_2026-07-24》+ 07-24 夜战复盘）

| 卡 | 内容 | 严重度 | 施工 | 验收 | 状态 |
|---|---|---|---|---|---|
| D-2 | CORS 通配符 + credentials → 精确白名单 | 🔴 Critical | 豆包 Codex | Claude Code | 🟡 待施工 |
| D-3 | 注册 invite_code 服务端静默丢弃 + 登录用户枚举 | 🔴 Critical | 豆包 Codex | Claude Code | 🟡 待施工 |
| D-4 | 用户名 LIKE 通配符注入（`%` 看全量数据） | 🔴 High | 豆包 Codex | Claude Code | 🟡 待施工 |
| D-5 | 资金端点无行锁（提现/cashout/充值意向/验证并发） | 🔴 High | 豆包 Codex | Claude Code | 🟡 待施工 |
| D-10 | 营地结算无权限校验（任意用户结算任意营地） | 🟠 Medium | 豆包 Codex | Claude Code | 🟡 待施工 |
| D-11 | 前后端契约勘察（驳回/提现/cashout/checkout 未对接） | 🟠 勘察卡 | 豆包 Codex | Claude Code | 🟡 待勘察 |
| D-6 | 新手引导 newbieQuests 格式冲突 + 脏污度 NaN | 🔴 High | Claude Code | 豆包 Codex | 🟡 待施工 |
| D-7 | 任务状态变更每次触发 400 静默失败 | 🟠 High | Claude Code | 豆包 Codex | 🟡 待施工 |
| D-8 | sync_shared 混合 camelCase/snake_case（两步走） | 🟠 High | Claude Code | 豆包 Codex | 🟡 待施工 |
| D-9 | UI 批次：小屏裁剪/safe-area/原生弹窗/搜索防抖/滚动锁定 | 🟠 Medium | Claude Code | 豆包 Codex | 🟡 待施工 |
| D-12 | presence 翻牌状态跨设备同步 | 🟠 Medium | Claude Code | 豆包 Codex | 🟡 待施工 |
| D-13 | 田间管理劳务区分（先考古设计稿，照稿施工） | 🟠 考古+施工 | Claude Code | 豆包 Codex | 🟡 待考古 |
| D-14 | 社区公约版本化考古（找旧版工作，回报后丞相设计） | 🟠 考古卡 | Claude Code | 豆包 Codex | 🟡 待考古 |

> 已完成销账（07-24 夜战，Kimi Work 直修 dcc2b08）：报告 H-6/B16 确认弹窗乱码、
> 滑块左侧线框（真因：废弃居中指示器 CSS 冲突）、入住按钮白字、冰箱双门统一、
> 放入物品写错空间、地图配置克隆层 ID 错位、⚙️图标角色判定、journal 上报、用户列表拉取。

## 施工顺序

- **二营（豆包 Codex）**：D-2 🔴 → D-3 🔴 → D-4 🔴 → D-5 🔴 → D-10 → D-11（勘察）
- **一营（Claude Code）**：D-6 🔴 → D-7 → D-8 → D-9 → D-12 → D-13（先考古）→ D-14（考古卡）
- 两营阵地不同（server/ vs nantang-mobile/），可并行推进；跨端卡（D-8/D-12）由卡面 owner 全权，另一营回避涉及文件

## 流转规则（每张卡走完整四步）

```
① 勘察（卡面指定方，只读不改）→ 结论写 BUG_TRACKER.md
② 施工（卡面指定营）→ 单独 commit，不 push
③ 对营交叉验收（一营的货二营验，二营的货一营验）：
   验收方审 git diff + 跑卡里验收命令 + 机检脚本，
   结论「通过/打回+原因」写 BUG_TRACKER.md
④ 通过则由丞相（Kimi Work）push 上线 → 砚仁冒烟看政绩
```

- **交叉验收即对抗审核**：验收方与施工方是不同模型，互为盲区互补；验收不过不得 push
- **打回不服 / 两营结论分歧 / 验收标准有争议** → 升帐，丞相终审，终审裁决写 BUG_TRACKER.md
- 丞相不逐卡过闸，只对 BUG_TRACKER.md 里的「通过」记录抽检式复核

## 给豆包 Codex 的开场白（施工二营 + 一营验收席，复制即用）

```
项目根目录：C:\Users\苏砚仁\thinknote\项目\实景游戏移动端代码_new
先读 方案/任务卡/README.md 的卡片总表和流转规则（v4 交叉验收制）。
你有两重身份：
【施工】你是施工二营，阵地是 server/ 目录。
施工顺序：D-2 → D-3 → D-4 → D-5 → D-10 → D-11（勘察卡，只读不写代码）
1. 只改卡里点名的范围，一次一张卡；nantang-mobile/ 是一营阵地，不许碰
   （D-8/D-12 两张跨端卡归一营，server/routes/data.py 你不要动）
2. 改完跑卡里验收命令；需要并发验证的写最小验证脚本
3. 单独 git commit（用卡里的 message），不要 push
4. 结果摘要追加到 BUG_TRACKER.md
【验收】一营（Claude Code）每交付一张卡（D-6/D-7/D-8/D-9/D-12/D-13/D-14），
你是对抗验收方：审它的 git diff、跑卡里验收命令，
结论「通过/打回+原因」写 BUG_TRACKER.md。验收要严格，不许放水。
遇到卡里没写清的情况，停下来在 BUG_TRACKER.md 记录疑问，不要自由发挥。
```

## 给 Claude Code 的开场白（施工一营 + 二营验收席，复制即用）

```
项目根目录：C:\Users\苏砚仁\thinknote\项目\实景游戏移动端代码_new
先读 方案/任务卡/README.md 的卡片总表和流转规则（v4 交叉验收制）。
你有两重身份：
【施工】你是施工一营，阵地是 nantang-mobile/。
施工顺序：D-6 → D-7 → D-8 → D-9 → D-12 → D-13（先考古后施工）→ D-14（考古卡，只读不改，结论写 BUG_TRACKER.md）
（D-8/D-12 是跨端卡归你全权，可动 server/routes/data.py 对应端点，其余 server/ 文件不许碰）
1. 只改卡里点名的范围，一次一张卡
2. 凡改 nantang-mobile/ 下 js/css，同 commit 升 index.html 对应 ?v= 版本号（铁律6）
3. 改完跑卡里验收命令，浏览器实测类必须实测
4. 单独 git commit（用卡里的 message），不要 push
5. 结果摘要追加到 BUG_TRACKER.md
【验收】二营（豆包 Codex）每交付一张卡（D-2/D-3/D-4/D-5/D-10/D-11），
你是对抗验收方：审它的 git diff、跑卡里验收命令，
结论「通过/打回+原因」写 BUG_TRACKER.md。验收要严格，不许放水。
遇到卡里没写清的情况，停下来在 BUG_TRACKER.md 记录疑问，不要自由发挥。
```

## 铁律（三方都遵守）

1. 只移不删；一次一个目标；心脏文件（nt-core.js / app-data.js / api.js）的卡只由 Kimi Work 写
2. 施工营只 commit 不 push；push 一律由丞相（Kimi Work）执行（push = 上线 Render）
3. **交叉验收**：一营的货二营验、二营的货一营验；验收不过不得 push；丞相只在两营争议时出场终审
4. **两营分阵地**：一营 `nantang-mobile/`、二营 `server/`；跨端卡由卡面指定 owner，非 owner 回避涉及文件；同一文件同一时刻只有一方改
5. 所有政绩以 BUG_TRACKER.md + git log 为凭，口说无凭
6. **凡改动 nantang-mobile/ 下 js/css 文件，必须同 commit 升级 index.html 里对应文件的 ?v= 版本号**（缓存不刷新=线上跑旧代码=修了等于没修，C-5/D-1 两次踩坑）
7. 丞相不冲锋：Kimi Work 只做设计/发卡、朝会主持、争议终审、push 闸口；代码修改一律归施工营，日常验收一律归对营
