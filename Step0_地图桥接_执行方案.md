# Step 0：地图桥接补全

> 来源文档：`地图融合方案.md`、`多人部署方案.md`（静态资源本地化部分）
> 前置依赖：无
> 解锁：所有需要地图交互的阶段

---

## 做什么

当前地图是 iframe 孤岛——能显示，但按钮全废（点打扫没反应、用户名叫「砚仁」、NT 不通）。需要补全 `window.Game` 桥接对象，让地图和主应用互通。

## 关键设计决策

- 主应用是唯一的数据主人。地图不存任何状态，只是「另一块屏幕」
- 地图 iframe 第一行 `window.Game = parent.Game`，之后所有操作回到主应用
- 通信方式：`postMessage`（iframe → 父窗口） + 直接调用 `parent.Game.*`（父窗口暴露的方法）

## 具体任务

| # | 任务 | 说明 |
|---|------|------|
| 0.1 | 补全 `window.Game` 对象 | `getUser()` / `openTask()` / `openMe()` / `openMarket()` / `toast()` / `confirm()` / `earnNT()` / `spendNT()` / `getMyNT()` / `getMarketItems()` |
| 0.2 | 修复地图 `_me()` 函数 | 从写死"砚仁"改为读 `parent.Game.getUser()` |
| 0.3 | 修复 `backToVillage()` | 从 `parent.showVillageSquare()` 改为 `parent.closeOverlay('overlayMap')` |
| 0.4 | 统一 toast/confirm | 地图内的 alert → 主应用的 toast/confirm |
| 0.5 | postMessage 监听 | `openTask` / `closeMap` / `userUpdate` → 路由到主应用对应函数 |
| 0.6 | 顺带检查 `Clock.today()` 时区 | 如果用了 `new Date().toISOString().slice(0,10)` → 改为 `Clock.today()`（UTC+8 凌晨 bug） |

> **执行顺序**：Step 0 和 Step 1 都标注「无依赖」，但 Step 0 测试需要至少一个已注册用户。因此 **Step 0 必须在 Step 1 之前执行**（Step 1 会清空所有种子用户，导致 Step 0 无法测试）。Step 1 执行完后，手动注册一个用户再回来验证 Step 0。

## 验证

- 至少有一个已注册用户可用于测试
- 在地图点「厨房打扫」→ 能打开任务大厅
- 点返回→回到村口（不是地图首页）
- 打扫后 toast 和主应用一致
- 用户名显示当前登录用户（非写死"砚仁"）
