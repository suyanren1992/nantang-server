# 📌 流程债标记 · c5dbfb1 实际含 NT-2 + ORPHAN-QUEUE 双修

> **类型**：流程债（commit message 不诚实）
> **记录日**：2026-08-02
> **记录人**：丞相（异体验收时发现）
> **关联**：铁律 12 新立、待办总账 #46 关闭、台账标注

## 一、事实（铁证）

`c5dbfb1` commit 实际包含 **3 件事**，但 message 只写了 1 件：

| 件 | 文件 | 行 | 实际改动 |
|---|---|---|---|
| **ORPHAN-QUEUE** 主改 | `server/cron.py` | +66/-X | 新增 `_settle_queued_withdrawals()` + 集成到 `tick_daily()` |
| **ORPHAN-QUEUE OQ-C** | `server/routes/admin.py` | +20/X | reject 路径连带取消 queue 流水 |
| **NT-2-A** 修复 | `server/routes/nt.py` | 530 | `user.nt_balance -= req.amount` → `user.nt_balance -= pay_now` |
| **NT-2-B** 修复 | `server/routes/admin.py` | 71-101 | confirm 改 `entry.amount=pay_now` 算法 + 新增 `withdraw_confirmed/rejected` 流水 |

commit message：`W7-ORPHAN-QUEUE 二营: 兑现 withdraw_queued 流水 + admin reject 连带取消 + 2条测试`

**4 文件 +295/-6，message 只字未提 NT-2。**

## 二、当时为何合并（推测，不替前施工方认账）

最可能原因（无现场记录可证）：
1. ORPHAN-QUEUE 卡面**显式依赖** NT-2 完成（前置 #3）
2. NT-2 修复代码被施工方**直接复用**到 ORPHAN-QUEUE（confirm 算账模式同款）
3. 为图"省一笔 commit"合并提交
4. **未在 message 标注** = 偷工

## 三、为什么不补救（修复路径决策）

砚仁 2026-08-02 谕：**修复要修对，不靠回滚兜底**

| 候选方案 | 代价 | 砚仁意见 |
|---|---|---|
| A. 不补救，git 历史保留 | 0 | 留污点（message 撒谎） |
| **B. 诚实补标记** | 1 笔 docs commit | **砚仁选** |
| C. revert 拆 commit | 改写历史，危险 | 违反"不靠回滚"原则 |
| D. 拆 commit 重做 | 4 笔重做 | 同 C，违反原则 |

**选 B 的理由**：
- 代码修复是**对的**（10 passed 测试 + 手工等式推导 4 场景全平）
- commit message 是**诚信债**不是**代码债**
- 文档补标记 = 留下审计线索，未来追溯时能找到 NT-2
- 不动 git 历史 = 保护已发布的事实

## 四、NT-2 修复追溯路径

未来任何人想看 NT-2 修复，看这里：

```bash
# 方法 1：看 c5dbfb1 的 nt.py diff
git show c5dbfb1 -- server/routes/nt.py server/routes/admin.py

# 方法 2：grep NT-2 注释（行内标记）
grep -n "W7-NT-2" server/routes/nt.py server/routes/admin.py
# → nt.py:528-530  # W7-NT-2 B-最小: 只扣能发的部分(pay_now)...
# → admin.py:71    # W7-NT-2 B-最小: entry.amount = pay_now...

# 方法 3：看 NT-2 测试
git log --all --oneline | xargs -I {} git show {} -- server/tests/test_nt_reserve_equation.py | grep "TestWithdrawQueueConservation"
# → 同样在 c5dbfb1 里（4 笔 NT-2 测试 + 2 笔 ORPHAN-QUEUE 测试）
```

## 五、流程债教训（铁律 12 源起）

| 现象 | 根因 | 解药 |
|---|---|---|
| 一笔 commit 多件事 | "图省事" | **铁律 12：bug 重新做不靠 revert** |
| message 隐瞒修改面 | 怕"显得不专业" | **铁律 12：commit message 必诚实列修改项** |
| 难以单点回滚 | commit 颗粒度粗 | **铁律 12：一项一 commit 是底线** |

## 六、关闭的台账项

- ✅ #46「丞相卡面错字修」—— 不再单独 commit 卡面错字（修复已对，message 撒谎已补标记）
- ✅ #49「W7-ORPHAN-QUEUE」—— 已 commit c5dbfb1，但同时含 NT-2 修复
- ✅ #3「W7-NT-2」—— 已并入 c5dbfb1，台账改"NT-2 修复 = c5dbfb1 的一部分"

## 七、未关闭项

- 🔴 架构图（铁律 8 死信）—— `方案/架构现状图.md` 仍落后，W7-ARCH-1 已派
- 🟠 4 张新功能卡待派（NT-DECIMAL / AUDIT-P0 / CAMP-UI-2 / NOTIF-1）
- ⚪ MICRO-TASK 待 NT-DECIMAL 完成后才能派

---

**太傅注**
- 补课：**commit message 是事件账本的标题**。标题撒谎 = 账本不可信。
- 一句原理：诚实标记 = 给未来的人留"能找到"的路；不诚实 = 留一条看似存在但实际不存在的路。
- 不这样做会怎样：将来发现 NT-2 修复有 bug 想追溯，看到 message「ORPHAN-QUEUE」就以为不是它，跳过 → 错过 bug → bug 永远留着。
