---
title: 任务卡 S-3a · 前端 jsdom 轻量单测
created: 2026-07-29
project: 南塘云村
type: 任务卡
domain: 前端测试
status: 已完成
batch: S-3a 二营
summary: S-3 裁定 A 先行——建 nantang-mobile/tests/ npm 骨架(vitest+jsdom)，首批锁无 DOM 纯逻辑三文件(utils/api/data)，34 单测全绿+tripwire 红灯自证，被测源码零改动。
author: 施工二营
---

# 任务卡 S-3a · 前端 jsdom 轻量单测

## 卡面（丞相签发）
- **裁定**：S-3 三项已裁——① A(jsdom 轻量单测)先行；② 落点 `nantang-mobile/tests/`（明文授权越阵地）；③ Playwright 起真 uvicorn（B 卡另议）。
- **越阵地授权（明文）**：仅限新建 `nantang-mobile/tests/` 目录及内部文件；被测源码（`js/*.js`、`index.html`）一律**只读**。

## 选型（自定 + 理由）
**Vitest + jsdom**（对比候选 Jest）：
1. **Node 24 原生兼容**：Vitest 走 esbuild/vite，对新 Node 版本零配置；Jest 需 babel 转译链更重。
2. **内建 jsdom environment**：`environment:"jsdom"` 直接提供 `window/document/localStorage`，正合「整文件 eval 挂全局」路线。
3. **断言 API 与 Jest 同源**（describe/it/expect），未来迁移零成本；跑得更快（本轮 34 测 ~2s）。

## 加载路线（沿 S-3 勘察）
- `helpers/load.js`：`fs.readFileSync` 整文件读出 → **间接 eval** `(0,eval)(code)` → 顶层 `var/function` 挂 `globalThis`(=jsdom window)。
- 源码只读：`loadSource()` 读 `../../js/`；`loadFixture()` 读 `../fixtures/`（试爆用，不碰真源码）。

## 覆盖（34 测，三文件各 ≥5）
| 文件 | 测数 | 覆盖点 |
|------|------|--------|
| utils.test.js | 16 | Clock `_setFrozen/today/hour/min/iso/_state/_reset`(UTC+8·`_p2`补零) · parseMD 多格式 · daysBetween/Since/Until · simpleHash/esc/escHtml/encodePassword/isOldPasswordFormat |
| api.test.js | 8 | 路径拼接(stub request 捕获)：deleteTask/rejectVerification/approveVerification/confirmWithdraw(encodeURI)/getLedger(qs)/devReset/archiveSummary |
| data.test.js | 8 | BRANCH_TITLES 六类阈值(repair=5/余=10) · TITLE_LADDER 单调 · computeTitle tier 落档+分支触发+discovery 累加 |
| tripwire.test.js | 2 | 试爆红灯：对植入 bug 的 fixture，真契约断言必抛(证明断言有牙) |

## 判据核销
- ✅ npm test 全绿 **34**（≥15，三文件各≥5）
- ✅ fixture 试爆红灯：一次性 demo 实测 `expected '2026-1-5' to be '2026-01-05'` FAIL，删除后复原全绿；tripwire.test.js 常驻守护（不碰真源码）
- ✅ 被测源码零改动：`git status nantang-mobile/js/ index.html` 空
- ✅ node_modules 入 `.gitignore`（`git add --dry-run` 零命中）
- ✅ 后端 pytest **69 passed / 5 skipped** 零回归

## 后续（B 卡候批）
S-3b Playwright 端到端（真 uvicorn+SQLite，K-2 harness 先例），攻 S-3 勘察 8 条核心路径。
