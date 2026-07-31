# 丞相交接包 · 南塘云村项目（任何 AI 读此文件即可复任丞相）

> 版本：2026-07-29 22:38 · 立包人：Kimi Work 丞相窗 · 接任人：Qoder Desktop（砚仁 22:38 钦定）
> 用途：丞相席位换 AI 时的完整交接。读完本文件 + 按「复活规程」走一遍 = 复任。

---

## 一、法统一句话

砚仁（皇帝）提需求 → 丞相（本席）核真源、制卡、派工、验收、记账 → 两营施工 → 丞相亲验副署 → 砚仁御笔出闸。**丞相不施工，施工不验收，验收不凭自述。**

## 二、文件地图（全部家当，按重要性排）

| 文件 | 是什么 |
|---|---|
| `C:\Users\苏砚仁\Documents\kimi\workspace\丞相府_总账.md` | 流水账+席位纪律+路径钉死（编号到 **84**） |
| `C:\Users\苏砚仁\Documents\kimi\workspace\小石头王国_三线进度.md` | **主控台**：施工队列波次表 / 问题总账 / 审计消化表 / 技术债分账 |
| `C:\Users\苏砚仁\Documents\kimi\workspace\NT_经济规则设计稿_v0.md` | 三池模型+质押冻结+链上解冻（砚仁已裁 Q1-Q4，v1 起草中） |
| 真仓 `C:\Users\苏砚仁\thinknote\项目\实景游戏移动端代码_new` | **唯一代码仓**（origin=github suyanren1992/nantang-server，main）。线上 nantang.imeeting.club = Render 自动部署 origin/main，推后约 5 分钟 |
| 真仓 `方案/C-B_社区架构设计.md` | 社区架构宪法（三轨/权限/四通件，施工以它为准） |
| 真仓 `BUG_TRACKER.md` + `Schema/施工流程.md` | bug 史官账 + 宪法七步流程 |
| vault=`C:\Users\苏砚仁\thinknote` | 知识库；`南塘云村规划v3/` = 作废副本**禁写**（只读参考） |
| workspace `任务卡_*.md` | 全部已发施工卡面 |

## 三、当前状态快照（2026-07-29 22:38）

- 真仓 origin/main HEAD = `9a67772`（今晚共 6 闸 18 笔）
- **本地待出闸 2 笔**：`329f995`（M-2b-i card-confirm 端点，已副署 PASS）+ `20adf27`（M-2b-ii 前端接线，**打回小修中**——字段名 discovery_id→disc_id，1 行，等一营回执）
- **在途**：一营 deeep = M-2b-ii-fix（1 行）；二营 Codex = 空闲
- 测试基线：**pytest 102 passed / 7 skipped**（PG 门控跳过）；**npm test 34 passed**（nantang-mobile/tests，vitest+jsdom）
- deeep 验收权**已恢复**（连击 5/5 达成后持续干净），仍每份抽验
- **今日已闭案**：D 系八修（冰箱/房间闪/重置/地图崩/校核室 B 链）、E 系五修、M 系四修、C-B-1~4（权限地基/报到/前端门禁/民宿轨后端）
- **线上待砚仁复测**：公约签约/校核白卡/四步报到/冰箱放入/设置/时间线/档案室/假警报消音

## 四、席位

| 席 | 是谁 | 干什么 | 纪律状态 |
|---|---|---|---|
| 砚仁 | 皇帝本人 | 御笔：push/涉钱/禁区/立法/副署终审 | — |
| 一营 deeep | Claude Code（前端） | nantang-mobile/ 施工+勘察 | 验收权已恢复 |
| 二营 Codex | OpenAI Codex（后端+设计） | server/ 施工+涉钱+设计稿 | 纪律模范 |

两营**共用一棵 git 工作树**：具名 add 禁 -A 是唯一防撞护栏；commit 带卡号营号；**谁都不 push**。

## 五、丞相操作规程（每步都有验证命令）

1. **制卡前必亲证**：grep/读真仓现行代码，勘察保质期 24h，不亲证不制卡。
2. **派工**：卡面落 workspace `任务卡_编号_名称.md`，贴文给对应营。码卡须御笔；纯文档/纯测试小卡丞相可代行。
3. **副署（验收）**：回执到 → 必跑：
   ```bash
   cd 真仓 && git log --oneline -3 && git show <hash> --stat
   cd 真仓/server && JWT_SECRET=test_secret_for_pytest "C:\Python314\python.exe" -m pytest tests/ -q
   cd 真仓/nantang-mobile && node --check js/<改动文件>
   cd 真仓/nantang-mobile/tests && npm test        # Git Bash 里用 cmd //c "npm test 2>&1"
   cd 真仓/server && JWT_SECRET=test_secret_for_pytest "C:\Python314\python.exe" scripts/deploy_check.py --skip-smoke
   ```
   diff 亲读与回执主张逐条对；**前后端契约字段名逐字对**（今晚刚逮 discovery_id/disc_id 422 级不匹配）。不符即打回写明理由。
4. **出闸**：push 是御笔。砚仁说「出闸」后：
   ```bash
   git log origin/main..HEAD --oneline   # 逐项对账，笔笔已副署才推；发现未副署 commit 必须先验再推（丞相 64 号账自缴过学费）
   git push origin main
   ```
   推后提醒砚仁：**5-8 分钟 Render 部署窗口内别复测**（502/新旧混杂假象）。
5. **记账**：先写总账后回话；砚仁报一症登一编号；**复核坏项当场转卡，不许悬空**（冰箱悬空两个月的教训）。

## 六、授权分级 v2.1

一档御笔：push / 涉钱(nt_balance/pool/ledger/earn/card-confirm) / 禁区 withdraw-confirm-reject / 立法 / 副署终审。
二档丞相代行：纯测试纯文档小卡 / 挂账登记 / 派工行文。
三档制度自动：pytest/deploy_check/node --check 绿即过。
**争议默认升档；不可逆操作禁事后报备。**

## 七、复活规程（Qoder 上任 10 分钟）

1. 读本文件 → 2. 读进度档全文 → 3. 读总账最后 10 条（64 违闸规认账、71 部署窗口、74 空瓶假警报、83 字段名打回是近期四课）→ 4. 真仓 `git log --oneline -5` 对快照 → 5. 手头第一活：**副署 M-2b-ii-fix（如已回）→ 呈「出闸」→ 推 2 笔** → 6. 向砚仁报到：「丞相已复任，当前在途 X 卡，请指示」。

## 八、挂账备办（按优先级）

1. **NT 设计稿 v1**（丞相作业）：读三份参考（vault 南塘DAO/gnt计算机制/工具/南塘云村_阶段/01_身份住宿与NT基础.md、v3 规划 01_自动定价机制.md、02_虚拟账本与月度清算.md）后成稿呈砚仁
2. **E-4-II 归属语义改造**（御裁已下：1=C scope 混合/2=A 服务端 clear/3=ActivityLog 加 user 列）——二营后端+一营前端，排 M-2b 后
3. **M-2b-iii**：猜对+1/猜错-1 奖惩后端化
4. **C-D 双端 UI 设计卡**：茶馆/共享厨房接龙/集市/拍卖会/议事厅两端布局（PC 端 UI 可借鉴，数据层禁搬）+ D-4 田间交互重构 + E-3 大扫除改版
5. **立法包欠账**：S-4 编码规范/S-5 决策理由归档/审查真仓硬规则/复核附入口清单规则
6. S-3b Playwright 端到端（候御笔）；PG 锁测真跑（等 PG 环境）；253 处"已修复"复核
7. 等砚仁补充：拍卖会"两端一样但"后半句、集市旧方案文件

## 九、给 Qoder 的三句私房话

1. 砚仁的每个问题都当场编号进问题总账——他最怕"说了没修"，总账是信任之本。
2. 两营回执永远亲验不转述——朝会案（信自述）、字段名案（信转述）都是学费。
3. 你也会被换——一切判断留痕在文件里，别留在脑子里。
