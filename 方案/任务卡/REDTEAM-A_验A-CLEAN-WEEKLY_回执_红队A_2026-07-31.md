# REDTEAM-A 审查回执：A-CLEAN-WEEKLY

| 字段 | 值 |
|------|------|
| 卡号 | REDTEAM-A_验A-CLEAN-WEEKLY |
| 审查方 | 红队 A (Qoder H 窗代审) |
| 日期 | 2026-07-31 |
| 审查目标 | 1 营 A-CLEAN-WEEKLY (commit f269d7c) |
| 文件范围 | nantang-mobile/js/app.js:1791-1934, api.js:173-177, index.html:309-316 |
| 后端对照 | server/routes/clean_weekly.py:1-236, nt.py:1100-1119 |

---

## 5 项核心验证

### ① 管理员端：勾选空间 + 选模式 + 一键发放

**判定：真 ✅（有边界问题 🟡）**

| 实证 | 文件:行号 |
|------|-----------|
| `_renderCleanAdmin()` 渲染勾选 UI | app.js:1835-1872 |
| 3 列 grid + checkbox | app.js:1854-1858 |
| 均分/按人数 radio | app.js:1859-1862 |
| `_doDistribute()` 发放逻辑 | app.js:1873-1901 |
| 最少 3 个空间校验 | app.js:1875 |
| 后端 distribute 幂等（同周 400） | clean_weekly.py:34-42 |

**边界 case：**
- 🟡 **空间来源只取有 floors 的建筑** — `getBuildings().filter(b => b.floors && Object.keys(b.floors).length > 0)` (app.js:1837)，但 HARDCODED_BUILDINGS 中 field/stage/plaza/jingzi_pavilion/lawn 无 floors，这些空间不可选
- 🟡 **week 计算前端用 `getDay()`**（周日=0，需 +1 修正），后端用 `weekday()`（周一=0）— 若周日发放，前端算出的 week 可能偏移

---

### ② 用户端：TaskCard 三态（🟢可领 / 🔒已领 / 🧹已选）

**判定：真 ✅**

| 实证 | 文件:行号 |
|------|-----------|
| `_cleanStatusText()` 三态判断 | app.js:1816-1820 |
| `completed` → ✅ 已完成 | app.js:1817 |
| `claimed` + 本人 → 🧹 已选 | app.js:1818 |
| `claimed` + 他人 → 🔒 已领 | app.js:1818 |
| 默认 → 🟢 可领 | app.js:1819 |
| 卡片背景/边框随状态变 | app.js:1893-1897 |

**边界 case：**
- ✅ 无 — 三态逻辑清晰，与后端 status 字段一致

---

### ③ 3s 轮询同步

**判定：真 ✅（有优化空间 🟡）**

| 实证 | 文件:行号 |
|------|-----------|
| `_startCleanPolling()` 启动 | app.js:1798-1813 |
| `setInterval(..., 3000)` | app.js:1801 |
| 只更新 `.cwt-status` 文本 | app.js:1808-1810 |
| overlay 关闭时自停 | app.js:1803 |
| `_stopCleanPolling()` 清理 | app.js:1813 |

**边界 case：**
- 🟡 **轮询只更新状态文本，不更新按钮** — 用户 A 认领后，用户 B 的轮询只看到状态文字从「🟢可领」变「🔒已领」，但「🧹 选择」按钮仍在（需手动刷新才能消失）
- 🟡 **轮询无错误处理** — `.catch(function(){})` 空函数，网络错误静默

---

### ④ 5 端点全部接入

**判定：真 ✅**

| 端点 | 前端 API | 后端路由 |
|------|----------|----------|
| POST /distribute | api.js:173 | clean_weekly.py:29-79 |
| GET /tasks | api.js:174 | clean_weekly.py:83-111 |
| POST /claim/{id} | api.js:175 | clean_weekly.py:115-148 |
| POST /unclaim/{id} | api.js:176 | clean_weekly.py:152-185 |
| POST /submit/{id} | api.js:177 | clean_weekly.py:189-235 |

**边界 case：**
- ✅ 5 端点一一对应，参数传递正确

---

### ⑤ 校核闭环：Submit → Verification → peer 校核 → NT 结算

**判定：真 ✅**

| 实证 | 文件:行号 |
|------|-----------|
| submit_task 创建 Verification | clean_weekly.py:220-231 |
| vfy.type = "clean_weekly" | clean_weekly.py:222 |
| vfy.detail 含 clean_weekly_task_id | clean_weekly.py:213-218 |
| task.verification_id 回写 | clean_weekly.py:232 |
| approve 后 task.status = completed | nt.py:1113 |
| approve 后 streak +1 | nt.py:1116 |
| 幂等：已有 verification_id 直接返回 | clean_weekly.py:208-209 |

**边界 case：**
- ✅ 闭环完整，test_clean_weekly.py::TestApproveCompletesTask 覆盖全流程

---

## 特别关注项

### 🔴 管理员自己也应选位置

**判定：真 🔴（未实现）**

| 实证 | 文件:行号 |
|------|-----------|
| `_renderCleanAdmin()` 只有发放 UI | app.js:1835-1872 |
| 无「管理员认领」按钮 | app.js:1835-1872（全文搜索无 admin claim） |
| 后端 claim 无 admin 限制 | clean_weekly.py:115-148（admin 可 claim，但前端无入口） |

**结论：** 管理员只能发放任务，不能自己选位置打扫。后端允许 admin claim，但前端 admin 面板没有「选择」按钮。

---

### ✅ 应急通道「快速打扫」保留

**判定：真 ✅**

| 实证 | 文件:行号 |
|------|-----------|
| `_openQuickSheet('🧹 快速打扫', ...)` | app.js:3536 |
| `_submitCleanEntry()` 独立入口 | app.js:3538-3580 |
| 防刷：每 3 天 N 次限制 | app.js:3551-3558 |

**结论：** 快速打扫与周任务并行，互不干扰。

---

## 🔴 致命发现：openCleanWeekly() 无 UI 入口

| 实证 | 文件:行号 |
|------|-----------|
| `function openCleanWeekly()` 定义 | app.js:1793 |
| 全文搜索 `onclick.*openCleanWeekly` | **0 匹配** |
| index.html 无入口按钮 | index.html:309-316（只有 overlay 结构） |

**结论：** 大扫除周任务的 overlay 已实现，但**没有任何 UI 元素调用 `openCleanWeekly()`**。用户无法从界面进入此功能。

**推测：** 可能遗漏了入口按钮的添加，或等待后续卡接入。

---

## 问题汇总

| 级别 | 问题 | 文件:行号 | 建议 |
|------|------|-----------|------|
| 🔴 致命 | `openCleanWeekly()` 无 UI 入口 | app.js:1793 | 添加入口按钮 |
| 🔴 需求 | 管理员不能自选位置 | app.js:1835-1872 | 增加 admin claim UI |
| 🟡 中 | 轮询只更新文本不更新按钮 | app.js:1808-1810 | 轮询后重绘卡片 |
| 🟡 中 | 空间来源排除无 floors 建筑 | app.js:1837 | 扩展空间收集逻辑 |
| 🟡 低 | week 计算前后端可能不一致 | app.js:1889 vs clean_weekly.py:90-91 | 统一用 ISO week |
| 🟡 低 | 轮询错误静默 | app.js:1811 | 加错误提示 |

---

## 结论

**A-CLEAN-WEEKLY 后端实现完整、闭环正确；前端功能代码齐全但存在 2 个 🔴 级问题阻断用户可用：**

1. **无入口** — 功能存在但用户无法触达
2. **管理员不能自选** — 砚仁已报需求

**建议：** 1 营补 2 项 🔴 后重审，🟡 级可后续迭代。

---

## 太傅注 3 行

- **没验就上线 = 风险** — 砚仁方法论铁律，红队存在意义
- **功能 ≠ 可用** — 代码写了 ≠ 用户能用，入口缺失是典型
- **管理员也是用户** — 权限设计要问「管理员自己能不能用」
