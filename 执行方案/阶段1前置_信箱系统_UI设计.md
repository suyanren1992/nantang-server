# 阶段 1 前置 — 信箱系统 · UI 设计

> 2026-07-19 · 前置：阶段 0（AppData + 身份系统）已完成
> 定位：工作台顶部 📬 + 消息实时计算 + 操作日志归档。独立阶段。
> 参考：`信箱系统_完整方案.md`（消息来源/已读机制/角色分层）、`Hub档案室UI升级与日志导出方案.md`（activity_log 归档）、`信箱分类与打赏通知方案.md`（tip_received）

---

## 〇、核心概念：三条线

```
信息来源（实时计算）          信息展示（📬 面板）         信息归档（永久记录）
─────────────────────      ──────────────────       ──────────────────
data.tasks                  renderInbox()            data.activity_log
  ├─ submitted              ├─ 新消息（未读）          ├─ task_post
  ├─ approved               ├─ 已读（折叠）            ├─ tip
  ├─ rejected               └─ 全部标为已读            ├─ role_change
  └─ overdue                                           └─ ...
data.finance
  ├─ tip_received
  └─ task_reward

      ↑ 遍历数据源当场计算           ↑ 对比 lastOpened 分新/旧        ↑ 操作时同步写入，永不删除
```

**三条线各自独立，不互相替代。** 信箱面板关闭后消息消失（下次打开重新计算），但 `activity_log` 里的记录永久保留。

---

## 一、信息来源：消息如何产生

### 1.1 实时计算，不预存

打开 📬 时当场遍历数据源，不预先存消息。原因（来自 `信箱系统_完整方案.md` §一）：
- 每次操作都触发消息生成 → 散布改动，容易遗漏
- 消息可能和源数据不同步（任务删了消息还在）
- 不需要去重/清理/过期逻辑

### 1.2 数据源 → 消息类型映射

| 数据源 | 遍历逻辑 | 产出的消息类型 | 谁看 |
|--------|---------|--------------|------|
| `data.tasks` | `claimants[].status === 'submitted'` | `submitted` — 按人聚合 | admin, builder |
| `data.tasks` | `claimants[].status === 'approved'`（本人） | `approved` — 审核通过 | 本人 |
| `data.tasks` | `claimants[].status === 'rejected'`（本人） | `rejected` — 审核退回 | 本人 |
| `data.finance` | `type === 'tip' \|\| type === 'encourage'`（to=本人） | `tip_received` — 收到鼓励/打赏 | 本人 |

**阶段 1 前置只做这 4 种。** 逾期提醒、进度异常、NT池预警、截止临近——属于阶段 3-5 的增量。

### 1.3 按人聚合

`submitted` 类型：一个人提交了 3 项任务 → 1 条消息，不是 3 条。

```
❌ 不聚合：  🆕 小云 提交了「厨房打扫」
            🆕 小云 提交了「宣传工作」
            🆕 小云 提交了「物资采购」

✅ 聚合：    🆕 小云 提交了 3 项任务
              厨房打扫 · 宣传工作 · 物资采购
```

其他类型（approved/rejected/tip_received）不聚合，每条独立。

---

## 二、信息归档：activity_log

### 2.1 为什么需要

来自 `Hub档案室UI升级与日志导出方案.md` §二——系统已经在执行操作，但没有留下记录。谁在什么时候做了什么，无从查起。

`activity_log` 是永久操作记录，独立于信箱。信箱显示「当前需要关注的事」；日志是「所有发生过的事」。

### 2.2 日志格式

```javascript
data.activity_log = [
  { time: "2026-07-19T14:30:00", type: "tip", text: "砚仁 → 小云 🌹 1 NT" },
  { time: "2026-07-19T14:25:00", type: "role_change", text: "朝林 从 云村民 升级为 冒险者" },
  { time: "2026-07-19T14:20:00", type: "task_post", text: "砚仁 发布了「厨房打扫」· 5 NT" },
  ...
]
```

### 2.3 阶段 1 前置写日志的操作

| 操作 | type | 日志内容 | 写入位置 |
|------|------|---------|---------|
| 送付费鼓励（🌹/🎁） | `tip` | `"{from} → {to} 🌹 {amount} NT"` | `sendEncouragement()` |
| 送免费鼓励（👏/💪） | `encourage` | `"{from} → {to} 👏太棒了"` | `sendEncouragement()` |
| 邀请码升级角色 | `role_change` | `"{name} 从 {oldRole} 升级为 {newRole}"` | `changeUserRole()` |

**日志查看：升级现有 `📚 归档文件` 面板。** 点击「查看 →」展开后，统计数字下方显示最近的 activity_log 条目。

---

## 三、已读/未读：lastOpened 时间戳

来自 `信箱系统_完整方案.md` §一——不用逐条已读，只存一个时间戳：

```javascript
localStorage.inbox_lastOpened = "2026-07-19T15:30:00"
```

- 消息的 `createdAt` > `lastOpened` → 🆕 新消息
- 打开 📬 面板 → 更新 `lastOpened` 到当前时间
- 点「全部标为已读」→ 同上

**不用 `inbox_seen_ids` 数组。** 那条路复杂度高（需要存每条消息 ID、去重、清理），收益低（信箱不是聊天软件，不需要 100% 消息级准确率）。

现有 `getInboxSeenIds()` / `isInboxMsgNew()` 保留不动（其他模块可能引用），但信箱渲染不再依赖它们。

---

## 四、UI 设计

### 4.1 顶部栏（改 `.my-topbar`）

```
现有：
┌──────────────────────────────────────┐
│ ✕  [头像]  砚仁 🏅 0                  │
│            ☁️ 云村民                   │
└──────────────────────────────────────┘

改为：
┌──────────────────────────────────────┐
│ ✕  [头像]  砚仁 🏅 0          📬 2   │  ← 右侧加 📬 + 未读数字 badge
│            ☁️ 云村民                   │
└──────────────────────────────────────┘
```

- 📬 图标按钮：`.my-topbar` 右侧，`margin-left: auto`
- 未读数字：红色小圆 badge，叠在 📬 右上角。0 条未读时不显示数字
- 点击 📬 → 主内容区替换为信箱面板

### 4.2 信箱面板

```
┌──────────────────────────────────────┐
│ 🔴 新消息                             │
│                                      │
│ 🆕 小云 提交了 3 项任务     7/18     │  ← 按人聚合
│   厨房打扫 · 宣传工作 · 物资采购      │  ← 副行：任务名列表
│                                      │
│ 💬 砚仁 送了 🌹 · 1 NT      7/19     │
│                                      │
│ ── 已读 ──────────────────────────  │
│                                      │
│ ✅ 「厨房打扫」已通过 · 5 NT  7/17   │
│ ❌ 「宣传工作」被退回          7/16   │
│                                      │
│ [全部标为已读]                        │  ← 底部固定按钮
└──────────────────────────────────────┘
```

**每行规格：**
- padding: 8px 14px，底部 1px dotted #f0f0f0
- 主行：图标 16px + 文字 `.7rem` + 日期 `.58rem #aaa` 右对齐
- 聚合类消息（submitted）：主行显示「xxx 提交了 n 项任务」，副行显示任务名列表（`.62rem #8a8a8a`，最多显示 3 个任务名，超出显示「…还有 n 项」）
- 无卡片、无阴影——纯列表

**消息格式：**

| 类型 | 图标 | 主行 | 副行 |
|------|------|------|------|
| `submitted` | 🆕 | `{person} 提交了 {n} 项任务` | 任务名列表（最多3个） |
| `approved` | ✅ | `「{taskName}」已通过 · {amount} NT` | — |
| `rejected` | ❌ | `「{taskName}」被退回` | — |
| `tip_received` (付费) | 💬 | `{from} 送了 🌹 · {amount} NT` | — |
| `tip_received` (免费) | 💬 | `{from} 送了 👏太棒了` | — |

### 4.3 底部栏（不动）

```
📋 任务  |  💰 账本  |  📦 物品
```

---

## 五、交互

| 操作 | 结果 |
|------|------|
| 点顶部 📬 | 主内容区切换为信箱面板，更新 `lastOpened`，badge 归零 |
| 点底部任意 Tab | 回到该 Tab 内容，📬 保持可见 |
| 点「全部标为已读」 | 更新 `lastOpened`，新消息区清空 |
| 有新操作发生 | 下次打开 📬 时重新计算，新消息出现在顶部 |

---

## 六、实现清单

| # | 做什么 | 文件 | 估计行数 |
|---|--------|------|---------|
| B1.1 | `.my-topbar` 右侧加 📬 图标按钮 + badge span | nantang-mobile.html | ~5 |
| B1.2 | 信箱面板容器 HTML | nantang-mobile.html | ~8 |
| B1.3 | `renderInbox()` — 实时遍历 data.tasks + data.finance，按人聚合 submitted，对比 lastOpened 分新/旧 | nantang-mobile.html | ~45 |
| B1.4 | 点击 📬 / 底部 Tab 切换面板逻辑 | nantang-mobile.html | ~10 |
| B1.5 | `getInboxLastOpened()` / `updateInboxLastOpened()` — 读写 `inbox_lastOpened` | mobile-bundle.js | ~8 |
| B1.6 | `computeInboxMessages` 扩展 — 加 `tip_received` 扫描 + submitted 按人聚合 | mobile-bundle.js | ~25 |
| B1.7 | `updateInboxBadge()` 改写 — 操作顶部 badge 元素 | mobile-bundle.js | ~5 |
| B1.8 | `logActivity(type, text)` — 写入 `data.activity_log` | mobile-bundle.js | ~8 |
| B1.9 | `sendEncouragement()` 调用 `logActivity('tip', ...)` | nantang-mobile.html | ~2 |
| B1.10 | `changeUserRole()` 调用 `logActivity('role_change', ...)` | auth.js | ~2 |
| B1.11 | CSS — 顶部 📬 + badge + 消息行样式 | nantang-mobile.html | ~15 |

---

## 七、本阶段不做的

| 不做 | 原因 |
|------|------|
| 消息点击跳转到对应 Tab | 阶段 3（营地骨架建好 Tab 体系后统一加） |
| 逾期提醒 / 进度异常 / NT池预警 | 阶段 4-5（营中运营产生这些数据后） |
| 冒险者消息（截止临近、NT到账） | 阶段 3（营地骨架 + 冒险者底部栏） |
| 日志浏览 UI（📜 日志 Tab） | 阶段 3+（档案室统一入口） |
| 5 分类 chip 筛选 | 消息量少时不值得，阶段 3 消息类型增多后加 |
| 删除旧 `inbox_seen_ids` 逻辑 | 保留不动，不删不增 |

---

## 八、验收

- [ ] 工作台顶部栏右侧显示 📬，有未读消息时显示红色数字
- [ ] 送 🌹 后，接收方打开工作台 → 📬 显示未读数 +1 → 点开看到 `💬 xxx 送了 🌹 · 1 NT`
- [ ] 送 👏 后，接收方看到 `💬 xxx 送了 👏太棒了`（无金额）
- [ ] 小云提交 3 项任务 → 管理员信箱显示 1 条聚合消息（不是 3 条）
- [ ] 打开 📬 → 新消息在上，已读在下 → 关闭 → 再次打开全部变为已读
- [ ] 「全部标为已读」后新消息区清空，badge 归零
- [ ] Console 输入 `AppData._data.activity_log` → 看到 tip/encourage/role_change 记录
- [ ] 任务审核通过/退回 → 当事人信箱有对应消息

---

*本阶段完成后进入阶段 1（社区主页与营地窗口）。*
