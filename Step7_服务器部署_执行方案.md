# Step 7：S6 服务器 + 多用户上线

> 来源文档：`多人部署方案.md`
> 前置依赖：Step 6（时间线——所有功能就绪后再上线）
> 解锁：Step 8（管理后台）

---

## 做什么

从 localStorage 单机版 → Node.js + SQLite 服务器版，支持多人实时协作。

## 关键设计决策

- SQLite WAL 模式（读写不互斥，无线程并发读）
- SSE 实时推送替代轮询（<100ms 延迟，EventSource 自动重连）
- 乐观更新：按钮点击 0ms 响应（先改 UI→后台 confirm→失败回滚）
- 三层数据防护：WAL 原子写入 + 乐观锁（版本号）+ 服务端原子事务
- 原子事务：审核 = 改状态 + 发 CV/XP + 记流水，三步全成功或全回滚
- 静态资源本地化：零 CDN 依赖（头像预生成 SVG、图标用 Emoji）
- 数据可逆迁移：服务器→单机 localStorage 导出
- 照片存储迁移：本地 IndexedDB 照片 → 服务器 `/uploads/` 目录。上传后本地 IndexedDB 降级为缓存（LRU，保留最近 20 张）。解决 iOS Safari 7 天数据驱逐问题。

## 架构

```
浏览器 ──→ Nginx（静态文件 + SSE 直通 + API 反向代理）
               │
               ├── nantang-mobile.html（静态文件，一次加载）
               │
               ├── /api/* ──→ Node.js Express（业务逻辑）
               │                 │
               │                 ├── data.db（SQLite，WAL 模式）
               │                 └── EventBus（SSE 广播）
               │
               └── /api/stream ──→ SSE 长连接（每人一条，实时接收变更）
```

## 为什么 SQLite 而不是 PostgreSQL

- 100 人并发读：WAL 模式无限并发读 ✅
- 写入频率 <1 次/秒，SQLite 能力 >100 次/秒
- 零配置、零运维、备份 = 复制一个文件
- 升级阈值：>500 人在线或 >50 次/秒写入时才需要 PostgreSQL

## 为什么 SSE 而不是 WebSocket

- 浏览器原生 `EventSource`，自带自动重连
- 方向正好：服务器→浏览器（我们只需要这个方向）
- 代码量：后端 ~40 行，前端 ~30 行
- Nginx 只需关闭缓冲即可直通

## 乐观更新

```
用户点击「审核通过」
  ├── 1. 立即更新 UI（0ms）：任务变绿、CV/XP 变化、按钮变灰
  └── 2. 后台发 POST /api/sync/review
       ├── 成功（99.9%）→ 什么都不做，UI 已就位
       └── 失败 409 冲突（0.1%）→ 弹窗提示 + 回滚 UI + 重新拉取数据
```

**适用范围**：
- ✅ 审核通过/退回、发布任务、修改成员信息
- ⚠️ NT 转账（乐观更新但加余额检查，不足则回滚）
- ❌ 注册/登录（必须等服务器确认）

## SSE 断线重连

- EventSource 自动重连（浏览器内置）
- 重连后调 GET /api/data → 全量拉取最新数据 → 覆盖本地
- 心跳每 30 秒（防止 Nginx/浏览器超时断开）
- 不做增量补漏（代码量换一个几乎不会触发的优化不值得）

## API 清单

```
认证：
  POST /api/register              — 注册（在地成员需要邀请码）
  POST /api/login                 — 登录 → 返回 JWT token

数据读写：
  GET  /api/data                  — 获取全量数据
  POST /api/data                  — 全量保存（带 version 乐观锁）

增量同步：
  POST /api/sync/task             — 发布/编辑任务
  POST /api/sync/review           — 审核通过/退回（服务端原子事务）
  POST /api/sync/member           — 修改成员信息
  POST /api/sync/finance          — 财务/账本变更
  POST /api/sync/invite-code      — 生成邀请码

实时推送：
  GET  /api/stream                — SSE 连接
```

## 数据安全五层保护

1. SQLite WAL（写操作中途崩溃→自动回滚）
2. 原子事务（审核=改状态+发CV+记流水→全成功或全回滚）
3. 乐观锁（版本号不匹配→409→前端自动重试）
4. 每日备份（crontab，7 天轮转）
5. pm2 守护（进程崩溃自动重启）

## 回退方案

服务器出问题→`cp data.db backup.db`→导出 data.json→旧版 localStorage 模式恢复运行。迁移不是单向的。

## 静态资源本地化

| 资源 | 当前 | 部署后 |
|------|------|------|
| DiceBear 头像 | `api.dicebear.com` | 预生成 60 个 SVG → `/avatars/` |
| 图标 | Phosphor CDN | Emoji ⚙️ 替代 |
| ExcelJS | jsDelivr CDN | `/exceljs.min.js` 本地文件 |

## 具体任务

| # | 任务 | 说明 |
|---|------|------|
| 7.1 | Express + SQLite 骨架 | WAL 模式 + 表创建 + 初始数据迁移 |
| 7.2 | 注册/登录 API | bcrypt + JWT |
| 7.3 | 数据读写 API | GET/POST /api/data + 乐观锁版本号 |
| 7.4 | 增量同步 API | /api/sync/* 按操作类型细化 |
| 7.5 | 原子事务保护 | 所有 NT/CV 操作用 `db.transaction()` 包裹 |
| 7.6 | SSE 端点 + 广播 | 后端 ~40 行 + 前端 ~30 行 + Nginx 配置 |
| 7.7 | 乐观更新改造 | 所有保存点：先改 UI→后台 API→失败回滚 |
| 7.8 | 局部刷新函数 | SSE 收到事件后只更新受影响的行（替代全量 updateAll） |
| 7.9 | 静态资源本地化 | 头像预生成 SVG / 图标 Emoji 替代 / ExcelJS 本地化 |
| 7.10 | 数据导出/导入 | 服务器→data.json→单机恢复 |
| 7.11 | 备份策略 | crontab 每天备份 + 7 天轮转 |
| 7.12 | 部署 + Nginx | Ubuntu + pm2 + Nginx 反向代理 + SSE 直通 |

## 验证

5 人同时操作→实时看到彼此变更→审核冲突时自动重试→NT/CV/XP 分毫不差→可导出回单机模式。
