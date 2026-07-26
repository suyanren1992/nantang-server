---
created: 2026-07-27
project: 南塘云村
type: 任务卡
domain: 前端UI
status: 已发包
card: SM-3
version: 1.0
---

# SM-3 · 社区副本 UI 六问修复卡

> 来源：砚仁 2026-07-27 00:45 线上实测报六问；丞相只读勘察立案（commit `64ce703`）+ 旧版考古补证（`3aa544c`）。
> 砚仁 00:53 三裁：①时间线删+迁 **准**；②快捷打扫恢复原样 + 子项 3/5 并案 **准**；③排 SM-1 push 后施工 **准**（SM-1 已 push，排队条件解除）。
> 分工：一营施工，二营验收，真机关留砚仁。施工基底 = SM-1（`5a13803`）之后的 main。

---

## 一、施工子项（4 项，按砚仁裁定）

### 子项 1 · 时间线删出社区副本、迁入个人档案库 🔴

**实证**：`openCommunityPage()`（data.js:599）每次进社区副本都调 `renderTimeline()`；时间线段钉死在 overlay 底部（index.html:164-165），填的是 AppData **个人 journal**（ui-phase4.js:240-257）——个人流水混进社区公共页。

**修法**：
1. index.html:164-165 删除「📜 南塘时间线」段（section-head + timelineList 容器）；
2. data.js:599 `openCommunityPage` 去掉 `renderTimeline()` 调用；
3. `renderTimeline()`（ui-phase4.js:240）本体不删——改造接入个人页「归档文件」展开区（index.html:134 `toggleArchiveExpand` / `archiveExpand` 容器），个人档案库 = 任务档案 + 时间线流水。

**验收**：社区副本全页无时间线段；个人页展开归档文件能看到自己的时间线流水（有数据时）。

### 子项 2 · 活动卡片 null 🔴

**实证**：`renderCommunityHub` 卡片（data.js:623）直接拼 `c.emoji/c.name/c.date/c.people/c.theme`，无兜底无转义——服务端某 camp 字段为 null 即原样显示 "null"。

**修法**：
1. 渲染层加兜底：`c.theme||''`、`c.date||'日期待定'`、`c.people||0`、`c.emoji||'🏕️'` 等（逐字段过一遍），文本字段过 `esc()`；
2. 顺手查服务端该营地哪个字段是 null（施工时打印/查询确认），若是历史脏数据，回执中点名——**不改服务端数据，只报**。

**验收**：三张活动卡无一处 "null" 字样；缺字段显示兜底文案。

### 子项 3+5 并案 · 完成打扫接入校核闭环 + 恢复快捷打扫卡 🔴

**串案背景**：旧版快捷卡区三卡制（旧库 app.js:313-319），🧹打扫卫生 → `openSelfReport({cat:'cleaning'})` 走**校核闭环真路径**；D 修复删卡后，界面唯一打扫完成入口只剩管理面板的 `_submitMyCleaning`（app.js:1690-1704）——只写本地历史 + toast 假报「+N NT」，**NT 实际没进账**，房间状态不复位。**当初删的是真入口，留的是假入口。**

**修法**：
1. **恢复快捷卡**：`_renderQuickEntryCards`（app.js:303-309）加回中间 🧹打扫卫生卡，原样指向 `openSelfReport({cat:'cleaning'})`（ui-cardroom.js:752）；
2. **管理面板接入同一闭环**：`_submitMyCleaning` 改造——选房间确认后，构造一条校核自报（cat=cleaning，内容带房间名+NT 按房间状态定价），走 `addVerification` 进校核室，**删掉「+N NT」假 toast**，改为「已提交校核」提示；NT 由校核通过环节入账（现有闭环）；
3. **房间状态复位**：提交校核后该房间卡片从 🔴/🟡 恢复 🟢（或标「待校核」态），打扫记录历史保留。

**验收**：完成打扫后**不再出现**「+N NT」假 toast，出现「待校核」提示；校核通过后 NT 真入账（余额实变）；房间状态有可见变化；快捷卡区恢复三卡，🧹卡点击进校核自报且 cat=cleaning 预填。

### 子项 6 · 田间管理快捷卡 —— 不施工

砚仁问「有没有改」，已答疑：没改，快捷卡一直是简单自报（app.js:307 → `openSelfReport({cat:'farming'})`），完整面板在管理卡片区 🌿田地卡。若后续要快捷卡直达完整面板，另开增强卡。

---

## 二、待确认项（不阻塞）

- **子项 4**「取放物品栏里有打扫选区卡片」：勘察实证放取物品弹层（`_openKitchenQuick`，app.js:2505）无打扫卡片；疑似把管理面板房间卡格看串。等砚仁截图/复述确认后另行立案，**本卡不含**。

---

## 三、纪律与闸口

1. **影响面声明**：预计碰 index.html / data.js / ui-phase4.js / app.js，不碰 server/、不碰资金权限端点；回执必附爆炸半径四答 + 回滚方案（git revert）。
2. **?v= 纪律**：每改一个被引用文件，index.html 对应 `?v=` 升 1。
3. **铁律**：完成打扫接校核闭环时，NT 入账只许走现有校核通过路径，**不许新开水龙头**。
4. **闸口**：`python server/scripts/deploy_check.py` 全绿才交付；二营四关验收（逻辑/实测/机检/真机留砚仁）。
5. **回执落盘**：施工回执、验收回执各自独立文件入 `方案/任务卡/`（铁律 9 分文件防污染）。
