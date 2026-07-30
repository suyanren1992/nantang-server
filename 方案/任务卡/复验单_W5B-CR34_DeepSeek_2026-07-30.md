---
created: '2026-07-30'
project: 南塘云村
type: 复验单
domain: 独立复验
派工方: 丞相 Codex
施工方: 二营 DeepSeek
优先级: 中（出闸后补验）
status: 待复验
---
# 复验单 · W5-B / CR-3/4 独立复验（利益冲突回避）

## 为什么派这单
W5-B(`ab6a68a`)、CR-3/4(`4f2624d`) 均为 Codex 原二营身份提交。Codex 已升丞相，
按"丞相不得副署自己施工期提交的卡"红线，需二营 DeepSeek 独立复验，丞相只做最终对账。
（本单为**出闸后补验**——皇帝已授权信任原回执+机检直出，补验用于事后背书/发现问题即转卡。）

## 怎么复验（一条命令即可）
```
cd 项目\实景游戏移动端代码_new
pwsh server\scripts\丞相验收.ps1 -Hash ab6a68a   # W5-B
pwsh server\scripts\丞相验收.ps1 -Hash 4f2624d   # CR-3/4
```
机检已由丞相跑过均 PASS（136 passed）。你要补的是**人工判断层**：

### W5-B 要点
- H-4：`camps.py camp_report` 非 admin 须 active CampMembership 否则 403 — 读 diff 确认逻辑
- H-6：`data.py` 三 GET(canteen_menu/map_locations/announcements) 加了鉴权
- H-7：`delete_camp` 级联加 CampMembership
- **H-5 判误诊**：重点复核——ActivityLog 无 user 字段、写入端不记归属、GET 已鉴权。同意误诊/或提异议
- 回执：`方案/任务卡/W5-B_回执_二营_2026-07-30.md`

### CR-3/4 要点
- BUG-1：住宿结算裸池写入补锁（accommodation.py + admin.py）
- BUG-2：营地 partial 结算送钱 — **注意原派发单 BUG-2 药方(is_camp: camp_balance+=unclaimed)经实测会造币，正确修复为营地任务不退款**。复核守恒判据 total_system delta==0
- 回执：`方案/任务卡/CR-3-4_回执_二营_2026-07-30.md`（若存在）

## 回报格式
一行结论 + 异议点（若有）：`复验 PASS <卡号>` 或 `异议：<卡号> <理由>`。
异议成立即由丞相转修复卡。
