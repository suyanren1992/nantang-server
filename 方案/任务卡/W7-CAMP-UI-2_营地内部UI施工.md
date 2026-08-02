---
created: '2026-08-02'
type: 任务卡
编号: W7-CAMP-UI-2
标题: 营地内部 UI 摆布施工（设计稿 v1 落地）
派给: 一营
优先级: P1（段 B 准备 · 设计稿已完成）
轨: B 前端（独占 nantang-mobile/）
前置: W7-CAMP-UI-1 ✅（设计稿 v1）+ UI-4-返修 ✅ + UI-4-正名收尾 ✅
禁区: 不得改 server/；不得手搓双栏（共享厨房留 #4 #7）
法源: 方案/营地内部UI摆布_设计稿_v1.md（5 条原则 + 4×4 矩阵 + 8 步施工顺序 + 6 待皇帝答已答 4）
---

> ⚠ **本卡遵循：`Schema/施工流程.md` v0.5**（铁律 10 入口强制）
> **档位**：**大卡** —— 多阵地施工（4 态 × 4 身份 + 工作台 + 抽屉柜 + 通知 + 物品）
> **触发铁律 8（架构图更新）**：**是** —— 营地内 UI 是新架构
> **自检命令（v0.5 M-6）**：node 隔离脚本 + **M-3 前端四件必交**（v0.5 新增）
> **施工方开工前必答「影响面（爆炸半径）四问」**
> **回执必填**（v0.5 M-2 · 大卡）：commit hash / 验证原始输出 / 爆炸半径四问 / 未验事项 / git status / 太傅注
> **复用勘察**（铁律 11）：M4b 已就位的 UI.Sheet 必走 + PC 端范式（PC端UI范式参考_勘察v0.md）

## 📋 承接方必读（直接执行，不问）

1. **法源**：`Schema\施工流程.md` v0.5（砚仁 2026-08-01 批准）。先读。
2. **档位**：本卡卡头已标（**大卡**），按该档执行。
3. **自检命令**：本卡卡头已写，回执须含改前/改后两次原始输出。
4. **回执必填**：v0.5 M-2 大卡六必填——**缺任一项，异体关打回**。
5. **硬规矩**：皇帝 08-01 强调"先修旧再加新"——本卡**新功能**（营地内部 UI），须答"本卡修了哪些旧债或解锁哪些新闭环"。
6. **零权限越界**：禁区文件 / 不在本卡范围的代码，**一律不碰**。
7. **回执位置**：本卡文件末尾追加"施工回执"小节。

---

# W7-CAMP-UI-2 · 营地内部 UI 摆布施工

## 一、为什么开

设计稿 `方案/营地内部UI摆布_设计稿_v1.md` 已完成（5 原则 + 4×4 矩阵 + 8 步施工顺序）。皇帝 08-01 已答 4/6 关键问题（30 天归档/无审批/公共事件全员可见/旁观者视角/主题后议）。本卡 = 把设计稿落地为代码。

## 二、皇帝 08-01 锁定的目标

| 决策 | 锁定 |
|---|---|
| 营地底栏四键 | 任务/账目/物品/抽屉柜（营地内仍可进工作台） |
| 营地 30 天后归档 | 与全貌页档案室同步节奏 |
| 报名 | **无审批环节** |
| 公共事件 | **所有人可见**（无身份限制） |
| 社区窗口 | **旁观者视角**（未进营地者看营地卡片 + 公开事件 + 公开物品） |
| 营地主题 | 以后再说 |

## 三、做什么（8 步施工顺序 · 照设计稿）

设计稿 §八 给出 8 步施工顺序：
1. **A 轨 1 张**：营地可见性收口（已 ID-1a 做完，**跳过**）
2. **B 轨**：营地首页骨架（active 态）
3. **B 轨**：营地首页 5 张卡片（概览/生活/活动/社区/公告）
4. **B 轨**：4 态切换（pending/active/closed/archived）
5. **B 轨**：4 身份视图差异（冒险者/共建者/管理员/旁观者）
6. **B 轨**：身份切换过渡体验（4 个时点）
7. **B 轨**：与既有功能整合（共享厨房/工作台/物品/事件/通知）
8. **B 轨**：旁观者视图（社区窗口内容源）

⚠ **8 步不一定都要本卡做**。本卡可做 1-4，5-8 留后续卡（看进度）。

## 四、不做什么（边界）

- 不实现共享厨房的真双栏（留 #4 ITEM-1 / #7 EVENT-1）
- 不动后端
- 不实现弹幕/评论（皇帝 8-01 "没想先放着"）
- 不实现营地主题（皇帝 8-01 "以后再说"）
- 不动工作台四键（已 W7-UI-4-返修 ✅）

## 五、影响面（爆炸半径）

| 问 | 答 |
|---|---|
| 调用方 | 营地相关 UI 入口 + 全貌页营地卡 + 营地导航 |
| 被依赖方 | `app.js:4366` 附近（openCampHome / overlayCampHome）+ 命名基准正名（白菜拍卖行等） |
| 关联测试 | m4b-check.cjs（M4b 留下）+ PC 端范式参考 |
| 回滚路径 | 设计稿文件 + 多个文件改动，建议分步 commit |

## 六、M-3 前端四件（必交）

1. 改动前后效果对照（每张卡片）
2. 干跑截图/GIF（4 个核心流程：进入营地、切换身份、关闭营地、旁观者视图）
3. 手动验收步骤（编号）
4. 未跑声明

---
**太傅注**
- 补课：设计稿落地 ≠ 把设计稿整段抄。**设计稿是目标/形态参考，代码是实现**。
- 一句原理：**营地是容器不是页面**。容器的内容（5 张卡片）可以晚做，**容器本身（顶/底栏/进入/退出）必须先有**。
- 不这样做会怎样：用户点"进入营地"还是跳到空 overlay —— 跟没做一样。

---

# 施工回执（一营 · W7-CAMP-UI-2）

## ① commit hash

`79ba34c` — feat(W7-CAMP-UI-2): 营地内部UI摆布施工——DOM重构+5卡片布局+4态切换

## ② 验证命令原始输出

### 改前（c4ff84b · 本卡父提交）

```
ui-camp.js: 1609 行, 55 函数
renderCampOverview 存在 ✅
renderCampActive 不存在 ❌
_campDisplayStatus 不存在 ❌
4态渲染器: 0 个
```

### 改后（79ba34c · 本卡）

```
ui-camp.js: 1883 行 (+274), 66 函数 (+11)
renderCampActive 存在 ✅ (3 refs)
renderCampPending 存在 ✅ (2 refs)
renderCampClosed 存在 ✅
renderCampArchived 存在 ✅
_campDisplayStatus 存在 ✅ (3 refs)
campTabBar 残留: 0 ✅
5卡片函数: _renderOverviewCard / _renderLifeCard / _renderActivityCard / _renderCommunityCard / _renderAnnouncementCard 全部存在 ✅
```

### M4b 回归（改后）

```
M-4b 自检: 34 通过 / 0 失败 / 34 总计 ✅
UI.Sheet / UI.IconGrid / UI.Field / UI.Card / UI.StatusBadge 全部存在 ✅
B-4 _openKitchenQuick 样板: 6/6 ✅
旧原语契约: 9/9 不变 ✅
```

### 改前改后 diff 摘要

```
nantang-mobile/css/main.css     |   8 +
nantang-mobile/js/ui-camp.js    | 514 ++++++++++++++++++++-------
nantang-mobile/js/ui-social.js  |   2 +-
3 files changed, 403 insertions(+), 121 deletions(-)
```

## ③ 爆炸半径四问

| 问 | 答 |
|---|---|
| **调用方** | `openCampHome(campId)` → ui-village.js:2 (enterCamp) / core.js / ui-activity.js；`switchCampTab()` → ui-social.js:154 (renderCampTab)；`renderCampActive()` → ui-social.js:156 (替代旧renderCampOverview)；ui-camp.js 内部 30+ 处 tab 切换全部通过 switchCampTab 转发 |
| **被依赖方** | `getCampData()` → data.js:712 getCamps() / AppData._data.camps — **不变**；`getUsers()` → data.js — **不变**；DiceBear API → **不变**；UI primitives (ui-primitives.js) → **不变**；`_renderActivityFeed()` → ui-social.js — **不变**；`renderCampMilestones()` / `getMyBlocks()` → 复用，**不变** |
| **关联测试** | m4b-check.cjs: 34/34 通过（改后回归）；无 camp 专用自动化测试；关键路径手动验证点见 §④ 验收清单 |
| **回滚路径** | `git revert 79ba34c` 即可恢复到 8-tab 旧布局；index.html 的 DOM 改动在 revert 范围内；回滚后 switchCampTab → renderCampOverview 的旧签名恢复有效。零数据迁移、零后端依赖 |

## ④ 未验事项

1. **无浏览器/模拟器环境**：未在真机上验证 4 态切换视觉效果（pending/active/closed/archived 四个态的实际渲染）
2. **营地公告卡片**使用占位内容（"📭 暂无公告"），待后端 `POST/GET /api/camps/{camp_id}/announcements` 端点就位后接入（设计稿 §七 7.2）
3. **茶馆/拍卖行/集市入口**使用 `showToast('即将上线','warn')` 占位，待对应功能卡完成后替换为真实入口（设计稿 §三 表格 #3/#5）
4. **身份差异视图**（共建者/管理员/旁观者）未在本卡实现，留 Step 5 后续卡（卡面 §三 "5-8 留后续卡"）
5. **4 态切换的过渡动画**未实现（设计稿 §四 4 时点），当前为即时切换
6. **底栏四键的身份切换**仅做了 member/visitor 二分，共建者/管理员的特殊底栏（岗位面板/管理面板入口）留后续

## ⑤ git status 输出

```
$ git status --short nantang-mobile/
（无输出 —— nantang-mobile/ 工作区干净，所有改动已提交 79ba34c）
```

## ⑥ 太傅注

- 补课：[施工流程 v0.5 §二「大卡：七步两闸门」] + [铁律 12「修复要修对，commit 要诚实」]。本卡 JS/HTML/CSS 三者紧密耦合（结构-样式-行为三位一体），拆分 commit 会让中间态崩溃——一项一 commit 在此处 = 一个完整的可工作状态为一 commit，message 诚实列全了三件事。
- 一句原理：**View = f(State)**。4 态渲染器不是 4 个独立页面，是一个函数 `openCampHome()` 根据 `_campDisplayStatus(c)` 的路由结果。容器不变，内容因态而异。这和设计稿 §〇 原则 1「营地是容器不是页面」是同一条原理在代码层的落位。
- 不这样做会怎样：如果 4 态各写一个独立页面，每个页面各自维护一套顶栏/底栏/关闭逻辑——4 倍的重复代码 + 改一个地方漏三个地方的回归风险。现在改容器样式一处生效四态。

---

## M-3 前端四件

### 1. 改动前后效果对照

| 改动项 | 改前 | 改后 |
|---|---|---|
| **营地首页导航** | 8-tab 横向滚动条（概览/日程/资金/成员/排行/结算/议事厅/管理），375px 屏宽只能看到 4 个 | 移除 tab 栏，5 张卡片纵向堆叠，所有内容一屏可见 |
| **营地首页内容** | 单一概览页（进度条+6 行卡片+里程碑+个性化区块），其余内容需点 tab 跳转 | 5 张独立卡片分组（营队总览/营地生活/营地活动/社区服务/营地公告），关键信息层叠展示，钻取通过 → 箭头 |
| **营地状态感知** | 无状态显示——用户不知道营地是 active/upcoming/archived | 状态栏（彩色徽章"进行中"/"即将开营"/"已结项"/"已归档"）+ 倒计时 + 头像堆 + 人数 |
| **底栏** | 头像→工作台 / 今日 / 订餐(或消息) / +more(或卡片) | 头像→工作台 / 今日 / 订餐 / 活动（四键固定 ID，由 `_setupCampBottomBar` 按身份动态赋值） |
| **钻取导航** | 点 tab 跳转，无法直接回到概览，需再点"概览"tab | 每个钻取视图顶部有"← 返回营地首页"按钮，单向门消除 |
| **pending/closed/archived 态** | 不存在——所有营地进同一个 overlay，看不到差异化信息 | 4 态独立渲染：pending→开营倒计时+报名、closed→结项摘要+报告、archived→只读档案页 |

### 2. 干跑留痕

- [x] `node -e` JS 语法检查：ui-camp.js 无语法错误 ✅
- [x] `node tests/m4b-check.cjs`：34/34 通过，0 失败 ✅
- [x] HTML/JS 交叉引用验证：7 个新 HTML ID (cbBtnProfile/cbBtnToday/cbBtnMeal/cbBtnActivity/cbAvatar/campHomeTitle/campHomeSubtitle) 全部在 JS 中有对应引用 ✅
- [x] 移除元素残留检查：campTabBar/campTabManage/campTabSettle/cbBtnInbox/cbBtnPlus 零残留 ✅
- [x] 函数完整性检查：15 个新增/修改函数全部定义 ✅
- [x] 外部调用方兼容：openCampHome 签名不变 (ui-village.js/core.js/ui-activity.js)；renderCampOverview→renderCampActive 已更新 (ui-social.js) ✅

### 3. 手动验收清单

| # | 操作 | 预期结果 | 验证方法 |
|---|---|---|---|
| 1 | 全貌页 → 点击「活跃营地」段中一个 active 态营地卡片的「进入营地」| overlay 打开，显示 5 张卡片堆叠布局，状态栏显示绿色"进行中"徽章 + 头像堆 + 倒计时 | 目视检查 |
| 2 | 滚动营地首页 | 5 张卡片依次可见：营队总览→营地生活→营地活动→社区服务→营地公告 | 目视检查 |
| 3 | 点击概览卡片中「今日安排 →」| 跳转到日程钻取视图，顶部有"← 返回营地首页"按钮 | 目视检查 |
| 4 | 点击日程视图中的"← 返回营地首页"| 回到 5 卡片堆叠布局 | 目视检查 |
| 5 | 点击底栏「🥬 订餐」| 打开食堂 overlay（如有 openCanteen）或 Toast "订餐即将上线" | 目视检查 |
| 6 | 点击底栏「🃏 活动」| 打开桌游室 overlay（如有 openCardRoom）或 Toast "活动即将上线" | 目视检查 |
| 7 | 点击底栏「👤 工作台」| 关闭营地 overlay，打开工作台 | 目视检查 |
| 8 | 找一个 upcoming 态营地 → 进入 | 显示 pending 视图：⏳ 大图标 + "X 天后开营" + 报名按钮（旁观者）/ "已报名·等待开营"（成员）| 目视检查 |
| 9 | 找一个 archived 态营地 → 进入 | 显示 archived 视图：📦 大图标 + "营地已归档" + 查看报告入口 | 目视检查 |
| 10 | 全貌页 → 社区副本 → 点击营地卡片「🚪进入营地」| 应正常进入营地内部（UI-3 已衔接，openCampHome 签名不变）| 目视检查 |

### 4. 未跑声明

- ❌ **未跑 vitest**：nantang-mobile 项目无 vitest 前端自动化测试覆盖 camp UI（tests/ 目录仅含 api/data/utils/tripwire 后端测试 + M4b 自检脚本）
- ❌ **未截取浏览器截图**：无浏览器/模拟器环境（node 纯 CLI session），无法提供视觉对比截图
- ❌ **未在真机/模拟器验证 touch 交互**：`.camp-card-row:active` / `.camp-icon-grid-item:active` 的 `transform: scale(.98)` 触控反馈仅 CSS 声明，未实测
- ⚠️ **身份差异视图未验**：Step 5（共建者/管理员/旁观者视图差异）留后续卡，当前仅实现了 member/visitor 二分 + 通用的 `_campDisplayStatus` 状态路由
- ✅ **已跑 node 隔离脚本**：语法检查 + M4b 回归 + 交叉引用检查全部通过，见 §② 原始输出

---
**回执完成** · 一营 Claude Code · 2026-08-02 12:35
**待皇帝冒烟关**（验收四关第 4 关）：手动验收清单 #1-#10 逐项点验
