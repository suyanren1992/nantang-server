---
created: '2026-07-29'
project: 南塘云村
type: 施工回执
domain: 档案室内容沉淀
status: 待验收
卡: ZX-4（歼灭战子卡①）· F12 档案室内容沉淀 · 第二段施工
施工营: 豆包 Codex（二营，跨端）
口径裁定: 砚仁终裁口径①（保守，仅公开计数）+ 丞相闸批先行
---
# ZX-4 F12 档案室内容沉淀 · 第二段施工回执

## 🎯 一句话
点档案室成员头像从「只弹 toast」→「下钻个人沉淀面板」；新增只读聚合接口 `GET /api/data/archive_summary/{id}`，**口径①保守——仅公开计数（完成任务/校核/住宿），不露任何 NT 金额/欠费**；pytest 52 passed 4 skipped 零回归；deploy_check 4/4；禁区零改动。

## 一、涉及文件（路径:行号）
| 文件 | 改动 | 锚 |
|---|---|---|
| `server/routes/data.py` | +import `func`/`Tenancy`；新增只读端点 `archive_summary`（NTTask 已结算数 + Verification verified 数 + Tenancy 次数/在住天数）；LIKE ESCAPE 防注入 | data.py:4,9,531-582 |
| `nantang-mobile/js/api.js` | +`archiveSummary(userId)` GET | api.js:142 |
| `nantang-mobile/js/ui-archive.js` | member-row onclick 从 `showToast` 改为 `openMemberArchive`；新增 `openMemberArchive` 下钻面板（头像+三段计数+"仅公开计数"声明+离线/失败兜底） | ui-archive.js:305（onclick）、320-362（新函数） |
| `nantang-mobile/index.html` | ?v= api 16→17、ui-archive 20→21 | index.html:526,534 |
| `server/tests/test_archive_summary.py` | **新增** 2 测试：聚合计数正确+不露敏感字段 / 不存在用户零计数+通配符安全 | 全文 |

## 二、口径①落实（隐私边界与动态 Feed 一致）
- 返回体**仅** 6 字段：`user_id/exists/tasks_completed/verifications_done/accommodation_stays/accommodation_days`。
- **零** NT 金额、余额、欠费、流水明细、reward——测试 `test_archive_summary_aggregates_public_counts` 断言 `keys ∩ {nt_balance,balance,debt,accommodation_due,amount,ledger,reward} = ∅`。
- **未动任何现有读/写口径**：`GET /api/nt/ledger`、`GET /api/data/verifications` 权限一字未改；新端点是独立只读聚合，不放宽账本可见性。前端面板底部明示「仅展示公开计数 · 不含 NT 金额明细」。

## 三、判据实跑贴输出
**真跑联调**（村民 village_zhang：2 已结算任务 + 1 verified 校核 + 1 在住5天）：
```
GET /api/data/archive_summary/village_zhang ->
{ "user_id":"village_zhang","exists":true,
  "tasks_completed":2,"verifications_done":1,
  "accommodation_stays":1,"accommodation_days":5 }
```
**pytest 全量**：`52 passed, 4 skipped`（本卡 +2 测试全绿；零回归）
**deploy_check**：依赖对账/?v=一致性/环境变量/部署冒烟 4/4 PASS；版本号回显 `['21','23','24']`
**禁区零改动**：`git diff data.py nt.py | grep '^\+' | grep 'withdraw|confirm|reject'` → 空

## 四、技术要点
- **聚合口径**：劳动=NTTask `status=='已结算'` 且（assignee==uid 或 assignees JSON 含 uid）；校核=Verification `verifier==uid && status=='verified'`；住宿=Tenancy 全部条数 + active 记录 today−checkin 天数。
- **LIKE ESCAPE 改良**（data.py:540-542）：用 `escape='\\'` 转义 `%/_/\` 而非 D-4/D-16 的「删字符」——删字符会破坏含下划线合法用户名（`zx4_alice` 曾误配失败），ESCAPE 既防注入又不损匹配。**属新端点内自洽，未改 D-4/D-16 既有行**。
- **纯读**：无新表、无迁移、无写路径插桩（方案 A，与勘察一致），实时查源表恒一致。

## 五、未明项 / 挂账
1. 索引：四表仍零 index=True；单社区量级无痛点，**挂账**（数据涨起再加）。
2. 跨营期历史贡献未纳入（勘察未明项②）——本卡按「当前全表计数」，未区分营期；若需按营期拆分另开卡。
3. activity_log 未纳入个人面板（社区级日志，非严格 user 聚合）——维持现状。

---
> **太傅注**：①这是读模型（read model）落地——不物化成表、实时聚合源表，数据量小的最优解（补课：CQRS 读侧可以是查询视图）。②口径①的工程落地＝「新端点只 SELECT COUNT，敏感列根本不进 SQL 投影」，隐私边界靠"不查"而非"查了再滤"，从源头杜绝泄露。③LIKE 注入防护三法对比：删字符（D-4，简单但损合法匹配）＜ ESCAPE 转义（本卡，防注入不损匹配）＜ 参数化+精确匹配（最优，此处因 JSON 数组 LIKE 无法精确故用 ESCAPE）。
