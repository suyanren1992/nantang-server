> ⚠️ 本文档已合并至 [统一执行方案.md](../统一执行方案.md)。执行请以该文档为准。本文档保留为审查记录。
# postMessage 通信架构审查报告

## 通信链路图

```
主应用 nantang-mobile.html              地图 index.html + app.js
─────────────────────────              ─────────────────────────
window.addEventListener('message')      Game mock:
  openTask → 关地图+开大厅              openTask(id) → _post({openTask, id})
  toast → 显示绿色浮层                   toast(msg) → _post({toast, msg})
  confirm → confirm() 弹窗               confirm → 原生confirm()（不走postMessage）
  closeMap → closeOverlay                getUser → 本地mock（不通信）
                                         getData → 本地mock（不通信）
SEND: confirmResult → 地图无监听器       backToVillage() → _post({closeMap})
```

## 发现的问题

| 编号 | 严重程度 | 问题 | 位置 |
|------|---------|------|------|
| P1 | **高** | 数据隔离：iframe 中 Game 对象独立，`getUser()` 永远返回"砚仁"，`getData()` 永远返回空 → HARDCODED_BUILDINGS | index.html L116-127 |
| P2 | **中** | `openTask` 的 `id` 参数被接收方丢弃——地图点"厨房打扫"，大厅开了但不会定位 | L1371 |
| P3 | **中** | `confirm` 两端不一致：主应用准备了 postMessage 双向协议，地图 mock 直接调 `window.confirm()` | index.html L120 |
| P4 | **低** | `confirmResult` 死代码：主应用回发但地图无监听 | L1373 |
| P5 | **低** | `Game.refresh()` 只 console.log，不触发同步 | index.html L125 |
| P6 | **低** | 所有 postMessage 用 `'*'` origin，未校验 `e.origin` | 多处 |
| P7 | **低** | `_post` 在 index.html 和 app.js 各定义一次，重复声明 | index.html L115, app.js L3 |

## 结论

核心通信框架正确（3 种消息可通过）。两个结构性缺陷：
1. **数据隔离**：主应用未向 iframe 注入 Game，地图始终用 mock
2. **openTask 参数丢失**：任务 ID 被丢弃，大厅不定位到具体任务
